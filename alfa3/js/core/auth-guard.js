// ============================================
// AUTH GUARD - PROTECCIÓN DE LA APLICACIÓN
// ============================================

/**
 * Decodifica un JWT sin verificar la firma (solo para leer el payload)
 */
function decodeJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (error) {
        Logger.error('auth-guard', 'Error decodificando JWT', error);
        return null;
    }
}

/**
 * Verifica si un token JWT está próximo a expirar o ya expiró
 * @param {string} token
 * @param {number} bufferSeconds - Segundos de margen antes de considerarlo expirado (default 5 min)
 */
function isTokenExpired(token, bufferSeconds = 300) {
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) return true;
    return Date.now() >= (payload.exp * 1000) - (bufferSeconds * 1000);
}

/**
 * Renueva el access_token usando el refresh_token guardado en sessionStorage.
 * Actualiza sessionStorage con los nuevos tokens.
 * @returns {Promise<string|null>} Nuevo access_token o null si falla
 */
async function refreshSession() {
    const refreshToken = sessionStorage.getItem('supabase_refresh_token');
    if (!refreshToken) {
        Logger.warn('auth-guard', 'No hay refresh_token disponible');
        return null;
    }

    try {
        Logger.info('auth-guard', 'Renovando sesión con refresh_token...');
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            Logger.error('auth-guard', 'Error renovando sesión', err);
            return null;
        }

        const data = await response.json();

        // Guardar nuevos tokens
        sessionStorage.setItem('supabase_token', data.access_token);
        sessionStorage.setItem('supabase_refresh_token', data.refresh_token);
        sessionStorage.setItem('supabase_token_exp', String(data.expires_at || (Math.floor(Date.now() / 1000) + (data.expires_in || 3600))));
        sessionStorage.setItem('supabase_user', JSON.stringify(data.user));

        // Actualizar el cliente de Supabase en memoria
        supabase.accessToken = data.access_token;
        supabase.user = data.user;

        Logger.success('auth-guard', `Sesión renovada hasta: ${new Date((data.expires_at || 0) * 1000).toLocaleTimeString()}`);
        return data.access_token;

    } catch (error) {
        Logger.error('auth-guard', 'Error inesperado renovando sesión', error);
        return null;
    }
}

/**
 * Programa la renovación automática del token antes de que expire.
 * Se llama una vez al iniciar la sesión y se autorenueva en cadena.
 */
function scheduleTokenRefresh() {
    const token = sessionStorage.getItem('supabase_token');
    if (!token) return;

    const payload = decodeJWT(token);
    if (!payload || !payload.exp) return;

    // Renovar 5 minutos antes de expirar
    const bufferMs = 5 * 60 * 1000;
    const expiresInMs = (payload.exp * 1000) - Date.now() - bufferMs;

    if (expiresInMs <= 0) {
        // Ya está próximo o expirado, renovar ahora
        refreshSession().then(newToken => {
            if (newToken) scheduleTokenRefresh();
            else forceLogout('Sesión expirada. Por favor inicia sesión nuevamente.');
        });
        return;
    }

    Logger.info('auth-guard', `Token se renovará automáticamente en ${Math.round(expiresInMs / 60000)} min`);

    setTimeout(async () => {
        const newToken = await refreshSession();
        if (newToken) {
            scheduleTokenRefresh(); // Programar la siguiente renovación
        } else {
            forceLogout('Sesión expirada. Por favor inicia sesión nuevamente.');
        }
    }, expiresInMs);
}

/**
 * Fuerza el cierre de sesión con un mensaje al usuario
 */
function forceLogout(message) {
    Logger.warn('auth-guard', message);
    sessionStorage.clear();
    if (typeof supabase !== 'undefined') {
        supabase.accessToken = null;
        supabase.user = null;
    }
    alert(message);
    window.location.href = 'login.html';
}

/**
 * Verifica autenticación al cargar la aplicación
 */
async function initAuthGuard() {
    Logger.info('auth-guard', 'Verificando autenticación...');

    const token = sessionStorage.getItem('supabase_token');
    const userStr = sessionStorage.getItem('supabase_user');

    if (!token || !userStr) {
        Logger.warn('auth-guard', 'No hay sesión activa, redirigiendo a login');
        window.location.href = 'login.html';
        return false;
    }

    // Si el token está próximo a expirar, intentar renovarlo antes de continuar
    if (isTokenExpired(token)) {
        Logger.warn('auth-guard', 'Token expirado o próximo a expirar, intentando renovar...');
        const newToken = await refreshSession();
        if (!newToken) {
            forceLogout('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
            return false;
        }
    }

    try {
        // Restaurar sesión en el cliente de Supabase
        const freshToken = sessionStorage.getItem('supabase_token');
        const user = JSON.parse(sessionStorage.getItem('supabase_user'));
        supabase.accessToken = freshToken;
        supabase.user = user;

        Logger.success('auth-guard', `Sesión restaurada: ${user.email}`);

        // Programar renovación automática
        scheduleTokenRefresh();

        return true;
    } catch (error) {
        Logger.error('auth-guard', 'Error restaurando sesión', error);
        sessionStorage.clear();
        window.location.href = 'login.html';
        return false;
    }
}

/**
 * Cierra sesión y redirige al login
 */
function logout() {
    Logger.info('auth-guard', 'Cerrando sesión...');

    // Invalidar el refresh_token en Supabase (fire & forget)
    const token = sessionStorage.getItem('supabase_token');
    if (token) {
        fetch(`${SUPABASE_URL}/auth/v1/logout`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }).catch(() => {}); // Silencioso — no bloquear el flujo
    }

    sessionStorage.clear();
    if (typeof supabase !== 'undefined') {
        supabase.accessToken = null;
        supabase.user = null;
    }
    window.location.href = 'login.html';
}

// Exports
window.initAuthGuard = initAuthGuard;
window.logout = logout;
window.isTokenExpired = isTokenExpired;
window.refreshSession = refreshSession;
