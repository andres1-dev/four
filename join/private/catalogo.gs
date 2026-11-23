/**
 * MAP - Lector de catálogo desde Google Sheets (API V4)
 * Pestañas: COLORES, GRUPO_SUBGRUPO, TALLAS, PROVEEDOR
 */

// ===================== CONFIGURACIÓN =====================
const CONFIG = {
  SPREADSHEET_ID: '1ASNfwT80P3zdytY-wP-EkCfNsLwKhNNJ-o3_WdD3-jc',
  API_KEY: 'AIzaSyBWFBzEd2skvsGqBg95cRNOXuEaxJ7zBDQ',
  SHEETS: {
    COLORES: { range: 'A:B', keyField: 'color' },
    GRUPO_SUBGRUPO: { range: 'A:C', keyField: 'f120_referencia' },
    TALLAS: { range: 'A:B', keyField: 'talla' },
    PROVEEDOR: { range: 'A:B', keyField: '[03-MARCA]' },
    TIPOS: { range: 'A:B', keyField: 'PRENDA' },
  },
};

// ===================== FUNCIÓN PÚBLICA =====================

/**
 * Punto de entrada principal.
 * Uso: ejecutar `cargarCatalogo()` desde el editor de Apps Script
 * o exponerla como función web con doGet/doPost.
 */
function cargarCatalogo() {
  try {
    const catalogo = {
      colores: leerHoja('COLORES'),
      gruposSubgrupos: leerHoja('GRUPO_SUBGRUPO'),
      tallas: leerHoja('TALLAS'),
      proveedores: leerHoja('PROVEEDOR'),
    };

    Logger.log('COLORES: %s filas', catalogo.colores.length);
    Logger.log('GRUPO_SUBGRUPO: %s filas', catalogo.gruposSubgrupos.length);
    Logger.log('TALLAS: %s filas', catalogo.tallas.length);
    Logger.log('PROVEEDOR: %s filas', catalogo.proveedores.length);

    return catalogo;

  } catch (error) {
    Logger.log('Error en cargarCatalogo: %s', error.message);
    throw error;
  }
}

/**
 * Busca un color y devuelve su subgrupo.
 * Uso: buscarColor('AMARILLO') -> 'AMARILLOS / OCRES'
 */
function buscarColor(color) {
  const colores = leerHoja('COLORES');
  const normalizado = normalizar(color);

  const encontrado = colores.find(
    (fila) => normalizar(fila.color) === normalizado
  );

  return encontrado ? encontrado.COLORES : null;
}

/**
 * Busca una referencia en GRUPO_SUBGRUPO y devuelve género y prenda.
 * Uso: buscarReferencia('IC0083') -> { GENERO: 'DAMA', PRENDA: 'BLUSAS' }
 */
function buscarReferencia(referencia) {
  const datos = leerHoja('GRUPO_SUBGRUPO');
  const normalizado = normalizar(referencia);

  const encontrado = datos.find(
    (fila) => normalizar(fila.f120_referencia) === normalizado
  );

  if (!encontrado) return null;

  return {
    GENERO: encontrado.GENERO || null,
    PRENDA: encontrado.PRENDA || null,
  };
}

/**
 * Busca una talla y devuelve su tallaje.
 * Uso: buscarTalla('U') -> 'UNICA'
 */
function buscarTalla(talla) {
  const tallas = leerHoja('TALLAS');
  const normalizado = normalizar(talla);

  const encontrado = tallas.find(
    (fila) => normalizar(fila.talla) === normalizado
  );

  return encontrado ? encontrado.Tallaje : null;
}

/**
 * Busca un proveedor por su marca y devuelve su origen.
 * Uso: buscarProveedor('693 - POETICA') -> 'PN'
 */
function buscarProveedor(marca) {
  const proveedores = leerHoja('PROVEEDOR');
  const normalizado = normalizar(marca);

  const encontrado = proveedores.find(
    (fila) => normalizar(fila['[03-MARCA]']) === normalizado
  );

  return encontrado ? encontrado.ORIGEN : null;
}

// ===================== WEB APP (doGet / doPost) =====================

/**
 * GET → devuelve la API key para que el front la use con Sheets V4.
 * El front llama a este endpoint al iniciar y no hardcodea la key.
 */
function doGet(e) {
  return jsonResponse({ ok: true, apiKey: CONFIG.API_KEY });
}

/**
 * POST → endpoint de escritura. La Sheets API v4 con API key NO permite
 * escribir; esto requiere desplegar como Web app:
 *   Deploy → New deployment → Web app
 *   Execute as: Me | Who has access: Anyone
 * y pegar la URL /exec en CONFIG.GAS_ENDPOINT del front.
 *
 * Recibe { hoja, fila: {header: valor} } y agrega la fila.
 * Valida que el campo clave (keyField) no exista ya.
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // Acción: guardar lote de NO MATCH en la hoja NO_MATCH
    if (body.action === 'guardarNoMatch') {
      return jsonResponse(guardarNoMatch(body.filas || []));
    }

    // Acción: agregar lote de filas a una hoja del catálogo
    if (body.action === 'agregarLote') {
      return jsonResponse(agregarLote(body.hoja, body.filas || []));
    }

    const resultado = agregarRegistro(body.hoja, body.fila || {});
    return jsonResponse(resultado);
  } catch (error) {
    return jsonResponse({ ok: false, mensaje: error.message });
  }
}

// ===================== NO MATCH =====================

const NO_MATCH_SHEET = 'NO_MATCH';
const NO_MATCH_HEADERS = ['Dimensión', 'Valor sin match', 'Registros', 'Fecha'];

/**
 * Guarda filas de no-match en la hoja NO_MATCH.
 * Columnas esperadas en cada fila: { dimension, valor, registros } o
 * array [dimension, valor, registros].
 * Evita duplicados por (Dimensión + Valor).
 * @param {Array} filas
 * @returns {{ ok: boolean, mensaje: string, agregados: number, omitidos: number }}
 */
function guardarNoMatch(filas) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(NO_MATCH_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(NO_MATCH_SHEET);
    sheet.appendRow(NO_MATCH_HEADERS);
    sheet.setFrozenRows(1);
  }

  // Claves existentes para deduplicar
  const existentes = new Set();
  const ultima = sheet.getLastRow();
  if (ultima > 1) {
    const datos = sheet.getRange(2, 1, ultima - 1, 2).getValues();
    datos.forEach(([d, v]) => existentes.add(normalizar(d) + '||' + normalizar(v)));
  }

  const hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  let agregados = 0;
  let omitidos = 0;

  filas.forEach(f => {
    const [dimension, valor, registros] = Array.isArray(f)
      ? f
      : [f.dimension, f.valor, f.registros];

    const clave = normalizar(dimension) + '||' + normalizar(valor);
    if (!dimension || !valor || existentes.has(clave)) {
      omitidos++;
      return;
    }

    sheet.appendRow([dimension, valor, registros ?? '', hoy]);
    existentes.add(clave);
    agregados++;
  });

  return {
    ok: true,
    mensaje: `${agregados} filas agregadas a ${NO_MATCH_SHEET} (${omitidos} omitidas/duplicadas).`,
    agregados,
    omitidos,
  };
}

/**
 * Agrega una fila a la hoja indicada, verificando unicidad.
 * @param {string} nombreHoja
 * @param {Object} fila - { header: valor }
 * @returns {{ ok: boolean, mensaje: string }}
 */
function agregarRegistro(nombreHoja, fila) {
  const config = CONFIG.SHEETS[nombreHoja];
  if (!config) return { ok: false, mensaje: `Hoja no válida: ${nombreHoja}` };

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(nombreHoja);
  if (!sheet) return { ok: false, mensaje: `Pestaña no encontrada: ${nombreHoja}` };

  // Unicidad sobre el campo clave
  const keyField = config.keyField;
  const valorKey = normalizar(fila[keyField]);
  if (!valorKey) {
    return { ok: false, mensaje: `El campo "${keyField}" es obligatorio.` };
  }

  const ultimaFila = sheet.getLastRow();
  if (ultimaFila > 1) {
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colKey = headers.findIndex(h => normalizar(h) === normalizar(keyField));
    if (colKey >= 0) {
      const valores = sheet.getRange(2, colKey + 1, ultimaFila - 1, 1).getValues().flat();
      if (valores.some(v => normalizar(v) === valorKey)) {
        return { ok: false, mensaje: `Ya existe un registro con ${keyField} = "${fila[keyField]}".` };
      }
    }
  }

  // Armar fila en el orden de los headers
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const nuevaFila = headers.map(h => (fila[h] !== undefined ? fila[h] : ''));

  sheet.appendRow(nuevaFila);
  return { ok: true, mensaje: `Registro agregado en ${nombreHoja}.` };
}

/**
 * Agrega un lote de filas a una hoja del catálogo.
 * Valida unicidad del campo clave por fila y dentro del lote.
 * @param {string} nombreHoja
 * @param {Object[]} filas - [{ header: valor }, ...]
 * @returns {{ ok: boolean, mensaje: string, agregados: number, omitidos: number }}
 */
function agregarLote(nombreHoja, filas) {
  const config = CONFIG.SHEETS[nombreHoja];
  if (!config) return { ok: false, mensaje: `Hoja no válida: ${nombreHoja}`, agregados: 0, omitidos: 0 };

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(nombreHoja);
  if (!sheet) return { ok: false, mensaje: `Pestaña no encontrada: ${nombreHoja}`, agregados: 0, omitidos: 0 };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const keyField = config.keyField;

  // Valores clave existentes
  const colKey = headers.findIndex(h => normalizar(h) === normalizar(keyField));
  const existentes = new Set();
  const ultima = sheet.getLastRow();
  if (colKey >= 0 && ultima > 1) {
    sheet.getRange(2, colKey + 1, ultima - 1, 1).getValues()
      .flat().forEach(v => existentes.add(normalizar(v)));
  }

  let agregados = 0;
  let omitidos = 0;
  const enLote = new Set();

  filas.forEach(fila => {
    const valorKey = normalizar(fila[keyField]);
    if (!valorKey || existentes.has(valorKey) || enLote.has(valorKey)) {
      omitidos++;
      return;
    }
    const nuevaFila = headers.map(h => (fila[h] !== undefined ? fila[h] : ''));
    sheet.appendRow(nuevaFila);
    enLote.add(valorKey);
    agregados++;
  });

  return {
    ok: true,
    mensaje: `${agregados} filas agregadas a ${nombreHoja} (${omitidos} omitidas/duplicadas).`,
    agregados,
    omitidos,
  };
}

/**
 * @param {Object} data
 * @returns {GoogleAppsScript.Content.TextOutput}
 * @private
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===================== FUNCIONES PRIVADAS =====================

/**
 * Lee una hoja completa via Sheets API V4 y la devuelve
 * como array de objetos (header -> valor).
 * @param {string} nombreHoja - Nombre de la pestaña en CONFIG.SHEETS
 * @returns {Object[]}
 * @private
 */
function leerHoja(nombreHoja) {
  const hoja = CONFIG.SHEETS[nombreHoja];
  if (!hoja) throw new Error(`Hoja no configurada: ${nombreHoja}`);

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}` +
    `/values/${encodeURIComponent(nombreHoja + '!' + hoja.range)}` +
    `?key=${CONFIG.API_KEY}`;

  const respuesta = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const codigo = respuesta.getResponseCode();

  if (codigo !== 200) {
    throw new Error(`Sheets API error ${codigo} en ${nombreHoja}: ${respuesta.getContentText()}`);
  }

  const datos = JSON.parse(respuesta.getContentText());
  const filas = datos.values || [];

  if (filas.length < 2) return [];

  const headers = filas[0].map((h) => String(h).trim());

  return filas.slice(1).map((fila) => {
    const objeto = {};
    headers.forEach((header, i) => {
      objeto[header] = (fila[i] || '').toString().trim();
    });
    return objeto;
  });
}

/**
 * Normaliza un string para comparaciones:
 * mayúsculas, sin tildes, sin espacios extra.
 * @param {string} texto
 * @returns {string}
 * @private
 */
function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}
