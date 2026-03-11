/* ==========================================================================
   resolucion.js — Lógica para la vista de Resolución de Novedades
   ========================================================================== */

let gsNovedades = [];
let gsPlantas = [];

window.onload = async function () {
    initParticles(); // Fondo visual
    await cargarDatos();
};

async function cargarDatos() {
    const loader = document.getElementById('loader');
    const section = document.getElementById('dataSection');

    try {
        const [novedades, plantas] = await Promise.all([
            fetchNovedadesData(),
            fetchPlantasData()
        ]);

        gsNovedades = novedades;
        gsPlantas = plantas;

        gsNovedades.sort((a, b) => {
            const estA = a.ESTADO || 'PENDIENTE';
            const estB = b.ESTADO || 'PENDIENTE';
            const isA_Fin = (estA === 'FINALIZADO');
            const isB_Fin = (estB === 'FINALIZADO');
            if (isA_Fin !== isB_Fin) return isA_Fin ? 1 : -1;
            const dateA = parsearFechaLatina(a.FECHA) || new Date(0);
            const dateB = parsearFechaLatina(b.FECHA) || new Date(0);
            return dateB - dateA;
        });

        renderTabla(gsNovedades);
        loader.style.display = 'none';
        section.style.display = 'block';

    } catch (error) {
        console.error('Error cargando resolución:', error);
        loader.innerHTML = `<span class="text-danger"><i class="fas fa-exclamation-triangle"></i> Error al cargar datos.</span>`;
    }
}

function renderTabla(data = gsNovedades) {
    const tbody = document.getElementById('tableBody');
    const mostrarFinalizados = document.getElementById('toggleFinalizados')?.checked;
    tbody.innerHTML = '';

    let datosMostrar = data;
    if (!mostrarFinalizados) {
        datosMostrar = data.filter(nov => nov.ESTADO !== 'FINALIZADO');
    }

    if (!datosMostrar || datosMostrar.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-5">No hay registros disponibles.</td></tr>`;
        return;
    }

    let currentDate = null;

    datosMostrar.forEach((nov) => {
        const estadoActual = nov.ESTADO || 'PENDIENTE';
        let infoPlanta = obtenerPlantaReciente(nov.PLANTA);

        const novDate = formatearFecha(nov.FECHA);
        if (novDate !== currentDate) {
            const trHeader = document.createElement('tr');
            trHeader.innerHTML = `
                <td colspan="7" class="py-2 border-top border-bottom" style="background-color: #f1f3f9 !important; border-left: 4px solid #3f51b5;">
                    <span class="ps-2 fw-bold text-primary" style="font-size: 0.8rem; letter-spacing: 0.5px;">
                        <i class="far fa-calendar-check me-2"></i>${novDate.toUpperCase()}
                    </span>
                </td>
            `;
            tbody.appendChild(trHeader);
            currentDate = novDate;
        }

        const tr = document.createElement('tr');
        if (estadoActual === 'FINALIZADO') {
            tr.style.opacity = '0.6';
            tr.style.backgroundColor = '#fafafa';
        }

        // Diseño Ultra-Simétrico con tabla fixed
        tr.innerHTML = `
      <td class="align-middle overflow-hidden">
        <div class="ps-2 border-start border-3 border-light-subtle">
          <div class="fw-bold text-dark" style="font-size: 0.9rem;">${formatearFechaCorta(nov.FECHA)}</div>
          <div class="text-muted small"><i class="far fa-clock me-1 text-primary"></i>${formatearHora(nov.FECHA)}</div>
        </div>
      </td>
      <td class="align-middle overflow-hidden">
        <div class="d-flex flex-column align-items-start">
          <span class="badge bg-dark text-white mb-1" style="font-size: 0.65rem; border-radius: 4px;">LOTE: ${nov.LOTE || 'N/A'}</span>
          <span class="text-dark fw-bold text-truncate w-100" style="font-size: 0.85rem;" title="${nov.PLANTA}">
            <i class="fas fa-industry me-2 text-muted shadow-sm"></i>${nov.PLANTA}
          </span>
          <span class="text-muted" style="font-size: 0.7rem; font-family: 'JetBrains Mono', monospace;">ID: ${nov.ID_RADICADO.substring(0, 10)}</span>
        </div>
      </td>
      <td class="align-middle">
        <div class="pe-2 text-wrap" style="height: 100%;">
          <div class="text-dark fw-medium mb-2" style="font-size: 0.85rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;" title="${nov.DESCRIPCION}">
             ${nov.DESCRIPCION || 'Sin descripción detallada.'}
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-light text-dark border shadow-sm px-2 py-1" style="font-size: 0.65rem;"><i class="fas fa-tag me-1 text-primary-emphasis"></i>${nov.AREA || 'Gral'}</span>
            <span class="badge ${nov.CANTIDAD_SOLICITADA > 0 ? 'bg-danger-subtle text-danger border border-danger-subtle' : 'bg-light text-muted border'} px-2 py-1" style="font-size: 0.65rem;">CANT: ${nov.CANTIDAD_SOLICITADA || 0}</span>
          </div>
        </div>
      </td>
      <td class="align-middle text-center overflow-hidden">
        ${nov.IMAGEN ?
                `<a href="${nov.IMAGEN}" target="_blank" class="btn btn-sm btn-outline-primary border-0 p-1" style="font-size: 0.75rem; font-weight: 600;">
            <i class="fas fa-image me-1"></i> VER ADJUNTO
           </a>` :
                `<span class="small text-muted opacity-50 px-2 py-1" style="font-size: 0.65rem;">N/A</span>`
            }
      </td>
      <td class="align-middle overflow-hidden">
        ${infoPlanta ?
                `<div class="d-flex flex-column" style="font-size: 0.75rem; line-height: 1.2;">
            <div class="text-dark fw-bold mb-1"><i class="fas fa-id-badge text-muted me-2"></i>${infoPlanta.ID || infoPlanta.CEDULA}</div>
            <div class="text-primary fw-bold"><i class="fab fa-whatsapp me-2"></i>${infoPlanta.TELEFONO}</div>
          </div>`
                : '<span class="text-muted small italic">S/R</span>'
            }
      </td>
      <td class="align-middle">
        <select class="form-select form-select-sm border fw-bold shadow-sm status-${estadoActual}" 
                style="border-radius: 4px; font-size: 0.75rem; height: 32px; padding: 2px 5px;" 
                onchange="actualizarEstado('${nov.ID_RADICADO}', this.value, this)">
          <option value="PENDIENTE" ${estadoActual === 'PENDIENTE' ? 'selected' : ''}>PENDIENTE</option>
          <option value="ELABORACION" ${estadoActual === 'ELABORACION' ? 'selected' : ''}>EN PROCESO</option>
          <option value="FINALIZADO" ${estadoActual === 'FINALIZADO' ? 'selected' : ''}>FINALIZADO</option>
        </select>
      </td>
      <td class="align-middle text-end pe-2">
        <button class="btn btn-sm btn-outline-primary border-0" 
                onclick="imprimirNovedad('${nov.ID_RADICADO}')" title="Imprimir constancia">
          <i class="fas fa-print"></i> IMPRIMIR
        </button>
      </td>
    `;
        tbody.appendChild(tr);
    });
}

function obtenerPlantaReciente(nombrePlanta) {
    if (!nombrePlanta) return null;
    return gsPlantas.find(p => p.PLANTA.toLowerCase().trim() === nombrePlanta.toLowerCase().trim()) || null;
}

async function actualizarEstado(timestampId, nuevoEstado, selectEl) {
    const claseAnterior = Array.from(selectEl.classList).find(c => c.startsWith('status-'));
    const row = gsNovedades.find(n => n.ID_RADICADO === timestampId);
    let respuestaCorreo = "";

    if (nuevoEstado === 'FINALIZADO') {
        const infoPlanta = obtenerPlantaReciente(row?.PLANTA);
        const { value: texto, isConfirmed } = await Swal.fire({
            title: 'CIERRE DE NOVEDAD',
            html: `
                <div class="text-start mb-2">
                    <p class="small text-muted mb-2">Se enviará la solución a ${infoPlanta?.EMAIL || 'la planta'}.</p>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <label class="fw-bold small">Detalles de la Solución:</label>
                        <button type="button" class="btn-action-muted" 
                                onclick="const t = document.getElementById('swal-solucion'); if(t.value) mejorarRedaccion('swal-solucion');" 
                                title="Optimizar texto con IA">
                            <i class="fas fa-wand-magic-sparkles"></i> Pulir texto
                        </button>
                    </div>
                    <textarea id="swal-solucion" class="form-control" placeholder="Escriba la solución..." rows="5"></textarea>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'CONFIRMAR CIERRE',
            confirmButtonColor: '#000',
            preConfirm: () => {
                const val = document.getElementById('swal-solucion').value;
                if (!val) { Swal.showValidationMessage('Por favor escriba la solución'); return false; }
                return val;
            }
        });
        if (!isConfirmed) { selectEl.value = claseAnterior.replace('status-', ''); return; }
        respuestaCorreo = texto;
    }

    selectEl.disabled = true;
    selectEl.classList.remove(claseAnterior);
    selectEl.classList.add(`status-${nuevoEstado}`);

    try {
        const res = await fetch(GAS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ accion: "UPDATE_ESTADO", timestampId, nuevoEstado, respuesta: respuestaCorreo, correo: obtenerPlantaReciente(row?.PLANTA)?.EMAIL || '', resLote: row?.LOTE || '' })
        });
        if (!(await res.json()).success) throw new Error();
        if (row) row.ESTADO = nuevoEstado;
        renderTabla();
        Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 }).fire({ icon: 'success', title: 'Estado actualizado' });
    } catch (e) {
        Swal.fire({ icon: 'error', title: 'Error' });
        selectEl.value = claseAnterior.replace('status-', '');
        selectEl.classList.remove(`status-${nuevoEstado}`);
        selectEl.classList.add(claseAnterior);
    } finally { selectEl.disabled = false; }
}

async function imprimirNovedad(timestamp) {
    const nov = gsNovedades.find(n => n.ID_RADICADO === timestamp);
    if (!nov) return;
    const dateF = parsearFechaLatina(nov.FECHA);
    const dateS = parsearFechaLatina(nov.SALIDA);

    if (dateF && dateS) {
        localStorage.setItem('printNovedad', JSON.stringify(nov));
        const p = obtenerPlantaReciente(nov.PLANTA);
        localStorage.setItem('printPlanta', JSON.stringify(p));
        window.open('plantilla-impresion.html', '_blank');
        return;
    }

    const { value: v, isConfirmed } = await Swal.fire({
        title: 'NORMALIZACIÓN DE FECHA',
        html: `<div class="text-start small"><div class="mb-2"><label class="fw-bold">EMISIÓN:</label><input type="date" id="fN" class="form-control rounded-0"></div><div><label class="fw-bold">SALIDA:</label><input type="date" id="sN" class="form-control rounded-0"></div></div>`,
        showCancelButton: true,
        confirmButtonColor: '#000'
    });

    if (isConfirmed) {
        // Implementación directa simplificada
        localStorage.setItem('printNovedad', JSON.stringify(nov));
        window.open('plantilla-impresion.html', '_blank');
    }
}

function parsearFechaLatina(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    const s = d.toString().toLowerCase();
    if (s.includes('-')) {
        const p = s.split('-');
        if (p.length === 3) {
            const m = { 'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11 }[p[1].substring(0, 3)];
            let a = parseInt(p[2]); if (a < 100) a += 2000;
            return new Date(a, m, parseInt(p[0]));
        }
    }
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
}

function formatearFecha(d) {
    const dt = parsearFechaLatina(d);
    if (!dt) return d || '';
    return dt.toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatearFechaCorta(d) {
    const dt = parsearFechaLatina(d);
    if (!dt) return d || '';
    return dt.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatearHora(d) {
    const dt = parsearFechaLatina(d);
    return dt ? dt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
}
