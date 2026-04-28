// ================================================================
// EduFlow LMS — Сторінка перегляду курсу
// ================================================================

const CourseViewPage = {
    _course: null,
    _enrolled: false,

    async init(container, params) {
        const courseId = params.id;
        UI.setBreadcrumb([{ label: 'Курси', route: 'courses' }, { label: 'Завантаження...' }]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        try {
            const [course, enrolled] = await Promise.all([
                API.courses.getById(courseId),
                API.enrollments.isEnrolled(courseId)
            ]);
            this._course   = course;
            this._enrolled = enrolled;
            UI.setBreadcrumb([{ label: 'Курси', route: 'courses' }, { label: course.title }]);
            course.lessons?.sort((a,b) => a.order_index - b.order_index);

            let progressMap = {};
            if (enrolled) {
                const progress = await API.progress.getForCourse(courseId).catch(() => []);
                progressMap    = Object.fromEntries(progress.map(p => [p.lesson_id, p]));
            }
            this._render(container, course, enrolled, progressMap);
        } catch(e) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <h3>Курс не знайдено</h3>
                    <button class="btn btn-primary" onclick="Router.go('courses')">← Назад до курсів</button>
                </div>`;
        }
    },

    _render(container, course, enrolled, progressMap) {
        const publishedLessons = course.lessons?.filter(l => l.is_published || AppState.isStaff()) || [];
        const completedCount   = Object.values(progressMap).filter(p => p.completed).length;
        const totalPublished   = publishedLessons.length;
        const pct = totalPublished ? Math.round(completedCount / totalPublished * 100) : 0;

        const thumb = course.thumbnail_url
            ? `<img src="${course.thumbnail_url}" style="width:100%;height:250px;object-fit:cover;border-radius:var(--radius-lg)">`
            : `<div style="height:250px;background:linear-gradient(135deg,var(--primary-glow),rgba(139,92,246,.2));border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;font-size:4rem">📖</div>`;

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 340px;gap:2rem;align-items:start" class="course-layout">
                <div>
                    <div class="page-header" style="margin-bottom:1.5rem">
                        <div class="page-title">
                            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem">
                                <span class="badge ${{ beginner:'badge-success',intermediate:'badge-warning',advanced:'badge-danger' }[course.level] || 'badge-muted'}">${Fmt.level(course.level)}</span>
                                ${!course.is_published ? '<span class="badge badge-muted">Чернетка</span>' : ''}
                            </div>
                            <h1>${course.title}</h1>
                            ${course.description ? `<p style="color:var(--text-secondary);margin-top:.5rem">${course.description}</p>` : ''}
                        </div>
                        ${AppState.isStaff() ? `
                            <div class="page-actions">
                                <button class="btn btn-secondary" onclick="CourseViewPage.openAddLesson()">+ Урок</button>
                                <button class="btn btn-secondary" onclick="CourseViewPage.openAddTest()">+ Тест</button>
                                <button class="btn btn-ghost" onclick="Router.go('analytics?course=${course.id}')">📊 Аналітика</button>
                            </div>` : ''}
                    </div>

                    <div class="card" style="margin-bottom:1.5rem">
                        <div class="card-body" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:1rem">
                            ${[
                                { icon:'👤', label:'Викладач',   value: course.teacher?.full_name || '—' },
                                { icon:'📋', label:'Уроків',     value: totalPublished },
                                { icon:'⏱', label:'Тривалість',  value: course.duration_hours ? course.duration_hours + ' год' : '—' },
                                ...(enrolled ? [{ icon:'📊', label:'Прогрес', value: pct + '%' }] : [])
                            ].map(s => `
                                <div style="text-align:center">
                                    <div style="font-size:1.5rem;margin-bottom:.25rem">${s.icon}</div>
                                    <div style="font-size:.75rem;color:var(--text-muted)">${s.label}</div>
                                    <div style="font-weight:600;font-size:.875rem">${s.value}</div>
                                </div>`).join('')}
                        </div>
                    </div>

                    ${enrolled ? `
                        <div class="card" style="margin-bottom:1.5rem">
                            <div class="card-body" style="padding:1rem 1.5rem">
                                <div style="display:flex;justify-content:space-between;margin-bottom:.5rem">
                                    <span style="font-weight:500">Загальний прогрес</span>
                                    <span style="font-weight:700;color:var(--primary)">${pct}%</span>
                                </div>
                                <div class="progress-bar" style="height:8px">
                                    <div class="progress-fill ${pct===100?'success':''}" style="width:${pct}%"></div>
                                </div>
                                <div style="font-size:.78rem;color:var(--text-muted);margin-top:.5rem">
                                    ${completedCount} з ${totalPublished} уроків завершено
                                </div>
                            </div>
                        </div>` : ''}

                    <h3 style="margin-bottom:1rem">📋 Уроки курсу</h3>
                    <div id="lessons-list" class="lesson-list">
                        ${this._renderLessons(publishedLessons, progressMap, enrolled)}
                    </div>
                    <div id="tests-section" style="margin-top:2rem"></div>
                </div>

                <div class="course-sidebar" style="position:sticky;top:80px">
                    ${thumb}
                    <div class="card" style="margin-top:1rem">
                        <div class="card-body">
                            ${enrolled ? this._renderEnrolledActions(course, pct) : this._renderEnrollAction(course)}
                        </div>
                    </div>
                    ${AppState.isStaff() ? this._renderManageCard(course) : ''}
                </div>
            </div>`;

        this._loadTests(course.id, enrolled);
    },

    _renderLessons(lessons, progressMap, enrolled) {
        if (!lessons.length) return `<div class="empty-state" style="padding:2rem"><div class="empty-icon">📋</div><h3>Уроків поки немає</h3></div>`;

        return lessons.map((lesson, i) => {
            const prog      = progressMap[lesson.id];
            const completed = prog?.completed;
            const canOpen   = enrolled || lesson.is_free_preview || AppState.isStaff();
            return `
                <div class="lesson-item ${completed ? 'completed' : ''}"
                     ${canOpen ? `onclick="Router.go('lessons/${lesson.id}')"` : ''}>
                    <div class="lesson-num">${completed ? '✓' : i + 1}</div>
                    <div class="lesson-info">
                        <div class="lesson-title">${lesson.title}</div>
                        ${lesson.description ? `<div class="lesson-meta-row">${lesson.description.slice(0,80)}</div>` : ''}
                        <div class="lesson-meta-row">
                            ${lesson.resources?.length ? `📎 ${lesson.resources.length} матеріал(ів)` : ''}
                            ${lesson.is_free_preview ? `<span class="badge badge-info" style="margin-left:.5rem;font-size:.65rem">Безкоштовний перегляд</span>` : ''}
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:.5rem;flex-shrink:0">
                        ${lesson.duration_minutes ? `<span class="lesson-duration">⏱ ${Fmt.duration(lesson.duration_minutes)}</span>` : ''}
                        ${!canOpen ? '<span style="color:var(--text-muted)">🔒</span>' : ''}
                        ${AppState.isStaff() ? `
                            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();CourseViewPage.openEditLesson('${lesson.id}')">✏️</button>
                            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();CourseViewPage.deleteLesson('${lesson.id}','${lesson.title.replace(/'/g,"\\'")}')">🗑</button>
                        ` : ''}
                    </div>
                </div>`;
        }).join('');
    },

    _renderEnrollAction(course) {
        return `
            <h3 style="margin-bottom:.75rem">Записатися на курс</h3>
            <p style="color:var(--text-muted);font-size:.875rem;margin-bottom:1.25rem">
                Отримайте доступ до всіх уроків та матеріалів курсу
            </p>
            <button class="btn btn-primary btn-full" onclick="CourseViewPage.enroll('${course.id}')">
                🎓 Записатися безкоштовно
            </button>`;
    },

    _renderEnrolledActions(course, pct) {
        const lesson = this._course?.lessons?.find(l => l.is_published);
        return `
            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:1rem">
                <span style="color:var(--success)">✓</span>
                <span style="font-weight:600">Ви записані на курс</span>
            </div>
            ${lesson ? `<button class="btn btn-primary btn-full" onclick="Router.go('lessons/${lesson.id}')">
                ${pct > 0 ? '▶ Продовжити навчання' : '▶ Розпочати навчання'}
            </button>` : ''}`;
    },

    _renderManageCard(course) {
        return `
            <div class="card" style="margin-top:1rem">
                <div class="card-header"><h4>Управління</h4></div>
                <div class="card-body" style="display:flex;flex-direction:column;gap:.5rem">
                    <button class="btn btn-secondary" onclick="CourseViewPage.openAddLesson()">+ Додати урок</button>
                    <button class="btn btn-secondary" onclick="CourseViewPage.openAddTest()">+ Додати тест</button>
                    <button class="btn btn-secondary" onclick="Router.go('analytics?course=${course.id}')">📊 Аналітика курсу</button>
                    <button class="btn btn-secondary" onclick="CourseViewPage.manageEnrollments('${course.id}')">👥 Стажери</button>
                    <button class="btn btn-ghost" onclick="CoursesPage.openEdit('${course.id}')">⚙️ Налаштування</button>
                </div>
            </div>`;
    },

    async _loadTests(courseId, enrolled) {
        const el = document.getElementById('tests-section');
        if (!el) return;
        try {
            const tests   = await API.tests.getByCourse(courseId);
            const visible = tests.filter(t => t.is_published || AppState.isStaff());
            if (!visible.length) { el.innerHTML = ''; return; }
            el.innerHTML = `
                <h3 style="margin-bottom:1rem">📝 Тести</h3>
                <div class="lesson-list">
                    ${visible.map(t => `
                        <div class="lesson-item" ${enrolled || AppState.isStaff() ? `onclick="Router.go('tests/${t.id}')"` : ''}>
                            <div class="lesson-num">📝</div>
                            <div class="lesson-info">
                                <div class="lesson-title">${t.title}</div>
                                <div class="lesson-meta-row">
                                    ${t.max_attempts ? `${t.max_attempts} спроб` : 'Безліміт'}
                                    ${t.time_limit_minutes ? ` • ${t.time_limit_minutes} хв` : ''}
                                    ${t.passing_score ? ` • Поріг: ${t.passing_score}%` : ''}
                                </div>
                            </div>
                            <div style="display:flex;gap:.5rem">
                                ${!t.is_published ? '<span class="badge badge-muted">Чернетка</span>' : ''}
                                ${AppState.isStaff() ? `
                                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();TestsPage.openEdit('${t.id}')">✏️</button>
                                    <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();TestsPage.deleteTest('${t.id}','${t.title.replace(/'/g,"\\'")}')">🗑</button>
                                ` : ''}
                            </div>
                        </div>`).join('')}
                </div>`;
        } catch(e) { el.innerHTML = ''; }
    },

    async enroll(courseId) {
        Loader.show();
        try {
            await API.enrollments.enroll(courseId);
            Toast.success('Записано!', 'Ви успішно записалися на курс');
            Router.go('courses/' + courseId);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    openAddLesson()  { this._openLessonForm(null); },

    async openEditLesson(id) {
        Loader.show();
        try { const lesson = await API.lessons.getById(id); this._openLessonForm(lesson); }
        finally { Loader.hide(); }
    },

    _openLessonForm(lesson) {
        Modal.open({
            title: lesson ? '✏️ Редагувати урок' : '+ Додати урок',
            size: 'lg',
            body: `
                <div class="form-group">
                    <label>Назва уроку *</label>
                    <input id="l-title" type="text" value="${lesson?.title || ''}" placeholder="Введіть назву уроку">
                </div>
                <div class="form-group">
                    <label>Опис</label>
                    <textarea id="l-desc" placeholder="Короткий опис уроку">${lesson?.description || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Порядок (індекс)</label>
                        <input id="l-order" type="number" min="0" value="${lesson?.order_index ?? 0}">
                    </div>
                    <div class="form-group">
                        <label>Тривалість (хв)</label>
                        <input id="l-duration" type="number" min="0" value="${lesson?.duration_minutes || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="checkbox-item" style="cursor:pointer">
                        <input type="checkbox" id="l-published" ${lesson?.is_published ? 'checked' : ''}>
                        <span>Опублікувати урок</span>
                    </label>
                    <label class="checkbox-item" style="cursor:pointer;margin-top:.5rem">
                        <input type="checkbox" id="l-free" ${lesson?.is_free_preview ? 'checked' : ''}>
                        <span>Безкоштовний перегляд</span>
                    </label>
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="CourseViewPage.saveLesson('${lesson?.id || ''}','${this._course.id}')">Зберегти</button>`
        });
    },

    async saveLesson(lessonId, courseId) {
        const title = Dom.val('l-title').trim();
        if (!title) { Toast.error('Помилка', 'Вкажіть назву уроку'); return; }
        const fields = {
            course_id: courseId, title,
            description:      Dom.val('l-desc').trim() || null,
            order_index:      parseInt(Dom.val('l-order')) || 0,
            duration_minutes: parseInt(Dom.val('l-duration')) || 0,
            is_published:     document.getElementById('l-published').checked,
            is_free_preview:  document.getElementById('l-free').checked
        };
        Loader.show();
        try {
            if (lessonId) await API.lessons.update(lessonId, fields);
            else          await API.lessons.create(fields);
            Toast.success('Збережено!');
            Modal.close();
            Router.go('courses/' + courseId);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async deleteLesson(id, title) {
        const ok = await Modal.confirm({ title: 'Видалити урок', message: `Видалити урок "${title}"?`, confirmText: 'Видалити', danger: true });
        if (!ok) return;
        Loader.show();
        try {
            await API.lessons.delete(id);
            Toast.success('Урок видалено');
            Router.go('courses/' + this._course.id);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    openAddTest() { TestsPage._openTestForm(null, this._course.id); },

    async manageEnrollments(courseId) {
        Loader.show();
        try {
            const enrollments = await API.enrollments.getCourseEnrollments(courseId);
            Modal.open({
                title: '👥 Стажери курсу',
                size: 'lg',
                body: `
                    <div class="table-wrapper">
                        <table>
                            <thead><tr><th>Стажер</th><th>Email</th><th>Прогрес</th><th>Записаний</th><th>Завершив</th></tr></thead>
                            <tbody>
                                ${enrollments.length ? enrollments.map(e => `
                                    <tr>
                                        <td><strong>${e.user?.full_name || '—'}</strong></td>
                                        <td style="color:var(--text-muted)">${e.user?.email || '—'}</td>
                                        <td>
                                            <div style="display:flex;align-items:center;gap:.5rem;min-width:100px">
                                                <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${e.progress_percentage||0}%"></div></div>
                                                <span style="font-size:.75rem">${e.progress_percentage||0}%</span>
                                            </div>
                                        </td>
                                        <td style="color:var(--text-muted);font-size:.8rem">${Fmt.dateShort(e.enrolled_at)}</td>
                                        <td>${e.completed_at ? `<span class="badge badge-success">✓</span>` : '—'}</td>
                                    </tr>`).join('')
                                : '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">Немає стажерів</td></tr>'}
                            </tbody>
                        </table>
                    </div>`,
                footer: `
                    <button class="btn btn-success" onclick="Excel.export(${JSON.stringify(enrollments.map(e => ({
                        'ПІБ': e.user?.full_name, 'Email': e.user?.email,
                        'Прогрес': (e.progress_percentage||0)+'%',
                        'Записаний': Fmt.datetime(e.enrolled_at),
                        'Завершив': e.completed_at ? Fmt.datetime(e.completed_at) : 'Ні'
                    }))).replace(/"/g,"'")}, 'students_course')">📊 Експорт Excel</button>
                    <button class="btn btn-secondary" onclick="Modal.close()">Закрити</button>`
            });
        } finally { Loader.hide(); }
    }
};
