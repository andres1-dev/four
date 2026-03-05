/**
 * ui-controls.js
 * Lógica para la interfaz de usuario, header, indicadores de estado y controles móviles.
 */

// Variables globales para flatpickr
let flatpickrInstance = null;
let flatpickrMobileInstance = null;
let selectedDatesGlobal = [];

// Variables para el estado de actualización
let isUpdating = false;
let lastUpdateTime = null;

// Inicializar Flatpickr después de que se cargue la página
document.addEventListener('DOMContentLoaded', function () {
    console.log('Inicializando Flatpickr en header...');

    // Inicializar flatpickr del header (PC)
    flatpickrInstance = flatpickr("#filtroFechaHeader", {
        mode: "range",
        locale: "es",
        dateFormat: "d/m/Y",
        allowInput: true,
        showMonths: 1,
        shorthandCurrentMonth: true,
        onChange: function (selectedDates, dateStr, instance) {
            selectedDatesGlobal = selectedDates;
            if (selectedDates.length === 2) {
                aplicarFiltroFecha(selectedDates[0], selectedDates[1]);
            } else if (selectedDates.length === 0) {
                limpiarFiltroFecha();
            }
        },
        onClose: function (selectedDates, dateStr, instance) {
            if (selectedDates.length === 0) {
                limpiarFiltroFecha();
            }
        }
    });

    window.flatpickrInstance = flatpickrInstance;

    // Inicializar estado de actualización
    updateStatusIndicator('ready', 'Listo');
    updateLastUpdateTime();

    // Añadir animaciones de entrada
    const elements = document.querySelectorAll('.fade-in');
    elements.forEach((el, index) => {
        setTimeout(() => {
            el.style.opacity = '1';
        }, index * 100);
    });

    // Inicializar texto de finalizados
    setTimeout(actualizarTextoFinalizados, 500);
});

// ===== FUNCIONES PARA EL INDICADOR DE ESTADO SIMPLIFICADO =====

function updateStatusIndicator(status) {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusIcon = statusIndicator.querySelector('.status-icon');

    if (!statusIndicator) return;

    statusIndicator.classList.remove('ready', 'updating', 'error');

    switch (status) {
        case 'updating':
            statusIndicator.classList.add('updating');
            statusIcon.className = 'fas fa-sync-alt status-icon';
            break;

        case 'success':
            statusIndicator.classList.add('ready');
            statusIcon.className = 'fas fa-check status-icon';
            break;

        case 'error':
            statusIndicator.classList.add('error');
            statusIcon.className = 'fas fa-exclamation-triangle status-icon';
            break;

        default:
            statusIndicator.classList.add('ready');
            statusIcon.className = 'fas fa-check status-icon';
            break;
    }

    updateLastUpdateTime();
}

function updateLastUpdateTime() {
    const now = new Date();
    lastUpdateTime = now;

    const timeString = now.toLocaleTimeString('es-ES', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });

    const dateString = now.toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const statusIndicator = document.getElementById('statusIndicator');
    if (statusIndicator) {
        statusIndicator.title = `Última actualización: ${dateString}, ${timeString}`;
    }
}

function startUpdate() {
    if (isUpdating) return;
    updateStatusIndicator('updating');

    const btnActualizar = document.getElementById('btnActualizar');
    if (btnActualizar) {
        btnActualizar.disabled = true;
        btnActualizar.style.opacity = '0.6';
        btnActualizar.style.cursor = 'not-allowed';
    }
}

function finishUpdate(success = true) {
    const statusIndicator = document.getElementById('statusIndicator');

    if (success) {
        updateStatusIndicator('success');
        if (statusIndicator) {
            statusIndicator.style.transform = 'scale(1.1)';
            setTimeout(() => { statusIndicator.style.transform = 'scale(1)'; }, 300);
        }
    } else {
        updateStatusIndicator('error');
    }

    const btnActualizar = document.getElementById('btnActualizar');
    if (btnActualizar) {
        setTimeout(() => {
            btnActualizar.disabled = false;
            btnActualizar.style.opacity = '1';
            btnActualizar.style.cursor = 'pointer';
        }, 1000);
    }
}

// ===== FUNCIONES CORREGIDAS PARA FILTRADO DE FECHAS =====

function aplicarFiltroFecha(fechaInicio, fechaFin) {
    if (window.aplicarFiltroFechaDataTable) {
        window.aplicarFiltroFechaDataTable(fechaInicio, fechaFin);
    } else if (window.aplicarFiltroFechaOriginal) {
        window.aplicarFiltroFechaOriginal(fechaInicio, fechaFin);
    } else {
        if (window.cargarTablaDocumentos) window.cargarTablaDocumentos();
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'info',
                title: 'Filtro aplicado',
                text: `Fechas: ${fechaInicio.toLocaleDateString()} - ${fechaFin.toLocaleDateString()}`,
                timer: 1500,
                showConfirmButton: false
            });
        }
    }
}

function limpiarFiltroFecha() {
    selectedDatesGlobal = [];
    if (flatpickrInstance) flatpickrInstance.clear();

    if (window.limpiarFiltros) {
        window.limpiarFiltros();
    } else if (window.limpiarFiltroFechaDataTable) {
        window.limpiarFiltroFechaDataTable();
    } else {
        if (window.cargarTablaDocumentos) window.cargarTablaDocumentos();
    }

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'info', title: 'Filtro limpiado', timer: 1000, showConfirmButton: false
        });
    }
}

// ===== FUNCIONES PARA MÓVIL =====

function abrirModalControles() {
    const modal = new bootstrap.Modal(document.getElementById('controlsModal'));
    modal.show();
}

function abrirFlatpickrModal() {
    const controlsElement = document.getElementById('controlsModal');
    const controlsModal = bootstrap.Modal.getInstance(controlsElement);
    if (controlsModal) controlsModal.hide();

    setTimeout(() => {
        const modal = new bootstrap.Modal(document.getElementById('flatpickrModal'));
        modal.show();

        setTimeout(() => {
            if (flatpickrMobileInstance) flatpickrMobileInstance.destroy();
            flatpickrMobileInstance = flatpickr("#filtroFechaMobile", {
                mode: "range",
                locale: "es",
                dateFormat: "d/m/Y",
                allowInput: true,
                showMonths: 1, // En móvil mejor 1 por espacio
                shorthandCurrentMonth: true,
                onChange: function (selectedDates) {
                    selectedDatesGlobal = selectedDates;
                }
            });
            if (selectedDatesGlobal.length > 0) {
                flatpickrMobileInstance.setDate(selectedDatesGlobal, true);
            }
        }, 300);
    }, 200);
}

function aplicarFiltroFechaMovil() {
    if (selectedDatesGlobal.length === 2) {
        aplicarFiltroFecha(selectedDatesGlobal[0], selectedDatesGlobal[1]);
        const modal = bootstrap.Modal.getInstance(document.getElementById('flatpickrModal'));
        if (modal) modal.hide();
    } else {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning', title: 'Selecciona un rango',
                text: 'Por favor selecciona un rango de fechas completo',
                timer: 2000, showConfirmButton: false
            });
        }
    }
}

function limpiarFiltroFechaMovil() {
    if (flatpickrMobileInstance) flatpickrMobileInstance.clear();
    selectedDatesGlobal = [];
    limpiarFiltroFecha();
    const modal = bootstrap.Modal.getInstance(document.getElementById('flatpickrModal'));
    if (modal) modal.hide();
}

// ===== FUNCIONES PARA EL MODAL DE CONTROLES =====

function ejecutarActualizar() {
    if (window.cargarTablaDocumentos) window.cargarTablaDocumentos();
    cerrarModalControles();
    if (typeof Swal !== 'undefined') {
        Swal.fire({ icon: 'success', title: 'Actualizando...', timer: 1000, showConfirmButton: false });
    }
}

function ejecutarToggleFinalizados() {
    if (window.toggleFinalizados) window.toggleFinalizados();
    cerrarModalControles();
    actualizarTextoFinalizados();
}

function cerrarModalControles() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('controlsModal'));
    if (modal) modal.hide();
}

function actualizarTextoFinalizados() {
    const btn = document.getElementById('btnToggleFinalizados');
    const modalText = document.getElementById('modalToggleText');
    if (btn && modalText) {
        const isShowing = btn.classList.contains('active');
        modalText.textContent = isShowing ? 'Ocultar Finalizados' : 'Mostrar Finalizados';
    }
}

// ===== INTEGRACIÓN CON EL SISTEMA EXISTENTE =====

if (typeof window !== 'undefined') {
    // Sobrescribir toggleFinalizados
    const originalToggleFinalizados = window.toggleFinalizados;
    window.toggleFinalizados = function () {
        if (originalToggleFinalizados) originalToggleFinalizados();
        setTimeout(actualizarTextoFinalizados, 100);
    };

    // Sobrescribir cargarTablaDocumentos
    const originalCargarTablaDocumentos = window.cargarTablaDocumentos;
    window.cargarTablaDocumentos = function () {
        startUpdate();
        if (originalCargarTablaDocumentos) {
            try {
                const result = originalCargarTablaDocumentos();
                if (result && typeof result.then === 'function') {
                    result.then(() => finishUpdate(true)).catch(() => finishUpdate(false, 'Error al cargar'));
                } else {
                    setTimeout(() => finishUpdate(true), 1000);
                }
            } catch (error) {
                finishUpdate(false, 'Error al cargar');
            }
        } else {
            setTimeout(() => finishUpdate(true), 1500);
        }
    };

    // Helpers
    window.buscarDocumentoEnTabla = function (rec) {
        const input = document.getElementById('recInput');
        if (input) input.value = rec;
        if (window.buscarPorREC) window.buscarPorREC();
    };

    window.imprimirSoloClientesDesdeTabla = function (rec) {
        const input = document.getElementById('recInput');
        if (input) input.value = rec;
        if (window.imprimirSoloClientes) window.imprimirSoloClientes();
    };

    window.mostrarOpcionesDesdeTabla = function (rec) {
        const input = document.getElementById('recInput');
        if (input) input.value = rec;
        if (window.mostrarOpcionesImpresion) window.mostrarOpcionesImpresion();
    };

    // Exportar globales
    window.updateStatusIndicator = updateStatusIndicator;
    window.startUpdate = startUpdate;
    window.finishUpdate = finishUpdate;
    window.aplicarFiltroFecha = aplicarFiltroFecha;
    window.limpiarFiltroFecha = limpiarFiltroFecha;
    window.abrirFlatpickrModal = abrirFlatpickrModal;
    window.cerrarModalControles = cerrarModalControles;
}

// Optimización: Prevenir zoom en inputs en iOS
if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
}
