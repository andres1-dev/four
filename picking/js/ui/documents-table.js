// Configuración de DataTable para documentos disponibles - ERROR SOLUCIONADO
let documentosTable = null;
let listaResponsables = [];
let timers = {};
let documentosGlobales = [];
let rangoFechasSeleccionado = null;
let filtrosActivos = {
    busqueda: '',
    fecha: null,
    estado: null
};
let actualizacionEnProgreso = false;
let timeoutActualizacion = null;
let filtroTarjetaActivo = null;

const API_URL = 'https://script.google.com/macros/s/AKfycbzeG16VGHb63ePAwm00QveNsdbMEHi9dFbNsmQCreNOXDtwIh22NHxzRpwuzZBZ-oIJWg/exec';

let mostrarFinalizados = false;
const ESTADOS_VISIBLES = ['PENDIENTE', 'DIRECTO', 'ELABORACION', 'PAUSADO'];
const ESTADOS_FINALIZADOS = ['FINALIZADO'];

/* ===== SISTEMA DE ALERTAS CENTRALES PERSISTENTE (SINGLE INSTANCE) ===== */
const Notificador = {
    container: null,
    overlay: null,
    activeToast: null,
    closeTimeout: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';

            this.overlay = document.createElement('div');
            this.overlay.className = 'alert-overlay';
            this.overlay.style.display = 'none';

            document.body.appendChild(this.overlay);
            document.body.appendChild(this.container);
        }
    },

    show({ titulo, mensaje, tipo = 'info', duracion = 1000 }) {
        this.init();

        // Limpiar timeout de cierre previo si existe
        if (this.closeTimeout) {
            clearTimeout(this.closeTimeout);
            this.closeTimeout = null;
        }

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle',
            loading: 'fa-circle-notch fa-spin',
            confirm: 'fa-question-circle',
            prompt: 'fa-shield-alt'
        };

        this.overlay.style.display = 'block';

        const contentHtml = `
            <div class="toast-icon">
                <i class="fas ${icons[tipo] || icons.info}"></i>
            </div>
            <div class="toast-content" id="toast-content-inner">
                <strong class="toast-title">${titulo}</strong>
                <p class="toast-message">${mensaje || ''}</p>
                ${tipo === 'prompt' ? `
                <div class="mt-3">
                    <input type="password" id="toast-input-inner" class="form-control text-center" placeholder="••••" autocomplete="off">
                </div>` : ''}
            </div>
            <div class="toast-actions-container" id="toast-actions-inner">
                ${tipo === 'confirm' || tipo === 'prompt' ? `
                <div class="toast-actions mt-3 d-flex gap-2 justify-content-center w-100">
                    <button id="btn-confirm-inner" class="btn btn-primary px-4 fw-bold">CONTINUAR</button>
                    <button id="btn-cancel-inner" class="btn btn-light px-4">CANCELAR</button>
                </div>` : ''}
            </div>
        `;

        // Si ya hay un toast activo, solo actualizar su contenido con una pequeña transición
        if (this.activeToast) {
            this.activeToast.className = `premium-toast toast-${tipo}`;
            this.activeToast.innerHTML = contentHtml;
        } else {
            const toast = document.createElement('div');
            toast.className = `premium-toast toast-${tipo}`;
            toast.innerHTML = contentHtml;
            this.container.innerHTML = '';
            this.container.appendChild(toast);
            this.activeToast = toast;
        }

        if (tipo !== 'loading' && tipo !== 'confirm' && tipo !== 'prompt') {
            this.closeTimeout = setTimeout(() => this.close(), duracion);
        }

        return {
            id: 'active',
            close: () => this.close()
        };
    },

    close() {
        if (this.activeToast) {
            this.activeToast.classList.add('closing');
            setTimeout(() => {
                if (this.activeToast) {
                    this.activeToast.remove();
                    this.activeToast = null;
                }
                if (this.container.children.length === 0) {
                    this.overlay.style.display = 'none';
                }
            }, 200);
        }
    },

    success(titulo, mensaje) { return this.show({ titulo, mensaje, tipo: 'success', duracion: 1200 }); },
    error(titulo, mensaje) { return this.show({ titulo, mensaje, tipo: 'error', duracion: 3500 }); },
    info(titulo, mensaje) { return this.show({ titulo, mensaje, tipo: 'info', duracion: 1200 }); },
    loading(titulo, mensaje) { return this.show({ titulo, mensaje, tipo: 'loading' }); },

    confirm(titulo, mensaje) {
        return new Promise((resolve) => {
            this.show({ titulo, mensaje, tipo: 'confirm' });

            setTimeout(() => {
                const btnConfirm = document.getElementById('btn-confirm-inner');
                const btnCancel = document.getElementById('btn-cancel-inner');

                if (btnConfirm) btnConfirm.onclick = () => { this.close(); resolve(true); };
                if (btnCancel) btnCancel.onclick = () => { this.close(); resolve(false); };
            }, 50);
        });
    },

    prompt(titulo, mensaje) {
        return new Promise((resolve) => {
            this.show({ titulo, mensaje, tipo: 'prompt' });
            const input = document.getElementById('toast-input-inner');
            if (input) setTimeout(() => input.focus(), 100);

            setTimeout(() => {
                const btnConfirm = document.getElementById('btn-confirm-inner');
                const btnCancel = document.getElementById('btn-cancel-inner');

                if (btnConfirm) btnConfirm.onclick = () => {
                    const val = input ? input.value : '';
                    this.close();
                    resolve(val);
                };
                if (btnCancel) btnCancel.onclick = () => { this.close(); resolve(null); };

                if (input) input.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') btnConfirm.click();
                });
            }, 50);
        });
    }
};

// VERIFICAR SI DATATABLES ESTÁ CARGADO
function isDataTableLoaded() {
    return typeof $.fn.DataTable !== 'undefined';
}

// Sobrescribir funciones existentes para compatibilidad
function mostrarNotificacion(titulo, mensaje, tipo = 'success') {
    if (tipo === 'success') Notificador.success(titulo, mensaje);
    else if (tipo === 'error') Notificador.error(titulo, mensaje);
    else Notificador.info(titulo, mensaje);
}

async function mostrarConfirmacion(titulo, texto, tipo = 'info') {
    return await Notificador.confirm(titulo, texto);
}

async function mostrarInput(titulo, texto, tipo = 'password') {
    return await Notificador.prompt(titulo, texto);
}

function mostrarLoading(titulo = 'Procesando...', texto = '') {
    return Swal.fire({
        title: titulo,
        text: texto,
        position: 'center',
        allowOutsideClick: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

function guardarEstadoTabla() {
    if (!documentosTable) return null;

    try {
        const state = documentosTable.config.store.getState();
        return {
            page: state.pagination ? state.pagination.page : 0,
            filtros: { ...filtrosActivos },
            filtroTarjeta: filtroTarjetaActivo,
            rangoFechas: rangoFechasSeleccionado ? [...rangoFechasSeleccionado] : null
        };
    } catch (e) {
        console.warn('No se pudo guardar el estado de la tabla:', e);
        return null;
    }
}

function restaurarEstadoTabla(estado) {
    if (!documentosTable || !estado) return;

    try {
        // Restaurar estado de variables globales si fuera necesario
        // (Aunque normalmente ya están actualizadas)

        // Restaurar página si la paginación está activa
        if (estado.page !== undefined) {
            // Nota: Grid.js no tiene un goToPage directo tan simple post-renderizado inmediato
            // pero podemos intentar forzarlo en el próximo tick del event loop
            setTimeout(() => {
                const pager = document.querySelector('.gridjs-pagination .gridjs-pages');
                if (pager) {
                    const buttons = pager.querySelectorAll('button');
                    // Buscamos el botón que coincida con el index (0-based) o el texto (1-based)
                    // Esta es una solución pragmática para la limitación de la API de Grid.js
                    // Alternativamente, si Grid.js expone su plugin de paginación:
                    // documentosTable.config.pipeline.processor.pagination.setPage(estado.page);
                }
            }, 100);
        }
    } catch (e) {
        console.warn('Error al restaurar estado de la tabla:', e);
    }
}

async function llamarAPI(params) {
    try {
        const queryString = new URLSearchParams(params).toString();
        // Google Apps Script recomienda POST para cambios de estado
        const url = `${API_URL}?${queryString}`;

        console.log('Enviando acción a GAS:', params);

        const response = await fetch(url, {
            method: 'POST',
            redirect: 'follow'
        });

        // Al ser un Web App de Google, recibimos un redirect
        // Fetch con follow: true ya nos da el resultado final
        const text = await response.text();
        console.log('Respuesta cruda del servidor:', text);

        try {
            return JSON.parse(text);
        } catch (e) {
            // A veces GAS responde con basura antes del JSON o éxito silencioso
            if (text.toLowerCase().includes('success":true')) return { success: true };
            return { success: false, message: 'Respuesta no válida del servidor' };
        }
    } catch (error) {
        console.error('Error en llamarAPI:', error);
        return {
            success: false,
            error: error.message,
            message: 'No se pudo conectar con el servidor'
        };
    }
}

async function actualizarFilaEspecifica(rec) {
    console.log(`Actualizando datos para REC${rec}`);

    try {
        // Primero actualizamos la fuente de datos global (la de main.js)
        if (typeof window.cargarDatos === 'function') {
            await window.cargarDatos();
        }

        // Luego refrescamos los documentos combinados que usa la tabla
        const documentosDisponibles = await obtenerDocumentosCombinados();
        documentosGlobales = documentosDisponibles;

        // Finalmente redibujamos con los nuevos datos y filtros
        filtrarYMostrarGrid();
        console.log(`REC${rec} actualizado exitosamente tras cambio de estado`);
    } catch (error) {
        console.error('Error actualizando fila específica:', error);
        // Fallback: recarga completa si falla la parcial
        await actualizarInmediatamente(true);
    }
}

async function actualizarInmediatamente(forzarRecarga = false, recEspecifico = null, accion = null) {
    if (actualizacionEnProgreso && !forzarRecarga) {
        console.log('Actualización ya en progreso, ignorando...');
        return;
    }

    // Guardamos la configuración de paginación actual si existe
    let currentPage = 0;
    if (documentosTable) {
        try {
            currentPage = documentosTable.config.store.getState().pagination.page;
        } catch (e) { }
    }

    actualizacionEnProgreso = true;

    try {
        console.log('Actualizando tabla...', { forzarRecarga, recEspecifico, accion });

        if (forzarRecarga || !documentosTable) {
            console.log('Recargando tabla completa...');
            if (forzarRecarga && typeof window.cargarDatos === 'function') {
                await window.cargarDatos();
            }
            await cargarTablaDocumentos();
        } else {
            console.log('Actualizando datos existentes con persistencia...');
            const documentosDisponibles = await obtenerDocumentosCombinados();
            documentosGlobales = documentosDisponibles;

            // filtrarYMostrarGrid ya maneja iniciarTimers internamente tras el render
            filtrarYMostrarGrid();

            setTimeout(() => {
                inicializarTarjetasInteractivas();
            }, 100);
        }
    } catch (error) {
        console.error('Error en actualización inmediata:', error);
    } finally {
        actualizacionEnProgreso = false;
    }
}

async function actualizarDatosGlobales() {
    try {
        console.log('Actualizando datos globales...');

        if (typeof cargarDatos === 'function') {
            await cargarDatos();
            console.log('Datos globales actualizados correctamente');
            return true;
        } else {
            console.warn('Función cargarDatos no disponible');
            return false;
        }
    } catch (error) {
        console.error('Error actualizando datos globales:', error);
        return false;
    }
}

function formatearFechaSolo(fechaHoraStr) {
    if (!fechaHoraStr) return '-';

    try {
        if (fechaHoraStr.includes(' ')) {
            return fechaHoraStr.split(' ')[0];
        }
        return fechaHoraStr;
    } catch (e) {
        console.error('Error formateando fecha:', e);
        return fechaHoraStr;
    }
}

function parsearFecha(fechaStr) {
    if (!fechaStr || fechaStr === '-' || fechaStr === '0') return null;

    try {
        let dia, mes, año;

        // Formato DD/MM/YYYY (común en Sheets local)
        if (fechaStr.includes('/')) {
            const partes = fechaStr.split('/');
            if (partes.length >= 3) {
                dia = parseInt(partes[0], 10);
                mes = parseInt(partes[1], 10);
                // Limpiar posible hora adjunta
                año = parseInt(partes[2].split(' ')[0], 10);
            }
        }
        // Formato YYYY-MM-DD (común en normalización de main.js o ISO)
        else if (fechaStr.includes('-')) {
            const partes = fechaStr.split('-');
            if (partes.length >= 3) {
                if (partes[0].length === 4) { // YYYY-MM-DD
                    año = parseInt(partes[0], 10);
                    mes = parseInt(partes[1], 10);
                    dia = parseInt(partes[2].split(' ')[0], 10);
                } else if (partes[2].length === 4) { // DD-MM-YYYY
                    dia = parseInt(partes[0], 10);
                    mes = parseInt(partes[1], 10);
                    año = parseInt(partes[2].split(' ')[0], 10);
                }
            }
        }

        if (!isNaN(dia) && !isNaN(mes) && !isNaN(año)) {
            // IMPORTANTE: Crear el Date usando año, mes, dia para que sea HORA LOCAL
            return new Date(año, mes - 1, dia);
        }

        return null;
    } catch (e) {
        console.error('Error parseando fecha:', e, 'String:', fechaStr);
        return null;
    }
}

function calcularConsolidados(documentos) {
    const consolidados = {
        pendientes: { count: 0, unidades: 0 },
        proceso: { count: 0, unidades: 0 },
        directos: { count: 0, unidades: 0 },
        total: { count: 0, unidades: 0 }
    };

    documentos.forEach(doc => {
        consolidados.total.count++;
        consolidados.total.unidades += doc.cantidad || 0;

        if (doc.estado === 'PENDIENTE') {
            consolidados.pendientes.count++;
            consolidados.pendientes.unidades += doc.cantidad || 0;
        } else if (doc.estado === 'DIRECTO') {
            consolidados.directos.count++;
            consolidados.directos.unidades += doc.cantidad || 0;
        } else if (doc.estado === 'ELABORACION' || doc.estado === 'PAUSADO') {
            consolidados.proceso.count++;
            consolidados.proceso.unidades += doc.cantidad || 0;
        }
    });

    return consolidados;
}

function actualizarTarjetasResumen(consolidados, mantenerEstado = false) {
    const pendientesElement = document.getElementById('contadorPendientes');
    const procesoElement = document.getElementById('contadorProceso');
    const directosElement = document.getElementById('contadorDirectos');
    const totalElement = document.getElementById('contadorTotal');

    if (pendientesElement) pendientesElement.textContent = consolidados.pendientes.count;
    if (document.getElementById('unidadesPendientes')) document.getElementById('unidadesPendientes').textContent = `${consolidados.pendientes.unidades} unidades`;

    if (procesoElement) procesoElement.textContent = consolidados.proceso.count;
    if (document.getElementById('unidadesProceso')) document.getElementById('unidadesProceso').textContent = `${consolidados.proceso.unidades} unidades`;

    if (directosElement) directosElement.textContent = consolidados.directos.count;
    if (document.getElementById('unidadesDirectos')) document.getElementById('unidadesDirectos').textContent = `${consolidados.directos.unidades} unidades`;

    if (totalElement) totalElement.textContent = consolidados.total.count;
    if (document.getElementById('unidadesTotal')) document.getElementById('unidadesTotal').textContent = `${consolidados.total.unidades} unidades`;

    if (!mantenerEstado && filtroTarjetaActivo) {
        limpiarFiltroTarjetas();
    }
}

function tiempoAMilisegundos(tiempo) {
    if (!tiempo) return 0;
    try {
        const partes = tiempo.split(":");
        const horas = parseInt(partes[0]) || 0;
        const minutos = parseInt(partes[1]) || 0;
        const segundos = parseInt(partes[2]) || 0;
        return (horas * 3600 + minutos * 60 + segundos) * 1000;
    } catch (e) {
        console.error("Error convirtiendo tiempo a ms:", e);
        return 0;
    }
}

function milisegundosATiempo(ms) {
    const totalSec = Math.floor(ms / 1000);
    const horas = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const minutos = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const segundos = (totalSec % 60).toString().padStart(2, '0');
    return `${horas}:${minutos}:${segundos}`;
}

function calcularDuracionDesdeSheets(datos) {
    const {
        estado,
        datetime_inicio,
        datetime_fin,
        duracion_guardada,
        datetime_pausas,
        duracion_pausas
    } = datos;

    if (estado === 'PAUSADO') {
        return duracion_guardada || '00:00:00';
    } else if (estado === 'FINALIZADO') {
        return duracion_guardada || '00:00:00';
    } else {
        let msTotal = 0;

        if (duracion_guardada) {
            msTotal += tiempoAMilisegundos(duracion_guardada);
        }

        if (datetime_inicio) {
            const ahora = new Date();
            const ultimoInicio = new Date(datetime_inicio);
            if (!isNaN(ultimoInicio.getTime())) {
                msTotal += ahora - ultimoInicio;
            }
        }

        return milisegundosATiempo(msTotal);
    }
}

function iniciarTimers(documentos) {
    Object.keys(timers).forEach(rec => {
        clearInterval(timers[rec]);
        delete timers[rec];
    });

    documentos.forEach(doc => {
        if (doc.estado !== 'PAUSADO' && doc.estado !== 'FINALIZADO' && doc.datetime_inicio) {
            timers[doc.rec] = setInterval(() => {
                actualizarDuracionEnTabla(doc.rec);
            }, 1000);
        }
    });
}

function actualizarDuracionEnTabla(rec) {
    const el = document.getElementById(`timer-${rec}`);
    if (el) {
        const doc = documentosGlobales.find(d => d.rec === rec);
        if (doc) {
            const nuevaDuracion = calcularDuracionDesdeSheets(doc);
            if (el.textContent !== nuevaDuracion) {
                el.textContent = nuevaDuracion;
            }
        }
    }
}

function filtrarYMostrarGrid() {
    console.log('Filtrando documentos para Grid.js...');

    // Los contadores SIEMPRE deben basarse en los datos globales (con filtro de fecha si aplica)
    // para que el usuario sepa el total de documentos aunque esté viendo solo una categoría.
    let baseParaContadores = [...documentosGlobales];

    // Si hay filtro de fecha, los contadores también deben respetarlo
    if (rangoFechasSeleccionado && rangoFechasSeleccionado.length === 2) {
        const inicioMs = new Date(rangoFechasSeleccionado[0]).getTime();
        const finMs = new Date(rangoFechasSeleccionado[1]).getTime();

        baseParaContadores = baseParaContadores.filter(d => {
            if (!d.fecha_objeto) return false;
            const fechaMs = d.fecha_objeto.getTime();
            return fechaMs >= inicioMs && fechaMs <= finMs;
        });
    }

    const consolidados = calcularConsolidados(baseParaContadores);
    actualizarTarjetasResumen(consolidados, true);

    // Ahora aplicamos los filtros para la visualización en la tabla
    let datosFiltrados = [...baseParaContadores];

    // 1. Filtro por Estado (Tarjetas)
    if (filtroTarjetaActivo) {
        if (filtroTarjetaActivo === 'pendientes') {
            datosFiltrados = datosFiltrados.filter(d => d.estado === 'PENDIENTE');
        } else if (filtroTarjetaActivo === 'proceso') {
            datosFiltrados = datosFiltrados.filter(d => d.estado === 'ELABORACION' || d.estado === 'PAUSADO');
        } else if (filtroTarjetaActivo === 'directos') {
            datosFiltrados = datosFiltrados.filter(d => d.estado === 'DIRECTO');
        }
    }

    // 2. Filtro por Búsqueda (Input REC)
    if (filtrosActivos.busqueda) {
        const search = filtrosActivos.busqueda.toLowerCase();
        datosFiltrados = datosFiltrados.filter(doc =>
            doc.rec.toString().includes(search) ||
            (doc.colaborador && doc.colaborador.toLowerCase().includes(search)) ||
            (doc.prenda && doc.prenda.toLowerCase().includes(search))
        );
    }

    // Aplicar el mismo ordenamiento por prioridad de estado que en la inicialización
    datosFiltrados.sort((a, b) => {
        const prioridadEstado = {
            'ELABORACION': 1,
            'PAUSADO': 2,
            'PENDIENTE': 3,
            'DIRECTO': 4,
            'FINALIZADO': 5
        };
        const pA = prioridadEstado[a.estado] || 99;
        const pB = prioridadEstado[b.estado] || 99;

        if (pA !== pB) return pA - pB;
        return b.rec.localeCompare(a.rec);
    });

    console.log('Mostrando', datosFiltrados.length, 'documentos filtrados');

    if (documentosTable && documentosTable.updateConfig) {
        const state = documentosTable.config.store.getState();
        const currentPage = state.pagination?.page || 0;

        // Capturar el estado de ordenamiento actual detallado
        // Grid.js almacena las columnas ordenadas en state.sort
        const currentSort = state.sort;

        documentosTable.updateConfig({
            data: datosFiltrados,
            sort: currentSort,
            pagination: {
                ...documentosTable.config.pagination,
                page: currentPage
            }
        }).forceRender();

        // Reiniciar timers después de que Gridjs terminó de renderizar los nuevos elementos
        setTimeout(() => {
            iniciarTimers(datosFiltrados);
        }, 300);
    } else {
        inicializarDataTable(datosFiltrados);
    }
}

function configurarFiltroFecha() {
    // Ya no es necesario para DataTables, pero mantenemos la firma por compatibilidad
    console.log('Configuración de filtro de fecha lista para Grid.js');
}

function aplicarFiltroFecha(fechaInicio, fechaFin) {
    console.log('Aplicando filtro de fecha:', fechaInicio, fechaFin);

    const inicio = new Date(fechaInicio);
    inicio.setHours(0, 0, 0, 0);

    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    rangoFechasSeleccionado = [inicio, fin];
    filtrosActivos.fecha = [inicio, fin];

    filtrarYMostrarGrid();
}

function limpiarFiltros() {
    console.log('Limpiando filtros...');

    rangoFechasSeleccionado = null;
    filtrosActivos = {
        busqueda: '',
        fecha: null,
        estado: null
    };

    if (document.getElementById('filtroFecha')) {
        document.getElementById('filtroFecha').value = '';
    }
    if (document.getElementById('recInput')) {
        document.getElementById('recInput').value = '';
    }

    if (window.flatpickrInstance) {
        window.flatpickrInstance.clear();
    }

    if (documentosTable) {
        filtrarYMostrarGrid();

        const consolidados = calcularConsolidados(documentosGlobales);
        actualizarTarjetasResumen(consolidados);
    }
}

async function cargarResponsables() {
    const SPREADSHEET_ID = "1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE";
    const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';

    try {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/RESPONSABLES!A2:B?key=${API_KEY}`;
        const response = await fetch(url);

        if (!response.ok) throw new Error('Error al obtener responsables');

        const data = await response.json();
        const values = data.values || [];

        listaResponsables = values
            .filter(row => row[1] === 'true' || row[1] === 'TRUE')
            .map(row => row[0].trim())
            .filter(nombre => nombre !== '');

        console.log('Responsables cargados:', listaResponsables);
        return listaResponsables;

    } catch (error) {
        console.error('Error cargando responsables:', error);
        listaResponsables = [
            'NICOLE VALERIA MONCALEANO DIAZ',
            'KELLY TATIANA FERNANDEZ ASTUDILLO',
            'PILAR CRISTINA JARAMILLO SANCHEZ',
            'LESLY CAMILA OCHOA PEDRAZA',
            'ANGIE LIZETH POLO CAPERA',
            'REYES PADILLA DONELLY',
            'NAILEN GABRIELA ZAPATA VIERA',
            'PAULA VANESSA SANCHEZ ERAZO',
            'PAOLA ANDREA ESCOBEDO JUSPIAN'
        ];
        return listaResponsables;
    }
}

function obtenerResponsablesDisponibles(documentos, documentoActual) {
    const responsablesAsignados = documentos
        .filter(doc => doc.rec !== documentoActual.rec)
        .map(doc => doc.colaborador)
        .filter(resp => resp && resp.trim() !== '' && resp !== 'Sin responsable');

    return listaResponsables.filter(resp => !responsablesAsignados.includes(resp));
}

function calcularCantidadTotal(documento) {
    if (!documento.datosCompletos) return 0;

    const cantidad = parseInt(documento.datosCompletos.CANTIDAD) || 0;

    console.log(`Cantidad para REC${documento.rec}: ${cantidad} (solo principal)`);
    return cantidad;
}

function obtenerEstadosParaMostrar() {
    return mostrarFinalizados
        ? [...ESTADOS_VISIBLES, ...ESTADOS_FINALIZADOS]
        : ESTADOS_VISIBLES;
}

function toggleFinalizados() {
    mostrarFinalizados = !mostrarFinalizados;
    const btn = document.getElementById('btnToggleFinalizados');
    if (btn) {
        if (mostrarFinalizados) {
            btn.innerHTML = '<i class="fas fa-eye-slash"></i><span class="hide-xs"> Ocultar Finalizados</span>';
        } else {
            btn.innerHTML = '<i class="fas fa-eye"></i><span class="hide-xs"> Mostrar Finalizados</span>';
        }
    }
    actualizarInmediatamente(true);
}

async function cargarTablaDocumentos() {
    try {
        console.log('Iniciando carga de tabla de documentos...');

        vaciarTablaCompletamente();

        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'block';
        }

        await cargarResponsables();

        if (documentosTable) {
            documentosTable.destroy();
            documentosTable = null;
        }

        const documentosDisponibles = await obtenerDocumentosCombinados();
        documentosGlobales = documentosDisponibles;

        console.log('Documentos disponibles:', documentosDisponibles.length);

        const consolidados = calcularConsolidados(documentosDisponibles);
        actualizarTarjetasResumen(consolidados);

        if (documentosDisponibles.length > 0) {
            inicializarDataTable(documentosDisponibles);

            // INICIALIZAR TARJETAS DESPUÉS DE CREAR LA TABLA
            setTimeout(() => {
                inicializarTarjetasInteractivas();
            }, 100);
        } else {
            $('#documentosTable').html(`
                <thead class="table-light">
                    <tr>
                        <th>Documento</th>
                        <th>Estado</th>
                        <th>Responsable</th>
                        <th>Fecha</th>
                        <th>Duración</th>
                        <th>Cantidad</th>
                        <th>Línea</th>
                        <th>Lote</th>
                        <th>RefProv</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="10" class="text-center text-muted py-4">
                            No se encontraron documentos
                        </td>
                    </tr>
                </tbody>
            `);
        }

        if (loader) {
            loader.style.display = 'none';
        }

        console.log('Tabla de documentos cargada correctamente');

    } catch (error) {
        console.error('Error al cargar tabla de documentos:', error);

        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = 'none';
        }

        $('#documentosTable').html(`
            <thead class="table-light">
                <tr>
                    <th>Documento</th>
                    <th>Estado</th>
                    <th>Responsable</th>
                    <th>Fecha</th>
                    <th>Duración</th>
                    <th>Cantidad</th>
                    <th>Línea</th>
                    <th>Lote</th>
                    <th>RefProv</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="10" class="text-center text-danger py-4">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Error al cargar los documentos: ${error.message}
                    </td>
                </tr>
            </tbody>
        `);

        mostrarNotificacion('Error', 'Error al cargar los documentos: ' + error.message, 'error');
    }
}

async function obtenerDocumentosCombinados() {
    try {
        // Esperar a que main.js termine de cargar si es necesario
        if (window.loaderPromise) {
            console.log("Esperando a que main.js cargue los datos...");
            await window.loaderPromise;
        }

        // Usar los datos globales cargados por main.js
        let values = window.datosTablaDocumentos || [];

        // Si por alguna razón no hay datos, intentar cargarlos (fallback)
        if (!values || values.length === 0) {
            console.warn("Datos globales no encontrados, intentando cargar nuevamente...");
            if (typeof window.cargarDatos === 'function') {
                await window.cargarDatos();
                values = window.datosTablaDocumentos || [];
            }
        }

        if (!values || values.length === 0) {
            console.error("No se pudieron obtener datos de la hoja DATA");
            return [];
        }

        const datosGlobalesMap = {};
        if (datosGlobales && datosGlobales.length > 0) {
            datosGlobales.forEach(item => {
                if (item.REC) {
                    datosGlobalesMap[item.REC] = item;
                }
            });
        } else {
            console.warn('datosGlobales está vacío o no disponible');
        }

        const estadosParaMostrar = obtenerEstadosParaMostrar();
        const documentosProcesados = values
            .map((row) => {
                // Validación básica de fila
                if (!row || row.length === 0) return null;

                const documento = String(row[0] || '').trim();
                const estado = String(row[3] || '').trim().toUpperCase();
                const colaborador = String(row[4] || '').trim();
                const fechaHora = row[1] || '';
                const fechaSolo = formatearFechaSolo(fechaHora);
                const fechaObjeto = parsearFecha(fechaSolo);

                const datetime_inicio = row[5] || '';
                const datetime_fin = row[6] || '';
                const duracion_guardada = row[7] || '';
                const pausas = row[8] || '';
                const datetime_pausas = row[9] || '';
                const duracion_pausas = row[10] || '';

                const datosCompletos = datosGlobalesMap[documento];
                const cantidadTotal = datosCompletos ? calcularCantidadTotal({ datosCompletos }) : 0;

                return {
                    rec: documento,
                    estado: estado,
                    colaborador: colaborador,
                    fecha: fechaSolo,
                    fecha_completa: fechaHora,
                    fecha_objeto: fechaObjeto,
                    cantidad: cantidadTotal,
                    lote: datosCompletos ? (datosCompletos.LOTE || '') : '',
                    refProv: datosCompletos ? (datosCompletos.REFPROV || '') : '',
                    prenda: datosCompletos ? (datosCompletos.PRENDA || '') : '',
                    tieneClientes: datosCompletos ?
                        (datosCompletos.DISTRIBUCION && datosCompletos.DISTRIBUCION.Clientes &&
                            Object.keys(datosCompletos.DISTRIBUCION.Clientes).length > 0) : false,
                    datosCompletos: datosCompletos,
                    datetime_inicio: datetime_inicio,
                    datetime_fin: datetime_fin,
                    duracion_guardada: duracion_guardada,
                    pausas: pausas,
                    datetime_pausas: datetime_pausas,
                    duracion_pausas: duracion_pausas
                };
            })
            .filter(doc => doc.rec && estadosParaMostrar.includes(doc.estado));

        console.log('Documentos procesados:', documentosProcesados.length);
        return documentosProcesados;

    } catch (error) {
        console.error('Error obteniendo documentos:', error);
        throw error;
    }
}

async function cambiarResponsable(rec, responsable) {
    if (actualizacionEnProgreso) return;

    try {
        actualizacionEnProgreso = true;

        // Bloquear interfaz con loader
        const toastCarga = Notificador.loading('Asignando...', `REC${rec} → ${responsable || 'Sin asignar'}`);

        // Llamada al servidor (bloqueante)
        const result = await llamarAPI({
            action: 'asignarResponsable',
            id: rec,
            responsable: responsable || ''
        });

        toastCarga.close();

        if (result.success) {
            Notificador.success('✓ Asignado', `${responsable || 'Sin asignar'} asignado a REC${rec}`);

            // Notificar vía PWA
            if (window.notificationManager) {
                const doc = (window.documentosGlobales || []).find(d => d.rec === rec);
                const loteId = doc ? (doc.lote || rec) : rec;
                window.notificationManager.notifyNewLotAssignment(loteId, responsable);
            }

            // Actualizar solo después de confirmar éxito
            await actualizarFilaEspecifica(rec);
        } else {
            Notificador.error('Error', result.message || 'Error al asignar responsable');
            await actualizarFilaEspecifica(rec);
        }
    } catch (error) {
        console.error('Error cambiando responsable:', error);
        Notificador.error('Error de conexión', 'No se pudo guardar la asignación');
        await actualizarFilaEspecifica(rec);
    } finally {
        actualizacionEnProgreso = false;
    }
}

function vaciarTablaCompletamente() {
    console.log('Vaciando tabla completamente...');

    // Destruir DataTable si existe
    if (documentosTable) {
        documentosTable.destroy();
        documentosTable = null;
    }

    // Limpiar contenido y mostrar solo headers - PERO NO AFECTAR TARJETAS
    const tableContainer = document.getElementById('documentosTable');
    if (tableContainer) {
        tableContainer.innerHTML = `
            <thead class="table-light">
                <tr>
                    <th>Documento</th>
                    <th>Estado</th>
                    <th>Responsable</th>
                    <th>Fecha</th>
                    <th>Duración</th>
                    <th>Cantidad</th>
                    <th>Línea</th>
                    <th>Lote</th>
                    <th>RefProv</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="10" class="text-center text-muted py-4">
                        <div class="spinner-border spinner-border-sm me-2" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        Actualizando...
                    </td>
                </tr>
            </tbody>
        `;
    }
}

async function cambiarEstadoDocumento(rec, nuevoEstado) {
    if (actualizacionEnProgreso) {
        console.log('Actualización en progreso, ignorando cambio de estado...');
        return;
    }

    try {
        const documentoActual = documentosGlobales.find(doc => doc.rec === rec);
        const estadoActual = documentoActual ? documentoActual.estado : '';

        // CASO 1: FINALIZAR DESDE PAUSA (Doble acción reanudar + finalizar)
        if (estadoActual === 'PAUSADO' && nuevoEstado === 'FINALIZADO') {
            const confirmar = await mostrarConfirmacion(
                '¿Finalizar desde Pausa?',
                `REC${rec} se encuentra pausado. Al continuar, el sistema registrará la reanudación y finalización automática para cuadrar los tiempos. <br><br><strong>¿Desea cerrar este documento ahora?</strong>`
            );

            if (!confirmar) return;

            actualizacionEnProgreso = true;
            marcarFilaComoActualizando(rec);

            const toastCarga = Notificador.loading('Procesando...', `Reanudando → Finalizando REC${rec}`);

            // Paso 1: Reanudar
            const resultReanudar = await llamarAPI({ action: 'reanudar', id: rec });
            if (!resultReanudar.success) {
                Notificador.error('Error', 'Error al reanudar: ' + (resultReanudar.message || 'Error desconocido'));
                await actualizarFilaEspecifica(rec);
                return;
            }

            // Paso 2: Finalizar
            const resultFinalizar = await llamarAPI({ action: 'finalizar', id: rec });
            if (resultFinalizar.success) {
                if (timers[rec]) { clearInterval(timers[rec]); delete timers[rec]; }
                Notificador.success('✓ Finalizado', `REC${rec} completado exitosamente`);
                await actualizarInmediatamente(true);
            } else {
                Notificador.error('Error', 'Error al finalizar: ' + (resultFinalizar.message || 'Error desconocido'));
                await actualizarFilaEspecifica(rec);
            }
            return;
        }

        // CASO 2: FINALIZAR ESTÁNDAR
        if (nuevoEstado === 'FINALIZADO') {
            const confirmar = await mostrarConfirmacion('¿Finalizar documento?', `¿Desea marcar REC${rec} como finalizado?`);
            if (!confirmar) return;

            actualizacionEnProgreso = true;
            marcarFilaComoActualizando(rec);
            const toastCarga = Notificador.loading('Finalizando...', `REC${rec}`);

            const result = await llamarAPI({ action: 'finalizar', id: rec });
            if (result.success) {
                if (timers[rec]) { clearInterval(timers[rec]); delete timers[rec]; }
                Notificador.success('✓ Finalizado', `REC${rec} completado`);
                await actualizarInmediatamente(true);
            } else {
                Notificador.error('Error', result.message || 'Error al finalizar');
                await actualizarInmediatamente(true);
            }
            return;
        }

        // CASO 3: CAMBIOS NORMALES (PAUSAR / REANUDAR)
        actualizacionEnProgreso = true;
        marcarFilaComoActualizando(rec);
        const toastCarga = Notificador.loading('Actualizando...', `REC${rec} → ${nuevoEstado}`);

        let action;
        switch (nuevoEstado) {
            case 'PAUSADO': action = 'pausar'; break;
            case 'ELABORACION': action = 'reanudar'; break;
            default:
                Notificador.error('Error', 'Estado no reconocido');
                toastCarga.close();
                return;
        }

        const result = await llamarAPI({ action: action, id: rec });

        if (result.success) {
            if (nuevoEstado === 'PAUSADO' && timers[rec]) {
                clearInterval(timers[rec]);
                delete timers[rec];
            }
            Notificador.success('✓ Actualizado', `REC${rec} ahora está ${nuevoEstado}`);
            await actualizarFilaEspecifica(rec);
        } else {
            Notificador.error('Error', result.message || 'No se pudo actualizar el estado');
            await actualizarFilaEspecifica(rec);
        }

    } catch (error) {
        console.error('Error cambiando estado:', error);
        Notificador.error('Error de red', 'Hubo un problema al conectar con el servidor');
        await actualizarInmediatamente(true);
    } finally {
        actualizacionEnProgreso = false;
    }
}

function marcarFilaComoActualizando(rec) {
    // En Grid.js buscamos el elemento directamente por el contenido o una clase si la tuviera
    // Por ahora, usamos el ID del timer o el selector de responsable para hallar la celda
    const timerElement = document.getElementById(`timer-${rec}`);
    if (timerElement) {
        const row = timerElement.closest('.gridjs-tr');
        if (row) {
            row.style.opacity = '0.5';
            row.style.pointerEvents = 'none';
        }
    }
}


async function restablecerDocumento(rec) {
    if (actualizacionEnProgreso) return;

    try {
        const password = await mostrarInput(
            'Restablecer Documento',
            'Ingrese la contraseña para restablecer REC' + rec,
            'password'
        );

        if (!password) return;

        if (password !== 'one') {
            Notificador.error('Error', 'Contraseña incorrecta');
            return;
        }

        actualizacionEnProgreso = true;
        marcarFilaComoActualizando(rec);

        const toastCarga = Notificador.loading('Restableciendo...', `REC${rec}`);

        const result = await llamarAPI({
            action: 'restablecer',
            id: rec,
            password: password
        });

        if (result.success) {
            if (timers[rec]) {
                clearInterval(timers[rec]);
                delete timers[rec];
            }
            Notificador.success('✓ Restablecido', `REC${rec} ha vuelto a su estado inicial`);
            await actualizarInmediatamente(true);
        } else {
            Notificador.error('Error', result.message || 'Error al restablecer');
            await actualizarInmediatamente(true);
        }
    } catch (error) {
        console.error('Error restableciendo documento:', error);
        Notificador.error('Error', 'Error al restablecer: ' + error.message);
        await actualizarInmediatamente(true);
    } finally {
        actualizacionEnProgreso = false;
    }
}

function puedeModificarResponsable(documento) {
    return !documento.colaborador || documento.colaborador.trim() === '';
}

function generarSelectResponsables(rec, responsableActual = '', todosDocumentos, documentoActual) {
    const puedeModificar = puedeModificarResponsable(documentoActual);
    const responsablesDisponibles = puedeModificar
        ? obtenerResponsablesDisponibles(todosDocumentos, documentoActual)
        : [];

    let opciones = '';

    if (puedeModificar) {
        opciones = `
            <option value="">Sin responsable</option>
            ${responsablesDisponibles.map(resp =>
            `<option value="${resp}" ${resp === responsableActual ? 'selected' : ''}>${resp}</option>`
        ).join('')}
        `;

        return `
            <select class="form-select select-responsable" 
                    data-rec="${rec}" 
                    style="min-width: 180px;">
                ${opciones}
            </select>
        `;
    } else {
        const tieneResponsable = responsableActual && responsableActual.trim() !== '';
        const texto = tieneResponsable ? responsableActual : 'Sin responsable';
        const clase = tieneResponsable ? 'text-success' : 'text-muted';
        const icono = tieneResponsable ? 'fa-user-check' : 'fa-user';

        return `
            <span class="${clase}" title="Responsable asignado - No modificable">
                <i class="fas ${icono} me-1"></i>${texto}
            </span>
        `;
    }
}

function obtenerBotonesAccion(data) {
    const tieneColaborador = data.colaborador && data.colaborador.trim() !== '';
    const tieneClientes = data.tieneClientes;
    const puedeImprimir = tieneColaborador && tieneClientes;

    let botonesEstado = '';

    const puedePausar = data.estado !== 'DIRECTO';

    const botonImprimir = `
        <button class="btn btn-sm ${puedeImprimir ? 'btn-primary' : 'btn-secondary'}" 
                ${puedeImprimir ? '' : 'disabled'}
                onclick="window.imprimirSoloClientesDesdeTabla('${data.rec}')"
                title="${puedeImprimir ? 'Imprimir clientes' : 'No se puede imprimir'}">
            <i class="fas fa-print"></i>
        </button>`;

    if (data.estado === 'PAUSADO') {
        botonesEstado = `
            <button class="btn btn-sm btn-success" 
                    onclick="window.cambiarEstadoDocumento('${data.rec}', 'ELABORACION')"
                    title="Reanudar documento">
                <i class="fas fa-play"></i>
            </button>`;
    } else if (data.estado === 'ELABORACION') {
        botonesEstado = `
            <button class="btn btn-sm btn-warning" 
                    onclick="window.cambiarEstadoDocumento('${data.rec}', 'PAUSADO')"
                    title="Pausar documento">
                <i class="fas fa-pause"></i>
            </button>`;
    } else if (data.estado === 'PENDIENTE' || data.estado === 'DIRECTO') {
        botonesEstado = `
            <button class="btn btn-sm btn-warning" 
                    ${!puedePausar ? 'disabled' : ''}
                    onclick="${puedePausar ? `window.cambiarEstadoDocumento('${data.rec}', 'PAUSADO')` : ''}"
                    title="${puedePausar ? 'Pausar documento' : 'No se puede pausar en estado DIRECTO'}">
                <i class="fas fa-pause"></i>
            </button>`;
    }

    const botonFinalizar = data.estado !== 'FINALIZADO' ? `
        <button class="btn btn-sm btn-info" 
                onclick="window.cambiarEstadoDocumento('${data.rec}', 'FINALIZADO')"
                title="Finalizar documento">
            <i class="fas fa-check"></i>
        </button>` : '';

    const botonRestablecer = `
        <button class="btn btn-sm btn-danger" 
                onclick="window.restablecerDocumento('${data.rec}')"
                title="Restablecer documento">
            <i class="fas fa-undo"></i>
        </button>`;

    return `
        <div class="acciones-panel">
            ${botonImprimir}
            ${botonesEstado}
            ${botonFinalizar}
            ${botonRestablecer}
        </div>
    `;
}

function inicializarDataTable(documentos) {
    console.log('Inicializando Grid.js con', documentos.length, 'documentos');

    const container = document.getElementById('gridContainer');
    if (!container) return;

    // Si ya existe una instancia, la destruimos para evitar duplicados
    if (documentosTable) {
        container.innerHTML = '';
    }

    // Pre-ordenar por ESTADO con prioridad personalizada:
    // ELABORACION (1) > PAUSADO (2) > DIRECTO (3) > PENDIENTE (4) > FINALIZADO (5)
    const documentosOrdenados = [...documentos].sort((a, b) => {
        const prioridadEstado = {
            'ELABORACION': 1,
            'PAUSADO': 2,
            'PENDIENTE': 3,
            'DIRECTO': 4,
            'FINALIZADO': 5
        };
        const pA = prioridadEstado[a.estado] || 99;
        const pB = prioridadEstado[b.estado] || 99;

        if (pA !== pB) return pA - pB;
        // Si tienen el mismo estado, ordenar por REC (más nuevos arriba)
        return b.rec.localeCompare(a.rec);
    });

    documentosTable = new gridjs.Grid({
        columns: [
            {
                name: "Documento",
                id: "rec",
                formatter: (cell) => gridjs.html(`<span class="text-primary">REC${cell}</span>`)
            },
            {
                name: "Estado",
                id: "estado",
                formatter: (cell) => {
                    const clases = {
                        'PENDIENTE': 'badge-pendiente',
                        'DIRECTO': 'badge-directo',
                        'ELABORACION': 'badge-elaboracion',
                        'PAUSADO': 'badge-pausado',
                        'FINALIZADO': 'badge-finalizado'
                    };
                    return gridjs.html(`<span class="grid-badge ${clases[cell] || ''}">${cell}</span>`);
                }
            },
            {
                name: "Responsable",
                id: "colaborador",
                formatter: (cell, row) => {
                    const rec = row.cells[0].data;
                    const documentoActual = documentosGlobales.find(d => d.rec === rec);
                    return gridjs.html(generarSelectResponsables(rec, cell, documentosGlobales, documentoActual));
                }
            },
            {
                name: "Fecha",
                id: "fecha",
                formatter: (cell, row) => {
                    const full = row.cells[0].data; // Solo como ejemplo
                    return gridjs.html(`<span class="text-muted">${cell}</span>`);
                }
            },
            {
                name: "Duración",
                id: "duracion",
                formatter: (cell, row) => {
                    const rec = row.cells[0].data;
                    const doc = documentosGlobales.find(d => d.rec === rec);
                    const duracion = calcularDuracionDesdeSheets(doc);
                    const clase = doc.estado === 'PAUSADO' ? 'text-warning' :
                        doc.estado === 'FINALIZADO' ? 'text-muted' : 'text-primary';
                    return gridjs.html(`<span id="timer-${rec}" class="duracion-tiempo ${clase} fw-bold">${duracion}</span>`);
                }
            },
            {
                name: "Cant.",
                id: "cantidad",
                formatter: (cell) => gridjs.html(`<span class="badge bg-light text-dark border">${cell || 0}</span>`)
            },
            {
                name: "Prenda / Línea",
                formatter: (cell, row) => {
                    const prenda = row.cells[6]?.data || documentosGlobales.find(d => d.rec === row.cells[0].data)?.prenda || '-';
                    return gridjs.html(`<div class="lh-sm">${prenda}</div>`);
                }
            },
            {
                name: "Acciones",
                formatter: (cell, row) => {
                    const rec = row.cells[0].data;
                    const doc = documentosGlobales.find(d => d.rec === rec);
                    return gridjs.html(obtenerBotonesAccion(doc));
                }
            }
        ],
        data: documentosOrdenados,
        pagination: {
            limit: 5,
            summary: true,
            buttonsCount: 5
        },
        search: false, // Desactivar búsqueda integrada de Grid.js
        sort: true,
        resizable: true,
        language: {
            search: {
                placeholder: 'Buscar...'
            },
            pagination: {
                previous: 'Anterior',
                next: 'Siguiente',
                showing: 'Mostrando',
                results: () => 'registros'
            },
            noRecordsFound: 'No se encontraron documentos',
            loading: 'Cargando...'
        },
        style: {
            table: {
                width: '100%'
            }
        }
    }).render(container);

    // Reiniciar timers y vincular eventos tras el renderizado
    setTimeout(() => {
        iniciarTimers(documentosOrdenados);
        vincularEventosGrid();
        renderizarBuscadorManual();
    }, 500);
}

function renderizarBuscadorManual() {
    const searchContainer = document.getElementById('tableSearchContainer');
    if (!searchContainer) return;

    // Solo renderizar si no existe ya
    if (searchContainer.querySelector('.table-search-input')) return;

    searchContainer.innerHTML = `
        <input type="text" 
               class="table-search-input" 
               placeholder="Buscar..." 
               value="${filtrosActivos.busqueda || ''}"
               id="manualSearchInput">
    `;

    const input = document.getElementById('manualSearchInput');
    input.addEventListener('input', (e) => {
        filtrosActivos.busqueda = e.target.value;
        filtrarYMostrarGrid();
    });
}

function vincularEventosGrid() {
    // Delegación de eventos para los selectores de responsables
    const container = document.getElementById('gridContainer');
    if (!container) return;

    // Limpiar eventos previos si existieran (aunque el container se vacía)
    $(container).off('change', '.select-responsable');

    $(container).on('change', '.select-responsable', function () {
        const rec = $(this).data('rec');
        const nuevoResponsable = $(this).val();
        if (nuevoResponsable !== undefined) {
            cambiarResponsable(rec, nuevoResponsable);
        }
    });
}


async function imprimirSoloClientesDesdeTabla(rec) {
    try {
        console.log(`Imprimiendo clientes para REC${rec}`);

        const documento = datosGlobales.find(doc => doc.REC === rec);

        if (!documento) {
            await mostrarNotificacion('Error', `No se encontró el documento REC${rec} en datos globales`, 'error');
            return;
        }

        if (!documento.DISTRIBUCION || !documento.DISTRIBUCION.Clientes ||
            Object.keys(documento.DISTRIBUCION.Clientes).length === 0) {
            await mostrarNotificacion('Error', `No hay clientes asignados para REC${rec}`, 'error');
            return;
        }

        const documentoEnTabla = documentosGlobales.find(doc => doc.rec === rec);
        if (!documentoEnTabla || !documentoEnTabla.colaborador || documentoEnTabla.colaborador.trim() === '') {
            await mostrarNotificacion('Error', `No hay responsable asignado para REC${rec}`, 'error');
            return;
        }

        const datosImpresion = {
            rec: rec,
            fecha: documento.FECHA || '',
            lote: documento.LOTE || '',
            refProv: documento.REFPROV || '',
            linea: documento.LINEA || '',
            cantidad: documento.CANTIDAD || 0,
            clientes: documento.DISTRIBUCION.Clientes,
            responsable: documentoEnTabla.colaborador
        };

        if (typeof imprimirSoloClientes === 'function') {
            imprimirSoloClientes(datosImpresion);
            await mostrarNotificacion('Éxito', `Imprimiendo REC${rec}`, 'success');
        } else {
            await mostrarNotificacion('Error', 'Función de impresión no disponible', 'error');
        }

    } catch (error) {
        console.error('Error al imprimir clientes:', error);
        await mostrarNotificacion('Error', 'Error al preparar la impresión: ' + error.message, 'error');
    }
}

function aplicarFiltroPorEstado(tipoFiltro) {
    console.log('Aplicando filtro por estado:', tipoFiltro);

    document.querySelectorAll('.resumen-card').forEach(card => {
        card.classList.remove('active');
    });

    if (filtroTarjetaActivo === tipoFiltro) {
        filtroTarjetaActivo = null;
        limpiarFiltroTarjetas();
        return;
    }

    const tarjeta = document.querySelector(`.resumen-card.${tipoFiltro}`);
    if (tarjeta) {
        tarjeta.classList.add('active');
    }

    filtroTarjetaActivo = tipoFiltro;

    // Actualizar UI de tarjetas
    actualizarIconoFiltroActivo();

    // Filtrar y mostrar en Grid
    filtrarYMostrarGrid();

    mostrarNotificacion(
        'Filtro aplicado',
        `Mostrando: ${obtenerNombreFiltro(tipoFiltro)}`,
        'info'
    );
}

function limpiarFiltroTarjetas() {
    console.log('Limpiando filtro de tarjetas');
    filtroTarjetaActivo = null;

    document.querySelectorAll('.resumen-card').forEach(card => {
        card.classList.remove('active');
    });

    actualizarIconoFiltroActivo();
    filtrarYMostrarGrid();

    mostrarNotificacion('Filtro limpiado', 'Mostrando todos los documentos', 'info');
}

// Función para actualizar el indicador de filtro activo en las tarjetas
function actualizarIconoFiltroActivo() {
    document.querySelectorAll('.resumen-card').forEach(card => {
        const existingBadge = card.querySelector('.filtro-badge');
        if (existingBadge) existingBadge.remove();
        card.classList.remove('filtro-activo');
    });

    if (filtroTarjetaActivo && filtroTarjetaActivo !== 'total') {
        const tarjetaActiva = document.querySelector(`.resumen-card.${filtroTarjetaActivo}`);
        if (tarjetaActiva) {
            tarjetaActiva.classList.add('filtro-activo');
            const badge = document.createElement('div');
            badge.className = 'filtro-badge';
            badge.innerHTML = `<i class="fas fa-filter"></i> <span>Filtrado</span>`;
            tarjetaActiva.querySelector('.resumen-text').appendChild(badge);
        }
    }
}

function obtenerNombreFiltro(tipoFiltro) {
    const nombres = {
        'pendientes': 'Pendientes',
        'proceso': 'En Proceso',
        'directos': 'Directos',
        'total': 'Total Activos'
    };
    return nombres[tipoFiltro] || tipoFiltro;
}

function inicializarTarjetasInteractivas() {
    console.log('Inicializando tarjetas interactivas...');

    // Remover event listeners anteriores para evitar duplicados
    document.querySelectorAll('.resumen-card').forEach(card => {
        card.replaceWith(card.cloneNode(true));
    });

    // Agregar nuevos event listeners
    document.querySelectorAll('.resumen-card').forEach(card => {
        card.addEventListener('click', function () {
            const tipo = Array.from(this.classList).find(cls =>
                ['pendientes', 'proceso', 'directos', 'total'].includes(cls)
            );

            if (tipo) {
                aplicarFiltroPorEstado(tipo);
            }
        });
    });

    console.log('Tarjetas interactivas inicializadas');
}

// Las funciones de filtrado de DataTable han sido removidas por obsolescencia.

// Inicialización al cargar el documento
$(document).ready(function () {
    console.log('Inicializando proyecto con Grid.js');

    const checkDataLoaded = setInterval(() => {
        if (typeof datosGlobales !== 'undefined' && datosGlobales.length > 0) {
            clearInterval(checkDataLoaded);
            cargarTablaDocumentos();
        }
    }, 100);
});

// Exportaciones globales para ui-controls.js y otros
window.aplicarFiltroFecha = aplicarFiltroFecha;
window.aplicarFiltroFechaDataTable = aplicarFiltroFecha; // Compatibilidad con ui-controls.js
window.limpiarFiltros = limpiarFiltros;
window.limpiarFiltroFechaDataTable = limpiarFiltros; // Compatibilidad con ui-controls.js
window.cambiarResponsable = cambiarResponsable;
window.cambiarEstadoDocumento = cambiarEstadoDocumento;
window.restablecerDocumento = restablecerDocumento;
window.imprimirSoloClientesDesdeTabla = imprimirSoloClientesDesdeTabla;
window.actualizarInmediatamente = actualizarInmediatamente;
window.toggleFinalizados = toggleFinalizados;
window.aplicarFiltroPorEstado = aplicarFiltroPorEstado;
window.limpiarFiltroTarjetas = limpiarFiltroTarjetas;
window.inicializarTarjetasInteractivas = inicializarTarjetasInteractivas;
window.cargarTablaDocumentos = cargarTablaDocumentos;
