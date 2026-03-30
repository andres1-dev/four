/**
 * token_auth.js — Token de acceso temporal (6 h)
 * El token se genera en GAS, se guarda en localStorage del EMISOR,
 * y se valida localmente en el RECEPTOR via localStorage compartido
 * — pero como son dominios distintos no comparten localStorage.
 *
 * Solución: el token viaja en la URL y se valida contra GAS.
 * Para evitar el problema de velocidad del GAS, guardamos el token
 * en localStorage del emisor Y lo incluimos en la URL.
 * El receptor valida contra GAS de forma bloqueante con un loading visible.
 */

var TOKEN_GAS_URL = 'https://script.google.com/macros/s/AKfycbzFkQsoAMCfnkoBHSTMMx4evKkAkwkBVlCu3eHIMVcam41GR2Q1_9YffhJSf8SeOC3_/exec';
var APP_BASE_URL  = 'https://andres1-dev.github.io/four/income/login.html';

/**
 * Pide a GAS que genere un token y retorna la URL con ?token=
 */
async function generateAndSaveToken() {
    try {
        const res  = await fetch(TOKEN_GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'action=generate_token'
        });
        const data = await res.json();
        console.log('[TOKEN] GAS response:', data);
        if (data.ok && data.token) {
            return APP_BASE_URL + '?token=' + data.token;
        }
    } catch (e) {
        console.warn('[TOKEN] fetch error:', e);
    }
    return APP_BASE_URL;
}
