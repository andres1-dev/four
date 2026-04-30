// Configuración y constantes globales
const CONFIG = {
    APP_NAME: "DeepScope",
    APP_SHORT_NAME: "DeepScope",
    APP_DESCRIPTION: "Professional QR Delivery System",
    APP_VERSION: "7.3.14", // Updated version matching the build number
    VERSION: "7.3.14", // Keep for legacy support if needed
    CACHE_TTL: 24 * 60 * 60 * 1000, // 24 horas en milisegundos
    MAX_IMAGE_SIZE: 800, // Tamaño máximo para redimensionar imágenes
    MAX_CHUNK_SIZE: 50000, // ~50KB por solicitud
    FOOTER_CREDITS: "Developed by <strong>Andrés Mendoza</strong><br>2026 · Supported by GrupoTDM",
    SOCIAL_LINKS: {
        FACEBOOK: "https://www.facebook.com/templodelamoda/",
        INSTAGRAM: "https://www.instagram.com/eltemplodelamoda/",
        WHATSAPP: "https://wa.me/573168007979"
    },
    // Configuración de Sesión - DESACTIVADA (solo logout manual)
    SESSION_TIMEOUT_MS: Infinity, // Sin timeout automático
    ACTIVITY_KEY: 'last_activity_timestamp',
    
    // Configuración de Supabase
    SUPABASE_URL: "https://iladaofarozipitwaeti.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsYWRhb2Zhcm96aXBpdHdhZXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NjYzMDksImV4cCI6MjA5MzA0MjMwOX0.4fyiibeZS10DCgov62d7tIFVzJHsklsBrbokAJ9ptK8",
    
    // ⚠️ DEPRECADO: Google Sheets API Key se obtiene desde el backend
    // No usar esta clave directamente, se mantiene solo para compatibilidad temporal
    GOOGLE_SHEETS_API_KEY: null, // Se obtiene dinámicamente desde el servidor al hacer login
    
    // 🔇 Control de Logs (Producción)
    DEBUG_MODE: false, // Cambiar a true solo para desarrollo
    LOG_LEVELS: {
        ERROR: true,    // Siempre mostrar errores
        WARN: false,    // Advertencias solo en debug
        INFO: false,    // Info solo en debug
        SUCCESS: false  // Éxitos solo en debug
    }
};

// Asegurar que CONFIG sea accesible globalmente en todos los scripts
window.CONFIG = CONFIG;

// 🔇 Sistema de Logging Centralizado
window.log = {
    error: (...args) => {
        if (CONFIG.LOG_LEVELS.ERROR) console.error(...args);
    },
    warn: (...args) => {
        if (CONFIG.DEBUG_MODE && CONFIG.LOG_LEVELS.WARN) console.warn(...args);
    },
    info: (...args) => {
        if (CONFIG.DEBUG_MODE && CONFIG.LOG_LEVELS.INFO) console.log(...args);
    },
    success: (...args) => {
        if (CONFIG.DEBUG_MODE && CONFIG.LOG_LEVELS.SUCCESS) console.log(...args);
    }
};

// 🔇 Silenciar console.log en producción (solo si DEBUG_MODE está desactivado)
if (!CONFIG.DEBUG_MODE) {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    
    console.log = function(...args) {
        // Solo permitir logs que empiecen con [CRITICAL] o [ERROR]
        const firstArg = args[0];
        if (typeof firstArg === 'string' && (firstArg.includes('[CRITICAL]') || firstArg.includes('[ERROR]'))) {
            originalLog.apply(console, args);
        }
        // Silenciar todo lo demás
    };
    
    console.warn = function(...args) {
        // Silenciar warnings en producción
    };
    
    console.info = function(...args) {
        // Silenciar info en producción
    };
    
    // Mantener console.error siempre activo
    // console.error no se modifica
}

// Mapeo de clientes a NIT (Movido aquí para acceso global)
const CLIENTS_MAP = {
    "INVERSIONES URBANA SAS": "901920844",
    "EL TEMPLO DE LA MODA FRESCA SAS": "900047252",
    "EL TEMPLO DE LA MODA SAS": "805027653",
    "ARISTIZABAL LOPEZ JESUS MARIA": "70825517",
    "QUINTERO ORTIZ JOSE ALEXANDER": "14838951",
    "QUINTERO ORTIZ PATRICIA YAMILET": "67006141",
    "ZULUAGA GOMEZ RUBEN ESTEBAN": "1007348825",
    "SON Y LIMON SAS": "900355664"
};

// Configuración de Usuario (con persistencia)
const DEFAULT_SETTINGS = {
    persistentFocus: false, // Se activa solo en modo PDA
    audioFeedback: true,
    filterEnabled: false,
    selectedClient: ""
};

let USER_SETTINGS = { ...DEFAULT_SETTINGS };

// Cargar configuración guardada
try {
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        USER_SETTINGS = { ...DEFAULT_SETTINGS, ...parsed };
    }
} catch (e) {
    console.error("Error cargando configuración usuario:", e);
}

// El persistentFocus se maneja dinámicamente según el modo
// No se fuerza a false aquí

function saveUserSettings() {
    try {
        // Guardar todos los ajustes incluyendo persistentFocus
        localStorage.setItem('userSettings', JSON.stringify(USER_SETTINGS));
    } catch (e) {
        console.error("Error guardando configuración:", e);
    }
}

// Guardar/Cargar Modo de App
function saveAppMode(mode) {
    try {
        localStorage.setItem('appMode', mode);
    } catch (e) {
        console.error("Error guardando modo:", e);
    }
}

function getSavedAppMode() {
    try {
        return localStorage.getItem('appMode') || 'CAMERA';
    } catch (e) {
        return 'CAMERA';
    }
}

// API URLs - SUPABASE (Migrado desde Google Sheets)
const SUPABASE_URL = "https://iladaofarozipitwaeti.supabase.co";
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// API para subir entregas con imágenes (Supabase Edge Function)
const API_URL_POST = `${SUPABASE_FUNCTIONS_URL}/upload-entregas`;

// API_URL Notificaciones Push (r1 - VAPID/JWT dedicado) - MANTENER GOOGLE SHEETS
const API_URL_NOTIF = "https://script.google.com/macros/s/AKfycbwreGMo-ZITm8PUkGJfMVu1cwKMsnUhfD1BZO18qFBa9CFcWd50VzBDKwDMKCubYhg5Cg/exec";

// Variables globales de estado
let database = [];
let cameraStream = null;
let currentDocumentData = null;
let photoBlob = null;
let preventKeyboardTimer = null;
let currentQRParts = null;
let dataLoaded = false;

// Constantes para la cola de carga - SISTEMA PROFESIONAL V2
const UPLOAD_QUEUE_KEY = 'uploadQueue';

// Configuración de reintentos con estrategia exponencial backoff
const RETRY_CONFIG = {
  MAX_RETRIES: 5, // Máximo de reintentos antes de marcar como fallido
  INITIAL_DELAY: 2000, // Delay inicial: 2 segundos
  MAX_DELAY: 60000, // Delay máximo: 60 segundos
  BACKOFF_MULTIPLIER: 2, // Multiplicador exponencial
  JITTER: true, // Agregar variación aleatoria para evitar thundering herd
  
  // Errores que son recuperables (reintentar)
  RECOVERABLE_ERRORS: [
    'NetworkError',
    'Failed to fetch',
    'Network request failed',
    'timeout',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'offline',
    '408', // Request Timeout
    '429', // Too Many Requests
    '500', // Internal Server Error
    '502', // Bad Gateway
    '503', // Service Unavailable
    '504'  // Gateway Timeout
  ],
  
  // Errores que NO son recuperables (fallar inmediatamente)
  FATAL_ERRORS: [
    '400', // Bad Request
    '401', // Unauthorized
    '403', // Forbidden
    '404', // Not Found
    '413', // Payload Too Large
    '422'  // Unprocessable Entity
  ]
};

// La cola de carga se inicializa globalmente en cola_carga.js (window.uploadQueue)
// ya que cola_carga.js se cargará después de este archivo de configuración.
