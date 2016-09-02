/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {isEmpty, omitBy, isUndefined, cloneDeep, get} from 'lodash';
import {flux} from '../Firefly.js';
import * as TblCntlr from './TablesCntlr.js';
import * as TblUtil from './TableUtil.js';
import {SelectInfo} from './SelectInfo.js';
import {FilterInfo} from './FilterInfo.js';
import {fetchUrl} from '../util/WebUtil.js';

export class TableConnector {
    
    constructor(tbl_id, tbl_ui_id, tableModel, showUnits=true, showFilters=false, pageSize) {
        this.tbl_id = tbl_id;
        this.tbl_ui_id = tbl_ui_id;
        this.localTableModel = tableModel;

        this.origPageSize = pageSize;
        this.origShowUnits = showUnits;
        this.origShowFilters = showFilters;
    }

    onSort(sortInfoString) {
        var {tableModel, request} = TblUtil.getTblInfoById(this.tbl_id);
        if (this.localTableModel) {
            tableModel = TblUtil.sortTable(this.localTableModel, sortInfoString);
            TblCntlr.dispatchTableReplace(tableModel);
        } else {
            request = Object.assign({}, request, {sortInfo: sortInfoString});
            TblCntlr.dispatchTableSort(request);
        }
    }

    onFilter(filterIntoString) {
        var {tableModel, request} = TblUtil.getTblInfoById(this.tbl_id);
        if (this.localTableModel) {
            tableModel = filterIntoString ? TblUtil.filterTable(this.localTableModel, filterIntoString) : this.localTableModel;
            TblCntlr.dispatchTableReplace(tableModel);
        } else {
            request = Object.assign({}, request, {filters: filterIntoString});
            TblCntlr.dispatchTableFilter(request);
        }
    }

    /**
     * filter on the selected rows
     * @param {number[]} selected  array of selected row indices.
     */
    onFilterSelected(selected) {
        if (isEmpty(selected)) return;

        var {tableModel, request} = TblUtil.getTblInfoById(this.tbl_id);
        if (this.localTableModel) {
            // not implemented yet
        } else {
            const filterInfoCls = FilterInfo.parse(request.filters);
            const filePath = get(tableModel, 'tableMeta.tblFilePath');
            if (filePath) {
                getRowIdFor(filePath, selected).then( (selectedRowIdAry) => {
                    const value = selectedRowIdAry.reduce((rv, val, idx) => {
                            return rv + (idx ? ',':'') + val;
                        }, 'IN (') + ')';
                    filterInfoCls.addFilter('ROWID', value);
                    request = Object.assign({}, request, {filters: filterInfoCls.serialize()});
                    TblCntlr.dispatchTableFilter(request);
                });
            }
        }
    }

    onPageSizeChange(nPageSize) {
        nPageSize = Number.parseInt(nPageSize);
        const {pageSize, highlightedRow} = TblUtil.getTblInfoById(this.tbl_id);
        if (Number.isInteger(nPageSize) && nPageSize !== pageSize) {
            const request = {pageSize: nPageSize};
            TblCntlr.dispatchTableHighlight(this.tbl_id, highlightedRow, request);
        }
    }

    onGotoPage(number = '1') {
        const {currentPage, totalPages, pageSize} = TblUtil.getTblInfoById(this.tbl_id);
        number = Number.parseInt(number);
        if (Number.isInteger(number) && number !== currentPage && number > 0 && number <= totalPages) {
            const highlightedRow = (number - 1) * pageSize;
            TblCntlr.dispatchTableHighlight(this.tbl_id, highlightedRow);
        }
    }

    onRowHighlight(rowIdx) {
        const {hlRowIdx, startIdx} = TblUtil.getTblInfoById(this.tbl_id);
        if (rowIdx !== hlRowIdx) {
            const highlightedRow = startIdx + rowIdx;
            if (this.localTableModel) {
                const tableModel = {tbl_id: this.tbl_id, highlightedRow};
                flux.process({type: TblCntlr.TABLE_UPDATE, payload: tableModel});
            } else {
                TblCntlr.dispatchTableHighlight(this.tbl_id, highlightedRow);
            }
        }
    }

    onSelectAll(checked) {
        const {startIdx, tableModel} = TblUtil.getTblInfoById(this.tbl_id);
        const selectInfo = tableModel.selectInfo ? cloneDeep(tableModel.selectInfo) : {};
        const selectInfoCls = SelectInfo.newInstance(selectInfo, startIdx);
        selectInfoCls.setSelectAll(checked);
        TblCntlr.dispatchTableSelect(this.tbl_id, selectInfoCls.data);
    }

    onRowSelect(checked, rowIndex) {
        const {tableModel, startIdx} = TblUtil.getTblInfoById(this.tbl_id);
        const selectInfo = tableModel.selectInfo ? cloneDeep(tableModel.selectInfo) : {};
        const selectInfoCls = SelectInfo.newInstance(selectInfo, startIdx);
        selectInfoCls.setRowSelect(rowIndex, checked);
        TblCntlr.dispatchTableSelect(this.tbl_id, selectInfoCls.data);
    }

    onToggleTextView(textView) {
        const changes = {tbl_ui_id:this.tbl_ui_id, textView};
        TblCntlr.dispatchTableUiUpdate(changes);
    }

    onToggleOptions(showOptions) {
        const changes = {tbl_ui_id:this.tbl_ui_id, showOptions};
        TblCntlr.dispatchTableUiUpdate(changes);
    }

    onOptionUpdate({pageSize, columns, showUnits, showFilters, sortInfo, filterInfo}) {
        if (pageSize) {
            this.onPageSizeChange(pageSize);
        }
        if (!isUndefined(filterInfo)) {
            this.onFilter(filterInfo);
        }
        const changes = omitBy({columns, showUnits, showFilters, optSortInfo:sortInfo}, isUndefined);
        if (!isEmpty(changes)) {
            changes.tbl_ui_id = this.tbl_ui_id;
            TblCntlr.dispatchTableUiUpdate(changes);
        }
    }

    onOptionReset() {
        const ctable = this.localTableModel || TblUtil.getTblById(this.tbl_id);
        var filterInfo = get(ctable, 'request.filters', '').trim();
        filterInfo = filterInfo !== '' ? '' : undefined;
        const pageSize = get(ctable, 'request.pageSize') !== this.origPageSize ? this.origPageSize : undefined;
        this.onOptionUpdate({filterInfo, pageSize,
                        columns: cloneDeep(get(ctable, 'tableData.columns', [])),
                        showUnits: this.origShowUnits,
                        showFilters: this.origShowFilters});
    }

    static newInstance(tbl_id, tbl_ui_id, tableModel, showUnits, showFilters, pageSize) {
        return new TableConnector(tbl_id, tbl_ui_id, tableModel, showUnits, showFilters, pageSize);
    }
}


function getRowIdFor(filePath, selected) {
    if (isEmpty(selected)) return [];

    const params = {id: 'Table__SelectedValues', columnName: 'ROWID', filePath, selectedRows: String(selected)};

    return fetchUrl(TblUtil.SEARCH_SRV_PATH, {method: 'post', params}).then( (response) => {
        return response.json().then( (selectedRowIdAry) => {
            return selectedRowIdAry;
        });
    });

}