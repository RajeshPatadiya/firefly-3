/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */


const SPLIT_TOKEN= '--ClientFitHead--';

import {parseInt} from '../util/StringUtils.js';

export const C = {
    PLANE_NUMBER: 'planeNumber',
    BITPIX: 'bitpix',
    NAXIS: 'naxis',
    NAXIS1: 'naxis1',
    NAXIS2: 'naxis2',
    NAXIS3: 'naxis3',
    CDELT2: 'cdelt2',
    BSCALE: 'bscale',
    BZERO: 'bzero',
    BLANK_VALUE: 'blankValue',
    DATA_OFFSET: 'dataOffset'
};


class ClientFitsHeader {
    constructor(headers) {
        this.headers= headers;
    }


    getPlaneNumber() { return parseInt(this.headers[C.PLANE_NUMBER],0); }
    getBixpix()      { return parseInt(this.headers[C.BITPIX],0); }
    getNaxis()       { return parseInt(this.headers[C.NAXIS],0); }
    getNaxis1()      { return parseInt(this.headers[C.NAXIS1],0); }
    getNaxis2()      { return parseInt(this.headers[C.NAXIS2],0); }
    getNaxis3()      { return parseInt(this.headers[C.NAXIS3],0); }

    getCDelt2() { return parseFloat(this.headers[C.CDELT2],0); }
    getBScale() { return parseFloat(this.headers[C.BSCALE],0); }
    getBZero() { return parseFloat(this.headers[C.BZERO],0); }
    getBlankValue() { return parseFloat(this.headers[C.BLANK_VALUE],0); }
    getDataOffset() { return parseFloat(this.headers[C.DATA_OFFSET],0); }


    setHeader(key, value) { this.header[key]= value; }

}

export default ClientFitsHeader;

export const makeClientFitsHeader= function(headers) {
    return new ClientFitsHeader(headers);
};

