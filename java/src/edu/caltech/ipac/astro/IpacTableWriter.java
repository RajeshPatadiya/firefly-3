package edu.caltech.ipac.astro;

import edu.caltech.ipac.util.Assert;
import edu.caltech.ipac.util.DataGroup;
import edu.caltech.ipac.util.DataObject;
import edu.caltech.ipac.util.DataType;
import edu.caltech.ipac.util.action.ClassProperties;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.util.Arrays;
import java.util.Set;
import java.util.Locale;

/**
 * This class handles an action to save a catalog in IPAC table format to local file.
 *
 * @author Xiuqin Wu
 * @see DataGroup
 * @see edu.caltech.ipac.util.DataObject
 * @see DataType
 * @version $Id: IpacTableWriter.java,v 1.11 2012/08/10 20:58:28 tatianag Exp $
 */
public class IpacTableWriter {
    private final static ClassProperties _prop =
            new ClassProperties(IpacTableWriter.class);
    private static final String LINE_SEP = "\n";

    public final static String BACKSLASH = "\\";

    // constants
    //private final static int DECIMAL_MAX = _prop.getIntValue("precision.max");
    //private final static int DECIMAL_MIN = _prop.getIntValue("precision.min");
    private final static int COL_LENGTH = _prop.getIntValue("column.length");
    // header names & constants
    private final static String NULL_STRING = "null";
    private final static String SEPARATOR = "|";
    private final static String EMPTY_SEPARATOR = " ";
    private final static String NOTHING = " ";
    //private static final NumberFormat _decimal = new DecimalFormat();
    //private static final String _maxColumn;

    static {
        char[] maxColumn = new char[COL_LENGTH];
        //_decimal.setMaximumFractionDigits(DECIMAL_MAX);
        //_decimal.setMinimumFractionDigits(DECIMAL_MIN);
        Arrays.fill(maxColumn, ' ');
        //_maxColumn = new String(maxColumn);
    }

    /**
     * constructor
     */
    private IpacTableWriter() { /*is never called*/
    }

    /**
     * save the catalogs to a file
     *
     * @param file the file name to be saved
     * @param dataGroup data group
     * @throws IOException on error
     */
    public static void save(File file, DataGroup dataGroup)
        throws IOException {
        PrintWriter out = null;
        try {
            out = new PrintWriter(new BufferedWriter(new FileWriter(file)));
            save(out, dataGroup);
        } finally {
            if (out != null) out.close();
        }
    }

    /**
     * save the catalogs to a stream, stream is not closed
     *
     * @param stream the output stream to write to
     * @param dataGroup data group
     * @throws IOException on error
     */
    public static void save(OutputStream stream, DataGroup dataGroup)
            throws IOException {
        save(new PrintWriter(stream), dataGroup);
    }

    private static void save(PrintWriter out, DataGroup dataGroup)
        throws IOException {
        DataType dataType[] = dataGroup.getDataDefinitions();
        int totalRow = dataGroup.size();
        writeHeader(out, dataGroup);
        for (int i = 0; i < totalRow; i++)
            out.print(extractData(dataGroup.get(i), dataType) + LINE_SEP);
        out.flush();
    }


    // ============================================================
    // ----------------------------------- Private Methods ---------------------------------------
    // ============================================================

    /**
     * extract data
     *
     * @param dataObject a fixed object
     * @param dataType array of data types
     * @return string
     */
    private static String extractData(DataObject dataObject,
                                      DataType dataType[]) {
        StringBuffer extraData = new StringBuffer();
        Object value;
        for (DataType dt : dataType) {
            value = dataObject.getDataElement(dt);
            if (value == null && dt.getMayBeNull()) {
                extraData.append(EMPTY_SEPARATOR).append(dt.getFormatInfo().formatData(Locale.US, value, NULL_STRING));
            } else {
                extraData.append(EMPTY_SEPARATOR).append(dt.getFormatInfo().formatData(Locale.US, value, NOTHING));
            }
        }
        return extraData.append(" ").toString();
    }

    /**
     * write out the header of the catalog
     *
     * @param out the writer
     * @param dataGroup data group
     */
    private static void writeHeader(PrintWriter out, DataGroup dataGroup) {
        DataType[] dataType = dataGroup.getDataDefinitions();

        writeAttribute(out, dataGroup);
        writeName(out, dataType);
        writeDataType(out, dataType);

        // do not write out the optional header line s
        // if no unit or null info is available
        // (no unit or null headers in the original)
        boolean noMoreHeaders = true;
        for (DataType dt : dataType) {
            if (dt.getDataUnit() != null || dt.getMayBeNull()) {
                noMoreHeaders = false;
                break;
            }
        }
        if (noMoreHeaders) return;

        writeDataUnit(out, dataType);
        writeIsNullAllowed(out, dataType);
    }

    private static void writeAttribute(PrintWriter out, DataGroup dataGroup) {
        Set keys = dataGroup.getAttributeKeys();
        for (Object key : keys) {
            DataGroup.Attribute attrib = dataGroup.getAttribute(key.toString());
            String type = "";
            if (attrib.hasType()) {
                if (IpacTableReader.isRecongnizedType(attrib.getType())) {
                    type = attrib.getType() + " ";
                } else {
                    // handle invalid type, skip bad attributes for now;
                    continue;
                }
            }
            out.print(BACKSLASH + type + attrib.getKey() + " = " + attrib.formatValue(Locale.US) + LINE_SEP);
        }
    }

    /**
     * write out the header (data name) of the catalog
     *
     * @param out the writer
     * @param dataType array of data types
     */
    private static void writeName(PrintWriter out, DataType dataType[]) {
        for (DataType dt : dataType) {
            DataType.FormatInfo info = dt.getFormatInfo();
            out.print(SEPARATOR + info.formatHeader(dt.getKeyName()));
        }
        out.print(SEPARATOR + LINE_SEP);
    }

    /**
     * write out the header (data type) of the catalog
     *
     * @param out the writer
     * @param dataType array of data types
     */
    private static void writeDataType(PrintWriter out,
                                      DataType dataType[]) {
        for (DataType dt : dataType) {
            DataType.FormatInfo info = dt.getFormatInfo();

            // handle invalid type, throw runtime exeption for now
            Assert.tst(IpacTableReader.isRecongnizedType(dt.getTypeDesc()),
                    "Invalid data Type:" + dt.getTypeDesc());

            out.print(SEPARATOR + info.formatHeader(dt.getTypeDesc()));
        }
        out.print(SEPARATOR + LINE_SEP);
    }

    /**
     * write out the header (data unit) of the catalog
     *
     * @param out the writer
     * @param dataType array of data types
     *
     */
    private static void writeDataUnit(PrintWriter out,
                                      DataType dataType[]) {
        for (DataType dt : dataType) {
            DataType.FormatInfo info = dt.getFormatInfo();
            if (dt.getDataUnit() == null ) {
                out.print(SEPARATOR + info.formatHeader(NOTHING));
            } else {
                out.print(SEPARATOR + info.formatHeader(dt.getDataUnit()));
            }
        }
        out.print(SEPARATOR + LINE_SEP);
    }

    /**
     * write out the header (may be null) of the catalog
     *
     * @param out the writer
     * @param dataType array of data types
     */
    private static void writeIsNullAllowed(PrintWriter out,
                                           DataType dataType[]) {
        for (DataType dt : dataType) {
            DataType.FormatInfo info = dt.getFormatInfo();
            if (dt.getMayBeNull()) {
                out.print(SEPARATOR + info.formatHeader(NULL_STRING));
            } else {
                out.print(SEPARATOR + info.formatHeader(NOTHING));
            }
        }
        out.print(SEPARATOR + LINE_SEP);
    }

}

/*
 * THIS SOFTWARE AND ANY RELATED MATERIALS WERE CREATED BY THE CALIFORNIA
 * INSTITUTE OF TECHNOLOGY (CALTECH) UNDER A U.S. GOVERNMENT CONTRACT WITH
 * THE NATIONAL AERONAUTICS AND SPACE ADMINISTRATION (NASA). THE SOFTWARE
 * IS TECHNOLOGY AND SOFTWARE PUBLICLY AVAILABLE UNDER U.S. EXPORT LAWS
 * AND IS PROVIDED AS-IS TO THE RECIPIENT WITHOUT WARRANTY OF ANY KIND,
 * INCLUDING ANY WARRANTIES OF PERFORMANCE OR MERCHANTABILITY OR FITNESS FOR
 * A PARTICULAR USE OR PURPOSE (AS SET FORTH IN UNITED STATES UCC 2312-2313)
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