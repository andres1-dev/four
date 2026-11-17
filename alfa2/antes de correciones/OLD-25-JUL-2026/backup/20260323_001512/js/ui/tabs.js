function setupTabSystem() {
    setupActivityBarTabs();
    setupMainTabs();
    setupTabCloseButtons();
}

function setupActivityBarTabs() {
    document.querySelectorAll('.activity-icon').forEach(btn => {
        btn.addEventListener('click', function () {
            const tabName = this.dataset.tab;

            document.querySelectorAll('.activity-icon').forEach(icon => {
                icon.classList.remove('active');
            });
            this.classList.add('active');

            document.querySelectorAll('.sidebar').forEach(sidebar => {
                sidebar.classList.remove('active');
            });
            const sidebar = document.getElementById(tabName);
            if (sidebar) sidebar.classList.add('active');

            document.querySelectorAll('.tab').forEach(tab => {
                if (tab.dataset.tab === tabName) {
                    tab.style.display = '';
                    tab.click();
                }
            });
        });
    });
}

function setupMainTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function () {
            const tabName = this.dataset.tab;

            document.querySelectorAll('.tab').forEach(t => {
                t.classList.remove('active');
            });
            this.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabName}-content`).classList.add('active');

            handleTabActivation(tabName);
        });
    });
}

function handleTabActivation(tabName) {
    if (tabName === 'cancel-transfers') {
        Logger.info('tabs', 'Pestaña Anular Traslados activada');
        if (processedData.length === 0) {
            const transferList = document.getElementById('transferList');
            if (transferList) {
                transferList.innerHTML = `
                    <div class="empty-state">
                        <i class="codicon codicon-info"></i>
                        <h5>Sin datos para mostrar</h5>
                        <p>Primero procesa un archivo CSV para ver los traslados</p>
                    </div>
                `;
            }
        } else {
            loadTransferList();
            updateCancelledTransfersTable();
        }
    }

    if (tabName === 'distribution' && !window.distributionInitialized) {
        Logger.info('tabs', 'Pestaña Distribución activada');
        initializeDistribution();
        setupDistributionEventListeners();
        window.distributionInitialized = true;
    }
}

function setupTabCloseButtons() {
    document.querySelectorAll('.tab-close').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const tab = this.closest('.tab');
            tab.style.display = 'none';

            if (tab.classList.contains('active')) {
                const remainingTabs = [...document.querySelectorAll('.tab')].filter(t => t.style.display !== 'none');
                if (remainingTabs.length > 0) {
                    remainingTabs[0].click();
                }
            }
        });
    });
}

/**
 * Helpers globales para cambiar de pestaña
 */
function switchToEditorTab() {
    const editorTabBtn = document.querySelector('.activity-icon[data-tab="op-editor"]') ||
        document.querySelector('.tab[data-tab="op-editor"]');
    if (editorTabBtn) editorTabBtn.click();
}

function switchToPendingOpsTab() {
    const pendingTabBtn = document.querySelector('.activity-icon[data-tab="pending-ops"]') ||
        document.querySelector('.tab[data-tab="pending-ops"]');
    if (pendingTabBtn) pendingTabBtn.click();
}

// ============================================
// EXPORTS
// ============================================

window.setupTabSystem = setupTabSystem;
window.switchToEditorTab = switchToEditorTab;
window.switchToPendingOpsTab = switchToPendingOpsTab;
