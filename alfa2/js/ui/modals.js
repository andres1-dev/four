function createModal(title, content, showCloseButton = true) {
    // Si ya hay un modal con el mismo título abierto, no creamos otro.
    const existingModals = document.querySelectorAll('.modal h3');
    for (const h3 of existingModals) {
        if (h3.textContent === title) {
            // Animamos ligeramente el modal existente para dar feedback
            const existingModal = h3.closest('.modal');
            existingModal.style.transform = 'scale(1.02)';
            setTimeout(() => existingModal.style.transform = 'scale(1)', 100);
            return existingModal;
        }
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                ${showCloseButton ? '<button class="btn-icon" onclick="this.closest(\'.modal\').remove()"><i class="codicon codicon-close"></i></button>' : ''}
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;

    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            modal.remove();
        }
    });

    document.getElementById('modalContainer').appendChild(modal);
    return modal;
}

function showSettingsModal() {
    const currentTheme = getCurrentTheme();

    createModal('Configuración', `
        <div style="padding: 16px 0;">
            <div class="form-group">
                <label for="settingTheme">Tema de la interfaz</label>
                <select id="settingTheme" class="form-control">
                    <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Claro</option>
                    <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Oscuro</option>
                </select>
            </div>
            <div class="form-group">
                <label for="settingApiKey">API Key de Google Sheets</label>
                <input type="password" id="settingApiKey" class="form-control" value="${API_KEY}" readonly>
                <small style="color: var(--text-secondary);">API Key de solo lectura</small>
            </div>
            <div class="form-group">
                <label for="settingSpreadsheetId">ID de la Hoja de Cálculo</label>
                <input type="text" id="settingSpreadsheetId" class="form-control" value="${SPREADSHEET_ID}" readonly>
            </div>
            <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px;">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cerrar</button>
                <button class="btn-primary" onclick="saveSettings(this)">Guardar</button>
            </div>
        </div>
    `, true);
}

function saveSettings(btn) {
    const modal = btn ? btn.closest('.modal') : document.querySelector('.modal');
    const themeSelect = document.getElementById('settingTheme');
    if (!themeSelect) return;
    
    const newTheme = themeSelect.value;
    
    document.body.classList.remove('vscode-light', 'vscode-dark');
    document.body.classList.add(`vscode-${newTheme}`);
    
    localStorage.setItem('vscode-theme', newTheme);
    if (typeof updateThemeIcon === 'function') updateThemeIcon(newTheme);

    if (modal) modal.remove();
    if (typeof showMessage === 'function') showMessage('Configuración guardada correctamente', 'success', 1500);
}