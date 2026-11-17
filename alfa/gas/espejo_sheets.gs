/**
 * ============================================================
 * GOOGLE APPS SCRIPT: ESPEJO SUPABASE -> GOOGLE SHEETS
 * Libro ID: 1iXIv5e_CqI25ahuWd4-rfxDfOFnk5N7-8QUoyuW9Rtc
 * ============================================================
 */

// // HOJA PRINCIPAL (Código antiguo): 1O67ydfwQCnW-J-xDwzkghTFUMX9KF4tqizKLCJrz9LM
// // HOJA NUEVA (Backup): 1iXIv5e_CqI25ahuWd4-rfxDfOFnk5N7-8QUoyuW9Rtc
var SPREADSHEET_ID = '1O67ydfwQCnW-J-xDwzkghTFUMX9KF4tqizKLCJrz9LM';
var SHEET_INGRESOS = 'ingresos';
var SHEET_DISTRIBUCIONES = 'distribuciones';

function doPost(e) {
  try {
    var action = e.parameter.action;
    var datosRaw = e.parameter.datos;

    if (!datosRaw) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No datos provided' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var datos = JSON.parse(datosRaw);
    var res;

    if (action === 'guardarIngreso') {
      res = guardarIngreso(datos);
    } else if (action === 'guardarDistribucion') {
      res = guardarDistribucion(datos);
    } else if (action === 'eliminarIngreso') {
      res = eliminarIngreso(datos);
    } else if (action === 'eliminarDistribucion') {
      res = eliminarDistribucion(datos);
    } else {
      res = { status: 'error', message: 'Acción desconocida: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(res))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function guardarIngreso(datos) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_INGRESOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_INGRESOS);
  }

  // 39 Columnas de la tabla ingresos (A hasta AM: fecha_ingreso en AK, created_at en AL, updated_at en AM)
  var defaultHeaders = [
    'id_ingreso', 'fecha_traslado', 'taller', 'linea', 'auditor', 'gestor', 'escaner',
    'lote', 'refprov', 'descripcion', 'descripcion_larga', 'total', 'cantidad',
    'total_relativo', 'total_general', 'diferencia', 'costo_unitario', 'costo_total',
    'auditoria', 'orden_servicio', 'traslado', 'referencia', 'tipo', 'pvp', 'clase',
    'prenda', 'genero', 'marca', 'proveedor', 'productora', 'fuente', 'bolsas',
    'otros_traslados', 'anexos', 'hr', 'detalle_cantidades',
    'fecha_ingreso', 'created_at', 'updated_at'
  ];

  var rowData = buildRowData(sheet, datos, defaultHeaders, true);

  // Buscar si ya existe el registro por id_ingreso y productora
  var targetRow = findRowByIdAndProductora(sheet, String(datos.id_ingreso), String(datos.productora || ''));

  if (targetRow > 1) {
    // Actualizar fila existente
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    return { status: 'success', action: 'updated', row: targetRow, id: datos.id_ingreso };
  } else {
    // Inserta SIEMPRE en la FILA 2 (debajo de los encabezados)
    sheet.insertRowBefore(2);
    sheet.getRange(2, 1, 1, rowData.length).setValues([rowData]);
    return { status: 'success', action: 'inserted', row: 2, id: datos.id_ingreso };
  }
}

function guardarDistribucion(datos) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_DISTRIBUCIONES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_DISTRIBUCIONES);
  }

  // 11 Columnas de la tabla distribuciones (Columna K = created_at)
  var defaultHeaders = [
    'id_distribucion', 'fecha_distribucion', 'datos_distribucion', 'productora',
    'estado', 'colaborador', 'inicio', 'fin', 'duracion', 'pausas',
    'created_at'
  ];

  var rowData = buildRowData(sheet, datos, defaultHeaders, false);

  var targetRow = findRowByIdAndProductora(sheet, String(datos.id_distribucion), String(datos.productora || ''));

  if (targetRow > 1) {
    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    return { status: 'success', action: 'updated', row: targetRow, id: datos.id_distribucion };
  } else {
    // Inserta SIEMPRE en la FILA 2 (debajo de los encabezados)
    sheet.insertRowBefore(2);
    sheet.getRange(2, 1, 1, rowData.length).setValues([rowData]);
    return { status: 'success', action: 'inserted', row: 2, id: datos.id_distribucion };
  }
}

/**
 * Elimina un registro de la hoja 'ingresos' buscando por id_ingreso y productora
 */
function eliminarIngreso(datos) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_INGRESOS);
  if (!sheet) return { status: 'error', message: 'Hoja ingresos no encontrada' };

  var idIngreso = String(datos.id_ingreso || datos.id || '');
  var productora = String(datos.productora || '');
  var targetRow = findRowByIdAndProductora(sheet, idIngreso, productora);

  if (targetRow > 1) {
    sheet.deleteRow(targetRow);
    return { status: 'success', action: 'deleted', row: targetRow, id: idIngreso };
  }
  return { status: 'not_found', action: 'none', id: idIngreso };
}

/**
 * Elimina un registro de la hoja 'distribuciones' buscando por id_distribucion y productora
 */
function eliminarDistribucion(datos) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_DISTRIBUCIONES);
  if (!sheet) return { status: 'error', message: 'Hoja distribuciones no encontrada' };

  var idDist = String(datos.id_distribucion || datos.id || '');
  var productora = String(datos.productora || '');
  var targetRow = findRowByIdAndProductora(sheet, idDist, productora);

  if (targetRow > 1) {
    sheet.deleteRow(targetRow);
    return { status: 'success', action: 'deleted', row: targetRow, id: idDist };
  }
  return { status: 'not_found', action: 'none', id: idDist };
}

/**
 * Mapea dinámicamente los datos a los encabezados reales de la Fila 1 de la hoja.
 */
function buildRowData(sheet, datos, defaultHeaders, isIngreso) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow === 0 || lastCol === 0) {
    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    lastCol = defaultHeaders.length;
  }

  var currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headersLower = currentHeaders.map(function(h) { return String(h).trim().toLowerCase(); });

  var headerAdded = false;

  if (isIngreso) {
    if (headersLower.indexOf('fecha_ingreso') === -1) {
      currentHeaders.push('fecha_ingreso');
      headersLower.push('fecha_ingreso');
      headerAdded = true;
    }
    if (headersLower.indexOf('created_at') === -1 && defaultHeaders.indexOf('created_at') !== -1) {
      currentHeaders.push('created_at');
      headersLower.push('created_at');
      headerAdded = true;
    }
    if (headersLower.indexOf('updated_at') === -1) {
      currentHeaders.push('updated_at');
      headersLower.push('updated_at');
      headerAdded = true;
    }
  } else {
    // Distribuciones: asegurar created_at en la Columna K (11)
    if (headersLower.indexOf('created_at') === -1) {
      currentHeaders.push('created_at');
      headersLower.push('created_at');
      headerAdded = true;
    }
  }

  if (headerAdded) {
    sheet.getRange(1, 1, 1, currentHeaders.length).setValues([currentHeaders]);
  }

  var now = new Date().toISOString();
  var fechaIngreso = datos.fecha_ingreso || datos.created_at || now;
  var createdAt = datos.created_at || datos.fecha_distribucion || datos.fecha_ingreso || now;
  var updatedAt = datos.updated_at || now;

  var rowData = [];
  for (var i = 0; i < currentHeaders.length; i++) {
    var rawHeader = String(currentHeaders[i]).trim();
    var keyLower = rawHeader.toLowerCase();
    var val = '';

    if (keyLower === 'fecha_ingreso') {
      val = isIngreso ? fechaIngreso : (datos.fecha_ingreso || '');
    } else if (keyLower === 'created_at') {
      val = createdAt;
    } else if (keyLower === 'updated_at') {
      val = isIngreso ? updatedAt : (datos.updated_at || '');
    } else {
      var rawVal = datos[rawHeader] !== undefined ? datos[rawHeader] : datos[keyLower];
      if (rawVal === undefined || rawVal === null) {
        val = '';
      } else if (typeof rawVal === 'object') {
        val = JSON.stringify(rawVal);
      } else {
        val = rawVal;
      }
    }

    rowData.push(val);
  }

  return rowData;
}

function findRowByIdAndProductora(sheet, targetId, targetProductora) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;

  var tf = sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(targetId).matchEntireCell(true);
  var results = tf.findAll();

  if (!results || results.length === 0) return -1;

  if (!targetProductora || results.length === 1) {
    return results[0].getRow();
  }

  for (var i = 0; i < results.length; i++) {
    var r = results[i].getRow();
    var rowValues = sheet.getRange(r, 1, 1, 30).getValues()[0];
    var prodInSheet = String(rowValues[29] || rowValues[3] || '');
    if (prodInSheet === targetProductora) {
      return r;
    }
  }

  return results[0].getRow();
}
