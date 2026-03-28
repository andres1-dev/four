// ============================================
// CONFIGURACIÓN DE NOTIFICACIONES
// ============================================
// URL para Google Apps Script (notificaciones push)
const R1_GAS_URL = 'https://script.google.com/macros/s/AKfycbyDTzMkBog7uq3o_0yAuD_WVHOtLQNgBYMzxgdrr9QlLFTKJOk_8mJJlaXMqkixEnm05A/exec';

let API_URL_POLLING = null;
let USER_ID_POLLING = null;
let lastProcessedNotificationId = null; // Control anti-duplicados
let processingNotification = false; // Lock para evitar concurrencia
const PROCESSING_LOCK_TIMEOUT = 5000; // 5 segundos timeout

// ============================================
// INDEXED DB - Almacenamiento persistente
// ============================================
const DB_NAME = 'DeepSeekNotifications';
const DB_VERSION = 1;

async function getDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('config')) {
                db.createObjectStore('config');
            }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function setPersistentValue(key, value) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('config', 'readwrite');
        tx.objectStore('config').put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function getPersistentValue(key) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('config', 'readonly');
        const req = tx.objectStore('config').get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ============================================
// FUNCIÓN PARA CREAR ID ÚNICO DE NOTIFICACIÓN
// ============================================
function createNotificationId(notif) {
    if (!notif) return null;
    const ts = notif.timestamp || Date.now();
    const title = notif.title || '';
    const body = notif.body || '';
    return `${ts}-${title}-${body}`.replace(/\s+/g, '_');
}

// ============================================
// POLLING (Verificación periódica)
// ============================================
let pollingActive = false;

async function startBackgroundPolling() {
    if (pollingActive) return;
    pollingActive = true;

    if (!API_URL_POLLING) {
        API_URL_POLLING = await getPersistentValue('pollingUrl');
    }
    if (!USER_ID_POLLING) {
        USER_ID_POLLING = await getPersistentValue('pollingUserId');
    }

    console.log('[SW] Iniciando ciclo de polling en segundo plano (cada 2 minutos)...');

    // Verificación cada 2 minutos
    setInterval(async () => {
        await checkNotifications();
    }, 120000); // 2 minutos

    // Verificación inicial
    await checkNotifications();
}

async function checkNotifications() {
    // Evitar ejecuciones concurrentes
    if (processingNotification) {
        console.log('[SW Polling] Ya hay una verificación en curso, omitiendo...');
        return;
    }

    // Timeout de seguridad
    const lockTimeout = setTimeout(() => {
        processingNotification = false;
        console.log('[SW Polling] Timeout de lock liberado');
    }, PROCESSING_LOCK_TIMEOUT);

    const url = API_URL_POLLING || await getPersistentValue('pollingUrl');
    if (!url) {
        console.log('[SW Polling] Sin URL configurada, abortando check.');
        clearTimeout(lockTimeout);
        return;
    }

    processingNotification = true;

    try {
        const lastTs = (await getPersistentValue('lastNotifTs')) || 0;
        const fetchUrl = `${url}?action=get-latest-notification&_cb=${Date.now()}`;

        console.log('[SW Polling] Consultando servidor...');
        const res = await fetch(fetchUrl);
        const data = await res.json();

        if (data.success && data.notification) {
            const notif = data.notification;
            const ts = parseInt(notif.timestamp) || 0;
            const notificationId = createNotificationId(notif);

            // Solo mostrar si:
            // 1. El timestamp es más reciente Y
            // 2. No es la misma notificación que ya procesamos
            if (ts > lastTs && notificationId !== lastProcessedNotificationId) {
                console.log('[SW Polling] ¡Nueva notificación detectada!');

                lastProcessedNotificationId = notificationId;
                await setPersistentValue('lastNotifTs', ts);

                await self.registration.showNotification(notif.title || 'App Notif', {
                    body: notif.body || 'Nuevo aviso del sistema',
                    icon: './icons/icon-192.png',
                    badge: './icons/icon-192.png',
                    tag: 'app-notif',
                    vibrate: [200, 100, 200],
                    data: { url: './', timestamp: ts }
                });

                console.log('[SW Polling] Notificación mostrada correctamente');
            }
        }
    } catch (e) {
        console.warn('[SW Polling] Error de conexión:', e.message);
    } finally {
        clearTimeout(lockTimeout);
        processingNotification = false;
    }
}

// ============================================
// PUSH REAL (Notificaciones push nativas)
// ============================================
self.addEventListener('push', (event) => {
    console.log('[SW] Push real recibido');

    // Si ya estamos procesando, ignorar este push
    if (processingNotification) {
        console.log('[SW Push] Ya procesando una notificación, ignorando push...');
        event.waitUntil(Promise.resolve());
        return;
    }

    // Timeout de seguridad
    const lockTimeout = setTimeout(() => {
        processingNotification = false;
        console.log('[SW Push] Timeout de lock liberado');
    }, PROCESSING_LOCK_TIMEOUT);

    const getPayload = new Promise((resolve, reject) => {
        // Intentar leer payload directo (Android/Chrome)
        if (event.data) {
            try {
                const json = event.data.json();
                if (json && json.title) {
                    console.log('[SW] Datos recibidos en payload directo');
                    resolve(json);
                    return;
                }
            } catch (e) {
                console.log('[SW] Payload no es JSON válido');
            }
        }

        // Sin payload (iOS tickle) → fetch desde r1
        console.log('[SW] Sin payload, obteniendo de r1...');
        const cacheBuster = '&t=' + Date.now();
        fetch(R1_GAS_URL + '?action=get-latest-notification' + cacheBuster)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.notification) {
                    resolve(data.notification);
                } else {
                    reject('No hay notificaciones recientes');
                }
            })
            .catch(err => reject(err));
    });

    event.waitUntil(
        getPayload
            .then(async payload => {
                const ts = payload.timestamp || Date.now();
                const notificationId = createNotificationId(payload);

                // Verificar duplicados
                const lastTs = await getPersistentValue('lastNotifTs') || 0;

                if (notificationId === lastProcessedNotificationId || ts <= lastTs) {
                    console.log('[SW Push] Notificación ya procesada anteriormente, ignorando');
                    return;
                }

                // Marcar como procesada
                lastProcessedNotificationId = notificationId;
                await setPersistentValue('lastNotifTs', ts);
                processingNotification = true;

                const title = payload.title || 'App Notif';
                const options = {
                    body: payload.body || 'Tienes un mensaje nuevo',
                    icon: './icons/icon-192.png',
                    badge: './icons/icon-192.png',
                    vibrate: [200, 100, 200],
                    tag: 'push-notif',
                    data: {
                        url: payload.url || './',
                        timestamp: ts,
                        id: notificationId
                    }
                };

                console.log('[SW Push] Mostrando notificación:', title);
                return self.registration.showNotification(title, options);
            })
            .catch(err => {
                console.error('[SW] Error procesando push:', err);
                // Mostrar notificación genérica solo si es error real
                if (err !== 'No hay notificaciones recientes') {
                    return self.registration.showNotification('App Notif', {
                        body: 'Abre la app para ver el mensaje',
                        icon: './icons/icon-192.png',
                        data: { url: './' }
                    });
                }
            })
            .finally(() => {
                clearTimeout(lockTimeout);
                processingNotification = false;
            })
    );
});

// ============================================
// CLICK EN NOTIFICACIÓN
// ============================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                for (let client of windowClients) {
                    if (client.url === urlToOpen && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// ============================================
// MENSAJES PARA NOTIFICACIONES
// ============================================
self.addEventListener('message', (event) => {
    // Configurar polling
    if (event.data && event.data.type === 'SET_POLLING_CONFIG') {
        const url = event.data.url;
        const userId = event.data.userId;
        const ts = event.data.lastTs || 0;

        setPersistentValue('pollingUrl', url);
        setPersistentValue('pollingUserId', userId);

        const currentTs = getPersistentValue('lastNotifTs') || 0;
        if (ts > currentTs) {
            setPersistentValue('lastNotifTs', ts);
        }

        API_URL_POLLING = url;
        USER_ID_POLLING = userId;
        console.log('[SW] URL de Polling y User ID configurados');
        startBackgroundPolling();
    }

    // Verificar notificaciones ahora
    if (event.data && event.data.type === 'CHECK_NOW') {
        checkNotifications();
    }

    // Resetear ID de última notificación (para pruebas)
    if (event.data && event.data.type === 'RESET_NOTIFICATION_ID') {
        lastProcessedNotificationId = null;
        console.log('[SW] ID de última notificación reseteado');
    }
});

// ============================================
// PERIODIC SYNC (Sincronización periódica)
// ============================================
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'check-notif') {
        event.waitUntil(checkNotifications());
    }
});

// ============================================
// LIMPIEZA PERIÓDICA DEL ID
// ============================================
setInterval(() => {
    if (!processingNotification) {
        console.log('[SW] Limpiando ID de última notificación');
        lastProcessedNotificationId = null;
    }
}, 300000); // Cada 5 minutos

// Iniciar polling automáticamente
startBackgroundPolling();

console.log('[SW] Service Worker cargado');
