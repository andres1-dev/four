// ============================================
// MODAL DE LOGIN PARA SUPABASE
// ============================================

/**
 * Muestra el modal de login de Supabase
 */
function showSupabaseLoginModal() {
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="modal" id="supabaseLoginModal" style="display: flex;">
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>
                            <i class="codicon codicon-lock"></i>
                            Iniciar Sesión
                        </h3>
                    </div>
                    <div class="modal-body">
                        <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 13px;">
                            Ingresa tus credenciales para guardar datos en Supabase
                        </p>
                        
                        <div class="form-group">
                            <label for="supabaseEmail">
                                <i class="codicon codicon-mail"></i>
                                Correo Electrónico
                            </label>
                            <input 
                                type="email" 
                                id="supabaseEmail" 
                                class="form-control" 
                                placeholder="tu@email.com"
                                autocomplete="email"
                                required
                            >
                        </div>

                        <div class="form-group">
                            <label for="supabasePassword">
                                <i class="codicon codicon-key"></i>
                                Contraseña
                            </label>
                            <div style="position: relative;">
                                <input 
                                    type="password" 
                                    id="supabasePassword" 
                                    class="form-control" 
                                    placeholder="••••••••"
                                    autocomplete="current-password"
                                    required
                                    style="padding-right: 40px;"
                                >
                                <button 
                                    type="button" 
                                    class="btn-icon" 
                                    id="togglePasswordBtn"
                                    style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%);"
                                    title="Mostrar/Ocultar contraseña"
                                >
                                    <i class="codicon codicon-eye" id="togglePasswordIcon"></i>
                                </button>
                            </div>
                        </div>

                        <div id="loginError" style="display: none; padding: 10px; background: var(--error-dim); border: 1px solid var(--error); border-radius: 4px; margin-top: 15px;">
                            <i class="codicon codicon-error" style="color: var(--error);"></i>
                            <span id="loginErrorMessage" style="color: var(--error); margin-left: 8px;"></span>
                        </div>

                        <div id="loginSuccess" style="display: none; padding: 10px; background: var(--success-dim); border: 1px solid var(--success); border-radius: 4px; margin-top: 15px;">
                            <i class="codicon codicon-check" style="color: var(--success);"></i>
                            <span style="color: var(--success); margin-left: 8px;">Sesión iniciada correctamente</span>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" id="cancelLoginBtn">
                            <i class="codicon codicon-close"></i>
                            Cancelar
                        </button>
                        <button class="btn-primary" id="loginBtn">
                            <i class="codicon codicon-sign-in"></i>
                            Iniciar Sesión
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modal = document.getElementById('supabaseLoginModal');
        const emailInput = document.getElementById('supabaseEmail');
        const passwordInput = document.getElementById('supabasePassword');
        const loginBtn = document.getElementById('loginBtn');
        const cancelBtn = document.getElementById('cancelLoginBtn');
        const togglePasswordBtn = document.getElementById('togglePasswordBtn');
        const togglePasswordIcon = document.getElementById('togglePasswordIcon');
        const loginError = document.getElementById('loginError');
        const loginErrorMessage = document.getElementById('loginErrorMessage');
        const loginSuccess = document.getElementById('loginSuccess');

        // Focus en el email al abrir
        setTimeout(() => emailInput.focus(), 100);

        // Toggle password visibility
        togglePasswordBtn.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                togglePasswordIcon.className = 'codicon codicon-eye-closed';
            } else {
                passwordInput.type = 'password';
                togglePasswordIcon.className = 'codicon codicon-eye';
            }
        });

        // Enter para enviar
        const handleEnter = (e) => {
            if (e.key === 'Enter') {
                loginBtn.click();
            }
        };
        emailInput.addEventListener('keypress', handleEnter);
        passwordInput.addEventListener('keypress', handleEnter);

        // Botón de login
        loginBtn.addEventListener('click', async () => {
            const email = emailInput.value.trim();
            const password = passwordInput.value;

            // Validaciones
            if (!email || !password) {
                loginError.style.display = 'flex';
                loginErrorMessage.textContent = 'Por favor completa todos los campos';
                return;
            }

            if (!email.includes('@')) {
                loginError.style.display = 'flex';
                loginErrorMessage.textContent = 'Ingresa un correo electrónico válido';
                return;
            }

            // Ocultar errores previos
            loginError.style.display = 'none';
            loginSuccess.style.display = 'none';

            // Deshabilitar botón y mostrar loading
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="loading-spinner"></span> Iniciando sesión...';

            try {
                // Intentar login con Supabase
                await supabase.signIn(email, password);

                // Mostrar éxito
                loginSuccess.style.display = 'flex';
                loginBtn.innerHTML = '<i class="codicon codicon-check"></i> Sesión iniciada';

                // Cerrar modal después de 1 segundo
                setTimeout(() => {
                    modal.remove();
                    resolve(true);
                }, 1000);

            } catch (error) {
                Logger.error('supabase-login', 'Error en login', error);
                
                loginError.style.display = 'flex';
                loginErrorMessage.textContent = error.message || 'Error al iniciar sesión';
                
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="codicon codicon-sign-in"></i> Iniciar Sesión';
            }
        });

        // Botón de cancelar
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            resolve(false);
        });

        // Cerrar con ESC
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                resolve(false);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        // Cerrar al hacer clic fuera del modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(false);
            }
        });
    });
}

/**
 * Verifica si hay sesión activa, si no, muestra el modal de login
 */
async function ensureSupabaseAuth() {
    const session = await supabase.getSession();
    
    if (session && session.access_token) {
        Logger.info('supabase-login', 'Sesión activa encontrada');
        return true;
    }

    Logger.info('supabase-login', 'No hay sesión activa, mostrando modal de login');
    return await showSupabaseLoginModal();
}

// Exports
window.showSupabaseLoginModal = showSupabaseLoginModal;
window.ensureSupabaseAuth = ensureSupabaseAuth;
