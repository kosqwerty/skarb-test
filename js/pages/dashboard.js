// ================================================================
// EduFlow LMS — Головна сторінка (Dashboard) — WOW redesign
// ================================================================

const DashboardPage = {
    async init(container) {
        UI.setBreadcrumb([{ label: 'Головна' }]);

        const role   = AppState.profile?.role || 'user';
        const roleColors = {
            owner:   { from: '#7c3aed', to: '#4f46e5' },
            admin:   { from: '#4f46e5', to: '#0ea5e9' },
            smm:     { from: '#ec4899', to: '#8b5cf6' },
            teacher: { from: '#10b981', to: '#0ea5e9' },
            manager: { from: '#f59e0b', to: '#ef4444' },
            user:    { from: '#6366f1', to: '#8b5cf6' },
        };
        const colors = roleColors[role] || roleColors.user;

        container.innerHTML = `
        <style>
            .db-alert{border-radius:var(--radius-lg);padding:1rem 1.25rem;margin-bottom:1.5rem;border:1px solid;display:flex;gap:1rem;align-items:flex-start}
            .db-alert-warn{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.3)}
            .db-alert-danger{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3)}
            .db-alert-icon{font-size:1.5rem;flex-shrink:0;line-height:1}
            .db-alert-body{flex:1;min-width:0}
            .db-alert-title{font-weight:700;margin-bottom:.35rem;font-size:.9rem}
            .db-alert-items{display:flex;flex-wrap:wrap;gap:.4rem}
            .db-alert-chip{display:inline-flex;align-items:center;gap:.3rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.2rem .6rem;font-size:.78rem;cursor:pointer;transition:border-color .15s}
            .db-alert-chip:hover{border-color:var(--primary)}

            .db-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.25rem;margin-bottom:1.5rem}
            .db-grid3>:nth-child(2),.db-grid3>:nth-child(3),.db-grid3>:last-child{align-self:start}
            .db-grid2{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;margin-bottom:1.5rem}
            @media(max-width:1100px){.db-grid3{grid-template-columns:1fr 1fr}}
            @media(max-width:700px){.db-grid3,.db-grid2{grid-template-columns:1fr}}

            .db-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden}
            .db-card-head{padding:.75rem 1.1rem;font-size:1rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid var(--border);background:rgba(99,102,241,.025);display:flex;align-items:center;justify-content:space-between}
            .db-card-desc{padding:.45rem 1.1rem .55rem;font-size:.72rem;color:var(--text-muted);line-height:1.45;border-bottom:1px solid var(--border);background:var(--bg-raised)}
            .db-card-body{padding:1rem 1.1rem}

            .db-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1rem;margin-bottom:1.5rem}
            .db-stat{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);padding:1.1rem 1.25rem;display:flex;flex-direction:column;gap:.3rem;position:relative;overflow:hidden;transition:transform .15s,box-shadow .15s}
            .db-stat:hover{transform:translateY(-2px);box-shadow:var(--shadow-md)}
            .db-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--s-color)}
            .db-stat-icon{font-size:1.4rem;margin-bottom:.1rem}
            .db-stat-val{font-size:1.8rem;font-weight:800;color:var(--text-primary);line-height:1}
            .db-stat-label{font-size:.75rem;color:var(--text-muted);font-weight:500}

            .db-continue{display:flex;flex-direction:column;gap:0}
            .db-continue-thumb{height:145px;position:relative;overflow:hidden;background:#0f0c29;flex-shrink:0}
            .db-continue-thumb-bg{position:absolute;inset:-8px;background-size:cover;background-position:center;filter:blur(12px) brightness(.4);transform:scale(1.05)}
            .db-continue-thumb-main{position:absolute;inset:0;background-size:contain;background-repeat:no-repeat;background-position:center;z-index:1}
            .db-continue-body{padding:1rem;flex:1;display:flex;flex-direction:column;gap:.6rem}
            .db-continue-title{font-weight:700;font-size:.92rem;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
            .db-pbar{height:6px;background:var(--bg-raised);border-radius:3px;overflow:hidden}
            .db-pbar-fill{height:100%;background:linear-gradient(to right,${colors.from},${colors.to});border-radius:3px;transition:width .6s ease}

            .db-news-mini{display:flex;flex-direction:column}
            .db-news-hero{height:165px;position:relative;overflow:hidden;background:#0f0c29;cursor:pointer}
            .db-news-hero-bg{position:absolute;inset:-8px;background-size:cover;filter:blur(12px) brightness(.4);transform:scale(1.05)}
            .db-news-hero-main{position:absolute;inset:0;background-size:contain;background-repeat:no-repeat;z-index:1}
            .db-news-hero-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.7),transparent);z-index:2}
            .db-news-hero-title{position:absolute;bottom:.75rem;left:.85rem;right:.85rem;z-index:3;font-size:.85rem;font-weight:700;color:#fff;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
            .db-news-item{display:flex;gap:.75rem;padding:.6rem .85rem;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s}
            .db-news-item:hover{background:var(--bg-raised)}
            .db-news-item:last-child{border-bottom:none}
            .db-news-dot{width:6px;height:6px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:.4rem}
            .db-news-item-title{font-size:.82rem;font-weight:500;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1}
            .db-news-item-date{font-size:.72rem;color:var(--text-muted);flex-shrink:0;margin-top:.1rem}

            .db-event-item{display:flex;gap:.85rem;padding:.75rem 1rem;border-bottom:1px solid var(--border);align-items:flex-start}
            .db-event-item:last-child{border-bottom:none}
            .db-event-dot{width:36px;height:36px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0;font-weight:700}
            .db-event-title{font-size:.85rem;font-weight:600;line-height:1.35}
            .db-event-meta{font-size:.73rem;color:var(--text-muted);margin-top:.15rem}

            .db-courses-scroll{display:flex;gap:1rem;overflow-x:auto;padding-bottom:.5rem;scrollbar-width:thin}
            .db-courses-scroll::-webkit-scrollbar{height:4px}
            .db-courses-scroll::-webkit-scrollbar-track{background:var(--bg-raised);border-radius:2px}
            .db-courses-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
            .db-course-card{min-width:220px;max-width:220px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s;flex-shrink:0}
            .db-course-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-md);border-color:var(--primary)}
            .db-course-thumb{height:110px;overflow:hidden;background:var(--bg-raised)}
            .db-course-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
            .db-course-card:hover .db-course-thumb img{transform:scale(1.05)}
            .db-course-body{padding:.75rem}
            .db-course-name{font-size:.82rem;font-weight:600;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:.5rem}

            .db-main-grid{display:grid;grid-template-columns:1fr 1fr 390px;gap:1.25rem;margin-bottom:1.5rem;align-items:start}
            @media(max-width:1100px){.db-main-grid{grid-template-columns:1fr}}
            .db-news-w{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden}
            .db-news-w-head{padding:.75rem 1rem .6rem;border-bottom:1px solid var(--border);font-size:.95rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-primary);display:flex;align-items:center;justify-content:space-between;background:transparent}
            .db-news-grid{display:flex;flex-direction:column;gap:.5rem;padding:.65rem}
            .db-ncard{display:flex;gap:.65rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;cursor:pointer;transition:background .15s,box-shadow .15s,border-color .15s;align-items:stretch}
            .db-ncard:hover{background:var(--bg-raised);border-color:var(--border-light)}
            .db-ncard-thumb{flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--bg-raised);border-radius:var(--radius-md) 0 0 var(--radius-md)}
            .db-ncard-thumb img{max-width:150px;max-height:100px;width:auto;height:auto;display:block;object-fit:contain}
            .db-ncard-thumb-ph{width:80px;height:80px;flex-shrink:0;background:var(--bg-raised);display:flex;align-items:center;justify-content:center;font-size:1.6rem;border-radius:var(--radius-md) 0 0 var(--radius-md)}
            .db-ncard-body{flex:1;min-width:0;padding:.55rem .65rem .55rem 0;display:flex;flex-direction:column;justify-content:center}
            .db-ncard-title{font-size:.8rem;font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:.2rem}
            .db-ncard-desc{font-size:.71rem;color:var(--text-muted);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:.2rem}
            .db-ncard-date{font-size:.65rem;color:var(--text-muted)}
            .db-alc-w{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden;height:450px;display:flex;flex-direction:column}
            .db-alc-head{padding:.85rem 1.1rem .7rem;border-bottom:1px solid var(--border);font-size:1rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;display:flex;align-items:center;gap:.4rem;background:rgba(99,102,241,.025)}
            .db-alc-body{padding:.45rem 1rem .85rem;overflow-y:auto;flex:1;display:flex;flex-direction:column}
            .db-alc-label{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);display:flex;align-items:center;gap:.35rem;margin-bottom:.4rem}
            .db-alc-divider{border-top:1px solid var(--border);margin:.65rem 0}
            .db-alc-ok{display:flex;align-items:center;gap:.5rem;font-size:.78rem;color:var(--text-muted);padding:.35rem .1rem;line-height:1.4}
            .db-alc-ok i{flex-shrink:0;font-size:.95rem}
            .db-alc-warn{background:var(--bg-raised);border-radius:var(--radius-md);padding:.5rem .65rem;border:1px solid var(--border)}
            .db-alc-warn-head{display:flex;align-items:center;gap:.4rem;margin-bottom:.35rem;font-size:.8rem;font-weight:600}
            .db-alc-chips{display:flex;flex-direction:column;gap:.35rem;margin-top:.5rem}
            .db-alc-chip{display:inline-flex;align-items:center;gap:.3rem;font-size:.85rem;font-weight:400;padding:.22rem .6rem;border-radius:4px;background:var(--bg-surface);border:1px solid var(--border);color:var(--text-primary);cursor:pointer;transition:border-color .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .db-alc-chip i{color:var(--text-muted);font-size:.9rem;flex-shrink:0}
            .db-alc-chip:hover{border-color:var(--primary)}
            .db-alc-chip-more{color:var(--text-muted);background:var(--bg-raised)}
            .db-alc-danger-wrap{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.25);border-radius:var(--radius-md);padding:.7rem .85rem}
            .db-alc-danger-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.1rem}
            .db-alc-ok-wrap{background:rgba(16,185,129,.05);border:1px solid rgba(16,185,129,.2);border-radius:var(--radius-md);padding:.6rem .85rem;display:flex;align-items:center;gap:.5rem;font-size:.8rem;color:#065f46}
            .db-alc-ok-wrap i{color:#10b981;font-size:1rem;flex-shrink:0}
            .db-alc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:.5rem;padding:2rem;text-align:center}
            .db-alc-empty-icon{font-size:2.2rem;color:var(--text-muted);opacity:.4}
            .db-alc-empty-title{font-size:.88rem;font-weight:600;color:var(--text-muted)}
            .db-alc-empty-sub{font-size:.75rem;color:var(--text-muted);opacity:.7}
            .db-alc-nlist{display:flex;flex-direction:column;gap:.3rem}
            .db-alc-nitem{display:flex;align-items:center;gap:.55rem;padding:.4rem .5rem;border-radius:var(--radius-md);cursor:pointer;transition:background .12s;border:1px solid var(--border);background:var(--bg-surface)}
            .db-alc-nitem:hover{background:var(--bg-raised);border-color:var(--primary)}
            .db-alc-nicon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.95rem;flex-shrink:0}
            .db-alc-ntitle{font-size:.85rem;font-weight:500;color:var(--text-primary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
            .db-cal-w{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden}
            .db-cwrap{padding:1rem 1.1rem .75rem}
            .db-cnav{display:flex;align-items:center;justify-content:space-between;margin-bottom:.85rem}
            .db-cnav-left{display:flex;flex-direction:column;gap:.05rem}
            .db-cnav-title{font-size:.95rem;font-weight:700;color:var(--text-primary)}
            .db-cnav-sub{font-size:.72rem;color:var(--text-muted);font-weight:500;text-transform:capitalize}
            .db-cnav-arrows{display:flex;gap:.3rem}
            .db-cnav-btn{width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:var(--bg-raised);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.65rem;transition:all .15s;font-family:inherit}
            .db-cnav-btn:hover{background:rgba(99,102,241,.1);border-color:rgba(99,102,241,.4);color:var(--primary)}
            .db-cgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:1px}
            .db-cdow{font-size:.6rem;font-weight:600;color:var(--text-muted);text-align:center;padding:.15rem 0 .4rem;letter-spacing:.02em}
            .db-cday{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:.75rem;font-weight:500;color:var(--text-primary);cursor:pointer;transition:all .15s;margin:1px auto}
            .db-cday:hover:not(.db-today):not(.db-othm){background:rgba(99,102,241,.08)}
            .db-today{background:var(--primary);color:#fff;font-weight:700;box-shadow:0 3px 12px rgba(99,102,241,.4)}
            .db-has-ev:not(.db-today){background:rgba(99,102,241,.13);color:var(--primary);font-weight:600}
            .db-othm{color:var(--text-muted);opacity:.28;cursor:default;pointer-events:none}
            .db-cup-wrap{border-top:1px solid rgba(16,185,129,.2);padding:.75rem 1.1rem .65rem;background:rgba(16,185,129,.04)}
            .db-cup-title{font-size:.85rem;font-weight:700;color:var(--text-primary);margin-bottom:.55rem}
            .db-cup-list{display:flex;flex-direction:column;gap:.2rem;max-height:120px;overflow-y:auto;scrollbar-width:thin;padding-right:.2rem}
            .db-cup-list::-webkit-scrollbar{width:3px}
            .db-cup-list::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
            .db-cup-item{display:flex;gap:.65rem;align-items:flex-start;padding:.45rem .4rem;border-radius:var(--radius-md);cursor:pointer;transition:background .12s}
            .db-cup-item:hover{background:var(--bg-raised)}
            .db-cup-item.db-cup-done .db-cup-name{text-decoration:line-through;opacity:.5}
            .db-cup-badge{min-width:38px;padding:.3rem .2rem;border-radius:8px;background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.12);display:flex;flex-direction:column;align-items:center;flex-shrink:0;line-height:1.15}
            .db-cup-bday{font-size:.9rem;font-weight:800;color:var(--primary)}
            .db-cup-bmon{font-size:.55rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em}
            .db-cup-body{flex:1;min-width:0}
            .db-cup-name{font-size:.78rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .db-cup-chip{display:inline-flex;align-items:center;gap:.25rem;font-size:.65rem;font-weight:500;padding:.1rem .4rem;border-radius:999px;margin-top:.15rem}
            .db-cup-chip-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}
        </style>

        <!-- ── Important events ── -->
        <div id="db-important"></div>

        <!-- ── Birthdays ── -->
        <div id="db-birthdays"></div>

        <!-- ── Main grid: row1 = docs|notif|calendar, row2 = continue|empty|news ── -->
        <div class="db-main-grid">
            <div id="db-alerts-docs"></div>
            <div id="db-alerts-notif"></div>
            <div id="db-cal-widget"></div>
            <div style="grid-column:1/2"><div id="db-continue" class="db-card" style="width:350px"></div></div>
            <div></div>
            <div id="db-news-widget"></div>
        </div>

        `;

        // Load all data in parallel
        const _pad = n => String(n).padStart(2, '0');
        const _fmtLocal = d => `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`;
        const today = _fmtLocal(new Date());
        const in7   = _fmtLocal(new Date(Date.now() + 7 * 86400000));
        const _mn   = new Date();
        const monthStart = `${_mn.getFullYear()}-${_pad(_mn.getMonth()+1)}-01`;
        const monthEnd   = _fmtLocal(new Date(_mn.getFullYear(), _mn.getMonth() + 1, 0));

        const [enrollments, newsRes, birthdays, recentNotifs, calEvents] = await Promise.all([
            API.enrollments.getMyEnrollments().catch(() => []),
            API.news.getAll({ published: true, pageSize: 5 }).catch(() => ({ data: [] })),
            API.birthdays.getToday().catch(() => []),
            API.notifications.getMine().then(all => all.filter(n => !n.is_read).slice(0, 6)).catch(() => []),
            supabase.from('personal_cal_events')
                .select('id,title,date,time,end_time,color,is_important,is_done,acked_date,repeat_type')
                .eq('user_id', AppState.user.id)
                .gte('date', monthStart)
                .lte('date', monthEnd)
                .order('date').order('time', { nullsFirst: true })
                .then(r => r.data || [])
                .catch(() => []),
        ]);
        const unreadCount = recentNotifs.length;

        // Unacked docs
        const unackedDocs = await this._getUnackedDocs().catch(() => []);

        this._renderCalWidget(calEvents, today);
        this._renderImportantEvents(calEvents, today);
        this._renderAlerts(unackedDocs, recentNotifs);
        this._renderBirthdays(birthdays);
        this._renderContinue(enrollments);
        this._renderNewsWidget(newsRes.data || []);
    },


    _renderCalWidget(calEvents, today) {
        const now = new Date();
        this._calViewYear   = now.getFullYear();
        this._calViewMonth  = now.getMonth();
        this._calViewEvents = calEvents;
        this._calViewToday  = today;
        this._drawCalWidget();
    },

    async _calNav(dir) {
        this._calViewMonth += dir;
        if (this._calViewMonth < 0)  { this._calViewMonth = 11; this._calViewYear--; }
        if (this._calViewMonth > 11) { this._calViewMonth = 0;  this._calViewYear++; }
        const _p2 = n => String(n).padStart(2, '0');
        const _fl = d => `${d.getFullYear()}-${_p2(d.getMonth()+1)}-${_p2(d.getDate())}`;
        const ms = `${this._calViewYear}-${_p2(this._calViewMonth+1)}-01`;
        const me = _fl(new Date(this._calViewYear, this._calViewMonth + 1, 0));
        const { data } = await supabase.from('personal_cal_events')
            .select('id,title,date,time,end_time,color,is_important,is_done,acked_date,repeat_type')
            .eq('user_id', AppState.user.id)
            .gte('date', ms).lte('date', me)
            .order('date').order('time', { nullsFirst: true });
        this._calViewEvents = data || [];
        this._drawCalWidget();
    },

    _drawCalWidget() {
        const el = document.getElementById('db-cal-widget');
        if (!el) return;

        const { _calViewYear: year, _calViewMonth: month, _calViewEvents: calEvents, _calViewToday: today } = this;
        const now = new Date();

        // Build event map by date
        const evByDate = {};
        calEvents.forEach(ev => {
            if (!evByDate[ev.date]) evByDate[ev.date] = [];
            evByDate[ev.date].push(ev);
        });

        // Month grid cells (Mon-first)
        const firstDay = new Date(year, month, 1);
        const lastDay  = new Date(year, month + 1, 0);
        let startDow = firstDay.getDay();
        if (startDow === 0) startDow = 7;
        startDow -= 1;

        const cells = [];
        const _pd = n => String(n).padStart(2, '0');
        const _fd = d => `${d.getFullYear()}-${_pd(d.getMonth()+1)}-${_pd(d.getDate())}`;
        for (let i = 0; i < startDow; i++) {
            const d = new Date(year, month, 1 - startDow + i);
            cells.push({ date: _fd(d), day: d.getDate(), other: true });
        }
        for (let d = 1; d <= lastDay.getDate(); d++) {
            cells.push({ date: `${year}-${_pd(month+1)}-${_pd(d)}`, day: d, other: false });
        }
        const tail = cells.length % 7 ? 7 - (cells.length % 7) : 0;
        for (let i = 1; i <= tail; i++) {
            cells.push({ date: `${year}-${_pd(month+1 > 11 ? 1 : month+2)}-${_pd(i)}`, day: i, other: true });
        }

        const dows = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
        const monthLabel = new Date(year, month, 1).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
        const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

        const gridHtml = cells.map(c => {
            const evs = c.other ? [] : (evByDate[c.date] || []);
            const isToday = c.date === today;
            const cls = ['db-cday',
                isToday ? 'db-today' : '',
                !c.other && evs.length && !isToday ? 'db-has-ev' : '',
                c.other ? 'db-othm' : ''
            ].filter(Boolean).join(' ');
            const tip = evs.map(e => Fmt.esc(e.title)).join(', ');
            const dayOnclick = c.other ? `Router.go('my-calendar')` : `DashboardPage._calDayClick('${c.date}')`;
            return `<div class="${cls}" onclick="${dayOnclick}"${tip ? ` title="${tip}"` : ''}>${c.day}</div>`;
        }).join('');

        // Upcoming list — events from today (or all in viewed month if past)
        const listCutoff = isCurrentMonth ? today : `${year}-${_pd(month+1)}-01`;
        const upcoming = calEvents
            .filter(ev => ev.date >= listCutoff)
            .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));

        const fmtBadge = dateStr => {
            const d = new Date(dateStr + 'T00:00:00');
            return {
                day: d.getDate(),
                mon: d.toLocaleDateString('uk-UA', { month: 'short' }).replace('.', '')
            };
        };

        const chipHtml = ev => {
            const color = ev.color || '#6366f1';
            const hex22 = color + '22';
            if (ev.is_important) return `<span class="db-cup-chip" style="background:rgba(245,158,11,.1);color:#b45309"><span class="db-cup-chip-dot" style="background:#f59e0b"></span>Важлива</span>`;
            if (ev.time) return `<span class="db-cup-chip" style="background:${hex22};color:${color}"><span class="db-cup-chip-dot" style="background:${color}"></span>${ev.time.slice(0, 5)}${ev.end_time ? '–' + ev.end_time.slice(0, 5) : ''}</span>`;
            if (ev.repeat_type && ev.repeat_type !== 'none') return `<span class="db-cup-chip" style="background:rgba(16,185,129,.1);color:#059669"><span class="db-cup-chip-dot" style="background:#10b981"></span>Повторюється</span>`;
            return `<span class="db-cup-chip" style="background:${hex22};color:${color}"><span class="db-cup-chip-dot" style="background:${color}"></span>Весь день</span>`;
        };

        const upcomingHtml = upcoming.length
            ? upcoming.slice(0, 10).map(ev => {
                const b = fmtBadge(ev.date);
                return `
                <div class="db-cup-item${ev.is_done ? ' db-cup-done' : ''}" onclick="Router.go('my-calendar')">
                    <div class="db-cup-badge">
                        <span class="db-cup-bday">${b.day}</span>
                        <span class="db-cup-bmon">${b.mon}</span>
                    </div>
                    <div class="db-cup-body">
                        <div class="db-cup-name">${Fmt.esc(ev.title)}</div>
                        ${chipHtml(ev)}
                    </div>
                </div>`;
              }).join('')
            : `<div style="padding:.75rem .5rem;text-align:center;font-size:.82rem;color:var(--text-muted)"><i class="fa-regular fa-calendar-check"></i> Подій немає</div>`;

        el.innerHTML = `
            <div class="db-cal-w">
                <div class="db-cwrap">
                    <div class="db-cnav">
                        <div class="db-cnav-left">
                            <div class="db-cnav-title">Мій календар</div>
                            <div class="db-cnav-sub">${monthLabel}</div>
                        </div>
                        <div class="db-cnav-arrows">
                            <button class="db-cnav-btn" onclick="DashboardPage._calNav(-1)" title="Попередній місяць"><i class="fa-solid fa-chevron-left"></i></button>
                            <button class="db-cnav-btn" onclick="DashboardPage._calNav(1)" title="Наступний місяць"><i class="fa-solid fa-chevron-right"></i></button>
                        </div>
                    </div>
                    <div class="db-cgrid">
                        ${dows.map(d => `<div class="db-cdow">${d}</div>`).join('')}
                        ${gridHtml}
                    </div>
                </div>
                <div class="db-cup-wrap">
                    <div class="db-cup-title">Майбутні події</div>
                    <div class="db-cup-list">${upcomingHtml}</div>
                </div>
            </div>`;
    },

    async _getUnackedDocs() {
        const { data } = await supabase.from('resources')
            .select('id, title, deadline_days, doc_version')
            .eq('is_tracked_download', true)
            .is('deleted_at', null)
            .limit(50);
        if (!data?.length) return [];
        const ackMap = await API.documentDownloads.getMyLatest(data.map(d => d.id));
        // Unacked = never downloaded OR downloaded version is older than current
        return data.filter(d => {
            const ack = ackMap[d.id];
            if (!ack) return true;
            return (ack.version || 1) < (d.doc_version || 1);
        });
    },

    _renderImportantEvents(calEvents, today) {
        const el = document.getElementById('db-important');
        if (!el) return;
        const important = calEvents.filter(ev => ev.is_important && ev.date === today);
        if (!important.length) return;

        // Filter out already acknowledged (acked_date stored in DB)
        const pending = important.filter(ev => ev.acked_date !== today);
        if (!pending.length) return;

        el.innerHTML = pending.map(ev => `
            <div id="db-imp-${ev.id}" style="display:flex;align-items:center;gap:1rem;background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(239,68,68,.08));border:1px solid rgba(245,158,11,.4);border-radius:var(--radius-lg);padding:1rem 1.25rem;margin-bottom:1rem;flex-wrap:wrap">
                <span style="font-size:1.5rem;flex-shrink:0">⚡</span>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;color:#92400e;font-size:.82rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">Важлива подія сьогодні</div>
                    <div style="font-weight:600;font-size:.95rem">${Fmt.esc(ev.title)}</div>
                    ${ev.time ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.1rem"><i class="fa-regular fa-clock"></i> ${ev.time.slice(0,5)}</div>` : ''}
                </div>
                <button class="btn btn-sm" style="background:#f59e0b;color:#fff;border:none;flex-shrink:0"
                    onclick="DashboardPage._ackImportant('${ev.id}','${today}')">
                    <i class="fa-solid fa-check"></i> Підтверджую
                </button>
            </div>`).join('');
    },


    async _ackImportant(eventId, date) {
        const { error } = await supabase.from('personal_cal_events')
            .update({ acked_date: date, is_done: true })
            .eq('id', eventId).eq('user_id', AppState.user.id);
        if (error) { Toast.error('Помилка збереження'); return; }
        const el = document.getElementById(`db-imp-${eventId}`);
        if (el) { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }
    },

    _renderAlerts(unackedDocs, recentNotifs) {
        const docsEl  = document.getElementById('db-alerts-docs');
        const notifEl = document.getElementById('db-alerts-notif');
        const unreadCount = recentNotifs.length;

        if (docsEl) {
            const body = unackedDocs.length
                ? `<div class="db-alc-danger-wrap">
                    <div class="db-alc-danger-head">
                        <i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b;font-size:1.1rem;flex-shrink:0"></i>
                        <span style="color:var(--danger);font-weight:700;font-size:.85rem">Не ознайомлені з ${unackedDocs.length} документ${unackedDocs.length > 1 ? 'ами' : 'ом'}</span>
                    </div>
                    <div class="db-alc-chips">
                        ${unackedDocs.slice(0, 8).map(d => `
                            <span class="db-alc-chip" onclick="Router.go('documents')">
                                <i class="fa-regular fa-file-lines"></i>${Fmt.esc(d.title)}
                            </span>`).join('')}
                        ${unackedDocs.length > 8 ? `<span class="db-alc-chip db-alc-chip-more" onclick="Router.go('documents')">ще ${unackedDocs.length - 8}…</span>` : ''}
                    </div>
                   </div>`
                : `<div class="db-alc-empty">
                    <i class="fa-regular fa-folder-open db-alc-empty-icon"></i>
                    <div class="db-alc-empty-title">Документи в порядку</div>
                    <div class="db-alc-empty-sub">Ознайомлений з усією документацією</div>
                   </div>`;

            docsEl.innerHTML = `
                <div class="db-alc-w">
                    <div class="db-alc-head"><i class="fa-regular fa-file-lines"></i> Документи</div>
                    <div class="db-alc-body">${body}</div>
                </div>`;
        }

        if (notifEl) {
            const typeMap = t => {
                if (!t) return { icon:'fa-bell', color:'#8b5cf6', bg:'rgba(139,92,246,.12)' };
                if (t.includes('test'))   return { icon:'fa-clipboard-list',  color:'#f59e0b', bg:'rgba(245,158,11,.12)' };
                if (t.includes('course') || t.includes('enroll')) return { icon:'fa-graduation-cap', color:'#3b82f6', bg:'rgba(59,130,246,.12)' };
                if (t.includes('survey')) return { icon:'fa-chart-bar',       color:'#8b5cf6', bg:'rgba(139,92,246,.12)' };
                if (t.includes('doc') || t.includes('resource')) return { icon:'fa-file-lines', color:'#ef4444', bg:'rgba(239,68,68,.12)' };
                return { icon:'fa-bell', color:'#6366f1', bg:'rgba(99,102,241,.12)' };
            };
            const body = unreadCount > 0
                ? `<div id="db-alc-notif">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.45rem">
                        <span style="font-size:.75rem;color:var(--text-muted)">${unreadCount} непрочитаних</span>
                        <span style="font-size:.7rem;color:var(--primary);cursor:pointer" onclick="DashboardPage._dismissNotifAlert()"><i class="fa-solid fa-check-double"></i> Прочитати всі</span>
                    </div>
                    <div class="db-alc-nlist">
                        ${recentNotifs.slice(0, 5).map(n => {
                            const m = typeMap(n.type);
                            const dest = n.link ? JSON.stringify(n.link).replace(/"/g,'&quot;') : '&quot;notifications&quot;';
                            return `<div class="db-alc-nitem" onclick="DashboardPage._openNotif('${n.id}',${dest})">
                                <div class="db-alc-nicon" style="background:${m.bg};color:${m.color}"><i class="fa-solid ${m.icon}"></i></div>
                                <div style="flex:1;min-width:0;overflow:hidden">
                                    <div class="db-alc-ntitle">${Fmt.esc(n.title)}</div>
                                    ${n.message ? `<div style="font-size:.72rem;color:var(--text-muted);margin-top:1px">${Fmt.esc(n.message)}</div>` : ''}
                                </div>
                                <i class="fa-solid fa-chevron-right" style="font-size:.6rem;color:var(--text-muted);flex-shrink:0"></i>
                            </div>`;
                        }).join('')}
                        ${unreadCount > 5 ? `<div style="text-align:center;font-size:.72rem;color:var(--primary);cursor:pointer;padding:.25rem" onclick="Router.go('notifications')">ще ${unreadCount - 5}… <i class="fa-solid fa-arrow-right"></i></div>` : ''}
                    </div>
                   </div>`
                : `<div class="db-alc-empty">
                    <i class="fa-regular fa-bell-slash db-alc-empty-icon"></i>
                    <div class="db-alc-empty-title">Немає сповіщень</div>
                    <div class="db-alc-empty-sub">Усі сповіщення прочитані</div>
                   </div>`;

            notifEl.innerHTML = `
                <div class="db-alc-w">
                    <div class="db-alc-head"><i class="fa-regular fa-bell"></i> Сповіщення</div>
                    <div class="db-alc-body">${body}</div>
                </div>`;
        }
    },

    _calDayClick(date) {
        MyCalendarPage._pendingNewDate = date;
        Router.go('my-calendar');
    },

    async _openNotif(id, link) {
        await API.notifications.markRead(id).catch(() => {});
        UI.updateNotificationBadge(-1);
        Router.go(link);
    },

    async _dismissNotifAlert() {
        await API.notifications.markAllRead().catch(() => {});
        const el = document.getElementById('db-alc-notif');
        if (!el) return;
        el.style.transition = 'opacity .25s';
        el.style.opacity = '0';
        setTimeout(() => {
            el.outerHTML = `<div class="db-alc-empty">
                <i class="fa-regular fa-bell-slash db-alc-empty-icon"></i>
                <div class="db-alc-empty-title">Немає сповіщень</div>
                <div class="db-alc-empty-sub">Усі сповіщення прочитані</div>
            </div>`;
        }, 250);
    },

    _renderBirthdays(people) {
        const el = document.getElementById('db-birthdays');
        if (!el || !people.length) return;

        this._bdayPeople = people;

        const cards = people.map(p => {
            const initials = Fmt.initials(p.full_name || '?');
            const fallbackHtml = `<span style="font-size:1.6rem;font-weight:800;color:#fff;line-height:1">${Fmt.esc(initials)}</span>`;
            const avatarHtml = p.avatar_url
                ? `<img src="${p.avatar_url}" alt="${Fmt.esc(p.full_name)}" style="width:100%;height:100%;object-fit:cover;display:block"
                       onerror="this.replaceWith(Object.assign(document.createElement('span'),{innerHTML:'${Fmt.esc(initials)}',style:'font-size:1.6rem;font-weight:800;color:#fff;line-height:1'}))">`
                : fallbackHtml;
            return `
                <div class="db-bday-card">
                    <div class="db-bday-avatar-ring">
                        <div class="db-bday-avatar">${avatarHtml}</div>
                    </div>
                    <div class="db-bday-name">${Fmt.esc(p.full_name || '—')}</div>
                    ${p.job_position ? `<div class="db-bday-pos">${Fmt.esc(p.job_position)}</div>` : ''}
                    <div class="db-bday-badge">🎂 День народження</div>
                    ${p.id !== AppState.user?.id ? `
                    <button class="db-bday-wish-btn" style="margin-top:.3rem"
                        data-bday-btn="${p.id}"
                        onclick="DashboardPage._openWishModal('${p.id}')">
                        💌 Привітати
                    </button>` : ''}
                </div>`;
        }).join('');

        el.innerHTML = `
            <style>
                @keyframes db-confetti-fall{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(80px) rotate(720deg);opacity:0}}
                @keyframes db-bday-glow{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.4)}50%{box-shadow:0 0 0 10px rgba(245,158,11,0)}}
                @keyframes db-bday-pop{0%{transform:scale(.85);opacity:0}100%{transform:scale(1);opacity:1}}
                @keyframes db-wish-in{0%{transform:translateY(12px);opacity:0}100%{transform:translateY(0);opacity:1}}
                .db-bday-wrap{position:relative;overflow:hidden;border-radius:var(--radius-xl);margin-bottom:1.5rem;
                    background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 40%,#fde68a 100%);
                    border:2px solid rgba(245,158,11,.4);padding:2rem 1.5rem 1.75rem;text-align:center}
                body.dark-theme .db-bday-wrap{background:linear-gradient(135deg,rgba(120,80,0,.35) 0%,rgba(180,110,0,.25) 50%,rgba(120,70,0,.3) 100%);border-color:rgba(245,158,11,.35)}
                .db-bday-confetti{position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;overflow:hidden}
                .db-bday-conf-dot{position:absolute;border-radius:2px;animation:db-confetti-fall linear infinite}
                .db-bday-headline{font-size:1.45rem;font-weight:800;color:#92400e;letter-spacing:-.01em;margin-bottom:.25rem}
                body.dark-theme .db-bday-headline{color:#fcd34d}
                .db-bday-sub{font-size:.85rem;color:#b45309;margin-bottom:1.75rem;opacity:.8}
                body.dark-theme .db-bday-sub{color:#fbbf24}
                .db-bday-list{display:flex;flex-wrap:wrap;justify-content:center;gap:2rem}
                .db-bday-card{display:flex;flex-direction:column;align-items:center;gap:.45rem;animation:db-bday-pop .4s ease both}
                .db-bday-avatar-ring{width:90px;height:90px;border-radius:50%;padding:3px;background:linear-gradient(135deg,#f59e0b,#ef4444,#ec4899);
                    animation:db-bday-glow 2.2s ease-in-out infinite;flex-shrink:0}
                .db-bday-avatar{width:100%;height:100%;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);
                    display:flex;align-items:center;justify-content:center;overflow:hidden;border:2px solid #fff}
                .db-bday-name{font-size:1rem;font-weight:700;color:#1c1917;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;text-align:center}
                body.dark-theme .db-bday-name{color:#fef3c7}
                .db-bday-pos{font-size:.75rem;color:#78350f;opacity:.85;text-align:center}
                body.dark-theme .db-bday-pos{color:#fcd34d;opacity:.7}
.db-bday-badge{display:inline-flex;align-items:center;gap:.3rem;font-size:.72rem;font-weight:700;
                    background:rgba(245,158,11,.2);border:1px solid rgba(245,158,11,.4);border-radius:999px;
                    padding:.2rem .7rem;color:#92400e;margin-top:.1rem}
                body.dark-theme .db-bday-badge{background:rgba(245,158,11,.15);color:#fcd34d}
                .db-bday-wish-btn{display:inline-flex;align-items:center;gap:.4rem;background:linear-gradient(135deg,#f59e0b,#d97706);
                    color:#fff;border:none;border-radius:var(--radius-md);padding:.45rem 1rem;font-size:.8rem;font-weight:700;
                    cursor:pointer;transition:opacity .15s,transform .1s;white-space:nowrap;font-family:inherit}
                .db-bday-wish-btn:hover{opacity:.9;transform:translateY(-1px)}
                .db-bday-wish-btn:active{transform:translateY(0)}
                .db-bday-wish-btn:disabled{opacity:.45;cursor:default;transform:none}
            </style>
            <div class="db-bday-wrap">
                <div class="db-bday-confetti" id="db-bday-conf"></div>
                <div class="db-bday-headline">🎉 Сьогодні день народження!</div>
                <div class="db-bday-sub">Вітаємо колег з особливим днем</div>
                <div class="db-bday-list">${cards}</div>
            </div>`;

        const confEl = document.getElementById('db-bday-conf');
        if (confEl) {
            const colors = ['#f59e0b','#ef4444','#ec4899','#8b5cf6','#10b981','#3b82f6','#f97316'];
            for (let i = 0; i < 32; i++) {
                const d = document.createElement('div');
                d.className = 'db-bday-conf-dot';
                d.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*-20}%;background:${colors[i%colors.length]};width:${5+Math.random()*7}px;height:${5+Math.random()*7}px;animation-duration:${2.5+Math.random()*3}s;animation-delay:${Math.random()*4}s`;
                confEl.appendChild(d);
            }
        }
    },

    _openWishModal(personId) {
        const p = (this._bdayPeople || []).find(x => x.id === personId);
        if (!p) return;
        Modal.open({
            title: `🎂 Привітання для ${Fmt.esc(p.full_name || '?')}`,
            size: 'sm',
            body: `
                <div style="margin-bottom:.65rem;font-size:.82rem;color:var(--text-muted)">
                    Привітання прийде у сповіщення іменинника
                </div>
                <textarea id="db-bday-wish-text" rows="4" style="width:100%;border:1px solid var(--border);
                    border-radius:var(--radius-md);padding:.65rem .85rem;font-size:.9rem;line-height:1.55;
                    resize:none;background:var(--bg-surface);color:var(--text-primary);font-family:inherit;
                    box-sizing:border-box;outline:none;transition:border-color .15s"
                    placeholder="Щиро вітаю з Днем народження! Бажаю…"
                    onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='var(--border)'"></textarea>`,
            footer: `
                <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" id="db-bday-send-btn"
                    onclick="DashboardPage._sendBdayWish('${personId}', this)"
                    style="background:linear-gradient(135deg,#f59e0b,#d97706);border-color:transparent">
                    🎊 Надіслати
                </button>`
        });
        setTimeout(() => document.getElementById('db-bday-wish-text')?.focus(), 100);
    },

    async _sendBdayWish(personId, btn) {
        const text = (document.getElementById('db-bday-wish-text')?.value || '').trim();
        if (!text) { Toast.warning('Порожнє поле', 'Напишіть привітання перед відправкою'); return; }
        btn.disabled = true;
        btn.textContent = 'Надсилаю…';
        const from = AppState.profile?.full_name || 'Колега';
        const p = (this._bdayPeople || []).find(x => x.id === personId);
        try {
            await API.notifications.create({
                user_id: personId,
                title: `🎂 Привітання від ${from}`,
                message: text,
                type: 'birthday_wish',
                link: null
            });
            Modal.close();
            const btn = document.querySelector(`[data-bday-btn="${personId}"]`);
            if (btn) { btn.textContent = '✅ Надіслано'; btn.disabled = true; btn.style.opacity = '.5'; }
            Toast.success('Надіслано! 🎉', `Привітання для ${p?.full_name || ''} відправлено`);
        } catch(e) {
            btn.disabled = false;
            btn.textContent = '🎊 Надіслати';
            Toast.error('Помилка', e.message);
        }
    },


    _renderContinue(enrollments) {
        const el = document.getElementById('db-continue');
        if (!el) return;
        const next = enrollments.find(e => !e.completed_at) || enrollments[0];

        el.innerHTML = `<div class="db-card-head"><span style="color:var(--text-primary)"><i class="fa-solid fa-play"></i> Продовжити навчання</span></div>
            <div class="db-card-desc">Ваш поточний курс та прогрес проходження</div>`;

        if (!next) {
            el.innerHTML += `<div class="db-card-body" style="text-align:center;padding:2rem;color:var(--text-muted)">
                <div style="font-size:2rem;margin-bottom:.5rem">🎉</div>
                <div style="font-weight:600">Всі курси завершено!</div>
                <button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="Router.go('expert-path')">Знайти нові</button>
            </div>`;
            return;
        }

        const course = next.course;
        const pct    = next.progress_percentage || 0;
        const thumb  = course.thumbnail_url;

        el.innerHTML += `
            <div class="db-continue">
                <div class="db-continue-thumb" onclick="Router.go('courses/${course.id}?from=expert-path')" style="cursor:pointer">
                    ${thumb
                        ? `<div class="db-continue-thumb-bg" style="background-image:url('${thumb}')"></div>
                           <div class="db-continue-thumb-main" style="background-image:url('${thumb}')"></div>`
                        : `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:2.5rem;position:relative;z-index:1">📖</div>`}
                </div>
                <div class="db-continue-body">
                    <div class="db-continue-title">${Fmt.esc(course.title)}</div>
                    <button class="btn btn-primary btn-sm" style="margin-top:.75rem;width:100%" onclick="Router.go('courses/${course.id}?from=expert-path')">
                        <i class="fa-solid fa-play"></i> Перейти до курсу
                    </button>
                </div>
            </div>`;
    },

    _renderNewsWidget(items) {
        const el = document.getElementById('db-news-widget');
        if (!el) return;

        items.forEach(n => { this._newsCache[n.id] = n; });

        const newsCard = n => {
            const url = Fmt.safeUrl(n.thumbnail_url);
            const thumb = n.thumbnail_url
                ? `<div class="db-ncard-thumb"><img src="${url}" alt="" loading="lazy"></div>`
                : `<div class="db-ncard-thumb-ph">📰</div>`;
            const desc = n.excerpt
                ? `<div class="db-ncard-desc">${Fmt.esc(n.excerpt)}</div>`
                : '';
            return `
            <div class="db-ncard" onclick="DashboardPage._openNewsModal('${n.id}')">
                ${thumb}
                <div class="db-ncard-body">
                    <div class="db-ncard-title">${Fmt.esc(n.title)}</div>
                    ${desc}
                    <div class="db-ncard-date">${Fmt.dateShort(n.published_at || n.created_at)}</div>
                </div>
            </div>`;
        };

        const body = items.length
            ? `<div class="db-news-grid">${items.slice(0, 3).map(newsCard).join('')}</div>`
            : `<div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:.82rem">Новин поки немає</div>`;

        el.innerHTML = `
            <div class="db-news-w">
                <div class="db-news-w-head">
                    <span><i class="fa-regular fa-newspaper"></i> Новини</span>
                    <button class="btn btn-ghost btn-sm" onclick="Router.go('news')" style="font-size:.68rem">Всі <i class="fa-solid fa-arrow-right"></i></button>
                </div>
                ${body}
            </div>`;
    },

    _newsCache: {},

    async _toggleEmoji(newsId, emoji, btn) {
        try {
            const added = await API.news.toggleEmoji(newsId, emoji);
            btn.classList.toggle('active', added);
            const countEl = btn.querySelector('.dnm-r-count');
            let count = parseInt(countEl.textContent) || 0;
            count = added ? count + 1 : Math.max(0, count - 1);
            countEl.textContent = count || '';
            btn.style.transform = 'scale(1.25)';
            setTimeout(() => { btn.style.transform = ''; }, 200);
        } catch(e) { Toast.error('Помилка', e.message); }
    },

    async _toggleNewsBm(id, title, btn) {
        await Bookmarks.toggleNews(id, title);
        const bookmarked = Bookmarks.isBookmarked(`news/${id}`);
        btn.classList.toggle('bookmarked', bookmarked);
        btn.innerHTML = bookmarked ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>';
        btn.style.transform = 'scale(1.3)';
        setTimeout(() => { btn.style.transform = ''; }, 200);
    },

    async _openNewsModal(id) {
        let n = this._newsCache[id];
        if (!n) {
            try {
                const { data } = await API.news.getById(id);
                n = data;
                this._newsCache[id] = n;
            } catch(e) { Toast.error('Помилка завантаження новини'); return; }
        }

        const url = n.thumbnail_url ? Fmt.safeUrl(n.thumbnail_url) : null;
        const pos = n.thumbnail_position || 'center';
        const date = Fmt.date(n.published_at || n.created_at);

        const body = `
        <style>
        .dnm-wrap { font-family: inherit; }
        .dnm-hero {
            width: calc(100% + 3rem);
            margin: -1.5rem -1.5rem 1.25rem;
            height: 220px;
            background: #0f1f42;
            position: relative;
            overflow: hidden;
        }
        .dnm-hero-bg {
            position: absolute; inset: -12px;
            background-image: url('${url || ''}');
            background-size: cover;
            background-position: ${pos};
            filter: blur(18px) brightness(.35);
            transform: scale(1.1);
        }
        .dnm-hero-img {
            position: absolute; inset: 0;
            background-image: url('${url || ''}');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            z-index: 1;
        }
        .dnm-hero-grad {
            position: absolute; inset: 0;
            background: linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 60%);
            z-index: 2;
        }
        .dnm-meta {
            display: flex; align-items: center; justify-content: space-between;
            margin-bottom: .75rem;
        }
        .dnm-date {
            font-size: .75rem;
            color: var(--text-muted);
            display: flex; align-items: center; gap: .4rem;
        }
        .dnm-bm-btn {
            background: none; border: none; cursor: pointer;
            font-size: 1.15rem; color: var(--text-muted);
            transition: color .2s, transform .2s;
            padding: .2rem .4rem;
            border-radius: 6px;
            line-height: 1;
        }
        .dnm-bm-btn:hover { color: var(--primary); transform: scale(1.15); }
        .dnm-bm-btn.bookmarked { color: #f59e0b; }
        .dnm-bm-btn.bookmarked:hover { color: #d97706; }
        .dnm-reactions { display: flex; gap: .4rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .dnm-reaction {
            display: inline-flex; align-items: center; gap: .3rem;
            padding: .25rem .6rem;
            border-radius: 99px;
            border: 1.5px solid var(--border);
            background: var(--bg-raised);
            cursor: pointer; font-size: .95rem;
            transition: all .18s cubic-bezier(.4,0,.2,1);
            user-select: none;
        }
        .dnm-reaction:hover { border-color: var(--primary); background: rgba(37,99,235,.07); transform: scale(1.08); }
        .dnm-reaction.active { border-color: #f59e0b; background: rgba(245,158,11,.12); }
        .dnm-reaction .dnm-r-count { font-size: .72rem; font-weight: 600; color: var(--text-muted); min-width: 8px; }
        .dnm-content { font-size: .9rem; line-height: 1.7; color: var(--text-secondary); }
        .dnm-content img { max-width: 100%; border-radius: 8px; margin: .5rem 0; }
        .dnm-footer { display: flex; justify-content: flex-end; gap: .5rem; padding-top: .5rem; }
        </style>
        <div class="dnm-wrap">
            ${url ? `<div class="dnm-hero"><div class="dnm-hero-bg"></div><div class="dnm-hero-img"></div><div class="dnm-hero-grad"></div></div>` : ''}
            <div class="dnm-meta">
                <div class="dnm-date"><i class="fa-regular fa-calendar"></i> ${date}</div>
                <button class="dnm-bm-btn ${Bookmarks.isBookmarked(`news/${n.id}`) ? 'bookmarked' : ''}" id="dnm-bm-${n.id}" onclick="DashboardPage._toggleNewsBm('${n.id}', ${JSON.stringify(n.title).replace(/"/g,'&quot;')}, this)" title="Закладки">
                    ${Bookmarks.isBookmarked(`news/${n.id}`) ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>'}
                </button>
            </div>
            <div class="dnm-reactions" id="dnm-reactions-${n.id}">
                ${['👍','❤️','😂','😮','👏','🔥'].map(e => `
                <button class="dnm-reaction" data-emoji="${e}" onclick="DashboardPage._toggleEmoji('${n.id}', '${e}', this)">
                    ${e} <span class="dnm-r-count">0</span>
                </button>`).join('')}
            </div>
            <div class="dnm-content">${n.content || n.excerpt || ''}</div>
        </div>`;

        const footer = `
        <div class="dnm-footer">
            <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Закрити</button>
            <button class="btn btn-primary btn-sm" onclick="Modal.close();Router.go('news/${n.slug || n.id}')">
                Читати повністю <i class="fa-solid fa-arrow-right"></i>
            </button>
        </div>`;

        Modal.open({ title: Fmt.esc(n.title), body, footer, size: 'lg' });

        // завантажити реакції
        API.news.getEmojiReactions(n.id).then(({ counts, myEmojis }) => {
            const wrap = document.getElementById(`dnm-reactions-${n.id}`);
            if (!wrap) return;
            wrap.querySelectorAll('.dnm-reaction').forEach(btn => {
                const e = btn.dataset.emoji;
                btn.querySelector('.dnm-r-count').textContent = counts[e] || '';
                if (myEmojis.has(e)) btn.classList.add('active');
            });
        }).catch(() => {});

        // вау-анімація появи модального вікна
        requestAnimationFrame(() => {
            const box = document.getElementById('modal-box');
            if (!box) return;
            box.style.opacity = '0';
            box.style.transform = 'translateY(30px) scale(0.97)';
            box.style.transition = 'none';
            requestAnimationFrame(() => {
                box.style.transition = 'opacity .4s cubic-bezier(.4,0,.2,1), transform .4s cubic-bezier(.34,1.56,.64,1)';
                box.style.opacity = '1';
                box.style.transform = 'translateY(0) scale(1)';
            });
        });
    },

};
