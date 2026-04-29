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
        document.querySelectorAll('[id^="docs-tab-"]').forEach(btn => {
            btn.className = btn.id === `docs-tab-${tab}` ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm';
        });
        const content = document.getElementById('docs-tab-content');
        if (!content) return;
        if (tab === 'list') {
            content.innerHTML = `
                <div id="resource-list" class="resource-list-docs"></div>
                <div id="resources-pagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:1.5rem"></div>`;
            this.load();
        } else if (tab === 'status') {
            this._renderStatusTab(content);
        } else if (tab === 'offshift') {
            this._renderOffShiftTab(content);
        }
    },

    async _renderStatusTab(content) {
        content.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            const locationIds = this._myLocations.map(l => l.id);
            const [docsRes, downloads] = await Promise.all([
                API.resources.getAll({ trackedOnly: true, pageSize: 200 }),
                API.documentDownloads.getStatusForLocations(locationIds)
            ]);
            const allDocs = docsRes.data || [];
            let docs = AppState.canSchedule() ? allDocs : allDocs.filter(r => AccessGroupsPage.checkAccess(r.access_group));

            if (!docs.length || !this._myLocations.length) {
                content.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><h3>Немає даних для відображення</h3></div>`;
                return;
            }

            // Build set: locationId+resourceId → true if downloaded
            const done = new Set(downloads.map(d => `${d.location_id}|${d.resource_id}`));

            const locHeaders = this._myLocations.map(l =>
                `<th style="font-size:.75rem;padding:.5rem .75rem;text-align:center;min-width:90px;max-width:120px;word-break:break-word">${l.name}</th>`
            ).join('');

            const rows = docs.map(doc => {
                const cells = this._myLocations.map(l => {
                    const ok = done.has(`${l.id}|${doc.id}`);
                    return `<td style="text-align:center;padding:.5rem">${ok ? '✅' : '<span style="color:var(--text-muted);opacity:.4">—</span>'}</td>`;
                }).join('');
                return `<tr>
                    <td style="padding:.5rem .75rem;font-size:.85rem;font-weight:500;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis">${doc.title}</td>
                    ${cells}
                </tr>`;
            }).join('');

            content.innerHTML = `
                <div style="overflow-x:auto">
                    <table style="width:100%;border-collapse:collapse;font-size:.85rem">
                        <thead>
                            <tr style="border-bottom:2px solid var(--border);background:var(--bg-raised)">
                                <th style="padding:.5rem .75rem;text-align:left;min-width:180px">Документ</th>
                                ${locHeaders}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.replace(/<tr>/g, '<tr style="border-bottom:1px solid var(--border)">')}
                        </tbody>
                    </table>
                </div>`;
        } catch (e) {
            content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
        }
    },

    async _renderOffShiftTab(content) {
        content.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            const locationIds = this._myLocations.map(l => l.id);
            const downloads = await API.documentDownloads.getOffShiftForLocations(locationIds);
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
                API.resources.getCategories().catch(() => []),
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
                trackedOnly: this._view === 'docs'
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
            const dlAt = this._myDownloads[resource.id];
            const statusBadge = dlAt
                ? `<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.75rem;color:#10b981;font-weight:500">✅ ${this._ackLabel()} ${Fmt.dateShort(dlAt)}</span>`
                : `<span style="font-size:.75rem;color:var(--text-muted)">Не ознайомлено</span>`;

            return `
                <div class="resource-item" onclick="ResourcesPage.openViewer('${resource.id}')" style="cursor:pointer">
                    <div class="resource-icon ${resource.type || 'file'}">${icon}</div>
                    <div class="resource-info">
                        <div class="resource-title">${resource.title}</div>
                        <div class="resource-meta">
                            ${resource.category ? `Категорія: ${resource.category}` : ''}
                            ${resource.file_type ? ` · ${resource.file_type}` : ''}
                            ${resource.access_group
                                ? ` · <span style="color:var(--primary);font-weight:500">${resource.access_group.is_public ? '🌐' : '🔐'} ${resource.access_group.name}</span>`
                                : ''}
                        </div>
                        <div style="margin-top:.3rem">${statusBadge}</div>
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
                        ${resource.file_type ? ` · ${resource.file_type}` : ''}
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

    _buildFilename(resource) {
        const ext = resource.storage_path
            ? '.' + resource.storage_path.split('.').pop().toLowerCase()
            : '';
        const base = (resource.title || resource.storage_path?.split('/').pop() || 'download')
            .replace(/[/\\:*?"<>|]/g, '_').trim();
        return ext && !base.toLowerCase().endsWith(ext) ? base + ext : base;
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
            const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
            return `${description}<iframe src="${viewerUrl}" style="width:100%;height:75vh;border:none"></iframe>`;
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

            await API.documentDownloads.track(resource.id, { locationId, isOffShift }).catch(() => {});

            this._myDownloads[resource.id] = new Date().toISOString();

            // Update viewer action footer if currently open
            const viewerAction = document.getElementById('doc-viewer-action');
            if (viewerAction) {
                const dateStr = Fmt.dateShort(this._myDownloads[resource.id]);
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
                        <input type="checkbox" id="res-tracked" ${resource?.is_tracked_download ? 'checked' : ''}>
                        <span>📋 Відстежуваний документ</span>
                    </label>
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

    async saveResource(resourceId) {
        const title = Dom.val('res-title').trim();
        if (!title) { Toast.error('Помилка', 'Вкажіть назву ресурсу'); return; }

        const fields = {
            title,
            description:          Dom.val('res-desc').trim() || null,
            category:             Dom.val('res-category').trim() || null,
            course_id:            Dom.val('res-course') || null,
            access_group_id:      Dom.val('res-access-group') || null,
            download_allowed:     document.getElementById('res-download')?.checked === true,
            is_tracked_download:  document.getElementById('res-tracked')?.checked === true
        };

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
                await API.resources.update(resourceId, fields);
                Toast.success('Збережено', 'Ресурс оновлено');
            } else {
                await API.resources.create(fields);
                Toast.success('Додано', 'Новий ресурс успішно створено');
            }

            Modal.close();
            await this.load();
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
            const gUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
            viewerHtml = `<iframe src="${gUrl}" style="width:100%;height:calc(100vh - 220px);min-height:500px;border:none;border-radius:var(--radius-lg);display:block"></iframe>`;

        } else {
            viewerHtml = `
                <div style="text-align:center;padding:3rem;background:var(--bg-raised);border-radius:var(--radius-lg);border:1px solid var(--border);color:var(--text-muted)">
                    <div style="font-size:3rem;margin-bottom:1rem">📎</div>
                    <p style="margin-bottom:1.5rem">Цей тип файлу не підтримується для перегляду онлайн.</p>
                    <a href="${url}" target="_blank" class="btn btn-primary">Відкрити в новому вікні</a>
                </div>`;
        }

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

                <!-- Viewer -->
                ${viewerHtml}

            </div>`;
    },

    _buildActionFooter(resource, from, dlStatus, isPdf) {
        const id = resource.id;
        const btnBase = 'flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;font-size:.85rem;font-weight:500;cursor:pointer;transition:background var(--transition),color var(--transition)';

        if (from === 'documents') {
            if (dlStatus) {
                const reDownload = resource.download_allowed
                    ? `<button onclick="ResourcesPage.downloadTracked('${id}')"
                            style="${btnBase};border:1.5px solid var(--border);background:transparent;color:var(--text-muted)"
                            onmouseenter="this.style.background='var(--bg-raised)'"
                            onmouseleave="this.style.background='transparent'">⬇ Завантажити повторно</button>`
                    : '';
                return `<div id="doc-viewer-action" style="flex-shrink:0;display:inline-flex;align-items:center;gap:.6rem">
                    <span style="display:inline-flex;align-items:center;gap:.3rem;color:#10b981;font-weight:500;font-size:.85rem;white-space:nowrap">✅ ${ResourcesPage._ackLabel()} ${Fmt.dateShort(dlStatus)}</span>
                    ${reDownload}
                </div>`;
            }
            const ackBtn = `<button onclick="ResourcesPage.acknowledgeDoc('${id}')"
                    style="${btnBase};border:1.5px solid #10b981;background:transparent;color:#10b981"
                    onmouseenter="this.style.background='#10b981';this.style.color='#fff'"
                    onmouseleave="this.style.background='transparent';this.style.color='#10b981'">✅ Ознайомлений</button>`;
            const dlBtn = resource.download_allowed
                ? `<button onclick="ResourcesPage.downloadTracked('${id}')"
                        style="${btnBase};border:1.5px solid var(--primary);background:transparent;color:var(--primary)"
                        onmouseenter="this.style.background='var(--primary)';this.style.color='#fff'"
                        onmouseleave="this.style.background='transparent';this.style.color='var(--primary)'">⬇ Завантажити</button>`
                : '';
            return `<div id="doc-viewer-action" style="flex-shrink:0;display:inline-flex;align-items:center;gap:.5rem">
                ${dlBtn}${ackBtn}
            </div>`;
        }

        if (resource.download_allowed !== false && !isPdf) {
            return `<button onclick="ResourcesPage.downloadResource('${id}')"
                    style="${btnBase};border:1.5px solid var(--primary);background:transparent;color:var(--primary)"
                    onmouseenter="this.style.background='var(--primary)';this.style.color='#fff'"
                    onmouseleave="this.style.background='transparent';this.style.color='var(--primary)'">⬇ Завантажити</button>`;
        }

        return '';
    }
};
