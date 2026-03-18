/* ==========================================================================
   sw.js — Service Worker SISPRO v3
   - Push real (Android/Chrome via VAPID)
   - Polling fallback para iOS (fetch periódico)
   - SIN cache — siempre red, nunca archivos viejos
   - Anti-duplicados por ID de notificación
   ========================================================================== */

const SW_VERSION = 'sispro-v9';

/* ── GAS endpoint para pull de última notificación ── */
let GAS_NOTIF_URL = null;

/* ── Anti-duplicados ── */
let _lastNotifId  = null;
let _lastNotifTs  = 0;
let _processing   = false;

/* ── Polling background (iOS / fallback) ── */
let _pollingActive = false;
const POLL_INTERVAL_MS = 60_000;

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

/* ── Logger SW ── */
function _swLog(level, step, msg, data) {
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `[SW][${ts}][${step}]`;
  const out = data !== undefined ? [prefix, msg, data] : [prefix, msg];
  if (level === 'error') console.error(...out);
  else if (level === 'warn') console.warn(...out);
  else console.log(...out);
}

/* ══════════════════════════════════════════════════════════════════════════
   INSTALL — sin cache, solo activar inmediatamente
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('install', event => {
  _swLog('info', 'INSTALL', 'Instalando', SW_VERSION);
  event.waitUntil(self.skipWaiting());
});

/* ══════════════════════════════════════════════════════════════════════════
   ACTIVATE — limpiar todos los caches existentes
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('activate', event => {
  _swLog('info', 'ACTIVATE', 'Activando', SW_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => {
        _swLog('info', 'ACTIVATE', 'Caches encontrados a eliminar:', keys);
        return Promise.all(keys.map(k => caches.delete(k)));
      })
      .then(() => self.clients.claim())
      .then(async () => {
        GAS_NOTIF_URL = await _idbGet('gasNotifUrl') || null;
        _lastNotifTs  = (await _idbGet('lastNotifTs')) || 0;
        _lastNotifId  = (await _idbGet('lastNotifId')) || null;
        _swLog('info', 'ACTIVATE', 'Estado restaurado desde IDB:', { GAS_NOTIF_URL, _lastNotifTs, _lastNotifId });
        if (GAS_NOTIF_URL) {
          _swLog('info', 'ACTIVATE', 'URL GAS disponible → iniciando polling');
          _startPolling();
        } else {
          _swLog('warn', 'ACTIVATE', 'Sin URL GAS — esperando config del cliente');
        }
      })
  );
});

/* ══════════════════════════════════════════════════════════════════════════
   FETCH — siempre red, nunca cache
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  // Dejar pasar todo sin interceptar — el navegador maneja normalmente
  return;
});

/* ══════════════════════════════════════════════════════════════════════════
   MENSAJES DESDE EL CLIENTE
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('message', async event => {
  const { type, ...data } = event.data || {};
  _swLog('info', 'MESSAGE', 'Mensaje recibido del cliente:', { type, ...data });

  if (type === 'SKIP_WAITING') {
    _swLog('info', 'MESSAGE', 'SKIP_WAITING → forzando activación');
    self.skipWaiting();
    return;
  }

  if (type === 'SET_CONFIG' || type === 'SET_POLLING_CONFIG') {
    GAS_NOTIF_URL = data.gasUrl || data.url;
    await _idbSet('gasNotifUrl', GAS_NOTIF_URL);
    if (data.lastTs) {
      _lastNotifTs = data.lastTs;
      await _idbSet('lastNotifTs', _lastNotifTs);
    }
    _swLog('info', 'MESSAGE', 'Config guardada:', { GAS_NOTIF_URL, lastTs: _lastNotifTs });
    _startPolling();
    return;
  }

  if (type === 'CHECK_NOW') {
    _swLog('info', 'MESSAGE', 'CHECK_NOW → verificando notificaciones inmediatamente');
    _checkAndNotify();
    return;
  }

  _swLog('warn', 'MESSAGE', 'Tipo de mensaje desconocido:', type);
});

/* ══════════════════════════════════════════════════════════════════════════
   PUSH REAL (Android / Chrome / Edge)
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('push', event => {
  _swLog('info', 'PUSH', 'Evento push recibido');
  _swLog('info', 'PUSH', 'Tiene datos:', !!event.data);
  event.waitUntil(_handlePushEvent(event));
});

async function _handlePushEvent(event) {
  if (_processing) {
    _swLog('warn', 'PUSH', 'Ya procesando otro push, ignorando');
    return;
  }
  _processing = true;
  const timeout = setTimeout(() => {
    _swLog('warn', 'PUSH', 'Timeout de 8s alcanzado, liberando lock');
    _processing = false;
  }, 8000);

  try {
    let payload = null;

    if (event.data) {
      try {
        payload = event.data.json();
        _swLog('info', 'PUSH', 'Payload directo parseado:', payload);
      } catch (e) {
        _swLog('warn', 'PUSH', 'No se pudo parsear payload directo:', e.message);
      }
    }

    if (!payload) {
      _swLog('info', 'PUSH', 'Sin payload directo → fetch desde GAS (iOS tickle)');
      const url = GAS_NOTIF_URL || (await _idbGet('gasNotifUrl'));
      if (!url) {
        _swLog('error', 'PUSH', 'Sin URL GAS configurada, no se puede obtener notificación');
        return;
      }
      const fetchUrl = `${url}?action=get-latest-notification&_t=${Date.now()}`;
      _swLog('info', 'PUSH', 'Fetching:', fetchUrl);
      const res  = await fetch(fetchUrl);
      _swLog('info', 'PUSH', 'Fetch status:', res.status);
      const json = await res.json();
      _swLog('info', 'PUSH', 'Respuesta GAS:', json);
      if (json.success && json.notification) payload = json.notification;
    }

    if (!payload) {
      _swLog('warn', 'PUSH', 'Sin payload disponible, nada que mostrar');
      return;
    }
    await _showIfNew(payload);
  } catch (e) {
    _swLog('error', 'PUSH', 'Error procesando push:', e.message);
  } finally {
    clearTimeout(timeout);
    _processing = false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   POLLING BACKGROUND
   ══════════════════════════════════════════════════════════════════════════ */
function _startPolling() {
  if (_pollingActive) {
    _swLog('info', 'POLLING', 'Polling ya activo, ignorando');
    return;
  }
  _pollingActive = true;
  _swLog('info', 'POLLING', `Iniciando polling cada ${POLL_INTERVAL_MS / 1000}s`);
  setInterval(_checkAndNotify, POLL_INTERVAL_MS);
  _checkAndNotify();
}

async function _checkAndNotify() {
  if (_processing) {
    _swLog('info', 'POLLING', 'Procesando, saltando este ciclo');
    return;
  }
  const url = GAS_NOTIF_URL || (await _idbGet('gasNotifUrl'));
  if (!url) {
    _swLog('warn', 'POLLING', 'Sin URL GAS, no se puede hacer check');
    return;
  }

  _swLog('info', 'POLLING', 'Consultando GAS...');
  try {
    const fetchUrl = `${url}?action=get-latest-notification&_t=${Date.now()}`;
    const res  = await fetch(fetchUrl);
    const json = await res.json();
    _swLog('info', 'POLLING', 'Respuesta GAS:', json);
    _swLog('info', 'POLLING', 'Estado anti-dup actual:', { _lastNotifId, _lastNotifTs });
    if (json.success && json.notification) {
      await _showIfNew(json.notification);
    } else {
      _swLog('info', 'POLLING', 'Sin notificaciones nuevas');
    }
  } catch (e) {
    _swLog('error', 'POLLING', 'Error en check:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   FORMATEAR NOTIFICACIÓN
   ══════════════════════════════════════════════════════════════════════════ */
function _formatNotif(payload) {
  const notifType = payload.notifType || 'estado';
  const lote      = payload.lote      || '';
  const planta    = payload.planta    || '';
  const ref       = payload.referencia || '';
  const area      = payload.area      || '';
  const idNovedad = payload.idNovedad || '';

  let title, body, url;

  if (notifType === 'chat') {
    const autor = payload.autor || planta || 'Planta';
    title = '💬 Mensaje — Lote ' + (lote || 'S/N');
    body  = autor + ': ' + (payload.body || '').substring(0, 80);
    url   = './index.html';
  } else {
    const estado = (payload.estadoActual || '').toUpperCase();
    const emoji  = estado === 'FINALIZADO' ? '✅' : '🔧';
    const label  = estado === 'FINALIZADO' ? 'Solucionado' : 'En Elaboración';
    title = emoji + ' Lote ' + (lote || 'S/N') + ' — ' + label;
    const parts = [];
    if (ref)    parts.push('Ref: ' + ref);
    if (area)   parts.push(area);
    if (planta) parts.push(planta);
    body = parts.join(' · ');
    url  = idNovedad ? ('./seguimiento.html#' + idNovedad) : './seguimiento.html';
  }

  return { title, body, url };
}

/* ══════════════════════════════════════════════════════════════════════════
   MOSTRAR NOTIFICACIÓN (anti-duplicados)
   ══════════════════════════════════════════════════════════════════════════ */
async function _showIfNew(payload) {
  const ts = parseInt(payload.timestamp) || 0;
  // Para chat: incluir fragmento del body en el id para que mensajes distintos
  // nunca colisionen aunque lleguen en el mismo milisegundo
  const bodySnippet = (payload.body || '').trim().substring(0, 30).replace(/\s+/g, '_');
  const id = payload.id
    ? (payload.notifType === 'chat' ? `${payload.id}_${bodySnippet}` : payload.id)
    : `${payload.title}_${ts}_${bodySnippet}`;

  const savedTs = _lastNotifTs || (await _idbGet('lastNotifTs')) || 0;
  const savedId = _lastNotifId || (await _idbGet('lastNotifId')) || null;

  _swLog('info', 'SHOW', 'Evaluando notificación:', { id, ts, savedTs, savedId });

  // Bloquear solo si el ID es exactamente el mismo (misma notificación ya mostrada)
  if (id && id === savedId) {
    _swLog('info', 'SHOW', 'Mismo ID — notificación ya mostrada, ignorando');
    return;
  }

  _lastNotifTs = ts;
  _lastNotifId = id;
  await _idbSet('lastNotifTs', ts);
  await _idbSet('lastNotifId', id);
  _swLog('info', 'SHOW', 'Anti-duplicado actualizado');

  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const appVisible = allClients.some(c => c.visibilityState === 'visible');
  _swLog('info', 'SHOW', `Clientes abiertos: ${allClients.length}, app visible: ${appVisible}`);

  if (appVisible) {
    _swLog('info', 'SHOW', 'App en primer plano → enviando mensaje al cliente');
    allClients.forEach(c => c.postMessage({ type: 'NEW_PUSH_NOTIF', payload }));
    return;
  }

  _swLog('info', 'SHOW', 'App en background → mostrando notificación nativa del SO');
  const { title, body, url } = _formatNotif(payload);
  _swLog('info', 'SHOW', 'Notificación formateada:', { title, body, url });

  await self.registration.showNotification(title, {
    body,
    icon:     './icons/TDM_variable_colors.svg',
    badge:    './icons/TDM_variable_colors.svg',
    tag:      `sispro-${id}`,
    renotify: true,
    vibrate:  [200, 100, 200],
    data:     { url, id, ts, notifType: payload.notifType || 'estado' }
  });

  _swLog('info', 'SHOW', 'Notificación nativa mostrada:', title);
}

/* ══════════════════════════════════════════════════════════════════════════
   CLICK EN NOTIFICACIÓN
   ══════════════════════════════════════════════════════════════════════════ */
self.addEventListener('notificationclick', event => {
  _swLog('info', 'CLICK', 'Click en notificación:', event.notification.data);
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        for (const c of clients) {
          if (c.url.includes(target.replace('./', '')) && 'focus' in c) return c.focus();
        }
        for (const c of clients) {
          if ('navigate' in c) return c.navigate(target).then(wc => wc && wc.focus());
          if ('focus' in c)    return c.focus();
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

console.log('[SW] Cargado —', SW_VERSION, '— Sin cache, solo push y polling');
