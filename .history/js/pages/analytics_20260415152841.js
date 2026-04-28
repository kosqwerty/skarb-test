// ================================================================
// EduFlow LMS — Analytics Page
// ================================================================

const AnalyticsPage = {
    _charts: [],

    async init(container, params) {
        if (!AppState.isStaff()) {
            Router.go('dashboard');
            return;
        }

        UI.setBreadcrumb([{ label: 'Аналитика' }]);

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">
                    <h1>📊 Аналитика</h1>
                    <p>Статистика обучения и прогресс студентов</p>
                </div>
                <div class="page-actions">
                    <select id="analytics-course" onchange="AnalyticsPage.loadCourseStats()" style="width:auto">
                        <option value="">Все курсы</option>
                    </select>
                    <button class="btn btn-success" onclick="AnalyticsPage.exportAll()">📊 Экспорт Excel</button>
                </div>
            </div>

            <!-- Global stats -->
            <div id="analytics-stats" class="stats-grid"></div>

            <!-- Charts row -->
            <div class="analytics-grid" style="margin-bottom:2rem">
                <div class="chart-card">
                    <h3>Прогресс по курсам</h3>
                    <div class="chart-wrapper"><canvas id="chart-progress"></canvas></div>
                </div>
                <div class="chart-card">
                    <h3>Результаты тестов</h3>
                    <div class="chart-wrapper"><canvas id="chart-tests"></canvas></div>
                </div>
            </div>

            <!-- Students table -->
            <div class="card" style="margin-bottom:2rem">
                <div class="card-header">
                    <h3>👥 Стажери</h3>
                    <div style="display:flex;gap:.5rem">
                        <input type="text" id="student-search" placeholder="Пошук стажера..." style="width:200px" onkeyup="AnalyticsPage.filterStudents(event)">
                        <button class="btn btn-success btn-sm" onclick="AnalyticsPage.exportStudents()">Экспорт</button>
                    </div>
                </div>
                <div id="students-table" class="table-wrapper"></div>
            </div>

            <!-- Test attempts table -->
            <div class="card">
                <div class="card-header">
                    <h3>📝 Попытки тестов</h3>
                    <button class="btn btn-success btn-sm" onclick="AnalyticsPage.exportAttempts()">Экспорт</button>
                </div>
                <div id="attempts-table" class="table-wrapper"></div>
            </div>`;

        // Destroy old charts
        this._destroyCharts();

        const [stats, courses, enrollments, attempts] = await Promise.all([
            API.analytics.getDashboardStats().catch(() => ({})),
            API.courses.getAll({ published: true, pageSize: 100 }).catch(() => ({ data: [] })),
            API.enrollments.getAll().catch(() => []),
            API.attempts.getAll().catch(() => [])
        ]);

        this._allEnrollments = enrollments;
        this._allAttempts    = attempts;

        this._renderStats(stats);
        this._populateCourseFilter(courses.data);
        this._renderCharts(enrollments, attempts);
        this._renderStudentsTable(enrollments);
        this._renderAttemptsTable(attempts);

        // Load specific course if passed
        if (params.course) {
            const sel = document.getElementById('analytics-course');
            if (sel) { sel.value = params.course; this.loadCourseStats(); }
        }
    },

    _destroyCharts() {
        this._charts.forEach(c => { try { c.destroy(); } catch(_) {} });
        this._charts = [];
    },

    _renderStats(stats) {
        const el = document.getElementById('analytics-stats');
        if (!el) return;

        const completed = (this._allEnrollments || []).filter(e => e.completed_at).length;
        const passRate  = (this._allAttempts || []).length
            ? Math.round((this._allAttempts.filter(a => a.passed).length / this._allAttempts.length) * 100)
            : 0;
        const avgScore  = (this._allAttempts || []).length
            ? Math.round(this._allAttempts.reduce((s,a) => s + (a.percentage||0), 0) / this._allAttempts.length)
            : 0;

        el.innerHTML = [
            { icon: '👥', label: 'Всего пользователей', value: Fmt.num(stats.totalUsers), color: '#6366F1' },
            { icon: '🎓', label: 'Всего записей',       value: Fmt.num(stats.totalEnrollments), color: '#8B5CF6' },
            { icon: '✅', label: 'Завершено курсов',    value: Fmt.num(completed), color: '#10B981' },
            { icon: '📝', label: 'Попыток тестов',      value: Fmt.num(stats.totalAttempts), color: '#06B6D4' },
            { icon: '🏆', label: 'Сдано тестов',        value: passRate + '%', color: '#F59E0B' },
            { icon: '💯', label: 'Средний балл',         value: avgScore + '%', color: '#EF4444' }
        ].map(s => `
            <div class="stat-card" style="--accent-color:${s.color}">
                <div class="stat-icon" style="color:${s.color}">${s.icon}</div>
                <div class="stat-value">${s.value}</div>
                <div class="stat-label">${s.label}</div>
            </div>`).join('');
    },

    _populateCourseFilter(courses) {
        const sel = document.getElementById('analytics-course');
        if (!sel || !courses) return;
        courses.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.title;
            sel.appendChild(opt);
        });
    },

    _renderCharts(enrollments, attempts) {
        // Progress chart — by course
        const courseMap = {};
        enrollments.forEach(e => {
            const title = e.course?.title;
            if (!title) return;
            if (!courseMap[title]) courseMap[title] = [];
            courseMap[title].push(e.progress_percentage || 0);
        });

        const labels    = Object.keys(courseMap).slice(0, 8);
        const avgProgs  = labels.map(l => Math.round(courseMap[l].reduce((s,v) => s+v, 0) / courseMap[l].length));

        const progressCtx = document.getElementById('chart-progress');
        if (progressCtx) {
            const ch = new Chart(progressCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Средний прогресс (%)',
                        data: avgProgs,
                        backgroundColor: 'rgba(99,102,241,.7)',
                        borderColor: '#6366F1',
                        borderWidth: 2,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#94A3B8' } },
                        x: { grid: { display: false }, ticks: { color: '#94A3B8', maxRotation: 30 } }
                    }
                }
            });
            this._charts.push(ch);
        }

        // Tests chart — passed vs failed
        const passed = attempts.filter(a => a.passed).length;
        const failed = attempts.filter(a => !a.passed).length;

        const testsCtx = document.getElementById('chart-tests');
        if (testsCtx) {
            const ch2 = new Chart(testsCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Сдано', 'Не сдано'],
                    datasets: [{
                        data: [passed, failed],
                        backgroundColor: ['rgba(16,185,129,.7)', 'rgba(239,68,68,.7)'],
                        borderColor: ['#10B981', '#EF4444'],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#94A3B8', padding: 16 } }
                    }
                }
            });
            this._charts.push(ch2);
        }
    },

    _renderStudentsTable(enrollments) {
        const el = document.getElementById('students-table');
        if (!el) return;

        // Group by user
        const userMap = {};
        enrollments.forEach(e => {
            const uid = e.user?.id;
            if (!uid) return;
            if (!userMap[uid]) {
                userMap[uid] = {
                    name:       e.user?.full_name || '—',
                    email:      e.user?.email || '—',
                    courses:    0,
                    completed:  0,
                    avgProgress: []
                };
            }
            userMap[uid].courses++;
            if (e.completed_at) userMap[uid].completed++;
            userMap[uid].avgProgress.push(e.progress_percentage || 0);
        });

        const rows = Object.values(userMap);
        this._studentRows = rows;

        this._renderStudentRows(rows, el);
    },

    _renderStudentRows(rows, el) {
        if (!rows.length) {
            el.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted)">Данные отсутствуют</div>`;
            return;
        }

        el.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Стажер</th><th>Email</th><th>Курсов</th><th>Завершено</th><th>Ср. прогрес</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => {
                        const avg = r.avgProgress.length ? Math.round(r.avgProgress.reduce((s,v) => s+v, 0) / r.avgProgress.length) : 0;
                        return `<tr>
                            <td><strong>${r.name}</strong></td>
                            <td style="color:var(--text-muted)">${r.email}</td>
                            <td>${r.courses}</td>
                            <td><span class="badge badge-success">${r.completed}</span></td>
                            <td>
                                <div style="display:flex;align-items:center;gap:.5rem;min-width:120px">
                                    <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${avg}%"></div></div>
                                    <span style="font-size:.75rem;min-width:30px">${avg}%</span>
                                </div>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
    },

    _renderAttemptsTable(attempts) {
        const el = document.getElementById('attempts-table');
        if (!el) return;
        this._attemptRows = attempts;

        if (!attempts.length) {
            el.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted)">Попыток пока нет</div>`;
            return;
        }

        el.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Студент</th><th>Тест</th><th>Курс</th><th>Результат</th><th>Статус</th><th>Время</th><th>Дата</th>
                    </tr>
                </thead>
                <tbody>
                    ${attempts.slice(0, 100).map(a => `<tr>
                        <td><strong>${a.user?.full_name || '—'}</strong></td>
                        <td>${a.test?.title || '—'}</td>
                        <td style="color:var(--text-muted)">${a.test?.course?.title || '—'}</td>
                        <td><strong>${Math.round(a.percentage||0)}%</strong></td>
                        <td><span class="badge ${a.passed ? 'badge-success' : 'badge-danger'}">${a.passed ? 'Сдан' : 'Не сдан'}</span></td>
                        <td style="color:var(--text-muted)">${a.time_spent_seconds ? Math.floor(a.time_spent_seconds/60) + ' мин' : '—'}</td>
                        <td style="color:var(--text-muted);font-size:.78rem">${Fmt.datetime(a.completed_at)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;
    },

    filterStudents(e) {
        const q = e.target.value.toLowerCase();
        const rows = (this._studentRows || []).filter(r =>
            r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
        );
        this._renderStudentRows(rows, document.getElementById('students-table'));
    },

    async loadCourseStats() {
        const courseId = document.getElementById('analytics-course')?.value;
        if (!courseId) return;
        Loader.show();
        try {
            const stats = await API.analytics.getCourseStats(courseId);
            this._renderStudentsTable(stats.enrollments.map(e => ({ ...e, course: { title: '' } })));
            this._renderAttemptsTable(stats.attempts);
        } finally { Loader.hide(); }
    },

    // ── Export ────────────────────────────────────────────────────
    exportStudents() {
        const rows = (this._studentRows || []).map(r => ({
            'Имя':         r.name,
            'Email':       r.email,
            'Курсов':      r.courses,
            'Завершено':   r.completed,
            'Ср. прогресс': Math.round(r.avgProgress.reduce((s,v) => s+v, 0) / (r.avgProgress.length || 1)) + '%'
        }));
        Excel.export(rows, 'students_analytics', 'Студенты');
    },

    exportAttempts() {
        const rows = (this._attemptRows || []).map(a => ({
            'Студент':  a.user?.full_name,
            'Email':    a.user?.email,
            'Тест':     a.test?.title,
            'Курс':     a.test?.course?.title,
            'Результат': Math.round(a.percentage||0) + '%',
            'Статус':   a.passed ? 'Сдан' : 'Не сдан',
            'Время (мин)': a.time_spent_seconds ? Math.floor(a.time_spent_seconds/60) : '',
            'Дата':     Fmt.datetime(a.completed_at)
        }));
        Excel.export(rows, 'test_attempts', 'Попытки тестов');
    },

    exportAll() {
        this.exportStudents();
        setTimeout(() => this.exportAttempts(), 500);
    },

    // Cleanup charts on page leave
    destroy() {
        this._destroyCharts();
    }
};
