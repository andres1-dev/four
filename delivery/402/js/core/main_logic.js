// principal.js - Datos con Factura Optimizado
// Configuración de Sheets
// Usar API Key desde CONFIG
const API_KEY = CONFIG.GOOGLE_SHEETS_API_KEY;

// Fuentes de datos
const SOURCE_SPREADSHEET_ID_DATA2 = "133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI";
const SOURCE_SHEET_NAME_DATA2 = "DATA2";
const SOURCE_DATA2_COLUMN = "S";

const SOURCE_SPREADSHEET_ID_SIESA = "1FcQhVIKtWy4O-aGTNfA6l4C5Q4_u1LZErpj3CMglfQM";
const SOURCE_SHEET_NAME_SIESA = "SIESA";
const SOURCE_SHEET_NAME_SIESA_2 = "SIESA_V2";

const SOURCE_SPREADSHEET_ID_REC = "1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc";
const SOURCE_SHEET_NAME_REC = "DataBase";

// ⚠️ OBSOLETO: Ya no se usa Google Sheets para SOPORTES, ahora se usa Supabase
// const SOPORTES_SPREADSHEET_ID = "1VaPBwgRu1QWhmsV_Qgf7cgraSxiAWRX6-wBEyUlGoJw";
// const SOPORTES_SHEET_NAME = "SOPORTES";

// URL base para imágenes antiguas de Google Drive (compatibilidad con datos legacy)
const BASE_IMAGE_URL = "https://lh3.googleusercontent.com/d/";

// Función principal para obtener datos
async function obtenerDatosFacturados() {
    try {
        const [datosData2, datosSiesa, datosSoportes, datosRec] = await Promise.all([
            obtenerDatosDeData2(),
            obtenerDatosSiesaSupabase(), // Cambiado de obtenerDatosSiesa a obtenerDatosSiesaSupabase
            obtenerDatosSoportes(),
            obtenerDatosRecFiltrados()
        ]);

        return combinarDatosFacturados(datosData2, datosSiesa, datosSoportes, datosRec);

    } catch (error) {
        console.error("Error en obtenerDatosFacturados:", error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// Función principal de combinación
function combinarDatosFacturados(datosData2, datosSiesa, datosSoportes, datosRec) {
    const datosCombinados = [];
    const lotesProcesados = new Set();
    const facturasProcesadasSiesa = new Set();

    // Paso 1: Procesar DATA2
    const resultadosData2 = procesarFuenteDATA2(datosData2, datosSiesa, datosSoportes, lotesProcesados, facturasProcesadasSiesa);
    datosCombinados.push(...resultadosData2);

    // Paso 2: Procesar REC
    const resultadosREC = procesarFuenteREC(datosRec, datosSiesa, datosSoportes, lotesProcesados, facturasProcesadasSiesa);
    datosCombinados.push(...resultadosREC);

    // Paso 3: Identificar facturas de SIESA huérfanas (con error en lote, string con texto, sin origen en DATA2/REC, etc.)
    const huerfanasSiesa = [];
    datosSiesa.forEach(filaSiesa => {
        const factura = filaSiesa[1];
        if (factura && !facturasProcesadasSiesa.has(factura)) {
            const loteSiesa = filaSiesa[3];
            const objFactura = construirObjetoFactura(
                filaSiesa,
                "SIN_DOC", // documento
                loteSiesa, // loteDoc 
                "SIN_REF", // referenciaDoc
                datosSoportes
            );

            huerfanasSiesa.push({
                documento: "SIN_DOC",
                referencia: objFactura.referencia || "SIN_REF",
                lote: loteSiesa || "",
                fuente: "SIESA (Sin origen/Lote inválido)",
                datosSiesa: [objFactura]
            });
            facturasProcesadasSiesa.add(factura);
        }
    });

    datosCombinados.push(...huerfanasSiesa);

    // Estadísticas
    const totalFacturas = datosCombinados.reduce((sum, item) =>
        sum + (item.datosSiesa?.length || 0), 0);

    const entregadas = datosCombinados.reduce((sum, item) =>
        sum + (item.datosSiesa?.filter(f => f.confirmacion === "ENTREGADO").length || 0), 0);

    const desdeDATA2 = resultadosData2.length;
    const desdeREC = resultadosREC.length;
    const desdeHuerfanas = huerfanasSiesa.length;

    return {
        success: true,
        data: datosCombinados,
        timestamp: new Date().toISOString(),
        count: datosCombinados.length,
        metadata: {
            totalFacturas: totalFacturas,
            entregadas: entregadas,
            pendientes: totalFacturas - entregadas,
            documentosDesdeDATA2: desdeDATA2,
            documentosDesdeREC: desdeREC,
            documentosHuerfanos: desdeHuerfanas,
            lotesProcesados: lotesProcesados.size,
            estadisticas: `Documentos: ${datosCombinados.length} | Facturas: ${totalFacturas} | Entregadas: ${entregadas}`
        }
    };
}

// Procesar fuente DATA2
function procesarFuenteDATA2(datosData2, datosSiesa, datosSoportes, lotesProcesados, facturasProcesadasSiesa) {
    const resultados = [];

    datosData2.forEach(item => {
        const documento = "REC" + item.documento;
        const referencia = item.referencia;
        const lote = item.lote;
        const loteKey = `${documento}_${lote}`;

        if (lotesProcesados.has(loteKey)) return;

        const facturasSiesa = buscarFacturasPorLote(datosSiesa, lote);

        if (facturasSiesa.length > 0) {
            lotesProcesados.add(loteKey);

            const datosRelacionados = facturasSiesa.map(factura => {
                const numFactura = factura[1];
                if (facturasProcesadasSiesa && numFactura) facturasProcesadasSiesa.add(numFactura);

                return construirObjetoFactura(
                    factura,                    // Fila de SIESA
                    documento,                   // Documento REC
                    lote,                        // Lote del documento
                    referencia,                   // Referencia del documento
                    datosSoportes                  // Mapa de soportes (POR FACTURA)
                );
            });

            resultados.push({
                documento: documento,
                referencia: referencia,
                lote: lote,
                fuente: "DATA2",
                datosSiesa: datosRelacionados
            });
        }
    });

    return resultados;
}

// Procesar fuente REC
function procesarFuenteREC(datosRec, datosSiesa, datosSoportes, lotesProcesados, facturasProcesadasSiesa) {
    const resultados = [];

    datosRec.forEach(item => {
        const documento = item[0];
        const referencia = item[1];
        const lote = item[2];
        const loteKey = `${documento}_${lote}`;

        if (lotesProcesados.has(loteKey)) return;

        const facturasSiesa = buscarFacturasPorLote(datosSiesa, lote);

        if (facturasSiesa.length > 0) {
            lotesProcesados.add(loteKey);

            const datosRelacionados = facturasSiesa.map(factura => {
                const numFactura = factura[1];
                if (facturasProcesadasSiesa && numFactura) facturasProcesadasSiesa.add(numFactura);

                return construirObjetoFactura(
                    factura,
                    documento,
                    lote,
                    referencia,
                    datosSoportes
                );
            });

            resultados.push({
                documento: documento,
                referencia: referencia,
                lote: lote,
                fuente: "REC",
                datosSiesa: datosRelacionados
            });
        }
    });

    return resultados;
}

// Buscar facturas por lote en SIESA
function buscarFacturasPorLote(datosSiesa, loteBuscado) {
    return datosSiesa.filter(fila => {
        const loteSiesa = fila[3];
        return String(loteSiesa).trim() === String(loteBuscado).trim();
    });
}

// Construir objeto de factura completo
function construirObjetoFactura(filaSiesa, documento, loteDoc, referenciaDoc, datosSoportes) {
    // ===========================================
    // 1. EXTRACCIÓN DE DATOS DE SIESA
    // ===========================================
    const codProveedor = Number(filaSiesa[4]);
    let nombreProveedor = filaSiesa[4];

    // Mapeo de códigos de proveedor
    if (codProveedor === 5) {
        nombreProveedor = "TEXTILES Y CREACIONES EL UNIVERSO SAS";
    } else if (codProveedor === 3) {
        nombreProveedor = "TEXTILES Y CREACIONES LOS ANGELES SAS";
    }

    // Datos básicos
    const factura = filaSiesa[1];                    // ← IDENTIFICADOR PRINCIPAL
    const fechaFactura = filaSiesa[2];
    const loteSiesa = filaSiesa[3];
    const cliente = filaSiesa[5];
    const nitCliente = filaSiesa[9] || '';

    // ===========================================
    // 2. DATOS AGREGADOS (de SIESA_V2)
    // ===========================================
    // NOTA: filaSiesa[7] ahora es un ARRAY de referencias
    const referenciasArray = Array.isArray(filaSiesa[7]) ? filaSiesa[7] : [];
    const cantidadTotal = filaSiesa[8] || 0;
    const valorBruto = filaSiesa[6] || 0;

    // Determinar la referencia FINAL
    let referenciaFinal;
    if (referenciasArray.length === 1) {
        referenciaFinal = referenciasArray[0]; // Una sola referencia
    } else if (referenciasArray.length > 1) {
        referenciaFinal = "RefVar"; // Múltiples referencias
    } else {
        referenciaFinal = referenciaDoc; // Fallback al documento
    }

    // ===========================================
    // 3. VERIFICACIÓN DE SOPORTE (POR FACTURA)
    // ===========================================
    let confirmacion = "";
    let ih3 = "";
    let fechaEntrega = "";

    if (factura && datosSoportes && datosSoportes[factura]) {
        const soporte = datosSoportes[factura];
        confirmacion = "ENTREGADO";

        if (soporte.imageId) {
            // Detectar si es URL completa o solo ID de Google Drive
            ih3 = soporte.imageId.includes('http') 
              ? soporte.imageId 
              : BASE_IMAGE_URL + soporte.imageId;
        }

        fechaEntrega = soporte.fechaEntrega || "";

        // ===========================================
        // 4. VALIDACIONES (solo warnings, no bloquean)
        // ===========================================
        if (soporte.cantidad && String(soporte.cantidad) !== String(cantidadTotal)) {
            console.warn(`⚠️ Discrepancia cantidad en factura ${factura}:`, {
                siesa: cantidadTotal,
                soporte: soporte.cantidad
            });
        }

        // Solo validar referencia si NO es RefVar
        const normSiesaRef = String(referenciaFinal || '').replace(/^0+/, '');
        const normSoporteRef = String(soporte.referencia || '').replace(/^0+/, '');

        if (referenciaFinal !== "RefVar" &&
            soporte.referencia &&
            normSoporteRef !== normSiesaRef) {
            console.warn(`⚠️ Discrepancia referencia en factura ${factura}:`, {
                siesa: referenciaFinal,
                soporte: soporte.referencia
            });
        }

        // Validar NIT (opcional)
        if (soporte.nit && String(soporte.nit) !== String(nitCliente)) {
            console.warn(`⚠️ Discrepancia NIT en factura ${factura}:`, {
                siesa: nitCliente,
                soporte: soporte.nit
            });
        }
    }

    // ===========================================
    // 5. CONSTRUCCIÓN DEL OBJETO FINAL
    // ===========================================
    return {
        // Datos SIESA
        estado: filaSiesa[0],
        factura: factura,                    // ← LLAVE PRINCIPAL
        fecha: fechaFactura,
        fechaEntrega: fechaEntrega,

        // Datos del producto
        lote: loteSiesa || loteDoc,
        proovedor: nombreProveedor,
        cliente: cliente,
        nit: nitCliente,

        // Datos agregados
        valorBruto: valorBruto,
        referencia: referenciaFinal,          // ← Puede ser "RefVar"
        cantidad: cantidadTotal,

        // Datos de confirmación
        confirmacion: confirmacion,
        Ih3: ih3,
    };
}

// Función para obtener datos de Sheets API
async function obtenerDatosDeSheet(spreadsheetId, range) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${API_KEY}`;

    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status} en ${range}`);
        }
        const data = await response.json();
        return data.values || [];
    } catch (error) {
        console.error(`Error obteniendo datos de ${spreadsheetId} - ${range}:`, error);
        return [];
    }
}

let _entregasIngresosCache = null;

// Helper con paginación por bloques para consultar la totalidad de la tabla ingresos de Supabase en ENTREGAS
async function fetchIngresosSupabaseForEntregas() {
    if (_entregasIngresosCache && Array.isArray(_entregasIngresosCache) && _entregasIngresosCache.length > 0) {
        return _entregasIngresosCache;
    }

    const PAGE_SIZE = 1000;
    let allRows = [];
    let offset = 0;

    let token = CONFIG.SUPABASE_ANON_KEY;
    try {
        if (window.supabase?.auth) {
            const { data: { session } } = await window.supabase.auth.getSession();
            if (session?.access_token) token = session.access_token;
        }
    } catch (e) { }

    while (true) {
        try {
            const url = `${CONFIG.SUPABASE_URL}/rest/v1/ingresos?select=*`;
            const res = await fetch(url, {
                headers: {
                    'apikey': CONFIG.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Range': `${offset}-${offset + PAGE_SIZE - 1}`,
                    'Range-Unit': 'items'
                }
            });

            if (!res.ok) {
                console.error(`HTTP error ${res.status} al consultar ingresos en ENTREGAS:`, await res.text());
                break;
            }

            const rows = await res.json();
            if (!Array.isArray(rows)) break;
            allRows = allRows.concat(rows);

            if (rows.length < PAGE_SIZE) break;
            offset += PAGE_SIZE;
        } catch (e) {
            console.error('Error cargando ingresos en ENTREGAS:', e);
            break;
        }
    }

    _entregasIngresosCache = allRows;
    return _entregasIngresosCache;
}

// Obtener datos de DATA2 desde la tabla ingresos de Supabase
async function obtenerDatosDeData2() {
    try {
        const rows = await fetchIngresosSupabaseForEntregas();

        return rows.reduce((filtrados, r) => {
            const tipo = String(r.tipo || '').toUpperCase();

            // Incluir todos los registros de la tabla ingresos (TIPO FULL o sin tipo explicito)
            if (tipo === 'FULL' || !r.tipo) {
                let anexos = r.anexos;
                if (typeof anexos === 'string') {
                    try { anexos = JSON.parse(anexos); } catch (e) { anexos = []; }
                }
                if (!Array.isArray(anexos)) anexos = [];

                let rawDoc = String(r.id_ingreso || r.documento || r.id || '');
                if (rawDoc.toUpperCase().startsWith('REC')) {
                    rawDoc = rawDoc.substring(3);
                }

                filtrados.push({
                    documento: rawDoc,
                    referencia: String(r.referencia || r.refprov || ''),
                    lote: String(r.lote || ''),
                    proveedor: String(r.proveedor || r.productora || ''),
                    anexos: anexos,
                    tipo: r.tipo || 'FULL'
                });
            }
            return filtrados;
        }, []);

    } catch (error) {
        console.error("Error en obtenerDatosDeData2:", error);
        return [];
    }
}

// Obtener datos de REC filtrados desde la tabla ingresos de Supabase
async function obtenerDatosRecFiltrados() {
    try {
        const rows = await fetchIngresosSupabaseForEntregas();

        return rows.reduce((filtrados, r) => {
            const tipo = String(r.tipo || '').toUpperCase();
            const fuente = String(r.fuente || '').toUpperCase();
            const tieneReferencia = Boolean(r.referencia || r.refprov);
            const tieneLote = Boolean(r.lote);

            if ((tipo === 'FULL' || !r.tipo) && (fuente === 'BUSINT' || fuente === 'REC') && tieneReferencia && tieneLote) {
                filtrados.push([
                    String(r.id_ingreso || r.documento || r.id || ''),
                    String(r.referencia || r.refprov || ''),
                    String(r.lote || ''),
                    String(r.linea || r.taller || '')
                ]);
            }
            return filtrados;
        }, []);

    } catch (error) {
        console.error("Error en obtenerDatosRecFiltrados:", error);
        return [];
    }
}

async function obtenerDatosSoportes() {
    try {
        // Obtener sesión actual para autenticación
        const { data: { session } } = await window.supabase.auth.getSession();
        
        if (!session) {
            console.error('❌ No hay sesión activa');
            return {};
        }
        
        // El backend maneja la paginación automáticamente
        const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/delivery-operations?action=get`, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.entregas || result.entregas.length === 0) {
            return {};
        }

        // Mapa principal: POR FACTURA (NO por clave compuesta)
        const mapaSoportes = {};

        result.entregas.forEach((entrega) => {
            const factura = String(entrega.Factura || '').trim();
            if (factura) {
                mapaSoportes[factura] = {
                    fechaEntrega: entrega.Registro,
                    imageId: entrega.Url_Ih3 || '',
                    estado: 'ENTREGADO',
                    documento: entrega.Documento,
                    lote: entrega.Lote,
                    referencia: entrega.Referencia,
                    cantidad: entrega.Cantidad,
                    nit: entrega.Nit,
                    usuario: entrega.Usuario,
                    _id: entrega.id,
                    _timestamp: new Date().toISOString()
                };
            }
        });

        return mapaSoportes;

    } catch (error) {
        console.error("❌ Error en obtenerDatosSoportes:", error);
        return {};
    }
}

// Obtener datos de SIESA (principal fuente de facturas)
async function obtenerDatosSiesaSupabase() {
    try {
        // Obtener sesión actual para autenticación
        const { data: { session } } = await window.supabase.auth.getSession();
        
        if (!session) {
            console.error('❌ No hay sesión activa para SIESA');
            return [];
        }

        // Definir rango de fechas (90 días atrás hasta hoy para asegurar cobertura)
        const hoy = new Date();
        const hace90Dias = new Date();
        hace90Dias.setDate(hoy.getDate() - 90);

        const fechaInicio = hace90Dias.toISOString().split('T')[0];
        const fechaFin = hoy.toISOString().split('T')[0];

        // Usar la misma Edge Function que el panel de Siesa
        const url = `${SUPABASE_FUNCTIONS_URL}/delivery-operations?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.success || !result.data) {
            return [];
        }

        // Mapeo de clientes a NIT
        const mapaClientes = typeof CLIENTS_MAP !== 'undefined' ? CLIENTS_MAP : {};

        return result.data.map(f => {
            const refs = f.referencias_detalle 
                ? (typeof f.referencias_detalle === 'string' ? JSON.parse(f.referencias_detalle) : f.referencias_detalle).map(d => d.referencia)
                : [f.Referencia];

            return [
                f.Estado || 'Aprobadas',
                f['Nro documento'],
                f.Fecha,
                f.op || '',
                f.compania || '',
                f['Razón social cliente factura'],
                f['Valor subtotal local'] || 0,
                refs,
                f['Cantidad inv.'] || 0,
                mapaClientes[f['Razón social cliente factura']] || ""
            ];
        });

    } catch (error) {
        console.error("❌ Error en obtenerDatosSiesaSupabase:", error);
        return [];
    }
}

// Función antigua de Sheets (Mantener comentada o como fallback si fuera necesario)
/*
async function obtenerDatosSiesa() {
    // ... (código anterior)
}
*/

// Funciones helper
function formatearFecha(fechaStr) {
    if (!fechaStr || typeof fechaStr !== 'string') return fechaStr;
    const partes = fechaStr.split('/');
    return partes.length === 3 ? `${partes[1]}/${partes[0]}/${partes[2]}` : fechaStr;
}

function obtenerConfirmacionIh3(soportesMap, documento, lote, referencia, cantidad, nit) {
    const clave = `${documento}_${lote}_${referencia}_${cantidad}_${nit}`.trim();

    if (!soportesMap[clave]) {
        return { confirmacion: "", ih3: "", fechaEntrega: "" };
    }

    const soporte = soportesMap[clave];
    const confirmacion = soporte.factura ? "ENTREGADO" : "ENTREGADO, PENDIENTE FACTURA";
    // Detectar si es URL completa o solo ID de Google Drive
    const ih3 = soporte.imageId 
      ? (soporte.imageId.includes('http') ? soporte.imageId : BASE_IMAGE_URL + soporte.imageId)
      : "";

    return { confirmacion, ih3, fechaEntrega: soporte.fechaEntrega || "" };
}

// Función para exportar datos
function exportarDatosComoJSON(datos) {
    try {
        const jsonStr = JSON.stringify(datos, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `datos_facturados_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    } catch (error) {
        console.error("Error exportando datos:", error);
        return false;
    }
}

// Ejemplo de uso
async function ejecutarYMostrarResultados() {
    console.log("=== EJECUTANDO OBTENCIÓN DE DATOS FACTURADOS ===");
    const resultado = await obtenerDatosFacturados();

    if (resultado.success) {
        console.log("✅ Proceso completado exitosamente");
        console.log(`📊 Documentos procesados: ${resultado.count}`);
        console.log(`🧾 Facturas encontradas: ${resultado.metadata.totalFacturas}`);
        console.log(`📈 Origen: ${resultado.metadata.estadisticas}`);
        console.log("📝 Estructura del resultado:");
        console.log(resultado);

        // Opcional: exportar automáticamente
        // exportarDatosComoJSON(resultado);

        return resultado;
    } else {
        console.error("❌ Error en el proceso:", resultado.error);
        return resultado;
    }
}

// Si se ejecuta directamente (Node.js o navegador)
if (typeof window !== 'undefined') {
    // Navegador - exponer funciones globalmente
    window.obtenerDatosFacturados = obtenerDatosFacturados;
    window.ejecutarYMostrarResultados = ejecutarYMostrarResultados;
    window.exportarDatosComoJSON = exportarDatosComoJSON;

    console.log("principal.js cargado - funciones disponibles:");
    console.log("- obtenerDatosFacturados()");
    console.log("- ejecutarYMostrarResultados()");
    console.log("- exportarDatosComoJSON(datos)");
}

// Export para Node.js (si se usa con módulos)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        obtenerDatosFacturados,
        ejecutarYMostrarResultados,
        exportarDatosComoJSON,
        combinarDatosFacturados,
        obtenerDatosDeData2,
        obtenerDatosSiesa,
        obtenerDatosRecFiltrados,
        obtenerDatosSoportes
    };
}
