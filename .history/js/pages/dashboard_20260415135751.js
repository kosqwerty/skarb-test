// ================================================================
// EduFlow LMS — Головна сторінка (Dashboard)
// ================================================================

const DashboardPage = {
    async init(container) {
        UI.setBreadcrumb([{ label: 'Головна' }]);

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">
                    <h1>👋 Ласкаво просимо, ${AppState.profile?.full_name?.split(' ')[0] || 'користувачу'}</h1>
                    <p>${new Date().toLocaleDateString('uk-UA', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</p>
                </div>
            </div>
            <div id="dash-stats" class="stats-grid"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:2rem" class="dash-two-col">
                <div id="dash-activity"></div>
                <div id="dash-news-widget"></div>
            </div>
            <div id="dash-courses"></div>`;

        const [stats, enrollments, news] = await Promise.all([
            AppState.isStaff() ? API.analytics.getDashboardStats().catch(() => null) : null,
            API.enrollments.getMyEnrollments().catch(() => []),
            API.news.getAll({ published: true, pageSize: 4 }).catch(() => ({ data: [] }))
        ]);

        this._renderStats(stats, enrollments);
        this._renderRecentCourses(enrollments);
        this._renderActivity(enrollments);
        this._renderNewsWidget(news.data);
    },

    _renderStats(adminStats, enrollments) {
        const el = document.getElementById('dash-stats');
        if (!el) return;

        if (AppState.isStaff() && adminStats) {
            el.innerHTML = [
                { icon: '👥', label: 'Користувачів',    value: Fmt.num(adminStats.totalUsers),       color: '#6366F1' },
                { icon: '📚', label: 'Курсів',          value: Fmt.num(adminStats.totalCourses),     color: '#8B5CF6' },
                { icon: '🎓', label: 'Записів',         value: Fmt.num(adminStats.totalEnrollments), color: '#06B6D4' },
                { icon: '📝', label: 'Спроб тестів',    value: Fmt.num(adminStats.totalAttempts),    color: '#10B981' }
            ].map(s => `
                <div class="stat-card" style="--accent-color:${s.color}">
                    <div class="stat-icon">${s.icon}</div>
                    <div class="stat-value">${s.value}</div>
                    <div class="stat-label">${s.label}</div>
                </div>`).join('');
        } else {
            const completed  = enrollments.filter(e => e.completed_at).length;
            const avgProgress = enrollments.length
                ? Math.round(enrollments.reduce((s,e) => s + (e.progress_percentage||0), 0) / enrollments.length)
                : 0;
            el.innerHTML = [
                { icon: '📚', label: 'Моїх курсів',      value: enrollments.length,           color: '#6366F1' },
                { icon: '✅', label: 'Завершено',         value: completed,                    color: '#10B981' },
                { icon: '📊', label: 'Середній прогрес', value: `${avgProgress}%`,             color: '#06B6D4' },
                { icon: '🔥', label: 'В процесі',        value: enrollments.length - completed,color: '#F59E0B' }
            ].map(s => `
                <div class="stat-card" style="--accent-color:${s.color}">
                    <div class="stat-icon">${s.icon}</div>
                    <div class="stat-value">${s.value}</div>
                    <div class="stat-label">${s.label}</div>
                </div>`).join('');
        }
    },

    _renderRecentCourses(enrollments) {
        const el = document.getElementById('dash-courses');
        if (!el) return;
        const recent = enrollments.slice(0, 6);
        if (!recent.length) {
            el.innerHTML = `
                <h3 style="margin-bottom:1rem">Мої курси</h3>
                <div class="empty-state" style="padding:2rem">
                    <div class="empty-icon">📚</div>
                    <h3>Ви поки не записані на курси</h3>
                    <p>Перейдіть до каталогу курсів і розпочніть навчання</p>
                    <button class="btn btn-primary" onclick="Router.go('courses')">Знайти курси</button>
                </div>`;
            return;
        }
        el.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
                <h3>Мої курси</h3>
                <button class="btn btn-ghost btn-sm" onclick="Router.go('courses')">Всі курси →</button>
            </div>
            <div class="courses-grid">
                ${recent.map(e => this._courseCard(e)).join('')}
            </div>`;
    },

    _courseCard(enrollment) {
        const course = enrollment.course;
        const pct    = enrollment.progress_percentage || 0;
        const thumb  = course.thumbnail_url
            ? `<img src="${course.thumbnail_url}" alt="${course.title}" loading="lazy">`
            : `<div class="thumb-placeholder">📖</div>`;
        return `
            <div class="course-card" onclick="Router.go('courses/${course.id}')">
                <div class="course-thumbnail">${thumb}</div>
                <div class="course-body">
                    <h4 class="course-title">${course.title}</h4>
                    <div class="course-meta">
                        <span>👤 ${course.teacher?.full_name || 'Викладач'}</span>
                    </div>
                    <div class="course-progress-section">
                        <div class="course-progress-label">
                            <span>Прогрес</span><span>${Fmt.pct(pct)}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill ${pct === 100 ? 'success' : ''}" style="width:${pct}%"></div>
                        </div>
                    </div>
                </div>
            </div>`;
    },

    _renderActivity(enrollments) {
        const el = document.getElementById('dash-activity');
        if (!el) return;
        const items = enrollments.slice(0, 5);
        el.innerHTML = `
            <div class="card">
                <div class="card-header"><h3>Остання активність</h3></div>
                <div class="card-body" style="padding:0">
                    ${items.length ? items.map(e => `
                        <div style="display:flex;align-items:center;gap:1rem;padding:.875rem 1.25rem;border-bottom:1px solid var(--border);cursor:pointer"
                             onclick="Router.go('courses/${e.course.id}')">
                            <span style="font-size:1.5rem">📖</span>
                            <div style="flex:1;min-width:0">
                                <div style="font-weight:500;font-size:.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.course.title}</div>
                                <div style="font-size:.75rem;color:var(--text-muted)">Записаний ${Fmt.dateShort(e.enrolled_at)}</div>
                            </div>
                            <span class="badge ${e.completed_at ? 'badge-success' : 'badge-primary'}">${e.completed_at ? 'Завершено' : `${e.progress_percentage||0}%`}</span>
                        </div>`).join('')
                    : `<div style="padding:2rem;text-align:center;color:var(--text-muted)">Активності поки немає</div>`}
                </div>
            </div>`;
    },

    _renderNewsWidget(newsItems) {
        const el = document.getElementById('dash-news-widget');
        if (!el) return;
        el.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3>Останні новини</h3>
                    <button class="btn btn-ghost btn-sm" onclick="Router.go('news')">Всі →</button>
                </div>
                <div class="card-body" style="padding:0">
                    ${newsItems?.length ? newsItems.map(n => `
                        <div style="display:flex;align-items:flex-start;gap:1rem;padding:.875rem 1.25rem;border-bottom:1px solid var(--border);cursor:pointer"
                             onclick="Router.go('news/${n.id}')">
                            <span style="font-size:1.4rem;flex-shrink:0">📰</span>
                            <div style="flex:1;min-width:0">
                                <div style="font-weight:500;font-size:.875rem;margin-bottom:.25rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${n.title}</div>
                                <div style="font-size:.75rem;color:var(--text-muted)">${Fmt.dateShort(n.published_at || n.created_at)}</div>
                            </div>
                        </div>`).join('')
                    : `<div style="padding:2rem;text-align:center;color:var(--text-muted)">Новин поки немає</div>`}
                </div>
            </div>`;
    }
};
