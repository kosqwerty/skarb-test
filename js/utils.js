// ================================================================
// EduFlow LMS — UI Утиліти
// ================================================================

const Toast = {
    show(type, title, message = '', duration = 7000) {
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
    open({ title = '', body = '', footer = '', size = '', noHeader = false, onClose } = {}) {
        const header = document.querySelector('.modal-header');
        document.getElementById('modal-title').innerHTML  = title;
        document.getElementById('modal-body').innerHTML   = body;
        document.getElementById('modal-footer').innerHTML = footer;
        document.getElementById('modal-box').className   = `modal-box ${size ? 'modal-' + size : ''}`;
        if (header) header.style.display = noHeader ? 'none' : '';
        const backdrop = document.getElementById('modal-backdrop');
        backdrop.classList.remove('hidden');
        backdrop.onclick = () => Modal.close();
        document.getElementById('modal-container').classList.remove('hidden');
        this._onClose = onClose;
        document.addEventListener('keydown', this._escHandler);
    },

    close() {
        document.getElementById('modal-backdrop').classList.add('hidden');
        document.getElementById('modal-container').classList.add('hidden');
        document.getElementById('modal-body').innerHTML   = '';
        document.getElementById('modal-footer').innerHTML = '';
        const header = document.querySelector('.modal-header');
        if (header) header.style.display = '';
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
    // Кнопка "нагору" — з'являється після прокрутки на SCROLL_TOP_THRESHOLD px.
    // Слухач на window/document, бо сторінка скролиться самим документом
    // (.top-bar position:fixed, внутрішнього overflow-контейнера немає).
    _SCROLL_TOP_THRESHOLD: 400,
    initScrollTopBtn() {
        const btn = document.getElementById('scroll-top-btn');
        if (!btn || this._scrollTopInited) return;
        this._scrollTopInited = true;
        window.addEventListener('scroll', () => {
            btn.classList.toggle('visible', window.scrollY > this._SCROLL_TOP_THRESHOLD);
        }, { passive: true });
    },

    toggleSidebar() {
        if (window.innerWidth <= 1024) {
            const sidebar = document.getElementById('sidebar');
            const isOpen = sidebar.classList.contains('open');
            if (isOpen) this.closeSidebar(); else this.openSidebar();
            return;
        }
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        document.body.classList.toggle('sidebar-collapsed', isCollapsed);
        localStorage.setItem('sidebar_collapsed', isCollapsed);
    },
    openSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.add('open');
        document.body.classList.add('sidebar-open');
        document.getElementById('sidebar-overlay').style.display = 'block';
    },
    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('open');
        document.body.classList.remove('sidebar-open');
        document.getElementById('sidebar-overlay').style.display = 'none';
    },
    globalSearch(e) {
        if (e.key === 'Enter') {
            const q = e.target.value.trim();
            if (q) Router.go(`expert-path?search=${encodeURIComponent(q)}`);
        }
    },
    setBreadcrumb(items = []) {
        const el = document.getElementById('breadcrumb');
        if (!el) return;
        const nav = items.slice(0, -1);
        el.innerHTML = nav.map(item => {
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
    // Роути доступні без довіреної мережі
    _trustedAllowed: new Set(['dashboard', 'news']),

    renderNavigation(role) {
        const nav   = document.getElementById('sidebar-nav');
        const items = this._getNavItems(role);
        const blocked = !AppState.isTrustedNetwork;
        nav.innerHTML = items.map(section => {
            const visible = section.items.filter(item => {
                try { return typeof AccessRestrictions !== 'undefined' ? AccessRestrictions.canAccess(item.route) : true; }
                catch { return true; }
            });
            if (!visible.length) return '';
            return `
            <div class="nav-section">
                <div class="nav-section-title" style="background:linear-gradient(90deg,#C9A227,#2563EB);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${section.title}</div>
                ${visible.map(item => {
                    const isBlocked = blocked && !this._trustedAllowed.has(item.route);
                    return `
                    <a class="nav-item${isBlocked ? ' nav-item-blocked' : ''}" data-route="${item.route}" data-label="${item.label}"
                       href="#/${item.route}" ${isBlocked ? 'onclick="event.preventDefault()"' : ''}>
                        <span class="nav-icon">
                            ${item.icon}
                            ${item.badge ? `<span class="nav-badge nav-badge-dot">${item.badge}</span>` : ''}
                            ${item.badgeId ? `<span class="nav-badge nav-badge-dot hidden" id="${item.badgeId}"></span>` : ''}
                            ${item.impBadgeId ? `<span class="nav-imp-bolt hidden" id="${item.impBadgeId}"><i class="fa-solid fa-bolt"></i></span>` : ''}
                            ${isBlocked ? `<span class="nav-blocked-icon" title="Недоступно з цієї мережі"><i class="fa-solid fa-ban"></i></span>` : ''}
                        </span>
                        <span class="nav-label">${item.label}</span>
                    </a>`;
                }).join('')}
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
        this._subscribeNotifications();
    },

    _subscribeNotifications() {
        if (this._notifChannel) return;
        this._notifChannel = supabase
            .channel('ntf-' + AppState.user.id)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${AppState.user.id}`
            }, (payload) => {
                this.updateNotificationBadge(1);
                const n = payload.new;
                if (n?.title?.includes('Запит на зміну')) {
                    UI._showScheduleRequestPopup(n);
                } else if (n?.title?.includes('Зміну в графіку')) {
                    UI._showScheduleUpdatePopup(n);
                } else if (n?.title?.includes('Готовий вийти на заміну')) {
                    UI._showSubAvailablePopup(n);
                }
            })
            .subscribe();
    },

    _openSchedulerRequest(link) {
        if (!link) { Router.go('scheduler'); return; }
        const url = new URL('http://x?' + link.replace('scheduler?', ''));
        const locId = url.searchParams.get('loc');
        const date  = url.searchParams.get('date');
        Router.go('scheduler');
        setTimeout(() => {
            if (locId && typeof ScheduleGraphPage !== 'undefined') {
                ScheduleGraphPage._selectLocation(locId);
                if (date) {
                    setTimeout(() => UI._highlightScheduleCell(date), 800);
                }
            }
        }, 600);
    },

    _highlightScheduleCell(date) {
        const cells = document.querySelectorAll(`.sg-cell[data-date="${date}"]`);
        cells.forEach(cell => {
            cell.classList.add('sg-cell-highlight');
            cell.dataset.highlightDate = date;
            const clear = () => {
                cell.classList.remove('sg-cell-highlight');
                cell.removeEventListener('click', clear);
            };
            cell.addEventListener('click', clear);
        });
        cells[0]?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    },

    _showScheduleUpdatePopup(n) {
        document.getElementById('sg-upd-popup')?.remove();
        const isDelete = n.title?.includes('видалено');
        const el = document.createElement('div');
        el.id = 'sg-upd-popup';
        el.style.cssText = `
            position:fixed;bottom:24px;right:24px;z-index:9999;
            background:var(--bg-surface);border:1px solid var(--border);
            border-left:4px solid ${isDelete ? '#ef4444' : '#10b981'};border-radius:14px;
            padding:16px 18px;max-width:360px;
            box-shadow:0 8px 32px rgba(0,0,0,.18);
            animation:fadeSlideUp .25s cubic-bezier(.16,1,.3,1);
        `;
        el.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:10px">
                <div style="width:36px;height:36px;border-radius:50%;background:${isDelete ? 'rgba(239,68,68,.12)' : 'rgba(16,185,129,.12)'};color:${isDelete ? '#ef4444' : '#10b981'};display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${isDelete ? '🗑️' : '✅'}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:.88rem;color:var(--text-primary);margin-bottom:4px">${Fmt.esc(n.title || '')}</div>
                    <div style="font-size:.78rem;color:var(--text-muted);line-height:1.4">${Fmt.esc(n.message || '')}</div>
                    <div style="display:flex;gap:8px;margin-top:10px">
                        <button onclick="Router.go('schedule-graph?view=employee');document.getElementById('sg-upd-popup')?.remove()"
                            style="flex:1;padding:6px 10px;border-radius:8px;border:none;background:var(--primary);color:#fff;font-size:.78rem;font-weight:600;cursor:pointer">
                            Мій графік
                        </button>
                        <button onclick="document.getElementById('sg-upd-popup').remove()"
                            style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-size:.78rem;cursor:pointer">
                            Закрити
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 15000);
    },

    _showSubAvailablePopup(n) {
        const id = 'sg-sub-popup-' + Date.now();
        const el = document.createElement('div');
        el.id = id;
        el.style.cssText = `
            position:fixed;bottom:${24 + document.querySelectorAll('[id^=sg-sub-popup]').length * 96}px;right:24px;z-index:9999;
            background:var(--bg-surface);border:1px solid var(--border);
            border-left:4px solid #10b981;border-radius:14px;
            padding:16px 18px;max-width:360px;
            box-shadow:0 8px 32px rgba(0,0,0,.18);
            animation:fadeSlideUp .25s cubic-bezier(.16,1,.3,1);
        `;
        el.innerHTML = `
            <button onclick="document.getElementById('${id}').remove()"
                title="Закрити"
                style="position:absolute;top:8px;right:8px;width:22px;height:22px;border-radius:50%;border:none;background:transparent;color:var(--text-muted);font-size:.85rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,color .15s"
                onmouseover="this.style.background='var(--bg-hover)';this.style.color='var(--text-primary)'"
                onmouseout="this.style.background='transparent';this.style.color='var(--text-muted)'">✕</button>
            <div style="display:flex;align-items:flex-start;gap:10px;padding-right:16px">
                <div style="width:36px;height:36px;border-radius:50%;background:rgba(16,185,129,.12);color:#10b981;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">🙋</div>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:.88rem;color:var(--text-primary);margin-bottom:4px">${Fmt.esc(n.title || '')}</div>
                    <div style="font-size:.78rem;color:var(--text-muted);line-height:1.4">${Fmt.esc(n.message || '')}</div>
                    <div style="display:flex;gap:8px;margin-top:10px">
                        <button onclick="UI._openSchedulerRequest(${JSON.stringify(n.link||'').replace(/"/g,'&quot;')});document.getElementById('${id}')?.remove()"
                            style="flex:1;padding:6px 10px;border-radius:8px;border:none;background:#10b981;color:#fff;font-size:.78rem;font-weight:600;cursor:pointer">
                            Відкрити графік
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(el);
        // No auto-close — persists until manager reads it
    },

    _showScheduleRequestPopup(n) {
        document.getElementById('sg-req-popup')?.remove();
        const el = document.createElement('div');
        el.id = 'sg-req-popup';
        el.style.cssText = `
            position:fixed;bottom:24px;right:24px;z-index:9999;
            background:var(--bg-surface);border:1px solid var(--border);
            border-left:4px solid #f59e0b;border-radius:14px;
            padding:16px 18px;max-width:360px;
            box-shadow:0 8px 32px rgba(0,0,0,.18);
            animation:fadeSlideUp .25s cubic-bezier(.16,1,.3,1);
        `;
        el.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:10px">
                <div style="width:36px;height:36px;border-radius:50%;background:rgba(245,158,11,.12);color:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">✏️</div>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:.88rem;color:var(--text-primary);margin-bottom:4px">${Fmt.esc(n.title || '')}</div>
                    <div style="font-size:.78rem;color:var(--text-muted);line-height:1.4">${Fmt.esc(n.message || '')}</div>
                    <div style="display:flex;gap:8px;margin-top:10px">
                        <button onclick="UI._openSchedulerRequest(${JSON.stringify(n.link||'').replace(/"/g,'&quot;')});document.getElementById('sg-req-popup')?.remove()"
                            style="flex:1;padding:6px 10px;border-radius:8px;border:none;background:var(--primary);color:#fff;font-size:.78rem;font-weight:600;cursor:pointer">
                            Відкрити графік
                        </button>
                        <button onclick="document.getElementById('sg-req-popup').remove()"
                            style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-size:.78rem;cursor:pointer">
                            Закрити
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 15000);
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
        const mobBell = document.getElementById('mob-ntf-badge');
        const bellBtn = document.getElementById('ntf-bell');
        [nav, bell, mobBell].forEach(el => {
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

    _newsPopupLatest: null,   // кешована остання новина

    async loadNewsCount() {
        if (!AppState.user?.id) return;
        try {
            const lastSeen = localStorage.getItem('news_last_seen') || '1970-01-01';
            const { data } = await supabase
                .from('news')
                .select('id, title, excerpt, thumbnail_url, thumbnail_position, published_at, created_at')
                .eq('is_published', true)
                .order('created_at', { ascending: false })
                .limit(20);

            if (!data || !data.length) return;

            // Зберігаємо останню для popup
            this._newsPopupLatest = data[0];

            // Рахуємо новіші за lastSeen
            const newOnes = data.filter(n => (n.published_at || n.created_at) > lastSeen);
            const count = newOnes.length;

            const badge  = document.getElementById('news-bell-badge');
            const newBtn = document.getElementById('news-bell');
            if (badge) {
                if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.classList.remove('hidden'); }
                else { badge.classList.add('hidden'); }
            }
            if (newBtn) newBtn.classList.toggle('has-unread', count > 0);
        } catch(_) {}
    },

    toggleNewsPopup() {
        const existing = document.getElementById('news-popup');
        if (existing) { existing.remove(); return; }

        const n = this._newsPopupLatest;
        if (!n) { Router.go('news'); return; }

        const url = n.thumbnail_url ? Fmt.safeUrl(n.thumbnail_url) : null;
        const pos = n.thumbnail_position || 'center';
        const date = Fmt.date(n.published_at || n.created_at);
        const excerpt = n.excerpt || '';

        const btn = document.getElementById('news-bell');
        const btnRect = btn ? btn.getBoundingClientRect() : { bottom: 60, right: 60 };
        const popupWidth = 380;
        const leftPos = Math.max(8, btnRect.right - popupWidth);
        const topPos  = btnRect.bottom + 8;

        const popup = document.createElement('div');
        popup.id = 'news-popup';
        popup.style.cssText = `position:fixed;z-index:9999;top:${topPos}px;left:${leftPos}px;width:${popupWidth}px`;
        popup.innerHTML = `
            <style>
            #news-popup{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);box-shadow:0 8px 32px rgba(0,0,0,.18);overflow:hidden;animation:np-in .18s ease}
            @keyframes np-in{from{opacity:0;transform:translateY(-8px) scale(.97)}to{opacity:1;transform:none}}
            .np-hero{height:140px;position:relative;overflow:hidden;cursor:pointer}
            .np-hero-bg{position:absolute;inset:-8px;background-size:cover;background-position:${pos} center;filter:blur(14px) brightness(.4) saturate(1.2);transform:scale(1.05)}
            .np-hero-img{position:absolute;inset:0;background-size:contain;background-repeat:no-repeat;background-position:center center;z-index:1}
            .np-hero-grad{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.65) 0%,transparent 60%)}
            .np-hero-date{position:absolute;bottom:.6rem;right:.75rem;font-size:.65rem;color:#fff;z-index:2;background:rgba(0,0,0,.45);padding:.15rem .45rem;border-radius:6px;backdrop-filter:blur(4px)}
            .np-body{padding:.85rem 1rem .75rem}
            .np-title{font-size:.9rem;font-weight:700;line-height:1.4;color:var(--text-primary);margin-bottom:.35rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer}
            .np-title:hover{color:var(--primary)}
            .np-excerpt{font-size:.78rem;color:var(--text-secondary);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:.65rem}
            .np-footer{display:flex;gap:.5rem;justify-content:space-between;align-items:center}
            .np-badge{font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#f59e0b;background:rgba(245,158,11,.1);padding:2px 8px;border-radius:20px;border:1px solid rgba(245,158,11,.25)}
            </style>
            <div class="np-hero" onclick="UI._openNewsFromPopup('${n.id}')">
                ${url ? `<div class="np-hero-bg" style="background-image:url('${url}')"></div>
                         <div class="np-hero-img" style="background-image:url('${url}')"></div>` : ''}
                <div class="np-hero-grad"></div>
                <div class="np-hero-date">${date}</div>
            </div>
            <div class="np-body">
                <div class="np-title" onclick="UI._openNewsFromPopup('${n.id}')">${Fmt.esc(n.title)}</div>
                ${excerpt ? `<div class="np-excerpt">${Fmt.esc(excerpt)}</div>` : ''}
                <div class="np-footer">
                    <span class="np-badge">Новини</span>
                    <button class="btn btn-ghost btn-sm" onclick="UI._dismissNewsPopup();Router.go('news')" style="font-size:.72rem">
                        Всі новини <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            </div>`;

        document.body.appendChild(popup);

        // Закрити при кліку поза popup
        setTimeout(() => {
            document.addEventListener('click', function _close(e) {
                if (!popup.contains(e.target) && e.target.id !== 'news-bell') {
                    popup.remove();
                    document.removeEventListener('click', _close);
                }
            });
        }, 50);
    },

    _openNewsFromPopup(id) {
        this._dismissNewsPopup();
        // Скидаємо бейдж
        localStorage.setItem('news_last_seen', new Date().toISOString());
        const badge = document.getElementById('news-bell-badge');
        if (badge) badge.classList.add('hidden');
        const btn = document.getElementById('news-bell');
        if (btn) btn.classList.remove('has-unread');
        Router.go(`news/${id}`);
    },

    _dismissNewsPopup() {
        document.getElementById('news-popup')?.remove();
    },

    toggleHistoryPopup() {
        const existing = document.getElementById('history-popup');
        if (existing) { existing.remove(); return; }

        const items = (() => {
            try { return JSON.parse(localStorage.getItem('lms_rv_' + (AppState.user?.id || 'anon')) || '[]'); } catch { return []; }
        })().slice(0, 20);

        const btn = document.getElementById('history-bell');
        const btnRect = btn ? btn.getBoundingClientRect() : { bottom: 60, right: 60 };
        const popupWidth = 320;
        const leftPos = Math.max(8, btnRect.right - popupWidth);
        const topPos  = btnRect.bottom + 8;

        const typeLabel = { course: 'Курс', news: 'Новина', document: 'Документ', test: 'Тест', survey: 'Опитування', resource: 'Матеріал' };
        const ago = (ts) => {
            const m = Math.floor((Date.now() - ts) / 60000);
            if (m < 1) return 'щойно';
            if (m < 60) return `${m} хв тому`;
            const h = Math.floor(m / 60);
            if (h < 24) return `${h} год тому`;
            return `${Math.floor(h / 24)} дн тому`;
        };

        const listHtml = items.length ? items.map(item => `
            <div class="hp-item" onclick="document.getElementById('history-popup')?.remove();Router.go(${JSON.stringify(item.route).replace(/"/g,'&quot;')})">
                <div class="hp-icon" style="background:${item.color}22;color:${item.color}">
                    <i class="fa-solid ${item.icon || 'fa-file'}"></i>
                </div>
                <div class="hp-info">
                    <div class="hp-title">${Fmt.esc(item.title)}</div>
                    <div class="hp-meta">
                        <span class="hp-badge" style="color:${item.color}">${typeLabel[item.type] || item.type}</span>
                        <span class="hp-ago">${ago(item.viewedAt)}</span>
                    </div>
                </div>
            </div>`).join('')
        : `<div style="padding:2rem 1rem;text-align:center;color:var(--text-muted);font-size:.85rem"><i class="fa-solid fa-clock-rotate-left" style="font-size:1.8rem;display:block;margin-bottom:.5rem;opacity:.3"></i>Список порожній</div>`;

        const popup = document.createElement('div');
        popup.id = 'history-popup';
        popup.innerHTML = `
<style>
#history-popup{position:fixed;z-index:9100;width:${popupWidth}px;top:${topPos}px;left:${leftPos}px;background:var(--bg-surface);border:1.5px solid var(--border);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden;animation:hp-drop .15s ease}
@keyframes hp-drop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.hp-head{display:flex;align-items:center;gap:.5rem;padding:.7rem 1rem;border-bottom:1px solid var(--border);background:var(--bg-raised)}
.hp-head-icon{width:28px;height:28px;border-radius:8px;background:rgba(99,102,241,.12);color:#6366f1;display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0}
.hp-head-title{font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-primary);flex:1}
.hp-clear{font-size:.72rem;color:var(--text-muted);cursor:pointer;padding:.15rem .4rem;border-radius:6px;border:none;background:none}
.hp-clear:hover{color:#ef4444}
.hp-list{max-height:420px;overflow-y:auto;scrollbar-width:thin}
.hp-item{display:flex;align-items:center;gap:.7rem;padding:.6rem 1rem;cursor:pointer;transition:background .12s;border-bottom:1px solid var(--border)}
.hp-item:last-child{border-bottom:none}
.hp-item:hover{background:var(--bg-raised)}
.hp-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.82rem;flex-shrink:0}
.hp-info{flex:1;min-width:0}
.hp-title{font-size:.83rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hp-meta{display:flex;align-items:center;gap:.4rem;margin-top:.1rem}
.hp-badge{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.hp-ago{font-size:.68rem;color:var(--text-muted)}
</style>
<div class="hp-head">
    <div class="hp-head-icon"><i class="fa-solid fa-clock-rotate-left"></i></div>
    <span class="hp-head-title">Нещодавно переглянуті</span>
    ${items.length ? `<button class="hp-clear" onclick="UI._clearHistory()">Очистити</button>` : ''}
</div>
<div class="hp-list">${listHtml}</div>`;

        document.body.appendChild(popup);

        const close = (e) => {
            if (!popup.contains(e.target) && e.target.id !== 'history-bell') {
                popup.remove();
                document.removeEventListener('mousedown', close);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', close), 50);
    },

    _clearHistory() {
        try { localStorage.removeItem('lms_rv_' + (AppState.user?.id || 'anon')); } catch {}
        document.getElementById('history-popup')?.remove();
        const badge = document.getElementById('history-bell-badge');
        if (badge) badge.classList.add('hidden');
    },
    // Звужує пункти сайдбару, якщо для цього акаунта superadmin налаштував
    // персональні обмеження (AppState._navAllowed, кешується в Auth._loadProfile
    // за grantами з admin_tab_permissions з префіксом 'nav:'). null = без обмежень.
    _applyNavRestriction(sections) {
        if (!AppState._navAllowed) return sections;
        return sections
            .map(s => ({ ...s, items: s.items.filter(i => AppState._navAllowed.has(i.route)) }))
            .filter(s => s.items.length > 0);
    },
    _getNavItems(role) {
        const expertItem   = { icon: '<i class="fa-solid fa-book-open" style="color:#a78bfa"></i>', label: 'Моє навчання', route: 'expert-path', badgeId: 'nav-learn-badge' };
        const common = [
            { icon: '<i class="fa-solid fa-house"     style="color:#C9A227"></i>', label: 'Головна', route: 'dashboard', impBadgeId: 'nav-imp-bolt' },
            expertItem,
            // { icon: '<img src="/news.png" style="width:18px;height:18px;object-fit:contain;display:inline-block;vertical-align:middle;filter:none">', label: 'Новини',  route: 'news' }
        ];
        const collectionsItem = { icon: '<i class="fa-solid fa-wand-magic-sparkles" style="background:linear-gradient(135deg,#818cf8,#c084fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-size:1rem"></i>', label: 'Сторінки', route: 'collections' };
        const contentItems = [
            ...common,
            { icon: '<i class="fa-solid fa-folder-open"   style="color:#C9A227"></i>',  label: 'База знань',        route: 'knowledge-base' },
            { icon: '<i class="fa-solid fa-file-lines"    style="color:#f87171"></i>',  label: 'Документи',         route: 'documents', badgeId: 'nav-doc-badge' },
        ];
        const ntfItem      = { icon: '<i class="fa-solid fa-bell"         style="color:#C9A227"></i>', label: 'Сповіщення', route: 'notifications', badgeId: 'nav-ntf-badge' };
        const contactsItem = { icon: '<i class="fa-solid fa-address-book" style="color:#059669"></i>', label: 'Контакти',   route: 'contacts' };
        const bmItem       = { icon: '<i class="fa-solid fa-bookmark"     style="color:#FBBF24"></i>', label: 'Закладки',   route: 'bookmarks', noStar: true };
        const analyticsItem   = { icon: '<i class="fa-solid fa-chart-bar"    style="color:#34d399"></i>', label: 'Аналітика',        route: 'analytics' };
        const schedulerItem   = { icon: '<i class="fa-solid fa-calendar-days" style="color:#60a5fa"></i>', label: 'Розділ планування', route: 'scheduler' };
        const schedulerItemNs = { icon: '<i class="fa-solid fa-calendar-days" style="color:#60a5fa"></i>', label: 'Розділ планування', route: 'scheduler', noStar: true };
        const adminItem       = { icon: '<i class="fa-solid fa-gear"          style="color:#f87171"></i>', label: 'Адміністрування',   route: 'admin' };
        const contentAdmItem  = { icon: '<i class="fa-solid fa-gear"          style="color:#f87171"></i>', label: 'Контент',           route: 'admin' };
        const myCalendarItem  = { icon: '<i class="fa-solid fa-calendar-check" style="color:#60a5fa"></i>', label: 'Мій календар',     route: 'my-calendar', noStar: true };
        const internsItem     = { icon: '<i class="fa-solid fa-user-graduate"  style="color:#8b5cf6"></i>', label: 'Стажери',          route: 'interns' };

        if (role === 'ceo') {
            return this._applyNavRestriction([
                { title: 'Навчання',    items: contentItems },
                { title: 'Управління',  items: [ analyticsItem, schedulerItem, adminItem ] },
                { title: 'Особисте',    items: [ contactsItem, bmItem ] }
            ]);
        }
        if (role === 'superadmin' || role === 'admin') {
            return this._applyNavRestriction([
                { title: 'Навчання',    items: contentItems },
                { title: 'Управління',  items: [ analyticsItem, collectionsItem, schedulerItem, internsItem, adminItem ] },
                { title: 'Особисте',    items: [ contactsItem, bmItem ] }
            ]);
        }
        if (role === 'manager') {
            return this._applyNavRestriction([
                { title: 'Навчання',   items: contentItems },
                { title: 'Управління', items: [ schedulerItem, internsItem ] },
                { title: 'Особисте',   items: [ contactsItem, bmItem ] }
            ]);
        }
        if (role === 'smm') {
            return this._applyNavRestriction([
                { title: 'Навчання',   items: contentItems },
                { title: 'Управління', items: [ analyticsItem, contentAdmItem, schedulerItemNs ] },
                { title: 'Особисте',   items: [ contactsItem, bmItem ] }
            ]);
        }
        // Стажер: навчання + закладки, без документів/контактів/сповіщень
        if (AppState.isIntern()) {
            const internContentItems = [
                ...common,
                { icon: '<i class="fa-solid fa-folder-open" style="color:#C9A227"></i>', label: 'База знань', route: 'knowledge-base' },
            ];
            return [
                { title: 'Навчання',  items: internContentItems },
                { title: 'Особисте',  items: [ bmItem ] }
            ];
        }
        return [
            { title: 'Навчання',  items: contentItems },
            { title: 'Особисте',  items: [ contactsItem, schedulerItemNs, bmItem ] }
        ];
    },
    applyMobNavRestrictions() {
        // Для адмінів/суперадмінів — замінюємо "Навчання" на "Оповіщення"
        const learnBtn = document.getElementById('mob-learn-btn');
        if (learnBtn) {
            if (AppState.isAdmin()) {
                learnBtn.onclick = () => Router.go('notifications');
                learnBtn.dataset.route = 'notifications';
                learnBtn.innerHTML = '<i class="fa-solid fa-bell"></i><span>Сповіщення</span>';
            } else {
                learnBtn.onclick = () => Router.go('expert-path');
                learnBtn.dataset.route = 'expert-path';
                learnBtn.innerHTML = '<i class="fa-solid fa-book-open"></i><span>Навчання</span>';
            }
        }

        // Для адмінів/суперадмінів — замінюємо "Новини" на "Адмінка"
        const newsBtn = document.getElementById('mob-news-btn');
        if (newsBtn) {
            if (AppState.isAdmin()) {
                newsBtn.onclick = () => Router.go('admin');
                newsBtn.dataset.route = 'admin';
                newsBtn.innerHTML = '<i class="fa-solid fa-gear"></i><span>Адмінка</span>';
            } else {
                newsBtn.onclick = () => Router.go('news');
                newsBtn.dataset.route = 'news';
                newsBtn.innerHTML = '<i class="fa-solid fa-newspaper"></i><span>Новини</span>';
            }
        }

        // Для адмінів — замінюємо кнопку "Закладки" на "Pleso"
        const bmBtn = document.getElementById('mob-bookmarks-btn');
        if (bmBtn) {
            if (AppState.isAdmin()) {
                bmBtn.onclick = () => Router.go('admin?tab=pleso');
                bmBtn.dataset.route = 'admin';
                bmBtn.innerHTML = '<i class="fa-solid fa-tag"></i><span>Pleso</span>';
            } else {
                bmBtn.onclick = () => Router.go('bookmarks');
                bmBtn.dataset.route = 'bookmarks';
                bmBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i><span>Закладки</span>';
            }
        }

        // Для адмінів — замінюємо кнопку "Профіль" на "Довірені IP"
        const profBtn = document.getElementById('mob-profile-btn');
        if (profBtn) {
            if (AppState.isAdmin()) {
                profBtn.onclick = () => Router.go('admin?tab=trusted-ips');
                profBtn.dataset.route = 'trusted-ips';
                profBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i><span>Довірені IP</span>';
            } else {
                profBtn.onclick = () => Router.go('profile');
                profBtn.dataset.route = 'profile';
                profBtn.innerHTML = '<i class="fa-solid fa-circle-user"></i><span>Профіль</span>';
            }
        }

        // profile не потребує довіреної мережі — тому в allowed
        const allowed = new Set(['dashboard', 'news', 'profile']);
        if (AppState.isAdmin()) { allowed.add('admin'); allowed.add('trusted-ips'); }
        document.querySelectorAll('.mob-nav-btn').forEach(btn => {
            const route = btn.dataset.route;
            const blocked = !AppState.isTrustedNetwork && route && !allowed.has(route);
            btn.classList.toggle('mob-nav-btn-blocked', blocked);
            // прибираємо старий значок якщо є
            btn.querySelector('.mob-blocked-icon')?.remove();
            if (blocked) {
                const icon = document.createElement('span');
                icon.className = 'mob-blocked-icon';
                icon.innerHTML = '<i class="fa-solid fa-ban"></i>';
                btn.querySelector('i')?.parentElement?.appendChild(icon) || btn.prepend(icon);
            }
        });
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
        document.querySelectorAll('.mob-nav-btn').forEach(el => {
            el.classList.toggle('active', el.dataset.route === parentRoute);
        });
    },
    renderSidebarUser(profile) {
        const initials = Fmt.initials(profile?.full_name);
        const avatarHtml = profile?.avatar_url
            ? `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : initials;

        const isTopRole = profile?.role === 'superadmin' || profile?.role === 'admin';
        const crownHtml = isTopRole ? '<i class="fa-solid fa-crown" style="color:#C9A227;font-size:.65rem"></i>'
                        : profile?.role === 'ceo' ? '<i class="fa-solid fa-crown" style="color:#a78bfa;font-size:.65rem"></i>' : '';
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
        this.initRoleSwitcher();
        popup.classList.remove('hidden');
        requestAnimationFrame(() => popup.classList.add('open'));
        document.getElementById('su-chevron-icon')?.classList.add('su-rotated');
        if (!this._boundPopupHandler) {
            this._boundPopupHandler = e => {
                if (!document.getElementById('su-popup')?.contains(e.target) &&
                    !document.getElementById('header-user')?.contains(e.target)) {
                    this.closeUserPopup();
                }
            };
        }
        setTimeout(() => document.addEventListener('click', this._boundPopupHandler), 0);
    },

    closeUserPopup() {
        const popup = document.getElementById('su-popup');
        if (!popup) return;
        popup.classList.remove('open');
        document.getElementById('su-chevron-icon')?.classList.remove('su-rotated');
        setTimeout(() => popup.classList.add('hidden'), 180);
        document.removeEventListener('click', this._boundPopupHandler);
    },

    initRoleSwitcher() {
        // Видно лише справжньому superadmin (base_role) — незалежно від того,
        // яку роль він зараз тестує, інакше він втратить UI-шлях назад.
        const section = document.getElementById('su-roleswitch-section');
        if (!section) return;
        if (AppState.profile?.base_role !== 'superadmin') { section.classList.add('hidden'); return; }
        section.classList.remove('hidden');

        const ROLES = [
            { role: 'admin',   label: 'Адміністратор', icon: 'fa-user-shield' },
            { role: 'smm',     label: 'SMM',            icon: 'fa-pen-nib' },
            { role: 'manager', label: 'Керівник',       icon: 'fa-briefcase' },
            { role: 'ceo',     label: 'CEO',            icon: 'fa-crown' },
            { role: 'user',    label: 'Користувач',     icon: 'fa-user' },
            { role: 'intern',  label: 'Стажер',         icon: 'fa-seedling' },
        ];

        const current = AppState.profile?.role;
        const container = document.getElementById('su-roleswitch-btns');
        if (!container) return;
        container.innerHTML = ROLES.map(r => `
            <button onclick="UI.closeUserPopup();AppState.switchRole('${r.role}').catch(e=>Toast.error('Помилка', e.message))"
                style="display:flex;align-items:center;gap:.6rem;padding:.4rem .5rem;border-radius:6px;
                       border:none;background:${r.role===current?'var(--primary-muted, rgba(99,102,241,.12))':'transparent'};
                       color:${r.role===current?'var(--primary)':'var(--text-secondary)'};
                       font-size:.82rem;font-weight:${r.role===current?'600':'400'};
                       cursor:pointer;text-align:left;width:100%;transition:background .15s"
                onmouseenter="this.style.background='var(--bg-hover)'"
                onmouseleave="this.style.background='${r.role===current?'var(--primary-muted, rgba(99,102,241,.12))':'transparent'}'">
                <i class="fa-solid ${r.icon}" style="width:14px;text-align:center"></i>
                <span>${r.label}</span>
                ${r.role===current ? '<i class="fa-solid fa-check" style="margin-left:auto;font-size:.7rem"></i>' : ''}
            </button>`).join('');

        // Якщо зараз в режимі тестування — показуємо кнопку "Повернутись"
        if (AppState.isRoleSwitched()) {
            container.insertAdjacentHTML('afterbegin', `
                <button onclick="UI.closeUserPopup();AppState.exitRoleSwitch().catch(e=>Toast.error('Помилка', e.message))"
                    style="display:flex;align-items:center;gap:.6rem;padding:.4rem .5rem;border-radius:6px;
                           border:1px solid var(--primary);background:transparent;
                           color:var(--primary);font-size:.82rem;font-weight:600;
                           cursor:pointer;text-align:left;width:100%;margin-bottom:4px;transition:background .15s"
                    onmouseenter="this.style.background='var(--bg-hover)'"
                    onmouseleave="this.style.background='transparent'">
                    <i class="fa-solid fa-rotate-left" style="width:14px;text-align:center"></i>
                    <span>Повернутись (SuperAdmin)</span>
                </button>`);
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
            const seeAll = AppState.isAdmin() || AppState.isManager();
            const { data: docs } = await supabase
                .from('resources')
                .select('id, doc_version, resource_dovirenosti(dovirenost_id)')
                .eq('is_tracked_download', true)
                .is('deleted_at', null)
                .is('lesson_id', null);
            if (!docs?.length) return;

            let filtered = docs;
            if (!seeAll) {
                const myDovs = await API.dovirenosti.getForProfile(AppState.user.id).catch(() => []);
                const myDovIds = new Set(myDovs.map(d => d.id));
                filtered = docs.filter(d => {
                    const linked = d.resource_dovirenosti || [];
                    if (!linked.length) return true;
                    return linked.some(r => myDovIds.has(r.dovirenost_id));
                });
            }

            if (!filtered.length) return;
            const ackMap = await API.documentDownloads.getMyLatest(filtered.map(d => d.id));
            const unread = filtered.filter(d => {
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
    },

    // Total pending assignments (tests + courses + surveys) shown on "Моє навчання".
    // Mirrors ExpertPathPage._fetchAndShowCounts()'s per-tab logic, summed into one badge.
    async loadLearnBadge() {
        if (!AppState.user?.id) return;
        try {
            const uid = AppState.user.id;
            const canManage = AppState.isAdmin() || AppState.profile?.role === 'smm' || AppState.isStaff();
            const today = new Date().toISOString().slice(0, 10);

            const [enrollments, assignments, attempts, surveys, surveyResponses, surveyAssignments] = await Promise.all([
                supabase.from('enrollments').select('id, completed_at, run_id, course_runs(end_date)').eq('user_id', uid),
                supabase.from('test_assignments').select('test_id').eq('user_id', uid),
                supabase.from('test_attempts').select('test_id, completed_at').eq('user_id', uid).not('completed_at', 'is', null),
                supabase.from('surveys').select('id').eq('is_published', true),
                supabase.from('survey_responses').select('survey_id').eq('user_id', uid),
                canManage ? Promise.resolve({ data: null }) : supabase.from('survey_assignments').select('survey_id').eq('user_id', uid),
            ]);

            const completedTestIds   = new Set((attempts.data || []).map(a => a.test_id));
            const respondedSurveyIds = new Set((surveyResponses.data || []).map(r => r.survey_id));

            const allEnr       = enrollments.data || [];
            const completedEnr = allEnr.filter(e => e.completed_at || (e.course_runs?.end_date && e.course_runs.end_date < today));
            const activeEnr    = allEnr.filter(e => !completedEnr.includes(e));
            const activeTests  = (assignments.data || []).filter(a => !completedTestIds.has(a.test_id));

            let activeSurveys;
            if (canManage) {
                activeSurveys = (surveys.data || []).filter(s => !respondedSurveyIds.has(s.id));
            } else {
                const assignedSurveyIds = new Set((surveyAssignments.data || []).map(a => a.survey_id));
                activeSurveys = (surveys.data || []).filter(s => assignedSurveyIds.has(s.id) && !respondedSurveyIds.has(s.id));
            }

            const total = activeEnr.length + activeTests.length + activeSurveys.length;
            const badge = document.getElementById('nav-learn-badge');
            if (!badge) return;
            if (total > 0) {
                badge.textContent = total > 99 ? '99+' : total;
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
        return { superadmin: 'SuperAdmin', ceo: 'CEO', admin: 'Адміністратор', smm: 'SMM-менеджер', manager: 'Керівник', user: 'Користувач', intern: 'Стажер', student: 'Користувач' }[r] || r || '—';
    },
    roleBadge(r) {
        if (r === 'superadmin') return `<span class="badge badge-warning">👑 SuperAdmin</span>`;
        if (r === 'ceo')     return `<span class="badge badge-ceo">👑 CEO</span>`;
        if (r === 'admin')   return `<span class="badge badge-admin">👑 Адміністратор</span>`;
        if (r === 'smm')     return `<span class="badge badge-info">📰 SMM-менеджер</span>`;
        if (r === 'manager') return `<span class="badge badge-manager">👔 Керівник</span>`;
        if (r === 'intern')  return `<span class="badge badge-success">🌱 Стажер</span>`;
        if (r === 'user' || r === 'student')
            return `<span class="badge" style="background:none;border:none;color:#d946ef;text-shadow:0 0 8px rgba(217,70,239,.4);padding-left:0;padding-right:0">💎 ${Fmt.role(r)}</span>`;
        return `<span class="badge badge-muted">${Fmt.role(r)}</span>`;
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

// Auto-detect gender from patronymic and set gender-picker chips
function applyGenderFromPatronymic(patronymicInputId, genderInputId) {
    const val = (document.getElementById(patronymicInputId)?.value || '').trim().toLowerCase();
    let gender = '';
    if (val.includes('ович') || val.includes('евич') || val.includes('євич')) gender = 'male';
    else if (val.includes('овна') || val.includes('івна') || val.includes('євна') || val.includes('ївна')) gender = 'female';
    if (!gender) return;
    const inp = document.getElementById(genderInputId);
    if (!inp) return;
    inp.value = gender;
    inp.closest('.gender-picker-modern, .cuf-gender')?.querySelectorAll('.gender-chip, .cuf-gender-chip').forEach(b => {
        b.classList.toggle('active',
            (gender === 'male'   && b.textContent.includes('Чоловік')) ||
            (gender === 'female' && b.textContent.includes('Жінка'))
        );
    });
}

// Reusable custom calendar datepicker (same visual pattern/`.idp-*` classes as
// interns.js's schedule-row picker) — supports multiple independent instances
// on one page, keyed by popupId, so several fields can each have their own.
const DatePicker = {
    _state: {},
    _outsideFns: {},

    toggle(hiddenId, dispId, popupId, e) {
        e?.stopPropagation();
        const popup = document.getElementById(popupId);
        if (!popup) return;
        popup.style.display === 'none' ? this.open(hiddenId, dispId, popupId) : this.close(popupId);
    },

    open(hiddenId, dispId, popupId) {
        const val = document.getElementById(hiddenId)?.value || '';
        const d = val ? new Date(val + 'T00:00:00') : new Date();
        this._state[popupId] = { year: d.getFullYear(), month: d.getMonth(), sel: val || null, hiddenId, dispId };
        this._render(popupId);
        const popup = document.getElementById(popupId);
        if (popup) popup.style.display = 'block';
        const fn = (e) => {
            if (!e.target.closest(`#${popupId}`) && e.target.id !== dispId) this.close(popupId);
        };
        this._outsideFns[popupId] = fn;
        setTimeout(() => document.addEventListener('click', fn), 0);
    },

    close(popupId) {
        const popup = document.getElementById(popupId);
        if (popup) popup.style.display = 'none';
        const fn = this._outsideFns[popupId];
        if (fn) { document.removeEventListener('click', fn); delete this._outsideFns[popupId]; }
    },

    nav(popupId, dir) {
        const st = this._state[popupId];
        if (!st) return;
        st.month += dir;
        if (st.month > 11) { st.month = 0; st.year++; }
        if (st.month < 0)  { st.month = 11; st.year--; }
        this._render(popupId);
    },

    onPaste(hiddenId, dispId, e) {
        const text = (e.clipboardData || window.clipboardData).getData('text').trim();
        const m = text.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/);
        if (!m) return;
        e.preventDefault();
        const day = +m[1], month = +m[2], year = +m[3];
        const d = new Date(year, month - 1, day);
        if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return;
        const pad = n => String(n).padStart(2, '0');
        const disp = document.getElementById(dispId);
        const hidden = document.getElementById(hiddenId);
        if (disp) disp.value = `${pad(day)}.${pad(month)}.${year}`;
        if (hidden) hidden.value = `${year}-${pad(month)}-${pad(day)}`;
        hidden?.dispatchEvent(new Event('input', { bubbles: true }));
    },

    onType(hiddenId, dispId, e) {
        const input = e.target;
        let digits = input.value.replace(/\D/g, '').slice(0, 8);
        let out = digits.slice(0, 2);
        if (digits.length > 2) out += '.' + digits.slice(2, 4);
        if (digits.length > 4) out += '.' + digits.slice(4, 8);
        input.value = out;
        const hidden = document.getElementById(hiddenId);
        if (digits.length === 8) {
            const day = +digits.slice(0, 2), month = +digits.slice(2, 4), year = +digits.slice(4, 8);
            const d = new Date(year, month - 1, day);
            if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
                const pad = n => String(n).padStart(2, '0');
                if (hidden) hidden.value = `${year}-${pad(month)}-${pad(day)}`;
                hidden?.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }
        }
        if (hidden) hidden.value = '';
    },

    pick(popupId, ds) {
        const st = this._state[popupId];
        if (!st) return;
        const hidden = document.getElementById(st.hiddenId);
        const disp   = document.getElementById(st.dispId);
        if (hidden) hidden.value = ds;
        if (disp) disp.value = ds ? ds.split('-').reverse().join('.') : '';
        st.sel = ds || null;
        this.close(popupId);
        hidden?.dispatchEvent(new Event('input', { bubbles: true }));
    },

    _render(popupId) {
        const st = this._state[popupId];
        const popup = document.getElementById(popupId);
        if (!st || !popup) return;
        const MN = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                    'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
        const DN = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
        const y = st.year, m = st.month;
        const pad = n => String(n).padStart(2,'0');
        const td = new Date(); td.setHours(0,0,0,0);
        const todayStr = `${td.getFullYear()}-${pad(td.getMonth()+1)}-${pad(td.getDate())}`;
        let dow = new Date(y, m, 1).getDay(); dow = dow === 0 ? 6 : dow - 1;
        const dim = new Date(y, m+1, 0).getDate();
        const prevDim = new Date(y, m, 0).getDate();
        let cells = '';
        for (let i = dow-1; i >= 0; i--) cells += `<div class="idp-cell idp-other">${prevDim-i}</div>`;
        for (let d = 1; d <= dim; d++) {
            const ds = `${y}-${pad(m+1)}-${pad(d)}`;
            cells += `<div class="idp-cell${ds===todayStr?' idp-today':''}${ds===st.sel?' idp-sel':''}" onclick="DatePicker.pick('${popupId}','${ds}')">${d}</div>`;
        }
        const rem = (dow + dim) % 7; if (rem) for (let d=1; d<=7-rem; d++) cells += `<div class="idp-cell idp-other">${d}</div>`;
        popup.innerHTML = `
            <div class="idp-header">
                <button class="idp-nav" onclick="DatePicker.nav('${popupId}',-1);event.stopPropagation()">‹</button>
                <span class="idp-month-lbl">${MN[m]} ${y}</span>
                <button class="idp-nav" onclick="DatePicker.nav('${popupId}',1);event.stopPropagation()">›</button>
            </div>
            <div class="idp-grid-head">${DN.map(d=>`<div class="idp-dow">${d}</div>`).join('')}</div>
            <div class="idp-grid">${cells}</div>
            <div class="idp-footer">
                <button class="idp-fb" onclick="DatePicker.pick('${popupId}','')">Очистити</button>
                <button class="idp-fb idp-fb-today" onclick="DatePicker.pick('${popupId}','${todayStr}')">Сьогодні</button>
            </div>`;
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

// ── Ukrainian date-time picker ──────────────────────────────────────
// Drop-in replacement for <input type="datetime-local"> — Chrome/Edge always render
// the native picker in the OS UI language, ignoring the page's lang="uk", so we render
// our own. The real value lives on a hidden input with the *same id and value format*
// (YYYY-MM-DDTHH:mm) the native control used, so existing Dom.val()/`.value` reads,
// and onchange/oninput attributes written directly on the input, keep working unchanged.
const UaDateTime = {
    _months:    ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'],
    _monthsGen: ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'],
    _days:      ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'],
    _state:     null,

    // extraAttrs: raw HTML attributes to place on the hidden input (e.g. onchange="...")
    // opts.mode: 'datetime' (default, value 'YYYY-MM-DDTHH:mm') | 'date' (value 'YYYY-MM-DD', no time row)
    html(id, value = '', extraAttrs = '', opts = {}) {
        const mode  = opts.mode === 'date' ? 'date' : 'datetime';
        const label = value ? this._fmt(value, mode) : this._placeholder(mode);
        return `
        <div class="uadt-wrap" data-uadt="${id}" data-uadt-mode="${mode}">
            <button type="button" class="uadt-trigger" onclick="UaDateTime._toggle(this)">
                <i class="fa-regular fa-calendar uadt-trigger-ico"></i>
                <span class="uadt-txt">${label}</span>
                <i class="fa-solid fa-chevron-down uadt-trigger-chev"></i>
            </button>
            <input type="hidden" id="${id}" value="${value || ''}" ${extraAttrs}>
        </div>`;
    },

    _placeholder(mode) { return mode === 'date' ? 'Оберіть дату' : 'Оберіть дату й час'; },

    // Programmatic set (e.g. deadline presets) — updates hidden value + visible label,
    // mirrors what the native input's .value= assignment used to do (no change event).
    set(id, value) {
        const hidden = document.getElementById(id);
        if (!hidden) return;
        const wrap = document.querySelector(`.uadt-wrap[data-uadt="${id}"]`);
        const mode = wrap?.dataset.uadtMode === 'date' ? 'date' : 'datetime';
        hidden.value = value || '';
        const txt = wrap?.querySelector('.uadt-txt');
        if (txt) txt.textContent = value ? this._fmt(value, mode) : this._placeholder(mode);
    },

    _pad(n) { return String(n).padStart(2, '0'); },

    _fmt(value, mode = 'datetime') {
        const [datePart, timePart] = value.split('T');
        const [y, m, d] = datePart.split('-').map(Number);
        return `${this._pad(d)} ${this._monthsGen[m - 1]} ${y}${(mode !== 'date' && timePart) ? ', ' + timePart : ''}`;
    },

    _toggle(btn) {
        const wrap = btn.closest('.uadt-wrap');
        const existing = document.querySelector('.uadt-pop');
        const wasOpenForThis = existing && existing._forWrap === wrap;
        this._close();
        if (!wasOpenForThis) this._open(wrap);
    },

    _open(wrap) {
        const id = wrap.dataset.uadt;
        const mode = wrap.dataset.uadtMode === 'date' ? 'date' : 'datetime';
        const hidden = document.getElementById(id);
        const val = hidden?.value;
        let y, mo, d, h, mi;
        if (val) {
            const [datePart, timePart] = val.split('T');
            [y, mo, d] = datePart.split('-').map(Number);
            [h, mi] = (timePart || '00:00').split(':').map(Number);
        } else {
            const now = new Date();
            y = now.getFullYear(); mo = now.getMonth() + 1; d = now.getDate(); h = now.getHours(); mi = 0;
        }
        this._state = { id, mode, y, mo, d, h, mi, viewY: y, viewM: mo };
        const pop = document.createElement('div');
        pop.className = 'uadt-pop';
        pop._forWrap = wrap;
        pop.innerHTML = this._popHtml();
        document.body.appendChild(pop);
        this._position(wrap, pop);
    },

    _position(wrap, pop) {
        const r = wrap.getBoundingClientRect();
        pop.style.top  = (window.scrollY + r.bottom + 6) + 'px';
        pop.style.left = (window.scrollX + r.left) + 'px';
        requestAnimationFrame(() => {
            const pr = pop.getBoundingClientRect();
            if (pr.right > window.innerWidth - 8) pop.style.left = Math.max(8, window.scrollX + r.right - pr.width) + 'px';
            if (pr.bottom > window.innerHeight - 8 && r.top - pr.height - 6 > 0) pop.style.top = (window.scrollY + r.top - pr.height - 6) + 'px';
        });
    },

    _close() {
        document.querySelectorAll('.uadt-pop').forEach(p => p.remove());
    },

    _popHtml() {
        const s = this._state;
        const firstDow = (new Date(s.viewY, s.viewM - 1, 1).getDay() + 6) % 7; // Monday = 0
        const daysInMonth = new Date(s.viewY, s.viewM, 0).getDate();
        const cells = [];
        for (let i = 0; i < firstDow; i++) cells.push('<span class="uadt-cell uadt-cell-empty"></span>');
        for (let dd = 1; dd <= daysInMonth; dd++) {
            const isSel = dd === s.d && s.viewM === s.mo && s.viewY === s.y;
            cells.push(`<button type="button" class="uadt-cell${isSel ? ' sel' : ''}" onclick="UaDateTime._pickDay(${dd})">${dd}</button>`);
        }
        return `
        <div class="uadt-nav">
            <button type="button" class="uadt-nav-btn" onclick="UaDateTime._navMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button>
            <span class="uadt-nav-lbl">${this._months[s.viewM - 1]} ${s.viewY}</span>
            <button type="button" class="uadt-nav-btn" onclick="UaDateTime._navMonth(1)"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="uadt-dow">${this._days.map(d => `<span>${d}</span>`).join('')}</div>
        <div class="uadt-grid">${cells.join('')}</div>
        ${s.mode === 'date' ? '' : `
        <div class="uadt-time">
            <i class="fa-regular fa-clock"></i>
            <input type="number" min="0" max="23" class="uadt-time-inp" id="uadt-h" value="${this._pad(s.h)}" onchange="UaDateTime._setTime()">
            <span>:</span>
            <input type="number" min="0" max="59" class="uadt-time-inp" id="uadt-m" value="${this._pad(s.mi)}" onchange="UaDateTime._setTime()">
        </div>`}
        <div class="uadt-actions">
            <button type="button" class="uadt-btn uadt-btn-ghost" onclick="UaDateTime._clear()">Очистити</button>
            <button type="button" class="uadt-btn uadt-btn-primary" onclick="UaDateTime._apply()">Готово</button>
        </div>`;
    },

    _navMonth(dir) {
        const s = this._state;
        s.viewM += dir;
        if (s.viewM < 1)  { s.viewM = 12; s.viewY--; }
        if (s.viewM > 12) { s.viewM = 1;  s.viewY++; }
        this._refresh();
    },

    _pickDay(dd) {
        const s = this._state;
        s.d = dd; s.mo = s.viewM; s.y = s.viewY;
        this._refresh();
    },

    _setTime() {
        const s = this._state;
        const hEl = document.getElementById('uadt-h'), mEl = document.getElementById('uadt-m');
        if (!hEl || !mEl) return; // date-only mode has no time row
        s.h  = Math.max(0, Math.min(23, parseInt(hEl.value) || 0));
        s.mi = Math.max(0, Math.min(59, parseInt(mEl.value) || 0));
    },

    _refresh() {
        const pop = document.querySelector('.uadt-pop');
        if (pop) pop.innerHTML = this._popHtml();
    },

    _apply() {
        const s = this._state;
        this._setTime();
        const val = s.mode === 'date'
            ? `${s.y}-${this._pad(s.mo)}-${this._pad(s.d)}`
            : `${s.y}-${this._pad(s.mo)}-${this._pad(s.d)}T${this._pad(s.h)}:${this._pad(s.mi)}`;
        const hidden = document.getElementById(s.id);
        if (hidden) {
            hidden.value = val;
            hidden.dispatchEvent(new Event('input', { bubbles: true }));
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const wrap = document.querySelector(`.uadt-wrap[data-uadt="${s.id}"]`);
        const txt = wrap?.querySelector('.uadt-txt');
        if (txt) txt.textContent = this._fmt(val, s.mode);
        this._close();
    },

    _clear() {
        const s = this._state;
        const hidden = document.getElementById(s.id);
        if (hidden) {
            hidden.value = '';
            hidden.dispatchEvent(new Event('input', { bubbles: true }));
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const wrap = document.querySelector(`.uadt-wrap[data-uadt="${s.id}"]`);
        const txt = wrap?.querySelector('.uadt-txt');
        if (txt) txt.textContent = this._placeholder(s.mode);
        this._close();
    },

    init() {
        document.addEventListener('click', e => {
            if (e.target.closest('.uadt-pop') || e.target.closest('.uadt-trigger')) return;
            this._close();
        });
    }
};

// ── Theme ─────────────────────────────────────────────────────────
const Theme = {
    init() {
        // Apply from localStorage immediately (avoids flash before profile loads)
        const saved = localStorage.getItem('lms_theme') || 'light';
        this._apply(saved, false, false);
    },

    // Called after profile is loaded — syncs theme from DB to browser
    applyFromProfile(profile) {
        if (!profile) return;
        const theme = profile.ui_theme || 'light';
        localStorage.setItem('lms_theme', theme);
        this._apply(theme, false, false);
    },

    toggle() {
        const current = localStorage.getItem('lms_theme') || 'light';
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
// де admin/superadmin/smm може створювати нові значення прямо на місці.
const CreatableSelect = {
    // table: 'positions' | 'subdivisions'
    html(id, table, items, selected = '') {
        const selLabel = items.find(i => i === selected) ? selected : '';
        const canCreate = ['superadmin','admin','smm'].includes(AppState.profile?.role);
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
        if (!wrap) return;
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
        const rawName = input.value.trim();
        if (!rawName) return;
        const name = rawName.replace(/\s+/g, ' ');

        // перевірка дубліката (без урахування регістру й зайвих внутрішніх пробілів)
        const norm = s => s.trim().replace(/\s+/g, ' ').toLowerCase();
        const existing = [...wrap.querySelectorAll('.cs-opt[data-val]')]
            .find(o => norm(o.dataset.val) === norm(name));
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
            const canCreate = ['superadmin', 'admin'].includes(AppState.profile?.role);
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
            const canCreate = ['superadmin', 'admin'].includes(AppState.profile?.role);
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
            const rawName = input?.value?.trim();
            if (!rawName) return;
            const name = rawName.replace(/\s+/g, ' ');
            // Захист від дублів без урахування регістру й зайвих внутрішніх пробілів
            // (той самий патерн, що й CreatableSelect._confirmAdd) — на випадок
            // застарілого кешу options.
            const norm = s => s.trim().replace(/\s+/g, ' ').toLowerCase();
            const existing = _st(id).options.find(o => norm(o.name) === norm(name));
            if (existing) { _pick(id, existing.id, existing.name); _closeDrop(id); return; }
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
        const ddRoot = _portals[id] || wrap;
        const list = ddRoot.querySelector('.ms-list');
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

    // Portal map: id → dd element currently in document.body
    const _portals = {};

    function _open(id) {
        Object.keys(_s).forEach(k => { if (k !== id) _close(k); });
        const wrap = document.getElementById(`ms-wrap-${id}`);
        if (!wrap) return;
        wrap.classList.add('open');

        // Portal pattern: переносимо дропдаун в body щоб уникнути
        // overflow/transform containing-block проблем у вкладених таблицях
        const dd   = _portals[id] || wrap.querySelector('.ms-dropdown');
        const ctrl = wrap.querySelector('.ms-control');
        if (dd && ctrl) {
            const r = ctrl.getBoundingClientRect();
            // Перенести в body якщо ще не там
            if (dd.parentElement !== document.body) {
                document.body.appendChild(dd);
                _portals[id] = dd;
            }
            const ddWidth = r.width;
            let left = r.left;
            // Якщо виходить за правий край вікна — зсуваємо вліво
            const overflowRight = left + ddWidth - window.innerWidth;
            if (overflowRight > 0) left = left - overflowRight - 8;
            dd.style.cssText = `display:block;position:fixed;top:${r.bottom + 3}px;left:${left}px;width:${ddWidth}px;right:auto;z-index:9999`;
        }

        const inner = dd ? dd.querySelector('.ms-search-inner') : null;
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
        // Повертаємо dd із portal назад у wrap
        const dd = _portals[id];
        if (dd) {
            dd.style.cssText = '';
            wrap.appendChild(dd);
            delete _portals[id];
        }
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
            // close if click outside (враховуємо portal dd у body)
            Object.keys(_s).forEach(id => {
                const wrap = document.getElementById(`ms-wrap-${id}`);
                if (!wrap || !wrap.classList.contains('open')) return;
                const dd = _portals[id];
                if (!wrap.contains(e.target) && !(dd && dd.contains(e.target))) _close(id);
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
        // Гейт і actor_role — за справжньою роллю (base_role), а не поточною
        // перемкнутою: інакше аудит мовчки переставав писатись саме під час
        // тестування нижчої ролі, коли реальні мутації все ще відбуваються.
        const realRole = p?.base_role || p?.role;
        if (!p || !['superadmin','admin','smm'].includes(realRole)) return;
        const fullMeta = AppState.isRoleSwitched()
            ? { ...meta, acting_as: p.role }
            : (Object.keys(meta).length ? meta : null);
        try {
            await supabase.from('activity_logs').insert({
                user_id:     AppState.user.id,
                actor_name:  p.full_name,
                actor_role:  realRole,
                action,
                entity_type: entityType,
                entity_name: String(entityName || ''),
                meta: fullMeta
            });
        } catch(e) {
            console.warn('AuditLog.write failed:', e.message);
        }
    }
};

// ── Role Switch Banner — superadmin testing as another role ─────────
// На відміну від старого (видаленого) RolePreviewBanner, це не клієнтська
// декорація: profiles.role реально змінений в БД через switch_active_role(),
// тож RLS/навігація/доступ до файлів відпрацьовують по-справжньому.
const RoleSwitchBanner = {
    _ROLES: [
        { role: 'admin',   label: 'Адміністратор', icon: 'fa-user-shield' },
        { role: 'smm',     label: 'SMM',            icon: 'fa-pen-nib' },
        { role: 'manager', label: 'Керівник',       icon: 'fa-briefcase' },
        { role: 'ceo',     label: 'CEO',            icon: 'fa-crown' },
        { role: 'user',    label: 'Користувач',     icon: 'fa-user' },
        { role: 'intern',  label: 'Стажер',         icon: 'fa-seedling' },
    ],

    show(role, baseRole) {
        let el = document.getElementById('role-switch-banner');
        if (!el) {
            el = document.createElement('div');
            el.id = 'role-switch-banner';
            document.body.appendChild(el);
        }
        const roleLabel = this._ROLES.find(r => r.role === role)?.label || Fmt.role(role);
        el.innerHTML = `
            <span style="display:inline-flex;align-items:center;gap:.4rem;font-size:.85rem">
                <i class="fa-solid fa-user-secret"></i>
                <span>Тестування як:</span>
                <strong>${Fmt.esc(roleLabel)}</strong>
                <span style="opacity:.75;font-size:.78rem">— дії зараз реальні, виконуються під вашим акаунтом</span>
            </span>
            <button onclick="AppState.exitRoleSwitch().catch(e=>Toast.error('Помилка', e.message))"
                style="padding:5px 14px;border-radius:8px;border:1.5px solid rgba(255,255,255,.55);
                       background:transparent;color:#fff;font-size:.8rem;font-weight:700;cursor:pointer;
                       white-space:nowrap;transition:background .15s"
                onmouseenter="this.style.background='rgba(255,255,255,.18)'"
                onmouseleave="this.style.background='transparent'">
                <i class="fa-solid fa-rotate-left"></i> Повернутись (${Fmt.esc(Fmt.role(baseRole))})
            </button>`;
        el.style.cssText = `position:fixed;bottom:0;left:0;right:0;z-index:9999;
            background:linear-gradient(90deg,#7c2d12,#b45309);color:#fff;
            padding:8px 20px;display:flex;align-items:center;justify-content:center;
            gap:1rem;flex-wrap:wrap;font-size:.875rem;box-shadow:0 -2px 16px rgba(0,0,0,.25);`;
        document.body.style.paddingBottom = '50px';
    },

    hide() {
        const el = document.getElementById('role-switch-banner');
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
            if (rl === 'superadmin')   return AppState.isSuperAdmin();
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

        const prefs   = this._prefs(key);
        const acked   = new Set(prefs.acked || []);
        const open    = prefs.open === true;
        const total   = visible.length;
        const doneN   = visible.filter((_, i) => acked.has(i)).length;
        const allDone = doneN === total;

        return `
        <div class="ht-wrap${open ? ' ht-open' : ''}${allDone ? ' ht-done' : ''}" id="ht-${key}">
            <button class="ht-btn${allDone ? ' ht-btn-done' : ''}" onclick="HelpTip._toggle('${key}')" title="${title}">
                ${allDone
                    ? `<i class="fa-solid fa-circle-check"></i>`
                    : `<span class="ht-btn-label">HELP</span>
                       <span class="ht-btn-dot">${doneN > 0 ? doneN + '/' + total : ''}</span>`}
            </button>
            <div class="ht-panel" id="ht-panel-${key}">
                <div class="ht-panel-head" style="background:linear-gradient(135deg,${gradient.replace('135deg,','')})">
                    <div class="ht-panel-head-left">
                        <div class="ht-banner-ico"><i class="fa-solid ${icon}"></i></div>
                        <div>
                            <div class="ht-banner-label">Підказка розділу</div>
                            <div class="ht-banner-title">${title}</div>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:.5rem">
                        ${allDone
                            ? `<div class="ht-done-badge"><i class="fa-solid fa-circle-check"></i> Вивчено!</div>`
                            : `<div class="ht-progress-wrap">
                                   <div class="ht-progress-bar"><div class="ht-progress-fill" style="width:${Math.round(doneN/total*100)}%"></div></div>
                                   <div class="ht-progress-label">${doneN} з ${total}</div>
                               </div>`}
                        <button class="ht-toggle" onclick="HelpTip._toggle('${key}')">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
                <div class="ht-scroll">
                    ${visible.map((it, i) => {
                        const done = acked.has(i);
                        return `
                        <div class="ht-card${done ? ' ht-card-done' : ''}" id="ht-card-${key}-${i}" style="animation-delay:${i * 0.06}s">
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
                wrap.classList.add('ht-done');
                const btn = wrap.querySelector('.ht-btn');
                if (btn) { btn.classList.add('ht-btn-done'); btn.innerHTML = '<i class="fa-solid fa-circle-check"></i>'; }
                this._savePrefs(key, { open: false });
            }, 600);
        }
    }
};