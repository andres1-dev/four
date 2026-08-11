// ============================================
// SERVICIO DE SUPABASE - v1.0.1
// ============================================

/**
 * Cliente de Supabase usando fetch API
 * Las credenciales se cargan desde constants.js
 */
class SupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this.accessToken = null;
        this.user = null;
    }

    /**
     * Obtiene los headers para las peticiones
     */
    getHeaders() {
        const headers = {
            'apikey': this.key,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        };

        // Si hay token de acceso, usarlo en lugar de la anon key
        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        } else {
            headers['Authorization'] = `Bearer ${this.key}`;
        }

        return headers;
    }

    /**
     * Inicia sesión con email y password
     */
    async signIn(email, password) {
        try {
            const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'apikey': this.key,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error_description || error.message || 'Error de autenticación');
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            this.user = data.user;

            Logger.success('supabase-service', `Usuario autenticado: ${data.user.email}`);
            return data;
        } catch (error) {
            Logger.error('supabase-service', 'Error en signIn', error);
            throw error;
        }
    }

    /**
     * Verifica si hay una sesión activa
     */
    async getSession() {
        if (this.accessToken) {
            return { access_token: this.accessToken, user: this.user };
        }
        return null;
    }

    /**
     * Cierra sesión
     */
    async signOut() {
        this.accessToken = null;
        this.user = null;
        Logger.info('supabase-service', 'Sesión cerrada');
    }

    /**
     * Realiza una petición a Supabase
     */
    async request(endpoint, options = {}) {
        const url = `${this.url}/rest/v1/${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            
            // Manejar token expirado (401)
            if (response.status === 401) {
                Logger.error('supabase-service', 'Token expirado o inválido');
                
                // Limpiar sesión
                sessionStorage.clear();
                this.accessToken = null;
                this.user = null;
                
                // Redirigir a login
                if (typeof window !== 'undefined') {
                    alert('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
                    window.location.href = 'login.html';
                }
                
                throw new Error('JWT expired');
            }
            
            if (!response.ok) {
                // Intentar parsear error como JSON
                let errorMessage = `HTTP Error: ${response.status}`;
                try {
                    const error = await response.json();
                    errorMessage = error.message || error.error || errorMessage;
                } catch (e) {
                    // Si no es JSON, usar el status text
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            // Si es DELETE o 204 No Content, retornar success
            if (response.status === 204 || options.method === 'DELETE') {
                return { success: true };
            }

            // Intentar parsear como JSON
            const text = await response.text();
            
            // Si no hay contenido, retornar array vacío para GET o success para otros
            if (!text || text.length === 0) {
                return options.method === 'GET' ? [] : { success: true };
            }

            // Parsear JSON
            try {
                return JSON.parse(text);
            } catch (e) {
                // Si falla el parseo, retornar success
                Logger.warn('supabase-service', 'No se pudo parsear respuesta como JSON', text);
                return { success: true };
            }
        } catch (error) {
            Logger.error('supabase-service', `Error en request a ${endpoint}`, error);
            throw error;
        }
    }

    /**
     * Inserta registros en una tabla
     */
    async insert(table, data) {
        return await this.request(table, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Actualiza registros en una tabla
     */
    async update(table, data, filters) {
        const queryString = this.buildQueryString(filters);
        return await this.request(`${table}?${queryString}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    /**
     * Elimina registros de una tabla
     */
    async delete(table, filters) {
        const queryString = this.buildQueryString(filters);
        return await this.request(`${table}?${queryString}`, {
            method: 'DELETE'
        });
    }

    /**
     * Consulta registros de una tabla
     */
    async select(table, options = {}) {
        const { columns = '*', filters = {}, order = null, limit = null, offset = null } = options;
        
        let queryString = `select=${columns}`;
        
        // Agregar filtros
        const filterString = this.buildQueryString(filters);
        if (filterString) {
            queryString += `&${filterString}`;
        }

        // Agregar ordenamiento
        if (order) {
            queryString += `&order=${order}`;
        }

        // Agregar límite
        if (limit) {
            queryString += `&limit=${limit}`;
        }

        // Agregar offset para paginación
        if (offset !== null && offset !== undefined) {
            queryString += `&offset=${offset}`;
        }

        return await this.request(`${table}?${queryString}`, {
            method: 'GET'
        });
    }

    /**
     * Construye query string para filtros
     */
    buildQueryString(filters) {
        return Object.entries(filters)
            .map(([key, value]) => `${key}=eq.${value}`)
            .join('&');
    }

    /**
     * Trae TODOS los registros de una tabla paginando en PARALELO.
     * Primero obtiene el total con HEAD, luego lanza todas las páginas simultáneamente.
     * @param {string} table
     * @param {Object} options - Mismas opciones que select(), sin limit/offset
     * @param {number} pageSize - Registros por página (default 1000)
     */
    async selectAll(table, options = {}, pageSize = 1000) {
        // Página 0 siempre necesaria — también nos dice si hay más
        const firstPage = await this.select(table, { ...options, limit: pageSize, offset: 0 });
        if (!Array.isArray(firstPage) || firstPage.length === 0) return [];
        if (firstPage.length < pageSize) return firstPage; // cabe en una sola página

        // Obtener total con Prefer: count=exact para calcular páginas restantes
        const { columns = '*', filters = {}, order = null } = options;
        let total = null;
        try {
            let qs = `select=${columns}&limit=1`;
            const fs = this.buildQueryString(filters);
            if (fs) qs += `&${fs}`;
            const headRes = await fetch(`${this.url}/rest/v1/${table}?${qs}`, {
                headers: { ...this.getHeaders(), 'Prefer': 'count=exact' }
            });
            const cr = headRes.headers.get('content-range'); // "0-0/10915"
            if (cr) total = parseInt(cr.split('/')[1]);
        } catch (_) {}

        if (!total || total <= pageSize) return firstPage;

        // Lanzar todas las páginas restantes en paralelo
        const pageCount = Math.ceil(total / pageSize);
        const pagePromises = [];
        for (let p = 1; p < pageCount; p++) {
            pagePromises.push(this.select(table, { ...options, limit: pageSize, offset: p * pageSize }));
        }
        const restPages = await Promise.all(pagePromises);
        return [firstPage, ...restPages].flat();
    }

    /**
     * Upsert (insert o update si existe)
     * @param {string} table - Nombre de la tabla
     * @param {Object|Array} data - Datos a insertar/actualizar
     * @param {string} onConflict - Columna(s) para detectar conflictos (ej: 'id_ingreso,productora')
     */
    async upsert(table, data, onConflict = 'id') {
        // Asegurar que data es un array
        const dataArray = Array.isArray(data) ? data : [data];
        
        return await this.request(`${table}?on_conflict=${onConflict}`, {
            method: 'POST',
            headers: {
                'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify(dataArray)
        });
    }
}

// Instancia global del cliente (Proyecto Principal)
const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cliente directo al proyecto MASTER (catálogo de OPs - tabla master)
const supabaseMaster = new SupabaseClient(SUPABASE_MASTER_URL, SUPABASE_MASTER_KEY);

// ============================================
// FUNCIONES ESPECÍFICAS PARA ingresos
// ============================================

/**
 * Guarda datos procesados del CSV en la tabla ingresos
 * @param {Array} data - Array de objetos con los datos procesados
 * @returns {Promise} - Resultado de la operación
 */
async function saveToSisproInversiones(data) {
    try {
        Logger.info('supabase-service', `Guardando ${data.length} registros en ingresos...`);
        const startTime = performance.now();

        // Obtener datos del formulario
        const proveedor = document.getElementById('proveedor')?.value || '';
        // Auditor: del select del editor; si está vacío, usar el auditor del item (para Excel/BUSINT)
        const auditorSelect = document.getElementById('auditor')?.value || '';
        const auditor = auditorSelect || (data[0]?.AUDITOR || '');
        const gestor = document.getElementById('gestor')?.value || '';
        const escaner = document.getElementById('escanerEdit')?.value || '';
        const bolsas = parseInt(document.getElementById('bolsas')?.value) || 0;
        const pvpEdit = document.getElementById('pvpEdit')?.value || '';

        // Leer prenda, género y línea del editor (siempre desde los campos editables)
        const prendaEdit = document.getElementById('opPrendaEdit')?.value?.trim() || '';
        const generoEdit = document.getElementById('opGeneroEdit')?.value?.trim() || '';
        const lineaEdit  = document.getElementById('opLineaEdit')?.value?.trim() || '';

        // Para Excel/BUSINT: leer lote y tipo editables
        const primerItemCheck = data[0] || {};
        const esBusint = primerItemCheck.FUENTE === 'BUSINT';
        const loteEdit = esBusint ? (document.getElementById('opLoteEdit')?.value?.trim() || '') : '';
        const tipoEdit = esBusint ? (document.getElementById('opTipoEdit')?.value?.trim() || 'FULL') : 'FULL';

        // Obtener datos del primer item
        const primerItem = data[0] || {};
        const total = parseInt(primerItem.TOTAL) || 0;  // Total declarado en OP (del CSV)

        // Calcular totales por bodega
        let cantidadFull = 0, cantidadPromo = 0, cantidadCobros = 0, cantidadSinConfeccionar = 0;
        let costoTotal = 0;
        const hr = [];
        const anexos = [];

        data.forEach(item => {
            const costoUnitario = parseFloat(item.COSTO) || 0;
            const costoTOTAL = costoUnitario * (parseInt(item.CANTIDAD) || 0);

            if (item.BODEGA === 'PRIMERAS') {
                cantidadFull += parseInt(item.CANTIDAD) || 0;
                costoTotal += costoTOTAL;
                const hrEntry = {
                    codigo_color: item.COD_COLOR,
                    color: item.COLORES,
                    talla: item.TALLA,
                    cantidad: parseInt(item.CANTIDAD) || 0
                };
                // Agregar referencia y descripcion si es REFVAR (usar campos HR específicos)
                if (item.REFERENCIA === 'REFVAR' || item.REFERENCIA_HISTORICA === 'REFVAR') {
                    hrEntry.referencia = item.HR_REFERENCIA || item.REFERENCIA_HISTORICA || item.REFERENCIA || '';
                    hrEntry.descripcion = item.HR_DESCRIPCION || item.DESCRIPCION_LARGA || item.DESCRIPCION || '';
                }
                hr.push(hrEntry);
            }
            else if (item.BODEGA === 'PROMOCIONES') {
                cantidadPromo += parseInt(item.CANTIDAD) || 0;
                costoTotal += costoTOTAL;
                anexos.push({
                    DOCUMENTO: item.REFERENCIA,
                    TALLA: item.TALLA,
                    COLOR: item.COLORES,
                    TIPO: 'PROMO',
                    CANTIDAD: parseInt(item.CANTIDAD) || 0,
                    COSTO_UNITARIO: costoUnitario,
                    COSTO_TOTAL: costoTOTAL,
                    BODEGA: item.BODEGA,
                    TRASLADO: item.TRASLADO
                });
            }
            else if (item.BODEGA === 'COBROS') {
                cantidadCobros += parseInt(item.CANTIDAD) || 0;
                costoTotal += costoTOTAL;
                anexos.push({
                    DOCUMENTO: item.REFERENCIA,
                    TALLA: item.TALLA,
                    COLOR: item.COLORES,
                    TIPO: 'COBRO',
                    CANTIDAD: parseInt(item.CANTIDAD) || 0,
                    COSTO_UNITARIO: costoUnitario,
                    COSTO_TOTAL: costoTOTAL,
                    BODEGA: item.BODEGA,
                    TRASLADO: item.TRASLADO
                });
            }
            else if (item.BODEGA === 'SIN CONFECCIONAR') {
                cantidadSinConfeccionar += parseInt(item.CANTIDAD) || 0;
                anexos.push({
                    DOCUMENTO: item.REFERENCIA,
                    TALLA: item.TALLA,
                    COLOR: item.COLORES,
                    TIPO: 'SIN_CONFECCIONAR',
                    CANTIDAD: parseInt(item.CANTIDAD) || 0,
                    COSTO_UNITARIO: 0,
                    COSTO_TOTAL: 0,
                    BODEGA: item.BODEGA,
                    TRASLADO: item.TRASLADO
                });
            }
        });

        const cantidad = cantidadFull + cantidadPromo;  // PRIMERAS + PROMO (lo que se distribuye)
        const totalRelativo = cantidadFull + cantidadPromo + cantidadCobros;
        const totalGeneral = cantidadFull + cantidadPromo + cantidadCobros + cantidadSinConfeccionar;
        const diferencia = total - totalGeneral;  // Diferencia entre declarado y contado
        const costoUnitario = parseFloat(primerItem.COSTO) || 0;

        // Obtener referencia histórica
        // Para BUSINT/Excel: la referencia ya viene resuelta en el item (REFERENCIA_HISTORICA)
        // Para CSV: buscar en historicasMap
        const referenciaHistorica = (primerItem.FUENTE === 'BUSINT' && primerItem.REFERENCIA_HISTORICA)
            ? primerItem.REFERENCIA_HISTORICA
            : (typeof getReferenciaHistorica === 'function')
                ? getReferenciaHistorica(primerItem.REFERENCIA)
                : primerItem.REFERENCIA;

        // Calcular otros_traslados (traslados adicionales de la misma OP)
        const otrosTraslados = [];
        if (typeof lastCsvRows !== 'undefined' && lastCsvRows) {
            const opStr = (primerItem.OP || '').toString().trim();
            const trasladoActual = (parseInt(primerItem.TRASLADO) || 0).toString();
            const set = new Set();
            
            for (let i = 0; i < lastCsvRows.length; i++) {
                const row = lastCsvRows[i];
                if (row.length < 8) continue;
                if ((row[2] || '').toString().trim() !== opStr) continue;
                
                const t = (typeof extractTrasladoNumber === 'function') 
                    ? extractTrasladoNumber(row[7] || '')
                    : (row[7] || '').toString().trim();
                    
                if (t && t !== trasladoActual) {
                    set.add(t.toString().trim());
                }
            }
            otrosTraslados.push(...Array.from(set));
        }

        // Calcular CLASE basada en el PVP editado
        const pvpValue = parseFloat(pvpEdit) || 0;
        let clase = '';
        if (pvpValue > 0) {
            if (pvpValue <= 39900) {
                clase = 'LINEA';
            } else if (pvpValue <= 59900) {
                clase = 'MODA';
            } else {
                clase = 'PRONTAMODA';
            }
        }

        // Obtener proveedor activo (productora)
        const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
        const productora = proveedorActivo ? proveedorActivo.id : '';

        // Convierte DD/MM/YYYY → YYYY-MM-DD para campos date de Supabase
        const toISODate = (ddmmyyyy) => {
            if (!ddmmyyyy) return null;
            const parts = ddmmyyyy.toString().trim().split('/');
            if (parts.length !== 3) return ddmmyyyy;
            return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        };

        // Mapear a las columnas de la tabla ingresos
        const record = {
            id_ingreso: primerItem.ID_INGRESO || primerItem.OP_SUFIJO || primerItem.OP,
            fecha_traslado: toISODate(primerItem.FECHA),
            taller: primerItem.TALLER,
            linea: lineaEdit || primerItem.LINEA,
            auditor: auditor,
            gestor: gestor,
            escaner: escaner,
            lote: parseInt(loteEdit || primerItem.OP) || 0,
            refprov: primerItem.REFERENCIA,
            descripcion: getDescripcion(prendaEdit || primerItem.PRENDA, generoEdit || primerItem.GENERO, getMarca(generoEdit || primerItem.GENERO, productora), primerItem.REFERENCIA),
            descripcion_larga: primerItem.DESCRIPCION_LARGA,
            total: total,
            cantidad: cantidad,
            total_relativo: totalRelativo,
            total_general: totalGeneral,
            diferencia: diferencia,
            costo_unitario: costoUnitario,
            costo_total: costoTotal,
            auditoria: parseInt(primerItem.CC) || 0,
            orden_servicio: parseInt(primerItem.OS) || 0,
            traslado: parseInt(primerItem.TRASLADO) || 0,
            referencia: referenciaHistorica,
            tipo: tipoEdit,
            pvp: pvpValue,
            clase: clase,
            prenda: prendaEdit || primerItem.PRENDA,
            genero: generoEdit || primerItem.GENERO,
            marca: getMarca(generoEdit || primerItem.GENERO, productora),
            proveedor: proveedor,
            productora: productora,          // NIT del proveedor activo
            fuente: primerItem.FUENTE === 'BUSINT' ? 'BUSINT' : 'SISPRO',
            bolsas: bolsas,
            otros_traslados: otrosTraslados,
            anexos: anexos,
            hr: hr,
            detalle_cantidades: {
                TOTAL: totalGeneral,
                FULL: cantidadFull,
                PROMO: cantidadPromo,
                COBRO: cantidadCobros,
                SIN_CONFECCIONAR: cantidadSinConfeccionar
            }
        };

        // Verificar si ya existe un registro con la misma combinación (id_ingreso, productora)
        const existing = await supabase.select('ingresos', {
            columns: 'id_ingreso, fecha_ingreso, created_at',
            filters: { id_ingreso: record.id_ingreso, productora: record.productora }
        });

        const nowISO = new Date().toISOString();

        let result;
        if (Array.isArray(existing) && existing.length > 0) {
            // Actualizar registro existente
            record.fecha_ingreso = existing[0].fecha_ingreso || existing[0].created_at || nowISO;
            record.created_at = existing[0].created_at || record.fecha_ingreso;
            record.updated_at = nowISO;
            Logger.info('supabase-service', `Actualizando ingreso existente: ${record.id_ingreso} / ${record.productora}`);
            result = await supabase.update('ingresos', record, {
                id_ingreso: record.id_ingreso,
                productora: record.productora
            });
        } else {
            // Insertar nuevo registro
            record.fecha_ingreso = nowISO;
            record.created_at = nowISO;
            record.updated_at = nowISO;
            Logger.info('supabase-service', `Insertando nuevo ingreso: ${record.id_ingreso} / ${record.productora}`);
            result = await supabase.insert('ingresos', record);
        }

        // Espejo a Google Sheets (fire & forget – no bloquea el flujo)
        if (typeof saveIngresoToSheets === 'function') {
            saveIngresoToSheets(record).catch(err =>
                Logger.warn('supabase-service', 'Error espejo Sheets (ingresos)', err)
            );
        }

        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `Registro guardado en ingresos en ${loadTime.toFixed(0)}ms`);

        return {
            success: true,
            count: 1,
            time: loadTime,
            result: result
        };

    } catch (error) {
        Logger.error('supabase-service', 'Error guardando en ingresos', error);
        throw error;
    }
}

/**
 * Consulta registros de ingresos
 * @param {Object} filters - Filtros para la consulta
 * @returns {Promise<Array>} - Registros encontrados
 */
async function getSisproInversiones(filters = {}) {
    try {
        Logger.info('supabase-service', 'Consultando ingresos...');
        const result = await supabase.select('ingresos', {
            filters: filters,
            order: 'created_at.desc'
        });
        
        Logger.success('supabase-service', `${result.length} registros encontrados`);
        return result;
    } catch (error) {
        Logger.error('supabase-service', 'Error consultando ingresos', error);
        throw error;
    }
}

/**
 * Elimina registros de ingresos
 * @param {Object} filters - Filtros para identificar registros a eliminar
 * @returns {Promise} - Resultado de la operación
 */
async function deleteSisproInversiones(filters) {
    try {
        Logger.info('supabase-service', 'Eliminando registros de ingresos...');
        const result = await supabase.delete('ingresos', filters);
        Logger.success('supabase-service', 'Registros eliminados exitosamente');
        return result;
    } catch (error) {
        Logger.error('supabase-service', 'Error eliminando de ingresos', error);
        throw error;
    }
}

/**
 * Verifica la conexión con Supabase
 * @returns {Promise<boolean>} - true si la conexión es exitosa
 */
async function testSupabaseConnection() {
    try {
        Logger.info('supabase-service', 'Verificando conexión con Supabase...');
        
        // Intentar una consulta simple
        await supabase.select('ingresos', { limit: 1 });
        
        Logger.success('supabase-service', 'Conexión con Supabase exitosa');
        return true;
    } catch (error) {
        Logger.error('supabase-service', 'Error de conexión con Supabase', error);
        return false;
    }
}

// ============================================
// FUNCIONES DE CARGA DE TABLAS MAESTRAS
// ============================================

/**
 * Carga usuarios desde Supabase
 */
async function loadUsuariosFromSupabase() {
    try {
        Logger.info('supabase-service', 'Cargando usuarios desde Supabase...');
        const startTime = performance.now();
        
        const result = await supabase.select('usuarios', {
            order: 'nombre_usuario.asc'
        });
        
        const usuariosMap = new Map();
        
        // Validar que result sea un array
        if (Array.isArray(result)) {
            result.forEach(row => {
                usuariosMap.set(row.id_usuario, {
                    NOMBRE: row.nombre_usuario,
                    ESTADO: row.estado ? 'TRUE' : 'FALSE'
                });
            });
        }
        
        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `${usuariosMap.size} USUARIOS cargados en ${loadTime.toFixed(0)}ms`);
        
        return usuariosMap;
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando usuarios', error);
        throw error;
    }
}

/**
 * Carga proveedores desde Supabase
 */
async function loadProveedoresFromSupabase() {
    try {
        Logger.info('supabase-service', 'Cargando proveedores desde Supabase...');
        const startTime = performance.now();
        
        const result = await supabase.select('proveedores', {
            order: 'nombre_proveedor.asc'
        });
        
        const proveedoresMap = new Map();
        
        // Validar que result sea un array
        if (Array.isArray(result)) {
            result.forEach(row => {
                proveedoresMap.set(row.id_proveedor, {
                    NOMBRE: row.nombre_proveedor,
                    ESTADO: row.estado ? 'TRUE' : 'FALSE'
                });
            });
        }
        
        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `${proveedoresMap.size} PROVEEDORES cargados en ${loadTime.toFixed(0)}ms`);
        
        return proveedoresMap;
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando proveedores', error);
        throw error;
    }
}

/**
 * Carga auditores desde Supabase
 */
async function loadAuditoresFromSupabase() {
    try {
        Logger.info('supabase-service', 'Cargando auditores desde Supabase...');
        const startTime = performance.now();
        
        const result = await supabase.select('auditores', {
            order: 'nombre_auditor.asc'
        });
        
        const auditoresMap = new Map();
        
        // Validar que result sea un array
        if (Array.isArray(result)) {
            result.forEach(row => {
                auditoresMap.set(row.id_auditor, {
                    NOMBRE: row.nombre_auditor,
                    ESTADO: row.estado ? 'TRUE' : 'FALSE'
                });
            });
        }
        
        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `${auditoresMap.size} AUDITORES cargados en ${loadTime.toFixed(0)}ms`);
        
        return auditoresMap;
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando auditores', error);
        throw error;
    }
}

/**
 * Carga gestores desde Supabase
 */
async function loadGestoresFromSupabase() {
    try {
        Logger.info('supabase-service', 'Cargando gestores desde Supabase...');
        const startTime = performance.now();
        
        const result = await supabase.select('gestores', {
            order: 'nombre_gestor.asc'
        });
        
        const gestoresMap = new Map();
        
        // Validar que result sea un array
        if (Array.isArray(result)) {
            result.forEach(row => {
                gestoresMap.set(row.id_gestor, {
                    NOMBRE: row.nombre_gestor,
                    ESTADO: row.estado ? 'TRUE' : 'FALSE'
                });
            });
        }
        
        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `${gestoresMap.size} GESTORES cargados en ${loadTime.toFixed(0)}ms`);
        
        return gestoresMap;
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando gestores', error);
        throw error;
    }
}

/**
 * Carga todos los registros de una tabla con paginación automática
 * @param {string} table - Nombre de la tabla
 * @param {Object} options - Opciones de consulta (order, etc)
 * @returns {Promise<Array>} - Todos los registros
 */
async function loadAllRecords(table, options = {}) {
    const PAGE_SIZE = 1000;
    let allRecords = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const offset = page * PAGE_SIZE;
        const result = await supabase.select(table, {
            ...options,
            limit: PAGE_SIZE,
            offset: offset
        });

        if (Array.isArray(result) && result.length > 0) {
            allRecords = allRecords.concat(result);
            hasMore = result.length === PAGE_SIZE;
            page++;
        } else {
            hasMore = false;
        }
    }

    return allRecords;
}

/**
 * Carga precios desde Supabase con paginación
 */
async function loadPreciosFromSupabase() {
    try {
        Logger.info('supabase-service', 'Cargando precios desde Supabase...');
        const startTime = performance.now();
        
        const result = await loadAllRecords('precios');
        
        const preciosMap = new Map();
        
        // Validar que result sea un array
        if (Array.isArray(result)) {
            result.forEach(row => {
                preciosMap.set(row.referencia, row.pvp.toString());
            });
        }
        
        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `${preciosMap.size} PRECIOS cargados en ${loadTime.toFixed(0)}ms`);
        
        return preciosMap;
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando precios', error);
        throw error;
    }
}

/**
 * Carga catálogo de productos desde la tabla `master` LOCAL de Supabase
 * (Sincronizada por la Edge Function sync-master)
 * Mapeo: id_master → OP, descripcion → PRENDA, cuento → LINEA, genero → GENERO, referencia → REFERENCIA
 * 
 * @param {string[]} [ops] - OPs a buscar. Si está vacío o no se especifica, carga toda la tabla master local.
 */
async function loadSisprowebFromSupabase(ops = []) {
    try {
        const startTime = performance.now();
        let result;

        if (ops && ops.length > 0) {
            const opsClean = [...new Set(ops.map(o => String(o).trim()).filter(Boolean))];
            Logger.info('supabase-service', `SISPROWEB (Master Local): consultando ${opsClean.length} OPs...`);
            
            const inFilter = `id_master=in.(${opsClean.join(',')})`;
            const url = `${SUPABASE_URL}/rest/v1/master?select=id_master,referencia,descripcion,cuento,genero&${inFilter}`;
            const headers = supabase.getHeaders();
            const res = await fetch(url, { headers });
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || errData.error || `HTTP ${res.status}`);
            }
            result = await res.json();
        } else {
            Logger.info('supabase-service', 'SISPROWEB (Master Local): cargando catálogo completo...');
            result = await supabase.selectAll('master', {
                columns: 'id_master,referencia,descripcion,cuento,genero'
            });
        }

        const sisproMap = new Map();

        (result || []).forEach(row => {
            const opKey = (row.id_master || '').toString().trim();
            if (opKey) {
                sisproMap.set(opKey, {
                    PRENDA:     row.descripcion || '',
                    LINEA:      row.cuento      || '',
                    GENERO:     row.genero      || '',
                    REFERENCIA: row.referencia  || ''
                });
            }
        });

        const ms = (performance.now() - startTime).toFixed(0);
        Logger.success('supabase-service', `SISPROWEB (Master Local): ${sisproMap.size} OPs cargadas en ${ms}ms`);
        return sisproMap;

    } catch (error) {
        Logger.error('supabase-service', 'Error cargando sisproweb desde tabla master local', error);
        throw error;
    }
}

/**
 * Llama a la Edge Function `sync-master` para sincronizar el catálogo master
 * desde el proyecto externo hacia la tabla `master` local de Supabase.
 * @returns {Promise<{success: boolean, count?: number, message?: string}>}
 */
async function syncMasterEdgeFunction() {
    try {
        Logger.info('supabase-service', 'Disparando Edge Function sync-master...');
        const startTime = performance.now();
        const url = `${SUPABASE_URL}/functions/v1/sync-master`;
        const headers = (typeof supabase.getHeaders === 'function') ? supabase.getHeaders() : {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        };

        const res = await fetch(url, { method: 'POST', headers });
        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || errJson.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const elapsed = (performance.now() - startTime).toFixed(0);
        Logger.success('supabase-service', `sync-master completado en ${elapsed}ms: ${data.count || 0} registros procesados.`);
        return { success: true, ...data };
    } catch (err) {
        Logger.warn('supabase-service', 'Error ejecutando sync-master Edge Function', err);
        return { success: false, error: err.message };
    }
}

/**
 * Carga referencias históricas desde Supabase
 */
async function loadHistoricasFromSupabase() {
    try {
        Logger.info('supabase-service', 'Cargando HISTORICAS desde Supabase...');
        const startTime = performance.now();

        // Filtrar por productora activa
        const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
        const filters = proveedorActivo ? { productora: proveedorActivo.id } : {};

        const result = await supabase.selectAll('historicas', { filters });

        const historicasMap = new Map();

        if (Array.isArray(result)) {
            result.forEach(row => {
                if (row.refprov && row.referencia) {
                    historicasMap.set(row.refprov.trim(), row.referencia.trim());
                }
            });
        }

        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service',
            `${historicasMap.size} HISTORICAS cargadas` +
            (proveedorActivo ? ` (productora: ${proveedorActivo.id})` : ' (sin filtro)') +
            ` en ${loadTime.toFixed(0)}ms`
        );

        return historicasMap;
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando historicas', error);
        throw error;
    }
}

/**
 * Carga OPs confirmadas desde Supabase
 */
/**
 * Carga OPs confirmadas desde la tabla `ingresos` de Supabase,
 * filtrando por el proveedor activo (productora).
 * Reconstruye data2Map, data2CountMap y data2JsonMap con el mismo
 * formato que usaba la hoja DATA2, para que validarEstado() y
 * validarEstadoParcial() funcionen sin cambios.
 */
async function loadData2FromSupabase(lotes = []) {
    try {
        Logger.info('supabase-service', 'Cargando ingresos confirmados desde Supabase...');
        const startTime = performance.now();

        let result;

        if (lotes.length > 0) {
            // Bajo demanda: solo los lotes del CSV o Excel — 1 sola request con filtro IN
            // NOTA: Se consulta la tabla 'ingresos' sin restringir por el proveedor seleccionado en la UI,
            // para garantizar que la validación de OPs (confirmados / pendientes) funcione correctamente 
            // con cualquier productora o línea.
            const lotesClean = [...new Set(lotes.map(l => String(l).trim()).filter(Boolean))];
            let qs = `select=id_ingreso,lote,fecha_traslado,total,total_relativo,cantidad,diferencia,traslado,otros_traslados,anexos,total_general,detalle_cantidades,productora` +
                     `&lote=in.(${lotesClean.join(',')})&order=created_at.asc`;
            const url = `${SUPABASE_URL}/rest/v1/ingresos?${qs}`;
            const headers = supabase.getHeaders();
            const res = await fetch(url, { headers });
            if (!res.ok) {
                Logger.error('supabase-service', `loadData2: HTTP ${res.status} — ${url.substring(0, 120)}`);
                return { data2Map: new Map(), data2CountMap: new Map(), data2JsonMap: new Map() };
            }
            result = await res.json();
            Logger.info('supabase-service', `Ingresos bajo demanda: ${lotesClean.length} lotes, ${result.length} registros`);
        } else {
            // Sin lotes → mapa vacío, no hacer request
            Logger.info('supabase-service', 'loadData2: sin lotes, retornando mapas vacíos');
            return { data2Map: new Map(), data2CountMap: new Map(), data2JsonMap: new Map() };
        }

        const data2Map     = new Map();
        const data2CountMap = new Map();
        const data2JsonMap  = new Map();

        // Convierte fecha ISO (YYYY-MM-DD) de Supabase a DD/MM/YYYY que usan normalizeFecha() y parseFechaToTimestamp()
        const isoToDD_MM_YYYY = (isoStr) => {
            if (!isoStr) return '';
            const s = isoStr.toString().trim().split('T')[0]; // quitar hora si existe
            const parts = s.split('-');
            if (parts.length !== 3) return isoStr; // si ya es DD/MM/YYYY u otro formato, lo devuelve tal cual
            return `${parts[2].padStart(2,'0')}/${parts[1].padStart(2,'0')}/${parts[0]}`;
        };

        // Normaliza un valor total/cantidad a entero-string para comparar con row[19] del CSV
        // El CSV puede traer "7.00" y Supabase guarda 7 → ambos deben quedar "7"
        const normTotal = (val) => {
            const n = Math.round(parseFloat(val));
            return isNaN(n) ? (val || '').toString().trim() : n.toString();
        };

        if (Array.isArray(result)) {
            result.forEach(row => {
                const lote   = (row.lote || '').toString().trim();
                const fecha  = isoToDD_MM_YYYY(row.fecha_traslado || ''); // DD/MM/YYYY
                const fechaNorm = normalizeFecha(fecha);

                // Insertar TODAS las variantes de total/cantidad para que validarEstado()
                // encuentre la clave sin importar qué campo fue guardado como total declarado.
                // GUIA usa: op|fecha|row[9] donde row[9]=jsonData.CANTIDAD=primerItem.TOTAL (del CSV)
                // En Supabase ese valor puede estar en total, total_relativo o cantidad según cuándo se guardó.
                const variantes = new Set([
                    row.total,
                    row.total_relativo,
                    row.cantidad
                ]);
                variantes.forEach(val => {
                    if (val !== null && val !== undefined) {
                        const totalNorm = normTotal(val);
                        data2Map.set(`${lote}|${fechaNorm}|${totalNorm}`, true);
                    }
                });

                // ── data2CountMap ──
                data2CountMap.set(lote, (data2CountMap.get(lote) || 0) + 1);

                // ── data2JsonMap: objetos con los campos que lee validarEstadoParcial() ──
                // FECHA debe estar en DD/MM/YYYY para que parseFechaToTimestamp() funcione correctamente
                if (lote) {
                    if (!data2JsonMap.has(lote)) data2JsonMap.set(lote, []);
                    data2JsonMap.get(lote).push({
                        FECHA:         fecha,                                                          // DD/MM/YYYY
                        TRASLADO:      (row.traslado || '').toString(),
                        OTROS_TRASLADOS: Array.isArray(row.otros_traslados) ? row.otros_traslados : [],
                        ANEXOS:        Array.isArray(row.anexos) ? row.anexos : [],
                        DIFERENCIA:    row.diferencia ?? 0,
                        CANTIDAD:      row.cantidad   ?? 0,   // PRIMERAS+PROMO (máximo distribuible)
                        TOTAL_GENERAL: row.total_general ?? 0  // lo que realmente ingresó
                    });
                }
            });
        }

        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service',
            `Ingresos cargados: ${result.length} registros, ${data2JsonMap.size} lotes` +
            (proveedorActivo ? ` (productora: ${proveedorActivo.id})` : ' (sin filtro)') +
            ` en ${loadTime.toFixed(0)}ms`
        );

        return { data2Map, data2CountMap, data2JsonMap };
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando ingresos confirmados', error);
        throw error;
    }
}

/**
 * Carga clientes desde Supabase
 */
async function loadClientesFromSupabase() {
    try {
        Logger.info('supabase-service', 'Cargando CLIENTES desde Supabase...');
        const startTime = performance.now();
        
        const result = await supabase.select('clientes', {
            order: 'nombre_corto.asc'
        });
        
        const clientesMap = new Map();
        
        // Validar que result sea un array
        if (Array.isArray(result)) {
            result.forEach(row => {
                clientesMap.set(row.id_cliente, {
                    ID: row.id_cliente,
                    RAZON_SOCIAL: row.razon_social || '',
                    NOMBRE_CORTO: row.nombre_corto || '',
                    TIPO_CLIENTE: row.tipo_cliente || '',
                    ESTADO: row.estado ? 'ACTIVO' : 'INACTIVO',  // Convertir boolean a string
                    DIRECCION: row.direccion || '',
                    TELEFONO: row.telefono || '',
                    EMAIL: row.email || '',
                    TIPO_EMPRESA: row.tipo_empresa || ''
                });
            });
        }
        
        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `${clientesMap.size} CLIENTES cargados en ${loadTime.toFixed(0)}ms`);
        
        return clientesMap;
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando clientes', error);
        throw error;
    }
}

/**
 * Carga pedidos desde Supabase
 */
async function loadPedidosFromSupabase() {
    try {
        Logger.info('supabase-service', 'Cargando PEDIDOS desde Supabase...');
        const startTime = performance.now();
        
        const result = await supabase.selectAll('pedidos', {
            order: 'fecha.desc'
        });
        
        let pedidos = [];
        
        if (Array.isArray(result)) {
            pedidos = result.map(row => ({
                id:            row.id_pedido,
                mayoristaId:   row.mayorista_id   || '',
                nombreCliente: row.nombre_cliente || '',
                op:            row.op             || '',
                referencia:    row.referencia     || '',
                prenda:        row.prenda         || '',
                genero:        row.genero         || '',
                cantidad:      row.cantidad       || 0,
                obs:           row.obs            || '',
                fecha:         row.fecha          || '',
                estado:        row.estado !== undefined ? row.estado : true
            }));
        }
        
        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `${pedidos.length} PEDIDOS cargados en ${loadTime.toFixed(0)}ms`);
        
        return pedidos;
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando pedidos', error);
        throw error;
    }
}

/**
 * Carga todos los datos de configuración desde Supabase
 */
async function loadAllConfigFromSupabase() {
    Logger.info('supabase-service', 'Cargando toda la configuración desde Supabase...');
    const startTime = performance.now();

    try {
        const [usuarios, proveedores, auditores, gestores] = await Promise.all([
            loadUsuariosFromSupabase(),
            loadProveedoresFromSupabase(),
            loadAuditoresFromSupabase(),
            loadGestoresFromSupabase()
        ]);

        // Actualizar mapas globales
        if (typeof setEscanersMap === 'function') setEscanersMap(usuarios);
        if (typeof setProveedoresMap === 'function') setProveedoresMap(proveedores);
        if (typeof setAuditoresMap === 'function') setAuditoresMap(auditores);
        if (typeof setGestoresMap === 'function') setGestoresMap(gestores);

        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `Configuración completa cargada en ${loadTime.toFixed(0)}ms`);

        return { usuarios, proveedores, auditores, gestores };
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando configuración', error);
        throw error;
    }
}

/**
 * Carga colores desde Supabase
 */
async function loadColoresFromSupabase() {
    try {
        Logger.info('supabase-service', 'Cargando COLORES desde Supabase...');
        const startTime = performance.now();
        
        // Filtrar por productora activa si está disponible
        const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
        const filters = proveedorActivo ? { productora: proveedorActivo.id } : {};

        const result = await supabase.select('colores', {
            filters,
            order: 'id_color.asc'
        });
        
        const coloresMap = new Map();
        
        // Validar que result sea un array
        if (Array.isArray(result)) {
            result.forEach(row => {
                coloresMap.set(row.id_color, row.nombre_color);
            });
        }
        
        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `${coloresMap.size} COLORES cargados` + 
            (proveedorActivo ? ` (productora: ${proveedorActivo.id})` : ' (sin filtro)') +
            ` en ${loadTime.toFixed(0)}ms`);
        
        return coloresMap;
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando colores', error);
        throw error;
    }
}

// ============================================
// EXPORTS
// ============================================

window.supabase = supabase;
window.saveToSisproInversiones = saveToSisproInversiones;
window.getSisproInversiones = getSisproInversiones;
window.deleteSisproInversiones = deleteSisproInversiones;
window.testSupabaseConnection = testSupabaseConnection;

// Funciones de carga desde Supabase
window.loadUsuariosFromSupabase = loadUsuariosFromSupabase;
window.loadProveedoresFromSupabase = loadProveedoresFromSupabase;
window.loadAuditoresFromSupabase = loadAuditoresFromSupabase;
window.loadGestoresFromSupabase = loadGestoresFromSupabase;
window.loadPreciosFromSupabase = loadPreciosFromSupabase;
window.loadSisprowebFromSupabase = loadSisprowebFromSupabase;
window.syncMasterEdgeFunction = syncMasterEdgeFunction;
window.loadHistoricasFromSupabase = loadHistoricasFromSupabase;
window.loadData2FromSupabase = loadData2FromSupabase;
window.loadClientesFromSupabase = loadClientesFromSupabase;
window.loadPedidosFromSupabase = loadPedidosFromSupabase;
window.loadColoresFromSupabase = loadColoresFromSupabase;
window.loadAllConfigFromSupabase = loadAllConfigFromSupabase;

/**
 * Carga datos de distribución desde Supabase (reemplaza getSheetDataAsJSON_1 y getSheetDataAsJSON_2)
 * Obtiene registros de ingresos con tipo='FULL'
 */
async function loadDistributionDataFromSupabase() {
    try {
        Logger.info('supabase-service', 'Cargando datos de distribución desde Supabase...');
        const startTime = performance.now();

        // Consulta 1: registros FULL (los principales)
        const resultFull = await supabase.selectAll('ingresos', {
            filters: { tipo: 'FULL' },
            order: 'created_at.desc'
        });

        // Consulta 2: registros PENDIENTES — sus HR se suman al FULL del mismo lote
        const resultPendiente = await supabase.selectAll('ingresos', {
            filters: { tipo: 'PENDIENTES' },
            order: 'created_at.asc'
        });

        // Acumular HR de pendientes por lote
        const lotesHrPendientes = {};  // lote → array de filas HR
        const lotesAnexosPendientes = {};  // lote → array de anexos

        if (Array.isArray(resultPendiente)) {
            resultPendiente.forEach(row => {
                const lote = row.lote ? row.lote.toString() : '';
                if (!lote) return;

                // Agregar como anexo PENDIENTE
                if (!lotesAnexosPendientes[lote]) lotesAnexosPendientes[lote] = [];
                lotesAnexosPendientes[lote].push({
                    DOCUMENTO: row.id_ingreso || '',
                    TIPO: 'PENDIENTE',
                    CANTIDAD: row.cantidad ? row.cantidad.toString() : '0'
                });

                // Acumular HR del PENDIENTE
                if (Array.isArray(row.hr) && row.hr.length > 0) {
                    if (!lotesHrPendientes[lote]) lotesHrPendientes[lote] = [];
                    row.hr.forEach(item => {
                        lotesHrPendientes[lote].push([
                            item.codigo_color || '',
                            item.color        || '',
                            item.talla        || '',
                            item.cantidad ? item.cantidad.toString() : '0'
                        ]);
                    });
                }
            });
        }

        const distributionData = [];

        if (Array.isArray(resultFull)) {
            resultFull.forEach(row => {
                const lote = row.lote ? row.lote.toString() : '';

                // Construir HR del FULL
                let hrArray = [];
                if (Array.isArray(row.hr)) {
                    hrArray = row.hr.map(item => [
                        item.codigo_color || '',
                        item.color        || '',
                        item.talla        || '',
                        item.cantidad ? item.cantidad.toString() : '0'
                    ]);
                }

                // ── Combinar HR del FULL con HR de PENDIENTES del mismo lote ──
                // (igual que GUIA: suma cantidades por codigo_color)
                if (lote && lotesHrPendientes[lote] && lotesHrPendientes[lote].length > 0) {
                    const combinedHrMap = {};
                    hrArray.forEach(itemHr => {
                        if (itemHr[0]) combinedHrMap[itemHr[0]] = [...itemHr];
                    });
                    lotesHrPendientes[lote].forEach(itemHr => {
                        if (itemHr[0]) {
                            if (combinedHrMap[itemHr[0]]) {
                                const existente = parseInt(combinedHrMap[itemHr[0]][3]) || 0;
                                const nueva     = parseInt(itemHr[3]) || 0;
                                combinedHrMap[itemHr[0]][3] = (existente + nueva).toString();
                            } else {
                                combinedHrMap[itemHr[0]] = [...itemHr];
                            }
                        }
                    });
                    hrArray = Object.values(combinedHrMap);
                }

                // Combinar anexos propios del registro + PENDIENTES del mismo lote
                let anexos = Array.isArray(row.anexos) ? [...row.anexos] : [];
                if (lote && lotesAnexosPendientes[lote]) {
                    anexos = anexos.concat(lotesAnexosPendientes[lote]);
                }

                distributionData.push({
                    "A":          row.id_ingreso      || '',
                    "FECHA":      row.fecha_traslado  || '',
                    "TALLER":     row.taller          || '',
                    "LINEA":      row.linea            || '',
                    "AUDITOR":    row.auditor          || '',
                    "ESCANER":    row.escaner          || '',
                    "LOTE":       lote,
                    "REFERENCIA": row.referencia       || '',
                    "DESCRIPCIÓN":row.descripcion      || '',
                    "CANTIDAD":   row.cantidad ? row.cantidad.toString() : '0',
                    "TEMPLO":     '',
                    "TIPO":       row.tipo             || 'FULL',
                    "PVP":        row.pvp ? row.pvp.toString() : '0',
                    "PRENDA":     row.prenda           || '',
                    "GENERO":     row.genero           || '',
                    "HR":         hrArray,
                    "PROVEEDOR":  row.proveedor        || '',
                    "ANEXO":      anexos
                });
            });
        }

        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service',
            `${distributionData.length} registros FULL cargados` +
            `, ${resultPendiente?.length || 0} PENDIENTE(s) fusionados` +
            ` en ${loadTime.toFixed(0)}ms`
        );

        return distributionData;
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando datos de distribución', error);
        throw error;
    }
}

// Export
window.loadDistributionDataFromSupabase = loadDistributionDataFromSupabase;

/**
 * Busca un REC específico en ingresos + sus PENDIENTES del mismo lote.
 * Devuelve el objeto en formato distribución listo para displayDistributionResults().
 */
async function buscarRecEnSupabase(recNumber) {
    const recClean = recNumber.replace(/^0+/, '');

    // Buscar el FULL por id_ingreso (probando con y sin ceros iniciales)
    const resultFull = await supabase.select('ingresos', {
        columns: 'id_ingreso,lote,fecha_traslado,taller,linea,auditor,escaner,referencia,descripcion,cantidad,tipo,pvp,prenda,genero,hr,proveedor,anexos',
        filters: { tipo: 'FULL', id_ingreso: recClean }
    });

    // Si no encontró sin ceros, probar con el número original
    let fullRow = Array.isArray(resultFull) && resultFull.length > 0 ? resultFull[0] : null;
    if (!fullRow && recClean !== recNumber) {
        const r2 = await supabase.select('ingresos', {
            columns: 'id_ingreso,lote,fecha_traslado,taller,linea,auditor,escaner,referencia,descripcion,cantidad,tipo,pvp,prenda,genero,hr,proveedor,anexos',
            filters: { tipo: 'FULL', id_ingreso: recNumber }
        });
        fullRow = Array.isArray(r2) && r2.length > 0 ? r2[0] : null;
    }
    if (!fullRow) return null;

    const lote = fullRow.lote ? fullRow.lote.toString() : '';

    // Buscar PENDIENTES del mismo lote
    let pendientesRows = [];
    if (lote) {
        const rp = await supabase.selectAll('ingresos', {
            columns: 'id_ingreso,lote,cantidad,hr',
            filters: { tipo: 'PENDIENTES', lote: parseInt(lote) }
        });
        if (Array.isArray(rp)) pendientesRows = rp;
    }

    // Construir HR del FULL
    let hrArray = [];
    if (Array.isArray(fullRow.hr)) {
        hrArray = fullRow.hr.map(item => [
            item.codigo_color || '',
            item.color        || '',
            item.talla        || '',
            item.cantidad ? item.cantidad.toString() : '0'
        ]);
    }

    // Fusionar HR de PENDIENTES (mismo algoritmo que loadDistributionDataFromSupabase)
    const anexosPendientes = [];
    pendientesRows.forEach(row => {
        anexosPendientes.push({
            DOCUMENTO: row.id_ingreso || '',
            TIPO:      'PENDIENTES',
            CANTIDAD:  row.cantidad ? row.cantidad.toString() : '0'
        });
        if (Array.isArray(row.hr) && row.hr.length > 0) {
            const combinedHrMap = {};
            hrArray.forEach(itemHr => { if (itemHr[0]) combinedHrMap[itemHr[0]] = [...itemHr]; });
            row.hr.forEach(item => {
                const key = item.codigo_color || '';
                if (!key) return;
                const hrRow = [key, item.color||'', item.talla||'', item.cantidad ? item.cantidad.toString() : '0'];
                if (combinedHrMap[key]) {
                    combinedHrMap[key][3] = (parseInt(combinedHrMap[key][3])||0) + (parseInt(hrRow[3])||0) + '';
                } else {
                    combinedHrMap[key] = hrRow;
                }
            });
            hrArray = Object.values(combinedHrMap);
        }
    });

    const anexos = [...(Array.isArray(fullRow.anexos) ? fullRow.anexos : []), ...anexosPendientes];

    return {
        "A":          fullRow.id_ingreso   || '',
        "FECHA":      fullRow.fecha_traslado || '',
        "TALLER":     fullRow.taller        || '',
        "LINEA":      fullRow.linea         || '',
        "AUDITOR":    fullRow.auditor       || '',
        "ESCANER":    fullRow.escaner       || '',
        "LOTE":       lote,
        "REFERENCIA": fullRow.referencia    || '',
        "DESCRIPCIÓN":fullRow.descripcion   || '',
        "CANTIDAD":   fullRow.cantidad ? fullRow.cantidad.toString() : '0',
        "TEMPLO":     '',
        "TIPO":       fullRow.tipo          || 'FULL',
        "PVP":        fullRow.pvp ? fullRow.pvp.toString() : '0',
        "PRENDA":     fullRow.prenda        || '',
        "GENERO":     fullRow.genero        || '',
        "HR":         hrArray,
        "PROVEEDOR":  fullRow.proveedor     || '',
        "ANEXO":      anexos
    };
}

window.buscarRecEnSupabase = buscarRecEnSupabase;

/**
 * Guarda una distribución en Supabase
 * @param {Object} distributionData - Datos de distribución {Documento, Clientes}
 * @returns {Promise} - Resultado de la operación
 */
async function saveDistributionToSupabase(distributionData) {
    try {
        Logger.info('supabase-service', `Guardando distribución ${distributionData.Documento}...`);
        const startTime = performance.now();

        // Obtener proveedor activo (productora)
        const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
        const productora = proveedorActivo ? proveedorActivo.id : '';

        // Verificar si ya existe una distribución para este documento Y productora
        const existing = await supabase.select('distribuciones', {
            columns: 'id_distribucion, created_at',
            filters: { id_distribucion: distributionData.Documento, productora: productora },
            limit: 1
        });

        const nowISO = new Date().toISOString();
        const hasExisting = Array.isArray(existing) && existing.length > 0;
        const record = {
            id_distribucion: distributionData.Documento,
            fecha_distribucion: nowISO,
            datos_distribucion: distributionData,  // Guarda todo el objeto {Documento, Clientes}
            productora: productora,                // NIT del proveedor activo
            estado: 'PENDIENTE',                   // Estado inicial
            colaborador: null,                     // Se asigna desde otra app
            inicio: null,                          // Se marca desde otra app
            fin: null,
            duracion: null,
            pausas: [],
            created_at: (hasExisting && existing[0].created_at) ? existing[0].created_at : nowISO
        };

        let result;
        if (Array.isArray(existing) && existing.length > 0) {
            // Actualizar distribución existente para esta productora
            result = await supabase.update('distribuciones', record, {
                id_distribucion: distributionData.Documento,
                productora: productora
            });
            Logger.success('supabase-service', `Distribución ${distributionData.Documento} actualizada`);
        } else {
            // Insertar nueva distribución
            result = await supabase.insert('distribuciones', record);
            Logger.success('supabase-service', `Distribución ${distributionData.Documento} creada`);
        }

        // Espejo a Google Sheets (fire & forget – no bloquea el flujo)
        if (typeof saveDistribucionToSheets === 'function') {
            saveDistribucionToSheets(record).catch(err =>
                Logger.warn('supabase-service', 'Error espejo Sheets (distribuciones)', err)
            );
        }

        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `Distribución guardada en ${loadTime.toFixed(0)}ms`);

        return {
            success: true,
            isUpdate: Array.isArray(existing) && existing.length > 0,
            result: result
        };

    } catch (error) {
        Logger.error('supabase-service', 'Error guardando distribución', error);
        throw error;
    }
}

/**
 * Actualiza el estado de una distribución
 * @param {string} documento - Número de REC
 * @param {string} estado - Nuevo estado (PENDIENTE, DIRECTO, ELABORACION, FINALIZADO)
 * @returns {Promise} - Resultado de la operación
 */
async function updateDistributionStatus(documento, estado) {
    try {
        const validStates = ['PENDIENTE', 'DIRECTO', 'ELABORACION', 'FINALIZADO'];
        if (!validStates.includes(estado)) {
            throw new Error(`Estado inválido: ${estado}. Debe ser uno de: ${validStates.join(', ')}`);
        }

        const record = { estado: estado };
        
        // Si se marca como FINALIZADO, registrar el fin
        if (estado === 'FINALIZADO') {
            record.fin = new Date().toISOString();
        }

        // Obtener productora activa para el filtro
        const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
        const productora = proveedorActivo ? proveedorActivo.id : '';

        const result = await supabase.update('distribuciones', record, {
            id_distribucion: documento,
            productora: productora
        });

        Logger.success('supabase-service', `Estado de distribución ${documento} actualizado a ${estado}`);
        return { success: true, result: result };

    } catch (error) {
        Logger.error('supabase-service', 'Error actualizando estado de distribución', error);
        throw error;
    }
}

/**
 * Agrega una pausa a una distribución (desde otra app)
 * @param {string} documento - Número de REC
 * @param {Object} pausa - {inicio: timestamp, fin: timestamp}
 * @returns {Promise} - Resultado de la operación
 */
async function addDistributionPause(documento, pausa) {
    try {
        // Obtener distribución actual
        const current = await getDistributionByDocument(documento);
        if (!current) {
            throw new Error(`Distribución ${documento} no encontrada`);
        }

        // Agregar nueva pausa al array existente
        const pausas = current.pausas || [];
        pausas.push(pausa);

        // Obtener productora activa para el filtro
        const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
        const productora = proveedorActivo ? proveedorActivo.id : '';

        const result = await supabase.update('distribuciones', 
            { pausas: pausas }, 
            { id_distribucion: documento, productora: productora }
        );

        Logger.success('supabase-service', `Pausa agregada a distribución ${documento}`);
        return { success: true, result: result };

    } catch (error) {
        Logger.error('supabase-service', 'Error agregando pausa', error);
        throw error;
    }
}

/**
 * Verifica si existe una distribución para un documento
 * @param {string} documento - Número de REC
 * @returns {Promise<Object>} - {exists: boolean, data: Object}
 */
async function checkDistributionExists(documento) {
    try {
        // Obtener productora activa para el filtro
        const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
        const productora = proveedorActivo ? proveedorActivo.id : '';

        const result = await supabase.select('distribuciones', {
            filters: { id_distribucion: documento, productora: productora },
            limit: 1
        });

        return {
            exists: Array.isArray(result) && result.length > 0,
            data: Array.isArray(result) && result.length > 0 ? result[0] : null
        };
    } catch (error) {
        Logger.error('supabase-service', 'Error verificando distribución', error);
        return { exists: false, data: null };
    }
}

/**
 * Obtiene una distribución por documento
 * @param {string} documento - Número de REC
 * @returns {Promise<Object|null>} - Datos de la distribución o null
 */
async function getDistributionByDocument(documento) {
    try {
        // Obtener productora activa para el filtro
        const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
        const productora = proveedorActivo ? proveedorActivo.id : '';

        const result = await supabase.select('distribuciones', {
            filters: { id_distribucion: documento, productora: productora },
            limit: 1
        });

        return Array.isArray(result) && result.length > 0 ? result[0] : null;
    } catch (error) {
        Logger.error('supabase-service', 'Error obteniendo distribución', error);
        return null;
    }
}

// Exports
window.saveDistributionToSupabase = saveDistributionToSupabase;
window.updateDistributionStatus = updateDistributionStatus;
window.addDistributionPause = addDistributionPause;
window.checkDistributionExists = checkDistributionExists;
window.getDistributionByDocument = getDistributionByDocument;


// ============================================
// FUNCIONES PARA barras
// ============================================

/**
 * Carga códigos de barras desde Supabase con paginación
 */
async function loadBarrasFromSupabase() {
    try {
        Logger.info('supabase-service', 'Cargando BARRAS desde Supabase...');
        const startTime = performance.now();
        
        const result = await loadAllRecords('barras', {
            order: 'refprov.asc'
        });
        
        const barrasMap = new Map();
        
        // Validar que result sea un array
        if (Array.isArray(result)) {
            result.forEach(row => {
                // Crear clave compuesta: refprov|talla|id_color
                const key = `${row.refprov}|${row.talla}|${row.id_color}`;
                barrasMap.set(key, row.barra);
            });
        }
        
        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `${barrasMap.size} BARRAS cargadas en ${loadTime.toFixed(0)}ms`);
        
        return barrasMap;
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando barras', error);
        throw error;
    }
}

/**
 * Guarda o actualiza un código de barras
 * @param {string} refprov - Referencia del proveedor
 * @param {string} talla - Talla del producto
 * @param {string} idColor - Código del color
 * @param {string} barra - Código de barras
 */
async function saveBarraData(refprov, talla, idColor, barra) {
    try {
        const record = {
            refprov: refprov,
            talla: talla,
            id_color: idColor,
            barra: barra
        };
        
        // Usar upsert para insertar o actualizar
        const result = await supabase.upsert('barras', record);
        
        Logger.success('supabase-service', `Barra guardada: ${refprov}|${talla}|${idColor}`);
        return result;
    } catch (error) {
        Logger.error('supabase-service', 'Error guardando barra', error);
        throw error;
    }
}

/**
 * Guarda múltiples códigos de barras desde un archivo Excel
 * @param {Array} barrasArray - Array de objetos {refprov, talla, id_color, barra}
 */
async function saveBarrasBatch(barrasArray) {
    try {
        Logger.info('supabase-service', `Guardando ${barrasArray.length} barras en lote...`);
        const startTime = performance.now();
        
        // Preparar registros
        const records = barrasArray.map(item => ({
            refprov: item.refprov || item.estilo,
            talla: item.talla,
            id_color: item.id_color || item.color,
            barra: item.barra
        }));
        
        // Usar upsert para insertar o actualizar en lote
        const result = await supabase.upsert('barras', records);
        
        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `${barrasArray.length} barras guardadas en ${loadTime.toFixed(0)}ms`);
        
        return result;
    } catch (error) {
        Logger.error('supabase-service', 'Error guardando barras en lote', error);
        throw error;
    }
}

/**
 * Busca un código de barras por refprov, talla y color
 * @param {string} refprov - Referencia del proveedor
 * @param {string} talla - Talla del producto
 * @param {string} idColor - Código del color
 * @returns {Promise<string|null>} - Código de barras o null
 */
async function getBarra(refprov, talla, idColor) {
    try {
        const result = await supabase.select('barras', {
            filters: {
                refprov: refprov,
                talla: talla,
                id_color: idColor
            },
            limit: 1
        });
        
        if (Array.isArray(result) && result.length > 0) {
            return result[0].barra;
        }
        
        return null;
    } catch (error) {
        Logger.error('supabase-service', 'Error buscando barra', error);
        return null;
    }
}

// Exports
window.loadBarrasFromSupabase = loadBarrasFromSupabase;
window.saveBarraData = saveBarraData;
window.saveBarrasBatch = saveBarrasBatch;
window.getBarra = getBarra;
