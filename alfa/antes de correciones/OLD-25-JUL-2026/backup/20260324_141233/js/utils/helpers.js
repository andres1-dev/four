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

// ============================================
// VALIDACIÓN DE PARCIALES (NUEVA LÓGICA)
// ============================================

/**
 * Valida el estado de una OP basándose en la columna S (JSON) de DATA2
 * 
 * @param {string} lote - Número de lote (OP)
 * @param {string} traslado - Número de traslado
 * @param {number} totalGeneral - Total general del CSV (columna T, row[19])
 * @param {number} cantidad - Cantidad del CSV (columna J, row[9])
 * @returns {object} { tipo: 'NUEVO'|'REPETIDO'|'PARCIAL'|'RECHAZADO', mensaje: string, esParcial: boolean, sufijo: string }
 */
function validarEstadoParcial(lote, traslado, totalGeneral, cantidad) {
    if (!lote) {
        return { 
            tipo: 'NUEVO', 
            mensaje: 'Lote nuevo', 
            esParcial: false, 
            sufijo: lote 
        };
    }

    const loteStr = lote.toString().trim();
    const trasladoStr = traslado.toString().trim();
    const registrosExistentes = data2JsonMap.get(loteStr);

    // 1. LOTE NO EXISTE → NUEVO
    if (!registrosExistentes || registrosExistentes.length === 0) {
        return { 
            tipo: 'NUEVO', 
            mensaje: 'Lote nuevo', 
            esParcial: false, 
            sufijo: loteStr 
        };
    }

    // Ordenar registros por fecha: [0] es el más NUEVO, [length-1] es el ORIGINAL (más antiguo)
    const registrosOrdenados = [...registrosExistentes].sort((a, b) => {
        const fechaA = parseFechaToTimestamp(a.FECHA);
        const fechaB = parseFechaToTimestamp(b.FECHA);
        return fechaB - fechaA;
    });

    const ultimoRegistro = registrosOrdenados[0];
    const registroOriginal = registrosOrdenados[registrosOrdenados.length - 1]; // El primero que se creó
    
    // 2. TRASLADO EXISTENTE EN CABECERA O ANEXOS → REPETIDO (Rechazo inmediato)
    const existeTrasladoEnHistorial = registrosExistentes.some(reg => {
        // Revisar encabezado principal
        if ((reg.TRASLADO || '').toString().trim() === trasladoStr) return true;
        
        // Revisar traslados internos en los anexos
        if (reg.ANEXOS && Array.isArray(reg.ANEXOS)) {
            return reg.ANEXOS.some(a => (a.TRASLADO || '').toString().trim() === trasladoStr);
        }
        return false;
    });

    if (existeTrasladoEnHistorial) {
        return { 
            tipo: 'REPETIDO', 
            mensaje: `El Traslado ${trasladoStr} ya existe en el historial (Cabecera o Anexos) de esta OP`, 
            esParcial: false, 
            sufijo: loteStr,
            rechazar: true
        };
    }

    // 3. PASO A: VALIDAR DIFERENCIA DEL JSON ORIGINAL
    // Si la diferencia original fue 0, no hay saldo pendiente que reclamar.
    const diferenciaOriginal = Math.round(parseFloat(registroOriginal.DIFERENCIA)) || 0;
    if (diferenciaOriginal === 0) {
        return { 
            tipo: 'REPETIDO', 
            mensaje: `Lote ${loteStr} ya está completo (Diferencia Original = 0)`, 
            esParcial: false, 
            sufijo: loteStr,
            rechazar: true
        };
    }

    // 4. PASO B: VALIDAR SUMATORIA ACUMULADA VS CANTIDAD MÁXIMA
    // Usamos Math.round(parseFloat()) para manejar con seguridad el formato "7.00" del CSV
    const cantidadMaxima = Math.round(parseFloat(registroOriginal.CANTIDAD)) || 0;
    const sumaTotalesGenerales = registrosExistentes.reduce((acc, reg) => acc + (Math.round(parseFloat(reg.TOTAL_GENERAL)) || 0), 0);

    if (sumaTotalesGenerales === cantidadMaxima) {
        return { 
            tipo: 'REPETIDO', 
            mensaje: `Lote ${loteStr} ya alcanzó su tope máximo (${sumaTotalesGenerales}/${cantidadMaxima})`, 
            esParcial: false, 
            sufijo: loteStr,
            rechazar: true
        };
    }

    // 5. PASO C: VALIDAR SALDO RESTANTE VS CANTIDAD CSV (ÍNDICE 9)
    const saldoRestante = cantidadMaxima - sumaTotalesGenerales;
    const cantidadCSV = Math.round(parseFloat(cantidad)) || 0;

    if (cantidadCSV <= saldoRestante) {
        const numeroParcial = registrosExistentes.length + 1;
        return {
            tipo: 'PARCIAL',
            mensaje: `Parcial ${numeroParcial} (${cantidadCSV} ingresan / ${saldoRestante} saldo)`,
            esParcial: true,
            sufijo: `${loteStr}.${numeroParcial}`,
            saldoDisponible: saldoRestante,
            saldoRestante: saldoRestante - cantidadCSV
        };
    }

    // 6. RECHAZO: SUPERA EL SALDO RESTANTE
    return {
        tipo: 'RECHAZADO',
        mensaje: `Cantidad ${cantidadCSV} supera el saldo real disponible ${saldoRestante}`,
        esParcial: false,
        sufijo: loteStr,
        rechazar: true
    };
}

/**
 * Convierte fecha DD/MM/YYYY a timestamp para ordenamiento
 */
function parseFechaToTimestamp(fechaStr) {
    if (!fechaStr) return 0;
    const parts = fechaStr.split('/');
    if (parts.length !== 3) return 0;
    const [dia, mes, anio] = parts;
    return new Date(anio, mes - 1, dia).getTime();
}
