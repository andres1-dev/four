// ============================================
// DATA LOADER - ADAPTADOR HÍBRIDO
// Permite transición gradual de Google Sheets a Supabase
// ============================================

/**
 * Configuración de fuentes de datos
 * Cambiar a 'supabase' cuando las tablas estén migradas
 */
const DATA_SOURCES = {
    USUARIOS: 'supabase',      // ✅ Migrado
    PROVEEDORES: 'supabase',   // ✅ Migrado
    AUDITORES: 'supabase',     // ✅ Migrado
    GESTORES: 'supabase',      // ✅ Migrado
    PRECIOS: 'supabase',       // ✅ Migrado
    SISPROWEB: 'supabase',     // ✅ Migrado (Multi-proyecto)
    HISTORICAS: 'supabase',    // ✅ Migrado
    // DATA2: 'supabase',      // ❌ Tabla eliminada - No se usa
    CLIENTES: 'supabase',      // ✅ Migrado
    PEDIDOS: 'supabase',       // ✅ Migrado (antes pedidos_activos)
    COLORES: 'supabase'        // ✅ Migrado
};

// ============================================
// GUARDAR FUNCIONES ORIGINALES DE GOOGLE SHEETS
// Se guardan en un namespace privado para evitar conflictos
// ============================================
const _originalSheets = {};

// Función para inicializar las referencias originales
(function() {
    // Esperar a que google-sheets.js se cargue completamente
    if (typeof window.loadColoresData !== 'undefined') {
        _originalSheets.loadColoresData = window.loadColoresData;
    }
    if (typeof window.loadSisproData !== 'undefined') {
        _originalSheets.loadSisproData = window.loadSisproData;
    }
    if (typeof window.loadHistoricasData !== 'undefined') {
        _originalSheets.loadHistoricasData = window.loadHistoricasData;
    }
})();

// ============================================
// FUNCIONES ADAPTADORAS
// ============================================

/**
 * Carga usuarios desde la fuente configurada
 */
async function loadUsuariosData() {
    if (DATA_SOURCES.USUARIOS === 'supabase') {
        const usuariosMap = await loadUsuariosFromSupabase();
        // Actualizar mapa global
        if (typeof setEscanersMap === 'function') {
            setEscanersMap(usuariosMap);
        }
        return usuariosMap;
    } else {
        Logger.warn('data-loader', 'Usando Google Sheets para USUARIOS (no recomendado)');
        return new Map();
    }
}

/**
 * Carga proveedores desde la fuente configurada
 */
async function loadProveedoresData() {
    if (DATA_SOURCES.PROVEEDORES === 'supabase') {
        const proveedoresMap = await loadProveedoresFromSupabase();
        // Actualizar mapa global
        if (typeof setProveedoresMap === 'function') {
            setProveedoresMap(proveedoresMap);
        }
        return proveedoresMap;
    } else {
        Logger.warn('data-loader', 'Usando Google Sheets para PROVEEDORES (no recomendado)');
        return new Map();
    }
}

/**
 * Carga auditores desde la fuente configurada
 */
async function loadAuditoresData() {
    if (DATA_SOURCES.AUDITORES === 'supabase') {
        const auditoresMap = await loadAuditoresFromSupabase();
        // Actualizar mapa global
        if (typeof setAuditoresMap === 'function') {
            setAuditoresMap(auditoresMap);
        }
        return auditoresMap;
    } else {
        Logger.warn('data-loader', 'Usando Google Sheets para AUDITORES (no recomendado)');
        return new Map();
    }
}

/**
 * Carga gestores desde la fuente configurada
 */
async function loadGestoresData() {
    if (DATA_SOURCES.GESTORES === 'supabase') {
        const gestoresMap = await loadGestoresFromSupabase();
        // Actualizar mapa global
        if (typeof setGestoresMap === 'function') {
            setGestoresMap(gestoresMap);
        }
        return gestoresMap;
    } else {
        Logger.warn('data-loader', 'Usando Google Sheets para GESTORES (no recomendado)');
        return new Map();
    }
}

/**
 * Carga precios desde la fuente configurada
 */
async function loadPreciosData() {
    if (DATA_SOURCES.PRECIOS === 'supabase') {
        const result = await loadPreciosFromSupabase();
        // Actualizar mapa global SIN reemplazarlo (mantener la referencia)
        window.preciosMap.clear();
        result.forEach((value, key) => {
            window.preciosMap.set(key, value);
        });
        return window.preciosMap;
    } else {
        Logger.warn('data-loader', 'Usando Google Sheets para PRECIOS (no recomendado)');
        return new Map();
    }
}

/**
 * Carga catálogo de productos desde la fuente configurada.
 * Carga bajo demanda únicamente para las OPs especificadas que no estén ya en memoria.
 * @param {string[]} [ops] - OPs a buscar.
 */
async function loadSisproData(ops = []) {
    if (DATA_SOURCES.SISPROWEB === 'supabase') {
        try {
            // Si no se pasaron OPs específicas, omitir carga masiva
            if (!ops || ops.length === 0) {
                Logger.info('data-loader', 'Carga masiva de master omitida al inicio (solo bajo demanda)');
                return window.sisproMap;
            }

            const opsClean = [...new Set(ops.map(o => String(o).trim()).filter(Boolean))];
            if (opsClean.length === 0) {
                return window.sisproMap;
            }

            // Identificar qué OPs de la lista NO están en el mapa en memoria
            const missingInMemory = opsClean.filter(op => !window.sisproMap.has(op));

            if (missingInMemory.length === 0) {
                return window.sisproMap;
            }

            Logger.info('data-loader', `Consultando ${missingInMemory.length} OPs faltantes en catálogo master local...`);
            let result = await loadSisprowebFromSupabase(missingInMemory);

            // Verificar si alguna OP requerida no existe en la tabla master local de Supabase
            const stillMissing = missingInMemory.filter(op => !result.has(op));

            if (stillMissing.length > 0 && typeof syncMasterEdgeFunction === 'function') {
                Logger.info('data-loader', `${stillMissing.length} OPs no encontradas en master local. Sincronizando con servidor remoto (sync-master)...`);
                const syncRes = await syncMasterEdgeFunction();
                if (syncRes && syncRes.success) {
                    const extraRes = await loadSisprowebFromSupabase(stillMissing);
                    extraRes.forEach((value, key) => {
                        result.set(key, value);
                    });
                }
            }

            // Agregar OPs encontradas al mapa global sisproMap sin borrar las anteriores
            result.forEach((value, key) => {
                window.sisproMap.set(key, value);
            });

            return window.sisproMap;
        } catch (error) {
            Logger.error('data-loader', 'Error en loadSisproData', error);
            return window.sisproMap;
        }
    } else {
        Logger.warn('data-loader', 'Usando Google Sheets para SISPROWEB');
        if (typeof _originalSheets.loadSisproData === 'function') {
            return await _originalSheets.loadSisproData();
        }
        return window.sisproMap || new Map();
    }
}

/**
 * Carga referencias históricas desde la fuente configurada
 */
async function loadHistoricasData() {
    if (DATA_SOURCES.HISTORICAS === 'supabase') {
        try {
            const result = await loadHistoricasFromSupabase();
            window.historicasMap.clear();
            result.forEach((value, key) => {
                window.historicasMap.set(key, value);
            });
            return window.historicasMap;
        } catch (error) {
            Logger.error('data-loader', 'Error cargando HISTORICAS desde Supabase, intentando fallback a Sheets...', error);
            if (typeof _originalSheets.loadHistoricasData === 'function') {
                return await _originalSheets.loadHistoricasData();
            }
            return new Map();
        }
    } else {
        Logger.info('data-loader', 'Usando Google Sheets para HISTORICAS');
        if (typeof _originalSheets.loadHistoricasData === 'function') {
            return await _originalSheets.loadHistoricasData();
        }
        return new Map();
    }
}

/**
 * Carga OPs confirmadas desde `ingresos` en Supabase,
 * filtrando por el proveedor activo (productora).
 * @param {string[]} [lotes] - Lotes a buscar. Si está vacío, retorna mapas vacíos.
 */
async function loadData2Data(lotes = []) {
    try {
        const { data2Map, data2CountMap, data2JsonMap } = await loadData2FromSupabase(lotes);

        // Actualizar variables globales
        window.data2Map      = data2Map;
        window.data2CountMap = data2CountMap;
        window.data2JsonMap  = data2JsonMap;

        // También actualizar las referencias locales de constants.js
        // (los módulos que leen directamente la variable, no window.*)
        if (typeof setData2Maps === 'function') {
            setData2Maps(data2Map, data2CountMap, data2JsonMap);
        }

        return data2Map;
    } catch (error) {
        Logger.error('data-loader', 'Error cargando ingresos confirmados, usando mapas vacíos', error);
        window.data2Map      = new Map();
        window.data2CountMap = new Map();
        window.data2JsonMap  = new Map();
        return new Map();
    }
}

/**
 * Carga clientes desde la fuente configurada
 */
async function loadClientesData() {
    if (DATA_SOURCES.CLIENTES === 'supabase') {
        const result = await loadClientesFromSupabase();
        
        // Actualizar mapa global SIN reemplazarlo (mantener la referencia)
        window.clientesMap.clear();
        result.forEach((value, key) => {
            window.clientesMap.set(key, value);
        });
        
        return window.clientesMap;
    } else {
        Logger.warn('data-loader', 'Usando Google Sheets para CLIENTES (no recomendado)');
        return new Map();
    }
}

/**
 * Carga pedidos desde la fuente configurada
 */
async function loadPedidosData() {
    if (DATA_SOURCES.PEDIDOS === 'supabase') {
        return await loadPedidosFromSupabase();
    } else {
        Logger.warn('data-loader', 'Usando Google Sheets para PEDIDOS (no recomendado)');
        return [];
    }
}

/**
 * Carga colores desde la fuente configurada
 */
async function loadColoresData() {
    if (DATA_SOURCES.COLORES === 'supabase') {
        const result = await loadColoresFromSupabase();
        
        // Actualizar mapa global SIN reemplazarlo (mantener la referencia)
        window.coloresMap.clear();
        result.forEach((value, key) => {
            window.coloresMap.set(key, value);
        });
        
        return window.coloresMap;
    } else {
        Logger.warn('data-loader', 'Usando Google Sheets para COLORES (no recomendado)');
        // Llamar a la función original de Google Sheets
        if (typeof _originalSheets.loadColoresData === 'function') {
            return await _originalSheets.loadColoresData();
        }
        return new Map();
    }
}

/**
 * Carga toda la configuración dinámica
 */
async function loadAllConfigData() {
    Logger.info('data-loader', 'Cargando configuración dinámica...');
    const startTime = performance.now();

    await Promise.all([
        loadUsuariosData(),
        loadProveedoresData(),
        loadAuditoresData(),
        loadGestoresData()
    ]);

    const loadTime = performance.now() - startTime;
    Logger.success('data-loader', `Configuración cargada en ${loadTime.toFixed(0)}ms`);
}

// ============================================
// FUNCIONES DE GUARDADO (HÍBRIDAS)
// ============================================

/**
 * Guarda nuevo usuario
 */
async function saveNewUsuarioData(data) {
    if (DATA_SOURCES.USUARIOS === 'supabase') {
        Logger.info('data-loader', 'Guardando usuarios...', data);
        
        // Manejar tanto arrays como objetos
        let usuarios = [];
        
        if (Array.isArray(data)) {
            // Si es un array de arrays [[id, nombre, estado], ...]
            if (Array.isArray(data[0])) {
                usuarios = data.map(row => {
                    const id = (row[0] || '').toString().trim();
                    const nombre = (row[1] || '').toString().trim();
                    const estado = (row[2] || 'TRUE').toString().toUpperCase() === 'TRUE';
                    
                    if (!id) {
                        throw new Error('ID de usuario es requerido');
                    }
                    
                    return {
                        id_usuario: id,
                        nombre_usuario: nombre,
                        estado: estado
                    };
                });
            } 
            // Si es un solo array [id, nombre, estado]
            else if (data.length > 0) {
                const id = (data[0] || '').toString().trim();
                const nombre = (data[1] || '').toString().trim();
                const estado = (data[2] || 'TRUE').toString().toUpperCase() === 'TRUE';
                
                if (!id) {
                    throw new Error('ID de usuario es requerido');
                }
                
                usuarios = [{
                    id_usuario: id,
                    nombre_usuario: nombre,
                    estado: estado
                }];
            }
        } 
        // Si es un objeto
        else if (typeof data === 'object' && data !== null) {
            const id = (data.USUARIO || data.id_usuario || data.codigo_usuario || data.id || '').toString().trim();
            const nombre = (data.NOMBRE || data.nombre_usuario || '').toString().trim();
            const estado = (data.ESTADO || data.estado || 'TRUE').toString().toUpperCase() === 'TRUE';
            
            if (!id) {
                throw new Error('ID de usuario es requerido');
            }
            
            usuarios = [{
                id_usuario: id,
                nombre_usuario: nombre,
                estado: estado
            }];
        }
        
        if (usuarios.length === 0) {
            throw new Error('No hay datos válidos para guardar');
        }
        
        Logger.info('data-loader', `Guardando ${usuarios.length} usuarios en Supabase`, usuarios);
        
        // Usar UPSERT para insertar o actualizar todos a la vez
        const result = await supabase.upsert('usuarios', usuarios, 'id_usuario');
        
        Logger.success('data-loader', `${usuarios.length} usuarios guardados exitosamente`);
        return result;
    } else {
        throw new Error('Google Sheets no soportado para guardar usuarios');
    }
}

/**
 * Guarda nuevo proveedor
 */
async function saveNewProveedorData(data) {
    if (DATA_SOURCES.PROVEEDORES === 'supabase') {
        Logger.info('data-loader', 'Guardando proveedores...', data);
        
        let proveedores = [];
        
        if (Array.isArray(data)) {
            if (Array.isArray(data[0])) {
                proveedores = data.map(row => {
                    const id = (row[0] || '').toString().trim();
                    const nombre = (row[1] || '').toString().trim();
                    const estado = (row[2] || 'TRUE').toString().toUpperCase() === 'TRUE';
                    
                    if (!id) {
                        throw new Error('ID de proveedor es requerido');
                    }
                    
                    return {
                        id_proveedor: id,
                        nombre_proveedor: nombre,
                        estado: estado
                    };
                });
            } else if (data.length > 0) {
                const id = (data[0] || '').toString().trim();
                const nombre = (data[1] || '').toString().trim();
                const estado = (data[2] || 'TRUE').toString().toUpperCase() === 'TRUE';
                
                if (!id) {
                    throw new Error('ID de proveedor es requerido');
                }
                
                proveedores = [{
                    id_proveedor: id,
                    nombre_proveedor: nombre,
                    estado: estado
                }];
            }
        } else if (typeof data === 'object' && data !== null) {
            const id = (data.CODIGO || data.id_proveedor || data.codigo_proveedor || data.id || '').toString().trim();
            const nombre = (data.NOMBRE || data.nombre_proveedor || '').toString().trim();
            const estado = (data.ESTADO || data.estado || 'TRUE').toString().toUpperCase() === 'TRUE';
            
            if (!id) {
                throw new Error('ID de proveedor es requerido');
            }
            
            proveedores = [{
                id_proveedor: id,
                nombre_proveedor: nombre,
                estado: estado
            }];
        }
        
        if (proveedores.length === 0) {
            throw new Error('No hay datos válidos para guardar');
        }
        
        Logger.info('data-loader', `Guardando ${proveedores.length} proveedores en Supabase`, proveedores);
        
        const result = await supabase.upsert('proveedores', proveedores, 'id_proveedor');
        
        Logger.success('data-loader', `${proveedores.length} proveedores guardados exitosamente`);
        return result;
    } else {
        throw new Error('Google Sheets no soportado para guardar proveedores');
    }
}

/**
 * Guarda nuevo auditor
 */
async function saveNewAuditorData(data) {
    if (DATA_SOURCES.AUDITORES === 'supabase') {
        Logger.info('data-loader', 'Guardando auditores...', data);
        
        let auditores = [];
        
        if (Array.isArray(data)) {
            if (Array.isArray(data[0])) {
                auditores = data.map(row => {
                    const id = (row[0] || '').toString().trim();
                    const nombre = (row[1] || '').toString().trim();
                    const estado = (row[2] || 'TRUE').toString().toUpperCase() === 'TRUE';
                    
                    if (!id) {
                        throw new Error('ID de auditor es requerido');
                    }
                    
                    return {
                        id_auditor: id,
                        nombre_auditor: nombre,
                        estado: estado
                    };
                });
            } else if (data.length > 0) {
                const id = (data[0] || '').toString().trim();
                const nombre = (data[1] || '').toString().trim();
                const estado = (data[2] || 'TRUE').toString().toUpperCase() === 'TRUE';
                
                if (!id) {
                    throw new Error('ID de auditor es requerido');
                }
                
                auditores = [{
                    id_auditor: id,
                    nombre_auditor: nombre,
                    estado: estado
                }];
            }
        } else if (typeof data === 'object' && data !== null) {
            const id = (data.CODIGO || data.id_auditor || data.codigo_auditor || data.id || '').toString().trim();
            const nombre = (data.NOMBRE || data.nombre_auditor || '').toString().trim();
            const estado = (data.ESTADO || data.estado || 'TRUE').toString().toUpperCase() === 'TRUE';
            
            if (!id) {
                throw new Error('ID de auditor es requerido');
            }
            
            auditores = [{
                id_auditor: id,
                nombre_auditor: nombre,
                estado: estado
            }];
        }
        
        if (auditores.length === 0) {
            throw new Error('No hay datos válidos para guardar');
        }
        
        Logger.info('data-loader', `Guardando ${auditores.length} auditores en Supabase`, auditores);
        
        const result = await supabase.upsert('auditores', auditores, 'id_auditor');
        
        Logger.success('data-loader', `${auditores.length} auditores guardados exitosamente`);
        return result;
    } else {
        throw new Error('Google Sheets no soportado para guardar auditores');
    }
}

/**
 * Guarda nuevo gestor
 */
async function saveNewGestorData(data) {
    if (DATA_SOURCES.GESTORES === 'supabase') {
        Logger.info('data-loader', 'Guardando gestores...', data);
        
        let gestores = [];
        
        if (Array.isArray(data)) {
            if (Array.isArray(data[0])) {
                gestores = data.map(row => {
                    const id = (row[0] || '').toString().trim();
                    const nombre = (row[1] || '').toString().trim();
                    const estado = (row[2] || 'TRUE').toString().toUpperCase() === 'TRUE';
                    
                    if (!id) {
                        throw new Error('ID de gestor es requerido');
                    }
                    
                    return {
                        id_gestor: id,
                        nombre_gestor: nombre,
                        estado: estado
                    };
                });
            } else if (data.length > 0) {
                const id = (data[0] || '').toString().trim();
                const nombre = (data[1] || '').toString().trim();
                const estado = (data[2] || 'TRUE').toString().toUpperCase() === 'TRUE';
                
                if (!id) {
                    throw new Error('ID de gestor es requerido');
                }
                
                gestores = [{
                    id_gestor: id,
                    nombre_gestor: nombre,
                    estado: estado
                }];
            }
        } else if (typeof data === 'object' && data !== null) {
            const id = (data.CODIGO || data.id_gestor || data.codigo_gestor || data.id || '').toString().trim();
            const nombre = (data.NOMBRE || data.nombre_gestor || '').toString().trim();
            const estado = (data.ESTADO || data.estado || 'TRUE').toString().toUpperCase() === 'TRUE';
            
            if (!id) {
                throw new Error('ID de gestor es requerido');
            }
            
            gestores = [{
                id_gestor: id,
                nombre_gestor: nombre,
                estado: estado
            }];
        }
        
        if (gestores.length === 0) {
            throw new Error('No hay datos válidos para guardar');
        }
        
        Logger.info('data-loader', `Guardando ${gestores.length} gestores en Supabase`, gestores);
        
        const result = await supabase.upsert('gestores', gestores, 'id_gestor');
        
        Logger.success('data-loader', `${gestores.length} gestores guardados exitosamente`);
        return result;
    } else {
        throw new Error('Google Sheets no soportado para guardar gestores');
    }
}

/**
 * Guarda nuevo color
 */
async function saveNewColorData(data) {
    if (DATA_SOURCES.COLORES === 'supabase') {
        Logger.info('data-loader', 'Guardando colores...', data);
        
        // Obtener productora activa
        const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
        const productora = proveedorActivo ? proveedorActivo.id : '';

        if (Array.isArray(data)) {
            // Si es un array de objetos con {codigo, nombre}
            if (data.length > 0 && typeof data[0] === 'object' && !Array.isArray(data[0])) {
                colores = data.map(item => {
                    const codigo = (item.codigo || item.CODIGO || item.id_color || '').toString().trim();
                    const nombre = (item.nombre || item.NOMBRE || item.nombre_color || '').toString().trim();
                    
                    if (!codigo || !nombre) {
                        throw new Error('Código y nombre de color son requeridos');
                    }
                    
                    return {
                        id_color: codigo,
                        nombre_color: nombre,
                        productora: productora
                    };
                });
            }
            // Si es un array de arrays [[codigo, nombre], ...]
            else if (Array.isArray(data[0])) {
                colores = data.map(row => {
                    const codigo = (row[0] || '').toString().trim();
                    const nombre = (row[1] || '').toString().trim();
                    
                    if (!codigo || !nombre) {
                        throw new Error('Código y nombre de color son requeridos');
                    }
                    
                    return {
                        id_color: codigo,
                        nombre_color: nombre,
                        productora: productora
                    };
                });
            }
            // Si es un solo array [codigo, nombre]
            else if (data.length > 0) {
                const codigo = (data[0] || '').toString().trim();
                const nombre = (data[1] || '').toString().trim();
                
                if (!codigo || !nombre) {
                    throw new Error('Código y nombre de color son requeridos');
                }
                
                colores = [{
                    id_color: codigo,
                    nombre_color: nombre,
                    productora: productora
                }];
            }
        } else if (typeof data === 'object' && data !== null) {
            const codigo = (data.codigo || data.CODIGO || data.id_color || '').toString().trim();
            const nombre = (data.nombre || data.NOMBRE || data.nombre_color || data.color || '').toString().trim();
            
            if (!codigo || !nombre) {
                throw new Error('Código y nombre de color son requeridos');
            }
            
            colores = [{
                id_color: codigo,
                nombre_color: nombre,
                productora: productora
            }];
        }
        
        if (colores.length === 0) {
            throw new Error('No hay datos válidos para guardar');
        }
        
        Logger.info('data-loader', `Guardando ${colores.length} colores en Supabase`, colores);
        
        // Usar upsert con clave compuesta (id_color, productora) si es posible, 
        // o simplemente id_color si el usuario dice que hay repetidos pero 
        // Supabase maneja la integridad.
        // Dado que el usuario dice que "aquí sí tengo repetidos", la clave 
        // en Supabase debería ser [id_color, productora].
        const result = await supabase.upsert('colores', colores, 'id_color, productora');
        
        Logger.success('data-loader', `${colores.length} colores guardados exitosamente`);
        
        // Recargar colores inmediatamente después de guardar
        await loadColoresData();
        
        return result;
    } else {
        throw new Error('Google Sheets no soportado para guardar colores');
    }
}

/**
 * Guarda nuevo cliente
 */
async function saveNewClienteData(data) {
    if (DATA_SOURCES.CLIENTES === 'supabase') {
        const record = {
            id_cliente: data.ID || data.id_cliente,
            razon_social: data.RAZON_SOCIAL || data.razon_social || '',
            nombre_corto: data.NOMBRE_CORTO || data.nombre_corto || '',
            tipo_cliente: data.TIPO_CLIENTE || data.tipo_cliente || '',
            estado: data.ESTADO || data.estado || '',
            direccion: data.DIRECCION || data.direccion || '',
            telefono: data.TELEFONO || data.telefono || '',
            email: data.EMAIL || data.email || '',
            tipo_empresa: data.TIPO_EMPRESA || data.tipo_empresa || ''
        };
        return await supabase.insert('clientes', record);
    } else {
        throw new Error('Google Sheets no soportado para guardar clientes');
    }
}

/**
 * Actualiza cliente existente
 */
async function updateClienteData(data) {
    if (DATA_SOURCES.CLIENTES === 'supabase') {
        const id = data.ID || data.id_cliente || data[0];
        const record = {
            razon_social: data.RAZON_SOCIAL || data.razon_social || data[1] || '',
            nombre_corto: data.NOMBRE_CORTO || data.nombre_corto || data[2] || '',
            tipo_cliente: data.TIPO_CLIENTE || data.tipo_cliente || data[3] || '',
            estado: data.ESTADO || data.estado || data[4] || '',
            direccion: data.DIRECCION || data.direccion || data[5] || '',
            telefono: data.TELEFONO || data.telefono || data[6] || '',
            email: data.EMAIL || data.email || data[7] || '',
            tipo_empresa: data.TIPO_EMPRESA || data.tipo_empresa || data[8] || ''
        };
        return await supabase.update('clientes', record, { id_cliente: id });
    } else {
        throw new Error('Google Sheets no soportado para actualizar clientes');
    }
}

/**
 * Agrega pedido
 */
async function agregarPedidoASheets(pedido) {
    if (DATA_SOURCES.PEDIDOS === 'supabase') {
        const record = {
            id_pedido:      pedido.id,
            mayorista_id:   pedido.mayoristaId   || '',
            nombre_cliente: pedido.nombreCliente || '',
            op:             pedido.op            || '',
            referencia:     pedido.referencia    || '',
            prenda:         pedido.prenda        || '',
            genero:         pedido.genero        || '',
            cantidad:       parseInt(pedido.cantidad) || 0,
            obs:            pedido.obs           || '',
            fecha:          pedido.fecha         || new Date().toISOString(),
            estado:         pedido.estado !== undefined ? pedido.estado : true
        };
        return await supabase.insert('pedidos', record);
    } else {
        throw new Error('Google Sheets no soportado para agregar pedidos');
    }
}

/**
 * Actualiza pedido
 */
async function actualizarPedidoEnSheets(pedido) {
    if (DATA_SOURCES.PEDIDOS === 'supabase') {
        const record = {
            mayorista_id:   pedido.mayoristaId   || '',
            nombre_cliente: pedido.nombreCliente || '',
            op:             pedido.op            || '',
            referencia:     pedido.referencia    || '',
            prenda:         pedido.prenda        || '',
            genero:         pedido.genero        || '',
            cantidad:       parseInt(pedido.cantidad) || 0,
            obs:            pedido.obs           || '',
            fecha:          pedido.fecha         || '',
            estado:         pedido.estado !== undefined ? pedido.estado : true
        };
        return await supabase.update('pedidos', record, { id_pedido: pedido.id });
    } else {
        throw new Error('Google Sheets no soportado para actualizar pedidos');
    }
}

/**
 * Elimina pedido
 */
async function eliminarPedidoDeSheets(id) {
    if (DATA_SOURCES.PEDIDOS === 'supabase') {
        return await supabase.delete('pedidos', { id_pedido: id });
    } else {
        throw new Error('Google Sheets no soportado para eliminar pedidos');
    }
}

// ============================================
// EXPORTS
// ============================================

// Sobrescribir funciones globales con las adaptadoras
window.loadUsuariosData = loadUsuariosData;
window.loadProveedoresData = loadProveedoresData;
window.loadAuditoresData = loadAuditoresData;
window.loadGestoresData = loadGestoresData;
window.loadPreciosData = loadPreciosData;
window.loadSisproData = loadSisproData;
window.loadHistoricasData = loadHistoricasData;
window.loadData2Data = loadData2Data;
window.loadClientesData = loadClientesData;
window.loadPedidosData = loadPedidosData;
window.loadColoresData = loadColoresData;  // Ahora usa Supabase
window.loadAllConfigData = loadAllConfigData;

// Funciones de guardado
window.saveNewUsuarioData = saveNewUsuarioData;
window.saveNewProveedorData = saveNewProveedorData;
window.saveNewAuditorData = saveNewAuditorData;
window.saveNewGestorData = saveNewGestorData;
window.saveNewColorData = saveNewColorData;
window.saveNewClienteData = saveNewClienteData;
window.updateClienteData = updateClienteData;
window.agregarPedidoASheets = agregarPedidoASheets;
window.actualizarPedidoEnSheets = actualizarPedidoEnSheets;
window.eliminarPedidoDeSheets = eliminarPedidoDeSheets;

Logger.info('data-loader', 'Adaptador híbrido inicializado - Fuentes configuradas:', DATA_SOURCES);


/**
 * Carga códigos de barras desde la fuente configurada
 */
async function loadBarrasData() {
    Logger.info('data-loader', 'Cargando BARRAS desde Supabase...');
    const result = await loadBarrasFromSupabase();
    
    // Actualizar mapa global SIN reemplazarlo (mantener la referencia)
    if (typeof window.barrasMap !== 'undefined') {
        window.barrasMap.clear();
        result.forEach((value, key) => {
            window.barrasMap.set(key, value);
        });
    } else {
        window.barrasMap = result;
    }
    
    return window.barrasMap;
}

// Export
window.loadBarrasData = loadBarrasData;
