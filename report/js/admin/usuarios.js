/* ==========================================================================
   admin/usuarios.js — Módulo Standalone de Gestión de Usuarios para ADMIN
   ========================================================================== */

let gsUserList = [];
let gsCurrentPage = 1;
const gsRecordsPerPage = 3; // Solicitado: más de 3 activa paginación

/**
 * Se inicializa cuando carga la página usuarios.html
 */
window.onload = async function() {
    if (typeof initParticles === 'function') initParticles();
    
    // loadUsers() en auth.js ejecuta fetchSecureConfig() y extrae la data de todos los usuarios
    await loadUsers(); 
    
    // Renderiza la lista con los datos locales que loadUsers() ya trajo
    cargarListaUsuariosLocal();
};

/**
 * Renderiza todos los usuarios usando los datos precargados para evitar llamadas API redundantes.
 */
function cargarListaUsuariosLocal() {
    const loader = document.getElementById('loader');
    const dataSection = document.getElementById('dataSection');

    // Chequear si existe loader en el DOM actual
    if (!loader || !dataSection) return;

    try {
        gsUserList = (typeof allUsers !== 'undefined' && allUsers.length > 0) ? allUsers : [];

        updateUserStats();
        renderUserTable(gsUserList);

        loader.style.display = 'none';
        dataSection.style.display = 'block';
    } catch (error) {
        console.error("Error al cargar lista de usuarios localmente:", error);
        loader.innerHTML = `<span class="text-danger fw-bold">Error interno de renderizado.</span>`;
    }
}

/**
 * Actualiza los contadores de métricas.
 */
function updateUserStats() {
    const stats = {
        pendientes: 0,
        activos: 0
    };

    gsUserList.forEach(u => {
        if (u.ROL === 'PENDIENTE') {
            stats.pendientes++;
        } else if (u.ROL) {
            stats.activos++;
        }
    });

    const pendingEl = document.getElementById('stat-pending');
    const activeEl = document.getElementById('stat-active');
    
    if (pendingEl) pendingEl.textContent = stats.pendientes;
    if (activeEl) activeEl.textContent = stats.activos;
}

/**
 * Renderiza la tabla de usuarios en usuarios.html
 */
function renderUserTable(usersToRender) {

    const tbody = document.getElementById('userTableBody');
    const pagContainer = document.getElementById('paginationUsers');
    if (!tbody) return;

    if (pagContainer) pagContainer.innerHTML = '';

    if (!usersToRender || usersToRender.length === 0) {
        tbody.innerHTML = `
            <div style="
                text-align:center; padding:3rem 1rem;
                color:#94a3b8; font-weight:600; font-size:0.9rem;
            ">
                <div style="font-size:2rem; margin-bottom:12px;">👤</div>
                No existen usuarios registrados.
            </div>`;
        return;
    }

    // Lógica de Paginación
    const totalRecords = usersToRender.length;
    const sliceStart = (gsCurrentPage - 1) * gsRecordsPerPage;
    const sliceEnd = sliceStart + gsRecordsPerPage;
    const paginatedData = usersToRender.slice(sliceStart, sliceEnd);

    if (totalRecords > gsRecordsPerPage) {
        renderPaginacion(totalRecords, usersToRender);
    }

    const ROL_META = {
        'ADMIN':     { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: 'fa-shield-halved' },
        'MODERATOR': { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: 'fa-user-tie'       },
        'USER-P':    { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: 'fa-industry'       },
        'USER-C':    { color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc', icon: 'fa-magnifying-glass' },
        'GUEST':     { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: 'fa-user'            },
        'PENDIENTE': { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'fa-user-clock'      },
    };

    const cUserID = (typeof currentUser !== 'undefined' && currentUser) ? String(currentUser.ID_USUARIO || currentUser.ID || '').trim() : null;

    tbody.innerHTML = `
        <div style="
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 20px;
            padding: 2px;
        ">
        ${paginatedData.map(user => {
            const isAdmin  = user.ROL === 'ADMIN';
            const isSelf   = cUserID === String(user.ID_USUARIO || user.ID || '').trim();
            const canEdit  = !isAdmin || isSelf;
            const meta     = ROL_META[user.ROL] || ROL_META['GUEST'];
            const initial  = (user.USUARIO || '?').charAt(0).toUpperCase();
            const avatarBg = meta.bg;
            const isPending = user.ROL === 'PENDIENTE';

            return `
            <div style="
                background: #fff;
                border: 1px solid #f1f5f9;
                border-radius: 16px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                overflow: hidden;
                transition: box-shadow 0.2s, transform 0.2s;
                display: flex;
                flex-direction: column;
            " onmouseover="this.style.boxShadow='0 6px 20px rgba(0,0,0,0.08)';this.style.transform='translateY(-2px)'"
               onmouseout="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)';this.style.transform='translateY(0)'">

                <!-- Card Header: Avatar + name + role badge -->
                <div style="
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                    padding: 16px 16px 12px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    border-bottom: 1px solid #f1f5f9;
                ">
                    <!-- Avatar -->
                    <div style="
                        width: 44px; height: 44px;
                        border-radius: 50%;
                        background: ${meta.bg};
                        border: 2px solid ${meta.border};
                        display: flex; align-items: center; justify-content: center;
                        font-size: 1.1rem; font-weight: 800;
                        color: ${meta.color};
                        flex-shrink: 0;
                        letter-spacing: -0.5px;
                    ">${initial}</div>

                    <div style="flex:1; min-width:0;">
                        <div style="
                            font-weight: 800; font-size: 0.88rem;
                            color: #0f172a; text-transform: uppercase;
                            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                        ">${user.USUARIO || '—'}</div>
                        <div style="
                            font-family: 'JetBrains Mono', monospace;
                            font-size: 0.65rem; color: #94a3b8;
                            font-weight: 600; margin-top: 2px;
                        "># ${user.ID_USUARIO || user.ID}</div>
                    </div>

                    <!-- Role badge -->
                    <span style="
                        background: ${meta.bg};
                        color: ${meta.color};
                        border: 1px solid ${meta.border};
                        padding: 3px 9px; border-radius: 20px;
                        font-size: 0.6rem; font-weight: 800;
                        text-transform: uppercase; letter-spacing: 0.5px;
                        flex-shrink: 0;
                        display: flex; align-items: center; gap: 5px;
                    ">
                        <i class="fas ${meta.icon}" style="font-size:0.55rem;"></i>
                        ${user.ROL || '?'}
                    </span>
                </div>

                <!-- Card Body: contact info -->
                <div style="padding: 12px 16px; flex:1; display:flex; flex-direction:column; gap:7px;">
                    <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem; color:#475569;">
                        <div style="
                            width:26px; height:26px; border-radius:8px;
                            background:#f1f5f9; display:flex;
                            align-items:center; justify-content:center; flex-shrink:0;
                        ">
                            <i class="fas fa-envelope" style="font-size:0.65rem; color:#94a3b8;"></i>
                        </div>
                        <span style="font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.78rem;">
                            ${user.CORREO || '—'}
                        </span>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px; font-size:0.8rem; color:#475569;">
                        <div style="
                            width:26px; height:26px; border-radius:8px;
                            background:#f1f5f9; display:flex;
                            align-items:center; justify-content:center; flex-shrink:0;
                        ">
                            <i class="fas fa-phone" style="font-size:0.65rem; color:#94a3b8;"></i>
                        </div>
                        <span style="font-weight:500; font-size:0.78rem;">
                            ${user.TELEFONO || '—'}
                        </span>
                    </div>

                    ${isPending ? `
                    <div style="
                        margin-top:4px;
                        background:#fffbeb; border:1px solid #fde68a;
                        border-radius:8px; padding:6px 10px;
                        font-size:0.7rem; color:#92400e; font-weight:600;
                        display:flex; align-items:center; gap:6px;
                    ">
                        <i class="fas fa-circle-exclamation" style="font-size:0.7rem;"></i>
                        Pendiente de aprobación
                    </div>` : ''}
                </div>

                <!-- Card Footer: action button -->
                <div style="
                    padding: 10px 16px;
                    border-top: 1px solid #f8fafc;
                    background: #fafbfc;
                ">
                    ${canEdit ? `
                    <button onclick="openEditUserModal('${user.ID_USUARIO || user.ID}')" style="
                        width: 100%; padding: 8px 0;
                        background: linear-gradient(135deg, #3b82f6, #6366f1);
                        color: #fff; border: none;
                        border-radius: 10px;
                        font-size: 0.75rem; font-weight: 700;
                        cursor: pointer; letter-spacing: 0.2px;
                        display: flex; align-items: center; justify-content: center; gap: 7px;
                        transition: filter 0.15s, transform 0.15s;
                    " onmouseover="this.style.filter='brightness(1.08)';this.style.transform='scale(1.01)'"
                       onmouseout="this.style.filter='';this.style.transform=''">
                        <i class="fas fa-user-pen" style="font-size:0.75rem;"></i>
                        Editar usuario
                    </button>
                    ` : `
                    <div style="
                        width:100%; text-align:center;
                        font-size:0.72rem; font-weight:700;
                        color:#94a3b8; letter-spacing:0.3px;
                        display:flex; align-items:center; justify-content:center; gap:6px;
                        padding:6px 0;
                    ">
                        <i class="fas fa-lock"></i> Protegido por jerarquía
                    </div>
                    `}
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
    btnPrev.onclick = () => { gsCurrentPage--; renderUserTable(dataRef); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    nav.appendChild(btnPrev);

    const info = document.createElement('span');
    info.className = 'page-info-lux';
    info.textContent = `Página ${gsCurrentPage} de ${totalPages}`;
    nav.appendChild(info);

    const btnNext = document.createElement('button');
    btnNext.className = 'page-btn-lux';
    btnNext.disabled = gsCurrentPage === totalPages;
    btnNext.innerHTML = `Siguiente <i class="fas fa-chevron-right"></i>`;
    btnNext.onclick = () => { gsCurrentPage++; renderUserTable(dataRef); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    nav.appendChild(btnNext);

    pagContainer.appendChild(nav);
}

function handleUserFilter() {
    gsCurrentPage = 1;
    const term = (document.getElementById('userSearchInput')?.value || '').toLowerCase().trim();
    
    const divisa = gsUserList.filter(u => {
        if (!term) return true;
        const userId = String(u.ID_USUARIO || u.ID || '').toLowerCase();
        return (u.USUARIO || '').toLowerCase().includes(term) ||
               (u.CORREO || '').toLowerCase().includes(term) ||
               userId.includes(term);
    });

    renderUserTable(divisa);
}



/**
 * Abre la ventana modal para editar todos los datos del usuario de forma estética.
 */
async function openEditUserModal(userId) {
    const user = gsUserList.find(u => {
        const dbId = String(u.ID_USUARIO || u.ID || '').trim();
        return dbId === String(userId).trim();
    });
    if (!user) return;

    const html = `
        <style>
            .edit-modal-lux { font-family: 'Inter', sans-serif; text-align: left; }
            .field-container-lux {
                margin-bottom: 12px;
                position: relative;
            }
            .label-lux {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 0.7rem;
                font-weight: 700;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 4px;
            }
            .label-lux i { color: #3b82f6; font-size: 0.8rem; }
            .input-lux {
                width: 100%;
                padding: 8px 14px;
                border-radius: 10px;
                border: 1.5px solid #e2e8f0;
                background: #f8fafc;
                font-size: 0.9rem;
                font-weight: 600;
                color: #1e293b;
                transition: all 0.2s;
            }
            .input-lux:focus {
                outline: none;
                border-color: #3b82f6;
                background: white;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.08);
            }
            .select-lux {
                height: 40px;
                cursor: pointer;
            }
            .pwd-hint {
                font-size: 0.6rem;
                color: #94a3b8;
                margin-top: 4px;
                line-height: 1.2;
            }
            .header-grad-lux {
                background: linear-gradient(135deg, #3f51b5 0%, #3b82f6 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                font-weight: 900;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 1.15rem;
                border-bottom: 1.5px solid #eff6ff;
                padding-bottom: 10px;
                margin-bottom: 15px;
            }
            @media (max-width: 480px) {
                .header-grad-lux { font-size: 1rem; }
                .input-lux { padding: 8px 10px; font-size: 0.85rem; }
            }
        </style>

        <div class="edit-modal-lux">
            <div class="header-grad-lux">
                <i class="fas fa-user-gear"></i> Gestión de Perfil
            </div>

            <div class="field-container-lux">
                <label class="label-lux"><i class="fas fa-signature"></i> Nombre</label>
                <input type="text" id="edit-nombre" class="input-lux" value="${user.USUARIO || ''}">
            </div>
            
            <div class="field-container-lux">
                <label class="label-lux"><i class="fas fa-envelope"></i> Correo</label>
                <input type="email" id="edit-correo" class="input-lux" value="${user.CORREO || ''}">
            </div>
            
            <div class="field-container-lux">
                <label class="label-lux"><i class="fas fa-phone"></i> Teléfono</label>
                <input type="tel" id="edit-telefono" class="input-lux" value="${user.TELEFONO || ''}">
            </div>
            
            <div class="field-container-lux">
                <label class="label-lux"><i class="fas fa-shield-halved"></i> Rol</label>
                <select id="edit-rol" class="input-lux select-lux">
                    <option value="ADMIN" ${user.ROL === 'ADMIN' ? 'selected' : ''}>ADMIN — Administrador</option>
                    <option value="MODERATOR" ${user.ROL === 'MODERATOR' ? 'selected' : ''}>MODERATOR — Moderador de Calidad</option>
                    <option value="USER-P" ${user.ROL === 'USER-P' ? 'selected' : ''}>USER-P — Producción</option>
                    <option value="USER-C" ${user.ROL === 'USER-C' ? 'selected' : ''}>USER-C — Calidad</option>
                    <option value="GUEST" ${user.ROL === 'GUEST' ? 'selected' : ''}>GUEST — Visualizador</option>
                    <option value="PENDIENTE" ${user.ROL === 'PENDIENTE' ? 'selected' : ''}>PENDIENTE — Sin Acceso</option>
                </select>
            </div>
            
            <div class="field-container-lux">
                <label class="label-lux"><i class="fas fa-key"></i> Nueva Clave</label>
                <input type="text" id="edit-password" class="input-lux" style="font-family: monospace;" placeholder="Opcional">
                <div class="pwd-hint">Deje en blanco si no desea cambiarla.</div>
            </div>
        </div>
    `;

    const { value: formValues } = await Swal.fire({
        html: html,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'GUARDAR',
        cancelButtonText: 'SALIR',
        confirmButtonColor: '#3F51B5',
        width: window.innerWidth < 500 ? '92%' : '440px',
        padding: window.innerWidth < 500 ? '1rem' : '1.5rem',
        background: '#ffffff',
        customClass: {
            popup: 'shadow-2xl border-0 rounded-4 animate__animated animate__fadeInUp',
            confirmButton: 'rounded-pill px-4 py-2 fw-bold small',
            cancelButton: 'rounded-pill px-4 py-2 fw-bold small'
        },
        preConfirm: () => {
            const nombre = document.getElementById('edit-nombre').value.trim();
            if(!nombre) {
                Swal.showValidationMessage('El nombre es un campo obligatorio');
                return false;
            }
            return {
                usuario: nombre,
                correo: document.getElementById('edit-correo').value.trim(),
                telefono: document.getElementById('edit-telefono').value.trim(),
                rol: document.getElementById('edit-rol').value,
                password: document.getElementById('edit-password').value.trim()
            };
        }
    });

    if (formValues) {
        try {
            Swal.fire({
                title: 'Guardando...',
                text: 'Procesando cambios en el servidor',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
            
            const response = await sendToGAS({
                accion: 'UPDATE_USER',
                hoja: 'USUARIOS',
                id: userId,
                usuario: formValues.usuario,
                correo: formValues.correo,
                telefono: formValues.telefono,
                rol: formValues.rol,
                password: formValues.password
            });

            if (response.success) {
                Swal.fire({
                    title: '✔ ¡Actualizado!',
                    text: 'Los datos del usuario se guardaron con éxito.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
                
                // Actualizar la memoria local para inmediatez reactiva
                const userIndex = gsUserList.findIndex(u => {
                    const dbId = String(u.ID_USUARIO || u.ID || '').trim();
                    return dbId === String(userId).trim();
                });
                if (userIndex !== -1) {
                    gsUserList[userIndex].USUARIO = formValues.usuario;
                    gsUserList[userIndex].CORREO = formValues.correo;
                    gsUserList[userIndex].TELEFONO = formValues.telefono;
                    gsUserList[userIndex].ROL = formValues.rol;
                }
                
                updateUserStats();
                handleUserFilter();

            } else {
                Swal.fire('Error del Servidor', response.message, 'error');
            }
        } catch (error) {
            Swal.fire('Error de Conexión', 'No se pudieron establecer los cambios. Revise su conexión.', 'error');
        }
    }
}
