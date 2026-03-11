/* ==========================================================================
   api.js — Comunicación con Google Sheets API y Seguridad
   Depende de: config.js (CONFIG, SHEET_SISPRO, GAS_ENDPOINT)
   ========================================================================== */

/**
 * Recupera las llaves de API desde Google Apps Script (GAS)
 * para evitar que estén hardcodeadas en el frontend.
 */
async function fetchSecureConfig() {
    try {
        // Usamos una petición POST para mayor seguridad en la transferencia
        const res = await fetch(GAS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ accion: "GET_CONFIG" })
        });

        if (!res.ok) throw new Error('No se pudo obtener la configuración segura.');
        
        const data = await res.json();
        
        if (data && data.API_KEY && data.GEMINI_KEY) {
            CONFIG.API_KEY = data.API_KEY;
            CONFIG.GEMINI_KEY = data.GEMINI_KEY;
        } else {
            throw new Error('Configuración incompleta: Faltan llaves de API en el servidor.');
        }
    } catch (error) {
        throw error; // Re-lanzar para que app.js lo maneje
    }
}

/**
 * Obtiene los datos de una hoja específica del spreadsheet.
 *
 * @param {string} sheetName — Nombre de la pestaña en Sheets.
 * @param {number[]} indices — Posiciones de columna a extraer.
 * @param {string[]} headers — Nombres lógicos para cada columna.
 * @returns {Promise<Object[]>} Lista de registros {header: valor}.
 * @throws {Error} Si la petición HTTP falla.
 */
async function fetchSheetData(sheetName, indices, headers) {
    const url =
        `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}` +
        `/values/${sheetName}!A:AF?key=${CONFIG.API_KEY}&majorDimension=ROWS`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} al obtener ${sheetName}`);
    }

    const { values = [] } = await response.json();

    if (values.length <= 1) return [];

    return values.slice(1).map((row) => {
        const record = {};
        indices.forEach((colIndex, i) => {
            record[headers[i]] = colIndex < row.length ? row[colIndex] : '';
        });
        return record;
    });
}

/**
 * Carga todos los datos necesarios (lotes y plantas).
 *
 * @returns {Promise<{lots: Object[], plantas: Object[]}>}
 * @throws {Error} Propaga errores de red/API.
 */
async function fetchAllData() {
    const [lots, plantas] = await Promise.all([
        fetchSheetData(SHEET_SISPRO.name, SHEET_SISPRO.indices, SHEET_SISPRO.headers),
        fetchPlantasData()
    ]);

    return { lots, plantas };
}

/**
 * Obtiene el listado completo de novedades para el módulo de resolución.
 */
async function fetchNovedadesData() {
    return fetchSheetData(
        SHEET_NOVEDADES.name,
        SHEET_NOVEDADES.indices,
        SHEET_NOVEDADES.headers,
    );
}

/**
 * Obtiene el listado de actualizaciones de plantas para cruzar datos en las impresiones.
 */
async function fetchPlantasData() {
    return fetchSheetData(
        SHEET_PLANTAS.name,
        SHEET_PLANTAS.indices,
        SHEET_PLANTAS.headers,
    );
}
/**
 * Obtiene el listado de usuarios para el sistema de login.
 */
async function fetchUsuariosData() {
    return fetchSheetData(
        SHEET_USUARIOS.name,
        SHEET_USUARIOS.indices,
        SHEET_USUARIOS.headers,
    );
}
