// ============================================
// FORMATTERS.JS — Funciones de Formateo
// ============================================
// Funciones puras de formateo de datos para presentación
// Sin efectos secundarios, sin mutación de estado

/**
 * Formatea un valor de celda para visualización
 * Maneja null, arrays, objetos y valores primitivos
 * @param {*} value - Valor a formatear
 * @returns {string} Valor formateado como string
 */
function formatCellValue(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

/**
 * Formatea una fecha a formato DD/MM/YYYY
 * Maneja strings de fecha con o sin hora
 * @param {string} dateString - String de fecha a formatear
 * @returns {string} Fecha formateada o string vacío
 */
function formatDate(dateString) {
    if (!dateString) return '';
    return normalizeFecha(dateString.split(' ')[0]);
}

/**
 * Normaliza fecha a DD/MM/YYYY con ceros
 * Maneja tanto "19/3/2026" como "19/03/2026"
 * @param {string} fechaStr - String de fecha
 * @returns {string} Fecha normalizada con ceros
 */
function normalizeFecha(fechaStr) {
    if (!fechaStr) return '';
    const s = fechaStr.toString().trim().split(' ')[0]; // quitar hora si existe
    const parts = s.split('/');
    if (parts.length !== 3) return s;
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${d}/${m}/${y}`;
}

/**
 * Formatea un costo como entero (sin decimales)
 * @param {number} costo - Valor numérico del costo
 * @returns {string} Costo formateado como string entero
 */
function formatCosto(costo) {
    return Math.floor(costo).toString();
}

/**
 * Formatea un número como moneda colombiana
 * @param {number} value - Valor numérico
 * @returns {string} Valor formateado con separadores de miles
 */
function formatCurrency(value) {
    if (value == null || isNaN(value)) return '$ 0';
    return '$ ' + Math.floor(value).toLocaleString('es-CO');
}

/**
 * Formatea un número con separadores de miles
 * @param {number} value - Valor numérico
 * @returns {string} Número formateado
 */
function formatNumber(value) {
    if (value == null || isNaN(value)) return '0';
    return Math.floor(value).toLocaleString('es-CO');
}

/**
 * Formatea un porcentaje
 * @param {number} value - Valor decimal (0.15 = 15%)
 * @param {number} decimals - Cantidad de decimales (default: 0)
 * @returns {string} Porcentaje formateado
 */
function formatPercentage(value, decimals = 0) {
    if (value == null || isNaN(value)) return '0%';
    return (value * 100).toFixed(decimals) + '%';
}

// Exportar funciones al scope global para compatibilidad
window.formatCellValue = formatCellValue;
window.formatDate = formatDate;
window.normalizeFecha = normalizeFecha;
window.formatCosto = formatCosto;
window.formatCurrency = formatCurrency;
window.formatNumber = formatNumber;
window.formatPercentage = formatPercentage;
