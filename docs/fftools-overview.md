


# JavaScript Firefly Tools API

Firefly tools is an API that can me use from JavaScript. It allows you to user the main components of Firefly via an API. The following components are available.

 - Fits Visualizer
 - Table
 - XY Plotter
 
Beyond that some of the components can be setup to share the same data model.  Therefore you can do the following combinations.
 
 - A table with a fits viewer coverage plot
 - A table that has a list of fits file metadata and a fits viewer showing the fits file from the highlighted row.
 - A Table with any data and a XY Plot showing plots from any two columns of that table.
 - A Table, fits coverage, and XY Plot together showing the same data.
  
Firefly tools also allows you to get expand certain components and get events back with certain actions happen.

 - You can add context menus for when a user selects a box, line, circle, highlights a point.
 - You can get events from these context menus.
 - You can get events from any overlay data plotted on the FITS Viewer.
 


##Fits Visualization

The following methods are available to create a fits image viewer.  A FITS `ImageViewer` is created or referenced by calling the
following

 - `firefly.makeImageViewer()`  - make a inline image viewer for a html document
 - `firefly.getExpandViewer()`  - makes a image viewer that will popup in the html document.
 - `firefly.getExternalViewer()` - gives a handle to launch the firefly tools web applications with a specified fits file.


###Inline Image Viewer

The following methods and objects available on `firefly` object to create an fits image viewer.
    `firefly.makeImageViewer(div,group)` - Create a new ImageViewer object in the specified div.
    parameters:
    
| Parameter  | Description |
| ---------- | ----------- |
| `div` | The div to put the ImageViewer in. |
| `group` (optional) | The plot group to associate this image viewer. All ImageViewers with the same group name will  operate together for zooming, color, etc. |
| *return*  | an ImageViewer object |



The following is a list of possible params for the ImageViewer plotting. Almost all parameters are optional.
    Note that the request `Type` parameter can
    be set specifically or it is implied from the `File`, `URL` or `Service` parameters which are mutually exclusive.


 *Parameters For FITS Image Viewer*
 
 - **Type**: Set the type of request. Based on the Type then 1 or more other parameters are required.
Options are:
    - `SERVICE`, for a image service
    - `FILE` for file on the server
    - `URL` for any url accessible fits file
    - `TRY_FILE_THEN_URL` try a file on the server first then try the url
    - `BLANK` make a blank image
    - `ALL_SKY`

 - **File**: File name of a file on the server. Required if Type==FILE or if you want to plot a file on the server.
 - **URL**: Retrieve and plot the file from the specified URL. Required if Type==URL or if you want to plot a URL.
 The url can be absolute or relative. If it is relative then one of two things happen.
    - The url is made absolute based on the host web page url. 
    - The url is made absolute based on the root path set in the method `firefly.setRootPath(path)` 
       
 - **Service**
    - Available services are: IRIS, ISSA, DSS, SDSS, TWOMASS, MSX, DSS_OR_IRIS, WISE.
Required if Type=SERVICE or if you want to use a service
 - **WorldPt**:  This is target for service request for `Type===SERVICE`.
    - WorldPt uses the format "12.33;45.66;EQ_J2000" for j2000.
    - The general syntax is `lon;lat;coordinate_sys`, e.g. `'12.2;33.4;EQ_J2000'` or `'11.1;22.2;GALACTIC'`
    - coordinate system can be: `'EQ_J2000'`, `'EQ_B1950'`, `'EC_J2000'`, `'EC_B1950'`, `'GALACTIC'`, or `'SUPERGALACTIC'`;
    
 - **SizeInDeg**  The radius or side (in degrees) depending of the service type, used with `Type===SERVICE`
 -  **SurveyKey**:  Required if `Type==='SERVICE'`
The value of SurveyKey depends on the value of "Service".
The following are possible values for SurveyKey.<br>If service is:
        
    - IRIS: 12, 25, 60, or 100
    - ISSA: 12, 25, 60, or 100
    - DSS: poss2ukstu_red, poss2ukstu_ir, poss2ukstu_blue, poss1_red, poss1_blue, quickv, phase2_gsc2, or phase2_gsc1
    - SDSS: u, g, r, i, or z
    - TWOMASS: j, h, or k
    - MSX: 3, 4, 5, or 6
    - WISE: 1b or 3a
    </td>
 - **SurveyKeyBand**: So far only used with `'Type===SERVICE'` and `'SurveyKey===WISE`'. Possible values are: 1, 2, 3, 4
 - **ZoomType**:  Sets the zoom type, based on the ZoomType other zoom set methods may be required
Notes for ZoomType:
    - STANDARD - default, when set you may optionally define `'InitZoomLevel'` or the zoom will default to be 1x
    - TO_WIDTH - you must define <code>ZoomToWidth</code> and set a pixel width</li>
    - FULL_SCREEN - you must define <code>ZoomToWidth</code> with a width and `'ZoomToHeight'` with a height
    - ARCSEC_PER_SCREEN_PIX - you must define <code>ZoomArcsecPerScreenPix</code></li>
 - **TitleOptions**:  Set others ways to title the plot. Options for title:
    - NONE - The default, use the value set in <code>Title</code>, if this is empty use the plot description that come from the server
    - PLOT_DESC - Use the plot description set by the server. This is meaningful when the server is using a service, otherwise it will be an empty string. <i>example-</i> 2mass or IRIS
    - FILE_NAME - Use the name of the fits file. This is useful when plotting a upload file name or a URL.
    - HEADER_KEY - Use the value of a fits header name key.  This parameter <code>HeaderForKeyTitle</code> must be set to the card name.
    - PLOT_DESC_PLUS - Use the server plot description but append some string to it.  The string is set in `'PlotDescAppend'`
 - **InitZoomLevel**: The level to zoom the image to. Used with ZoomType==STANDARD (which is the default). Example
        .5,2,8,.125
 - **Title**: Title of the plot
 - **PostTitle**: A String to append at the end of the title of the plot. This parameter is useful if you are
    using one of the computed <code>TitleOpions</code> such as <code>FILE_NAME</code> or <code>HEADER_KEY</code></td>
 - **PreTitle**: A String to append at the beginning of the title of the plot. This parameter is useful if you are
        using one of the computed <code>TitleOptions</code> such as <code>FILE_NAME</code> or <code>HEADER_KEY</code></td>
 - **TitleFilenameModePfx**: A String to replace the default "from" when <code>TitleMode</code> is <code>FILE_NAME</code>, and the mode is <code>URL</code>.
    If the url contains a fits file name and there are more options then the firefly viewer added a "from" to the front of the title.
    This parameter allows that string to be changed to something such as "cutout".
 - **PlotDescAppend**: A string to apppend to the end of the plot description set by the server.  This will be
    used as the plot title if the <code>TitleOptions</code> parameter is set to <code>PlotDescAppend</code>. </td>
 - **RotateNorth**: Plot should come up rotated north, should be "true" to rotate north</td>
 - **RotateNorthType**: coordinate system to rotate north on, options: EQ_J2000, EQ_B1950, EC_J2000, EC_B1950,
        GALACTIC, or SUPERGALACTIC"
 - **Rotate**: set to rotate, if "true", the angle should also be set</td>
 - **RotationAngle**: the angle to rotate to, use with "Rotate"</td>
 - **FlipY**: Flip this image on the Y axis</td>
 - **HeaderKeyForTitle**: Use the value of a specified header for the title of the plot, use with multi image fits files
 - **RangeValues**: A complex string for specify the stretch of this plot. Use the method
        firefly.serializeRangeValues() to produce this string
 - **ColorTable**: value 0 - 21 to represent different predefine color tables</td>
 - **ZoomToWidth**: used with "ZoomType==TO_WIDTH" or "ZoomType==FULL_SCREEN", this is the width in pixels</td>
 - **ZoomToHeight**: used with "ZoomType==FULL_SCREEN", this is the height in pixels</td>
 - **PostCrop**: Crop and center the image before returning it. If rotation is set then the crop will happens post rotation.
Note: `SizeInDeg` and `WorldPt` are required to do `PostCropAndCenter`
 - **CropPt1**: One corner of the rectangle, in image coordinates, to crop out of the image, used with CropPt2 CropPt1 and CropPt2 are diagonal of each other
Syntax is "x;y" example: 12;1.5
 - **CropPt2**: Second corner of the rectangle, in image coordinates, to crop out of the image, used with `'CropPt1'`
`CropPt1` and `CropPt2` are diagonal of each other
Syntax is "x;y" example: 12;1.5
 - **CropWorldPt1**: One corner of the rectangle, in world coordinates, to crop out of the image, used with `'CropPt2'`
`CropPt1` and `CropPt2` are diagonal of each other.
Note-  See documentation on WorldPt to find proper syntax
 - **CropWorldPt2**: Second corner of the rectangle, in world coordinates, to crop out of the image, used with CropWorldPt1.
CropWorldPt1 and CropWorldPt2 are diagonal of each other.
Note-See documentation on WorldPt to find proper syntax
 - **ZoomArcsecPerScreenPix**: Set the zoom level so it have the specified arcsec per screen pixel. Use with
        "ZoomType==ARCSEC_PER_SCREEN_PIX" and "ZoomToWidth"
 - **ContinueOnFail**: For 3 color, if this request fails then keep trying to make a plot with the other request
 - **ObjectName**: the object name that can be looked up by NED or Simbad</td>
 - **Resolver**: The object name resolver to use, options are: NED, Simbad, NedThenSimbad, SimbadThenNed, PTF
 - **GridOn**: Turn the grid on after the plot is completed. Normally the grid is turned on by a user action.  This option
         forces the grid to be on my default. Boolean value: true or false
 - **SurveyKeyAl**: TODO: Document this param</td>
 - **UserDesc**: TODO: Document this param</td>
 - **UniqueKey**: TODO: Document this param


<br><br>
<b>Image Viewer</b><br><br>

The following methods are available on <code>ImageViewer</code>. A ImageViewer is created or referenced by calling the
following
<ul>
    <li><code>firefly.makeImageViewer()</code> - to make a image viewer for a div</li>
    <li><code>firefly.getExpandViewer()</code> - to get the image viewer that will popup on top of the page</li>
    <li><code>firefly.getExternalViewer()</code> - to get the image viewer that will make a new page or tab</li>
</ul>

<div class="ret">Methods:</div>
<ul>
    <li>
        <code>plot(params)</code> - plot a fits image.
        <table style="font-size: smaller;">
            <tr>
                <td><span class="paramsTitle">Parameters:</span></td>
            </tr>
            <tr>
                <td><span class="pName">params</span></td>
                <td>- the plotting parameters, anonymous class with name values pairs.</td>
            </tr>
        </table>
    </li>
    <li>
        <code>plotURL(url)</code> - plot a fits image.
        <table style="font-size: smaller;">
            <tr>
                <td><span class="paramsTitle">Parameters:</span></td>
            </tr>
            <tr>
                <td><span class="pName">url</span></td>
                <td>- a url of a fits file to plot, all other parameter come from the defaults</td>
            </tr>
        </table>
    </li>
</ul>

<div class="ret">Methods specific to firefly.getExternalViewer() object:</div>
<ul>
    <li>
        <code>setTarget(target)</code> - sets the target window name to open
        <table style="font-size: smaller;">
            <tr>
                <td><span class="paramsTitle">Parameters:</span></td>
            </tr>
            <tr>
                <td><span class="pName">target</span></td>
                <td>- a string. The name of target window, if not defined or
                    null then "_blank" is used.
                </td>
            </tr>
        </table>
    </li>
</ul>

<b>Table Visualization</b><br><br>


<pre>
    Usage: firefly.showTable(parameters, div)

    parameters is an object attributes.  div is the div to load the table into.
    below is a list of all possible parameters.

    parameters:
        source      : required; location of the ipac table.  url or file path.
        alt_source  : use this if source does not exists.
        type        : basic or selectable; default to basic if not given
        filters     : col_name [=|!=|<|>|<=|>=] value OR col_name IN (v1[,v2]*)
        sortInfo    : SortInto=ASC|DESC,col_name
        pageSize    : positive integer
        startIdx    : positive integer
        fixedLength : true|false, default to true
        tableOptions : see below
        (varibles)* : value

        tableOptions:  option=true|false [,option=true|false]*
            show-filter
            show-popout
            show-title
            show-toolbar
            show-options
            show-paging
            show-save


    javascript example:

        var params = new Object();
            params.source = "http://web.ipac.caltech.edu/tbl_test/test.tbl";
            params.alt_source = "/Users/loi/test.tbl";
            params.pageSize = "100";
            params.tableOptions = "show-popout=false,show-units=true";
            params.var1 = "value1";
            params.var2 = "value2";

        firefly.showTable(params, fv1);


</pre>
<i>Table File Support:</i>
The Table tools currently supports the following file formats:
<ul>
    <li>IPAC Table file format</li>
    <li>CSV - first row should be the title</li>
    <li>TSV - first row should be the title</li>
</ul>




<br><br><b>Firefly Object - creating Image viewers</b>

<br><br>
<ul>
    <code>firefly.getExpandViewer()</code> - return the ExpandedImageViewer object. This is a specialized ImageViewer
    object.
    This is the viewer that you used to popout an image to full screen.<br>
</ul>
<ul>
    <code>firefly.setGlobalDefaultParams(params)</code> - set global fallback params for every image plotting call<br>
    <table style="font-size: smaller;">
        <tr>
            <td><span class="paramsTitle">Parameters:</span></td>
        </tr>
        <tr>
            <td><span class="pName">params-</span></td>
            <td>the fallback plotting parameters</td>
        </tr>
    </table>
</ul>
<ul>
    <code>firefly.setRootPath(rootURLPath)</code> - sets the root path for any relative URL. If this
    method has not been called then relative URLs use the page's root.<br>
    <table style="font-size: smaller;">
        <tr>
            <td><span class="paramsTitle">Parameters:</span></td>
        </tr>
        <tr>
            <td><span class="pName">rootURLPath</span></td>
            <td> - the root URL to be prepended to any relative URL.</td>
        </tr>
    </table>
</ul>

<ul>
    <code>firefly.serializeRangeValues(stretchType,lowerValue,upperVaue,algorithm)</code> - serialze a stretch request
    into a string,
    for use with the "RangeValues" parameter<br><br>
    <table style="font-size: smaller;">
        <tr>
            <td><span class="paramsTitle">Parameters:</span></td>
        </tr>
        <tr>
            <td><span class="pName">stretchType-</span></td>
            <td>the stretch type, possible values: "Percent", "Absolute", "Sigma"</td>
        </tr>
        <tr>
            <td><span class="pName">lowerValue-</span></td>
            <td>lower value of stretch, based on stretchType.
            </td>
        </tr>
        <tr>
            <td><span class="pName">upperValue-</span></td>
            <td>upper value of stretch, based on stretchType.
            </td>
        <tr>
            <td><span class="pName">algorithm-</span></td>
            <td>The stretch algorithm, possible values "Linear", "Log", "LogLog", "Equal", "Squared", "Sqrt"
            </td>
        </tr>
        <tr>
            <td class="ret">return:</td>
            <td>a serialized version of the stretch to use with the "RangeValues" parameter</td>
        </tr>
        <td class="ret">examples:</td>
        <td>
            <ul>
                <li>var s= firefly.serializeRangeValues("Sigma",-2,8,"Linear")</li>
                <li>var s= firefly.serializeRangeValues("Percent",4,97,"Linear")</li>
                <li>var s= firefly.serializeRangeValues("Percent",2,99,"Log")</li>
                <li><pre>
                iv.plot( {  "Type"      : "SERVICE",
                            "Service"   : "TWOMASS",
                            "SurveyKey" : "k",
                            "ObjectName": "m33",
                            "Title"     : "FITS Data",
                            "RangeValues" : firefly.serializeRangeValues("Sigma",-2,8,"Linear")
                          });
                </pre>
                </li>

            </ul>
        </td>

    </table>
</ul>


<b>Firefly Object - Connecting FITS Viewers to table</b><br><br>
<ul>
    <code>firefly.addDataViewer(params, div)</code> - add a data viewer to a div<br>
    <table style="font-size: smaller;">
        <tr>
            <td><span class="paramsTitle">Parameters:</span></td>
        </tr>
        <tr>
            <td><span class="pName">params-</span></td>
            <td>Plotting parameters for FITS Viewer plus additional parameters.
                In addition to the standard ImageViewer parameters the following are also supported.

                <table cellspacing=5 class="requestDoc">
                    <tr>
                        <td>QUERY_ID</td>
                        <td class="paramsDesc">Required. This is the string that connects this DataViewer to the table.
                            It should be
                            the same string that you specified as the div parameter when you created the table
                        </td>
                    </tr>
                    <tr>
                        <td>DataSource</td>
                        <td class="paramsDesc">Required. How the fits file is accessed. Can be URL, .....
                        </td>
                    </tr>
                    <tr>
                        <td>DataColumn</td>
                        <td class="paramsDesc">Required. Column where to find the file name
                        </td>
                    </tr>
                    <tr>
                        <td>MinSize</td>
                        <td class="paramsDesc">Required. This parameter is required but will probably not be necessary
                            in the future. Needs
                            to the a width and height in the form "widthXheight". For example "100X100".
                        </td>
                    </tr>
                </table>
            </td>

        </tr>
        <tr>
            <td><span class="pName">div-</span></td>
            <td>The div to put the ImageViewer in.</td>
        </tr>
        <td class="ret">examples:</td>
        <td>
            <pre>
            firefly.showTable({"source" : "http://web.ipac.caltech.edu/staff/roby/demo/wd/WiseQuery.tbl"},
                             "tableHere");

            firefly.addDataViewer( {"DataSource"  : "URL",
                                    "DataColumn"  : "file",
                                    "MinSize"     : "100x100",
                                    "ColorTable"  : "10",
                                    "RangeValues" : firefly.serializeRangeValues("Sigma",-2,8,"Linear"),
                                    "QUERY_ID"    : "tableHere"  },
                                   "previewHere" );
            </pre>
        </td>
    </table>

    <code>firefly.addCoveragePlot(params, div)</code> - add a coverage plot to a div<br>
    <table style="font-size: smaller;">
        <tr>
            <td><span class="paramsTitle">Parameters:</span></td>
        </tr>
        <tr>
            <td><span class="pName">params-</span></td>
            <td>Plotting parameters for FITS Viewer plus additional parameters.
                In addition to the standard ImageViewer parameters the following are also required.

                <table cellspacing=5 class="requestDoc">
                    <tr>
                        <td>QUERY_ID</td>
                        <td class="paramsDesc">This is the string that connects this DataViewer to the table. It should
                            be
                            the same string that you specified as the div parameter when you created the table
                        </td>
                    </tr>
                    <tr>
                        <td>MinSize</td>
                        <td class="paramsDesc">This parameter is required but will probably not be necessary in the
                            future. Needs
                            to the a width and height in the form "widthXheight". For example "100X100".
                        </td>
                    </tr>
                </table>
        </tr>
        <tr>
            <td colspan="2">Coverage is computed by looking at columns in the tables. The coverage can show coverage for
                point sources
                by showing an x for the RA and Dec. It can also show a box if the four corners are specified. If you use
                the default
                column names you do not have to specify how to determine the center or the four corners.
            </td>
        </tr>
        <tr>
            <td><span class="pName">params to <br>compute coverage</span></td>
            <td>
                <table cellspacing=5 class="requestDoc">
                    <tr>
                        <td>CornerColumns</td>
                        <td class="paramsDesc">
                            Determines if the coverage will use the box style and what corners will be used.
                            Should be specified as a string with the values comma separated. For example-
                            "ra1,dec1,ra2,dec2,ra3,dec3,ra4,dec4". If this parameter is not specified then the example
                            is the default.
                            If you specify "CornerColumns" then you must also specify "CenterColumns".
                        </td>
                    </tr>
                    <tr>
                        <td>CenterColumns</td>
                        <td class="paramsDesc">
                            Determines if the coverage will use the x style (if "CornerColumns" is not specified)
                            and what is the center point.
                            Should be specified as a string with the values comma separated. For example-
                            "ra,dec". If this parameter is not specified then the example is the default.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td class="ret">examples:</td>
            <td>
            <pre>
            firefly.showTable({"source" : "http://web.ipac.caltech.edu/staff/roby/demo/wd/WiseQuery.tbl"},
                             "tableHere");

            firefly.addCoveragePlot({"QUERY_ID" : "tableHere",
                                     "CornerColumns" : "lon1,lat1,lon2,lat2,lon3,lat3,lon4,lat4",
                                     "CenterColumns" : "lon,lat",
                                     "MinSize"    : "100x100" },
                                     "coverageHere" );

            </pre>
            </td>
        </tr>
        </td>
        </td>

    </table>
</ul>

