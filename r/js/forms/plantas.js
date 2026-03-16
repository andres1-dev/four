/* ==========================================================================
   forms/plantas.js — Formulario de Actualizar Datos de Planta
   ========================================================================== */

function initPlantasMasks() {
    const telefonoInput = document.getElementById('telefonoPlanta');
    const emailInput    = document.getElementById('emailPlanta');

    if (telefonoInput) {
        telefonoInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 10) value = value.slice(0, 10);
            let formatted = '';
            if (value.length > 0) {
                formatted = '(' + value.slice(0, 3);
                if (value.length > 3) formatted += ') ' + value.slice(3, 6);
                if (value.length > 6) formatted += '-' + value.slice(6, 10);
            }
            e.target.value = formatted;
        });
    }

    if (emailInput) {
        // Normalizar a minúsculas en tiempo real y mostrar sugerencias de dominio
        emailInput.addEventListener('input', (e) => {
            const raw = e.target.value;
            const lower = raw.toLowerCase();
            // Forzar minúsculas sin mover el cursor
            if (raw !== lower) {
                const pos = e.target.selectionStart;
                e.target.value = lower;
                e.target.setSelectionRange(pos, pos);
            }

            const datalist = document.getElementById('emailOptions');
            if (!datalist) return;
            datalist.innerHTML = '';

            const atIdx = lower.indexOf('@');
            if (atIdx > 0) {
                const username = lower.slice(0, atIdx);
                const afterAt  = lower.slice(atIdx + 1);
                const domains  = ['gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com','live.com'];
                // Solo mostrar dominios que coincidan con lo que ya escribió después del @
                domains
                    .filter(d => d.startsWith(afterAt))
                    .forEach(d => {
                        const opt = document.createElement('option');
                        opt.value = username + '@' + d;
                        datalist.appendChild(opt);
                    });
            }
        });

        // Validar formato al salir del campo
        emailInput.addEventListener('blur', (e) => {
            const val = e.target.value.trim().toLowerCase();
            e.target.value = val;
            if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                e.target.style.borderColor = '#ef4444';
                e.target.title = 'Correo inválido — debe tener formato usuario@dominio.com';
            } else {
                e.target.style.borderColor = '';
                e.target.title = '';
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', initPlantasMasks);

/**
 * Maneja el envío del formulario de Actualizar Datos de Planta.
 */
async function handleActualizarDatosSubmit(e) {
    e.preventDefault();

    const btn      = e.target.querySelector('button[type="submit"]');
    const inputTel = document.getElementById('telefonoPlanta');
    const inputCed = document.getElementById('cedulaPlanta');

    const rawTelefono  = inputTel.value.replace(/\D/g, '');
    const rawCedula    = inputCed.value.replace(/\D/g, '');
    const nombrePlanta = document.getElementById('nombrePlanta').value;
    const direccion    = document.getElementById('direccionPlanta').value;
    const emailPlanta  = document.getElementById('emailPlanta').value.trim().toLowerCase();

    // Validar correo antes de continuar
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPlanta)) {
        const emailInput = document.getElementById('emailPlanta');
        emailInput.style.borderColor = '#ef4444';
        emailInput.focus();
        Swal.fire({
            icon: 'warning',
            title: 'Correo inválido',
            text: 'Ingresa un correo válido con formato usuario@dominio.com',
            confirmButtonColor: '#3F51B5',
        });
        return;
    }

    // Normalizar a minúsculas en el campo
    document.getElementById('emailPlanta').value = emailPlanta;

    btn.disabled  = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    // 1. Actualizar localStorage ANTES de esperar al GAS — la UI se desbloquea al instante
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.ROL === 'GUEST') {
        currentUser.EMAIL     = emailPlanta;
        currentUser.TELEFONO  = rawTelefono;
        currentUser.DIRECCION = direccion;
        localStorage.setItem('sispro_user', JSON.stringify(currentUser));
    }

    const nuevaPlanta = { ID_PLANTA: rawCedula, PLANTA: nombrePlanta, DIRECCION: direccion, TELEFONO: rawTelefono, EMAIL: emailPlanta };
    const idx = currentPlantas.findIndex(p => p.PLANTA === nombrePlanta);
    if (idx !== -1) currentPlantas[idx] = nuevaPlanta;
    else currentPlantas.push(nuevaPlanta);

    // 2. Mostrar éxito y recargar sin esperar al GAS
    Swal.fire({
        title: '¡Datos guardados!',
        text: 'Tu información ha sido registrada.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
    });

    setTimeout(() => window.location.reload(), 1500);

    // 3. Sincronizar con GAS en background (no bloquea la UI)
    const payload = {
        accion: 'ACTUALIZAR_PLANTA',
        cedula: rawCedula,
        nombrePlanta,
        direccion,
        telefono: rawTelefono,
        email: emailPlanta,
    };
    sendToGAS(payload).catch(err => console.warn('[plantas] Sync GAS falló, datos ya en localStorage:', err));
}
