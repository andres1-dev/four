// Módulo de Administración de Usuarios con Supabase Auth

const EDGE_FUNCTION_URL = `${CONFIG.SUPABASE_URL}/functions/v1/manage-users`;

// Jerarquía de roles (de mayor a menor)
const ROLE_HIERARCHY = {
    'OWNER': 5,
    'ADMIN': 4,
    'MODERATOR': 3,
    'USER': 2,
    'DELIVERY': 2,
    'GUEST': 1
};

function getRoleLevel(role) {
    return ROLE_HIERARCHY[role.toUpperCase()] || 0;
}

function canManageRole(managerRole, targetRole) {
    return getRoleLevel(managerRole) > getRoleLevel(targetRole);
}

function getAssignableRoles(currentRole) {
    const currentLevel = getRoleLevel(currentRole);
    const assignable = [];
    
    for (const [role, level] of Object.entries(ROLE_HIERARCHY)) {
        if (level < currentLevel && role !== 'DELIVERY') {
            assignable.push(role);
        }
    }
    
    return assignable.sort((a, b) => getRoleLevel(b) - getRoleLevel(a));
}

async function openUserAdmin() {
    if (!currentUser || (currentUser.rol !== 'ADMIN' && currentUser.rol !== 'OWNER')) {
        alert("Acceso denegado. Solo administradores.");
        return;
    }

    const modal = document.getElementById('userAdminModal');
    const overlay = document.getElementById('userAdminOverlay');
    if (modal) {
        modal.style.display = 'flex';
        if (overlay) overlay.style.display = 'block';
        loadUsersList();
    }
}

function closeUserAdmin() {
    const modal = document.getElementById('userAdminModal');
    const overlay = document.getElementById('userAdminOverlay');
    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
}

async function loadUsersList() {
    const listContainer = document.getElementById('userListContainer');
    listContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Cargando usuarios...</div>';

    try {
        // Obtener token de autenticación
        const { data: { session } } = await window.supabase.auth.getSession();
        const authHeader = session ? { 'Authorization': `Bearer ${session.access_token}` } : {};

        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeader
            },
            body: JSON.stringify({ action: 'list' })
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error);
        }

        let users = result.users;
        
        // Filtrar por jerarquía
        const currentLevel = getRoleLevel(currentUser.rol);
        users = users.filter(u => {
            const userLevel = getRoleLevel(u.rol);
            return userLevel < currentLevel;
        });
        
        console.log(`Usuarios filtrados para ${currentUser.rol}: ${users.length} visibles`);
        
        if (users && users.length > 0) {
            renderUserTable(users);
        } else {
            listContainer.innerHTML = '<div class="empty-state">No hay usuarios registrados en tu nivel de acceso.</div>';
        }

    } catch (error) {
        console.error("Error cargando usuarios:", error);
        listContainer.innerHTML = '<div class="error-msg">Error de conexión al cargar usuarios.</div>';
    }
}

function renderUserTable(users) {
    const listContainer = document.getElementById('userListContainer');

    if (!users || users.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No hay usuarios registrados.</div>';
        return;
    }

    let html = `<div class="user-cards-grid">`;

    users.forEach(user => {
        let roleIcon = '';
        const role = user.rol.toUpperCase();

        if (role === 'OWNER') {
            roleIcon = '<i class="fa-solid fa-user-tie"></i>';
        } else if (role === 'ADMIN') {
            roleIcon = '<i class="fa-solid fa-user-shield"></i>';
        } else if (role === 'MODERATOR') {
            roleIcon = '<i class="fa-solid fa-user-gear"></i>';
        } else if (role === 'USER' || role === 'DELIVERY') {
            roleIcon = '<i class="fa-solid fa-user"></i>';
        } else if (role === 'GUEST') {
            roleIcon = '<i class="fa-solid fa-user-secret"></i>';
        } else {
            roleIcon = '<i class="fa-solid fa-user"></i>';
        }

        html += `
        <div class="user-card">
            <div class="user-card-header">
                <div class="user-info-primary">
                    <span class="user-name-title">${user.nombre}</span>
                    <span class="user-id-subtitle"><i class="fas fa-id-card"></i> ${user.id}</span>
                </div>
                <div class="user-role-container">
                    <span class="role-badge role-${user.rol.toLowerCase()}">
                        ${roleIcon} ${user.rol}
                    </span>
                </div>
            </div>
            <div class="user-card-body">
                <div class="user-detail-item">
                    <i class="fas fa-envelope"></i> <span>${user.email || 'No email registrado'}</span>
                </div>
                ${user.phone ? `<div class="user-detail-item"><i class="fas fa-phone"></i> <span>${user.phone}</span></div>` : ''}
            </div>
            <div class="user-card-footer">
                <button class="action-btn edit-btn" onclick="editUser('${user.auth_id}')" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deleteUser('${user.auth_id}', '${user.nombre}')" title="Eliminar">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
        `;
    });

    html += '</div>';
    listContainer.innerHTML = html;

    window.currentUsersList = users;
}

function openCreateUserModal() {
    document.getElementById('userForm').reset();
    document.getElementById('userFormTitle').textContent = "Nuevo Usuario";
    document.getElementById('userId').readOnly = false;
    document.getElementById('userAuthId').value = '';
    
    updateRoleOptions();
    
    document.getElementById('userModalOverlay').style.display = 'flex';
}

function updateRoleOptions() {
    const roleSelect = document.getElementById('userRole');
    if (!roleSelect) return;
    
    const assignableRoles = getAssignableRoles(currentUser.rol);
    
    roleSelect.innerHTML = '';
    
    assignableRoles.forEach(role => {
        const option = document.createElement('option');
        option.value = role;
        option.textContent = role.charAt(0) + role.slice(1).toLowerCase();
        roleSelect.appendChild(option);
    });
}

function editUser(authId) {
    const user = window.currentUsersList.find(u => u.auth_id === authId);
    if (!user) return;
    
    if (!canManageRole(currentUser.rol, user.rol)) {
        alert('No tienes permisos para editar este usuario.');
        return;
    }

    document.getElementById('userId').value = user.id;
    document.getElementById('userId').readOnly = true;
    document.getElementById('userAuthId').value = user.auth_id;
    document.getElementById('userName').value = user.nombre;
    document.getElementById('userEmail').value = user.email || '';
    document.getElementById('userPhone').value = user.phone || '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userPassword').placeholder = 'Dejar vacío para no cambiar';

    updateRoleOptions();
    document.getElementById('userRole').value = user.rol;

    document.getElementById('userFormTitle').textContent = "Editar Usuario";
    document.getElementById('userModalOverlay').style.display = 'flex';
}

function closeUserFormModal() {
    document.getElementById('userModalOverlay').style.display = 'none';
}

async function saveUser(e) {
    e.preventDefault();

    const saveBtn = document.getElementById('saveUserBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    const authId = document.getElementById('userAuthId').value.trim();
    const isEdit = authId !== '';

    const userData = {
        id: document.getElementById('userId').value.trim(),
        nombre: document.getElementById('userName').value.trim(),
        rol: document.getElementById('userRole').value,
        email: document.getElementById('userEmail').value.trim(),
        phone: document.getElementById('userPhone').value.trim(),
        password: document.getElementById('userPassword').value.trim()
    };

    if (!canManageRole(currentUser.rol, userData.rol)) {
        alert(`No puedes asignar el rol ${userData.rol}.`);
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
        return;
    }

    try {
        // Obtener token de autenticación
        const { data: { session } } = await window.supabase.auth.getSession();
        const authHeader = session ? { 'Authorization': `Bearer ${session.access_token}` } : {};

        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeader
            },
            body: JSON.stringify({
                action: isEdit ? 'update' : 'create',
                userId: authId,
                userData: userData
            })
        });

        const result = await response.json();

        if (result.success) {
            alert("Usuario guardado correctamente");
            closeUserFormModal();
            loadUsersList();
        } else {
            alert("Error: " + result.error);
        }

    } catch (error) {
        console.error("Error guardando usuario:", error);
        alert("Error de conexión: " + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

async function deleteUser(authId, userName) {
    const user = window.currentUsersList.find(u => u.auth_id === authId);
    if (!user) {
        alert('Usuario no encontrado.');
        return;
    }
    
    if (!canManageRole(currentUser.rol, user.rol)) {
        alert('No tienes permisos para eliminar este usuario.');
        return;
    }
    
    if (!confirm(`¿Estás seguro de eliminar al usuario ${userName}?`)) return;

    try {
        // Obtener token de autenticación
        const { data: { session } } = await window.supabase.auth.getSession();
        const authHeader = session ? { 'Authorization': `Bearer ${session.access_token}` } : {};

        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeader
            },
            body: JSON.stringify({
                action: 'delete',
                userId: authId
            })
        });

        const result = await response.json();

        if (result.success) {
            alert("Usuario eliminado correctamente");
            loadUsersList();
        } else {
            alert("Error al eliminar: " + result.error);
        }

    } catch (error) {
        console.error("Error eliminando usuario:", error);
        alert("Error de conexión: " + error.message);
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    const userForm = document.getElementById('userForm');
    if (userForm) userForm.addEventListener('submit', saveUser);
    
    // Agregar campo oculto para auth_id si no existe
    if (!document.getElementById('userAuthId')) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.id = 'userAuthId';
        userForm.appendChild(input);
    }
});
