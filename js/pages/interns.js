const InternsPage = {
    // ── state ─────────────────────────────────────────────────────────────────
    _container: null,
    _tab: 'list',          // 'list' | 'analytics'
    _interns: [],
    _allProfiles: [],      // for selects (profile, manager, mentor)
    _canManage: false,
    _isManager: false,
    _isViewer: false,
    _charts: [],
    _filterStatus: '',
    _filterCity: '',
    _filterManager: '',
    _search: '',
    _currentInternId: null,
    _currentIntern: null,
    _detailTab: 'info',    // 'info' | 'schedule'
    _disciplines: [],
    _editingDisciplineId: null,
    _jobSettings: [],       // [{ job_position, training_days }]

    // ── helpers ───────────────────────────────────────────────────────────────
    _calcPlannedEnd(job_position, start_date) {
        if (!start_date || !job_position) return '';
        const setting = this._jobSettings.find(s => s.job_position === job_position);
        if (!setting || !setting.training_days) return '';
        const [y, m, d] = start_date.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        dt.setUTCDate(dt.getUTCDate() + setting.training_days);
        const pad = n => String(n).padStart(2, '0');
        return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
    },

    // ── init ──────────────────────────────────────────────────────────────────
    async init(container) {
        this._container = container;
        this._tab = 'list';
        this._interns = [];
        this._canManage = AppState.isOwner();
        this._isManager = AppState.isManager();

        UI.setBreadcrumb([{ label: 'Стажери' }]);
        this._injectStyles();

        // access check for non-owner/non-manager
        if (!this._canManage && !this._isManager) {
            this._isViewer = await API.internViewers.isViewer(AppState.profile.id);
            if (!this._isViewer) { Router.go('dashboard'); return; }
        }

        container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin fa-lg"></i></div>`;

        try {
            Loader.show();
            const managerId = this._isManager ? AppState.profile.id : null;
            const [{ data: interns }, profiles, jobSettings] = await Promise.all([
                API.interns.getAll({ managerId, pageSize: 500 }),
                (this._canManage || this._isViewer) ? API.profiles.getAll({ pageSize: 500 }).then(r => r.data || []) : Promise.resolve([]),
                API.internJobSettings.getAll().catch(() => [])
            ]);
            this._interns = interns;
            this._allProfiles = profiles;
            this._jobSettings = jobSettings;
        } catch (e) {
            container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--danger)">${Fmt.esc(e.message)}</div>`;
            return;
        } finally {
            Loader.hide();
        }

        this._render();
    },

    // ── render ────────────────────────────────────────────────────────────────
    _render() {
        if (this._isManager) {
            this._renderManagerDashboard();
        } else {
            this._renderOwnerView();
        }
    },

    _renderOwnerView() {
        const c = this._container;
        c.innerHTML = `
        <div class="in-page">
            <div class="in-header">
                <div class="in-title"><i class="fa-solid fa-user-graduate"></i> Стажери</div>
                <div class="in-header-actions">
                    ${AppState.isAdmin() ? `<button class="in-btn in-btn-access" onclick="InternsPage._recalcAllDates()" title="Перерахувати планові дати для всіх стажерів з порожньою датою"><i class="fa-solid fa-rotate"></i> Дати</button>
                    <button class="in-btn in-btn-access" onclick="InternsPage._fixJobPositions()" title="Додати префікс Стажер до посад"><i class="fa-solid fa-tag"></i> Посади</button>
                    <button class="in-btn in-btn-access" onclick="InternsPage._openJobSettingsModal()"><i class="fa-solid fa-sliders"></i> Налаштування</button>
                    <button class="in-btn in-btn-access" onclick="InternsPage._archiveAllDropped()" title="Зберегти дані і видалити акаунти всіх відсіяних стажерів"><i class="fa-solid fa-box-archive"></i> Архів відсіяних</button>` : ''}
                    ${this._canManage ? `<button class="in-btn in-btn-access" onclick="InternsPage._openAccessModal()"><i class="fa-solid fa-shield-halved"></i> Доступ</button>
                    <button class="in-btn in-btn-access" onclick="InternsPage._openImportModal()"><i class="fa-solid fa-file-import"></i> Імпорт</button>
                    <button class="in-btn in-btn-primary" onclick="InternsPage._openAddModal()"><i class="fa-solid fa-plus"></i> Додати стажера</button>` : ''}
                </div>
            </div>
            <div class="in-tabs">
                <button class="in-tab ${this._tab === 'list' ? 'in-tab-active' : ''}" onclick="InternsPage._switchTab('list')"><i class="fa-solid fa-list"></i> Список</button>
                <button class="in-tab ${this._tab === 'analytics' ? 'in-tab-active' : ''}" onclick="InternsPage._switchTab('analytics')"><i class="fa-solid fa-chart-bar"></i> Аналітика HRD</button>
            </div>
            <div id="in-tab-content"></div>
        </div>`;

        if (this._tab === 'list') this._renderList();
        else this._renderAnalytics();
    },

    _switchTab(tab) {
        this._tab = tab;
        this._destroyCharts();
        const active = `in-tab-active`;
        this._container.querySelectorAll('.in-tab').forEach(b => b.classList.remove(active));
        const idx = tab === 'list' ? 0 : 1;
        this._container.querySelectorAll('.in-tab')[idx]?.classList.add(active);
        if (tab === 'list') this._renderList();
        else this._renderAnalytics();
    },

    // ── List tab ──────────────────────────────────────────────────────────────
    _renderList() {
        const area = document.getElementById('in-tab-content');
        if (!area) return;

        const cities = [...new Set(this._interns.map(i => i.profile?.city).filter(Boolean))].sort();
        const managers = [...new Map(this._interns.filter(i => i.manager).map(i => [i.manager_id, i.manager?.full_name])).entries()];

        area.innerHTML = `
        <div class="in-filters">
            <div class="in-search-wrap">
                <i class="fa-solid fa-magnifying-glass in-search-icon"></i>
                <input id="in-search" class="in-input in-search-input" placeholder="Пошук за ПІБ…" value="${Fmt.esc(this._search)}" oninput="InternsPage._onSearch(this.value)">
            </div>
            <select class="in-input in-select" onchange="InternsPage._filterChange('status', this.value)">
                <option value="">Всі статуси</option>
                <option value="active"    ${this._filterStatus==='active'    ? 'selected':''}>Навчаються</option>
                <option value="completed" ${this._filterStatus==='completed' ? 'selected':''}>Завершили</option>
                <option value="dropped"   ${this._filterStatus==='dropped'   ? 'selected':''}>Відмовились</option>
            </select>
            <select class="in-input in-select" onchange="InternsPage._filterChange('city', this.value)">
                <option value="">Всі міста</option>
                ${cities.map(c => `<option value="${Fmt.esc(c)}" ${this._filterCity===c?'selected':''}>${Fmt.esc(c)}</option>`).join('')}
            </select>
            <select class="in-input in-select" onchange="InternsPage._filterChange('manager', this.value)">
                <option value="">Всі керівники</option>
                ${managers.map(([id, name]) => `<option value="${id}" ${this._filterManager===id?'selected':''}>${Fmt.esc(name||'')}</option>`).join('')}
            </select>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:.4rem">
            <button id="in-col-toggle-btn" class="in-btn in-btn-access" onclick="InternsPage._toggleColDropdown()" title="Налаштувати стовпці">
                <i class="fa-solid fa-gear"></i> Стовпці
            </button>
        </div>
        <div id="in-table-wrap"></div>`;

        this._renderTable();
    },

    _filtered() {
        return this._interns.filter(i => {
            const name = (i.profile?.full_name || '').toLowerCase();
            if (this._search && !name.includes(this._search.toLowerCase())) return false;
            if (this._filterStatus && i.status !== this._filterStatus) return false;
            if (this._filterCity && i.profile?.city !== this._filterCity) return false;
            if (this._filterManager && i.manager_id !== this._filterManager) return false;
            return true;
        }).sort((a, b) => {
            const da = a.start_date || '';
            const db = b.start_date || '';
            return da < db ? -1 : da > db ? 1 : 0;
        });
    },

    // All toggleable columns: key, label, hidden by default
    _allCols: [
        { key: 'name',    label: 'ПІБ',          fixed: true },
        { key: 'gender',  label: 'Стать',         hidden: true },
        { key: 'city',    label: 'Місто' },
        { key: 'job',     label: 'Посада' },
        { key: 'manager', label: 'Керівник' },
        { key: 'start',   label: 'Дата початку' },
        { key: 'end',     label: 'Дата випуску' },
        { key: 'days',    label: 'Днів',          hidden: true },
        { key: 'status',  label: 'Статус' },
        { key: 'pct',     label: '% плану' },
    ],
    _colVisKey: 'in_col_vis',

    _getColVis() {
        try {
            const saved = JSON.parse(localStorage.getItem(this._colVisKey) || 'null');
            if (saved && typeof saved === 'object') return saved;
        } catch {}
        // defaults
        const def = {};
        this._allCols.forEach(c => { def[c.key] = !c.hidden; });
        return def;
    },

    _saveColVis(vis) {
        localStorage.setItem(this._colVisKey, JSON.stringify(vis));
    },

    _toggleColDropdown() {
        const existing = document.getElementById('in-col-dropdown');
        if (existing) { existing.remove(); return; }

        const vis = this._getColVis();
        const btn = document.getElementById('in-col-toggle-btn');
        const rect = btn.getBoundingClientRect();

        const dd = document.createElement('div');
        dd.id = 'in-col-dropdown';
        dd.style.cssText = `position:fixed;z-index:900;background:var(--bg-surface);border:1px solid var(--border);
            border-radius:var(--radius-lg);box-shadow:0 8px 24px rgba(0,0,0,.18);
            padding:.5rem 0;min-width:170px;top:${rect.bottom + 6}px;left:${rect.left}px`;

        dd.innerHTML = this._allCols.filter(c => !c.fixed).map(c => `
            <label style="display:flex;align-items:center;gap:.6rem;padding:.4rem .9rem;cursor:pointer;font-size:.85rem;
                color:var(--text-primary);transition:background .12s" onmouseover="this.style.background='var(--bg-raised)'" onmouseout="this.style.background=''">
                <input type="checkbox" ${vis[c.key] ? 'checked' : ''} data-col="${c.key}"
                    style="accent-color:var(--primary);width:15px;height:15px;cursor:pointer"
                    onchange="InternsPage._onColToggle('${c.key}',this.checked)">
                ${c.label}
            </label>`).join('') +
            `<div style="border-top:1px solid var(--border);margin:.4rem 0"></div>
            <button onclick="InternsPage._resetColVis()" style="width:100%;padding:.4rem .9rem;background:none;border:none;
                text-align:left;font-size:.8rem;color:var(--text-muted);cursor:pointer">Скинути до типових</button>`;

        document.body.appendChild(dd);
        setTimeout(() => document.addEventListener('click', function h(e) {
            if (!dd.contains(e.target) && e.target.id !== 'in-col-toggle-btn') {
                dd.remove(); document.removeEventListener('click', h);
            }
        }), 50);
    },

    _onColToggle(key, visible) {
        const vis = this._getColVis();
        vis[key] = visible;
        this._saveColVis(vis);
        this._applyColVis();
    },

    _resetColVis() {
        localStorage.removeItem(this._colVisKey);
        document.getElementById('in-col-dropdown')?.remove();
        this._renderTable();
    },

    _applyColVis() {
        const vis = this._getColVis();
        const table = document.querySelector('#in-table-wrap .in-table');
        if (!table) return;
        const ths = [...table.querySelectorAll('thead th[data-col]')];
        ths.forEach(th => {
            const col = th.dataset.col;
            const show = vis[col] !== false;
            const idx = [...th.parentElement.children].indexOf(th);
            th.style.display = show ? '' : 'none';
            table.querySelectorAll(`tbody tr`).forEach(tr => {
                const td = tr.children[idx];
                if (td) td.style.display = show ? '' : 'none';
            });
        });
    },

    _renderTable() {
        const wrap = document.getElementById('in-table-wrap');
        if (!wrap) return;
        const list = this._filtered();
        const vis = this._getColVis();
        const show = k => vis[k] !== false;

        if (!list.length) {
            wrap.innerHTML = `<div class="in-empty"><i class="fa-solid fa-user-graduate fa-2x"></i><div>Стажерів не знайдено</div></div>`;
            return;
        }

        wrap.innerHTML = `
        <table class="in-table">
            <thead><tr>
                <th data-col="name">ПІБ</th>
                <th data-col="gender" ${!show('gender') ? 'style="display:none"' : ''}>Стать</th>
                <th data-col="city"   ${!show('city')   ? 'style="display:none"' : ''}>Місто</th>
                <th data-col="job"    ${!show('job')    ? 'style="display:none"' : ''}>Посада</th>
                <th data-col="manager"${!show('manager')? 'style="display:none"' : ''}>Керівник</th>
                <th data-col="start"  ${!show('start')  ? 'style="display:none"' : ''}>Дата початку</th>
                <th data-col="end"    ${!show('end')    ? 'style="display:none"' : ''}>Дата випуску</th>
                <th data-col="days"   ${!show('days')   ? 'style="display:none"' : ''}>Днів</th>
                <th data-col="status" ${!show('status') ? 'style="display:none"' : ''}>Статус</th>
                <th data-col="pct"    ${!show('pct')    ? 'style="display:none"' : ''}>% плану</th>
                ${this._canManage ? '<th></th>' : ''}
            </tr></thead>
            <tbody>
            ${list.map(i => {
                const pct = this._calcPct(i);
                const snap = i.profile_snapshot || {};
                const p = i.profile || snap;
                const endDate = i.status === 'dropped' ? i.actual_end_date : i.planned_end_date;
                const days = (['dropped','completed'].includes(i.status) && i.start_date && endDate)
                    ? Math.round((new Date(endDate) - new Date(i.start_date)) / 86400000)
                    : null;
                return `<tr class="in-tr${i.status === 'dropped' ? ' in-tr-dropped' : ''}" onclick="InternsPage._openDetail('${i.id}')">
                    <td data-col="name"><div class="in-name-cell">${this._avatar(p)}<span>${Fmt.esc(p?.full_name || '—')}${!i.profile_id ? ' <span style="font-size:.7rem;color:var(--text-muted)">(архів)</span>' : ''}</span></div></td>
                    <td data-col="gender" ${!show('gender') ? 'style="display:none"' : ''} style="text-align:center;font-weight:600;color:var(--text-muted)">${p?.gender === 'male' ? 'Ч' : p?.gender === 'female' ? 'Ж' : '—'}</td>
                    <td data-col="city"   ${!show('city')   ? 'style="display:none"' : ''}>${Fmt.esc(p?.city || '—')}</td>
                    <td data-col="job"    ${!show('job')    ? 'style="display:none"' : ''}>${Fmt.esc(p?.job_position || '—')}</td>
                    <td data-col="manager"${!show('manager')? 'style="display:none"' : ''}>${Fmt.esc(i.manager?.full_name || '—')}</td>
                    <td data-col="start"  ${!show('start')  ? 'style="display:none"' : ''} class="in-td-date">${i.start_date ? Fmt.date(i.start_date) : '—'}</td>
                    <td data-col="end"    ${!show('end')    ? 'style="display:none"' : ''} class="in-td-date">${endDate ? Fmt.date(endDate) : '—'}</td>
                    <td data-col="days"   ${!show('days')   ? 'style="display:none"' : ''} style="text-align:center;color:var(--text-muted);font-size:.85rem">${days !== null ? days : '—'}</td>
                    <td data-col="status" ${!show('status') ? 'style="display:none"' : ''}>${this._statusBadge(i.status)}</td>
                    <td data-col="pct"    ${!show('pct')    ? 'style="display:none"' : ''}><div class="in-pct-wrap"><div class="in-pct-bar" style="width:${pct}%"></div><span>${pct}%</span></div></td>
                    ${this._canManage ? `<td onclick="event.stopPropagation()">
                        <button class="in-icon-btn" title="Редагувати" onclick="InternsPage._openEditModal('${i.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="in-icon-btn in-icon-btn-danger" title="Видалити" data-name="${Fmt.esc(i.profile?.full_name || '')}" onclick="InternsPage._deleteIntern('${i.id}', this.dataset.name)"><i class="fa-solid fa-trash"></i></button>
                    </td>` : ''}
                </tr>`;
            }).join('')}
            </tbody>
        </table>`;
        requestAnimationFrame(() => this._initTableResize(wrap.querySelector('.in-table')));
    },

    _onSearch(val) {
        this._search = val;
        this._renderTable();
    },

    _filterChange(field, val) {
        if (field === 'status')  this._filterStatus = val;
        if (field === 'city')    this._filterCity = val;
        if (field === 'manager') this._filterManager = val;
        this._renderTable();
    },

    // ── Manager dashboard ─────────────────────────────────────────────────────
    async _renderManagerDashboard() {
        const c = this._container;
        const list = this._interns;
        const total     = list.length;
        const active    = list.filter(i => i.status === 'active').length;
        const completed = list.filter(i => i.status === 'completed').length;
        const dropped   = list.filter(i => i.status === 'dropped').length;

        // load disciplines for current month view
        let disciplines = {};
        try {
            const all = await Promise.all(list.map(i => API.internDisciplines.getByIntern(i.id)));
            list.forEach((i, idx) => { disciplines[i.id] = all[idx]; });
        } catch (_) {}

        c.innerHTML = `
        <div class="in-page">
            <div class="in-header">
                <div class="in-title"><i class="fa-solid fa-user-graduate"></i> Мої стажери</div>
            </div>
            <div class="in-stat-row">
                ${this._statCard('Всього', total, 'fa-users', '#6366f1')}
                ${this._statCard('Навчаються', active, 'fa-user-clock', '#10b981')}
                ${this._statCard('Завершили', completed, 'fa-user-check', '#3b82f6')}
                ${this._statCard('Відмовились', dropped, 'fa-user-xmark', '#ef4444')}
            </div>
            ${!list.length ? `<div class="in-empty"><i class="fa-solid fa-user-graduate fa-2x"></i><div>У вас немає стажерів</div></div>` : `
            <table class="in-table">
                <thead><tr>
                    <th>ПІБ</th>
                    <th>Дата початку</th>
                    <th>Поточний етап</th>
                    <th>% плану</th>
                    <th>Дата випуску</th>
                    <th>Статус</th>
                </tr></thead>
                <tbody>
                ${list.map(i => {
                    const discs = disciplines[i.id] || [];
                    const current = discs.find(d => !d.is_completed);
                    const pct = discs.length ? Math.round(discs.filter(d => d.is_completed).length / discs.length * 100) : 0;
                    return `<tr class="in-tr" onclick="InternsPage._openDetail('${i.id}')">
                        <td><div class="in-name-cell">${this._avatar(i.profile)}<span>${Fmt.esc(i.profile?.full_name || '—')}</span></div></td>
                        <td>${i.start_date ? Fmt.date(i.start_date) : '—'}</td>
                        <td>${current ? Fmt.esc(current.discipline_name) : '<span style="color:var(--text-muted)">Всі виконані</span>'}</td>
                        <td><div class="in-pct-wrap"><div class="in-pct-bar" style="width:${pct}%"></div><span>${pct}%</span></div></td>
                        <td>${i.planned_end_date ? Fmt.date(i.planned_end_date) : '—'}</td>
                        <td>${this._statusBadge(i.status)}</td>
                    </tr>`;
                }).join('')}
                </tbody>
            </table>`}
        </div>`;
    },

    // ── Analytics tab ─────────────────────────────────────────────────────────
    async _renderAnalytics() {
        const area = document.getElementById('in-tab-content');
        if (!area) return;

        this._destroyCharts();

        let stats = [];
        try {
            Loader.show();
            stats = await API.interns.getStats();
        } catch (e) {
            area.innerHTML = `<div class="in-empty">${Fmt.esc(e.message)}</div>`;
            return;
        } finally {
            Loader.hide();
        }

        const total     = stats.length;
        const active    = stats.filter(i => i.status === 'active').length;
        const completed = stats.filter(i => i.status === 'completed').length;
        const dropped   = stats.filter(i => i.status === 'dropped').length;

        // monthly dynamics (by start_date)
        const monthMap = {};
        stats.filter(i => i.start_date).forEach(i => {
            const d = new Date(i.start_date + 'T12:00:00');
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            monthMap[key] = (monthMap[key] || 0) + 1;
        });
        const months = Object.keys(monthMap).sort().slice(-12);
        const monthLabels = months.map(m => { const [y,mo] = m.split('-'); return `${mo}.${y.slice(2)}`; });

        // by city
        const cityMap = {};
        stats.forEach(i => { const c = i.profile?.city || 'Невідомо'; cityMap[c] = (cityMap[c] || 0) + 1; });
        const cityEntries = Object.entries(cityMap).sort((a,b) => b[1]-a[1]).slice(0,10);

        // by manager (completion rate) — need manager info from interns list
        const mgrMap = {};
        this._interns.forEach(i => {
            if (!i.manager_id) return;
            const name = i.manager?.full_name || i.manager_id;
            if (!mgrMap[name]) mgrMap[name] = { total: 0, completed: 0 };
            mgrMap[name].total++;
            if (i.status === 'completed') mgrMap[name].completed++;
        });
        const mgrEntries = Object.entries(mgrMap).sort((a,b) => b[1].total - a[1].total).slice(0,8);

        area.innerHTML = `
        <div class="in-stat-row">
            ${this._statCard('Всього', total, 'fa-users', '#6366f1')}
            ${this._statCard('Активні', active, 'fa-user-clock', '#10b981')}
            ${this._statCard('Завершили', completed, 'fa-user-check', '#3b82f6')}
            ${this._statCard('Відмовились', dropped, 'fa-user-xmark', '#ef4444')}
        </div>
        <div class="in-charts-grid">
            <div class="in-chart-card">
                <div class="in-chart-title">Розподіл статусів</div>
                <div style="height:220px;display:flex;align-items:center;justify-content:center">
                    <canvas id="in-chart-status" style="max-height:220px"></canvas>
                </div>
            </div>
            <div class="in-chart-card">
                <div class="in-chart-title">Динаміка набору (останні 12 міс.)</div>
                <div style="height:220px"><canvas id="in-chart-months"></canvas></div>
            </div>
            <div class="in-chart-card">
                <div class="in-chart-title">По містах</div>
                <div style="height:220px"><canvas id="in-chart-cities"></canvas></div>
            </div>
            <div class="in-chart-card">
                <div class="in-chart-title">Завершили за керівником</div>
                <div style="height:220px"><canvas id="in-chart-managers"></canvas></div>
            </div>
        </div>`;

        requestAnimationFrame(() => {
            this._drawStatusChart(active, completed, dropped);
            this._drawMonthsChart(monthLabels, months.map(m => monthMap[m]));
            this._drawCitiesChart(cityEntries);
            this._drawManagersChart(mgrEntries);
        });
    },

    _drawStatusChart(active, completed, dropped) {
        const ctx = document.getElementById('in-chart-status');
        if (!ctx || !Chart) return;
        const ch = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Навчаються', 'Завершили', 'Відмовились'],
                datasets: [{ data: [active, completed, dropped],
                    backgroundColor: ['rgba(16,185,129,.75)', 'rgba(59,130,246,.75)', 'rgba(239,68,68,.75)'],
                    borderColor: ['#10b981', '#3b82f6', '#ef4444'], borderWidth: 2 }]
            },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { size: 12 } } } } }
        });
        this._charts.push(ch);
    },

    _drawMonthsChart(labels, data) {
        const ctx = document.getElementById('in-chart-months');
        if (!ctx || !Chart) return;
        const ch = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Стажерів', data,
                backgroundColor: 'rgba(99,102,241,.7)', borderColor: '#6366f1', borderWidth: 2, borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,.1)' } },
                           x: { ticks: { color: '#94a3b8' }, grid: { display: false } } } }
        });
        this._charts.push(ch);
    },

    _drawCitiesChart(entries) {
        const ctx = document.getElementById('in-chart-cities');
        if (!ctx || !Chart) return;
        const ch = new Chart(ctx, {
            type: 'bar',
            data: { labels: entries.map(e => e[0]), datasets: [{ label: 'Стажерів', data: entries.map(e => e[1]),
                backgroundColor: 'rgba(16,185,129,.7)', borderColor: '#10b981', borderWidth: 2, borderRadius: 4 }] },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,.1)' } },
                           y: { ticks: { color: '#94a3b8' }, grid: { display: false } } } }
        });
        this._charts.push(ch);
    },

    _drawManagersChart(entries) {
        const ctx = document.getElementById('in-chart-managers');
        if (!ctx || !Chart) return;
        const ch = new Chart(ctx, {
            type: 'bar',
            data: { labels: entries.map(e => e[0]),
                datasets: [
                    { label: 'Завершили', data: entries.map(e => e[1].completed), backgroundColor: 'rgba(59,130,246,.7)', borderColor: '#3b82f6', borderWidth: 2, borderRadius: 4 },
                    { label: 'Всього', data: entries.map(e => e[1].total), backgroundColor: 'rgba(99,102,241,.3)', borderColor: '#6366f1', borderWidth: 2, borderRadius: 4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } },
                scales: { y: { beginAtZero: true, ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(148,163,184,.1)' } },
                           x: { ticks: { color: '#94a3b8', maxRotation: 30 }, grid: { display: false } } } }
        });
        this._charts.push(ch);
    },

    _destroyCharts() {
        this._charts.forEach(c => { try { c.destroy(); } catch (_) {} });
        this._charts = [];
    },

    // ── Detail modal ──────────────────────────────────────────────────────────
    async _openDetail(internId) {
        this._currentInternId = internId;
        this._detailTab = 'info';
        Modal.open({ title: '<i class="fa-solid fa-user-graduate"></i> Картка стажера', size: 'lg', body: '<div style="text-align:center;padding:2rem"><i class="fa-solid fa-spinner fa-spin"></i></div>', footer: `<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Закрити</button>` });
        try {
            const intern = await API.interns.getById(internId);
            this._currentIntern = intern;
            this._disciplines = (intern.intern_disciplines || []).sort((a,b) => a.order_index - b.order_index);
            // update title with name + badge for dropped
            const mt = document.querySelector('.modal-title');
            if (mt) {
                const name = intern.profile?.full_name ? ` — ${Fmt.esc(intern.profile.full_name)}` : '';
                const badge = intern.status === 'dropped' ? ` ${this._statusBadge(intern.status)}` : '';
                mt.innerHTML = `<i class="fa-solid fa-user-graduate"></i> Картка стажера${name}${badge}`;
            }
            this._renderDetailBody(intern);
        } catch (e) {
            document.querySelector('.modal-body').innerHTML = `<div style="color:var(--danger)">${Fmt.esc(e.message)}</div>`;
        }
    },

    _renderDetailBody(intern) {
        const mb = document.querySelector('.modal-body');
        if (!mb) return;
        const canEdit = this._canManage;
        mb.innerHTML = `
        <div class="in-detail-tabs">
            <button class="in-detail-tab ${this._detailTab==='info'?'active':''}" onclick="InternsPage._switchDetailTabById('info','${intern.id}')">Інфо</button>
            <button class="in-detail-tab ${this._detailTab==='schedule'?'active':''}" onclick="InternsPage._switchDetailTabById('schedule','${intern.id}')">Розклад <span class="in-disc-count">${this._disciplines.length}</span></button>
        </div>
        <div id="in-detail-content"></div>`;
        if (this._detailTab === 'info') this._renderDetailInfo(intern);
        else this._renderDetailSchedule(intern.id);
    },

    async _switchDetailTabById(tab, internId) {
        this._detailTab = tab;
        try {
            const intern = await API.interns.getById(internId);
            this._currentIntern = intern;
            this._disciplines = (intern.intern_disciplines || []).sort((a,b) => a.order_index - b.order_index);
            this._renderDetailBody(intern);
        } catch (_) {}
    },

    _renderDetailInfo(intern) {
        const dc = document.getElementById('in-detail-content');
        if (!dc) return;
        const p = intern.profile || {};
        const phone = p.phone ? `<a href="tel:${Fmt.esc(p.phone)}" style="color:var(--primary)">${Fmt.esc(p.phone)}</a>` : '—';
        const pct = this._calcPct(intern);
        dc.innerHTML = `
        <div class="in-info-grid">
            <div class="in-info-row"><span class="in-info-label">ПІБ</span><span>${Fmt.esc(p.full_name||'—')}</span></div>
            <div class="in-info-row"><span class="in-info-label">Місто</span><span>${Fmt.esc(p.city||'—')}</span></div>
            <div class="in-info-row"><span class="in-info-label">Посада</span><span>${Fmt.esc(p.job_position||'—')}</span></div>
            <div class="in-info-row"><span class="in-info-label">Телефон</span><span>${phone}</span></div>
            <div class="in-info-row"><span class="in-info-label">Керівник</span><span>${Fmt.esc(intern.manager?.full_name||'—')}</span></div>
            ${intern.group_number ? `<div class="in-info-row"><span class="in-info-label">№ групи</span><span>${Fmt.esc(intern.group_number)}</span></div>` : ''}
            <div class="in-info-row"><span class="in-info-label">Початок</span><span>${intern.start_date ? Fmt.date(intern.start_date) : '—'}</span></div>
            <div class="in-info-row"><span class="in-info-label">Плановий випуск</span><span>${intern.planned_end_date ? Fmt.date(intern.planned_end_date) : '—'}</span></div>
            ${intern.status === 'dropped' ? `
            <div class="in-info-row"><span class="in-info-label">Дата відмови</span><span style="color:#ef4444;font-weight:600">${intern.actual_end_date ? Fmt.date(intern.actual_end_date) : '—'}</span></div>
            <div class="in-info-row"><span class="in-info-label">Статус</span><span style="display:flex;align-items:center;gap:.5rem">${this._statusBadge(intern.status)}</span></div>
            ` : `
            <div class="in-info-row"><span class="in-info-label">Фактичний випуск</span><span>${intern.actual_end_date ? Fmt.date(intern.actual_end_date) : '—'}</span></div>
            <div class="in-info-row"><span class="in-info-label">Статус</span><span>${this._statusBadge(intern.status)}</span></div>
            `}
            <div class="in-info-row"><span class="in-info-label">% плану</span><span>
                <div class="in-pct-wrap" style="max-width:160px"><div class="in-pct-bar" style="width:${pct}%"></div><span>${pct}%</span></div>
            </span></div>
            ${intern.notes ? `<div class="in-info-row in-info-full"><span class="in-info-label">Нотатки</span><span>${Fmt.esc(intern.notes)}</span></div>` : ''}
        </div>
        ${this._canManage ? `<div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap">
            <button class="in-btn in-btn-primary" onclick="InternsPage._openEditModal('${intern.id}')"><i class="fa-solid fa-pen"></i> Редагувати</button>
            ${intern.status === 'active' ? `<button class="in-btn in-btn-graduate" onclick="InternsPage._openGraduateModal('${intern.id}')"><i class="fa-solid fa-graduation-cap"></i> Випустити</button>` : ''}
        </div>` : ''}`;
    },

    _renderDetailSchedule(internId) {
        const dc = document.getElementById('in-detail-content');
        if (!dc) return;
        const discs = this._disciplines;

        dc.innerHTML = `
        <div id="in-disc-list">
        ${!discs.length ? `<div class="in-empty" style="padding:2rem"><i class="fa-solid fa-calendar-days"></i><div>Дисциплін ще немає</div></div>` :
        discs.map((d, idx) => `
        <div class="in-disc-card ${d.is_completed ? 'in-disc-done' : ''}">
            <div class="in-disc-header">
                <div class="in-disc-order">${idx+1}</div>
                <div class="in-disc-name">${Fmt.esc(d.discipline_name)}</div>
                <div class="in-disc-actions">
                    ${this._canManage ? `
                    <button class="in-icon-btn" onclick="InternsPage._editDisc('${d.id}')" title="Редагувати"><i class="fa-solid fa-pen"></i></button>
                    <button class="in-icon-btn in-icon-btn-danger" data-name="${Fmt.esc(d.discipline_name)}" onclick="InternsPage._deleteDisc('${d.id}', this.dataset.name)" title="Видалити"><i class="fa-solid fa-trash"></i></button>
                    ` : ''}
                    <button class="in-disc-check ${d.is_completed ? 'in-disc-check-done' : ''}" onclick="InternsPage._toggleDisc('${d.id}', ${d.is_completed}, '${internId}')" title="${d.is_completed ? 'Скасувати' : 'Відмітити виконаною'}">
                        <i class="fa-solid ${d.is_completed ? 'fa-circle-check' : 'fa-circle'}"></i>
                    </button>
                </div>
            </div>
            ${(d.date || d.address || d.mentor?.full_name) ? `<div class="in-disc-meta">
                ${d.date ? `<span><i class="fa-regular fa-calendar"></i> ${Fmt.date(d.date)}</span>` : ''}
                ${d.address ? `<span><i class="fa-solid fa-location-dot"></i> ${Fmt.esc(d.address)}</span>` : ''}
                ${d.mentor?.full_name ? `<span><i class="fa-solid fa-chalkboard-user"></i> ${Fmt.esc(d.mentor.full_name)}</span>` : ''}
            </div>` : ''}
            ${d.notes ? `<div class="in-disc-notes">${Fmt.esc(d.notes)}</div>` : ''}
        </div>`).join('')}
        </div>
        ${this._canManage ? `<button class="in-btn in-btn-primary" style="margin-top:1rem" onclick="InternsPage._addDiscModal('${internId}')"><i class="fa-solid fa-plus"></i> Додати дисципліну</button>` : ''}`;
    },

    async _toggleDisc(discId, current, internId) {
        try {
            await API.internDisciplines.update(discId, { is_completed: !current });
            const discs = await API.internDisciplines.getByIntern(internId);
            this._disciplines = discs.sort((a,b) => a.order_index - b.order_index);
            // update pct in table row
            const intern = this._interns.find(i => i.id === internId);
            if (intern) {
                intern._discsCache = discs;
                this._renderTable();
            }
            this._renderDetailSchedule(internId);
        } catch (e) { Toast.error('Помилка', e.message); }
    },

    _calcPct(intern) {
        const discs = intern._discsCache || intern.intern_disciplines;
        if (!discs || !discs.length) return 0;
        return Math.round(discs.filter(d => d.is_completed).length / discs.length * 100);
    },

    // ── Add/Edit intern modal ─────────────────────────────────────────────────
    _internFormState: {},

    _openAddModal() {
        this._internFormState = {};
        this._renderInternModal(null);
    },

    async _openEditModal(internId) {
        Modal.close();
        try {
            Loader.show();
            const intern = await API.interns.getById(internId);
            this._internFormState = { ...intern };
            this._renderInternModal(intern);
        } catch (e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _renderInternModal(intern) {
        const isEdit = !!intern;
        const profiles = this._allProfiles;
        const statusOpts = [
            { v: 'active',    l: 'Навчається' },
            { v: 'completed', l: 'Завершив' },
            { v: 'dropped',   l: 'Відмовився' }
        ];
        Modal.open({
            title: `<i class="fa-solid fa-user-graduate" style="color:#8b5cf6"></i> ${isEdit ? 'Редагування стажера' : 'Новий стажер'}`,
            size: 'lg',
            body: `
            <div class="in-form">
                <div class="in-form-group">
                    <label class="in-form-label">Стажер <span style="color:var(--danger)">*</span></label>
                    <select id="inf-profile" class="in-input" onchange="InternsPage._onFormDateChange()">
                        <option value="">— Обрати профіль —</option>
                        ${profiles.map(p => `<option value="${p.id}" data-job="${Fmt.esc(p.job_position||'')}" ${intern?.profile_id===p.id?'selected':''}>${Fmt.esc(p.full_name)} ${p.city?`(${Fmt.esc(p.city)})`:''}${p.job_position?` — ${Fmt.esc(p.job_position)}`:''}</option>`).join('')}
                    </select>
                </div>
                <div class="in-form-group">
                    <label class="in-form-label">Керівник</label>
                    <select id="inf-manager" class="in-input">
                        <option value="">— Без керівника —</option>
                        ${profiles.map(p => `<option value="${p.id}" ${intern?.manager_id===p.id?'selected':''}>${Fmt.esc(p.full_name)}</option>`).join('')}
                    </select>
                </div>
                <div class="in-form-row">
                    <div class="in-form-group">
                        <label class="in-form-label">Дата початку</label>
                        <input id="inf-start" type="date" class="in-input" value="${intern?.start_date||''}" oninput="InternsPage._onFormDateChange()">
                    </div>
                    <div class="in-form-group">
                        <label class="in-form-label" style="display:flex;align-items:center;justify-content:space-between">
                            <span>Плановий випуск</span>
                            <button type="button" title="Розрахувати автоматично" style="background:none;border:none;cursor:pointer;color:var(--primary);font-size:.8rem;padding:0;display:flex;align-items:center;gap:.3rem" onclick="InternsPage._onFormDateChange(true)">
                                <i class="fa-solid fa-rotate"></i> авто
                            </button>
                        </label>
                        <input id="inf-end" type="date" class="in-input" value="${intern?.planned_end_date||''}">
                    </div>
                </div>
                <div class="in-form-group">
                    <label class="in-form-label">Статус</label>
                    <select id="inf-status" class="in-input" onchange="InternsPage._onStatusChange()">
                        ${statusOpts.map(o => `<option value="${o.v}" ${(intern?.status||'active')===o.v?'selected':''}>${o.l}</option>`).join('')}
                    </select>
                </div>
                <div id="inf-dropped-wrap" class="in-form-group" style="${(intern?.status||'active')==='dropped'?'':'display:none'}">
                    <label class="in-form-label">Дата відмови</label>
                    <input id="inf-actual-end" type="date" class="in-input" value="${intern?.actual_end_date||''}">
                </div>
                <div class="in-form-group">
                    <label class="in-form-label">Нотатки</label>
                    <textarea id="inf-notes" class="in-input" rows="3" style="resize:vertical">${Fmt.esc(intern?.notes||'')}</textarea>
                </div>
            </div>`,
            footer: `
            <button class="btn btn-sm" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;border:none" onclick="InternsPage._saveIntern(${isEdit ? `'${intern.id}'` : 'null'})">
                <i class="fa-solid ${isEdit ? 'fa-floppy-disk' : 'fa-plus'}"></i> ${isEdit ? 'Зберегти' : 'Додати'}
            </button>
            <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>`
        });
        // auto-calculate on open if planned_end_date is empty
        if (!intern?.planned_end_date) requestAnimationFrame(() => this._onFormDateChange());
    },

    _onStatusChange() {
        const status = document.getElementById('inf-status')?.value;
        const wrap   = document.getElementById('inf-dropped-wrap');
        const input  = document.getElementById('inf-actual-end');
        if (!wrap || !input) return;
        if (status === 'dropped') {
            wrap.style.display = '';
            if (!input.value) {
                const today = new Date();
                const pad = n => String(n).padStart(2, '0');
                input.value = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
            }
        } else {
            wrap.style.display = 'none';
        }
    },

    _onFormDateChange(force = false) {
        const profileSel = document.getElementById('inf-profile');
        const startInput = document.getElementById('inf-start');
        const endInput   = document.getElementById('inf-end');
        if (!profileSel || !startInput || !endInput) return;
        // don't overwrite manually set value unless force=true
        if (!force && endInput.value) return;
        const selectedOpt = profileSel.options[profileSel.selectedIndex];
        const jobPosition = selectedOpt?.dataset.job || '';
        const planned = this._calcPlannedEnd(jobPosition, startInput.value);
        if (planned) endInput.value = planned;
        else if (force) Toast.warning('Для цієї посади не встановлено кількість днів навчання');
    },

    async _saveIntern(internId) {
        const profileId   = Dom.val('inf-profile');
        const managerId   = Dom.val('inf-manager');
        const start       = Dom.val('inf-start');
        const end         = Dom.val('inf-end');
        const status      = Dom.val('inf-status');
        const notes       = Dom.val('inf-notes');
        const actualEnd   = Dom.val('inf-actual-end');

        if (!profileId) { Toast.warning('Оберіть стажера'); return; }

        const payload = {
            profile_id:       profileId,
            manager_id:       managerId || null,
            start_date:       start     || null,
            planned_end_date: end       || null,
            status,
            notes:            notes     || null,
            actual_end_date:  status === 'dropped' ? (actualEnd || null) : undefined,
        };
        // remove undefined keys so API.interns.update doesn't overwrite with undefined
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

        try {
            Loader.show();
            if (internId) {
                // Check if status is being changed to dropped
                const prev = this._interns.find(i => i.id === internId);
                const becomingDropped = status === 'dropped' && prev?.status !== 'dropped';
                await API.interns.update(internId, payload);
                if (becomingDropped && prev?.profile_id) {
                    try {
                        await API.interns.archiveDropped(internId);
                        Toast.success('Збережено', 'Акаунт стажера видалено, дані збережено в архіві');
                    } catch (archErr) {
                        Toast.warning('Збережено', `Не вдалось видалити акаунт: ${archErr.message}`);
                    }
                } else {
                    Toast.success('Збережено');
                }
            } else {
                await API.interns.create(payload);
                Toast.success('Стажера додано');
            }
            Modal.close();
            await this._reload();
        } catch (e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _deleteIntern(internId, name) {
        const ok = await Modal.confirm({ message: `Видалити стажера «${name}»?`, confirmText: 'Видалити', danger: true });
        if (!ok) return;
        try {
            Loader.show();
            await API.interns.remove(internId);
            Toast.success('Видалено');
            await this._reload();
        } catch (e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Graduate modal ────────────────────────────────────────────────────────
    _graduateState: { allDovs: [], selectedDovIds: new Set() },

    async _openGraduateModal(internId) {
        Modal.open({
            title: '<i class="fa-solid fa-graduation-cap" style="color:#8b5cf6"></i> Випуск стажера',
            size: 'lg',
            body: '<div style="text-align:center;padding:2rem"><i class="fa-solid fa-spinner fa-spin"></i></div>',
            footer: '<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>'
        });
        try {
            const intern = this._currentIntern?.id === internId
                ? this._currentIntern
                : await API.interns.getById(internId);
            const [allDovs, currentDovs] = await Promise.all([
                API.dovirenosti.getAll(),
                API.dovirenosti.getForProfile(intern.profile_id).catch(() => [])
            ]);
            this._graduateState.allDovs = allDovs;
            this._graduateState.selectedDovIds = new Set(currentDovs.map(d => d.id));
            this._renderGraduateModal(intern);
        } catch (e) {
            const mb = document.querySelector('.modal-body');
            if (mb) mb.innerHTML = `<div style="color:var(--danger)">${Fmt.esc(e.message)}</div>`;
        }
    },

    _renderGraduateModal(intern) {
        const mb = document.querySelector('.modal-body');
        const mf = document.querySelector('.modal-footer');
        if (!mb) return;
        const name = intern.profile?.full_name || '—';
        const currentPos = intern.profile?.job_position || '';
        const { allDovs, selectedDovIds } = this._graduateState;

        mb.innerHTML = `
        <div style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;background:color-mix(in srgb,#10b981 8%,var(--bg-surface));border:1.5px solid color-mix(in srgb,#10b981 25%,var(--border));border-radius:10px;margin-bottom:1.25rem">
            ${this._avatar(intern.profile, 40)}
            <div>
                <div style="font-weight:700">${Fmt.esc(name)}</div>
                <div style="font-size:.8rem;color:var(--text-muted)">${Fmt.esc(intern.profile?.city || '')}${intern.profile?.job_position ? ' · ' + Fmt.esc(intern.profile.job_position) : ''}</div>
            </div>
            <div style="margin-left:auto">${this._statusBadge('active')}</div>
        </div>
        <div class="in-form">
            <div class="in-form-group">
                <label class="in-form-label">Нова посада <span style="color:var(--danger)">*</span></label>
                <input id="igr-position" class="in-input" placeholder="Введіть нову посаду" value="${Fmt.esc(currentPos)}">
                <div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">Поточна: ${Fmt.esc(currentPos || 'не вказана')} — буде замінена. Мітка «Стажер» знімається автоматично.</div>
            </div>
            <div class="in-form-group">
                <label class="in-form-label">Довіреності</label>
                <div class="in-dov-list">
                    ${allDovs.length ? allDovs.map(d => `
                    <label class="in-dov-item">
                        <input type="checkbox" data-dov-id="${d.id}" ${selectedDovIds.has(d.id) ? 'checked' : ''} onchange="InternsPage._toggleGradDov('${d.id}', this.checked)">
                        <span>${Fmt.esc(d.name)}</span>
                    </label>`).join('') : '<span style="color:var(--text-muted);font-size:.85rem">Довіреностей немає</span>'}
                </div>
            </div>
        </div>`;

        if (mf) mf.innerHTML = `
            <button class="btn btn-sm" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;box-shadow:0 3px 10px rgba(16,185,129,.3)" onclick="InternsPage._confirmGraduate('${intern.id}','${intern.profile_id}')">
                <i class="fa-solid fa-graduation-cap"></i> Підтвердити випуск
            </button>
            <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>`;
    },

    _toggleGradDov(dovId, checked) {
        if (checked) this._graduateState.selectedDovIds.add(dovId);
        else this._graduateState.selectedDovIds.delete(dovId);
    },

    async _confirmGraduate(internId, profileId) {
        const newPosition = document.getElementById('igr-position')?.value.trim();
        if (!newPosition) { Toast.warning('Вкажіть нову посаду'); return; }

        try {
            Loader.show();
            await Promise.all([
                API.interns.update(internId, { status: 'completed' }),
                API.profiles.update(profileId, { job_position: newPosition, label: null }),
                API.dovirenosti.setForProfile(profileId, [...this._graduateState.selectedDovIds])
            ]);
            Modal.close();
            Toast.success('Стажера випущено', `${newPosition} — мітку стажера знято`);
            await this._reload();
        } catch (e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Discipline modal ──────────────────────────────────────────────────────
    _addDiscModal(internId) {
        this._editingDisciplineId = null;
        this._renderDiscModal(internId, null);
    },

    async _editDisc(discId) {
        this._editingDisciplineId = discId;
        const disc = this._disciplines.find(d => d.id === discId);
        if (!disc) return;
        this._renderDiscModal(disc.intern_id, disc);
    },

    _renderDiscModal(internId, disc) {
        const profiles = this._allProfiles;
        Modal.open({
            title: `<i class="fa-solid fa-calendar-days" style="color:#8b5cf6"></i> ${disc ? 'Редагування дисципліни' : 'Нова дисципліна'}`,
            size: 'lg',
            body: `
            <div class="in-form">
                <div class="in-form-group">
                    <label class="in-form-label">Назва дисципліни <span style="color:var(--danger)">*</span></label>
                    <input id="idf-name" class="in-input" placeholder="Назва" value="${Fmt.esc(disc?.discipline_name||'')}">
                </div>
                <div class="in-form-row">
                    <div class="in-form-group">
                        <label class="in-form-label">Дата</label>
                        <input id="idf-date" type="date" class="in-input" value="${disc?.date||''}">
                    </div>
                    <div class="in-form-group">
                        <label class="in-form-label">Адреса</label>
                        <input id="idf-address" class="in-input" placeholder="Адреса" value="${Fmt.esc(disc?.address||'')}">
                    </div>
                </div>
                <div class="in-form-group">
                    <label class="in-form-label">Наставник</label>
                    <select id="idf-mentor" class="in-input">
                        <option value="">— Без наставника —</option>
                        ${profiles.map(p => `<option value="${p.id}" ${disc?.mentor_id===p.id?'selected':''}>${Fmt.esc(p.full_name)}</option>`).join('')}
                    </select>
                </div>
                <div class="in-form-group">
                    <label class="in-form-label">Нотатки</label>
                    <textarea id="idf-notes" class="in-input" rows="2" style="resize:vertical">${Fmt.esc(disc?.notes||'')}</textarea>
                </div>
            </div>`,
            footer: `
            <button class="btn btn-sm" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;border:none" onclick="InternsPage._saveDisc('${internId}', ${disc ? `'${disc.id}'` : 'null'})">
                <i class="fa-solid ${disc ? 'fa-floppy-disk' : 'fa-plus'}"></i> ${disc ? 'Зберегти' : 'Додати'}
            </button>
            <button class="btn btn-ghost btn-sm" onclick="InternsPage._backToDetail('${internId}')">Скасувати</button>`
        });
    },

    async _saveDisc(internId, discId) {
        const name    = Dom.val('idf-name').trim();
        const date    = Dom.val('idf-date');
        const address = Dom.val('idf-address').trim();
        const mentor  = Dom.val('idf-mentor');
        const notes   = Dom.val('idf-notes').trim();

        if (!name) { Toast.warning('Введіть назву дисципліни'); return; }

        const payload = {
            intern_id:       internId,
            discipline_name: name,
            date:            date    || null,
            address:         address || null,
            mentor_id:       mentor  || null,
            notes:           notes   || null,
            order_index:     discId ? (this._disciplines.find(d => d.id === discId)?.order_index ?? 0) : this._disciplines.length
        };

        try {
            Loader.show();
            if (discId) {
                await API.internDisciplines.update(discId, payload);
            } else {
                await API.internDisciplines.create(payload);
            }
            await this._backToDetail(internId);
        } catch (e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _deleteDisc(discId, name) {
        const ok = await Modal.confirm({ message: `Видалити дисципліну «${name}»?`, confirmText: 'Видалити', danger: true });
        if (!ok) return;
        try {
            Loader.show();
            const disc = this._disciplines.find(d => d.id === discId);
            const internId = disc?.intern_id;
            await API.internDisciplines.remove(discId);
            if (internId) await this._backToDetail(internId);
        } catch (e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _backToDetail(internId) {
        this._detailTab = 'schedule';
        try {
            const intern = await API.interns.getById(internId);
            this._currentIntern = intern;
            this._disciplines = (intern.intern_disciplines || []).sort((a,b) => a.order_index - b.order_index);
            this._renderDetailBody(intern);
        } catch (e) { Toast.error('Помилка', e.message); }
    },

    // ── Access (intern_viewers) modal ─────────────────────────────────────────
    async _openAccessModal() {
        Modal.open({ title: '<i class="fa-solid fa-shield-halved" style="color:#8b5cf6"></i> Доступ до розділу', size: 'lg',
            body: '<div style="text-align:center;padding:2rem"><i class="fa-solid fa-spinner fa-spin"></i></div>',
            footer: '<button class="btn btn-ghost btn-sm" onclick="Modal.close()">Закрити</button>' });
        try {
            const viewers = await API.internViewers.getAll();
            this._renderAccessBody(viewers);
        } catch (e) {
            document.querySelector('.modal-body').innerHTML = `<div style="color:var(--danger)">${Fmt.esc(e.message)}</div>`;
        }
    },

    _renderAccessBody(viewers) {
        const mb = document.querySelector('.modal-body');
        if (!mb) return;
        const viewerIds = new Set(viewers.map(v => v.profile_id));
        const candidates = this._allProfiles.filter(p => !viewerIds.has(p.id) && p.id !== AppState.profile.id);
        mb.innerHTML = `
        <div class="in-form-group" style="margin-bottom:1rem">
            <label class="in-form-label">Додати профіль</label>
            <div style="display:flex;gap:.5rem">
                <select id="in-viewer-select" class="in-input" style="flex:1">
                    <option value="">— Оберіть профіль —</option>
                    ${candidates.map(p => `<option value="${p.id}">${Fmt.esc(p.full_name)}${p.city?` (${Fmt.esc(p.city)})`:''}</option>`).join('')}
                </select>
                <button class="in-btn in-btn-primary" onclick="InternsPage._addViewer()"><i class="fa-solid fa-plus"></i> Додати</button>
            </div>
        </div>
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted);margin-bottom:.5rem">Поточний доступ</div>
        ${!viewers.length ? `<div style="color:var(--text-muted);font-size:.875rem">Нікому не надано доступ</div>` :
        viewers.map(v => `<div class="in-viewer-row">
            ${this._avatar(v.profile, 28)}
            <span style="flex:1">${Fmt.esc(v.profile?.full_name||'—')}</span>
            <span style="font-size:.8rem;color:var(--text-muted)">${v.granted_at ? Fmt.date(v.granted_at) : ''}</span>
            <button class="in-icon-btn in-icon-btn-danger" data-name="${Fmt.esc(v.profile?.full_name||'')}" onclick="InternsPage._removeViewer('${v.profile_id}', this.dataset.name)"><i class="fa-solid fa-xmark"></i></button>
        </div>`).join('')}`;
    },

    async _addViewer() {
        const profileId = Dom.val('in-viewer-select');
        if (!profileId) { Toast.warning('Оберіть профіль'); return; }
        try {
            Loader.show();
            await API.internViewers.add(profileId);
            Toast.success('Доступ надано');
            const viewers = await API.internViewers.getAll();
            this._renderAccessBody(viewers);
        } catch (e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _removeViewer(profileId, name) {
        const ok = await Modal.confirm({ message: `Відкликати доступ у «${name}»?`, confirmText: 'Відкликати', danger: true });
        if (!ok) return;
        try {
            Loader.show();
            await API.internViewers.remove(profileId);
            Toast.success('Доступ відкликано');
            const viewers = await API.internViewers.getAll();
            this._renderAccessBody(viewers);
        } catch (e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Helpers ───────────────────────────────────────────────────────────────
    async _reload() {
        const managerId = this._isManager ? AppState.profile.id : null;
        const [{ data: interns }, profiles] = await Promise.all([
            API.interns.getAll({ managerId, pageSize: 500 }),
            (this._canManage || this._isViewer) ? API.profiles.getAll({ pageSize: 500 }).then(r => r.data || []) : Promise.resolve(this._allProfiles)
        ]);
        this._interns = interns;
        this._allProfiles = profiles;
        this._render();
    },

    _statusBadge(status) {
        const map = { active: ['badge-success', 'Навчається'], completed: ['badge-info', 'Завершив'], dropped: ['badge-danger', 'Відмовився'] };
        const [cls, label] = map[status] || ['badge-secondary', status];
        return `<span class="badge ${cls}">${label}</span>`;
    },

    _avatar(profile, size = 32) {
        const name = profile?.full_name || '?';
        if (profile?.avatar_url) {
            const url = APP_CONFIG.storagePublicUrl + '/avatars/' + profile.avatar_url;
            return `<img src="${Fmt.safeUrl(url)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="">`;
        }
        const initials = Fmt.initials(name);
        return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#6366f1);display:flex;align-items:center;justify-content:center;color:#fff;font-size:${Math.round(size*0.35)}px;font-weight:700;flex-shrink:0">${Fmt.esc(initials)}</div>`;
    },

    _statCard(label, value, icon, color) {
        return `<div class="in-stat-card">
            <div class="in-stat-icon" style="background:color-mix(in srgb,${color} 14%,var(--bg-surface))"><i class="fa-solid ${icon}" style="color:${color}"></i></div>
            <div><div class="in-stat-value">${value}</div><div class="in-stat-label">${label}</div></div>
        </div>`;
    },

    // ── Import ────────────────────────────────────────────────────────────────
    _importRows: [],
    _importCols: ['start_date','group_number','pib','city','job_position','manager_name','phone','birth_date','email','subdivision','gender'],
    _importHeaders: ['Дата початку','№ групи','ПІБ','Місто','Посада','Керівник','Телефон','Дата народження','Пошта','Підрозділ','Стать'],

    _openImportModal() {
        this._importRows = [];
        Modal.open({
            title: '<i class="fa-solid fa-file-import" style="color:#8b5cf6"></i> Імпорт стажерів',
            size: 'lg',
            body: `
            <p style="color:var(--text-secondary);font-size:.875rem;margin:0 0 1rem">
                Завантажте CSV-файл. Обов'язкове поле: <strong>ПІБ</strong>.
                Пошта — авто (⚡ ім'я транслітом). Пароль — з дати нар. або <code>Stazher1!</code>.
                Підтримується формат реєстру стажерів (Статус, Дата завершення). Роздільник — <code>;</code>.
            </p>
            <div style="display:flex;gap:.75rem;margin-bottom:1.25rem;align-items:center">
                <button class="btn btn-ghost btn-sm" onclick="InternsPage._downloadImportExample()"><i class="fa-solid fa-download"></i> Завантажити приклад</button>
            </div>
            <label style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.75rem;padding:2rem;border:2px dashed var(--border);border-radius:12px;cursor:pointer;transition:border-color .15s" onmouseover="this.style.borderColor='#8b5cf6'" onmouseout="this.style.borderColor='var(--border)'">
                <i class="fa-solid fa-file-csv" style="font-size:2rem;color:#8b5cf6"></i>
                <span style="font-weight:600">Натисніть або перетягніть CSV-файл</span>
                <span style="font-size:.78rem;color:var(--text-muted)">CSV, TXT · UTF-8</span>
                <input type="file" id="in-import-file" accept=".csv,.txt" style="display:none" onchange="InternsPage._onImportFile(this)">
            </label>
            <div id="in-import-preview"></div>`,
            footer: `
            <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>
            <button class="btn btn-sm" id="in-import-run-btn" style="display:none;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;border:none" onclick="InternsPage._runImport()"><i class="fa-solid fa-file-import"></i> Імпортувати</button>`
        });
    },

    _downloadImportExample() {
        const header = this._importHeaders.join(';');
        const rows = [
            '01.09.2024;Група-1;Іваненко Олег Петрович;Київ;Касир;Коваленко Ірина;+380501234567;15.05.2000;oleg@company.com;Відділення №1;Ч',
            '01.09.2024;Група-1;Коваль Марія Андріївна;Львів;Бухгалтер;Петренко Василь;+380671112233;20.11.2001;maria@company.com;Відділення №2;Ж',
        ];
        const bom = '﻿';
        const blob = new Blob([bom + [header, ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'interns_import_example.csv';
        a.click();
    },

    _onImportFile(input) {
        const file = input.files[0];
        if (!file) return;
        input.value = '';
        const reader = new FileReader();
        reader.onload = e => {
            const text = e.target.result.replace(/^﻿/, '');
            this._importRows = this._parseImportCSV(text);
            this._renderImportPreview();
        };
        reader.readAsText(file, 'UTF-8');
    },

    _csvParseRows(text, delim) {
        // Full RFC-4180 parser: handles quoted fields with embedded newlines and semicolons
        const rows = [];
        let row = [], field = '', inQ = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inQ) {
                if (ch === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
                    else inQ = false;
                } else { field += ch; }
            } else {
                if (ch === '"') { inQ = true; }
                else if (ch === delim) { row.push(field.trim()); field = ''; }
                else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
                    if (ch === '\r') i++;
                    row.push(field.trim()); rows.push(row); row = []; field = '';
                } else { field += ch; }
            }
        }
        if (field || row.length) { row.push(field.trim()); rows.push(row); }
        return rows.filter(r => r.some(c => c));
    },

    _parseImportCSV(text) {
        text = text.replace(/^﻿/, '');
        // Detect delimiter by counting unquoted occurrences in first 2000 chars
        const sample = text.slice(0, 2000);
        let inQ = false, semis = 0, commas = 0;
        for (const ch of sample) {
            if (ch === '"') { inQ = !inQ; continue; }
            if (inQ) continue;
            if (ch === ';') semis++;
            if (ch === ',') commas++;
        }
        const delim = semis >= commas ? ';' : ',';
        const rows = this._csvParseRows(text, delim);
        if (rows.length < 2) return [];
        // Normalize headers: collapse inner newlines/spaces, lowercase
        const rawHeaders = rows[0].map(h => h.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase());

        const colAlias = {
            'дата початку':'start_date','дата початку навчання':'start_date','start_date':'start_date',
            '№ групи':'group_number','группа':'group_number','група':'group_number','group':'group_number','group_number':'group_number',
            'піб':'pib','піб стажера':'pib','фіо':'pib','пиб':'pib','фио':'pib','pib':'pib','full_name':'pib',
            'місто':'city','город':'city','city':'city',
            'посада':'job_position','должность':'job_position','job_position':'job_position',
            'керівник':'manager_name','піб керівника':'manager_name','руководитель':'manager_name','manager':'manager_name','manager_name':'manager_name',
            'телефон':'phone','phone':'phone','тел':'phone','номер телефону':'phone',
            'дата народження':'birth_date','дата рождения':'birth_date','birth_date':'birth_date',
            'пошта':'email','email':'email','e-mail':'email','почта':'email',
            'підрозділ':'subdivision','подразделение':'subdivision','subdivision':'subdivision',
            'стать':'gender','гендер':'gender','пол':'gender','gender':'gender',
            'дата завершення':'end_date','дата завершення навчання':'end_date','end_date':'end_date',
            'статус':'status_raw','status':'status_raw',
            'кількість днів':'_skip','кількість днів навчання':'_skip',
            'дата початок навчання':'start_date','дата початок':'start_date',
            'піб керівника':'manager_name','піб керівника ':'manager_name',
            'кількість днів навчання ':'_skip','кількість днів ':'_skip',
        };
        const colMap = rawHeaders.map(h => colAlias[h] || null);

        const _normGender = v => {
            if (!v) return '';
            const s = v.trim().toLowerCase();
            if (s === 'ч' || s === 'м' || s === 'male' || s === 'чоловік' || s === 'мужской') return 'male';
            if (s === 'ж' || s === 'f' || s === 'female' || s === 'жінка' || s === 'женский') return 'female';
            return '';
        };
        const _genderByPatronymic = p => {
            if (!p) return '';
            const s = p.trim().toLowerCase();
            if (s.includes('ович') || s.includes('евич') || s.includes('євич')) return 'male';
            if (s.includes('овна') || s.includes('івна') || s.includes('євна') || s.includes('ївна')) return 'female';
            return '';
        };

        const _normDate = v => {
            if (!v) return '';
            if (/^\d{2}\.\d{2}\.\d{4}$/.test(v)) { const [d,m,y] = v.split('.'); return `${y}-${m}-${d}`; }
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
            return v;
        };
        const _normStatus = v => {
            if (!v) return 'active';
            const s = v.trim().toLowerCase();
            if (s.includes('відмовив') || s.includes('відмовила') || s === 'dropped') return 'dropped';
            if (s.includes('завершив') || s.includes('завершила') || s === 'completed') return 'completed';
            return 'active';
        };
        const _translit = str => {
            const map = {'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye','ж':'zh','з':'z',
                'и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p',
                'р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh',
                'щ':'shch','ь':'','ю':'yu','я':'ya',' ':'.'};
            return (str || '').toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : c).join('').replace(/[^a-z0-9.-]/g,'').replace(/\.{2,}/g,'.').replace(/^\.|\.$/, '');
        };

        const usedEmails = new Set();
        return rows.slice(1).map((vals, idx) => {
            const row = { _line: idx + 2 };
            colMap.forEach((key, i) => { if (key && key !== '_skip') row[key] = vals[i] || ''; });

            // Fix phone: Excel may export as scientific notation (3.80509E+11 → +380509...)
            if (row.phone) {
                const ph = row.phone.replace(/\s/g, '').replace(',', '.');
                if (/^[\d.,]+[Ee][+\-]?\d+$/.test(ph)) {
                    const num = Math.round(parseFloat(ph));
                    row.phone = '+' + num;
                }
            }

            // Normalize dates, gender, status
            row.start_date  = _normDate(row.start_date  || '');
            row.birth_date  = _normDate(row.birth_date  || '');
            row.end_date    = _normDate(row.end_date    || '');
            row.status      = _normStatus(row.status_raw || '');
            row.gender      = _normGender(row.gender || '') || _genderByPatronymic(row.patronymic || '');

            // Split ПІБ → last_name / first_name / patronymic
            const parts = (row.pib || '').trim().split(/\s+/);
            row.last_name   = parts[0] || '';
            row.first_name  = parts[1] || '';
            row.patronymic  = parts[2] || '';

            // Auto-detect gender from patronymic if still missing
            if (!row.gender && row.patronymic) row.gender = _genderByPatronymic(row.patronymic);

            // Auto-generate email from name if missing
            if (!row.email && row.last_name) {
                let base = _translit(`${row.last_name}.${row.first_name || ''}`);
                if (!base) base = `intern${idx + 1}`;
                let candidate = `${base}@intern.local`;
                let n = 2;
                while (usedEmails.has(candidate)) { candidate = `${base}${n}@intern.local`; n++; }
                row.email = candidate;
                row._emailGenerated = true;
            }
            usedEmails.add((row.email || '').toLowerCase());

            // Auto-generate login
            row.login = _translit(`${row.last_name}${row.first_name || ''}`) || `intern${idx + 1}`;

            // Password: DDMMYYYY from birth_date if available, else default
            if (row.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(row.birth_date)) {
                const [y, m, d] = row.birth_date.split('-');
                row.password = `${d}${m}${y}`;
            } else {
                row.password = 'Stazher1!';
                row._passGenerated = true;
            }

            row._errors = [];
            if (!row.last_name)  row._errors.push('ПІБ (Прізвище)');
            if (!row.first_name) row._errors.push('ПІБ (Ім\'я)');
            if (!row.email)      row._errors.push('Пошта');
            if (row.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.birth_date)) row._errors.push('Дата нар. (формат ДД.ММ.РРРР)');
            if (row.password && row.password.length < 6) row._errors.push('Пароль < 6 символів');
            return row;
        }).filter(r => Object.keys(r).length > 2);
    },

    _renderImportPreview() {
        const rows = this._importRows;
        const preview = document.getElementById('in-import-preview');
        const runBtn  = document.getElementById('in-import-run-btn');
        if (!preview) return;

        if (!rows.length) {
            preview.innerHTML = `<p style="color:var(--danger);margin-top:1rem">Файл порожній або невірний формат.</p>`;
            if (runBtn) runBtn.style.display = 'none';
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
            <table class="in-table" style="font-size:.75rem">
                <thead><tr>
                    <th>#</th><th>ПІБ</th><th>Пошта</th><th>Пароль</th><th>Місто</th><th>Статус стаж.</th><th>Кінець</th><th>⚙</th>
                </tr></thead>
                <tbody>
                    ${rows.map(r => {
                        const statusLabel = r.status === 'dropped' ? '<span style="color:var(--danger)">Відмовився</span>' : r.status === 'completed' ? '<span style="color:var(--success)">Завершив</span>' : '<span style="color:#8b5cf6">Активний</span>';
                        const emailHint = r._emailGenerated ? `<span title="авто-генерований" style="color:#f59e0b;font-size:.65rem">⚡</span> ` : '';
                        const passHint  = r._passGenerated  ? `<span title="пароль: Stazher1!" style="color:#f59e0b;font-size:.65rem">⚡</span> ` : '';
                        return `<tr style="${r._errors.length ? 'opacity:.5' : ''}">
                        <td style="color:var(--text-muted)">${r._line - 1}</td>
                        <td>${Fmt.esc(r.pib || '—')}</td>
                        <td>${emailHint}${Fmt.esc(r.email || '—')}</td>
                        <td style="color:var(--text-muted)">${passHint}${r.password ? '••••••••' : '—'}</td>
                        <td style="color:var(--text-muted)">${Fmt.esc(r.city || '—')}</td>
                        <td>${statusLabel}</td>
                        <td style="color:var(--text-muted)">${r.end_date ? Fmt.date(r.end_date) : '—'}</td>
                        <td>${r._errors.length
                            ? `<span style="color:var(--danger);font-size:.7rem">✗ ${r._errors.join(', ')}</span>`
                            : '<span style="color:var(--success)">✓</span>'}</td>
                    </tr>`;}).join('')}
                </tbody>
            </table>
        </div>`;

        if (runBtn) {
            runBtn.style.display = okCount > 0 ? '' : 'none';
            runBtn.innerHTML = `<i class="fa-solid fa-file-import"></i> Імпортувати ${okCount} стажер${okCount === 1 ? 'а' : 'ів'}`;
        }
    },

    async _runImport() {
        const rows = this._importRows.filter(r => !r._errors.length);
        if (!rows.length) return;

        const modalBody   = document.querySelector('.modal-body');
        const modalFooter = document.querySelector('.modal-footer');
        if (modalFooter) modalFooter.innerHTML = '';

        let done = 0, skipped = 0, failed = 0;
        const errors = [];
        const total  = rows.length;

        // Preload all profiles for manager lookup & existing-user check
        let allProfiles = [];
        try { allProfiles = (await API.profiles.getAll({ pageSize: 1000 })).data || []; } catch (_) {}

        const profileByEmail = {};
        allProfiles.forEach(p => { if (p.email) profileByEmail[p.email.toLowerCase()] = p; });
        const profileByName  = {};
        allProfiles.forEach(p => { if (p.full_name) profileByName[p.full_name.toLowerCase()] = p; });

        const renderProgress = () => {
            const pct = Math.round(((done + failed + skipped) / total) * 100);
            if (modalBody) modalBody.innerHTML = `
            <div style="text-align:center;padding:1.5rem 0">
                <div style="font-size:1.5rem;margin-bottom:.75rem">⏳</div>
                <div style="font-weight:600;margin-bottom:1rem">Імпорт стажерів...</div>
                <div style="background:var(--bg-raised);border-radius:99px;height:8px;overflow:hidden;margin-bottom:.75rem">
                    <div style="height:100%;background:#8b5cf6;border-radius:99px;transition:width .3s;width:${pct}%"></div>
                </div>
                <div style="color:var(--text-muted);font-size:.875rem">${done + failed + skipped} / ${total}</div>
                ${failed ? `<div style="color:var(--danger);font-size:.78rem;margin-top:.5rem">Помилок: ${failed}</div>` : ''}
            </div>`;
        };

        renderProgress();

        for (const row of rows) {
            try {
                const emailKey = (row.email || '').trim().toLowerCase();
                let profileId  = null;

                const isCompleted = row.status === 'completed';
                // completed interns lose the intern label; active/dropped keep it
                const internLabel = isCompleted ? null : 'intern';

                const existing = profileByEmail[emailKey];
                if (existing) {
                    profileId = existing.id;
                    // For completed: restore job_position without "Стажер" prefix
                    const rawJp = row.job_position || '';
                    const jpUpd = isCompleted
                        ? rawJp
                        : (rawJp ? (rawJp.startsWith('Стажер') ? rawJp : `Стажер ${rawJp}`) : 'Стажер');
                    await API.profiles.update(profileId, {
                        label:        internLabel,
                        job_position: jpUpd || null,
                        city:         row.city        || existing.city,
                        phone:        row.phone       || existing.phone,
                        subdivision:  row.subdivision || existing.subdivision,
                        ...(row.gender ? { gender: row.gender } : {}),
                    });
                } else {
                    // Create new user
                    const rawJp = row.job_position || '';
                    const jpNew = isCompleted
                        ? rawJp
                        : (rawJp ? (rawJp.startsWith('Стажер') ? rawJp : `Стажер ${rawJp}`) : 'Стажер');
                    const { data: userId, error } = await supabase.rpc('admin_user_create', {
                        p_email:        row.email.trim(),
                        p_password:     row.password,
                        p_role:         'user',
                        p_last_name:    row.last_name    || null,
                        p_first_name:   row.first_name   || null,
                        p_patronymic:   row.patronymic   || null,
                        p_login:        row.login        || null,
                        p_phone:        row.phone        || null,
                        p_gender:       null,
                        p_birth_date:   row.birth_date   || null,
                        p_city:         row.city         || null,
                        p_job_position: jpNew || null,
                        p_subdivision:  row.subdivision  || null,
                        p_gender:       row.gender       || null,
                        p_label:        internLabel,
                    });
                    if (error) throw error;
                    profileId = userId;
                    // Add to local cache for manager lookups in same batch
                    const fullName = [row.last_name, row.first_name, row.patronymic].filter(Boolean).join(' ');
                    profileByEmail[emailKey] = { id: userId, full_name: fullName, email: row.email.trim() };
                    if (fullName) profileByName[fullName.toLowerCase()] = { id: userId, full_name: fullName };
                }

                // Resolve manager_id
                let managerId = null;
                if (row.manager_name) {
                    const mgr = profileByName[row.manager_name.trim().toLowerCase()];
                    if (mgr) managerId = mgr.id;
                }

                // Check if intern record already exists
                const { data: existingIntern } = await supabase
                    .from('interns').select('id').eq('profile_id', profileId).maybeSingle();

                const calcPlanned = this._calcPlannedEnd(row.job_position, row.start_date);
                const rowStatus   = row.status || 'active';
                // end_date from CSV mapping:
                // active   → planned_end_date (or auto-calc)
                // dropped  → actual_end_date + planned stays as calc
                // completed→ actual_end_date + planned_end_date (same value, so table shows it)
                const csvEnd    = row.end_date || null;
                const actualEnd = (rowStatus === 'dropped' || rowStatus === 'completed') ? csvEnd : null;
                const plannedEnd = rowStatus === 'active'
                    ? (csvEnd || calcPlanned || null)
                    : (csvEnd || calcPlanned || null); // completed also fills planned so table col shows date

                if (existingIntern) {
                    await API.interns.update(existingIntern.id, {
                        manager_id:       managerId,
                        start_date:       row.start_date  || null,
                        group_number:     row.group_number || null,
                        status:           rowStatus,
                        ...(plannedEnd  ? { planned_end_date: plannedEnd }  : {}),
                        ...(actualEnd   ? { actual_end_date:  actualEnd, status_changed_at: new Date().toISOString() } : {}),
                    });
                } else {
                    await API.interns.create({
                        profile_id:       profileId,
                        manager_id:       managerId,
                        start_date:       row.start_date  || null,
                        group_number:     row.group_number || null,
                        planned_end_date: plannedEnd || null,
                        actual_end_date:  actualEnd  || null,
                        status:           rowStatus,
                        ...(actualEnd ? { status_changed_at: new Date().toISOString() } : {}),
                    });
                }

                // Sync reference tables (positions / cities / subdivisions)
                const dirOps = [];
                if (row.job_position) dirOps.push(supabase.from('positions').upsert({ name: row.job_position }, { onConflict: 'name', ignoreDuplicates: true }));
                if (row.city)         dirOps.push(supabase.from('cities').upsert({ name: row.city }, { onConflict: 'name', ignoreDuplicates: true }));
                if (row.subdivision)  dirOps.push(supabase.from('subdivisions').upsert({ name: row.subdivision }, { onConflict: 'name', ignoreDuplicates: true }));
                if (dirOps.length) await Promise.all(dirOps);

                done++;
            } catch (e) {
                failed++;
                errors.push(`Рядок ${row._line} (${row.pib || row.email}): ${e?.message || 'невідома помилка'}`);
            }
            renderProgress();
        }

        if (modalBody) modalBody.innerHTML = `
        <div style="text-align:center;padding:1.5rem 0">
            <div style="font-size:2.5rem;margin-bottom:.75rem">${failed === 0 ? '✅' : '⚠️'}</div>
            <div style="font-weight:600;font-size:1.1rem;margin-bottom:.5rem">Імпорт завершено</div>
            <div style="color:var(--success);margin-bottom:.25rem">Оброблено: ${done}</div>
            ${failed ? `<div style="color:var(--danger);margin-bottom:.75rem">Помилок: ${failed}</div>` : ''}
        </div>
        ${errors.length ? `
        <div style="max-height:160px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-md);padding:.5rem .75rem">
            ${errors.map(e => `<div style="font-size:.75rem;color:var(--danger);padding:.2rem 0;border-bottom:1px solid var(--border)">${Fmt.esc(e)}</div>`).join('')}
        </div>` : ''}`;

        if (modalFooter) modalFooter.innerHTML = `<button class="btn btn-sm" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;border:none" onclick="Modal.close();InternsPage._reload()">Готово</button>`;
    },

    // ── Bulk recalc planned dates ─────────────────────────────────────────────
    async _recalcAllDates() {
        const toUpdate = this._interns.filter(i =>
            !i.planned_end_date && i.start_date && i.profile?.job_position
        );
        if (!toUpdate.length) {
            Toast.info('Всі дати вже розраховані або даних недостатньо');
            return;
        }
        const ok = await Modal.confirm({
            title: 'Перерахувати дати',
            message: `Розрахувати плановий випуск для ${toUpdate.length} стажерів (де дата порожня)?`,
        });
        if (!ok) return;

        Loader.show();
        let updated = 0, skipped = 0;
        try {
            for (const intern of toUpdate) {
                const planned = this._calcPlannedEnd(intern.profile.job_position, intern.start_date);
                if (!planned) { skipped++; continue; }
                await API.interns.update(intern.id, { planned_end_date: planned });
                updated++;
            }
            Toast.success('Готово', `Оновлено: ${updated}${skipped ? `, пропущено (немає налаштувань): ${skipped}` : ''}`);
            await this._reload();
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    // ── Bulk fix job position prefix ──────────────────────────────────────────
    async _fixJobPositions() {
        const toUpdate = this._interns.filter(i => {
            const jp = i.profile?.job_position || '';
            return jp && !jp.startsWith('Стажер');
        });
        if (!toUpdate.length) {
            Toast.info('Всі посади вже мають префікс "Стажер"');
            return;
        }
        const ok = await Modal.confirm({
            title: 'Виправити посади',
            message: `Додати префікс "Стажер" до посад ${toUpdate.length} стажерів?`,
        });
        if (!ok) return;

        Loader.show();
        let updated = 0;
        try {
            for (const intern of toUpdate) {
                const cur = intern.profile.job_position;
                const next = `Стажер ${cur}`;
                await supabase.from('profiles').update({ job_position: next }).eq('id', intern.profile_id);
                updated++;
            }
            Toast.success('Готово', `Оновлено посад: ${updated}`);
            await this._reload();
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    // ── Archive all dropped interns ───────────────────────────────────────────
    async _archiveAllDropped() {
        const toArchive = this._interns.filter(i => i.status === 'dropped' && i.profile_id);
        if (!toArchive.length) {
            Toast.info('Немає відсіяних стажерів з активними акаунтами');
            return;
        }
        const ok = await Modal.confirm({
            title: 'Архівувати відсіяних',
            message: `Зберегти дані та видалити акаунти ${toArchive.length} відсіяних стажерів?`,
            confirmText: 'Архівувати',
            danger: true,
        });
        if (!ok) return;

        // Show progress overlay
        const total = toArchive.length;
        const overlay = document.createElement('div');
        overlay.innerHTML = `
            <div style="position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center">
                <div style="background:var(--bg-surface);border-radius:var(--radius-xl);padding:2rem;width:360px;box-shadow:0 16px 48px rgba(0,0,0,.3)">
                    <div style="font-weight:700;font-size:1.05rem;margin-bottom:.4rem">Архівування стажерів</div>
                    <div id="arch-name" style="font-size:.85rem;color:var(--text-muted);margin-bottom:1rem;min-height:1.2em">Підготовка…</div>
                    <div style="background:var(--border);border-radius:100px;height:8px;overflow:hidden;margin-bottom:.75rem">
                        <div id="arch-bar" style="height:100%;width:0%;background:var(--primary);border-radius:100px;transition:width .25s"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:.8rem;color:var(--text-muted)">
                        <span id="arch-count">0 / ${total}</span>
                        <span id="arch-pct">0%</span>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const bar    = overlay.querySelector('#arch-bar');
        const name   = overlay.querySelector('#arch-name');
        const count  = overlay.querySelector('#arch-count');
        const pct    = overlay.querySelector('#arch-pct');

        let done = 0, failed = 0;
        for (const intern of toArchive) {
            const fullName = intern.profile?.full_name || intern.profile_snapshot?.full_name || intern.id;
            name.textContent = fullName;
            try {
                await API.interns.archiveDropped(intern.id);
                done++;
            } catch(e) {
                console.error(`archive ${intern.id}:`, e.message);
                failed++;
            }
            const progress = Math.round((done + failed) / total * 100);
            bar.style.width   = progress + '%';
            count.textContent = `${done + failed} / ${total}`;
            pct.textContent   = progress + '%';
        }

        name.textContent = failed ? `Готово (${failed} помилок)` : 'Готово!';
        bar.style.background = failed ? 'var(--warning)' : 'var(--success)';
        await new Promise(r => setTimeout(r, 900));
        overlay.remove();

        if (failed === 0) {
            Toast.success('Архівування завершено', `Акаунти видалено: ${done}`);
        } else {
            Toast.warning('Частково виконано', `Архівовано: ${done}, помилок: ${failed}`);
        }
        await this._reload();
    },

    // ── Job settings modal ────────────────────────────────────────────────────
    async _openJobSettingsModal() {
        Modal.open({
            title: '<i class="fa-solid fa-sliders" style="color:#8b5cf6"></i> Кількість днів навчання за посадою',
            size: 'lg',
            body: '<div style="text-align:center;padding:2rem"><i class="fa-solid fa-spinner fa-spin"></i></div>',
        });
        await this._renderJobSettingsBody();
    },

    async _renderJobSettingsBody() {
        const mb = document.querySelector('.modal-body');
        if (!mb) return;
        let rows, profilePositions;
        try {
            [rows, profilePositions] = await Promise.all([
                API.internJobSettings.getAll(),
                supabase.from('profiles').select('job_position').not('job_position', 'is', null).neq('job_position', '')
                    .then(({ data }) => [...new Set((data || []).map(p => p.job_position).filter(Boolean))].sort())
            ]);
        } catch(e) {
            mb.innerHTML = `<div style="color:var(--danger);padding:1rem">Помилка: ${Fmt.esc(e.message)}</div>`;
            return;
        }
        // merge: profile positions + any custom ones already in settings
        const settingsPositions = rows.map(r => r.job_position);
        const allPositions = [...new Set([...profilePositions, ...settingsPositions])].sort();

        mb.innerHTML = `
            <div id="ijs-wrap">
                <table class="in-table" style="margin-bottom:1.2rem;width:100%">
                    <thead><tr>
                        <th>Посада</th>
                        <th style="width:80px;text-align:center">Днів</th>
                        <th style="width:160px"></th>
                    </tr></thead>
                    <tbody id="ijs-tbody">
                        ${rows.length ? rows.map(r => `
                            <tr id="ijs-row-${r.id}">
                                <td>
                                    <span class="ijs-pos-view">${Fmt.esc(r.job_position)}</span>
                                    <input class="form-control ijs-pos-edit" style="display:none;width:100%" value="${Fmt.esc(r.job_position)}">
                                </td>
                                <td style="text-align:center">
                                    <span class="ijs-days-view">${r.training_days}</span>
                                    <input class="form-control ijs-days-edit" type="number" min="0" max="365" style="display:none;width:60px;text-align:center;margin:0 auto" value="${r.training_days}">
                                </td>
                                <td style="white-space:nowrap;text-align:right;overflow:visible;max-width:none">
                                    <button class="btn btn-ghost btn-sm ijs-btn-edit" onclick="InternsPage._editJobRow('${r.id}')">Ред.</button>
                                    <button class="btn btn-sm ijs-btn-save" style="display:none;background:var(--success);color:#fff;border:none" onclick="InternsPage._saveJobRowInline('${r.id}')">Зберегти</button>
                                    <button class="btn btn-ghost btn-sm ijs-btn-cancel" style="display:none" onclick="InternsPage._cancelJobRow('${r.id}')">Скас.</button>
                                    <button class="btn btn-sm ijs-btn-delete" style="background:var(--danger);color:#fff;border:none" onclick="InternsPage._deleteJobRow('${r.id}',this)">Видалити</button>
                                </td>
                            </tr>`).join('') : `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:1.5rem">Записів немає</td></tr>`}
                    </tbody>
                </table>
                <div class="ijs-add-form">
                    <div style="font-weight:600;margin-bottom:.6rem;color:var(--text-muted);font-size:.8rem;text-transform:uppercase;letter-spacing:.05em">Додати / оновити</div>
                    <div style="display:flex;gap:.6rem;align-items:flex-end">
                        <div style="flex:1">
                            <label style="font-size:.8rem;color:var(--text-muted);margin-bottom:.3rem;display:block">Посада</label>
                            <select id="ijs-pos-input" class="form-control" style="width:100%">
                                <option value="">— оберіть посаду —</option>
                                ${allPositions.map(p => `<option value="${Fmt.esc(p)}">${Fmt.esc(p)}</option>`).join('')}
                            </select>
                        </div>
                        <div style="width:140px">
                            <label style="font-size:.8rem;color:var(--text-muted);margin-bottom:.3rem;display:block">Кількість днів</label>
                            <input id="ijs-days-input" class="form-control" type="number" min="0" max="365" placeholder="0" style="width:100%;text-align:center">
                        </div>
                        <button class="btn btn-sm" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;border:none;padding:.5rem 1rem;white-space:nowrap" onclick="InternsPage._saveJobRow()">
                            <i class="fa-solid fa-floppy-disk"></i> Зберегти
                        </button>
                    </div>
                </div>
            </div>`;
    },

    _editJobRow(id) {
        // cancel any other open edits first
        document.querySelectorAll('#ijs-tbody tr').forEach(tr => this._cancelJobRow(tr.id.replace('ijs-row-', '')));
        const row = document.getElementById(`ijs-row-${id}`);
        if (!row) return;
        row.querySelector('.ijs-pos-view').style.display  = 'none';
        row.querySelector('.ijs-pos-edit').style.display  = '';
        row.querySelector('.ijs-days-view').style.display = 'none';
        row.querySelector('.ijs-days-edit').style.display = '';
        row.querySelector('.ijs-btn-edit').style.display   = 'none';
        row.querySelector('.ijs-btn-delete').style.display = 'none';
        row.querySelector('.ijs-btn-save').style.display   = '';
        row.querySelector('.ijs-btn-cancel').style.display = '';
        row.style.background = 'var(--bg-hover)';
        row.querySelector('.ijs-pos-edit').focus();
    },

    _cancelJobRow(id) {
        const row = document.getElementById(`ijs-row-${id}`);
        if (!row) return;
        row.querySelector('.ijs-pos-view').style.display  = '';
        row.querySelector('.ijs-pos-edit').style.display  = 'none';
        row.querySelector('.ijs-days-view').style.display = '';
        row.querySelector('.ijs-days-edit').style.display = 'none';
        row.querySelector('.ijs-btn-edit').style.display   = '';
        row.querySelector('.ijs-btn-delete').style.display = '';
        row.querySelector('.ijs-btn-save').style.display   = 'none';
        row.querySelector('.ijs-btn-cancel').style.display = 'none';
        row.style.background = '';
    },

    async _saveJobRowInline(id) {
        const row = document.getElementById(`ijs-row-${id}`);
        if (!row) return;
        const pos  = row.querySelector('.ijs-pos-edit').value.trim();
        const days = parseInt(row.querySelector('.ijs-days-edit').value, 10);
        if (!pos) { Toast.warning('Введіть назву посади'); return; }
        if (isNaN(days) || days < 0) { Toast.warning('Введіть коректну кількість днів'); return; }
        try {
            await API.internJobSettings.upsert(pos, days);
            Toast.success('Збережено');
            await this._renderJobSettingsBody();
        } catch(e) {
            Toast.error('Помилка', e.message);
        }
    },

    _showInlineConfirm(anchorEl, message, onConfirm) {
        document.querySelectorAll('.ijs-confirm-popup').forEach(el => el.remove());
        const popup = document.createElement('div');
        popup.className = 'ijs-confirm-popup';
        popup.innerHTML = `
            <div style="font-size:.85rem;color:var(--text-primary);margin-bottom:.75rem">${Fmt.esc(message)}</div>
            <div style="display:flex;gap:.5rem;justify-content:flex-end">
                <button class="btn btn-ghost btn-sm" id="ijscp-cancel">Скасувати</button>
                <button class="btn btn-sm" style="background:var(--danger);color:#fff;border:none" id="ijscp-ok">Видалити</button>
            </div>`;
        Object.assign(popup.style, {
            position:'absolute', zIndex:'1100',
            background:'var(--bg-surface)', border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)', padding:'1rem',
            boxShadow:'0 8px 32px rgba(0,0,0,0.22)', minWidth:'220px',
        });
        document.body.appendChild(popup);
        const rect = anchorEl.getBoundingClientRect();
        const pw = 240;
        let left = rect.right - pw;
        let top = rect.bottom + 6;
        if (left < 8) left = 8;
        if (top + 100 > window.innerHeight) top = rect.top - 110;
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
        const close = () => popup.remove();
        popup.querySelector('#ijscp-cancel').onclick = close;
        popup.querySelector('#ijscp-ok').onclick = () => { close(); onConfirm(); };
        setTimeout(() => document.addEventListener('click', function h(e) {
            if (!popup.contains(e.target)) { close(); document.removeEventListener('click', h); }
        }), 50);
    },

    async _deleteJobRow(id, btn) {
        this._showInlineConfirm(btn, 'Видалити цей запис?', async () => {
            try {
                await API.internJobSettings.remove(id);
                await this._renderJobSettingsBody();
            } catch(e) {
                Toast.error('Помилка', e.message);
            }
        });
    },

    async _saveJobRow() {
        const pos = (document.getElementById('ijs-pos-input')?.value || '').trim();
        const days = parseInt(document.getElementById('ijs-days-input')?.value || '0', 10);
        if (!pos) { Toast.warning('Введіть назву посади'); return; }
        if (isNaN(days) || days < 0) { Toast.warning('Введіть коректну кількість днів'); return; }
        try {
            await API.internJobSettings.upsert(pos, days);
            Toast.success('Збережено');
            await this._renderJobSettingsBody();
        } catch(e) {
            Toast.error('Помилка', e.message);
        }
    },

    // ── Column resize ─────────────────────────────────────────────────────────
    _tableColKey: 'in_table_cols',

    _saveColWidths(ths) {
        const widths = ths.map(th => th.offsetWidth);
        localStorage.setItem(this._tableColKey, JSON.stringify(widths));
    },

    _restoreColWidths(ths) {
        try {
            const saved = JSON.parse(localStorage.getItem(this._tableColKey) || 'null');
            if (!Array.isArray(saved) || saved.length !== ths.length) return false;
            ths.forEach((th, i) => { if (saved[i] >= 60) th.style.width = saved[i] + 'px'; });
            return true;
        } catch { return false; }
    },

    _initTableResize(table) {
        if (!table) return;
        const ths = [...table.querySelectorAll('thead th')];
        // restore saved widths or fall back to rendered layout
        if (!this._restoreColWidths(ths)) {
            ths.forEach(th => { th.style.width = th.offsetWidth + 'px'; });
        }

        ths.forEach((th, i) => {
            if (i === ths.length - 1) return; // skip last col
            const handle = document.createElement('div');
            handle.className = 'in-col-resizer';
            th.appendChild(handle);

            let startX, startW;
            handle.addEventListener('mousedown', e => {
                e.preventDefault();
                e.stopPropagation();
                startX = e.clientX;
                startW = th.offsetWidth;
                handle.classList.add('active');

                const onMove = e => {
                    const w = Math.max(60, startW + e.clientX - startX);
                    th.style.width = w + 'px';
                };
                const onUp = () => {
                    handle.classList.remove('active');
                    this._saveColWidths(ths);
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });
    },

    // ── Styles ────────────────────────────────────────────────────────────────
    _injectStyles() {
        if (document.getElementById('in-styles')) return;
        const s = document.createElement('style');
        s.id = 'in-styles';
        s.textContent = `
.in-page { padding: 1.25rem; max-width: 1200px; }
.in-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.25rem; flex-wrap:wrap; gap:.75rem; }
.in-title { font-size:1.25rem; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:.5rem; }
.in-title i { color:#8b5cf6; }
.in-header-actions { display:flex; gap:.5rem; }
.in-btn { display:inline-flex; align-items:center; gap:.4rem; padding:.45rem .9rem; border-radius:8px; font-size:.85rem; font-weight:600; cursor:pointer; border:none; transition:opacity .15s; }
.in-btn:hover { opacity:.88; }
.in-btn-primary { background:linear-gradient(135deg,#8b5cf6,#6d28d9); color:#fff; box-shadow:0 3px 10px rgba(139,92,246,.3); }
.in-btn-access { background:var(--bg-hover); color:var(--text-secondary); border:1px solid var(--border); }
.in-tabs { display:flex; gap:.25rem; margin-bottom:1.25rem; border-bottom:1px solid var(--border); }
.in-tab { padding:.55rem 1.1rem; background:none; border:none; border-bottom:2px solid transparent; color:var(--text-muted); font-size:.88rem; font-weight:600; cursor:pointer; transition:color .15s,border-color .15s; display:flex; align-items:center; gap:.4rem; margin-bottom:-1px; }
.in-tab:hover { color:var(--text-primary); }
.in-tab-active { color:#8b5cf6; border-bottom-color:#8b5cf6; }
.in-filters { display:flex; gap:.6rem; flex-wrap:wrap; margin-bottom:1rem; }
.in-search-wrap { position:relative; flex:1; min-width:180px; }
.in-search-icon { position:absolute; left:.7rem; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:.8rem; }
.in-search-input { padding-left:2rem !important; }
.in-input { width:100%; padding:.5rem .7rem; background:var(--bg-surface); border:1px solid var(--border); border-radius:8px; color:var(--text-primary); font-size:.875rem; outline:none; box-sizing:border-box; }
.in-input:focus { border-color:#8b5cf6; box-shadow:0 0 0 3px color-mix(in srgb,#8b5cf6 15%,transparent); }
.in-select { min-width:140px; flex:0 0 auto; cursor:pointer; }
.in-table { width:100%; border-collapse:collapse; font-size:.875rem; table-layout:fixed; }
.in-table thead tr { background:var(--bg-raised); }
.in-table th { padding:.65rem .85rem; text-align:left; font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted); white-space:nowrap; position:relative; overflow:hidden; text-overflow:ellipsis; }
.in-table td { padding:.65rem .85rem; border-bottom:1px solid var(--border); vertical-align:middle; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:0; }
.in-table td.in-td-date { white-space:normal; word-break:break-word; }
.in-col-resizer { position:absolute; right:0; top:20%; bottom:20%; width:3px; cursor:col-resize; user-select:none; z-index:1; background:var(--border); border-radius:2px; transition:background .15s; }
.in-col-resizer:hover, .in-col-resizer.active { background:#8b5cf6; }
.in-tr { cursor:pointer; transition:background .12s; }
.in-tr:hover td { background:var(--bg-hover); }
.in-tr-dropped td { background:color-mix(in srgb,#ef4444 6%,transparent); }
.in-tr-dropped:hover td { background:color-mix(in srgb,#ef4444 12%,transparent); }
.in-name-cell { display:flex; align-items:center; gap:.6rem; }
.in-pct-wrap { display:flex; align-items:center; gap:.5rem; min-width:100px; }
.in-pct-bar { height:6px; border-radius:3px; background:linear-gradient(90deg,#8b5cf6,#6366f1); min-width:2px; }
.in-pct-wrap span { font-size:.8rem; color:var(--text-muted); white-space:nowrap; }
.in-icon-btn { background:none; border:none; cursor:pointer; padding:.3rem; border-radius:6px; color:var(--text-muted); transition:background .12s,color .12s; }
.in-icon-btn:hover { background:var(--bg-hover); color:var(--text-primary); }
.in-icon-btn-danger:hover { background:rgba(239,68,68,.1); color:#ef4444; }
.in-empty { text-align:center; padding:4rem 2rem; color:var(--text-muted); display:flex; flex-direction:column; align-items:center; gap:.75rem; font-size:.9rem; }
.in-stat-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:.85rem; margin-bottom:1.25rem; }
.in-stat-card { background:var(--bg-surface); border:1px solid var(--border); border-radius:12px; padding:1rem 1.1rem; display:flex; align-items:center; gap:.85rem; }
.in-stat-icon { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0; }
.in-stat-value { font-size:1.5rem; font-weight:800; color:var(--text-primary); line-height:1.1; }
.in-stat-label { font-size:.78rem; color:var(--text-muted); margin-top:.15rem; }
.in-charts-grid { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
@media(max-width:700px){ .in-charts-grid { grid-template-columns:1fr; } }
.in-chart-card { background:var(--bg-surface); border:1px solid var(--border); border-radius:12px; padding:1.1rem; }
.in-chart-title { font-size:.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:.75rem; }
.in-detail-tabs { display:flex; gap:.25rem; border-bottom:1px solid var(--border); margin-bottom:1rem; }
.in-detail-tab { background:none; border:none; border-bottom:2px solid transparent; padding:.45rem .9rem; font-size:.85rem; font-weight:600; cursor:pointer; color:var(--text-muted); transition:color .12s,border-color .12s; margin-bottom:-1px; }
.in-detail-tab.active { color:#8b5cf6; border-bottom-color:#8b5cf6; }
.in-disc-count { background:var(--bg-raised); border-radius:10px; padding:.1rem .45rem; font-size:.75rem; margin-left:.3rem; }
.in-info-grid { display:grid; grid-template-columns:1fr 1fr; gap:.6rem; }
.in-info-full { grid-column:1/-1; }
.in-info-row { display:flex; flex-direction:column; gap:.2rem; }
.in-info-label { font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted); }
.in-disc-card { background:var(--bg-raised); border:1px solid var(--border); border-radius:10px; padding:.75rem 1rem; margin-bottom:.5rem; transition:border-color .15s; }
.in-disc-done { border-color:rgba(16,185,129,.3); background:color-mix(in srgb,#10b981 5%,var(--bg-raised)); }
.in-disc-header { display:flex; align-items:center; gap:.6rem; }
.in-disc-order { width:22px; height:22px; border-radius:50%; background:var(--bg-hover); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:.72rem; font-weight:700; color:var(--text-muted); flex-shrink:0; }
.in-disc-name { flex:1; font-weight:600; font-size:.9rem; }
.in-disc-actions { display:flex; align-items:center; gap:.3rem; }
.in-disc-check { background:none; border:none; cursor:pointer; font-size:1.1rem; color:var(--text-muted); transition:color .12s; padding:.2rem; }
.in-disc-check:hover { color:#10b981; }
.in-disc-check-done { color:#10b981; }
.in-disc-meta { display:flex; flex-wrap:wrap; gap:.6rem; margin-top:.45rem; font-size:.8rem; color:var(--text-muted); }
.in-disc-meta i { margin-right:.25rem; }
.in-disc-notes { margin-top:.4rem; font-size:.82rem; color:var(--text-secondary); font-style:italic; }
.in-form { display:flex; flex-direction:column; gap:.85rem; }
.in-form-group { display:flex; flex-direction:column; gap:.35rem; }
.in-form-row { display:grid; grid-template-columns:1fr 1fr; gap:.85rem; }
.in-form-label { font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--text-muted); }
.in-viewer-row { display:flex; align-items:center; gap:.6rem; padding:.5rem 0; border-bottom:1px solid var(--border); }
.in-viewer-row:last-child { border-bottom:none; }
.badge-danger { background:rgba(239,68,68,.15); color:#ef4444; }
.badge-info { background:rgba(59,130,246,.15); color:#3b82f6; }
.in-btn-graduate { background:linear-gradient(135deg,#10b981,#059669); color:#fff; box-shadow:0 3px 10px rgba(16,185,129,.3); }
.in-dov-list { display:flex; flex-direction:column; gap:.35rem; max-height:200px; overflow-y:auto; padding:.5rem; background:var(--bg-raised); border:1px solid var(--border); border-radius:8px; }
.in-dov-item { display:flex; align-items:center; gap:.5rem; padding:.35rem .4rem; border-radius:6px; cursor:pointer; font-size:.875rem; transition:background .12s; }
.in-dov-item:hover { background:var(--bg-hover); }
.in-dov-item input { cursor:pointer; accent-color:#8b5cf6; }
        `;
        document.head.appendChild(s);
    }
};
