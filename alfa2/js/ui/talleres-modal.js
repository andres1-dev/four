/**
 * js/ui/talleres-modal.js
 * Gestión de Catálogo de Plantas (global_talleres) y Datos Faltantes de Global
 * 
 * 1. Modal interactivo para datos faltantes detectados en Excel de Global:
 *    - Plantas (global_talleres)
 *    - Líneas (global_lineas)
 *    - Auditores (global_auditores)
 *    - Usuarios (global_usuarios)
 * 2. Catálogo de Plantas (Admin Tab): consulta, alta, edición y eliminación.
 * 3. Sincronización masiva desde HTML de SISPRO (tbody_recepcion).
 */

// ============================================
// ESTADO INTERNO DEL MÓDULO
// ============================================

let _talleresCurrentPage = 1;
const TALLERES_PER_PAGE = 8;
let _talleresActiveTab = 'catalogo'; // 'catalogo' | 'sync'
let _tallerEditId = null;

let currentMissingGlobal = {
    data: null,
    onComplete: null
};

// ============================================
// 1. MODAL DE DATOS FALTANTES (EXCEL GLOBAL)
// ============================================

/**
 * Muestra el modal conciso para datos faltantes en archivos Global
 * @param {Object} missingData - { plantas: Map, lineas: Map, auditores: Map, usuarios: Map }
 * @param {Function} onComplete - Callback a ejecutar una vez guardados
 */
function showMissingGlobalDataModal(missingData, onComplete) {
    const existingModal = document.querySelector('.modal-missing-global');
    if (existingModal) existingModal.remove();

    currentMissingGlobal.data = missingData;
    currentMissingGlobal.onComplete = onComplete;

    const modal = createModal(
        `<i class="codicon codicon-warning" style="color:var(--warning);"></i> Datos Faltantes`,
        `<div id="missingGlobalContent"></div>`,
        true
    );
    modal.classList.add('modal-missing-global');

    updateMissingGlobalUI();
}

function updateMissingGlobalUI() {
    const container = document.getElementById('missingGlobalContent');
    if (!container) return;

    const { plantas, lineas, auditores, usuarios } = currentMissingGlobal.data;
    const total = (plantas?.size || 0) + (lineas?.size || 0) + (auditores?.size || 0) + (usuarios?.size || 0);

    if (total === 0) {
        const modal = document.querySelector('.modal-missing-global');
        if (modal) modal.remove();
        if (currentMissingGlobal.onComplete) currentMissingGlobal.onComplete();
        return;
    }

    const renderGroup = (title, map, typeKey, placeholder) => {
        if (!map || map.size === 0) return '';
        const entries = Array.from(map.entries());
        return `
            <div style="margin-bottom: 16px;">
                <div style="font-size:12px; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                    <i class="codicon codicon-symbol-property"></i> ${title} (${entries.length})
                </div>
                ${entries.map(([id, ops]) => `
                    <div class="entry-row" data-type="${typeKey}" data-id="${id}" style="border:1px solid var(--border); border-radius:6px; padding:10px 12px; margin-bottom:8px; background:var(--sidebar);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                            <div style="font-size:13px; color:var(--text);">
                                ID: <strong style="color:var(--primary); font-family:monospace; font-size:13px;">${id}</strong>
                            </div>
                            ${ops && ops.length ? `
                                <div style="font-size:11px; color:var(--text-secondary);">
                                    ${ops.length === 1 ? `OP: <strong>${ops[0]}</strong>` : `OPs: <strong>${ops.slice(0, 3).join(', ')}${ops.length > 3 ? '...' : ''}</strong>`}
                                </div>
                            ` : ''}
                        </div>
                        <div>
                            <input type="text" class="form-control mini global-name-input" 
                                   placeholder="${placeholder}" 
                                   style="text-transform:uppercase; height:32px; font-size:12px; width:100%; box-sizing:border-box;">
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    };

    container.innerHTML = `
        <div class="missing-data-container">
            <p style="margin-bottom: 14px; color: var(--text-secondary); font-size: 13px;">
                Complete los datos faltantes para continuar el procesamiento:
            </p>

            <div id="globalEntryList">
                ${renderGroup('Plantas', plantas, 'planta', 'Nombre de Planta')}
                ${renderGroup('Líneas', lineas, 'linea', 'Nombre de Línea')}
                ${renderGroup('Auditores', auditores, 'auditor', 'Nombre de Auditor')}
                ${renderGroup('Usuarios', usuarios, 'usuario', 'Nombre de Usuario')}
            </div>

            <div class="modal-footer" style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 14px; display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove(); showMessage('Procesamiento cancelado por datos sin registrar', 'warning', 3000);">
                    Cancelar
                </button>
                <button class="btn-primary" onclick="saveMissingGlobalAndContinue()">
                    <i class="codicon codicon-save"></i> Guardar y Continuar
                </button>
            </div>
        </div>

        <style>
            .modal-missing-global .modal-content { max-width: 520px; width: 92%; }
            .missing-data-container { max-height: 70vh; overflow-y: auto; padding-right: 6px; }
            .entry-row:focus-within { border-color: var(--primary); }
        </style>
    `;

    setTimeout(() => {
        const firstInput = container.querySelector('.global-name-input');
        if (firstInput) firstInput.focus();
    }, 100);
}

async function saveMissingGlobalAndContinue() {
    const btn = document.querySelector('.modal-missing-global .btn-primary');
    if (!btn) return;

    const rows = document.querySelectorAll('#globalEntryList .entry-row');
    const toSave = {
        plantas: [],
        lineas: [],
        auditores: [],
        usuarios: []
    };
    let faltanCampos = false;

    rows.forEach(row => {
        const type = row.dataset.type;
        const id = String(row.dataset.id || '').trim();
        const input = row.querySelector('.global-name-input');
        const nombre = (input?.value || '').trim().toUpperCase();

        if (!nombre) {
            faltanCampos = true;
            if (input) input.style.borderColor = 'var(--error)';
        } else {
            if (input) input.style.borderColor = '';
            if (type === 'planta') toSave.plantas.push({ id, nombre });
            else if (type === 'linea') toSave.lineas.push({ id, nombre });
            else if (type === 'auditor') toSave.auditores.push({ id, nombre });
            else if (type === 'usuario') toSave.usuarios.push({ id, nombre });
        }
    });

    if (faltanCampos) {
        showMessage('Complete todos los campos para continuar', 'warning', 3000);
        return;
    }

    const totalToSave = toSave.plantas.length + toSave.lineas.length + toSave.auditores.length + toSave.usuarios.length;
    if (totalToSave === 0) {
        const modal = document.querySelector('.modal-missing-global');
        if (modal) modal.remove();
        if (currentMissingGlobal.onComplete) currentMissingGlobal.onComplete();
        return;
    }

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Guardando...';

    try {
        const promises = [];

        // 1. Guardar Plantas
        for (const p of toSave.plantas) {
            promises.push(
                supabase.upsert('global_talleres', { id_taller: p.id, taller: p.nombre }, 'id_taller')
                    .then(() => {
                        if (window.globalTalleresMap instanceof Map) window.globalTalleresMap.set(p.id, p.nombre);
                    })
            );
        }

        // 2. Guardar Líneas
        for (const l of toSave.lineas) {
            promises.push(
                supabase.upsert('global_lineas', { id_linea: l.id, linea: l.nombre }, 'id_linea')
                    .then(() => {
                        if (window.globalLineasMap instanceof Map) {
                            const norm = typeof _normalizeLinea === 'function' 
                                ? _normalizeLinea(l.nombre) 
                                : l.nombre.replace(/^LINEA\s+/i, '').replace(/\s+/g, '');
                            window.globalLineasMap.set(l.id, norm);
                        }
                    })
            );
        }

        // 3. Guardar Auditores
        for (const a of toSave.auditores) {
            promises.push(
                supabase.upsert('global_auditores', { id_auditor: a.id, auditor: a.nombre }, 'id_auditor')
                    .then(() => {
                        if (window.globalAuditoresMap instanceof Map) window.globalAuditoresMap.set(a.id, a.nombre);
                    })
            );
        }

        // 4. Guardar Usuarios
        for (const u of toSave.usuarios) {
            promises.push(
                supabase.upsert('global_usuarios', { id_usuario: u.id, usuario: u.nombre }, 'id_usuario')
                    .then(() => {
                        if (window.globalUsuariosMap instanceof Map) window.globalUsuariosMap.set(u.id, u.nombre);
                    })
            );
        }

        await Promise.all(promises);

        showMessage(`Se guardaron ${totalToSave} registro(s) en el catálogo`, 'success', 2500);

        const modal = document.querySelector('.modal-missing-global');
        if (modal) modal.remove();

        if (currentMissingGlobal.onComplete) {
            setTimeout(() => currentMissingGlobal.onComplete(), 200);
        }

    } catch (err) {
        console.error('Error guardando datos globales:', err);
        showMessage('Error al guardar: ' + err.message, 'error', 4000);
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// Alias para compatibilidad
function showMissingTalleresModal(missingMap, onComplete) {
    showMissingGlobalDataModal({
        plantas: missingMap,
        lineas: new Map(),
        auditores: new Map(),
        usuarios: new Map()
    }, onComplete);
}

// ============================================
// 2. MÓDULO DE ADMINISTRACIÓN (CATÁLOGO DE PLANTAS)
// ============================================

async function showTalleresModal() {
    if (!window.globalTalleresMap || window.globalTalleresMap.size === 0) {
        if (typeof loadGlobalMaps === 'function') {
            await loadGlobalMaps().catch(() => {});
        }
    }
    openAdminTab('talleres', 'Plantas', 'codicon-home', renderTalleresUI);
}

function renderTalleresUI(container) {
    if (!container) container = document.getElementById('adminTabEntryPoint');
    if (!container) return;

    const dynActions = document.getElementById('adminDynamicActions');
    if (dynActions) {
        dynActions.innerHTML = `
            <button class="btn-icon" onclick="openTallerFormModal(null)" title="Nueva Planta">
                <i class="codicon codicon-add"></i>
            </button>
            <button class="btn-icon" onclick="loadGlobalMaps(true).then(() => renderTalleresUI());" title="Recargar">
                <i class="codicon codicon-refresh"></i>
            </button>
        `;
    }

    container.innerHTML = `
        <div class="section-content">
            <!-- Pestañas de Vista -->
            <div style="display:flex; gap:8px; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <button class="btn-secondary ${_talleresActiveTab === 'catalogo' ? 'active' : ''}" 
                        id="tabBtnTalleresCatalogo" 
                        onclick="switchTalleresView('catalogo')" 
                        style="${_talleresActiveTab === 'catalogo' ? 'background:var(--primary); color:#fff; border-color:var(--primary);' : ''}">
                    <i class="codicon codicon-list-flat"></i> Catálogo de Plantas
                </button>
                <button class="btn-secondary ${_talleresActiveTab === 'sync' ? 'active' : ''}" 
                        id="tabBtnTalleresSync" 
                        onclick="switchTalleresView('sync')" 
                        style="${_talleresActiveTab === 'sync' ? 'background:var(--primary); color:#fff; border-color:var(--primary);' : ''}">
                    <i class="codicon codicon-cloud-upload"></i> Sincronizar desde SISPRO (HTML)
                </button>
            </div>

            <!-- VISTA 1: CATÁLOGO DE PLANTAS -->
            <div id="talleresViewCatalogo" style="${_talleresActiveTab === 'catalogo' ? 'display:block;' : 'display:none;'}">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <div style="position: relative; flex: 1;">
                        <i class="codicon codicon-search" style="position: absolute; left: 12px; top: 10px; color: var(--text-secondary); z-index: 1;"></i>
                        <input type="text" id="tallerSearchTerm" oninput="filterTalleresTable()" 
                               placeholder="Filtrar por ID o Nombre de Planta..." 
                               class="form-control" style="padding-left: 36px; width: 100%; height: 35px;">
                    </div>
                    <button class="btn-primary" onclick="openTallerFormModal(null)" style="height:35px; display:inline-flex; align-items:center; gap:6px;">
                        <i class="codicon codicon-add"></i> Nueva Planta
                    </button>
                </div>

                <div style="border: 1px solid var(--border); border-radius: 6px; background: var(--bg-dark); overflow: hidden;">
                    <table class="data-table">
                        <thead style="position: sticky; top: 0; z-index: 10;">
                            <tr>
                                <th style="width: 140px; text-align: left;">ID Planta</th>
                                <th style="text-align: left;">Nombre de Planta</th>
                                <th style="width: 90px; text-align: center;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="talleresTableBody">
                            <!-- Filas dinámicas -->
                        </tbody>
                    </table>
                </div>

                <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div id="talleresTotalCounter" style="font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 8px;">
                        <i class="codicon codicon-info"></i> Registrados: 0
                    </div>
                    <div id="talleresPaginationControls" style="display:flex; gap: 8px; align-items: center;"></div>
                </div>
            </div>

            <!-- VISTA 2: SINCRONIZACIÓN SISPRO HTML -->
            <div id="talleresViewSync" style="${_talleresActiveTab === 'sync' ? 'display:block;' : 'display:none;'}">
                <div style="background:var(--sidebar); border:1px solid var(--border); border-radius:6px; padding:16px; margin-bottom:16px;">
                    <p style="margin:0 0 10px 0; font-size:13px; color:var(--text-secondary); line-height:1.4;">
                        Pegue aquí el contenido HTML del listado de recepción de SISPRO (bloque <code>&lt;tbody id="tbody_recepcion"&gt;</code>) para sincronizar masivamente la tabla de plantas:
                    </p>
                    <textarea
                        id="talleres-html-input"
                        class="form-control"
                        rows="7"
                        placeholder="Pegue aquí el HTML de SISPRO..."
                        style="font-family: 'Cascadia Code', monospace; font-size:11px; resize:vertical; width:100%; box-sizing:border-box;"
                        oninput="previewTalleres()"
                    ></textarea>
                </div>

                <!-- PREVIEW -->
                <div id="talleres-preview" style="display:none; margin-bottom:16px;">
                    <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.5px;">
                        <i class="codicon codicon-eye"></i> Plantas detectadas en el HTML
                    </label>
                    <div style="border:1px solid var(--border); border-radius:6px; overflow:hidden; margin-top:8px; max-height:280px; overflow-y:auto;">
                        <table class="data-table" style="margin:0;">
                            <thead>
                                <tr>
                                    <th style="width:100px;">ID Planta</th>
                                    <th>Nombre Planta</th>
                                    <th style="width:90px; text-align:center;">Estado</th>
                                </tr>
                            </thead>
                            <tbody id="talleres-preview-tbody"></tbody>
                        </table>
                    </div>
                    <div id="talleres-preview-summary" style="margin-top:8px; font-size:12px; color:var(--text-secondary);"></div>
                </div>

                <!-- ACCIÓN -->
                <div style="display:flex; gap:10px; align-items:center;" id="talleres-actions">
                    <button class="btn-primary" id="talleres-sync-btn" onclick="syncTalleres()" style="display:none;">
                        <i class="codicon codicon-sync"></i> Sincronizar con Supabase
                    </button>
                    <button class="btn-secondary" onclick="document.getElementById('talleres-html-input').value=''; previewTalleres();">
                        <i class="codicon codicon-clear-all"></i> Limpiar
                    </button>
                </div>

                <!-- RESULTADO -->
                <div id="talleres-result" style="display:none; margin-top:16px;"></div>
            </div>
        </div>
    `;

    _talleresCurrentPage = 1;
    updateTalleresTable();
}

function switchTalleresView(view) {
    _talleresActiveTab = view;
    renderTalleresUI();
}

function filterTalleresTable() {
    _talleresCurrentPage = 1;
    updateTalleresTable();
}

function updateTalleresTable() {
    const tbody = document.getElementById('talleresTableBody');
    const counterEl = document.getElementById('talleresTotalCounter');
    const paginationEl = document.getElementById('talleresPaginationControls');
    if (!tbody) return;

    const map = window.globalTalleresMap || new Map();
    const term = (document.getElementById('tallerSearchTerm')?.value || '').toLowerCase().trim();

    const sorted = Array.from(map.entries()).sort((a, b) => {
        const numA = parseInt(a[0], 10);
        const numB = parseInt(b[0], 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(a[0]).localeCompare(String(b[0]));
    });

    const filtered = sorted.filter(([id, nombre]) => {
        const idStr = String(id).toLowerCase();
        const nomStr = String(nombre || '').toLowerCase();
        return idStr.includes(term) || nomStr.includes(term);
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / TALLERES_PER_PAGE) || 1;
    if (_talleresCurrentPage > totalPages) _talleresCurrentPage = totalPages;
    if (_talleresCurrentPage < 1) _talleresCurrentPage = 1;

    const start = (_talleresCurrentPage - 1) * TALLERES_PER_PAGE;
    const paginated = filtered.slice(start, start + TALLERES_PER_PAGE);

    if (counterEl) {
        counterEl.innerHTML = `<i class="codicon codicon-info"></i> Registrados: <strong>${map.size}</strong>${term ? ` (Filtrados: ${total})` : ''}`;
    }

    if (paginated.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align:center; padding:24px; color:var(--text-secondary);">
                    ${term ? 'No se encontraron plantas con ese término de búsqueda.' : 'No hay plantas registradas en el catálogo.'}
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = paginated.map(([id, nombre]) => `
            <tr>
                <td style="font-family:'Cascadia Code', monospace; font-size:13px; font-weight:700; color:var(--primary);">${id}</td>
                <td style="font-weight:500; font-size:13px;">${nombre || '<span style="color:var(--text-secondary); font-style:italic;">(Sin nombre)</span>'}</td>
                <td style="text-align:center;">
                    <div style="display:inline-flex; gap:4px; align-items:center;">
                        <button class="btn-icon" onclick="openTallerFormModal('${id}')" title="Editar planta">
                            <i class="codicon codicon-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="deleteTaller('${id}')" style="color:var(--error);" title="Eliminar planta">
                            <i class="codicon codicon-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    if (paginationEl) {
        paginationEl.innerHTML = `
            <button class="btn-icon" onclick="changeTalleresPage(-1)" ${_talleresCurrentPage <= 1 ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} title="Página anterior">
                <i class="codicon codicon-chevron-left"></i>
            </button>
            <span style="font-size:12px; color:var(--text-secondary);">Página ${_talleresCurrentPage} de ${totalPages}</span>
            <button class="btn-icon" onclick="changeTalleresPage(1)" ${_talleresCurrentPage >= totalPages ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} title="Página siguiente">
                <i class="codicon codicon-chevron-right"></i>
            </button>
        `;
    }
}

function changeTalleresPage(delta) {
    _talleresCurrentPage += delta;
    updateTalleresTable();
}

// ============================================
// 3. FORMULARIO (NUEVA / EDITAR PLANTA)
// ============================================

function openTallerFormModal(id_taller = null) {
    const isEdit = (id_taller !== null && id_taller !== undefined);
    _tallerEditId = isEdit ? String(id_taller) : null;

    const map = window.globalTalleresMap || new Map();
    const currentName = isEdit ? (map.get(String(id_taller)) || '') : '';

    const modal = createModal(
        `<i class="codicon codicon-home"></i> ${isEdit ? 'Editar Planta' : 'Nueva Planta'}`,
        `
        <div style="padding: 12px 4px;">
            <div class="form-group" style="margin-bottom: 14px;">
                <label style="display:block; font-size:11px; font-weight:600; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase;">
                    ID Planta
                </label>
                <input type="text" id="tallerFormId" class="form-control" 
                       value="${isEdit ? id_taller : ''}" 
                       ${isEdit ? 'readonly style="background:var(--sidebar); opacity:0.8; font-family:monospace;"' : 'placeholder="Ej: 45" style="font-family:monospace;"'}>
            </div>

            <div class="form-group" style="margin-bottom: 18px;">
                <label style="display:block; font-size:11px; font-weight:600; color:var(--text-secondary); margin-bottom:6px; text-transform:uppercase;">
                    Nombre de Planta
                </label>
                <input type="text" id="tallerFormNombre" class="form-control" 
                       value="${currentName}" 
                       placeholder="Ej: CONFECCIONES SAN JORGE" 
                       style="text-transform:uppercase;">
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; border-top:1px solid var(--border); padding-top:14px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove();">Cancelar</button>
                <button class="btn-primary" id="btnSaveTallerForm" onclick="saveTallerFromForm()">
                    <i class="codicon codicon-save"></i> Guardar
                </button>
            </div>
        </div>
        `,
        true
    );

    setTimeout(() => {
        const input = isEdit ? document.getElementById('tallerFormNombre') : document.getElementById('tallerFormId');
        if (input) input.focus();
    }, 100);
}

async function saveTallerFromForm() {
    const idInput = document.getElementById('tallerFormId');
    const nomInput = document.getElementById('tallerFormNombre');
    const saveBtn = document.getElementById('btnSaveTallerForm');
    if (!idInput || !nomInput || !saveBtn) return;

    const id = idInput.value.trim();
    const nombre = nomInput.value.trim().toUpperCase();

    if (!id) {
        showMessage('El ID de planta es requerido', 'warning');
        idInput.focus();
        return;
    }

    if (!nombre) {
        showMessage('El nombre de planta es requerido', 'warning');
        nomInput.focus();
        return;
    }

    const originalHTML = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="loading-spinner"></span> Guardando...';

    try {
        await supabase.upsert('global_talleres', {
            id_taller: id,
            taller: nombre
        }, 'id_taller');

        if (window.globalTalleresMap instanceof Map) {
            window.globalTalleresMap.set(id, nombre);
        }

        showMessage(`Planta "${id} - ${nombre}" guardada`, 'success', 2500);

        const modal = idInput.closest('.modal');
        if (modal) modal.remove();

        updateTalleresTable();
        if (typeof updateDataStats === 'function') updateDataStats();

    } catch (err) {
        console.error('Error guardando planta:', err);
        showMessage('Error al guardar: ' + err.message, 'error', 4000);
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHTML;
    }
}

async function deleteTaller(id_taller) {
    const map = window.globalTalleresMap || new Map();
    const nombre = map.get(String(id_taller)) || '';

    const confirmed = await showQuickConfirm(
        'Eliminar Planta',
        `¿Eliminar la planta <strong>${id_taller} — ${nombre}</strong> del catálogo?`,
        'Eliminar',
        'Cancelar',
        'error'
    );

    if (!confirmed) return;

    const loading = showQuickLoading('Eliminando planta...');
    try {
        await supabase.delete('global_talleres', { id_taller: String(id_taller) });

        if (window.globalTalleresMap instanceof Map) {
            window.globalTalleresMap.delete(String(id_taller));
        }

        showMessage(`Planta "${id_taller}" eliminada`, 'success', 2500);
        updateTalleresTable();
        if (typeof updateDataStats === 'function') updateDataStats();

    } catch (err) {
        console.error('Error eliminando planta:', err);
        showMessage('Error al eliminar: ' + err.message, 'error', 4000);
    } finally {
        loading.close();
    }
}

// ============================================
// 4. PARSEAR HTML Y SINCRONIZACIÓN (SISPRO)
// ============================================

function parseTalleresHtml(html) {
    const talleres = [];
    if (!html || !html.trim()) return talleres;

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
    const rows = doc.querySelectorAll('tr[id^="tr_taller_"]');

    rows.forEach(tr => {
        const idMatch = tr.id.match(/^tr_taller_(\d+)$/);
        if (!idMatch) return;
        const id_taller = idMatch[1];

        const celdas = tr.querySelectorAll('td');
        if (celdas.length < 2) return;
        const taller = (celdas[1].textContent || '').trim().toUpperCase();

        if (id_taller && taller) {
            talleres.push({ id_taller, taller });
        }
    });

    return talleres;
}

function previewTalleres() {
    const html = document.getElementById('talleres-html-input')?.value || '';
    const preview = document.getElementById('talleres-preview');
    const tbody = document.getElementById('talleres-preview-tbody');
    const summary = document.getElementById('talleres-preview-summary');
    const syncBtn = document.getElementById('talleres-sync-btn');
    const actions = document.getElementById('talleres-actions');

    const talleres = parseTalleresHtml(html);

    if (!talleres.length) {
        if (preview) preview.style.display = 'none';
        if (syncBtn) syncBtn.style.display = 'none';
        return;
    }

    tbody.innerHTML = talleres.map(t => `
        <tr>
            <td style="font-family:monospace; color:var(--primary); font-weight:700;">${t.id_taller}</td>
            <td>${t.taller}</td>
            <td style="text-align:center;">
                <span class="panel-badge" style="background:var(--info-dim); color:var(--info);">pendiente</span>
            </td>
        </tr>
    `).join('');

    summary.textContent = `${talleres.length} planta(s) detectada(s)`;
    preview.style.display = 'block';
    if (actions) actions.style.display = 'flex';
    if (syncBtn) syncBtn.style.display = 'inline-flex';

    window._talleresParaSync = talleres;
}

async function syncTalleres() {
    const talleres = window._talleresParaSync;
    if (!talleres || !talleres.length) {
        showMessage('No hay plantas para sincronizar', 'warning', 2000);
        return;
    }

    const btn = document.getElementById('talleres-sync-btn');
    const resultEl = document.getElementById('talleres-result');
    const tbody = document.getElementById('talleres-preview-tbody');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Sincronizando...';
    }

    let ok = 0, errores = 0;
    const errLog = [];
    const startTime = performance.now();

    for (const t of talleres) {
        try {
            await supabase.upsert('global_talleres', {
                id_taller: t.id_taller,
                taller:    t.taller
            }, 'id_taller');

            if (window.globalTalleresMap instanceof Map) {
                window.globalTalleresMap.set(t.id_taller, t.taller);
            }

            ok++;

            const rows = tbody.querySelectorAll('tr');
            const idx = talleres.indexOf(t);
            if (rows[idx]) {
                rows[idx].querySelector('.panel-badge').textContent = '✓ ok';
                rows[idx].querySelector('.panel-badge').style.cssText = 'background:var(--success-dim); color:var(--success);';
            }
        } catch (err) {
            errores++;
            errLog.push(`${t.id_taller} (${t.taller}): ${err.message}`);

            const rows = tbody.querySelectorAll('tr');
            const idx = talleres.indexOf(t);
            if (rows[idx]) {
                rows[idx].querySelector('.panel-badge').textContent = '✗ error';
                rows[idx].querySelector('.panel-badge').style.cssText = 'background:var(--error-dim); color:var(--error);';
            }
        }
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

    if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = errores === 0
            ? `<div class="notification success" style="margin:0;">
                   <i class="codicon codicon-check-all"></i>
                   <strong>${ok} planta(s) sincronizadas</strong> en ${elapsed}s
               </div>`
            : `<div class="notification warning" style="margin:0;">
                   <i class="codicon codicon-warning"></i>
                   <strong>${ok} ok / ${errores} errores</strong> en ${elapsed}s
                   <div style="margin-top:8px; font-size:11px; font-family:monospace; color:var(--text-secondary);">
                       ${errLog.map(e => `<div>• ${e}</div>`).join('')}
                   </div>
               </div>`;
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="codicon codicon-sync"></i> Sincronizar con Supabase';
    }

    showMessage(`${ok} planta(s) sincronizada(s)${errores ? `, ${errores} errores` : ''}`, errores ? 'warning' : 'success', 3000);
    if (typeof updateDataStats === 'function') updateDataStats();
}

// ============================================
// EXPORTS GLOBALES
// ============================================

window.showTalleresModal             = showTalleresModal;
window.renderTalleresUI             = renderTalleresUI;
window.switchTalleresView           = switchTalleresView;
window.filterTalleresTable          = filterTalleresTable;
window.changeTalleresPage           = changeTalleresPage;
window.openTallerFormModal          = openTallerFormModal;
window.saveTallerFromForm           = saveTallerFromForm;
window.deleteTaller                 = deleteTaller;
window.previewTalleres              = previewTalleres;
window.syncTalleres                 = syncTalleres;
window.showMissingGlobalDataModal   = showMissingGlobalDataModal;
window.showMissingTalleresModal     = showMissingTalleresModal;
window.saveMissingGlobalAndContinue = saveMissingGlobalAndContinue;
