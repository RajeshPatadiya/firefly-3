/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {isNil, get} from 'lodash';
import {retrieveAndProcessImage} from './ImageProcessor.js';
import {drawOneHiPSTile} from './HiPSSingleTileRender.js';
import {findTileCachedImage, addTileCachedImage} from './HiPSTileCache.js';
import {dispatchAddTaskCount, dispatchRemoveTaskCount, makeTaskId } from '../../core/AppDataCntlr.js';
import {createImageUrl, drawEmptyRecTile} from './TileDrawHelper.jsx';

/**
 * The object that can render a HiPS to the screen.
 * @param {{plotView:PlotView, plot:WebPlot, targetCanvas:Canvas, offscreenCanvas:Canvas,
 *          opacity:number, offsetX:number, offsetY:number}} screenRenderParams
 * @param totalCnt
 * @param isBaseImage
 * @param tileProcessInfo
 * @param screenRenderEnabled
 * @return {{drawTile(*=, *=): undefined, drawTileImmediate(*=, *, *=): void, abort(): void}}
 */
export function makeHipsRenderer(screenRenderParams, totalCnt, isBaseImage, tileProcessInfo, screenRenderEnabled) {

    let renderedCnt=0;
    let abortRender= false;
    let firstRenderTime= 0;
    let renderComplete=  false;
    const {offscreenCanvas, plotView}= screenRenderParams;
    const offscreenCtx = offscreenCanvas.getContext('2d');
    const allImageCancelFuncs= [];
    let plotTaskId;



    //  ------------------------------------------------------------
    //  -------------------------  private functions
    //  ------------------------------------------------------------

    /**
     * draw a single tile async (retrieve image and draw tile)
     * @param src
     * @param {HiPSDeviceTileData} tile
     */
    const drawTileAsync= (src, tile) => {
        if (abortRender) return;
        if (isBaseImage) drawEmptyRecTile(tile.devPtCorners,offscreenCtx,plotView);
        let inCache;
        let tileData;
        let emptyTile;

        const cachedTile= findTileCachedImage(src);
        if (!firstRenderTime) firstRenderTime= Date.now();
        if (cachedTile) {
            tileData=  cachedTile.image;
            emptyTile= cachedTile.emptyTile;
            inCache= true;
        }
        else {
            tileData=  src;
            emptyTile= false;
        }

        const {tileAttributes, shouldProcess, processor}= tileProcessInfo;
        const {promise, cancelImageLoad} = retrieveAndProcessImage(tileData, tileAttributes, shouldProcess, processor);
        allImageCancelFuncs.push(cancelImageLoad);
        promise.then((imageData) => {
            renderedCnt++;

            if (!inCache && !emptyTile) addTileCachedImage(src, imageData);
            if (abortRender) return;

            const tileSize= tile.tileSize || imageData.image.width;
            drawOneHiPSTile(offscreenCtx, imageData.image, tile.devPtCorners,
                tileSize, {x:tile.dx,y:tile.dy}, true, tile.nside);


            const now= Date.now();
            const renderNow= (renderedCnt === totalCnt ||
                renderedCnt/totalCnt > .75 && now-firstRenderTime>1000 ||
                now-firstRenderTime>2000);
            // console.log(`${renderedCnt} of ${totalCnt}, renderNow: ${renderNow}, time diff ${(now-firstRenderTime)/1000}`);
            if (renderNow) renderToScreen();
            renderComplete= (renderedCnt === totalCnt);
            if (renderComplete) removeTask();
        }).catch(() => {
            renderedCnt++;
            if (abortRender) return;
            if (renderedCnt === totalCnt) {
                removeTask();
                renderComplete= true;
                renderToScreen();
            }
        });
    };

    /**
     * draw a tile async (retrieve image and draw tile).  Any retrieved tiles will the added to the cache.
     * @param {string} src - url of the image
     * @param {HiPSDeviceTileData} tile
     * @param allskyImage
     */
    const drawTileImmediate= (src, tile, allskyImage) => {
        const image= allskyImage || get(findTileCachedImage(src),'image.image');
        if (image) {
            const tileSize= tile.tileSize || image.width;
            drawOneHiPSTile(offscreenCtx, image, tile.devPtCorners,
                tileSize, {x:tile.dx,y:tile.dy}, true, tile.nside);
        }
        renderedCnt++;
        if (renderedCnt === totalCnt) {
            renderComplete= true;
            renderToScreen();
        }
    };

    const drawAllSkyFromOneImage= (allSkyImage, tilesToLoad) => {

        const width= allSkyImage.width/27;
        let offset;
        for(let i=0; i<tilesToLoad.length; i++) { // do a classic for loop to increase the fps by 3 or 4
            offset= Math.floor(tilesToLoad[i].tileNumber/27);
            tilesToLoad[i].dy= width * offset;
            tilesToLoad[i].dx=  width * (tilesToLoad[i].tileNumber - 27*offset);
            tilesToLoad[i].tileSize= width;
            drawTileImmediate(null, tilesToLoad[i],allSkyImage);

        }
    };

    /**
     * Render the offscreen image to the screen
     */
    const renderToScreen= () => {
        if (!screenRenderEnabled) return;
        const {plotView, targetCanvas, offscreenCanvas, opacity}= screenRenderParams;
        const ctx= targetCanvas.getContext('2d');
        ctx.globalAlpha=opacity;
        if (!isNil(plotView.scrollX) && !isNil(plotView.scrollY)) {
            ctx.drawImage(offscreenCanvas, 0,0);
        }
    };

    const removeTask= () => {
        if (plotTaskId) {
            setTimeout( () => dispatchRemoveTaskCount(plotView.plotId,plotTaskId) ,0);
        }
    };


    //  ------------------------------------------------------------
    //  -------------------------  return public functions
    //  this object has not properties, just functions to render
    //  ------------------------------------------------------------
    return {

        /**
         *
         * draw all tiles async (check cache or retrieve image and draw tile).
         * Any retrieved tiles will the added to the cache.
         * @param {Array.<HiPSDeviceTileData>} tilesToLoad
         * @param {WebPlot} plot
         */
        drawAllTilesAsync(tilesToLoad, plot) {
            if (abortRender) return;
            plotTaskId= makeTaskId();
            setTimeout( () => {
                if (!abortRender && !renderComplete) dispatchAddTaskCount(plot.plotId,plotTaskId, true);
            }, 500);
            tilesToLoad.forEach( (tile) => drawTileAsync(createImageUrl(plot,tile), tile) );
        },

        /**
         *
         * draw all tiles immediately. Any tile not in cache will be ignored.
         * @param {Array.<HiPSDeviceTileData>} tilesToLoad
         * @param {WebPlot} plot
         */
        drawAllTilesImmediate(tilesToLoad, plot) {
            if (abortRender) return;
            for(let i=0; i<tilesToLoad.length; i++) { // do a classic for loop to increase the fps by 3 or 4
                drawTileImmediate(createImageUrl(plot, tilesToLoad[i]), tilesToLoad[i]);
            }
        },

        /**
         *
         * @param {number} norder
         * @param {HiPSAllSkyCacheInfo} cachedAllSky
         * @param {Array.<HiPSDeviceTileData>} tilesToLoad
         */
        drawAllSky(norder, cachedAllSky, tilesToLoad) {
            if (abortRender) return;
            if (norder===3) {
                drawAllSkyFromOneImage(cachedAllSky.order3, tilesToLoad);
            }
            else {
                for(let i=0; i<tilesToLoad.length; i++) { // do a classic for loop to increase the fps by 3 or 4
                    drawTileImmediate(null, tilesToLoad[i],cachedAllSky.order2Array[tilesToLoad[i].tileNumber]);
                }
            }
        },

        /**
         * abort the last async draw, if last draw was sync, it is a noop
         */
        abort()  {
            if (abortRender) return;
            abortRender = true;
            if (isBaseImage && !renderComplete && renderedCnt>0) renderToScreen(screenRenderParams);
            if (!renderComplete) allImageCancelFuncs.forEach( (f) => f && f() );
            removeTask();
        }
    };
}

