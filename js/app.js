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
        if (collapsed) document.getElementById('sidebar')?.classList.add('collapsed');

        // Initialize auth
        const loggedIn = await Auth.init();

        // Hide loading overlay
        document.getElementById('loading-overlay').style.display = 'none';

        if (loggedIn) {
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

        // Load unread notification count
        UI.loadNotificationCount();

        // Start scheduler background ticker (owner/admin/manager only)
        if (AppState.canSchedule()) SchedulerPage.startTimer();

        // Load restrictions before rendering nav (safe — never throws)
        try { await AccessRestrictions.load(); } catch { /* table may not exist yet */ }

        // Render navigation based on role
        UI.renderNavigation(profile.role);
        UI.renderSidebarUser(profile);

        // Load bookmarks async (updates nav stars when done)
        Bookmarks.load();

        // Define routes
        Router.define({
            'dashboard': async ({ container }) => {
                await DashboardPage.init(container);
            },

            'courses': async ({ container, params }) => {
                await CoursesPage.init(container, params);
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
                await ResourcesPage.init(container, { view: 'admin' });
            },

            'knowledge-base': async ({ container, params }) => {
                await ResourcesPage.init(container, { view: 'kb' });
            },

            'documents': async ({ container }) => {
                await ResourcesPage.init(container, { view: 'docs' });
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

            'label-access': async ({ container }) => {
                await LabelAccessPage.init(container);
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
            }
        });

        // Start router
        Router.start();

        // Redirect to dashboard if no hash
        if (!location.hash || location.hash === '#' || location.hash === '#/') {
            Router.go('dashboard');
        }

        // Show personal calendar reminder after initial page renders
        setTimeout(() => typeof MyCalendarPage !== 'undefined' && MyCalendarPage.showTodayReminder(), 800);
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
                    ${profile?.label ? `<span style="background: rgba(245, 158, 11, 0.15); color: var(--warning); padding: 4px 12px; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 600; border: 1px solid rgba(245, 158, 11, 0.2);">${profile.label}</span>` : ''}
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
            ${fieldStyled('👔 Керівник', manager ? `${manager.full_name} ${manager.job_position ? '· ' + manager.job_position : ''}` : '')}
            ${fieldStyled('📅 В компанії з', profile?.hired_at ? Fmt.date(profile.hired_at) : '')}
            ${fieldStyled('🗓️ На посаді з', profile?.position_since ? Fmt.date(profile.position_since) : '')}
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