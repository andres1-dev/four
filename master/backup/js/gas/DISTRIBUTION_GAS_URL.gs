const DESTINATION_SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
const DESTINATION_SHEET_NAME = "DATA";

function doPost(e) {
  try {
    // Permitir CORS
    if (e.parameter && e.parameter.callback) {
      return handleJsonP(e);
    }

    let requestData;
    
    // Manejar JSON directo
    if (e.postData && e.postData.type === "application/json") {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (error) {
        // AUN con error de parseo, devolver éxito
        return createJsonResponse(true, 'Datos recibidos (parseo falló)');
      }
    }
    // Manejar form-urlencoded
    else if (e.parameter && e.parameter.datos) {
      try {
        requestData = JSON.parse(e.parameter.datos);
      } catch (error) {
        // AUN con error de parseo, devolver éxito
        return createJsonResponse(true, 'Datos recibidos (parseo falló)');
      }
    }
    
    // Intentar guardar, pero si falla, igual devolver éxito
    try {
      if (requestData && requestData.Documento) {
        saveDistributionFormat(requestData);
        return createJsonResponse(true, 'Datos procesados (intento de guardado realizado)');
      }
    } catch (saveError) {
      console.error('Error en saveDistributionFormat:', saveError);
      // AUN con error de guardado, devolver éxito
      return createJsonResponse(true, 'Procesado (error interno ignorado)');
    }
    
    // Si llegamos aquí, no había datos válidos pero igual éxito
    return createJsonResponse(true, 'Solicitud recibida');
    
  } catch (error) {
    console.error('Error en doPost:', error);
    // IMPORTANTE: SIEMPRE devolver éxito
    return createJsonResponse(true, 'Error interno ignorado');
  }
}

function doGet(e) {
  // Para permitir CORS en pruebas
  return createJsonResponse(true, 'API de Distribuciones activa', {
    version: '1.0',
    format: 'JSON específico con Clientes y distribucion array'
  });
}

// Modificar saveDistributionFormat para que no lance errores
function saveDistributionFormat(distributionData) {
  try {
    const documento = distributionData.Documento;
    const clientes = distributionData.Clientes;
    
    if (!documento || !clientes) {
      console.warn('Datos incompletos para guardar');
      return false; // Solo retorna false, no lanza error
    }
    
    const ss = SpreadsheetApp.openById(DESTINATION_SPREADSHEET_ID);
    let sheet = ss.getSheetByName(DESTINATION_SHEET_NAME);
    
    // Crear hoja si no existe
    if (!sheet) {
      try {
        sheet = ss.insertSheet(DESTINATION_SHEET_NAME);
        const headers = ["Documento", "Fecha", "JSON", "Estado", "Comentarios"];
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setBackground("#4a86e8")
          .setFontColor("white")
          .setFontWeight("bold");
        
        sheet.setColumnWidth(1, 100);
        sheet.setColumnWidth(2, 150);
        sheet.setColumnWidth(3, 500);
        sheet.setColumnWidth(4, 100);
        sheet.setColumnWidth(5, 150);
      } catch (sheetError) {
        console.error('Error creando hoja:', sheetError);
        return false;
      }
    }
    
    // ANALIZAR EL TIPO DE DISTRIBUCIÓN
    let estado, comentarios;
    
    try {
      const nombresClientes = Object.keys(clientes);
      const hayMayoristas = nombresClientes.some(nombre => {
        const cliente = clientes[nombre];
        return !cliente.porcentaje;
      });
      
      const clientesConPorcentaje = nombresClientes.filter(nombre => {
        const cliente = clientes[nombre];
        return cliente.porcentaje;
      });
      
      const hayUnSoloCliente100Porciento = clientesConPorcentaje.length === 1 && 
                                           clientesConPorcentaje.some(nombre => {
                                             const cliente = clientes[nombre];
                                             return cliente.porcentaje === "100%" || 
                                                    cliente.porcentaje === "100" ||
                                                    cliente.porcentaje === 100;
                                           });
      
      if (!hayMayoristas && hayUnSoloCliente100Porciento) {
        estado = "DIRECTO";
        comentarios = "SIN SEPARACIÓN";
      } else {
        estado = "PENDIENTE";
        comentarios = "";
      }
    } catch (analysisError) {
      console.error('Error analizando distribución:', analysisError);
      estado = "PENDIENTE";
      comentarios = "";
    }
    
    // Obtener todos los datos
    let data;
    try {
      data = sheet.getDataRange().getValues();
    } catch (dataError) {
      console.error('Error obteniendo datos:', dataError);
      data = [[], []]; // Datos vacíos
    }
    
    // Buscar documento existente
    let documentoExistenteFila = -1;
    
    for (let i = 1; i < data.length; i++) {
      const celdaDocumento = data[i] && data[i][0];
      if (celdaDocumento && celdaDocumento.toString() === documento.toString()) {
        documentoExistenteFila = i + 1;
        break;
      }
    }
    
    const formattedDate = Utilities.formatDate(new Date(), "America/Bogota", "d/M/yyyy HH:mm:ss");
    const jsonMinify = JSON.stringify(distributionData);
    
    // Si el documento ya existe, actualizarlo
    if (documentoExistenteFila > 0) {
      try {
        sheet.getRange(documentoExistenteFila, 2).setValue(formattedDate);
        sheet.getRange(documentoExistenteFila, 3).setValue(jsonMinify);
        sheet.getRange(documentoExistenteFila, 4).setValue(estado);
        sheet.getRange(documentoExistenteFila, 5).setValue(comentarios);
        
        const estadoCell = sheet.getRange(documentoExistenteFila, 4);
        if (estado === "DIRECTO") {
          estadoCell.setBackground("#b6d7a8");
        } else {
          estadoCell.setBackground("#ffe599");
        }
        
        console.log(`Documento ${documento} actualizado en fila ${documentoExistenteFila}`);
        return true;
      } catch (updateError) {
        console.error('Error actualizando documento:', updateError);
        return false;
      }
    }
    
    // Si es un documento NUEVO, insertar en la fila 2
    const filaDestino = 2;
    
    try {
      const ultimaFila = sheet.getLastRow();
      
      if (ultimaFila >= 2) {
        sheet.insertRowBefore(filaDestino);
        sheet.getRange(filaDestino, 1, 1, 5).setValues([[
          documento,
          formattedDate,
          jsonMinify,
          estado,
          comentarios
        ]]);
      } else {
        sheet.getRange(filaDestino, 1, 1, 5).setValues([[
          documento,
          formattedDate,
          jsonMinify,
          estado,
          comentarios
        ]]);
      }
      
      const estadoCell = sheet.getRange(filaDestino, 4);
      if (estado === "DIRECTO") {
        estadoCell.setBackground("#b6d7a8");
      } else {
        estadoCell.setBackground("#ffe599");
      }
      
      sheet.setRowHeight(filaDestino, 21);
      
      console.log(`Documento ${documento} creado en fila ${filaDestino}`);
      return true;
      
    } catch (insertError) {
      console.error('Error insertando documento:', insertError);
      return false;
    }
    
  } catch (error) {
    console.error('Error crítico en saveDistributionFormat:', error);
    return false;
  }
}

function createJsonResponse(success, message, data = {}) {
  const response = {
    success: success,
    message: message,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function handleJsonP(e) {
  const callback = e.parameter.callback;
  const response = { success: true, message: "JSONP response" };
  
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(response) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}