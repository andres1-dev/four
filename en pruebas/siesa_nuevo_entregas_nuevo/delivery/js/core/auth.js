// Gestión de autenticación y sesiones (Versión Independiente)
const AUTH_KEY = 'user';

// Estado de usuario
let currentUser = null;

// Inicializar sistema de autenticación
function initAuth() {
    // Checking session
    checkSession();
}

// Verificar si hay sesión activa
function checkSession() {
    try {
        const storedUser = localStorage.getItem(AUTH_KEY);

        if (storedUser) {
            currentUser = JSON.parse(storedUser);
            window.currentUser = currentUser;
            log.info("Sesión restaurada para:", currentUser.nombre);

            // Mostrar app
            showApp();
        } else {
            // Redirigir a login independiente
            window.location.replace('./login.html');
        }
    } catch (e) {
        console.error("Error al restaurar sesión:", e);
        window.location.replace('./login.html');
    }
}

function showLogin() {
    window.location.replace('./login.html');
}

function showApp() {
    const scanner = document.getElementById('scanner');
    const barcodeInput = document.getElementById('barcode');

    if (scanner) {
        scanner.style.display = 'flex';
        // Ajustar UI según rol
        applyRolePermissions();

        // Actualizar permisos de notificaciones
        if (window.notificationManager) {
            window.notificationManager.applyRolePermissions();
        }

        // Actualizar UI de usuario (Header)
        if (typeof window.updateUserUI === 'function') {
            window.updateUserUI();
        }

        // Focus con delay para evitar warning de autofocus
        if (barcodeInput) {
            setTimeout(() => {
                if (document.activeElement !== barcodeInput) {
                    barcodeInput.focus();
                }
            }, 100);
        }
    }
}

function logout() {
    console.log("Cerrando sesión del sistema...");
    
    // Cerrar sesión en Supabase
    if (typeof cerrarSesionSupabase === 'function') {
        cerrarSesionSupabase();
    }
    
    currentUser = null;
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem('apiKey');
    localStorage.removeItem(CONFIG.ACTIVITY_KEY);
    sessionStorage.removeItem('token');
    window.location.replace('./login.html');
}

// Aplicar permisos según rol
function applyRolePermissions() {
    if (!currentUser) return;

    // Remove old classes
    document.body.classList.remove('role-owner', 'role-admin', 'role-moderator', 'role-user', 'role-guest', 'role-delivery');

    // Add new class based on role (normalized to lowercase)
    const roleClass = `role-${currentUser.rol.toLowerCase()}`;
    document.body.classList.add(roleClass);

    if (currentUser.rol === 'USER' || currentUser.rol === 'DELIVERY') {
        document.body.classList.add('role-delivery');
    }

    // Actualizar UI existente
    updateDeleteButtonsVisibility();
}

function updateDeleteButtonsVisibility() {
    const isAdminOrOwner = currentUser && (currentUser.rol === 'ADMIN' || currentUser.rol === 'OWNER');
    const deleteBtns = document.querySelectorAll('.btn-delete');

    deleteBtns.forEach(btn => {
        if (!isAdminOrOwner) {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'flex';
        }
    });
}

// Llamar al inicio
document.addEventListener('DOMContentLoaded', initAuth);
