/* ==========================================================================
   admin/usuarios.js — Módulo Standalone de Gestión de Usuarios y Plantas
   ========================================================================== */

let gsUserList = [];
let gsPlantList = [];
let gsCurrentMode = 'USERS'; // 'USERS' o 'PLANTS'
let gsCurrentPage = 1;
const gsRecordsPerPage = 6; 

window.onload = async function() {
    // 1. Validar sesión ADMIN antes de mostrar el panel
    await loadUsers();


    
    initTabs();
    cargarDatosLocales();
};

function initTabs() {
    const searchBar = document.querySelector('.unified-tool-bar');
    if (!searchBar) return;

    const tabsHtml = `
        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <button id="tab-users" class="btn-tab-admin active" onclick="switchAdminMode('USERS')">
                <i class="fas fa-users-gear"></i> Empleados TMD
            </button>
            <button id="tab-plants" class="btn-tab-admin" onclick="switchAdminMode('PLANTS')">
                <i class="fas fa-industry"></i> Plantas / Talleres
            </button>
        </div>
        <style>
            .btn-tab-admin {
                padding: 10px 20px;
                border-radius: 12px;
                border: 1.5px solid #e2e8f0;
                background: white;
                color: #64748b;
                font-size: 0.85rem;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .btn-tab-admin.active {
                background: #3f51b5;
                color: white;
                border-color: #3f51b5;
                box-shadow: 0 4px 12px rgba(63, 81, 181, 0.2);
            }
            .btn-tab-admin:hover:not(.active) {
                border-color: #3b82f6;
                color: #3b82f6;
            }
        </style>
    `;
    searchBar.insertAdjacentHTML('beforebegin', tabsHtml);
}

function switchAdminMode(mode) {
    gsCurrentMode = mode;
    gsCurrentPage = 1;

    document.getElementById('tab-users').classList.toggle('active', mode === 'USERS');
    document.getElementById('tab-plants').classList.toggle('active', mode === 'PLANTS');

    const searchInput = document.getElementById('userSearchInput');
    if (searchInput) {
        searchInput.placeholder = mode === 'USERS' 
            ? "Filtrar empleados por nombre, ID o correo..." 
            : "Filtrar plantas por nombre, NIT o ciudad...";
        searchInput.value = '';
    }

    cargarDatosLocales();
}

function cargarDatosLocales() {
    const loader = document.getElementById('loader');
    const dataSection = document.getElementById('dataSection');
    if (!loader || !dataSection) return;

    try {
        gsUserList = (typeof allUsers !== 'undefined') ? allUsers : [];
        gsPlantList = (typeof allPlantas !== 'undefined') ? allPlantas : [];

        updateStats();
        handleFilter();

        loader.style.display = 'none';
        dataSection.style.display = 'block';
    } catch (error) {
        console.error("Error al cargar datos localmente:", error);
    }
}

function updateStats() {
    const stats = { pending: 0, total: 0 };
    
    if (gsCurrentMode === 'USERS') {
        gsUserList.forEach(u => {
            if (u.ROL === 'PENDIENTE') stats.pending++;
            stats.total++;
        });
    } else {
        gsPlantList.forEach(p => {
            stats.total++;
        });
    }

    const pendingEl = document.getElementById('stat-pending');
    const activeEl = document.getElementById('stat-active');
    
    if (pendingEl) pendingEl.textContent = stats.pending;
    if (activeEl) activeEl.textContent = stats.total;
    
    const pendingLab = pendingEl?.closest('.stat-card-mini')?.querySelector('.stat-lab');
    const totalLab = activeEl?.closest('.stat-card-mini')?.querySelector('.stat-lab');
    if (pendingLab) pendingLab.textContent = gsCurrentMode === 'USERS' ? 'Pendientes' : '—';
    if (totalLab) totalLab.textContent = gsCurrentMode === 'USERS' ? 'Total Empleados' : 'Total Plantas';
}

function renderTable(dataToRender) {
    const tbody = document.getElementById('userTableBody');
    const pagContainer = document.getElementById('paginationUsers');
    if (!tbody) return;

    if (pagContainer) pagContainer.innerHTML = '';

    if (!dataToRender || dataToRender.length === 0) {
        tbody.innerHTML = `
            <div style="text-align:center; padding:3rem 1rem; color:#94a3b8; font-weight:600;">
                <div style="font-size:2rem; margin-bottom:12px;">🔍</div>
                No se encontraron registros.
            </div>`;
        return;
    }

    const totalRecords = dataToRender.length;
    const sliceStart = (gsCurrentPage - 1) * gsRecordsPerPage;
    const sliceEnd = sliceStart + gsRecordsPerPage;
    const paginatedData = dataToRender.slice(sliceStart, sliceEnd);

    if (totalRecords > gsRecordsPerPage) {
        renderPaginacion(totalRecords, dataToRender);
    }

    const ROL_META = {
        'ADMIN':     { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'fa-shield-halved' },
        'MODERATOR': { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: 'fa-user-tie'       },
        'USER-P':    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: 'fa-industry'       },
        'USER-C':    { color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc', icon: 'fa-magnifying-glass' },
        'GUEST':     { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: 'fa-user'            },
        'PENDIENTE': { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'fa-user-clock'      },
    };

    const currentId = (typeof currentUser !== 'undefined' && currentUser) ? String(currentUser.ID_USUARIO || currentUser.ID_PLANTA || currentUser.ID || '').trim() : null;

    tbody.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
        ${paginatedData.map(item => {
            const isPlant = gsCurrentMode === 'PLANTS';
            const id = isPlant ? (item.ID_PLANTA || item.ID) : (item.ID_USUARIO || item.ID);
            const name = isPlant ? item.PLANTA : item.USUARIO;
            const email = item.EMAIL || item.CORREO;
            const rol = item.ROL || 'GUEST';
            const meta = ROL_META[rol] || ROL_META['GUEST'];
            const initial = String(name || '?').charAt(0).toUpperCase();
            const isSelf = currentId === String(id).trim();
            const canEdit = !isPlant ? (rol !== 'ADMIN' || isSelf) : true;

            return `
            <div class="admin-card-lux" style="background:#fff; border:1px solid #f1f5f9; border-radius:16px; box-shadow:0 2px 8px rgba(0,0,0,0.04); overflow:hidden; display:flex; flex-direction:column;">
                <div style="background:linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding:16px; display:flex; align-items:center; gap:12px; border-bottom:1px solid #f1f5f9;">
                    <div style="width:44px; height:44px; border-radius:50%; background:${meta.bg}; border:2px solid ${meta.border}; display:flex; align-items:center; justify-content:center; font-size:1.1rem; font-weight:800; color:${meta.color}; flex-shrink:0;">${initial}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:800; font-size:0.88rem; color:#0f172a; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${name}</div>
                        <div style="font-family:'JetBrains Mono', monospace; font-size:0.65rem; color:#94a3b8; font-weight:600;"># ${id}</div>
                    </div>
                    <span style="background:${meta.bg}; color:${meta.color}; border:1px solid ${meta.border}; padding:3px 9px; border-radius:20px; font-size:0.6rem; font-weight:800; text-transform:uppercase; display:flex; align-items:center; gap:5px;">
                        <i class="fas ${isPlant ? 'fa-industry' : meta.icon}"></i> ${rol}
                    </span>
                </div>
                <div style="padding:16px; flex:1; display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem; color:#475569;">
                        <i class="fas fa-envelope" style="width:16px; color:#94a3b8;"></i>
                        <span style="overflow:hidden; text-overflow:ellipsis;">${email || '—'}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem; color:#475569;">
                        <i class="fas fa-phone" style="width:16px; color:#94a3b8;"></i>
                        <span>${item.TELEFONO || '—'}</span>
                    </div>
                    ${isPlant ? `
                    <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem; color:#475569;">
                        <i class="fas fa-location-dot" style="width:16px; color:#94a3b8;"></i>
                        <span style="overflow:hidden; text-overflow:ellipsis;">${item.DIRECCION || '—'}</span>
                    </div>` : ''}
                </div>
                <div style="padding:12px 16px; border-top:1px solid #f8fafc; background:#fafbfc;">
                    ${canEdit ? `
                    <button onclick="openEditModal('${id}')" style="width:100%; padding:8px; background:linear-gradient(135deg, #3b82f6, #6366f1); color:#fff; border:none; border-radius:10px; font-size:0.75rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px;">
                        <i class="fas fa-pen-to-square"></i> Editar Datos
                    </button>` : '<div style="text-align:center; font-size:0.7rem; color:#94a3b8; font-weight:700;"><i class="fas fa-lock"></i> Protegido</div>'}
                </div>
            </div>`;
        }).join('')}
        </div>
    `;
}

function renderPaginacion(totalRecords, dataRef) {
    const pagContainer = document.getElementById('paginationUsers');
    if (!pagContainer) return;

    const totalPages = Math.ceil(totalRecords / gsRecordsPerPage);
    if (totalPages <= 1) return;

    const nav = document.createElement('div');
    nav.className = 'pagination-container-lux';

    const btnPrev = document.createElement('button');
    btnPrev.className = 'page-btn-lux';
    btnPrev.disabled = gsCurrentPage === 1;
    btnPrev.innerHTML = `<i class="fas fa-chevron-left"></i> Anterior`;
    btnPrev.onclick = () => { gsCurrentPage--; renderTable(dataRef); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    nav.appendChild(btnPrev);

    const info = document.createElement('span');
    info.className = 'page-info-lux';
    info.textContent = `Página ${gsCurrentPage} de ${totalPages}`;
    nav.appendChild(info);

    const btnNext = document.createElement('button');
    btnNext.className = 'page-btn-lux';
    btnNext.disabled = gsCurrentPage === totalPages;
    btnNext.innerHTML = `Siguiente <i class="fas fa-chevron-right"></i>`;
    btnNext.onclick = () => { gsCurrentPage++; renderTable(dataRef); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    nav.appendChild(btnNext);

    pagContainer.appendChild(nav);
}

function handleFilter() {
    gsCurrentPage = 1;
    const term = (document.getElementById('userSearchInput')?.value || '').toLowerCase().trim();
    const dataList = gsCurrentMode === 'USERS' ? gsUserList : gsPlantList;
    
    const filtered = dataList.filter(item => {
        if (!term) return true;
        const name = (gsCurrentMode === 'USERS' ? item.USUARIO : item.PLANTA) || '';
        const id = (gsCurrentMode === 'USERS' ? (item.ID_USUARIO || item.ID) : (item.ID_PLANTA || item.ID)) || '';
        const email = (gsCurrentMode === 'USERS' ? item.CORREO : item.EMAIL) || '';
        return name.toLowerCase().includes(term) || 
               id.toString().toLowerCase().includes(term) || 
               email.toLowerCase().includes(term);
    });

    renderTable(filtered);
}

// Compatibilidad con llamadas desde HTML
const handleUserFilter = handleFilter;

async function openEditModal(targetId) {
    const isPlant = gsCurrentMode === 'PLANTS';
    const dataList = isPlant ? gsPlantList : gsUserList;
    
    const entry = dataList.find(item => {
        const dbId = isPlant ? (item.ID_PLANTA || item.ID) : (item.ID_USUARIO || item.ID);
        return String(dbId).trim() === String(targetId).trim();
    });
    
    if (!entry) return;

    const name = isPlant ? entry.PLANTA : entry.USUARIO;
    const email = isPlant ? entry.EMAIL : entry.CORREO;

    const html = `
        <style>
            .edit-modal-lux { font-family: 'Inter', sans-serif; text-align: left; }
            .field-container-lux { margin-bottom: 12px; }
            .label-lux { display: flex; align-items: center; gap: 6px; font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
            .input-lux { width: 100%; padding: 8px 14px; border-radius: 10px; border: 1.5px solid #e2e8f0; background: #f8fafc; font-size: 0.9rem; font-weight: 600; color: #1e293b; }
            .input-lux:focus { outline: none; border-color: #3b82f6; background: white; }
            .header-grad-lux { background: linear-gradient(135deg, #3f51b5 0%, #3b82f6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 900; font-size: 1.15rem; border-bottom: 1.5px solid #eff6ff; padding-bottom: 10px; margin-bottom: 15px; }
        </style>

        <div class="edit-modal-lux">
            <div class="header-grad-lux">
                <i class="fas ${isPlant ? 'fa-industry' : 'fa-user-gear'}"></i> ${isPlant ? 'Gestión de Planta' : 'Gestión de Perfil'}
            </div>

            <div class="field-container-lux">
                <label class="label-lux"><i class="fas fa-signature"></i> ${isPlant ? 'Nombre Planta' : 'Nombre Completo'}</label>
                <input type="text" id="edit-nombre" class="input-lux" value="${name || ''}">
            </div>
            
            <div class="field-container-lux">
                <label class="label-lux"><i class="fas fa-envelope"></i> Correo</label>
                <input type="email" id="edit-correo" class="input-lux" value="${email || ''}">
            </div>
            
            <div class="field-container-lux">
                <label class="label-lux"><i class="fas fa-phone"></i> Teléfono</label>
                <input type="tel" id="edit-telefono" class="input-lux" value="${entry.TELEFONO || ''}">
            </div>

            ${isPlant ? `
            <div class="field-container-lux">
                <label class="label-lux"><i class="fas fa-location-dot"></i> Dirección</label>
                <input type="text" id="edit-direccion" class="input-lux" value="${entry.DIRECCION || ''}">
            </div>` : ''}
            
            <div class="field-container-lux">
                <label class="label-lux"><i class="fas fa-shield-halved"></i> Rol</label>
                <select id="edit-rol" class="input-lux">
                    ${!isPlant ? `
                    <option value="ADMIN" ${entry.ROL === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                    <option value="MODERATOR" ${entry.ROL === 'MODERATOR' ? 'selected' : ''}>MODERATOR</option>
                    <option value="USER-P" ${entry.ROL === 'USER-P' ? 'selected' : ''}>USER-P</option>
                    <option value="USER-C" ${entry.ROL === 'USER-C' ? 'selected' : ''}>USER-C</option>
                    <option value="GUEST" ${entry.ROL === 'GUEST' ? 'selected' : ''}>GUEST</option>
                    <option value="PENDIENTE" ${entry.ROL === 'PENDIENTE' ? 'selected' : ''}>PENDIENTE</option>
                    ` : `
                    <option value="GUEST" selected>GUEST (Acceso Taller)</option>
                    `}
                </select>
            </div>
            
            <div class="field-container-lux">
                <label class="label-lux"><i class="fas fa-key"></i> Clave Acceso</label>
                <input type="text" id="edit-password" class="input-lux" placeholder="Nueva clave (opcional)">
            </div>
        </div>
    `;

    const { value: formValues } = await Swal.fire({
        html: html,
        showCancelButton: true,
        confirmButtonText: 'GUARDAR CAMBIOS',
        confirmButtonColor: '#3F51B5',
        width: '440px',
        preConfirm: () => {
            return {
                nombre: document.getElementById('edit-nombre').value.trim(),
                correo: document.getElementById('edit-correo').value.trim(),
                telefono: document.getElementById('edit-telefono').value.trim(),
                direccion: isPlant ? document.getElementById('edit-direccion').value.trim() : null,
                rol: document.getElementById('edit-rol').value,
                password: document.getElementById('edit-password').value.trim()
            };
        }
    });

    if (formValues) {
        try {
            Swal.fire({ title: 'Guardando...', didOpen: () => Swal.showLoading() });
            
            const payload = {
                accion: isPlant ? 'UPSERT_PLANTA' : 'UPDATE_USER',
                hoja: isPlant ? 'PLANTAS' : 'USUARIOS',
                cedula: targetId,
                id: targetId,
                nombrePlanta: isPlant ? formValues.nombre : null,
                usuario: !isPlant ? formValues.nombre : null,
                correo: formValues.correo,
                email: isPlant ? formValues.correo : null,
                telefono: formValues.telefono,
                direccion: formValues.direccion,
                rol: formValues.rol,
                password: formValues.password
            };

            const response = await sendToGAS(payload);

            if (response.success) {
                Swal.fire('✔ ¡Hecho!', 'Datos actualizados correctamente.', 'success');
                await loadUsers(); 
                cargarDatosLocales();
            } else {
                Swal.fire('Error', response.message, 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'No se pudo conectar con el servidor', 'error');
        }
    }
}
