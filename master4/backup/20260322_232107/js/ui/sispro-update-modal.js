/**
 * js/ui/sispro-update-modal.js
 * Modal para actualizar la hoja SISPROWEB desde un archivo .xlsx
 */

function showSisproUpdateModal() {
    const existing = document.querySelector('.modal-sispro-update');
    if (existing) { existing.remove(); return; }

    const modal = createModal(
        `<i class="fa-solid fa-box"></i> Actualizar SISPROWEB`,
        `<div id="sisproUpdateContent"></div>`,
        true
    );
    modal.classList.add('modal-sispro-update');
    renderSisproUpdateUI();
}

function renderSisproUpdateUI() {
    const container = document.getElementById('sisproUpdateContent');
    if (!container) return;

    container.innerHTML = `
        <div class="sispro-update-container">
            <!-- Header con Icono Estilo Premium -->
            <div style="text-align: center; margin-bottom: 24px;">
                <div class="alert-icon" style="margin: 0 auto 16px; background: var(--success-dim); border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
                    <i class="codicon codicon-cloud-upload" style="font-size: 32px; color: var(--success);"></i>
                </div>
                <h2 style="margin: 0; color: var(--text); font-size: 18px; font-weight: 600;">Sincronizar SISPROWEB</h2>
                <p style="color: var(--text-secondary); font-size: 13px; margin-top: 8px; line-height: 1.4;">
                    Carga el archivo <strong>.xlsx</strong> maestro para registrar nuevos productos y actualizar referencias existentes en la base de datos central.
                </p>
            </div>

            <!-- Zona de Carga Refinada -->
            <div class="upload-area-premium" id="sisproDropZone"
                onclick="document.getElementById('sisproXlsxFile').click()"
                ondragover="event.preventDefault(); this.classList.add('drag-active')" 
                ondragleave="this.classList.remove('drag-active')"
                ondrop="event.preventDefault(); this.classList.remove('drag-active'); handleSisproFileDrop(event)">
                
                <div style="pointer-events: none;">
                    <i class="codicon codicon-file-symlink-file" style="font-size: 28px; color: var(--text-secondary); margin-bottom: 12px; display:block;"></i>
                    <p style="margin: 0; color: var(--text); font-weight: 500;">Haz clic o arrastra el archivo aquí</p>
                    <p style="margin: 4px 0 0 0; color: var(--text-muted); font-size: 11px;">Solo se permiten formatos .xlsx o .xls</p>
                </div>

                <input type="file" id="sisproXlsxFile" accept=".xls,.xlsx" hidden onchange="handleSisproFileSelect(this)">
            </div>

            <div id="sisproPreviewArea" style="display:none; margin-top: 24px; animation: fadeIn 0.3s ease;">
                <div id="sisproStats" style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:20px;"></div>
                <div style="margin-bottom: 8px; font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Vista previa de cambios</div>
                <div id="sisproPreviewList" style="max-height:280px; overflow-y:auto; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-dark);"></div>
            </div>

            <div class="modal-footer" style="margin-top:24px; border-top:1px solid var(--border); padding-top:20px; display:flex; justify-content:flex-end; gap:12px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()" style="padding: 8px 16px;">Cancelar</button>
                <button class="btn-primary" id="sisproSaveBtn" style="display:none; padding: 8px 20px; background: var(--success); border-color: var(--success);" onclick="saveSisproUpdate()">
                    <i class="codicon codicon-save" style="margin-right: 6px;"></i> Guardar Cambios
                </button>
            </div>
        </div>

        <style>
            .sispro-update-container { width: 520px; padding: 4px; }
            
            .upload-area-premium {
                border: 2px dashed var(--border);
                border-radius: 12px;
                padding: 32px 20px;
                text-align: center;
                background: var(--surface);
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            .upload-area-premium:hover {
                border-color: var(--primary);
                background: var(--bg-dark);
            }
            .upload-area-premium.drag-active {
                border-color: var(--success);
                background: var(--success-dim);
                transform: scale(1.02);
            }

            .sispro-stat-card { 
                background: var(--surface); 
                border: 1px solid var(--border); 
                border-radius: 10px; 
                padding: 12px 8px; 
                text-align: center;
                display: flex;
                flex-direction: column;
                justify-content: center;
                transition: transform 0.2s;
            }
            .sispro-stat-card:hover { transform: translateY(-2px); border-color: var(--primary); }
            .sispro-stat-card .val { font-size: 20px; font-weight: 700; font-family: 'Cascadia Code', monospace; line-height: 1; margin-bottom: 4px; }
            .sispro-stat-card .lbl { font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
            
            .sispro-preview-row { 
                display: flex; 
                gap: 12px; 
                padding: 10px 14px; 
                border-bottom: 1px solid var(--border); 
                font-size: 12px; 
                align-items: center;
                transition: background 0.1s;
            }
            .sispro-preview-row:hover { background: var(--surface); }
            .sispro-preview-row:last-child { border-bottom: none; }
            
            .op-badge-mini { 
                padding: 2px 8px; 
                border-radius: 4px; 
                font-family: 'Cascadia Code', monospace;
                font-weight: 700; 
                font-size: 11px;
                min-width: 70px; 
                text-align: center; 
            }

            #sisproPreviewList::-webkit-scrollbar { width: 6px; }
            #sisproPreviewList::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>
    `;
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
    const loading = showQuickLoading('Analizando archivo SISPROWEB...');
    sisproNuevosRegistros = [];

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
        let sinCambios = 0;
        const seen = new Set();

        // Encontrar la primera fila donde col[2] sea numérico (saltar títulos y headers)
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
            if (seen.has(op.toUpperCase())) { sinCambios++; continue; }

            const prenda     = normalizarAJ(String(row[35] || '').trim());
            const linea      = String(row[36] || '').trim();
            const genero     = String(row[37] || '').trim();
            const referencia = String(row[1]  || '').trim();

            if (!prenda && !linea && !genero) { sinCambios++; continue; }

            const existente = sisproMap.get(op);
            const esNuevo   = !existente;
            // Es actualizable si ya existe pero no tiene referencia, y el xlsx sí trae una
            const necesitaRef = existente && !existente.REFERENCIA && referencia;

            // Solo incluir si es nuevo o necesita actualizar referencia
            if (!esNuevo && !necesitaRef) { sinCambios++; continue; }

            sisproNuevosRegistros.push({
                'Columna C':  op,
                'Columna AJ': prenda,
                'Columna AK': linea,
                'Columna AL': genero,
                'Columna B':  referencia,
                '_esNuevo':   esNuevo
            });
            seen.add(op.toUpperCase());
        }

        const nuevosCount     = sisproNuevosRegistros.filter(r => r._esNuevo).length;
        const updateCount     = sisproNuevosRegistros.filter(r => !r._esNuevo).length;
        sinCambios = totalXlsx - sisproNuevosRegistros.length;

        // Mostrar preview
        const previewArea = document.getElementById('sisproPreviewArea');
        const statsEl     = document.getElementById('sisproStats');
        const listEl      = document.getElementById('sisproPreviewList');
        const saveBtn     = document.getElementById('sisproSaveBtn');

        if (previewArea) previewArea.style.display = 'block';

        if (statsEl) statsEl.innerHTML = `
            <div class="sispro-stat-card">
                <div class="val">${totalXlsx}</div>
                <div class="lbl">En archivo</div>
            </div>
            <div class="sispro-stat-card" style="border-color:var(--success)">
                <div class="val" style="color:var(--success)">${nuevosCount}</div>
                <div class="lbl">Nuevos</div>
            </div>
            <div class="sispro-stat-card" style="border-color:var(--warning)">
                <div class="val" style="color:var(--warning)">${updateCount}</div>
                <div class="lbl">Ref. a actualizar</div>
            </div>
            <div class="sispro-stat-card" style="border-color:var(--text-secondary)">
                <div class="val" style="color:var(--text-secondary)">${sinCambios}</div>
                <div class="lbl">Sin cambios</div>
            </div>
        `;

        const hayAcciones = nuevosCount > 0 || updateCount > 0;

        if (listEl) {
            if (!hayAcciones) {
                listEl.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-secondary); font-size:13px;">
                    <i class="codicon codicon-check-all" style="font-size: 32px; color:var(--success); margin-bottom:12px; display:block;"></i>
                    <strong style="color:var(--text)">Todo está actualizado</strong><br>
                    No se encontraron nuevos registros o cambios pendientes.
                </div>`;
            } else {
                listEl.innerHTML = sisproNuevosRegistros.slice(0, 50).map(r => `
                    <div class="sispro-preview-row">
                        <div class="op-badge-mini" style="background:${r._esNuevo ? 'var(--success-dim)' : 'var(--warning-dim)'}; color:${r._esNuevo ? 'var(--success)' : 'var(--warning)'}">
                            ${r._esNuevo ? '+NEW' : '↑REF'}: ${r['Columna C']}
                        </div>
                        <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong style="color:var(--text); font-size: 13px;">${r['Columna AJ']}</strong>
                                <span style="color:var(--info); font-family: 'Cascadia Code', monospace; font-size: 11px;">${r['Columna B'] || 'S/R'}</span>
                            </div>
                            <div style="display: flex; gap: 8px; color: var(--text-muted); font-size: 11px;">
                                <span>${r['Columna AK']}</span>
                                <span>•</span>
                                <span>${r['Columna AL']}</span>
                            </div>
                        </div>
                    </div>
                `).join('') + (sisproNuevosRegistros.length > 50
                    ? `<div style="text-align:center; padding:12px; font-size:11px; color:var(--text-secondary); background: var(--surface);">... y ${sisproNuevosRegistros.length - 50} registros más</div>`
                    : '');
            }
        }

        if (saveBtn) {
            saveBtn.style.display = hayAcciones ? 'flex' : 'none';
            if (hayAcciones) {
                saveBtn.innerHTML = `<i class="codicon codicon-cloud-upload" style="margin-right: 8px;"></i> Guardar ${sisproNuevosRegistros.length} Cambios`;
            }
        }

    } catch (err) {
        console.error('Error procesando SISPROWEB xlsx:', err);
        showMessage('Error al leer el archivo', 'error');
    } finally {
        loading.close();
    }
}

async function saveSisproUpdate() {
    if (!sisproNuevosRegistros.length) return;

    const btn = document.getElementById('sisproSaveBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading-spinner"></span> Guardando...'; }

    const loading = showQuickLoading(`Guardando ${sisproNuevosRegistros.length} registros en SISPROWEB...`);

    try {
        const res = await saveNewSISPROWEBData(sisproNuevosRegistros);
        await loadSisproData();

        const count = document.getElementById('stat-productos');
        if (count) count.textContent = sisproMap.size;

        const nuevos = res?.data?.registrosNuevos || 0;
        const actualizados = res?.data?.referenciasActualizadas || 0;
        showMessage(`${nuevos} nuevos + ${actualizados} referencias actualizadas en SISPROWEB`, 'success', 4000);
        sisproNuevosRegistros = [];

        const modal = document.querySelector('.modal-sispro-update');
        if (modal) modal.remove();

    } catch (err) {
        console.error('Error guardando SISPROWEB:', err);
        showMessage('Error al guardar: ' + err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="codicon codicon-cloud-upload" style="margin-right: 8px;"></i> Reintentar Guardado`;
        }
    } finally {
        loading.close();
    }
}

window.showSisproUpdateModal = showSisproUpdateModal;
window.handleSisproFileDrop  = handleSisproFileDrop;
window.handleSisproFileSelect = handleSisproFileSelect;
window.saveSisproUpdate = saveSisproUpdate;
