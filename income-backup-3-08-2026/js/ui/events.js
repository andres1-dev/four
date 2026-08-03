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

function switchCompTab(btn, panelId) {
    const content = btn.closest('.comparison-content');
    content.querySelectorAll('.comp-tab').forEach(t => t.classList.remove('active'));
    content.querySelectorAll('.comp-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(panelId).classList.add('active');
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

// ─── Sistema de gestión de paneles ────────────────────────────────────────────
window.activePanels = {
    profile: null,
    settings: null,
    proveedor: null,
    datePicker: null
};

window.closeAllPanels = function(except) {
    // Cerrar panel de perfil
    if (except !== 'profile' && window.activePanels.profile) {
        window.activePanels.profile.classList.remove('open');
        window.activePanels.profile.setAttribute('aria-hidden', 'true');
    }
    
    // Cerrar panel de configuración
    if (except !== 'settings' && window.activePanels.settings) {
        window.activePanels.settings.classList.remove('open');
        window.activePanels.settings.setAttribute('aria-hidden', 'true');
    }
    
    // Cerrar panel de proveedor
    if (except !== 'proveedor' && window.activePanels.proveedor) {
        window.activePanels.proveedor.classList.remove('open');
        window.activePanels.proveedor.setAttribute('aria-hidden', 'true');
    }
    
    // Cerrar flatpickr
    if (except !== 'datePicker' && window._datePicker) {
        window._datePicker.close();
    }
};

function initDatePicker() {
    const updateBtn = document.getElementById('updateReportBtn');
    const dateIconBtn = document.getElementById('dateIconBtn');
    if (!dateIconBtn) return;

    // Input oculto para flatpickr
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'datePicker';
    input.readOnly = true;
    input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:0;height:0;top:-9999px;left:-9999px;';
    document.body.appendChild(input);

    const fp = flatpickr(input, {
        defaultDate: new Date(),
        dateFormat: 'Y-m-d',
        disableMobile: true,
        appendTo: document.body,
        locale: {
            firstDayOfWeek: 1,
            weekdays: {
                shorthand: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],
                longhand:  ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
            },
            months: {
                shorthand: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
                longhand:  ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
            }
        },
        onOpen: function() {
            // Cerrar otros paneles cuando se abre el date picker
            window.closeAllPanels('datePicker');
        },
        onReady(_, __, instance) {
            const cal = instance.calendarContainer;
            cal.style.position = 'fixed';
            cal.style.zIndex   = '999999';
            instance.input.setAttribute('tabindex', '-1');

            // Inyectar estilos para sobreescribir flatpickr base
            if (!document.getElementById('flatpickr-custom-override')) {
                const style = document.createElement('style');
                style.id = 'flatpickr-custom-override';
                style.textContent = `
                    .flatpickr-calendar { background: #16181f !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 14px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important; padding: 12px !important; width: 336px !important; }
                    .flatpickr-days, .dayContainer { width: 312px !important; min-width: 312px !important; max-width: 312px !important; }
                    .flatpickr-day { max-width: 44px !important; width: 44px !important; height: 36px !important; line-height: 36px !important; font-size: 12px !important; }
                    span.flatpickr-weekday { width: 44px !important; font-size: 10px !important; }
                    .flatpickr-months, .flatpickr-month, .flatpickr-weekdays, span.flatpickr-weekday, .flatpickr-days, .dayContainer { background: transparent !important; background-color: transparent !important; }
                    .flatpickr-month { color: #e2e8f0 !important; fill: #e2e8f0 !important; }
                    .flatpickr-current-month, .flatpickr-current-month input.cur-year { color: #e2e8f0 !important; }
                    .flatpickr-current-month .flatpickr-monthDropdown-months { background: #16181f !important; color: #e2e8f0 !important; }
                    .flatpickr-prev-month svg, .flatpickr-next-month svg { fill: #94a3b8 !important; }
                    .flatpickr-prev-month:hover svg, .flatpickr-next-month:hover svg { fill: #e2e8f0 !important; }
                    span.flatpickr-weekday { color: #64748b !important; font-weight: 700 !important; }
                    .flatpickr-day { background: transparent !important; color: #94a3b8 !important; border: none !important; border-radius: 8px !important; }
                    .flatpickr-day:hover { background: rgba(255,255,255,0.08) !important; color: #e2e8f0 !important; border: none !important; }
                    .flatpickr-day.selected, .flatpickr-day.selected:hover { background: #e05560 !important; color: #fff !important; border: none !important; }
                    .flatpickr-day.today.selected, .flatpickr-day.today.selected:hover { background: #e05560 !important; color: #fff !important; border: none !important; }
                    .flatpickr-day.today { border: 1px solid rgba(224,85,96,0.5) !important; color: #e2e8f0 !important; }
                    .flatpickr-day.today.selected { border: none !important; }
                    .flatpickr-day.prevMonthDay, .flatpickr-day.nextMonthDay, .flatpickr-day.flatpickr-disabled { color: rgba(255,255,255,0.15) !important; background: transparent !important; }
                    .flatpickr-calendar.arrowTop::before, .flatpickr-calendar.arrowTop::after, .flatpickr-calendar.arrowBottom::before, .flatpickr-calendar.arrowBottom::after { display: none !important; }
                    .numInputWrapper span { border: none !important; opacity: 1 !important; visibility: visible !important; }
                    .numInputWrapper span:after { display: none !important; }
                    .numInputWrapper span.arrowUp::before { content: '\\f077' !important; font-family: 'Font Awesome 6 Free' !important; font-weight: 900 !important; font-size: 8px !important; color: #94a3b8 !important; }
                    .numInputWrapper span.arrowDown::before { content: '\\f078' !important; font-family: 'Font Awesome 6 Free' !important; font-weight: 900 !important; font-size: 8px !important; color: #94a3b8 !important; }
                    .numInputWrapper span:hover::before { color: #e2e8f0 !important; }
                    [data-theme="light"] .flatpickr-calendar { background: #ffffff !important; border-color: rgba(0,0,0,0.08) !important; box-shadow: 0 8px 32px rgba(0,0,0,0.12) !important; }
                    [data-theme="light"] .flatpickr-months, [data-theme="light"] .flatpickr-month, [data-theme="light"] .flatpickr-weekdays, [data-theme="light"] span.flatpickr-weekday, [data-theme="light"] .flatpickr-days, [data-theme="light"] .dayContainer { background: transparent !important; background-color: transparent !important; }
                    [data-theme="light"] .flatpickr-month, [data-theme="light"] .flatpickr-current-month, [data-theme="light"] .flatpickr-current-month input.cur-year { color: #1e293b !important; fill: #1e293b !important; }
                    [data-theme="light"] .flatpickr-current-month .flatpickr-monthDropdown-months { background: #ffffff !important; color: #1e293b !important; }
                    [data-theme="light"] .flatpickr-prev-month svg, [data-theme="light"] .flatpickr-next-month svg { fill: #64748b !important; }
                    [data-theme="light"] .flatpickr-prev-month:hover svg, [data-theme="light"] .flatpickr-next-month:hover svg { fill: #1e293b !important; }
                    [data-theme="light"] span.flatpickr-weekday { color: #94a3b8 !important; }
                    [data-theme="light"] .flatpickr-day { color: #475569 !important; }
                    [data-theme="light"] .flatpickr-day:hover { background: rgba(0,0,0,0.05) !important; color: #1e293b !important; }
                    [data-theme="light"] .flatpickr-day.selected, [data-theme="light"] .flatpickr-day.selected:hover { background: #D21723 !important; color: #fff !important; }
                    [data-theme="light"] .flatpickr-day.today.selected, [data-theme="light"] .flatpickr-day.today.selected:hover { background: #D21723 !important; color: #fff !important; border: none !important; }
                    [data-theme="light"] .flatpickr-day.today { border-color: rgba(210,23,35,0.4) !important; color: #1e293b !important; }
                    [data-theme="light"] .flatpickr-day.prevMonthDay, [data-theme="light"] .flatpickr-day.nextMonthDay, [data-theme="light"] .flatpickr-day.flatpickr-disabled { color: rgba(0,0,0,0.15) !important; background: transparent !important; }
                    [data-theme="light"] .numInputWrapper span.arrowUp::before, [data-theme="light"] .numInputWrapper span.arrowDown::before { color: #64748b !important; }
                    [data-theme="light"] .numInputWrapper span:hover::before { color: #1e293b !important; }
                `;
                document.head.appendChild(style);
            }
        },
        onClose(_, __, instance) {
            instance.input.blur();
        },
        onChange(selectedDates) {
            if (!selectedDates[0]) return;
            const scrollY = window.scrollY;
            const selectedDate = selectedDates[0];
            if (consolidatedData.length > 0) {
                generarReporteCompleto(selectedDate).then(reporte => {
                    currentReportData = reporte;
                    cargarDatosDia();
                    cargarDatosMes();
                    cargarDatosAño();
                    cargarDatosTendencia();
                    if (window.scrollY !== scrollY) window.scrollTo({ top: scrollY, behavior: 'instant' });
                });
            }
        }
    });

    window._datePicker = fp;

    dateIconBtn.addEventListener('click', e => {
        e.stopPropagation();
        const rect = dateIconBtn.getBoundingClientRect();
        const cal = fp.calendarContainer;
        fp.open();
        requestAnimationFrame(() => {
            const cw = cal.offsetWidth;
            const ch = cal.offsetHeight;
            const margin = 8;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            // Centrado bajo el botón
            let left = rect.left + (rect.width / 2) - (cw / 2);
            let top  = rect.bottom + margin;
            if (left < margin) left = margin;
            if (left + cw > vw - margin) left = vw - cw - margin;
            if (top + ch > vh - margin) top = rect.top - ch - margin;
            cal.style.left = left + 'px';
            cal.style.top  = top  + 'px';
        });
    });

    if (updateBtn) {
        updateBtn.addEventListener('click', () => {
            const selectedDate = fp.selectedDates[0] || new Date();
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

            // Alineado a la izquierda del botón
            let left = rect.left;
            let top  = rect.bottom + margin;
            if (left + pw > vw - margin) left = vw - pw - margin;
            if (left < margin) left = margin;
            if (top + ph > vh - margin) top = rect.top - ph - margin;

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
                // Cerrar otros paneles antes de abrir este
                window.closeAllPanels('proveedor');
                window.activePanels.proveedor = panel;
                
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
                const selectedDate = window._datePicker?.selectedDates[0] || new Date();
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

        const selectedDate = window._datePicker?.selectedDates[0] || new Date();

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

    activeBudgetData = filteredBudget;
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

    // Verificar si hay datos precargados
    const hasPreloadedData = checkPreloadedData();
    const skipLoadingScreen = hasPreloadedData && !forceReload && consolidatedData.length === 0;

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
        // Solo mostrar pantalla de carga si no hay datos precargados
        if (!silent && !skipLoadingScreen) {
            if (loadingOverlay) loadingOverlay.classList.add('active');
            if (loadingText) loadingText.textContent = "Actualizando datos...";
            if (loadingProgress) loadingProgress.style.width = '10%';
        } else if (silent) {
            showSilentToast('Actualizando datos...');
        }

        if (forceReload || consolidatedData.length === 0) {
            await cargarDatosIniciales(forceReload);
        }

        const reporte = await generarReporteCompleto(newDate);
        currentReportData = reporte;

        cargarDatosDia();
        cargarDatosMes();
        cargarDatosAño();
        cargarDatosTendencia();

        if (!silent && !skipLoadingScreen) {
            if (loadingProgress) loadingProgress.style.width = '100%';
            await new Promise(r => setTimeout(r, 300));
        } else if (silent) {
            showSilentToast('Datos actualizados', 'done');
            setTimeout(removeSilentToast, 1500);
        }
    } catch (error) {
        console.error("Update error:", error);
        if (silent) { showSilentToast('Error al actualizar', 'error'); setTimeout(removeSilentToast, 2000); }
        if (!consolidatedData || consolidatedData.length === 0) {
            if (typeof window.handleSupabaseConnectionLoss === 'function') {
                window.handleSupabaseConnectionLoss("No se pudieron cargar los datos de Supabase.");
            } else {
                sessionStorage.clear();
                window.location.replace('login.html');
            }
        }
    } finally {
        if (!silent && !skipLoadingScreen && loadingOverlay) {
            loadingOverlay.classList.add('closing');
            setTimeout(() => {
                loadingOverlay.classList.remove('active', 'closing');
            }, 400);
        }
        isLoading = false;
    }
}

async function cargarDatosIniciales(forceRefresh = false) {
    try {
        // Income (3 requests paralelas) + Budget (1 request batchGet) simultáneos
        const [incomeData, budget] = await Promise.all([
            getAllIncomeData(forceRefresh),
            getBudgetData(forceRefresh)
        ]);

        if (!incomeData || incomeData.length === 0) {
            throw new Error("Respuesta vacía de ingresos desde Supabase");
        }

        allIncomeData = incomeData;
        budgetData = budget;

        reconsolidateWithFilter();

        datosCargarEndpoint().catch(err => console.warn("Error en datosCargarEndpoint:", err));
    } catch (error) {
        console.error("Initial load error:", error);
        if (typeof window.handleSupabaseConnectionLoss === 'function') {
            window.handleSupabaseConnectionLoss("No se pudo conectar con Supabase durante la carga inicial.");
        } else {
            sessionStorage.clear();
            window.location.replace('login.html');
        }
        throw error;
    }
}

// Helper para verificar si hay datos precargados disponibles
function checkPreloadedData() {
    try {
        const preloadStr = sessionStorage.getItem('tdm_preload_data_v3');
        if (!preloadStr) return false;
        
        const preload = JSON.parse(preloadStr);
        const age = Date.now() - (preload.timestamp || 0);
        
        // Datos válidos por 5 minutos
        if (age > 5 * 60 * 1000) {
            sessionStorage.removeItem('tdm_preload_data_v3');
            return false;
        }
        
        return !!(preload.income && preload.budget);
    } catch (e) {
        return false;
    }
}

async function generarReporteCompleto(targetDate) {
    const fechaObj = parseDate(targetDate) || new Date();
    const currentYear = fechaObj.getFullYear();
    let currentResult = findClosestDateWithData(fechaObj, currentYear, consolidatedData);
    if (!currentResult && consolidatedData && consolidatedData.length > 0) {
        const lastItem = consolidatedData[consolidatedData.length - 1];
        currentResult = { date: parseDate(lastItem.Fecha), isExact: false, data: lastItem };
    }

    if (!currentResult) {
        console.warn("No hay datos consolidados disponibles para generar el reporte.");
        const emptyMetrics = {
            ingreso: 0, meta: 0, diferencia: 0, cumplimiento: '0%', porcentaje: 0, gestion: 0, registros: 0,
            unidades: 0, metaAcumulada: 0, promedioDiario: 0, diasLaborados: 0, diasRestantes: 0
        };
        return {
            filtros: { actual: formatDate(fechaObj), anterior: null },
            dia: { actual: { ...emptyMetrics }, anterior: null },
            mes: { actual: { ...emptyMetrics }, anterior: null },
            año: { actual: { ...emptyMetrics }, anterior: null }
        };
    }

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
    
    // Verificar si el usuario es OWNER
    let isOwner = false;
    try {
        const session = JSON.parse(sessionStorage.getItem('tdm_session') || 'null');
        if (session) {
            const userRole = (session.rol || 'USER').toUpperCase();
            isOwner = userRole === 'OWNER';
        }
    } catch(e) {}
    
    // Construir HTML del panel - solo incluir botones de comunicación si es OWNER
    let panelHTML = `
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
        </button>`;
    
    if (isOwner) {
        panelHTML += `
        <div class="settings-divider"></div>
        <button class="settings-item" id="usersBtn">
            <i class="fas fa-users-cog"></i><span>Gestión de Usuarios</span>
        </button>
        <div class="settings-divider"></div>
        <button class="settings-item" id="whatsappBtn">
            <i class="fab fa-whatsapp"></i><span>Enviar WhatsApp</span>
        </button>
        <button class="settings-item" id="emailBtn">
            <i class="fas fa-envelope"></i><span>Enviar Email</span>
        </button>`;
    }
    
    panel.innerHTML = panelHTML;
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
    const usersBtn   = panel.querySelector('#usersBtn');
    const waBtn      = panel.querySelector('#whatsappBtn');
    const emBtn      = panel.querySelector('#emailBtn');

    // ── Posicionar saliendo del botón, ajustando si se sale de pantalla ──────
    function positionPanel() {
        const rect   = btn.getBoundingClientRect();
        const pw     = panel.offsetWidth  || 210;
        const ph     = panel.offsetHeight || 200;
        const margin = 8;
        const vw     = window.innerWidth;
        const vh     = window.innerHeight;

        // Alineado a la derecha del botón
        let left = rect.right - pw;
        let top  = rect.bottom + margin;
        if (left < margin) left = margin;
        if (left + pw > vw - margin) left = vw - pw - margin;
        if (top + ph > vh - margin) top = rect.top - ph - margin;

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
            // Cerrar otros paneles antes de abrir este
            window.closeAllPanels('settings');
            window.activePanels.settings = panel;
            
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

    updateBtn.addEventListener('click', () => {
        closePanel();
        const icon = updateBtn.querySelector('i');
        icon.classList.add('fa-spin');
        const date = window._datePicker?.selectedDates[0] || new Date();
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
        updateThemeColor();
    }

    applyParticles();

    partBtn.addEventListener('click', () => {
        particlesOff = !particlesOff;
        localStorage.setItem('particlesOff', particlesOff);
        applyParticles();
        closePanel();
    });

    // ── Tema ──────────────────────────────────────────────────────────────────
    // Actualiza el meta theme-color para iOS PWA (status bar / dynamic island)
    function updateThemeColor() {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const isSolid = document.documentElement.classList.contains('solid');
        let color;
        if (isLight) {
            color = isSolid ? '#ffffff' : '#f1f5f9';
        } else {
            color = isSolid ? '#16181f' : '#080a0f';
        }
        // Meta tag — lo que iOS usa para la barra de estado
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.appendChild(meta);
        }
        meta.content = color;
        // También forzar el background del html para que iOS lo lea sin importar partículas
        document.documentElement.style.backgroundColor = color;
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeIcon.className   = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        themeLabel.textContent = theme === 'light' ? 'Modo oscuro' : 'Modo claro';
        updateThemeColor();
        if (typeof particlesReinit === 'function') particlesReinit();
        // Use LOGO-ORIGINAL.svg for all themes
        const logoInnerSrc = 'logo/LOGO-ORIGINAL.svg';
        const headerLogo  = document.getElementById('headerLogo');
        const loadingLogo = document.getElementById('loadingLogo');
        if (headerLogo)  headerLogo.src  = logoInnerSrc;
        if (loadingLogo) loadingLogo.src = logoInnerSrc;
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
        updateThemeColor();
    }

    applySolid();

    solidBtn.addEventListener('click', () => {
        solidMode = !solidMode;
        applySolid();
        closePanel();
    });

    // ── Gestión de Usuarios (solo si existe - OWNER) ─────────────────────────
    if (usersBtn) {
        usersBtn.addEventListener('click', e => {
            e.preventDefault();
            closePanel();
            openUsersManagementModal();
        });
    }

    // ── WhatsApp (solo si existe - OWNER) ────────────────────────────────────
    if (waBtn) {
        waBtn.addEventListener('click', e => {
            e.preventDefault();
            closePanel();
            const icon = waBtn.querySelector('i');
            const orig = icon.className;
            icon.className = 'fas fa-spinner fa-spin';
            captureAndDownloadCards(true).finally(() => { icon.className = orig; });
        });
    }

    // ── Email (solo si existe - OWNER) ───────────────────────────────────────
    if (emBtn) {
        emBtn.addEventListener('click', e => {
            e.preventDefault();
            closePanel();
            const icon = emBtn.querySelector('i');
            const orig = icon.className;
            icon.className = 'fas fa-spinner fa-spin';
            sendEmailReport(true).finally(() => { icon.className = orig; });
        });
    }
})();

// ── Loading Stream ────────────────────────────────────────────────────────────

// ── Loading Stream ────────────────────────────────────────────────────────────
(function () {
    const LINES = [
        ['Grupo TDM', 'mid'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'indigo'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'yellow'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'indigo'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'yellow'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'mid'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'bright'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'yellow'],
        ['Grupo TDM', 'indigo'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'mid'],
        ['Grupo TDM', 'red'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'bright'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'indigo'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'mid'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'bright'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'indigo'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'bright'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'yellow'],
        ['Grupo TDM', 'mid'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'bright'],
        ['Grupo TDM', 'indigo'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'yellow'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'mid'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'bright'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'indigo'],
        ['Grupo TDM', 'bright'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'yellow'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'red'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'bright'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'indigo'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'yellow'],
        ['Grupo TDM', 'mid'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'bright'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'indigo'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'yellow'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'red'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'bright'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'indigo'],
        ['Grupo TDM', 'bright'],
        ['Grupo TDM', 'yellow'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'indigo'],
        ['Grupo TDM', 'bright'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'yellow'],
        ['Grupo TDM', 'mid'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'indigo'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'cyan'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'indigo'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'yellow'],
        ['Grupo TDM', 'dim'],
        ['Grupo TDM', 'accent'],
        ['Grupo TDM', 'bright'],
    ];

    let currentEl = null;
    let idx = 0;
    let timer = null;

    function showNext() {
        /* desactivado — texto estático en HTML */
    }

    function startStream() { /* texto estático, no se necesita */ }

    function stopStream() {
        clearTimeout(timer);
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
        tip.innerHTML = text;
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
        const tooltipEl = trigger.querySelector('.tooltiptext');
        const text = tooltipEl?.innerHTML?.trim();
        if (text) showTip(text, trigger);
    });

    document.addEventListener('mouseout', e => {
        if (e.target.closest('.tooltip')) hideTip();
    });

    // Touch — tap para mostrar/ocultar
    document.addEventListener('touchstart', e => {
        const trigger = e.target.closest('.tooltip');
        if (!trigger) { hideTip(); return; }
        const tooltipEl = trigger.querySelector('.tooltiptext');
        const text = tooltipEl?.innerHTML?.trim();
        if (!text) return;
        e.preventDefault();
        if (tip.classList.contains('visible') && tip.innerHTML === text) {
            hideTip();
        } else {
            showTip(text, trigger);
        }
    }, { passive: false });

    // Ocultar al hacer scroll
    window.addEventListener('scroll', () => tip.classList.remove('visible'), { passive: true });
})();


