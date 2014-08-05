package edu.caltech.ipac.firefly.visualize.ui;
/**
 * User: roby
 * Date: 7/28/14
 * Time: 2:39 PM
 */


import com.google.gwt.user.client.Timer;
import com.google.gwt.user.client.rpc.AsyncCallback;
import com.google.gwt.user.client.ui.Grid;
import com.google.gwt.user.client.ui.RequiresResize;
import com.google.gwt.user.client.ui.SimpleLayoutPanel;
import com.google.gwt.user.client.ui.Widget;
import edu.caltech.ipac.firefly.core.Application;
import edu.caltech.ipac.firefly.ui.GwtUtil;
import edu.caltech.ipac.firefly.ui.table.EventHub;
import edu.caltech.ipac.firefly.util.Dimension;
import edu.caltech.ipac.firefly.visualize.AllPlots;
import edu.caltech.ipac.firefly.visualize.MiniPlotWidget;
import edu.caltech.ipac.firefly.visualize.PlotWidgetOps;
import edu.caltech.ipac.firefly.visualize.Vis;
import edu.caltech.ipac.firefly.visualize.WebPlot;
import edu.caltech.ipac.firefly.visualize.WebPlotRequest;
import edu.caltech.ipac.firefly.visualize.ZoomType;
import edu.caltech.ipac.firefly.visualize.graph.CustomMetaSource;
import edu.caltech.ipac.firefly.visualize.graph.XYPlotMeta;
import edu.caltech.ipac.firefly.visualize.graph.XYPlotWidget;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * @author Trey Roby
 */
public class DataVisGrid {

    private static final String ID= "MpwID";
    private static final int GRID_RESIZE_DELAY= 500;
    private static int groupNum=0;
    private static final String GROUP_NAME= "DataVisGrid-";
    private Map<String,MiniPlotWidget> mpwMap;
    private List<XYPlotWidget> xyList;
    private MyGridLayoutPanel grid= new MyGridLayoutPanel();
    private SimpleLayoutPanel panel = new SimpleLayoutPanel();
    private Map<String,WebPlotRequest> currReqMap= Collections.emptyMap();
    private int plottingCnt;


    public DataVisGrid(List<String> plotViewerIDList, int xyPlotCount, Map<String,List<String>> viewToLayerMap ) {
        mpwMap= new HashMap<String, MiniPlotWidget>(plotViewerIDList.size()+7);
        xyList= new ArrayList<XYPlotWidget>(xyPlotCount);
        panel.add(grid);
        for(String id : plotViewerIDList) {
            final MiniPlotWidget mpw=makeMpw(GROUP_NAME+groupNum, id, viewToLayerMap);
            mpwMap.put(id,mpw);
        }
        for(int i=0; (i<xyPlotCount); i++) {
            XYPlotMeta meta = new XYPlotMeta("none", 800, 200, new CustomMetaSource(new HashMap<String, String>()));
            XYPlotWidget xy= new XYPlotWidget(meta);
            xy.setTitleAreaAlwaysHidden(true);
            xyList.add(xy);
        }
        init();
        groupNum++;
    }


    public void setActive(boolean active) {
        for (MiniPlotWidget mpw : mpwMap.values())  {
            mpw.setActive(active);
            if (active)  {
                mpw.notifyWidgetShowing();
                mpw.recallScrollPos();
            }
        }
    }

    private MiniPlotWidget makeMpw(String groupName, final String id, final Map<String,List<String>> viewToLayerMap) {
        final EventHub hub= Application.getInstance().getEventHub();
        final MiniPlotWidget mpw=new MiniPlotWidget(groupName);
        Vis.init(mpw, new Vis.InitComplete() {
            public void done() {
                List<String> idList= viewToLayerMap!=null ? viewToLayerMap.get(id) : null;
                mpw.getPlotView().setAttribute(ID,id);
                hub.getCatalogDisplay().addPlotView(mpw.getPlotView());
                if (idList!=null) hub.getDataConnectionDisplay().addPlotView(mpw.getPlotView(),idList);
            }
        });
        return mpw;
    }

    public void cleanup() {
        for (MiniPlotWidget mpw : mpwMap.values()) {
            mpw.freeResources();
        }
        for (XYPlotWidget xy : xyList) {
            xy.freeResources();
        }
        mpwMap.clear();
        xyList.clear();
        grid.clear();
    }

    public SimpleLayoutPanel getWidget() { return panel; }

    public void load(final Map<String,WebPlotRequest> reqMap,  final AsyncCallback<String> allDoneCB) {
        plottingCnt= 0;
        for(Map.Entry<String,MiniPlotWidget> entry : mpwMap.entrySet()){
            final String key= entry.getKey();
            final MiniPlotWidget mpw= entry.getValue();
            boolean visible= reqMap.containsKey(key);
            mpw.setVisible(visible);
            if (visible && !reqMap.get(key).equals(currReqMap.get(key))) {
                plottingCnt++;
                mpw.getOps(new MiniPlotWidget.OpsAsync() {
                    public void ops(PlotWidgetOps widgetOps) {


                        WebPlotRequest req= reqMap.get(key);

                        if (req.getZoomType()== ZoomType.TO_WIDTH  ) {
                            if (mpw.getOffsetWidth()>50)  req.setZoomToWidth(mpw.getOffsetWidth());
                            else  req.setZoomType(ZoomType.SMART);
                        }

                        widgetOps.plot(req, false, new AsyncCallback<WebPlot>() {
                            public void onFailure(Throwable caught) {
                                plottingCnt--;
                                completePlotting(allDoneCB);
                            }

                            public void onSuccess(WebPlot result) {
                                mpw.getGroup().setLockRelated(true);
                                plottingCnt--;
                                completePlotting(allDoneCB);
                            }
                        });
                    }
                });
            }
        }
        currReqMap= reqMap;
    }

    void completePlotting(AsyncCallback<String> allDoneCB) {
        if (plottingCnt==0) {
            allDoneCB.onSuccess("OK");
        }
    }

    void init() {
        int size = mpwMap.size() + xyList.size();
        if (size > 1) {
            int rows = 1;
            int cols = 1;
            if (size >= 7) {
                rows = size / 4 + (size % 4);
                cols = 4;
            } else if (size == 5 || size == 6) {
                rows = 2;
                cols = 3;
            } else if (size == 4) {
                rows = 2;
                cols = 2;
            } else if (size == 3) {
                rows = 1;
                cols = 3;
            } else if (size == 2) {
                rows = 1;
                cols = 2;
            }
            int w = panel.getOffsetWidth() / cols;
            int h = panel.getOffsetHeight() / rows;

            grid.resize(rows, cols);
            grid.setCellPadding(2);

            int col = 0;
            int row = 0;
            for (MiniPlotWidget mpw : mpwMap.values()) {
                grid.setWidget(row, col, mpw);
                mpw.setPixelSize(w, h);
                mpw.onResize();
                col = (col < cols - 1) ? col + 1 : 0;
                if (col == 0) row++;
            }

            for (XYPlotWidget xy : xyList) {
                grid.setWidget(row, col, xy);
                xy.setPixelSize(w, h);
                xy.onResize();
                col = (col < cols - 1) ? col + 1 : 0;
                if (col == 0) row++;
            }
            AllPlots.getInstance().updateUISelectedLook();
        }
    }

    public Dimension getGridDimension() {
        final int margin = 4;
        final int panelMargin =14;
        Widget p= grid.getParent();
        if (!GwtUtil.isOnDisplay(p)) return null;
        int rows= grid.getRowCount();
        int cols= grid.getColumnCount();
        int w= (p.getOffsetWidth() -panelMargin)/cols -margin;
        int h= (p.getOffsetHeight()-panelMargin)/rows -margin;
        return new Dimension(w,h);
    }

    class MyGridLayoutPanel extends Grid implements RequiresResize {
        private GridResizeTimer _gridResizeTimer= new GridResizeTimer();
        public void onResize() {
            Dimension dim= getGridDimension();
            if (dim==null) return;
            int w= dim.getWidth();
            int h= dim.getHeight();
            this.setPixelSize(w,h);
            for (MiniPlotWidget mpw : mpwMap.values()) {
                mpw.setPixelSize(w, h);
                mpw.onResize();
            }
            for (XYPlotWidget xy : xyList) {
                xy.setPixelSize(w, h);
                xy.onResize();
            }
            _gridResizeTimer.cancel();
            _gridResizeTimer.setupCall(w,h, true);
            _gridResizeTimer.schedule(GRID_RESIZE_DELAY);
        }
    }

    private class GridResizeTimer extends Timer {
        private int w= 0;
        private int h= 0;
        private boolean adjustZoom;

        public void setupCall(int w, int h, boolean adjustZoom) {
            this.w= w;
            this.h= h;
            this.adjustZoom = adjustZoom;
        }

        @Override
        public void run() {
            //todo: should I adjust zoom?
//            _behavior.onGridResize(_expandedList, new Dimension(w,h), adjustZoom);
        }
    }
}

/*
 * THIS SOFTWARE AND ANY RELATED MATERIALS WERE CREATED BY THE CALIFORNIA 
 * INSTITUTE OF TECHNOLOGY (CALTECH) UNDER A U.S. GOVERNMENT CONTRACT WITH 
 * THE NATIONAL AERONAUTICS AND SPACE ADMINISTRATION (NASA). THE SOFTWARE 
 * IS TECHNOLOGY AND SOFTWARE PUBLICLY AVAILABLE UNDER U.S. EXPORT LAWS 
 * AND IS PROVIDED AS-IS TO THE RECIPIENT WITHOUT WARRANTY OF ANY KIND, 
 * INCLUDING ANY WARRANTIES OF PERFORMANCE OR MERCHANTABILITY OR FITNESS FOR 
 * A PARTICULAR USE OR PURPOSE (AS SET FORTH IN UNITED STATES UCC 2312- 2313) 
 * OR FOR ANY PURPOSE WHATSOEVER, FOR THE SOFTWARE AND RELATED MATERIALS, 
 * HOWEVER USED.
 * 
 * IN NO EVENT SHALL CALTECH, ITS JET PROPULSION LABORATORY, OR NASA BE LIABLE 
 * FOR ANY DAMAGES AND/OR COSTS, INCLUDING, BUT NOT LIMITED TO, INCIDENTAL 
 * OR CONSEQUENTIAL DAMAGES OF ANY KIND, INCLUDING ECONOMIC DAMAGE OR INJURY TO 
 * PROPERTY AND LOST PROFITS, REGARDLESS OF WHETHER CALTECH, JPL, OR NASA BE 
 * ADVISED, HAVE REASON TO KNOW, OR, IN FACT, SHALL KNOW OF THE POSSIBILITY.
 * 
 * RECIPIENT BEARS ALL RISK RELATING TO QUALITY AND PERFORMANCE OF THE SOFTWARE 
 * AND ANY RELATED MATERIALS, AND AGREES TO INDEMNIFY CALTECH AND NASA FOR 
 * ALL THIRD-PARTY CLAIMS RESULTING FROM THE ACTIONS OF RECIPIENT IN THE USE 
 * OF THE SOFTWARE. 
 */