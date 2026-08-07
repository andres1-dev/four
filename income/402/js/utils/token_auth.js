/**
 * token_auth.js — Token de acceso temporal (12 h)
 * El token se genera y valida usando Edge Function de Supabase.
 * El token viaja en la URL y se valida contra Supabase.
 * 
 * Migración de GAS a Edge Function para mayor seguridad y simplicidad.
 */

const EDGE_FUNCTION_URL = 'https://iladaofarozipitwaeti.supabase.co/functions/v1/token-auth';
const TOKEN_AUTH_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsYWRhb2Zhcm96aXBpdHdhZXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjYzMDksImV4cCI6MjA5MzA0MjMwOX0.4fyiibeZS10DCgov62d7tIFVzJHsklsBrbokAJ9ptK8';
const APP_BASE_URL  = 'https://andres1-dev.github.io/four/income/login.html';

/**
 * Genera un token único usando la Edge Function
 */
async function generateAndSaveToken() {
    try {
        const res = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN_AUTH_SUPABASE_ANON}`
            },
            body: JSON.stringify({ action: 'generate_token' })
        });
        
        const data = await res.json();
        
        if (data.ok && data.token) {
            return APP_BASE_URL + '?token=' + data.token;
        } else {
            return APP_BASE_URL;
        }
    } catch (e) {
        return APP_BASE_URL;
    }
}
