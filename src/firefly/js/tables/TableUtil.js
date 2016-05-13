/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {get, set, isEmpty, uniqueId, padEnd, cloneDeep, omitBy, isNil} from 'lodash';
import * as TblCntlr from './TablesCntlr.js';
import {SortInfo, SORT_ASC, UNSORTED} from './SortInfo.js';
import {flux} from '../Firefly.js';
import {fetchUrl, encodeServerUrl, encodeParams} from '../util/WebUtil.js';
import {getRootPath, getRootURL} from '../util/BrowserUtil.js';
import {TableRequest} from './TableRequest.js';
import {parseWorldPt} from '../visualize/Point.js';

const SAVE_TABLE_URL = getRootURL() + 'servlet/SaveAsIpacTable';
const SRV_PATH = getRootPath() + 'search/json';
const INT_MAX = Math.pow(2,31) - 1;

/*----------------------------< creator functions ----------------------------*/

export function makeTblRequest(id, title, options={}, tbl_id=uniqueTblId()) {
    var req = {startIdx: 0, pageSize: 100};
    title = title || id;
    var META_INFO = {title, tbl_id};
    return omitBy(Object.assign(req, options, {META_INFO, id}), isNil);
}

/**
 * Table options.  All of the options are optional.  These options let you control
 * what data and how it will be returned from the request.
 * @typedef {object} TblReqOptions
 * @prop {number} startIdx  the starting index to fetch.  defaults to zero.
 * @prop {number} pageSize  the number of rows per page.  defaults to 100.
 * @prop {string} filters   list of conditions separted by comma(,). Format:  (col_name|index) operator value.
 *                  operator is one of '> < = ! >= <= IN'.  See DataGroupQueryStatement.java doc for more details.
 * @prop {string} sortInfo  sort information.  Format:  SortInfo=(ASC|DESC),col_name[,col_name]*
 * @prop {string} inclCols  list of columns to select.  Column names separted by comma(,)
 * @prop {string} decimate  decimation information.
 * @prop {object} META_INFO meta information passed as key/value pair to server then returned as tableMeta.
 */

/**
 * @param {string} [title]      title to display with this table.
 * @param {string} source       required; location of the ipac table. url or file path.
 * @param {string} [alt_source] use this if source does not exists.
 * @param {string} [tbl_id]     a unique ID to reference this table.  One will be created if not given.
 * @param {TblReqOptions} [options]  more options.  see TblReqOptions for details.
 * @returns {object}
 */
export function makeFileRequest(title, source, alt_source, options={}, tbl_id=uniqueTblId()) {
    const id = 'IpacTableFromSource';
    var req = {startIdx: 0, pageSize: 100};
    title = title || source;
    var META_INFO = {title, tbl_id};
    return omitBy(Object.assign(req, options, {source, alt_source, META_INFO, id}), isNil);
}


/**
 * Parameters for cone search
 * @typedef {object} ConeParams
 * @prop {string} method    'Cone'.
 * @prop {string} position  name or coordinates of the search
 * @prop {string} radius    radius of the search in arcsec
 */

/**
 * Parameters for eliptical search
 * @typedef {object} ElipParams
 * @prop {string} method    'Eliptical'.
 * @prop {string} position  name or coordinates of the search
 * @prop {string} radius    radius of the search in arcsec
 * @prop {string} radunits  the units for the radius or side, must be arcsec,arcmin,degree, default arcsec
 * @prop {string} ratio     ratio for elliptical request
 * @prop {string} posang    pa for elliptical request
 */

/**
 * Parameters for box search
 * @typedef {object} BoxParams
 * @prop {string} method    'Eliptical'.
 * @prop {string} position  name or coordinates of the search
 * @prop {string} size      the length of a side for a box search
 */

/**
 * creates the request to query IRSA catalogs.
 * @param {string} title    title to be displayed with this table result
 * @param {string} project
 * @param {string} catalog  the catalog name to search
 * @param {string} use      one of 'catalog_overlay', 'catalog_primary', 'data_primary'.
 * @param {(ConeParams|BoxParams|ElipParams)} params   one of 'Cone','Eliptical','Box','Polygon','Table','AllSky'.
 * @param {TblReqOptions} [options]
 * @returns {object}
 */
export function makeIrsaCatalogRequest(title, project, catalog, use='catalog_overlay', params={}, options={}, tbl_id=uniqueTblId()) {
    var req = {startIdx: 0, pageSize: 100};
    title = title || catalog;
    const id = 'GatorQuery';
    if (params.position) {
        params.position = parseWorldPt(params.position);
    }
    const SearchMethod = params.method;
    const catalogProject = catalog;

    var META_INFO = {title, tbl_id};
    return Object.assign(req, options, omit(params, 'method'), {id, META_INFO, SearchMethod, catalogProject, catalog, use});
}

/*---------------------------- creator functions >----------------------------*/


/**
 *
 * @param tableRequest is a TableRequest params object
 * @param hlRowIdx set the highlightedRow.  default to startIdx.
 * @returns {Promise.<T>}
 */
export function doFetchTable(tableRequest, hlRowIdx) {
    const def = {
        startIdx: 0,
        pageSize : INT_MAX,
        tbl_id : (tableRequest.tbl_id || tableRequest.title || tableRequest.id)
    };
    var params = Object.assign(def, tableRequest);
    // encoding for method post
    if (params[TableRequest.keys.META_INFO]) {
         params.META_INFO = encodeParams(params[TableRequest.keys.META_INFO]);
    }

    return fetchUrl(SRV_PATH, {method: 'post', params}).then( (response) => {
        return response.json().then( (tableModel) => {
            const {startIdx} = getTblInfo(tableModel);
            if (startIdx > 0) {
                // shift data arrays indices to match partial fetch
                tableModel.tableData.data = tableModel.tableData.data.reduce( (nAry, v, idx) => {
                    nAry[idx+startIdx] = v;
                    return nAry;
                }, []);
            }
            tableModel.highlightedRow = hlRowIdx || startIdx;
            return tableModel;
        });
    });
}

export function doValidate(type, action) {
    if (type !== action.type) {
        error(action, `Incorrect type:${action.type} was sent to a ${type} actionCreator.`);
    }
    if (!action.payload) {
        error(action, 'Invalid action.  Payload is missing.');
    }
    var {request} = action.payload;
    if (type === TblCntlr.TABLE_FETCH ) {
        if (request.id) {
            error(action, 'Required "id" field is missing.');
        }
        if (request.tbl_id) {
            error(action, 'Required "tbl_id" field is missing.');
        }
    } else if(type === TblCntlr.TABLE_HIGHLIGHT) {
        const idx = action.payload.highlightedRow;
        if (!idx || idx<0) {
            error(action, 'highlightedRow must be a positive number.');
        }
    }
    return action;
}

/**
 * update the given action with a new error given by cause.
 * action.err is stored as an array of errors.  Errors may be a String or an Error type.
 * @param action  the actoin to update
 * @param cause  the error to be added.
 */
export function error(action, cause) {
    (action.err = action.err || []).push(cause);
}

/**
 * return true is there is data within the given range.  this is needed because
 * of paging table not loading the full table.
 * @param startIdx
 * @param endIdx
 * @param tableModel
 * @returns {boolean}
 */
export function isTblDataAvail(startIdx, endIdx, tableModel) {
    if (!tableModel) return false;
    endIdx =  endIdx >0 ? Math.min( endIdx, tableModel.totalRows) : startIdx;
    if (startIdx >=0 && endIdx > startIdx) {
        const data = get(tableModel, 'tableData.data', []);
        const dataCount = Object.keys(data.slice(startIdx, endIdx)).length;
        return dataCount === (endIdx-startIdx);
    } else return false;
}


export function getTblById(id) {
    return get(flux.getState(),[TblCntlr.TABLE_SPACE_PATH, 'data', id]);
}

/**
 * return the group information
 * @param {string} tbl_group    the group to look for
 * @returns {*}
 */
export function getTableGroup(tbl_group='main') {
    return get(flux.getState(), [TblCntlr.TABLE_SPACE_PATH, 'results', tbl_group]);
}

/**
 * return the table group information for the given IDs.  
 * @param tbl_ui_id
 * @param tbl_group
 * @returns {*}
 */
export function isTableInGroup(tbl_id, tbl_group='main') {
    return get(flux.getState(), [TblCntlr.TABLE_SPACE_PATH, 'results', tbl_group, 'tables',  tbl_id]);
}

/**
 * get the table working state by tbl_ui_id
 * @param tbl_ui_id
 * @returns {*}
 */
export function getTableUiById(tbl_ui_id) {
    return get(flux.getState(), [TblCntlr.TABLE_SPACE_PATH, 'ui', tbl_ui_id]);
}

/**
 * return true if the table referenced by the given tbl_id is fully loaded.
 * @param tbl_id
 * @returns {boolean}
 */
export function isFullyLoaded(tbl_id) {
    return isTableLoaded(getTblById(tbl_id));
}

export function getColumnIdx(tableModel, colName) {
    const cols = get(tableModel, 'tableData.columns', []);
    return cols.findIndex((col) => {
        return col.name === colName;
    });
}

export function getActiveTableId(tbl_group='main') {
    return get(flux.getState(), [TblCntlr.TABLE_SPACE_PATH,'results',tbl_group,'active']);
}

/**
 *
 * @param tableModel
 * @param rowIdx
 * @param colName
 * @return {*}
 */
export function getCellValue(tableModel, rowIdx, colName) {
    if (get(tableModel, 'tableData.data.length', 0) > 0) {
        const colIdx = getColumnIdx(tableModel, colName);
        // might be undefined if row is not loaded
        return get(tableModel.tableData.data, [rowIdx, colIdx]);
    }
}


/**
 * return true if the given table is fully loaded.
 * @param tableModel
 * @returns {boolean}
 */
export function isTableLoaded(tableModel) {
    const status = tableModel && get(tableModel, 'tableMeta.Loading-Status', 'COMPLETED');
    return status === 'COMPLETED';
}

/**
 * This function transform the json data from the server to fit the need of the UI.
 * For instance, the column's name is repeated after transform.  This is good for the UI.
 * But, it's more efficient to not include it during data transfer from the server.
 * @param tableModel
 * @returns {*}
 */
export function transform(tableModel) {

    if (tableModel.tableData && tableModel.tableData.data) {
        const cols = tableModel.tableData.columns;
        // change row data from [ [val] ] to [ {cname:val} ]
        tableModel.tableData.data = tableModel.tableData.data.map( (row) => {
            return cols.reduce( (nrow, col, cidx) => {
                nrow[col.name] = row[cidx];
                return nrow;
            }, {});
        });
    }
}

/**
 * This function merges the source object into the target object
 * by traversing and comparing every like path.  If a value was
 * merged at any data node in the data graph, the node and all of its
 * parent nodes will be shallow cloned and returned.  Otherwise, the target's value
 * will be returned.
 * @param target
 * @param source
 * @returns {*}
 */
export function smartMerge(target, source) {
    if (!target) return source;

    if ( source && typeof(source)==='object') {
        if(Array.isArray(source)) {
            const aryChanges = [];
            source.forEach( (v, idx) => {
                const nval = smartMerge(target[idx], source[idx]);
                if (nval !== target[idx]) {
                    aryChanges[idx] = nval;
                }
            });
            if (isEmpty(aryChanges)) return target;
            else {
                const nAry = target.slice();
                aryChanges.forEach( (v, idx) => nAry[idx] = v );
                return nAry;
            }
        } else {
            const objChanges = {};
            Object.keys(source).forEach( (k) => {
                const nval = smartMerge(target[k], source[k]);
                if (nval !== target[k]) {
                    objChanges[k] = nval;
                }
            });
            return (isEmpty(objChanges)) ? target : Object.assign({}, target, objChanges);
        }
    } else {
        return (target === source) ? target : source;
    }
}

/**
 * sort the given tableModel based on the given request
 * @param origTableModel original table model.  this is returned when direction is UNSORTED.
 * @param sortInfoStr
 */
export function sortTable(origTableModel, sortInfoStr) {
    const sortInfoCls = SortInfo.parse(sortInfoStr);
    const colName = get(sortInfoCls, 'sortColumns.0');
    const dir = get(sortInfoCls, 'direction', UNSORTED);
    if (dir === UNSORTED || get(origTableModel, 'tableData.data.length', 0) === 0) return origTableModel;

    const multiplier = dir === SORT_ASC ? 1 : -1;
    const colIdx = getColumnIdx(origTableModel, colName);
    const col = get(origTableModel, ['tableData','columns', colIdx]);

    var tableModel = cloneDeep(origTableModel);
    set(tableModel, 'request.sortInfo', sortInfoStr);

    var comparator;
    if (!col.type || ['char', 'c'].includes(col.type) ) {
        comparator = (r1, r2) => {
                const [s1, s2] = [r1[colIdx], r2[colIdx]];
                return multiplier * (s1 > s2 ? 1 : -1);
            };
    } else {
        comparator = (r1, r2) => {
                const [v1, v2] = [r1[colIdx], r2[colIdx]];
                return multiplier * (Number(v1) - Number(v2));
            };
    }
    tableModel.tableData.data.sort(comparator);
    return tableModel;
}

/**
 * collects all available table request information given the table request.
 * @param request
 * @returns {*}
 */
export function getTblReqInfo(request) {
    if (!request) return {};
    const {startIdx, endIdx, sortInfo, filters, decimate, inclCols} = request;
    const tbl_id = get(request, 'META_INFO.tbl_id');
    const title = get(request, 'META_INFO.title', tbl_id);
    return omitBy({tbl_id, title, startIdx, endIdx, sortInfo, filters, decimate, inclCols}, isNil);
}

export function getTblInfoById(tbl_id, aPageSize) {
    const tableModel = getTblById(tbl_id);
    return getTblInfo(tableModel, aPageSize);
}

/**
 * collects all available table information given the tableModel.
 * @param tableModel
 * @param aPageSize  use this pageSize instead of the one in the request.
 * @returns {*}
 */
export function getTblInfo(tableModel, aPageSize) {
    if (!tableModel) return {};
    var {tbl_id, request, highlightedRow=0, totalRows=0, tableMeta={}, selectInfo, error} = tableModel;
    const {title} = tableMeta;
    const pageSize = aPageSize || get(request, 'pageSize', 1);  // there should be a pageSize.. default to 1 in case of error.  pageSize cannot be 0 because it'll overflow.
    if (highlightedRow < 0 ) {
        highlightedRow = 0;
    } else  if (highlightedRow >= totalRows-1) {
        highlightedRow = totalRows-1;
    }
    const currentPage = highlightedRow >= 0 ? Math.floor(highlightedRow / pageSize)+1 : 1;
    const hlRowIdx = highlightedRow >= 0 ? highlightedRow % pageSize : 0;
    const startIdx = (currentPage-1) * pageSize;
    const endIdx = Math.min(startIdx+pageSize, totalRows) || startIdx ;
    var totalPages = Math.ceil((totalRows || 0)/pageSize);
    return { tableModel, tbl_id, title, totalRows, request, startIdx, endIdx, hlRowIdx, currentPage, pageSize,totalPages, highlightedRow, selectInfo, error};
}

export function tableToText(columns, dataAry, showUnits=false) {

    var textHead = columns.reduce( (pval, cval, idx) => {
        return pval + (columns[idx].visibility === 'show' ? `${padEnd(cval.name, columns[idx].width)}|` : '');
    }, '|');

    if (showUnits) {
        textHead += '\n' + columns.reduce( (pval, cval, idx) => {
            return pval + (columns[idx].visibility === 'show' ? `${padEnd(cval.units || '', columns[idx].width)}|` : '');
        }, '|');
    }

    var textData = dataAry.reduce( (pval, row) => {
        return pval +
            row.reduce( (pv, cv, idx) => {
                return pv + (get(columns, [idx,'visibility']) === 'show' ? `${padEnd(cv || '', columns[idx].width)} ` : '');
            }, ' ') + '\n';
    }, '');
    return textHead + '\n' + textData;
}


/**
 *
 * @param columns
 * @param request
 * @param filename
 * @returns {encoded}
 */
export function getTableSourceUrl(columns, request, filename) {
    const Request = cloneDeep(request);
    const visiCols = columns.filter( (col) => {
                return col.visibility === 'show';
            }).map( (col) => {
                return col.name;
            } );
    if (visiCols.length !== columns.length) {
        request[inclCols] = visiCols.toString();
    }
    Request.startIdx = 0;
    Request.pageSize = Number.MAX_SAFE_INTEGER;
    const file_name = filename || Request.file_name;
    return encodeServerUrl(SAVE_TABLE_URL, {file_name, Request: request});
}



export function uniqueTblId() {
    const id = uniqueId('tbl_id-');
    if (getTblById(id)) {
        return uniqueTblId();
    } else {
        return id;
    }
}

export function uniqueTblUiId() {
    return uniqueId('tbl_ui_id-');
}