/* ════════════════════════════════════════════════════════════════════════════
   PRESENTATION — Table renderer
   Construye el HTML de la tabla de resultados.
   ════════════════════════════════════════════════════════════════════════════ */
import { esc } from '../domain/formatters.js';

const MAX_ROWS_DISPLAY = 5000;

export function renderTable(data) {
  if (!data.columns.length) {
    return '<div class="placeholder">Consulta ejecutada. No devolvió columnas.</div>';
  }
  if (!data.rows.length) {
    return '<div class="placeholder">La consulta no devolvió registros.</div>';
  }

  const head = data.columns.map(c => `<th>${esc(c)}</th>`).join('');
  const body = data.rows.slice(0, MAX_ROWS_DISPLAY).map(row =>
    '<tr>' + row.map(v => `<td title="${esc(v)}">${esc(v)}</td>`).join('') + '</tr>'
  ).join('');

  let html = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;

  if (data.rows.length > MAX_ROWS_DISPLAY) {
    html += '<div class="placeholder">Vista limitada a 5.000 filas. El CSV incluye todos los registros.</div>';
  }

  return html;
}
