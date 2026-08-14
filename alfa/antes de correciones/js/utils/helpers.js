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
    // Normalizar cantidad a entero-string para comparar con el total guardado en Supabase
    // El CSV puede traer "7.00" y Supabase guarda 7 → ambos deben quedar "7"
    const cantidadNorm = (() => {
        const n = Math.round(parseFloat(cantidad));
        return isNaN(n) ? (cantidad || '').toString().trim() : n.toString();
    })();
    const clave = `${op.trim()}|${normalizeFecha(fecha || '')}|${cantidadNorm}`;
    // Leer siempre de window.data2Map para tener el mapa más reciente
    const mapa = window.data2Map || data2Map;
    return mapa.has(clave) ? 'CONFIRMADA' : 'PENDIENTE';
}

// ============================================
// CONSULTAS A MAPAS
// ============================================

function getRepresentativeItem(items) {
    if (!items || items.length === 0) return null;
    const itemPrimeras = items.find(item => item.BODEGA === 'PRIMERAS');
    return itemPrimeras || items[0];
}

/**
 * Extrae PRENDA y GÉNERO de la descripción larga
 * Incluye correcciones ortográficas, casos compuestos (DUO/TRIO/SALIDA DE BAÑO/CROP TOP)
 * e inferencia de género por tipo de prenda.
 */
function extractPrendaGeneroFromDescripcion(descripcionLarga) {
    if (!descripcionLarga || typeof descripcionLarga !== 'string') {
        return { prenda: '', genero: '' };
    }

    // Limpiar caracteres no alfabéticos al inicio (ej: "- BOXER" → "BOXER")
    const texto    = descripcionLarga.toUpperCase().trim().replace(/^[^A-ZÁÉÍÓÚÑ]+/, '');
    const palabras = texto.split(/\s+/);
    if (!palabras.length) return { prenda: '', genero: '' };

    // ── Regla especial: cualquier combinación de VARIAS + PROMO/PROMOCION ──
    // Ej: "PRENDAS VARIAS PROMOCION", "PROMOCION VARIAS", "PROMO VARIAS", etc.
    if (/VARIAS/.test(texto) && /PROMO/.test(texto)) {
        return { prenda: 'VARIAS', genero: 'DAMA' };
    }

    // ── CORRECCIONES ORTOGRÁFICAS (Completas de migración) ──
    const CORRECCIONES = {
        // ── Blusa / Blazer ───────────────────────────────────────
        'BUSA':'BLUSA','BLUSAS':'BLUSA','BLUSON':'BLUSA',
        'BLUDA':'BLUSA','BLUSADE':'BLUSA','BLUSAM/SISA':'BLUSA','BLUSAMAN/CTA':'BLUSA',
        'BLEIZER':'BLAZER',
        // ── Body ─────────────────────────────────────────────────
        'BOBY':'BODY',
        // ── Buso / Buzo ──────────────────────────────────────────
        'BUZO':'BUSO',
        // ── Chaleco ──────────────────────────────────────────────
        'CALECO':'CHALECO','SOBRETOD':'SOBRETODO',
        // ── Camiseta ─────────────────────────────────────────────
        'CAMISETA,':'CAMISETA','CAMISTEA':'CAMISETA',
        // ── Capri (CAPRY también mapea a CAPRI) ──────────────────
        'CAPRY':'CAPRI',
        // ── Conjunto ─────────────────────────────────────────────
        'CONJUTO':'CONJUNTO','COJUNTO':'CONJUNTO','CONJ':'CONJUNTO','CONJUN':'CONJUNTO',
        // ── CropTop ──────────────────────────────────────────────
        'CRO':'CROPTOP','CROP':'CROPTOP','CROT':'CROPTOP',
        // ── Enterizo ─────────────────────────────────────────────
        'ENTERICO':'ENTERIZO','ENTERRIZO':'ENTERIZO','ENTRERIZO':'ENTERIZO',
        'ENERIZO':'ENTERIZO','ENTERIZA':'ENTERIZO',
        // ── Falda / Jardinera ────────────────────────────────────
        'OVEROL':'JARDINERA','BRAGA':'JARDINERA','FALDASHORT':'FALDA',
        // ── Jean ─────────────────────────────────────────────────
        'EAN':'JEAN',
        // ── Jort ─────────────────────────────────────────────────
        'MOCHO':'JORT',
        // ── Lycra / Leggins ──────────────────────────────────────
        'LEGGUIS':'LYCRA','LEGGINS':'LYCRA','LEGGING':'LYCRA',
        'LEGGI':'LYCRA','LEGGIS':'LYCRA','LICRA':'LYCRA',
        // ── Pantalon ─────────────────────────────────────────────
        'PANTALO':'PANTALON','PANTALON,':'PANTALON','PANTALONE':'PANTALON',
        'PANTALONELASTICO':'PANTALON','PATALON':'PANTALON',
        // ── Pantaloneta ──────────────────────────────────────────
        'PAATALONETA':'PANTALONETA','PANTALONETA,':'PANTALONETA',
        // ── Short ────────────────────────────────────────────────
        'SHORTH':'SHORT','SHOR':'SHORT','SHOTR':'SHORT',
        // ── Sudadera ─────────────────────────────────────────────
        'SURARERA':'SUDADERA','SUDARERA':'SUDADERA',
        // ── Torero ───────────────────────────────────────────────
        'TORRERO':'TORERO',
        // ── Tropelera ────────────────────────────────────────────
        'TROPELERA':'CAMISILLA',
        // ── Vestido ──────────────────────────────────────────────
        'VESTIDIO':'VESTIDO','VESRTIDO':'VESTIDO',
    };

    const palabrasCorr = palabras.map(p => CORRECCIONES[p] || p);

    // ── CASOS COMPUESTOS ESPECIALES ──
    let prenda = '';

    // SALIDA DE BAÑO (con o sin "DE")
    if (palabrasCorr[0] === 'SALIDA' &&
        palabrasCorr[1] === 'DE' &&
        (palabrasCorr[2] === 'BAÑO' || palabrasCorr[2] === 'BANO')) {
        prenda = 'SALIDA DE BAÑO';
    } else if (palabrasCorr[0] === 'SALIDA' &&
        (palabrasCorr[1] === 'BAÑO' || palabrasCorr[1] === 'BANO')) {
        prenda = 'SALIDA DE BAÑO';
    }
    // PACK X <N>
    else if (palabrasCorr[0] === 'PACK' && palabrasCorr[1] === 'X' && palabrasCorr[2]) {
        prenda = `PACK X ${palabrasCorr[2]}`;
    }
    // PACK X<N> (sin espacio, ej: "PACK X5")
    else if (palabrasCorr[0] === 'PACK' && /^X\d+$/i.test(palabrasCorr[1] || '')) {
        prenda = `PACK ${palabrasCorr[1].toUpperCase()}`;
    }
    // DUO: siempre "DUO <PRENDA>"
    else if (palabrasCorr[0] === 'DUO') {
        const p2idx = palabrasCorr[1] === 'DE' ? 2 : 1;
        prenda = palabrasCorr[p2idx] ? `DUO ${palabrasCorr[p2idx]}` : 'DUO';
    } else if (palabrasCorr.indexOf('DUO') === 1) {
        let p1 = normalizarSingularHelper(CORRECCIONES[palabrasCorr[0]] || palabrasCorr[0]);
        prenda = `DUO ${p1}`;
    }
    // TRIO: siempre "TRIO <PRENDA>"
    else if (palabrasCorr[0] === 'TRIO') {
        const p2idx = palabrasCorr[1] === 'DE' ? 2 : 1;
        prenda = palabrasCorr[p2idx] ? `TRIO ${palabrasCorr[p2idx]}` : 'TRIO';
    } else if (palabrasCorr.indexOf('TRIO') === 1) {
        let p1 = normalizarSingularHelper(CORRECCIONES[palabrasCorr[0]] || palabrasCorr[0]);
        prenda = `TRIO ${p1}`;
    }

    // Caso normal: primera palabra normalizada
    if (!prenda) {
        prenda = normalizarSingularHelper(palabrasCorr[0]);
    }

    // ── GÉNERO: buscar en todas las palabras ──
    const GENEROS_VALIDOS = ['DAMA','MUJER','FEMENINO','HOMBRE','MASCULINO','CABALLERO','NIÑO','NIÑA','INFANTIL','UNISEX','MIXTO'];
    let genero = '';
    for (let i = 1; i < palabrasCorr.length; i++) {
        if (GENEROS_VALIDOS.includes(palabrasCorr[i])) { genero = palabrasCorr[i]; break; }
    }

    // Normalizar género explícito
    if (['DAMA','MUJER','FEMENINO'].includes(genero))             genero = 'DAMA';
    else if (['HOMBRE','MASCULINO','CABALLERO'].includes(genero)) genero = 'HOMBRE';
    else if (['UNISEX','MIXTO'].includes(genero))                 genero = 'UNISEX';
    else if (genero === 'INFANTIL')                               genero = '';

    // ── Inferir género por prenda base (sin DUO/TRIO) ──
    if (!genero) {
        const prendaBase = prenda
            .replace(/^(DUO|TRIO)\s+/, '')
            .replace(/\s+(DUO|TRIO)$/, '')
            .trim();

        const PRENDAS_DAMA = [
            'BLUSA','VESTIDO','FALDA','CROPTOP','BODY','ENTERIZO',
            'BRASSIER','TOP','LYCRA','TANGA','CACHETERO','BUSO',
            'JARDINERA','SALIDA DE BAÑO','PIJAMA','CONJUNTO','SHORT',
            'SUDADERA','PANTALON','JEAN','PANTALONETA','BERMUDA','JORT',
            'BATOLA','CAMISERA','CAMISILLA','CAPRI','CARGO','CHALECO',
            'CHAQUETA','CORSET','JOGGER','LEVANTADORA','POLO','SOBRETODO',
            'BLAZER','TORERO'
        ];
        const PRENDAS_HOMBRE = ['CAMISETA','CAMISA','BOXER'];
        const PRENDAS_UNISEX = ['COBIJA'];

        if (PRENDAS_DAMA.includes(prendaBase))        genero = 'DAMA';
        else if (PRENDAS_HOMBRE.includes(prendaBase)) genero = 'HOMBRE';
        else if (PRENDAS_UNISEX.includes(prendaBase)) genero = 'UNISEX';
        else if (prendaBase.startsWith('PACK')) {
            // PACK X N → buscar género explícito en la descripción
            for (let i = 0; i < palabrasCorr.length; i++) {
                if (GENEROS_VALIDOS.includes(palabrasCorr[i])) {
                    genero = palabrasCorr[i]; break;
                }
            }
        }
    }

    return { prenda, genero };
}

/** Normaliza plural → singular */
function normalizarSingularHelper(p) {
    if (!p) return p;
    if (p.endsWith('ES')) {
        if (p === 'PANTALONES') return 'PANTALON';
        if (!['LEGGINS','LEGGIN'].includes(p)) return p.slice(0, -2);
    } else if (p.endsWith('S') && !['LEGGINS','LEGGIN'].includes(p)) {
        return p.slice(0, -1);
    }
    return p;
}

/** Normaliza plural → singular (helper interno) */
function normalizarSingularHelper(p) {
    if (!p) return p;
    if (p.endsWith('ES')) {
        if (p === 'PANTALONES') return 'PANTALON';
        if (!['LEGGINS','LEGGIN'].includes(p)) return p.slice(0, -2);
    } else if (p.endsWith('S') && !['LEGGINS','LEGGIN'].includes(p)) {
        return p.slice(0, -1);
    }
    return p;
}

/**
 * Determina la marca según el proveedor activo y el género
 * @param {string} proveedorId - NIT del proveedor activo
 * @param {string} genero - Género del producto (DAMA, HOMBRE, NIÑA, NIÑO)
 * @returns {string} - Marca correspondiente
 */
function getMarcaByProveedorAndGenero(proveedorId, genero) {
    // Normalizar género
    const generoUpper = (genero || '').toUpperCase().trim();
    
    // Proveedor 901920844 → siempre NEBRASK
    if (proveedorId === '901920844') {
        return 'NEBRASK';
    }
    
    // Proveedores 900616124 o 900692469 → depende del género
    if (proveedorId === '900616124' || proveedorId === '900692469') {
        // DAMA o NIÑA → CHICA CHIC
        if (generoUpper === 'DAMA' || generoUpper === 'NIÑA') {
            return 'CHICA CHIC';
        }
        // HOMBRE o NIÑO → 80 GRADOS
        if (generoUpper === 'HOMBRE' || generoUpper === 'NIÑO') {
            return '80 GRADOS';
        }
    }
    
    // Por defecto, retornar NEBRASK
    return 'NEBRASK';
}

function getSisproData(op) {
    // NOTA: Esta función ya no se usa para obtener datos de SISPROWEB
    // Se mantiene por compatibilidad pero retorna valores vacíos
    // Los datos ahora se extraen de la descripción larga
    if (!op) return { PRENDA: '', LINEA: '', GENERO: '', REFERENCIA: '' };
    return sisproMap.get(op.trim()) || { PRENDA: '', LINEA: '', GENERO: '', REFERENCIA: '' };
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

function getMarca(genero, proveedorId = null) {
    // Si no se proporciona proveedorId, obtener el proveedor activo
    if (!proveedorId) {
        const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
        proveedorId = proveedorActivo ? proveedorActivo.id : '901920844'; // Default NEBRASK
    }
    
    return getMarcaByProveedorAndGenero(proveedorId, genero);
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
    
    // 2. TRASLADO EXISTENTE EN CABECERA, OTROS_TRASLADOS O ANEXOS → REPETIDO (Rechazo inmediato)
    const existeTrasladoEnHistorial = registrosExistentes.some(reg => {
        // Revisar encabezado principal
        if ((reg.TRASLADO || '').toString().trim() === trasladoStr) return true;
        
        // Revisar otros traslados adicionales (DI desde traslados secundarios)
        if (reg.OTROS_TRASLADOS && Array.isArray(reg.OTROS_TRASLADOS)) {
            if (reg.OTROS_TRASLADOS.some(t => t.toString().trim() === trasladoStr)) return true;
        }

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
