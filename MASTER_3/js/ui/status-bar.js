// ============================================
// STATUS BAR — UI Component
// ============================================

/**
 * Actualiza el mensaje e ícono principal del status bar.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'|'loading'} type
 */
function updateStatus(message, type = 'info') {
    const statusMessage = document.getElementById('statusMessage');
    const statusIcon    = document.getElementById('statusIcon');

    if (statusMessage) statusMessage.textContent = message;

    if (statusIcon) {
        const icons = {
            'info':    'codicon codicon-info',
            'success': 'codicon codicon-check',
            'warning': 'codicon codicon-warning',
            'error':   'codicon codicon-error',
            'loading': 'codicon codicon-loading codicon-modifier-spin'
        };
        statusIcon.className = `status-icon ${icons[type] || icons.info}`;
    }
}

// ============================================
// TIMING DISPLAY
// ============================================

/** @type {number|null} Marca de inicio de la carga activa */
let _loadStartTime = null;

/**
 * Registra el inicio de una carga de datos.
 * Llamar justo antes de los primeros fetch.
 */
function statusTimingStart() {
    _loadStartTime = performance.now();
}

/**
 * Registra el fin de la carga y muestra en el status bar:
 *   ⏱ 4.2s
 * El tooltip muestra el desglose completo.
 *
 * @param {boolean} [success=true] - Si la carga terminó correctamente
 */
function statusTimingEnd(success = true) {
    if (_loadStartTime === null) return;

    const elapsed   = performance.now() - _loadStartTime;
    const seconds   = (elapsed / 1000).toFixed(1);
    const now       = new Date();
    const timeStr   = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const timingEl  = document.getElementById('statusTiming');
    const labelEl   = document.getElementById('statTimingLabel');

    if (!timingEl || !labelEl) return;

    // Mostrar tiempo de carga en segundos
    labelEl.textContent = `${seconds}s`;

    timingEl.title = `Última actualización: ${timeStr}\nTiempo de carga: ${seconds}s (${Math.round(elapsed)}ms)${success ? '' : ' — con errores'}`;

    // Color según tiempo
    timingEl.classList.remove('timing-medium', 'timing-slow');
    if (elapsed > 10000) {
        timingEl.classList.add('timing-slow');
    } else if (elapsed > 5000) {
        timingEl.classList.add('timing-medium');
    }

    // Mostrar el bloque
    timingEl.classList.add('timing-visible');

    _loadStartTime = null;
}


/**
 * Muestra los items del status bar con animación
 */
function revealStatItems() {
    const items = document.querySelectorAll('.status-right .status-item');
    items.forEach((item, i) => {
        setTimeout(() => {
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, i * 50);
    });
}

// ============================================
// EXPORTS
// ============================================

window.updateStatus = updateStatus;
window.statusTimingStart = statusTimingStart;
window.statusTimingEnd = statusTimingEnd;
window.revealStatItems = revealStatItems;
