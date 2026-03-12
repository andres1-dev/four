/* ==========================================================================
   admin/usuarios.js — Módulo Standalone de Gestión de Usuarios para ADMIN
   ========================================================================== */

let gsUserList = [];

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
    if (!tbody) return;

    if (!usersToRender || usersToRender.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center fw-bold py-4 text-muted">No existen usuarios registrados.</td></tr>';
        return;
    }

    tbody.innerHTML = usersToRender.map(user => {
        const isPending = user.ROL === 'PENDIENTE';
        const badgeColor = isPending ? '#f59e0b' : (user.ROL === 'ADMIN' ? '#ef4444' : '#3b82f6');
        const badgeBg = isPending ? '#fffbeb' : (user.ROL === 'ADMIN' ? '#fef2f2' : '#eff6ff');
        
        // Regla de Seguridad: Ningún admin puede editar a otro admin.
        const cUserID = (typeof currentUser !== 'undefined' && currentUser) ? String(currentUser.ID).trim() : null;
        const targetID = String(user.ID).trim();
        const isAdmin = user.ROL === 'ADMIN';
        const isSelf = cUserID === targetID;
        const canEdit = !isAdmin || isSelf;

        return `
        <tr class="user-row" style="border-bottom: 1px solid #f1f5f9;">
            <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #475569;">${user.ID}</td>
            <td>
                <div style="font-weight: 800; color: #0f172a; margin-bottom: 2px; text-transform: uppercase;">${user.USUARIO}</div>
                <div style="font-size: 0.75rem; color: #64748b; font-weight: 500;">
                    <i class="fas fa-envelope me-1"></i> ${user.CORREO} <br/>
                    <i class="fas fa-phone me-1 mt-1"></i> ${user.TELEFONO}
                </div>
            </td>
            <td>
                <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 10px; border-radius: 8px; font-weight: 700; font-size: 0.75rem;">
                    ${user.ROL || 'DESCONOCIDO'}
                </span>
            </td>
            <td class="text-center role-actions">
                ${canEdit ? `
                <button class="btn btn-sm" style="background: #eff6ff; color: #3b82f6; border: none; font-weight: 700; font-size: 0.8rem; padding: 6px 14px;" onclick="openEditUserModal('${user.ID}')">
                    <i class="fas fa-user-edit me-1"></i> Editar
                </button>
                ` : `
                <span class="text-muted small fw-bold" title="Bloqueado por seguridad de jerarquía"><i class="fas fa-lock me-1"></i> Intocable</span>
                `}
            </td>
        </tr>
        `;
    }).join('');
}

/**
 * Filtra los usuarios en vivo en la pantalla.
 */
function handleUserFilter() {
    const term = (document.getElementById('userSearchInput')?.value || '').toLowerCase().trim();
    
    const divisa = gsUserList.filter(u => {
        if (!term) return true;
        return (u.USUARIO || '').toLowerCase().includes(term) ||
               (u.CORREO || '').toLowerCase().includes(term) ||
               (u.ID || '').toLowerCase().includes(term);
    });

    renderUserTable(divisa);
}

/**
 * Abre la ventana modal para editar todos los datos del usuario.
 */
async function openEditUserModal(userId) {
    const user = gsUserList.find(u => String(u.ID).trim() === String(userId).trim());
    if (!user) return;

    const html = `
        <div class="text-start p-1">
            <label class="form-label small fw-bold text-muted mb-1">Nombre Completo</label>
            <input type="text" id="edit-nombre" class="form-control mb-3" style="font-weight: 600;" value="${user.USUARIO || ''}">
            
            <label class="form-label small fw-bold text-muted mb-1">Correo Electrónico</label>
            <input type="email" id="edit-correo" class="form-control mb-3" style="font-weight: 600;" value="${user.CORREO || ''}">
            
            <label class="form-label small fw-bold text-muted mb-1">Teléfono</label>
            <input type="tel" id="edit-telefono" class="form-control mb-3" style="font-weight: 600;" value="${user.TELEFONO || ''}">
            
            <label class="form-label small fw-bold text-muted mb-1">Rol del Sistema</label>
            <select id="edit-rol" class="form-select mb-3" style="font-weight: 600;">
                <option value="ADMIN" ${user.ROL === 'ADMIN' ? 'selected' : ''}>ADMIN - Administrador</option>
                <option value="USER-P" ${user.ROL === 'USER-P' ? 'selected' : ''}>USER-P - Producción</option>
                <option value="USER-C" ${user.ROL === 'USER-C' ? 'selected' : ''}>USER-C - Calidad</option>
                <option value="GUEST" ${user.ROL === 'GUEST' ? 'selected' : ''}>GUEST - Invitado</option>
                <option value="PENDIENTE" ${user.ROL === 'PENDIENTE' ? 'selected' : ''}>PENDIENTE - Sin Acceso</option>
            </select>
            
            <label class="form-label small fw-bold text-muted mb-1">Contraseña de Acceso <span style="font-size:0.75rem; font-weight:normal; color:#9ca3af;">(opcional)</span></label>
            <input type="text" id="edit-password" class="form-control" style="font-weight: 600; font-family: monospace;" placeholder="Escriba aquí para cambiarla">
            <small class="text-muted mt-1 d-block" style="font-size: 0.7rem;">Deje este campo en blanco si no desea modificar la contraseña actual.</small>
        </div>
    `;

    const { value: formValues } = await Swal.fire({
        title: '<i class="fas fa-user-cog" style="color: #3f51b5;"></i> Panel de Usuario',
        html: html,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Cambios',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3F51B5',
        customClass: { popup: 'rounded-4 shadow-lg' },
        preConfirm: () => {
            const nombre = document.getElementById('edit-nombre').value.trim();
            if(!nombre) {
                Swal.showValidationMessage('El nombre no puede estar vacío');
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
                const userIndex = gsUserList.findIndex(u => String(u.ID).trim() === String(userId).trim());
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
