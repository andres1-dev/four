/**
 * js/ui/usuarios-modal.js
 * Modal para gestionar Usuarios / Escáneres
 */

function showUsuariosModal() {
    const existing = document.querySelector('.modal-usuarios-mgmt');
    if (existing) { existing.remove(); return; }

    const modal = createModal(
        `<i class="codicon codicon-person"></i> Gestión de Dispositivos & Usuarios`,
        `<div id="usuariosMgmtContent"></div>`,
        true
    );
    modal.classList.add('modal-usuarios-mgmt');
    
    // Centrado perfecto
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
    const content = modal.querySelector('.modal-content');
    if (content) {
        content.style.width = '700px';
        content.style.maxWidth = '90vw';
        content.style.padding = '0';
    }

    renderUsuariosUI();
}

function renderUsuariosUI() {
    const container = document.getElementById('usuariosMgmtContent');
    if (!container) return;

    container.innerHTML = `
        <div class="mgmt-container">
            <div style="text-align: center; margin-bottom: 24px;">
                <div class="alert-icon" style="margin: 0 auto 16px; background: var(--warning-dim); border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
                    <i class="codicon codicon-device-mobile" style="font-size: 32px; color: var(--warning);"></i>
                </div>
                <h2 style="margin: 0; color: var(--text); font-size: 18px; font-weight: 600;">Usuarios & Escáneres</h2>
                <p style="color: var(--text-secondary); font-size: 13px; margin-top: 8px;">
                    Gestiona los dispositivos autorizados para el escaneo de OPs.
                </p>
            </div>

            <!-- Formulario de adición rápida -->
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <div style="display: grid; grid-template-columns: 1fr 2fr auto; gap: 12px; align-items: end;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; margin-bottom: 6px;">ID Usuario</label>
                        <input type="text" id="newUsuarioID" class="form-control" placeholder="Ej: ESC01" style="text-transform: uppercase;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; margin-bottom: 6px;">Nombre / Ubicación</label>
                        <input type="text" id="newUsuarioNombre" class="form-control" placeholder="Ej: JUAN PEREZ - ZONA A">
                    </div>
                    <button class="btn-primary" onclick="addNewUsuarioLocal()" style="height: 36px; padding: 0 16px;">
                        <i class="codicon codicon-add"></i> Registrar
                    </button>
                </div>
            </div>

            <!-- Dashboard de Resumen -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
                <div class="stat-card-tiny">
                    <span class="lbl">Registrados:</span>
                    <span class="val">${escanersMap.size}</span>
                </div>
                <div class="stat-card-tiny" style="border-color: var(--success);">
                    <span class="lbl">Usuarios Activos:</span>
                    <span class="val" style="color: var(--success);">${Array.from(escanersMap.values()).filter(u => u.ESTADO === 'TRUE').length}</span>
                </div>
            </div>

            <!-- Filtro de Inactivos -->
            <div style="margin-bottom: 12px; display: flex; justify-content: flex-end;">
                <button class="btn-secondary" onclick="toggleInactivesUsuarios(this)" title="Mostrar/Ocultar Inactivos" style="width: 38px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px;">
                    <i class="codicon ${showInactivesInModals ? 'codicon-eye' : 'codicon-eye-closed'}" style="color: ${showInactivesInModals ? 'var(--primary)' : 'var(--text-muted)'}"></i>
                </button>
            </div>

            <div id="usuariosTableContainer" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-dark);">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead style="position: sticky; top: 0; background: var(--surface); z-index: 10;">
                        <tr>
                            <th style="padding: 10px 14px; text-align: left; color: var(--text-secondary); border-bottom: 2px solid var(--border);">Cód. Escáner</th>
                            <th style="padding: 10px 14px; text-align: left; color: var(--text-secondary); border-bottom: 2px solid var(--border);">Asignado a</th>
                            <th style="padding: 10px 14px; text-align: center; color: var(--text-secondary); border-bottom: 2px solid var(--border); width: 80px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="usuariosTableBody">
                        <!-- Dinámico -->
                    </tbody>
                </table>
            </div>

            <div class="modal-footer" style="margin-top:24px; border-top:1px solid var(--border); padding-top:20px; display:flex; justify-content:flex-end;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()" style="padding: 8px 16px;">Cerrar Gestión</button>
                <button class="btn-primary" id="saveUsuariosBtn" style="display:none; padding: 8px 20px; background: var(--success); border-color: var(--success);" onclick="persistUsuariosChanges()">
                    <i class="codicon codicon-save" style="margin-right: 6px;"></i> Guardar en Servidor
                </button>
            </div>
        </div>

        <style>
            .stat-card-tiny { 
                background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 16px;
                display: flex; justify-content: space-between; align-items: center;
            }
            .stat-card-tiny .lbl { font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; }
            .stat-card-tiny .val { font-size: 16px; font-weight: 700; font-family: 'Cascadia Code', monospace; }

            #usuariosTableBody tr { border-bottom: 1px solid var(--border); transition: all 0.1s; }
            #usuariosTableBody tr:hover { background: var(--surface); }
            #usuariosTableBody td { padding: 8px 14px; color: var(--text); }
            #usuariosTableBody tr.is-inactive { opacity: 0.6; background: rgba(244, 71, 71, 0.03); }
        </style>
    `;

    updateUsuariosTable();
}

function toggleInactivesUsuarios(btn) {
    showInactivesInModals = !showInactivesInModals;
    const icon = btn.querySelector('i');
    icon.className = `codicon ${showInactivesInModals ? 'codicon-eye' : 'codicon-eye-closed'}`;
    icon.style.color = showInactivesInModals ? 'var(--primary)' : 'var(--text-muted)';
    
    updateUsuariosTable();
}

let pendingUsuarioChanges = [];

function updateUsuariosTable() {
    const tbody = document.getElementById('usuariosTableBody');
    if (!tbody) return;

    // Combinar mapa actual con pendientes
    const allUsers = new Map(escanersMap);
    pendingUsuarioChanges.forEach(u => allUsers.set(u.id, { NOMBRE: u.nombre, ESTADO: u.estado || 'TRUE' }));

    const sorted = Array.from(allUsers.entries()).sort((a,b) => String(a[0]).localeCompare(String(b[0])));
    
    let html = '';
    sorted.forEach(([id, data]) => {
        const isActive = (typeof data === 'object' && data !== null) ? (data.ESTADO === 'TRUE') : true;

        // Ocultar si es inactivo y el filtro global está apagado
        if (!isActive && !showInactivesInModals) return;

        const isNew = !escanersMap.has(id);
        const nameOriginal = isNew ? (typeof data === 'object' ? data.NOMBRE : data) : (escanersMap.get(id).NOMBRE || 'SIN NOMBRE');
        const nameActual = (typeof data === 'object' && data !== null) ? (data.NOMBRE || 'SIN NOMBRE') : (data || 'SIN NOMBRE');
        
        const hasChanged = nameOriginal !== nameActual;
        const isPending = isNew || hasChanged || (escanersMap.has(id) && escanersMap.get(id).ESTADO !== data.ESTADO);

        html += `
            <tr class="${!isActive ? 'is-inactive' : ''}" style="${isNew ? 'background: rgba(13, 188, 121, 0.05);' : ''}">
                <td style="font-family: 'Cascadia Code', monospace; font-weight: 700; color: ${isNew ? 'var(--success)' : 'var(--warning)'}; padding: 10px 14px;">${id}</td>
                <td style="padding: 8px 14px;">
                    <input type="text" value="${nameActual}" 
                           class="maestro-input-editable ${hasChanged ? 'has-changed' : ''}" 
                           onchange="onUsuarioNameChange('${id}', this.value)"
                           placeholder="Nombre / Ubicación"
                           style="background: transparent; border: 1px solid transparent; color: var(--text); width: 100%; padding: 4px; border-radius: 4px;">
                </td>
                <td style="text-align: center; display: flex; justify-content: center; gap: 10px; align-items: center; height: 44px; padding: 0 14px;">
                    <div class="state-toggle" onclick="toggleUsuarioStateLocal('${id}')" title="Click para cambiar estado" 
                         style="cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; background: ${isActive ? 'var(--success-dim)' : 'var(--error-dim)'}; color: ${isActive ? 'var(--success)' : 'var(--error)'}; border: 1px solid currentColor; min-width: 70px;">
                        ${isActive ? 'ACTIVO' : 'INACTIVO'}
                    </div>
                    <button class="btn-icon" onclick="removeUsuarioLocal('${id}')" style="color: var(--text-muted); border: none; background: transparent; cursor: pointer;">
                        <i class="codicon codicon-trash"></i>
                    </button>
                    ${isPending ? '<i class="codicon codicon-sync" style="color: var(--warning); font-size: 14px;" title="Cambio pendiente"></i>' : ''}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html || '<tr><td colspan="3" style="text-align:center; padding:40px; color:var(--text-muted);">Sin usuarios activos</td></tr>';
    
    const saveBtn = document.getElementById('saveUsuariosBtn');
    if (saveBtn) saveBtn.style.display = pendingUsuarioChanges.length > 0 ? 'flex' : 'none';
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

function addNewUsuarioLocal() {
    const id = document.getElementById('newUsuarioID').value.trim().toUpperCase();
    const nombre = document.getElementById('newUsuarioNombre').value.trim().toUpperCase();

    if (!id || !nombre) {
        showMessage('ID y Nombre son obligatorios', 'error');
        return;
    }

    if (escanersMap.has(id)) {
        const current = escanersMap.get(id);
        if (current.NOMBRE === nombre) {
            showMessage('REGISTRO YA EXISTE SIN CAMBIOS', 'info');
            return;
        }
    }

    const idx = pendingUsuarioChanges.findIndex(u => u.id === id);
    if (idx !== -1) {
        pendingUsuarioChanges[idx].nombre = nombre;
    } else {
        pendingUsuarioChanges.push({ id, nombre, estado: 'TRUE' });
    }

    document.getElementById('newUsuarioID').value = '';
    document.getElementById('newUsuarioNombre').value = '';
    updateUsuariosTable();
    showMessage('Cambio preparado', 'success', 1000);
}

async function removeUsuarioLocal(id) {
    // Si es un cambio pendiente de adición local
    const pendingIdx = pendingUsuarioChanges.findIndex(u => u.id === id);
    if (pendingIdx !== -1) {
        pendingUsuarioChanges.splice(pendingIdx, 1);
        updateUsuariosTable();
        return;
    }

    // Borrado real en Sheets
    if (escanersMap.has(id)) {
        const pass = prompt('Introduce la contraseña para eliminar este dispositivo:');
        if (pass !== 'One654321') {
            if (pass !== null) showMessage('Contraseña incorrecta', 'error');
            return;
        }

        const loading = showQuickLoading(`Eliminando usuario/dispositivo ${id}...`);
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'deleteUsuario');
            formData.append('datos', JSON.stringify({ id: id }));
            formData.append('password', pass);

            const response = await fetch(SISPROWEB_GAS_URL, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                await loadUsuariosData();
                updateUsuariosTable();
                const stat = document.getElementById('stat-usuarios');
                if (stat) stat.textContent = escanersMap.size;
                showMessage(`Dispositivo ${id} eliminado del maestro`, 'success');
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            Logger.error('usuarios-modal', 'Error eliminando usuario', err);
            showMessage('Error: ' + err.message, 'error');
        } finally {
            loading.close();
        }
    }
}

async function persistUsuariosChanges() {
    if (pendingUsuarioChanges.length === 0) return;
    
    const btn = document.getElementById('saveUsuariosBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Guardando...';

    try {
        // Formatear para el GAS: USUARIO | NOMBRE | ESTADO (TRUE)
        const dataToSave = pendingUsuarioChanges.map(u => [u.id, u.nombre, 'TRUE']);
        
        // Usaremos saveNewUsuarioData que definiremos pronto
        await saveNewUsuarioData(dataToSave);
        
        await loadUsuariosData();
        pendingUsuarioChanges = [];
        updateUsuariosTable();

        const stat = document.getElementById('stat-usuarios');
        if (stat) stat.textContent = escanersMap.size;

        showMessage('Base de usuarios actualizada con éxito', 'success', 3000);
        setTimeout(() => {
            const modal = document.querySelector('.modal-usuarios-mgmt');
            if (modal) modal.remove();
        }, 500);

    } catch (err) {
        Logger.error('usuarios-modal', 'Error persistiendo usuarios', err);
        showMessage('Error al guardar: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="codicon codicon-save"></i> Reintentar Guardar';
    }
}

async function toggleUsuarioStateLocal(id) {
    if (!escanersMap.has(id)) return;

    const user = escanersMap.get(id);
    const newState = user.ESTADO === 'TRUE' ? 'FALSE' : 'TRUE';
    
    const loading = showQuickLoading(`Cambiando estado de ${id} a ${newState}...`);
    try {
        // Enviar al GAS vía saveNewUsuarioData (que usa appendUsuario en GAS)
        // Como es un UPSERT, actualizará la fila existente.
        await saveNewUsuarioData([[id, user.NOMBRE, newState]]);
        
        await loadUsuariosData();
        updateUsuariosTable();
        showMessage(`Estado de ${id} actualizado`, 'success', 1500);
    } catch (err) {
        Logger.error('usuarios-modal', 'Error toggling state', err);
        showMessage('Error: ' + err.message, 'error');
    } finally {
        loading.close();
    }
}

window.showUsuariosModal = showUsuariosModal;
window.addNewUsuarioLocal = addNewUsuarioLocal;
window.removeUsuarioLocal = removeUsuarioLocal;
window.toggleUsuarioStateLocal = toggleUsuarioStateLocal;
window.persistUsuariosChanges = persistUsuariosChanges;
