/* ==========================================================================
   ui.js — Manipulación del DOM, utilidades de presentación
   ========================================================================== */

/* ── Cache de elementos del DOM ── */
const DOM = {
    loader: () => document.getElementById('loader'),
    mainForm: () => document.getElementById('mainForm'),
    loteInput: () => document.getElementById('loteInput'),
    loteSuggestions: () => document.getElementById('loteSuggestions'),
    detailsSection: () => document.getElementById('detailsSection'),
    errorMessage: () => document.getElementById('errorMessage'),
    plantaSelect: () => document.getElementById('planta'),
    lineaInput: () => document.getElementById('linea'),
    accionesSelect: () => document.getElementById('acciones'),
    novedadesSection: () => document.getElementById('novedadesSection'),
    calidadSection: () => document.getElementById('calidadSection'),
    actualizarDatosSection: () => document.getElementById('actualizarDatosSection'),
    fecha: () => document.getElementById('fecha'),
    logo: () => document.getElementById('logo'),
    localizacion: () => document.getElementById('localizacion'),
    nombrePlanta: () => document.getElementById('nombrePlanta'),
    editPlantaBtn: () => document.getElementById('editPlantaBtn'),
};

/* ── Utilidades genéricas ── */

/**
 * Formatea un string de fecha a dd/mm/yyyy.
 * @param {string} dateString
 * @returns {string}
 */
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

/**
 * Si el campo tiene valor, lo deshabilita. Si no, lo habilita.
 * @param {HTMLElement} element
 */
function toggleReadonly(element) {
    if (element.value.trim() !== '') {
        element.setAttribute('disabled', 'disabled');
    } else {
        element.removeAttribute('disabled');
    }
}

/* ── Funciones de visibilidad ── */

/** Limpia la lista de sugerencias de lotes. */
function clearSuggestions() {
    const el = DOM.loteSuggestions();
    el.innerHTML = '';
    el.classList.add('hidden');
}

/** Oculta todas las secciones dinámicas del formulario. */
function hideSections() {
    DOM.detailsSection().classList.add('hidden');
    DOM.novedadesSection().classList.add('hidden');
    DOM.calidadSection().classList.add('hidden');
    DOM.actualizarDatosSection().classList.add('hidden');
    DOM.errorMessage().classList.add('hidden');
    clearSuggestions();
}

/**
 * Muestra el loader y oculta el error.
 */
function showLoader() {
    DOM.loader().classList.remove('hidden');
    DOM.errorMessage().classList.add('hidden');
}

/**
 * Oculta el loader y muestra el formulario principal.
 */
function hideLoaderShowForm() {
    DOM.loader().classList.add('hidden');
    DOM.mainForm().classList.remove('hidden');
}

/**
 * Muestra un mensaje de error al usuario.
 * @param {string} message
 */
function showError(message) {
    const el = DOM.errorMessage();
    el.textContent = message;
    el.classList.remove('hidden');
    DOM.loader().classList.add('hidden');
}

/* ── Poblar elementos del DOM ── */

/**
 * Llena el select de planta con valores únicos de los registros.
 * @param {Object[]} lots
 */
function populatePlantaOptions(lots) {
    const select = DOM.plantaSelect();
    const unique = [...new Set(lots.map((l) => l.PLANTA).filter(Boolean))];

    select.innerHTML = '<option value="">Seleccione una planta...</option>';

    unique.forEach((planta) => {
        const option = document.createElement('option');
        option.value = planta;
        option.textContent = planta;
        select.appendChild(option);
    });
}

/**
 * Rellena los campos de detalle con los datos de un lote seleccionado.
 * @param {Object} lotData
 */
function fillLotDetails(lotData) {
    document.getElementById('lote').value = lotData.LOTE || '';
    document.getElementById('referencia').value = lotData.REFERENCIA || '';
    document.getElementById('cantidad').value = lotData.CANTIDAD || '';
    DOM.plantaSelect().value = lotData.PLANTA || '';
    document.getElementById('salida').value = formatDate(lotData.SALIDA) || '';
    DOM.lineaInput().value = lotData.LINEA || '';
    document.getElementById('proceso').value = lotData.PROCESO || '';

    toggleReadonly(DOM.plantaSelect());
    toggleReadonly(DOM.lineaInput());

    DOM.detailsSection().classList.remove('hidden');
}

/**
 * Renderiza las sugerencias filtradas.
 * @param {Object[]} filteredLots
 */
function renderSuggestions(filteredLots) {
    const container = DOM.loteSuggestions();
    container.innerHTML = '';

    filteredLots.forEach((lot) => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = `${lot.LOTE || ''} - ${lot.PROCESO || 'SIN PROCESO'} - ${lot.PLANTA || 'SIN PLANTA'}`;
        li.dataset.lot = JSON.stringify(lot);
        container.appendChild(li);
    });

    if (filteredLots.length > 0) {
        container.classList.remove('hidden');
    }
}

/**
 * Muestra / oculta las secciones según la acción seleccionada.
 * @param {string} action — 'NOVEDADES' | 'CALIDAD' | 'ACTUALIZAR_DATOS' | ''
 */
function toggleActionSections(action) {
    const novedades = DOM.novedadesSection();
    const calidad = DOM.calidadSection();
    const actualizarDatos = DOM.actualizarDatosSection();

    novedades.classList.toggle('hidden', action !== 'NOVEDADES');
    calidad.classList.toggle('hidden', action !== 'CALIDAD');
    actualizarDatos.classList.toggle('hidden', action !== 'ACTUALIZAR_DATOS');

    // Auto-llenar nombre de planta al abrir formulario de actualización
    if (action === 'ACTUALIZAR_DATOS') {
        fillPlantaName();
    }
}

/**
 * Llena automáticamente el nombre y otros datos conocidos de la planta seleccionada
 * en el formulario de Actualizar Datos.
 */
function fillPlantaName() {
    const plantaValue = DOM.plantaSelect().value;
    DOM.nombrePlanta().value = plantaValue || '';

    // Buscar si ya tenemos datos de esta planta para pre-llenar y que el usuario solo corrija
    if (typeof currentPlantas !== 'undefined' && plantaValue) {
        const info = currentPlantas.find(p => p.PLANTA === plantaValue);
        if (info) {
            const cedulaInput = document.getElementById('cedulaPlanta');
            const direccionInput = document.getElementById('direccionPlanta');
            const telefonoInput = document.getElementById('telefonoPlanta');
            const emailInput = document.getElementById('emailPlanta');

            if (cedulaInput) {
                // Aplicar máscara de miles si existe el dato
                const cedulaRaw = String(info.CEDULA || '').replace(/\D/g, '');
                cedulaInput.value = cedulaRaw ? new Intl.NumberFormat('es-CO').format(cedulaRaw) : '';
            }
            if (direccionInput) direccionInput.value = info.DIRECCION || '';
            if (emailInput) emailInput.value = info.EMAIL || '';

            if (telefonoInput) {
                // Aplicar máscara de teléfono: (XXX) XXX-XXXX
                let telRaw = String(info.TELEFONO || '').replace(/\D/g, '');
                if (telRaw.startsWith('57')) telRaw = telRaw.slice(2); // Quitar prefijo si existe

                let formatted = '';
                if (telRaw.length > 0) {
                    formatted = '(' + telRaw.slice(0, 3);
                    if (telRaw.length > 3) formatted += ') ' + telRaw.slice(3, 6);
                    if (telRaw.length > 6) formatted += '-' + telRaw.slice(6, 10);
                }
                telefonoInput.value = formatted;
            }
        }
    }
}

/** Actualiza el campo de fecha/hora con la fecha actual. */
function updateDateTime() {
    DOM.fecha().value = new Date().toLocaleString();
}

/**
 * Cambia el logo al siguiente en el carrusel.
 * Depende de la constante LOGOS (config.js).
 */
/**
 * Cicla los logos de la empresa.
 */
function cycleLogo() {
    const logo = DOM.logo();
    const currentIndex = LOGOS.findIndex((l) =>
        logo.src.includes(l.split('/').pop()),
    );
    const nextIndex = (currentIndex + 1) % LOGOS.length;
    logo.src = LOGOS[nextIndex];
}

/**
 * Asistente de Redacción con IA (Integración Interna)
 * Conecta con el motor de procesamiento AI para una corrección profesional.
 * @param {string} fieldId
 */
async function mejorarRedaccion(fieldId) {
    const textarea = document.getElementById(fieldId);
    if (!textarea) return;

    let textoOriginal = textarea.value.trim();
    if (!textoOriginal) {
        Swal.fire({
            icon: 'info',
            title: 'Campo vacío',
            text: 'Escribe algo primero para poder pulirlo.',
            timer: 2000,
            showConfirmButton: false
        });
        return;
    }

    // ── Loader de IA Profesional ──
    Swal.fire({
        title: 'PROCESANDO TEXTO',
        html: `
            <div class="text-center py-2">
                <i class="fas fa-circle-notch fa-spin fa-2x text-primary mb-3"></i>
                <p class="mb-0" style="font-size: 0.9rem; color: #666;">Analizando gramática y estructura técnica...</p>
            </div>
        `,
        showConfirmButton: false,
        allowOutsideClick: false,
        customClass: {
            title: 'fw-bold text-dark fs-5',
            popup: 'rounded-4'
        }
    });

    try {
        // --- CONFIGURACIÓN REPLICADA DE CARPETA IA ---
        const apiKey = 'AIzaSyCjogOqyvGhpYCmJnbR46TuVOqR9RyqeuU'; // Llave interna carpeta IA
        const model = 'gemma-3n-e4b-it'; // Modelo específico carpeta IA

        const promptIA = `Actúa como corrector técnico industrial. Corrige ortografía, gramática y normaliza abreviaturas (ej: pta -> planta, cant -> cantidad) del siguiente texto para que sea profesional y ejecutivo. Devuelve solo el resultado corregido.\n\nTexto a corregir: ${textoOriginal}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptIA }] }],
                generationConfig: { temperature: 0.1, topP: 0.95, maxOutputTokens: 1024 }
            })
        });

        if (!response.ok) throw new Error("Error en la respuesta de la IA");

        const data = await response.json();
        let textoPulido = data.candidates[0].content.parts[0].text.trim();
        textoPulido = textoPulido.replace(/^["']|["']$/g, '');

        // ── Panel de Revisión Técnica ──
        Swal.fire({
            title: '<i class="fas fa-wand-sparkles me-2"></i>REVISIÓN DE REDACCIÓN',
            html: `
                <div style="text-align: left; font-family: 'Inter', sans-serif;">
                    <div class="mb-3">
                        <small class="text-muted fw-bold" style="letter-spacing: 0.5px; font-size: 10px; text-transform: uppercase;">
                            <i class="fas fa-terminal me-1"></i> Entrada Original
                        </small>
                        <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; border-left: 3px solid #cbd5e1; margin-top: 5px; color: #64748b; font-size: 0.9rem;">
                            ${textoOriginal}
                        </div>
                    </div>
                    
                    <div class="mb-2">
                        <small class="text-primary fw-bold" style="letter-spacing: 0.5px; font-size: 10px; text-transform: uppercase;">
                            <i class="fas fa-check-double me-1"></i> Propuesta Sugerida
                        </small>
                        <div style="background: #eff6ff; padding: 15px; border-radius: 8px; border: 1.5px solid #3b82f6; margin-top: 5px; color: #1e40af; font-size: 1.05rem; line-height: 1.5; font-weight: 500;">
                            ${textoPulido}
                        </div>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#3F51B5',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'APLICAR CAMBIOS',
            cancelButtonText: 'IGNORAR',
            customClass: {
                title: 'text-start fs-5 fw-bold border-bottom pb-3 mb-3',
                popup: 'rounded-4'
            },
            footer: '<div class="text-center w-100" style="font-size: 10px; color: #94a3b8;"><i class="fas fa-shield-halved me-1"></i>Optimización gramatical bajo estándares de calidad</div>'
        }).then((result) => {
            if (result.isConfirmed) {
                textarea.value = textoPulido;
                Swal.fire({
                    icon: 'success',
                    title: 'CAMBIOS APLICADOS',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000,
                    iconColor: '#3F51B5'
                });
            }
        });

    } catch (error) {
        console.error("IA Error:", error);
        Swal.fire({
            icon: 'error',
            title: 'FALLO TÉCNICO',
            text: 'No se pudo establecer conexión con el motor de IA.',
            confirmButtonColor: '#3F51B5'
        });
    }
}
