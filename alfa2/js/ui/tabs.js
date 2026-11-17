function setupTabSystem() {
    setupActivityBarTabs();
    setupMainTabs();
    setupTabCloseButtons();
}

function setupActivityBarTabs() {
    document.querySelectorAll('.activity-icon[data-tab]').forEach(btn => {
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

    // ---- Botón Catálogo (toggle) ----
    const catalogoBtn = document.getElementById('catalogoBtn');
    const catalogoSidebar = document.getElementById('catalogo-sidebar');
    const catalogoCloseBtn = document.getElementById('catalogoCloseBtn');

    function openCatalogo() {
        // Cerrar otros sidebars
        document.querySelectorAll('.sidebar').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.activity-icon').forEach(i => i.classList.remove('active'));
        catalogoSidebar.classList.add('active');
        catalogoBtn.classList.add('active');
    }

    function closeCatalogo() {
        catalogoSidebar.classList.remove('active');
        catalogoBtn.classList.remove('active');
    }

    if (catalogoBtn && catalogoSidebar) {
        catalogoBtn.addEventListener('click', function () {
            if (catalogoSidebar.classList.contains('active')) {
                closeCatalogo();
            } else {
                openCatalogo();
            }
        });
    }

    if (catalogoCloseBtn) {
        catalogoCloseBtn.addEventListener('click', closeCatalogo);
    }

    window.openCatalogo = openCatalogo;
    window.closeCatalogo = closeCatalogo;
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
    // Carga lazy de datos por módulo
    if (tabName === 'csv-processor' || tabName === 'pending-ops' || tabName === 'op-editor') {
        if (!window.processorModuleLoaded && typeof loadProcessorModuleData === 'function') {
            loadProcessorModuleData().catch(err => {
                Logger.error('tabs', 'Error cargando módulo procesador', err);
            });
        }
    }

    if (tabName === 'distribution') {
        if (!window.distributionModuleLoaded && typeof loadDistributionModuleData === 'function') {
            loadDistributionModuleData().catch(err => {
                Logger.error('tabs', 'Error cargando módulo distribución', err);
            });
        }
        if (!window.distributionInitialized) {
            setupDistributionEventListeners();
            window.distributionInitialized = true;
        }
    }

    if (tabName === 'printing-module') {
        if (!window.printingModuleLoaded && typeof loadPrintingModuleData === 'function') {
            loadPrintingModuleData().catch(err => {
                Logger.error('tabs', 'Error cargando módulo impresión', err);
            });
        }
    }

    if (tabName === 'orders-module') {
        if (!window.ordersModuleLoaded && typeof loadOrdersModuleData === 'function') {
            loadOrdersModuleData().catch(err => {
                Logger.error('tabs', 'Error cargando módulo pedidos', err);
            });
        }
    }

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

/**
 * Sistema de Pestaña Maestra de Administración
 * Centraliza Clientes, Usuarios, Proveedores, etc en un solo Tab.
 */
let currentViewInAdmin = null;

function openAdminTab(viewId, title, iconClass, renderFn) {
    const tabBtn = document.getElementById('adminTabBtn');
    const tabTitle = document.getElementById('adminTabTitle');
    const tabIcon = document.getElementById('adminTabIcon');
    const headerTitle = document.getElementById('adminHeaderTitle');
    const headerIcon = document.getElementById('adminHeaderIcon');
    const entryPoint = document.getElementById('adminTabEntryPoint');
    const contentArea = document.getElementById('admin-tab-content');

    if (!tabBtn || !entryPoint) return;

    // Actualizar visual de la pestaña
    tabTitle.textContent = title;
    if (tabIcon) tabIcon.className = `codicon ${iconClass}`;
    tabBtn.style.display = 'flex';
    
    // Actualizar Header interno
    headerTitle.textContent = title;
    headerIcon.className = `codicon ${iconClass}`;
    
    // Resetear scroll del contenedor real (Desplazamiento real)
    if (contentArea) contentArea.scrollTo(0, 0);

    // Limpiar botones dinámicos
    const dynActions = document.getElementById('adminDynamicActions');
    if (dynActions) dynActions.innerHTML = '';

    // Guardar para refresco
    window._adminCurrentRenderFn = renderFn;

    // Activar pestaña
    tabBtn.click();

    // Renderizar contenido
    currentViewInAdmin = viewId;
    renderFn(entryPoint);
    
    Logger.info('tabs', `Abierta vista de administración: ${viewId}`);
}

function refreshAdminView() {
    const entryPoint = document.getElementById('adminTabEntryPoint');
    if (window._adminCurrentRenderFn && entryPoint) {
        window._adminCurrentRenderFn(entryPoint);
    }
}

function closeAdminTab(event) {
    if (event) event.stopPropagation();
    const tabBtn = document.getElementById('adminTabBtn');
    if (tabBtn) {
        tabBtn.style.display = 'none';
        // Si estaba activa, cambiar a la primera pestaña visible
        if (tabBtn.classList.contains('active')) {
            const firstTab = document.querySelector('.tab:not([style*="display: none"])');
            if (firstTab) firstTab.click();
        }
    }
    currentViewInAdmin = null;
    window._adminCurrentRenderFn = null;
}

// ============================================
// EXPORTS
// ============================================

window.setupTabSystem = setupTabSystem;
window.switchToEditorTab = switchToEditorTab;
window.switchToPendingOpsTab = switchToPendingOpsTab;
window.openAdminTab = openAdminTab;
window.closeAdminTab = closeAdminTab;
