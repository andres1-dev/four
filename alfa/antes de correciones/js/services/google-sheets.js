// ============================================
// CONFIGURACIÓN DE PERFORMANCE
// ============================================

const BATCH_SIZE = 1000; // Procesamiento por lotes para mejor performance

// ============================================
// FUNCIONES BASE DE CONSULTA
// ============================================

async function fetchSheetData(range) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;
    const startTime = performance.now();

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const fetchTime = performance.now() - startTime;
        Logger.info('google-sheets', `Fetch completado en ${fetchTime.toFixed(0)}ms: ${range}`);

        return data;
    } catch (error) {
        Logger.error('google-sheets', `Error fetchSheetData para ${range}`, error);
        throw error;
    }
}

// ============================================
// CARGA DE DATOS PRINCIPALES
// ============================================

/**
 * Carga los datos de usuarios (escaners) desde la hoja USUARIOS
 * Estructura: USUARIO | NOMBRE | ESTADO (TRUE/FALSE)
 */
async function loadUsuariosData() {
    const data = await fetchSheetData(CONFIG_SHEETS.USUARIOS);
    const usuariosMap = new Map();

    if (data.values && data.values.length > 0) {
        const startTime = performance.now();
        for (let i = 1; i < data.values.length; i++) {
            const row = data.values[i];
            if (row.length >= 2) {
                const usuario = (row[0] || '').trim();
                const nombre = (row[1] || '').trim();
                const estado = (row[2] || 'TRUE').toString().toUpperCase().trim();
                if (usuario) {
                    usuariosMap.set(usuario, { NOMBRE: nombre, ESTADO: estado });
                }
            }
        }
        const loadTime = performance.now() - startTime;
        Logger.success('google-sheets', `${usuariosMap.size} USUARIOS cargados en ${loadTime.toFixed(0)}ms`);
    }

    setEscanersMap(usuariosMap);
    return usuariosMap;
}

/**
 * Carga los datos de proveedores desde la hoja PROVEEDORES
 * Estructura: CODIGO | NOMBRE | ESTADO (TRUE/FALSE)
 */
async function loadProveedoresData() {
    const data = await fetchSheetData(CONFIG_SHEETS.PROVEEDORES);
    const proveedoresMap = new Map();

    if (data.values && data.values.length > 0) {
        const startTime = performance.now();
        for (let i = 1; i < data.values.length; i++) {
            const row = data.values[i];
            if (row.length >= 2) {
                const codigo = (row[0] || '').trim();
                const nombre = (row[1] || '').trim();
                const estado = (row[2] || 'TRUE').toString().toUpperCase().trim();
                if (codigo) {
                    proveedoresMap.set(codigo, { NOMBRE: nombre, ESTADO: estado });
                }
            }
        }
        const loadTime = performance.now() - startTime;
        Logger.success('google-sheets', `${proveedoresMap.size} PROVEEDORES cargados en ${loadTime.toFixed(0)}ms`);
    }

    setProveedoresMap(proveedoresMap);
    return proveedoresMap;
}

/**
 * Carga los datos de auditores desde la hoja AUDITORES
 */
async function loadAuditoresData() {
    const data = await fetchSheetData(CONFIG_SHEETS.AUDITORES);
    const auditoresMap = new Map();

    if (data.values && data.values.length > 0) {
        const startTime = performance.now();
        for (let i = 1; i < data.values.length; i++) {
            const row = data.values[i];
            if (row.length >= 2) {
                const codigo = (row[0] || '').trim();
                const nombre = (row[1] || '').trim();
                const estado = (row[2] || 'TRUE').toString().toUpperCase().trim();
                if (codigo) {
                    auditoresMap.set(codigo, { NOMBRE: nombre, ESTADO: estado });
                }
            }
        }
        Logger.success('google-sheets', `${auditoresMap.size} AUDITORES cargados`);
    }

    setAuditoresMap(auditoresMap);
    return auditoresMap;
}

/**
 * Carga los datos de gestores desde la hoja GESTORES
 */
async function loadGestoresData() {
    const data = await fetchSheetData(CONFIG_SHEETS.GESTORES);
    const gestoresMap = new Map();

    if (data.values && data.values.length > 0) {
        const startTime = performance.now();
        for (let i = 1; i < data.values.length; i++) {
            const row = data.values[i];
            if (row.length >= 2) {
                const codigo = (row[0] || '').trim();
                const nombre = (row[1] || '').trim();
                const estado = (row[2] || 'TRUE').toString().toUpperCase().trim();
                if (codigo) {
                    gestoresMap.set(codigo, { NOMBRE: nombre, ESTADO: estado });
                }
            }
        }
        Logger.success('google-sheets', `${gestoresMap.size} GESTORES cargados`);
    }

    setGestoresMap(gestoresMap);
    return gestoresMap;
}

/**
 * Carga todos los datos de configuración dinámica
 */
async function loadAllConfigData() {
    Logger.info('google-sheets', 'Cargando datos de configuración dinámica...');

    const startTime = performance.now();

    await Promise.all([
        loadUsuariosData(),
        loadProveedoresData(),
        loadAuditoresData(),
        loadGestoresData()
    ]);

    const loadTime = performance.now() - startTime;
    Logger.success('google-sheets', `Todos los datos de configuración cargados en ${loadTime.toFixed(0)}ms`);
}

// ============================================
// FUNCIONES EXISTENTES PARA CARGA DE DATOS
// ============================================

async function loadColoresData() {
    const data = await fetchSheetData('COLORES');
    if (data.values && data.values.length > 0) {
        coloresMap.clear();
        const startTime = performance.now();

        for (let i = 1; i < data.values.length; i += BATCH_SIZE) {
            const end = Math.min(i + BATCH_SIZE, data.values.length);
            for (let j = i; j < end; j++) {
                const row = data.values[j];
                if (row.length >= 2) {
                    const codigo = row[0] || '';
                    const color = row[1] || '';
                    if (codigo && color) {
                        coloresMap.set(codigo.trim(), color.trim());
                    }
                }
            }
            if (i % (BATCH_SIZE * 10) === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        const loadTime = performance.now() - startTime;
        Logger.success('google-sheets', `COLORES cargados: ${coloresMap.size} registros en ${loadTime.toFixed(0)}ms`);
    }
    return coloresMap;
}

async function loadData2Data() {
    const data = await fetchSheetData('DATA2');
    if (data.values && data.values.length > 0) {
        data2Map.clear();
        data2CountMap.clear();
        data2JsonMap.clear();
        const startTime = performance.now();
        
        let jsonParseados = 0;
        let jsonErrores = 0;

        for (let i = 1; i < data.values.length; i++) {
            const row = data.values[i];
            if (row.length >= 10) {
                const op       = (row[6] || '').toString().trim();
                const fecha    = normalizeFecha(row[1] || '');
                const cantidad = (row[9] || '').toString().trim();
                
                // Cargar JSON de columna S (índice 18)
                const jsonStr = (row[18] || '').toString().trim();
                
                if (op) {
                    data2Map.set(`${op}|${fecha}|${cantidad}`, true);
                    data2CountMap.set(op, (data2CountMap.get(op) || 0) + 1);
                }
                
                // Parsear y almacenar JSON por LOTE
                if (jsonStr) {
                    try {
                        const jsonData = JSON.parse(jsonStr);
                        const lote = jsonData.LOTE || jsonData.A;
                        
                        if (lote) {
                            // Convertir LOTE a string para consistencia
                            const loteKey = lote.toString().trim();
                            
                            // Almacenar múltiples registros por LOTE (para detectar parciales)
                            if (!data2JsonMap.has(loteKey)) {
                                data2JsonMap.set(loteKey, []);
                            }
                            
                            data2JsonMap.get(loteKey).push({
                                ...jsonData,
                                _rowIndex: i + 1 // Guardar índice de fila para referencia
                            });
                            
                            jsonParseados++;
                        }
                    } catch (err) {
                        jsonErrores++;
                        Logger.warn('google-sheets', `Error parseando JSON en fila ${i + 1}: ${err.message}`);
                    }
                }
            }
        }

        const loadTime = performance.now() - startTime;
        Logger.success('google-sheets', `DATA2 cargada: ${data2Map.size} registros, ${data2JsonMap.size} lotes únicos, ${jsonParseados} JSONs parseados, ${jsonErrores} errores en ${loadTime.toFixed(0)}ms`);
    }
    return data2Map;
}

async function loadPreciosData() {
    const data = await fetchSheetData('PRECIOS');
    if (data.values && data.values.length > 0) {
        preciosMap.clear();
        const startTime = performance.now();

        for (let i = 1; i < data.values.length; i += BATCH_SIZE) {
            const end = Math.min(i + BATCH_SIZE, data.values.length);
            for (let j = i; j < end; j++) {
                const row = data.values[j];
                if (row.length >= 2) {
                    const referencia = row[0] || '';
                    const pvp = row[1] || '';
                    if (referencia && pvp) {
                        preciosMap.set(referencia.trim(), pvp.trim());
                    }
                }
            }
            if (i % (BATCH_SIZE * 10) === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        const loadTime = performance.now() - startTime;
        Logger.success('google-sheets', `PRECIOS cargados: ${preciosMap.size} referencias en ${loadTime.toFixed(0)}ms`);
    }
    return preciosMap;
}

async function loadSisproData() {
    const data = await fetchSheetData('SISPROWEB');
    if (data.values && data.values.length > 0) {
        sisproMap.clear();
        const startTime = performance.now();

        for (let i = 1; i < data.values.length; i += BATCH_SIZE) {
            const end = Math.min(i + BATCH_SIZE, data.values.length);
            for (let j = i; j < end; j++) {
                const row = data.values[j];
                if (row.length >= 4) {
                    const op = row[0] || '';
                    if (op) {
                        sisproMap.set(op.trim(), {
                            PRENDA:     (row[1] || '').trim(),
                            LINEA:      (row[2] || '').trim(),
                            GENERO:     (row[3] || '').trim(),
                            REFERENCIA: (row[4] || '').trim()
                        });
                    }
                }
            }
            if (i % (BATCH_SIZE * 10) === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        const loadTime = performance.now() - startTime;
        Logger.success('google-sheets', `SISPROWEB cargado: ${sisproMap.size} productos en ${loadTime.toFixed(0)}ms`);
    }
    return sisproMap;
}

async function loadHistoricasData() {
    const data = await fetchSheetData('HISTORICAS');
    if (data.values && data.values.length > 0) {
        historicasMap.clear();
        const startTime = performance.now();

        for (let i = 1; i < data.values.length; i++) {
            const row = data.values[i];
            if (row.length >= 2) {
                const refprov = row[0] || '';
                const referencia = row[1] || '';
                if (refprov) historicasMap.set(refprov.trim(), referencia.trim());
            }
        }

        const loadTime = performance.now() - startTime;
        Logger.success('google-sheets', `HISTORICAS cargadas: ${historicasMap.size} referencias en ${loadTime.toFixed(0)}ms`);
    }
    return historicasMap;
}

async function loadClientesData() {
    const data = await fetchSheetData('CLIENTES');
    if (data.values && data.values.length > 0) {
        clientesMap.clear();
        Logger.info('google-sheets', 'Cargando CLIENTES desde Google Sheets...');
        const startTime = performance.now();

        for (let i = 1; i < data.values.length; i += BATCH_SIZE) {
            const end = Math.min(i + BATCH_SIZE, data.values.length);
            for (let j = i; j < end; j++) {
                const row = data.values[j];
                const id = row[0] || '';

                if (id && id.trim()) {
                    clientesMap.set(id.trim(), {
                        ID: id.trim(),
                        RAZON_SOCIAL: (row[1] || '').trim(),
                        NOMBRE_CORTO: (row[2] || '').trim(),
                        TIPO_CLIENTE: (row[3] || '').trim(),
                        ESTADO: (row[4] || '').trim(),
                        DIRECCION: (row[5] || '').trim(),
                        TELEFONO: (row[6] || '').trim(),
                        EMAIL: (row[7] || '').trim(),
                        TIPO_EMPRESA: (row[8] || '').trim()
                    });
                }
            }
            if (i % (BATCH_SIZE * 10) === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        const loadTime = performance.now() - startTime;
        Logger.success('google-sheets', `CLIENTES cargados: ${clientesMap.size} clientes en ${loadTime.toFixed(0)}ms`);
    }
    return clientesMap;
}

// ============================================
// CONSULTAS ESPECÍFICAS PARA DISTRIBUCIÓN
// ============================================

async function fetchDistributionSheet(range) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${DISTRIBUTION_SPREADSHEET_ID}/values/${range}?key=${DISTRIBUTION_API_KEY}`;
    const response = await fetch(url);
    return await response.json();
}

async function checkIfRecExists(recNumber) {
    try {
        Logger.info('google-sheets', `Consultando si REC ${recNumber} existe...`);
        const range = `${DISTRIBUTION_SHEET_NAME}!A:A`;
        const data = await fetchDistributionSheet(range);

        if (!data.values) {
            return { exists: false, documents: [] };
        }

        const documentos = data.values.flat();
        const matchingDocuments = documentos.filter(doc => {
            if (!doc) return false;
            const docStr = doc.toString();
            const recStr = recNumber.toString();
            if (docStr === recStr) return true;
            if (docStr.startsWith(recStr + '.')) return true;
            return false;
        });

        return {
            exists: matchingDocuments.length > 0,
            documents: matchingDocuments,
            count: matchingDocuments.length
        };
    } catch (error) {
        console.error('Error consultando REC:', error);
        return { exists: false, error: error.message, documents: [] };
    }
}

async function verifyDocumentSavedExhaustive(recNumber, maxRetries = 5, initialDelay = 1000) {
    Logger.info('google-sheets', `Verificación exhaustiva para ${recNumber}...`);
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await new Promise(resolve => setTimeout(resolve, delay));
            const range = `${DISTRIBUTION_SHEET_NAME}!A:E`;
            const data = await fetchDistributionSheet(range);

            if (data.values) {
                for (let i = 0; i < data.values.length; i++) {
                    const row = data.values[i];
                    if (row[0] && row[0].toString() === recNumber.toString()) {
                        Logger.success('google-sheets', `Documento encontrado en fila ${i + 1}`);
                        return {
                            success: true,
                            verified: true,
                            fila: i + 1,
                            documento: recNumber,
                            estado: row[3] || 'DESCONOCIDO',
                            comentarios: row[4] || '',
                            timestamp: new Date().toISOString(),
                            verificationMethod: 'Google Sheets API',
                            attempt: attempt
                        };
                    }
                }
            }
            Logger.warn('google-sheets', `Documento ${recNumber} no encontrado en intento ${attempt}`);
            delay *= 2;
        } catch (error) {
            console.error(`Error en intento ${attempt}:`, error);
            if (attempt === maxRetries) {
                return { success: false, verified: false, error: `Error: ${error.message}` };
            }
            delay *= 2;
        }
    }

    return { success: false, verified: false, error: `No encontrado después de ${maxRetries} intentos` };
}

// ============================================
// FUNCIONES DE PEDIDOS (NUEVO SISTEMA)
// ============================================

async function loadPedidosData() {
    const data = await fetchSheetData('PEDIDOS_ACTIVOS');
    if (data.values && data.values.length > 1) {
        const pedidos = [];
        for (let i = 1; i < data.values.length; i++) {
            const row = data.values[i];
            if (row.length >= 11) {
                pedidos.push({
                    id: row[0] || '',
                    mayoristaId: row[1] || '',
                    nombreCliente: row[2] || '',
                    op: row[3] || '',
                    referencia: row[4] || '',
                    prenda: row[5] || '',
                    genero: row[6] || '',
                    cantidad: parseInt(row[7]) || 0,
                    obs: row[8] || '',
                    fecha: row[9] || '',
                    estado: row[10] || 'PENDIENTE'
                });
            }
        }
        Logger.success('google-sheets', `PEDIDOS_ACTIVOS cargados: ${pedidos.length} pedidos`);
        return pedidos;
    }
    return [];
}

async function loadFinalizadosData() {
    const data = await fetchSheetData('PEDIDOS_FINALIZADOS');
    if (data.values && data.values.length > 1) {
        const finalizados = [];
        for (let i = 1; i < data.values.length; i++) {
            const row = data.values[i];
            if (row.length >= 12) {
                finalizados.push({
                    id: row[0] || '',
                    mayoristaId: row[1] || '',
                    nombreCliente: row[2] || '',
                    op: row[3] || '',
                    referencia: row[4] || '',
                    prenda: row[5] || '',
                    genero: row[6] || '',
                    cantidad: parseInt(row[7]) || 0,
                    obs: row[8] || '',
                    fecha: row[9] || '',
                    estado: row[10] || 'COMPLETADO',
                    fechaFin: row[11] || ''
                });
            }
        }
        Logger.success('google-sheets', `PEDIDOS_FINALIZADOS cargados: ${finalizados.length} pedidos`);
        return finalizados;
    }
    return [];
}

async function agregarPedidoASheets(pedido) {
    const formData = new URLSearchParams();
    formData.append('action', 'agregarPedido');
    formData.append('datos', JSON.stringify(pedido));
    const response = await fetch(SISPROWEB_GAS_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Error agregando pedido');
    return result;
}

async function actualizarPedidoEnSheets(pedido) {
    const formData = new URLSearchParams();
    formData.append('action', 'actualizarPedido');
    formData.append('datos', JSON.stringify(pedido));
    const response = await fetch(SISPROWEB_GAS_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Error actualizando pedido');
    return result;
}

async function eliminarPedidoDeSheets(id) {
    const formData = new URLSearchParams();
    formData.append('action', 'eliminarPedido');
    formData.append('datos', JSON.stringify({ id }));
    const response = await fetch(SISPROWEB_GAS_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Error eliminando pedido');
    return result;
}

async function finalizarPedidoEnSheets(pedido) {
    const formData = new URLSearchParams();
    formData.append('action', 'finalizarPedido');
    formData.append('datos', JSON.stringify(pedido));
    const response = await fetch(SISPROWEB_GAS_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Error finalizando pedido');
    return result;
}

async function eliminarFinalizadoDeSheets(id) {
    const formData = new URLSearchParams();
    formData.append('action', 'eliminarFinalizado');
    formData.append('datos', JSON.stringify({ id }));
    const response = await fetch(SISPROWEB_GAS_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Error eliminando finalizado');
    return result;
}

/**
 * Guarda nuevos datos en la hoja SISPROWEB usando el GAS dedicado
 */
async function saveNewSISPROWEBData(data) {
    const formData = new URLSearchParams();
    formData.append('action', 'appendData');
    formData.append('datos', JSON.stringify(data));

    const response = await fetch(SISPROWEB_GAS_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message || 'Error desconocido al guardar en SISPROWEB');
    }

    return result;
}

/**
 * Guarda nuevos colores en la hoja COLORES
 */
async function saveNewColorData(data) {
    const formData = new URLSearchParams();
    formData.append('action', 'appendColor');
    formData.append('datos', JSON.stringify(data));

    const response = await fetch(SISPROWEB_GAS_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message || 'Error desconocido al guardar Color');
    }

    return result;
}

/**
 * Guarda nuevos usuarios en la hoja USUARIOS
 */
async function saveNewUsuarioData(data) {
    const formData = new URLSearchParams();
    formData.append('action', 'appendUsuario');
    formData.append('datos', JSON.stringify(data));

    const response = await fetch(SISPROWEB_GAS_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Error guardando Usuario');
    return result;
}

/**
 * Guarda nuevos clientes en la hoja CLIENTES
 */
async function saveNewClienteData(data) {
    const formData = new URLSearchParams();
    formData.append('action', 'appendCliente');
    formData.append('datos', JSON.stringify(data));

    const response = await fetch(SISPROWEB_GAS_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Error guardando Cliente');
    return result;
}

/**
 * Actualiza un cliente existente en la hoja CLIENTES buscando por ID (columna A).
 * Envía la fila completa: [ID, Razón Social, Nombre Corto, Tipo Cliente, Estado, Dirección, Teléfono, Email, Tipo Empresa]
 */
async function updateClienteData(fila) {
    const formData = new URLSearchParams();
    formData.append('action', 'updateCliente');
    formData.append('datos', JSON.stringify(fila));

    const response = await fetch(SISPROWEB_GAS_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Error actualizando Cliente');
    return result;
}


/**
 * Guarda nuevos proveedores
 */
async function saveNewProveedorData(data) {
    const formData = new URLSearchParams();
    formData.append('action', 'appendProveedor');
    formData.append('datos', JSON.stringify(data));
    const response = await fetch(SISPROWEB_GAS_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Error guardando Proveedor');
    return result;
}

/**
 * Guarda nuevos auditores
 */
async function saveNewAuditorData(data) {
    const formData = new URLSearchParams();
    formData.append('action', 'appendAuditor');
    formData.append('datos', JSON.stringify(data));
    const response = await fetch(SISPROWEB_GAS_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Error guardando Auditor');
    return result;
}

/**
 * Guarda nuevos gestores
 */
async function saveNewGestorData(data) {
    const formData = new URLSearchParams();
    formData.append('action', 'appendGestor');
    formData.append('datos', JSON.stringify(data));
    const response = await fetch(SISPROWEB_GAS_URL, { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Error guardando Gestor');
    return result;
}

// ============================================
// EXPORTS
// ============================================

// NOTA: loadColoresData y loadClientesData ya no se exportan aquí
// porque ahora se manejan desde data-loader.js con Supabase

window.loadAllConfigData = loadAllConfigData;
window.loadUsuariosData = loadUsuariosData;
window.loadProveedoresData = loadProveedoresData;
window.loadAuditoresData = loadAuditoresData;
window.loadGestoresData = loadGestoresData;
// window.loadColoresData = loadColoresData;  // Ahora en data-loader.js
window.loadData2Data = loadData2Data;
window.loadPreciosData = loadPreciosData;
window.loadSisproData = loadSisproData;
window.loadHistoricasData = loadHistoricasData;
// window.loadClientesData = loadClientesData;  // Ahora en data-loader.js
window.loadPedidosData = loadPedidosData;
window.loadFinalizadosData = loadFinalizadosData;
window.agregarPedidoASheets = agregarPedidoASheets;
window.actualizarPedidoEnSheets = actualizarPedidoEnSheets;
window.eliminarPedidoDeSheets = eliminarPedidoDeSheets;
window.finalizarPedidoEnSheets = finalizarPedidoEnSheets;
window.eliminarFinalizadoDeSheets = eliminarFinalizadoDeSheets;
window.saveNewSISPROWEBData = saveNewSISPROWEBData;
window.saveNewColorData = saveNewColorData;
window.saveNewUsuarioData = saveNewUsuarioData;
window.saveNewClienteData = saveNewClienteData;
window.updateClienteData = updateClienteData;

window.saveNewProveedorData = saveNewProveedorData;
window.saveNewAuditorData = saveNewAuditorData;
window.saveNewGestorData = saveNewGestorData;
window.checkIfRecExists = checkIfRecExists;
window.verifyDocumentSavedExhaustive = verifyDocumentSavedExhaustive;
