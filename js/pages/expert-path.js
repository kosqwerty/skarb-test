const ExpertPathPage = {
    _tab:           'courses',
    _courseSubTab:  'all',
    _coursesData:   null,
    _courseTabs:    null,
    _courseCardsFn: null,

    async init(container) {
        UI.setBreadcrumb([{ label: 'Skill Up' }]);
        this._tab          = 'courses';
        this._courseSubTab = 'all';
        this._coursesData  = null;
        this._renderShell(container);
        await this._loadTab('courses');
        this._fetchAndShowCounts();
    },

    async _fetchAndShowCounts() {
        try {
            const uid = AppState.user.id;
            const [enrRes, testRes, survRes] = await Promise.all([
                supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('user_id', uid),
                supabase.from('test_assignments').select('id', { count: 'exact', head: true }).eq('user_id', uid),
                supabase.from('survey_responses').select('id', { count: 'exact', head: true }).eq('user_id', uid),
            ]);
            this._updateTabBadges({
                courses: enrRes.count  || 0,
                tests:   testRes.count || 0,
                surveys: survRes.count || 0,
            });
        } catch(e) {}
    },

    _updateTabBadges(counts) {
        Object.entries(counts).forEach(([tab, n]) => {
            const el = document.querySelector(`.ep-tab[data-tab="${tab}"] .ep-tab-count`);
            if (el) this._animateCount(el, n);
        });
    },

    _animateCount(el, target) {
        const n = parseInt(target);
        if (isNaN(n) || n <= 0) { el.textContent = isNaN(n) ? target : n; return; }
        let current = 0;
        const steps = 28;
        const inc = n / steps;
        const timer = setInterval(() => {
            current = Math.min(current + inc, n);
            el.textContent = Math.round(current);
            if (current >= n) clearInterval(timer);
        }, 600 / steps);
    },

    _renderShell(container) {
        container.innerHTML = `
<style>
.ep-wrap{max-width:1100px}

/* ── Hero ────────────────────────────────────────────────────── */
.ep-hero{
    position:relative;overflow:hidden;
    border-radius:24px;padding:40px 44px;margin-bottom:28px;
    background:linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#4338ca 72%,#7c3aed 100%);
    color:#fff
}
.ep-hero-orb{
    position:absolute;border-radius:50%;
    background:rgba(255,255,255,.07);pointer-events:none
}
.ep-hero-orb-1{width:300px;height:300px;top:-90px;right:-70px}
.ep-hero-orb-2{width:180px;height:180px;bottom:-80px;right:150px}
.ep-hero-orb-3{width:90px;height:90px;top:30px;right:250px;background:rgba(255,255,255,.04)}
.ep-hero-body{position:relative;z-index:1}
.ep-hero-tag{
    display:inline-flex;align-items:center;gap:6px;
    background:rgba(255,255,255,.15);backdrop-filter:blur(10px);
    border:1px solid rgba(255,255,255,.22);border-radius:20px;
    padding:4px 14px;font-size:.72rem;font-weight:700;
    letter-spacing:.07em;text-transform:uppercase;margin-bottom:14px;
    color:rgba(255,255,255,.9)
}
.ep-hero-sub{
    font-size:.93rem;color:rgba(255,255,255,.68);
    margin:0;max-width:580px;line-height:1.55
}
.ep-hero-deco{
    position:absolute;right:44px;top:50%;transform:translateY(-50%);
    font-size:6rem;opacity:.1;z-index:0;pointer-events:none;
    animation:ep-float 4s ease-in-out infinite
}
@keyframes ep-float{0%,100%{transform:translateY(-50%) rotate(-4deg)}50%{transform:translateY(calc(-50% - 10px)) rotate(4deg)}}

/* ── Tab cards ───────────────────────────────────────────────── */
.ep-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px}

.ep-tab{
    position:relative;overflow:hidden;
    padding:22px 20px 20px;border-radius:20px;
    border:2px solid var(--border);
    background:var(--bg-surface);
    cursor:pointer;text-align:left;
    transition:all .25s cubic-bezier(.4,0,.2,1);
    display:flex;flex-direction:column;gap:0
}
.ep-tab::before{
    content:'';position:absolute;inset:0;
    border-radius:18px;opacity:0;transition:opacity .25s
}
.ep-tab[data-tab="courses"]::before{background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.ep-tab[data-tab="tests"]::before  {background:linear-gradient(135deg,#3b82f6,#06b6d4)}
.ep-tab[data-tab="surveys"]::before{background:linear-gradient(135deg,#10b981,#14b8a6)}

.ep-tab:hover:not(.active){transform:translateY(-3px);box-shadow:0 8px 30px rgba(0,0,0,.1)}
.ep-tab[data-tab="courses"]:hover:not(.active){border-color:#6366f1}
.ep-tab[data-tab="tests"]:hover:not(.active)  {border-color:#3b82f6}
.ep-tab[data-tab="surveys"]:hover:not(.active){border-color:#10b981}

.ep-tab.active{border-color:transparent;color:#fff;transform:translateY(-3px)}
.ep-tab.active::before{opacity:1}
.ep-tab[data-tab="courses"].active{box-shadow:0 10px 36px rgba(99,102,241,.45)}
.ep-tab[data-tab="tests"].active  {box-shadow:0 10px 36px rgba(59,130,246,.45)}
.ep-tab[data-tab="surveys"].active{box-shadow:0 10px 36px rgba(16,185,129,.45)}

.ep-tab-icon-wrap{
    font-size:1.4rem;margin-bottom:14px;
    position:relative;z-index:1;transition:color .25s
}
.ep-tab[data-tab="courses"] .ep-tab-icon-wrap{color:#6366f1}
.ep-tab[data-tab="tests"] .ep-tab-icon-wrap  {color:#3b82f6}
.ep-tab[data-tab="surveys"] .ep-tab-icon-wrap{color:#10b981}
.ep-tab.active .ep-tab-icon-wrap{color:#fff!important}

.ep-tab-count{
    font-size:2.5rem;font-weight:900;line-height:1;
    color:var(--text-primary);letter-spacing:-.04em;
    transition:color .25s;position:relative;z-index:1;margin-bottom:4px
}
.ep-tab-label{
    font-size:.7rem;font-weight:700;text-transform:uppercase;
    letter-spacing:.07em;color:var(--text-muted);
    transition:color .25s;position:relative;z-index:1
}
.ep-tab.active .ep-tab-count,
.ep-tab.active .ep-tab-label{color:#fff}

/* ── Sub-tabs ─────────────────────────────────────────────────── */
.ep-sub-tabs{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
.ep-sub-tab{
    padding:7px 18px;border-radius:50px;
    border:1.5px solid var(--border);
    background:var(--bg-surface);color:var(--text-muted);
    font-size:.8rem;font-weight:600;cursor:pointer;transition:all .18s
}
.ep-sub-tab:hover{border-color:#6366f1;color:#6366f1}
.ep-sub-tab.active{background:#6366f1;color:#fff;border-color:#6366f1}

/* ── Course grid ─────────────────────────────────────────────── */
.ep-course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.ep-course-card{
    background:var(--bg-surface);border:1px solid var(--border);
    border-radius:18px;overflow:hidden;cursor:pointer;
    transition:all .25s cubic-bezier(.4,0,.2,1);
    display:flex;flex-direction:column
}
.ep-course-card:hover{
    transform:translateY(-5px);
    box-shadow:0 16px 48px rgba(0,0,0,.15);
    border-color:transparent
}
.ep-course-thumb{height:148px;flex-shrink:0;overflow:hidden;position:relative;background:#0f0c29;border-radius:18px 18px 0 0}
.ep-course-thumb-bg{position:absolute;inset:-8px;background-size:cover;background-position:center;filter:blur(12px) brightness(.4);transform:scale(1.05);transition:transform .35s}
.ep-course-thumb-main{position:absolute;inset:0;background-size:contain;background-repeat:no-repeat;background-position:center;z-index:1;transition:transform .35s}
.ep-course-card:hover .ep-course-thumb-bg,.ep-course-card:hover .ep-course-thumb-main{transform:scale(1.06)}
.ep-course-body{padding:16px;flex:1;display:flex;flex-direction:column;gap:4px}
.ep-course-title{
    font-weight:700;font-size:.9rem;color:var(--text-primary);
    line-height:1.4;margin-bottom:2px;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden
}
.ep-course-teacher{font-size:.73rem;color:var(--text-muted);margin-bottom:8px}
.ep-prog-bar{height:4px;border-radius:4px;background:var(--border);overflow:hidden;margin-bottom:5px}
.ep-prog-fill{
    height:100%;border-radius:4px;
    background:linear-gradient(90deg,#6366f1,#8b5cf6);
    transition:width .6s ease
}
.ep-prog-fill.done{background:linear-gradient(90deg,#10b981,#14b8a6)}
.ep-prog-label{font-size:.7rem;color:var(--text-muted)}
.ep-prog-label.done{color:#10b981;font-weight:600}

/* ── Results stats ───────────────────────────────────────────── */
.ep-res-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.ep-res-stat{
    border-radius:18px;padding:22px 20px;color:#fff;
    display:flex;flex-direction:column;gap:4px
}

/* ── Fade-in ─────────────────────────────────────────────────── */
@keyframes ep-fadein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
#ep-content>*{animation:ep-fadein .28s ease}

/* ── Empty ───────────────────────────────────────────────────── */
.ep-empty{display:flex;flex-direction:column;align-items:center;padding:64px 24px;gap:12px;text-align:center}
.ep-empty-icon{
    width:72px;height:72px;border-radius:50%;background:var(--bg-hover);
    display:flex;align-items:center;justify-content:center;
    font-size:1.8rem;color:var(--text-muted);margin-bottom:8px
}
.ep-empty-title{font-size:1rem;font-weight:700;color:var(--text-primary)}
.ep-empty-sub{font-size:.85rem;color:var(--text-muted)}

@media(max-width:680px){
    .ep-tabs{grid-template-columns:repeat(2,1fr)!important}
    .ep-hero{padding:28px 24px}
    .ep-hero-deco{display:none}
    .ep-res-stats{grid-template-columns:repeat(2,1fr)}
}
</style>
<div class="ep-wrap">
    <div class="ep-hero">
        <div class="ep-hero-orb ep-hero-orb-1"></div>
        <div class="ep-hero-orb ep-hero-orb-2"></div>
        <div class="ep-hero-orb ep-hero-orb-3"></div>
        <div class="ep-hero-body">
            <div class="ep-hero-tag"><i class="fa-solid fa-star"></i>&nbsp; Skill Up</div>
            <p class="ep-hero-sub">Продовжуй навчатися — кожен крок робить тебе кращим спеціалістом</p>
        </div>
        <div class="ep-hero-deco"><i class="fa-solid fa-graduation-cap"></i></div>
    </div>
    <div class="ep-tabs">
        <button class="ep-tab active" data-tab="courses" onclick="ExpertPathPage.switchTab('courses',this)">
            <div class="ep-tab-icon-wrap"><i class="fa-solid fa-graduation-cap"></i></div>
            <div class="ep-tab-count">—</div>
            <span class="ep-tab-label">Мої курси</span>
        </button>
        <button class="ep-tab" data-tab="tests" onclick="ExpertPathPage.switchTab('tests',this)">
            <div class="ep-tab-icon-wrap"><i class="fa-solid fa-clipboard-list"></i></div>
            <div class="ep-tab-count">—</div>
            <span class="ep-tab-label">Мої тести</span>
        </button>
        <button class="ep-tab" data-tab="surveys" onclick="ExpertPathPage.switchTab('surveys',this)">
            <div class="ep-tab-icon-wrap"><i class="fa-solid fa-square-poll-horizontal"></i></div>
            <div class="ep-tab-count">0</div>
            <span class="ep-tab-label">Мої опитування</span>
        </button>
    </div>
    <div id="ep-content"></div>
</div>`;
    },

    async switchTab(tab, btn) {
        this._tab = tab;
        document.querySelectorAll('.ep-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        await this._loadTab(tab);
    },

    async _loadTab(tab) {
        const area = document.getElementById('ep-content');
        if (!area) return;
        area.innerHTML = '<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>';
        try {
            if      (tab === 'courses') await this._renderCourses(area);
            else if (tab === 'tests')   await this._renderTests(area);
            else                        this._renderSurveys(area);
        } catch(e) {
            area.innerHTML = `<div class="ep-empty"><div class="ep-empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="ep-empty-title">${Fmt.esc(e.message)}</div></div>`;
        }
    },

    // ── Курси ─────────────────────────────────────────────────────────
    async _renderCourses(area) {
        const [{ data: allCourses }, enrollments] = await Promise.all([
            API.courses.getAll({ published: true, pageSize: 500 }),
            API.enrollments.getMyEnrollments()
        ]);

        this._updateTabBadges({ courses: enrollments.length });

        const enrolledMap = new Map(enrollments.map(e => [e.course_id, e]));
        const completed   = enrollments.filter(e => e.completed_at);

        const grads = [
            'linear-gradient(135deg,#6366f1,#8b5cf6)',
            'linear-gradient(135deg,#3b82f6,#06b6d4)',
            'linear-gradient(135deg,#10b981,#14b8a6)',
            'linear-gradient(135deg,#f59e0b,#ef4444)',
            'linear-gradient(135deg,#ec4899,#8b5cf6)',
            'linear-gradient(135deg,#14b8a6,#3b82f6)',
        ];

        const cardsFn = (courses) => {
            if (!courses.length) return `
                <div class="ep-empty">
                    <div class="ep-empty-icon"><i class="fa-solid fa-graduation-cap"></i></div>
                    <div class="ep-empty-title">Курсів поки немає</div>
                    <div class="ep-empty-sub">Запишіться на перший курс і починайте навчатися</div>
                </div>`;
            return `<div class="ep-course-grid">${courses.map((c, i) => {
                const enr  = enrolledMap.get(c.id);
                const pct  = enr?.progress_percentage || 0;
                const done = !!enr?.completed_at;
                const thumb = c.thumbnail_url
                    ? `<div class="ep-course-thumb-bg" style="background-image:url('${c.thumbnail_url}')"></div>
                       <div class="ep-course-thumb-main" style="background-image:url('${c.thumbnail_url}')"></div>`
                    : `<div style="position:absolute;inset:0;background:${grads[i%grads.length]};display:flex;align-items:center;justify-content:center">
                           <i class="fa-solid fa-graduation-cap" style="font-size:2.5rem;color:rgba(255,255,255,.25)"></i>
                       </div>`;
                const footer = enr
                    ? `<div style="font-size:.7rem;color:${done?'#10b981':'var(--text-muted)'};margin-top:auto;font-weight:${done?'600':'400'}">
                           ${done ? '<i class="fa-solid fa-circle-check"></i> Завершено' : '<i class="fa-regular fa-circle-dot"></i> Записаний'}
                       </div>`
                    : `<div style="font-size:.7rem;color:var(--text-muted);margin-top:auto">
                           <i class="fa-regular fa-circle"></i> Не записаний
                       </div>`;
                return `
                <div class="ep-course-card" onclick="Router.go('courses/${c.id}?from=expert-path')">
                    <div class="ep-course-thumb">${thumb}</div>
                    <div class="ep-course-body">
                        <div class="ep-course-title">${Fmt.esc(c.title)}</div>
                        <div class="ep-course-teacher">${Fmt.esc(c.teacher?.full_name || '')}</div>
                        ${footer}
                    </div>
                </div>`;
            }).join('')}</div>`;
        };

        this._coursesData  = { allCourses: allCourses || [], enrollments, completed, enrolledMap };
        this._courseCardsFn = cardsFn;
        this._courseTabs   = [
            { id: 'all',      label: `Всі (${(allCourses||[]).length})`,  courses: allCourses || [] },
            { id: 'enrolled', label: `Записані (${enrollments.length})`,  courses: enrollments.map(e => e.course).filter(Boolean) },
            { id: 'done',     label: `Завершені (${completed.length})`,   courses: completed.map(e => e.course).filter(Boolean) },
        ];

        const active = this._courseSubTab;
        const canCreate = AppState.isStaff();
        area.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.25rem">
                <div class="ep-sub-tabs" style="margin-bottom:0">
                    ${this._courseTabs.map(t => `
                        <button class="ep-sub-tab${t.id===active?' active':''}"
                            onclick="ExpertPathPage._switchCourseTab('${t.id}',this)">${t.label}</button>`).join('')}
                </div>
                ${canCreate ? `<button class="btn btn-primary btn-sm" onclick="Router.go('admin?tab=courses')">
                    <i class="fa-solid fa-plus"></i> Створити курс
                </button>` : ''}
            </div>
            <div id="ep-course-list">${cardsFn(this._courseTabs.find(t=>t.id===active)?.courses||[])}</div>`;
    },

    _switchCourseTab(id, btn) {
        this._courseSubTab = id;
        document.querySelectorAll('.ep-sub-tab').forEach(t => t.classList.toggle('active', t === btn));
        const list = document.getElementById('ep-course-list');
        const tab  = this._courseTabs?.find(t => t.id === id);
        if (list && tab) list.innerHTML = this._courseCardsFn(tab.courses);
    },

    // ── Тести (реюз MyTestsPage) ─────────────────────────────────────
    async _renderTests(area) {
        await MyTestsPage._render(area, true);
    },

    // ── Результати ───────────────────────────────────────────────────
    async _renderResults(area) {
        const stats = await API.analytics.getStudentStats(AppState.user.id);
        const { enrollments, attempts } = stats;

        this._updateTabBadges({ results: attempts.length });

        const statItems = [
            { icon:'fa-book',         label:'Курси',         value: enrollments.length,                           grad:'linear-gradient(135deg,#6366f1,#8b5cf6)', shadow:'rgba(99,102,241,.4)' },
            { icon:'fa-circle-check', label:'Завершено',      value: enrollments.filter(e=>e.completed_at).length, grad:'linear-gradient(135deg,#10b981,#14b8a6)', shadow:'rgba(16,185,129,.4)' },
            { icon:'fa-file-pen',     label:'Спроби тестів',  value: attempts.length,                              grad:'linear-gradient(135deg,#3b82f6,#06b6d4)', shadow:'rgba(59,130,246,.4)' },
            { icon:'fa-trophy',       label:'Успішних',       value: attempts.filter(a=>a.passed).length,          grad:'linear-gradient(135deg,#f59e0b,#ef4444)', shadow:'rgba(245,158,11,.4)' },
        ];

        area.innerHTML = `
        <div class="ep-res-stats">
            ${statItems.map(s => `
            <div class="ep-res-stat" style="background:${s.grad};box-shadow:0 8px 28px ${s.shadow}">
                <i class="fa-solid ${s.icon}" style="font-size:1.4rem;opacity:.85;margin-bottom:8px"></i>
                <div style="font-size:2rem;font-weight:900;line-height:1;letter-spacing:-.03em">${s.value}</div>
                <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;opacity:.8">${s.label}</div>
            </div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" class="dash-two-col">
            <div class="card">
                <div class="card-header"><h3><i class="fa-solid fa-book"></i> Курси</h3></div>
                <div class="card-body" style="padding:0">
                    ${enrollments.length ? enrollments.map(e => `
                        <div onclick="Router.go('courses/${e.course_id}?from=expert-path')"
                            style="display:flex;align-items:center;gap:1rem;padding:.875rem 1.25rem;border-bottom:1px solid var(--border);cursor:pointer;transition:background var(--transition)"
                            onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
                            <div style="flex:1;min-width:0">
                                <div style="font-weight:500;font-size:.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Fmt.esc(e.course?.title||'—')}</div>
                            </div>
                            ${e.completed_at ? '<span class="badge badge-success"><i class="fa-solid fa-check"></i> Завершено</span>' : ''}
                        </div>`).join('')
                    : '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Ви не записані на жодний курс</div>'}
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h3><i class="fa-solid fa-file-pen"></i> Тести</h3></div>
                <div class="card-body" style="padding:0">
                    ${attempts.slice(0,15).length ? attempts.slice(0,15).map(a => `
                        <div style="display:flex;align-items:center;gap:1rem;padding:.875rem 1.25rem;border-bottom:1px solid var(--border)">
                            <div style="flex:1;min-width:0">
                                <div style="font-weight:500;font-size:.875rem">${Fmt.esc(a.test?.title||'—')}</div>
                                <div style="font-size:.75rem;color:var(--text-muted)">${Fmt.datetime(a.completed_at)}</div>
                            </div>
                            <div style="text-align:right;flex-shrink:0">
                                <div style="font-weight:700;color:${a.passed?'var(--success)':'var(--danger)'}">${Math.round(a.percentage||0)}%</div>
                                <span class="badge ${a.passed?'badge-success':'badge-danger'}" style="font-size:.65rem">${a.passed?'Зараховано':'Не зараховано'}</span>
                            </div>
                        </div>`).join('')
                    : '<div style="padding:2rem;text-align:center;color:var(--text-muted)">Спроб поки немає</div>'}
                </div>
            </div>
        </div>`;
    },

    // ── Опитування ───────────────────────────────────────────────────
    _renderSurveys(area) {
        SurveysPage.renderInTab(area);
    }
};
