/**
 * js/ui/clientes-modal.js
 * Maestro de Clientes - Diseño IDE Consistente
 */

function showClientesModal() {
    openAdminTab('clientes', 'Maestro de Clientes', 'codicon-organization', renderClientesUI);
}

function renderClientesUI(container) {
    if (!container) container = document.getElementById('adminTabEntryPoint');
    if (!container) return;

    container.innerHTML = `
        <div class="section-content">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px;">
                <div style="position: relative; flex: 1;">
                    <i class="codicon codicon-search" style="position: absolute; left: 12px; top: 11px; color: var(--text-muted); z-index: 1;"></i>
                    <input type="text" id="clienteSearchTerm" oninput="filterClientesTable(this.value)" 
                           placeholder="Filtrar por ID, Razón, Email..." 
                           class="form-control" style="padding-left: 36px; width: 100%;">
                </div>
                
                <div style="display: flex; gap: 8px;">
                    <button class="btn-secondary" onclick="toggleInactivesClientes(this)" title="Mostrar/Ocultar Inactivos" style="width: 42px; display: flex; align-items: center; justify-content: center;">
                        <i class="codicon ${showInactivesInModals ? 'codicon-eye' : 'codicon-eye-closed'}" style="color: ${showInactivesInModals ? 'var(--primary)' : 'var(--text-muted)'}"></i>
                    </button>
                    <button class="btn-primary" id="saveClientesBtn" style="display:none;" onclick="persistClientesChanges()">
                        <i class="codicon codicon-save"></i> Guardar Cambios
                    </button>
                </div>
            </div>

            <div style="height: calc(100vh - 280px); overflow-y: auto; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-dark);">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;">
                    <thead style="position: sticky; top: 0; background: var(--surface); z-index: 10; border-bottom: 2px solid var(--border);">
                        <tr>
                            <th style="padding: 12px; text-align: left; color: var(--text-secondary); width: 120px;">ID/NIT</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Razón Social</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-secondary); width: 120px;">Tipo</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-secondary); width: 120px;">Empresa</th>
                            <th style="padding: 12px; text-align: left; color: var(--text-secondary);">Contacto</th>
                            <th style="padding: 12px; text-align: center; color: var(--text-secondary); width: 90px;">Estado</th>
                            <th style="padding: 12px; text-align: center; color: var(--text-secondary); width: 40px;"></th>
                        </tr>
                    </thead>
                    <tbody id="clientesTableBody">
                        <!-- Dinámico -->
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 12px; font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
                <i class="codicon codicon-info"></i>
                Total Clientes: ${clientesMap.size} | Click en el estado para cambiar.
            </div>
        </div>
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
        if (!isActive && !showInactivesInModals) return;

        const contentStr = `${c.ID} ${c.RAZON_SOCIAL} ${c.EMAIL} ${c.TELEFONO}`.toLowerCase();
        
        if (contentStr.includes(term)) {
            const isMayorista = c.TIPO_EMPRESA === 'MAYORISTA';
            
            html += `
                <tr style="border-bottom: 1px solid var(--border); ${!isActive ? 'opacity: 0.5;' : ''}">
                    <td style="padding: 10px 12px; color: var(--info); font-weight: 600;">${c.ID}</td>
                    <td style="padding: 10px 12px;">
                        <div style="color: var(--text);">${c.RAZON_SOCIAL}</div>
                        <div style="font-size: 10px; color: var(--text-muted);">${c.NOMBRE_CORTO || '-'}</div>
                    </td>
                    <td style="padding: 10px 12px;">${c.TIPO_CLIENTE}</td>
                    <td style="padding: 10px 12px; color: ${isMayorista ? 'var(--primary)' : 'var(--text-muted)'};">${c.TIPO_EMPRESA}</td>
                    <td style="padding: 10px 12px;">
                        <div style="font-size: 11px;">${c.EMAIL || '-'}</div>
                        <div style="font-size: 10px; color: var(--text-muted);">${c.TELEFONO || '-'}</div>
                    </td>
                    <td style="padding: 10px 12px; text-align: center;">
                        <span onclick="toggleClienteStateLocal('${c.ID}')" 
                              style="cursor: pointer; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; border: 1px solid currentColor; color: ${isActive ? 'var(--success)' : 'var(--error)'}; background: ${isActive ? 'rgba(13,188,121,0.1)' : 'rgba(244,71,71,0.1)'}">
                            ${isActive ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                    </td>
                    <td style="padding: 10px 12px; text-align: center;">
                        <i class="codicon codicon-trash" style="cursor: pointer; color: var(--text-muted);" onclick="removeClienteLocal('${c.ID}')"></i>
                    </td>
                </tr>
            `;
        }
    });

    tbody.innerHTML = html || '<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--text-muted);">Sin registros coincidentes</td></tr>';
}

function filterClientesTable(val) {
    updateClientesTable(val);
}

let pendingClienteChanges = [];

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
        showMessage('Maestro de Clientes actualizado', 'success');
    } catch (err) {
        showMessage('Error al guardar: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="codicon codicon-save"></i> Guardar Cambios';
    }
}

async function removeClienteLocal(id) {
    if (clientesMap.has(id)) {
        const pass = prompt('Contraseña:');
        if (pass !== 'One654321') {
            if (pass !== null) showMessage('Error de acceso', 'error');
            return;
        }

        const loading = showQuickLoading(`Eliminando ${id}...`);
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'deleteCliente');
            formData.append('datos', JSON.stringify({ id: id }));
            formData.append('password', pass);

            const response = await fetch(SISPROWEB_GAS_URL, { method: 'POST', body: formData });
            const result = await response.json();
            
            if (result.success) {
                await loadClientesData();
                updateClientesTable();
                showMessage(`Cliente ${id} eliminado`, 'success');
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

async function toggleClienteStateLocal(id) {
    if (!clientesMap.has(id)) return;
    const cliente = clientesMap.get(id);
    const newState = cliente.ESTADO === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO';
    const loading = showQuickLoading(`Actualizando ${id}...`);
    try {
        const record = [
            id, cliente.RAZON_SOCIAL, cliente.NOMBRE_CORTO || '', 
            cliente.TIPO_CLIENTE || 'NORMAL', newState, 
            cliente.DIRECCION || '', cliente.TELEFONO || '', 
            cliente.EMAIL || '', cliente.TIPO_EMPRESA || 'NORMAL'
        ];
        await saveNewClienteData([record]);
        await loadClientesData();
        updateClientesTable();
        showMessage('Estado actualizado', 'success', 1000);
    } catch (err) {
        showMessage('Error: ' + err.message, 'error');
    } finally {
        loading.close();
    }
}

// Exports
window.showClientesModal = showClientesModal;
window.persistClientesChanges = persistClientesChanges;
window.removeClienteLocal = removeClienteLocal;
window.toggleClienteStateLocal = toggleClienteStateLocal;
window.filterClientesTable = filterClientesTable;
window.toggleInactivesClientes = toggleInactivesClientes;
