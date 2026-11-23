/* ════════════════════════════════════════════════════════════════════════════
   PRESENTATION — Panel NO MATCH editable
   Por cada dimensión (GRUPO_SUBGRUPO, COLORES, TALLAS, PROVEEDOR):
   1. Ejecuta el anti-join parquet (datos) vs catálogo Sheets (cat_*)
   2. Renderiza tabla editable: valor sin match + columnas a completar
      (inputs con datalist = valores únicos existentes, admite nuevos)
   3. Guarda en Sheets via GAS doPost (action: agregarLote)
   ════════════════════════════════════════════════════════════════════════════ */
import { Engine } from '../infrastructure/duckdb-engine.js';
import { cargarHojaSheets } from '../infrastructure/sheets-catalog.js';
import { NO_MATCH_DIMS, SHEETS_CONFIG } from '../config/sheets-config.js';
import { esc } from '../domain/formatters.js';

const q = s => `"${String(s).replace(/"/g, '""')}"`;

// Normalización para comparar: MAYÚSCULAS + sin tildes + sin separadores (_ - espacio)
// ASÍ = ASI · VERDE_MENTA = VERDEMENTA = "VERDE MENTA"
const normSql = col => `replace(replace(replace(
  translate(UPPER(TRIM(CAST(${col} AS VARCHAR))), 'ÁÉÍÓÚÜÑÇ', 'AEIOUUNC'),
' ', ''), '_', ''), '-', '')`;

function queryNoMatch(dim) {
  const catKey = dim.keyHeader === '[03-MARCA]' ? '"[03-MARCA]"' : q(dim.keyHeader);

  // Fuente del "hecho": parquet (datos) o tabla cat_* (ej. TIPOS ← PRENDA de GRUPO_SUBGRUPO)
  const esCat = dim.source?.type === 'cat';
  const srcTable = esCat ? dim.source.table : 'datos';
  const srcCol = esCat ? q(dim.source.col) : dim.parquetCol;
  const srcWhere = esCat
    ? `${srcCol} IS NOT NULL AND TRIM(CAST(${srcCol} AS VARCHAR)) <> ''`
    : `id_cia = 1 AND ${srcCol} IS NOT NULL AND TRIM(CAST(${srcCol} AS VARCHAR)) <> ''`;
  const srcCount = esCat ? 'COUNT(DISTINCT f120_referencia)' : 'COUNT(*)';

  return `
    SELECT h.valor, h.registros
    FROM (
      SELECT TRIM(CAST(${srcCol} AS VARCHAR)) AS valor, ${srcCount} AS registros
      FROM ${srcTable}
      WHERE ${srcWhere}
      GROUP BY 1
    ) h
    WHERE ${normSql('h.valor')} NOT IN (
      SELECT DISTINCT ${normSql(catKey)}
      FROM ${dim.catTable}
      WHERE ${catKey} IS NOT NULL AND TRIM(CAST(${catKey} AS VARCHAR)) <> ''
    )
    ORDER BY h.registros DESC
  `;
}

// Guía informativa: descripción más frecuente asociada al valor en el parquet.
// NO se guarda — solo orienta al usuario para completar las columnas.
function queryGuia(dim) {
  // Para fuentes cat_* la "guía" es cuántas referencias usan ese valor
  if (dim.source?.type === 'cat') {
    const srcCol = q(dim.source.col);
    return `
      SELECT valor, CAST(registros AS VARCHAR) || ' referencias' AS guia FROM (
        SELECT TRIM(CAST(${srcCol} AS VARCHAR)) AS valor,
               COUNT(DISTINCT f120_referencia) AS registros
        FROM ${dim.source.table}
        WHERE ${srcCol} IS NOT NULL AND TRIM(CAST(${srcCol} AS VARCHAR)) <> ''
        GROUP BY 1
      )
    `;
  }
  return `
    SELECT valor, guia FROM (
      SELECT
        TRIM(CAST(${dim.parquetCol} AS VARCHAR)) AS valor,
        TRIM(CAST(f120_descripcion AS VARCHAR)) AS guia,
        COUNT(*) AS c
      FROM datos
      WHERE id_cia = 1
        AND ${dim.parquetCol} IS NOT NULL
        AND TRIM(CAST(${dim.parquetCol} AS VARCHAR)) <> ''
        AND f120_descripcion IS NOT NULL
        AND TRIM(CAST(f120_descripcion AS VARCHAR)) <> ''
      GROUP BY 1, 2
    )
    QUALIFY ROW_NUMBER() OVER (PARTITION BY valor ORDER BY c DESC) = 1
  `;
}

function queryUnicos(dim, header) {
  // Si la dimensión define una fuente alternativa de sugerencias
  // (ej. PRENDA desde cat_TIPOS), usarla en vez de su propia tabla.
  const fuente = dim.sugerencias?.[header] || { table: dim.catTable, col: header };
  const col = fuente.col === '[03-MARCA]' ? '"[03-MARCA]"' : q(fuente.col);
  return `
    SELECT DISTINCT TRIM(CAST(${col} AS VARCHAR)) AS v
    FROM ${fuente.table}
    WHERE ${col} IS NOT NULL AND TRIM(CAST(${col} AS VARCHAR)) <> ''
    ORDER BY v
  `;
}

/**
 * Inicializa el panel NO MATCH.
 * @param {HTMLElement} container
 * @param {(msg:string,type?:string)=>void} setStatus
 * @returns {{ analizar: Function }}
 */
export function initNoMatchPanel(container, setStatus) {
  const sugerencias = {}; // `${hoja}::${header}` -> string[]

  async function cargarSugerencias(dim) {
    for (const header of dim.extraHeaders) {
      const clave = `${dim.hoja}::${header}`;
      if (sugerencias[clave]) continue;
      const res = await Engine.query(queryUnicos(dim, header));
      sugerencias[clave] = res.rows.map(r => r[0]);
    }
  }

  async function analizar() {
    if (!window.__engineReady) {
      setStatus('Carga primero el parquet.', 'err');
      return;
    }
    // Refrescar sugerencias en cada análisis (el catálogo pudo cambiar)
    Object.keys(sugerencias).forEach(k => delete sugerencias[k]);
    container.innerHTML = '<div class="placeholder">Analizando NO MATCH por dimensión…</div>';

    for (const dim of NO_MATCH_DIMS) {
      setStatus(`Analizando ${dim.hoja}…`);
      try {
        await cargarSugerencias(dim);
        const res = await Engine.query(queryNoMatch(dim));
        const guia = await Engine.query(queryGuia(dim))
          .then(g => new Map(g.rows.map(r => [r[0], r[1]])))
          .catch(() => new Map());
        renderDimension(dim, res.rows, guia);
      } catch (e) {
        console.error(e);
        renderDimensionError(dim, e.message);
      }
    }
    setStatus('Análisis NO MATCH completado.');
  }

  function renderDimension(dim, rows, guia = new Map()) {
    const card = document.createElement('div');
    card.className = 'query-card nm-card';
    card.dataset.hoja = dim.hoja;

    const thead = ['Valor sin match', 'Registros', 'Guía', ...dim.extraHeaders];
    const headHtml = thead.map((h, i) =>
      `<th${i === 2 ? ' title="Información de referencia — NO se guarda"' : ''}>${esc(h)}</th>`).join('');

    const bodyHtml = rows.length
      ? rows.map((r, i) => `
        <tr>
          <td class="nm-key" title="${esc(r[0])}">${esc(r[0])}</td>
          <td>${esc(r[1])}</td>
          <td class="nm-guide" title="${esc(guia.get(r[0]) || '')}">${esc(guia.get(r[0]) || '—')}</td>
          ${dim.extraHeaders.map(h => `
            <td>
              <input class="nm-input" list="dl-${esc(dim.hoja)}-${esc(h)}"
                     data-field="${esc(h)}" data-row="${i}" placeholder="—">
            </td>`).join('')}
        </tr>`).join('')
      : '<tr><td colspan="99" class="placeholder">Sin valores sin match ✅</td></tr>';

    const datalists = dim.extraHeaders.map(h => `
      <datalist id="dl-${esc(dim.hoja)}-${esc(h)}">
        ${(sugerencias[`${dim.hoja}::${h}`] || []).map(v => `<option value="${esc(v)}">`).join('')}
      </datalist>`).join('');

    card.innerHTML = `
      <div class="query-head">
        <div class="query-label">
          <span>${esc(dim.hoja)}</span>
          <input value="${rows.length} valores sin match" disabled>
        </div>
        <div class="card-actions">
          <button class="nm-save primary">Guardar en Sheets</button>
        </div>
      </div>
      <div class="table-scroll">
        <table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
      </div>
      ${datalists}
    `;

    // Resaltar filas con datos (las que sí se guardarán)
    card.querySelector('.table-scroll').addEventListener('input', e => {
      const tr = e.target.closest('tr');
      if (tr) {
        const lleno = [...tr.querySelectorAll('.nm-input')].some(i => i.value.trim() !== '');
        tr.classList.toggle('nm-filled', lleno);
      }
    });

    card.querySelector('.nm-save').onclick = () => guardarDimension(card, dim);
    container.appendChild(card);
  }

  function renderDimensionError(dim, msg) {
    const card = document.createElement('div');
    card.className = 'query-card';
    card.innerHTML = `
      <div class="query-head"><div class="query-label"><span>${esc(dim.hoja)}</span></div></div>
      <div class="result-bar"><span class="msg err">Error: ${esc(msg)}</span></div>`;
    container.appendChild(card);
  }

  async function guardarDimension(card, dim) {
    const btn = card.querySelector('.nm-save');
    const filas = [];
    const trsEnviadas = [];
    let omitidasVacias = 0;

    card.querySelectorAll('tbody tr').forEach(tr => {
      const keyCell = tr.querySelector('.nm-key');
      if (!keyCell) return;

      const fila = { [dim.keyHeader]: keyCell.textContent.trim() };
      let tieneDatos = false;

      tr.querySelectorAll('.nm-input').forEach(inp => {
        const valor = inp.value.trim();
        fila[inp.dataset.field] = valor;
        if (valor) tieneDatos = true;
      });

      // Solo se guarda el registro que el usuario completó;
      // las filas sin ningún dato en las columnas extra se omiten.
      if (tieneDatos) { filas.push(fila); trsEnviadas.push(tr); }
      else omitidasVacias++;
    });

    if (!filas.length) {
      setStatus(`${dim.hoja}: no hay registros completados para guardar (${omitidasVacias} vacíos omitidos).`, 'err');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Guardando…';
    setStatus(`Guardando ${filas.length} filas en ${dim.hoja}…`, 'loading');

    try {
      const res = await fetch(SHEETS_CONFIG.GAS_ENDPOINT, {
        method: 'POST',
        // text/plain evita el preflight CORS (OPTIONS) que GAS no responde;
        // doPost lee e.postData.contents igual aunque el body sea JSON.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'agregarLote', hoja: dim.hoja, filas }),
      });
      const data = await res.json();
      setStatus(data.mensaje || (data.ok ? 'Guardado.' : 'Error'), data.ok ? 'ok' : 'err');

      if (data.ok) {
        // Quitar solo las filas enviadas; conservar el resto con sus datos
        trsEnviadas.forEach(tr => tr.remove());
        const restantes = card.querySelectorAll('tbody tr').length;
        const label = card.querySelector('.query-label input');
        if (label) label.value = `${restantes} valores sin match`;

        // Recargar cat_* de esa hoja desde Sheets (incluye lo recién agregado)
        // y refrescar los datalists de valores únicos — sin re-renderizar todo.
        try {
          const tabla = await cargarHojaSheets(dim.hoja);
          await Engine.loadSheetTable(dim.hoja, tabla);
          await refrescarSugerencias(card, dim);
        } catch (e) {
          console.warn('No se pudieron refrescar sugerencias:', e);
        }
      }
    } catch (e) {
      console.error(e);
      setStatus('Error de red: ' + e.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar en Sheets';
    }
  }

  /**
   * Regenera los <datalist> de una tarjeta con los valores únicos
   * actuales de la hoja en Sheets (post-insert).
   */
  async function refrescarSugerencias(card, dim) {
    for (const header of dim.extraHeaders) {
      const res = await Engine.query(queryUnicos(dim, header));
      const valores = res.rows.map(r => r[0]);
      sugerencias[`${dim.hoja}::${header}`] = valores;

      const dl = card.querySelector(`#dl-${dim.hoja}-${header}`);
      if (dl) {
        dl.innerHTML = valores.map(v => `<option value="${esc(v)}">`).join('');
      }
    }
  }

  return { analizar };
}
