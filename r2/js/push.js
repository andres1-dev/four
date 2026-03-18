/* ==========================================================================
   push.js — PWA Push Notifications SISPRO v2
   ========================================================================== */

const NOTIF_GAS_URL    = 'https://script.google.com/macros/s/AKfycbzPkZzYLgMuqWzUZtcZ9MqEsliJFbjplxwB7wN98SDHF4mIHMFKYCkZUhFtMOIdTahh/exec';
const PUSH_STORAGE_KEY = 'sispro_push_subscribed';

let _swRegistration          = null;
let _vapidPublicKey          = null;
let _pushPermissionRequested = false;

/* ── Logger centralizado ── */
function _log(level, step, msg, data) {
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `[PUSH][${ts}][${step}]`;
  if (level === 'error') {
    console.error(prefix, msg, data !== undefined ? data : '');
  } else if (level === 'warn') {
    console.warn(prefix, msg, data !== undefined ? data : '');
  } else {
    console.log(prefix, msg, data !== undefined ? data : '');
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Llamar al GAS de notificaciones
   ══════════════════════════════════════════════════════════════════════════ */
async function _callNotifAPI(action, method = 'GET', data = null) {
  _log('info', 'API', `→ ${method} action=${action}`);
  try {
    if (method === 'GET') {
      const url = `${NOTIF_GAS_URL}?action=${action}&_t=${Date.now()}`;
      _log('info', 'API', 'GET url:', url);
      const res  = await fetch(url, { mode: 'cors' });
      _log('info', 'API', `GET status: ${res.status}`);
      const text = await res.text();
      _log('info', 'API', 'GET respuesta raw:', text.substring(0, 200));
      try { return JSON.parse(text); } catch (_) { return text; }
    }

    const form = new URLSearchParams();
    form.append('action', action);
    if (data) {
      form.append('data', JSON.stringify(data));
      if (data.endpoint)        form.append('endpoint', data.endpoint);
      if (data.keys?.p256dh)    form.append('p256dh',   data.keys.p256dh);
      if (data.keys?.auth)      form.append('auth',     data.keys.auth);
      if (data.title)           form.append('title',    data.title);
      if (data.body)            form.append('body',     data.body);
      if (data.icon  != null)   form.append('icon',     data.icon);
      if (data.url)             form.append('url',      data.url);
    }
    _log('info', 'API', 'POST payload:', Object.fromEntries(form));
    const res  = await fetch(NOTIF_GAS_URL, {
      method: 'POST', mode: 'cors', body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    _log('info', 'API', `POST status: ${res.status}`);
    const text = await res.text();
    _log('info', 'API', 'POST respuesta raw:', text.substring(0, 200));
    try { return JSON.parse(text); } catch (_) { return text; }
  } catch (e) {
    _log('error', 'API', 'Error llamando GAS:', e.message);
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Registro del Service Worker
   ══════════════════════════════════════════════════════════════════════════ */
async function registerServiceWorker() {
  _log('info', 'SW-REGISTER', 'Iniciando registro del SW...');

  if (!('serviceWorker' in navigator)) {
    _log('error', 'SW-REGISTER', 'serviceWorker NO soportado en este navegador');
    return;
  }
  if (!('PushManager' in window)) {
    _log('error', 'SW-REGISTER', 'PushManager NO soportado — push no disponible');
    return;
  }

  _log('info', 'SW-REGISTER', 'Soporte OK — registrando sw.js...');

  try {
    _swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    _log('info', 'SW-REGISTER', 'SW registrado, scope:', _swRegistration.scope);
    _log('info', 'SW-REGISTER', 'Estado SW:', {
      installing: !!_swRegistration.installing,
      waiting:    !!_swRegistration.waiting,
      active:     !!_swRegistration.active
    });

    _swRegistration = await navigator.serviceWorker.ready;
    _log('info', 'SW-REGISTER', 'SW activo y listo');

    _sendPollingConfigToSW();
    _resendConfigWhenReady(); // reenviar cuando API key esté disponible

    navigator.serviceWorker.addEventListener('message', _onSwMessage);
    _log('info', 'SW-REGISTER', 'Listener de mensajes SW registrado');

    _registerPeriodicSync(_swRegistration);

    _log('info', 'SW-REGISTER', 'Permiso de notificaciones actual:', Notification.permission);
    if (Notification.permission === 'granted') {
      _log('info', 'SW-REGISTER', 'Permiso ya concedido → suscribiendo...');
      await _subscribeToPush();
    }
  } catch (e) {
    _log('error', 'SW-REGISTER', 'Error registrando SW:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Enviar config de polling al SW
   ══════════════════════════════════════════════════════════════════════════ */
function _sendPollingConfigToSW() {
  if (!_swRegistration?.active) {
    _log('warn', 'SW-CONFIG', 'SW no activo aún, no se puede enviar config');
    return;
  }
  const lastTs = parseInt(localStorage.getItem('sispro_last_push_ts') || '0');
  const userId = (typeof currentUser !== 'undefined')
    ? (currentUser?.ID_PLANTA || currentUser?.ID_USUARIO || 'anonimo')
    : 'anonimo';

  // Incluir config de Sheets para que el SW pueda consultar chat directamente
  const sheetsId  = (typeof CONFIG !== 'undefined') ? CONFIG.SPREADSHEET_ID : null;
  const sheetsKey = (typeof CONFIG !== 'undefined') ? CONFIG.API_KEY : null;

  _log('info', 'SW-CONFIG', 'Enviando config al SW:', { url: NOTIF_GAS_URL, userId, lastTs, sheetsId: !!sheetsId, sheetsKey: !!sheetsKey });
  _swRegistration.active.postMessage({
    type:      'SET_POLLING_CONFIG',
    url:       NOTIF_GAS_URL,
    userId,
    lastTs,
    sheetsId:  sheetsId  || null,
    sheetsKey: sheetsKey || null
  });
  _log('info', 'SW-CONFIG', 'Config enviada OK');
}

/* Reenviar config al SW cuando la API key esté disponible (carga async) */
function _resendConfigWhenReady() {
  if (!_swRegistration) return;
  const sheetsKey = (typeof CONFIG !== 'undefined') ? CONFIG.API_KEY : null;
  if (sheetsKey) {
    _log('info', 'SW-CONFIG', 'API key disponible → reenviando config al SW');
    _sendPollingConfigToSW();
    return;
  }
  // Reintentar hasta 10s
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    const key = (typeof CONFIG !== 'undefined') ? CONFIG.API_KEY : null;
    if (key || attempts >= 20) {
      clearInterval(interval);
      if (key) {
        _log('info', 'SW-CONFIG', 'API key lista tras espera → reenviando config');
        _sendPollingConfigToSW();
      }
    }
  }, 500);
}

/* ══════════════════════════════════════════════════════════════════════════
   Solicitar permiso + suscribir
   ══════════════════════════════════════════════════════════════════════════ */
async function _requestPushPermission() {
  _log('info', 'PERMISSION', 'Solicitando permiso push...');

  if (!('Notification' in window)) {
    _log('error', 'PERMISSION', 'Notification API no disponible');
    return 'unavailable';
  }
  if (!('PushManager' in window)) {
    _log('error', 'PERMISSION', 'PushManager no disponible');
    return 'unavailable';
  }

  const currentPerm = Notification.permission;
  _log('info', 'PERMISSION', 'Estado actual:', currentPerm);

  if (currentPerm === 'denied') {
    _log('warn', 'PERMISSION', 'Permiso DENEGADO por el usuario');
    return 'denied';
  }

  if (currentPerm === 'granted') {
    _log('info', 'PERMISSION', 'Permiso ya concedido → suscribiendo');
    await _subscribeToPush();
    if (typeof _syncNotifToggleUI === 'function') _syncNotifToggleUI('granted');
    return 'granted';
  }

  if (_pushPermissionRequested) {
    _log('warn', 'PERMISSION', 'Ya se solicitó permiso antes, evitando doble solicitud');
    return currentPerm;
  }
  _pushPermissionRequested = true;

  try {
    _log('info', 'PERMISSION', 'Mostrando diálogo de permiso al usuario...');
    const result = await Notification.requestPermission();
    _log('info', 'PERMISSION', 'Resultado del diálogo:', result);

    if (result === 'granted') {
      _log('info', 'PERMISSION', 'Permiso CONCEDIDO → suscribiendo');
      await _subscribeToPush();
    } else {
      _log('warn', 'PERMISSION', 'Permiso NO concedido:', result);
      _pushPermissionRequested = false;
    }
    return result;
  } catch (e) {
    _log('error', 'PERMISSION', 'Error solicitando permiso:', e.message);
    _pushPermissionRequested = false;
    return 'default';
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Notificación local de prueba — funciona en PC, Android e iOS
   ══════════════════════════════════════════════════════════════════════════ */
function _showLocalTestNotif() {
  _log('info', 'TEST-NOTIF', 'Mostrando notificación de prueba...');

  const title = '¡SISPRO activado!';
  const opts  = {
    body:    'Las notificaciones push están funcionando correctamente.',
    icon:    './icons/TDM_variable_colors.svg',
    badge:   './icons/TDM_variable_colors.svg',
    vibrate: [100, 50, 100],
    tag:     'sispro-test'
  };

  if (Notification.permission !== 'granted') {
    _log('warn', 'TEST-NOTIF', 'Permiso no concedido, no se puede mostrar');
    return;
  }

  // Preferir SW (requerido en iOS Safari y para vibración en Android)
  if (_swRegistration) {
    _swRegistration.showNotification(title, opts);
    _log('info', 'TEST-NOTIF', 'Notificación enviada via SW');
    return;
  }

  // Fallback: Notification API directa (PC / Chrome sin SW listo aún)
  try {
    new Notification(title, opts);
    _log('info', 'TEST-NOTIF', 'Notificación enviada via Notification API directa');
  } catch(e) {
    _log('warn', 'TEST-NOTIF', 'Fallback Notification API falló:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Obtener VAPID public key desde GAS
   ══════════════════════════════════════════════════════════════════════════ */
async function _fetchVapidKey() {
  _log('info', 'VAPID', 'Obteniendo VAPID key desde GAS...');
  try {
    const text = await _callNotifAPI('vapid-public-key', 'GET');
    _log('info', 'VAPID', 'Respuesta VAPID:', typeof text === 'string' ? text.substring(0, 60) : text);
    if (typeof text === 'string' && text.length > 20 && !text.startsWith('{')) {
      _vapidPublicKey = text.trim();
      _log('info', 'VAPID', 'VAPID key válida obtenida, longitud:', _vapidPublicKey.length);
      return true;
    }
    _log('error', 'VAPID', 'VAPID key inválida o vacía:', text);
    return false;
  } catch (e) {
    _log('error', 'VAPID', 'Error obteniendo VAPID key:', e.message);
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Suscribir al usuario a Push via VAPID
   ══════════════════════════════════════════════════════════════════════════ */
async function _subscribeToPush() {
  _log('info', 'SUBSCRIBE', 'Iniciando suscripción push...');

  if (!_swRegistration) {
    _log('error', 'SUBSCRIBE', 'SW no registrado, no se puede suscribir');
    return;
  }

  try {
    let sub = await _swRegistration.pushManager.getSubscription();
    if (sub) {
      _log('info', 'SUBSCRIBE', 'Suscripción existente encontrada:', sub.endpoint.substring(0, 60) + '...');
      _log('info', 'SUBSCRIBE', 'Re-enviando suscripción al servidor...');
      await _saveSubscriptionToGAS(sub);
      return;
    }

    _log('info', 'SUBSCRIBE', 'Sin suscripción previa, creando nueva...');

    if (!_vapidPublicKey) {
      _log('info', 'SUBSCRIBE', 'Sin VAPID key en memoria, obteniendo...');
      const ok = await _fetchVapidKey();
      if (!ok) {
        _log('error', 'SUBSCRIBE', 'No se pudo obtener VAPID key — suscripción abortada');
        return;
      }
    }

    _log('info', 'SUBSCRIBE', 'Llamando pushManager.subscribe()...');
    sub = await _swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(_vapidPublicKey)
    });

    _log('info', 'SUBSCRIBE', 'Suscripción creada exitosamente');
    _log('info', 'SUBSCRIBE', 'Endpoint:', sub.endpoint.substring(0, 80) + '...');
    localStorage.setItem(PUSH_STORAGE_KEY, '1');
    await _saveSubscriptionToGAS(sub);
  } catch (e) {
    _log('error', 'SUBSCRIBE', 'Error al suscribir:', e.message);
    _log('error', 'SUBSCRIBE', 'Error completo:', e);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Guardar suscripción en GAS
   ══════════════════════════════════════════════════════════════════════════ */
async function _saveSubscriptionToGAS(subscription) {
  _log('info', 'SAVE-SUB', 'Guardando suscripción en GAS...');
  const subJSON = subscription.toJSON();
  _log('info', 'SAVE-SUB', 'Datos a enviar:', {
    endpoint: subJSON.endpoint?.substring(0, 60) + '...',
    p256dh:   subJSON.keys?.p256dh?.substring(0, 20) + '...',
    auth:     subJSON.keys?.auth
  });
  const result = await _callNotifAPI('subscribe', 'POST', subJSON);
  if (result?.success) {
    _log('info', 'SAVE-SUB', 'Suscripción guardada en GAS OK:', result.message);
  } else {
    _log('error', 'SAVE-SUB', 'Error guardando en GAS, respuesta:', result);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Mensajes del SW → actualizar campana en tiempo real
   ══════════════════════════════════════════════════════════════════════════ */
function _onSwMessage(event) {
  _log('info', 'SW-MSG', 'Mensaje recibido del SW:', event.data);
  const { type, payload } = event.data || {};

  if (type !== 'NEW_PUSH_NOTIF' || !payload) {
    _log('warn', 'SW-MSG', 'Mensaje ignorado — tipo desconocido o sin payload:', type);
    return;
  }

  _log('info', 'SW-MSG', 'Nueva notificación push recibida:', {
    title:         payload.title,
    notifType:     payload.notifType,
    idNovedad:     payload.idNovedad,
    lote:          payload.lote,
    estadoActual:  payload.estadoActual,
    timestamp:     payload.timestamp
  });

  if (payload.timestamp) {
    localStorage.setItem('sispro_last_push_ts', String(payload.timestamp));
    _log('info', 'SW-MSG', 'Timestamp guardado:', payload.timestamp);
  }

  const notifType = payload.notifType || 'estado';

  if (notifType === 'chat') {
    if (typeof _addOperatorChatNotif === 'function') {
      _log('info', 'SW-MSG', 'Procesando como notificación de CHAT');
      _addOperatorChatNotif(
        payload.idNovedad,
        { mensaje: payload.body, ts: payload.timestamp },
        payload.lote,
        payload.planta
      );
    } else {
      _log('warn', 'SW-MSG', '_addOperatorChatNotif no disponible');
    }
  } else if (notifType === 'estado') {
    if (typeof _addNotifications === 'function') {
      _log('info', 'SW-MSG', 'Procesando como notificación de ESTADO');
      _addNotifications([{
        nov: {
          ID_NOVEDAD:  payload.idNovedad || '',
          LOTE:        payload.lote      || '',
          PLANTA:      payload.planta    || '',
          DESCRIPCION: payload.body      || ''
        },
        estadoAnterior: payload.estadoAnterior || 'PENDIENTE',
        estadoActual:   payload.estadoActual   || 'ELABORACION'
      }]);
    } else {
      _log('warn', 'SW-MSG', '_addNotifications no disponible');
    }
  } else {
    _log('warn', 'SW-MSG', 'notifType desconocido:', notifType);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Periodic Sync
   ══════════════════════════════════════════════════════════════════════════ */
async function _registerPeriodicSync(reg) {
  if (!('periodicSync' in reg)) {
    _log('info', 'PERIODIC-SYNC', 'No soportado en este navegador');
    return;
  }
  try {
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    _log('info', 'PERIODIC-SYNC', 'Permiso periodic-background-sync:', status.state);
    if (status.state === 'granted') {
      await reg.periodicSync.register('sispro-check', { minInterval: 60 * 60 * 1000 });
      _log('info', 'PERIODIC-SYNC', 'Periodic sync registrado OK');
    }
  } catch (e) {
    _log('warn', 'PERIODIC-SYNC', 'Error:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Utilidad: base64url → Uint8Array
   ══════════════════════════════════════════════════════════════════════════ */
function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/* ══════════════════════════════════════════════════════════════════════════
   Init automático al cargar
   ══════════════════════════════════════════════════════════════════════════ */
(function initPush() {
  _log('info', 'INIT', 'push.js cargado — iniciando...');
  _log('info', 'INIT', 'User Agent:', navigator.userAgent);
  _log('info', 'INIT', 'Soporte SW:', 'serviceWorker' in navigator);
  _log('info', 'INIT', 'Soporte Push:', 'PushManager' in window);
  _log('info', 'INIT', 'Soporte Notification:', 'Notification' in window);
  _log('info', 'INIT', 'Permiso actual:', typeof Notification !== 'undefined' ? Notification.permission : 'N/A');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerServiceWorker);
  } else {
    registerServiceWorker();
  }
})();
