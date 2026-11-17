function initializeApp() {
    // initializeNotifications(); // Opcional si aun existe
    window.distributionInitialized = true;

    // Inicializar pedidosMap vacío inmediatamente
    window.pedidosMap = [];

    // Cargar todos los datos incluyendo la configuración dinámica
    loadDataFromSheets();
    updateStatus('Sistema inicializado correctamente', 'info');
}

async function loadDataFromSheets(silent = false) {
    updateStatus('Cargando datos esenciales...', 'loading');
    statusTimingStart();
    
    const processBtn = document.getElementById('processBtn');
    if (processBtn) {
        processBtn.disabled = true;
        processBtn.innerHTML = '<span class="loading-spinner"></span> Cargando datos...';
    }

    const loading = showQuickLoading('Cargando configuración base...');

    try {
        // Inicializar selector de proveedor con proveedor por defecto
        if (typeof window.initProveedorSelector === 'function') {
            window.initProveedorSelector();
        }

        // UN SOLO Promise.all — solo tablas de configuración ligeras + pedidos
        // COLORES, PRECIOS, HISTORICAS, BARRAS y GLOBAL MAPS ya NO se cargan al inicio.
        // Se cargan estrictamente ON-DEMAND cuando el usuario sube un archivo (CSV o Excel).
        const [pedidos] = await Promise.all([
            // Pedidos - CRÍTICO para distribución, debe cargarse síncronamente
            loadPedidosData(),
            // Config (pequeñas, rápidas) — siempre necesarias para validar escaners
            loadUsuariosData(),
            loadProveedoresData(),
            loadAuditoresData(),
            loadGestoresData()
        ]);

        // Inicializar pedidosMap global inmediatamente con los datos cargados
        window.pedidosMap = pedidos || [];
        Logger.info('app-init', `${window.pedidosMap.length} pedidos cargados en pedidosMap global`);

        // Clientes en background — no bloquea la UI
        loadClientesData().catch(err => Logger.warn('app-init', 'Clientes no cargados en background', err))
            .then(() => updateDataStats());

        Logger.info('app-init', 'Configuración base cargada. Colores/precios/historicas/barras se cargarán al subir un archivo.');

        // Cargar opciones dinámicas en los selects
        if (typeof loadAllDynamicOptions === 'function') {
            loadAllDynamicOptions();
        }

        updateDataStats();
        revealStatItems();
        statusTimingEnd(true);
        updateStatus('Sistema listo', 'success');

        if (!silent) {
            showMessage('Sistema listo - Los módulos se cargarán cuando los abras', 'success', 2000);
        }

    } catch (error) {
        console.error('Error cargando datos:', error);
        statusTimingEnd(false);
        updateStatus('Error cargando datos', 'error');
        showMessage('Error al cargar datos: ' + error.message, 'error', 3000);
    } finally {
        loading.close();
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.innerHTML = '<i class="codicon codicon-play"></i> Procesar CSV';
        }
    }
}

/**
 * Recarga SOLO los datos necesarios después de guardar una OP.
 * Solo recarga DATA2 para los lotes del archivo actual (on-demand),
 * y actualiza los módulos de distribución e impresión si están activos.
 */
async function loadDataAfterSave(silent = true) {
    updateStatus('Sincronizando datos...', 'loading');

    try {
        // Recargar DATA2 solo para los lotes que están en el CSV/Excel actual en memoria
        const lotesActuales = (typeof processedData !== 'undefined' && Array.isArray(processedData))
            ? [...new Set(processedData.map(d => String(d.OP || '').trim()).filter(Boolean))]
            : [];
        await loadData2Data(lotesActuales);

        // Si el módulo de distribución está activo, refrescarlo (no recarga datos masivos)
        if (window.distributionModuleLoaded) {
            await initializeDistribution();
        }

        // El módulo de impresión es 100% on-demand — no necesita recarga global
        // Solo se refresca si el usuario busca un REC específico.

        updateDataStats();
        updateStatus('Datos sincronizados', 'success');

        if (!silent) {
            showMessage('Datos actualizados correctamente', 'success', 2000);
        }

    } catch (error) {
        console.error('Error sincronizando datos:', error);
        updateStatus('Error sincronizando datos', 'error');
        throw error;
    }
}

/**
 * Carga datos necesarios para el procesador CSV y OPs pendientes.
 * Solo se llaman precios/colores/historicas/barras cuando hay un archivo ya parseado.
 * Esta función existe para compatibilidad; la carga real la hace processCSVData on-demand.
 */
async function loadProcessorModuleData() {
    if (window.processorModuleLoaded) return;
    // Nada que precargar — todo se hace on-demand al subir el archivo
    window.processorModuleLoaded = true;
    Logger.info('app-init', 'Módulo procesador listo (carga on-demand al subir archivo)');
}

/**
 * Carga datos necesarios para el módulo de distribución
 */
async function loadDistributionModuleData() {
    if (window.distributionModuleLoaded) return;
    
    const loading = showQuickLoading('Cargando datos de distribución...');
    try {
        // Asegurar que clientes esté cargado (puede venir del background o necesitar esperar)
        if (!window.clientesMap || window.clientesMap.size === 0) {
            await loadClientesData();
        }
        await initializeDistribution();
        window.distributionModuleLoaded = true;
        updateDataStats();
        Logger.info('app-init', 'Módulo distribución cargado');
    } catch (error) {
        Logger.error('app-init', 'Error cargando módulo distribución', error);
        throw error;
    } finally {
        loading.close();
    }
}

/**
 * Carga datos necesarios para el módulo de impresión.
 * La impresión es 100% on-demand: el usuario escribe un REC y se hace fetch.
 * No hay precarga global.
 */
async function loadPrintingModuleData() {
    if (window.printingModuleLoaded) return;
    
    const loading = showQuickLoading('Inicializando módulo de impresión...');
    try {
        await print_cargarDatos();
        window.printingModuleLoaded = true;
        updateDataStats();
        Logger.info('app-init', 'Módulo impresión inicializado (búsqueda on-demand)');
    } catch (error) {
        Logger.error('app-init', 'Error inicializando módulo impresión', error);
        throw error;
    } finally {
        loading.close();
    }
}

/**
 * Carga datos necesarios para el módulo de pedidos
 */
async function loadOrdersModuleData() {
    if (window.ordersModuleLoaded) return;
    
    const loading = showQuickLoading('Cargando datos de pedidos...');
    try {
        await initOrdersModule();
        window.ordersModuleLoaded = true;
        Logger.info('app-init', 'Módulo pedidos cargado');
    } catch (error) {
        Logger.error('app-init', 'Error cargando módulo pedidos', error);
        throw error;
    } finally {
        loading.close();
    }
}

function updateDataStats() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    // Usar optional chaining — estos mapas pueden estar vacíos al arranque (carga on-demand)
    set('stat-colores',     window.coloresMap?.size    ?? 0);
    set('stat-ops',         window.data2Map?.size      ?? 0);
    set('stat-master',      window.sisproMap?.size     ?? 0);
    set('stat-precios',     window.preciosMap?.size    ?? 0);
    set('stat-productos',   window.barrasMap?.size     ?? 0);
    set('stat-clientes',    window.clientesMap?.size   ?? 0);
    set('stat-usuarios',    window.escanersMap?.size   ?? escanersMap?.size ?? 0);
    set('stat-proveedores', window.proveedoresMap?.size ?? proveedoresMap?.size ?? 0);
    set('stat-auditores',   window.auditoresMap?.size  ?? auditoresMap?.size  ?? 0);
    set('stat-gestores',    window.gestoresMap?.size   ?? gestoresMap?.size   ?? 0);
    set('stat-talleres',    window.globalTalleresMap?.size ?? 0);
}

// ============================================
// EXPORTS
// ============================================

window.initializeApp = initializeApp;
window.loadDataFromSheets = loadDataFromSheets;
window.loadDataAfterSave = loadDataAfterSave;
window.updateDataStats = updateDataStats;
window.loadProcessorModuleData = loadProcessorModuleData;
window.loadDistributionModuleData = loadDistributionModuleData;
window.loadPrintingModuleData = loadPrintingModuleData;
window.loadOrdersModuleData = loadOrdersModuleData;
