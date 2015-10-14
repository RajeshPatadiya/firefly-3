/**
 * Pt module.
 * @module firefly/visualize/Point.js
 */

/**
 * Created by roby on 12/2/14.
 */

/*eslint no-use-before-define: [1, "nofunc"]*/
/*eslint prefer-template:0 */


import CoordinateSys from './CoordSys.js';
import Resolver, {parseResolver} from '../astro/net/Resolver.js';
import validator from 'validator';



//var makePt = function (x, y) {
//    var retval= {};
//    retval.getX = function () { return x; };
//    retval.getY = function () { return y; };
//    retval.toString= function() {
//        return x+";"+y;
//    };
//    return retval;
//};

export class Pt {
    constructor(x,y) {
        this.x= x;
        this.y= y;
    }
    toString() { return this.x+';'+this.y; }

    static parse(inStr) {
        if (!inStr) return null;
        var parts= inStr.split(';');
        if (parts.length===2 && validator.isFloat(parts[0]) && validator.isFloat(parts[1])) {
            return new Pt(validator.toFloat(parts[0]), validator.toFloat(parts[1]));
        }
        return null;
    }
}

export class ImagePt extends Pt {
    constructor(x,y) {
        super(x,y);
    }
    static parse(inStr) {
        var p= Pt.parse(inStr);
        return p ? new ImagePt(p.x,p.y) : null;
    }
}

export class ScreenPt extends Pt {
    constructor(x,y) {
        super(x,y);
    }
    static parse(inStr) {
        var p= Pt.parse(inStr);
        return p ? new ScreenPt(p.x,p.y) : null;
    }
}



export class ImageWorkSpacePt extends Pt {
    constructor(x,y) {
        super(x,y);
    }
    static parse(inStr) {
        var p= Pt.parse(inStr);
        return p ? new ImageWorkSpacePt(p.x,p.y) : null;
    }
}

/**
 * WorldPt constructor
 * @type {Function}
 * @constructor
 * @alias module:firefly/visualize/Pt.WorldPt
 * @param {number} lon - the longitude
 * @param {number} lat - the latitude
 * @param {CoordinateSys} [coordSys=CoordinateSys.EQ_J2000]- the coordinate system constant
 * @param {string} [objName] - the object name the was used for name resolution
 * @param {Resolver} [resolver] - the resolver use to return this point
 */
export class WorldPt extends Pt {
    constructor(lon,lat,coordSys,objName,resolver) {
        super(lon,lat);

        this.cSys = coordSys || CoordinateSys.EQ_J2000;
        if (objName) {
            this.objName = objName;
        }
        if (resolver) {
            this.resolver = resolver;
        }

    }
    /**
     * Return the lon
     * @type {function(this:exports.WorldPt)}
     * @return {Number}
     */
    getLon() { return this.x; }

    /**
     * Return the lat
     * @type {function(this:exports.WorldPt)}
     * @return {Number}
     */
    getLat() { return this.y; }

    /**
     * Returns the coordinate system of this point
     * @type {function(this:exports.WorldPt)}
     * @returns {CoordinateSys}
     */
    getCoordSys() { return this.cSys; }


    getResolver() { return this.resolver ? this.resolver : null; }

    getObjName() { return (this.objName) ? this.objName : null; }


    /**
     * return the string representation of the WorldPt. This output can be used
     * to recreate a WorldPt using parseWorldPt
     * @see {exports.parseWorldPt}
     * @type {function(this:exports.WorldPt)}
     * @return {string}
     */
    toString() {
        var retval = this.x + ';' + this.y + ';' + this.cSys.toString();
        if (this.objName) {
            retval += ';' + this.objName;
            if (this.resolver) {
                retval += ';' + this.resolver.key;
            }
        }
        return retval;
    }

    static parse(inStr) {
        return parseWorldPt(inStr);
    }
}


function stringAryToWorldPt(wpParts) {
    var retval= null;
    var parsedLon;
    var parseLat;
    var parsedCoordSys;
    if (wpParts.length===3) {
        parsedLon= wpParts[0];
        parseLat= wpParts[1];
        parsedCoordSys= CoordinateSys.parse(wpParts[2]);
        if (!isNaN(parsedLon) && !isNaN(parseLat) && parsedCoordSys!==null) {
            retval= new WorldPt(parsedLon,parseLat,parsedCoordSys);
        }
    }
    else if (wpParts.length===2) {
        parsedLon= wpParts[0];
        parseLat= wpParts[1];
        if (!isNaN(parsedLon) && !isNaN(parseLat)) {
            retval= new WorldPt(parsedLon,parseLat);
        }
    }
    else if (wpParts.length===5 || wpParts.length===4) {
        parsedLon= wpParts[0];
        parseLat= wpParts[1];
        parsedCoordSys= CoordinateSys.parse(wpParts[2]);
        var resolver= wpParts.length===5 ? parseResolver(wpParts[4]) : Resolver.UNKNOWN;
        return new WorldPt(parsedLon,parseLat,parsedCoordSys, wpParts[3],resolver);
    }
    return retval;
}

/**
 *
 * @param serializedWP
 * @return {WorldPt}
 */
export var parseWorldPt = function (serializedWP) {
    if (!serializedWP) return null;

    var sAry= serializedWP.split(';');
    if (sAry.length<2 || sAry.length>5) {
        return null;
    }
    return stringAryToWorldPt(sAry);
};

var Point = { WorldPt, ImagePt, ScreenPt, ImageWorkSpacePt, Pt, parseWorldPt };
export default Point;