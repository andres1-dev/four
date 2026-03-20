// GAS para Gestionar Datos Faltantes (SISPROWEB y COLORES)
const SPREADSHEET_ID = '133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI';

function doPost(e) {
  try {
    if (!e || !e.parameter) {
      return crearRespuesta(false, 'No se recibieron datos');
    }
    
    const action = e.parameter.action;
    const datosJSON = e.parameter.datos;
    
    if (!action || !datosJSON) {
      return crearRespuesta(false, 'Faltan parámetros (action o datos)');
    }
    
    const datos = JSON.parse(datosJSON);
    let result;
    
    if (action === 'appendData') {
      result = agregarSISPROWEB(datos);
    } else if (action === 'appendColor') {
      result = agregarColores(datos);
    } else {
      return crearRespuesta(false, 'Acción no válida');
    }
    
    return crearRespuesta(true, result.mensaje, result);
    
  } catch (error) {
    return crearRespuesta(false, 'Error: ' + error.message);
  }
}

/**
 * Agrega registros a la hoja SISPROWEB evitando duplicados por Columna C.
 * Si el registro ya existe pero col E (referencia) está vacía, la actualiza.
 */
function agregarSISPROWEB(datos) {
  const SHEET_NAME = 'SISPROWEB';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Columna C', 'Columna AJ', 'Columna AK', 'Columna AL', 'Columna B']);
  }

  const lastRow = sheet.getLastRow();
  // Leer cols A-E de todas las filas existentes en una sola llamada
  const allData = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 5).getValues() : [];

  // Mapa: OP -> índice 0-based
  const opRowMap = {};
  allData.forEach((r, i) => {
    const op = String(r[0] || '').trim().toUpperCase();
    if (op) opRowMap[op] = i;
  });

  const nuevos = [];
  const actualizaciones = [];
  let duplicados = 0;

  datos.forEach(reg => {
    const id = String(reg['Columna C'] || '').trim().toUpperCase();
    if (!id || isNaN(id)) return;

    const referencia = String(reg['Columna B'] || '').trim();

    if (opRowMap.hasOwnProperty(id)) {
      const i = opRowMap[id];
      const refActual = String(allData[i][4] || '').trim(); // col E = índice 4
      if (!refActual && referencia) {
        actualizaciones.push({ rowIndex: i + 2, referencia }); // i+2: 1-based + header
      } else {
        duplicados++;
      }
    } else {
      nuevos.push([
        reg['Columna C'] || '',
        reg['Columna AJ'] || '',
        reg['Columna AK'] || '',
        reg['Columna AL'] || '',
        referencia
      ]);
      opRowMap[id] = lastRow + nuevos.length - 1;
    }
  });

  if (nuevos.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, nuevos.length, 5).setValues(nuevos);
  }

  if (actualizaciones.length > 0) {
    actualizaciones.forEach(({ rowIndex, referencia }) => {
      sheet.getRange(rowIndex, 5).setValue(referencia);
    });
    SpreadsheetApp.flush();
  }

  return {
    mensaje: `${nuevos.length} nuevos, ${actualizaciones.length} referencias actualizadas, ${duplicados} sin cambios`,
    registrosNuevos: nuevos.length,
    referenciasActualizadas: actualizaciones.length,
    registrosDuplicados: duplicados
  };
}

/**
 * Agrega registros a la hoja COLORES evitando duplicados por Código
 */
function agregarColores(datos) {
  const SHEET_NAME = 'COLORES';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['CODIGO', 'COLOR']);
  }
  
  const existentes = obtenerSetExistentes(sheet, 1); // Columna 1 (Código)
  const nuevos = [];
  let duplicados = 0;
  
  datos.forEach(reg => {
    const id = String(reg.codigo || '').trim().toUpperCase();
    if (id && !existentes.has(id)) {
      nuevos.push([
        reg.codigo || '',
        reg.nombre || ''
      ]);
      existentes.add(id);
    } else {
      duplicados++;
    }
  });
  
  if (nuevos.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, nuevos.length, 2).setValues(nuevos);
  }
  
  return {
    mensaje: `Se agregaron ${nuevos.length} colores (${duplicados} omitidos)`,
    registrosNuevos: nuevos.length,
    registrosDuplicados: duplicados
  };
}

/**
 * Utilidad para obtener un Set de valores existentes en una columna
 */
function obtenerSetExistentes(sheet, colIndex) {
  const total = sheet.getLastRow();
  const set = new Set();
  if (total > 1) {
    const data = sheet.getRange(2, colIndex, total - 1, 1).getValues();
    data.forEach(r => {
      if (r[0]) set.add(String(r[0]).trim().toUpperCase());
    });
  }
  return set;
}

function crearRespuesta(success, message, data = {}) {
  return ContentService.createTextOutput(JSON.stringify({
    success: success,
    message: message,
    data: data
  })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return crearRespuesta(true, 'Servicio de Datos Activo');
}