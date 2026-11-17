const SPREADSHEET_ID = '133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI';
const SHEET_NAME = 'DATA2';

function doPost(e) {
  try {
    if (!e || !e.parameter) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'No se recibieron datos'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const action = e.parameter.action;
    if (!action) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Falta parámetro action'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    let result;

    if (action === 'guardarOP') {
      const datosJSON = e.parameter.datos;
      if (!datosJSON) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: 'Falta parámetro datos'
        })).setMimeType(ContentService.MimeType.JSON);
      }
      result = guardarOPEnData3(JSON.parse(datosJSON));
    } else {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'Acción no válida'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: result.mensaje,
      data: {
        filaInsertada: result.filaInsertada,
        op: result.op
      }
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Error: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function guardarOPEnData3(datos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const token = ScriptApp.getOAuthToken();
    const baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + SPREADSHEET_ID;
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

    // Obtener sheetId y verificar existencia de la hoja
    const metaResp = UrlFetchApp.fetch(baseUrl + '?fields=sheets(properties(sheetId,title))', {
      method: 'get', headers: headers, muteHttpExceptions: true
    });
    const meta = JSON.parse(metaResp.getContentText());
    let sheetId = null;
    for (const s of meta.sheets) {
      if (s.properties.title === SHEET_NAME) { sheetId = s.properties.sheetId; break; }
    }

    // Crear hoja con headers si no existe
    if (sheetId === null) {
      const addResp = UrlFetchApp.fetch(baseUrl + ':batchUpdate', {
        method: 'post', headers: headers,
        payload: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
        muteHttpExceptions: true
      });
      sheetId = JSON.parse(addResp.getContentText()).replies[0].addSheet.properties.sheetId;
      UrlFetchApp.fetch(baseUrl + '/values/' + encodeURIComponent(SHEET_NAME + '!A1:S1') + '?valueInputOption=RAW', {
        method: 'put', headers: headers,
        payload: JSON.stringify({ values: [['OP','FECHA','PLANTA','GESTOR','AUDITOR','ESCANER','LOTE',
          'REFPROV','DESCRIPCIÓN','CANTIDAD','REFERENCIA','TIPO','PVP','TP','GENERO','PROVEEDOR','ANEXOS','EXTENSIONES','JSON']] }),
        muteHttpExceptions: true
      });
    }

    // Leer columnas A, B, G, J desde fila 2
    const readResp = UrlFetchApp.fetch(
      baseUrl + '/values/' + encodeURIComponent(SHEET_NAME + '!A2:J') + '?majorDimension=ROWS',
      { method: 'get', headers: headers, muteHttpExceptions: true }
    );
    const readData = JSON.parse(readResp.getContentText());
    const filas = (readData.values) ? readData.values : [];

    const opEntrada    = (datos.A        || '').toString().trim();
    const fechaEntrada = (datos.FECHA    || '').toString().trim();
    const cantEntrada  = (datos.CANTIDAD || '').toString().trim();

    const esDuplicado = filas.some(r => {
      const gVal = (r[6] || '').toString().trim();  // col G = OP original
      const bVal = (r[1] || '').toString().trim();  // col B = FECHA
      const jVal = (r[9] || '').toString().trim();  // col J = CANTIDAD
      return gVal === opEntrada && bVal === fechaEntrada && jVal === cantEntrada;
    });

    // Determinar el valor de columna A: OP sola si es nueva, OP.N si ya existe en col G
    let valorA = opEntrada;
    const colG = filas.map(r => (r[6] || '').toString().trim());
    const ocurrencias = colG.filter(v => v === opEntrada).length;
    if (ocurrencias > 0) {
      // Buscar el primer sufijo libre en col A
      const colA = filas.map(r => (r[0] || '').toString().trim());
      let sufijo = 1;
      while (colA.includes(opEntrada + '.' + sufijo)) sufijo++;
      valorA = opEntrada + '.' + sufijo;
    }

    // Preparar fila nueva — col A lleva el valorA calculado, col G siempre la OP original
    const nuevaFila = [
      valorA,
      datos.FECHA || '',
      datos.TALLER || '',
      datos.GESTOR || '',
      datos.AUDITOR || '',
      datos.ESCANER || '',
      datos.LOTE || '',
      datos.REFPROV || '',
      datos.DESCRIPCIÓN || '',
      datos.CANTIDAD || 0,
      datos.REFERENCIA || '',
      datos.TIPO || '',
      datos.PVP || '',
      datos.PRENDA || '',
      datos.GENERO || '',
      datos.PROVEEDOR || '',
      JSON.stringify(datos.ANEXOS || []),
      JSON.stringify(datos.HR || []),
      JSON.stringify(datos)
    ];

    // Formatear celda A2 como texto puro para evitar que Sheets interprete "2425.2" como decimal
    UrlFetchApp.fetch(baseUrl + ':batchUpdate', {
      method: 'post', headers: headers,
      payload: JSON.stringify({
        requests: [
          { insertDimension: {
            range: { sheetId: sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
            inheritFromBefore: false
          }},
          { repeatCell: {
            range: { sheetId: sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 1 },
            cell: { userEnteredFormat: { numberFormat: { type: 'TEXT' } } },
            fields: 'userEnteredFormat.numberFormat'
          }}
        ]
      }),
      muteHttpExceptions: true
    });

    UrlFetchApp.fetch(
      baseUrl + '/values/' + encodeURIComponent(SHEET_NAME + '!A2:S2') + '?valueInputOption=RAW',
      { method: 'put', headers: headers, payload: JSON.stringify({ values: [nuevaFila] }), muteHttpExceptions: true }
    );

    return { filaInsertada: 2, op: valorA, mensaje: `OP ${valorA} guardada exitosamente en fila 2` };

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Servicio DATA2 activo'
  })).setMimeType(ContentService.MimeType.JSON);
}

function solicitarPermisos() {
  // Fuerza el scope de UrlFetchApp
  UrlFetchApp.fetch('https://www.google.com');
  // Fuerza el scope de Sheets API v4
  ScriptApp.getOAuthToken();
  // Fuerza el scope de SpreadsheetApp
  SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('Permisos otorgados correctamente');
}
