/* ════════════════════════════════════════════════════════════════════════════
   INFRASTRUCTURE — Catálogo desde Google Sheets
   Obtiene la API key del web app GAS (doGet) y lee las 4 hojas
   con Sheets API v4. Devuelve { HOJA: { headers, rows } }.
   ════════════════════════════════════════════════════════════════════════════ */
import { SHEETS_CONFIG } from '../config/sheets-config.js';

async function obtenerApiKey() {
  const res = await fetch(SHEETS_CONFIG.GAS_ENDPOINT);
  if (!res.ok) throw new Error(`GAS endpoint respondió ${res.status}`);
  const data = await res.json();
  if (!data.ok || !data.apiKey) throw new Error('GAS no devolvió API key válida.');
  return data.apiKey;
}

async function leerHoja(apiKey, nombreHoja) {
  const { range } = SHEETS_CONFIG.SHEETS[nombreHoja];
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_CONFIG.SPREADSHEET_ID}` +
    `/values/${encodeURIComponent(nombreHoja + '!' + range)}` +
    `?key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API ${res.status} en ${nombreHoja}`);
  }
  const json = await res.json();
  const filas = json.values || [];
  if (filas.length < 2) return { headers: [], rows: [] };

  const headers = filas[0].map(h => String(h).trim());
  const rows = filas.slice(1).map(f => headers.map((_, i) => (f[i] ?? '').toString().trim()));
  return { headers, rows };
}

/**
 * Lee las 4 hojas del catálogo.
 * @param {(msg: string) => void} onStatus
 * @returns {Promise<Object>} { COLORES: {headers, rows}, ... }
 */
export async function cargarCatalogoSheets(onStatus) {
  onStatus?.('Obteniendo credenciales de Sheets…');
  const apiKey = await obtenerApiKey();

  const catalogo = {};
  for (const hoja of Object.keys(SHEETS_CONFIG.SHEETS)) {
    onStatus?.(`Leyendo hoja ${hoja}…`);
    catalogo[hoja] = await leerHoja(apiKey, hoja);
  }
  return catalogo;
}

/**
 * Lee una sola hoja del catálogo (para refrescar cat_* tras guardar).
 * @param {string} nombreHoja
 * @returns {Promise<{ headers: string[], rows: string[][] }>}
 */
export async function cargarHojaSheets(nombreHoja) {
  if (!SHEETS_CONFIG.SHEETS[nombreHoja]) {
    throw new Error(`Hoja no configurada: ${nombreHoja}`);
  }
  const apiKey = await obtenerApiKey();
  return leerHoja(apiKey, nombreHoja);
}
