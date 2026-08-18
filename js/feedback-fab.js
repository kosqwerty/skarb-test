// ================================================================
// FeedbackFab — глобальна кнопка зворотного зв'язку (всі сторінки)
// ================================================================

const FeedbackFab = {
    _fbFiles:  [],
    _fbItems:  [],
    _fbCtx:    null,
    _fabTimer: null,
    _fbDraft:  null,

    init() {
        this._injectCSS();
        // Картка живе статично в index.html (у бічній панелі) — лише навішуємо обробники
        const card = document.getElementById('global-feedback-fab');
        if (!card || card.dataset.bound) { if (card) this._startPolling(); return; }
        card.dataset.bound = '1';
        card.onclick = () => FeedbackFab.open();
        this._startPolling();
    },

    open(extraCtx = {}) {
        document.getElementById('global-fb-modal')?.remove();
        this._fbFiles = [];
        clearTimeout(this._fabTimer);
        this._fbCtx = { route: (typeof Router !== 'undefined' ? Router.current() : ''), ua: navigator.userAgent, ...extraCtx };
        const fab = document.getElementById('global-feedback-fab');
        const badge = document.getElementById('sgfb-fab-badge');
        if (fab) fab.classList.remove('sgfb-fab-replied', 'sgfb-fab-shake');
        if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
        const el = document.createElement('div');
        el.id = 'global-fb-modal';
        el.className = 'sgfb-overlay';
        el.innerHTML = `<div class="sgfb-modal" id="sgfb-inner"><div style="display:flex;justify-content:center;align-items:center;height:260px"><div class="spinner"></div></div></div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) FeedbackFab._closeModal(); });
        el._pasteHandler = e => {
            const imgs = [...(e.clipboardData?.items||[])].filter(i => i.type.startsWith('image/'));
            if (imgs.length && document.getElementById('sgfb-msg')) {
                e.preventDefault();
                FeedbackFab._fbAddFiles(imgs.map(i => i.getAsFile()));
            }
        };
        document.addEventListener('paste', el._pasteHandler);
        // Sidebar navigation changes the URL hash without clicking the overlay — close on it too
        el._hashHandler = () => FeedbackFab._closeModal();
        window.addEventListener('hashchange', el._hashHandler);
        this._fbLoadAndRoute();
        // Resume polling after close
        const obs = new MutationObserver(() => {
            if (!document.getElementById('global-fb-modal')) {
                obs.disconnect();
                FeedbackFab._fabTimer = setTimeout(() => FeedbackFab._refreshFab(), 45000);
            }
        });
        obs.observe(document.body, { childList: true });
    },

    _closeModal() {
        const el = document.getElementById('global-fb-modal');
        if (!el) return;
        this._fbSaveDraft();
        if (el._pasteHandler) document.removeEventListener('paste', el._pasteHandler);
        if (el._hashHandler) window.removeEventListener('hashchange', el._hashHandler);
        el.remove();
    },

    _fbSaveDraft() {
        const msgEl = document.getElementById('sgfb-msg');
        if (!msgEl) return; // "new feedback" form isn't open — nothing to save
        const title   = document.getElementById('sgfb-title')?.value || '';
        const message = msgEl.value || '';
        const type    = document.getElementById('sgfb-type-sel')?.value || '';
        this._fbDraft = (title || message) ? { title, message, type } : null;
    },

    async _startPolling() {
        await this._refreshFab();
    },

    _markRead(itemId, repliedAt) {
        try { localStorage.setItem(`fb_read_${itemId}`, repliedAt || '1'); } catch(_) {}
    },

    _isUnread(item) {
        if (!item.reply) return false;
        try {
            const stored = localStorage.getItem(`fb_read_${item.id}`);
            return stored !== (item.replied_at || '1');
        } catch(_) { return true; }
    },

    async _refreshFab() {
        clearTimeout(this._fabTimer);
        try {
            const items = await API.feedback.getMine();
            const fab   = document.getElementById('global-feedback-fab');
            const badge = document.getElementById('sgfb-fab-badge');
            if (!fab || !badge) return;
            const wasReplied = fab.classList.contains('sgfb-fab-replied');
            const unread = items.filter(i => this._isUnread(i)).length;
            if (unread > 0) {
                badge.textContent = unread;
                badge.style.display = '';
                fab.classList.add('sgfb-fab-replied');
                if (!wasReplied) {
                    fab.classList.remove('sgfb-fab-shake');
                    void fab.offsetWidth;
                    fab.classList.add('sgfb-fab-shake');
                }
            } else {
                badge.style.display = 'none';
                fab.classList.remove('sgfb-fab-replied', 'sgfb-fab-shake');
            }
            this._fbItems = items;
        } catch(_) {}
        if (document.getElementById('global-feedback-fab')) {
            this._fabTimer = setTimeout(() => this._refreshFab(), 45000);
        }
    },

    async _fbLoadAndRoute() {
        try { this._fbItems = await API.feedback.getMine(); } catch(_) { this._fbItems = []; }
        const inner = document.getElementById('sgfb-inner');
        if (!inner) return;
        if (this._fbItems.length) this._fbRenderList(inner);
        else this._fbRenderNew(inner);
    },

    _fbRenderList(inner) {
        const typeIcon    = { bug:'🐛', suggestion:'💡', question:'❓', other:'💬' };
        const typeLabel   = { bug:'Помилка', suggestion:'Пропозиція', question:'Питання', other:'Інше' };
        const statusLabel = { new:'Нове', seen:'Переглянуто', in_progress:'В роботі', resolved:'Вирішено' };
        const statusCls   = { new:'sgfb-st-new', seen:'sgfb-st-seen', in_progress:'sgfb-st-prog', resolved:'sgfb-st-done' };
        inner.innerHTML = `
<div class="sgfb-hero">
    <div class="sgfb-hero-icon"><i class="fa-regular fa-comments"></i></div>
    <div>
        <div class="sgfb-hero-title">Мої звернення</div>
        <div class="sgfb-hero-sub">${this._fbItems.length} ${this._fbItems.length === 1 ? 'звернення' : 'звернень'}</div>
    </div>
    <button class="sgfb-close-btn" onclick="FeedbackFab._closeModal()"><i class="fa-solid fa-xmark"></i></button>
</div>
<div class="sgfb-body" style="padding:14px 18px 6px">
    <button class="sgfb-new-btn" onclick="FeedbackFab._fbGoNew()"><i class="fa-solid fa-plus"></i> Нове звернення</button>
    <div class="sgfb-list">
        ${this._fbItems.map((item, idx) => {
            const exp = new Date(new Date(item.created_at).getTime() + 365*24*3600*1000);
            const expStr = `${exp.getDate()}.${String(exp.getMonth()+1).padStart(2,'0')}.${exp.getFullYear()}`;
            return `
<div class="sgfb-item${item.reply ? ' sgfb-item-replied' : ''}" onclick="FeedbackFab._fbGoChat(${idx})">
    <div class="sgfb-item-type">${typeIcon[item.type]||'💬'}</div>
    <div class="sgfb-item-body">
        <div class="sgfb-item-title">${item.title ? Fmt.esc(item.title) : Fmt.esc(typeLabel[item.type]||'Звернення')}</div>
        <div class="sgfb-item-preview">${Fmt.esc(item.message.slice(0,65))}${item.message.length>65?'…':''}</div>
        <div class="sgfb-item-meta">${Fmt.date(item.created_at)} · до ${expStr}</div>
    </div>
    <div class="sgfb-item-right">
        <span class="sgfb-status ${statusCls[item.status]||''}">${statusLabel[item.status]||item.status}</span>
        ${item.reply ? '<div class="sgfb-reply-dot"><i class="fa-solid fa-reply"></i></div>' : ''}
        <i class="fa-solid fa-chevron-right sgfb-item-arr"></i>
    </div>
</div>`;
        }).join('')}
    </div>
</div>
<div class="sgfb-footer">
    <button class="sgfb-cancel-btn" style="flex:1;text-align:center" onclick="FeedbackFab._closeModal()">Закрити</button>
</div>`;
    },

    async _fbGoChat(idx) {
        const inner = document.getElementById('sgfb-inner');
        if (!inner) return;
        inner.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:260px"><div class="spinner"></div></div>`;
        const item = this._fbItems[idx];
        const messages = await API.feedback.getMessages(item.id).catch(() => []);
        // Resolve admin sender names
        const adminIds = [...new Set(messages.filter(m => m.sender_role === 'admin' && m.sender_id).map(m => m.sender_id))];
        const senderMap = {};
        if (adminIds.length) {
            const { data: profs } = await supabase.from('profiles').select('id,full_name').in('id', adminIds);
            (profs || []).forEach(p => { senderMap[p.id] = p.full_name; });
        }
        // Mark reply as read so badge clears permanently
        if (item.reply) this._markRead(item.id, item.replied_at);
        if (document.getElementById('sgfb-inner')) this._fbRenderChat(inner, item, idx, messages, senderMap);
    },

    _fbRenderChat(inner, item, idx, messages, senderMap = {}) {
        const typeIcon  = { bug:'🐛', suggestion:'💡', question:'❓', other:'💬' };
        const typeLabel = { bug:'Помилка', suggestion:'Пропозиція', question:'Питання', other:'Інше' };
        const subject   = item.title || typeLabel[item.type] || 'Звернення';
        const hasScreens = item.screenshot_urls?.length;
        const showFallbackReply = item.reply && !messages.length;
        const adminName = (sid) => Fmt.esc(senderMap[sid] || 'Адміністратор');
        inner.innerHTML = `
<div class="sgfb-hero">
    <button class="sgfb-back-btn" onclick="FeedbackFab._fbGoList()"><i class="fa-solid fa-arrow-left"></i></button>
    <div class="sgfb-hero-icon" style="font-size:1.2rem">${typeIcon[item.type]||'💬'}</div>
    <div style="min-width:0;flex:1">
        <div class="sgfb-hero-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Fmt.esc(subject)}</div>
        <div class="sgfb-hero-sub">${Fmt.date(item.created_at)}</div>
    </div>
    <button class="sgfb-close-btn" onclick="FeedbackFab._closeModal()"><i class="fa-solid fa-xmark"></i></button>
</div>
<div class="sgfb-chat-area" id="sgfb-chat-area">
    <div class="sgfb-bwrap sgfb-bwrap-user">
        <div class="sgfb-bubble sgfb-bubble-user">
            <div class="sgfb-bubble-text">${Fmt.esc(item.message)}</div>
            ${hasScreens ? `<div class="sgfb-bubble-imgs" id="sgfb-chat-imgs-${item.id}">${item.screenshot_urls.map((_,i)=>`<div class="sgfb-chat-img-ph" data-id="${item.id}" data-idx="${i}"><i class="fa-solid fa-image"></i></div>`).join('')}</div>` : ''}
            <div class="sgfb-bubble-time">${Fmt.datetime(item.created_at)}</div>
        </div>
        <div class="sgfb-avatar sgfb-avatar-user"><i class="fa-solid fa-user"></i></div>
    </div>
    ${messages.map(m => {
        const lines    = m.body.split('\n');
        const textPart = lines.filter(l => !l.startsWith('__IMG__:')).join('\n');
        const imgPaths = lines.filter(l => l.startsWith('__IMG__:')).map(l => l.slice(8));
        const imgHtml  = imgPaths.length ? `<div class="sgfb-bubble-imgs" id="sgfb-msg-imgs-${m.id}">${imgPaths.map((_,i)=>`<div class="sgfb-chat-img-ph" data-mid="${m.id}" data-idx="${i}"><i class="fa-solid fa-image"></i></div>`).join('')}</div>` : '';
        return m.sender_role === 'admin' ? `
    <div class="sgfb-bwrap sgfb-bwrap-admin">
        <div class="sgfb-avatar sgfb-avatar-admin"><i class="fa-solid fa-headset"></i></div>
        <div>
            <div class="sgfb-admin-label">${adminName(m.sender_id)}</div>
            <div class="sgfb-bubble sgfb-bubble-admin">
                ${textPart ? `<div class="sgfb-bubble-text">${Fmt.esc(textPart)}</div>` : ''}
                ${imgHtml}
                <div class="sgfb-bubble-time">${Fmt.datetime(m.created_at)}</div>
            </div>
        </div>
    </div>` : `
    <div class="sgfb-bwrap sgfb-bwrap-user">
        <div class="sgfb-bubble sgfb-bubble-user">
            ${textPart ? `<div class="sgfb-bubble-text">${Fmt.esc(textPart)}</div>` : ''}
            ${imgHtml}
            <div class="sgfb-bubble-time">${Fmt.datetime(m.created_at)}</div>
        </div>
        <div class="sgfb-avatar sgfb-avatar-user"><i class="fa-solid fa-user"></i></div>
    </div>`;
    }).join('')}
    ${showFallbackReply ? `
    <div class="sgfb-bwrap sgfb-bwrap-admin">
        <div class="sgfb-avatar sgfb-avatar-admin"><i class="fa-solid fa-headset"></i></div>
        <div>
            <div class="sgfb-admin-label">Адміністратор</div>
            <div class="sgfb-bubble sgfb-bubble-admin">
                <div class="sgfb-bubble-text">${Fmt.esc(item.reply)}</div>
                <div class="sgfb-bubble-time">${Fmt.datetime(item.replied_at)}</div>
            </div>
        </div>
    </div>` : ''}
    ${!messages.length && !item.reply ? `<div class="sgfb-pending"><i class="fa-regular fa-clock"></i> Відповідь очікується…</div>` : ''}
</div>
<div class="sgfb-chat-input">
    <textarea id="sgfb-reply-msg" class="sgfb-reply-ta" placeholder="Написати повідомлення… (Ctrl+Enter — надіслати)" rows="2"
        onkeydown="if(event.ctrlKey&&event.key==='Enter'){event.preventDefault();FeedbackFab._fbSendMessage('${item.id}',${idx})}"></textarea>
    <button class="sgfb-reply-send" onclick="FeedbackFab._fbSendMessage('${item.id}',${idx})" title="Надіслати">
        <i class="fa-solid fa-paper-plane"></i>
    </button>
</div>
<div class="sgfb-footer">
    <button class="sgfb-del-btn" onclick="FeedbackFab._fbDelete('${item.id}',${idx})"><i class="fa-solid fa-trash"></i> Видалити</button>
    <button class="sgfb-cancel-btn" style="flex:1;text-align:center" onclick="FeedbackFab._fbGoList()">← Назад</button>
</div>`;
        if (hasScreens) this._fbLoadChatImgs(item);
        const msgsWithImgs = messages.filter(m => m.body.includes('__IMG__:'));
        if (msgsWithImgs.length) this._fbLoadMsgImgs(msgsWithImgs);
        setTimeout(() => { const a = document.getElementById('sgfb-chat-area'); if (a) a.scrollTop = a.scrollHeight; }, 50);
    },

    _fbGoList() { const inner = document.getElementById('sgfb-inner'); if (inner) this._fbRenderList(inner); },
    _fbGoNew()  { this._fbFiles = []; const inner = document.getElementById('sgfb-inner'); if (inner) this._fbRenderNew(inner); },

    _fbRenderNew(inner) {
        const hasBack = this._fbItems.length > 0;
        inner.innerHTML = `
<div class="sgfb-hero">
    ${hasBack ? `<button class="sgfb-back-btn" onclick="FeedbackFab._fbGoList()"><i class="fa-solid fa-arrow-left"></i></button>` : ''}
    <div class="sgfb-hero-icon"><i class="fa-regular fa-comment-dots"></i></div>
    <div>
        <div class="sgfb-hero-title">Зворотний зв'язок</div>
        <div class="sgfb-hero-sub">Повідомте про проблему або пропозицію</div>
    </div>
    <button class="sgfb-close-btn" onclick="FeedbackFab._closeModal()"><i class="fa-solid fa-xmark"></i></button>
</div>
<div class="sgfb-body">
    <div class="sgfb-form-group">
        <label class="sgfb-field-lbl" for="sgfb-type-trigger">Тип звернення <span class="sgfb-field-req">*</span></label>
        <div class="sgfb-select-wrap">
            <button type="button" class="sgfb-select-trigger" id="sgfb-type-trigger" data-empty="true" onclick="FeedbackFab._fbToggleTypeMenu()">
                <span class="sgfb-select-trigger-icon" id="sgfb-type-trigger-icon"><i class="fa-regular fa-square-caret-down"></i></span>
                <span class="sgfb-select-trigger-label" id="sgfb-type-trigger-label">Оберіть тип звернення…</span>
                <i class="fa-solid fa-chevron-down sgfb-select-caret"></i>
            </button>
            <div class="sgfb-select-menu" id="sgfb-type-menu" hidden>
                <button type="button" class="sgfb-select-opt" data-type="bug" data-label="Помилка" data-icon="fa-solid fa-bug" style="--opt-c:#ef4444" onclick="FeedbackFab._fbPickType(this)">
                    <span class="sgfb-opt-ico"><i class="fa-solid fa-bug"></i></span>
                    <span class="sgfb-opt-text"><span class="sgfb-opt-title">Помилка</span><span class="sgfb-opt-sub">Щось працює не так, як очікувалось</span></span>
                    <i class="fa-solid fa-check sgfb-opt-check"></i>
                </button>
                <button type="button" class="sgfb-select-opt" data-type="suggestion" data-label="Пропозиція" data-icon="fa-solid fa-lightbulb" style="--opt-c:#f59e0b" onclick="FeedbackFab._fbPickType(this)">
                    <span class="sgfb-opt-ico"><i class="fa-solid fa-lightbulb"></i></span>
                    <span class="sgfb-opt-text"><span class="sgfb-opt-title">Пропозиція</span><span class="sgfb-opt-sub">Ідея, як зробити краще</span></span>
                    <i class="fa-solid fa-check sgfb-opt-check"></i>
                </button>
                <button type="button" class="sgfb-select-opt" data-type="question" data-label="Питання" data-icon="fa-solid fa-circle-question" style="--opt-c:#0ea5e9" onclick="FeedbackFab._fbPickType(this)">
                    <span class="sgfb-opt-ico"><i class="fa-solid fa-circle-question"></i></span>
                    <span class="sgfb-opt-text"><span class="sgfb-opt-title">Питання</span><span class="sgfb-opt-sub">Не зрозуміло, як щось працює</span></span>
                    <i class="fa-solid fa-check sgfb-opt-check"></i>
                </button>
                <button type="button" class="sgfb-select-opt" data-type="other" data-label="Інше" data-icon="fa-solid fa-comment-dots" style="--opt-c:#8b5cf6" onclick="FeedbackFab._fbPickType(this)">
                    <span class="sgfb-opt-ico"><i class="fa-solid fa-comment-dots"></i></span>
                    <span class="sgfb-opt-text"><span class="sgfb-opt-title">Інше</span><span class="sgfb-opt-sub">Щось, що не підходить під інші варіанти</span></span>
                    <i class="fa-solid fa-check sgfb-opt-check"></i>
                </button>
            </div>
            <input type="hidden" id="sgfb-type-sel" value="">
        </div>
    </div>
    <div class="sgfb-form-group">
        <label class="sgfb-field-lbl" for="sgfb-title">Заголовок <span class="sgfb-field-opt">(необов'язково)</span></label>
        <input id="sgfb-title" class="sgfb-input" placeholder="Коротко про суть…" autocomplete="off" disabled>
    </div>
    <div class="sgfb-form-group">
        <label class="sgfb-field-lbl" for="sgfb-msg">Опис <span class="sgfb-field-req">*</span></label>
        <textarea id="sgfb-msg" class="sgfb-textarea" placeholder="Спочатку оберіть тип звернення вище…" rows="5" disabled></textarea>
    </div>
    <div class="sgfb-form-group" style="margin-bottom:0">
        <label class="sgfb-field-lbl">Скриншоти</label>
        <div id="sgfb-drop" class="sgfb-drop sgfb-drop-disabled" ondragover="event.preventDefault()" ondrop="FeedbackFab._fbDrop(event)">
            <i class="fa-solid fa-cloud-arrow-up sgfb-drop-icon"></i>
            <div class="sgfb-drop-text">
                Перетягніть або <label for="sgfb-file" class="sgfb-browse">оберіть файл</label>
            </div>
            <div class="sgfb-drop-hint">PNG, JPG · до 4 файлів · або Ctrl+V</div>
            <input type="file" id="sgfb-file" accept="image/*" multiple style="display:none" onchange="FeedbackFab._fbAddFiles(this.files)" disabled>
        </div>
        <div id="sgfb-previews" class="sgfb-previews"></div>
    </div>
</div>
<div class="sgfb-footer">
    <button class="sgfb-send-btn" id="sgfb-send-btn" onclick="FeedbackFab._submitFeedback()">
        <i class="fa-solid fa-paper-plane"></i> Надіслати
    </button>
    ${hasBack
        ? `<button class="sgfb-cancel-btn" onclick="FeedbackFab._fbGoList()">Скасувати</button>`
        : `<button class="sgfb-cancel-btn" onclick="FeedbackFab._closeModal()">Скасувати</button>`}
</div>`;
        if (this._fbDraft) {
            const t = document.getElementById('sgfb-title');
            const m = document.getElementById('sgfb-msg');
            if (t) t.value = this._fbDraft.title;
            if (m) m.value = this._fbDraft.message;
            if (this._fbDraft.type) this._fbApplyType(this._fbDraft.type, false);
        }
        setTimeout(() => document.getElementById(this._fbDraft?.type ? 'sgfb-msg' : 'sgfb-type-trigger')?.focus(), 50);
    },

    _fbToggleTypeMenu() {
        const menu = document.getElementById('sgfb-type-menu');
        const trigger = document.getElementById('sgfb-type-trigger');
        if (!menu) return;
        const show = menu.hasAttribute('hidden');
        if (show) {
            menu.removeAttribute('hidden');
            trigger?.classList.add('open');
            setTimeout(() => document.addEventListener('click', FeedbackFab._fbTypeOutside), 0);
        } else {
            menu.setAttribute('hidden', '');
            trigger?.classList.remove('open');
        }
    },

    _fbTypeOutside(e) {
        const wrap = document.querySelector('.sgfb-select-wrap');
        if (wrap && !wrap.contains(e.target)) {
            document.getElementById('sgfb-type-menu')?.setAttribute('hidden', '');
            document.getElementById('sgfb-type-trigger')?.classList.remove('open');
            document.removeEventListener('click', FeedbackFab._fbTypeOutside);
        }
    },

    _fbPickType(btn) { this._fbApplyType(btn.dataset.type, true); },

    // Поки не обрано тип звернення — заголовок/опис/скриншоти заблоковані,
    // щоб людина спочатку визначилась, про що пише (а не почала друкувати
    // й лише потім згадала обрати тип).
    _fbApplyType(type, closeMenu) {
        const optBtn = document.querySelector(`.sgfb-select-opt[data-type="${type}"]`);
        if (!optBtn) return;
        const hidden = document.getElementById('sgfb-type-sel');
        if (hidden) hidden.value = type;
        const trigger     = document.getElementById('sgfb-type-trigger');
        const triggerIcon = document.getElementById('sgfb-type-trigger-icon');
        const triggerLbl  = document.getElementById('sgfb-type-trigger-label');
        if (triggerIcon) { triggerIcon.innerHTML = `<i class="${optBtn.dataset.icon}"></i>`; triggerIcon.style.color = optBtn.style.getPropertyValue('--opt-c'); triggerIcon.style.background = `color-mix(in srgb, ${optBtn.style.getPropertyValue('--opt-c')} 16%, transparent)`; }
        if (triggerLbl) triggerLbl.textContent = optBtn.dataset.label;
        trigger?.setAttribute('data-empty', 'false');
        trigger?.classList.remove('invalid');
        document.querySelectorAll('.sgfb-select-opt').forEach(o => o.classList.toggle('active', o === optBtn));
        if (closeMenu) {
            document.getElementById('sgfb-type-menu')?.setAttribute('hidden', '');
            trigger?.classList.remove('open');
            document.removeEventListener('click', FeedbackFab._fbTypeOutside);
        }

        const title = document.getElementById('sgfb-title');
        const msg   = document.getElementById('sgfb-msg');
        const file  = document.getElementById('sgfb-file');
        const drop  = document.getElementById('sgfb-drop');
        if (title) title.disabled = false;
        if (msg)   msg.disabled   = false;
        if (file)  file.disabled  = false;
        if (drop)  drop.classList.remove('sgfb-drop-disabled');
        if (closeMenu) msg?.focus();
    },
    _fbDrop(e)   { e.preventDefault(); this._fbAddFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('image/'))); },

    _fbAddFiles(files) {
        [...files].slice(0, 4 - this._fbFiles.length).forEach(file => {
            if (!file || this._fbFiles.length >= 4) return;
            const id = Date.now() + Math.random();
            this._fbFiles.push({ id, file });
            const reader = new FileReader();
            reader.onload = ev => {
                const prev = document.getElementById('sgfb-previews');
                if (!prev) return;
                const item = document.createElement('div');
                item.className = 'sgfb-prev-item';
                item.dataset.id = id;
                item.innerHTML = `<img src="${ev.target.result}" class="sgfb-prev-img" alt=""><button class="sgfb-prev-rm" onclick="FeedbackFab._fbRemoveFile(${id})">✕</button>`;
                prev.appendChild(item);
            };
            reader.readAsDataURL(file);
        });
    },

    _fbRemoveFile(id) {
        this._fbFiles = this._fbFiles.filter(f => f.id !== id);
        document.querySelector(`.sgfb-prev-item[data-id="${id}"]`)?.remove();
    },

    async _submitFeedback() {
        const type = document.getElementById('sgfb-type-sel')?.value;
        if (!type) {
            const trigger = document.getElementById('sgfb-type-trigger');
            trigger?.classList.add('invalid');
            trigger?.focus();
            setTimeout(() => trigger?.classList.remove('invalid'), 900);
            return;
        }
        const msg = document.getElementById('sgfb-msg')?.value.trim();
        if (!msg) { const t = document.getElementById('sgfb-msg'); t.style.borderColor='#ef4444'; t.focus(); return; }
        const title = document.getElementById('sgfb-title')?.value.trim() || '';
        const btn   = document.getElementById('sgfb-send-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Надсилання…'; }
        try {
            const paths = [];
            for (const { file } of this._fbFiles) {
                try { const { path } = await API.feedback.uploadScreenshot(file); if (path) paths.push(path); } catch(e) { console.error('[feedback] upload:', e); }
            }
            await API.feedback.submit({ type, priority: 'medium', title, message: msg, screenshotUrls: paths, context: this._fbCtx || {} });
            this._fbFiles = [];
            this._fbDraft = null;
            try { const audio = new Audio('/sound/support.mp3'); audio.volume = 0.6; audio.play().catch(() => {}); } catch(e) {}
            Toast.success('Дякуємо!', 'Звернення надіслано адміністратору');
            this._fbItems = await API.feedback.getMine().catch(() => []);
            const inner = document.getElementById('sgfb-inner');
            if (inner && this._fbItems.length) this._fbRenderList(inner);
            else this._closeModal();
        } catch(e) {
            Toast.error('Помилка', e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Надіслати'; }
        }
    },

    async _fbSendMessage(feedbackId, idx) {
        const ta = document.getElementById('sgfb-reply-msg');
        const body = ta?.value.trim();
        if (!body) { if (ta) { ta.style.borderColor='#ef4444'; ta.focus(); } return; }
        const btn = document.querySelector('.sgfb-reply-send');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
        try {
            await API.feedback.sendMessage(feedbackId, body);
            try { const audio = new Audio('/sound/send_sms.mp3'); audio.volume = 0.6; audio.play().catch(() => {}); } catch(e) {}
            await this._fbGoChat(idx);
        } catch(e) {
            Toast.error('Помилка', e.message);
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>'; }
        }
    },

    async _fbDelete(id, idx) {
        const ok = await Modal.confirm({ message: 'Видалити це звернення?', confirmText: 'Видалити', danger: true });
        if (!ok) return;
        try {
            await API.feedback.remove(id);
            this._fbItems.splice(idx, 1);
            const inner = document.getElementById('sgfb-inner');
            if (!inner) return;
            if (this._fbItems.length) this._fbRenderList(inner);
            else this._closeModal();
            Toast.success('Видалено');
        } catch(e) { Toast.error('Помилка', e.message); }
    },

    async _fbLoadChatImgs(item) {
        for (let i = 0; i < item.screenshot_urls.length; i++) {
            const ph = document.querySelector(`.sgfb-chat-img-ph[data-id="${item.id}"][data-idx="${i}"]`);
            if (!ph) continue;
            try {
                const { data } = await supabase.storage.from('feedback-screenshots').createSignedUrl(item.screenshot_urls[i], 3600);
                if (data?.signedUrl) {
                    const img = document.createElement('img');
                    img.src = data.signedUrl; img.className = 'sgfb-chat-img'; img.alt = 'зображення';
                    img.onclick = () => FeedbackFab._fbViewImg(data.signedUrl);
                    ph.replaceWith(img);
                }
            } catch(_) {}
        }
    },

    async _fbLoadMsgImgs(messages) {
        for (const m of messages) {
            const paths = m.body.split('\n').filter(l => l.startsWith('__IMG__:')).map(l => l.slice(8));
            for (let i = 0; i < paths.length; i++) {
                const ph = document.querySelector(`.sgfb-chat-img-ph[data-mid="${m.id}"][data-idx="${i}"]`);
                if (!ph) continue;
                try {
                    const { data } = await supabase.storage.from('feedback-screenshots').createSignedUrl(paths[i], 3600);
                    if (!data?.signedUrl) continue;
                    const img = document.createElement('img');
                    img.src = data.signedUrl; img.className = 'sgfb-chat-img'; img.alt = 'зображення';
                    img.onclick = () => FeedbackFab._fbViewImg(data.signedUrl);
                    ph.replaceWith(img);
                } catch(_) {}
            }
        }
    },

    _fbViewImg(url) {
        document.getElementById('sgfb-img-viewer')?.remove();
        const el = document.createElement('div');
        el.id = 'sgfb-img-viewer';
        el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:870;display:flex;align-items:center;justify-content:center;cursor:zoom-out;animation:fadeIn .15s';
        el.innerHTML = `<img src="${Fmt.safeUrl(url)}" style="max-width:92vw;max-height:90vh;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.6);pointer-events:none">
            <button style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);color:#fff;width:36px;height:36px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center" onclick="document.getElementById('sgfb-img-viewer').remove()"><i class="fa-solid fa-xmark"></i></button>`;
        el.onclick = e => { if (e.target === el) el.remove(); };
        document.body.appendChild(el);
    },

    _injectCSS() {
        if (document.getElementById('sgfb-global-styles')) return;
        const s = document.createElement('style');
        s.id = 'sgfb-global-styles';
        s.textContent = `
@keyframes sgfb-slide-in { from{transform:translateX(-100%)} to{transform:translateX(0)} }
@keyframes sgfb-fab-vibrate { 0%,100%{transform:translateX(0)} 10%,50%,90%{transform:translateX(-4px)} 30%,70%{transform:translateX(4px)} }

/* ── Картка "Підтримка" в бічній панелі ─────────────────────────── */
.sb-feedback-card {
    margin:10px 12px 14px;padding:12px 13px;border-radius:14px;flex-shrink:0;position:relative;
    background:linear-gradient(160deg,rgba(99,102,241,.14),rgba(139,92,246,.08));
    border:1px solid rgba(99,102,241,.28);cursor:pointer;transition:border-color .18s,transform .18s;
}
.sb-feedback-card:hover { border-color:rgba(99,102,241,.5);transform:translateY(-1px); }
.sb-fc-top { display:flex;align-items:center;gap:9px;margin-bottom:10px; }
.sb-fc-ico {
    width:32px;height:32px;border-radius:10px;flex-shrink:0;position:relative;
    background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;
    display:flex;align-items:center;justify-content:center;font-size:.85rem;
    box-shadow:0 3px 10px rgba(99,102,241,.4);
}
.sb-fc-txt { min-width:0; }
.sb-fc-title { font-size:.82rem;font-weight:700;color:#fff;line-height:1.2; }
.sb-fc-sub   { font-size:.7rem;color:rgba(255,255,255,.55);margin-top:1px;line-height:1.25; }
.sb-fc-btn {
    display:block;width:100%;padding:8px;border-radius:9px;border:none;cursor:pointer;
    background:#fff;color:#1e1b3a;font-size:.78rem;font-weight:700;font-family:inherit;
    transition:opacity .15s;
}
.sb-fc-btn:hover { opacity:.9; }
.sidebar.collapsed .sb-feedback-card { display:none; }
/* Стан "є відповідь" — зелена акцентна іконка + бейдж */
.sb-feedback-card.sgfb-fab-replied .sb-fc-ico {
    background:linear-gradient(135deg,#059669,#10b981);box-shadow:0 3px 10px rgba(16,185,129,.45);
}
.sb-feedback-card.sgfb-fab-replied { border-color:rgba(16,185,129,.4); }
.sb-feedback-card.sgfb-fab-shake .sb-fc-ico { animation:sgfb-fab-vibrate .6s ease; }
.sgfb-fab-badge {
    position:absolute;top:8px;right:10px;min-width:18px;height:18px;padding:0 5px;
    border-radius:9px;background:#ef4444;color:#fff;font-size:.65rem;font-weight:700;
    line-height:18px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.3);
}
/* ── Світла тема — сайдбар білий, тож текст/кнопку інвертуємо ──── */
.light-theme .sb-feedback-card {
    background:linear-gradient(160deg,rgba(99,102,241,.09),rgba(139,92,246,.05));
    border-color:rgba(99,102,241,.22);
}
.light-theme .sb-feedback-card:hover { border-color:rgba(99,102,241,.4); }
.light-theme .sb-fc-title { color:#1e293b; }
.light-theme .sb-fc-sub   { color:#64748b; }
.light-theme .sb-fc-btn {
    background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;
    box-shadow:0 2px 8px rgba(99,102,241,.3);
}
.light-theme .sb-feedback-card.sgfb-fab-replied { border-color:rgba(16,185,129,.35); }
.light-theme .sb-feedback-card.sgfb-fab-replied .sb-fc-btn {
    background:linear-gradient(135deg,#059669,#10b981);box-shadow:0 2px 8px rgba(16,185,129,.3);
}
.sgfb-overlay {
    position:fixed;top:64px;left:0;right:0;bottom:0;background:rgba(0,0,0,.35);z-index:190;
    display:flex;justify-content:flex-start;backdrop-filter:blur(2px);animation:fadeIn .2s;
}
.sgfb-modal {
    width:480px;max-width:calc(100vw - var(--sidebar-w));height:100%;
    margin-left:var(--sidebar-w);
    background:var(--bg-surface);border-right:1px solid var(--border);
    padding:0;overflow:hidden;display:flex;flex-direction:column;
    animation:sgfb-slide-in .25s cubic-bezier(.32,0,.67,0);
    box-shadow:8px 0 32px rgba(0,0,0,.18);
    transition:margin-left .3s var(--transition-slow, ease);
}
body.sidebar-collapsed .sgfb-modal { margin-left:var(--sidebar-w-col); max-width:calc(100vw - var(--sidebar-w-col)); }
@media (max-width:1024px) {
    .sgfb-overlay { justify-content:flex-end; }
    .sgfb-modal { margin-left:0;max-width:100vw;width:min(480px,100vw);border-right:none;border-left:1px solid var(--border); }
    body.sidebar-collapsed .sgfb-modal { margin-left:0;max-width:100vw; }
}
.sgfb-hero {
    display:flex;align-items:center;gap:12px;padding:18px 18px 16px;
    background:linear-gradient(135deg,#6366f1,#8b5cf6);position:relative;flex-shrink:0;
}
.sgfb-hero-icon {
    width:40px;height:40px;border-radius:11px;flex-shrink:0;font-size:1.2rem;
    background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.25);
    display:flex;align-items:center;justify-content:center;color:#fff;
}
.sgfb-hero-title { font-size:.95rem;font-weight:700;color:#fff;margin:0; }
.sgfb-hero-sub   { font-size:.75rem;color:rgba(255,255,255,.72);margin:2px 0 0; }
.sgfb-close-btn {
    margin-left:auto;flex-shrink:0;width:30px;height:30px;border-radius:8px;cursor:pointer;
    background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.25);color:#fff;
    display:flex;align-items:center;justify-content:center;font-size:.85rem;transition:background .15s;
}
.sgfb-close-btn:hover { background:rgba(255,255,255,.3);border-color:rgba(255,255,255,.4); }
.sgfb-back-btn {
    width:32px;height:32px;border-radius:8px;border:1.5px solid rgba(255,255,255,.3);
    background:rgba(255,255,255,.15);color:#fff;cursor:pointer;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;font-size:.85rem;transition:background .15s;
}
.sgfb-back-btn:hover { background:rgba(255,255,255,.28); }
.sgfb-body { padding:16px 18px 6px;overflow-y:auto;flex:1; }
.sgfb-new-btn {
    width:100%;padding:10px;border-radius:10px;border:2px dashed var(--border);
    background:transparent;color:var(--primary);font-size:.875rem;font-weight:600;
    cursor:pointer;transition:all .15s;margin-bottom:12px;
    display:flex;align-items:center;justify-content:center;gap:7px;
}
.sgfb-new-btn:hover { border-color:var(--primary);background:rgba(99,102,241,.05); }
.sgfb-list { display:flex;flex-direction:column;gap:8px; }
.sgfb-item {
    display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;
    border:1.5px solid var(--border);background:var(--bg-surface);cursor:pointer;transition:all .15s;
}
.sgfb-item:hover { border-color:var(--primary);background:var(--bg-hover); }
.sgfb-item-replied { border-color:rgba(99,102,241,.35);background:rgba(99,102,241,.04); }
.sgfb-item-type { font-size:1.4rem;flex-shrink:0; }
.sgfb-item-body { flex:1;min-width:0; }
.sgfb-item-title { font-size:.875rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.sgfb-item-preview { font-size:.78rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px; }
.sgfb-item-meta { font-size:.7rem;color:var(--text-muted);margin-top:4px;opacity:.7; }
.sgfb-item-right { display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0; }
.sgfb-status { font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap; }
.sgfb-st-new  { background:rgba(59,130,246,.12);color:#3b82f6; }
.sgfb-st-seen { background:rgba(107,114,128,.1);color:#6b7280; }
.sgfb-st-prog { background:rgba(245,158,11,.12);color:#d97706; }
.sgfb-st-done { background:rgba(16,185,129,.12);color:#059669; }
.sgfb-reply-dot { font-size:.7rem;color:#6366f1; }
.sgfb-item-arr { font-size:.7rem;color:var(--text-muted);opacity:.4; }
/* ── Custom "type" dropdown ──────────────────────────────────────── */
.sgfb-select-wrap { position:relative; }
.sgfb-select-trigger {
    width:100%;display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;
    border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);
    font-family:inherit;font-size:.875rem;cursor:pointer;text-align:left;box-sizing:border-box;
    transition:border-color .18s,box-shadow .18s;
}
.sgfb-select-trigger:hover { border-color:#8385f0; }
.sgfb-select-trigger.open,
.sgfb-select-trigger:focus-visible { border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.14);outline:none; }
.sgfb-select-trigger.invalid { border-color:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.14);animation:sgfbShake .35s; }
@keyframes sgfbShake { 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }
.sgfb-select-trigger-icon {
    width:26px;height:26px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
    background:var(--bg-hover);color:var(--text-muted);font-size:.8rem;transition:background .18s,color .18s;
}
.sgfb-select-trigger-label { flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.sgfb-select-trigger[data-empty="true"] .sgfb-select-trigger-label { color:var(--text-muted); }
.sgfb-select-caret { font-size:.68rem;color:var(--text-muted);transition:transform .2s;flex-shrink:0; }
.sgfb-select-trigger.open .sgfb-select-caret { transform:rotate(180deg); }

.sgfb-select-menu {
    position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:20;
    background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;
    box-shadow:0 14px 34px rgba(0,0,0,.3);padding:6px;
    display:flex;flex-direction:column;gap:2px;
    animation:sgfbMenuIn .15s cubic-bezier(.4,0,.2,1);
}
/* .sgfb-select-menu{display:flex} — це author-правило класу, тож завжди
   перебиває UA-стиль [hidden]{display:none} (найнижчий пріоритет у каскаді
   незалежно від специфічності), і атрибут hidden не приховує меню. Явно
   повертаємо йому пріоритет. */
.sgfb-select-menu[hidden] { display:none; }
@keyframes sgfbMenuIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
.sgfb-select-opt {
    display:flex;align-items:center;gap:10px;padding:8px 9px;border-radius:8px;border:none;
    background:transparent;cursor:pointer;font-family:inherit;text-align:left;width:100%;box-sizing:border-box;
    transition:background .13s;
}
.sgfb-select-opt:hover { background:var(--bg-hover); }
.sgfb-select-opt.active { background:color-mix(in srgb, var(--opt-c) 10%, transparent); }
.sgfb-opt-ico {
    width:30px;height:30px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
    background:color-mix(in srgb, var(--opt-c) 16%, transparent);color:var(--opt-c);font-size:.85rem;
}
.sgfb-opt-text { display:flex;flex-direction:column;gap:1px;min-width:0; }
.sgfb-opt-title { font-size:.85rem;font-weight:600;color:var(--text-primary); }
.sgfb-opt-sub { font-size:.71rem;color:var(--text-muted); }
.sgfb-opt-check { margin-left:auto;font-size:.7rem;color:var(--opt-c);opacity:0;flex-shrink:0;transition:opacity .13s; }
.sgfb-select-opt.active .sgfb-opt-check { opacity:1; }

.sgfb-input:disabled, .sgfb-textarea:disabled, #sgfb-file:disabled {
    opacity:.5;cursor:not-allowed;background:var(--bg-hover);
}
.sgfb-drop-disabled { opacity:.5;pointer-events:none; }
.sgfb-form-group { margin-bottom:14px; }
.sgfb-field-lbl { display:block;font-size:.72rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em; }
.sgfb-field-opt { font-weight:400;opacity:.6;text-transform:none;letter-spacing:0; }
.sgfb-field-req { color:#ef4444; }
.sgfb-input {
    width:100%;padding:10px 13px;border-radius:10px;border:1.5px solid var(--border);
    background:var(--bg-surface);color:var(--text-primary);font-family:inherit;font-size:.875rem;
    box-sizing:border-box;transition:border-color .2s,box-shadow .2s;outline:none;
}
.sgfb-input:focus { border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.12); }
.sgfb-input::placeholder { color:var(--text-muted);opacity:.7; }
.sgfb-textarea {
    width:100%;resize:vertical;padding:10px 13px;border-radius:10px;border:1.5px solid var(--border);
    background:var(--bg-surface);color:var(--text-primary);font-family:inherit;font-size:.875rem;
    line-height:1.55;box-sizing:border-box;min-height:100px;transition:border-color .2s,box-shadow .2s;outline:none;
}
.sgfb-textarea:focus { border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.12); }
.sgfb-textarea::placeholder { color:var(--text-muted);opacity:.7; }
.sgfb-drop {
    border:2px dashed var(--border);border-radius:12px;padding:22px 16px 18px;text-align:center;
    cursor:pointer;transition:border-color .18s,background .18s;
    background:var(--bg-hover);
}
.sgfb-drop:hover { border-color:#6366f1;background:rgba(99,102,241,.04); }
.sgfb-drop-icon { font-size:1.5rem;color:var(--text-muted);opacity:.6;display:block;margin-bottom:8px; }
.sgfb-drop-text { font-size:.82rem;color:var(--text-secondary);margin-bottom:3px; }
.sgfb-drop-hint { font-size:.72rem;color:var(--text-muted);opacity:.6; }
.sgfb-browse { color:#6366f1;cursor:pointer;font-weight:600;text-decoration:none;border-bottom:1px solid rgba(99,102,241,.4); }
.sgfb-previews { display:flex;gap:8px;flex-wrap:wrap;margin-top:10px; }
.sgfb-footer {
    display:flex;align-items:center;gap:10px;
    padding:12px 18px 16px;border-top:1px solid var(--border);flex-shrink:0;background:var(--bg-surface);
}
.sgfb-send-btn {
    flex:1;padding:11px 20px;border-radius:10px;border:none;cursor:pointer;font-family:inherit;
    background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:.9rem;font-weight:600;
    display:flex;align-items:center;justify-content:center;gap:8px;
    transition:opacity .15s,transform .15s,box-shadow .15s;
    box-shadow:0 4px 14px rgba(99,102,241,.35);
}
.sgfb-send-btn:hover { opacity:.92;transform:translateY(-1px);box-shadow:0 6px 20px rgba(99,102,241,.45); }
.sgfb-send-btn:disabled { opacity:.5;cursor:not-allowed;transform:none;box-shadow:none; }
.sgfb-cancel-btn {
    padding:11px 18px;border-radius:10px;cursor:pointer;font-family:inherit;
    border:1.5px solid var(--border);background:transparent;
    color:var(--text-secondary);font-size:.9rem;font-weight:600;
    transition:all .15s;white-space:nowrap;
}
.sgfb-cancel-btn:hover { background:var(--bg-hover);border-color:var(--text-muted);color:var(--text-primary); }
.sgfb-prev-item { position:relative;width:60px;height:48px; }
.sgfb-prev-img  { width:100%;height:100%;object-fit:cover;border-radius:7px;border:1.5px solid var(--border); }
.sgfb-prev-rm   { position:absolute;top:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:#ef4444;color:#fff;border:none;cursor:pointer;font-size:.6rem;line-height:16px;text-align:center;padding:0; }
.sgfb-chat-area { flex:1;overflow-y:auto;padding:18px 18px 10px;display:flex;flex-direction:column;gap:16px; }
.sgfb-bwrap { display:flex;align-items:flex-end;gap:10px; }
.sgfb-bwrap-user  { flex-direction:row-reverse; }
.sgfb-bwrap-admin { flex-direction:row; }
.sgfb-avatar { width:34px;height:34px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.85rem; }
.sgfb-avatar-user  { background:rgba(99,102,241,.15);color:#6366f1; }
.sgfb-avatar-admin { background:rgba(16,185,129,.15);color:#10b981; }
.sgfb-admin-label { font-size:.68rem;font-weight:600;color:var(--text-muted);margin-bottom:3px;padding-left:2px; }
.sgfb-bubble { padding:10px 14px;border-radius:16px;font-size:.875rem;line-height:1.55; }
.sgfb-bubble-user  { background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-bottom-right-radius:4px; }
.sgfb-bubble-admin { background:var(--bg-hover);color:var(--text-primary);border:1.5px solid var(--border);border-bottom-left-radius:4px; }
.sgfb-bubble-text { white-space:pre-line;word-break:break-word; }
.sgfb-bubble-time { font-size:.66rem;margin-top:5px;opacity:.55;text-align:right; }
.sgfb-bubble-admin .sgfb-bubble-time { text-align:left; }
.sgfb-bubble-imgs { display:flex;gap:6px;flex-wrap:wrap;margin-top:8px; }
.sgfb-chat-img-ph { width:56px;height:44px;border-radius:6px;border:1px solid var(--border);background:var(--bg-hover);display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:.9rem; }
.sgfb-bubble-user .sgfb-chat-img-ph { border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.15);color:rgba(255,255,255,.7); }
.sgfb-chat-img { width:80px;height:60px;object-fit:cover;border-radius:8px;cursor:pointer;border:1.5px solid rgba(255,255,255,.25);transition:opacity .15s; }
.sgfb-chat-img:hover { opacity:.85; }
.sgfb-pending { text-align:center;font-size:.8rem;color:var(--text-muted);padding:14px;border:1.5px dashed var(--border);border-radius:10px;display:flex;align-items:center;justify-content:center;gap:7px; }
.sgfb-chat-input { display:flex;align-items:flex-end;gap:8px;padding:10px 18px 8px;border-top:1px solid var(--border);flex-shrink:0; }
.sgfb-reply-ta { flex:1;resize:none;padding:9px 12px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-family:inherit;font-size:.875rem;line-height:1.45;box-sizing:border-box;transition:border-color .15s; }
.sgfb-reply-ta:focus { outline:none;border-color:#6366f1; }
.sgfb-reply-send { width:38px;height:38px;border-radius:10px;border:none;flex-shrink:0;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.9rem;transition:opacity .15s; }
.sgfb-reply-send:disabled { opacity:.4;cursor:not-allowed; }
.sgfb-del-btn { padding:9px 16px;border-radius:10px;border:1.5px solid rgba(239,68,68,.35);background:rgba(239,68,68,.06);color:#ef4444;font-size:.85rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:7px;transition:all .15s;white-space:nowrap; }
.sgfb-del-btn:hover { background:rgba(239,68,68,.12);border-color:#ef4444; }
`;
        document.head.appendChild(s);
    },
};
