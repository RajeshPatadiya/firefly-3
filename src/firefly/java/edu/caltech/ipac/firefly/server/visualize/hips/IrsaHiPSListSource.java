package edu.caltech.ipac.firefly.server.visualize.hips;

import edu.caltech.ipac.firefly.server.util.Logger;
import edu.caltech.ipac.firefly.server.visualize.hips.HiPSMasterListEntry.PARAMS;
import edu.caltech.ipac.firefly.data.ServerParams;
import edu.caltech.ipac.util.AppProperties;
import edu.caltech.ipac.util.DataGroup;
import edu.caltech.ipac.firefly.server.util.DsvToDataGroup;
import edu.caltech.ipac.util.download.FailedRequestException;
import edu.caltech.ipac.util.DataObject;
import edu.caltech.ipac.util.DataType;
import edu.caltech.ipac.firefly.server.query.DataAccessException;
import edu.caltech.ipac.firefly.data.FileInfo;
import edu.caltech.ipac.util.download.URLDownload;
import edu.caltech.ipac.firefly.server.query.lsst.LSSTQuery;
import org.apache.commons.csv.CSVFormat;

import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.io.IOException;
import java.io.InputStream;
import java.io.File;
import java.net.URL;
import java.io.FileReader;
import java.io.BufferedReader;

/**
 * Created by cwang on 2/27/18.
 */
public class IrsaHiPSListSource implements HiPSMasterListSourceType {
    private static final Logger.LoggerImpl _log = Logger.getLogger();
    private static final String irsaHiPSSource = AppProperties.getProperty("irsa.hips.list.source", "file");
    private static final String irsaHipsTable = "/edu/caltech/ipac/firefly/resources/irsa-hips-master-table.csv";
    private static final String irsaHipsUrl = "https://irsadev.ipac.caltech.edu/data/hips/list";
    private static final String irsaHiPSListFrom = irsaHiPSSource.equals("file") ?
                                                    AppProperties.getProperty("irsa.hips.masterFile",irsaHipsTable):
                                                    AppProperties.getProperty("irsa.hips.masterUrl", irsaHipsUrl);
    private static int TIMEOUT  = new Integer( AppProperties.getProperty("HiPS.timeoutLimit" , "30")).intValue();



    private static Map<String, String> paramsMap = new HashMap<>();
    static {
            HiPSMasterListEntry.setParamsMap(paramsMap, PARAMS.ID, "creator_did");
            HiPSMasterListEntry.setParamsMap(paramsMap, PARAMS.URL, "hips_service_url");
            HiPSMasterListEntry.setParamsMap(paramsMap, PARAMS.TITLE, "obs_title");
            HiPSMasterListEntry.setParamsMap(paramsMap, PARAMS.ORDER, "hips_order");
            HiPSMasterListEntry.setParamsMap(paramsMap, PARAMS.TYPE, "dataproduct_type");
            HiPSMasterListEntry.setParamsMap(paramsMap, PARAMS.FRACTION, "moc_sky_fraction");
            HiPSMasterListEntry.setParamsMap(paramsMap, PARAMS.FRAME, "hips_frame");
    }

    public List<HiPSMasterListEntry> getHiPSListData(String[] dataTypes, String source) {
        try {

            if (!Arrays.asList(dataTypes).contains(ServerParams.IMAGE)) return null;

            if (irsaHiPSSource.equals("file")) {
                return createHiPSListFromFile(irsaHiPSListFrom, dataTypes, source);
            } else {
                return createHiPSListFromUrl(irsaHiPSListFrom, dataTypes, source);
            }
        }
        catch (FailedRequestException | IOException | DataAccessException e) {
            _log.warn("get Irsa HiPS failed");
            return null;
        } catch (Exception e) {
            _log.warn(e.getMessage());
            return null;
        }

    }

    public static List<HiPSMasterListEntry> createHiPSListFromUrl(String url, String[] dataTypes, String source)
                                                  throws IOException, DataAccessException, FailedRequestException  {
        _log.briefDebug("executing " + source + " url query: " + url);

        File file = HiPSMasterList.createFile(dataTypes, ".txt", source);
        Map<String, String> requestHeader=new HashMap<>();

        requestHeader.put("Accept", "application/text");
        long cTime = System.currentTimeMillis();
        FileInfo listFile = URLDownload.getDataToFileUsingPost(new URL(url), null, null, requestHeader, file, null,
                                                               TIMEOUT);

        _log.briefDebug("get " + source + " HiPS took " + (System.currentTimeMillis() - cTime) + "ms");

        if (listFile.getResponseCode() >= 400) {
            String err = LSSTQuery.getErrorMessageFromFile(file);
            throw new DataAccessException("[HiPS_LIST] " + (err == null ? listFile.getResponseCodeMsg() : err));
        }

        return getListDataFromFile(file, paramsMap, source);

    }

    private static List<HiPSMasterListEntry> getListDataFromFile(File f, Map<String, String> keyMap, String source)
                                                                                               throws IOException {
        if (f == null) return null;

        try{
            // Open the file that is the first command line parameter
            BufferedReader br = new BufferedReader(new FileReader(f));
            String strLine;
            HiPSMasterListEntry oneList = null;
            List<HiPSMasterListEntry> lists = new ArrayList<>();
            String sProp = HiPSMasterListEntry.getParamString(keyMap, PARAMS.ID);  // first property for each record

            //Read File Line By Line
            while ((strLine = br.readLine()) != null)   {
                String tLine = strLine.trim();
                if (tLine.startsWith("#")) continue;    // comment line

                String[] oneKeyVal = tLine.split("=");
                if (oneKeyVal.length != 2) continue;    // not legal key=value line

                String k = oneKeyVal[0].trim();         // key
                String v = oneKeyVal[1].trim();         // value


                if (k.equalsIgnoreCase(sProp)) {        // key is 'creator_did'
                    oneList = new HiPSMasterListEntry();
                    lists.add(oneList);
                    oneList.set(PARAMS.ID.getKey(), v);
                    oneList.set(PARAMS.SOURCE.getKey(), source);
                    oneList.set(PARAMS.TYPE.getKey(), ServerParams.IMAGE); // set default type
                    oneList.set(PARAMS.TITLE.getKey(), getTitle(v));       // set default title
                } else {
                    if (oneList == null) continue;
                    for (Map.Entry<String, String> entry : keyMap.entrySet()) {
                        if (entry.getValue().equals(k)) {
                            oneList.set(entry.getKey(), v);
                            break;
                        }
                    }
                }
            }
            //Close the input stream
            br.close();
            return lists;
        } catch (Exception e){//Catch exception if any
            e.printStackTrace();
            throw new IOException("[HIPS_CDS]:" + e.getMessage());
        }
    }

    private static String getTitle(String titleStr) {
         int insLoc = titleStr.indexOf("//");
         if (insLoc < 0) return titleStr;

         int divLoc = titleStr.indexOf('/', insLoc+2);
         if (divLoc < 0) return titleStr;

         int titleLoc = titleStr.indexOf('/', divLoc+1);
         if (titleLoc < 0) return titleStr;

         return titleStr.substring(titleLoc+1).replaceAll("/", " ").trim();
    }

    // a csv file is created to contain HiPS from IRSA
    private List<HiPSMasterListEntry> createHiPSListFromFile(String hipsMaster,
                                                     String[] dataTypes,
                                                     String source) throws IOException, FailedRequestException {

        InputStream inf= IrsaHiPSListSource.class.getResourceAsStream(hipsMaster);
        DataGroup dg = DsvToDataGroup.parse(inf, CSVFormat.DEFAULT);

        return getListData(dg, paramsMap, source);
    }

    private List<HiPSMasterListEntry> getListData(DataGroup hipsDg,
                                                  Map<String, String> keyMap, String source) {

        List<DataObject> dataRows = hipsDg.values();
        DataType[]   dataCols = hipsDg.getDataDefinitions();
        String[]     cols = new String[dataCols.length];

        for (int i = 0; i < dataCols.length; i++) {
            String colName = dataCols[i].getKeyName();
            for (Map.Entry<String, String> entry: keyMap.entrySet()) {
                if (colName.equals(entry.getValue())) {
                    cols[i] = entry.getKey();
                    break;
                }
            }
        }

        List<HiPSMasterListEntry> lists = new ArrayList<>();
        HiPSMasterListEntry oneList;

        for (DataObject row : dataRows) {
            oneList = new HiPSMasterListEntry();
            lists.add(oneList);
            oneList.set(PARAMS.SOURCE.getKey(), source);
            oneList.set(PARAMS.TYPE.getKey(), ServerParams.IMAGE);
            for (int i = 0; i < dataCols.length; i++) {
                if (cols[i] == null) continue;

                Object obj = row.getDataElement(dataCols[i].getKeyName());
                String val = obj != null ? obj.toString() : null;

                oneList.set(cols[i], val);
                if (dataCols[i].getKeyName().equals(keyMap.get(PARAMS.ID.getKey()))) {
                    oneList.set(PARAMS.TITLE.getKey(), getTitle(val));
                }
            }
        }

        
        return lists;
    }
}

