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

        // Render navigation based on role
        UI.renderNavigation(profile.role);
        UI.renderSidebarUser(profile);

        // Load unread counts after sidebar is in DOM
        UI.loadNotificationCount();
        UI.loadDocBadge();

        // Load bookmarks async (updates nav stars when done)
        Bookmarks.load();

        // День народження — показуємо при вході
        BirthdayModal.check(profile);
        // Річниця в компанії — показуємо раз на рік
        AnniversaryModal.check(profile);

        // Define routes
        Router.define({
            'dashboard': async ({ container }) => {
                await DashboardPage.init(container);
            },

            'courses/:id': async ({ container, params }) => {
                await CourseViewPage.init(container, params);
            },

            'lessons/:id': async ({ container, params }) => {
                await LessonViewPage.init(container, params);
            },

            'tests/:id': async ({ container, params }) => {
                await TestsPage.init(container, params);
            },

            'analytics': async ({ container, params }) => {
                await AnalyticsPage.init(container, params);
                return () => AnalyticsPage.destroy?.();
            },

            'admin': async ({ container, params }) => {
                await AdminPage.init(container, params);
            },

            'resources': async ({ container, params }) => {
                Router.go('knowledge-base');
            },

            'knowledge-base': async ({ container, params }) => {
                await ResourcesPage.init(container, { view: 'kb' });
            },

            'documents': async ({ container, params }) => {
                await ResourcesPage.init(container, { view: 'docs', tab: params.tab || '', cat: params.cat || '' });
            },

            'branch-docs': async ({ container }) => {
                await BranchDocsPage.init(container);
            },

            'collections': async ({ container }) => {
                await CollectionsPage.init(container);
            },

            'collections/:id': async ({ container, params }) => {
                await CollectionsPage.initView(container, params);
            },

            'resource/:id': async ({ container, params }) => {
                await ResourceViewPage.init(container, params);
            },

            'news': async ({ container, params }) => {
                await NewsPage.init(container, params);
            },

            'news/:id': async ({ container, params }) => {
                await NewsPage.init(container, params);
            },

            'results': async ({ container }) => {
                await App.renderResults(container);
            },

            'profile': async ({ container }) => {
                await App.renderProfile(container);
            },

            'scheduler': async ({ container, params }) => {
                await SchedulerPage.init(container, params);
            },

            'notifications': async ({ container }) => {
                NotificationsPage.destroy?.();
                await NotificationsPage.init(container);
                return () => NotificationsPage.destroy?.();
            },

            'contacts': async ({ container }) => {
                await ContactsPage.init(container);
            },

            'bookmarks': async ({ container }) => {
                await BookmarksPage.init(container);
            },


            'schedule-graph': async ({ container, params }) => {
                if (params?.view === 'employee') await ScheduleGraphEmployee.init(container);
                else await ScheduleGraphPage.init(container);
            },

            'schedule-view': async ({ container }) => {
                await ScheduleViewPage.init(container);
            },

            'my-calendar': async ({ container, params }) => {
                await MyCalendarPage.init(container, params);
            },

            'tests-manager': async () => {
                Router.go('admin?tab=tests');
            },

            'my-tests': async ({ container }) => {
                await MyTestsPage.init(container);
            },

            'expert-path': async ({ container }) => {
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
        setTimeout(() => MyCalendarPage.showTodayReminder(), 300);
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
            <div style="position:absolute;inset:-30px;pointer-events:none">${stars}</div>
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