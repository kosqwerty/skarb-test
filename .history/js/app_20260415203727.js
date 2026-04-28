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
<div style="max-width: 900px; margin: 0 auto; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;">
    
    <!-- Шапка с приветствием (более минималистичная) -->
    <div style="margin-bottom: 24px; display: flex; align-items: baseline; justify-content: space-between;">
        <div>
            <h1 style="margin: 0; font-weight: 600; font-size: 1.8rem; letter-spacing: -0.01em; color: #1e293b;">Мій профіль</h1>
            <p style="margin: 4px 0 0; color: #64748b; font-size: 0.9rem;">Керування особистою інформацією та перегляд даних облікового запису</p>
        </div>
        <button class="btn btn-primary" onclick="App.editProfile()" style="display: flex; align-items: center; gap: 8px; padding: 10px 20px;">
            <span style="font-size: 1.1em;">✎</span> Редагувати профіль
        </button>
    </div>

    <!-- Основная карточка профиля -->
    <div style="background: #ffffff; border-radius: 24px; box-shadow: 0 8px 20px rgba(0,0,0,0.02), 0 2px 6px rgba(0,0,0,0.05); border: 1px solid rgba(226, 232, 240, 0.6); padding: 32px; margin-bottom: 24px;">
        
        <!-- Блок с аватаром и базовой инфой -->
        <div style="display: flex; align-items: center; gap: 28px; margin-bottom: 32px; padding-bottom: 28px; border-bottom: 1px solid #f1f5f9;">
            <div style="position: relative; flex-shrink: 0;">
                <div style="width: 96px; height: 96px; border-radius: 30px; overflow: hidden; background: linear-gradient(145deg, #3b82f6, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 2.2rem; font-weight: 600; color: white; box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.2); cursor: pointer; transition: transform 0.2s ease; border: 3px solid white;" onclick="document.getElementById('prof-avatar-input-view').click()" title="Змінити фото">
                    ${profile?.avatar_url
                        ? `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover">`
                        : Fmt.initials(profile?.full_name)}
                </div>
                <div style="position: absolute; bottom: 2px; right: 2px; width: 28px; height: 28px; background: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; color: #475569; pointer-events: none;">📷</div>
                <input id="prof-avatar-input-view" type="file" accept="image/*" style="display:none" onchange="App.uploadAvatar(this, true)">
            </div>
            <div style="flex: 1;">
                <h2 style="margin: 0 0 6px 0; font-weight: 700; font-size: 1.75rem; color: #0f172a; line-height: 1.2;">${profile?.full_name || 'Користувач'}</h2>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                    <span style="background: #eef2ff; color: #4f46e5; padding: 4px 12px; border-radius: 40px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.01em;">${Fmt.role(profile?.role)}</span>
                    ${profile?.label ? `<span style="background: #fff7ed; color: #ea580c; padding: 4px 12px; border-radius: 40px; font-size: 0.8rem; font-weight: 600;">${profile.label}</span>` : ''}
                </div>
                <p style="margin: 0; color: #64748b; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                    <span style="opacity: 0.6;">✉️</span> ${profile?.email || '—'}
                </p>
            </div>
        </div>

        <!-- Детальная информация (сетка) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px 32px;">
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

    <!-- Блок подчинённых (если есть) -->
    ${subordinates.length ? `
    <div style="background: #ffffff; border-radius: 24px; box-shadow: 0 8px 20px rgba(0,0,0,0.02), 0 2px 6px rgba(0,0,0,0.05); border: 1px solid rgba(226, 232, 240, 0.6); overflow: hidden;">
        <div style="padding: 20px 28px; border-bottom: 1px solid #f1f5f9;">
            <h3 style="margin: 0; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px;">
                <span>👥 Підлеглі</span>
                <span style="background: #e2e8f0; color: #334155; padding: 2px 10px; border-radius: 20px; font-size: 0.8rem;">${subordinates.length}</span>
            </h3>
        </div>
        <div style="padding: 8px 0;">
            ${subordinates.map(s => `
                <div style="display: flex; align-items: center; gap: 16px; padding: 12px 28px; transition: background 0.15s; border-bottom: 1px solid #f8fafc;">
                    <div style="width: 44px; height: 44px; border-radius: 16px; background: linear-gradient(145deg, #f8fafc, #eef2ff); display: flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: 600; color: #4f46e5; flex-shrink: 0; overflow: hidden; border: 1px solid white;">
                        ${s.avatar_url ? `<img src="${s.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : Fmt.initials(s.full_name)}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; color: #0f172a; margin-bottom: 2px;">${s.full_name}</div>
                        <div style="font-size: 0.8rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${[s.job_position, s.subdivision].filter(Boolean).join(' · ') || s.email}</div>
                    </div>
                    <div style="opacity: 0.4; color: #94a3b8;">→</div>
                </div>
            `).join('')}
        </div>
    </div>` : ''}
</div>`;

// Вспомогательная функция для красивых полей (чтобы не дублировать стили в шаблоне)
function fieldStyled(label, value) {
    const displayValue = value || '<span style="color: #cbd5e1;">—</span>';
    return `
        <div style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: #94a3b8;">${label}</span>
            <span style="font-size: 1rem; color: #1e293b; font-weight: 500; word-break: break-word;">${displayValue}</span>
        </div>
    `;
}

        // container.innerHTML = `
        //     <div style="max-width:880px;">
        //         <div class="page-header">
        //             <div class="page-title"><h1>👤 Мій профіль</h1></div>
                    
        //         </div>
        //         <div class="card">
        //             <div class="card-body">
        //                 <div style="display:flex;align-items:center;gap:1.5rem;margin-bottom:2rem">
        //                     <div style="position:relative;flex-shrink:0">
        //                         <div style="width:80px;height:80px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-size:1.75rem;font-weight:700;color:#fff;cursor:pointer" onclick="document.getElementById('prof-avatar-input-view').click()" title="Змінити фото">
        //                             ${profile?.avatar_url
        //                                 ? `<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover">`
        //                                 : Fmt.initials(profile?.full_name)}
        //                         </div>
        //                         <div style="position:absolute;bottom:0;right:0;width:24px;height:24px;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;cursor:pointer;pointer-events:none">📷</div>
        //                         <input id="prof-avatar-input-view" type="file" accept="image/*" style="display:none" onchange="App.uploadAvatar(this, true)">
        //                     </div>
        //                     <div>
        //                         <h2 style="margin-bottom:.3rem">${profile?.full_name || 'Користувач'}</h2>
        //                         <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.4rem">
        //                             <span class="badge badge-primary">${Fmt.role(profile?.role)}</span>
        //                             ${profile?.label ? `<span class="badge badge-warning">${profile.label}</span>` : ''}
        //                         </div>
        //                         <p style="color:var(--text-muted);font-size:.875rem">${profile?.email || ''}</p>
        //                     </div>
        //                 </div>
                        
        //                 <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem">
        //                     ${field('Логін',           profile?.login)}
        //                     ${field('Телефон',         profile?.phone)}
        //                     ${field('Місто',           profile?.city)}
        //                     ${field('Стать',           genderLabel)}
        //                     ${field('Посада',          profile?.job_position)}
        //                     ${field('Підрозділ',       profile?.subdivision)}
        //                     ${field('Дата народження', profile?.birth_date ? Fmt.date(profile.birth_date) : '')}
        //                     ${field('Керівник',        manager ? manager.full_name + (manager.job_position ? ' · ' + manager.job_position : '') : '')}
        //                 </div>

                        
        //             </div>
        //             <div style="margin: auto 0;">
        //             <button class="btn btn-primary" onclick="App.editProfile()">✏️ Редагувати</button>
        //             </div>
        //         </div>

        //         ${subordinates.length ? `
        //         <div class="card" style="margin-top:1.5rem">
        //             <div class="card-header"><h3>👥 Підлеглі (${subordinates.length})</h3></div>
        //             <div class="card-body" style="padding:0">
        //                 ${subordinates.map(s => `
        //                     <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1.25rem;border-bottom:1px solid var(--border)">
        //                         <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden">
        //                             ${s.avatar_url ? `<img src="${s.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : Fmt.initials(s.full_name)}
        //                         </div>
        //                         <div style="flex:1;min-width:0">
        //                             <div style="font-weight:500;font-size:.875rem">${s.full_name}</div>
        //                             <div style="font-size:.75rem;color:var(--text-muted)">${[s.job_position, s.subdivision].filter(Boolean).join(' · ') || s.email}</div>
        //                         </div>
        //                     </div>`).join('')}
        //             </div>
        //         </div>` : ''}
        //     </div>`;
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
            <div style="max-width:680px;margin:0 auto">
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
