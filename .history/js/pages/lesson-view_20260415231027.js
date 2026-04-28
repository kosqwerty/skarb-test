// ================================================================
// EduFlow LMS — Перегляд уроку
// ================================================================

const LessonViewPage = {
    _lesson: null,

    async init(container, params) {
        const lessonId = params.id;
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        try {
            const lesson = await API.lessons.getById(lessonId);
            this._lesson = lesson;

            UI.setBreadcrumb([
                { label: 'Курси', route: 'courses' },
                { label: lesson.course?.title || 'Курс', route: `courses/${lesson.course?.id}` },
                { label: lesson.title }
            ]);

            const enrolled = await API.enrollments.isEnrolled(lesson.course_id);
            if (!enrolled && !lesson.is_free_preview && !AppState.isStaff()) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🔒</div>
                        <h3>Немає доступу</h3>
                        <p>Запишіться на курс для доступу до цього уроку</p>
                        <button class="btn btn-primary" onclick="Router.go('courses/${lesson.course_id}')">До курсу</button>
                    </div>`;
                return;
            }

            const progress   = await API.progress.getByLesson(lessonId).catch(() => null);
            lesson.resources?.sort((a,b) => a.order_index - b.order_index);

            const allLessons = await API.lessons.getByCourse(lesson.course_id).catch(() => []);
            const published  = allLessons.filter(l => l.is_published || AppState.isStaff());
            const idx        = published.findIndex(l => l.id === lessonId);

            this._render(container, lesson, progress, published, idx, enrolled);
        } catch(e) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
        }
    },

    _render(container, lesson, progress, allLessons, idx, enrolled) {
        const prevLesson = allLessons[idx - 1];
        const nextLesson = allLessons[idx + 1];
        const completed  = progress?.completed;

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 280px;gap:2rem;align-items:start" class="lesson-layout">
                <div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:.75rem">
                        <button class="btn btn-ghost btn-sm" onclick="Router.go('courses/${lesson.course_id}')">← Назад до курсу</button>
                        <div style="display:flex;gap:.5rem">
                            ${prevLesson ? `<button class="btn btn-secondary btn-sm" onclick="Router.go('lessons/${prevLesson.id}')">← Попередній</button>` : ''}
                            ${nextLesson ? `<button class="btn btn-secondary btn-sm" onclick="Router.go('lessons/${nextLesson.id}')">Наступний →</button>` : ''}
                        </div>
                    </div>

                    <div class="card" style="margin-bottom:1.5rem">
                        <div class="card-header">
                            <div>
                                <span class="text-muted text-sm">Урок ${idx + 1} з ${allLessons.length}</span>
                                <h2>${lesson.title}</h2>
                            </div>
                            ${AppState.isStaff() ? `
                                <div style="display:flex;gap:.5rem">
                                    <button class="btn btn-ghost btn-sm" onclick="CourseViewPage.openEditLesson('${lesson.id}')">✏️</button>
                                    <button class="btn btn-secondary btn-sm" onclick="LessonViewPage.openAddResource('${lesson.id}')">+ Матеріал</button>
                                </div>` : ''}
                        </div>
                        ${lesson.description ? `<div class="card-body" style="border-bottom:1px solid var(--border);padding-bottom:1rem;color:var(--text-secondary)">${lesson.description}</div>` : ''}
                        ${lesson.content    ? `<div class="card-body" style="line-height:1.8">${lesson.content}</div>` : ''}
                    </div>

                    <div id="resources-section">
                        ${this._renderResources(lesson.resources || [], lesson.id)}
                    </div>

                    <div id="viewer-container" style="margin-top:1.5rem"></div>

                    ${enrolled || AppState.isStaff() ? `
                        <div style="margin-top:2rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem">
                            <div>
                                ${completed
                                    ? '<span style="color:var(--success);font-weight:600">✅ Урок завершено</span>'
                                    : '<span style="color:var(--text-muted)">Відмітьте урок як завершений</span>'}
                            </div>
                            <div style="display:flex;gap:.75rem">
                                ${prevLesson ? `<button class="btn btn-secondary" onclick="Router.go('lessons/${prevLesson.id}')">← Попередній</button>` : ''}
                                ${!completed ? `
                                    <button class="btn btn-success" id="complete-btn" onclick="LessonViewPage.markComplete('${lesson.id}','${lesson.course_id}')">
                                        ✓ Відмітити як завершений
                                    </button>` : ''}
                                ${nextLesson ? `<button class="btn btn-primary" onclick="Router.go('lessons/${nextLesson.id}')">Наступний урок →</button>` : ''}
                                ${!nextLesson && completed ? `<button class="btn btn-primary" onclick="Router.go('courses/${lesson.course_id}')">До курсу →</button>` : ''}
                            </div>
                        </div>` : ''}
                </div>

                <div style="position:sticky;top:80px">
                    <div class="card">
                        <div class="card-header"><h4>📋 Уроки курсу</h4></div>
                        <div style="max-height:600px;overflow-y:auto">
                            ${allLessons.map((l, i) => `
                                <div onclick="Router.go('lessons/${l.id}')"
                                     style="display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;cursor:pointer;border-bottom:1px solid var(--border);transition:background var(--transition);
                                            ${l.id === lesson.id ? 'background:var(--primary-glow);border-left:3px solid var(--primary)' : ''}">
                                    <div style="width:24px;height:24px;border-radius:50%;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-size:.7rem;flex-shrink:0;font-weight:600">${i+1}</div>
                                    <span style="font-size:.8rem;${l.id === lesson.id ? 'color:var(--primary);font-weight:600' : 'color:var(--text-secondary)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.title}</span>
                                </div>`).join('')}
                        </div>
                    </div>
                </div>
            </div>`;
    },

    _renderResources(resources, lessonId) {
        if (!resources.length) {
            return AppState.isStaff()
                ? `<div class="empty-state" style="padding:1.5rem">
                       <p style="color:var(--text-muted)">Немає матеріалів. Додайте PDF, відео, SCORM або посилання.</p>
                       <button class="btn btn-primary btn-sm" onclick="LessonViewPage.openAddResource('${lessonId}')">+ Додати матеріал</button>
                   </div>` : '';
        }
        const typeIcons = { pdf:'📄', video:'🎬', scorm:'🎯', link:'🔗', file:'📁' };
        return `
            <h3 style="margin-bottom:1rem">📎 Матеріали уроку</h3>
            <div class="resource-list">
                ${resources.map(r => `
                    <div class="resource-item" onclick="LessonViewPage.openResource(${JSON.stringify({ id:r.id, type:r.type, title:r.title, url:r.url, storage_path:r.storage_path, scorm_packages:r.scorm_packages }).replace(/"/g,'&quot;')})">
                        <div class="resource-icon ${r.type}">${typeIcons[r.type] || '📄'}</div>
                        <div class="resource-info">
                            <div class="resource-title">${r.title}</div>
                            <div class="resource-meta">${r.type.toUpperCase()} ${r.file_size ? '• ' + Fmt.fileSize(r.file_size) : ''}</div>
                        </div>
                        <button class="btn btn-ghost btn-sm" style="flex-shrink:0">▶ Відкрити</button>
                        ${AppState.isStaff() ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();LessonViewPage.deleteResource('${r.id}')" style="flex-shrink:0">🗑</button>` : ''}
                    </div>`).join('')}
            </div>`;
    },

    async openResource(resource) {
        const viewer = document.getElementById('viewer-container');
        if (!viewer) return;
        viewer.innerHTML = `<div style="display:flex;justify-content:center;padding:2rem"><div class="spinner"></div></div>`;
        try {
            switch (resource.type) {
                case 'pdf':   await this._openPDF(viewer, resource);   break;
                case 'video':       this._openVideo(viewer, resource); break;
                case 'scorm':
                    viewer.innerHTML = '';
                    await ScormPlayer.open(resource.id, resource.title);
                    break;
                case 'link':
                    viewer.innerHTML = `
                        <div class="card"><div class="card-body" style="text-align:center">
                            <div style="font-size:3rem;margin-bottom:1rem">🔗</div>
                            <h3>${resource.title}</h3>
                            <a href="${resource.url}" target="_blank" rel="noopener" class="btn btn-primary" style="margin-top:1rem">Відкрити посилання ↗</a>
                        </div></div>`;
                    break;
                default:      await this._openFile(viewer, resource);
            }
        } catch(e) {
            viewer.innerHTML = `<div class="card"><div class="card-body"><p style="color:var(--danger)">Помилка завантаження: ${e.message}</p></div></div>`;
        }
    },

    async _openPDF(viewer, resource) {
        let url = resource.url;
        if (!url && resource.storage_path) url = await API.resources.getSignedUrl(resource.storage_path);
        const viewerUrl = this._pdfViewerUrl(url);
        viewer.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3>📄 ${resource.title}</h3>
                    <a href="${url}" target="_blank" class="btn btn-ghost btn-sm">Завантажити ↓</a>
                </div>
                <div class="card-body" style="padding:0">
                    <iframe src="${viewerUrl}" style="width:100%;height:700px;border:none" title="${resource.title}"></iframe>
                </div>
            </div>`;
    },

    async _openVideo(viewer, resource) {
        let url = resource.url;
        if (!url && resource.storage_path) url = await API.resources.getSignedUrl(resource.storage_path);

        if (url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com'))) {
            let embedUrl = url;
            if (url.includes('youtube.com/watch?v=')) embedUrl = url.replace('watch?v=', 'embed/');
            if (url.includes('youtu.be/'))            embedUrl = 'https://www.youtube.com/embed/' + url.split('/').pop();
            if (url.includes('vimeo.com/'))           embedUrl = 'https://player.vimeo.com/video/' + url.split('/').pop();
            viewer.innerHTML = `
                <div class="card">
                    <div class="card-header"><h3>🎬 ${resource.title}</h3></div>
                    <div class="card-body" style="padding:0">
                        <div style="position:relative;padding-top:56.25%">
                            <iframe src="${embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none"
                                    allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope" allowfullscreen></iframe>
                        </div>
                    </div>
                </div>`;
        } else {
            viewer.innerHTML = `
                <div class="card">
                    <div class="card-header"><h3>🎬 ${resource.title}</h3></div>
                    <div class="card-body" style="padding:0">
                        <video controls style="width:100%;max-height:600px;background:#000" preload="metadata">
                            <source src="${url}">
                            Ваш браузер не підтримує відео.
                        </video>
                    </div>
                </div>`;
        }
    },

    async _openFile(viewer, resource) {
        let url = resource.url;
        if (!url && resource.storage_path) url = await API.resources.getSignedUrl(resource.storage_path);
        viewer.innerHTML = `
            <div class="card"><div class="card-body" style="text-align:center;padding:2rem">
                <div style="font-size:3rem;margin-bottom:1rem">📁</div>
                <h3>${resource.title}</h3>
                <p style="color:var(--text-muted);margin:.5rem 0 1.5rem">${Fmt.fileSize(resource.file_size)}</p>
                <a href="${url}" download="${resource.title}" class="btn btn-primary">⬇ Завантажити файл</a>
            </div></div>`;    },

    _pdfViewerUrl(url) {
        return `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;    },

    openAddResource(lessonId) {
        Modal.open({
            title: '+ Додати матеріал',
            size: 'lg',
            body: `
                <div class="form-group">
                    <label>Тип матеріалу</label>
                    <select id="res-type" onchange="LessonViewPage.onResourceTypeChange()">
                        <option value="pdf">📄 PDF документ</option>
                        <option value="video">🎬 Відео</option>
                        <option value="scorm">🎯 SCORM пакет</option>
                        <option value="link">🔗 Посилання</option>
                        <option value="file">📁 Файл</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Назва *</label>
                    <input id="res-title" type="text" placeholder="Назва матеріалу">
                </div>
                <div id="res-url-group" class="form-group hidden">
                    <label>URL / Посилання</label>
                    <input id="res-url" type="url" placeholder="https://...">
                </div>
                <div id="res-file-group" class="form-group">
                    <label>Файл</label>
                    <div id="res-file-zone"></div>
                </div>
                <input type="hidden" id="res-lesson-id" value="${lessonId}">`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="LessonViewPage.saveResource()">Додати</button>`
        });

        this._resFile = null;
        const zone = document.getElementById('res-file-zone');
        if (zone) {
            const input = FileUpload.createDropZone(zone, { label: 'Завантажити файл', hint: 'Максимум 500 МБ' });
            input.addEventListener('change', () => { this._resFile = input.files[0]; });
        }
    },

    onResourceTypeChange() {
        const type    = Dom.val('res-type');
        const urlGrp  = document.getElementById('res-url-group');
        const fileGrp = document.getElementById('res-file-group');
        urlGrp.classList.toggle('hidden', type !== 'link' && type !== 'video');
        fileGrp.style.display = type === 'link' ? 'none' : '';
    },

    async saveResource() {
        const type     = Dom.val('res-type');
        const title    = Dom.val('res-title').trim();
        const url      = Dom.val('res-url').trim();
        const lessonId = Dom.val('res-lesson-id');
        if (!title) { Toast.error('Помилка', 'Вкажіть назву'); return; }

        Loader.show();
        Modal.close();
        try {
            if (type === 'scorm' && this._resFile) {
                await ScormUpload.upload(lessonId, this._resFile);
            } else if (this._resFile) {
                await API.resources.uploadFile(lessonId, this._resFile, type);
            } else if (url) {
                await API.resources.create({ lesson_id: lessonId, title, type, url });
            } else {
                Toast.error('Помилка', 'Вкажіть файл або посилання'); return;
            }
            Toast.success('Додано!', `Матеріал "${title}" додано`);
            Router.go('lessons/' + lessonId);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async deleteResource(id) {
        const ok = await Modal.confirm({ title: 'Видалити матеріал', message: 'Видалити цей матеріал?', confirmText: 'Видалити', danger: true });
        if (!ok) return;
        Loader.show();
        try {
            await API.resources.delete(id);
            Toast.success('Видалено');
            Router.go('lessons/' + this._lesson?.id);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async markComplete(lessonId, courseId) {
        const btn = document.getElementById('complete-btn');
        if (btn) { btn.disabled = true; btn.textContent = '...'; }
        try {
            await API.progress.markComplete(lessonId, courseId);
            Toast.success('Урок завершено!', 'Прогрес збережено');
            Router.go('lessons/' + lessonId);
        } catch(e) {
            Toast.error('Помилка', e.message);
            if (btn) { btn.disabled = false; btn.textContent = '✓ Відмітити як завершений'; }
        }
    }
};
