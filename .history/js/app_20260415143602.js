// ================================================================
// EduFlow LMS — Main App Entry Point
// ================================================================

const App = {
    async boot() {
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

    start() {
        const profile = AppState.profile;
        if (!profile) { Auth._showAuth(); return; }

        // Show app shell
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');

        // Render navigation based on role
        UI.renderNavigation(profile.role);
        UI.renderSidebarUser(profile);

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
            }
        });

        // Start router
        Router.start();

        // Redirect to dashboard if no hash
        if (!location.hash || location.hash === '#' || location.hash === '#/') {
            Router.go('dashboard');
        }
    },

    // ── Results Page (quick inline) ───────────────────────────────
    async renderResults(container) {
        UI.setBreadcrumb([{ label: 'Мои результаты' }]);
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
                        { icon: '📚', label: 'Навчання', value: enrollments.length, color: '#6366F1' },
                        { icon: '✅', label: 'Заваршенно', value: enrollments.filter(e => e.completed_at).length, color: '#10B981' },
                        { icon: '📝', label: 'Спроби тестування', value: attempts.length, color: '#8B5CF6' },
                        { icon: '🏆', label: 'Успіхи', value: attempts.filter(a => a.passed).length, color: '#F59E0B' }
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
                        <div class="card-header"><h3>📚 Навчання</h3></div>
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
                            : '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Вы не записаны на курсы</div>'}
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
                                        <span class="badge ${a.passed ? 'badge-success' : 'badge-danger'}" style="font-size:.65rem">${a.passed ? 'Сдан' : 'Не сдан'}</span>
                                    </div>
                                </div>`).join('')
                            : '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Попыток пока нет</div>'}
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
        const profile = AppState.profile;

        container.innerHTML = `
            <div style="max-width:600px;margin:0 auto">
                <div class="page-header">
                    <div class="page-title"><h1>👤 Мій профіль</h1></div>
                </div>
                <div class="card">
                    <div class="card-body">
                        <div style="display:flex;align-items:center;gap:1.5rem;margin-bottom:2rem">
                            <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-size:1.75rem;font-weight:700;color:#fff;flex-shrink:0">
                                ${Fmt.initials(profile?.full_name)}
                            </div>
                            <div>
                                <h2>${profile?.full_name || 'Користувач'}</h2>
                                <p style="color:var(--text-muted)">${profile?.email}</p>
                                <span class="badge badge-primary">${Fmt.role(profile?.role)}</span>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>ПІБ</label>
                            <input id="prof-name" type="text" value="${profile?.full_name || ''}">
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="email" value="${profile?.email || ''}" readonly style="opacity:.6">
                        </div>
                        <div class="form-group">
                            <label>Про себе</label>
                            <textarea id="prof-bio">${profile?.bio || ''}</textarea>
                        </div>
                        <button class="btn btn-primary" onclick="App.saveProfile()">Зберігти</button>
                    </div>
                </div>
            </div>`;
    },

    async saveProfile() {
        Loader.show();
        try {
            const updated = await API.profiles.update(AppState.user.id, {
                full_name: Dom.val('prof-name').trim(),
                bio:       Dom.val('prof-bio').trim() || null
            });
            AppState.profile = updated;
            UI.renderSidebarUser(updated);
            Toast.success('Профіль оновлено');
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    }
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
