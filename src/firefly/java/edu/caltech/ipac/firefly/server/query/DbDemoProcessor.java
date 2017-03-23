/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server.query;

import edu.caltech.ipac.firefly.data.ServerParams;
import edu.caltech.ipac.firefly.data.ServerRequest;
import edu.caltech.ipac.firefly.data.TableServerRequest;
import edu.caltech.ipac.firefly.data.table.TableMeta;
import edu.caltech.ipac.firefly.server.ServerContext;
import edu.caltech.ipac.firefly.server.db.AppDbUtil;
import edu.caltech.ipac.firefly.server.util.ipactable.DataGroupPart;
import edu.caltech.ipac.firefly.server.util.ipactable.DataGroupReader;
import edu.caltech.ipac.firefly.server.util.ipactable.TableDef;
import edu.caltech.ipac.util.DataGroup;
import edu.caltech.ipac.util.DataType;
import edu.caltech.ipac.util.StringUtils;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.List;


@SearchProcessorImpl(id = "DbDemoProcessor")
public class DbDemoProcessor implements SearchProcessor<DataGroupPart> {

    public DataGroupPart getData(ServerRequest request) throws DataAccessException {
        String source = request.getParam(ServerParams.SOURCE);
        String altSource = request.getParam(ServerParams.ALT_SOURCE);

        try {
            DataGroup dg = getSourceFile(source);
            if (dg == null) {
                dg = getSourceFile(altSource);
            }
            if (dg == null) {
                throw new DataAccessException("Unable to read the source[alt_source] file:" + source + (StringUtils.isEmpty(altSource) ? "" : " [" + altSource + "]") );
            }
            long reqId = AppDbUtil.storeTable(dg);
            TableDef tm = new TableDef();
            tm.setStatus(DataGroupPart.State.COMPLETED);
            tm.setRowCount(dg.size());
            tm.setSource(String.valueOf(reqId));
            DataGroup page = dg.subset(0, 100);
            return new DataGroupPart(tm, page, 0, dg.size());
        } catch (IOException e) {
            throw new DataAccessException(e);
        }
    }

    public void writeData(OutputStream out, ServerRequest request) throws DataAccessException {

    }

    private DataGroup getSourceFile(String source) throws IOException {
        if (source == null) return null;
            URL url = makeUrl(source);
            if (url == null) {
                File f = ServerContext.convertToFile(source);
                if (f == null || !f.canRead()) return null;
                if ( !ServerContext.isFileInPath(f) ) {
                    throw new SecurityException("Access is not permitted.");
                }

                return DataGroupReader.readAnyFormat(f);
            }
        return null;
    }
    private URL makeUrl(String source) {
        try {
            return new URL(source);
        } catch (MalformedURLException e) {
            return null;
        }
    }



    public ServerRequest inspectRequest(ServerRequest request) { return request;}
    public String getUniqueID(ServerRequest request) {return null;}
    public boolean doCache() {return false;}
    public void onComplete(ServerRequest request, DataGroupPart results) throws DataAccessException {}
    public boolean doLogging() {return false;}
    public void prepareTableMeta(TableMeta defaults, List<DataType> columns, ServerRequest request) {}
    public QueryDescResolver getDescResolver() {return null;}
}

