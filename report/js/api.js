/* ==========================================================================
   api.js — Comunicación con Google Sheets API
   Depende de: config.js (CONFIG, SHEET_SISPRO, getFallbackData)
   ========================================================================== */

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

    console.log(`[api] Carga masiva: ${lots.length} lotes, ${plantas.length} plantas`);
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
