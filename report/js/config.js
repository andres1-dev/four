/* ==========================================================================
   config.js — Constantes globales y configuración de la aplicación
   ========================================================================== */

/**
 * Configuración dinámica: Las llaves se recuperan desde GAS para mayor seguridad.
 */
let CONFIG = {
    API_KEY: null,      // Se cargará desde GAS
    GEMINI_KEY: null,   // Se cargará desde GAS
    SPREADSHEET_ID: '1ZLGG8wfszE6D8vGwCECWguWGUiDXGUGfN87ZukyaCpo',
};

/**
 * Endpoint de Google Apps Script para guardar datos de formularios.
 * @readonly
 */
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwHyBLQxirRHSXBpTE6Ax4t70DjzP2qrvh9YcSSvz-l6orIn7uC4DwM9PfqQJJh5qoQdw/exec';

/**
 * Definición de la hoja SISPRO (lectura de lotes).
 * - indices: posiciones de columna en la hoja original (A=0, B=1 …).
 * - headers: nombres lógicos que se asignan a cada índice.
 * @readonly
 */
const SHEET_SISPRO = Object.freeze({
    name: 'SISPRO',
    indices: [0, 1, 4, 9, 10, 16, 12],
    headers: ['LOTE', 'REFERENCIA', 'CANTIDAD', 'PLANTA', 'SALIDA', 'LINEA', 'PROCESO'],
});

/**
 * Hojas destino para escritura de reportes vía GAS.
 * @readonly
 */
const SHEETS_DESTINO = Object.freeze({
    NOVEDADES: 'NOVEDADES',
    CALIDAD: 'REPORTES',
    PLANTAS: 'PLANTAS',
});

/**
 * Definición de lectura de datos de resultados (Novedades).
 * - indices: del 0 al 13
 * @readonly
 */
const SHEET_NOVEDADES = Object.freeze({
    name: 'NOVEDADES',
    indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    headers: ['ID_RADICADO', 'FECHA', 'LOTE', 'REFERENCIA', 'CANTIDAD', 'PLANTA', 'SALIDA', 'LINEA', 'PROCESO', 'AREA', 'DESCRIPCION', 'CANTIDAD_SOLICITADA', 'IMAGEN', 'ESTADO'],
});

/**
 * Definición de lectura de datos de Plantas.
 * @readonly
 */
const SHEET_PLANTAS = Object.freeze({
    name: 'PLANTAS',
    indices: [0, 1, 2, 3, 4, 5],
    headers: ['TIMESTAMP', 'CEDULA', 'PLANTA', 'DIRECCION', 'TELEFONO', 'EMAIL'],
});

/**
 * Definición de la hoja de Usuarios para control de acceso.
 * @readonly
 */
const SHEET_USUARIOS = Object.freeze({
    name: 'USUARIOS',
    indices: [0, 1, 2, 3, 4, 5],
    headers: ['ID', 'USUARIO', 'CORREO', 'TELEFONO', 'ROL', 'PASSWORD'],
});

/* ── Hojas inactivas (reservadas para uso futuro) ──────────────────────── */
// const SHEET_PLANTA  = { name: 'PLANTA',  indices: [0,1,11,12,13,27], headers: [...] };
// const SHEET_PROCESO = { name: 'PROCESO', indices: [3,1,5,7,11,13,8], headers: [...] };

/**
 * Logos disponibles para el carrusel de logo.
 * @readonly
 */
const LOGOS = Object.freeze([
    'https://i.ibb.co/nD9wcPv/GRUPO-TMD-FULL.png',
    'https://i.ibb.co/r34f0Z5/ORCA-GIFS.gif',
    'https://i.ibb.co/jr1GBKy/ORCAGIFS-imageonline-co-47703-1.png',
]);
