/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {get, isEmpty} from 'lodash';
import ImagePlotCntlr, {visRoot, IMAGE_PLOT_KEY,
    dispatchChangeCenterOfProjection, dispatchZoom,
    dispatchAttributeChange,
    dispatchPlotProgressUpdate, dispatchPlotImage, dispatchPlotHiPS} from '../ImagePlotCntlr.js';
import {getArcSecPerPix, getZoomLevelForScale, UserZoomTypes} from '../ZoomUtil.js';
import {WebPlot, PlotAttribute} from '../WebPlot.js';
import {fetchUrl, clone, loadImage} from '../../util/WebUtil.js';
import {getPlotGroupById} from '../PlotGroup.js';
import {primePlot, getPlotViewById, hasGroupLock, isDrawLayerAttached} from '../PlotViewUtil.js';
import {dispatchAddActionWatcher} from '../../core/MasterSaga.js';
import {getHiPSZoomLevelToFit} from '../HiPSUtil.js';
import {getCenterOfProjection, findCurrentCenterPoint, getCorners,
        getDrawLayerByType, getDrawLayersByType} from '../PlotViewUtil.js';
import {findAllSkyCachedImage, addAllSkyCachedImage} from '../iv/HiPSTileCache.js';
import {makeHiPSAllSkyUrl, makeHiPSAllSkyUrlFromPlot,
         makeHipsUrl, getHiPSFoV, resolveHiPSConstant} from '../HiPSUtil.js';
import {ZoomType} from '../ZoomType.js';
import {CCUtil} from '../CsysConverter.js';
import {ensureWPR, determineViewerId, getHipsImageConversion,
        initBuildInDrawLayers, addDrawLayers} from './PlotImageTask.js';
import {dlRoot, dispatchAttachLayerToPlot,
        dispatchCreateDrawLayer, dispatchDetachLayerFromPlot,
        getDlAry, dispatchDestroyDrawLayer} from '../DrawLayerCntlr.js';
import ImageOutline from '../../drawingLayers/ImageOutline.js';
import Artifact from '../../drawingLayers/Artifact.js';
import {isHiPS} from '../WebPlot';
import {dispatchChangeHiPS} from '../ImagePlotCntlr';
import HiPSGrid from '../../drawingLayers/HiPSGrid.js';


//const INIT_STATUS_UPDATE_DELAY= 7000;


//======================================== Exported Functions =============================
//======================================== Exported Functions =============================

let firstTime = true;


function hipsFail(dispatcher, plotId, wpRequest, reason) {
    dispatcher( {
        type: ImagePlotCntlr.PLOT_HIPS_FAIL,
        payload:{
            description: 'HiPS plot failed: '+ reason,
            plotId,
            wpRequest
        }});
}

function parseProperties(str) {
    return str.split('\n')
        .map( (s) => s.trim())
        .filter( (s) => !s.startsWith('#') && s)
        .map( (s) => s.split('='))
        .reduce( (obj, sAry) => {
            if (sAry.length===2) obj[sAry[0].trim()]= sAry[1].trim();
            return obj;
        },{});
}

function initCorrectCoordinateSys(pv) {
    if (!pv) return;
    const plot= primePlot(pv);
    const vr= visRoot();
    const {plotId}= pv;
    const plotGroup= getPlotGroupById(vr, pv.plotGroupId);
    if (hasGroupLock(pv, plotGroup)) {
        const hipsPv = vr.plotViewAry.filter((pv) => isHiPS(primePlot(pv)) && pv.plotId !== plotId)[0];
        const hipsPlot = primePlot(hipsPv);
        if (hipsPlot && hipsPlot.imageCoordSys !== plot.imageCoordSys) {
            dispatchChangeHiPS({plotId, coordSys: hipsPlot.imageCoordSys});
        }
    }
}


function watchForHiPSViewDim(action, cancelSelf, params) {
    const {plotId}= action.payload;
    if (plotId!==params.plotId) return;
    const pv= getPlotViewById(visRoot(), plotId);
    const {width,height}= pv.viewDim;
    if (width && height && width>30 && height>30) {
        const plot= primePlot(pv);
        if (!plot) return;

        const size= pv.request.getSizeInDeg()  || 180;
        if (size) {
            if (size>70) {
                dispatchZoom({ plotId, userZoomType: UserZoomTypes.FILL});
            }
            else {
                const level= getHiPSZoomLevelToFit(pv,size);
                dispatchZoom({ plotId, userZoomType: UserZoomTypes.LEVEL, level });
            }
        }

        const wp= pv.request && pv.request.getWorldPt();
        if (wp) dispatchChangeCenterOfProjection({plotId,centerProjPt:wp});


        initCorrectCoordinateSys(pv);
        addDrawLayers(pv.request, plot);

        cancelSelf();
    }
}

export function addAllSky(plot) {
    const allSkyURL= makeHiPSAllSkyUrlFromPlot(plot);
    const cachedAllSkyImage= findAllSkyCachedImage(allSkyURL);
    if (cachedAllSkyImage) return plot;
    dispatchPlotProgressUpdate(plot.plotId, 'Retrieving HiPS Data', false, null);
    return loadImage(makeHiPSAllSkyUrlFromPlot(plot))
        .then( (allSkyImage) => {
            addAllSkyCachedImage(allSkyURL, allSkyImage);
            return plot;
        });
}

export function addAllSkyUsingProperties(hipsProperties, hipsUrlRoot, plotId, proxyHips) {
    const exts= get(hipsProperties, 'hips_tile_format', 'jpg');
    const allSkyURL= makeHiPSAllSkyUrl(hipsUrlRoot, exts, 0);
    const cachedAllSkyImage= findAllSkyCachedImage(allSkyURL);
    if (cachedAllSkyImage) return hipsProperties;
    dispatchPlotProgressUpdate(plotId, 'Retrieving HiPS Data', false, null);
    return loadImage(makeHiPSAllSkyUrl(hipsUrlRoot, exts, 0, proxyHips))
        .then( (allSkyImage) => {
            addAllSkyCachedImage(allSkyURL, allSkyImage);
            return hipsProperties;
        });
}

export function makePlotHiPSAction(rawAction) {
    return (dispatcher) => {

        const {payload}= rawAction;
        const {plotId, attributes, pvOptions}= payload;
        const wpRequest= ensureWPR(payload.wpRequest);
        wpRequest.setHipsRootUrl(resolveHiPSConstant(wpRequest.getHipsRootUrl()));
        const newPayload= clone(payload, {wpRequest, plotType:'hips', wpRequestAry:[wpRequest]});

        newPayload.viewerId= determineViewerId(payload.viewerId, plotId);
        const hipsImageConversion= getHipsImageConversion(payload.hipsImageConversion);
        if (hipsImageConversion) newPayload.pvOptions= clone(pvOptions, {hipsImageConversion});


        const root= wpRequest.getHipsRootUrl();
        if (!root) {
            hipsFail(dispatcher, plotId, wpRequest, 'No Root URL');
            return;
        }

        if (firstTime) {
            initBuildInDrawLayers();
            firstTime= false;
        }

        dispatcher( { type: ImagePlotCntlr.PLOT_IMAGE_START,payload:newPayload} );
        dispatchPlotProgressUpdate(plotId, 'Retrieving Info', false, null);

        const proxy= true;
        const url= makeHipsUrl(`${root}/properties`, proxy);
        fetchUrl(url, {}, true, false)
            .then( (result)=> result.text())
            .then( (s)=> parseProperties(s))
            .then( (hipsProperties) => {
                const plot= WebPlot.makeWebPlotDataHIPS(plotId, wpRequest, hipsProperties, 'a hips plot', .0001, attributes, false);
                plot.proxyHips= proxy;
                return plot;
            })
            .then( addAllSky)
            .then( (plot) => {
                createHiPSGridLayer();
                dispatchAddActionWatcher({
                    actions:[ImagePlotCntlr.PLOT_HIPS, ImagePlotCntlr.UPDATE_VIEW_SIZE],
                    callback:watchForHiPSViewDim,
                    params:{plotId}}
                    );
                const pvNewPlotInfoAry= [ {plotId, plotAry: [plot]} ];
                dispatcher( { type: ImagePlotCntlr.PLOT_HIPS, payload: clone(newPayload, {plot,pvNewPlotInfoAry}) });
            })
            .catch( (message) => {
                console.log(message);
                hipsFail(dispatcher, plotId, wpRequest, 'Could not retrieve properties file');
            } );
    };
}

function createHiPSGridLayer() {
    const dl= getDrawLayerByType(getDlAry(), HiPSGrid.TYPE_ID);
    if (!dl) {
        dispatchCreateDrawLayer(HiPSGrid.TYPE_ID);
    }
}


export function makeChangeHiPSAction(rawAction) {
    return (dispatcher, getState) => {
        const {payload}= rawAction;
        let {hipsUrlRoot}= payload;
        const {plotId}= payload;

        hipsUrlRoot= resolveHiPSConstant(hipsUrlRoot);
        const pv= getPlotViewById(getState()[IMAGE_PLOT_KEY], plotId);
        const plot= primePlot(pv);
        if (!plot) return;
        const {width,height}= pv.viewDim;
        if (!width || !height) return;


        const url= makeHipsUrl(`${hipsUrlRoot}/properties`, true);
        if (hipsUrlRoot) {
            dispatchPlotProgressUpdate(plotId, 'Retrieving Info', false, null);
            fetchUrl(url, {}, true, false)
                .then( (result)=> result.text())
                .then( (s)=> parseProperties(s))
                .then ( (hipsProperties) => addAllSkyUsingProperties(hipsProperties, hipsUrlRoot, plotId, true))
                .then( (hipsProperties) => {
                    dispatcher(
                        { type: ImagePlotCntlr.CHANGE_HIPS,
                            payload: clone(payload, {hipsUrlRoot, hipsProperties})
                        });
                    initCorrectCoordinateSys(getPlotViewById(visRoot(),plotId));
                })
                .then( () => {
                    dispatcher( { type: ImagePlotCntlr.ANY_REPLOT, payload });
                })
                .catch( (message) => {
                    console.log(message);
                } );
        }
        else {
            dispatcher( { type: ImagePlotCntlr.CHANGE_HIPS, payload });
            dispatcher( { type: ImagePlotCntlr.ANY_REPLOT, payload });
        }
    };
}


//==============================================================================
//------------------------------------------------------------------------------
//==============================================================================



export function makeImageOrHiPSAction(rawAction) {
    return () => {
        const {payload}= rawAction;
        const hipsRequest= ensureWPR(payload.hipsRequest);
        const imageRequest= ensureWPR(payload.imageRequest);
        const allSkyRequest= ensureWPR(payload.allSkyRequest);
        if (!validateHipsAndImage(imageRequest, hipsRequest, payload.fovDegFallOver)) return;


        const {plotId, fovDegFallOver, pvOptions, attributes, plotAllSkyFirst=false}= payload;
        const viewerId= determineViewerId(payload.viewerId, plotId);
        const size= getSizeInDeg(imageRequest, hipsRequest);
        const groupId= getPlotGroupId(imageRequest, hipsRequest);
        const useImage= (plotAllSkyFirst && allSkyRequest) || size<fovDegFallOver;

        let wpRequest= useImage ? imageRequest.makeCopy() : hipsRequest.makeCopy();

        if (useImage) {
            wpRequest= plotAllSkyFirst ? allSkyRequest.makeCopy() : imageRequest.makeCopy();
        }
        else {
            wpRequest= hipsRequest.makeCopy();
        }

        const hipsImageConversion= {hipsRequestRoot:hipsRequest, imageRequestRoot:imageRequest,
                                    allSkyRequest, fovDegFallOver, plotAllSkyFirst};


        wpRequest.setSizeInDeg(size);
        wpRequest.setPlotId(plotId);
        wpRequest.setPlotGroupId(groupId);

        if (useImage) {
            dispatchPlotImage({plotId, wpRequest, viewerId, hipsImageConversion, pvOptions, attributes});
        }
        else {
            dispatchPlotHiPS({plotId, wpRequest, viewerId, hipsImageConversion, pvOptions, attributes});
        }
    };
}



export function convertToImage(pv, allSky= false) {
    const {plotId, plotGroupId,viewDim}= pv;
    const {allSkyRequest, imageRequestRoot}= pv.plotViewCtx.hipsImageConversion;
    dispatchDetachLayerFromPlot(ImageOutline.TYPE_ID, plotId);
    dispatchDetachLayerFromPlot(HiPSGrid.TYPE_ID, plotId);
    const doingAllSky= allSky && allSkyRequest;
    const wpRequest= (doingAllSky) ? allSkyRequest.makeCopy() : imageRequestRoot.makeCopy();
    const hipsFov= getHiPSFoV(pv);
    wpRequest.setPlotId(plotId);
    wpRequest.setPlotGroupId(plotGroupId);
    const plot= primePlot(pv);
    const attributes= clone(plot.attributes, getCornersAttribute(pv) || {});
    if (doingAllSky) {
        wpRequest.setZoomType(ZoomType.TO_WIDTH);
    }
    else {
        wpRequest.setWorldPt(getCenterOfProjection(primePlot(pv)));
        wpRequest.setSizeInDeg(hipsFov);
        wpRequest.setZoomType(ZoomType.ARCSEC_PER_SCREEN_PIX);
        wpRequest.setZoomArcsecPerScreenPix((hipsFov/viewDim.width) * 3600);
    }

    dispatchPlotImage({plotId, wpRequest, attributes, enableRestore:false});
}

export function convertToHiPS(pv, fromAllSky= false) {
    const {plotId, plotGroupId}= pv;
    const wpRequest= pv.plotViewCtx.hipsImageConversion.hipsRequestRoot.makeCopy();
    wpRequest.setPlotId(plotId);
    wpRequest.setPlotGroupId(plotGroupId);
    const plot= primePlot(pv);


    const attributes= clone(plot.attributes, getCornersAttribute(pv) || {});
    if (!fromAllSky) {
        wpRequest.setWorldPt(cenPt);
        wpRequest.setSizeInDeg(pv.plotViewCtx.hipsImageConversion.fovDegFallOver);
        const dl = getDrawLayerByType(dlRoot(), ImageOutline.TYPE_ID);
        if (!dl) dispatchCreateDrawLayer(ImageOutline.TYPE_ID);
        dispatchAttachLayerToPlot(ImageOutline.TYPE_ID, plotId);

        const artAry= getDrawLayersByType(dlRoot(), Artifact.TYPE_ID);
        artAry.forEach( (a) => dispatchDetachLayerFromPlot(a.drawLayerId,plotId));


        const cenPt= CCUtil.getWorldCoords(primePlot(pv), findCurrentCenterPoint(pv));
    }

    dispatchPlotHiPS({plotId, wpRequest, attributes, enableRestore:false});
}

/**
 * Add add a image outline to some HiPS display and attempts to zoom to the same scale.
 * @param {PlotView} pv
 * @param {Array.<string>} hipsPVidAry
 */
export function matchHiPSToImage(pv, hipsPVidAry) {
    if (!pv || isEmpty(hipsPVidAry)) return;
    const attributes=  getCornersAttribute(pv);
    const plot= primePlot(pv);
    const wpCenter= CCUtil.getWorldCoords(plot,findCurrentCenterPoint(pv));
    const dl = getDrawLayerByType(dlRoot(), ImageOutline.TYPE_ID);
    if (!dl) dispatchCreateDrawLayer(ImageOutline.TYPE_ID);
    const asPerPix= getArcSecPerPix(plot,plot.zoomFactor);
    hipsPVidAry.forEach( (id) => {
        Object.entries(attributes).forEach( (entry) => dispatchAttributeChange(id, false, entry[0], entry[1]));
        dispatchAttachLayerToPlot(ImageOutline.TYPE_ID, id);
        dispatchChangeCenterOfProjection({plotId:id, centerProjPt:wpCenter});

        const hipsPv= getPlotViewById(visRoot(), id);
        const hipsPlot= primePlot(hipsPv);
        // const {width,height}= pv.viewDim;
        // const cc= CysConverter.make(hipsPlot);
        // const sp0=  cc.getScreenCoords(attributes[PlotAttribute.OUTLINEIMAGE_BOUNDS][0]);
        // const sp2=  cc.getScreenCoords(attributes[PlotAttribute.OUTLINEIMAGE_BOUNDS][2]);
        // const level= Math.min(width/Math.abs(sp0.x-sp2.x),
        //                       height/Math.abs(sp0.y-sp2.y)) * hipsPlot.zoomFactor;
        // dispatchZoom({ plotId:id, userZoomType: UserZoomTypes.LEVEL, level});

        //---
        const level= getZoomLevelForScale(hipsPlot,asPerPix);
        dispatchZoom({ plotId:id, userZoomType: UserZoomTypes.LEVEL, level});
    }) ;
}

function getCornersAttribute(pv) {
    const plot= primePlot(pv);
    const cAry= getCorners(plot);
    if (!cAry) return null;
    return {
        [PlotAttribute.OUTLINEIMAGE_BOUNDS]: cAry,
        [PlotAttribute.OUTLINEIMAGE_TITLE]: plot.title
    };
}



function validateHipsAndImage(imageRequest, hipsRequest, fovDegFallOver) {
    if (!fovDegFallOver) {
        console.log('You must define fovDegFallOver to the degree field of view to switch between HiPS and Image');
        return false;
    }
    if (!hipsRequest || !imageRequest) {
        console.log('You must define both hipsRequest and imageRequest');
        return false;
    }
    if (!getSizeInDeg(imageRequest, hipsRequest)) {
        console.log('You must call setSizeInDeg in either the hipsRequest or the imageRequest');
        return false;
    }
    if (!getPlotGroupId(imageRequest, hipsRequest)) {
        console.log('You must call setPlotGroupId in either the hipsRequest or the imageRequest');
        return false;
    }
    return true;
}


function getSizeInDeg(imageRequest, hipsRequest) {
    if (imageRequest && imageRequest.getSizeInDeg()) return imageRequest.getSizeInDeg();
    if (hipsRequest && hipsRequest.getSizeInDeg()) return hipsRequest.getSizeInDeg();
    return 0;
}

function getPlotGroupId(imageRequest, hipsRequest) {
    if (imageRequest && imageRequest.getPlotGroupId()) return imageRequest.getPlotGroupId();
    if (hipsRequest && hipsRequest.getPlotGroupId()) return hipsRequest.getPlotGroupId();
}
