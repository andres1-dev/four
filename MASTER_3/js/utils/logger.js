// ============================================
// LOGGER UTILITY — Dedicated HTML Log Module
// ============================================
// Per AGENTS.md: console.log() is FORBIDDEN.
// All runtime logging MUST use this module.

let logContainer = null;
let logEntries = [];
const MAX_LOG_ENTRIES = 1000;

/**
 * Inicializa el contenedor de logs HTML
 */
function initializeLogger() {
    if (logContainer) return;

    logContainer = document.createElement('div');
    logContainer.id = 'logContainer';
    logContainer.style.cssText = `
        position: fixed;
        bottom: 0;
        right: 0;
        width: 400px;
        max-height: 300px;
        background: var(--bg-dark, #1e1e1e);
        border: 1px solid var(--border, #3c3c3c);
        border-radius: 4px 0 0 0;
        overflow-y: auto;
        font-family: 'Cascadia Code', 'Consolas', monospace;
        font-size: 11px;
        z-index: 9999;
        display: none;
    `;

    document.body.appendChild(logContainer);
}

/**
 * Escribe un log entry al contenedor HTML
 */
function writeLogEntry(level, module, message, payload) {
    initializeLogger();

    const timestamp = new Date().toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3
    });

    const entry = {
        timestamp,
        level,
        module,
        message,
        payload: payload ? JSON.stringify(payload) : null
    };

    logEntries.push(entry);

    // Limitar tamaño del log
    if (logEntries.length > MAX_LOG_ENTRIES) {
        logEntries.shift();
    }

    // Renderizar en HTML
    const logLine = document.createElement('div');
    logLine.className = `log-entry log-${level}`;
    logLine.style.cssText = `
        padding: 4px 8px;
        border-bottom: 1px solid var(--border, #3c3c3c);
        color: ${getLogColor(level)};
    `;

    let text = `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}`;
    if (payload) {
        text += ` ${JSON.stringify(payload)}`;
    }

    logLine.textContent = text;
    logContainer.appendChild(logLine);

    // Auto-scroll al final
    logContainer.scrollTop = logContainer.scrollHeight;

    // También escribir a console.error para errores críticos
    if (level === 'error') {
        console.error(`[${module}] ${message}`, payload || '');
    } else if (level === 'warn') {
        console.warn(`[${module}] ${message}`, payload || '');
    }
}

function getLogColor(level) {
    const colors = {
        'info': '#3794ff',
        'warn': '#ff8c00',
        'error': '#f44747',
        'success': '#0dbc79'
    };
    return colors[level] || '#d4d4d4';
}

/**
 * API pública del Logger
 */
const Logger = {
    info: (module, message, payload) => writeLogEntry('info', module, message, payload),
    warn: (module, message, payload) => writeLogEntry('warn', module, message, payload),
    error: (module, message, error) => writeLogEntry('error', module, message, error),
    success: (module, message, payload) => writeLogEntry('success', module, message, payload),
    
    /**
     * Muestra/oculta el panel de logs
     */
    toggle: () => {
        initializeLogger();
        logContainer.style.display = logContainer.style.display === 'none' ? 'block' : 'none';
    },

    /**
     * Limpia todos los logs
     */
    clear: () => {
        logEntries = [];
        if (logContainer) {
            logContainer.innerHTML = '';
        }
    },

    /**
     * Exporta los logs como texto
     */
    export: () => {
        return logEntries.map(e => 
            `[${e.timestamp}] [${e.level.toUpperCase()}] [${e.module}] ${e.message}${e.payload ? ' ' + e.payload : ''}`
        ).join('\n');
    }
};

// Exponer globalmente
window.Logger = Logger;

// Atajo de teclado: Ctrl+Shift+L para toggle logs
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        Logger.toggle();
    }
});
