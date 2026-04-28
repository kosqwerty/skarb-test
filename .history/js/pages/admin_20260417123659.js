// ================================================================
// EduFlow LMS — Панель адміністратора
// ================================================================

const AdminPage = {
    _tab: 'users',

    async init(container, params) {
        if (!AppState.isAdmin() && !AppState.isSmm()) {
            Toast.error('Заборонено', 'Ця сторінка тільки для персоналу');
            Router.go('dashboard');
            return;
        }

        const canManageUsers = AppState.isAdmin(); // owner + admin
        UI.setBreadcrumb([{ label: AppState.isSmm() ? 'Контент' : 'Адміністрування' }]);

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">
                    <h1>⚙️ ${AppState.isSmm() ? 'Керування контентом' : 'Адміністрування'}</h1>
                    <p>Керування системою</p>
                </div>
            </div>

            <div class="tabs">
                ${canManageUsers ? `<button class="tab active" onclick="AdminPage.switchTab('users', this)">👥 Користувачі</button>` : ''}
                <button class="tab ${canManageUsers ? '' : 'active'}" onclick="AdminPage.switchTab('courses', this)">📚 Курси</button>
                <button class="tab" onclick="AdminPage.switchTab('tests', this)">📝 Тести</button>
                <button class="tab" onclick="AdminPage.switchTab('news', this)">📰 Новини</button>
                <button class="tab" onclick="AdminPage.switchTab('enrollments', this)">🎓 Записи</button>
                ${canManageUsers ? `<button class="tab" onclick="AdminPage.switchTab('directories', this)">📋 Довідники</button>` : ''}
                ${canManageUsers ? `<button class="tab" onclick="AdminPage.switchTab('access-groups', this)">🔐 Групи доступу</button>` : ''}
            </div>

            <div id="admin-content"></div>`;

        this._tab = params.tab || (canManageUsers ? 'users' : 'courses');
        await this._loadTab();
    },

    async switchTab(tab, el) {
        if ((tab === 'users' || tab === 'directories' || tab === 'access-groups') && !AppState.isAdmin()) {
            Toast.error('Заборонено', 'Недостатньо прав');
            return;
        }
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
                case 'directories':    await this._renderDirectories(el);          break;
                case 'access-groups': await AccessGroupsPage.renderTab(el);         break;
            }
        } catch(e) {
            el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
        }
    },

    // ── Користувачі ───────────────────────────────────────────────
    _usersAll: [],
    _selectedUsers: new Set(),

    async _renderUsers(el) {
        let list;
        try {
            const { data, error } = await supabase.rpc('admin_get_users');
            list = (!error && data) ? data : null;
        } catch(_) { list = null; }
        if (!list) list = (await API.profiles.getAll({ pageSize: 200 })).data || [];
        this._usersAll = list;
        this._selectedUsers = new Set();

        el.innerHTML = `
            <div style="display:flex;gap:.75rem;margin-bottom:.75rem;flex-wrap:wrap;align-items:center;justify-content:space-between">
                <div style="display:flex;gap:.75rem;flex-wrap:wrap">
                    <button class="btn btn-primary" onclick="AdminPage.openCreateUser()">+ Створити користувача</button>
                    <button class="btn btn-ghost"   onclick="AdminPage.importUsers()">📥 Імпорт</button>
                    <button class="btn btn-success"  onclick="AdminPage.exportUsers(${JSON.stringify(list).replace(/"/g,'&quot;')})">📊 Експорт</button>
                </div>
                <div style="display:flex;align-items:center;gap:.5rem">
                    <span style="font-size:.8rem;color:var(--text-muted)">Показано <span id="users-shown">${list.length}</span> з ${list.length}</span>
                    <span class="filter-badge" id="users-filter-badge" style="display:none"></span>
                    <button class="btn btn-ghost btn-sm" id="users-clear-btn" style="display:none" onclick="AdminPage._clearUserFilters()">✕ Очистити</button>
                </div>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr class="filter-row">
                            <th style="width:36px;padding:.5rem;text-align:center;vertical-align:middle">
                                <input type="checkbox" id="uf-select-all" title="Вибрати всіх видимих"
                                       onchange="AdminPage._toggleAllVisible(this)">
                            </th>
                            <th><input id="uf-name"        type="text" placeholder="ПІБ"        oninput="AdminPage._applyUserFilters()"></th>
                            <th><input id="uf-job"         type="text" placeholder="Посада"      oninput="AdminPage._applyUserFilters()"></th>
                            <th><input id="uf-city"        type="text" placeholder="Місто"       oninput="AdminPage._applyUserFilters()"></th>
                            <th><input id="uf-subdivision" type="text" placeholder="Підрозділ"   oninput="AdminPage._applyUserFilters()"></th>
                            <th>
                                <select id="uf-role" onchange="AdminPage._applyUserFilters()">
                                    <option value="">Роль</option>
                                    <option value="owner">👑 Власник</option>
                                    <option value="admin">👑 Адмін</option>
                                    <option value="smm">📰 SMM</option>
                                    <option value="teacher">Викладач</option>
                                    <option value="user">Користувач</option>
                                </select>
                            </th>
                            <th><input id="uf-label"    type="text" placeholder="Мітка"         oninput="AdminPage._applyUserFilters()"></th>
                            <th><input id="uf-date"     type="text" placeholder="Реєстрація"    oninput="AdminPage._applyUserFilters()"></th>
                            <th><input id="uf-activity" type="text" placeholder="Активність"    oninput="AdminPage._applyUserFilters()"></th>
                            
                            <th class="filter-empty"></th>
                        </tr>
                    </thead>
                    <tbody id="users-tbody">
                        ${list.map(u => this._userRow(u)).join('')}
                    </tbody>
                </table>
            </div>

            <div class="bulk-bar" id="bulk-bar" style="display:none">
                <span class="bulk-info">Вибрано: <span id="bulk-count">0</span></span>
                <div class="bulk-sep"></div>
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._bulkBlock()">🔒 Заблокувати</button>
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._bulkUnblock()">🔓 Розблокувати</button>
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._bulkChangeRole()">🎭 Змінити роль</button>
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._bulkExport()">📊 Експорт вибраних</button>
                <div class="bulk-sep"></div>
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._clearSelection()">✕ Скасувати вибір</button>
            </div>`;

        this._restoreUserFilters();
    },

    _userRow(u) {
        const isOwnerRow = u.role === 'owner';
        const isSelf     = u.id === AppState.user?.id;
        const canEdit    = !isOwnerRow || AppState.isOwner();

        const esc = s => (s || '').toLowerCase().replace(/"/g, '');

        return `
            <tr id="urow-${u.id}"
                data-name="${esc(u.full_name)}"
                data-job="${esc(u.job_position)}"
                data-city="${esc(u.city)}"
                data-subdivision="${esc(u.subdivision)}"
                data-role="${u.role || ''}"
                data-label="${esc(u.label)}"
                data-date="${Fmt.dateShort(u.created_at).toLowerCase()}"
                data-activity="${u.last_sign_in_at ? Fmt.dateShort(u.last_sign_in_at).toLowerCase() : ''}"
                data-status="${u.is_active !== false ? 'active' : 'blocked'}"
                ${isOwnerRow ? 'style="background:var(--bg-raised)"' : ''}>
                <td style="padding:.875rem .5rem;width:36px">
                    <div class="user-cb-wrap">
                        <input type="checkbox" class="user-cb" data-uid="${u.id}"
                               ${isOwnerRow ? 'disabled title="Власника не можна вибрати"' : ''}
                               onchange="AdminPage._onUserCheckbox(this)">
                    </div>
                </td>
                <td>
                    <div style="display:flex;align-items:center;gap:.6rem;cursor:pointer;min-width:160px"
                         onclick="AdminPage.viewProfile(${JSON.stringify(u).replace(/"/g,'&quot;')})" title="Переглянути профіль">
                        <div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden">
                            ${u.avatar_url ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : Fmt.initials(u.full_name)}
                        </div>
                        <div>
                            <div style="font-weight:600;font-size:.82rem;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;text-decoration-color:var(--border-light);white-space:nowrap">${u.full_name || '—'}</div>
                            <div style="font-size:.72rem;color:var(--text-muted)">${u.email}</div>
                        </div>
                    </div>
                </td>
                <td style="font-size:.8rem;white-space:nowrap">${u.job_position || '<span style="color:var(--text-muted)">—</span>'}</td>
                <td style="font-size:.8rem;white-space:nowrap">${u.city        || '<span style="color:var(--text-muted)">—</span>'}</td>
                <td style="font-size:.8rem">${u.subdivision || '<span style="color:var(--text-muted)">—</span>'}</td>
                <td>${Fmt.roleBadge(u.role)}</td>
                <td>${u.label ? `<span class="badge badge-warning" style="font-size:.65rem">${u.label}</span>` : '<span style="color:var(--text-muted);font-size:.8rem">—</span>'}</td>
                <td style="color:var(--text-muted);font-size:.78rem;white-space:nowrap">${Fmt.dateShort(u.created_at)}</td>
                <td style="font-size:.78rem;white-space:nowrap">${u.last_sign_in_at
                    ? `<span style="color:var(--text-secondary)">${Fmt.dateShort(u.last_sign_in_at)}</span>`
                    : '<span style="color:var(--text-muted)">—</span>'}</td>
               
                <td>
                    <div style="display:flex;gap:.3rem">
                        ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="AdminPage.openEditUser(${JSON.stringify(u).replace(/"/g,'&quot;')})">✏️</button>` : ''}
                        ${!isSelf && !isOwnerRow ? `
                            <button class="btn btn-ghost btn-sm" onclick="AdminPage.toggleBlock('${u.id}',${u.is_active !== false})" title="${u.is_active !== false ? 'Заблокувати' : 'Розблокувати'}">
                                ${u.is_active !== false ? '🔒' : '🔓'}
                            </button>` : ''}
                              </div>
                </td>
            </tr>`;
    },

    viewProfile(u) {
        const avatar = u.avatar_url
            ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : `<span style="font-size:1.5rem;font-weight:700;color:#fff">${Fmt.initials(u.full_name)}</span>`;

        const row = (icon, label, val) => val ? `
            <div style="display:flex;align-items:flex-start;gap:.6rem;padding:.45rem 0;border-bottom:1px solid var(--border)">
                <span style="width:1.1rem;text-align:center;flex-shrink:0;margin-top:.05rem">${icon}</span>
                <span style="color:var(--text-muted);font-size:.78rem;white-space:nowrap;min-width:90px">${label}</span>
                <span style="font-size:.875rem;word-break:break-word">${val}</span>
            </div>` : '';

        const genderMap = { male: 'Чоловіча', female: 'Жіноча', other: 'Інша' };

        Modal.open({
            title: 'Профіль користувача',
            size: 'md',
            body: `
                <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem">
                    <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
                        ${avatar}
                    </div>
                    <div>
                        <div style="font-size:1.1rem;font-weight:700;margin-bottom:.3rem">${u.full_name || '—'}</div>
                        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                            ${Fmt.roleBadge(u.role)}
                            ${u.label ? `<span class="badge badge-warning" style="font-size:.65rem">${u.label}</span>` : ''}
                            <span class="badge ${u.is_active !== false ? 'badge-success' : 'badge-muted'}">${u.is_active !== false ? 'Активний' : 'Заблокований'}</span>
                        </div>
                    </div>
                </div>
                <div style="border-top:1px solid var(--border)">
                    ${row('✉️', 'Email',         u.email)}
                    ${row('🔑', 'Логін',         u.login || '—')}
                    ${row('📞', 'Телефон',       u.phone)}
                    ${row('👤', 'Стать',         genderMap[u.gender])}
                    ${row('🎂', 'Дата нар.',     u.birth_date ? Fmt.dateShort(u.birth_date) : null)}
                    ${row('💼', 'Посада',        u.job_position)}
                    ${row('🏢', 'Підрозділ',     u.subdivision)}
                    ${row('📍', 'Місто',         u.city)}
                    ${row('📅', 'Реєстрація',    Fmt.datetime(u.created_at))}
                    ${u.bio ? `
                    <div style="padding:.6rem 0">
                        <div style="color:var(--text-muted);font-size:.78rem;margin-bottom:.3rem">Про себе</div>
                        <div style="font-size:.875rem;color:var(--text-secondary);line-height:1.5">${u.bio}</div>
                    </div>` : ''}
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Закрити</button>
                ${(u.role !== 'owner' || AppState.isOwner()) ? `<button class="btn btn-primary" onclick="Modal.close();AdminPage.openEditUser(${JSON.stringify(u).replace(/"/g,'&quot;')})">✏️ Редагувати</button>` : ''}
            `
        });
    },

    async changeRole(userId, role) {
        if (role === 'owner') {
            // Owner can only be set via Transfer Ownership button
            Toast.error('Помилка', 'Для передачі прав власника скористайтесь кнопкою 👑');
            this._renderUsers(document.getElementById('admin-content'));
            return;
        }
        try {
            await API.profiles.updateRole(userId, role);
            Toast.success('Роль змінено');
        } catch(e) { Toast.error('Помилка', e.message); }
    },

    async transferOwnership(toUserId, toUserName) {
        const ok = await Modal.confirm({
            title: '👑 Передати права власника',
            message: `Ви впевнені, що хочете передати права власника користувачу <strong>${toUserName}</strong>?<br><br>Ваша роль буде змінена на Адміністратор.`,
            confirmText: 'Передати',
            danger: true
        });
        if (!ok) return;
        try {
            Loader.show();
            await API.profiles.updateRole(toUserId, 'owner');
            // DB trigger enforce_single_owner automatically demotes previous owner to admin
            await Auth._loadProfile(); // refresh own profile
            Toast.success('Права власника передано', toUserName);
            UI.renderNavigation(AppState.profile?.role);
            this._renderUsers(document.getElementById('admin-content'));
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    async toggleBlock(userId, isActive) {
        const ok = await Modal.confirm({
            title: isActive ? 'Заблокувати користувача' : 'Розблокувати',
            message: isActive
                ? 'Користувач буде негайно виброшений із системи та втратить доступ.'
                : 'Відновити доступ користувача?',
            confirmText: isActive ? 'Заблокувати' : 'Розблокувати',
            danger: isActive
        });
        if (!ok) return;
        Loader.show();
        try {
            await API.profiles.update(userId, { is_active: !isActive });
            const { error } = await supabase.rpc('admin_set_user_banned', {
                p_user_id: userId,
                p_banned:  isActive
            });
            if (error) throw error;
            Toast.success(isActive ? 'Заблоковано — сесію анульовано' : 'Розблоковано');
            this._renderUsers(document.getElementById('admin-content'));
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _loadRefData() {
        const [cities, positions, subdivisions, usersRes] = await Promise.all([
            API.directories.getAll('cities').catch(() => []),
            API.directories.getAll('positions').catch(() => []),
            API.directories.getAll('subdivisions').catch(() => []),
            API.profiles.getAll({ pageSize: 500 }).catch(() => ({ data: [] }))
        ]);
        return { cities, positions, subdivisions, users: usersRes.data || [] };
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

    _ssRefSelect(id, label, list, val) {
        // table name: 'positions' for job-position, 'subdivisions' for subdivision
        const tableMap = { 'eu-job-position': 'positions', 'cu-job-position': 'positions',
                           'eu-subdivision':  'subdivisions', 'cu-subdivision': 'subdivisions' };
        const table = tableMap[id];
        return `
            <div class="form-group">
                <label>${label}</label>
                ${CreatableSelect.html(id, table, list.map(i => i.name), val || '')}
            </div>`;
    },

    _ssUserSelect(id, label, users, val, excludeId) {
        const items = users
            .filter(u => u.id !== excludeId)
            .map(u => ({ value: u.id, label: u.full_name + (u.job_position ? ' · ' + u.job_position : '') }));
        return `
            <div class="form-group">
                <label>${label}</label>
                ${SearchSelect.html(id, items, val||'')}
            </div>`;
    },

    async openCreateUser() {
        const el = document.getElementById('admin-content');
        el.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        const { cities, positions, subdivisions, users } = await this._loadRefData();

        const mgItems = users.map(u => ({ value: u.id, label: u.full_name + (u.job_position ? ' · ' + u.job_position : '') }));
        el.innerHTML = `
            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem">
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._renderUsers(document.getElementById('admin-content'))">← Назад</button>
                <h3 style="margin:0">+ Створити користувача</h3>
            </div>
            <div class="uf-form" style="max-width:520px">
                <div class="uf-section">ПІБ</div>
                <div class="uf-row">
                    <div class="uf-lbl">Прізвище<span class="req">*</span></div>
                    <input id="cu-last-name" type="text" placeholder="Іваненко">
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Ім\u2019я<span class="req">*</span></div>
                    <input id="cu-first-name" type="text" placeholder="Іван">
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">По батькові</div>
                    <input id="cu-patronymic" type="text" placeholder="Іванович">
                </div>

                <div class="uf-section">Доступ</div>
                <div class="uf-row">
                    <div class="uf-lbl">Логін<span class="req">*</span></div>
                    <input id="cu-login" type="text" placeholder="ivan_ivanov">
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Email<span class="req">*</span></div>
                    <input id="cu-email" type="email" placeholder="user@example.com">
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Пароль<span class="req">*</span></div>
                    <input id="cu-password" type="password" placeholder="Мінімум 6 символів">
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Роль</div>
                    <select id="cu-role">
                        <option value="user">Користувач</option>
                        <option value="teacher">Викладач</option>
                        <option value="smm">SMM-менеджер</option>
                        <option value="admin">Адміністратор</option>
                    </select>
                </div>

                <div class="uf-section">Особисті дані</div>
                <div class="uf-row">
                    <div class="uf-lbl">Стать</div>
                    <select id="cu-gender">
                        <option value="">— не вказано —</option>
                        <option value="male">Чоловіча</option>
                        <option value="female">Жіноча</option>
                        <option value="other">Інша</option>
                    </select>
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Дата нар.</div>
                    <input id="cu-birthdate" type="date">
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Телефон</div>
                    <input id="cu-phone" type="tel" placeholder="+380XXXXXXXXX">
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Місто</div>
                    <select id="cu-city">
                        <option value="">— не вказано —</option>
                        ${cities.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                    </select>
                </div>

                <div class="uf-section">Робота</div>
                <div class="uf-row">
                    <div class="uf-lbl">Посада</div>
                    ${CreatableSelect.html('cu-job-position', 'positions', positions.map(i => i.name), '')}
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Підрозділ</div>
                    ${CreatableSelect.html('cu-subdivision', 'subdivisions', subdivisions.map(i => i.name), '')}
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Керівник</div>
                    ${SearchSelect.html('cu-manager', mgItems, '')}
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Мітка</div>
                    <input id="cu-label" type="text" placeholder="VIP, стажер...">
                </div>
            </div>
            <div style="display:flex;gap:.75rem;padding-top:1rem">
                <button class="btn btn-secondary" onclick="AdminPage._renderUsers(document.getElementById('admin-content'))">Скасувати</button>
                <button class="btn btn-primary" onclick="AdminPage.createUser()">Створити користувача</button>
            </div>`;

        CreatableSelect.init();
    },

    async createUser() {
        const lastName   = Dom.val('cu-last-name').trim();
        const firstName  = Dom.val('cu-first-name').trim();
        const patronymic = Dom.val('cu-patronymic').trim();
        const fullName   = [lastName, firstName, patronymic].filter(Boolean).join(' ');
        const email      = Dom.val('cu-email').trim();
        const password   = Dom.val('cu-password');
        const role       = Dom.val('cu-role');

        if (!lastName || !firstName || !email || !password) {
            Toast.error('Помилка', 'Заповніть Прізвище, Ім\u2019я, Email та Пароль');
            return;
        }

        Loader.show();
        try {
            const { data: userId, error } = await supabase.rpc('admin_user_create', {
                p_email:        email,
                p_password:     password,
                p_full_name:    fullName,
                p_role:         role,
                p_last_name:    lastName   || null,
                p_first_name:   firstName  || null,
                p_patronymic:   patronymic || null,
                p_login:        Dom.val('cu-login').trim()     || null,
                p_phone:        Dom.val('cu-phone').trim()     || null,
                p_gender:       Dom.val('cu-gender')           || null,
                p_birth_date:   Dom.val('cu-birthdate')        || null,
                p_city:         Dom.val('cu-city')             || null,
                p_job_position: Dom.val('cu-job-position')     || null,
                p_subdivision:  Dom.val('cu-subdivision')      || null,
                p_label:        Dom.val('cu-label').trim()     || null,
            });
            if (error) throw error;
            Toast.success('Користувача створено');
            this._renderUsers(document.getElementById('admin-content'));
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    async openEditUser(user) {
        const el = document.getElementById('admin-content');
        const { cities, positions, subdivisions, users } = await this._loadRefData();
        const mgItems = users
            .filter(u => u.id !== user.id)
            .map(u => ({ value: u.id, label: u.full_name + (u.job_position ? ' · ' + u.job_position : '') }));
        el.innerHTML = `
            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem">
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._renderUsers(document.getElementById('admin-content'))">← Назад</button>
                <h3 style="margin:0">✏️ Редагувати користувача</h3>
            </div>
            <div class="uf-form" style="max-width:520px">
                <div class="uf-section">ПІБ</div>
                <div class="uf-row">
                    <div class="uf-lbl">Прізвище</div>
                    <input id="eu-last-name" type="text" value="${user.last_name || ''}">
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Ім\u2019я</div>
                    <input id="eu-first-name" type="text" value="${user.first_name || ''}">
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">По батькові</div>
                    <input id="eu-patronymic" type="text" value="${user.patronymic || ''}">
                </div>

                <div class="uf-section">Доступ</div>
                <div class="uf-row">
                    <div class="uf-lbl">Логін</div>
                    <input id="eu-login" type="text" value="${user.login || ''}" placeholder="ivan_ivanov">
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Email</div>
                    <input id="eu-email" type="text" value="${user.email}" readonly>
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Роль</div>
                    <select id="eu-role" ${user.role === 'owner' ? 'disabled title="Змінюйте через передачу прав"' : ''}>
                        ${(AppState.isOwner() ? ['owner','admin','smm','teacher','user'] : ['admin','smm','teacher','user'])
                            .map(r => `<option value="${r}" ${user.role===r?'selected':''}>${Fmt.role(r)}</option>`).join('')}
                    </select>
                </div>

                <div class="uf-section">Особисті дані</div>
                <div class="uf-row">
                    <div class="uf-lbl">Стать</div>
                    <select id="eu-gender">
                        <option value="">— не вказано —</option>
                        <option value="male"   ${user.gender==='male'  ?'selected':''}>Чоловіча</option>
                        <option value="female" ${user.gender==='female'?'selected':''}>Жіноча</option>
                        <option value="other"  ${user.gender==='other' ?'selected':''}>Інша</option>
                    </select>
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Дата нар.</div>
                    <input id="eu-birthdate" type="date" value="${user.birth_date || ''}">
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Телефон</div>
                    <input id="eu-phone" type="tel" value="${user.phone || ''}">
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Місто</div>
                    <select id="eu-city">
                        <option value="">— не вказано —</option>
                        ${cities.map(c => `<option value="${c.name}" ${c.name===user.city?'selected':''}>${c.name}</option>`).join('')}
                    </select>
                </div>

                <div class="uf-section">Робота</div>
                <div class="uf-row">
                    <div class="uf-lbl">Посада</div>
                    ${CreatableSelect.html('eu-job-position', 'positions', positions.map(i => i.name), user.job_position || '')}
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Підрозділ</div>
                    ${CreatableSelect.html('eu-subdivision', 'subdivisions', subdivisions.map(i => i.name), user.subdivision || '')}
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Керівник</div>
                    ${SearchSelect.html('eu-manager', mgItems, user.manager_id || '')}
                </div>
                <div class="uf-row">
                    <div class="uf-lbl">Мітка</div>
                    <input id="eu-label" type="text" value="${user.label || ''}">
                </div>

                <div class="uf-section">Додатково</div>
                <div class="uf-row" style="grid-template-columns:128px 1fr;align-items:start">
                    <div class="uf-lbl" style="min-height:72px">Про себе</div>
                    <textarea id="eu-bio" style="border:none!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;resize:vertical;min-height:72px;padding:.4rem .65rem!important;font-size:.875rem">${user.bio || ''}</textarea>
                </div>
            </div>
            <div style="display:flex;gap:.75rem;padding-top:1rem">
                <button class="btn btn-secondary" onclick="AdminPage._renderUsers(document.getElementById('admin-content'))">Скасувати</button>
                <button class="btn btn-primary" onclick="AdminPage.saveUser('${user.id}')">Зберегти</button>
            </div>`;

        CreatableSelect.init();
    },

    async saveUser(id) {
        Loader.show();
        try {
            const lastName   = Dom.val('eu-last-name').trim();
            const firstName  = Dom.val('eu-first-name').trim();
            const patronymic = Dom.val('eu-patronymic').trim();
            const updated = await API.profiles.update(id, {
                last_name:    lastName   || null,
                first_name:   firstName  || null,
                patronymic:   patronymic || null,
                login:        Dom.val('eu-login').trim() || null,
                role:         Dom.val('eu-role'),
                gender:       Dom.val('eu-gender') || null,
                city:         Dom.val('eu-city') || null,
                phone:        Dom.val('eu-phone').trim() || null,
                job_position: Dom.val('eu-job-position') || null,
                subdivision:  Dom.val('eu-subdivision') || null,
                birth_date:   Dom.val('eu-birthdate') || null,
                label:        Dom.val('eu-label').trim() || null,
                bio:          Dom.val('eu-bio').trim() || null,
                manager_id:   Dom.val('eu-manager') || null
            });
            // якщо адмін редагує власний профіль — оновлюємо кеш і sidebar
            if (id === AppState.user?.id) {
                AppState.profile = updated;
                UI.renderSidebarUser(updated);
                UI.renderNavigation(updated.role);
            }
            Toast.success('Збережено');
            this._renderUsers(document.getElementById('admin-content'));
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    // ── Фільтрація користувачів ───────────────────────────────────
    // Розбиває рядок фільтру на токени через кому/крапку з комою.
    // Повертає true якщо хоча б один токен входить у рядок (OR-логіка).
    _matchTokens(haystack, raw) {
        if (!raw) return true;
        const tokens = raw.toLowerCase().split(/[,;]+/).map(t => t.trim()).filter(Boolean);
        return tokens.some(t => haystack.includes(t));
    },

    _applyUserFilters() {
        const v = id => document.getElementById(id)?.value || '';
        const f = {
            name:        v('uf-name'),
            job:         v('uf-job'),
            city:        v('uf-city'),
            subdivision: v('uf-subdivision'),
            role:        v('uf-role'),
            label:       v('uf-label'),
            date:        v('uf-date'),
            activity:    v('uf-activity'),
            status:      v('uf-status'),
        };

        localStorage.setItem('lms_admin_user_filters', JSON.stringify(f));

        let shown = 0;
        document.querySelectorAll('#users-tbody tr').forEach(row => {
            const d = row.dataset;
            const match =
                this._matchTokens(d.name,        f.name)        &&
                this._matchTokens(d.job,         f.job)         &&
                this._matchTokens(d.city,        f.city)        &&
                this._matchTokens(d.subdivision, f.subdivision) &&
                (!f.role   || d.role   === f.role)              &&
                this._matchTokens(d.label,       f.label)       &&
                this._matchTokens(d.date,        f.date)        &&
                this._matchTokens(d.activity,    f.activity)    &&
                (!f.status || d.status === f.status);
            row.style.display = match ? '' : 'none';
            if (match) shown++;
        });

        // update counter
        const shownEl = document.getElementById('users-shown');
        if (shownEl) shownEl.textContent = shown;

        // sync select-all checkbox state after filter change
        this._syncSelectAll();

        // active filters count
        const activeCount = Object.values(f).filter(Boolean).length;
        const badge  = document.getElementById('users-filter-badge');
        const clearBtn = document.getElementById('users-clear-btn');
        if (badge) {
            badge.textContent = `${activeCount} фільтр${activeCount === 1 ? '' : activeCount < 5 ? 'и' : 'ів'} активн${activeCount === 1 ? 'ий' : 'о'}`;
            badge.style.display = activeCount ? '' : 'none';
        }
        if (clearBtn) clearBtn.style.display = activeCount ? '' : 'none';
    },

    _clearUserFilters() {
        ['uf-name','uf-job','uf-city','uf-subdivision','uf-label','uf-date','uf-activity'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        ['uf-role','uf-status'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        localStorage.removeItem('lms_admin_user_filters');
        this._applyUserFilters();
    },

    _restoreUserFilters() {
        try {
            const saved = localStorage.getItem('lms_admin_user_filters');
            if (!saved) return;
            const f = JSON.parse(saved);
            const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            set('uf-name',        f.name);
            set('uf-job',         f.job);
            set('uf-city',        f.city);
            set('uf-subdivision', f.subdivision);
            set('uf-role',        f.role);
            set('uf-label',       f.label);
            set('uf-date',        f.date);
            set('uf-activity',    f.activity);
            set('uf-status',      f.status);
            this._applyUserFilters();
        } catch(_) {}
    },

    // ── Bulk selection ────────────────────────────────────────────
    _onUserCheckbox(cb) {
        if (cb.checked) this._selectedUsers.add(cb.dataset.uid);
        else            this._selectedUsers.delete(cb.dataset.uid);
        this._updateBulkBar();
        this._syncSelectAll();
    },

    _toggleAllVisible(masterCb) {
        const boxes = this._visibleCheckboxes();
        const check = masterCb.checked;
        boxes.forEach(cb => {
            cb.checked = check;
            if (check) this._selectedUsers.add(cb.dataset.uid);
            else        this._selectedUsers.delete(cb.dataset.uid);
        });
        this._updateBulkBar();
    },

    _visibleCheckboxes() {
        return [...document.querySelectorAll('#users-tbody tr')]
            .filter(r => r.style.display !== 'none')
            .map(r => r.querySelector('.user-cb'))
            .filter(cb => cb && !cb.disabled);
    },

    _syncSelectAll() {
        const cb = document.getElementById('uf-select-all');
        if (!cb) return;
        const boxes = this._visibleCheckboxes();
        const checked = boxes.filter(b => b.checked).length;
        if (checked === 0)            { cb.checked = false; cb.indeterminate = false; }
        else if (checked === boxes.length) { cb.checked = true;  cb.indeterminate = false; }
        else                           { cb.checked = false; cb.indeterminate = true; }
    },

    _updateBulkBar() {
        const n = this._selectedUsers.size;
        const bar = document.getElementById('bulk-bar');
        const cnt = document.getElementById('bulk-count');
        if (bar) bar.style.display = n > 0 ? '' : 'none';
        if (cnt) cnt.textContent = n;
    },

    _clearSelection() {
        this._selectedUsers.clear();
        document.querySelectorAll('.user-cb').forEach(cb => cb.checked = false);
        const sa = document.getElementById('uf-select-all');
        if (sa) { sa.checked = false; sa.indeterminate = false; }
        this._updateBulkBar();
    },

    async _bulkBlock() {
        const users = this._usersAll.filter(u =>
            this._selectedUsers.has(u.id) && u.role !== 'owner' && u.id !== AppState.user?.id
        );
        if (!users.length) { Toast.info('', 'Серед вибраних немає користувачів для блокування'); return; }
        const ok = await Modal.confirm({
            title: 'Заблокувати користувачів',
            message: `Заблокувати <strong>${users.length}</strong> користувач${users.length === 1 ? 'а' : 'ів'}?`,
            confirmText: 'Заблокувати', danger: true
        });
        if (!ok) return;
        Loader.show();
        try {
            await Promise.all(users.map(u =>
                API.profiles.update(u.id, { is_active: false })
                    .then(() => supabase.rpc('admin_set_user_banned', { p_user_id: u.id, p_banned: true }))
            ));
            Toast.success(`Заблоковано: ${users.length} — сесії анульовано`);
            this._clearSelection();
            await this._renderUsers(document.getElementById('admin-content'));
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    },

    async _bulkUnblock() {
        const users = this._usersAll.filter(u => this._selectedUsers.has(u.id));
        if (!users.length) return;
        Loader.show();
        try {
            await Promise.all(users.map(u =>
                API.profiles.update(u.id, { is_active: true })
                    .then(() => supabase.rpc('admin_set_user_banned', { p_user_id: u.id, p_banned: false }))
            ));
            Toast.success(`Розблоковано: ${users.length}`);
            this._clearSelection();
            await this._renderUsers(document.getElementById('admin-content'));
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    },

    _bulkChangeRole() {
        const users = this._usersAll.filter(u => this._selectedUsers.has(u.id) && u.role !== 'owner');
        if (!users.length) { Toast.info('', 'Серед вибраних немає доступних користувачів'); return; }
        const ids = JSON.stringify(users.map(u => u.id)).replace(/"/g,'&quot;');
        Modal.open({
            title: 'Змінити роль',
            size: 'sm',
            body: `
                <p style="color:var(--text-secondary);margin-bottom:1rem">
                    Нова роль для <strong>${users.length}</strong> користувач${users.length === 1 ? 'а' : 'ів'}:
                </p>
                <select id="bulk-role-sel">
                    <option value="user">Користувач</option>
                    <option value="teacher">Викладач</option>
                    <option value="smm">📰 SMM-менеджер</option>
                    ${AppState.isOwner() ? '<option value="admin">👑 Адміністратор</option>' : ''}
                </select>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="AdminPage._bulkRoleConfirm('${ids}')">Застосувати</button>`
        });
    },

    async _bulkRoleConfirm(idsJson) {
        const ids  = JSON.parse(idsJson.replace(/&quot;/g,'"'));
        const role = document.getElementById('bulk-role-sel')?.value;
        if (!role) return;
        Modal.close();
        Loader.show();
        try {
            await Promise.all(ids.map(id => API.profiles.update(id, { role })));
            Toast.success(`Роль змінено для ${ids.length} користувачів`);
            this._clearSelection();
            await this._renderUsers(document.getElementById('admin-content'));
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    },

    _bulkExport() {
        const users = this._usersAll.filter(u => this._selectedUsers.has(u.id));
        if (!users.length) return;
        this.exportUsers(users);
    },

    // ── Імпорт користувачів з CSV ─────────────────────────────────
    _importRows: [],

    _importCols: ['last_name','first_name','patronymic','login','email','password','role','gender','phone','birth_date','city','job_position','subdivision','label'],
    _importHeaders: ['Прізвище','Ім\u2019я','По батькові','Логін','Email','Пароль','Роль','Стать','Телефон','Дата нар.','Місто','Посада','Підрозділ','Мітка'],

    importUsers() {
        Modal.open({
            title: '📥 Імпорт користувачів',
            size: 'lg',
            body: `
                <p style="color:var(--text-secondary);font-size:.875rem;margin:0 0 1rem">
                    Завантажте CSV-файл з даними користувачів. Обов\u2019язкові поля:
                    <strong>Прізвище, Ім\u2019я, Email, Пароль</strong>.
                    Роздільник — крапка з комою <code>;</code>.
                </p>
                <div style="display:flex;gap:.75rem;margin-bottom:1.25rem;align-items:center">
                    <button class="btn btn-ghost btn-sm" onclick="AdminPage._downloadImportExample()">📄 Завантажити приклад файлу</button>
                    <span style="color:var(--text-muted);font-size:.78rem">← рекомендуємо відкрити у Excel або Google Sheets</span>
                </div>
                <label for="import-file-input" style="display:flex;flex-direction:column;align-items:center;gap:.75rem;border:2px dashed var(--border);border-radius:var(--radius-md);padding:2rem;cursor:pointer;transition:border-color .2s"
                       onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
                    <span style="font-size:2.5rem">📂</span>
                    <span style="color:var(--text-secondary)">Натисніть, щоб вибрати CSV-файл</span>
                </label>
                <input type="file" id="import-file-input" accept=".csv,.txt" style="display:none"
                       onchange="AdminPage._onImportFile(this)">
                <div id="import-preview"></div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" id="import-run-btn" style="display:none" onclick="AdminPage._runImport()">Імпортувати</button>`
        });
    },

    _downloadImportExample() {
        const header = this._importHeaders.join(';');
        const rows = [
            'Іваненко;Іван;Іванович;ivan_ivanov;ivan@example.com;Qwerty123;user;male;+380991234567;1990-01-15;Київ;Менеджер;Відділ продажів;VIP',
            'Петренко;Марія;;mary_p;mary@example.com;Qwerty123;teacher;female;;;Львів;;;',
            'Коваль;Олег;;oleg_k;oleg@example.com;Qwerty123;user;;;;Харків;;Бухгалтерія;'
        ];
        const bom = '\uFEFF';
        const csv = bom + [header, ...rows].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = 'users_import_example.csv';
        a.click(); URL.revokeObjectURL(url);
    },

    _onImportFile(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            const text = e.target.result.replace(/^\uFEFF/, ''); // strip BOM
            this._importRows = this._parseCSV(text);
            this._renderImportPreview();
        };
        reader.readAsText(file, 'UTF-8');
    },

    _parseCSV(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return [];
        const delim = lines[0].includes(';') ? ';' : ',';
        const rawHeaders = lines[0].split(delim).map(h => h.trim().toLowerCase());

        // map column names to internal keys
        const colAlias = {
            'прізвище':'last_name','фамилия':'last_name','lastname':'last_name','last_name':'last_name',
            'ім\'я':'first_name','имя':'first_name','firstname':'first_name','first_name':'first_name',
            'по батькові':'patronymic','отчество':'patronymic','patronymic':'patronymic',
            'логін':'login','логин':'login','login':'login',
            'email':'email','e-mail':'email','пошта':'email',
            'пароль':'password','password':'password','pass':'password',
            'роль':'role','role':'role',
            'стать':'gender','пол':'gender','gender':'gender',
            'телефон':'phone','phone':'phone','тел':'phone',
            'дата нар.':'birth_date','дата народження':'birth_date','birth_date':'birth_date','birthdate':'birth_date',
            'місто':'city','город':'city','city':'city',
            'посада':'job_position','должность':'job_position','job_position':'job_position','position':'job_position',
            'підрозділ':'subdivision','подразделение':'subdivision','subdivision':'subdivision',
            'мітка':'label','метка':'label','label':'label'
        };
        const colMap = rawHeaders.map(h => colAlias[h] || null);

        return lines.slice(1).map((line, idx) => {
            const vals = line.split(delim).map(v => v.trim().replace(/^"|"$/g, ''));
            const row = { _line: idx + 2 };
            colMap.forEach((key, i) => { if (key) row[key] = vals[i] || ''; });
            row._errors = [];
            if (!row.last_name)  row._errors.push('Прізвище');
            if (!row.first_name) row._errors.push('Ім\u2019я');
            if (!row.email)      row._errors.push('Email');
            if (!row.password)   row._errors.push('Пароль');
            const validRoles = ['owner','admin','smm','teacher','user'];
            if (row.role && !validRoles.includes(row.role)) row._errors.push('Роль (невірне значення)');
            if (row.gender && !['male','female','other'].includes(row.gender)) row._errors.push('Стать (невірне значення)');
            return row;
        }).filter(r => Object.keys(r).length > 2); // skip totally empty rows
    },

    _renderImportPreview() {
        const rows = this._importRows;
        const preview = document.getElementById('import-preview');
        const runBtn  = document.getElementById('import-run-btn');
        if (!rows.length) {
            preview.innerHTML = `<p style="color:var(--danger);margin-top:1rem">Файл порожній або невірний формат.</p>`;
            runBtn.style.display = 'none';
            return;
        }
        const errCount = rows.filter(r => r._errors.length).length;
        const okCount  = rows.length - errCount;

        preview.innerHTML = `
            <div style="display:flex;gap:.75rem;align-items:center;margin:1rem 0 .5rem;flex-wrap:wrap">
                <span class="badge badge-success">✓ Готових: ${okCount}</span>
                ${errCount ? `<span class="badge badge-danger">⚠ З помилками: ${errCount} (буде пропущено)</span>` : ''}
                <span style="color:var(--text-muted);font-size:.78rem">Усього рядків: ${rows.length}</span>
            </div>
            <div style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-md)">
                <table style="font-size:.78rem">
                    <thead><tr>
                        <th>#</th><th>Прізвище</th><th>Ім\u2019я</th><th>Email</th><th>Логін</th><th>Роль</th><th>Статус</th>
                    </tr></thead>
                    <tbody>
                        ${rows.map(r => `
                            <tr style="${r._errors.length ? 'opacity:.5' : ''}">
                                <td style="color:var(--text-muted)">${r._line}</td>
                                <td>${r.last_name  || '<span style="color:var(--danger)">—</span>'}</td>
                                <td>${r.first_name || '<span style="color:var(--danger)">—</span>'}</td>
                                <td>${r.email      || '<span style="color:var(--danger)">—</span>'}</td>
                                <td style="color:var(--text-muted)">${r.login || '—'}</td>
                                <td>${r.role ? `<span class="badge badge-muted" style="font-size:.65rem">${Fmt.role(r.role)}</span>` : '<span style="color:var(--text-muted)">user</span>'}</td>
                                <td>${r._errors.length
                                    ? `<span style="color:var(--danger);font-size:.72rem">✗ ${r._errors.join(', ')}</span>`
                                    : '<span style="color:var(--success)">✓</span>'}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;

        runBtn.style.display = okCount > 0 ? '' : 'none';
        runBtn.textContent   = `Імпортувати ${okCount} користувач${okCount === 1 ? 'а' : 'ів'}`;
    },

    async _runImport() {
        const rows = this._importRows.filter(r => !r._errors.length);
        if (!rows.length) return;

        const body   = document.getElementById('modal-body');
        const footer = document.getElementById('modal-footer');
        footer.innerHTML = '';

        let done = 0, failed = 0;
        const total = rows.length;

        const renderProgress = () => {
            const pct = Math.round(((done + failed) / total) * 100);
            body.innerHTML = `
                <div style="text-align:center;padding:1.5rem 0">
                    <div style="font-size:1.5rem;margin-bottom:.75rem">⏳</div>
                    <div style="font-weight:600;margin-bottom:1rem">Створення користувачів...</div>
                    <div style="background:var(--bg-raised);border-radius:99px;height:8px;overflow:hidden;margin-bottom:.75rem">
                        <div style="height:100%;background:var(--primary);border-radius:99px;transition:width .3s;width:${pct}%"></div>
                    </div>
                    <div style="color:var(--text-muted);font-size:.875rem">${done + failed} / ${total}</div>
                    ${failed ? `<div style="color:var(--danger);font-size:.78rem;margin-top:.5rem">Помилок: ${failed}</div>` : ''}
                </div>`;
        };

        renderProgress();

        for (const row of rows) {
            if (!row.email || !row.email.trim()) { failed++; renderProgress(); continue; }
            try {
                const fullName = [row.last_name, row.first_name, row.patronymic].filter(Boolean).join(' ') || row.email;
                const { data: userId, error } = await supabase.rpc('admin_user_create', {
                    p_email:        row.email,
                    p_password:     row.password,
                    p_full_name:    fullName,
                    p_role:         row.role         || 'user',
                    p_last_name:    row.last_name    || null,
                    p_first_name:   row.first_name   || null,
                    p_patronymic:   row.patronymic   || null,
                    p_login:        row.login        || null,
                    p_phone:        row.phone        || null,
                    p_gender:       row.gender       || null,
                    p_birth_date:   row.birth_date   || null,
                    p_city:         row.city         || null,
                    p_job_position: row.job_position || null,
                    p_subdivision:  row.subdivision  || null,
                    p_label:        row.label        || null,
                });
                if (error) throw error;
                done++;
            
            } catch(e) {
                failed++;
                console.error(`Import error (row ${row._line}):`, e?.message || e);
                // Опционально — показать первую ошибку в UI:
                if (failed === 1) {
                    document.querySelector('[style*="danger"]') && (
                        document.querySelector('[id=import-err-hint]')?.remove(),
                        body.insertAdjacentHTML('beforeend',
                            `<div id="import-err-hint" style="color:var(--danger);font-size:.75rem;margin-top:.5rem">
                                Перша помилка: ${e?.message || 'невідома'}
                            </div>`)
        );
    }
}
            renderProgress();
        }

        body.innerHTML = `
            <div style="text-align:center;padding:1.5rem 0">
                <div style="font-size:2.5rem;margin-bottom:.75rem">${failed === 0 ? '✅' : '⚠️'}</div>
                <div style="font-weight:600;font-size:1.1rem;margin-bottom:.5rem">Імпорт завершено</div>
                <div style="color:var(--success);margin-bottom:.25rem">Створено: ${done}</div>
                ${failed ? `<div style="color:var(--danger)">Помилок: ${failed}</div>` : ''}
            </div>`;
        footer.innerHTML = `<button class="btn btn-primary" onclick="Modal.close();AdminPage._renderUsers(document.getElementById('admin-content'))">Готово</button>`;
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
                        <tr><th>Назва</th><th>Викладач</th><th>Рівень</th><th>Створено</th><th>Дії</th></tr>
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
                    <thead><tr><th>Стажер</th><th>Курс</th><th>Прогрес</th><th>Записаний</th><th>Завершив</th></tr></thead>
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
            'Стажер':   e.user?.full_name,
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
            API.directories.getAll('positions').catch(() => null),
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
                ${this._dirCard('Посади', '💼', 'positions', positions)}
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
