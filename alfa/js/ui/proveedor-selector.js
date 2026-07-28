/**
 * js/ui/proveedor-selector.js
 * Sistema de selección rápida de proveedor (Ctrl+S como SIESA)
 */

// Proveedor activo global
let proveedorActivo = null;

/**
 * Muestra el modal de selección de proveedor
 */
async function showProveedorSelector() {
    // Verificar si proveedoresMap está cargado
    if (!window.proveedoresMap || window.proveedoresMap.size === 0) {
        showMessage('Cargando proveedores...', 'info', 1000);
        
        // Cargar proveedores desde Supabase
        try {
            await loadProveedoresData();
            
            // Verificar nuevamente después de cargar
            if (!window.proveedoresMap || window.proveedoresMap.size === 0) {
                showMessage('No hay proveedores disponibles', 'warning');
                return;
            }
        } catch (error) {
            showMessage('Error cargando proveedores: ' + error.message, 'error');
            return;
        }
    }

    // Crear overlay si no existe
    let overlay = document.getElementById('proveedorSelectorOverlay');
    if (overlay) {
        overlay.remove();
    }

    overlay = document.createElement('div');
    overlay.id = 'proveedorSelectorOverlay';
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s ease;
    `;

    // Obtener lista de proveedores activos
    const proveedores = Array.from(window.proveedoresMap.entries())
        .filter(([id, data]) => data.ESTADO === 'TRUE')
        .sort((a, b) => a[1].NOMBRE.localeCompare(b[1].NOMBRE));

    overlay.innerHTML = `
        <div style="
            background: var(--editor);
            border: 1px solid var(--border);
            border-radius: 8px;
            width: 600px;
            max-width: 90vw;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
        ">
            <!-- Header -->
            <div style="
                padding: 16px 20px;
                border-bottom: 1px solid var(--border);
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="codicon codicon-organization" style="font-size: 20px; color: var(--primary);"></i>
                    <div>
                        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--text);">
                            Seleccionar Proveedor
                        </h3>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary);">
                            Presiona <kbd style="background: var(--surface); padding: 2px 6px; border-radius: 3px; border: 1px solid var(--border);">Ctrl+S</kbd> para abrir este selector
                        </p>
                    </div>
                </div>
                <i class="codicon codicon-close" onclick="closeProveedorSelector()" style="
                    cursor: pointer;
                    color: var(--text-muted);
                    font-size: 16px;
                    padding: 4px;
                " title="Cerrar (Esc)"></i>
            </div>

            <!-- Search -->
            <div style="padding: 16px 20px; border-bottom: 1px solid var(--border);">
                <div style="position: relative;">
                    <i class="codicon codicon-search" style="
                        position: absolute;
                        left: 12px;
                        top: 50%;
                        transform: translateY(-50%);
                        color: var(--text-secondary);
                    "></i>
                    <input 
                        type="text" 
                        id="proveedorSearchInput"
                        placeholder="Buscar proveedor por ID o nombre..."
                        class="form-control"
                        style="
                            padding-left: 36px;
                            width: 100%;
                            background: var(--input-bg);
                            border: 1px solid var(--border);
                            border-radius: 6px;
                            color: var(--text);
                            font-size: 14px;
                        "
                        autofocus
                    >
                </div>
            </div>

            <!-- Proveedor Activo -->
            ${proveedorActivo ? `
                <div style="
                    padding: 12px 20px;
                    background: rgba(0, 120, 212, 0.1);
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                ">
                    <i class="codicon codicon-check" style="color: var(--success); font-size: 16px;"></i>
                    <div style="flex: 1;">
                        <div style="font-size: 11px; color: var(--text-secondary); text-transform: uppercase; font-weight: 600;">
                            Proveedor Activo
                        </div>
                        <div style="font-size: 14px; color: var(--text); font-weight: 600;">
                            ${proveedorActivo.id} - ${proveedorActivo.nombre}
                        </div>
                    </div>
                    <button 
                        onclick="clearProveedorActivo()"
                        style="
                            background: transparent;
                            border: 1px solid var(--border);
                            color: var(--text-secondary);
                            padding: 6px 12px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                        "
                    >
                        Limpiar
                    </button>
                </div>
            ` : ''}

            <!-- Lista de Proveedores -->
            <div style="
                flex: 1;
                overflow-y: auto;
                padding: 8px;
            " id="proveedorListContainer">
                ${proveedores.map(([id, data]) => `
                    <div 
                        class="proveedor-item"
                        data-id="${id}"
                        data-nombre="${data.NOMBRE}"
                        onclick="selectProveedor('${id}', '${data.NOMBRE.replace(/'/g, "\\'")}')"
                        style="
                            padding: 12px 16px;
                            margin: 4px 0;
                            border-radius: 6px;
                            cursor: pointer;
                            transition: all 0.15s ease;
                            border: 1px solid transparent;
                            ${proveedorActivo && proveedorActivo.id === id ? 'background: rgba(0, 120, 212, 0.15); border-color: var(--primary);' : ''}
                        "
                        onmouseover="this.style.background='var(--hover)'; this.style.borderColor='var(--border)';"
                        onmouseout="this.style.background='${proveedorActivo && proveedorActivo.id === id ? 'rgba(0, 120, 212, 0.15)' : 'transparent'}'; this.style.borderColor='${proveedorActivo && proveedorActivo.id === id ? 'var(--primary)' : 'transparent'}';"
                    >
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="
                                width: 40px;
                                height: 40px;
                                border-radius: 6px;
                                background: var(--primary);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                color: white;
                                font-weight: 700;
                                font-size: 14px;
                            ">
                                ${data.NOMBRE.substring(0, 2).toUpperCase()}
                            </div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: var(--text); font-size: 14px;">
                                    ${data.NOMBRE}
                                </div>
                                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">
                                    ID: ${id}
                                </div>
                            </div>
                            ${proveedorActivo && proveedorActivo.id === id ? `
                                <i class="codicon codicon-check" style="color: var(--success); font-size: 18px;"></i>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Footer -->
            <div style="
                padding: 12px 20px;
                border-top: 1px solid var(--border);
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: var(--surface);
            ">
                <div style="font-size: 12px; color: var(--text-secondary);">
                    ${proveedores.length} proveedores disponibles
                </div>
                <button 
                    onclick="closeProveedorSelector()"
                    class="btn-secondary"
                    style="padding: 8px 16px;"
                >
                    Cerrar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Focus en el input de búsqueda
    setTimeout(() => {
        const searchInput = document.getElementById('proveedorSearchInput');
        if (searchInput) {
            searchInput.focus();
            searchInput.addEventListener('input', filterProveedores);
        }
    }, 100);

    // Cerrar con Escape
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeProveedorSelector();
    });
}

/**
 * Filtra la lista de proveedores según el término de búsqueda
 */
function filterProveedores() {
    const searchTerm = document.getElementById('proveedorSearchInput').value.toLowerCase();
    const items = document.querySelectorAll('.proveedor-item');

    items.forEach(item => {
        const id = item.dataset.id.toLowerCase();
        const nombre = item.dataset.nombre.toLowerCase();
        const matches = id.includes(searchTerm) || nombre.includes(searchTerm);
        item.style.display = matches ? 'block' : 'none';
    });
}

/**
 * Selecciona un proveedor
 */
function selectProveedor(id, nombre) {
    proveedorActivo = { id, nombre };
    
    // Guardar en localStorage para persistencia
    try {
        localStorage.setItem('proveedorActivo', JSON.stringify(proveedorActivo));
        Logger.info('proveedor-selector', 'Proveedor guardado en localStorage');
    } catch (error) {
        Logger.warn('proveedor-selector', 'No se pudo guardar en localStorage', error);
    }
    
    // Actualizar el select del formulario
    syncProveedorToSelect();
    
    // Actualizar gestor según el nuevo proveedor (si el editor está activo)
    if (typeof loadGestoresOptions === 'function') {
        loadGestoresOptions();
    }

    // NUEVO: Actualizar línea en el editor si está abierto
    if (typeof window.refreshLineaFromActiveNIT === 'function') {
        window.refreshLineaFromActiveNIT();
    }

    // Recargar ingresos confirmados filtrados por el nuevo proveedor
    if (typeof loadData2Data === 'function') {
        loadData2Data().catch(err =>
            Logger.warn('proveedor-selector', 'No se pudo recargar ingresos confirmados', err)
        );
    }

    // Recargar historicas filtradas por el nuevo proveedor
    if (typeof loadHistoricasData === 'function') {
        loadHistoricasData().catch(err =>
            Logger.warn('proveedor-selector', 'No se pudo recargar historicas', err)
        );
    }

    // Recargar colores filtrados por el nuevo proveedor
    if (typeof loadColoresData === 'function') {
        loadColoresData().then(() => {
            if (typeof updateDataStats === 'function') updateDataStats();
        }).catch(err =>
            Logger.warn('proveedor-selector', 'No se pudo recargar colores', err)
        );
    }

    // Actualizar indicador en la UI
    updateProveedorIndicator();
    
    // Cerrar modal
    closeProveedorSelector();
    
    // Mostrar mensaje
    showMessage(`Proveedor seleccionado: ${nombre}`, 'success', 2000);
    
    Logger.info('proveedor-selector', `Proveedor activo: ${id} - ${nombre}`);
}

/**
 * Limpia el proveedor activo
 */
function clearProveedorActivo() {
    proveedorActivo = null;
    
    // Limpiar de localStorage
    try {
        localStorage.removeItem('proveedorActivo');
        Logger.info('proveedor-selector', 'Proveedor eliminado de localStorage');
    } catch (error) {
        Logger.warn('proveedor-selector', 'No se pudo limpiar localStorage', error);
    }
    
    // Actualizar gestor (mostrar todos al limpiar proveedor)
    if (typeof loadGestoresOptions === 'function') {
        loadGestoresOptions();
    }

    // NUEVO: Actualizar línea en el editor si está abierto
    if (typeof window.refreshLineaFromActiveNIT === 'function') {
        window.refreshLineaFromActiveNIT();
    }

    // Recargar ingresos confirmados sin filtro de productora
    if (typeof loadData2Data === 'function') {
        loadData2Data().catch(err =>
            Logger.warn('proveedor-selector', 'No se pudo recargar ingresos confirmados', err)
        );
    }

    // Recargar historicas sin filtro de productora
    if (typeof loadHistoricasData === 'function') {
        loadHistoricasData().catch(err =>
            Logger.warn('proveedor-selector', 'No se pudo recargar historicas', err)
        );
    }

    // Recargar colores sin filtro de productora
    if (typeof loadColoresData === 'function') {
        loadColoresData().then(() => {
            if (typeof updateDataStats === 'function') updateDataStats();
        }).catch(err =>
            Logger.warn('proveedor-selector', 'No se pudo recargar colores', err)
        );
    }

    updateProveedorIndicator();
    closeProveedorSelector();
    showMessage('Proveedor limpiado', 'info', 2000);
}

/**
 * Cierra el modal de selección
 */
function closeProveedorSelector() {
    const overlay = document.getElementById('proveedorSelectorOverlay');
    if (overlay) {
        overlay.remove();
    }
}

/**
 * Actualiza el indicador visual del proveedor activo en el status-bar
 */
function updateProveedorIndicator() {
    const indicator = document.getElementById('proveedorIndicator');
    const indicatorText = document.getElementById('proveedorIndicatorText');
    
    if (!indicator || !indicatorText) {
        Logger.warn('proveedor-selector', 'Elementos del indicador no encontrados en el DOM');
        return;
    }

    if (proveedorActivo) {
        // Mostrar información del proveedor activo
        indicatorText.textContent = `${proveedorActivo.id} - ${proveedorActivo.nombre}`;
        indicator.title = `Proveedor activo: ${proveedorActivo.nombre}\nClick para cambiar (Ctrl+S)`;
        indicator.style.background = 'var(--primary)';
    } else {
        // Mostrar mensaje cuando no hay proveedor
        indicatorText.textContent = 'Sin proveedor seleccionado';
        indicator.title = 'Click para seleccionar proveedor (Ctrl+S)';
        indicator.style.background = 'var(--text-secondary)';
    }
}

/**
 * Obtiene el proveedor activo
 */
function getProveedorActivo() {
    return proveedorActivo;
}

/**
 * Carga el proveedor por defecto al iniciar la aplicación
 * Prioridad: 1) localStorage (último seleccionado), 2) Proveedor por defecto (900616124)
 * @param {string} defaultId - ID del proveedor por defecto si no hay uno guardado
 */
async function loadDefaultProveedor(defaultId = '900616124') {
    try {
        // Verificar si proveedoresMap está cargado
        if (!window.proveedoresMap || window.proveedoresMap.size === 0) {
            Logger.info('proveedor-selector', 'Cargando proveedores para establecer proveedor por defecto...');
            await loadProveedoresData();
        }

        let proveedorId = defaultId;
        let fromStorage = false;

        // Intentar cargar desde localStorage primero
        try {
            const saved = localStorage.getItem('proveedorActivo');
            if (saved) {
                const savedProveedor = JSON.parse(saved);
                if (savedProveedor && savedProveedor.id) {
                    proveedorId = savedProveedor.id;
                    fromStorage = true;
                    Logger.info('proveedor-selector', `Proveedor recuperado de localStorage: ${proveedorId}`);
                }
            }
        } catch (error) {
            Logger.warn('proveedor-selector', 'No se pudo leer localStorage, usando proveedor por defecto', error);
        }

        // Buscar el proveedor por ID
        if (window.proveedoresMap.has(proveedorId)) {
            const proveedorData = window.proveedoresMap.get(proveedorId);
            proveedorActivo = {
                id: proveedorId,
                nombre: proveedorData.NOMBRE
            };
            
            // Si no venía de localStorage, guardarlo para la próxima vez
            if (!fromStorage) {
                try {
                    localStorage.setItem('proveedorActivo', JSON.stringify(proveedorActivo));
                } catch (error) {
                    Logger.warn('proveedor-selector', 'No se pudo guardar en localStorage', error);
                }
            }
            
            // Actualizar indicador
            updateProveedorIndicator();
            
            // Actualizar el input del formulario
            syncProveedorToSelect();
            
            const source = fromStorage ? 'último seleccionado' : 'por defecto';
            Logger.success('proveedor-selector', `Proveedor ${source} cargado: ${proveedorId} - ${proveedorData.NOMBRE}`);
        } else {
            Logger.warn('proveedor-selector', `Proveedor ${proveedorId} no encontrado en la base de datos`);
            
            // Si el proveedor guardado no existe, intentar con el por defecto
            if (fromStorage && proveedorId !== defaultId) {
                Logger.info('proveedor-selector', `Intentando con proveedor por defecto: ${defaultId}`);
                localStorage.removeItem('proveedorActivo');
                await loadDefaultProveedor(defaultId);
                return;
            }
            
            updateProveedorIndicator(); // Actualizar con estado "sin proveedor"
        }
    } catch (error) {
        Logger.error('proveedor-selector', 'Error cargando proveedor por defecto', error);
        updateProveedorIndicator(); // Actualizar con estado "sin proveedor"
    }
}

/**
 * Sincroniza el proveedor activo con el input del formulario
 */
function syncProveedorToSelect() {
    const proveedorInput = document.getElementById('proveedor');
    if (!proveedorInput) {
        Logger.warn('proveedor-selector', 'Input de proveedor no encontrado en el DOM');
        return;
    }
    
    if (proveedorActivo) {
        proveedorInput.value = proveedorActivo.nombre;
        Logger.info('proveedor-selector', `Input actualizado a: ${proveedorActivo.nombre}`);
    } else {
        proveedorInput.value = '';
        Logger.info('proveedor-selector', 'Input limpiado (sin proveedor)');
    }
}

/**
 * Inicializa el sistema de selección de proveedor
 */
function initProveedorSelector() {
    // Atajo de teclado Ctrl+S
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            showProveedorSelector();
        }
        
        // Escape para cerrar
        if (e.key === 'Escape') {
            closeProveedorSelector();
        }
    });

    // Cargar proveedor por defecto
    loadDefaultProveedor('900616124');

    Logger.info('proveedor-selector', 'Sistema de selección de proveedor inicializado (Ctrl+S)');
}

/**
 * Cambia el proveedor activo silenciosamente (sin recargar datos ni abrir modales)
 * Útil cuando se procesa un Excel con línea ANGELES que requiere cambiar el proveedor
 */
function setProveedorActivo(id, nombre) {
    proveedorActivo = { id, nombre };
    window.proveedorActivo = proveedorActivo;
    try { localStorage.setItem('proveedorActivo', JSON.stringify(proveedorActivo)); } catch(e) {}
    syncProveedorToSelect();
    updateProveedorIndicator();
    Logger.info('proveedor-selector', `Proveedor activo cambiado silenciosamente: ${id} - ${nombre}`);
}

// Exports
window.showProveedorSelector = showProveedorSelector;
window.closeProveedorSelector = closeProveedorSelector;
window.selectProveedor = selectProveedor;
window.clearProveedorActivo = clearProveedorActivo;
window.getProveedorActivo = getProveedorActivo;
window.loadDefaultProveedor = loadDefaultProveedor;
window.syncProveedorToSelect = syncProveedorToSelect;
window.initProveedorSelector = initProveedorSelector;
window.proveedorActivo = proveedorActivo;
window.setProveedorActivo = setProveedorActivo;
