/**
 * Historical Data Adapter
 * Transforma datos consolidados del JSON histórico al formato raw que espera el sistema
 */

// Importar funciones de utilidad de fechas (necesario para ordenamiento)
let parseDate;
try {
    // Intentar importar desde date_utils
    const dateUtils = await import('./date_utils.js');
    parseDate = dateUtils.parseDate;
} catch (error) {
    // Fallback: usar constructor de Date nativo
    parseDate = (dateStr) => {
        if (!dateStr) return null;
        // Manejar formato YYYY-MM-DD
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        // Manejar formato DD/MM/YYYY
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        return new Date(dateStr);
    };
}

/**
 * Carga datos históricos del archivo JSON
 */
export async function loadHistoricalData() {
    try {
        const response = await fetch('historical_data.json');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error al cargar datos históricos:', error);
        return {};
    }
}

/**
 * Transforma datos consolidados a formato raw compatible con el sistema
 * @param {Array} consolidatedData - Datos en formato consolidado del JSON
 * @returns {Array} Datos en formato raw {FECHA, CANTIDAD, PROVEEDOR}
 */
function transformConsolidatedToRaw(consolidatedData) {
    if (!consolidatedData || !Array.isArray(consolidatedData)) return [];

    return consolidatedData.map(item => {
        return {
            FECHA: item.fecha,           // YYYY-MM-DD
            CANTIDAD: item.ingreso,      // Número
            PROVEEDOR: item.proveedor,   // 'ANGELES' o 'UNIVERSO'
            ANO: String(item.año)        // Año como string
        };
    });
}

/**
 * Carga datos históricos para un año específico y los transforma a formato raw
 * @param {number} year - Año a cargar (ej: 2024)
 * @returns {Array} Datos en formato raw
 */
async function loadHistoricalYearAsRaw(year) {
    const historicalData = await loadHistoricalData();
    const yearData = historicalData[String(year)] || [];
    return transformConsolidatedToRaw(yearData);
}

/**
 * Carga todos los datos históricos y los transforma a formato raw
 * @returns {Array} Todos los datos históricos en formato raw
 */
async function loadAllHistoricalAsRaw() {
    const historicalData = await loadHistoricalData();
    const allRawData = [];

    Object.keys(historicalData).forEach(year => {
        const yearData = historicalData[year];
        const rawYearData = transformConsolidatedToRaw(yearData);
        allRawData.push(...rawYearData);
    });

    // Ordenar por fecha
    return allRawData.sort((a, b) => a.FECHA.localeCompare(b.FECHA));
}

/**
 * Verifica si hay datos históricos disponibles para un año
 * @param {number} year - Año a verificar
 * @returns {boolean} True si hay datos disponibles
 */
async function hasHistoricalData(year) {
    const historicalData = await loadHistoricalData();
    const yearData = historicalData[String(year)] || [];
    return yearData.length > 0;
}

/**
 * Obtiene todos los años disponibles en los datos históricos (2024 hacia adelante)
 * @returns {Array} Array de años (strings)
 */
export async function getAvailableYears() {
    const historicalData = await loadHistoricalData();
    const minYear = 2024;
    return Object.keys(historicalData)
        .filter(year => historicalData[year] && historicalData[year].length > 0)
        .filter(year => parseInt(year) >= minYear);
}

/**
 * Transforma datos consolidados del JSON al formato que espera el sistema (consolidatedData)
 * Los datos del JSON ya vienen calculados (meta, diferencia, cumplimiento)
 * @param {Array} consolidatedData - Datos en formato consolidado del JSON
 * @returns {Array} Datos en formato {Fecha, Dia, Semana, Mes, Año, Ingreso, Meta, Diferencia, Cumplimiento}
 */
export function transformToConsolidatedFormat(consolidatedData) {
    if (!consolidatedData || !Array.isArray(consolidatedData)) return [];

    return consolidatedData.map(item => {
        return {
            Fecha: item.fecha,              // YYYY-MM-DD
            Dia: item.dia,                  // Nombre del día
            Semana: item.semana,            // Número de semana
            Mes: item.mes,                  // Nombre del mes en mayúsculas
            Año: item.año,                  // Número de año
            Ingreso: item.ingreso,          // Número
            Meta: item.meta,                // Número
            Diferencia: item.diferencia,    // Número
            Cumplimiento: typeof item.cumplimiento === 'number'
                ? item.cumplimiento.toFixed(2) + '%'
                : (item.cumplimiento.toString().includes('%')
                    ? item.cumplimiento
                    : item.cumplimiento + '%'), // String con porcentaje
            TotalRegistros: 1               // Valor por defecto
        };
    });
}

/**
 * Carga datos históricos para un año específico en formato consolidado
 * @param {number} year - Año a cargar (ej: 2024)
 * @returns {Array} Datos en formato consolidado
 */
export async function loadHistoricalYearAsConsolidated(year) {
    const historicalData = await loadHistoricalData();
    const yearData = historicalData[String(year)] || [];
    return transformToConsolidatedFormat(yearData);
}

/**
 * Carga todos los datos históricos en formato consolidado
 * @returns {Array} Todos los datos históricos en formato consolidado
 */
export async function loadAllHistoricalAsConsolidated() {
    const historicalData = await loadHistoricalData();
    const allConsolidatedData = [];

    Object.keys(historicalData).forEach(year => {
        const yearData = historicalData[year];
        const consolidatedYearData = transformToConsolidatedFormat(yearData);
        allConsolidatedData.push(...consolidatedYearData);
    });

    // Ordenar por fecha
    return allConsolidatedData.sort((a, b) => {
        const dateA = parseDate ? parseDate(a.Fecha) : new Date(a.Fecha);
        const dateB = parseDate ? parseDate(b.Fecha) : new Date(b.Fecha);
        return dateA - dateB;
    });
}
