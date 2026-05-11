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

        this._fetchCounts().then(c => this._updateTabBadges(c)).catch(() => {});

        await this._loadTab('courses');
    },

    async _fetchCounts() {
        const [enrollments, assignments, attRes] = await Promise.all([
            API.enrollments.getMyEnrollments().catch(() => []),
            TestsManagerAPI.getMyAssignments().catch(() => []),
            supabase.from('test_attempts')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', AppState.user.id)
                .not('completed_at', 'is', null)
        ]);
        return {
            courses: enrollments.length,
            tests:   assignments.length,
            results: attRes.count || 0,
            surveys: 0
        };
    },

    _updateTabBadges(counts) {
        Object.entries(counts).forEach(([tab, n]) => {
            const el = document.querySelector(`.ep-tab[data-tab="${tab}"] .ep-tab-count`);
            if (el) el.textContent = n;
        });
    },

    _renderShell(container) {
        container.innerHTML = `
<style>
.ep-wrap{max-width:1100px}

/* ── Tab cards ─────────────────────────────────────────────── */
.ep-tabs{display:flex;gap:12px;margin-bottom:2rem;flex-wrap:wrap}
.ep-tab{
    flex:1;min-width:150px;
    padding:18px 20px 16px;
    border:1.5px solid var(--border);
    border-radius:var(--radius-lg);
    background:var(--bg-surface);
    color:var(--text-muted);
    cursor:pointer;
    transition:all .18s;
    display:flex;flex-direction:column;align-items:flex-start;gap:2px;
    text-align:left;
    position:relative;overflow:hidden
}
.ep-tab::after{
    content:'';position:absolute;bottom:0;left:0;right:0;height:3px;
    background:var(--primary);opacity:0;transition:opacity .18s
}
.ep-tab:hover:not(.active){
    border-color:var(--primary);
    color:var(--text-primary);
    box-shadow:0 2px 12px rgba(0,0,0,.06)
}
.ep-tab.active{
    border-color:var(--primary);
    background:var(--primary);
    color:#fff;
    box-shadow:0 4px 18px rgba(0,0,0,.12)
}
.ep-tab.active::after{opacity:0}
.ep-tab-icon{font-size:1.25rem;margin-bottom:8px;opacity:.75}
.ep-tab.active .ep-tab-icon{opacity:1}
.ep-tab-count{
    font-size:2rem;font-weight:800;line-height:1;
    color:var(--text-primary);letter-spacing:-.03em;
    transition:color .18s
}
.ep-tab.active .ep-tab-count{color:#fff}
.ep-tab:hover:not(.active) .ep-tab-count{color:var(--text-primary)}
.ep-tab-label{
    font-size:.72rem;font-weight:600;
    text-transform:uppercase;letter-spacing:.06em;
    margin-top:4px;opacity:.8
}

/* ── Course sub-tabs ────────────────────────────────────────── */
.ep-sub-tabs{display:flex;gap:6px;margin-bottom:1.25rem;flex-wrap:wrap}
.ep-sub-tab{padding:5px 14px;border-radius:20px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);font-size:.8rem;font-weight:500;cursor:pointer;transition:all .15s}
.ep-sub-tab.active{background:var(--primary);color:#fff;border-color:var(--primary)}

/* ── Course grid ────────────────────────────────────────────── */
.ep-course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem}
.ep-course-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;cursor:pointer;transition:box-shadow .18s,border-color .18s;display:flex;flex-direction:column}
.ep-course-card:hover{box-shadow:0 4px 20px rgba(0,0,0,.1);border-color:var(--primary)}
.ep-course-thumb{height:120px;flex-shrink:0;overflow:hidden}
.ep-course-body{padding:12px 14px;flex:1;display:flex;flex-direction:column;gap:3px}
.ep-course-title{font-weight:700;font-size:.9rem;color:var(--text-primary);line-height:1.35;margin-bottom:2px}
.ep-course-teacher{font-size:.73rem;color:var(--text-muted);margin-bottom:6px}
</style>
<div class="ep-wrap">
    <div class="ep-tabs">
        <button class="ep-tab active" data-tab="courses" onclick="ExpertPathPage.switchTab('courses',this)">
            <i class="fa-solid fa-graduation-cap ep-tab-icon"></i>
            <span class="ep-tab-count">—</span>
            <span class="ep-tab-label">Мої курси</span>
        </button>
        <button class="ep-tab" data-tab="tests" onclick="ExpertPathPage.switchTab('tests',this)">
            <i class="fa-solid fa-clipboard-list ep-tab-icon"></i>
            <span class="ep-tab-count">—</span>
            <span class="ep-tab-label">Мої тести</span>
        </button>
        <button class="ep-tab" data-tab="results" onclick="ExpertPathPage.switchTab('results',this)">
            <i class="fa-solid fa-trophy ep-tab-icon"></i>
            <span class="ep-tab-count">—</span>
            <span class="ep-tab-label">Мої результати</span>
        </button>
        <button class="ep-tab" data-tab="surveys" onclick="ExpertPathPage.switchTab('surveys',this)">
            <i class="fa-solid fa-square-poll-horizontal ep-tab-icon"></i>
            <span class="ep-tab-count">0</span>
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
            else if (tab === 'results') await this._renderResults(area);
            else                        this._renderSurveys(area);
        } catch(e) {
            area.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><p>${e.message}</p></div>`;
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

        const cardsFn = (courses) => {
            if (!courses.length) return `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fa-solid fa-graduation-cap" style="font-size:2.5rem;opacity:.2"></i></div>
                    <p style="color:var(--text-muted)">Немає курсів</p>
                </div>`;
            return `<div class="ep-course-grid">${courses.map(c => {
                const enr  = enrolledMap.get(c.id);
                const pct  = enr?.progress_percentage || 0;
                const done = !!enr?.completed_at;
                const thumb = c.cover_image
                    ? `<img src="${c.cover_image}" style="width:100%;height:100%;object-fit:cover">`
                    : `<div style="height:100%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center"><i class="fa-solid fa-graduation-cap" style="font-size:2.2rem;color:rgba(255,255,255,.4)"></i></div>`;
                const footer = enr
                    ? `<div class="progress-bar" style="height:3px;margin-top:auto;margin-bottom:4px">
                           <div class="progress-fill${done?' success':''}" style="width:${pct}%"></div>
                       </div>
                       <div style="font-size:.7rem;color:${done?'var(--success)':'var(--text-muted)'}">
                           ${done ? '<i class="fa-solid fa-circle-check"></i> Завершено' : pct+'% пройдено'}
                       </div>`
                    : `<div style="font-size:.7rem;color:var(--text-muted);margin-top:auto"><i class="fa-regular fa-circle"></i> Не записаний</div>`;
                return `
                <div class="ep-course-card" onclick="Router.go('courses/${c.id}?from=expert-path')">
                    <div class="ep-course-thumb">${thumb}</div>
                    <div class="ep-course-body">
                        <div class="ep-course-title">${c.title}</div>
                        <div class="ep-course-teacher">${c.teacher?.full_name || ''}</div>
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
        area.innerHTML = `
            <div class="ep-sub-tabs">
                ${this._courseTabs.map(t => `
                    <button class="ep-sub-tab${t.id===active?' active':''}"
                        onclick="ExpertPathPage._switchCourseTab('${t.id}',this)">${t.label}</button>`).join('')}
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

        area.innerHTML = `
        <div class="stats-grid" style="margin-bottom:1.5rem">
            ${[
                { icon:'fa-book',         label:'Курси',          value: enrollments.length,                              color:'#6366F1' },
                { icon:'fa-circle-check', label:'Завершено',       value: enrollments.filter(e=>e.completed_at).length,    color:'#10B981' },
                { icon:'fa-file-pen',     label:'Спроби тестів',   value: attempts.length,                                 color:'#8B5CF6' },
                { icon:'fa-trophy',       label:'Успішних',        value: attempts.filter(a=>a.passed).length,             color:'#F59E0B' }
            ].map(s => `
                <div class="stat-card" style="--accent-color:${s.color}">
                    <div class="stat-icon"><i class="fa-solid ${s.icon}"></i></div>
                    <div class="stat-value">${s.value}</div>
                    <div class="stat-label">${s.label}</div>
                </div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem" class="dash-two-col">
            <div class="card">
                <div class="card-header"><h3><i class="fa-solid fa-book"></i> Курси</h3></div>
                <div class="card-body" style="padding:0">
                    ${enrollments.length ? enrollments.map(e => `
                        <div onclick="Router.go('courses/${e.course_id}?from=expert-path')"
                            style="display:flex;align-items:center;gap:1rem;padding:.875rem 1.25rem;border-bottom:1px solid var(--border);cursor:pointer;transition:background var(--transition)"
                            onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
                            <div style="flex:1;min-width:0">
                                <div style="font-weight:500;font-size:.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.course?.title||'—'}</div>
                                <div class="progress-bar" style="height:3px;margin-top:.4rem">
                                    <div class="progress-fill${e.completed_at?' success':''}" style="width:${e.progress_percentage||0}%"></div>
                                </div>
                            </div>
                            <span style="font-size:.8rem;color:var(--text-muted);flex-shrink:0">${e.progress_percentage||0}%</span>
                            ${e.completed_at ? '<span class="badge badge-success"><i class="fa-solid fa-check"></i></span>' : ''}
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
                                <div style="font-weight:500;font-size:.875rem">${a.test?.title||'—'}</div>
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

    // ── Опитування (заглушка) ────────────────────────────────────────
    _renderSurveys(area) {
        area.innerHTML = `
        <div class="empty-state" style="padding:5rem 2rem">
            <div style="font-size:3.5rem;margin-bottom:1.25rem;opacity:.2"><i class="fa-solid fa-square-poll-horizontal"></i></div>
            <h3 style="color:var(--text-primary);margin-bottom:.5rem">Опитування — скоро</h3>
            <p style="color:var(--text-muted);font-size:.875rem">Розділ знаходиться в розробці</p>
        </div>`;
    }
};
