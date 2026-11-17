/**
 * js/ui/maestros-master-modal.js
 * Sistema unificado para la gestión de maestros técnicos:
 * Proveedores, Auditores y Gestores.
 */

/**
 * Función genérica para renderizar cualquier maestro de tipo ID | NOMBRE | ESTADO
 * @param {Object} options 
 */
function openGenericMaestroModal(options) {
    const { title, icon, type, map, saveFn, loadFn, deleteAction, idField, nameField } = options;
    
    const existing = document.querySelector(`.modal-maestro-${type.toLowerCase()}`);
    if (existing) { existing.remove(); return; }

    const modal = createModal(
        `<i class="codicon codicon-${icon}"></i> Maestro de ${title}`,
        `<div id="maestroContent_${type}"></div>`,
        true
    );
    modal.classList.add(`modal-maestro-${type.toLowerCase()}`);
    
    // Centrado y tamaño
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
    const content = modal.querySelector('.modal-content');
    if (content) {
        content.style.width = '700px';
        content.style.maxWidth = '90vw';
        content.style.padding = '0';
    }

    renderMaestroUI(options);
}

function renderMaestroUI(options) {
    const { type, title, icon, map } = options;
    const container = document.getElementById(`maestroContent_${type}`);
    if (!container) return;

    const total = map.size;
    const activos = Array.from(map.values()).filter(d => (typeof d === 'object' ? d.ESTADO === 'TRUE' : true)).length;

    container.innerHTML = `
        <div class="mgmt-container" style="padding: 24px;">
            <!-- Header Premium -->
            <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 24px; background: var(--surface); padding: 20px; border-radius: 12px; border: 1px solid var(--border);">
                <div class="alert-icon" style="background: var(--primary-dim); border-radius: 12px; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="codicon codicon-${icon}" style="font-size: 28px; color: var(--primary);"></i>
                </div>
                <div style="flex-grow: 1;">
                    <h2 style="margin: 0; color: var(--text); font-size: 18px; font-weight: 600;">Administración de ${title}</h2>
                    <p style="color: var(--text-secondary); font-size: 12px; margin-top: 4px;">Gestione la base de datos de personal técnico y entidades autorizadas.</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <div style="text-align: right; padding-right: 12px; border-right: 1px solid var(--border);">
                        <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Total</div>
                        <div style="font-size: 18px; font-weight: 700; color: var(--text); font-family: 'Cascadia Code', monospace;">${total}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Activos</div>
                        <div style="font-size: 18px; font-weight: 700; color: var(--success); font-family: 'Cascadia Code', monospace;">${activos}</div>
                    </div>
                </div>
            </div>

            <!-- Formulario Upsert -->
            <div style="background: var(--bg-dark); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 20px; display: flex; align-items: flex-end; gap: 12px;">
                <div style="flex: 0 0 140px;">
                    <label style="display: block; font-size: 10px; color: var(--text-muted); font-weight: 700; margin-bottom: 6px; text-transform: uppercase;">ID / Documento</label>
                    <input type="text" id="newMaestroID_${type}" class="form-control" placeholder="ID" style="text-transform: uppercase; height: 34px; font-family: 'Cascadia Code', monospace;">
                </div>
                <div style="flex: 1;">
                    <label style="display: block; font-size: 10px; color: var(--text-muted); font-weight: 700; margin-bottom: 6px; text-transform: uppercase;">Nombre Completo</label>
                    <input type="text" id="newMaestroNombre_${type}" class="form-control" placeholder="Nombre completo" style="height: 34px;">
                </div>
                <button class="btn-primary" onclick="addMaestroEntryLocal('${type}')" style="height: 34px; padding: 0 16px; display: flex; align-items: center; gap: 8px; font-size: 12px;">
                    <i class="codicon codicon-add"></i> Registrar
                </button>
            </div>

            <!-- Header de Tabla y Filtro -->
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Lista de Registros</span>
                <button class="btn-secondary" onclick="toggleInactivesMaestro(this, '${type}')" title="Mostrar/Ocultar Inactivos" style="width: 34px; height: 30px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid var(--border);">
                    <i class="codicon ${showInactivesInModals ? 'codicon-eye' : 'codicon-eye-closed'}" style="color: ${showInactivesInModals ? 'var(--primary)' : 'var(--text-muted)'}"></i>
                </button>
            </div>

            <div id="maestroTableContainer_${type}" style="max-height: 340px; overflow-y: auto; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-dark);">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead style="position: sticky; top: 0; background: var(--surface); z-index: 10;">
                        <tr>
                            <th style="padding: 10px 16px; text-align: left; color: var(--text-secondary); border-bottom: 1px solid var(--border); font-weight: 600; width: 140px;">ID</th>
                            <th style="padding: 10px 16px; text-align: left; color: var(--text-secondary); border-bottom: 1px solid var(--border); font-weight: 600;">Nombre Completo (Editable)</th>
                            <th style="padding: 10px 16px; text-align: center; color: var(--text-secondary); border-bottom: 1px solid var(--border); font-weight: 600; width: 140px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="maestroTableBody_${type}">
                        <!-- Dinámico -->
                    </tbody>
                </table>
            </div>

            <div class="modal-footer" style="margin-top:20px; border-top:1px solid var(--border); padding-top:16px; display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()" style="padding: 8px 16px; font-size: 12px;">Cerrar</button>
                <button class="btn-primary" id="saveMaestroBtn_${type}" style="display:none; background: var(--success); border-color: var(--success); padding: 8px 16px; font-size: 12px; font-weight: 600;" onclick="persistMaestroChanges('${type}')">
                    <i class="codicon codicon-save" style="margin-right: 8px;"></i> Sincronizar Cambios
                </button>
            </div>
        </div>

        <style>
            #maestroTableBody_${type} tr { border-bottom: 1px solid var(--border); transition: background 0.2s; }
            #maestroTableBody_${type} tr:last-child { border-bottom: none; }
            #maestroTableBody_${type} tr:hover { background: rgba(255,255,255,0.02); }
            #maestroTableBody_${type} tr.is-inactive { opacity: 0.5; background: rgba(244, 71, 71, 0.02); }
            
            .maestro-input-editable {
                background: transparent;
                border: 1px solid transparent;
                color: var(--text);
                width: 100%;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                transition: all 0.2s;
            }
            .maestro-input-editable:hover { border-color: var(--border); background: var(--surface); }
            .maestro-input-editable:focus { border-color: var(--primary); background: var(--bg-dark); outline: none; }
            .maestro-input-editable.has-changed { color: var(--warning); border-color: var(--warning); font-style: italic; }
        </style>
    `;

    // Guardar opciones en el elemento para referencia posterior
    container._options = options;
    updateMaestroTable(type);
}

function toggleInactivesMaestro(btn, type) {
    showInactivesInModals = !showInactivesInModals;
    const icon = btn.querySelector('i');
    icon.className = `codicon ${showInactivesInModals ? 'codicon-eye' : 'codicon-eye-closed'}`;
    icon.style.color = showInactivesInModals ? 'var(--primary)' : 'var(--text-muted)';
    
    updateMaestroTable(type);
}

let pendingMaestroChanges = {};

function updateMaestroTable(type) {
    const container = document.getElementById(`maestroContent_${type}`);
    const tbody = document.getElementById(`maestroTableBody_${type}`);
    if (!container || !tbody) return;
    
    const { map } = container._options;
    const pending = pendingMaestroChanges[type] || [];
    
    // Crear vista combinada para renderizar
    const allEntries = new Map(map);
    pending.forEach(p => allEntries.set(p[0], { NOMBRE: p[1], ESTADO: p[2] }));

    const sorted = Array.from(allEntries.entries()).sort((a,b) => String(a[0]).localeCompare(String(b[0])));
    
    let html = '';
    sorted.forEach(([id, data]) => {
        const isActive = (typeof data === 'object' && data !== null) ? (data.ESTADO === 'TRUE') : true;
        
        // Ocultar si es inactivo y el filtro global está apagado
        if (!isActive && !showInactivesInModals) return;

        const isNew = !map.has(id);
        const nombreOriginal = isNew ? (typeof data === 'object' ? data.NOMBRE : data) : 
                                       (typeof map.get(id) === 'object' ? (map.get(id).NOMBRE || map.get(id).PROVEEDOR || map.get(id).AUDITOR || map.get(id).GESTOR) : map.get(id));
        
        const nombreActual = (typeof data === 'object' && data !== null) ? (data.NOMBRE || data.PROVEEDOR || data.AUDITOR || data.GESTOR || 'SIN NOMBRE') : (data || 'SIN NOMBRE');
        
        const hasNameChanged = nombreOriginal !== nombreActual;
        const isPending = isNew || hasNameChanged || (map.has(id) && map.get(id).ESTADO !== data.ESTADO);

        html += `
            <tr class="${!isActive ? 'is-inactive' : ''}" style="${isNew ? 'background: rgba(13, 188, 121, 0.05);' : ''}">
                <td style="font-family: 'Cascadia Code', monospace; font-weight: 700; color: ${isNew ? 'var(--success)' : 'var(--primary)'}; padding: 12px 16px;">
                    ${id}
                </td>
                <td style="padding: 8px 16px;">
                    <input type="text" value="${nombreActual}" 
                           class="maestro-input-editable ${hasNameChanged ? 'has-changed' : ''}" 
                           onchange="onMaestroNameChange('${type}', '${id}', this.value)"
                           placeholder="Nombre completo">
                </td>
                <td style="padding: 8px 16px; text-align: center; display: flex; justify-content: center; gap: 10px; align-items: center;">
                    <div class="state-toggle" onclick="toggleMaestroStateLocal('${type}', '${id}')" title="Inactivar / Activar" 
                         style="cursor: pointer; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; background: ${isActive ? 'rgba(13,188,121,0.1)' : 'rgba(244,71,71,0.1)'}; color: ${isActive ? 'var(--success)' : 'var(--error)'}; border: 1px solid currentColor; min-width: 70px;">
                        ${isActive ? 'ACTIVO' : 'INACTIVO'}
                    </div>
                    <button class="btn-icon" onclick="removeMaestroEntryLocal('${type}', '${id}')" style="color: var(--text-muted); border: none; background: transparent; cursor: pointer;" title="Eliminar definitivamente">
                        <i class="codicon codicon-trash" style="font-size: 14px;"></i>
                    </button>
                    ${isPending ? '<i class="codicon codicon-sync" style="color: var(--warning); font-size: 14px;" title="Cambio pendiente de guardar"></i>' : ''}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html || '<tr><td colspan="3" style="text-align:center; padding:50px; color:var(--text-muted); font-size: 13px;">No se encontraron registros activos</td></tr>';
    
    document.getElementById(`saveMaestroBtn_${type}`).style.display = (pendingMaestroChanges[type] && pendingMaestroChanges[type].length > 0) ? 'flex' : 'none';
}

function onMaestroNameChange(type, id, newValue) {
    const container = document.getElementById(`maestroContent_${type}`);
    const { map } = container._options;
    
    // Obtener estado actual
    let currentState = 'TRUE';
    if (map.has(id)) {
        currentState = map.get(id).ESTADO || 'TRUE';
    }
    
    // Si ya existe en cambios pendientes, solo actualizar nombre
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
        showMessage('ID y Nombre son obligatorios', 'error');
        return;
    }

    const container = document.getElementById(`maestroContent_${type}`);
    const { map } = container._options;

    if (map.has(id)) {
        const current = map.get(id);
        const currentName = current.NOMBRE || current.PROVEEDOR || current.AUDITOR || current.GESTOR;
        if (currentName === nombre) {
            showMessage('REGISTRO YA EXISTE SIN CAMBIOS', 'info');
            return;
        }
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
    const container = document.getElementById(`maestroContent_${type}`);
    const { map, saveFn, loadFn } = container._options;
    
    if (!map.has(id)) {
        showMessage('Guarda el registro primero para cambiar su estado', 'warning');
        return;
    }

    const entry = map.get(id);
    let nombre = entry.NOMBRE || entry.PROVEEDOR || entry.AUDITOR || entry.GESTOR;
    const newState = entry.ESTADO === 'TRUE' ? 'FALSE' : 'TRUE';
    
    // Si hay un cambio de nombre pendiente para este ID, usarlo
    if (pendingMaestroChanges[type]) {
        const pIdx = pendingMaestroChanges[type].findIndex(p => p[0] === id);
        if (pIdx !== -1) {
            nombre = pendingMaestroChanges[type][pIdx][1];
            // Actualizar el estado también en pendientes para ser consistente
            pendingMaestroChanges[type][pIdx][2] = newState;
        }
    }

    const loading = showQuickLoading(`Actualizando estado de ${id}...`);
    try {
        await saveFn([[id, nombre, newState]]);
        await loadFn();
        
        // Limpiar de pendientes si solo era el cambio de estado
        if (pendingMaestroChanges[type]) {
            const pIdx = pendingMaestroChanges[type].findIndex(p => p[0] === id);
            if (pIdx !== -1) {
                // Si el nombre en pendientes coincide con lo que acabamos de guardar, podemos quitarlo
                // Pero mejor lo dejamos si el nombre es distinto al del map original
                const mapEntry = map.get(id);
                const mapName = mapEntry.NOMBRE || mapEntry.PROVEEDOR || mapEntry.AUDITOR || mapEntry.GESTOR;
                if (nombre === mapName) {
                    pendingMaestroChanges[type].splice(pIdx, 1);
                }
            }
        }

        updateMaestroTable(type);
        showMessage('Estado actualizado correctamente', 'success', 2000);
    } catch (err) {
        showMessage('Error: ' + err.message, 'error');
    } finally {
        loading.close();
    }
}

async function removeMaestroEntryLocal(type, id) {
    const container = document.getElementById(`maestroContent_${type}`);
    const { map, loadFn, deleteAction } = container._options;
    
    // Si es pendiente local
    if (pendingMaestroChanges[type]) {
        const idx = pendingMaestroChanges[type].findIndex(p => p[0] === id);
        if (idx !== -1) {
            pendingMaestroChanges[type].splice(idx, 1);
            updateMaestroTable(type);
            return;
        }
    }

    // Borrado real
    if (map.has(id)) {
        const pass = prompt('Introduce la contraseña para eliminar:');
        if (pass !== 'One654321') {
            if (pass !== null) showMessage('Password incorrecta', 'error');
            return;
        }

        const loading = showQuickLoading(`Borrando registro...`);
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
                showMessage('Registro eliminado', 'success');
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            showMessage('Error: ' + err.message, 'error');
        } finally {
            loading.close();
        }
    }
}

async function persistMaestroChanges(type) {
    const pending = pendingMaestroChanges[type];
    if (!pending || pending.length === 0) return;

    const container = document.getElementById(`maestroContent_${type}`);
    const { saveFn, loadFn } = container._options;
    
    const btn = document.getElementById(`saveMaestroBtn_${type}`);
    btn.disabled = true;

    try {
        await saveFn(pending);
        await loadFn();
        pendingMaestroChanges[type] = [];
        updateMaestroTable(type);
        showMessage('Maestro actualizado correctamente', 'success');
    } catch (err) {
        showMessage('Error al guardar: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// ============================================
// ENTRY POINTS
// ============================================

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
