/* ==========================================================================
   forms/novedades.js — Formulario de Reporte de Novedades
   Depende de: forms/gas.js  (collectLotData, fileToBase64, sendToGAS)
               config.js     (SHEETS_DESTINO)
               ui.js         (hideSections)
   ========================================================================== */

/**
 * Maneja el envío del formulario de Novedades.
 * Recoge área, descripción, cantidad e imagen; construye el payload
 * y lo envía al GAS → hoja "NOVEDADES".
 * @param {Event} e
 */
async function handleNovedadesSubmit(e) {
    e.preventDefault();

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
        // ── Datos del lote seleccionado ──
        const lotData = collectLotData();

        // ── Datos específicos del reporte ──
        const area = document.getElementById('area').value;
        const descripcion = document.getElementById('observacionesNovedad').value;
        const cantidadSolicitada = document.getElementById('cantidadSolicitada').value;

        // ── Imagen adjunta (Base64) ──
        const imagenInput = document.getElementById('imagen');
        let imagenData = null;
        if (imagenInput.files && imagenInput.files[0]) {
            imagenData = await fileToBase64(imagenInput.files[0]);
        }

        const payload = {
            hoja: SHEETS_DESTINO.NOVEDADES,
            ...lotData,
            area,
            descripcion,
            cantidadSolicitada,
            imagen: imagenData,
        };

        await sendToGAS(payload);

        Swal.fire({
            title: '¡Éxito!',
            text: 'Reporte de novedades enviado correctamente.',
            icon: 'success',
            confirmButtonText: 'OK',
        });

        e.target.reset();
        hideSections();

    } catch (error) {
        console.error('[novedades] Error al enviar:', error);
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
