/* ==========================================================================
   api.js — Comunicación con Google Sheets API y Seguridad
   Depende de: config.js (CONFIG, SHEET_SISPRO, GAS_ENDPOINT)
   ========================================================================== */

/**
 * Recupera las llaves de API desde Google Apps Script (GAS)
 * para evitar que estén hardcodeadas en el frontend.
 */
let secureConfigPromise = null;

/**
 * Recupera las llaves de API desde Google Apps Script (GAS).
 * Singleton pattern para evitar múltiples llamadas paralelas.
 */
async function fetchSecureConfig() {
    if (secureConfigPromise) return secureConfigPromise;

    secureConfigPromise = (async () => {
        try {
            const cachedConfig = localStorage.getItem('app_secure_config');
            const now = new Date().getTime();
            
            if (cachedConfig) {
                const parsed = JSON.parse(cachedConfig);
                if (now - parsed.timestamp < 86400000 && parsed.API_KEY) {
                    CONFIG.API_KEY = parsed.API_KEY;
                    CONFIG.GEMINI_KEY = parsed.GEMINI_KEY;
                    return CONFIG;
                }
            }

            const res = await fetch(GAS_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ accion: "GET_CONFIG" })
            });

            if (!res.ok) throw new Error('Error al obtener configuración desde GAS');
            
            const data = await res.json();
            if (data && data.API_KEY) {
                CONFIG.API_KEY = data.API_KEY;
                CONFIG.GEMINI_KEY = data.GEMINI_KEY;
                
                localStorage.setItem('app_secure_config', JSON.stringify({
                    API_KEY: data.API_KEY,
                    GEMINI_KEY: data.GEMINI_KEY,
                    timestamp: now
                }));
            }
            return CONFIG;
        } catch (error) {
            secureConfigPromise = null; // Reintentar en la próxima llamada
            throw error;
        }
    })();

    return secureConfigPromise;
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
    // Asegurar que la configuración esté disponible antes de peticionar
    if (!CONFIG.API_KEY) {
        await fetchSecureConfig();
    }
    
    const url =
        `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}` +
        `/values/${sheetName}!A:AF?key=${CONFIG.API_KEY}&majorDimension=ROWS`;

    const response = await fetch(url, { cache: 'no-store' });

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

/**
 * Obtiene el listado completo de reportes de calidad.
 */
async function fetchReportesData() {
    return fetchSheetData(
        SHEET_REPORTES.name,
        SHEET_REPORTES.indices,
        SHEET_REPORTES.headers,
    );
}
