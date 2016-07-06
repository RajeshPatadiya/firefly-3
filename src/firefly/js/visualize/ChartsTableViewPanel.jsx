/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React, {Component, PropTypes} from 'react';
import sCompare from 'react-addons-shallow-compare';
// import {deepDiff} from '../util/WebUtil.js';

import {get, debounce, defer, isBoolean} from 'lodash';
import Resizable from 'react-component-resizable';


import {flux} from '../Firefly.js';
import * as TablesCntlr from '../tables/TablesCntlr.js';
import * as TblUtil from '../tables/TableUtil.js';
import {SelectInfo} from '../tables/SelectInfo.js';
import {FilterInfo} from '../tables/FilterInfo.js';

import * as TableStatsCntlr from '../visualize/TableStatsCntlr.js';
import * as HistogramCntlr from '../visualize/HistogramCntlr.js';
import * as XYPlotCntlr from '../visualize/XYPlotCntlr.js';
import {dispatchChartExpanded, dispatchDelete, dispatchChartMounted, dispatchChartUnmounted} from '../visualize/ChartsCntlr.js';

import {LO_MODE, LO_VIEW, dispatchSetLayoutMode} from '../core/LayoutCntlr.js';

import {SCATTER, HISTOGRAM, getHighlighted, getTblIdForChartId, numRelatedCharts} from './ChartUtil.js';
import XYPlotOptions from '../visualize/XYPlotOptions.jsx';
import {XYPlot} from '../visualize/XYPlot.jsx';

import HistogramOptions from '../visualize/HistogramOptions.jsx';
import Histogram from '../visualize/Histogram.jsx';

import {PopupPanel} from '../ui/PopupPanel.jsx';
import DialogRootContainer from '../ui/DialogRootContainer.jsx';
import {dispatchShowDialog, dispatchHideDialog, isDialogVisible} from '../core/ComponentCntlr.js';

import {showInfoPopup} from '../ui/PopupUtil.jsx';

import DELETE from 'html/images/blue_delete_10x10.png';
import OUTLINE_EXPAND from 'html/images/icons-2014/24x24_ExpandArrowsWhiteOutline.png';
import SETTINGS from 'html/images/icons-2014/24x24_GearsNEW.png';
import ZOOM_IN from 'html/images/icons-2014/24x24_ZoomIn.png';
import ZOOM_ORIGINAL from 'html/images/icons-2014/Zoom1x-24x24-tmp.png';
import SELECT_ROWS from 'html/images/icons-2014/24x24_Checkmark.png';
import UNSELECT_ROWS from 'html/images/icons-2014/24x24_CheckmarkOff_Circle.png';
import FILTER_IN from 'html/images/icons-2014/24x24_FilterAdd.png';
import CLEAR_FILTERS from 'html/images/icons-2014/24x24_FilterOff_Circle.png';
import LOADING from 'html/images/gxt/loading.gif';


const OPTIONS_WIDTH = 330;

const selectionBtnStyle = {verticalAlign: 'top', paddingLeft: 20, cursor: 'pointer'};


class ChartsPanel extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            optionsShown: !props.chartId,
            immediateResize: false
        };

        const normal = (size) => {
            if (size && this.iAmMounted) {
                var widthPx = size.width;
                var heightPx = size.height;
                //console.log('width: '+widthPx+', height: '+heightPx);
                if (widthPx !== this.state.widthPx || heightPx != this.state.heightPx) {
                    this.setState({widthPx, heightPx, immediateResize: false});
                }
            }
        };
        const debounced = debounce(normal, 100);
        this.onResize =  (size) => {
            if ( this.state.immediateResize) {
                normal(size);
            } else if (this.state.widthPx === 0) {
                defer(normal, size);
            } else {
                debounced(size);
            }
        };

        this.renderXYPlot = this.renderXYPlot.bind(this);
        this.renderHistogram = this.renderHistogram.bind(this);
        this.toggleOptions = this.toggleOptions.bind(this);
        this.displaySelectionOptions = this.displaySelectionOptions.bind(this);
        this.displayZoomOriginal = this.displayZoomOriginal.bind(this);
        this.addSelection = this.addSelection.bind(this);
        this.resetSelection = this.resetSelection.bind(this);
        this.displayClearFilters = this.displayClearFilters.bind(this);
        this.addFilter = this.addFilter.bind(this);
        this.clearFilters = this.clearFilters.bind(this);
        this.selectionNotEmpty = this.selectionNotEmpty.bind(this);
        this.renderSelectionButtons = this.renderSelectionButtons.bind(this);
        this.renderToolbar = this.renderToolbar.bind(this);
        this.renderOptions = this.renderOptions.bind(this);
    }

    shouldComponentUpdate(nextProps, nextState) {
        let doUpdate = nextState !== this.state ||
            nextProps.chartId !== this.props.chartId ||
            nextProps.tblStatsData !== this.props.tblStatsData ||
            nextProps.expandedMode !== this.props.expandedMode ||
            nextProps.deletable !== this.props.deletable;
        if (!doUpdate) {
            const {chartType} = nextProps;
            if (chartType === SCATTER) {
                // scatter plot
                doUpdate =
                    nextProps.tblPlotData !== this.props.tblPlotData ||
                    (nextProps.tableModel &&
                    (nextProps.tableModel.highlightedRow !== get(this.props, 'tableModel.highlightedRow') ||
                     nextProps.tableModel.selectInfo !== get(this.props, 'tableModel.selectInfo') ));
            } else if (chartType === HISTOGRAM){
                // histogram
                doUpdate = nextProps.tblHistogramData !== this.props.tblHistogramData;
            }
        }
        return Boolean(doUpdate);
    }

    componentDidMount() {
        this.handlePopups();
        const {tblId, chartId, chartType} = this.props;
        dispatchChartMounted(tblId,chartId,chartType);
        this.iAmMounted = true;
    }

    componentDidUpdate() {
        this.handlePopups();
    }

    componentWillReceiveProps(nextProps) {
        const {tblId, chartId, chartType} = nextProps;
        if (!tblId || !chartId) { return; }
        if (chartId != this.props.chartId || chartType != this.props.chartType || !this.props.tblId) {
            dispatchChartUnmounted(this.props.tblId, this.props.chartId, this.props.chartType);
            dispatchChartMounted(tblId,chartId,chartType);
        }
    }

    componentWillUnmount() {
        this.iAmMounted = false;
        const {tblId, chartId, chartType} = this.props;
        dispatchChartUnmounted(tblId, chartId, chartType);
        if (isDialogVisible(popupId)) {
            hideChartOptionsPopup();
        }
    }

    handlePopups() {
        if (this.props.optionsPopup) {
            const {optionsShown} = this.state;
            if (optionsShown) {
                const {tableModel, tblStatsData, tblPlotData, tblHistogramData, chartId, chartType} = this.props;
                // show options popup
                let popupTitle = 'Chart Options';

                const reqTitle = get(tableModel, 'tableMeta.title');
                if (reqTitle) { popupTitle += `: ${chartId} ${reqTitle}`; }

                var popup = (
                    <PopupPanel title={popupTitle} closeCallback={()=>{this.toggleOptions();}}>
                        <div
                            style={{overflow:'auto',width:OPTIONS_WIDTH,height:300,paddingTop:10,paddingLeft:10,verticalAlign:'top'}}>
                            <OptionsWrapper {...{chartId, tableModel, tblStatsData, tblPlotData, tblHistogramData, chartType}}/>
                        </div>
                    </PopupPanel>
                );

                DialogRootContainer.defineDialog(popupId, popup);
                dispatchShowDialog(popupId);

            } else if (isDialogVisible(popupId)) {
                hideChartOptionsPopup();
            }
        } else if (isDialogVisible(popupId)) {
            hideChartOptionsPopup();
        }
    }

    // -------------
    // SCATTER PLOT
    // -------------

    renderXYPlot() {
        const {chartId, tblId, tableModel, tblPlotData} = this.props;
        if (!tblPlotData) {
            return null;
        }
        const { isPlotDataReady, xyPlotData, xyPlotParams } = tblPlotData;
        var {widthPx, heightPx} = this.state;

        const hRow = getHighlighted(xyPlotParams, tblId);
        const sInfo = tableModel && tableModel.selectInfo;

        if (isPlotDataReady) {
            if (!heightPx || !widthPx) { return (<div/>); }
            return (
                <XYPlot data={xyPlotData}
                        desc=''
                        width={widthPx}
                        height={heightPx}
                        params={xyPlotParams}
                        highlighted={hRow}
                        onHighlightChange={(highlightedRow) => {
                                    TablesCntlr.dispatchTableHighlight(tblId, highlightedRow);
                                }
                           }
                        selectInfo={sInfo}
                        onSelection={(selection) => {
                            if (this.selectionNotEmpty(selection)) {defer(XYPlotCntlr.dispatchSetSelection, chartId, selection);}
                        }}
                />
            );
        } else {
            if (xyPlotParams) {
                return 'Loading XY plot...';
            } else {
                return null;
            }
        }

    }

    // ----------
    // HISTOGRAM
    // ----------


    renderHistogram() {
        if (!this.props.tblHistogramData) {
            return 'Select Histogram Parameters...';
        }
        const { isColDataReady, histogramData, histogramParams } = this.props.tblHistogramData;
        var {widthPx, heightPx} = this.state;

        if (isColDataReady) {
            var logs, reversed;
            if (histogramParams) {
                var logvals = '';
                if (histogramParams.x.includes('log')) { logvals += 'x';}
                if (histogramParams.y.includes('log')) { logvals += 'y';}
                if (logvals.length>0) { logs = logvals;}

                var rvals = '';
                if (histogramParams.x.includes('flip')) { rvals += 'x';}
                if (histogramParams.y.includes('flip')) { rvals += 'y';}
                if (rvals.length>0) { reversed = rvals;}

            }

            if (!heightPx || !widthPx) { return (<div/>); }
            return (
                <Histogram data={histogramData}
                           desc={histogramParams.columnOrExpr}
                           binColor='#8c8c8c'
                           height={heightPx}
                           width={widthPx}
                           logs={logs}
                           reversed={reversed}
                />
            );
        } else {
            if (histogramParams) {
                return 'Loading Histogram...';
            } else {
                return 'Select Histogram Parameters';
            }
        }
    }

    // -----------------
    // COMMON RENDERING
    // -----------------

    toggleOptions() {
        const {optionsShown, immediateResize, optionsPopup} = this.state;
        this.setState({optionsShown: !optionsShown, immediateResize: optionsPopup?immediateResize:true});
    }

    displaySelectionOptions() {
        if (this.props.chartType === SCATTER) {
            const selection = get(this.props, 'tblPlotData.xyPlotParams.selection');
            return Boolean(selection);
        }
        // for now selection is supported for scatter only
        return false;
    }

    displayZoomOriginal() {
        if (this.props.chartType === SCATTER) {
            const zoom = get(this.props, 'tblPlotData.xyPlotParams.zoom');
            return Boolean(zoom);
        }
        // for now zoom is supported for scatter only
        return false;
    }

    addZoom() {
        if (this.props.chartType === SCATTER) {
            XYPlotCntlr.dispatchZoom(this.props.chartId, this.props.tblId, get(this.props, 'tblPlotData.xyPlotParams.selection'));
        }
    }

    resetZoom() {
        if (this.props.chartType === SCATTER) {
            XYPlotCntlr.dispatchZoom(this.props.chartId, this.props.tblId);
        }
    }

    displayUnselectAll  () {
        if (this.props.chartType === SCATTER) {
            const selectInfo = get(this.props, 'tableModel.selectInfo');
            return selectInfo && (selectInfo.selectAll || selectInfo.exceptions.size>0);
        }
    }

    addSelection() {
        if (this.props.chartType === SCATTER) {
            if (get(this.props, 'tblPlotData.xyPlotData.decimateKey')) {
                showInfoPopup('Your data set is too large to select. You must filter it down first.',
                                `Can't Select`); // eslint-disable-line quotes
            } else {
                const {tblId, tableModel} = this.props;
                const selection = get(this.props, 'tblPlotData.xyPlotParams.selection');
                const rows = get(this.props, 'tblPlotData.xyPlotData.rows');
                if (tableModel && rows && selection) {
                    const {xMin, xMax, yMin, yMax} = selection;
                    const selectInfoCls = SelectInfo.newInstance({rowCount: tableModel.totalRows});
                    // add all rows which fall into selection
                    const xIdx = 0, yIdx = 1, rowIdx = 2;
                    rows.forEach((arow) => {
                        const x = Number(arow[xIdx]);
                        const y = Number(arow[yIdx]);
                        if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
                            selectInfoCls.setRowSelect(Number(arow[rowIdx]), true);
                        }
                    });
                    const selectInfo = selectInfoCls.data;
                    TablesCntlr.dispatchTableSelect(tblId, selectInfo);
                }
            }
        }
    }

    resetSelection() {
        if (this.props.chartType === SCATTER) {
            const {tblId, tableModel} = this.props;
            if (tableModel) {
                const selectInfoCls = SelectInfo.newInstance({rowCount: tableModel.totalRows});
                TablesCntlr.dispatchTableSelect(tblId, selectInfoCls.data);
            }
        }
    }

    displayClearFilters() {
        const filterInfo = get(this.props, 'tableModel.request.filters');
        const filterCount = filterInfo ? filterInfo.split(';').length : 0;
        return (filterCount > 0);
    }

    addFilter() {
        if (this.props.chartType === SCATTER) {
            const {tblPlotData, tableModel} = this.props;
            const selection = get(tblPlotData, 'xyPlotParams.selection');
            const xCol = get(tblPlotData, 'xyPlotParams.x.columnOrExpr');
            const yCol = get(tblPlotData, 'xyPlotParams.y.columnOrExpr');
            if (selection && xCol && yCol) {
                const {xMin, xMax, yMin, yMax} = selection;
                const filterInfo = get(this.props, 'tableModel.request.filters');
                const filterInfoCls = FilterInfo.parse(filterInfo);
                filterInfoCls.setFilter(xCol, '> '+xMin);
                filterInfoCls.addFilter(xCol, '< '+xMax);
                filterInfoCls.setFilter(yCol, '> '+yMin);
                filterInfoCls.addFilter(yCol, '< '+yMax);
                const newRequest = Object.assign({}, tableModel.request, {filters: filterInfoCls.serialize()});
                TablesCntlr.dispatchTableFetch(newRequest);
            }
        }
    }

    clearFilters() {
        const request = get(this.props, 'tableModel.request');
        if (request && request.filters) {
            const newRequest = Object.assign({}, request, {filters: ''});
            TablesCntlr.dispatchTableFetch(newRequest);
        }
    }

    selectionNotEmpty(selection) {
        const rows = get(this.props, 'tblPlotData.xyPlotData.rows');
        if (rows) {
            if (selection) {
                const {xMin, xMax, yMin, yMax} = selection;
                const xIdx = 0, yIdx = 1;
                const aPt = rows.find((arow) => {
                    const x = Number(arow[xIdx]);
                    const y = Number(arow[yIdx]);
                    return (x >= xMin && x <= xMax && y >= yMin && y <= yMax);
                });
                return Boolean(aPt);
            } else {
                return true; // empty selection replacing non-empty
            }
        } else {
            return false;
        }

    }

    renderSelectionButtons() {
        if (this.displaySelectionOptions()) {
            return (
                <div style={{display:'inline-block', whiteSpace: 'nowrap'}}>
                    <img style={selectionBtnStyle}
                         title='Zoom in the enclosed points'
                         src={ZOOM_IN}
                         onClick={() => this.addZoom()}
                    />
                    {<img style={selectionBtnStyle}
                         title='Select enclosed points'
                         src={SELECT_ROWS}
                         onClick={() => this.addSelection()}
                    />}
                    <img style={selectionBtnStyle}
                         title='Filter in the selected points'
                         src={FILTER_IN}
                         onClick={() => this.addFilter()}
                    />
                </div>
            );
        } else {
            return (
                <div style={{display:'inline-block', whiteSpace: 'nowrap'}}>
                    {this.displayZoomOriginal() && <img style={selectionBtnStyle}
                         title='Zoom out to original chart'
                         src={ZOOM_ORIGINAL}
                         onClick={() => this.resetZoom()}
                    />}
                    {this.displayUnselectAll() && <img style={selectionBtnStyle}
                         title='Unselect all selected points'
                         src={UNSELECT_ROWS}
                         onClick={() => this.resetSelection()}
                    />}
                    {this.displayClearFilters() && <img style={selectionBtnStyle}
                        title='Remove all filters'
                        src={CLEAR_FILTERS}
                        onClick={() => this.clearFilters()}
                    />}
                </div>
            );
        }
    }

    renderToolbar() {
        const {expandable, expandedMode, tblId, chartId, chartType, optionsPopup, deletable} = this.props;
        return (
            <div style={{height: 30, position: 'absolute', top: 0, left: 0, right: 0}}>
                <img style={{verticalAlign:'top', float: 'left', cursor: 'pointer'}}
                     title='Plot options and tools'
                     src={SETTINGS}
                     onClick={() => this.toggleOptions()}
                />
                <div style={{display:'inline-block', float: 'right'}}>
                    {this.renderSelectionButtons()}
                    { expandable && !expandedMode &&
                    <img style={selectionBtnStyle}
                         title='Expand this panel to take up a larger area'
                         src={OUTLINE_EXPAND}
                         onClick={() => {
                            dispatchChartExpanded(chartId, tblId, chartType, optionsPopup);
                            dispatchSetLayoutMode(LO_MODE.expanded, LO_VIEW.xyPlots);
                         }}
                    />}
                    { expandable && !expandedMode &&
                    (isBoolean(deletable) ? deletable : numRelatedCharts(tblId) > 1) &&  // when deletable is undefined, use related charts criterion
                    <img style={{verticalAlign: 'top', paddingLeft: 2, paddingRight:5, cursor: 'pointer'}}
                         title='Delete this chart'
                         src={DELETE}
                         onClick={() => {dispatchDelete(tblId, chartId, chartType);}}
                    />}
                </div>
            </div>
        );
    }


    renderOptions() {
        const {optionsShown, heightPx} = this.state;
        const { tableModel, tblStatsData, tblPlotData, tblHistogramData, optionsPopup, chartId, chartType} = this.props;
        if (optionsShown && !optionsPopup) {
            return (
                <div style={{flex: '0 0 auto',overflow:'auto',width:OPTIONS_WIDTH,height:heightPx,paddingLeft:10,verticalAlign:'top'}}>
                    <OptionsWrapper  {...{chartId, tableModel, tblStatsData, tblPlotData, tblHistogramData, chartType}}/>
                </div>
            );
        }
        return false;
    }



    render() {
        var {tblStatsData, chartType} = this.props;

        if (!(tblStatsData && tblStatsData.isColStatsReady) ) {
            return (<img style={{verticalAlign:'top', height: 16, padding: 10, float: 'left'}}
                         title='Loading Table Statistics...'
                         src={LOADING}/>
            );
        } else {
            var {widthPx, heightPx} = this.state;
            const knownSize = widthPx && heightPx;

            if (chartType === SCATTER && !this.props.tblPlotData ||
                    chartType === HISTOGRAM && !this.props.tblHistogramData) {
                return null;
            }

            return (
                <div style={{ display: 'flex', flex: 'auto', flexDirection: 'column', height: '100%', overflow: 'hidden'}}>
                    <div style={{ position: 'relative', flexGrow: 1}}>
                        {this.renderToolbar()}
                        <div style={{display: 'flex', flexDirection: 'row', position: 'absolute', top: 30, bottom: 0, left: 0, right: 0}}>
                            {this.renderOptions()}
                            <Resizable id='chart-resizer' onResize={this.onResize} style={{flexGrow: 1, position: 'relative', width: '100%', height: '100%', overflow: 'hidden'}}>
                                <div style={{overflow:'auto',width:widthPx,height:heightPx}}>
                                    {knownSize ? chartType === SCATTER ? this.renderXYPlot() : this.renderHistogram() : <div/>}
                                </div>
                            </Resizable>
                        </div>
                    </div>
                </div>
            );
        }
    }
}

ChartsPanel.propTypes = {
    expandedMode: PropTypes.bool,
    optionsPopup: PropTypes.bool,
    expandable: PropTypes.bool,
    deletable : PropTypes.bool,
    tblId : PropTypes.string,
    tableModel : PropTypes.object,
    tblStatsData : PropTypes.object,
    chartId: PropTypes.string,
    chartType: PropTypes.oneOf(['scatter', 'histogram']),
    tblPlotData : PropTypes.object,
    tblHistogramData : PropTypes.object,
    width : PropTypes.string,
    height : PropTypes.string
};

ChartsPanel.defaultProps = {
    expandedMode: false,
    expandable: true
};



export class ChartsTableViewPanel extends Component {

    constructor(props) {
        super(props);
        this.state = this.getNextState();
    }

    shouldComponentUpdate(np, ns) {
        return sCompare(this, np, ns);
    }

    // componentDidUpdate(prevProps, prevState) {
    //     deepDiff({props: prevProps, state: prevState},
    //         {props: this.props, state: this.state},
    //         this.constructor.name);
    // }

    componentDidMount() {
        this.removeListener = flux.addListener(() => this.storeUpdate());
        this.iAmMounted = true;
    }

    componentWillUnmount() {
        this.iAmMounted=false;
        this.removeListener && this.removeListener();
    }

    getNextState() {
        var {tblId, chartId, deletable} = this.props;
        tblId = tblId || chartId ? getTblIdForChartId(chartId) : TblUtil.getActiveTableId();
        chartId = this.props.chartId || tblId;
        const tableModel = TblUtil.getTblById(tblId);
        const tblStatsData = flux.getState()[TableStatsCntlr.TBLSTATS_DATA_KEY][tblId];
        const tblHistogramData = chartId ? flux.getState()[HistogramCntlr.HISTOGRAM_DATA_KEY][chartId] : undefined;
        const tblPlotData = chartId ? flux.getState()[XYPlotCntlr.XYPLOT_DATA_KEY][chartId] : undefined;
        deletable = isBoolean(deletable) ? deletable : numRelatedCharts(tblId) > 1;
        return {chartId, tblId, tableModel, tblStatsData, tblHistogramData, tblPlotData, deletable};
    }

    storeUpdate() {
        if (this.iAmMounted) {
            this.setState(this.getNextState());
        }
    }

    render() {
        const {chartId, tblId, tableModel, tblStatsData, tblHistogramData, tblPlotData} = this.state;
        return tblId ? (
            <ChartsPanel {...this.props} {...{chartId, tblId, tableModel, tblStatsData, tblHistogramData, tblPlotData}}/>
        ) : (<div/>);
    }
}

ChartsTableViewPanel.propTypes = {
    tblId: PropTypes.string, // if not present, active table id is used
    chartId: PropTypes.string, // if not present table id is used as a chart id
    deletable: PropTypes.bool // should the chart be deletable?
};

export class OptionsWrapper extends React.Component {
    constructor(props) {
        super(props);
    }

    shouldComponentUpdate(nProps) {
        return nProps.chartId != this.props.chartId ||
        get(nProps, 'tblPlotData.xyPlotParams') !== get(this.props, 'tblPlotData.xyPlotParams') ||
        get(nProps, 'tblHistogramData.histogramParams') !== get(this.props, 'tblHistogramData.histogramParams') ||
        get(nProps, 'tableModel.tbl_id') !== get(this.props, 'tableModel.tbl_id') ||
            get(nProps, 'tblStatsData.isColStatsReady') !== get(this.props, 'tblStatsData.isColStatsReady') ||
            nProps.chartType != this.props.chartType;
    }

    // componentDidUpdate(prevProps, prevState) {
    //     deepDiff({props: prevProps, state: prevState},
    //         {props: this.props, state: this.state},
    //         this.constructor.name);
    // }

    render() {
        const { chartId, tableModel, tblStatsData, chartType, tblPlotData, tblHistogramData} = this.props;

        if (get(tblStatsData,'isColStatsReady')) {
            const formName = 'ChartOpt_' + chartType + chartId;
            if (chartType === SCATTER) {
                return (
                    <XYPlotOptions key={formName} groupKey={formName}
                                   colValStats={tblStatsData.colStats}
                                   xyPlotParams={get(tblPlotData, 'xyPlotParams')}
                                   onOptionsSelected={(xyPlotParams) => {
                                                XYPlotCntlr.dispatchLoadPlotData(chartId, xyPlotParams, tableModel.tbl_id);
                                            }
                                          }/>
                );
            } else {
                return (
                    <HistogramOptions key={formName} groupKey = {formName}
                                      colValStats={tblStatsData.colStats}
                                      histogramParams={get(tblHistogramData, 'histogramParams')}
                                      onOptionsSelected={(histogramParams) => {
                                                HistogramCntlr.dispatchLoadColData(chartId, histogramParams, tableModel.tbl_id);
                                            }
                                          }/>
                );
            }
        } else {
            return (<img style={{verticalAlign:'top', height: 16, padding: 10, float: 'left'}}
                         title='Loading Options...'
                         src={LOADING}
             />);
        }
    }
}

OptionsWrapper.propTypes = {
    chartId : PropTypes.string,
    tableModel : PropTypes.object,
    tblStatsData : PropTypes.object,
    tblPlotData : PropTypes.object,
    tblHistogramData: PropTypes.object,
    chartType: PropTypes.string
};



const popupId = 'chartOptions';

function hideChartOptionsPopup() {
    dispatchHideDialog(popupId);
}
