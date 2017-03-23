/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server.db;

import edu.caltech.ipac.firefly.server.db.spring.JdbcFactory;
import edu.caltech.ipac.firefly.server.util.Logger;
import edu.caltech.ipac.firefly.server.util.StopWatch;
import edu.caltech.ipac.util.*;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.SimpleJdbcTemplate;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.*;

import static edu.caltech.ipac.firefly.util.DataSetParser.*;

/**
 * @author loi
 * @version $Id: DbInstance.java,v 1.3 2012/03/15 20:35:40 loi Exp $
 */
public class AppDbUtil {
    private static final Logger.LoggerImpl logger = Logger.getLogger();
    private static final String TBL_REQUEST_TNAME = "table_requests";
    private static final String REQID_SEQ = "reqid_seq";

    private static final String META_INSERT = "insert into %s values (?,?,?,?,?,?,?,?,?,?)";
    private static final String META_TABLE_SQL = "create table %s "+
            "(" +
            "  cname    varchar(255)" +
            ", label    varchar(255)" +
            ", type     varchar(255)" +
            ", units    varchar(255)" +
            ", format   varchar(255)" +
            ", width    varchar(255)" +
            ", visibility varchar(255)" +
            ", sortable boolean" +
            ", filterable boolean" +
            ", \"desc\"     varchar(1000)" +
            ")";

    private static final String REQ_INSERT = String.format("insert into %s values (?,?,?,?,?,?)", TBL_REQUEST_TNAME);
    private static final String REQ_TABLE_SQL = "create table %s" +
            " (" +
            "  req_id   bigint PRIMARY KEY" +
            ", tbl_name varchar(255)" +
            ", tbl_meta varchar(255)" +
            ", row_cnt  int" +
            ", col_cnt  int" +
            ", created  bigint" +
            " )";




    public static void initApplicationDb() {

        getAppDbSimple().update("CALL SYSCS_UTIL.SYSCS_SET_DATABASE_PROPERTY('derby.storage.pageCacheSize', '8000')");
        try {
            String sql = String.format(REQ_TABLE_SQL, TBL_REQUEST_TNAME);
            logger.debug("initApplicationDb sql:" + sql);
            getAppDbSimple().update(sql);
        } catch (Exception ex) {ex.printStackTrace();} // ignore if exist.

        try {
            String sql = "create sequence " + REQID_SEQ + " start with 0";
            logger.debug("initApplicationDb sql:" + sql);
            getAppDbSimple().update(sql);
        } catch (Exception ex) {ex.printStackTrace();} // ignore if exist.
    }

    public static long storeTable(DataGroup dg) {
        StopWatch.getInstance().start("storeTable").start("recordRequest");
        long reqId = getAppDbSimple().queryForLong("values NEXT VALUE FOR reqid_seq");
        String tblName = String.format("data_%s",reqId);
        String metaName = String.format("meta_%s",reqId);;
        Object[] args = {reqId, tblName, metaName, dg.size(), dg.getDataDefinitions().length, System.currentTimeMillis()};
        getAppDbSimple().update(REQ_INSERT, args);
        StopWatch.getInstance().stop("recordRequest").start("recordMeta");

        createMetaTbl(metaName, dg);
        StopWatch.getInstance().stop("recordMeta").start("recordData");

        createDataTbl(tblName, dg);
        StopWatch.getInstance().stop("recordData").stop("storeTable").printLog("recordRequest").printLog("recordMeta").printLog("recordData").printLog("storeTable");
        logger.info(String.format("!!! ingesting %d cols and %d rows", dg.getDataDefinitions().length, dg.size()));

        return reqId;
    }

//====================================================================
// private methods
//====================================================================

    private static void createDataTbl(String dataTblName, DataGroup dg) {

        List<String> coldefs = new ArrayList<>();
        for(DataType dt : dg.getDataDefinitions()) {
            coldefs.add( "\"" + dt.getKeyName() + "\"" + " " + getH2Type(dt.getDataType()));
        }

        String sqlCreate = String.format("create table %s (", dataTblName);
        sqlCreate += StringUtils.toString(coldefs, ",") + ")";

        logger.debug("createDataTbl create:" + sqlCreate);
        getAppDbSimple().update(sqlCreate);

        List<Object[]> data = new ArrayList<>(dg.size());
        for(int i = 0; i < dg.size(); i++) {
            DataObject row = dg.get(i);
            data.add(row.getData());
        }
        String[] var = new String[dg.getDataDefinitions().length];
        Arrays.fill(var , "?");
        String sqlInsert = String.format("insert into %s values(%s)", dataTblName, StringUtils.toString(var, ","));
        logger.debug("createDataTbl insert:" + sqlInsert);

        getAppDb().batchUpdate(sqlInsert, new BatchPreparedStatementSetter() {
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                Object[] r = data.get(i);
                for (int cidx = 0; cidx < r.length; cidx++) ps.setObject(cidx+1, r[cidx]);
            }
            public int getBatchSize() {
                return data.size();
            }
        });

//        getAppDbSimple().batchUpdate(sqlInsert, data);
    }

    private static void createMetaTbl(String metaTblName, DataGroup dg) {
        String sqlCreate = String.format(META_TABLE_SQL, metaTblName);
        logger.debug("createMetaTbl create:" + sqlCreate);
        getAppDbSimple().update(sqlCreate);

        Map<String, DataGroup.Attribute> meta = dg.getAttributes();
        List<Object[]> data = new ArrayList<>();
        for(DataType dt : dg.getDataDefinitions()) {
            data.add( new Object[]
                {
                    dt.getKeyName(),
                    getStrVal(meta, LABEL_TAG, dt, dt.getKeyName()),
                    dt.getTypeDesc(),
                    dt.getDataUnit(),
                    dt.getFormatInfo().getDataFormatStr(),
                    getStrVal(meta, WIDTH_TAG, dt, ""),
                    getStrVal(meta, VISI_TAG, dt, VISI_SHOW),
                    Boolean.valueOf(getStrVal(meta, SORTABLE_TAG, dt, "true")),
                    Boolean.valueOf(getStrVal(meta, FILTERABLE_TAG, dt, "true")),
                    getStrVal(meta, DESC_TAG, dt, "")
                }
            );
        }
        String sqlInsert = String.format(META_INSERT, metaTblName);
        logger.debug("createMetaTbl insert:" + sqlInsert);
        getAppDbSimple().batchUpdate(sqlInsert, data);
    }

    private static String getStrVal(Map<String, DataGroup.Attribute> meta, String tag, DataType col, String def) {
        DataGroup.Attribute val = meta.get(makeAttribKey(LABEL_TAG, col.getKeyName()));
        return val == null ? def : val.getValue();
    }

    private static String getH2Type(Class type) {
        if (String.class.isAssignableFrom(type)) {
            return "varchar(64000)";
        } else if (Integer.class.isAssignableFrom(type)) {
            return "int";
        } else if (Long.class.isAssignableFrom(type)) {
            return "bigint";
        } else if (Float.class.isAssignableFrom(type)) {
            return "real";
        } else if (Double.class.isAssignableFrom(type)) {
            return "double";
        } else if (Date.class.isAssignableFrom(type)) {
            return "date";
        } else {
            return "varchar(255)";
        }
    }

    private static SimpleJdbcTemplate getAppDbSimple() {
        return JdbcFactory.getSimpleTemplate(DbInstance.application);
    }
    private static JdbcTemplate getAppDb() {
        return JdbcFactory.getTemplate(DbInstance.application);
    }

}
