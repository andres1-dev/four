/**
 * supabase_data.js — Reemplaza google_sheets.js
 * Lee ingresos y presupuesto desde Supabase en vez de Google Sheets.
 * Toda la lógica de cálculo (metrics.js, trends_logic.js, etc.) se mantiene
 * igual — solo cambia esta capa de fetch.
 */

const SUPABASE_URL = 'https://iladaofarozipitwaeti.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsYWRhb2Zhcm96aXBpdHdhZXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjYzMDksImV4cCI6MjA5MzA0MjMwOX0.4fyiibeZS10DCgov62d7tIFVzJHsklsBrbokAJ9ptK8';

// ─── Obtener token de sesión si está autenticado ──────────────────────────────
function getAuthToken() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                const sessionData = JSON.parse(localStorage.getItem(key));
                if (sessionData?.access_token) return sessionData.access_token;
            }
        }
    } catch (e) { }
    return SUPABASE_ANON;
}

// ─── Helper de fetch a Supabase REST (con paginación por cabecera Range) ─────
async function sbFetch(path, params = '') {
    const PAGE_SIZE = 1000;
    let allRows = [];
    let offset = 0;
    const token = getAuthToken();

    while (true) {
        const queryStr = params ? (params.startsWith('select=') ? params : `select=*&${params}`) : 'select=*';
        const url = `${SUPABASE_URL}/rest/v1/${path}?${queryStr}`;

        try {
            const res = await fetch(url, {
                headers: {
                    'apikey': SUPABASE_ANON,
                    'Authorization': `Bearer ${token}`,
                    'Range': `${offset}-${offset + PAGE_SIZE - 1}`,
                    'Range-Unit': 'items'
                }
            });
            if (!res.ok) {
                console.error(`sbFetch HTTP ${res.status} para ${path}:`, await res.text());
                break;
            }

            const rows = await res.json();
            if (!Array.isArray(rows)) {
                console.error(`sbFetch respuesta no es array para ${path}:`, rows);
                break;
            }
            allRows = allRows.concat(rows);
            console.log(`sbFetch ${path}: lote de ${rows.length} filas (total acumulado: ${allRows.length})`);

            if (rows.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        } catch (err) {
            console.error(`sbFetch error de red para ${path}:`, err);
            break;
        }
    }

    return allRows;
}


let _incomeCache = null;
let _budgetCache = null;
let _isHistoricalLoading = false;

// ─── getAllIncomeData ─────────────────────────────────────────────────────────
// Reemplaza el getAllIncomeData() de google_sheets.js.
// Devuelve el mismo formato: [{ FECHA, CANTIDAD, ANO, PROVEEDOR }, ...]
async function getAllIncomeData() {
    if (_incomeCache && Array.isArray(_incomeCache) && _incomeCache.length > 0) {
        return _incomeCache;
    }

    // Intentar usar datos precargados (caché de 5 min en sessionStorage si no está vacío)
    const preload = getPreloadedData();
    if (preload?.income && Array.isArray(preload.income) && preload.income.length > 0) {
        console.log(`✓ Usando ${preload.income.length} datos de ingresos precargados`);
        _incomeCache = preload.income;
        return _incomeCache;
    }

    const currentYear = new Date().getFullYear();
    console.log(`🚀 Carga Rápida (Etapa 1): Obteniendo ingresos de ${currentYear}...`);

    // Etapa 1: Petición rápida para el año actual
    const currentYearRows = await sbFetch('ingresos', `fecha_traslado=gte.${currentYear}-01-01`);
    console.log(`Etapa 1: ${currentYearRows.length} registros del año ${currentYear} obtenidos`);

    let initialRows = currentYearRows;
    if (initialRows.length === 0) {
        console.log('Obteniendo todos los registros de ingresos...');
        initialRows = await sbFetch('ingresos', 'select=*');
    }

    const data = mapAndCleanIncomeRows(initialRows);
    _incomeCache = data;

    // Etapa 2: Lanzar en segundo plano la carga del histórico anterior
    if (!_isHistoricalLoading && initialRows.length === currentYearRows.length) {
        setTimeout(() => loadHistoricalIncomeData(currentYear), 50);
    }

    console.log(`getAllIncomeData (Etapa 1) procesó ${data.length} registros del año ${currentYear}`);
    return _incomeCache;
}

function mapAndCleanIncomeRows(rows) {
    return rows.map(r => {
        const rawFecha = r.fecha_traslado || r.created_at || r.fecha_ingreso || '';
        const fechaStr = typeof rawFecha === 'string' ? rawFecha.substring(0, 10) : '';
        const productora = String(r.productora || '');
        return {
            FECHA: fechaStr,   // YYYY-MM-DD
            CANTIDAD: Number(r.total) || 0,
            ANO: fechaStr ? fechaStr.substring(0, 4) : '',
            PROVEEDOR: productora === '900692469' ? 'ANGELES' : 'UNIVERSO'
        };
    }).filter(r => r.CANTIDAD > 0 && r.FECHA)
        .sort((a, b) => a.FECHA.localeCompare(b.FECHA));
}

async function loadHistoricalIncomeData(currentYear) {
    if (_isHistoricalLoading) return;
    _isHistoricalLoading = true;

    try {
        console.log(`⏳ Carga en segundo plano (Etapa 2): Obteniendo datos históricos anteriores a ${currentYear}...`);
        const historicalRows = await sbFetch('ingresos', `fecha_traslado=lt.${currentYear}-01-01`);
        console.log(`Etapa 2: ${historicalRows.length} registros históricos recuperados`);

        if (historicalRows.length > 0) {
            const historicalData = mapAndCleanIncomeRows(historicalRows);

            // Fusionar sin duplicados
            const mapKeys = new Set(_incomeCache.map(i => `${i.FECHA}_${i.CANTIDAD}_${i.PROVEEDOR}`));
            const newEntries = historicalData.filter(i => !mapKeys.has(`${i.FECHA}_${i.CANTIDAD}_${i.PROVEEDOR}`));

            _incomeCache = [..._incomeCache, ...newEntries].sort((a, b) => a.FECHA.localeCompare(b.FECHA));

            // Guardar en sessionStorage
            try {
                const currentPreload = getPreloadedData() || {};
                currentPreload.income = _incomeCache;
                currentPreload.timestamp = Date.now();
                sessionStorage.setItem('tdm_preload_data_v3', JSON.stringify(currentPreload));
            } catch (e) { }

            console.log(`✓ Histórico cargado en segundo plano: ${_incomeCache.length} ingresos totales`);

            // Reconsolidar silenciosamente en segundo plano
            if (typeof window.reconsolidateWithFilter === 'function') {
                if (typeof allIncomeData !== 'undefined') allIncomeData = _incomeCache;
                window.reconsolidateWithFilter();
                if (typeof cargarDatosDia === 'function') cargarDatosDia();
                if (typeof cargarDatosMes === 'function') cargarDatosMes();
                if (typeof cargarDatosAño === 'function') cargarDatosAño();
                if (typeof cargarDatosTendencia === 'function') cargarDatosTendencia();
            }
        }
    } catch (err) {
        console.warn('Error en carga de datos históricos:', err);
    } finally {
        _isHistoricalLoading = false;
    }
}

function _mapPresupuestoRows(rows) {
    return rows.map(r => ({
        MES: String(r.mes || '').toUpperCase(),
        ANO: String(r.ano || ''),
        TOTAL: Number(r.total) || 0,
        HABILES: Number(r.habiles) || 0,
        LINEAS: {
            ANGELES: Number(r.angeles) || 0,
            BASICO: Number(r.basico) || 0,
            DEPORTIVO: Number(r.deportivo) || 0,
            MODAFRESCA: Number(r.modafresca) || 0,
            URBANO: Number(r.urbano) || 0,
            BOGOTA: Number(r.bogota) || 0,
            INTIMA: Number(r.intima) || 0,
            ESPECIALES: Number(r.especiales) || 0,
            PRONTAMODA: Number(r.prontamoda) || 0,
            DENIM: Number(r.denim) || 0,
        }
    }));
}

// ─── getBudgetData ────────────────────────────────────────────────────────────
// Reemplaza getBudgetData() de google_sheets.js.
// Devuelve el mismo formato: [{ MES, ANO, TOTAL, HABILES, LINEAS:{...} }, ...]
async function getBudgetData() {
    if (_budgetCache && Array.isArray(_budgetCache) && _budgetCache.length > 0) {
        return _budgetCache;
    }

    // Intentar usar datos precargados
    const preload = getPreloadedData();
    if (preload?.budget && Array.isArray(preload.budget) && preload.budget.length > 0) {
        console.log(`✓ Usando ${preload.budget.length} datos de presupuesto precargados`);
        _budgetCache = preload.budget;
        return _budgetCache;
    }

    console.log('Fetching presupuesto desde Supabase...');
    try {
        const token = getAuthToken();
        let res = await fetch(`${SUPABASE_URL}/rest/v1/presupuesto?select=*`, {
            headers: {
                'apikey': SUPABASE_ANON,
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            res = await fetch(`${SUPABASE_URL}/rest/v1/presupuesto?select=*`, {
                headers: {
                    'apikey': SUPABASE_ANON,
                    'Authorization': `Bearer ${SUPABASE_ANON}`
                }
            });
        }

        if (res.ok) {
            const rows = await res.json();
            if (Array.isArray(rows)) {
                console.log(`✓ Presupuesto recuperado desde Supabase: ${rows.length} filas`);
                _budgetCache = _mapPresupuestoRows(rows);
                return _budgetCache;
            }
        } else {
            console.error(`Error HTTP ${res.status} al consultar presupuesto:`, await res.text());
        }
    } catch (e) {
        console.error('Error al consultar presupuesto desde Supabase:', e);
    }

    return [];
}

// ─── datosCargarEndpoint ──────────────────────────────────────────────────────
// Reemplaza datosCargarEndpoint() de google_sheets.js.
// Carga registros completos con los 20 campos para la pestaña "Base de Datos" y descargas (CSV/Excel).
async function datosCargarEndpoint() {
    if (datosCargando) return true;
    datosCargando = true;

    try {
        console.log('⏳ Cargando base de datos completa en segundo plano para descargas (CSV/Excel)...');
        const rows = await sbFetch('ingresos', 'select=*');
        console.log(`✓ Base de datos completa cargada: ${rows.length} registros raw con todos los campos`);

        datosRegistros = rows.map(r => {
            const rawFecha = r.fecha_traslado || r.created_at || r.fecha_ingreso || '';
            const fechaStr = typeof rawFecha === 'string' ? rawFecha.substring(0, 10) : '';
            return {
                DOCUMENTO: String(r.id_ingreso || r.documento || r.id || ''),
                FECHA: fechaStr,
                TALLER: r.taller || '',
                LINEA: r.linea || '',
                AUDITOR: r.auditor || '',
                ESCANER: r.escaner || '',
                LOTE: Number(r.lote) || 0,
                REFPROV: String(r.refprov || ''),
                DESCRIPCION: r.descripcion || '',
                CANTIDAD: Number(r.total) || 0,
                REFERENCIA: r.referencia || '',
                TIPO: r.tipo || '',
                PVP: r.pvp || '',
                PRENDA: r.prenda || '',
                GENERO: r.genero || '',
                GESTOR: r.gestor || '',
                PROVEEDOR: r.proveedor || '',
                CLASE: r.clase || '',
                FUENTE: r.fuente || 'SISPRO',
                ANO: fechaStr ? Number(fechaStr.substring(0, 4)) : 2026
            };
        });

        const counter = document.getElementById('datos-contador');
        if (counter) counter.textContent = `${datosRegistros.length} registros`;
        return true;
    } catch (error) {
        console.error('Error al cargar base de datos completa:', error);
        return false;
    } finally {
        datosCargando = false;
    }
}

// ─── Helper para obtener datos precargados (idéntico al original) ─────────────
function getPreloadedData() {
    try {
        const preloadStr = sessionStorage.getItem('tdm_preload_data_v3');
        if (!preloadStr) return null;
        const preload = JSON.parse(preloadStr);
        const age = Date.now() - (preload.timestamp || 0);
        if (age > 5 * 60 * 1000) {
            sessionStorage.removeItem('tdm_preload_data_v3');
            return null;
        }
        return preload;
    } catch (e) {
        console.warn('Error leyendo datos precargados:', e);
        return null;
    }
}
