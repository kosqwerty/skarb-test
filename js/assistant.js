// ================================================================
// LMS Скарбниця — AI Помічник
// ================================================================

const Assistant = {
    _messages: [],
    _open: false,
    _storageKey() { return `assistant_history_${AppState.user?.id || 'guest'}`; },

    _saveHistory() {
        try { localStorage.setItem(this._storageKey(), JSON.stringify(this._messages.slice(-50))); } catch(_) {}
    },

    _loadHistory() {
        try { return JSON.parse(localStorage.getItem(this._storageKey()) || '[]'); } catch(_) { return []; }
    },

    init() {
        if (document.getElementById('ai-assistant-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'ai-assistant-panel';
        panel.innerHTML = `
            <div class="aip-header">
                <div class="aip-header-left">
                    <div class="aip-avatar"><img src="/icons/chat-bot.png" alt=""></div>
                    <div>
                        <div class="aip-title">Помічник Скарбниці</div>
                        <div class="aip-sub">Запитай про портал</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:.4rem">
                    <button class="aip-close" onclick="Assistant._clearHistory()" title="Очистити історію"><i class="fa-solid fa-trash-can" style="font-size:.8rem"></i></button>
                    <button class="aip-close" onclick="Assistant.toggle()">✕</button>
                </div>
            </div>
            <div class="aip-messages" id="aip-messages">
                <div class="aip-msg aip-msg-bot">
                    <div class="aip-msg-bubble">👋 Привіт! Я помічник порталу Скарбниця <br>Запитай мене про будь-який розділ або функцію.</div>
                </div>
            </div>
            <div class="aip-input-row">
                <textarea id="aip-input" placeholder="Запитай щось про портал..." rows="1"
                    onkeydown="Assistant._onKey(event)"></textarea>
                <button class="aip-send" id="aip-send" onclick="Assistant.send()">
                    <i class="fa-solid fa-paper-plane"></i>
                </button>
            </div>`;
        panel.addEventListener('click', e => e.stopPropagation());
        document.body.appendChild(panel);
        this._injectStyles();

        document.addEventListener('click', e => {
            if (!this._open) return;
            const b = document.getElementById('sidebar-assistant-btn');
            if (b && b.contains(e.target)) return;
            this.toggle();
        });


        // Завантажуємо збережену історію
        this._messages = this._loadHistory();
        if (this._messages.length) {
            const list = document.getElementById('aip-messages');
            if (list) {
                list.innerHTML = '';
                this._messages.forEach(m => this._addMsg(m.role === 'user' ? 'user' : 'bot', m.content));
            }
        }
    },

    toggle() {
        this._open = !this._open;
        const panel = document.getElementById('ai-assistant-panel');
        const btn   = document.getElementById('sidebar-assistant-btn');
        if (panel) panel.classList.toggle('open', this._open);
        if (btn) {
            btn.classList.toggle('active', this._open);
            const img = btn.querySelector('.sa-icon');
            const lbl = btn.querySelector('.sa-label');
            if (img) img.style.display = this._open ? 'none' : '';
            let closeIcon = btn.querySelector('.sa-close-icon');
            if (!closeIcon) { closeIcon = document.createElement('i'); closeIcon.className = 'fa-solid fa-xmark sa-close-icon'; closeIcon.style.cssText = 'font-size:1.2rem;color:var(--primary);flex-shrink:0'; btn.insertBefore(closeIcon, img); }
            closeIcon.style.display = this._open ? '' : 'none';
            if (lbl) lbl.textContent = this._open ? 'Закрити' : 'Помічник';
        }
        if (this._open) setTimeout(() => document.getElementById('aip-input')?.focus(), 200);
    },

    _updateRemaining(remaining) {
        if (remaining === null || remaining === undefined) return;
        const sub = document.querySelector('.aip-sub');
        if (sub) sub.textContent = remaining > 0
            ? `Залишилось запитів сьогодні: ${remaining}`
            : '⚠️ Ліміт вичерпано на сьогодні';
        const input = document.getElementById('aip-input');
        const send  = document.getElementById('aip-send');
        if (remaining <= 0) {
            if (input) input.disabled = true;
            if (send)  send.disabled = true;
        }
    },

    _clearHistory() {
        this._messages = [];
        localStorage.removeItem(this._storageKey());
        const list = document.getElementById('aip-messages');
        if (list) list.innerHTML = '<div class="aip-msg aip-msg-bot"><div class="aip-msg-bubble">👋 Привіт! Я помічник порталу Скарбниця.<br>Запитай мене про будь-який розділ або функцію.</div></div>';
    },

    _onKey(e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
    },

    async send() {
        const input = document.getElementById('aip-input');
        const text  = input?.value?.trim();
        if (!text) return;
        input.value = '';
        input.style.height = '';

        this._addMsg('user', text);
        this._messages.push({ role: 'user', content: text });

        const sendBtn = document.getElementById('aip-send');
        if (sendBtn) sendBtn.disabled = true;

        const typingId = this._addTyping();

        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/ask-assistant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ messages: this._messages }),
            });
            const data = await res.json();
            document.getElementById(typingId)?.remove();

            if (data.error) throw new Error(data.error);

            this._addMsg('bot', data.text);
            this._messages.push({ role: 'assistant', content: data.text });
            this._saveHistory();
            this._updateRemaining(data.remaining);
        } catch(e) {
            document.getElementById(typingId)?.remove();
            this._addMsg('bot', '⚠️ Помилка: ' + (e.message || 'сервіс недоступний'));
        } finally {
            if (sendBtn) sendBtn.disabled = false;
            input?.focus();
        }
    },

    _addMsg(role, text) {
        const list = document.getElementById('aip-messages');
        if (!list) return;
        const div = document.createElement('div');
        div.className = `aip-msg aip-msg-${role === 'user' ? 'user' : 'bot'}`;
        div.innerHTML = `<div class="aip-msg-bubble">${text.replace(/\n/g, '<br>')}</div>`;
        list.appendChild(div);
        list.scrollTop = list.scrollHeight;
        return div.id;
    },

    _addTyping() {
        const list = document.getElementById('aip-messages');
        if (!list) return;
        const id  = 'aip-typing-' + Date.now();
        const div = document.createElement('div');
        div.id = id;
        div.className = 'aip-msg aip-msg-bot';
        div.innerHTML = `<div class="aip-msg-bubble aip-typing"><span></span><span></span><span></span></div>`;
        list.appendChild(div);
        list.scrollTop = list.scrollHeight;
        return id;
    },

    _injectStyles() {
        const s = document.createElement('style');
        s.textContent = `
        #ai-assistant-panel {
            position: fixed; bottom: 80px; left: calc(var(--sidebar-w) + 78px); z-index: 499;
            width: 760px; max-height: 680px;
            background: var(--bg-surface); border: 1px solid var(--border);
            border-radius: 20px; box-shadow: 0 12px 48px rgba(0,0,0,.22), 0 2px 8px rgba(99,102,241,.12);
            display: flex; flex-direction: column; overflow: hidden;
            opacity: 0; transform: translateY(16px) scale(.96); pointer-events: none;
            transition: all .25s cubic-bezier(.34,1.3,.64,1);
        }
        #ai-assistant-panel.open { opacity: 1; transform: none; pointer-events: all; }
        @media (max-width: 1024px) {
            #ai-assistant-panel { left: 8px; right: 8px; width: auto; bottom: 70px; }
        }
        .aip-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: .9rem 1rem;
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 60%, #4338ca 100%);
            position: relative; overflow: hidden; flex-shrink: 0;
        }
        .aip-header::before {
            content: ''; position: absolute; top: -50%; right: -20px;
            width: 140px; height: 140px; border-radius: 50%;
            background: rgba(255,255,255,.07); pointer-events: none;
        }
        .aip-header::after {
            content: ''; position: absolute; bottom: -60%; left: 30%;
            width: 100px; height: 100px; border-radius: 50%;
            background: rgba(255,255,255,.05); pointer-events: none;
        }
        .aip-header-left { display: flex; align-items: center; gap: .7rem; position: relative; z-index: 1; }
        .aip-avatar {
            width: 42px; height: 42px; border-radius: 12px;
            background: rgba(255,255,255,.15); border: 2px solid rgba(255,255,255,.3);
            display: flex; align-items: center; justify-content: center;
            overflow: hidden; flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(0,0,0,.2);
        }
        .aip-avatar img { width: 34px; height: 34px; object-fit: contain; filter: drop-shadow(0 1px 3px rgba(0,0,0,.2)); }
        .aip-title { font-size: .9rem; font-weight: 700; color: #fff; }
        .aip-sub { font-size: .7rem; color: rgba(255,255,255,.7); display: flex; align-items: center; gap: .3rem; }
        .aip-sub::before { content:''; display:inline-block; width:6px; height:6px; border-radius:50%; background:#4ade80; box-shadow:0 0 0 2px rgba(74,222,128,.3); }
        .aip-close { background: none; border: none; cursor: pointer;
            color: rgba(255,255,255,.75); font-size: .9rem; padding: .3rem .45rem;
            border-radius: 8px; transition: background .15s, color .15s; line-height: 1;
            position: relative; z-index: 1; }
        .aip-close:hover { background: rgba(255,255,255,.15); color: #fff; }
        .aip-messages { flex: 1; overflow-y: auto; padding: .85rem; display: flex;
            flex-direction: column; gap: .6rem; scrollbar-width: thin; }
        .aip-msg { display: flex; }
        .aip-msg-user { justify-content: flex-end; }
        .aip-msg-bubble { max-width: 82%; padding: .55rem .85rem; border-radius: 14px;
            font-size: .85rem; line-height: 1.55; word-break: break-word; }
        .aip-msg-user .aip-msg-bubble { background: var(--primary); color: #fff;
            border-radius: 14px 4px 14px 14px; }
        .aip-msg-bot .aip-msg-bubble { background: var(--bg-raised); color: var(--text-primary);
            border: 1px solid var(--border); border-radius: 4px 14px 14px 14px; }
        .aip-typing { display: flex; gap: 5px; align-items: center; padding: .65rem .85rem; }
        .aip-typing span { width: 7px; height: 7px; border-radius: 50%;
            background: var(--text-muted); animation: aip-bounce .9s infinite; }
        .aip-typing span:nth-child(2) { animation-delay: .15s; }
        .aip-typing span:nth-child(3) { animation-delay: .30s; }
        @keyframes aip-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
        .aip-input-row { display: flex; gap: .5rem; padding: .75rem; border-top: 1px solid var(--border); }
        #aip-input { flex: 1; border: 1px solid var(--border); border-radius: 10px;
            padding: .5rem .75rem; font-size: .85rem; font-family: inherit;
            background: var(--bg-raised); color: var(--text-primary);
            resize: none; outline: none; max-height: 100px; overflow-y: auto;
            transition: border-color .15s; }
        #aip-input:focus { border-color: var(--primary); }
        .aip-send { width: 38px; height: 38px; border-radius: 10px; border: none;
            background: var(--primary); color: #fff; cursor: pointer; font-size: .9rem;
            display: flex; align-items: center; justify-content: center;
            transition: opacity .15s; flex-shrink: 0; align-self: flex-end; }
        .aip-send:hover { opacity: .85; }
        .aip-send:disabled { opacity: .45; cursor: not-allowed; }
        `;
        document.head.appendChild(s);
    },
};
