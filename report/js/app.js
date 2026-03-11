/* ==========================================================================
   app.js — Punto de entrada: orquesta la carga inicial y conecta eventos
   Depende de: config.js, api.js, ui.js, forms.js, particles-config.js
   ========================================================================== */

/**
 * Carga los datos desde la API de Google Sheets.
 * Si falla, muestra un error al usuario (sin datos de respaldo).
 */
async function loadData() {
    try {
        showLoader();

        // PASO 1: Recuperar llaves de API desde GAS (Seguridad)
        await fetchSecureConfig();

        // PASO 2: Cargar datos operativos utilizando las llaves obtenidas
        const { lots, plantas } = await fetchAllData();

        if (lots) {
            setCurrentLots(lots);
            setCurrentPlantas(plantas || []);
            populatePlantaOptions(lots);
            applyAccessControl(); // Re-aplicar restricciones de rol tras cargar datos
            hideLoaderShowForm();
        } else {
            throw new Error('No se obtuvieron datos de SISPRO');
        }
    } catch (error) {
        console.error('[app] Error al cargar datos:', error);
        showError('Error al cargar los datos de SISPRO. Verifique su conexión e intente nuevamente.');
    }
}

/* ── Registro de Event Listeners ── */

function bindEvents() {
    // Búsqueda de lotes
    DOM.loteInput().addEventListener('input', handleLoteSearch);
    DOM.loteInput().addEventListener('input', handleLoteInputReset);

    // Selección de sugerencia
    DOM.loteSuggestions().addEventListener('click', handleLotSelection);

    // Cambio de acción (Novedades / Calidad / Actualizar Datos)
    DOM.accionesSelect().addEventListener('change', handleActionChange);

    // Cambio manual de planta
    DOM.plantaSelect().addEventListener('change', () => {
        const planta = DOM.plantaSelect().value;
        if (planta) {
            verificarRegistroPlanta(planta);
        }
    });

    // Envío de formularios
    document.getElementById('novedadesForm').addEventListener('submit', handleNovedadesSubmit);
    document.getElementById('calidadForm').addEventListener('submit', handleCalidadSubmit);
    document.getElementById('actualizarDatosForm').addEventListener('submit', handleActualizarDatosSubmit);

    // Acordeón de datos del lote
    initLotCollapse();

    // Cambio de logo
    window.cambiarLogo = cycleLogo;
}

/* ── Inicialización de la aplicación ── */

window.onload = function () {
    // Fecha y hora
    updateDateTime();

    // Registrar eventos
    bindEvents();

    // Cargar datos (Lotes + Plantas + Usuarios)
    loadData();
    loadUsers(); 

    // Dropzones de archivo personalizados
    initDropzones();

    // Fondo de partículas
    initParticles();

    // Mostrar login inicial si no hay sesión
    updateAuthUI();

    // Actualizar reloj cada minuto
    setInterval(updateDateTime, 60_000);
};
