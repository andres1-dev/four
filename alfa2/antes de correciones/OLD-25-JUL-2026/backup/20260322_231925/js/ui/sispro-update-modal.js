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
            <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 16px;">
                Carga el archivo <strong>.xlsx</strong> de SISPROWEB para registrar nuevos productos.
                Solo se agregarán registros que no existan aún.
            </p>

            <div class="upload-area-mini" id="sisproDropZone"
                ondragover="event.preventDefault()" 
                ondrop="handleSisproFileDrop(event)">
                <i class="fa-solid fa-file-excel" style="font-size: 32px; color: var(--success); margin-bottom: 8px; display:block;"></i>
                <p>Arrastra el archivo .xlsx aquí o haz click para seleccionar</p>
                <input type="file" id="sisproXlsxFile" accept=".xls,.xlsx" hidden onchange="handleSisproFileSelect(this)">
                <button class="btn-secondary" onclick="document.getElementById('sisproXlsxFile').click()">
                    <i class="fa-solid fa-folder-open"></i> Seleccionar archivo
                </button>
            </div>

            <div id="sisproPreviewArea" style="display:none;">
                <div id="sisproStats" style="display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap;"></div>
                <div id="sisproPreviewList" style="max-height:300px; overflow-y:auto;"></div>
            </div>

            <div class="modal-footer" style="margin-top:20px; border-top:1px solid var(--border); padding-top:16px; display:flex; justify-content:flex-end; gap:8px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                <button class="btn-primary" id="sisproSaveBtn" style="display:none;" onclick="saveSisproUpdate()">
                    <i class="fa-solid fa-floppy-disk"></i> Guardar en SISPROWEB
                </button>
            </div>
        </div>

        <style>
            .sispro-update-container { min-width: 480px; }
            .sispro-stat-card { background: var(--sidebar); border: 1px solid var(--border); border-radius: 6px; padding: 10px 16px; text-align:center; flex:1; min-width:100px; }
            .sispro-stat-card .val { font-size: 22px; font-weight: 700; }
            .sispro-stat-card .lbl { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
            .sispro-preview-row { display:flex; gap:8px; padding:6px 8px; border-bottom:1px solid var(--border); font-size:12px; align-items:center; }
            .sispro-preview-row:last-child { border-bottom: none; }
            .sispro-preview-row .op-badge { background: var(--primary-dim, rgba(0,122,204,0.12)); color: var(--primary); padding: 2px 6px; border-radius: 3px; font-weight:700; min-width:60px; text-align:center; }
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
                listEl.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-secondary); font-size:13px;">
                    <i class="fa-solid fa-circle-check" style="color:var(--success); margin-right:6px;"></i>
                    Todo está actualizado en SISPROWEB
                </div>`;
            } else {
                listEl.innerHTML = sisproNuevosRegistros.slice(0, 50).map(r => `
                    <div class="sispro-preview-row">
                        <span class="op-badge" style="background:${r._esNuevo ? 'var(--success-dim,rgba(0,200,0,0.1))' : 'var(--warning-dim,rgba(255,193,7,0.1))'}; color:${r._esNuevo ? 'var(--success)' : 'var(--warning)'}">
                            ${r._esNuevo ? '+ ' : '↑ '}${r['Columna C']}
                        </span>
                        <span style="color:var(--primary); font-size:11px;">${r['Columna B'] || ''}</span>
                        <span style="color:var(--text)">${r['Columna AJ']}</span>
                        <span style="color:var(--text-secondary)">${r['Columna AK']}</span>
                        <span style="color:var(--text-secondary)">${r['Columna AL']}</span>
                    </div>
                `).join('') + (sisproNuevosRegistros.length > 50
                    ? `<div style="text-align:center; padding:8px; font-size:11px; color:var(--text-secondary)">... y ${sisproNuevosRegistros.length - 50} más</div>`
                    : '');
            }
        }

        if (saveBtn) saveBtn.style.display = hayAcciones ? '' : 'none';

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
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar en SISPROWEB'; }
    } finally {
        loading.close();
    }
}

window.showSisproUpdateModal = showSisproUpdateModal;
window.handleSisproFileDrop  = handleSisproFileDrop;
window.handleSisproFileSelect = handleSisproFileSelect;
window.saveSisproUpdate = saveSisproUpdate;
