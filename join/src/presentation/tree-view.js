/* ════════════════════════════════════════════════════════════════════════════
   PRESENTATION — Árbol interactivo de ventas (estilo Power BI)

   Estrategia de rendimiento:
   1. Al construir, se materializa la tabla `arbol` en DuckDB:
      una sola pasada con JOINs a cat_* + GROUP BY de todos los
      niveles + SUM(TOTAL_VTA_2026) / SUM(TOTAL_DES_2026).
   2. Cada expansión del árbol consulta `arbol` filtrando por la
      ruta del nodo → respuesta instantánea (tabla ya agregada).
   3. Los totales de cada nodo son SUM de sus descendientes —
      se consolidan solos por el GROUP BY.
   ════════════════════════════════════════════════════════════════════════════ */
import { Engine } from '../infrastructure/duckdb-engine.js';
import { TREE_LEVELS, TREE_ROOT } from '../config/tree-levels.js';
import { esc } from '../domain/formatters.js';

const SIN_DATO = '(sin dato)';

// Query que construye la tabla agregada `arbol` (una sola pasada pesada)
const SQL_AGG = `
CREATE OR REPLACE TABLE arbol AS
SELECT
  CASE CAST(a.id_cia AS VARCHAR)
    WHEN '1' THEN 'Templo'
    WHEN '2' THEN 'Shopping'
    ELSE CAST(a.id_cia AS VARCHAR)
  END AS empresa,
  NULLIF(TRIM(CAST(tp.tipo AS VARCHAR)), '') AS tipo,
  NULLIF(TRIM(CAST(gs.GENERO AS VARCHAR)), '') AS genero,
  NULLIF(TRIM(CAST(gs.PRENDA AS VARCHAR)), '') AS prenda,
  NULLIF(TRIM(CAST(t."Tallaje" AS VARCHAR)), '') AS tallaje,
  NULLIF(TRIM(CAST(a.color AS VARCHAR)), '') AS color,
  SUM(COALESCE(a.TOTAL_VTA_2026, 0)) AS vta,
  SUM(COALESCE(a.TOTAL_DES_2026, 0)) AS des
FROM datos a
LEFT JOIN cat_GRUPO_SUBGRUPO gs
  ON UPPER(TRIM(CAST(a.f120_referencia AS VARCHAR))) =
     UPPER(TRIM(CAST(gs.f120_referencia AS VARCHAR)))
LEFT JOIN cat_TIPOS tp
  ON UPPER(TRIM(CAST(gs.PRENDA AS VARCHAR))) =
     UPPER(TRIM(CAST(tp.PRENDA AS VARCHAR)))
LEFT JOIN cat_TALLAS t
  ON UPPER(TRIM(CAST(a.talla AS VARCHAR))) =
     UPPER(TRIM(CAST(t.talla AS VARCHAR)))
GROUP BY 1,2,3,4,5,6
`;

/**
 * Inicializa el panel del árbol.
 * @param {HTMLElement} container
 * @param {(msg:string,type?:string)=>void} setStatus
 * @returns {{ construir: Function }}
 */
export function initTreeView(container, setStatus) {
  let listo = false;
  let totalVta = 0; // base del % de participación (total del grupo)

  async function construir() {
    if (!window.__engineReady) {
      setStatus('Carga primero el parquet.', 'err');
      return;
    }
    container.innerHTML = '<div class="placeholder">Construyendo tabla agregada (una sola pasada)…</div>';
    setStatus('Agregando ventas por nivel (puede tardar)…', 'loading');

    try {
      await Engine.query(SQL_AGG);
      listo = true;
      await renderRaiz(container);
      setStatus('Árbol listo — expande los nodos para profundizar.');
    } catch (e) {
      console.error(e);
      container.innerHTML = `<div class="placeholder">Error construyendo el árbol: ${esc(e.message)}</div>`;
      setStatus('Error en el árbol: ' + e.message, 'err');
    }
  }

  /**
   * Nodo raíz fijo: el grupo empresarial (TREE_ROOT.label).
   * Muestra el total consolidado de TODA la tabla `arbol`.
   */
  async function renderRaiz(container) {
    const tot = await Engine.query('SELECT SUM(vta) AS vta, SUM(des) AS des FROM arbol');
    const vta = parseFloat(tot.rows[0]?.[0]) || 0;
    const des = parseFloat(tot.rows[0]?.[1]) || 0;
    totalVta = vta || 1;

    const wrap = document.createElement('div');
    wrap.className = 'tnode';

    const rowEl = document.createElement('div');
    rowEl.className = 'trow';
    rowEl.innerHTML = `
      <span class="tcaret">▸</span>
      <span class="tname" style="font-weight:700">${esc(TREE_ROOT.label)}</span>
      <span class="tpct">100%</span>
    `;
    rowEl.title = `${fmtNum(vta)} und · ${fmtNum(des)} despacho · 100% del total`;

    const hijos = document.createElement('div');
    hijos.className = 'tchildren';
    hijos.style.display = 'none';

    rowEl.addEventListener('click', async () => {
      const abierto = hijos.style.display !== 'none';
      if (abierto) {
        hijos.style.display = 'none';
        rowEl.querySelector('.tcaret').textContent = '▸';
        return;
      }
      rowEl.querySelector('.tcaret').textContent = '▾';
      hijos.style.display = 'block';
      if (!hijos.dataset.cargado) {
        hijos.dataset.cargado = '1';
        await renderNivel(hijos, 0, []);
      }
    });

    wrap.appendChild(rowEl);
    wrap.appendChild(hijos);
    container.appendChild(wrap);
  }

  /**
   * Renderiza los hijos de un nivel dentro de `parentEl`.
   * @param {HTMLElement} parentEl
   * @param {number} levelIdx - índice en TREE_LEVELS
   * @param {{col:string,val:string}[]} filtros - ruta acumulada
   */
  async function renderNivel(parentEl, levelIdx, filtros) {
    const nivel = TREE_LEVELS[levelIdx];
    const esHoja = levelIdx === TREE_LEVELS.length - 1;

    const conds = filtros.map(f =>
      f.val === null
        ? `${f.col} IS NULL`
        : `${f.col} = '${String(f.val).replace(/'/g, "''")}'`
    );
    const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

    const sql = `
      SELECT COALESCE(${nivel.col}, '${SIN_DATO}') AS nodo,
             SUM(vta) AS vta, SUM(des) AS des
      FROM arbol
      ${where}
      GROUP BY 1
      ORDER BY vta DESC
      LIMIT 200
    `;

    const res = await Engine.query(sql);

    const frag = document.createDocumentFragment();
    res.rows.forEach(r => {
      frag.appendChild(crearNodo(r, levelIdx, filtros, esHoja));
    });
    if (!res.rows.length) {
      frag.appendChild(Object.assign(document.createElement('div'), {
        className: 'placeholder', textContent: 'Sin datos en esta rama.',
      }));
    }
    parentEl.appendChild(frag);
  }

  function crearNodo(row, levelIdx, filtros, esHoja) {
    const [nombre, vtaStr, desStr] = row;
    const nivel = TREE_LEVELS[levelIdx];
    const vta = parseFloat(vtaStr) || 0;
    const des = parseFloat(desStr) || 0;
    const pct = totalVta ? (vta / totalVta) * 100 : 0;
    const pctTxt = pct >= 10 ? pct.toFixed(1) + '%' : pct.toFixed(2) + '%';

    const wrap = document.createElement('div');
    wrap.className = 'tnode';

    const rowEl = document.createElement('div');
    rowEl.className = 'trow' + (esHoja ? ' leaf' : '');
    rowEl.title = `${fmtNum(vta)} und · ${fmtNum(des)} despacho · ${pctTxt} del total`;
    rowEl.innerHTML = `
      <span class="tcaret">${esHoja ? '·' : '▸'}</span>
      <span class="tname" title="${esc(nombre)}">${esc(nombre)}</span>
      <span class="tunits">${fmtNum(vta)}</span>
      <span class="tpct">${pctTxt}</span>
    `;

    if (!esHoja) {
      const hijos = document.createElement('div');
      hijos.className = 'tchildren';
      hijos.style.display = 'none';

      rowEl.addEventListener('click', async () => {
        const abierto = hijos.style.display !== 'none';
        if (abierto) {
          hijos.style.display = 'none';
          rowEl.querySelector('.tcaret').textContent = '▸';
          return;
        }
        rowEl.querySelector('.tcaret').textContent = '▾';
        hijos.style.display = 'block';
        if (!hijos.dataset.cargado) {
          hijos.dataset.cargado = '1';
          const nuevosFiltros = [...filtros, {
            col: nivel.col,
            val: nombre === SIN_DATO ? null : nombre,
          }];
          await renderNivel(hijos, levelIdx + 1, nuevosFiltros);
        }
      });
      wrap.appendChild(rowEl);
      wrap.appendChild(hijos);
    } else {
      wrap.appendChild(rowEl);
    }
    return wrap;
  }

  return { construir };
}

function fmtNum(n) {
  return Math.round(n).toLocaleString('es-CO');
}
