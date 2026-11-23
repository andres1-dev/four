/* ════════════════════════════════════════════════════════════════════════════
   APPLICATION — Use cases
   Orquesta la infraestructura y aplica reglas de negocio.
   No conoce el DOM ni DuckDB directamente.
   ════════════════════════════════════════════════════════════════════════════ */
import { Engine } from '../infrastructure/duckdb-engine.js';
import { cargarCatalogoSheets } from '../infrastructure/sheets-catalog.js';
import { csvEscape } from '../domain/formatters.js';

export const UseCases = {

  async loadParquet(file, onStatus) {
    onStatus('Inicializando motor…');
    await Engine.init();

    onStatus('Leyendo archivo…');
    await Engine.loadFile(file);

    onStatus('Cargando metadatos…');
    const rows = await Engine.count();
    const columns = await Engine.schema();

    // Catálogo desde Google Sheets → tablas cat_*
    let catalogo = {};
    try {
      catalogo = await cargarCatalogoSheets(onStatus);
      onStatus?.('Registrando catálogo en DuckDB…');
      await Engine.loadCatalogTables(catalogo);
    } catch (e) {
      console.warn('No se pudo cargar el catálogo de Sheets:', e);
      onStatus?.('Aviso: no se pudo cargar Sheets — ' + (e.message || e));
    }

    const catalogoInfo = Object.fromEntries(
      Object.entries(catalogo).map(([h, t]) => [h, t.rows.length])
    );

    return { name: file.name, size: file.size, rows, columns, catalogo: catalogoInfo };
  },

  async runSql(sql) {
    return await Engine.query(sql);
  },

  /**
   * Ejecuta el SQL y descarga el resultado como archivo Parquet.
   * @param {string} sql
   * @param {string} filename
   * @returns {Promise<{ ok: boolean, size?: number, error?: string }>}
   */
  async exportParquet(sql, filename = 'export') {
    const safe = (filename || 'export').replace(/[^a-z0-9_-]/gi, '_');
    const buffer = await Engine.exportParquet(sql, safe + '.parquet');

    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = safe + '.parquet';
    a.click();
    URL.revokeObjectURL(url);

    return { ok: true, size: buffer.byteLength };
  },

  exportCsv(data, filename) {
    const header = data.columns.map(csvEscape).join(';');
    const body   = data.rows.map(r => r.map(csvEscape).join(';')).join('\r\n');
    const csv    = header + '\r\n' + body;

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = (filename || 'resultado').replace(/[^a-z0-9_-]/gi, '_') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
};
