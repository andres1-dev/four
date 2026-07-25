/**
 * js/modules/excel-processor.js
 * Procesador de archivos Excel (GLOBAL / BUSINT format)
 * 
 * Flujo:
 *   Excel (.xlsx/.xls) → normalizeToHR() → resolveGlobalIds() → flattenToItems() → setupPendientesSection()
 * 
 * Las tablas globales (global_talleres, global_lineas, global_auditores, global_usuarios)
 * se cargan desde Supabase igual que los otros mapas al inicio.
 */

// ─── Mapas globales para resolución de IDs ───────────────────────────────────
let globalTalleresMap = new Map();   // id_taller  → taller
let globalLineasMap   = new Map();   // id_linea   → linea
let globalAuditoresMap= new Map();   // id_auditor → auditor
let globalUsuariosMap = new Map();   // id_usuario → usuario (nombre escaner)

let globalMapsLoaded  = false;

// ─── Carga de tablas globales desde Supabase ─────────────────────────────────

async function loadGlobalMaps() {
    if (globalMapsLoaded) return;
    try {
        Logger.info('excel-processor', 'Cargando tablas globales (talleres, líneas, auditores, usuarios)...');
        const startTime = performance.now();

        const [talleres, lineas, auditores, usuarios] = await Promise.all([
            supabase.selectAll('global_talleres',  { }),
            supabase.selectAll('global_lineas',    { }),
            supabase.selectAll('global_auditores', { }),
            supabase.selectAll('global_usuarios',  { })
        ]);

        globalTalleresMap  = new Map((talleres  || []).map(r => [String(r.id_taller),   r.taller]));
        // Normalizar líneas: quitar prefijo "LINEA " y espacios → "LINEA ANGELES" → "ANGELES"
        globalLineasMap    = new Map((lineas    || []).map(r => [String(r.id_linea), _normalizeLinea(r.linea)]));
        globalAuditoresMap = new Map((auditores || []).map(r => [String(r.id_auditor),   r.auditor]));
        globalUsuariosMap  = new Map((usuarios  || []).map(r => [String(r.id_usuario),   r.usuario]));

        globalMapsLoaded = true;
        const ms = (performance.now() - startTime).toFixed(0);
        Logger.success('excel-processor',
            `Tablas globales cargadas en ${ms}ms — Talleres:${globalTalleresMap.size} Líneas:${globalLineasMap.size} Auditores:${globalAuditoresMap.size} Usuarios:${globalUsuariosMap.size}`
        );
    } catch (err) {
        Logger.error('excel-processor', 'Error cargando tablas globales', err);
        throw err;
    }
}

// ─── Helpers de normalización ─────────────────────────────────────────────────

/**
 * Normaliza el nombre de línea: quita prefijo "LINEA " y une el resto sin espacios
 * "LINEA ANGELES"     → "ANGELES"
 * "LINEA MODA FRESCA" → "MODAFRESCA"
 * "ANGELES"           → "ANGELES" (ya normalizado)
 */
function _normalizeLinea(raw) {
    if (!raw) return '';
    return raw.toString().toUpperCase().trim()
        .replace(/^LINEA\s+/i, '')  // quitar prefijo LINEA
        .replace(/\s+/g, '');       // unir palabras restantes sin espacios
}

function _normalizeDate(dateStr) {
    if (!dateStr) return '';
    if (dateStr instanceof Date) {
        // ISO → DD/MM/YYYY
        const d = dateStr;
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }
    const str = String(dateStr).trim().split('T')[0].split(' ')[0];
    if (!str || str.length < 8) return '';
    // Si ya es DD/MM/YYYY
    if (str.includes('/')) return str;
    // YYYY-MM-DD → DD/MM/YYYY
    const [y, m, d] = str.split('-');
    if (y && m && d) return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
    return str;
}

function _extractRefprov(desc) {
    if (!desc) return '';
    const match = String(desc).trim().match(/(\d+)\s*$/);
    return match ? match[1] : '';
}

// ─── normalizeToHR: igual que MIGRACION/GLOBAL/index.html ────────────────────

function _normalizeToHR(rows) {
    // Solo IND_ESTADO = 1
    const valid = rows.filter(r => String(r.IND_ESTADO || '').trim() === '1');

    const groups = new Map();
    valid.forEach(row => {
        const key = String(row.NUMDOC || '').trim();
        if (!key) return;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    });

    const results = [];
    groups.forEach((items, numdoc) => {
        const first = items[0];

        const uniqueRefs = new Set(items.map(i => String(i.REFERENCIA || '').trim()));
        const isRefVar   = uniqueRefs.size > 1;

        const totalCantidad = items.reduce((s, i) => s + (parseInt(i.CANTIDAD) || 0), 0);

        // Construir HR por barra/talla/color
        const hrMap = {};
        items.forEach(item => {
            const barra   = String(item.CODBARRAS  || '').trim();
            const talla   = String(item.TALLA       || '').trim();
            const color   = String(item.COLOR       || '').trim();
            const cant    = parseInt(item.CANTIDAD)  || 0;
            const itemRef = String(item.REFERENCIA  || '').trim();
            const itemDesc= String(item.DESCRIPCION || '').trim();
            const itemRefp= _extractRefprov(itemDesc);

            if (barra && talla && color) {
                const k = `${barra}_${talla}_${color}`;
                if (!hrMap[k]) {
                    const e = { talla, color, barra, cantidad: 0 };
                    if (isRefVar) { e.refprov = itemRefp; e.referencia = itemRef; e.descripcion = itemDesc; }
                    hrMap[k] = e;
                }
                hrMap[k].cantidad += cant;
            }
        });

        let descripcion, refprov, referencia;
        if (isRefVar) {
            descripcion = 'PRENDAS VARIAS CHICA CHIC';
            refprov     = 'REFVAR';
            referencia  = 'REFVAR';
        } else {
            descripcion = String(first.DESCRIPCION || '').trim();
            refprov     = _extractRefprov(first.DESCRIPCION) || String(first.REFERENCIA_PROV || '').trim();
            referencia  = String(first.REFERENCIA || '').trim();
        }

        results.push({
            id_ingreso: numdoc,
            lote:       String(parseInt(first.LOTE) || parseInt(numdoc) || numdoc),
            fecha:      _normalizeDate(first.FECHA),
            id_taller:  String(first.ID_TALLER          || '').trim(),
            id_linea:   String(first.ID_LINEA            || '').trim(),
            id_auditor: String(first.ID_USUARIO_AUDITOR  || '').trim(),
            id_usuario: String(first.ID_USUARIO          || '').trim(),
            refprov,
            referencia,
            descripcion,
            total:       totalCantidad,
            tipo:        isRefVar ? 'REFVAR' : 'FULL',
            hr:          Object.values(hrMap),
            fuente:      'GLOBAL'
        });
    });

    return results;
}

// ─── Resolver IDs → nombres ───────────────────────────────────────────────────

function _resolveRecord(rec) {
    const tallerNombre  = globalTalleresMap.get(rec.id_taller)  || '';
    const lineaNombre   = globalLineasMap.get(rec.id_linea)     || '';
    const auditorNombre = globalAuditoresMap.get(rec.id_auditor) || '';
    const usuarioNombre = globalUsuariosMap.get(rec.id_usuario)  || '';

    return {
        ...rec,
        TALLER:  tallerNombre  || rec.id_taller  || '',
        LINEA:   lineaNombre   || rec.id_linea   || '',
        // Si el nombre del auditor está vacío en global_auditores → dejar vacío (no pasar el ID)
        AUDITOR: auditorNombre,
        // Si el nombre del usuario está vacío en global_usuarios → dejar vacío
        USUARIO: usuarioNombre
    };
}

// ─── Convertir registro HR → items planos para setupPendientesSection ─────────
/**
 * Cada fila del HR se convierte en un item compatible con processCSVData output.
 * Campos que no aplican al Excel se dejan vacíos / con defaults.
 */
function _hrRecordToItems(rec) {
    const { prenda, genero } = extractPrendaGeneroFromDescripcion(rec.descripcion || '');
    const marca  = getMarca(genero);
    const pvp    = getPvp(rec.refprov || '');
    const clase  = getClaseByPVP(pvp);
    const descripcionFinal = getDescripcion(prenda, genero, marca, rec.refprov || '');

    // Validar estado contra data2Map (igual que CSV)
    const estado = validarEstado(rec.lote, rec.fecha, String(rec.total));

    // Validar parciales
    const validacionParcial = validarEstadoParcial(rec.lote, '', String(rec.total), rec.total);
    if (validacionParcial.rechazar) {
        Logger.warn('excel-processor', `OP ${rec.lote} rechazada: ${validacionParcial.mensaje}`);
        return [];
    }

    const opSufijo = validacionParcial.sufijo || rec.lote;
    const esParcial= validacionParcial.esParcial || false;

    // Una fila por entry en hr[]
    return rec.hr.map(hrRow => ({
        REFERENCIA:          rec.refprov        || '',   // refprov del proveedor
        REFERENCIA_HISTORICA: rec.referencia    || '',   // referencia histórica ya resuelta (ej: "15267-M6")
        USUARIO:             rec.USUARIO        || '',
        OP:                  rec.lote,           // Número de OP (lote)
        ID_INGRESO:          rec.id_ingreso,     // NUMDOC original (ej: "REC12345") para el save
        OP_SUFIJO:           opSufijo,
        ES_PARCIAL:          esParcial,
        TIPO_VALIDACION:     validacionParcial.tipo,
        MENSAJE_VALIDACION:  validacionParcial.mensaje,
        TIPO:                rec.tipo           || 'FULL',
        FECHA:               rec.fecha          || '',
        TRASLADO:            '',
        CANTIDAD:            hrRow.cantidad      || 0,
        COSTO:               '0',
        TOTAL:               String(rec.total),
        PVP:                 pvp,
        TALLA:               hrRow.talla         || '',
        COLORES:             hrRow.color         || '',
        COD_COLOR:           hrRow.barra         || '',   // barra = código de color en Excel
        OS:                  '',
        BODEGA:              'PRIMERAS',
        TALLER:              rec.TALLER          || '',
        DESCRIPCION_LARGA:   rec.descripcion     || '',
        PRENDA:              prenda,
        LINEA:               rec.LINEA           || '',
        GENERO:              genero,
        CC:                  '',
        ESTADO:              estado,
        MARCA:               marca,
        CLASE:               clase,
        DESCRIPCION:         descripcionFinal,
        AUDITOR:             rec.AUDITOR      || '',   // Campo extra para editor
        FUENTE:              'BUSINT'
    }));
}

// ─── Función principal: procesar archivo Excel ────────────────────────────────

async function processExcel(file) {
    const processBtn = document.getElementById('processBtn');
    const loading = showQuickLoading('Procesando archivo Excel...');

    if (processBtn) {
        processBtn.disabled = true;
        processBtn.innerHTML = '<span class="loading-spinner"></span> Procesando...';
    }

    updateStatus('Procesando archivo Excel...', 'loading');

    try {
        // Resetear UI (igual que processCSV)
        setCurrentOPData(null);
        const ids = ['exportBtn','pendientesSection'];
        ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
        const oec = document.getElementById('opEditorContainer');
        const oes = document.getElementById('opEditorEmptyState');
        if (oec) oec.style.display = 'none';
        if (oes) oes.style.display = 'block';

        // 1. Cargar tablas globales si no están cargadas
        await loadGlobalMaps();

        // 2. Leer Excel con XLSX
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws);

        if (!rawRows || rawRows.length === 0) {
            throw new Error('El archivo Excel está vacío o sin datos válidos');
        }

        Logger.info('excel-processor', `Excel leído: ${rawRows.length} filas brutas`);

        // 3. Normalizar a formato HR
        const hrRecords = _normalizeToHR(rawRows);
        Logger.info('excel-processor', `Normalizados: ${hrRecords.length} registros HR`);

        // Pre-paso: cargar data2 y sispro bajo demanda con los lotes del Excel
        if (hrRecords.length > 0) {
            const lotesEnExcel = [...new Set(hrRecords.map(r => String(r.lote || '').trim()).filter(Boolean))];
            if (lotesEnExcel.length > 0) {
                await Promise.all([
                    loadData2Data(lotesEnExcel).catch(err => Logger.warn('excel-processor', 'Error cargando data2', err)),
                    loadSisproData(lotesEnExcel).catch(err => Logger.warn('excel-processor', 'Error cargando sispro', err))
                ]);
                Logger.info('excel-processor', `Datos bajo demanda cargados para ${lotesEnExcel.length} lotes del Excel`);
            }
        }

        // 4. Resolver IDs → nombres
        const resolved = hrRecords.map(_resolveRecord);

        // 5. Convertir a items planos
        const allItems = [];
        resolved.forEach(rec => {
            const items = _hrRecordToItems(rec);
            allItems.push(...items);
        });

        if (allItems.length === 0) {
            throw new Error('No se encontraron registros válidos en el Excel (verifica IND_ESTADO=1)');
        }

        // 6. Guardar como processedData (igual que CSV)
        setProcessedData(allItems);
        displayResultsSummary(allItems);

        // 7. Filtrar pendientes y mostrar en selectOP
        const pendientes = allItems.filter(item => item.ESTADO === 'PENDIENTE' || item.ES_PARCIAL);
        const pendientesSection = document.getElementById('pendientesSection');

        if (pendientes.length > 0) {
            setupPendientesSection(pendientes);
            if (pendientesSection) pendientesSection.style.display = 'block';
            const emptyState = document.getElementById('pendingOpsEmptyState');
            if (emptyState) emptyState.style.display = 'none';
            switchToPendingOpsTab();
            showMessage(`Excel procesado — ${pendientes.length} registros pendientes de ${hrRecords.length} OPs`, 'success', 3000);
        } else {
            if (pendientesSection) pendientesSection.style.display = 'none';
            const emptyState = document.getElementById('pendingOpsEmptyState');
            if (emptyState) emptyState.style.display = 'flex';
            showMessage(`Excel procesado — Todas las OPs ya están confirmadas (${hrRecords.length} OPs)`, 'info', 3000);
        }

        updateStatus(`Excel: ${pendientes.length} pendientes / ${hrRecords.length} OPs`, 'success');

    } catch (error) {
        console.error('Error procesando Excel:', error);
        showMessage('Error procesando Excel: ' + error.message, 'error', 4000);
        updateStatus('Error procesando Excel', 'error');
    } finally {
        loading.close();
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.innerHTML = '<i class="codicon codicon-play"></i> Procesar CSV';
        }
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
window.processExcel    = processExcel;
window.loadGlobalMaps  = loadGlobalMaps;
