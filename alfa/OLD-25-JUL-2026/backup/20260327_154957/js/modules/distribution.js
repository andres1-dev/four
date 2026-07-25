// ============================================
// INICIALIZACIÓN Y CONSTANTES
// ============================================

const CORE_SIZES = ['M', 'L', '8', '10', '12', '34', '36'];

// ============================================
// HELPERS DE REFRESCO EN BACKGROUND
// ============================================

/**
 * Recarga datos de distribución con retry+backoff hasta encontrar la OP recién guardada.
 * El GAS puede tardar varios segundos en escribir la columna S tras confirmar el save.
 * @param {string|null} expectedOpId - OP a esperar. Si es null, recarga sin poll.
 * @param {number} [maxRetries=6]
 */
async function _refreshDistributionBackground(expectedOpId = null, maxRetries = 6) {
    updateStatus('Actualizando distribución...', 'loading');
    let delay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await new Promise(r => setTimeout(r, delay));
            delay += 1000; // backoff lineal: 2s, 3s, 4s, 5s, 6s, 7s

            const recData = await cargarTodosLosDatos();

            if (expectedOpId) {
                const opStr = expectedOpId.toString().trim();
                const found = recData.some(item =>
                    item.A === opStr ||
                    item.LOTE === opStr ||
                    item.LOTE === parseInt(opStr)
                );
                if (!found && attempt < maxRetries) {
                    updateStatus(`Esperando datos de distribución... (${attempt}/${maxRetries})`, 'loading');
                    continue;
                }
            }

            setAllRecData(recData);

            const recInput = document.getElementById('recInput');
            if (recInput && recInput.value.trim()) {
                const recNumClean = recInput.value.trim().replace(/^0+/, '');
                setCurrentRecData(
                    allRecData.find(item => item.A === recNumClean) ||
                    allRecData.find(item => item.A === recInput.value.trim()) ||
                    null
                );
                if (currentRecData) displayDistributionResults(currentRecData);
            }

            updateStatus('Distribución actualizada', 'success');
            return;

        } catch (err) {
            console.error(`Error en intento ${attempt} de refresh distribución:`, err);
            if (attempt === maxRetries) updateStatus('Error actualizando distribución', 'error');
        }
    }
}

/**
 * Recarga el módulo de impresión en background.
 * Llamado tras guardar una distribución para que impresión vea el nuevo documento.
 */
function _refreshPrintBackground() {
    if (typeof window.print_cargarDatos !== 'function') {
        console.warn('print_cargarDatos no disponible');
        return;
    }
    window.print_cargarDatos()
        .catch(err => console.error('Error refrescando impresión:', err));
}

function initializeDistribution() {
    const loadingElem = document.getElementById('distribution-loading');
    const mainElem = document.getElementById('distribution-main');

    if (loadingElem) loadingElem.style.display = 'flex';
    if (mainElem) mainElem.style.display = 'none';

    setupDistributionEventListeners();

    return Promise.all([
        cargarTodosLosDatos(),
        cargarConfiguraciones()
    ]).then(([recData, configData]) => {
        handleRecData(recData);
        handleConfigData(configData);

        if (loadingElem) loadingElem.style.display = 'none';
        if (mainElem) mainElem.style.display = 'block';

        updateCounters();
        return true;
    }).catch(error => {
        handleError(error);
        throw error;
    });
}

// ============================================
// CARGA DE DATOS
// ============================================

async function cargarTodosLosDatos() {
    try {
        const [json1, json2] = await Promise.all([
            getSheetDataAsJSON_1(),
            getSheetDataAsJSON_2()
        ]);

        const arr1 = JSON.parse(json1);
        const arr2 = JSON.parse(json2);
        const unified = arr1.concat(arr2);
        
        return unified;
    } catch (error) {
        console.error('Error cargando datos de distribución:', error);
        throw error;
    }
}

async function getSheetDataAsJSON_1() {
    try {
        const SPREADSHEET_ID = "133NiyjNApZGkEFs4jUvpJ9So-cSEzRVeW2FblwOCrjI";
        const SHEET_NAME = "DATA2";
        const RANGE = `${SHEET_NAME}!S2:S`;

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${DIS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.values) return JSON.stringify([]);
        const jsonEntries = data.values.map(row => row[0]).filter(val => val && val.trim() !== "");
        return `[${jsonEntries.join(",")}]`;
    } catch (error) {
        console.error('Error en getSheetDataAsJSON_1:', error);
        return JSON.stringify([]);
    }
}

async function getSheetDataAsJSON_2() {
    try {
        const range = "DataBase!A:HR";
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SOURCE_SPREADSHEET_ID}/values/${range}?key=${DIS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.values) return JSON.stringify([]);

        const datos = data.values;
        let result = [];
        let lotesAnexos = {};
        let lotesHrPendientes = {};

        for (let i = 0; i < datos.length; i++) {
            if (datos[i][0]) {
                const valueA = datos[i][0].toString().trim();
                if (valueA.startsWith("REC")) {
                    const numberPart = valueA.replace("REC", "").trim();
                    let proveedor = "TEXTILES Y CREACIONES EL UNIVERSO S.A.S.";
                    if (datos[i][3] && datos[i][3].toString().trim() === "LINEA ANGELES") {
                        proveedor = "TEXTILES Y CREACIONES LOS ANGELES S.A.S.";
                    }

                    let loteActual = datos[i][8] || "";
                    let tipoActual = datos[i][27] || "";

                    if (!lotesAnexos[loteActual]) {
                        lotesAnexos[loteActual] = [];
                        lotesHrPendientes[loteActual] = [];
                    }

                    if (tipoActual !== "FULL") {
                        lotesAnexos[loteActual].push({
                            "DOCUMENTO": numberPart,
                            "TIPO": tipoActual,
                            "CANTIDAD": datos[i][18] || ""
                        });

                        if (tipoActual === "PENDIENTES" && datos[i][225]) {
                            const hrPendiente = datos[i][225].toString().split("☬").map(row => row.split("∞"));
                            lotesHrPendientes[loteActual] = lotesHrPendientes[loteActual].concat(hrPendiente);
                        }
                    }

                    if (tipoActual === "FULL") {
                        let extensiones = [];
                        if (datos[i][225]) {
                            extensiones = datos[i][225].toString().split("☬").map(row => row.split("∞"));
                        }

                        result.push({
                            "A": numberPart,
                            "FECHA": datos[i][1] || "",
                            "TALLER": datos[i][2] || "",
                            "LINEA": datos[i][3] || "",
                            "AUDITOR": datos[i][4] || "",
                            "ESCANER": datos[i][5] || "",
                            "LOTE": loteActual,
                            "REFERENCIA": datos[i][6] || "",
                            "DESCRIPCIÓN": datos[i][9] || "",
                            "CANTIDAD": datos[i][18] || "",
                            "TEMPLO": datos[i][26] || "",
                            "TIPO": tipoActual,
                            "PVP": datos[i][28] || "",
                            "PRENDA": datos[i][29] || "",
                            "GENERO": datos[i][30] || "",
                            "HR": extensiones,
                            "PROVEEDOR": proveedor,
                            "ANEXO": []
                        });
                    }
                }
            }
        }

        // Combinar HRs y anexos
        result.forEach(item => {
            if (lotesAnexos[item.LOTE]) item.ANEXO = lotesAnexos[item.LOTE];
            if (lotesHrPendientes[item.LOTE] && lotesHrPendientes[item.LOTE].length > 0) {
                const hrPrincipal = item.HR;
                const hrPendientes = lotesHrPendientes[item.LOTE];
                const combinedHrMap = {};

                hrPrincipal.forEach(itemHr => { if (itemHr[0]) combinedHrMap[itemHr[0]] = [...itemHr]; });
                hrPendientes.forEach(itemHr => {
                    if (itemHr[0]) {
                        if (combinedHrMap[itemHr[0]]) {
                            const cantidadExistente = parseInt(combinedHrMap[itemHr[0]][3]) || 0;
                            const cantidadNueva = parseInt(itemHr[3]) || 0;
                            combinedHrMap[itemHr[0]][3] = (cantidadExistente + cantidadNueva).toString();
                        } else {
                            combinedHrMap[itemHr[0]] = [...itemHr];
                        }
                    }
                });

                item.HR = Object.values(combinedHrMap);
            }
        });

        return JSON.stringify(result, null, 2);
    } catch (error) {
        console.error('Error en getSheetDataAsJSON_2:', error);
        return JSON.stringify([]);
    }
}

function cargarConfiguraciones() {
    return new Promise((resolve) => {
        const configArray = Array.from(clientesMap.values()).map(cliente => ({
            id: cliente.ID,
            razonSocial: cliente.RAZON_SOCIAL,
            nombreCorto: cliente.NOMBRE_CORTO,
            tipoCliente: cliente.TIPO_CLIENTE,
            estado: cliente.ESTADO,
            direccion: cliente.DIRECCION,
            telefono: cliente.TELEFONO,
            email: cliente.EMAIL,
            tipoEmpresa: cliente.TIPO_EMPRESA || ''
        }));

        resolve(configArray);
    });
}

function handleRecData(recData) {
    setAllRecData(recData);
    if (allConfigData) refreshDistributionUI();
}

function handleConfigData(configData) {
    setAllConfigData(configData.reduce((acc, config) => { acc[config.id] = config; return acc; }, {}));
    processConfigData();
    if (allRecData) refreshDistributionUI();
}

function processConfigData() {
    setEmpresasData(Object.entries(allConfigData)
        .filter(([id, config]) => {
            const isActive = config.estado && config.estado.toString().toUpperCase().trim() === 'ACTIVO';
            const isEmpresa = config.tipoEmpresa && config.tipoEmpresa.trim() !== '';
            return isEmpresa && isActive;
        })
        .sort((a, b) => {
            if (a[1].tipoEmpresa !== b[1].tipoEmpresa) return a[1].tipoEmpresa === "Principal" ? -1 : 1;
            return a[1].nombreCorto.localeCompare(b[1].nombreCorto);
        }));

    const mayoristas = Object.entries(allConfigData)
        .filter(([id, config]) => {
            const isActive = config.estado && config.estado.toString().toUpperCase().trim() === 'ACTIVO';
            const isMayorista = config.tipoCliente === "Mayorista";
            return isMayorista && isActive;
        });

    setMayoristaFilters({});
    mayoristas.forEach(([id, config]) => {
        mayoristaFilters[id] = { excludedColors: [], excludedTallas: [] };
    });
}

// ============================================
// UI DE DISTRIBUCIÓN
// ============================================

function refreshDistributionUI() {
    const loadingElem = document.getElementById('distribution-loading');
    const mainElem = document.getElementById('distribution-main');

    if (loadingElem) loadingElem.style.display = 'none';
    if (mainElem) mainElem.style.display = 'block';

    updateCounters();

    document.getElementById('empresasContainer').innerHTML = '';
    document.getElementById('mayoristasContainer').innerHTML = '';

    generateEmpresasUI();
    generateMayoristasUI();

    const recNumber = document.getElementById('recInput').value.trim();
    if (recNumber) searchDistributionRec();
}

function generateEmpresasUI() {
    const container = document.getElementById('empresasContainer');
    container.innerHTML = '';

    if (empresasData.length === 0) {
        container.innerHTML = '<p>No hay empresas configuradas</p>';
        return;
    }

    // Obtener configuración predeterminada
    const defaultSecondaryCompany = localStorage.getItem('defaultSecondaryCompany') || '';
    const defaultSecondaryPercentage = parseInt(localStorage.getItem('defaultSecondaryPercentage')) || 0;

    empresasData.forEach(([id, config]) => {
        const item = document.createElement('div');
        item.className = 'empresa-item';

        const label = document.createElement('label');
        label.htmlFor = `empresa-${id}`;
        label.textContent = config.nombreCorto + ':';

        const groupDiv = document.createElement('div');
        groupDiv.className = 'input-group';

        const input = document.createElement('input');
        input.type = 'number';
        input.id = `empresa-${id}`;
        input.min = '0';
        input.max = '100';
        
        // Aplicar valor predeterminado
        if (config.tipoEmpresa === "Principal") {
            input.value = Math.max(0, 100 - defaultSecondaryPercentage);
        } else if (id === defaultSecondaryCompany) {
            input.value = defaultSecondaryPercentage;
        } else {
            input.value = '0';
        }
        
        input.dataset.tipo = config.tipoEmpresa;
        input.dataset.id = id;

        if (config.tipoEmpresa === "Principal") {
            input.readOnly = true;
            input.classList.add('principal-input');
        } else {
            input.addEventListener('input', updateEmpresaPercentage);
        }

        groupDiv.appendChild(input);

        if (config.tipoEmpresa !== "Principal") {
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'number-controls';

            const btnUp = document.createElement('button');
            btnUp.type = 'button';
            btnUp.className = 'number-btn';
            btnUp.innerHTML = '<i class="codicon codicon-chevron-up"></i>';
            btnUp.onclick = () => adjustEmpresaValue(id, 1);

            const btnDown = document.createElement('button');
            btnDown.type = 'button';
            btnDown.className = 'number-btn';
            btnDown.innerHTML = '<i class="codicon codicon-chevron-down"></i>';
            btnDown.onclick = () => adjustEmpresaValue(id, -1);

            controlsDiv.appendChild(btnUp);
            controlsDiv.appendChild(btnDown);
            groupDiv.appendChild(controlsDiv);
        }

        item.appendChild(label);
        item.appendChild(groupDiv);
        container.appendChild(item);
    });
}

function generateMayoristasUI() {
    const container = document.getElementById('mayoristasContainer');
    const mayoristas = Object.entries(allConfigData)
        .filter(([id, config]) => {
            return config.tipoCliente === "Mayorista" &&
                config.estado && config.estado.toString().toUpperCase().trim() === 'ACTIVO';
        })
        .sort((a, b) => a[1].nombreCorto.localeCompare(b[1].nombreCorto));

    if (mayoristas.length === 0) {
        container.innerHTML = '<p>No hay mayoristas configurados</p>';
        return;
    }

    mayoristas.forEach(([id, config]) => {
        const div = document.createElement('div');
        div.className = 'mayorista-item';

        const checkboxInput = document.createElement('input');
        checkboxInput.type = 'checkbox';
        checkboxInput.id = `mayorista-${id}`;
        checkboxInput.value = id;
        checkboxInput.dataset.nombre = config.nombreCorto;
        checkboxInput.addEventListener('change', updateHrColumns);

        const label = document.createElement('label');
        label.htmlFor = `mayorista-${id}`;
        label.textContent = config.nombreCorto;

        div.appendChild(checkboxInput);
        div.appendChild(label);
        container.appendChild(div);
    });
}

// ============================================
// BÚSQUEDA Y VISUALIZACIÓN DE REC
// ============================================

function searchDistributionRec() {
    const recNumber = document.getElementById('recInput').value.trim();
    const resultDiv = document.getElementById('distribution-result');

    if (!recNumber) {
        resultDiv.innerHTML = `<div class="empty-state"><i class="fa-solid fa-chart-bar empty-icon"></i><h5>Sin datos para mostrar</h5><p>Ingrese un número de REC y configure la distribución para ver los resultados.</p></div>`;
        return;
    }

    const recNumClean = recNumber.replace(/^0+/, '');
    setCurrentRecData(allRecData.find(item => item.A === recNumClean) || allRecData.find(item => item.A === recNumber));

    displayDistributionResults(currentRecData);

    // Mostrar modal de pedidos si hay pedidos pendientes para este LOTE
    if (currentRecData && typeof mostrarModalPedidosParaLote === 'function') {
        mostrarModalPedidosParaLote(currentRecData.LOTE);
    }
}

function displayDistributionResults(recData) {
    const resultDiv = document.getElementById('distribution-result');

    if (!recData) {
        resultDiv.innerHTML = '<p class="error-message">No se encontró el REC especificado</p>';
        return;
    }

    resultDiv.innerHTML = generateDistributionResultsHTML(recData);
    
    // Evaluar si las cantidades justifican distribución a secundarias
    evaluateAndAdjustSecondaryCompanies(recData);
    
    attachDistributionInputEvents();
    updateAllDistributionValues();
}

function evaluateAndAdjustSecondaryCompanies(recData) {
    if (!recData || !recData.HR) return;
    
    const minQuantityForDistribution = parseInt(localStorage.getItem('minQuantityForDistribution')) || 120;
    const defaultSecondaryCompany = localStorage.getItem('defaultSecondaryCompany') || '';
    const defaultSecondaryPercentage = parseInt(localStorage.getItem('defaultSecondaryPercentage')) || 0;
    
    // Calcular la cantidad TOTAL de todas las filas
    let totalQuantity = 0;
    
    recData.HR.forEach(row => {
        const cantidad = parseInt(row[3]) || 0;
        totalQuantity += cantidad;
    });
    
    // Si la cantidad TOTAL es inferior al mínimo configurado, resetear secundarias a 0
    if (totalQuantity < minQuantityForDistribution) {
        // Resetear todas las empresas secundarias a 0
        empresasData.forEach(([id, config]) => {
            if (config.tipoEmpresa === "Secundaria") {
                const input = document.getElementById(`empresa-${id}`);
                if (input) {
                    input.value = '0';
                }
            }
        });
        
        // Actualizar empresa principal a 100%
        const principalInput = document.querySelector('.principal-input');
        if (principalInput) {
            principalInput.value = '100';
        }
        
        // Mostrar notificación al usuario
        if (typeof showMessage === 'function') {
            showMessage(`Cantidad total (${totalQuantity}) inferior al mínimo (${minQuantityForDistribution}). Distribución ajustada a 100% empresa principal.`, 'info', 3000);
        }
    } else {
        // Cantidad total suficiente: restaurar valores predeterminados
        empresasData.forEach(([id, config]) => {
            if (config.tipoEmpresa === "Secundaria") {
                const input = document.getElementById(`empresa-${id}`);
                if (input) {
                    // Aplicar valor predeterminado solo a la empresa secundaria configurada
                    if (id === defaultSecondaryCompany) {
                        input.value = defaultSecondaryPercentage;
                    } else {
                        input.value = '0';
                    }
                }
            }
        });
        
        // Actualizar empresa principal según el porcentaje de secundarias
        const principalInput = document.querySelector('.principal-input');
        if (principalInput) {
            principalInput.value = Math.max(0, 100 - defaultSecondaryPercentage);
        }
    }
}

function generateDistributionResultsHTML(recData) {
    if (!recData.HR || recData.HR.length === 0) {
        return '<p>No hay extensiones para este REC</p>';
    }

    let html = '<table><thead><tr>';
    html += '<th>Código</th><th>Color</th><th>Talla</th><th>Cantidad</th>';

    empresasData.forEach(([id, config]) => {
        html += `<th>${config.nombreCorto}</th>`;
    });

    activeMayoristas.forEach(mayorista => {
        html += `
            <th>
                <div class="mayorista-column-header">
                    <div class="header-title">${mayorista.nombre}</div>
                    <div class="header-btn-row">
                        <button class="btn-sm distribute-btn" data-mayorista="${mayorista.id}" title="Distribuir cantidad">
                            <i class="codicon codicon-symbol-array"></i>
                        </button>
                        <button class="btn-sm filter-btn" data-mayorista="${mayorista.id}" title="Filtrar colores/tallas" onclick="window.openFilterModal(event)">
                            <i class="codicon codicon-filter"></i>
                        </button>
                        <button class="btn-sm clear-btn" data-mayorista="${mayorista.id}" title="Limpiar valores">
                            <i class="codicon codicon-clear-all"></i>
                        </button>
                    </div>
                    <div class="header-controls-single-row">
                        <div class="input-group global-input-group">
                            <input type="number" min="0" class="global-mayorista-input" 
                                    id="global-input-${mayorista.id}"
                                    data-mayorista="${mayorista.id}" value="0" placeholder="0">
                            <div class="number-controls global-number-controls">
                                <button type="button" class="number-btn" 
                                        onclick="window.adjustGlobalValue('${mayorista.id}', 1)">
                                    <i class="codicon codicon-chevron-up"></i>
                                </button>
                                <button type="button" class="number-btn" 
                                        onclick="window.adjustGlobalValue('${mayorista.id}', -1)">
                                    <i class="codicon codicon-chevron-down"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </th>
        `;
    });

    html += '</tr></thead><tbody>';

    recData.HR.forEach((row, rowIndex) => {
        const codigo = formatCellValue(row[0]);
        const color = formatCellValue(row[1]);
        const talla = formatCellValue(row[2]);
        const cantidad = parseFloat(row[3]) || 0;

        html += `<tr>`;
        html += `<td>${codigo}</td><td>${color}</td><td>${talla}</td><td>${cantidad}</td>`;

        empresasData.forEach(([id, config]) => {
            if (config.tipoEmpresa === "Principal") {
                html += `<td class="principal-cell" data-row="${rowIndex}">${cantidad}</td>`;
            } else {
                html += `<td class="secundaria-cell" data-row="${rowIndex}" data-empresa="${id}">0</td>`;
            }
        });

        activeMayoristas.forEach(mayorista => {
            html += `
                <td>
                    <div class="input-group item-input-group">
                        <input type="number" min="0" max="${cantidad}" 
                                class="mayorista-input" 
                                id="input-${mayorista.id}-${rowIndex}"
                                data-row="${rowIndex}" 
                                data-mayorista="${mayorista.id}"
                                value="0"
                                data-color="${color}"
                                data-talla="${talla}">
                        <div class="number-controls item-number-controls">
                            <button type="button" class="number-btn" 
                                    onclick="window.adjustDistValue('${mayorista.id}', ${rowIndex}, 1)">
                                <i class="codicon codicon-chevron-up"></i>
                            </button>
                            <button type="button" class="number-btn" 
                                    onclick="window.adjustDistValue('${mayorista.id}', ${rowIndex}, -1)">
                                <i class="codicon codicon-chevron-down"></i>
                            </button>
                        </div>
                    </div>
                </td>
            `;
        });

        html += '</tr>';
    });

    html += '<tr class="total-row">';
    html += '<td colspan="3"><strong>Total</strong></td>';
    const totalCantidad = recData.HR.reduce((sum, row) => sum + (parseFloat(row[3]) || 0), 0);
    html += `<td><strong>${totalCantidad}</strong></td>`;

    empresasData.forEach(([id, config]) => {
        if (config.tipoEmpresa === "Principal") {
            html += `<td><strong class="principal-total">${totalCantidad}</strong></td>`;
        } else {
            html += `<td><strong class="secundaria-total" data-empresa="${id}">0</strong></td>`;
        }
    });

    activeMayoristas.forEach(mayorista => {
        html += `<td><strong class="mayorista-total" data-mayorista="${mayorista.id}">0</strong></td>`;
    });

    html += '</tr></tbody></table>';
    return html;
}

// ============================================
// LÓGICA DE DISTRIBUCIÓN
// ============================================

function updateAllDistributionValues() {
    if (!currentRecData || !currentRecData.HR) return;

    currentRecData.HR.forEach((row, rowIndex) => {
        const tr = document.querySelector(`#distribution-result tbody tr:nth-child(${rowIndex + 1})`);
        if (!tr) return;

        const total = parseInt(tr.cells[3].textContent) || 0;
        let assignedToMayoristas = 0;

        activeMayoristas.forEach(mayorista => {
            const input = tr.querySelector(`.mayorista-input[data-mayorista="${mayorista.id}"]`);
            assignedToMayoristas += parseInt(input?.value) || 0;
        });

        if (assignedToMayoristas > total) {
            const ratio = total / assignedToMayoristas;
            activeMayoristas.forEach(mayorista => {
                const input = tr.querySelector(`.mayorista-input[data-mayorista="${mayorista.id}"]`);
                if (input && input.value > 0) {
                    input.value = Math.max(1, Math.floor(parseInt(input.value) * ratio));
                }
            });
            assignedToMayoristas = total;
        }

        const availableForCompanies = total - assignedToMayoristas;

        // Distribución normal según porcentajes configurados
        empresasData.forEach(([id, config]) => {
            if (config.tipoEmpresa === "Secundaria") {
                const input = document.getElementById(`empresa-${id}`);
                const porcentaje = input ? parseInt(input.value) || 0 : 0;
                const valorSecundaria = Math.round(availableForCompanies * porcentaje / 100);
                const secundariaCell = tr.querySelector(`.secundaria-cell[data-empresa="${id}"]`);
                if (secundariaCell) secundariaCell.textContent = valorSecundaria;
            }
        });

        let asignadoSecundarias = 0;
        empresasData.forEach(([id, config]) => {
            if (config.tipoEmpresa === "Secundaria") {
                const secundariaCell = tr.querySelector(`.secundaria-cell[data-empresa="${id}"]`);
                asignadoSecundarias += parseInt(secundariaCell?.textContent) || 0;
            }
        });

        const principalValue = Math.max(0, availableForCompanies - asignadoSecundarias);
            
        const principalCell = tr.querySelector('.principal-cell');
        if (principalCell) principalCell.textContent = principalValue;
    });

    updateDistributionTotals();
}

function updateDistributionTotals() {
    if (!currentRecData) return;

    const totalCantidad = currentRecData.HR.reduce((sum, row) => sum + (parseFloat(row[3]) || 0), 0);

    activeMayoristas.forEach(mayorista => {
        let total = 0;
        document.querySelectorAll(`.mayorista-input[data-mayorista="${mayorista.id}"]`).forEach(input => {
            total += parseInt(input.value) || 0;
        });
        const totalElement = document.querySelector(`.mayorista-total[data-mayorista="${mayorista.id}"]`);
        if (totalElement) totalElement.textContent = total;
    });

    empresasData.forEach(([id, config]) => {
        if (config.tipoEmpresa === "Principal") {
            let totalPrincipal = 0;
            document.querySelectorAll('.principal-cell').forEach(cell => {
                totalPrincipal += parseInt(cell.textContent) || 0;
            });
            const principalTotalElement = document.querySelector('.principal-total');
            if (principalTotalElement) {
                principalTotalElement.textContent = totalPrincipal;
                principalTotalElement.classList.toggle('valor-negativo', totalPrincipal < 0);
            }
        } else {
            let totalSecundaria = 0;
            document.querySelectorAll(`.secundaria-cell[data-empresa="${id}"]`).forEach(cell => {
                totalSecundaria += parseInt(cell.textContent) || 0;
            });
            const totalElement = document.querySelector(`.secundaria-total[data-empresa="${id}"]`);
            if (totalElement) totalElement.textContent = totalSecundaria;
        }
    });
}

function updateHrColumns(event) {
    const changedCheckbox = event.target;
    const mayoristaId = changedCheckbox.value;
    const isNowChecked = changedCheckbox.checked;

    const savedMayoristaValues = {};
    activeMayoristas.forEach(mayorista => {
        if (mayorista.id !== mayoristaId) {
            savedMayoristaValues[mayorista.id] = [];
            document.querySelectorAll(`.mayorista-input[data-mayorista="${mayorista.id}"]`).forEach((input, index) => {
                savedMayoristaValues[mayorista.id][index] = input.value;
            });
        }
    });

    const savedEmpresaValues = {};
    empresasData.forEach(([id, config]) => {
        const input = document.getElementById(`empresa-${id}`);
        if (input) savedEmpresaValues[id] = input.value;
    });

    if (!isNowChecked) {
        const globalInput = document.querySelector(`.global-mayorista-input[data-mayorista="${mayoristaId}"]`);
        if (globalInput) globalInput.value = '0';
        document.querySelectorAll(`.mayorista-input[data-mayorista="${mayoristaId}"]`).forEach(input => {
            input.value = '0';
        });
    }

    const newActive = [];
    document.querySelectorAll('#mayoristasContainer input[type="checkbox"]:checked').forEach(checkbox => {
        newActive.push({ id: checkbox.value, nombre: checkbox.dataset.nombre });
    });
    setActiveMayoristas(newActive);

    refreshDistributionDisplayPreservingValues({ empresas: savedEmpresaValues, mayoristas: savedMayoristaValues });
    updateDistributionTotals();
}

function desmarcarMayoristasConPedidosCompletados(mayoristasIds) {
    if (!mayoristasIds || mayoristasIds.length === 0) return;
    
    // Desmarcar los checkboxes de los mayoristas que tenían pedidos
    mayoristasIds.forEach(mayoristaId => {
        const checkbox = document.querySelector(`#mayorista-${mayoristaId}`);
        if (checkbox && checkbox.checked) {
            checkbox.checked = false;
            // Disparar el evento change para actualizar la UI
            const event = new Event('change', { bubbles: true });
            checkbox.dispatchEvent(event);
        }
    });
    
    // Mostrar mensaje informativo
    const mayoristasDespalomados = mayoristasIds
        .map(id => {
            const config = allConfigData?.[id];
            return config?.nombreCorto || id;
        })
        .join(', ');
    
    if (mayoristasDespalomados && typeof showMessage === 'function') {
        showMessage(`Mayoristas despalomados: ${mayoristasDespalomados}`, 'info', 3000);
    }
}

function refreshDistributionDisplayPreservingValues(savedValues = {}) {
    const recNumber = document.getElementById('recInput').value.trim();
    if (!recNumber || !currentRecData) return;

    const resultDiv = document.getElementById('distribution-result');
    resultDiv.innerHTML = generateDistributionResultsHTML(currentRecData);
    attachDistributionInputEvents();

    if (savedValues.empresas) {
        Object.keys(savedValues.empresas).forEach(id => {
            const input = document.getElementById(`empresa-${id}`);
            if (input) {
                input.value = savedValues.empresas[id];
                if (input.dataset.tipo === "Secundaria") {
                    const event = new Event('input');
                    input.dispatchEvent(event);
                }
            }
        });
    }

    if (savedValues.mayoristas) {
        Object.keys(savedValues.mayoristas).forEach(mayoristaId => {
            const values = savedValues.mayoristas[mayoristaId];
            values.forEach((value, rowIndex) => {
                const input = document.querySelector(`.mayorista-input[data-row="${rowIndex}"][data-mayorista="${mayoristaId}"]`);
                if (input) input.value = value;
            });
        });
    }

    updateAllDistributionValues();
}

// ============================================
// MANEJO DE INPUTS Y CONTROLES
// ============================================

function attachDistributionInputEvents() {
    document.querySelectorAll('.mayorista-input, .global-mayorista-input').forEach(input => {
        input.addEventListener('focus', function () {
            if (this.value === '0') this.select();
        });
        input.addEventListener('click', function () {
            if (this.value === '0') this.select();
        });
    });

    document.querySelectorAll('.mayorista-input').forEach(input => {
        input.addEventListener('input', updateMayoristaInput);
    });

    document.querySelectorAll('.global-mayorista-input').forEach(input => {
        input.addEventListener('input', updateGlobalMayoristaValue);
        input.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                const mayoristaId = this.dataset.mayorista;
                const distributeBtn = document.querySelector(`.distribute-btn[data-mayorista="${mayoristaId}"]`);
                if (distributeBtn) distributeBtn.click();
            }
        });
    });

    document.querySelectorAll('.distribute-btn').forEach(btn => {
        btn.addEventListener('click', distributeGlobalQuantity);
    });

    document.querySelectorAll('.clear-btn').forEach(btn => {
        btn.addEventListener('click', clearMayoristaValues);
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', openFilterModal);
    });
}

function updateMayoristaInput(event) {
    const input = event.target;
    const rowIndex = input.dataset.row;
    const mayoristaId = input.dataset.mayorista;
    const value = parseInt(input.value) || 0;

    const row = document.querySelector(`#distribution-result tbody tr:nth-child(${parseInt(rowIndex) + 1})`);
    if (!row) return;

    const total = parseInt(row.cells[3].textContent) || 0;
    let assignedToOthers = 0;

    activeMayoristas.forEach(m => {
        if (m.id !== mayoristaId) {
            const otherInput = document.querySelector(`.mayorista-input[data-row="${rowIndex}"][data-mayorista="${m.id}"]`);
            assignedToOthers += parseInt(otherInput?.value) || 0;
        }
    });

    if (value + assignedToOthers > total) {
        input.value = Math.max(0, total - assignedToOthers);
    }

    updateAllDistributionValues();
}

function updateGlobalMayoristaValue(event) {
    const input = event.target;
    const mayoristaId = input.dataset.mayorista;
    const value = parseInt(input.value) || 0;

    if (!currentRecData || !currentRecData.HR) return;

    const totalDisponible = currentRecData.HR.reduce((sum, row) => sum + (parseFloat(row[3]) || 0), 0);
    let assignedToOthers = 0;

    activeMayoristas.forEach(m => {
        if (m.id !== mayoristaId) {
            const globalInput = document.querySelector(`.global-mayorista-input[data-mayorista="${m.id}"]`);
            assignedToOthers += parseInt(globalInput?.value) || 0;
        }
    });

    if (value + assignedToOthers > totalDisponible) {
        input.value = Math.max(0, totalDisponible - assignedToOthers);
    }
}

function distributeGlobalQuantity(event) {
    const btn = event.target.closest('.distribute-btn');
    const mayoristaId = btn.dataset.mayorista;
    const input = document.querySelector(`.global-mayorista-input[data-mayorista="${mayoristaId}"]`);
    let totalToDistribute = parseInt(input.value) || 0;

    if (totalToDistribute <= 0) return;

    const filters = mayoristaFilters[mayoristaId] || { excludedColors: [], excludedTallas: [] };

    const rows = Array.from(document.querySelectorAll('#distribution-result tbody tr:not(.total-row)'))
        .filter(row => {
            const color = row.cells[1].textContent;
            const talla = row.cells[2].textContent;
            const total = parseInt(row.cells[3].textContent) || 0;
            return total > 0 &&
                !filters.excludedColors.includes(color) &&
                !filters.excludedTallas.includes(talla);
        });

    if (rows.length === 0) {
        showMessage('No hay filas disponibles para distribuir', 'error', 3000);
        return;
    }

    document.querySelectorAll(`.mayorista-input[data-mayorista="${mayoristaId}"]`).forEach(input => {
        input.value = '0';
    });

    const availableRows = rows.map(row => {
        const rowIndex = Array.from(row.parentNode.children).indexOf(row);
        const total = parseInt(row.cells[3].textContent) || 0;
        let assignedToOthers = 0;

        activeMayoristas.forEach(m => {
            if (m.id !== mayoristaId) {
                const otherInput = row.querySelector(`.mayorista-input[data-mayorista="${m.id}"]`);
                assignedToOthers += parseInt(otherInput?.value) || 0;
            }
        });

        const disponible = Math.max(0, total - assignedToOthers);
        const talla = row.cells[2].textContent.trim().toUpperCase();
        return { row, tdm: disponible, rowIndex, talla };
    });

    const result = smartDistribution(availableRows, totalToDistribute);

    if (!result) {
        const totalDisponible = availableRows.reduce((sum, r) => sum + r.tdm, 0);
        showMessage(`Stock insuficiente: solo hay ${totalDisponible} unidades disponibles para ${totalToDistribute} pedidas`, 'error', 4000);
        return;
    }

    result.forEach(item => {
        const input = item.row.querySelector(`.mayorista-input[data-mayorista="${mayoristaId}"]`);
        if (input) input.value = item.assigned > 0 ? item.assigned : '0';
    });

    // NO modificar el global-mayorista-input, respetar exactamente lo que el usuario puso
    updateAllDistributionValues();
}

function clearMayoristaValues(event) {
    const btn = event.target.closest('.clear-btn');
    const mayoristaId = btn.dataset.mayorista;

    const globalInput = document.querySelector(`.global-mayorista-input[data-mayorista="${mayoristaId}"]`);
    if (globalInput) globalInput.value = '0';

    document.querySelectorAll(`.mayorista-input[data-mayorista="${mayoristaId}"]`).forEach(input => {
        input.value = '0';
    });

    if (mayoristaFilters[mayoristaId]) {
        mayoristaFilters[mayoristaId].excludedColors = [];
        mayoristaFilters[mayoristaId].excludedTallas = [];
    }

    updateAllDistributionValues();
}

// ============================================
// FILTROS DE COLORES Y TALLAS
// ============================================

function openFilterModal(event) {
    const btn = event.target.closest('.filter-btn');
    const mayoristaId = btn.dataset.mayorista;
    const mayorista = allConfigData[mayoristaId];

    if (!currentRecData || !currentRecData.HR || currentRecData.HR.length === 0) {
        showMessage('Primero busque un REC para configurar los filtros', 'error', 3000);
        return;
    }

    const colors = new Set();
    const tallas = new Set();

    currentRecData.HR.forEach(row => {
        if (row[1]) colors.add(row[1]);
        if (row[2]) tallas.add(row[2]);
    });

    setColorOptions(Array.from(colors));
    setTallaOptions(Array.from(tallas));

    if (!mayoristaFilters[mayoristaId]) {
        mayoristaFilters[mayoristaId] = { excludedColors: [], excludedTallas: [] };
    }

    const existingModal = document.querySelector('.filter-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'filter-modal';
    modal.innerHTML = `
        <div class="filter-modal-content">
            <div class="filter-modal-header">
                <h3><i class="codicon codicon-filter"></i> Filtros para ${mayorista.nombreCorto}</h3>
                <button class="filter-modal-close" onclick="window.closeFilterModal(this)">
                    <i class="codicon codicon-close"></i>
                </button>
            </div>
            <div class="filter-modal-body">
                <div class="filter-section">
                    <h5><i class="codicon codicon-symbol-color"></i> Excluir Colores</h5>
                    <div id="colorFilters-${mayoristaId}" class="filter-options"></div>
                </div>
                <div class="filter-section">
                    <h5><i class="codicon codicon-symbol-ruler"></i> Excluir Tallas</h5>
                    <div id="tallaFilters-${mayoristaId}" class="filter-options"></div>
                </div>
            </div>
            <div class="filter-modal-footer">
                <button class="btn-secondary" onclick="window.closeFilterModal(this)">Cancelar</button>
                <button class="btn-primary" onclick="window.applyFilters('${mayoristaId}')">
                    <i class="codicon codicon-check"></i> Aplicar Filtros
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const colorContainer = document.getElementById(`colorFilters-${mayoristaId}`);
    colorOptions.forEach(color => {
        const div = document.createElement('div');
        div.className = 'filter-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `color-${mayoristaId}-${color}`;
        checkbox.value = color;
        checkbox.checked = mayoristaFilters[mayoristaId].excludedColors.includes(color);

        const label = document.createElement('label');
        label.htmlFor = `color-${mayoristaId}-${color}`;
        label.textContent = color;

        div.appendChild(checkbox);
        div.appendChild(label);
        colorContainer.appendChild(div);
    });

    const tallaContainer = document.getElementById(`tallaFilters-${mayoristaId}`);
    tallaOptions.forEach(talla => {
        const div = document.createElement('div');
        div.className = 'filter-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `talla-${mayoristaId}-${talla}`;
        checkbox.value = talla;
        checkbox.checked = mayoristaFilters[mayoristaId].excludedTallas.includes(talla);

        const label = document.createElement('label');
        label.htmlFor = `talla-${mayoristaId}-${talla}`;
        label.textContent = talla;

        div.appendChild(checkbox);
        div.appendChild(label);
        tallaContainer.appendChild(div);
    });

    setTimeout(() => modal.classList.add('show'), 10);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeFilterModal(modal); });
    modal.dataset.mayoristaId = mayoristaId;
}

function closeFilterModal(element) {
    const modal = element.closest('.filter-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => { if (modal.parentNode) modal.remove(); }, 300);
    }
}

function applyFilters(mayoristaId) {
    mayoristaFilters[mayoristaId].excludedColors = Array.from(
        document.querySelectorAll(`#colorFilters-${mayoristaId} input[type="checkbox"]:checked`)
    ).map(cb => cb.value);

    mayoristaFilters[mayoristaId].excludedTallas = Array.from(
        document.querySelectorAll(`#tallaFilters-${mayoristaId} input[type="checkbox"]:checked`)
    ).map(cb => cb.value);

    const modal = document.querySelector('.filter-modal');
    if (modal) closeFilterModal(modal);

    const excludedColorsCount = mayoristaFilters[mayoristaId].excludedColors.length;
    const excludedTallasCount = mayoristaFilters[mayoristaId].excludedTallas.length;
    let message = 'Filtros aplicados';
    if (excludedColorsCount > 0 || excludedTallasCount > 0) {
        message += ` - Excluidos: ${excludedColorsCount} colores, ${excludedTallasCount} tallas`;
    }
    showMessage(message, 'success', 2000);

    const globalInput = document.querySelector(`.global-mayorista-input[data-mayorista="${mayoristaId}"]`);
    const valorGlobal = parseInt(globalInput?.value) || 0;

    if (valorGlobal > 0) {
        const distributeBtn = document.querySelector(`.distribute-btn[data-mayorista="${mayoristaId}"]`);
        if (distributeBtn) distributeBtn.click();
    }
}

// ============================================
// DISTRIBUCIÓN INTELIGENTE
// ============================================

function smartDistribution(availableRows, totalQty) {
    const strategySelect = document.getElementById('distributionStrategy');
    const strategy = strategySelect ? strategySelect.value : 'SECTORIZED';

    switch (strategy) {
        case 'EQUAL':
            return distributeEqual(availableRows, totalQty);
        case 'WEIGHTED':
            return distributeWeighted(availableRows, totalQty);
        case 'SECTORIZED':
            return distributeSectorized(availableRows, totalQty);
        default:
            return distributeSectorized(availableRows, totalQty);
    }
}

/**
 * Ajuste final garantizado: suma exactamente totalQty sin exceder tdm por fila.
 * Si el stock total disponible es menor que totalQty, retorna null (imposible).
 */
function enforceExactTotal(distributed, totalQty) {
    const totalAvailable = distributed.reduce((sum, r) => sum + r.tdm, 0);
    if (totalAvailable < totalQty) return null; // stock insuficiente

    let current = distributed.reduce((sum, r) => sum + r.assigned, 0);

    // Si sobran unidades asignadas, quitar de a 1 empezando por las de menor stock
    if (current > totalQty) {
        const sorted = [...distributed].sort((a, b) => a.tdm - b.tdm);
        for (let i = 0; i < sorted.length && current > totalQty; i++) {
            const reduce = Math.min(sorted[i].assigned, current - totalQty);
            sorted[i].assigned -= reduce;
            current -= reduce;
        }
    }

    // Si faltan unidades, agregar de a 1 donde haya espacio
    if (current < totalQty) {
        const sorted = [...distributed].sort((a, b) => (b.tdm - b.assigned) - (a.tdm - a.assigned));
        for (let i = 0; i < sorted.length && current < totalQty; i++) {
            const space = sorted[i].tdm - sorted[i].assigned;
            if (space > 0) {
                sorted[i].assigned += 1;
                current += 1;
            }
        }
    }

    return distributed;
}

/**
 * DISTRIBUCIÓN EQUILIBRADA (Equal)
 * Reparte partes iguales entre todas las filas disponibles.
 */
function distributeEqual(availableRows, totalQty) {
    const itemCount = availableRows.length;
    const basePerItem = Math.floor(totalQty / itemCount);

    let distributed = availableRows.map(row => ({
        ...row,
        assigned: Math.min(basePerItem, row.tdm)
    }));

    return enforceExactTotal(distributed, totalQty);
}

/**
 * DISTRIBUCIÓN PONDERADA (Weighted)
 * Proporcional al stock disponible por fila.
 */
function distributeWeighted(availableRows, totalQty) {
    const totalAvailable = availableRows.reduce((sum, row) => sum + row.tdm, 0);
    if (totalAvailable === 0) return availableRows.map(r => ({ ...r, assigned: 0 }));

    let distributed = availableRows.map(row => {
        const weight = row.tdm / totalAvailable;
        const assigned = Math.min(Math.floor(weight * totalQty), row.tdm);
        return { ...row, assigned };
    });

    return enforceExactTotal(distributed, totalQty);
}

/**
 * ESTRATEGIA SECTORIZADA (Core Curve)
 * Prioriza tallas M, L, 8, 10, 12, 34, 36
 */
function distributeSectorized(availableRows, totalQty) {
    const coreRows = availableRows.filter(row => CORE_SIZES.includes(row.talla));
    if (coreRows.length === 0) return distributeWeighted(availableRows, totalQty);

    const weightMultiplier = 2.0;
    let weightedTotal = 0;
    availableRows.forEach(row => {
        weightedTotal += row.tdm * (CORE_SIZES.includes(row.talla) ? weightMultiplier : 1.0);
    });

    let distributed = availableRows.map(row => {
        const isCore = CORE_SIZES.includes(row.talla);
        const weight = (row.tdm * (isCore ? weightMultiplier : 1.0)) / weightedTotal;
        const assigned = Math.min(Math.floor(weight * totalQty), row.tdm);
        return { ...row, assigned, isCore };
    });

    return enforceExactTotal(distributed, totalQty);
}


// ============================================
// GUARDADO DE DISTRIBUCIÓN
// ============================================

function prepareDistributionDataFormat() {
    if (!currentRecData) {
        showMessage('No hay datos de REC cargados', 'error');
        return null;
    }

    const recNumber = document.getElementById('recInput').value.trim();
    if (!recNumber) {
        showMessage('Ingrese un número de REC', 'error');
        return null;
    }

    const distributionData = { Documento: recNumber, Clientes: {} };

    const empresaPrincipal = empresasData.find(([id, config]) => config.tipoEmpresa === "Principal");
    const empresasSecundarias = empresasData.filter(([id, config]) => config.tipoEmpresa === "Secundaria");

    let porcentajePrincipal = 100;
    empresasSecundarias.forEach(([id, config]) => {
        const input = document.getElementById(`empresa-${id}`);
        if (input && input.value) porcentajePrincipal -= parseInt(input.value) || 0;
    });
    porcentajePrincipal = Math.max(0, porcentajePrincipal);

    empresasData.forEach(([id, config]) => {
        const clienteNombre = config.nombreCorto;
        let porcentajeCliente = config.tipoEmpresa === "Principal"
            ? porcentajePrincipal
            : (parseInt(document.getElementById(`empresa-${id}`)?.value) || 0);

        let totalEmpresa = config.tipoEmpresa === "Principal"
            ? parseInt(document.querySelector('.principal-total')?.textContent) || 0
            : parseInt(document.querySelector(`.secundaria-total[data-empresa="${id}"]`)?.textContent) || 0;

        if (totalEmpresa > 0 && currentRecData.HR) {
            const distribucion = [];

            currentRecData.HR.forEach((row, rowIndex) => {
                const codigo = row[0] || '';
                const color = row[1] || '';
                const talla = row[2] || '';

                let cantidadEmpresa = 0;
                if (config.tipoEmpresa === "Principal") {
                    const principalCell = document.querySelector(`.principal-cell[data-row="${rowIndex}"]`);
                    cantidadEmpresa = parseInt(principalCell?.textContent) || 0;
                } else {
                    const secundariaCell = document.querySelector(`.secundaria-cell[data-row="${rowIndex}"][data-empresa="${id}"]`);
                    cantidadEmpresa = parseInt(secundariaCell?.textContent) || 0;
                }

                if (cantidadEmpresa > 0) {
                    distribucion.push({ codigo, color, talla, cantidad: cantidadEmpresa });
                }
            });

            if (distribucion.length > 0) {
                const clienteData = { id, distribucion };
                if (porcentajeCliente > 0) clienteData.porcentaje = `${porcentajeCliente}%`;
                distributionData.Clientes[clienteNombre] = clienteData;
            }
        }
    });

    activeMayoristas.forEach(mayorista => {
        const totalElement = document.querySelector(`.mayorista-total[data-mayorista="${mayorista.id}"]`);
        const totalMayorista = parseInt(totalElement?.textContent) || 0;

        if (totalMayorista > 0 && currentRecData.HR) {
            const distribucion = [];
            currentRecData.HR.forEach((row, rowIndex) => {
                const codigo = row[0] || '';
                const color = row[1] || '';
                const talla = row[2] || '';

                const input = document.querySelector(`.mayorista-input[data-row="${rowIndex}"][data-mayorista="${mayorista.id}"]`);
                const cantidadMayorista = parseInt(input?.value) || 0;

                if (cantidadMayorista > 0) {
                    distribucion.push({ codigo, color, talla, cantidad: cantidadMayorista });
                }
            });

            if (distribucion.length > 0) {
                distributionData.Clientes[mayorista.nombre] = { id: mayorista.id, distribucion };
            }
        }
    });

    return distributionData;
}

async function saveDistributionToSheets() {
    const distributionData = prepareDistributionDataFormat();
    if (!distributionData || Object.keys(distributionData.Clientes).length === 0) {
        showMessage('No hay datos de distribución para guardar', 'warning');
        return;
    }

    const recNumber = distributionData.Documento;
    const checkResult = await checkIfRecExists(recNumber);

    // Preparar resumen
    const clientesCount = Object.keys(distributionData.Clientes).length;
    let totalItems = 0;

    Object.values(distributionData.Clientes).forEach(cliente => {
        if (cliente.distribucion) {
            totalItems += cliente.distribucion.length;
        }
    });

    const clientesResumen = Object.keys(distributionData.Clientes)
        .map(nombre => `• ${nombre}`)
        .join('<br>');

    const actionType = checkResult.exists ? 'actualizar' : 'crear_nuevo';

    const finalConfirm = await showQuickConfirm(
        'Confirmar Guardado Final',
        `<strong>${actionType === 'actualizar' ? 'ACTUALIZACIÓN' : 'NUEVO REGISTRO'}</strong><br><br>
         • Documento: <strong>${recNumber}</strong><br>
         • Tipo: ${actionType === 'actualizar' ? 'Actualización' : 'Nuevo'}<br>
         • Clientes: ${clientesCount}<br>
         • Items totales: ${totalItems}<br><br>
         <strong>Clientes incluidos:</strong><br>
         ${clientesResumen}`,
        actionType === 'actualizar' ? 'Actualizar' : 'Guardar',
        'Cancelar',
        actionType === 'actualizar' ? 'warning' : 'info'
    );

    if (!finalConfirm) return;

    const loadingMessage = actionType === 'actualizar'
        ? `Actualizando documento ${recNumber}...`
        : `Guardando documento ${recNumber}...`;

    const loading = showQuickLoading(loadingMessage);
    const saveBtn = document.getElementById('saveDistributionsBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="loading-spinner"></span>`;
    }

    try {
        await sendToDistributionGAS(distributionData);
        await new Promise(resolve => setTimeout(resolve, 2000));
        const verification = await verifyDocumentSavedExhaustive(recNumber);

        _refreshPrintBackground();

        // Capturar mayoristas con pedidos ANTES de finalizarlos
        let mayoristasConPedidos = [];
        if (typeof getPedidosPendientesParaLote === 'function' && currentRecData) {
            const pedidosPorMayorista = getPedidosPendientesParaLote(currentRecData.LOTE || currentRecData.A);
            mayoristasConPedidos = Object.keys(pedidosPorMayorista);
        }

        if (typeof marcarPedidosCompletados === 'function' && currentRecData) {
            marcarPedidosCompletados(currentRecData.LOTE || currentRecData.A);
        }
        
        // Desmarcar mayoristas que tenían pedidos para este lote
        desmarcarMayoristasConPedidosCompletados(mayoristasConPedidos);

        if (verification.success && verification.verified) {
            const successType = actionType === 'actualizar' ? 'actualizado' : 'guardado';
            showMessage(
                `${recNumber} ${successType} exitosamente (Fila: ${verification.fila})`,
                'success',
                5000
            );
        } else {
            showMessage(`${recNumber} enviado al sistema (verificación falló)`, 'warning', 5000);
        }
    } catch (error) {
        console.error('Error guardando distribución:', error);
        showMessage(`Error: ${error.message}`, 'error', 5000);
    } finally {
        loading.close();
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="codicon codicon-save"></i>';
        }
    }
}

function getNextAvailableSuffix(existingDocuments, baseRecNumber) {
    const suffixes = existingDocuments
        .map(doc => {
            const match = doc.toString().match(new RegExp(`^${baseRecNumber}\\.(\\d+)$`));
            return match ? parseInt(match[1]) : 0;
        })
        .filter(suffix => suffix > 0)
        .sort((a, b) => a - b);

    let nextSuffix = 1;
    for (const suffix of suffixes) {
        if (suffix === nextSuffix) nextSuffix++;
        else break;
    }
    return nextSuffix;
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function updateCounters() {
    const mayoristasActivos = Object.keys(allConfigData).filter(id => {
        const c = allConfigData[id];
        return c.tipoCliente === 'Mayorista' && c.estado && c.estado.toString().toUpperCase().trim() === 'ACTIVO';
    }).length;
    document.getElementById('empresas-count').textContent = empresasData.length;
    document.getElementById('mayoristas-count').textContent = mayoristasActivos;
}

function updateEmpresaPercentage(event) {
    const input = event.target;
    let value = parseInt(input.value) || 0;
    value = Math.max(0, Math.min(100, value));
    input.value = value;
    updatePrincipalValue();
    updateAllDistributionValues();
}

function updatePrincipalValue() {
    const principal = empresasData.find(([id, config]) => config.tipoEmpresa === "Principal");
    if (!principal) return;

    const principalInput = document.getElementById(`empresa-${principal[0]}`);
    if (!principalInput) return;

    let totalSecundarias = 0;
    empresasData.forEach(([id, config]) => {
        if (config.tipoEmpresa === "Secundaria") {
            const input = document.getElementById(`empresa-${id}`);
            if (input) totalSecundarias += parseInt(input.value) || 0;
        }
    });

    principalInput.value = 100 - totalSecundarias;
}

function adjustRecInput(delta) {
    const recInput = document.getElementById('recInput');
    if (!recInput) return;

    let currentValue = parseInt(recInput.value) || 0;
    let newValue = Math.max(0, currentValue + delta);
    recInput.value = newValue;
    searchDistributionRec();
    recInput.focus();
}

// En distribution.js
function setupRecInputKeyboardSupport() {
    const recInput = document.getElementById('recInput');
    if (!recInput) return;

    // --- IMPORTANTE: Eliminar listeners anteriores para evitar duplicados ---
    recInput.removeEventListener('keydown', handleRecInputKeyDown);
    recInput.addEventListener('keydown', handleRecInputKeyDown);
}

// Separamos el manejador para poder removerlo fácilmente
function handleRecInputKeyDown(event) {
    // Aseguramos que currentValue sea un número, incluso si el input está vacío
    const recInput = event.target;
    let currentValue = parseInt(recInput.value, 10) || 0;

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        recInput.value = currentValue + 1;
        // Disparamos el evento 'input' para que searchDistributionRec se ejecute
        recInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        // Evitamos valores negativos
        const newValue = Math.max(0, currentValue - 1);
        if (newValue !== currentValue) {
            recInput.value = newValue;
            recInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
}


function adjustGlobalValue(mayoristaId, delta) {
    const input = document.getElementById(`global-input-${mayoristaId}`);
    if (!input) return;

    let currentValue = parseInt(input.value) || 0;
    let newValue = Math.max(0, currentValue + delta);
    if (newValue !== currentValue) {
        input.value = newValue;
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
    }
}

function adjustEmpresaValue(empresaId, delta) {
    const input = document.getElementById(`empresa-${empresaId}`);
    if (!input || input.readOnly) return;

    let currentValue = parseInt(input.value) || 0;
    let newValue = Math.max(0, Math.min(100, currentValue + (delta * 10)));
    if (newValue !== currentValue) {
        input.value = newValue;
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
    }
}

function adjustDistValue(mayoristaId, rowIndex, delta) {
    const inputSelector = `.mayorista-input[data-row="${rowIndex}"][data-mayorista="${mayoristaId}"]`;
    const input = document.querySelector(inputSelector);
    if (!input) return;

    let currentValue = parseInt(input.value) || 0;
    let newValue = currentValue + delta;
    const max = parseInt(input.getAttribute('max')) || 999999;
    const min = parseInt(input.getAttribute('min')) || 0;

    newValue = Math.max(min, Math.min(max, newValue));
    if (newValue !== currentValue) {
        input.value = newValue;
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
    }
}

function selectAllMayoristas() {
    document.querySelectorAll('#mayoristasContainer input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));
    });
}

function deselectAllMayoristas() {
    document.querySelectorAll('#mayoristasContainer input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));
    });
}

function resetEmpresas() {
    empresasData.forEach(([id, config]) => {
        const input = document.getElementById(`empresa-${id}`);
        if (input && config.tipoEmpresa === "Secundaria") {
            input.value = '0';
        }
    });
    updatePrincipalValue();
    updateAllDistributionValues();
}

function distributeEmpresasEqually() {
    const empresaInputs = document.querySelectorAll('.empresa-item input[type="number"]:not(.principal-input)');
    if (empresaInputs.length === 0) return;

    const secondEmpresaInput = empresaInputs[0];
    const values = [30, 0, 100];
    setEmpresasDistributionState((empresasDistributionState + 1) % values.length);
    const newValue = values[empresasDistributionState];

    secondEmpresaInput.value = newValue;
    const event = new Event('input', { bubbles: true });
    secondEmpresaInput.dispatchEvent(event);
}

function clearEmpresasValues() {
    const empresaInputs = document.querySelectorAll('.empresa-item input[type="number"]:not(.principal-input)');
    empresaInputs.forEach(input => {
        input.value = 0;
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
    });
    setEmpresasDistributionState(0);
}

function formatCellValue(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function handleError(error) {
    console.error("Error en módulo de distribución:", error);
    document.getElementById('distribution-loading').style.display = 'none';
    document.getElementById('distribution-main').style.display = 'block';
    document.getElementById('distribution-result').innerHTML = `
        <div class="error-state">
            <i class="codicon codicon-error"></i>
            <h5>Error al cargar datos</h5>
            <p>${error.message}</p>
            <button class="btn-primary" onclick="window.initializeDistribution()">Reintentar</button>
        </div>
    `;
}

function reloadAllDistributionData() {
    document.getElementById('distribution-loading').style.display = 'flex';
    document.getElementById('distribution-main').style.display = 'none';
    initializeDistribution();
}

function showModuleSettings() {
    const savedStrategy = localStorage.getItem('defaultDistributionStrategy') || 'SECTORIZED';
    const savedDefaultSecondary = localStorage.getItem('defaultSecondaryPercentage') || '0';
    const savedMinQuantityRule = localStorage.getItem('minQuantityForDistribution') || '120';

    // Obtener empresas secundarias disponibles
    const empresasSecundarias = empresasData.filter(([id, config]) => config.tipoEmpresa === "Secundaria");
    
    let secondaryOptions = '<option value="">Ninguna</option>';
    empresasSecundarias.forEach(([id, config]) => {
        secondaryOptions += `<option value="${id}">${config.nombreCorto}</option>`;
    });

    const savedSecondaryCompany = localStorage.getItem('defaultSecondaryCompany') || '';

    createModal('Configuración del Módulo de Distribución', `
        <div style="padding: 16px 0;">
            <div class="form-group">
                <label for="defaultStrategy" style="margin-bottom: 8px; display: block;">Estrategia Predeterminada</label>
                <select id="defaultStrategy" class="form-control">
                    <option value="EQUAL" ${savedStrategy === 'EQUAL' ? 'selected' : ''}>Distribución Equilibrada (Lineal)</option>
                    <option value="WEIGHTED" ${savedStrategy === 'WEIGHTED' ? 'selected' : ''}>Distribución Ponderada (Proporcional)</option>
                    <option value="SECTORIZED" ${savedStrategy === 'SECTORIZED' ? 'selected' : ''}>Estrategia Sectorizada (Curva Core)</option>
                </select>
                <small style="color: var(--text-secondary); display: block; margin-top: 4px;">Esta estrategia se seleccionará automáticamente al cargar el módulo.</small>
            </div>
            
            <div class="form-group" style="margin-top: 20px;">
                <label for="defaultSecondaryCompany" style="margin-bottom: 8px; display: block;">Empresa Secundaria Predeterminada</label>
                <select id="defaultSecondaryCompany" class="form-control">
                    ${secondaryOptions}
                </select>
                <small style="color: var(--text-secondary); display: block; margin-top: 4px;">Esta empresa se configurará automáticamente al inicio de cada distribución.</small>
            </div>
            
            <div class="form-group" style="margin-top: 20px;">
                <label for="defaultSecondaryPercentage" style="margin-bottom: 8px; display: block;">Porcentaje Predeterminado para Empresa Secundaria</label>
                <input type="number" id="defaultSecondaryPercentage" class="form-control" min="0" max="100" value="${savedDefaultSecondary}">
                <small style="color: var(--text-secondary); display: block; margin-top: 4px;">Porcentaje que se asignará automáticamente a la empresa secundaria seleccionada.</small>
            </div>
            
            <div class="form-group" style="margin-top: 20px;">
                <label for="minQuantityForDistribution" style="margin-bottom: 8px; display: block;">Cantidad Mínima para Permitir Distribución</label>
                <input type="number" id="minQuantityForDistribution" class="form-control" min="0" value="${savedMinQuantityRule}">
                <small style="color: var(--text-secondary); display: block; margin-top: 4px;">Si la cantidad total es inferior a este valor, la distribución será 100% para la empresa principal (sin partición).</small>
            </div>
            
            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cerrar</button>
                <button class="btn-primary" onclick="saveModuleSettings(this)">Guardar Configuración</button>
            </div>
        </div>
    `, true);
    
    // Establecer el valor guardado después de crear el modal
    setTimeout(() => {
        const companySelect = document.getElementById('defaultSecondaryCompany');
        if (companySelect) companySelect.value = savedSecondaryCompany;
    }, 0);
}

function saveModuleSettings(btn) {
    const strategy = document.getElementById('defaultStrategy').value;
    const secondaryCompany = document.getElementById('defaultSecondaryCompany').value;
    const secondaryPercentage = document.getElementById('defaultSecondaryPercentage').value;
    const minQuantity = document.getElementById('minQuantityForDistribution').value;
    
    localStorage.setItem('defaultDistributionStrategy', strategy);
    localStorage.setItem('defaultSecondaryCompany', secondaryCompany);
    localStorage.setItem('defaultSecondaryPercentage', secondaryPercentage);
    localStorage.setItem('minQuantityForDistribution', minQuantity);

    const currentSelect = document.getElementById('distributionStrategy');
    if (currentSelect) currentSelect.value = strategy;

    if (typeof showMessage === 'function') showMessage('Configuración guardada correctamente', 'success', 1500);
    
    // Cerrar modal actual
    const modal = btn ? btn.closest('.modal') : document.querySelector('.modal');
    if (modal) modal.remove();

    if (currentRecData) {
        recalculateActiveDistributions();
    }
}


function previewDistributionFormat() {
    const data = prepareDistributionDataFormat();
    if (!data) return;

    createModal('Previsualización del Formato', `
        <div style="max-height: 500px; overflow-y: auto;">
            <h4>Documento: ${data.Documento}</h4>
            <p><strong>Total Clientes:</strong> ${Object.keys(data.Clientes).length}</p>
            <div style="margin: 20px 0;">
                <h5>Clientes incluidos:</h5>
                <ul>
                    ${Object.entries(data.Clientes).map(([nombre, cliente]) => `
                        <li>
                            <strong>${nombre}</strong> (ID: ${cliente.id})
                            <br>Porcentaje: ${cliente.porcentaje || 'N/A'}
                            <br>Items: ${cliente.distribucion ? cliente.distribucion.length : 0}
                        </li>
                    `).join('')}
                </ul>
            </div>
            <div style="background: var(--sidebar); padding: 12px; border-radius: 6px; margin-top: 20px;">
                <h5>JSON Minificado:</h5>
                <pre style="font-size: 10px; overflow-x: auto; white-space: pre-wrap;">${JSON.stringify(data)}</pre>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cerrar</button>
                <button class="btn-primary" onclick="saveDistributionToSheets(); this.closest('.modal').remove()">
                    <i class="codicon codicon-save"></i> Guardar
                </button>
            </div>
        </div>
    `);
}

function addPreviewButton() {
    const headerActions = document.querySelector('#distribution-content .header-actions');
    if (headerActions && !document.getElementById('previewFormatBtn')) {
        const previewBtn = document.createElement('button');
        previewBtn.className = 'btn-icon';
        previewBtn.id = 'previewFormatBtn';
        previewBtn.title = 'Previsualizar formato JSON';
        previewBtn.innerHTML = '<i class="codicon codicon-eye"></i>';
        previewBtn.addEventListener('click', previewDistributionFormat);
        headerActions.insertBefore(previewBtn, headerActions.firstChild);
    }
}

function setupDistributionEventListeners() {
    // La vinculación de saveDistributionsBtn se gestiona ahora de forma centralizada 
    // en js/core/app.js para evitar ejecuciones duplicadas.
    const saveBtn = document.getElementById('saveDistributionsBtn');
    if (saveBtn) {
        saveBtn.title = "Guardar distribución en Google Sheets";
    }

    const strategySelect = document.getElementById('distributionStrategy');
    if (strategySelect) {
        // Cargar predeterminado de localStorage
        const savedStrategy = localStorage.getItem('defaultDistributionStrategy');
        if (savedStrategy) strategySelect.value = savedStrategy;

        strategySelect.addEventListener('change', () => {
            recalculateActiveDistributions();
        });
    }

    addPreviewButton();
    setupRecInputKeyboardSupport();

    document.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            if (document.getElementById('distribution-content').classList.contains('active')) {
                saveDistributionToSheets();
            }
        }
    });
}

function saveAllDistributionsFast() {
    showMessage('Función de guardar no implementada en esta versión', 'info');
}

/**
 * RECALCULA LAS DISTRIBUCIONES ACTIVAS
 * Se llama cuando cambia la estrategia para que se aplique de inmediato
 */
function recalculateActiveDistributions() {
    activeMayoristas.forEach(mayorista => {
        const input = document.querySelector(`.global-mayorista-input[data-mayorista="${mayorista.id}"]`);
        if (input && parseInt(input.value) > 0) {
            // Simulamos el evento para disparar la distribución
            const pseudoEvent = { target: { closest: () => ({ dataset: { mayorista: mayorista.id } }) } };
            distributeGlobalQuantity(pseudoEvent);
        }
    });
}

// Exponer funciones globalmente para los event handlers inline
window.adjustGlobalValue = adjustGlobalValue;
window.adjustDistValue = adjustDistValue;
window.openFilterModal = openFilterModal;
window.closeFilterModal = closeFilterModal;
window.applyFilters = applyFilters;
window.initializeDistribution = initializeDistribution;
window.recalculateActiveDistributions = recalculateActiveDistributions;
window.saveModuleSettings = saveModuleSettings;
window._refreshDistributionBackground = _refreshDistributionBackground;
window._refreshPrintBackground = _refreshPrintBackground;