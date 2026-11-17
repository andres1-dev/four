/**
 * js/script.js
 * Master Script Loader (The only script called from index.html)
 * 
 * Este archivo actúa como orquestador, similar a styles.css para JS,
 * inyectando todos los módulos necesarios en el orden correcto para
 * mantener el ámbito global controlado.
 */
(function() {
    const scripts = [
        // 0. Librerías externas
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",

        // 1. Capa de Configuración (Config & State)
        "js/config/constants.js",

        // 2. Capa de Utilidades (Utils)
        "js/utils/logger.js",
        "js/utils/formatters.js",
        "js/utils/helpers.js",
        "js/utils/performance.js",

        // 3. Capa de Servicios (Networking)
        "js/services/csv-parser.js",
        "js/services/gas-service.js",
        "js/services/google-sheets.js",

        // 4. Capa de Interfaz (UI Components)
        "js/ui/notifications.js",
        "js/ui/status-bar.js",
        "js/ui/modals.js",
        "js/ui/quick-confirm.js",
        "js/ui/json-editor.js",
        "js/ui/results-display.js",
        "js/ui/tabs.js",
        "js/ui/missing-data-modal.js",
        "js/ui/sispro-update-modal.js",
        "js/ui/colores-modal.js",
        "js/ui/clientes-modal.js",
        "js/ui/usuarios-modal.js",
        "js/ui/maestros-master-modal.js",

        // 5. Capa Core (Base App Logic)
        "js/core/theme.js",
        "js/core/event-listeners.js",
        "js/core/app-init.js",
        // 6. Módulos de Negocio (Business logic)
        "js/modules/data-processing.js",
        "js/modules/op-editor.js",
        "js/modules/transfers.js",
        "js/modules/distribution.js",
        "js/modules/orders.js",

        // 7. Módulo de Impresión (Templates & Logic)
        "js/printing/printing-templates.js",
        "js/printing/printing-search.js",
        "js/printing/printing-main.js",

        // 8. Capa Core (Entry Point - DEBE IR AL FINAL)
        "js/core/app.js"
    ];

    /**
     * Carga secuencial de scripts para respetar dependencias
     */
    function loadScripts(list) {
        let index = 0;
        
        function next() {
            if (index < list.length) {
                const s = document.createElement('script');
                s.src = list[index];
                s.async = false;  // Ejecución en orden secuencial
                s.defer = true;  // No bloquea el parseo del DOM
                
                s.onload = () => {
                    index++;
                    next();
                };
                
                s.onerror = (e) => {
                    console.error('CRITICAL ERROR: Failed to load script:', list[index], e);
                    // Intentar continuar con el siguiente a pesar del error
                    index++;
                    next();
                };
                
                document.head.appendChild(s);
            }
        }
        
        next();
    }

    // Iniciar carga
    loadScripts(scripts);
})();