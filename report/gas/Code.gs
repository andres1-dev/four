/* ==========================================================================
   Code.gs — Google Apps Script para recibir reportes desde el frontend
   
   Desplegado como Web App.
   Endpoint: doPost recibe datos JSON via POST.
   Escribe en el mismo libro usado por el front:
     - Hoja "NOVEDADES" → Reportes de novedades
     - Hoja "REPORTES"  → Reportes de calidad
     - Hoja "PLANTAS"   → Datos de actualización de plantas
   
   Los datos SIEMPRE se insertan en la fila 2 (después de headers),
   de modo que los registros más recientes quedan arriba.
   ========================================================================== */

const SPREADSHEET_ID = '1ZLGG8wfszE6D8vGwCECWguWGUiDXGUGfN87ZukyaCpo';

/** Carpeta raíz en Drive para adjuntos */
const CARPETA_RAIZ_ID = '1jeZrMgwwhBHA5G4oUqRHNDGhAEx2LMGQ';

/** Prefijo para generar URL pública de imagen desde Drive */
const DRIVE_IMAGE_PREFIX = 'https://lh3.googleusercontent.com/d/';

/* ══════════════════════════════════════════════════════════════════════════
   ENDPOINTS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Maneja las peticiones POST del frontend.
 * @param {Object} e — Evento de Apps Script con .postData.contents.
 * @returns {ContentService.TextOutput} Respuesta JSON.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // ── Acción para actualizar el estado en el módulo de resoluciones ──
    if (data.accion === "UPDATE_ESTADO") {
      return updateEstadoNovedad(data);
    }
    // ── Acción para corregir fechas (Módulo de impresión) ──
    if (data.accion === "UPDATE_FECHAS") {
      return updateFechasNovedad(data);
    }

    const hojaDestino = data.hoja; // "NOVEDADES", "REPORTES" o "PLANTAS"

    if (!hojaDestino) {
      return buildResponse(false, 'No se especificó la hoja destino.');
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(hojaDestino);

    // Si la hoja no existe, crearla con encabezados
    if (!sheet) {
      sheet = ss.insertSheet(hojaDestino);
      const headers = getHeaders(hojaDestino);
      sheet.appendRow(headers);
    }

    // Procesar archivo adjunto (si existe)
    let archivoUrl = '';
    if (hojaDestino === 'NOVEDADES' && data.imagen) {
      archivoUrl = guardarArchivo(data.imagen);
    } else if (hojaDestino === 'REPORTES' && data.soporte) {
      archivoUrl = guardarArchivo(data.soporte);
    }

    // Construir la fila según la hoja
    let fila;
    if (hojaDestino === 'NOVEDADES') {
      fila = buildNovedadesRow(data, archivoUrl);
    } else if (hojaDestino === 'REPORTES') {
      fila = buildCalidadRow(data, archivoUrl);
    } else if (hojaDestino === 'PLANTAS') {
      fila = buildPlantasRow(data);
    } else {
      return buildResponse(false, 'Hoja destino no reconocida: ' + hojaDestino);
    }

    // ── Insertar en fila 2 (justo después de los headers) ──
    insertRowAtTop(sheet, fila);

    return buildResponse(true, 'Reporte guardado exitosamente.');
  } catch (error) {
    console.error('Error en doPost:', error);
    return buildResponse(false, 'Error interno: ' + error.message);
  }
}

/**
 * Actualiza la columna ESTADO (col 14) de la hoja NOVEDADES,
 * buscando la fila donde el TIMESTAMP coincida.
 * @param {Object} data — { timestampId: '2024-03-10...', nuevoEstado: 'FINALIZADO' }
 */
function updateEstadoNovedad(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('NOVEDADES');
    if (!sheet) return buildResponse(false, 'Hoja NOVEDADES no encontrada.');
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return buildResponse(false, 'No hay datos en la hoja.');
    
    // Obtener todos los timestamps de la columna A (empezando en la fila 2)
    const timestamps = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues(); // getDisplayValues trae el string exacto
    
    for (let i = 0; i < timestamps.length; i++) {
      // Buscar el string exacto (getDisplayValues facilita comparar fechas en formato texto)
      if (timestamps[i][0] === String(data.timestampId)) {
        // Encontramos la fila (el array empieza en 0, y leemos desde la fila 2 → rowSheet = i + 2)
        // La columna ESTADO es la 14 (N)
        sheet.getRange(i + 2, 14).setValue(data.nuevoEstado);

        // Si hay un mensaje de solución y un correo para enviar, enviar notificación
        if (data.respuesta && data.correo) {
            enviarCorreoSolucion(data.correo, data);
        }

        return buildResponse(true, 'Estado actualizado exitosamente.');
      }
    }
    
    return buildResponse(false, 'No se encontró la novedad con ese ID.');
  } catch (error) {
    console.error('Error en updateEstadoNovedad:', error);
    return buildResponse(false, 'Error interno actualizando estado: ' + error.message);
  }
}

/**
 * Actualiza las columnas FECHA (col 2) y SALIDA (col 7)
 */
function updateFechasNovedad(data) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('NOVEDADES');
    if (!sheet) return buildResponse(false, 'Hoja NOVEDADES no encontrada.');
    
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return buildResponse(false, 'No hay datos en la hoja.');
    
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === String(data.timestampId)) { 
        // FECHA está en la Columna 2, SALIDA está en la Columna 7
        if (data.nuevaFecha) sheet.getRange(i + 2, 2).setValue(data.nuevaFecha);
        if (data.nuevaSalida) sheet.getRange(i + 2, 7).setValue(data.nuevaSalida);
        return buildResponse(true, 'Fechas actualizadas exitosamente.');
      }
    }
    return buildResponse(false, 'No se encontró la novedad con ese ID.');
  } catch (error) {
    console.error('Error en updateFechasNovedad:', error);
    return buildResponse(false, 'Error interno actualizando fechas: ' + error.message);
  }
}

/**
 * Función interna para enviar un email a la planta con la solución al ticket.
 */
function enviarCorreoSolucion(destinatario, data) {
    const asunto = `[SISPRO] Novedad Resuelta - Lote: ${data.resLote || 'N/A'}`;
    const cuerpoHtml = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #3F51B5; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Novedad Resuelta</h2>
          <p style="margin: 5px 0 0; font-size: 14px;">Folio ID: ${data.timestampId}</p>
        </div>
        <div style="padding: 20px;">
          <p>Hola, el equipo correspondiente ha finalizado la revisión de tu novedad reportada en SISPRO.</p>
          <div style="background-color: #f1f3f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p style="margin: 0 0 10px 0;"><strong>LOTE:</strong> ${data.resLote || 'N/A'}</p>
            <p style="margin: 0;"><strong>RESPUESTA / SOLUCIÓN:</strong></p>
            <p style="margin: 10px 0 0; font-style: italic; color: #111;">"${data.respuesta}"</p>
          </div>
          <p>Este ticket ahora ha sido cerrado y marcado como <b>FINALIZADO</b> en el sistema.</p>
          <br>
          <p style="margin: 0; font-size: 12px; color: #999;">Sistema Automático de Novedades SISPRO</p>
        </div>
      </div>
    `;

    try {
        MailApp.sendEmail({
            to: destinatario,
            subject: asunto,
            htmlBody: cuerpoHtml
        });
    } catch (e) {
        console.error("No se pudo enviar el correo: " + e.message);
    }
}

/**
 * Maneja peticiones GET (para pruebas/health check).
 */
function doGet(e) {
  return buildResponse(true, 'API de Novedades SISPRO activa.');
}

/* ══════════════════════════════════════════════════════════════════════════
   INSERCIÓN EN FILA 2
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Inserta una fila nueva en la posición 2 (después de headers)
 * para que los datos más recientes queden siempre arriba.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet — Hoja destino.
 * @param {Array} rowData — Datos de la fila a insertar.
 */
function insertRowAtTop(sheet, rowData) {
  // Insertar fila vacía en posición 2 (empuja todo hacia abajo)
  sheet.insertRowAfter(1);

  // Escribir los datos en la fila 2
  const range = sheet.getRange(2, 1, 1, rowData.length);
  range.setValues([rowData]);
}

/* ══════════════════════════════════════════════════════════════════════════
   CONSTRUCTORES DE FILAS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Retorna los encabezados según la hoja.
 * @param {string} hoja
 * @returns {string[]}
 */
function getHeaders(hoja) {
  if (hoja === 'NOVEDADES') {
    return [
      'ID_RADICADO', // Posición 0, reemplaza a TIMESTAMP
      'FECHA',
      'LOTE',
      'REFERENCIA',
      'CANTIDAD',
      'PLANTA',
      'SALIDA',
      'LINEA',
      'PROCESO',
      'AREA',
      'DESCRIPCION',
      'CANTIDAD_SOLICITADA',
      'IMAGEN',
      'ESTADO',
    ];
  }
  // REPORTES (Calidad)
  if (hoja === 'REPORTES') {
    return [
      'TIMESTAMP',
      'FECHA',
      'LOTE',
      'REFERENCIA',
      'CANTIDAD',
      'PLANTA',
      'SALIDA',
      'LINEA',
      'PROCESO',
      'EMAIL',
      'TIPO_VISITA',
      'CONCLUSION',
      'OBSERVACIONES',
      'SOPORTE',
    ];
  }
  // PLANTAS (Actualización de datos)
  return [
    'TIMESTAMP',
    'ID',
    'PLANTA',
    'DIRECCION',
    'TELEFONO',
    'CORREO',
  ];
}

/**
 * Genera un código de radicado único usando getUuid (ej. NOV-8A4F2...)
 */
function generarRadicadoUnico() {
    const uuid = Utilities.getUuid().split('-')[0].toUpperCase();
    return `NOV-${uuid}`;
}

/**
 * Construye una fila para la hoja NOVEDADES.
 * @param {Object} data — Datos del formulario.
 * @param {string} archivoUrl — URL pública de la imagen.
 * @returns {Array}
 */
function buildNovedadesRow(data, archivoUrl) {
  return [
    generarRadicadoUnico(),         // 0: ID_RADICADO (Único)
    new Date(),                     // 1: FECHA (Ahora guarda Fecha y Hora exacta)
    data.lote        || '',         // 2: LOTE
    data.referencia  || '',         // 3: REFERENCIA
    data.cantidad    || '',         // 4: CANTIDAD
    data.planta      || '',         // 5: PLANTA
    data.salida      || '',         // 6: SALIDA
    data.linea       || '',         // 7: LINEA
    data.proceso     || '',         // 8: PROCESO
    data.area        || '',         // 9: AREA
    data.descripcion || '',         // 10: DESCRIPCION
    data.cantidadSolicitada || '',  // 11: CANTIDAD_SOLICITADA
    archivoUrl,                     // 12: IMAGEN
    'PENDIENTE',                    // 13: ESTADO
  ];
}

/**
 * Construye una fila para la hoja REPORTES (Calidad).
 * @param {Object} data — Datos del formulario.
 * @param {string} archivoUrl — URL pública del soporte.
 * @returns {Array}
 */
function buildCalidadRow(data, archivoUrl) {
  return [
    new Date(),                     // TIMESTAMP
    data.fecha         || '',       // FECHA
    data.lote          || '',       // LOTE
    data.referencia    || '',       // REFERENCIA
    data.cantidad      || '',       // CANTIDAD
    data.planta        || '',       // PLANTA
    data.salida        || '',       // SALIDA
    data.linea         || '',       // LINEA
    data.proceso       || '',       // PROCESO
    data.email         || '',       // EMAIL
    data.tipoVisita    || '',       // TIPO_VISITA
    data.conclusion    || '',       // CONCLUSION
    data.observaciones || '',       // OBSERVACIONES
    archivoUrl,                     // SOPORTE
  ];
}

/**
 * Construye una fila para la hoja PLANTAS (Actualización de datos).
 * @param {Object} data — Datos del formulario.
 * @returns {Array}
 */
function buildPlantasRow(data) {
  return [
    new Date(),                       // TIMESTAMP
    data.cedula          || '',       // ID (Mapeado desde cedula)
    data.nombrePlanta    || '',       // PLANTA
    data.direccion       || '',       // DIRECCION
    data.telefono        || '',       // TELEFONO
    data.email           || '',       // CORREO (Mapeado desde email)
  ];
}

/* ══════════════════════════════════════════════════════════════════════════
   GESTIÓN DE ARCHIVOS — Drive con subcarpetas AÑO/MES
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Guarda un archivo codificado en Base64 en Google Drive.
 * Se organiza en subcarpetas por año y mes dentro de la carpeta raíz.
 * Ejemplo: CARPETA_RAIZ / 2026 / 03 / archivo.jpg
 *
 * @param {Object} fileData — { base64: string, mimeType: string, fileName: string }
 * @returns {string} URL pública tipo lh3.googleusercontent.com/d/{ID}
 */
function guardarArchivo(fileData) {
  if (!fileData || !fileData.base64) return '';

  try {
    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileData.base64),
      fileData.mimeType,
      fileData.fileName
    );

    // Obtener carpeta destino organizada por año/mes
    const folderDestino = getOrCreateMonthFolder();

    // Crear archivo en Drive
    const file = folderDestino.createFile(blob);

    // Hacer el archivo público (cualquiera con el link puede ver)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Retornar URL pública con formato lh3
    const fileId = file.getId();
    return DRIVE_IMAGE_PREFIX + fileId;

  } catch (error) {
    console.error('Error al guardar archivo:', error);
    return 'Error al guardar archivo';
  }
}

/**
 * Obtiene (o crea si no existe) la subcarpeta de año/mes/día actual
 * dentro de la carpeta raíz de adjuntos.
 *
 * Estructura: CARPETA_RAIZ / 2026 / MARZO / 10
 *
 * Solo crea carpetas nuevas cuando no existen; si ya existen las reutiliza.
 *
 * @returns {GoogleAppsScript.Drive.Folder} Carpeta del día actual.
 */
function getOrCreateMonthFolder() {
  const MESES = [
    'ENERO', 'FEBRERO', 'MARZO',    'ABRIL',   'MAYO',      'JUNIO',
    'JULIO', 'AGOSTO',  'SEPTIEMBRE','OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
  ];

  const now   = new Date();
  const year  = String(now.getFullYear());               // "2026"
  const month = MESES[now.getMonth()];                   // "MARZO"
  const day   = String(now.getDate()).padStart(2, '0');  // "10"

  // Carpeta raíz
  const rootFolder = DriveApp.getFolderById(CARPETA_RAIZ_ID);

  // Buscar o crear: año → mes → día
  const yearFolder  = getOrCreateSubfolder(rootFolder, year);
  const monthFolder = getOrCreateSubfolder(yearFolder,  month);
  const dayFolder   = getOrCreateSubfolder(monthFolder, day);

  return dayFolder;
}

/**
 * Busca una subcarpeta por nombre dentro de un folder padre.
 * Si no existe, la crea. Si ya existe, la reutiliza.
 *
 * @param {GoogleAppsScript.Drive.Folder} parentFolder — Carpeta padre.
 * @param {string} folderName — Nombre de la subcarpeta a buscar/crear.
 * @returns {GoogleAppsScript.Drive.Folder} La subcarpeta encontrada o creada.
 */
function getOrCreateSubfolder(parentFolder, folderName) {
  const folders = parentFolder.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next(); // Ya existe, reutilizar
  }

  // No existe, crear nueva
  return parentFolder.createFolder(folderName);
}

/* ══════════════════════════════════════════════════════════════════════════
   UTILIDADES
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Construye una respuesta JSON estándar.
 * @param {boolean} success
 * @param {string} message
 * @returns {ContentService.TextOutput}
 */
function buildResponse(success, message) {
  const output = JSON.stringify({ success, message });
  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}
