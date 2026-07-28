/**
 * js/modules/orders.js
 * Módulo de Pedidos para Mayoristas
 *
 * pedidosMap → array plano de pedidos → tabla pedidos en Supabase
 *
 * Cada pedido: { id, mayoristaId, op, referencia, prenda, cantidad, obs, fecha }
 */

let pedidosMap     = [];
let pedidosSaving  = false;
let mostrandoCompletados = false;  // Toggle para mostrar/ocultar completados
let opsEnIngresosSet = new Set();  // OPs activas que ya están en la tabla ingresos
let verificandoIngresos = false;

// ============================================
// INIT
// ============================================

async function initOrdersModule() {
    try {
        renderOrdersBoard();
        await cargarPedidosDesdeSheets();
    } catch (err) {
        console.error('Error inicializando módulo de pedidos:', err);
    }
}

// ============================================
// PERSISTENCIA
// ============================================

async function cargarPedidosDesdeSheets() {
    try {
        if (typeof loadPedidosData !== 'function') {
            console.error('loadPedidosData no está definida');
            return;
        }
        pedidosMap = await loadPedidosData();
        renderOrdersBoard();
        // Verificar automáticamente cuáles OPs ya están en ingresos
        verificarOpsEnIngresos();
    } catch (err) { 
        console.error('Error cargando pedidos:', err);
        pedidosMap = [];
        renderOrdersBoard();
    }
}

// Función eliminada: ya no se usan pedidos finalizados

// ============================================
// RENDER BOARD
// ============================================

function renderOrdersBoard() {
    const container = document.getElementById('orders-board');
    if (!container) return;

    // Filtrar según el toggle
    const pedidosActivos = pedidosMap.filter(p => p.estado !== false);
    const pedidosCompletados = pedidosMap.filter(p => p.estado === false);
    const lista = mostrandoCompletados ? pedidosCompletados : pedidosActivos;
    
    // Ordenar por nombre de cliente
    lista.sort((a, b) => {
        const na = getClienteNombre(a.mayoristaId) || a.nombreCliente || '';
        const nb = getClienteNombre(b.mayoristaId) || b.nombreCliente || '';
        return na.localeCompare(nb);
    });

    // Actualizar botón toggle
    const btn = document.getElementById('orders-toggle-finalizados');
    if (btn) {
        btn.classList.toggle('active', mostrandoCompletados);
        btn.title = mostrandoCompletados ? 'Ocultar completados' : 'Ver completados';
    }

    // Totales resumen
    const totalUds  = pedidosActivos.reduce((s, p) => s + (p.cantidad || 0), 0);
    const totalPeds = pedidosActivos.length;
    const opsConflicto = pedidosActivos.filter(p => opsEnIngresosSet.has(String(p.op))).length;

    const alertaBadge = opsConflicto > 0
        ? `<div class="orders-stat" style="background:rgba(255,140,0,0.12); border:1px solid rgba(255,140,0,0.4); border-radius:6px; padding:4px 12px;" title="Hay OPs en pedidos que ya fueron ingresadas">
               <span class="orders-stat-val" style="color:#ff8c00;">${opsConflicto}</span>
               <span class="orders-stat-lbl" style="color:#ff8c00;">⚠ ya en ingresos</span>
           </div>`
        : '';

    const statsHtml = `
        <div class="orders-stats-bar" style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <div class="orders-stat">
                <span class="orders-stat-val">${totalPeds}</span>
                <span class="orders-stat-lbl">pedidos activos</span>
            </div>
            <div class="orders-stat">
                <span class="orders-stat-val">${totalUds}</span>
                <span class="orders-stat-lbl">unidades totales</span>
            </div>
            <div class="orders-stat orders-stat-fin">
                <span class="orders-stat-val">${pedidosCompletados.length}</span>
                <span class="orders-stat-lbl">completados</span>
            </div>
            ${alertaBadge}
        </div>;`

    if (!lista.length) {
        container.innerHTML = statsHtml + `
            <div class="empty-state" style="margin-top:48px;">
                <i class="codicon codicon-list-ordered empty-icon"></i>
                <h5>${mostrandoCompletados ? 'Sin pedidos completados' : 'Sin pedidos activos'}</h5>
                ${!mostrandoCompletados ? '<p>Usa el botón "Agregar pedido" para registrar uno.</p>' : ''}
            </div>`;
        return;
    }

    container.innerHTML = statsHtml + `
        <div class="orders-table-wrap">
            <table class="orders-table">
                <thead>
                    <tr>
                        <th style="width:90px;">ID</th>
                        <th style="width:140px;">Cliente</th>
                        <th style="width:80px;">OP</th>
                        <th style="width:100px;">Referencia</th>
                        <th style="width:140px;">Prenda</th>
                        <th style="width:80px;">Cantidad</th>
                        <th>Observaciones</th>
                        <th style="width:90px;">${mostrandoCompletados ? 'Completado' : 'Registrado'}</th>
                        <th style="width:72px;"></th>
                    </tr>
                </thead>
                <tbody>
                    ${lista.map(p => renderPedidoFila(p)).join('')}
                </tbody>
            </table>
        </div>`;
}

function renderPedidoFila(p) {
    const nombre = getClienteNombre(p.mayoristaId) || p.nombreCliente || '—';
    // Formatear fecha desde TIMESTAMPTZ
    const fecha = p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }) : '';
    
    const esCompletado = p.estado === false;
    const yaEnIngresos = opsEnIngresosSet.has(String(p.op));

    const rowStyle = yaEnIngresos
        ? 'background:rgba(255,140,0,0.08); border-left:3px solid #ff8c00;'
        : '';

    const opCell = yaEnIngresos
        ? `<span class="orders-op-plain" style="color:#ff8c00; font-weight:700;">${p.op}</span>`
        : `<span class="orders-op-plain">${p.op}</span>`;

    return `
        <tr style="${rowStyle}">
            <td><span class="orders-cliente-id">${p.mayoristaId}</span></td>
            <td><span class="orders-cliente-tag">${nombre || '—'}</span></td>
            <td>${opCell}</td>
            <td><span class="orders-row-ref">${p.referencia || '—'}</span></td>
            <td><span class="orders-row-prenda">${p.prenda || '—'}${p.genero ? ` <span style="opacity:.5;font-size:10px">${p.genero}</span>` : ''}</span></td>
            <td><span class="orders-qty-badge">${p.cantidad}</span></td>
            <td><span class="orders-obs-cell">${p.obs || '<span style="opacity:.35;">—</span>'}</span></td>
            <td><span class="orders-row-fecha">${fecha}</span></td>
            <td>
                <div class="orders-row-actions">
                    ${yaEnIngresos ? `
                    <button class="orders-row-btn" onclick="showGestionOpModal('${p.op}')"
                            title="Esta OP ya fue ingresada. Clic para ver en Gestión OP."
                            style="color:#ff8c00; border-color:rgba(255,140,0,0.4);">
                        <i class="codicon codicon-warning"></i>
                    </button>` : ''}
                    ${!esCompletado ? `
                    <button class="orders-row-btn orders-row-btn-edit" onclick="abrirModalEditarPedido('${p.id}')" title="Editar">
                        <i class="codicon codicon-edit"></i>
                    </button>` : ''}
                    <button class="orders-row-btn orders-row-btn-del" onclick="eliminarPedido('${p.id}')" title="Eliminar">
                        <i class="codicon codicon-close"></i>
                    </button>
                </div>
            </td>
        </tr>`;
}


// ============================================
// VERIFICAR OPS EN INGRESOS
// ============================================

/**
 * Consulta Supabase para saber cuáles OPs de los pedidos activos
 * ya existen como registros en la tabla 'ingresos'.
 * Colorea las filas correspondientes en naranja.
 */
async function verificarOpsEnIngresos() {
    if (verificandoIngresos) return;

    const pedidosActivos = pedidosMap.filter(p => p.estado !== false && p.op);
    if (!pedidosActivos.length) {
        if (typeof showMessage === 'function') showMessage('No hay pedidos activos para verificar', 'info', 2000);
        return;
    }

    verificandoIngresos = true;
    opsEnIngresosSet.clear();
    renderOrdersBoard(); // Re-render para mostrar spinner

    try {
        const headers = supabase.getHeaders();
        const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;

        // Obtener lista única de OPs activas
        const opsUnicas = [...new Set(pedidosActivos.map(p => String(p.op).trim()).filter(Boolean))];

        // Buscar en ingresos cuáles de esas OPs existen (por id_ingreso o lote)
        const loteNums = opsUnicas.filter(op => /^\d+$/.test(op)).map(Number);
        const promesas = [];

        // Buscar por id_ingreso (puede ser '6264' o '6264.1')
        if (opsUnicas.length) {
            const inFilter = opsUnicas.map(op => encodeURIComponent(op)).join(',');
            let urlId = `${SUPABASE_URL}/rest/v1/ingresos?id_ingreso=in.(${inFilter})&select=id_ingreso,lote`;
            if (proveedorActivo) urlId += `&productora=eq.${proveedorActivo.id}`;
            promesas.push(fetch(urlId, { headers }).then(r => r.ok ? r.json() : []).catch(() => []));
        }

        // Buscar por lote numérico
        if (loteNums.length) {
            let urlLote = `${SUPABASE_URL}/rest/v1/ingresos?lote=in.(${loteNums.join(',')})&select=id_ingreso,lote`;
            if (proveedorActivo) urlLote += `&productora=eq.${proveedorActivo.id}`;
            promesas.push(fetch(urlLote, { headers }).then(r => r.ok ? r.json() : []).catch(() => []));
        }

        const resultados = await Promise.all(promesas);
        const encontrados = resultados.flat();

        // Registrar cuáles OPs cruzaron
        encontrados.forEach(row => {
            if (row.id_ingreso) opsEnIngresosSet.add(String(row.id_ingreso));
            if (row.lote)       opsEnIngresosSet.add(String(row.lote));
        });

        const count = pedidosActivos.filter(p => opsEnIngresosSet.has(String(p.op))).length;

        if (count > 0) {
            if (typeof showMessage === 'function')
                showMessage(`⚠ ${count} pedido(s) tienen OPs que ya están en Ingresos`, 'warning', 4000);
        } else {
            if (typeof showMessage === 'function')
                showMessage('✓ Ninguna OP de pedidos activos está en Ingresos', 'success', 3000);
        }

    } catch (err) {
        console.error('Error verificando OPs en ingresos:', err);
        if (typeof showMessage === 'function') showMessage('Error al consultar ingresos: ' + err.message, 'error', 3000);
    } finally {
        verificandoIngresos = false;
        renderOrdersBoard(); // Re-render con resultados coloreados
    }
}

// ============================================
// TOGGLE COMPLETADOS
// ============================================

function toggleFinalizados() {
    mostrandoCompletados = !mostrandoCompletados;
    renderOrdersBoard();
}

// ============================================
// MODAL AGREGAR PEDIDO
// ============================================

function abrirModalAgregarPedido() {
    const mayoristas = getMayoristasActivos();
    if (!mayoristas.length) {
        showMessage('No hay mayoristas activos configurados', 'warning', 2000);
        return;
    }

    const optsClientes = mayoristas.map(([id, c]) =>
        `<option value="${id}">${c.NOMBRE_CORTO}</option>`
    ).join('');

    const modal = createModal(
        '<i class="codicon codicon-list-ordered" style="color:var(--primary)"></i> Nuevo Pedido',
        `<div class="orders-add-form">
            <div class="orders-add-field">
                <label>Cliente <span class="required-mark">*</span></label>
                <select id="modal-cliente" class="form-control">
                    <option value="">Selecciona un mayorista...</option>
                    ${optsClientes}
                </select>
            </div>
            <div class="orders-add-row">
                <div class="orders-add-field">
                    <label>OP <span class="required-mark">*</span></label>
                    <input type="text" id="modal-op" class="form-control" placeholder="ej: 2425"
                        oninput="onModalOpChange(this.value)"
                        onchange="onModalOpChange(this.value, true)"
                        onblur="onModalOpChange(this.value, true)"
                        onkeydown="if(event.key==='Enter') { onModalOpChange(this.value, true); document.getElementById('modal-qty').focus(); }">
                </div>
                <div class="orders-add-field orders-add-field-sm">
                    <label>Cantidad <span class="required-mark">*</span></label>
                    <input type="number" id="modal-qty" class="form-control" placeholder="0" min="1"
                        onkeydown="if(event.key==='Enter') confirmarPedidoModal()">
                </div>
            </div>
            <div id="modal-op-hint" class="orders-hint-row" style="min-height:20px;"></div>
            <div id="modal-op-details" class="orders-details-card" style="display:none;">
                <div class="orders-details-row">
                    <div class="orders-add-field">
                        <label>Referencia</label>
                        <input type="text" id="modal-detail-ref" class="form-control" readonly>
                    </div>
                    <div class="orders-add-field">
                        <label>Prenda</label>
                        <input type="text" id="modal-detail-prenda" class="form-control" readonly>
                    </div>
                    <div class="orders-add-field">
                        <label>Género</label>
                        <input type="text" id="modal-detail-genero" class="form-control" readonly>
                    </div>
                </div>
            </div>
            <div class="orders-add-field">
                <label>Observaciones <span style="opacity:.5;font-weight:400;">(opcional)</span></label>
                <input type="text" id="modal-obs" class="form-control" placeholder="ej: urgente, talla especial...">
            </div>
            <div class="orders-modal-actions" style="margin-top:18px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                <button class="btn-primary" onclick="confirmarPedidoModal()">
                    <i class="codicon codicon-add"></i> Agregar
                </button>
            </div>
        </div>`,
        true
    );
    modal.classList.add('modal-agregar-pedido');
    setTimeout(() => document.getElementById('modal-cliente')?.focus(), 100);
}

// ============================================
// BÚSQUEDA GARANTIZADA DE OP EN CATÁLOGO MASTER
// ============================================

/**
 * Garantiza la búsqueda de la OP en el catálogo master (memoria + Supabase local + fallback).
 * Maneja variantes como '6264.2' derivando la OP base '6264'.
 */
async function obtenerDetallesOpGarantizado(opInput) {
    if (!opInput) return null;
    const op = String(opInput).trim();
    if (!op) return null;

    // Candidatos de claves a intentar: OP exacta, OP base sin decimal (. o _), y sin ceros iniciales
    const baseOp = op.split('.')[0].split('_')[0].trim();
    const cleanOp = op.replace(/^0+/, '');
    const cleanBase = baseOp.replace(/^0+/, '');

    const candidateKeys = [...new Set([op, baseOp, cleanOp, cleanBase].filter(Boolean))];

    // 1. Buscar en memoria (window.sisproMap)
    if (window.sisproMap && window.sisproMap instanceof Map) {
        for (const key of candidateKeys) {
            const hit = window.sisproMap.get(key);
            if (hit && (hit.REFERENCIA || hit.PRENDA)) return hit;
        }
    }

    // 2. Consultar catálogo local Supabase (loadSisproData)
    if (typeof loadSisproData === 'function') {
        try {
            await loadSisproData(candidateKeys);
            if (window.sisproMap && window.sisproMap instanceof Map) {
                for (const key of candidateKeys) {
                    const hit = window.sisproMap.get(key);
                    if (hit && (hit.REFERENCIA || hit.PRENDA)) return hit;
                }
            }
        } catch (e) {
            console.warn('Error consultando catálogo master:', candidateKeys, e);
        }
    }

    // 3. Fallback directo a Supabase master
    try {
        if (typeof SUPABASE_URL !== 'undefined' && typeof supabase !== 'undefined') {
            const headers = supabase.getHeaders();
            for (const key of candidateKeys) {
                const url = `${SUPABASE_URL}/rest/v1/master?id_master=eq.${encodeURIComponent(key)}&select=id_master,referencia,descripcion,cuento,genero`;
                const res = await fetch(url, { headers }).then(r => r.ok ? r.json() : []).catch(() => []);
                if (res && res.length > 0 && res[0]) {
                    const row = res[0];
                    const sisproObj = {
                        PRENDA:     row.descripcion || '',
                        LINEA:      row.cuento      || '',
                        GENERO:     row.genero      || '',
                        REFERENCIA: row.referencia  || ''
                    };
                    if (window.sisproMap && window.sisproMap instanceof Map) {
                        window.sisproMap.set(key, sisproObj);
                        window.sisproMap.set(op, sisproObj);
                    }
                    return sisproObj;
                }
            }
        }
    } catch(err) {
        console.error('Error en fallback directo master:', err);
    }

    return null;
}

let opDebounceTimer = null;

async function onModalOpChange(val, immediate = false) {
    const hint    = document.getElementById('modal-op-hint');
    const details = document.getElementById('modal-op-details');
    const refEl   = document.getElementById('modal-detail-ref');
    const prendaEl= document.getElementById('modal-detail-prenda');
    const generoEl= document.getElementById('modal-detail-genero');

    if (!hint) return;
    const op = val.trim();

    if (!op) {
        hint.innerHTML = '';
        if (details) details.style.display = 'none';
        return;
    }

    if (opDebounceTimer) clearTimeout(opDebounceTimer);

    const ejecutar = async () => {
        hint.innerHTML = `<span class="orders-hint-loading" style="color:var(--text-muted);font-size:12px;"><i class="codicon codicon-loading codicon-modifier-spin"></i> Buscando OP en catálogo...</span>`;
        const sispro = await obtenerDetallesOpGarantizado(op);
        mostrarDetallesOpModal(op, sispro, hint, details, refEl, prendaEl, generoEl);
    };

    if (immediate) {
        await ejecutar();
    } else {
        opDebounceTimer = setTimeout(ejecutar, 350);
    }
}

function mostrarDetallesOpModal(op, sispro, hint, details, refEl, prendaEl, generoEl) {
    if (!sispro) {
        hint.innerHTML = `<span class="orders-hint-notfound"><i class="codicon codicon-warning"></i> OP ${op} no encontrada en catálogo</span>`;
        if (details) details.style.display = 'none';
        return;
    }

    hint.innerHTML = `<span class="orders-hint-found" style="color:var(--success); font-weight:600;"><i class="codicon codicon-check"></i> OP encontrada</span>`;
    if (details && refEl && prendaEl && generoEl) {
        refEl.value    = sispro.REFERENCIA || '';
        prendaEl.value = sispro.PRENDA     || '';
        generoEl.value = sispro.GENERO     || '';
        details.style.display = 'block';
    }
}

async function confirmarPedidoModal() {
    const mayoristaId = document.getElementById('modal-cliente')?.value;
    const op          = document.getElementById('modal-op')?.value.trim();
    const qty         = parseInt(document.getElementById('modal-qty')?.value) || 0;
    const obs         = document.getElementById('modal-obs')?.value.trim();

    if (!mayoristaId) { showMessage('Selecciona un cliente', 'warning', 1500); return; }
    if (!op)          { showMessage('Escribe una OP', 'warning', 1500); return; }
    if (qty <= 0)     { showMessage('Ingresa una cantidad válida', 'warning', 1500); return; }

    // Búsqueda garantizada antes de guardar
    const sispro = await obtenerDetallesOpGarantizado(op);

    const pedido = {
        id:            `${mayoristaId}_${op}_${Date.now()}`,
        mayoristaId,
        nombreCliente: getClienteNombre(mayoristaId),
        op,
        referencia:    sispro?.REFERENCIA || '',
        prenda:        sispro?.PRENDA     || '',
        genero:        sispro?.GENERO     || '',
        cantidad:      qty,
        obs:           obs || '',
        fecha:         new Date().toISOString(),
        estado:        true
    };

    document.querySelector('.modal-agregar-pedido')?.remove();
    agregarPedidoRealTime(pedido);
}

// ============================================
// MODAL EDITAR PEDIDO
// ============================================

async function abrirModalEditarPedido(id) {
    const pedido = pedidosMap.find(p => p.id === id);
    if (!pedido) return;

    const mayoristas   = getMayoristasActivos();
    const optsClientes = mayoristas.map(([mid, c]) =>
        `<option value="${mid}" ${mid === pedido.mayoristaId ? 'selected' : ''}>${c.NOMBRE_CORTO}</option>`
    ).join('');

    const sispro = await obtenerDetallesOpGarantizado(pedido.op);

    const hintInicial = sispro
        ? `<span class="orders-hint-found" style="color:var(--success); font-weight:600;"><i class="codicon codicon-check"></i> OP encontrada</span>`
        : '';
    const detailsInicial = sispro ? `
        <div id="edit-op-details" class="orders-details-card" style="display:block;">
            <div class="orders-details-row">
                <div class="orders-add-field">
                    <label>Referencia</label>
                    <input type="text" id="edit-detail-ref" class="form-control" value="${sispro.REFERENCIA || pedido.referencia || ''}" readonly>
                </div>
                <div class="orders-add-field">
                    <label>Prenda</label>
                    <input type="text" id="edit-detail-prenda" class="form-control" value="${sispro.PRENDA || pedido.prenda || ''}" readonly>
                </div>
                <div class="orders-add-field">
                    <label>Género</label>
                    <input type="text" id="edit-detail-genero" class="form-control" value="${sispro.GENERO || pedido.genero || ''}" readonly>
                </div>
            </div>
        </div>` : '<div id="edit-op-details" class="orders-details-card" style="display:none;"></div>';

    const modal = createModal(
        '<i class="codicon codicon-edit" style="color:var(--primary)"></i> Editar Pedido',
        `<div class="orders-add-form">
            <div class="orders-add-field">
                <label>Cliente <span class="required-mark">*</span></label>
                <select id="edit-cliente" class="form-control">
                    ${optsClientes}
                </select>
            </div>
            <div class="orders-add-row">
                <div class="orders-add-field">
                    <label>OP <span class="required-mark">*</span></label>
                    <input type="text" id="edit-op" class="form-control" value="${pedido.op}"
                        oninput="onEditOpChange(this.value)"
                        onchange="onEditOpChange(this.value, true)"
                        onblur="onEditOpChange(this.value, true)"
                        onkeydown="if(event.key==='Enter') { onEditOpChange(this.value, true); document.getElementById('edit-qty').focus(); }">
                </div>
                <div class="orders-add-field orders-add-field-sm">
                    <label>Cantidad <span class="required-mark">*</span></label>
                    <input type="number" id="edit-qty" class="form-control" value="${pedido.cantidad}" min="1"
                        onkeydown="if(event.key==='Enter') guardarEdicionPedido('${id}')">
                </div>
            </div>
            <div id="edit-op-hint" class="orders-hint-row" style="min-height:20px;">${hintInicial}</div>
            ${detailsInicial}
            <div class="orders-add-field">
                <label>Observaciones <span style="opacity:.5;font-weight:400;">(opcional)</span></label>
                <input type="text" id="edit-obs" class="form-control" value="${pedido.obs || ''}" placeholder="ej: urgente, talla especial...">
            </div>
            <div class="orders-modal-actions" style="margin-top:18px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                <button class="btn-primary" onclick="guardarEdicionPedido('${id}')">
                    <i class="codicon codicon-save"></i> Guardar cambios
                </button>
            </div>
        </div>`,
        true
    );
    modal.classList.add('modal-editar-pedido');
    setTimeout(() => document.getElementById('edit-op')?.focus(), 100);
}

async function onEditOpChange(val, immediate = false) {
    const hint    = document.getElementById('edit-op-hint');
    const details = document.getElementById('edit-op-details');

    if (!hint) return;
    const op = val.trim();

    if (!op) {
        hint.innerHTML = '';
        if (details) details.style.display = 'none';
        return;
    }

    if (opDebounceTimer) clearTimeout(opDebounceTimer);

    const ejecutar = async () => {
        hint.innerHTML = `<span class="orders-hint-loading" style="color:var(--text-muted);font-size:12px;"><i class="codicon codicon-loading codicon-modifier-spin"></i> Buscando OP en catálogo...</span>`;
        const sispro = await obtenerDetallesOpGarantizado(op);
        mostrarDetallesEditOpModal(op, sispro, hint, details);
    };

    if (immediate) {
        await ejecutar();
    } else {
        opDebounceTimer = setTimeout(ejecutar, 350);
    }
}

function mostrarDetallesEditOpModal(op, sispro, hint, details) {
    if (!sispro) {
        hint.innerHTML = `<span class="orders-hint-notfound"><i class="codicon codicon-warning"></i> OP ${op} no encontrada en catálogo</span>`;
        if (details) details.style.display = 'none';
        return;
    }

    hint.innerHTML = `<span class="orders-hint-found" style="color:var(--success); font-weight:600;"><i class="codicon codicon-check"></i> OP encontrada</span>`;
    if (details) {
        details.innerHTML = `
            <div class="orders-details-row">
                <div class="orders-add-field">
                    <label>Referencia</label>
                    <input type="text" id="edit-detail-ref" class="form-control" value="${sispro.REFERENCIA || ''}" readonly>
                </div>
                <div class="orders-add-field">
                    <label>Prenda</label>
                    <input type="text" id="edit-detail-prenda" class="form-control" value="${sispro.PRENDA || ''}" readonly>
                </div>
                <div class="orders-add-field">
                    <label>Género</label>
                    <input type="text" id="edit-detail-genero" class="form-control" value="${sispro.GENERO || ''}" readonly>
                </div>
            </div>`;
        details.style.display = 'block';
    }
}

async function guardarEdicionPedido(id) {
    const pedido = pedidosMap.find(p => p.id === id);
    if (!pedido) return;

    const mayoristaId = document.getElementById('edit-cliente')?.value;
    const op          = document.getElementById('edit-op')?.value.trim();
    const qty         = parseInt(document.getElementById('edit-qty')?.value) || 0;
    const obs         = document.getElementById('edit-obs')?.value.trim();

    if (!mayoristaId) { showMessage('Selecciona un cliente', 'warning', 1500); return; }
    if (!op)          { showMessage('Escribe una OP', 'warning', 1500); return; }
    if (qty <= 0)     { showMessage('Ingresa una cantidad válida', 'warning', 1500); return; }

    // Búsqueda garantizada antes de guardar
    const sispro = await obtenerDetallesOpGarantizado(op);

    const pedidoActualizado = {
        id:            pedido.id,
        mayoristaId,
        nombreCliente: getClienteNombre(mayoristaId),
        op,
        referencia:    sispro?.REFERENCIA || pedido.referencia || '',
        prenda:        sispro?.PRENDA     || pedido.prenda     || '',
        genero:        sispro?.GENERO     || pedido.genero     || '',
        cantidad:      qty,
        obs:           obs || '',
        fecha:         pedido.fecha,
        estado:        true
    };

    document.querySelector('.modal-agregar-pedido, .modal-editar-pedido')?.remove();
    actualizarPedidoRealTime(pedidoActualizado);
    showMessage('Pedido actualizado', 'success', 1500);
}

// ============================================
// CRUD - Operaciones en tiempo real
// ============================================

async function agregarPedidoRealTime(pedido) {
    try {
        await agregarPedidoASheets(pedido);
        await cargarPedidosDesdeSheets();
    } catch (err) {
        showMessage('Error agregando pedido: ' + err.message, 'error', 3000);
    }
}

async function actualizarPedidoRealTime(pedido) {
    try {
        await actualizarPedidoEnSheets(pedido);
        await cargarPedidosDesdeSheets();
    } catch (err) {
        showMessage('Error actualizando pedido: ' + err.message, 'error', 3000);
    }
}

async function eliminarPedido(id) {
    try {
        await eliminarPedidoDeSheets(id);
        await cargarPedidosDesdeSheets();
    } catch (err) {
        showMessage('Error eliminando pedido: ' + err.message, 'error', 3000);
    }
}

// Función eliminada: ya no se finalizan pedidos

function getMayoristasActivos() {
    // Usar clientesMap en lugar de allConfigData
    if (!window.clientesMap || window.clientesMap.size === 0) {
        Logger.warn('orders', 'clientesMap no está cargado');
        return [];
    }
    
    return Array.from(window.clientesMap.entries())
        .filter(([id, c]) => c.TIPO_CLIENTE === 'Mayorista' && c.ESTADO?.toUpperCase().trim() === 'ACTIVO')
        .sort((a, b) => a[1].NOMBRE_CORTO.localeCompare(b[1].NOMBRE_CORTO));
}

/**
 * Obtiene el nombre corto de un cliente desde clientesMap
 */
function getClienteNombre(mayoristaId) {
    if (!window.clientesMap || !mayoristaId) return mayoristaId || '—';
    const cliente = window.clientesMap.get(mayoristaId);
    return cliente?.NOMBRE_CORTO || mayoristaId;
}

// ============================================
// MODAL EN DISTRIBUCIÓN
// ============================================

function aplicarPedidosDesdeModal(pedidos) {
    document.querySelector('.modal-pedidos-lote')?.remove();
    const alertas = [];
    let aplicados = 0;

    Object.entries(pedidos).forEach(([mayoristaId, cantidad]) => {
        const nombre = getClienteNombre(mayoristaId);
        const checkbox = document.querySelector(`#mayoristasContainer input[type="checkbox"][value="${mayoristaId}"]`);
        if (checkbox && !checkbox.checked) {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
        }
        const globalInput = document.querySelector(`.global-mayorista-input[data-mayorista="${mayoristaId}"]`);
        if (globalInput) {
            globalInput.value = cantidad;
            const distributeBtn = document.querySelector(`.distribute-btn[data-mayorista="${mayoristaId}"]`);
            if (distributeBtn) distributeBtn.click();
            aplicados++;
        } else {
            alertas.push(`${nombre}: actívalo en el panel de mayoristas`);
        }
    });

    if (alertas.length) {
        showMessage(`Aplicado (${aplicados}). Pendiente: ${alertas.join(', ')}`, 'warning', 4000);
    } else {
        showMessage(`Pedidos aplicados para ${aplicados} mayorista(s)`, 'success', 2500);
    }
}

function mostrarModalPedidosParaLote(lote) {
    if (!lote) return;
    const pedidos = getPedidosPendientesParaLote(lote);
    if (!Object.keys(pedidos).length) return;

    document.querySelector('.modal-pedidos-lote')?.remove();

    // Obtener pedidos completos del lote (no solo cantidades agrupadas)
    const pedidosDelLote = pedidosMap.filter(p => 
        String(p.op) === String(lote) && p.estado !== false
    );

    const totalUds = Object.values(pedidos).reduce((a, b) => a + b, 0);
    
    // Agrupar pedidos por mayorista con sus observaciones
    const filas = Object.entries(pedidos).map(([mayoristaId, cantidad]) => {
        const nombre = getClienteNombre(mayoristaId);
        
        // Obtener observaciones de los pedidos de este mayorista
        const pedidosMayorista = pedidosDelLote.filter(p => p.mayoristaId === mayoristaId);
        const observaciones = pedidosMayorista
            .filter(p => p.obs && p.obs.trim())
            .map(p => `<div class="orders-modal-obs-item">• ${p.obs}</div>`)
            .join('');
        
        return `
            <div class="orders-modal-row">
                <div class="orders-modal-info">
                    <span class="orders-modal-nombre">${nombre}</span>
                    <span class="orders-modal-qty">${cantidad} uds</span>
                </div>
                ${observaciones ? `<div class="orders-modal-obs">${observaciones}</div>` : ''}
            </div>`;
    }).join('');

    const modal = createModal(
        `<i class="codicon codicon-list-ordered" style="color:var(--warning)"></i> Pedidos — OP ${lote}`,
        `<div class="orders-modal-body">
            <p class="orders-modal-desc">Mayoristas con pedido pendiente para esta OP:</p>
            <div class="orders-modal-list">${filas}</div>
            <div class="orders-modal-total">
                <span>Total pedido</span>
                <span class="orders-modal-total-val">${totalUds} uds</span>
            </div>
            <div class="orders-modal-actions">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cerrar</button>
                <button class="btn-primary" onclick="aplicarPedidosDesdeModal(${JSON.stringify(pedidos).replace(/"/g, '&quot;')})">
                    <i class="codicon codicon-wand"></i> Aplicar a distribución
                </button>
            </div>
        </div>`,
        true
    );
    modal.classList.add('modal-pedidos-lote');
}

// ============================================
// INTEGRACIÓN DISTRIBUCIÓN
// ============================================

// Función eliminada: ya no se finalizan pedidos automáticamente

function getPedidosPendientesParaLote(lote) {
    const result = {};
    pedidosMap.forEach(p => {
        // Solo contar pedidos activos (estado = true)
        if (String(p.op) === String(lote) && p.estado !== false) {
            result[p.mayoristaId] = (result[p.mayoristaId] || 0) + p.cantidad;
        }
    });
    return result;
}

/**
 * Marca pedidos de un lote como completados (estado = false)
 * Se ejecuta cuando se guarda una distribución
 */
async function marcarPedidosComoCompletados(lote) {
    if (!lote) return;
    const loteStr = String(lote);
    const pedidosDelLote = pedidosMap.filter(p => String(p.op) === loteStr && p.estado !== false);
    
    if (!pedidosDelLote.length) return;

    try {
        // Actualizar cada pedido a estado = false
        for (const pedido of pedidosDelLote) {
            const pedidoActualizado = {
                ...pedido,
                estado: false  // Marcar como completado
            };
            await actualizarPedidoEnSheets(pedidoActualizado);
        }
        
        // Recargar pedidos para reflejar cambios
        await cargarPedidosDesdeSheets();
        
        Logger.success('orders', `${pedidosDelLote.length} pedidos marcados como completados para OP ${lote}`);
    } catch (err) {
        Logger.error('orders', 'Error marcando pedidos como completados', err);
        showMessage('Error actualizando estado de pedidos: ' + err.message, 'error', 3000);
    }
}

// ============================================
// EXPORTS
// ============================================

window.initOrdersModule             = initOrdersModule;
window.abrirModalAgregarPedido      = abrirModalAgregarPedido;
window.abrirModalEditarPedido       = abrirModalEditarPedido;
window.onModalOpChange              = onModalOpChange;
window.onEditOpChange               = onEditOpChange;
window.confirmarPedidoModal         = confirmarPedidoModal;
window.guardarEdicionPedido         = guardarEdicionPedido;
window.eliminarPedido               = eliminarPedido;
window.toggleFinalizados            = toggleFinalizados;
window.getPedidosPendientesParaLote = getPedidosPendientesParaLote;
window.marcarPedidosComoCompletados = marcarPedidosComoCompletados;
window.mostrarModalPedidosParaLote  = mostrarModalPedidosParaLote;
window.aplicarPedidosDesdeModal     = aplicarPedidosDesdeModal;
