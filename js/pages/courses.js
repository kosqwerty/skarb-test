// ================================================================
// EduFlow LMS — Сторінка курсів
// ================================================================

const CoursesPage = {
    _page: 0,
    _search: '',
    _currentTab: 'all',

    async init(container, params = {}) {
        this._page   = 0;
        this._search = params.search || '';
        UI.setBreadcrumb([{ label: 'Курси' }]);

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">
                    <h1>📚 Курси</h1>
                    <p>Каталог навчальних курсів</p>
                </div>
                <div class="page-actions">
                    <div style="display:flex;gap:.5rem;align-items:center">
                        <input type="text" id="course-search" placeholder="Пошук курсів..." value="${this._search}"
                               style="width:220px" onkeyup="CoursesPage.onSearch(event)">
                        <select id="level-filter" onchange="CoursesPage.load()" style="width:auto">
                            <option value="">Всі рівні</option>
                            <option value="beginner">Початковий</option>
                            <option value="intermediate">Середній</option>
                            <option value="advanced">Просунутий</option>
                        </select>
                    </div>
                    ${AppState.isStaff() ? `<button class="btn btn-primary" onclick="CoursesPage.openCreate()">+ Створити курс</button>` : ''}
                </div>
            </div>

            <div id="courses-tabs" class="tabs" style="${AppState.isStaff() ? '' : 'display:none'}">
                <button class="tab active" onclick="CoursesPage.setTab('all', this)">Всі курси</button>
                <button class="tab" onclick="CoursesPage.setTab('mine', this)">Мої курси</button>
                <button class="tab" onclick="CoursesPage.setTab('enrolled', this)">Я записаний</button>
            </div>

            <div id="courses-grid" class="courses-grid"></div>
            <div id="courses-pagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:2rem"></div>`;

        this._currentTab = AppState.isStaff() ? 'all' : 'enrolled';
        await this.load();
    },

    onSearch(e) {
        this._search = e.target.value;
        this._page   = 0;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.load(), 350);
    },

    async setTab(tab, el) {
        this._currentTab = tab;
        this._page = 0;
        document.querySelectorAll('#courses-tabs .tab').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
        await this.load();
    },

    async load() {
        const grid = document.getElementById('courses-grid');
        if (!grid) return;
        grid.innerHTML = `<div style="grid-column:1/-1;display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        try {
            let courses = [], total = 0;
            const level = Dom.val('level-filter');

            if (this._currentTab === 'enrolled' || !AppState.isStaff()) {
                const enrollments = await API.enrollments.getMyEnrollments();
                let items = enrollments.map(e => e.course).filter(Boolean);
                if (this._search) items = items.filter(c => c.title.toLowerCase().includes(this._search.toLowerCase()));
                if (level) items = items.filter(c => c.level === level);
                courses = items; total = items.length;
            } else if (this._currentTab === 'mine') {
                const all = await API.courses.getAll({ search: this._search, page: this._page });
                courses   = all.data.filter(c => c.teacher_id === AppState.user.id);
                total     = courses.length;
            } else {
                const all = await API.courses.getAll({ search: this._search, page: this._page });
                courses   = all.data; total = all.count;
            }

            if (level && courses.length) courses = courses.filter(c => c.level === level);

            const myEnrollments = await API.enrollments.getMyEnrollments().catch(() => []);
            const enrollMap     = Object.fromEntries(myEnrollments.map(e => [e.course_id, e]));

            if (!courses.length) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column:1/-1">
                        <div class="empty-icon">📚</div>
                        <h3>Курси не знайдено</h3>
                        <p>Спробуйте змінити критерії пошуку</p>
                        ${AppState.isStaff() ? `<button class="btn btn-primary" onclick="CoursesPage.openCreate()">Створити перший курс</button>` : ''}
                    </div>`;
                return;
            }

            grid.innerHTML = courses.map(course => this._renderCard(course, enrollMap[course.id])).join('');
            this._renderPagination(total);
        } catch(e) {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p style="color:var(--danger)">${e.message}</p></div>`;
        }
    },

    _renderCard(course, enrollment) {
        const thumb = course.thumbnail_url
            ? `<img src="${course.thumbnail_url}" alt="${course.title}" loading="lazy">`
            : `<div class="thumb-placeholder">📖</div>`;
        const pct = enrollment?.progress_percentage || 0;
        const levelColor = { beginner:'badge-success', intermediate:'badge-warning', advanced:'badge-danger' }[course.level] || 'badge-muted';

        return `
            <div class="course-card" onclick="Router.go('courses/${course.id}')">
                <div class="course-thumbnail">
                    ${thumb}
                    <div class="course-level-badge">
                        <span class="badge ${levelColor}">${Fmt.level(course.level)}</span>
                    </div>
                    ${!course.is_published ? `<div style="position:absolute;top:.75rem;right:.75rem"><span class="badge badge-muted">Чернетка</span></div>` : ''}
                </div>
                <div class="course-body">
                    <h4 class="course-title">${course.title}</h4>
                    ${course.description ? `<p style="font-size:.8rem;color:var(--text-muted);margin-bottom:.75rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${course.description}</p>` : ''}
                    <div class="course-meta">
                        <span>👤 ${course.teacher?.full_name || 'Викладач'}</span>
                        ${course.duration_hours ? `<span>⏱ ${course.duration_hours}год</span>` : ''}
                    </div>
                    ${enrollment ? `
                        <div class="course-progress-section">
                            <div class="course-progress-label">
                                <span>${enrollment.completed_at ? '✅ Завершено' : 'Прогрес'}</span>
                                <span>${Fmt.pct(pct)}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill ${pct === 100 ? 'success' : ''}" style="width:${pct}%"></div>
                            </div>
                        </div>` : `<div style="margin-top:.75rem"><span class="badge badge-primary">Записатися</span></div>`}
                </div>
                ${AppState.isStaff() ? `
                    <div class="card-footer" onclick="event.stopPropagation()" style="display:flex;gap:.5rem">
                        <button class="btn btn-secondary btn-sm" onclick="CoursesPage.openEdit('${course.id}')">✏️ Редагувати</button>
                        <button class="btn btn-danger btn-sm" onclick="CoursesPage.deleteCourse('${course.id}','${course.title.replace(/'/g,"\\'")}')">🗑️</button>
                    </div>` : ''}
            </div>`;
    },

    _renderPagination(total) {
        const el    = document.getElementById('courses-pagination');
        const pages = Math.ceil(total / APP_CONFIG.pageSize);
        if (!el || pages <= 1) { if(el) el.innerHTML = ''; return; }
        el.innerHTML = Array.from({ length: pages }, (_, i) => `
            <button class="btn ${i === this._page ? 'btn-primary' : 'btn-ghost'} btn-sm"
                    onclick="CoursesPage._page=${i};CoursesPage.load()">${i + 1}</button>`).join('');
    },

    openCreate() { this._openForm(null); },

    async openEdit(id) {
        Loader.show();
        try { const course = await API.courses.getById(id); this._openForm(course); }
        finally { Loader.hide(); }
    },

    _openForm(course) {
        const isEdit = !!course;
        Modal.open({
            title: isEdit ? '✏️ Редагувати курс' : '+ Створити курс',
            size: 'lg',
            body: `
                <div class="form-row">
                    <div class="form-group">
                        <label>Назва курсу *</label>
                        <input id="c-title" type="text" placeholder="Введіть назву" value="${course?.title || ''}">
                    </div>
                    <div class="form-group">
                        <label>Рівень</label>
                        <select id="c-level">
                            <option value="beginner" ${course?.level === 'beginner' ? 'selected' : ''}>Початковий</option>
                            <option value="intermediate" ${course?.level === 'intermediate' ? 'selected' : ''}>Середній</option>
                            <option value="advanced" ${course?.level === 'advanced' ? 'selected' : ''}>Просунутий</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label>Опис</label>
                    <textarea id="c-desc" placeholder="Опис курсу">${course?.description || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Категорія</label>
                        <input id="c-category" type="text" placeholder="Наприклад: Програмування" value="${course?.category || ''}">
                    </div>
                    <div class="form-group">
                        <label>Тривалість (годин)</label>
                        <input id="c-duration" type="number" min="0" placeholder="0" value="${course?.duration_hours || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Обкладинка курсу</label>
                    <div id="thumb-upload-zone"></div>
                    ${course?.thumbnail_url ? `<img src="${course.thumbnail_url}" style="max-height:80px;margin-top:.5rem;border-radius:var(--radius-sm)">` : ''}
                </div>
                <div class="form-group">
                    <label class="checkbox-item" style="cursor:pointer;user-select:none">
                        <input type="checkbox" id="c-published" ${course?.is_published ? 'checked' : ''}>
                        <span>Опублікувати курс</span>
                    </label>
                    <label class="checkbox-item" style="cursor:pointer;user-select:none;margin-top:.5rem">
                        <input type="checkbox" id="c-featured" ${course?.is_featured ? 'checked' : ''}>
                        <span>Рекомендований курс</span>
                    </label>
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="CoursesPage.saveCourse('${course?.id || ''}')">
                    ${isEdit ? 'Зберегти' : 'Створити'}
                </button>`
        });

        this._thumbFile = null;
        const zone = document.getElementById('thumb-upload-zone');
        if (zone) {
            const input = FileUpload.createDropZone(zone, { accept: 'image/*', label: 'Завантажити обкладинку', hint: 'PNG, JPG до 5 МБ' });
            input.addEventListener('change', () => { this._thumbFile = input.files[0]; });
        }
    },

    async saveCourse(id) {
        const title = Dom.val('c-title').trim();
        if (!title) { Toast.error('Помилка', 'Вкажіть назву курсу'); return; }

        const fields = {
            title,
            description:   Dom.val('c-desc').trim() || null,
            level:         Dom.val('c-level'),
            category:      Dom.val('c-category').trim() || 'general',
            duration_hours: parseInt(Dom.val('c-duration')) || 0,
            is_published:  document.getElementById('c-published').checked,
            is_featured:   document.getElementById('c-featured').checked
        };

        Loader.show();
        try {
            let course = id ? await API.courses.update(id, fields) : await API.courses.create(fields);
            if (this._thumbFile) await API.courses.uploadThumbnail(course.id, this._thumbFile);
            Toast.success('Збережено!', `Курс "${title}" ${id ? 'оновлено' : 'створено'}`);
            Modal.close();
            await this.load();
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async deleteCourse(id, title) {
        const ok = await Modal.confirm({
            title: 'Видалити курс',
            message: `Ви впевнені, що хочете видалити курс "<strong>${title}</strong>"? Всі уроки та матеріали будуть видалені.`,
            confirmText: 'Видалити',
            danger: true
        });
        if (!ok) return;
        Loader.show();
        try {
            await API.courses.delete(id);
            Toast.success('Видалено', `Курс "${title}" видалено`);
            await this.load();
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    }
};
