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
  timerInterval: null,
  selectedOP: null,
  opDetails: [],
  opData: null
};

// Referencias DOM
const DOM = {
  input: null,
  status: null,
  startBtn: null,
  endBtn: null,
  exportCsvBtn: null,
  exportJsonBtn: null,
  sessionTimer: null,
  opSelector: null,
  opInput: null,
  opLoadingMessage: null,
  opInfo: null,
  scanArea: null,
  curvaPanel: null,
  curvaTableBody: null,
  selectedOp: null,
  selectedRef: null,
  selectedDesc: null,
  selectedQty: null
};

// Inicializar DOM
function initDOM() {
  DOM.input = document.getElementById("barcodeInput");
  DOM.status = document.getElementById("status");
  DOM.startBtn = document.getElementById("startBtn");
  DOM.endBtn = document.getElementById("endBtn");
  DOM.exportCsvBtn = document.getElementById("exportCsvBtn");
  DOM.exportJsonBtn = document.getElementById("exportJsonBtn");
  DOM.sessionTimer = document.getElementById("sessionTimer");
  DOM.opSelector = document.getElementById("opSelector");
  DOM.opInput = document.getElementById("opInput");
  DOM.opLoadingMessage = document.getElementById("opLoadingMessage");
  DOM.opInfo = document.getElementById("opInfo");
  DOM.scanArea = document.getElementById("scanArea");
  DOM.curvaPanel = document.getElementById("curvaPanel");
  DOM.curvaTableBody = document.getElementById("curvaTableBody");
  DOM.selectedOp = document.getElementById("selectedOp");
  DOM.selectedRef = document.getElementById("selectedRef");
  DOM.selectedDesc = document.getElementById("selectedDesc");
  DOM.selectedQty = document.getElementById("selectedQty");
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

  // Auto-cargar OP mientras escribe
  let opTimeout = null;
  DOM.opInput.addEventListener("input", function(e) {
    clearTimeout(opTimeout);
    const opCode = e.target.value.trim();
    
    // Limpiar mensaje si está vacío
    if (!opCode) {
      DOM.opLoadingMessage.innerHTML = '';
      return;
    }
    
    // Esperar 500ms después de que deje de escribir
    opTimeout = setTimeout(() => {
      if (opCode) {
        loadOP();
      }
    }, 500);
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

// Cargar OP específica
async function loadOP() {
  const opCode = DOM.opInput.value.trim();
  
  if (!opCode) {
    alert('Por favor ingresa un número de OP');
    return;
  }

  try {
    DOM.opLoadingMessage.innerHTML = `
      <div class="loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        Cargando OP ${opCode}...
      </div>
    `;

    const { data, error } = await supabaseClient
      .from('CURVA')
      .select('*')
      .eq('op', opCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        DOM.opLoadingMessage.innerHTML = `
          <div class="error-state">
            <i class="fas fa-exclamation-circle"></i>
            OP "${opCode}" no encontrada
          </div>
        `;
      } else {
        throw error;
      }
      return;
    }

    AppState.selectedOP = opCode;
    AppState.opData = data;
    AppState.opDetails = data.detalles || [];

    // Ocultar selector y mostrar info
    DOM.opSelector.classList.add('hidden');
    DOM.opInfo.classList.remove('hidden');
    DOM.scanArea.classList.remove('hidden');
    DOM.curvaPanel.classList.remove('hidden');

    // Actualizar info de OP
    DOM.selectedOp.textContent = data.op;
    DOM.selectedRef.textContent = data.referencia;
    DOM.selectedDesc.textContent = data.descripcion || 'Sin descripción';
    DOM.selectedQty.textContent = data.cantidad;

    // Renderizar tabla de curva
    UIManager.renderCurvaTable();

    console.log('OP seleccionada:', opCode);
    console.log('Detalles cargados:', AppState.opDetails.length);
    
  } catch (err) {
    console.error('Error cargando OP:', err);
    DOM.opLoadingMessage.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-circle"></i>
        Error al cargar la OP
      </div>
    `;
  }
}

// Cambiar OP
function changeOP() {
  if (AppState.sessionActive) {
    alert('Debes finalizar la sesión antes de cambiar de OP');
    return;
  }

  if (AppState.consolidated.size > 0) {
    if (!confirm('¿Estás seguro? Se perderán los datos escaneados.')) {
      return;
    }
  }

  // Limpiar datos
  AppState.consolidated.clear();
  AppState.totalScans = 0;
  AppState.scanTimes = [];
  AppState.lastScan = null;
  AppState.selectedOP = null;
  AppState.opDetails = [];
  AppState.opData = null;

  // Mostrar selector
  DOM.opSelector.classList.remove('hidden');
  DOM.opInfo.classList.add('hidden');
  DOM.scanArea.classList.add('hidden');
  DOM.curvaPanel.classList.add('hidden');

  // Limpiar input
  DOM.opInput.value = '';
  DOM.opLoadingMessage.innerHTML = '';
  updateStats();
}

// Iniciar aplicación
function init() {
  initDOM();
  initEvents();
  updateStats();
}

// Ejecutar al cargar el DOM
document.addEventListener('DOMContentLoaded', init);
