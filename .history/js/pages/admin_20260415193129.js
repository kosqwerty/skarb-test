// ================================================================
// EduFlow LMS — Панель адміністратора
// ================================================================

const AdminPage = {
    _tab: 'users',

    async init(container, params) {
        if (!AppState.isAdmin()) {
            Toast.error('Заборонено', 'Ця сторінка тільки для адміністратора');
            Router.go('dashboard');
            return;
        }

        UI.setBreadcrumb([{ label: 'Адміністрування' }]);

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">
                    <h1>⚙️ Адміністрування</h1>
                    <p>Керування системою</p>
                </div>
            </div>

            <div class="tabs">
                <button class="tab active" onclick="AdminPage.switchTab('users', this)">👥 Користувачі</button>
                <button class="tab" onclick="AdminPage.switchTab('courses', this)">📚 Курси</button>
                <button class="tab" onclick="AdminPage.switchTab('tests', this)">📝 Тести</button>
                <button class="tab" onclick="AdminPage.switchTab('news', this)">📰 Новини</button>
                <button class="tab" onclick="AdminPage.switchTab('enrollments', this)">🎓 Записи</button>
                <button class="tab" onclick="AdminPage.switchTab('directories', this)">📋 Довідники</button>
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

        try {
            switch (this._tab) {
                case 'users':       await this._renderUsers(el);       break;
                case 'courses':     await this._renderCourses(el);     break;
                case 'tests':       await this._renderTests(el);       break;
                case 'news':        await this._renderNews(el);        break;
                case 'enrollments': await this._renderEnrollments(el); break;
                case 'directories': await this._renderDirectories(el); break;
            }
        } catch(e) {
            el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
        }
    },

    // ── Користувачі ───────────────────────────────────────────────
    async _renderUsers(el) {
        const { data: users } = await API.profiles.getAll({ pageSize: 200 });

        el.innerHTML = `
            <div style="display:flex;gap:1rem;margin-bottom:1rem;flex-wrap:wrap">
                <input type="text" id="user-search" placeholder="Пошук..." style="flex:1;min-width:200px"
                       onkeyup="AdminPage._filterTable('users-tbody', event)">
                <select id="role-filter" onchange="AdminPage._renderUsers(document.getElementById('admin-content'))">
                    <option value="">Усі ролі</option>
                    <option value="admin">Адміністратори</option>
                    <option value="teacher">Викладачі</option>
                    <option value="student">Студенти</option>
                </select>
                <button class="btn btn-primary" onclick="AdminPage.openCreateUser()">+ Створити користувача</button>
                <button class="btn btn-success" onclick="AdminPage.exportUsers(${JSON.stringify(users).replace(/"/g,'&quot;')})">📊 Експорт</button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>ПІБ</th><th>Email</th><th>Посада / Підрозділ</th>
                            <th>Роль</th><th>Зареєстрований</th><th>Статус</th><th>Дія</th>
                        </tr>
                    </thead>
                    <tbody id="users-tbody">
                        ${users.map(u => this._userRow(u)).join('')}
                    </tbody>
                </table>
            </div>`;
    },

    _userRow(u) {
        return `
            <tr id="urow-${u.id}">
                <td>
                    <div style="display:flex;align-items:center;gap:.75rem">
                        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:#fff;flex-shrink:0">
                            ${Fmt.initials(u.full_name)}
                        </div>
                        <div>
                            <div style="font-weight:600;font-size:.875rem">${u.full_name || '—'}</div>
                            ${u.label ? `<span class="badge badge-warning" style="font-size:.65rem">${u.label}</span>` : ''}
                        </div>
                    </div>
                </td>
                <td style="color:var(--text-muted)">${u.email}</td>
                <td style="font-size:.8rem">
                    ${u.job_position ? `<div>${u.job_position}</div>` : ''}
                    ${u.subdivision ? `<div style="color:var(--text-muted)">${u.subdivision}</div>` : ''}
                    ${u.city ? `<div style="color:var(--text-muted)">📍 ${u.city}</div>` : ''}
                </td>
                <td>
                    <select onchange="AdminPage.changeRole('${u.id}', this.value)" style="background:var(--bg-raised);border:1px solid var(--border);padding:.25rem .5rem;border-radius:var(--radius-sm);font-size:.8rem;color:var(--text-primary)">
                        ${['admin','teacher','student'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${Fmt.role(r)}</option>`).join('')}
                    </select>
                </td>
                <td style="color:var(--text-muted);font-size:.8rem">${Fmt.dateShort(u.created_at)}</td>
                <td>
                    <span class="badge ${u.is_active !== false ? 'badge-success' : 'badge-muted'}">
                        ${u.is_active !== false ? 'Активний' : 'Заблокований'}
                    </span>
                </td>
                <td>
                    <div style="display:flex;gap:.4rem">
                        <button class="btn btn-ghost btn-sm" onclick="AdminPage.openEditUser(${JSON.stringify(u).replace(/"/g,'&quot;')})">✏️</button>
                        ${u.id !== AppState.user?.id ? `
                            <button class="btn btn-ghost btn-sm" onclick="AdminPage.toggleBlock('${u.id}',${!!u.is_active})" title="${u.is_active ? 'Заблокувати' : 'Розблокувати'}">
                                ${u.is_active !== false ? '🔒' : '🔓'}
                            </button>` : ''}
                    </div>
                </td>
            </tr>`;
    },

    async changeRole(userId, role) {
        try {
            await API.profiles.updateRole(userId, role);
            Toast.success('Роль змінено');
        } catch(e) { Toast.error('Помилка', e.message); }
    },

    async toggleBlock(userId, isActive) {
        const ok = await Modal.confirm({
            title: isActive ? 'Заблокувати користувача' : 'Розблокувати',
            message: isActive ? 'Користувач втратить доступ до системи.' : 'Відновити доступ користувача?',
            confirmText: isActive ? 'Заблокувати' : 'Розблокувати',
            danger: isActive
        });
        if (!ok) return;
        try {
            await API.profiles.update(userId, { is_active: !isActive });
            Toast.success(isActive ? 'Заблоковано' : 'Розблоковано');
            this._renderUsers(document.getElementById('admin-content'));
        } catch(e) { Toast.error('Помилка', e.message); }
    },

    async _loadRefData() {
        const [cities, positions, subdivisions] = await Promise.all([
            API.directories.getAll('cities').catch(() => []),
            API.directories.getAll('positions').catch(() => []),
            API.directories.getAll('subdivisions').catch(() => [])
        ]);
        return { cities, positions, subdivisions };
    },

    _refSelect(id, label, list, val) {
        return `
            <div class="form-group">
                <label>${label}</label>
                <select id="${id}">
                    <option value="">— не вказано —</option>
                    ${list.map(i => `<option value="${i.name}" ${i.name === val ? 'selected' : ''}>${i.name}</option>`).join('')}
                </select>
            </div>`;
    },

    async openCreateUser() {
        const { cities, positions, subdivisions } = await this._loadRefData();
        Modal.open({
            title: '+ Створити користувача',
            size: 'lg',
            body: `
                <div class="form-row">
                    <div class="form-group">
                        <label>ПІБ *</label>
                        <input id="cu-name" type="text" placeholder="Іван Іваненко">
                    </div>
                    <div class="form-group">
                        <label>Email *</label>
                        <input id="cu-email" type="email" placeholder="user@example.com">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Пароль *</label>
                        <input id="cu-password" type="password" placeholder="Мінімум 6 символів">
                    </div>
                    <div class="form-group">
                        <label>Роль</label>
                        <select id="cu-role">
                            <option value="student">Студент</option>
                            <option value="teacher">Викладач</option>
                            <option value="admin">Адміністратор</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    ${this._refSelect('cu-city', 'Місто', cities, '')}
                    <div class="form-group">
                        <label>Стать</label>
                        <select id="cu-gender">
                            <option value="">— не вказано —</option>
                            <option value="male">Чоловіча</option>
                            <option value="female">Жіноча</option>
                            <option value="other">Інша</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    ${this._refSelect('cu-job-position', 'Посада', positions, '')}
                    ${this._refSelect('cu-subdivision', 'Підрозділ', subdivisions, '')}
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Телефон</label>
                        <input id="cu-phone" type="tel" placeholder="+380XXXXXXXXX">
                    </div>
                    <div class="form-group">
                        <label>Дата народження</label>
                        <input id="cu-birthdate" type="date">
                    </div>
                </div>
                <div class="form-group">
                    <label>Мітка</label>
                    <input id="cu-label" type="text" placeholder="Наприклад: VIP, стажер...">
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="AdminPage.createUser()">Створити</button>`
        });
    },

    async createUser() {
        const name     = Dom.val('cu-name').trim();
        const email    = Dom.val('cu-email').trim();
        const password = Dom.val('cu-password');
        const role     = Dom.val('cu-role');
        if (!name || !email || !password) { Toast.error('Помилка', 'Заповніть усі обовʼязкові поля'); return; }

        Loader.show();
        try {
            const { data, error } = await supabase.auth.signUp({
                email, password,
                options: { data: { full_name: name, role } }
            });
            if (error) throw error;
            if (data.user) {
                await new Promise(r => setTimeout(r, 800));
                await supabase.from('profiles').update({
                    role,
                    full_name:   name,
                    city:        Dom.val('cu-city') || null,
                    gender:      Dom.val('cu-gender') || null,
                    job_position: Dom.val('cu-job-position') || null,
                    subdivision: Dom.val('cu-subdivision') || null,
                    phone:       Dom.val('cu-phone').trim() || null,
                    birth_date:  Dom.val('cu-birthdate') || null,
                    label:       Dom.val('cu-label').trim() || null
                }).eq('id', data.user.id);
            }
            Toast.success('Користувача створено');
            Modal.close();
            this._renderUsers(document.getElementById('admin-content'));
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    async openEditUser(user) {
        const { cities, positions, subdivisions } = await this._loadRefData();
        Modal.open({
            title: '✏️ Редагувати користувача',
            size: 'lg',
            body: `
                <div class="form-row">
                    <div class="form-group">
                        <label>ПІБ</label>
                        <input id="eu-name" type="text" value="${user.full_name || ''}">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input id="eu-email" type="text" value="${user.email}" readonly style="opacity:.6">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Роль</label>
                        <select id="eu-role">
                            ${['admin','teacher','student'].map(r => `<option value="${r}" ${user.role===r?'selected':''}>${Fmt.role(r)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Стать</label>
                        <select id="eu-gender">
                            <option value="">— не вказано —</option>
                            <option value="male"   ${user.gender==='male'  ?'selected':''}>Чоловіча</option>
                            <option value="female" ${user.gender==='female'?'selected':''}>Жіноча</option>
                            <option value="other"  ${user.gender==='other' ?'selected':''}>Інша</option>
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    ${this._refSelect('eu-city', 'Місто', cities, user.city)}
                    <div class="form-group">
                        <label>Телефон</label>
                        <input id="eu-phone" type="tel" value="${user.phone || ''}">
                    </div>
                </div>
                <div class="form-row">
                    ${this._refSelect('eu-job-position', 'Посада', positions, user.job_position)}
                    ${this._refSelect('eu-subdivision', 'Підрозділ', subdivisions, user.subdivision)}
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Дата народження</label>
                        <input id="eu-birthdate" type="date" value="${user.birth_date || ''}">
                    </div>
                    <div class="form-group">
                        <label>Мітка</label>
                        <input id="eu-label" type="text" value="${user.label || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Про себе</label>
                    <textarea id="eu-bio">${user.bio || ''}</textarea>
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="AdminPage.saveUser('${user.id}')">Зберегти</button>`
        });
    },

    async saveUser(id) {
        Loader.show();
        try {
            await API.profiles.update(id, {
                full_name:   Dom.val('eu-name').trim(),
                role:        Dom.val('eu-role'),
                gender:      Dom.val('eu-gender') || null,
                city:        Dom.val('eu-city') || null,
                phone:       Dom.val('eu-phone').trim() || null,
                job_position: Dom.val('eu-job-position') || null,
                subdivision: Dom.val('eu-subdivision') || null,
                birth_date:  Dom.val('eu-birthdate') || null,
                label:       Dom.val('eu-label').trim() || null,
                bio:         Dom.val('eu-bio').trim() || null
            });
            Toast.success('Збережено');
            Modal.close();
            this._renderUsers(document.getElementById('admin-content'));
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    exportUsers(users) {
        Excel.export(users.map(u => ({
            'ПІБ':              u.full_name,
            'Email':            u.email,
            'Роль':             Fmt.role(u.role),
            'Посада':           u.job_position || '',
            'Підрозділ':        u.subdivision || '',
            'Місто':            u.city || '',
            'Телефон':          u.phone || '',
            'Дата народження':  u.birth_date || '',
            'Мітка':            u.label || '',
            'Дата реєстрації':  Fmt.datetime(u.created_at)
        })), 'users_export', 'Користувачі');
    },

    // ── Курси ─────────────────────────────────────────────────────
    async _renderCourses(el) {
        const { data: courses } = await API.courses.getAll({ pageSize: 200 });

        el.innerHTML = `
            <div style="display:flex;gap:1rem;margin-bottom:1rem">
                <input type="text" placeholder="Пошук..." style="flex:1" onkeyup="AdminPage._filterTable('courses-tbody', event)">
                <button class="btn btn-primary" onclick="CoursesPage.openCreate()">+ Створити курс</button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr><th>Назва</th><th>Викладач</th><th>Рівень</th><th>Статус</th><th>Створено</th><th>Дії</th></tr>
                    </thead>
                    <tbody id="courses-tbody">
                        ${courses.map(c => `
                            <tr>
                                <td><strong>${c.title}</strong></td>
                                <td style="color:var(--text-muted)">${c.teacher?.full_name || '—'}</td>
                                <td><span class="badge badge-muted">${Fmt.level(c.level)}</span></td>
                                <td><span class="badge ${c.is_published ? 'badge-success' : 'badge-muted'}">${c.is_published ? 'Опубліковано' : 'Чернетка'}</span></td>
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

    // ── Тести ─────────────────────────────────────────────────────
    async _renderTests(el) {
        const tests = await API.tests.getAll().catch(() => []);

        el.innerHTML = `
            <div style="margin-bottom:1rem">
                <input type="text" placeholder="Пошук тестів..." style="width:300px" onkeyup="AdminPage._filterTable('tests-tbody', event)">
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr><th>Назва</th><th>Курс</th><th>Спроб</th><th>Поріг (%)</th><th>Статус</th><th>Дії</th></tr>
                    </thead>
                    <tbody id="tests-tbody">
                        ${tests.map(t => `
                            <tr>
                                <td><strong>${t.title}</strong></td>
                                <td style="color:var(--text-muted)">${t.course?.title || '—'}</td>
                                <td>${t.max_attempts || '∞'}</td>
                                <td>${t.passing_score}%</td>
                                <td><span class="badge ${t.is_published ? 'badge-success' : 'badge-muted'}">${t.is_published ? 'Опубліковано' : 'Чернетка'}</span></td>
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

    // ── Новини (адмін) ────────────────────────────────────────────
    async _renderNews(el) {
        const { data: news } = await API.news.getAll({ pageSize: 200 });

        el.innerHTML = `
            <div style="display:flex;gap:1rem;margin-bottom:1rem">
                <input type="text" placeholder="Пошук новин..." style="flex:1" onkeyup="AdminPage._filterTable('news-tbody', event)">
                <button class="btn btn-primary" onclick="NewsPage.openCreate()">+ Створити новину</button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th>Заголовок</th><th>Автор</th><th>Категорія</th><th>Статус</th><th>Дата</th><th>Дії</th></tr></thead>
                    <tbody id="news-tbody">
                        ${news.map(n => `
                            <tr>
                                <td><strong>${n.title}</strong></td>
                                <td style="color:var(--text-muted)">${n.author?.full_name || '—'}</td>
                                <td>${n.category || '—'}</td>
                                <td><span class="badge ${n.is_published ? 'badge-success' : 'badge-muted'}">${n.is_published ? 'Опубліковано' : 'Чернетка'}</span></td>
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

    // ── Записи ────────────────────────────────────────────────────
    async _renderEnrollments(el) {
        const enrollments = await API.enrollments.getAll().catch(() => []);

        el.innerHTML = `
            <div style="display:flex;gap:1rem;margin-bottom:1rem">
                <input type="text" placeholder="Пошук..." style="flex:1" onkeyup="AdminPage._filterTable('enrollments-tbody', event)">
                <button class="btn btn-success" onclick="AdminPage.exportEnrollments(${JSON.stringify(enrollments).replace(/"/g,'&quot;')})">📊 Експорт</button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead><tr><th>Студент</th><th>Курс</th><th>Прогрес</th><th>Записаний</th><th>Завершив</th></tr></thead>
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
            'Прогрес':  (e.progress_percentage||0) + '%',
            'Записаний':  Fmt.datetime(e.enrolled_at),
            'Завершив': e.completed_at ? Fmt.datetime(e.completed_at) : 'Ні'
        })), 'enrollments_export', 'Записи');
    },

    // ── Довідники ─────────────────────────────────────────────────
    async _renderDirectories(el) {
        const [cities, positions, subdivisions] = await Promise.all([
            API.directories.getAll('cities').catch(() => null),
            API.directories.getAll('job_positions').catch(() => null),
            API.directories.getAll('subdivisions').catch(() => null)
        ]);

        if (cities === null || positions === null || subdivisions === null) {
            el.innerHTML = `
                <div class="empty-state" style="padding:3rem">
                    <div class="empty-icon">⚠️</div>
                    <h3>Таблиці довідників не знайдено</h3>
                    <p style="color:var(--text-muted)">Виконайте SQL-міграцію в Supabase SQL Editor</p>
                    <code style="display:block;background:var(--bg-raised);padding:1rem;border-radius:var(--radius);margin-top:1rem;font-size:.8rem;text-align:left">
                        Відкрийте файл <strong>sql/migration_v2.sql</strong> і виконайте його вміст у Supabase → SQL Editor
                    </code>
                </div>`;
            return;
        }

        el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;margin-top:1rem">
                ${this._dirCard('Міста', '🏙️', 'cities', cities)}
                ${this._dirCard('Посади', '💼', 'job_positions', positions)}
                ${this._dirCard('Підрозділи', '🏢', 'subdivisions', subdivisions)}
            </div>`;
    },

    _dirCard(title, icon, table, items) {
        return `
            <div class="card">
                <div class="card-header">
                    <h3>${icon} ${title}</h3>
                    <button class="btn btn-primary btn-sm" onclick="AdminPage.openAddDir('${table}','${title}')">+ Додати</button>
                </div>
                <div class="card-body" style="padding:0;max-height:350px;overflow-y:auto">
                    ${items.length ? items.map(i => `
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:.625rem 1rem;border-bottom:1px solid var(--border)">
                            <span style="font-size:.875rem">${i.name}</span>
                            <div style="display:flex;gap:.3rem">
                                <button class="btn btn-ghost btn-sm" onclick="AdminPage.openEditDir('${table}','${i.id}','${i.name.replace(/'/g,"\\'")}')">✏️</button>
                                <button class="btn btn-danger btn-sm" onclick="AdminPage.deleteDir('${table}','${i.id}','${i.name.replace(/'/g,"\\'")}')">🗑</button>
                            </div>
                        </div>`).join('')
                    : `<div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:.85rem">Список порожній</div>`}
                </div>
            </div>`;
    },

    openAddDir(table, title) {
        Modal.open({
            title: `+ Додати — ${title}`,
            size: 'sm',
            body: `
                <div class="form-group">
                    <label>Назва *</label>
                    <input id="dir-name" type="text" placeholder="Введіть назву">
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="AdminPage.saveDir('${table}')">Додати</button>`
        });
    },

    openEditDir(table, id, name) {
        Modal.open({
            title: '✏️ Редагувати',
            size: 'sm',
            body: `
                <div class="form-group">
                    <label>Назва *</label>
                    <input id="dir-name" type="text" value="${name}">
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="AdminPage.saveDir('${table}','${id}')">Зберегти</button>`
        });
    },

    async saveDir(table, id) {
        const name = Dom.val('dir-name').trim();
        if (!name) { Toast.error('Помилка', 'Введіть назву'); return; }
        Loader.show();
        try {
            if (id) await API.directories.update(table, id, name);
            else    await API.directories.create(table, name);
            Toast.success('Збережено');
            Modal.close();
            await this._renderDirectories(document.getElementById('admin-content'));
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async deleteDir(table, id, name) {
        const ok = await Modal.confirm({
            title: 'Видалити',
            message: `Видалити "<strong>${name}</strong>"?`,
            confirmText: 'Видалити',
            danger: true
        });
        if (!ok) return;
        Loader.show();
        try {
            await API.directories.delete(table, id);
            Toast.success('Видалено');
            await this._renderDirectories(document.getElementById('admin-content'));
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Утиліти ───────────────────────────────────────────────────
    _filterTable(tbodyId, event) {
        const q    = event.target.value.toLowerCase();
        const rows = document.querySelectorAll(`#${tbodyId} tr`);
        rows.forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    }
};
