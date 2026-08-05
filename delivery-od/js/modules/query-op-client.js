// Cliente para Edge Function query-op-data
// Consulta eficiente on-demand por OP

class QueryOpClient {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
        this.baseUrl = `${CONFIG.SUPABASE_URL}/functions/v1/query-op-data`;
    }

    /**
     * Consulta datos de una OP específica
     * @param {string} op - Número de OP/lote
     * @param {boolean} forceRefresh - Forzar consulta sin usar caché
     * @returns {Promise<Object>} Datos combinados de SIESA + ingresos + ENTREGAS
     */
    async consultarOP(op, forceRefresh = false) {
        if (!op) {
            throw new Error('OP requerida para consulta');
        }

        const opKey = String(op).trim();

        // Verificar caché (a menos que se fuerce refresh)
        if (!forceRefresh && this.cache.has(opKey)) {
            const cached = this.cache.get(opKey);
            const now = Date.now();
            
            if (now - cached.timestamp < this.cacheTimeout) {
                console.log(`📦 Datos de OP ${opKey} obtenidos del caché`);
                return cached.data;
            } else {
                // Caché expirado
                this.cache.delete(opKey);
            }
        }

        console.log(`🔍 Consultando OP ${opKey} desde servidor...`);
        const startTime = Date.now();

        try {
            // Obtener token de sesión
            const { data: { session } } = await window.supabase.auth.getSession();
            
            if (!session) {
                throw new Error('No hay sesión activa');
            }

            // Hacer consulta a Edge Function
            const url = `${this.baseUrl}?op=${encodeURIComponent(opKey)}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error ${response.status}`);
            }

            const result = await response.json();
            const queryTime = Date.now() - startTime;

            if (!result.success) {
                throw new Error(result.error || 'Error desconocido en consulta');
            }

            console.log(`✅ OP ${opKey} consultada en ${queryTime}ms`);
            console.log(`📊 Stats:`, result.stats);

            // Guardar en caché
            this.cache.set(opKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;

        } catch (error) {
            console.error(`❌ Error consultando OP ${opKey}:`, error);
            throw error;
        }
    }

    /**
     * Consulta múltiples OPs en paralelo
     * @param {Array<string>} ops - Array de números de OP
     * @returns {Promise<Object>} Mapa de OP -> datos
     */
    async consultarMultiplesOPs(ops) {
        if (!Array.isArray(ops) || ops.length === 0) {
            throw new Error('Array de OPs requerido');
        }

        console.log(`🔍 Consultando ${ops.length} OPs en paralelo...`);
        const startTime = Date.now();

        try {
            const promises = ops.map(op => this.consultarOP(op));
            const results = await Promise.allSettled(promises);

            const successMap = {};
            const errors = [];

            results.forEach((result, index) => {
                const op = ops[index];
                if (result.status === 'fulfilled') {
                    successMap[op] = result.value;
                } else {
                    errors.push({ op, error: result.reason });
                }
            });

            const totalTime = Date.now() - startTime;
            console.log(`✅ Consultas completadas en ${totalTime}ms`);
            console.log(`📊 Exitosas: ${Object.keys(successMap).length}, Errores: ${errors.length}`);

            return {
                success: true,
                data: successMap,
                errors: errors,
                totalTime: totalTime
            };

        } catch (error) {
            console.error('❌ Error en consultas múltiples:', error);
            throw error;
        }
    }

    /**
     * Busca una factura específica en los datos de una OP
     * @param {string} op - Número de OP
     * @param {string} factura - Número de factura
     * @returns {Promise<Object|null>} Datos de la factura o null
     */
    async buscarFactura(op, factura) {
        try {
            const result = await this.consultarOP(op);
            
            if (!result.data || result.data.length === 0) {
                return null;
            }

            const facturaEncontrada = result.data.find(
                item => item.factura === factura
            );

            return facturaEncontrada || null;

        } catch (error) {
            console.error(`❌ Error buscando factura ${factura} en OP ${op}:`, error);
            return null;
        }
    }

    /**
     * Obtiene estadísticas de una OP
     * @param {string} op - Número de OP
     * @returns {Promise<Object>} Estadísticas
     */
    async obtenerEstadisticasOP(op) {
        try {
            const result = await this.consultarOP(op);
            return result.stats || {};
        } catch (error) {
            console.error(`❌ Error obteniendo estadísticas de OP ${op}:`, error);
            return null;
        }
    }

    /**
     * Verifica si una OP tiene entregas pendientes
     * @param {string} op - Número de OP
     * @returns {Promise<Object>} Info de pendientes
     */
    async verificarPendientes(op) {
        try {
            const result = await this.consultarOP(op);
            
            const pendientes = result.data.filter(item => !item._tieneEntrega);
            const entregadas = result.data.filter(item => item._tieneEntrega);

            return {
                op: op,
                totalFacturas: result.data.length,
                entregadas: entregadas.length,
                pendientes: pendientes.length,
                detallesPendientes: pendientes.map(p => ({
                    factura: p.factura,
                    referencia: p.referencia,
                    cantidad: p.cantidad,
                    cliente: p.cliente
                }))
            };

        } catch (error) {
            console.error(`❌ Error verificando pendientes de OP ${op}:`, error);
            return null;
        }
    }

    /**
     * Limpia el caché
     * @param {string} op - OP específica a limpiar (opcional, limpia todo si no se proporciona)
     */
    limpiarCache(op = null) {
        if (op) {
            this.cache.delete(String(op).trim());
            console.log(`🗑️ Caché limpiado para OP ${op}`);
        } else {
            this.cache.clear();
            console.log('🗑️ Caché completamente limpiado');
        }
    }

    /**
     * Obtiene el tamaño actual del caché
     * @returns {number} Número de OPs en caché
     */
    tamanoCache() {
        return this.cache.size;
    }
}

// Exportar instancia global
if (typeof window !== 'undefined') {
    window.QueryOpClient = QueryOpClient;
    window.queryOpClient = new QueryOpClient();
    
    console.log('✅ QueryOpClient cargado y disponible globalmente');
    console.log('Uso: await queryOpClient.consultarOP("3589")');
}

// Ejemplos de uso:
// 
// 1. Consultar una OP:
//    const datos = await queryOpClient.consultarOP('3589');
//
// 2. Buscar una factura específica:
//    const factura = await queryOpClient.buscarFactura('3589', '017-00044068');
//
// 3. Verificar pendientes:
//    const pendientes = await queryOpClient.verificarPendientes('3589');
//
// 4. Consultar múltiples OPs:
//    const resultados = await queryOpClient.consultarMultiplesOPs(['3589', '3590', '3591']);
//
// 5. Limpiar caché:
//    queryOpClient.limpiarCache('3589'); // OP específica
//    queryOpClient.limpiarCache(); // Todo el caché
