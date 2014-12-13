package edu.caltech.ipac.visualize.net;

import edu.caltech.ipac.astro.ned.NedException;
import edu.caltech.ipac.astro.ned.NedObject;
import edu.caltech.ipac.astro.ned.NedReader;
import edu.caltech.ipac.astro.ned.NedResultSet;
import edu.caltech.ipac.client.net.FailedRequestException;
import edu.caltech.ipac.client.net.ThreadedService;
import edu.caltech.ipac.util.AppProperties;
import edu.caltech.ipac.util.action.ClassProperties;

import java.awt.Window;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.net.UnknownHostException;
import java.text.DecimalFormat;
import java.text.NumberFormat;
import java.util.Arrays;
import java.util.Enumeration;

/**
 * This class handles to get catalogs for NED.
 * @author Michael Nguyen
 * @see edu.caltech.ipac.client.net.ThreadedService
 * @see edu.caltech.ipac.astro.ned.NedReader
 * @see edu.caltech.ipac.astro.ned.NedResultSet
 * @see edu.caltech.ipac.astro.ned.NedObject
 */

public class NedCatalogGetter extends ThreadedService
{
  private final static String BACKSLASH = "\\";
  private final static String FIXLEN = BACKSLASH + "fixlen = ";
  private final static String FIXLEN_VALUE = "T";
  private final static String ROWS_RETRIEVED = 
                                             BACKSLASH + "RowsRetreived = ";
  private final static String CAT_NAME = BACKSLASH + "CatName = ";

  private final static String DOUBLE = "double";
  private final static String INTEGER = "int";
  private final static String CHAR = "char";

  private final static String DEGREE = "degrees";
  private final static String NOTHING = " ";

  private final static String SEPARATOR = "|";
  private final static String EMPTY_SEPARATOR = " ";
  private final static String NULL_IS_ALLOWED = "null";

  /*
   * Temporary: num_note, num_photo, num_ref, distance, and ref_code
   * are not needed right now.
   */
  private final static String[] _names = 
  { 
    "target", "ra", "dec", /*"num_note", "num_photo", "num_ref", "distance",*/ "type", 
    "unc_major", "unc_minor", "unc_angle" /*, "ref_code"*/ 
  };

  private final static String[] _dataTypes =
  { 
    CHAR, DOUBLE, DOUBLE, /*INTEGER, INTEGER, 
    INTEGER, DOUBLE,*/ CHAR, DOUBLE, DOUBLE, DOUBLE /*, CHAR*/ 
  };

  private final static String[] _dataUnits =
  {
    NOTHING, DEGREE, DEGREE, /*NOTHING, NOTHING, NOTHING, 
    NOTHING , */ NOTHING, NOTHING, NOTHING, NOTHING /*, NOTHING*/
  };

  private final static int NED_OBJECT_TOTAL = _names.length;

  private final static ClassProperties _prop = 
               new ClassProperties(NedCatalogGetter.class);

  // constants
  private final static int DECIMAL_MAX = 
     AppProperties.getIntProperty("NedCatalogGetter.precision.max",0);
  private final static int DECIMAL_MIN = 
     AppProperties.getIntProperty("NedCatalogGetter.precision.min",0);
  private final static int COL_LENGTH =
     AppProperties.getIntProperty("NedCatalogGetter.column.length",0);

  private final static String   OP_DESC = _prop.getName("desc");
  private static String _maxColumn;
  private static NumberFormat _decimal = new DecimalFormat();
  private NedCatalogParams _params;
  private File _outFile;

  /**
   * constructor
   * @param params the Ned Catalog Parameters
   * @param outFile the File
   */
  private NedCatalogGetter(NedCatalogParams params, File outFile, Window w)
  {
    super(w);
    char[] maxColumn = new char[COL_LENGTH];

    _params = params;
    _outFile = outFile;
    _decimal.setMaximumFractionDigits(DECIMAL_MAX); 
    _decimal.setMinimumFractionDigits(DECIMAL_MIN); 
    Arrays.fill(maxColumn, ' ');
    _maxColumn = new String(maxColumn);
     setOperationDesc(OP_DESC);
  }

  /**
   * get the catalog
   * @exception Exception
   */
  protected void doService() throws Exception
  {
    lowlevelGetCatalog(_params, _outFile);
  }

  /**
   * get the catalog
   * @param params the Ned Catalog Parameters
   * @param outFile the File
   * @param w the Window
   * @exception FailedRequestException
   */
  public static void getCatalog(NedCatalogParams params,
                                File outFile, Window w)
              throws FailedRequestException
  {
    NedCatalogGetter action = new NedCatalogGetter(params, outFile,w);
    action.execute();
  }

  /**
   * get the catalog
   * @param params the Ned Catalog Parameters
   * @param outFile the File
   * @exception FailedRequestException
   */  
  public static void lowlevelGetCatalog(NedCatalogParams params,
                                        File outFile)
              throws FailedRequestException
  {
    NedReader nedReader = new NedReader();
    NedResultSet nedObjects = null;
    try
    {
      nedReader.connect();
      nedObjects = nedReader.searchNearPosition(params.getRaJ2000(), 
                            params.getDecJ2000(), params.getSize()*60.0);
                            // NED radius is in arcmin, Spot in degree
      nedReader.disconnect();
    }  
    catch (UnknownHostException uhe) { uhe.printStackTrace(); }
    catch (NedException ne) { ne.printStackTrace(); }
    catch (IOException ioe) { ioe.printStackTrace(); }
    catch (Exception x) { x.printStackTrace(); }
 
     if ((nedObjects != null) && (nedObjects.size() > 0))
       lowlevelGetCatalog(nedObjects, params, outFile);
  }


  // ============================================================
  // ----------------------------------- Private Methods --------
  // ============================================================


  /**
   * get the catalog
   * @param nedObjects the Ned Result Set
   * @param params the Ned Catalog Parameters
   * @param outFile the File
   */  
  private static void lowlevelGetCatalog(NedResultSet nedObjects, 
					 NedCatalogParams params, File outFile)
  {
    PrintWriter out = null;
    try
    {
      out = new PrintWriter(new BufferedWriter(new FileWriter(outFile))); 
      writeHeader(nedObjects, params, out);
      for (Enumeration i = nedObjects.elements(); i.hasMoreElements(); )
        out.println(extractData((NedObject)i.nextElement()));     
    }
    catch (IOException ioe) { ioe.printStackTrace(); }
    finally { if (out != null) out.close(); }
  }

  /**
   * extract data
   * @param nedObject the Ned Object
   */
  private static String extractData(NedObject nedObject)
  {
    String data = 
    EMPTY_SEPARATOR + validate(nedObject.getName()) +      
    EMPTY_SEPARATOR + validate(_decimal.format(nedObject.getRA())) +
    EMPTY_SEPARATOR + validate(_decimal.format(nedObject.getDec())) +
    /* Temporary: num_nodes, num_photos, num_refs, distance, and ref_code are not
       needed right now.
    EMPTY_SEPARATOR + validate(String.valueOf(nedObject.getNumberOfNotes())) +
    EMPTY_SEPARATOR + validate(String.valueOf(nedObject.getNumberOfPhotos())) +
    EMPTY_SEPARATOR + validate(String.valueOf(nedObject.getNumberOfReferences())) +
    EMPTY_SEPARATOR + validate(_decimal.format(nedObject.getDistanceToSearchCenter())) + */
    EMPTY_SEPARATOR + validate(nedObject.getType()) +
    EMPTY_SEPARATOR + validate(_decimal.format(nedObject.getUncertaintyMajor())) +
    EMPTY_SEPARATOR + validate(_decimal.format(nedObject.getUncertaintyMinor())) +
    EMPTY_SEPARATOR + validate(_decimal.format(nedObject.getUncertaintyAngle()));
    /*EMPTY_SEPARATOR + validate(nedObject.getReferenceCode());*/
    return data;
  }

  /**
   * write out the header of the catalog
   * @param nedObjects the Ned Result Set
   * @param params the Ned Catalog Parameters
   * @param out the PrintWriter
   */
  private static void writeHeader(NedResultSet nedObjects, 
                                  NedCatalogParams params, PrintWriter out)
  {
    out.println(FIXLEN + FIXLEN_VALUE);
    out.println(ROWS_RETRIEVED + nedObjects.size());
    out.println(CAT_NAME + params.getCatalogName());
    writeName(out);
    writeDataType(out);
    writeDataUnit(out);
    writeIsNullAllowed(out);
  }

  /**
   * write out the header (data name) of the catalog
   * @param out the PrintWriter
   */
  private static void writeName(PrintWriter out) { write(out, _names); }

  /**
   * write out the header (data type) of the catalog
   * @param out the PrintWriter
   */
  private static void writeDataType(PrintWriter out) { write(out, _dataTypes); }

  /**
   * write out the header (data unit) of the catalog
   * @param out the PrintWriter
   */
  private static void writeDataUnit(PrintWriter out) { write(out, _dataUnits); }

  /**
   * write out the header (data unit) of the catalog
   * @param out the PrintWriter
   * @param data the array string data objects
   */
  private static void write(PrintWriter out, String[] data)
  {
    for (int i = 0; i < data.length; i++)
      out.print(SEPARATOR + fitColumn(data[i]));
    out.println(SEPARATOR);
  }

  /**
   * write out the header (may be null) of the catalog
   * @param out the PrintWriter
   */
  private static void writeIsNullAllowed(PrintWriter out)
  {
    for (int i = 0; i < NED_OBJECT_TOTAL; i++)
      out.print(SEPARATOR + fitColumn(NULL_IS_ALLOWED));
    out.println(SEPARATOR);
  }

  /**
   * format the data
   * @param value the string to be formatted
   */
  private static String fitColumn(String value)
  {
    String retValue;
    if (value == null || value.trim().length() == 0)
       retValue = new String(_maxColumn);
    else
       retValue =  _maxColumn.substring(0, COL_LENGTH - value.length()) + value;
    return retValue;
  }

  /**
   * validate the value
   * @param valid the requirement
   * @param value the input string
   */
  private static String validate(boolean valid, String value)
  {
    return ((valid) ? fitColumn(value) : fitColumn(NOTHING)); 
  }

  /**
   * validate the value
   * @param value the input string
   */
  private static String validate(String value)
  {
    return ((value != null) ? fitColumn(value) : fitColumn(NOTHING)); 
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