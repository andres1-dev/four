// ─── LÓGICA DE EXTRACCIÓN (idéntica a helpers.js) ────────────

function normalizarSingular(p) {
  if (!p) return p;
  if (p.endsWith('ES')) {
    if (p === 'PANTALONES') return 'PANTALON';
    if (!['LEGGINS','LEGGIN'].includes(p)) return p.slice(0, -2);
  } else if (p.endsWith('S') && !['LEGGINS','LEGGIN'].includes(p)) {
    return p.slice(0, -1);
  }
  return p;
}

function extractPrendaGenero(descripcionLarga) {
  if (!descripcionLarga) return { prenda: '', genero: '' };
  const texto = descripcionLarga.toUpperCase().trim().replace(/^[^A-ZÁÉÍÓÚÑ]+/, '');
  const palabras = texto.split(/\s+/);
  if (!palabras.length) return { prenda: '', genero: '' };

  // ── Regla especial: cualquier combinación de VARIAS + PROMO/PROMOCION ──
  // Ej: "PRENDAS VARIAS PROMOCION", "PROMOCION VARIAS", "PROMO VARIAS", etc.
  if (/VARIAS/.test(texto) && /PROMO/.test(texto)) {
    return { prenda: 'VARIAS', genero: 'DAMA' };
  }


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
    // ── Capri (CAPRY también mapea a CAPRI) ──────────────────────────
    'CAPRY':'CAPRI',
    // ── Conjunto ─────────────────────────────────────────────
    'CONJUTO':'CONJUNTO','COJUNTO':'CONJUNTO','CONJ':'CONJUNTO','CONJUN':'CONJUNTO',
    // ── CropTop ──────────────────────────────────────────────
    'CRO':'CROPTOP','CROP':'CROPTOP','CROT':'CROPTOP',
    // ── Enterizo ─────────────────────────────────────────────
    'ENTERICO':'ENTERIZO','ENTERRIZO':'ENTERIZO','ENTRERIZO':'ENTERIZO','ENERIZO':'ENTERIZO','ENTERIZA':'ENTERIZO',
    // ── Falda / Jardinera ────────────────────────────────────
    'OVEROL':'JARDINERA','BRAGA':'JARDINERA','FALDASHORT':'FALDA',
    // ── Jean ─────────────────────────────────────────────────
    'EAN':'JEAN',
    // ── Jort ─────────────────────────────────────────────────
    'MOCHO':'JORT',
    // ── Lycra / Leggins ──────────────────────────────────────
    'LEGGUIS':'LYCRA','LEGGINS':'LYCRA','LEGGING':'LYCRA','LEGGI':'LYCRA','LEGGIS':'LYCRA',
    'LICRA':'LYCRA',
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
  const w = palabras.map(p => CORRECCIONES[p] || p);

  let prenda = '';
  if (w[0]==='SALIDA' && w[1]==='DE' && (w[2]==='BAÑO'||w[2]==='BANO'))      prenda='SALIDA DE BAÑO';
  else if (w[0]==='SALIDA' && (w[1]==='BAÑO'||w[1]==='BANO'))                prenda='SALIDA DE BAÑO';
  else if (w[0]==='PACK' && w[1]==='X' && w[2])                              prenda=`PACK X ${w[2]}`;
  else if (w[0]==='PACK' && /^X\d+$/i.test(w[1] || ''))                      prenda=`PACK ${w[1].toUpperCase()}`;
  else if (w[0]==='DUO') { const i=w[1]==='DE'?2:1; prenda=w[i]?`DUO ${w[i]}`:'DUO'; }
  else if (w.indexOf('DUO')===1) prenda=`DUO ${normalizarSingular(CORRECCIONES[w[0]]||w[0])}`;
  else if (w[0]==='TRIO') { const i=w[1]==='DE'?2:1; prenda=w[i]?`TRIO ${w[i]}`:'TRIO'; }
  else if (w.indexOf('TRIO')===1) prenda=`TRIO ${normalizarSingular(CORRECCIONES[w[0]]||w[0])}`;
  if (!prenda) prenda = normalizarSingular(w[0]);

  let genero = '';
  for (let i=1;i<w.length;i++) { if (GENEROS_VALIDOS.includes(w[i])) { genero=w[i]; break; } }

  if (['DAMA','MUJER','FEMENINO'].includes(genero))             genero='DAMA';
  else if (['HOMBRE','MASCULINO','CABALLERO'].includes(genero)) genero='HOMBRE';
  else if (['UNISEX','MIXTO'].includes(genero))                 genero='UNISEX';
  else if (genero==='INFANTIL')                                 genero='';

  if (!genero) {
    const base = prenda.replace(/^(DUO|TRIO)\s+/,'').replace(/\s+(DUO|TRIO)$/,'').trim();
    const DAMA   = ['BLUSA','VESTIDO','FALDA','CROPTOP','BODY','ENTERIZO','BRASSIER','TOP','LYCRA','TANGA','CACHETERO','BUSO','JARDINERA','SALIDA DE BAÑO','PIJAMA','CONJUNTO','SHORT','SUDADERA','PANTALON','JEAN','PANTALONETA','BERMUDA','JORT','BATOLA','CAMISERA','CAMISILLA','CAPRI','CARGO','CHALECO','CHAQUETA','CORSET','JOGGER','LEVANTADORA','POLO','SOBRETODO','BLAZER','TORERO'];
    const HOMBRE = ['CAMISETA','CAMISA','BOXER'];
    const UNISEX = ['COBIJA'];
    if (DAMA.includes(base))        genero='DAMA';
    else if (HOMBRE.includes(base)) genero='HOMBRE';
    else if (UNISEX.includes(base)) genero='UNISEX';
    else if (base.startsWith('PACK')) {
      for (let i=0;i<w.length;i++) { if (GENEROS_VALIDOS.includes(w[i])) { genero=w[i]; break; } }
    }
  }
  return { prenda, genero };
}

function getMarca(genero) {
  const g = (genero||'').toUpperCase().trim();
  if (g==='DAMA'||g==='NIÑA'||g==='UNISEX') return 'CHICA CHIC';
  if (g==='HOMBRE'||g==='NIÑO')             return '80 GRADOS';
  return 'NEBRASK';
}

function buildDescripcion(prenda, genero, marca, refprov) {
  return [prenda, genero, marca, refprov].filter(Boolean).join(' ');
}

function normalizeGenero(g) {
  const v = (g||'').toUpperCase().trim();
  if (['DAMA','MUJER','FEMENINO'].includes(v))        return 'DAMA';
  if (['HOMBRE','MASCULINO','CABALLERO'].includes(v)) return 'HOMBRE';
  if (v==='NIÑA')   return 'NIÑA';
  if (v==='NIÑO')   return 'NIÑO';
  if (['UNISEX','MIXTO'].includes(v)) return 'UNISEX';
  return '';
}

// ─── PARSEAR HR ──────────────────────────────────────────────
// Formato: CODBARRAS∞COLOR∞TALLA∞CANTIDAD☬CODBARRAS∞COLOR∞TALLA∞CANTIDAD...
// El primer campo es código de barras (no código de color)
// El objeto resultante sigue la misma estructura que ingresos:
//   { codigo_color, color, talla, cantidad }
// Para BUSINT no hay código de color separado, se deja vacío
// y se usa el código de barras como referencia
function parseHR(raw) {
  if (!raw) return [];
  return raw.split('☬')
    .map(fila => {
      const parts = fila.split('∞');
      const codigo_color = (parts[0] || '').trim(); // código de barras EAN
      const color        = (parts[1] || '').trim();
      const talla        = (parts[2] || '').trim();
      const cantidad     = parseInt(parts[3] || 0) || 0;
      if (!codigo_color && !color) return null;
      return { codigo_color, color, talla, cantidad };
    })
    .filter(Boolean);
}

// ─── CONSTRUIR ANEXOS BUSINT ──────────────────────────────────
// Solo se incluye el anexo si la cantidad > 0
// Estructura compatible con la BD: DOCUMENTO, TIPO, CANTIDAD, observacion
// TIPOS: IMPERFECTA | COBRO | PENDIENTE | OTROS (exclusivo BUSINT)
function buildAnexos(row, refprov) {
  const defs = [
    { idxCant: IDX.cant_imperfecta, idxObs: IDX.obs_imperfecta, tipo: 'IMPERFECTA' },
    { idxCant: IDX.cant_cobro,      idxObs: IDX.obs_cobro,      tipo: 'COBRO'      },
    { idxCant: IDX.cant_otros,      idxObs: IDX.obs_otros,      tipo: 'OTROS'      },
  ];

  const anexos = [];
  defs.forEach(({ idxCant, idxObs, tipo }) => {
    const cantidad = parseInt(row[idxCant] || 0) || 0;
    if (cantidad <= 0) return;
    const observacion = (row[idxObs] || '').toString().trim();
    anexos.push({
      DOCUMENTO:    refprov,
      TIPO:         tipo,
      CANTIDAD:     cantidad,
      OBSERVACION:  observacion,
      // Campos requeridos por la estructura BD (vacíos para BUSINT)
      TALLA:           '',
      COLOR:           '',
      COSTO_UNITARIO:  0,
      COSTO_TOTAL:     0,
      BODEGA:          tipo,
      TRASLADO:        ''
    });
  });
  return anexos;
}
// ─── FECHA INGRESO (fecha traslado + hora actual Bogotá) ─────
// Igual que buildFechaIngreso en preview.html
function buildFechaIngreso(fechaISO) {
  if (!fechaISO) return '';
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota', hour12: false,
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const parts = formatter.formatToParts(now);
  const get   = t => parts.find(p => p.type === t)?.value;
  const ms    = String(now.getMilliseconds()).padStart(3, '0');
  return `${fechaISO} ${get('hour')}:${get('minute')}:${get('second')}.${ms}-05`;
}

// ─── NORMALIZAR LÍNEA ─────────────────────────────────────────
// Quita el prefijo "LINEA " y une las palabras restantes sin espacios
// "LINEA ANGELES"     → "ANGELES"
// "LINEA MODA FRESCA" → "MODAFRESCA"
function normalizeLinea(raw) {
  if (!raw) return '';
  return raw.toUpperCase().trim()
    .replace(/^LINEA\s+/i, '')  // quitar prefijo LINEA
    .replace(/\s+/g, '');       // unir palabras restantes
}

// ─── CALCULAR TOTAL DESDE HR ──────────────────────────────────
// Suma las cantidades de todos los items del HR
// (igual que calculateTotal en preview.html pero sin PROMO porque
//  en BUSINT los anexos no suman al total principal)
function calcTotalFromHR(hr) {
  return hr.reduce((acc, item) => acc + (parseInt(item.cantidad) || 0), 0);
}

function getClaseByPVP(pvp) {
  const v = parseFloat(pvp);
  if (isNaN(v) || v <= 0) return '';
  if (v <= 39900) return 'LINEA';
  if (v <= 59900) return 'MODA';
  return 'PRONTAMODA';
}

// ─── TRANSFORMAR FILA DE SHEETS → RECORD ─────────────────────
function transformRow(row) {
  const idRaw     = (row[IDX.id_ingreso] || '').toString().replace(/^REC/i, '').trim();
  const descLarga = (row[IDX.descripcion_larga] || '').trim();
  const refprov   = (row[IDX.refprov] || '').trim();

  const { prenda, genero } = extractPrendaGenero(descLarga);
  const marca       = getMarca(genero);
  const descripcion = buildDescripcion(prenda, genero, marca, refprov);

  const hrRaw = IDX.hr !== null ? (row[IDX.hr] || '') : '';
  const hr    = parseHR(hrRaw);

  // Anexos BUSINT (imperfectas, cobros, pendientes, otros)
  const anexos = buildAnexos(row, refprov);

  // PVP y clase
  const pvpRaw = (row[IDX.pvp] || '').toString().replace(/[^\d]/g, '');
  const pvp    = parseInt(pvpRaw) || 0;
  const clase  = getClaseByPVP(pvp);

  // tipo — normalizar a mayúsculas para el merge
  const tipo = (row[IDX.tipo] || '').toString().trim().toUpperCase() || 'FULL';

  // detalle_cantidades
  let detalle = {};
  try { detalle = JSON.parse(row[IDX.detalle_cantidades] || '{}'); } catch(e) {}

  const cantidad = parseInt(row[IDX.cantidad] || 0) || 0;

  // fecha_traslado (solo fecha) y fecha_ingreso (fecha + hora Bogotá)
  const fecha_traslado = formatDateBusint(row[IDX.fecha] || '');
  const fecha_ingreso  = buildFechaIngreso(fecha_traslado);

  // linea normalizada
  const linea = normalizeLinea(row[IDX.linea] || '');

  // proveedor según línea
  const proveedor = linea === 'ANGELES'
    ? 'TEXTILES Y CREACIONES LOS ANGELES SAS'
    : 'TEXTILES Y CREACIONES EL UNIVERSO SAS';

  // gestor según línea
  let gestorFinal = "KELLY GIOVANA ZULUAGA HOYOS";
  if (linea === 'ANGELES') {
    gestorFinal = "LUIS VILLAMIZAR GOMEZ";
  } else if (linea === 'ESPECIALES' || linea === 'BOGOTA') {
    gestorFinal = "JUAN ESTEBAN ZULUAGA HOYOS";
  }

  // total = suma del HR
  const total = calcTotalFromHR(hr);

  return {
    // ── Campos para la tabla de validación ──
    A:                   idRaw,
    LOTE:                (row[IDX.lote] || '').toString().trim(),
    REFPROV:             refprov,
    'DESCRIPCIÓN_LARGA': descLarga,
    GENERO:              normalizeGenero(row[IDX.genero] || ''),
    // Calculados (usados en calcRow)
    prenda, genero, marca, descripcion,

    // ── Campos para CSV / Supabase ──
    id_ingreso:          idRaw,
    fecha_ingreso:       fecha_ingreso,
    fecha_traslado:      fecha_traslado,
    taller:              (row[IDX.taller] || '').trim(),
    gestor:              gestorFinal,
    linea,
    auditor:             (row[IDX.auditor] || '').trim(),
    escaner:             (row[IDX.escaner] || '').trim(),
    lote:                parseInt(row[IDX.lote] || 0) || 0,
    refprov,
    descripcion_larga:   descLarga,
    descripcion,
    cantidad,
    tipo,
    pvp,
    clase,
    prenda,
    genero,
    marca,
    hr:                  JSON.stringify(hr),
    detalle_cantidades:  JSON.stringify(detalle),
    fuente:              'BUSINT',
    productora:          PRODUCTORA,

    // Campos sin índice confirmado → vacío / cero
    proveedor,
    bolsas:          parseInt(row[IDX.bolsas] || 0) || 0,
    otros_traslados: '[]',
    anexos:          JSON.stringify(anexos),
    total_relativo:  cantidad,
    total_general:   cantidad,
    total,
    diferencia:      0,
    costo_unitario:  0,
    costo_total:     0,
    auditoria:       0,
    orden_servicio:  0,
    traslado:        0,
    referencia:      (row[IDX.referencia] || '').trim(),
  };
}

function formatDateBusint(v) {
  if (!v) return '';
  if (v.includes('T')) return v.split('T')[0];
  if (v.includes('/')) {
    const [d,m,y] = v.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return v.split(' ')[0] || v;
}
