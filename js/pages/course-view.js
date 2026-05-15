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
        const backLabel  = fromExpert ? 'Skill Up' : 'Курси';
        const backRoute  = fromExpert ? 'expert-path' : 'courses';
        UI.setBreadcrumb([{ label: backLabel, route: backRoute }, { label: 'Завантаження...' }]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        try {
            const [course, enrollmentRow, courseTeachers, activeRun, allRuns] = await Promise.all([
                API.courses.getById(courseId),
                API.enrollments.isEnrolled(courseId),
                API.courseTeachers.getByCourse(courseId).catch(() => []),
                API.courseRuns.getActive(courseId).catch(() => null),
                API.courseRuns.getByCourse(courseId).catch(() => [])
            ]);
            this._course         = course;
            this._enrolled       = !!enrollmentRow;
            this._enrollmentRow  = enrollmentRow;
            this._activeRun      = activeRun;
            this._allRuns        = allRuns;
            this._courseTeachers = courseTeachers;
            UI.setBreadcrumb([{ label: backLabel, route: backRoute }, { label: course.title }]);
            course.lessons?.sort((a,b) => a.order_index - b.order_index);

            let progressMap = {};
            if (this._enrolled) {
                const progress = await API.progress.getForCourse(courseId).catch(() => []);
                progressMap    = Object.fromEntries(progress.map(p => [p.lesson_id, p]));
            }
            this._render(container, course, this._enrolled, progressMap);
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

        const thumbUrl = course.thumbnail_url || '';
        const heroThumb = thumbUrl
            ? `<div class="cv-hero-thumb-bg" style="background-image:url('${thumbUrl}')"></div>
               <div class="cv-hero-thumb-overlay"></div>`
            : `<div class="cv-hero-thumb-overlay"></div>`;

        container.innerHTML = `
        <style>
            .cv-hero-wrap{display:grid;grid-template-columns:1fr 750px;gap:0;border-radius:var(--radius-lg);overflow:hidden;margin-bottom:2rem;box-shadow:0 4px 24px rgba(0,0,0,.3)}
            .cv-hero-wrap.enrolled{box-shadow:0 0 0 2px #10b981,0 0 32px rgba(16,185,129,.25),0 8px 32px rgba(0,0,0,.4)}
            .cv-hero-no-top-radius .cv-hero,.cv-hero-no-top-radius .cv-hero-img-col{border-radius:0}
            .cv-hero{position:relative;background:#0a0818;padding:2.5rem 2rem 2rem;display:flex;flex-direction:column;min-height:300px;overflow:hidden}
            .cv-hero-bg{position:absolute;inset:-12px;background-size:cover;background-position:center;filter:blur(20px) brightness(.35) saturate(1.3);transform:scale(1.05);pointer-events:none}
            .cv-hero-bg-overlay{position:absolute;inset:0;background:linear-gradient(to right,rgba(10,8,24,.7) 0%,rgba(10,8,24,.4) 100%);pointer-events:none}
            .enrolled .cv-hero-bg-overlay{background:linear-gradient(to right,rgba(4,30,20,.8) 0%,rgba(4,30,20,.45) 100%)}
            .cv-hero-wrap.enrolled .cv-hero{background:#040f0a}
            @keyframes cv-glow-pulse{0%,100%{box-shadow:0 0 0 2px #10b981,0 0 32px rgba(16,185,129,.25),0 8px 32px rgba(0,0,0,.4)}50%{box-shadow:0 0 0 2px #10b981,0 0 48px rgba(16,185,129,.4),0 8px 32px rgba(0,0,0,.4)}}
            .cv-hero-wrap.enrolled{animation:cv-glow-pulse 3s ease-in-out infinite}
            .cv-hero-img-col{position:relative;overflow:hidden;background:#0a0818}
            .cv-hero-img-bg{position:absolute;inset:-12px;background-size:cover;background-position:center;filter:blur(20px) brightness(.45) saturate(1.3);transform:scale(1.05);pointer-events:none}
            .cv-hero-img-main{position:absolute;inset:0;background-size:contain;background-repeat:no-repeat;background-position:center;z-index:1;pointer-events:none}
            .cv-thumb-upload-wrap{position:absolute;bottom:.75rem;right:.75rem;z-index:2}
            .cv-thumb-upload{display:flex;align-items:center;gap:.4rem;padding:.35rem .75rem;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.2);border-radius:var(--radius-md);color:#fff;font-size:.72rem;font-weight:600;cursor:pointer;transition:background .15s}
            .cv-thumb-upload:hover{background:rgba(0,0,0,.8)}
            .cv-hero-inner{position:relative;z-index:1;flex:1;display:flex;flex-direction:column}
            .cv-hero-badges{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}
            .cv-level-badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;font-weight:700;padding:.25rem .7rem;border-radius:999px;letter-spacing:.04em;text-transform:uppercase}
            .cv-hero-title{font-size:2rem;font-weight:800;color:#fff;line-height:1.2;margin-bottom:.65rem;text-shadow:0 2px 12px rgba(0,0,0,.4)}
            .cv-hero-desc{color:rgba(255,255,255,.72);font-size:.95rem;line-height:1.6;max-width:640px;margin-bottom:1.5rem}
            .cv-hero-actions{display:flex;gap:.75rem;flex-wrap:wrap;align-items:center}
            .cv-hero-stats{display:flex;gap:1.5rem;margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.12);flex-wrap:wrap}
            .cv-hero-stat{display:flex;align-items:center;gap:.5rem;color:rgba(255,255,255,.8);font-size:.85rem}
            .cv-hero-stat i{color:rgba(255,255,255,.5);font-size:.9rem}
            .cv-hero-no-top-radius{border-radius:0 0 var(--radius-lg) var(--radius-lg)}
            .cv-staff-bar{display:flex;gap:.5rem;flex-wrap:wrap;padding:.6rem 1rem;background:rgba(15,12,41,.85);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.08);margin-bottom:0}
            .cv-staff-bar .btn{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.15);color:rgba(255,255,255,.85)}
            .cv-staff-bar .btn:hover{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.3);color:#fff}

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
            .cv-sidebar-thumb-wrap{width:100%;aspect-ratio:16/9;overflow:hidden;position:relative;background:#0f0c29}
            .cv-sidebar-thumb-blur{position:absolute;inset:-10px;background-size:cover;background-position:center;filter:blur(16px) brightness(.45) saturate(1.2);transform:scale(1.05)}
            .cv-sidebar-thumb{position:absolute;inset:0;background-size:contain;background-repeat:no-repeat;background-position:center;z-index:1}
            .cv-sidebar-thumb-def{height:200px;background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.25));display:flex;align-items:center;justify-content:center;font-size:3.5rem}
            .cv-sidebar-body{padding:1.25rem}
            .cv-enroll-btn{width:100%;padding:.85rem;border-radius:var(--radius-md);border:2px solid rgba(255,255,255,.85);background:rgba(255,255,255,.12);backdrop-filter:blur(8px);color:#fff;font-size:1rem;font-weight:700;cursor:pointer;transition:background .18s,border-color .18s,transform .15s,box-shadow .18s;display:flex;align-items:center;justify-content:center;gap:.5rem;letter-spacing:.01em;box-shadow:0 2px 16px rgba(0,0,0,.18)}
            .cv-enroll-btn:hover{background:rgba(255,255,255,.22);border-color:#fff;transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,0,0,.25)}
            .cv-manage-btn{display:flex;align-items:center;gap:.6rem;padding:.6rem .9rem;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-raised);color:var(--text-secondary);font-size:.84rem;cursor:pointer;transition:all .15s;width:100%}
            .cv-manage-btn:hover{border-color:var(--primary);color:var(--primary);background:rgba(99,102,241,.06)}
            .cv-manage-btn i{width:16px;text-align:center;color:var(--primary)}
            .cv-info-tabs{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:1.5rem}
            .cv-info-tab-bar{display:flex;background:var(--bg-raised);border-bottom:1px solid var(--border);gap:0}
            .cv-info-tab-btn{flex:1;padding:.55rem .75rem;border:none;background:transparent;border-radius:12px;color:var(--text-muted);font-size:.8rem;font-weight:600;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.3rem;transition:all .18s;font-family:inherit;min-width:0}
            .cv-info-tab-btn+.cv-info-tab-btn{border-left:1px solid var(--border)}
            .cv-info-tab-btn .cv-tab-icon{font-size:1.35rem;line-height:1;transition:transform .2s}
            .cv-info-tab-btn .cv-tab-label{font-size:.72rem;font-weight:700;letter-spacing:.01em;white-space:nowrap}
            .cv-info-tab-btn:hover{background:var(--bg-surface);color:var(--text-primary)}
            .cv-info-tab-btn:hover .cv-tab-icon{transform:translateY(-2px)}
            .cv-info-tab-btn.active{background:var(--bg-surface);color:var(--text-primary);border-bottom:2px solid var(--primary);margin-bottom:-1px;border-radius:12px 12px 0 0}
            .cv-info-tab-btn.active .cv-tab-label{color:var(--primary)}
            .cv-info-tab-btn.active .cv-tab-icon{transform:translateY(-2px)}
            .cv-info-tab-pane{padding:1.25rem}
            .cvi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}
            .cvi-block{background:var(--bg-raised);border-radius:var(--radius-md);padding:1rem}
            .cvi-block-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.65rem}
            .cvi-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0}
            .cvi-block-title{font-weight:700;font-size:.85rem}
            .cvi-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.4rem}
            .cvi-list li{display:flex;align-items:flex-start;gap:.5rem;font-size:.83rem;line-height:1.45}
            .cvi-list li i{margin-top:.18rem;flex-shrink:0;font-size:.72rem}
            .cvi-text{font-size:.83rem;line-height:1.6;color:var(--text-secondary);margin:0}
            .cvi-empty{text-align:center;padding:1.5rem;color:var(--text-muted);font-size:.85rem}

            .cvs-wrap{display:flex;flex-direction:column;gap:1.25rem}
            .cvs-title{font-size:1.5rem;font-weight:800;color:var(--text-primary);margin-bottom:.25rem;text-align:center}
            .cvs-title-accent{color:var(--primary)}
            .cvs-days-tabs{display:flex;flex-wrap:wrap;gap:.4rem;border-bottom:1px solid var(--border);padding-bottom:.75rem;justify-content:center}
            .cvs-tab-btn{background:transparent;border:none;padding:.5rem 1.5rem;font-size:.9rem;font-weight:600;border-radius:40px;cursor:pointer;color:#5b6e8c;transition:all .18s;font-family:inherit}
            .cvs-tab-btn:hover{background:#eef2ff;color:#1e3a8a}
            .cvs-tab-btn.active{background:#1e3a8a;color:#fff;box-shadow:0 6px 14px rgba(30,58,138,.2)}
            .cvs-tab-btn.pass{background:#10b981;color:#fff;box-shadow:0 4px 12px rgba(16,185,129,.25)}
            .cvs-tab-btn.fail{background:#ef4444;color:#fff;box-shadow:0 4px 12px rgba(239,68,68,.25)}
            .cvs-accordion{background:var(--bg-surface);border-radius:24px;box-shadow:0 8px 30px rgba(0,0,0,.06);overflow:hidden;border:1px solid var(--border)}
            .cvs-acc-item{border-bottom:1px solid var(--border)}
            .cvs-acc-item:last-child{border-bottom:none}
            .cvs-acc-head{width:100%;background:transparent;padding:1.2rem 1.75rem;display:flex;justify-content:space-between;align-items:center;cursor:pointer;border:none;text-align:left;gap:1rem;transition:background .15s;font-family:inherit}
            .cvs-acc-head:hover{background:var(--bg-raised)}
            .cvs-acc-left{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;flex:1;min-width:0}
            .cvs-acc-num{padding:.22rem .8rem;border-radius:40px;font-size:.78rem;font-weight:700;border:1.5px solid;white-space:nowrap}
            .cvs-acc-num.default{background:#eef2ff;color:#1e3a8a;border-color:#c7d7f8}
            .cvs-acc-num.pass{background:rgba(16,185,129,.12);color:#10b981;border-color:rgba(16,185,129,.35)}
            .cvs-acc-num.fail{background:rgba(239,68,68,.1);color:#ef4444;border-color:rgba(239,68,68,.3)}
            .cvs-acc-name{font-size:.95rem;font-weight:700;color:var(--text-primary)}
            .cvs-acc-teacher{font-size:.78rem;color:var(--text-muted);display:flex;align-items:center;gap:.3rem}
            .cvs-acc-time{font-size:.78rem;color:var(--text-muted);background:var(--bg-raised);border:1px solid var(--border);padding:.15rem .6rem;border-radius:20px;display:inline-flex;align-items:center;gap:.3rem}
            .cvs-acc-chevron{color:var(--text-muted);font-size:.8rem;transition:transform .3s;flex-shrink:0}
            .cvs-acc-item.open .cvs-acc-chevron{transform:rotate(180deg)}
            .cvs-acc-body{max-height:0;overflow:hidden;transition:max-height .4s cubic-bezier(.2,.9,.4,1)}
            .cvs-acc-item.open .cvs-acc-body{max-height:2000px}
            .cvs-acc-inner{padding:0 1.75rem 1.5rem}
            .cvs-topic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.75rem;margin-bottom:.75rem; margin-top:.5rem}
            .cvs-topic-card{background:var(--bg-raised);padding:.8rem 1rem;border-radius:14px;border-left:3px solid}
            .cvs-topic-title{display:block;font-size:.88rem;font-weight:700;color:var(--text-primary);margin-bottom:.15rem}
            .cvs-topic-sub{font-size:.78rem;color:var(--text-secondary);line-height:1.4}
            .cvs-day-note{font-size:.82rem;color:var(--primary);background:var(--bg-raised);border:1px solid var(--border);display:inline-flex;align-items:center;gap:.4rem;padding:.3rem 1rem;border-radius:30px;margin-top:.25rem}
            .cvs-test-btn{display:flex;align-items:center;gap:.6rem;padding:.55rem .85rem;border-radius:10px;border:1.5px solid rgba(245,158,11,.3);background:rgba(245,158,11,.06);color:var(--text-primary);font-size:.82rem;font-weight:600;cursor:pointer;transition:all .2s;font-family:inherit;margin-top:.3rem}
            .cvs-test-btn:hover{border-color:rgba(245,158,11,.55);background:rgba(245,158,11,.11)}
            .cvs-test-icon{width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#f59e0b,#ef4444);display:flex;align-items:center;justify-content:center;color:#fff;font-size:.7rem;flex-shrink:0}
            .cvs-test-meta{display:flex;flex-direction:column;gap:.05rem;flex:1;min-width:0}
            .cvs-test-hint{font-size:.7rem;color:var(--text-muted)}
            .cvs-test-arrow{color:var(--text-muted);font-size:.7rem;flex-shrink:0}
            .cvs-test-passed{border-color:rgba(16,185,129,.35)!important;background:rgba(16,185,129,.07)!important}
            .cvs-test-passed .cvs-test-icon{background:linear-gradient(135deg,#10b981,#0ea5e9)!important}
            .cvs-test-failed{border-color:rgba(239,68,68,.3)!important;background:rgba(239,68,68,.06)!important}
            .cvs-test-failed .cvs-test-icon{background:linear-gradient(135deg,#ef4444,#f59e0b)!important}
            .cvs-test-result-badge{font-size:.75rem;font-weight:800;flex-shrink:0}
            .cvs-test-result-badge.pass{color:#10b981}
            .cvs-test-result-badge.fail{color:#ef4444}
        </style>

        <div style="display:grid;grid-template-columns:1fr 300px;gap:2rem;align-items:start">
            <div>
                ${AppState.isStaff() ? `
                <div class="cv-staff-bar" style="border-radius:var(--radius-lg) var(--radius-lg) 0 0;margin-bottom:0">
                    <button class="btn btn-ghost btn-sm" onclick="Router.go('analytics?course=${course.id}')"><i class="fa-solid fa-chart-bar"></i> Аналітика</button>
                    <button class="btn btn-ghost btn-sm" onclick="CourseViewPage.manageEnrollments('${course.id}')"><i class="fa-solid fa-users"></i> Стажери</button>
                    ${AppState.isAdmin() ? `<button class="btn btn-ghost btn-sm" onclick="CourseViewPage._openRunModal('${course.id}')"><i class="fa-solid fa-rotate"></i> Нова група</button>` : ''}
                    <button class="btn btn-ghost btn-sm" onclick="Router.go('admin?tab=courses&edit=${course.id}')"><i class="fa-solid fa-gear"></i> Налаштування</button>
                </div>` : ''}
                <div class="cv-hero-wrap${AppState.isStaff() ? ' cv-hero-no-top-radius' : ''}${enrolled ? ' enrolled' : ''}">
                    <div class="cv-hero">
                        ${thumbUrl ? `<div class="cv-hero-bg" style="background-image:url('${thumbUrl}')"></div><div class="cv-hero-bg-overlay"></div>` : ''}
                        <div class="cv-hero-inner">
                            <div class="cv-hero-badges">
                                <span class="cv-level-badge" style="background:${levelColor}22;color:${levelColor};border:1px solid ${levelColor}44">
                                    <i class="fa-solid fa-signal"></i> ${Fmt.level(course.level)}
                                </span>
                                ${!course.is_published ? '<span class="cv-level-badge" style="background:rgba(100,116,139,.2);color:#94a3b8;border:1px solid rgba(100,116,139,.3)">Чернетка</span>' : ''}
                                ${enrolled ? `<span class="cv-level-badge" style="background:rgba(16,185,129,.2);color:#10b981;border:1px solid rgba(16,185,129,.3)"><i class="fa-solid fa-circle-check"></i> Записані</span>
                                <button onclick="CourseViewPage.unenroll('${course.id}')" style="display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;font-weight:700;padding:.25rem .7rem;border-radius:999px;border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.15);color:#f87171;cursor:pointer;letter-spacing:.04em;text-transform:uppercase"><i class="fa-solid fa-right-from-bracket"></i> Відписатись</button>` : ''}
                            </div>
                            <div class="cv-hero-title">${Fmt.esc(course.title)}</div>
                            ${course.description ? `<div class="cv-hero-desc">${Fmt.esc(course.description)}</div>` : ''}
                            <div class="cv-hero-stats" style="margin-top:auto;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.12)">
                                ${totalPublished ? `<div class="cv-hero-stat"><i class="fa-solid fa-book-open"></i> ${totalPublished} уроків</div>` : ''}
                                ${course.duration_hours ? `<div class="cv-hero-stat"><i class="fa-regular fa-clock"></i> ${course.duration_hours} год</div>` : ''}
                                ${course.category ? `<div class="cv-hero-stat"><i class="fa-solid fa-tag"></i> ${Fmt.esc(course.category)}</div>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="cv-hero-img-col">
                        ${thumbUrl ? `
                            <div class="cv-hero-img-bg" style="background-image:url('${thumbUrl}')"></div>
                            <div class="cv-hero-img-main" style="background-image:url('${thumbUrl}')"></div>
                        ` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.1);font-size:5rem"><i class="fa-regular fa-image"></i></div>`}
                        ${AppState.isStaff() ? `
                        <div class="cv-thumb-upload-wrap">
                            <label class="cv-thumb-upload">
                                <input type="file" accept="image/*" style="display:none" onchange="CourseViewPage._uploadThumb('${course.id}', this)">
                                <i class="fa-solid fa-camera"></i> ${thumbUrl ? 'Змінити фото' : 'Додати фото'}
                            </label>
                        </div>` : ''}
                    </div>
                </div>

                <div class="cv-info-tabs">
                    <div class="cv-info-tab-bar">
                        <button class="cv-info-tab-btn active" style="position:relative" onclick="CourseViewPage._switchInfoTab('about')">
                            <span class="cv-tab-icon">📖</span>
                            <span class="cv-tab-label">Про курс</span>
                            ${AppState.isStaff() ? `<span onclick="event.stopPropagation();CourseViewPage._editCourseInfo('${course.id}')" style="position:absolute;top:6px;right:6px;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;color:var(--text-muted);border:1px solid var(--border);background:var(--bg-raised);transition:all .15s" onmouseenter="this.style.borderColor='var(--primary)';this.style.color='var(--primary)'" onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'"><i class="fa-solid fa-pen-to-square" style="font-size:.65rem"></i></span>` : ''}
                        </button>
                        <button class="cv-info-tab-btn" onclick="CourseViewPage._switchInfoTab('teachers')">
                            <span class="cv-tab-icon">🎓</span>
                            <span class="cv-tab-label">Викладачі</span>
                        </button>
                        ${course.schedule?.length || AppState.isStaff() ? `
                        <button class="cv-info-tab-btn" onclick="CourseViewPage._switchInfoTab('schedule')" style="position:relative">
                            <span class="cv-tab-icon">📅</span>
                            <span class="cv-tab-label">Розклад</span>
                            ${AppState.isStaff() ? `<span onclick="event.stopPropagation();CourseViewPage._editSchedule('${course.id}')" style="position:absolute;top:6px;right:6px;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;color:var(--text-muted);border:1px solid var(--border);background:var(--bg-raised);transition:all .15s" onmouseenter="this.style.borderColor='var(--primary)';this.style.color='var(--primary)'" onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'"><i class="fa-solid fa-pen-to-square" style="font-size:.65rem"></i></span>` : ''}
                        </button>` : ''}
                        ${(course.course_info?.meet_url || AppState.isStaff()) ? `
                        <button class="cv-info-tab-btn" onclick="CourseViewPage._switchInfoTab('meet')" style="position:relative">
                            <span class="cv-tab-icon">🎥</span>
                            <span class="cv-tab-label">Онлайн лекція</span>
                            ${AppState.isStaff() ? `<span onclick="event.stopPropagation();CourseViewPage._editMeetUrl('${course.id}')" style="position:absolute;top:6px;right:6px;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;color:var(--text-muted);border:1px solid var(--border);background:var(--bg-raised);transition:all .15s" onmouseenter="this.style.borderColor='var(--primary)';this.style.color='var(--primary)'" onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'"><i class="fa-solid fa-pen-to-square" style="font-size:.65rem"></i></span>` : ''}
                        </button>` : ''}
                    </div>
                    <div id="cv-info-tab-about" class="cv-info-tab-pane">${this._renderCourseInfoBody(course)}</div>
                    <div id="cv-info-tab-teachers" class="cv-info-tab-pane" style="display:none">${this._renderTeachersBlock(this._courseTeachers, course.id)}</div>
                    ${course.schedule?.length || AppState.isStaff() ? `<div id="cv-info-tab-schedule" class="cv-info-tab-pane" style="display:none"></div>` : ''}
                    ${(course.course_info?.meet_url || AppState.isStaff()) ? `<div id="cv-info-tab-meet" class="cv-info-tab-pane" style="display:none">${enrolled || AppState.isStaff() ? this._renderMeetTab(course) : this._renderEnrollPrompt(course.id)}</div>` : ''}
                </div>

                <div id="tests-section" style="margin-top:2rem"></div>
            </div>

            <div>
                <div class="cv-sidebar-card">
                    <div class="cv-sidebar-thumb-wrap">
                        ${course.thumbnail_url ? `
                            <div class="cv-sidebar-thumb-blur" style="background-image:url('${course.thumbnail_url}')"></div>
                            <div class="cv-sidebar-thumb" style="background-image:url('${course.thumbnail_url}')"></div>
                        ` : `<div class="cv-sidebar-thumb-def">📖</div>`}
                    </div>
                    <div class="cv-sidebar-body">
                        ${this._renderRunBlock(course, enrolled)}
                        ${enrolled ? this._renderEnrolledActions(course, pct) : ''}
                        <div id="cv-enrollees" style="margin-top:.5rem"><div style="display:flex;justify-content:center;padding:1rem"><div class="spinner"></div></div></div>
                    </div>
                </div>
            </div>
        </div>`;

        this._loadTests(course.id, enrolled);
        this._loadEnrollees(course.id);
        if (course.schedule?.length || AppState.isStaff()) this._loadScheduleTab(course.schedule || []);
    },

    async _uploadThumb(courseId, input) {
        const file = input.files[0];
        if (!file) return;
        Loader.show();
        try {
            const url = await API.courses.uploadThumbnail(courseId, file);
            const bust = url + '?t=' + Date.now();

            // hero left bg
            const heroBg = document.querySelector('.cv-hero-bg');
            if (heroBg) {
                heroBg.style.backgroundImage = `url('${bust}')`;
            } else {
                const heroEl = document.querySelector('.cv-hero');
                if (heroEl) {
                    const bg = document.createElement('div');
                    bg.className = 'cv-hero-bg';
                    bg.style.backgroundImage = `url('${bust}')`;
                    const overlay = document.createElement('div');
                    overlay.className = 'cv-hero-bg-overlay';
                    heroEl.insertBefore(overlay, heroEl.firstChild);
                    heroEl.insertBefore(bg, heroEl.firstChild);
                }
            }

            // hero image column
            const col = document.querySelector('.cv-hero-img-col');
            if (col) {
                let imgBg   = col.querySelector('.cv-hero-img-bg');
                let imgMain = col.querySelector('.cv-hero-img-main');
                if (imgBg)   { imgBg.style.backgroundImage   = `url('${bust}')`; }
                if (imgMain) { imgMain.style.backgroundImage = `url('${bust}')`; }
                if (!imgBg) {
                    const uploadWrap = col.querySelector('.cv-thumb-upload-wrap');
                    const bg2 = document.createElement('div');
                    bg2.className = 'cv-hero-img-bg';
                    bg2.style.backgroundImage = `url('${bust}')`;
                    const main2 = document.createElement('div');
                    main2.className = 'cv-hero-img-main';
                    main2.style.backgroundImage = `url('${bust}')`;
                    col.insertBefore(main2, uploadWrap);
                    col.insertBefore(bg2, uploadWrap);
                }
            }

            // sidebar
            const sidebarThumb = document.querySelector('.cv-sidebar-thumb');
            const sidebarBlur  = document.querySelector('.cv-sidebar-thumb-blur');
            if (sidebarThumb) { sidebarThumb.style.backgroundImage = `url('${bust}')`; }
            else {
                const wrap = document.querySelector('.cv-sidebar-thumb-wrap');
                if (wrap) {
                    const def = wrap.querySelector('.cv-sidebar-thumb-def');
                    if (def) def.remove();
                    const b = document.createElement('div');
                    b.className = 'cv-sidebar-thumb-blur';
                    b.style.backgroundImage = `url('${bust}')`;
                    const m = document.createElement('div');
                    m.className = 'cv-sidebar-thumb';
                    m.style.backgroundImage = `url('${bust}')`;
                    wrap.appendChild(b);
                    wrap.appendChild(m);
                }
            }
            if (sidebarBlur) sidebarBlur.style.backgroundImage = `url('${bust}')`;

            // upload button label
            const uploadLbl = document.querySelector('.cv-thumb-upload');
            if (uploadLbl) uploadLbl.innerHTML = `<input type="file" accept="image/*" style="display:none" onchange="CourseViewPage._uploadThumb('${courseId}', this)"><i class="fa-solid fa-camera"></i> Змінити фото`;

            const epImg = document.querySelector(`[data-course-id="${courseId}"] .ep-course-thumb img`);
            if (epImg) epImg.src = bust;
            Toast.success('Зображення оновлено');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
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

    _renderCourseInfoBody(course) {
        const info = course.course_info || {};
        const goals        = info.goals        || [];
        const outcomes     = info.outcomes     || [];
        const requirements = info.requirements || [];
        const forWhom      = info.for_whom     || '';
        const hasContent   = goals.length || outcomes.length || requirements.length || forWhom;
        const canEdit      = AppState.isStaff();
        if (!hasContent && !canEdit) return '';

        const listBlock = (icon, color, title, items) => !items.length ? '' : `
            <div class="cvi-block">
                <div class="cvi-block-head"><span class="cvi-icon" style="background:${color}22;color:${color}">${icon}</span><span class="cvi-block-title">${title}</span></div>
                <ul class="cvi-list">${items.map(t => `<li><i class="fa-solid fa-check" style="color:${color}"></i> ${Fmt.esc(t)}</li>`).join('')}</ul>
            </div>`;

        const forWhomBlock = !forWhom ? '' : `
            <div class="cvi-block">
                <div class="cvi-block-head"><span class="cvi-icon" style="background:#6366f122;color:#6366f1"><i class="fa-solid fa-users"></i></span><span class="cvi-block-title">Для кого цей курс</span></div>
                <p class="cvi-text">${Fmt.esc(forWhom)}</p>
            </div>`;

        const content = hasContent ? `<div class="cvi-grid">
                    ${listBlock('<i class="fa-solid fa-bullseye"></i>', '#10b981', 'Що ви отримаєте', outcomes)}
                    ${listBlock('<i class="fa-solid fa-star"></i>', '#f59e0b', 'Цілі курсу', goals)}
                    ${forWhomBlock}
                    ${listBlock('<i class="fa-solid fa-list-check"></i>', '#6366f1', 'Вимоги', requirements)}
                </div>` : `<div class="cvi-empty"><i class="fa-regular fa-file-lines" style="font-size:1.5rem;display:block;margin-bottom:.4rem"></i>Опис курсу ще не заповнений</div>`;

        return content;
    },

    _switchInfoTab(tab) {
        document.querySelectorAll('.cv-info-tab-btn').forEach(b => b.classList.remove('active'));
        const active = [...document.querySelectorAll('.cv-info-tab-btn')].find(b => b.onclick?.toString().includes(`'${tab}'`));
        if (active) active.classList.add('active');
        ['about','teachers','schedule','meet'].forEach(t => {
            const el = document.getElementById('cv-info-tab-' + t);
            if (el) el.style.display = t === tab ? '' : 'none';
        });
        if (tab === 'schedule') this._loadScheduleTab(this._course?.schedule || []);
    },

    _renderMeetTab(course) {
        const url = course.course_info?.meet_url || '';
        if (!url) return `
            <div style="padding:2rem;text-align:center;color:var(--text-muted)">
                <div style="font-size:2.5rem;margin-bottom:.75rem">🎥</div>
                <div style="font-weight:600;margin-bottom:.35rem">Посилання не додано</div>
                ${AppState.isStaff() ? `<div style="font-size:.82rem">Натисніть олівець на вкладці щоб додати посилання на Google Meet</div>` : '<div style="font-size:.82rem">Посилання з\'явиться тут після налаштування викладачем</div>'}
            </div>`;
        return `
            <div style="padding:1.5rem;display:flex;flex-direction:column;align-items:center;gap:1.25rem;text-align:center">
                <div style="width:72px;height:72px;border-radius:20px;background:linear-gradient(135deg,#00ac47,#0066da);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,166,71,.3)">
                    <i class="fa-solid fa-video" style="font-size:2rem;color:#fff"></i>
                </div>
                <div>
                    <div style="font-size:1.1rem;font-weight:700;margin-bottom:.35rem">Google Meet</div>
                    <div style="font-size:.82rem;color:var(--text-muted)">Онлайн-заняття з курсу</div>
                </div>
                <a href="${Fmt.safeUrl(url)}" target="_blank" rel="noopener noreferrer"
                   style="display:inline-flex;align-items:center;gap:.6rem;padding:.75rem 2rem;border-radius:12px;background:linear-gradient(135deg,#00ac47,#0066da);color:#fff;font-size:.95rem;font-weight:700;text-decoration:none;transition:opacity .15s;box-shadow:0 4px 16px rgba(0,102,218,.3)"
                   onmouseenter="this.style.opacity='.88'" onmouseleave="this.style.opacity='1'">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Приєднатися до зустрічі
                </a>
                <div style="font-size:.75rem;color:var(--text-muted);word-break:break-all;max-width:400px">${Fmt.esc(url)}</div>
            </div>`;
    },

    _editMeetUrl(courseId) {
        const current = this._course?.course_info?.meet_url || '';
        Modal.open({
            title: '🎥 Посилання на Google Meet',
            size: 'sm',
            body: `
            <div style="display:flex;flex-direction:column;gap:.75rem">
                <div style="font-size:.82rem;color:var(--text-muted)">Вставте посилання на Google Meet для онлайн-занять з курсу</div>
                <input id="meet-url-input" type="url" class="form-control" placeholder="https://meet.google.com/xxx-xxxx-xxx" value="${Fmt.esc(current)}">
            </div>`,
            footer: `
                <button class="btn btn-primary" onclick="CourseViewPage._saveMeetUrl('${courseId}')">Зберегти</button>
                <button class="btn btn-ghost" onclick="Modal.close()">Скасувати</button>`
        });
    },

    async _saveMeetUrl(courseId) {
        const url = document.getElementById('meet-url-input')?.value.trim() || '';
        Loader.show();
        try {
            const { data: fresh } = await supabase.from('courses').select('course_info').eq('id', courseId).single();
            const info = { ...(fresh?.course_info || {}), meet_url: url };
            await supabase.from('courses').update({ course_info: info }).eq('id', courseId);
            if (this._course) { this._course.course_info = info; }
            Modal.close();
            const el = document.getElementById('cv-info-tab-meet');
            if (el) el.innerHTML = this._renderMeetTab(this._course);
            Toast.success('Збережено');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _openRunModal(courseId) {
        Modal.open({
            title: '🔄 Нова група',
            size: 'sm',
            body: `
            <div style="display:flex;flex-direction:column;gap:.75rem">
                <div>
                    <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Назва групи *</label>
                    <input id="cvrun-title" class="form-control" placeholder="Наприклад: Група Червень 2025">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
                    <div>
                        <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Дата початку</label>
                        <input id="cvrun-start" class="form-control" type="date">
                    </div>
                    <div>
                        <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Дата завершення</label>
                        <input id="cvrun-end" class="form-control" type="date">
                    </div>
                </div>
            </div>`,
            footer: `
                <button class="btn btn-primary" onclick="CourseViewPage._saveRunModal('${courseId}')">
                    <i class="fa-regular fa-floppy-disk"></i> Зберегти
                </button>
                <button class="btn btn-ghost" onclick="Modal.close()">Скасувати</button>`
        });
    },

    _editRunModal(runId, courseId) {
        const run = (this._allRuns || []).find(r => r.id === runId);
        if (!run) return;
        Modal.open({
            title: '✏️ Редагувати групу',
            size: 'sm',
            body: `
            <div style="display:flex;flex-direction:column;gap:.75rem">
                <div>
                    <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Назва групи *</label>
                    <input id="cvrun-title" class="form-control" value="${Fmt.esc(run.title)}">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
                    <div>
                        <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Дата початку</label>
                        <input id="cvrun-start" class="form-control" type="date" value="${run.start_date || ''}">
                    </div>
                    <div>
                        <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Дата завершення</label>
                        <input id="cvrun-end" class="form-control" type="date" value="${run.end_date || ''}">
                    </div>
                </div>
            </div>`,
            footer: `
                <button class="btn btn-primary" onclick="CourseViewPage._saveRunModal('${courseId}','${runId}')">
                    <i class="fa-regular fa-floppy-disk"></i> Зберегти
                </button>
                <button class="btn btn-ghost" onclick="Modal.close()">Скасувати</button>`
        });
    },

    async _deleteRun(runId, courseId) {
        const run = (this._allRuns || []).find(r => r.id === runId);
        const ok = await Modal.confirm({ message: `Видалити групу «${run?.title || ''}»? Записи учасників залишаться.`, danger: true });
        if (!ok) return;
        Loader.show();
        try {
            await API.courseRuns.remove(runId);
            this._allRuns = await API.courseRuns.getByCourse(courseId);
            this._activeRun = await API.courseRuns.getActive(courseId);
            const container = document.getElementById('page-content');
            if (container) await CourseViewPage.init(container, { id: courseId, from: this._from });
            Toast.success('Видалено');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _saveRunModal(courseId, runId = null) {
        const title      = document.getElementById('cvrun-title')?.value.trim();
        const start_date = document.getElementById('cvrun-start')?.value || null;
        const end_date   = document.getElementById('cvrun-end')?.value || null;
        if (!title) { Toast.warning('Введіть назву групи'); return; }
        Loader.show();
        try {
            if (runId) {
                await API.courseRuns.update(runId, { title, start_date, end_date });
            } else {
                await API.courseRuns.create(courseId, { title, start_date, end_date });
            }
            Modal.close();
            this._allRuns = await API.courseRuns.getByCourse(courseId);
            this._activeRun = await API.courseRuns.getActive(courseId);
            Toast.success(runId ? 'Збережено' : 'Групу створено');
            const container = document.getElementById('page-content');
            if (container) await CourseViewPage.init(container, { id: courseId, from: this._from });
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _schedDays: [],
    _schedProfiles: [],
    _schedTests: [],
    _schedKbResources: [],

    async _editSchedule(courseId) {
        this._schedDays = (this._course?.schedule || []).map(d => ({
            ...d,
            items: [...(d.items || [])],
            tests: d.tests ? [...d.tests] : (d.test_id ? [{ id: d.test_id, title: d.test_title || '' }] : []),
            kb_resources: [...(d.kb_resources || [])]
        }));
        Loader.show();
        try {
            const [profRes, tests, kbRes] = await Promise.all([
                API.profiles.getAll({ pageSize: 500 }),
                API.tests.getAll(),
                API.resources.getAll({ pageSize: 500, studentOnly: true })
            ]);
            this._schedProfiles = (profRes.data || []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'uk'));
            this._schedTests = tests || [];
            this._schedKbResources = kbRes.data || [];
        } catch(e) { this._schedProfiles = []; this._schedTests = []; this._schedKbResources = []; }
        finally { Loader.hide(); }

        Modal.open({
            title: 'Розклад занять',
            size: 'xl',
            body: `
            <style>
                .cvse-wrap{display:flex;flex-direction:column;gap:.5rem}
                .cvse-day{display:flex;gap:0;border-radius:12px;border:1px solid var(--border);overflow:hidden;background:var(--bg-surface);transition:box-shadow .2s}
                .cvse-day:hover{box-shadow:0 2px 16px rgba(0,0,0,.1)}
                .cvse-accent{width:4px;background:var(--cvse-color);flex-shrink:0}
                .cvse-inner{flex:1;min-width:0;padding:1rem 1.25rem}
                .cvse-top{display:flex;align-items:center;gap:.75rem;margin-bottom:.9rem}
                .cvse-badge{display:inline-flex;align-items:center;justify-content:center;min-width:32px;height:24px;padding:0 .6rem;border-radius:6px;background:color-mix(in srgb,var(--cvse-color) 15%,transparent);color:var(--cvse-color);font-size:.7rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;flex-shrink:0}
                .cvse-title-input{flex:1;border:none;background:transparent;font-size:.95rem;font-weight:600;color:var(--text-primary);outline:none;padding:.15rem 0;border-bottom:1.5px solid transparent;transition:border-color .2s}
                .cvse-title-input:focus{border-bottom-color:var(--cvse-color)}
                .cvse-title-input::placeholder{color:var(--text-muted);font-weight:400}
                .cvse-del{width:28px;height:28px;border-radius:7px;border:none;background:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.8rem;flex-shrink:0;transition:all .15s;margin-left:.25rem}
                .cvse-del:hover{color:#ef4444;background:rgba(239,68,68,.1)}
                .cvse-icon-btn{width:36px;height:36px;border-radius:9px;border:1.5px solid var(--border);background:color-mix(in srgb,var(--cvse-color) 12%,transparent);color:var(--cvse-color);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1rem;flex-shrink:0;transition:all .15s;position:relative}
                .cvse-icon-btn:hover{border-color:var(--cvse-color);transform:scale(1.08)}
                .cvse-icon-picker{position:absolute;top:calc(100% + 6px);left:0;z-index:100;background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:.6rem;box-shadow:0 8px 32px rgba(0,0,0,.18);display:grid;grid-template-columns:repeat(8,32px);gap:.3rem;width:max-content}
                .cvse-icon-opt{width:32px;height:32px;border-radius:7px;border:1px solid transparent;background:none;color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.85rem;transition:all .15s}
                .cvse-icon-opt:hover{background:var(--bg-raised);color:var(--primary);border-color:var(--border)}
                .cvse-icon-opt.selected{background:rgba(99,102,241,.15);color:var(--primary);border-color:rgba(99,102,241,.4)}
                .cvse-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem 1.25rem}
                .cvse-field-full{grid-column:1/-1}
                .cvse-lbl{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:.3rem;display:flex;align-items:center;justify-content:space-between}
                .cvse-lbl-btn{text-transform:none;letter-spacing:0;font-weight:600;color:var(--primary);cursor:pointer;display:inline-flex;align-items:center;gap:.25rem;font-size:.72rem;padding:.1rem .4rem;border-radius:4px;transition:background .15s}
                .cvse-lbl-btn:hover{background:rgba(99,102,241,.1)}
                .cvse-input,.cvse-select,.cvse-textarea{width:100%;padding:.5rem .7rem;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.85rem;outline:none;transition:border-color .2s;box-sizing:border-box}
                .cvse-input:focus,.cvse-select:focus,.cvse-textarea:focus{border-color:var(--cvse-color,var(--primary))}
                .cvse-textarea{resize:vertical;line-height:1.55;min-height:60px}
                .cvse-topics{display:flex;flex-direction:column;gap:.3rem}
                .cvse-topic-row{display:flex;align-items:center;gap:.4rem}
                .cvse-topic-n{width:20px;height:20px;border-radius:50%;background:color-mix(in srgb,var(--cvse-color) 15%,transparent);color:var(--cvse-color);font-size:.65rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
                .cvse-topic-rm{width:24px;height:24px;border-radius:6px;border:none;background:none;color:var(--text-muted);font-size:.72rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
                .cvse-topic-rm:hover{color:#ef4444;background:rgba(239,68,68,.1)}
                .cvse-add-topic{display:inline-flex;align-items:center;gap:.35rem;margin-top:.3rem;font-size:.8rem;font-weight:500;color:var(--text-muted);cursor:pointer;border:none;background:none;padding:.2rem 0;transition:color .15s}
                .cvse-add-topic:hover{color:var(--primary)}
                .cvse-tests{display:flex;flex-direction:column;gap:.3rem}
                .cvse-test-row{display:flex;align-items:center;gap:.4rem}
                .cvse-empty{font-size:.78rem;color:var(--text-muted);font-style:italic}
                .cvse-divider{height:1px;background:var(--border);margin:.75rem 0}
                .cvse-add-day{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;padding:.65rem;border-radius:10px;border:1.5px dashed var(--border);background:none;color:var(--text-muted);font-size:.85rem;font-weight:600;cursor:pointer;transition:all .2s;margin-top:.25rem}
                .cvse-add-day:hover{border-color:var(--primary);color:var(--primary);background:rgba(99,102,241,.04)}
                .cvse-kb-chips{display:flex;flex-wrap:wrap;gap:.35rem;min-height:0;margin-bottom:.35rem}
                .cvse-kb-chip{display:inline-flex;align-items:center;gap:.3rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;padding:.18rem .5rem;font-size:.75rem;max-width:220px}
                .cvse-kb-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                .cvse-kb-chip button{background:none;border:none;cursor:pointer;color:var(--text-muted);padding:0;line-height:1;flex-shrink:0;font-size:.65rem}
                .cvse-kb-chip button:hover{color:#ef4444}
                .cvse-kb-list{border:1px solid var(--border);border-radius:8px;max-height:160px;overflow-y:auto;background:var(--bg-raised)}
                .cvse-kb-item{display:flex;align-items:center;gap:.5rem;padding:.4rem .75rem;cursor:pointer;font-size:.8rem;border-bottom:1px solid var(--border);transition:background .12s}
                .cvse-kb-item:last-child{border-bottom:none}
                .cvse-kb-item:hover{background:var(--bg-surface)}
                .cvse-kb-item.sel{background:color-mix(in srgb,var(--primary) 8%,transparent)}
                .cvse-kb-item i.check{color:var(--primary)}
                .cvse-kb-item i.uncheck{color:var(--border)}
            </style>
            <div id="cvse-builder" style="max-height:68vh;overflow-y:auto;padding-right:2px"></div>
            <button class="cvse-add-day" onclick="CourseViewPage._schedAddDay()">
                <i class="fa-solid fa-plus"></i> Додати день
            </button>`,
            footer: `<button class="btn btn-primary" onclick="CourseViewPage._saveSchedule('${courseId}')">Зберегти</button>
                     <button class="btn btn-ghost" onclick="Modal.close()">Скасувати</button>`
        });
        this._schedRender();
    },

    _schedRender() {
        const el = document.getElementById('cvse-builder');
        if (!el) return;
        if (!this._schedDays.length) {
            el.innerHTML = `<div style="color:var(--text-muted);font-size:.85rem;padding:1rem 0;text-align:center">Розклад порожній — додайте перший день</div>`;
            return;
        }
        const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#0ea5e9','#ef4444'];
        el.innerHTML = `<div class="cvse-wrap">${this._schedDays.map((day, di) => {
            const color = colors[di % colors.length];
            return `
            <div class="cvse-day" style="--cvse-color:${color}">
                <div class="cvse-accent"></div>
                <div class="cvse-inner">
                    <div class="cvse-top">
                        <span class="cvse-badge">День ${di + 1}</span>
                        <input class="cvse-title-input" type="text" placeholder="Назва дня (необов'язково)"
                            value="${Fmt.esc(day.title || '')}"
                            oninput="CourseViewPage._schedDays[${di}].title=this.value">
                        <button class="cvse-del" title="Видалити день" onclick="CourseViewPage._schedRemoveDay(${di})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <div class="cvse-grid">
                        <div>
                            <div class="cvse-lbl">Викладач</div>
                            <select class="cvse-select"
                                onchange="CourseViewPage._schedDays[${di}].teacher_id=this.value;CourseViewPage._schedDays[${di}].teacher_name=this.options[this.selectedIndex].dataset.name||''">
                                <option value="" data-name="">Не вказано</option>
                                ${this._schedProfiles.map(p => `<option value="${p.id}" data-name="${Fmt.esc(p.full_name || p.email)}" ${day.teacher_id === p.id ? 'selected' : ''}>${Fmt.esc(p.full_name || p.email)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <div class="cvse-lbl">
                                <span>Тести дня</span>
                                <span class="cvse-lbl-btn" onclick="CourseViewPage._schedAddTest(${di})"><i class="fa-solid fa-plus"></i> Додати</span>
                            </div>
                            <div class="cvse-tests">
                                ${(day.tests || []).map((t, ti) => `
                                <div class="cvse-test-row">
                                    <select class="cvse-select" style="flex:1"
                                        onchange="CourseViewPage._schedDays[${di}].tests[${ti}]={id:this.value,title:this.options[this.selectedIndex].dataset.title||''}">
                                        <option value="">Оберіть тест...</option>
                                        ${this._schedTests.map(st => `<option value="${st.id}" data-title="${Fmt.esc(st.title)}" ${t.id === st.id ? 'selected' : ''}>${Fmt.esc(st.title)}</option>`).join('')}
                                    </select>
                                    <button class="cvse-topic-rm" onclick="CourseViewPage._schedRemoveTest(${di},${ti})"><i class="fa-solid fa-xmark"></i></button>
                                </div>`).join('') || `<div class="cvse-empty">Не призначено</div>`}
                            </div>
                        </div>
                        <div>
                            <div class="cvse-lbl">Час проведення</div>
                            <input class="cvse-input" type="text" placeholder="напр. 10:00 – 17:00"
                                value="${Fmt.esc(day.time_range || '')}"
                                oninput="CourseViewPage._schedDays[${di}].time_range=this.value">
                        </div>
                        <div class="cvse-field-full">
                            <div class="cvse-lbl">Нотатки</div>
                            <textarea class="cvse-textarea" rows="2"
                                oninput="CourseViewPage._schedDays[${di}].instructions=this.value"
                                placeholder="Особливі умови, матеріали...">${Fmt.esc(day.instructions || '')}</textarea>
                        </div>
                        <div class="cvse-field-full">
                            <div class="cvse-lbl">Теми занять</div>
                            <div class="cvse-topics">
                                ${(day.items || []).map((item, ii) => {
                                    const t = typeof item === 'object' ? item : { title: item, desc: '' };
                                    return `
                                <div class="cvse-topic-row" style="align-items:flex-start">
                                    <span class="cvse-topic-n" style="margin-top:.6rem">${ii + 1}</span>
                                    <div style="flex:1;display:flex;flex-direction:column;gap:.3rem">
                                        <input class="cvse-input" type="text" value="${Fmt.esc(t.title || '')}"
                                            placeholder="Назва теми..."
                                            oninput="CourseViewPage._schedItemSet(${di},${ii},'title',this.value)">
                                        <input class="cvse-input" type="text" value="${Fmt.esc(t.desc || '')}"
                                            placeholder="Короткий опис (необов'язково)..."
                                            oninput="CourseViewPage._schedItemSet(${di},${ii},'desc',this.value)">
                                    </div>
                                    <button class="cvse-topic-rm" style="margin-top:.5rem" onclick="CourseViewPage._schedRemoveItem(${di},${ii})"><i class="fa-solid fa-xmark"></i></button>
                                </div>`; }).join('')}
                            </div>
                            <button class="cvse-add-topic" onclick="CourseViewPage._schedAddItem(${di})">
                                <i class="fa-solid fa-plus"></i> Додати тему
                            </button>
                        </div>
                        <div class="cvse-field-full">
                            <div class="cvse-lbl">
                                <span>📂 Файли з бази знань</span>
                                <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted);font-size:.7rem">${(day.kb_resources||[]).length ? (day.kb_resources.length + ' обрано') : ''}</span>
                            </div>
                            <div class="cvse-kb-chips" id="cvse-kb-chips-${di}">
                                ${(day.kb_resources || []).map(r => `
                                <span class="cvse-kb-chip">
                                    <i class="fa-solid ${CourseViewPage._kbIcon(r.type)}" style="color:var(--primary);font-size:.65rem;flex-shrink:0"></i>
                                    <span>${Fmt.esc(r.title)}</span>
                                    <button onclick="CourseViewPage._schedKbToggle(${di},'${r.id}')"><i class="fa-solid fa-xmark"></i></button>
                                </span>`).join('')}
                            </div>
                            <input class="cvse-input" type="text" placeholder="Пошук файлів..."
                                style="margin-bottom:.35rem"
                                oninput="CourseViewPage._schedKbFilter(${di},this.value)">
                            <div class="cvse-kb-list" id="cvse-kb-list-${di}">
                                ${this._schedKbResources.length ? this._schedKbResources.map(r => {
                                    const sel = (day.kb_resources||[]).some(s => s.id === r.id);
                                    return `<div class="cvse-kb-item${sel?' sel':''}" onclick="CourseViewPage._schedKbToggle(${di},'${r.id}')">
                                        <i class="fa-solid ${CourseViewPage._kbIcon(r.type)}" style="color:var(--text-muted);font-size:.75rem;flex-shrink:0"></i>
                                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Fmt.esc(r.title)}</span>
                                        <i class="fa-solid ${sel?'fa-circle-check':'fa-circle'} ${sel?'check':'uncheck'}" style="font-size:.8rem;flex-shrink:0"></i>
                                    </div>`;
                                }).join('') : '<div style="padding:.6rem .75rem;color:var(--text-muted);font-size:.8rem">Файли відсутні</div>'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('')}</div>`;
    },

    _schedAddDay() { this._schedDays.push({ title:'', icon:'', time_range:'', teacher_id:'', teacher_name:'', tests:[], instructions:'', items:[], kb_resources:[] }); this._schedRender(); },
    _schedRemoveDay(di) { this._schedDays.splice(di, 1); this._schedRender(); },
    _schedAddTest(di) { if (!this._schedDays[di].tests) this._schedDays[di].tests = []; this._schedDays[di].tests.push({ id:'', title:'' }); this._schedRender(); },
    _schedRemoveTest(di, ti) { this._schedDays[di].tests.splice(ti, 1); this._schedRender(); },
    _schedAddItem(di) { this._schedDays[di].items.push({ title:'', desc:'' }); this._schedRender(); },
    _schedRemoveItem(di, ii) { this._schedDays[di].items.splice(ii, 1); this._schedRender(); },
    _kbIcon(type) {
        const map = { pdf:'fa-file-pdf', video:'fa-circle-play', link:'fa-link', scorm:'fa-cube', image:'fa-image', document:'fa-file-lines', file:'fa-file' };
        return map[type] || 'fa-file';
    },

    _schedKbToggle(di, id) {
        const day = this._schedDays[di];
        if (!day.kb_resources) day.kb_resources = [];
        const idx = day.kb_resources.findIndex(r => r.id === id);
        if (idx >= 0) {
            day.kb_resources.splice(idx, 1);
        } else {
            const res = this._schedKbResources.find(r => r.id === id);
            if (res) day.kb_resources.push({ id: res.id, title: res.title, type: res.type });
        }
        this._schedRender();
    },

    _schedKbFilter(di, q) {
        const list = document.getElementById('cvse-kb-list-' + di);
        if (!list) return;
        const term = q.toLowerCase();
        const day = this._schedDays[di];
        const filtered = this._schedKbResources.filter(r => !term || r.title.toLowerCase().includes(term));
        list.innerHTML = filtered.length ? filtered.map(r => {
            const sel = (day.kb_resources||[]).some(s => s.id === r.id);
            return `<div class="cvse-kb-item${sel?' sel':''}" onclick="CourseViewPage._schedKbToggle(${di},'${r.id}')">
                <i class="fa-solid ${CourseViewPage._kbIcon(r.type)}" style="color:var(--text-muted);font-size:.75rem;flex-shrink:0"></i>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Fmt.esc(r.title)}</span>
                <i class="fa-solid ${sel?'fa-circle-check':'fa-circle'} ${sel?'check':'uncheck'}" style="font-size:.8rem;flex-shrink:0"></i>
            </div>`;
        }).join('') : '<div style="padding:.6rem .75rem;color:var(--text-muted);font-size:.8rem">Нічого не знайдено</div>';
    },

    _schedItemSet(di, ii, key, val) {
        const item = this._schedDays[di].items[ii];
        if (typeof item === 'object') item[key] = val;
        else this._schedDays[di].items[ii] = { title: item, desc: '', [key]: val };
    },

    async _saveSchedule(courseId) {
        const schedule = this._schedDays.map(d => ({
            title:        d.title || '',
            icon:         d.icon || '',
            time_range:   d.time_range || '',
            teacher_id:   d.teacher_id || null,
            teacher_name: d.teacher_name || '',
            tests:        (d.tests || []).filter(t => t.id),
            instructions: d.instructions || '',
            items:        (d.items || []).map(it => typeof it === 'object' ? { title:(it.title||'').trim(), desc:(it.desc||'').trim() } : { title:it.trim(), desc:'' }).filter(it => it.title),
            kb_resources: (d.kb_resources || [])
        }));
        Loader.show();
        try {
            await API.courses.update(courseId, { schedule });
            if (this._course) this._course.schedule = schedule;
            Modal.close();
            await this._loadScheduleTab(schedule);
            Toast.success('Збережено');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _renderEnrollPrompt(courseId) {
        return `
        <div style="padding:2.5rem 1.5rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:1rem">
            <div style="font-size:2.5rem">🔒</div>
            <div style="font-weight:700;font-size:1rem">Запишіться на курс</div>
            <div style="font-size:.85rem;color:var(--text-muted);max-width:280px">Цей розділ доступний лише для учасників курсу. Запишіться, щоб отримати доступ.</div>
            <button class="cv-enroll-btn" style="width:auto;padding:.75rem 2rem;background:rgba(0,0,0,.07);border-color:var(--border);color:var(--text-primary)" onmouseenter="this.style.background='rgba(0,0,0,.13)'" onmouseleave="this.style.background='rgba(0,0,0,.07)'" onclick="CourseViewPage.enroll('${courseId}',${this._activeRun ? `'${this._activeRun.id}'` : 'null'})">
                <i class="fa-solid fa-circle-plus"></i> Записатися
            </button>
        </div>`;
    },

    async _loadScheduleTab(schedule) {
        const el = document.getElementById('cv-info-tab-schedule');
        if (!el) return;
        if (!this._enrolled && !AppState.isStaff()) {
            el.innerHTML = this._renderEnrollPrompt(this._course?.id || '');
            return;
        }
        const testIds = [...new Set(schedule.flatMap(d =>
            d.tests?.length ? d.tests.map(t => t.id) : (d.test_id ? [d.test_id] : [])
        ).filter(Boolean))];
        const attemptsMap = {};
        if (testIds.length && !AppState.isImpersonating()) {
            await Promise.all(testIds.map(async id => {
                try {
                    const list = await API.attempts.getByTest(id);
                    const completed = (list || []).filter(a => a.completed_at);
                    const best = completed.sort((a, b) => (b.passed ? 1 : 0) - (a.passed ? 1 : 0) || b.percentage - a.percentage)[0];
                    if (best) attemptsMap[id] = best;
                } catch {}
            }));
        }
        el.innerHTML = this._renderScheduleCards(schedule, attemptsMap);
    },

    _renderScheduleCards(schedule, attemptsMap = {}) {
        const dayColors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#0ea5e9'];
        const defaultIcons = ['fa-mobile-screen','fa-laptop','fa-screwdriver-wrench','fa-star','fa-rocket','fa-crown','fa-gem'];
        const n = schedule.length;
        const label = n === 1 ? '1 день' : n < 5 ? n + ' дні' : n + ' днів';

        const tabsHtml = schedule.map((d, i) => {
            const tests = d.tests?.length ? d.tests : (d.test_id ? [{ id: d.test_id, title: d.test_title || 'Тест дня' }] : []);
            const attempted = tests.filter(t => attemptsMap[t.id]);
            const allPassed = tests.length > 0 && attempted.length === tests.length && attempted.every(t => attemptsMap[t.id].passed);
            const anyFailed = attempted.some(t => !attemptsMap[t.id].passed);
            const cls = allPassed ? ' pass' : anyFailed ? ' fail' : (i === 0 ? ' active' : '');
            return `<button class="cvs-tab-btn${cls}" onclick="CourseViewPage._cvsDayOpen(${i})">ДЕНЬ ${i + 1}</button>`;
        }).join('');

        const itemsHtml = schedule.map((d, i) => {
            const color = dayColors[i % dayColors.length];
            const icon  = d.icon || defaultIcons[i % defaultIcons.length];
            const tests = d.tests?.length ? d.tests : (d.test_id ? [{ id: d.test_id, title: d.test_title || 'Тест дня' }] : []);
            const attempted = tests.filter(t => attemptsMap[t.id]);
            const allPassed = tests.length > 0 && attempted.length === tests.length && attempted.every(t => attemptsMap[t.id].passed);
            const anyFailed = attempted.some(t => !attemptsMap[t.id].passed);
            const numCls = allPassed ? 'pass' : anyFailed ? 'fail' : 'default';

            const topicsHtml = d.items?.length ? `
            <div class="cvs-topic-grid">
                ${d.items.map(item => {
                    const t = typeof item === 'object' ? item : { title: item, desc: '' };
                    return `
                <div class="cvs-topic-card" style="border-left-color:${color}">
                    <span class="cvs-topic-title">${Fmt.esc(t.title || '')}</span>
                    ${t.desc ? `<span class="cvs-topic-sub">${Fmt.esc(t.desc)}</span>` : ''}
                </div>`;}).join('')}
            </div>` : '';

            const noteHtml = d.instructions ? `
            <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.25rem">
                <span class="cvs-day-note" style="font-style:italic"><i class="fa-solid fa-circle-info"></i> ${Fmt.esc(d.instructions)}</span>
            </div>` : '';

            const teacherHtml = d.teacher_name ? `
            <span class="cvs-acc-teacher"><i class="fa-solid fa-chalkboard-user"></i> ${Fmt.esc(d.teacher_name)}</span>` : '';

            const testsHtml = tests.length ? `
                <div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border)">
                    <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:.4rem">
                        <i class="fa-solid fa-pen-to-square"></i> Тест до заняття
                    </div>
                    ${tests.map(t => {
                        const att = attemptsMap[t.id];
                        const done = !!att;
                        const passed = att?.passed;
                        const pct = att?.percentage ?? 0;
                        return `
                    <button class="cvs-test-btn${done ? (passed ? ' cvs-test-passed' : ' cvs-test-failed') : ''}" onclick="Router.go('tests/${t.id}')">
                        <div class="cvs-test-icon">${done
                            ? '<i class="fa-solid ' + (passed ? 'fa-circle-check' : 'fa-circle-xmark') + '"></i>'
                            : '<i class="fa-solid fa-pen-to-square"></i>'}</div>
                        <div class="cvs-test-meta">
                            <span>${Fmt.esc(t.title || 'Тест дня')}</span>
                            <span class="cvs-test-hint">${done
                                ? (passed ? 'Пройдено — ' + Math.round(pct) + '%' : 'Не пройдено — ' + Math.round(pct) + '%')
                                : 'Пройдіть після лекції'}</span>
                        </div>
                        ${done
                            ? '<span class="cvs-test-result-badge' + (passed ? ' pass' : ' fail') + '">' + (passed ? '✓' : '✗') + '</span>'
                            : '<i class="fa-solid fa-chevron-right cvs-test-arrow"></i>'}
                    </button>`;
                    }).join('')}
                </div>` : '';

            return `
            <div class="cvs-acc-item${i === 0 ? ' open' : ''}" id="cvs-day-${i}">
                <button class="cvs-acc-head" onclick="CourseViewPage._cvsDayToggle(${i})">
                    <div class="cvs-acc-left">
                        <span class="cvs-acc-num ${numCls}">ДЕНЬ ${i + 1}</span>
                        ${d.title ? `<span class="cvs-acc-name">${Fmt.esc(d.title)}</span>` : ''}
                        ${teacherHtml}
                        ${d.time_range ? `<span class="cvs-acc-time"><i class="fa-regular fa-clock"></i> ${Fmt.esc(d.time_range)}</span>` : ''}
                    </div>
                    <i class="fa-solid fa-chevron-down cvs-acc-chevron"></i>
                </button>
                <div class="cvs-acc-body">
                    <div class="cvs-acc-inner">
                        ${topicsHtml}
                        ${noteHtml}
                        ${testsHtml}
                        ${d.kb_resources?.length ? `
                        <div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border)">
                            <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:.4rem">
                                <i class="fa-solid fa-paperclip"></i> Матеріали до заняття
                            </div>
                            <div style="display:flex;flex-wrap:wrap;gap:.4rem">
                                ${d.kb_resources.map(r => `
                                <a href="#" onclick="event.preventDefault();Router.go('resource/${r.id}')"
                                   style="display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .7rem;border-radius:20px;border:1px solid var(--border);background:var(--bg-raised);color:var(--text-primary);text-decoration:none;font-size:.78rem;transition:all .15s;max-width:240px;overflow:hidden"
                                   onmouseenter="this.style.background='var(--bg-surface)';this.style.borderColor='var(--primary)'" onmouseleave="this.style.background='var(--bg-raised)';this.style.borderColor='var(--border)'">
                                    <i class="fa-solid ${this._kbIcon(r.type)}" style="color:var(--primary);font-size:.72rem;flex-shrink:0"></i>
                                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Fmt.esc(r.title)}</span>
                                </a>`).join('')}
                            </div>
                        </div>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="cvs-wrap">
            <div class="cvs-title">Графік курсу <span class="cvs-title-accent">• ${label}</span></div>
            <div class="cvs-days-tabs">${tabsHtml}</div>
            <div class="cvs-accordion">${itemsHtml}</div>
        </div>`;
    },

    _cvsDayOpen(idx) {
        document.querySelectorAll('.cvs-acc-item').forEach((el, i) => el.classList.toggle('open', i === idx));
        document.querySelectorAll('.cvs-tab-btn').forEach((el, i) => {
            if (!el.classList.contains('pass') && !el.classList.contains('fail')) {
                el.classList.toggle('active', i === idx);
            }
        });
    },

    _cvsDayToggle(idx) {
        const items = document.querySelectorAll('.cvs-acc-item');
        const item = items[idx];
        if (!item) return;
        const opening = !item.classList.contains('open');
        items.forEach((el, i) => el.classList.toggle('open', i === idx && opening));
        if (opening) {
            document.querySelectorAll('.cvs-tab-btn').forEach((el, i) => {
                if (!el.classList.contains('pass') && !el.classList.contains('fail')) {
                    el.classList.toggle('active', i === idx);
                }
            });
        }
    },

    _editCourseInfo(courseId) {
        const info = this._course?.course_info || {};
        const toLines = arr => (arr || []).join('\n');
        Modal.open({
            title: 'Інформація про курс',
            size: 'lg',
            body: `
            <div style="display:flex;flex-direction:column;gap:1rem">
                <div>
                    <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Дата початку курсу</label>
                    <input id="cvi-start-date" type="date" class="form-control" value="${Fmt.esc(info.start_date || '')}">
                </div>
                <div>
                    <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Що отримаєте (кожен пункт з нового рядка)</label>
                    <textarea id="cvi-outcomes" rows="4" class="form-control" style="width:100%">${Fmt.esc(toLines(info.outcomes))}</textarea>
                </div>
                <div>
                    <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Цілі курсу (кожен пункт з нового рядка)</label>
                    <textarea id="cvi-goals" rows="4" class="form-control" style="width:100%">${Fmt.esc(toLines(info.goals))}</textarea>
                </div>
                <div>
                    <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Для кого цей курс</label>
                    <textarea id="cvi-for-whom" rows="3" class="form-control" style="width:100%">${Fmt.esc(info.for_whom || '')}</textarea>
                </div>
                <div>
                    <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Вимоги (кожен пункт з нового рядка)</label>
                    <textarea id="cvi-requirements" rows="3" class="form-control" style="width:100%">${Fmt.esc(toLines(info.requirements))}</textarea>
                </div>
            </div>`,
            footer: `<button class="btn btn-primary" onclick="CourseViewPage._saveCourseInfo('${courseId}')">Зберегти</button>
                     <button class="btn btn-ghost" onclick="Modal.close()">Скасувати</button>`
        });
    },

    async _saveCourseInfo(courseId) {
        const toArr = id => document.getElementById(id).value.split('\n').map(s => s.trim()).filter(Boolean);
        const info = {
            outcomes:     toArr('cvi-outcomes'),
            goals:        toArr('cvi-goals'),
            for_whom:     document.getElementById('cvi-for-whom').value.trim(),
            requirements: toArr('cvi-requirements'),
            start_date:   document.getElementById('cvi-start-date').value || null,
        };
        Loader.show();
        try {
            const { data: fresh } = await supabase.from('courses').select('course_info').eq('id', courseId).single();
            const merged = { ...(fresh?.course_info || {}), ...info };
            await API.courses.update(courseId, { course_info: merged });
            if (this._course) this._course.course_info = merged;
            Modal.close();
            const el = document.getElementById('cv-info-tab-about');
            if (el) el.innerHTML = this._renderCourseInfoBody(this._course);
            Toast.success('Збережено');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
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

    _renderRunBlock(course, enrolled) {
        const run         = this._activeRun;
        const allRuns     = this._allRuns || [];
        const today       = new Date().toISOString().slice(0, 10);
        const enrollment  = this._enrollmentRow;
        const enrolledRunId = enrollment?.run_id || null;

        const fmtDate = d => d ? Fmt.dateShort(new Date(d + 'T00:00:00')) : '';
        const runStatus = r => {
            const ended   = r.end_date && r.end_date < today;
            const started = !r.start_date || r.start_date <= today;
            if (ended)    return { label: 'Завершено', color: '#94a3b8' };
            if (started)  return { label: 'Активна',   color: '#10b981' };
            return            { label: 'Заплановано', color: '#6366f1' };
        };
        const adminBlock = '';

        // No runs at all
        if (!allRuns.length) {
            if (!enrolled) return `
                <button class="cv-enroll-btn" style="width:100%;margin-bottom:.75rem;background:rgba(0,0,0,.07);border-color:var(--border);color:var(--text-primary)"
                        onmouseenter="this.style.background='rgba(0,0,0,.13)'" onmouseleave="this.style.background='rgba(0,0,0,.07)'"
                        onclick="CourseViewPage.enroll('${course.id}')">
                    <i class="fa-solid fa-circle-plus"></i> Записатися
                </button>`;
            return '';
        }

        // Already enrolled in active run — show current group + admin list
        if (enrolled && run && enrolledRunId === run.id) {
            const ended = run.end_date && run.end_date < today;
            return adminBlock + `
            <div style="padding:.65rem .9rem;border-radius:10px;background:color-mix(in srgb,var(--primary) 8%,transparent);border:1px solid color-mix(in srgb,var(--primary) 20%,transparent);margin-bottom:.75rem">
                <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:.2rem">
                    <i class="fa-solid fa-rotate"></i> Поточна група
                </div>
                <div style="font-weight:700;font-size:.9rem">${Fmt.esc(run.title)}</div>
                ${run.start_date || run.end_date ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem">
                    ${fmtDate(run.start_date)}${run.start_date && run.end_date ? ' — ' : ''}${fmtDate(run.end_date)}
                    ${ended ? '<span style="color:#ef4444;margin-left:.4rem">• Завершено</span>' : ''}
                </div>` : ''}
            </div>`;
        }

        // Available runs for enrollment (not ended)
        const availableRuns = allRuns.filter(r => !r.end_date || r.end_date >= today);

        if (!enrolled && !availableRuns.length) {
            return adminBlock + `<div style="padding:.65rem;border-radius:10px;background:var(--bg-raised);border:1px solid var(--border);margin-bottom:.75rem;font-size:.82rem;color:var(--text-muted);text-align:center">
                <i class="fa-solid fa-calendar-xmark"></i> Активних груп немає
            </div>`;
        }

        // User not enrolled or enrolled in past run — show group picker
        if (!enrolled || (enrolled && enrolledRunId && !availableRuns.find(r => r.id === enrolledRunId))) {
            if (!availableRuns.length) return adminBlock;
            return adminBlock + `
            <div style="margin-bottom:.75rem">
                <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:.4rem">
                    <i class="fa-solid fa-circle-plus"></i> ${enrolled ? 'Записатися на нову групу' : 'Оберіть групу'}
                </div>
                <div style="display:flex;flex-direction:column;gap:.35rem">
                    ${availableRuns.map(r => {
                        const dates = [fmtDate(r.start_date), fmtDate(r.end_date)].filter(Boolean).join(' — ');
                        const st = runStatus(r);
                        return `
                        <div style="display:flex;align-items:center;gap:.5rem;padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border);background:var(--bg-raised);transition:border-color .15s"
                             onmouseenter="this.style.borderColor='var(--primary)'" onmouseleave="this.style.borderColor='var(--border)'">
                            <span style="width:7px;height:7px;border-radius:50%;background:${st.color};flex-shrink:0"></span>
                            <div style="flex:1;min-width:0;cursor:pointer" onclick="CourseViewPage.enroll('${course.id}','${r.id}')">
                                <div style="font-size:.85rem;font-weight:600">${Fmt.esc(r.title)}</div>
                                ${dates ? `<div style="font-size:.72rem;color:var(--text-muted)">${dates}</div>` : ''}
                            </div>
                            ${AppState.isAdmin() ? `
                            <button onclick="CourseViewPage._editRunModal('${r.id}','${course.id}')" style="flex-shrink:0;padding:.2rem .4rem;border:none;background:transparent;color:var(--text-muted);cursor:pointer;border-radius:5px" title="Редагувати" onmouseenter="this.style.color='var(--primary)'" onmouseleave="this.style.color='var(--text-muted)'"><i class="fa-solid fa-pen-to-square" style="font-size:.75rem"></i></button>
                            <button onclick="CourseViewPage._deleteRun('${r.id}','${course.id}')" style="flex-shrink:0;padding:.2rem .4rem;border:none;background:transparent;color:var(--text-muted);cursor:pointer;border-radius:5px" title="Видалити" onmouseenter="this.style.color='var(--danger)'" onmouseleave="this.style.color='var(--text-muted)'"><i class="fa-solid fa-trash" style="font-size:.75rem"></i></button>
                            ` : `<i class="fa-solid fa-arrow-right" style="color:var(--text-muted);font-size:.75rem;flex-shrink:0"></i>`}
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        }

        // No active run
        if (enrolled) return adminBlock;
    },

    _renderEnrolledActions(course, pct) {
        return `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">
                <div style="display:flex;align-items:center;gap:.6rem">
                    <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#10b981,#0ea5e9);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <i class="fa-solid fa-circle-check" style="color:#fff;font-size:.9rem"></i>
                    </div>
                    <div style="font-weight:700;font-size:.9rem">Ви записані на курс</div>
                </div>
                <button onclick="CourseViewPage.unenroll('${course.id}')" style="font-size:.72rem;padding:.25rem .6rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:transparent;color:var(--text-muted);cursor:pointer" title="Відписатися">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>
            </div>`;
    },

    async unenroll(courseId) {
        const ok = await Modal.confirm({ message: 'Відписатися від курсу?', danger: true });
        if (!ok) return;
        Loader.show();
        try {
            await API.enrollments.unenroll(courseId);
            Toast.success('Ви відписались від курсу');
            this._enrolled = false;
            const container = document.getElementById('page-content');
            if (container) await this.init(container, { id: courseId, from: this._from });
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
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

            const renderUser = e => {
                const u = e.user;
                const c = colorFor(u.id);
                return `<div style="display:flex;align-items:center;gap:.55rem;padding:.35rem .2rem;border-radius:var(--radius-sm);transition:background .1s" onmouseover="this.style.background='var(--bg-raised)'" onmouseout="this.style.background=''">
                    <div style="width:28px;height:28px;border-radius:50%;background:${c}22;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;color:${c};flex-shrink:0;overflow:hidden">
                        ${u.avatar_url ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : Fmt.initials(u.full_name||'?')}
                    </div>
                    <div style="flex:1;min-width:0;overflow:hidden">
                        <div style="font-size:.78rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Fmt.esc(u.full_name||u.email)}</div>
                        ${u.city ? `<div style="font-size:.68rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><i class="fa-solid fa-location-dot" style="font-size:.6rem"></i> ${Fmt.esc(u.city)}</div>` : ''}
                    </div>
                </div>`;
            };

            // Filter by user's run for non-admins
            const userRunId = this._enrollmentRow?.run_id || null;
            const filteredData = AppState.isAdmin() ? data : (userRunId ? data.filter(e => e.run_id === userRunId) : data);

            // Group by run_id
            const allRuns = this._allRuns || [];
            const hasRuns = AppState.isAdmin() && allRuns.length > 0;
            let bodyHtml = '';

            if (hasRuns) {
                // Group enrollments by run
                const byRun = {};
                filteredData.forEach(e => {
                    const key = e.run_id || '__none__';
                    if (!byRun[key]) byRun[key] = [];
                    byRun[key].push(e);
                });

                // Render each run group
                allRuns.forEach(r => {
                    const group = byRun[r.id] || [];
                    if (!group.length) return;
                    bodyHtml += `
                    <div style="margin-bottom:.6rem">
                        <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);margin-bottom:.3rem;padding:.2rem 0;border-bottom:1px solid var(--border)">
                            <i class="fa-solid fa-rotate" style="margin-right:.3rem"></i>${Fmt.esc(r.title)}
                            <span style="margin-left:.4rem;font-weight:400">(${group.length})</span>
                        </div>
                        ${group.map(renderUser).join('')}
                    </div>`;
                });

                // Enrollments without a run
                const noRun = byRun['__none__'] || [];
                if (noRun.length) {
                    bodyHtml += `
                    <div style="margin-bottom:.6rem">
                        <div style="font-size:.7rem;font-weight:700;color:var(--text-muted);margin-bottom:.3rem;padding:.2rem 0;border-bottom:1px solid var(--border)">
                            Без групи <span style="font-weight:400">(${noRun.length})</span>
                        </div>
                        ${noRun.map(renderUser).join('')}
                    </div>`;
                }
            } else {
                bodyHtml = filteredData.map(renderUser).join('');
            }

            el.innerHTML = `
                <div style="border-top:1px solid var(--border);padding-top:.75rem">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem">
                        <span style="font-weight:700;font-size:.82rem;color:var(--text-muted)"><i class="fa-solid fa-users" style="margin-right:.35rem"></i>Записані</span>
                        <div style="display:flex;align-items:center;gap:.4rem">
                            <span style="font-size:.72rem;color:var(--text-muted);background:var(--bg-raised);padding:.1rem .5rem;border-radius:999px;font-weight:600">${filteredData.length}</span>
                            ${AppState.isAdmin() ? `<button onclick="CourseViewPage._resetEnrollees('${courseId}')" style="font-size:.7rem;padding:.15rem .5rem;border:1px solid var(--danger);border-radius:var(--radius-sm);background:transparent;color:var(--danger);cursor:pointer" title="Обнулити список записів"><i class="fa-solid fa-rotate-left"></i> Обнулити</button>` : ''}
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;max-height:300px;overflow-y:auto">${bodyHtml}</div>
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

    async enroll(courseId, runId = null) {
        Loader.show();
        try {
            await API.enrollments.enroll(courseId, runId || null);
            Toast.success('Записано!', 'Ви успішно записалися на курс');
            const container = document.getElementById('page-content');
            if (container) await CourseViewPage.init(container, { id: courseId, from: this._from });
            else Router.go('courses/' + courseId);
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

