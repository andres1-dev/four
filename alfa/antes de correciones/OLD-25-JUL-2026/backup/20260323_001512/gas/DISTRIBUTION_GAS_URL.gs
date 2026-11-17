const DESTINATION_SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
const DESTINATION_SHEET_NAME = "DATA";

function doPost(e) {
  try {
    if (!e || !e.parameter || !e.parameter.datos) {
      return crearRespuesta(false, 'Sin datos');
    }

    const requestData = JSON.parse(e.parameter.datos);
    
    if (!requestData.Documento) {
      return crearRespuesta(false, 'Sin documento');
    }
    
    const result = saveDistributionFormat(requestData);
    return crearRespuesta(result.success, result.mensaje, result);
    
  } catch (error) {
    return crearRespuesta(false, error.message);
  }
}

function saveDistributionFormat(distributionData) {
  const lock = LockService.getScriptLock();
  lock.waitLock(3000);

  try {
    const documento = distributionData.Documento;
    const clientes = distributionData.Clientes;
    
    if (!documento || !clientes) {
      return { success: false, mensaje: 'Datos incompletos' };
    }
    
    const token = ScriptApp.getOAuthToken();
    const baseUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + DESTINATION_SPREADSHEET_ID;
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

    // PASO 1: Obtener sheetId
    const metaResp = UrlFetchApp.fetch(baseUrl + '?fields=sheets(properties(sheetId,title))', {
      method: 'get', headers: headers, muteHttpExceptions: true
    });
    const meta = JSON.parse(metaResp.getContentText());
    let sheetId = null;
    
    for (const s of meta.sheets) {
      if (s.properties.title === DESTINATION_SHEET_NAME) { 
        sheetId = s.properties.sheetId; 
        break; 
      }
    }

    // Crear hoja si no existe (solo primera vez)
    if (sheetId === null) {
      const addResp = UrlFetchApp.fetch(baseUrl + ':batchUpdate', {
        method: 'post', headers: headers,
        payload: JSON.stringify({ 
          requests: [{ addSheet: { properties: { title: DESTINATION_SHEET_NAME } } }] 
        }),
        muteHttpExceptions: true
      });
      sheetId = JSON.parse(addResp.getContentText()).replies[0].addSheet.properties.sheetId;
      
      // Escribir headers
      UrlFetchApp.fetch(baseUrl + '/values/' + encodeURIComponent(DESTINATION_SHEET_NAME + '!A1:E1') + '?valueInputOption=RAW', {
        method: 'put', headers: headers,
        payload: JSON.stringify({ values: [['Documento', 'Fecha', 'JSON', 'Estado', 'Comentarios']] }),
        muteHttpExceptions: true
      });
    }
    
    // PASO 2: Analizar tipo de distribución
    const nombresClientes = Object.keys(clientes);
    const esDirecto = nombresClientes.length === 1 && 
      nombresClientes.some(nombre => {
        const p = clientes[nombre].porcentaje;
        return p === "100%" || p === "100" || p === 100;
      });
    
    const estado = esDirecto ? "DIRECTO" : "PENDIENTE";
    const comentarios = ""; // Siempre vacío
    const formattedDate = Utilities.formatDate(new Date(), "America/Bogota", "d/M/yyyy HH:mm:ss");
    const jsonData = JSON.stringify(distributionData);
    
    // PASO 3: Buscar el documento en TODA la columna A (no solo primeras 5 filas)
    const readResp = UrlFetchApp.fetch(
      baseUrl + '/values/' + encodeURIComponent(DESTINATION_SHEET_NAME + '!A:A') + '?majorDimension=ROWS',
      { method: 'get', headers: headers, muteHttpExceptions: true }
    );
    const readData = JSON.parse(readResp.getContentText());
    const filas = (readData.values) ? readData.values : [];
    
    let documentoExistenteFila = -1;
    // Buscar desde fila 2 (índice 1) en adelante
    for (let i = 1; i < filas.length; i++) {
      if (filas[i][0] && filas[i][0].toString() === documento.toString()) {
        documentoExistenteFila = i + 1; // +1 porque las filas empiezan en 1
        break;
      }
    }
    
    // Si existe, actualizar en la fila exacta donde está
    if (documentoExistenteFila > 0) {
      UrlFetchApp.fetch(baseUrl + ':batchUpdate', {
        method: 'post',
        headers: headers,
        payload: JSON.stringify({
          requests: [{
            updateCells: {
              range: { 
                sheetId: sheetId, 
                startRowIndex: documentoExistenteFila - 1, 
                endRowIndex: documentoExistenteFila, 
                startColumnIndex: 1, 
                endColumnIndex: 5 
              },
              rows: [{
                values: [
                  { userEnteredValue: { stringValue: formattedDate } },
                  { userEnteredValue: { stringValue: jsonData } },
                  { userEnteredValue: { stringValue: estado } },
                  { userEnteredValue: { stringValue: comentarios } }
                ]
              }],
              fields: 'userEnteredValue'
            }
          }]
        }),
        muteHttpExceptions: true
      });
      
      return { success: true, mensaje: 'Actualizado', fila: documentoExistenteFila };
    }
    
    // PASO 4: No existe, insertar nuevo en fila 2 (batch: insertar + escribir)
    const requests = [
      {
        insertDimension: {
          range: { sheetId: sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
          inheritFromBefore: false
        }
      },
      {
        updateCells: {
          range: { sheetId: sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 5 },
          rows: [{
            values: [
              { userEnteredValue: { stringValue: documento } },
              { userEnteredValue: { stringValue: formattedDate } },
              { userEnteredValue: { stringValue: jsonData } },
              { userEnteredValue: { stringValue: estado } },
              { userEnteredValue: { stringValue: comentarios } }
            ]
          }],
          fields: 'userEnteredValue'
        }
      }
    ];
    
    UrlFetchApp.fetch(baseUrl + ':batchUpdate', {
      method: 'post',
      headers: headers,
      payload: JSON.stringify({ requests: requests }),
      muteHttpExceptions: true
    });
    
    return { success: true, mensaje: 'Guardado', fila: 2 };
    
  } catch (error) {
    return { success: false, mensaje: error.message };
  } finally {
    lock.releaseLock();
  }
}

function crearRespuesta(success, message, data = {}) {
  return ContentService.createTextOutput(JSON.stringify({
    success: success,
    message: message,
    data: data
  })).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return crearRespuesta(true, 'API Distribuciones v4');
}

function solicitarPermisos() {
  UrlFetchApp.fetch('https://www.google.com');
  ScriptApp.getOAuthToken();
  SpreadsheetApp.openById(DESTINATION_SPREADSHEET_ID);
  Logger.log('Permisos OK');
}
