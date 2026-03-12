/**
 * calidad.js — Lógica para Dashboard de Calidad con Infinite Scroll e Instagram Style Grid
 */

let gsReportes = [];
let gsFilteredReportes = [];
let itemsToShow = 12; // Cantidad inicial
const batchSize = 12; // Cuántos cargar en cada scroll
let isLoadingMore = false;
let dateRangePicker = null;
let selectedDateRange = null;

/**
 * Se inicializa cuando carga la página calidad.html
 */
window.onload = async function() {
    if (typeof initParticles === 'function') initParticles();
    
    // loadUsers() en auth.js ejecuta fetchSecureConfig() y extrae la data de todos los usuarios
    await loadUsers(); 
    
    // Cargar datos de calidad usando la configuración ya precargada
    await cargarDatosCalidadLocal();
    setupInfiniteScroll();
    initDateRangePicker();
};

/**
 * Toggle de KPIs en móvil
 */
function toggleKPIs() {
    const container = document.getElementById('kpiContainer');
    const icon = document.getElementById('kpiToggleIcon');
    
    if (container && icon) {
        container.classList.toggle('open');
        icon.classList.toggle('open');
    }
}

/**
 * Carga inicial de datos desde Sheets con optimización de velocidad
 */
async function cargarDatosCalidadLocal() {
    const loader = document.getElementById('initialLoader');
    const dataSection = document.getElementById('qualityFeed');
    
    if (loader) loader.style.display = 'block';

    try {
        // La configuración ya está cargada por loadUsers(), no necesitamos esperar
        // Carga de datos directamente desde Sheets API para máxima velocidad
        gsReportes = await fetchReportesData();
        
        if (!gsReportes || gsReportes.length === 0) {
            if (loader) {
                loader.innerHTML = `
                    <div class="py-5 text-center">
                        <i class="fas fa-database mb-3" style="font-size: 3rem; color: #e2e8f0;"></i>
                        <p class="text-muted fw-800">NO SE ENCONTRARON REGISTROS</p>
                        <p class="small text-muted">La base de datos de calidad está vacía o no es accesible.</p>
                    </div>
                `;
            }
            return;
        }

        // Ordenar por fecha recíproca (más nuevos primero) usando motor resiliente
        gsReportes.sort((a, b) => {
            const dateA = parsearFechaLatina(a.TIMESTAMP) || new Date(0);
            const dateB = parsearFechaLatina(b.TIMESTAMP) || new Date(0);
            return dateB - dateA;
        });

        gsFilteredReportes = [...gsReportes];
        
        actualizarKPIs();
        renderReportGrid(true); // true para resetear vista
        
        if (loader) loader.style.display = 'none';
        if (dataSection) dataSection.style.display = 'grid';
        
        // Reinicializar el date picker si existe
        if (dateRangePicker) {
            dateRangePicker.clear();
            selectedDateRange = null;
        }
        
    } catch (error) {
        console.error('Error crítico calidad:', error);
        if (loader) {
            loader.innerHTML = `
                <div class="py-5 text-center text-danger">
                    <i class="fas fa-exclamation-circle mb-3" style="font-size: 3.5rem;"></i>
                    <p class="fw-800 mb-1">FALLO AL SINCRONIZAR</p>
                    <p class="small opacity-75 mb-3">Error: ${error.message}</p>
                    <button class="btn btn-primary rounded-pill px-4" onclick="recargarDatosCalidad()">REINTENTAR AHORA</button>
                </div>
            `;
        }
    }
}

/**
 * Función para recargar datos manualmente (botón RECARGAR)
 */
async function recargarDatosCalidad() {
    const loader = document.getElementById('initialLoader');
    const dataSection = document.getElementById('qualityFeed');
    
    if (loader) loader.style.display = 'block';
    if (dataSection) dataSection.style.display = 'none';
    
    try {
        gsReportes = await fetchReportesData();
        
        if (!gsReportes || gsReportes.length === 0) {
            if (loader) {
                loader.innerHTML = `
                    <div class="py-5 text-center">
                        <i class="fas fa-database mb-3" style="font-size: 3rem; color: #e2e8f0;"></i>
                        <p class="text-muted fw-800">NO SE ENCONTRARON REGISTROS</p>
                        <p class="small text-muted">La base de datos de calidad está vacía o no es accesible.</p>
                    </div>
                `;
            }
            return;
        }

        gsReportes.sort((a, b) => {
            const dateA = parsearFechaLatina(a.TIMESTAMP) || new Date(0);
            const dateB = parsearFechaLatina(b.TIMESTAMP) || new Date(0);
            return dateB - dateA;
        });

        // Limpiar filtros
        if (dateRangePicker) {
            dateRangePicker.clear();
            selectedDateRange = null;
        }
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';

        gsFilteredReportes = [...gsReportes];
        
        actualizarKPIs();
        renderReportGrid(true);
        
        if (loader) loader.style.display = 'none';
        if (dataSection) dataSection.style.display = 'grid';
        
        Swal.fire({
            icon: 'success',
            title: 'Datos actualizados',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });
        
    } catch (error) {
        console.error('Error al recargar:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al recargar',
            text: error.message,
            confirmButtonColor: '#3F51B5'
        });
        if (loader) loader.style.display = 'none';
    }
}

/**
 * Motor de parseo de fechas robusto que maneja fechas con hora
 */
function parsearFechaLatina(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    let s = String(d).trim();
    if (!s) return null;

    // Separar fecha y hora si existe
    const parts = s.split(/\s+/);
    const datePart = parts[0];
    const timePart = parts[1] || '00:00:00';
    
    // Detectar separador de fecha
    const sep = datePart.includes('/') ? '/' : (datePart.includes('-') ? '-' : null);
    if (!sep) return new Date(d);
    
    const dateParts = datePart.split(sep);
    if (dateParts.length !== 3) return new Date(d);
    
    let dia, mes, anio;
    
    // Formato dd/mm/yyyy o dd-mm-yyyy
    if (dateParts[2].length === 4) {
        dia = parseInt(dateParts[0]);
        mes = parseInt(dateParts[1]) - 1;
        anio = parseInt(dateParts[2]);
    } 
    // Formato yyyy/mm/dd o yyyy-mm-dd
    else if (dateParts[0].length === 4) {
        anio = parseInt(dateParts[0]);
        mes = parseInt(dateParts[1]) - 1;
        dia = parseInt(dateParts[2]);
    } else {
        return new Date(d);
    }
    
    // Parsear hora si existe
    const timeParts = timePart.split(':');
    const hora = parseInt(timeParts[0]) || 0;
    const minuto = parseInt(timeParts[1]) || 0;
    const segundo = parseInt(timeParts[2]) || 0;
    
    return new Date(anio, mes, dia, hora, minuto, segundo);
}

/**
 * Actualiza los indicadores KPIs del dashboard basándose en los datos reales de REPORTES
 */
function actualizarKPIs() {
    // Usar los datos filtrados para los KPIs
    const data = gsFilteredReportes.length > 0 ? gsFilteredReportes : gsReportes;
    
    if (!data.length) {
        document.getElementById('kpi-total').textContent = '0';
        document.getElementById('kpi-ok').textContent = '0';
        document.getElementById('kpi-rejected').textContent = '0';
        document.getElementById('kpi-audit').textContent = '0';
        document.getElementById('kpi-ronda').textContent = '0';
        document.getElementById('kpi-contramuestra').textContent = '0';
        document.getElementById('kpi-seguimiento').textContent = '0';
        document.getElementById('kpi-plants').textContent = '0';
        return;
    }

    // Total de reportes
    const total = data.length;
    document.getElementById('kpi-total').textContent = total;

    // Contar por CONCLUSION (campo real de la tabla)
    let aprobados = 0;
    let rechazados = 0;

    data.forEach(r => {
        const conclusion = (r.CONCLUSION || '').toUpperCase().trim();
        
        // Aprobados: APROBADO, SATISFACTORIO, CUMPLE
        if (conclusion.includes('APROBADO') || 
            conclusion.includes('SATISFACTORIO') || 
            conclusion.includes('CUMPLE')) {
            aprobados++;
        } 
        // Rechazados: RECHAZADO, NO CUMPLE, NO CONFORME
        else if (conclusion.includes('RECHAZADO') || 
                 conclusion.includes('NO CUMPLE') || 
                 conclusion.includes('NO CONFORME')) {
            rechazados++;
        }
    });

    document.getElementById('kpi-ok').textContent = aprobados;
    document.getElementById('kpi-rejected').textContent = rechazados;

    // Contar por TIPO_VISITA (campo real de la tabla)
    // Los valores exactos del formulario son: AUDITORIA, RONDA, CONTRAMUESTRA, SEGUIMIENTO
    let auditorias = 0;
    let rondas = 0;
    let contramuestras = 0;
    let seguimientos = 0;

    data.forEach(r => {
        const tipoVisita = (r.TIPO_VISITA || '').toUpperCase().trim();
        
        if (tipoVisita === 'AUDITORIA') {
            auditorias++;
        } else if (tipoVisita === 'RONDA') {
            rondas++;
        } else if (tipoVisita === 'CONTRAMUESTRA') {
            contramuestras++;
        } else if (tipoVisita === 'SEGUIMIENTO') {
            seguimientos++;
        }
    });

    document.getElementById('kpi-audit').textContent = auditorias;
    document.getElementById('kpi-ronda').textContent = rondas;
    document.getElementById('kpi-contramuestra').textContent = contramuestras;
    document.getElementById('kpi-seguimiento').textContent = seguimientos;

    // Contar PLANTAS únicas (campo real de la tabla)
    const plantasUnicas = new Set(
        data.map(r => (r.PLANTA || '').trim())
            .filter(p => p && p !== '')
    );
    document.getElementById('kpi-plants').textContent = plantasUnicas.size;
}

/**
 * Renderiza la cuadrícula (Infinity Scroll enabled)
 */
function renderReportGrid(reset = false) {
    const feed = document.getElementById('qualityFeed');
    if (!feed) return;

    if (reset) {
        feed.innerHTML = '';
        itemsToShow = batchSize;
    }

    const currentCount = feed.children.length;
    const dataToRender = gsFilteredReportes.slice(currentCount, itemsToShow);

    if (dataToRender.length === 0 && currentCount === 0) {
        feed.innerHTML = `
            <div class="col-12 text-center py-5 text-muted">
                <i class="fas fa-search mb-3" style="font-size: 2.5rem; opacity: 0.3;"></i>
                <p class="fw-bold">No hay reportes que coincidan con la búsqueda.</p>
            </div>
        `;
        return;
    }

    dataToRender.forEach(rep => {
        feed.appendChild(createReportCard(rep));
    });
}

/**
 * Crea el componente DOM para cada reporte usando los campos reales de REPORTES
 */
function createReportCard(rep) {
    const div = document.createElement('div');
    div.className = 'report-card-lux';
    
    // SOPORTE: imagen o video del reporte
    const soporteUrl = rep.SOPORTE || 'https://i.ibb.co/r34f0Z5/ORCA-GIFS.gif';
    const esVideo = soporteUrl.includes('/preview') || soporteUrl.includes('drive.google.com/file');
    
    // FECHA: fecha del reporte
    const fecha = rep.FECHA || 'S/F';
    
    // CONCLUSION: estado del reporte
    const conclusion = (rep.CONCLUSION || 'PENDIENTE').toUpperCase();
    
    let statusClass = 'bg-secondary';
    const conclusionLower = conclusion.toLowerCase();
    if (conclusionLower.includes('satisfactorio') || 
        conclusionLower.includes('aprobado') || 
        conclusionLower.includes('ok') ||
        conclusionLower.includes('cumple') ||
        conclusionLower.includes('conforme')) {
        statusClass = 'bg-success';
    } else if (conclusionLower.includes('rechazado') || 
               conclusionLower.includes('fallido') || 
               conclusionLower.includes('no cumple') ||
               conclusionLower.includes('no conforme')) {
        statusClass = 'bg-danger';
    } else if (conclusionLower.includes('observacion') || 
               conclusionLower.includes('observación') || 
               conclusionLower.includes('pendiente')) {
        statusClass = 'bg-warning text-dark';
    }

    // Contenido multimedia (imagen o video)
    let mediaContent;
    if (esVideo) {
        mediaContent = `
            <iframe src="${soporteUrl}" 
                style="width:100%; height:100%; border:0;" 
                allow="autoplay" 
                loading="lazy">
            </iframe>
        `;
    } else {
        mediaContent = `
            <img src="${soporteUrl}" 
                alt="Calidad" 
                loading="lazy" 
                onerror="this.src='https://i.ibb.co/r34f0Z5/ORCA-GIFS.gif'">
        `;
    }

    div.innerHTML = `
        <span class="lote-tag-lux">${rep.LOTE || 'LOTE'}</span>
        <div class="report-img-container">
            ${mediaContent}
        </div>
        <div class="report-content-lux">
            <h3 class="report-title-lux">${rep.REFERENCIA || 'REFERENCIA'}</h3>
            <div class="report-info-row">
                <span><i class="far fa-calendar-alt me-1"></i> ${fecha}</span>
                <span><i class="fas fa-industry me-1"></i> ${rep.PLANTA || 'S/P'}</span>
            </div>
            <p class="report-summary-lux">${rep.OBSERVACIONES || 'Sin observaciones.'}</p>
            <div class="report-footer-lux">
                <span class="status-badge-lux ${statusClass} text-white">${conclusion}</span>
                <button class="btn btn-sm btn-link text-primary fw-800 p-0 text-decoration-none" 
                    onclick="expandReport('${rep.TIMESTAMP}')">
                    VER <i class="fas fa-arrow-right ms-1"></i>
                </button>
            </div>
        </div>
    `;
    return div;
}

/**
 * Configuración del scroll infinito
 */
function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if (isLoadingMore) return;
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) {
            if (gsFilteredReportes.length > document.getElementById('qualityFeed')?.children.length) {
                loadMore();
            }
        }
    });
}

async function loadMore() {
    isLoadingMore = true;
    const loader = document.getElementById('scrollLoader');
    if (loader) loader.style.display = 'block';

    itemsToShow += batchSize;
    renderReportGrid(false);

    if (loader) loader.style.display = 'none';
    isLoadingMore = false;
}

/**
 * Inicializa el selector de rango de fechas con Flatpickr
 * Configurado para trabajar con fechas que incluyen hora
 */
function initDateRangePicker() {
    const input = document.getElementById('dateRangePicker');
    if (!input || typeof flatpickr === 'undefined') return;

    dateRangePicker = flatpickr(input, {
        mode: 'range',
        dateFormat: 'd/m/Y',
        locale: 'es',
        allowInput: false,
        onChange: function(selectedDates) {
            if (selectedDates.length === 2) {
                // Establecer el rango completo del día
                const startDate = new Date(selectedDates[0]);
                startDate.setHours(0, 0, 0, 0);
                
                const endDate = new Date(selectedDates[1]);
                endDate.setHours(23, 59, 59, 999);
                
                selectedDateRange = {
                    start: startDate,
                    end: endDate
                };
                applyFilters();
            }
        },
        onClose: function(selectedDates) {
            if (selectedDates.length === 0) {
                selectedDateRange = null;
                applyFilters();
            }
        }
    });
}

/**
 * Aplica todos los filtros activos (búsqueda + fechas)
 */
function applyFilters() {
    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    
    gsFilteredReportes = gsReportes.filter(r => {
        // Filtro de búsqueda por texto
        const matchesSearch = !searchTerm || 
            (r.LOTE || '').toLowerCase().includes(searchTerm) ||
            (r.REFERENCIA || '').toLowerCase().includes(searchTerm) ||
            (r.PLANTA || '').toLowerCase().includes(searchTerm) ||
            (r.CONCLUSION || '').toLowerCase().includes(searchTerm);

        // Filtro de rango de fechas
        let matchesDate = true;
        if (selectedDateRange) {
            // Intentar parsear la fecha del reporte (puede tener hora)
            const reportDate = parsearFechaLatina(r.FECHA);
            if (reportDate && reportDate instanceof Date && !isNaN(reportDate)) {
                // Comparar solo las fechas, ignorando la hora
                const reportDateOnly = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
                const startDateOnly = new Date(selectedDateRange.start.getFullYear(), selectedDateRange.start.getMonth(), selectedDateRange.start.getDate());
                const endDateOnly = new Date(selectedDateRange.end.getFullYear(), selectedDateRange.end.getMonth(), selectedDateRange.end.getDate());
                
                matchesDate = reportDateOnly >= startDateOnly && reportDateOnly <= endDateOnly;
            } else {
                // Si no se puede parsear la fecha, no filtrar por fecha
                matchesDate = true;
            }
        }

        return matchesSearch && matchesDate;
    });

    actualizarKPIs();
    renderReportGrid(true);
}

/**
 * Filtrado dinámico por texto
 */
function handleSearch() {
    applyFilters();
}

/**
 * Detalle expandido con SweetAlert2 mostrando todos los campos de REPORTES
 */
function expandReport(timestamp) {
    const rep = gsReportes.find(r => String(r.TIMESTAMP) === String(timestamp));
    if (!rep) return;

    // Formatear tipo de visita con icono específico
    const tipoVisita = (rep.TIPO_VISITA || 'No especificado').toUpperCase();
    let tipoIcon = 'fa-clipboard-check';
    let tipoColor = '#8b5cf6';
    
    if (tipoVisita === 'AUDITORIA') {
        tipoIcon = 'fa-clipboard-check';
        tipoColor = '#8b5cf6';
    } else if (tipoVisita === 'RONDA') {
        tipoIcon = 'fa-route';
        tipoColor = '#06b6d4';
    } else if (tipoVisita === 'CONTRAMUESTRA') {
        tipoIcon = 'fa-vial';
        tipoColor = '#f59e0b';
    } else if (tipoVisita === 'SEGUIMIENTO') {
        tipoIcon = 'fa-tasks';
        tipoColor = '#ec4899';
    }

    // Detectar si el soporte es video o imagen
    const soporteUrl = rep.SOPORTE || '';
    const esVideo = soporteUrl.includes('/preview') || soporteUrl.includes('drive.google.com/file');
    
    let mediaHTML = '';
    if (soporteUrl) {
        if (esVideo) {
            mediaHTML = `
                <div class="mt-4 overflow-hidden rounded-4 border shadow-sm" style="position: relative; padding-bottom: 56.25%; height: 0;">
                    <iframe src="${soporteUrl}" 
                        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" 
                        allow="autoplay; fullscreen" 
                        allowfullscreen>
                    </iframe>
                </div>
            `;
        } else {
            mediaHTML = `<div class="mt-4 overflow-hidden rounded-4 border shadow-sm"><img src="${soporteUrl}" style="width:100%;"></div>`;
        }
    }

    Swal.fire({
        title: null,
        html: `
            <div class="text-start" style="font-family: 'Inter', sans-serif; padding: 5px;">
                <div class="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom">
                    <div style="background: linear-gradient(135deg, #3f51b5, #6366f1); color: white; width: 50px; height: 50px; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
                        <i class="fas fa-microscope"></i>
                    </div>
                    <div>
                        <h4 class="mb-0 fw-800" style="color: #0f172a;">Reporte de Calidad</h4>
                        <span class="text-muted small">ID: ${rep.TIMESTAMP}</span>
                    </div>
                </div>

                <div class="row g-3">
                    <div class="col-6">
                        <label class="text-muted small fw-bold text-uppercase d-block mb-1">Lote</label>
                        <div class="fw-800" style="color: #3f51b5;">${rep.LOTE || 'N/A'}</div>
                    </div>
                    <div class="col-6">
                        <label class="text-muted small fw-bold text-uppercase d-block mb-1">Fecha</label>
                        <div class="fw-bold">${rep.FECHA || 'N/A'}</div>
                    </div>
                    <div class="col-6">
                        <label class="text-muted small fw-bold text-uppercase d-block mb-1">Referencia</label>
                        <div class="fw-bold">${rep.REFERENCIA || 'N/A'}</div>
                    </div>
                    <div class="col-6">
                        <label class="text-muted small fw-bold text-uppercase d-block mb-1">Cantidad</label>
                        <div class="fw-bold">${rep.CANTIDAD || 'N/A'}</div>
                    </div>
                    <div class="col-6">
                        <label class="text-muted small fw-bold text-uppercase d-block mb-1">Planta</label>
                        <div class="fw-bold">${rep.PLANTA || 'N/A'}</div>
                    </div>
                    <div class="col-6">
                        <label class="text-muted small fw-bold text-uppercase d-block mb-1">Línea</label>
                        <div class="fw-bold">${rep.LINEA || 'N/A'}</div>
                    </div>
                    <div class="col-12">
                        <label class="text-muted small fw-bold text-uppercase d-block mb-1">Proceso</label>
                        <div class="fw-bold">${rep.PROCESO || 'N/A'}</div>
                    </div>
                    <div class="col-12">
                        <div class="p-3 rounded-4 border" style="background: ${tipoColor}15; border-color: ${tipoColor}40 !important;">
                            <label class="text-muted small fw-bold text-uppercase d-block mb-1">
                                <i class="fas ${tipoIcon} me-1"></i> Tipo de Visita
                            </label>
                            <div class="fw-800" style="color: ${tipoColor};">${tipoVisita}</div>
                        </div>
                    </div>
                    <div class="col-12">
                        <div class="p-3 bg-light rounded-4 border">
                            <label class="text-muted small fw-bold text-uppercase d-block mb-1">Conclusión Final</label>
                            <div class="fw-800 text-primary uppercase"><i class="fas fa-award me-2"></i>${rep.CONCLUSION || 'N/A'}</div>
                        </div>
                    </div>
                    <div class="col-12">
                        <label class="text-muted small fw-bold text-uppercase d-block mb-1">Observaciones</label>
                        <p class="text-secondary small" style="white-space: pre-wrap;">${rep.OBSERVACIONES || 'Sin observaciones'}</p>
                    </div>
                    <div class="col-12">
                        <label class="text-muted small fw-bold text-uppercase d-block mb-1">Inspector</label>
                        <div class="fw-bold"><i class="fas fa-user-check me-2"></i>${rep.EMAIL || 'N/A'}</div>
                    </div>
                    ${rep.LOCALIZACION ? `
                    <div class="col-12">
                        <label class="text-muted small fw-bold text-uppercase d-block mb-1">Ubicación GPS</label>
                        <div class="fw-bold"><i class="fas fa-map-marker-alt me-2"></i>${rep.LOCALIZACION}</div>
                    </div>
                    ` : ''}
                </div>

                ${mediaHTML}
            </div>
        `,
        confirmButtonText: 'CERRAR',
        confirmButtonColor: '#3f51b5',
        width: '600px',
        customClass: { popup: 'rounded-5', confirmButton: 'rounded-pill px-5 fw-800' }
    });
}
