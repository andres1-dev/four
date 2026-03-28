/**
 * js/modules/orders.js
 * Módulo de Pedidos para Mayoristas
 *
 * pedidosMap    → array plano de pedidos activos   → col A1 hoja PEDIDOS
 * finalizadosMap → array plano de finalizados       → col B1 hoja PEDIDOS
 *
 * Cada pedido: { id, mayoristaId, op, referencia, prenda, cantidad, obs, fecha }
 */

let pedidosMap     = [];
let finalizadosMap = [];
let pedidosSaving  = false;
let mostrandoFinalizados = false;

// ============================================
// INIT
// ============================================

async function initOrdersModule() {
    try {
        renderOrdersBoard();
        await Promise.all([
            cargarPedidosDesdeSheets(),
            cargarFinalizadosDesdeSheets()
        ]);
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
    } catch (err) { 
        console.error('Error cargando pedidos:', err);
        pedidosMap = [];
        renderOrdersBoard();
    }
}

async function cargarFinalizadosDesdeSheets() {
    try {
        if (typeof loadFinalizadosData !== 'function') {
            console.error('loadFinalizadosData no está definida');
            return;
        }
        finalizadosMap = await loadFinalizadosData();
    } catch (err) { 
        console.error('Error cargando finalizados:', err);
        finalizadosMap = [];
    }
}

// ============================================
// RENDER BOARD
// ============================================

function renderOrdersBoard() {
    const container = document.getElementById('orders-board');
    if (!container) return;

    const lista = [...(mostrandoFinalizados ? finalizadosMap : pedidosMap)]
        .sort((a, b) => {
            const na = allConfigData?.[a.mayoristaId]?.nombreCorto || a.nombreCliente || a.mayoristaId || '';
            const nb = allConfigData?.[b.mayoristaId]?.nombreCorto || b.nombreCliente || b.mayoristaId || '';
            return na.localeCompare(nb);
        });

    const btn = document.getElementById('orders-toggle-finalizados');
    if (btn) {
        btn.classList.toggle('active', mostrandoFinalizados);
        btn.title = mostrandoFinalizados ? 'Ocultar finalizados' : 'Ver finalizados';
    }

    // Totales resumen
    const totalUds  = pedidosMap.reduce((s, p) => s + (p.cantidad || 0), 0);
    const totalPeds = pedidosMap.length;
    const totalFin  = finalizadosMap.length;

    const statsHtml = `
        <div class="orders-stats-bar">
            <div class="orders-stat">
                <span class="orders-stat-val">${totalPeds}</span>
                <span class="orders-stat-lbl">pedidos activos</span>
            </div>
            <div class="orders-stat">
                <span class="orders-stat-val">${totalUds}</span>
                <span class="orders-stat-lbl">unidades totales</span>
            </div>
            <div class="orders-stat orders-stat-fin">
                <span class="orders-stat-val">${totalFin}</span>
                <span class="orders-stat-lbl">finalizados</span>
            </div>
        </div>`;

    if (!lista.length) {
        container.innerHTML = statsHtml + `
            <div class="empty-state" style="margin-top:48px;">
                <i class="codicon codicon-list-ordered empty-icon"></i>
                <h5>${mostrandoFinalizados ? 'Sin pedidos finalizados' : 'Sin pedidos activos'}</h5>
                ${!mostrandoFinalizados ? '<p>Usa el botón "Agregar pedido" para registrar uno.</p>' : ''}
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
                        <th style="width:110px;">Referencia</th>
                        <th style="width:160px;">Prenda</th>
                        <th style="width:90px;">Género</th>
                        <th style="width:80px;">Cantidad</th>
                        <th>Observaciones</th>
                        <th style="width:90px;">${mostrandoFinalizados ? 'Finalizado' : 'Registrado'}</th>
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
    const config = allConfigData?.[p.mayoristaId];
    const nombre = config?.nombreCorto || p.nombreCliente || p.mayoristaId || '—';
    const esFin  = mostrandoFinalizados;
    const fecha  = esFin ? (p.fechaFin || '') : (p.fecha || '');

    return `
        <tr class="${esFin ? 'orders-tr-done' : ''}">
            <td><span class="orders-cliente-id">${p.mayoristaId}</span></td>
            <td><span class="orders-cliente-tag">${nombre || '—'}</span></td>
            <td><span class="orders-op-plain">${p.op}</span></td>
            <td><span class="orders-row-ref">${p.referencia || '—'}</span></td>
            <td><span class="orders-row-prenda">${p.prenda || '—'}</span></td>
            <td><span class="orders-row-genero">${p.genero || '—'}</span></td>
            <td><span class="orders-qty-badge${esFin ? ' orders-qty-badge-done' : ''}">${p.cantidad}</span></td>
            <td><span class="orders-obs-cell">${p.obs || '<span style="opacity:.35;">—</span>'}</span></td>
            <td><span class="orders-row-fecha">${fecha}</span></td>
            <td>
                <div class="orders-row-actions">
                    ${!esFin ? `
                    <button class="orders-row-btn orders-row-btn-edit" onclick="abrirModalEditarPedido('${p.id}')" title="Editar">
                        <i class="codicon codicon-edit"></i>
                    </button>` : ''}
                    <button class="orders-row-btn orders-row-btn-del" onclick="${esFin ? `eliminarFinalizado('${p.id}')` : `eliminarPedido('${p.id}')`}" title="${esFin ? 'Quitar del historial' : 'Eliminar'}">
                        <i class="codicon codicon-close"></i>
                    </button>
                </div>
            </td>
        </tr>`;
}

// ============================================
// TOGGLE FINALIZADOS
// ============================================

function toggleFinalizados() {
    mostrandoFinalizados = !mostrandoFinalizados;
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
        `<option value="${id}">${c.nombreCorto}</option>`
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
                        onkeydown="if(event.key==='Enter') document.getElementById('modal-qty').focus()">
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

function onModalOpChange(val) {
    const hint = document.getElementById('modal-op-hint');
    const details = document.getElementById('modal-op-details');
    const detailRef = document.getElementById('modal-detail-ref');
    const detailPrenda = document.getElementById('modal-detail-prenda');
    const detailGenero = document.getElementById('modal-detail-genero');
    
    if (!hint) return;
    const op = val.trim();
    
    if (!op) { 
        hint.innerHTML = ''; 
        if (details) details.style.display = 'none';
        return; 
    }
    
    const sispro = sisproMap.get(op);
    if (!sispro) {
        hint.innerHTML = `<span class="orders-hint-notfound">OP no encontrada en SISPROWEB</span>`;
        if (details) details.style.display = 'none';
        return;
    }
    
    hint.innerHTML = `<span class="orders-hint-found"><i class="codicon codicon-check"></i> OP encontrada</span>`;
    
    if (details && detailRef && detailPrenda && detailGenero) {
        detailRef.value = sispro.REFERENCIA || '';
        detailPrenda.value = sispro.PRENDA || '';
        detailGenero.value = sispro.GENERO || '';
        details.style.display = 'block';
    }
}

function confirmarPedidoModal() {
    const mayoristaId = document.getElementById('modal-cliente')?.value;
    const op          = document.getElementById('modal-op')?.value.trim();
    const qty         = parseInt(document.getElementById('modal-qty')?.value) || 0;
    const obs         = document.getElementById('modal-obs')?.value.trim();

    if (!mayoristaId) { showMessage('Selecciona un cliente', 'warning', 1500); return; }
    if (!op)          { showMessage('Escribe una OP', 'warning', 1500); return; }
    if (qty <= 0)     { showMessage('Ingresa una cantidad válida', 'warning', 1500); return; }

    const sispro = sisproMap.get(op);

    const pedido = {
        id:            `${mayoristaId}_${op}_${Date.now()}`,
        mayoristaId,
        nombreCliente: allConfigData?.[mayoristaId]?.nombreCorto || mayoristaId,
        op,
        referencia:    sispro?.REFERENCIA || '',
        prenda:        sispro?.PRENDA || '',
        genero:        sispro?.GENERO || '',
        cantidad:      qty,
        obs:           obs || '',
        fecha:         new Date().toLocaleDateString('es-CO'),
        estado:        'PENDIENTE'
    };

    document.querySelector('.modal-agregar-pedido')?.remove();
    agregarPedidoRealTime(pedido);
}

// ============================================
// MODAL EDITAR PEDIDO
// ============================================

function abrirModalEditarPedido(id) {
    const pedido = pedidosMap.find(p => p.id === id);
    if (!pedido) return;

    const mayoristas   = getMayoristasActivos();
    const optsClientes = mayoristas.map(([mid, c]) =>
        `<option value="${mid}" ${mid === pedido.mayoristaId ? 'selected' : ''}>${c.nombreCorto}</option>`
    ).join('');

    // Hint inicial
    const sispro = sisproMap.get(pedido.op);
    const hintInicial = sispro
        ? `<span class="orders-hint-found"><i class="codicon codicon-check"></i> OP encontrada</span>`
        : '';
    
    const detailsInicial = sispro ? `
        <div id="edit-op-details" class="orders-details-card" style="display:block;">
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
                        onkeydown="if(event.key==='Enter') document.getElementById('edit-qty').focus()">
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

function onEditOpChange(val) {
    const hint = document.getElementById('edit-op-hint');
    const details = document.getElementById('edit-op-details');
    const detailRef = document.getElementById('edit-detail-ref');
    const detailPrenda = document.getElementById('edit-detail-prenda');
    const detailGenero = document.getElementById('edit-detail-genero');
    
    if (!hint) return;
    const op = val.trim();
    
    if (!op) { 
        hint.innerHTML = ''; 
        if (details) details.style.display = 'none';
        return; 
    }
    
    const sispro = sisproMap.get(op);
    if (!sispro) {
        hint.innerHTML = `<span class="orders-hint-notfound">OP no encontrada en SISPROWEB</span>`;
        if (details) details.style.display = 'none';
        return;
    }
    
    hint.innerHTML = `<span class="orders-hint-found"><i class="codicon codicon-check"></i> OP encontrada</span>`;
    
    if (details) {
        if (!detailRef) {
            details.innerHTML = `
                <div class="orders-details-row">
                    <div class="orders-add-field">
                        <label>Referencia</label>
                        <input type="text" class="form-control" value="${sispro.REFERENCIA || ''}" readonly>
                    </div>
                    <div class="orders-add-field">
                        <label>Prenda</label>
                        <input type="text" class="form-control" value="${sispro.PRENDA || ''}" readonly>
                    </div>
                    <div class="orders-add-field">
                        <label>Género</label>
                        <input type="text" class="form-control" value="${sispro.GENERO || ''}" readonly>
                    </div>
                </div>`;
        } else {
            detailRef.value = sispro.REFERENCIA || '';
            detailPrenda.value = sispro.PRENDA || '';
            detailGenero.value = sispro.GENERO || '';
        }
        details.style.display = 'block';
    }
}

function guardarEdicionPedido(id) {
    const pedido = pedidosMap.find(p => p.id === id);
    if (!pedido) return;

    const mayoristaId = document.getElementById('edit-cliente')?.value;
    const op          = document.getElementById('edit-op')?.value.trim();
    const qty         = parseInt(document.getElementById('edit-qty')?.value) || 0;
    const obs         = document.getElementById('edit-obs')?.value.trim();

    if (!mayoristaId) { showMessage('Selecciona un cliente', 'warning', 1500); return; }
    if (!op)          { showMessage('Escribe una OP', 'warning', 1500); return; }
    if (qty <= 0)     { showMessage('Ingresa una cantidad válida', 'warning', 1500); return; }

    const sispro = sisproMap.get(op);

    const pedidoActualizado = {
        id:            pedido.id,
        mayoristaId,
        nombreCliente: allConfigData?.[mayoristaId]?.nombreCorto || mayoristaId,
        op,
        referencia:    sispro?.REFERENCIA || '',
        prenda:        sispro?.PRENDA || '',
        genero:        sispro?.GENERO || '',
        cantidad:      qty,
        obs:           obs || '',
        fecha:         pedido.fecha,
        estado:        'PENDIENTE'
    };

    document.querySelector('.modal-editar-pedido')?.remove();
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

async function eliminarFinalizado(id) {
    try {
        await eliminarFinalizadoDeSheets(id);
        await cargarFinalizadosDesdeSheets();
        renderOrdersBoard();
    } catch (err) {
        showMessage('Error eliminando finalizado: ' + err.message, 'error', 3000);
    }
}

function getMayoristasActivos() {
    return Object.entries(allConfigData || {})
        .filter(([, c]) => c.tipoCliente === 'Mayorista' && c.estado?.toUpperCase().trim() === 'ACTIVO')
        .sort((a, b) => a[1].nombreCorto.localeCompare(b[1].nombreCorto));
}

// ============================================
// MODAL EN DISTRIBUCIÓN
// ============================================

function aplicarPedidosDesdeModal(pedidos) {
    document.querySelector('.modal-pedidos-lote')?.remove();
    const alertas = [];
    let aplicados = 0;

    Object.entries(pedidos).forEach(([mayoristaId, cantidad]) => {
        const nombre = allConfigData?.[mayoristaId]?.nombreCorto || mayoristaId;
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

    const totalUds = Object.values(pedidos).reduce((a, b) => a + b, 0);
    const filas = Object.entries(pedidos).map(([mayoristaId, cantidad]) => {
        const nombre = allConfigData?.[mayoristaId]?.nombreCorto || mayoristaId;
        return `
            <div class="orders-modal-row">
                <span class="orders-modal-nombre">${nombre}</span>
                <span class="orders-modal-qty">${cantidad} uds</span>
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

async function marcarPedidosCompletados(lote) {
    if (!lote) return;
    const loteStr = String(lote);
    const completados = pedidosMap.filter(p => String(p.op) === loteStr);
    if (!completados.length) return;

    try {
        for (const pedido of completados) {
            pedido.fechaFin = new Date().toLocaleDateString('es-CO');
            await finalizarPedidoEnSheets(pedido);
        }
        await Promise.all([
            cargarPedidosDesdeSheets(),
            cargarFinalizadosDesdeSheets()
        ]);
        renderOrdersBoard();
    } catch (err) {
        showMessage('Error finalizando pedidos: ' + err.message, 'error', 3000);
    }
}

function getPedidosPendientesParaLote(lote) {
    const result = {};
    pedidosMap.forEach(p => {
        if (String(p.op) === String(lote)) {
            result[p.mayoristaId] = (result[p.mayoristaId] || 0) + p.cantidad;
        }
    });
    return result;
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
window.eliminarFinalizado           = eliminarFinalizado;
window.toggleFinalizados            = toggleFinalizados;
window.marcarPedidosCompletados     = marcarPedidosCompletados;
window.getPedidosPendientesParaLote = getPedidosPendientesParaLote;
window.mostrarModalPedidosParaLote  = mostrarModalPedidosParaLote;
window.aplicarPedidosDesdeModal     = aplicarPedidosDesdeModal;
