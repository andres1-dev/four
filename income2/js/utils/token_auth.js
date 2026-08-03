/**
 * token_auth.js — Token de acceso temporal (6 h)
 * El token se genera y valida en Supabase en lugar de Google Apps Script.
 * El token viaja en la URL y se valida contra Supabase.
 * 
 * Migración de GAS a Supabase para mayor velocidad y simplicidad.
 */

const SUPABASE_URL = 'https://iladaofarozipitwaeti.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsYWRhb2Zhcm96aXBpdHdhZXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjYzMDksImV4cCI6MjA5MzA0MjMwOX0.4fyiibeZS10DCgov62d7tIFVzJHsklsBrbokAJ9ptK8';
const APP_BASE_URL  = 'https://andres1-dev.github.io/four/income/login.html';

/**
 * Genera un token único (UUID) y lo guarda en Supabase
 */
async function generateAndSaveToken() {
    try {
        // Generar token único
        const token = generateUUID();
        
        // Calcular fecha de expiración (6 horas desde ahora)
        const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
        
        // Datos del usuario por defecto (pueden ser personalizados)
        const tokenData = {
            token: token,
            usuario: 'INVITADO',
            nombre: 'INVITADO',
            correo: '',
            telefono: '',
            rol: 'ADMIN',
            expires_at: expiresAt
        };
        
        // Insertar token en Supabase
        const res = await fetch(`${SUPABASE_URL}/rest/v1/temp_tokens`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON,
                'Authorization': `Bearer ${SUPABASE_ANON}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(tokenData)
        });
        
        if (res.ok) {
            console.log('[TOKEN] Token generado exitosamente en Supabase');
            return APP_BASE_URL + '?token=' + token;
        } else {
            console.error('[TOKEN] Error al insertar token en Supabase:', await res.text());
            return APP_BASE_URL;
        }
    } catch (e) {
        console.warn('[TOKEN] Error generando token:', e);
        return APP_BASE_URL;
    }
}

/**
 * Genera un UUID v4 simple
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
