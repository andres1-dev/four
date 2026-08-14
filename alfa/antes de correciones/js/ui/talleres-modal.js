/**
 * js/ui/talleres-modal.js
 * Módulo de actualización de la tabla global_talleres desde HTML de SISPRO
 * 
 * Parsea el bloque <tbody id="tbody_recepcion"> y extrae:
 *   - id_taller  → atributo del <tr id="tr_taller_XXXX">
 *   - taller     → segunda celda <td> del <tr>
 */

// ============================================
// ENTRADA AL MÓDULO
// ============================================

function showTalleresModal() {
    openAdminTab('talleres', 'Talleres', 'codicon-home', renderTalleresUI);
}

// ============================================
// RENDER PRINCIPAL
// ============================================

function renderTalleresUI(container) {
    if (!container) container = document.getElementById('adminTabEntryPoint');
    if (!container) return;

    container.innerHTML = `
        <div class="admin-section">
            <div class="admin-section-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <i class="codicon codicon-home" style="color:var(--primary); font-size:18px;"></i>
                    <div>
                        <h4 style="margin:0; font-size:15px; font-weight:600;">Actualizar Talleres</h4>
                        <p style="margin:0; font-size:12px; color:var(--text-secondary);">
                            Pegá el HTML del listado de talleres de SISPRO para sincronizar la tabla <code>global_talleres</code>
                        </p>
                    </div>
                </div>
            </div>

            <div class="admin-section-body" style="padding: 20px; display:flex; flex-direction:column; gap:16px;">

                <!-- PASO 1: Pegar HTML -->
                <div class="form-group">
                    <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.5px;">
                        <i class="codicon codicon-code"></i>
                        Paso 1 — Pegá el bloque HTML de SISPRO
                    </label>
                    <textarea
                        id="talleres-html-input"
                        class="form-control"
                        rows="8"
                        placeholder="Pegá aquí el contenido del &lt;tbody id=&quot;tbody_recepcion&quot;&gt;..."
                        style="font-family: 'Cascadia Code', monospace; font-size:11px; resize:vertical;"
                        oninput="previewTalleres()"
                    ></textarea>
                </div>

                <!-- PREVIEW -->
                <div id="talleres-preview" style="display:none;">
                    <label style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; letter-spacing:.5px;">
                        <i class="codicon codicon-eye"></i>
                        Paso 2 — Verificá los talleres detectados
                    </label>
                    <div style="border:1px solid var(--border); border-radius:6px; overflow:hidden; margin-top:8px; max-height:320px; overflow-y:auto;">
                        <table class="data-table" style="margin:0;">
                            <thead>
                                <tr>
                                    <th style="width:100px;">ID Taller</th>
                                    <th>Nombre Taller</th>
                                    <th style="width:80px; text-align:center;">Estado</th>
                                </tr>
                            </thead>
                            <tbody id="talleres-preview-tbody"></tbody>
                        </table>
                    </div>
                    <div id="talleres-preview-summary" style="margin-top:8px; font-size:12px; color:var(--text-secondary);"></div>
                </div>

                <!-- ACCIÓN -->
                <div style="display:flex; gap:10px; align-items:center;" id="talleres-actions" style="display:none;">
                    <button class="btn-primary" id="talleres-sync-btn" onclick="syncTalleres()" style="display:none;">
                        <i class="codicon codicon-sync"></i> Sincronizar con Supabase
                    </button>
                    <button class="btn-secondary" onclick="document.getElementById('talleres-html-input').value=''; previewTalleres();">
                        <i class="codicon codicon-clear-all"></i> Limpiar
                    </button>
                </div>

                <!-- RESULTADO -->
                <div id="talleres-result" style="display:none;"></div>

            </div>
        </div>
    `;
}

// ============================================
// PARSEAR HTML Y PREVIEW
// ============================================

function parseTalleresHtml(html) {
    const talleres = [];
    if (!html || !html.trim()) return talleres;

    // Parsear como DOM
    const parser = new DOMParser();
    // Envolver en una tabla para que el DOM lo acepte correctamente
    const doc = parser.parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
    const rows = doc.querySelectorAll('tr[id^="tr_taller_"]');

    rows.forEach(tr => {
        // id_taller desde el atributo id="tr_taller_XXXX"
        const idMatch = tr.id.match(/^tr_taller_(\d+)$/);
        if (!idMatch) return;
        const id_taller = idMatch[1];

        // taller = segunda celda <td> (índice 1)
        const celdas = tr.querySelectorAll('td');
        if (celdas.length < 2) return;
        const taller = (celdas[1].textContent || '').trim();

        if (id_taller && taller) {
            talleres.push({ id_taller, taller });
        }
    });

    return talleres;
}

function previewTalleres() {
    const html = document.getElementById('talleres-html-input')?.value || '';
    const preview = document.getElementById('talleres-preview');
    const tbody = document.getElementById('talleres-preview-tbody');
    const summary = document.getElementById('talleres-preview-summary');
    const syncBtn = document.getElementById('talleres-sync-btn');
    const actions = document.getElementById('talleres-actions');

    const talleres = parseTalleresHtml(html);

    if (!talleres.length) {
        if (preview) preview.style.display = 'none';
        if (syncBtn) syncBtn.style.display = 'none';
        return;
    }

    // Renderizar preview
    tbody.innerHTML = talleres.map(t => `
        <tr>
            <td style="font-family:monospace; color:var(--primary);">${t.id_taller}</td>
            <td>${t.taller}</td>
            <td style="text-align:center;">
                <span class="panel-badge" style="background:var(--info-dim); color:var(--info);">pendiente</span>
            </td>
        </tr>
    `).join('');

    summary.textContent = `${talleres.length} taller(es) detectados`;
    preview.style.display = 'block';
    if (actions) actions.style.display = 'flex';
    if (syncBtn) syncBtn.style.display = 'inline-flex';

    // Guardar en memoria para el sync
    window._talleresParaSync = talleres;
}

// ============================================
// SINCRONIZAR CON SUPABASE
// ============================================

async function syncTalleres() {
    const talleres = window._talleresParaSync;
    if (!talleres || !talleres.length) {
        showMessage('No hay talleres para sincronizar', 'warning', 2000);
        return;
    }

    const btn = document.getElementById('talleres-sync-btn');
    const resultEl = document.getElementById('talleres-result');
    const tbody = document.getElementById('talleres-preview-tbody');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="loading-spinner"></span> Sincronizando...';
    }

    let ok = 0, errores = 0;
    const errLog = [];
    const startTime = performance.now();

    for (const t of talleres) {
        try {
            // Upsert: insert si no existe, update si ya existe (clave: id_taller)
            await supabase.upsert('global_talleres', {
                id_taller: t.id_taller,
                taller:    t.taller
            }, 'id_taller');

            ok++;

            // Actualizar badge en preview
            const rows = tbody.querySelectorAll('tr');
            const idx = talleres.indexOf(t);
            if (rows[idx]) {
                rows[idx].querySelector('.panel-badge').textContent = '✓ ok';
                rows[idx].querySelector('.panel-badge').style.cssText = 'background:var(--success-dim); color:var(--success);';
            }
        } catch (err) {
            errores++;
            errLog.push(`${t.id_taller} (${t.taller}): ${err.message}`);

            const rows = tbody.querySelectorAll('tr');
            const idx = talleres.indexOf(t);
            if (rows[idx]) {
                rows[idx].querySelector('.panel-badge').textContent = '✗ error';
                rows[idx].querySelector('.panel-badge').style.cssText = 'background:var(--error-dim); color:var(--error);';
            }
        }
    }

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

    // Resultado final
    if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = errores === 0
            ? `<div class="notification success" style="margin:0;">
                   <i class="codicon codicon-check-all"></i>
                   <strong>${ok} taller(es) sincronizados correctamente</strong> en ${elapsed}s
               </div>`
            : `<div class="notification warning" style="margin:0;">
                   <i class="codicon codicon-warning"></i>
                   <strong>${ok} ok / ${errores} errores</strong> en ${elapsed}s
                   <div style="margin-top:8px; font-size:11px; font-family:monospace; color:var(--text-secondary);">
                       ${errLog.map(e => `<div>• ${e}</div>`).join('')}
                   </div>
               </div>`;
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="codicon codicon-sync"></i> Sincronizar con Supabase';
    }

    showMessage(`${ok} taller(es) sincronizados${errores ? `, ${errores} errores` : ''}`, errores ? 'warning' : 'success', 3000);
}

// ============================================
// EXPORTS
// ============================================

window.showTalleresModal = showTalleresModal;
window.previewTalleres   = previewTalleres;
window.syncTalleres      = syncTalleres;
