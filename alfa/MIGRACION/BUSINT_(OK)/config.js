// ─── CONFIGURACIÓN ───────────────────────────────────────────
const SHEET_ID   = '1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc';
const SHEET_NAME = 'DataBase';
const API_KEY    = 'AIzaSyDrfha70cCUIHlaGeuX__rXKsczabswv68';

const SUPABASE_URL = 'https://iladaofarozipitwaeti.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsYWRhb2Zhcm96aXBpdHdhZXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjYzMDksImV4cCI6MjA5MzA0MjMwOX0.4fyiibeZS10DCgov62d7tIFVzJHsklsBrbokAJ9ptK8';

const PRODUCTORA = 900616124;

// ─── ÍNDICES DE COLUMNAS EN LA HOJA DataBase ─────────────────
const IDX = {
  id_ingreso:        0,   // "REC61074" → quitar "REC"
  fecha:             1,
  taller:            2,
  linea:             3,
  auditor:           4,
  escaner:           5,
  refprov:           6,
  // fuente:         7,   // siempre "BUSINT"
  lote:              8,
  descripcion_larga: 9,
  // ── Anexos ──────────────────────────────────────────────────
  cant_imperfecta:   10,  // cantidad IMPERFECTA
  obs_imperfecta:    11,  // observación IMPERFECTA
  cant_cobro:        12,  // cantidad COBRO
  obs_cobro:         13,  // observación COBRO
  cant_pendiente:    14,  // observación especial (no genera anexo directo)
  obs_pendiente:     15,  // observación adicional
  cant_otros:        16,  // cantidad OTROS (tipo exclusivo BUSINT)
  obs_otros:         17,  // observación OTROS
  // ────────────────────────────────────────────────────────────
  cantidad:          18,
  bolsas:            219,
  detalle_cantidades:20,
  pvp:               31,  // valor numérico del PVP
  referencia:        26,  // referencia histórica
  tipo:              27,  // "FULL" etc.
  genero:            29,
  marca:             30,
  // clase se calcula desde pvp, no viene de la hoja
  hr:                32   // COD_BARRAS∞COLOR∞TALLA∞CANT☬...
};

const GENEROS_VALIDOS = [
  'DAMA','MUJER','FEMENINO','HOMBRE','MASCULINO','CABALLERO',
  'NIÑO','NIÑA','INFANTIL','UNISEX','MIXTO'
];
