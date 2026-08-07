/**
 * js/ui/missing-data-modal.js
 * Módulo para gestionar datos faltantes (OPs en SISPROWEB o Colores)
 */

let currentMissingData = {
    ops: [],
    colors: [],
    onComplete: null
};

/**
 * Muestra el modal de datos faltantes (solo colores)
 */
async function showMissingDataModal(missingOPs, missingColors, onComplete) {
    // Si ya hay un modal abierto, no abrir otro, solo actualizar datos si es necesario
    const existingModal = document.querySelector('.modal-missing-data');
    if (existingModal) return;

    // Solo procesar colores (ignorar OPs)
    currentMissingData.ops = [];
    currentMissingData.colors = [...missingColors];
    currentMissingData.onComplete = onComplete;

    const modal = createModal(
        `<i class="codicon codicon-warning"></i> Colores Faltantes Detectados`,
        `<div id="missingDataContent"></div>`,
        true
    );
    modal.classList.add('modal-missing-data');

    updateMissingDataUI();
}

function updateMissingDataUI() {
    const container = document.getElementById('missingDataContent');
    if (!container) return;

    const { colors } = currentMissingData;
    const total = colors.length;

    if (total === 0) {
        const modal = document.querySelector('.modal-missing-data');
        if (modal) modal.remove();
        if (currentMissingData.onComplete) currentMissingData.onComplete();
        return;
    }

    container.innerHTML = `
        <div class="missing-data-container">
            <p style="margin-bottom: 16px; color: var(--text-secondary); font-size: 13px;">
                Faltan <strong>${total}</strong> colores en la base de datos. Complételos para continuar.
            </p>

            <div id="colorsSection" class="tab-content-modal">
                <div class="manual-entry-list" id="colorEntryList">
                    ${colors.map(colorCode => `
                        <div class="entry-row" data-color="${colorCode}">
                            <div class="entry-header">Código Color: <strong>${colorCode}</strong></div>
                            <div class="entry-form">
                                <div class="form-group-mini" style="flex: 1;">
                                    <label>Nombre del Color</label>
                                    <input type="text" class="form-control mini color-name-input" placeholder="Ej: NEGRO">
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="modal-footer" style="margin-top: 20px; border-top: 1px solid var(--border); padding-top: 16px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                <button class="btn-primary" onclick="processAndSaveMissingData()">
                    <i class="codicon codicon-save"></i> Guardar y Continuar
                </button>
            </div>
        </div>

        <style>
            .missing-data-container { max-height: 70vh; overflow-y: auto; padding-right: 8px; }
            .entry-row { border: 1px solid var(--border); border-radius: 6px; padding: 12px; margin-bottom: 12px; background: var(--sidebar); transition: border-color 0.2s; }
            .entry-row:focus-within { border-color: var(--primary); }
            .entry-header { margin-bottom: 8px; font-size: 12px; color: var(--text-secondary); }
            .entry-header strong { color: var(--text); }
            .entry-form { display: flex; gap: 12px; flex-wrap: wrap; }
            .form-group-mini { flex: 1; min-width: 140px; }
            .form-group-mini label { display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; font-weight: 600; text-transform: uppercase; }
            .form-control.mini { padding: 6px 10px; font-size: 12px; height: 32px; width: 100%; box-sizing: border-box; }
        </style>
    `;
}

async function processAndSaveMissingData() {
    const btn = document.querySelector('.modal-missing-data .btn-primary');
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Guardando...';

    const colorsToSave = [];
    const savedColorIds = [];

    // Recolectar Colores llenos
    document.querySelectorAll('#colorEntryList .entry-row').forEach(row => {
        const colorName = row.querySelector('.color-name-input').value.trim();
        if (colorName) {
            colorsToSave.push({
                codigo: row.dataset.color,
                nombre: colorName
            });
            savedColorIds.push(row.dataset.color);
        }
    });

    if (colorsToSave.length === 0) {
        showMessage('Por favor complete al menos un color para guardar', 'warning');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        return;
    }

    const loading = showQuickLoading('Guardando colores en Supabase...');

    try {
        await saveNewColorData(colorsToSave);

        // Actualizar datos locales
        currentMissingData.colors = currentMissingData.colors.filter(id => !savedColorIds.includes(id));

        showMessage(`Se guardaron exitosamente ${colorsToSave.length} colores`, 'success');

        // Delay de seguridad para propagación (0.5s)
        await new Promise(resolve => setTimeout(resolve, 500));

        // Recargar colores
        await loadColoresData();

        // Si ya no quedan colores faltantes, cerramos el modal y llamamos al completado
        if (currentMissingData.colors.length === 0) {
            const modal = document.querySelector('.modal-missing-data');
            if (modal) modal.remove();
            if (currentMissingData.onComplete) {
                // Pequeño delay adicional para que la UI respire antes del reprocesamiento
                setTimeout(() => currentMissingData.onComplete(), 300);
            }
        } else {
            // Si aún quedan, solo actualizamos la UI del modal
            updateMissingDataUI();
        }

    } catch (error) {
        console.error('Error al guardar colores:', error);
        showMessage('Error al guardar: ' + error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    } finally {
        loading.close();
    }
}

/**
 * Handle manual del upload de excel para evitar scoped variables erróneas
 */
async function handleExcelUploadManual(input) {
    const file = input.files[0];
    if (!file) return;

    const loading = showQuickLoading('Analizando Excel...');
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

        let matchCount = 0;
        const rows = document.querySelectorAll('#opEntryList .entry-row');

        rows.forEach(row => {
            const opToFind = row.dataset.op;
            for (let i = 1; i < data.length; i++) {
                const excelRow = data[i];
                const excelOP = String(excelRow[2] || '').trim();

                if (excelOP === opToFind) {
                    const prenda = String(excelRow[35] || '').trim();
                    const linea = String(excelRow[36] || '').trim();
                    const genero = String(excelRow[37] || '').trim();

                    row.querySelector('.prenda-input').value = normalizarAJ(prenda);
                    row.querySelector('.linea-input').value = linea;
                    row.querySelector('.genero-input').value = genero;
                    matchCount++;
                    break;
                }
            }
        });

        showMessage(`Autocompletadas ${matchCount} OPs`, matchCount > 0 ? 'success' : 'info');
    } catch (error) {
        console.error('Error Excel:', error);
        showMessage('Error al leer Excel', 'error');
    } finally {
        loading.close();
        input.value = ''; // Limpiar input para re-uso
    }
}

/**
 * Cambia entre pestañas en el modal basándose en una clase o selector más robusto
 */
function switchModalTab(tab) {
    const opsSection = document.getElementById('opsSection');
    const colorsSection = document.getElementById('colorsSection');
    const tabs = document.querySelectorAll('.modal-tab');

    if (tab === 'ops') {
        if (opsSection) opsSection.style.display = 'block';
        if (colorsSection) colorsSection.style.display = 'none';
        tabs.forEach(t => {
            const isOps = t.innerHTML.includes('OPs');
            t.classList.toggle('active', isOps);
        });
    } else {
        if (opsSection) opsSection.style.display = 'none';
        if (colorsSection) colorsSection.style.display = 'block';
        tabs.forEach(t => {
            const isColors = t.innerHTML.includes('Colores') || t.innerHTML.includes('Colors');
            t.classList.toggle('active', isColors);
        });
    }
}

/**
 * Normalización de prendas (idéntico a SISPROWEB.html)
 */
function normalizarAJ(texto) {
    if (!texto || typeof texto !== 'string') return '';

    let normalizado = texto.toUpperCase().trim();
    normalizado = normalizado.replace(/_/g, ' ');

    if (normalizado === 'SALIDAS DE BAÑO') return 'SALIDA DE BAÑO';
    if (normalizado.includes('SALIDAS DE BAÑO')) {
        normalizado = normalizado.replace('SALIDAS DE BAÑO', 'SALIDA DE BAÑO');
    }

    if (normalizado.includes(',')) {
        normalizado = normalizado.split(',')[0].trim();
    }

    normalizado = normalizado.replace(/\b(PROMOCION|PROMO|PROMOCI[ÓO]N|POMOCION|PROMOCIO)\b/gi, '').trim();
    normalizado = normalizado.replace(/\s*CIO\s*$/i, '').trim();

    if (normalizado.endsWith('ES')) {
        if (normalizado === 'PANTALONES') {
            normalizado = 'PANTALON';
        } else if (!normalizado.endsWith('LEGGINS') && !normalizado.endsWith('LEGGIN')) {
            normalizado = normalizado.slice(0, -2);
        }
    } else if (normalizado.endsWith('S')) {
        if (normalizado !== 'LEGGINS' && normalizado !== 'LEGGIN') {
            normalizado = normalizado.slice(0, -1);
        }
    }

    return normalizado.replace(/\s+/g, ' ').trim();
}

// Exponer funciones necesarias al objeto window para onclicks
window.switchModalTab = switchModalTab;
window.handleExcelUploadManual = handleExcelUploadManual;
window.processAndSaveMissingData = processAndSaveMissingData;
