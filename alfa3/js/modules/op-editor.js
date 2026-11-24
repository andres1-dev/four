// ============================================
// CARGAR OPCIONES DINÁMICAS EN LOS SELECTS
// ============================================

/**
 * Carga las opciones de proveedores en el select
 * SOLO ESTE SELECT SELECCIONA EL PRIMER VALOR POR DEFECTO
 */
function loadProveedoresOptions() {
    const select = document.getElementById('proveedor');
    if (!select) return;

    const currentValue = select.value;

    select.innerHTML = '<option value="">Seleccione...</option>';

    const sortedProveedores = Array.from(proveedoresMap.entries())
        .filter(([codigo, data]) => (typeof data === 'object' && data.ESTADO === 'TRUE') || typeof data === 'string')
        .sort((a, b) => {
            const nameA = (typeof a[1] === 'object') ? (a[1].NOMBRE || '') : (a[1] || '');
            const nameB = (typeof b[1] === 'object') ? (b[1].NOMBRE || '') : (b[1] || '');
            return nameA.localeCompare(nameB);
        });

    sortedProveedores.forEach(([codigo, data], index) => {
        const nombre = (typeof data === 'object') ? data.NOMBRE : data;
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;

        if (!currentValue && index === 0) {
            option.selected = true;
        } else if (nombre === currentValue) {
            option.selected = true;
        }

        select.appendChild(option);
    });

    Logger.info('op-editor', `📋 Select de proveedores cargado con ${proveedoresMap.size} opciones`);
}

/**
 * Carga las opciones de auditores en el select - SIN SELECCIÓN AUTOMÁTICA
 */
function loadAuditoresOptions() {
    const select = document.getElementById('auditor');
    if (!select) return;

    const currentValue = select.value;

    select.innerHTML = '<option value="">Seleccione...</option>';

    const sortedAuditores = Array.from(auditoresMap.entries())
        .filter(([codigo, data]) => (typeof data === 'object' && data.ESTADO === 'TRUE') || typeof data === 'string')
        .sort((a, b) => {
            const nameA = (typeof a[1] === 'object') ? (a[1].NOMBRE || '') : (a[1] || '');
            const nameB = (typeof b[1] === 'object') ? (b[1].NOMBRE || '') : (b[1] || '');
            return nameA.localeCompare(nameB);
        });

    sortedAuditores.forEach(([codigo, data]) => {
        const nombre = (typeof data === 'object') ? data.NOMBRE : data;
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;

        if (nombre === currentValue) {
            option.selected = true;
        }

        select.appendChild(option);
    });

    Logger.info('op-editor', `📋 Select de auditores cargado con ${auditoresMap.size} opciones`);
}

/**
 * Carga las opciones de gestores en el select.
 * Comportamiento según proveedor activo:
 *  - INVERSIONES URBANA → preselecciona gestor 1007348825
 *  - LOS ANGELES        → preselecciona gestor 1115189213
 *  - UNIVERSO           → muestra solo los otros dos gestores (sin preselección)
 */
function loadGestoresOptions() {
    const select = document.getElementById('gestor');
    if (!select) return;

    // IDs de gestores exclusivos por proveedor
    const GESTOR_INVERSIONES = '1007348825';
    const GESTOR_ANGELES     = '1115189213';

    // Determinar proveedor activo
    const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
    const proveedor = proveedorActivo ? (proveedorActivo.nombre || '').toUpperCase() : '';

    const esInversiones = proveedor.includes('INVERSIONES');
    const esAngeles     = proveedor.includes('ANGELES') || proveedor.includes('ÁNGELES');
    const esUniverso    = proveedor.includes('UNIVERSO');

    const currentValue = select.value; // Preservar selección actual si ya hay una

    select.innerHTML = '<option value="">Seleccione...</option>';

    const sortedGestores = Array.from(gestoresMap.entries())
        .filter(([codigo, data]) => (typeof data === 'object' && data.ESTADO === 'TRUE') || typeof data === 'string')
        .sort((a, b) => {
            const nameA = (typeof a[1] === 'object') ? (a[1].NOMBRE || '') : (a[1] || '');
            const nameB = (typeof b[1] === 'object') ? (b[1].NOMBRE || '') : (b[1] || '');
            return nameA.localeCompare(nameB);
        });

    sortedGestores.forEach(([codigo, data]) => {
        const nombre = (typeof data === 'object') ? data.NOMBRE : data;

        // INVERSIONES: mostrar solo su gestor exclusivo
        if (esInversiones && codigo !== GESTOR_INVERSIONES) return;
        // ANGELES: mostrar solo su gestor exclusivo
        if (esAngeles && codigo !== GESTOR_ANGELES) return;
        // UNIVERSO: excluir los gestores exclusivos de los otros dos proveedores
        if (esUniverso && (codigo === GESTOR_INVERSIONES || codigo === GESTOR_ANGELES)) return;

        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;
        select.appendChild(option);
    });

    // Restaurar selección previa si existe (la autoselección por línea se hace en loadOPData)
    if (currentValue) {
        select.value = currentValue;
    }

    Logger.info('op-editor', `📋 Select de gestores cargado (proveedor: ${proveedor || 'ninguno'})`);
}

/**
 * NUEVO: Carga las opciones de usuarios/escaners en el select
 * Cargado desde escanersMap (hoja USUARIOS)
 */
function loadUsuariosOptions() {
    const select = document.getElementById('escanerEdit');
    if (!select) return;

    const currentValue = select.value;

    select.innerHTML = '';

    // Agregar opción por defecto
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Seleccione un usuario...';
    select.appendChild(defaultOption);

    // Cargar desde el mapa dinámico de usuarios activos
    const sortedUsuarios = Array.from(escanersMap.entries())
        .filter(([codigo, data]) => (typeof data === 'object' && data.ESTADO === 'TRUE') || typeof data === 'string')
        .sort((a, b) => {
            const nameA = (typeof a[1] === 'object') ? (a[1].NOMBRE || '') : (a[1] || '');
            const nameB = (typeof b[1] === 'object') ? (b[1].NOMBRE || '') : (b[1] || '');
            return nameA.localeCompare(nameB);
        });

    sortedUsuarios.forEach(([codigo, data]) => {
        const nombre = (typeof data === 'object') ? data.NOMBRE : data;
        const option = document.createElement('option');
        option.value = nombre; // Guardamos el nombre completo
        option.textContent = `${nombre}`; // Mostramos: NOMBRE
        option.dataset.codigo = codigo;

        // Si hay un valor actual y coincide, seleccionar
        if (nombre === currentValue) {
            option.selected = true;
        }

        select.appendChild(option);
    });

    Logger.info('op-editor', `📋 Select de usuarios cargado con ${escanersMap.size} opciones`);
}

/**
 * Devuelve el nombre del gestor correspondiente a una línea dada.
 * Regla:
 *   ANGELES                       → LUIS VILLAMIZAR GOMEZ
 *   ESPECIALES | BOGOTA | INVERSIONES → JUAN ESTEBAN ZULUAGA HOYOS
 *   todo lo demás                 → KELLY GIOVANA ZULUAGA HOYOS
 */
function getGestorByLinea(linea) {
    const l = (linea || '').toUpperCase().trim();
    if (l === 'ANGELES')                       return 'LUIS VILLAMIZAR GOMEZ';
    if (l === 'ESPECIALES' || l === 'BOGOTA')  return 'JUAN ESTEBAN ZULUAGA HOYOS';
    if (l === 'INVERSIONES')                   return 'RUBEN ESTEBAN ZULUAGA GOMEZ';
    return 'KELLY GIOVANA ZULUAGA HOYOS';
}

/**
 * Actualiza el select de gestor según la línea recibida.
 */
function autoSelectGestorByLinea(linea) {
    const gestorSelect = document.getElementById('gestor');
    if (!gestorSelect || !linea) return;
    const gestorNombre = getGestorByLinea(linea);
    const opt = Array.from(gestorSelect.options).find(o => o.value === gestorNombre);
    if (opt) {
        gestorSelect.value = gestorNombre;
        Logger.info('op-editor', `👤 Gestor → ${gestorNombre} (línea: ${linea})`);
    }
}

function loadAllDynamicOptions() {
    // Ya no se necesita loadProveedoresOptions() porque es un input bloqueado
    loadAuditoresOptions();
    loadGestoresOptions();
    loadUsuariosOptions();
    
    // Sincronizar proveedor activo con el input
    if (typeof window.syncProveedorToSelect === 'function') {
        window.syncProveedorToSelect();
    }

    // Escuchar cambios en el select de línea para actualizar gestor automáticamente
    const lineaSelect = document.getElementById('opLineaEdit');
    if (lineaSelect && !lineaSelect._gestorListenerAdded) {
        lineaSelect.addEventListener('change', () => {
            autoSelectGestorByLinea(lineaSelect.value);
        });
        lineaSelect._gestorListenerAdded = true;
    }
}

// ============================================
// FUNCIONES PRINCIPALES DEL EDITOR
// ============================================

function loadOPData() {
    const selectOP = document.getElementById('selectOP');
    const selectedOption = selectOP.options[selectOP.selectedIndex];

    if (!selectedOption.value) return;

    const items = JSON.parse(selectedOption.dataset.items);
    setCurrentOPData(items);

    const primerItem = getRepresentativeItem(items);

    // NUEVO: Intentar traer PVP y LINEA de maestros si no vienen en el item
    const op = (primerItem.OP || '').toString().trim();
    const ref = (primerItem.REFERENCIA || '').toString().trim();
    
    // 1. PVP desde preciosMap (usando Referencia)
    if ((!primerItem.PVP || primerItem.PVP === '') && window.preciosMap && window.preciosMap.has(ref)) {
        primerItem.PVP = window.preciosMap.get(ref);
        Logger.info('op-editor', `💰 PVP autocompletado desde preciosMap para ${ref}: ${primerItem.PVP}`);
    }
    
    // 2. LINEA desde sisproMap (usando OP)
    if ((!primerItem.LINEA || primerItem.LINEA === '') && window.sisproMap && window.sisproMap.has(op)) {
        const sisproData = window.sisproMap.get(op);
        primerItem.LINEA = sisproData.LINEA || '';
        Logger.info('op-editor', `📋 Línea autocompletada desde sisproMap para OP ${op}: ${primerItem.LINEA}`);
    }
    
    // 3. Lógica de NIT para Línea predeterminada (si sigue vacío o es el genérico)
    const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
    const nit = proveedorActivo ? (proveedorActivo.id || '').toString() : '';
    
    if (!primerItem.LINEA || primerItem.LINEA === '' || primerItem.LINEA === 'INVERSIONES URBANA') {
        if (nit === '901920844') {
            primerItem.LINEA = 'INVERSIONES';
            Logger.info('op-editor', `🏢 Línea predeterminada para INVERSIONES URBANA (901920844)`);
        } else if (nit === '900692469') {
            primerItem.LINEA = 'ANGELES';
            Logger.info('op-editor', `🏢 Línea predeterminada para ANGELES (900692469)`);
        }
    }

    // 4. PRENDA y GÉNERO: siempre se calculan desde DESCRIPCION_LARGA (igual que migración BUSINT)
    // No usar lo que venga de SISPRO — la descripción larga del CSV es la fuente de verdad
    if (primerItem.DESCRIPCION_LARGA) {
        const extracted = extractPrendaGeneroFromDescripcion(primerItem.DESCRIPCION_LARGA);
        primerItem.PRENDA = extracted.prenda;
        primerItem.GENERO = extracted.genero;
        Logger.info('op-editor', `🔍 Prenda/Género desde DESCRIPCION_LARGA "${primerItem.DESCRIPCION_LARGA}": ${extracted.prenda} / ${extracted.genero}`);
    }

    // Cargar PVP
    const pvpField = document.getElementById('pvpEdit');
    if (pvpField) pvpField.value = primerItem.PVP || '';

    // Mostrar/ocultar campos exclusivos de Excel (BUSINT)
    const esBusint = primerItem.FUENTE === 'BUSINT';
    const loteGroup = document.getElementById('opLoteEditGroup');
    const tipoGroup = document.getElementById('opTipoEditGroup');
    if (loteGroup) loteGroup.style.display = esBusint ? '' : 'none';
    if (tipoGroup) tipoGroup.style.display = esBusint ? '' : 'none';

    if (esBusint) {
        const loteInput = document.getElementById('opLoteEdit');
        const tipoSelect = document.getElementById('opTipoEdit');
        if (loteInput) loteInput.value = primerItem.OP || '';
        if (tipoSelect) tipoSelect.value = primerItem.TIPO || 'FULL';
    }

    // Limpiar selects de cabecera
    ['proveedor', 'auditor', 'gestor', 'escanerEdit'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Para items de Excel (BUSINT): ajustar el proveedor activo según la línea
    // ANGELES → 900692469 | todo lo demás (UNIVERSO, MODAFRESCA, etc.) → 900616124
    if (primerItem.FUENTE === 'BUSINT' && primerItem.LINEA) {
        const lineaUpper = primerItem.LINEA.toUpperCase().trim();
        const provActualActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;

        // Determinar la productora correcta según la línea
        const productoraId = lineaUpper === 'ANGELES' ? '900692469' : '900616124';

        if (!provActualActivo || provActualActivo.id !== productoraId) {
            const pData = window.proveedoresMap?.get(productoraId);
            const nombreProd = pData?.NOMBRE || (productoraId === '900692469'
                ? 'TEXTILES Y CREACIONES LOS ANGELES SAS'
                : 'TEXTILES Y CREACIONES EL UNIVERSO SAS');
            if (typeof setProveedorActivo === 'function') {
                setProveedorActivo(productoraId, nombreProd);
                Logger.info('op-editor', `🏢 Proveedor ajustado a ${nombreProd} (${productoraId}) por línea BUSINT "${lineaUpper}"`);
            }
        }
    }

    // Cargar opciones dinámicas
    loadAllDynamicOptions();

    // 5. Autoseleccionar GESTOR según LÍNEA (igual que migración BUSINT)
    const gestorSelect = document.getElementById('gestor');
    // 5. Autoseleccionar GESTOR según LÍNEA
    if (primerItem.LINEA) autoSelectGestorByLinea(primerItem.LINEA);

    // 6. Autoseleccionar AUDITOR (viene resuelto desde Excel o del CSV)
    const auditorSelect = document.getElementById('auditor');
    if (auditorSelect && primerItem.AUDITOR) {
        const auditorNombre = (primerItem.AUDITOR || '').toString().trim();
        const auditorOpts   = Array.from(auditorSelect.options);
        // Buscar coincidencia exacta primero, luego insensible a mayúsculas
        const matchAuditor  = auditorOpts.find(opt => opt.value === auditorNombre)
                           || auditorOpts.find(opt => opt.value.toUpperCase() === auditorNombre.toUpperCase());
        if (matchAuditor) {
            matchAuditor.selected = true;
            Logger.info('op-editor', `🔍 Auditor autoseleccionado: ${matchAuditor.value}`);
        }
        // Si no coincide: dejar vacío — el usuario lo selecciona manualmente
        // NUNCA crear opción temporal para auditores
    }

    // 7. Seleccionar ESCANER/USUARIO
    const escanerSelect = document.getElementById('escanerEdit');
    if (escanerSelect && primerItem.USUARIO) {
        const options = Array.from(escanerSelect.options);
        const matchingOption = options.find(opt => opt.value === primerItem.USUARIO);

        if (matchingOption) {
            matchingOption.selected = true;
        } else {
            const tempOption = document.createElement('option');
            tempOption.value = primerItem.USUARIO;
            const userName = (typeof primerItem.USUARIO === 'object') ? (primerItem.USUARIO.NOMBRE || 'Error') : (primerItem.USUARIO || '');
            tempOption.textContent = `${userName} (${primerItem.FUENTE === 'EXCEL' ? 'Excel' : 'CSV'})`;
            tempOption.selected = true;
            escanerSelect.appendChild(tempOption);
        }
    }

    const bolsasField = document.getElementById('bolsas');
    if (bolsasField) bolsasField.value = '0';

    loadOPEditor();
    switchToEditorTab();
}

/**
 * Actualiza dinámicamente la línea en el editor basándose en el NIT activo.
 * Útil cuando se cambia de proveedor con el editor ya abierto.
 */
function refreshLineaFromActiveNIT() {
    if (!currentOPData || currentOPData.length === 0) return;

    const primerItem = getRepresentativeItem(currentOPData);
    const proveedorActivo = (typeof getProveedorActivo === 'function') ? getProveedorActivo() : null;
    const nit = proveedorActivo ? (proveedorActivo.id || '').toString() : '';

    // Solo sobreescribir si la línea está vacía o es el valor genérico
    if (!primerItem.LINEA || primerItem.LINEA === '' || primerItem.LINEA === 'INVERSIONES URBANA') {
        let nuevaLinea = '';
        if (nit === '901920844') {
            nuevaLinea = 'INVERSIONES';
        } else if (nit === '900692469') {
            nuevaLinea = 'ANGELES';
        }

        if (nuevaLinea) {
            // Actualizar en los datos
            currentOPData.forEach(item => item.LINEA = nuevaLinea);
            
            // Actualizar en la UI
            const lineaInput = document.getElementById('opLineaEdit');
            if (lineaInput) {
                lineaInput.value = nuevaLinea;
                Logger.info('op-editor', `🔄 Línea actualizada dinámicamente a: ${nuevaLinea}`);
            }
        }
    }
}

function loadOPEditor() {
    if (!currentOPData || currentOPData.length === 0) {
        hideEditor();
        return;
    }

    showEditor();
    updateEditorHeader();
    updateEditorStats();
    renderResumenBodegas();
}

function showEditor() {
    const container = document.getElementById('opEditorContainer');
    const emptyState = document.getElementById('opEditorEmptyState');
    if (container) container.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
}

function hideEditor() {
    const container = document.getElementById('opEditorContainer');
    const emptyState = document.getElementById('opEditorEmptyState');
    if (container) container.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
}

function updateEditorHeader() {
    const primerItem = getRepresentativeItem(currentOPData);

    const opInput = document.getElementById('opNumberReadonly');
    const refInput = document.getElementById('opRefReadonly');
    const descripcionLargaDisplay = document.getElementById('opDescripcionLargaDisplay');
    const prendaInput = document.getElementById('opPrendaEdit');
    const generoInput = document.getElementById('opGeneroEdit');
    const lineaInput = document.getElementById('opLineaEdit');
    const totalInput = document.getElementById('opTotalReadonly');

    if (opInput) opInput.value = primerItem.OP_SUFIJO || primerItem.OP || '';
    if (refInput) {
        refInput.value = primerItem.REFERENCIA || '';
        // Si el usuario edita la referencia principal en el header, propagar a los items de la OP
        refInput.onchange = function() {
            const nuevaRef = this.value.trim();
            if (!currentOPData || !nuevaRef) return;
            currentOPData.forEach(item => {
                // Actualizar items de PRIMERAS o que tenían la referencia anterior
                if (item.BODEGA === 'PRIMERAS' || item.REFERENCIA === primerItem.REFERENCIA) {
                    item.REFERENCIA = nuevaRef;
                }
            });
            renderResumenBodegas();
        };
    }
    
    // Mostrar descripción larga en el título
    if (descripcionLargaDisplay) {
        const descripcionLarga = primerItem.DESCRIPCION_LARGA || 'Sin descripción larga';
        descripcionLargaDisplay.textContent = descripcionLarga;
        descripcionLargaDisplay.title = descripcionLarga; // Tooltip por si es muy largo
    }
    
    if (prendaInput) prendaInput.value = primerItem.PRENDA || '';
    if (generoInput) generoInput.value = primerItem.GENERO || '';
    if (lineaInput) lineaInput.value = primerItem.LINEA || '';
    if (totalInput) totalInput.value = primerItem.TOTAL || '0';
}

// ============================================
// VISTA ÚNICA: RESUMEN POR BODEGA CON DETALLE EDITABLE
// ============================================

function renderResumenBodegas() {
    const tbody = document.getElementById('opEditorTableBody');
    if (!tbody) return;

    // Verificar inconsistencias de referencia en la OP
    verificarInconsistenciasReferencias();

    // Agrupar por bodega
    const resumen = {};
    currentOPData.forEach(item => {
        const bodega = item.BODEGA || 'SIN BODEGA';
        if (!resumen[bodega]) {
            resumen[bodega] = {
                bodega: bodega,
                cantidad: 0,
                costoTotal: 0,
                items: []
            };
        }
        resumen[bodega].cantidad += parseInt(item.CANTIDAD) || 0;
        resumen[bodega].costoTotal += (parseInt(item.CANTIDAD) || 0) * (parseFloat(item.COSTO) || 0);
        resumen[bodega].items.push(item);
    });

    // Ordenar: PRIMERAS, PROMOCIONES, COBROS, SIN CONFECCIONAR, resto
    const resumenArray = Object.values(resumen).sort((a, b) => {
        const orden = {
            'PRIMERAS': 1,
            'PROMOCIONES': 2,
            'COBROS': 3,
            'SIN CONFECCIONAR': 4
        };
        return (orden[a.bodega] || 99) - (orden[b.bodega] || 99);
    });

    tbody.innerHTML = resumenArray.map((grupo, index) => {
        const blockId = `block-${index}`;
        const badgeColor = grupo.bodega === 'PRIMERAS' ? 'var(--success)' :
            grupo.bodega === 'PROMOCIONES' ? 'var(--warning)' :
                grupo.bodega === 'COBROS' ? 'var(--error)' :
                    grupo.bodega === 'SIN CONFECCIONAR' ? 'var(--info)' : 'var(--text-secondary)';

        const bgDim = grupo.bodega === 'PRIMERAS' ? 'var(--success-dim)' :
            grupo.bodega === 'PROMOCIONES' ? 'var(--warning-dim)' :
                grupo.bodega === 'COBROS' ? 'var(--error-dim)' :
                    grupo.bodega === 'SIN CONFECCIONAR' ? 'var(--info-dim)' : 'transparent';

        return `
            <tr class="resumen-row" data-bodega="${grupo.bodega}" data-index="${index}"
                style="cursor: pointer; background-color: ${bgDim};">
                <td colspan="6" style="padding: 0;">
                    <div class="bodega-card-header">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <i class="codicon codicon-chevron-right toggle-icon" id="toggle-icon-${index}"
                               style="font-size: 16px; transition: transform 0.2s; color: var(--text-secondary);"></i>
                            <span style="font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.6px; color: ${badgeColor};">
                                ${grupo.bodega}
                            </span>
                            <span class="panel-badge" style="background: var(--sidebar); color: var(--text-secondary); border: 1px solid var(--border); font-size: 10px;">
                                ${grupo.items.length} ${grupo.items.length === 1 ? 'reg.' : 'REGISTROS'}
                            </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 20px;">
                            <span style="font-size: 12px; color: var(--text-secondary);">
                                <span style="font-weight: 700; color: var(--text); font-size: 14px;">${grupo.cantidad.toLocaleString('es-CO')}</span>
                                <span style="margin-left: 4px; opacity: 0.6;">uds</span>
                            </span>
                            <span style="font-size: 12px; color: var(--text-secondary);">
                                <span style="font-weight: 700; color: var(--text); font-size: 14px;">$ ${grupo.costoTotal.toLocaleString('es-CO')}</span>
                            </span>
                            <div style="display: flex; align-items: center; gap: 6px; padding-left: 12px; border-left: 1px solid var(--border);"
                                 onclick="event.stopPropagation()">
                                <input type="checkbox" title="Seleccionar todos"
                                       style="width:14px; height:14px; accent-color: var(--primary); cursor:pointer;"
                                       onchange="window.toggleSelectAll('${blockId}', this.checked)">
                                <button id="btn-delete-sel-${blockId}" class="btn-icon"
                                        style="display:none; color: var(--error); border: 1px solid var(--error-dim); background: var(--error-dim); gap: 5px; padding: 3px 8px; font-size: 11px;"
                                        onclick="window.deleteSelectedRows('${blockId}')"
                                        title="Eliminar seleccionados">
                                    <i class="codicon codicon-trash"></i> Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
            <tr id="detalle-${index}" class="detalle-row" style="display: none;">
                <td colspan="6" style="padding: 0;">
                    <div class="detalle-container">
                        ${renderDetalleEditable(grupo.items, index)}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Agregar event listeners a las filas de resumen
    setTimeout(() => {
        document.querySelectorAll('.resumen-row').forEach((row, idx) => {
            row.removeEventListener('click', window.handleResumenClick);
            row.addEventListener('click', window.handleResumenClick);
        });
    }, 0);
}

/**
 * Renderiza la tabla de detalle COMPLETAMENTE EDITABLE
 */
function renderDetalleEditable(items, grupoIndex) {
    const blockId = `block-${grupoIndex}`;
    const refHeader = document.getElementById('opRefReadonly')?.value?.trim();
    const esRefVarOficial = (refHeader === 'REFVAR');
    const refPrimeras = obtenerReferenciaPrimeras(currentOPData);

    return `
        <div class="detalle-table-wrapper">
            <table class="detalle-table">
                <thead>
                    <tr>
                        <th style="width: 32px; text-align: center;">#</th>
                        <th style="width: 140px; text-align: center;">Referencia</th>
                        <th style="width: 80px;">Talla</th>
                        <th>Color</th>
                        <th>Bodega</th>
                        <th style="text-align: center; width: 120px;">Cantidad</th>
                        <th>Traslado</th>
                        <th style="text-align: center; width: 48px;">Acción</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item) => {
                        const globalIndex = currentOPData.indexOf(item);
                        const itemBodega = (item.BODEGA || '').trim().toUpperCase();
                        const esInconsistente = validarInconsistenciaItem(item, refPrimeras, esRefVarOficial);

                        let tooltipRef = 'Referencia de este item';
                        if (esInconsistente) {
                            if (itemBodega === 'PRIMERAS') {
                                tooltipRef = `REFERENCIA DISCORDANTE EN PRIMERAS (Esperada: ${refPrimeras})`;
                            } else if (itemBodega === 'PROMOCIONES' || itemBodega === 'SEGUNDAS') {
                                tooltipRef = `ERROR EN PROMOCIÓN: La referencia no debe ser igual a Primeras (${refPrimeras})`;
                            } else {
                                tooltipRef = `REFERENCIA DISCORDANTE EN ${item.BODEGA}: Debe ser igual a Primeras (${refPrimeras})`;
                            }
                        }

                        const bodegaOptions = Object.keys(bodegasMap).map(code => {
                            const name = bodegasMap[code];
                            const isSelected = (item.BODEGA === name) || (item.BODEGA === code);
                            return `<option value="${name}" ${isSelected ? 'selected' : ''}>${name}</option>`;
                        }).join('');

                        const estiloFila = esInconsistente 
                            ? 'background-color: rgba(198,40,40,0.12); border-left: 3px solid var(--error);' 
                            : '';

                        return `
                            <tr style="${estiloFila}">
                                <td style="text-align: center;">
                                    <input type="checkbox" class="row-check-${blockId}"
                                           data-index="${globalIndex}"
                                           onchange="window.onRowCheckChange('${blockId}')">
                                </td>
                                <td style="text-align: center;">
                                    <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                                        <input type="text"
                                               class="editor-input"
                                               value="${item.REFERENCIA || ''}"
                                               title="${tooltipRef}"
                                               style="font-size: 11px; padding: 4px 6px; ${esInconsistente ? 'font-weight:700; color: var(--error);' : ''}"
                                               onchange="window.handleEditorChange(${globalIndex}, 'REFERENCIA', this.value)">
                                        ${esInconsistente ? '' : ''}
                                    </div>
                                </td>
                                <td style="font-weight: 700; color: var(--primary);">${item.TALLA}</td>
                                <td style="color: var(--text-secondary);">${item.COLORES || item.COD_COLOR}</td>
                                <td>
                                    <select class="editor-select"
                                            onchange="window.handleEditorChange(${globalIndex}, 'BODEGA', this.value)">
                                        ${bodegaOptions}
                                    </select>
                                </td>
                                <td style="text-align: center;">
                                    <div class="editor-input-group">
                                        <input type="number"
                                               class="editor-input"
                                               value="${item.CANTIDAD}"
                                               min="0"
                                               step="1"
                                               onchange="window.handleEditorChange(${globalIndex}, 'CANTIDAD', this.value)"
                                               id="qty-input-${globalIndex}">
                                        <div class="editor-number-controls">
                                            <button class="editor-number-btn" type="button"
                                                    onclick="window.adjustQty(${globalIndex}, 1)">
                                                <i class="codicon codicon-chevron-up"></i>
                                            </button>
                                            <button class="editor-number-btn" type="button"
                                                    onclick="window.adjustQty(${globalIndex}, -1)">
                                                <i class="codicon codicon-chevron-down"></i>
                                            </button>
                                        </div>
                                    </div>
                                </td>
                                <td style="font-family: 'Cascadia Code', monospace; font-size: 11px; color: var(--text-secondary); opacity: 0.7;">
                                    ${item.TRASLADO}
                                </td>
                                <td style="text-align: center;">
                                    <button class="btn-icon"
                                            style="color: var(--error); border: 1px solid var(--error-dim); background: var(--error-dim);"
                                            onclick="window.deleteEditorRow(${globalIndex})"
                                            title="Eliminar fila">
                                        <i class="codicon codicon-trash" style="font-size: 14px;"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}


// ============================================
// MANEJADORES DE EVENTOS
// ============================================

function handleResumenClick(e) {
    // Prevenir que clicks en botones, selects o inputs expandan/contraigan
    if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) {
        e.stopPropagation();
        return;
    }

    const row = e.currentTarget;
    const index = row.dataset.index;
    toggleDetalle(index);
}

function toggleDetalle(index) {
    const detalleRow = document.getElementById(`detalle-${index}`);
    const icon = document.getElementById(`toggle-icon-${index}`);

    if (detalleRow) {
        if (detalleRow.style.display === 'none') {
            detalleRow.style.display = 'table-row';
            if (icon) icon.style.transform = 'rotate(90deg)';
        } else {
            detalleRow.style.display = 'none';
            if (icon) icon.style.transform = 'rotate(0deg)';
        }
    }
}

function colapsarDetalle(index) {
    const detalleRow = document.getElementById(`detalle-${index}`);
    const icon = document.getElementById(`toggle-icon-${index}`);

    if (detalleRow) {
        detalleRow.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
}

function expandirTodo() {
    document.querySelectorAll('[id^="detalle-"]').forEach((row) => {
        const match = row.id.match(/\d+$/);
        if (match) {
            row.style.display = 'table-row';
            const icon = document.getElementById(`toggle-icon-${match[0]}`);
            if (icon) icon.style.transform = 'rotate(90deg)';
        }
    });
}

function colapsarTodo() {
    document.querySelectorAll('[id^="detalle-"]').forEach((row) => {
        const match = row.id.match(/\d+$/);
        if (match) {
            row.style.display = 'none';
            const icon = document.getElementById(`toggle-icon-${match[0]}`);
            if (icon) icon.style.transform = 'rotate(0deg)';
        }
    });
}

// ============================================
// ACTUALIZAR ESTADÍSTICAS (TOTALES SUPERIORES)
// ============================================

function updateEditorStats() {
    if (!currentOPData) return;

    const totalUnits = currentOPData.reduce((sum, item) => sum + (parseInt(item.CANTIDAD) || 0), 0);
    // COSTO TOTAL: solo PRIMERAS, PROMOCIONES y COBROS. NUNCA SIN CONFECCIONAR.
    const totalCost = currentOPData.reduce((sum, item) => {
        if (item.BODEGA === 'SIN CONFECCIONAR') return sum;
        return sum + ((parseInt(item.CANTIDAD) || 0) * (parseFloat(item.COSTO) || 0));
    }, 0);

    const unitsEl = document.getElementById('editorTotalUnits');
    const costEl = document.getElementById('editorTotalCost');

    if (unitsEl) unitsEl.textContent = totalUnits.toLocaleString('es-CO');
    if (costEl) costEl.textContent = totalCost.toLocaleString('es-CO');
}

// ============================================
// MANEJADORES DE EDICIÓN
// ============================================

/**
 * Obtiene el costo unitario de PRIMERAS (DI) para una OP dada.
 * Busca en currentOPData el primer item con BODEGA='PRIMERAS' y devuelve su COSTO.
 * Si no hay items PRIMERAS, busca cualquier item con costo > 0.
 */
function getCostoPrimeras(op) {
    if (!currentOPData) return 0;
    // Buscar en PRIMERAS primero
    const primeraPrimeras = currentOPData.find(
        item => item.OP === op && item.BODEGA === 'PRIMERAS' && parseFloat(item.COSTO) > 0
    );
    if (primeraPrimeras) return parseFloat(primeraPrimeras.COSTO) || 0;

    // Fallback: buscar cualquier item de la misma OP con costo > 0 (excepto SIN CONFECCIONAR)
    const cualquierItem = currentOPData.find(
        item => item.OP === op && item.BODEGA !== 'SIN CONFECCIONAR' && parseFloat(item.COSTO) > 0
    );
    return cualquierItem ? (parseFloat(cualquierItem.COSTO) || 0) : 0;
}

function handleEditorChange(index, field, value) {
    if (index >= 0 && index < currentOPData.length) {
        const item = currentOPData[index];
        const bodegaAnterior = item.BODEGA; // Guardar bodega anterior

        if (field === 'CANTIDAD') {
            item.CANTIDAD = parseInt(value) || 0;
            actualizarHeaderBodegaVisual(item.BODEGA);
        } else if (field === 'REFERENCIA') {
            item.REFERENCIA = (value || '').trim();
            // Si el item modificado es de PRIMERAS, reflejarlo en el header de la OP
            const refHeaderInput = document.getElementById('opRefReadonly');
            if (refHeaderInput && (item.BODEGA === 'PRIMERAS' || !refHeaderInput.value)) {
                refHeaderInput.value = item.REFERENCIA;
            }
        } else if (field === 'BODEGA') {
            item.BODEGA = value;
            // Recalcular costo automáticamente según la bodega
            // SIN CONFECCIONAR = costo 0, el resto usa el costo original de PRIMERAS
            if (value === 'SIN CONFECCIONAR') {
                item.COSTO = 0;
            } else {
                // Buscar el costo de PRIMERAS en la misma OP
                const costoOriginal = getCostoPrimeras(item.OP);
                item.COSTO = costoOriginal;
            }
            
            // Actualizar ambas bodegas: la anterior y la nueva
            if (bodegaAnterior && bodegaAnterior !== value) {
                actualizarHeaderBodegaVisual(bodegaAnterior);
            }
            actualizarHeaderBodegaVisual(value);
        }

        updateEditorStats();

        const expandedStates = {};
        document.querySelectorAll('[id^="detalle-"]').forEach((row) => {
            const match = row.id.match(/\d+$/);
            if (match) {
                expandedStates[match[0]] = row.style.display !== 'none';
            }
        });

        renderResumenBodegas();

        setTimeout(() => {
            Object.keys(expandedStates).forEach(index => {
                if (expandedStates[index]) {
                    const detalleRow = document.getElementById(`detalle-${index}`);
                    const icon = document.getElementById(`toggle-icon-${index}`);
                    if (detalleRow) detalleRow.style.display = 'table-row';
                    if (icon) icon.style.transform = 'rotate(90deg)';
                }
            });
        }, 0);
    }
}

function actualizarHeaderBodegaVisual(bodegaNombre) {
    if (!bodegaNombre) return;
    
    // Calcular totales para la bodega específica
    const itemsBodega = currentOPData.filter(item => item.BODEGA === bodegaNombre);
    
    if (itemsBodega.length === 0) return;
    
    const cantidadTotal = itemsBodega.reduce((sum, item) => sum + (parseInt(item.CANTIDAD) || 0), 0);
    const costoTotal = itemsBodega.reduce((sum, item) => {
        const cantidad = parseInt(item.CANTIDAD) || 0;
        const costo = parseFloat(item.COSTO) || 0;
        return sum + (cantidad * costo);
    }, 0);
    
    // Buscar el header de esta bodega en el DOM
    const resumenRow = document.querySelector(`.resumen-row[data-bodega="${bodegaNombre}"]`);
    if (!resumenRow) return;
    
    const header = resumenRow.querySelector('.bodega-card-header');
    if (!header) return;
    
    // Actualizar cantidad
    const cantidadSpan = header.querySelector('span[style*="font-size: 14px"]');
    if (cantidadSpan) {
        cantidadSpan.textContent = cantidadTotal.toLocaleString('es-CO');
    }
    
    // Actualizar costo (es el segundo span con font-size: 14px)
    const allSpans = header.querySelectorAll('span[style*="font-size: 14px"]');
    if (allSpans.length >= 2) {
        allSpans[1].textContent = '$ ' + costoTotal.toLocaleString('es-CO');
    }
    
    // Actualizar badge de registros
    const badge = header.querySelector('.panel-badge');
    if (badge) {
        badge.textContent = `${itemsBodega.length} ${itemsBodega.length === 1 ? 'reg.' : 'REGISTROS'}`;
    }
}

function deleteEditorRow(index) {
    if (confirm('¿Estás seguro de eliminar este registro? Esta acción es irreversible para la sesión actual.')) {
        currentOPData.splice(index, 1);
        updateEditorStats();

        const expandedStates = {};
        document.querySelectorAll('[id^="detalle-"]').forEach((row) => {
            const match = row.id.match(/\d+$/);
            if (match) {
                expandedStates[match[0]] = row.style.display !== 'none';
            }
        });

        renderResumenBodegas();

        setTimeout(() => {
            Object.keys(expandedStates).forEach(index => {
                if (expandedStates[index]) {
                    const detalleRow = document.getElementById(`detalle-${index}`);
                    const icon = document.getElementById(`toggle-icon-${index}`);
                    if (detalleRow) detalleRow.style.display = 'table-row';
                    if (icon) icon.style.transform = 'rotate(90deg)';
                }
            });
        }, 0);
    }
}

function adjustQty(globalIndex, delta) {
    if (globalIndex < 0 || globalIndex >= currentOPData.length) return;
    const item = currentOPData[globalIndex];
    const newVal = Math.max(0, (parseInt(item.CANTIDAD) || 0) + delta);
    item.CANTIDAD = newVal;
    const input = document.getElementById(`qty-input-${globalIndex}`);
    if (input) input.value = newVal;
    
    // Actualizar visualmente el header de la bodega
    actualizarHeaderBodegaVisual(item.BODEGA);
    
    updateEditorStats();
}

// ============================================
// LÓGICA DE DETECCIÓN Y GESTIÓN DE REFVAR / INCONSISTENCIAS
// ============================================

function obtenerReferenciaMayoritaria(itemsList) {
    const list = itemsList || currentOPData;
    if (!list || list.length === 0) return '';
    const conteo = {};
    list.forEach(item => {
        const r = (item.REFERENCIA || '').trim();
        if (r) conteo[r] = (conteo[r] || 0) + 1;
    });
    let maxRef = '';
    let maxCant = 0;
    for (const [r, c] of Object.entries(conteo)) {
        if (c > maxCant) {
            maxCant = c;
            maxRef = r;
        }
    }
    return maxRef;
}

/**
 * Obtiene la referencia predominante en la bodega PRIMERAS.
 * Si no hay items en Primeras, retorna la referencia mayoritaria general.
 */
function obtenerReferenciaPrimeras(itemsList) {
    const list = itemsList || currentOPData;
    if (!list || list.length === 0) return '';
    const primeras = list.filter(i => (i.BODEGA || '').trim().toUpperCase() === 'PRIMERAS');
    if (primeras.length === 0) return obtenerReferenciaMayoritaria(list);

    const conteo = {};
    primeras.forEach(item => {
        const r = (item.REFERENCIA || '').trim();
        if (r) conteo[r] = (conteo[r] || 0) + 1;
    });
    let maxRef = '';
    let maxCant = 0;
    for (const [r, c] of Object.entries(conteo)) {
        if (c > maxCant) {
            maxCant = c;
            maxRef = r;
        }
    }
    return maxRef;
}

/**
 * Reglas de consistencia de referencias por bodega:
 * 1. PRIMERAS: Inconsistente si difiere de la referencia principal de Primeras.
 * 2. PROMOCIONES (SEGUNDAS): En promo SIEMPRE debe ser distinta a Primeras. Si es IGUAL a Primeras -> ERROR/ALERTA.
 * 3. OTRAS BODEGAS (COBROS, SIN CONFECCIONAR, etc.): Deben ser IGUALES a Primeras. Si es distinta -> ERROR/ALERTA.
 */
function validarInconsistenciaItem(item, refPrimeras, esRefVarOficial) {
    if (esRefVarOficial) return false; // En OP REFVAR oficial no hay error de discordancia individual
    if (!item) return false;

    const itemRef = (item.REFERENCIA || '').trim();
    if (!itemRef) return false;

    const bodega = (item.BODEGA || '').trim().toUpperCase();
    const refPri = (refPrimeras || '').trim();

    if (bodega === 'PRIMERAS') {
        // En Primeras: discordante si difiere de la referencia de Primeras
        return refPri ? (itemRef !== refPri) : false;
    } else if (bodega === 'PROMOCIONES' || bodega === 'SEGUNDAS') {
        // En Promociones: siempre debe ser distinta a Primeras. Alerta si es IGUAL a Primeras.
        return refPri ? (itemRef === refPri) : false;
    } else {
        // En cualquier otra bodega: debe coincidir con la de Primeras. Alerta si es DIFERENTE.
        return refPri ? (itemRef !== refPri) : false;
    }
}

function verificarInconsistenciasReferencias() {
    const header = document.getElementById('opEditorTableHeader');
    const btnRefVar = document.getElementById('btnConvertirRefVar');

    if (!currentOPData || currentOPData.length === 0) {
        if (header) header.classList.remove('refvar-alert-header');
        if (btnRefVar) btnRefVar.classList.remove('visible');
        return;
    }

    const primerItem = getRepresentativeItem(currentOPData);
    const refHeader = document.getElementById('opRefReadonly')?.value?.trim();
    const esRefVarOficial = (refHeader === 'REFVAR');

    // 1. Detección de REFVAR: APLICA EXCLUSIVAMENTE A PRIMERAS
    const itemsPrimeras = currentOPData.filter(i => (i.BODEGA || '').trim().toUpperCase() === 'PRIMERAS');
    const refsEnPrimeras = new Set(itemsPrimeras.map(i => (i.REFERENCIA || '').trim()).filter(Boolean));
    const esPosibleRefVar = refsEnPrimeras.size > 1 || refsEnPrimeras.has('REFVAR') || itemsPrimeras.some(i => i.REFPROV === 'REFVAR');

    const refPrimeras = obtenerReferenciaPrimeras(currentOPData);

    // 2. Comprobar si existe alguna inconsistencia en cualquier bodega según las reglas
    let hayInconsistencias = false;
    if (!esRefVarOficial) {
        hayInconsistencias = currentOPData.some(item => validarInconsistenciaItem(item, refPrimeras, false));
    }

    // Cabecera en rojo suave si hay alguna inconsistencia que requiere atención
    if (hayInconsistencias) {
        if (header) header.classList.add('refvar-alert-header');
    } else {
        if (header) header.classList.remove('refvar-alert-header');
    }

    // El botón "Hacer REFVAR" SOLO se muestra si el problema es en PRIMERAS (múltiples referencias en Primeras)
    if (esPosibleRefVar && !esRefVarOficial) {
        if (btnRefVar) btnRefVar.classList.add('visible');
    } else {
        if (btnRefVar) btnRefVar.classList.remove('visible');
    }

    // Si NO es posible REFVAR ni es REFVAR oficial: restaurar referencias limpias
    if (!esPosibleRefVar && !esRefVarOficial) {
        const refInput = document.getElementById('opRefReadonly');
        if (refInput && refInput.value === 'REFVAR' && refPrimeras) {
            refInput.value = refPrimeras;
        }

        currentOPData.forEach(item => {
            delete item.HR_REFERENCIA;
            delete item.HR_DESCRIPCION;
        });

        const descLarga = document.getElementById('opDescripcionLargaDisplay');
        if (descLarga && descLarga.textContent.includes('PRENDAS VARIAS')) {
            descLarga.textContent = primerItem.DESCRIPCION_LARGA || 'Sin descripción larga';
        }

        const prendaInput = document.getElementById('opPrendaEdit');
        if (prendaInput && prendaInput.value === 'VARIOS' && primerItem.PRENDA && primerItem.PRENDA !== 'VARIOS') {
            prendaInput.value = primerItem.PRENDA;
        }

        if (typeof window.actualizarOpcionEnSelectOP === 'function' && primerItem.OP) {
            window.actualizarOpcionEnSelectOP(primerItem.OP, false, refPrimeras);
        }
    } else if (esPosibleRefVar) {
        if (typeof window.actualizarOpcionEnSelectOP === 'function' && primerItem.OP) {
            window.actualizarOpcionEnSelectOP(primerItem.OP, true, 'REFVAR');
        }
    }
}

function homogeneizarReferencias() {
    const refMayoritaria = obtenerReferenciaMayoritaria();
    if (!refMayoritaria || !currentOPData) return;
    if (!confirm(`¿Deseas cambiar todas las referencias discordantes a la referencia mayoritaria '${refMayoritaria}'?`)) return;

    currentOPData.forEach(item => {
        item.REFERENCIA = refMayoritaria;
        delete item.HR_REFERENCIA;
        delete item.HR_DESCRIPCION;
    });

    const refInput = document.getElementById('opRefReadonly');
    if (refInput) refInput.value = refMayoritaria;

    renderResumenBodegas();
    if (typeof showMessage === 'function') showMessage(`Todas las extensiones se actualizaron a '${refMayoritaria}'`, 'success', 2500);
}

function convertirOPaRefVar() {
    if (!currentOPData || currentOPData.length === 0) return;
    if (!confirm('¿Deseas convertir oficialmente esta OP en REFVAR?\nLa referencia general será "REFVAR", pero cada fila conservará su referencia individual en el anexo HR.')) return;

    const primerItem = getRepresentativeItem(currentOPData);

    // Cambiar cabecera
    const refInput = document.getElementById('opRefReadonly');
    if (refInput) refInput.value = 'REFVAR';

    const descLarga = document.getElementById('opDescripcionLargaDisplay');
    if (descLarga) descLarga.textContent = 'PRENDAS VARIAS CHICA CHIC';

    const prendaInput = document.getElementById('opPrendaEdit');
    if (prendaInput && !prendaInput.value) prendaInput.value = 'VARIOS';

    // Marcar los ítems para que al guardar vayan identificados como REFVAR
    currentOPData.forEach(item => {
        item.HR_REFERENCIA = item.REFERENCIA || '';
        item.HR_DESCRIPCION = item.DESCRIPCION_LARGA || item.DESCRIPCION || '';
    });

    const header = document.getElementById('opEditorTableHeader');
    if (header) header.classList.remove('refvar-alert-header');
    const btnRefVar = document.getElementById('btnConvertirRefVar');
    if (btnRefVar) btnRefVar.classList.remove('visible');

    // Actualizar selector de OPs para mostrar REFVAR en rojo
    if (typeof window.actualizarOpcionEnSelectOP === 'function' && primerItem.OP) {
        window.actualizarOpcionEnSelectOP(primerItem.OP, true, 'REFVAR');
    }

    renderResumenBodegas();
    if (typeof showMessage === 'function') showMessage('OP configurada como REFVAR exitosamente', 'success', 2500);
}

window.obtenerReferenciaMayoritaria = obtenerReferenciaMayoritaria;
window.obtenerReferenciaPrimeras = obtenerReferenciaPrimeras;
window.validarInconsistenciaItem = validarInconsistenciaItem;
window.verificarInconsistenciasReferencias = verificarInconsistenciasReferencias;
window.convertirOPaRefVar = convertirOPaRefVar;

// ============================================
// AGREGAR NUEVA EXTENSIÓN A LA OP
// ============================================

function abrirModalNuevaExtension() {
    if (!currentOPData || currentOPData.length === 0) {
        if (typeof showMessage === 'function') showMessage('No hay una OP activa en el editor', 'warning', 2500);
        return;
    }

    const primerItem = getRepresentativeItem(currentOPData);
    const refMayoritaria = obtenerReferenciaMayoritaria();
    const refActual = document.getElementById('opRefReadonly')?.value?.trim() || refMayoritaria || primerItem.REFERENCIA || '';

    // Extraer curva de tallas únicas de la OP
    const tallasOP = [...new Set(currentOPData.map(i => (i.TALLA || '').trim()).filter(Boolean))];

    // Extraer colores únicos de la OP por NOMBRE (sin duplicar colores por barra o talla)
    const coloresOP = [];
    const nombresColoresVistos = new Set();
    currentOPData.forEach(i => {
        const nom = (i.COLORES || '').trim();
        if (nom && !nombresColoresVistos.has(nom.toUpperCase())) {
            nombresColoresVistos.add(nom.toUpperCase());
            coloresOP.push(nom);
        }
    });

    const modalId = 'modalNuevaExtension';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        document.body.appendChild(modal);
    }

    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:99999;';

    const bodegaOpts = Object.keys(bodegasMap).map(k => {
        const name = bodegasMap[k];
        return `<option value="${name}">${name}</option>`;
    }).join('');

    // Opciones de talla: SOLO las tallas reales únicas de la OP
    const tallasSelectOpts = tallasOP.map(t => `<option value="${t}">${t}</option>`).join('') +
        `<option value="__OTRA__">+ Escribir otra talla...</option>`;

    // Opciones de color: SOLO el nombre del color único (sin códigos ni duplicados)
    const coloresSelectOpts = coloresOP.map(nom => `<option value="${nom}">${nom}</option>`).join('') +
        `<option value="__OTRO__">+ Escribir otro color...</option>`;

    // Modal compacto que respeta el modo actual (claro/oscuro) mediante variables CSS del tema
    modal.innerHTML = `
        <div style="width: 440px; max-width: 95vw; background: var(--editor); color: var(--text); border-radius: 6px; border: 1px solid var(--border); box-shadow: 0 8px 32px rgba(0,0,0,0.25); overflow: hidden; animation: popIn 0.15s ease;">
            <div style="padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; background: var(--sidebar); color: var(--text);">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px;">
                    <i class="codicon codicon-add" style="color: var(--primary);"></i>
                    <span>Agregar Extensión a OP ${primerItem.OP || ''}</span>
                </div>
                <button class="btn-icon" onclick="cerrarModalNuevaExtension()"><i class="codicon codicon-close"></i></button>
            </div>
            <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; background: var(--editor);">
                <div class="form-group" style="margin: 0;">
                    <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Referencia de la Prenda</label>
                    <input type="text" id="extRef" class="form-control" value="${refActual}" placeholder="Referencia de la prenda">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Talla *</label>
                        <select id="extTallaSelect" class="form-control" onchange="window.onTallaSelectChange(this.value)">
                            ${tallasSelectOpts}
                        </select>
                        <input type="text" id="extTallaCustom" class="form-control" placeholder="Escriba otra talla" style="display:none; margin-top:6px;">
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Color *</label>
                        <select id="extColorSelect" class="form-control" onchange="window.onColorSelectChange(this.value)">
                            ${coloresSelectOpts}
                        </select>
                        <input type="text" id="extColorCustom" class="form-control" placeholder="Escriba otro color" style="display:none; margin-top:6px;">
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Bodega</label>
                        <select id="extBodega" class="form-control">${bodegaOpts}</select>
                    </div>
                    <div class="form-group" style="margin: 0;">
                        <label style="font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; display: block;">Cantidad (uds) *</label>
                        <input type="number" id="extCantidad" class="form-control" min="1" step="1" value="1" required>
                    </div>
                </div>
            </div>
            <div style="padding: 12px 16px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; background: var(--sidebar);">
                <button class="btn-secondary" onclick="cerrarModalNuevaExtension()">Cancelar</button>
                <button class="btn-primary" onclick="guardarNuevaExtension()">
                    <i class="codicon codicon-check"></i> Agregar Extensión
                </button>
            </div>
        </div>
    `;

    modal.style.display = 'flex';
}

window.onTallaSelectChange = function(val) {
    const custom = document.getElementById('extTallaCustom');
    if (!custom) return;
    if (val === '__OTRA__') {
        custom.style.display = 'block';
        custom.value = '';
        custom.focus();
    } else {
        custom.style.display = 'none';
        custom.value = '';
    }
};

window.onColorSelectChange = function(val) {
    const custom = document.getElementById('extColorCustom');
    if (!custom) return;
    if (val === '__OTRO__') {
        custom.style.display = 'block';
        custom.value = '';
        custom.focus();
    } else {
        custom.style.display = 'none';
        custom.value = '';
    }
};

function cerrarModalNuevaExtension() {
    const modal = document.getElementById('modalNuevaExtension');
    if (modal) modal.style.display = 'none';
}

function guardarNuevaExtension() {
    if (!currentOPData || currentOPData.length === 0) return;

    const ref = document.getElementById('extRef')?.value?.trim();
    
    // Obtener talla
    const tallaSelect = document.getElementById('extTallaSelect')?.value || '';
    const tallaCustom = document.getElementById('extTallaCustom')?.value?.trim().toUpperCase();
    const talla = (tallaSelect === '__OTRA__' ? tallaCustom : tallaSelect)?.toUpperCase();

    // Obtener color (el selector muestra solo NOMBRE; el COD_COLOR se resuelve internamente)
    const colorSelectEl = document.getElementById('extColorSelect');
    const colorSelectVal = colorSelectEl?.value || '';
    const colorCustomRaw = document.getElementById('extColorCustom')?.value?.trim() || '';

    let nombreColor = '';

    if (colorSelectVal === '__OTRO__') {
        nombreColor = colorCustomRaw.toUpperCase();
    } else {
        nombreColor = colorSelectVal; // Ya es el nombre limpio
    }

    // Resolver COD_COLOR internamente: buscar en currentOPData la fila que coincida
    // talla + nombre color. Si no hay match (talla/color nuevo), codColor queda vacío.
    let codColor = '';
    if (talla && nombreColor) {
        const matchRow = currentOPData.find(i =>
            (i.TALLA || '').trim().toUpperCase() === talla.toUpperCase() &&
            (i.COLORES || '').trim().toUpperCase() === nombreColor.toUpperCase()
        );
        if (matchRow) {
            codColor = (matchRow.COD_COLOR || '').trim();
        }
        // Si no hay match (combinación nueva), codColor queda ''
    }

    const bodega = document.getElementById('extBodega')?.value || 'PRIMERAS';
    const cantidad = parseInt(document.getElementById('extCantidad')?.value) || 0;

    if (!talla || !nombreColor || cantidad <= 0) {
        if (typeof showMessage === 'function') showMessage('Completa talla, color y una cantidad mayor a 0', 'warning', 2500);
        return;
    }

    // Buscar si ya existe una fila con la misma combinación talla + color + bodega
    const filaExistente = currentOPData.find(i =>
        (i.TALLA || '').trim().toUpperCase() === talla.toUpperCase() &&
        (i.COLORES || '').trim().toUpperCase() === nombreColor.toUpperCase() &&
        (i.BODEGA || '').trim().toUpperCase() === bodega.trim().toUpperCase()
    );

    if (filaExistente) {
        // Sumar cantidad a la fila existente en lugar de crear una nueva
        const cantidadAnterior = Number(filaExistente.CANTIDAD) || 0;
        filaExistente.CANTIDAD = cantidadAnterior + cantidad;
        updateEditorStats();
        renderResumenBodegas();
        cerrarModalNuevaExtension();
        if (typeof showMessage === 'function') {
            showMessage(
                `Se sumaron ${cantidad} uds a la extensión existente: ${talla} - ${nombreColor} en ${bodega} → Total: ${filaExistente.CANTIDAD} uds`,
                'info',
                3500
            );
        }
        return;
    }

    // Combinación nueva: crear fila
    const primerItem = getRepresentativeItem(currentOPData);
    const costoUnit = (bodega === 'SIN CONFECCIONAR') ? 0 : getCostoPrimeras(primerItem.OP);

    const nuevoItem = {
        ...primerItem,
        REFERENCIA: ref || primerItem.REFERENCIA || '',
        TALLA: talla,
        COLORES: nombreColor,
        COD_COLOR: codColor,
        BODEGA: bodega,
        CANTIDAD: cantidad,
        COSTO: costoUnit
    };

    currentOPData.push(nuevoItem);
    updateEditorStats();
    renderResumenBodegas();
    cerrarModalNuevaExtension();

    if (typeof showMessage === 'function') {
        showMessage(`Extensión creada: ${talla} - ${nombreColor} (${cantidad} uds en ${bodega})`, 'success', 2500);
    }
}

window.abrirModalNuevaExtension = abrirModalNuevaExtension;
window.cerrarModalNuevaExtension = cerrarModalNuevaExtension;
window.guardarNuevaExtension = guardarNuevaExtension;

function toggleSelectAll(blockId, checked) {
    document.querySelectorAll(`.row-check-${blockId}`).forEach(cb => cb.checked = checked);
    onRowCheckChange(blockId);
}

function onRowCheckChange(blockId) {
    const anyChecked = Array.from(document.querySelectorAll(`.row-check-${blockId}`)).some(cb => cb.checked);
    const btn = document.getElementById(`btn-delete-sel-${blockId}`);
    if (btn) btn.style.display = anyChecked ? 'inline-flex' : 'none';
}

function deleteSelectedRows(blockId) {
    const checked = Array.from(document.querySelectorAll(`.row-check-${blockId}:checked`));
    if (checked.length === 0) return;

    if (!confirm(`¿Eliminar ${checked.length} registro(s) seleccionado(s)?`)) return;

    // Recoger índices en orden descendente para no desplazar al hacer splice
    const indices = checked.map(cb => parseInt(cb.dataset.index)).sort((a, b) => b - a);
    indices.forEach(i => currentOPData.splice(i, 1));

    updateEditorStats();

    const expandedStates = {};
    document.querySelectorAll('[id^="detalle-"]').forEach((row) => {
        const match = row.id.match(/\d+$/);
        if (match) expandedStates[match[0]] = row.style.display !== 'none';
    });

    renderResumenBodegas();

    setTimeout(() => {
        Object.keys(expandedStates).forEach(idx => {
            if (expandedStates[idx]) {
                const detalleRow = document.getElementById(`detalle-${idx}`);
                const icon = document.getElementById(`toggle-icon-${idx}`);
                if (detalleRow) detalleRow.style.display = 'table-row';
                if (icon) icon.style.transform = 'rotate(90deg)';
            }
        });
    }, 0);
}

// Helpers de cambio de pestaña movidos a tabs.js (global)

// ============================================
// AJUSTES DE CAMPOS
// ============================================

function adjustPVP(amount) {
    const pvpInput = document.getElementById('pvpEdit');
    let currentValue = parseInt(pvpInput.value.replace(/\./g, '')) || 0;
    currentValue += amount;
    if (currentValue < 0) currentValue = 0;
    pvpInput.value = currentValue;
}

function adjustBolsas(amount) {
    const bolsasInput = document.getElementById('bolsas');
    let currentValue = parseInt(bolsasInput.value) || 0;
    currentValue += amount;
    if (currentValue < 0) currentValue = 0;
    bolsasInput.value = currentValue;
}

// ============================================
// GENERACIÓN DE JSON
// ============================================

function generateJSONForOP(skipSave = false) {
    if (!currentOPData || currentOPData.length === 0) {
        showMessage('No hay datos de OP cargados', 'error', 2000);
        return;
    }

    // LIMPIAR ERRORES PREVIOS
    document.querySelectorAll('.form-control.has-error').forEach(el => el.classList.remove('has-error'));

    const proveedorEl = document.getElementById('proveedor');
    const auditorEl = document.getElementById('auditor');
    const gestorEl = document.getElementById('gestor');
    const escanerEl = document.getElementById('escanerEdit');
    const pvpEl = document.getElementById('pvpEdit');

    let hasError = false;
    const reqFields = [proveedorEl, auditorEl, gestorEl, escanerEl, pvpEl];
    reqFields.forEach(el => {
        if (el && (!el.value || el.value.trim() === '')) {
            el.classList.add('has-error');
            hasError = true;
        }
    });

    if (hasError) {
        if (typeof showMessage === 'function') {
            showMessage('Por favor complete todos los campos requeridos (marcados en rojo)', 'error', 3000);
        }
        return;
    }

    const proveedor = proveedorEl.value;
    const auditor = auditorEl.value;
    const gestor = gestorEl.value;
    const escaner = escanerEl ? escanerEl.value : '';
    const bolsas = parseInt(document.getElementById('bolsas').value) || 0;
    const pvpEdit = document.getElementById('pvpEdit').value;
    
    // Obtener PRENDA, GÉNERO y LÍNEA editados
    const prendaEdit = document.getElementById('opPrendaEdit')?.value || '';
    const generoEdit = document.getElementById('opGeneroEdit')?.value || '';
    const lineaEdit = document.getElementById('opLineaEdit')?.value || '';

    if (!proveedor || !auditor || !gestor || !pvpEdit) {
        showMessage('Por favor complete todos los campos requeridos', 'error', 2000);
        return;
    }

    if (!escaner) {
        showMessage('Debe seleccionar un Usuario/Escaner', 'error', 2000);
        return;
    }
    
    // Validar PRENDA, GÉNERO y LÍNEA
    if (!prendaEdit || !generoEdit || !lineaEdit) {
        showMessage('Por favor complete PRENDA, GÉNERO y LÍNEA', 'error', 2000);
        return;
    }

    const primerItem = getRepresentativeItem(currentOPData);
    const items = currentOPData;
    const cantidad = parseInt(primerItem.TOTAL) || 0;

    // Referencia editada en la cabecera
    const refEditadaHeader = document.getElementById('opRefReadonly')?.value?.trim() || primerItem.REFERENCIA;
    const esRefVarOP = (refEditadaHeader === 'REFVAR');

    let cantidadFull = 0, cantidadPromo = 0, cantidadCobros = 0, cantidadSinConfeccionar = 0;
    let costoTotal = 0;
    const hr = [];
    const anexos = [];

    items.forEach(item => {
        const cantItem = parseInt(item.CANTIDAD) || 0;
        const costoUnitario = parseFloat(item.COSTO) || 0;
        const costoTOTAL = costoUnitario * cantItem;

        if (item.BODEGA === 'PRIMERAS') {
            cantidadFull += cantItem;
            costoTotal += costoTOTAL; // Solo PRIMERAS suma al costo total
            
            const hrEntry = {
                codigo_color: item.COD_COLOR || '',
                color: item.COLORES || '',
                talla: item.TALLA || '',
                cantidad: cantItem
            };

            // SOLO los REFVAR guardan referencia y descripcion en el HR
            if (esRefVarOP || item.REFERENCIA === 'REFVAR' || item.REFERENCIA_HISTORICA === 'REFVAR') {
                hrEntry.referencia = item.HR_REFERENCIA || item.REFERENCIA || '';
                hrEntry.descripcion = item.HR_DESCRIPCION || item.DESCRIPCION_LARGA || item.DESCRIPCION || '';
            }

            hr.push(hrEntry);
        }
        else if (item.BODEGA === 'PROMOCIONES') {
            cantidadPromo += cantItem;
            costoTotal += costoTOTAL; // PROMOCIONES suma al costo total
            anexos.push({
                DOCUMENTO: item.REFERENCIA || refEditadaHeader || '',
                TALLA: item.TALLA,
                COLOR: item.COLORES,
                TIPO: 'PROMO',
                CANTIDAD: cantItem,
                COSTO_UNITARIO: costoUnitario,
                COSTO_TOTAL: costoTOTAL,
                BODEGA: item.BODEGA,
                TRASLADO: item.TRASLADO
            });
        }
        else if (item.BODEGA === 'COBROS') {
            cantidadCobros += cantItem;
            costoTotal += costoTOTAL; // COBROS suma al costo total
            anexos.push({
                DOCUMENTO: item.REFERENCIA || refEditadaHeader || '',
                TALLA: item.TALLA,
                COLOR: item.COLORES,
                TIPO: 'COBRO',
                CANTIDAD: cantItem,
                COSTO_UNITARIO: costoUnitario,
                COSTO_TOTAL: costoTOTAL,
                BODEGA: item.BODEGA,
                TRASLADO: item.TRASLADO
            });
        }
        else if (item.BODEGA === 'SIN CONFECCIONAR') {
            cantidadSinConfeccionar += cantItem;
            // SIN CONFECCIONAR NUNCA suma al costoTotal
            anexos.push({
                DOCUMENTO: item.REFERENCIA || refEditadaHeader || '',
                TALLA: item.TALLA,
                COLOR: item.COLORES,
                TIPO: 'SIN_CONFECCIONAR',
                CANTIDAD: cantItem,
                COSTO_UNITARIO: 0,
                COSTO_TOTAL: 0,
                BODEGA: item.BODEGA,
                TRASLADO: item.TRASLADO
            });
        }
    });

    const totalRelativo = cantidadFull + cantidadPromo + cantidadCobros;
    const totalGeneral = cantidadFull + cantidadPromo + cantidadCobros + cantidadSinConfeccionar;
    const diferencia = cantidad - totalGeneral;
    // COSTO_UNITARIO: valor directo del primer item DI/PRIMERAS
    const costoUnitario = getCostoPrimeras(primerItem.OP);
    const sumatoria = totalGeneral;

    // Distinción estricta entre REFERENCIA y REFPROV
    // 1. REFERENCIA: Código interno o histórico
    const referenciaHistorica = esRefVarOP
        ? 'REFVAR'
        : ((typeof getReferenciaHistorica === 'function') ? getReferenciaHistorica(refEditadaHeader) : refEditadaHeader);

    // 2. REFPROV: Referencia de proveedor (o REFVAR si aplica)
    const refProvFinal = esRefVarOP
        ? 'REFVAR'
        : (primerItem.REFPROV || primerItem.REFERENCIA_PROV || primerItem.REFERENCIA || refEditadaHeader);

    const marca = getMarca(generoEdit);
    const clase = getClaseByPVP(pvpEdit);

    // 3. DESCRIPCIÓN: 'PRENDAS VARIAS CHICA CHIC' para REFVAR, o con refprov al final
    const descripcion = esRefVarOP
        ? 'PRENDAS VARIAS CHICA CHIC'
        : getDescripcion(prendaEdit, generoEdit, marca, refProvFinal);

    const auditoriaNum = parseInt(primerItem.CC) || 0;
    const osNum = parseInt(primerItem.OS) || 0;
    const trasladoNum = parseInt(primerItem.TRASLADO) || 0;
    const pvpString = pvpEdit;
    const loteNum = parseInt(document.getElementById('opLoteEdit')?.value || primerItem.OP) || 0;

    const jsonData = {
        "A": primerItem.OP_SUFIJO || primerItem.OP,
        "FECHA": primerItem.FECHA,
        "TALLER": primerItem.TALLER,
        "LINEA": lineaEdit,
        "AUDITOR": auditor,
        "GESTOR": gestor,
        "ESCANER": escaner,
        "LOTE": loteNum,
        "REFPROV": refProvFinal,
        "DESCRIPCIÓN": descripcion,
        "DESCRIPCIÓN_LARGA": primerItem.DESCRIPCION_LARGA,
        "CANTIDAD": cantidadFull + cantidadPromo,
        "TOTAL_RELATIVO": totalRelativo,
        "COSTO_UNITARIO": costoUnitario,
        "COSTO_TOTAL": costoTotal,
        "TOTAL_GENERAL": totalGeneral,
        "DIFERENCIA": diferencia,
        "AUDITORIA": auditoriaNum,
        "ORDEN_SERVICIO": osNum,
        "TRASLADO": trasladoNum,
        "OTROS_TRASLADOS": (() => {
            if (!lastCsvRows) return [];
            const opStr = (primerItem.OP || '').toString().trim();
            const set = new Set();
            for (let i = 0; i < lastCsvRows.length; i++) {
                const row = lastCsvRows[i];
                if (row.length < 8) continue;
                if ((row[2] || '').toString().trim() !== opStr) continue;
                const t = extractTrasladoNumber(row[7] || '');
                if (t) set.add(t.toString().trim());
            }
            set.delete(trasladoNum.toString());
            return Array.from(set);
        })(),
        "REFERENCIA": referenciaHistorica,
        "TIPO": "FULL",
        "PVP": pvpString,
        "CLASE": clase,
        "PRENDA": prendaEdit,  // Usar prenda editada
        "GENERO": generoEdit,  // Usar género editado
        "MARCA": marca,
        "PROVEEDOR": proveedor,
        "BOLSAS": bolsas,
        "ANEXOS": anexos,
        "HR": hr,
        "DETALLE_CANTIDADES": {
            "TOTAL": sumatoria,
            "FULL": cantidadFull,
            "PROMO": cantidadPromo,
            "COBRO": cantidadCobros,
            "SIN_CONFECCIONAR": cantidadSinConfeccionar
        }
    };

    const jsonStr = JSON.stringify(jsonData, null, 2);
    const jsonContentEl = document.getElementById('jsonContent');
    if (jsonContentEl) {
        jsonContentEl.innerHTML = syntaxHighlightJSON(jsonStr);
    }

    document.getElementById('saveBtn').style.display = 'inline-flex';
    document.getElementById('saveBtnToolbar').style.display = 'flex';

    if (skipSave) {
        if (typeof showJsonViewer === 'function') {
            showJsonViewer();
        }
    } else {
        // Se salta el editor JSON innecesario visualmente y se dispara directamente el modal de confirmación
        saveToSheets();
    }
}

/**
 * Aplica resaltado de sintaxis HTML a una cadena JSON
 */
function syntaxHighlightJSON(json) {
    if (typeof json !== 'string') {
        json = JSON.stringify(json, undefined, 2);
    }

    // Escapar caracteres HTML básicos
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Expresión regular para encontrar tokens JSON
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json-key';
            } else {
                cls = 'json-string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        }

        // Si es una clave, no queremos el colon dentro del span si queremos que sea estético
        if (cls === 'json-key') {
            return '<span class="' + cls + '">' + match.slice(0, -1) + '</span>:';
        }

        return '<span class="' + cls + '">' + match + '</span>';
    });
}

function generateJSONFromEditor(skipSave = false) {
    const proveedor = document.getElementById('proveedor').value;
    const auditor = document.getElementById('auditor').value;
    const gestor = document.getElementById('gestor').value;
    const escanerSelect = document.getElementById('escanerEdit');
    const escaner = escanerSelect ? escanerSelect.value : '';
    const pvpEdit = document.getElementById('pvpEdit').value;

    if (!proveedor || !auditor || !gestor || !pvpEdit) {
        showMessage('Por favor complete la información de cabecera', 'warning', 4000);
        return;
    }

    if (!escaner) {
        showMessage('Debe seleccionar un Usuario/Escaner', 'warning', 4000);
        return;
    }

    generateJSONForOP(skipSave);
}

// ============================================
// GUARDAR EN SHEETS
// ============================================

async function saveToSheets() {
    const jsonContent = document.getElementById('jsonContent');
    const fileInput = document.getElementById('csvFile');

    if (!currentOPData || currentOPData.length === 0) {
        showMessage('No hay datos de OP cargados', 'error', 2000);
        return;
    }

    let jsonData;
    try {
        jsonData = JSON.parse(jsonContent.textContent);
    } catch (e) {
        showMessage('Error al leer los datos JSON', 'error', 2000);
        return;
    }

    const diferencia = jsonData.DIFERENCIA || 0;
    const accentColor = diferencia > 0 ? 'var(--warning)' : 'var(--success)';
    const tableData = [
        { label: 'Primeras (DI)', value: jsonData.DETALLE_CANTIDADES?.FULL || 0 },
        { label: 'Promociones (ZZ)', value: jsonData.DETALLE_CANTIDADES?.PROMO || 0 },
        { label: 'Cobros (BP)', value: jsonData.DETALLE_CANTIDADES?.COBRO || 0 },
        { label: 'Sin Confeccionar (ZY)', value: jsonData.DETALLE_CANTIDADES?.SIN_CONFECCIONAR || 0 }
    ];

    const costoFormateado = `$ ${jsonData.COSTO_TOTAL.toLocaleString('es-CO')}`;

    // Fila sutil y armónica sincronizada con el color del modal
    const tableFooterHTML = `
        <tr>
            <td style="text-align: center; padding: 12px; color: var(--text-secondary); font-weight: 600; font-size: 11px;">COSTO TOTAL</td>
            <td style="text-align: center; padding: 12px; color: ${accentColor}; font-weight: 700; font-size: 15px;">${costoFormateado}</td>
        </tr>
    `;

    const messageHtml = diferencia > 0
        ? `Hay <strong style="color: var(--warning);">${diferencia} unidades faltantes</strong> en esta orden de producción.<br><br>Detalle de unidades procesadas:`
        : `La orden de producción está <strong>completa</strong> (sin unidades faltantes).<br><br>Detalle de unidades:`;

    const confirmed = await showQuickConfirm(
        diferencia > 0 ? 'Unidades Faltantes' : 'Confirmar Guardado',
        messageHtml,
        diferencia > 0 ? 'Sí, Guardar' : 'Sí, Guardar',
        'Cancelar',
        diferencia > 0 ? 'warning' : 'success',
        tableData,
        tableFooterHTML,
        '' // extraInfo vacío porque ya movimos la info arriba
    );

    const modalAbierto = document.querySelector('.modal');
    if (modalAbierto) {
        modalAbierto.remove();
    }

    if (!confirmed) return;

    const loading = showQuickLoading('Guardando en Supabase...');
    const saveBtn = document.getElementById('saveBtn');
    const saveBtnToolbar = document.getElementById('saveBtnToolbar');

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loading-spinner"></span> Guardando...';
    }
    if (saveBtnToolbar) {
        saveBtnToolbar.disabled = true;
        saveBtnToolbar.innerHTML = '<span class="loading-spinner"></span>';
    }

    try {
        // NUEVO: Verificar autenticación antes de guardar
        const isAuthenticated = await ensureSupabaseAuth();
        
        if (!isAuthenticated) {
            showMessage('Debes iniciar sesión para guardar en Supabase', 'warning', 2000);
            return;
        }

        // Guardar en Supabase
        Logger.info('op-editor', `Guardando OP ${jsonData.A} en Supabase...`);
        
        const supabaseResult = await saveToSisproInversiones(currentOPData);
        
        if (supabaseResult.success) {
            // Notificar éxito del guardado
            showMessage(`OP ${jsonData.A} guardada exitosamente en Supabase (${supabaseResult.count} registros)`, 'success', 2000);

            // Limpiar UI y eliminar OP del listado (inmediato)
            resetUIAfterSave(jsonData.A);
            switchToPendingOpsTab();

            updateStatus(
                diferencia > 0
                    ? `OP ${jsonData.A} guardada con ${diferencia} unidades faltantes`
                    : `OP ${jsonData.A} guardada exitosamente`,
                diferencia > 0 ? 'warning' : 'success'
            );

            // Recargar datos en segundo plano (silencioso)
            reloadDataInBackgroundSilent();
        } else {
            showMessage('Error al guardar en Supabase', 'error', 3000);
        }
    } catch (error) {
        Logger.error('op-editor', 'Error guardando en Supabase', error);
        showMessage('Error: ' + error.message, 'error', 3000);
    } finally {
        loading.close();
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="codicon codicon-save"></i> Guardar';
        }
        if (saveBtnToolbar) {
            saveBtnToolbar.disabled = false;
            saveBtnToolbar.innerHTML = '<i class="codicon codicon-cloud-upload"></i>';
        }
    }
}

/**
 * Recarga todos los datos necesarios en segundo plano de manera silenciosa
 * Esto incluye reinicializar el módulo de distribución para que tenga datos actualizados
 */
async function reloadDataInBackgroundSilent() {
    try {
        Logger.info('op-editor', '🔄 Recargando todos los datos en segundo plano...');

        // Recargar todos los datos y reinicializar módulos (modo silencioso)
        // Recargar solo data2 de los lotes que ya están en memoria (on-demand)
        // Colores/precios/historicas ya están cargados del archivo actual — no recargar todo el catálogo.
        const lotesActuales = processedData
            ? [...new Set(processedData.map(d => String(d.OP || '').trim()).filter(Boolean))]
            : [];
        await loadData2Data(lotesActuales);
        Logger.success('op-editor', '✅ Datos esenciales actualizados (data2 on-demand)');
    } catch (error) {
        Logger.error('op-editor', 'Error recargando datos en segundo plano', error);
        // No mostrar error al usuario, es un proceso en segundo plano
    }
}

function resetUIAfterSave(opGuardada) {
    const selectOP = document.getElementById('selectOP');
    const pendientesSection = document.getElementById('pendientesSection');
    const pendingOpsEmptyState = document.getElementById('pendingOpsEmptyState');

    // Limpiar currentOPData
    setCurrentOPData(null);

    // Eliminar la opción de la OP guardada del listado
    if (opGuardada && selectOP) {
        // Buscar la opción que corresponde a la OP guardada
        for (let i = selectOP.options.length - 1; i >= 0; i--) {
            const option = selectOP.options[i];
            if (option.value && option.dataset.items) {
                try {
                    const items = JSON.parse(option.dataset.items);
                    const opValue = items[0]?.OP?.toString() || items[0]?.OP_SUFIJO?.toString();
                    const opGuardadaStr = opGuardada.toString();

                    // Comparar tanto OP como OP_SUFIJO (para parciales)
                    if (opValue === opGuardadaStr || items[0]?.OP?.toString() === opGuardadaStr) {
                        selectOP.remove(i);
                        Logger.info('op-editor', `✅ OP ${opGuardada} eliminada del listado`);
                        break;
                    }
                } catch (e) {
                    Logger.warn('op-editor', `Error parseando items de opción: ${e.message}`);
                }
            }
        }
    }

    // ACTUALIZAR STATUS-BAR EN TIEMPO REAL
    if (typeof updateStatusBarFromSelect === 'function') {
        updateStatusBarFromSelect();
    }

    // Verificar si quedan OPs pendientes (excluyendo la opción por defecto)
    const remainingOPs = selectOP ? selectOP.options.length - 1 : 0; // -1 para excluir "Seleccione una OP..."

    if (remainingOPs === 0) {
        // No quedan OPs pendientes - mostrar empty state
        Logger.info('op-editor', '📭 No quedan OPs pendientes - mostrando empty state');

        if (pendientesSection) pendientesSection.style.display = 'none';
        if (pendingOpsEmptyState) pendingOpsEmptyState.style.display = 'flex';
    } else {
        // Aún quedan OPs pendientes
        Logger.info('op-editor', `📋 Quedan ${remainingOPs} OP(s) pendientes`);
    }

    // Resetear select a opción por defecto
    if (selectOP) {
        selectOP.value = '';
        // Disparar evento change para limpiar todo
        selectOP.dispatchEvent(new Event('change'));
    }

    // Limpiar formulario
    const opForm = document.getElementById('opForm');
    const auditor = document.getElementById('auditor');
    const gestor = document.getElementById('gestor');
    const escanerEdit = document.getElementById('escanerEdit');
    const bolsas = document.getElementById('bolsas');
    const pvpEdit = document.getElementById('pvpEdit');
    const saveBtn = document.getElementById('saveBtn');
    const saveBtnToolbar = document.getElementById('saveBtnToolbar');
    const jsonContent = document.getElementById('jsonContent');
    const opPreview = document.getElementById('opPreview');
    const opEditorContainer = document.getElementById('opEditorContainer');
    const opEditorEmptyState = document.getElementById('opEditorEmptyState');

    if (opForm) opForm.style.display = 'none';
    if (auditor) auditor.value = '';
    if (gestor) gestor.value = '';
    if (escanerEdit) escanerEdit.innerHTML = '<option value="">Seleccione un usuario...</option>';
    if (bolsas) bolsas.value = '0';
    if (pvpEdit) pvpEdit.value = '';
    if (saveBtn) saveBtn.style.display = 'none';
    if (saveBtnToolbar) saveBtnToolbar.style.display = 'none';

    // Limpiar JSON viewer
    if (jsonContent) {
        jsonContent.textContent = '{\n  "mensaje": "Genera un JSON desde el Editor OP"\n}';
    }
    collapseJsonViewer();

    // Ocultar editor y mostrar empty state
    hideEditor();
    if (opEditorContainer) opEditorContainer.style.display = 'none';
    if (opEditorEmptyState) opEditorEmptyState.style.display = 'block';

    // Limpiar preview
    if (opPreview) {
        opPreview.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-magnifying-glass empty-icon"></i>
                <h5>Sin vista previa</h5>
                <p>Selecciona una OP del listado para ver sus detalles.</p>
            </div>
        `;
    }
}

// ============================================
// REFRESCAR OPCIONES DINÁMICAS
// ============================================

async function refreshDynamicOptions() {
    Logger.info('op-editor', '🔄 Recargando opciones dinámicas...');

    const loading = showQuickLoading('Recargando configuración...');

    try {
        // Cargar datos silenciosamente para evitar doble notificación
        await loadDataFromSheets(true);
        showMessage('Configuración recargada correctamente', 'success', 2000);
    } catch (error) {
        console.error('Error recargando configuración:', error);
        showMessage('Error al recargar configuración', 'error', 3000);
    } finally {
        loading.close();
    }
}

// ============================================
// EXPONER FUNCIONES GLOBALMENTE
// ============================================

window.handleEditorChange = handleEditorChange;
window.deleteEditorRow = deleteEditorRow;
window.adjustQty = adjustQty;
window.toggleSelectAll = toggleSelectAll;
window.onRowCheckChange = onRowCheckChange;
window.deleteSelectedRows = deleteSelectedRows;
window.toggleDetalle = toggleDetalle;
window.colapsarDetalle = colapsarDetalle;
window.expandirTodo = expandirTodo;
window.colapsarTodo = colapsarTodo;
window.handleResumenClick = handleResumenClick;
window.refreshDynamicOptions = refreshDynamicOptions;
window.loadAllDynamicOptions = loadAllDynamicOptions;
window.loadUsuariosOptions = loadUsuariosOptions;
window.refreshLineaFromActiveNIT = refreshLineaFromActiveNIT;
window.getGestorByLinea          = getGestorByLinea;
window.autoSelectGestorByLinea   = autoSelectGestorByLinea;