// ================================================================
// EduFlow LMS — Головна сторінка (Dashboard) — WOW redesign
// ================================================================

const DashboardPage = {
    async init(container) {
        UI.setBreadcrumb([{ label: 'Головна' }]);

        const roleColors = {
            owner:   { from: '#7c3aed', to: '#4f46e5' },
            admin:   { from: '#4f46e5', to: '#0ea5e9' },
            smm:     { from: '#ec4899', to: '#8b5cf6' },
            teacher: { from: '#10b981', to: '#0ea5e9' },
            manager: { from: '#f59e0b', to: '#ef4444' },
            user:    { from: '#6366f1', to: '#8b5cf6' },
        };
        const role   = AppState.profile?.role || 'user';
        const colors = roleColors[role] || roleColors.user;
        const name   = AppState.profile?.full_name?.split(' ')[1] || AppState.profile?.full_name?.split(' ')[0] || 'Користувач';
        const avatar = AppState.profile?.avatar_url;
        const initials = Fmt.initials(AppState.profile?.full_name || '');

        container.innerHTML = `
        <style>
            .db-hero{position:relative;border-radius:var(--radius-xl);overflow:hidden;margin-bottom:1.75rem;padding:2rem 2.5rem;min-height:170px;display:flex;align-items:center;gap:2rem}
            .db-hero-bg{position:absolute;inset:0;background:linear-gradient(135deg,${colors.from},${colors.to});z-index:0}
            .db-hero-bg::after{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}
            .db-hero-avatar{width:72px;height:72px;border-radius:50%;border:3px solid rgba(255,255,255,.35);background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden;position:relative;z-index:1}
            .db-hero-avatar img{width:100%;height:100%;object-fit:cover}
            .db-hero-info{flex:1;position:relative;z-index:1}
            .db-hero-greeting{font-size:.8rem;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.25rem}
            .db-hero-name{font-size:1.9rem;font-weight:800;color:#fff;line-height:1.2;margin-bottom:.3rem;text-shadow:0 2px 8px rgba(0,0,0,.2)}
            .db-hero-meta{display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
            .db-hero-badge{display:inline-flex;align-items:center;gap:.35rem;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:2rem;padding:.25rem .75rem;font-size:.78rem;color:rgba(255,255,255,.9);backdrop-filter:blur(4px)}
            .db-hero-right{position:relative;z-index:1;display:flex;flex-direction:column;align-items:flex-end;gap:.75rem}
            .db-ring{position:relative;width:80px;height:80px;flex-shrink:0}
            .db-ring svg{transform:rotate(-90deg)}
            .db-ring-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff}
            .db-ring-pct{font-size:1.1rem;font-weight:800;line-height:1}
            .db-ring-sub{font-size:.55rem;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.04em;margin-top:.1rem}
            .db-quick-actions{display:flex;gap:.5rem;flex-wrap:wrap}
            .db-quick-btn{display:inline-flex;align-items:center;gap:.4rem;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:var(--radius-md);padding:.4rem .9rem;font-size:.78rem;color:#fff;cursor:pointer;transition:all .15s;backdrop-filter:blur(4px);font-family:inherit;white-space:nowrap}
            .db-quick-btn:hover{background:rgba(255,255,255,.28);border-color:rgba(255,255,255,.5)}

            .db-alert{border-radius:var(--radius-lg);padding:1rem 1.25rem;margin-bottom:1.5rem;border:1px solid;display:flex;gap:1rem;align-items:flex-start}
            .db-alert-warn{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.3)}
            .db-alert-danger{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3)}
            .db-alert-icon{font-size:1.5rem;flex-shrink:0;line-height:1}
            .db-alert-body{flex:1;min-width:0}
            .db-alert-title{font-weight:700;margin-bottom:.35rem;font-size:.9rem}
            .db-alert-items{display:flex;flex-wrap:wrap;gap:.4rem}
            .db-alert-chip{display:inline-flex;align-items:center;gap:.3rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.2rem .6rem;font-size:.78rem;cursor:pointer;transition:border-color .15s}
            .db-alert-chip:hover{border-color:var(--primary)}

            .db-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.25rem;margin-bottom:1.5rem}
            .db-grid3>:nth-child(2),.db-grid3>:nth-child(3),.db-grid3>:last-child{align-self:start}
            .db-grid2{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:1.5rem}
            @media(max-width:1100px){.db-grid3{grid-template-columns:1fr 1fr}}
            @media(max-width:700px){.db-grid3,.db-grid2{grid-template-columns:1fr}.db-hero{flex-direction:column;align-items:flex-start}.db-hero-right{align-items:flex-start;flex-direction:row}}

            .db-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden}
            .db-card-head{padding:.75rem 1.1rem;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--primary);border-bottom:1px solid var(--border);background:rgba(99,102,241,.04);display:flex;align-items:center;justify-content:space-between}
            .db-card-desc{padding:.45rem 1.1rem .55rem;font-size:.72rem;color:var(--text-muted);line-height:1.45;border-bottom:1px solid var(--border);background:var(--bg-raised)}
            .db-card-body{padding:1rem 1.1rem}

            .db-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1rem;margin-bottom:1.5rem}
            .db-stat{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);padding:1.1rem 1.25rem;display:flex;flex-direction:column;gap:.3rem;position:relative;overflow:hidden;transition:transform .15s,box-shadow .15s}
            .db-stat:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
            .db-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--s-color)}
            .db-stat-icon{font-size:1.4rem;margin-bottom:.1rem}
            .db-stat-val{font-size:1.8rem;font-weight:800;color:var(--text-primary);line-height:1}
            .db-stat-label{font-size:.75rem;color:var(--text-muted);font-weight:500}

            .db-continue{display:flex;flex-direction:column;gap:0}
            .db-continue-thumb{height:110px;position:relative;overflow:hidden;background:#0f0c29;flex-shrink:0}
            .db-continue-thumb-bg{position:absolute;inset:-8px;background-size:cover;background-position:center;filter:blur(12px) brightness(.4);transform:scale(1.05)}
            .db-continue-thumb img{position:relative;width:100%;height:100%;object-fit:contain;display:block;z-index:1}
            .db-continue-body{padding:1rem;flex:1;display:flex;flex-direction:column;gap:.6rem}
            .db-continue-title{font-weight:700;font-size:.92rem;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
            .db-pbar{height:6px;background:var(--bg-raised);border-radius:3px;overflow:hidden}
            .db-pbar-fill{height:100%;background:linear-gradient(to right,${colors.from},${colors.to});border-radius:3px;transition:width .6s ease}

            .db-news-mini{display:flex;flex-direction:column}
            .db-news-hero{height:120px;position:relative;overflow:hidden;background:#0f0c29;cursor:pointer}
            .db-news-hero-bg{position:absolute;inset:-8px;background-size:cover;background-position:center;filter:blur(12px) brightness(.4);transform:scale(1.05)}
            .db-news-hero img{position:relative;width:100%;height:100%;object-fit:contain;display:block;z-index:1}
            .db-news-hero-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.7),transparent);z-index:2}
            .db-news-hero-title{position:absolute;bottom:.75rem;left:.85rem;right:.85rem;z-index:3;font-size:.85rem;font-weight:700;color:#fff;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
            .db-news-item{display:flex;gap:.75rem;padding:.6rem .85rem;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s}
            .db-news-item:hover{background:var(--bg-raised)}
            .db-news-item:last-child{border-bottom:none}
            .db-news-dot{width:6px;height:6px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:.4rem}
            .db-news-item-title{font-size:.82rem;font-weight:500;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1}
            .db-news-item-date{font-size:.72rem;color:var(--text-muted);flex-shrink:0;margin-top:.1rem}

            .db-event-item{display:flex;gap:.85rem;padding:.75rem 1rem;border-bottom:1px solid var(--border);align-items:flex-start}
            .db-event-item:last-child{border-bottom:none}
            .db-event-dot{width:36px;height:36px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0;font-weight:700}
            .db-event-title{font-size:.85rem;font-weight:600;line-height:1.35}
            .db-event-meta{font-size:.73rem;color:var(--text-muted);margin-top:.15rem}

            .db-courses-scroll{display:flex;gap:1rem;overflow-x:auto;padding-bottom:.5rem;scrollbar-width:thin}
            .db-courses-scroll::-webkit-scrollbar{height:4px}
            .db-courses-scroll::-webkit-scrollbar-track{background:var(--bg-raised);border-radius:2px}
            .db-courses-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
            .db-course-card{min-width:220px;max-width:220px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s;flex-shrink:0}
            .db-course-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-md);border-color:var(--primary)}
            .db-course-thumb{height:110px;overflow:hidden;background:var(--bg-raised)}
            .db-course-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
            .db-course-card:hover .db-course-thumb img{transform:scale(1.05)}
            .db-course-body{padding:.75rem}
            .db-course-name{font-size:.82rem;font-weight:600;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:.5rem}
        </style>

        <!-- ── Hero ── -->
        <div class="db-hero">
            <div class="db-hero-bg"></div>
            <div class="db-hero-avatar">
                ${avatar ? `<img src="${avatar}" alt="">` : initials}
            </div>
            <div class="db-hero-info">
                <div class="db-hero-greeting">Вітаємо в команді</div>
                <div class="db-hero-name">${Fmt.esc(name)} 👋</div>
                <div class="db-hero-meta">
                    <span class="db-hero-badge"><i class="fa-solid fa-user-shield"></i> ${Fmt.role(role)}</span>
                    ${AppState.profile?.city ? `<span class="db-hero-badge"><i class="fa-solid fa-location-dot"></i> ${Fmt.esc(AppState.profile.city)}</span>` : ''}
                    <span class="db-hero-badge"><i class="fa-regular fa-calendar"></i> ${new Date().toLocaleDateString('uk-UA', { weekday:'long', day:'numeric', month:'long' })}</span>
                </div>
                <div class="db-quick-actions" style="margin-top:.85rem" id="db-quick-actions"></div>
            </div>
            <div class="db-hero-right">
                <div class="db-ring">
                    <svg width="80" height="80" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="7"/>
                        <circle id="db-ring-circle" cx="40" cy="40" r="32" fill="none" stroke="#fff" stroke-width="7"
                            stroke-linecap="round" stroke-dasharray="201" stroke-dashoffset="201"/>
                    </svg>
                    <div class="db-ring-label">
                        <div class="db-ring-pct" id="db-ring-pct">0%</div>
                        <div class="db-ring-sub">курсів</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ── Important events ── -->
        <div id="db-important"></div>

        <!-- ── Alerts ── -->
        <div id="db-alerts"></div>

        <!-- ── Birthdays ── -->
        <div id="db-birthdays"></div>

        <!-- ── Middle grid ── -->
        <div class="db-grid3">
            <div id="db-events" class="db-card"></div>
            <div id="db-news-widget" class="db-card db-news-mini"></div>
            <div id="db-continue" class="db-card"></div>
        </div>

        <!-- ── My courses ── -->
        <div id="db-courses"></div>`;

        // Load all data in parallel
        const today = new Date().toISOString().slice(0, 10);
        const in7   = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

        const [enrollments, newsRes, birthdays, unreadCount, shiftLocation, calEvents] = await Promise.all([
            API.enrollments.getMyEnrollments().catch(() => []),
            API.news.getAll({ published: true, pageSize: 5 }).catch(() => ({ data: [] })),
            API.birthdays.getToday().catch(() => []),
            API.notifications.getUnreadCount().catch(() => 0).then(v => v || 0),
            API.documentDownloads.getTodayShiftLocation().catch(() => null),
            supabase.from('personal_cal_events')
                .select('id,title,date,time,color,is_important,is_done,acked_date')
                .eq('user_id', AppState.user.id)
                .gte('date', today)
                .lte('date', in7)
                .order('date').order('time', { nullsFirst: true })
                .limit(5)
                .then(r => r.data || [])
                .catch(() => []),
        ]);

        // Unacked docs
        const unackedDocs = await this._getUnackedDocs().catch(() => []);

        this._renderImportantEvents(calEvents, today);
        this._renderQuickActions(role, unreadCount);
        this._renderProgressRing(enrollments);
        this._renderAlerts(unackedDocs, unreadCount);
        this._renderBirthdays(birthdays);
        this._renderContinue(enrollments);
        this._renderNewsWidget(newsRes.data || []);
        this._renderEvents(shiftLocation, calEvents);
        this._renderCourses(enrollments);
    },

    async _getUnackedDocs() {
        const { data } = await supabase.from('resources')
            .select('id, title, deadline_days, doc_version')
            .eq('is_tracked_download', true)
            .is('deleted_at', null)
            .limit(50);
        if (!data?.length) return [];
        const ackMap = await API.documentDownloads.getMyLatest(data.map(d => d.id));
        // Unacked = never downloaded OR downloaded version is older than current
        return data.filter(d => {
            const ack = ackMap[d.id];
            if (!ack) return true;
            return (ack.version || 1) < (d.doc_version || 1);
        });
    },

    _renderQuickActions(role, unreadCount) {
        const el = document.getElementById('db-quick-actions');
        if (!el) return;
        const actions = [
            { label: 'Новини', icon: 'fa-newspaper', route: 'news', roles: ['owner','admin','smm','teacher','manager','user'] },
            { label: 'База знань', icon: 'fa-book-open', route: 'knowledge-base', roles: ['owner','admin','smm','teacher','manager','user'] },
            { label: 'Мої курси', icon: 'fa-graduation-cap', route: 'courses', roles: ['owner','admin','smm','teacher','manager','user'] },
            { label: 'Додати новину', icon: 'fa-plus', route: 'news', roles: ['owner','admin','smm'], action: 'NewsPage.openCreate()' },
            { label: 'Адмін', icon: 'fa-screwdriver-wrench', route: 'admin', roles: ['owner','admin'] },
            { label: `Сповіщення${unreadCount ? ` (${unreadCount})` : ''}`, icon: 'fa-bell', route: 'notifications', roles: ['owner','admin','smm','teacher','manager','user'] },
        ].filter(a => a.roles.includes(role)).slice(0, 5);

        el.innerHTML = actions.map(a => `
            <button class="db-quick-btn" onclick="${a.action || `Router.go('${a.route}')`}">
                <i class="fa-solid ${a.icon}"></i> ${a.label}
            </button>`).join('');
    },

    _renderProgressRing(enrollments) {
        const completed = enrollments.filter(e => e.completed_at).length;
        const total     = enrollments.length;
        const pct       = total ? Math.round(completed / total * 100) : 0;
        const circle    = document.getElementById('db-ring-circle');
        const label     = document.getElementById('db-ring-pct');
        if (!circle) return;
        const circumference = 2 * Math.PI * 32;
        setTimeout(() => {
            circle.style.strokeDashoffset = circumference * (1 - pct / 100);
            circle.style.transition = 'stroke-dashoffset .8s ease';
            if (label) label.textContent = pct + '%';
        }, 150);
    },

    _renderImportantEvents(calEvents, today) {
        const el = document.getElementById('db-important');
        if (!el) return;
        const important = calEvents.filter(ev => ev.is_important && ev.date === today);
        if (!important.length) return;

        // Filter out already acknowledged (acked_date stored in DB)
        const pending = important.filter(ev => ev.acked_date !== today);
        if (!pending.length) return;

        el.innerHTML = pending.map(ev => `
            <div id="db-imp-${ev.id}" style="display:flex;align-items:center;gap:1rem;background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(239,68,68,.08));border:1px solid rgba(245,158,11,.4);border-radius:var(--radius-lg);padding:1rem 1.25rem;margin-bottom:1rem;flex-wrap:wrap">
                <span style="font-size:1.5rem;flex-shrink:0">⚡</span>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;color:#92400e;font-size:.82rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">Важлива подія сьогодні</div>
                    <div style="font-weight:600;font-size:.95rem">${Fmt.esc(ev.title)}</div>
                    ${ev.time ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.1rem"><i class="fa-regular fa-clock"></i> ${ev.time.slice(0,5)}</div>` : ''}
                </div>
                <button class="btn btn-sm" style="background:#f59e0b;color:#fff;border:none;flex-shrink:0"
                    onclick="DashboardPage._ackImportant('${ev.id}','${today}')">
                    <i class="fa-solid fa-check"></i> Підтверджую
                </button>
            </div>`).join('');
    },

    _doneEvent(eventId, date) {
        supabase.from('personal_cal_events').update({ is_done: true }).eq('id', eventId).eq('user_id', AppState.user.id);
        const el = document.getElementById(`db-ev-${eventId}`);
        if (!el) return;
        el.style.transition = 'opacity .25s,transform .25s';
        el.style.opacity = '0';
        el.style.transform = 'translateX(10px)';
        setTimeout(() => {
            const eventsEl = document.getElementById('db-events');
            if (eventsEl) DashboardPage._refreshEvents();
        }, 260);
    },

    _refreshEvents() {
        const today = new Date().toISOString().slice(0, 10);
        const in7   = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        Promise.all([
            supabase.from('personal_cal_events')
                .select('id,title,date,time,color,is_important,is_done,acked_date')
                .eq('user_id', AppState.user.id)
                .gte('date', today).lte('date', in7)
                .order('date').order('time', { nullsFirst: true })
                .limit(5).then(r => r.data || []),
            API.documentDownloads.getTodayShiftLocation().catch(() => null),
        ]).then(([calEvents, shiftLocation]) => {
            this._renderEvents(shiftLocation, calEvents);
        });
    },

    _ackImportant(eventId, date) {
        supabase.from('personal_cal_events')
            .update({ acked_date: date, is_done: true })
            .eq('id', eventId).eq('user_id', AppState.user.id);
        const el = document.getElementById(`db-imp-${eventId}`);
        if (el) el.style.transition = 'opacity .3s', el.style.opacity = '0', setTimeout(() => el.remove(), 300);
        this._refreshEvents();
    },

    _renderAlerts(unackedDocs, unreadCount) {
        const el = document.getElementById('db-alerts');
        if (!el) return;
        let html = '';

        if (unackedDocs.length) {
            html += `
            <div class="db-alert db-alert-danger">
                <div class="db-alert-icon">⚠️</div>
                <div class="db-alert-body">
                    <div class="db-alert-title" style="color:var(--danger)">
                        Не ознайомлені з ${unackedDocs.length} документ${unackedDocs.length > 1 ? 'ами' : 'ом'}
                    </div>
                    <div class="db-alert-items">
                        ${unackedDocs.slice(0, 5).map(d => `
                            <span class="db-alert-chip" onclick="Router.go('documents')">
                                <i class="fa-regular fa-file-lines" style="color:var(--danger)"></i>
                                ${Fmt.esc(d.title)}
                            </span>`).join('')}
                        ${unackedDocs.length > 5 ? `<span class="db-alert-chip" onclick="Router.go('documents')">ще ${unackedDocs.length - 5}…</span>` : ''}
                    </div>
                </div>
            </div>`;
        }

        if (unreadCount > 0) {
            html += `
            <div class="db-alert db-alert-warn" id="db-notif-alert">
                <div class="db-alert-icon">🔔</div>
                <div class="db-alert-body">
                    <div class="db-alert-title" style="color:#b45309">
                        У вас ${unreadCount} непрочитан${unreadCount === 1 ? 'е сповіщення' : 'их сповіщень'}
                    </div>
                    <div class="db-alert-items">
                        <span class="db-alert-chip" onclick="Router.go('notifications')">
                            <i class="fa-solid fa-bell" style="color:#b45309"></i> Переглянути
                        </span>
                        <span class="db-alert-chip" onclick="DashboardPage._dismissNotifAlert()" title="Позначити всі прочитаними">
                            <i class="fa-solid fa-check-double" style="color:#b45309"></i> Позначити прочитаними
                        </span>
                    </div>
                </div>
            </div>`;
        }

        el.innerHTML = html;
    },

    async _dismissNotifAlert() {
        await API.notifications.markAllRead().catch(() => {});
        const el = document.getElementById('db-notif-alert');
        if (el) { el.style.transition = 'opacity .25s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }
    },

    _renderBirthdays(people) {
        const el = document.getElementById('db-birthdays');
        if (!el || !people.length) return;
        el.innerHTML = `
            <div class="db-alert db-alert-warn" style="background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(245,158,11,.04));border-color:rgba(245,158,11,.3);margin-bottom:1.5rem">
                <div class="db-alert-icon">🎂</div>
                <div class="db-alert-body">
                    <div class="db-alert-title" style="color:#b45309">Сьогодні день народження!</div>
                    <div class="db-alert-items">
                        ${people.map(p => `
                            <span class="db-alert-chip">
                                🎉 <strong>${Fmt.esc(p.full_name)}</strong>${p.job_position ? ` · ${Fmt.esc(p.job_position)}` : ''}
                            </span>`).join('')}
                    </div>
                </div>
            </div>`;
    },

    _renderStats(adminStats, enrollments) {
        const el = document.getElementById('db-stats');
        if (!el) return;

        let stats;
        if (AppState.isStaff() && adminStats) {
            stats = [
                { icon: '👥', label: 'Користувачів',     value: Fmt.num(adminStats.totalUsers),       color: '#6366f1' },
                { icon: '📚', label: 'Курсів',            value: Fmt.num(adminStats.totalCourses || 0), color: '#8b5cf6' },
                { icon: '🎓', label: 'Записів',           value: Fmt.num(adminStats.totalEnrollments || 0), color: '#06b6d4' },
                { icon: '📝', label: 'Спроб тестів',      value: Fmt.num(adminStats.totalAttempts || 0), color: '#10b981' },
            ];
        } else {
            const completed   = enrollments.filter(e => e.completed_at).length;
            const inProgress  = enrollments.filter(e => !e.completed_at && (e.progress_percentage || 0) > 0).length;
            const avgProgress = enrollments.length
                ? Math.round(enrollments.reduce((s, e) => s + (e.progress_percentage || 0), 0) / enrollments.length)
                : 0;
            stats = [
                { icon: '📚', label: 'Моїх курсів',      value: enrollments.length, color: '#6366f1' },
                { icon: '✅', label: 'Завершено',         value: completed,          color: '#10b981' },
                { icon: '🔥', label: 'В процесі',        value: inProgress,         color: '#f59e0b' },
                { icon: '📊', label: 'Середній прогрес', value: avgProgress + '%',   color: '#06b6d4' },
            ];
        }

        // Prepend section label above stats grid
        const statsParent = el.parentElement;
        let statsLabel = statsParent?.querySelector('#db-stats-label');
        if (!statsLabel) {
            statsLabel = document.createElement('div');
            statsLabel.id = 'db-stats-label';
            statsLabel.style.cssText = 'font-size:.72rem;color:var(--text-muted);margin-bottom:.5rem;margin-top:-.75rem';
            statsLabel.textContent = AppState.isStaff() && adminStats
                ? 'Загальна статистика платформи — дані оновлюються щодня'
                : 'Ваш особистий прогрес навчання';
            el.insertAdjacentElement('beforebegin', statsLabel);
        }

        el.innerHTML = stats.map(s => `
            <div class="db-stat" style="--s-color:${s.color}">
                <div class="db-stat-icon">${s.icon}</div>
                <div class="db-stat-val" data-target="${s.value}">${s.value}</div>
                <div class="db-stat-label">${s.label}</div>
            </div>`).join('');
    },

    _renderContinue(enrollments) {
        const el = document.getElementById('db-continue');
        if (!el) return;
        const next = enrollments.find(e => !e.completed_at) || enrollments[0];

        el.innerHTML = `<div class="db-card-head"><span style="color:#8b5cf6"><i class="fa-solid fa-play"></i> Продовжити навчання</span></div>
            <div class="db-card-desc">Ваш поточний курс та прогрес проходження</div>`;

        if (!next) {
            el.innerHTML += `<div class="db-card-body" style="text-align:center;padding:2rem;color:var(--text-muted)">
                <div style="font-size:2rem;margin-bottom:.5rem">🎉</div>
                <div style="font-weight:600">Всі курси завершено!</div>
                <button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="Router.go('courses')">Знайти нові</button>
            </div>`;
            return;
        }

        const course = next.course;
        const pct    = next.progress_percentage || 0;
        const thumb  = course.thumbnail_url;

        el.innerHTML += `
            <div class="db-continue">
                <div class="db-continue-thumb" onclick="Router.go('courses/${course.id}')" style="cursor:pointer">
                    ${thumb
                        ? `<div class="db-continue-thumb-bg" style="background-image:url('${thumb}')"></div>
                           <img src="${thumb}" alt="">`
                        : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:2.5rem;position:relative;z-index:1">📖</div>`}
                </div>
                <div class="db-continue-body">
                    <div class="db-continue-title">${Fmt.esc(course.title)}</div>
                    <div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text-muted);margin-bottom:.3rem">
                        <span>Прогрес</span><span style="font-weight:700;color:var(--text-primary)">${pct}%</span>
                    </div>
                    <div class="db-pbar"><div class="db-pbar-fill" style="width:${pct}%"></div></div>
                    <button class="btn btn-primary btn-sm" style="margin-top:.75rem;width:100%" onclick="Router.go('courses/${course.id}')">
                        <i class="fa-solid fa-play"></i> ${pct > 0 ? 'Продовжити' : 'Розпочати'}
                    </button>
                </div>
            </div>`;
    },

    _renderNewsWidget(items) {
        const el = document.getElementById('db-news-widget');
        if (!el) return;
        el.innerHTML = `<div class="db-card-head"><span style="color:#0ea5e9"><i class="fa-regular fa-newspaper"></i> Новини</span>
            <button class="btn btn-ghost btn-sm" onclick="Router.go('news')" style="font-size:.72rem">Всі <i class="fa-solid fa-arrow-right" style="position:relative;top:1.5px"></i></button></div>
            <div class="db-card-desc">Останні новини компанії — натисніть, щоб читати повністю</div>`;

        if (!items.length) {
            el.innerHTML += `<div class="db-card-body" style="text-align:center;color:var(--text-muted);padding:2rem">Новин поки немає</div>`;
            return;
        }

        const featured = items[0];
        const rest     = items.slice(1, 4);

        let body = '';
        if (featured.thumbnail_url) {
            body += `
            <div class="db-news-hero" onclick="Router.go('news/${featured.slug || featured.id}')">
                <div class="db-news-hero-bg" style="background-image:url('${featured.thumbnail_url}')"></div>
                <img src="${featured.thumbnail_url}" alt="">
                <div class="db-news-hero-overlay"></div>
                <div class="db-news-hero-title">${Fmt.esc(featured.title)}</div>
            </div>`;
        }

        body += rest.map(n => `
            <div class="db-news-item" onclick="Router.go('news/${n.slug || n.id}')">
                <div class="db-news-dot"></div>
                <div class="db-news-item-title">${Fmt.esc(n.title)}</div>
                <div class="db-news-item-date">${Fmt.dateShort(n.published_at || n.created_at)}</div>
            </div>`).join('');

        if (!featured.thumbnail_url) {
            body = `<div class="db-news-item" onclick="Router.go('news/${featured.slug || featured.id}')">
                <div class="db-news-dot" style="background:#f59e0b"></div>
                <div class="db-news-item-title" style="font-weight:700">${Fmt.esc(featured.title)}</div>
                <div class="db-news-item-date">${Fmt.dateShort(featured.published_at || featured.created_at)}</div>
            </div>` + body;
        }

        el.innerHTML += body;
    },

    _renderEvents(shiftLocation, calEvents = []) {
        const el = document.getElementById('db-events');
        if (!el) return;

        const now   = new Date();
        const today = now.toISOString().slice(0, 10);
        const hour  = now.getHours();
        const greeting = hour < 12 ? '🌅 Добрий ранок!' : hour < 17 ? '☀️ Гарного дня!' : '🌙 Гарного вечора!';

        el.innerHTML = `
            <div class="db-card-head">
                <span style="color:#10b981"><i class="fa-regular fa-calendar-check"></i> Найближчі події</span>
                <button class="btn btn-ghost btn-sm" onclick="Router.go('my-calendar')" style="font-size:.72rem">Календар <i class="fa-solid fa-arrow-right" style="position:relative;top:1.5px"></i></button>
            </div>
            <div class="db-card-desc">Події з вашого особистого календаря на наступні 7 днів</div>
            <div class="db-card-body" style="padding:0">
                <div style="font-size:.85rem;font-weight:600;color:var(--text-primary);padding:.85rem 1rem .5rem">${greeting}</div>`;

        let body = '';

        if (shiftLocation) {
            body += `
            <div class="db-event-item">
                <div class="db-event-dot" style="background:rgba(99,102,241,.12);color:var(--primary)"><i class="fa-solid fa-location-dot"></i></div>
                <div>
                    <div class="db-event-title">Ваша зміна сьогодні</div>
                    <div class="db-event-meta">${Fmt.esc(shiftLocation.name)}</div>
                </div>
            </div>`;
        }

        if (calEvents.length) {
            const nowTime = now.getHours() * 60 + now.getMinutes();

            // Past by time OR manually marked done in DB
            const isDone = ev => {
                if (ev.is_done) return true;
                return ev.date === today && ev.time && (parseInt(ev.time) * 60 + parseInt(ev.time.slice(3))) < nowTime;
            };

            const past     = calEvents.filter(ev => isDone(ev));
            const upcoming = calEvents.filter(ev => !isDone(ev));

            const renderEv = (ev, dimmed = false) => {
                const isToday   = ev.date === today;
                const dateLabel = isToday ? 'Сьогодні' : new Date(ev.date + 'T12:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
                const timeLabel = ev.time ? ev.time.slice(0, 5) : '';
                const color     = ev.color || '#6366f1';
                return `
                <div id="db-ev-${ev.id}" class="db-event-item" style="${dimmed ? 'opacity:.45;' : ''}">
                    <div class="db-event-dot" style="background:${color}22;color:${color};cursor:pointer" onclick="Router.go('my-calendar')" title="Відкрити календар">
                        <i class="fa-${dimmed ? 'solid' : 'regular'} fa-${dimmed ? 'circle-check' : 'calendar'}"></i>
                    </div>
                    <div style="flex:1;min-width:0;cursor:pointer" onclick="Router.go('my-calendar')">
                        <div class="db-event-title" style="display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden">${Fmt.esc(ev.title)}</div>
                        <div class="db-event-meta">${dateLabel}${timeLabel ? ' · ' + timeLabel : ''}</div>
                    </div>
                    ${!dimmed ? `
                    <button onclick="DashboardPage._doneEvent('${ev.id}','${today}')"
                        title="Відмітити як виконано"
                        style="flex-shrink:0;width:28px;height:28px;border-radius:50%;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;font-size:.75rem"
                        onmouseenter="this.style.borderColor='#10b981';this.style.color='#10b981';this.style.background='rgba(16,185,129,.1)'"
                        onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)';this.style.background='var(--bg-raised)'">
                        <i class="fa-solid fa-check"></i>
                    </button>` : ''}
                </div>`;
            };

            if (upcoming.length) body += upcoming.map(ev => renderEv(ev, false)).join('');

            if (past.length) {
                body += `
                <div style="padding:.35rem 1rem .5rem;border-top:1px solid var(--border);margin-top:.25rem">
                    <details>
                        <summary style="display:inline-flex;align-items:center;gap:.4rem;font-size:.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;cursor:pointer;list-style:none;user-select:none">
                            <i class="fa-solid fa-chevron-right" style="font-size:.55rem;transition:transform .2s"></i>
                            Завершені · ${past.length}
                        </summary>
                        <div style="margin-top:.35rem;border:1px solid var(--border);border-radius:var(--radius-md);overflow-y:auto;max-height:180px">
                            ${past.map(ev => renderEv(ev, true)).join('')}
                        </div>
                    </details>
                </div>`;
            }

            if (!upcoming.length && !past.length) body += '';
        } else {
            body += `
            <div style="text-align:center;padding:1rem 0;color:var(--text-muted);font-size:.82rem">
                <i class="fa-regular fa-calendar" style="font-size:1.5rem;display:block;margin-bottom:.4rem;opacity:.4"></i>
                Найближчих подій немає
            </div>`;
        }

        if (AppState.canSchedule()) {
            body += `
            <div class="db-event-item" style="cursor:pointer;margin-top:.25rem" onclick="Router.go('scheduler')">
                <div class="db-event-dot" style="background:rgba(245,158,11,.12);color:#b45309"><i class="fa-solid fa-calendar-plus"></i></div>
                <div>
                    <div class="db-event-title">Робочий розклад</div>
                    <div class="db-event-meta" style="color:var(--primary)">Перейти до планування <i class="fa-solid fa-arrow-right" style="position:relative;top:1.5px"></i></div>
                </div>
            </div>`;
        }

        el.innerHTML += body + '</div>';
    },

    _renderCourses(enrollments) {
        const el = document.getElementById('db-courses');
        if (!el || !enrollments.length) return;

        el.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.35rem">
                <h3 style="font-size:1rem;font-weight:700">Мої курси</h3>
                <button class="btn btn-ghost btn-sm" onclick="Router.go('courses')">Всі курси <i class="fa-solid fa-arrow-right" style="position:relative;top:1.5px"></i></button>
            </div>
            <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.85rem">Курси, на які ви записані — клікніть, щоб продовжити проходження</div>
            <div class="db-courses-scroll">
                ${enrollments.slice(0, 10).map(e => this._courseCard(e)).join('')}
            </div>`;
    },

    _courseCard(e) {
        const course = e.course;
        const pct    = e.progress_percentage || 0;
        return `
            <div class="db-course-card" onclick="Router.go('courses/${course.id}')">
                <div class="db-course-thumb">
                    ${course.thumbnail_url
                        ? `<img src="${course.thumbnail_url}" alt="${Fmt.esc(course.title)}" loading="lazy">`
                        : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.08))">📖</div>`}
                </div>
                <div class="db-course-body">
                    <div class="db-course-name">${Fmt.esc(course.title)}</div>
                    <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted);margin-bottom:.3rem">
                        <span>${pct === 100 ? '✅ Завершено' : 'Прогрес'}</span>
                        <span style="font-weight:700;color:var(--text-primary)">${pct}%</span>
                    </div>
                    <div class="db-pbar"><div class="db-pbar-fill" style="width:${pct}%;background:${pct === 100 ? '#10b981' : 'var(--primary)'}"></div></div>
                </div>
            </div>`;
    },
};
