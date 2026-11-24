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

            // Guardar tokens en sessionStorage para que auth-guard pueda renovarlos
            sessionStorage.setItem('supabase_token', data.access_token);
            sessionStorage.setItem('supabase_refresh_token', data.refresh_token);
            sessionStorage.setItem('supabase_token_exp', String(data.expires_at || (Math.floor(Date.now() / 1000) + (data.expires_in || 3600))));
            sessionStorage.setItem('supabase_user', JSON.stringify(data.user));

            // Programar renovación automática si auth-guard está disponible
            if (typeof scheduleTokenRefresh === 'function') {
                scheduleTokenRefresh();
            }

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

            // Manejar token expirado (401) — intentar renovar antes de cerrar sesión
            if (response.status === 401) {
                Logger.warn('supabase-service', 'Token rechazado (401), intentando renovar sesión...');

                if (typeof refreshSession === 'function') {
                    const newToken = await refreshSession();
                    if (newToken) {
                        // Reintentar la petición original con el nuevo token
                        config.headers['Authorization'] = `Bearer ${newToken}`;
                        const retryResponse = await fetch(url, config);
                        if (retryResponse.ok) {
                            if (retryResponse.status === 204 || options.method === 'DELETE') {
                                return { success: true };
                            }
                            const retryText = await retryResponse.text();
                            return retryText ? JSON.parse(retryText) : { success: true };
                        }
                    }
                }

                // Si la renovación falló, cerrar sesión
                Logger.error('supabase-service', 'No se pudo renovar la sesión');
                sessionStorage.clear();
                this.accessToken = null;
                this.user = null;

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
        } catch (_) { }

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
     * Compatible tanto con Edge Function como con fallback directo
     * @param {string} table - Nombre de la tabla
     * @param {Object|Array} data - Datos a insertar/actualizar
     * @param {string} onConflict - Columna(s) para detectar conflictos (ej: 'referencia')
     */
    async upsert(table, data, onConflict = 'id') {
        const dataArray = Array.isArray(data) ? data : [data];

        // Mapeo a acciones del gateway para evitar egreso y pasar por la EF
        const gatewayMap = {
            'precios': 'upsert_precio',
            'usuarios': 'upsert_usuario',
            'proveedores': 'upsert_proveedor',
            'auditores': 'upsert_auditor',
            'gestores': 'upsert_gestor',
            'colores': 'upsert_color',
            'clientes': 'upsert_cliente',
            'pedidos': 'upsert_pedido',
            'barras': 'upsert_barra',
            'historicas': 'upsert_historica'
        };

        if (gatewayMap[table]) {
            try {
                return await this.callGateway(gatewayMap[table], dataArray);
            } catch (err) {
                Logger.warn('supabase-service', `Fallo upsert vía gateway para ${table}, intentando directo: ${err.message}`);
            }
        }

        // Llamada REST directa autenticada
        return await this.request(`${table}?on_conflict=${onConflict}`, {
            method: 'POST',
            headers: {
                'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify(dataArray)
        });
    }

    /**
     * Realiza una petición por medio de la Edge Function api-gateway (Bajo demanda, sin egreso masivo)
     */
    async callGateway(action, payload = {}) {
        const token = this.accessToken || sessionStorage.getItem('supabase_token') || this.key;
        const gatewayUrl = `${this.url}/functions/v1/api-gateway`;
        const config = {
            method: 'POST',
            headers: {
                'apikey': this.key,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action, payload })
        };

        try {
            const response = await fetch(gatewayUrl, config);
            if (response.status === 401 && typeof refreshSession === 'function') {
                const newToken = await refreshSession();
                if (newToken) {
                    config.headers['Authorization'] = `Bearer ${newToken}`;
                    const retryRes = await fetch(gatewayUrl, config);
                    if (retryRes.ok) {
                        const rData = await retryRes.json();
                        if (rData.error) throw new Error(rData.error);
                        return rData.data;
                    }
                }
                sessionStorage.clear();
                window.location.href = 'login.html';
                throw new Error('Sesión expirada');
            }

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${response.status}`);
            }

            const resData = await response.json();
            if (resData.error) throw new Error(resData.error);
            return resData.data;
        } catch (err) {
            Logger.error('supabase-service', `Error en callGateway (${action})`, err);
            throw err;
        }
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
        const lineaEdit = document.getElementById('opLineaEdit')?.value?.trim() || '';

        // Para Excel/BUSINT: leer lote y tipo editables
        const primerItemCheck = data[0] || {};
        const esBusint = primerItemCheck.FUENTE === 'BUSINT';
        const loteEdit = esBusint ? (document.getElementById('opLoteEdit')?.value?.trim() || '') : '';
        const tipoEdit = esBusint ? (document.getElementById('opTipoEdit')?.value?.trim() || 'FULL') : 'FULL';

        // Preferir un item de PRIMERAS (DI) como fuente de REFPROV, REFERENCIA y
        // DESCRIPCION_LARGA, ya que esos campos deben reflejar el artículo principal.
        // Si la OP no tiene items de PRIMERAS (p.ej. solo COBROS), se usa data[0]
        // como fallback y el flujo continúa normalmente sin bloquear.
        const primerItem = data.find(i => i.BODEGA === 'PRIMERAS') || data[0] || {};
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
                // Agregar referencia y descripcion SOLO si es REFVAR (usar campos HR específicos)
                const esRefVarActual = (item.REFERENCIA === 'REFVAR' || item.REFERENCIA_HISTORICA === 'REFVAR' || document.getElementById('opRefReadonly')?.value?.trim() === 'REFVAR');
                if (esRefVarActual) {
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

        // Si no hay prendas de PRIMERAS pero sí hay de PROMOCIONES (ej: entrega de solo promociones),
        // generar el HR a partir de las promociones para que Distribución e Impresión puedan procesarlas
        if (hr.length === 0 && cantidadPromo > 0) {
            data.filter(i => i.BODEGA === 'PROMOCIONES').forEach(item => {
                hr.push({
                    codigo_color: item.COD_COLOR || '',
                    color: item.COLORES || '',
                    talla: item.TALLA || '',
                    cantidad: parseInt(item.CANTIDAD) || 0
                });
            });
        }

        // Si es un parcial, tener en cuenta las entregas anteriores para calcular la diferencia restante real
        let acumuladoAnterior = 0;
        const loteOpKey = (loteEdit || primerItem.OP || '').toString().trim();
        const jsonMapGlobal = window.data2JsonMap || (typeof data2JsonMap !== 'undefined' ? data2JsonMap : null);
        if (jsonMapGlobal && jsonMapGlobal.has(loteOpKey)) {
            const previos = jsonMapGlobal.get(loteOpKey);
            if (Array.isArray(previos)) {
                acumuladoAnterior = previos.reduce((acc, r) => acc + (Math.round(parseFloat(r.TOTAL_GENERAL)) || 0), 0);
            }
        }
        const diferencia = total - (acumuladoAnterior + totalGeneral);  // Diferencia restante de la OP
        const costoUnitario = parseFloat(primerItem.COSTO) || 0;

        // Referencia principal editada en cabecera
        const referenciaEditHeader = document.getElementById('opRefReadonly')?.value?.trim();
        const esRefVarOP = (referenciaEditHeader === 'REFVAR');

        // 1. REFERENCIA: Código interno o histórico
        const refBase = referenciaEditHeader || primerItem.REFERENCIA;
        const referenciaHistorica = esRefVarOP
            ? 'REFVAR'
            : (primerItem.FUENTE === 'BUSINT' && primerItem.REFERENCIA_HISTORICA && !referenciaEditHeader)
                ? primerItem.REFERENCIA_HISTORICA
                : (typeof getReferenciaHistorica === 'function')
                    ? getReferenciaHistorica(refBase)
                    : refBase;

        // 2. REFPROV: Referencia de proveedor real (o REFVAR si aplica)
        const refProvFinal = esRefVarOP
            ? 'REFVAR'
            : (primerItem.REFPROV || primerItem.REFERENCIA_PROV || primerItem.REFERENCIA || refBase);

        // Calcular otros_traslados (traslados adicionales de la misma OP que pertenezcan a esta misma entrega)
        const otrosTraslados = [];
        if (typeof lastCsvRows !== 'undefined' && lastCsvRows) {
            const opStr = (primerItem.OP || '').toString().trim();
            const trasladoActual = (parseInt(primerItem.TRASLADO) || 0).toString();
            const set = new Set();

            // Extraer traslados ya guardados en parciales anteriores para no incluirlos
            const trasladosPreviosEnBd = new Set();
            if (jsonMapGlobal && jsonMapGlobal.has(loteOpKey)) {
                const previos = jsonMapGlobal.get(loteOpKey);
                if (Array.isArray(previos)) {
                    previos.forEach(p => {
                        const pt = (p.TRASLADO || '').toString().trim();
                        if (pt) trasladosPreviosEnBd.add(pt);
                        if (Array.isArray(p.OTROS_TRASLADOS)) {
                            p.OTROS_TRASLADOS.forEach(ot => {
                                const otStr = (ot || '').toString().trim();
                                if (otStr) trasladosPreviosEnBd.add(otStr);
                            });
                        }
                        if (Array.isArray(p.ANEXOS)) {
                            p.ANEXOS.forEach(a => {
                                const at = (a.TRASLADO || '').toString().trim();
                                if (at) trasladosPreviosEnBd.add(at);
                            });
                        }
                    });
                }
            }

            for (let i = 0; i < lastCsvRows.length; i++) {
                const row = lastCsvRows[i];
                if (row.length < 8) continue;
                if ((row[2] || '').toString().trim() !== opStr) continue;

                const t = (typeof extractTrasladoNumber === 'function')
                    ? extractTrasladoNumber(row[7] || '')
                    : (row[7] || '').toString().trim();

                if (t && t !== trasladoActual && !trasladosPreviosEnBd.has(t)) {
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
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
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
            refprov: refProvFinal,
            descripcion: esRefVarOP
                ? 'PRENDAS VARIAS CHICA CHIC'
                : getDescripcion(prendaEdit || primerItem.PRENDA, generoEdit || primerItem.GENERO, getMarca(generoEdit || primerItem.GENERO, productora), refProvFinal),
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

        // Guardar ingreso vía Edge Function api-gateway (RPC atómico upsert_ingreso)
        Logger.info('supabase-service', `Guardando ingreso vía Edge Function: ${record.id_ingreso} / ${record.productora}`);
        const result = await supabase.callGateway('upsert_ingreso', record);

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
 * Carga SOLO la LINEA (cuento) de las OPs solicitadas desde el catálogo master externo.
 * Usado por el procesador CSV — no necesita prenda/genero/referencia, solo la línea.
 * Consulta directo a zpikjjcbievfpzegupmw via EF query-master, sin tabla local.
 *
 * @param {string[]} ops - OPs a buscar
 * @returns {Promise<Map<string, {PRENDA:'', LINEA:string, GENERO:'', REFERENCIA:''}>>}
 */
async function loadSisprowebFromSupabase(ops = []) {
    if (!ops || ops.length === 0) {
        Logger.info('supabase-service', 'SISPROWEB: sin OPs, omitido');
        return new Map();
    }

    try {
        const opsClean = [...new Set(ops.map(o => String(o).trim()).filter(Boolean))];
        if (!opsClean.length) return new Map();

        Logger.info('supabase-service', `SISPROWEB on-demand: consultando ${opsClean.length} OPs (solo LINEA)...`);
        const startTime = performance.now();

        // Llamar EF query-master directamente — sin tabla local, sin sync
        const QUERY_MASTER_URL = `${SUPABASE_URL}/functions/v1/query-master`;
        const token = supabase.accessToken || sessionStorage.getItem('supabase_token') || SUPABASE_ANON_KEY;

        const res = await fetch(QUERY_MASTER_URL, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'get_lineas_by_ops', payload: { ops: opsClean } })
        });

        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || `query-master HTTP ${res.status}`);
        }

        const json = await res.json();
        if (json.error) throw new Error(json.error);

        const sisproMap = new Map();
        (json.data || []).forEach(row => {
            if (row.op) {
                sisproMap.set(row.op, {
                    PRENDA:     '',        // CSV obtiene esto de sus propias columnas
                    LINEA:      row.linea || '',
                    GENERO:     '',
                    REFERENCIA: ''
                });
            }
        });

        const ms = (performance.now() - startTime).toFixed(0);
        Logger.success('supabase-service', `SISPROWEB on-demand: ${sisproMap.size}/${opsClean.length} líneas en ${ms}ms`);
        return sisproMap;

    } catch (error) {
        Logger.error('supabase-service', 'Error en loadSisprowebFromSupabase', error);
        throw error;
    }
}

/**
 * Obtiene detalle completo de OPs desde el catálogo master externo.
 * Usado por el módulo de Pedidos: referencia, prenda, línea, género.
 * Consulta directo a zpikjjcbievfpzegupmw via EF query-master.
 *
 * @param {string[]} ops - OPs a buscar
 * @returns {Promise<Map<string, {PRENDA, LINEA, GENERO, REFERENCIA}>>}
 */
async function fetchOpsDetailFromMaster(ops = []) {
    if (!ops || ops.length === 0) return new Map();

    try {
        const opsClean = [...new Set(ops.map(o => String(o).trim()).filter(Boolean))];
        if (!opsClean.length) return new Map();

        Logger.info('supabase-service', `MASTER detalle: consultando ${opsClean.length} OPs...`);
        const startTime = performance.now();

        const QUERY_MASTER_URL = `${SUPABASE_URL}/functions/v1/query-master`;
        const token = supabase.accessToken || sessionStorage.getItem('supabase_token') || SUPABASE_ANON_KEY;

        const res = await fetch(QUERY_MASTER_URL, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'get_ops_detail', payload: { ops: opsClean } })
        });

        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || `query-master HTTP ${res.status}`);
        }

        const json = await res.json();
        if (json.error) throw new Error(json.error);

        const detailMap = new Map();
        (json.data || []).forEach(row => {
            if (row.op) {
                detailMap.set(row.op, {
                    PRENDA:     row.prenda     || '',
                    LINEA:      row.linea      || '',
                    GENERO:     row.genero     || '',
                    REFERENCIA: row.referencia || ''
                });
            }
        });

        const ms = (performance.now() - startTime).toFixed(0);
        Logger.success('supabase-service', `MASTER detalle: ${detailMap.size}/${opsClean.length} OPs en ${ms}ms`);
        return detailMap;

    } catch (error) {
        Logger.error('supabase-service', 'Error en fetchOpsDetailFromMaster', error);
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
async function loadData2FromSupabase(lotes = [], ids = []) {
    try {
        Logger.info('supabase-service', 'Cargando ingresos confirmados desde Supabase...');
        const startTime = performance.now();

        let result;

        const allItems = [
            ...(Array.isArray(lotes) ? lotes : [lotes]),
            ...(Array.isArray(ids) ? ids : [ids])
        ];

        const lotesClean = [...new Set(allItems.map(l => parseInt(l)).filter(n => !isNaN(n) && n > 0))];
        const idsClean = [...new Set(allItems.map(l => (l || '').toString().trim()).filter(Boolean))];

        if (lotesClean.length > 0 || idsClean.length > 0) {
            // Bajo demanda vía Edge Function (api-gateway -> RPC get_lotes_data2)
            result = await supabase.callGateway('get_lotes_data2', { lotes: lotesClean, ids: idsClean });
            Logger.info('supabase-service', `Ingresos bajo demanda vía EF: ${lotesClean.length} lotes, ${idsClean.length} IDs, ${result?.length || 0} registros`);
        } else {
            Logger.info('supabase-service', 'loadData2: sin lotes ni IDs, retornando mapas vacíos');
            return { data2Map: new Map(), data2CountMap: new Map(), data2JsonMap: new Map() };
        }

        const data2Map = new Map();
        const data2CountMap = new Map();
        const data2JsonMap = new Map();

        // Convierte fecha ISO (YYYY-MM-DD) de Supabase a DD/MM/YYYY que usan normalizeFecha() y parseFechaToTimestamp()
        const isoToDD_MM_YYYY = (isoStr) => {
            if (!isoStr) return '';
            const s = isoStr.toString().trim().split('T')[0]; // quitar hora si existe
            const parts = s.split('-');
            if (parts.length !== 3) return isoStr; // si ya es DD/MM/YYYY u otro formato, lo devuelve tal cual
            return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        };

        // Normaliza un valor total/cantidad a entero-string para comparar con row[19] del CSV
        // El CSV puede traer "7.00" y Supabase guarda 7 → ambos deben quedar "7"
        const normTotal = (val) => {
            const n = Math.round(parseFloat(val));
            return isNaN(n) ? (val || '').toString().trim() : n.toString();
        };

        if (Array.isArray(result)) {
            result.forEach(row => {
                const lote = (row.lote || '').toString().trim();
                const idIngreso = (row.id_ingreso || '').toString().trim();
                const fecha = isoToDD_MM_YYYY(row.fecha_traslado || ''); // DD/MM/YYYY
                const fechaNorm = normalizeFecha(fecha);

                // Insertar TODAS las variantes de total/cantidad para que validarEstado()
                // encuentre la clave sin importar qué campo fue guardado como total declarado.
                const variantes = new Set([
                    row.total,
                    row.total_relativo,
                    row.cantidad
                ]);

                // Registrar bajo lote y bajo id_ingreso (soporta tanto CSV donde lote=id_ingreso como Excel donde lote != id_ingreso)
                const claves = new Set([lote, idIngreso].filter(Boolean));

                claves.forEach(k => {
                    variantes.forEach(val => {
                        if (val !== null && val !== undefined) {
                            const totalNorm = normTotal(val);
                            data2Map.set(`${k}|${fechaNorm}|${totalNorm}`, true);
                        }
                    });

                    // ── data2CountMap ──
                    data2CountMap.set(k, (data2CountMap.get(k) || 0) + 1);

                    // ── data2JsonMap: objetos con los campos que lee validarEstadoParcial() ──
                    if (!data2JsonMap.has(k)) data2JsonMap.set(k, []);
                    data2JsonMap.get(k).push({
                        id_ingreso: idIngreso,
                        lote: lote,
                        FECHA: fecha,                                                          // DD/MM/YYYY
                        TRASLADO: (row.traslado || '').toString(),
                        OTROS_TRASLADOS: Array.isArray(row.otros_traslados) ? row.otros_traslados : [],
                        ANEXOS: Array.isArray(row.anexos) ? row.anexos : [],
                        DIFERENCIA: row.diferencia ?? 0,
                        CANTIDAD: row.cantidad ?? 0,   // PRIMERAS+PROMO (máximo distribuible)
                        TOTAL_GENERAL: row.total_general ?? 0, // lo que realmente ingresó
                        TOTAL: row.total ?? 0  // Total de la orden de producción original
                    });
                });
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
        Logger.info('supabase-service', 'Cargando PEDIDOS activos desde Supabase...');
        const startTime = performance.now();

        // Solo traer pedidos activos (estado = true) — los cumplidos no se cargan al inicio
        const result = await supabase.selectAll('pedidos', {
            filters: { estado: true },
            order: 'fecha.desc'
        });

        let pedidos = [];

        if (Array.isArray(result)) {
            pedidos = result.map(row => ({
                id: row.id_pedido,
                mayoristaId: row.mayorista_id || '',
                nombreCliente: row.nombre_cliente || '',
                op: row.op || '',
                referencia: row.referencia || '',
                prenda: row.prenda || '',
                genero: row.genero || '',
                cantidad: row.cantidad || 0,
                obs: row.obs || '',
                fecha: row.fecha || '',
                estado: true
            }));
        }

        const loadTime = performance.now() - startTime;
        Logger.success('supabase-service', `${pedidos.length} PEDIDOS activos cargados en ${loadTime.toFixed(0)}ms`);

        return pedidos;
    } catch (error) {
        Logger.error('supabase-service', 'Error cargando pedidos', error);
        throw error;
    }
}

/**
 * Carga todos los datos de configuración desde Supabase
 */
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
window.loadSisprowebFromSupabase  = loadSisprowebFromSupabase;
window.syncMasterEdgeFunction     = syncMasterEdgeFunction;
window.fetchOpsDetailFromMaster   = fetchOpsDetailFromMaster;
window.loadHistoricasFromSupabase = loadHistoricasFromSupabase;
window.loadData2FromSupabase = loadData2FromSupabase;
window.loadClientesFromSupabase = loadClientesFromSupabase;
window.loadPedidosFromSupabase = loadPedidosFromSupabase;
window.loadColoresFromSupabase = loadColoresFromSupabase;

/**
 * Carga datos de distribución desde Supabase
 * Optimizado: consulta FULL y PENDIENTES vía Edge Function / RPC sin descargar toda la tabla
 */
async function loadDistributionDataFromSupabase() {
    try {
        Logger.info('supabase-service', 'Cargando datos de distribución vía Edge Function...');
        const startTime = performance.now();

        const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
        const productora = proveedorActivo ? proveedorActivo.id : null;

        // Llamar a la Edge Function api-gateway (acción: get_distribution_data)
        const resData = await supabase.callGateway('get_distribution_data', { productora });
        const resultFull = resData?.full || [];
        const resultPendiente = resData?.pendientes || [];

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
                            item.color || '',
                            item.talla || '',
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
                        item.color || '',
                        item.talla || '',
                        item.cantidad ? item.cantidad.toString() : '0'
                    ]);
                }

                // Si no tiene HR pero tiene anexos de tipo PROMO (p.ej. entrega de solo promociones)
                if (hrArray.length === 0 && Array.isArray(row.anexos)) {
                    const promoAnexos = row.anexos.filter(a => {
                        const t = (a.TIPO || a.tipo || '').toString().toUpperCase();
                        const b = (a.BODEGA || a.bodega || '').toString().toUpperCase();
                        return t === 'PROMO' || b === 'PROMOCIONES';
                    });
                    if (promoAnexos.length > 0) {
                        hrArray = promoAnexos.map(item => [
                            (item.COD_COLOR || item.codigo_color || item.CODIGO || item.COLOR || item.color || '').toString().trim(),
                            (item.COLOR || item.color || '').toString().trim(),
                            (item.TALLA || item.talla || '').toString().trim(),
                            (item.CANTIDAD != null ? item.CANTIDAD : (item.cantidad != null ? item.cantidad : '0')).toString().trim()
                        ]);
                    }
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
                                const nueva = parseInt(itemHr[3]) || 0;
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
                    "A": row.id_ingreso || '',
                    "FECHA": row.fecha_traslado || '',
                    "TALLER": row.taller || '',
                    "LINEA": row.linea || '',
                    "AUDITOR": row.auditor || '',
                    "ESCANER": row.escaner || '',
                    "LOTE": lote,
                    "REFERENCIA": row.referencia || '',
                    "DESCRIPCIÓN": row.descripcion || '',
                    "CANTIDAD": row.cantidad ? row.cantidad.toString() : '0',
                    "TEMPLO": '',
                    "TIPO": row.tipo || 'FULL',
                    "PVP": row.pvp ? row.pvp.toString() : '0',
                    "PRENDA": row.prenda || '',
                    "GENERO": row.genero || '',
                    "HR": hrArray,
                    "PROVEEDOR": row.proveedor || '',
                    "ANEXO": anexos
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
        columns: 'id_ingreso,lote,fecha_traslado,taller,linea,auditor,escaner,referencia,descripcion,cantidad,tipo,pvp,prenda,genero,hr,proveedor,anexos,detalle_cantidades',
        filters: { tipo: 'FULL', id_ingreso: recClean }
    });

    // Si no encontró sin ceros, probar con el número original
    let fullRow = Array.isArray(resultFull) && resultFull.length > 0 ? resultFull[0] : null;
    if (!fullRow && recClean !== recNumber) {
        const r2 = await supabase.select('ingresos', {
            columns: 'id_ingreso,lote,fecha_traslado,taller,linea,auditor,escaner,referencia,descripcion,cantidad,tipo,pvp,prenda,genero,hr,proveedor,anexos,detalle_cantidades',
            filters: { tipo: 'FULL', id_ingreso: recNumber }
        });
        fullRow = Array.isArray(r2) && r2.length > 0 ? r2[0] : null;
    }
    // Si aún no se encuentra, buscar por id_ingreso sin restringir por tipo
    if (!fullRow) {
        const r3 = await supabase.select('ingresos', {
            columns: 'id_ingreso,lote,fecha_traslado,taller,linea,auditor,escaner,referencia,descripcion,cantidad,tipo,pvp,prenda,genero,hr,proveedor,anexos,detalle_cantidades',
            filters: { id_ingreso: recClean }
        });
        fullRow = Array.isArray(r3) && r3.length > 0 ? r3[0] : null;
    }
    if (!fullRow && recClean !== recNumber) {
        const r4 = await supabase.select('ingresos', {
            columns: 'id_ingreso,lote,fecha_traslado,taller,linea,auditor,escaner,referencia,descripcion,cantidad,tipo,pvp,prenda,genero,hr,proveedor,anexos,detalle_cantidades',
            filters: { id_ingreso: recNumber }
        });
        fullRow = Array.isArray(r4) && r4.length > 0 ? r4[0] : null;
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
            item.color || '',
            item.talla || '',
            item.cantidad ? item.cantidad.toString() : '0'
        ]);
    }

    // Si no tiene HR pero tiene anexos de tipo PROMO (p.ej. segundo parcial 100% promociones)
    if (hrArray.length === 0 && Array.isArray(fullRow.anexos)) {
        const promoAnexos = fullRow.anexos.filter(a => {
            const t = (a.TIPO || a.tipo || '').toString().toUpperCase();
            const b = (a.BODEGA || a.bodega || '').toString().toUpperCase();
            return t === 'PROMO' || b === 'PROMOCIONES';
        });

        if (promoAnexos.length > 0) {
            hrArray = promoAnexos.map(item => [
                (item.COD_COLOR || item.codigo_color || item.CODIGO || item.COLOR || item.color || '').toString().trim(),
                (item.COLOR || item.color || '').toString().trim(),
                (item.TALLA || item.talla || '').toString().trim(),
                (item.CANTIDAD != null ? item.CANTIDAD : (item.cantidad != null ? item.cantidad : '0')).toString().trim()
            ]);
        }
    }

    // Fusionar HR de PENDIENTES (mismo algoritmo que loadDistributionDataFromSupabase)
    const anexosPendientes = [];
    pendientesRows.forEach(row => {
        anexosPendientes.push({
            DOCUMENTO: row.id_ingreso || '',
            TIPO: 'PENDIENTES',
            CANTIDAD: row.cantidad ? row.cantidad.toString() : '0'
        });
        if (Array.isArray(row.hr) && row.hr.length > 0) {
            const combinedHrMap = {};
            hrArray.forEach(itemHr => { if (itemHr[0]) combinedHrMap[itemHr[0]] = [...itemHr]; });
            row.hr.forEach(item => {
                const key = item.codigo_color || '';
                if (!key) return;
                const hrRow = [key, item.color || '', item.talla || '', item.cantidad ? item.cantidad.toString() : '0'];
                if (combinedHrMap[key]) {
                    combinedHrMap[key][3] = (parseInt(combinedHrMap[key][3]) || 0) + (parseInt(hrRow[3]) || 0) + '';
                } else {
                    combinedHrMap[key] = hrRow;
                }
            });
            hrArray = Object.values(combinedHrMap);
        }
    });

    const anexos = [...(Array.isArray(fullRow.anexos) ? fullRow.anexos : []), ...anexosPendientes];

    return {
        "A": fullRow.id_ingreso || '',
        "FECHA": fullRow.fecha_traslado || '',
        "TALLER": fullRow.taller || '',
        "LINEA": fullRow.linea || '',
        "AUDITOR": fullRow.auditor || '',
        "ESCANER": fullRow.escaner || '',
        "LOTE": lote,
        "REFERENCIA": fullRow.referencia || '',
        "DESCRIPCIÓN": fullRow.descripcion || '',
        "CANTIDAD": fullRow.cantidad ? fullRow.cantidad.toString() : '0',
        "TEMPLO": '',
        "TIPO": fullRow.tipo || 'FULL',
        "PVP": fullRow.pvp ? fullRow.pvp.toString() : '0',
        "PRENDA": fullRow.prenda || '',
        "GENERO": fullRow.genero || '',
        "HR": hrArray,
        "PROVEEDOR": fullRow.proveedor || '',
        "ANEXO": anexos,
        "DETALLE_CANTIDADES": fullRow.detalle_cantidades || null
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


// ============================================
// FUNCIONES ON-DEMAND — carga estricta por IDs
// Solo traen los registros que existen en el
// archivo subido (CSV o Excel), nada más.
// ============================================

/**
 * Carga SOLO los colores cuyos id_color están en la lista dada.
 * Reemplaza la carga masiva loadColoresFromSupabase() para CSV/Excel.
 * @param {string[]} ids - Códigos de color extraídos del archivo
 * @param {string} [productora] - NIT del proveedor activo (opcional)
 * @returns {Promise<Map<string,string>>} id_color → nombre_color
 */
async function loadColoresByIds(ids, productora = '') {
    if (!ids || ids.length === 0) return new Map();

    try {
        const idsClean = [...new Set(ids.map(i => String(i).trim()).filter(Boolean))];
        if (idsClean.length === 0) return new Map();

        Logger.info('supabase-service', `COLORES on-demand: consultando ${idsClean.length} códigos...`);
        const startTime = performance.now();

        const ON_DEMAND_URL = `${SUPABASE_URL}/functions/v1/on-demand-query`;
        const token = supabase.accessToken || sessionStorage.getItem('supabase_token') || SUPABASE_ANON_KEY;

        const res = await fetch(ON_DEMAND_URL, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action:  'get_colores_by_ids',
                payload: { ids: idsClean, productora: productora || '' }
            })
        });

        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || `on-demand-query HTTP ${res.status}`);
        }

        const json = await res.json();
        if (json.error) throw new Error(json.error);

        const coloresMap = new Map();
        (Array.isArray(json.data) ? json.data : []).forEach(row => {
            if (row.id_color) coloresMap.set(String(row.id_color).trim(), row.nombre_color || '');
        });

        const ms = (performance.now() - startTime).toFixed(0);
        Logger.success('supabase-service', `COLORES on-demand: ${coloresMap.size}/${idsClean.length} encontrados en ${ms}ms`);
        return coloresMap;
    } catch (error) {
        Logger.error('supabase-service', 'Error en loadColoresByIds', error);
        throw error;
    }
}

/**
 * Carga SOLO los precios cuyas referencias están en la lista dada.
 * Reemplaza la carga masiva loadPreciosFromSupabase() para CSV/Excel.
 * @param {string[]} refs - Referencias extraídas del archivo
 * @returns {Promise<Map<string,string>>} referencia → pvp
 */
async function loadPreciosByRefs(refs) {
    if (!refs || refs.length === 0) return new Map();

    try {
        const refsClean = [...new Set(refs.map(r => String(r).trim()).filter(Boolean))];
        if (refsClean.length === 0) return new Map();

        Logger.info('supabase-service', `PRECIOS on-demand: consultando ${refsClean.length} referencias...`);
        const startTime = performance.now();

        const ON_DEMAND_URL = `${SUPABASE_URL}/functions/v1/on-demand-query`;
        const token = supabase.accessToken || sessionStorage.getItem('supabase_token') || SUPABASE_ANON_KEY;

        const res = await fetch(ON_DEMAND_URL, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action:  'get_precios_by_refs',
                payload: { refs: refsClean }
            })
        });

        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || `on-demand-query HTTP ${res.status}`);
        }

        const json = await res.json();
        if (json.error) throw new Error(json.error);

        const preciosMap = new Map();
        (Array.isArray(json.data) ? json.data : []).forEach(row => {
            if (row.referencia) preciosMap.set(String(row.referencia).trim(), String(row.pvp ?? ''));
        });

        const ms = (performance.now() - startTime).toFixed(0);
        Logger.success('supabase-service', `PRECIOS on-demand: ${preciosMap.size}/${refsClean.length} encontrados en ${ms}ms`);
        return preciosMap;
    } catch (error) {
        Logger.error('supabase-service', 'Error en loadPreciosByRefs', error);
        throw error;
    }
}

/**
 * Carga SOLO las historicas cuyas refprov están en la lista dada.
 * Reemplaza la carga masiva loadHistoricasFromSupabase() para CSV/Excel.
 * @param {string[]} refprovs - Refprovs extraídas del archivo
 * @param {string} [productora] - NIT del proveedor activo (opcional)
 * @returns {Promise<Map<string,string>>} refprov → referencia
 */
async function loadHistoricasByRefprovs(refprovs, productora = '') {
    if (!refprovs || refprovs.length === 0) return new Map();

    try {
        const refsClean = [...new Set(refprovs.map(r => String(r).trim()).filter(Boolean))];
        if (refsClean.length === 0) return new Map();

        Logger.info('supabase-service', `HISTORICAS on-demand: consultando ${refsClean.length} refprovs...`);
        const startTime = performance.now();

        // Llamar EF on-demand-query — no va directo a PostgREST, sin egreso masivo
        const ON_DEMAND_URL = `${SUPABASE_URL}/functions/v1/on-demand-query`;
        const token = supabase.accessToken || sessionStorage.getItem('supabase_token') || SUPABASE_ANON_KEY;

        const res = await fetch(ON_DEMAND_URL, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action:  'get_historicas_by_refprovs',
                payload: { refprovs: refsClean, productora: productora || '' }
            })
        });

        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || `on-demand-query HTTP ${res.status}`);
        }

        const json = await res.json();
        if (json.error) throw new Error(json.error);

        const historicasMap = new Map();
        (Array.isArray(json.data) ? json.data : []).forEach(row => {
            if (row.refprov && row.referencia) {
                historicasMap.set(String(row.refprov).trim(), String(row.referencia).trim());
            }
        });

        const ms = (performance.now() - startTime).toFixed(0);
        Logger.success('supabase-service', `HISTORICAS on-demand: ${historicasMap.size}/${refsClean.length} encontradas en ${ms}ms`);
        return historicasMap;
    } catch (error) {
        Logger.error('supabase-service', 'Error en loadHistoricasByRefprovs', error);
        throw error;
    }
}

/**
 * Carga SOLO las barras cuyas refprov están en la lista dada.
 * Reemplaza la carga masiva loadBarrasFromSupabase() para CSV/Excel.
 * @param {string[]} refprovs - Refprovs/referencias extraídas del archivo
 * @returns {Promise<Map<string,string>>} refprov|talla|id_color → barra
 */
async function loadBarrasByRefprovs(refprovs) {
    if (!refprovs || refprovs.length === 0) return new Map();

    try {
        const refsClean = [...new Set(refprovs.map(r => String(r).trim()).filter(Boolean))];
        if (refsClean.length === 0) return new Map();

        Logger.info('supabase-service', `BARRAS on-demand: consultando ${refsClean.length} refprovs...`);
        const startTime = performance.now();

        const ON_DEMAND_URL = `${SUPABASE_URL}/functions/v1/on-demand-query`;
        const token = supabase.accessToken || sessionStorage.getItem('supabase_token') || SUPABASE_ANON_KEY;

        const res = await fetch(ON_DEMAND_URL, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'apikey':        SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action:  'get_barras_by_refprovs',
                payload: { refprovs: refsClean }
            })
        });

        if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            throw new Error(e.error || `on-demand-query HTTP ${res.status}`);
        }

        const json = await res.json();
        if (json.error) throw new Error(json.error);

        const barrasMap = new Map();
        (Array.isArray(json.data) ? json.data : []).forEach(row => {
            const key = `${row.refprov}|${row.talla}|${row.id_color}`;
            barrasMap.set(key, row.barra || '');
        });

        const ms = (performance.now() - startTime).toFixed(0);
        Logger.success('supabase-service', `BARRAS on-demand: ${barrasMap.size} registros en ${ms}ms`);
        return barrasMap;
    } catch (error) {
        Logger.error('supabase-service', 'Error en loadBarrasByRefprovs', error);
        return new Map();
    }
}

// Exports on-demand
window.loadColoresByIds          = loadColoresByIds;
window.loadPreciosByRefs         = loadPreciosByRefs;
window.loadHistoricasByRefprovs  = loadHistoricasByRefprovs;
window.loadBarrasByRefprovs      = loadBarrasByRefprovs;
