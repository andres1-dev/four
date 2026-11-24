let currentFileInput = null;
let lastCsvRows = null; // Guardar las filas para re-procesar sin recargar archivo

async function processCSV() {
    const fileInput = document.getElementById('csvFile');
    currentFileInput = fileInput;

    // Si no hay archivos y tenemos datos previos, re-procesamos lo que ya tenemos
    if (!fileInput.files.length && lastCsvRows) {
        return reprocessLastCsv();
    }

    if (!fileInput.files.length) {
        showMessage('Por favor selecciona un archivo CSV o Excel para procesar', 'error', 2000);
        return;
    }

    const file = fileInput.files[0];
    const ext  = file.name.split('.').pop().toLowerCase();

    // ── Excel: delegar a excel-processor ──
    if (ext === 'xlsx' || ext === 'xls') {
        fileInput.value = '';
        return processExcel(file);
    }

    // ── CSV normal ──
    const loading = showQuickLoading('Procesando archivo CSV...');
    const processBtn = document.getElementById('processBtn');

    // Reset de estado visual antes de empezar
    if (processBtn) {
        processBtn.disabled = true;
        processBtn.innerHTML = '<span class="loading-spinner"></span> Procesando...';
    }

    updateStatus('Procesando archivo CSV...', 'loading');

    const reader = new FileReader();

    reader.onload = async function (e) {
        // Limpiar inputs para permitir re-carga del mismo archivo
        fileInput.value = '';

        try {
            // Limpiar datos previos
            setCurrentOPData(null);

            // Ocultar paneles previos para un "nuevo" procesamiento
            const exportBtn = document.getElementById('exportBtn');
            const pendientesSection = document.getElementById('pendientesSection');
            const opPreview = document.getElementById('opPreview');
            const opForm = document.getElementById('opForm');
            const opEditorContainer = document.getElementById('opEditorContainer');
            const opEditorEmptyState = document.getElementById('opEditorEmptyState');

            if (exportBtn) exportBtn.style.display = 'none';
            if (pendientesSection) pendientesSection.style.display = 'none';
            if (opEditorContainer) opEditorContainer.style.display = 'none';
            if (opEditorEmptyState) opEditorEmptyState.style.display = 'block';

            // Reset de contenido de previsualización
            if (opPreview) {
                opPreview.innerHTML = `
                    <div class="empty-state">
                        <i class="fa-solid fa-magnifying-glass empty-icon"></i>
                        <h5>Sin vista previa</h5>
                        <p>Selecciona una OP del listado para ver sus detalles.</p>
                    </div>
                `;
            }
            if (opForm) opForm.style.display = 'none';

            const csvContent = e.target.result;
            const rows = parseCSV(csvContent);
            lastCsvRows = rows; // Guardar para futuros re-procesamientos

            if (rows.length === 0) {
                throw new Error('El archivo CSV está vacío o no tiene datos válidos');
            }

            const completed = await processCSVData(rows);

            if (completed) {
                const isReprocess = loading._isReprocess;
                showMessage(
                    isReprocess
                        ? `CSV reprocesado - ${processedData.length} registros actualizados`
                        : `Procesamiento completado - ${processedData.length} registros procesados`,
                    'success', 2000
                );
            }

        } catch (error) {
            console.error('Error procesando CSV:', error);
            showMessage('Error al procesar archivo: ' + error.message, 'error', 3000);
        } finally {
            loading.close();
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = '<i class="codicon codicon-play"></i> Procesar CSV';
            }
            // No sobrescribir el status-bar - displayResultsSummary ya lo configuró
        }
    };

    reader.onerror = function () {
        loading.close();
        showMessage('Error de lectura - No se pudo leer el archivo CSV', 'error', 3000);
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.innerHTML = '<i class="codicon codicon-play"></i> Procesar CSV';
        }
    };

    try {
        reader.readAsText(file, 'UTF-8');
    } catch (err) {
        console.error('Error al iniciar lectura:', err);
        loading.close();
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.innerHTML = '<i class="codicon codicon-play"></i> Procesar CSV';
        }
    }
}

/**
 * Re-procesa las últimas filas del CSV cargado
 * Útil después de guardar una OP o corregir datos
 */
async function reprocessLastCsv() {
    if (!lastCsvRows) return false;

    const loading = showQuickLoading('Actualizando lista de OPs...');
    try {
        const completed = await processCSVData(lastCsvRows);
        return completed;
    } catch (error) {
        console.error('Error al re-procesar CSV:', error);
        return false;
    } finally {
        loading.close();
    }
}

async function processCSVData(rows) {
    Logger.info('data-processing', `Iniciando procesamiento de CSV. Traslados anulados: ${cancelledTransfers.size}, Usuarios activos: ${escanersMap.size}`);

    // ── Pre-paso: escanear el CSV completo y extraer SOLO los IDs necesarios ──
    // Luego hacer fetch on-demand de colores, precios, historicas, data2 y sispro
    // con exactamente esos IDs — sin traer catálogos completos.
    const lotesEnCsv     = new Set();
    const coloresEnCsv   = new Set();
    const referenciasEnCsv = new Set();
    const refprovsEnCsv  = new Set();

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 38) continue;

        const tipo    = row[3] || '';
        const bodega  = row[14] || '';
        const usuario = row[1] || '';
        if (!escanersMap.has(usuario) || tipo !== 'TR' || bodega === 'PR') continue;

        const op          = (row[2]  || '').trim();
        const codColor    = (row[12] || '').trim();
        const referencia  = (row[0]  || '').trim();
        // refprov se extrae del final de la descripción larga (col 21)
        const descLarga   = (row[21] || '').trim();
        const refprovMatch = descLarga.match(/(\d+)\s*$/);
        const refprov      = refprovMatch ? refprovMatch[1] : referencia;

        if (op)         lotesEnCsv.add(op);
        if (codColor)   coloresEnCsv.add(codColor);
        if (referencia) referenciasEnCsv.add(referencia);
        // Para historicas necesitamos tanto la refprov extraída de la descripción
        // como la referencia interna (col 0) — getReferenciaHistorica busca por ambas
        if (refprov)    refprovsEnCsv.add(refprov);
        if (referencia) refprovsEnCsv.add(referencia); // también buscar por ref interna
    }

    if (lotesEnCsv.size > 0) {
        const lotesArr = Array.from(lotesEnCsv);

        // CSV siempre corresponde a Universo — asegurar proveedor correcto
        const UNIVERSO_ID     = '900616124';
        const UNIVERSO_NOMBRE = 'TEXTILES Y CREACIONES EL UNIVERSO SAS';
        const actual = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
        const cambiandoProveedor = !actual || actual.id !== UNIVERSO_ID;

        if (cambiandoProveedor && typeof setProveedorActivo === 'function') {
            setProveedorActivo(UNIVERSO_ID, UNIVERSO_NOMBRE);
            Logger.info('data-processing', `🏢 Proveedor cambiado a Universo para CSV`);
        }

        // Fetch estrictamente on-demand — solo los IDs que están en el archivo
        const [, , coloresResult, preciosResult, historicasResult] = await Promise.all([
            loadData2Data(lotesArr),
            loadSisproData(lotesArr),
            typeof loadColoresByIds === 'function'
                ? loadColoresByIds(Array.from(coloresEnCsv), UNIVERSO_ID)
                : Promise.resolve(new Map()),
            typeof loadPreciosByRefs === 'function'
                ? loadPreciosByRefs(Array.from(referenciasEnCsv))
                : Promise.resolve(new Map()),
            typeof loadHistoricasByRefprovs === 'function'
                ? loadHistoricasByRefprovs(Array.from(refprovsEnCsv), UNIVERSO_ID)
                : Promise.resolve(new Map())
        ]);

        // Actualizar mapas globales con SOLO los datos del archivo
        if (coloresResult instanceof Map) {
            window.coloresMap.clear();
            coloresResult.forEach((v, k) => window.coloresMap.set(k, v));
        }
        if (preciosResult instanceof Map) {
            window.preciosMap.clear();
            preciosResult.forEach((v, k) => window.preciosMap.set(k, v));
        }
        if (historicasResult instanceof Map) {
            window.historicasMap.clear();
            historicasResult.forEach((v, k) => window.historicasMap.set(k, v));
        }

        if (cambiandoProveedor) {
            Logger.info('data-processing', `✅ Datos cargados on-demand para Universo`);
            if (typeof showMessage              === 'function') showMessage(`Proveedor: ${UNIVERSO_NOMBRE}`, 'info', 2500);
            if (typeof updateProveedorIndicator === 'function') updateProveedorIndicator();
            if (typeof updateDataStats          === 'function') updateDataStats();
        }

        Logger.info('data-processing',
            `On-demand CSV — Lotes:${lotesEnCsv.size} Colores:${coloresResult.size} ` +
            `Precios:${preciosResult.size} Históricos:${historicasResult.size} ` +
            `(refprovs consultadas: ${refprovsEnCsv.size})`
        );
    }
    // ────────────────────────────────────────────────────────────────────────────────────

    const prDataMap = new Map();
    const groupedDataMap = new Map();
    const opErrors = new Map();

    // First pass: collect PR data - OPTIMIZADO con early exit
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 38) continue;

        const usuario = row[1] || '';
        const bodega = row[14] || '';
        const tipo = row[3] || '';

        // Verificar si el usuario existe en el mapa de escaners
        const usuarioValido = escanersMap.has(usuario);

        if (!usuarioValido || bodega !== 'PR' || tipo !== 'TR') continue;

        const key = `${row[2]}|${row[11]}|${row[12]}`;
        prDataMap.set(key, {
            COSTO: parseFloat(row[10]) || 0,
            OS: extractOSNumber(row[13] || ''),
            CC: row[37] || ''
        });
    }

    const missingColors = new Set();

    // ── Pre-validación de OPs y Parciales a nivel global de OP ──
    // Calcula la sumatoria real de unidades y conjunto de traslados de cada OP en este CSV

    // Construir mapa de traslados ya guardados en BD por lote (desde data2JsonMap)
    // para filtrar del CSV las filas que ya fueron subidas en parciales anteriores
    const trasladosEnBdPorOp = new Map();
    const mapaJsonGlobal = window.data2JsonMap || (typeof data2JsonMap !== 'undefined' ? data2JsonMap : null);
    if (mapaJsonGlobal) {
        mapaJsonGlobal.forEach((registros, loteKey) => {
            const setTrasladosBd = new Set();
            registros.forEach(reg => {
                const t = (reg.TRASLADO || '').toString().trim();
                if (t) setTrasladosBd.add(t);
                if (reg.OTROS_TRASLADOS && Array.isArray(reg.OTROS_TRASLADOS)) {
                    reg.OTROS_TRASLADOS.forEach(ot => {
                        const otStr = ot.toString().trim();
                        if (otStr) setTrasladosBd.add(otStr);
                    });
                }
                if (reg.ANEXOS && Array.isArray(reg.ANEXOS)) {
                    reg.ANEXOS.forEach(a => {
                        const at = (a.TRASLADO || '').toString().trim();
                        if (at) setTrasladosBd.add(at);
                    });
                }
            });
            if (!trasladosEnBdPorOp.has(loteKey)) trasladosEnBdPorOp.set(loteKey, new Set());
            setTrasladosBd.forEach(t => trasladosEnBdPorOp.get(loteKey).add(t));
        });
    }

    const opTotalesEnCsv = new Map();
    const opTrasladosEnCsv = new Map();
    const opTotalGeneralEnCsv = new Map();

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 38) continue;

        const usuario = row[1] || '';
        const bodega = row[14] || '';
        const tipo = row[3] || '';
        const usuarioValido = escanersMap.has(usuario);

        if (!usuarioValido || tipo !== 'TR') continue;

        const op = (row[2] || '').trim();
        if (!op) continue;

        const trasladoOriginal = row[7] || '';
        const trasladoNum = extractTrasladoNumber(trasladoOriginal);

        // Saltar filas cuyo traslado ya está guardado en BD (pertenecen a un parcial anterior)
        const trasladosBdOp = trasladosEnBdPorOp.get(op);
        if (trasladoNum && trasladosBdOp && trasladosBdOp.has(trasladoNum)) continue;

        if (!opTrasladosEnCsv.has(op)) opTrasladosEnCsv.set(op, new Set());
        if (trasladoNum) opTrasladosEnCsv.get(op).add(trasladoNum);

        if (row[19] && !opTotalGeneralEnCsv.has(op)) {
            opTotalGeneralEnCsv.set(op, (row[19] || '').toString().trim());
        }

        // Sumar solo filas que no son PR (las que realmente ingresan prendas)
        if (bodega !== 'PR') {
            const cant = parseFloat(row[9]) || 0;
            opTotalesEnCsv.set(op, (opTotalesEnCsv.get(op) || 0) + cant);
        }
    }

    // Pre-ejecutar validación de parciales por cada OP completa
    const opValidaciones = new Map();
    opTrasladosEnCsv.forEach((trasladosSet, op) => {
        const totalGen = opTotalGeneralEnCsv.get(op) || '';
        const totalCant = opTotalesEnCsv.get(op) || 0;
        const validacion = validarEstadoParcial(op, Array.from(trasladosSet), totalGen, totalCant);
        opValidaciones.set(op, validacion);
    });

    // Second pass: process TR data and group duplicates - OPTIMIZADO
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 38) continue;

        const usuario = row[1] || '';
        const bodega = row[14] || '';
        const tipo = row[3] || '';

        // Verificar si el usuario existe en el mapa de escaners
        const usuarioValido = escanersMap.has(usuario);

        // Early exit: verificar condiciones básicas primero
        if (!usuarioValido || bodega === 'PR' || tipo !== 'TR') continue;

        // Verificar traslado anulado
        const trasladoOriginal = row[7] || '';
        const trasladoExtraido = extractTrasladoNumber(trasladoOriginal);
        if (cancelledTransfers.has(trasladoOriginal) || cancelledTransfers.has(trasladoExtraido)) {
            Logger.info('data-processing', `Traslado anulado detectado y excluido: ${trasladoOriginal}`);
            continue;
        }

        const op = (row[2] || '').trim();

        // Saltar filas cuyo traslado ya está en BD (pertenecen a un parcial ya subido)
        const trasladosBdOp2 = trasladosEnBdPorOp.get(op);
        if (trasladoExtraido && trasladosBdOp2 && trasladosBdOp2.has(trasladoExtraido)) {
            Logger.info('data-processing', `Fila ignorada — traslado ${trasladoExtraido} de OP ${op} ya está en BD`);
            continue;
        }
        const codColorOriginal = (row[12] || '').trim();
        const talla = row[11] || '';
        const referencia = (row[0] || '').trim();
        const descripcionLarga = normalizeText(row[21] || '');

        // Validaciones directas (sin cache)
        let hasError = false;

        // Validar color (ÚNICA VALIDACIÓN REQUERIDA)
        if (codColorOriginal && !coloresMap.has(codColorOriginal)) {
            missingColors.add(codColorOriginal);
            hasError = true;
        }

        if (hasError) {
            // No agregamos errores a opErrors aquí para permitir el flujo del modal
            continue;
        }

        const groupKey = `${op}|${referencia}|${talla}|${codColorOriginal}|${bodega}`;
        const prKey = `${row[2]}|${row[11]}|${row[12]}`;
        const prData = prDataMap.get(prKey);

        const { prenda: extractedPrenda, genero: extractedGenero } = extractPrendaGeneroFromDescripcion(descripcionLarga);
        
        // Intentar traer datos de SISPROWEB si existen
        const sisproInfo = (window.sisproMap && window.sisproMap.has(op)) ? window.sisproMap.get(op) : null;
        
        if (sisproInfo) {
            Logger.info('data-processing', `✅ OP ${op} encontrada en SISPRO: Linea=${sisproInfo.LINEA}`);
        } else {
            Logger.warn('data-processing', `❓ OP ${op} NO encontrada en SISPRO (${window.sisproMap?.size || 0} registros cargados)`);
        }
        
        const prenda = sisproInfo?.PRENDA || extractedPrenda || normalizeText(row[23] || '');
        const genero = sisproInfo?.GENERO || extractedGenero;
        
        // LÍNEA: Prioridad 1: SISPRO (tabla master), Prioridad 2: fallback por NIT del proveedor
        let linea = sisproInfo?.LINEA || '';
        if (!linea) {
            const provActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
            const nitActivo = provActivo ? (provActivo.id || '').toString() : '';
            if (nitActivo === '901920844') linea = 'INVERSIONES';
            else if (nitActivo === '900692469') linea = 'ANGELES';
            else if (nitActivo === '900616124') linea = '';  // Universo → sin línea por defecto
            // Si no hay NIT reconocido ni dato en SISPRO, dejar vacío para que el usuario lo complete
        }

        // COSTO: siempre usa el costo unitario de PR (DI/PRIMERAS)
        // Solo SIN CONFECCIONAR (ZY) tiene costo 0
        let costo = 0;
        if (bodega !== 'ZY' && prData) costo = prData.COSTO;

        const cantidad = parseFloat(row[9]) || 0;

        if (groupedDataMap.has(groupKey)) {
            const existing = groupedDataMap.get(groupKey);
            existing.CANTIDAD += cantidad;
            // NO acumular el costo - es un costo UNITARIO, se mantiene igual
        } else {
            // Cálculos directos (sin cache)
            const estado = validarEstado(op, formatDate(row[4]), (row[19] || '').toString().trim());
            
            // Validación de repetidos y detección de parciales
            const validacionParcial = opValidaciones.get(op) || validarEstadoParcial(op, extractTrasladoNumber(row[7] || ''), row[19] || '', cantidad);
            
            // Si es rechazado (duplicado de traslado o lote completo), registrar y descartar
            if (validacionParcial.rechazar) {
                Logger.warn('data-processing', `OP ${op} rechazada: ${validacionParcial.tipo} - ${validacionParcial.mensaje}`);
                if (!opErrors.has(op)) {
                    opErrors.set(op, []);
                }
                opErrors.get(op).push(validacionParcial.mensaje);
                continue;
            }
            
            const opConSufijo = validacionParcial.sufijo;
            const esParcial = validacionParcial.esParcial;
            
            const pvp = getPvp(referencia);
            const marca = getMarca(genero);
            const clase = getClaseByPVP(pvp);

            const descripcion = getDescripcion(
                prenda || normalizeText(row[23] || ''),
                genero,
                marca,
                referencia
            );

            groupedDataMap.set(groupKey, {
                REFERENCIA: referencia,
                USUARIO: (escanersMap.get(usuario)?.NOMBRE || usuario),
                OP: op,
                OP_SUFIJO: opConSufijo,
                ES_PARCIAL: esParcial,
                TIPO_VALIDACION: validacionParcial.tipo,
                MENSAJE_VALIDACION: validacionParcial.mensaje,
                TIPO: normalizeTipo(tipo),
                FECHA: formatDate(row[4]),
                TRASLADO: extractTrasladoNumber(row[7] || ''),
                CANTIDAD: cantidad,
                COSTO: formatCosto(costo),
                TOTAL: row[19] || '',
                PVP: pvp,
                TALLA: talla,
                COLORES: getColorName(codColorOriginal),
                COD_COLOR: codColorOriginal,
                OS: prData ? prData.OS : extractOSNumber(row[13] || ''),
                BODEGA: normalizeBodega(bodega),
                TALLER: normalizeText(row[18] || ''),
                DESCRIPCION_LARGA: descripcionLarga,
                PRENDA: prenda || normalizeText(row[23] || ''),
                LINEA: linea,
                GENERO: genero,
                CC: prData ? prData.CC : (row[37] || ''),
                ESTADO: estado,
                MARCA: marca,
                CLASE: clase,
                DESCRIPCION: descripcion
            });
        }
    }

    // Si se detectaron colores faltantes, mostrar modal y detener procesamiento actual
    if (missingColors.size > 0) {
        showMissingDataModal(
            [], // Ya no validamos OPs
            Array.from(missingColors),
            async () => {
                const loading = showQuickLoading('Colores guardados. Re-validando CSV...');
                try {
                    const success = await processCSVData(rows);
                    if (success) {
                        showMessage(`CSV re-procesado exitosamente - ${processedData.length} registros listos`, 'success', 2000);
                    }
                } finally {
                    loading.close();
                }
            }
        );
        return false;
    }

    setProcessedData(Array.from(groupedDataMap.values()));

    // Silenciar errores de OPs rechazadas - no mostrar mensaje al usuario
    // Las OPs rechazadas simplemente no aparecen en el listado

    if (processedData.length === 0) {
        throw new Error('No se encontraron datos válidos para los usuarios especificados con tipo TR');
    }

    displayResultsSummary(processedData);

    const pendientes = processedData.filter(item => item.ESTADO === 'PENDIENTE' || item.ES_PARCIAL);
    const pendientesSection = document.getElementById('pendientesSection');

    if (pendientes.length > 0) {
        setupPendientesSection(pendientes);
        if (pendientesSection) pendientesSection.style.display = 'block';
        const emptyState = document.getElementById('pendingOpsEmptyState');
        if (emptyState) emptyState.style.display = 'none';
        switchToPendingOpsTab();
    } else {
        if (pendientesSection) pendientesSection.style.display = 'none';
        const emptyState = document.getElementById('pendingOpsEmptyState');
        if (emptyState) emptyState.style.display = 'flex';
    }


    // El mensaje de éxito se maneja en los llamadores (processCSV o el callback del modal)
    // para evitar duplicidad, ya que processCSV tiene su propia lógica de mensajes.


    return true;
}