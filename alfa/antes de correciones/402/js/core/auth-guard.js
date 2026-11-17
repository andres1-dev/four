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
 * Verifica si un token JWT está expirado
 */
function isTokenExpired(token) {
    const payload = decodeJWT(token);
    if (!payload || !payload.exp) {
        return true; // Si no se puede decodificar, considerarlo expirado
    }
    
    // exp está en segundos, Date.now() en milisegundos
    const expirationTime = payload.exp * 1000;
    const currentTime = Date.now();
    
    // Considerar expirado si faltan menos de 5 minutos
    const bufferTime = 5 * 60 * 1000; // 5 minutos en milisegundos
    
    return currentTime >= (expirationTime - bufferTime);
}

/**
 * Verifica autenticación al cargar la aplicación
 */
async function initAuthGuard() {
    Logger.info('auth-guard', 'Verificando autenticación...');

    // Verificar si hay token en sessionStorage
    const token = sessionStorage.getItem('supabase_token');
    const userStr = sessionStorage.getItem('supabase_user');

    if (!token || !userStr) {
        Logger.warn('auth-guard', 'No hay sesión activa, redirigiendo a login');
        window.location.href = 'login.html';
        return false;
    }

    // Verificar si el token está expirado
    if (isTokenExpired(token)) {
        Logger.warn('auth-guard', 'Token expirado, redirigiendo a login');
        sessionStorage.clear();
        alert('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        window.location.href = 'login.html';
        return false;
    }

    try {
        // Restaurar sesión en el cliente de Supabase
        const user = JSON.parse(userStr);
        supabase.accessToken = token;
        supabase.user = user;

        Logger.success('auth-guard', `Sesión restaurada: ${user.email}`);
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
    sessionStorage.clear();
    if (supabase) {
        supabase.accessToken = null;
        supabase.user = null;
    }
    window.location.href = 'login.html';
}

// Exports
window.initAuthGuard = initAuthGuard;
window.logout = logout;
window.isTokenExpired = isTokenExpired;

