/**
 * js/ui/clientes-modal.js
 * Maestro de Clientes — CREATE / UPDATE con modal de formulario
 * Headers CLIENTES: ID | Razón Social | Nombre Corto | Tipo Cliente | Estado | Dirección | Teléfono | Email | Tipo Empresa
 */

let showInactivesInModals = false;
let _clienteEditId = null;
let _clientesCurrentPage = 1;
const CLIENTES_PER_PAGE = 5;

function showClientesModal() {
    openAdminTab('clientes', 'Clientes', 'codicon-organization', renderClientesUI);
}

function renderClientesUI(container) {
    if (!container) container = document.getElementById('adminTabEntryPoint');
    if (!container) return;

    container.innerHTML = `
        <div class="section-content">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px;">
                <div style="position: relative; flex: 1;">
                    <i class="codicon codicon-search" style="position: absolute; left: 12px; top: 11px; color: var(--text-secondary); z-index: 1;"></i>
                    <input type="text" id="clienteSearchTerm" oninput="filterClientesTable(this.value)" 
                           placeholder="Filtrar por ID, Razón, Email..." 
                           class="form-control" style="padding-left: 36px; width: 100%;">
                </div>
            </div>

            <div style="border: 1px solid var(--border); border-radius: 4px; background: var(--editor); overflow: hidden;">
                <table class="data-table">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr>
                            <th style="width: 110px;">ID/NIT</th>
                            <th style="text-align: left;">Razón Social</th>
                            <th style="width: 90px;">Tipo</th>
                            <th style="width: 90px;">Empresa</th>
                            <th style="text-align: left;">Contacto</th>
                            <th style="width: 80px;">Estado</th>
                            <th style="width: 60px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="clientesTableBody">
                        <!-- Dinámico -->
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                    <i class="codicon codicon-info"></i>
                    Total: ${clientesMap.size} | <i class="codicon codicon-edit" style="margin: 0 3px;"></i> para editar.
                </div>
                <div id="clientesPaginationControls" style="display:flex; gap: 8px; align-items: center;"></div>
            </div>
        </div>
    `;

    _clientesCurrentPage = 1;
    const dynActions = document.getElementById('adminDynamicActions');
    if (dynActions) {
        dynActions.innerHTML = `
            <button class="btn-icon" onclick="toggleInactivesClientes(this)" title="${showInactivesInModals ? 'Ocultar Inactivos' : 'Ver Inactivos'}">
                <i class="codicon ${showInactivesInModals ? 'codicon-eye' : 'codicon-eye-closed'}" style="color: ${showInactivesInModals ? 'var(--primary)' : 'var(--text-secondary)'}"></i>
            </button>
            <button class="btn-icon" onclick="openClienteFormModal(null)" title="Nuevo Cliente">
                <i class="codicon codicon-add"></i>
            </button>
        `;
    }

    updateClientesTable();
}

// ─── MODAL FORM (se monta en document.body para heredar el tema CSS) ───────────

function _buildClienteFormModal() {
    const existing = document.getElementById('clienteFormOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'clienteFormOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9000;display:flex;align-items:center;justify-content:center;';

    overlay.innerHTML = `
        <div style="background:var(--sidebar);border:1px solid var(--border);border-radius:8px;width:560px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:8px;">
                    <i class="codicon codicon-organization" style="color:var(--primary);"></i>
                    <span id="clienteFormTitle" style="font-weight:600;font-size:13px;color:var(--text);">Nuevo Cliente</span>
                </div>
                <button onclick="closeClienteFormModal()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;padding:4px;">
                    <i class="codicon codicon-close"></i>
                </button>
            </div>

            <div style="padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <div style="grid-column:1/2;">
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">ID / NIT <span style="color:var(--error)">*</span></label>
                    <input id="cf_id" type="text" class="form-control" placeholder="Ej: 900616124" style="font-size:12px;">
                </div>
                <div style="grid-column:2/3;">
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Nombre Corto <span style="color:var(--error)">*</span></label>
                    <input id="cf_nombreCorto" type="text" class="form-control" placeholder="Ej: Universo" style="font-size:12px;">
                </div>
                <div style="grid-column:1/-1;">
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Razón Social <span style="color:var(--error)">*</span></label>
                    <input id="cf_razonSocial" type="text" class="form-control" placeholder="Ej: TEXTILES Y CREACIONES EL UNIVERSO S.A.S." style="font-size:12px;">
                </div>
                <div>
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Tipo Cliente <span style="color:var(--error)">*</span></label>
                    <select id="cf_tipoCliente" class="form-control" style="font-size:12px;">
                        <option value="">-- Seleccionar --</option>
                        <option value="Empresa">Empresa</option>
                        <option value="Mayorista">Mayorista</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Tipo Empresa</label>
                    <select id="cf_tipoEmpresa" class="form-control" style="font-size:12px;">
                        <option value="">-- Sin clasificar --</option>
                        <option value="Principal">Principal</option>
                        <option value="Secundaria">Secundaria</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Estado <span style="color:var(--error)">*</span></label>
                    <select id="cf_estado" class="form-control" style="font-size:12px;">
                        <option value="Activo">Activo</option>
                        <option value="Inactivo">Inactivo</option>
                    </select>
                </div>
                <div>
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Teléfono</label>
                    <input id="cf_telefono" type="text" class="form-control" placeholder="Ej: 3168007979" style="font-size:12px;">
                </div>
                <div style="grid-column:1/-1;">
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Email</label>
                    <input id="cf_email" type="email" class="form-control" placeholder="Ej: correo@empresa.com" style="font-size:12px;">
                </div>
                <div style="grid-column:1/-1;">
                    <label style="font-size:11px;color:var(--text-secondary);display:block;margin-bottom:4px;">Dirección</label>
                    <input id="cf_direccion" type="text" class="form-control" placeholder="Ej: CALLE 26 # 7 - 21" style="font-size:12px;">
                </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-top:1px solid var(--border);">
                <div id="cf_deleteZone"></div>
                <div style="display:flex;gap:8px;">
                    <button class="btn-secondary" onclick="closeClienteFormModal()">Cancelar</button>
                    <button class="btn-primary" id="clienteFormSaveBtn" onclick="saveClienteFromForm()">
                        <i class="codicon codicon-save"></i> Guardar
                    </button>
                </div>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeClienteFormModal(); });
    document.body.appendChild(overlay);
    return overlay;
}

function openClienteFormModal(id) {
    _clienteEditId = id || null;
    _buildClienteFormModal();

    const title = document.getElementById('clienteFormTitle');
    const deleteZone = document.getElementById('cf_deleteZone');

    if (id && clientesMap.has(id)) {
        const c = clientesMap.get(id);
        title.textContent = `Editar Cliente — ${id}`;
        document.getElementById('cf_id').value = c.ID;
        document.getElementById('cf_id').disabled = true;
        document.getElementById('cf_razonSocial').value = c.RAZON_SOCIAL;
        document.getElementById('cf_nombreCorto').value = c.NOMBRE_CORTO;
        document.getElementById('cf_tipoCliente').value = c.TIPO_CLIENTE;
        document.getElementById('cf_tipoEmpresa').value = c.TIPO_EMPRESA || '';
        document.getElementById('cf_estado').value = c.ESTADO; // valor tal cual de Sheets (Activo/Inactivo)
        document.getElementById('cf_telefono').value = c.TELEFONO === '-' ? '' : (c.TELEFONO || '');
        document.getElementById('cf_email').value = c.EMAIL === '-' ? '' : (c.EMAIL || '');
        document.getElementById('cf_direccion').value = c.DIRECCION || '';

        // Botón eliminar solo visible en modo edición
        if (deleteZone) {
            deleteZone.innerHTML = `
                <button class="btn-secondary" onclick="removeClienteLocal('${id}')" 
                        style="color:var(--error);border-color:var(--error);background:rgba(244,71,71,0.08);">
                    <i class="codicon codicon-trash"></i> Eliminar
                </button>
            `;
        }
    } else {
        title.textContent = 'Nuevo Cliente';
        document.getElementById('cf_id').value = '';
        document.getElementById('cf_id').disabled = false;
        document.getElementById('cf_razonSocial').value = '';
        document.getElementById('cf_nombreCorto').value = '';
        document.getElementById('cf_tipoCliente').value = '';
        document.getElementById('cf_tipoEmpresa').value = '';
        document.getElementById('cf_estado').value = 'Activo';
        document.getElementById('cf_telefono').value = '';
        document.getElementById('cf_email').value = '';
        document.getElementById('cf_direccion').value = '';
        if (deleteZone) deleteZone.innerHTML = '';
    }
}

function closeClienteFormModal() {
    const overlay = document.getElementById('clienteFormOverlay');
    if (overlay) overlay.remove();
    _clienteEditId = null;
}

async function saveClienteFromForm() {
    const id        = document.getElementById('cf_id').value.trim();
    const razon     = document.getElementById('cf_razonSocial').value.trim();
    const corto     = document.getElementById('cf_nombreCorto').value.trim();
    const tipo      = document.getElementById('cf_tipoCliente').value.trim();
    const tipoEmp   = document.getElementById('cf_tipoEmpresa').value.trim();
    const estado    = document.getElementById('cf_estado').value.trim();
    const telefono  = document.getElementById('cf_telefono').value.trim() || '-';
    const email     = document.getElementById('cf_email').value.trim() || '-';
    const direccion = document.getElementById('cf_direccion').value.trim();

    if (!id || !razon || !corto || !tipo || !estado) {
        Notifications.show('Completa los campos obligatorios (*)', 'warning');
        return;
    }

    if (!_clienteEditId && clientesMap.has(id)) {
        Notifications.show(`El ID ${id} ya existe. Use Editar para modificarlo.`, 'error');
        return;
    }

    const btn = document.getElementById('clienteFormSaveBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Guardando...';

    // Fila en orden exacto de CLIENTES: ID | Razón Social | Nombre Corto | Tipo Cliente | Estado | Dirección | Teléfono | Email | Tipo Empresa
    const fila = [id, razon, corto, tipo, estado, direccion, telefono, email, tipoEmp];
    const isUpdate = Boolean(_clienteEditId);

    try {
        if (isUpdate) {
            await updateClienteData(fila);
        } else {
            await saveNewClienteData([fila]);
        }
        await loadClientesData();
        updateClientesTable();
        closeClienteFormModal();
        Notifications.show(isUpdate ? `Cliente ${id} actualizado` : `Cliente ${id} creado`, 'success');
    } catch (err) {
        Logger.error('clientes-modal', 'Error guardando cliente', err);
        Notifications.show('Error al guardar: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="codicon codicon-save"></i> Guardar';
    }
}

// ─── TABLA ─────────────────────────────────────────────────────────────────────

function toggleInactivesClientes(btn) {
    showInactivesInModals = !showInactivesInModals;
    const icon = btn.querySelector('i');
    icon.className = `codicon ${showInactivesInModals ? 'codicon-eye' : 'codicon-eye-closed'}`;
    icon.style.color = showInactivesInModals ? 'var(--primary)' : 'var(--text-secondary)';
    updateClientesTable(document.getElementById('clienteSearchTerm')?.value || '');
}

function updateClientesTable(filter = '') {
    const tbody = document.getElementById('clientesTableBody');
    if (!tbody) return;

    const term = filter.toLowerCase();
    const sorted = Array.from(clientesMap.values()).sort((a, b) => String(a.ID).localeCompare(String(b.ID)));

    // Filtering
    const filtered = sorted.filter(c => {
        const isActive = (c.ESTADO || '').toUpperCase() === 'ACTIVO';
        if (!isActive && !showInactivesInModals) return false;

        const contentStr = `${c.ID} ${c.RAZON_SOCIAL} ${c.EMAIL} ${c.TELEFONO} ${c.NOMBRE_CORTO}`.toLowerCase();
        return contentStr.includes(term);
    });

    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / CLIENTES_PER_PAGE) || 1;
    if (_clientesCurrentPage > totalPages) _clientesCurrentPage = totalPages;

    const startIdx = (_clientesCurrentPage - 1) * CLIENTES_PER_PAGE;
    const paged = filtered.slice(startIdx, startIdx + CLIENTES_PER_PAGE);

    // Render
    let html = '';
    paged.forEach(c => {
        const isActive = (c.ESTADO || '').toUpperCase() === 'ACTIVO';
        html += `
            <tr style="${!isActive ? 'opacity: 0.5;' : ''}">
                <td style="font-weight: 600;">${c.ID}</td>
                <td style="text-align: left;">
                    <div style="color: var(--text);">${c.RAZON_SOCIAL}</div>
                    <div style="font-size: 10px; color: var(--text-secondary);">${c.NOMBRE_CORTO || '-'}</div>
                </td>
                <td>${c.TIPO_CLIENTE || '-'}</td>
                <td>${c.TIPO_EMPRESA || '-'}</td>
                <td style="text-align: left;">
                    <div style="font-size: 11px; color: var(--text);">${c.EMAIL || '-'}</div>
                    <div style="font-size: 10px; color: var(--text-secondary);">${c.TELEFONO || '-'}</div>
                </td>
                <td>
                    <span style="padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; border: 1px solid currentColor; color: ${isActive ? 'var(--success)' : 'var(--error)'}; background: ${isActive ? 'rgba(13,188,121,0.1)' : 'rgba(244,71,71,0.1)'}">
                        ${c.ESTADO}
                    </span>
                </td>
                <td>
                    <i class="codicon codicon-edit" style="cursor: pointer; color: var(--primary);"
                       onclick="openClienteFormModal('${c.ID}')" title="Editar"></i>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--text-muted);">No se encontraron clientes</td></tr>';

    // Render Controls
    const controls = document.getElementById('clientesPaginationControls');
    if (controls) {
        controls.innerHTML = `
            <button class="btn-secondary" onclick="changeClientesPage(1)" ${_clientesCurrentPage === 1 ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-left" style="font-size:12px;"></i><i class="codicon codicon-chevron-left" style="font-size:12px; margin-left:-6px;"></i></button>
            <button class="btn-secondary" onclick="changeClientesPage(${_clientesCurrentPage - 1})" ${_clientesCurrentPage === 1 ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-left" style="font-size:12px;"></i></button>
            <span style="font-size: 11px; color: var(--text-secondary); margin: 0 4px;">Pág ${_clientesCurrentPage} de ${totalPages}</span>
            <button class="btn-secondary" onclick="changeClientesPage(${_clientesCurrentPage + 1})" ${_clientesCurrentPage === totalPages ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-right" style="font-size:12px;"></i></button>
            <button class="btn-secondary" onclick="changeClientesPage(${totalPages})" ${_clientesCurrentPage === totalPages ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-right" style="font-size:12px;"></i><i class="codicon codicon-chevron-right" style="font-size:12px; margin-left:-6px;"></i></button>
        `;
    }
}

function changeClientesPage(page) {
    _clientesCurrentPage = page;
    updateClientesTable(document.getElementById('clienteSearchTerm')?.value || '');
}

function filterClientesTable(val) {
    _clientesCurrentPage = 1;
    updateClientesTable(val);
}

// ─── ACCIONES ──────────────────────────────────────────────────────────────────

async function removeClienteLocal(id) {
    if (!clientesMap.has(id)) return;

    const pass = prompt('Contraseña:');
    if (pass !== 'One654321') {
        if (pass !== null) Notifications.show('Error de acceso', 'error');
        return;
    }

    closeClienteFormModal();
    const loading = showQuickLoading(`Eliminando ${id}...`);
    try {
        const formData = new URLSearchParams();
        formData.append('action', 'deleteCliente');
        formData.append('datos', JSON.stringify({ id }));
        formData.append('password', pass);

        const response = await fetch(SISPROWEB_GAS_URL, { method: 'POST', body: formData });
        const result = await response.json();

        if (result.success) {
            await loadClientesData();
            updateClientesTable();
            Notifications.show(`Cliente ${id} eliminado`, 'success');
        } else {
            throw new Error(result.message);
        }
    } catch (err) {
        Logger.error('clientes-modal', 'Error eliminando cliente', err);
        Notifications.show('Error: ' + err.message, 'error');
    } finally {
        loading.close();
    }
}

// Exports
window.showClientesModal = showClientesModal;
window.removeClienteLocal = removeClienteLocal;
window.filterClientesTable = filterClientesTable;
window.toggleInactivesClientes = toggleInactivesClientes;
window.openClienteFormModal = openClienteFormModal;
window.closeClienteFormModal = closeClienteFormModal;
window.saveClienteFromForm = saveClienteFromForm;
window.changeClientesPage = changeClientesPage;
