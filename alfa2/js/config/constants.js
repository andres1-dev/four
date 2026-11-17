// ============================================
// CONFIGURACIÓN Y CONSTANTES GLOBALES
// ============================================

// API Keys y URLs - Google Sheets
const API_KEY = 'AIzaSyC7hjbRc0TGLgImv8gVZg8tsOeYWgXlPcM';
const SPREADSHEET_ID = '133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyM5AsR4WOLdfPWBp4uW_diONnaiaAThobOUE1Q4kwgSMXSsuorpdsmT8c52CeDXPgI/exec';  // POST
const SISPROWEB_GAS_URL = 'https://script.google.com/macros/s/AKfycbynUt4GdCEYaGSqnbctsNXaib52MTm0cVQlehGnt0-6B7fOTv31HoYWjCLRndiQi8r1Pg/exec';  // POST
const GAS_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzRk9ksTH3DWM2kXhYHeMQ5KqyLHVXygQulF_p__cX0cVkTHagGE8_7V63yLfCuL2_T/exec';  // Espejo Supabase → Sheets (Ingresos/Distribuciones)
const GAS_CONSULTA_URL = 'PEGAR_URL_CONSULTA_GAS_AQUI'; // Reemplaza edge fn relacionar-ingresos-distribuciones

// Supabase Configuration
const SUPABASE_URL = 'https://ymaojqjdnrpfkrtuezcw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYW9qcWpkbnJwZmtydHVlemN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTIwMTAsImV4cCI6MjEwMTQyODAxMH0.3Zzsw_sriPPjNM8emcOslLNSnadPs8cSguNUCA2MNu8';

// Configuración secundaria para Catálogo MASTER (proyecto zpikjjcbievfpzegupmw)
const SUPABASE_MASTER_URL = 'https://zpikjjcbievfpzegupmw.supabase.co';
const SUPABASE_MASTER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g';
const SUPABASE_MASTER_QUERY_URL = 'https://zpikjjcbievfpzegupmw.supabase.co/functions/v1/query';

// Constantes de Distribución
const DIS_API_KEY = API_KEY;
const DISTRIBUTION_API_KEY = DIS_API_KEY;
const SOURCE_SPREADSHEET_ID = "1esc5REq0c03nHLpGcLwZRW29yq2gZnrpbz75gCCjrqc";
const DISTRIBUTION_SPREADSHEET_ID = '1d5dCCCgiWXfM6vHu3zGGKlvK2EycJtT7Uk4JqUjDOfE';
const DISTRIBUTION_SHEET_NAME = 'DATA';
const DISTRIBUTION_GAS_URL = 'https://script.google.com/macros/s/AKfycbzjzmTx_vvl_wGYY9A1_7kP13XH30BGhxgtvf5EXpGDwJ5Wat8DhSOEHM-kx6J2j51DmA/exec'; // POST SIN GET

// ============================================
// HOJAS DE CONFIGURACIÓN DINÁMICA
// ============================================
const CONFIG_SHEETS = {
    USUARIOS: 'USUARIOS',
    PROVEEDORES: 'PROVEEDORES',
    AUDITORES: 'AUDITORES',
    GESTORES: 'GESTORES'
};

// ============================================
// MAPAS DE CONFIGURACIÓN (ahora dinámicos)
// ============================================

// Escáneres - se cargará desde Google Sheets
let escanersMap = new Map();

// Proveedores - se cargará desde Google Sheets
let proveedoresMap = new Map();

// Auditores - se cargará desde Google Sheets
let auditoresMap = new Map();

// Gestores - se cargará desde Google Sheets
let gestoresMap = new Map();

const bodegasMap = {
    "DI": "PRIMERAS",
    "ZY": "SIN CONFECCIONAR",
    "ZZ": "PROMOCIONES",
    "BP": "COBROS",
    "XT": "TRANSITO",
    "PR": "CONTABLE"
};

const tiposMap = {
    "AT": "AJUSTE TALLAS",
    "EC": "ENTRADA CORTE",
    "SA": "SALIDA ALMACEN",
    "SC": "SALIDA COBRO",
    "ST": "SALIDA AJUSTE",
    "TR": "TRASLADO"
};

// ============================================
// VARIABLES GLOBALES DE ESTADO (singleton)
// ============================================

// Datos principales
let processedData = [];
let coloresMap = new Map();
let data2Map = new Map();
let data2CountMap = new Map(); // cuenta ocurrencias por OP en col G
let data2JsonMap = new Map(); // almacena JSON de columna S por LOTE
let preciosMap = new Map();
let sisproMap = new Map();
let historicasMap = new Map();
let clientesMap = new Map();
let currentOPData = null;
let cancelledTransfers = new Set();
let transferListData = [];
let showInactivesInModals = false; // Control de visibilidad para registros inactivos en modales maestros

// Exportar mapas a window para que sean accesibles globalmente
window.coloresMap = coloresMap;
window.clientesMap = clientesMap;
window.preciosMap = preciosMap;
window.sisproMap = sisproMap;
window.historicasMap = historicasMap;
window.data2Map = data2Map;
window.data2CountMap = data2CountMap;
window.data2JsonMap = data2JsonMap;
window.proveedoresMap = proveedoresMap;
window.escanersMap = escanersMap;
window.auditoresMap = auditoresMap;
window.gestoresMap = gestoresMap;

// Variables de distribución
let allRecData = [];
let allConfigData = {};
let activeMayoristas = [];
let empresasData = [];
let currentRecData = null;
let colorOptions = [];
let tallaOptions = [];
let mayoristaFilters = {};

// Estado de distribución
let empresasDistributionState = -1;

// ============================================
// FUNCIONES DE ACCESO A VARIABLES GLOBALES
// ============================================

function setProcessedData(data) {
    processedData = data;
}

function setCurrentOPData(data) {
    currentOPData = data;
}

function addCancelledTransfer(transfer) {
    cancelledTransfers.add(transfer);
}

function removeCancelledTransfer(transfer) {
    cancelledTransfers.delete(transfer);
}

function clearCancelledTransfers() {
    cancelledTransfers.clear();
}

// Setters para variables de distribución
function setAllRecData(data) {
    allRecData = data;
}

function setAllConfigData(data) {
    allConfigData = data;
}

function setActiveMayoristas(data) {
    activeMayoristas = data;
}

function setEmpresasData(data) {
    empresasData = data;
}

function setCurrentRecData(data) {
    currentRecData = data;
}

function setColorOptions(data) {
    colorOptions = data;
}

function setTallaOptions(data) {
    tallaOptions = data;
}

function setMayoristaFilters(data) {
    mayoristaFilters = data;
}

function setMayoristaFilter(id, filter) {
    mayoristaFilters[id] = filter;
}

function setEmpresasDistributionState(state) {
    empresasDistributionState = state;
}

// ============================================
// SETTERS PARA MAPAS DINÁMICOS
// ============================================

function setEscanersMap(data) {
    escanersMap = data;
    window.escanersMap = data;
}

function setProveedoresMap(data) {
    proveedoresMap = data;
    window.proveedoresMap = data;
}

function setAuditoresMap(data) {
    auditoresMap = data;
    window.auditoresMap = data;
}

function setGestoresMap(data) {
    gestoresMap = data;
    window.gestoresMap = data;
}

function setData2Maps(map, countMap, jsonMap) {
    data2Map = map;
    data2CountMap = countMap;
    data2JsonMap = jsonMap;
    window.data2Map = map;
    window.data2CountMap = countMap;
    window.data2JsonMap = jsonMap;
}