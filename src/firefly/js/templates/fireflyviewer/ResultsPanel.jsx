/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import {pick, filter} from 'lodash';

import DockLayoutPanel from '../../ui/panel/DockLayoutPanel.jsx';
import {LO_VIEW} from '../../core/LayoutCntlr.js';

const wrapperStyle = { flex: 'auto', display: 'flex', flexFlow: 'column', overflow: 'hidden'};
const eastWest = {east: {index: 0,  defaultSize: '50%'}, west: {index: 1} };
const northSouth = {north: {index: 0,  defaultSize: '50%'}, south: {index: 1} };
const triView = {east: {index: 0, defaultSize: '50%'}, west: {index: 1}, south: {index: 2, defaultSize: 'calc(100% - 300px)'}};
const singleView = {center: {index: 0,  defaultSize: '100%',  resize: false}};


export class ResultsPanel extends PureComponent {

    constructor(props) {
        super(props);
    }

    render() {
        var {expanded=LO_VIEW.none} = this.props;
        expanded = LO_VIEW.get(expanded);
        const expandedProps = pick(this.props, ['expanded','imagePlot','xyPlot','tables'] );
        return (
            expanded === LO_VIEW.none
                ? <StandardView key='res-std-view' {...this.props} />
                : <ExpandedView key='res-exp-view' {...expandedProps} />
        );
    }
}

ResultsPanel.propTypes = {
    visToolbar: PropTypes.element,
    searchDesc: PropTypes.element,
    title: PropTypes.string,
    expanded: PropTypes.oneOfType([
                PropTypes.string,
                PropTypes.object]),
    standard: PropTypes.oneOfType([
                PropTypes.string,
                PropTypes.object]),
    imagePlot: PropTypes.element,
    xyPlot: PropTypes.element,
    tables: PropTypes.element
};


const ExpandedView = ({expanded, imagePlot, xyPlot, tables}) => {
    const view = expanded === LO_VIEW.tables ? tables
                : expanded === LO_VIEW.xyPlots ? xyPlot
                : imagePlot;
    return (
        <div style={wrapperStyle}>
            {view}
        </div>
    );
};


const StandardView = ({visToolbar, title, searchDesc, standard, imagePlot, xyPlot, tables}) => {
    standard = LO_VIEW.get(standard) || LO_VIEW.none;
    const components = resolveComponents(standard, imagePlot, xyPlot, tables);
    const config = generateLayout(standard, components);

    return (
        <div style={wrapperStyle}>
            {visToolbar}
            {searchDesc}
            {title && <h2 style={{textAlign: 'center'}}>{title}</h2>}
            <DockLayoutPanel key={standard} config={ config } >
                {components}
            </DockLayoutPanel>
        </div>
    );
};

function generateLayout(standard, results) {

    if ( results.length === 3 ) {
        if (standard == LO_VIEW.get('images | tables').value) {
            return eastWest;
        } else if (standard == LO_VIEW.get('images | xyPlots').value) {
            return northSouth;
        } else if (standard == LO_VIEW.get('xyPlots | tables').value) {
            return northSouth;
        } else {
            return triView;
        }
    } else if (results.length === 2 ) {
        if (standard == LO_VIEW.get('images | tables').value) {
            return eastWest;
        } else {
            return northSouth;
        }
    } else {
        return singleView;
    }
}
function resolveComponents(standard, imagePlot, xyPlot, tables) {
    var components = [];
    if(standard.has(LO_VIEW.images)) {
        components.push(imagePlot);
    }
    if(standard.has(LO_VIEW.tables)) {
        components.push(tables);
    }
    if(standard.has(LO_VIEW.xyPlots)) {
        components.push(xyPlot);
    }
    return filter(components);  // only takes declared items
}

