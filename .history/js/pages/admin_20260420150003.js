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
                ${canManageUsers ? `<button class="tab" onclick="AdminPage.switchTab('access-groups', this)">🔐 Групи доступу</button>` : ''}
                ${AppState.isOwner() ? `<button class="tab" onclick="AdminPage.switchTab('trash', this)">🗑 Кошик</button>` : ''}
            </div>

            <div id="admin-content"></div>`;

        this._tab = params.tab || (canManageUsers ? 'users' : 'courses');
        await this._loadTab();
    },

    async switchTab(tab, el) {
        if ((tab === 'users' || tab === 'access-groups') && !AppState.isAdmin()) {
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
                case 'access-groups': await AccessGroupsPage.renderTab(el);         break;
                case 'trash':         await this._renderTrash(el);                  break;
            }
        } catch(e) {
            el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
        }
    },

    // ── Користувачі ───────────────────────────────────────────────
    _usersAll: [],
    _selectedUsers: new Set(),
    _sortState: { field: null, dir: 1 },
    _pageSize: 50,
    _pageCurrent: 1,

    _sortBtn(field) {
        return `<span class="sort-btns" id="sort-btns-${field}">
            <button class="sort-arrow sort-up"   onclick="event.stopPropagation();AdminPage._sortUsers('${field}',1)"  title="За зростанням">▲</button>
            <button class="sort-arrow sort-down" onclick="event.stopPropagation();AdminPage._sortUsers('${field}',-1)" title="За спаданням">▼</button>
        </span>`;
    },

    _sortByLabel(field) {
        const s = this._sortState;
        if (s.field !== field) this._sortUsers(field, 1);   // нова колонка → asc
        else if (s.dir === 1)  this._sortUsers(field, -1);  // asc → desc
        else                   this._sortUsers(field, -1);  // desc + той самий dir = скидання
    },

    _sortUsers(field, dir) {
        const s = this._sortState;
        // Повторний клік по тій самій стрілці — скидаємо
        if (s.field === field && s.dir === dir) {
            s.field = null; s.dir = 1;
        } else {
            s.field = field; s.dir = dir;
        }
        // Оновлюємо вигляд стрілок
        document.querySelectorAll('.sort-arrow').forEach(el => el.classList.remove('active'));
        if (s.field) {
            const btn = document.querySelector(`#sort-btns-${s.field} .sort-${s.dir === 1 ? 'up' : 'down'}`);
            if (btn) btn.classList.add('active');
        }
        const tbody = document.getElementById('users-tbody');
        if (!tbody) return;
        const rows = [...tbody.querySelectorAll('tr')];
        if (!s.field) {
            this._usersAll.forEach(u => {
                const row = document.getElementById(`urow-${u.id}`);
                if (row) tbody.appendChild(row);
            });
        } else {
            rows.sort((a, b) => (a.dataset[field] || '').localeCompare(b.dataset[field] || '', 'uk') * s.dir);
            rows.forEach(r => tbody.appendChild(r));
        }
        this._pageCurrent = 1;
        this._applyPagination();
    },

    _renderUsers(el) {
        el.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:.75rem;padding:.5rem 0">
                <a class="admin-section-link" href="#" onclick="event.preventDefault();AdminPage._renderUsersList(document.getElementById('admin-content'))">
                    <span class="admin-section-icon">👥</span>
                    <div>
                        <div class="admin-section-title">Всі користувачі</div>
                        <div class="admin-section-desc">Перегляд, додавання, редагування та імпорт користувачів</div>
                    </div>
                </a>
                <a class="admin-section-link" href="#" onclick="event.preventDefault();AdminPage._renderDirectories(document.getElementById('admin-content'))">
                    <span class="admin-section-icon">📋</span>
                    <div>
                        <div class="admin-section-title">Довідник</div>
                        <div class="admin-section-desc">Міста, посади, підрозділи</div>
                    </div>
                </a>
            </div>`;
    },

    async _renderUsersList(el) {
        let list;
        try {
            const { data, error } = await supabase.rpc('admin_get_users');
            list = (!error && data) ? data : null;
        } catch(_) { list = null; }
        if (!list) list = (await API.profiles.getAll({ pageSize: 200 })).data || [];
        this._usersAll = list;
        this._selectedUsers = new Set();

        el.innerHTML = `
            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem">
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._renderUsers(document.getElementById('admin-content'))">← Назад</button>
                <h3 style="margin:0">👥 Всі користувачі</h3>
            </div>
            <div style="display:flex;gap:.75rem;margin-bottom:.75rem;flex-wrap:wrap;align-items:center;justify-content:space-between">
                <div style="display:flex;gap:.75rem;flex-wrap:wrap">
                    <button class="btn btn-primary" onclick="AdminPage.openCreateUser()">+ Створити користувача</button>
                    <button class="btn btn-ghost"   onclick="AdminPage.importUsers()">📥 Імпорт</button>
                    <button class="btn btn-success"  onclick="AdminPage.exportUsers(${JSON.stringify(list).replace(/"/g,'&quot;')})">📊 Експорт</button>
                </div>
                <div style="display:flex;align-items:center;gap:.75rem">
                    <span style="font-size:.8rem;color:var(--text-muted)">Показано <span id="users-shown">0</span> з <span id="users-total">${list.length}</span></span>
                    <span class="filter-badge" id="users-filter-badge" style="display:none"></span>
                    <button class="btn btn-ghost btn-sm" id="users-clear-btn" style="display:none" onclick="AdminPage._clearUserFilters()">✕ Очистити</button>
                    <span style="font-size:.8rem;color:var(--text-muted)">|</span>
                    <span style="font-size:.8rem;color:var(--text-muted)">По</span>
                    ${[10,50,100].map(n => `<span class="page-size-btn${this._pageSize===n?' active':''}" onclick="AdminPage._setPageSize(${n})">${n}</span>`).join('')}
                </div>
            </div>

            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr class="filter-row">
                            <th style="width:36px;padding:.5rem;text-align:center;vertical-align:bottom;padding-top:.75rem">
                                <input type="checkbox" id="uf-select-all" title="Вибрати всіх видимих"
                                       onchange="AdminPage._toggleAllVisible(this)">
                            </th>
                            <th><div class="ms-filter-label" onclick="AdminPage._sortByLabel('name')">ПІБ ${AdminPage._sortBtn('name')}</div>${MultiSelect.html('uf-name', 'Всі...')}</th>
                            <th><div class="ms-filter-label" onclick="AdminPage._sortByLabel('job')">Посада ${AdminPage._sortBtn('job')}</div>${MultiSelect.html('uf-job', 'Всі...')}</th>
                            <th><div class="ms-filter-label" onclick="AdminPage._sortByLabel('city')">Місто ${AdminPage._sortBtn('city')}</div>${MultiSelect.html('uf-city', 'Всі...')}</th>
                            <th><div class="ms-filter-label" onclick="AdminPage._sortByLabel('subdivision')">Підрозділ ${AdminPage._sortBtn('subdivision')}</div>${MultiSelect.html('uf-subdivision', 'Всі...')}</th>
                            <th>
                                <div class="ms-filter-label" onclick="AdminPage._sortByLabel('role')">Роль ${AdminPage._sortBtn('role')}</div>
                                <select id="uf-role" onchange="AdminPage._applyUserFilters()">
                                    <option value="">Всі</option>
                                    <option value="owner">👑 Власник</option>
                                    <option value="admin">👑 Адмін</option>
                                    <option value="smm">📰 SMM</option>
                                    <option value="teacher">Викладач</option>
                                    <option value="user">Користувач</option>
                                </select>
                            </th>
                            <th><div class="ms-filter-label" onclick="AdminPage._sortByLabel('label')">Мітка ${AdminPage._sortBtn('label')}</div>${MultiSelect.html('uf-label', 'Всі...')}</th>
                            <th><div class="ms-filter-label" onclick="AdminPage._sortByLabel('date')">Реєстрація ${AdminPage._sortBtn('date')}</div><input id="uf-date" type="text" placeholder="дд.мм.рррр" oninput="AdminPage._applyUserFilters()"></th>
                            <th><div class="ms-filter-label" onclick="AdminPage._sortByLabel('activity')">Активність ${AdminPage._sortBtn('activity')}</div><input id="uf-activity" type="text" placeholder="дд.мм.рррр" oninput="AdminPage._applyUserFilters()"></th>
                            <th style="vertical-align:bottom;padding-top:.7rem;text-align:center">
                                <button class="btn-reset-filters" onclick="AdminPage._clearUserFilters()" title="Скинути всі фільтри"><img src="icons/filter.png" alt="Скинути фільтри"></button>
                            </th>
                        </tr>
                    </thead>
                    <tbody id="users-tbody">
                        ${list.map(u => this._userRow(u)).join('')}
                    </tbody>
                </table>
            </div>

            <div id="users-pagination" style="margin-top:.75rem"></div>

            <div class="bulk-bar" id="bulk-bar" style="display:none">
                <span class="bulk-info">Вибрано: <span id="bulk-count">0</span></span>
                <div class="bulk-sep"></div>
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._bulkBlock()">🔒 Заблокувати</button>
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._bulkUnblock()">🔓 Розблокувати</button>
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._bulkChangeRole()">🎭 Змінити роль</button>
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._bulkExport()">📊 Експорт вибраних</button>
                <div class="bulk-sep"></div>
                <button class="btn btn-danger btn-sm" onclick="AdminPage._bulkDelete()">🗑 Видалити</button>
                <div class="bulk-sep"></div>
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._clearSelection()">✕ Скасувати вибір</button>
            </div>`;

        // Збираємо унікальні значення з завантажених даних
        const uniq = (field) => [...new Set(list.map(u => u[field]).filter(Boolean))].sort((a,b) => a.localeCompare(b,'uk'));
        MultiSelect.init('uf-name',        uniq('full_name'));
        MultiSelect.init('uf-job',         uniq('job_position'));
        MultiSelect.init('uf-city',        uniq('city'));
        MultiSelect.init('uf-subdivision', uniq('subdivision'));
        MultiSelect.init('uf-label',       uniq('label'));

        // Реагуємо на зміни MultiSelect
        ['uf-name','uf-job','uf-city','uf-subdivision','uf-label'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => AdminPage._applyUserFilters());
        });

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
    <div class="user-create-container">
        <!-- Хедер -->
        <div class="create-header">
            <button class="back-btn" onclick="AdminPage._renderUsersList(document.getElementById('admin-content'))">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Назад
            </button>
            <h2 class="create-title">
                <span class="title-icon">👤</span> 
                Новий користувач
            </h2>
        </div>

        <!-- Форма -->
        <div class="create-form-grid">
            
            <!-- Секция 1: ПІБ -->
            <div class="form-section glass-panel">
                <div class="section-header">
                    <span class="section-badge">1</span>
                    <h4>Особисті дані</h4>
                </div>
                <div class="input-group">
                    <label class="input-label">
                        <span>Прізвище <span class="required-star">*</span></span>
                        <input id="cu-last-name" type="text" placeholder="" autocomplete="off">
                    </label>
                    <label class="input-label">
                        <span>Ім'я <span class="required-star">*</span></span>
                        <input id="cu-first-name" type="text" placeholder="" autocomplete="off">
                    </label>
                    <label class="input-label">
                        <span>По батькові</span>
                        <input id="cu-patronymic" type="text" placeholder="" autocomplete="off">
                    </label>
                </div>
                <div class="input-group">
                    <label class="input-label">
                        <span>Стать</span>
                        <div class="gender-picker-modern">
                            <input type="hidden" id="cu-gender" value="">
                            <button type="button" class="gender-chip" onclick="this.closest('.gender-picker-modern').querySelector('input').value='male';this.closest('.gender-picker-modern').querySelectorAll('.gender-chip').forEach(b=>b.classList.remove('active'));this.classList.add('active')">
                                <span>♂</span> Чоловік
                            </button>
                            <button type="button" class="gender-chip" onclick="this.closest('.gender-picker-modern').querySelector('input').value='female';this.closest('.gender-picker-modern').querySelectorAll('.gender-chip').forEach(b=>b.classList.remove('active'));this.classList.add('active')">
                                <span>♀</span> Жінка
                            </button>
                        </div>
                    </label>
                    <div class="input-row-2col">
                        <label class="input-label">
                            <span>Дата народження</span>
                            <input id="cu-birthdate" type="date" value="2000-01-01">
                        </label>
                        <label class="input-label">
                            <span>Телефон</span>
                            <input id="cu-phone" type="tel" placeholder="+380 XX XXX XX XX">
                        </label>
                    </div>
                    
                </div>
            </div>

            <!-- Секция 2: Доступ -->
            <div class="form-section glass-panel">
                <div class="section-header">
                    <span class="section-badge">2</span>
                    <h4>Дані для входу</h4>
                </div>
                <div class="input-group">
                    <label class="input-label">
                        <span>Логін <span class="required-star">*</span></span>
                        <input id="cu-login" type="text" placeholder="ПризвіщеІм'я" autocomplete="off">
                    </label>
                    <label class="input-label">
                        <span>Email <span class="required-star">*</span></span>
                        <input id="cu-email" type="email" placeholder="user@example.com" autocomplete="off">
                    </label>
                    <label class="input-label">
                        <span>Пароль <span class="required-star">*</span></span>
                        <input id="cu-password" type="password" placeholder="••••••••" autocomplete="new-password">
                        <small class="field-hint">Мінімум 6 символів</small>
                    </label>
                    <label class="input-label">
                        <span>Роль</span>
                        <div class="custom-select-wrapper">
                            <select id="cu-role">
                                <option value="user">👤 Користувач</option>
                                <option value="teacher">📚 Викладач</option>
                                <option value="smm">📱 SMM-менеджер</option>
                                <option value="admin">⚡ Адміністратор</option>
                            </select>
                        </div>
                    </label>
                </div>
            </div>

            <!-- Секция 3: Работа -->
            <div class="form-section glass-panel">
                <div class="section-header">
                    <span class="section-badge">3</span>
                    <h4>Робоча інформація</h4>
                </div>
                <div class="input-group">
                        <label class="input-label">
                        <span>Місто</span>
                        ${CreatableSelect.html('cu-city', 'cities', cities.map(i=>i.name), '')}
                         </label>
                        <label class="input-label">
                            <span>Підрозділ</span>
                            ${CreatableSelect.html('cu-subdivision', 'subdivisions', subdivisions.map(i => i.name), '')}
                        </label>
                        <label class="input-label">
                            <span>Посада</span>
                            ${CreatableSelect.html('cu-job-position', 'positions', positions.map(i => i.name), '')}
                        </label>
                        
                    
                    <label class="input-label">
                        <span>Керівник</span>
                        ${SearchSelect.html('cu-manager', mgItems, '')}
                    </label>
                    <label class="input-label">
                        <span>Мітка</span>
                        <input id="cu-label" type="text" placeholder="Наприклад: Блок, Валюта">
                    </label>
                </div>
            </div>
        </div>

        <!-- Футер с кнопками -->
        <div class="form-actions">
            <button class="btn-secondary-modern" onclick="AdminPage._renderUsersList(document.getElementById('admin-content'))">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 18L18 6M6 6l12 12"/>
                </svg>
                Скасувати
            </button>
            <button class="btn-primary-modern" onclick="AdminPage.createUser()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"/>
                </svg>
                Створити користувача
            </button>
        </div>
    </div>

    <style>
        .user-create-container {
            max-width: 1400px;
            
            padding: 4px;
            animation: fadeSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .create-header {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 32px;
        }

        .back-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            background: transparent;
            border: 1px solid var(--border-light, #e2e8f0);
            border-radius: 40px;
            color: var(--text-secondary, #475569);
            font-weight: 500;
            font-size: 0.95rem;
            transition: all 0.2s;
            cursor: pointer;
        }

        .back-btn:hover {
            background: var(--bg-hover, #f8fafc);
            border-color: var(--border-hover, #cbd5e1);
            transform: translateX(-2px);
        }

        .create-title {
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 0;
            font-size: 1.9rem;
            font-weight: 600;
            letter-spacing: -0.02em;
            color: var(--text-primary, #0f172a);
        }

        .title-icon {
            font-size: 1.8rem;
            line-height: 1;
        }

        /* Grid Layout */
        .create-form-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
        }

        .glass-panel {
            background: var(--surface-card, #ffffff);
            border-radius: 24px;
            padding: 24px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 10px 15px -3px rgba(0, 0, 0, 0.03);
            border: 1px solid var(--border-subtle, #f1f5f9);
            transition: box-shadow 0.3s ease, border-color 0.3s ease;
        }

        .glass-panel:focus-within {
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02);
            border-color: #cbd5e1;
        }

        .section-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
            padding-bottom: 12px;
            border-bottom: 1px dashed var(--border-light, #e2e8f0);
        }

        .section-badge {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            background: var(--brand-light, #e0e7ff);
            color: var(--brand, #4f46e5);
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
        }

        .section-header h4 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-primary, #0f172a);
        }

        .input-group {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .input-row-2col {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
        }

        .input-label {
            display: flex;
            flex-direction: column;
            gap: 6px;
            font-size: 0.9rem;
            font-weight: 500;
            color: var(--text-secondary, #475569);
        }

        .input-label input, 
        .input-label select,
        .custom-select-wrapper select {
            padding: 10px 14px;
            background: var(--bg-input, #ffffff);
            border: 1.5px solid var(--border-input, #e2e8f0);
            border-radius: 16px;
            font-size: 0.95rem;
            color: var(--text-primary, #0f172a);
            transition: all 0.15s ease;
            font-family: inherit;
            outline: none;
        }

        .input-label input:hover {
            border-color: #94a3b8;
        }

        .input-label input:focus {
            border-color: var(--brand, #4f46e5);
            box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.08);
        }

        .input-label input::placeholder {
            color: #94a3b8;
            font-weight: 400;
            opacity: 0.7;
        }

        .required-star {
            color: #ef4444;
            margin-left: 2px;
        }

        .field-hint {
            margin-top: 4px;
            color: #64748b;
            font-size: 0.8rem;
            font-weight: 400;
        }

        /* Gender Picker */
        .gender-picker-modern {
            display: flex;
            gap: 10px;
        }

        .gender-chip {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 0;
            background: var(--bg-chip, #f8fafc);
            border: 1.5px solid var(--border-input, #e2e8f0);
            border-radius: 40px;
            font-weight: 500;
            color: var(--text-secondary, #475569);
            cursor: pointer;
            transition: all 0.15s;
        }

        .gender-chip span {
            font-size: 18px;
        }

        .gender-chip.active {
            background: var(--brand-light, #e0e7ff);
            border-color: var(--brand, #4f46e5);
            color: var(--brand, #4f46e5);
            font-weight: 600;
        }

        /* Buttons Footer */
        .form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 16px;
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid var(--border-light, #e2e8f0);
        }

        .btn-primary-modern, .btn-secondary-modern {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 28px;
            border-radius: 48px;
            font-weight: 600;
            font-size: 1rem;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
            line-height: 1;
        }

        .btn-primary-modern {
            background: var(--brand, #4f46e5);
            color: white;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
        }

        .btn-primary-modern:hover {
            background: #4338ca;
            transform: scale(1.02);
            box-shadow: 0 8px 18px rgba(79, 70, 229, 0.25);
        }

        .btn-secondary-modern {
            background: transparent;
            color: var(--text-secondary, #475569);
            border: 1.5px solid var(--border-light, #e2e8f0);
        }

        .btn-secondary-modern:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
        }

        /* Responsive */
        @media (max-width: 900px) {
            .create-form-grid {
                grid-template-columns: 1fr;
                gap: 16px;
            }
            .create-title {
                font-size: 1.5rem;
            }
        }

        /* Интеграция с CreatableSelect (предполагаем, что он генерит инпуты) */
        .input-label > div[class*="select"] {
            width: 100%;
        }
    </style>
`;

        CreatableSelect.init();
    },

    async createUser() {
        const lastName   = Dom.val('cu-last-name').trim();
        const firstName  = Dom.val('cu-first-name').trim();
        const patronymic = Dom.val('cu-patronymic').trim();
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
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._renderUsersList(document.getElementById('admin-content'))">← Назад</button>
                <h3 style="margin:0">✏️ Редагувати користувача</h3>
            </div>
            <div class="uf-form" style="max-width:520px">
                <div class="uf-section">Аватар</div>
                <div class="uf-row" style="grid-template-columns:128px 1fr;align-items:center">
                    <div class="uf-lbl">Фото</div>
                    <div style="display:flex;align-items:center;gap:1rem">
                        <div style="width:64px;height:64px;border-radius:var(--radius-md);overflow:hidden;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:600;color:var(--text-inverse);flex-shrink:0">
                            ${user.avatar_url ? `<img src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : Fmt.initials(user.full_name)}
                        </div>
                        <span style="font-size:.8rem;color:var(--text-muted)">Аватар змінюється користувачем у власному профілі</span>
                    </div>
                </div>

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
                    <div class="gender-picker">
                        <input type="hidden" id="eu-gender" value="${user.gender || ''}">
                        <button type="button" class="gender-btn${user.gender==='male'?' active':''}" onclick="this.closest('.gender-picker').querySelector('input').value='male';this.closest('.gender-picker').querySelectorAll('.gender-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')"><span class="gender-icon">♂</span>Чоловік</button>
                        <button type="button" class="gender-btn${user.gender==='female'?' active':''}" onclick="this.closest('.gender-picker').querySelector('input').value='female';this.closest('.gender-picker').querySelectorAll('.gender-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')"><span class="gender-icon">♀</span>Жінка</button>
                    </div>
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
                    ${CreatableSelect.html('eu-city', 'cities', cities.map(i=>i.name), user.city||'')}
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
                <button class="btn btn-secondary" onclick="AdminPage._renderUsersList(document.getElementById('admin-content'))">Скасувати</button>
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

    // ── Пагінація ─────────────────────────────────────────────────
    _setPageSize(n) {
        this._pageSize    = n;
        this._pageCurrent = 1;
        // Оновлюємо підсвічування кнопок
        document.querySelectorAll('.page-size-btn').forEach(b => b.classList.toggle('active', +b.textContent === n));
        this._applyPagination();
    },

    _applyPagination() {
        const allRows     = [...document.querySelectorAll('#users-tbody tr')];
        const matched     = allRows.filter(r => r.dataset.filtered !== '0');
        const total       = matched.length;
        const totalPages  = Math.max(1, Math.ceil(total / this._pageSize));
        this._pageCurrent = Math.min(this._pageCurrent, totalPages);
        const start       = (this._pageCurrent - 1) * this._pageSize;
        const end         = start + this._pageSize;

        allRows.forEach(r => { r.style.display = r.dataset.filtered === '0' ? 'none' : ''; });
        matched.forEach((r, i) => { r.style.display = (i >= start && i < end) ? '' : 'none'; });

        const shownEl = document.getElementById('users-shown');
        if (shownEl) shownEl.textContent = Math.min(end, total) - start > 0
            ? `${start + 1}–${Math.min(end, total)}`
            : '0';

        this._renderPagination(total, totalPages);
        this._syncSelectAll();
    },

    _renderPagination(total, totalPages) {
        const el = document.getElementById('users-pagination');
        if (!el) return;
        if (totalPages <= 1) { el.innerHTML = ''; return; }

        const cur = this._pageCurrent;
        const pages = [];
        // Завжди: 1, ..., cur-1, cur, cur+1, ..., last
        const add = p => { if (p >= 1 && p <= totalPages && !pages.includes(p)) pages.push(p); };
        [1, 2, cur - 1, cur, cur + 1, totalPages - 1, totalPages].forEach(add);
        pages.sort((a, b) => a - b);

        let html = '<div class="pagination">';
        html += `<button class="pg-btn" ${cur===1?'disabled':''} onclick="AdminPage._goPage(${cur-1})">‹</button>`;
        let prev = 0;
        for (const p of pages) {
            if (p - prev > 1) html += `<span class="pg-gap">…</span>`;
            html += `<button class="pg-btn${p===cur?' active':''}" onclick="AdminPage._goPage(${p})">${p}</button>`;
            prev = p;
        }
        html += `<button class="pg-btn" ${cur===totalPages?'disabled':''} onclick="AdminPage._goPage(${cur+1})">›</button>`;
        html += '</div>';
        el.innerHTML = html;
    },

    _goPage(p) {
        this._pageCurrent = p;
        this._applyPagination();
        document.querySelector('.table-wrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        const v   = id => document.getElementById(id)?.value || '';
        const f = {
            name:        MultiSelect.getValues('uf-name'),
            job:         MultiSelect.getValues('uf-job'),
            city:        MultiSelect.getValues('uf-city'),
            subdivision: MultiSelect.getValues('uf-subdivision'),
            role:        v('uf-role'),
            label:       MultiSelect.getValues('uf-label'),
            date:        v('uf-date'),
            activity:    v('uf-activity'),
            status:      v('uf-status'),
        };
        // Для порівняння з data-* атрибутами (вони lowercase) — lowercase версії
        const nameLC = f.name.map(x => x.toLowerCase());
        const jobLC  = f.job.map(x => x.toLowerCase());
        const cityLC = f.city.map(x => x.toLowerCase());
        const subLC  = f.subdivision.map(x => x.toLowerCase());
        const lblLC  = f.label.map(x => x.toLowerCase());

        localStorage.setItem('lms_admin_user_filters', JSON.stringify(f));

        let shown = 0;
        document.querySelectorAll('#users-tbody tr').forEach(row => {
            const d = row.dataset;
            const match =
                (nameLC.length === 0 || nameLC.includes(d.name))                          &&
                (jobLC.length  === 0 || jobLC.includes(d.job))                            &&
                (cityLC.length === 0 || cityLC.includes(d.city))                          &&
                (subLC.length  === 0 || subLC.includes(d.subdivision))                    &&
                (!f.role   || d.role   === f.role)                                         &&
                (lblLC.length  === 0 || lblLC.includes(d.label))                          &&
                this._matchTokens(d.date,        f.date)                                  &&
                this._matchTokens(d.activity,    f.activity)                              &&
                (!f.status || d.status === f.status);
            row.dataset.filtered = match ? '1' : '0';
            if (match) shown++;
        });
        this._pageCurrent = 1;
        this._applyPagination();

        // active filters count
        const activeCount = Object.values(f).filter(v => Array.isArray(v) ? v.length > 0 : Boolean(v)).length;
        const badge  = document.getElementById('users-filter-badge');
        const clearBtn = document.getElementById('users-clear-btn');
        if (badge) {
            badge.textContent = `${activeCount} фільтр${activeCount === 1 ? '' : activeCount < 5 ? 'и' : 'ів'} активн${activeCount === 1 ? 'ий' : 'о'}`;
            badge.style.display = activeCount ? '' : 'none';
        }
        if (clearBtn) clearBtn.style.display = activeCount ? '' : 'none';
    },

    _clearUserFilters() {
        ['uf-date','uf-activity'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        ['uf-role','uf-status'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        ['uf-name','uf-job','uf-city','uf-subdivision','uf-label'].forEach(id => MultiSelect.clear(id));
        localStorage.removeItem('lms_admin_user_filters');
        this._applyUserFilters();
    },

    _restoreUserFilters() {
        try {
            const saved = localStorage.getItem('lms_admin_user_filters');
            if (!saved) return;
            const f = JSON.parse(saved);
            const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            set('uf-role',    f.role);
            set('uf-date',    f.date);
            set('uf-activity',f.activity);
            set('uf-status',  f.status);
            if (Array.isArray(f.name)        && f.name.length)        MultiSelect.setValues('uf-name',        f.name);
            if (Array.isArray(f.job)         && f.job.length)         MultiSelect.setValues('uf-job',         f.job);
            if (Array.isArray(f.city)        && f.city.length)        MultiSelect.setValues('uf-city',        f.city);
            if (Array.isArray(f.subdivision) && f.subdivision.length) MultiSelect.setValues('uf-subdivision', f.subdivision);
            if (Array.isArray(f.label)       && f.label.length)       MultiSelect.setValues('uf-label',       f.label);
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

    async _bulkDelete() {
        const toDelete = this._usersAll.filter(u =>
            this._selectedUsers.has(u.id) &&
            u.role !== 'owner' &&
            u.id !== AppState.user?.id
        );
        if (!toDelete.length) {
            Toast.error('Немає кого видаляти', 'Owner та власний акаунт виключені');
            return;
        }
        const adminCount = toDelete.filter(u => u.role === 'admin').length;
        const adminNote  = adminCount && !AppState.isOwner()
            ? `<br><span style="color:var(--danger);font-size:.82rem">⚠️ Адміністраторів (${adminCount}) може видалити лише власник — їх буде пропущено</span>`
            : adminCount
            ? `<br><span style="color:var(--warning);font-size:.82rem">Серед вибраних ${adminCount} адміністратор(ів)</span>`
            : '';

        const ok = await Modal.confirm({
            title: '🗑 Видалити користувачів',
            message: `Ви впевнені, що хочете <strong>остаточно видалити ${toDelete.length} користувач(ів)</strong>?
                      ${adminNote}
                      <br><br>Дія незворотна.${AppState.isOwner() ? ' Дані будуть збережені в Кошику на 7 днів.' : ''}`,
            confirmText: `Видалити ${toDelete.length}`,
            danger: true
        });
        if (!ok) return;

        Loader.show();
        let done = 0, failed = 0;
        for (const u of toDelete) {
            try {
                const { error } = await supabase.rpc('admin_user_delete', { p_user_id: u.id });
                if (error) throw error;
                done++;
            } catch(e) {
                failed++;
                console.warn('Delete failed for', u.email, e.message);
            }
        }
        Loader.hide();

        if (done)   Toast.success('Видалено', `${done} користувач(ів) видалено`);
        if (failed) Toast.error('Помилки', `${failed} не вдалося видалити`);
        this._renderUsersList(document.getElementById('admin-content'));
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
            'Іваненко;Олег;Петрович;o.ivanenko;oleg@company.com;pass123;user;male;+380501234567;1990-05-15;Київ;Менеджер;Відділ продажів;Новий',
            'Коваль;Марія;Андріївна;m.koval;maria@company.com;pass456;teacher;female;+380671112233;1985-11-20;Львів;Викладач;HR;;',
            'Сидоренко;Андрій;;a.sydorenko;andrii@company.com;secure99;admin;male;+380931234567;;Харків;;;',
            'Бондаренко;Олена;;o.bondar;olena@company.com;qwerty1;smm;female;;;Одеса;SMM-спеціаліст;Маркетинг;',
            'Мельник;Тарас;Іванович;;taras@company.com;mypass1;user;male;;;;;; '
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
        input.value = ''; // reset so the same file can be re-selected
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
            'ім\'я':'first_name','ім\u2019я':'first_name','имя':'first_name','firstname':'first_name','first_name':'first_name',
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
            if (row.password && row.password.length < 6) row._errors.push('Пароль (мін. 6 символів)');
            const validRoles = ['owner','admin','smm','teacher','user'];
            if (row.role && !validRoles.includes(row.role)) row._errors.push('Роль (невірне значення)');
            if (row.gender && !['male','female'].includes(row.gender)) row._errors.push('Стать (male або female)');
            if (row.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.birth_date)) row._errors.push('Дата нар. (формат РРРР-ММ-ДД)');
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
        const errors = [];
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
                const { data: userId, error } = await supabase.rpc('admin_user_create', {
                    p_email:        row.email,
                    p_password:     row.password,
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
                errors.push(`Рядок ${row._line} (${row.email}): ${e?.message || 'невідома помилка'}`);
            }
            renderProgress();
        }

        body.innerHTML = `
            <div style="text-align:center;padding:1.5rem 0">
                <div style="font-size:2.5rem;margin-bottom:.75rem">${failed === 0 ? '✅' : '⚠️'}</div>
                <div style="font-weight:600;font-size:1.1rem;margin-bottom:.5rem">Імпорт завершено</div>
                <div style="color:var(--success);margin-bottom:.25rem">Створено: ${done}</div>
                ${failed ? `<div style="color:var(--danger);margin-bottom:.75rem">Помилок: ${failed}</div>` : ''}
            </div>
            ${errors.length ? `
            <div style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-md);padding:.5rem .75rem">
                ${errors.map(e => `<div style="font-size:.75rem;color:var(--danger);padding:.2rem 0;border-bottom:1px solid var(--border-light)">${e}</div>`).join('')}
            </div>` : ''}`;
        footer.innerHTML = `<button class="btn btn-primary" onclick="Modal.close();AdminPage._renderUsersList(document.getElementById('admin-content'))">Готово</button>`;
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
            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem">
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._renderUsers(document.getElementById('admin-content'))">← Назад</button>
                <h3 style="margin:0">📋 Довідник</h3>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem">
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

    // ── Кошик (тільки власник) ────────────────────────────────────
    async _renderTrash(el) {
        if (!AppState.isOwner()) {
            el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><h3>Доступ лише для власника</h3></div>`;
            return;
        }
        el.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        const { data, error } = await supabase.rpc('get_trash_items');
        if (error) {
            el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${error.message}</h3></div>`;
            return;
        }
        const items = data || [];

        const typeLabel = { page: '🖥 Сторінки', news: '📰 Новини', resource: '📎 Ресурси' };
        const grouped = {};
        items.forEach(i => { (grouped[i.type] = grouped[i.type] || []).push(i); });

        const daysLeft = exp => {
            const d = Math.ceil((new Date(exp) - Date.now()) / 86400000);
            return d <= 1 ? '<span style="color:var(--danger)">< 1 дня</span>'
                 : d <= 2 ? `<span style="color:var(--warning)">${d} дні</span>`
                 : `<span style="color:var(--text-muted)">${d} днів</span>`;
        };

        const rowHtml = item => {
            const d = item.item_data;
            const title = d.title || d.name || item.item_id;
            return `
                <tr>
                    <td style="font-size:.85rem;font-weight:500">${title}</td>
                    <td style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${Fmt.datetime(item.deleted_at)}</td>
                    <td style="font-size:.82rem;font-weight:500;white-space:nowrap">${item.deleted_by_name}</td>
                    <td style="font-size:.78rem;white-space:nowrap">${daysLeft(item.expires_at)}</td>
                    <td style="white-space:nowrap">
                        <button class="btn btn-ghost btn-sm" onclick="AdminPage._previewTrashItem(${JSON.stringify(item).replace(/"/g,'&quot;')})">👁 Перегляд</button>
                        <button class="btn btn-primary btn-sm" style="margin-left:.3rem" onclick="AdminPage._restoreTrashItem('${item.id}')">↩ Відновити</button>
                        <button class="btn btn-danger btn-sm" style="margin-left:.3rem" onclick="AdminPage._deleteTrashItem('${item.id}')">🗑 Видалити</button>
                    </td>
                </tr>`;
        };

        if (!items.length) {
            el.innerHTML = `
                <div class="page-header">
                    <div class="page-title"><h1>🗑 Кошик</h1><p>Видалені об'єкти зберігаються 7 днів</p></div>
                </div>
                <div class="empty-state"><div class="empty-icon">🗑</div><h3>Кошик порожній</h3></div>`;
            return;
        }

        el.innerHTML = `
            <div class="page-header">
                <div class="page-title"><h1>🗑 Кошик</h1><p>Видалені об'єкти зберігаються 7 днів. Всього: ${items.length}</p></div>
            </div>
            ${Object.entries(grouped).map(([type, list]) => `
                <div style="margin-bottom:2rem">
                    <h3 style="font-size:.95rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem">${typeLabel[type] || type} (${list.length})</h3>
                    <div class="table-wrapper">
                        <table>
                            <thead><tr>
                                <th>Назва</th>
                                <th>Видалено</th>
                                <th>Ким</th>
                                <th>Залишилось</th>
                                <th></th>
                            </tr></thead>
                            <tbody>${list.map(rowHtml).join('')}</tbody>
                        </table>
                    </div>
                </div>`).join('')}`;
    },

    _previewTrashItem(item) {
        const d = item.item_data;
        const typeNames = { page: 'Сторінка', news: 'Новина', resource: 'Ресурс', user: 'Користувач' };

        const deletedByBanner = `
            <div style="display:flex;align-items:center;gap:.75rem;padding:.55rem .9rem;background:var(--bg-raised);border-radius:var(--radius);font-size:.82rem;margin-bottom:1rem;border-left:3px solid var(--danger)">
                <span style="color:var(--text-muted)">Видалив:</span>
                <strong>${item.deleted_by_name}</strong>
                <span style="color:var(--text-muted)">${Fmt.datetime(item.deleted_at)}</span>
            </div>`;

        let body = deletedByBanner;
        let title = typeNames[item.type] || item.type;

        if (item.type === 'page') {
            title = `🖥 ${d.title || 'Сторінка'}`;
            body += d.html_content
                ? `<iframe srcdoc="${d.html_content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,'').replace(/"/g,'&quot;')}"
                       style="width:100%;height:520px;border:1px solid var(--border);border-radius:var(--radius);background:#fff"
                       sandbox="allow-same-origin"></iframe>`
                : `<div style="text-align:center;padding:3rem;color:var(--text-muted)">Вміст відсутній</div>`;

        } else if (item.type === 'news') {
            title = `📰 ${d.title || 'Новина'}`;
            const cover = d.cover_url ? `<img src="${d.cover_url}" style="width:100%;max-height:220px;object-fit:cover;border-radius:var(--radius);margin-bottom:1rem">` : '';
            body += `
                <div style="font-family:var(--font-sans,sans-serif)">
                    ${cover}
                    <h2 style="font-size:1.3rem;font-weight:700;margin:0 0 .5rem">${d.title || ''}</h2>
                    ${d.excerpt ? `<p style="color:var(--text-muted);font-size:.875rem;margin:0 0 1rem;font-style:italic">${d.excerpt}</p>` : ''}
                    <div style="font-size:.875rem;line-height:1.7;max-height:360px;overflow-y:auto">${d.content || '<em style="color:var(--text-muted)">Вміст відсутній</em>'}</div>
                </div>`;

        } else if (item.type === 'resource') {
            const icons = { pdf:'📄', video:'🎬', link:'🔗', scorm:'📦', file:'📎' };
            title = `${icons[d.type] || '📎'} ${d.title || 'Ресурс'}`;
            const link = d.url || d.file_url;
            body += `
                <div style="display:flex;flex-direction:column;gap:.75rem">
                    <div style="display:flex;align-items:center;gap:1rem;padding:1rem;background:var(--bg-raised);border-radius:var(--radius-lg);border:1px solid var(--border)">
                        <span style="font-size:2.5rem">${icons[d.type] || '📎'}</span>
                        <div>
                            <div style="font-weight:600;font-size:1rem">${d.title}</div>
                            <div style="font-size:.8rem;color:var(--text-muted)">${d.type?.toUpperCase() || ''}${d.file_size ? ' · ' + (d.file_size/1024).toFixed(0) + ' КБ' : ''}${d.duration_seconds ? ' · ' + Math.round(d.duration_seconds/60) + ' хв' : ''}</div>
                        </div>
                    </div>
                    ${d.description ? `<p style="font-size:.875rem;color:var(--text-secondary);margin:0">${d.description}</p>` : ''}
                    ${link ? `<a href="${link}" target="_blank" class="btn btn-ghost btn-sm" style="align-self:flex-start">🔗 Відкрити файл / посилання</a>` : ''}
                    <div style="font-size:.78rem;color:var(--text-muted)">Категорія: ${d.category || '—'} · Створено: ${Fmt.datetime(d.created_at)}</div>
                </div>`;

        } else if (item.type === 'user') {
            const genderMap = { male:'Чоловіча', female:'Жіноча', other:'Інша' };
            const avatar = d.avatar_url
                ? `<img src="${d.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
                : `<span style="font-size:1.5rem;font-weight:700;color:#fff">${Fmt.initials(d.full_name)}</span>`;
            const row = (icon, label, val) => val ? `
                <div style="display:flex;align-items:flex-start;gap:.6rem;padding:.4rem 0;border-bottom:1px solid var(--border)">
                    <span style="width:1.1rem;text-align:center;flex-shrink:0">${icon}</span>
                    <span style="color:var(--text-muted);font-size:.78rem;white-space:nowrap;min-width:90px">${label}</span>
                    <span style="font-size:.875rem;word-break:break-word">${val}</span>
                </div>` : '';
            title = `👤 ${d.full_name || d.email}`;
            body += `
                <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem">
                    <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
                        ${avatar}
                    </div>
                    <div>
                        <div style="font-size:1.1rem;font-weight:700;margin-bottom:.3rem">${d.full_name || '—'}</div>
                        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                            ${Fmt.roleBadge(d.role)}
                            ${d.label ? `<span class="badge badge-warning" style="font-size:.65rem">${d.label}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div style="border-top:1px solid var(--border)">
                    ${row('✉️','Email', d.email)}
                    ${row('🔑','Логін', d.login)}
                    ${row('📞','Телефон', d.phone)}
                    ${row('👤','Стать', genderMap[d.gender])}
                    ${row('🎂','Дата нар.', d.birth_date ? Fmt.dateShort(d.birth_date) : null)}
                    ${row('💼','Посада', d.job_position)}
                    ${row('🏢','Підрозділ', d.subdivision)}
                    ${row('📍','Місто', d.city)}
                    ${row('📅','Реєстрація', Fmt.datetime(d.created_at))}
                    ${d.bio ? `<div style="padding:.6rem 0"><div style="color:var(--text-muted);font-size:.78rem;margin-bottom:.3rem">Про себе</div><div style="font-size:.875rem;line-height:1.5">${d.bio}</div></div>` : ''}
                </div>`;
        }

        Modal.open({
            title,
            size: 'lg',
            body,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Закрити</button>
                <button class="btn btn-primary" onclick="Modal.close();AdminPage._restoreTrashItem('${item.id}')">↩ Відновити</button>`
        });
    },

    async _restoreTrashItem(trashId) {
        const ok = await Modal.confirm({
            title: '↩ Відновити',
            message: 'Відновити цей об\'єкт?',
            confirmText: 'Відновити'
        });
        if (!ok) return;

        Loader.show();
        let result;
        try {
            const { data, error } = await supabase.rpc('trash_restore', { p_trash_id: trashId });
            if (error) throw error;
            result = data;
        } catch(e) {
            Loader.hide();
            Toast.error('Помилка відновлення', e.message);
            return;
        }
        Loader.hide(); // ховаємо до показу модалки і перерендеру

        if (result?.type === 'user') {
            Toast.success('Відновлено', `${result.full_name || ''} — пароль збережено`);
        } else {
            Toast.success('Відновлено');
        }

        await this._renderTrash(document.getElementById('admin-content'));
    },

    async _deleteTrashItem(trashId) {
        const ok = await Modal.confirm({
            title: 'Видалити назавжди?',
            message: 'Об\'єкт буде видалено остаточно. Відновити його буде неможливо.',
            confirmText: 'Видалити',
            cancelText: 'Скасувати',
            danger: true
        });
        if (!ok) return;
        Loader.show();
        try {
            const { error } = await supabase.from('trash').delete().eq('id', trashId);
            if (error) throw error;
            Toast.success('Видалено назавжди');
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
        await this._renderTrash(document.getElementById('admin-content'));
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
