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

        // UN SOLO Promise.all — todas las tablas en paralelo simultáneo
        const [pedidos] = await Promise.all([
            // Pedidos - CRÍTICO para distribución, debe cargarse síncronamente
            loadPedidosData(),
            // Config (pequeñas, rápidas)
            loadUsuariosData(),
            loadProveedoresData(),
            loadAuditoresData(),
            loadGestoresData(),
            // Datos operativos
            loadColoresData(),
            loadBarrasData(),
            loadPreciosData(),
            loadHistoricasData(),
            // Tablas globales del proyecto secundario
            loadGlobalMaps().catch(err => Logger.warn('app-init', 'Tablas globales no disponibles', err))
        ]);

        // Inicializar pedidosMap global inmediatamente con los datos cargados
        window.pedidosMap = pedidos || [];
        Logger.info('app-init', `${window.pedidosMap.length} pedidos cargados en pedidosMap global`);

        // Clientes en background — no bloquea la UI
        loadClientesData().catch(err => Logger.warn('app-init', 'Clientes no cargados en background', err))
            .then(() => updateDataStats());

        Logger.info('app-init', 'Datos base cargados. Módulos se cargarán bajo demanda.');

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
 * Optimización: No recarga hojas que no cambian (COLORES, PRECIOS, HISTORICAS, SISPROWEB, CLIENTES, CONFIG).
 * Solo recarga DATA2 (para ver la OP como CONFIRMADA) y módulos dependientes (Distribución, Impresión).
 */
async function loadDataAfterSave(silent = true) {
    updateStatus('Sincronizando datos...', 'loading');

    try {
        // Solo recargar DATA2 (ingresos confirmados — la única tabla que cambió al guardar la OP)
        await loadData2Data();

        // Si el módulo de distribución está activo, recargarlo
        if (window.distributionModuleLoaded) {
            await initializeDistribution();
        }

        // Si el módulo de impresión está activo, recargarlo
        if (window.printingModuleLoaded) {
            await print_cargarDatos().catch(err => {
                console.error("Error cargando módulo de impresión:", err);
            });
        }

        // Actualizar stats
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
 * Carga datos necesarios para el procesador CSV y OPs pendientes
 */
async function loadProcessorModuleData() {
    if (window.processorModuleLoaded) return;
    
    const loading = showQuickLoading('Cargando datos del procesador...');
    try {
        await Promise.all([
            loadPreciosData()
        ]);
        window.processorModuleLoaded = true;
        updateDataStats();
        Logger.info('app-init', 'Módulo procesador cargado');
    } catch (error) {
        Logger.error('app-init', 'Error cargando módulo procesador', error);
        throw error;
    } finally {
        loading.close();
    }
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
 * Carga datos necesarios para el módulo de impresión
 */
async function loadPrintingModuleData() {
    if (window.printingModuleLoaded) return;
    
    const loading = showQuickLoading('Cargando datos de impresión...');
    try {
        await Promise.all([
            print_cargarDatos()
        ]);
        window.printingModuleLoaded = true;
        updateDataStats();
        Logger.info('app-init', 'Módulo impresión cargado');
    } catch (error) {
        Logger.error('app-init', 'Error cargando módulo impresión', error);
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
    set('stat-colores',   coloresMap.size);
    set('stat-ops',       data2Map.size);
    set('stat-master',    window.sisproMap?.size || 0);
    set('stat-precios',   preciosMap.size);
    set('stat-productos', barrasMap.size);  // Códigos de barras
    set('stat-clientes',  clientesMap.size);
    set('stat-usuarios',  escanersMap.size);
    set('stat-proveedores', proveedoresMap.size);
    set('stat-auditores', auditoresMap.size);
    set('stat-gestores',  gestoresMap.size);
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
