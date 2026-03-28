// Gestor de sincronización en tiempo real entre pestañas/dispositivos

class SyncManager {
  constructor() {
    this.channel = null;
    this.swRegistration = null;
    this.isInitialized = false;
    this.onSyncCallback = null;
  }

  async init(onSyncCallback) {
    this.onSyncCallback = onSyncCallback;

    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      try {
        // Detectar la ruta base del proyecto (funciona en subdirectorios de GitHub Pages)
        const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const swPath = basePath + 'sw.js';
        
        this.swRegistration = await navigator.serviceWorker.register(swPath, {
          scope: basePath
        });
        console.log('[Sync] Service Worker registrado en:', swPath);

        // Escuchar mensajes del Service Worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'FORCE_REFRESH') {
            console.log('[Sync] Actualización recibida desde otra pestaña:', event.data);
            if (this.onSyncCallback) {
              this.onSyncCallback(event.data);
            }
          }
        });
      } catch (error) {
        console.error('[Sync] Error al registrar Service Worker:', error);
      }
    }

    // Broadcast Channel API para sincronización entre pestañas del mismo origen
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('documentos-sync');
      
      this.channel.onmessage = (event) => {
        console.log('[Sync] Mensaje recibido por Broadcast Channel:', event.data);
        if (this.onSyncCallback) {
          this.onSyncCallback(event.data);
        }
      };
    }

    this.isInitialized = true;
    console.log('[Sync] Sistema de sincronización inicializado');
  }

  // Notificar cambios a otras pestañas/dispositivos
  notifyChange(action, rec = null, additionalData = {}) {
    if (!this.isInitialized) {
      console.warn('[Sync] Sistema no inicializado');
      return;
    }

    const message = {
      type: 'FORCE_REFRESH',
      action: action,
      rec: rec,
      timestamp: Date.now(),
      ...additionalData
    };

    // Enviar por Broadcast Channel (pestañas del mismo navegador)
    if (this.channel) {
      this.channel.postMessage(message);
      console.log('[Sync] Mensaje enviado por Broadcast Channel:', message);
    }

    // Enviar por Service Worker (puede llegar a otros dispositivos si están conectados)
    if (this.swRegistration && this.swRegistration.active) {
      this.swRegistration.active.postMessage({
        type: 'SYNC_UPDATE',
        action: action,
        rec: rec,
        ...additionalData
      });
      console.log('[Sync] Mensaje enviado al Service Worker:', message);
    }
  }

  // Destruir conexiones
  destroy() {
    if (this.channel) {
      this.channel.close();
    }
    this.isInitialized = false;
  }
}

// Instancia global
window.syncManager = new SyncManager();
