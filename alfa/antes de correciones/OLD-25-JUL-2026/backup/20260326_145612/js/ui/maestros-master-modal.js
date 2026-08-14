/**
 * js/ui/maestros-master-modal.js
 * Maestro de Maestros (Proveedores, Auditores, Gestores) - Diseño IDE Consistente
 */

let _maestrosCurrentPage = 1;
const MAESTROS_PER_PAGE = 5;

function openGenericMaestroModal(options) {
    const { title, icon, type } = options;
    openAdminTab(type.toLowerCase(), title, `codicon-${icon}`, (container) => renderMaestroUI(options, container));
}

function renderMaestroUI(options, container) {
    const { type, title, map } = options;
    if (!container) container = document.getElementById('adminTabEntryPoint');
    if (!container) return;

    container._options = options;

    container.innerHTML = `
        <div class="section-content">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px;">
                <div style="position: relative; flex: 1;">
                    <i class="codicon codicon-search" style="position: absolute; left: 12px; top: 11px; color: var(--text-secondary); z-index: 1;"></i>
                    <input type="text" id="maestroSearchTerm_${type}" oninput="filterMaestroTable('${type}')" 
                           placeholder="Filtrar por Identificador o Nombre..." 
                           class="form-control" style="padding-left: 36px; width: 100%;">
                </div>
            </div>

            <!-- Tabla IDE -->
            <div style="border: 1px solid var(--border); border-radius: 4px; background: var(--bg-dark); overflow: hidden;">
                <table class="data-table">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr>
                            <th style="width: 140px; text-align: left;">Identificador</th>
                            <th style="text-align: left;">Nombre Completo / Detalle</th>
                            <th style="width: 120px;">Estado</th>
                            <th style="width: 60px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="maestroTableBody_${type}">
                        <!-- Dinámico -->
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
                    <i class="codicon codicon-info"></i> Registros: ${map.size}
                </div>
                <div id="maestroPaginationControls_${type}" style="display:flex; gap: 8px; align-items: center;"></div>
            </div>
        </div>
    `;

    _maestrosCurrentPage = 1;
    const dynActions = document.getElementById('adminDynamicActions');
    if (dynActions) {
        dynActions.innerHTML = `
            <button class="btn-icon" id="saveMaestroBtn_${type}" style="display:none; color: var(--success);" onclick="persistMaestroChanges('${type}')" title="Guardar Cambios">
                <i class="codicon codicon-cloud-upload"></i>
            </button>
            <button class="btn-icon" onclick="toggleInactivesMaestro('${type}')" title="${showInactivesInModals ? 'Ocultar Inactivos' : 'Ver Inactivos'}">
                <i class="codicon ${showInactivesInModals ? 'codicon-eye' : 'codicon-eye-closed'}" style="color: ${showInactivesInModals ? 'var(--primary)' : 'var(--text-secondary)'}"></i>
            </button>
            <button class="btn-icon" onclick="openMaestroFormModal('${type}', null)" title="Nuevo ${type}">
                <i class="codicon codicon-add"></i>
            </button>
        `;
    }

    updateMaestroTable(type);
}


function filterMaestroTable(type) {
    _maestrosCurrentPage = 1;
    updateMaestroTable(type);
}

function toggleInactivesMaestro(type) {
    showInactivesInModals = !showInactivesInModals;
    const dynActions = document.getElementById('adminDynamicActions');
    if (dynActions) {
        dynActions.innerHTML = `
            <button class="btn-icon" id="saveMaestroBtn_${type}" style="${(pendingMaestroChanges[type] && pendingMaestroChanges[type].length > 0) ? 'display:flex;' : 'display:none;'} color: var(--success);" onclick="persistMaestroChanges('${type}')" title="Guardar Cambios">
                <i class="codicon codicon-cloud-upload"></i>
            </button>
            <button class="btn-icon" onclick="toggleInactivesMaestro('${type}')" title="${showInactivesInModals ? 'Ocultar Inactivos' : 'Ver Inactivos'}">
                <i class="codicon ${showInactivesInModals ? 'codicon-eye' : 'codicon-eye-closed'}" style="color: ${showInactivesInModals ? 'var(--primary)' : 'var(--text-secondary)'}"></i>
            </button>
            <button class="btn-icon" onclick="openMaestroFormModal('${type}', null)" title="Nuevo ${type}">
                <i class="codicon codicon-add"></i>
            </button>
        `;
    }
    updateMaestroTable(type);
}

let pendingMaestroChanges = {};

function updateMaestroTable(type) {
    const container = document.getElementById('adminTabEntryPoint');
    const tbody = document.getElementById(`maestroTableBody_${type}`);
    if (!container || !tbody) return;
    
    const { map } = container._options;
    const pending = pendingMaestroChanges[type] || [];
    
    const term = (document.getElementById(`maestroSearchTerm_${type}`)?.value || '').toLowerCase();

    const allEntries = new Map(map);
    pending.forEach(p => allEntries.set(p[0], { NOMBRE: p[1], ESTADO: p[2] }));

    const sorted = Array.from(allEntries.entries()).sort((a,b) => String(a[0]).localeCompare(String(b[0])));
    
    // Filtering
    const filtered = sorted.filter(([id, data]) => {
        const isActive = (typeof data === 'object' && data !== null) ? (data.ESTADO === 'TRUE') : true;
        if (!isActive && !showInactivesInModals) return false;

        const nombreActual = (typeof data === 'object' && data !== null) ? (data.NOMBRE || data.PROVEEDOR || data.AUDITOR || data.GESTOR || 'SIN NOMBRE') : (data || 'SIN NOMBRE');
        const contentStr = `${id} ${nombreActual}`.toLowerCase();
        
        return contentStr.includes(term);
    });

    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / MAESTROS_PER_PAGE) || 1;
    if (_maestrosCurrentPage > totalPages) _maestrosCurrentPage = totalPages;

    const startIdx = (_maestrosCurrentPage - 1) * MAESTROS_PER_PAGE;
    const paged = filtered.slice(startIdx, startIdx + MAESTROS_PER_PAGE);

    let html = '';
    paged.forEach(([id, data]) => {
        const isActive = (typeof data === 'object' && data !== null) ? (data.ESTADO === 'TRUE') : true;

        const isNew = !map.has(id);
        const mapEntry = map.has(id) ? map.get(id) : null;
        
        const nombreActual = (typeof data === 'object' && data !== null) ? (data.NOMBRE || data.PROVEEDOR || data.AUDITOR || data.GESTOR || 'SIN NOMBRE') : (data || 'SIN NOMBRE');
        const nombreOriginal = mapEntry ? (mapEntry.NOMBRE || mapEntry.PROVEEDOR || mapEntry.AUDITOR || mapEntry.GESTOR) : nombreActual;
        const hasNameChanged = !isNew && nombreOriginal !== nombreActual;
        const isPending = isNew || hasNameChanged || (mapEntry && mapEntry.ESTADO !== data.ESTADO);

        html += `
            <tr style="${!isActive ? 'opacity: 0.5;' : ''} ${isPending ? 'background: rgba(255, 140, 0, 0.03);' : ''}">
                <td style="color: var(--primary); font-weight: 700; text-align: left;">${id}</td>
                <td style="text-align: left; color: var(--text);">
                    ${nombreActual}
                </td>
                <td>
                    <span style="padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; border: 1px solid currentColor; color: ${isActive ? 'var(--success)' : 'var(--error)'}; background: ${isActive ? 'rgba(13,188,121,0.1)' : 'rgba(244,71,71,0.1)'}">
                        ${isActive ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                        ${isPending ? '<i class="codicon codicon-sync" style="color: var(--warning); font-size: 14px;" title="Pendiente de guardar"></i>' : ''}
                        <i class="codicon codicon-edit" style="cursor: pointer; color: var(--primary);" onclick="openMaestroFormModal('${type}', '${id}')" title="Editar"></i>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html || '<tr><td colspan="4" style="text-align:center; padding:40px; color:var(--text-muted);">Sin registros</td></tr>';
    
    // Render Controls
    const controls = document.getElementById(`maestroPaginationControls_${type}`);
    if (controls) {
        controls.innerHTML = `
            <button class="btn-secondary" onclick="changeMaestroPage('${type}', 1)" ${_maestrosCurrentPage === 1 ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-left" style="font-size:12px;"></i><i class="codicon codicon-chevron-left" style="font-size:12px; margin-left:-6px;"></i></button>
            <button class="btn-secondary" onclick="changeMaestroPage('${type}', ${_maestrosCurrentPage - 1})" ${_maestrosCurrentPage === 1 ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-left" style="font-size:12px;"></i></button>
            <span style="font-size: 11px; color: var(--text-secondary); margin: 0 4px;">Pág ${_maestrosCurrentPage} de ${totalPages}</span>
            <button class="btn-secondary" onclick="changeMaestroPage('${type}', ${_maestrosCurrentPage + 1})" ${_maestrosCurrentPage === totalPages ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-right" style="font-size:12px;"></i></button>
            <button class="btn-secondary" onclick="changeMaestroPage('${type}', ${totalPages})" ${_maestrosCurrentPage === totalPages ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-right" style="font-size:12px;"></i><i class="codicon codicon-chevron-right" style="font-size:12px; margin-left:-6px;"></i></button>
        `;
    }

    const saveBtn = document.getElementById(`saveMaestroBtn_${type}`);
    if (saveBtn) saveBtn.style.display = (pendingMaestroChanges[type] && pendingMaestroChanges[type].length > 0) ? 'flex' : 'none';
}

function changeMaestroPage(type, page) {
    _maestrosCurrentPage = page;
    updateMaestroTable(type);
}

function onMaestroNameChange(type, id, newValue) {
    const container = document.getElementById('adminTabEntryPoint');
    const { map } = container._options;
    
    let currentState = 'TRUE';
    if (map.has(id)) currentState = map.get(id).ESTADO || 'TRUE';
    if (!pendingMaestroChanges[type]) pendingMaestroChanges[type] = [];
    
    const idx = pendingMaestroChanges[type].findIndex(p => p[0] === id);
    if (idx !== -1) {
        pendingMaestroChanges[type][idx][1] = newValue.trim().toUpperCase();
    } else {
        pendingMaestroChanges[type].push([id, newValue.trim().toUpperCase(), currentState]);
    }
    updateMaestroTable(type);
}

function addMaestroEntryLocal(type) {
    const idInput = document.getElementById(`newMaestroID_${type}`);
    const nameInput = document.getElementById(`newMaestroNombre_${type}`);
    const id = idInput.value.trim().toUpperCase();
    const nombre = nameInput.value.trim().toUpperCase();

    if (!id || !nombre) {
        showMessage('ID y Nombre obligatorios', 'error');
        return;
    }

    if (!pendingMaestroChanges[type]) pendingMaestroChanges[type] = [];
    const idx = pendingMaestroChanges[type].findIndex(p => p[0] === id);
    if (idx !== -1) {
        pendingMaestroChanges[type][idx] = [id, nombre, 'TRUE'];
    } else {
        pendingMaestroChanges[type].push([id, nombre, 'TRUE']);
    }

    idInput.value = '';
    nameInput.value = '';
    updateMaestroTable(type);
}

async function toggleMaestroStateLocal(type, id) {
    const container = document.getElementById('adminTabEntryPoint');
    const { map, saveFn, loadFn } = container._options;
    
    if (pendingMaestroChanges[type] && pendingMaestroChanges[type].some(p => p[0] === id)) {
        const pIdx = pendingMaestroChanges[type].findIndex(p => p[0] === id);
        pendingMaestroChanges[type][pIdx][2] = pendingMaestroChanges[type][pIdx][2] === 'TRUE' ? 'FALSE' : 'TRUE';
        updateMaestroTable(type);
        return;
    }

    if (!map.has(id)) return;
    const entry = map.get(id);
    const nombre = entry.NOMBRE || entry.PROVEEDOR || entry.AUDITOR || entry.GESTOR;
    const newState = entry.ESTADO === 'TRUE' ? 'FALSE' : 'TRUE';
    
    const loading = showQuickLoading(`Actualizando...`);
    try {
        await saveFn([[id, nombre, newState]]);
        await loadFn();
        updateMaestroTable(type);
        showMessage('Listo', 'success');
    } catch (err) {
        showMessage(err.message, 'error');
    } finally { loading.close(); }
}

async function removeMaestroEntryLocal(type, id) {
    if (pendingMaestroChanges[type]) {
        const idx = pendingMaestroChanges[type].findIndex(p => p[0] === id);
        if (idx !== -1) {
            pendingMaestroChanges[type].splice(idx, 1);
            updateMaestroTable(type);
            return;
        }
    }

    const container = document.getElementById('adminTabEntryPoint');
    const { map, loadFn, deleteAction } = container._options;
    if (map.has(id)) {
        const pass = prompt('Pass:');
        if (pass !== 'One654321') {
            if (pass !== null) showMessage('Error', 'error');
            return;
        }

        const loading = showQuickLoading(`Borrando...`);
        try {
            const formData = new URLSearchParams();
            formData.append('action', deleteAction);
            formData.append('datos', JSON.stringify({ id: id }));
            formData.append('password', pass);
            const response = await fetch(SISPROWEB_GAS_URL, { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success) {
                await loadFn();
                updateMaestroTable(type);
                showMessage('Eliminado', 'success');
            } else { throw new Error(result.message); }
        } catch (err) {
            showMessage(err.message, 'error');
        } finally { loading.close(); }
    }
}

async function persistMaestroChanges(type) {
    const pending = pendingMaestroChanges[type];
    if (!pending || pending.length === 0) return;
    const container = document.getElementById('adminTabEntryPoint');
    const { saveFn, loadFn } = container._options;
    
    const btn = document.getElementById(`saveMaestroBtn_${type}`);
    btn.disabled = true;
    btn.innerHTML = 'Guardando...';

    try {
        await saveFn(pending);
        await loadFn();
        pendingMaestroChanges[type] = [];
        updateMaestroTable(type);
        showMessage('Maestro actualizado', 'success');
    } catch (err) {
        showMessage(err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = 'Reintentar';
    }
}

let _maestroEditId = null;
let _maestroEditType = null;

function _buildMaestroFormModal() {
    let overlay = document.getElementById('maestroFormOverlay');
    if (overlay) document.body.removeChild(overlay);

    overlay = document.createElement('div');
    overlay.id = 'maestroFormOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9000;display:flex;align-items:center;justify-content:center;';

    overlay.innerHTML = `
        <div style="background:var(--sidebar); border:1px solid var(--border); border-radius:6px; width:450px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.5); font-family:'Segoe UI', sans-serif;">
            <div style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:8px;">
                    <i class="codicon codicon-book" style="color:var(--primary);"></i>
                    <h3 id="mf_title" style="margin:0; font-size:13px; font-weight:600; color:var(--text);">Editar Maestro</h3>
                </div>
                <i class="codicon codicon-close" style="cursor:pointer; color:var(--text-muted);" onclick="closeMaestroFormModal()"></i>
            </div>
            <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">ID</label>
                    <input type="text" id="mf_id" class="form-control" style="background:var(--editor); font-family:monospace; text-transform:uppercase;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">NOMBRE / DESCRIPCIÓN</label>
                    <input type="text" id="mf_nombre" class="form-control" style="background:var(--editor); text-transform:uppercase;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">ESTADO</label>
                    <select id="mf_estado" class="form-control" style="background:var(--editor);">
                        <option value="TRUE">ACTIVO</option>
                        <option value="FALSE">INACTIVO</option>
                    </select>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                <div id="mf_deleteZone"></div>
                <div style="display:flex;gap:8px;">
                    <button class="btn-secondary" onclick="closeMaestroFormModal()">Cancelar</button>
                    <button class="btn-primary" onclick="saveMaestroFromForm()">
                        <i class="codicon codicon-save"></i> Guardar
                    </button>
                </div>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeMaestroFormModal(); });
    document.body.appendChild(overlay);
    return overlay;
}

function closeMaestroFormModal() {
    const overlay = document.getElementById('maestroFormOverlay');
    if (overlay) document.body.removeChild(overlay);
}

function openMaestroFormModal(type, id) {
    _maestroEditId = id;
    _maestroEditType = type;
    const container = document.getElementById('adminTabEntryPoint');
    const { map } = container._options;
    
    _buildMaestroFormModal();
    const title = document.getElementById('mf_title');
    const deleteZone = document.getElementById('mf_deleteZone');

    let estado = 'TRUE';
    let originalName = '';
    
    if (id && map.has(id)) {
        const data = map.get(id);
        originalName = data.NOMBRE || data.PROVEEDOR || data.AUDITOR || data.GESTOR || '';
        estado = data.ESTADO || 'TRUE';
    }
    
    const pending = pendingMaestroChanges[type] ? pendingMaestroChanges[type].find(c => c[0] === id) : null;
    title.textContent = id ? `Editar ${type} — ${id}` : `Nuevo ${type}`;
    document.getElementById('mf_id').value = id || '';
    document.getElementById('mf_id').disabled = !!id;
    document.getElementById('mf_nombre').value = pending ? pending[1] : originalName;
    document.getElementById('mf_estado').value = pending ? pending[2] : estado;

    if (id) {
        deleteZone.innerHTML = `
            <button class="btn-secondary" onclick="removeMaestroEntryLocal('${type}', '${id}'); closeMaestroFormModal()" 
                    style="color:var(--error);border-color:var(--error);background:rgba(244,71,71,0.08);">
                <i class="codicon codicon-trash"></i> Eliminar
            </button>
        `;
    } else {
        deleteZone.innerHTML = '';
    }
}

function saveMaestroFromForm() {
    const id = document.getElementById('mf_id').value.trim().toUpperCase();
    const nombre = document.getElementById('mf_nombre').value.trim().toUpperCase();
    const estado = document.getElementById('mf_estado').value;
    const type = _maestroEditType;

    if (!id || !nombre) {
        showMessage('ID y Nombre obligatorios', 'error');
        return;
    }

    if (!pendingMaestroChanges[type]) pendingMaestroChanges[type] = [];
    const idx = pendingMaestroChanges[type].findIndex(c => c[0] === id);
    if (idx !== -1) {
        pendingMaestroChanges[type][idx][1] = nombre;
        pendingMaestroChanges[type][idx][2] = estado;
    } else {
        pendingMaestroChanges[type].push([id, nombre, estado]);
    }

    closeMaestroFormModal();
    updateMaestroTable(type);
}

// Entry points
window.showProveedoresModal = () => openGenericMaestroModal({
    type: 'PROVEEDOR', title: 'Proveedores', icon: 'briefcase',
    map: proveedoresMap, saveFn: saveNewProveedorData, loadFn: loadProveedoresData,
    deleteAction: 'deleteProveedor'
});

window.showAuditoresModal = () => openGenericMaestroModal({
    type: 'AUDITOR', title: 'Auditores', icon: 'check-all',
    map: auditoresMap, saveFn: saveNewAuditorData, loadFn: loadAuditoresData,
    deleteAction: 'deleteAuditor'
});

window.showGestoresModal = () => openGenericMaestroModal({
    type: 'GESTOR', title: 'Gestores', icon: 'account',
    map: gestoresMap, saveFn: saveNewGestorData, loadFn: loadGestoresData,
    deleteAction: 'deleteGestor'
});

window.openMaestroFormModal = openMaestroFormModal;
window.closeMaestroFormModal = closeMaestroFormModal;
window.saveMaestroFromForm = saveMaestroFromForm;
window.filterMaestroTable = filterMaestroTable;
window.changeMaestroPage = changeMaestroPage;
