// js/core/app.js - Lógica principal y orquestador de la aplicación

/**
 * Punto de entrada principal para inicializar la orquestación.
 * Se encarga de coordinar la UI y las capas del sistema.
 */
function bootMainApplication() {
    Logger.info('app', '🚀 Iniciando orquestación maestra...');

    // 0. Setups básicos de UI
    if (typeof window.setupTheme === 'function') window.setupTheme();
    if (typeof window.setupTabSystem === 'function') window.setupTabSystem();

    // 1. Configurar TODOS los event listeners (Definido aquí)
    setupAllEventListeners();

    // 2. Inicializar la app core (Definido en app-init.js)
    // El núcleo ya maneja setupTheme, setupTabSystem y la carga de datos.
    if (typeof window.initializeApp === 'function') {
        Logger.info('app', '📞 Lanzando initializeApp desde el núcleo...');
        window.initializeApp();
    } else {
        console.error('CRITICAL ERROR: window.initializeApp not found in app-init.js');
    }

    // 3. Cargar traslados cancelados desde localStorage
    if (typeof window.loadCancelledTransfersFromStorage === 'function') {
        window.loadCancelledTransfersFromStorage();
    }

    // 4. Listeners para módulos bajo demanda
    setupModuleSpecificListeners();

    // 5. Cargar opciones dinámicas después de un delay
    setTimeout(() => {
        if (typeof window.loadAllDynamicOptions === 'function') {
            window.loadAllDynamicOptions();
        }
    }, 1200);

    Logger.success('app', '✅ Orquestación exitosa');
}

// Ejecución controlada para evitar fallos si el DOM ya se cargó
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootMainApplication);
} else {
    bootMainApplication();
}

// ============================================
// CONFIGURACIÓN DE LOS EVENT LISTENERS
// ============================================
function setupAllEventListeners() {
    Logger.info('app', '🔧 Vinculando eventos de negocio...');

    // Delegación segura para evitar errores de referencias circulares
    const safeAdd = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el && typeof fn === 'function') el.addEventListener(event, fn);
    };

    // ---- CSV Processor & Files ----
    safeAdd('processBtn', 'click', () => window.processCSV && window.processCSV());
    safeAdd('exportBtn',  'click', () => window.exportToCSV && window.exportToCSV());

    // ---- File Upload & Drag-Drop ----
    const fileInput = document.getElementById('csvFile');
    const uploadBox = document.getElementById('uploadBox');

    if (fileInput && uploadBox) {
        // Redirigir click del contenedor al input real
        if (!uploadBox.hasClickListener) {
            uploadBox.addEventListener('click', (e) => {
                if (e.target !== fileInput) fileInput.click();
            });
            uploadBox.hasClickListener = true;
        }

        // Drag events
        uploadBox.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadBox.style.borderColor = 'var(--primary)';
            uploadBox.style.backgroundColor = 'var(--hover)';
        });
        uploadBox.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadBox.style.borderColor = 'var(--border)';
            uploadBox.style.backgroundColor = 'transparent';
        });
        uploadBox.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadBox.style.borderColor = 'var(--border)';
            uploadBox.style.backgroundColor = 'transparent';
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                const fileName = e.dataTransfer.files[0].name;
                if (window.updateStatus) window.updateStatus(`Archivo listo: ${fileName}`, 'success');
                if (window.processCSV) setTimeout(() => window.processCSV(), 500);
            }
        });

        // Change event
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                if (window.updateStatus) window.updateStatus(`Seleccionado: ${e.target.files[0].name}`, 'success');
                if (window.processCSV) setTimeout(() => window.processCSV(), 500);
            }
        });
    }

    // ---- Sidebar & Tabs ----
    safeAdd('settingsBtn', 'click', () => window.showSettingsModal && window.showSettingsModal());

    // ---- Business Actions (Pending OPs, Editor, JSON) ----
    safeAdd('selectOP', 'change', () => window.loadOPData && window.loadOPData());
    safeAdd('generateJSONBtn', 'click', () => window.generateJSONForOP && window.generateJSONForOP());
    safeAdd('saveBtn', 'click', () => window.saveToSheets && window.saveToSheets());
    safeAdd('generateJSONFromEditorBtn', 'click', () => window.generateJSONFromEditor && window.generateJSONFromEditor());
    safeAdd('formatJSONBtn', 'click', () => window.formatJSON && window.formatJSON());
    safeAdd('copyJSONBtn', 'click', () => window.copyJSON && window.copyJSON());
    safeAdd('clearJSONBtn', 'click', () => window.clearJSON && window.clearJSON());

    // ---- Distribution Actions ----
    safeAdd('moduleConfigBtn', 'click', () => {
        if (typeof window.showModuleSettings === 'function') window.showModuleSettings();
    });
    safeAdd('recInput', 'input', () => window.searchDistributionRec && window.searchDistributionRec());
    safeAdd('reloadDataBtn', 'click', () => window.reloadAllDistributionData && window.reloadAllDistributionData());
    
    // Solo agregar el listener de guardado si no existe ya en distribution.js 
    // pero como safeAdd no previene duplicados manuales, usamos una bandera
    if (!window.__saveDistListenerAdded) {
        safeAdd('saveDistributionsBtn', 'click', () => {
            if (typeof window.saveDistributionToSheets === 'function') {
                window.saveDistributionToSheets();
            }
        });
        window.__saveDistListenerAdded = true;
    }

    // ---- Printing Actions ----
    safeAdd('printSearchBtn', 'click', () => window.print_buscarPorREC && window.print_buscarPorREC());
    safeAdd('printReloadBtn', 'click', () => window.print_cargarDatos && window.print_cargarDatos());

    Logger.success('app', '✅ Eventos vinculados exitosamente');
}

/**
 * Listeners específicos para submódulos de carga retardada
 */
function setupModuleSpecificListeners() {
    const bindTab = (tabName, initFn) => {
        const btn = document.querySelector(`.activity-icon[data-tab="${tabName}"]`);
        const tab = document.querySelector(`.tab[data-tab="${tabName}"]`);
        const handler = () => { if (typeof initFn === 'function') initFn(); };
        if (btn) btn.addEventListener('click', handler);
        if (tab) tab.addEventListener('click', handler);
    };

    bindTab('printing-module', window.initPrintingModule);
    bindTab('orders-module',   window.initOrdersModule);
}
