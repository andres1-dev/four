/* ════════════════════════════════════════════════════════════════════════════
   PRESENTATION — Query card factory
   Crea tarjetas de consulta, gestiona ejecución y exportación.
   ════════════════════════════════════════════════════════════════════════════ */
import { esc } from '../domain/formatters.js';
import { renderTable } from './table-renderer.js';
import { UseCases } from '../application/use-cases.js';

let queryCount = 0;

export function createQueryCard(name = '', sql = '') {
  queryCount++;
  const card = document.createElement('div');
  card.className = 'query-card';
  card.innerHTML = `
    <div class="query-head">
      <div class="query-label">
        <span>SQL ${queryCount}</span>
        <input aria-label="Nombre de consulta" value="${esc(name || 'Consulta ' + queryCount)}">
      </div>
      <div class="card-actions">
        <button class="run primary">Ejecutar</button>
        <button class="csv" disabled>CSV</button>
        <button class="remove">Eliminar</button>
      </div>
    </div>
    <textarea class="sql-input" spellcheck="false" aria-label="Consulta SQL">${esc(sql)}</textarea>
    <div class="result-bar"><span class="msg">Pendiente de ejecución</span><span class="cnt"></span></div>
    <div class="table-scroll"><div class="placeholder">Ejecuta la consulta para ver los resultados.</div></div>
  `;

  card.querySelector('.run').onclick    = () => executeCard(card);
  card.querySelector('.remove').onclick = () => card.remove();
  card.querySelector('.csv').onclick    = () => UseCases.exportCsv(card._data, card.querySelector('input').value);

  return card;
}

export async function executeCard(card) {
  if (!window.__engineReady) {
    alert('Carga primero un archivo Parquet.');
    return;
  }

  const sql = card.querySelector('textarea').value.trim();
  const msg = card.querySelector('.msg');
  const cnt = card.querySelector('.cnt');
  const wrap = card.querySelector('.table-scroll');
  const csvBtn = card.querySelector('.csv');

  if (!sql) { msg.textContent = 'Escribe una consulta SQL.'; return; }

  msg.textContent = 'Ejecutando…';
  msg.className = 'msg';
  cnt.textContent = '';
  wrap.innerHTML = '<div class="placeholder">Procesando…</div>';
  csvBtn.disabled = true;

  const t0 = performance.now();
  try {
    const data = await UseCases.runSql(sql);
    card._data = data;

    wrap.innerHTML = renderTable(data);

    msg.textContent = `Correcto · ${(performance.now() - t0).toFixed(0)} ms`;
    msg.className = 'msg ok';
    cnt.textContent = `${data.rows.length.toLocaleString('es-CO')} filas · ${data.columns.length} columnas`;
    csvBtn.disabled = !data.columns.length;
  } catch (e) {
    console.error(e);
    msg.textContent = 'Error: ' + (e.message || e);
    msg.className = 'msg err';
    wrap.innerHTML = '<div class="placeholder">Revisa la sintaxis y los nombres de columnas.</div>';
  }
}
