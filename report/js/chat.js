/* ==========================================================================
   chat.js — Chat interno entre USER-P/ADMIN y GUEST por novedad
   ========================================================================== */

/* ── Intervalos de polling adaptativos ── */
const CHAT_POLL_ACTIVE  = 2_000;  // chat abierto: 2s
const CHAT_POLL_IDLE    = 20_000; // chat cerrado: 20s (badges USER-P)
const GUEST_POLL_ACTIVE = 2_000;
const GUEST_POLL_IDLE   = 20_000;

let _chatTimer      = null;
let _chatNovedadId  = null;
let _chatPlanta     = null;
let _chatLastTs     = null;
let _chatLote       = null;
let _chatArchived   = false;
let _chatReadReceipts = {};  // { GUEST: ts, OPERATOR: ts }
let _chatMetaLoaded = false; // si ya cargamos meta (archived + readReceipts) al abrir
let _markReadSent   = false; // MARK_READ solo se envía una vez por apertura

/* ── Badge de mensajes no leídos (USER-P/ADMIN en resolucion.html) ── */
const CHAT_BADGE_KEY = 'sispro_chat_seen';
let _chatBadgeTimer  = null;
let _chatSeenTs      = {};
let _operatorChatNotifs = []; // notificaciones de chat para el panel de campana del operador

/* ── Panel GUEST ── */
const GUEST_CHAT_KEY  = 'sispro_guest_chat_seen';
let _guestChatSeen    = {};
let _guestPollTimer   = null;
let _guestNovedades   = [];

/* ══════════════════════════════════════════════════════════════════════════
   API HELPERS
   ══════════════════════════════════════════════════════════════════════════ */

async function _chatFetch(body) {
    const res = await fetch(GAS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
    });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch (e) {
        console.error('[CHAT] Respuesta no-JSON:', text.substring(0, 200));
        throw new Error('Respuesta inválida del servidor');
    }
}

/**
 * Lee la hoja CHAT directamente via Sheets API v4 (sin pasar por GAS).
 * Mucho más rápido para lecturas frecuentes.
 * @returns {Promise<Array>} filas crudas [[ID_MSG, ID_NOV, PLANTA, ROL, AUTOR, MENSAJE, TS], ...]
 */
async function _readChatSheet() {
    if (!CONFIG.API_KEY) await fetchSecureConfig();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/CHAT!A:G?key=${CONFIG.API_KEY}&majorDimension=ROWS`;
    const res  = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Sheets API ${res.status}`);
    const { values = [] } = await res.json();
    return values.length > 1 ? values.slice(1) : [];
}

/**
 * Lee la columna CHAT de NOVEDADES para saber si un chat está archivado.
 * Devuelve { chatUrl, chatRead } para el idNovedad dado.
 */
async function _readNovedadChatMeta(idNovedad) {
    if (!CONFIG.API_KEY) await fetchSecureConfig();
    // Leer columnas A (ID), R (CHAT col18), S (CHAT_READ col19)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/NOVEDADES!A:S?key=${CONFIG.API_KEY}&majorDimension=ROWS`;
    const res  = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return { chatUrl: '', chatRead: {} };
    const { values = [] } = await res.json();
    if (values.length < 2) return { chatUrl: '', chatRead: {} };
    // Fila 0 = headers
    const headers = values[0].map(h => String(h).trim().toUpperCase());
    const chatColIdx     = headers.indexOf('CHAT');
    const chatReadColIdx = headers.indexOf('CHAT_READ');
    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (String(row[0] || '').trim() === String(idNovedad).trim()) {
            const chatUrl  = chatColIdx  >= 0 ? String(row[chatColIdx]  || '') : '';
            const chatReadRaw = chatReadColIdx >= 0 ? String(row[chatReadColIdx] || '') : '';
            let chatRead = {};
            try { chatRead = JSON.parse(chatReadRaw || '{}'); } catch (_) {}
            return { chatUrl, chatRead };
        }
    }
    return { chatUrl: '', chatRead: {} };
}

async function _sendMsg(mensaje) {
    if (!mensaje.trim() || !_chatNovedadId) return;
    const autor = currentUser.USUARIO || currentUser.PLANTA || 'Usuario';
    const rol   = currentUser.ROL || 'GUEST';
    return _chatFetch({ accion: 'SEND_CHAT_MSG', idNovedad: _chatNovedadId, planta: _chatPlanta, autor, rol, mensaje: mensaje.trim() });
}

async function _archiveChat(idNovedad) {
    try {
        await _chatFetch({ accion: 'ARCHIVE_CHAT', idNovedad });
    } catch (e) { console.warn('[CHAT] No se pudo archivar:', e.message); }
}

async function _reopenChat(idNovedad) {
    try {
        await _chatFetch({ accion: 'REOPEN_CHAT', idNovedad });
    } catch (e) { console.warn('[CHAT] No se pudo reabrir:', e.message); }
}

/* ══════════════════════════════════════════════════════════════════════════
   ABRIR / CERRAR CHAT
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Abre el chat para una novedad.
 * @param {string} idNovedad
 * @param {string} planta
 * @param {string} lote
 */
function openChat(idNovedad, planta, lote, isArchived) {
    _chatNovedadId  = idNovedad;
    _chatPlanta     = planta;
    _chatLote       = lote;
    _chatLastTs     = null;
    _chatArchived   = !!isArchived;
    _chatMetaLoaded = true;  // ya tenemos el estado archivado — no re-leer NOVEDADES
    _markReadSent   = false;
    _buildChatModal(lote, planta);
    _startChatPoll(CHAT_POLL_ACTIVE);
}

/**
/**
 * Cierra el modal de chat. NO archiva ni finaliza nada.
 * Archivar solo ocurre via botón ARCHIVAR o al FINALIZAR la novedad.
 */
function closeChat() {
    _stopChatPoll();
    const overlay = document.getElementById('chat-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        overlay.style.transform = 'scale(0.97)';
        setTimeout(() => overlay.remove(), 200);
    }
    _chatNovedadId = null;
    _chatArchived  = false;
    if (currentUser?.ROL !== 'GUEST') _startBadgePoll();
}

/**
 * Cierra el modal de chat si está abierto para esa novedad.
 * NO archiva — cerrar el modal no finaliza ni archiva nada.
 */
function closeChatIfOpen(idNovedad) {
    if (_chatNovedadId === idNovedad) closeChat();
}

/**
 * Llamado al FINALIZAR una novedad desde resolucion.js.
 * Cierra el modal si está abierto Y archiva el chat en Drive.
 */
function _finalizarChat(idNovedad) {
    if (_chatNovedadId === idNovedad) closeChat();
    _archiveChat(idNovedad);
}

/* ══════════════════════════════════════════════════════════════════════════
   MODAL
   ══════════════════════════════════════════════════════════════════════════ */

function _buildChatModal(lote, planta) {
    document.getElementById('chat-overlay')?.remove();

    const isOperator = currentUser?.ROL === 'ADMIN' || currentUser?.ROL === 'USER-P';

    const overlay = document.createElement('div');
    overlay.id = 'chat-overlay';
    overlay.style.cssText = `
        position:fixed; inset:0;
        background:rgba(15,23,42,0.45); backdrop-filter:blur(6px);
        z-index:9000; display:flex; align-items:center; justify-content:center;
        opacity:0; transition:opacity 0.2s ease;
    `;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeChat(); });

    overlay.innerHTML = `
        <div id="chat-box" style="
            width:420px; max-width:calc(100vw - 32px);
            height:580px; max-height:calc(100vh - 80px);
            background:white; border-radius:20px;
            box-shadow:0 25px 60px rgba(0,0,0,0.2);
            display:flex; flex-direction:column; overflow:hidden;
            transform:scale(0.97); transition:transform 0.2s ease;
        ">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:14px 16px;display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="fas fa-comments" style="color:white;font-size:0.95rem;"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:0.88rem;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Chat — Lote ${lote || 'S/N'}</div>
                    <div style="font-size:0.65rem;color:rgba(255,255,255,0.65);margin-top:1px;">${planta}</div>
                </div>
                <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                    ${isOperator ? `
                    <button id="chat-action-btn" onclick="_toggleChatArchive()" title="Finalizar y archivar chat"
                        style="background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.3);color:white;
                               height:30px;padding:0 12px;border-radius:20px;cursor:pointer;
                               font-size:0.65rem;font-weight:800;letter-spacing:0.5px;
                               display:flex;align-items:center;gap:5px;transition:all 0.2s;white-space:nowrap;">
                        <i class="fas fa-archive"></i> <span id="chat-action-label">ARCHIVAR</span>
                    </button>` : ''}
                    <button onclick="closeChat()"
                        style="background:rgba(255,255,255,0.15);border:none;color:white;
                               width:30px;height:30px;border-radius:50%;cursor:pointer;
                               font-size:0.9rem;display:flex;align-items:center;justify-content:center;transition:background 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.28)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <!-- Messages -->
            <div id="chat-messages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f8fafc;">
                <div id="chat-loading" style="text-align:center;padding:20px;color:#94a3b8;">
                    <i class="fas fa-circle-notch fa-spin" style="font-size:1.2rem;"></i>
                </div>
            </div>
            <!-- Input -->
            <div id="chat-input-area" style="padding:12px 16px;border-top:1px solid #f1f5f9;background:white;display:flex;gap:10px;align-items:flex-end;">
                <textarea id="chat-input" placeholder="Escribe un mensaje..." rows="1"
                    style="flex:1;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 14px;font-size:0.875rem;resize:none;font-family:inherit;color:#1e293b;outline:none;transition:border 0.2s;max-height:100px;overflow-y:auto;line-height:1.4;"
                    onfocus="this.style.borderColor='#3b82f6'" onblur="this.style.borderColor='#e2e8f0'"
                    onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();_submitChatMsg();}"
                    oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,100)+'px';"
                ></textarea>
                <button onclick="_submitChatMsg()" id="chat-send-btn"
                    style="width:40px;height:40px;border-radius:50%;border:none;
                           background:linear-gradient(135deg,#3b82f6,#6366f1);color:white;cursor:pointer;
                           flex-shrink:0;display:flex;align-items:center;justify-content:center;
                           font-size:0.9rem;transition:all 0.2s;box-shadow:0 4px 12px rgba(59,130,246,0.3);"
                    onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        document.getElementById('chat-box').style.transform = 'scale(1)';
    }));
    setTimeout(() => document.getElementById('chat-input')?.focus(), 250);
}

/**
 * Alterna entre ARCHIVAR (finalizar) y REABRIR el chat.
 * Disponible para USER-P/ADMIN (header) y GUEST (banner).
 */
async function _toggleChatArchive() {
    const id  = _chatNovedadId;
    const btn = document.getElementById('chat-action-btn');
    if (!id) return;

    // Deshabilitar ambos posibles botones (header + banner)
    const bannerBtn = document.querySelector('#chat-archived-banner button');
    if (btn) btn.disabled = true;
    if (bannerBtn) bannerBtn.disabled = true;
    const prevBtnHTML = btn ? btn.innerHTML : null;
    if (btn) btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';

    try {
        if (_chatArchived) {
            // REABRIR
            await _reopenChat(id);
            _chatArchived = false;
            _chatLastTs   = null;
            _chatMetaLoaded = false; // forzar re-lectura de meta
            _updateArchivedBanner(false);
            _updateChatActionBtn();
            await _loadAndRender();
        } else {
            // ARCHIVAR
            const res = await _chatFetch({ accion: 'ARCHIVE_CHAT', idNovedad: id });
            if (res.success) {
                _chatArchived = true;
                _chatMetaLoaded = false; // forzar re-lectura de meta
                _updateChatActionBtn();
                _updateArchivedBanner(true);
            }
        }
    } catch (e) {
        console.error('[CHAT] Error toggle archive:', e);
    } finally {
        if (btn) {
            btn.disabled = false;
            if (btn.innerHTML.includes('fa-spin') && prevBtnHTML) btn.innerHTML = prevBtnHTML;
        }
        if (bannerBtn) bannerBtn.disabled = false;
    }
}

function _updateChatActionBtn() {
    const btn = document.getElementById('chat-action-btn');
    const lbl = document.getElementById('chat-action-label');
    if (!btn || !lbl) return;
    if (_chatArchived) {
        btn.title = 'Reabrir chat';
        btn.querySelector('i').className = 'fas fa-folder-open';
        lbl.textContent = 'REABRIR';
        btn.style.background = 'rgba(34,197,94,0.2)';
        btn.style.borderColor = 'rgba(34,197,94,0.5)';
    } else {
        btn.title = 'Finalizar y archivar chat';
        btn.querySelector('i').className = 'fas fa-archive';
        lbl.textContent = 'ARCHIVAR';
        btn.style.background = 'rgba(255,255,255,0.15)';
        btn.style.borderColor = 'rgba(255,255,255,0.3)';
    }
}

function _updateArchivedBanner(show) {
    const area = document.getElementById('chat-input-area');
    if (!area) return;
    const existing = document.getElementById('chat-archived-banner');
    const isGuest  = currentUser?.ROL === 'GUEST';
    if (show && !existing) {
        const banner = document.createElement('div');
        banner.id = 'chat-archived-banner';
        banner.style.cssText = `
            padding:10px 16px;background:#f0fdf4;border-top:1px solid #bbf7d0;
            display:flex;align-items:center;gap:8px;font-size:0.72rem;font-weight:700;color:#15803d;
            flex-wrap:wrap;
        `;
        const msg = isGuest
            ? 'Esta consulta ha sido atendida y cerrada.'
            : 'Chat finalizado y archivado. Presiona REABRIR para continuar.';
        banner.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span style="flex:1;">${msg}</span>
            <button onclick="_toggleChatArchive()"
                style="background:#15803d;border:none;color:white;padding:4px 10px;border-radius:10px;
                       cursor:pointer;font-size:0.65rem;font-weight:800;letter-spacing:0.4px;
                       display:flex;align-items:center;gap:4px;white-space:nowrap;">
                <i class="fas fa-folder-open"></i> REABRIR
            </button>`;
        area.parentNode.insertBefore(banner, area);
        area.style.display = 'none';
    } else if (!show && existing) {
        existing.remove();
        area.style.display = 'flex';
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   ENVIAR / POLLING / RENDER
   ══════════════════════════════════════════════════════════════════════════ */

async function _submitChatMsg() {
    const input = document.getElementById('chat-input');
    if (!input) return;
    const texto = input.value.trim();
    if (!texto) return;

    const btn = document.getElementById('chat-send-btn');
    if (btn) btn.disabled = true;
    input.value = '';
    input.style.height = 'auto';

    _appendBubble({ id: 'temp_' + Date.now(), autor: currentUser.USUARIO || currentUser.PLANTA || 'Tú', rol: currentUser.ROL, mensaje: texto, ts: new Date().toISOString() }, true);

    try {
        await _sendMsg(texto);
        await _loadAndRender();
    } catch (e) {
        console.error('[CHAT] Error al enviar:', e);
    } finally {
        if (btn) btn.disabled = false;
        input.focus();
    }
}

function _startChatPoll(interval = CHAT_POLL_ACTIVE) {
    _stopChatPoll();
    _loadAndRender();
    _chatTimer = setInterval(_loadAndRender, interval);
}

function _stopChatPoll() {
    if (_chatTimer) { clearInterval(_chatTimer); _chatTimer = null; }
}

async function _loadAndRender() {
    try {
        const id = _chatNovedadId;
        if (!id) return;

        if (!_chatMetaLoaded) {
            // Solo si no tenemos el estado archivado (fallback: no se pasó isArchived)
            const meta = await _readNovedadChatMeta(id);
            _chatMetaLoaded = true;
            _chatArchived = meta.chatUrl.startsWith('https://');
            _chatReadReceipts = meta.chatRead || {};
            _updateChatActionBtn();
            if (_chatArchived) _updateArchivedBanner(true);
        }

        if (_chatArchived) {
            // Archivado: leer desde Drive via GAS (solo una vez — no hay polling)
            _stopChatPoll();
            const data = await _chatFetch({ accion: 'GET_CHAT_MSGS', idNovedad: id });
            const msgs = data.msgs || [];
            if (data.readReceipts) _chatReadReceipts = data.readReceipts;
            _renderMessages(msgs);
            if (msgs.length) _markChatSeen(id, msgs[msgs.length - 1].ts);
        } else {
            // Activo: solo Sheets API v4 — rápido
            const allRows = await _readChatSheet();
            const msgs = allRows
                .filter(r => String(r[1] || '').trim() === id)
                .map(r => ({ id: r[0], rol: r[3], autor: r[4], mensaje: r[5], ts: r[6] }));
            _renderMessages(msgs);
            if (msgs.length) _markChatSeen(id, msgs[msgs.length - 1].ts);
        }

        // MARK_READ: solo una vez por apertura
        if (!_markReadSent) {
            _markReadSent = true;
            const rol = currentUser?.ROL || 'GUEST';
            _chatFetch({ accion: 'MARK_READ', idNovedad: id, rol }).catch(() => {});
        }
    } catch (e) { console.warn('[CHAT] Error al cargar mensajes:', e); }
}

function _renderMessages(msgs) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    document.getElementById('chat-loading')?.remove();

    if (msgs.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#94a3b8;"><i class="fas fa-comments" style="font-size:2.5rem;margin-bottom:12px;display:block;opacity:0.4;"></i><div style="font-weight:700;font-size:0.85rem;margin-bottom:4px;">Sin mensajes aún</div><div style="font-size:0.75rem;">Sé el primero en escribir.</div></div>`;
        return;
    }

    const lastTs = msgs[msgs.length - 1]?.ts;
    if (lastTs === _chatLastTs && container.children.length > 0) return;
    _chatLastTs = lastTs;

    const wasAtBottom = _isScrolledToBottom(container);
    container.innerHTML = '';

    // Find the last message sent by the current user (for read receipt)
    const myRol = currentUser?.ROL || 'GUEST';
    let lastMyMsgIndex = -1;
    msgs.forEach((msg, i) => { if (msg.rol === myRol && !String(msg.id).startsWith('temp_')) lastMyMsgIndex = i; });

    let lastDate = null;
    msgs.forEach((msg, i) => {
        const msgDate = _formatDateLabel(msg.ts);
        if (msgDate !== lastDate) {
            lastDate = msgDate;
            const sep = document.createElement('div');
            sep.style.cssText = 'text-align:center;font-size:0.65rem;font-weight:700;color:#94a3b8;margin:8px 0;position:relative;';
            sep.innerHTML = `<span style="background:#f8fafc;padding:0 10px;position:relative;z-index:1;">${msgDate}</span><div style="position:absolute;top:50%;left:0;right:0;height:1px;background:#e2e8f0;z-index:0;"></div>`;
            container.appendChild(sep);
        }
        const isLastMine = (i === lastMyMsgIndex);
        _appendBubble(msg, false, container, isLastMine);
    });

    if (wasAtBottom) container.scrollTop = container.scrollHeight;
}

function _appendBubble(msg, scrollDown = true, container = null, isLastMine = false) {
    const c = container || document.getElementById('chat-messages');
    if (!c) return;
    const isGuestMsg  = msg.rol === 'GUEST';
    const bubbleBg    = isGuestMsg ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'white';
    const textColor   = isGuestMsg ? 'white' : '#1e293b';
    const metaColor   = isGuestMsg ? 'rgba(255,255,255,0.7)' : '#94a3b8';
    const align       = isGuestMsg ? 'flex-end' : 'flex-start';
    const borderRadius = isGuestMsg ? '18px 18px 4px 18px' : '18px 18px 18px 4px';

    // Read receipt: show ✓✓ on the last message sent by the current user
    let receiptHtml = '';
    if (isLastMine) {
        const myRol      = currentUser?.ROL || 'GUEST';
        const otherKey   = myRol === 'GUEST' ? 'OPERATOR' : 'GUEST';
        const otherReadTs = _chatReadReceipts[otherKey];
        if (otherReadTs && msg.ts && otherReadTs >= msg.ts) {
            receiptHtml = `<div style="font-size:0.58rem;color:${metaColor};margin-top:2px;text-align:right;display:flex;align-items:center;justify-content:flex-end;gap:3px;">
                <i class="fas fa-check-double" style="font-size:0.6rem;color:${isGuestMsg ? 'rgba(255,255,255,0.85)' : '#3b82f6'};"></i>
                <span>Visto ${_formatTime(otherReadTs)}</span>
            </div>`;
        }
    }

    const wrap = document.createElement('div');
    wrap.id = msg.id || '';
    wrap.style.cssText = `display:flex;flex-direction:column;align-items:${align};`;
    wrap.innerHTML = `
        ${!isGuestMsg ? `<div style="font-size:0.65rem;font-weight:700;color:#64748b;margin-bottom:3px;padding-left:4px;">${msg.autor}</div>` : ''}
        <div style="max-width:78%;padding:10px 14px;background:${bubbleBg};border-radius:${borderRadius};box-shadow:0 1px 4px rgba(0,0,0,0.06);">
            <div style="font-size:0.875rem;color:${textColor};line-height:1.5;word-break:break-word;">${_escapeHtml(msg.mensaje)}</div>
            <div style="font-size:0.6rem;color:${metaColor};margin-top:4px;text-align:right;">${_formatTime(msg.ts)}</div>
        </div>
        ${receiptHtml}`;
    c.appendChild(wrap);
    if (scrollDown) c.scrollTop = c.scrollHeight;
}

/* ══════════════════════════════════════════════════════════════════════════
   BADGES USER-P/ADMIN (resolucion.html)
   ══════════════════════════════════════════════════════════════════════════ */

function initChatBadges() {
    const role = currentUser?.ROL;
    if (role !== 'ADMIN' && role !== 'USER-P') return;
    try { const s = localStorage.getItem(CHAT_BADGE_KEY); if (s) _chatSeenTs = JSON.parse(s); } catch (_) {}
    _startBadgePoll();
    // Pausar cuando la pestaña está oculta
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { if (_chatBadgeTimer) { clearInterval(_chatBadgeTimer); _chatBadgeTimer = null; } }
        else if (!_chatNovedadId) _startBadgePoll();
    });
}

function _startBadgePoll() {
    if (_chatBadgeTimer) clearInterval(_chatBadgeTimer);
    _pollChatBadges();
    _chatBadgeTimer = setInterval(_pollChatBadges, CHAT_POLL_IDLE);
}

async function _pollChatBadges() {
    const cards = document.querySelectorAll('[data-novedad-id]');
    if (!cards.length) return;
    const ids = new Set(Array.from(cards).map(c => c.dataset.novedadId).filter(Boolean));
    try {
        // Leer hoja CHAT directamente via Sheets API v4
        const allRows = await _readChatSheet();
        // Agrupar: último mensaje por novedad
        const latestByNov = {};
        allRows.forEach(r => {
            const novId = String(r[1] || '').trim();
            if (ids.has(novId)) {
                latestByNov[novId] = { id: r[0], rol: r[3], autor: r[4], mensaje: r[5], ts: r[6] };
            }
        });
        let hasNew = false;
        for (const id of ids) {
            const lastMsg = latestByNov[id];
            if (!lastMsg) { _markCardRead(id); continue; }
            if (lastMsg.rol === 'GUEST' && lastMsg.ts !== _chatSeenTs[id]) {
                _markCardUnread(id);
                hasNew = true;
                // Agregar a la campana si no está ya
                _addOperatorChatNotif(id, lastMsg);
            } else {
                _markCardRead(id);
            }
        }
        _updateOperatorBellBadge();
    } catch (_) {}
}

/**
 * Agrega una notificación de mensaje GUEST al panel de campana del operador.
 */
function _addOperatorChatNotif(idNovedad, msg) {
    if (typeof _operatorChatNotifs === 'undefined') return;
    const dedupKey = `${idNovedad}_${msg.ts}`;
    if (_operatorChatNotifs.some(n => n.id === dedupKey)) return;
    // Buscar datos de la novedad en el DOM
    const card = document.querySelector(`[data-novedad-id="${idNovedad}"]`);
    const lote  = card?.dataset.lote  || idNovedad;
    const planta = card?.dataset.planta || '';
    _operatorChatNotifs.unshift({ id: dedupKey, idNovedad, lote, planta, msg, ts: new Date(), read: false });
    if (_operatorChatNotifs.length > 30) _operatorChatNotifs = _operatorChatNotifs.slice(0, 30);
    _updateOperatorBellBadge();
    // Animar campana
    const bellBtn = document.getElementById('notif-bell-btn');
    if (bellBtn) {
        bellBtn.classList.add('has-unread');
        bellBtn.addEventListener('animationend', () => bellBtn.classList.remove('has-unread'), { once: true });
    }
}

function _markCardUnread(idNovedad) {
    const btn = document.querySelector(`[data-chat-btn="${idNovedad}"]`);
    if (!btn) return;
    btn.classList.add('has-unread-chat');
    if (!btn.querySelector('.chat-unread-dot')) {
        const dot = document.createElement('span');
        dot.className = 'chat-unread-dot';
        btn.appendChild(dot);
    }
    _updateOperatorBellBadge();
}

function _markCardRead(idNovedad) {
    const btn = document.querySelector(`[data-chat-btn="${idNovedad}"]`);
    if (!btn) return;
    btn.classList.remove('has-unread-chat');
    btn.querySelector('.chat-unread-dot')?.remove();
    _updateOperatorBellBadge();
}

function _updateOperatorBellBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const unread = _operatorChatNotifs.filter(n => !n.read).length;
    badge.style.display = unread > 0 ? 'block' : 'none';
    badge.textContent = unread > 9 ? '9+' : String(unread);
    _renderOperatorNotifPanel();
}

function _markChatSeen(idNovedad, lastTs) {
    if (!idNovedad || !lastTs) return;
    _chatSeenTs[idNovedad] = lastTs;
    try { localStorage.setItem(CHAT_BADGE_KEY, JSON.stringify(_chatSeenTs)); } catch (_) {}
    _markCardRead(idNovedad);
    // Marcar notificaciones del operador como leídas para esta novedad
    _operatorChatNotifs.forEach(n => { if (n.idNovedad === idNovedad) n.read = true; });
    _updateOperatorBellBadge();
}

/* ══════════════════════════════════════════════════════════════════════════
   PANEL DE NOTIFICACIONES OPERADOR (resolucion.html)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Renderiza el panel de campana del operador con mensajes de chat no leídos.
 * El panel ya existe en el DOM (creado por notifications.js/_ensureNotifPanel).
 */
function _renderOperatorNotifPanel() {
    const list = document.getElementById('notif-list');
    if (!list) return; // panel no existe o es GUEST

    if (_operatorChatNotifs.length === 0) {
        list.innerHTML = `
            <div style="text-align:center;padding:32px 16px;color:#94a3b8;">
                <i class="fas fa-comments" style="font-size:2rem;margin-bottom:10px;display:block;opacity:0.35;"></i>
                <span style="font-size:0.8rem;font-weight:600;">Sin mensajes nuevos</span>
                <p style="font-size:0.72rem;margin-top:6px;color:#cbd5e1;">Los mensajes de las plantas aparecerán aquí.</p>
            </div>`;
        return;
    }

    list.innerHTML = _operatorChatNotifs.map(n => {
        const bg = n.read ? 'white' : '#eff6ff';
        const border = n.read ? 'transparent' : '#3b82f6';
        const timeAgo = _timeAgoChat(n.ts);
        const preview = String(n.msg.mensaje || '').substring(0, 60) + (n.msg.mensaje?.length > 60 ? '...' : '');
        return `
            <div onclick="_openChatFromNotif('${n.idNovedad}','${(n.planta||'').replace(/'/g,"\\'")}','${(n.lote||'').replace(/'/g,"\\'")}','${n.id}')"
                style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;
                       background:${bg};border-left:3px solid ${border};
                       cursor:pointer;transition:background 0.15s;">
                <div style="width:32px;height:32px;border-radius:50%;
                    background:${n.read ? '#f1f5f9' : '#dbeafe'};border:1.5px solid ${n.read ? '#e2e8f0' : '#3b82f6'};
                    display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;">
                    <i class="fas fa-comments" style="color:${n.read ? '#94a3b8' : '#3b82f6'};font-size:0.75rem;"></i>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:0.78rem;color:#1e293b;margin-bottom:2px;">
                        Lote ${n.lote || 'S/N'}
                        ${n.planta ? `<span style="font-weight:500;color:#64748b;"> · ${n.planta}</span>` : ''}
                    </div>
                    <div style="font-size:0.72rem;color:#64748b;line-height:1.4;margin-bottom:3px;">${_escapeHtml(preview)}</div>
                    <div style="font-size:0.65rem;color:#94a3b8;">${timeAgo}</div>
                </div>
                ${!n.read ? `<div style="width:7px;height:7px;border-radius:50%;background:#3b82f6;flex-shrink:0;margin-top:6px;"></div>` : ''}
            </div>`;
    }).join('');
}

function _openChatFromNotif(idNovedad, planta, lote, notifId) {
    // Marcar como leída
    const n = _operatorChatNotifs.find(x => x.id === notifId);
    if (n) n.read = true;
    _updateOperatorBellBadge();
    // Cerrar panel
    const panel = document.getElementById('notif-panel');
    if (panel) panel.style.display = 'none';
    // Abrir chat
    openChat(idNovedad, planta, lote);
}

function _timeAgoChat(date) {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (diff < 60)    return 'Hace un momento';
    if (diff < 3600)  return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    return `Hace ${Math.floor(diff / 86400)} días`;
}

/* ══════════════════════════════════════════════════════════════════════════
   MÓDULO EXCLUSIVO GUEST — Panel de chats + polling
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Inicializa el sistema de chat para GUEST.
 * Llamado desde app.js después de loadUsers().
 * @param {Array} novedades — lista de novedades del GUEST
 */
function initGuestChat(novedades) {
    if (!currentUser || currentUser.ROL !== 'GUEST') return;
    _guestNovedades = novedades || [];
    try { const s = localStorage.getItem(GUEST_CHAT_KEY); if (s) _guestChatSeen = JSON.parse(s); } catch (_) {}
    _startGuestPoll();
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { if (_guestPollTimer) { clearInterval(_guestPollTimer); _guestPollTimer = null; } }
        else _startGuestPoll();
    });
}

function _startGuestPoll() {
    if (_guestPollTimer) clearInterval(_guestPollTimer);
    _pollGuestChats();
    const interval = _chatNovedadId ? GUEST_POLL_ACTIVE : GUEST_POLL_IDLE;
    _guestPollTimer = setInterval(_pollGuestChats, interval);
}

async function _pollGuestChats() {
    if (!_guestNovedades.length) return;
    const ids = new Set(_guestNovedades.map(n => n.ID_NOVEDAD).filter(Boolean));
    try {
        // Leer hoja CHAT directamente via Sheets API v4
        const allRows = await _readChatSheet();
        const latestByNov = {};
        allRows.forEach(r => {
            const novId = String(r[1] || '').trim();
            if (ids.has(novId)) {
                latestByNov[novId] = { id: r[0], rol: r[3], autor: r[4], mensaje: r[5], ts: r[6] };
            }
        });
        let unread = 0;
        for (const id of ids) {
            const lastMsg = latestByNov[id];
            if (!lastMsg) continue;
            if (lastMsg.rol !== 'GUEST' && lastMsg.ts !== _guestChatSeen[id]) {
                unread++;
                // Notificar via campana en lugar de toast flotante
                if (_chatNovedadId !== id) {
                    const nov = _guestNovedades.find(n => n.ID_NOVEDAD === id);
                    if (nov) _addChatNotification(nov, lastMsg);
                }
            }
        }
    } catch (_) {}
}

/**
 * Agrega una notificación de chat nuevo a la campana de notificaciones.
 * Evita duplicados por (idNovedad + ts del mensaje).
 */
function _addChatNotification(nov, msg) {
    if (typeof _notifications === 'undefined') return;
    const dedupKey = `chat_${nov.ID_NOVEDAD}_${msg.ts}`;
    if (_notifications.some(n => n.id === dedupKey)) return;
    _notifications.unshift({
        id: dedupKey,
        type: 'chat',
        nov,
        msg,
        ts: new Date(),
        read: false
    });
    if (_notifications.length > 30) _notifications = _notifications.slice(0, 30);
    // Actualizar badge y animar campana
    if (typeof _updateBellBadge === 'function') _updateBellBadge();
    const bellBtn = document.getElementById('notif-bell-btn');
    if (bellBtn) {
        bellBtn.classList.add('has-unread');
        bellBtn.addEventListener('animationend', () => bellBtn.classList.remove('has-unread'), { once: true });
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   UTILIDADES
   ══════════════════════════════════════════════════════════════════════════ */

function _isScrolledToBottom(el) { return el.scrollHeight - el.scrollTop - el.clientHeight < 60; }

function _formatTime(isoStr) {
    if (!isoStr) return '';
    try { return new Date(isoStr).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }); }
    catch (_) { return ''; }
}

function _formatDateLabel(isoStr) {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return 'Hoy';
        if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
        return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_) { return ''; }
}

function _escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}
