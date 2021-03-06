/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import numeral from 'numeral';

import {ValidationField} from '../../ui/ValidationField.jsx';
import {ListBoxInputField} from '../../ui/ListBoxInputField.jsx';
import {CheckboxGroupInputField} from '../../ui/CheckboxGroupInputField.jsx';
import {callGetColorHistogram, callGetBeta} from '../../rpc/PlotServicesJson.js';
import {dispatchValueChange} from '../../fieldGroup/FieldGroupCntlr.js';
import {encodeServerUrl} from '../../util/WebUtil.js';
import {formatFlux} from '../VisUtil.js';
import {getRootURL} from '../../util/BrowserUtil.js';

import {
    PERCENTAGE,  ABSOLUTE,SIGMA,
    STRETCH_LINEAR, STRETCH_LOG, STRETCH_LOGLOG, STRETCH_EQUAL,
    STRETCH_SQUARED, STRETCH_SQRT, STRETCH_ASINH, STRETCH_POWERLAW_GAMMA} from '../RangeValues.js';




const LABEL_WIDTH= 105;
const HIST_WIDTH= 340;
const HIST_HEIGHT= 55;
const cbarImStyle= {width:'100%', height:10, padding: '0 2px 0 2px', boxSizing:'border-box' };

const histImStyle= {
    width:HIST_WIDTH, 
    height:HIST_HEIGHT,
    margin: '2px auto 3px auto',
    boxSizing:'border-box',
    border:'1px solid black',
    display: 'block'
};


const maskWrapper= {
    position:'absolute',
    left:0,
    top:0,
    width:'100%',
    height:'100%'
};



const textPadding= {paddingBottom:3};

export class ColorBandPanel extends PureComponent {

    constructor(props) {
        super(props);
        this.state={exit:true, retrievedBetaValue:NaN};
        this.handleReadout= this.handleReadout.bind(this);
        this.mouseMove= this.mouseMove.bind(this);
        this.mouseLeave= this.mouseLeave.bind(this);
    }


    componentWillReceiveProps(nextProps) {
        const {plot:nPlot, fields:nFields}= nextProps;
        let {retrievedBetaValue}= this.state;
        const {plot}= this.props;
        if (nPlot.plotId!==plot.plotId || nPlot.plotState!==plot.plotState) {
            this.initImages(nPlot,nextProps.band);
            retrievedBetaValue= NaN;
            this.setState(() => ({retrievedBetaValue}));
        }
        if (isNaN(retrievedBetaValue) && nFields.algorithm.value===STRETCH_ASINH) {
            this.retrieveBeta(nPlot,nextProps.band);
        }
        
    }

    componentWillMount() {
        const {plot,band}= this.props;
        this.initImages(plot,band);
    }


    retrieveBeta(plot,band) {
        if (this.state.doMask) return;
        this.setState(() => ({doMask:true}));
        callGetBeta(plot.plotState)
            .then( (betaAry) => {
                const beta= !isNaN(betaAry[band.value]) ? betaAry[band.value].toFixed(2) : betaAry[band.value];
                this.setState(() => ({doMask:false, retrievedBetaValue:beta}));
                if (isNaN(this.props.fields.beta.value)) {
                    dispatchValueChange({fieldKey:'beta', groupKey:this.props.groupKey, value:beta,valid:true } );
                }
            });
    }

    initImages(plot,band) {
        callGetColorHistogram(plot.plotState,band,HIST_WIDTH,HIST_HEIGHT)
            .then(  (result) => {
                const dataHistUrl= encodeServerUrl(getRootURL() + 'sticky/FireFly_ImageDownload',
                    { file: result.DataHistImageUrl, type: 'any' });

                const cbarUrl= encodeServerUrl(getRootURL() + 'sticky/FireFly_ImageDownload',
                    { file: result.CBarImageUrl, type: 'any' });
                const dataHistogram= result.DataHistogram;
                const dataBinMeanArray= result.DataBinMeanArray;
                this.setState({dataHistUrl,cbarUrl,dataHistogram,dataBinMeanArray});
            });
    }

    mouseMove(ev) {
        const {offsetX:x}= ev;
        const {dataHistogram,dataBinMeanArray}= this.state;
        var idx= Math.trunc((x *(dataHistogram.length/HIST_WIDTH)));
        const histValue= dataHistogram[idx];
        const histMean= dataBinMeanArray[idx];
        this.setState({histIdx:idx,histValue,histMean,exit:false});

    }
    mouseLeave() { this.setState({exit:true}); }

    handleReadout(c) {
        if (!c) return;
        c.removeEventListener('mousemove', this.mouseMove);
        c.removeEventListener('mouseleave', this.mouseLeave);
        c.addEventListener('mousemove', this.mouseMove);
        c.addEventListener('mouseleave', this.mouseLeave);
    }

    render() {
        var {fields,plot,band}=this.props;
        const {dataHistUrl,cbarUrl, histIdx, histValue,histMean,exit, doMask, retrievedBetaValue}=  this.state;



        var panel;
        var showBeta=false;
        if (fields) {
            const {algorithm, zscale}=fields;
            var a= Number.parseInt(algorithm.value);
            if (a===STRETCH_ASINH) {
                panel= renderAsinH(fields);
                showBeta=true;
            }
            else if (a===STRETCH_POWERLAW_GAMMA) {
                panel= renderGamma(fields);
            }
            else if (zscale.value==='zscale') {
                panel= renderZscale();
            }
            else {
                panel= renderStandard();
            }
        }
        else {
            panel= renderStandard();
        }


        return (
                <div style={{minHeight:305, minWidth:360, padding:5, position:'relative'}}>
                    <img style={histImStyle} src={dataHistUrl} key={dataHistUrl} ref={this.handleReadout}/>
                    <ReadoutPanel 
                        width={HIST_WIDTH}
                        exit={exit}
                        idx={histIdx}
                        histValue={histValue}
                        histMean={histMean}
                        plot={plot}
                        band={band}
                    />
                    <div style={{display:'table', margin:'auto auto'}}>
                        {getStretchTypeField()}
                    </div>

                    {panel}
                    <div>
                        {suggestedValuesPanel( plot,band, showBeta && !isNaN(retrievedBetaValue), retrievedBetaValue)}
                    </div>
                    <div style={{position:'absolute', bottom:5, left:5, right:5}}>
                        <div style={{display:'table', margin:'auto auto', paddingBottom:5}}>
                            <CheckboxGroupInputField
                                options={ [ {label: 'Use ZScale for bounds', value: 'zscale'} ] }
                                fieldKey='zscale'
                                labelWidth={0} />
                        </div>
                        <img style={cbarImStyle} src={cbarUrl} key={cbarUrl}/>
                    </div>
                    {doMask && <div style={maskWrapper}> <div className='loading-mask'/> </div> }
                </div>
            );
    }
}

ColorBandPanel.propTypes= {
    groupKey : PropTypes.string.isRequired,
    band : PropTypes.object.isRequired,
    plot : PropTypes.object.isRequired,
    fields : PropTypes.object.isRequired
};



const readTopBaseStyle= { fontSize: '11px', paddingBottom:5, height:16 };
const dataStyle= { color: 'red' };

function suggestedValuesPanel( plot,band, showBeta, betaValue) {

    const precision6Digit = '0.000000';
   // const precision2Digit = '0.00';
    const style= { fontSize: '11px', paddingBottom:5, height:16, marginTop:50,  whiteSpace: 'pre'};

    const  fitsData= plot.webFitsData[band.value];
    const {dataMin, dataMax, beta} = fitsData;
    const dataMaxStr = `DataMax: ${numeral(dataMax).format(precision6Digit)} `;
    const dataMinStr = `DataMin: ${numeral(dataMin).format(precision6Digit)}`;
    const betaStr =  `Beta: ${numeral(betaValue).format(precision6Digit)}`;

    if (showBeta) {
       return (

           <div style={style}>
                <span style={{float:'left', paddingRight:2, opacity:.5 , marginLeft:30}}>
                    {dataMinStr}   {dataMaxStr}   {betaStr}
                </span>
           </div>
       );
    }
    else {
      return (
        <div style={style}>
                <span style={{float:'left', paddingRight:2, opacity:.5, marginLeft:40 }}>
                  {dataMinStr}            {dataMaxStr}
                </span>
        </div>
       );
    }
}

function ReadoutPanel({exit, plot,band,idx,histValue,histMean,width}) {
    var topStyle= Object.assign({width},readTopBaseStyle);
    if (exit) {
        return (
            <div style={topStyle}>
                <span style={{float:'right', paddingRight:2, opacity:.4, textAlign: 'center' }}>
                Move mouse over graph to see values
                </span>
            </div>
        );
    }
    else {
        return (
            <div style={topStyle}> Histogram: index:
                <span style={dataStyle}>{idx}</span>, Size:
                <span style={dataStyle}>{histValue}</span>, Mean Value :
                <span style={dataStyle}> {formatFlux(histMean, plot, band)} </span>
            </div>
        );
    }
}

ReadoutPanel.propTypes= {
    exit : PropTypes.bool,
    band : PropTypes.object,
    plot : PropTypes.object,
    idx : PropTypes.number,
    histValue :PropTypes.number,
    histMean :PropTypes.number,
    width :PropTypes.number
};





//===============================================================================
//===============================================================================
//================ Helpers
//===============================================================================
//===============================================================================



function getTypeMinField() {
    return (
        <ListBoxInputField fieldKey={'lowerWhich'} inline={true} labelWidth={0}
                           options={ [ {label: '%', value: PERCENTAGE},
                                       {label: 'Data', value: ABSOLUTE},
                                       {label: 'Sigma', value: SIGMA}
                                       ]}
                           multiple={false}
        />
    );
}

function getTypeMaxField() {
    return (
        <ListBoxInputField fieldKey='upperWhich' inline={true} labelWidth={0}
                           options={ [ {label: '%', value: PERCENTAGE},
                                       {label: 'Data', value: ABSOLUTE},
                                       {label: 'Sigma', value: SIGMA}
                                                  ]}
                           multiple={false}
        />
    );
}

function renderZscale() {
    return (
        <div>
            <ValidationField wrapperStyle={textPadding} labelWidth={LABEL_WIDTH} fieldKey='zscaleContrast' />
            <ValidationField wrapperStyle={textPadding} labelWidth={LABEL_WIDTH} fieldKey='zscaleSamples' />
            <ValidationField wrapperStyle={textPadding} labelWidth={LABEL_WIDTH} fieldKey='zscaleSamplesPerLine' />
        </div>
    );
}

function renderStandard() { return  getUpperAndLowerFields(); }

function getUpperAndLowerFields() {
    return (
        <div>
            <div style={{ whiteSpace:'no-wrap'}}>
                <ValidationField wrapperStyle={textPadding} inline={true}
                                 labelWidth={LABEL_WIDTH}
                                 fieldKey='lowerRange'
                />
                {getTypeMinField()}
            </div>
            <div style={{ whiteSpace:'no-wrap'}}>
                <ValidationField  wrapperStyle={textPadding} labelWidth={LABEL_WIDTH}
                                  inline={true}
                                  fieldKey='upperRange'
                />
                {getTypeMaxField()}
            </div>
        </div>
    );
}

function getStretchTypeField() {
    return (
        <div style={{paddingBottom:12}}>
            <ListBoxInputField fieldKey='algorithm' inline={true} labelWidth={67}
                               options={ [
                                    {label: 'Linear',                 value: STRETCH_LINEAR},
                                    {label: 'Log',                    value: STRETCH_LOG},
                                    {label: 'Log-Log',                value: STRETCH_LOGLOG},
                                    {label: 'Histogram Equalization', value: STRETCH_EQUAL},
                                    {label: 'Squared',                value: STRETCH_SQUARED },
                                    {label: 'Sqrt',                   value: STRETCH_SQRT},
                                    {label: 'Asinh',                  value: STRETCH_ASINH},
                                    {label: 'Power Law Gamma',        value: STRETCH_POWERLAW_GAMMA}
                                 ]}
            />
        </div>
    );
}

function renderGamma(fields) {
    var {zscale}= fields;
    var range= (zscale.value==='zscale') ? renderZscale() : getUpperAndLowerFields();
    return (
        <div>
            {range}
            <div style={{paddingTop:10}}/>
            <ValidationField wrapperStyle={textPadding}  labelWidth={LABEL_WIDTH} fieldKey='gamma' />
        </div>
    );
}

function renderAsinH(fields) {
    var {zscale}= fields;
    var range= (zscale.value==='zscale') ? renderZscale() : getUpperAndLowerFields();
    return (
        <div>
            {range}
            <div style={{paddingTop:10}}/>
            <ValidationField  wrapperStyle={textPadding} labelWidth={LABEL_WIDTH} fieldKey='beta' />
        </div>
    );
}


