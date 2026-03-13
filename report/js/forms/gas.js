/* ==========================================================================
   forms/gas.js — Utilidades de comunicación con Google Apps Script
   Depende de: config.js (GAS_ENDPOINT), ui.js (DOM)
   ========================================================================== */

/**
 * Convierte un archivo (File) a un objeto Base64 para enviarlo al GAS.
 * @param {File} file
 * @returns {Promise<{base64: string, mimeType: string, fileName: string}>}
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1]; // quitar prefijo data:…;base64,
            resolve({
                base64,
                mimeType: file.type,
                fileName: file.name,
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Recoge los datos comunes del lote actualmente seleccionado en el formulario.
 * @returns {Object} Campos del lote: fecha, lote, referencia, cantidad, planta, salida, linea, proceso, prenda, genero, tejido.
 */
function collectLotData() {
    return {
        fecha: document.getElementById('fecha').value,
        lote: document.getElementById('lote').value,
        referencia: document.getElementById('referencia').value,
        cantidad: document.getElementById('cantidad').value,
        planta: DOM.plantaSelect().value,
        salida: document.getElementById('salida').value,
        linea: DOM.lineaInput().value,
        proceso: document.getElementById('proceso').value,
        prenda: document.getElementById('prenda').value,
        genero: document.getElementById('genero').value,
        tejido: document.getElementById('tejido').value,
    };
}

/**
 * Envía un payload al Google Apps Script vía POST.
 * Usa Content-Type: text/plain para evitar CORS preflight.
 * @param {Object} payload — Datos a enviar (serializados como JSON).
 * @returns {Promise<Object>} Respuesta JSON del servidor.
 * @throws {Error} Si la respuesta HTTP no es OK.
 */
async function sendToGAS(payload) {
    const response = await fetch(GAS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
    }

    return response.json();
}
