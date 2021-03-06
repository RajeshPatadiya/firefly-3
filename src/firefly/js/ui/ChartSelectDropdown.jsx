/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React, {Component, PureComponent} from 'react';
import PropTypes from 'prop-types';
import {get} from 'lodash';
import {flux} from '../Firefly.js';
import * as TblUtil from '../tables/TableUtil.js';
import * as TableStatsCntlr from '../charts/TableStatsCntlr.js';
import * as ChartsCntlr from '../charts/ChartsCntlr.js';
import {uniqueChartId, multitraceDesign, singleTraceUI, getNumericCols} from '../charts/ChartUtil.js';
import {DT_XYCOLS} from '../charts/dataTypes/XYColsCDT.js';
import {XYPlotOptions, resultsSuccess as onXYPlotOptsSelected,
                       setOptions as XYPlotSetOptions} from '../charts/ui/XYPlotOptions.jsx';
import {DT_HISTOGRAM} from '../charts/dataTypes/HistogramCDT.js';
import {HistogramOptions, resultsSuccess as onHistogramOptsSelected,
                          setOptions as HistogramSetOptions} from '../charts/ui/HistogramOptions.jsx';
import {ChartSelectPanel, CHART_ADDNEW} from './../charts/ui/ChartSelectPanel.jsx';
import {getActiveViewerItemId} from '../charts/ui/MultiChartViewer.jsx';
import {DEFAULT_PLOT2D_VIEWER_ID} from '../visualize/MultiViewCntlr.js';

import {FormPanel} from './FormPanel.jsx';
import CompleteButton from './CompleteButton.jsx';
import {dispatchHideDropDown} from '../core/LayoutCntlr.js';
import FieldGroupUtils from '../fieldGroup/FieldGroupUtils';
import {isEmpty} from 'lodash';

import LOADING from 'html/images/gxt/loading.gif';

const dropdownName = 'ChartSelectDropDownCmd';

export const SCATTER = 'scatter';
export const HISTOGRAM = 'histogram';
const PREF_CHART_TYPE = 'pref.chartType';

export function getFormName(chartType) {
    return chartType+'ChartOpts';
}
/**
 *
 * @param props
 * @return {XML}
 * @constructor
 */
class ChartSelect extends PureComponent {
    constructor(props) {
        super(props);

        this.state = {
            chartType: localStorage.getItem(PREF_CHART_TYPE) || SCATTER
        };

        this.onChartTypeChange = this.onChartTypeChange.bind(this);
    }

    onChartTypeChange(ev) {
        // the value of the group is the value of the selected option
        var val = ev.target.value;
        var checked = ev.target.checked;

        if (checked) {
            if (val !== this.state.chartType) {
                localStorage.setItem(PREF_CHART_TYPE, val);
                this.setState({chartType : val});
            }
        }
    }

    renderChartSelection() {
        const {chartType} = this.state;
        const fieldKey = 'chartType';
        return (
            <div style={{display:'block', whiteSpace: 'nowrap', paddingBottom: 10}}>
                <input type='radio'
                       name={fieldKey}
                       value={SCATTER}
                       defaultChecked={chartType===SCATTER}
                       onChange={this.onChartTypeChange}
                /><span style={{paddingLeft: 3, paddingRight: 8}}>Scatter Plot</span>
                <input type='radio'
                       name={fieldKey}
                       value={HISTOGRAM}
                       defaultChecked={chartType===HISTOGRAM}
                       onChange={this.onChartTypeChange}
                /><span style={{paddingLeft: 3, paddingRight: 8}}>Histogram</span>
            </div>
        );
    }

    render() {
        const {tblId, tblStatsData} = this.props;
        const {chartType} = this.state;
        const formName = getFormName(chartType);

        const resultSuccess = (flds) => {
            //const chartId = uniqueChartId(chartType);
            const chartId = uniqueChartId(chartType); // before chart container is available we support one chart per table
            let onOptionsSelected = undefined;
            let type = undefined;
            switch (chartType) {
                case SCATTER:
                    onOptionsSelected = onXYPlotOptsSelected;
                    type = DT_XYCOLS;
                    break;
                case HISTOGRAM:
                    onOptionsSelected = onHistogramOptsSelected;
                    type = DT_HISTOGRAM;
                    break;
            }
            if (onOptionsSelected) {
                onOptionsSelected((options) => {
                    ChartsCntlr.dispatchChartAdd({chartId, chartType, groupId: tblId, deletable: true,
                        chartDataElements: [{type, options, tblId}]});
                }, flds, tblId);
            }
            hideSearchPanel();
        };

        return (
            <div style={{padding:10, overflow:'auto', maxWidth:600, maxHeight:600}}>
                <FormPanel
                    submitText='OK'
                    groupKey={formName}
                    onSubmit={resultSuccess}
                    onCancel={hideSearchPanel}>
                    {this.renderChartSelection()}
                    <OptionsWrapper  {...{tblStatsData, chartType}}/>
                </FormPanel>

            </div>);
    }
}

ChartSelect.propTypes = {
    tblId: PropTypes.string,
    tblStatsData : PropTypes.object
};


function hideSearchPanel() {
    dispatchHideDropDown();
}

export class OptionsWrapper extends Component {
    constructor(props) {
        super(props);
    }

    render() {
        const {tblStatsData, chartType} = this.props;

        if (get(tblStatsData,'isColStatsReady')) {
            const formName = getFormName(chartType);
            if (chartType === SCATTER) {
                return (
                    <XYPlotOptions key={formName} groupKey={formName}
                                   colValStats={tblStatsData.colStats}/>
                );
            } else {
                return (
                    <HistogramOptions key={formName} groupKey = {formName}
                                      colValStats={tblStatsData.colStats}/>
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
    tblStatsData : PropTypes.object,
    chartType: PropTypes.string
};


export class ChartSelectDropdown extends PureComponent {

    constructor(props) {
        super(props);
        this.state = this.getNextState();
    }

    componentDidMount() {


        const tblId = TblUtil.getActiveTableId(this.props.tblGroup);
        const tblStatsData = tblId && flux.getState()[TableStatsCntlr.TBLSTATS_DATA_KEY][tblId];
        const table= TblUtil.getTblById(tblId);
        if (!tblStatsData && table) {
            TableStatsCntlr.dispatchLoadTblStats(table['request']);
        }



        this.removeListener = flux.addListener(() => this.storeUpdate());
        this.iAmMounted= true;
    }

    componentWillUnmount() {
        this.iAmMounted= false;
        this.removeListener && this.removeListener();
    }

    getNextState() {
        const tblId = TblUtil.getActiveTableId(this.props.tblGroup);
        const tblStatsData = tblId && flux.getState()[TableStatsCntlr.TBLSTATS_DATA_KEY][tblId];
        return {tblId, tblStatsData};
    }

    storeUpdate() {
        if (this.iAmMounted) {
            const {tblId, tblStatsData} = this.getNextState();
            if (tblId !== this.state.tblId || tblStatsData !== this.state.tblStatsData) {
                this.setState(this.getNextState());
            }
        }
    }

    render() {
        const {tblId, tblStatsData} = this.state;
        const showMultiTrace = !singleTraceUI();

        let noChartReason='';
        if (tblId) {
            const {tableData, totalRows}= TblUtil.getTblById(tblId);
            if (!totalRows) {
                noChartReason = 'empty table';
            } else if (getNumericCols(tableData.columns).length < 1) {
                noChartReason = 'the table has no numeric columns';
            }
        } else {
            noChartReason = 'no active table';
        }

        if (!noChartReason) {
            return multitraceDesign() ?
                (<ChartSelectPanel {...{
                    tbl_id: tblId,
                    chartId: getActiveViewerItemId(DEFAULT_PLOT2D_VIEWER_ID),
                    chartAction: CHART_ADDNEW,
                    showMultiTrace,
                    hideDialog: ()=>dispatchHideDropDown()}}/> ) :
                (<ChartSelect {...{tblId, tblStatsData}} {...this.props}/>);
        } else {
            const msg = `Charts are not available: ${noChartReason}.`;
            return (
                <div>
                    <div style={{padding:20, fontSize:'150%'}}>{msg}</div>
                    <CompleteButton style={{paddingLeft: 20, paddingBottom: 20}}
                                    onSuccess={hideSearchPanel}
                                    text = {'OK'}
                    />
                </div>
            );
        }
    }
}

ChartSelectDropdown.propTypes = {
    tblGroup: PropTypes.string, // if not present, default table group is used
    name: PropTypes.oneOf([dropdownName])
};


ChartSelectDropdown.defaultProps = {
    name: dropdownName
};


/**
 * @summary reset chart column select dropdown value if the relevant field group exists
 */
export function resetChartSelectOptions() {
    const chartHandler = {
        [SCATTER]: XYPlotSetOptions,
        [HISTOGRAM]: HistogramSetOptions
    };

    Object.keys(chartHandler).forEach((chartType) => {
        const formGroupName = getFormName(chartType);

        if (!isEmpty(FieldGroupUtils.getGroupFields(formGroupName))) {
            chartHandler[chartType](formGroupName);
        }
    });
}
