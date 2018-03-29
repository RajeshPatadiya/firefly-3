/**
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 * Lijun
 * 4/14/16
 *
 * 05/02/17
 * DM-6501
 *   Add the Regrid and LinearInterpolator in the utility
 *   Use the Regrid to adding more gride lines and the number of the points in the line
 *   Rotate the labels based on the angles
 *   Cleaned up the codes
 *
 *  02/13/18
 *  IRSA-1391
 *  Add the Grid lines for HiPs map
 *  The HiPs map is very different from the regular image map.  The HiPs map has a huge range in longitude.
 *  In order to get finer grid calculation, I adjust the algorithm, instead of using 4 for the intervals when finding lines,
 *  I used interval = range/0.5.
 *
 *  For HiPs map, the range is calculated differently.  The range calculation for regular image is using the data width
 *  data height (which are the naxis1/naxis2).  But for HiPs, there are no data width and height.  Intead of using
 *  data width and height by walking four corners, I used the field view angle and ceter point.  If the angle is >=180,
 *  the image is sphere.  If the fov < 180, the ranges are calculated using the cell values.
 *
 *  For the grid lines calculation, all valid points are in the range, there is no need to check with the screen width.
 *
 *  For Label location, for the latitude, the labels lay on the longitude=0.
 *
 *  3/2/18
 *  It takes a lot longer to draw the grid lines when zoom out.  The reason is that the points search taken longer and
 *  and the number of points gotten larger and larger.  To solve this issue, I changed the algorithm as described belowL
 *  1. Use larger delta=10 (deg) to calculate line intervals and points.
 *  2. Use the view port as a frame to test if the grid lines need to be reduced.  When the image is zoomed out, the ranges
 *  are getter smaller and smaller, the grid lines will fall beyond the boundary.  Those lines no longer need to be calculated.
 *  Thus, there will be some time saved.
 *  However, the view port does not always return the correct border because it depends on the image's projection etc.
 *     a. Four corner is calculated.  If four corners found, the image is in zoom out status, the four corners are on the
 *        image.  In this case, the grid lines are filtered.  Only the lines are inside the image will be calculated.
 *
 *     b. If the image has discontinuity i.e (0, 360 next each other in longitude), I test in the range 0- min view port
 *        and max viewport - 360.  The way to test the discontinuity is to see 0 is in the levels array.
 *
 *     c. If the image is smaller than the view port, there is no grid line filtering needed.
 *
 *
 *
 *   3. Since the HIPS map has a larger range,  the levels are always regrided to finer grid lines.
 *
 *   4. Filter the grid lines
 *     a.  For HIPS map, I checked if the longitude=0 is in the image, that is if the pole is inside the viewable area.
 *     If it is, the algorithm is different from the no pole case.
 *
 *     b. In order to get more than one grid lines,  the original levels are regrided to finer levels if only one
 *     line is found, using the new finer levels to look for the grid lines.  The maximum tries is 5 times.
 *
 *
 */

import { makeWorldPt, makeImagePt,makeDevicePt,makeImageWorkSpacePt} from '../visualize/Point.js';
import ShapeDataObj from '../visualize/draw/ShapeDataObj.js';
import CoordinateSys from '../visualize/CoordSys.js';
import CoordUtil from '../visualize/CoordUtil.js';
import numeral from 'numeral';
import { getDrawLayerParameters} from './WebGrid.js';
import {isEqual} from 'lodash';
import {getBestHiPSlevel, getVisibleHiPSCells, getPointMaxSide} from '../visualize/HiPSUtil.js';
import {Regrid} from '../util/Interp/Regrid.js';
import {getCenterOfProjection} from '../visualize/PlotViewUtil';

const precision3Digit = '0.000';
const RANGE_THRESHOLD = 1.02;
const minUserDistance= 0.25;   // user defined max dist. (deg)
const maxUserDistance= 3.00;   // user defined min dist. (deg)
var userDefinedDistance = false;
const angleStepForHipsMap=10.0;
/**
 * This method does the calculation for drawing data array
 * @param plot - primePlot object
 * @param cc - the CoordinateSys object
 * @param useLabels - use Labels
 * @param numOfGridLines
 * @return a DrawData object
 */
export function makeGridDrawData (plot,  cc, useLabels, numOfGridLines=11){


    const {width,height, screenWidth, csys, labelFormat} = getDrawLayerParameters(plot);

    const wpt = cc.getWorldCoords(makeImageWorkSpacePt(1, 1), csys);
    const aitoff = (!wpt);

    if (width > 0 && height >0) {
        const bounds = new Rectangle(0, 0, width, height);

        //for hips, the range is always the full sky ranges
        var range = plot.type==='hips'?[[0, 360], [-90, 90]]: getRange(csys, width, height, cc);
        const {xLines, yLines, labels} = computeLines(cc, csys, range,screenWidth, numOfGridLines, labelFormat,plot);
        return  drawLines(bounds, labels, xLines, yLines, aitoff, screenWidth, useLabels, cc,plot.type);


    }
}

function doSearch(x,y, dx, dy, intervals,  csys, cc){
    var i=0, wpt;

    while (i <= intervals ) {
        wpt = cc.getWorldCoords(makeDevicePt(x, y), csys);
        //find the first point on the image within the view port
        if (wpt) {
           return wpt;
        }
        x += dx;
        y += dy;

        i++;
    }
    return null;
}
function getViewBorder(plot, csys,  cc,ranges) {

    const corners = getFourCorners(plot, csys, cc);

    if( corners.indexOf(null)>-1)  return ranges;

    var vals = [];
    var vRange = [[1.e20, -1.e20], [1.e20, -1.e20]];
    for (let i = 0; i < corners.length; i++) {
        if (corners[i]) {
            vals[0] = corners[i].getLon();
            vals[1] = corners[i].getLat();
            //assign the new lower and upper longitude if found
            if (vals[0] < vRange[0][0]) vRange[0][0] = vals[0];
            if (vals[0] > vRange[0][1]) vRange[0][1] = vals[0];

            //assign the new lower and upper latitude if found
            if (vals[1] < vRange[1][0]) vRange[1][0] = vals[1];
            if (vals[1] > vRange[1][1]) vRange[1][1] = vals[1];
        }
    }

   /* if (plot.type === 'hips') { //range is too big so we can round it
        return vRange.map((row, i) => {
            return row.map((cell, j) => {
                if (cell < 1.e20 && cell > -1.e20) {
                    return Math.round(cell);
                }
                else {
                    return ranges[i][j];
                }
            });
        });
    }
    else {
        return vRange;
    }*/
    return vRange;
}
function getFourCorners(plot, csys,  cc){
    const {width, height} = plot.viewDim;
    var xmin=0;
    var ymin=0;
    var xmax= width;
    var ymax= height;
    var xdelta, ydelta, x, y;

    var intervals= plot.type==='hips'?100:1;
    y = ymax;
    x = xmin;
    xdelta = width / intervals - 1; //define an interval of the point in line a-b
    ydelta = 0; //no change in the y direction, so ydelta is 0, thus the points should be alone line a-b
    const cUpperLeft= doSearch(x,y, xdelta, ydelta, intervals,  csys, cc);//upper left

    y = ymin;
    x = xmax;
    xdelta = -xdelta;
    const cLowerRight= doSearch(x,y, xdelta, ydelta, intervals,  csys, cc);

    xdelta = 0;
    ydelta = (height / intervals) - 1;
    y = ymin;
    x = xmin;
    const cLowerLeft= doSearch(x,y, xdelta, ydelta, intervals,  csys, cc);

    ydelta = -ydelta;
    y = ymax;
    x = xmax;
    const cUpperRight= doSearch(x,y, xdelta, ydelta, intervals,  csys, cc);

    start from here to get the correct range....
    
    y = height/2;
    x = xmin;
    xdelta = width / intervals - 1; //define an interval of the point in line a-b
    ydelta = 0;
    const cMiddleLeft= doSearch(x,y, xdelta, ydelta, intervals,  csys, cc);//middle left

    y = height/2;
    x = xmax;
    xdelta = width / intervals - 1; //define an interval of the point in line a-b
    ydelta = 0;
    const cMiddleRight= doSearch(x,y, xdelta, ydelta, intervals,  csys, cc);//middle left


    return [cUpperLeft, cLowerRight,cLowerLeft, cUpperRight];

}
/**
 * Tried to use the plotViewDim to calculate the ranges.  But for an unknown reason, the range is always tiny bit smaller than the
 * real range.  Thus, the lines are not connected. 
 * @param plot
 * @param csys
 * @param cc
 * @returns {[null,null]}
 */
function  getHipsRangeByViewDim(plot, csys,  cc) {

    const {width, height} = plot.viewDim;

    var  range = [[1.e20, -1.e20],[1.e20, -1.e20]];
    var xmin=0;
    var ymin=0;
    var xmax= width;
    var ymax= height;
    var xdelta, ydelta, x, y;
    var intervals= plot.type==='hips'?360:1;

    // four corners.
    // point a[xmin, ymax], the top left point, from here toward to right top point b[xmax, ymax], ie the line
    //   a-b
    y = ymax;
    x = xmin;
    xdelta = (width / intervals) - 1; //define an interval of the point in line a-b
    ydelta = 0; //no change in the y direction, so ydelta is 0, thus the points should be alone line a-b
    edgeRun1(intervals, x, y, xdelta, ydelta, range, csys, cc);

    // Bottom: right to left
    y = ymin;
    x = xmax;
    xdelta = -xdelta;
    edgeRun1(intervals, x, y, xdelta, ydelta, range, csys,  cc);

    // Left.  Bottom to top.
    xdelta = 0;
    ydelta = (height / intervals) - 1;
    y = ymin;
    x = xmin;
    edgeRun1(intervals, x, y, xdelta, ydelta, range, csys, cc);

    // Right. Top to bottom.
    ydelta = -ydelta;
    y = ymax;
    x = xmax;
    edgeRun1(intervals, x, y, xdelta, ydelta, range, csys, cc);

    // grid in the middle
    xdelta = (width / intervals) - 1;
    ydelta = (height / intervals) - 1;
    x = xmin;
    y = ymin;
    edgeRun1(intervals, x, y, xdelta, ydelta, range, csys, cc);

    return range.map( (row) => {
        return row.map( ( cell ) =>{
            return Math.round(cell);
        } );
    } );


}
function edgeRun1(intervals, x, y, dx, dy, range, csys,cc){

    var i=0, wpt;
    var vals=[];
    while (i <= intervals) {

        wpt = cc.getWorldCoords(makeDevicePt(x, y), csys);
        //look for lower and upper longitude and latitude
        if (wpt) {
            vals[0] = wpt.getLon();
            vals[1] = wpt.getLat();
            //assign the new lower and upper longitude if found
            if (vals[0] < range[0][0]) range[0][0] = vals[0];
            if (vals[0] > range[0][1]) range[0][1] = vals[0];

            //assign the new lower and upper latitude if found
            if (vals[1] < range[1][0]) range[1][0] = vals[1];
            if (vals[1] > range[1][1]) range[1][1] = vals[1];

        }
        x += dx;
        y += dy;

        ++i;
    }
}


/**
 * For Image map, we use the data width (naxis1) or height(naxis2) to calculate the image ranges.
 * For HiPs map, the data width and data height are not from naxis1 and naxis2, thus the same way to calculate
 * the longtitude and latitude ranges resulted incorrect ranges.  Here, I use the field of view angle (fov) and the
 * center world point.  If fov>=180, the image is in sphere, [0-360] for longitude and [-90,90] for latitude.
 * For fov<180, I calculated the healpixs and then find the maximum longitude and latitude.  However, the maximum
 * longitude and latitude don't mean they are the maximum since inside each Hierarchical Equal Area there may be larger
 * longitude and latitude or minimum longitude and latitude.  I did a search along the center world point line to find
 * the maximum longitude and latitude and minimum longitude and latitude if any.
 * @param plot
 * @param cc
 * @returns {[null,null]}
 */
function getHipsRange(plot, cc){


    const {norder}= getBestHiPSlevel(plot, true);


    const {fov, centerWp}= getPointMaxSide(plot, plot.viewDim);

    if (fov>=180) {
        return [[0, 360], [-90, 90]];
    }

    else {
        const cells = getVisibleHiPSCells(norder, centerWp, fov, plot.dataCoordSys);

        const wpArray = [];

        cells.forEach((cell) => {
            cell.wpCorners.map((a) => {
                return wpArray.push(a);
            });
        });


        const lonArray = [];
        const latArray = [];
        wpArray.forEach((wp) => {
            lonArray.push(wp.x);
            latArray.push(wp.y);
        });

        var lonMin = Math.min(...lonArray),
            lonMax = Math.max(...lonArray);

        var latMin = Math.min(...latArray),
            latMax = Math.max(...latArray);

        const n = 10;
        var delta;
        var x, y, wpt, ip;
        var minLon = lonMin, maxLon = lonMax, minLat = latMin, maxLat = latMax;
        if (lonMax < 360) {
            delta = (360 - lonMax) / n;
            for (let i = 0; i < n; i++) {
                x = lonMax + (i + 1) * delta;
                y = centerWp.y;
                wpt = cc.getWorldCoords(makeDevicePt(x, y), plot.imageCoordSys);
                ip = cc.getImageWorkSpaceCoords(wpt);
                if (ip && x > lonMax) {
                    maxLon = x;
                    if (maxLon === 360) {
                        break;
                    }
                }
            }
        }
        if (lonMin > 0.0) {
            var delta = (lonMin) / n;
            for (let i = 0; i < n; i++) {
                x = lonMin - (i + 1) * delta;
                y = centerWp.y;
                wpt = cc.getWorldCoords(makeDevicePt(x, y), plot.imageCoordSys);
                ip = cc.getImageWorkSpaceCoords(wpt);
                if (ip && x < lonMin) {
                    minLon = x;
                    if (maxLon === 0) {
                        break;
                    }
                }
            }
        }

        if (latMax < 90) {
            delta = (90 - latMax) / n;
            for (let i = 0; i < n; i++) {
                y = latMax + (i + 1) * delta;
                x = centerWp.x;
                wpt = cc.getWorldCoords(makeDevicePt(x, y), plot.imageCoordSys);
                ip = cc.getImageWorkSpaceCoords(wpt);
                if (ip && y > latMax) {
                    maxLat = y;
                    if (maxLon === 90) {
                        break;
                    }
                }
            }
        }
        if (latMin > -90) {
            var delta = (latMin - 90 ) / n;

            for (let i = 0; i < n; i++) {
                y = latMin - (i + 1) * delta;
                x = centerWp.x;
                wpt = cc.getWorldCoords(makeDevicePt(x, y), plot.imageCoordSys);
                ip = cc.getImageWorkSpaceCoords(wpt);
                if (ip && y < latMin) {
                    minLat = y;
                    if (maxLat === -90) {
                        break;
                    }
                }
            }
        }

        return [[minLon, maxLon], [minLat, maxLat]];
    }
}

function filterLevels(inLevels, plot,  viewRanges, ranges){

    var cLevels = inLevels;

    if (inLevels.length===0) return;

    var levels=[[],[]];
    var count=1;

    const centerWpt = getCenterOfProjection(plot);
    const hasPole = viewRanges[0][0]<centerWpt.getLon() && centerWpt.getLon()<viewRanges[0][1]?false:true;


    while( count<4 && (levels[0].length<2 || levels[1].length<2) ){
        levels=[[],[]];
        for (let i=0; i<cLevels.length; i++) {
            if (isEqual(viewRanges[i], ranges[i])) {
                levels[i] = cLevels[i];
                continue;
            }
            if (!cLevels[i] || cLevels[i].length===0) continue;
            for (let j = 0; j < cLevels[i].length; j++) {
                if (plot.type === 'hips') {
                    //check if the discontinuity exists
                    if (i == 0 && hasPole && (cLevels[i][j] >= ranges[i][0] && cLevels[i][j] <= viewRanges[i][0] ||
                            cLevels[i][j] <= ranges[i][1] && cLevels[i][j] >= viewRanges[i][1] )) {
                        levels[i].push(cLevels[i][j]);
                    }
                    else if ( (i==0  && !hasPole || i==1)  && cLevels[i][j] >= viewRanges[i][0] && cLevels[i][j] <= viewRanges[i][1]) {
                        levels[i].push(cLevels[i][j]);
                    }
                }
                else if (cLevels[i][j] >= viewRanges[i][0] && cLevels[i][j] <= viewRanges[i][1]) {

                    levels[i].push(cLevels[i][j]);
                }
            }

        }
        count++;
        //regrid the cLevels to make it finer grid lines
        cLevels = cLevels.map( (row, i)=>{
            if(!row || row.length===0) return row;
            else {
                return Regrid(row, count*cLevels[i].length, true);
            }
        });


    }

    //make the grid finer
   /* cLevels = cLevels.map( (row, i)=>{
        return Regrid(row, 4*cLevels[i].length, true);
    });

    for (let i=0; i<cLevels.length; i++) {
        if (isEqual(viewRanges[i], ranges[i])) {
            levels[i] = cLevels[i];
            continue;
        }
        for (let j = 0; j < cLevels[i].length; j++) {
            if (plot.type === 'hips') {
                //check if the discontinuity exists
                if (i == 0 && cLevels[i].indexOf(0)>=0 && (cLevels[i][j] >= ranges[i][0] && cLevels[i][j] <= viewRanges[i][0] ||
                        cLevels[i][j] <= ranges[i][1] && cLevels[i][j] >= viewRanges[i][1] )) {
                    levels[i].push(cLevels[i][j]);
                }
                else if ( (i==0  && cLevels[i].indexOf(0)===-1 || i==1)  && cLevels[i][j] >= viewRanges[i][0] && cLevels[i][j] <= viewRanges[i][1]) {
                    levels[i].push(cLevels[i][j]);
                }
            }
            else if (cLevels[i][j] >= viewRanges[i][0] && cLevels[i][j] <= viewRanges[i][1]) {

                levels[i].push(cLevels[i][j]);
            }
        }

    }*/



   return levels;
}
/**
 * Define a rectangle object
 * @param x - the x coordinate
 * @param y - the y coordinate
 * @param width - the width of the rectangle
 * @param height - the height of the rectangle
 * @constructor
 */
function Rectangle(x, y, width, height){
    this.x= x;
    this.y= y;
    this.width= width;
    this.height= height;
}
/**
 * walk around four corners to find the proper ranges
 * @param intervals
 * @param x0 - the starting x value of the corner
 * @param y0 - the starting y value of the corner
 * @param dx - the increment
 * @param dy - the increment
 * @param range - the x and y rangs
 * @param csys - the coordinate system the grid is drawing with
 * @param wrap - boolean value, true or false
 * @param cc - the CoordinateSys object
 */
function edgeRun (intervals,x0,  y0,dx, dy, range, csys, wrap, cc) {


    var  x = x0;
    var  y = y0;

    var i = 0;
    var vals = [];

    while (i <= intervals) {

        var wpt =cc.getWorldCoords(makeImageWorkSpacePt(x,y),csys);
        //look for lower and upper longitude and latitude
        if (wpt) {
            vals[0] = wpt.getLon();
            vals[1] = wpt.getLat();

            if (wrap && vals[0] > 180) vals[0] = vals[0]-360;
            if (wrap!=null //true and false
                || wrap==null && cc.pointInPlot(makeWorldPt(vals[0], vals[1], csys))//temporary solution to solve the problem reported.
                || csys===CoordinateSys.EQ_B2000
                || csys===CoordinateSys.EQ_J2000 ) {
                //assign the new lower and upper longitude if found
                if (vals[0] < range[0][0]) range[0][0] = vals[0];
                if (vals[0] > range[0][1]) range[0][1] = vals[0];

                //assign the new lower and upper latitude if found
                if (vals[1] < range[1][0]) range[1][0] = vals[1];
                if (vals[1] > range[1][1]) range[1][1] = vals[1];
            }
        }
        x += dx;
        y += dy;

        ++i;
    }

}
/**
 * get the ege value
 * @param intervals - the number of interval to look for the values
 * @param width - the width of the image
 * @param height - the height of the image
 * @param csys - the coordinate system the grid is drawing with
 * @param wrap - boolean value, true or false
 * @param cc - the CoordinateSys object
 * @returns the value at the edge of the image
 */
function  edgeVals(intervals, width, height, csys, wrap, cc) {

    var  range = [[1.e20, -1.e20],[1.e20, -1.e20]];
    var xmin=0;
    var ymin=0;
    var xmax= width;
    var ymax= height;
    var xdelta, ydelta, x, y;


    // four corners.
    // point a[xmin, ymax], the top left point, from here toward to right top point b[xmax, ymax], ie the line
    //   a-b
    y = ymax;
    x = xmin;
    xdelta = (width / intervals) - 1; //define an interval of the point in line a-b
    ydelta = 0; //no change in the y direction, so ydelta is 0, thus the points should be alone line a-b
    edgeRun(intervals, x, y, xdelta, ydelta, range, csys,wrap, cc);

    // Bottom: right to left
    y = ymin;
    x = xmax;
    xdelta = -xdelta;
    edgeRun(intervals, x, y, xdelta, ydelta, range, csys, wrap, cc);

    // Left.  Bottom to top.
    xdelta = 0;
    ydelta = (height / intervals) - 1;
    y = ymin;
    x = xmin;
    edgeRun(intervals, x, y, xdelta, ydelta, range, csys, wrap, cc);

    // Right. Top to bottom.
    ydelta = -ydelta;
    y = ymax;
    x = xmax;
    edgeRun(intervals, x, y, xdelta, ydelta, range, csys, wrap,cc);

    // grid in the middle
    xdelta = (width / intervals) - 1;
    ydelta = (height / intervals) - 1;
    x = xmin;
    y = ymin;
    edgeRun(intervals, x, y, xdelta, ydelta, range, csys, wrap,cc);


    return range;
}
/**
 * Test to see if the edge is a real one
 * @param xrange
 * @param trange
 * @returns {boolean}
 */
function  testEdge( xrange, trange)
{
    /* This routine checks if the experimental minima and maxima
     * are significantly changed from the old test minima and
     * maxima.  xrange and trange are assumed to be multidimensional
     * extrema of the form double[ndim][2] with the minimum
     * in the first element and the maximum in the second.
     *
     * Note that xrange is modified to have the most extreme
     * value of the test or old set of data.
     */

    /* Find the differences between the old data */
    var delta =trange.map( (t)=>{
        return Math.abs(t[1]-t[0]);
    });

    for (let i=0; i<trange.length; i += 1) {
        var  ndelta = Math.abs(xrange[i][1]-xrange[i][0]);
        /* If both sets have nil ranges ignore this dimension */
        if (ndelta <= 0. && delta[i] <= 0.){
            continue;
        }

        /* If the old set was more extreme, use that value. */
        if (xrange[i][0] > trange[i][0]) {
            xrange[i][0] = trange[i][0];
        }

        if (xrange[i][1] < trange[i][1])  {
            xrange[i][1] = trange[i][1];
        }

        /* If the previous range was 0 then we've got a
         * substantial change [but see above if both have nil range]
         */
        if (!delta[i]) {
            return false;
        }

        /* If the range has increased by more than 2% than */
        if ( Math.abs(xrange[i][1]-xrange[i][0])/delta[i] >
            RANGE_THRESHOLD) {
            return false;
        }
    }

    return true;
}
/**
 * Get the line ranges
 * @param  {object} csys - the coordinate system the grid is drawing with
 * @param  {double} width - the width of the image
 * @param  {double} height - the height of the image
 * @param  {object} cc - the CoordinateSys object
 * @returns the range array
 */
function getRange( csys, width, height, cc) {


    //using three state boolean wrap=true/false, the null, null for temporary solution to solve the problem reported.
    var range=[[0.,0.],[0.,0.]];
    var poles=0;  // 0 = no poles, 1=north pole, 2=south pole, 3=both

    /* Get the range of values for the grid. */
    /* Check for the poles.  We allow the poles to
     * be a pixel outside of the image and still consider
     * them to be included.
     */

    var wrap=false;	/* Does the image wrap from 360-0. */
    var  sharedLon= 0.0;
    var  sharedLat= 90.0;



    if (cc.pointInPlot(makeWorldPt(sharedLon, sharedLat, csys))){
        range[0][0] = -179.999;
        range[0][1] =  179.999;
        range[1][1] = 90;
        poles += 1;
        wrap = true;
    }

    sharedLon= 0.0;
    sharedLat= -90.0;
    if (cc.pointInPlot(makeWorldPt(sharedLon, sharedLat, csys))){
        range[0][0] = -179.999;
        range[0][1] =  179.999;
        range[1][0] = -90;
        poles += 2;
        wrap = true;
    }

    /* If both poles are included we can just return */
    if (poles == 3){
        return range;
    }

    /* Now we have to go around the edges to find the remaining
     * minima and maxima.
     */
    var  trange = edgeVals(1, width, height, csys, wrap,cc);
    if (!wrap) {
        /* If we don't have a pole inside the map, check
         * to see if the image wraps around.  We do this
         * by checking to see if the point at [0, averageDec]
         * is in the map.
         */

        sharedLon= 0.0;
        sharedLat= (trange[1][0] + trange[1][1])/2;

        //this block is modified to fix the issue reported that only one line is drawn in some case
        if (cc.pointInPlot(makeWorldPt(sharedLon, sharedLat, csys)))
        {
            wrap = true;

            // Redo min/max
            trange = edgeVals(1, width, height, csys,wrap,cc);
        }
        //this block was a temporary solution to solve the problem once found.  Comment it out for now in js version
        else if (csys===CoordinateSys.GALACTIC){
            trange=edgeVals(1, width, height, csys,null,cc);
            sharedLon = 0.0;
            sharedLat = (trange[1][0] + trange[1][1]) / 2;
            if (cc.pointInPlot(makeWorldPt(sharedLon, sharedLat,csys))) {
                wrap=true;
                // Redo min/max
                trange =edgeVals(1, width, height, csys,wrap,cc);
            }
        }

    }

    var  xrange = trange;
    var xmin= 0;
    var  adder=2;
    for (let  intervals = xmin+adder;
         intervals < width; intervals+= adder) {

        xrange = edgeVals(intervals, width, height, csys,wrap,cc);
        if (testEdge(xrange, trange)) {
            break;
        }
        trange = xrange;
        adder*= 2;
    }

    if (!poles && wrap){
        xrange[0][0] += 360;
    }
    else if (poles ===1) {
        range[1][0] = xrange[1][0];
        return range;
    }
    else if (poles === 2)  {
        range[1][1] = xrange[1][1];
        return range;
    }

    return xrange;

}

function lookup(val, factor){

    const conditions=[val < 1,val > 90,val > 60 ,val > 30,val > 23,val > 18,val > 6, val > 3];
    const index = conditions.indexOf(true);
    var values =[val, 30, 20, 10, 6, 5, 2, 1] ;
    var retval = (index && index>=0)? values[index] :0.5;
    if (factor >=4.0) {
        retval = retval/2.0;
    }
    return retval;



}

function calculateDelta(min, max,factor){
    var delta = (max-min)<0? max-min+360:max-min;
    var  qDelta;
    if (delta > 1) { // more than 1 degree
        qDelta = lookup(delta,factor);
    }
    else if (60*delta > 1) {// more than one arc minute
        qDelta = lookup(60*delta,factor)/60;
    }
    else if (3600*delta > 1) {// more than one arc second
        qDelta= lookup(3600*delta,factor)/3600;
    }
    else{
        qDelta= Math.log(3600*delta)/Math.log(10);
        qDelta= Math.pow(10,Math.floor(qDelta));
    }
    if (userDefinedDistance && !(minUserDistance < qDelta && qDelta < maxUserDistance)){
        var minTry= Math.abs(minUserDistance-qDelta);
        var maxTry= Math.abs(maxUserDistance-qDelta);
        qDelta= (minTry<maxTry) ? minUserDistance :
            maxUserDistance;
    }

    return qDelta;

}


/**
 * Find the labels according to the coordinates
 * @param levels
 * @param csys
 * @param labelFormat
 * @returns {Array}
 */
function getLabels(levels,csys, labelFormat) {


    var labels = [];
    var offset = 0;
    var delta;

    var sexigesimal = (csys.toString()===CoordinateSys.EQ_J2000.toString() || csys.toString()===CoordinateSys.EQ_B1950.toString());
    for (let i=0; i < 2; i++){
         if (levels[i].length >=2){
            delta = levels[i][1]-levels[i][0];
            delta = delta<0?delta+360:delta;
         }

         var lon, lat;
         for (let j=0; j < levels[i].length; j++) {
              if (sexigesimal) {
                  if (i === 0) { //ra labels
                      lon = CoordUtil.convertLonToString(levels[i][j], csys);
                      labels[offset] = labelFormat === 'hms' ? lon : CoordUtil.convertStringToLon(lon, csys).toFixed(3);
                  }
                  else {
                      lat = CoordUtil.convertLatToString(levels[i][j], csys);
                      labels[offset] = labelFormat === 'hms' ? lat : CoordUtil.convertStringToLat(lat, csys).toFixed(3);
                  }
              }
              else {
                  labels[offset] = `${numeral(levels[i][j]).format(precision3Digit)}`;
              }
             offset += 1;
        }
    }

    return labels;
}
/**
 * @desc calculate lines
 *
 * @param  {object} cc - the CoordinateSys object
 * @param  {object} csys - the coordinate system the grid is drawing with
 * @param {object} direction - an integer,  0 and 1 to indicate which direction the lines are
 * @param {double} value - x or y value in the image
 * @param {object} range
 * @param {double} screenWidth - a screen width
 * @param {object} plot
 * @return the points found
 */
function findLine(cc,csys, direction, value, range, screenWidth, plot){

    var intervals;
    var x, dx, y, dy;

    const dLength=direction===0?range[1][1]-range[1][0]:range[0][1]-range[0][0];



    const nInterval = dLength>angleStepForHipsMap? parseInt(dLength/angleStepForHipsMap):4;
    if (!direction )  {// longitude lines
        x  = value;
        dx = 0;
        y  = range[1][0];
        dy = (range[1][1]-range[1][0])/nInterval;
    }
    else { // latitude lines

            y = value;
            dy = 0;
            x = range[0][0];
            dx = (range[0][1] - range[0][0]);
            dx = dx < 0 ? dx + 360 : dx;
            dx /= nInterval;

    }
    var opoints = findPoints(cc, csys,nInterval, x, y, dx, dy, null);
    var  straight = isStraight(opoints);

    var npoints = opoints;
    intervals = 2* nInterval;
    var nstraight;
    var count=1;
    while (intervals < screenWidth  && count<10) { //limit longer loop
        dx /= 2;
        dy /= 2;
        npoints = findPoints(cc, csys, intervals, x, y, dx, dy, opoints);
        //if (plot.type==='hips') return fixPoints(npoints);
        nstraight = isStraight(npoints);
        if (straight && nstraight) {
            break;
        }
        straight = nstraight;
        opoints = npoints;
        intervals *= 2;
        count++;
    }

    return fixPoints(npoints);


}

function findPointsInRange(){

}

function isStraight(points){

    /* This function returns a boolean value depending
     * upon whether the points do not bend too rapidly.
     */
    const len = points[0].length;
    if (len < 3) return true;

    var dx0,  dy0,  len0;
    var  crossp;

    var dx1 = points[0][1]-points[0][0];
    var dy1 = points[1][1]-points[1][0];

    var len1 = (dx1*dx1) + (dy1*dy1);

    for (let i=1; i < len-1; i += 1)   {

        dx0 = dx1;
        dy0 = dy1;
        len0 = len1;
        dx1 = points[0][i+1]-points[0][i];
        dy1 = points[1][i+1]-points[1][i];

        if (dx1>=1.e20 || dy1>=1.e20) continue;
        len1 = (dx1*dx1) + (dy1*dy1);
        if (!len0  || !len1 ){
            continue;
        }
        crossp = (dx0*dx1 + dy0*dy1);
        var  cos_sq = (crossp*crossp)/(len0*len1);
        if (!cos_sq) return false;
        if (cos_sq >= 1) continue;

        var  tan_sq = (1-cos_sq)/cos_sq;
        if (tan_sq*(len0+len1) > 1) {
            return false;
        }
    }
    return true;
}

/**
 * For image map, the interval is hard coded as 4 in the original version (java).  I think that
 * since each image only covers a small stripe of the sky, the range of longitude usually less than 1 degree.
 * Howver for HiPs map, the range is whole sky (0-360).  The hard coded interval 4 is not good enough to find the
 * good points.
 *
 * For HiPs map, I use the interval = longitude-range/0.5, and interval = latitude-range/0.5.  Thus, more points
 * are checked and found for each line.
 *
 * @param cc
 * @param csys
 * @param intervals
 * @param x0
 * @param y0
 * @param dx
 * @param dy
 * @param opoints
 * @returns {[null,null]}
 */
function findPoints(cc,csys, intervals, x0, y0,dx, dy,  opoints){



    var  xpoints = [[],[]];
    var lon=[], lat=[];
    var i0, di;
    if (opoints)  {
        i0 = 1;
        di = 2;
        for (let i=0; i <= intervals; i += 2) {
            xpoints[0][i] = opoints[0][Math.trunc(i/2)];
            xpoints[1][i] = opoints[1][Math.trunc(i/2)];
        }
    }
    else {
        i0 = 0;
        di = 1;
    }

    var sharedLon, wpt, ip, xy,sharedLat,tx, ty;
    for (let i=i0; i <= intervals; i += di) {
        tx= x0+i*dx;
        tx = tx > 360?tx-360:tx;
        tx=tx<0?tx+360:tx;
        ty=y0+i*dy;
        ty=ty>90?ty-180:ty;
        ty=ty<-90?ty+180:ty;
        sharedLon= tx;
        sharedLat= ty;
        wpt= makeWorldPt(sharedLon, sharedLat, csys);
        ip = cc.getImageWorkSpaceCoords(wpt);
        if (ip) {

            xy = makeImagePt(ip.x, ip.y);
        }
        else {

            xy=makeImagePt(1.e20,1.e20);
        }
        lon[i]= sharedLon;
        lat[i]=sharedLat;
        xpoints[0][i] = xy.x;
        xpoints[1][i] = xy.y;

    }
    return xpoints;
}

function fixPoints(points){

    // Convert points to fixed values.
    var len = points[0].length;
    for (let i=0; i < len; i += 1){
        if (points[0][i] < 1.e10) continue;
        points[0][i] = -10000;
        points[1][i] = -10000;

    }

    //points.map( (point)=> point.filter( (item) => item < 1.e20) );

    return points;
}

/**
 * For Image plot, we use the middle point as a label position.
 * For HiPs, we use the first line fire point as a latitude line position since it will be visible at right after the
 * grid line added.  If we use the middle point, it falls on back of the sphere.
 * @param drawData
 * @param bounds
 * @param label
 * @param x
 * @param y
 * @param aitoff
 * @param screenWidth
 * @param useLabels
 * @param cc
 * @param isRaLine
 * @param plotType
 */
function drawLabeledPolyLine (drawData, bounds,  label,  x, y, aitoff,screenWidth, useLabels,cc, isRaLine, plotType='image'){


    //add the  draw line data to the drawData
    var ipt0, ipt1;
    var slopAngle;
    var labelPoint;
    if(!x) return;
    for (let i=0; i<x.length-1; i+=1) {
        //check the x[i] and y[i] are inside the image screen
        if (x[i] > -1000 && x[i+1] > -1000 &&
            ((x[i] >= bounds.x) &&
            ((x[i] - bounds.x) < bounds.width) &&
            (y[i] >= bounds.y) &&
            ((y[i]-bounds.y) < bounds.height) ||
            // bounds check on x[i+1], y[i+1]
            (x[i+1] >= bounds.x) &&
            ((x[i+1] - bounds.x) < bounds.width) &&
            (y[i+1] >= bounds.y) &&
            ((y[i+1]-bounds.y) < bounds.height))) {
            ipt0= makeImageWorkSpacePt(x[i],y[i]);
            ipt1= makeImageWorkSpacePt(x[i+1], y[i+1]);
            //For image, the ra/dec interval is 8, so the points needed to be checked if they are located within the interval
            //For hips, the range for ra is 360, so no check is needed.
            if ( plotType==='hips' ||
                 plotType==='image' && (!aitoff  ||  ((Math.abs(ipt1.x-ipt0.x)<screenWidth /8 ) && (aitoff))) ) {

                 drawData.push(ShapeDataObj.makeLine(ipt0, ipt1));

                 //find the middle point of the line, index from 0, so minus 1
                 if ( (plotType==='hips' && (!isRaLine && i===0 || isRaLine && i===Math.round(x.length / 2) - 1) )  ||
                    (  plotType==='image' &&  i===Math.round(x.length / 2) - 1 )  ) {
                        var wpt1 = cc.getScreenCoords(ipt0);
                        var wpt2 = cc.getScreenCoords(ipt1);
                        const slope = (wpt2.y - wpt1.y) / (wpt2.x - wpt1.x);
                        slopAngle = Math.atan(slope) * 180 / Math.PI;
                        //since atan is multi-value function, the slopAngle is unique, for raLine, I set it is in the range of 0-180
                        if (isRaLine && slopAngle < 0) {
                            slopAngle += 180;
                        }

                        //for dec line, I set it to -90 to 90
                        if (!isRaLine && slopAngle > 90) {
                            slopAngle = 180 - slopAngle;
                        }
                        if (!isRaLine && slopAngle < -90) {
                            slopAngle = 180 + slopAngle;
                        }
                        labelPoint = wpt1;
                        // both screen coordinates or ImageWorkSpacePt are OK.

                }
            }
        } //if
    } // for


    // draw the label.
    if (useLabels  ){
        drawData.push(ShapeDataObj.makeText(labelPoint, label, slopAngle+'deg'));
    }
}

function drawLines(bounds, labels, xLines,yLines, aitoff,screenWidth, useLabels,cc, plotType) {
    // Draw the lines previously computed.
    //get the locations where to put the labels
    var drawData=[];

    var  lineCount = xLines.length;


    for (let i=0; i<lineCount; i++) {
            drawLabeledPolyLine(drawData, bounds, labels[i] ,
            xLines[i], yLines[i], aitoff,screenWidth, useLabels,cc, i<lineCount/2, plotType);
    }
    return drawData;

}

function computeLines(cc, csys, range,  screenWidth, numOfGridLines, labelFormat, plot) {


    const factor = plot.zoomFactor<1?1:plot.zoomFactor;

    var levelsCalcualted = getLevels(range, factor, numOfGridLines, plot.type);


    var corners = getFourCorners(plot, csys,  cc);

    const viewRanges = getViewBorder(plot, csys,  cc, range);

    const isFiltering=corners.indexOf(null)===-1? true:false;

    const levels = isFiltering? filterLevels(levelsCalcualted, plot,viewRanges, range):levelsCalcualted;


    const labels = getLabels(levels, csys, labelFormat);
    /* This is where we do all the work. */
    /* range and levels have a first dimension indicating x or y
     * and a second dimension for the different values (2 for range)
     * and a possibly variable number for levels.
     */

    const centerWpt = getCenterOfProjection(plot);

    const hasPole = viewRanges[0][0]<centerWpt.getLon() && centerWpt.getLon()<viewRanges[0][1]?false:true;

    var ll = getLevelsHips(viewRanges, numOfGridLines, centerWpt, hasPole);

    //TODO the issue is the levels are not correct, try to use the above method to get correct levels, but the four corners are
    //not always right, try to find the corect four corners

    var xLines = [];
    var yLines = [];
    var offset = 0;
    var points=[];
    var p1=[], p2=[];
    for (let i=0; i<2; i++) {
       if (i===1) console.log('debug');
        for (let j=0; j<levels[i].length; j++) {
            if (j===1 && hasPole) {

                const range1 = [ [centerWpt.x, viewRanges[0][0] ], [viewRanges[1][0], viewRanges[1][1]]];
                points = findLine(cc, csys, i, levels[i][j], range1, screenWidth, plot);
               // const range2 = [ [centerWpt.x , viewRanges[0][1]], [viewRanges[1][0], viewRanges[1][1]]];
                const d = viewRanges[0][1]-centerWpt.x;
                if (d>90) {

                    const deltaD = d/4;
                    let r =  [ [centerWpt.x, d/4 ], [viewRanges[1][0], viewRanges[1][1]]];
                    p1 = findLine(cc, csys, i, levels[i][j], r, screenWidth, plot);

                    for (var k=1; k<4; k++){
                        r =  [ [d/4*i, deltaD*(i+1) ], [viewRanges[1][0], viewRanges[1][1]]];
                        p2= findLine(cc, csys, i, levels[i][j], r, screenWidth, plot);
                        p1=p1.concat(p2);
                    }
                }

                //p2 = findLine(cc, csys, i, levels[i][j], range2, screenWidth, plot);
                points=points.concat(p2);

            }
            else {
                points = findLine(cc, csys, i, levels[i][j], viewRanges, screenWidth, plot);
            }
            xLines[offset] = points[0];
            yLines[offset] = points[1];
            offset += 1;

        }
    }
    return {xLines, yLines, labels};
}
function isEven(number){
    if (number % 2 ===0) return true;
    return false;
}
function getLevelsHips(ranges, nLines, centerWpt, hasPole){
    const maxLines = isEven(nLines)? nLines+1:nLines;


    const rangeLon = ranges[0][1]-ranges[0][0];

    const rangeLat = ranges[1][1]-ranges[1][0];

    const deltaLon = hasPole? (ranges[0][0]-centerWpt.getLon())/maxLines/2:rangeLon/maxLines;
    const deltaLat = rangeLat/maxLines;

    var lonLevels=[];
    var latLevels=[];


    lonLevels.push(centerWpt.x);
    for (let i=1; i<maxLines/2; i++) {
        if (hasPole) {

        lonLevels.push(centerWpt.x + deltaLon * i);
        lonLevels.push(ranges[0][1] - deltaLon * i);
        }
        else {
            lonLevels.push(centerWpt.x - deltaLon * i);
            lonLevels.push(ranges[0][1] + deltaLon * i);
        }
    }
    latLevels.push(centerWpt.y);
    for (let i=1; i<maxLines/2; i++){
        latLevels.push(centerWpt.x - deltaLat * i);
        latLevels.push(ranges[1][1] + deltaLon * i);
    }

    return [lonLevels.sort( (a,b)=>{return a-b; }), latLevels.sort( (a,b)=>{return a-b; }) ];

}

/**
 *
 * @param ranges
 * @param factor
 * @param maxLines
 * @param plotType
 * @returns {Array}
 */
function getLevels(ranges,factor, maxLines, plotType){

    var levels=[];
    var  min, max, delta;
    for (let i=0; i<ranges.length; i++){
        /* Expect max and min for each dimension */
        if (ranges[i].length!==2){
            levels[i]=[];
        }
        else {
            min = ranges[i][0];
            max =ranges[i][1];
            if (min===max){
                levels[i]=[];
            }
            else if ( Math.abs(min - (-90.0))  < 0.1 && Math.abs(max - 90.0) <0.1){ //include both poles
                levels[i]= [-75.,-60., -45., -30., -15., 0., 15., 30.,  45., 60.,  75.];
            }
            else {
                /* LZ DM-10491: introduced this simple algorithm to calculate the intervals.  The previous one
                commented below caused line missing. For example, 45,0 wise, 45, 90 wise etc.

                The algorithm previous used (commented ) missed one line. I don't understand the purpose of
                 the algorithm.  The levels can be simply defined as the loop below
                 */
                levels[i] = [];

                delta =calculateDelta (min, max,factor);


                var count = Math.ceil ( (max -min)/delta);
                if (count<=2){
                    delta=delta/2.0;
                    count=2*count;
                }
                for (let j=0; j<count; j++){
                    levels[i][j] = j*delta + min;
                  if (!i && levels[i][j] > 360){
                    levels[i][j] -= 360;
                  }
                  else if (!i && levels[i][j] < 0){
                    levels[i][j] += 360;
                  }

                }


                /* We've now got the increment between levels.
                 * Now find all the levels themselves.
                 */

                //LZ comment out the original algorithm to calculate the intervals
                /* min=(max<min)?min-360:min;
                 val = min<0? min-min%delta : min + delta-min%delta;
                 count=0;
                 while (val + count*delta <= max){
                     count++;
                 }
                 if (count<=2){
                     delta=delta/2.0;
                     count=2*count;
                 }
                 levels[i] = [];
                 for (let j=0; j<count; j++){
                     levels[i][j] = j*delta + val;
                     if (!i && levels[i][j] > 360){
                         levels[i][j] -= 360;
                     }
                     else if (!i && levels[i][j] < 0){
                         levels[i][j] += 360;
                     }

                 }*/
            }
        }

    }

    return levels.map( (row, i )=>{
        if (plotType==='hips') {

            if (i == 0 && row.length < 2 * maxLines) {
                return Regrid(row, 2 * maxLines, true);

            }
            else if (row.length < 2 * maxLines) {
                return Regrid(row, 2 * maxLines, true);
            }
        }
        else {
            if (row.length<maxLines){
                return Regrid(row,  maxLines, true);
            }
            else {
                return row;
            }
        }
    });

    //adjust ra's range in 0-360, regrid first and then change the range, this way takes care of the discontinuity
    for (let i = 0; i < levels[0].length; i++) {
        if (levels[0][i] > 360) {
            levels[0][i] -= 360;
        }
        if (levels[0][i] < 0) {
            levels[0][i] += 360;
        }

    }
   return levels;
}

