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
            const cleanup = () => document.removeEventListener('keydown', keyHandler);
            const keyHandler = e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    cleanup();
                    this._onClose = null;
                    this.close();
                    resolve(true);
                }
            };
            this.open({
                title,
                body: `<p style="color:var(--text-secondary)">${message}</p>`,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-btn">${confirmText}</button>`,
                size: 'sm',
                onClose: () => { cleanup(); resolve(false); }
            });
            document.getElementById('confirm-btn').onclick = () => { cleanup(); this._onClose = null; this.close(); resolve(true); };
            document.addEventListener('keydown', keyHandler);
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
        if (!el) return;
        el.innerHTML = items.map((item, i) => {
            if (i === items.length - 1) return `<span class="current">${item.label}</span>`;
            if (item.onClick) return `<a href="#" onclick="event.preventDefault();(${item.onClick.toString()})()">${item.label}</a><span>›</span>`;
            return `<a href="#/${item.route}">${item.label}</a><span>›</span>`;
        }).join('');
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
        nav.innerHTML = items.map(section => {
            const visible = section.items.filter(item => {
                try { return typeof AccessRestrictions !== 'undefined' ? AccessRestrictions.canAccess(item.route) : true; }
                catch { return true; }
            });
            if (!visible.length) return '';
            return `
            <div class="nav-section">
                <div class="nav-section-title">${section.title}</div>
                ${visible.map(item => `
                    <div class="nav-item" data-route="${item.route}" onclick="Router.go('${item.route}')">
                        <span class="nav-icon">${item.icon}</span>
                        <span class="nav-label">${item.label}</span>
                        ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
                        ${item.badgeId ? `<span class="nav-badge hidden" id="${item.badgeId}"></span>` : ''}
                    </div>`).join('')}
            </div>`;
        }).join('');
    },

    async loadNotificationCount() {
        if (!AppState.user?.id) return;
        const { count } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', AppState.user.id)
            .eq('is_read', false);
        const n = count || 0;
        this._setNotificationBadge(n);
        // Init audio context early + start reminder if unread exist
        NotificationsPage._initAudio();
        if (n > 0 && !NotificationsPage._reminderTimer) {
            NotificationsPage.startReminder();
        }
    },

    updateNotificationBadge(delta, reset = false) {
        const badge     = document.getElementById('nav-ntf-badge');
        const bellBadge = document.getElementById('ntf-bell-badge');
        const current   = reset ? 0 : parseInt(badge?.textContent || '0') + delta;
        const count     = Math.max(0, current);
        this._setNotificationBadge(count);
    },

    _setNotificationBadge(count) {
        const nav     = document.getElementById('nav-ntf-badge');
        const bell    = document.getElementById('ntf-bell-badge');
        const bellBtn = document.getElementById('ntf-bell');
        [nav, bell].forEach(el => {
            if (!el) return;
            if (count > 0) {
                el.textContent = count > 99 ? '99+' : count;
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });
        if (bellBtn) bellBtn.classList.toggle('has-unread', count > 0);
    },
    _getNavItems(role) {
        const expertItem   = { icon: '<img src="icons/road_up.png" style="width:33px;height:33px;object-fit:contain;vertical-align:middle;border-radius:3px;padding:1px">', label: 'Skill Up', route: 'expert-path' };
        const common = [
            { icon: '<i class="fa-solid fa-house" style="color:#C9A227"></i>',        label: 'Головна',  route: 'dashboard' },
            expertItem,
            { icon: '<i class="fa-solid fa-newspaper" style="color:#60a5fa"></i>',    label: 'Новини',   route: 'news' }
        ];
        const contentItems = [
            ...common,
            { icon: '<i class="fa-solid fa-folder-open" style="color:#C9A227"></i>',  label: 'База знань',  route: 'knowledge-base' },
            { icon: '<i class="fa-solid fa-file-lines"></i>',   label: 'Документи',   route: 'documents', badgeId: 'nav-doc-badge' },
            { icon: '<i class="fa-solid fa-wand-magic-sparkles" style="background:linear-gradient(135deg,#818cf8,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-size:1rem"></i>', label: 'Меню порталу', route: 'collections' }
        ];
        const ntfItem      = { icon: '<i class="fa-solid fa-bell" style="color:#C9A227"></i>',        label: 'Сповіщення', route: 'notifications', badgeId: 'nav-ntf-badge' };
        const contactsItem = { icon: '<i class="fa-solid fa-address-book"></i>', label: 'Контакти',   route: 'contacts' };
        const bmItem       = { icon: '<i class="fa-solid fa-bookmark" style="color:#C9A227"></i>',    label: 'Закладки',   route: 'bookmarks', noStar: true };

        if (role === 'owner' || role === 'admin') {
            return [
                { title: 'Навчання', items: contentItems },
                { title: 'Управління', items: [
                    { icon: '<i class="fa-solid fa-chart-bar"></i>',     label: 'Аналітика',         route: 'analytics' },
                    { icon: '<i class="fa-solid fa-calendar-days" style="color:#60a5fa"></i>', label: 'Розділ планування', route: 'scheduler' },
                    { icon: '<i class="fa-solid fa-gear" style="color:#f87171"></i>',          label: 'Адміністрування',   route: 'admin' }
                ]},
                { title: 'Особисте', items: [ contactsItem, bmItem, ntfItem ] }
            ];
        }
        if (role === 'manager') {
            return [
                { title: 'Навчання', items: contentItems },
                { title: 'Управління', items: [
                    { icon: '<i class="fa-solid fa-calendar-days" style="color:#60a5fa"></i>', label: 'Розділ планування', route: 'scheduler' }
                ]},
                { title: 'Особисте', items: [ contactsItem, bmItem, ntfItem ] }
            ];
        }
        if (role === 'smm') {
            return [
                { title: 'Навчання', items: contentItems },
                { title: 'Управління', items: [
                    { icon: '<i class="fa-solid fa-chart-bar"></i>',     label: 'Аналітика',        route: 'analytics' },
                    { icon: '<i class="fa-solid fa-gear"></i>',          label: 'Контент',          route: 'admin' },
                    { icon: '<i class="fa-solid fa-calendar-days" style="color:#60a5fa"></i>', label: 'Розділ планування', route: 'scheduler', noStar: true }
                ]},
                { title: 'Особисте', items: [ contactsItem, bmItem, ntfItem ] }
            ];
        }
        if (role === 'teacher') {
            return [
                { title: 'Навчання', items: contentItems },
                { title: 'Управління', items: [
                    { icon: '<i class="fa-solid fa-chart-bar"></i>',     label: 'Аналітика',        route: 'analytics' },
                    { icon: '<i class="fa-solid fa-calendar-days" style="color:#60a5fa"></i>', label: 'Розділ планування', route: 'scheduler', noStar: true }
                ]},
                { title: 'Особисте', items: [ contactsItem, bmItem, ntfItem ] }
            ];
        }
        return [
            { title: 'Навчання', items: contentItems },
            { title: 'Особисте', items: [
                contactsItem,
                { icon: '<i class="fa-solid fa-calendar-days" style="color:#60a5fa"></i>', label: 'Розділ планування', route: 'scheduler', noStar: true },
                bmItem, ntfItem
            ]}
        ];
    },
    updateActiveNav(route) {
        const parentRoute = {
            'schedule-graph': 'scheduler',
            'schedule-view':  'scheduler',
            'my-calendar':    'scheduler',
        }[route] || route;
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.route === parentRoute);
        });
    },
    renderSidebarUser(profile) {
        const initials = Fmt.initials(profile?.full_name);
        const avatarHtml = profile?.avatar_url
            ? `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : initials;

        const isTopRole = profile?.role === 'owner' || profile?.role === 'admin';
        const crownHtml = isTopRole ? '<i class="fa-solid fa-crown" style="color:#C9A227;font-size:.65rem"></i>' : '';
        const meta = profile?.city || '';

        const headerUser = document.getElementById('header-user');
        if (headerUser) {
            headerUser.innerHTML = `
                <div class="tb-user-avatar">${avatarHtml}</div>
                <div class="tb-user-info">
                    <div class="tb-user-name">${Fmt.esc(profile?.full_name || 'Користувач')}</div>
                    <div class="tb-user-sub">${crownHtml}${Fmt.esc(Fmt.role(profile?.role))}${meta ? ` · ${Fmt.esc(meta)}` : ''}</div>
                </div>
                <i class="fa-solid fa-chevron-down tb-user-chevron" id="su-chevron-icon"></i>`;
        }
        this._updateThemeLabel();
    },

    toggleUserPopup() {
        const popup = document.getElementById('su-popup');
        if (!popup) return;
        const isOpen = popup.classList.contains('open');
        if (isOpen) { this.closeUserPopup(); return; }
        popup.classList.remove('hidden');
        requestAnimationFrame(() => popup.classList.add('open'));
        document.getElementById('su-chevron-icon')?.classList.add('su-rotated');
        setTimeout(() => document.addEventListener('click', this._popupOutsideHandler, { once: true }), 0);
    },

    closeUserPopup() {
        const popup = document.getElementById('su-popup');
        if (!popup) return;
        popup.classList.remove('open');
        document.getElementById('su-chevron-icon')?.classList.remove('su-rotated');
        setTimeout(() => popup.classList.add('hidden'), 180);
    },

    _popupOutsideHandler(e) {
        if (!document.getElementById('su-popup')?.contains(e.target) &&
            !document.getElementById('header-user')?.contains(e.target)) {
            UI.closeUserPopup();
        }
    },

    _updateThemeLabel() {
        const btn = document.getElementById('su-theme-btn');
        if (!btn) return;
        const isDark = !document.body.classList.contains('light-theme');
        btn.querySelector('i').className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        btn.querySelector('span').textContent = isDark ? 'Світла тема' : 'Темна тема';
    },

    async loadDocBadge() {
        if (!AppState.user?.id) return;
        try {
            const { data: docs } = await supabase
                .from('resources')
                .select('id, doc_version')
                .eq('is_tracked_download', true)
                .is('deleted_at', null)
                .is('lesson_id', null);
            if (!docs?.length) return;
            const ackMap = await API.documentDownloads.getMyLatest(docs.map(d => d.id));
            const unread = docs.filter(d => {
                const dl = ackMap[d.id];
                return !dl || (dl.version || 1) < (d.doc_version || 1);
            }).length;
            const badge = document.getElementById('nav-doc-badge');
            if (!badge) return;
            if (unread > 0) {
                badge.textContent = unread > 99 ? '99+' : unread;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        } catch { /* silent */ }
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
    countdown(deadlineIso) {
        if (!deadlineIso) return null;
        const diff = new Date(deadlineIso) - Date.now();
        if (diff <= 0) return { expired: true, html: `<span style="display:inline-flex;align-items:center;gap:.3rem;color:var(--danger);font-weight:600;font-size:.78rem"><i class="fa-solid fa-hourglass-end"></i> Прострочено</span>` };
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const urgent = diff < 86400000;       // < 1 day
        const warning = diff < 3 * 86400000; // < 3 days
        const color = urgent ? 'var(--danger)' : warning ? '#f59e0b' : 'var(--text-muted)';
        const icon  = urgent ? 'fa-solid fa-fire' : warning ? 'fa-solid fa-clock' : 'fa-regular fa-calendar-clock';
        const parts = [d > 0 ? `${d}д` : '', h > 0 ? `${h}г` : '', m > 0 ? `${m}хв` : ''].filter(Boolean).join(' ') || '< 1хв';
        return { expired: false, urgent, warning, html: `<span style="display:inline-flex;align-items:center;gap:.3rem;color:${color};font-weight:600;font-size:.78rem"><i class="${icon}"></i> ${parts}</span>` };
    },

    fileSize(bytes) {
        if (!bytes) return '—';
        const units = ['Б', 'КБ', 'МБ', 'ГБ'];
        let i = 0, size = bytes;
        while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
        return `${size.toFixed(1)} ${units[i]}`;
    },
    role(r) {
        return { owner: 'Admin', admin: 'Адміністратор', smm: 'SMM-менеджер', teacher: 'Викладач', manager: 'Керівник', user: 'Користувач', student: 'Користувач' }[r] || r || '—';
    },
    roleBadge(r) {
        if (r === 'owner')   return `<span class="badge badge-warning">👑 Admin</span>`;
        if (r === 'admin')   return `<span class="badge badge-admin">👑 Адміністратор</span>`;
        if (r === 'smm')     return `<span class="badge badge-info">📰 SMM-менеджер</span>`;
        if (r === 'manager') return `<span class="badge badge-manager">👔 Керівник</span>`;
        const cls = { teacher: 'badge-primary', user: 'badge-muted', student: 'badge-muted' }[r] || 'badge-muted';
        return `<span class="badge ${cls}">${Fmt.role(r)}</span>`;
    },
    level(l) {
        return { beginner: 'Початковий', intermediate: 'Середній', advanced: 'Просунутий' }[l] || l || '—';
    },
    pct(n)  { return `${Math.round(n || 0)}%`; },
    num(n)  { if (n === null || n === undefined) return '—'; return Number(n).toLocaleString('uk-UA'); },
    initials(name = '') { return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'; },
    slug(str) {
        const map = {'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye','ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'yu','я':'ya','ё':'yo'};
        return str.toLowerCase().split('').map(c => map[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    },
    completionStatus(s) {
        return { 'completed': 'Завершено', 'incomplete': 'В процесі', 'not attempted': 'Не розпочато', 'unknown': '—' }[s] || s || '—';
    },
    successStatus(s) {
        return { 'passed': 'Зараховано', 'failed': 'Не зараховано', 'unknown': '—' }[s] || s || '—';
    },
    esc(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },
    safeUrl(url) {
        if (!url) return '#';
        const s = String(url).trim();
        if (/^javascript:/i.test(s) || /^data:/i.test(s) || /^vbscript:/i.test(s)) return '#';
        return s;
    },
    parseDatePaste(e, input) {
        const text = (e.clipboardData || window.clipboardData).getData('text').trim();
        const m = text.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/);
        if (m) {
            e.preventDefault();
            input.value = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
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
    createDropZone(container, { accept = '*', label = 'Перетягніть або натисніть для завантаження', hint = '' } = {}) {
        const id = 'file-' + Math.random().toString(36).slice(2);
        container.innerHTML = `
            <div class="file-upload-frame">
                <div class="file-upload-area" onclick="document.getElementById('${id}').click()">
                    <div class="file-upload-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
                    <div class="file-upload-label">${label}</div>
                    ${hint ? `<div class="file-upload-hint">${hint}</div>` : ''}
                    <input id="${id}" type="file" accept="${accept}" style="display:none">
                </div>
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
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = e => {
                area.style.cssText += ';padding:0;position:relative;overflow:hidden;border-color:var(--success)';
                area.innerHTML = `
                    <img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;display:block">
                    <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.52);color:#fff;font-size:.7rem;padding:.2rem .5rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${file.name} · ${Fmt.fileSize(file.size)}</div>`;
            };
            reader.readAsDataURL(file);
        } else {
            area.querySelector('.file-upload-label').textContent = file.name;
            const hint = area.querySelector('.file-upload-hint');
            if (hint) hint.textContent = Fmt.fileSize(file.size);
            area.style.borderColor = 'var(--success)';
        }
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
        document.addEventListener('mousedown', e => {
            const opt = e.target.closest('.ss-opt');
            if (opt) { e.preventDefault(); SearchSelect._pick(opt); return; }
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('.ss-wrap')) {
                document.querySelectorAll('.ss-list:not([hidden])').forEach(l => { l.hidden = true; });
            }
        });
    }
};

// ── Theme ─────────────────────────────────────────────────────────
const Theme = {
    init() {
        // Apply from localStorage immediately (avoids flash before profile loads)
        const saved = localStorage.getItem('lms_theme') || 'dark';
        this._apply(saved, false, false);
    },

    // Called after profile is loaded — syncs theme from DB to browser
    applyFromProfile(profile) {
        if (!profile) return;
        const theme = profile.ui_theme || 'dark';
        localStorage.setItem('lms_theme', theme);
        this._apply(theme, false, false);
    },

    toggle() {
        const current = localStorage.getItem('lms_theme') || 'dark';
        this._apply(current === 'dark' ? 'light' : 'dark', true, true);
    },

    _saveTimer: null,
    _apply(theme, animate, saveToDb) {
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
        if (saveToDb && AppState.user?.id) {
            clearTimeout(this._saveTimer);
            this._saveTimer = setTimeout(() => {
                supabase.from('profiles').update({ ui_theme: theme }).eq('id', AppState.user.id).then();
            }, 500);
        }
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
        document.addEventListener('mousedown', e => {
            const opt = e.target.closest('.cs-opt');
            if (opt && !e.target.closest('.cs-add-row')) { e.preventDefault(); CreatableSelect._pick(opt); return; }
        });
        document.addEventListener('click', e => {
            if (!e.target.closest('.cs-wrap') && !e.target.closest('.cs-add-row')) {
                document.querySelectorAll('.cs-list:not([hidden])').forEach(l => { l.hidden = true; });
            }
        });
    }
};

// ── CreatableMultiSelect ───────────────────────────────────────────
// Мультивибір з можливістю додавання нових варіантів до БД
// Використання:
//   CreatableMultiSelect.html('my-id')             → HTML-рядок
//   CreatableMultiSelect.init('my-id', options, selected)
//   CreatableMultiSelect.getValues('my-id')        → [id, ...]
const CreatableMultiSelect = (() => {
    const _s = {};

    function _st(id) {
        if (!_s[id]) _s[id] = { options: [], selected: [] };
        return _s[id];
    }

    function _updateHidden(id) {
        const el = document.getElementById(id);
        if (el) el.value = _st(id).selected.map(x => x.id).join('\x00');
    }

    function _renderChips(id) {
        const chips = document.getElementById(`cms-chips-${id}`);
        if (!chips) return;
        chips.innerHTML = _st(id).selected.map(item =>
            `<span class="ms-chip">${item.name}<span class="cms-chip-x" data-cms="${id}" data-iid="${item.id}">✕</span></span>`
        ).join('');
        const input = document.getElementById(`cms-input-${id}`);
        if (input) input.placeholder = _st(id).selected.length ? '' : 'Оберіть або введіть...';
    }

    function _renderList(id, q = '') {
        const s = _st(id);
        const list = document.getElementById(`cms-list-${id}`);
        if (!list) return;
        const ql = q.toLowerCase();
        const selIds = new Set(s.selected.map(x => x.id));
        const filtered = s.options.filter(o => !selIds.has(o.id) && (!ql || o.name.toLowerCase().includes(ql)));
        list.innerHTML = filtered.length
            ? filtered.map(o => `<div class="cs-opt cms-opt" data-cms="${id}" data-iid="${o.id}" data-iname="${o.name.replace(/"/g,'&quot;')}">${o.name}</div>`).join('')
            : `<div class="cs-opt" style="color:var(--text-muted);pointer-events:none">${ql ? 'Нічого не знайдено' : 'Всі варіанти обрані'}</div>`;

        const addRow = document.getElementById(`cms-add-row-${id}`);
        if (addRow) {
            const canCreate = ['owner', 'admin'].includes(AppState.profile?.role);
            const exact = s.options.some(o => o.name.toLowerCase() === ql);
            const show = canCreate && ql.length > 0 && !exact;
            addRow.hidden = !show;
            if (show) { const t = document.getElementById(`cms-add-text-${id}`); if (t) t.textContent = q; }
        }
    }

    function _openDrop(id) {
        const dd = document.getElementById(`cms-dd-${id}`);
        if (!dd) return;
        dd.hidden = false;
        _renderList(id, document.getElementById(`cms-input-${id}`)?.value || '');
    }

    function _closeDrop(id) {
        const dd = document.getElementById(`cms-dd-${id}`);
        if (dd) dd.hidden = true;
    }

    function _pick(id, optId, optName) {
        const s = _st(id);
        if (!s.selected.find(x => x.id === optId)) {
            s.selected.push({ id: optId, name: optName });
            _renderChips(id);
            _updateHidden(id);
        }
        const input = document.getElementById(`cms-input-${id}`);
        if (input) { input.value = ''; input.focus(); }
        _renderList(id, '');
    }

    let _gb = false;
    function _bindGlobal() {
        if (_gb) return; _gb = true;
        document.addEventListener('mousedown', e => {
            // chip remove
            const cx = e.target.closest('.cms-chip-x');
            if (cx) {
                e.preventDefault(); e.stopPropagation();
                const id = cx.dataset.cms;
                _st(id).selected = _st(id).selected.filter(x => x.id !== cx.dataset.iid);
                _renderChips(id); _renderList(id, ''); _updateHidden(id);
                return;
            }
            // option pick
            const opt = e.target.closest('.cms-opt[data-cms]');
            if (opt) { e.preventDefault(); _pick(opt.dataset.cms, opt.dataset.iid, opt.dataset.iname); return; }
            // close outside
            Object.keys(_s).forEach(id => {
                const wrap = document.getElementById(`cms-wrap-${id}`);
                if (wrap && !wrap.contains(e.target)) _closeDrop(id);
            });
        });
    }

    return {
        html(id) {
            _bindGlobal();
            const canCreate = ['owner', 'admin'].includes(AppState.profile?.role);
            return `
<div class="cms-wrap" id="cms-wrap-${id}">
    <div class="cms-field">
        <div class="cms-chips" id="cms-chips-${id}"></div>
        <input class="cms-input" id="cms-input-${id}" type="text"
               placeholder="Оберіть або введіть..." autocomplete="off"
               oninput="CreatableMultiSelect._onInput('${id}',this.value)"
               onfocus="CreatableMultiSelect._openDrop('${id}')">
    </div>
    <div class="cms-dropdown" id="cms-dd-${id}" hidden>
        <div class="cms-list" id="cms-list-${id}"></div>
        ${canCreate ? `<div class="cms-add-row cs-add-row" id="cms-add-row-${id}" hidden>
            <span class="cs-add-label">Додати: <strong id="cms-add-text-${id}"></strong></span>
            <button type="button" class="cs-add-btn cs-confirm" id="cms-add-btn-${id}" onclick="CreatableMultiSelect._confirmAdd('${id}')">✅</button>
            <button type="button" class="cs-add-btn cs-cancel" onclick="CreatableMultiSelect._cancelAdd('${id}')">❌</button>
        </div>` : ''}
    </div>
</div>
<input type="hidden" id="${id}">`;
        },

        init(id, options, selected = []) {
            _bindGlobal();
            const s = _st(id);
            s.options  = [...options];
            s.selected = [...selected];
            _renderChips(id);
        },

        _onInput(id, val) {
            _openDrop(id);
            _renderList(id, val);
        },

        _openDrop,

        _cancelAdd(id) {
            const input = document.getElementById(`cms-input-${id}`);
            if (input) { input.value = ''; input.focus(); }
            _renderList(id, '');
        },

        async _confirmAdd(id) {
            const input = document.getElementById(`cms-input-${id}`);
            const name = input?.value?.trim();
            if (!name) return;
            const btn = document.getElementById(`cms-add-btn-${id}`);
            if (btn) btn.disabled = true;
            try {
                const rec = await API.dovirenosti.create(name);
                _st(id).options.push({ id: rec.id, name: rec.name });
                _pick(id, rec.id, rec.name);
                _closeDrop(id);
                Toast.success('Створено', rec.name);
            } catch(e) {
                Toast.error('Помилка', e.message);
            } finally {
                if (btn) btn.disabled = false;
            }
        },

        getValues(id) { return _st(id).selected.map(x => x.id); }
    };
})();

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
        if (s.selected.length === 0) {
            chips.innerHTML = '';
        } else {
            const first = s.selected[0];
            const rest  = s.selected.length - 1;
            chips.innerHTML =
                `<span class="ms-chip"><span class="ms-chip-label">${first}</span><span class="ms-chip-x" data-ms="${id}" data-val="${first.replace(/"/g,'&quot;')}">✕</span></span>` +
                (rest > 0 ? `<span class="ms-chip ms-chip-more" title="${s.selected.slice(1).join(', ')}">+${rest}</span>` : '');
        }

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
                        <span class="ms-check${checked ? ' ms-check-on' : ''}"></span><span class="ms-opt-label">${o}</span>
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
            const ddWidth = Math.max(r.width, 280);
            dd.style.width    = ddWidth + 'px';
            dd.style.right    = 'auto';
            // Якщо виходить за правий край вікна — зсуваємо вліво
            const overflowRight = r.left + ddWidth - window.innerWidth;
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

const AuditLog = {
    async write(action, entityType, entityName, meta = {}) {
        const p = AppState.profile;
        if (!p || !['owner','admin','smm'].includes(p.role)) return;
        try {
            await supabase.from('activity_logs').insert({
                user_id:     AppState.user.id,
                actor_name:  p.full_name,
                actor_role:  p.role,
                action,
                entity_type: entityType,
                entity_name: String(entityName || ''),
                meta: Object.keys(meta).length ? meta : null
            });
        } catch(e) {
            console.warn('AuditLog.write failed:', e.message);
        }
    }
};


// ── Impersonation Banner ──────────────────────────────────────────
const ImpersonationBanner = {
    show(profile) {
        let el = document.getElementById('impersonation-banner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'impersonation-banner';
            document.body.appendChild(el);
        }
        el.innerHTML = `
            <span style="display:inline-flex;align-items:center;gap:.5rem">
                <span style="font-size:1rem">👁</span>
                <span>Ви переглядаєте як <strong>${profile.full_name || profile.email || '?'}</strong></span>
                <span style="font-size:.78rem;opacity:.75">${profile.role ? '· ' + profile.role : ''}${profile.job_position ? ' · ' + profile.job_position : ''}${profile.city ? ' · ' + profile.city : ''}</span>
            </span>
            <button onclick="AppState.stopImpersonating()" style="margin-left:1rem;padding:5px 14px;border-radius:8px;border:1.5px solid rgba(255,255,255,.5);background:transparent;color:#fff;font-size:.8rem;font-weight:600;cursor:pointer;transition:background .15s" onmouseenter="this.style.background='rgba(255,255,255,.15)'" onmouseleave="this.style.background='transparent'">✕ Вийти</button>`;
        el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:linear-gradient(90deg,#7c3aed,#4f46e5);color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:center;gap:.75rem;font-size:.875rem;box-shadow:0 -2px 16px rgba(0,0,0,.2);';
        document.body.style.paddingBottom = '48px';
    },
    hide() {
        const el = document.getElementById('impersonation-banner');
        if (el) el.remove();
        document.body.style.paddingBottom = '';
    }
};

// ── HelpTip — collapsible page manual ────────────────────────────────────────
const HelpTip = {
    _roleMatch(roles) {
        if (!roles) return true;
        const r = AppState.profile?.role;
        return roles.some(rl => {
            if (rl === 'admin')   return AppState.isAdmin();
            if (rl === 'staff')   return AppState.isStaff();
            if (rl === 'manager') return AppState.isManager() || AppState.isAdmin();
            if (rl === 'owner')   return AppState.isOwner();
            return r === rl;
        });
    },

    _prefs(key) {
        return AppState.profile?.ui_prefs?.helptips?.[key] || {};
    },

    _savePrefs(key, patch) {
        const cur = AppState.profile?.ui_prefs?.helptips || {};
        API.profiles.updateUiPrefs({ helptips: { ...cur, [key]: { ...cur[key], ...patch } } });
    },

    render(key, { icon = 'fa-circle-info', title, gradient = '135deg,#6366f1,#8b5cf6', items = [] }) {
        const visible = items.filter(it => this._roleMatch(it.roles));
        if (!visible.length) return '';

        const prefs  = this._prefs(key);
        const acked  = new Set(prefs.acked || []);
        const open   = prefs.open !== false; // default open
        const total  = visible.length;
        const doneN  = visible.filter((_, i) => acked.has(i)).length;
        const allDone = doneN === total;

        return `
        <div class="ht-wrap${open && !allDone ? ' ht-open' : ''}" id="ht-${key}">
            <div class="ht-banner" style="background:linear-gradient(270deg,${gradient.replace('135deg,','')});background-size:300% 300%;animation:ht-gradient 6s ease infinite;cursor:pointer" onclick="HelpTip._toggle('${key}')">
                <div class="ht-banner-glow"></div>
                <div class="ht-banner-left">
                    <div class="ht-banner-ico"><i class="fa-solid ${icon}"></i></div>
                    <div>
                        <div class="ht-banner-label">Підказка розділу</div>
                        <div class="ht-banner-title">${title}</div>
                    </div>
                </div>
                <div class="ht-banner-right" onclick="event.stopPropagation()">
                    ${allDone
                        ? `<div class="ht-done-badge"><i class="fa-solid fa-circle-check"></i> Вивчено!</div>`
                        : `<div class="ht-progress-wrap">
                               <div class="ht-progress-bar"><div class="ht-progress-fill" style="width:${Math.round(doneN/total*100)}%"></div></div>
                               <div class="ht-progress-label">${doneN} з ${total}</div>
                           </div>`}
                    <button class="ht-toggle" onclick="HelpTip._toggle('${key}')" title="${open ? 'Згорнути' : 'Розгорнути'}">
                        <i class="fa-solid fa-chevron-up ht-chevron"></i>
                    </button>
                </div>
            </div>
            <div class="ht-body">
                <div class="ht-scroll">
                    ${visible.map((it, i) => {
                        const done = acked.has(i);
                        return `
                        <div class="ht-card${done ? ' ht-card-done' : ''}" id="ht-card-${key}-${i}" style="animation-delay:${i * 0.07}s">
                            <div class="ht-card-top">
                                <div class="ht-card-ico" style="background:${it.color||'#6366f1'}20;color:${it.color||'#6366f1'}">
                                    <i class="fa-solid ${it.icon}"></i>
                                </div>
                                ${done ? `<div class="ht-card-check"><i class="fa-solid fa-check"></i></div>` : ''}
                            </div>
                            <div class="ht-card-text">${it.text}</div>
                            ${!done ? `
                            <button class="ht-card-ack" onclick="HelpTip._ack('${key}',${i},${total})">
                                <i class="fa-solid fa-check"></i> Зрозумів
                            </button>` : ''}
                        </div>`;
                    }).join('')}
                </div>
            </div>
        </div>`;
    },

    _toggle(key) {
        const el = document.getElementById(`ht-${key}`);
        if (!el) return;
        const isOpen = el.classList.toggle('ht-open');
        this._savePrefs(key, { open: isOpen });
    },

    _ack(key, idx, total) {
        const prefs  = this._prefs(key);
        const acked  = new Set(prefs.acked || []);
        acked.add(idx);
        this._savePrefs(key, { acked: [...acked] });

        const card = document.getElementById(`ht-card-${key}-${idx}`);
        if (card) {
            card.classList.add('ht-card-acking');
            setTimeout(() => {
                card.classList.add('ht-card-done');
                card.classList.remove('ht-card-acking');
                card.querySelector('.ht-card-ack')?.remove();
                card.querySelector('.ht-card-top').insertAdjacentHTML('beforeend',
                    '<div class="ht-card-check"><i class="fa-solid fa-check"></i></div>');
            }, 350);
        }

        // update progress bar
        const wrap = document.getElementById(`ht-${key}`);
        if (!wrap) return;
        const doneN = acked.size;
        const pct   = Math.round(doneN / total * 100);
        const bar   = wrap.querySelector('.ht-progress-fill');
        const lbl   = wrap.querySelector('.ht-progress-label');
        if (bar) bar.style.width = pct + '%';
        if (lbl) lbl.textContent = `${doneN} з ${total}`;

        if (doneN === total) {
            setTimeout(() => {
                const pw = wrap.querySelector('.ht-progress-wrap');
                if (pw) pw.outerHTML = '<div class="ht-done-badge"><i class="fa-solid fa-circle-check"></i> Вивчено!</div>';
                wrap.classList.remove('ht-open');
                this._savePrefs(key, { open: false });
            }, 600);
        }
    }
};