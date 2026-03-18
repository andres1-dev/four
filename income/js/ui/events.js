/**
 * Event Listeners and Interaction Logic
 */

function toggleCard(header) {
    const card = header.closest('.card');
    const cardContent = card.querySelector('.card-content');
    const indicator = header.querySelector('.collapse-indicator');
    
    card.classList.toggle('expanded');
    if (cardContent) cardContent.classList.toggle('expanded');
    if (indicator) indicator.classList.toggle('expanded');
}

function toggleComparison(header) {
    const card = header.closest('.card') || header.parentElement;
    const content = header.nextElementSibling;
    const indicator = header.querySelector('.comparison-collapse-icon');
    
    if (card) card.classList.toggle('expanded');
    content.classList.toggle('expanded');
    if (indicator) indicator.classList.toggle('expanded');
}

function datosToggleCard(element) {
    const content = element.nextElementSibling;
    const indicator = element.querySelector('.collapse-indicator');
    const contador = document.getElementById('datos-contador');

    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        indicator.classList.replace('fa-chevron-up', 'fa-chevron-down');
    } else {
        content.classList.add('expanded');
        indicator.classList.replace('fa-chevron-down', 'fa-chevron-up');
        if (!datosRegistros && !datosCargando) {
            datosCargando = true;
            if (contador) contador.textContent = 'Cargando...';
            datosCargarEndpoint().then(() => { datosCargando = false; });
        }
    }
}

// Password verification
function checkPassword() {
    const password = prompt("Ingrese la contraseña para enviar el informe:");
    if (password === "One") return true;
    alert("Contraseña incorrecta");
    return false;
}

// Initialize Page
document.addEventListener('DOMContentLoaded', async function () {
    initDatePicker();
    initProveedorFilter();
    initCaptureButton();

    try {
        const today = new Date();
        await updateReportWithDate(today, true);
        // All cards stay collapsed after initial load
        document.querySelectorAll('.comparison-content').forEach(c => c.classList.remove('expanded'));
        document.querySelectorAll('.comparison-collapse-icon').forEach(i => i.classList.remove('expanded'));
    } catch (error) {
        console.error("Initialization error:", error);
    }
});

function initDatePicker() {
    const datePicker = document.getElementById('datePicker');
    const updateBtn = document.getElementById('updateReportBtn');
    if (!datePicker) return;

    datePicker.valueAsDate = new Date();
    fitInputWidth(datePicker);

    datePicker.addEventListener('change', () => {
        fitInputWidth(datePicker);
        const selectedDate = datePicker.valueAsDate;
        if (selectedDate && consolidatedData.length > 0) {
            generarReporteCompleto(selectedDate).then(reporte => {
                currentReportData = reporte;
                cargarDatosDia();
                cargarDatosMes();
                cargarDatosAño();
                cargarDatosTendencia();
            });
        }
    });

    if (updateBtn) {
        updateBtn.addEventListener('click', () => {
            const selectedDate = datePicker.valueAsDate || new Date();
            updateReportWithDate(selectedDate, true);
        });
    }
}

// Ajusta el ancho de un input/select al contenido exacto
function fitInputWidth(el) {
    const tmp = document.createElement('canvas');
    const ctx = tmp.getContext('2d');
    const style = window.getComputedStyle(el);
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

    let text = '';
    if (el.tagName === 'SELECT') {
        const opt = el.options[el.selectedIndex];
        text = opt ? opt.text : '';
    } else {
        // Para input date, formatear la fecha como se muestra
        if (el.value) {
            const [y, m, d] = el.value.split('-');
            text = `${d}/${m}/${y}`;
        } else {
            text = 'dd/mm/aaaa';
        }
    }

    // Padding izquierdo (ícono) + texto + padding derecho + flecha select
    const iconPad = el.tagName === 'SELECT' ? 30 : 34;
    const arrowPad = el.tagName === 'SELECT' ? 26 : 8;
    const measured = ctx.measureText(text).width;
    el.style.width = `${Math.ceil(measured + iconPad + arrowPad + 16)}px`;
}

function initProveedorFilter() {
    const select = document.getElementById('proveedorFilter');
    const btn    = document.getElementById('proveedorBtn');
    if (!select) return;

    // ── Panel de proveedor ────────────────────────────────────────────────────
    if (btn) {
        const panel = document.createElement('div');
        panel.id = 'proveedorPanel';
        panel.className = 'settings-panel';
        panel.setAttribute('role', 'menu');
        panel.setAttribute('aria-hidden', 'true');

        const options = [
            { value: 'todos',    icon: 'fa-house',      label: 'Todos' },
            { value: 'universo', icon: 'fa-globe',       label: 'Universo' },
            { value: 'angeles',  icon: 'fa-star',        label: 'Ángeles' },
        ];

        panel.innerHTML = options.map(o => `
            <button class="settings-item proveedor-option" data-value="${o.value}">
                <i class="fas ${o.icon}"></i><span>${o.label}</span>
            </button>`).join('<div class="settings-divider"></div>');

        document.body.appendChild(panel);

        function positionProveedorPanel() {
            const rect = btn.getBoundingClientRect();
            const pw = panel.offsetWidth || 160;
            const ph = panel.offsetHeight || 130;
            const margin = 8;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            let left = rect.left - pw - margin;
            let top  = rect.top;
            if (left < margin) left = rect.right + margin;
            if (left + pw > vw - margin) left = vw - pw - margin;
            if (top + ph > vh - margin) top = vh - ph - margin;
            if (top < margin) top = margin;

            panel.style.left = left + 'px';
            panel.style.top  = top  + 'px';
        }

        function closeProveedorPanel() {
            panel.classList.remove('open');
            panel.setAttribute('aria-hidden', 'true');
        }

        btn.addEventListener('click', e => {
            e.stopPropagation();
            const opening = !panel.classList.contains('open');
            if (opening) {
                panel.style.visibility = 'hidden';
                panel.classList.add('open');
                positionProveedorPanel();
                panel.style.visibility = '';
            } else {
                closeProveedorPanel();
            }
            panel.setAttribute('aria-hidden', String(!opening));
        });

        document.addEventListener('click', e => {
            if (!panel.contains(e.target) && e.target !== btn) closeProveedorPanel();
        });

        window.addEventListener('resize', () => {
            if (panel.classList.contains('open')) positionProveedorPanel();
        });

        // Marcar opción activa y actualizar ícono del botón
        function applyProveedor(value) {
            selectedProveedor = value;
            select.value = value;
            const opt = options.find(o => o.value === value);
            const icon = document.getElementById('proveedorIcon');
            if (icon && opt) icon.className = `fas ${opt.icon}`;
            panel.querySelectorAll('.proveedor-option').forEach(el => {
                el.classList.toggle('active', el.dataset.value === value);
            });
        }

        applyProveedor(select.value || 'todos');

        panel.querySelectorAll('.proveedor-option').forEach(el => {
            el.addEventListener('click', async () => {
                closeProveedorPanel();
                applyProveedor(el.dataset.value);
                if (allIncomeData.length === 0) return;

                reconsolidateWithFilter();
                const datePicker = document.getElementById('datePicker');
                const selectedDate = datePicker ? (datePicker.valueAsDate || new Date()) : new Date();
                try {
                    const reporte = await generarReporteCompleto(selectedDate);
                    currentReportData = reporte;
                    cargarDatosDia();
                    cargarDatosMes();
                    cargarDatosAño();
                    cargarDatosTendencia();
                } catch (error) {
                    console.error("Provider filter error:", error);
                }
            });
        });
    }

    // El select oculto sigue siendo la fuente de verdad para el resto del código
    fitInputWidth(select);

    select.addEventListener('change', async () => {
        fitInputWidth(select);
        selectedProveedor = select.value;
        if (allIncomeData.length === 0) return;

        reconsolidateWithFilter();

        const datePicker = document.getElementById('datePicker');
        const selectedDate = datePicker ? (datePicker.valueAsDate || new Date()) : new Date();

        try {
            const reporte = await generarReporteCompleto(selectedDate);
            currentReportData = reporte;
            cargarDatosDia();
            cargarDatosMes();
            cargarDatosAño();
            cargarDatosTendencia();
        } catch (error) {
            console.error("Provider filter error:", error);
        }
    });
}

function reconsolidateWithFilter() {
    let filteredData = allIncomeData;
    let filteredBudget = budgetData;

    if (selectedProveedor === 'universo') {
        filteredData = allIncomeData.filter(d => d.PROVEEDOR === 'UNIVERSO');
        // Recalculate budget: sum all lines EXCEPT ANGELES
        filteredBudget = budgetData.map(b => {
            const lineas = b.LINEAS || {};
            let total = 0;
            for (const [linea, valor] of Object.entries(lineas)) {
                if (!linea.toUpperCase().includes('ANGELES')) {
                    total += valor;
                }
            }
            return { ...b, TOTAL: total };
        });
    } else if (selectedProveedor === 'angeles') {
        filteredData = allIncomeData.filter(d => d.PROVEEDOR === 'ANGELES');
        // Recalculate budget: sum only ANGELES line
        filteredBudget = budgetData.map(b => {
            const lineas = b.LINEAS || {};
            let total = 0;
            for (const [linea, valor] of Object.entries(lineas)) {
                if (linea.toUpperCase().includes('ANGELES')) {
                    total += valor;
                }
            }
            return { ...b, TOTAL: total };
        });
    }

    // Always calculate global consolidated data to track total business days elapsed
    globalConsolidatedData = procesarDatosConsolidados(allIncomeData, budgetData);
    const globalDates = globalConsolidatedData.map(d => d.Fecha);

    consolidatedData = procesarDatosConsolidados(filteredData, filteredBudget, globalDates);
}

function initCaptureButton() {
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) captureBtn.addEventListener('click', captureAndDownloadCards);
}

function initWhatsAppButton() {
    const whatsappBtn = document.getElementById('whatsappBtn');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (checkPassword()) {
                const icon = whatsappBtn.querySelector('i');
                const orig = icon.className;
                icon.className = 'fas fa-spinner fa-spin';
                captureAndDownloadCards().finally(() => { icon.className = orig; });
            }
        });
    }
}

async function updateReportWithDate(newDate, forceReload = false, silent = false) {
    if (isLoading) return;
    isLoading = true;
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const loadingProgress = document.getElementById('loadingProgress');

    // Toast para modo silencioso
    let toastEl = null;
    function showSilentToast(msg, state = 'loading') {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'silent-toast';
            document.body.appendChild(toastEl);
            requestAnimationFrame(() => toastEl.classList.add('visible'));
        }
        const indicator = state === 'loading'
            ? `<div class="silent-toast-spinner"></div>`
            : `<div class="silent-toast-dot${state === 'error' ? ' error' : ''}"></div>`;
        toastEl.innerHTML = `${indicator}<span>${msg}</span>`;
    }
    function removeSilentToast() {
        if (toastEl) {
            toastEl.classList.remove('visible');
            setTimeout(() => { toastEl?.remove(); toastEl = null; }, 200);
        }
    }

    try {
        if (!silent) {
            if (loadingOverlay) loadingOverlay.classList.add('active');
            if (loadingText) loadingText.textContent = "Actualizando datos...";
            if (loadingProgress) loadingProgress.style.width = '10%';
        } else {
            showSilentToast('Actualizando datos...');
        }

        if (forceReload || consolidatedData.length === 0) {
            await cargarDatosIniciales();
        }

        const reporte = await generarReporteCompleto(newDate);
        currentReportData = reporte;

        cargarDatosDia();
        cargarDatosMes();
        cargarDatosAño();
        cargarDatosTendencia();

        if (!silent) {
            if (loadingProgress) loadingProgress.style.width = '100%';
            await new Promise(r => setTimeout(r, 300));
        } else {
            showSilentToast('Datos actualizados', 'done');
            setTimeout(removeSilentToast, 1500);
        }
    } catch (error) {
        console.error("Update error:", error);
        if (silent) { showSilentToast('Error al actualizar', 'error'); setTimeout(removeSilentToast, 2000); }
    } finally {
        if (!silent && loadingOverlay) {
            loadingOverlay.classList.add('closing');
            setTimeout(() => {
                loadingOverlay.classList.remove('active', 'closing');
            }, 400);
        }
        isLoading = false;
    }
}

async function cargarDatosIniciales() {
    try {
        // Income (3 requests paralelas) + Budget (1 request batchGet) simultáneos
        const [incomeData, budget] = await Promise.all([
            getAllIncomeData(),
            getBudgetData()
        ]);

        allIncomeData = incomeData;
        budgetData = budget;

        reconsolidateWithFilter();

        // Apps Script es lento, no bloquea la carga principal
        datosCargarEndpoint();
    } catch (error) {
        console.error("Initial load error:", error);
        throw error;
    }
}

async function generarReporteCompleto(targetDate) {
    const fechaObj = parseDate(targetDate);
    const currentYear = fechaObj.getFullYear();
    const currentResult = findClosestDateWithData(fechaObj, currentYear, consolidatedData);
    if (!currentResult) throw new Error("No data");

    const previousYear = currentYear - 1;
    const previousYearDate = new Date(fechaObj);
    previousYearDate.setFullYear(previousYear);
    let previousResult = findClosestDateWithData(previousYearDate, previousYear, consolidatedData);

    const report = {
        filtros: { actual: formatDate(currentResult.date), anterior: previousResult ? formatDate(previousResult.date) : null },
        dia: {
            actual: generateDayMetrics(currentResult.data, currentResult.date, consolidatedData, false),
            anterior: previousResult ? generateDayMetrics(previousResult.data, previousResult.date, consolidatedData, true, currentResult.date) : null
        },
        mes: {
            actual: generatePeriodMetrics('mes', currentResult.date, consolidatedData, false),
            anterior: previousResult ? generatePeriodMetrics('mes', previousResult.date, consolidatedData, true, currentResult.date) : null
        },
        año: {
            actual: generatePeriodMetrics('año', currentResult.date, consolidatedData, false),
            anterior: previousResult ? generatePeriodMetrics('año', previousResult.date, consolidatedData, true, currentResult.date) : null
        }
    };

    // Calculate gestion (year-over-year comparison) for each period
    if (report.dia.anterior) {
        report.dia.actual.gestion = calculateGrowth(report.dia.actual.porcentaje, report.dia.anterior.porcentaje);
    }
    if (report.mes.anterior) {
        report.mes.actual.gestion = calculateGrowth(report.mes.actual.porcentaje, report.mes.anterior.porcentaje);
    }
    if (report.año.anterior) {
        report.año.actual.gestion = calculateGrowth(report.año.actual.porcentaje, report.año.anterior.porcentaje);
    }

    return report;
}



// ── Settings Panel ────────────────────────────────────────────────────────────
(function initSettingsPanel() {
    const btn = document.getElementById('settingsBtn');
    if (!btn) return;

    // ── Crear panel directo en body (escapa cualquier stacking context) ────────
    const panel = document.createElement('div');
    panel.id = 'settingsPanel';
    panel.className = 'settings-panel';
    panel.setAttribute('role', 'menu');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
        <button class="settings-item" id="settingsUpdateBtn">
            <i class="fas fa-sync-alt"></i><span>Actualizar datos</span>
        </button>
        <div class="settings-divider"></div>
        <button class="settings-item" id="settingsParticlesBtn">
            <i class="fas fa-star" id="particlesIcon"></i><span id="particlesLabel">Desactivar partículas</span>
        </button>
        <div class="settings-divider"></div>
        <button class="settings-item" id="settingsThemeBtn">
            <i class="fas fa-sun" id="themeIcon"></i><span id="themeLabel">Modo claro</span>
        </button>
        <div class="settings-divider"></div>
        <button class="settings-item" id="settingsSolidBtn">
            <i class="fas fa-droplet" id="solidIcon"></i><span id="solidLabel">Modo sólido</span>
        </button>
        <div class="settings-divider"></div>
        <button class="settings-item" id="whatsappBtn">
            <i class="fab fa-whatsapp"></i><span>Enviar WhatsApp</span>
        </button>
        <button class="settings-item" id="emailBtn">
            <i class="fas fa-envelope"></i><span>Enviar Email</span>
        </button>`;
    document.body.appendChild(panel);

    const updateBtn  = panel.querySelector('#settingsUpdateBtn');
    const partBtn    = panel.querySelector('#settingsParticlesBtn');
    const partIcon   = panel.querySelector('#particlesIcon');
    const partLabel  = panel.querySelector('#particlesLabel');
    const themeBtn   = panel.querySelector('#settingsThemeBtn');
    const themeIcon  = panel.querySelector('#themeIcon');
    const themeLabel = panel.querySelector('#themeLabel');
    const solidBtn   = panel.querySelector('#settingsSolidBtn');
    const solidIcon  = panel.querySelector('#solidIcon');
    const solidLabel = panel.querySelector('#solidLabel');
    const waBtn      = panel.querySelector('#whatsappBtn');

    // ── Posicionar saliendo del botón, ajustando si se sale de pantalla ──────
    function positionPanel() {
        const rect   = btn.getBoundingClientRect();
        const pw     = panel.offsetWidth  || 210;
        const ph     = panel.offsetHeight || 200;
        const margin = 8;
        const vw     = window.innerWidth;
        const vh     = window.innerHeight;

        // Preferir a la izquierda del botón
        let left = rect.left - pw - margin;
        let top  = rect.top;

        // Si se sale por la izquierda → a la derecha del botón
        if (left < margin) left = rect.right + margin;

        // Si aún se sale por la derecha → pegarlo al margen derecho
        if (left + pw > vw - margin) left = vw - pw - margin;

        // Ajuste vertical
        if (top + ph > vh - margin) top = vh - ph - margin;
        if (top < margin) top = margin;

        panel.style.left = left + 'px';
        panel.style.top  = top  + 'px';
    }

    // ── Abrir / cerrar ────────────────────────────────────────────────────────
    function closePanel() {
        panel.classList.remove('open');
        panel.setAttribute('aria-hidden', 'true');
    }

    btn.addEventListener('click', e => {
        e.stopPropagation();
        const opening = !panel.classList.contains('open');
        if (opening) {
            // Mostrar brevemente para medir ancho antes de posicionar
            panel.style.visibility = 'hidden';
            panel.classList.add('open');
            positionPanel();
            panel.style.visibility = '';
        } else {
            closePanel();
        }
        panel.setAttribute('aria-hidden', String(!opening));
    });

    document.addEventListener('click', e => {
        if (!panel.contains(e.target) && e.target !== btn) closePanel();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closePanel();
    });

    window.addEventListener('resize', () => {
        if (panel.classList.contains('open')) positionPanel();
    });

    const emBtn      = panel.querySelector('#emailBtn');
    updateBtn.addEventListener('click', () => {
        closePanel();
        const icon = updateBtn.querySelector('i');
        icon.classList.add('fa-spin');
        const datePicker = document.getElementById('datePicker');
        const date = datePicker ? (datePicker.valueAsDate || new Date()) : new Date();
        updateReportWithDate(date, true, true).finally(() => icon.classList.remove('fa-spin'));
    });

    // ── Partículas ────────────────────────────────────────────────────────────
    let particlesOff = localStorage.getItem('particlesOff') === 'true';

    function applyParticles() {
        const container = document.querySelector('.particles-container');
        if (!container) return;
        if (particlesOff) {
            container.style.display = 'none';
            partIcon.className    = 'fas fa-star-half-stroke';
            partLabel.textContent = 'Activar partículas';
            partBtn.classList.add('active');
        } else {
            container.style.display = '';
            partIcon.className    = 'fas fa-star';
            partLabel.textContent = 'Desactivar partículas';
            partBtn.classList.remove('active');
        }
    }

    applyParticles();

    partBtn.addEventListener('click', () => {
        particlesOff = !particlesOff;
        localStorage.setItem('particlesOff', particlesOff);
        applyParticles();
        closePanel();
    });

    // ── Tema ──────────────────────────────────────────────────────────────────
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeIcon.className   = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        themeLabel.textContent = theme === 'light' ? 'Modo oscuro' : 'Modo claro';
        if (typeof particlesReinit === 'function') particlesReinit();
    }

    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);

    themeBtn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        applyTheme(next);
        closePanel();
    });

    // ── Modo sólido ───────────────────────────────────────────────────────────
    let solidMode = localStorage.getItem('solidMode') === 'true';

    function applySolid() {
        document.documentElement.classList.toggle('solid', solidMode);
        localStorage.setItem('solidMode', solidMode);
        solidIcon.className   = solidMode ? 'fas fa-droplet-slash' : 'fas fa-droplet';
        solidLabel.textContent = solidMode ? 'Modo transparente' : 'Modo sólido';
        solidBtn.classList.toggle('active', solidMode);
    }

    applySolid();

    solidBtn.addEventListener('click', () => {
        solidMode = !solidMode;
        applySolid();
        closePanel();
    });

    // ── WhatsApp ──────────────────────────────────────────────────────────────
    waBtn.addEventListener('click', e => {
        e.preventDefault();
        closePanel();
        if (checkPassword()) {
            const icon = waBtn.querySelector('i');
            const orig = icon.className;
            icon.className = 'fas fa-spinner fa-spin';
            captureAndDownloadCards(true).finally(() => { icon.className = orig; });
        }
    });

    // ── Email ─────────────────────────────────────────────────────────────────
    emBtn.addEventListener('click', e => {
        e.preventDefault();
        closePanel();
        if (checkPassword()) {
            const icon = emBtn.querySelector('i');
            const orig = icon.className;
            icon.className = 'fas fa-spinner fa-spin';
            sendEmailReport(true).finally(() => { icon.className = orig; });
        }
    });
})();

// ── Loading Stream ────────────────────────────────────────────────────────────

// ── Loading Stream ────────────────────────────────────────────────────────────
(function () {
    const LINES = [
        ['Inicializando entorno de ejecución',           'mid'],
        ['Verificando integridad del sistema',           'dim'],
        ['Cargando módulos principales',                 'cyan'],
        ['Estableciendo conexión segura',                'indigo'],
        ['Autenticando credenciales',                    'dim'],
        ['Validando permisos de acceso',                 'yellow'],
        ['Conexión establecida',                         'accent'],
        ['Inicializando motor de datos',                 'cyan'],
        ['Configurando protocolo de transferencia',      'dim'],
        ['Preparando solicitudes en paralelo',           'indigo'],
        ['Enviando solicitud al servidor primario',      'dim'],
        ['Enviando solicitud al servidor secundario',    'dim'],
        ['Enviando solicitud al servidor terciario',     'dim'],
        ['Esperando respuesta del servidor',             'yellow'],
        ['Recibiendo paquetes de datos',                 'cyan'],
        ['Verificando integridad de paquetes',           'dim'],
        ['Descomprimiendo payload',                      'dim'],
        ['Deserializando estructura de datos',           'mid'],
        ['Validando esquema de respuesta',               'dim'],
        ['Esquema validado correctamente',               'accent'],
        ['Procesando registros fuente primaria',         'bright'],
        ['Normalizando campos de texto',                 'dim'],
        ['Normalizando campos numéricos',                'cyan'],
        ['Normalizando campos de fecha',                 'dim'],
        ['Aplicando zona horaria UTC-5',                 'yellow'],
        ['Resolviendo referencias cruzadas',             'indigo'],
        ['Clasificando registros por categoría',         'dim'],
        ['Aplicando reglas de negocio',                  'mid'],
        ['Filtrando registros inválidos',                'red'],
        ['Fuente primaria procesada',                    'accent'],
        ['Procesando registros fuente secundaria',       'bright'],
        ['Mapeando estructura de columnas',              'cyan'],
        ['Validando tipos de datos por campo',           'dim'],
        ['Aplicando transformaciones de normalización',  'dim'],
        ['Resolviendo entidades relacionadas',           'indigo'],
        ['Calculando campos derivados',                  'dim'],
        ['Aplicando filtros de integridad',              'mid'],
        ['Fuente secundaria procesada',                  'accent'],
        ['Procesando registros fuente histórica',        'bright'],
        ['Cargando datos del período anterior',          'cyan'],
        ['Normalizando serie temporal histórica',        'dim'],
        ['Alineando períodos para comparación',          'indigo'],
        ['Fuente histórica procesada',                   'accent'],
        ['Cargando parámetros presupuestales',           'bright'],
        ['Procesando estructura de presupuesto',         'dim'],
        ['Calculando distribución por período',          'cyan'],
        ['Calculando días hábiles por mes',              'yellow'],
        ['Calculando meta diaria por período',           'mid'],
        ['Parámetros presupuestales cargados',           'accent'],
        ['Iniciando consolidación de fuentes',           'bright'],
        ['Unificando registros de todas las fuentes',    'indigo'],
        ['Agrupando transacciones por fecha',            'dim'],
        ['Calculando totales diarios',                   'cyan'],
        ['Calculando diferencia vs objetivo',            'yellow'],
        ['Calculando porcentaje de cumplimiento',        'dim'],
        ['Asignando semana ISO a cada registro',         'dim'],
        ['Generando índice temporal',                    'mid'],
        ['Consolidación completada',                     'accent'],
        ['Iniciando cálculo de métricas',                'bright'],
        ['Calculando métricas del período diario',       'cyan'],
        ['Calculando métricas del período mensual',      'indigo'],
        ['Calculando métricas del período anual',        'bright'],
        ['Calculando promedio aritmético',               'dim'],
        ['Calculando promedio ponderado',                'dim'],
        ['Calculando desviación estándar',               'yellow'],
        ['Calculando varianza del período',              'dim'],
        ['Identificando valor máximo',                   'accent'],
        ['Identificando valor mínimo',                   'red'],
        ['Calculando percentil 75',                      'dim'],
        ['Calculando percentil 25',                      'dim'],
        ['Buscando fecha de referencia más cercana',     'cyan'],
        ['Métricas del período actual calculadas',       'accent'],
        ['Calculando métricas comparativas',             'bright'],
        ['Cargando datos del mismo período año anterior','dim'],
        ['Alineando fechas para comparación interanual', 'indigo'],
        ['Calculando variación absoluta',                'dim'],
        ['Calculando variación porcentual',              'yellow'],
        ['Calculando gestión interanual',                'mid'],
        ['Métricas comparativas calculadas',             'accent'],
        ['Iniciando análisis de tendencia',              'bright'],
        ['Construyendo serie temporal',                  'cyan'],
        ['Aplicando regresión lineal',                   'indigo'],
        ['Calculando coeficiente de correlación',        'dim'],
        ['Calculando pendiente de tendencia',            'dim'],
        ['Generando proyección conservadora',            'yellow'],
        ['Generando proyección optimista',               'accent'],
        ['Calculando intervalo de confianza',            'dim'],
        ['Identificando mejor período',                  'accent'],
        ['Identificando período crítico',                'red'],
        ['Análisis de tendencia completado',             'accent'],
        ['Preparando capa de presentación',              'bright'],
        ['Compilando datos para visualización',          'cyan'],
        ['Renderizando componentes gráficos',            'indigo'],
        ['Generando gráfico de tendencia',               'bright'],
        ['Aplicando paleta de colores',                  'yellow'],
        ['Calculando escala de ejes',                    'dim'],
        ['Renderizando tarjeta de período diario',       'cyan'],
        ['Renderizando tarjeta de período mensual',      'indigo'],
        ['Renderizando tarjeta de período anual',        'bright'],
        ['Actualizando indicadores de progreso',         'dim'],
        ['Aplicando umbrales de color por rendimiento',  'yellow'],
        ['Actualizando indicadores de gestión',          'mid'],
        ['Interfaz de usuario actualizada',              'accent'],
        ['Inicializando módulo de exportación',          'cyan'],
        ['Preparando motor de exportación CSV',          'dim'],
        ['Preparando motor de exportación JSON',         'dim'],
        ['Preparando motor de exportación Excel',        'indigo'],
        ['Configurando selector de rango de fechas',     'dim'],
        ['Módulo de exportación listo',                  'accent'],
        ['Registrando Service Worker',                   'cyan'],
        ['Verificando recursos en caché',                'dim'],
        ['Sincronizando estado de la aplicación',        'indigo'],
        ['Aplicando preferencias del usuario',           'dim'],
        ['Optimizando rendimiento de renderizado',       'yellow'],
        ['Liberando memoria temporal',                   'dim'],
        ['Todos los módulos inicializados',              'accent'],
        ['Sistema operativo',                            'bright'],
    ];

    let currentEl = null;
    let idx = 0;
    let timer = null;

    function showNext() {
        const container = document.getElementById('loadingStream');
        if (!container) return;

        if (currentEl) currentEl.classList.remove('visible');

        const [text, cls] = LINES[idx % LINES.length];
        const el = document.createElement('div');
        el.className = `loading-stream-line ${cls}`;
        el.textContent = text;
        container.appendChild(el);

        el.getBoundingClientRect();
        el.classList.add('visible');

        if (currentEl) {
            const old = currentEl;
            setTimeout(() => old.remove(), 300);
        }

        currentEl = el;
        idx++;
        timer = setTimeout(showNext, 150);
    }

    function startStream() {
        idx = 0;
        currentEl = null;
        clearTimeout(timer);
        const container = document.getElementById('loadingStream');
        if (container) container.innerHTML = '';
        showNext();
    }

    function stopStream() {
        clearTimeout(timer);
        const container = document.getElementById('loadingStream');
        if (container) container.innerHTML = '';
        currentEl = null;
    }

    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        const observer = new MutationObserver(() => {
            if (overlay.classList.contains('active')) startStream();
            else stopStream();
        });
        observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
        if (overlay.classList.contains('active')) startStream();
    }
})();

// ============ TOOLTIP GLOBAL ============
(function initGlobalTooltip() {
    const tip = document.createElement('div');
    tip.id = 'global-tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);

    let hideTimer = null;

    function showTip(text, triggerEl) {
        clearTimeout(hideTimer);
        tip.textContent = text;
        tip.classList.add('visible');
        positionTip(triggerEl);
    }

    function hideTip() {
        hideTimer = setTimeout(() => tip.classList.remove('visible'), 80);
    }

    function positionTip(el) {
        const rect = el.getBoundingClientRect();
        const tipW = tip.offsetWidth || 200;
        const tipH = tip.offsetHeight || 36;
        const margin = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Preferir arriba; si no cabe, abajo
        let top = rect.top - tipH - margin;
        if (top < margin) top = rect.bottom + margin;

        // Centrar horizontalmente
        let left = rect.left + rect.width / 2 - tipW / 2;
        if (left < margin) left = margin;
        if (left + tipW > vw - margin) left = vw - tipW - margin;
        if (top + tipH > vh - margin) top = vh - tipH - margin;

        tip.style.top = top + 'px';
        tip.style.left = left + 'px';
    }

    // Desktop hover
    document.addEventListener('mouseover', e => {
        const trigger = e.target.closest('.tooltip');
        if (!trigger) return;
        const text = trigger.querySelector('.tooltiptext')?.textContent?.trim();
        if (text) showTip(text, trigger);
    });

    document.addEventListener('mouseout', e => {
        if (e.target.closest('.tooltip')) hideTip();
    });

    // Touch — tap para mostrar/ocultar
    document.addEventListener('touchstart', e => {
        const trigger = e.target.closest('.tooltip');
        if (!trigger) { hideTip(); return; }
        const text = trigger.querySelector('.tooltiptext')?.textContent?.trim();
        if (!text) return;
        e.preventDefault();
        if (tip.classList.contains('visible') && tip.textContent === text) {
            hideTip();
        } else {
            showTip(text, trigger);
        }
    }, { passive: false });

    // Ocultar al hacer scroll
    window.addEventListener('scroll', () => tip.classList.remove('visible'), { passive: true });
})();


