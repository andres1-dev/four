function initializeApp() {
    // initializeNotifications(); // Opcional si aun existe
    window.distributionInitialized = true;

    // Cargar todos los datos incluyendo la configuración dinámica
    loadDataFromSheets();
    updateStatus('Sistema inicializado correctamente', 'info');
}

async function loadDataFromSheets(silent = false) {
    updateStatus('Cargando datos desde Google Sheets...', 'loading');
    statusTimingStart();
    
    const processBtn = document.getElementById('processBtn');
    if (processBtn) {
        processBtn.disabled = true;
        processBtn.innerHTML = '<span class="loading-spinner"></span> Cargando datos...';
    }

    const loading = showQuickLoading('Cargando datos globales y configuración...');

    try {
        // Primero cargar datos de configuración dinámica
        await loadAllConfigData();

        // Luego cargar el resto de datos en paralelo
        await Promise.all([
            loadColoresData(),
            loadData2Data(),
            loadPreciosData(),
            loadSisproData(),
            loadHistoricasData(),
            loadClientesData()
        ]);

        Logger.info('app-init', 'Datos base cargados, inicializando módulos...');

        // Cargar opciones dinámicas en los selects
        if (typeof loadAllDynamicOptions === 'function') {
            loadAllDynamicOptions();
        }

        // Inicializar módulos en paralelo
        await Promise.all([
            initializeDistribution(),
            initOrdersModule().catch(err => {
                console.error("Error cargando módulo de pedidos:", err);
            }),
            print_cargarDatos().catch(err => {
                console.error("Error cargando módulo de impresión:", err);
            })
        ]);

        updateDataStats();
        revealStatItems();
        statusTimingEnd(true);
        updateStatus('Datos cargados correctamente', 'success');

        if (!silent) {
            showMessage('Sistema listo - Todos los módulos cargados', 'success', 2000);
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
        // Solo recargar DATA2 (la única hoja que cambió al guardar la OP)
        await loadData2Data();

        // Actualizar módulos dependientes en paralelo
        await Promise.all([
            initializeDistribution(),
            print_cargarDatos().catch(err => {
                console.error("Error cargando módulo de impresión:", err);
            })
        ]);

        // Actualizar stats (solo DATA2 cambió)
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('stat-ops', data2Map.size);

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

function updateDataStats() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-colores',   coloresMap.size);
    set('stat-ops',       data2Map.size);
    set('stat-precios',   preciosMap.size);
    set('stat-productos', sisproMap.size);
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
