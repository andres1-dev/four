/* ════════════════════════════════════════════════════════════════════════════
   INFRASTRUCTURE — DuckDB-WASM adapter
   Encapsula la inicialización del motor, registro de archivos y ejecución
   de consultas. Es el único módulo que conoce DuckDB-WASM.
   ════════════════════════════════════════════════════════════════════════════ */
import { formatVal } from '../domain/formatters.js';
import { TABLE_PREFIX } from '../config/sheets-config.js';

const FILE_ALIAS = 'archivo.parquet';
const CHUNK_SIZE = 200;

export const Engine = {
  api: null,
  db: null,
  conn: null,

  get ready() { return !!this.conn; },

  async init() {
    if (this.db) return;

    this.api = await import('https://esm.sh/@duckdb/duckdb-wasm@1.29.0');

    const bundles = this.api.getJsDelivrBundles();
    let bundle = await this.api.selectBundle(bundles);
    if (!bundle?.mainWorker) bundle = bundles.find(b => b.mainWorker) || bundles[0];
    if (!bundle?.mainWorker) throw new Error('Bundle no compatible con este navegador.');

    const workerUrl = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    );
    this.db = new this.api.AsyncDuckDB(new this.api.ConsoleLogger(), new Worker(workerUrl));
    await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    await this.db.open();
    this.conn = await this.db.connect();
  },

  async loadFile(file) {
    const buffer = await file.arrayBuffer();
    await this.db.registerFileBuffer(FILE_ALIAS, new Uint8Array(buffer));
    await this.conn.query(`CREATE OR REPLACE VIEW datos AS SELECT * FROM '${FILE_ALIAS}'`);
  },

  /**
   * Registra una tabla DuckDB desde filas del catálogo (Sheets).
   * Crea cat_<hoja> con columnas VARCHAR e inserta por chunks.
   * @param {string} nombreHoja
   * @param {{ headers: string[], rows: string[][] }} tabla
   */
  async loadSheetTable(nombreHoja, { headers, rows }) {
    if (!headers.length) return;

    const tableName = TABLE_PREFIX + nombreHoja;
    const cols = headers.map(h => `"${h.replace(/"/g, '""')}" VARCHAR`).join(', ');

    await this.conn.query(`CREATE OR REPLACE TABLE ${tableName} (${cols})`);

    const colList = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(', ');
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const values = chunk
        .map(r => '(' + r.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',') + ')')
        .join(',');
      await this.conn.query(`INSERT INTO ${tableName} (${colList}) VALUES ${values}`);
    }
  },

  /**
   * Carga todo el catálogo de Sheets como tablas cat_*.
   * @param {Object} catalogo - { HOJA: {headers, rows} }
   */
  async loadCatalogTables(catalogo) {
    for (const [hoja, tabla] of Object.entries(catalogo)) {
      await this.loadSheetTable(hoja, tabla);
    }
  },

  async query(sql) {
    const result = await this.conn.query(sql);
    const columns = result.schema.fields.map(f => f.name);
    const rows = result.toArray().map(r => columns.map(c => formatVal(r[c])));
    return { columns, rows };
  },

  /**
   * Ejecuta una query y exporta el resultado como Parquet.
   * COPY corre dentro del worker (no bloquea la UI) y el archivo
   * se materializa en el FS virtual de DuckDB-WASM.
   * @param {string} sql - query SELECT (sin ';' final)
   * @param {string} outName - nombre interno del archivo
   * @returns {Promise<Uint8Array>} bytes del parquet
   */
  async exportParquet(sql, outName = 'export.parquet') {
    const limpio = sql.split(';')[0]; // una sola sentencia, sin ';' final ni comentarios
    await this.conn.query(`COPY (${limpio}) TO '${outName}' (FORMAT PARQUET)`);
    return await this.db.copyFileToBuffer(outName);
  },

  async count() {
    const r = await this.conn.query('SELECT COUNT(*) AS n FROM datos');
    return Number(r.toArray()[0].n);
  },

  async schema() {
    return (await this.conn.query('DESCRIBE datos')).toArray();
  },
};
