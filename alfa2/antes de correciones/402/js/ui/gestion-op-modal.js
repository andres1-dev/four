/**
 * js/ui/gestion-op-modal.js
 * Módulo para consultar y eliminar registros en 'ingresos' y 'distribuciones' por OP / ID exacto.
 * Trata IDs como '6264' y '6264.2' como registros totalmente distintos e independientes.
 */

async function showGestionOpModal(opInicial = '') {
    abrirModalFormGestionOp(opInicial);
}

function renderGestionOpUI(container, opInicial = '') {
    if (!container) container = document.getElementById('adminTabEntryPoint');
    if (!container) return;

    container.innerHTML = `
        <div class="section-content" style="max-width: 900px; margin: 0 auto; padding: 15px;">
            <div style="margin-bottom: 20px; background: var(--bg-dark); padding: 16px; border-radius: 6px; border: 1px solid var(--border);">
                <h4 style="margin: 0 0 8px 0; font-size: 14px; color: var(--text); display: flex; align-items: center; gap: 8px;">
                    <i class="codicon codicon-search" style="color: var(--primary);"></i>
                    Consultar OP / Documento en Ingresos y Distribuciones
                </h4>
                <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 12px 0;">
                    Ingresa el ID exacto de la OP o Documento (ejemplo: <code>6264</code> o <code>6264.2</code>). Los sufijos como <code>.2</code> se tratan como registros independientes.
                </p>
                <div style="display: flex; gap: 10px;">
                    <div style="position: relative; flex: 1;">
                        <input type="text" id="gestionOpSearchInput" class="form-control" 
                               placeholder="Escribe el ID exacto (ej: 6264 o 6264.2)..." 
                               value="${opInicial}"
                               style="width: 100%; padding-left: 12px;"
                               onkeydown="if(event.key==='Enter') ejecutarBusquedaGestionOp()">
                    </div>
                    <button class="btn-primary" onclick="ejecutarBusquedaGestionOp()">
                        <i class="codicon codicon-search"></i> Buscar OP
                    </button>
                </div>
            </div>

            <!-- Loader -->
            <div id="gestionOpLoading" style="display: none; text-align: center; padding: 30px; color: var(--text-muted);">
                <i class="codicon codicon-loading codicon-modifier-spin" style="font-size: 24px; color: var(--primary);"></i>
                <p style="margin-top: 8px; font-size: 13px;">Consultando Supabase (Ingresos y Distribuciones)...</p>
            </div>

            <!-- Contenido de Resultados -->
            <div id="gestionOpResultsContainer" style="display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                    
                    <!-- Tarjeta Ingresos -->
                    <div id="cardIngresosResult" style="background: var(--bg-dark); border: 1px solid var(--border); border-radius: 6px; padding: 16px; display: flex; flex-direction: column;">
                    </div>

                    <!-- Tarjeta Distribuciones -->
                    <div id="cardDistribucionesResult" style="background: var(--bg-dark); border: 1px solid var(--border); border-radius: 6px; padding: 16px; display: flex; flex-direction: column;">
                    </div>
                </div>

                <!-- Botón Global de Eliminación -->
                <div id="gestionOpGlobalActions" style="text-align: center; padding: 16px; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 6px;">
                </div>
            </div>
        </div>
    `;

    if (opInicial) {
        ejecutarBusquedaGestionOp();
    }
}

async function ejecutarBusquedaGestionOp() {
    const input = document.getElementById('gestionOpSearchInput');
    const loading = document.getElementById('gestionOpLoading');
    const resultsContainer = document.getElementById('gestionOpResultsContainer');
    
    if (!input) return;
    const op = input.value.trim();

    if (!op) {
        if (typeof showMessage === 'function') showMessage('Ingresa un número de OP o ID exacto para buscar', 'warning', 2000);
        return;
    }

    loading.style.display = 'block';
    resultsContainer.style.display = 'none';

    try {
        const headers = supabase.getHeaders();
        const opEncoded = encodeURIComponent(op);

        // 1. Consultar EXACTAMENTE por id_ingreso en la tabla ingresos
        const urlIngId = `${SUPABASE_URL}/rest/v1/ingresos?id_ingreso=eq.${opEncoded}&select=*`;
        let resIng1 = [];
        try {
            const res = await fetch(urlIngId, { headers });
            if (res.ok) resIng1 = await res.json();
        } catch(e){}

        // Solo si 'op' es un número entero puro (ej: "6264", NO "6264.2"), buscar también por columna 'lote'
        let resIng2 = [];
        if (/^\d+$/.test(op)) {
            const urlIngLote = `${SUPABASE_URL}/rest/v1/ingresos?lote=eq.${parseInt(op, 10)}&select=*`;
            try {
                const res = await fetch(urlIngLote, { headers });
                if (res.ok) resIng2 = await res.json();
            } catch(e){}
        }

        // Combinar e ignorar duplicados por id_ingreso
        const ingMap = new Map();
        [...(resIng1 || []), ...(resIng2 || [])].forEach(item => {
            if (item && item.id_ingreso) ingMap.set(item.id_ingreso, item);
        });
        const ingresosRes = Array.from(ingMap.values());

        // 2. Consultar EXACTAMENTE por id_distribucion en la tabla distribuciones
        const urlDistId = `${SUPABASE_URL}/rest/v1/distribuciones?id_distribucion=eq.${opEncoded}&select=*`;
        let resDist = [];
        try {
            const res = await fetch(urlDistId, { headers });
            if (res.ok) resDist = await res.json();
        } catch(e){}

        renderGestionOpResultados(op, ingresosRes, resDist || []);

    } catch (err) {
        console.error('Error buscando OP:', err);
        if (typeof showMessage === 'function') showMessage('Error consultando Supabase: ' + err.message, 'error', 3000);
    } finally {
        loading.style.display = 'none';
        resultsContainer.style.display = 'block';
    }
}

function renderGestionOpResultados(op, ingresosList, distList) {
    const cardIngresos = document.getElementById('cardIngresosResult');
    const cardDist = document.getElementById('cardDistribucionesResult');
    const globalActions = document.getElementById('gestionOpGlobalActions');

    if (!cardIngresos || !cardDist || !globalActions) return;

    const tieneIngreso = ingresosList.length > 0;
    const tieneDist = distList.length > 0;

    // --- RENDER TARJETA INGRESOS ---
    if (tieneIngreso) {
        let htmlIng = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <span style="font-weight:700; font-size:13px; color:var(--primary); display:flex; align-items:center; gap:6px;">
                    <i class="codicon codicon-layers"></i> Tabla: INGRESOS (${ingresosList.length})
                </span>
                <span style="background:rgba(13,188,121,0.15); color:var(--success); font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; border:1px solid var(--success);">
                    ENCONTRADO
                </span>
            </div>
            <div style="display:flex; flex-direction:column; gap:12px; overflow-y:auto; max-height:400px;">`;
        
        ingresosList.forEach(ing => {
            htmlIng += `
                <div style="border:1px solid var(--border); border-radius:6px; padding:12px; background:var(--editor);">
                    <div style="font-size:12px; display:flex; flex-direction:column; gap:4px; color:var(--text);">
                        <div><strong>ID Ingreso:</strong> <span style="font-family:monospace; color:var(--primary); font-weight:700;">${ing.id_ingreso}</span></div>
                        <div><strong>Lote:</strong> ${ing.lote || '—'}</div>
                        <div><strong>Referencia:</strong> ${ing.referencia || ing.refprov || '—'}</div>
                        <div><strong>Prenda:</strong> ${ing.prenda || ing.descripcion || '—'}</div>
                        <div><strong>Género:</strong> ${ing.genero || '—'}</div>
                        <div><strong>Total Declarado:</strong> ${ing.total || 0} uds | <strong>Contado:</strong> ${ing.cantidad || 0} uds</div>
                        <div><strong>Fecha Traslado:</strong> ${ing.fecha_traslado || '—'}</div>
                        <div style="font-size:11px; color:var(--text-muted);">Productora: ${ing.productora || '—'}</div>
                    </div>
                    <div style="margin-top:10px; text-align:right;">
                        <button class="btn-secondary" onclick="confirmarEliminarIngreso('${ing.id_ingreso}', '${ing.productora || ''}')" style="color:var(--error); border-color:var(--error); font-size:11px; padding:4px 10px;">
                            <i class="codicon codicon-trash"></i> Eliminar Ingreso (${ing.id_ingreso})
                        </button>
                    </div>
                </div>`;
        });
        htmlIng += `</div>`;
        cardIngresos.innerHTML = htmlIng;
    } else {
        cardIngresos.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <span style="font-weight:700; font-size:13px; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                    <i class="codicon codicon-layers"></i> Tabla: INGRESOS
                </span>
                <span style="background:rgba(244,71,71,0.1); color:var(--error); font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; border:1px solid var(--error);">
                    NO EXISTE
                </span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); padding:30px 10px; text-align:center;">
                No existe registro exacto con ID <strong>${op}</strong> en la tabla ingresos.
            </div>
        `;
    }

    // --- RENDER TARJETA DISTRIBUCIONES ---
    if (tieneDist) {
        let htmlDist = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <span style="font-weight:700; font-size:13px; color:var(--primary); display:flex; align-items:center; gap:6px;">
                    <i class="codicon codicon-package"></i> Tabla: DISTRIBUCIONES (${distList.length})
                </span>
                <span style="background:rgba(13,188,121,0.15); color:var(--success); font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; border:1px solid var(--success);">
                    ENCONTRADO
                </span>
            </div>
            <div style="display:flex; flex-direction:column; gap:12px; overflow-y:auto; max-height:400px;">`;

        distList.forEach(dist => {
            let datosParsed = dist.datos_distribucion;
            if (typeof datosParsed === 'string') {
                try { datosParsed = JSON.parse(datosParsed); } catch(e){}
            }
            const clientesMap = datosParsed?.Clientes || {};
            const nombresClientes = Object.keys(clientesMap).join(', ') || 'Sin clientes';
            const numClientes = Object.keys(clientesMap).length;

            htmlDist += `
                <div style="border:1px solid var(--border); border-radius:6px; padding:12px; background:var(--editor);">
                    <div style="font-size:12px; display:flex; flex-direction:column; gap:4px; color:var(--text);">
                        <div><strong>ID Distribución:</strong> <span style="font-family:monospace; color:var(--primary); font-weight:700;">${dist.id_distribucion}</span></div>
                        <div><strong>Mayoristas (${numClientes}):</strong> ${nombresClientes}</div>
                        <div><strong>Estado:</strong> ${dist.estado || '—'}</div>
                        <div><strong>Fecha:</strong> ${dist.fecha_distribucion ? new Date(dist.fecha_distribucion).toLocaleString('es-CO') : (dist.created_at || '—')}</div>
                        <div style="font-size:11px; color:var(--text-muted);">Productora: ${dist.productora || '—'}</div>
                    </div>
                    <div style="margin-top:10px; text-align:right;">
                        <button class="btn-secondary" onclick="confirmarEliminarDistribucion('${dist.id_distribucion}', '${dist.productora || ''}')" style="color:var(--error); border-color:var(--error); font-size:11px; padding:4px 10px;">
                            <i class="codicon codicon-trash"></i> Eliminar Distribución (${dist.id_distribucion})
                        </button>
                    </div>
                </div>`;
        });
        htmlDist += `</div>`;
        cardDist.innerHTML = htmlDist;
    } else {
        cardDist.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <span style="font-weight:700; font-size:13px; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
                    <i class="codicon codicon-package"></i> Tabla: DISTRIBUCIONES
                </span>
                <span style="background:rgba(244,71,71,0.1); color:var(--error); font-size:10px; font-weight:700; padding:2px 8px; border-radius:4px; border:1px solid var(--error);">
                    NO EXISTE
                </span>
            </div>
            <div style="font-size:12px; color:var(--text-muted); padding:30px 10px; text-align:center;">
                No existe distribución exacta guardada para el ID <strong>${op}</strong>.
            </div>
        `;
    }

    // --- ACCIONES GLOBALES ---
    const ingItem = tieneIngreso ? ingresosList[0] : null;
    const distItem = tieneDist ? distList[0] : null;

    if (tieneIngreso && tieneDist) {
        globalActions.innerHTML = `
            <div style="font-size:12px; margin-bottom:10px; color:var(--text-muted);">
                Existe coincidencia exacta para <strong>${op}</strong> tanto en <strong>Ingresos</strong> como en <strong>Distribuciones</strong>.
            </div>
            <button class="btn-primary" onclick="confirmarEliminarAmbos('${ingItem.id_ingreso}', '${distItem.id_distribucion}', '${ingItem.productora || ''}', '${distItem.productora || ''}')" 
                    style="background:var(--error); border-color:var(--error); font-weight:700; padding:8px 20px;">
                <i class="codicon codicon-trash"></i> Eliminar Registro Exacto '${op}' en AMBAS Tablas
            </button>
        `;
    } else if (tieneIngreso || tieneDist) {
        globalActions.innerHTML = `
            <div style="font-size:12px; color:var(--text-muted);">
                Utiliza el botón de eliminación en la tarjeta disponible para remover el registro.
            </div>
        `;
    } else {
        globalActions.innerHTML = `
            <div style="font-size:12px; color:var(--text-muted);">
                Sin registros encontrados con ID exacto <strong>${op}</strong>.
            </div>
        `;
    }
}

async function confirmarEliminarIngreso(idIngreso, productora) {
    if (!confirm(`¿Estás seguro de eliminar el registro EXACTO '${idIngreso}' de la tabla INGRESOS?\nEsta acción no se puede deshacer.`)) return;

    const loading = (typeof showQuickLoading === 'function') ? showQuickLoading('Eliminando de ingresos...') : null;
    try {
        const headers = supabase.getHeaders();
        let url = `${SUPABASE_URL}/rest/v1/ingresos?id_ingreso=eq.${encodeURIComponent(idIngreso)}`;
        if (productora) url += `&productora=eq.${encodeURIComponent(productora)}`;

        const res = await fetch(url, { method: 'DELETE', headers });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `HTTP ${res.status}`);
        }

        if (typeof loadData2Data === 'function') {
            await loadData2Data().catch(() => {});
        }
        if (typeof updateDataStats === 'function') updateDataStats();

        if (typeof showMessage === 'function') showMessage(`Registro '${idIngreso}' eliminado de Ingresos`, 'success', 2500);
        ejecutarBusquedaGestionOp();
    } catch (err) {
        console.error('Error eliminando de ingresos:', err);
        if (typeof showMessage === 'function') showMessage('Error al eliminar ingreso: ' + err.message, 'error', 3000);
    } finally {
        if (loading) loading.close();
    }
}

async function confirmarEliminarDistribucion(idDist, productora) {
    if (!confirm(`¿Estás seguro de eliminar la distribución EXACTA '${idDist}'?\nEsta acción no se puede deshacer.`)) return;

    const loading = (typeof showQuickLoading === 'function') ? showQuickLoading('Eliminando de distribuciones...') : null;
    try {
        const headers = supabase.getHeaders();
        let url = `${SUPABASE_URL}/rest/v1/distribuciones?id_distribucion=eq.${encodeURIComponent(idDist)}`;
        if (productora) url += `&productora=eq.${encodeURIComponent(productora)}`;

        const res = await fetch(url, { method: 'DELETE', headers });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `HTTP ${res.status}`);
        }

        if (typeof updateDataStats === 'function') updateDataStats();

        if (typeof showMessage === 'function') showMessage(`Distribución '${idDist}' eliminada`, 'success', 2500);
        ejecutarBusquedaGestionOp();
    } catch (err) {
        console.error('Error eliminando de distribuciones:', err);
        if (typeof showMessage === 'function') showMessage('Error al eliminar distribución: ' + err.message, 'error', 3000);
    } finally {
        if (loading) loading.close();
    }
}

async function confirmarEliminarAmbos(idIngreso, idDist, prodIngreso, prodDist) {
    if (!confirm(`¿Estás seguro de eliminar DEFINITIVAMENTE el Ingreso '${idIngreso}' y la Distribución '${idDist}'?\nAmbos registros exactos serán borrados.`)) return;

    const loading = (typeof showQuickLoading === 'function') ? showQuickLoading('Eliminando de ambas tablas...') : null;
    try {
        const headers = supabase.getHeaders();

        let urlIng = `${SUPABASE_URL}/rest/v1/ingresos?id_ingreso=eq.${encodeURIComponent(idIngreso)}`;
        if (prodIngreso) urlIng += `&productora=eq.${encodeURIComponent(prodIngreso)}`;

        let urlDist = `${SUPABASE_URL}/rest/v1/distribuciones?id_distribucion=eq.${encodeURIComponent(idDist)}`;
        if (prodDist) urlDist += `&productora=eq.${encodeURIComponent(prodDist)}`;

        await Promise.all([
            fetch(urlIng, { method: 'DELETE', headers }).catch(err => console.error(err)),
            fetch(urlDist, { method: 'DELETE', headers }).catch(err => console.error(err))
        ]);

        if (typeof loadData2Data === 'function') {
            await loadData2Data().catch(() => {});
        }
        if (typeof updateDataStats === 'function') updateDataStats();

        if (typeof showMessage === 'function') showMessage(`Registros '${idIngreso}' y '${idDist}' eliminados`, 'success', 3000);
        ejecutarBusquedaGestionOp();
    } catch (err) {
        console.error('Error eliminando ambos registros:', err);
        if (typeof showMessage === 'function') showMessage('Error durante la eliminación: ' + err.message, 'error', 3000);
    } finally {
        if (loading) loading.close();
    }
}

function abrirModalFormGestionOp(opInicial = '') {
    const existing = document.getElementById('modalGestionOpOverlay');
    if (existing) document.body.removeChild(existing);

    const overlay = document.createElement('div');
    overlay.id = 'modalGestionOpOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;';

    overlay.innerHTML = `
        <div style="background:var(--editor); border:1px solid var(--border); border-radius:8px; width:900px; max-width:92vw; max-height:90vh; overflow-y:auto; box-shadow:0 12px 40px rgba(0,0,0,0.6); font-family:'Segoe UI', sans-serif;">
            <div style="padding:14px 18px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); background:var(--bg-dark);">
                <div style="display:flex;align-items:center;gap:10px;">
                    <i class="codicon codicon-trash" style="color:var(--error); font-size:16px;"></i>
                    <h3 style="margin:0; font-size:15px; font-weight:600; color:var(--text);">Gestión de OPs (Consultar / Eliminar Ingresos y Distribución)</h3>
                </div>
                <i class="codicon codicon-close" style="cursor:pointer; color:var(--text-muted); font-size:16px;" onclick="document.body.removeChild(document.getElementById('modalGestionOpOverlay'))"></i>
            </div>
            <div id="modalGestionOpContent" style="padding:10px;"></div>
        </div>
    `;

    document.body.appendChild(overlay);
    renderGestionOpUI(document.getElementById('modalGestionOpContent'), opInicial);
}

// Global Export
window.showGestionOpModal = showGestionOpModal;
window.ejecutarBusquedaGestionOp = ejecutarBusquedaGestionOp;
window.confirmarEliminarIngreso = confirmarEliminarIngreso;
window.confirmarEliminarDistribucion = confirmarEliminarDistribucion;
window.confirmarEliminarAmbos = confirmarEliminarAmbos;
