/* ==========================================================================
   forms/calidad.js — Formulario de Reporte de Calidad
   Depende de: forms/gas.js  (collectLotData, fileToBase64, sendToGAS)
               config.js     (SHEETS_DESTINO)
               ui.js         (DOM, hideSections)
   ========================================================================== */

/**
 * Maneja el envío del formulario de Calidad.
 * Recoge email, localización, tipo de visita, conclusión, observaciones
 * y soporte (archivo); construye el payload y lo envía al GAS → hoja "REPORTES".
 * @param {Event} e
 */
async function handleCalidadSubmit(e) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        // ── Datos del lote seleccionado ──
        const lotData = collectLotData();

        // ── Datos específicos de calidad ──
        const email = document.getElementById('email').value;
        const localizacion = document.getElementById('localizacion')?.value || 'No disponible';
        const tipoVisita = document.getElementById('tipoVisita').value;
        const conclusion = document.getElementById('conclusion').value;
        const observaciones = document.getElementById('observacionesCalidad').value;

        // ── Soporte adjunto (Base64) ──
        const soporteInput = document.getElementById('soporte');
        let soporteData = null;
        if (soporteInput.files && soporteInput.files[0]) {
            soporteData = await fileToBase64(soporteInput.files[0]);
        }

        const payload = {
            hoja: SHEETS_DESTINO.CALIDAD,
            ...lotData,
            email,
            localizacion,
            tipoVisita,
            conclusion,
            observaciones,
            soporte: soporteData,
        };

        await sendToGAS(payload);

        Swal.fire({
            title: '¡Éxito!',
            text: 'Reporte de calidad enviado correctamente.',
            icon: 'success',
            confirmButtonText: 'OK',
        });

        e.target.reset();
        hideSections();

    } catch (error) {
        console.error('[calidad] Error al enviar:', error);
        Swal.fire({
            title: 'Error',
            text: 'No se pudo enviar el reporte. Intente nuevamente.',
            icon: 'error',
            confirmButtonText: 'OK',
        });
    } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar Reporte';
    }
}
