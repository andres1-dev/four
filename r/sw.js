/* ==========================================================================
   sw.js — Service Worker SISPRO v2
   - Push real (Android/Chrome via VAPID)
   - Polling fallback para iOS (fetch periódico)
   - Cache offline básico
   - Anti-duplicados por ID de notificación
   ========================================================================== */

const SW_VERSION   = 'sispro-v3';
const CACHE_NAME   = SW_VERSION;

/* Archivos a cachear para funcionamiento offline básico */
const ASSETS_CACHE = [
  './index.html',
  './login.html',
  './css/main.css',
  './css/components.css',
  './js/config.js',
  './js/api.js',
  './js/auth.js',
  './icons/icon-any.svg',
  './icons/icon-maskable.svg',
];

/* ── GAS endpoint para pull de última notificación (iOS tickle) ── */
/* Se sobreescribe desde el cliente via mensaje SET_CONFIG */
let GAS_NOTIF_URL = null;

/* ── Anti-duplicados ── */
let _lastNotifId  = null;
let _lastNotifTs  = 0;
let _processing   = false;

/* ── Polling background (iOS / fallback) ── */
let _pollingActive = false;
const POLL_INTERVAL_MS = 60_000; // 1 min en background

/* ══════════════════════════════════════════════════════════════════════════
   IndexedDB — persistencia entre reinicios del SW
   ══════════════════════════════════════════════════════════════════════════ */
const IDB_NAME    = 'sispro_sw';
const IDB_VERSION = 1;

function _getDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = e => {
      if (!e.target.result.objectStoreNames.contains('kv'))
        e.target.result.createObjectStore('kv');
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}
async function _idbSet(key, val) {
  const db = await _getDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => res();
    tx.onerror    = () => rej(tx.error);
  });
}
async function _idbGet(key) {
  const db = await _getDB();
  return new Promise((res, rej) => {
    const tx  = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   INSTALL
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('install', event => {
  console.log('[SW] Instalando', SW_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_CACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   ACTIVATE
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('activate', event => {
  console.log('[SW] Activando', SW_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(async () => {
        // Restaurar estado persistido
        GAS_NOTIF_URL = await _idbGet('gasNotifUrl') || null;
        _lastNotifTs  = (await _idbGet('lastNotifTs')) || 0;
        _lastNotifId  = (await _idbGet('lastNotifId')) || null;
        if (GAS_NOTIF_URL) _startPolling();
      })
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   FETCH — Network first, cache fallback
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.url.includes('script.google.com') || req.url.includes('sheets.googleapis.com')) return;
  if (req.url.includes('generativelanguage.googleapis.com')) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   MENSAJES DESDE EL CLIENTE
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('message', async event => {
  const { type, ...data } = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  /* El cliente envía la URL del GAS de notificaciones y el ts conocido */
  if (type === 'SET_CONFIG' || type === 'SET_POLLING_CONFIG') {
    GAS_NOTIF_URL = data.gasUrl || data.url;
    await _idbSet('gasNotifUrl', GAS_NOTIF_URL);
    if (data.lastTs) {
      _lastNotifTs = data.lastTs;
      await _idbSet('lastNotifTs', _lastNotifTs);
    }
    console.log('[SW] Config recibida, URL:', GAS_NOTIF_URL);
    _startPolling();
    return;
  }

  /* Forzar check inmediato (al volver a la app) */
  if (type === 'CHECK_NOW') {
    _checkAndNotify();
    return;
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   PUSH REAL (Android / Chrome / Edge)
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('push', event => {
  console.log('[SW] Push recibido');
  event.waitUntil(_handlePushEvent(event));
});

async function _handlePushEvent(event) {
  if (_processing) return;
  _processing = true;
  const timeout = setTimeout(() => { _processing = false; }, 8000);

  try {
    let payload = null;

    /* Intentar leer payload directo (Chrome/Android) */
    if (event.data) {
      try { payload = event.data.json(); } catch (_) {}
    }

    /* Sin payload (iOS tickle) → fetch desde GAS */
    if (!payload) {
      const url = GAS_NOTIF_URL || (await _idbGet('gasNotifUrl'));
      if (!url) return;
      const res  = await fetch(`${url}?action=get-latest-notification&_t=${Date.now()}`);
      const json = await res.json();
      if (json.success && json.notification) payload = json.notification;
    }

    if (!payload) return;
    await _showIfNew(payload);
  } catch (e) {
    console.warn('[SW] Error en push:', e.message);
  } finally {
    clearTimeout(timeout);
    _processing = false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   POLLING BACKGROUND (fallback iOS / pestaña cerrada)
   ══════════════════════════════════════════════════════════════════════════ */
function _startPolling() {
  if (_pollingActive) return;
  _pollingActive = true;
  console.log('[SW] Polling iniciado cada', POLL_INTERVAL_MS / 1000, 's');
  setInterval(_checkAndNotify, POLL_INTERVAL_MS);
  _checkAndNotify(); // check inmediato
}

async function _checkAndNotify() {
  if (_processing) return;
  const url = GAS_NOTIF_URL || (await _idbGet('gasNotifUrl'));
  if (!url) return;

  try {
    const res  = await fetch(`${url}?action=get-latest-notification&_t=${Date.now()}`);
    const json = await res.json();
    if (json.success && json.notification) {
      await _showIfNew(json.notification);
    }
  } catch (_) {}
}

/* ══════════════════════════════════════════════════════════════════════════
   MOSTRAR NOTIFICACIÓN (anti-duplicados)
   ══════════════════════════════════════════════════════════════════════════ */
async function _showIfNew(payload) {
  const ts = parseInt(payload.timestamp) || 0;
  const id = payload.id || `${payload.title}_${ts}`;

  const savedTs = _lastNotifTs || (await _idbGet('lastNotifTs')) || 0;
  const savedId = _lastNotifId || (await _idbGet('lastNotifId')) || null;

  if (ts > 0 && ts <= savedTs && id === savedId) {
    console.log('[SW] Notificación ya mostrada, ignorando');
    return;
  }

  // Actualizar anti-duplicados
  _lastNotifTs = ts;
  _lastNotifId = id;
  await _idbSet('lastNotifTs', ts);
  await _idbSet('lastNotifId', id);

  // Verificar si la app está en primer plano
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appVisible = allClients.some(c => c.visibilityState === 'visible');

  if (appVisible) {
    // App visible → enviar mensaje al cliente para actualizar campana
    allClients.forEach(c => c.postMessage({ type: 'NEW_PUSH_NOTIF', payload }));
    console.log('[SW] App visible, mensaje enviado al cliente');
    return;
  }

  // App en background o cerrada → notificación nativa del SO
  const icon  = payload.icon  || './icons/icon-any.svg';
  const badge = './icons/icon-maskable.svg';

  await self.registration.showNotification(payload.title || 'SISPRO', {
    body:     payload.body    || 'Tienes una actualización',
    icon,
    badge,
    tag:      `sispro-${id}`,
    renotify: true,
    vibrate:  [200, 100, 200],
    data:     { url: payload.url || './index.html', id, ts }
  });

  console.log('[SW] Notificación nativa mostrada:', payload.title);
}

/* ══════════════════════════════════════════════════════════════════════════
   CLICK EN NOTIFICACIÓN
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        for (const c of clients) {
          if ('focus' in c) return c.focus();
        }
        return self.clients.openWindow(target);
      })
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   PERIODIC SYNC (Chrome Android)
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('periodicsync', event => {
  if (event.tag === 'sispro-check') {
    event.waitUntil(_checkAndNotify());
  }
});

console.log('[SW] Cargado —', SW_VERSION);
