/**
 * js/ui/colores-modal.js
 * Modal de administración de Colores con guardado en segundo plano y auto-incremento
 */

let _colorEditKey = null;
let _coloresCurrentPage = 1;
const COLORES_PER_PAGE = 5;

function showColoresModal() {
    openAdminTab('colores', 'Colores', 'codicon-symbol-color', renderColoresUI);
}

function renderColoresUI(container) {
    if (!container) container = document.getElementById('adminTabEntryPoint');
    if (!container) return;

    container.innerHTML = `
        <div class="section-content">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px;">
                <div style="position: relative; flex: 1;">
                    <i class="codicon codicon-search" style="position: absolute; left: 12px; top: 11px; color: var(--text-secondary); z-index: 1;"></i>
                    <input type="text" id="colorSearchTerm" oninput="filterColoresList(this.value)" 
                           placeholder="Filtrar por Código o Nombre..." 
                           class="form-control" style="padding-left: 36px; width: 100%;">
                </div>
            </div>

            <!-- Tabla IDE -->
            <div style="border: 1px solid var(--border); border-radius: 4px; background: var(--bg-dark); overflow: hidden;">
                <table class="data-table">
                    <thead style="position: sticky; top: 0; z-index: 10;">
                        <tr>
                            <th style="width: 140px; text-align: left;">Código</th>
                            <th style="text-align: left;">Nombre / Descripción</th>
                            <th style="width: 60px;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="coloresTableBody">
                        <!-- Dinámico -->
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 11px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
                    <i class="codicon codicon-info"></i> Registrados: ${coloresMap.size}
                </div>
                <div id="coloresPaginationControls" style="display:flex; gap: 8px; align-items: center;"></div>
            </div>
        </div>
    `;

    _coloresCurrentPage = 1;
    const dynActions = document.getElementById('adminDynamicActions');
    if (dynActions) {
        // Solo el botón de agregar. El botón de refrescar ya está en el header del tab.
        dynActions.innerHTML = `
            <button class="btn-icon" onclick="openColorFormModal(null)" title="Nuevo Color">
                <i class="codicon codicon-add"></i>
            </button>
        `;
    }

    updateColoresList();
}

function updateColoresList(filter = '') {
    const list = document.getElementById('coloresTableBody');
    if (!list) return;

    const term = filter.toLowerCase();
    let html = '';
    
    // Sort logic
    const sorted = Array.from(coloresMap.entries()).sort((a, b) => {
        const numA = parseInt(a[0], 10);
        const numB = parseInt(b[0], 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(a[0]).localeCompare(String(b[0]));
    });

    // Filtering
    const filtered = sorted.filter(([key, val]) => {
        return key.toLowerCase().includes(term) || val.toLowerCase().includes(term);
    });

    // Pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / COLORES_PER_PAGE) || 1;
    if (_coloresCurrentPage > totalPages) _coloresCurrentPage = totalPages;

    const startIdx = (_coloresCurrentPage - 1) * COLORES_PER_PAGE;
    const paged = filtered.slice(startIdx, startIdx + COLORES_PER_PAGE);

    paged.forEach(([key, val]) => {
        html += `
            <tr>
                <td style="color: var(--warning); font-weight: 700; text-align: left;">${key}</td>
                <td style="text-align: left;">
                    <span style="color: var(--text);">${val}</span>
                </td>
                <td>
                    <i class="codicon codicon-edit" style="cursor: pointer; color: var(--primary);" onclick="openColorFormModal('${key}')" title="Editar"></i>
                </td>
            </tr>
        `;
    });

    list.innerHTML = html || '<tr><td colspan="3" style="text-align:center; padding:40px; color:var(--text-muted);">No se encontraron colores</td></tr>';
    
    // Render Controls
    const controls = document.getElementById('coloresPaginationControls');
    if (controls) {
        controls.innerHTML = `
            <button class="btn-secondary" onclick="changeColoresPage(1)" ${_coloresCurrentPage === 1 ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-left" style="font-size:12px;"></i><i class="codicon codicon-chevron-left" style="font-size:12px; margin-left:-6px;"></i></button>
            <button class="btn-secondary" onclick="changeColoresPage(${_coloresCurrentPage - 1})" ${_coloresCurrentPage === 1 ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-left" style="font-size:12px;"></i></button>
            <span style="font-size: 11px; color: var(--text-secondary); margin: 0 4px;">Pág ${_coloresCurrentPage} de ${totalPages}</span>
            <button class="btn-secondary" onclick="changeColoresPage(${_coloresCurrentPage + 1})" ${_coloresCurrentPage === totalPages ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-right" style="font-size:12px;"></i></button>
            <button class="btn-secondary" onclick="changeColoresPage(${totalPages})" ${_coloresCurrentPage === totalPages ? 'disabled' : ''} style="padding: 2px 6px;"><i class="codicon codicon-chevron-right" style="font-size:12px;"></i><i class="codicon codicon-chevron-right" style="font-size:12px; margin-left:-6px;"></i></button>
        `;
    }
}

function filterColoresList(val) {
    _coloresCurrentPage = 1;
    updateColoresList(val);
}

function changeColoresPage(page) {
    _coloresCurrentPage = page;
    updateColoresList(document.getElementById('colorSearchTerm')?.value || '');
}

async function removeColorEntry(key) {
    if (coloresMap.has(key)) {
        const pass = prompt('Contraseña:');
        if (pass !== 'One654321') {
            if (pass !== null) showMessage('Error', 'error');
            return;
        }

        const loading = showQuickLoading(`Eliminando ${key}...`);
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'deleteColor');
            formData.append('datos', JSON.stringify({ id: key }));
            formData.append('password', pass);
            const response = await fetch(SISPROWEB_GAS_URL, { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success) {
                await loadColoresData();
                updateColoresList();
                showMessage(`Eliminado`, 'success');
            } else { throw new Error(result.message); }
        } catch (err) {
            showMessage(err.message, 'error');
        } finally { loading.close(); }
    }
}

function getNextColorCode() {
    let max = 0;
    coloresMap.forEach((_, key) => {
        const num = parseInt(key, 10);
        if (!isNaN(num) && num > max) max = num;
    });
    const nextNum = max + 1;
    return nextNum < 100 ? String(nextNum).padStart(2, '0') : String(nextNum);
}

function _buildColorFormModal() {
    let overlay = document.getElementById('colorFormOverlay');
    if (overlay) document.body.removeChild(overlay);

    overlay = document.createElement('div');
    overlay.id = 'colorFormOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9000;display:flex;align-items:center;justify-content:center;';

    overlay.innerHTML = `
        <div style="background:var(--editor); border:1px solid var(--border); border-radius:6px; width:450px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.5); font-family:'Segoe UI', sans-serif;">
            <div style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:8px;">
                    <i class="codicon codicon-symbol-color" style="color:var(--primary);"></i>
                    <h3 id="cf_title" style="margin:0; font-size:13px; font-weight:600; color:var(--text);">Editar Color</h3>
                </div>
                <i class="codicon codicon-close" style="cursor:pointer; color:var(--text-muted);" onclick="closeColorFormModal()"></i>
            </div>
            <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">CÓDIGO</label>
                    <input type="text" id="cf_key" class="form-control" style="background:var(--editor); font-family:monospace; text-transform:uppercase;">
                </div>
                <div class="form-group" style="margin:0;">
                    <label style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">NOMBRE / DESCRIPCIÓN</label>
                    <input type="text" id="cf_value" class="form-control" style="background:var(--editor); text-transform:uppercase;">
                </div>
            </div>
            <div style="padding:12px 16px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                <div id="cf_deleteZone"></div>
                <div style="display:flex;gap:8px;">
                    <button class="btn-secondary" onclick="closeColorFormModal()">Cancelar</button>
                    <button class="btn-primary" id="cf_saveBtn" onclick="saveColorFromForm()">
                        <i class="codicon codicon-save"></i> Guardar
                    </button>
                </div>
            </div>
        </div>
    `;

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeColorFormModal(); });
    document.body.appendChild(overlay);
    return overlay;
}

function closeColorFormModal() {
    const overlay = document.getElementById('colorFormOverlay');
    if (overlay) document.body.removeChild(overlay);
}

function openColorFormModal(key) {
    _colorEditKey = key;
    _buildColorFormModal();
    const title = document.getElementById('cf_title');
    const deleteZone = document.getElementById('cf_deleteZone');
    const keyInput = document.getElementById('cf_key');
    const nameInput = document.getElementById('cf_value');

    if (!key) {
        // Modo Nuevo: Auto-incremento
        const nextCode = getNextColorCode();
        title.textContent = 'Añadir Nuevo Color';
        keyInput.value = nextCode;
        keyInput.disabled = false;
        nameInput.value = '';
        deleteZone.innerHTML = '';
    } else {
        // Modo Editar
        const originalName = coloresMap.get(key) || '';
        title.textContent = `Editar Color — ${key}`;
        keyInput.value = key;
        keyInput.disabled = true;
        nameInput.value = originalName;
        deleteZone.innerHTML = `
            <button class="btn-secondary" onclick="removeColorEntry('${key}'); closeColorFormModal()" 
                    style="color:var(--error);border-color:var(--error);background:rgba(244,71,71,0.08);">
                <i class="codicon codicon-trash"></i> Eliminar
            </button>
        `;
    }
    
    setTimeout(() => nameInput.focus(), 100);
}

function saveColorFromForm() {
    const key = document.getElementById('cf_key').value.trim().toUpperCase();
    const val = document.getElementById('cf_value').value.trim().toUpperCase();

    if (!key || !val) {
        showMessage('Código y Nombre obligatorios', 'error');
        return;
    }

    // Cerramos el modal de inmediato
    closeColorFormModal();
    
    // Notificación visual de inicio de proceso
    showMessage(`Sincronizando color ${key}...`, 'info');

    // Guardado en segundo plano (asíncrono)
    saveNewColorData([{ codigo: key, nombre: val }])
        .then(async () => {
            // Recargar datos y actualizar tabla cuando el servidor responda exitosamente
            await loadColoresData();
            updateColoresList();
            showMessage(`Color ${key} guardado en Google Sheets`, 'success');
        })
        .catch(err => {
            Logger.error('colores', `Error al guardar color ${key}`, err);
            showMessage(`Error al guardar ${key}: ${err.message}`, 'error');
        });
}

// Exports
window.showColoresModal = showColoresModal;
window.filterColoresList = filterColoresList;
window.changeColoresPage = changeColoresPage;
window.removeColorEntry = removeColorEntry;
window.openColorFormModal = openColorFormModal;
window.closeColorFormModal = closeColorFormModal;
window.saveColorFromForm = saveColorFromForm;
