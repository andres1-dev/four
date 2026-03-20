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
    renderOrdersBoard();
    await Promise.all([
        cargarPedidosDesdeSheets(),
        cargarFinalizadosDesdeSheets()
    ]);
}

// ============================================
// PERSISTENCIA
// ============================================

async function cargarPedidosDesdeSheets() {
    try {
        const raw = await loadPedidosData();
        const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
        pedidosMap = Array.isArray(parsed) ? parsed : [];
        renderOrdersBoard();
    } catch (err) { console.warn('No se pudieron cargar pedidos:', err.message); }
}

async function cargarFinalizadosDesdeSheets() {
    try {
        const raw = await loadFinalizadosData();
        const parsed = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
        finalizadosMap = Array.isArray(parsed) ? parsed : [];
    } catch (err) { console.warn('No se pudieron cargar finalizados:', err.message); }
}

async function persistirPedidos() {
    if (pedidosSaving) return;
    pedidosSaving = true;
    try {
        await Promise.all([
            savePedidosData(pedidosMap),
            saveFinalizadosData(finalizadosMap)
        ]);
    } catch (err) {
        showMessage('Error guardando pedidos: ' + err.message, 'error', 3000);
    } finally {
        pedidosSaving = false;
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
                <label>Cliente</label>
                <select id="modal-cliente" class="form-control">
                    <option value="">Selecciona un mayorista...</option>
                    ${optsClientes}
                </select>
            </div>
            <div class="orders-add-row">
                <div class="orders-add-field">
                    <label>OP</label>
                    <input type="text" id="modal-op" class="form-control" placeholder="ej: 2425"
                        oninput="onModalOpChange(this.value)"
                        onkeydown="if(event.key==='Enter') document.getElementById('modal-qty').focus()">
                </div>
                <div class="orders-add-field orders-add-field-sm">
                    <label>Cantidad</label>
                    <input type="number" id="modal-qty" class="form-control" placeholder="0" min="1"
                        onkeydown="if(event.key==='Enter') confirmarPedidoModal()">
                </div>
            </div>
            <div id="modal-op-hint" class="orders-hint-row" style="min-height:20px;"></div>
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
    if (!hint) return;
    const op = val.trim();
    if (!op) { hint.innerHTML = ''; return; }
    const sispro = sisproMap.get(op);
    if (!sispro) {
        hint.innerHTML = `<span class="orders-hint-notfound">OP no encontrada en SISPROWEB</span>`;
        return;
    }
    hint.innerHTML = `<span class="orders-hint-ref">${sispro.REFERENCIA || '—'}</span>${sispro.PRENDA ? `<span class="orders-hint-prenda">${sispro.PRENDA}</span>` : ''}${sispro.GENERO ? `<span class="orders-hint-prenda">${sispro.GENERO}</span>` : ''}`;
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
    if (!sispro)  { showMessage(`OP ${op} no encontrada en SISPROWEB`, 'error', 2000); return; }

    const existente = pedidosMap.find(p => p.mayoristaId === mayoristaId && p.op === op);
    if (existente) {
        existente.cantidad += qty;
        if (obs) existente.obs = obs;
    } else {
        pedidosMap.push({
            id:            `${mayoristaId}_${op}_${Date.now()}`,
            mayoristaId,
            nombreCliente: allConfigData?.[mayoristaId]?.nombreCorto || mayoristaId,
            op,
            referencia:    sispro.REFERENCIA || '',
            prenda:        sispro.PRENDA || '',
            genero:        sispro.GENERO || '',
            cantidad:      qty,
            obs:           obs || '',
            fecha:         new Date().toLocaleDateString('es-CO')
        });
    }

    document.querySelector('.modal-agregar-pedido')?.remove();
    renderOrdersBoard();
    persistirPedidos();
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
        ? `<span class="orders-hint-ref">${sispro.REFERENCIA || '—'}</span><span class="orders-hint-prenda">${sispro.PRENDA || ''}</span>${sispro.GENERO ? `<span class="orders-hint-prenda">${sispro.GENERO}</span>` : ''}`
        : '';

    const modal = createModal(
        '<i class="codicon codicon-edit" style="color:var(--primary)"></i> Editar Pedido',
        `<div class="orders-add-form">
            <div class="orders-add-field">
                <label>Cliente</label>
                <select id="edit-cliente" class="form-control">
                    ${optsClientes}
                </select>
            </div>
            <div class="orders-add-row">
                <div class="orders-add-field">
                    <label>OP</label>
                    <input type="text" id="edit-op" class="form-control" value="${pedido.op}"
                        oninput="onEditOpChange(this.value)"
                        onkeydown="if(event.key==='Enter') document.getElementById('edit-qty').focus()">
                </div>
                <div class="orders-add-field orders-add-field-sm">
                    <label>Cantidad</label>
                    <input type="number" id="edit-qty" class="form-control" value="${pedido.cantidad}" min="1"
                        onkeydown="if(event.key==='Enter') guardarEdicionPedido('${id}')">
                </div>
            </div>
            <div id="edit-op-hint" class="orders-hint-row" style="min-height:20px;">${hintInicial}</div>
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
    if (!hint) return;
    const op = val.trim();
    if (!op) { hint.innerHTML = ''; return; }
    const sispro = sisproMap.get(op);
    if (!sispro) {
        hint.innerHTML = `<span class="orders-hint-notfound">OP no encontrada en SISPROWEB</span>`;
        return;
    }
    hint.innerHTML = `<span class="orders-hint-ref">${sispro.REFERENCIA || '—'}</span>${sispro.PRENDA ? `<span class="orders-hint-prenda">${sispro.PRENDA}</span>` : ''}${sispro.GENERO ? `<span class="orders-hint-prenda">${sispro.GENERO}</span>` : ''}`;
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
    if (!sispro)  { showMessage(`OP ${op} no encontrada en SISPROWEB`, 'error', 2000); return; }

    pedido.mayoristaId    = mayoristaId;
    pedido.nombreCliente  = allConfigData?.[mayoristaId]?.nombreCorto || mayoristaId;
    pedido.op             = op;
    pedido.referencia  = sispro.REFERENCIA || '';
    pedido.prenda      = sispro.PRENDA || '';
    pedido.genero      = sispro.GENERO || '';
    pedido.cantidad    = qty;
    pedido.obs         = obs || '';

    document.querySelector('.modal-editar-pedido')?.remove();
    renderOrdersBoard();
    persistirPedidos();
    showMessage('Pedido actualizado', 'success', 1500);
}

// ============================================
// CRUD
// ============================================

function eliminarPedido(id) {
    pedidosMap = pedidosMap.filter(p => p.id !== id);
    renderOrdersBoard();
    persistirPedidos();
}

function eliminarFinalizado(id) {
    finalizadosMap = finalizadosMap.filter(p => p.id !== id);
    renderOrdersBoard();
    persistirPedidos();
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

function marcarPedidosCompletados(lote) {
    if (!lote) return;
    const loteStr    = String(lote);
    const completados = pedidosMap.filter(p => String(p.op) === loteStr);
    if (!completados.length) return;

    pedidosMap = pedidosMap.filter(p => String(p.op) !== loteStr);
    completados.forEach(p => {
        if (!finalizadosMap.find(f => f.id === p.id)) {
            finalizadosMap.unshift({ ...p, fechaFin: new Date().toLocaleDateString('es-CO') });
        }
    });

    renderOrdersBoard();
    persistirPedidos();
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
