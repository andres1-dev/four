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

function loadAllDynamicOptions() {
    // Ya no se necesita loadProveedoresOptions() porque es un input bloqueado
    loadAuditoresOptions();
    loadGestoresOptions();
    loadUsuariosOptions();
    
    // Sincronizar proveedor activo con el input
    if (typeof window.syncProveedorToSelect === 'function') {
        window.syncProveedorToSelect();
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
    if (gestorSelect && primerItem.LINEA) {
        const linea = primerItem.LINEA.toUpperCase().trim();
        let gestorNombre = '';
        
        if (linea === 'ANGELES') {
            gestorNombre = 'LUIS VILLAMIZAR GOMEZ';
        } else if (linea === 'ESPECIALES' || linea === 'BOGOTA') {
            gestorNombre = 'JUAN ESTEBAN ZULUAGA HOYOS';
        } else {
            gestorNombre = 'KELLY GIOVANA ZULUAGA HOYOS';
        }
        
        const options = Array.from(gestorSelect.options);
        const matchingOption = options.find(opt => opt.value === gestorNombre);
        if (matchingOption) {
            matchingOption.selected = true;
            Logger.info('op-editor', `👤 Gestor autoseleccionado según línea ${linea}: ${gestorNombre}`);
        }
    }

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

    if (opInput) opInput.value = primerItem.OP || '';
    if (refInput) refInput.value = primerItem.REFERENCIA || '';
    
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
    return `
        <div class="detalle-table-wrapper">
            <table class="detalle-table">
                <thead>
                    <tr>
                        <th style="width: 32px; text-align: center;">#</th>
                        <th style="width: 80px;">Talla</th>
                        <th>Color</th>
                        <th>Bodega</th>
                        <th style="text-align: right; width: 120px;">Cantidad</th>
                        <th>Traslado</th>
                        <th style="text-align: center; width: 48px;">Acción</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item) => {
                        const globalIndex = currentOPData.indexOf(item);
                        const bodegaOptions = Object.keys(bodegasMap).map(code => {
                            const name = bodegasMap[code];
                            const isSelected = (item.BODEGA === name) || (item.BODEGA === code);
                            return `<option value="${name}" ${isSelected ? 'selected' : ''}>${name}</option>`;
                        }).join('');
                        return `
                            <tr>
                                <td style="text-align: center;">
                                    <input type="checkbox" class="row-check-${blockId}"
                                           data-index="${globalIndex}"
                                           onchange="window.onRowCheckChange('${blockId}')">
                                </td>
                                <td style="font-weight: 700; color: var(--primary);">${item.TALLA}</td>
                                <td style="color: var(--text-secondary);">${item.COLORES || item.COD_COLOR}</td>
                                <td>
                                    <select class="editor-select"
                                            onchange="window.handleEditorChange(${globalIndex}, 'BODEGA', this.value)">
                                        ${bodegaOptions}
                                    </select>
                                </td>
                                <td>
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
            // Actualizar visualmente el header de la bodega actual
            actualizarHeaderBodegaVisual(item.BODEGA);
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

    let cantidadFull = 0, cantidadPromo = 0, cantidadCobros = 0, cantidadSinConfeccionar = 0;
    let costoTotal = 0;
    const hr = [];
    const anexos = [];

    items.forEach(item => {
        const costoUnitario = parseInt(item.COSTO) || 0;
        const costoTOTAL = costoUnitario * item.CANTIDAD;

        if (item.BODEGA === 'PRIMERAS') {
            cantidadFull += item.CANTIDAD;
            costoTotal += costoTOTAL; // Solo PRIMERAS suma al costo total
            hr.push([item.COD_COLOR, item.COLORES, item.TALLA, item.CANTIDAD]);
        }
        else if (item.BODEGA === 'PROMOCIONES') {
            cantidadPromo += item.CANTIDAD;
            costoTotal += costoTOTAL; // PROMOCIONES suma al costo total
            anexos.push({
                DOCUMENTO: item.REFERENCIA,
                TALLA: item.TALLA,
                COLOR: item.COLORES,
                TIPO: 'PROMO',
                CANTIDAD: item.CANTIDAD,
                COSTO_UNITARIO: costoUnitario,
                COSTO_TOTAL: costoTOTAL,
                BODEGA: item.BODEGA,
                TRASLADO: item.TRASLADO
            });
        }
        else if (item.BODEGA === 'COBROS') {
            cantidadCobros += item.CANTIDAD;
            costoTotal += costoTOTAL; // COBROS suma al costo total
            anexos.push({
                DOCUMENTO: item.REFERENCIA,
                TALLA: item.TALLA,
                COLOR: item.COLORES,
                TIPO: 'COBRO',
                CANTIDAD: item.CANTIDAD,
                COSTO_UNITARIO: costoUnitario,
                COSTO_TOTAL: costoTOTAL,
                BODEGA: item.BODEGA,
                TRASLADO: item.TRASLADO
            });
        }
        else if (item.BODEGA === 'SIN CONFECCIONAR') {
            cantidadSinConfeccionar += item.CANTIDAD;
            // SIN CONFECCIONAR NUNCA suma al costoTotal
            anexos.push({
                DOCUMENTO: item.REFERENCIA,
                TALLA: item.TALLA,
                COLOR: item.COLORES,
                TIPO: 'SIN_CONFECCIONAR',
                CANTIDAD: item.CANTIDAD,
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
    // COSTO_UNITARIO: valor directo del primer item DI/PRIMERAS, NO se calcula
    const costoUnitario = getCostoPrimeras(primerItem.OP);
    const sumatoria = cantidadFull + cantidadPromo + cantidadCobros + cantidadSinConfeccionar;

    const referenciaHistorica = getReferenciaHistorica(primerItem.REFERENCIA);
    const marca = getMarca(generoEdit); // Usar género editado
    const clase = getClaseByPVP(pvpEdit);
    const descripcion = getDescripcion(prendaEdit, generoEdit, marca, primerItem.REFERENCIA); // refprov al final

    const auditoriaNum = parseInt(primerItem.CC) || 0;
    const osNum = parseInt(primerItem.OS) || 0;
    const trasladoNum = parseInt(primerItem.TRASLADO) || 0;
    const pvpString = pvpEdit;
    const loteNum = parseInt(primerItem.OP) || 0;

    const jsonData = {
        "A": primerItem.OP_SUFIJO || primerItem.OP,
        "FECHA": primerItem.FECHA,
        "TALLER": primerItem.TALLER,
        "LINEA": lineaEdit,
        "AUDITOR": auditor,
        "GESTOR": gestor,
        "ESCANER": escaner,
        "LOTE": loteNum,
        "REFPROV": primerItem.REFERENCIA,
        "DESCRIPCIÓN": descripcion,
        "DESCRIPCIÓN_LARGA": primerItem.DESCRIPCION_LARGA,
        "CANTIDAD": cantidad,
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
        if (typeof loadDataFromSheets === 'function') {
            await loadDataFromSheets(true); // true = silent mode (sin notificaciones al usuario)
            Logger.success('op-editor', '✅ Todos los datos y módulos actualizados');
        } else {
            // Fallback: solo recargar datos esenciales
            await Promise.all([
                loadData2Data(),
                loadColoresData(),
                loadPreciosData()
            ]);
            Logger.success('op-editor', '✅ Datos esenciales actualizados');
        }
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