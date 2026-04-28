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
                : `<a href="#/${item.route}">${item.label}</a><span>›</span>`
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
        if (role === 'admin' || role === 'teacher') {
            return [
                { title: 'Навчання', items: [
                    ...common,
                    { icon: '📂', label: 'Ресурси', route: 'resources' }
                ]},
                { title: 'Управління', items: [
                    { icon: '📊', label: 'Аналітика', route: 'analytics' },
                    ...(role === 'admin' ? [{ icon: '⚙️', label: 'Адміністрування', route: 'admin' }] : [])
                ]}
            ];
        }
        return [
            { title: 'Навчання', items: [
                ...common,
                { icon: '📂', label: 'База знань', route: 'knowledge-base' }
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
                <div class="user-role">${Fmt.role(profile?.role)}</div>
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
        return { admin: 'Адміністратор', teacher: 'Викладач', student: 'Студент' }[r] || r || '—';
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
    createDropZone(container, { accept = '*', label = 'Перетягніть файл або натисніть для вибору', hint = '', onFileSelect = null } = {}) {
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
            if (e.dataTransfer.files[0]) {
                const file = e.dataTransfer.files[0];
                this._handleFile(area, input, file);
                if (typeof onFileSelect === 'function') onFileSelect(file);
            }
        });
        input.addEventListener('change', () => {
            if (input.files[0]) {
                const file = input.files[0];
                this._handleFile(area, input, file);
                if (typeof onFileSelect === 'function') onFileSelect(file);
            }
        });
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

const Excel = {
    export(data, filename = 'export', sheetName = 'Аркуш1') {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`);
    }
};
