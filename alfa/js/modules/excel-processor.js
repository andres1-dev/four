/**
 * js/modules/excel-processor.js
 * Procesador de archivos Excel (GLOBAL / BUSINT format)
 *
 * Flujo:
 *   Excel (.xlsx/.xls) → normalizeToHR() → _loadGlobalMapsOnDemand() → resolveGlobalIds() → flattenToItems() → setupPendientesSection()
 *
 * Las tablas globales (global_talleres, global_lineas, global_auditores, global_usuarios)
 * se consultan bajo demanda via EF on-demand-query, usando SOLO los IDs presentes
 * en el archivo que se está procesando. Nunca se descarga la tabla completa.
 */

// ─── Mapas globales para resolución de IDs ───────────────────────────────────
let globalTalleresMap = new Map();   // id_taller  → taller
let globalLineasMap   = new Map();   // id_linea   → linea
let globalAuditoresMap= new Map();   // id_auditor → auditor
let globalUsuariosMap = new Map();   // id_usuario → usuario (nombre escaner)

// globalMapsLoaded ya no aplica (cada carga es on-demand, sin cache entre archivos)

// ─── Carga on-demand de tablas globales (solo los IDs del Excel) ──────────────
/**
 * Extrae los IDs únicos de los registros HR y consulta la EF
 * get_global_maps_by_ids con SOLO esos IDs.
 * Actualiza globalTalleresMap, globalLineasMap, globalAuditoresMap, globalUsuariosMap.
 *
 * @param {Object[]} hrRecords — registros normalizados por _normalizeToHR()
 */
async function _loadGlobalMapsOnDemand(hrRecords) {
    // Extraer IDs únicos presentes en este archivo
    const tallerIds  = [...new Set(hrRecords.map(r => String(r.id_taller  || '').trim()).filter(id => id && id !== '0'))];
    const lineaIds   = [...new Set(hrRecords.map(r => String(r.id_linea   || '').trim()).filter(id => id && id !== '0'))];
    const auditorIds = [...new Set(hrRecords.map(r => String(r.id_auditor || '').trim()).filter(id => id && id !== '0'))];
    const usuarioIds = [...new Set(hrRecords.map(r => String(r.id_usuario || '').trim()).filter(id => id && id !== '0'))];

    Logger.info('excel-processor',
        `Consultando globales on-demand — Plantas:${tallerIds.length} Líneas:${lineaIds.length} Auditores:${auditorIds.length} Usuarios:${usuarioIds.length}`
    );
    const t0 = performance.now();

    const svc = window.OnDemandService;
    if (!svc || typeof svc.getGlobalMaps !== 'function') {
        throw new Error('OnDemandService no disponible. Verifica que on-demand-service.js esté cargado.');
    }

    const maps = await svc.getGlobalMaps({ taller_ids: tallerIds, linea_ids: lineaIds, auditor_ids: auditorIds, usuario_ids: usuarioIds });

    // Reconstruir mapas locales con normalización aplicada
    globalTalleresMap  = new Map([...maps.talleres].map(([k, v])  => [String(k).trim(), (v || '').trim()]));
    // Normalizar líneas: quitar prefijo "LINEA " y espacios → "LINEA ANGELES" → "ANGELES"
    globalLineasMap    = new Map([...maps.lineas].map(([k, v])    => [String(k).trim(), _normalizeLinea(v)]));
    globalAuditoresMap = new Map([...maps.auditores].map(([k, v]) => [String(k).trim(), (v || '').trim()]));
    globalUsuariosMap  = new Map([...maps.usuarios].map(([k, v])  => [String(k).trim(), (v || '').trim()]));

    // Exponer globalmente (para modales que los necesiten)
    window.globalTalleresMap  = globalTalleresMap;
    window.globalLineasMap    = globalLineasMap;
    window.globalAuditoresMap = globalAuditoresMap;
    window.globalUsuariosMap  = globalUsuariosMap;
    if (typeof updateDataStats === 'function') updateDataStats();

    Logger.success('excel-processor',
        `Globales on-demand en ${(performance.now()-t0).toFixed(0)}ms — ` +
        `Plantas:${globalTalleresMap.size} Líneas:${globalLineasMap.size} Auditores:${globalAuditoresMap.size} Usuarios:${globalUsuariosMap.size}`
    );
}

/**
 * Compatibilidad: loadGlobalMaps() se mantiene como alias vacío.
 * Ya no descarga nada — la carga real ocurre en _loadGlobalMapsOnDemand().
 * @deprecated Usar _loadGlobalMapsOnDemand(hrRecords) en su lugar.
 */
async function loadGlobalMaps(forceReload = false) {
    // No-op intencional: los mapas se pueblan on-demand por archivo en processExcel().
    // Se conserva para no romper referencias externas (talleres-modal.js, etc.).
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
        const uniqueRefp = new Set(items.map(i => _extractRefprov(i.DESCRIPCION) || String(i.REFERENCIA_PROV || '').trim()));
        const isRefVar   = uniqueRefs.size > 1 || uniqueRefp.size > 1;

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
                    const e = { talla, color, codigo_color: barra, cantidad: 0 };
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

        // Extraer LOTE respetando nombres de columna posibles (LOTE, OP, ORDEN, etc.)
        const rawLote = first.LOTE ?? first.Lote ?? first.lote ?? first.OP ?? first.Op ?? first.op ?? first.ORDEN ?? first.Orden ?? first.orden ?? first.NUM_LOTE ?? first.PEDIDO;
        const loteVal = (rawLote != null && String(rawLote).trim() !== '')
            ? String(parseInt(rawLote) || String(rawLote).trim())
            : String(parseInt(numdoc) || numdoc);

        results.push({
            id_ingreso: numdoc,
            lote:       loteVal,
            fecha:      _normalizeDate(first.FECHA),
            id_taller:  String(first.ID_TALLER          || '').trim(),
            id_linea:   String(first.ID_LINEA            || '').trim(),
            id_auditor: String(first.ID_USUARIO_AUDITOR  || '').trim(),
            id_usuario: String(first.ID_USUARIO          || '').trim(),
            refprov,
            referencia,
            descripcion,
            total:       totalCantidad,
            tipo:        'FULL',
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

    // Clave de búsqueda: preferir lote numérico, pero si es igual al id_ingreso o si lote
    // es 0/vacío, también intentar por id_ingreso (NUMDOC, que puede ser alfanumérico en Excel)

    // Validar estado contra data2Map — primero por lote, luego por id_ingreso como fallback
    let estado = validarEstado(rec.lote, rec.fecha, String(rec.total));
    if (estado !== 'CONFIRMADA' && rec.id_ingreso && rec.id_ingreso !== rec.lote) {
        const estadoById = validarEstado(rec.id_ingreso, rec.fecha, String(rec.total));
        if (estadoById === 'CONFIRMADA') estado = estadoById;
    }

    // Validar parciales — primero por lote, luego por id_ingreso como fallback
    let validacionParcial = validarEstadoParcial(rec.lote, '', String(rec.total), rec.total);
    if (!validacionParcial.rechazar && validacionParcial.tipo === 'NUEVO' &&
        rec.id_ingreso && rec.id_ingreso !== rec.lote) {
        const vpById = validarEstadoParcial(rec.id_ingreso, '', String(rec.total), rec.total);
        if (vpById.tipo !== 'NUEVO') validacionParcial = vpById;
    }
    if (validacionParcial.rechazar) {
        Logger.warn('excel-processor', `OP ${rec.lote} (id_ingreso: ${rec.id_ingreso}) rechazada: ${validacionParcial.mensaje}`);
        return [];
    }

    const opSufijo = validacionParcial.sufijo || rec.lote;
    const esParcial= validacionParcial.esParcial || false;

    // Una fila por entry en hr[]
    return rec.hr.map(hrRow => {
        // En vez de enmascarar todo con REFVAR, mantener la referencia original del ítem
        const refItemOriginal = hrRow.referencia || hrRow.refprov || rec.referencia || rec.refprov || '';
        const refProvOriginal = hrRow.refprov || rec.refprov || '';

        return {
            REFERENCIA:          refItemOriginal,        // Referencia original individual (no REFVAR genérico)
            REFERENCIA_PROV:     refProvOriginal,        // Refprov individual
            REFERENCIA_HISTORICA: hrRow.referencia || rec.referencia || '',
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
            COD_COLOR:           hrRow.codigo_color  || '',   // codigo_color = código de barras en Excel
            OS:                  '',
            BODEGA:              'PRIMERAS',
            TALLER:              rec.TALLER          || '',
            DESCRIPCION_LARGA:   hrRow.descripcion   || rec.descripcion || '',
            PRENDA:              prenda,
            LINEA:               rec.LINEA           || '',
            GENERO:              genero,
            CC:                  '',
            ESTADO:              estado,
            MARCA:               marca,
            CLASE:               clase,
            DESCRIPCION:         descripcionFinal,
            AUDITOR:             rec.AUDITOR         || '',   // Campo extra para editor
            HR_REFERENCIA:       hrRow.referencia    || refItemOriginal,   // referencia específica del item en HR
            HR_DESCRIPCION:      hrRow.descripcion   || rec.descripcion || '',   // descripción específica del item en HR
            FUENTE:              'BUSINT'
        };
    });
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

        // 1. Leer Excel con XLSX
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws);

        if (!rawRows || rawRows.length === 0) {
            throw new Error('El archivo Excel está vacío o sin datos válidos');
        }

        Logger.info('excel-processor', `Excel leído: ${rawRows.length} filas brutas`);

        // 2. Normalizar a formato HR
        const hrRecords = _normalizeToHR(rawRows);
        Logger.info('excel-processor', `Normalizados: ${hrRecords.length} registros HR`);

        // 3. Cargar globales on-demand: solo los IDs que aparecen en este archivo
        await _loadGlobalMapsOnDemand(hrRecords);

        // ── Detectar datos globales faltantes (Plantas, Líneas, Auditores, Usuarios) ──
        const missingData = {
            plantas:   new Map(),
            lineas:    new Map(),
            auditores: new Map(),
            usuarios:  new Map()
        };

        hrRecords.forEach(r => {
            const op = r.lote || r.id_ingreso || '';

            // 1. Planta (id_taller)
            const idTaller = String(r.id_taller || '').trim();
            if (idTaller && idTaller !== '0') {
                const nombre = globalTalleresMap.get(idTaller);
                if (!nombre || !nombre.trim()) {
                    if (!missingData.plantas.has(idTaller)) missingData.plantas.set(idTaller, []);
                    if (op && !missingData.plantas.get(idTaller).includes(op)) missingData.plantas.get(idTaller).push(op);
                }
            }

            // 2. Línea (id_linea)
            const idLinea = String(r.id_linea || '').trim();
            if (idLinea && idLinea !== '0') {
                const nombre = globalLineasMap.get(idLinea);
                if (!nombre || !nombre.trim()) {
                    if (!missingData.lineas.has(idLinea)) missingData.lineas.set(idLinea, []);
                    if (op && !missingData.lineas.get(idLinea).includes(op)) missingData.lineas.get(idLinea).push(op);
                }
            }

            // 3. Auditor (id_auditor) — Permitir vacío si existe el registro (ej: 11) o si es 11/0
            const idAuditor = String(r.id_auditor || '').trim();
            if (idAuditor && idAuditor !== '0' && idAuditor !== '11') {
                // Solo si el ID no existe en la tabla de auditores
                if (!globalAuditoresMap.has(idAuditor)) {
                    if (!missingData.auditores.has(idAuditor)) missingData.auditores.set(idAuditor, []);
                    if (op && !missingData.auditores.get(idAuditor).includes(op)) missingData.auditores.get(idAuditor).push(op);
                }
            }

            // 4. Usuario (id_usuario)
            const idUsuario = String(r.id_usuario || '').trim();
            if (idUsuario && idUsuario !== '0') {
                const nombre = globalUsuariosMap.get(idUsuario);
                if (!nombre || !nombre.trim()) {
                    if (!missingData.usuarios.has(idUsuario)) missingData.usuarios.set(idUsuario, []);
                    if (op && !missingData.usuarios.get(idUsuario).includes(op)) missingData.usuarios.get(idUsuario).push(op);
                }
            }
        });

        const totalMissing = missingData.plantas.size + missingData.lineas.size + missingData.auditores.size + missingData.usuarios.size;

        if (totalMissing > 0 && typeof showMissingGlobalDataModal === 'function') {
            Logger.warn('excel-processor', `Se detectaron ${totalMissing} datos globales faltantes:`, missingData);
            loading.close();
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = '<i class="codicon codicon-play"></i> Procesar CSV';
            }
            updateStatus(`Esperando datos para ${totalMissing} registro(s) faltante(s)...`, 'warning');

            showMissingGlobalDataModal(missingData, async () => {
                const resumeLoading = showQuickLoading('Datos guardados. Continuando procesamiento de Excel...');
                try {
                    await _finishProcessingExcel(hrRecords, rawRows);
                } catch (err) {
                    console.error('Error continuando procesamiento Excel:', err);
                    showMessage('Error procesando Excel: ' + err.message, 'error', 4000);
                    updateStatus('Error procesando Excel', 'error');
                } finally {
                    resumeLoading.close();
                }
            });
            return;
        }

        // Si todos los datos están en el catálogo, continuar normalmente
        await _finishProcessingExcel(hrRecords, rawRows);

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

async function _finishProcessingExcel(hrRecords, rawRows) {
    // ── Pre-paso on-demand: extraer SOLO los IDs del Excel y hacer fetch puntual ──
    // Nunca se descarga el catálogo completo; cada carga nueva es una consulta fresca.
    if (hrRecords.length > 0) {
        const lotesEnExcel = [...new Set(hrRecords.map(r => String(r.lote || '').trim()).filter(Boolean))];
        // id_ingreso (NUMDOC) puede ser distinto al lote (ej. Excel donde LOTE ≠ NUMDOC)
        // Se pasan ambos al backend para que get_lotes_data2 busque por los dos campos
        const idsEnExcel   = [...new Set(hrRecords.map(r => String(r.id_ingreso || '').trim()).filter(Boolean))];

        // Extraer colores únicos del HR de todos los registros
        const coloresEnExcel = new Set();
        const refprovsEnExcel = new Set();
        hrRecords.forEach(r => {
            (r.hr || []).forEach(h => {
                if (h.codigo_color) coloresEnExcel.add(String(h.codigo_color).trim());
            });
            const rp = (r.refprov || r.referencia || '').trim();
            if (rp) refprovsEnExcel.add(rp);
        });

        if (lotesEnExcel.length > 0 || idsEnExcel.length > 0) {
            // Detectar proveedor ANTES de cualquier fetch para usar el NIT correcto
            let lineaDetectada = '';
            for (const r of hrRecords) {
                const l = (r.LINEA || r.linea || '').toString().trim().toUpperCase();
                if (l) { lineaDetectada = l; break; }
            }

            const esAngeles   = lineaDetectada.includes('ANGELES') || lineaDetectada.includes('ÁNGELES');
            const nuevoId     = esAngeles ? '900692469' : '900616124';
            const nuevoNombre = esAngeles
                ? 'TEXTILES Y CREACIONES LOS ANGELES SAS'
                : 'TEXTILES Y CREACIONES EL UNIVERSO SAS';

            const actual   = typeof getProveedorActivo === 'function' ? getProveedorActivo() : null;
            const cambiando = !actual || actual.id !== nuevoId;

            if (cambiando && typeof setProveedorActivo === 'function') {
                setProveedorActivo(nuevoId, nuevoNombre);
                Logger.info('excel-processor', `🏢 Proveedor → ${nuevoId} (${nuevoNombre}) — línea: '${lineaDetectada || 'no detectada'}'`);
            }

            // Fetch on-demand de TODOS los datos necesarios en paralelo
            // Pasar tanto lotes como ids (NUMDOCs) para detectar OPs ya guardadas desde Excel
            const [, , coloresResult, historicasResult] = await Promise.all([
                loadData2Data(lotesEnExcel, idsEnExcel).catch(err => { Logger.warn('excel-processor', 'Error data2', err); return new Map(); }),
                loadSisproData(lotesEnExcel).catch(err => { Logger.warn('excel-processor', 'Error sispro', err); return new Map(); }),
                typeof loadColoresByIds === 'function'
                    ? loadColoresByIds(Array.from(coloresEnExcel), nuevoId)
                          .catch(err => { Logger.warn('excel-processor', 'Error colores on-demand', err); return new Map(); })
                    : Promise.resolve(new Map()),
                typeof loadHistoricasByRefprovs === 'function'
                    ? loadHistoricasByRefprovs(Array.from(refprovsEnExcel), nuevoId)
                          .catch(err => { Logger.warn('excel-processor', 'Error historicas on-demand', err); return new Map(); })
                    : Promise.resolve(new Map())
            ]);

            // Si SISPRO tiene datos de línea, usarlos para refinar la detección
            if (!lineaDetectada && window.sisproMap instanceof Map) {
                for (const op of lotesEnExcel) {
                    const s = window.sisproMap.get(String(op).trim());
                    if (s && s.LINEA) { lineaDetectada = s.LINEA.toString().trim().toUpperCase(); break; }
                }
            }

            // Actualizar mapas globales con SOLO los datos del Excel
            if (coloresResult instanceof Map && coloresResult.size > 0) {
                window.coloresMap.clear();
                coloresResult.forEach((v, k) => window.coloresMap.set(k, v));
            }
            if (historicasResult instanceof Map && historicasResult.size > 0) {
                window.historicasMap.clear();
                historicasResult.forEach((v, k) => window.historicasMap.set(k, v));
            }

            if (cambiando) {
                if (typeof showMessage              === 'function') showMessage(`Proveedor: ${nuevoNombre}`, 'info', 2500);
                if (typeof updateProveedorIndicator === 'function') updateProveedorIndicator();
                if (typeof updateDataStats          === 'function') updateDataStats();
            }

            Logger.info('excel-processor',
                `On-demand Excel — Lotes:${lotesEnExcel.length} Colores:${coloresResult.size} ` +
                `Históricos:${historicasResult.size}`
            );
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
}

// ─── Exports ──────────────────────────────────────────────────────────────────
window.processExcel    = processExcel;
window.loadGlobalMaps  = loadGlobalMaps;
