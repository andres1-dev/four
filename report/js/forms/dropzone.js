/* ==========================================================================
   forms/dropzone.js — Lógica del selector de archivos personalizado
   Conecta cada .file-dropzone con su <input type="file"> oculto,
   y muestra el nombre del archivo seleccionado en la UI.

   Llamado desde app.js → initDropzones() en window.onload.
   ========================================================================== */

/**
 * Inicializa todos los dropzones de la página.
 * Cada dropzone necesita:
 *   - Un <div class="file-dropzone"> con data-input="#idDelInput"
 *   - Un <span class="file-dropzone__name"> dentro para mostrar el nombre
 *   - Un <input type="file" class="file-dropzone__input"> hermano
 */
function initDropzones() {
    // Par imagen
    _bindDropzone('imagenDropzone', 'imagen', 'imagenName');
    // Par soporte
    _bindDropzone('soporteDropzone', 'soporte', 'soporteName');
}

/**
 * Conecta un dropzone con su input nativo.
 * @param {string} zoneId   — ID del div.file-dropzone
 * @param {string} inputId  — ID del input[type="file"] real
 * @param {string} nameId   — ID del span que muestra el nombre
 */
function _bindDropzone(zoneId, inputId, nameId) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const nameEl = document.getElementById(nameId);

    if (!zone || !input) return;

    // Click en la zona → abrir selector de archivos
    zone.addEventListener('click', () => input.click());

    // Teclado (accesibilidad): Enter / Espacio activan el selector
    zone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            input.click();
        }
    });

    // Cuando el usuario elige un archivo
    input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (file) {
            zone.classList.add('has-file');
            if (nameEl) nameEl.textContent = file.name;
        } else {
            zone.classList.remove('has-file');
            if (nameEl) nameEl.textContent = '';
        }
    });

    // Drag & Drop (bonus UX)
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('has-file');     // feedback visual
    });

    zone.addEventListener('dragleave', () => {
        if (!input.files || !input.files[0]) {
            zone.classList.remove('has-file');
        }
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files && files[0]) {
            // Transferir al input nativo (requiere DataTransfer trick)
            try {
                const dt = new DataTransfer();
                dt.items.add(files[0]);
                input.files = dt.files;
                zone.classList.add('has-file');
                if (nameEl) nameEl.textContent = files[0].name;
            } catch (_) {
                // Fallback: algunos navegadores no permiten asignar input.files
                console.warn('[dropzone] Drag & Drop no soportado completamente en este navegador');
            }
        }
    });
}
