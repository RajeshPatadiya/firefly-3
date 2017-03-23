/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React, {Component, PropTypes} from 'react';

import {FormPanel} from './FormPanel.jsx';
import {FieldGroup} from '../ui/FieldGroup.jsx';
import {ValidationField} from '../ui/ValidationField.jsx';
import Validate from '../util/Validate.js';
import {download} from '../util/WebUtil.js';
import {getRootURL} from '../util/BrowserUtil.js';
import {FileUpload} from '../ui/FileUpload.jsx';

import {dispatchHideDropDown} from '../core/LayoutCntlr.js';

import {dispatchTableSearch} from '../tables/TablesCntlr.js';
import * as TblUtil from '../tables/TableUtil.js';


export const SearchPanel = (props) => {
    return (
        <div style={{padding: 10}}>
            <FormPanel
                width='640px' height='300px'
                groupKey='TBL_BY_URL_PANEL'
                onSubmit={(request) => onSearchSubmit(request)}
                onCancel={hideSearchPanel}>
                <p>
                    <input type='button' name='dowload' value='Download Sample File' onClick={doFileDownload} />
                </p>
                <FieldGroup groupKey='TBL_BY_URL_PANEL' validatorFunc={null} keepState={true}>
                    <ValidationField style={{width:500}}
                                     fieldKey='srcTable'
                                     groupKey='TBL_BY_URL_PANEL'
                                     initialState= {{
                                                                value: 'http://web.ipac.caltech.edu/staff/roby/demo/WiseDemoTable.tbl',
                                                                tooltip: 'The URL to the source table',
                                                                label : 'Source Table:',
                                                                labelWidth : 120
                                                             }}
                    />
                    <ValidationField style={{width:500}}
                                     fieldKey='filters'
                                     groupKey='TBL_BY_URL_PANEL'
                                     initialState= {{
                                                                placeholder: 'Apply this filter on the table above',
                                                                value: '',
                                                                label : 'Filters:',
                                                                labelWidth : 120
                                                             }}
                    />

                    <FileUpload
                        wrapperStyle = {{margin: '5px 0'}}
                        fieldKey = 'fileUpload'
                        groupKey='TBL_BY_URL_PANEL'
                        initialState= {{
                                tooltip: 'Select a file to upload',
                                label: 'Upload File:'
                            }}
                    />
                    <ValidationField fieldKey='tbl_index'
                                     groupKey='TBL_BY_URL_PANEL'
                                     initialState= {{
                                            value: 0,
                                            size: 4,
                                            validator: Validate.intRange.bind(null, 0, 100000),
                                            label : 'Table Index:',
                                            labelWidth : 60
                                         }}
                    />
                </FieldGroup>
            </FormPanel>
        </div>
    );
};

SearchPanel.propTypes = {
    name: PropTypes.oneOf(['AnyDataSetSearch'])
};

SearchPanel.defaultProps = {
    name: 'AnyDataSetSearch',
};


function doFileDownload() {
    download(getRootURL() + 'samplehistdata.csv');
}

function hideSearchPanel() {
    dispatchHideDropDown();
}

function onSearchSubmit(request) {
    if (request.fileUpload) {
        const treq = TblUtil.makeFileRequest(null, request.fileUpload, null, {...request});
        dispatchTableSearch(treq);
    } else if (request.srcTable) {
        const treq = TblUtil.makeTblRequest('DbDemoProcessor', null, {source:request.srcTable}, {filters: request.filters});
        dispatchTableSearch(treq);
    }
}

