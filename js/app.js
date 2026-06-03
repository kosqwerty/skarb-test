// ================================================================
// EduFlow LMS — Main App Entry Point
// ================================================================

const App = {
    async boot() {
        Theme.init();
        SearchSelect.init();
        CreatableSelect.init();

        // Restore sidebar collapsed state
        const collapsed = localStorage.getItem('sidebar_collapsed') === 'true';
        if (collapsed) {
            document.getElementById('sidebar')?.classList.add('collapsed');
            document.body.classList.add('sidebar-collapsed');
        }

        // Initialize auth
        const loggedIn = await Auth.init();

        // Hide loading overlay
        document.getElementById('loading-overlay').style.display = 'none';

        if (loggedIn) {
            InactivityWatcher.start();
            await Heartbeat.start();
            this.start();
        } else {
            // Show auth screen
            document.getElementById('auth-screen').classList.remove('hidden');
        }

        Auth.listen();
    },

    async start() {
        const profile = AppState.profile;
        if (!profile) { Auth._showAuth(); return; }

        // Show app shell
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');

        // Apply user's saved theme from DB
        Theme.applyFromProfile(profile);

        // Start scheduler background ticker (owner/admin/manager only)
        if (AppState.canSchedule()) SchedulerPage.startTimer();

        // Load restrictions before rendering nav (safe — never throws)
        try { await AccessRestrictions.load(); } catch { /* table may not exist yet */ }

        // Check if user is on a trusted network (IP whitelist)
        await AppState.checkTrustedNetwork();

        // Init AI assistant floating button
        Assistant.init();
        // Rebuild nav + mob-nav after network check so blocked icons appear
        UI.renderNavigation(profile.role);
        UI.applyMobNavRestrictions();

        // Render navigation based on role
        UI.renderNavigation(profile.role);
        UI.renderSidebarUser(profile);

        // Load unread counts after sidebar is in DOM
        UI.loadNotificationCount();
        UI.loadDocBadge();
        UI.loadNewsCount();
        RecentlyViewed.init();

        // Load bookmarks async (updates nav stars when done)
        Bookmarks.load();

        // День народження — показуємо при вході
        BirthdayModal.check(profile);
        // Річниця в компанії — показуємо раз на рік
        AnniversaryModal.check(profile);
        // День народження Скарбниці — 9 листопада
        CompanyBirthdayModal.check();

        // Розділи закриті для недовіреної мережі
        const requireTrusted = (isDocs = false) => {
            if (AppState.isTrustedNetwork) return true;
            if (isDocs) {
                Toast.error('Немає доступу', 'Перегляд документів та файлів доступний лише з довіреної мережі');
            } else {
                Toast.warning('Обмежений доступ', 'Цей розділ доступний лише з довіреної мережі');
            }
            Router.go('dashboard');
            return false;
        };

        // Define routes
        Router.define({
            'dashboard': async ({ container }) => {
                await DashboardPage.init(container);
            },

            'courses/:id': async ({ container, params }) => {
                if (!requireTrusted()) return;
                await CourseViewPage.init(container, params);
            },

            'lessons/:id': async ({ container, params }) => {
                if (!requireTrusted()) return;
                await LessonViewPage.init(container, params);
            },

            'tests/:id': async ({ container, params }) => {
                if (!requireTrusted()) return;
                await TestsPage.init(container, params);
            },

            'analytics': async ({ container, params }) => {
                if (!requireTrusted()) return;
                await AnalyticsPage.init(container, params);
                return () => AnalyticsPage.destroy?.();
            },

            'admin': async ({ container, params }) => {
                if (!requireTrusted()) return;
                await AdminPage.init(container, params);
            },

            'resources': async ({ container, params }) => {
                if (!requireTrusted(true)) return;
                Router.go('knowledge-base');
            },

            'knowledge-base': async ({ container, params }) => {
                if (!requireTrusted(true)) return;
                await ResourcesPage.init(container, { view: 'kb' });
            },

            'documents': async ({ container, params }) => {
                if (!requireTrusted(true)) return;
                await ResourcesPage.init(container, { view: 'docs', tab: params.tab || '', cat: params.cat || '' });
            },

            'branch-docs': async ({ container }) => {
                if (!requireTrusted(true)) return;
                await BranchDocsPage.init(container);
            },

            'collections': async ({ container }) => {
                if (!requireTrusted(true)) return;
                await CollectionsPage.init(container);
            },

            'collections/:id': async ({ container, params }) => {
                if (!requireTrusted(true)) return;
                await CollectionsPage.initView(container, params);
            },

            'resource/:id': async ({ container, params }) => {
                if (!requireTrusted(true)) return;
                await ResourceViewPage.init(container, params);
            },

            'news': async ({ container, params }) => {
                await NewsPage.init(container, params);
            },

            'news/:id': async ({ container, params }) => {
                await NewsPage.init(container, params);
            },

            'results': async ({ container }) => {
                if (!requireTrusted()) return;
                await App.renderResults(container);
            },

            'profile': async ({ container }) => {
                await App.renderProfile(container);
            },

            'scheduler': async ({ container, params }) => {
                if (!requireTrusted()) return;
                await SchedulerPage.init(container, params);
            },

            'notifications': async ({ container }) => {
                if (!requireTrusted()) return;
                NotificationsPage.destroy?.();
                await NotificationsPage.init(container);
                return () => NotificationsPage.destroy?.();
            },

            'contacts': async ({ container }) => {
                if (!requireTrusted()) return;
                await ContactsPage.init(container);
            },

            'bookmarks': async ({ container }) => {
                if (!requireTrusted()) return;
                await BookmarksPage.init(container);
            },

            'schedule-graph': async ({ container, params }) => {
                if (!requireTrusted()) return;
                if (params?.view === 'employee') await ScheduleGraphEmployee.init(container);
                else await ScheduleGraphPage.init(container);
            },

            'schedule-view': async ({ container }) => {
                if (!requireTrusted()) return;
                await ScheduleViewPage.init(container);
            },

            'my-calendar': async ({ container, params }) => {
                if (!requireTrusted()) return;
                await MyCalendarPage.init(container, params);
            },

            'tests-manager': async () => {
                if (!requireTrusted()) return;
                Router.go('admin?tab=tests');
            },

            'my-tests': async ({ container }) => {
                if (!requireTrusted()) return;
                await MyTestsPage.init(container);
            },

            'expert-path': async ({ container }) => {
                if (!requireTrusted()) return;
                await ExpertPathPage.init(container);
            }
        });

        // Start router
        Router.start();

        // Start activity tracking (page views via hash change)
        ActivityTracker.start();

        // Redirect to dashboard if no hash
        if (!location.hash || location.hash === '#' || location.hash === '#/') {
            Router.go('dashboard');
        }

        // Show personal calendar reminder after first render
        // setTimeout(() => MyCalendarPage.showTodayReminder(), 300);
    },

    // ── Results Page (quick inline) ───────────────────────────────
    async renderResults(container) {
        UI.setBreadcrumb([{ label: 'Мої результати' }]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        try {
            const stats = await API.analytics.getStudentStats(AppState.user.id);
            const { enrollments, attempts } = stats;

            container.innerHTML = `
                <div class="page-header">
                    <div class="page-title">
                        <h1>🏆 Мої результати</h1>
                        <p>Історія навчання</p>
                    </div>
                </div>

                <div class="stats-grid" style="margin-bottom:2rem">
                    ${[
                        { icon: '📚', label: 'Курси', value: enrollments.length, color: '#6366F1' },
                        { icon: '✅', label: 'Завершено', value: enrollments.filter(e => e.completed_at).length, color: '#10B981' },
                        { icon: '📝', label: 'Спроби тестів', value: attempts.length, color: '#8B5CF6' },
                        { icon: '🏆', label: 'Успішних', value: attempts.filter(a => a.passed).length, color: '#F59E0B' }
                    ].map(s => `
                        <div class="stat-card" style="--accent-color:${s.color}">
                            <div class="stat-icon">${s.icon}</div>
                            <div class="stat-value">${s.value}</div>
                            <div class="stat-label">${s.label}</div>
                        </div>`).join('')}
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem" class="dash-two-col">
                    <!-- Course progress -->
                    <div class="card">
                        <div class="card-header"><h3>📚 Курси</h3></div>
                        <div class="card-body" style="padding:0">
                            ${enrollments.length ? enrollments.map(e => `
                                <div onclick="Router.go('courses/${e.course_id}')" style="display:flex;align-items:center;gap:1rem;padding:.875rem 1.25rem;border-bottom:1px solid var(--border);cursor:pointer;transition:background var(--transition)" onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
                                    <div style="flex:1;min-width:0">
                                        <div style="font-weight:500;font-size:.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.course?.title || '—'}</div>
                                        <div style="margin-top:.4rem">
                                            <div class="progress-bar" style="height:4px">
                                                <div class="progress-fill ${e.completed_at ? 'success' : ''}" style="width:${e.progress_percentage||0}%"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <span style="font-size:.8rem;color:var(--text-muted);flex-shrink:0">${e.progress_percentage||0}%</span>
                                    ${e.completed_at ? '<span class="badge badge-success">✓</span>' : ''}
                                </div>`).join('')
                            : '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Ви не записані на жодний курс</div>'}
                        </div>
                    </div>

                    <!-- Test attempts -->
                    <div class="card">
                        <div class="card-header"><h3>📝 Тести</h3></div>
                        <div class="card-body" style="padding:0">
                            ${attempts.slice(0, 10).length ? attempts.slice(0, 10).map(a => `
                                <div style="display:flex;align-items:center;gap:1rem;padding:.875rem 1.25rem;border-bottom:1px solid var(--border)">
                                    <div style="flex:1;min-width:0">
                                        <div style="font-weight:500;font-size:.875rem">${a.test?.title || '—'}</div>
                                        <div style="font-size:.75rem;color:var(--text-muted)">${Fmt.datetime(a.completed_at)}</div>
                                    </div>
                                    <div style="text-align:right;flex-shrink:0">
                                        <div style="font-weight:700;color:${a.passed ? 'var(--success)' : 'var(--danger)'}">${Math.round(a.percentage||0)}%</div>
                                        <span class="badge ${a.passed ? 'badge-success' : 'badge-danger'}" style="font-size:.65rem">${a.passed ? 'Зараховано' : 'Не зараховано'}</span>
                                    </div>
                                </div>`).join('')
                            : '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Спроб поки немає</div>'}
                        </div>
                    </div>
                </div>`;
        } catch(e) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
        }
    },

    // ── Profile Page ──────────────────────────────────────────────
    async renderProfile(container) {
        UI.setBreadcrumb([{ label: 'Профіль' }]);
        // завжди беремо свіжі дані з БД
        AppState.profile = await API.profiles.me().catch(() => AppState.profile);
        UI.renderSidebarUser(AppState.profile);
        const profile = AppState.profile;
        const subordinates = await API.profiles.getSubordinates(AppState.user.id).catch(() => []);
        const allUsers     = await API.profiles.getAll({ pageSize: 500 }).then(r => r.data).catch(() => []);
        const manager      = allUsers.find(u => u.id === profile?.manager_id);

        const field = (label, value) => value ? `
            <div style="min-width:0">
                <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:.2rem">${label}</div>
                <div style="font-size:.875rem;font-weight:500">${value}</div>
            </div>` : '';

        const genderLabel = { male: 'Чоловіча', female: 'Жіноча' }[profile?.gender] || '';

       container.innerHTML = `
<div style="max-width: 900px; margin-left: 5px;">
    
    <!-- Шапка -->
    <div style="margin-bottom: 24px; display: flex; align-items: baseline; justify-content: space-between;">
        <div>
            <h1 style="margin: 0; font-weight: 600; font-size: 1.8rem; letter-spacing: -0.01em; color: var(--text-primary);">👤 Мій профіль</h1>
            <p style="margin: 4px 0 0; color: var(--text-muted); font-size: 0.9rem;">Керування особистою інформацією та перегляд даних облікового запису</p>
        </div>
        <button class="btn btn-primary" onclick="App.editProfile()" style="display: flex; align-items: center; gap: 8px; padding: 10px 20px;">
            <span style="font-size: 1.1em;">✎</span> Редагувати профіль
        </button>
    </div>

    <!-- Основная карточка -->
    <div style="background: var(--bg-surface); border-radius: var(--radius-xl); box-shadow: var(--shadow-md); border: 1px solid var(--border); padding: 32px; margin-bottom: 24px;">
        
        <!-- Блок с аватаром -->
        <div style="display: flex; align-items: center; gap: 28px; margin-bottom: 32px; padding-bottom: 28px; border-bottom: 1px solid var(--border);">
            <div style="position: relative; flex-shrink: 0;">
                <div style="width: 96px; height: 96px; border-radius: var(--radius-lg); overflow: hidden; background: linear-gradient(135deg, var(--primary), var(--secondary)); display: flex; align-items: center; justify-content: center; font-size: 2.2rem; font-weight: 600; color: var(--text-inverse); box-shadow: var(--shadow-glow); border: 2px solid var(--border-light);">
                    ${profile?.avatar_url
                        ? `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover">`
                        : Fmt.initials(profile?.full_name)}
                </div>
            </div>
            <div style="flex: 1;">
                <h2 style="margin: 0 0 6px 0; font-weight: 700; font-size: 1.75rem; color: var(--text-primary); line-height: 1.2;">${profile?.full_name || 'Користувач'}</h2>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                    ${Fmt.roleBadge(profile?.role)}
                    ${profile?.label === 'intern' ? `<span style="background:rgba(16,185,129,.12);color:#10b981;padding:4px 12px;border-radius:var(--radius-full);font-size:.8rem;font-weight:600;border:1px solid rgba(16,185,129,.25)">🌱 Стажер</span>` : profile?.label === 'mentor' ? `<span style="background:rgba(245,158,11,.12);color:var(--warning);padding:4px 12px;border-radius:var(--radius-full);font-size:.8rem;font-weight:600;border:1px solid rgba(245,158,11,.25)">⭐ Наставник</span>` : ''}
                </div>
                <p style="margin: 0; color: var(--text-secondary); font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                    <span style="opacity: 0.6;">✉️</span> ${profile?.email || '—'}
                </p>
            </div>
        </div>

        <!-- Сетка полей -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px 32px;">
            
            ${fieldStyled('📞 Телефон', profile?.phone)}
            ${fieldStyled('🏙️ Місто', profile?.city)}
            
            ${fieldStyled('💼 Посада', profile?.job_position)}
            ${fieldStyled('📁 Підрозділ', profile?.subdivision)}
            ${fieldStyled('🎂 Дата народження', profile?.birth_date ? Fmt.date(profile.birth_date) : '')}
            ${fieldStyled('👔 Керівник', manager ? `${manager.full_name}${manager.job_position ? `<br><span style="font-size:.85rem;color:var(--text-muted);font-weight:400">${Fmt.esc(manager.job_position)}</span>` : ''}` : '')}
            ${fieldStyled('📅 В компанії з', profile?.hired_at ? `${Fmt.date(profile.hired_at)} <span style="font-size:.8rem;color:var(--text-muted);font-weight:400">${tenureStr(profile.hired_at)}</span>` : '')}
            ${fieldStyled('🗓️ На посаді з', profile?.position_since ? `${Fmt.date(profile.position_since)} <span style="font-size:.8rem;color:var(--text-muted);font-weight:400">${tenureStr(profile.position_since)}</span>` : '')}
        </div>
    </div>

    <!-- Блок подчинённых -->
    ${subordinates.length ? `
    <div style="background: var(--bg-surface); border-radius: var(--radius-xl); box-shadow: var(--shadow-md); border: 1px solid var(--border); overflow: hidden;">
        <div style="padding: 20px 28px; border-bottom: 1px solid var(--border);">
            <h3 style="margin: 0; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                <span>👥 Підлеглі</span>
                <span style="background: var(--bg-raised); color: var(--text-secondary); padding: 2px 10px; border-radius: var(--radius-full); font-size: 0.8rem; border: 1px solid var(--border-light);">${subordinates.length}</span>
            </h3>
        </div>
        <div style="padding: 8px 0;">
            ${subordinates.map(s => `
                <div style="display: flex; align-items: center; gap: 16px; padding: 12px 28px; transition: background var(--transition); border-bottom: 1px solid var(--border);">
                    <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: linear-gradient(135deg, var(--bg-raised), var(--bg-hover)); display: flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: 600; color: var(--primary); flex-shrink: 0; overflow: hidden; border: 1px solid var(--border-light);">
                        ${s.avatar_url ? `<img src="${s.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : Fmt.initials(s.full_name)}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 2px;">${s.full_name}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${[s.job_position, s.subdivision].filter(Boolean).join(' · ') || s.email}</div>
                    </div>
                    <div style="opacity: 0.4; color: var(--text-muted);">→</div>
                </div>
            `).join('')}
        </div>
    </div>` : ''}
</div>`;

// Вспомогательная функция для полей (тёмная тема)
function tenureStr(dateStr) {
    if (!dateStr) return '';
    const from  = new Date(dateStr);
    const today = new Date();
    let years  = today.getFullYear() - from.getFullYear();
    let months = today.getMonth()    - from.getMonth();
    if (months < 0) { years--; months += 12; }
    const parts = [];
    if (years > 0)  parts.push(`${years} ${years === 1 ? 'рік' : years < 5 ? 'роки' : 'років'}`);
    if (months > 0) parts.push(`${months} міс.`);
    if (!parts.length) parts.push('менше місяця');
    return parts.join(' ');
}

function fieldStyled(label, value) {
    const displayValue = value || '<span style="color: var(--text-muted); opacity: 0.5;">—</span>';
    return `
        <div style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted);">${label}</span>
            <span style="font-size: 1rem; color: var(--text-primary); font-weight: 500; word-break: break-word;">${displayValue}</span>
        </div>
    `;
}
    },

    async editProfile() {
        const container = document.getElementById('page-content');
        await ProfilePage.openAsSelf(container, () => App.renderProfile(container));
    },


};

// ── Bootstrap ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    App.boot().catch(err => {
        console.error('Boot error:', err);
        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('auth-screen').classList.remove('hidden');
    });
});

// ── Responsive sidebar handling ────────────────────────────────────
window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) UI.closeSidebar();
});

// ── Activity Tracker ──────────────────────────────────────────────
const ActivityTracker = {
    _pageNames: {
        'dashboard': 'Головна', 'knowledge-base': 'База знань', 'documents': 'Документи',
        'courses': 'Курси', 'news': 'Новини', 'analytics': 'Аналітика',
        'admin': 'Адміністрування', 'scheduler': 'Планувальник', 'contacts': 'Контакти',
        'profile': 'Мій профіль', 'bookmarks': 'Закладки', 'my-tests': 'Мої тести',
        'my-calendar': 'Мій календар', 'notifications': 'Сповіщення',
        'schedule-graph': 'Графік роботи', 'expert-path': 'Шлях навчання',
        'results': 'Мої результати', 'branch-docs': 'Куточок споживача',
    },
    _adminTabNames: {
        'users': 'Користувачі', 'courses': 'Курси', 'tests': 'Тести', 'news': 'Новини',
        'access-groups': 'Доступ до ресурсів',
        'trash': 'Кошик', 'logs': 'Логи', 'supersearch': 'Супер пошук', 'activity': 'Активність',
    },
    _lastKey: null,   // route+tab dedup key
    _lastKeyTime: 0,
    _DEDUP_MS: 3000,  // ігноруємо повторний page_view тієї самої сторінки протягом 3с

    start() {
        window.addEventListener('hashchange', () => this._onNav());
        this._onNav();
    },

    _onNav() {
        const hash   = location.hash.slice(2) || 'dashboard';
        const [route, qs] = hash.split('?');
        const params = Object.fromEntries(new URLSearchParams(qs || ''));
        const base   = route.split('/')[0];
        const id     = route.split('/')[1] || null;

        // Build dedup key: include tab param so admin?tab=users ≠ admin?tab=courses
        const key = route + (params.tab ? '|' + params.tab : '');
        const now = Date.now();
        if (key === this._lastKey && now - this._lastKeyTime < this._DEDUP_MS) return;
        this._lastKey     = key;
        this._lastKeyTime = now;

        // These routes log their own specific event after loading — skip generic page_view
        const _skipGeneric = ['resource', 'courses', 'lessons', 'tests', 'news'];
        if (id && _skipGeneric.includes(base)) return;

        // Human-readable title
        let pageName = this._pageNames[base] || base;
        if (base === 'admin' && params.tab) {
            pageName = 'Адміністрування · ' + (this._adminTabNames[params.tab] || params.tab);
        }

        API.activityLog.log('page_view', {
            page: key,
            entity_type:  id ? base : null,
            entity_id:    id && id.match(/^[0-9a-f-]{36}$/) ? id : null,
            entity_title: pageName,
        });
    },

    // Called from specific spots in page modules
    track(action, opts = {}) {
        API.activityLog.log(action, opts);
    },
};

// ── День народження ────────────────────────────────────────────────
const BirthdayModal = {
    check(profile) {
        if (!profile?.birth_date) return;
        const today = new Date();
        const bd    = new Date(profile.birth_date);
        if (bd.getDate() !== today.getDate() || bd.getMonth() !== today.getMonth()) return;
        const key = `bd_shown_${profile.id}_${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
        if (localStorage.getItem(key)) {
            setTimeout(() => this._placeBadge(), 900);
            return;
        }
        localStorage.setItem(key, '1');
        setTimeout(() => this._show(profile), 600);
    },

    _show(profile) {
        const age  = new Date().getFullYear() - new Date(profile.birth_date).getFullYear();
        const name = profile.full_name?.split(' ')[1] || profile.full_name || '';

        // Конфеті — більше і різноманітніше
        const colors  = ['#f59e0b','#6366f1','#10b981','#ec4899','#3b82f6','#f43f5e','#8b5cf6','#06b6d4'];
        const shapes  = ['50%','4px','0']; // circle, rounded-rect, diamond
        const confetti = Array.from({length: 32}, (_, i) => {
            const color = colors[i % colors.length];
            const shape = shapes[i % shapes.length];
            const size  = 6 + Math.random() * 7;
            const rot   = Math.random() * 360;
            return `<div style="position:absolute;top:-12px;left:${Math.random()*100}%;
                width:${size}px;height:${size}px;border-radius:${shape};background:${color};
                transform:rotate(${rot}deg);
                animation:bd-drop ${1.8 + Math.random()*2}s ease-in ${(i*0.08).toFixed(2)}s infinite">
            </div>`;
        }).join('');

        // Зірки навколо аватара
        const stars = Array.from({length: 8}, (_, i) => {
            const angle = (i / 8) * 360;
            const r = 72;
            const x = 50 + r * Math.cos(angle * Math.PI/180);
            const y = 50 + r * Math.sin(angle * Math.PI/180);
            return `<div style="position:absolute;left:${x}%;top:${y}%;transform:translate(-50%,-50%);
                font-size:${.9 + Math.random()*.5}rem;
                animation:bd-spin-star 3s ease-in-out ${(i*.2).toFixed(1)}s infinite alternate">
                ${'⭐✨🌟💫'[i%4]}
            </div>`;
        }).join('');

        const overlay = document.createElement('div');
        overlay.id = 'birthday-modal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(8px);animation:fadeIn .25s ease';

        overlay.innerHTML = `
<style>
@keyframes bd-in{from{opacity:0;transform:translateY(40px) scale(.88)}to{opacity:1;transform:none}}
@keyframes bd-drop{0%{opacity:1;transform:translateY(-10px) rotate(0deg) scaleX(1)}100%{opacity:0;transform:translateY(130px) rotate(${Math.random()>0.5?'':'-'}${180+Math.floor(Math.random()*180)}deg) scaleX(${Math.random()>.5?-1:1})}}
@keyframes bd-float{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-16px) rotate(3deg)}}
@keyframes bd-glow{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}50%{box-shadow:0 0 32px 8px rgba(245,158,11,.35)}}
@keyframes bd-spin-star{from{transform:translate(-50%,-50%) scale(.8) rotate(-15deg)}to{transform:translate(-50%,-50%) scale(1.2) rotate(15deg)}}
@keyframes bd-shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
.bd-box{background:var(--bg-surface);border-radius:32px;padding:0;max-width:440px;width:100%;overflow:hidden;
    box-shadow:0 32px 100px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.08);
    animation:bd-in .5s cubic-bezier(.34,1.4,.64,1)}
.bd-hero{position:relative;padding:2.5rem 2rem 1.5rem;text-align:center;
    background:linear-gradient(135deg,#f59e0b 0%,#ec4899 40%,#6366f1 100%);overflow:hidden}
.bd-confetti-wrap{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.bd-avatar-wrap{position:relative;width:100px;height:100px;margin:0 auto 1rem;display:inline-block}
.bd-avatar{width:100px;height:100px;border-radius:50%;border:4px solid rgba(255,255,255,.7);
    background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;
    font-size:2.2rem;font-weight:700;color:#fff;overflow:hidden;
    box-shadow:0 8px 32px rgba(0,0,0,.25);animation:bd-glow 2s ease-in-out infinite}
.bd-avatar img{width:100%;height:100%;object-fit:cover}
.bd-age{position:absolute;bottom:-6px;right:-6px;background:#f59e0b;color:#fff;
    font-size:.75rem;font-weight:800;padding:3px 8px;border-radius:20px;
    border:2px solid var(--bg-surface);white-space:nowrap}
.bd-hero-name{font-size:1.4rem;font-weight:800;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.2);margin-bottom:.3rem}
.bd-hero-sub{font-size:.9rem;color:rgba(255,255,255,.85)}
.bd-body{padding:1.5rem 2rem 2rem;text-align:center}
.bd-title{font-size:1.75rem;font-weight:900;margin-bottom:.5rem;
    background:linear-gradient(135deg,#f59e0b,#ec4899,#6366f1);
    background-size:200% auto;
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;
    animation:bd-shimmer 3s linear infinite}
.bd-text{font-size:.95rem;color:var(--text-secondary);line-height:1.65;margin-bottom:1.5rem}
.bd-btn{padding:.8rem 2.5rem;border:none;border-radius:50px;font-size:1rem;font-weight:700;cursor:pointer;
    background:linear-gradient(135deg,#f59e0b,#ec4899,#6366f1);
    background-size:200% auto;color:#fff;
    box-shadow:0 6px 24px rgba(236,72,153,.4);
    transition:opacity .15s,transform .15s;animation:bd-shimmer 3s linear infinite}
.bd-btn:hover{opacity:.9;transform:scale(1.04)}
</style>
<div class="bd-box">
    <div class="bd-hero">
        <div class="bd-confetti-wrap">${confetti}</div>
        <div class="bd-avatar-wrap">
            <div class="bd-avatar">
                ${profile.avatar_url ? `<img src="${profile.avatar_url}" alt="">` : `<span>${Fmt.initials(profile.full_name)}</span>`}
            </div>
            ${age > 0 ? `<div class="bd-age">🎂 ${age}</div>` : ''}
            <div style="position:absolute;inset:-20px;pointer-events:none;overflow:hidden">${stars}</div>
        </div>
        <div class="bd-hero-name">${Fmt.esc(profile.full_name || '')}</div>
        <div class="bd-hero-sub">${profile.job_position ? Fmt.esc(profile.job_position) : ''}</div>
    </div>
    <div class="bd-body">
        <div class="bd-title">🎉 З Днем Народження!</div>
        <div class="bd-text">
            Сьогодні особливий день, <strong>${Fmt.esc(name)}</strong>! 🥳<br>
            Бажаємо здоров'я, натхнення та нових звершень.<br>
            Нехай цей рік принесе лише найкраще! 🌟
        </div>
        <button class="bd-btn" onclick="BirthdayModal._flyOut()">
            🎊 Дякую!
        </button>
    </div>
</div>`;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) BirthdayModal._flyOut(); });
    },

    _flyOut() {
        const modal   = document.getElementById('birthday-modal');
        const emojiEl = modal?.querySelector('.bd-avatar-wrap');
        if (!modal) return;

        const from = emojiEl ? emojiEl.getBoundingClientRect()
                              : { top: window.innerHeight/2, left: window.innerWidth/2, width: 0, height: 0 };

        // 1. Затухає модалка
        modal.style.transition = 'opacity .55s ease';
        modal.style.opacity = '0';

        setTimeout(() => {
            modal.remove();

            // 2. Торт летить у топбар між дзвоником і профілем
            const bell    = document.getElementById('ntf-bell');
            const profile = document.querySelector('.tb-user-wrap');
            let toLeft, toTop;
            if (bell && profile) {
                const bR = bell.getBoundingClientRect();
                const pR = profile.getBoundingClientRect();
                toLeft = bR.right + (pR.left - bR.right) / 2 - 14;
                toTop  = bR.top + bR.height / 2 - 14;
            } else {
                toLeft = window.innerWidth - 100;
                toTop  = 14;
            }

            const fly = document.createElement('div');
            fly.textContent = '🎂';
            fly.style.cssText = `
                position:fixed;z-index:99999;pointer-events:none;font-size:3rem;line-height:1;
                top:${from.top + from.height/2 - 24}px;
                left:${from.left + from.width/2 - 24}px;
                transition:top 1.1s cubic-bezier(.4,0,.2,1),
                           left 1.1s cubic-bezier(.4,0,.2,1),
                           font-size 1.1s cubic-bezier(.4,0,.2,1);
            `;
            document.body.appendChild(fly);

            requestAnimationFrame(() => requestAnimationFrame(() => {
                fly.style.top      = `${toTop}px`;
                fly.style.left     = `${toLeft}px`;
                fly.style.fontSize = '1.35rem';
            }));

            setTimeout(() => {
                fly.remove();
                this._placeBadge();
            }, 1200);
        }, 580);
    },

    _placeBadge() {
        if (document.getElementById('bd-topbar-cake')) return;
        const bell    = document.getElementById('ntf-bell');
        const profile = document.querySelector('.tb-user-wrap');
        if (!bell && !profile) return;

        if (!document.getElementById('bd-badge-style')) {
            const s = document.createElement('style');
            s.id = 'bd-badge-style';
            s.textContent = `
                @keyframes bd-badge-in{from{opacity:0;transform:scale(.2) rotate(-30deg)}to{opacity:1;transform:scale(1) rotate(0deg)}}
                @keyframes bd-badge-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.25) rotate(8deg)}}
                #bd-topbar-cake{animation:bd-badge-in .4s cubic-bezier(.34,1.56,.64,1) forwards,bd-badge-pulse 2s ease-in-out .4s infinite}
            `;
            document.head.appendChild(s);
        }

        const cake = document.createElement('span');
        cake.id = 'bd-topbar-cake';
        cake.textContent = '🎂';
        cake.title = 'Сьогодні твій день народження! 🎉';
        cake.style.cssText = 'font-size:1.3rem;line-height:1;cursor:default;display:inline-flex;align-items:center;margin:0 4px';

        if (bell && profile) {
            profile.parentNode.insertBefore(cake, profile);
        } else {
            const anchor = bell || profile;
            anchor.parentNode.insertBefore(cake, anchor.nextSibling);
        }
    },

    // Демо: BirthdayModal.demo()
    demo() {
        const profile = { ...AppState.profile, birth_date: new Date().toISOString().slice(0,10) };
        document.getElementById('birthday-modal')?.remove();
        this._show(profile);
    }
};

// ── Річниця в компанії ─────────────────────────────────────────────
const AnniversaryModal = {
    check(profile) {
        if (!profile?.hired_at) return;
        const today = new Date();
        const hired = new Date(profile.hired_at);
        // Перевіряємо день і місяць
        if (hired.getDate() !== today.getDate() || hired.getMonth() !== today.getMonth()) return;
        const years = today.getFullYear() - hired.getFullYear();
        if (years < 1) return; // перший рік не рахуємо
        // Показуємо модалку раз на день, але торт у топбарі — весь день
        const key     = `anniversary_shown_${profile.id}_${today.getFullYear()}`;
        const badgeKey = `anniversary_badge_${profile.id}_${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
        if (localStorage.getItem(key)) {
            // Модалку вже показали — просто ставимо торт у топбар
            if (!localStorage.getItem(badgeKey)) return; // не сьогодні закрита — не показуємо
            setTimeout(() => this._placeBadge(), 1000);
            return;
        }
        localStorage.setItem(key, '1');
        setTimeout(() => this._show(profile, years), 800);
    },

    _show(profile, years) {
        const yLabel = years === 1 ? 'рік' : years < 5 ? 'роки' : 'років';
        const emojis = ['🎉','🎊','🏆','⭐','🌟','✨','🎈'];
        const confetti = Array.from({length: 18}, (_, i) =>
            `<div class="anv-dot" style="left:${Math.random()*100}%;animation-delay:${(i*0.12).toFixed(2)}s;background:${['#f59e0b','#6366f1','#10b981','#ec4899','#3b82f6'][i%5]}"></div>`
        ).join('');

        const overlay = document.createElement('div');
        overlay.id = 'anniversary-modal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px);animation:fadeIn .2s ease';
        overlay.innerHTML = `
<style>
@keyframes anv-in{from{opacity:0;transform:translateY(30px) scale(.92)}to{opacity:1;transform:none}}
@keyframes anv-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-18px)}}
@keyframes anv-drop{0%{opacity:1;transform:translateY(-20px) rotate(0deg)}100%{opacity:0;transform:translateY(120px) rotate(360deg)}}
.anv-box{background:var(--bg-surface);border-radius:28px;padding:2.5rem 2rem 2rem;max-width:420px;width:100%;text-align:center;position:relative;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.3);animation:anv-in .4s cubic-bezier(.34,1.56,.64,1)}
.anv-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.anv-dot{position:absolute;top:-10px;width:8px;height:8px;border-radius:50%;animation:anv-drop 2.5s ease-in infinite}
.anv-emoji{font-size:4rem;animation:anv-float 3s ease-in-out infinite;display:inline-block;margin-bottom:.5rem}
.anv-years{font-size:3.5rem;font-weight:900;background:linear-gradient(135deg,var(--primary),var(--secondary));-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;margin:.25rem 0}
.anv-title{font-size:1.3rem;font-weight:700;color:var(--text-primary);margin:.5rem 0 .3rem}
.anv-sub{font-size:.92rem;color:var(--text-secondary);line-height:1.5;margin-bottom:1.5rem}
.anv-btn{padding:.7rem 2rem;background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff;border:none;border-radius:50px;font-size:.95rem;font-weight:700;cursor:pointer;transition:opacity .15s;box-shadow:0 4px 16px rgba(99,102,241,.35)}
.anv-btn:hover{opacity:.88}
</style>
<div class="anv-box">
    <div class="anv-confetti">${confetti}</div>
    <div class="anv-emoji">🎂</div>
    <div class="anv-years">${years} ${yLabel}</div>
    <div class="anv-title">Річниця в компанії!</div>
    <div class="anv-sub">
        Вітаємо, <strong>${Fmt.esc(profile.full_name?.split(' ')[1] || profile.full_name || '')}</strong>!<br>
        Сьогодні виповнюється <strong>${years} ${yLabel}</strong> як ти з нами.<br>
        Дякуємо за твій внесок і вірність команді 💙
    </div>
    <button class="anv-btn" onclick="AnniversaryModal._flyOut()">
        ${emojis[Math.floor(Math.random()*emojis.length)]} Дякую!
    </button>
</div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    },

    _flyOut() {
        const modal   = document.getElementById('anniversary-modal');
        const emojiEl = modal?.querySelector('.anv-emoji');
        if (!emojiEl) { modal?.remove(); return; }

        const from = emojiEl.getBoundingClientRect();

        // 1. Спочатку затухає модалка (0.5s)
        modal.style.transition = 'opacity .5s ease';
        modal.style.opacity = '0';

        setTimeout(() => {
            modal.remove();

            // 2. Після зникнення — торт стартує з центру екрана і летить у топбар
            const bell    = document.getElementById('ntf-bell');
            const profile = document.getElementById('header-user');
            // Ціль — між дзвоником і профілем
            let toLeft, toTop;
            if (bell && profile) {
                const bR = bell.getBoundingClientRect();
                const pR = profile.getBoundingClientRect();
                toLeft = bR.right + (pR.left - bR.right) / 2 - 14;
                toTop  = bR.top + bR.height / 2 - 14;
            } else {
                toLeft = window.innerWidth - 100;
                toTop  = 14;
            }

            const fly = document.createElement('div');
            fly.textContent = '🎂';
            fly.style.cssText = `
                position:fixed;z-index:99999;pointer-events:none;font-size:3rem;line-height:1;
                top:${from.top + from.height/2 - 24}px;
                left:${from.left + from.width/2 - 24}px;
                transition:top 1.1s cubic-bezier(.4,0,.2,1),
                           left 1.1s cubic-bezier(.4,0,.2,1),
                           font-size 1.1s cubic-bezier(.4,0,.2,1);
            `;
            document.body.appendChild(fly);

            requestAnimationFrame(() => requestAnimationFrame(() => {
                fly.style.top      = `${toTop}px`;
                fly.style.left     = `${toLeft}px`;
                fly.style.fontSize = '1.35rem';
            }));

            setTimeout(() => {
                fly.remove();
                const p = AppState.profile;
                if (p) {
                    const t = new Date();
                    localStorage.setItem(`anniversary_badge_${p.id}_${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`, '1');
                }
                this._placeBadge();
            }, 1200);

        }, 520);
    },

    _placeBadge() {
        if (document.getElementById('anv-topbar-cake')) return;
        const bell    = document.getElementById('ntf-bell');
        const profile = document.querySelector('.tb-user-wrap') || document.getElementById('header-user');
        const anchor  = profile || bell;
        if (!anchor) return;

        if (!document.getElementById('anv-badge-style')) {
            const s = document.createElement('style');
            s.id = 'anv-badge-style';
            s.textContent = `
                @keyframes anv-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}
                @keyframes anv-appear{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
                #anv-topbar-cake{animation:anv-appear .3s cubic-bezier(.34,1.56,.64,1) forwards,anv-pulse 2.5s ease-in-out 0.3s infinite}
            `;
            document.head.appendChild(s);
        }

        const cake = document.createElement('span');
        cake.id = 'anv-topbar-cake';
        cake.textContent = '🎂';
        cake.title = 'Сьогодні твоя річниця в компанії!';
        cake.style.cssText = 'font-size:1.3rem;line-height:1;cursor:default;display:inline-flex;align-items:center;margin:0 4px';

        // Вставляємо між дзвоником і профілем
        if (bell && profile) {
            profile.parentNode.insertBefore(cake, profile);
        } else {
            anchor.parentNode.insertBefore(cake, anchor.nextSibling);
        }
    },

    // Демо: AnniversaryModal.demo(5)
    demo(years = 3) {
        const profile = { ...AppState.profile, hired_at: new Date(new Date().getFullYear() - years, new Date().getMonth(), new Date().getDate()).toISOString().slice(0,10) };
        document.getElementById('anniversary-modal')?.remove();
        this._show(profile, years);
    }
};

// ================================================================
// CompanyBirthdayModal — 9 листопада, день народження Скарбниці
// ================================================================
const CompanyBirthdayModal = {
    FOUNDED: 1992,
    FOUNDED_MONTH: 10, // 0-based = листопад
    FOUNDED_DAY: 9,

    check() {
        const today = new Date();
        if (today.getDate() !== this.FOUNDED_DAY || today.getMonth() !== this.FOUNDED_MONTH) return;
        // Модалка — раз на день
        const key = `company_bday_${today.getFullYear()}`;
        if (!localStorage.getItem(key)) {
            localStorage.setItem(key, '1');
            setTimeout(() => this._show(), 1200);
        }
        // Бейдж у топбарі + дощ emoji — весь день
        setTimeout(() => { this._showTopbarBadge(); this._startEmojiRain(); }, 800);
    },

    _topbarKey() {
        const t = new Date();
        return `company_bday_topbar_hidden_${t.getFullYear()}`;
    },

    _startEmojiRain() {
        if (document.getElementById('cbd-emoji-rain')) return;
        const rain = document.createElement('div');
        rain.id = 'cbd-emoji-rain';
        rain.style.cssText = 'position:fixed;top:0;left:0;right:0;height:150px;pointer-events:none;z-index:9998;overflow:hidden;mask-image:linear-gradient(to bottom,black 40%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,black 40%,transparent 100%)';

        const emojis = ['💎','✨','⭐','🌟','💫','🏆','🎊','🎉'];
        const count  = 12;

        let styleEl = document.getElementById('cbd-rain-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'cbd-rain-style';
            styleEl.textContent = `@keyframes cbd-rain-fall{0%{transform:translateY(-40px) rotate(0deg);opacity:1}70%{opacity:.6}100%{transform:translateY(160px) rotate(360deg);opacity:0}}`;
            document.head.appendChild(styleEl);
        }

        const createDrop = () => {
            const el = document.createElement('div');
            el.style.cssText = `
                position:absolute;
                left:${Math.random()*100}%;
                top:-60px;
                font-size:${1 + Math.random() * 1.4}rem;
                animation:cbd-rain-fall ${5 + Math.random()*6}s linear ${Math.random()*4}s infinite;
                user-select:none;`;
            el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            return el;
        };

        for (let i = 0; i < count; i++) rain.appendChild(createDrop());
        document.body.appendChild(rain);
    },

    _stopEmojiRain() {
        document.getElementById('cbd-emoji-rain')?.remove();
    },

    _showTopbarBadge() {
        if (document.getElementById('cbd-topbar-badge')) return;
        if (localStorage.getItem(this._topbarKey())) return;

        if (!document.getElementById('cbd-topbar-style')) {
            const s = document.createElement('style');
            s.id = 'cbd-topbar-style';
            s.textContent = `
@keyframes cbd-sparkle{0%,100%{transform:scale(1) rotate(-3deg)}25%{transform:scale(1.15) rotate(3deg)}75%{transform:scale(0.95) rotate(-2deg)}}
@keyframes cbd-glow{0%,100%{filter:drop-shadow(0 0 4px rgba(201,162,39,.6))}50%{filter:drop-shadow(0 0 12px rgba(255,215,0,.9))}}
@keyframes cbd-badge-in{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
#cbd-topbar-badge{display:inline-flex;align-items:center;gap:.3rem;background:rgba(201,162,39,.1);
    border:1px solid rgba(201,162,39,.35);border-radius:20px;padding:.2rem .65rem .2rem .45rem;
    cursor:pointer;transition:background .15s;margin:0 4px}
#cbd-topbar-badge:hover{background:rgba(201,162,39,.18)}
#cbd-topbar-badge .cbd-gem{font-size:1rem}
#cbd-topbar-badge .cbd-text{font-size:.72rem;font-weight:700;color:#C9A227;letter-spacing:.03em;white-space:nowrap}
#cbd-topbar-badge .cbd-close{font-size:.65rem;color:rgba(201,162,39,.5);margin-left:.2rem;line-height:1;transition:color .15s}
#cbd-topbar-badge:hover .cbd-close{color:#C9A227}`;
            document.head.appendChild(s);
        }

        const rainHidden = !!localStorage.getItem(this._topbarKey());
        const badge = document.createElement('div');
        badge.id = 'cbd-topbar-badge';
        badge.innerHTML = `
            <span class="cbd-gem" style="cursor:pointer" title="Відкрити вікно свята" onclick="CompanyBirthdayModal.demo()">💎</span>
            <span class="cbd-text">34 роки Скарбниці!</span>
            <button id="cbd-rain-toggle" onclick="CompanyBirthdayModal._toggleRain()"
                style="background:none;border:1.5px solid rgba(201,162,39,.45);border-radius:12px;padding:.3rem .75rem;cursor:pointer;font-size:.82rem;font-weight:700;color:#C9A227;font-family:inherit;transition:background .15s;white-space:nowrap;line-height:1"
                onmouseenter="this.style.background='rgba(201,162,39,.15)'" onmouseleave="this.style.background='none'">
                ${rainHidden ? 'Увімкнути ефекти' : 'Вимкнути ефекти'}
            </button>`;

        const ntfBell = document.getElementById('ntf-bell');
        if (ntfBell) {
            ntfBell.parentNode.insertBefore(badge, ntfBell);
        } else {
            document.querySelector('.sidebar-bottom')?.appendChild(badge);
        }
    },

    _toggleRain() {
        const hidden = !!localStorage.getItem(this._topbarKey());
        const btn = document.getElementById('cbd-rain-toggle');
        if (hidden) {
            localStorage.removeItem(this._topbarKey());
            this._startEmojiRain();
            if (btn) btn.textContent = 'Вимкнути ефекти';
        } else {
            localStorage.setItem(this._topbarKey(), '1');
            this._stopEmojiRain();
            if (btn) btn.textContent = 'Увімкнути ефекти';
        }
    },

    _show() {
        const years = new Date().getFullYear() - this.FOUNDED;
        const gems = Array.from({length: 24}, (_, i) => {
            const emojis = ['💎','✨','⭐','🌟','💫','🏆'];
            const em = emojis[i % emojis.length];
            const colors = ['#C9A227','#FFD700','#6366f1','#10b981','#f59e0b','#ec4899'];
            return `<div style="position:absolute;top:-12px;left:${Math.random()*100}%;
                font-size:${.9+Math.random()*.8}rem;pointer-events:none;
                animation:cbd-drop ${2+Math.random()*2}s ease-in ${(i*0.1).toFixed(2)}s infinite">
                ${em}</div>`;
        }).join('');

        const overlay = document.createElement('div');
        overlay.id = 'company-bday-modal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .3s ease';
        overlay.innerHTML = `
<style>
@keyframes cbd-drop{0%{opacity:1;transform:translateY(-10px) rotate(0deg)}100%{opacity:0;transform:translateY(140px) rotate(720deg)}}
@keyframes cbd-in{from{opacity:0;transform:scale(.8) translateY(30px)}to{opacity:1;transform:none}}
@keyframes cbd-shine{0%,100%{background-position:200% center}50%{background-position:-200% center}}
@keyframes cbd-pulse{0%,100%{box-shadow:0 0 0 0 rgba(201,162,39,.4)}50%{box-shadow:0 0 0 18px rgba(201,162,39,0)}}
@keyframes cbd-float{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-14px) rotate(2deg)}}
.cbd-box{background:linear-gradient(160deg,#0f0c29,#1a1535,#0f0c29);border-radius:32px;padding:0;max-width:520px;width:100%;
    overflow:hidden;box-shadow:0 32px 100px rgba(0,0,0,.5),0 0 0 1px rgba(201,162,39,.3);
    animation:cbd-in .5s cubic-bezier(.34,1.4,.64,1)}
.cbd-hero{position:relative;padding:2.5rem 2rem 1.8rem;text-align:center;overflow:hidden;
    background:linear-gradient(135deg,rgba(201,162,39,.15),rgba(99,102,241,.1),rgba(201,162,39,.12))}
.cbd-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(201,162,39,.25),transparent 70%)}
.cbd-gems-wrap{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.cbd-logo{width:80px;height:80px;margin:0 auto .75rem;display:flex;align-items:center;justify-content:center;
    border-radius:24px;background:linear-gradient(135deg,#C9A227,#FFD700,#C9A227);
    box-shadow:0 8px 32px rgba(201,162,39,.5);animation:cbd-pulse 2.5s ease-in-out infinite,cbd-float 4s ease-in-out infinite;
    font-size:2.8rem}
.cbd-year-badge{display:inline-flex;align-items:center;gap:.4rem;background:rgba(201,162,39,.15);
    border:1px solid rgba(201,162,39,.4);border-radius:20px;padding:.3rem 1rem;margin-bottom:.6rem;
    font-size:.75rem;font-weight:700;color:#C9A227;letter-spacing:.08em;text-transform:uppercase}
.cbd-title{font-size:1.65rem;font-weight:900;line-height:1.2;margin-bottom:.4rem;
    background:linear-gradient(90deg,#C9A227,#FFD700,#C9A227);background-size:200% auto;
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:cbd-shine 4s linear infinite}
.cbd-sub{font-size:.92rem;color:rgba(255,255,255,.65);line-height:1.55}
.cbd-body{padding:1.5rem 2rem 2rem;background:var(--bg-surface)}
.cbd-stat{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem;margin-bottom:1.25rem}
.cbd-stat-item{text-align:center;background:var(--bg-raised);border:1px solid var(--border);border-radius:14px;padding:.75rem .5rem}
.cbd-stat-num{font-size:1.6rem;font-weight:900;color:#C9A227;line-height:1}
.cbd-stat-lbl{font-size:.7rem;color:var(--text-muted);margin-top:.2rem;line-height:1.3}
.cbd-msg{font-size:.9rem;color:var(--text-secondary);line-height:1.6;text-align:center;margin-bottom:1.5rem}
.cbd-btn{width:100%;padding:.85rem;border:none;border-radius:50px;font-size:1rem;font-weight:800;cursor:pointer;
    background:linear-gradient(135deg,#C9A227,#FFD700,#C9A227);background-size:200% auto;
    color:#0f0c29;box-shadow:0 6px 24px rgba(201,162,39,.4);animation:cbd-shine 3s linear infinite;
    transition:opacity .15s,transform .1s;font-family:inherit}
.cbd-btn:hover{opacity:.9;transform:scale(1.02)}
</style>
<div class="cbd-box">
    <div class="cbd-hero">
        <div class="cbd-gems-wrap">${gems}</div>
        <div class="cbd-logo">💎</div>
        <div class="cbd-year-badge">✦ З 1992 року ✦</div>
        <div class="cbd-title">З Днем Народження,<br>Скарбниця!</div>
        <div class="cbd-sub">Першій мережі ломбардів в Україні — вже <strong style="color:#FFD700">${years} років</strong>!</div>
    </div>
    <div class="cbd-body">
        <div class="cbd-stat">
            <div class="cbd-stat-item">
                <div class="cbd-stat-num">${years}</div>
                <div class="cbd-stat-lbl">років на ринку</div>
            </div>
            <div class="cbd-stat-item">
                <div class="cbd-stat-num">#1</div>
                <div class="cbd-stat-lbl">перша мережа ломбардів в Україні</div>
            </div>
            <div class="cbd-stat-item">
                <div class="cbd-stat-num">1992</div>
                <div class="cbd-stat-lbl">рік заснування</div>
            </div>
        </div>
        <div class="cbd-msg">
            Сьогодні ми відзначаємо особливу дату — день народження нашої компанії.
            Дякуємо кожному члену команди, хто є частиною цієї великої родини! 🏆
        </div>
        <button class="cbd-btn" onclick="CompanyBirthdayModal._close()">
            💎 Вітаємо Скарбницю!
        </button>
    </div>
</div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if (e.target === overlay) this._close(); });
    },

    _close() {
        const modal = document.getElementById('company-bday-modal');
        if (modal) { modal.style.transition = 'opacity .3s'; modal.style.opacity = '0'; setTimeout(() => modal.remove(), 320); }
    },

    _chatChannel: null,
    _msgs: [],

    _initDashboardChat() {
        const el = document.getElementById('db-bday-chat');
        if (!el) return;
        const today = new Date();
        const isCompanyDay = today.getDate() === this.FOUNDED_DAY && today.getMonth() === this.FOUNDED_MONTH;
        if (!isCompanyDay) { el.innerHTML = ''; return; }
        this._renderChatCard(el);
    },

    _renderChatCard(container) {
        const year = new Date().getFullYear();
        container.innerHTML = `
<style>
@keyframes cbd-card-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.cbd-card{display:flex;align-items:center;gap:.7rem;padding:.75rem 1rem;
    background:linear-gradient(135deg,rgba(201,162,39,.1),rgba(255,215,0,.05));
    border:1.5px solid rgba(201,162,39,.35);border-radius:var(--radius-xl);
    cursor:pointer;user-select:none;transition:background .15s,border-color .2s;
    animation:cbd-card-in .3s ease}
.cbd-card:hover{background:linear-gradient(135deg,rgba(201,162,39,.18),rgba(255,215,0,.1));border-color:rgba(201,162,39,.6)}
.cbd-card-gem{font-size:1.3rem;flex-shrink:0}
.cbd-card-info{flex:1;min-width:0}
.cbd-card-title{font-size:.85rem;font-weight:700;color:var(--text-primary)}
.cbd-card-sub{font-size:.7rem;color:#C9A227;margin-top:.05rem}
.cbd-card-badge{background:linear-gradient(135deg,#C9A227,#FFD700);color:#0f0c29;
    font-size:.7rem;font-weight:800;border-radius:20px;padding:.15rem .55rem;
    min-width:22px;text-align:center;line-height:1.6;flex-shrink:0}
.cbd-card-arrow{font-size:.75rem;color:rgba(201,162,39,.6);flex-shrink:0}
</style>
<div class="cbd-card" onclick="CompanyBirthdayModal._openFullscreen()">
    <span class="cbd-card-gem">💎</span>
    <div class="cbd-card-info">
        <div class="cbd-card-title">Вітаємо Скарбницю!</div>
        <div class="cbd-card-sub">День народження компанії · ${year}</div>
    </div>
    <span id="cbd-card-badge" class="cbd-card-badge" style="display:none">0</span>
    <i class="fa-solid fa-up-right-and-down-left-from-center cbd-card-arrow"></i>
</div>`;
        this._loadMessages(year);
        this._subscribeRealtime(year);
    },

    async _loadMessages(year) {
        try {
            this._msgs = await API.companyBdayMessages.getByYear(year);
            this._updateBadge();
            this._renderFullscreenMessages();
        } catch { }
    },

    _updateBadge() {
        const badge = document.getElementById('cbd-card-badge');
        if (!badge) return;
        const count = this._msgs.length;
        if (count > 0) { badge.textContent = count; badge.style.display = ''; }
        else { badge.style.display = 'none'; }
    },

    _subscribeRealtime(year) {
        this._chatChannel?.unsubscribe();
        this._chatChannel = supabase.channel(`cbd-chat-${year}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'company_bday_messages', filter: `year=eq.${year}` },
                () => this._loadMessages(year))
            .subscribe();
    },

    _openFullscreen() {
        if (document.getElementById('cbd-fs')) return;
        const year = new Date().getFullYear();
        const EMOJIS = ['🎉','🎊','🎂','🎈','🏆','🌟','⭐','✨','💎','🥂','🍾','🎁','🤩','🙌','👏','💐','🌸','💝','💖','🎵','🎆','🎇','🌈','😊','🥳','🎀','🔥','💫','🎯','👑'];
        const fs = document.createElement('div');
        fs.id = 'cbd-fs';
        fs.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.65);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .2s ease';
        fs.innerHTML = `
<style>
@keyframes cbd-fs-in{from{opacity:0;transform:scale(.95) translateY(20px)}to{opacity:1;transform:none}}
.cbd-fs-panel{background:var(--bg-surface);border-radius:24px;width:100%;max-width:680px;height:min(82vh,700px);
    display:flex;flex-direction:column;overflow:hidden;
    box-shadow:0 32px 80px rgba(0,0,0,.4),0 0 0 1px rgba(201,162,39,.25);
    animation:cbd-fs-in .3s cubic-bezier(.34,1.2,.64,1)}
.cbd-fs-head{display:flex;align-items:center;gap:.7rem;padding:1rem 1.25rem;
    background:linear-gradient(135deg,rgba(201,162,39,.15),rgba(255,215,0,.07));
    border-bottom:1px solid rgba(201,162,39,.25);flex-shrink:0}
.cbd-fs-title{font-size:.95rem;font-weight:700;color:var(--text-primary);flex:1}
.cbd-fs-sub{font-size:.72rem;color:#C9A227}
.cbd-fs-close{background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:1.1rem;padding:.3rem;border-radius:8px;transition:background .15s,color .15s;line-height:1;margin-left:auto;flex-shrink:0}
.cbd-fs-close:hover{background:var(--bg-hover);color:var(--text-primary)}
.cbd-fs-msgs{flex:1;overflow-y:auto;padding:.85rem;display:flex;flex-direction:column;gap:.55rem;scrollbar-width:thin}
.cbd-fs-empty{text-align:center;color:var(--text-muted);font-size:.88rem;padding:3rem .5rem}
.cbd-fs-emoji{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:.25rem;padding:.5rem .85rem;
    border-top:1px solid var(--border);background:var(--bg-raised);scrollbar-width:none;flex-shrink:0}
.cbd-fs-emoji::-webkit-scrollbar{display:none}
.cbd-fs-emoji-btn{background:none;border:none;cursor:pointer;font-size:1.2rem;padding:.15rem .2rem;border-radius:6px;transition:transform .1s,background .1s;flex-shrink:0}
.cbd-fs-emoji-btn:hover{transform:scale(1.3);background:var(--bg-hover)}
.cbd-fs-send-row{display:flex;gap:.5rem;padding:.65rem .85rem;border-top:1px solid var(--border);flex-shrink:0}
.cbd-fs-input{flex:1;border:1.5px solid var(--border);border-radius:14px;padding:.5rem .85rem;font-size:.88rem;
    background:var(--bg-surface);color:var(--text-primary);outline:none;font-family:inherit;transition:border-color .15s}
.cbd-fs-input:focus{border-color:#C9A227}
.cbd-fs-send-btn{background:linear-gradient(135deg,#C9A227,#FFD700);border:none;border-radius:14px;
    padding:.5rem 1.1rem;cursor:pointer;color:#0f0c29;font-weight:700;font-size:.88rem;font-family:inherit;
    white-space:nowrap;transition:opacity .15s}
.cbd-fs-send-btn:hover{opacity:.88}
</style>
<div class="cbd-fs-panel">
    <div class="cbd-fs-head">
        <span style="font-size:1.4rem">💎</span>
        <div>
            <div class="cbd-fs-title">Вітаємо Скарбницю!</div>
            <div class="cbd-fs-sub">День народження компанії · ${year}</div>
        </div>
        <button class="cbd-fs-close" onclick="CompanyBirthdayModal._closeFullscreen()" title="Закрити"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div id="cbd-fs-msgs" class="cbd-fs-msgs">
        <div style="text-align:center;padding:2rem"><div class="spinner"></div></div>
    </div>
    <div class="cbd-fs-emoji">
        ${EMOJIS.map(e => `<button class="cbd-fs-emoji-btn" onclick="CompanyBirthdayModal._insertFsEmoji('${e}')">${e}</button>`).join('')}
    </div>
    <div class="cbd-fs-send-row">
        <input id="cbd-fs-input" class="cbd-fs-input" type="text" maxlength="500" placeholder="Напишіть привітання... 🎉"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();CompanyBirthdayModal._sendMsg()}">
        <button class="cbd-fs-send-btn" onclick="CompanyBirthdayModal._sendMsg()">Надіслати</button>
    </div>
</div>`;
        fs.addEventListener('click', e => { if (e.target === fs) this._closeFullscreen(); });
        document.addEventListener('keydown', this._onFsKey);
        document.body.appendChild(fs);
        this._renderFullscreenMessages();
        setTimeout(() => document.getElementById('cbd-fs-input')?.focus(), 80);
    },

    _onFsKey(e) { if (e.key === 'Escape') CompanyBirthdayModal._closeFullscreen(); },

    _closeFullscreen() {
        const fs = document.getElementById('cbd-fs');
        if (!fs) return;
        fs.style.transition = 'opacity .2s';
        fs.style.opacity = '0';
        setTimeout(() => fs.remove(), 210);
        document.removeEventListener('keydown', this._onFsKey);
    },

    _renderFullscreenMessages() {
        const list = document.getElementById('cbd-fs-msgs');
        if (!list) return;
        const msgs = this._msgs;
        if (!msgs.length) {
            list.innerHTML = `<div class="cbd-fs-empty">Будьте першим хто привітає! 🎊</div>`;
            return;
        }
        const myId = AppState.user?.id;
        list.innerHTML = msgs.map(m => {
            const isMe = m.user?.id === myId;
            const initials = Fmt.initials(m.user?.full_name || '?');
            const time = new Date(m.created_at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
            const avatar = m.user?.avatar_url
                ? `<img src="${m.user.avatar_url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0" onerror="this.style.display='none'">`
                : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#C9A227,#6366f1);display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:#fff;flex-shrink:0">${Fmt.esc(initials)}</div>`;
            return `<div data-msg-id="${m.id}" style="display:flex;gap:.55rem;align-items:flex-start;${isMe ? 'flex-direction:row-reverse' : ''}">
                ${avatar}
                <div style="max-width:72%;min-width:0">
                    <div style="font-size:.7rem;color:var(--text-muted);margin-bottom:.2rem;${isMe ? 'text-align:right' : ''}">
                        ${isMe ? 'Ви' : Fmt.esc(m.user?.full_name || '—')} · ${time}
                    </div>
                    <div style="background:${isMe ? 'linear-gradient(135deg,#C9A227,#FFD700)' : 'var(--bg-raised)'};color:${isMe ? '#0f0c29' : 'var(--text-primary)'};
                        border-radius:${isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px'};
                        padding:.55rem .85rem;font-size:.88rem;line-height:1.5;word-break:break-word;
                        border:1px solid ${isMe ? 'transparent' : 'var(--border)'}">
                        ${Fmt.esc(m.message)}
                    </div>
                    ${AppState.isAdmin() ? `<div style="text-align:${isMe ? 'right' : 'left'};margin-top:.2rem"><button onclick="CompanyBirthdayModal._deleteMsg('${m.id}', this)" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:.65rem;padding:0;transition:color .15s" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color=''" title="Видалити">✕ видалити</button></div>` : ''}
                </div>
            </div>`;
        }).join('');
        list.scrollTop = list.scrollHeight;
    },

    _insertFsEmoji(e) {
        const inp = document.getElementById('cbd-fs-input');
        if (!inp) return;
        const pos = inp.selectionStart || inp.value.length;
        inp.value = inp.value.slice(0, pos) + e + inp.value.slice(pos);
        inp.focus();
        inp.setSelectionRange(pos + e.length, pos + e.length);
    },

    async _sendMsg() {
        const input = document.getElementById('cbd-fs-input');
        const text = input?.value?.trim();
        if (!text) return;
        input.value = '';
        input.disabled = true;
        try { await API.companyBdayMessages.add(text); }
        catch (e) { Toast.error('Помилка', e.message); input.value = text; }
        finally { input.disabled = false; input.focus(); }
    },

    async _deleteMsg(id, btn) {
        try {
            await API.companyBdayMessages.remove(id);
            btn?.closest('[data-msg-id]')?.remove();
        }
        catch (e) { Toast.error('Помилка', e.message); }
    },

    // CompanyBirthdayModal.demo()
    demo() {
        document.getElementById('company-bday-modal')?.remove();
        this._show();
        document.getElementById('cbd-topbar-badge')?.remove();
        document.getElementById('cbd-emoji-rain')?.remove();
        localStorage.removeItem(this._topbarKey());
        setTimeout(() => { this._showTopbarBadge(); this._startEmojiRain(); }, 600);
        const chatEl = document.getElementById('db-bday-chat');
        if (chatEl) this._renderChatCard(chatEl);
    }
};