// ================================================================
// EduFlow LMS — Сторінка перегляду курсу
// ================================================================

const CourseViewPage = {
    _course: null,
    _scheduleData: null,
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
            RecentlyViewed.track({ type: 'course', id: course.id, title: course.title, thumbnail: course.thumbnail_url || null, route: `courses/${course.id}`, color: '#6366f1', icon: 'fa-book-open' });
            ActivityTracker.track('course_open', { entity_type: 'course', entity_id: course.id, entity_title: course.title, page: `courses/${course.id}` });
            this._render(container, course, this._enrolled);
        } catch(e) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <h3>Курс не знайдено</h3>
                    <button class="btn btn-primary" onclick="Router.go('${fromExpert ? 'expert-path' : 'courses'}')" style="display:inline-flex;align-items:center;gap:.35rem"><i class="fa-solid fa-angle-left"></i> Назад</button>
                </div>`;
        }
    },

    _render(container, course, enrolled) {
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

            .cvt-wrap{display:flex;gap:1.5rem;min-height:380px}
            .cvt-timeline{width:210px;flex-shrink:0;padding:.5rem 0;border-right:1px solid var(--border);padding-right:1rem}
            .cvt-tl-header{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);padding-bottom:.6rem;border-bottom:1px solid var(--border);margin-bottom:.55rem;display:flex;align-items:center;gap:.4rem}
            .cvt-tl-list{display:flex;flex-direction:column;gap:.05rem}
            .cvt-tl-item{display:flex;align-items:stretch;gap:.55rem;padding:.4rem .45rem;border-radius:10px;cursor:pointer;transition:background .15s,box-shadow .15s}
            .cvt-tl-item:hover{background:var(--bg-raised)}
            .cvt-tl-item.active{background:rgba(99,102,241,.08);box-shadow:inset 0 0 0 1.5px rgba(99,102,241,.3)}
            .cvt-tl-node{display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:30px}
            .cvt-tl-dot{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:800;color:#fff;flex-shrink:0;position:relative;transition:transform .2s,box-shadow .18s}
            .cvt-tl-item.active .cvt-tl-dot{transform:scale(1.12)}
            .cvt-status-icon{position:absolute;bottom:-3px;right:-3px;width:13px;height:13px;border-radius:50%;border:2px solid var(--bg-surface);display:flex;align-items:center;justify-content:center;font-size:.42rem;color:#fff}
            .cvt-tl-line{flex:1;width:2px;background:var(--border);border-radius:1px;margin:.25rem 0;min-height:8px}
            .cvt-tl-info{flex:1;min-width:0;padding-top:.15rem}
            .cvt-tl-day{font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)}
            .cvt-tl-title{font-size:.8rem;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.3;margin-top:.05rem}
            .cvt-tl-badge{font-size:.6rem;font-weight:700;padding:.08rem .4rem;border-radius:999px;margin-top:.25rem;display:inline-block;letter-spacing:.02em}
            .cvt-panel{flex:1;min-width:0}
            @keyframes cvt-in{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:translateX(0)}}
            .cvt-panel-inner{animation:cvt-in .22s ease}
            .cvt-hero{border-radius:14px;padding:1.2rem 1.35rem;margin-bottom:1.1rem;display:flex;align-items:flex-start;gap:1rem;position:relative;overflow:hidden}
            .cvt-hero::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(0,0,0,.2) 0%,rgba(0,0,0,.04) 100%);pointer-events:none}
            .cvt-hero>*{position:relative;z-index:1}
            .cvt-hero-numwrap{width:56px;height:56px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.55rem;font-weight:900;color:rgba(255,255,255,.95);background:rgba(255,255,255,.18);backdrop-filter:blur(8px)}
            .cvt-hero-info{flex:1;min-width:0}
            .cvt-hero-num-label{font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.6);margin-bottom:.12rem}
            .cvt-hero-title{font-size:1.05rem;font-weight:800;color:#fff;line-height:1.25;margin-bottom:.5rem;text-shadow:0 1px 8px rgba(0,0,0,.25)}
            .cvt-hero-chips{display:flex;flex-wrap:wrap;gap:.35rem}
            .cvt-hero-chip{display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;font-weight:600;padding:.18rem .6rem;border-radius:20px;background:rgba(255,255,255,.18);color:rgba(255,255,255,.95);backdrop-filter:blur(6px)}
            .cvt-hero-status{position:absolute;top:.85rem;right:.85rem;font-size:.68rem;font-weight:700;padding:.2rem .6rem;border-radius:999px;backdrop-filter:blur(8px);z-index:2;letter-spacing:.03em;display:inline-flex;align-items:center;gap:.3rem}
            .cvt-hero-status.pass{background:rgba(16,185,129,.3);color:#6ee7b7;border:1px solid rgba(16,185,129,.5)}
            .cvt-hero-status.fail{background:rgba(239,68,68,.25);color:#fca5a5;border:1px solid rgba(239,68,68,.4)}
            .cvt-section{margin-bottom:.9rem}
            .cvt-section-label{display:flex;align-items:center;gap:.5rem;font-size:.67rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);margin-bottom:.55rem}
            .cvt-section-line{flex:1;height:1px;background:var(--border)}
            .cvt-topic-list{display:flex;flex-direction:column;gap:.4rem}
            .cvt-topic-item{display:flex;align-items:flex-start;gap:.7rem;padding:.6rem .8rem;background:var(--bg-raised);border-radius:10px;border:1px solid var(--border);transition:border-color .15s}
            .cvt-topic-item:hover{border-color:var(--primary)}
            .cvt-topic-num{width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;color:#fff;flex-shrink:0;margin-top:.05rem}
            .cvt-topic-name{font-size:.875rem;font-weight:600;color:var(--text-primary)}
            .cvt-topic-desc{font-size:.775rem;color:var(--text-secondary);margin-top:.15rem;line-height:1.45}
            .cvt-callout{display:flex;align-items:flex-start;gap:.7rem;padding:.8rem 1rem;border-radius:10px;background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.2);margin-bottom:.85rem}
            .cvt-callout-icon{width:28px;height:28px;border-radius:8px;background:rgba(99,102,241,.15);display:flex;align-items:center;justify-content:center;color:var(--primary);flex-shrink:0;font-size:.8rem;margin-top:.08rem}
            .cvt-callout-text{font-size:.82rem;color:var(--text-secondary);line-height:1.55}
            .cvt-test-card{display:flex;align-items:center;gap:.8rem;padding:.85rem 1rem;border-radius:12px;border:1.5px solid;cursor:pointer;transition:all .18s;font-family:inherit;width:100%;text-align:left;margin-bottom:.4rem;background:var(--bg-raised)}
            .cvt-test-card:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.1)}
            .cvt-test-card.neutral{border-color:rgba(245,158,11,.3);background:rgba(245,158,11,.05)}
            .cvt-test-card.pass{border-color:rgba(16,185,129,.4);background:rgba(16,185,129,.06)}
            .cvt-test-card.fail{border-color:rgba(239,68,68,.35);background:rgba(239,68,68,.06)}
            .cvt-test-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.85rem;flex-shrink:0}
            .cvt-test-info{flex:1;min-width:0}
            .cvt-test-title{font-size:.875rem;font-weight:700;color:var(--text-primary)}
            .cvt-test-hint{font-size:.72rem;color:var(--text-muted);margin-top:.1rem}
            .cvt-test-pct{font-size:.9rem;font-weight:800;flex-shrink:0}
            .cvt-test-pct.pass{color:#10b981}
            .cvt-test-pct.fail{color:#ef4444}
            .cvt-kb-list{display:flex;flex-wrap:wrap;gap:.4rem}
            .cvt-kb-chip{display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .75rem;border-radius:20px;border:1px solid var(--border);background:var(--bg-raised);color:var(--text-primary);text-decoration:none;font-size:.78rem;transition:all .15s;max-width:240px}
            .cvt-kb-chip:hover{border-color:var(--primary);background:rgba(99,102,241,.06);color:var(--primary)}
            .cvt-kb-chip-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        </style>

        <div style="display:grid;grid-template-columns:1fr 300px;gap:2rem;align-items:start">
            <div>
                ${AppState.isStaff() ? `
                <div class="cv-staff-bar" style="border-radius:var(--radius-lg) var(--radius-lg) 0 0;margin-bottom:0">
                    <button class="btn btn-ghost btn-sm" onclick="Router.go('analytics?course=${course.id}')"><i class="fa-solid fa-chart-bar"></i> Аналітика</button>
                    <button class="btn btn-ghost btn-sm" onclick="CourseViewPage.manageEnrollments('${course.id}')"><i class="fa-solid fa-users"></i> Стажери</button>
                    ${AppState.isAdmin() ? `<button class="btn btn-ghost btn-sm" onclick="CourseViewPage._openRunModal('${course.id}')"><i class="fa-solid fa-rotate"></i> Нова група</button>` : ''}
                    ${AppState.canMutate() ? `<button class="btn btn-ghost btn-sm" onclick="Router.go('admin?tab=courses&edit=${course.id}')"><i class="fa-solid fa-gear"></i> Налаштування</button>` : ''}
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
                        ${AppState.isStaff() && AppState.canMutate() ? `
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
                            ${AppState.isStaff() && AppState.canMutate() ? `<span onclick="event.stopPropagation();CourseViewPage._editCourseInfo('${course.id}')" style="position:absolute;top:6px;right:6px;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;color:var(--text-muted);border:1px solid var(--border);background:var(--bg-raised);transition:all .15s" onmouseenter="this.style.borderColor='var(--primary)';this.style.color='var(--primary)'" onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'"><i class="fa-solid fa-pen-to-square" style="font-size:.65rem"></i></span>` : ''}
                        </button>
                        <button class="cv-info-tab-btn" onclick="CourseViewPage._switchInfoTab('teachers')">
                            <span class="cv-tab-icon">🎓</span>
                            <span class="cv-tab-label">Викладачі</span>
                        </button>
                        ${course.schedule?.length || AppState.isStaff() ? `
                        <button class="cv-info-tab-btn" onclick="CourseViewPage._switchInfoTab('schedule')">
                            <span class="cv-tab-icon">📅</span>
                            <span class="cv-tab-label">Розклад</span>
                        </button>` : ''}
                        ${(course.course_info?.meet_url || AppState.isStaff()) ? `
                        <button class="cv-info-tab-btn" onclick="CourseViewPage._switchInfoTab('meet')" style="position:relative">
                            <span class="cv-tab-icon">🎥</span>
                            <span class="cv-tab-label">Онлайн лекція</span>
                            ${AppState.isStaff() && AppState.canMutate() ? `<span onclick="event.stopPropagation();CourseViewPage._editMeetUrl('${course.id}')" style="position:absolute;top:6px;right:6px;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;color:var(--text-muted);border:1px solid var(--border);background:var(--bg-raised);transition:all .15s" onmouseenter="this.style.borderColor='var(--primary)';this.style.color='var(--primary)'" onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'"><i class="fa-solid fa-pen-to-square" style="font-size:.65rem"></i></span>` : ''}
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
                        ${enrolled ? this._renderEnrolledActions(course) : ''}
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
                    ${((isMine && isStaff) || AppState.isAdmin()) && AppState.canMutate() ? `
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

        const joinBtn = isStaff && !myEntry && AppState.canMutate() ? `
            <button class="btn btn-secondary btn-sm" onclick="CourseViewPage._joinAsteacher('${courseId}')">
                <i class="fa-solid fa-chalkboard-user"></i> Я веду цей курс
            </button>` : '';

        const addBtn = AppState.isAdmin() ? `
            <button class="btn btn-ghost btn-sm" onclick="CourseViewPage._adminAddTeacher('${courseId}')">
                <i class="fa-solid fa-plus"></i> Додати викладача
            </button>` : '';

        if (!allSorted.length && !isStaff) return '';

        return `
            <div id="cv-teachers-block" class="card" style="margin-bottom:1.5rem">
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
            const { error: insErr } = await supabase.from('course_teachers').insert({ course_id: courseId, user_id: userId, label, is_active: true });
            if (insErr) { Toast.error('Помилка', insErr.message); return; }
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
        const canEdit      = AppState.isStaff() && AppState.canMutate();
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
            const { error: updErr } = await supabase.from('courses').update({ course_info: info }).eq('id', courseId);
            if (updErr) { Toast.error('Помилка збереження', updErr.message); return; }
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
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
                    <div>
                        <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Час початку</label>
                        <input id="cvrun-stime" class="form-control" type="time">
                    </div>
                    <div>
                        <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Час завершення</label>
                        <input id="cvrun-etime" class="form-control" type="time">
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
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">
                    <div>
                        <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Час початку</label>
                        <input id="cvrun-stime" class="form-control" type="time" value="${run.start_time?.slice(0,5) || ''}">
                    </div>
                    <div>
                        <label style="font-size:.82rem;font-weight:600;display:block;margin-bottom:.3rem">Час завершення</label>
                        <input id="cvrun-etime" class="form-control" type="time" value="${run.end_time?.slice(0,5) || ''}">
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
        const start_time = document.getElementById('cvrun-stime')?.value || null;
        const end_time   = document.getElementById('cvrun-etime')?.value || null;
        if (!title) { Toast.warning('Введіть назву групи'); return; }
        Loader.show();
        try {
            if (runId) {
                await API.courseRuns.update(runId, { title, start_date, end_date, start_time, end_time });
                this._syncRunCalendars(runId, { course_id: courseId, title, start_date, end_date, start_time, end_time }).catch(() => {});
            } else {
                await API.courseRuns.create(courseId, { title, start_date, end_date, start_time, end_time });
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

    async _editSchedule(courseId) {
        const el = document.getElementById('cv-info-tab-schedule');
        if (!el) return;
        el.innerHTML = `<div style="padding:1rem 0;text-align:center;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
        AdminPage._scheduleDays = (this._course?.schedule || []).map(d => ({
            ...d,
            items: [...(d.items || [])],
            tests: d.tests ? [...d.tests] : (d.test_id ? [{ id: d.test_id, title: d.test_title || '' }] : []),
            kb_resources: [...(d.kb_resources || [])]
        }));
        try {
            const [profRes, tests, kbRes] = await Promise.all([
                API.profiles.getAll({ pageSize: 500 }),
                API.tests.getAll(),
                API.resources.getAll({ pageSize: 500 })
            ]);
            AdminPage._scheduleProfiles = (profRes.data || []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'uk'));
            AdminPage._scheduleTests    = tests || [];
            AdminPage._scheduleKbAll    = kbRes.data || [];
        } catch(e) { AdminPage._scheduleProfiles = []; AdminPage._scheduleTests = []; AdminPage._scheduleKbAll = []; }
        el.innerHTML = `
        <div id="c-schedule-builder" style="display:flex;flex-direction:column;gap:.65rem"></div>
        <button type="button" class="btn btn-ghost btn-sm" style="margin-top:.35rem;width:100%;justify-content:center;border:1.5px dashed var(--border)"
            onclick="AdminPage._scheduleAddDay()">
            <i class="fa-solid fa-plus"></i> Додати день
        </button>
        <div style="display:flex;gap:.5rem;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
            <button class="btn btn-primary" onclick="CourseViewPage._saveSchedule('${courseId}')">
                <i class="fa-solid fa-floppy-disk"></i> Зберегти
            </button>
            <button class="btn btn-ghost" onclick="CourseViewPage._loadScheduleTab(CourseViewPage._course?.schedule||[])">Скасувати</button>
        </div>`;
        AdminPage._scheduleRender();
    },

    async _saveSchedule(courseId) {
        const schedule = AdminPage._scheduleDays.map(d => ({
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
            await this._loadScheduleTab(schedule);
            Toast.success('Збережено');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _kbIcon(type) {
        const map = { pdf:'fa-file-pdf', video:'fa-circle-play', link:'fa-link', scorm:'fa-cube', image:'fa-image', document:'fa-file-lines', file:'fa-file' };
        return map[type] || 'fa-file';
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
        if (testIds.length) {
            await Promise.all(testIds.map(async id => {
                try {
                    const list = await API.attempts.getByTest(id);
                    const completed = (list || []).filter(a => a.completed_at);
                    const best = completed.sort((a, b) => (b.passed ? 1 : 0) - (a.passed ? 1 : 0) || b.percentage - a.percentage)[0];
                    if (best) attemptsMap[id] = best;
                } catch {}
            }));
        }
        const courseId = this._course?.id || '';
        el.innerHTML = (AppState.isStaff() && AppState.canMutate() ? `
            <div style="display:flex;justify-content:flex-end;margin-bottom:.75rem">
                <button class="btn btn-ghost btn-sm" onclick="CourseViewPage._editSchedule('${courseId}')">
                    <i class="fa-solid fa-pen-to-square"></i> Редагувати
                </button>
            </div>` : '') + this._renderScheduleCards(schedule, attemptsMap);
    },

    _renderScheduleCards(schedule, attemptsMap = {}) {
        const dayColors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#0ea5e9'];
        this._scheduleData = { schedule, attemptsMap, dayColors };
        const n = schedule.length;
        const label = n === 1 ? '1 день' : n < 5 ? n + ' дні' : n + ' днів';

        const timelineItems = schedule.map((d, i) => {
            const color = dayColors[i % dayColors.length];
            const tests = d.tests?.length ? d.tests : (d.test_id ? [{ id: d.test_id, title: d.test_title || 'Тест дня' }] : []);
            const attempted = tests.filter(t => attemptsMap[t.id]);
            const allPassed = tests.length > 0 && attempted.length === tests.length && attempted.every(t => attemptsMap[t.id].passed);
            const anyFailed = attempted.some(t => !attemptsMap[t.id].passed);

            const statusIcon = allPassed
                ? `<span class="cvt-status-icon" style="background:#10b981"><i class="fa-solid fa-check"></i></span>`
                : anyFailed
                ? `<span class="cvt-status-icon" style="background:#ef4444"><i class="fa-solid fa-xmark"></i></span>`
                : '';
            const badge = allPassed
                ? `<span class="cvt-tl-badge" style="background:rgba(16,185,129,.12);color:#10b981"><i class="fa-solid fa-trophy" style="font-size:.55rem"></i> Пройдено</span>`
                : anyFailed
                ? `<span class="cvt-tl-badge" style="background:rgba(239,68,68,.1);color:#ef4444"><i class="fa-solid fa-rotate-right" style="font-size:.55rem"></i> Повторити</span>`
                : '';
            const isLast = i === schedule.length - 1;

            return `
            <div class="cvt-tl-item${i === 0 ? ' active' : ''}" onclick="CourseViewPage._cvsDayOpen(${i})">
                <div class="cvt-tl-node">
                    <div class="cvt-tl-dot" style="background:${color}">${i + 1}${statusIcon}</div>
                    ${!isLast ? '<div class="cvt-tl-line"></div>' : ''}
                </div>
                <div class="cvt-tl-info">
                    <div class="cvt-tl-day">День ${i + 1}</div>
                    ${d.title ? `<div class="cvt-tl-title">${Fmt.esc(d.title)}</div>` : ''}
                    ${badge}
                </div>
            </div>`;
        }).join('');

        return `
        <div class="cvt-wrap">
            <div class="cvt-timeline">
                <div class="cvt-tl-header"><i class="fa-solid fa-route"></i> Програма • ${label}</div>
                <div class="cvt-tl-list">${timelineItems}</div>
            </div>
            <div class="cvt-panel" id="cvt-panel">${this._dayCardHtml(0)}</div>
        </div>`;
    },

    _dayCardHtml(idx) {
        const { schedule, attemptsMap, dayColors } = this._scheduleData || {};
        const d = schedule?.[idx];
        if (!d) return '';
        const color = dayColors[idx % dayColors.length];
        const tests = d.tests?.length ? d.tests : (d.test_id ? [{ id: d.test_id, title: d.test_title || 'Тест дня' }] : []);
        const attempted = tests.filter(t => attemptsMap[t.id]);
        const allPassed = tests.length > 0 && attempted.length === tests.length && attempted.every(t => attemptsMap[t.id].passed);
        const anyFailed = attempted.some(t => !attemptsMap[t.id].passed);

        const statusHtml = allPassed
            ? `<span class="cvt-hero-status pass"><i class="fa-solid fa-trophy"></i> Завершено</span>`
            : anyFailed
            ? `<span class="cvt-hero-status fail"><i class="fa-solid fa-rotate-right"></i> Повторити тест</span>`
            : '';

        const topicsHtml = d.items?.length ? `
            <div class="cvt-section">
                <div class="cvt-section-label">
                    <i class="fa-solid fa-list-check" style="color:${color}"></i> Теми заняття
                    <div class="cvt-section-line"></div>
                </div>
                <div class="cvt-topic-list">
                    ${d.items.map((item, ti) => {
                        const t = typeof item === 'object' ? item : { title: item, desc: '' };
                        return `<div class="cvt-topic-item">
                            <div class="cvt-topic-num" style="background:${color}">${ti + 1}</div>
                            <div>
                                <div class="cvt-topic-name">${Fmt.esc(t.title || '')}</div>
                                ${t.desc ? `<div class="cvt-topic-desc">${Fmt.esc(t.desc)}</div>` : ''}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>` : '';

        const noteHtml = d.instructions ? `
            <div class="cvt-callout">
                <div class="cvt-callout-icon"><i class="fa-solid fa-circle-info"></i></div>
                <div class="cvt-callout-text">${Fmt.esc(d.instructions)}</div>
            </div>` : '';

        const testsHtml = tests.length ? `
            <div class="cvt-section">
                <div class="cvt-section-label">
                    <i class="fa-solid fa-pen-to-square" style="color:#f59e0b"></i> Тест до заняття
                    <div class="cvt-section-line"></div>
                </div>
                ${tests.map(t => {
                    const att = attemptsMap[t.id];
                    const done = !!att;
                    const passed = att?.passed;
                    const pct = att?.percentage ?? 0;
                    const cardCls = done ? (passed ? 'pass' : 'fail') : 'neutral';
                    const iconBg = done
                        ? `background:linear-gradient(135deg,${passed ? '#10b981,#0ea5e9' : '#ef4444,#f59e0b'})`
                        : 'background:linear-gradient(135deg,#f59e0b,#ef4444)';
                    const iconName = done ? (passed ? 'fa-circle-check' : 'fa-circle-xmark') : 'fa-pen-to-square';
                    const resultHtml = done
                        ? `<span class="cvt-test-pct ${passed ? 'pass' : 'fail'}">${Math.round(pct)}%</span>`
                        : `<i class="fa-solid fa-chevron-right" style="color:var(--text-muted);font-size:.75rem;flex-shrink:0"></i>`;
                    return `<button class="cvt-test-card ${cardCls}" onclick="Router.go('tests/${t.id}')">
                        <div class="cvt-test-icon" style="${iconBg}"><i class="fa-solid ${iconName}"></i></div>
                        <div class="cvt-test-info">
                            <div class="cvt-test-title">${Fmt.esc(t.title || 'Тест дня')}</div>
                            <div class="cvt-test-hint">${done ? (passed ? 'Пройдено · ' + Math.round(pct) + '%' : 'Не пройдено · ' + Math.round(pct) + '%') : 'Пройдіть після лекції'}</div>
                        </div>
                        ${resultHtml}
                    </button>`;
                }).join('')}
            </div>` : '';

        const kbHtml = d.kb_resources?.length ? `
            <div class="cvt-section">
                <div class="cvt-section-label">
                    <i class="fa-solid fa-paperclip" style="color:#6366f1"></i> Матеріали
                    <div class="cvt-section-line"></div>
                </div>
                <div class="cvt-kb-list">
                    ${d.kb_resources.map(r => `
                    <a href="#" onclick="event.preventDefault();Router.go('resource/${r.id}')" class="cvt-kb-chip">
                        <i class="fa-solid ${this._kbIcon(r.type)}" style="color:var(--primary);font-size:.72rem;flex-shrink:0"></i>
                        <span class="cvt-kb-chip-name">${Fmt.esc(r.title)}</span>
                    </a>`).join('')}
                </div>
            </div>` : '';

        return `<div class="cvt-panel-inner">
            <div class="cvt-hero" style="background:${color}">
                ${statusHtml}
                <div class="cvt-hero-numwrap">${idx + 1}</div>
                <div class="cvt-hero-info">
                    <div class="cvt-hero-num-label">День ${idx + 1}</div>
                    <div class="cvt-hero-title">${d.title ? Fmt.esc(d.title) : 'Заняття'}</div>
                    <div class="cvt-hero-chips">
                        ${d.teacher_name ? `<span class="cvt-hero-chip"><i class="fa-solid fa-chalkboard-user"></i> ${Fmt.esc(d.teacher_name)}</span>` : ''}
                        ${d.time_range ? `<span class="cvt-hero-chip"><i class="fa-regular fa-clock"></i> ${Fmt.esc(d.time_range)}</span>` : ''}
                    </div>
                </div>
            </div>
            ${topicsHtml}${noteHtml}${testsHtml}${kbHtml}
        </div>`;
    },

    _cvsDayOpen(idx) {
        document.querySelectorAll('.cvt-tl-item').forEach((el, i) => el.classList.toggle('active', i === idx));
        const panel = document.getElementById('cvt-panel');
        if (panel) panel.innerHTML = this._dayCardHtml(idx);
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
                    <i class="fa-regular fa-calendar"></i> ${fmtDate(run.start_date)}${run.start_date && run.end_date ? ' — ' : ''}${fmtDate(run.end_date)}
                    ${ended ? '<span style="color:#ef4444;margin-left:.4rem">• Завершено</span>' : ''}
                </div>` : ''}
                ${run.start_time ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:.1rem">
                    <i class="fa-regular fa-clock"></i> ${run.start_time.slice(0,5)}${run.end_time ? ' — ' + run.end_time.slice(0,5) : ''}
                </div>` : ''}
                <button onclick="CourseViewPage.unenroll('${course.id}')"
                    style="margin-top:.6rem;width:100%;padding:.35rem;border:1px solid rgba(239,68,68,.3);border-radius:8px;background:rgba(239,68,68,.06);color:#ef4444;font-size:.75rem;cursor:pointer;transition:background .15s"
                    onmouseenter="this.style.background='rgba(239,68,68,.14)'" onmouseleave="this.style.background='rgba(239,68,68,.06)'">
                    <i class="fa-solid fa-arrow-right-from-bracket"></i> Відписатися
                </button>
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

    _renderEnrolledActions(course) {
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
                            ${AppState.isStaff() && AppState.canMutate() ? `
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
            // Add calendar events for the course run
            const run = runId
                ? (this._allRuns || []).find(r => r.id === runId)
                : this._activeRun;
            if (run?.start_date) {
                const cur = new Date(run.start_date + 'T00:00:00');
                const end = run.end_date ? new Date(run.end_date + 'T00:00:00') : new Date(run.start_date + 'T00:00:00');
                let days = 0;
                while (cur <= end) { days++; cur.setDate(cur.getDate() + 1); }
                this._addCourseCalEvent(run).catch(() => {});
                const daysLabel = days === 1 ? 'день' : days < 5 ? 'дні' : 'днів';
                Modal.open({
                    size: 'sm',
                    body: `
                    <div style="text-align:center;padding:1rem .5rem 0">
                        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#8b5cf6);display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;font-size:1.8rem;box-shadow:0 8px 24px rgba(99,102,241,.35)">✅</div>
                        <div style="font-size:1.15rem;font-weight:700;margin-bottom:.4rem">Ви записані на курс!</div>
                        <div style="font-size:.88rem;color:var(--text-muted);margin-bottom:1.5rem">${Fmt.esc(this._course?.title || '')}</div>
                        <div style="display:flex;gap:.75rem;margin-bottom:1.5rem">
                            <div style="flex:1;background:var(--bg-raised);border:1px solid var(--border);border-radius:12px;padding:.9rem .75rem">
                                <div style="font-size:1.5rem;font-weight:800;color:var(--primary);line-height:1">${days}</div>
                                <div style="font-size:.75rem;color:var(--text-muted);margin-top:.25rem">${daysLabel} навчання</div>
                            </div>
                            <div style="flex:2;background:var(--bg-raised);border:1px solid var(--border);border-radius:12px;padding:.9rem .75rem;display:flex;align-items:center;gap:.6rem;text-align:left">
                                <i class="fa-regular fa-calendar-check" style="font-size:1.3rem;color:var(--primary);flex-shrink:0"></i>
                                <div style="font-size:.8rem;color:var(--text-muted);line-height:1.4">Додано до вашого <strong style="color:var(--text-primary)">Календаря</strong></div>
                            </div>
                        </div>
                        <div style="display:flex;gap:.6rem">
                            <button class="btn btn-primary" style="flex:1;padding:.75rem" onclick="Modal.close()">OK</button>
                            <button class="btn btn-ghost" style="flex:1;padding:.75rem" onclick="Modal.close();Router.go('my-calendar')"><i class="fa-regular fa-calendar-days"></i> Мій календар</button>
                        </div>
                    </div>`,
                });
            } else {
                Modal.open({
                    size: 'sm',
                    body: `
                    <div style="text-align:center;padding:1rem .5rem 0">
                        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#8b5cf6);display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;font-size:1.8rem;box-shadow:0 8px 24px rgba(99,102,241,.35)">✅</div>
                        <div style="font-size:1.15rem;font-weight:700;margin-bottom:.4rem">Ви записані на курс!</div>
                        <div style="font-size:.88rem;color:var(--text-muted);margin-bottom:1.5rem">${Fmt.esc(this._course?.title || '')}</div>
                        <button class="btn btn-primary" style="width:100%;padding:.75rem" onclick="Modal.close()">OK</button>
                    </div>`,
                });
            }
            const container = document.getElementById('page-content');
            if (container) await CourseViewPage.init(container, { id: courseId, from: this._from });
            else Router.go('courses/' + courseId);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _addCourseCalEvent(run) {
        if (!run?.start_date) return;
        const title = `📚 ${this._course?.title || 'Курс'}`;

        // Build list of all dates in the run range
        const dates = [];
        const pad = n => String(n).padStart(2, '0');
        const fmtLocal = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        const cur = new Date(run.start_date + 'T00:00:00');
        const end = run.end_date ? new Date(run.end_date + 'T00:00:00') : new Date(run.start_date + 'T00:00:00');
        while (cur <= end) {
            dates.push(fmtLocal(cur));
            cur.setDate(cur.getDate() + 1);
        }

        // Fetch already existing events for this title in the range to dedup
        const { data: existing } = await supabase.from('personal_cal_events')
            .select('date')
            .eq('user_id', AppState.user.id)
            .eq('title', title)
            .gte('date', dates[0])
            .lte('date', dates[dates.length - 1]);
        const existingSet = new Set((existing || []).map(e => e.date));

        const toInsert = dates
            .map((d, idx) => ({ d, dayNum: idx + 1 }))
            .filter(({ d }) => !existingSet.has(d))
            .map(({ d, dayNum }) => ({
                user_id:      AppState.user.id,
                title,
                date:         d,
                time:         run.start_time || null,
                end_time:     run.end_time   || null,
                notes:        (() => { const topic = (this._course?.schedule || [])[dayNum - 1]?.title; return `День ${dayNum}${topic ? ': ' + topic : ''}`; })(),
                color:        '#6366f1',
                repeat_type:  'none',
                is_important: true,
            }));

        if (toInsert.length) {
            await supabase.from('personal_cal_events').insert(toInsert);
        }
    },

    // Called after run date/time update — rebuilds calendar events for all participants
    async _syncRunCalendars(runId, newRun) {
        if (!newRun.start_date) return;

        // Fetch course for title + schedule
        const { data: course } = await supabase.from('courses')
            .select('id, title, schedule').eq('id', newRun.course_id).maybeSingle();
        if (!course) return;

        const courseTitle = `📚 ${course.title}`;
        const schedule = course.schedule || [];

        // Build new date list
        const pad = n => String(n).padStart(2, '0');
        const fmtLocal = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        const dates = [];
        const cur = new Date(newRun.start_date + 'T00:00:00');
        const end = newRun.end_date ? new Date(newRun.end_date + 'T00:00:00') : new Date(newRun.start_date + 'T00:00:00');
        while (cur <= end) { dates.push(fmtLocal(cur)); cur.setDate(cur.getDate() + 1); }

        // Get active (non-completed) participants of this run
        const { data: enrollments } = await supabase.from('enrollments')
            .select('user_id').eq('run_id', runId).is('completed_at', null);
        if (!enrollments?.length) return;

        const userIds = enrollments.map(e => e.user_id);

        // Rebuild calendar events and send notifications for each participant
        const notifs = [];
        for (const userId of userIds) {
            await supabase.from('personal_cal_events')
                .delete().eq('user_id', userId).eq('title', courseTitle);

            const events = dates.map((d, idx) => {
                const topic = schedule[idx]?.title;
                return {
                    user_id:      userId,
                    title:        courseTitle,
                    date:         d,
                    time:         newRun.start_time || null,
                    end_time:     newRun.end_time   || null,
                    notes:        `День ${idx + 1}${topic ? ': ' + topic : ''}`,
                    color:        '#6366f1',
                    repeat_type:  'none',
                    is_important: true,
                };
            });
            if (events.length) await supabase.from('personal_cal_events').insert(events);

            notifs.push({
                user_id:    userId,
                title:      '📅 Розклад курсу змінено',
                message:    `Дати групи курсу «${course.title}» були оновлені адміністратором. Ваш календар оновлено автоматично.`,
                type:       'general',
                created_by: AppState.user.id,
            });
        }

        if (notifs.length) {
            await supabase.from('notifications').insert(notifs).catch(() => {});
            UI.loadNotificationCount?.();
        }
    },

    async unenroll(courseId) {
        const ok = await Modal.confirm({ title: 'Відписатися від курсу?', message: 'Ваш прогрес збережеться, але події курсу буде видалено з календаря.', confirmText: 'Відписатися', danger: true });
        if (!ok) return;
        Loader.show();
        try {
            await API.enrollments.unenroll(courseId);
            // Remove course calendar events
            const title = `📚 ${this._course?.title || ''}`;
            await supabase.from('personal_cal_events')
                .delete()
                .eq('user_id', AppState.user.id)
                .eq('title', title);
            Toast.success('Відписано', 'Ви відписалися від курсу');
            const container = document.getElementById('page-content');
            if (container) await CourseViewPage.init(container, { id: courseId, from: this._from });
            else Router.go('courses/' + courseId);
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
                                        <td><strong>${Fmt.esc(e.user?.full_name || '—')}</strong></td>
                                        <td style="color:var(--text-muted)">${Fmt.esc(e.user?.email || '—')}</td>
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

