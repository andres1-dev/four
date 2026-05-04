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
        console.log("Iniciando obtención de datos facturados...");

        const [datosData2, datosSiesa, datosSoportes, datosRec] = await Promise.all([
            obtenerDatosDeData2(),
            obtenerDatosSiesa(),
            obtenerDatosSoportes(),
            obtenerDatosRecFiltrados()
        ]);

        console.log("Estadísticas iniciales:");
        console.log("- DATA2:", datosData2.length, "registros");
        console.log("- SIESA:", datosSiesa.length, "facturas");
        console.log("- REC:", datosRec.length, "registros FULL");
        console.log("- SOPORTES:", Object.keys(datosSoportes).length, "confirmaciones");

        const resultado = combinarDatosFacturados(datosData2, datosSiesa, datosSoportes, datosRec);

        console.log("Proceso completado exitosamente");
        console.log("Resultado:", resultado.metadata.estadisticas);

        return resultado;

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

    console.log("🔄 Combinando datos...");
    console.log(`📦 DATA2: ${datosData2.length} registros`);
    console.log(`📦 REC: ${datosRec.length} registros`);
    console.log(`✅ Soportes: ${Object.keys(datosSoportes).length} facturas entregadas`);

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

    console.log("📊 Estadísticas finales:");
    console.log(`   - Documentos: ${datosCombinados.length} (DATA2: ${desdeDATA2}, REC: ${desdeREC}, HUÉRFANAS: ${desdeHuerfanas})`);
    console.log(`   - Facturas: ${totalFacturas}`);
    console.log(`   - Entregadas: ${entregadas}`);
    console.log(`   - Pendientes: ${totalFacturas - entregadas}`);

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
        if (referenciaFinal !== "RefVar" &&
            soporte.referencia &&
            String(soporte.referencia) !== String(referenciaFinal)) {
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

// Obtener datos de DATA2
async function obtenerDatosDeData2() {
    try {
        const range = `${SOURCE_SHEET_NAME_DATA2}!${SOURCE_DATA2_COLUMN}:${SOURCE_DATA2_COLUMN}`;
        const allValues = await obtenerDatosDeSheet(SOURCE_SPREADSHEET_ID_DATA2, range);

        return allValues.reduce((filtrados, cellValue, index) => {
            if (!cellValue || !cellValue[0]) return filtrados;

            try {
                const data = JSON.parse(cellValue[0]);
                if (data.TIPO === "FULL") {
                    filtrados.push({
                        documento: data.A?.toString() || '',
                        referencia: data.REFERENCIA || '',
                        lote: data.LOTE?.toString() || '',
                        proveedor: data.PROVEEDOR || '',
                        anexos: data.ANEXOS || [],
                        tipo: data.TIPO
                    });
                }
            } catch (e) {
                console.warn(`Fila ${index + 1} DATA2 no es JSON válido`);
            }
            return filtrados;
        }, []);

    } catch (error) {
        console.error("Error en obtenerDatosDeData2:", error);
        return [];
    }
}

// Obtener datos de REC filtrados
async function obtenerDatosRecFiltrados() {
    try {
        const rangeRec = `${SOURCE_SHEET_NAME_REC}!A2:AB`;
        const allValuesRec = await obtenerDatosDeSheet(SOURCE_SPREADSHEET_ID_REC, rangeRec);

        return allValuesRec
            .filter(row => {
                const tieneReferencia = row[6] && row[6].trim() !== '';
                const esFULL = row[27] && row[27].trim().toUpperCase() === 'FULL';
                const tieneLote = row[8] && row[8].trim() !== '';
                return tieneReferencia && esFULL && tieneLote;
            })
            .map(row => [
                row[0] || '',
                row[6] || '',
                row[8] || '',
                row[3] || ''
            ]);

    } catch (error) {
        console.error("Error en obtenerDatosRecFiltrados:", error);
        return [];
    }
}

async function obtenerDatosSoportes() {
    try {
        console.log('📦 Cargando entregas desde Supabase...');
        
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
            console.log('📊 No hay entregas en Supabase');
            return {};
        }

        console.log(`✅ Recibidas ${result.entregas.length} entregas desde Supabase`);

        // Mapa principal: POR FACTURA (NO por clave compuesta)
        const mapaSoportes = {};

        result.entregas.forEach((entrega, index) => {
            const factura = String(entrega.Factura || '').trim();
            
            // Validación: DEBE tener factura (es lo único realmente obligatorio)
            if (factura) {
                // Si ya existe una factura duplicada, loguear warning
                if (mapaSoportes[factura]) {
                    console.warn(`⚠️ Factura duplicada en soportes: ${factura}`);
                }

                // Guardar por FACTURA (con metadata adicional útil)
                mapaSoportes[factura] = {
                    fechaEntrega: entrega.Registro,
                    imageId: entrega.Url_Ih3 || '', // URL completa de la imagen
                    estado: 'ENTREGADO',
                    // Metadata adicional (útil para validaciones)
                    documento: entrega.Documento,
                    lote: entrega.Lote,
                    referencia: entrega.Referencia,
                    cantidad: entrega.Cantidad,
                    nit: entrega.Nit,
                    usuario: entrega.Usuario,
                    // Para debugging
                    _id: entrega.id,
                    _timestamp: new Date().toISOString()
                };
            }
        });

        console.log(`✅ Procesadas ${Object.keys(mapaSoportes).length} facturas únicas de ${result.entregas.length} registros totales`);
        return mapaSoportes;

    } catch (error) {
        console.error("❌ Error en obtenerDatosSoportes:", error);
        return {};
    }
}

// Obtener datos de SIESA (principal fuente de facturas)
async function obtenerDatosSiesa() {
    try {
        const [siesaData, siesaV2Data] = await Promise.all([
            obtenerDatosDeSheet(SOURCE_SPREADSHEET_ID_SIESA, `${SOURCE_SHEET_NAME_SIESA}!A:G`),
            obtenerDatosDeSheet(SOURCE_SPREADSHEET_ID_SIESA, `${SOURCE_SHEET_NAME_SIESA_2}!A:D`)
        ]);

        // ===========================================
        // 1. PROCESAR AGREGACIONES DE SIESA_V2
        // ===========================================
        const agregaciones = {};
        siesaV2Data.forEach(row => {
            if (row.length >= 3) {
                const key = String(row[0] || '').trim();      // Columna A: Número de factura
                const valor1 = parseFloat(row[1]) || 0;        // Columna B: Valor acumulado
                const valor2 = String(row[2] || '').trim();    // Columna C: Referencia (o "RefVar")
                const valor3 = parseFloat(row[3]) || 0;        // Columna D: Cantidad acumulada

                if (key) {
                    if (!agregaciones[key]) {
                        agregaciones[key] = {
                            sumValor1: valor1,
                            itemsValor2: [valor2],
                            sumValor3: valor3
                        };
                    } else {
                        agregaciones[key].sumValor1 += valor1;
                        agregaciones[key].itemsValor2.push(valor2);
                        agregaciones[key].sumValor3 += valor3;
                    }
                }
            }
        });

        // ===========================================
        // 2. CONFIGURACIÓN DE FILTROS
        // ===========================================
        const estadosExcluir = ["Anuladas", "En elaboración"];
        const prefijosFactura = ["017", "FEV", "029", "FVE"];

        // Mapa de clientes (desde configuracion.js)
        const mapaClientes = typeof CLIENTS_MAP !== 'undefined' ? CLIENTS_MAP : {
            "INVERSIONES URBANA SAS": "901920844",
            "EL TEMPLO DE LA MODA FRESCA SAS": "900047252",
            "EL TEMPLO DE LA MODA SAS": "805027653",
            "ARISTIZABAL LOPEZ JESUS MARIA": "70825517",
            "QUINTERO ORTIZ JOSE ALEXANDER": "14838951",
            "QUINTERO ORTIZ PATRICIA YAMILET": "67006141",
            "ZULUAGA GOMEZ RUBEN ESTEBAN": "1007348825",
            "SON Y LIMON SAS": "900355664"
        };
        const clientesPermitidos = new Set(Object.keys(mapaClientes));

        // ===========================================
        // 3. FILTRAR Y MAPEAR SIESA
        // ===========================================
        return siesaData
            .filter(row => row.length >= 4)
            .filter(row => {
                const estado = row[0] || '';
                return !estadosExcluir.includes(estado);
            })
            .filter(row => {
                const factura = row[1] || '';
                return prefijosFactura.some(prefijo => factura.startsWith(prefijo));
            })
            .map(row => {
                const clienteOriginal = row[3] || '';
                const clienteNormalizado = clienteOriginal
                    .replace(/S\.A\.S\.?/g, 'SAS')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (!clientesPermitidos.has(clienteNormalizado)) {
                    return null;
                }

                const codProveedor = row[6] || '';
                const lote = codProveedor === "5" ? (row[4] || '') :
                    codProveedor === "3" ? (row[5] || '') : '';

                const factura = row[1] || '';

                // Obtener agregaciones para esta factura
                const agregacion = agregaciones[factura] || {
                    sumValor1: 0,
                    itemsValor2: [],
                    sumValor3: 0
                };

                return [
                    row[0],                    // Estado
                    factura,                    // Factura
                    formatearFecha(row[2]),     // Fecha formateada
                    lote,                        // Lote
                    codProveedor,                // Código proveedor
                    clienteNormalizado,           // Cliente normalizado
                    agregacion.sumValor1,         // ← VALOR AGREGADO
                    agregacion.itemsValor2,       // ← ARRAY DE REFERENCIAS (¡NO string!)
                    agregacion.sumValor3,         // ← CANTIDAD AGREGADA
                    mapaClientes[clienteNormalizado] || "" // NIT
                ];
            })
            .filter(row => row !== null);

    } catch (error) {
        console.error("❌ Error en obtenerDatosSiesa:", error);
        return [];
    }
}

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
