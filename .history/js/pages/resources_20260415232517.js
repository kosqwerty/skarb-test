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
    _resourceFile: null,

    async init(container, { view = 'kb' } = {}) {
        this._page = 0;
        this._search = '';
        this._category = '';
        this._courseId = '';
        this._view = view;
        this._resourceFile = null;

        if (view === 'admin' && !AppState.isStaff()) {
            Toast.error('Заборонено', 'Тільки адміністратори та викладачі можуть керувати ресурсами');
            Router.go('dashboard');
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

    async _loadFilters() {
        try {
            const courseArgs = AppState.isStaff() ? { pageSize: 200 } : { published: true, pageSize: 200 };
            const [coursesRes, categories] = await Promise.all([
                API.courses.getAll(courseArgs).catch(() => ({ data: [] })),
                API.resources.getCategories().catch(() => [])
            ]);
            this._courses = coursesRes.data || [];
            this._categories = categories;
            this._renderFilterOptions();
        } catch (e) {
            console.warn('[ResourcesPage] filter load error', e);
        }
    },

    _renderFilterOptions() {
        const categorySelect = document.getElementById('resource-category');
        const courseSelect = document.getElementById('resource-course');
        if (!categorySelect || !courseSelect) return;

        categorySelect.innerHTML = `<option value="">Всі категорії</option>` +
            this._categories.map(c => `<option value="${c}">${c}</option>`).join('');

        courseSelect.innerHTML = `<option value="">Всі курси</option>` +
            this._courses.map(c => `<option value="${c.id}">${c.title}</option>`).join('');
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
                includeLessonResources: false
            });

            if (!data || !data.length) {
                list.innerHTML = `
                    <div class="empty-state" style="grid-column:1/-1">
                        <div class="empty-icon">📂</div>
                        <h3>Ресурси не знайдено</h3>
                        <p>Спробуйте змінити пошук або фільтри.</p>
                    </div>`;
                document.getElementById('resources-pagination').innerHTML = '';
                return;
            }

            list.innerHTML = data.map(resource => this._renderResourceItem(resource)).join('');
            this._renderPagination(count);
        } catch (e) {
            list.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
            document.getElementById('resources-pagination').innerHTML = '';
        }
    },

    _renderResourceItem(resource) {
        const icon = this._resourceIcon(resource.type || resource.file_type || 'file');
        const courseLabel = resource.course?.title ? `<span>Курс: ${resource.course.title}</span>` : '';
        const downloadLabel = resource.download_allowed ? 'Так' : 'Ні';
        return `
            <div class="resource-item">
                <div class="resource-icon ${resource.type || 'file'}">${icon}</div>
                <div class="resource-info">
                    <div class="resource-title">${resource.title}</div>
                    <div class="resource-meta">
                        ${resource.category ? `Категорія: ${resource.category}` : ''}
                        ${courseLabel ? ` · ${courseLabel}` : ''}
                        ${resource.file_type ? ` · ${resource.file_type}` : ''}
                        ${resource.download_allowed === false ? ' · тільки перегляд' : ''}
                    </div>
                </div>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                    <button class="btn btn-ghost btn-sm" onclick="ResourcesPage.openViewer('${resource.id}')">Відкрити</button>
                    ${resource.download_allowed ? `<button class="btn btn-secondary btn-sm" onclick="ResourcesPage.downloadResource('${resource.id}')">Скачати</button>` : ''}
                    ${this._view === 'admin' ? `<button class="btn btn-ghost btn-sm" onclick="ResourcesPage.openEdit('${resource.id}')">✏️</button>` : ''}
                </div>
            </div>`;
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

    async openViewer(id) {
        Loader.show();
        try {
            const resource = await API.resources.getById(id);
            const url = await this._getResourceUrl(resource);
            const content = this._buildViewerContent(resource, url);
            const footer = resource.download_allowed ? `
                <button class="btn btn-secondary" onclick="ResourcesPage.downloadResource('${resource.id}')">Скачати</button>` : '';
            Modal.open({
                title: resource.title,
                body: content,
                footer,
                size: 'xl'
            });
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    async _getResourceUrl(resource) {
        if (resource.file_url) return resource.file_url;
        if (resource.storage_path) return await API.resources.getSignedUrl(resource.storage_path);
        throw new Error('Файл не знайдено');
    },

    _buildViewerContent(resource, url) {
        const ext = resource.storage_path
            ? resource.storage_path.split('.').pop().toLowerCase()
            : resource.file_type?.split('/').pop();
        const description = resource.description ? `<p style="margin:0 0 1rem;color:var(--text-muted)">${resource.description}</p>` : '';

        if (resource.type === 'pdf' || ext === 'pdf') {
            const viewerUrl = Utils.pdfViewerUrl(url, resource.title);
            return `
                <div class="card" style="overflow:hidden">
                    <div class="card-header" style="justify-content:space-between;align-items:flex-start">
                        <div>
                            <h3 style="margin:0;font-size:1.1rem">${resource.title}</h3>
                            ${resource.description ? `<p style="margin:.5rem 0 0;color:var(--text-muted)">${resource.description}</p>` : ''}
                        </div>
                        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                            <a href="${url}" target="_blank" class="btn btn-ghost btn-sm">Відкрити у новому вікні</a>
                            ${resource.download_allowed ? `<a href="${url}" target="_blank" class="btn btn-secondary btn-sm">Завантажити</a>` : ''}
                        </div>
                    </div>
                    <div class="card-body" style="padding:0">
                        <iframe src="${viewerUrl}" style="width:100%;height:75vh;border:none" title="${resource.title}"></iframe>
                    </div>
                </div>`;
        }

        if (resource.type === 'video' || ['mp4','webm','ogg'].includes(ext)) {
            return `${description}<video controls src="${url}" style="width:100%;max-height:75vh;background:#000"></video>`;
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
            const url = await this._getResourceUrl(resource);
            window.open(url, '_blank');
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
                    <div class="form-group" style="flex:1;display:flex;align-items:flex-end">
                        <label class="checkbox-item" style="cursor:pointer;user-select:none">
                            <input type="checkbox" id="res-download" ${resource?.download_allowed !== false ? 'checked' : ''}>
                            <span>Дозволити завантаження</span>
                        </label>
                    </div>
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
                if (input.files[0]) this._resourceFile = input.files[0];
            });
        }
    },

    async saveResource(resourceId) {
        const title = Dom.val('res-title').trim();
        if (!title) { Toast.error('Помилка', 'Вкажіть назву ресурсу'); return; }

        const fields = {
            title,
            description: Dom.val('res-desc').trim() || null,
            category: Dom.val('res-category').trim() || 'general',
            course_id: Dom.val('res-course') || null,
            download_allowed: document.getElementById('res-download')?.checked === true
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
