/**
 * js/ui/precios-update-modal.js
 * Sincronización de Precios desde archivos XLS
 */

function showPreciosUpdateModal() {
    openAdminTab('precios', 'Precios', 'codicon-tag', renderPreciosUpdateUI);
}

function renderPreciosUpdateUI(container) {
    if (!container) container = document.getElementById('adminTabEntryPoint');
    if (!container) return;

    container.innerHTML = `
        <div class="section-content">
            <!-- Diseño idéntico al Procesador CSV -->
            <div class="file-upload-area">
                <div class="upload-box empty-state" id="preciosDropZone" 
                    onclick="document.getElementById('preciosXlsxFiles').click()"
                    ondragover="event.preventDefault(); this.classList.add('drag-active')" 
                    ondragleave="this.classList.remove('drag-active')"
                    ondrop="event.preventDefault(); this.classList.remove('drag-active'); handlePreciosFileDrop(event)">
                    <i class="fa-solid fa-file-excel upload-icon" id="preciosUploadIcon"></i>
                    <h5>Sincronización de Precios</h5>
                    <p>Cargue uno o varios archivos .xls o .xlsx con las columnas: lista, nombre, referen, costo, precio, listaalter</p>
                    <p style="font-size: 11px; opacity: 0.7; margin-top: 8px;">Solo se procesarán registros donde lista = "0001"</p>
                    <input type="file" id="preciosXlsxFiles" accept=".xls,.xlsx" multiple hidden onchange="handlePreciosFileSelect(this)">
                </div>
            </div>

            <!-- Panel de Resultados -->
            <div class="results-panel" id="preciosPreviewArea" style="display:none; border-top: 1px solid var(--border); margin-top: 24px; border-radius: 4px; background: var(--bg-dark);">
                <div style="padding: 24px;">
                    <!-- Cabecera de reporte con estadísticas -->
                    <div id="preciosStats" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
                        <!-- Dinámico -->
                    </div>
                    
                    <div style="margin-bottom: 8px; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Detalle de Sincronización Pendiente</div>
                    
                    <div style="max-height: 450px; overflow-y: auto; border: 1px solid var(--border); border-radius: 4px;">
                        <table class="data-table">
                            <thead style="position: sticky; top: 0; z-index: 10;">
                                <tr>
                                    <th style="width: 100px; text-align: left;">Operación</th>
                                    <th style="width: 200px; text-align: left;">Referencia</th>
                                    <th style="text-align: right;">Precio</th>
                                    <th style="width: 150px; text-align: left;">Archivo</th>
                                </tr>
                            </thead>
                            <tbody id="preciosPreviewList">
                                <!-- Dinámico -->
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
                        <button class="btn-secondary" onclick="resetPreciosUI()" style="height: 42px; padding: 0 20px;">
                            Limpiar
                        </button>
                        <button class="btn-primary" id="preciosSaveBtn" onclick="savePreciosUpdate()" style="height: 42px; padding: 0 32px; font-weight: 700; background: var(--success); border-color: var(--success);">
                            <i class="codicon codicon-cloud-upload"></i> Sincronizar con Supabase
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function resetPreciosUI() {
    const area = document.getElementById('preciosPreviewArea');
    if (area) area.style.display = 'none';
    preciosNuevosRegistros = [];
    const icon = document.getElementById('preciosUploadIcon');
    if (icon) {
        icon.style.color = '';
        icon.style.transition = 'color 0.3s ease';
    }
}

function handlePreciosFileDrop(event) {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) processPreciosXlsxFiles(Array.from(files));
}

function handlePreciosFileSelect(input) {
    const files = input.files;
    if (files.length > 0) processPreciosXlsxFiles(Array.from(files));
    input.value = '';
}

let preciosNuevosRegistros = [];

async function processPreciosXlsxFiles(files) {
    // Filtrar solo archivos Excel
    const excelFiles = files.filter(f => f.name.match(/\.(xls|xlsx)$/i));
    
    if (excelFiles.length === 0) {
        showMessage('Por favor cargue archivos Excel válidos (.xls o .xlsx)', 'error');
        return;
    }

    const loading = showQuickLoading(`Procesando ${excelFiles.length} archivo(s)...`);
    preciosNuevosRegistros = [];

    const icon = document.getElementById('preciosUploadIcon');
    if (icon) {
        icon.style.transition = 'color 0.3s ease';
        icon.style.color = '#0078d4'; 
    }

    try {
        let totalProcesados = 0;
        let totalFiltrados = 0;

        // Procesar cada archivo
        for (const file of excelFiles) {
            const data = await readExcelFile(file);
            const { procesados, filtrados } = processPreciosData(data, file.name);
            totalProcesados += procesados;
            totalFiltrados += filtrados;
        }

        loading.close();

        if (preciosNuevosRegistros.length === 0) {
            showMessage(`No se encontraron registros con lista = "0001" en los archivos`, 'warning', 3000);
            resetPreciosUI();
            return;
        }

        // Mostrar preview
        renderPreciosPreview(totalProcesados, totalFiltrados);
        
        if (icon) {
            icon.style.color = '#10b981';
        }

        showMessage(`${preciosNuevosRegistros.length} precios listos para sincronizar`, 'success', 2000);

    } catch (error) {
        loading.close();
        Logger.error('precios-update', 'Error procesando archivos', error);
        showMessage('Error: ' + error.message, 'error', 4000);
        if (icon) {
            icon.style.color = '#ef4444';
        }
    }
}

async function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // Silenciar warnings de XLSX
                const originalWarn = console.warn;
                const originalError = console.error;
                console.warn = function(...args) {
                    const msg = args.join(' ');
                    if (!msg.includes('Missing Info for XLS Record')) {
                        originalWarn.apply(console, args);
                    }
                };
                console.error = function(...args) {
                    const msg = args.join(' ');
                    if (!msg.includes('Missing Info for XLS Record')) {
                        originalError.apply(console, args);
                    }
                };

                const workbook = XLSX.read(e.target.result, { 
                    type: 'binary',
                    cellDates: true,
                    cellNF: false,
                    cellText: false,
                    WTF: false
                });
                
                console.warn = originalWarn;
                console.error = originalError;
                
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                resolve(XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }));
            } catch (err) {
                reject(new Error('Error al leer el archivo Excel. Intente guardarlo como .xlsx (Excel moderno) y vuelva a intentar.'));
            }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsBinaryString(file);
    });
}

function processPreciosData(rows, fileName) {
    if (!rows || rows.length < 2) {
        throw new Error(`Archivo ${fileName} vacío o sin datos`);
    }

    const headers = rows[0].map(h => String(h).trim().toLowerCase());
    
    // Buscar índices de columnas (case insensitive)
    const listaIdx = headers.findIndex(h => h === 'lista');
    const referenIdx = headers.findIndex(h => h === 'referen');
    const precioIdx = headers.findIndex(h => h === 'precio');

    if (listaIdx === -1 || referenIdx === -1 || precioIdx === -1) {
        throw new Error(`Archivo ${fileName}: Faltan columnas requeridas (lista, referen, precio)`);
    }

    let procesados = 0;
    let filtrados = 0;

    // Procesar filas (saltar header)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const lista = String(row[listaIdx] || '').trim();
        const referen = String(row[referenIdx] || '').trim();
        const precio = parseFloat(row[precioIdx]) || 0;

        procesados++;

        // Filtrar solo lista = "0001"
        if (lista !== '0001') continue;
        if (!referen) continue;
        if (precio <= 0) continue;

        filtrados++;

        // Agregar a registros
        preciosNuevosRegistros.push({
            referencia: referen,
            pvp: precio,
            fileName: fileName
        });
    }

    return { procesados, filtrados };
}

function renderPreciosPreview(totalProcesados, totalFiltrados) {
    const area = document.getElementById('preciosPreviewArea');
    if (!area) return;

    // Agrupar por operación (nuevo vs actualización)
    const existentes = new Set(Array.from(window.preciosMap.keys()));
    const nuevos = preciosNuevosRegistros.filter(p => !existentes.has(p.referencia));
    const actualizaciones = preciosNuevosRegistros.filter(p => existentes.has(p.referencia));

    // Stats
    const statsHtml = `
        <div class="stat-card">
            <div class="stat-value">${totalProcesados}</div>
            <div class="stat-label">Registros Procesados</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalFiltrados}</div>
            <div class="stat-label">Lista 0001</div>
        </div>
        <div class="stat-card" style="background: var(--success-bg); border-color: var(--success);">
            <div class="stat-value" style="color: var(--success);">${nuevos.length}</div>
            <div class="stat-label">Nuevos</div>
        </div>
        <div class="stat-card" style="background: var(--warning-bg); border-color: var(--warning);">
            <div class="stat-value" style="color: var(--warning);">${actualizaciones.length}</div>
            <div class="stat-label">Actualizaciones</div>
        </div>
    `;

    document.getElementById('preciosStats').innerHTML = statsHtml;

    // Lista de precios
    const listHtml = preciosNuevosRegistros.map(p => {
        const esNuevo = !existentes.has(p.referencia);
        const precioAnterior = existentes.has(p.referencia) ? window.preciosMap.get(p.referencia) : null;
        
        return `
            <tr>
                <td>
                    <span class="badge ${esNuevo ? 'badge-success' : 'badge-warning'}">
                        ${esNuevo ? 'NUEVO' : 'ACTUALIZAR'}
                    </span>
                </td>
                <td style="font-family: 'Courier New', monospace; font-weight: 600;">${p.referencia}</td>
                <td style="text-align: right;">
                    ${precioAnterior ? `<span style="text-decoration: line-through; opacity: 0.5; margin-right: 8px;">$${formatNumber(precioAnterior)}</span>` : ''}
                    <span style="font-weight: 700; color: var(--success);">$${formatNumber(p.pvp)}</span>
                </td>
                <td style="font-size: 11px; opacity: 0.7;">${p.fileName}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('preciosPreviewList').innerHTML = listHtml;
    area.style.display = 'block';
}

async function savePreciosUpdate() {
    if (!preciosNuevosRegistros.length) {
        showMessage('No hay precios para sincronizar', 'warning');
        return;
    }

    const btn = document.getElementById('preciosSaveBtn');
    if (!btn) return;

    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Sincronizando...';

    try {
        // Eliminar duplicados - si hay múltiples precios para la misma referencia, usar el MAYOR
        const preciosUnicos = new Map();
        preciosNuevosRegistros.forEach(p => {
            const precioActual = preciosUnicos.get(p.referencia);
            // Si no existe o el nuevo precio es mayor, actualizar
            if (!precioActual || p.pvp > precioActual) {
                preciosUnicos.set(p.referencia, p.pvp);
            }
        });

        // Preparar datos para Supabase
        const records = Array.from(preciosUnicos.entries()).map(([referencia, pvp]) => ({
            referencia: referencia,
            pvp: pvp
        }));

        const totalOriginal = preciosNuevosRegistros.length;
        const totalUnicos = records.length;
        const duplicados = totalOriginal - totalUnicos;

        Logger.info('precios-update', `Sincronizando ${totalUnicos} precios únicos (${duplicados} duplicados eliminados, se usó el precio más alto)`);

        // Guardar en Supabase usando UPSERT
        await supabase.upsert('precios', records, 'referencia');

        // Recargar precios
        await loadPreciosData();

        const mensaje = duplicados > 0 
            ? `${totalUnicos} precios sincronizados (${duplicados} duplicados resueltos con precio más alto)`
            : `${totalUnicos} precios sincronizados exitosamente`;
        
        showMessage(mensaje, 'success', 3000);
        
        // Limpiar UI
        resetPreciosUI();

    } catch (error) {
        Logger.error('precios-update', 'Error guardando precios', error);
        showMessage('Error al sincronizar: ' + error.message, 'error', 4000);
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

// Exports
window.showPreciosUpdateModal = showPreciosUpdateModal;
window.handlePreciosFileDrop = handlePreciosFileDrop;
window.handlePreciosFileSelect = handlePreciosFileSelect;
window.savePreciosUpdate = savePreciosUpdate;
window.resetPreciosUI = resetPreciosUI;
