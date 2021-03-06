/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server;

import edu.caltech.ipac.firefly.data.WspaceMeta;
import edu.caltech.ipac.firefly.server.network.HttpServices;
import edu.caltech.ipac.firefly.server.util.Logger;
import edu.caltech.ipac.firefly.server.ws.WsCredentials;
import edu.caltech.ipac.firefly.server.ws.WsException;
import edu.caltech.ipac.firefly.server.ws.WsResponse;
import edu.caltech.ipac.firefly.server.ws.WsUtil;
import edu.caltech.ipac.util.AppProperties;
import edu.caltech.ipac.util.StringUtils;
import org.apache.commons.httpclient.methods.InputStreamRequestEntity;
import org.apache.commons.httpclient.methods.RequestEntity;
import org.apache.commons.httpclient.params.HttpMethodParams;
import org.apache.commons.io.FileUtils;
import org.apache.jackrabbit.webdav.DavConstants;
import org.apache.jackrabbit.webdav.DavMethods;
import org.apache.jackrabbit.webdav.MultiStatus;
import org.apache.jackrabbit.webdav.MultiStatusResponse;
import org.apache.jackrabbit.webdav.client.methods.*;
import org.apache.jackrabbit.webdav.property.*;
import org.apache.jackrabbit.webdav.xml.Namespace;

import java.io.*;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * WebDAV implementation for IRSA
 * Everything relative to ws home (as URI remote)
 * Date: 6/12/14
 *
 * @author loi
 * @version $Id: $
 */
public class WebDAVWorkspaceManager implements WorkspaceManager {

    /**
     * TODO is this used currently or should/will it be used in the future?
     */
    private static final Namespace IRSA_NS = Namespace.getNamespace("irsa", "https://irsa.ipac.caltech.edu/namespace/");
    //TODO We might need to change those properties if we need to deal with 2 or more workspaces at the same time
    private String WS_ROOT_DIR = AppProperties.getProperty("workspace.root.dir", "/work");
    private String WS_HOST_URL = AppProperties.getProperty("workspace.host.url", "https://irsa.ipac.caltech.edu");

    private static final Logger.LoggerImpl LOG = Logger.getLogger();
    private WsCredentials creds;

    @Override
    public String getProp(PROPS prop) {
        PROPS propFound = null;
        for (PROPS p : PROPS.values()) {
            if (p.name().equalsIgnoreCase(prop.name())) {
                propFound = p;
                break;
            }
        }
        String propVal = prop + " doesn't exist";
        if (propFound.equals(PROPS.ROOT_URL)) {
            propVal = WS_HOST_URL;
        } else if (propFound.equals(PROPS.ROOT_DIR)) {
            propVal = WS_ROOT_DIR;
        } else if (propFound.equals(PROPS.AUTH)) {
            propVal = this.partition.name();
        } else if (propFound.equals(PROPS.PROTOCOL)) {
            propVal = PROTOCOL.WEBDAV.name();
        }

        return propVal;
    }

    public enum Partition {
        PUBSPACE, SSOSPACE;

        public String toString() {
            return name().toLowerCase();
        }
    }

    private Partition partition;
    private String userHome;
    private Map<String, String> cookies;

    /**
     * Used by {@link edu.caltech.ipac.firefly.server.ws.WebDAVWorkspaceHandler#withCredentials(WsCredentials)}}
     * @param cred {@link WsCredentials}
     */
    public WebDAVWorkspaceManager(WsCredentials cred) {
        this(((cred.getPassword()!=null) || (cred.getCookies() != null))?Partition.SSOSPACE:Partition.PUBSPACE, cred, true);
    }

    public WebDAVWorkspaceManager(String pubspaceId) {
        this(Partition.PUBSPACE, new WsCredentials(pubspaceId), true);
    }

    public WebDAVWorkspaceManager(String ssospaceId, Map<String, String> cookies) {
        this(Partition.SSOSPACE, new WsCredentials(ssospaceId, cookies), false);

    }

    public WebDAVWorkspaceManager(String ssospaceId, String pass) {
        this(Partition.SSOSPACE, new WsCredentials(ssospaceId, pass), false);
    }

    public WebDAVWorkspaceManager(Partition partition, WsCredentials cred, boolean initialize) {
        this(partition, cred.getWsId(), cred.getCookies(), initialize);
        this.creds = cred;
    }

    public WebDAVWorkspaceManager(Partition partition, String wsId, Map<String, String> cookies, boolean initialize) {
        this.creds = new WsCredentials(wsId, cookies);
        this.partition = partition;
        this.userHome = WspaceMeta.ensureWsHomePath(wsId);
        this.cookies = cookies;
        if (initialize) {
            davMakeDir("");
        }
    }

    /**
     * returns the local filesystem path of the given relpath.
     *
     * @param relPath relative to the user's workspace and must starts with '/'
     * @return
     */
    public String getLocalFsPath(String relPath) {
        return WS_ROOT_DIR + getAbsPath(relPath);
    }

    /**
     * returns the webdav's absolute path.  for IRSA, it's /partition/user_ws/relpath.
     *
     * @param relPath relative to the user's workspace and must starts with '/'
     * @return
     */
    public String getAbsPath(String relPath) {
        String s = WspaceMeta.ensureRelPath(relPath);
        return getWsHome() + s;
    }

    /**
     * returns the relative path given the file.  for IRSA, it's /partition/user_ws/relpath.
     *
     * @param file relative to the user's workspace and must starts with '/'
     * @return
     */
    public String getRelPath(File file) {
        String s = file.getAbsolutePath().replaceFirst(WS_ROOT_DIR, "");
        s = s.replaceFirst(getWsHome(), "");
        return s;
    }

    /**
     * return the url of this resource.
     *
     * @param relPath
     * @return
     */
    public String getResourceUrl(String relPath) {
        String valid = null;
        try {
            valid = WsUtil.encode(relPath);
        } catch (URISyntaxException e) {
            LOG.error(e, "Continue with relative path as it is: "+relPath);
            e.printStackTrace();
        }
        return WS_HOST_URL + getAbsPath(valid);
    }

    public String getWsHome() {
        return "/" + partition + userHome;
    }

    public File createWsLocalFile(String parent, String fname, String fext) {
        davMakeDir(parent);
        return new File(new File(getLocalFsPath(parent)), fname + "-" + System.currentTimeMillis() % 1000000 + fext);
    }


//====================================================================
//  WEBDAV functions
//====================================================================

    /**
     * create a directory given by the relPath parameter.
     *
     * @param relPath relative to the user's workspace
     * @return the absolute path to the directory on the filesystem.
     */
    public File davMakeDir(String relPath) {
        try {
            String[] parts = relPath.split("/");
            String cdir = "/";
            for (String s : parts) {
                cdir += StringUtils.isEmpty(s) ? "" : s + "/";
                WspaceMeta m = getMeta(cdir, WspaceMeta.Includes.NONE);
                if (m == null) {
                    DavMethod mkcol = new MkColMethod(getResourceUrl(cdir));
                    if (!executeMethod(mkcol)) {
                        // handle error
                        LOG.error("Unable to create directory:" + relPath + " -- " + mkcol.getStatusText());
                        return null;
                    }
                }
            }
            return new File(getLocalFsPath(relPath));
        } catch (Exception e) {
            LOG.error(e, "Error while makeCollection:" + relPath);
        }
        return null;
    }

    boolean exists(String relRemoteUri) {
        return getMeta(relRemoteUri, WspaceMeta.Includes.NONE) != null;
    }



    /**
     *
     * @param upload
     * @param relPath   expecting uri folder with file name attached optionally a/b
     * @param overwrite when true, put will overwrite existing file with the same name
     * @param contentType
     * @return
     */
    public WsResponse davPut(File upload, String relPath, boolean overwrite, String contentType) {
        try {

            int idx = relPath.lastIndexOf('/');
            String newFileName = relPath.substring(idx + 1);

            relPath = relPath.substring(0, idx+1);
            String parentPath = WsUtil.ensureUriFolderPath(relPath);
            //if (!exists(parentPath)) {
            WsResponse response = createParent(parentPath);

            String newPath;
            String newUrl;
            if (newFileName.length() == 0) {
                newPath = parentPath + upload.getName();
                newUrl =  getResourceUrl(parentPath) + WsUtil.encode(upload.getName());
            } else {
                newPath = parentPath + newFileName;
                newUrl =  getResourceUrl(parentPath) + WsUtil.encode(newFileName);
            }
            //}
            // If parent and file name exists already, stop
            if (!response.doContinue()) {
                return WsUtil.error(Integer.parseInt(response.getStatusCode()), response.getStatusText(), parentPath);
            }


            if (exists(newPath) && (!overwrite)) {
                //if (exists(relPath)) {
                return WsUtil.error(304, newUrl);// not modified, already exists
            }

            PutMethod put = new PutMethod(newUrl);

            // TODO Content Type doesn't seems to be passed on
            RequestEntity requestEntity = new InputStreamRequestEntity(new BufferedInputStream(
                    new FileInputStream(upload), HttpServices.BUFFER_SIZE), upload.length(), contentType);
            put.setRequestEntity(requestEntity);
            /** is to allow a client that is sending a request message with a request body
             *  to determine if the origin server is willing to accept the request
             * (based on the request headers) before the client sends the request body.
             * this require server supporting HTTP/1.1 protocol.
             */
            put.getParams().setBooleanParameter(
                    HttpMethodParams.USE_EXPECT_CONTINUE, true);

            if (!executeMethod(put)) {
                // handle error
                LOG.error("Unable to upload file:" + relPath + " -- " + put.getStatusText());
                return WsUtil.error(put.getStatusCode(), put.getStatusText());
            }

            return WsUtil.success(put.getStatusCode(), put.getStatusText(), newUrl);
        } catch (Exception e) {
            LOG.error(e, "Error while uploading file:" + upload.getPath());
        }
        return WsUtil.error(500);
    }

    public WsResponse davGet(File outfile, String fromPath) throws IOException {
        String url = getResourceUrl(fromPath);
        WebDAVGetMethod get = new WebDAVGetMethod(url);
        InputStream in = null;
        try {
            if (!executeMethod(get, false)) {
                // handle error
                LOG.error("Unable to download file:" + fromPath + " , url " +url+" -- "+ get.getStatusText());
                return WsUtil.error(get.getStatusCode(), get.getStatusText());
            }
            if (get.getResponseContentLength() > 0) {
                in = get.getResponseBodyAsStream();
                FileUtils.copyInputStreamToFile(in, outfile);
            }
        } catch (Exception e) {
            LOG.error(e, "Error while downloading remote file:" + url);
        } finally {
            get.releaseConnection();
        }
        return WsUtil.success(200, "File downloaded " + outfile.getAbsolutePath(), "");
    }

//====================================================================
//  for firefly use
//====================================================================


    @Override
    public WsCredentials getCredentials() {
        return this.creds;
    }

    @Override
    public PROTOCOL getProtocol() {
        return PROTOCOL.WEBDAV;
    }

    @Override
    public WsResponse getList(String parentUri, int depth) throws WsException {

        WspaceMeta.Includes prop = WspaceMeta.Includes.CHILDREN_PROPS;

        if (depth < 0) {
            prop = WspaceMeta.Includes.ALL_PROPS;
        } else if (depth == 0) {
            prop = WspaceMeta.Includes.NONE_PROPS;
        }

        WsResponse resp = new WsResponse("200", "List", "");

        WspaceMeta meta = getMeta(parentUri, prop);
        if (meta == null) {
            WsResponse response = getResponse(parentUri);
            return response;
        }
        List<WspaceMeta> childNodes = new ArrayList<>();
        childNodes.add(meta);

        //If no child, set the (self) meta in response:
        resp.setWspaceMeta(childNodes);

        if (meta.getChildNodes() != null) {
            // Childs replaced here:
            childNodes = meta.getChildNodes();
            resp.setWspaceMeta(childNodes);
            String respString = "";
            Iterator<WspaceMeta> it = childNodes.iterator();
            int child = 0;
            while (it.hasNext()) {
                WspaceMeta next = it.next();
                respString += next.getRelPath() + ", ";
                child++;

            }
            resp.setResponse(respString);
        }

        return resp;
    }

    @Override
    public WsResponse getFile(String fileUri, File outputFile) throws WsException {
        try {
            return davGet(outputFile, fileUri);
        } catch (IOException e) {
            throw new WsException("Fail to get the file " + fileUri);
        }
    }

    @Override
    public WsResponse getFile(String fileUri, Consumer consumer) throws WsException {
        throw new IllegalArgumentException("not implemented");
    }


    @Override
    public WsResponse putFile(String relPath, boolean overwrite, File item, String contentType) throws WsException {
        String ct = contentType;
        if (contentType == null) {
            //ct = ContentType.DEFAULT_BINARY.getMimeType();
            //ct="image/fits";
        }

        return davPut(item, relPath, overwrite, ct);
    }

    @Override
    public WsResponse delete(String uri) throws WsException {
        if (WspaceMeta.ensureWsHomePath(uri).equals("")) {
            return WsUtil.error(304, "Attempt to delete home, skipping...");
        }
        String url = getResourceUrl(uri);
        WebDAVDeleteMethod rm = new WebDAVDeleteMethod(url);
        try {
            if (!executeMethod(rm, true)) {
                // handle error
                LOG.error("Unable to delete file uri:" + uri + " -- " + rm.getStatusText());
                return WsUtil.error(rm);
            }
        } catch (Exception e) {
            LOG.error(e, "Error while deleting remote file:" + url);
        }
        return WsUtil.success(200, "Deleted " + uri, uri);
    }

    @Override
    public WsResponse createParent(String newRelPath) throws WsException {
        String[] parts = newRelPath.split("/");
        String cdir = "/";
        for (String s : parts) {
            cdir += StringUtils.isEmpty(s) ? "" : s + "/";
            WspaceMeta m = getMeta(cdir, WspaceMeta.Includes.NONE);
            if (m == null) {
                try {
                    URI uri = new URI(getResourceUrl(cdir));

                    DavMethod mkcol = new MkColMethod(uri.toURL().toString());
                    if (!executeMethod(mkcol)) {
                        // handle error
                        LOG.error("Unable to create directory:" + newRelPath + " -- " + mkcol.getStatusText());
                        return WsUtil.error(mkcol, "Resource already exist");
                    }
                } catch (URISyntaxException e) {
                    return WsUtil.error(e);
                } catch (MalformedURLException e) {
                    return WsUtil.error(e);
                }
            }
        }
        return WsUtil.success(200, "Created", getResourceUrl(newRelPath));
    }

    public WsResponse moveFile(String originalFileRelPath, String newPath, boolean overwrite) throws WsException {
        WspaceMeta meta = new WspaceMeta(newPath);
        String parent = meta.getParentPath();

        //WARNING: WEBDAv forces me to create new parent first! UGLY!
        createParent(parent);

        String newUrl = getResourceUrl(newPath);

        // This doesn't create parent , you must create the parent folder in order to move it
        MoveMethod move = new MoveMethod(getResourceUrl(originalFileRelPath), newUrl, overwrite);
        if (!executeMethod(move)) {
            // handle error
            LOG.error("Unable to move:" + originalFileRelPath + " based on url -- " +newUrl+" -- "+ move.getStatusText());
            return WsUtil.error(move.getStatusCode(), move.getStatusLine().getReasonPhrase());
        }
        return WsUtil.success(move.getStatusCode(), move.getStatusText(), newUrl);
    }

    @Override
    public WsResponse renameFile(String originalFileRelPath, String newfileName, boolean overwrite) throws WsException {
        WspaceMeta meta = new WspaceMeta(originalFileRelPath);
        String parent = meta.getParentPath();

        String newUrl = null;
        try {
            newUrl = getResourceUrl(parent) + WsUtil.encode(newfileName);
        } catch (URISyntaxException e) {
            LOG.error("Unable to convert to URI:" + newfileName);
        }

        MoveMethod move = new MoveMethod(getResourceUrl(originalFileRelPath), newUrl, overwrite);
        if (!executeMethod(move)) {
            // handle error
            LOG.error("Unable to move:" + originalFileRelPath + " based on url -- " +newUrl+" -- "+ move.getStatusText());
            return WsUtil.error(move.getStatusCode(), move.getStatusLine().getReasonPhrase());
        }
        return WsUtil.success(move.getStatusCode(), move.getStatusText(), newUrl);
    }

    public WspaceMeta getMeta(String relPath) {
        return getMeta(relPath, WspaceMeta.Includes.ALL);
    }

    public WspaceMeta getMeta(String relPath, WspaceMeta.Includes includes) {

        // this can be optimized by retrieving only the props we care for.
        DavMethod pFind = null;
        try {
            if (includes.inclProps) {
                pFind = new PropFindMethod(getResourceUrl(relPath), DavConstants.PROPFIND_ALL_PROP, includes.depth);
            } else {
                pFind = new PropFindMethod(getResourceUrl(relPath), DavConstants.PROPFIND_BY_PROPERTY, includes.depth);
            }

            if (!executeMethod(pFind, false)) {
                // handle error
                if (pFind.getStatusCode() != 404) {
                    LOG.error("Unable to find property:" + relPath + " -- " + pFind.getStatusText());
                }
                return null;
            }

            MultiStatus multiStatus = pFind.getResponseBodyAsMultiStatus();
            MultiStatusResponse[] resps = multiStatus.getResponses();
            if (resps == null || resps.length == 0) {
                return null;
            }
            WspaceMeta root = new WspaceMeta(getWsHome(), relPath);

            for (MultiStatusResponse res : resps) {
                if (res.getHref().equals(WsUtil.encode(root.getAbsPath()))) {
                    convertToWspaceMeta(root, res);
                } else {
                    addToRoot(root, res);
                }
            }
            return root;
        } catch (Exception e) {
            LOG.error(e, "Error while getting meta for:" + relPath);
        } finally {
            if (pFind != null) {
                pFind.releaseConnection();
            }
        }
        return null;
    }

    /**
     * convenience method to create meta for a local file in the workspace
     *
     * @param file
     * @param propName
     * @param value
     * @return
     */
    public WspaceMeta newLocalWsMeta(File file, String propName, String value) {
        WspaceMeta meta = new WspaceMeta(getWsHome(), getRelPath(file));
        meta.setProperty(propName, value);
        return meta;
    }

    /**
     * convenience method to set one property on a resource.
     * if the property value is null, that property will be removed.
     * otherwise, the property will be either added or updated.
     *
     * @param relPath
     * @param propName
     * @param value
     * @return
     */
    public boolean setMeta(String relPath, String propName, String value) {
        WspaceMeta meta = new WspaceMeta(null, relPath);
        meta.setProperty(propName, value);
        return setMeta(meta);
    }

    /**
     * set meta information on this dav's resource.
     * if the property value is null, that property will be removed.
     * otherwise, the property will be either added or updated.
     *
     * @param metas
     * @return
     */
    public boolean setMeta(WspaceMeta... metas) {
        if (metas == null) return false;
        for (WspaceMeta meta : metas) {

            Map<String, String> props = meta.getProperties();
            if (props != null && props.size() > 0) {
                DavPropertySet newProps = new DavPropertySet();
                DavPropertyNameSet removeProps = new DavPropertyNameSet();

                for (String key : props.keySet()) {
                    String v = props.get(key);
                    if (v == null) {
                        removeProps.add(DavPropertyName.create(key, IRSA_NS));
                    } else {
                        DavProperty p = new DefaultDavProperty(key, props.get(key), IRSA_NS);
                        newProps.add(p);
                    }
                }
                try {
                    PropPatchMethod proPatch = new PropPatchMethod(getResourceUrl(meta.getRelPath()), newProps, removeProps);
                    if (!executeMethod(proPatch)) {
                        // handle error
                        LOG.error("Unable to update property:" + newProps.toString() + " -- " + proPatch.getStatusText());
                        return false;
                    }
                    return true;
                } catch (IOException e) {
                    LOG.error(e, "Error while setting property: " + meta);
                    e.printStackTrace();
                }

            }

        }
        return false;
    }

//====================================================================
//
//====================================================================

    private WspaceMeta convertToWspaceMeta(WspaceMeta meta, MultiStatusResponse res) throws UnsupportedEncodingException {
        if (meta == null) {
            meta = new WspaceMeta(getWsHome(), URLDecoder.decode(res.getHref().replaceFirst(getWsHome(), ""),"UTF-8"));
        }
        if (res.getHref() != null) {
            meta.setUrl(WS_HOST_URL + res.getHref());
        }
        DavPropertySet props = res.getProperties(200);
        if (props != null) {
            for (DavProperty p : props) {
                String name = (p == null || p.getName() == null) ? null : p.getName().getName();
                if (name != null) {
                    String v = String.valueOf(p.getValue());
                    if (name.equals(DavConstants.PROPERTY_GETLASTMODIFIED)) {
                        meta.setLastModified(v);
                    } else if (name.equals(DavConstants.PROPERTY_GETCONTENTLENGTH)) {
                        long size = Long.parseLong(v);
                        meta.setSize(size);
                        meta.setIsFile(true); // WEBDAV/IRSA only set cvontent length for files. (?)TODO: is it WEBDav general behaviour?
                    } else if (name.equals(DavConstants.PROPERTY_GETCONTENTTYPE)) {
                        meta.setContentType(v);
                    } else if (p.getName().getNamespace().equals(IRSA_NS)) {
                        meta.setProperty(name, String.valueOf(p.getValue()));
                    } else if (name.equals(DavConstants.PROPERTY_CREATIONDATE)) {
                        meta.setCreationDate(v);
                    }
                }
            }
        }
        return meta;
    }

    private void addToRoot(WspaceMeta root, MultiStatusResponse res) throws UnsupportedEncodingException {
        WspaceMeta meta = convertToWspaceMeta(null, res);
        WspaceMeta p = root.find(meta.getParentPath());
        if (p != null) {
            p.addChild(meta);
        } else {
            root.addChild(meta);
        }
    }

    private boolean executeMethod(DavMethod method) {
        return executeMethod(method, true);
    }

    private boolean executeMethod(DavMethod method, boolean releaseConnection) {
        try {
            return partition.equals(Partition.PUBSPACE) ? HttpServices.executeMethod(method) :
                    HttpServices.executeMethod(method, getCredentials().getWsId(), getCredentials().getPassword(), getCredentials().getCookies());
        } finally {
            if (releaseConnection && method != null) {
                method.releaseConnection();
            }
        }


    }

    public static void main(String[] args) {
        WebDAVWorkspaceManager man = null;
//        man = (WebDAVWorkspaceManager) ServerContext.getRequestOwner().getWsManager();

        man = new WebDAVWorkspaceManager("ejoliet-tmp2");

        simpleTest(man);

//        AppProperties.setProperty("sso.server.url", "http://irsa.ipac.caltech.edu/account/");
//        String session = JOSSOAdapter.createSession("", "");
//        Map<String, String> cookies = new HashMap<String, String>();
//        cookies.put(WebAuthModule.AUTH_KEY, session);
//        WorkspaceManager man = new WorkspaceManager("<someuser>@ipac.caltech.edu", cookies);
//        simpleTest(man);
    }

    private static void simpleTest(WebDAVWorkspaceManager man) {
        String relPath = "124/";
        File f = man.davMakeDir(relPath);
        System.out.println("new directory: " + String.valueOf(f));

        WspaceMeta m = new WspaceMeta(null, relPath);
        m.setProperty("test1", "an awesome idea");
        m.setProperty("test", null);
        man.setMeta(m);

        String ufilePath = relPath + "gaia-binary.vot";
        WsResponse wsResponse = man.davPut(new File("/Users/ejoliet/devspace/branch/dev/firefly_test_data/edu/caltech/ipac/firefly/ws/gaia-binary.vot"),
                                           ufilePath, false, null);

        System.out.println(wsResponse);

        WspaceMeta meta = new WspaceMeta(null, ufilePath);
        meta.setProperty("added_by", man.userHome);
        man.setMeta(meta);
        man.setMeta(ufilePath, "added_by", man.userHome);

        WspaceMeta meta2 = man.getMeta("/", WspaceMeta.Includes.ALL_PROPS);
        System.out.println(meta2.getNodesAsString());
    }

    public WsResponse getResponse(String relPath){
        DavMethod pFind = null;
        try {
            pFind = new PropFindMethod(getResourceUrl(relPath), DavConstants.PROPFIND_BY_PROPERTY, WspaceMeta.Includes.ALL_PROPS.depth);


            if (!executeMethod(pFind, false)) {
                // handle error
                if (pFind.succeeded()){// != 404) {
                    LOG.error("Unable to get property:" + relPath + " -- " + pFind.getStatusText());
                }
                return WsUtil.error(pFind.getStatusCode(), pFind.getStatusText());
            }
            return WsUtil.success(pFind.getStatusCode(), pFind.getStatusText(), pFind.getPath());
        } catch (Exception e) {
            LOG.error(e, "Error while getting meta for:" + relPath);
        } finally {
            if (pFind != null) {
                pFind.releaseConnection();
            }
        }
        return new WsResponse();
    }

    class WebDAVGetMethod extends DavMethodBase {
        public WebDAVGetMethod(String uri) {
            super(uri);
        }

        public String getName() {
            return DavMethods.METHOD_GET;
        }

        public boolean isSuccess(int statusCode) {
            return statusCode == 200;
        }
    }

    class WebDAVDeleteMethod extends DavMethodBase {
        public WebDAVDeleteMethod(String uri) {
            super(uri);
        }

        public String getName() {
            return DavMethods.METHOD_DELETE;
        }

        public boolean isSuccess(int statusCode) {
            return statusCode == 200;
        }
    }
}
