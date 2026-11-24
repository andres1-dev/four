// ============================================================
// on-demand-service.js
//
// Cliente JS para la Edge Function `on-demand-query`.
// COMPLETAMENTE INDEPENDIENTE del código existente.
//
// No modifica ni reemplaza ninguna función actual.
// No toca coloresMap, preciosMap, historicasMap, barrasMap globales.
// Solo devuelve Maps nuevos que el llamador decide si usa.
//
// CÓMO USAR (desde consola o desde el código nuevo):
//   const svc = window.OnDemandService;
//   const colores = await svc.getColores(['001','002'], '900616124');
//   console.log(colores.get('001')); // → "ROJO"
//
// URL de la EF:
//   https://ymaojqjdnrpfkrtuezcw.supabase.co/functions/v1/on-demand-query
// ============================================================

const OnDemandService = (() => {

    // URL de la EF nueva — independiente de api-gateway
    const EF_URL = 'https://ymaojqjdnrpfkrtuezcw.supabase.co/functions/v1/on-demand-query';

    // ── Token del usuario (sesión activa) ─────────────────────
    function _getToken() {
        // Intentar leer del sessionStorage (mismo mecanismo que usa el resto de la app)
        const t = sessionStorage.getItem('supabase_token');
        if (t) return t;
        // Fallback: leer del cliente global si está disponible
        if (window.supabase && window.supabase.accessToken) return window.supabase.accessToken;
        // Último recurso: anon key (solo para pruebas, no pasa autenticación)
        if (typeof SUPABASE_ANON_KEY !== 'undefined') return SUPABASE_ANON_KEY;
        throw new Error('No hay token de sesión disponible. Inicia sesión primero.');
    }

    // ── Llamada genérica a la EF ──────────────────────────────
    async function _call(action, payload) {
        const token = _getToken();

        const res = await fetch(EF_URL, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : ''),
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action, payload })
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(`[on-demand-query] HTTP ${res.status}: ${body.error || res.statusText}`);
        }

        const json = await res.json();
        if (json.error) throw new Error(`[on-demand-query] ${json.error}`);
        return json.data ?? [];
    }

    // ── API pública ───────────────────────────────────────────

    /**
     * Carga SOLO los colores cuyos id_color están en `ids`.
     * @param {string[]} ids         — códigos de color del archivo
     * @param {string}   [productora] — NIT del proveedor (opcional)
     * @returns {Promise<Map<string,string>>}  id_color → nombre_color
     */
    async function getColores(ids = [], productora = '') {
        if (!ids.length) return new Map();
        const t0 = performance.now();
        const rows = await _call('get_colores_by_ids', { ids, productora });
        const map = new Map();
        (rows || []).forEach(r => { if (r.id_color) map.set(String(r.id_color).trim(), r.nombre_color || ''); });
        console.info(`[OnDemandService] getColores: pedidos=${ids.length} devueltos=${map.size} en ${(performance.now()-t0).toFixed(0)}ms`);
        return map;
    }

    /**
     * Carga SOLO los precios cuyas referencias están en `refs`.
     * @param {string[]} refs — referencias del archivo
     * @returns {Promise<Map<string,string>>}  referencia → pvp (como string)
     */
    async function getPrecios(refs = []) {
        if (!refs.length) return new Map();
        const t0 = performance.now();
        const rows = await _call('get_precios_by_refs', { refs });
        const map = new Map();
        (rows || []).forEach(r => { if (r.referencia) map.set(String(r.referencia).trim(), String(r.pvp ?? '')); });
        console.info(`[OnDemandService] getPrecios: pedidos=${refs.length} devueltos=${map.size} en ${(performance.now()-t0).toFixed(0)}ms`);
        return map;
    }

    /**
     * Carga SOLO las historicas cuyas refprovs están en `refprovs`.
     * @param {string[]} refprovs    — refprovs del archivo
     * @param {string}   [productora] — NIT del proveedor (opcional)
     * @returns {Promise<Map<string,string>>}  refprov → referencia
     */
    async function getHistoricas(refprovs = [], productora = '') {
        if (!refprovs.length) return new Map();
        const t0 = performance.now();
        const rows = await _call('get_historicas_by_refprovs', { refprovs, productora });
        const map = new Map();
        (rows || []).forEach(r => { if (r.refprov && r.referencia) map.set(String(r.refprov).trim(), String(r.referencia).trim()); });
        console.info(`[OnDemandService] getHistoricas: pedidos=${refprovs.length} devueltos=${map.size} en ${(performance.now()-t0).toFixed(0)}ms`);
        return map;
    }

    /**
     * Carga SOLO las barras cuyas refprovs están en `refprovs`.
     * @param {string[]} refprovs — referencias de proveedor del archivo
     * @returns {Promise<Map<string,string>>}  "refprov|talla|id_color" → barra
     */
    async function getBarras(refprovs = []) {
        if (!refprovs.length) return new Map();
        const t0 = performance.now();
        const rows = await _call('get_barras_by_refprovs', { refprovs });
        const map = new Map();
        (rows || []).forEach(r => {
            const key = `${r.refprov}|${r.talla}|${r.id_color}`;
            map.set(key, r.barra || '');
        });
        console.info(`[OnDemandService] getBarras: pedidos=${refprovs.length} devueltos=${map.size} en ${(performance.now()-t0).toFixed(0)}ms`);
        return map;
    }

    /**
     * Carga las 4 tablas globales filtrando solo por los IDs del Excel.
     * @param {object} ids
     * @param {string[]} ids.taller_ids
     * @param {string[]} ids.linea_ids
     * @param {string[]} ids.auditor_ids
     * @param {string[]} ids.usuario_ids
     * @returns {Promise<{talleres:Map, lineas:Map, auditores:Map, usuarios:Map}>}
     */
    async function getGlobalMaps({ taller_ids = [], linea_ids = [], auditor_ids = [], usuario_ids = [] } = {}) {
        const res = await _call('get_global_maps_by_ids', { taller_ids, linea_ids, auditor_ids, usuario_ids });

        const talleres  = new Map((res.talleres  || []).map(r => [String(r.id_taller),   r.taller]));
        const lineas    = new Map((res.lineas    || []).map(r => [String(r.id_linea),    r.linea]));
        const auditores = new Map((res.auditores || []).map(r => [String(r.id_auditor),  r.auditor]));
        const usuarios  = new Map((res.usuarios  || []).map(r => [String(r.id_usuario),  r.usuario]));

        return { talleres, lineas, auditores, usuarios };
    }

    // ── Exponer ───────────────────────────────────────────────
    return { getColores, getPrecios, getHistoricas, getBarras, getGlobalMaps };

})();

// Disponible globalmente para pruebas desde consola y para el código nuevo
window.OnDemandService = OnDemandService;
