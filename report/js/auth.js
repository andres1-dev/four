/* ==========================================================================
   auth.js — Sistema de Autenticación y Control de Roles
   ========================================================================== */

let currentUser = null;
let allUsers = [];

/**
 * Carga los usuarios desde la API.
 */
async function loadUsers() {
    try {
        // PASO 1: Asegurar que tenemos las llaves antes de pedir usuarios
        if (!CONFIG.API_KEY) {
            await fetchSecureConfig();
        }

        allUsers = await fetchUsuariosData();

        // Verificar si hay una sesión previa en localStorage
        const savedUser = localStorage.getItem('sispro_user');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            applyAccessControl();
        }
    } catch (error) {
        // Error silencioso para no interrumpir la experiencia de usuario si falla la red
    }
}

/**
 * Muestra el prompt de login usando SweetAlert2.
 */
function showLoginPrompt() {
    Swal.fire({
        title: 'INICIAR SESIÓN',
        html: `
            <div class="text-start">
                <label class="form-label mb-1">Cédula o ID:</label>
                <input type="text" id="swal-user" class="form-control mb-3" placeholder="Ej: 1144167164">
                <label class="form-label mb-1">Contraseña:</label>
                <input type="password" id="swal-pass" class="form-control" placeholder="••••••">
            </div>
        `,
        confirmButtonText: 'INGRESAR',
        showCancelButton: true,
        cancelButtonText: 'CANCELAR',
        confirmButtonColor: '#3F51B5',
        focusConfirm: false,
        preConfirm: () => {
            const user = document.getElementById('swal-user').value;
            const pass = document.getElementById('swal-pass').value;
            if (!user || !pass) {
                Swal.showValidationMessage('Por favor ingrese ambos campos');
            }
            return { user, pass };
        }
    }).then((result) => {
        if (result.isConfirmed) {
            handleLogin(result.value.user, result.value.pass);
        }
    });
}

/**
 * Valida las credenciales.
 */
function handleLogin(userId, password) {
    const userFound = allUsers.find(u =>
        String(u.ID).trim() === String(userId).trim() &&
        String(u.PASSWORD).trim() === String(password).trim()
    );

    if (userFound) {
        currentUser = userFound;
        localStorage.setItem('sispro_user', JSON.stringify(currentUser));

        Swal.fire({
            icon: 'success',
            title: '¡BIENVENIDO!',
            text: `Sesión iniciada como ${userFound.ROL}`,
            timer: 2000,
            showConfirmButton: false
        });

        applyAccessControl();
    } else {
        Swal.fire({
            icon: 'error',
            title: 'ACCESO DENEGADO',
            text: 'ID o contraseña incorrectos.',
            confirmButtonColor: '#3F51B5'
        });
    }
}

/**
 * Aplica las restricciones de UI según el rol.
 */
function applyAccessControl() {
    const role = currentUser ? currentUser.ROL : 'GUEST';
    const resolutionLink = document.querySelector('a[href="resolucion.html"]');
    const resolutionBtn = resolutionLink ? resolutionLink.parentElement : null;
    const calidadOption = document.querySelector('#acciones option[value="CALIDAD"]');

    // 1. Módulo de Resolución (Botón estático si existe)
    if (resolutionBtn) {
        if (role === 'ADMIN' || role === 'USER-P') {
            resolutionBtn.classList.remove('hidden');
        } else {
            resolutionBtn.classList.add('hidden');
        }
    }

    // 2. Acciones de Calidad: ADMIN y USER-C tienen acceso. USER-P y GUEST no.
    const accionesSelect = document.getElementById('acciones');
    if (accionesSelect) {
        let calidadOption = accionesSelect.querySelector('option[value="CALIDAD"]');
        const hasCalidadPermission = (role === 'ADMIN' || role === 'USER-C');

        if (hasCalidadPermission) {
            // Si el usuario tiene permiso pero la opción no existe (fue borrada), volver a crearla
            if (!calidadOption) {
                calidadOption = document.createElement('option');
                calidadOption.value = 'CALIDAD';
                calidadOption.textContent = 'CALIDAD';
                // Insertar después de NOVEDADES o al final
                const novedadesOpt = accionesSelect.querySelector('option[value="NOVEDADES"]');
                if (novedadesOpt) {
                    novedadesOpt.after(calidadOption);
                } else {
                    accionesSelect.appendChild(calidadOption);
                }
            }
            calidadOption.style.display = 'block';
            calidadOption.removeAttribute('disabled');
            calidadOption.removeAttribute('hidden');
        } else {
            // Si el usuario NO tiene permiso, eliminar la opción física del DOM
            if (calidadOption) {
                calidadOption.remove();
            }
            
            // Seguridad: Si por alguna razón estaba seleccionada, resetear a vacío
            if (accionesSelect.value === 'CALIDAD') {
                accionesSelect.value = '';
                if (typeof hideSections === 'function') hideSections();
            }
        }
    }

    // Actualizar indicador de login/logout en el nav
    updateAuthUI();

    // 3. Protección de acceso directo (URL)
    checkRouteAccess(role);
}

/**
 * Valida si el usuario puede estar en la página actual.
 * @param {string} role 
 */
function checkRouteAccess(role) {
    const path = window.location.pathname;

    // Proteger resolucion.html
    if (path.includes('resolucion.html')) {
        if (role !== 'ADMIN' && role !== 'USER-P') {
            Swal.fire({
                icon: 'warning',
                title: 'ACCESO RESTRINGIDO',
                text: 'No tienes permisos para acceder a este módulo.',
                confirmButtonColor: '#3F51B5'
            }).then(() => {
                window.location.href = 'index.html';
            });
        }
    }
}

/**
 * Cierra la sesión.
 */
function logout() {
    currentUser = null;
    localStorage.removeItem('sispro_user');
    applyAccessControl();
    window.location.reload(); // Recargar para limpiar estados
}

/**
 * Actualiza el indicador de usuario en la interfaz.
 */
function updateAuthUI() {
    let navContainer = document.getElementById('app-top-nav');
    if (!navContainer) {
        navContainer = document.createElement('div');
        navContainer.id = 'app-top-nav';
        navContainer.className = 'app-header-bar';
        document.body.prepend(navContainer);
    }

    // Determinar icono y clase según rol
    let iconClass = 'fas fa-user-secret'; // Default guest
    let profileType = 'user-guest';

    if (currentUser) {
        profileType = `role-${currentUser.ROL.toLowerCase()}`;
        if (currentUser.ROL === 'ADMIN') iconClass = 'fas fa-user-shield';
        else if (currentUser.ROL === 'USER-C') iconClass = 'fas fa-user-check';
        else if (currentUser.ROL === 'USER-P') iconClass = 'fas fa-user';
    }

    navContainer.innerHTML = `
        <div class="nav-brand-area">
            <img src="https://i.ibb.co/nD9wcPv/GRUPO-TMD-FULL.png" alt="Logo TMD" class="nav-logo">
            <span class="brand-tag">NOVEDADES</span>
        </div>
        <div class="nav-user-area">
            <button onclick="toggleSidebar()" class="btn-profile-toggle ${profileType}" id="profileToggle">
                <span class="avatar-mini"><i class="${iconClass}"></i></span>
                <i class="fas fa-bars"></i>
            </button>
        </div>
    `;

    // Crear o actualizar el Sidebar (Drawer)
    createSidebar();
}

/**
 * Crea la estructura del sidebar si no existe.
 */
function createSidebar() {
    let sidebar = document.getElementById('user-sidebar');
    if (!sidebar) {
        sidebar = document.createElement('div');
        sidebar.id = 'user-sidebar';
        sidebar.className = 'app-sidebar-drawer';
        document.body.appendChild(sidebar);

        const overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.className = 'sidebar-backdrop';
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
    }

    if (currentUser) {
        let roleIcon = 'fas fa-user';
        let roleClass = currentUser.ROL.toLowerCase();
        const isResolutionPage = window.location.pathname.includes('resolucion.html');

        if (currentUser.ROL === 'ADMIN') roleIcon = 'fas fa-user-shield';
        else if (currentUser.ROL === 'USER-C') roleIcon = 'fas fa-user-check';
        else if (currentUser.ROL === 'USER-P') roleIcon = 'fas fa-user';

        sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="sidebar-user-card">
                    <div class="user-avatar-large ${roleClass}"><i class="${roleIcon}"></i></div>
                    <div class="user-meta">
                        <span class="u-name">${currentUser.USUARIO}</span>
                        <span class="u-role">${currentUser.ROL}</span>
                    </div>
                </div>
            </div>
            <div class="sidebar-body">
                <div class="sidebar-label">MENÚ DE ACCESO</div>
                <a href="index.html" class="sidebar-link ${!isResolutionPage ? 'active' : ''}">
                    <i class="fas fa-home"></i> Inicio / Reportes
                </a>
                ${(currentUser.ROL === 'ADMIN' || currentUser.ROL === 'USER-P') ? `
                    <a href="resolucion.html" class="sidebar-link ${isResolutionPage ? 'active' : ''}">
                        <i class="fas fa-desktop"></i> Módulo de Resolución
                    </a>
                ` : ''}
            </div>
            <div class="sidebar-footer">
                <button onclick="logout()" class="btn-logout-full mb-3">
                    <i class="fas fa-power-off me-2"></i> Cerrar Sesión
                </button>
                <div class="sidebar-credits">
                    <p>Developed by Andrés Mendoza © 2026</p>
                    <div class="social-links-sidebar">
                        <a href="https://wa.me/573176418529" target="_blank"><i class="fab fa-whatsapp"></i></a>
                        <a href="https://www.instagram.com/eltemplodelamoda/?hl=es" target="_blank"><i class="fab fa-instagram"></i></a>
                        <a href="https://www.facebook.com/templodelamoda/?locale=es_LA" target="_blank"><i class="fab fa-facebook"></i></a>
                    </div>
                </div>
            </div>
        `;
    } else {
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <div class="sidebar-user-card">
                    <div class="user-avatar-large guest"><i class="fas fa-user-secret"></i></div>
                    <div class="user-meta">
                        <span class="u-name">Invitado</span>
                        <span class="u-role">Acceso Limitado</span>
                    </div>
                </div>
            </div>
            <div class="sidebar-body">
                <button onclick="showLoginPrompt(); toggleSidebar();" class="btn-login-sidebar">
                    <i class="fas fa-shield-halved me-2"></i> INICIAR SESIÓN
                </button>
            </div>
            <div class="sidebar-footer">
                <div class="sidebar-credits">
                    <p>Developed by Andrés Mendoza © 2026</p>
                    <div class="social-links-sidebar">
                        <a href="https://wa.me/573176418529" target="_blank"><i class="fab fa-whatsapp"></i></a>
                        <a href="https://www.instagram.com/eltemplodelamoda/?hl=es" target="_blank"><i class="fab fa-instagram"></i></a>
                        <a href="https://www.facebook.com/templodelamoda/?locale=es_LA" target="_blank"><i class="fab fa-facebook"></i></a>
                    </div>
                    <span class="text-muted d-block mt-2" style="font-size: 10px;">Versión 2.0 - Grupo TMD</span>
                </div>
            </div>
        `;
    }
}

/**
 * Abre/Cierra el sidebar.
 */
function toggleSidebar() {
    const sidebar = document.getElementById('user-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;

    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}
