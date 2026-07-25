/**
 * js/ui/sispro-update-modal.js
 * Sincronización de Códigos de Barras - Diseño Profesional Consistente
 */

function showSisproUpdateModal() {
    openAdminTab('barras', 'Códigos de Barras', 'codicon-package', renderBarrasUpdateUI);
}

function renderBarrasUpdateUI(container) {
    if (!container) container = document.getElementById('adminTabEntryPoint');
    if (!container) return;

    container.innerHTML = `
        <div class="section-content">
            <!-- Diseño idéntico al Procesador CSV -->
            <div class="file-upload-area">
                <div class="upload-box empty-state" id="barrasDropZone" 
                    onclick="document.getElementById('barrasXlsxFile').click()"
                    ondragover="event.preventDefault(); this.classList.add('drag-active')" 
                    ondragleave="this.classList.remove('drag-active')"
                    ondrop="event.preventDefault(); this.classList.remove('drag-active'); handleBarrasFileDrop(event)">
                    <i class="fa-solid fa-file-excel upload-icon" id="barrasUploadIcon"></i>
                    <h5>Sincronización de Códigos de Barras</h5>
                    <p>Cargue su archivo .xls o .xlsx con las columnas: estilo, talla, color, barra</p>
                    <input type="file" id="barrasXlsxFile" accept=".xls,.xlsx" hidden onchange="handleBarrasFileSelect(this)">
                </div>
            </div>

            <!-- Panel de Resultados -->
            <div class="results-panel" id="barrasPreviewArea" style="display:none; border-top: 1px solid var(--border); margin-top: 24px; border-radius: 4px; background: var(--bg-dark);">
                <div style="padding: 24px;">
                    <!-- Cabecera de reporte con estadísticas -->
                    <div id="barrasStats" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
                        <!-- Dinámico -->
                    </div>
                    
                    <div style="margin-bottom: 8px; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Detalle de Sincronización Pendiente</div>
                    
                    <div style="max-height: 450px; overflow-y: auto; border: 1px solid var(--border); border-radius: 4px;">
                        <table class="data-table">
                            <thead style="position: sticky; top: 0; z-index: 10;">
                                <tr>
                                    <th style="width: 100px; text-align: left;">Operación</th>
                                    <th style="width: 150px; text-align: left;">Referencia</th>
                                    <th style="width: 100px; text-align: left;">Talla</th>
                                    <th style="width: 100px; text-align: left;">Color</th>
                                    <th style="text-align: right;">Código de Barras</th>
                                </tr>
                            </thead>
                            <tbody id="barrasPreviewList">
                                <!-- Dinámico -->
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
                        <button class="btn-secondary" onclick="resetBarrasUI()" style="height: 42px; padding: 0 20px;">
                            Limpiar
                        </button>
                        <button class="btn-primary" id="barrasSaveBtn" onclick="saveBarrasUpdate()" style="height: 42px; padding: 0 32px; font-weight: 700; background: var(--success); border-color: var(--success);">
                            <i class="codicon codicon-cloud-upload"></i> Sincronizar con Supabase
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function resetBarrasUI() {
    const area = document.getElementById('barrasPreviewArea');
    if (area) area.style.display = 'none';
    barrasNuevosRegistros = [];
    const icon = document.getElementById('barrasUploadIcon');
    if (icon) {
        icon.style.color = '';
        icon.style.transition = 'color 0.3s ease';
    }
}

function handleBarrasFileDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) processBarrasXlsx(file);
}

function handleBarrasFileSelect(input) {
    const file = input.files[0];
    if (file) processBarrasXlsx(file);
    input.value = '';
}

let barrasNuevosRegistros = [];

async function processBarrasXlsx(file) {
    if (!file.name.match(/\.(xls|xlsx)$/i)) {
        showMessage('Por favor cargue un archivo Excel válido (.xls o .xlsx)', 'error');
        return;
    }

    const loading = showQuickLoading('Analizando estructura...');
    barrasNuevosRegistros = [];

    const icon = document.getElementById('barrasUploadIcon');
    if (icon) {
        icon.style.transition = 'color 0.3s ease';
        icon.style.color = '#0078d4'; 
    }

    try {
        const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    // Silenciar warnings específicos de XLSX
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

                    // Opciones para manejar archivos XLS antiguos
                    const workbook = XLSX.read(e.target.result, { 
                        type: 'binary',
                        cellDates: true,
                        cellNF: false,
                        cellText: false,
                        WTF: false // Silenciar warnings de registros desconocidos
                    });
                    
                    // Restaurar console original
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

        let totalXlsx = 0;
        const seen = new Set();
        let startRow = 1;

        // Validar que tenemos datos
        if (!data || data.length === 0) {
            throw new Error('El archivo Excel está vacío o no se pudo leer correctamente');
        }

        // Buscar la fila de encabezados
        for (let i = 0; i < Math.min(10, data.length); i++) {
            const row = data[i];
            if (!row || row.length === 0) continue;
            const hasEstilo = row.some(cell => cell && String(cell).toLowerCase().includes('estilo'));
            const hasBarra = row.some(cell => cell && String(cell).toLowerCase().includes('barra'));
            if (hasEstilo && hasBarra) {
                startRow = i + 1;
                break;
            }
        }

        // Procesar datos
        for (let i = startRow; i < data.length; i++) {
            const row = data[i];
            
            // Validar que la fila existe y tiene datos
            if (!row || row.length === 0) continue;
            
            // Columnas: estilo, talla, color, consecutiv, codigo, color_alt, usuario, fecha, digito, precio, empresa, barra, barra_a, cantidad, estado, identi
            const estilo = row[0] ? String(row[0]).trim() : '';
            const talla = row[1] ? String(row[1]).trim() : '';
            const color = row[2] ? String(row[2]).trim() : '';
            const barra = row[11] ? String(row[11]).trim() : ''; // Columna 12 (índice 11)

            // Validar que todos los campos requeridos existen y no están vacíos
            if (!estilo || !talla || !color || !barra) continue;
            
            // Validar que barra sea numérico o alfanumérico válido
            if (barra.length < 3) continue; // Códigos de barras muy cortos probablemente son errores
            
            totalXlsx++;
            const key = `${estilo}|${talla}|${color}`;
            if (seen.has(key)) continue;
            seen.add(key);

            // Verificar si ya existe en barrasMap
            const existente = window.barrasMap?.get(key);
            const esNuevo = !existente;
            const necesitaActualizar = existente && existente !== barra;

            if (esNuevo || necesitaActualizar) {
                barrasNuevosRegistros.push({
                    refprov: estilo,
                    talla: talla,
                    id_color: color,
                    barra: barra,
                    _esNuevo: esNuevo
                });
            }
        }

        const previewArea = document.getElementById('barrasPreviewArea');
        const statsEl = document.getElementById('barrasStats');
        const listEl = document.getElementById('barrasPreviewList');
        const saveBtn = document.getElementById('barrasSaveBtn');

        // Validar que se encontraron datos
        if (totalXlsx === 0) {
            showMessage('No se encontraron códigos de barras válidos en el archivo. Verifique que las columnas sean: estilo, talla, color, barra (columna 12)', 'warning');
            if (icon) icon.style.color = '';
            loading.close();
            return;
        }

        if (previewArea) {
            previewArea.style.display = 'block';
            previewArea.scrollIntoView({ behavior: 'smooth' });
        }

        const nuevos = barrasNuevosRegistros.filter(r => r._esNuevo).length;
        const updates = barrasNuevosRegistros.filter(r => !r._esNuevo).length;

        if (statsEl) statsEl.innerHTML = `
            <div style="background: var(--surface); border: 1px solid var(--border); padding: 16px; border-radius: 4px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: var(--text);">${totalXlsx}</div>
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Detectados en Excel</div>
            </div>
            <div style="background: var(--surface); border: 1px solid var(--success); padding: 16px; border-radius: 4px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: var(--success);">${nuevos}</div>
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Nuevas Barras</div>
            </div>
            <div style="background: var(--surface); border: 1px solid var(--warning); padding: 16px; border-radius: 4px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: var(--warning);">${updates}</div>
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">A Actualizar</div>
            </div>
            <div style="background: var(--surface); border: 1px solid var(--border); padding: 16px; border-radius: 4px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: var(--text-muted);">${totalXlsx - barrasNuevosRegistros.length}</div>
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Sin cambios</div>
            </div>
        `;

        if (listEl) {
            if (barrasNuevosRegistros.length === 0) {
                listEl.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:60px; color:var(--success); font-weight: 700;">Base de Datos de Barras al día. Sin cambios requeridos.</td></tr>';
            } else {
                listEl.innerHTML = barrasNuevosRegistros.slice(0, 50).map(r => `
                    <tr style="background: ${r._esNuevo ? 'rgba(13,188,121,0.03)' : 'rgba(255,140,0,0.03)'}; transition: background 0.1s;">
                        <td style="color: ${r._esNuevo ? 'var(--success)' : 'var(--warning)'}; font-weight: 800; font-size: 10px; text-transform: uppercase; text-align: left;">
                            ${r._esNuevo ? 'CREAR' : 'ACTUALIZAR'}
                        </td>
                        <td style="font-weight: 700; color: var(--primary); text-align: left;">${r.refprov}</td>
                        <td style="text-align: left;">${r.talla}</td>
                        <td style="text-align: left;">${r.id_color}</td>
                        <td style="text-align: right; color: var(--info); font-weight: 800; font-family: monospace;">${r.barra}</td>
                    </tr>
                `).join('') + (barrasNuevosRegistros.length > 50 ? `<tr><td colspan="5" style="text-align:center; padding:12px; font-size:11px; color:var(--text-muted); background: var(--surface);">... mostrando 50 de ${barrasNuevosRegistros.length} registros</td></tr>` : '');
            }
        }

        if (saveBtn) {
            saveBtn.style.display = barrasNuevosRegistros.length > 0 ? 'flex' : 'none';
            saveBtn.innerHTML = `<i class="codicon codicon-cloud-upload"></i> Guardar ${barrasNuevosRegistros.length} cambios`;
        }

    } catch (err) {
        showMessage('Error al procesar el archivo Excel: ' + err.message, 'error');
        console.error(err);
        if (icon) icon.style.color = '';
    } finally {
        loading.close();
    }
}

async function saveBarrasUpdate() {
    if (!barrasNuevosRegistros.length) return;
    const btn = document.getElementById('barrasSaveBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Sincronizando...';
    }

    try {
        await saveBarrasBatch(barrasNuevosRegistros);
        await loadBarrasData();
        barrasNuevosRegistros = [];
        showMessage(`${barrasNuevosRegistros.length} códigos de barras sincronizados exitosamente`, 'success');
        resetBarrasUI();
    } catch (err) {
        showMessage('Error al guardar en Supabase: ' + err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="codicon codicon-cloud-upload"></i> Reintentar Sincronización';
        }
    }
}

// Exports
window.showSisproUpdateModal = showSisproUpdateModal;
window.handleBarrasFileDrop = handleBarrasFileDrop;
window.handleBarrasFileSelect = handleBarrasFileSelect;
window.saveBarrasUpdate = saveBarrasUpdate;
window.resetBarrasUI = resetBarrasUI;
