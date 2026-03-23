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

    // ── Acción para recuperar configuración segura (API Keys) ──
    if (data.accion === "GET_CONFIG") {
      const props = PropertiesService.getScriptProperties();
      const config = {
        API_KEY: props.getProperty('SHEETS_API_KEY'),
        GEMINI_KEY: props.getProperty('GEMINI_API_KEY')
      };
      return ContentService.createTextOutput(JSON.stringify(config))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── Acción para actualizar el estado en el módulo de resoluciones ──
    if (data.accion === "UPDATE_ESTADO") {
      return updateEstadoNovedad(data);
    }
    // ── Acción para corregir fechas (Módulo de impresión) ──
    if (data.accion === "UPDATE_FECHAS") {
      return buildResponse(false, 'No existe');
    }

    // ── Acción para enviar notificación de solución ──
    if (data.accion === "NOTIFICAR_SOLUCION") {
      return enviarNotificacionSolucion(data);
    }

    // ── Acción para actualizar el rol de un usuario (Compatibilidad caché) ──
    if (data.accion === "UPDATE_USER_ROLE") {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName('USUARIOS');
      const lastRow = sheet.getLastRow();
      
      if (lastRow < 2) return buildResponse(false, 'No hay usuarios registrados.');
      
      const sheetData = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
      for (let i = 0; i < sheetData.length; i++) {
        if (String(sheetData[i][0]).trim() === String(data.id).trim()) {
          sheet.getRange(i + 2, 5).setValue(data.nuevoRol);
          return buildResponse(true, 'Rol actualizado exitosamente.');
        }
      }
      return buildResponse(false, 'Usuario no encontrado.');
    }

    // ── Acción para actualizar los datos completos de un usuario ──
    if (data.accion === "UPDATE_USER") {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sheet = ss.getSheetByName('USUARIOS');
      const lastRow = sheet.getLastRow();
      
      if (lastRow < 2) return buildResponse(false, 'No hay usuarios registrados.');
      
      const sheetData = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
      
      for (let i = 0; i < sheetData.length; i++) {
        if (String(sheetData[i][0]).trim() === String(data.id).trim()) {
          const rowNum = i + 2;
          
          // Actualizar campos (Cols: 2=Usuario, 3=Correo, 4=Telefono, 5=Rol, 6=Password)
          sheet.getRange(rowNum, 2).setValue(data.usuario);
          sheet.getRange(rowNum, 3).setValue(data.correo);
          sheet.getRange(rowNum, 4).setValue(data.telefono);
          sheet.getRange(rowNum, 5).setValue(data.rol);
          
          if (data.password && String(data.password).trim() !== '') {
            sheet.getRange(rowNum, 6).setValue(data.password);
          }
          
          return buildResponse(true, 'Usuario actualizado exitosamente.');
        }
      }
      return buildResponse(false, 'Usuario no encontrado.');
    }

    const hojaDestino = data.hoja; // "NOVEDADES", "REPORTES", "PLANTAS" o "USUARIOS"

    if (!hojaDestino) {
      return buildResponse(false, 'No se especificó la hoja destino.');
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(hojaDestino);

    // Si la hoja no existe, crearla
    if (!sheet) {
      sheet = ss.insertSheet(hojaDestino);
    }

    // Sincronizar encabezados (agrega columnas faltantes sin borrar datos existentes)
    ensureSheetHeaders(sheet, getHeaders(hojaDestino));

    // Procesar archivo adjunto (si existe)
    let archivoUrl = '';
    if (hojaDestino === 'NOVEDADES' && data.imagen) {
      archivoUrl = guardarArchivo(data.imagen);
    } else if (hojaDestino === 'REPORTES' && data.soporte) {
      archivoUrl = guardarArchivo(data.soporte);
    }

    // ── DISTRIBUCIÓN DE ACCIONES SEGÚN LA HOJA ──
    if (hojaDestino === 'NOVEDADES') {
      const fila = buildNovedadesRow(data, archivoUrl);
      insertRowAtTop(sheet, fila);
    } else if (hojaDestino === 'REPORTES') {
      const fila = buildCalidadRow(data, archivoUrl);
      insertRowAtTop(sheet, fila);
    } else if (hojaDestino === 'PLANTAS') {
      upsertPlanta(data, sheet);
    } else if (hojaDestino === 'USUARIOS') {
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        // Columna 1 es ID
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        const roles = sheet.getRange(2, 5, lastRow - 1, 1).getValues(); // Columna 5 es ROL
        
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]).trim() === String(data.id).trim()) {
            const currentRol = roles[i][0];
            let mensaje = "Usted ya se encuentra registrado.";
            if (currentRol === 'PENDIENTE') {
                mensaje = "Su solicitud aún está PENDIENTE de aprobación por el administrador.";
            } else {
                mensaje = `Ya tiene una cuenta activa con el rol: ${currentRol}. Por favor inicie sesión.`;
            }
            return buildResponse(false, mensaje);
          }
        }
      }
      const fila = buildUsuariosRow(data);
      insertRowAtTop(sheet, fila);
    } else {
      return buildResponse(false, 'Hoja destino no reconocida: ' + hojaDestino);
    }

    return buildResponse(true, 'Reporte guardado exitosamente.');
  } catch (error) {
    console.error('Error en doPost:', error);
    return buildResponse(false, 'Error interno: ' + error.message);
  }
}

/**
 * Actualiza la columna ESTADO (col 17) de la hoja NOVEDADES,
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
        // La columna ESTADO es la 17 (Q) - índice 16 en el array
        sheet.getRange(i + 2, 17).setValue(data.nuevoEstado);

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

/**
 * Garantiza que la hoja tenga todos los encabezados esperados.
 * Si la hoja está vacía, escribe los headers en la fila 1.
 * Si la hoja ya tiene datos, agrega al final de la fila 1 los headers faltantes
 * sin borrar ni mover ningún dato existente.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet — Hoja destino.
 * @param {string[]} expectedHeaders — Lista completa de headers esperados.
 */
function ensureSheetHeaders(sheet, expectedHeaders) {
  const lastRow = sheet.getLastRow();

  // Hoja vacía → escribir todos los headers
  if (lastRow === 0) {
    sheet.appendRow(expectedHeaders);
    return;
  }

  // Leer headers actuales de la fila 1
  const lastCol       = sheet.getLastColumn();
  const currentHeader = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String)
    : [];

  // Detectar cuáles faltan
  const missing = expectedHeaders.filter(h => !currentHeader.includes(h));

  if (missing.length > 0) {
    const startCol = lastCol + 1;
    const range    = sheet.getRange(1, startCol, 1, missing.length);
    range.setValues([missing]);
    Logger.log('[ensureSheetHeaders] Columnas añadidas a ' + sheet.getName() + ': ' + missing.join(', '));
  }
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
      'ID_NOVEDAD',
      'FECHA',
      'LOTE',
      'REFERENCIA',
      'CANTIDAD',
      'PLANTA',
      'SALIDA',
      'LINEA',
      'PROCESO',
      'PRENDA',
      'GENERO',
      'TEJIDO',
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
      'ID_REPORTE',
      'FECHA',
      'LOTE',
      'REFERENCIA',
      'CANTIDAD',
      'PLANTA',
      'SALIDA',
      'LINEA',
      'PROCESO',
      'PRENDA',
      'GENERO',
      'TEJIDO',
      'EMAIL',
      'LOCALIZACION',
      'TIPO_VISITA',
      'CONCLUSION',
      'OBSERVACIONES',
      'SOPORTE',
    ];
  }
  // PLANTAS (Actualización de datos)
  if (hoja === 'PLANTAS') {
    return [
      'ID_PLANTA',
      'PLANTA',
      'DIRECCION',
      'TELEFONO',
      'EMAIL',
    ];
  }
  // USUARIOS (Registro de personal)
  if (hoja === 'USUARIOS') {
    return [
      'ID_USUARIO',
      'USUARIO',
      'CORREO',
      'TELEFONO',
      'ROL',
      'CONTRASEÑA',
    ];
  }
  return [];
}

/**
 * Genera un código único para novedades (ej. NOV-8A4F2...)
 */
function generarNovedadUniqueId() {
    const uuid = Utilities.getUuid().split('-')[0].toUpperCase();
    return `NOV-${uuid}`;
}

/**
 * Genera un código de radicado único usando getUuid (ej. REP-8A4F2...)
 */
function generarReporteUniqueId() {
    const uuid = Utilities.getUuid().split('-')[0].toUpperCase();
    return `REP-${uuid}`;
}

/**
 * Construye una fila para la hoja NOVEDADES.
 * @param {Object} data — Datos del formulario.
 * @param {string} archivoUrl — URL pública de la imagen.
 * @returns {Array}
 */
function buildNovedadesRow(data, archivoUrl) {
  return [
    generarNovedadUniqueId(),       // 0: ID_NOVEDAD (Único)
    new Date(),                     // 1: FECHA (Ahora guarda Fecha y Hora exacta)
    data.lote        || '',         // 2: LOTE
    data.referencia  || '',         // 3: REFERENCIA
    data.cantidad    || '',         // 4: CANTIDAD
    data.planta      || '',         // 5: PLANTA
    data.salida      || '',         // 6: SALIDA
    data.linea       || '',         // 7: LINEA
    data.proceso     || '',         // 8: PROCESO
    data.prenda      || '',         // 9: PRENDA
    data.genero      || '',         // 10: GENERO
    data.tejido      || '',         // 11: TEJIDO
    data.area        || '',         // 12: AREA
    data.descripcion || '',         // 13: DESCRIPCION
    data.cantidadSolicitada || '',  // 14: CANTIDAD_SOLICITADA
    archivoUrl,                     // 15: IMAGEN
    'PENDIENTE',                    // 16: ESTADO
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
    generarReporteUniqueId(),       // ID_REPORTE (Único)
    new Date(),                     // FECHA
    data.lote          || '',       // LOTE
    data.referencia    || '',       // REFERENCIA
    data.cantidad      || '',       // CANTIDAD
    data.planta        || '',       // PLANTA
    data.salida        || '',       // SALIDA
    data.linea         || '',       // LINEA
    data.proceso       || '',       // PROCESO
    data.prenda        || '',       // PRENDA
    data.genero        || '',       // GENERO
    data.tejido        || '',       // TEJIDO
    data.email         || '',       // EMAIL
    data.localizacion  || '',       // LOCALIZACION
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
    data.cedula          || '',       // ID_PLANTA (Cédula/NIT)
    data.nombrePlanta    || '',       // PLANTA
    data.direccion       || '',       // DIRECCION
    data.telefono        || '',       // TELEFONO
    data.email           || '',       // EMAIL
  ];
}

/**
 * Busca una planta por nombre y la actualiza, o la inserta si no existe.
 */
function upsertPlanta(data, sheet) {
  const lastRow = sheet.getLastRow();
  const nombreBuscado = String(data.nombrePlanta).trim().toLowerCase();
  
  if (lastRow >= 2) {
    // Columna 2 es PLANTA (después de remover columna ELIMINAR)
    const nombres = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
    for (let i = 0; i < nombres.length; i++) {
        if (String(nombres[i][0]).trim().toLowerCase() === nombreBuscado) {
            // Actualizar fila existente (i + 2)
            const fila = buildPlantasRow(data);
            sheet.getRange(i + 2, 1, 1, fila.length).setValues([fila]);
            return;
        }
    }
  }
  
  // Si no se encontró, insertar como reporte nuevo al inicio
  const nuevaFila = buildPlantasRow(data);
  insertRowAtTop(sheet, nuevaFila);
}

/* ══════════════════════════════════════════════════════════════════════════
   GESTIÓN DE ARCHIVOS — Drive con subcarpetas AÑO/MES
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Construye una fila para la hoja USUARIOS (Registro de personal).
 */
function buildUsuariosRow(data) {
  return [
    data.id       || '', // ID
    data.usuario  || '', // USUARIO
    data.correo   || '', // CORREO
    data.telefono || '', // TELEFONO
    data.rol      || 'PENDIENTE', // ROL
    data.password || '', // PASSWORD
  ];
}

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
 * @param {Object} extraData - Datos adicionales opcionales.
 * @returns {ContentService.TextOutput}
 */
function buildResponse(success, message, extraData = {}) {
  const output = JSON.stringify({ success, message, ...extraData });
  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}


/**
 * Envía una notificación por correo con la solución de una novedad
 * @param {Object} data — { timestampId, correo, planta, lote, referencia, descripcion, fecha, solucion }
 */
function enviarNotificacionSolucion(data) {
  try {
    if (!data.correo) {
      return buildResponse(false, 'No se proporcionó un correo electrónico');
    }

    // Formatear fecha
    const fechaReporte = data.fecha ? Utilities.formatDate(new Date(data.fecha), Session.getScriptTimeZone(), "dd/MM/yyyy 'a las' HH:mm 'horas'") : 'N/A';

    const asunto = `Resolución de Novedad - Lote ${data.lote || 'S/L'}`;
    
    // CSS inline compatible con Gmail y Outlook
    const cuerpoHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f3f4f6;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
          <tr>
            <td style="padding: 20px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background-color: #1e293b; padding: 30px 20px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: bold; letter-spacing: 0.5px;">
                      RESOLUCIÓN DE NOVEDAD
                    </h1>
                  </td>
                </tr>
                
                <!-- Body -->
                <tr>
                  <td style="padding: 30px 24px;">
                    
                    <!-- Saludo -->
                    <p style="margin: 0 0 20px 0; font-size: 15px; color: #1e293b; line-height: 1.6;">
                      Estimado(a) <strong>${data.planta || 'Planta'}</strong>,
                    </p>
                    
                    <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                      Le informamos que la novedad reportada el día <strong>${fechaReporte}</strong>, 
                      con número de radicado <strong>${data.timestampId || 'N/A'}</strong>, 
                      de la Orden de Producción <strong>${data.lote || 'N/A'}</strong>, 
                      Referencia: <strong>${data.referencia || 'N/A'}</strong>, 
                      ha sido resuelta exitosamente.
                    </p>
                    
                    <!-- Detalles de la Solución -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 20px;">
                      <tr>
                        <td style="padding: 16px; background-color: #f0fdf4; border-left: 4px solid #10b981;">
                          <p style="margin: 0 0 8px 0; font-size: 13px; color: #059669; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
                            DETALLES DE LA SOLUCIÓN
                          </p>
                          <p style="margin: 0; font-size: 14px; color: #1e293b; line-height: 1.6; white-space: pre-wrap;">${data.solucion || 'Sin detalles'}</p>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 24px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                      Si tiene alguna pregunta o requiere información adicional, no dude en contactarnos.
                    </p>
                    
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 20px 24px; border-top: 1px solid #e2e8f0; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                      Sistema de Gestión de Novedades SISPRO<br>
                      Este es un correo automático, por favor no responder.
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    MailApp.sendEmail({
      to: data.correo,
      subject: asunto,
      htmlBody: cuerpoHTML
    });

    return buildResponse(true, 'Notificación enviada exitosamente');
  } catch (error) {
    console.error('Error en enviarNotificacionSolucion:', error);
    return buildResponse(false, 'Error al enviar notificación: ' + error.message);
  }
}


/**
 * FUNCIÓN DE PRUEBA - Ejecutar manualmente para solicitar permisos de correo
 * Esta función envía un correo de prueba y fuerza la autorización de MailApp
 */
function solicitarPermisosCorreo() {
  try {
    // Obtener el correo del usuario actual
    const emailUsuario = Session.getActiveUser().getEmail();
    
    // Enviar correo de prueba
    MailApp.sendEmail({
      to: emailUsuario,
      subject: '✅ Permisos de Correo Autorizados - SISPRO',
      htmlBody: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">✅ Permisos Autorizados Correctamente</h2>
          <p>Los permisos para enviar correos electrónicos han sido autorizados exitosamente.</p>
          <p>El sistema SISPRO ahora puede:</p>
          <ul>
            <li>Enviar notificaciones de solución de novedades</li>
            <li>Enviar correos automáticos a las plantas</li>
            <li>Gestionar comunicaciones del sistema</li>
          </ul>
          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            Este es un correo de prueba del Sistema SISPRO
          </p>
        </div>
      `
    });
    
    Logger.log('✅ Correo de prueba enviado exitosamente a: ' + emailUsuario);
    return '✅ Permisos autorizados. Correo de prueba enviado a: ' + emailUsuario;
    
  } catch (error) {
    Logger.log('❌ Error: ' + error.message);
    return '❌ Error al solicitar permisos: ' + error.message;
  }
}
