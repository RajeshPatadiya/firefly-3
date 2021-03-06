/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
import {take} from 'redux-saga/effects';
import {unionWith} from 'lodash';
import ImagePlotCntlr, {visRoot} from '../ImagePlotCntlr.js';
import {modifyRequest, processPlotImageSuccessResponse} from '../task/PlotImageTask.js';
import {callGetWebPlot, callGetWebPlotGroup, callGetWebPlot3Color} from '../../rpc/PlotServicesJson.js';
import {getPlotViewById} from '../PlotViewUtil.js';
import {Band} from '../Band.js';
import {logError} from '../../util/WebUtil.js';



/**
 * this saga does the following:
 * <ul>
 *     <li>watches to PLOT_IMAGE_START, if the action needs width and height and it is not available, it stores the action
 *     <li>when width/height is available via UPDATE_VIEW_SIZE, the PLOT_IMAGE_START action is continued
 *     <li>Either way when a plot is all set to continue it call the server 
 * </ul>
 * @param {Object} params object with sega parameters
 * @param {Function} dispatch the dispatcher function
 * @param {Function} getState get the store
 */
export function* imagePlotter(params, dispatch, getState) {

    let waitingPlotActions= [];

    while (true) {
        var action= yield take([ImagePlotCntlr.PLOT_IMAGE_START,ImagePlotCntlr.UPDATE_VIEW_SIZE]);
        switch (action.type) {
            case ImagePlotCntlr.PLOT_IMAGE_START:
                if (action.payload.plotType==='image') {
                    if (canContinue(action)) {
                        continuePlotting(makeContinueAction(action),dispatch);
                    }
                    else {
                        waitingPlotActions= unionWith(waitingPlotActions,[action],
                            (a1,a2) => a1.payload.requestKey===a2.payload.requestKey);
                    }
                }
                break;

            case ImagePlotCntlr.UPDATE_VIEW_SIZE:
                const {plotId}= action.payload;
                const waitActions= waitingPlotActions.filter( (a) => actionMatches(a,plotId));
                waitActions.forEach( (waitAction) => {
                    const {requestKey}= waitAction.payload;
                    if (canContinue(waitAction)) {
                        continuePlotting(makeContinueAction(waitAction),dispatch);
                        waitingPlotActions= waitingPlotActions
                            .filter( (a) => a.payload.requestKey!==requestKey) // filter out this request
                            .filter( (a) => !actionMatches(a,plotId));         // filter out any duplicates
                    }
                });
                break;
        }
    }
}


function actionMatches(a,plotId) {
    const {wpRequestAry}= a.payload;
    if (wpRequestAry) {
        return wpRequestAry.some( (req) => req.getPlotId()===plotId);
    }
    else {
       return a.payload.plotId===plotId;
    }
}


function getRequestAry(payload) {
    const {wpRequestAry, wpRequest,threeColor, redReq, greenReq, blueReq}= payload;
    if (wpRequestAry) return wpRequestAry;
    return  [threeColor ? redReq || greenReq || blueReq : wpRequest];
}


/**
 * The action can continue if the width and height for every plot id has been set in the store
 * @param {Action} rawAction
 * @return {boolean}
 */
function canContinue(rawAction) {
    return getRequestAry(rawAction.payload).every( (req) => {
        return canContinueRequest(req,getPlotViewById(visRoot(),req.getPlotId()));
    });
}


/**
 * Check one PlotView and determine if the width and height has been set
 * @param {WebPlotRequest} req
 * @param {PlotView} pv
 * @return {boolean}
 */
function canContinueRequest(req, pv) {
    if (!pv) return false;
    const {viewDim:{width,height}}= pv;
    return width && height;
}




/**
 * 
 * @param rawAction
 * @return {*}
 */
function makeContinueAction(rawAction) {
    const {wpRequestAry}= rawAction.payload;
    return wpRequestAry ? makeContinueActionGroup(rawAction) : makeContinueActionSingle(rawAction);

}

function makeContinueActionSingle(rawAction) {
    let {wpRequest,redReq, greenReq, blueReq}= rawAction.payload;
    const {plotId}= rawAction.payload;
    const pv= getPlotViewById(visRoot(),plotId);
    const {viewDim:{width,height}}= pv;
    redReq= addWidthHeight(redReq,width,height);
    greenReq=addWidthHeight(greenReq,width,height);
    blueReq= addWidthHeight(blueReq,width,height);
    wpRequest= addWidthHeight(wpRequest,width,height);
    const payload= Object.assign({},rawAction.payload, {wpRequest, redReq, greenReq, blueReq});
    return Object.assign({}, rawAction,{payload});
}


function makeContinueActionGroup(rawAction) {

    let {wpRequestAry}= rawAction.payload;
    wpRequestAry= wpRequestAry.map( (req) => {
        const pv= getPlotViewById(visRoot(),req.getPlotId());
        const {viewDim:{width,height}}= pv;
        return addWidthHeight(req,width,height);
    });

    const payload= Object.assign({},rawAction.payload, {wpRequestAry});
    return Object.assign({}, rawAction,{payload});
}




/**
 * 
 * @param r
 * @param {number} w
 * @param {number} h
 * @return {*}
 */
function addWidthHeight(r,w,h) {
    if (!r) return;
    r= r.makeCopy();
    r.setZoomToWidth(w);
    r.setZoomToHeight(h);
    return r;
}

function continuePlotting(rawAction, dispatcher) {
    const {wpRequestAry}= rawAction.payload;
    return wpRequestAry ? continueGroupPlotting(rawAction, dispatcher) : continueSinglePlotting(rawAction,dispatcher);
}

/**
 * 
 * @param rawAction
 * @param dispatcher
 */
function continueSinglePlotting(rawAction, dispatcher) {
    const {plotId,threeColor, useContextModifications:useCtxMods}= rawAction.payload;
    let {wpRequest, redReq, greenReq, blueReq}= rawAction.payload;

    const pv= getPlotViewById(visRoot(),plotId);
    if (pv) {
        const {plotViewCtx}= pv;
        if (wpRequest && !Array.isArray(wpRequest)) {
            wpRequest= modifyRequest(plotViewCtx,wpRequest,Band.NO_BAND, useCtxMods);
        }
        if (redReq) redReq= modifyRequest(plotViewCtx,redReq,Band.RED, useCtxMods);
        if (greenReq) greenReq= modifyRequest(plotViewCtx,greenReq,Band.GREEN, useCtxMods);
        if (blueReq) blueReq= modifyRequest(plotViewCtx,blueReq,Band.BLUE, useCtxMods);
    }

    const p= threeColor ? callGetWebPlot3Color(redReq,greenReq,blueReq) : callGetWebPlot(wpRequest);

    p.then( (wpResult) => processPlotImageSuccessResponse(dispatcher,rawAction.payload,wpResult) )
        .catch ( (e) => {
            dispatcher( { type: ImagePlotCntlr.PLOT_IMAGE_FAIL, payload: {plotId, error:e} } );
            logError(`plot error, plotId: ${plotId}`, e);
        });
}

function continueGroupPlotting(rawAction, dispatcher) {
    const {requestKey, useContextModifications:useCtxMods}= rawAction.payload;
    let {wpRequestAry}= rawAction.payload;

    wpRequestAry= wpRequestAry.map( (req) =>{
        const pv= getPlotViewById(visRoot(),req.getPlotId());
        return pv ? modifyRequest(pv.plotViewCtx,req,Band.NO_BAND, useCtxMods) : req;

    });
    callGetWebPlotGroup(wpRequestAry, requestKey)
        .then( (wpResult) => processPlotImageSuccessResponse(dispatcher,rawAction.payload,wpResult) )
        .catch ( (e) => {
            dispatcher( { type: ImagePlotCntlr.PLOT_IMAGE_FAIL, payload: {wpRequestAry, error:e} } );
            logError('plot group error', e);
        });
}

