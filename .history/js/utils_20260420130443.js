// ================================================================
// EduFlow LMS — UI Утиліти
// ================================================================

const Toast = {
    show(type, title, message = '', duration = 4000) {
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                ${message ? `<div class="toast-msg">${message}</div>` : ''}
            </div>`;
        container.appendChild(el);
        const remove = () => { el.classList.add('removing'); setTimeout(() => el.remove(), 300); };
        setTimeout(remove, duration);
        el.addEventListener('click', remove);
        return el;
    },
    success(title, msg)  { return this.show('success', title, msg); },
    error(title, msg)    { return this.show('error', title, msg); },
    warning(title, msg)  { return this.show('warning', title, msg); },
    info(title, msg)     { return this.show('info', title, msg); }
};

const Modal = {
    open({ title = '', body = '', footer = '', size = '', onClose } = {}) {
        document.getElementById('modal-title').innerHTML  = title;
        document.getElementById('modal-body').innerHTML   = body;
        document.getElementById('modal-footer').innerHTML = footer;
        document.getElementById('modal-box').className   = `modal-box ${size ? 'modal-' + size : ''}`;
        document.getElementById('modal-backdrop').classList.remove('hidden');
        document.getElementById('modal-container').classList.remove('hidden');
        this._onClose = onClose;
        document.addEventListener('keydown', this._escHandler);
    },

    close() {
        document.getElementById('modal-backdrop').classList.add('hidden');
        document.getElementById('modal-container').classList.add('hidden');
        document.getElementById('modal-body').innerHTML   = '';
        document.getElementById('modal-footer').innerHTML = '';
        document.removeEventListener('keydown', this._escHandler);
        if (this._onClose) this._onClose();
        this._onClose = null;
    },

    _escHandler(e) { if (e.key === 'Escape') Modal.close(); },

    confirm({ title = 'Підтвердження', message = '', confirmText = 'Підтвердити', danger = false } = {}) {
        return new Promise(resolve => {
            this.open({
                title,
                body: `<p style="color:var(--text-secondary)">${message}</p>`,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-btn">${confirmText}</button>`,
                size: 'sm',
                onClose: () => resolve(false)
            });
            document.getElementById('confirm-btn').onclick = () => { this._onClose = null; this.close(); resolve(true); };
        });
    }
};

const Loader = {
    _count: 0,
    show() { this._count++; document.getElementById('loading-overlay').style.display = 'flex'; },
    hide() {
        this._count = Math.max(0, this._count - 1);
        if (this._count === 0) document.getElementById('loading-overlay').style.display = 'none';
    },
    async wrap(fn) { this.show(); try { return await fn(); } finally { this.hide(); } }
};

const UI = {
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
    },
    openSidebar() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebar-overlay').style.display = 'block';
    },
    closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-overlay').style.display = 'none';
    },
    globalSearch(e) {
        if (e.key === 'Enter') {
            const q = e.target.value.trim();
            if (q) Router.go(`courses?search=${encodeURIComponent(q)}`);
        }
    },
    setBreadcrumb(items = []) {
        const el = document.getElementById('breadcrumb');
        el.innerHTML = items.map((item, i) =>
            i === items.length - 1
                ? `<span class="current">${item.label}</span>`
                : `<span class="current">${item.label}</span>``
        ).join('');
    },
    setPageContent(html) {
        const el = document.getElementById('page-content');
        el.innerHTML = '';
        el.insertAdjacentHTML('beforeend', html);
        el.scrollTop = 0;
    },
    renderNavigation(role) {
        const nav   = document.getElementById('sidebar-nav');
        const items = this._getNavItems(role);
        nav.innerHTML = items.map(section => `
            <div class="nav-section">
                <div class="nav-section-title">${section.title}</div>
                ${section.items.map(item => `
                    <div class="nav-item" data-route="${item.route}" onclick="Router.go('${item.route}')">
                        <span class="nav-icon">${item.icon}</span>
                        <span class="nav-label">${item.label}</span>
                        ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
                    </div>`).join('')}
            </div>`).join('');
    },
    _getNavItems(role) {
        const common = [
            { icon: '🏠', label: 'Головна',  route: 'dashboard' },
            { icon: '📚', label: 'Курси',    route: 'courses' },
            { icon: '📰', label: 'Новини',   route: 'news' }
        ];
        const contentItems = [
            ...common,
            { icon: '📂', label: 'Ресурси',   route: 'resources' },
            { icon: '🖥',  label: 'Меню порталу',  route: 'collections' }
        ];
        if (role === 'owner' || role === 'admin') {
            return [
                { title: 'Навчання', items: contentItems },
                { title: 'Управління', items: [
                    { icon: '📊', label: 'Аналітика',     route: 'analytics' },
                    { icon: '⚙️', label: 'Адміністрування', route: 'admin' }
                ]}
            ];
        }
        if (role === 'smm') {
            return [
                { title: 'Навчання', items: contentItems },
                { title: 'Управління', items: [
                    { icon: '📊', label: 'Аналітика', route: 'analytics' },
                    { icon: '⚙️', label: 'Контент',   route: 'admin' }
                ]}
            ];
        }
        if (role === 'teacher') {
            return [
                { title: 'Навчання', items: contentItems },
                { title: 'Управління', items: [
                    { icon: '📊', label: 'Аналітика', route: 'analytics' }
                ]}
            ];
        }
        return [
            { title: 'Навчання', items: [
                ...common,
                { icon: '📂', label: 'База знань', route: 'knowledge-base' },
                { icon: '🖥',  label: 'Меню порталу',  route: 'collections' }
            ]},
            { title: 'Мої результати', items: [
                { icon: '🏆', label: 'Мої результати', route: 'results' }
            ]}
        ];
    },
    updateActiveNav(route) {
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.route === route);
        });
    },
    renderSidebarUser(profile) {
        const initials = Fmt.initials(profile?.full_name);
        const avatarHtml = profile?.avatar_url
            ? `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : initials;
        const avatarSmHtml = profile?.avatar_url
            ? `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : initials;

        document.getElementById('sidebar-user').innerHTML = `
            <div class="avatar">${avatarHtml}</div>
            <div class="user-info">
                <div class="user-name truncate">${profile?.full_name || 'Користувач'}</div>
                <div class="user-role">${(profile?.role === 'owner' || profile?.role === 'admin') ? '👑 ' : ''}${Fmt.role(profile?.role)}</div>
            </div>`;
        document.getElementById('sidebar-user').style.cursor = 'pointer';
        document.getElementById('sidebar-user').onclick = () => Router.go('profile');
        const headerUser = document.getElementById('header-user');
        if (headerUser) {
            headerUser.innerHTML = `
                <div class="avatar" style="width:32px;height:32px;font-size:.8rem;overflow:hidden">${avatarSmHtml}</div>
                <span style="font-size:.875rem;font-weight:500;">${profile?.full_name?.split(' ')[0] || ''}</span>`;
            headerUser.style.cursor = 'pointer';
            headerUser.onclick = () => Router.go('profile');
        }
    }
};

const Fmt = {
    date(d, opts = {}) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', ...opts });
    },
    dateShort(d) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' });
    },
    time(d) {
        if (!d) return '—';
        return new Date(d).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    },
    datetime(d) { if (!d) return '—'; return `${this.dateShort(d)} ${this.time(d)}`; },
    duration(minutes) {
        if (!minutes) return '—';
        const h = Math.floor(minutes / 60), m = minutes % 60;
        return h ? `${h}год ${m}хв` : `${m}хв`;
    },
    fileSize(bytes) {
        if (!bytes) return '—';
        const units = ['Б', 'КБ', 'МБ', 'ГБ'];
        let i = 0, size = bytes;
        while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
        return `${size.toFixed(1)} ${units[i]}`;
    },
    role(r) {
        return { owner: 'Власник', admin: 'Адміністратор', smm: 'SMM-менеджер', teacher: 'Викладач', user: 'Користувач', student: 'Користувач' }[r] || r || '—';
    },
    roleBadge(r) {
        if (r === 'owner') return `<span class="badge badge-warning">👑 Власник</span>`;
        if (r === 'admin') return `<span class="badge badge-admin">👑 Адміністратор</span>`;
        if (r === 'smm') return `<span class="badge badge-info">📰 SMM-менеджер</span>`;
        const cls = { teacher: 'badge-primary', user: 'badge-muted', student: 'badge-muted' }[r] || 'badge-muted';
        return `<span class="badge ${cls}">${Fmt.role(r)}</span>`;
    },
    level(l) {
        return { beginner: 'Початковий', intermediate: 'Середній', advanced: 'Просунутий' }[l] || l || '—';
    },
    pct(n)  { return `${Math.round(n || 0)}%`; },
    num(n)  { if (n === null || n === undefined) return '—'; return Number(n).toLocaleString('uk-UA'); },
    initials(name = '') { return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'; },
    slug(str) { return str.toLowerCase().replace(/[^a-zа-яёії0-9]+/gi, '-').replace(/^-|-$/g, ''); },
    completionStatus(s) {
        return { 'completed': 'Завершено', 'incomplete': 'В процесі', 'not attempted': 'Не розпочато', 'unknown': '—' }[s] || s || '—';
    },
    successStatus(s) {
        return { 'passed': 'Зараховано', 'failed': 'Не зараховано', 'unknown': '—' }[s] || s || '—';
    }
};

const Dom = {
    qs(sel, p = document)  { return p.querySelector(sel); },
    qsa(sel, p = document) { return [...p.querySelectorAll(sel)]; },
    on(el, event, handler) {
        (typeof el === 'string' ? document.getElementById(el) : el)?.addEventListener(event, handler);
    },
    val(id) {
        const el = document.getElementById(id);
        return el?.type === 'checkbox' ? el.checked : (el?.value || '');
    },
    setVal(id, val) {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = Boolean(val);
        else el.value = val ?? '';
    }
};

const FileUpload = {
    createDropZone(container, { accept = '*', label = 'Перетягніть файл або натисніть для вибору', hint = '' } = {}) {
        const id = 'file-' + Math.random().toString(36).slice(2);
        container.innerHTML = `
            <div class="file-upload-area" onclick="document.getElementById('${id}').click()">
                <div class="file-upload-icon">📁</div>
                <div class="file-upload-label">${label}</div>
                <div class="file-upload-hint">${hint}</div>
                <input id="${id}" type="file" accept="${accept}" style="display:none">
            </div>`;
        const area  = container.querySelector('.file-upload-area');
        const input = document.getElementById(id);
        area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
        area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
        area.addEventListener('drop', e => {
            e.preventDefault(); area.classList.remove('drag-over');
            if (e.dataTransfer.files[0]) this._handleFile(area, input, e.dataTransfer.files[0]);
        });
        input.addEventListener('change', () => { if (input.files[0]) this._handleFile(area, input, input.files[0]); });
        return input;
    },
    _handleFile(area, _input, file) {
        area.querySelector('.file-upload-label').textContent = file.name;
        area.querySelector('.file-upload-hint').textContent  = Fmt.fileSize(file.size);
        area.style.borderColor = 'var(--success)';
    }
};

// ── Searchable Select ─────────────────────────────────────────────
const SearchSelect = {
    // items: [{ value, label }]
    // selected: current value string
    html(id, items, selected = '') {
        const selItem = items.find(i => i.value === selected);
        const selLabel = selItem ? selItem.label : '';
        return `
            <div class="ss-wrap" data-ss="${id}">
                <input class="ss-input" type="text" autocomplete="off"
                       placeholder="Пошук..."
                       value="${selLabel.replace(/"/g,'&quot;')}"
                       onfocus="SearchSelect._open(this)"
                       oninput="SearchSelect._filter(this)">
                <div class="ss-list" hidden>
                    <div class="ss-opt" data-val="" data-lbl="">— не вказано —</div>
                    ${items.map(i => `<div class="ss-opt" data-val="${i.value.replace(/"/g,'&quot;')}" data-lbl="${i.label.replace(/"/g,'&quot;')}">${i.label}</div>`).join('')}
                </div>
                <input type="hidden" id="${id}" value="${(selected||'').replace(/"/g,'&quot;')}">
            </div>`;
    },

    _open(input) {
        document.querySelectorAll('.ss-list:not([hidden])').forEach(l => { l.hidden = true; });
        const list = input.closest('.ss-wrap').querySelector('.ss-list');
        list.hidden = false;
        list.querySelectorAll('.ss-opt').forEach(o => o.style.display = '');
    },

    _filter(input) {
        const q = input.value.toLowerCase();
        const list = input.closest('.ss-wrap').querySelector('.ss-list');
        list.hidden = false;
        list.querySelectorAll('.ss-opt').forEach(o => {
            o.style.display = o.dataset.lbl.toLowerCase().includes(q) ? '' : 'none';
        });
    },

    _pick(opt) {
        const wrap = opt.closest('.ss-wrap');
        const id   = wrap.dataset.ss;
        wrap.querySelector('.ss-input').value = opt.dataset.lbl;
        document.getElementById(id).value = opt.dataset.val;
        wrap.querySelector('.ss-list').hidden = true;
    },

    init() {
        document.addEventListener('click', e => {
            const opt = e.target.closest('.ss-opt');
            if (opt) { SearchSelect._pick(opt); return; }
            if (!e.target.closest('.ss-wrap')) {
                document.querySelectorAll('.ss-list:not([hidden])').forEach(l => { l.hidden = true; });
            }
        });
    }
};

// ── Theme ─────────────────────────────────────────────────────────
const Theme = {
    init() {
        const saved = localStorage.getItem('lms_theme') || 'dark';
        this._apply(saved, false);
    },
    toggle() {
        const current = localStorage.getItem('lms_theme') || 'dark';
        this._apply(current === 'dark' ? 'light' : 'dark', true);
    },
    _apply(theme, animate) {
        if (animate) {
            document.body.style.transition = 'background 0.3s ease, color 0.3s ease';
            setTimeout(() => { document.body.style.transition = ''; }, 350);
        }
        document.body.classList.toggle('light-theme', theme === 'light');
        localStorage.setItem('lms_theme', theme);
        window.dispatchEvent(new CustomEvent('lms-theme-change', { detail: { theme } }));
        const isDark = theme === 'dark';
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            btn.textContent = isDark ? '☀️' : '🌙';
            btn.title = isDark ? 'Світла тема' : 'Темна тема';
        });
    }
};

// ── Creatable Select (autocomplete + inline create) ───────────────
// Використовується для полів з довідників (positions, subdivisions)
// де admin/owner/smm може створювати нові значення прямо на місці.
const CreatableSelect = {
    // table: 'positions' | 'subdivisions'
    html(id, table, items, selected = '') {
        const selLabel = items.find(i => i === selected) ? selected : '';
        const canCreate = ['owner','admin','smm'].includes(AppState.profile?.role);
        return `
            <div class="cs-wrap" data-cs="${id}" data-cs-table="${table}">
                <input class="cs-input form-input" type="text" autocomplete="off"
                       placeholder="Пошук..."
                       value="${(selLabel||'').replace(/"/g,'&quot;')}"
                       onfocus="CreatableSelect._open(this)"
                       oninput="CreatableSelect._filter(this)">
                <div class="cs-list" hidden>
                    <div class="cs-opt cs-opt-empty" data-val="" data-lbl="">— не вказано —</div>
                    ${items.map(i => `<div class="cs-opt" data-val="${i.replace(/"/g,'&quot;')}" data-lbl="${i.replace(/"/g,'&quot;')}">${i}</div>`).join('')}
                    ${canCreate ? `<div class="cs-add-row" hidden>
                        <span class="cs-add-label">Додати: <strong class="cs-add-text"></strong></span>
                        <button type="button" class="cs-add-btn cs-confirm" title="Створити" onclick="CreatableSelect._confirmAdd(this)">✅</button>
                        <button type="button" class="cs-add-btn cs-cancel"  title="Скасувати" onclick="CreatableSelect._cancelAdd(this)">❌</button>
                    </div>` : ''}
                </div>
                <input type="hidden" id="${id}" value="${(selected||'').replace(/"/g,'&quot;')}">
            </div>`;
    },

    _open(input) {
        document.querySelectorAll('.cs-list:not([hidden])').forEach(l => { l.hidden = true; });
        const list = input.closest('.cs-wrap').querySelector('.cs-list');
        list.hidden = false;
        list.querySelectorAll('.cs-opt').forEach(o => o.style.display = '');
        const addRow = list.querySelector('.cs-add-row');
        if (addRow) addRow.hidden = true;
    },

    _filter(input) {
        const q   = input.value.trim();
        const ql  = q.toLowerCase();
        const wrap = input.closest('.cs-wrap');
        const list = wrap.querySelector('.cs-list');
        list.hidden = false;

        let anyVisible = false;
        let exactMatch = false;
        list.querySelectorAll('.cs-opt').forEach(o => {
            const lbl = o.dataset.lbl.toLowerCase();
            const show = !ql || lbl.includes(ql);
            o.style.display = show ? '' : 'none';
            if (show && o.dataset.val) anyVisible = true;
            if (lbl === ql && o.dataset.val) exactMatch = true;
        });

        const addRow = list.querySelector('.cs-add-row');
        if (addRow) {
            const show = q.length > 0 && !exactMatch;
            addRow.hidden = !show;
            if (show) addRow.querySelector('.cs-add-text').textContent = q;
        }
    },

    _pick(opt) {
        const wrap = opt.closest('.cs-wrap');
        wrap.querySelector('.cs-input').value = opt.dataset.lbl;
        document.getElementById(wrap.dataset.cs).value = opt.dataset.val;
        wrap.querySelector('.cs-list').hidden = true;
    },

    _cancelAdd(btn) {
        btn.closest('.cs-add-row').hidden = true;
    },

    async _confirmAdd(btn) {
        const wrap  = btn.closest('.cs-wrap');
        const table = wrap.dataset.csTable;
        const input = wrap.querySelector('.cs-input');
        const name  = input.value.trim();
        if (!name) return;

        // перевірка дубліката (без урахування регістру)
        const existing = [...wrap.querySelectorAll('.cs-opt[data-val]')]
            .find(o => o.dataset.val.toLowerCase() === name.toLowerCase());
        if (existing) { this._pick(existing); return; }

        btn.disabled = true;
        try {
            const rec = await API.directories.create(table, name);
            // додаємо новий варіант у список
            const emptyOpt = wrap.querySelector('.cs-opt-empty');
            const newOpt = document.createElement('div');
            newOpt.className = 'cs-opt';
            newOpt.dataset.val = rec.name;
            newOpt.dataset.lbl = rec.name;
            newOpt.textContent = rec.name;
            emptyOpt.insertAdjacentElement('afterend', newOpt);
            // вибираємо
            this._pick(newOpt);
            Toast.success('Створено', rec.name);
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally {
            btn.disabled = false;
        }
    },

    init() {
        document.addEventListener('click', e => {
            const opt = e.target.closest('.cs-opt');
            if (opt && !e.target.closest('.cs-add-row')) { CreatableSelect._pick(opt); return; }
            if (!e.target.closest('.cs-wrap') && !e.target.closest('.cs-add-row')) {
                document.querySelectorAll('.cs-list:not([hidden])').forEach(l => { l.hidden = true; });
            }
        });
    }
};

// ── MultiSelect ────────────────────────────────────────────────────
// Поле вибору з пошуком і мульти-вибором (теги-чіпси)
// Використання:
//   MultiSelect.html('my-id', 'Оберіть...')  → HTML-рядок
//   MultiSelect.init('my-id', ['Opt1','Opt2'])
//   MultiSelect.getValues('my-id')            → ['Opt1']
//   MultiSelect.setValues('my-id', ['Opt1'])
//   MultiSelect.clear('my-id')
const MultiSelect = (() => {
    const _s = {};  // state per id

    function _st(id) {
        if (!_s[id]) _s[id] = { options: [], filtered: [], selected: [], focused: -1 };
        return _s[id];
    }

    function _renderChips(id) {
        const s = _st(id);
        const wrap = document.getElementById(`ms-wrap-${id}`);
        if (!wrap) return;
        const chips     = wrap.querySelector('.ms-chips');
        const clearBtn  = wrap.querySelector('.ms-clear-btn');
        const searchInput = wrap.querySelector('.ms-search');
        chips.innerHTML = s.selected.map(v =>
            `<span class="ms-chip">${v}<span class="ms-chip-x" data-ms="${id}" data-val="${v.replace(/"/g,'&quot;')}">✕</span></span>`
        ).join('');

        if (clearBtn) {
            clearBtn.dataset.visible = s.selected.length ? '1' : '0';
            clearBtn.style.display = s.selected.length ? '' : 'none';
        }
        if (searchInput) searchInput.placeholder = s.selected.length ? '' : (searchInput.dataset.ph || '');
    }

    function _renderList(id) {
        const s = _st(id);
        const wrap = document.getElementById(`ms-wrap-${id}`);
        if (!wrap) return;
        const list = wrap.querySelector('.ms-list');
        if (!list) return;
        if (s.filtered.length === 0) {
            list.innerHTML = `<div class="ms-empty">Нічого не знайдено</div>`;
            return;
        }
        list.innerHTML = s.filtered.map((o, i) => {
            const checked  = s.selected.includes(o);
            const focused  = i === s.focused;
            const safeVal  = o.replace(/"/g, '&quot;');
            return `<div class="ms-option${checked ? ' ms-selected' : ''}${focused ? ' ms-focused' : ''}"
                        data-ms="${id}" data-val="${safeVal}">
                        <span class="ms-check">${checked ? '✓' : ''}</span>${o}
                    </div>`;
        }).join('');
        if (s.focused >= 0) {
            const items = list.querySelectorAll('.ms-option');
            if (items[s.focused]) items[s.focused].scrollIntoView({ block: 'nearest' });
        }
    }

    function _updateHidden(id) {
        const el = document.getElementById(id);
        if (el) el.value = _st(id).selected.join('\x00');
    }

    function _open(id) {
        Object.keys(_s).forEach(k => { if (k !== id) _close(k); });
        const wrap = document.getElementById(`ms-wrap-${id}`);
        if (!wrap) return;
        wrap.classList.add('open');

        // Позиціонуємо дропдаун через fixed щоб таблиця не обрізала
        const dd   = wrap.querySelector('.ms-dropdown');
        const ctrl = wrap.querySelector('.ms-control');
        if (dd && ctrl) {
            const r = ctrl.getBoundingClientRect();
            dd.style.position = 'fixed';
            dd.style.top      = (r.bottom + 3) + 'px';
            dd.style.left     = r.left + 'px';
            dd.style.width    = Math.max(r.width, 180) + 'px';
            dd.style.right    = 'auto';
            // Якщо виходить за правий край вікна — зсуваємо вліво
            const overflowRight = r.left + Math.max(r.width, 180) - window.innerWidth;
            if (overflowRight > 0) dd.style.left = (r.left - overflowRight - 8) + 'px';
        }

        const inner = wrap.querySelector('.ms-search-inner');
        if (inner) { inner.value = ''; inner.focus(); }
        const s = _st(id);
        s.filtered = [...s.options];
        s.focused  = -1;
        _renderList(id);
    }

    function _close(id) {
        const wrap = document.getElementById(`ms-wrap-${id}`);
        if (!wrap) return;
        wrap.classList.remove('open');
        const dd = wrap.querySelector('.ms-dropdown');
        if (dd) { dd.style.position = ''; dd.style.top = ''; dd.style.left = ''; dd.style.width = ''; }
        const inner = wrap.querySelector('.ms-search-inner');
        if (inner) inner.value = '';
        const s = _st(id);
        s.filtered = [...s.options];
        s.focused  = -1;
    }

    function _toggleOption(id, val) {
        const s = _st(id);
        const idx = s.selected.indexOf(val);
        if (idx === -1) s.selected.push(val);
        else s.selected.splice(idx, 1);
        _renderChips(id);
        _renderList(id);
        _updateHidden(id);
        // trigger change event on hidden input
        const el = document.getElementById(id);
        if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Global click/keyboard delegation (attached once)
    let _globalBound = false;
    function _bindGlobal() {
        if (_globalBound) return;
        _globalBound = true;

        document.addEventListener('mousedown', e => {
            // chip remove
            const chipX = e.target.closest('.ms-chip-x');
            if (chipX) {
                e.preventDefault(); e.stopPropagation();
                _toggleOption(chipX.dataset.ms, chipX.dataset.val);
                return;
            }
            // option pick
            const opt = e.target.closest('.ms-option[data-ms]');
            if (opt) {
                e.preventDefault();
                _toggleOption(opt.dataset.ms, opt.dataset.val);
                return;
            }
            // clear all
            const clr = e.target.closest('.ms-clear-btn[data-ms]');
            if (clr) {
                e.preventDefault(); e.stopPropagation();
                _st(clr.dataset.ms).selected = [];
                _renderChips(clr.dataset.ms);
                _renderList(clr.dataset.ms);
                _updateHidden(clr.dataset.ms);
                const el = document.getElementById(clr.dataset.ms);
                if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
            // control toggle
            const ctrl = e.target.closest('.ms-control[data-ms]');
            if (ctrl) {
                const id = ctrl.dataset.ms;
                const wrap = document.getElementById(`ms-wrap-${id}`);
                if (wrap && wrap.classList.contains('open')) _close(id);
                else _open(id);
                return;
            }
            // close if click outside
            Object.keys(_s).forEach(id => {
                const wrap = document.getElementById(`ms-wrap-${id}`);
                if (wrap && wrap.classList.contains('open') && !wrap.contains(e.target)) _close(id);
            });
        });

        document.addEventListener('keydown', e => {
            const focused = document.activeElement;
            const wrap = focused?.closest('.ms-wrap[id]');
            if (!wrap) return;
            const id = wrap.id.replace('ms-wrap-', '');
            const s  = _st(id);
            const isOpen = wrap.classList.contains('open');
            if (!isOpen) {
                if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); _open(id); }
                return;
            }
            if (e.key === 'Escape') { e.preventDefault(); _close(id); return; }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                s.focused = Math.min(s.focused + 1, s.filtered.length - 1);
                _renderList(id);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                s.focused = Math.max(s.focused - 1, 0);
                _renderList(id);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (s.focused >= 0 && s.focused < s.filtered.length) _toggleOption(id, s.filtered[s.focused]);
            }
        });
    }

    return {
        html(id, placeholder = 'Оберіть...') {
            _bindGlobal();
            return `<div class="ms-wrap" id="ms-wrap-${id}">
                <div class="ms-control" data-ms="${id}">
                    <div class="ms-chips"></div>
                    <input class="ms-search" data-ph="${placeholder}" placeholder="${placeholder}" readonly tabindex="-1">
                    <div class="ms-actions">
                        <button type="button" class="ms-clear-btn" data-ms="${id}" style="display:none">✕</button>
                        <span class="ms-arrow">▾</span>
                    </div>
                </div>
                <div class="ms-dropdown">
                    <div class="ms-search-wrap">
                        <input class="ms-search-inner" placeholder="Пошук...">
                    </div>
                    <div class="ms-list"></div>
                </div>
            </div>
            <input type="hidden" id="${id}">`;
        },

        init(id, options) {
            _bindGlobal();
            const s = _st(id);
            s.options  = options || [];
            s.filtered = [...s.options];
            const wrap = document.getElementById(`ms-wrap-${id}`);
            if (!wrap) return;
            // wire search inside dropdown
            const inner = wrap.querySelector('.ms-search-inner');
            if (inner) {
                inner.oninput = () => {
                    const q = inner.value.toLowerCase();
                    s.filtered = s.options.filter(o => o.toLowerCase().includes(q));
                    s.focused  = -1;
                    _renderList(id);
                };
            }
            _renderChips(id);
            _renderList(id);
        },

        getValues(id) { return [...(_st(id).selected)]; },

        setValues(id, values) {
            _st(id).selected = Array.isArray(values) ? [...values] : [];
            _renderChips(id);
            _renderList(id);
            _updateHidden(id);
        },

        clear(id) { this.setValues(id, []); }
    };
})();

const Excel = {
    export(data, filename = 'export', sheetName = 'Аркуш1') {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`);
    }
};
