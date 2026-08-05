// Script de Inicialización y Encendido de la App

document.addEventListener('DOMContentLoaded', () => {
    // 0. Registrar Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('SW registrado con éxito:', registration.scope);
                })
                .catch(err => {
                    console.log('Fallo registro SW:', err);
                });
        });
    }

    // Bloquear rotación de pantalla (Forzar Portrait)
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch(function (error) {
            console.log('La orientación no pudo ser bloqueada por JS: ' + error);
        });
    }

    // 1. Inicializar Listeners UI
    initUIListeners();

    // 2. Inicializar Listeners QR
    initQRListeners();

    // 3. Referencias DOM para eventos online/offline
    const offlineBanner = document.getElementById('offline-banner');
    const statusDiv = document.getElementById('status');

    // Verificar si estamos en modo offline
    window.addEventListener('online', function () {
        if (offlineBanner) offlineBanner.style.display = 'none';
        if (statusDiv) {
            statusDiv.className = 'reconnected';
            statusDiv.innerHTML = '<i class="fas fa-wifi"></i> CONEXIÓN RESTABLECIDA';
        }
        // Si los datos aún no se han cargado, intentar cargarlos de nuevo
        if (!dataLoaded) {
            setTimeout(() => loadDataFromServer(), 1000);
        }
    });

    window.addEventListener('offline', function () {
        if (offlineBanner) offlineBanner.style.display = 'block';
        if (statusDiv) {
            statusDiv.className = 'offline';
            statusDiv.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; text-align: center;">
                <i class="fas fa-wifi-slash" style="font-size: 20px;"></i>
                <span>MODO OFFLINE ACTIVO</span>
            </div>
        `;
        }
    });

    // Agregar eventos para prevenir teclado virtual en cámara de forma segura
    const cameraModal = document.getElementById('cameraModal');
    if (cameraModal) {
        document.addEventListener('focusin', function (e) {
            if (cameraModal.style.display === 'flex' &&
                e.target.id !== 'dummyInput') {
                e.preventDefault();
            }
        });
    }

    // 4. NO cargar datos masivos - sistema on-demand activo
    // loadDataFromServer();
    
    // Marcar sistema como listo inmediatamente
    dataLoaded = true;
    
    // Mostrar interfaz con mensaje de bienvenida
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
        <div class="result-item" style="text-align: center; padding: 40px 20px;">
            <div style="margin-bottom: 30px;">
                <div style="width: 70px; height: 70px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; animation: subtleFloat 3s ease-in-out infinite;">
                    <img src="./icons/icon-any.svg" alt="${CONFIG.APP_NAME} Logo" style="width: 100%; height: 100%;">
                </div>
                <h1 class="brand-app-name">${CONFIG.APP_NAME}</h1>
                <p class="brand-app-desc">${CONFIG.APP_DESCRIPTION}</p>
            </div>
            
            <div style="background: #f8fafc; border-radius: 16px; padding: 18px 20px; margin: 25px 0; border: 1px solid var(--border); display: flex; align-items: center; gap: 16px; text-align: left;">
                <div style="width: 42px; height: 42px; background: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 1.2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); flex-shrink: 0;">
                    <i class="fas fa-qrcode"></i>
                </div>
                <div style="flex: 1;">
                    <p style="font-size: 13px; color: var(--text-main); margin: 0 0 2px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Sistema listo</p>
                    <p style="font-size: 12px; color: var(--text-secondary); margin: 0; opacity: 0.85;">Escanea un código QR para comenzar</p>
                </div>
                <div style="width: 8px; height: 8px; background: var(--success); border-radius: 50%; box-shadow: 0 0 8px var(--success);"></div>
            </div>
            
            <div style="margin-top: 40px; padding-top: 2px; border-top: 1px solid var(--border);">
                <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 15px; line-height: 1.4;" class="credits">
                    ${CONFIG.FOOTER_CREDITS}
                </p>
            </div>
        </div>
    `;
    }
    
    // Ocultar pantalla de carga
    hideLoadingScreen();
    
    // Actualizar estado
    if (typeof window.updateStatusDisplay === 'function') {
        window.updateStatusDisplay("SISTEMA LISTO", "ready");
    }
    
    // Actualizar estadísticas
    const dataStats = document.getElementById('data-stats');
    if (dataStats) {
        dataStats.innerHTML = '<i class="fas fa-database"></i> On-Demand';
    }
});
