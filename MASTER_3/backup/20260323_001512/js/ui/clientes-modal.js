/**
 * js/ui/clientes-modal.js
 * Modal para gestionar el maestro de Clientes
 */

function showClientesModal() {
    const existing = document.querySelector('.modal-clientes-mgmt');
    if (existing) { existing.remove(); return; }

    const modal = createModal(
        `<i class="codicon codicon-organization"></i> Maestro de Clientes`,
        `<div id="clientesMgmtContent"></div>`,
        true
    );
    modal.classList.add('modal-clientes-mgmt');
    
    // Centrado perfecto
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
    const content = modal.querySelector('.modal-content');
    if (content) {
        content.style.width = '1100px';
        content.style.maxWidth = '98vw';
        content.style.padding = '0';
    }

    renderClientesUI();
}

function renderClientesUI() {
    const container = document.getElementById('clientesMgmtContent');
    if (!container) return;

    container.innerHTML = `
        <div class="mgmt-container-wide">
            <div style="text-align: center; margin-bottom: 24px;">
                <div class="alert-icon" style="margin: 0 auto 16px; background: var(--info-dim); border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
                    <i class="codicon codicon-briefcase" style="font-size: 32px; color: var(--info);"></i>
                </div>
                <h2 style="margin: 0; color: var(--text); font-size: 18px; font-weight: 600;">Gestión Maestro de Clientes</h2>
                <p style="color: var(--text-secondary); font-size: 13px; margin-top: 8px;">
                    Administración avanzada de clientes, mayoristas y empresas del grupo.
                </p>
            </div>

            <!-- Dashboard rápido -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px;">
                <div class="stat-card-mini">
                    <div class="val">${clientesMap.size}</div>
                    <div class="lbl">Total Registrados</div>
                </div>
                <div class="stat-card-mini">
                    <div class="val" style="color: var(--primary);">${Array.from(clientesMap.values()).filter(c => c.TIPO_EMPRESA === 'MAYORISTA').length}</div>
                    <div class="lbl">Mayoristas</div>
                </div>
                <div class="stat-card-mini">
                    <div class="val" style="color: var(--success);">${Array.from(clientesMap.values()).filter(c => c.ESTADO === 'ACTIVO').length}</div>
                    <div class="lbl">Clientes Activos</div>
                </div>
            </div>

            <!-- Filtros y Opciones -->
            <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <div style="position: relative; flex: 1; display: flex; gap: 8px;">
                    <div style="position: relative; flex: 1;">
                        <i class="codicon codicon-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
                        <input type="text" id="clienteSearchTerm" oninput="filterClientesTable(this.value)" placeholder="Filtrar por ID, Razón, Email o Ciudad..." 
                               style="width: 100%; padding: 10px 12px 10px 36px; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px;">
                    </div>
                    
                    <button class="btn-secondary" onclick="toggleInactivesClientes(this)" title="Mostrar/Ocultar Inactivos" style="width: 42px; padding: 0; display: flex; align-items: center; justify-content: center;">
                        <i class="codicon ${showInactivesInModals ? 'codicon-eye' : 'codicon-eye-closed'}" style="color: ${showInactivesInModals ? 'var(--primary)' : 'var(--text-muted)'}"></i>
                    </button>
                </div>
                
                <button class="btn-primary" id="saveClientesBtn" style="display:none; background: var(--success); border-color: var(--success);" onclick="persistClientesChanges()">
                    <i class="codicon codicon-save"></i> Guardar Cambios
                </button>
            </div>

            <div id="clientesTableContainer" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-dark);">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead style="position: sticky; top: 0; background: var(--surface); z-index: 10;">
                        <tr>
                            <th style="padding: 12px; text-align: left; color: var(--text-secondary); border-bottom: 2px solid var(--border); width: 100px;">ID/NIT</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-secondary); border-bottom: 2px solid var(--border);">Razón Social</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-secondary); border-bottom: 2px solid var(--border); width: 110px;">Tipo Cliente</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-secondary); border-bottom: 2px solid var(--border); width: 100px;">Empresa</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-secondary); border-bottom: 2px solid var(--border); width: 140px;">Contacto</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-secondary); border-bottom: 2px solid var(--border); width: 150px;">Ubicación</th>
                            <th style="padding: 12px; text-align: center; color: var(--text-secondary); border-bottom: 2px solid var(--border); width: 80px;">Estado</th>
                            <th style="padding: 12px; text-align: center; color: var(--text-secondary); border-bottom: 2px solid var(--border); width: 40px;"></th>
                        </tr>
                    </thead>
                    <tbody id="clientesTableBody">
                        <!-- Dinámico -->
                    </tbody>
                </table>
            </div>

            <div class="modal-footer" style="margin-top:24px; border-top:1px solid var(--border); padding-top:20px; display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size: 11px; color: var(--text-muted);">
                    <i class="codicon codicon-info" style="font-size: 12px; vertical-align: middle;"></i> Tip: Click en el Badge de Estado para activar/desactivar.
                </div>
                <button class="btn-secondary" onclick="this.closest('.modal').remove()" style="padding: 8px 24px;">Cerrar Maestro</button>
            </div>
        </div>

        <style>
            .mgmt-container-wide { width: 100%; padding: 40px; box-sizing: border-box; }
            .stat-card-mini { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; text-align: center; transition: all 0.2s; }
            
            #clientesTableBody tr { border-bottom: 1px solid var(--border); transition: background 0.1s; }
            #clientesTableBody tr:hover { background: var(--surface); }
            #clientesTableBody tr.is-inactive { opacity: 0.6; background: rgba(244, 71, 71, 0.03); }
            #clientesTableBody td { padding: 10px 12px; color: var(--text); border-right: 1px solid rgba(255,255,255,0.03); }
            #clientesTableBody .badge { padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
        </style>
    `;

    updateClientesTable();
}

function toggleInactivesClientes(btn) {
    showInactivesInModals = !showInactivesInModals;
    const icon = btn.querySelector('i');
    icon.className = `codicon ${showInactivesInModals ? 'codicon-eye' : 'codicon-eye-closed'}`;
    icon.style.color = showInactivesInModals ? 'var(--primary)' : 'var(--text-muted)';
    
    updateClientesTable(document.getElementById('clienteSearchTerm')?.value || '');
}

function updateClientesTable(filter = '') {
    const tbody = document.getElementById('clientesTableBody');
    if (!tbody) return;

    const term = filter.toLowerCase();
    const sorted = Array.from(clientesMap.values()).sort((a,b) => String(a.ID).localeCompare(String(b.ID)));
    
    let html = '';
    sorted.forEach(c => {
        const isActive = c.ESTADO === 'ACTIVO';
        
        // Ocultar si es inactivo y el filtro global está apagado
        if (!isActive && !showInactivesInModals) return;

        const contentStr = `${c.ID} ${c.RAZON_SOCIAL} ${c.EMAIL} ${c.DIRECCION} ${c.TELEFONO}`.toLowerCase();
        
        if (contentStr.includes(term)) {
            const isMayorista = c.TIPO_EMPRESA === 'MAYORISTA';
            
            html += `
                <tr class="${!isActive ? 'is-inactive' : ''}">
                    <td style="font-family: 'Cascadia Code', monospace; font-weight: 600; color: var(--info);">${c.ID}</td>
                    <td>
                        <div style="font-weight: 600;">${c.RAZON_SOCIAL}</div>
                        <div style="font-size: 10px; color: var(--text-muted);">${c.NOMBRE_CORTO || '-'}</div>
                    </td>
                    <td><span class="badge" style="background: var(--surface); color: var(--text-muted); border: 1px solid var(--border); font-weight: normal;">${c.TIPO_CLIENTE}</span></td>
                    <td><span class="badge" style="background: ${isMayorista ? 'var(--primary-dim)' : 'var(--surface)'}; color: ${isMayorista ? 'var(--primary)' : 'var(--text-muted)'}">${c.TIPO_EMPRESA}</span></td>
                    <td>
                        <div style="font-size: 11px;">${c.EMAIL || '-'}</div>
                        <div style="font-size: 10px; color: var(--text-muted);">${c.TELEFONO || '-'}</div>
                    </td>
                    <td style="color: var(--text-secondary); font-size: 11px;">${c.DIRECCION || '-'}</td>
                    <td style="text-align: center;">
                        <span class="badge" onclick="toggleClienteStateLocal('${c.ID}')" title="Click para cambiar estado" style="cursor: pointer; background: ${isActive ? 'var(--success-dim)' : 'var(--error-dim)'}; color: ${isActive ? 'var(--success)' : 'var(--error)'}; border: 1px solid currentColor;">
                            ${isActive ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                    </td>
                    <td style="text-align: center;">
                        <i class="codicon codicon-trash btn-table-del" onclick="removeClienteLocal('${c.ID}')"></i>
                    </td>
                </tr>
            `;
        }
    });

    tbody.innerHTML = html || '<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text-muted);">No hay clientes activos coincidentes</td></tr>';
}

function filterClientesTable(val) {
    updateClientesTable(val);
}

let pendingClienteChanges = [];

function addClienteLocal() {
    const id = document.getElementById('newClienteID').value.trim().toUpperCase();
    const razon = document.getElementById('newClienteRazon').value.trim().toUpperCase();
    const email = document.getElementById('newClienteEmail').value.trim().toLowerCase();

    if (!id || !razon) {
        showMessage('ID y Razón Social son obligatorios', 'error');
        return;
    }

    if (clientesMap.has(id)) {
        const current = clientesMap.get(id);
        if (current.RAZON_SOCIAL === razon && current.EMAIL === email) {
            showMessage('CLIENTE YA EXISTE SIN CAMBIOS', 'info');
            return;
        }
        showMessage(`Actualizando cliente: ${id} (${current.RAZON_SOCIAL} -> ${razon})`, 'info');
    }

    // Un registro de cliente para Sheets API v4 espera un array de 9 columnas según GAS
    // [ID, RAZON_SOCIAL, NOMBRE_CORTO, TIPO_CLIENTE, ESTADO, DIRECCION, TELEFONO, EMAIL, TIPO_EMPRESA]
    const fullRecord = [id, razon, razon, 'NORMAL', 'ACTIVO', '', '', email, 'NORMAL'];
    
    pendingClienteChanges.push(fullRecord);
    document.getElementById('newClienteID').value = '';
    document.getElementById('newClienteRazon').value = '';
    document.getElementById('newClienteEmail').value = '';
    
    // Alerta visual de cambios locales
    const statItem = document.getElementById('saveClientesBtn');
    if (statItem) statItem.style.display = 'flex';
    
    showMessage('Cliente preparado para sincronización', 'success', 1500);
}

async function persistClientesChanges() {
    if (pendingClienteChanges.length === 0) return;
    
    const btn = document.getElementById('saveClientesBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Guardando...';

    try {
        await saveNewClienteData(pendingClienteChanges);
        
        await loadClientesData();
        pendingClienteChanges = [];
        updateClientesTable();

        const stat = document.getElementById('stat-clientes');
        if (stat) stat.textContent = clientesMap.size;
        btn.style.display = 'none';

        showMessage('Maestro de Clientes actualizado con éxito', 'success', 3000);
    } catch (err) {
        Logger.error('clientes-modal', 'Error persistiendo clientes', err);
        showMessage('Error al guardar: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="codicon codicon-save"></i> Guardar en Servidor';
    }
}

async function removeClienteLocal(id) {
    if (clientesMap.has(id)) {
        const pass = prompt('Introduce la contraseña para eliminar este cliente:');
        if (pass !== 'One654321') {
            if (pass !== null) showMessage('Contraseña incorrecta', 'error');
            return;
        }

        const loading = showQuickLoading(`Borrando cliente ${id} de la base maestra...`);
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'deleteCliente');
            formData.append('datos', JSON.stringify({ id: id }));
            formData.append('password', pass);

            const response = await fetch(SISPROWEB_GAS_URL, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                await loadClientesData();
                updateClientesTable();
                const stat = document.getElementById('stat-clientes');
                if (stat) stat.textContent = clientesMap.size;
                showMessage(`Cliente ${id} eliminado con éxito`, 'success');
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            Logger.error('clientes-modal', 'Error eliminando cliente', err);
            showMessage('Error: ' + err.message, 'error');
        } finally {
            loading.close();
        }
    }
}

async function toggleClienteStateLocal(id) {
    if (!clientesMap.has(id)) return;

    const cliente = clientesMap.get(id);
    const newState = cliente.ESTADO === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    
    const loading = showQuickLoading(`Cambiando estado de ${id} a ${newState}...`);
    try {
        // Enviar todas las columnas requeridas para el UPSERT en GAS
        const record = [
            id, 
            cliente.RAZON_SOCIAL, 
            cliente.NOMBRE_CORTO || '', 
            cliente.TIPO_CLIENTE || 'NORMAL', 
            newState, 
            cliente.DIRECCION || '', 
            cliente.TELEFONO || '', 
            cliente.EMAIL || '', 
            cliente.TIPO_EMPRESA || 'NORMAL'
        ];
        
        await saveNewClienteData([record]);
        
        await loadClientesData();
        updateClientesTable();
        showMessage(`Estado de ${id} actualizado a ${newState}`, 'success', 1500);
    } catch (err) {
        Logger.error('clientes-modal', 'Error toggling state', err);
        showMessage('Error: ' + err.message, 'error');
    } finally {
        loading.close();
    }
}

window.showClientesModal = showClientesModal;
window.addClienteLocal = addClienteLocal;
window.persistClientesChanges = persistClientesChanges;
window.removeClienteLocal = removeClienteLocal;
window.toggleClienteStateLocal = toggleClienteStateLocal;
window.filterClientesTable = filterClientesTable;
