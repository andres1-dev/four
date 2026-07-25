// ─── ESTADO ───────────────────────────────────────────────────
let records   = [];
let overrides = {};
let activeTab = 'all';
let prendaFiltro = '';
let duplicates = new Set();

function setStatus(msg) {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
}

// ─── CALCULAR FILA ────────────────────────────────────────────
function calcRow(rec) {
  const ov        = overrides[rec.raw.A];
  const descLarga = rec.raw['DESCRIPCIÓN_LARGA'] || '';
  const extracted = extractPrendaGenero(descLarga);

  let generoFinal  = extracted.genero;
  let generoFuente = 'desc';
  if (!generoFinal && !ov) {
    const gs = normalizeGenero(rec.raw.GENERO || '');
    if (gs) { generoFinal = gs; generoFuente = 'sheets'; }
  }

  const prenda = ov ? ov.prenda : extracted.prenda;
  const genero = ov ? ov.genero : generoFinal;
  if (ov) generoFuente = 'manual';

  const marca       = getMarca(genero);
  const descripcion = buildDescripcion(prenda, genero, marca, rec.raw.REFPROV || '');
  return { prenda, genero, marca, descripcion, descLarga, generoFuente };
}

function statusOf(p, g) { return !p ? 'err' : !g ? 'warn' : 'ok'; }



// ─── CARGAR DESDE SHEETS ──────────────────────────────────────
async function loadData() {
  setStatus('Cargando desde Google Sheets...');
  records = []; overrides = {};

  try {
    const url  = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A:HN?key=${API_KEY}`;
    const json = await (await fetch(url)).json();
    const rows = (json.values || []).slice(1);
    const allRecs = [];

    rows.forEach((row, i) => {
      try {
        if (!row[IDX.id_ingreso]) return;
        allRecs.push({ raw: transformRow(row) });
      } catch(e) { console.error('Fila', i+2, e); }
    });

    // Todos los registros se tratan igual (FULL, PENDIENTES, PROMO son independientes)
    records = allRecs;

    // Identificar repetidos
    const counts = {};
    duplicates.clear();
    records.forEach(r => {
      const id = r.raw.A;
      counts[id] = (counts[id] || 0) + 1;
    });
    Object.entries(counts).forEach(([id, count]) => {
      if (count > 1) duplicates.add(id);
    });

    const sinDesc = records.filter(r => !r.raw['DESCRIPCIÓN_LARGA']).length;
    setStatus(`${records.length} registros cargados.${sinDesc ? ` ${sinDesc} sin descripción larga.` : ''}`);
    if (duplicates.size > 0) {
      document.getElementById('badgeRepetidos').textContent = duplicates.size;
    } else {
      document.getElementById('badgeRepetidos').textContent = '0';
    }

    updateStats(); renderTable();
    document.getElementById('stats').style.display    = 'flex';
    document.getElementById('tabsWrap').style.display = 'block';
    document.getElementById('tableWrap').style.display = 'block';
    ['btnSave','btnExport','btnCSV','btnPreview','btnReplace'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = false;
    });
  } catch(e) {
    setStatus('Error: ' + e.message);
    console.error(e);
  }
}

// ─── ESTADÍSTICAS ─────────────────────────────────────────────
function updateStats() {
  let ok=0, warn=0, err=0, sinRes=0;
  records.forEach(rec => {
    const { prenda, genero } = calcRow(rec);
    const s = statusOf(prenda, genero);
    if (s==='ok') ok++; else if (s==='warn') warn++; else err++;
    if (!genero) sinRes++;
  });
  document.getElementById('cntOk').textContent    = ok;
  document.getElementById('cntWarn').textContent  = warn;
  document.getElementById('cntErr').textContent   = err;
  document.getElementById('cntTotal').textContent = records.length;
  document.getElementById('badgeSinResolver').textContent = sinRes;
}

// ─── PESTAÑAS ─────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  const tabs = { all:'tab-all', sinresolver:'tab-sinresolver', repetidos:'tab-repetidos', prendas:'tab-prendas' };
  Object.entries(tabs).forEach(([k,id]) => {
    const b = document.getElementById(id);
    if (b) { b.style.background = k===tab?'#1e293b':'#0f172a'; b.style.color = k===tab?'#e2e8f0':'#94a3b8'; }
  });
  document.getElementById('tableWrap').style.display    = tab==='prendas' ? 'none'  : 'block';
  document.getElementById('prendasPanel').style.display = tab==='prendas' ? 'block' : 'none';
  document.getElementById('filterBar').style.display    = tab==='all'     ? 'flex'  : 'none';
  if (tab==='prendas') renderPrendas(); else renderTable();
}

// ─── TABLA ────────────────────────────────────────────────────
const BADGE = {
  ok:   '<span class="badge badge-ok">OK</span>',
  warn: '<span class="badge badge-warn">Sin género</span>',
  err:  '<span class="badge badge-err">Sin prenda</span>'
};
const FUENTE_BADGE = {
  desc:   '<span style="background:#1e3a5f;color:#7dd3fc;border-radius:99px;padding:1px 7px;font-size:10px">descripción</span>',
  sheets: '<span style="background:#1a2e1a;color:#86efac;border-radius:99px;padding:1px 7px;font-size:10px">Sheets</span>',
  manual: '<span style="background:#3b1f6e;color:#c4b5fd;border-radius:99px;padding:1px 7px;font-size:10px">manual</span>',
  '':     '<span style="background:#450a0a;color:#f87171;border-radius:99px;padding:1px 7px;font-size:10px">ninguna</span>'
};

function renderTable() {
  const fStatus = document.getElementById('filterStatus')?.value || 'all';
  const fLote   = (document.getElementById('filterLote')?.value || '').trim();
  const tbody   = document.getElementById('tbody');
  tbody.innerHTML = '';

  records.forEach(rec => {
    const id      = rec.raw.A;
    const lote    = String(rec.raw.LOTE || rec.raw.lote || '');
    const changed = !!overrides[id];
    const { prenda, genero, marca, descripcion, descLarga, generoFuente } = calcRow(rec);
    const status  = statusOf(prenda, genero);

    if (activeTab === 'sinresolver' && genero) return;
    if (activeTab === 'repetidos' && !duplicates.has(id)) return;
    
    if (activeTab === 'all' || activeTab === 'repetidos') {
      if (fStatus !== 'all') {
        if (fStatus === 'changed' && !changed) return;
        if (fStatus !== 'changed' && status !== fStatus) return;
      }
      if (fLote && !id.includes(fLote) && !lote.includes(fLote)) return;
      if (prendaFiltro && prenda !== prendaFiltro) return;
    }

    const tr = document.createElement('tr');
    if (changed) tr.classList.add('changed');
    if (duplicates.has(id)) tr.style.borderLeft = '4px solid #ef4444';

    tr.innerHTML = `
      <td style="font-weight:700;color:${duplicates.has(id)?'#ef4444':'#e2e8f0'};white-space:nowrap">${id}</td>
      <td style="color:#94a3b8;white-space:nowrap">${lote}</td>
      <td class="cell-trunc" style="color:#94a3b8" title="${esc(descLarga)}">${descLarga||'<span style="color:#ef4444;font-style:italic">sin descripción</span>'}</td>
      <td><input class="inline" list="prendas-list" value="${esc(prenda)}" data-id="${id}" data-field="prenda" onchange="handleChange(this)" placeholder="Prenda..."></td>
      <td><select class="inline" data-id="${id}" data-field="genero" onchange="handleChange(this)">
        <option value="">— sin género —</option>
        ${['DAMA','HOMBRE','NIÑA','NIÑO','UNISEX'].map(g=>`<option value="${g}" ${genero===g?'selected':''}>${g}</option>`).join('')}
      </select></td>
      <td>${FUENTE_BADGE[generoFuente]||FUENTE_BADGE['']}</td>
      <td style="color:#94a3b8;white-space:nowrap">${marca}</td>
      <td class="new-desc cell-trunc" title="${esc(descripcion)}">${descripcion||'—'}</td>
      <td>${BADGE[status]}</td>`;
    tbody.appendChild(tr);
  });
}

function esc(s) { return (s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function handleChange(el) {
  const id = el.dataset.id, field = el.dataset.field;
  if (!overrides[id]) {
    const { prenda, genero } = calcRow(records.find(r => r.raw.A === id));
    overrides[id] = { prenda, genero };
  }
  overrides[id][field] = el.value.toUpperCase().trim();
  const tr = el.closest('tr');
  tr.classList.add('changed');
  const { marca, descripcion } = calcRow(records.find(r => r.raw.A === id));
  const tds = tr.querySelectorAll('td');
  tds[6].textContent = marca;
  tds[7].textContent = descripcion;
  tds[7].title       = descripcion;
  tds[8].innerHTML   = BADGE[statusOf(overrides[id].prenda, overrides[id].genero)];
  updateStats();
}

// ─── PRENDAS ÚNICAS ───────────────────────────────────────────
function renderPrendas() {
  const grid = document.getElementById('prendasGrid');
  grid.innerHTML = '';
  const map = new Map();
  records.forEach(rec => {
    const { prenda, genero } = calcRow(rec);
    if (!prenda) return;
    if (!map.has(prenda)) map.set(prenda, { total:0, sinGenero:0 });
    map.get(prenda).total++;
    if (!genero) map.get(prenda).sinGenero++;
  });
  [...map.entries()].sort((a,b) => a[0].localeCompare(b[0])).forEach(([prenda, { total, sinGenero }]) => {
    const prob = sinGenero > 0;
    const chip = document.createElement('div');
    chip.style.cssText = `display:inline-flex;align-items:center;gap:8px;background:${prob?'#451a03':'#1e293b'};border:1px solid ${prob?'#92400e':'#334155'};border-radius:8px;padding:8px 14px;font-size:13px;color:${prob?'#fb923c':'#e2e8f0'};cursor:pointer`;
    chip.innerHTML = `<span style="font-weight:700">${prenda}</span><span style="font-size:11px;color:${prob?'#f59e0b':'#64748b'}">${total} reg${prob?` · <strong style="color:#f87171">${sinGenero} sin género</strong>`:''}</span>`;
    chip.onclick = () => { prendaFiltro = prenda; switchTab('all'); prendaFiltro = ''; };
    grid.appendChild(chip);
  });
}
