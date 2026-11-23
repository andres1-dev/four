// ===================== CONFIG — Google Sheets =====================
export const SHEETS_CONFIG = {
  SPREADSHEET_ID: '1ASNfwT80P3zdytY-wP-EkCfNsLwKhNNJ-o3_WdD3-jc',
  GAS_ENDPOINT: 'https://script.google.com/macros/s/AKfycbxyRU0_bikhzQZW0AUC4WuZg56EQ4xw8DQ4kUvFgSaIuhugyDGIr4qvCOOCLRTtcYXRrA/exec',
  SHEETS: {
    COLORES: { range: 'A:B' },
    GRUPO_SUBGRUPO: { range: 'A:C' },
    TALLAS: { range: 'A:B' },
    PROVEEDOR: { range: 'A:B' },
    TIPOS: { range: 'A:B' },
  },
};

// Nombre de tabla DuckDB por hoja (prefijo cat_)
export const TABLE_PREFIX = 'cat_';

// Dimensiones para el análisis NO MATCH (parquet vs Sheets)
// parquetCol: columna en la vista `datos` · keyHeader: columna en la hoja Sheets
// extraHeaders: demás columnas de la hoja a completar
export const NO_MATCH_DIMS = [
  {
    hoja: 'GRUPO_SUBGRUPO',
    catTable: 'cat_GRUPO_SUBGRUPO',
    parquetCol: 'f120_referencia',
    keyHeader: 'f120_referencia',
    extraHeaders: ['GENERO', 'PRENDA'],
    // PRENDA se sugiere desde TIPOS.PRENDA (catálogo oficial de prendas)
    sugerencias: { PRENDA: { table: 'cat_TIPOS', col: 'PRENDA' } },
  },
  {
    hoja: 'COLORES',
    catTable: 'cat_COLORES',
    parquetCol: 'color',
    keyHeader: 'color',
    extraHeaders: ['COLORES'],
  },
  {
    hoja: 'TALLAS',
    catTable: 'cat_TALLAS',
    parquetCol: 'talla',
    keyHeader: 'talla',
    extraHeaders: ['Tallaje'],
  },
  {
    hoja: 'PROVEEDOR',
    catTable: 'cat_PROVEEDOR',
    parquetCol: '"[03-MARCA]"',
    keyHeader: '[03-MARCA]',
    extraHeaders: ['ORIGEN'],
  },
  {
    // NO MATCH de TIPOS: prendas de GRUPO_SUBGRUPO que no existen en TIPOS.
    // La fuente no es el parquet sino la propia tabla cat_GRUPO_SUBGRUPO.
    hoja: 'TIPOS',
    catTable: 'cat_TIPOS',
    source: { type: 'cat', table: 'cat_GRUPO_SUBGRUPO', col: 'PRENDA' },
    keyHeader: 'PRENDA',
    extraHeaders: ['TIPO'],
  },
];
