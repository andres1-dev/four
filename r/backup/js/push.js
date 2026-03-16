/* ==========================================================================
   push.js — PWA Push Notifications SISPRO v1
   - Registra el Service Worker
   - Solicita permiso al primer clic en la campana
   - Suscribe al usuario via VAPID
   - Escucha mensajes NEW_PUSH_NOTIF del SW → actualiza campana en tiempo real
   ========================================================================== */

/* URL del GAS de notificaciones (codeNotifications.gs) — ajustar tras deploy */
const NOTIF_GAS_URL = 'https://script.google.com/macros/s/AKfycbxPLACEHOLDER_REPLACE_WITH_REAL_URL/exec';

const PUSH_STORAGE_KEY = 'sispro_push_subscribed';

let _swRegistration = null;
let _pushPermissionRequested = false;

/* ══════════════════════════════════════════════════════════════════════════
   Registro del Service Worker
   ══════════════════════════════════════════════════════════════════════════ */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    _swRegistration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    console.log('[PUSH] SW registrado:', _swRegistration.scope);

    // Enviar config al SW para que pueda hacer polling background
    _sendConfigToSW();

    // Escuchar mensajes del SW (notificaciones cuando la app está visible)
    navigator.serviceWorker.addEventListener('message', _onSwMessage);

    // Intentar periodic sync (Chrome Android)
    _registerPeriodicSync(_swRegistration);
  } catch (e) {
    console.warn('[PUSH] Error registrando SW:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Enviar configuración al SW
   ══════════════════════════════════════════════════════════════════════════ */
function _sendConfigToSW() {
  if (!_swRegistration || !_swRegistration.active) return;
  const lastTs = parseInt(localStorage.getItem('sispro_last_push_ts') || '0');
  _swRegistration.active.postMessage({
    type: 'SET_CONFIG',
    gasUrl: NOTIF_GAS_URL,
    lastTs
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Solicitar permiso + suscribir (llamado al primer clic en campana)
   ══════════════════════════════════════════════════════════════════════════ */
async function _requestPushPermission() {
  if (_pushPermissionRequested) return;
  if (!('Notification' in window) || !('PushManager' in window)) return;
  if (Notification.permission === 'denied') return;
  if (Notification.permission === 'granted') {
    // Ya tiene permiso — solo asegurar suscripción
    await _ensurePushSubscription();
    return;
  }
  // permission === 'default' → pedir
  _pushPermissionRequested = true;
  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      console.log('[PUSH] Permiso concedido');
      await _ensurePushSubscription();
    } else {
      console.log('[PUSH] Permiso denegado o ignorado');
    }
  } catch (e) {
    console.warn('[PUSH] Error solicitando permiso:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Suscribir al usuario a Push
   ══════════════════════════════════════════════════════════════════════════ */
async function _ensurePushSubscription() {
  if (!_swRegistration) return;
  try {
    // Verificar si ya hay suscripción activa
    let sub = await _swRegistration.pushManager.getSubscription();
    if (sub) {
      console.log('[PUSH] Ya suscrito');
      _sendSubscriptionToGAS(sub);
      return;
    }
    // Obtener VAPID public key desde GAS
    const vapidKey = await _fetchVapidPublicKey();
    if (!vapidKey) { console.warn('[PUSH] Sin VAPID key'); return; }

    sub = await _swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlBase64ToUint8Array(vapidKey)
    });
    console.log('[PUSH] Suscripción creada');
    localStorage.setItem(PUSH_STORAGE_KEY, '1');
    _sendSubscriptionToGAS(sub);
  } catch (e) {
    console.warn('[PUSH] Error suscribiendo:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Obtener VAPID public key desde GAS
   ══════════════════════════════════════════════════════════════════════════ */
async function _fetchVapidPublicKey() {
  try {
    const res = await fetch(`${NOTIF_GAS_URL}?action=vapid-public-key&_t=${Date.now()}`);
    const text = await res.text();
    return text.trim();
  } catch (e) {
    console.warn('[PUSH] Error obteniendo VAPID key:', e.message);
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Enviar suscripción al GAS para guardarla
   ══════════════════════════════════════════════════════════════════════════ */
async function _sendSubscriptionToGAS(subscription) {
  try {
    await fetch(NOTIF_GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'subscribe', ...subscription.toJSON() })
    });
    console.log('[PUSH] Suscripción enviada al servidor');
  } catch (e) {
    console.warn('[PUSH] Error enviando suscripción:', e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Mensajes del SW → actualizar campana en tiempo real
   ══════════════════════════════════════════════════════════════════════════ */
function _onSwMessage(event) {
  const { type, payload } = event.data || {};
  if (type !== 'NEW_PUSH_NOTIF' || !payload) return;

  console.log('[PUSH] Notificación recibida del SW:', payload.title);

  // Guardar ts para anti-duplicados
  if (payload.timestamp) {
    localStorage.setItem('sispro_last_push_ts', String(payload.timestamp));
  }

  // Determinar tipo de notificación y enrutar al módulo correcto
  const notifType = payload.notifType || 'estado'; // 'estado' | 'chat'

  if (notifType === 'chat' && typeof _addOperatorChatNotif === 'function') {
    // Notificación de chat para operadores (USER-P / ADMIN)
    _addOperatorChatNotif({
      idNovedad: payload.idNovedad,
      lote:      payload.lote,
      planta:    payload.planta,
      msg:       { mensaje: payload.body, ts: payload.timestamp }
    });
  } else if (notifType === 'estado' && typeof _addNotifications === 'function') {
    // Notificación de cambio de estado para GUEST
    // Construir objeto compatible con _addNotifications
    const fakeItem = {
      nov: {
        ID_NOVEDAD:  payload.idNovedad || '',
        LOTE:        payload.lote      || '',
        PLANTA:      payload.planta    || '',
        DESCRIPCION: payload.body      || ''
      },
      estadoAnterior: payload.estadoAnterior || 'PENDIENTE',
      estadoActual:   payload.estadoActual   || 'ELABORACION'
    };
    _addNotifications([fakeItem]);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Periodic Sync (Chrome Android — background check cada ~1h)
   ══════════════════════════════════════════════════════════════════════════ */
async function _registerPeriodicSync(reg) {
  if (!('periodicSync' in reg)) return;
  try {
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state === 'granted') {
      await reg.periodicSync.register('sispro-check', { minInterval: 60 * 60 * 1000 });
      console.log('[PUSH] Periodic sync registrado');
    }
  } catch (_) {}
}

/* ══════════════════════════════════════════════════════════════════════════
   Utilidad: base64url → Uint8Array (para applicationServerKey)
   ══════════════════════════════════════════════════════════════════════════ */
function _urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/* ══════════════════════════════════════════════════════════════════════════
   Init — se llama automáticamente al cargar la página
   ══════════════════════════════════════════════════════════════════════════ */
(function initPush() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerServiceWorker);
  } else {
    registerServiceWorker();
  }
})();
