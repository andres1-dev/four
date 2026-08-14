function setupTheme() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) {
        console.warn('themeToggle button not found in the DOM.');
        return;
    }

    const savedTheme = localStorage.getItem('vscode-theme') || 'light';

    document.body.classList.remove('vscode-light', 'vscode-dark');
    document.body.classList.add(`vscode-${savedTheme}`);
    updateThemeIcon(savedTheme);

    // Evitar múltiples listeners si se llama varias veces
    if (!themeToggle.hasThemeListener) {
        themeToggle.addEventListener('click', function () {
            const currentTheme = document.body.classList.contains('vscode-dark') ? 'dark' : 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            document.body.classList.remove('vscode-light', 'vscode-dark');
            document.body.classList.add(`vscode-${newTheme}`);
            localStorage.setItem('vscode-theme', newTheme);
            updateThemeIcon(newTheme);

            showMessage(`Tema cambiado a ${newTheme === 'dark' ? 'oscuro' : 'claro'}`, 'info', 1500);
        });
        themeToggle.hasThemeListener = true;
    }
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#themeToggle i');
    if (!icon) return;
    
    // En VS Code Codicons v0.0.32, 'moon' y 'sun' pueden no existir.
    // Usamos 'color-mode' que es el icono garantizado y visible en este proyecto.
    icon.className = 'codicon codicon-color-mode';
}

function getCurrentTheme() {
    return document.body.classList.contains('vscode-dark') ? 'dark' : 'light';
}

// ============================================
// EXPORTS
// ============================================

window.setupTheme = setupTheme;
window.getCurrentTheme = getCurrentTheme;