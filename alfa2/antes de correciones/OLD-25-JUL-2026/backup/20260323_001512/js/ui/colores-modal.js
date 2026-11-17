/**
 * js/ui/colores-modal.js
 * Modal para gestionar el maestro de Colores
 */

function showColoresModal() {
    const existing = document.querySelector('.modal-colores-mgmt');
    if (existing) { existing.remove(); return; }

    const modal = createModal(
        `<i class="codicon codicon-symbol-color"></i> Maestro de Colores`,
        `<div id="coloresMgmtContent"></div>`,
        true
    );
    modal.classList.add('modal-colores-mgmt');
    
    // Centrado perfecto
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
    const content = modal.querySelector('.modal-content');
    if (content) {
        content.style.width = '600px';
        content.style.maxWidth = '90vw';
        content.style.padding = '0';
    }

    renderColoresUI();
}

function renderColoresUI() {
    const container = document.getElementById('coloresMgmtContent');
    if (!container) return;

    container.innerHTML = `
        <div class="mgmt-container">
            <div style="text-align: center; margin-bottom: 24px;">
                <div class="alert-icon" style="margin: 0 auto 16px; background: var(--primary-dim); border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
                    <i class="codicon codicon-paintcan" style="font-size: 32px; color: var(--primary);"></i>
                </div>
                <h2 style="margin: 0; color: var(--text); font-size: 18px; font-weight: 600;">Gestión de Colores</h2>
                <p style="color: var(--text-secondary); font-size: 13px; margin-top: 8px;">
                    Administra el catálogo de colores para la validación de OPs.
                </p>
            </div>

            <!-- Formulario de adición rápida -->
            <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <div style="display: grid; grid-template-columns: 1fr 2fr auto; gap: 12px; align-items: end;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; margin-bottom: 6px;">Código</label>
                        <input type="text" id="newColorKey" class="form-control" placeholder="Ej: 101" style="text-transform: uppercase;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; margin-bottom: 6px;">Nombre del Color</label>
                        <input type="text" id="newColorValue" class="form-control" placeholder="Ej: NEGRO">
                    </div>
                    <button class="btn-primary" onclick="addNewColorLocal()" style="height: 36px; padding: 0 16px;">
                        <i class="codicon codicon-add"></i> Agregar
                    </button>
                </div>
            </div>

            <!-- Lista de colores con búsqueda -->
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Lista de Colores (${coloresMap.size})</span>
                <div style="position: relative; width: 200px;">
                    <i class="codicon codicon-search" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--text-muted);"></i>
                    <input type="text" oninput="filterColoresList(this.value)" placeholder="Buscar color..." 
                           style="width: 100%; padding: 6px 12px 6px 28px; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 12px;">
                </div>
            </div>

            <div id="coloresListContainer" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-dark);">
                <!-- Se llena dinámicamente -->
            </div>

            <div class="modal-footer" style="margin-top:24px; border-top:1px solid var(--border); padding-top:20px; display:flex; justify-content:flex-end; gap:12px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()" style="padding: 8px 16px;">Cerrar</button>
                <button class="btn-primary" id="saveColoresBtn" style="display:none; padding: 8px 20px; background: var(--success); border-color: var(--success);" onclick="persistColoresChanges()">
                    <i class="codicon codicon-cloud-upload" style="margin-right: 6px;"></i> Guardar Cambios en Google Sheets
                </button>
            </div>
        </div>

        <style>
            .mgmt-container { width: 100%; padding: 32px; box-sizing: border-box; }
            .color-row { 
                display: flex; gap: 12px; padding: 8px 16px; border-bottom: 1px solid var(--border); 
                align-items: center; transition: background 0.1s;
            }
            .color-row:hover { background: var(--surface); }
            .color-row:last-child { border-bottom: none; }
            .color-key { font-family: 'Cascadia Code', monospace; font-weight: 700; color: var(--info); width: 60px; }
            .color-val { flex: 1; color: var(--text); }
            .color-del { color: var(--error); cursor: pointer; opacity: 0.6; }
            .color-del:hover { opacity: 1; }
        </style>
    `;

    updateColoresList();
}

let pendingColorChanges = [];

function updateColoresList(filter = '') {
    const list = document.getElementById('coloresListContainer');
    if (!list) return;

    const term = filter.toLowerCase();
    let html = '';
    
    // Combinar mapa actual con cambios pendientes
    const allColors = new Map(coloresMap);
    pendingColorChanges.forEach(c => allColors.set(c.key, c.value));

    // Convertir a array para filtrar y ordenar
    const sorted = Array.from(allColors.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0])));

    sorted.forEach(([key, val]) => {
        if (key.toLowerCase().includes(term) || val.toLowerCase().includes(term)) {
            const isPending = !coloresMap.has(key) || coloresMap.get(key) !== val;
            html += `
                <div class="color-row" style="${isPending ? 'border-left: 3px solid var(--success); background: var(--success-dim);' : ''}">
                    <span class="color-key">${key}</span>
                    <span class="color-val">${val} ${isPending ? '<small style="color:var(--success); margin-left:8px;">(Nuevo)</small>' : ''}</span>
                    <i class="codicon codicon-trash color-del" onclick="removeColorEntry('${key}')"></i>
                </div>
            `;
        }
    });

    list.innerHTML = html || '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No se encontraron colores</div>';
    
    const saveBtn = document.getElementById('saveColoresBtn');
    if (saveBtn) saveBtn.style.display = pendingColorChanges.length > 0 ? 'flex' : 'none';
}

function filterColoresList(val) {
    updateColoresList(val);
}

function addNewColorLocal() {
    const key = document.getElementById('newColorKey').value.trim().toUpperCase();
    const val = document.getElementById('newColorValue').value.trim().toUpperCase();

    if (!key || !val) {
        showMessage('Código y Nombre son obligatorios', 'error');
        return;
    }

    if (coloresMap.has(key) && !pendingColorChanges.some(c => c.key === key)) {
        // Permitir update si ya existe
        const currentName = coloresMap.get(key);
        if (currentName === val) {
            showMessage('El color ya tiene este nombre', 'info');
            return;
        }
        showMessage(`Actualizando nombre de ${key}: ${currentName} -> ${val}`, 'info');
    }

    pendingColorChanges.push({ key, value: val });
    document.getElementById('newColorKey').value = '';
    document.getElementById('newColorValue').value = '';
    updateColoresList();
    showMessage('Color añadido a cambios pendientes', 'success', 1500);
}

async function removeColorEntry(key) {
    // Si es un cambio pendiente de adición local
    const pendingIdx = pendingColorChanges.findIndex(c => c.key === key);
    if (pendingIdx !== -1) {
        pendingColorChanges.splice(pendingIdx, 1);
        updateColoresList();
        return;
    }

    // Si es un registro real en el Map, procedemos al borrado en Sheets
    if (coloresMap.has(key)) {
        const pass = prompt('Introduce la contraseña para eliminar este color:');
        if (pass !== 'One654321') {
            if (pass !== null) showMessage('Contraseña incorrecta', 'error');
            return;
        }

        const loading = showQuickLoading(`Eliminando color ${key} de Google Sheets...`);
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'deleteColor');
            formData.append('datos', JSON.stringify({ id: key }));
            formData.append('password', pass);

            const response = await fetch(SISPROWEB_GAS_URL, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success) {
                await loadColoresData();
                updateColoresList();
                const stat = document.getElementById('stat-colores');
                if (stat) stat.textContent = coloresMap.size;
                showMessage(`Color ${key} eliminado correctamente`, 'success');
            } else {
                throw new Error(result.message);
            }
        } catch (err) {
            Logger.error('colores-modal', 'Error eliminando color', err);
            showMessage('Error: ' + err.message, 'error');
        } finally {
            loading.close();
        }
    }
}

async function persistColoresChanges() {
    if (pendingColorChanges.length === 0) return;

    const btn = document.getElementById('saveColoresBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Guardando...';

    const loading = showQuickLoading(`Iniciando actualización de ${pendingColorChanges.length} colores...`);

    try {
        // Enviar uno por uno o en batch si el GAS lo soporta. 
        // Según saveNewColorData existente, espera un array pero la acción es appendColor.
        const dataToSave = pendingColorChanges.map(c => [c.key, c.value]);
        await saveNewColorData(dataToSave);
        
        // Recargar datos
        await loadColoresData();
        pendingColorChanges = [];
        updateColoresList();
        
        // Actualizar UI Global
        const stat = document.getElementById('stat-colores');
        if (stat) stat.textContent = coloresMap.size;

        showMessage('Maestro de colores actualizado correctamente', 'success', 3000);
        setTimeout(() => {
            const modal = document.querySelector('.modal-colores-mgmt');
            if (modal) modal.remove();
        }, 500);

    } catch (err) {
        Logger.error('colores-modal', 'Error persistiendo colores', err);
        showMessage('Error al guardar: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="codicon codicon-cloud-upload"></i> Reintentar Guardado';
    } finally {
        loading.close();
    }
}

window.showColoresModal = showColoresModal;
window.addNewColorLocal = addNewColorLocal;
window.filterColoresList = filterColoresList;
window.persistColoresChanges = persistColoresChanges;
window.removeColorEntry = removeColorEntry;
