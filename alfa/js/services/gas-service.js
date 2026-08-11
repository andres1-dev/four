// ============================================================
// ESPEJO SUPABASE → GOOGLE SHEETS
// Libro: 1O67ydfwQCnW-J-xDwzkghTFUMX9KF4tqizKLCJrz9LM
// ============================================================

/**
 * Envía un ingreso a Google Sheets (espejo de la tabla "ingresos" de Supabase).
 * @param {Object} record – mismo objeto que se pasa a saveToSisproInversiones()
 */
function saveIngresoToSheets(record) {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', GAS_SHEETS_URL, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.timeout = 15000;

        xhr.onload = function () {
            try {
                const res = JSON.parse(xhr.responseText);
                Logger.info('gas-service', `Ingreso guardado en Sheets (${res.action}): ${res.id}`);
                resolve({ success: true, ...res });
            } catch (e) {
                resolve({ success: true, message: 'Respuesta no JSON (ok)' });
            }
        };
        xhr.onerror  = () => { Logger.warn('gas-service', 'Error de conexión GAS Sheets (ingresos)'); resolve({ success: false }); };
        xhr.ontimeout = () => { Logger.warn('gas-service', 'Timeout GAS Sheets (ingresos)');           resolve({ success: false }); };

        const params = new URLSearchParams();
        params.append('action', 'guardarIngreso');
        params.append('datos', JSON.stringify(record));
        xhr.send(params.toString());
    });
}

/**
 * Envía una distribución a Google Sheets (espejo de la tabla "distribuciones" de Supabase).
 * @param {Object} record – mismo objeto que se pasa a saveDistributionToSupabase()
 */
function saveDistribucionToSheets(record) {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', GAS_SHEETS_URL, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.timeout = 15000;

        xhr.onload = function () {
            try {
                const res = JSON.parse(xhr.responseText);
                Logger.info('gas-service', `Distribución guardada en Sheets (${res.action}): ${res.id}`);
                resolve({ success: true, ...res });
            } catch (e) {
                resolve({ success: true, message: 'Respuesta no JSON (ok)' });
            }
        };
        xhr.onerror  = () => { Logger.warn('gas-service', 'Error de conexión GAS Sheets (distribuciones)'); resolve({ success: false }); };
        xhr.ontimeout = () => { Logger.warn('gas-service', 'Timeout GAS Sheets (distribuciones)');           resolve({ success: false }); };

        const params = new URLSearchParams();
        params.append('action', 'guardarDistribucion');
        params.append('datos', JSON.stringify(record));
        xhr.send(params.toString());
    });
}

// ============================================================

function saveOPToSheets(jsonData) {
    return new Promise((resolve, reject) => {
        const formData = new URLSearchParams();
        formData.append('action', 'guardarOP');
        formData.append('datos', JSON.stringify(jsonData));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', GAS_URL, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

        xhr.onload = function () {
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response);
                } catch (e) {
                    reject(new Error('Error al procesar respuesta del servidor'));
                }
            } else {
                reject(new Error(`Error HTTP ${xhr.status}`));
            }
        };

        xhr.onerror = function () {
            reject(new Error('Error de conexión con Google Apps Script'));
        };

        xhr.ontimeout = function () {
            reject(new Error('Timeout de conexión'));
        };

        xhr.timeout = 30000;
        xhr.send(formData);
    });
}

function sendToDistributionGAS(data) {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', DISTRIBUTION_GAS_URL, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.timeout = 10000;

        xhr.onload = function () {
            Logger.info('gas-service', `GAS respondió (ignorando contenido): ${xhr.status}`);
            resolve({ success: true, message: 'Datos enviados al servidor', httpStatus: xhr.status });
        };

        xhr.onerror = function () {
            Logger.warn('gas-service', 'Error de conexión con GAS (ignorado)');
            resolve({ success: true, message: 'Datos enviados (error de conexión ignorado)' });
        };

        xhr.ontimeout = function () {
            Logger.warn('gas-service', 'Timeout con GAS (ignorado)');
            resolve({ success: true, message: 'Datos enviados (timeout ignorado)' });
        };

        const params = new URLSearchParams();
        params.append('datos', JSON.stringify(data));
        Logger.info('gas-service', `Enviando datos al GAS: ${data.Documento}`);
        xhr.send(params.toString());
    });
}

// ============================================================
// CONSULTA DESDE SHEETS  (reemplaza la edge function)
// ============================================================

/**
 * Llama al GAS de consulta que reemplaza la edge function
 * "relacionar-ingresos-distribuciones".
 * Lee 100% desde Google Sheets → sin egreso de Supabase.
 *
 * @param {Object} opts
 * @param {string}  [opts.idIngreso]    – filtrar por documento exacto
 * @param {string}  [opts.fechaInicio]  – YYYY-MM-DD
 * @param {string}  [opts.fechaFin]     – YYYY-MM-DD
 * @param {string}  [opts.productora]   – NIT del proveedor activo
 * @returns {Promise<{data: Array, total: number, filters: Object}>}
 */
async function relacionarDesdeSheets({ idIngreso, fechaInicio, fechaFin, productora } = {}) {
    Logger.info('gas-service', 'Consultando relacionar-ingresos-distribuciones desde Sheets...');
    const startTime = performance.now();

    // Construir URL con parámetros
    const params = new URLSearchParams();
    if (idIngreso)   params.append('id_ingreso',    idIngreso);
    if (fechaInicio) params.append('fecha_inicio',  fechaInicio);
    if (fechaFin)    params.append('fecha_fin',     fechaFin);
    if (productora)  params.append('productora',    productora);

    const url = `${GAS_CONSULTA_URL}${params.toString() ? '&' + params.toString() : ''}`;

    try {
        const resp = await fetch(url, { method: 'GET', redirect: 'follow' });

        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }

        const json = await resp.json();
        const elapsed = (performance.now() - startTime).toFixed(0);
        Logger.success('gas-service', `relacionarDesdeSheets: ${json.total ?? 0} registros en ${elapsed}ms`);
        return json;

    } catch (err) {
        Logger.error('gas-service', 'Error en relacionarDesdeSheets', err);
        throw err;
    }
}

window.relacionarDesdeSheets = relacionarDesdeSheets;