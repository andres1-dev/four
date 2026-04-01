// Configuración Supabase
const CONFIG = {
  SUPABASE_URL: "https://djgnfyglyvlfhnhvpzxy.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqZ25meWdseXZsZmhuaHZwenh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODk2NTYsImV4cCI6MjA5MDU2NTY1Nn0.sp6O2dvU8Lo3_toGnxyL9KTYaw55gxuLtsXKUXBUjbE",
  SCAN_TIMEOUT: 100,
  MIN_BARCODE_LENGTH: 5
};

// Cliente Supabase
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// Estado de la aplicación
const AppState = {
  consolidated: new Map(),
  totalScans: 0,
  scanTimes: [],
  lastScan: null,
  sessionActive: false,
  sessionStartTime: null,
  sessionEndTime: null,
  timerInterval: null
};

// Referencias DOM
const DOM = {
  input: null,
  status: null,
  lastScanArea: null,
  consolidatedList: null,
  startBtn: null,
  endBtn: null,
  exportCsvBtn: null,
  exportJsonBtn: null,
  clearBtn: null,
  sessionTimer: null
};

// Inicializar DOM
function initDOM() {
  DOM.input = document.getElementById("barcodeInput");
  DOM.status = document.getElementById("status");
  DOM.lastScanArea = document.getElementById("lastScanArea");
  DOM.consolidatedList = document.getElementById("consolidatedList");
  DOM.startBtn = document.getElementById("startBtn");
  DOM.endBtn = document.getElementById("endBtn");
  DOM.exportCsvBtn = document.getElementById("exportCsvBtn");
  DOM.exportJsonBtn = document.getElementById("exportJsonBtn");
  DOM.clearBtn = document.getElementById("clearBtn");
  DOM.sessionTimer = document.getElementById("sessionTimer");
}

// Inicializar eventos
function initEvents() {
  let scanBuffer = "";
  let scanTimeout = null;

  DOM.input.addEventListener("input", function(e) {
    clearTimeout(scanTimeout);
    scanBuffer = DOM.input.value.trim();
    
    if (scanBuffer.length > 0) {
      scanTimeout = setTimeout(() => {
        if (scanBuffer.length >= CONFIG.MIN_BARCODE_LENGTH) {
          processScan(scanBuffer);
        }
        scanBuffer = "";
      }, CONFIG.SCAN_TIMEOUT);
    }
  });

  // Mantener foco durante sesión activa
  setInterval(() => {
    if (AppState.sessionActive && document.activeElement !== DOM.input) {
      DOM.input.focus();
    }
  }, 500);

  // Prevenir pérdida de foco
  document.addEventListener('click', (e) => {
    if (AppState.sessionActive && 
        e.target !== DOM.startBtn && 
        e.target !== DOM.endBtn) {
      DOM.input.focus();
    }
  });
}

// Iniciar aplicación
function init() {
  initDOM();
  initEvents();
  updateStats();
}

// Ejecutar al cargar el DOM
document.addEventListener('DOMContentLoaded', init);
