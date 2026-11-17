/**
 * js/ui/usuarios-modal.js
 * Maestro de Usuarios / Escáneres - Diseño IDE Consistente
 */

let _usuariosCurrentPage = 1;
const USUARIOS_PER_PAGE = 5;

function showUsuariosModal() {
    openAdminTab('usuarios', 'Usuarios', 'codicon-person', renderUsuariosUI);
}

function renderUsuariosUI(container) {
    if (!container) container = document.getElementById('adminTabEntryPoint');
    if (!container) return;

    container.innerHTML = `
        <div class="section-content">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px;">
                <div style="position: relative; flex: 1;">
                    <i class="codicon codicon-search" style="position: absolute; left: 12px; top: 11px; color: var(--text-secondary); z-index: 1;"></i>
                    <input type="text" id="usuarioSearchTerm" oninput="filterUsuariosTable(this.value)" 
                           placeholder="Filtrar por Cód. o Ubicación..." 
                           class="form-control" style="padding-left: 36px; width: 100%;">
                </div>
            </div>

            <!-- Tabla IDE -->
            <div style="border: 1px solid var(--border); border-radius: 4px; background: var(--bg-dark); overflow: hidden;">
                <table class="data-table">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr>
                            <th style="width: 140px; text-align: left;">Cód. Escáner</th>
                            <th style="text-align: left;">Asignado a / Ubicación</th>
                            <th style="width: 120px;">Estado</th>
                            <th style="width: 60px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="usuariosTableBody">
                        <!-- Dinámico -->
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
                    <i class="codicon codicon-info"></i> Registrados: ${escanersMap.size}
                </div>
                <div id="usuariosPaginationControls" style="display:flex; gap: 8px; align-items: center;"></div>
            </div>
        </div>
    `;

    _usuariosCurrentPage = 1;
    const dynActions = document.getElementById('adminDynamicActions');
    if (dynActions) {
        dynActions.innerHTML = `
            <button class="btn-icon" onclick="toggleInactivesUsuarios(this)" title="${showInactivesInModals ? 'Ocultar Inactivos' : 'Ver Inactivos'}">
                <i class="codicon ${showInactivesInModals ? 'codicon-eye' : 'codicon-eye-closed'}" style="color: ${showInactivesInModals ? 'var(--primary)' : 'var(--text-secondary)'}"></i>
            </button>
            <button class="btn-icon" onclick="openUsuarioFormModal(null)" title="Nuevo Usuario">
                <i class="codicon codicon-add"></i>
            </button>
        `;
    }

    updateUsuariosTable();
}

function toggleInactivesUsuarios() {
    showInactivesInModals = !showInactivesInModals;
    const dynActions = document.getElementById('adminDynamicActions');
    if (dynActions) {
        dynActions.innerHTML = `
            <button class="btn-icon" onclick="toggleInactivesUsuarios(this)" title="${showInactivesInModals ? 'Ocultar Inactivos' : 'Ver Inactivos'}">
                <i class="codicon ${showInactivesInModals ? 'codicon-eye' : 'codicon-eye-closed'}" style="color: ${showInactivesInModals ? 'var(--primary)' : 'var(--text-secondary)'}"></i>
            </button>
            <button class="btn-icon" onclick="openUsuarioFormModal(null)" title="Nuevo Usuario">
                <i class="codicon codicon-add"></i>
            </button>
        `;
    }
    updateUsuariosTable();
}

function filterUsuariosTable(val) {
    _usuariosCurrentPage = 1;
    updateUsuariosTable();
}

let pendingUsuarioChanges = [];

function updateUsuariosTable() {
    const tbody = document.getElementById('usuariosTableBody');
    if (!tbody) return;

    const term = (document.getElementById('usuarioSearchTerm')?.value || '').toLowerCase();

    const sorted = Array.from(escanersMap.entries()).sort((a,b) => String(a[0]).localeCompare(String(b[0])));
    
    // Filtering
    const filtered = sorted.filter(([id, data]) => {
        const isActive = (typeof data === 'object' && data !== null) ? (data.ESTADO === 'TRUE') : true;
        if (!isActive && !showInactivesInModals) return false;

        const nameActual = (typeof data === 'object' && data !== null) ? (data.NOMBRE || 'SIN NOMBRE') : (data || 'SIN NOMBRE');
        const contentStr = `${id} ${nameActual}`.toLowerCase();
        
        return contentStr.includes(term);
    });

    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / USUARIOS_PER_PAGE) || 1;
    if (_usuariosCurrentPage > totalPages) _usuariosCurrentPage = totalPages;

    const startIdx = (_usuariosCurrentPage - 1) * USUARIOS_PER_PAGE;
    const paged = filtered.slice(startIdx, startIdx + USUARIOS_PER_PAGE);

    let html = '';
    paged.forEach(([id, data]) => {
        const isActive = (typeof data === 'object' && data !== null) ? (data.ESTADO === 'TRUE') : true;
        const nameActual = (typeof data === 'object' && data !== null) ? (data.NOMBRE || 'SIN NOMBRE') : (data || 'SIN NOMBRE');

        html += `
            <tr style="${!isActive ? 'opacity: 0.5;' : ''}">
                <td style="color: var(--warning); font-weight: 700; text-align: left;">${id}</td>
                <td style="text-align: left; color: var(--text);">
                    ${nameActual}
                </td>
                <td>
                    <span style="padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; border: 1px solid currentColor; color: ${isActive ? 'var(--success)' : 'var(--error)'}; background: ${isActive ? 'rgba(13,188,121,0.1)' : 'rgba(244,71,71,0.1)'}">
                        ${isActive ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px; justify-content: center; align-items: center;">
                        <i class="codicon codicon-edit" style="cursor: pointer; color: var(--primary);" onclick="openUsuarioFormModal('${id}')" title="Editar"></i>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html || '<tr><td colspan="4" style="text-align:center; padding:40px; color:var(--text-muted);">Sin registros</td></tr>';
    
    // Render Controls
    const controls = document.getElementById('usuariosPaginationControls');
    if (controls) {
        controls.innerHTML = `
            <button class="btn-secondary" onclick="changeUsuariosPage(1)" ${_usuariosCurrentPage === 1 ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-left" style="font-size:12px;"></i><i class="codicon codicon-chevron-left" style="font-size:12px; margin-left:-6px;"></i></button>
            <button class="btn-secondary" onclick="changeUsuariosPage(${_usuariosCurrentPage - 1})" ${_usuariosCurrentPage === 1 ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-left" style="font-size:12px;"></i></button>
            <span style="font-size: 11px; color: var(--text-secondary); margin: 0 4px;">Pág ${_usuariosCurrentPage} de ${totalPages}</span>
            <button class="btn-secondary" onclick="changeUsuariosPage(${_usuariosCurrentPage + 1})" ${_usuariosCurrentPage === totalPages ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-right" style="font-size:12px;"></i></button>
            <button class="btn-secondary" onclick="changeUsuariosPage(${totalPages})" ${_usuariosCurrentPage === totalPages ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-right" style="font-size:12px;"></i><i class="codicon codicon-chevron-right" style="font-size:12px; margin-left:-6px;"></i></button>
        `;
    }
}

function changeUsuariosPage(page) {
    _usuariosCurrentPage = page;
    updateUsuariosTable();
}

function onUsuarioNameChange(id, newValue) {
    let currentState = 'TRUE';
    if (escanersMap.has(id)) currentState = escanersMap.get(id).ESTADO || 'TRUE';

    const idx = pendingUsuarioChanges.findIndex(u => u.id === id);
    if (idx !== -1) {
        pendingUsuarioChanges[idx].nombre = newValue.trim().toUpperCase();
    } else {
        pendingUsuarioChanges.push({ id, nombre: newValue.trim().toUpperCase(), estado: currentState });
    }
    updateUsuariosTable();
}

async function removeUsuarioLocal(id) {
    const pendingIdx = pendingUsuarioChanges.findIndex(u => u.id === id);
    if (pendingIdx !== -1) {
        pendingUsuarioChanges.splice(pendingIdx, 1);
        updateUsuariosTable();
        return;
    }

    if (escanersMap.has(id)) {
        const pass = prompt('Admin Pass:');
        if (pass !== 'One654321') {
            if (pass !== null) showMessage('Error', 'error');
            return;
        }

        const loading = showQuickLoading(`Eliminando ${id}...`);
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'deleteUsuario');
            formData.append('datos', JSON.stringify({ id: id }));
            formData.append('password', pass);
            const response = await fetch(SISPROWEB_GAS_URL, { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success) {
                await loadUsuariosData();
                updateUsuariosTable();
                showMessage('Eliminado', 'success');
            } else { throw new Error(result.message); }
        } catch (err) {
            showMessage(err.message, 'error');
        } finally { loading.close(); }
    }
}

async function persistUsuariosChanges() {
    if (pendingUsuarioChanges.length === 0) return;
    const btn = document.getElementById('saveUsuariosBtn');
    if (!btn) return;
    
    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="codicon codicon-loading codicon-modifier-spin"></i>';

    try {
        const dataToSave = pendingUsuarioChanges.map(u => [u.id, u.nombre, u.estado || 'TRUE']);
        await saveNewUsuarioData(dataToSave);
        
        // Recargar datos desde Supabase
        await loadUsuariosData();
        
        // Limpiar cambios pendientes
        pendingUsuarioChanges = [];
        
        // Actualizar tabla
        updateUsuariosTable();
        
        // Restaurar botón
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        
        showMessage('Usuarios sincronizados', 'success');
    } catch (err) {
        showMessage(err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="codicon codicon-cloud-upload"></i>';
    }
}

let _usuarioEditId = null;

function _buildUsuarioFormModal() {
    let overlay = document.getElementById('usuarioFormOverlay');
    if (overlay) document.body.removeChild(overlay);

    overlay = document.createElement('div');
    overlay.id = 'usuarioFormOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9000;display:flex;align-items:center;justify-content:center;';

    overlay.innerHTML = `
        <div style="background:var(--editor); border:1px solid var(--border); border-radius:6px; width:450px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.5); font-family:'Segoe UI', sans-serif;">
            <div style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:8px;">
                    <i class="codicon codicon-person" style="color:var(--primary);"></i>
                    <h3 id="uf_title" style="margin:0; font-size:13px; font-weight:600; color:var(--text);">Editar Usuario</h3>
                </div>
                <i class="codicon codicon-close" style="cursor:pointer; color:var(--text-muted);" onclick="closeUsuarioFormModal()"></i>
            </div>
            <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">ID ESCÁNER</label>
                    <input type="text" id="uf_id" class="form-control" style="background:var(--editor); font-family:monospace; text-transform:uppercase;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">NOMBRE / UBICACIÓN</label>
                    <input type="text" id="uf_nombre" class="form-control" style="background:var(--editor); text-transform:uppercase;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">ESTADO</label>
                    <select id="uf_estado" class="form-control" style="background:var(--editor);">
                        <option value="TRUE">ACTIVO</option>
                        <option value="FALSE">INACTIVO</option>
                    </select>
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                <div id="uf_deleteZone"></div>
                <div style="display:flex;gap:8px;">
                    <button class="btn-secondary" onclick="closeUsuarioFormModal()">Cancelar</button>
                    <button class="btn-primary" onclick="saveUsuarioFromForm()">
                        <i class="codicon codicon-save"></i> Guardar
                    </button>
                </div>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeUsuarioFormModal(); });
    document.body.appendChild(overlay);
    return overlay;
}

function closeUsuarioFormModal() {
    const overlay = document.getElementById('usuarioFormOverlay');
    if (overlay) document.body.removeChild(overlay);
}

function openUsuarioFormModal(id) {
    _usuarioEditId = id;
    _buildUsuarioFormModal();
    const title = document.getElementById('uf_title');
    const deleteZone = document.getElementById('uf_deleteZone');

    let estado = 'TRUE';
    let originalName = '';
    
    if (id && escanersMap.has(id)) {
        const data = escanersMap.get(id);
        originalName = data.NOMBRE;
        estado = data.ESTADO || 'TRUE';
    }
    
    const pending = pendingUsuarioChanges.find(u => u.id === id);
    title.textContent = id ? `Editar Usuario — ${id}` : 'Nuevo Usuario';
    document.getElementById('uf_id').value = id || '';
    document.getElementById('uf_id').disabled = !!id;
    document.getElementById('uf_nombre').value = pending ? pending.nombre : originalName;
    document.getElementById('uf_estado').value = pending ? pending.estado : estado;

    if (id) {
        deleteZone.innerHTML = `
            <button class="btn-secondary" onclick="removeUsuarioLocal('${id}'); closeUsuarioFormModal()" 
                    style="color:var(--error);border-color:var(--error);background:rgba(244,71,71,0.08);">
                <i class="codicon codicon-trash"></i> Eliminar
            </button>
        `;
    } else {
        deleteZone.innerHTML = '';
    }
}

async function saveUsuarioFromForm() {
    const id = document.getElementById('uf_id').value.trim().toUpperCase();
    const nombre = document.getElementById('uf_nombre').value.trim().toUpperCase();
    const estado = document.getElementById('uf_estado').value;

    if (!id || !nombre) {
        showMessage('ID y Nombre obligatorios', 'error');
        return;
    }

    // Guardar inmediatamente en Supabase
    try {
        const dataToSave = [[id, nombre, estado]];
        await saveNewUsuarioData(dataToSave);
        
        // Recargar datos desde Supabase
        await loadUsuariosData();
        
        // Cerrar modal
        closeUsuarioFormModal();
        
        // Actualizar tabla
        updateUsuariosTable();
        
        showMessage('Usuario guardado', 'success');
    } catch (err) {
        showMessage(err.message, 'error');
    }
}

// Exports
window.showUsuariosModal = showUsuariosModal;
window.removeUsuarioLocal = removeUsuarioLocal;
window.persistUsuariosChanges = persistUsuariosChanges;
window.toggleInactivesUsuarios = toggleInactivesUsuarios;
window.filterUsuariosTable = filterUsuariosTable;
window.changeUsuariosPage = changeUsuariosPage;
window.openUsuarioFormModal = openUsuarioFormModal;
window.closeUsuarioFormModal = closeUsuarioFormModal;
window.saveUsuarioFromForm = saveUsuarioFromForm;
