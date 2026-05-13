// ================================================================
// EduFlow LMS — Сторінка перегляду курсу
// ================================================================

const CourseViewPage = {
    _course: null,
    _enrolled: false,
    _from: null,

    async init(container, params) {
        const courseId = params.id;
        this._from = params.from || null;
        const fromExpert = this._from === 'expert-path';
        const backLabel = fromExpert ? 'Skill Up' : 'Курси';
        const backRoute = fromExpert ? 'expert-path' : 'courses';
        UI.setBreadcrumb([{ label: backLabel, route: backRoute }, { label: 'Завантаження...' }]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        try {
            const [course, enrolled, courseTeachers] = await Promise.all([
                API.courses.getById(courseId),
                API.enrollments.isEnrolled(courseId),
                API.courseTeachers.getByCourse(courseId).catch(() => [])
            ]);
            this._course        = course;
            this._enrolled      = enrolled;
            this._courseTeachers = courseTeachers;
            UI.setBreadcrumb([{ label: backLabel, route: backRoute }, { label: course.title }]);
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
                    <button class="btn btn-primary" onclick="Router.go('${fromExpert ? 'expert-path' : 'courses'}')" style="display:inline-flex;align-items:center;gap:.35rem"><i class="fa-solid fa-angle-left"></i> Назад</button>
                </div>`;
        }
    },

    _render(container, course, enrolled, progressMap) {
        const publishedLessons = course.lessons?.filter(l => l.is_published || AppState.isStaff()) || [];
        const completedCount   = Object.values(progressMap).filter(p => p.completed).length;
        const totalPublished   = publishedLessons.length;
        const pct = totalPublished ? Math.round(completedCount / totalPublished * 100) : 0;
        const levelColors = { beginner:'#10b981', intermediate:'#f59e0b', advanced:'#ef4444' };
        const levelColor  = levelColors[course.level] || '#6366f1';

        const heroThumb = course.thumbnail_url
            ? `<div class="cv-hero-thumb" style="background-image:url('${course.thumbnail_url}')"></div>`
            : `<div class="cv-hero-thumb cv-hero-thumb-default"><i class="fa-solid fa-graduation-cap"></i></div>`;

        container.innerHTML = `
        <style>
            .cv-hero{position:relative;border-radius:var(--radius-lg);overflow:hidden;margin-bottom:2rem;background:linear-gradient(135deg,#0f0c29,#302b63,#24243e)}
            .cv-hero-thumb{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.35;filter:blur(2px) saturate(1.4);pointer-events:none}
            .cv-hero-thumb-default{display:flex;align-items:center;justify-content:center;font-size:6rem;opacity:.08;color:#fff;filter:none}
            .cv-hero-inner{position:relative;z-index:1;padding:2.5rem 2rem 2rem}
            .cv-hero-badges{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}
            .cv-level-badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;font-weight:700;padding:.25rem .7rem;border-radius:999px;letter-spacing:.04em;text-transform:uppercase}
            .cv-hero-title{font-size:2rem;font-weight:800;color:#fff;line-height:1.2;margin-bottom:.65rem;text-shadow:0 2px 12px rgba(0,0,0,.4)}
            .cv-hero-desc{color:rgba(255,255,255,.72);font-size:.95rem;line-height:1.6;max-width:640px;margin-bottom:1.5rem}
            .cv-hero-actions{display:flex;gap:.75rem;flex-wrap:wrap;align-items:center}
            .cv-hero-stats{display:flex;gap:1.5rem;margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.12);flex-wrap:wrap}
            .cv-hero-stat{display:flex;align-items:center;gap:.5rem;color:rgba(255,255,255,.8);font-size:.85rem}
            .cv-hero-stat i{color:rgba(255,255,255,.5);font-size:.9rem}
            .cv-staff-bar{display:flex;gap:.5rem;flex-wrap:wrap;padding:.75rem 1rem;background:rgba(0,0,0,.35);backdrop-filter:blur(8px);border-bottom:1px solid rgba(255,255,255,.1);border-radius:var(--radius-lg) var(--radius-lg) 0 0}
            .cv-staff-bar .btn{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);color:#fff}
            .cv-staff-bar .btn:hover{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.4);color:#fff}
            .cv-progress-wrap{background:var(--bg-surface);border-radius:var(--radius-lg);padding:1.25rem 1.5rem;margin-bottom:1.5rem;border:1px solid var(--border)}
            .cv-progress-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem}
            .cv-progress-pct{font-size:1.75rem;font-weight:800;background:linear-gradient(135deg,var(--primary),#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1}
            .cv-progress-bar{height:10px;border-radius:999px;background:var(--bg-raised);overflow:hidden;margin-bottom:.5rem}
            .cv-progress-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--primary),#8b5cf6);transition:width .6s ease}
            .cv-progress-fill.done{background:linear-gradient(90deg,#10b981,#0ea5e9)}
            .cv-section-head{display:flex;align-items:center;gap:.6rem;margin-bottom:1.1rem;margin-top:2rem}
            .cv-section-icon{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--primary),#8b5cf6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.85rem;flex-shrink:0}
            .cv-section-title{font-size:1rem;font-weight:700}
            .cv-lesson{display:flex;align-items:center;gap:1rem;padding:.9rem 1.1rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:.5rem;transition:border-color .15s,box-shadow .15s,transform .15s;cursor:pointer}
            .cv-lesson:hover{border-color:var(--primary);background:rgba(99,102,241,.04)}
            .cv-lesson.done{border-color:rgba(16,185,129,.3);background:rgba(16,185,129,.04)}
            .cv-lesson.locked{cursor:default;opacity:.6}
            .cv-lesson.locked:hover{border-color:var(--border);background:var(--bg-surface)}
            .cv-lesson-num{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.82rem;flex-shrink:0}
            .cv-lesson.done .cv-lesson-num{background:linear-gradient(135deg,#10b981,#0ea5e9)}
            .cv-lesson.locked .cv-lesson-num{background:var(--bg-raised);color:var(--text-muted)}
            .cv-lesson-title{font-weight:600;font-size:.9rem;margin-bottom:.15rem}
            .cv-lesson-meta{font-size:.75rem;color:var(--text-muted);display:flex;gap:.75rem;flex-wrap:wrap}
            .cv-sidebar-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;position:sticky;top:80px}
            .cv-sidebar-thumb{width:100%;height:200px;object-fit:cover;display:block}
            .cv-sidebar-thumb-def{height:200px;background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.25));display:flex;align-items:center;justify-content:center;font-size:3.5rem}
            .cv-sidebar-body{padding:1.25rem}
            .cv-enroll-btn{width:100%;padding:.85rem;border-radius:var(--radius-md);border:none;background:linear-gradient(135deg,var(--primary),#8b5cf6);color:#fff;font-size:1rem;font-weight:700;cursor:pointer;transition:opacity .15s,transform .15s;display:flex;align-items:center;justify-content:center;gap:.5rem}
            .cv-enroll-btn:hover{opacity:.9;transform:translateY(-1px)}
            .cv-manage-btn{display:flex;align-items:center;gap:.6rem;padding:.6rem .9rem;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-raised);color:var(--text-secondary);font-size:.84rem;cursor:pointer;transition:all .15s;width:100%}
            .cv-manage-btn:hover{border-color:var(--primary);color:var(--primary);background:rgba(99,102,241,.06)}
            .cv-manage-btn i{width:16px;text-align:center;color:var(--primary)}
        </style>

        <div class="cv-hero">
            ${heroThumb}
            ${AppState.isStaff() ? `
            <div class="cv-staff-bar">
                <button class="btn btn-ghost btn-sm" onclick="Router.go('analytics?course=${course.id}')"><i class="fa-solid fa-chart-bar"></i> Аналітика</button>
                <button class="btn btn-ghost btn-sm" onclick="CourseViewPage.manageEnrollments('${course.id}')"><i class="fa-solid fa-users"></i> Стажери</button>
                <button class="btn btn-ghost btn-sm" onclick="Router.go('admin?tab=courses&edit=${course.id}')"><i class="fa-solid fa-gear"></i> Налаштування</button>
            </div>` : ''}
            <div class="cv-hero-inner">
                <div class="cv-hero-badges">
                    <span class="cv-level-badge" style="background:${levelColor}22;color:${levelColor};border:1px solid ${levelColor}44">
                        <i class="fa-solid fa-signal"></i> ${Fmt.level(course.level)}
                    </span>
                    ${!course.is_published ? '<span class="cv-level-badge" style="background:rgba(100,116,139,.2);color:#94a3b8;border:1px solid rgba(100,116,139,.3)">Чернетка</span>' : ''}
                    ${enrolled ? '<span class="cv-level-badge" style="background:rgba(16,185,129,.2);color:#10b981;border:1px solid rgba(16,185,129,.3)"><i class="fa-solid fa-circle-check"></i> Записані</span>' : ''}
                </div>
                <div class="cv-hero-title">${Fmt.esc(course.title)}</div>
                ${course.description ? `<div class="cv-hero-desc">${Fmt.esc(course.description)}</div>` : ''}
                ${!enrolled ? `
                <div class="cv-hero-actions">
                    <button class="cv-enroll-btn" style="width:auto;padding:.75rem 2rem" onclick="CourseViewPage.enroll('${course.id}')">
                        <i class="fa-solid fa-graduation-cap"></i> Записатися на курс
                    </button>
                </div>` : ''}
                <div class="cv-hero-stats">
                    ${totalPublished ? `<div class="cv-hero-stat"><i class="fa-solid fa-book-open"></i> ${totalPublished} уроків</div>` : ''}
                    ${course.duration_hours ? `<div class="cv-hero-stat"><i class="fa-regular fa-clock"></i> ${course.duration_hours} год</div>` : ''}
                    ${course.category ? `<div class="cv-hero-stat"><i class="fa-solid fa-tag"></i> ${Fmt.esc(course.category)}</div>` : ''}
                </div>
            </div>
        </div>

        <div id="cv-teachers-block" style="margin-bottom:1.5rem">${this._renderTeachersBlock(this._courseTeachers, course.id)}</div>

        <div style="display:grid;grid-template-columns:1fr 300px;gap:2rem;align-items:start" class="course-layout">
            <div>

                ${course.schedule?.length ? this._renderSchedule(course.schedule) : ''}

                <div id="tests-section" style="margin-top:2rem"></div>
            </div>

            <div>
                <div class="cv-sidebar-card">
                    ${course.thumbnail_url
                        ? `<img src="${course.thumbnail_url}" class="cv-sidebar-thumb" alt="${Fmt.esc(course.title)}">`
                        : `<div class="cv-sidebar-thumb-def">📖</div>`}
                    <div class="cv-sidebar-body">
                        ${enrolled ? this._renderEnrolledActions(course, pct) : ''}
                        <div id="cv-enrollees" style="margin-top:.5rem"><div style="display:flex;justify-content:center;padding:1rem"><div class="spinner"></div></div></div>
                    </div>
                </div>
            </div>
        </div>`;

        this._loadTests(course.id, enrolled);
        this._loadEnrollees(course.id);
    },

    _renderTeachersBlock(teachers, courseId) {
        const isStaff   = AppState.isStaff();
        const myEntry   = teachers.find(t => t.user_id === AppState.user?.id);
        const others    = teachers.filter(t => t.user_id !== AppState.user?.id);
        const allSorted = myEntry ? [myEntry, ...others] : others;

        const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#ec4899','#3b82f6','#8b5cf6','#14b8a6'];
        const colorFor = (uid) => colors[Math.abs([...uid].reduce((a,c)=>a+c.charCodeAt(0),0)) % colors.length];

        const cards = allSorted.map(t => {
            const c    = colorFor(t.user_id);
            const name = Fmt.esc(t.profile?.full_name || '—');
            const pos  = Fmt.esc(t.profile?.job_position || '');
            const lbl  = t.label ? `<span style="font-size:.7rem;background:${c}22;color:${c};padding:.15rem .45rem;border-radius:999px;margin-top:.2rem;display:inline-block">${Fmt.esc(t.label)}</span>` : '';
            const isMine = t.user_id === AppState.user?.id;
            return `
                <div style="display:flex;align-items:center;gap:.65rem;padding:.6rem .85rem;background:var(--bg-raised);border-radius:var(--radius-sm);border:1px solid ${isMine ? c+'55' : 'var(--border)'};flex:1;min-width:220px;max-width:360px">
                    <div style="width:36px;height:36px;border-radius:50%;background:${c}22;display:flex;align-items:center;justify-content:center;font-size:.9rem;font-weight:700;color:${c};flex-shrink:0">
                        ${t.profile?.avatar_url
                            ? `<img src="${t.profile.avatar_url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`
                            : Fmt.initials(t.profile?.full_name || '?')}
                    </div>
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:600;font-size:.875rem">${name}${isMine ? ' <span style="font-size:.7rem;color:var(--text-muted)">(ви)</span>' : ''}</div>
                        ${pos ? `<div style="font-size:.75rem;color:var(--text-muted)">${pos}</div>` : ''}
                        ${lbl}
                    </div>
                    ${(isMine && isStaff) || AppState.isAdmin() ? `
                        <button class="btn btn-ghost btn-sm" title="Редагувати мітку"
                            onclick="CourseViewPage._editMyLabel('${t.id}','${courseId}')">
                            <i class="fa-solid fa-pen" style="font-size:.75rem"></i>
                        </button>
                        <button class="btn btn-danger btn-sm" title="${isMine ? 'Зняти себе' : 'Видалити'}"
                            onclick="CourseViewPage._removeMe('${t.id}','${courseId}')">
                            <i class="fa-solid fa-xmark" style="font-size:.75rem"></i>
                        </button>` : ''}
                </div>`;
        }).join('');

        const joinBtn = isStaff && !myEntry ? `
            <button class="btn btn-secondary btn-sm" onclick="CourseViewPage._joinAsteacher('${courseId}')">
                <i class="fa-solid fa-chalkboard-user"></i> Я веду цей курс
            </button>` : '';

        const addBtn = AppState.isAdmin() ? `
            <button class="btn btn-ghost btn-sm" onclick="CourseViewPage._adminAddTeacher('${courseId}')">
                <i class="fa-solid fa-plus"></i> Додати викладача
            </button>` : '';

        if (!allSorted.length && !isStaff) return '';

        return `
            <div class="card" style="margin-bottom:1.5rem">
                <div class="card-body" style="padding:1rem 1.25rem">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
                        <span style="font-weight:600;font-size:.9rem">
                            <i class="fa-solid fa-chalkboard-user" style="color:var(--primary);margin-right:.4rem"></i>
                            Викладачі курсу
                        </span>
                        <div style="display:flex;gap:.4rem">
                            ${joinBtn}${addBtn}
                        </div>
                    </div>
                    ${allSorted.length
                        ? `<div style="display:flex;flex-wrap:wrap;gap:.5rem">${cards}</div>`
                        : `<div style="font-size:.82rem;color:var(--text-muted)">Ніхто ще не відмітився як викладач цього курсу</div>`}
                </div>
            </div>`;
    },

    async _adminAddTeacher(courseId) {
        Loader.show();
        let profiles = [];
        try { const r = await API.profiles.getAll({ pageSize: 500 }); profiles = (r.data || []).sort((a,b) => (a.full_name||'').localeCompare(b.full_name||'','uk')); }
        catch(e) { Toast.error('Помилка', e.message); Loader.hide(); return; }
        finally { Loader.hide(); }

        Modal.open({
            title: 'Додати викладача',
            body: `
                <div class="form-group">
                    <label>Викладач *</label>
                    <select id="cv-at-user" style="width:100%">
                        <option value="">— Оберіть людину —</option>
                        ${profiles.map(p => `<option value="${p.id}">${Fmt.esc(p.full_name || p.email)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" style="margin-top:.75rem">
                    <label>Мітка групи (необов'язково)</label>
                    <input id="cv-at-label" type="text" placeholder='Наприклад: "Група A", "Тиждень 2"' style="width:100%">
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="CourseViewPage._adminAddTeacherSave('${courseId}')">Додати</button>`
        });
    },

    async _adminAddTeacherSave(courseId) {
        const userId = document.getElementById('cv-at-user')?.value;
        const label  = document.getElementById('cv-at-label')?.value.trim() || null;
        if (!userId) { Toast.error('Помилка', 'Оберіть людину'); return; }
        Loader.show();
        try {
            await supabase.from('course_teachers').insert({ course_id: courseId, user_id: userId, label, is_active: true });
            Modal.close();
            const teachers = await API.courseTeachers.getByCourse(courseId);
            this._courseTeachers = teachers;
            const el = document.getElementById('cv-teachers-block');
            if (el) el.innerHTML = this._renderTeachersBlock(teachers, courseId);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _joinAsteacher(courseId) {
        const label = await this._promptLabel();
        Loader.show();
        try {
            await API.courseTeachers.setMe(courseId, label, true);
            const teachers = await API.courseTeachers.getByCourse(courseId);
            this._courseTeachers = teachers;
            const el = document.getElementById('cv-teachers-block');
            if (el) el.innerHTML = this._renderTeachersBlock(teachers, courseId);
            Toast.success('Готово', 'Вас додано як викладача цього курсу');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _removeMe(entryId, courseId) {
        const entry = (this._courseTeachers || []).find(t => t.id === entryId);
        const isSelf = entry?.user_id === AppState.user?.id;
        const name = entry?.profile?.full_name || '';
        const msg = isSelf ? 'Зняти себе як викладача цього курсу?' : `Видалити викладача "${name}" з курсу?`;
        const ok = await Modal.confirm({ message: msg, danger: true });
        if (!ok) return;
        Loader.show();
        try {
            await API.courseTeachers.remove(entryId);
            const teachers = await API.courseTeachers.getByCourse(courseId);
            this._courseTeachers = teachers;
            const el = document.getElementById('cv-teachers-block');
            if (el) el.innerHTML = this._renderTeachersBlock(teachers, courseId);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _editMyLabel(entryId, courseId) {
        const current = this._courseTeachers.find(t => t.id === entryId)?.label || '';
        Modal.open({
            title: 'Мітка групи / тижня',
            body: `<div class="form-group">
                <label>Наприклад: "Група A", "Тиждень 2"</label>
                <input id="cv-label-input" type="text" value="${Fmt.esc(current)}" placeholder="Необов'язково" style="width:100%">
            </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="CourseViewPage._saveLabel('${entryId}','${courseId}')">Зберегти</button>`
        });
    },

    async _saveLabel(entryId, courseId) {
        const label = document.getElementById('cv-label-input')?.value.trim() || null;
        Loader.show();
        try {
            await API.courseTeachers.updateLabel(entryId, label);
            Modal.close();
            const teachers = await API.courseTeachers.getByCourse(courseId);
            this._courseTeachers = teachers;
            const el = document.getElementById('cv-teachers-block');
            if (el) el.innerHTML = this._renderTeachersBlock(teachers, courseId);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _promptLabel() {
        return new Promise(resolve => {
            Modal.open({
                title: "Мітка (необов'язково)",
                body: `<div class="form-group">
                    <label>Група або тиждень, наприклад "Група A" або "Тиждень 1"</label>
                    <input id="cv-join-label" type="text" placeholder="Залиште порожнім якщо не потрібно" style="width:100%">
                </div>`,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close();CourseViewPage._promptResolve('')">Пропустити</button>
                    <button class="btn btn-primary" onclick="CourseViewPage._promptResolve(document.getElementById('cv-join-label').value.trim())">Додати</button>`
            });
            this._promptResolve = (v) => { Modal.close(); resolve(v); };
        });
    },

    _renderSchedule(schedule) {
        const activeDay = 0;
        const tabs = schedule.map((d, i) => `
            <button class="cv-sched-tab${i === activeDay ? ' active' : ''}"
                data-day="${i}"
                onclick="CourseViewPage._switchScheduleDay(${i})">
                День ${i + 1}${d.title ? ` — ${Fmt.esc(d.title)}` : ''}
            </button>`).join('');

        const panels = schedule.map((d, i) => `
            <div class="cv-sched-panel${i === activeDay ? ' active' : ''}" data-day="${i}">
                <div style="display:flex;flex-wrap:wrap;gap:.65rem;margin-bottom:${d.instructions || d.items?.length ? '1rem' : '0'}">
                    ${d.teacher_name ? `
                        <div style="display:flex;align-items:center;gap:.4rem;font-size:.84rem;color:var(--text-secondary);background:var(--bg-raised);padding:.3rem .7rem;border-radius:var(--radius-sm)">
                            <i class="fa-solid fa-chalkboard-user" style="color:var(--primary)"></i>
                            <span>${Fmt.esc(d.teacher_name)}</span>
                        </div>` : ''}
                    ${(d.tests?.length ? d.tests : (d.test_id ? [{ id: d.test_id, title: d.test_title || 'Тест дня' }] : [])).map(t => `
                        <button class="btn btn-primary btn-sm" onclick="Router.go('tests/${t.id}')">
                            <i class="fa-solid fa-pen-to-square"></i> ${Fmt.esc(t.title || 'Тест дня')}
                        </button>`).join('')}
                </div>
                ${d.instructions ? `
                    <div style="background:rgba(99,102,241,.07);border-left:3px solid var(--primary);border-radius:0 var(--radius-sm) var(--radius-sm) 0;padding:.65rem .9rem;margin-bottom:.85rem;font-size:.84rem;color:var(--text-secondary);white-space:pre-wrap">${Fmt.esc(d.instructions)}</div>` : ''}
                ${d.items?.length ? `
                    <ul style="margin:0;padding-left:1.25rem;display:flex;flex-direction:column;gap:.4rem">
                        ${d.items.map(item => `<li style="font-size:.875rem;color:var(--text-secondary)">${Fmt.esc(item)}</li>`).join('')}
                    </ul>` : ''}
            </div>`).join('');

        return `
            <div style="margin-bottom:1.75rem">
                <h3 style="margin-bottom:.85rem">📅 Розклад занять</h3>
                <div class="card">
                    <div class="card-body" style="padding:0">
                        <div class="cv-sched-tabs">${tabs}</div>
                        <div class="cv-sched-body">${panels}</div>
                    </div>
                </div>
            </div>
            <style>
                .cv-sched-tabs{display:flex;flex-wrap:wrap;gap:.35rem;padding:.75rem .75rem 0;border-bottom:1px solid var(--border)}
                .cv-sched-tab{padding:.35rem .85rem;border-radius:var(--radius-sm) var(--radius-sm) 0 0;border:1px solid transparent;border-bottom:none;font-size:.8rem;cursor:pointer;background:none;color:var(--text-muted);transition:color .15s,background .15s;margin-bottom:-1px}
                .cv-sched-tab:hover{color:var(--text-primary);background:var(--bg-raised)}
                .cv-sched-tab.active{background:var(--bg-surface);color:var(--primary);border-color:var(--border);font-weight:600}
                .cv-sched-panel{display:none;padding:1rem 1.25rem}
                .cv-sched-panel.active{display:block}
            </style>`;
    },

    _switchScheduleDay(i) {
        document.querySelectorAll('.cv-sched-tab').forEach(b => b.classList.toggle('active', +b.dataset.day === i));
        document.querySelectorAll('.cv-sched-panel').forEach(p => p.classList.toggle('active', +p.dataset.day === i));
    },

    _renderLessons(lessons, progressMap, enrolled) {
        if (!lessons.length) return `<div class="empty-state" style="padding:2rem"><div class="empty-icon">📋</div><h3>Уроків поки немає</h3></div>`;

        return lessons.map((lesson, i) => {
            const prog      = progressMap[lesson.id];
            const completed = prog?.completed;
            const canOpen   = enrolled || lesson.is_free_preview || AppState.isStaff();
            const lessonUrl = `lessons/${lesson.id}${this._from === 'expert-path' ? '?from=expert-path' : ''}`;
            return `
                <div class="cv-lesson${completed?' done':''}${!canOpen?' locked':''}"
                     ${canOpen ? `onclick="Router.go('${lessonUrl}')"` : ''}>
                    <div class="cv-lesson-num">${completed ? '<i class="fa-solid fa-check"></i>' : i + 1}</div>
                    <div style="flex:1;min-width:0">
                        <div class="cv-lesson-title">${Fmt.esc(lesson.title)}</div>
                        <div class="cv-lesson-meta">
                            ${lesson.resources?.length ? `<span><i class="fa-solid fa-paperclip"></i> ${lesson.resources.length} матеріал(ів)</span>` : ''}
                            ${lesson.duration_minutes ? `<span><i class="fa-regular fa-clock"></i> ${Fmt.duration(lesson.duration_minutes)}</span>` : ''}
                            ${lesson.is_free_preview ? `<span style="color:var(--primary)"><i class="fa-solid fa-eye"></i> Вільний перегляд</span>` : ''}
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:.4rem;flex-shrink:0">
                        ${!canOpen ? '<i class="fa-solid fa-lock" style="color:var(--text-muted);font-size:.8rem"></i>' : ''}
                        ${canOpen && !completed ? '<i class="fa-solid fa-chevron-right" style="color:var(--text-muted);font-size:.8rem"></i>' : ''}
                        ${AppState.isStaff() ? `
                            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();CourseViewPage.openEditLesson('${lesson.id}')"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();CourseViewPage.deleteLesson('${lesson.id}',${JSON.stringify(lesson.title||'').replace(/"/g,'&quot;')})"><i class="fa-solid fa-trash"></i></button>
                        ` : ''}
                    </div>
                </div>`;
        }).join('');
    },

    _renderEnrollAction(course) { return ''; },

    _renderEnrolledActions(course, pct) {
        const lessons = this._course?.lessons?.filter(l => l.is_published) || [];
        const nextLesson = lessons.find(l => !Object.values(arguments[1] || {}).some(p => p.lesson_id === l.id && p.completed)) || lessons[0];
        const lesson = this._course?.lessons?.find(l => l.is_published);
        if (!lesson) return '';
        return `
            <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">
                <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#10b981,#0ea5e9);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <i class="fa-solid fa-circle-check" style="color:#fff;font-size:.9rem"></i>
                </div>
                <div>
                    <div style="font-weight:700;font-size:.9rem">Ви записані на курс</div>
                </div>
            </div>`;
    },

    _renderManageCard(course) { return ''; },

    async _loadEnrollees(courseId) {
        const el = document.getElementById('cv-enrollees');
        if (!el) return;
        try {
            const data = await API.enrollments.getCourseEnrollments(courseId);
            if (!data.length) {
                el.innerHTML = `<div style="border-top:1px solid var(--border);padding-top:.75rem">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem">
                        <span style="font-weight:700;font-size:.82rem;color:var(--text-muted)"><i class="fa-solid fa-users" style="margin-right:.35rem"></i>Записані</span>
                        <span style="font-size:.72rem;color:var(--text-muted);background:var(--bg-raised);padding:.1rem .5rem;border-radius:999px;font-weight:600">0</span>
                    </div>
                    <div style="font-size:.78rem;color:var(--text-muted);padding:.3rem 0">Поки ніхто не записаний</div>
                </div>`;
                return;
            }
            const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#ec4899','#3b82f6','#8b5cf6','#14b8a6'];
            const colorFor = uid => colors[Math.abs([...uid].reduce((a,c)=>a+c.charCodeAt(0),0)) % colors.length];
            el.innerHTML = `
                <div style="border-top:1px solid var(--border);padding-top:.75rem">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem">
                        <span style="font-weight:700;font-size:.82rem;color:var(--text-muted)"><i class="fa-solid fa-users" style="margin-right:.35rem"></i>Записані</span>
                        <div style="display:flex;align-items:center;gap:.4rem">
                            <span style="font-size:.72rem;color:var(--text-muted);background:var(--bg-raised);padding:.1rem .5rem;border-radius:999px;font-weight:600">${data.length}</span>
                            ${AppState.isAdmin() ? `<button onclick="CourseViewPage._resetEnrollees('${courseId}')" style="font-size:.7rem;padding:.15rem .5rem;border:1px solid var(--danger);border-radius:var(--radius-sm);background:transparent;color:var(--danger);cursor:pointer" title="Обнулити список записів"><i class="fa-solid fa-rotate-left"></i> Обнулити</button>` : ''}
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:.3rem;max-height:300px;overflow-y:auto">
                        ${data.map(e => {
                            const u   = e.user;
                            const c   = colorFor(u.id);
                            const pct = e.progress_percentage || 0;
                            const done = !!e.completed_at;
                            return `
                            <div style="display:flex;align-items:center;gap:.55rem;padding:.35rem .2rem;border-radius:var(--radius-sm);transition:background .1s" onmouseover="this.style.background='var(--bg-raised)'" onmouseout="this.style.background=''">
                                <div style="width:28px;height:28px;border-radius:50%;background:${c}22;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;color:${c};flex-shrink:0;overflow:hidden">
                                    ${u.avatar_url ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : Fmt.initials(u.full_name||'?')}
                                </div>
                                <div style="font-size:.78rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${Fmt.esc(u.full_name||u.email)}</div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
        } catch(e) { el.innerHTML = ''; }
    },

    async _resetEnrollees(courseId) {
        const ok = await Modal.confirm({ message: 'Видалити всі записи на цей курс? Користувачі зможуть записатись знову.', danger: true });
        if (!ok) return;
        Loader.show();
        try {
            await API.enrollments.resetCourse(courseId);
            Toast.success('Список записів очищено');
            this._loadEnrollees(courseId);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _loadTests(courseId, enrolled) {
        const el = document.getElementById('tests-section');
        if (!el) return;
        try {
            const tests   = await API.tests.getByCourse(courseId);
            const visible = tests.filter(t => t.is_published || AppState.isStaff());
            if (!visible.length) { el.innerHTML = ''; return; }
            el.innerHTML = `
                <div class="cv-section-head">
                    <div class="cv-section-icon" style="background:linear-gradient(135deg,#f59e0b,#ef4444)"><i class="fa-solid fa-pen-to-square"></i></div>
                    <div class="cv-section-title">Тести курсу</div>
                    <span style="margin-left:auto;font-size:.78rem;color:var(--text-muted)">${visible.length} тест${visible.length===1?'':'ів'}</span>
                </div>
                ${visible.map(t => `
                    <div class="cv-lesson" ${enrolled || AppState.isStaff() ? `onclick="Router.go('tests/${t.id}${this._from === 'expert-path' ? '?from=expert-path' : ''}')"` : ''}>
                        <div class="cv-lesson-num" style="background:linear-gradient(135deg,#f59e0b,#ef4444)">
                            <i class="fa-solid fa-pen-to-square" style="font-size:.75rem"></i>
                        </div>
                        <div style="flex:1;min-width:0">
                            <div class="cv-lesson-title">${Fmt.esc(t.title)}</div>
                            <div class="cv-lesson-meta">
                                ${t.max_attempts ? `<span><i class="fa-solid fa-rotate-right"></i> ${t.max_attempts} спроб</span>` : '<span>Безліміт спроб</span>'}
                                ${t.time_limit_minutes ? `<span><i class="fa-regular fa-clock"></i> ${t.time_limit_minutes} хв</span>` : ''}
                                ${t.passing_score ? `<span><i class="fa-solid fa-bullseye"></i> ${t.passing_score}% поріг</span>` : ''}
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:.4rem">
                            ${!t.is_published ? '<span class="badge badge-muted">Чернетка</span>' : '<i class="fa-solid fa-chevron-right" style="color:var(--text-muted);font-size:.8rem"></i>'}
                            ${AppState.isStaff() ? `
                                <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();TestsPage.openEdit('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();TestsPage.deleteTest('${t.id}',${JSON.stringify(t.title||'').replace(/"/g,'&quot;')})"><i class="fa-solid fa-trash"></i></button>
                            ` : ''}
                        </div>
                    </div>`).join('')}`;
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
            title: lesson ? '<i class="fa-solid fa-pen"></i> Редагувати урок' : '<i class="fa-solid fa-plus"></i> Додати урок',
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
                        <span>Перегляд</span>
                    </label>
                </div>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="CourseViewPage.saveLesson('${lesson?.id || ''}','${this._course.id}')"><i class="fa-regular fa-floppy-disk"></i> Зберегти</button>`
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
