/* ==========================================================================
   forms/plantas.js — Formulario de Actualizar Datos de Planta
   Incluye: Google Places Autocomplete, mini-mapa interactivo,
            reverse-geocoding, geolocalización y envío al GAS.

   Depende de: forms/gas.js  (sendToGAS)
               config.js     (SHEETS_DESTINO)
               ui.js         (DOM, hideSections)
               Google Maps API (cargado en index.html)
   ========================================================================== */

/* ── Referencias (no requeridas para versión simplificada sin mapas) ── */

/**
 * Nota: Se han eliminado las funciones de Google Maps y Geolocalización 
 * por requerimiento de simplificación del formulario.
 */

/* ══════════════════════════════════════════════════════════════════════════
   ENVÍO DEL FORMULARIO DE PLANTAS
   ══════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════════
   ENVÍO DEL FORMULARIO DE PLANTAS
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Inicializa las máscaras de entrada para el formulario de plantas.
 * Se llama automáticamente para mejorar la UX.
 */
function initPlantasMasks() {
    const telefonoInput = document.getElementById('telefonoPlanta');
    const cedulaInput = document.getElementById('cedulaPlanta');
    const emailInput = document.getElementById('emailPlanta');

    if (telefonoInput) {
        telefonoInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, ''); // Solo números
            if (value.length > 10) value = value.slice(0, 10); // Máximo 10 dígitos

            let formatted = '';
            if (value.length > 0) {
                formatted = '(' + value.slice(0, 3);
                if (value.length > 3) {
                    formatted += ') ' + value.slice(3, 6);
                }
                if (value.length > 6) {
                    formatted += '-' + value.slice(6, 10);
                }
            }
            e.target.value = formatted;
        });
    }

    if (cedulaInput) {
        cedulaInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, ''); // Solo números
            if (value === '') {
                e.target.value = '';
                return;
            }
            // Formatear con separador de miles
            const formatted = new Intl.NumberFormat('es-CO').format(value);
            e.target.value = formatted;
        });

        // Verificar cédula solo cuando el usuario termina de escribir (blur event)
        cedulaInput.addEventListener('blur', verificarCedulaPlanta);
    }

    if (emailInput) {
        emailInput.addEventListener('input', (e) => {
            const value = e.target.value;
            const datalist = document.getElementById('emailOptions');
            if (value.includes('@')) {
                const [username, domain] = value.split('@');
                const commonDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'live.com', 'msn.com', 'me.com', 'aol.com', 'protonmail.com', 'zoho.com'];

                // Actualizar datalist dinámicamente si es necesario
                datalist.innerHTML = '';
                commonDomains.forEach(d => {
                    const option = document.createElement('option');
                    option.value = username + '@' + d;
                    datalist.appendChild(option);
                });
            }
        });
    }
}

// Llamar a la inicialización al cargar el script o mediante un trigger externo
document.addEventListener('DOMContentLoaded', initPlantasMasks);

/**
 * Verifica la cédula ingresada contra los datos registrados de la planta.
 * Solo permite continuar si la cédula coincide.
 */
function verificarCedulaPlanta() {
    const cedulaInput = document.getElementById('cedulaPlanta');
    const nombrePlanta = document.getElementById('nombrePlanta').value;
    const rawCedula = cedulaInput.value.replace(/\D/g, '');

    if (!rawCedula) return;

    // Buscar la planta en los registros
    const plantaRegistrada = currentPlantas.find(p =>
        (p.PLANTA || '').toString().trim().toLowerCase() === nombrePlanta.trim().toLowerCase()
    );

    // Si la planta existe y tiene cédula registrada
    if (plantaRegistrada && plantaRegistrada.CEDULA) {
        const cedulaRegistrada = plantaRegistrada.CEDULA.toString().replace(/\D/g, '');
        
        if (rawCedula === cedulaRegistrada) {
            // Cédula correcta: desbloquear campos
            desbloquearCamposPlanta(plantaRegistrada);
            Swal.fire({
                title: 'Verificación Exitosa',
                text: 'Cédula verificada. Ahora puede actualizar los datos.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            // Cédula incorrecta: bloquear acceso
            bloquearCamposPlanta();
            Swal.fire({
                title: 'Acceso Denegado',
                text: 'La cédula ingresada no coincide con los registros de esta planta.',
                icon: 'error',
                confirmButtonColor: '#d33'
            });
            cedulaInput.value = '';
        }
    } else {
        // Planta nueva sin registro previo: permitir registro
        desbloquearCamposPlanta(null);
    }
}

/**
 * Desbloquea los campos del formulario y pre-llena con datos existentes.
 * @param {Object|null} plantaData - Datos de la planta registrada o null si es nueva
 */
function desbloquearCamposPlanta(plantaData) {
    const direccionInput = document.getElementById('direccionPlanta');
    const telefonoInput = document.getElementById('telefonoPlanta');
    const emailInput = document.getElementById('emailPlanta');
    const submitBtn = document.querySelector('#actualizarDatosForm button[type="submit"]');

    // Desbloquear campos
    direccionInput.removeAttribute('readonly');
    telefonoInput.removeAttribute('readonly');
    emailInput.removeAttribute('readonly');
    if (submitBtn) submitBtn.removeAttribute('disabled');

    // Pre-llenar con datos existentes si los hay
    if (plantaData) {
        direccionInput.value = plantaData.DIRECCION || '';
        
        // Formatear teléfono
        const tel = (plantaData.TELEFONO || '').replace(/\D/g, '');
        if (tel.length === 10) {
            telefonoInput.value = `(${tel.slice(0, 3)}) ${tel.slice(3, 6)}-${tel.slice(6, 10)}`;
        } else {
            telefonoInput.value = tel;
        }
        
        emailInput.value = plantaData.EMAIL || '';
    }

    // Cambiar estilo visual para indicar que están desbloqueados
    [direccionInput, telefonoInput, emailInput].forEach(input => {
        input.style.backgroundColor = '#ffffff';
        input.style.borderColor = '#ced4da';
    });
}

/**
 * Bloquea los campos del formulario para proteger datos.
 */
function bloquearCamposPlanta() {
    const direccionInput = document.getElementById('direccionPlanta');
    const telefonoInput = document.getElementById('telefonoPlanta');
    const emailInput = document.getElementById('emailPlanta');
    const submitBtn = document.querySelector('#actualizarDatosForm button[type="submit"]');

    // Bloquear campos
    direccionInput.setAttribute('readonly', true);
    telefonoInput.setAttribute('readonly', true);
    emailInput.setAttribute('readonly', true);
    if (submitBtn) submitBtn.setAttribute('disabled', true);

    // Limpiar valores
    direccionInput.value = '';
    telefonoInput.value = '';
    emailInput.value = '';

    // Cambiar estilo visual para indicar que están bloqueados
    [direccionInput, telefonoInput, emailInput].forEach(input => {
        input.style.backgroundColor = '#f8f9fa';
        input.style.borderColor = '#dee2e6';
    });
}

/**
 * Maneja el envío del formulario de Actualizar Datos de Planta.
 * @param {Event} e
 */
async function handleActualizarDatosSubmit(e) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    const inputTel = document.getElementById('telefonoPlanta');
    const inputCed = document.getElementById('cedulaPlanta');

    // EXTRACCIÓN LIMPIA: Forzamos la eliminación de cualquier carácter no numérico
    // Esto quita (), -, espacios y el prefijo +57 si el navegador lo incluyó por error
    const rawTelefono = inputTel.value.replace(/\D/g, '');
    const rawCedula = inputCed.value.replace(/\D/g, '');

    const nombrePlanta = document.getElementById('nombrePlanta').value;
    const direccion = document.getElementById('direccionPlanta').value;
    const emailPlanta = document.getElementById('emailPlanta').value;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const payload = {
            hoja: SHEETS_DESTINO.PLANTAS,
            cedula: rawCedula,
            nombrePlanta: nombrePlanta,
            direccion: direccion,
            telefono: rawTelefono, // ENVIAR SOLO NÚMEROS (EJ: 3244566666)
            email: emailPlanta,
        };

        console.log('[plantas] Enviando payload limpio:', payload);

        await sendToGAS(payload);

        // Actualizar estado local (usando las mismas claves que SHEET_PLANTAS.headers)
        const nuevaPlanta = {
            PLANTA: nombrePlanta,
            CEDULA: rawCedula,
            DIRECCION: direccion,
            TELEFONO: rawTelefono,
            EMAIL: emailPlanta
        };

        const idx = currentPlantas.findIndex(p => p.PLANTA === nombrePlanta);
        if (idx !== -1) currentPlantas[idx] = nuevaPlanta;
        else currentPlantas.push(nuevaPlanta);

        Swal.fire({
            title: '¡REGISTRO EXITOSO!',
            text: `La planta "${nombrePlanta}" ha sido registrada. Ahora puede proceder con su reporte.`,
            icon: 'success',
            confirmButtonColor: '#3F51B5',
            confirmButtonText: 'CONTINUAR',
        });

        // Desbloquear UI
        const accionesContainer = DOM.accionesSelect().closest('.mb-3');
        if (accionesContainer) accionesContainer.style.display = 'block';

        DOM.accionesSelect().removeAttribute('disabled');
        DOM.accionesSelect().value = '';
        // Limpiar el input principal para que solo quede el lote
        const loteSolo = document.getElementById('lote').value;
        if (loteSolo) DOM.loteInput().value = loteSolo;

        e.target.reset();
        hideSections();

    } catch (error) {
        console.error('[plantas] Error al guardar datos:', error);
        Swal.fire({
            title: 'Error',
            text: 'No se pudieron guardar los datos. Intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'OK',
        });
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar Datos';
    }
}
