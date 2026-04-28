// ================================================================
// EduFlow LMS — Main App Entry Point
// ================================================================

const App = {
    async boot() {
        SearchSelect.init();

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
<div style="font-family:'Fixel Display', sans-serif;-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; max-width: 900px;margin-left: 5px;">
    
    <!-- Шапка -->
    <div style="margin-bottom: 28px; display: flex; align-items: center; justify-content: space-between;">
        <div>
            <h1 style="margin: 0; font-weight: 590; font-size: 34px; letter-spacing: -0.022em; color: var(--text-primary); line-height: 1.1;">Мій профіль</h1>
            <p style="margin: 4px 0 0; color: var(--text-secondary); font-size: 17px; font-weight: 400; letter-spacing: -0.01em;">Керування особистою інформацією</p>
        </div>
        <button class="btn btn-primary" onclick="App.editProfile()" style="display: flex; align-items: center; gap: 8px; padding: 10px 20px; font-weight: 500; letter-spacing: -0.01em; border-radius: 20px;">
            <span style="font-size: 1.1em;">✎</span> Редагувати
        </button>
    </div>

    <!-- Карточка профиля -->
    <div style="background: var(--bg-surface); border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 0.5px solid rgba(255,255,255,0.06); padding: 36px; margin-bottom: 24px; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);">
        
        <!-- Аватар + основная инфа -->
        <div style="display: flex; align-items: center; gap: 28px; margin-bottom: 36px; padding-bottom: 28px; border-bottom: 0.5px solid rgba(255,255,255,0.06);">
            <div style="position: relative; flex-shrink: 0;">
                <div style="width: 96px; height: 96px; border-radius: 22px; overflow: hidden; background: linear-gradient(135deg, var(--primary), var(--secondary)); display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 500; letter-spacing: -0.5px; color: var(--text-inverse); box-shadow: 0 8px 20px var(--primary-glow); cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); border: none;" onclick="document.getElementById('prof-avatar-input-view').click()" title="Змінити фото">
                    ${profile?.avatar_url
                        ? `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover">`
                        : Fmt.initials(profile?.full_name)}
                </div>
                <div style="position: absolute; bottom: 4px; right: 4px; width: 28px; height: 28px; background: rgba(26,26,46,0.9); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 0.5px solid rgba(255,255,255,0.1); color: var(--text-primary); pointer-events: none; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);">📷</div>
                <input id="prof-avatar-input-view" type="file" accept="image/*" style="display:none" onchange="App.uploadAvatar(this, true)">
            </div>
            <div style="flex: 1;">
                <h2 style="margin: 0 0 8px 0; font-weight: 590; font-size: 32px; letter-spacing: -0.022em; color: var(--text-primary); line-height: 1.1;">${profile?.full_name || 'Користувач'}</h2>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                    <span style="background: rgba(99,102,241,0.12); color: #A5A9FF; padding: 5px 14px; border-radius: 20px; font-size: 14px; font-weight: 500; letter-spacing: -0.01em; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 0.5px solid rgba(99,102,241,0.2);">${Fmt.role(profile?.role)}</span>
                    ${profile?.label ? `<span style="background: rgba(245,158,11,0.1); color: #FBBF24; padding: 5px 14px; border-radius: 20px; font-size: 14px; font-weight: 500; letter-spacing: -0.01em; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 0.5px solid rgba(245,158,11,0.2);">${profile.label}</span>` : ''}
                </div>
                <p style="margin: 0; color: var(--text-secondary); font-size: 17px; font-weight: 400; letter-spacing: -0.01em;">${profile?.email || '—'}</p>
            </div>
        </div>

        <!-- Сетка полей  -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px 40px;">
             ${fieldStyled('👤 Логін', profile?.login)}
            ${fieldStyled('📞 Телефон', profile?.phone)}
            ${fieldStyled('🏙️ Місто', profile?.city)}
            ${fieldStyled('⚥ Стать', genderLabel)}
            ${fieldStyled('💼 Посада', profile?.job_position)}
            ${fieldStyled('📁 Підрозділ', profile?.subdivision)}
            ${fieldStyled('🎂 Дата народження', profile?.birth_date ? Fmt.date(profile.birth_date) : '')}
            ${fieldStyled('👔 Керівник', manager ? `${manager.full_name} ${manager.job_position ? '· ' + manager.job_position : ''}` : '')}
        </div>
    </div>

    <!-- Подчинённые  -->
    ${subordinates.length ? `
    <div style="background: var(--bg-surface); border-radius: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); border: 0.5px solid rgba(255,255,255,0.06); overflow: hidden; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);">
        <div style="padding: 20px 28px; border-bottom: 0.5px solid rgba(255,255,255,0.06);">
            <h3 style="margin: 0; font-weight: 590; font-size: 20px; letter-spacing: -0.015em; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
                <span>Підлеглі</span>
                <span style="background: rgba(255,255,255,0.06); color: var(--text-secondary); padding: 2px 10px; border-radius: 20px; font-size: 14px; font-weight: 500;">${subordinates.length}</span>
            </h3>
        </div>
        <div style="padding: 4px 0;">
            ${subordinates.map(s => `
                <div style="display: flex; align-items: center; gap: 16px; padding: 14px 28px; transition: background 0.2s ease; border-bottom: 0.5px solid rgba(255,255,255,0.04);">
                    <div style="width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1)); display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 500; letter-spacing: -0.3px; color: var(--primary); flex-shrink: 0; overflow: hidden; border: 0.5px solid rgba(99,102,241,0.2);">
                        ${s.avatar_url ? `<img src="${s.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : Fmt.initials(s.full_name)}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; font-size: 16px; letter-spacing: -0.01em; color: var(--text-primary); margin-bottom: 2px;">${s.full_name}</div>
                        <div style="font-size: 14px; font-weight: 400; letter-spacing: -0.01em; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${[s.job_position, s.subdivision].filter(Boolean).join(' · ') || s.email}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>` : ''}
</div>`;


function fieldApple(label, value) {
    const displayValue = value || '<span style="color: var(--text-muted); opacity: 0.4;">—</span>';
    return `
        <div>
            <div style="font-size: 13px; font-weight: 500; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 4px;">${label}</div>
            <div style="font-size: 17px; font-weight: 400; letter-spacing: -0.01em; color: var(--text-primary);">${displayValue}</div>
        </div>
    `;
}    
    },

    async editProfile() {
        const container = document.getElementById('page-content');
        const profile = AppState.profile;

        const [cities, positions, subdivisions, allUsers] = await Promise.all([
            API.directories.getAll('cities').catch(() => []),
            API.directories.getAll('positions').catch(() => []),
            API.directories.getAll('subdivisions').catch(() => []),
            API.profiles.getAll({ pageSize: 500 }).then(r => r.data).catch(() => [])
        ]);

        const opt = (list, val) => list.map(i =>
            `<option value="${i.name}" ${i.name === val ? 'selected' : ''}>${i.name}</option>`).join('');

        container.innerHTML = `
            <div style="max-width:680px;margin-left: 5px">
                <div class="page-header">
                    <div class="page-title"><h1>👤 Редагування профілю</h1></div>
                </div>
                <div class="card">
                    <div class="card-body">
                        <div style="display:flex;align-items:center;gap:1.5rem;margin-bottom:2rem">
                            <div style="position:relative;flex-shrink:0">
                                <div id="prof-avatar-preview" style="width:80px;height:80px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-size:1.75rem;font-weight:700;color:#fff;cursor:pointer" onclick="document.getElementById('prof-avatar-input').click()" title="Змінити фото">
                                    ${profile?.avatar_url
                                        ? `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover">`
                                        : Fmt.initials(profile?.full_name)}
                                </div>
                                <div style="position:absolute;bottom:0;right:0;width:24px;height:24px;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;cursor:pointer;pointer-events:none">📷</div>
                                <input id="prof-avatar-input" type="file" accept="image/*" style="display:none" onchange="App.uploadAvatar(this, false)">
                            </div>
                            <div>
                                <p style="font-size:.8rem;color:var(--text-muted)">Натисніть на фото щоб змінити</p>
                                <span class="badge badge-primary">${Fmt.role(profile?.role)}</span>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>ПІБ</label>
                                <input id="prof-name" type="text" value="${profile?.full_name || ''}">
                            </div>
                            <div class="form-group">
                                <label>Логін</label>
                                <input id="prof-login" type="text" placeholder="ivan_ivanov" value="${profile?.login || ''}">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Телефон</label>
                                <input id="prof-phone" type="tel" placeholder="+380XXXXXXXXX" value="${profile?.phone || ''}">
                            </div>
                            <div class="form-group">
                                <label>Email</label>
                                <input type="email" value="${profile?.email || ''}" readonly style="opacity:.6">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Місто</label>
                                <select id="prof-city">
                                     
                                    ${opt(cities, profile?.city)}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Стать</label>
                                <select id="prof-gender">
                                    
                                    <option value="male"   ${profile?.gender==='male'  ?'selected':''}>Чоловіча</option>
                                    <option value="female" ${profile?.gender==='female'?'selected':''}>Жіноча</option>
                                    
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Посада</label>
                                ${SearchSelect.html('prof-job-position', positions.map(p=>({value:p.name,label:p.name})), profile?.job_position||'')}
                            </div>
                            <div class="form-group">
                                <label>Підрозділ</label>
                                ${SearchSelect.html('prof-subdivision', subdivisions.map(p=>({value:p.name,label:p.name})), profile?.subdivision||'')}
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Дата народження</label>
                                <input id="prof-birthdate" type="date" value="${profile?.birth_date || ''}">
                            </div>
                            <div class="form-group">
                                <label>Мітка</label>
                                <input id="prof-label" type="text" placeholder="Наприклад: Техніка, Золото, Валюта" value="${profile?.label || ''}">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Керівник</label>
                            ${SearchSelect.html('prof-manager',
                                allUsers.filter(u => u.id !== AppState.user.id).map(u=>({value:u.id, label:u.full_name+(u.job_position?' · '+u.job_position:'')})),
                                profile?.manager_id||''
                            )}
                        </div>
                        
                        <div style="display:flex;gap:.75rem">
                            <button class="btn btn-primary" onclick="App.saveProfile()">Зберегти зміни</button>
                            <button class="btn btn-secondary" onclick="App.renderProfile(document.getElementById('page-content'))">Скасувати</button>
                        </div>
                    </div>
                </div>
            </div>`;
    },

    async uploadAvatar(input, reloadView = false) {
        const file = input.files[0];
        if (!file) return;
        Loader.show();
        try {
            const url = await API.profiles.uploadAvatar(file);
            AppState.profile.avatar_url = url;
            const preview = document.getElementById('prof-avatar-preview');
            if (preview) preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover">`;
            UI.renderSidebarUser(AppState.profile);
            Toast.success('Фото оновлено');
            if (reloadView) App.renderProfile(document.getElementById('page-content'));
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    async saveProfile() {
        Loader.show();
        try {
            const updated = await API.profiles.update(AppState.user.id, {
                full_name:    Dom.val('prof-name').trim(),
                login:        Dom.val('prof-login').trim() || null,
                phone:        Dom.val('prof-phone').trim() || null,
                city:         Dom.val('prof-city') || null,
                gender:       Dom.val('prof-gender') || null,
                job_position: Dom.val('prof-job-position') || null,
                subdivision:  Dom.val('prof-subdivision') || null,
                birth_date:   Dom.val('prof-birthdate') || null,
                label:        Dom.val('prof-label').trim() || null,
                bio:          Dom.val('prof-bio').trim() || null,
                manager_id:   Dom.val('prof-manager') || null
            });
            AppState.profile = updated;
            UI.renderSidebarUser(updated);
            Toast.success('Профіль оновлено');
            await App.renderProfile(document.getElementById('page-content'));
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
