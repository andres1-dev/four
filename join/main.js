/* ════════════════════════════════════════════════════════════════════════════
   MAIN — Entry point
   ════════════════════════════════════════════════════════════════════════════ */
import { UseCases } from './src/application/use-cases.js';
import { createQueryCard, executeCard } from './src/presentation/query-card.js';
import { loadStarterQueries } from './src/config/starter-queries.js';
import { esc } from './src/domain/formatters.js';
import { initNoMatchPanel } from './src/presentation/no-match-panel.js';
import { initTreeView } from './src/presentation/tree-view.js';

const $ = id => document.getElementById(id);

const els = {
  fileInput:  $('fileInput'),
  dropZone:   $('dropZone'),
  loadStatus: $('loadStatus'),
  fileMeta:   $('fileMeta'),
  schema:     $('schema'),
  queries:    $('queries'),
  runAll:     $('runAllBtn'),
  addBtn:     $('addBtn'),
  analyzeNoMatch: $('analyzeNoMatchBtn'),
  noMatch:    $('noMatch'),
  exportCsv:  $('exportCsvBtn'),
  buildTree:  $('buildTreeBtn'),
  treePanel:  $('treePanel'),
};

const noMatchPanel = initNoMatchPanel(els.noMatch, setStatus);
const treeView = initTreeView(els.treePanel, setStatus);

function setStatus(text, type = '') {
  els.loadStatus.textContent = text;
  els.loadStatus.className = 'status ' + type;
}

/* ═══ Cargar archivo y ejecutar todos los queries ═══ */
async function handleFile(file) {
  if (!file || !file.name.endsWith('.parquet')) {
    setStatus('Selecciona un archivo .parquet válido.', 'err');
    return;
  }

  els.dropZone.classList.remove('loaded');
  setStatus('Inicializando motor…', 'loading');

  const t0 = performance.now();

  try {
    const meta = await UseCases.loadParquet(file, setStatus);
    const loadMs = (performance.now() - t0).toFixed(0);

    els.dropZone.classList.add('loaded');

    els.schema.textContent =
      meta.columns.map(r => `${r.column_name}  ·  ${r.column_type}`).join('\n') || 'Sin columnas.';

    els.fileMeta.innerHTML =
      `<span>Archivo: <strong>${esc(meta.name)}</strong></span>` +
      `<span>Filas: <strong>${meta.rows.toLocaleString('es-CO')}</strong></span>` +
      `<span>Columnas: <strong>${meta.columns.length}</strong></span>` +
      `<span>Tamaño: <strong>${(meta.size / 1024 / 1024).toFixed(2)} MB</strong></span>` +
      `<span>Carga: <strong>${loadMs} ms</strong></span>` +
      (meta.catalogo && Object.keys(meta.catalogo).length
        ? `<span>Sheets: <strong>${Object.entries(meta.catalogo).map(([h, n]) => `${h} (${n})`).join(' · ')}</strong></span>`
        : '');

    setStatus(`Listo en ${loadMs} ms.`, 'ok');
    els.runAll.disabled = false;
    els.analyzeNoMatch.disabled = false;
    els.exportCsv.disabled = false;
    els.buildTree.disabled = false;
    window.__engineReady = true;

    // Ejecutar todos los queries automáticamente
    for (const card of els.queries.querySelectorAll('.query-card')) {
      await executeCard(card);
    }

  } catch (e) {
    console.error(e);
    setStatus('Error: ' + (e.message || e), 'err');
  }
}

/* ═══ Input change ═══ */
els.fileInput.addEventListener('change', () => {
  const file = els.fileInput.files?.[0];
  if (file) handleFile(file);
});

/* ═══ Drag & drop ═══ */
els.dropZone.addEventListener('dragover', e => { e.preventDefault(); els.dropZone.classList.add('drag-over'); });
els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('drag-over'));
els.dropZone.addEventListener('drop', e => {
  e.preventDefault();
  els.dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files?.[0];
  if (file) handleFile(file);
});

/* ═══ Buttons ═══ */
els.addBtn.onclick = () => els.queries.appendChild(createQueryCard());
els.runAll.onclick = async () => {
  for (const card of els.queries.querySelectorAll('.query-card')) {
    await executeCard(card);
  }
};

els.analyzeNoMatch.onclick = () => noMatchPanel.analizar();
els.buildTree.onclick = () => treeView.construir();

/* ═══ Export Parquet enriquecido POR PARTES ═══
   El JOIN completo no cabe en memoria del navegador, así que se
   particiona por id_cia: cada parte se genera en el worker, se
   descarga y se libera antes de seguir con la siguiente.
   La UI muestra el progreso ("Parte i/n") y NO se bloquea. */
els.exportCsv.onclick = async () => {
  if (!window.__engineReady) {
    setStatus('Carga primero el parquet.', 'err');
    return;
  }

  els.exportCsv.disabled = true;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  try {
    const res = await fetch('queries/06_export_enriquecido.sql');
    if (!res.ok) throw new Error('No se encontró el query de exportación.');
    const sqlBase = (await res.text()).split(';')[0];

    // Particiones por id_cia (empresa)
    const parts = await UseCases.runSql(
      'SELECT DISTINCT CAST(id_cia AS VARCHAR) AS v FROM datos ORDER BY v'
    );
    const valores = parts.rows.map(r => r[0]).filter(Boolean);

    if (!valores.length) throw new Error('No se encontraron particiones (id_cia).');

    let totalMB = 0;
    for (let i = 0; i < valores.length; i++) {
      const v = valores[i];
      setStatus(`Parte ${i + 1}/${valores.length} (id_cia=${v}) — generando Parquet…`, 'loading');

      const sqlChunk = `${sqlBase}\nWHERE CAST(a.id_cia AS VARCHAR) = '${v.replace(/'/g, "''")}'`;
      const resultado = await UseCases.exportParquet(sqlChunk, `enriquecido_cia_${v}`);
      totalMB += resultado.size / 1024 / 1024;

      setStatus(`Parte ${i + 1}/${valores.length} descargada — ${totalMB.toFixed(1)} MB acumulados.`, 'ok');
      await sleep(800); // dejar que el navegador procese la descarga y libere memoria
    }

    setStatus(`Exportación completa: ${valores.length} archivos parquet (~${totalMB.toFixed(1)} MB total).`, 'ok');
  } catch (e) {
    console.error(e);
    setStatus('Error exportando: ' + (e.message || e), 'err');
  } finally {
    els.exportCsv.disabled = false;
  }
};

/* ═══ Starter queries (desde .sql) ═══ */
loadStarterQueries().then(queries => {
  queries.forEach(q => els.queries.appendChild(createQueryCard(q.name, q.sql)));
});

/* ═══ Mobile grid ═══ */
if (matchMedia('(max-width: 680px)').matches) {
  document.querySelector('.top-grid').style.gridTemplateColumns = '1fr';
}

/* ═══ Auto-carga del parquet por defecto ═══
   Si el usuario arrastra/selecciona OTRO archivo, ese prevalece
   (handleFile se ejecuta de nuevo y reemplaza la vista `datos`). */
async function autoLoadDefault() {
  try {
    setStatus('Descargando parquet por defecto (87 MB)…', 'loading');
    const res = await fetch('data/INF_NECESIDAD_TIENDAS_SKU.parquet');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const blob = await res.blob();
    const file = new File([blob], 'INF_NECESIDAD_TIENDAS_SKU.parquet', {
      type: 'application/octet-stream',
    });
    await handleFile(file);
  } catch (e) {
    console.warn('Auto-carga falló:', e);
    setStatus('Sin parquet por defecto — arrastra o selecciona un archivo.', 'err');
  }
}

autoLoadDefault();
