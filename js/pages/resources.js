// ================================================================
// EduFlow LMS — Модуль ресурсів / База знань
// ================================================================

const ResourcesPage = {
    _page: 0,
    _search: '',
    _category: '',
    _courseId: '',
    _view: 'kb',
    _pageSize: APP_CONFIG.pageSize,
    _courses: [],
    _categories: [],
    _accessGroups: [],
    _resourceFile: null,
    _myDownloads: {},
    _myLocations: [],
    _activeTab: 'list',
    _pendingResource: null,
    _pendingDownloadFile: false,

    async init(container, { view = 'kb' } = {}) {
        this._page = 0;
        this._search = '';
        this._category = '';
        this._courseId = '';
        this._view = view;
        this._resourceFile = null;
        this._myDownloads = {};
        this._myLocations = [];
        this._activeTab = 'list';

        if (view === 'admin' && !AppState.isStaff()) {
            Toast.error('Заборонено', 'Тільки адміністратори та викладачі можуть керувати ресурсами');
            Router.go('dashboard');
            return;
        }

        if (view === 'kb' && !AccessRestrictions.canAccess('knowledge-base')) {
            UI.setBreadcrumb([{ label: 'База знань' }]);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔒</div>
                    <h3>Доступ обмежено</h3>
                    <p>У вас немає доступу до розділу «База знань».</p>
                </div>`;
            return;
        }

        if (view === 'docs' && !AccessRestrictions.canAccess('documents')) {
            UI.setBreadcrumb([{ label: 'Документи' }]);
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔒</div>
                    <h3>Доступ обмежено</h3>
                    <p>У вас немає доступу до розділу «Документи».</p>
                </div>`;
            return;
        }

        if (view === 'docs') {
            UI.setBreadcrumb([{ label: 'Документи' }]);
            const isManager = AppState.canSchedule();
            container.innerHTML = `
                <div class="page-header">
                    <div class="page-title">
                        <h1>📋 Документи</h1>
                        <p>Обов'язкові документи для ознайомлення та підтвердження</p>
                    </div>
                    <div class="page-actions">
                        <div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center">
                            <input type="text" id="resource-search" placeholder="Пошук..." value=""
                                   style="width:200px" onkeyup="ResourcesPage.onSearch(event)">
                            <select id="resource-category" onchange="ResourcesPage.applyFilters()" style="width:auto">
                                <option value="">Всі категорії</option>
                            </select>
                        </div>
                        ${AppState.isStaff() ? '<button class="btn btn-primary" onclick="ResourcesPage.openForm()">+ Додати</button>' : ''}
                    </div>
                </div>
                ${isManager ? `
                <div style="display:flex;gap:.5rem;margin-bottom:1.25rem;border-bottom:1px solid var(--border);padding-bottom:.75rem">
                    <button id="docs-tab-list" class="btn btn-primary btn-sm" onclick="ResourcesPage.switchTab('list',this)">📋 Документи</button>
                    <button id="docs-tab-status" class="btn btn-ghost btn-sm" onclick="ResourcesPage.switchTab('status',this)">📊 Статус</button>
                    <button id="docs-tab-offshift" class="btn btn-ghost btn-sm" onclick="ResourcesPage.switchTab('offshift',this)">⚠️ Поза зміною</button>
                </div>` : ''}
                <div id="docs-tab-content">
                    <div id="resource-list" class="resource-list-docs"></div>
                    <div id="resources-pagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:1.5rem"></div>
                </div>`;

            await this._loadFilters();
            if (isManager) this._myLocations = await API.documentDownloads.getManagerLocations().catch(() => []);
            await this.load();
            return;
        }

        const title = view === 'admin' ? 'Ресурси' : 'База знань';
        const subtitle = view === 'admin'
            ? 'Керуйте файлами навчальної бібліотеки та ресурсів.'
            : 'Переглядайте доступні навчальні файли та довідкові матеріали.';

        UI.setBreadcrumb([{ label: title }]);

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">
                    <h1>📂 ${title}</h1>
                    <p>${subtitle}</p>
                </div>
                <div class="page-actions">
                    <div style="display:flex;gap:.75rem;flex-wrap:wrap;align-items:center">
                        <input type="text" id="resource-search" placeholder="Пошук ресурсів..." value="${this._search}"
                               style="width:220px" onkeyup="ResourcesPage.onSearch(event)">
                        <select id="resource-category" onchange="ResourcesPage.applyFilters()" style="width:auto">
                            <option value="">Всі категорії</option>
                        </select>
                        <select id="resource-course" onchange="ResourcesPage.applyFilters()" style="width:auto">
                            <option value="">Всі курси</option>
                        </select>
                    </div>
                    ${view === 'admin' ? '<button class="btn btn-primary" onclick="ResourcesPage.openForm()">+ Додати ресурс</button>' : ''}
                </div>
            </div>
            <div id="resource-list" class="resource-list"></div>
            <div id="resources-pagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:1.5rem"></div>`;

        await this._loadFilters();
        await this.load();
    },

    switchTab(tab, el) {
        this._activeTab = tab;
        document.querySelectorAll('button[id^="docs-tab-"]').forEach(btn => {
            btn.className = btn.id === `docs-tab-${tab}` ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm';
        });
        const content = document.getElementById('docs-tab-content');
        if (!content) return;
        clearInterval(this._statusRefreshTimer);

        if (tab === 'list') {
            content.innerHTML = `
                <div id="resource-list" class="resource-list-docs"></div>
                <div id="resources-pagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:1.5rem"></div>`;
            this.load();
        } else if (tab === 'status') {
            this._statusCache = null;
            this._renderStatusTab(content);
        } else if (tab === 'offshift') {
            this._renderOffShiftTab(content);
        }
    },

    _statusCache: null, // { docs, employees, ackMap }
    _modalState: { docId: null, filter: 'all', search: '', page: 0 },
    _modalPageSize: 25,
    _renderToken: 0,

    async _renderStatusTab(content) {
        const token = ++this._renderToken;
        content.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            const isOwner = AppState.isOwner();
            const [docsRes, allEmps] = await Promise.all([
                API.resources.getAll({ trackedOnly: true, pageSize: 200 }),
                API.documentDownloads.getAllEmployees()
            ]);
            const allDocs = docsRes.data || [];
            const docs = AppState.canSchedule() ? allDocs : allDocs.filter(r => AccessGroupsPage.checkAccess(r.access_group));

            if (token !== this._renderToken) return;
            if (!docs.length) {
                content.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><h3>Немає відстежуваних документів</h3></div>`;
                return;
            }

            let employees = allEmps;
            if (!isOwner) {
                const myId = AppState.user.id;
                const subordinates = allEmps.filter(e => e.manager_id === myId);
                if (subordinates.length) employees = subordinates;
            }

            if (!employees.length) {
                content.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div><h3>Немає співробітників для відображення</h3></div>`;
                return;
            }

            const ackMap = await API.documentDownloads.getAckStatus(docs.map(d => d.id));
            this._statusCache = { docs, employees, allEmps, ackMap };

            const cards = docs.map(doc => {
                const acks = ackMap[doc.id] || [];
                const ackedIds = new Set(acks.filter(a => (a.version || 1) >= (doc.doc_version || 1)).map(a => a.userId));
                const ackedCount = employees.filter(e => ackedIds.has(e.id)).length;
                const total = employees.length;
                const notDoneCount = total - ackedCount;
                const pct = total ? Math.round(ackedCount / total * 100) : 0;
                const barColor = pct === 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
                const countColor = pct === 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';

                let overdueCount = 0;
                if (doc.deadline_days) {
                    const dl = new Date(doc.created_at).getTime() + doc.deadline_days * 86400000;
                    if (dl < Date.now()) overdueCount = notDoneCount;
                }

                let deadlineInfo = '';
                if (doc.deadline_days) {
                    const deadlineMs = new Date(doc.created_at).getTime() + doc.deadline_days * 86400000;
                    const daysLeft = Math.ceil((deadlineMs - Date.now()) / 86400000);
                    deadlineInfo = daysLeft <= 0
                        ? `<span style="font-size:.7rem;color:#dc2626;font-weight:500">🔴 Дедлайн прострочено</span>`
                        : `<span style="font-size:.7rem;color:var(--text-muted)">📅 до ${Fmt.dateShort(new Date(deadlineMs))}</span>`;
                }

                const versionBadge = doc.doc_version > 1
                    ? `<span style="font-size:.7rem;background:var(--bg-base);color:var(--text-muted);padding:1px 6px;border-radius:8px;border:1px solid var(--border)">v${doc.doc_version}</span>`
                    : '';

                const statusLine = pct === 100
                    ? `<span style="font-size:.8rem;color:#10b981">✅ Всі ознайомились</span>`
                    : `<span style="font-size:.8rem;color:var(--text-muted)">${notDoneCount} не ознайомились${overdueCount ? ` · <span style="color:#dc2626">🔴 ${overdueCount} прострочено</span>` : ''}</span>`;

                return `<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-md);padding:.875rem 1rem;display:flex;flex-direction:column;gap:.4rem">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap">
                        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;flex:1;min-width:0">
                            <span style="font-weight:600;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📄 ${doc.title}</span>
                            ${versionBadge}${deadlineInfo}
                        </div>
                        <div style="display:flex;align-items:center;gap:.75rem;flex-shrink:0">
                            <span style="font-size:.85rem;color:${countColor};font-weight:700">${ackedCount}/${total}</span>
                            <button class="btn btn-ghost btn-sm" onclick="ResourcesPage._openStatusModal('${doc.id}')">👁 Деталі</button>
                        </div>
                    </div>
                    <div style="background:var(--bg-base);border-radius:4px;height:6px;overflow:hidden">
                        <div style="height:100%;width:${pct}%;background:${barColor};transition:width .4s"></div>
                    </div>
                    <div>${statusLine}</div>
                </div>`;
            }).join('');

            if (token !== this._renderToken) return;
            content.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.625rem">${cards}</div>`;

            // Автооновлення кожні 30 секунд поки вкладка активна
            clearInterval(ResourcesPage._statusRefreshTimer);
            ResourcesPage._statusRefreshTimer = setInterval(() => {
                const el = document.getElementById('docs-tab-content');
                if (el && ResourcesPage._activeTab === 'status') {
                    ResourcesPage._renderStatusTab(el);
                } else {
                    clearInterval(ResourcesPage._statusRefreshTimer);
                }
            }, 30000);

        } catch (e) {
            content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
        }
    },

    _statusRefreshTimer: null,

    _openStatusModal(docId) {
        if (!this._statusCache) return;
        this._modalState = { docId, filter: 'all', search: '', page: 0 };
        const doc = this._statusCache.docs.find(d => d.id === docId);
        if (!doc) return;
        Modal.open({
            title: `📊 ${doc.title}`,
            size: 'lg',
            body: this._buildStatusModalBody(),
            footer: ''
        });
    },

    _buildStatusModalBody() {
        const { docId, filter, search, page } = this._modalState;
        const { docs, employees, allEmps, ackMap } = this._statusCache;
        const doc = docs.find(d => d.id === docId);
        const acks = ackMap[docId] || [];
        const ackedMap = {};
        acks.filter(a => (a.version || 1) >= (doc.doc_version || 1))
            .forEach(a => { ackedMap[a.userId] = a; });

        const deadlineMs = doc.deadline_days
            ? new Date(doc.created_at).getTime() + doc.deadline_days * 86400000
            : null;

        const ackedRows = employees.filter(e => ackedMap[e.id])
            .map(e => ({ ...e, ack: ackedMap[e.id], status: 'acked', sortKey: 0 }));

        const notAckedRows = employees.filter(e => !ackedMap[e.id]).map(e => {
            let status, sortKey;
            if (deadlineMs && deadlineMs < Date.now()) {
                status = 'overdue'; sortKey = 1;
            } else if (deadlineMs) {
                const d = Math.ceil((deadlineMs - Date.now()) / 86400000);
                status = d <= 3 ? 'soon' : 'pending';
                sortKey = d <= 3 ? 2 : 3;
            } else {
                status = 'pending'; sortKey = 3;
            }
            return { ...e, ack: null, status, sortKey };
        });

        const rows = [...ackedRows, ...notAckedRows];

        // Counts for filter tabs
        const counts = { all: rows.length, acked: 0, pending: 0, overdue: 0 };
        rows.forEach(r => {
            if (r.status === 'acked') counts.acked++;
            else if (r.status === 'overdue') counts.overdue++;
            else counts.pending++;
        });

        // Filter + search
        let filtered = rows;
        if (filter === 'acked')   filtered = rows.filter(r => r.status === 'acked');
        if (filter === 'pending') filtered = rows.filter(r => r.status !== 'acked');
        if (filter === 'overdue') filtered = rows.filter(r => r.status === 'overdue');
        if (search) {
            const q = search.toLowerCase();
            filtered = filtered.filter(r => r.full_name?.toLowerCase().includes(q) || r.job_position?.toLowerCase().includes(q));
        }
        filtered.sort((a, b) => a.sortKey - b.sortKey || (a.full_name || '').localeCompare(b.full_name || '', 'uk'));

        // Pagination
        const totalPages = Math.ceil(filtered.length / this._modalPageSize);
        const curPage = Math.min(page, Math.max(0, totalPages - 1));
        const pageRows = filtered.slice(curPage * this._modalPageSize, (curPage + 1) * this._modalPageSize);

        // Progress bar
        const pct = rows.length ? Math.round(counts.acked / rows.length * 100) : 0;
        const barColor = pct === 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';

        // Row HTML
        const rowsHtml = pageRows.map(r => {
            let statusHtml;
            if (r.status === 'acked') {
                statusHtml = `<span style="color:#10b981;font-size:.8rem;white-space:nowrap">✅ ${Fmt.dateShort(r.ack.at)}</span>`;
            } else if (r.status === 'overdue') {
                statusHtml = `<span style="color:#dc2626;font-size:.8rem;white-space:nowrap">🔴 Прострочено</span>`;
            } else if (r.status === 'soon') {
                const d = Math.ceil((deadlineMs - Date.now()) / 86400000);
                statusHtml = `<span style="color:#d97706;font-size:.8rem;white-space:nowrap">⏰ ${d} ${d === 1 ? 'день' : 'дні'}</span>`;
            } else {
                statusHtml = `<span style="color:var(--text-muted);font-size:.8rem;white-space:nowrap">— Не ознайомлено</span>`;
            }
            return `<div style="display:flex;align-items:center;padding:.5rem .25rem;border-bottom:1px solid var(--border);gap:.75rem">
                <div style="flex:1;min-width:0">
                    <div style="font-size:.875rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.full_name || '—'}</div>
                    ${r.job_position ? `<div style="font-size:.75rem;color:var(--text-muted)">${r.job_position}</div>` : ''}
                </div>
                ${statusHtml}
            </div>`;
        }).join('') || `<div style="padding:1.5rem;text-align:center;color:var(--text-muted)">Нічого не знайдено</div>`;

        // Pagination HTML
        const pagesHtml = totalPages > 1 ? `
            <div style="display:flex;align-items:center;justify-content:center;gap:.5rem;margin-top:.75rem;flex-wrap:wrap">
                <button class="btn btn-ghost btn-sm" ${curPage === 0 ? 'disabled' : ''}
                    onclick="ResourcesPage._statusModalPage(${curPage - 1})">‹</button>
                <span style="font-size:.8rem;color:var(--text-muted)">${curPage + 1} / ${totalPages}</span>
                <button class="btn btn-ghost btn-sm" ${curPage >= totalPages - 1 ? 'disabled' : ''}
                    onclick="ResourcesPage._statusModalPage(${curPage + 1})">›</button>
            </div>` : '';

        const tabStyle = (f) => `btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`;

        return `
            <div style="display:flex;flex-direction:column;gap:.875rem">
                <div style="display:flex;align-items:center;gap:1rem">
                    <div style="flex:1;background:var(--bg-base);border-radius:6px;height:8px;overflow:hidden">
                        <div style="height:100%;width:${pct}%;background:${barColor};transition:width .4s"></div>
                    </div>
                    <span style="font-size:.875rem;font-weight:700;color:${barColor};white-space:nowrap">${counts.acked}/${rows.length} (${pct}%)</span>
                </div>
                <div style="display:flex;gap:.4rem;flex-wrap:wrap">
                    <button class="${tabStyle('all')}" onclick="ResourcesPage._statusModalFilter('all')">Всі (${counts.all})</button>
                    <button class="${tabStyle('acked')}" onclick="ResourcesPage._statusModalFilter('acked')">✅ Ознайомились (${counts.acked})</button>
                    <button class="${tabStyle('pending')}" onclick="ResourcesPage._statusModalFilter('pending')">⏳ Не ознайомились (${counts.all - counts.acked})</button>
                    ${counts.overdue ? `<button class="${tabStyle('overdue')}" onclick="ResourcesPage._statusModalFilter('overdue')">🔴 Прострочені (${counts.overdue})</button>` : ''}
                </div>
                <input type="text" placeholder="Пошук за іменем або посадою…" value="${search}"
                    style="width:100%" oninput="ResourcesPage._statusModalSearch(this.value)">
                <div style="max-height:400px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-md);padding:0 .5rem">
                    ${rowsHtml}
                </div>
                ${pagesHtml}
            </div>`;
    },

    _statusModalFilter(filter) {
        this._modalState.filter = filter;
        this._modalState.page = 0;
        const body = document.getElementById('modal-body');
        if (body) body.innerHTML = this._buildStatusModalBody();
    },

    _statusModalSearch(val) {
        this._modalState.search = val;
        this._modalState.page = 0;
        const body = document.getElementById('modal-body');
        if (body) body.innerHTML = this._buildStatusModalBody();
    },

    _statusModalPage(p) {
        this._modalState.page = p;
        const body = document.getElementById('modal-body');
        if (body) body.innerHTML = this._buildStatusModalBody();
    },

    async _renderOffShiftTab(content) {
        const token = ++this._renderToken;
        content.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            const locationIds = this._myLocations.map(l => l.id);
            const downloads = await API.documentDownloads.getOffShiftForLocations(locationIds);
            if (token !== this._renderToken) return;
            if (!downloads.length) {
                content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Завантажень поза зміною не знайдено</h3></div>`;
                return;
            }
            const rows = downloads.map(d => `
                <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:.625rem .875rem;font-size:.85rem;font-weight:500">${d.resource?.title || '—'}</td>
                    <td style="padding:.625rem .875rem;font-size:.85rem">${d.user?.full_name || '—'}</td>
                    <td style="padding:.625rem .875rem;font-size:.85rem;color:var(--text-muted)">${d.location?.name || '—'}</td>
                    <td style="padding:.625rem .875rem;font-size:.85rem;color:var(--text-muted)">${Fmt.datetime(d.downloaded_at)}</td>
                </tr>`).join('');
            content.innerHTML = `
                <div style="overflow-x:auto">
                    <table style="width:100%;border-collapse:collapse">
                        <thead>
                            <tr style="border-bottom:2px solid var(--border);background:var(--bg-raised)">
                                <th style="padding:.5rem .875rem;text-align:left;font-size:.8rem;color:var(--text-muted)">Документ</th>
                                <th style="padding:.5rem .875rem;text-align:left;font-size:.8rem;color:var(--text-muted)">Співробітник</th>
                                <th style="padding:.5rem .875rem;text-align:left;font-size:.8rem;color:var(--text-muted)">Локація</th>
                                <th style="padding:.5rem .875rem;text-align:left;font-size:.8rem;color:var(--text-muted)">Час</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        } catch (e) {
            content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
        }
    },

    async _loadFilters() {
        try {
            const courseArgs = AppState.isStaff() ? { pageSize: 200 } : { published: true, pageSize: 200 };
            const [coursesRes, categories, accessGroups] = await Promise.all([
                API.courses.getAll(courseArgs).catch(() => ({ data: [] })),
                API.resources.getCategories({ docsOnly: this._view === 'docs' }).catch(() => []),
                API.accessGroups.getAll().catch(() => [])
            ]);
            this._courses      = coursesRes.data || [];
            this._categories   = categories;
            this._accessGroups = accessGroups;
            this._renderFilterOptions();
        } catch (e) {
            console.warn('[ResourcesPage] filter load error', e);
        }
    },

    _renderFilterOptions() {
        const categorySelect = document.getElementById('resource-category');
        const courseSelect = document.getElementById('resource-course');

        if (categorySelect) {
            categorySelect.innerHTML = `<option value="">Всі категорії</option>` +
                this._categories.map(c => `<option value="${c}">${c}</option>`).join('');
        }
        if (courseSelect) {
            courseSelect.innerHTML = `<option value="">Всі курси</option>` +
                this._courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
        }
    },

    onSearch(e) {
        this._search = e.target.value.trim();
        this._page = 0;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.load(), 300);
    },

    applyFilters() {
        this._category = Dom.val('resource-category');
        this._courseId = Dom.val('resource-course');
        this._page = 0;
        this.load();
    },

    async load() {
        const list = document.getElementById('resource-list');
        if (!list) return;
        list.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            const { data, count } = await API.resources.getAll({
                courseId: this._courseId || undefined,
                search: this._search || undefined,
                category: this._category || undefined,
                page: this._page,
                pageSize: this._pageSize,
                includeLessonResources: false,
                studentOnly: this._view === 'kb' && !AppState.isStaff(),
                docsOnly: this._view === 'docs'
            });

            // Frontend access filter: staff and managers in docs view see all
            let filtered = data;
            const bypassFilter = AppState.isStaff() || (this._view === 'docs' && AppState.isManager());
            if (!bypassFilter) {
                filtered = data.filter(r => AccessGroupsPage.checkAccess(r.access_group));
            }

            // Load per-user download state for docs view
            if (this._view === 'docs' && filtered.length) {
                this._myDownloads = await API.documentDownloads
                    .getMyLatest(filtered.map(r => r.id)).catch(() => ({}));
                // Fire-and-forget: remind user about overdue docs (once per doc via DB dedup)
                const withDeadlines = filtered.filter(r => r.deadline_days);
                if (withDeadlines.length) {
                    API.documentDownloads.checkAndSendReminders(withDeadlines).catch(() => {});
                }
            }

            if (!filtered || !filtered.length) {
                list.innerHTML = `
                    <div class="empty-state" style="grid-column:1/-1">
                        <div class="empty-icon">${this._view === 'docs' ? '📋' : '📂'}</div>
                        <h3>${this._view === 'docs' ? 'Документів не знайдено' : 'Ресурси не знайдено'}</h3>
                        <p>Спробуйте змінити пошук або фільтри.</p>
                    </div>`;
                document.getElementById('resources-pagination').innerHTML = '';
                return;
            }

            list.innerHTML = filtered.map(resource => this._renderResourceItem(resource)).join('');
            this._renderPagination(count);
        } catch (e) {
            list.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
            document.getElementById('resources-pagination').innerHTML = '';
        }
    },

    _renderResourceItem(resource) {
        const icon = this._resourceIcon(resource.type || resource.file_type || 'file');
        const courseLabel = resource.course?.title ? `Курс: ${resource.course.title}` : '';
        const adminMeta = this._view === 'admin' ? [
            `👤 ${resource.creator?.full_name || 'Невідомо'}`,
            resource.created_at ? `🕐 ${Fmt.date(resource.created_at)}` : ''
        ].filter(Boolean).join(' · ') : '';

        if (this._view === 'docs') {
            const dlStatus = this._myDownloads[resource.id]; // { at, version } | null
            const dlAt = dlStatus?.at;
            const isNewVersion = dlStatus && resource.doc_version > (dlStatus.version || 1);
            const openedAt = localStorage.getItem(`doc_opened_${resource.id}`);

            let statusBadge;
            if (resource.is_tracked_download) {
                if (dlAt && !isNewVersion) {
                    statusBadge = `<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.75rem;color:#10b981;font-weight:500">✅ ${this._ackLabel()} ${Fmt.dateShort(dlAt)}</span>`;
                } else if (dlAt && isNewVersion) {
                    statusBadge = `<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.75rem;color:#d97706;font-weight:500">🔄 Нова версія — потрібне повторне ознайомлення</span>`;
                } else if (openedAt) {
                    statusBadge = `<span style="font-size:.75rem;color:var(--text-muted)">Не ознайомлено · відкрито ${Fmt.dateShort(openedAt)}</span>`;
                } else {
                    statusBadge = `<span style="font-size:.75rem;color:var(--text-muted)">Не ознайомлено</span>`;
                }
            } else {
                statusBadge = openedAt
                    ? `<span style="font-size:.75rem;color:var(--text-muted)">📖 Відкрито ${Fmt.dateShort(openedAt)}</span>`
                    : '';
            }

            const deadlineBadge = this._deadlineBadge(resource, dlStatus);

            return `
                <div class="resource-item" onclick="ResourcesPage.openViewer('${resource.id}')" style="cursor:pointer">
                    <div class="resource-icon ${resource.type || 'file'}">${icon}</div>
                    <div class="resource-info">
                        <div class="resource-title">${resource.title}</div>
                        <div class="resource-meta">
                            ${resource.category ? `Категорія: ${resource.category}` : ''}
                            <span style="font-size:.72rem;font-weight:600;background:var(--bg-base);border:1px solid var(--border);border-radius:4px;padding:1px 5px;margin-left:.3rem;color:var(--text-muted)">${this._fileLabel(resource)}</span>
                            ${resource.access_group
                                ? ` · <span style="color:var(--primary);font-weight:500">${resource.access_group.is_public ? '🌐' : '🔐'} ${resource.access_group.name}</span>`
                                : ''}
                        </div>
                        <div style="margin-top:.3rem;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">${statusBadge}${deadlineBadge}</div>
                    </div>
                    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center" onclick="event.stopPropagation()">
                        <button class="btn btn-ghost btn-sm" onclick="ResourcesPage.openViewer('${resource.id}')">Відкрити</button>
                        ${AppState.isStaff() ? `<button class="btn btn-ghost btn-sm" onclick="ResourcesPage.openEdit('${resource.id}')">✏️</button>` : ''}
                    </div>
                </div>`;
        }

        return `
            <div class="resource-item" onclick="ResourcesPage.openViewer('${resource.id}')" style="cursor:pointer">
                <div class="resource-icon ${resource.type || 'file'}">${icon}</div>
                <div class="resource-info">
                    <div class="resource-title">${resource.title}</div>
                    <div class="resource-meta">
                        ${resource.category ? `Категорія: ${resource.category}` : ''}
                        ${courseLabel ? ` · ${courseLabel}` : ''}
                        <span style="font-size:.72rem;font-weight:600;background:var(--bg-base);border:1px solid var(--border);border-radius:4px;padding:1px 5px;margin-left:.3rem;color:var(--text-muted)">${this._fileLabel(resource)}</span>
                        ${resource.download_allowed === false ? ' · тільки перегляд' : ''}
                        ${resource.access_group
                            ? ` · <span style="color:var(--primary);font-weight:500">${resource.access_group.is_public ? '🌐' : '🔐'} ${resource.access_group.name}</span>`
                            : (this._view === 'admin' ? ' · <span style="color:var(--text-muted)">публічний</span>' : '')}
                    </div>
                    ${adminMeta ? `<div class="resource-meta" style="margin-top:.2rem;opacity:.7">${adminMeta}</div>` : ''}
                </div>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center" onclick="event.stopPropagation()">
                    <button class="btn btn-ghost btn-sm" onclick="ResourcesPage.openViewer('${resource.id}')">Відкрити</button>
                    ${resource.download_allowed ? `<button onclick="ResourcesPage.downloadResource('${resource.id}')" style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);font-size:.8rem;font-weight:500;cursor:pointer;transition:background var(--transition),color var(--transition)" onmouseenter="this.style.background='var(--primary)';this.style.color='#fff'" onmouseleave="this.style.background='transparent';this.style.color='var(--primary)'">⬇ Завантажити</button>` : ''}
                    ${this._view === 'admin' ? `<button class="btn btn-ghost btn-sm" onclick="ResourcesPage.openEdit('${resource.id}')">✏️</button>` : ''}
                    <button class="res-star-btn${Bookmarks.isBookmarked('resource/'+resource.id) ? ' active' : ''}"
                        data-bm-route="resource/${resource.id}"
                        title="${Bookmarks.isBookmarked('resource/'+resource.id) ? 'Видалити з закладок' : 'Зберегти в закладки'}"
                        onclick="Bookmarks.toggleResource('${resource.id}','${resource.title.replace(/'/g,"\\'")}','${icon}','${(resource.category||'').replace(/'/g,"\\'")}')">★</button>
                </div>
            </div>`;
    },

    _ackLabel() {
        return AppState.user?.gender === 'female' ? 'Ознайомлена' : 'Ознайомлений';
    },

    _deadlineBadge(resource, dlStatus) {
        const needsAck = !dlStatus || (resource.doc_version > (dlStatus.version || 1));
        if (!needsAck || !resource.deadline_days) return '';
        const deadlineMs = new Date(resource.created_at).getTime() + resource.deadline_days * 86400000;
        const daysLeft = Math.ceil((deadlineMs - Date.now()) / 86400000);
        if (daysLeft <= 0) return `<span style="font-size:.7rem;background:#fef2f2;color:#dc2626;padding:2px 7px;border-radius:10px;font-weight:500">🔴 Прострочено</span>`;
        if (daysLeft <= 3) return `<span style="font-size:.7rem;background:#fef3c7;color:#d97706;padding:2px 7px;border-radius:10px;font-weight:500">⏰ ${daysLeft} ${daysLeft === 1 ? 'день' : 'дні'}</span>`;
        return `<span style="font-size:.7rem;background:#ecfdf5;color:#059669;padding:2px 7px;border-radius:10px;font-weight:500">📅 до ${Fmt.dateShort(new Date(deadlineMs))}</span>`;
    },

    _buildFilename(resource) {
        const ext = resource.storage_path
            ? '.' + resource.storage_path.split('.').pop().toLowerCase()
            : '';
        const base = (resource.title || resource.storage_path?.split('/').pop() || 'download')
            .replace(/[/\\:*?"<>|]/g, '_').trim();
        return ext && !base.toLowerCase().endsWith(ext) ? base + ext : base;
    },

    _fileLabel(resource) {
        const ext = resource.storage_path
            ? resource.storage_path.split('.').pop().toLowerCase()
            : '';
        const mime = (resource.file_type || '').toLowerCase();
        if (resource.type === 'pdf' || ext === 'pdf') return 'PDF';
        if (resource.type === 'video' || ['mp4','webm','ogg','avi','mov'].includes(ext)) return 'VIDEO';
        if (resource.type === 'image' || ['jpg','jpeg','png','gif','svg','webp'].includes(ext)) return 'IMAGE';
        if (resource.type === 'scorm') return 'SCORM';
        if (resource.type === 'link') return 'LINK';
        if (ext === 'doc'  || mime.includes('msword'))                                    return 'WORD';
        if (ext === 'docx' || mime.includes('wordprocessingml'))                          return 'WORD';
        if (ext === 'xls'  || mime.includes('ms-excel'))                                  return 'EXCEL';
        if (ext === 'xlsx' || mime.includes('spreadsheetml'))                             return 'EXCEL';
        if (ext === 'ppt'  || mime.includes('ms-powerpoint'))                             return 'PPT';
        if (ext === 'pptx' || mime.includes('presentationml'))                            return 'PPT';
        if (ext === 'zip'  || mime.includes('zip'))                                       return 'ZIP';
        if (ext === 'rar'  || mime.includes('rar'))                                       return 'RAR';
        if (ext === '7z')                                                                  return '7Z';
        if (ext === 'txt'  || mime.includes('text/plain'))                                return 'TXT';
        if (ext === 'csv'  || mime.includes('text/csv'))                                  return 'CSV';
        if (ext)                                                                           return ext.toUpperCase();
        return 'FILE';
    },

    _resourceIcon(type) {
        switch (type) {
            case 'pdf': return '📄';
            case 'video': return '🎥';
            case 'image': return '🖼️';
            case 'scorm': return '🧩';
            default: return '📎';
        }
    },

    openViewer(id) {
        if (this._view === 'docs') {
            localStorage.setItem(`doc_opened_${id}`, new Date().toISOString());
        }
        const from = this._view === 'admin' ? 'resources' : this._view === 'docs' ? 'documents' : 'knowledge-base';
        Router.go(`resource/${id}?from=${from}`);
    },

    async _getResourceUrl(resource) {
        if (resource.file_url) return resource.file_url;
        if (resource.storage_path) return await API.resources.getSignedUrl(resource.storage_path);
        throw new Error('Файл не знайдено');
    },

    _buildViewerContent(resource, url) {
        const ext = resource.storage_path
            ? resource.storage_path.split('.').pop().toLowerCase()
            : (resource.file_type?.split('/').pop() || '');
        const description = resource.description ? `<p style="margin:0 0 1rem;color:var(--text-muted)">${resource.description}</p>` : '';

        if (resource.type === 'pdf' || ext === 'pdf') {
            const downloadAllowed = resource.download_allowed !== false ? '1' : '0';
            const viewerUrl = `pdf-viewer.html?file=${encodeURIComponent(url)}&title=${encodeURIComponent(resource.title || 'PDF')}&download=${downloadAllowed}`;
            return `${description}<iframe src="${viewerUrl}" style="width:100%;height:75vh;border:none"></iframe>`;
        }

        if (resource.type === 'video' || ['mp4','webm','ogg'].includes(ext)) {
            const noDownload = resource.download_allowed === false ? 'controlsList="nodownload"' : '';
            return `${description}<video controls ${noDownload} src="${url}" style="width:100%;max-height:75vh;background:#000"></video>`;
        }

        if (resource.type === 'image' || ['jpg','jpeg','png','gif','svg'].includes(ext)) {
            return `${description}<div style="text-align:center"><img src="${url}" style="max-width:100%;max-height:75vh;object-fit:contain"></div>`;
        }

        if (['doc','docx','xls','xlsx','ppt','pptx','txt','csv'].includes(ext)) {
            const gViewUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}`;
            return `${description}
                <div style="padding:2rem;text-align:center;color:var(--text-muted)">
                    <p style="margin-bottom:1rem">Попередній перегляд ${ext.toUpperCase()}-файлів недоступний онлайн.</p>
                    <div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">
                        <a href="${url}" target="_blank" class="btn btn-primary">⬇ Завантажити</a>
                        <a href="${gViewUrl}" target="_blank" rel="noopener" class="btn btn-ghost">🔗 Відкрити в Google Docs</a>
                    </div>
                </div>`;
        }

        return `${description}<div style="padding:2rem;text-align:center;color:var(--text-muted)">Файл не підтримується для перегляду онлайн.</div>
            <div style="text-align:center;margin-top:1rem"><a href="${url}" target="_blank" class="btn btn-primary">Відкрити в новому вікні</a></div>`;
    },

    async downloadResource(id) {
        Loader.show();
        try {
            const resource = await API.resources.getById(id);
            const filename = this._buildFilename(resource);

            let url;
            if (resource.storage_path) {
                url = await API.resources.getSignedDownloadUrl(resource.storage_path, filename);
            } else {
                url = resource.file_url;
            }

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    async downloadTracked(id) {
        await this._trackedAction(id, true);
    },

    async acknowledgeDoc(id) {
        await this._trackedAction(id, false);
    },

    async _trackedAction(id, downloadFile) {
        Loader.show();
        let resource;
        try {
            resource = await API.resources.getById(id);
        } catch (e) {
            Toast.error('Помилка', e.message);
            Loader.hide();
            return;
        }
        Loader.hide();

        const shiftLoc = await API.documentDownloads.getTodayShiftLocation().catch(() => null);
        if (shiftLoc) {
            await this._doTrackedDownload(resource, shiftLoc.id, false, downloadFile);
        } else {
            this._showLocationModal(resource, downloadFile);
        }
    },

    async _showLocationModal(resource, downloadFile) {
        let allLocs = this._myLocations;
        if (!allLocs.length) {
            allLocs = await API.documentDownloads.getAllLocations().catch(() => []);
        }
        const options = allLocs.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
        const actionLabel = downloadFile ? 'Завантажити' : 'Підтвердити';
        Modal.open({
            title: downloadFile ? '📥 Завантажити документ' : '✅ Підтвердити ознайомлення',
            size: 'sm',
            body: `
                <p style="color:var(--text-muted);margin-bottom:1rem">Ви не у зміні. Оберіть локацію, до якої відносите це ознайомлення.</p>
                <div class="form-group">
                    <label>Локація</label>
                    <select id="dl-location-sel">
                        <option value="">— Без локації —</option>
                        ${options}
                    </select>
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="ResourcesPage._confirmLocationDownload()">${actionLabel}</button>`
        });
        this._pendingResource = resource;
        this._pendingDownloadFile = downloadFile;
    },

    async _confirmLocationDownload() {
        const locId = Dom.val('dl-location-sel') || null;
        Modal.close();
        const resource = this._pendingResource;
        const downloadFile = this._pendingDownloadFile;
        this._pendingResource = null;
        this._pendingDownloadFile = false;
        if (!resource) return;
        await this._doTrackedDownload(resource, locId, true, downloadFile);
    },

    async _doTrackedDownload(resource, locationId, isOffShift, downloadFile = true) {
        Loader.show();
        try {
            if (downloadFile) {
                const filename = this._buildFilename(resource);

                let url;
                if (resource.storage_path) {
                    url = await API.resources.getSignedDownloadUrl(resource.storage_path, filename);
                } else {
                    url = resource.file_url;
                }

                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }

            await API.documentDownloads.track(resource.id, { locationId, isOffShift, docVersion: resource.doc_version || 1 });

            this._myDownloads[resource.id] = { at: new Date().toISOString(), version: resource.doc_version || 1 };

            // Update viewer action footer if currently open
            const viewerAction = document.getElementById('doc-viewer-action');
            if (viewerAction) {
                const dateStr = Fmt.dateShort(this._myDownloads[resource.id].at);
                const btnBase = 'display:inline-flex;align-items:center;gap:6px;padding:8px 20px;border-radius:20px;font-size:.875rem;font-weight:500;cursor:pointer;transition:background var(--transition),color var(--transition)';
                const reDownload = resource.download_allowed
                    ? `<button onclick="ResourcesPage.downloadTracked('${resource.id}')"
                            style="${btnBase};border:1.5px solid var(--border);background:transparent;color:var(--text-muted)"
                            onmouseenter="this.style.background='var(--bg-raised)'"
                            onmouseleave="this.style.background='transparent'">⬇ Завантажити повторно</button>`
                    : '';
                viewerAction.style.cssText = 'flex-shrink:0;display:inline-flex;align-items:center;gap:.6rem';
                viewerAction.innerHTML = `<span style="display:inline-flex;align-items:center;gap:.3rem;color:#10b981;font-weight:500;font-size:.85rem;white-space:nowrap">✅ ${this._ackLabel()} ${dateStr}</span>${reDownload}`;
            }

            // Refresh status badge in list
            const listEl = document.getElementById('resource-list');
            if (listEl) {
                const { data } = await API.resources.getAll({ trackedOnly: true, pageSize: this._pageSize, page: this._page,
                    search: this._search || undefined, category: this._category || undefined }).catch(() => ({ data: [] }));
                const filtered = AppState.canSchedule() ? data : data.filter(r => AccessGroupsPage.checkAccess(r.access_group));
                listEl.innerHTML = filtered.map(r => this._renderResourceItem(r)).join('');
            }
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    async openEdit(id) {
        Loader.show();
        try {
            const resource = await API.resources.getById(id);
            this.openForm(resource);
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    openForm(resource = null) {
        const isEdit = !!resource;
        const fileHint = resource && resource.storage_path ? resource.storage_path.split('/').pop() : 'Оберіть файл для завантаження';
        const courseOptions = this._courses.map(c => `<option value="${c.id}" ${resource?.course_id === c.id ? 'selected' : ''}>${c.title}</option>`).join('');

        Modal.open({
            title: isEdit ? '✏️ Редагувати ресурс' : '+ Додати ресурс',
            size: 'lg',
            body: `
                <div class="form-row">
                    <div class="form-group" style="flex:1">
                        <label>Назва *</label>
                        <input id="res-title" type="text" value="${resource?.title || ''}" placeholder="Назва ресурсу">
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Категорія</label>
                        <input id="res-category" type="text" value="${resource?.category || ''}" placeholder="Наприклад: Документація">
                    </div>
                </div>
                <div class="form-group">
                    <label>Опис</label>
                    <textarea id="res-desc" placeholder="Короткий опис ресурсу">${resource?.description || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group" style="flex:1">
                        <label>Курс (необов'язково)</label>
                        <select id="res-course">
                            <option value="">— Без курсу —</option>
                            ${courseOptions}
                        </select>
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Група доступу</label>
                        <select id="res-access-group">
                            <option value="">🌐 Публічний (без обмежень)</option>
                            ${(this._accessGroups || []).map(g =>
                                `<option value="${g.id}" ${resource?.access_group_id === g.id ? 'selected' : ''}>
                                    ${g.is_public ? '🌐' : '🔐'} ${g.name}
                                </option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group" style="display:flex;gap:1.5rem;flex-wrap:wrap">
                    <label class="checkbox-item" style="cursor:pointer;user-select:none">
                        <input type="checkbox" id="res-download" ${resource?.download_allowed !== false ? 'checked' : ''}>
                        <span>Дозволити завантаження</span>
                    </label>
                    <label class="checkbox-item" style="cursor:pointer;user-select:none">
                        <input type="checkbox" id="res-tracked" ${resource?.is_tracked_download ? 'checked' : ''}
                            onchange="ResourcesPage._toggleDeadlineRow(this.checked)">
                        <span>📋 Відстежуваний документ</span>
                    </label>
                </div>
                <div id="res-deadline-row" style="display:${resource?.is_tracked_download ? 'flex' : 'none'};gap:1.5rem;flex-wrap:wrap;align-items:center;margin-top:.25rem">
                    <label class="checkbox-item" style="cursor:pointer;user-select:none">
                        <input type="checkbox" id="res-has-deadline" ${resource?.deadline_days ? 'checked' : ''}
                            onchange="ResourcesPage._toggleDeadlineDays(this.checked)">
                        <span>Встановити дедлайн</span>
                    </label>
                    <div id="res-deadline-days-wrap" style="display:${resource?.deadline_days ? 'flex' : 'none'};align-items:center;gap:.5rem">
                        <input type="number" id="res-deadline-days" min="1" max="90"
                            value="${resource?.deadline_days || 3}"
                            style="width:70px;padding:4px 8px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.875rem">
                        <span style="font-size:.85rem;color:var(--text-muted)">днів після публікації</span>
                    </div>
                    <input type="hidden" id="res-bump-version" value="0">
                    ${resource?.doc_version ? `<span style="font-size:.8rem;color:var(--text-muted)">Версія: <b id="res-version-label">${resource.doc_version}</b>
                        <button type="button" onclick="ResourcesPage._bumpVersion()" title="Збільшити версію — скине всі ознайомлення"
                            style="margin-left:4px;padding:2px 8px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-raised);font-size:.78rem;cursor:pointer;color:var(--text-muted)">
                            ↑ нова версія
                        </button></span>` : ''}
                </div>
                <div class="form-group">
                    <label>Файл</label>
                    <div id="resource-file-upload"></div>
                    <div style="margin-top:.5rem;color:var(--text-muted);font-size:.85rem">${fileHint}</div>
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="ResourcesPage.saveResource(${resource ? `'${resource.id}'` : ''})">${isEdit ? 'Зберегти' : 'Додати'}</button>`
        });

        this._resourceFile = null;
        const uploadContainer = document.getElementById('resource-file-upload');
        if (uploadContainer) {
            const input = FileUpload.createDropZone(uploadContainer, {
                accept: '*/*',
                label: 'Перетягніть файл сюди або натисніть для вибору',
                hint: 'PDF, DOCX, XLSX, MP4, зображення, архіви'
            });
            input.addEventListener('change', () => {
                const file = input.files[0];
                if (!file) return;
                this._resourceFile = file;
                const titleInput = document.getElementById('res-title');
                if (titleInput && !titleInput.value.trim()) {
                    titleInput.value = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
                }
            });
        }
    },

    _toggleDeadlineRow(show) {
        document.getElementById('res-deadline-row').style.display = show ? 'flex' : 'none';
    },

    _toggleDeadlineDays(show) {
        document.getElementById('res-deadline-days-wrap').style.display = show ? 'flex' : 'none';
    },

    _bumpVersion() {
        const el = document.getElementById('res-bump-version');
        if (el) el.value = '1';
        Toast.info('Нова версія', 'При збереженні версія буде збільшена — всі ознайомлення скинуться');
    },

    async saveResource(resourceId) {
        const title = Dom.val('res-title').trim();
        if (!title) { Toast.error('Помилка', 'Вкажіть назву ресурсу'); return; }

        const isTracked = document.getElementById('res-tracked')?.checked === true;
        const hasDeadline = document.getElementById('res-has-deadline')?.checked === true;
        const deadlineDays = hasDeadline ? (parseInt(document.getElementById('res-deadline-days')?.value) || 3) : null;
        const bumpVersion = document.getElementById('res-bump-version')?.value === '1';

        const fields = {
            title,
            description:          Dom.val('res-desc').trim() || null,
            category:             Dom.val('res-category').trim() || null,
            course_id:            Dom.val('res-course') || null,
            access_group_id:      Dom.val('res-access-group') || null,
            download_allowed:     document.getElementById('res-download')?.checked === true,
            is_tracked_download:  isTracked,
            deadline_days:        deadlineDays
        };
        // hidden input set by _bumpVersion
        if (bumpVersion) fields._bump_version = true;

        if (!resourceId && !this._resourceFile) {
            Toast.error('Помилка', 'Оберіть файл для завантаження');
            return;
        }

        Loader.show();
        try {
            if (this._resourceFile) {
                const upload = await API.resources.uploadToStorage(this._resourceFile);
                Object.assign(fields, upload);
            }

            if (resourceId) {
                // Bump doc_version if file changed or manually requested
                if (fields._bump_version || this._resourceFile) {
                    const current = await API.resources.getById(resourceId).catch(() => null);
                    if (current) fields.doc_version = (current.doc_version || 1) + 1;
                }
                delete fields._bump_version;
                await API.resources.update(resourceId, fields);
                Toast.success('Збережено', 'Ресурс оновлено' + (fields.doc_version ? ` (версія ${fields.doc_version})` : ''));
            } else {
                fields.doc_version = 1;
                const created = await API.resources.create(fields);
                // Notify users on publish of tracked document
                if (fields.is_tracked_download && created) {
                    API.documentDownloads.notifyOnPublish({ ...fields, id: created.id }).catch(() => {});
                }
                Toast.success('Додано', 'Новий ресурс успішно створено');
            }

            Modal.close();
            await Promise.all([this.load(), this._loadFilters()]);
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    setPage(page) {
        this._page = page;
        this.load();
    },

    _renderPagination(total) {
        const pages = Math.ceil(total / this._pageSize);
        const container = document.getElementById('resources-pagination');
        if (!container) return;
        if (pages <= 1) { container.innerHTML = ''; return; }
        container.innerHTML = Array.from({ length: pages }, (_, index) => `
            <button class="btn ${index === this._page ? 'btn-primary' : 'btn-ghost'} btn-sm"
                    onclick="ResourcesPage.setPage(${index})">${index + 1}</button>`).join('');
    }
};

// ================================================================
// ResourceViewPage — inline resource viewer (full page, no modal)
// ================================================================

const ResourceViewPage = {

    async init(container, { id, from } = {}) {
        if (!id) { Router.back(); return; }

        UI.setBreadcrumb([{ label: 'Перегляд ресурсу' }]);

        container.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;min-height:300px">
                <div class="spinner"></div>
            </div>`;

        try {
            const resource = await API.resources.getById(id);
            const url      = await this._getUrl(resource);
            let dlStatus = null;
            if (from === 'documents') {
                const map = await API.documentDownloads.getMyLatest([id]).catch(() => ({}));
                dlStatus = map[id] || null;
            }
            this._render(container, resource, url, from, dlStatus);
        } catch (e) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <h3>${e.message}</h3>
                    <button class="btn btn-primary" onclick="Router.back()">← Назад</button>
                </div>`;
        }
    },

    async _getUrl(resource) {
        if (resource.file_url)    return resource.file_url;
        if (resource.storage_path) return await API.resources.getSignedUrl(resource.storage_path);
        throw new Error('Файл не знайдено');
    },

    _render(container, resource, url, from, dlStatus) {
        const ext = resource.storage_path
            ? resource.storage_path.split('.').pop().toLowerCase()
            : (resource.file_type?.split('/').pop() || '');

        const isPdf   = resource.type === 'pdf' || ext === 'pdf';
        const isVideo = resource.type === 'video' || ['mp4','webm','ogg'].includes(ext);
        const isImage = resource.type === 'image' || ['jpg','jpeg','png','gif','svg','webp'].includes(ext);
        const isDoc   = ['doc','docx','xls','xlsx','ppt','pptx','txt','csv'].includes(ext);

        const categoryBadge = resource.category
            ? `<span class="badge" style="background:var(--bg-raised);color:var(--text-secondary);font-size:.75rem;padding:3px 10px;border-radius:20px;border:1px solid var(--border)">${resource.category}</span>`
            : '';
        const courseBadge = resource.course?.title
            ? `<span class="badge" style="background:var(--bg-raised);color:var(--text-secondary);font-size:.75rem;padding:3px 10px;border-radius:20px;border:1px solid var(--border)">📚 ${resource.course.title}</span>`
            : '';

        let viewerHtml;

        if (isPdf) {
            const dl = resource.download_allowed !== false ? '1' : '0';
            const viewerUrl = `pdf-viewer.html?file=${encodeURIComponent(url)}&title=${encodeURIComponent(resource.title || 'PDF')}&download=${dl}`;
            viewerHtml = `<iframe src="${viewerUrl}" style="width:100%;height:calc(100vh - 220px);min-height:500px;border:none;display:block"></iframe>`;

        } else if (isVideo) {
            const noDownload = resource.download_allowed === false ? 'controlsList="nodownload"' : '';
            viewerHtml = `
                <div style="background:#000;border-radius:var(--radius-lg);overflow:hidden">
                    <video controls ${noDownload} src="${url}" style="width:100%;max-height:calc(100vh - 240px);display:block"></video>
                </div>`;

        } else if (isImage) {
            viewerHtml = `
                <div style="background:var(--bg-raised);border-radius:var(--radius-lg);padding:1.5rem;text-align:center;border:1px solid var(--border)">
                    <img src="${url}" style="max-width:100%;max-height:calc(100vh - 280px);object-fit:contain;border-radius:var(--radius-md)">
                </div>`;

        } else if (isDoc) {
            const gUrl     = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
            const gOpenUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}`;
            const dlName   = ResourcesPage._buildFilename(resource);
            const dlBtn    = resource.download_allowed !== false
                ? `<a href="${url}" download="${dlName}" class="btn btn-primary">⬇ Завантажити</a>`
                : '';
            viewerHtml = `
                <div style="position:relative;width:100%;height:calc(100vh - 220px);min-height:500px;border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border)">
                    <div id="doc-loader" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg-raised);gap:.75rem;z-index:2">
                        <div class="spinner"></div>
                        <span style="color:var(--text-muted);font-size:.85rem">Завантаження документа…</span>
                    </div>
                    <div id="doc-fallback" style="display:none;position:absolute;inset:0;flex-direction:column;align-items:center;justify-content:center;gap:1rem;background:var(--bg-raised);text-align:center;padding:2rem;z-index:2">
                        <div style="font-size:2.5rem">📄</div>
                        <p style="color:var(--text-muted);font-size:.875rem;margin:0">Не вдалось завантажити попередній перегляд</p>
                        <div style="display:flex;gap:.75rem;flex-wrap:wrap;justify-content:center">
                            ${dlBtn}
                            <button class="btn btn-ghost" onclick="ResourceViewPage._retryDoc()">🔄 Спробувати ще раз</button>
                            <a href="${gOpenUrl}" target="_blank" rel="noopener" class="btn btn-ghost">🔗 Google Docs</a>
                        </div>
                    </div>
                    <iframe id="doc-iframe" src="${gUrl}"
                        style="width:100%;height:100%;border:none;display:block"
                        onload="ResourceViewPage._onDocLoad(this)">
                    </iframe>
                </div>`;

        } else {
            viewerHtml = `
                <div style="text-align:center;padding:3rem;background:var(--bg-raised);border-radius:var(--radius-lg);border:1px solid var(--border);color:var(--text-muted)">
                    <div style="font-size:3rem;margin-bottom:1rem">📎</div>
                    <p style="margin-bottom:1.5rem">Цей тип файлу не підтримується для перегляду онлайн.</p>
                    <a href="${url}" target="_blank" class="btn btn-primary">Відкрити в новому вікні</a>
                </div>`;
        }

        const deadlineBadge = from === 'documents' ? ResourcesPage._deadlineBadge(resource, dlStatus) : '';

        container.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:1rem">

                <!-- Header -->
                <div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">
                    <button class="btn btn-ghost btn-sm" onclick="Router.back()" style="flex-shrink:0;margin-top:.2rem">
                        ← Назад
                    </button>
                    <div style="flex:1;min-width:0">
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:.4rem">
                            <h1 style="margin:0;font-size:1.4rem;font-weight:700;line-height:1.3">${resource.title}</h1>
                            <button class="res-star-btn${Bookmarks.isBookmarked('resource/'+resource.id) ? ' active' : ''}"
                                data-bm-route="resource/${resource.id}"
                                title="${Bookmarks.isBookmarked('resource/'+resource.id) ? 'Видалити з закладок' : 'Зберегти в закладки'}"
                                onclick="Bookmarks.toggleResource('${resource.id}','${resource.title.replace(/'/g,"\\'")}','${ResourcesPage._resourceIcon(resource.type||resource.file_type||'file')}','${(resource.category||'').replace(/'/g,"\\'")}')">★</button>
                        </div>
                        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
                            ${categoryBadge}
                            ${courseBadge}
                            ${resource.download_allowed === false ? `<span class="badge" style="background:rgba(239,68,68,.1);color:#f87171;font-size:.75rem;padding:3px 10px;border-radius:20px;border:1px solid rgba(239,68,68,.2)">тільки перегляд</span>` : ''}
                            ${deadlineBadge}
                        </div>
                        ${resource.description ? `<p style="margin:.6rem 0 0;color:var(--text-muted);font-size:.875rem">${resource.description}</p>` : ''}
                    </div>
                    ${this._buildActionFooter(resource, from, dlStatus, isPdf)}
                    ${AppState.isStaff() ? `
                    <button title="Редагувати" onclick="ResourcesPage.openEdit('${resource.id}')"
                            style="flex-shrink:0;width:40px;height:40px;border-radius:50%;border:2px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background var(--transition),border-color var(--transition)"
                            onmouseenter="this.style.background='var(--bg-hover)';this.style.borderColor='var(--primary)'"
                            onmouseleave="this.style.background='var(--bg-raised)';this.style.borderColor='var(--border)'">
                        ✏️
                    </button>` : ''}
                </div>

                <!-- Download bar (above viewer, for all downloadable files) -->
                ${resource.download_allowed !== false
                    ? `<div style="display:flex;justify-content:center;padding:.25rem 0">
                        <a href="${url}" download="${ResourcesPage._buildFilename(resource)}"
                            style="display:inline-flex;align-items:center;gap:8px;padding:10px 32px;background:var(--primary);color:#fff;border-radius:24px;font-size:.95rem;font-weight:600;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.15);transition:background var(--transition)"
                            onmouseenter="this.style.background='var(--primary-dark,#1d4ed8)'"
                            onmouseleave="this.style.background='var(--primary)'">
                            ⬇ Завантажити
                        </a>
                    </div>`
                    : ''}

                <!-- Viewer -->
                ${viewerHtml}

            </div>`;

        this._setupUnlockListeners(resource, from, dlStatus, isPdf, isVideo, isImage, isDoc);
        if (isDoc) this._startDocTimeout(url);
    },

    _buildActionFooter(resource, from, dlStatus, isPdf) {
        const id = resource.id;
        const btnBase = 'flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;font-size:.85rem;font-weight:500;cursor:pointer;transition:background var(--transition),color var(--transition)';

        if (from === 'documents') {
            if (!resource.is_tracked_download) {
                return ''; // download handled by centered bar above viewer
            }

            const isNewVersion = dlStatus && resource.doc_version > (dlStatus.version || 1);
            const alreadyAcked = dlStatus && !isNewVersion;

            if (alreadyAcked) {
                const reDownload = resource.download_allowed
                    ? `<button onclick="ResourcesPage.downloadTracked('${id}')"
                            style="${btnBase};border:1.5px solid var(--border);background:transparent;color:var(--text-muted)"
                            onmouseenter="this.style.background='var(--bg-raised)'"
                            onmouseleave="this.style.background='transparent'">⬇ Завантажити повторно</button>`
                    : '';
                return `<div id="doc-viewer-action" style="flex-shrink:0;display:inline-flex;align-items:center;gap:.6rem">
                    <span style="display:inline-flex;align-items:center;gap:.3rem;color:#10b981;font-weight:500;font-size:.85rem;white-space:nowrap">✅ ${ResourcesPage._ackLabel()} ${Fmt.dateShort(dlStatus.at)}</span>
                    ${reDownload}
                </div>`;
            }

            // Needs (re-)acknowledgment — locked until scroll end
            const lockHint = isNewVersion
                ? '🔄 Нова версія — пролистайте до кінця'
                : '📜 Пролистайте документ до кінця';
            const ackBtn = `<button class="doc-unlock-btn" onclick="ResourcesPage.acknowledgeDoc('${id}')"
                    style="${btnBase};display:none;border:1.5px solid #10b981;background:transparent;color:#10b981"
                    onmouseenter="this.style.background='#10b981';this.style.color='#fff'"
                    onmouseleave="this.style.background='transparent';this.style.color='#10b981'">✅ ${ResourcesPage._ackLabel()}</button>`;
            const dlBtn = resource.download_allowed
                ? `<button class="doc-unlock-btn" onclick="ResourcesPage.downloadTracked('${id}')"
                        style="${btnBase};display:none;border:1.5px solid var(--primary);background:transparent;color:var(--primary)"
                        onmouseenter="this.style.background='var(--primary)';this.style.color='#fff'"
                        onmouseleave="this.style.background='transparent';this.style.color='var(--primary)'">⬇ Завантажити</button>`
                : '';
            return `<div id="doc-viewer-action" style="flex-shrink:0;display:inline-flex;align-items:center;gap:.5rem">
                <span id="doc-viewer-lock" style="font-size:.8rem;color:var(--text-muted);white-space:nowrap">${lockHint}</span>
                ${dlBtn}${ackBtn}
            </div>`;
        }

        return ''; // download handled by centered bar above viewer
    },

    _docTimeoutId: null,
    _docIframeUrl: null,

    _startDocTimeout(url) {
        this._docIframeUrl = url;
        clearTimeout(this._docTimeoutId);
        this._docTimeoutId = setTimeout(() => {
            // If loader is still visible after 20s — show fallback
            const loader = document.getElementById('doc-loader');
            if (loader && loader.style.display !== 'none') {
                this._showDocFallback();
            }
        }, 20000);
    },

    _onDocLoad(iframe) {
        // onload fires even for Google's own error page, so wait briefly
        // then check if content is actually there by seeing if loader still shown
        setTimeout(() => {
            const loader = document.getElementById('doc-loader');
            if (loader) loader.style.display = 'none';
            clearTimeout(this._docTimeoutId);
        }, 800);
    },

    _showDocFallback() {
        const loader   = document.getElementById('doc-loader');
        const fallback = document.getElementById('doc-fallback');
        const iframe   = document.getElementById('doc-iframe');
        if (loader)   loader.style.display   = 'none';
        if (iframe)   iframe.style.display   = 'none';
        if (fallback) fallback.style.display = 'flex';
    },

    _retryDoc() {
        const fallback = document.getElementById('doc-fallback');
        const loader   = document.getElementById('doc-loader');
        const iframe   = document.getElementById('doc-iframe');
        if (!iframe) return;
        if (fallback) fallback.style.display = 'none';
        if (loader)  { loader.style.display  = 'flex'; }
        if (iframe)  { iframe.style.display  = 'block'; iframe.src = iframe.src; }
        if (this._docIframeUrl) this._startDocTimeout(this._docIframeUrl);
    },

    _setupUnlockListeners(resource, from, dlStatus, isPdf, isVideo, isImage, isDoc) {
        const isNewVersion = dlStatus && resource.doc_version > (dlStatus.version || 1);
        const needsUnlock = from === 'documents' && resource.is_tracked_download && (!dlStatus || isNewVersion);
        if (!needsUnlock) return;

        const unlock = () => {
            const lock = document.getElementById('doc-viewer-lock');
            if (lock) lock.style.display = 'none';
            document.querySelectorAll('#doc-viewer-action .doc-unlock-btn').forEach(btn => {
                btn.style.display = 'inline-flex';
            });
        };

        if (isImage) { unlock(); return; }

        if (isPdf) {
            const handler = e => {
                if (e.data?.type === 'pdf-scroll-end') {
                    unlock();
                    window.removeEventListener('message', handler);
                }
            };
            window.addEventListener('message', handler);
            return;
        }

        if (isVideo) {
            // use a short timeout to let the video element appear in DOM
            setTimeout(() => {
                const video = document.querySelector('video');
                if (!video) { unlock(); return; }
                const handler = () => {
                    if (video.duration && video.currentTime / video.duration >= 0.85) {
                        unlock();
                        video.removeEventListener('timeupdate', handler);
                    }
                };
                video.addEventListener('timeupdate', handler);
            }, 200);
            return;
        }

        // Google Docs / other iframe: 15s fallback
        setTimeout(unlock, 15000);
    }
};