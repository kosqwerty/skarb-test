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
            // Fetch raw data for accurate filtering
            const [enrollments, assignments, attempts, surveyResponses, surveys] = await Promise.all([
                supabase.from('enrollments').select('id, completed_at, run_id, course_runs(end_date)').eq('user_id', uid),
                supabase.from('test_assignments').select('test_id').eq('user_id', uid),
                supabase.from('test_attempts').select('test_id, completed_at').eq('user_id', uid).not('completed_at', 'is', null),
                supabase.from('survey_responses').select('survey_id').eq('user_id', uid),
                supabase.from('surveys').select('id').eq('is_published', true),
            ]);

            const today = new Date().toISOString().slice(0, 10);
            const completedTestIds   = new Set((attempts.data || []).map(a => a.test_id));
            const respondedSurveyIds = new Set((surveyResponses.data || []).map(r => r.survey_id));

            const allEnr     = enrollments.data || [];
            const completedEnr = allEnr.filter(e =>
                e.completed_at || (e.course_runs?.end_date && e.course_runs.end_date < today)
            );
            const activeEnr  = allEnr.filter(e => !completedEnr.includes(e));
            const activeTests    = (assignments.data || []).filter(a => !completedTestIds.has(a.test_id));
            const activeSurveys  = (surveys.data || []).filter(s => !respondedSurveyIds.has(s.id));

            this._updateTabBadges({
                courses:   activeEnr.length,
                tests:     activeTests.length,
                surveys:   activeSurveys.length,
                completed: completedEnr.length + completedTestIds.size + respondedSurveyIds.size,
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
.ep-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px}

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
.ep-tab[data-tab="courses"]::before  {background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.ep-tab[data-tab="tests"]::before    {background:linear-gradient(135deg,#3b82f6,#06b6d4)}
.ep-tab[data-tab="surveys"]::before  {background:linear-gradient(135deg,#10b981,#14b8a6)}
.ep-tab[data-tab="completed"]::before{background:linear-gradient(135deg,#f59e0b,#ef4444)}

.ep-tab:hover:not(.active){transform:translateY(-3px);box-shadow:0 8px 30px rgba(0,0,0,.1)}
.ep-tab[data-tab="courses"]:hover:not(.active)  {border-color:#6366f1}
.ep-tab[data-tab="tests"]:hover:not(.active)    {border-color:#3b82f6}
.ep-tab[data-tab="surveys"]:hover:not(.active)  {border-color:#10b981}
.ep-tab[data-tab="completed"]:hover:not(.active){border-color:#f59e0b}

.ep-tab.active{border-color:transparent;color:#fff;transform:translateY(-3px)}
.ep-tab.active::before{opacity:1}
.ep-tab[data-tab="courses"].active  {box-shadow:0 10px 36px rgba(99,102,241,.45)}
.ep-tab[data-tab="tests"].active    {box-shadow:0 10px 36px rgba(59,130,246,.45)}
.ep-tab[data-tab="surveys"].active  {box-shadow:0 10px 36px rgba(16,185,129,.45)}
.ep-tab[data-tab="completed"].active{box-shadow:0 10px 36px rgba(245,158,11,.45)}

.ep-tab-icon-wrap{
    font-size:1.4rem;margin-bottom:14px;
    position:relative;z-index:1;transition:color .25s
}
.ep-tab[data-tab="courses"] .ep-tab-icon-wrap  {color:#6366f1}
.ep-tab[data-tab="tests"] .ep-tab-icon-wrap    {color:#3b82f6}
.ep-tab[data-tab="surveys"] .ep-tab-icon-wrap  {color:#10b981}
.ep-tab[data-tab="completed"] .ep-tab-icon-wrap{color:#f59e0b}
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
.ep-course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:24px}
.ep-course-card{
    background:var(--bg-surface);
    border:1px solid var(--border);
    border-radius:20px;overflow:hidden;cursor:pointer;
    transition:all .3s cubic-bezier(.4,0,.2,1);
    display:flex;flex-direction:column;
    position:relative;
}
.ep-course-card:hover{
    transform:translateY(-6px);
    box-shadow:0 20px 56px rgba(0,0,0,.18);
    border-color:var(--primary);
}
/* Thumbnail */
.ep-course-thumb{height:200px;flex-shrink:0;overflow:hidden;position:relative;background:#0f0c29;border-radius:20px 20px 0 0}
.ep-course-thumb-bg{position:absolute;inset:-8px;background-size:cover;background-position:center;filter:blur(14px) brightness(.35);transform:scale(1.05);transition:transform .4s}
.ep-course-thumb-main{position:absolute;inset:0;background-size:contain;background-repeat:no-repeat;background-position:center;z-index:1;transition:transform .4s}
.ep-course-card:hover .ep-course-thumb-bg,.ep-course-card:hover .ep-course-thumb-main{transform:scale(1.08)}
/* Bottom gradient overlay for title */
.ep-course-thumb-overlay{
    position:absolute;inset:0;z-index:2;
    background:linear-gradient(to top,rgba(0,0,0,.72) 0%,rgba(0,0,0,.1) 55%,transparent 100%);
    display:flex;flex-direction:column;justify-content:flex-end;padding:12px 14px;
}
.ep-course-thumb-title{
    font-size:.92rem;font-weight:700;color:#fff;line-height:1.35;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
    text-shadow:0 1px 4px rgba(0,0,0,.5);
}
/* Status badge top-right */
.ep-course-badge{
    position:absolute;top:10px;right:10px;z-index:3;
    padding:.22rem .65rem;border-radius:20px;font-size:.68rem;font-weight:700;
    backdrop-filter:blur(6px);letter-spacing:.02em;
}
.ep-course-badge--enrolled{background:rgba(99,102,241,.85);color:#fff}
.ep-course-badge--done{background:rgba(16,185,129,.85);color:#fff}
.ep-course-badge--none{background:rgba(0,0,0,.45);color:rgba(255,255,255,.8)}
/* Achievement badge (completed) */
.ep-course-achievement{
    position:absolute;bottom:-1px;right:14px;z-index:5;
    width:52px;height:52px;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    filter:drop-shadow(0 4px 10px rgba(0,0,0,.45));
}
.ep-course-achievement svg{width:52px;height:52px}
.ep-course-achievement-icon{
    position:absolute;font-size:1.15rem;top:50%;left:50%;
    transform:translate(-50%,-58%);
}
/* Card body */
.ep-course-body{padding:14px 16px 16px;flex:1;display:flex;flex-direction:column;gap:6px}
.ep-course-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ep-course-meta-tag{
    font-size:.67rem;font-weight:600;padding:.15rem .55rem;border-radius:20px;
    background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border);
}
.ep-course-dates{
    margin-top:auto;padding-top:8px;border-top:1px solid var(--border);
    font-size:.72rem;color:var(--text-muted);display:flex;align-items:center;gap:.4rem;
}
/* Old refs kept for compat */
.ep-course-title{font-weight:700;font-size:.9rem;color:var(--text-primary);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ep-course-teacher{font-size:.73rem;color:var(--text-muted)}
.ep-prog-bar{height:4px;border-radius:4px;background:var(--border);overflow:hidden}
.ep-prog-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6);transition:width .6s ease}
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
    .ep-tab-count{font-size:1.1rem!important}
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
        <button class="ep-tab" data-tab="completed" onclick="ExpertPathPage.switchTab('completed',this)">
            <div class="ep-tab-icon-wrap"><i class="fa-solid fa-trophy"></i></div>
            <div class="ep-tab-count">—</div>
            <span class="ep-tab-label">Завершені</span>
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
            if      (tab === 'courses')   await this._renderCourses(area);
            else if (tab === 'tests')     await this._renderTests(area);
            else if (tab === 'completed') await this._renderCompleted(area);
            else                          this._renderSurveys(area);
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

        this._updateTabBadges({ courses: enrollments.filter(e => !e.completed_at).length });

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
                const run  = enr?.run;
                const fmtD = d => d ? Fmt.dateShort(new Date(d + 'T00:00:00')) : '';
                const dates = run ? [fmtD(run.start_date), fmtD(run.end_date)].filter(Boolean).join(' — ') : '';

                const thumbInner = c.thumbnail_url
                    ? `<div class="ep-course-thumb-bg" style="background-image:url('${c.thumbnail_url}')"></div>
                       <div class="ep-course-thumb-main" style="background-image:url('${c.thumbnail_url}')"></div>`
                    : `<div style="position:absolute;inset:0;background:${grads[i%grads.length]};display:flex;align-items:center;justify-content:center">
                           <i class="fa-solid fa-graduation-cap" style="font-size:2.8rem;color:rgba(255,255,255,.22)"></i>
                       </div>`;

                const badge = done
                    ? `<span class="ep-course-badge ep-course-badge--done"><i class="fa-solid fa-circle-check"></i> Завершено</span>`
                    : enr
                        ? `<span class="ep-course-badge ep-course-badge--enrolled"><i class="fa-solid fa-circle-dot"></i> Записаний</span>`
                        : `<span class="ep-course-badge ep-course-badge--none"><i class="fa-regular fa-circle"></i> Не записаний</span>`;

                // Achievement badge for completed courses
                const achievementBadge = done ? (() => {
                    if (c.badge_url) {
                        return `<div class="ep-course-achievement">
                            <img src="${c.badge_url}" style="width:52px;height:52px;object-fit:contain" alt="Бейдж">
                        </div>`;
                    }
                    const medals = [
                        { icon:'🏆', fill:'#f59e0b', fill2:'#d97706', ring:'#fbbf24' },
                        { icon:'🥇', fill:'#eab308', fill2:'#ca8a04', ring:'#fde047' },
                        { icon:'⭐', fill:'#6366f1', fill2:'#4f46e5', ring:'#818cf8' },
                        { icon:'🎖️', fill:'#10b981', fill2:'#059669', ring:'#34d399' },
                    ];
                    const m = medals[(c.id.charCodeAt(0) + c.id.charCodeAt(1)) % medals.length];
                    return `<div class="ep-course-achievement">
                        <svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M26 4 L31 18 L46 18 L34 27 L39 42 L26 33 L13 42 L18 27 L6 18 L21 18 Z" fill="${m.fill}" stroke="${m.ring}" stroke-width="1.5"/>
                            <path d="M26 8 L30 19.5 L43 19.5 L33 27 L37 39 L26 32 L15 39 L19 27 L9 19.5 L22 19.5 Z" fill="${m.fill2}" opacity=".5"/>
                        </svg>
                        <div class="ep-course-achievement-icon">${m.icon}</div>
                    </div>`;
                })() : '';

                const metaTags = [
                    c.category ? `<span class="ep-course-meta-tag">${Fmt.esc(c.category)}</span>` : '',
                    c.level    ? `<span class="ep-course-meta-tag">${Fmt.level(c.level)}</span>`   : '',
                ].filter(Boolean).join('');

                const datesRow = dates ? `
                    <div class="ep-course-dates">
                        <i class="fa-regular fa-calendar"></i> ${dates}
                        ${run?.title ? `<span style="color:var(--primary);font-weight:600">· ${Fmt.esc(run.title)}</span>` : ''}
                    </div>` : '';

                return `
                <div class="ep-course-card" onclick="Router.go('courses/${c.id}?from=expert-path')">
                    <div class="ep-course-thumb">
                        ${thumbInner}
                        ${badge}
                        <div class="ep-course-thumb-overlay">
                            <div class="ep-course-thumb-title">${Fmt.esc(c.title)}</div>
                        </div>
                        ${achievementBadge}
                    </div>
                    <div class="ep-course-body">
                        ${metaTags ? `<div class="ep-course-meta">${metaTags}</div>` : ''}
                        ${datesRow}
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

        const canCreate = AppState.isStaff();
        area.innerHTML = `
            ${canCreate ? `<div style="display:flex;justify-content:flex-end;margin-bottom:.75rem">
                <button class="btn btn-primary btn-sm" onclick="Router.go('admin?tab=courses')">
                    <i class="fa-solid fa-plus"></i> Створити курс
                </button>
            </div>` : ''}
            <div id="ep-course-list">${cardsFn(allCourses || [])}</div>`;
    },

    _switchCourseTab(id, btn) {
        this._courseSubTab = id;
        document.querySelectorAll('.ep-sub-tab').forEach(t => t.classList.toggle('active', t === btn));
        const list = document.getElementById('ep-course-list');
        const tab  = this._courseTabs?.find(t => t.id === id);
        if (list && tab) list.innerHTML = this._courseCardsFn(tab.courses);
    },

    // ── Завершені курси ───────────────────────────────────────────────
    async _renderCompleted(area) {
        const uid = AppState.user.id;
        const [completedCourses, attemptsRes, surveyRes] = await Promise.all([
            API.enrollments.getMyCompleted(),
            supabase.from('test_attempts')
                .select('*, test:tests(id, title, passing_score)')
                .eq('user_id', uid)
                .not('completed_at', 'is', null)
                .order('completed_at', { ascending: false }),
            supabase.from('survey_responses')
                .select('*, survey:surveys(id, title)')
                .eq('user_id', uid)
                .not('submitted_at', 'is', null)
                .order('submitted_at', { ascending: false }),
        ]);

        const attempts  = attemptsRes.data  || [];
        const responses = surveyRes.data     || [];
        const total = completedCourses.length + attempts.length + responses.length;

        this._updateTabBadges({ completed: total });

        if (!total) {
            area.innerHTML = `
            <div class="ep-empty">
                <div class="ep-empty-icon"><i class="fa-solid fa-trophy"></i></div>
                <div class="ep-empty-title">Ще нічого не завершено</div>
                <div class="ep-empty-sub">Тут з'являться завершені курси, тести та опитування</div>
            </div>`;
            return;
        }

        const participants = await Promise.all(
            completedCourses.map(e => API.enrollments.getRunParticipants(e.course_id, e.run_id).catch(() => []))
        );

        const colors  = ['#6366f1','#10b981','#f59e0b','#ef4444','#ec4899','#3b82f6','#8b5cf6','#14b8a6'];
        const colorFor = uid => colors[Math.abs([...uid].reduce((a,c)=>a+c.charCodeAt(0),0)) % colors.length];
        const fmtD    = d => d ? Fmt.dateShort(new Date(d + 'T00:00:00')) : '';
        const fmtDT   = d => d ? Fmt.datetime(new Date(d)) : '';

        const styles = `<style>
        .ep-done-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem}
        .ep-done-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:18px;overflow:hidden;display:flex;flex-direction:column}
        .ep-done-thumb{height:110px;position:relative;overflow:hidden;background:#0f0c29;flex-shrink:0}
        .ep-done-thumb-bg{position:absolute;inset:-8px;background-size:cover;background-position:center;filter:blur(12px) brightness(.4);transform:scale(1.05)}
        .ep-done-thumb-main{position:absolute;inset:0;background-size:contain;background-repeat:no-repeat;background-position:center;z-index:1}
        .ep-done-body{padding:1rem;display:flex;flex-direction:column;gap:.6rem;flex:1}
        .ep-done-badge{display:inline-flex;align-items:center;gap:.35rem;font-size:.68rem;font-weight:700;padding:.2rem .6rem;border-radius:20px}
        .ep-done-badge.green{background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.3)}
        .ep-done-badge.red{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.25)}
        .ep-done-badge.blue{background:rgba(99,102,241,.1);color:#6366f1;border:1px solid rgba(99,102,241,.25)}
        .ep-done-section{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin:1rem 0 .5rem;display:flex;align-items:center;gap:.4rem}
        .ep-done-avatars{display:flex;flex-wrap:wrap;gap:.25rem}
        .ep-done-avatar{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;overflow:hidden;flex-shrink:0;border:2px solid var(--bg-surface)}
        </style>`;

        // ── Courses ──────────────────────────────────────────────────
        const coursesHtml = completedCourses.length ? `
        <div class="ep-done-section"><i class="fa-solid fa-graduation-cap"></i> Курси (${completedCourses.length})</div>
        <div class="ep-done-grid">
        ${completedCourses.map((e, i) => {
            const c    = e.course;
            const run  = e.run;
            const parts = participants[i] || [];
            const dates = [fmtD(run.start_date), fmtD(run.end_date)].filter(Boolean).join(' — ');
            const thumbHtml = c.thumbnail_url
                ? `<div class="ep-done-thumb-bg" style="background-image:url('${c.thumbnail_url}')"></div><div class="ep-done-thumb-main" style="background-image:url('${c.thumbnail_url}')"></div>`
                : `<div style="position:absolute;inset:0;background:linear-gradient(135deg,#f59e0b,#ef4444);display:flex;align-items:center;justify-content:center"><i class="fa-solid fa-graduation-cap" style="font-size:2rem;color:rgba(255,255,255,.3)"></i></div>`;
            const shown = parts.slice(0, 8);
            const rest  = parts.length - shown.length;
            const avatarsHtml = shown.map(u => {
                const col = colorFor(u.id);
                return `<div class="ep-done-avatar" style="background:${col}22;color:${col}" title="${Fmt.esc(u.full_name||'')}${u.city?' · '+u.city:''}">
                    ${u.avatar_url ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover">` : Fmt.initials(u.full_name||'?')}
                </div>`;
            }).join('') + (rest > 0 ? `<div class="ep-done-avatar" style="background:var(--bg-raised);color:var(--text-muted);font-size:.65rem">+${rest}</div>` : '');
            return `
            <div class="ep-done-card">
                <div class="ep-done-thumb" onclick="Router.go('courses/${c.id}?from=expert-path')" style="cursor:pointer">${thumbHtml}</div>
                <div class="ep-done-body">
                    <div>
                        <div style="font-weight:700;font-size:.9rem;margin-bottom:.25rem;cursor:pointer" onclick="Router.go('courses/${c.id}?from=expert-path')">${Fmt.esc(c.title)}</div>
                        <span class="ep-done-badge green"><i class="fa-solid fa-circle-check"></i> Завершено</span>
                    </div>
                    <div style="padding:.5rem .7rem;border-radius:10px;background:var(--bg-raised);border:1px solid var(--border)">
                        <div style="font-size:.65rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:.15rem"><i class="fa-solid fa-rotate"></i> Група</div>
                        <div style="font-size:.82rem;font-weight:600">${Fmt.esc(run.title)}</div>
                        ${dates ? `<div style="font-size:.7rem;color:var(--text-muted)">${dates}</div>` : ''}
                    </div>
                    ${parts.length ? `<div><div style="font-size:.65rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:.3rem"><i class="fa-solid fa-users"></i> Учасники (${parts.length})</div><div class="ep-done-avatars">${avatarsHtml}</div></div>` : ''}
                    <button class="btn btn-ghost btn-sm" style="margin-top:auto;border:1px solid var(--border)" onclick="Router.go('courses/${c.id}?from=expert-path')">
                        <i class="fa-solid fa-rotate"></i> Записатися повторно
                    </button>
                </div>
            </div>`;
        }).join('')}
        </div>` : '';

        // ── Tests ────────────────────────────────────────────────────
        const testsHtml = attempts.length ? `
        <div class="ep-done-section"><i class="fa-solid fa-clipboard-list"></i> Тести (${attempts.length})</div>
        <div class="ep-done-grid">
        ${attempts.map(a => {
            const passed = a.passed;
            const pct    = Math.round(a.percentage || 0);
            return `
            <div class="ep-done-card">
                <div style="padding:1rem 1rem .5rem;display:flex;align-items:center;gap:.65rem">
                    <div style="width:44px;height:44px;border-radius:12px;background:${passed ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.1)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <i class="fa-solid fa-${passed ? 'circle-check' : 'circle-xmark'}" style="font-size:1.3rem;color:${passed ? '#10b981' : '#ef4444'}"></i>
                    </div>
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:700;font-size:.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Fmt.esc(a.test?.title || '—')}</div>
                        <div style="font-size:.72rem;color:var(--text-muted)">${fmtDT(a.completed_at)}</div>
                    </div>
                </div>
                <div class="ep-done-body" style="padding-top:.5rem">
                    <div style="display:flex;align-items:center;justify-content:space-between">
                        <span class="ep-done-badge ${passed ? 'green' : 'red'}">
                            <i class="fa-solid fa-${passed ? 'circle-check' : 'circle-xmark'}"></i> ${passed ? 'Пройдено' : 'Не пройдено'}
                        </span>
                        <span style="font-size:1rem;font-weight:800;color:${passed ? '#10b981' : '#ef4444'}">${pct}%</span>
                    </div>
                    <button class="btn btn-ghost btn-sm" style="border:1px solid var(--border)" onclick="Router.go('tests/${a.test_id}')">
                        <i class="fa-solid fa-rotate"></i> Пройти ще раз
                    </button>
                </div>
            </div>`;
        }).join('')}
        </div>` : '';

        // ── Surveys ──────────────────────────────────────────────────
        const surveysHtml = responses.length ? `
        <div class="ep-done-section"><i class="fa-solid fa-square-poll-horizontal"></i> Опитування (${responses.length})</div>
        <div class="ep-done-grid">
        ${responses.map(r => `
            <div class="ep-done-card">
                <div style="padding:1rem;display:flex;align-items:center;gap:.65rem">
                    <div style="width:44px;height:44px;border-radius:12px;background:rgba(99,102,241,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <i class="fa-solid fa-square-poll-horizontal" style="font-size:1.3rem;color:#6366f1"></i>
                    </div>
                    <div style="flex:1;min-width:0">
                        <div style="font-weight:700;font-size:.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Fmt.esc(r.survey?.title || '—')}</div>
                        <div style="font-size:.72rem;color:var(--text-muted)">${fmtDT(r.submitted_at)}</div>
                    </div>
                </div>
                <div class="ep-done-body" style="padding-top:0">
                    <span class="ep-done-badge blue"><i class="fa-solid fa-circle-check"></i> Відповіді надані</span>
                </div>
            </div>`).join('')}
        </div>` : '';

        area.innerHTML = styles + coursesHtml + testsHtml + surveysHtml;
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
