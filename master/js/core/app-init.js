function initializeApp() {
    setupEventListeners();
    setupTabSystem();
    setupTheme();
    initializeNotifications();

    window.distributionInitialized = true;

    // Cargar todos los datos incluyendo la configuración dinámica
    loadDataFromSheets();
    updateStatus('Sistema inicializado correctamente', 'info');
}

async function loadDataFromSheets(silent = false) {
    updateStatus('Cargando datos desde Google Sheets...', 'loading');
    const processBtn = document.getElementById('processBtn');
    if (processBtn) {
        processBtn.disabled = true;
        processBtn.innerHTML = '<span class="loading-spinner"></span> Cargando datos...';
    }

    const loading = showQuickLoading('Cargando datos globales y configuración...');

    try {
        // Primero cargar datos de configuración dinámica
        await loadAllConfigData();

        // Cargar datos principales en secuencia para evitar rate limit (429)
        await loadColoresData();
        await loadData2Data();
        await loadPreciosData();
        await loadSisproData();
        await loadHistoricasData();
        await loadClientesData();

        console.log('Datos base cargados, inicializando distribución e impresión...');

        // Cargar opciones dinámicas en los selects
        if (typeof loadAllDynamicOptions === 'function') {
            loadAllDynamicOptions();
        }

        await Promise.all([
            initializeDistribution(),
            print_cargarDatos().catch(err => {
                console.error("Error cargando módulo de impresión:", err);
            })
        ]);

        updateDataStats();
        updateStatus('Datos cargados correctamente', 'success');

        if (!silent) {
            showMessage('Sistema listo - Todos los módulos cargados', 'success', 2000);
        }

    } catch (error) {
        console.error('Error cargando datos:', error);
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

function updateDataStats() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-colores',   coloresMap.size);
    set('stat-ops',       data2Map.size);
    set('stat-precios',   preciosMap.size);
    set('stat-productos', sisproMap.size);
    set('stat-clientes',  clientesMap.size);
    set('stat-usuarios',  escanersMap.size);
}