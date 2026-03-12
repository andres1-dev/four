/* ==========================================================================
   resolucion.js — Lógica para la vista de Resolución (Ultra Compact Cards)
   ========================================================================== */

let gsNovedades = [];
let gsPlantas = [];
let gsCurrentPage = 1;
const gsRecordsPerPage = 6;

window.onload = async function () {
    if (typeof initParticles === 'function') initParticles();
    if (typeof loadUsers === 'function') loadUsers();
    
    // Aplicar modo compacto si estaba guardado
    const isCompact = localStorage.getItem('viewModeResolucion') === 'compact';
    if (isCompact) {
        document.getElementById('novedadesFeed')?.classList.add('is-compact');
        document.getElementById('toggleViewMode')?.classList.add('active');
    }

    await cargarDatos();
};

/**
 * Alterna entre vista de lista (detallada) y vista de grid (compacta)
 */
function toggleCompactView() {
    const feed = document.getElementById('novedadesFeed');
    const btn = document.getElementById('toggleViewMode');
    if (!feed || !btn) return;

    const isCompact = feed.classList.toggle('is-compact');
    btn.classList.toggle('active');

    localStorage.setItem('viewModeResolucion', isCompact ? 'compact' : 'expanded');
    
    // Si la paginación cambia de layout, forzamos reflow o scroll top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function cargarDatos() {
    const loader = document.getElementById('loader');
    const section = document.getElementById('dataSection');

    try {
        // PASO 1: Recuperar llaves de API desde GAS (Seguridad)
        await fetchSecureConfig();

        const [novedades, plantas] = await Promise.all([
            fetchNovedadesData(),
            fetchPlantasData()
        ]);

        gsNovedades = novedades;
        gsPlantas = plantas;

        // Verificar si hay datos
        if (!gsNovedades || gsNovedades.length === 0) {
            if (loader) {
                loader.innerHTML = `
                    <div class="py-5 text-center">
                        <i class="fas fa-clipboard-list mb-3" style="font-size: 3rem; color: #e2e8f0;"></i>
                        <p class="text-muted fw-800">NO SE ENCONTRARON REGISTROS</p>
                        <p class="small text-muted">La base de datos de novedades está vacía o no es accesible.</p>
                    </div>
                `;
            }
            return;
        }

        updateStats();

        gsNovedades.sort((a, b) => {
            const estA = a.ESTADO || 'PENDIENTE';
            const estB = b.ESTADO || 'PENDIENTE';
            const isA_Fin = (estA === 'FINALIZADO');
            const isB_Fin = (estB === 'FINALIZADO');
            if (isA_Fin !== isB_Fin) return isA_Fin ? 1 : -1;
            const dateA = parsearFechaLatina(a.FECHA) || new Date(0);
            const dateB = parsearFechaLatina(b.FECHA) || new Date(0);
            return dateA - dateB; // Antigüedad: más viejos primero
        });

        renderTabla(gsNovedades);
        if (loader) loader.style.display = 'none';
        if (section) section.style.display = 'block';

    } catch (error) {
        console.error('Error:', error);
        if (loader) {
            loader.innerHTML = `
                <div class="py-5 text-center text-danger">
                    <i class="fas fa-exclamation-circle mb-3" style="font-size: 3.5rem;"></i>
                    <p class="fw-800 mb-1">FALLO AL SINCRONIZAR</p>
                    <p class="small opacity-75 mb-3">Error: ${error.message}</p>
                    <button class="btn btn-primary rounded-pill px-4" onclick="cargarDatos()">REINTENTAR AHORA</button>
                </div>
            `;
        }
    }
}

function updateStats() {
    const stats = {
        PENDIENTE: { lots: 0, qty: 0 },
        ELABORACION: { lots: 0, qty: 0 },
        FINALIZADO: { lots: 0, qty: 0 }
    };

    gsNovedades.forEach(n => {
        const est = n.ESTADO || 'PENDIENTE';
        if (stats[est]) {
            stats[est].lots++;
            stats[est].qty += parseFloat(n.CANTIDAD_SOLICITADA || 0);
        }
    });

    const updateEl = (idVal, idQty, data) => {
        const elV = document.getElementById(idVal);
        const elQ = document.getElementById(idQty);
        if (elV) elV.textContent = data.lots;
        if (elQ) elQ.textContent = `${Math.round(data.qty)} UND`;
    };

    // Desktop
    updateEl('stat-pending', 'stat-pending-qty', stats.PENDIENTE);
    updateEl('stat-process', 'stat-process-qty', stats.ELABORACION);
    updateEl('stat-done', 'stat-done-qty', stats.FINALIZADO);

    // Mobile (Unificado)
    const mP = document.getElementById('m-stat-pending');
    const mR = document.getElementById('m-stat-process');
    const mD = document.getElementById('m-stat-done');
    if (mP) mP.textContent = stats.PENDIENTE.lots;
    if (mR) mR.textContent = stats.ELABORACION.lots;
    if (mD) mD.textContent = stats.FINALIZADO.lots;
}

function handleFilter() {
    gsCurrentPage = 1;
    const term = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
    renderTabla(gsNovedades.filter(n => {
        if (!term) return true;
        return (n.LOTE || '').toLowerCase().includes(term) ||
            (n.PLANTA || '').toLowerCase().includes(term) ||
            (n.ID_RADICADO || '').toLowerCase().includes(term) ||
            (n.DESCRIPCION || '').toLowerCase().includes(term);
    }));
}

/**
 * Renderiza el feed de novedades en formato ULTRA COMPACTO con Trazabilidad.
 */
function renderTabla(data = gsNovedades) {
    const feed = document.getElementById('novedadesFeed');
    const pagContainer = document.getElementById('paginationFeed');
    if (!feed) return;

    const mostrarFinalizados = document.getElementById('toggleFinalizados')?.checked;
    updateStats();
    feed.innerHTML = '';
    if (pagContainer) pagContainer.innerHTML = '';

    let datosMostrar = data;
    if (!mostrarFinalizados) {
        datosMostrar = data.filter(nov => nov.ESTADO !== 'FINALIZADO');
    }

    if (!datosMostrar || datosMostrar.length === 0) {
        feed.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-search mb-3" style="font-size: 2.5rem; color: #cbd5e1;"></i>
                <p class="text-muted fw-bold mb-1">Sin registros coincidentes</p>
                <p class="small text-muted">Intenta ajustar los filtros de búsqueda.</p>
            </div>
        `;
        return;
    }

    // Lógica de Paginación
    const totalRecords = datosMostrar.length;
    const sliceStart = (gsCurrentPage - 1) * gsRecordsPerPage;
    const sliceEnd = sliceStart + gsRecordsPerPage;
    const paginatedData = datosMostrar.slice(sliceStart, sliceEnd);

    if (totalRecords > gsRecordsPerPage) {
        renderPaginacion(totalRecords, data);
    }

    paginatedData.forEach((nov) => {
        const dtIngreso = parsearFechaLatina(nov.FECHA);
        const dtSalida = nov.SALIDA ? parsearFechaLatina(nov.SALIDA) : null;
        const estadoActual = nov.ESTADO || 'PENDIENTE';
        const infoPlanta = obtenerPlantaReciente(nov.PLANTA);

        // Calcular días hábiles
        const totalDias = calcularDiasHabiles(dtIngreso, dtSalida || new Date());

        const card = document.createElement('div');
        const statusClass = `status-${estadoActual.toLowerCase()}`;
        card.className = `novedad-card-ultra ${statusClass} ${estadoActual === 'FINALIZADO' ? 'is-finalized' : ''}`;

        let sIcon = 'clock', sClass = 'p', sLab = 'PENDIENTE';
        if (estadoActual === 'ELABORACION') { sIcon = 'sync-alt'; sClass = 'w'; sLab = 'ELABORACIÓN'; }
        else if (estadoActual === 'FINALIZADO') { sIcon = 'check-circle'; sClass = 'd'; sLab = 'CERRADA'; }

        card.innerHTML = `
            <div class="card-visual-ultra" onclick="${nov.IMAGEN ? `window.open('${nov.IMAGEN}', '_blank')` : ''}">
                ${nov.IMAGEN ? `<img src="${nov.IMAGEN}">` : `<div class="h-100 d-flex align-items-center justify-content-center bg-light text-muted" style="font-size:0.6rem;">SIN EVIDENCIA</div>`}
            </div>
            <div class="card-body-ultra">
                <div class="card-top-info">
                    <div class="tech-pills-container">
                        <div class="tech-pill-lux" title="Lote"><i class="fas fa-barcode"></i> ${nov.LOTE || 'S/L'}</div>
                        <div class="tech-pill-lux" title="Referencia"><i class="fas fa-tag"></i> ${nov.REFERENCIA || 'REF S/N'}</div>
                        <div class="tech-pill-lux" title="Línea"><i class="fas fa-route"></i> ${nov.LINEA || '--'}</div>
                        <div class="tech-pill-lux" title="Cantidad Original"><i class="fas fa-cubes"></i> ${nov.CANTIDAD || '0'}</div>
                    </div>
                    <div style="text-align: right; line-height: 1.1;">
                        <span style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">${nov.AREA || 'GEN'}</span>
                        <span style="font-size: 1.1rem; font-weight: 900; color: #3b82f6; letter-spacing: -0.5px;">${nov.CANTIDAD_SOLICITADA || '0'} <small style="font-size: 0.6rem; color: #64748b;">UND</small></span>
                    </div>
                </div>

                <div class="card-desc-ultra">${(nov.DESCRIPCION || 'Sin registro detallado.').trim()}</div>

                <div class="card-meta-ultra">
                    <div class="d-flex flex-column">
                        <div class="planta-label-lux">
                            ${nov.PLANTA}
                            ${infoPlanta ? `
                                <div class="info-trigger-lux" onclick="verFichaTaller('${nov.PLANTA.replace(/'/g, "\\'")}')" title="Ver contacto del taller">
                                    <i class="fas fa-info"></i>
                                </div>
                            ` : ''}
                        </div>
                        <div class="date-row-lux">
                            <span><b>Reportado:</b> ${dtIngreso ? (dtIngreso.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).charAt(0).toUpperCase() + dtIngreso.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).slice(1)) : '--'}</span>
                            <span><b>Despachado:</b> ${dtSalida ? (dtSalida.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).charAt(0).toUpperCase() + dtSalida.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).slice(1)) : (estadoActual === 'FINALIZADO' ? '--' : 'PENDIENTE DE DESPACHO')}</span>
                        </div>
                    </div>
                    <div class="days-badge-lux">
                        ${calcularDiasHabiles(dtIngreso, dtSalida || new Date())} DÍAS HÁBILES
                    </div>
                </div>
            </div>
            <div class="actions-tower-ultra">
                <div class="status-btn-lux ${sClass}">
                    <i class="fas fa-${sIcon}"></i>
                    <span>${sLab}</span>
                    <select class="status-select-hidden" onchange="actualizarEstado('${nov.ID_RADICADO}', this.value, this)">
                        <option value="PENDIENTE" ${estadoActual === 'PENDIENTE' ? 'selected' : ''}>PENDIENTE</option>
                        <option value="ELABORACION" ${estadoActual === 'ELABORACION' ? 'selected' : ''}>ELABORACIÓN</option>
                        <option value="FINALIZADO" ${estadoActual === 'FINALIZADO' ? 'selected' : ''}>CERRADA</option>
                    </select>
                </div>
                <button class="btn-print-ultra w-100" onclick="imprimirNovedad('${nov.ID_RADICADO}')">
                    <i class="fas fa-print"></i> IMPRIMIR
                </button>
            </div>
        `;
        feed.appendChild(card);
    });
}

function renderPaginacion(totalRecords, dataRef) {
    const pagContainer = document.getElementById('paginationFeed');
    if (!pagContainer) return;

    const totalPages = Math.ceil(totalRecords / gsRecordsPerPage);
    if (totalPages <= 1) return;

    const nav = document.createElement('div');
    nav.className = 'pagination-container-lux';

    // Botón Anterior
    const btnPrev = document.createElement('button');
    btnPrev.className = 'page-btn-lux';
    btnPrev.disabled = gsCurrentPage === 1;
    btnPrev.innerHTML = `<i class="fas fa-chevron-left"></i> Anterior`;
    btnPrev.onclick = () => { gsCurrentPage--; renderTabla(dataRef); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    nav.appendChild(btnPrev);

    // Info Páginas
    const info = document.createElement('span');
    info.className = 'page-info-lux';
    info.textContent = `Página ${gsCurrentPage} de ${totalPages}`;
    nav.appendChild(info);

    // Botón Siguiente
    const btnNext = document.createElement('button');
    btnNext.className = 'page-btn-lux';
    btnNext.disabled = gsCurrentPage === totalPages;
    btnNext.innerHTML = `Siguiente <i class="fas fa-chevron-right"></i>`;
    btnNext.onclick = () => { gsCurrentPage++; renderTabla(dataRef); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    nav.appendChild(btnNext);

    pagContainer.appendChild(nav);
}

/**
 * Calcula días hábiles entre dos fechas (Lunes a Viernes)
 * Ignora la hora, solo toma en cuenta el cambio de fecha.
 */
function calcularDiasHabiles(fechaInicio, fechaFin) {
    if (!fechaInicio || !fechaFin) return 0;

    // Normalizar a medianoche para ignorar horas/minutos
    let start = new Date(fechaInicio);
    start.setHours(0, 0, 0, 0);

    let end = new Date(fechaFin);
    end.setHours(0, 0, 0, 0);

    if (start > end) return 0;

    let count = 0;
    let curr = new Date(start);

    while (curr <= end) {
        let day = curr.getDay();
        if (day !== 0 && day !== 6) { // 0=Dom, 6=Sab
            count++;
        }
        curr.setDate(curr.getDate() + 1);
    }

    // Si queremos contar los días transcurridos (excluyendo el día de inicio si es el mismo)
    // Pero usualmente se cuenta el rango completo. El usuario pide "diferencia".
    // Si es el mismo día, count será 1 si es hábil.
    return count;
}

function obtenerPlantaReciente(nombrePlanta) {
    if (!nombrePlanta) return null;
    const search = nombrePlanta.toLowerCase().trim();
    return gsPlantas.find(p => p.PLANTA.toLowerCase().trim() === search) || null;
}

async function actualizarEstado(timestampId, nuevoEstado, selectEl) {
    const row = gsNovedades.find(n => n.ID_RADICADO === timestampId);
    const btnContainer = selectEl.closest('.status-btn-lux');
    const originalHTML = btnContainer.innerHTML;
    let respuestaCorreo = "";

    if (nuevoEstado === 'FINALIZADO') {
        const { value: texto, isConfirmed } = await Swal.fire({
            title: 'RESOLUCIÓN',
            input: 'textarea',
            inputPlaceholder: 'Escriba la solución...',
            showCancelButton: true,
            confirmButtonText: 'CONFIRMAR',
            confirmButtonColor: '#3f51b5'
        });
        if (!isConfirmed) { renderTabla(); return; }
        respuestaCorreo = texto;
    }

    // Estado de carga en el botón
    selectEl.disabled = true;
    btnContainer.classList.add('is-loading');
    btnContainer.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> <span>SINCRONIZANDO...</span>`;

    try {
        const res = await fetch(GAS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ accion: "UPDATE_ESTADO", timestampId, nuevoEstado, respuesta: respuestaCorreo, correo: obtenerPlantaReciente(row?.PLANTA)?.EMAIL || '', resLote: row?.LOTE || '' })
        });

        if (row) row.ESTADO = nuevoEstado;
        renderTabla(); // Esto reconstruirá la UI con el nuevo estado y el botón correcto

        Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 }).fire({ icon: 'success', title: 'Actualizado' });
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Error' });
        btnContainer.classList.remove('is-loading');
        btnContainer.innerHTML = originalHTML;
        renderTabla();
    } finally {
        // No es necesario selectEl.disabled = false porque renderTabla() recrea el elemento
    }
}
function imprimirNovedad(id) {
    const nov = gsNovedades.find(n => n.ID_RADICADO === id);
    if (!nov) return;
    
    const infoPlanta = obtenerPlantaReciente(nov.PLANTA);
    
    localStorage.setItem('printNovedad', JSON.stringify(nov));
    localStorage.setItem('printPlanta', JSON.stringify(infoPlanta));
    
    window.open('plantilla-impresion.html', '_blank');
}


/**
 * Muestra un modal estético con la información de contacto del taller
 */


/**
 * Muestra una ficha de contacto amplia y estilizada
 */
function verFichaTaller(nombre) {
    const p = obtenerPlantaReciente(nombre);
    if (!p) return;

    Swal.fire({
        title: null,
        html: `
            <style>
                .ficha-tl { position: relative; font-family: 'Inter', sans-serif; text-align: left; }
                .grad-text {
                    background: linear-gradient(135deg, #3f51b5 0%, #3b82f6 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .row-lux { 
                    position: relative; 
                    display: flex; 
                    align-items: center; 
                    gap: 15px; 
                    padding: 6px 0;
                    margin-bottom: 8px;
                    white-space: nowrap;
                }
                .hint-lux {
                    position: absolute;
                    left: 0;
                    top: -14px;
                    background: #1e293b;
                    color: white;
                    font-size: 0.55rem;
                    font-weight: 700;
                    padding: 2px 6px;
                    border-radius: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.1s ease-out;
                    z-index: 20;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .row-lux:hover .hint-lux {
                    opacity: 1;
                    top: -18px;
                }
                .icon-box-lux {
                    width: 22px;
                    display: flex;
                    justify-content: center;
                    color: #475569;
                    font-size: 1.1rem;
                    transition: all 0.2s;
                }
                .row-lux:hover .icon-box-lux { 
                    transform: scale(1.1);
                    color: #3b82f6;
                }
                .val-lux { 
                    font-size: 0.95rem; 
                    color: #64748b; 
                    transition: color 0.2s;
                }
                .val-link { 
                    text-decoration: none; 
                    font-weight: 700;
                    color: #64748b;
                    transition: all 0.2s;
                }
                .row-lux:hover .val-lux,
                .row-lux:hover .val-link {
                    color: #3b82f6;
                }
                .val-link:hover { opacity: 0.8; }
            </style>

            <div class="ficha-tl">
                <!-- Header con Degradado Institucional -->
                <div style="padding-bottom: 12px; border-bottom: 2px solid #eff6ff; margin-bottom: 20px;">
                    <div style="font-size: 1.2rem; font-weight: 900; display: flex; align-items: center; gap: 12px;" class="grad-text">
                        <i class="fas fa-address-card"></i> Ficha de Contacto
                    </div>
                </div>
                
                <!-- Lista de Datos Auto-Expandible -->
                <div style="display: flex; flex-direction: column;">
                    <div class="row-lux">
                        <span class="hint-lux">Planta</span>
                        <div class="icon-box-lux"><i class="fas fa-industry"></i></div>
                        <span class="val-lux" style="font-weight: 400; text-transform: uppercase;">${p.PLANTA}</span>
                    </div>

                    ${p.CEDULA ? `
                    <div class="row-lux">
                        <span class="hint-lux">NIT o Cédula</span>
                        <div class="icon-box-lux"><i class="fas fa-id-card"></i></div>
                        <span class="val-lux" style="font-weight: 600;">${p.CEDULA}</span>
                    </div>` : ''}

                    ${p.TELEFONO ? `
                    <div class="row-lux">
                        <span class="hint-lux">Teléfono</span>
                        <div class="icon-box-lux"><i class="fas fa-phone"></i></div>
                        <a href="tel:${p.TELEFONO}" class="val-link" style="font-size: 0.95rem;">${p.TELEFONO}</a>
                    </div>` : ''}

                    ${p.DIRECCION ? `
                    <div class="row-lux" style="align-items: center;">
                        <span class="hint-lux">Dirección</span>
                        <div class="icon-box-lux"><i class="fas fa-map-marker-alt"></i></div>
                        <span class="val-lux" style="font-weight: 500;">${p.DIRECCION}</span>
                    </div>` : ''}

                    ${p.EMAIL ? `
                    <div class="row-lux">
                        <span class="hint-lux">Correo</span>
                        <div class="icon-box-lux"><i class="fas fa-envelope"></i></div>
                        <a href="mailto:${p.EMAIL}" class="val-link" style="font-size: 0.95rem;">${p.EMAIL}</a>
                    </div>` : ''}
                </div>
            </div>
        `,
        showConfirmButton: false,
        width: 'auto',
        padding: '1.75rem',
        background: '#ffffff',
        showCloseButton: false,
        backdrop: 'rgba(15, 23, 42, 0.15)',
        customClass: {
            popup: 'shadow-2xl border-0 rounded-4'
        }
    });
}

/**
 * Motor de parseo de fechas ultra-resiliente
 */
function parsearFechaLatina(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    let s = String(d).trim();
    if (!s) return null;

    // 1. Detectar Separadores (Soporte para / y -)
    const sep = s.includes('/') ? '/' : (s.includes('-') ? '-' : null);

    if (sep) {
        const parts = s.split(/\s+/); // Separa fecha de hora
        const dateParts = parts[0].split(sep);

        if (dateParts.length === 3) {
            let dia, mes, anio;
            // Caso DD/MM/YYYY o DD-MM-YYYY
            if (dateParts[2].length === 4 || dateParts[2].length === 2) {
                dia = parseInt(dateParts[0]);
                // Si el segundo parte es texto (ene, feb...)
                if (isNaN(dateParts[1])) {
                    const meses = { 'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11 };
                    mes = meses[dateParts[1].toLowerCase().substring(0, 3)] || 0;
                } else {
                    mes = parseInt(dateParts[1]) - 1;
                }
                anio = parseInt(dateParts[2].length === 2 ? '20' + dateParts[2] : dateParts[2]);
            }
            // Caso YYYY-MM-DD (Formato ISO de Sheets)
            else if (dateParts[0].length === 4) {
                anio = parseInt(dateParts[0]);
                mes = parseInt(dateParts[1]) - 1;
                dia = parseInt(dateParts[2]);
            }

            if (!isNaN(dia) && !isNaN(mes) && !isNaN(anio)) {
                let fecha = new Date(anio, mes, dia);
                // Si hay hora (HH:mm)
                if (parts[1] && parts[1].includes(':')) {
                    const timeParts = parts[1].split(':');
                    fecha.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]));
                }
                if (!isNaN(fecha.getTime())) return fecha;
            }
        }
    }

    // Fallback al parse nativo solo si lo de arriba falla
    const dtFallback = new Date(d);
    return isNaN(dtFallback.getTime()) ? null : dtFallback;
}

function formatearHora(d) {
    const dt = parsearFechaLatina(d);
    return dt ? dt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
}
