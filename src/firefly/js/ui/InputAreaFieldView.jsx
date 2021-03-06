import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import {PointerPopup} from '../ui/PointerPopup.jsx';
import {InputFieldLabel} from './InputFieldLabel.jsx';
import DialogRootContainer from './DialogRootContainer.jsx';
import './InputAreaFieldView.css';
import EXCLAMATION from 'html/images/exclamation16x16.gif';




function computeStyle(valid,hasFocus) {
    if (!valid) {
        return 'ff-inputfield-view-error';
    }
    else {
        return hasFocus ? 'ff-inputfield-view-focus' : 'ff-inputfield-view-valid';
    }
}


function makeMessage(message) {
    return (
        <div>
            <img src={EXCLAMATION} style={{display:'inline-block', paddingRight:5}}/>
            <div style={{display:'inline-block'}}> {message} </div>
        </div>
    );
}

const makeInfoPopup = (mess,x,y) => <PointerPopup x={x} y={y} message={makeMessage(mess)}/>;


function computeWarningXY(warnIcon) {
    var bodyRect = document.body.getBoundingClientRect();
    var elemRect = warnIcon.getBoundingClientRect();
    var warningOffsetX = (elemRect.left - bodyRect.left) + warnIcon.offsetWidth / 2;
    var warningOffsetY = elemRect.top - bodyRect.top;
    return {warningOffsetX, warningOffsetY};
}

const ICON_SPACE_STYLE= {
    verticalAlign: 'middle',
    paddingLeft: 3,
    width: 16,
    height: 16,
    display:'inline-block'};


export class InputAreaFieldView extends PureComponent {
    constructor(props) {
        super(props);
        this.warnIcon = null;
        this.state = { hasFocus: false, infoPopup: false };
    }

    componentDidUpdate() {
        var {infoPopup}= this.state;
        if (infoPopup) {
            var {warningOffsetX, warningOffsetY}= computeWarningXY(this.warnIcon);
            var {message}= this.props;
            this.hider = DialogRootContainer.showTmpPopup(makeInfoPopup(message, warningOffsetX, warningOffsetY));
        }
        else {
            if (this.hider) {
                this.hider();
                this.hider = null;
            }
        }
    }

    makeWarningArea(warn) {
        if (warn) {
            return (
                <div style={ICON_SPACE_STYLE}
                     onMouseOver={() => this.setState({infoPopup:true})}
                     onMouseLeave={() => this.setState({infoPopup:false})}>
                    <img src={EXCLAMATION} ref={(c) => this.warnIcon= c}/>
                </div>
            );
        }
        else {
            return <div style={ICON_SPACE_STYLE}/>;
        }
    }

    render() {
        var {hasFocus}= this.state;
        var {visible,label,tooltip,rows,cols,labelWidth,value,style,wrapperStyle,labelStyle,
             valid,size,onChange, onBlur, onKeyPress, showWarning, message, type}= this.props;
        if (!visible) return null;
        wrapperStyle = Object.assign({whiteSpace:'nowrap', display: this.props.inline?'inline-block':'block'}, wrapperStyle);
        return (
            <div style={wrapperStyle}>
                {label && <InputFieldLabel labelStyle={labelStyle} label={label} tooltip={tooltip} labelWidth={labelWidth}/> }
                <textarea style={Object.assign({display:'inline-block', backgroundColor: 'white'}, style)}
                          rows={rows}
                          cols={cols}
                          className={computeStyle(valid,hasFocus)}
                       onChange={(ev) => onChange ? onChange(ev) : null}
                       onFocus={ () => !hasFocus ? this.setState({hasFocus:true, infoPopup:false}) : ''}
                       onBlur={ (ev) => {
                                onBlur && onBlur(ev);
                                this.setState({hasFocus:false, infoPopup:false});
                            }}
                       onKeyPress={(ev) => onKeyPress && onKeyPress(ev)}
                       value={type==='file' ? undefined : value}
                       title={ (!showWarning && !valid) ? message : tooltip}
                       size={size}
                       type={type}
                />
                {showWarning && this.makeWarningArea(!valid)}
            </div>
        );
    }
}

InputAreaFieldView.propTypes= {
    valid   : PropTypes.bool,
    visible : PropTypes.bool,
    message : PropTypes.string,
    tooltip : PropTypes.string,
    label : PropTypes.string,
    inline : PropTypes.bool,
    labelWidth: PropTypes.number,
    style: PropTypes.object,
    labelStyle: PropTypes.object,
    wrapperStyle: PropTypes.object,
    value   : PropTypes.string.isRequired,
    size : PropTypes.number,
    onChange : PropTypes.func.isRequired,
    onBlur : PropTypes.func,
    onKeyPress : PropTypes.func,
    showWarning : PropTypes.bool,
    type: PropTypes.string,
    rows: PropTypes.number,
    cols: PropTypes.number
};

InputAreaFieldView.defaultProps= {
    showWarning : true,
    valid : true,
    visible : true,
    message: '',
    type: 'text',
    rows:10,
    cols:50
};

