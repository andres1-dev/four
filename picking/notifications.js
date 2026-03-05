// ============================================
// NotificationManager — GAS r1 (VAPID/JWT)
// Usa el MISMO patrón de fetch que llamarAPI()
// en documents-table.js (query params + POST vacío)
// ============================================
class NotificationManager {
    constructor() {
        this.swRegistration = null;
        this.isSubscribed = false;
        this.vapidPublicKey = null;
        this.lastNotificationTimestamp = 0;

        this.notifApiUrl = (typeof API_URL_NOTIF !== 'undefined')
            ? API_URL_NOTIF
            : 'https://script.google.com/macros/s/AKfycbyDTzMkBog7uq3o_0yAuD_WVHOtLQNgBYMzxgdrr9QlLFTKJOk_8mJJlaXMqkixEnm05A/exec';

        console.log('🔔 NotificationManager iniciado');
        this.setupUI();
        this.init();
    }

    // ============================================
    // LLAMAR AL GAS — MISMO PATRÓN QUE llamarAPI()
    // Datos en query string + POST sin body + redirect:follow
    // ============================================
    async callGAS(params) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const url = `${this.notifApiUrl}?${queryString}`;
            console.log('📤 callGAS:', params);

            const response = await fetch(url, {
                method: 'POST',
                redirect: 'follow'
            });

            const text = await response.text();
            console.log('📥 callGAS respuesta:', text.substring(0, 200));

            try {
                return JSON.parse(text);
            } catch (e) {
                if (text.toLowerCase().includes('success')) return { success: true };
                return { success: false, raw: text };
            }
        } catch (error) {
            console.error('❌ callGAS error:', error);
            return { success: false, error: error.message };
        }
    }

    // ============================================
    // INIT
    // ============================================
    async init() {
        console.log('🔔 init()...');

        if (!('serviceWorker' in navigator)) { console.warn('❌ SW no soportado'); this.updateUIForState('unsupported'); return; }
        if (!('Notification' in window)) { console.warn('❌ Notification no soportada'); this.updateUIForState('unsupported'); return; }
        if (!('PushManager' in window)) { console.warn('❌ PushManager no soportado'); this.updateUIForState('unsupported'); return; }

        try {
            this.swRegistration = await navigator.serviceWorker.ready;
            console.log('✅ SW listo');

            const permission = Notification.permission;
            console.log('📊 Permiso:', permission);
            this.updateUIForState(permission);
            this.sendPollingConfigToSW();

            if (permission === 'granted') {
                await this.subscribeToPush();
            }
        } catch (e) {
            console.error('❌ init error:', e);
        }
    }

    // ============================================
    // UI
    // ============================================
    setupUI() {
        const notifToggles = [document.getElementById('notifToggle'), document.getElementById('notifToggleMobile')];
        const summaryBtns = [document.getElementById('sendSummaryBtn'), document.getElementById('sendSummaryBtnMobile')];

        notifToggles.forEach(toggle => {
            if (toggle) {
                toggle.onchange = () => {
                    if (toggle.checked) {
                        this.requestPermission(true);
                    } else {
                        alert('Para desactivar notificaciones, quítalas desde la configuración del sitio.');
                        this.updateUIForState(Notification.permission);
                    }
                };
            }
        });

        summaryBtns.forEach(btn => {
            if (btn) btn.onclick = (e) => { e.preventDefault(); this.sendDailySummary(); };
        });

        setTimeout(() => this.applyRolePermissions(), 1000);
    }

    applyRolePermissions() {
        const adminNotifSection = document.getElementById('adminNotifSection');
        if (adminNotifSection) adminNotifSection.style.display = 'none';
    }

    updateUIForState(state) {
        const toggles = [document.getElementById('notifToggle'), document.getElementById('notifToggleMobile')];
        const descs = [document.getElementById('notifDesc'), document.getElementById('notifDescMobile')];
        toggles.forEach(t => { if (t) t.checked = (state === 'granted'); });
        const label = state === 'granted' ? 'Estado: Activo' : (state === 'denied' ? 'Estado: Bloqueado' : 'Estado: Desactivado');
        descs.forEach(d => { if (d) d.innerText = label; });
    }

    // ============================================
    // PEDIR PERMISO
    // Sin bloqueo de iOS en PC (verifica touch real)
    // ============================================
    async requestPermission(isManual = false) {
        // Solo bloquear en iOS REAL con touch, no en simulación de PC
        const isRealIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
            && !window.MSStream
            && ('ontouchstart' in window)
            && (navigator.maxTouchPoints > 0);
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        if (isRealIOS && !isStandalone) {
            alert('Para notificaciones en iOS:\n1. Pulsa "Compartir" en Safari.\n2. "Añadir a pantalla de inicio".\n3. Abre la app desde ese icono.');
            this.updateUIForState('denied');
            return false;
        }

        try {
            console.log('🔔 Solicitando permisos...');
            const permission = await new Promise((resolve, reject) => {
                const res = Notification.requestPermission(resolve);
                if (res) res.then(resolve).catch(reject);
            });

            console.log('🔔 Resultado permiso:', permission);
            this.updateUIForState(permission);

            if (permission === 'granted') {
                if (isManual && typeof Swal !== 'undefined') {
                    Swal.fire({ title: '¡Permisos Concedidos!', text: 'Registrando dispositivo...', icon: 'success', timer: 2500, showConfirmButton: false });
                }
                await this.subscribeToPush();
            } else if (permission === 'denied') {
                alert('Notificaciones bloqueadas. Habilítalas en ajustes del navegador.');
            }
            return permission === 'granted';
        } catch (e) {
            console.error('Error permiso:', e);
            alert('Error: ' + e.message);
        }
        return false;
    }

    // ============================================
    // VAPID KEY — GET vía callGAS
    // ============================================
    async fetchVapidKey() {
        try {
            console.log('🔑 Obteniendo VAPID key...');
            // GET simple con redirect:follow (igual que callGAS pero GET)
            const res = await fetch(this.notifApiUrl + '?action=vapid-public-key', { redirect: 'follow' });
            const text = (await res.text()).trim();
            console.log('🔑 VAPID respuesta:', text.substring(0, 60));

            if (text.startsWith('{')) {
                const obj = JSON.parse(text);
                if (obj.error) { console.error('❌ VAPID error:', obj.error); return false; }
            }
            if (text.length > 20 && !text.startsWith('<')) {
                this.vapidPublicKey = text;
                console.log('✅ VAPID key OK');
                return true;
            }
            console.error('❌ VAPID inválida');
            return false;
        } catch (err) {
            console.error('❌ VAPID fetch error:', err);
            return false;
        }
    }

    // ============================================
    // SUSCRIBIR A PUSH + GUARDAR EN SHEETS
    // Usa callGAS (datos en query string, POST vacío)
    // ============================================
    async subscribeToPush() {
        if (!this.swRegistration) { console.warn('❌ Sin SW'); return; }

        try {
            // 1. Obtener VAPID key
            if (!this.vapidPublicKey) {
                const ok = await this.fetchVapidKey();
                if (!ok) { alert('No se pudo obtener la clave VAPID.'); return; }
            }

            // 2. Suscribir al PushManager
            console.log('📱 Suscribiendo al PushManager...');
            const appKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: appKey
            });
            this.isSubscribed = true;
            console.log('✅ Push subscription obtenida');

            const sub = subscription.toJSON();
            console.log('📱 Endpoint:', sub.endpoint.substring(0, 80) + '...');
            console.log('📱 p256dh:', sub.keys.p256dh ? 'OK (' + sub.keys.p256dh.length + ' chars)' : 'VACÍO');
            console.log('📱 auth:', sub.keys.auth ? 'OK' : 'VACÍO');

            // 3. Guardar en Sheets via callGAS
            // MISMO PATRÓN que llamarAPI(): datos en query string + POST sin body
            console.log('💾 Guardando suscripción en Sheets...');
            const result = await this.callGAS({
                action: 'subscribe',
                endpoint: sub.endpoint,
                p256dh: sub.keys.p256dh || '',
                auth: sub.keys.auth || ''
            });

            console.log('💾 Resultado guardar:', result);
            if (result && result.success) {
                console.log('✅✅✅ ¡Suscripción GUARDADA en Sheets!', result.message);
                if (typeof Swal !== 'undefined') {
                    Swal.fire({ title: '✅ Registrado', text: result.message || 'Dispositivo registrado.', icon: 'success', timer: 2500, showConfirmButton: false });
                }
            } else {
                console.error('❌ Error al guardar suscripción:', result);
                alert('No se pudo registrar: ' + (result.message || result.error || JSON.stringify(result)));
            }

        } catch (e) {
            console.error('❌ subscribeToPush error:', e);
            alert('Error al suscribir: ' + e.message + '\n\nAsegúrate de usar HTTPS.');
        }
    }

    // ============================================
    // Polling → SW
    // ============================================
    sendPollingConfigToSW() {
        const userId = window.currentUser ? window.currentUser.id : 'anonimo';
        if (this.swRegistration && this.swRegistration.active) {
            this.swRegistration.active.postMessage({
                type: 'SET_POLLING_CONFIG',
                url: this.notifApiUrl,
                userId: userId,
                lastTs: this.lastNotificationTimestamp
            });
            console.log('🔔 Polling configurado');
        }
    }

    // ============================================
    // Test local
    // ============================================
    sendTestNotification(msg = 'Prueba de notificación local') {
        if (Notification.permission === 'granted' && this.swRegistration) {
            this.swRegistration.showNotification('Separación', {
                body: msg, icon: './icons/icon-192.png', badge: './icons/icon-192.png',
                vibrate: [100, 50, 100], tag: 'test-' + Date.now()
            });
        } else {
            this.requestPermission(false);
        }
    }

    // ============================================
    // Notificar asignación de lote (push a todos)
    // ============================================
    async notifyNewLotAssignment(lote, responsable) {
        console.log(`🔔 Notificando lote [${lote}] → [${responsable}]`);
        return this.callGAS({
            action: 'send-notification',
            title: 'Nuevo Lote Asignado: ' + lote,
            body: 'Lote ' + lote + ' asignado a ' + (responsable || 'Sin asignar') + '.'
        });
    }

    // ============================================
    // Notificar cambio de estado (para pruebas)
    // ============================================
    async notifyStatusChange(rec, status) {
        console.log(`🔔 Notificando estado: REC${rec} → ${status}`);
        const doc = (window.documentosGlobales || []).find(d => d.rec === rec);
        const loteInfo = doc && doc.lote ? ' (Lote: ' + doc.lote + ')' : '';
        return this.callGAS({
            action: 'send-notification',
            title: 'Documento ' + status + ': REC' + rec + loteInfo,
            body: 'REC' + rec + ' cambió a ' + status + '.'
        });
    }

    // ============================================
    // REPORTE DIARIO
    // ============================================
    async sendDailySummary(targetDateStr = null) {
        const btn = document.getElementById('sendSummaryBtn');
        const btnMobile = document.getElementById('sendSummaryBtnMobile');
        const activeBtn = (btn && btn.offsetParent) ? btn : btnMobile;
        const originalHtml = activeBtn ? activeBtn.innerHTML : '';

        if (!confirm('¿Enviar resumen de entregas?')) return;

        try {
            if (activeBtn) { activeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; activeBtn.disabled = true; }

            let rawData = window.datosTablaDocumentos || [];
            if (rawData.length === 0 && typeof window.cargarTablaDocumentos === 'function') {
                await window.cargarTablaDocumentos();
                rawData = window.datosTablaDocumentos || [];
            }
            if (rawData.length === 0) throw new Error('No hay datos.');

            const infoMap = {};
            if (window.datosGlobales) window.datosGlobales.forEach(i => { if (i.REC) infoMap[i.REC] = i; });

            const parseDate = (s) => {
                if (!s) return null;
                const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
            };

            const deliveries = [];
            rawData.forEach(row => {
                if (String(row[3] || '').trim().toUpperCase() !== 'FINALIZADO') return;
                const d = parseDate(row[1] || '');
                if (!d) return;
                const info = infoMap[String(row[0] || '').trim()] || {};
                deliveries.push({
                    dateVal: d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(),
                    dateStr: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`,
                    unidades: info.CANTIDAD || 0
                });
            });

            if (!deliveries.length) { alert('No hay documentos finalizados.'); return; }

            let bestVal = 0, bestStr = '';
            deliveries.forEach(d => { if (d.dateVal > bestVal) { bestVal = d.dateVal; bestStr = d.dateStr; } });

            const dayDelvs = deliveries.filter(d => d.dateVal === bestVal);
            let totalUnd = 0;
            dayDelvs.forEach(d => totalUnd += d.unidades);

            const result = await this.callGAS({
                action: 'send-notification',
                title: 'Resumen Entregas - ' + bestStr,
                body: dayDelvs.length + ' docs, ' + totalUnd + ' unidades.'
            });

            if (result && result.success) {
                alert('✅ Reporte enviado.\n' + bestStr + ': ' + dayDelvs.length + ' docs, ' + totalUnd + ' und.');
            } else {
                alert('Error: ' + (result.message || result.error || 'Respuesta inválida'));
            }
        } catch (e) {
            console.error('❌ Reporte error:', e);
            alert('Error: ' + e.message);
        } finally {
            if (activeBtn) { activeBtn.innerHTML = originalHtml; activeBtn.disabled = false; }
        }
    }

    // ============================================
    // Utilidad
    // ============================================
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
    }
}

// Inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.notificationManager = new NotificationManager(); });
} else {
    window.notificationManager = new NotificationManager();
}