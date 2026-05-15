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
                ${canManageUsers ? `<button class="tab" data-tab="users" onclick="AdminPage.switchTab('users', this)">👥 Користувачі</button>` : ''}
                <button class="tab" data-tab="courses" onclick="AdminPage.switchTab('courses', this)">📚 Курси</button>
                <button class="tab" data-tab="tests" onclick="AdminPage.switchTab('tests', this)">📝 Тести</button>
                <button class="tab" data-tab="news" onclick="AdminPage.switchTab('news', this)">📰 Новини</button>
                <button class="tab" data-tab="enrollments" onclick="AdminPage.switchTab('enrollments', this)">🎓 Записи</button>
                ${canManageUsers ? `<button class="tab" data-tab="access-groups" onclick="AdminPage.switchTab('access-groups', this)">🔐 Групи доступу</button>` : ''}
                ${AppState.isOwner() ? `<button class="tab" data-tab="label-access" onclick="AdminPage.switchTab('label-access', this)"><i class="fa-solid fa-lock"></i> Обмеження доступу</button>` : ''}
                ${AppState.isOwner() ? `<button class="tab" data-tab="trash" onclick="AdminPage.switchTab('trash', this)"><i class="fa-solid fa-trash"></i> Кошик</button>` : ''}
                ${AppState.isOwner() ? `<button class="tab" data-tab="logs" onclick="AdminPage.switchTab('logs', this)">📋 Логи</button>` : ''}
            </div>

            <div id="admin-content"></div>`;

        this._tab = params.tab || (canManageUsers ? 'users' : 'courses');
        this._editCourseId = params.edit || null;
        const activeBtn = container.querySelector(`.tab[data-tab="${this._tab}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        await this._loadTab();
    },

    async switchTab(tab, el) {
        if ((tab === 'users' || tab === 'access-groups' || tab === 'label-access') && !AppState.isAdmin()) {
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
                case 'access-groups': await AccessGroupsPage.renderTab(el);  break;
                case 'label-access':  await LabelAccessPage.init(el);              break;
                case 'trash':         await this._renderTrash(el);                  break;
                case 'logs':          await this._renderLogs(el);                   break;
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
        // persist sort alongside filters
        try {
            const saved = JSON.parse(localStorage.getItem('lms_admin_user_filters') || '{}');
            saved._sort = { field: s.field, dir: s.dir };
            localStorage.setItem('lms_admin_user_filters', JSON.stringify(saved));
        } catch(_) {}
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
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._renderUsers(document.getElementById('admin-content'))" style="display:inline-flex;align-items:center;gap:.35rem"><i class="fa-solid fa-angle-left"></i> Назад</button>
                <h3 style="margin:0">👥 Всі користувачі</h3>
            </div>
            <div style="display:flex;gap:.75rem;margin-bottom:.75rem;flex-wrap:wrap;align-items:center;justify-content:space-between">
                <div style="display:flex;gap:.75rem;flex-wrap:wrap">
                    <button class="btn btn-primary" onclick="AdminPage.openCreateUser()"><i class="fa-solid fa-plus"></i> Створити користувача</button>
                    <button class="btn btn-ghost"   onclick="AdminPage.importUsers()"><i class="fa-solid fa-upload"></i> Імпорт</button>
                    <button class="btn btn-success"  onclick="AdminPage.exportUsers(${JSON.stringify(list).replace(/"/g,'&quot;')})"><i class="fa-solid fa-download"></i> Експорт</button>
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
                            <th style="width:220px"><div class="ms-filter-label" onclick="AdminPage._sortByLabel('name')">ПІБ ${AdminPage._sortBtn('name')}</div><input type="text" id="uf-name" placeholder="Пошук..." oninput="AdminPage._applyUserFilters()"></th>
                            <th style="width:170px"><div class="ms-filter-label" onclick="AdminPage._sortByLabel('job')">Посада ${AdminPage._sortBtn('job')}</div>${MultiSelect.html('uf-job', 'Всі...')}</th>
                            <th style="width:120px"><div class="ms-filter-label" onclick="AdminPage._sortByLabel('city')">Місто ${AdminPage._sortBtn('city')}</div>${MultiSelect.html('uf-city', 'Всі...')}</th>
                            <th style="width:150px"><div class="ms-filter-label" onclick="AdminPage._sortByLabel('subdivision')">Підрозділ ${AdminPage._sortBtn('subdivision')}</div>${MultiSelect.html('uf-subdivision', 'Всі...')}</th>
                            <th style="width:97px">
                                <div class="ms-filter-label" onclick="AdminPage._sortByLabel('role')">Роль ${AdminPage._sortBtn('role')}</div>
                                <select id="uf-role" onchange="AdminPage._applyUserFilters()">
                                    <option value="">Всі</option>
                                    <option value="owner">👑 Admin</option>
                                    <option value="admin">👑 Адміністратор</option>
                                    <option value="manager">👑 Керівник</option>
                                    <option value="smm">📰 SMM</option>
                                    <option value="teacher">Викладач</option>
                                    <option value="user">Користувач</option>
                                </select>
                            </th>
                            <th style="width:110px"><div class="ms-filter-label" onclick="AdminPage._sortByLabel('label')">Мітка ${AdminPage._sortBtn('label')}</div>${MultiSelect.html('uf-label', 'Всі...')}</th>
                            <th style="width:90px"><div class="ms-filter-label" onclick="AdminPage._sortByLabel('date')">Реєстрація ${AdminPage._sortBtn('date')}</div><input id="uf-date" type="text" placeholder="дд.мм.рррр" oninput="AdminPage._applyUserFilters()"></th>
                            <th style="width:90px"><div class="ms-filter-label" onclick="AdminPage._sortByLabel('activity')">Активність ${AdminPage._sortBtn('activity')}</div><input id="uf-activity" type="text" placeholder="дд.мм.рррр" oninput="AdminPage._applyUserFilters()"></th>
                            <th style="width:50px;vertical-align:bottom;padding-top:.7rem;text-align:center">
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
                <button class="btn btn-danger btn-sm" onclick="AdminPage._bulkDelete()">​<i class="fa-solid fa-trash"></i> Видалити</button>
                <div class="bulk-sep"></div>
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._clearSelection()">✕ Скасувати вибір</button>
            </div>`;

        // Збираємо унікальні значення з завантажених даних
        const uniq = (field) => [...new Set(list.map(u => u[field]).filter(Boolean))].sort((a,b) => a.localeCompare(b,'uk'));
        MultiSelect.init('uf-job',         uniq('job_position'));
        MultiSelect.init('uf-city',        uniq('city'));
        MultiSelect.init('uf-subdivision', uniq('subdivision'));
        MultiSelect.init('uf-label',       uniq('label'));

        // Реагуємо на зміни MultiSelect
        ['uf-job','uf-city','uf-subdivision','uf-label'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => AdminPage._applyUserFilters());
        });

        this._restoreUserFilters();
    },

    _userRow(u) {
        const isOwnerRow  = u.role === 'owner';
        const isSelf      = u.id === AppState.user?.id;
        const canEdit     = !isOwnerRow || AppState.isOwner();
        const canHide     = (AppState.isAdmin()) && !isSelf && !isOwnerRow;

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
                            <div style="font-weight:600;font-size:.82rem;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;text-decoration-color:var(--border-light);white-space:nowrap">
                                ${Fmt.esc(u.full_name) || '—'}
                                ${u.is_hidden ? '<span style="font-size:.6rem;padding:1px 5px;background:rgba(156,163,175,.15);color:var(--text-muted);border-radius:4px;margin-left:4px;font-weight:500">🙈 прихований</span>' : ''}
                            </div>
                            <div style="font-size:.72rem;color:var(--text-muted)">${Fmt.esc(u.email)}</div>
                        </div>
                    </div>
                </td>
                <td style="font-size:.8rem">${Fmt.esc(u.job_position) || '<span style="color:var(--text-muted)">—</span>'}</td>
                <td style="font-size:.8rem;white-space:nowrap">${Fmt.esc(u.city) || '<span style="color:var(--text-muted)">—</span>'}</td>
                <td style="font-size:.8rem">${Fmt.esc(u.subdivision) || '<span style="color:var(--text-muted)">—</span>'}</td>
                <td>${Fmt.roleBadge(u.role)}</td>
                <td>${u.label === 'intern' ? `<span class="badge badge-success" style="font-size:.65rem">🌱 Стажер</span>` : u.label === 'mentor' ? `<span class="badge badge-warning" style="font-size:.65rem">⭐ Наставник</span>` : '<span style="color:var(--text-muted);font-size:.8rem">—</span>'}</td>
                <td style="color:var(--text-muted);font-size:.78rem;white-space:nowrap">${Fmt.dateShort(u.created_at)}</td>
                <td style="font-size:.78rem;white-space:nowrap">${u.last_sign_in_at
                    ? `<span style="color:var(--text-secondary)">${Fmt.dateShort(u.last_sign_in_at)}</span>`
                    : '<span style="color:var(--text-muted)">—</span>'}</td>
               
                <td>
                    <div style="display:flex;flex-direction:column;gap:.25rem;align-items:flex-start">
                        ${canEdit ? `<button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;gap:.4rem" onclick="AdminPage.openEditUser(${JSON.stringify(u).replace(/"/g,'&quot;')})"><i class="fa-solid fa-pen"></i></button>` : ''}
                        ${canHide ? `
                            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:flex-start;gap:.4rem" onclick="AdminPage.toggleHidden('${u.id}',${!!u.is_hidden})" title="${u.is_hidden ? 'Показати в контактах' : 'Приховати з контактів'}">
                                ${u.is_hidden ? '👁' : '🙈'}
                            </button>` : ''}
                    </div>
                </td>
            </tr>`;
    },

    async viewProfile(u) {
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

        // Load existing birthday reminder (only if target has birthday and is not self)
        let bdReminder = null;
        const canSetBdReminder = u.birth_date && u.id !== AppState.user?.id;
        if (canSetBdReminder) {
            const { data } = await supabase
                .from('birthday_reminders')
                .select('*')
                .eq('created_by', AppState.user.id)
                .eq('target_id', u.id)
                .maybeSingle();
            bdReminder = data;
        }

        Modal.open({
            title: 'Профіль користувача',
            size: 'md',
            body: `
                <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem">
                    <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
                        ${avatar}
                    </div>
                    <div>
                        <div style="font-size:1.1rem;font-weight:700;margin-bottom:.3rem">${Fmt.esc(u.full_name) || '—'}</div>
                        <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                            ${Fmt.roleBadge(u.role)}
                            ${u.label === 'intern' ? `<span class="badge badge-success" style="font-size:.65rem">🌱 Стажер</span>` : u.label === 'mentor' ? `<span class="badge badge-warning" style="font-size:.65rem">⭐ Наставник</span>` : ''}
                            <span class="badge ${u.is_active !== false ? 'badge-success' : 'badge-muted'}">${u.is_active !== false ? 'Активний' : 'Заблокований'}</span>
                        </div>
                    </div>
                </div>
                <div style="border-top:1px solid var(--border)">
                    ${row('✉️', 'Email',      Fmt.esc(u.email))}
                    ${row('🔑', 'Логін',      Fmt.esc(u.login) || '—')}
                    ${row('📞', 'Телефон',    Fmt.esc(u.phone))}
                    ${row('👤', 'Стать',      genderMap[u.gender])}
                    ${row('🎂', 'Дата нар.',  u.birth_date ? Fmt.dateShort(u.birth_date) : null)}
                    ${row('💼', 'Посада',     Fmt.esc(u.job_position))}
                    ${row('🏢', 'Підрозділ',  Fmt.esc(u.subdivision))}
                    ${row('📍', 'Місто',      Fmt.esc(u.city))}
                    ${row('📅', 'Реєстрація', Fmt.datetime(u.created_at))}
                    ${u.bio ? `
                    <div style="padding:.6rem 0">
                        <div style="color:var(--text-muted);font-size:.78rem;margin-bottom:.3rem">Про себе</div>
                        <div style="font-size:.875rem;color:var(--text-secondary);line-height:1.5">${Fmt.esc(u.bio)}</div>
                    </div>` : ''}
                </div>
                ${canSetBdReminder ? this._birthdayReminderBlock(u, bdReminder) : ''}`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Закрити</button>
                ${AppState.isAdmin() && u.id !== AppState.user?.id && u.role !== 'owner' ? `
                    <button class="btn btn-ghost" style="color:${u.is_active !== false ? 'var(--danger)' : 'var(--success)'}"
                        onclick="Modal.close();AdminPage.toggleBlock('${u.id}',${u.is_active !== false})">
                        ${u.is_active !== false ? '🔒 Заблокувати' : '🔓 Розблокувати'}
                    </button>` : ''}
                ${AppState.isAdmin() && u.id !== AppState.user?.id ? `<button class="btn btn-ghost" onclick="Modal.close();AppState.impersonate(${JSON.stringify(u).replace(/"/g,'&quot;')})" title="Переглянути інтерфейс від імені цього користувача"><i class="fa-solid fa-eye"></i> Переглянути як</button>` : ''}
                ${(u.role !== 'owner' || AppState.isOwner()) ? `<button class="btn btn-primary" onclick="Modal.close();AdminPage.openEditUser(${JSON.stringify(u).replace(/"/g,'&quot;')})"><i class="fa-solid fa-pen"></i> Редагувати</button>` : ''}
            `
        });
    },

    _birthdayReminderBlock(u, reminder) {
        const bd = new Date(u.birth_date);
        const today = new Date(); today.setHours(0,0,0,0);
        let upcoming = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (upcoming <= today) upcoming.setFullYear(today.getFullYear() + 1);
        const daysUntil = Math.round((upcoming - today) / 86400000);
        const bdLabel   = upcoming.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long' });

        const chips = [1, 3, 5, 7, 14, 30].map(d => {
            const active = reminder ? reminder.days_before === d : d === 7;
            return `<button class="bd-chip${active ? ' bd-chip-active' : ''}" data-d="${d}"
                onclick="document.querySelectorAll('.bd-chip').forEach(b=>{b.classList.remove('bd-chip-active')});this.classList.add('bd-chip-active');document.getElementById('bd-days-val').value=this.dataset.d">
                ${d} дн.
            </button>`;
        }).join('');

        return `
        <div style="margin-top:14px;padding:14px 16px;background:var(--bg-raised);border-radius:16px;border:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                <span style="font-size:1.4rem">🎂</span>
                <div>
                    <div style="font-weight:600;font-size:.9rem;color:var(--text-primary)">Нагадування про день народження</div>
                    <div style="font-size:.75rem;color:var(--text-muted)">${bdLabel} · через ${daysUntil} дн.</div>
                </div>
                ${reminder ? `<button onclick="AdminPage._removeBirthdayReminder('${reminder.id}')"
                    style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:8px;padding:4px 10px;cursor:pointer;font-size:.75rem;color:var(--text-muted)">Видалити</button>` : ''}
            </div>
            ${reminder ? `
            <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:10px">
                <span style="font-size:1rem">✅</span>
                <span style="font-size:.875rem;color:#10b981;font-weight:500">Нагадування за ${reminder.days_before} дн. до дня народження</span>
            </div>
            <div style="margin-top:10px">
                <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:6px">Змінити кількість днів:</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                    ${chips}
                    <input type="hidden" id="bd-days-val" value="${reminder.days_before}">
                    <button data-n="${Fmt.esc(u.full_name||'')}" onclick="AdminPage._saveBirthdayReminder('${u.id}',this.dataset.n)"
                        style="margin-left:auto;padding:6px 14px;background:var(--primary);color:#fff;border:none;border-radius:40px;font-size:.82rem;font-weight:600;cursor:pointer">Оновити</button>
                </div>
            </div>` : `
            <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:8px">Отримати сповіщення за:</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                ${chips}
                <input type="hidden" id="bd-days-val" value="7">
                <button data-n="${Fmt.esc(u.full_name||'')}" onclick="AdminPage._saveBirthdayReminder('${u.id}',this.dataset.n)"
                    style="margin-left:auto;padding:6px 14px;background:var(--primary);color:#fff;border:none;border-radius:40px;font-size:.82rem;font-weight:600;cursor:pointer"><i class="fa-regular fa-floppy-disk"></i> Зберегти</button>
            </div>`}
        </div>
        <style>
        .bd-chip{padding:5px 12px;border:1.5px solid var(--border);border-radius:40px;background:var(--bg-surface);color:var(--text-secondary);font-size:.8rem;font-weight:500;cursor:pointer;transition:all .15s}
        .bd-chip:hover{border-color:var(--primary);color:var(--primary)}
        .bd-chip-active{background:var(--primary-glow);border-color:var(--primary);color:var(--primary);font-weight:600}
        </style>`;
    },

    async _saveBirthdayReminder(targetId, targetName) {
        const days = parseInt(document.getElementById('bd-days-val')?.value || '7');
        Loader.show();
        try {
            const { error } = await supabase.from('birthday_reminders').upsert({
                created_by:    AppState.user.id,
                target_id:     targetId,
                days_before:   days,
                is_active:     true,
                notified_year: null,
            }, { onConflict: 'created_by,target_id' });
            if (error) throw error;
            Toast.success('Нагадування збережено', `За ${days} дн. до дня народження ${targetName}`);
            Modal.close();
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _removeBirthdayReminder(reminderId) {
        const { error } = await supabase.from('birthday_reminders').delete().eq('id', reminderId);
        if (error) { Toast.error('Помилка', error.message); return; }
        Toast.success('Нагадування видалено');
        Modal.close();
    },

    async changeRole(userId, role) {
        if (role === 'owner') {
            Toast.error('Помилка', 'Для передачі прав власника скористайтесь кнопкою 👑');
            return;
        }
        try {
            await API.profiles.updateRole(userId, role);
            AuditLog.write('role_change', 'user', userId, { role });
            Toast.success('Роль змінено');
            this._renderUsersList(document.getElementById('admin-content'));
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
            AuditLog.write('ownership_transfer', 'user', toUserName);
            Toast.success('Права власника передано', toUserName);
            UI.renderNavigation(AppState.profile?.role);
            this._renderUsersList(document.getElementById('admin-content'));
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
            this._renderUsersList(document.getElementById('admin-content'));
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async toggleHidden(userId, isHidden) {
        try {
            await API.profiles.update(userId, { is_hidden: !isHidden });

            // Update cache
            const u = this._usersAll.find(u => u.id === userId);
            if (u) u.is_hidden = !isHidden;

            // Repaint just this row
            const row = document.getElementById(`urow-${userId}`);
            if (row && u) row.outerHTML = this._userRow(u);

            Toast.success(!isHidden ? 'Профіль приховано з контактів' : 'Профіль показано в контактах');
        } catch(e) { Toast.error('Помилка', e.message); }
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
        const [{ cities, positions, subdivisions, users }, allDovirenosti] = await Promise.all([
            this._loadRefData(),
            API.dovirenosti.getAll().catch(() => [])
        ]);

        const mgItems = users
            .filter(u => u.role === 'manager')
            .map(u => ({ value: u.id, label: u.full_name + (u.job_position ? ' · ' + u.job_position : '') }));
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
                        <input id="cu-last-name" type="text" placeholder="" autocomplete="off"
                               oninput="AdminPage._autoLogin()">
                    </label>
                    <label class="input-label">
                        <span>Ім'я <span class="required-star">*</span></span>
                        <input id="cu-first-name" type="text" placeholder="" autocomplete="off"
                               oninput="AdminPage._autoLogin()">
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
                            <input id="cu-birthdate" type="date" value="2000-01-01" oninput="AdminPage._autoPassword()" onpaste="Fmt.parseDatePaste(event,this)">
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
                        <div style="position:relative">
                            <input id="cu-password" type="password" placeholder="••••••••" autocomplete="new-password" style="width:100%;box-sizing:border-box;padding-right:42px">
                            <button type="button" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px;display:flex;align-items:center"
                                onclick="const i=document.getElementById('cu-password');i.type=i.type==='password'?'text':'password';this.innerHTML=i.type==='password'?'<i class=&quot;fa-solid fa-eye&quot;></i>':'<i class=&quot;fa-solid fa-eye-slash&quot;></i>'">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                        </div>
                        <small class="field-hint">Мінімум 6 символів</small>
                    </label>
                    <label class="input-label">
                        <span>Роль</span>
                        <div class="custom-select-wrapper">
                            <select id="cu-role">
                                <option value="user">👤 Користувач</option>
                                <option value="teacher">📚 Викладач</option>
                                <option value="smm">📱 SMM-менеджер</option>
                                <option value="manager">👔 Керівник</option>
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
                        <span>Довіреність</span>
                        ${CreatableMultiSelect.html('cu-dovirenosti')}
                    </label>
                    <div class="input-row-2col">
                        <label class="input-label"><span>Дата оформлення</span><input id="cu-hired-at" type="date" onpaste="Fmt.parseDatePaste(event,this)"></label>
                        <label class="input-label"><span>На посаді з</span><input id="cu-position-since" type="date" onpaste="Fmt.parseDatePaste(event,this)"></label>
                    </div>
                    <label class="input-label">
                        <span>Мітка</span>
                        <div class="custom-select-wrapper">
                            <select id="cu-label">
                                <option value="">— Без мітки —</option>
                                <option value="intern">🌱 Стажер</option>
                                <option value="mentor">⭐ Наставник</option>
                            </select>
                        </div>
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
            border: 1px solid var(--border);
            border-radius: 40px;
            color: var(--text-secondary);
            font-weight: 500;
            font-size: 0.95rem;
            transition: all 0.2s;
            cursor: pointer;
        }

        .back-btn:hover {
            background: var(--bg-hover);
            border-color: var(--border-light);
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
            color: var(--text-primary);
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
            background: var(--bg-surface);
            border-radius: 24px;
            padding: 24px;
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border);
            transition: box-shadow 0.3s ease, border-color 0.3s ease;
        }

        .glass-panel:focus-within {
            box-shadow: var(--shadow-md);
            border-color: var(--border-light);
        }

        .section-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
            padding-bottom: 12px;
            border-bottom: 1px dashed var(--border);
        }

        .section-badge {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            background: var(--primary-glow);
            color: var(--primary);
            border-radius: 12px;
            font-weight: 700;
            font-size: 14px;
        }

        .section-header h4 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-primary);
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
            color: var(--text-secondary);
        }

        .input-label input,
        .input-label select,
        .custom-select-wrapper select {
            padding: 10px 14px;
            background: var(--bg-raised);
            border: 1.5px solid var(--border);
            border-radius: 16px;
            font-size: 0.95rem;
            color: var(--text-primary);
            transition: all 0.15s ease;
            font-family: inherit;
            outline: none;
        }

        .input-label input:hover {
            border-color: var(--border-light);
        }

        .input-label input:focus,
        .input-label select:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 4px var(--primary-glow);
        }

        .input-label input::placeholder {
            color: var(--text-muted);
            font-weight: 400;
            opacity: 0.7;
        }

        .required-star {
            color: var(--danger);
            margin-left: 2px;
        }

        .field-hint {
            margin-top: 4px;
            color: var(--text-muted);
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
            background: var(--bg-raised);
            border: 1.5px solid var(--border);
            border-radius: 40px;
            font-weight: 500;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.15s;
        }

        .gender-chip span {
            font-size: 18px;
        }

        .gender-chip.active {
            background: var(--primary-glow);
            border-color: var(--primary);
            color: var(--primary);
            font-weight: 600;
        }

        /* Buttons Footer */
        .form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 16px;
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid var(--border);
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
            background: var(--primary);
            color: white;
            box-shadow: 0 4px 12px var(--primary-glow);
        }

        .btn-primary-modern:hover {
            background: var(--primary-dark);
            transform: scale(1.02);
            box-shadow: 0 8px 18px var(--primary-glow);
        }

        .btn-secondary-modern {
            background: transparent;
            color: var(--text-secondary);
            border: 1.5px solid var(--border);
        }

        .btn-secondary-modern:hover {
            background: var(--bg-hover);
            border-color: var(--border-light);
        }

        /* Responsive */
        @media (max-width: 1000px) {
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
        CreatableMultiSelect.init('cu-dovirenosti', allDovirenosti.map(d => ({ id: d.id, name: d.name })), []);
    },

    _autoPassword() {
        const val = Dom.val('cu-birthdate');
        if (!val) return;
        const [y, m, d] = val.split('-');
        if (!y || y.length !== 4) return;
        const pwd = document.getElementById('cu-password');
        if (pwd) pwd.value = d + m + y;
    },

    _autoLogin() {
        const last  = Dom.val('cu-last-name').trim();
        const first = Dom.val('cu-first-name').trim();
        const login = document.getElementById('cu-login');
        if (!login) return;
        const generated = (last + first)
            .replace(/\s+/g, '')
            .replace(/[^a-zA-ZА-ЯҐЄІЇа-яґєії0-9_]/g, '');
        login.value = generated;
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
            // Set fields not supported by admin_user_create RPC
            const extraFields = {
                manager_id:     Dom.val('cu-manager')        || null,
                hired_at:       Dom.val('cu-hired-at')       || null,
                position_since: Dom.val('cu-position-since') || null,
            };
            const labelVal = Dom.val('cu-label').trim();
            if (labelVal) extraFields.label_set_by = AppState.profile?.role;
            await supabase.from('profiles').update(extraFields).eq('id', userId);

            // Auto-assign tests by job_position
            const newPosition = Dom.val('cu-job-position').trim();
            if (newPosition) {
                const { data: autoTests } = await supabase.from('tests')
                    .select('id, auto_assign_positions')
                    .is('course_id', null)
                    .not('auto_assign_positions', 'eq', '{}');
                const matching = (autoTests || []).filter(t =>
                    Array.isArray(t.auto_assign_positions) && t.auto_assign_positions.includes(newPosition)
                );
                if (matching.length) {
                    await supabase.from('test_assignments').upsert(
                        matching.map(t => ({ test_id: t.id, user_id: userId, assigned_by: AppState.user.id, deadline_at: null })),
                        { onConflict: 'test_id,user_id', ignoreDuplicates: true }
                    );
                }
            }

            const dovIds = CreatableMultiSelect.getValues('cu-dovirenosti');
            if (dovIds.length) await API.dovirenosti.setForProfile(userId, dovIds);

            const fullName = [lastName, firstName, patronymic].filter(Boolean).join(' ');
            AuditLog.write('user_create', 'user', fullName, { role });
            Toast.success('Користувача створено');
            const adminEl = document.getElementById('admin-content');
            if (adminEl) await this._renderUsersList(adminEl);
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    async openEditUser(user) {
        const el = document.getElementById('admin-content');
        await ProfilePage.openAsAdmin(el, user, () => this._renderUsersList(el));
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
        html += `<button class="pg-btn" ${cur===1?'disabled':''} onclick="AdminPage._goPage(${cur-1})"><i class="fa-solid fa-angle-left"></i></button>`;
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
            name:        v('uf-name'),
            job:         MultiSelect.getValues('uf-job'),
            city:        MultiSelect.getValues('uf-city'),
            subdivision: MultiSelect.getValues('uf-subdivision'),
            role:        v('uf-role'),
            label:       MultiSelect.getValues('uf-label'),
            date:        v('uf-date'),
            activity:    v('uf-activity'),
            status:      v('uf-status'),
        };
        const nameLC = f.name.toLowerCase().trim();
        const jobLC  = f.job.map(x => x.toLowerCase());
        const cityLC = f.city.map(x => x.toLowerCase());
        const subLC  = f.subdivision.map(x => x.toLowerCase());
        const lblLC  = f.label.map(x => x.toLowerCase());

        // Зберігаємо фільтри, зберігаючи існуючий _sort щоб не затирати його
        try {
            const existing = JSON.parse(localStorage.getItem('lms_admin_user_filters') || '{}');
            const toSave = { ...f };
            if (existing._sort) toSave._sort = existing._sort;
            localStorage.setItem('lms_admin_user_filters', JSON.stringify(toSave));
        } catch(_) {
            localStorage.setItem('lms_admin_user_filters', JSON.stringify(f));
        }

        let shown = 0;
        document.querySelectorAll('#users-tbody tr').forEach(row => {
            const d = row.dataset;
            const match =
                (!nameLC || d.name.includes(nameLC))                                       &&
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
        const ufName = document.getElementById('uf-name'); if (ufName) ufName.value = '';
        ['uf-job','uf-city','uf-subdivision','uf-label'].forEach(id => MultiSelect.clear(id));
        this._sortState = { field: null, dir: 1 };
        document.querySelectorAll('.sort-arrow').forEach(el => el.classList.remove('active'));
        localStorage.removeItem('lms_admin_user_filters');
        this._applyUserFilters();
    },

    _restoreUserFilters() {
    try {
        const saved = localStorage.getItem('lms_admin_user_filters');
        if (!saved) return;
        const f = JSON.parse(saved);
        const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
        set('uf-role',     f.role);
        set('uf-date',     f.date);
        set('uf-activity', f.activity);
        set('uf-status',   f.status);
        if (f.name && typeof f.name === 'string') { const el = document.getElementById('uf-name'); if (el) el.value = f.name; }
        if (Array.isArray(f.job)         && f.job.length)         MultiSelect.setValues('uf-job',         f.job);
        if (Array.isArray(f.city)        && f.city.length)        MultiSelect.setValues('uf-city',        f.city);
        if (Array.isArray(f.subdivision) && f.subdivision.length) MultiSelect.setValues('uf-subdivision', f.subdivision);
        if (Array.isArray(f.label)       && f.label.length)       MultiSelect.setValues('uf-label',       f.label);

        // ── Відновлюємо сортування до застосування фільтрів ──
        if (f._sort?.field) {
            const s = this._sortState;
            s.field = f._sort.field;
            s.dir   = f._sort.dir;
            // Підсвічуємо стрілку
            const btn = document.querySelector(`#sort-btns-${s.field} .sort-${s.dir === 1 ? 'up' : 'down'}`);
            if (btn) btn.classList.add('active');
            // Сортуємо рядки напряму, без виклику _sortUsers (щоб не було скидання)
            const tbody = document.getElementById('users-tbody');
            if (tbody) {
                const rows = [...tbody.querySelectorAll('tr')];
                rows.sort((a, b) => (a.dataset[s.field] || '').localeCompare(b.dataset[s.field] || '', 'uk') * s.dir);
                rows.forEach(r => tbody.appendChild(r));
            }
        }

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
        if (!masterCb.checked) {
            this._selectedUsers.clear();
            document.querySelectorAll('.user-cb').forEach(cb => cb.checked = false);
        } else {
            // Select ALL users matching the current filter (not just visible page)
            this._getFilteredUsers().forEach(u => this._selectedUsers.add(u.id));
            document.querySelectorAll('.user-cb:not([disabled])').forEach(cb => {
                if (this._selectedUsers.has(cb.dataset.uid)) cb.checked = true;
            });
        }
        this._updateBulkBar();
    },

    _getFilteredUsers() {
        const esc    = s => (s || '').toLowerCase().replace(/"/g, '');
        const nameLC = MultiSelect.getValues('uf-name').map(x => x.toLowerCase());
        const jobLC  = MultiSelect.getValues('uf-job').map(x => x.toLowerCase());
        const cityLC = MultiSelect.getValues('uf-city').map(x => x.toLowerCase());
        const subLC  = MultiSelect.getValues('uf-subdivision').map(x => x.toLowerCase());
        const lblLC  = MultiSelect.getValues('uf-label').map(x => x.toLowerCase());
        const role   = document.getElementById('uf-role')?.value   || '';
        const status = document.getElementById('uf-status')?.value || '';
        const date   = document.getElementById('uf-date')?.value   || '';
        const act    = document.getElementById('uf-activity')?.value || '';

        return this._usersAll.filter(u => {
            const uStatus = u.is_active !== false ? 'active' : 'blocked';
            const uDate   = Fmt.dateShort(u.created_at).toLowerCase();
            const uAct    = u.last_sign_in_at ? Fmt.dateShort(u.last_sign_in_at).toLowerCase() : '';
            return (
                (nameLC.length === 0 || nameLC.includes(esc(u.full_name)))    &&
                (jobLC.length  === 0 || jobLC.includes(esc(u.job_position)))  &&
                (cityLC.length === 0 || cityLC.includes(esc(u.city)))         &&
                (subLC.length  === 0 || subLC.includes(esc(u.subdivision)))   &&
                (!role   || u.role   === role)                                 &&
                (lblLC.length  === 0 || lblLC.includes(esc(u.label)))         &&
                this._matchTokens(uDate, date)                                 &&
                this._matchTokens(uAct,  act)                                  &&
                (!status || uStatus === status)
            );
        });
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
        const filtered = this._getFilteredUsers().filter(u => {
            const row = document.getElementById(`urow-${u.id}`);
            return !row?.querySelector('.user-cb')?.disabled;
        });
        const selectedCount = filtered.filter(u => this._selectedUsers.has(u.id)).length;
        if (selectedCount === 0)               { cb.checked = false; cb.indeterminate = false; }
        else if (selectedCount === filtered.length) { cb.checked = true;  cb.indeterminate = false; }
        else                                    { cb.checked = false; cb.indeterminate = true; }
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
            AuditLog.write('user_block', 'users', users.map(u => u.full_name).join(', '), { count: users.length });
            Toast.success(`Заблоковано: ${users.length} — сесії анульовано`);
            this._clearSelection();
            await this._renderUsersList(document.getElementById('admin-content'));
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
            AuditLog.write('user_unblock', 'users', users.map(u => u.full_name).join(', '), { count: users.length });
            Toast.success(`Розблоковано: ${users.length}`);
            this._clearSelection();
            await this._renderUsersList(document.getElementById('admin-content'));
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
            AuditLog.write('role_change', 'users', `${ids.length} користувачів`, { role, count: ids.length });
            Toast.success(`Роль змінено для ${ids.length} користувачів`);
            this._clearSelection();
            await this._renderUsersList(document.getElementById('admin-content'));
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
            title: '<i class="fa-solid fa-trash"></i> Видалити користувачів',
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

        if (done) {
            AuditLog.write('user_delete', 'users', toDelete.map(u => u.full_name).join(', '), { count: done });
            Toast.success('Видалено', `${done} користувач(ів) видалено`);
        }
        if (failed) Toast.error('Помилки', `${failed} не вдалося видалити`);
        this._renderUsersList(document.getElementById('admin-content'));
    },

    _bulkSendMessage() {
        const users = this._usersAll.filter(u => this._selectedUsers.has(u.id));
        if (!users.length) { Toast.warning('Не вибрано', 'Виберіть хоча б одного користувача'); return; }
        // Pass selected users to scheduler form and navigate
        SchedulerPage.openWithRecipients(users);
    },

    // ── Імпорт користувачів з CSV ─────────────────────────────────
    _importRows: [],

    _importCols: ['last_name','first_name','patronymic','login','email','password','role','gender','phone','birth_date','city','job_position','subdivision','label','dovirenosti'],
    _importHeaders: ['Прізвище','Ім\u2019я','По батькові','Логін','Email','Пароль','Роль','Стать','Телефон','Дата нар.','Місто','Посада','Підрозділ','Мітка','Довіреність'],

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
                    <span style="color:var(--text-muted);font-size:.78rem"><i class="fa-solid fa-angle-left"></i> рекомендуємо відкрити у Excel або Google Sheets</span>
                </div>
                <div class="file-upload-frame">
                    <label for="import-file-input" class="file-upload-area">
                        <div class="file-upload-icon"><i class="fa-solid fa-file-csv"></i></div>
                        <div class="file-upload-label">Натисніть або перетягніть CSV-файл</div>
                        <div class="file-upload-hint">CSV, TXT · кодування UTF-8</div>
                        <input type="file" id="import-file-input" accept=".csv,.txt" style="display:none"
                               onchange="AdminPage._onImportFile(this)">
                    </label>
                </div>
                <div id="import-preview"></div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" id="import-run-btn" style="display:none" onclick="AdminPage._runImport()">Імпортувати</button>`
        });
    },

    _downloadImportExample() {
        const header = this._importHeaders.join(';');
        const rows = [
            'Іваненко;Олег;Петрович;o.ivanenko;oleg@company.com;pass123;user;male;+380501234567;1990-05-15;Київ;Менеджер;Відділ продажів;Новий;Ф-47',
            'Коваль;Марія;Андріївна;m.koval;maria@company.com;pass456;teacher;female;+380671112233;20.11.1985;Львів;Викладач;HR;;Ф-47|Ф-112',
            'Сидоренко;Андрій;Васильович;a.sydorenko;andrii@company.com;secure99;admin;male;+380931234567;1978-03-10;Харків;Адміністратор;IT;;',
            'Бондаренко;Олена;;o.bondar;olena@company.com;qwerty1;smm;female;;;Одеса;SMM-спеціаліст;Маркетинг;;',
            'Гриценко;Ірина;Олексіївна;i.hrytsenko;iryna@company.com;pass789;manager;female;+380671234567;15.03.1992;Дніпро;Керівник відділу;Операційний;'
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
            'мітка':'label','метка':'label','label':'label',
            'довіреність':'dovirenosti','доверенность':'dovirenosti','dovirenosti':'dovirenosti'
        };
        const colMap = rawHeaders.map(h => colAlias[h] || null);

        return lines.slice(1).map((line, idx) => {
            const vals = line.split(delim).map(v => v.trim().replace(/^"|"$/g, ''));
            const row = { _line: idx + 2 };
            colMap.forEach((key, i) => { if (key) row[key] = vals[i] || ''; });
            // DD.MM.YYYY → YYYY-MM-DD
            if (row.birth_date && /^\d{2}\.\d{2}\.\d{4}$/.test(row.birth_date)) {
                const [d, m, y] = row.birth_date.split('.');
                row.birth_date = `${y}-${m}-${d}`;
            }
            row._errors = [];
            if (!row.last_name)  row._errors.push('Прізвище');
            if (!row.first_name) row._errors.push('Ім\u2019я');
            if (!row.email)      row._errors.push('Email');
            if (!row.password)   row._errors.push('Пароль');
            if (row.password && row.password.length < 6) row._errors.push('Пароль (мін. 6 символів)');
            const validRoles = ['owner','admin','smm','teacher','manager','user'];
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
                        <th>#</th><th>Прізвище</th><th>Ім\u2019я</th><th>По батькові</th><th>Email</th><th>Логін</th><th>Роль</th><th>Статус</th>
                    </tr></thead>
                    <tbody>
                        ${rows.map(r => `
                            <tr style="${r._errors.length ? 'opacity:.5' : ''}">
                                <td style="color:var(--text-muted)">${r._line}</td>
                                <td>${r.last_name  || '<span style="color:var(--danger)">—</span>'}</td>
                                <td>${r.first_name || '<span style="color:var(--danger)">—</span>'}</td>
                                <td style="color:var(--text-muted)">${r.patronymic || '—'}</td>
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
                if (row.dovirenosti) {
                    const names = row.dovirenosti.split('|').map(s => s.trim()).filter(Boolean);
                    if (names.length) {
                        const allDov = await API.dovirenosti.getAll().catch(() => []);
                        const ids = await Promise.all(names.map(async name => {
                            const ex = allDov.find(d => d.name.toLowerCase() === name.toLowerCase());
                            return ex ? ex.id : (await API.dovirenosti.create(name)).id;
                        }));
                        await API.dovirenosti.setForProfile(userId, ids).catch(() => {});
                    }
                }
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
        // sync new subdivisions to the directory table
        const newSubdivisions = [...new Set(rows.filter(r => r.subdivision).map(r => r.subdivision.trim()))];
        if (newSubdivisions.length) {
            try {
                const existing = (await API.directories.getAll('subdivisions')).map(s => s.name.toLowerCase());
                await Promise.all(
                    newSubdivisions
                        .filter(s => !existing.includes(s.toLowerCase()))
                        .map(s => API.directories.create('subdivisions', s).catch(() => {}))
                );
            } catch(e) { /* directory sync is best-effort */ }
        }

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
    _coursesEl: null,
    _courseThumbFile: null,

    async _renderCourses(el) {
        this._coursesEl = el;
        const { data: courses } = await API.courses.getAll({ pageSize: 200 });

        el.innerHTML = `
            <div style="display:flex;gap:1rem;margin-bottom:1rem">
                <input type="text" placeholder="Пошук..." style="flex:1" onkeyup="AdminPage._filterTable('courses-tbody', event)">
                <button class="btn btn-primary" onclick="AdminPage._openCourseForm()">+ Створити курс</button>
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
                                        <button class="btn btn-ghost btn-sm" onclick="Router.go('courses/${c.id}?from=expert-path')" title="Переглянути в Skill Up"><i class="fa-solid fa-eye"></i></button>
                                        <button class="btn btn-ghost btn-sm" onclick="AdminPage._loadCourseForm('${c.id}')"><i class="fa-solid fa-pen"></i></button>
                                        <button class="btn btn-danger btn-sm" onclick="AdminPage._deleteCourse('${c.id}',${JSON.stringify(c.title||'').replace(/"/g,'&quot;')})"><i class="fa-solid fa-trash"></i></button>
                                    </div>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;

        if (this._editCourseId) {
            const id = this._editCourseId;
            this._editCourseId = null;
            await this._loadCourseForm(id);
        }
    },

    async _loadCourseForm(id) {
        Loader.show();
        try { const c = await API.courses.getById(id); this._openCourseForm(c); }
        catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _kbSelected: [],

    _cfTab: 'main',
    _cfSwitchTab(tab) {
        this._cfTab = tab;
        document.querySelectorAll('.cf-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        document.querySelectorAll('.cf-tab-pane').forEach(p => p.style.display = p.dataset.tab === tab ? '' : 'none');
    },

    _openCourseForm(course = null) {
        const el = this._coursesEl;
        if (!el) return;
        this._courseThumbFile = null;
        this._courseBadgeFile = null;
        this._cfTab = 'main';
        this._kbSelected = (course?.course_info?.kb_resources || []);
        this._courseInfoBase = course?.course_info || {};
        const isEdit = !!course;
        const id = course?.id || '';

        const tabs = [
            { id: 'main',      icon: 'fa-circle-info',       label: 'Основне',    color: '#6366f1' },
            { id: 'media',     icon: 'fa-photo-film',         label: 'Медіа',      color: '#ec4899' },
            ...(isEdit ? [
                { id: 'runs',      icon: 'fa-users-rectangle', label: 'Групи',     color: '#f59e0b' },
                { id: 'teachers',  icon: 'fa-chalkboard-user', label: 'Викладачі', color: '#10b981' },
            ] : []),
            { id: 'schedule',  icon: 'fa-calendar-days',      label: 'Розклад',   color: '#0ea5e9' },
        ];

        el.innerHTML = `
        <style>
        .cf-wrap{max-width:720px}
        .cf-header{display:flex;align-items:center;gap:.75rem;margin-bottom:1.5rem;flex-wrap:wrap}
        .cf-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:1.75rem}
        .cf-tab-btn{display:flex;align-items:center;gap:.55rem;padding:.45rem 1rem .45rem .55rem;border-radius:50px;border:2px solid transparent;background:var(--bg-raised);cursor:pointer;font-size:.82rem;font-weight:600;color:var(--text-muted);transition:all .18s;white-space:nowrap}
        .cf-tab-btn .cf-tab-icon{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;flex-shrink:0;transition:all .18s;background:var(--bg-surface);color:var(--text-muted)}
        .cf-tab-btn:hover{color:var(--text-primary);background:var(--bg-surface);border-color:var(--border)}
        .cf-tab-btn:hover .cf-tab-icon{background:var(--bg-raised)}
        .cf-tab-btn.active{background:var(--bg-surface);font-weight:700;border-color:var(--cfti-color,var(--primary));color:var(--cfti-color,var(--primary));box-shadow:0 2px 8px rgba(0,0,0,.1)}
        .cf-tab-btn.active .cf-tab-icon{background:var(--cfti-color,var(--primary));color:#fff;box-shadow:0 2px 6px color-mix(in srgb,var(--cfti-color,var(--primary)) 40%,transparent)}
        .cf-pane{display:flex;flex-direction:column;gap:1rem}
        .cf-section{background:var(--bg-surface);border:1px solid var(--border);border-radius:14px;padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:1rem}
        .cf-section-title{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:-.25rem}
        .cf-footer{display:flex;gap:.75rem;justify-content:flex-end;padding-top:1rem;border-top:1px solid var(--border);margin-top:.5rem}
        </style>

        <div class="cf-wrap">
            <div class="cf-header">
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._renderCourses(AdminPage._coursesEl)">
                    <i class="fa-solid fa-arrow-left"></i> Назад
                </button>
                <h3 style="margin:0;font-size:1.1rem">${isEdit ? `<i class="fa-solid fa-pen" style="color:var(--primary)"></i> ${Fmt.esc(course.title)}` : '<i class="fa-solid fa-plus"></i> Новий курс'}</h3>
                ${isEdit ? `<span class="badge ${course.is_published ? 'badge-success' : 'badge-muted'}" style="margin-left:auto">${course.is_published ? 'Опублікований' : 'Чернетка'}</span>` : ''}
            </div>

            <div class="cf-tabs">
                ${tabs.map(t => `<button class="cf-tab-btn${t.id === 'main' ? ' active' : ''}" data-tab="${t.id}" onclick="AdminPage._cfSwitchTab('${t.id}')" style="--cfti-color:${t.color}">
                    <span class="cf-tab-icon"><i class="fa-solid ${t.icon}"></i></span>${t.label}
                </button>`).join('')}
            </div>

            <!-- ОСНОВНЕ -->
            <div class="cf-tab-pane cf-pane" data-tab="main">
                <div class="cf-section">
                    <div class="cf-section-title">Загальна інформація</div>
                    <div class="form-group" style="margin:0">
                        <label>Назва курсу *</label>
                        <input id="c-title" type="text" placeholder="Введіть назву" value="${Fmt.esc(course?.title || '')}">
                    </div>
                    <div class="form-group" style="margin:0">
                        <label>Опис</label>
                        <textarea id="c-desc" placeholder="Короткий опис курсу" rows="3">${Fmt.esc(course?.description || '')}</textarea>
                    </div>
                    <div class="form-row" style="margin:0">
                        <div class="form-group" style="margin:0">
                            <label>Категорія</label>
                            <input id="c-category" type="text" placeholder="Наприклад: Оцінка" value="${Fmt.esc(course?.category || '')}">
                        </div>
                        <div class="form-group" style="margin:0">
                            <label>Рівень</label>
                            <select id="c-level">
                                <option value="beginner"     ${course?.level === 'beginner'     ? 'selected' : ''}>Початковий</option>
                                <option value="intermediate" ${course?.level === 'intermediate' ? 'selected' : ''}>Середній</option>
                                <option value="advanced"     ${course?.level === 'advanced'     ? 'selected' : ''}>Просунутий</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group" style="margin:0">
                        <label>Тривалість (годин)</label>
                        <input id="c-duration" type="number" min="0" placeholder="0" value="${course?.duration_hours || ''}" style="max-width:160px">
                    </div>
                </div>
                <div class="cf-section">
                    <div class="cf-section-title">Публікація</div>
                    <label class="checkbox-item" style="cursor:pointer;user-select:none;margin:0">
                        <input type="checkbox" id="c-published" ${course?.is_published ? 'checked' : ''}>
                        <span>Опублікувати курс</span>
                    </label>
                    <label class="checkbox-item" style="cursor:pointer;user-select:none;margin:0">
                        <input type="checkbox" id="c-featured" ${course?.is_featured ? 'checked' : ''}>
                        <span>Рекомендований курс</span>
                    </label>
                </div>
                <div class="cf-footer">
                    <button class="btn btn-secondary" onclick="AdminPage._renderCourses(AdminPage._coursesEl)">Скасувати</button>
                    <button class="btn btn-primary" onclick="AdminPage._saveCourse('${id}')">
                        ${isEdit ? '<i class="fa-regular fa-floppy-disk"></i> Зберегти' : '<i class="fa-solid fa-plus"></i> Створити'}
                    </button>
                </div>
            </div>

            <!-- МЕДІА -->
            <div class="cf-tab-pane cf-pane" data-tab="media" style="display:none">
                <div class="cf-section">
                    <div class="cf-section-title">Обкладинка</div>
                    <div id="thumb-upload-zone"></div>
                    <div id="thumb-preview" style="${course?.thumbnail_url ? '' : 'display:none'}">
                        <div style="width:100%;border-radius:12px;overflow:hidden;background:var(--bg-raised);border:1px solid var(--border);text-align:center;line-height:0">
                            <img id="thumb-preview-img" src="${course?.thumbnail_url || ''}" style="max-width:100%;max-height:340px;width:100%;object-fit:cover;display:block">
                        </div>
                        <div style="font-size:.74rem;color:var(--text-muted);margin-top:.35rem;text-align:center">Поточна обкладинка</div>
                    </div>
                </div>
                <div class="cf-section">
                    <div class="cf-section-title">Бейдж досягнення</div>
                    <div style="font-size:.82rem;color:var(--text-muted)">Відображається на картці курсу в <strong>Skill Up</strong> після завершення.</div>
                    <div id="badge-upload-zone"></div>
                    ${course?.badge_url ? `
                    <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem;background:var(--bg-raised);border-radius:10px;border:1px solid var(--border)">
                        <img src="${course.badge_url}" style="width:56px;height:56px;object-fit:contain">
                        <div style="flex:1">
                            <div style="font-size:.85rem;font-weight:600;margin-bottom:.35rem">Поточний бейдж</div>
                            <button class="btn btn-ghost btn-sm" style="color:var(--danger);border-color:rgba(239,68,68,.3)" onclick="AdminPage._removeBadge('${id}')">
                                <i class="fa-solid fa-trash"></i> Видалити
                            </button>
                        </div>
                        <div style="width:120px;border-radius:10px;overflow:hidden;border:1px solid var(--border);flex-shrink:0">
                            <div style="height:70px;background:linear-gradient(135deg,#6366f1,#8b5cf6);position:relative">
                                <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.6) 0%,transparent 60%);display:flex;align-items:flex-end;padding:5px 7px"><span style="font-size:.6rem;font-weight:700;color:#fff">Назва курсу</span></div>
                                <div style="position:absolute;bottom:-1px;right:6px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))"><img src="${course.badge_url}" style="width:30px;height:30px;object-fit:contain"></div>
                            </div>
                            <div style="padding:4px 7px;font-size:.6rem;color:var(--text-muted)">Skill Up · приклад</div>
                        </div>
                    </div>` : `
                    <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem;background:var(--bg-raised);border-radius:10px;border:1px dashed var(--border)">
                        <div style="width:44px;height:44px;border-radius:50%;background:rgba(99,102,241,.1);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">🏆</div>
                        <div style="font-size:.8rem;color:var(--text-muted)">Бейдж не завантажено. Буде використано стандартну медаль.</div>
                    </div>`}
                </div>
                <div class="cf-footer">
                    <button class="btn btn-secondary" onclick="AdminPage._renderCourses(AdminPage._coursesEl)">Скасувати</button>
                    <button class="btn btn-primary" onclick="AdminPage._saveCourse('${id}')"><i class="fa-regular fa-floppy-disk"></i> Зберегти</button>
                </div>
            </div>

            <!-- ГРУПИ -->
            ${isEdit ? `
            <div class="cf-tab-pane cf-pane" data-tab="runs" style="display:none">
                <div class="cf-section">
                    <div style="display:flex;align-items:center;justify-content:space-between">
                        <div class="cf-section-title" style="margin:0">Навчальні групи</div>
                        <button class="btn btn-ghost btn-sm" onclick="AdminPage._runsAdd('${id}')"><i class="fa-solid fa-plus"></i> Нова група</button>
                    </div>
                    <div id="c-runs-list" style="display:flex;flex-direction:column;gap:.4rem">
                        <div style="color:var(--text-muted);font-size:.82rem">Завантаження...</div>
                    </div>
                </div>
            </div>` : ''}

            <!-- ВИКЛАДАЧІ -->
            ${isEdit ? `
            <div class="cf-tab-pane cf-pane" data-tab="teachers" style="display:none">
                <div class="cf-section">
                    <div style="display:flex;align-items:center;justify-content:space-between">
                        <div class="cf-section-title" style="margin:0">Викладачі</div>
                        <button class="btn btn-ghost btn-sm" onclick="AdminPage._courseTeacherAdd('${id}')"><i class="fa-solid fa-plus"></i> Додати</button>
                    </div>
                    <div id="c-course-teachers" style="display:flex;flex-direction:column;gap:.4rem">
                        <div style="color:var(--text-muted);font-size:.82rem">Завантаження...</div>
                    </div>
                </div>
            </div>` : ''}

            <!-- РОЗКЛАД -->
            <div class="cf-tab-pane cf-pane" data-tab="schedule" style="display:none">
                <div class="cf-section">
                    <div style="display:flex;align-items:center;justify-content:space-between">
                        <div class="cf-section-title" style="margin:0">Розклад занять</div>
                        <button class="btn btn-ghost btn-sm" onclick="AdminPage._scheduleAddDay()"><i class="fa-solid fa-plus"></i> Додати день</button>
                    </div>
                    <div id="c-schedule-builder" style="display:flex;flex-direction:column;gap:.75rem"></div>
                </div>
                <div class="cf-footer">
                    <button class="btn btn-secondary" onclick="AdminPage._renderCourses(AdminPage._coursesEl)">Скасувати</button>
                    <button class="btn btn-primary" onclick="AdminPage._saveCourse('${id}')"><i class="fa-regular fa-floppy-disk"></i> Зберегти</button>
                </div>
            </div>

        </div>`;

        const zone = document.getElementById('thumb-upload-zone');
        if (zone) {
            const input = FileUpload.createDropZone(zone, { accept: 'image/*', label: 'Завантажити обкладинку', hint: 'PNG, JPG до 5 МБ' });
            input.addEventListener('change', () => {
                this._courseThumbFile = input.files[0];
                if (this._courseThumbFile) {
                    const reader = new FileReader();
                    reader.onload = e => {
                        const prev = document.getElementById('thumb-preview');
                        const img = document.getElementById('thumb-preview-img');
                        if (prev && img) { img.src = e.target.result; prev.style.display = ''; }
                    };
                    reader.readAsDataURL(this._courseThumbFile);
                }
            });
        }
        const badgeZone = document.getElementById('badge-upload-zone');
        if (badgeZone) {
            const input = FileUpload.createDropZone(badgeZone, { accept: 'image/*', label: 'Завантажити бейдж', hint: 'PNG з прозорістю, до 2 МБ' });
            input.addEventListener('change', () => { this._courseBadgeFile = input.files[0]; });
        }

        this._scheduleInit(course?.schedule || []);
        if (isEdit) {
            this._runsLoad(course.id);
            this._courseTeachersLoad(course.id);
        }
    },

    // ── Course Runs (admin) ───────────────────────────────────────────
    async _removeBadge(courseId) {
        if (!await Modal.confirm({ message: 'Видалити бейдж досягнення?', danger: true })) return;
        Loader.show();
        try {
            await API.courses.removeBadge(courseId);
            Toast.success('Бейдж видалено');
            const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).single();
            this._openCourseForm(course);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _courseBadgeFile: null,
    _runsData: [],

    async _runsLoad(courseId) {
        const el = document.getElementById('c-runs-list');
        if (!el) return;
        try {
            this._runsData = await API.courseRuns.getByCourse(courseId);
            this._runsRender(courseId);
        } catch(e) { el.innerHTML = `<div style="color:var(--danger);font-size:.82rem">${Fmt.esc(e.message)}</div>`; }
    },

    _runsRender(courseId) {
        const el = document.getElementById('c-runs-list');
        if (!el) return;
        if (!this._runsData.length) {
            el.innerHTML = `<div style="color:var(--text-muted);font-size:.82rem;padding:.5rem 0">Груп ще немає. Натисніть «Нова група» щоб додати.</div>`;
            return;
        }
        const today = new Date().toISOString().slice(0, 10);
        el.innerHTML = this._runsData.map(r => {
            const started = r.start_date && r.start_date <= today;
            const ended   = r.end_date && r.end_date < today;
            const active  = started && !ended;
            const upcoming = r.start_date && r.start_date > today;
            const badge = ended    ? `<span style="font-size:.68rem;padding:.15rem .5rem;border-radius:20px;background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border)">Завершено</span>`
                        : active   ? `<span style="font-size:.68rem;padding:.15rem .5rem;border-radius:20px;background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.3)">Активний</span>`
                        : upcoming ? `<span style="font-size:.68rem;padding:.15rem .5rem;border-radius:20px;background:rgba(99,102,241,.1);color:#6366f1;border:1px solid rgba(99,102,241,.25)">Заплановано</span>`
                        : `<span style="font-size:.68rem;padding:.15rem .5rem;border-radius:20px;background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border)">Без дат</span>`;
            const dates = [r.start_date && Fmt.dateShort(new Date(r.start_date + 'T00:00:00')), r.end_date && Fmt.dateShort(new Date(r.end_date + 'T00:00:00'))].filter(Boolean).join(' — ');
            return `
            <div style="display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;border:1px solid var(--border);border-radius:8px;background:var(--bg-raised)">
                <i class="fa-solid fa-rotate" style="color:var(--text-muted);font-size:.8rem;flex-shrink:0"></i>
                <div style="flex:1;min-width:0">
                    <div style="font-size:.85rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Fmt.esc(r.title)}</div>
                    ${dates ? `<div style="font-size:.72rem;color:var(--text-muted)">${dates}</div>` : ''}
                </div>
                ${badge}
                <button class="btn btn-ghost btn-sm" style="padding:.25rem .5rem" onclick="AdminPage._runsEdit('${r.id}','${courseId}')" title="Редагувати"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn btn-ghost btn-sm" style="padding:.25rem .5rem;color:var(--danger)" onclick="AdminPage._runsDelete('${r.id}','${courseId}')" title="Видалити"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        }).join('');
    },

    _runsAdd(courseId) {
        this._runsOpenModal(courseId, null);
    },

    _runsEdit(runId, courseId) {
        const run = this._runsData.find(r => r.id === runId);
        if (run) this._runsOpenModal(courseId, run);
    },

    _runsOpenModal(courseId, run) {
        Modal.open({
            title: run ? '✏️ Редагувати групу' : '🔄 Нова група',
            size: 'sm',
            body: `
            <div style="display:flex;flex-direction:column;gap:.75rem">
                <div>
                    <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Назва групи *</label>
                    <input id="run-title" class="form-control" placeholder="Наприклад: Група Червень 2025" value="${Fmt.esc(run?.title || '')}">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
                    <div>
                        <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Дата початку</label>
                        <input id="run-start" class="form-control" type="date" value="${run?.start_date || ''}">
                    </div>
                    <div>
                        <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Дата завершення</label>
                        <input id="run-end" class="form-control" type="date" value="${run?.end_date || ''}">
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
                    <div>
                        <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Час початку</label>
                        <input id="run-stime" class="form-control" type="time" value="${run?.start_time?.slice(0,5) || ''}">
                    </div>
                    <div>
                        <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Час завершення</label>
                        <input id="run-etime" class="form-control" type="time" value="${run?.end_time?.slice(0,5) || ''}">
                    </div>
                </div>
            </div>`,
            footer: `
                <button class="btn btn-primary" onclick="AdminPage._runsSave('${courseId}','${run?.id || ''}')">
                    <i class="fa-regular fa-floppy-disk"></i> Зберегти
                </button>
                <button class="btn btn-ghost" onclick="Modal.close()">Скасувати</button>`
        });
    },

    async _runsSave(courseId, runId) {
        const title      = document.getElementById('run-title')?.value.trim();
        const start_date = document.getElementById('run-start')?.value || null;
        const end_date   = document.getElementById('run-end')?.value || null;
        const start_time = document.getElementById('run-stime')?.value || null;
        const end_time   = document.getElementById('run-etime')?.value || null;
        if (!title) { Toast.warning('Введіть назву групи'); return; }
        Loader.show();
        try {
            if (runId) {
                await API.courseRuns.update(runId, { title, start_date, end_date, start_time, end_time });
                CourseViewPage._syncRunCalendars(runId, { course_id: courseId, title, start_date, end_date, start_time, end_time }).catch(() => {});
            } else {
                await API.courseRuns.create(courseId, { title, start_date, end_date, start_time, end_time });
            }
            Modal.close();
            await this._runsLoad(courseId);
            Toast.success('Збережено');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _runsDelete(runId, courseId) {
        const run = this._runsData.find(r => r.id === runId);
        const ok = await Modal.confirm({ message: `Видалити групу «${run?.title || ''}»? Записи учасників залишаться, але група буде відв'язана.`, danger: true });
        if (!ok) return;
        Loader.show();
        try {
            await API.courseRuns.remove(runId);
            await this._runsLoad(courseId);
            Toast.success('Видалено');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Course teachers (admin) ───────────────────────────────────────
    _courseTeachersData: [],

    async _courseTeachersLoad(courseId) {
        try {
            const [teachers, profRes] = await Promise.all([
                API.courseTeachers.getByCourse(courseId),
                API.profiles.getAll({ pageSize: 500 })
            ]);
            this._courseTeachersData = teachers;
            this._courseTeachersProfiles = (profRes.data || []).sort((a,b) => (a.full_name||'').localeCompare(b.full_name||'','uk'));
            this._courseTeachersRender(courseId);
        } catch(e) {
            const el = document.getElementById('c-course-teachers');
            if (el) el.innerHTML = `<div style="color:var(--danger);font-size:.82rem">${e.message}</div>`;
        }
    },

    _courseTeachersProfiles: [],

    _courseTeachersRender(courseId) {
        const el = document.getElementById('c-course-teachers');
        if (!el) return;
        if (!this._courseTeachersData.length) {
            el.innerHTML = `<div style="color:var(--text-muted);font-size:.82rem">Викладачів не призначено</div>`;
            return;
        }
        el.innerHTML = this._courseTeachersData.map(t => `
            <div style="display:flex;align-items:center;gap:.5rem;padding:.45rem .7rem;background:var(--bg-raised);border-radius:var(--radius-sm);border:1px solid var(--border)">
                <i class="fa-solid fa-chalkboard-user" style="color:var(--primary);font-size:.85rem"></i>
                <span style="flex:1;font-size:.85rem;font-weight:500">${Fmt.esc(t.profile?.full_name || t.user_id)}</span>
                ${t.label ? `<span style="font-size:.75rem;background:var(--primary-glow);color:var(--primary);padding:.1rem .5rem;border-radius:999px">${Fmt.esc(t.label)}</span>` : ''}
                <button type="button" class="btn btn-ghost btn-sm" title="Редагувати мітку"
                    onclick="AdminPage._courseTeacherEditLabel('${t.id}','${courseId}')">
                    <i class="fa-solid fa-pen" style="font-size:.72rem"></i>
                </button>
                <button type="button" class="btn btn-danger btn-sm"
                    data-name="${Fmt.esc(t.profile?.full_name || '')}"
                    onclick="AdminPage._courseTeacherRemove('${t.id}','${courseId}',this.dataset.name)">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>`).join('');
    },

    async _courseTeacherAdd(courseId) {
        Modal.open({
            title: 'Додати викладача',
            body: `
                <div class="form-group">
                    <label>Викладач *</label>
                    <select id="ct-user-sel" style="width:100%">
                        <option value="">— Оберіть людину —</option>
                        ${this._courseTeachersProfiles.map(p => `
                            <option value="${p.id}">${Fmt.esc(p.full_name || p.email)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-top:.75rem">
                    <label>Мітка групи (необов'язково)</label>
                    <input id="ct-label-inp" type="text" placeholder='Наприклад: "Група A", "Тиждень 2"' style="width:100%">
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="AdminPage._courseTeacherSaveNew('${courseId}')">Додати</button>`
        });
    },

    async _courseTeacherSaveNew(courseId) {
        const userId = document.getElementById('ct-user-sel')?.value;
        const label  = document.getElementById('ct-label-inp')?.value.trim() || null;
        if (!userId) { Toast.error('Помилка', 'Оберіть людину'); return; }
        Loader.show();
        try {
            await supabase.from('course_teachers').insert({ course_id: courseId, user_id: userId, label, is_active: true });
            Modal.close();
            await this._courseTeachersLoad(courseId);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _courseTeacherEditLabel(entryId, courseId) {
        const current = this._courseTeachersData.find(t => t.id === entryId)?.label || '';
        Modal.open({
            title: 'Мітка групи',
            body: `<div class="form-group">
                <label>Група або тиждень</label>
                <input id="ct-edit-label" type="text" value="${Fmt.esc(current)}" placeholder='Наприклад: "Група A"' style="width:100%">
            </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="AdminPage._courseTeacherSaveLabel('${entryId}','${courseId}')">Зберегти</button>`
        });
    },

    async _courseTeacherSaveLabel(entryId, courseId) {
        const label = document.getElementById('ct-edit-label')?.value.trim() || null;
        Loader.show();
        try {
            await API.courseTeachers.updateLabel(entryId, label);
            Modal.close();
            await this._courseTeachersLoad(courseId);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _courseTeacherRemove(entryId, courseId, name) {
        const ok = await Modal.confirm({ message: `Видалити викладача "${name}" з курсу?`, danger: true });
        if (!ok) return;
        Loader.show();
        try {
            await API.courseTeachers.remove(entryId);
            await this._courseTeachersLoad(courseId);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Schedule builder ──────────────────────────────────────────────
    _scheduleDays: [],
    _scheduleProfiles: [],
    _scheduleTests: [],
    _scheduleKbAll: [],

    async _scheduleInit(existing) {
        this._scheduleDays = existing.length
            ? existing.map(d => ({
                ...d,
                items:        [...(d.items || [])],
                tests:        d.tests ? [...d.tests] : (d.test_id ? [{ id: d.test_id, title: d.test_title || '' }] : []),
                kb_resources: [...(d.kb_resources || [])],
              }))
            : [];
        try {
            const [profRes, tests, kbRes] = await Promise.all([
                API.profiles.getAll({ pageSize: 500 }),
                API.tests.getAll(),
                API.resources.getAll({ pageSize: 500 }),
            ]);
            this._scheduleProfiles = (profRes.data || []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'uk'));
            this._scheduleTests    = tests || [];
            this._scheduleKbAll    = kbRes.data || [];
        } catch(e) { this._scheduleProfiles = []; this._scheduleTests = []; this._scheduleKbAll = []; }
        this._scheduleRender();
    },

    _scheduleRender(containerId = 'c-schedule-builder') {
        const el = document.getElementById(containerId);
        if (!el) return;
        if (!this._scheduleDays.length) {
            el.innerHTML = `<div style="color:var(--text-muted);font-size:.82rem;padding:.5rem 0">Розклад не заповнено</div>`;
            return;
        }
        el.innerHTML = this._scheduleDays.map((day, di) => `
            <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:.85rem;background:var(--bg-raised)">
                <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem">
                    <span style="font-weight:700;min-width:60px;color:var(--primary)">День ${di + 1}</span>
                    <input type="text" placeholder="Назва дня (необов'язково)"
                        value="${Fmt.esc(day.title || '')}"
                        onchange="AdminPage._scheduleDays[${di}].title=this.value"
                        style="flex:1;font-size:.85rem">
                    <button type="button" class="btn btn-danger btn-sm" onclick="AdminPage._scheduleRemoveDay(${di})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <div style="margin-bottom:.65rem">
                    <label style="font-size:.75rem;color:var(--text-muted);margin-bottom:.25rem;display:block">Викладач</label>
                    <select onchange="AdminPage._scheduleDays[${di}].teacher_id=this.value;AdminPage._scheduleDays[${di}].teacher_name=this.options[this.selectedIndex].dataset.name||''"
                        style="width:100%;font-size:.82rem">
                        <option value="" data-name="">— Не вказано —</option>
                        ${this._scheduleProfiles.map(p => `
                            <option value="${p.id}" data-name="${Fmt.esc(p.full_name || p.email)}" ${day.teacher_id === p.id ? 'selected' : ''}>${Fmt.esc(p.full_name || p.email)}</option>
                        `).join('')}
                    </select>
                </div>
                <div style="margin-bottom:.65rem">
                    <label style="font-size:.75rem;color:var(--text-muted);margin-bottom:.25rem;display:flex;align-items:center;justify-content:space-between">
                        <span>Тести дня</span>
                        <button type="button" class="btn btn-ghost btn-sm" style="font-size:.75rem" onclick="AdminPage._scheduleAddTest(${di})">
                            <i class="fa-solid fa-plus"></i> Додати тест
                        </button>
                    </label>
                    <div style="display:flex;flex-direction:column;gap:.35rem">
                        ${(day.tests || []).map((t, ti) => `
                            <div style="display:flex;gap:.35rem">
                                <select onchange="AdminPage._scheduleDays[${di}].tests[${ti}]={id:this.value,title:this.options[this.selectedIndex].dataset.title||''}"
                                    style="flex:1;font-size:.82rem">
                                    <option value="">— Оберіть тест —</option>
                                    ${this._scheduleTests.map(st => `
                                        <option value="${st.id}" data-title="${Fmt.esc(st.title)}" ${t.id === st.id ? 'selected' : ''}>${Fmt.esc(st.title)}</option>
                                    `).join('')}
                                </select>
                                <button type="button" class="btn btn-ghost btn-sm" onclick="AdminPage._scheduleRemoveTest(${di},${ti})">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>`).join('')}
                        ${!(day.tests?.length) ? `<div style="font-size:.78rem;color:var(--text-muted)">Тести не призначено</div>` : ''}
                    </div>
                </div>
                <div style="margin-bottom:.65rem">
                    <label style="font-size:.75rem;color:var(--text-muted);margin-bottom:.25rem;display:block">Інструкції для дня</label>
                    <textarea placeholder="Що потрібно підготувати, як пройти день, особливі умови..."
                        rows="2"
                        onchange="AdminPage._scheduleDays[${di}].instructions=this.value"
                        style="width:100%;font-size:.82rem;resize:vertical">${Fmt.esc(day.instructions || '')}</textarea>
                </div>
                <div>
                    <label style="font-size:.75rem;color:var(--text-muted);margin-bottom:.25rem;display:block">Теми / заняття</label>
                    <div style="display:flex;flex-direction:column;gap:.35rem">
                        ${(day.items || []).map((item, ii) => {
                            const t = typeof item === 'object' ? item : { title: item, desc: '' };
                            return `
                            <div style="display:flex;gap:.35rem;align-items:flex-start">
                                <div style="flex:1;display:flex;flex-direction:column;gap:.2rem">
                                    <input type="text" value="${Fmt.esc(t.title || '')}" placeholder="Назва теми..."
                                        onchange="AdminPage._schedItemSet(${di},${ii},'title',this.value)"
                                        style="font-size:.82rem">
                                    <input type="text" value="${Fmt.esc(t.desc || '')}" placeholder="Короткий опис (необов'язково)..."
                                        onchange="AdminPage._schedItemSet(${di},${ii},'desc',this.value)"
                                        style="font-size:.78rem">
                                </div>
                                <button type="button" class="btn btn-ghost btn-sm" onclick="AdminPage._scheduleRemoveItem(${di},${ii})">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>`;}).join('')}
                    </div>
                    <button type="button" class="btn btn-ghost btn-sm" style="margin-top:.35rem;font-size:.78rem"
                        onclick="AdminPage._scheduleAddItem(${di})">
                        <i class="fa-solid fa-plus"></i> Додати тему
                    </button>
                </div>
                <div style="border-top:1px solid var(--border);padding-top:.65rem;margin-top:.65rem">
                    <label style="font-size:.75rem;color:var(--text-muted);margin-bottom:.4rem;display:flex;align-items:center;gap:.4rem">
                        <i class="fa-solid fa-folder-open" style="color:var(--primary)"></i> Файли з бази знань
                        ${(day.kb_resources||[]).length ? `<span style="background:var(--primary);color:#fff;border-radius:10px;padding:0 6px;font-size:.65rem;font-weight:700">${(day.kb_resources||[]).length}</span>` : ''}
                    </label>
                    <div id="skb-chips-${di}" style="display:flex;flex-wrap:wrap;gap:.3rem;${(day.kb_resources||[]).length ? 'margin-bottom:.4rem' : ''}">
                        ${this._schedKbChipsHtml(di)}
                    </div>
                    <button class="btn btn-ghost btn-sm" onclick="AdminPage._schedKbOpenModal(${di})" style="font-size:.78rem">
                        <i class="fa-solid fa-plus"></i> Додати файл з бази знань
                    </button>
                </div>
            </div>`).join('');
    },

    _scheduleAddDay() {
        this._scheduleDays.push({ title: '', teacher_id: '', teacher_name: '', tests: [], instructions: '', items: [], kb_resources: [] });
        this._scheduleRender();
    },

    _schedKbAdd(di, id) {
        const res = this._scheduleKbAll.find(r => r.id === id);
        if (!res) return;
        if (!this._scheduleDays[di].kb_resources) this._scheduleDays[di].kb_resources = [];
        if (this._scheduleDays[di].kb_resources.some(r => r.id === id)) return;
        this._scheduleDays[di].kb_resources.push({ id: res.id, title: res.title, type: res.type });
    },

    _schedKbRemove(di, ri) {
        this._scheduleDays[di].kb_resources.splice(ri, 1);
        const chips = document.getElementById(`skb-chips-${di}`);
        if (chips) chips.innerHTML = this._schedKbChipsHtml(di);
        if (this._schedKbModalRender) this._schedKbModalRender(document.getElementById('skb-modal-search')?.value || '');
    },

    _schedKbOpenModal(di) {
        const render = (term = '') => {
            const selected = this._scheduleDays[di].kb_resources || [];
            const filtered = this._scheduleKbAll
                .filter(r => !selected.some(s => s.id === r.id))
                .filter(r => !term || r.title.toLowerCase().includes(term.toLowerCase()))
                .slice(0, 50);
            const list = document.getElementById('skb-modal-list');
            if (!list) return;
            list.innerHTML = filtered.length
                ? filtered.map(r => `
                <div onclick="AdminPage._schedKbAdd(${di},'${r.id}');AdminPage._schedKbModalRefresh(${di})"
                    style="display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;cursor:pointer;border-bottom:1px solid var(--border);border-radius:6px"
                    onmouseenter="this.style.background='var(--bg-raised)'" onmouseleave="this.style.background=''">
                    <i class="fa-solid ${this._kbIcon(r.type)}" style="color:var(--primary);font-size:.8rem;width:14px;flex-shrink:0"></i>
                    <span style="font-size:.83rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Fmt.esc(r.title)}</span>
                </div>`).join('')
                : `<div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:.85rem">Файли не знайдено</div>`;
        };
        this._schedKbModalDi = di;
        this._schedKbModalRender = render;
        Modal.open({
            title: '<i class="fa-solid fa-folder-open" style="color:var(--primary)"></i> База знань — вибір файлу',
            size: 'lg',
            body: `
                <input id="skb-modal-search" type="text" class="form-control" placeholder="🔍 Пошук файлу..."
                    oninput="AdminPage._schedKbModalRender(this.value)"
                    style="margin-bottom:.75rem">
                <div id="skb-modal-list" style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:10px"></div>`,
            footer: `<button class="btn btn-secondary" onclick="Modal.close()">Закрити</button>`
        });
        setTimeout(() => {
            render('');
            document.getElementById('skb-modal-search')?.focus();
        }, 50);
    },

    _schedKbModalRefresh(di) {
        const term = document.getElementById('skb-modal-search')?.value || '';
        if (this._schedKbModalRender) this._schedKbModalRender(term);
        // Update chips without full re-render
        const chips = document.getElementById(`skb-chips-${di}`);
        if (chips) chips.innerHTML = this._schedKbChipsHtml(di);
    },

    _schedKbChipsHtml(di) {
        const day = this._scheduleDays[di];
        return (day.kb_resources || []).map((r, ri) => `
            <span style="display:inline-flex;align-items:center;gap:.3rem;background:color-mix(in srgb,var(--primary) 8%,transparent);border:1px solid color-mix(in srgb,var(--primary) 25%,transparent);border-radius:6px;padding:.18rem .5rem;font-size:.73rem">
                <i class="fa-solid ${this._kbIcon(r.type)}" style="color:var(--primary);font-size:.65rem"></i>
                <span style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Fmt.esc(r.title)}</span>
                <button onclick="AdminPage._schedKbRemove(${di},${ri})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:0;line-height:1"><i class="fa-solid fa-xmark" style="font-size:.6rem"></i></button>
            </span>`).join('');
    },

    _scheduleAddTest(di) {
        if (!this._scheduleDays[di].tests) this._scheduleDays[di].tests = [];
        this._scheduleDays[di].tests.push({ id: '', title: '' });
        this._scheduleRender();
    },

    _scheduleRemoveTest(di, ti) {
        this._scheduleDays[di].tests.splice(ti, 1);
        this._scheduleRender();
    },

    _scheduleRemoveDay(di) {
        this._scheduleDays.splice(di, 1);
        this._scheduleRender();
    },

    _scheduleAddItem(di) {
        this._scheduleDays[di].items.push({ title: '', desc: '' });
        this._scheduleRender();
    },

    _scheduleRemoveItem(di, ii) {
        this._scheduleDays[di].items.splice(ii, 1);
        this._scheduleRender();
    },

    _schedItemSet(di, ii, key, val) {
        const item = this._scheduleDays[di].items[ii];
        if (typeof item === 'object') item[key] = val;
        else this._scheduleDays[di].items[ii] = { title: item, desc: '', [key]: val };
    },

    _kbAllResources: [],

    async _kbLoad() {
        try {
            const { data } = await API.resources.getAll({ pageSize: 500, studentOnly: true });
            this._kbAllResources = data || [];
            this._kbFilterList('');
            this._kbRenderSelected();
        } catch(e) {
            const el = document.getElementById('c-kb-list');
            if (el) el.innerHTML = `<div style="padding:.75rem;color:var(--text-muted);font-size:.82rem">Не вдалося завантажити</div>`;
        }
    },

    _kbRenderSelected() {
        const el = document.getElementById('c-kb-selected');
        const cnt = document.getElementById('c-kb-count');
        if (!el) return;
        if (cnt) cnt.textContent = this._kbSelected.length ? this._kbSelected.length + ' обрано' : '';
        el.innerHTML = this._kbSelected.map(r => `
            <span style="display:inline-flex;align-items:center;gap:.35rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:.2rem .55rem;font-size:.78rem;max-width:220px">
                <i class="fa-solid ${AdminPage._kbIcon(r.type)}" style="color:var(--primary);flex-shrink:0;font-size:.7rem"></i>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Fmt.esc(r.title)}</span>
                <button onclick="AdminPage._kbToggle(${JSON.stringify(r.id).replace(/"/g,'&quot;')})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:0;line-height:1;flex-shrink:0"><i class="fa-solid fa-xmark" style="font-size:.65rem"></i></button>
            </span>`).join('');
    },

    _kbFilterList(q) {
        const el = document.getElementById('c-kb-list');
        if (!el) return;
        const term = (q || '').toLowerCase();
        const filtered = this._kbAllResources.filter(r => !term || r.title.toLowerCase().includes(term));
        if (!filtered.length) {
            el.innerHTML = `<div style="padding:.75rem;color:var(--text-muted);font-size:.82rem">Нічого не знайдено</div>`;
            return;
        }
        el.innerHTML = filtered.map(r => {
            const sel = this._kbSelected.some(s => s.id === r.id);
            return `
            <div onclick="AdminPage._kbToggle('${r.id}')" style="display:flex;align-items:center;gap:.6rem;padding:.5rem .85rem;cursor:pointer;transition:background .12s;border-bottom:1px solid var(--border);${sel ? 'background:color-mix(in srgb,var(--primary) 8%,transparent)' : ''}" onmouseenter="this.style.background='var(--bg-surface)'" onmouseleave="this.style.background='${sel ? 'color-mix(in srgb,var(--primary) 8%,transparent)' : 'transparent'}'">
                <i class="fa-solid ${AdminPage._kbIcon(r.type)}" style="color:${sel ? 'var(--primary)' : 'var(--text-muted)'};width:14px;font-size:.8rem;flex-shrink:0"></i>
                <span style="flex:1;font-size:.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Fmt.esc(r.title)}</span>
                <i class="fa-solid ${sel ? 'fa-circle-check' : 'fa-circle'}" style="color:${sel ? 'var(--primary)' : 'var(--border)'};font-size:.85rem;flex-shrink:0"></i>
            </div>`;
        }).join('');
    },

    _kbToggle(id) {
        const idx = this._kbSelected.findIndex(r => r.id === id);
        if (idx >= 0) {
            this._kbSelected.splice(idx, 1);
        } else {
            const res = this._kbAllResources.find(r => r.id === id);
            if (res) this._kbSelected.push({ id: res.id, title: res.title, type: res.type });
        }
        this._kbRenderSelected();
        this._kbFilterList(document.getElementById('c-kb-search')?.value || '');
    },

    _kbIcon(type) {
        const map = { pdf:'fa-file-pdf', video:'fa-circle-play', link:'fa-link', scorm:'fa-cube', image:'fa-image', document:'fa-file-lines', file:'fa-file' };
        return map[type] || 'fa-file';
    },

    async _saveCourse(id) {
        const title = Dom.val('c-title').trim();
        if (!title) { Toast.error('Помилка', 'Вкажіть назву курсу'); return; }
        const schedule = (this._scheduleDays || [])
            .map(d => ({
                title:        d.title || '',
                teacher_id:   d.teacher_id || null,
                teacher_name: d.teacher_name || '',
                tests:        (d.tests || []).filter(t => t.id),
                instructions: d.instructions || '',
                items:        (d.items || []).map(it => typeof it === 'object' ? it : { title: it, desc: '' }).filter(it => (it.title || '').trim()),
                kb_resources: (d.kb_resources || [])
            }))
            .filter(d => d.items.length || d.title || d.teacher_id || d.tests.length || d.instructions || d.kb_resources.length);
        const fields = {
            title,
            description:    Dom.val('c-desc').trim() || null,
            level:          Dom.val('c-level'),
            category:       Dom.val('c-category').trim() || 'general',
            duration_hours: parseInt(Dom.val('c-duration')) || 0,
            is_published:   document.getElementById('c-published').checked,
            is_featured:    document.getElementById('c-featured').checked,
            schedule
        };
        Loader.show();
        try {
            let course = id ? await API.courses.update(id, fields) : await API.courses.create(fields);
            // merge kb_resources into course_info without touching other fields (outcomes, goals, etc.)
            const { data: fresh } = await supabase.from('courses').select('course_info').eq('id', course.id).single();
            const mergedInfo = { ...(fresh?.course_info || {}), kb_resources: this._kbSelected };
            await supabase.from('courses').update({ course_info: mergedInfo }).eq('id', course.id);
            if (this._courseThumbFile) await API.courses.uploadThumbnail(course.id, this._courseThumbFile);
            if (this._courseBadgeFile) await API.courses.uploadBadge(course.id, this._courseBadgeFile);
            AuditLog.write(id ? 'course_update' : 'course_create', 'course', title);
            Toast.success('Збережено!', `Курс "${title}" ${id ? 'оновлено' : 'створено'}`);
            await this._renderCourses(this._coursesEl);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _deleteCourse(id, title) {
        const ok = await Modal.confirm({
            title: 'Видалити курс',
            message: `Видалити курс "<strong>${title}</strong>"? Всі уроки та матеріали будуть видалені.`,
            confirmText: 'Видалити', danger: true
        });
        if (!ok) return;
        Loader.show();
        try {
            await API.courses.delete(id);
            AuditLog.write('course_delete', 'course', title);
            Toast.success('Видалено', `Курс "${title}" видалено`);
            await this._renderCourses(this._coursesEl);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Тести ─────────────────────────────────────────────────────
    async _renderTests(el) {
        await TestsManagerPage._renderList(el);
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
                                        <button class="btn btn-ghost btn-sm" onclick="Router.go('news/${n.id}')"><i class="fa-solid fa-eye"></i></button>
                                        <button class="btn btn-ghost btn-sm" onclick="NewsPage.openEdit('${n.id}')"><i class="fa-solid fa-pen"></i></button>
                                        <button class="btn btn-danger btn-sm" onclick="NewsPage.deleteNews('${n.id}',${JSON.stringify(n.title||'').replace(/"/g,'&quot;')})"><i class="fa-solid fa-trash"></i></button>
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
                <button class="btn btn-ghost btn-sm" onclick="AdminPage._renderUsers(document.getElementById('admin-content'))" style="display:inline-flex;align-items:center;gap:.35rem"><i class="fa-solid fa-angle-left"></i> Назад</button>
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
                    <button class="btn btn-primary btn-sm" onclick="AdminPage.openAddDir('${table}','${title}')"><i class="fa-solid fa-plus"></i> Додати</button>
                </div>
                <div class="card-body" style="padding:0;max-height:350px;overflow-y:auto">
                    ${items.length ? items.map(i => `
                        <div style="display:flex;align-items:center;justify-content:space-between;padding:.625rem 1rem;border-bottom:1px solid var(--border)">
                            <span style="font-size:.875rem">${i.name}</span>
                            <div style="display:flex;gap:.3rem">
                                <button class="btn btn-ghost btn-sm" onclick="AdminPage.openEditDir('${table}','${i.id}',${JSON.stringify(i.name||'').replace(/"/g,'&quot;')})"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn btn-danger btn-sm" onclick="AdminPage.deleteDir('${table}','${i.id}',${JSON.stringify(i.name||'').replace(/"/g,'&quot;')})"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </div>`).join('')
                    : `<div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:.85rem">Список порожній</div>`}
                </div>
            </div>`;
    },

    openAddDir(table, title) {
        Modal.open({
            title: `<i class="fa-solid fa-plus"></i> Додати — ${title}`,
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
            title: '<i class="fa-solid fa-pen"></i> Редагувати',
            size: 'sm',
            body: `
                <div class="form-group">
                    <label>Назва *</label>
                    <input id="dir-name" type="text" value="${name}">
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="AdminPage.saveDir('${table}','${id}')"><i class="fa-regular fa-floppy-disk"></i> Зберегти</button>`
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

    // ── Логи дій персоналу (тільки власник) ──────────────────────
    async _renderLogs(el) {
        if (!AppState.isOwner()) {
            el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔒</div><h3>Доступ лише для власника</h3></div>`;
            return;
        }
        el.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        const { data: logs, error } = await supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(300);

        if (error) {
            el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${error.message}</h3></div>`;
            return;
        }

        const actionLabel = {
            user_create:        'Створив користувача',
            user_delete:        'Видалив користувача',
            user_block:         'Заблокував',
            user_unblock:       'Розблокував',
            role_change:        'Змінив роль',
            ownership_transfer: 'Передав права власника',
            course_create:      'Створив курс',
            course_update:      'Оновив курс',
            course_delete:      'Видалив курс',
            news_create:        'Створив новину',
            news_update:        'Оновив новину',
            news_delete:        'Видалив новину',
            test_create:        'Створив тест',
            test_update:        'Оновив тест',
            test_delete:        'Видалив тест',
        };

        const roleColors = { owner: '#f59e0b', admin: '#6366f1', smm: '#10b981' };
        const roleLabels = { owner: 'Admin', admin: 'Адмін', smm: 'SMM' };

        const uniqueRoles   = [...new Set(logs.map(l => l.actor_role).filter(Boolean))];
        const uniqueActions = [...new Set(logs.map(l => l.action).filter(Boolean))];

        el.innerHTML = `
            <div style="display:flex;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap;align-items:center">
                <select id="log-filter-role" onchange="AdminPage._filterLogs()" style="min-width:130px">
                    <option value="">Всі ролі</option>
                    ${uniqueRoles.map(r => `<option value="${r}">${roleLabels[r]||r}</option>`).join('')}
                </select>
                <select id="log-filter-action" onchange="AdminPage._filterLogs()" style="min-width:200px">
                    <option value="">Всі дії</option>
                    ${uniqueActions.map(a => `<option value="${a}">${actionLabel[a]||a}</option>`).join('')}
                </select>
                <input id="log-filter-search" type="text" placeholder="Пошук за ПІБ або об'єктом..."
                       style="flex:1;min-width:200px" oninput="AdminPage._filterLogs()">
                <span id="log-count" style="font-size:.8rem;color:var(--text-muted)"></span>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th style="width:150px">Час</th>
                            <th>Хто</th>
                            <th>Дія</th>
                            <th>Об'єкт</th>
                            <th>Деталі</th>
                        </tr>
                    </thead>
                    <tbody id="logs-tbody">
                        ${logs.map(l => {
                            const color = roleColors[l.actor_role] || 'var(--text-muted)';
                            const meta  = l.meta ? Object.entries(l.meta).map(([k,v]) => `<span style="color:var(--text-muted)">${k}:</span> ${v}`).join(' &nbsp;') : '';
                            return `<tr data-role="${l.actor_role||''}" data-action="${l.action||''}" data-search="${(l.actor_name||'').toLowerCase()} ${(l.entity_name||'').toLowerCase()}">
                                <td style="font-size:.78rem;color:var(--text-muted);white-space:nowrap">${Fmt.datetime(l.created_at)}</td>
                                <td>
                                    <div style="font-weight:600;font-size:.875rem">${l.actor_name||'—'}</div>
                                    <span style="font-size:.72rem;font-weight:600;color:${color}">${roleLabels[l.actor_role]||l.actor_role||''}</span>
                                </td>
                                <td style="font-size:.875rem">${actionLabel[l.action]||l.action||'—'}</td>
                                <td style="font-size:.875rem">
                                    ${l.entity_type ? `<span style="font-size:.72rem;color:var(--text-muted)">${l.entity_type}</span><br>` : ''}
                                    ${l.entity_name||'—'}
                                </td>
                                <td style="font-size:.78rem">${meta}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;

        this._filterLogs();
    },

    _filterLogs() {
        const role   = document.getElementById('log-filter-role')?.value   || '';
        const action = document.getElementById('log-filter-action')?.value || '';
        const search = (document.getElementById('log-filter-search')?.value || '').toLowerCase();
        const rows   = [...document.querySelectorAll('#logs-tbody tr')];
        let count = 0;
        rows.forEach(r => {
            const match = (!role   || r.dataset.role   === role)
                       && (!action || r.dataset.action === action)
                       && (!search || r.dataset.search.includes(search));
            r.style.display = match ? '' : 'none';
            if (match) count++;
        });
        const el = document.getElementById('log-count');
        if (el) el.textContent = `Показано: ${count}`;
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

        const typeLabel = { page: '🖥 Сторінки', news: '📰 Новини', resource: '📎 Ресурси', user: '👤 Користувачі' };
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
            const title = d.full_name || d.title || d.name || d.email || item.item_id;
            return `
                <tr>
                    <td style="font-size:.85rem;font-weight:500">${title}</td>
                    <td style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${Fmt.datetime(item.deleted_at)}</td>
                    <td style="font-size:.82rem;font-weight:500;white-space:nowrap">${item.deleted_by_name}</td>
                    <td style="font-size:.78rem;white-space:nowrap">${daysLeft(item.expires_at)}</td>
                    <td style="white-space:nowrap">
                        <button class="btn btn-ghost btn-sm" onclick="AdminPage._previewTrashItem(${JSON.stringify(item).replace(/"/g,'&quot;')})"><i class="fa-solid fa-eye"></i> Перегляд</button>
                        <button class="btn btn-primary btn-sm" style="margin-left:.3rem" onclick="AdminPage._restoreTrashItem('${item.id}','${item.item_id}','${item.type}')">↩ Відновити</button>
                        <button class="btn btn-danger btn-sm" style="margin-left:.3rem" onclick="AdminPage._deleteTrashItem('${item.id}')">​<i class="fa-solid fa-trash"></i> Видалити</button>
                    </td>
                </tr>`;
        };

        if (!items.length) {
            el.innerHTML = `
                <div class="page-header">
                    <div class="page-title"><h1><i class="fa-solid fa-trash"></i> Кошик</h1><p>Видалені об'єкти зберігаються 7 днів</p></div>
                </div>
                <div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-trash"></i></div><h3>Кошик порожній</h3></div>`;
            return;
        }

        el.innerHTML = `
            <div class="page-header">
                <div class="page-title"><h1><i class="fa-solid fa-trash"></i> Кошик</h1><p>Видалені об'єкти зберігаються 7 днів. Всього: ${items.length}</p></div>
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
            const icons     = { pdf:'📄', video:'🎬', link:'🔗', scorm:'📦', file:'📎', document:'📝' };
            const iconsHtml = {
                pdf:      '<i class="fa-regular fa-file-pdf"></i>',
                video:    '<i class="fa-solid fa-video"></i>',
                image:    '<i class="fa-regular fa-file-image"></i>',
                scorm:    '<i class="fa-regular fa-file-zipper"></i>',
                document: '<i class="fa-regular fa-file-word"></i>',
                link:     '<i class="fa-regular fa-link"></i>',
                file:     '<i class="fa-regular fa-file"></i>',
            };
            title = `${icons[d.type] || '📎'} ${d.title || 'Ресурс'}`;
            const link = d.url || d.file_url;
            body += `
                <div style="display:flex;flex-direction:column;gap:.75rem">
                    <div style="display:flex;align-items:center;gap:1rem;padding:1rem;background:var(--bg-raised);border-radius:var(--radius-lg);border:1px solid var(--border)">
                        <span style="font-size:2.5rem">${iconsHtml[d.type] || iconsHtml.file}</span>
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

    async _restoreTrashItem(trashId, itemId, itemType) {
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

        const isUser = result?.type === 'user' || itemType === 'user';
        if (isUser) {
            // Re-link schedule assignments that were unlinked when account was deleted
            const userId = result?.id || itemId;
            if (userId) {
                const { error: saErr } = await supabase
                    .from('schedule_assignments')
                    .update({ user_id: userId })
                    .eq('original_user_id', userId)
                    .is('user_id', null);
                if (saErr) console.warn('schedule_assignments relink:', saErr.message);
            }
            Toast.success('Відновлено', `${result?.full_name || ''} — повернуто до графіку`);
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