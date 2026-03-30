/**
 * User Management System - OWNER Only
 * Sistema de gestión de usuarios para el rol OWNER
 */

// Configuración
const USER_MANAGEMENT = {
    API_KEY: 'AIzaSyCrTSddJcCaJCqQ_Cr_PC2zt-eVZAihC38',
    SPREADSHEET_ID: '133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI',
    LOGIN_RANGE: 'LOGIN!A2:I',
    GAS_URL: 'https://script.google.com/macros/s/AKfycbzFkQsoAMCfnkoBHSTMMx4evKkAkwkBVlCu3eHIMVcam41GR2Q1_9YffhJSf8SeOC3_/exec'
};

// Verificar si el usuario actual es OWNER
function isOwner() {
    try {
        const session = JSON.parse(sessionStorage.getItem('tdm_session') || 'null');
        return session && session.rol && String(session.rol).toUpperCase() === 'OWNER';
    } catch (e) {
        return false;
    }
}

// Obtener lista de usuarios desde Google Sheets
async function fetchUsers() {
    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${USER_MANAGEMENT.SPREADSHEET_ID}/values/${encodeURIComponent(USER_MANAGEMENT.LOGIN_RANGE)}?key=${USER_MANAGEMENT.API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error al obtener usuarios: ${response.status}`);
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        // Mapear datos: A=USUARIO B=NOMBRE C=CORREO D=TELEFONO E=ROL F=CONTRASEÑA G=TIMESTAMP H=ID_DEVICE I=ACTIVO
        return rows.map((row, index) => ({
            rowIndex: index + 2, // +2 porque empezamos en A2
            usuario: row[0] || '',
            nombre: row[1] || '',
            correo: row[2] || '',
            telefono: row[3] || '',
            rol: row[4] || 'USER',
            password: row[5] || '',
            timestamp: row[6] || '',
            id_device: row[7] || '',
            activo: row[8] || '0'
        }));
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        throw error;
    }
}

// Actualizar usuario en Google Sheets vía GAS
async function updateUser(userData) {
    try {
        const formData = new FormData();
        formData.append('action', 'update_user');
        formData.append('usuario', userData.usuario);
        formData.append('nombre', userData.nombre);
        formData.append('correo', userData.correo);
        formData.append('telefono', userData.telefono);
        formData.append('rol', userData.rol);
        if (userData.password) {
            formData.append('password', userData.password);
        }
        formData.append('activo', userData.activo);
        
        const response = await fetch(USER_MANAGEMENT.GAS_URL, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        return { success: false, message: error.message };
    }
}

// Crear nuevo usuario vía GAS
async function createUser(userData) {
    try {
        const formData = new FormData();
        formData.append('action', 'create_user');
        formData.append('usuario', userData.usuario);
        formData.append('nombre', userData.nombre);
        formData.append('correo', userData.correo);
        formData.append('telefono', userData.telefono);
        formData.append('rol', userData.rol);
        formData.append('password', userData.password);
        
        const response = await fetch(USER_MANAGEMENT.GAS_URL, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error al crear usuario:', error);
        return { success: false, message: error.message };
    }
}

// Cerrar sesión de un usuario (limpiar device)
async function logoutUser(usuario) {
    try {
        const formData = new FormData();
        formData.append('action', 'logout_user');
        formData.append('usuario', usuario);
        
        const response = await fetch(USER_MANAGEMENT.GAS_URL, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        return { success: false, message: error.message };
    }
}

// Mostrar modal de gestión de usuarios
async function showUserManagementModal() {
    if (!isOwner()) {
        alert('Acceso denegado. Solo el OWNER puede gestionar usuarios.');
        return;
    }
    
    // Crear modal
    const modal = document.createElement('div');
    modal.id = 'userManagementModal';
    modal.className = 'user-management-modal';
    modal.innerHTML = `
        <div class="user-management-content">
            <div class="user-management-header">
                <h2 class="user-management-title">
                    <i class="fas fa-users-cog"></i>
                    Gestión de Usuarios
                </h2>
                <button class="user-management-close" id="closeUserManagement">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="user-management-body">
                <div class="user-management-actions">
                    <button class="btn-add-user" id="addUserBtn">
                        <i class="fas fa-user-plus"></i>
                        Nuevo Usuario
                    </button>
                    <button class="btn-refresh-users" id="refreshUsersBtn">
                        <i class="fas fa-sync-alt"></i>
                        Actualizar
                    </button>
                </div>
                <div class="users-cards-container" id="usersCardsContainer">
                    <div class="loading-cell">
                        <i class="fas fa-spinner fa-spin"></i> Cargando usuarios...
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('closeUserManagement').addEventListener('click', () => {
        modal.remove();
    });
    
    document.getElementById('addUserBtn').addEventListener('click', () => {
        showUserFormModal();
    });
    
    document.getElementById('refreshUsersBtn').addEventListener('click', () => {
        loadUsersTable();
    });
    
    // Cerrar al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Cargar usuarios
    await loadUsersTable();
}

// Cargar tarjetas de usuarios
async function loadUsersTable() {
    const cardsContainer = document.getElementById('usersCardsContainer');
    
    try {
        cardsContainer.innerHTML = `
            <div class="loading-cell">
                <i class="fas fa-spinner fa-spin"></i> Cargando usuarios...
            </div>
        `;
        
        const users = await fetchUsers();
        
        if (users.length === 0) {
            cardsContainer.innerHTML = `
                <div class="empty-cell">
                    <i class="fas fa-users"></i>
                    <p>No hay usuarios registrados</p>
                    <button class="btn-add-user" onclick="showUserFormModal()">
                        <i class="fas fa-user-plus"></i>
                        Crear primer usuario
                    </button>
                </div>
            `;
            return;
        }
        
        // Renderizar tarjetas
        cardsContainer.innerHTML = users.map(user => {
            const isActive = user.activo === '1';
            const hasSession = user.id_device && user.id_device.trim() !== '';
            const config = getRoleConfig(user.rol);
            
            return `
                <div class="user-card ${!isActive ? 'inactive' : ''}" data-usuario="${user.usuario}">
                    <div class="user-card-header">
                        <div class="user-card-avatar" style="background: ${config.color}15; border-color: ${config.color}30;">
                            <i class="fas ${config.icon}" style="color: ${config.color};"></i>
                        </div>
                        <div class="user-card-info">
                            <div class="user-card-name">${user.nombre}</div>
                            <div class="user-card-username">${user.usuario}</div>
                        </div>
                    </div>
                    
                    <div class="user-card-body">
                        <div class="user-card-field">
                            <i class="fas fa-envelope"></i>
                            <div class="user-card-field-content">
                                <div class="user-card-label">Correo</div>
                                <div class="user-card-value">${user.correo || 'No especificado'}</div>
                            </div>
                        </div>
                        <div class="user-card-field">
                            <i class="fas fa-phone"></i>
                            <div class="user-card-field-content">
                                <div class="user-card-label">Teléfono</div>
                                <div class="user-card-value">${user.telefono || 'No especificado'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="user-card-footer">
                        <div class="user-card-badges">
                            <span class="role-badge" style="background: ${config.color}15; color: ${config.color};">
                                <i class="fas ${config.icon}"></i>
                                ${config.label}
                            </span>
                            ${isActive ? `
                                <span class="status-badge active">
                                    <i class="fas fa-check-circle"></i>
                                    Activo
                                </span>
                            ` : `
                                <span class="status-badge inactive">
                                    <i class="fas fa-ban"></i>
                                    Inactivo
                                </span>
                            `}
                        </div>
                        <div class="user-card-actions">
                            <button class="btn-action edit" onclick="editUser('${user.usuario}')" title="Editar usuario">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${hasSession ? `
                                <button class="btn-action logout" onclick="forceLogout('${user.usuario}')" title="Cerrar sesión activa">
                                    <i class="fas fa-sign-out-alt"></i>
                                </button>
                            ` : ''}
                            <button class="btn-action ${isActive ? 'deactivate' : 'activate'}" 
                                    onclick="toggleUserStatus('${user.usuario}', ${!isActive})" 
                                    title="${isActive ? 'Desactivar usuario' : 'Activar usuario'}">
                                <i class="fas fa-${isActive ? 'user-slash' : 'user-check'}"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        cardsContainer.innerHTML = `
            <div class="error-cell">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error al cargar usuarios</p>
                <small>${error.message}</small>
                <button class="btn-refresh-users" onclick="loadUsersTable()">
                    <i class="fas fa-sync-alt"></i>
                    Reintentar
                </button>
            </div>
        `;
    }
}

// Obtener configuración del rol
function getRoleConfig(rol) {
    const roles = {
        'OWNER': { icon: 'fa-crown', color: '#dc2626', label: 'Propietario' },
        'ADMIN': { icon: 'fa-user-shield', color: '#f59e0b', label: 'Administrador' },
        'USER': { icon: 'fa-user', color: '#6366f1', label: 'Usuario' }
    };
    return roles[rol.toUpperCase()] || roles['USER'];
}

// Mostrar formulario de usuario (crear/editar)
async function showUserFormModal(usuario = null) {
    const isEdit = usuario !== null;
    let userData = null;
    
    if (isEdit) {
        const users = await fetchUsers();
        userData = users.find(u => u.usuario === usuario);
        if (!userData) {
            alert('Usuario no encontrado');
            return;
        }
    }
    
    const modal = document.createElement('div');
    modal.className = 'user-form-modal';
    modal.innerHTML = `
        <div class="user-form-content">
            <div class="user-form-header">
                <h3>
                    <i class="fas fa-${isEdit ? 'edit' : 'user-plus'}"></i>
                    ${isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
                </h3>
                <button class="user-form-close" onclick="this.closest('.user-form-modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="user-form-body">
                <form id="userForm">
                    <div class="form-group">
                        <label>Usuario *</label>
                        <input type="text" name="usuario" value="${userData?.usuario || ''}" 
                               ${isEdit ? 'readonly' : ''} required>
                    </div>
                    <div class="form-group">
                        <label>Nombre Completo *</label>
                        <input type="text" name="nombre" value="${userData?.nombre || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Correo Electrónico</label>
                        <input type="email" name="correo" value="${userData?.correo || ''}">
                    </div>
                    <div class="form-group">
                        <label>Teléfono</label>
                        <input type="tel" name="telefono" value="${userData?.telefono || ''}">
                    </div>
                    <div class="form-group">
                        <label>Rol *</label>
                        <select name="rol" required>
                            <option value="USER" ${userData?.rol === 'USER' ? 'selected' : ''}>USER</option>
                            <option value="ADMIN" ${userData?.rol === 'ADMIN' ? 'selected' : ''}>ADMIN</option>
                            <option value="OWNER" ${userData?.rol === 'OWNER' ? 'selected' : ''}>OWNER</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Contraseña ${isEdit ? '(dejar vacío para no cambiar)' : '*'}</label>
                        <input type="password" name="password" ${isEdit ? '' : 'required'}>
                    </div>
                    ${isEdit ? `
                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" name="activo" ${userData?.activo === '1' ? 'checked' : ''}>
                                Usuario activo
                            </label>
                        </div>
                    ` : ''}
                    <div class="form-actions">
                        <button type="button" class="btn-cancel" onclick="this.closest('.user-form-modal').remove()">
                            Cancelar
                        </button>
                        <button type="submit" class="btn-save">
                            <i class="fas fa-save"></i>
                            ${isEdit ? 'Guardar Cambios' : 'Crear Usuario'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Manejar envío del formulario
    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = {
            usuario: formData.get('usuario'),
            nombre: formData.get('nombre'),
            correo: formData.get('correo'),
            telefono: formData.get('telefono'),
            rol: formData.get('rol'),
            password: formData.get('password'),
            activo: isEdit ? (formData.get('activo') ? '1' : '0') : '1'
        };
        
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        try {
            const result = isEdit ? await updateUser(data) : await createUser(data);
            
            if (result.success) {
                alert(isEdit ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
                modal.remove();
                await loadUsersTable();
            } else {
                alert('Error: ' + (result.message || 'No se pudo guardar el usuario'));
            }
        } catch (error) {
            alert('Error al guardar: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fas fa-save"></i> ${isEdit ? 'Guardar Cambios' : 'Crear Usuario'}`;
        }
    });
}

// Editar usuario
window.editUser = async function(usuario) {
    await showUserFormModal(usuario);
};

// Forzar cierre de sesión
window.forceLogout = async function(usuario) {
    if (!confirm(`¿Cerrar la sesión activa de ${usuario}?`)) {
        return;
    }
    
    try {
        const result = await logoutUser(usuario);
        if (result.success) {
            alert('Sesión cerrada correctamente');
            await loadUsersTable();
        } else {
            alert('Error: ' + (result.message || 'No se pudo cerrar la sesión'));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Activar/Desactivar usuario
window.toggleUserStatus = async function(usuario, activate) {
    const action = activate ? 'activar' : 'desactivar';
    if (!confirm(`¿Está seguro de ${action} al usuario ${usuario}?`)) {
        return;
    }
    
    try {
        const users = await fetchUsers();
        const userData = users.find(u => u.usuario === usuario);
        
        if (!userData) {
            alert('Usuario no encontrado');
            return;
        }
        
        userData.activo = activate ? '1' : '0';
        const result = await updateUser(userData);
        
        if (result.success) {
            alert(`Usuario ${activate ? 'activado' : 'desactivado'} correctamente`);
            await loadUsersTable();
        } else {
            alert('Error: ' + (result.message || 'No se pudo cambiar el estado'));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Exportar funciones
window.showUserManagementModal = showUserManagementModal;
window.isOwner = isOwner;
