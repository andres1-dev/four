// ============================================
// NotificationManager — Adaptado para usar GAS r1 (VAPID/JWT)
// ============================================
class NotificationManager {
    constructor() {
        this.swRegistration = null;
        this.isSubscribed = false;
        this.vapidPublicKey = null; // Se obtiene dinámicamente de r1
        this.lastNotificationTimestamp = 0;

        // URL del GAS de notificaciones r1
        this.notifApiUrl = (typeof API_URL_NOTIF !== 'undefined')
            ? API_URL_NOTIF
            : 'https://script.google.com/macros/s/AKfycbyDTzMkBog7uq3o_0yAuD_WVHOtLQNgBYMzxgdrr9QlLFTKJOk_8mJJlaXMqkixEnm05A/exec';

        console.log('🔔 NotificationManager Constructor iniciado (r1 API)');
        this.setupUI();
        this.init();
    }

    async init() {
        console.log('🔔 NotificationManager.init() ejecutándose...');

        if (!('serviceWorker' in navigator)) {
            console.warn('❌ Service Worker no soportado');
            this.updateUIForState('unsupported');
            return;
        }

        if (!('Notification' in window)) {
            console.warn('❌ Notificaciones no soportadas');
            this.updateUIForState('unsupported');
            return;
        }

        if (!('PushManager' in window)) {
            console.warn('❌ PushManager no soportado');
            this.updateUIForState('unsupported');
            return;
        }

        try {
            // Esperar a que el SW esté listo
            this.swRegistration = await navigator.serviceWorker.ready;

            if (this.swRegistration) {
                console.log('✅ Service Worker listo y vinculado');

                // Sincronizar estado inicial
                const permission = Notification.permission;
                console.log('📊 Permiso actual:', permission);
                this.updateUIForState(permission);

                // Configurar polling r1
                this.sendPollingConfigToSW();

                // Si ya tiene permiso, intentar suscribir (por si expiró el endpoint de GAS)
                if (permission === 'granted') {
                    console.log('🔄 Ya tiene permisos, verificando suscripción Push...');
                    await this.subscribeToPush();
                }
            } else {
                console.warn('⚠️ No se pudo obtener el registro del Service Worker.');
            }
        } catch (e) {
            console.error('❌ Error crítico en init():', e);
        }
    }

    setupUI() {
        console.log('🔔 Configurando UI de notificaciones...');
        const notifToggles = [document.getElementById('notifToggle'), document.getElementById('notifToggleMobile')];
        const summaryBtns = [document.getElementById('sendSummaryBtn'), document.getElementById('sendSummaryBtnMobile')];

        notifToggles.forEach(toggle => {
            if (toggle) {
                toggle.onchange = (e) => {
                    if (toggle.checked) {
                        this.requestPermission(true);
                    } else {
                        alert('Para desactivar totalmente las notificaciones, debes quitarlas desde la configuración del sitio en tu navegador.');
                        this.updateUIForState(Notification.permission);
                    }
                };
            }
        });

        summaryBtns.forEach(btn => {
            if (btn) {
                btn.onclick = (e) => {
                    e.preventDefault();
                    this.sendDailySummary();
                };
            }
        });

        setTimeout(() => this.applyRolePermissions(), 1000);
    }

    applyRolePermissions() {
        const adminNotifSection = document.getElementById('adminNotifSection');
        if (adminNotifSection) adminNotifSection.style.display = 'none';

        let role = null;
        if (window.currentUser && window.currentUser.rol) {
            role = window.currentUser.rol.toUpperCase();
        } else {
            const stored = localStorage.getItem('user');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    const rawRole = parsed.user ? parsed.user.rol : parsed.rol;
                    if (rawRole) role = rawRole.toUpperCase();
                } catch (e) { }
            }
        }

        console.log(`🔔 NotificationManager: Verificando acceso para rol [${role}]`);
    }

    // ============================================
    // Llamar al GAS de Notificaciones (VAPID/JWT)
    // ============================================
    async callNotifAPI(action, method = 'GET', data = null) {
        if (method === 'GET') {
            const res = await fetch(this.notifApiUrl + '?action=' + action, { mode: 'cors' });
            const text = await res.text();
            try { return JSON.parse(text); } catch { return text; }
        }

        // Si es una suscripción o tiene endpoint, enviamos JSON preparado para el GAS
        if (action === 'subscribe' || (data && data.endpoint)) {
            // El GAS espera un JSON con la propiedad 'action' y los datos de suscripción
            const payload = {
                action: 'subscribe',
                endpoint: data.endpoint,
                p256dh: data.keys ? data.keys.p256dh : '',
                auth: data.keys ? data.keys.auth : '',
                subscription: data // El objeto completo para redundancia
            };

            console.log('📤 Enviando suscripción a GAS:', payload);

            const res = await fetch(this.notifApiUrl, {
                method: 'POST',
                mode: 'cors',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'text/plain' } // GAS recibe mejor JSON con text/plain
            });
            const text = await res.text();
            try { return JSON.parse(text); } catch { return text; }
        }

        // Para otras acciones (como send-notification)
        const formAction = action;
        const payloadParams = { action: formAction, ...data };

        const res = await fetch(this.notifApiUrl, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify(payloadParams),
            headers: { 'Content-Type': 'text/plain' }
        });
        const text = await res.text();
        try { return JSON.parse(text); } catch { return text; }
    }

    // ============================================
    // Obtener la clave VAPID pública desde r1
    // ============================================
    async fetchVapidKey() {
        try {
            const res = await fetch(this.notifApiUrl + '?action=vapid-public-key', { mode: 'cors' });
            const text = (await res.text()).trim();

            if (text.startsWith('{')) {
                const obj = JSON.parse(text);
                throw new Error(obj.error || obj.message || 'Error VAPID');
            }
            if (text.length > 20) {
                this.vapidPublicKey = text;
                console.log('✅ Clave VAPID obtenida de r1');
                return true;
            }
            throw new Error('Clave VAPID inválida');
        } catch (err) {
            console.error('❌ Error obteniendo VAPID key:', err.message);
            return false;
        }
    }

    // ============================================
    // ENVIAR REPORTE DIARIO → usa r1 send-notification
    // ============================================
    async sendDailySummary(targetDateStr = null) {
        const btn = document.getElementById('sendSummaryBtn');
        const btnMobile = document.getElementById('sendSummaryBtnMobile');
        const activeBtn = (btn && btn.offsetParent) ? btn : btnMobile;
        const originalHtml = activeBtn ? activeBtn.innerHTML : 'Reporte';

        let confirmMsg = '¿Deseas generar y enviar el resumen de entregas?';
        if (targetDateStr) {
            confirmMsg = `¿Deseas generar y enviar el resumen de entregas para la fecha ${targetDateStr}?`;
        } else {
            confirmMsg += '\n(Se enviará el reporte del último día con datos registrados)';
        }

        if (!confirm(confirmMsg)) return;

        try {
            if (activeBtn) {
                activeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';
                activeBtn.disabled = true;
            }

            // Usar datosTablaDocumentos que es la fuente de verdad actual
            let rawData = window.datosTablaDocumentos || [];

            if (rawData.length === 0) {
                if (typeof window.cargarTablaDocumentos === 'function') {
                    await window.cargarTablaDocumentos();
                    rawData = window.datosTablaDocumentos || [];
                }
            }

            if (rawData.length === 0) throw new Error('No hay datos disponibles en el sistema para generar el reporte.');

            // Mapear datos globales (enriquecidos con clientes) por REC
            const infoGlobalMap = {};
            if (window.datosGlobales) {
                window.datosGlobales.forEach(item => {
                    if (item.REC) infoGlobalMap[item.REC] = item;
                });
            }

            console.log(`🔍 Analizando ${rawData.length} documentos para el reporte inteligente...`);

            const parseDate = (str) => {
                if (!str) return null;
                const match = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                if (match) {
                    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
                }
                const d = new Date(str);
                return isNaN(d.getTime()) ? null : d;
            };

            const formatCurrency = (val) => new Intl.NumberFormat('es-CO', {
                style: 'currency', currency: 'COP', minimumFractionDigits: 0
            }).format(val);

            // 1. Recopilar entregas finalizadas
            const allDeliveries = [];
            rawData.forEach(row => {
                const rec = String(row[0] || '').trim();
                const estado = String(row[3] || '').trim().toUpperCase();

                // Solo nos interesan los finalizados (entregas completas)
                if (estado !== 'FINALIZADO') return;

                const fechaStr = row[1] || "";
                const dateObj = parseDate(fechaStr);
                if (!dateObj) return;

                const infoExtra = infoGlobalMap[rec] || {};

                allDeliveries.push({
                    rec: rec,
                    dateObj: dateObj,
                    dateVal: (dateObj.getFullYear() * 10000) + ((dateObj.getMonth() + 1) * 100) + dateObj.getDate(),
                    dateStr: `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`,
                    clientes: infoExtra.CLIENTES || {},
                    valorTotal: infoExtra.PVP ? (parseFloat(infoExtra.PVP) * (infoExtra.CANTIDAD || 1)) : 0,
                    unidades: infoExtra.CANTIDAD || 0,
                    lote: infoExtra.LOTE || ''
                });
            });

            if (allDeliveries.length === 0) {
                alert('No se encontraron registros de documentos FINALIZADOS para generar el reporte.');
                if (activeBtn) {
                    activeBtn.innerHTML = originalHtml;
                    activeBtn.disabled = false;
                }
                return;
            }

            // 2. Determinar fecha objetivo
            let finalDateStr = "";
            let finalDateVal = 0;
            let finalDateObj = null;

            if (targetDateStr) {
                const parts = targetDateStr.split('-');
                finalDateVal = (parseInt(parts[0]) * 10000) + (parseInt(parts[1]) * 100) + parseInt(parts[2]);
                finalDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
                finalDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else {
                allDeliveries.forEach(d => {
                    if (d.dateVal > finalDateVal) {
                        finalDateVal = d.dateVal;
                        finalDateStr = d.dateStr;
                        finalDateObj = d.dateObj;
                    }
                });
            }

            // 3. Filtrar y Consolidar
            const dayDeliveries = allDeliveries.filter(d => d.dateVal === finalDateVal);
            if (dayDeliveries.length === 0) {
                alert(`No se encontraron entregas finalizadas para la fecha ${finalDateStr}.`);
                if (activeBtn) {
                    activeBtn.innerHTML = originalHtml;
                    activeBtn.disabled = false;
                }
                return;
            }

            const clientGroups = {};
            let totalUnidades = 0;
            let totalValor = 0;
            const recsUnicos = new Set();

            dayDeliveries.forEach(d => {
                recsUnicos.add(d.rec);
                totalUnidades += d.unidades;
                totalValor += d.valorTotal;

                // Agrupar por clientes dentro del documento
                const clientes = Object.keys(d.clientes);
                if (clientes.length === 0) {
                    const cName = "VENTA DIRECTA / OTROS";
                    if (!clientGroups[cName]) clientGroups[cName] = { unidades: 0, valor: 0, docs: new Set() };
                    clientGroups[cName].unidades += d.unidades;
                    clientGroups[cName].valor += d.valorTotal;
                    clientGroups[cName].docs.add(d.rec);
                } else {
                    clientes.forEach(cName => {
                        const cInfo = d.clientes[cName];
                        const cUnidades = cInfo.unidades || (d.unidades / clientes.length); // Prorrateo si no hay detalle
                        const cValor = (d.valorTotal / clientes.length);

                        if (!clientGroups[cName]) clientGroups[cName] = { unidades: 0, valor: 0, docs: new Set() };
                        clientGroups[cName].unidades += cUnidades;
                        clientGroups[cName].valor += cValor;
                        clientGroups[cName].docs.add(d.rec);
                    });
                }
            });

            // 4. Construir cuerpo del mensaje
            let bodyDetalle = "";
            Object.entries(clientGroups)
                .sort((a, b) => b[1].valor - a[1].valor)
                .forEach(([name, data]) => {
                    bodyDetalle += `\n👤 *${name}*\n   - Documentos: ${data.docs.size}\n   - Unidades: ${Math.round(data.unidades)}\n   - Subtotal: ${formatCurrency(data.valor)}\n`;
                });

            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const diaNombre = diasSemana[finalDateObj.getDay()];

            const titulo = `Resumen Entregas - ${finalDateStr}`;
            const headerResumen = `*REPORTE DE ENTREGAS (${diaNombre})*
            ----------------------------
            Docs: ${recsUnicos.size}
            Unidades: ${totalUnidades}
            Venta Total: ${formatCurrency(totalValor)}
            ----------------------------`;

            const cuerpoCompleto = headerResumen + bodyDetalle;

            // Enviar vía Push (y polling r1 lo detectará)
            const resData = await this.callNotifAPI('send-notification', 'POST', {
                title: titulo,
                body: `Reporte ${finalDateStr}: ${totalUnidades} und en ${recsUnicos.size} docs. Total: ${formatCurrency(totalValor)}`,
                url: `./`
            });

            if (resData && resData.success) {
                alert(`✅ Reporte enviado correctamente.\nFecha: ${finalDateStr}\nTotal: ${formatCurrency(totalValor)}`);
            } else {
                throw new Error(resData.message || resData.error || 'Error en el servidor');
            }

        } catch (e) {
            console.error('❌ Error enviando resumen:', e);
            alert('Error al generar resumen: ' + e.message);
        } finally {
            if (activeBtn) {
                activeBtn.innerHTML = originalHtml;
                activeBtn.disabled = false;
            }
        }
    }

    updateUIForState(state) {
        const toggles = [document.getElementById('notifToggle'), document.getElementById('notifToggleMobile')];
        const descs = [document.getElementById('notifDesc'), document.getElementById('notifDescMobile')];

        console.log('🔔 Actualizando UI de notificaciones: ' + state);

        toggles.forEach(toggle => {
            if (toggle) toggle.checked = (state === 'granted');
        });

        const statusLabel = state === 'granted' ? 'Estado: Activo' : (state === 'denied' ? 'Estado: Bloqueado' : 'Estado: Desactivado');
        descs.forEach(desc => {
            if (desc) desc.innerText = statusLabel;
        });
    }

    async requestPermission(isManual = false) {
        // Validación específica para iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        if (isIOS && !isStandalone) {
            alert('Para activar notificaciones en iOS (iPhone), debes:\n1. Pulsar el botón "Compartir" de Safari.\n2. Seleccionar "Añadir a pantalla de inicio".\n3. Abrir la app desde el icono de tu pantalla.');
            this.updateUIForState('denied');
            return false;
        }

        try {
            console.log('🔔 Solicitando permisos de notificación...');

            // Algunos navegadores antiguos no soportan la versión Promise de requestPermission
            const permission = await new Promise((resolve, reject) => {
                const res = Notification.requestPermission(resolve);
                if (res) res.then(resolve).catch(reject);
            });

            this.updateUIForState(permission);

            if (permission === 'granted') {
                if (isManual) {
                    Swal.fire({
                        title: '¡Permisos Concedidos!',
                        text: 'Estamos configurando tu dispositivo...',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    await this.subscribeToPush();
                }
            } else if (permission === 'denied') {
                alert('Has bloqueado las notificaciones. Para habilitarlas, debes ir a los ajustes de tu navegador para este sitio.');
            }

            return permission === 'granted';
        } catch (e) {
            console.error('Error solicitando permiso:', e);
            alert('Error al solicitar permisos: ' + e.message);
        }
        return false;
    }

    // ============================================
    // Suscribir — usa r1 (VAPID key dinámica + subscribe)
    // ============================================
    async subscribeToPush() {
        if (!this.swRegistration) return;

        try {
            // Obtener la clave VAPID de r1 si no la tenemos
            if (!this.vapidPublicKey) {
                const ok = await this.fetchVapidKey();
                if (!ok) {
                    console.warn('⚠️ No se pudo obtener VAPID key, push no disponible');
                    return;
                }
            }

            const applicationServerKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });

            this.isSubscribed = true;

            // ⭐ Guardar suscripción en r1 con action=subscribe
            const subJSON = subscription.toJSON();
            const result = await this.callNotifAPI('subscribe', 'POST', subJSON);

            if (result && result.success) {
                console.log('✅ Suscripción guardada en r1:', result.message);
            } else {
                console.warn('⚠️ Respuesta de r1 al suscribir:', result);
            }

        } catch (e) {
            console.warn('Push subscribe error:', e.message);
            alert('Fallo al suscribir a push: ' + e.message + '\n\nAsegúrate de estar en una conexión segura (HTTPS) y de no estar en modo incógnito.');
        }
    }

    // ============================================
    // Enviar configuración de polling al SW → apunta a r1
    // ============================================
    sendPollingConfigToSW() {
        const userId = window.currentUser ? window.currentUser.id : 'anonimo';

        if (this.swRegistration && this.swRegistration.active) {
            this.swRegistration.active.postMessage({
                type: 'SET_POLLING_CONFIG',
                url: this.notifApiUrl,       // ⭐ Ahora apunta a r1
                userId: userId,
                lastTs: this.lastNotificationTimestamp
            });
            console.log('🔔 Polling configurado → r1 API');
        }
    }

    sendTestNotification(msg = 'Prueba de notificación local') {
        if (Notification.permission === 'granted') {
            if (this.swRegistration) {
                this.swRegistration.showNotification(CONFIG.APP_NAME || 'Separación', {
                    body: msg,
                    icon: './icons/icon-192.png',
                    badge: './icons/icon-192.png',
                    vibrate: [100, 50, 100],
                    tag: 'test-notification'
                });
            } else {
                new Notification(CONFIG.APP_NAME || 'Separación', { body: msg });
            }
        } else {
            this.requestPermission(false);
        }
    }

    /**
     * Notifica cuando se asigna un nuevo lote.
     */
    async notifyNewLotAssignment(lote, responsable) {
        console.log(`🔔 Notificando asignación de lote [${lote}] a [${responsable}]`);
        try {
            const title = `Nuevo Lote Asignado: ${lote}`;
            const body = `El lote ${lote} ha sido asignado a ${responsable || 'Sin asignar'}.`;
            return await this.callNotifAPI('send-notification', 'POST', {
                title: title,
                body: body,
                url: './'
            });
        } catch (e) {
            console.error('❌ Error enviando notificación de lote:', e);
        }
    }

    /**
     * Notifica cambios de estado (Ej: Pausado para pruebas)
     */
    /**
     * Notifica cambios de estado (Ej: Pausado para pruebas)
     */
    async notifyStatusChange(rec, status) {
        console.log(`🔔 Notificando cambio de estado: REC${rec} -> ${status}`);
        try {
            const doc = (window.documentosGlobales || []).find(d => d.rec === rec);
            const loteInfo = doc && doc.lote ? ` (Lote: ${doc.lote})` : '';
            const refInfo = doc && doc.refProv ? ` [${doc.refProv}]` : '';

            const title = `Documento ${status}: REC${rec}${loteInfo}`;
            const body = `El documento REC${rec}${refInfo} ha cambiado su estado a ${status}.`;
            return await this.callNotifAPI('send-notification', 'POST', {
                title: title,
                body: body,
                url: './'
            });
        } catch (e) {
            console.error('❌ Error enviando notificación de estado:', e);
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.notificationManager = new NotificationManager();
    });
} else {
    window.notificationManager = new NotificationManager();
}