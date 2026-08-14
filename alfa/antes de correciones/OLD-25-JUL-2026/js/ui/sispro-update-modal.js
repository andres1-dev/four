/**
 * js/ui/sispro-update-modal.js
 * Sincronización Maestra Productos SISPROWEB - Diseño Profesional Consistente
 */

function showSisproUpdateModal() {
    openAdminTab('productos', 'Productos', 'codicon-package', renderSisproUpdateUI);
}

function renderSisproUpdateUI(container) {
    if (!container) container = document.getElementById('adminTabEntryPoint');
    if (!container) return;

    container.innerHTML = `
        <div class="section-content">
            <!-- Diseño idéntico al Procesador CSV -->
            <div class="file-upload-area">
                <div class="upload-box empty-state" id="sisproDropZone" 
                    onclick="document.getElementById('sisproXlsxFile').click()"
                    ondragover="event.preventDefault(); this.classList.add('drag-active')" 
                    ondragleave="this.classList.remove('drag-active')"
                    ondrop="event.preventDefault(); this.classList.remove('drag-active'); handleSisproFileDrop(event)">
                    <!-- Se quita el color forzado #858585 para que herede del CSS general del upload-icon -->
                    <i class="fa-solid fa-file-excel upload-icon" id="sisproUploadIcon"></i>
                    <h5>Sincronización Maestra de Productos</h5>
                    <p>Cargue su archivo .xlsx para registrar automáticamente nuevos productos y actualizar referencias</p>
                    <input type="file" id="sisproXlsxFile" accept=".xls,.xlsx" hidden onchange="handleSisproFileSelect(this)">
                </div>
            </div>

            <!-- Panel de Resultados idéntico -->
            <div class="results-panel" id="sisproPreviewArea" style="display:none; border-top: 1px solid var(--border); margin-top: 24px; border-radius: 4px; background: var(--bg-dark);">
                <div style="padding: 24px;">
                    <!-- Cabecera de reporte con estadísticas -->
                    <div id="sisproStats" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
                        <!-- Dinámico -->
                    </div>
                    
                    <div style="margin-bottom: 8px; font-size: 11px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">Detalle de Sincronización Pendiente</div>
                    
                    <div style="max-height: 450px; overflow-y: auto; border: 1px solid var(--border); border-radius: 4px;">
                        <table class="data-table">
                            <thead style="position: sticky; top: 0; z-index: 10;">
                                <tr>
                                    <th style="width: 100px; text-align: left;">Operación</th>
                                    <th style="width: 120px; text-align: left;">OP</th>
                                    <th style="text-align: left;">Descripción Prenda</th>
                                    <th style="width: 150px; text-align: right;">Referencia</th>
                                </tr>
                            </thead>
                            <tbody id="sisproPreviewList">
                                <!-- Dinámico -->
                            </tbody>
                        </table>
                    </div>

                    <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
                        <button class="btn-secondary" onclick="resetSisproUI()" style="height: 42px; padding: 0 20px;">
                            Limpiar
                        </button>
                        <button class="btn-primary" id="sisproSaveBtn" onclick="saveSisproUpdate()" style="height: 42px; padding: 0 32px; font-weight: 700; background: var(--success); border-color: var(--success);">
                            <i class="codicon codicon-cloud-upload"></i> Sincronizar con Google Sheets
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function resetSisproUI() {
    const area = document.getElementById('sisproPreviewArea');
    if (area) area.style.display = 'none';
    sisproNuevosRegistros = [];
    const icon = document.getElementById('sisproUploadIcon');
    if (icon) {
        icon.style.color = ''; // Eliminar color inline para restaurar el del CSS
        icon.style.transition = 'color 0.3s ease';
    }
}

function handleSisproFileDrop(event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) processSisproXlsx(file);
}

function handleSisproFileSelect(input) {
    const file = input.files[0];
    if (file) processSisproXlsx(file);
    input.value = '';
}

let sisproNuevosRegistros = [];

async function processSisproXlsx(file) {
    if (!file.name.match(/\.(xls|xlsx)$/i)) {
        showMessage('Por favor cargue un archivo Excel válido (.xlsx)', 'error');
        return;
    }

    const loading = showQuickLoading('Analizando estructura...');
    sisproNuevosRegistros = [];

    // Cambiar color del icono a AZUL (#0078d4) mediante JS solo al procesar con éxito
    const icon = document.getElementById('sisproUploadIcon');
    if (icon) {
        icon.style.transition = 'color 0.3s ease';
        icon.style.color = '#0078d4'; 
    }

    try {
        const data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const workbook = XLSX.read(e.target.result, { type: 'binary' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                resolve(XLSX.utils.sheet_to_json(firstSheet, { header: 1 }));
            };
            reader.onerror = reject;
            reader.readAsBinaryString(file);
        });

        let totalXlsx = 0;
        const seen = new Set();
        let startRow = 1;

        for (let i = 0; i < data.length; i++) {
            const val = String(data[i][2] || '').trim();
            if (val && !isNaN(val)) { startRow = i; break; }
        }

        for (let i = startRow; i < data.length; i++) {
            const row = data[i];
            const op = String(row[2] || '').trim();
            if (!op || isNaN(op)) continue;
            totalXlsx++;
            if (seen.has(op)) continue;

            const prenda     = normalizarAJ(String(row[35] || '').trim());
            const linea      = String(row[36] || '').trim();
            const genero     = String(row[37] || '').trim();
            const referencia = String(row[1]  || '').trim();

            if (!prenda && !linea && !genero) continue;

            const existente = sisproMap.get(op);
            const esNuevo   = !existente;
            const necesitaRef = existente && !existente.REFERENCIA && referencia;

            if (esNuevo || necesitaRef) {
                sisproNuevosRegistros.push({
                    'Columna C':  op,
                    'Columna AJ': prenda,
                    'Columna AK': linea,
                    'Columna AL': genero,
                    'Columna B':  referencia,
                    '_esNuevo':   esNuevo
                });
                seen.add(op);
            }
        }

        const previewArea = document.getElementById('sisproPreviewArea');
        const statsEl     = document.getElementById('sisproStats');
        const listEl      = document.getElementById('sisproPreviewList');
        const saveBtn     = document.getElementById('sisproSaveBtn');

        if (previewArea) {
            previewArea.style.display = 'block';
            previewArea.scrollIntoView({ behavior: 'smooth' });
        }

        const nuevos = sisproNuevosRegistros.filter(r => r._esNuevo).length;
        const updates = sisproNuevosRegistros.filter(r => !r._esNuevo).length;

        if (statsEl) statsEl.innerHTML = `
            <div style="background: var(--surface); border: 1px solid var(--border); padding: 16px; border-radius: 4px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: var(--text);">${totalXlsx}</div>
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Detectados en XLSX</div>
            </div>
            <div style="background: var(--surface); border: 1px solid var(--success); padding: 16px; border-radius: 4px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: var(--success);">${nuevos}</div>
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Nuevos Productos</div>
            </div>
            <div style="background: var(--surface); border: 1px solid var(--warning); padding: 16px; border-radius: 4px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: var(--warning);">${updates}</div>
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Ref. a Sincronizar</div>
            </div>
            <div style="background: var(--surface); border: 1px solid var(--border); padding: 16px; border-radius: 4px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: var(--text-muted);">${totalXlsx - sisproNuevosRegistros.length}</div>
                <div style="font-size: 10px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">Sin cambios</div>
            </div>
        `;

        if (listEl) {
            if (sisproNuevosRegistros.length === 0) {
                listEl.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:60px; color:var(--success); font-weight: 700;">Base de Datos SISPROWEB al día. Sin cambios requeridos.</td></tr>';
            } else {
                listEl.innerHTML = sisproNuevosRegistros.slice(0, 50).map(r => `
                    <tr style="background: ${r._esNuevo ? 'rgba(13,188,121,0.03)' : 'rgba(255,140,0,0.03)'}; transition: background 0.1s;">
                        <td style="color: ${r._esNuevo ? 'var(--success)' : 'var(--warning)'}; font-weight: 800; font-size: 10px; text-transform: uppercase; text-align: left;">
                            ${r._esNuevo ? 'CREAR' : 'ACTUALIZAR'}
                        </td>
                        <td style="font-weight: 700; color: var(--primary); text-align: left;">${r['Columna C']}</td>
                        <td style="text-align: left;">
                            <div style="color: var(--text); font-weight: 600;">${r['Columna AJ']}</div>
                            <div style="font-size: 10px; color: var(--text-muted);">${r['Columna AK']} | ${r['Columna AL']}</div>
                        </td>
                        <td style="text-align: right; color: var(--info); font-weight: 800;">${r['Columna B'] || '(Vacio)'}</td>
                    </tr>
                `).join('') + (sisproNuevosRegistros.length > 50 ? `<tr><td colspan="4" style="text-align:center; padding:12px; font-size:11px; color:var(--text-muted); background: var(--surface);">... mostrando 50 de ${sisproNuevosRegistros.length} registros</td></tr>` : '');
            }
        }

        if (saveBtn) {
            saveBtn.style.display = sisproNuevosRegistros.length > 0 ? 'flex' : 'none';
            saveBtn.innerHTML = `<i class="codicon codicon-cloud-upload"></i> Guardar ${sisproNuevosRegistros.length} cambios`;
        }

    } catch (err) {
        showMessage('Error al procesar el archivo Excel', 'error');
        if (icon) icon.style.color = '';
    } finally {
        loading.close();
    }
}

async function saveSisproUpdate() {
    if (!sisproNuevosRegistros.length) return;
    const btn = document.getElementById('sisproSaveBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Sincronizando...';
    }

    try {
        const res = await saveNewSISPROWEBData(sisproNuevosRegistros);
        await loadSisproData();
        sisproNuevosRegistros = [];
        showMessage(`Sincronización Maestra Exitosa`, 'success');
        refreshAdminView();
    } catch (err) {
        showMessage('Error en el despliegue a Sheets: ' + err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="codicon codicon-cloud-upload"></i> Reintentar Sincronización';
        }
    }
}

// Exports
window.showSisproUpdateModal = showSisproUpdateModal;
window.handleSisproFileDrop  = handleSisproFileDrop;
window.handleSisproFileSelect = handleSisproFileSelect;
window.saveSisproUpdate = saveSisproUpdate;
window.resetSisproUI = resetSisproUI;
