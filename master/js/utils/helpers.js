// ============================================
// NORMALIZACIÓN Y FORMATEO
// ============================================

function normalizeBodega(bodegaCode) {
    return bodegasMap[bodegaCode] || bodegaCode.toUpperCase();
}

function normalizeTipo(tipoCode) {
    return tiposMap[tipoCode] || tipoCode;
}

function normalizeText(text) {
    if (!text) return '';
    return text
        .replace(/�/g, 'Ñ')
        .replace(/Ã‘/g, 'Ñ')
        .replace(/Ã±/g, 'ñ')
        .replace(/Ã/g, 'Ó')
        .replace(/Ã³/g, 'ó')
        .replace(/Ã/g, 'Í')
        .replace(/Ã­/g, 'í')
        .replace(/Ã©/g, 'é')
        .replace(/Ã¡/g, 'á')
        .replace(/Ãº/g, 'ú')
        .replace(/Ã/g, 'Ú');
}

function limpiarTextoPromocion(texto) {
    if (!texto) return texto;
    return texto.replace(/PROMOCION/gi, '').replace(/PROMO/gi, '').replace(/\s+/g, ' ').trim();
}

function formatDate(dateString) {
    if (!dateString) return '';
    return normalizeFecha(dateString.split(' ')[0]);
}

// Normaliza fecha a DD/MM/YYYY con ceros — maneja tanto "19/3/2026" como "19/03/2026"
function normalizeFecha(fechaStr) {
    if (!fechaStr) return '';
    const s = fechaStr.toString().trim().split(' ')[0]; // quitar hora si existe
    const parts = s.split('/');
    if (parts.length !== 3) return s;
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${d}/${m}/${y}`;
}

function formatCosto(costo) {
    return Math.floor(costo).toString();
}

// ============================================
// EXTRACCIÓN DE NÚMEROS
// ============================================

function extractTrasladoNumber(traslado) {
    if (!traslado) return '';
    return traslado.replace(/\D/g, '').replace(/^0+/, '');
}

function extractOSNumber(os) {
    if (!os) return '';
    return os.replace(/\D/g, '').replace(/^0+/, '');
}

// ============================================
// VALIDACIONES
// ============================================

function validarEstado(op, fecha, cantidad) {
    if (!op) return 'PENDIENTE';
    const clave = `${op.trim()}|${normalizeFecha(fecha || '')}|${(cantidad || '').toString().trim()}`;
    return data2Map.has(clave) ? 'CONFIRMADA' : 'PENDIENTE';
}

// ============================================
// CONSULTAS A MAPAS
// ============================================

function getRepresentativeItem(items) {
    if (!items || items.length === 0) return null;
    const itemPrimeras = items.find(item => item.BODEGA === 'PRIMERAS');
    return itemPrimeras || items[0];
}

function getSisproData(op) {
    if (!op) return { PRENDA: '', LINEA: '', GENERO: '' };
    return sisproMap.get(op.trim()) || { PRENDA: '', LINEA: '', GENERO: '' };
}

function getColorName(codigo) {
    if (!codigo) return '';
    return coloresMap.get(codigo.trim()) || codigo;
}

function getPvp(referencia) {
    if (!referencia) return '';
    return preciosMap.get(referencia.trim()) || '';
}

function getReferenciaHistorica(refprov) {
    if (!refprov) return refprov;
    return historicasMap.get(refprov.trim()) || refprov;
}

function getClienteData(id) {
    if (!id) return null;
    return clientesMap.get(id.trim()) || null;
}

// ============================================
// FUNCIONES DE ACCESO A MAPAS DINÁMICOS
// ============================================

/**
 * Obtiene el nombre del usuario/escaner
 */
function getEscanerName(codigo) {
    if (!codigo) return '';
    return escanersMap.get(codigo.trim()) || codigo;
}

/**
 * Obtiene el listado de proveedores activos
 */
function getActiveProveedores() {
    return Array.from(proveedoresMap.values());
}

/**
 * Obtiene el listado de auditores activos
 */
function getActiveAuditores() {
    return Array.from(auditoresMap.values());
}

/**
 * Obtiene el listado de gestores activos
 */
function getActiveGestores() {
    return Array.from(gestoresMap.values());
}

// ============================================
// CÁLCULOS DE NEGOCIO
// ============================================

function getMarca(genero) {
    if (!genero) return '';
    const generoUpper = genero.toUpperCase();
    if (generoUpper.includes('DAMA') || generoUpper.includes('NIÑA')) return 'CHICA CHIC';
    if (generoUpper.includes('HOMBRE') || generoUpper.includes('NIÑO')) return '80 GRADOS';
    return '';
}

function getClaseByPVP(pvp) {
    const valor = parseFloat(pvp);
    if (isNaN(valor)) return "";
    if (valor <= 39900) return "LINEA";
    if (valor <= 59900) return "MODA";
    if (valor > 59900) return "PRONTAMODA";
}

function getDescripcion(prenda, genero, marca, refprov) {
    const partes = [];
    if (prenda) partes.push(prenda);
    if (genero) partes.push(genero);
    if (marca) partes.push(marca);
    if (refprov) partes.push(refprov);
    return partes.join(' ');
}