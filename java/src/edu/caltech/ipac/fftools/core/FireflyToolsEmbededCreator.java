package edu.caltech.ipac.fftools.core;

import com.google.gwt.user.client.ui.Image;
import edu.caltech.ipac.firefly.core.AlertManager;
import edu.caltech.ipac.firefly.core.Creator;
import edu.caltech.ipac.firefly.core.DefaultCreator;
import edu.caltech.ipac.firefly.core.DefaultRequestHandler;
import edu.caltech.ipac.firefly.core.LoginManager;
import edu.caltech.ipac.firefly.core.RequestHandler;
import edu.caltech.ipac.firefly.core.layout.LayoutManager;
import edu.caltech.ipac.firefly.ui.ServerTask;
import edu.caltech.ipac.firefly.ui.panels.Toolbar;

import java.util.Map;

public class FireflyToolsEmbededCreator implements Creator {


    public FireflyToolsEmbededCreator() {
    }


    public Image getMissionIcon() {
        return null;
    }

    public LayoutManager makeLayoutManager() { return null; }

    public boolean isApplication() { return false; }



    public Toolbar getToolBar() { return null; }
    public Map makeCommandTable() { return null; }
    public RequestHandler makeCommandHandler() { return new DefaultRequestHandler(); }
    public LoginManager makeLoginManager() { return null; }
    public String getLoadingDiv() { return null; }
    public String getAppDesc() { return null; }


    public String getAppName() { return "fftools"; }

    public AlertManager makeAlertManager() { return null; }

    public ServerTask[] getCreatorInitTask() { return DefaultCreator.getDefaultCreatorInitTask(); }
}