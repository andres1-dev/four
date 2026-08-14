/**
 * Módulo Ingresos — Query bajo demanda vía Google Sheets Visualization API (gviz)
 *
 * REGLA CLARA:
 *   • El query a Sheets solo filtra por fechas (columna B = fecha_traslado).
 *   • El buscador de texto filtra en memoria sobre los datos ya cargados.
 *   • Cambiar fechas → nueva petición a Sheets.
 *   • Escribir en el buscador → solo re-renderiza, sin ir a Sheets.
 *
 * Columnas seleccionadas:
 *   A  id_ingreso       B  fecha_traslado    C  taller
 *   D  linea            H  lote              I  refprov
 *   J  descripcion      L  total             M  cantidad
 *   V  referencia       W  tipo              Z  prenda
 */

const ingresosModule = (() => {

    // ── Configuración ─────────────────────────────────────────────────────────
    const SPREADSHEET_ID = '1O67ydfwQCnW-J-xDwzkghTFUMX9KF4tqizKLCJrz9LM';
    const SHEET_NAME     = 'Ingresos';
    const SELECT_COLS    = 'A, B, C, D, H, I, J, L, M, V, W, Z';

    // Orden en que gviz devuelve las columnas del SELECT
    const COL_ORDER = [
        'id_ingreso', 'fecha_traslado', 'taller', 'linea', 'lote',
        'refprov', 'descripcion', 'total', 'cantidad',
        'referencia', 'tipo', 'prenda',
    ];

    // ── Estado ────────────────────────────────────────────────────────────────
    let allRows     = [];   // todos los resultados del último query por fechas
    let currentPage = 1;
    let pageSize    = 50;
    let initialized = false;
    let searchTimer = null;

    // ── Helpers ───────────────────────────────────────────────────────────────
    const fmtDate = d => {
        const y  = d.getFullYear();
        const m  = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dd}`;
    };

    const toDisplay = iso => {
        if (!iso || !iso.includes('-')) return iso || '-';
        const [y, m, d] = iso.split('-');
        return `${d}/${m}/${y}`;
    };

    const esc = str => String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const gvizDate = iso => `date '${iso}'`;

    // ── Construcción del query (SOLO fechas) ──────────────────────────────────
    function buildDateQuery() {
        const fromVal = document.getElementById('ingresos-date-from')?.value;
        const toVal   = document.getElementById('ingresos-date-to')?.value;

        let where = '';
        if (fromVal || toVal) {
            const parts = [];
            if (fromVal) parts.push(`B >= ${gvizDate(fromVal)}`);
            if (toVal)   parts.push(`B <= ${gvizDate(toVal)}`);
            where = `where ${parts.join(' and ')}`;
        }

        return `select ${SELECT_COLS} ${where} order by B desc limit 5000`;
    }

    // ── Fetch gviz ────────────────────────────────────────────────────────────
    async function fetchQuery(tq) {
        const params = new URLSearchParams({ tq, sheet: SHEET_NAME, tqx: 'out:json' });
        const url    = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?${params}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // gviz responde con JSONP — extraer el JSON interior
        const raw  = await res.text();
        const json = raw.replace(/^[^{]+/, '').replace(/\);?\s*$/, '');
        return JSON.parse(json);
    }

    // ── Parseo de respuesta gviz ──────────────────────────────────────────────
    function parseGviz(data) {
        if (data.status === 'error') {
            const msgs = (data.errors || []).map(e => e.detailed_message || e.message).join('; ');
            throw new Error(msgs || 'Error en la query de Sheets');
        }

        const table = data.table;
        if (!table || !table.rows) return [];

        return table.rows.map(row => {
            const obj = {};
            COL_ORDER.forEach((name, idx) => {
                const cell = row.c?.[idx];
                if (!cell || cell.v === null || cell.v === undefined) {
                    obj[name] = '';
                } else if (name === 'fecha_traslado' && typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
                    // gviz codifica fechas como "Date(año,mes0,día)"
                    const p = cell.v.replace('Date(', '').replace(')', '').split(',').map(Number);
                    obj[name] = fmtDate(new Date(p[0], p[1], p[2]));
                } else {
                    obj[name] = cell.v;
                }
            });
            return obj;
        });
    }

    // ── Cargar datos desde Sheets (solo al cambiar fechas) ────────────────────
    async function loadFromSheets() {
        setStatus('loading', 'Consultando...');
        setTableLoading(true);
        allRows = [];

        try {
            const tq   = buildDateQuery();
            const data = await fetchQuery(tq);
            allRows    = parseGviz(data);
            currentPage = 1;
            setStatus('ok', `${allRows.length.toLocaleString('es-CO')} registros`);
        } catch (e) {
            console.error('[Ingresos gviz]', e);
            setStatus('error', 'Error: ' + e.message);
        }

        renderTable();
    }

    // ── Filtrado en memoria por texto ─────────────────────────────────────────
    function getFiltered() {
        const q = (document.getElementById('ingresos-search')?.value || '').trim().toLowerCase();
        if (!q) return allRows;

        return allRows.filter(r => {
            return (
                String(r.id_ingreso   || '').toLowerCase().includes(q) ||
                String(r.taller       || '').toLowerCase().includes(q) ||
                String(r.lote         || '').toLowerCase().includes(q) ||
                String(r.refprov      || '').toLowerCase().includes(q) ||
                String(r.descripcion  || '').toLowerCase().includes(q) ||
                String(r.referencia   || '').toLowerCase().includes(q) ||
                String(r.tipo         || '').toLowerCase().includes(q) ||
                String(r.prenda       || '').toLowerCase().includes(q)
            );
        });
    }

    // ── Inicialización ────────────────────────────────────────────────────────
    function init() {
        if (initialized) return;
        initialized = true;
        setPreset('today', document.getElementById('ichip-today'));
    }

    // ── Presets de fecha → disparan loadFromSheets ────────────────────────────
    function setPreset(preset, btnEl) {
        document.querySelectorAll('.ingresos-chip').forEach(c => c.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');

        const now  = new Date();
        const from = document.getElementById('ingresos-date-from');
        const to   = document.getElementById('ingresos-date-to');
        if (!from || !to) return;

        switch (preset) {
            case 'today':
                from.value = to.value = fmtDate(now);
                break;
            case 'week': {
                const f = new Date(now);
                f.setDate(now.getDate() - (now.getDay() || 7) + 1);
                from.value = fmtDate(f);
                to.value   = fmtDate(now);
                break;
            }
            case 'month':
                from.value = fmtDate(new Date(now.getFullYear(), now.getMonth(), 1));
                to.value   = fmtDate(now);
                break;
            case 'last': {
                const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const l = new Date(now.getFullYear(), now.getMonth(), 0);
                from.value = fmtDate(f);
                to.value   = fmtDate(l);
                break;
            }
            case 'all':
            default:
                from.value = '';
                to.value   = '';
                break;
        }

        // Limpiar buscador al cambiar preset para no confundir
        const search = document.getElementById('ingresos-search');
        if (search) search.value = '';

        currentPage = 1;
        loadFromSheets();
    }

    // Al cambiar los pickers manualmente también va a Sheets
    function onDateChange() {
        document.querySelectorAll('.ingresos-chip').forEach(c => c.classList.remove('active'));
        const search = document.getElementById('ingresos-search');
        if (search) search.value = '';
        currentPage = 1;
        loadFromSheets();
    }

    // El buscador filtra solo en memoria — sin ir a Sheets
    function onSearch() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            currentPage = 1;
            renderTable();
        }, 200);
    }

    // ── Tarjetas (sobre los datos filtrados visibles) ─────────────────────────
    function updateCards(filtered) {
        const totalReg  = filtered.length;
        const totalUnd  = filtered.reduce((s, r) => s + (Number(r.total) || Number(r.cantidad) || 0), 0);
        const angeles   = filtered
            .filter(r => String(r.linea || '').toUpperCase() === 'ANGELES')
            .reduce((s, r) => s + (Number(r.total) || Number(r.cantidad) || 0), 0);
        const universo  = totalUnd - angeles;

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val.toLocaleString('es-CO');
        };
        set('icard-val-registros', totalReg);
        set('icard-val-cantidad',  totalUnd);
        set('icard-val-angeles',   angeles);
        set('icard-val-universo',  universo);
    }

    // ── Render ────────────────────────────────────────────────────────────────
    function setTableLoading(on) {
        const tbody = document.getElementById('ingresos-tbody');
        if (tbody && on) {
            tbody.innerHTML = `<tr><td colspan="11" class="ingresos-empty">
                <span class="loading-spinner" style="vertical-align:middle;margin-right:8px;"></span>
                Consultando Google Sheets...
            </td></tr>`;
        }
    }

    function renderTable() {
        const tbody   = document.getElementById('ingresos-tbody');
        const badge   = document.getElementById('ingresos-badge');
        const btnPrev = document.getElementById('ingresos-btn-prev');
        const btnNext = document.getElementById('ingresos-btn-next');
        const pgInfo  = document.getElementById('ingresos-pg-info');
        if (!tbody) return;

        const filtered = getFiltered();
        const total    = filtered.length;

        updateCards(filtered);
        if (badge) badge.textContent = total.toLocaleString('es-CO');

        if (total === 0) {
            tbody.innerHTML = `<tr><td colspan="11" class="ingresos-empty">No se encontraron registros.</td></tr>`;
            if (pgInfo)   pgInfo.textContent = 'Pág 0 de 0';
            if (btnPrev)  btnPrev.disabled = true;
            if (btnNext)  btnNext.disabled = true;
            return;
        }

        const totalPages = Math.ceil(total / pageSize) || 1;
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1)          currentPage = 1;

        const start = (currentPage - 1) * pageSize;
        const slice = filtered.slice(start, start + pageSize);

        let html = '';
        slice.forEach(r => {
            const qty  = Number(r.total) || Number(r.cantidad) || 0;
            const lote = (r.lote !== '' && r.lote != null) ? r.lote : '-';

            html += `<tr>
                <td><strong>${esc(r.id_ingreso || '-')}</strong></td>
                <td>${esc(toDisplay(r.fecha_traslado))}</td>
                <td>${esc(r.taller       || '-')}</td>
                <td>${esc(r.linea        || '-')}</td>
                <td>${esc(String(lote))}</td>
                <td>${esc(r.refprov      || '-')}</td>
                <td>${esc(r.descripcion  || '-')}</td>
                <td><strong>${qty.toLocaleString('es-CO')}</strong></td>
                <td>${esc(r.referencia   || '-')}</td>
                <td>${esc(r.tipo         || '-')}</td>
                <td>${esc(r.prenda       || '-')}</td>
            </tr>`;
        });

        tbody.innerHTML = html;
        if (pgInfo)  pgInfo.textContent = `Pág ${currentPage} de ${totalPages}`;
        if (btnPrev) btnPrev.disabled   = currentPage <= 1;
        if (btnNext) btnNext.disabled   = currentPage >= totalPages;
    }

    // ── Controles ─────────────────────────────────────────────────────────────
    function changePage(delta) {
        currentPage += delta;
        renderTable();
    }

    function changePageSize(val) {
        pageSize    = parseInt(val, 10) || 50;
        currentPage = 1;
        renderTable();
    }

    function reload() {
        const search = document.getElementById('ingresos-search');
        if (search) search.value = '';
        loadFromSheets();
    }

    // ── Indicador de estado ───────────────────────────────────────────────────
    function setStatus(type, msg) {
        const dot  = document.getElementById('ingresos-dot-status');
        const text = document.getElementById('ingresos-status-text');
        if (dot) {
            dot.className = 'ingresos-status-dot';
            if (type === 'ok')      dot.classList.add('dot-ok');
            if (type === 'loading') dot.classList.add('dot-loading');
            if (type === 'error')   dot.classList.add('dot-error');
        }
        if (text) text.textContent = msg;
    }

    // ── API pública ───────────────────────────────────────────────────────────
    return { init, reload, setPreset, onDateChange, onSearch, changePage, changePageSize };

})();

// ── Activar al abrir el tab ───────────────────────────────────────────────────
(function hookIngresoTab() {
    document.addEventListener('click', e => {
        if (e.target.closest('[data-tab="ingresos-module"]')) {
            setTimeout(() => ingresosModule.init(), 60);
        }
    });
})();
