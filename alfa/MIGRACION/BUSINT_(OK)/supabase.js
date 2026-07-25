// ─── SUPABASE FETCH ───────────────────────────────────────────
async function sbFetch(endpoint, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(`${res.status} — ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : [];
}

// ─── GUARDAR EN SUPABASE ──────────────────────────────────────
async function saveChanges() {
  const toUpdate = records
    .map(rec => {
      const calc = calcRow(rec);
      const orig = rec.raw;
      const pCambia = calc.prenda      !== (orig.prenda      || '');
      const gCambia = calc.genero      !== (orig.genero      || '');
      const dCambia = calc.descripcion !== (orig.descripcion || '');
      if (!pCambia && !gCambia && !dCambia) return null;
      return { id: orig.A, payload: { prenda: calc.prenda, genero: calc.genero, descripcion: calc.descripcion } };
    })
    .filter(Boolean);

  if (!toUpdate.length) { setStatus('No hay cambios pendientes.'); return; }

  setStatus(`Guardando ${toUpdate.length} registros...`);
  document.getElementById('btnSave').disabled = true;

  let ok = 0, errors = 0;
  for (let i = 0; i < toUpdate.length; i += 10) {
    await Promise.all(toUpdate.slice(i, i+10).map(async ({ id, payload }) => {
      try {
        await sbFetch(
          `ingresos?id_ingreso=eq.${encodeURIComponent(id)}&productora=eq.${PRODUCTORA}`,
          { method: 'PATCH', body: JSON.stringify(payload) }
        );
        const rec = records.find(r => r.raw.A === id);
        if (rec) { rec.raw.prenda = payload.prenda; rec.raw.genero = payload.genero; rec.raw.descripcion = payload.descripcion; }
        ok++;
      } catch(e) { console.error(id, e.message); errors++; }
    }));
    setStatus(`Progreso: ${Math.min(i+10, toUpdate.length)} / ${toUpdate.length}`);
  }

  overrides = {};
  updateStats(); renderTable();
  setStatus(`Listo. ${ok} actualizados${errors ? `, ${errors} errores` : ''}.`);
  document.getElementById('btnSave').disabled = false;
}

// ─── EXPORTAR SQL ─────────────────────────────────────────────
function exportSQL() {
  const lines = ['-- SQL generado por fix-busint\n'];
  records.forEach(rec => {
    const calc = calcRow(rec);
    const orig = rec.raw;
    const sets = [];
    if (calc.prenda      !== (orig.prenda      ||'')) sets.push(`prenda = '${calc.prenda.replace(/'/g,"''")}'`);
    if (calc.genero      !== (orig.genero      ||'')) sets.push(`genero = '${calc.genero.replace(/'/g,"''")}'`);
    if (calc.descripcion !== (orig.descripcion ||'')) sets.push(`descripcion = '${calc.descripcion.replace(/'/g,"''")}'`);
    if (!sets.length) return;
    lines.push(`UPDATE ingresos SET ${sets.join(', ')} WHERE id_ingreso = '${orig.A}' AND productora = ${PRODUCTORA};`);
  });
  if (lines.length <= 2) { setStatus('No hay cambios para exportar.'); return; }
  downloadBlob(lines.join('\n'), 'fix_busint.sql', 'text/sql;charset=utf-8;');
  setStatus(`SQL exportado con ${lines.length-1} sentencias.`);
}

// ─── DESCARGAR CSV ────────────────────────────────────────────
function downloadCSV() {
  if (!records.length) { alert('Primero carga registros'); return; }
  const headers = [
    'id_ingreso','fecha_ingreso','fecha_traslado','taller','gestor','linea','auditor','escaner',
    'lote','refprov','descripcion','descripcion_larga','cantidad',
    'total_relativo','total_general','diferencia','costo_unitario','costo_total',
    'auditoria','orden_servicio','traslado','referencia','tipo','pvp','clase',
    'prenda','genero','marca','proveedor','bolsas',
    'otros_traslados','anexos','hr','detalle_cantidades',
    'total','productora','fuente'
  ];
  const rows = [headers.join(',')];
  records.forEach(rec => {
    const calc = calcRow(rec);
    const r    = rec.raw;
    const record = { ...r, prenda: calc.prenda, genero: calc.genero, marca: calc.marca, descripcion: calc.descripcion };
    rows.push(headers.map(h => escapeCSV(record[h])).join(','));
  });
  downloadBlob(rows.join('\n'), 'busint_corregido.csv', 'text/csv;charset=utf-8;');
  setStatus(`CSV descargado con ${records.length} registros.`);
}

function escapeCSV(v) {
  if (v===null||v===undefined) return '';
  return `"${String(v).replace(/"/g,'""')}"`;
}

function downloadBlob(content, filename, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ─── REEMPLAZAR REGISTROS BUSINT EN SUPABASE ─────────────────────
// Usa Edge Function para borrar e insertar registros
async function replaceBUSINT() {
  if (!records.length) { alert('Primero carga registros'); return; }

  if (!confirm(`¿Estás seguro de reemplazar TODOS los registros de fuente BUSINT (${records.length} registros)?`)) {
    return;
  }

  setStatus('Preparando registros...');
  const btn = document.getElementById('btnReplace');
  btn.disabled = true; btn.textContent = 'Enviando...';

  try {
    // Preparar todos los registros para enviar a la Edge Function
    const toInsert = [];

    for (const rec of records) {
      const calc = calcRow(rec);
      const r = rec.raw;

      const payload = {
        id_ingreso:         r.id_ingreso,
        fecha_ingreso:      r.fecha_ingreso,
        fecha_traslado:     r.fecha_traslado,
        taller:             r.taller,
        gestor:             r.gestor,
        linea:              r.linea,
        auditor:            r.auditor,
        escaner:            r.escaner,
        lote:               r.lote,
        refprov:            r.refprov,
        descripcion:        calc.descripcion,
        descripcion_larga:  r.descripcion_larga,
        cantidad:           r.cantidad,
        total_relativo:     r.total_relativo,
        total_general:      r.total_general,
        diferencia:         r.diferencia,
        costo_unitario:     r.costo_unitario,
        costo_total:        r.costo_total,
        auditoria:          r.auditoria,
        orden_servicio:     r.orden_servicio,
        traslado:           r.traslado,
        referencia:         r.referencia,
        tipo:               r.tipo,
        pvp:                r.pvp,
        clase:              r.clase,
        prenda:             calc.prenda,
        genero:             calc.genero,
        marca:              calc.marca,
        proveedor:          r.proveedor,
        bolsas:             r.bolsas,
        otros_traslados:    JSON.parse(r.otros_traslados || '[]'),
        anexos:             JSON.parse(r.anexos || '[]'),
        hr:                 JSON.parse(r.hr || '[]'),
        detalle_cantidades: JSON.parse(r.detalle_cantidades || '{}'),
        total:              r.total,
        productora:         r.productora,
        fuente:             'BUSINT'
      };

      toInsert.push(payload);
    }

    setStatus('Enviando a Edge Function...');
    btn.textContent = 'Procesando...';

    // Llamar a la Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/replace-busint`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ records: toInsert })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Error en Edge Function');
    }

    setStatus(`Listo. ${result.inserted} registros insertados${result.errors > 0 ? `, ${result.errors} errores` : ''}.`);
    btn.disabled = false; btn.textContent = '⑥ Reemplazar BUSINT';

  } catch (e) {
    console.error('Error:', e);
    setStatus('Error: ' + e.message);
    btn.disabled = false; btn.textContent = '⑥ Reemplazar BUSINT';
  }
}
