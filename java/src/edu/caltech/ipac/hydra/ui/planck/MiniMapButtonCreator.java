package edu.caltech.ipac.hydra.ui.planck;

import com.google.gwt.event.dom.client.ClickEvent;
import com.google.gwt.event.dom.client.ClickHandler;
import com.google.gwt.user.client.ui.Button;
import com.google.gwt.user.client.ui.FocusWidget;
import com.google.gwt.user.client.ui.HTML;
import edu.caltech.ipac.firefly.core.BaseCallback;
import edu.caltech.ipac.firefly.data.NewTabInfo;
import edu.caltech.ipac.firefly.data.ReqConst;
import edu.caltech.ipac.firefly.data.ServerRequest;
import edu.caltech.ipac.firefly.data.table.TableData;
import edu.caltech.ipac.firefly.data.table.TableDataView;
import edu.caltech.ipac.firefly.ui.BaseDialog;
import edu.caltech.ipac.firefly.ui.ButtonType;
import edu.caltech.ipac.firefly.ui.GwtUtil;
import edu.caltech.ipac.firefly.ui.creator.eventworker.BaseTableButtonSetter;
import edu.caltech.ipac.firefly.ui.creator.eventworker.EventWorker;
import edu.caltech.ipac.firefly.ui.creator.eventworker.EventWorkerCreator;
import edu.caltech.ipac.firefly.ui.table.TablePanel;
import edu.caltech.ipac.firefly.util.PropertyChangeEvent;
import edu.caltech.ipac.firefly.util.PropertyChangeListener;
import edu.caltech.ipac.firefly.util.event.Name;
import edu.caltech.ipac.firefly.util.event.WebEvent;
import edu.caltech.ipac.firefly.util.event.WebEventManager;
import edu.caltech.ipac.firefly.visualize.*;
import edu.caltech.ipac.util.StringUtils;
import edu.caltech.ipac.visualize.plot.WorldPt;

import java.util.Map;

/**
 */
public class MiniMapButtonCreator implements EventWorkerCreator {
    public static final String ID = "PlanckMiniMap";
    public EventWorker create(Map<String, String> params) {
        MiniMapButtonSetter worker = new MiniMapButtonSetter();
        worker.setQuerySources(StringUtils.asList(params.get(EventWorker.QUERY_SOURCE), ","));
        if (params.containsKey(EventWorker.ID)) worker.setID(params.get(EventWorker.ID));

        return worker;
    }

    public static class MiniMapButtonSetter extends BaseTableButtonSetter {
        private TableDataView dataset;
        private TablePanel tablePanel;
        private BaseDialog dialog;

        public MiniMapButtonSetter() {
            super(ID);
        }

        protected FocusWidget makeButton(final TablePanel table) {
            tablePanel = table;

            final Button button = GwtUtil.makeButton("MiniMap Gen", "Generate Minimap Image", new ClickHandler() {
                @Override
                public void onClick(ClickEvent clickEvent) {
                    if (dialog == null) {
                        dialog= new BaseDialog(table, ButtonType.OK_CANCEL,"Mini-Map generation",true,null) {
                            protected void inputComplete() {
                                dialog.setVisible(false);
                                generateMiniMap();
                            }
                            protected void inputCanceled() {
                                dialog.setVisible(false);
                            }
                        };
                    }
                    final HTML content = new HTML("You selected the follow data...<br><br>");
                    //final HTML content = FormBuilder.createPanel();
                    content.setHTML(content.getHTML() + "<br>" + "Selected time : <br");

                    //get all the rows.. then find the selected.
                    table.getDataModel().getAdHocData(new BaseCallback<TableDataView>() {
                    public void doSuccess(TableDataView result) {
                        for (int i : table.getDataset().getSelected()) {
                            TableData.Row row = result.getModel().getRow(i);
                            content.setHTML(content.getHTML() + " " + i + " - " + StringUtils.toString(row.getValues().values())+ ";");
                        }
                    }
                    }, null, null);
                    content.setSize("600px", "300px");
                    dialog.setWidget(content);
                    dialog.show();
                }
            });
            dataset = table.getDataset();


            button.setEnabled(checkSelection());
            dataset.addPropertyChangeListener(new PropertyChangeListener() {
                public void propertyChange(PropertyChangeEvent pce) {
                    button.setEnabled(checkSelection());
                }
            });

            return button;
        }

        private void generateMiniMap() {
            //set condition if minimap or hires
            NewTabInfo newTabInfo = new NewTabInfo("MiniMap");
            MiniPlotWidget mpw = makeImagePlot(newTabInfo);
            newTabInfo.setDisplay(mpw);
            WebEventManager.getAppEvManager().fireEvent(new WebEvent(this, Name.NEW_TABLE_RETRIEVED, newTabInfo));
        }

        private MiniPlotWidget makeImagePlot(final NewTabInfo newTabInfo) {
            final MiniPlotWidget mpw = new MiniPlotWidget(newTabInfo.getName());
            GwtUtil.setStyles(mpw, "fontFamily", "tahoma,arial,helvetica,sans-serif",
                    "fontSize", "11px");
            mpw.setRemoveOldPlot(true);
            mpw.setMinSize(200, 200);
            mpw.setAutoTearDown(false);
            mpw.setLockImage(false);
            mpw.setInlineTitleAlwaysOnIfCollapsed(true);
            mpw.addStyleName("standard-border");
            mpw.getOps(new MiniPlotWidget.OpsAsync() {
                public void ops(PlotWidgetOps widgetOps) {
                    ServerRequest sreq =  tablePanel.getDataModel().getRequest();
                    String baseUrl = sreq.getSafeParam("toiminimapHost");
                    String Freq = sreq.getSafeParam("planckfreq");
                    String detector = sreq.getParam("detector");
                    String ExpandedDesc,desc;

                    WorldPt pt;
                    String pos = null;
                    String userTargetWorldPt = sreq.getParam(ReqConst.USER_TARGET_WORLD_PT);
                    if (userTargetWorldPt != null) {
                        pt = WorldPt.parse(userTargetWorldPt);
                        if (pt != null) {
                            pt = VisUtil.convertToJ2000(pt);
                            //pt = VisUtil.convert(pt, CoordinateSys.GALACTIC);
                            pos = pt.getLon() + "," + pt.getLat();
                        }
                    }

                    String optBand = Freq;
                    if (!StringUtils.isEmpty(Freq)) {
                        if (Freq.equals("030")) {
                            optBand="30000";}
                        else if (Freq.equals("044")) {
                            optBand="30000";}
                        else if (Freq.equals("070")) {
                            optBand="70000";}
                    }

                    String timeSelt  = "";
                    for (int i : tablePanel.getDataset().getSelected()) {
                        TableData.Row row = tablePanel.getDataset().getModel().getRow(i);
                        timeSelt += row.getValue("rmjd") +",";
                    }

                    String timeStrArr[] = timeSelt.split(",");
                    String timeStr = "[";
                    for (int j = 0; j<timeStrArr.length; j++){
                        double t1, t2;
                        double t = Double.parseDouble(timeStrArr[j]);
                        t1 = t-0.5;
                        t2 = t+0.5;
                        if (j != timeStrArr.length-1){
                            timeStr += "["+ Double.toString(t1)+"," + Double.toString(t2)+"],";
                        }
                        else {
                            timeStr += "["+ Double.toString(t1)+"," + Double.toString(t2)+"]";

                        }
                    }
                    timeStr +="]";


                    //tablePanel.getDataModel().getAdHocData();
                    //String baseUrl = PlanckTOITAPFileRetrieve.getBaseURL(sreq);
                    String detectors[] = sreq.getParam(detector).split(",");
                    String detc_constr;

                    if (detectors[0].equals("_all_")){
                        detc_constr ="";
                    } else {
                        detc_constr = "['"+detectors[0]+"'";
                        for(int j = 1; j < detectors.length; j++){
                            detc_constr += ",'"+detectors[j]+"'";
                        }
                        detc_constr +="]";
                    }

                    String interations = "0";


                    ServerRequest req = new ServerRequest("planckTOIMinimapRetrieve", sreq);

                    // add all of the params here.. so it can be sent to server.

                    req.setParam("pos", pos);
                    req.setParam("detc_constr", detc_constr);
                    req.setParam("optBand", optBand);
                    req.setParam("baseUrl", baseUrl);
                    req.setParam("timeStr",timeStr);
                    req.setParam("iterations", interations);
                    desc = detc_constr + timeSelt;
                    ExpandedDesc = "MiniMap"+desc;

                    // add all of the params here.. so it can be sent to server.
                    WebPlotRequest wpr = WebPlotRequest.makeProcessorRequest(req, ExpandedDesc);
                    wpr.setInitialZoomLevel(10);
                    wpr.setExpandedTitle(ExpandedDesc);
                    wpr.setHideTitleDetail(true);
                    wpr.setTitle(desc);

                    //wpr.setWorldPt(pt);
                    //wpr.setSizeInDeg(size);
                    //wpr.setZoomType(ZoomType.TO_WIDTH);
                    //wpr.setZoomToWidth(width);
                    wpr.setHasMaxZoomLevel(false);

                    widgetOps.plot(wpr, false, new BaseCallback<WebPlot>() {
                        public void doSuccess(WebPlot result) {
                            newTabInfo.ready();
                        }
                    });
                }
            });
            return mpw;
        }

        private boolean checkSelection() {
            return dataset != null && dataset.getSelectionInfo().getSelectedCount() > 0;
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