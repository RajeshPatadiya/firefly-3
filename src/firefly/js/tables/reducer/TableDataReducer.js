/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
import {get, omit} from 'lodash';

import {updateSet} from '../../util/WebUtil.js';
import * as TblUtil from '../TableUtil.js';
import * as Cntlr from '../TablesCntlr.js';
import {SelectInfo} from '../SelectInfo.js';



/*---------------------------- REDUCERS -----------------------------*/
export function dataReducer(state={data:{}}, action={}) {
    var root = state.data;
    switch (action.type) {
        case (Cntlr.TABLE_SELECT)  :
        {
            const {tbl_id, selectInfo} = action.payload;
            if (selectInfo) {
                return updateSet(root, [tbl_id, 'selectInfo'], selectInfo);
            } else return root;
        }
        case (Cntlr.TABLE_LOADED)  :
        {
            const {tbl_id} = action.payload;
            const statusPath = [tbl_id, 'tableMeta', 'Loading-Status'];
            if (get(root, statusPath, 'COMPLETED') !== 'COMPLETED') {
                return updateSet(root, statusPath, 'COMPLETED');
            } else return root;
        }
        case (Cntlr.TABLE_HIGHLIGHT)  :
        case (Cntlr.TABLE_UPDATE)  :
        {
            var {tbl_id} = action.payload;
            const updates = {[tbl_id] : {isFetching:false, ...action.payload}};
            return TblUtil.smartMerge(root, updates);
        }
        case (Cntlr.TABLE_FETCH)      :
        {
            const {tbl_id} = action.payload || {};
            const nTable = Object.assign({isFetching:true, selectInfo: SelectInfo.newInstance({rowCount:0}).data}, action.payload);
            const origTableModel = get(root, [tbl_id, 'origTableModel']);
            if (origTableModel) nTable.origTableModel = origTableModel;
            return updateSet(root, [tbl_id], nTable);
        }
        case (Cntlr.TABLE_REPLACE)  :
        {
            const {tbl_id} = action.payload || {};
            const rowCount = action.payload.totalRows || get(action, 'payload.tableData.data.length', 0);
            const nTable = Object.assign({isFetching:false, selectInfo: SelectInfo.newInstance({rowCount}).data}, action.payload);
            return updateSet(root, [tbl_id], nTable);
        }
        case (Cntlr.TABLE_REMOVE)  :
        {
            const {tbl_id} = action.payload;
            return omit(root, [tbl_id]);
        }
        default:
            return root;
    }
}
