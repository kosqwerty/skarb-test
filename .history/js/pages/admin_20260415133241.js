// ================================================================
// EduFlow LMS — Admin Panel
// ================================================================

const AdminPage = {
    _tab: 'users',

    async init(container, params) {
        if (!AppState.isAdmin()) {
            Toast.error('Нет доступа', 'Эта страница только для администраторов');
            Router.go('dashboard');
            return;
        }

        UI.setBreadcrumb([{ label: 'Администрирование' }]);

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">
                    <h1>⚙️ Администрирование</h1>
                    <p>Управление пользователями, курсами и системой</p>
                </div>
            </div>

            <div class="tabs">
                <button class="tab active" onclick="AdminPage.switchTab('users', this)">👥 Пользователи</button>
                <button class="tab" onclick="AdminPage.switchTab('courses', this)">📚 Курсы</button>
                <button class="tab" onclick="AdminPage.switchTab('tests', this)">📝 Тесты</button>
                <button class="tab" onclick="AdminPage.switchTab('news', this)">📰 Новости</button>
                <button class="tab" onclick="AdminPage.switchTab('enrollments', this)">🎓 Записи</button>
            </div>

            <div id="admin-content"></div>`;

        this._tab = params.tab || 'users';
        await this._loadTab();
    },

    async switchTab(tab, el) {
        this._tab = tab;
        document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
        await this._loadTab();
    },

    async _loadTab() {
        const el = document.getElementById('admin-content');
        if (!el) return;
        el.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        switch (this._tab) {
            case 'users':       await this._renderUsers(el);       break;
            case 'courses':     await this._renderCourses(el);     break;
            case 'tests':       await this._renderTests(el);       break;
            case 'news':        await this._renderNews(el);        break;
            case 'enrollments': await this._renderEnrollments(el); break;
        }
    },

    // ── Users ─────────────────────────────────────────────────────
    async _renderUsers(el) {
        const { data: users } = await API.profiles.getAll({ pageSize: 200 });

        el.innerHTML = `
            <div style="display:flex;gap:1rem;margin-bottom:1rem;flex-wrap:wrap">
                <input type="text" id="user-search" placeholder="Поиск..." style="flex:1;min-width:200px"
                       onkeyup="AdminPage._filterTable('users-tbody', event)">
                <select id="role-filter" onchange="AdminPage._renderUsers(document.getElementById('admin-content'))">
                    <option value="">Все роли</option>
                    <option value="admin">Администраторы</option>
                    <option value="teacher">Преподаватели</option>
                    <option value="student">Студенты</option>
                </select>
                <button class="btn btn-primary" onclick="AdminPage.openCreateUser()">+ Создать пользователя</button>
                <button class="btn btn-success" onclick="AdminPage.exportUsers(${JSON.stringify(users).replace(/"/g,'&quot;')})">📊 Экспорт</button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr><th>Имя</th><th>Email</th><th>Роль</th><th>Зарегистрирован</th><th>Статус</th><th>Действия</th></tr>
                    </thead>
                    <tbody id="users-tbody">
                        ${users.map(u => this._userRow(u)).join('')}
                    </tbody>
                </table>
            </div>`;
    },

    _userRow(u) {
        const roleColors = { admin: 'badge-danger', teacher: 'badge-warning', student: 'badge-primary' };
        return `
            <tr id="urow-${u.id}">
                <td>
                    <div style="display:flex;align-items:center;gap:.75rem">
                        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:#fff;flex-shrink:0">
                            ${Fmt.initials(u.full_name)}
                        </div>
                        <div>
                            <div style="font-weight:600;font-size:.875rem">${u.full_name || '—'}</div>
                            ${u.bio ? `<div style="font-size:.75rem;color:var(--text-muted)">${u.bio.slice(0,40)}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td style="color:var(--text-muted)">${u.email}</td>
                <td>
                    <select onchange="AdminPage.changeRole('${u.id}', this.value)" style="background:var(--bg-raised);border:1px solid var(--border);padding:.25rem .5rem;border-radius:var(--radius-sm);font-size:.8rem;color:var(--text-primary)">
                        ${['admin','teacher','student'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${Fmt.role(r)}</option>`).join('')}
                    </select>
                </td>
                <td style="color:var(--text-muted);font-size:.8rem">${Fmt.dateShort(u.created_at)}</td>
                <td>
                    <span class="badge ${u.is_active !== false ? 'badge-success' : 'badge-muted'}">
                        ${u.is_active !== false ? 'Активен' : 'Заблокирован'}
                    </span>
                </td>
                <td>
                    <div style="display:flex;gap:.4rem">
                        <button class="btn btn-ghost btn-sm" onclick="AdminPage.openEditUser(${JSON.stringify(u).replace(/"/g,'&quot;')})">✏️</button>
                        ${u.id !== AppState.user?.id ? `
                            <button class="btn btn-ghost btn-sm" onclick="AdminPage.toggleBlock('${u.id}',${!!u.is_active})" title="${u.is_active ? 'Заблокировать' : 'Разблокировать'}">
                                ${u.is_active !== false ? '🔒' : '🔓'}
                            </button>` : ''}
                    </div>
                </td>
            </tr>`;
    },

    async changeRole(userId, role) {
        try {
            await API.profiles.updateRole(userId, role);
            Toast.success('Роль изменена');
        } catch(e) { Toast.error('Ошибка', e.message); }
    },

    async toggleBlock(userId, isActive) {
        const ok = await Modal.confirm({
            title: isActive ? 'Заблокировать пользователя' : 'Разблокировать',
            message: isActive ? 'Пользователь потеряет доступ к системе.' : 'Восстановить доступ пользователя?',
            confirmText: isActive ? 'Заблокировать' : 'Разблокировать',
            danger: isActive
        });
        if (!ok) return;
        try {
            await API.profiles.update(userId, { is_active: !isActive });
            Toast.success(isActive ? 'Заблокирован' : 'Разблокирован');
            this._renderUsers(document.getElementById('admin-content'));
        } catch(e) { Toast.error('Ошибка', e.message); }
    },

    openCreateUser() {
        Modal.open({
            title: '+ Создать пользователя',
            size: 'md',
            body: `
                <div class="form-group">
                    <label>Полное имя *</label>
                    <input id="cu-name" type="text" placeholder="Иван Иванов">
                </div>
                <div class="form-group">
                    <label>Email *</label>
                    <input id="cu-email" type="email" placeholder="user@example.com">
                </div>
                <div class="form-group">
                    <label>Пароль *</label>
                    <input id="cu-password" type="password" placeholder="Минимум 6 символов">
                </div>
                <div class="form-group">
                    <label>Роль</label>
                    <select id="cu-role">
                        <option value="student">Студент</option>
                        <option value="teacher">Преподаватель</option>
                        <option value="admin">Администратор</option>
                    </select>
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Отмена</button>
                <button class="btn btn-primary" onclick="AdminPage.createUser()">Создать</button>`
        });
    },

    async createUser() {
        const name     = Dom.val('cu-name').trim();
        const email    = Dom.val('cu-email').trim();
        const password = Dom.val('cu-password');
        const role     = Dom.val('cu-role');
        if (!name || !email || !password) { Toast.error('Ошибка', 'Заполните все обязательные поля'); return; }

        Loader.show();
        try {
            // Use supabase admin signup (or regular + profile update)
            const { data, error } = await supabase.auth.signUp({
                email, password,
                options: { data: { full_name: name, role } }
            });
            if (error) throw error;
            // Update role manually if trigger didn't set it
            if (data.user) {
                await new Promise(r => setTimeout(r, 800));
                await supabase.from('profiles').update({ role, full_name: name }).eq('id', data.user.id);
            }
            Toast.success('Пользователь создан');
            Modal.close();
            this._renderUsers(document.getElementById('admin-content'));
        } catch(e) {
            Toast.error('Ошибка', e.message);
        } finally { Loader.hide(); }
    },

    openEditUser(user) {
        Modal.open({
            title: '✏️ Редактировать пользователя',
            size: 'md',
            body: `
                <div class="form-group">
                    <label>Полное имя</label>
                    <input id="eu-name" type="text" value="${user.full_name || ''}">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input id="eu-email" type="text" value="${user.email}" readonly style="opacity:.6">
                </div>
                <div class="form-group">
                    <label>Роль</label>
                    <select id="eu-role">
                        ${['admin','teacher','student'].map(r => `<option value="${r}" ${user.role===r?'selected':''}>${Fmt.role(r)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>О себе</label>
                    <textarea id="eu-bio">${user.bio || ''}</textarea>
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Отмена</button>
                <button class="btn btn-primary" onclick="AdminPage.saveUser('${user.id}')">Сохранить</button>`
        });
    },

    async saveUser(id) {
        Loader.show();
        try {
            await API.profiles.update(id, {
                full_name: Dom.val('eu-name').trim(),
                role:      Dom.val('eu-role'),
                bio:       Dom.val('eu-bio').trim() || null
            });
            Toast.success('Сохранено');
            Modal.close();
            this._renderUsers(document.getElementById('admin-content'));
        } catch(e) {
            Toast.error('Ошибка', e.message);
        } finally { Loader.hide(); }
    },

    exportUsers(users) {
        Excel.export(users.map(u => ({
            'Имя':   u.full_name,
            'Email': u.email,
            'Роль':  Fmt.role(u.role),
            'Дата регистрации': Fmt.datetime(u.created_at)
        })), 'users_export', 'Пользователи');
    },

    // ── Courses ───────────────────────────────────────────────────
    async _renderCourses(el) {
        const { data: courses } = await API.courses.getAll({ pageSize: 200 });

        el.innerHTML = `
            <div style="display:flex;gap:1rem;margin-bottom:1rem">
                <input type="text" placeholder="Поиск..." style="flex:1" onkeyup="AdminPage._filterTable('courses-tbody', event)">
                <button class="btn btn-primary" onclick="CoursesPage.openCreate()">+ Создать курс</button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr><th>Название</th><th>Преподаватель</th><th>Уровень</th><th>Статус</th><th>Создан</th><th>Действия</th></tr>
                    </thead>
                    <tbody id="courses-tbody">
                        ${courses.map(c => `
                            <tr>
                                <td><strong>${c.title}</strong></td>
                                <td style="color:var(--text-muted)">${c.teacher?.full_name || '—'}</td>
                                <td><span class="badge badge-muted">${Fmt.level(c.level)}</span></td>
                                <td><span class="badge ${c.is_published ? 'badge-success' : 'badge-muted'}">${c.is_published ? 'Опубликован' : 'Черновик'}</span></td>
                                <td style="color:var(--text-muted);font-size:.8rem">${Fmt.dateShort(c.created_at)}</td>
                                <td>
                                    <div style="display:flex;gap:.4rem">
                                        <button class="btn btn-ghost btn-sm" onclick="Router.go('courses/${c.id}')">👁</button>
                                        <button class="btn btn-ghost btn-sm" onclick="CoursesPage.openEdit('${c.id}')">✏️</button>
                                        <button class="btn btn-danger btn-sm" onclick="CoursesPage.deleteCourse('${c.id}','${c.title.replace(/'/g,"\\'")}')">🗑</button>
                                    </div>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    },

    // ── Tests ─────────────────────────────────────────────────────
    async _renderTests(el) {
        const tests = await API.tests.getAll().catch(() => []);

        el.innerHTML = `
            <div style="margin-bottom:1rem">
                <input type="text" placeholder="Поиск тестов..." style="width:300px" onkeyup="AdminPage._filterTable('tests-tbody', event)">
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr><th>Название</th><th>Курс</th><th>Попыток</th><th>Порог (%)</th><th>Статус</th><th>Действия</th></tr>
                    </thead>
                    <tbody id="tests-tbody">
                        ${tests.map(t => `
                            <tr>
                                <td><strong>${t.title}</strong></td>
                                <td style="color:var(--text-muted)">${t.course?.title || '—'}</td>
                                <td>${t.max_attempts || '∞'}</td>
                                <td>${t.passing_score}%</td>
                                <td><span class="badge ${t.is_published ? 'badge-success' : 'badge-muted'}">${t.is_published ? 'Опубликован' : 'Черновик'}</span></td>
                                <td>
                                    <div style="display:flex;gap:.4rem">
                                        <button class="btn btn-ghost btn-sm" onclick="TestsPage.openEdit('${t.id}')">✏️</button>
                                        <button class="btn btn-ghost btn-sm" onclick="TestsPage.openQuestionEditor('${t.id}')">❓</button>
                                        <button class="btn btn-danger btn-sm" onclick="TestsPage.deleteTest('${t.id}','${t.title.replace(/'/g,"\\'")}')">🗑</button>
                                    </div>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    },

    // ── News (admin) ───────────────────────────────────────────────
    async _renderNews(el) {
        const { data: news } = await API.news.getAll({ pageSize: 200 });

        el.innerHTML = `
            <div style="display:flex;gap:1rem;margin-bottom:1rem">
                <input type="text" placeholder="Поиск новостей..." style="flex:1" onkeyup="AdminPage._filterTable('news-tbody', event)">
                <button class="btn btn-primary" onclick="NewsPage.openCreate()">+ Создать новость</button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th>Заголовок</th><th>Автор</th><th>Категория</th><th>Статус</th><th>Дата</th><th>Действия</th></tr></thead>
                    <tbody id="news-tbody">
                        ${news.map(n => `
                            <tr>
                                <td><strong>${n.title}</strong></td>
                                <td style="color:var(--text-muted)">${n.author?.full_name || '—'}</td>
                                <td>${n.category || '—'}</td>
                                <td><span class="badge ${n.is_published ? 'badge-success' : 'badge-muted'}">${n.is_published ? 'Опубликовано' : 'Черновик'}</span></td>
                                <td style="color:var(--text-muted);font-size:.8rem">${Fmt.dateShort(n.published_at || n.created_at)}</td>
                                <td>
                                    <div style="display:flex;gap:.4rem">
                                        <button class="btn btn-ghost btn-sm" onclick="Router.go('news/${n.id}')">👁</button>
                                        <button class="btn btn-ghost btn-sm" onclick="NewsPage.openEdit('${n.id}')">✏️</button>
                                        <button class="btn btn-danger btn-sm" onclick="NewsPage.deleteNews('${n.id}','${n.title.replace(/'/g,"\\'")}')">🗑</button>
                                    </div>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    },

    // ── Enrollments ───────────────────────────────────────────────
    async _renderEnrollments(el) {
        const enrollments = await API.enrollments.getAll().catch(() => []);

        el.innerHTML = `
            <div style="display:flex;gap:1rem;margin-bottom:1rem">
                <input type="text" placeholder="Поиск..." style="flex:1" onkeyup="AdminPage._filterTable('enrollments-tbody', event)">
                <button class="btn btn-success" onclick="AdminPage.exportEnrollments(${JSON.stringify(enrollments).replace(/"/g,'&quot;')})">📊 Экспорт</button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th>Студент</th><th>Курс</th><th>Прогресс</th><th>Записан</th><th>Завершил</th></tr></thead>
                    <tbody id="enrollments-tbody">
                        ${enrollments.map(e => `
                            <tr>
                                <td><strong>${e.user?.full_name || '—'}</strong><br><span style="font-size:.75rem;color:var(--text-muted)">${e.user?.email || ''}</span></td>
                                <td>${e.course?.title || '—'}</td>
                                <td>
                                    <div style="display:flex;align-items:center;gap:.5rem;min-width:120px">
                                        <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${e.progress_percentage||0}%"></div></div>
                                        <span style="font-size:.75rem">${e.progress_percentage||0}%</span>
                                    </div>
                                </td>
                                <td style="color:var(--text-muted);font-size:.8rem">${Fmt.datetime(e.enrolled_at)}</td>
                                <td>${e.completed_at ? `<span class="badge badge-success">✓ ${Fmt.dateShort(e.completed_at)}</span>` : '—'}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    },

    exportEnrollments(enrollments) {
        Excel.export(enrollments.map(e => ({
            'Студент':  e.user?.full_name,
            'Email':    e.user?.email,
            'Курс':     e.course?.title,
            'Прогресс': (e.progress_percentage||0) + '%',
            'Записан':  Fmt.datetime(e.enrolled_at),
            'Завершил': e.completed_at ? Fmt.datetime(e.completed_at) : 'Нет'
        })), 'enrollments_export', 'Записи');
    },

    // ── Utility ───────────────────────────────────────────────────
    _filterTable(tbodyId, event) {
        const q    = event.target.value.toLowerCase();
        const rows = document.querySelectorAll(`#${tbodyId} tr`);
        rows.forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    }
};
