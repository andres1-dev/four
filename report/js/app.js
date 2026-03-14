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

/* ── Prefill desde Rutero ── */

/**
 * Si venimos desde rutero.html con datos en sessionStorage,
 * selecciona el lote, cambia la acción a CALIDAD y pre-llena tipoVisita.
 */
function aplicarPrefillRutero() {
    const raw = sessionStorage.getItem('rutero_prefill');
    if (!raw) return;
    sessionStorage.removeItem('rutero_prefill');

    let prefill;
    try { prefill = JSON.parse(raw); } catch(_) { return; }

    // Buscar el lote en currentLots
    const lot = currentLots.find(l =>
        (l.LOTE || '').trim().toLowerCase() === (prefill.lote || '').trim().toLowerCase()
    );
    if (!lot) return;

    // Seleccionar el lote y llenar detalles
    DOM.loteInput().value = lot.LOTE;
    fillLotDetails(lot);
    verificarRegistroPlanta(lot.PLANTA);

    // Cambiar acción a CALIDAD
    DOM.accionesSelect().value = 'CALIDAD';
    toggleActionSections('CALIDAD');

    // Pre-llenar tipo de visita
    if (prefill.tipoVisita) {
        const tvSelect = document.getElementById('tipoVisita');
        if (tvSelect) tvSelect.value = prefill.tipoVisita;
    }

    // Scroll suave al formulario
    setTimeout(() => {
        const calidadSection = document.getElementById('calidadSection');
        if (calidadSection) calidadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
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

window.onload = async function() {
    // 1. Prioridad Absoluta: Validar usuario (El escudo está activo en CSS)
    await loadUsers(); 

    // Si loadUsers() pasó (no hubo redirect), inicializar el resto
    updateDateTime();
    bindEvents();
    
    // Cargar datos operativos
    loadData().then(() => aplicarPrefillRutero());
    
    initDropzones();

    // El escudo se quita dentro de loadUsers() cuando todo es válido
    setInterval(updateDateTime, 60_000);

    // Sistema de notificaciones internas (solo para GUEST)
    initNotifications();
};
