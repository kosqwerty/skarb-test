// ================================================================
// EduFlow LMS — Планувальник сповіщень
// Access: owner, admin, manager
// Owner extra: see who created what, full send log
//
// SQL (run once in Supabase SQL Editor):
// ----------------------------------------------------------------
// ALTER TABLE profiles
//   DROP CONSTRAINT IF EXISTS profiles_role_check,
//   ADD CONSTRAINT profiles_role_check
//     CHECK (role IN ('owner','admin','smm','teacher','manager','user'));
//
// CREATE TABLE IF NOT EXISTS scheduled_notifications (
//   id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   title        text NOT NULL,
//   message      text NOT NULL,
//   scheduled_at timestamptz NOT NULL,
//   type         text NOT NULL DEFAULT 'general'
//                  CHECK (type IN ('gold','tech','general')),
//   recipients   jsonb NOT NULL DEFAULT '[]',
//   repeat_type  text NOT NULL DEFAULT 'none'
//                  CHECK (repeat_type IN ('none','daily','weekly')),
//   status       text NOT NULL DEFAULT 'pending'
//                  CHECK (status IN ('pending','sent','cancelled')),
//   created_by   uuid REFERENCES profiles(id) ON DELETE SET NULL,
//   sent_at      timestamptz,
//   send_log     jsonb NOT NULL DEFAULT '[]',
//   created_at   timestamptz DEFAULT now(),
//   updated_at   timestamptz DEFAULT now()
// );
//
// ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "scheduler_access" ON scheduled_notifications
//   USING (EXISTS (
//     SELECT 1 FROM profiles
//     WHERE profiles.id = auth.uid()
//     AND profiles.role IN ('owner','admin','manager')
//   ))
//   WITH CHECK (EXISTS (
//     SELECT 1 FROM profiles
//     WHERE profiles.id = auth.uid()
//     AND profiles.role IN ('owner','admin','manager')
//   ));
//
// -- Birthday reminders (run once):
// CREATE TABLE IF NOT EXISTS birthday_reminders (
//   id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   created_by    uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
//   target_id     uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
//   days_before   int  NOT NULL DEFAULT 7,
//   is_active     boolean NOT NULL DEFAULT true,
//   notified_year int,
//   created_at    timestamptz DEFAULT now(),
//   UNIQUE(created_by, target_id)
// );
// ALTER TABLE birthday_reminders ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "own_bd_reminders" ON birthday_reminders
//   USING (created_by = auth.uid())
//   WITH CHECK (created_by = auth.uid());
// ================================================================

const SchedulerPage = {

    _tasks:   [],
    _users:   [],
    _filter:  { status: 'all', type: 'all', search: '' },
    _sendLog: [],
    _presetRecipients: null,
    _timer:   null,

    // ── Background ticker ─────────────────────────────────────────

    startTimer() {
        if (this._timer) return;
        this._checkAndSend(); // immediate check on login
        this._timer = setInterval(() => this._checkAndSend(), 60_000);
    },

    stopTimer() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
    },

    async _checkAndSend() {
        if (!AppState.canSchedule()) return;
        this._checkBirthdayReminders().catch(e => console.error('[BD reminders]', e));
        try {
            const now = new Date().toISOString();
            const { data: due, error } = await supabase
                .from('scheduled_notifications')
                .select('*')
                .eq('status', 'pending')
                .lte('scheduled_at', now);

            if (error || !due?.length) return;

            if (!this._users.length) await this._loadUsers();

            for (const task of due) {
                const isRepeat = task.repeat_type !== 'none';
                await this._doSend(task, '', { markSent: !isRepeat });

                if (task.repeat_type === 'daily') {
                    const next = new Date(task.scheduled_at);
                    next.setDate(next.getDate() + 1);
                    await supabase.from('scheduled_notifications')
                        .update({ scheduled_at: next.toISOString(), updated_at: new Date().toISOString() })
                        .eq('id', task.id);
                } else if (task.repeat_type === 'weekly') {
                    const next = new Date(task.scheduled_at);
                    next.setDate(next.getDate() + 7);
                    await supabase.from('scheduled_notifications')
                        .update({ scheduled_at: next.toISOString(), updated_at: new Date().toISOString() })
                        .eq('id', task.id);
                }
            }
        } catch(e) {
            console.error('[Scheduler ticker]', e);
        }
    },

    // Called from AdminPage bulk-select to open form with pre-filled recipients
    openWithRecipients(users) {
        this._presetRecipients = users.map(u => ({ id: u.id, name: u.full_name || u.email, role: u.role || '' }));
        this._users = users; // ensure list is available for tag rendering
        Router.go('scheduler?view=notifications');
    },

    // ── Init ─────────────────────────────────────────────────────

    async init(container, params) {
        // Notifications sub-section — managers only
        if (params?.view === 'notifications' || params?.action === 'create' || params?.edit || this._presetRecipients) {
            if (!AppState.canSchedule()) {
                Toast.error('Заборонено', 'Недостатньо прав');
                Router.go('scheduler');
                return;
            }
            UI.setBreadcrumb([
                { label: 'Розділ планування', route: 'scheduler' },
                { label: 'Планувальник сповіщень' }
            ]);
            if (this._presetRecipients) {
                const preset = this._presetRecipients;
                this._presetRecipients = null;
                await this._loadUsers();
                await this._renderForm(container, null, preset);
                return;
            }
            if (params?.action === 'create') { await this._renderForm(container, null); return; }
            if (params?.edit) {
                await this._loadTasks();
                const task = this._tasks.find(t => t.id === params.edit);
                await this._renderForm(container, task || null);
                return;
            }
            await this._renderList(container);
            return;
        }

        // Hub
        await this._renderHub(container);
    },

    // ── Hub ──────────────────────────────────────────────────────

    async _renderHub(container) {
        UI.setBreadcrumb([{ label: 'Розділ планування' }]);
        const uid = AppState.user.id;
        const isManager = AppState.isManager() || AppState.isAdmin() || AppState.isOwner();

        // For managers: show "Мій графік" only if added as employee to a non-owned location
        let showMySchedule = !isManager;
        if (isManager) {
            const { data: ownLocs } = await supabase.from('schedule_locations')
                .select('id').eq('created_by', uid).is('deleted_at', null);
            const ownIds = (ownLocs || []).map(l => l.id);
            const q = supabase.from('schedule_assignments')
                .select('id', { count: 'exact', head: true }).eq('user_id', uid);
            const { count } = ownIds.length
                ? await q.not('location_id', 'in', `(${ownIds.join(',')})`)
                : await q;
            showMySchedule = (count || 0) > 0;
        }

        // Load calendars shared with current user
        const { data: sharedCals } = await supabase
            .from('personal_cal_viewers')
            .select('owner_id')
            .eq('viewer_id', AppState.user.id);
        const ownerIds = (sharedCals || []).map(r => r.owner_id);
        let sharedCalendars = [];
        if (ownerIds.length) {
            const { data: ownerProfs } = await supabase
                .from('profiles').select('id, full_name').in('id', ownerIds);
            sharedCalendars = (ownerProfs || []).map(p => ({ id: p.id, name: p.full_name || '—' }));
        }

        container.innerHTML = `
<div class="planner-hub">
    <div class="planner-hub-hero">
        <div class="planner-hub-ico">📅</div>
        <div>
            <h1 class="planner-hub-title">Розділ планування</h1>
            <p class="planner-hub-sub">Оберіть розділ</p>
        </div>
    </div>
    <div class="planner-hub-cards">
        ${isManager ? `
        <button class="planner-hub-card" onclick="Router.go('schedule-graph')">
            <div class="planner-hub-card-ico" style="background:rgba(99,102,241,.12);color:#6366f1">🗓</div>
            <div class="planner-hub-card-title">Графік роботи ломбарду</div>
            <div class="planner-hub-card-desc">Управління розкладом співробітників по локаціях</div>
        </button>` : ''}
        ${showMySchedule ? `
        <button class="planner-hub-card" onclick="Router.go('${isManager ? 'schedule-graph?view=employee' : 'schedule-graph'}')">
            <div class="planner-hub-card-ico" style="background:rgba(16,185,129,.12);color:#10b981">👤</div>
            <div class="planner-hub-card-title">Мій графік</div>
            <div class="planner-hub-card-desc">Перегляд власного розкладу роботи</div>
        </button>` : ''}
        ${isManager ? `
        <button class="planner-hub-card" onclick="Router.go('my-calendar')">
            <div class="planner-hub-card-ico" style="background:rgba(16,185,129,.12);color:#10b981">📅</div>
            <div class="planner-hub-card-title">Мій календар</div>
            <div class="planner-hub-card-desc">Особисті події та нагадування</div>
        </button>
        <button class="planner-hub-card" onclick="Router.go('scheduler?view=notifications')">
            <div class="planner-hub-card-ico" style="background:rgba(245,158,11,.12);color:#f59e0b">🔔</div>
            <div class="planner-hub-card-title">Планувальник сповіщень</div>
            <div class="planner-hub-card-desc">Розсилки та заплановані повідомлення</div>
        </button>` : ''}
        
        <button class="planner-hub-card" onclick="Router.go('schedule-view')">
            <div class="planner-hub-card-ico" style="background:rgba(99,102,241,.12);color:#6366f1">👁</div>
            <div class="planner-hub-card-title">Огляд</div>
            <div class="planner-hub-card-desc">Перегляд графіків, до яких надано доступ</div>
        </button>
    </div>
    ${sharedCalendars.length ? `
    <div class="planner-hub-section-title">📅 Спільні календарі</div>
    <div class="planner-hub-cards">
        ${sharedCalendars.map(c => `
        <button class="planner-hub-card" onclick="Router.go('my-calendar?owner=${c.id}')">
            <div class="planner-hub-card-ico" style="background:rgba(16,185,129,.1);color:#10b981">📆</div>
            <div class="planner-hub-card-title">${c.name}</div>
            <div class="planner-hub-card-desc">Перегляд календаря</div>
        </button>`).join('')}
    </div>` : ''}
</div>
<style>
.planner-hub { max-width:auto;padding:8px 0;animation:fadeSlideUp .3s cubic-bezier(.16,1,.3,1); }
.planner-hub-hero {
    display:flex;align-items:center;gap:20px;
    background:linear-gradient(135deg,#1a2744,#1e3a5f);
    border-radius:20px;padding:28px 28px;margin-bottom:20px;
}
.planner-hub-ico { font-size:2.4rem; }
.planner-hub-title { margin:0 0 4px;font-size:1.6rem;font-weight:800;color:#fff; }
.planner-hub-sub { margin:0;color:rgba(255,255,255,.6);font-size:.9rem; }
.planner-hub-cards { display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px; }
.planner-hub-card {
    display:flex;flex-direction:column;align-items:flex-start;gap:12px;
    padding:22px 20px;border-radius:18px;border:2px solid var(--border);
    background:var(--bg-surface);cursor:pointer;text-align:left;
    transition:border-color .15s,transform .15s,box-shadow .15s;
}
.planner-hub-card:hover {
    border-color:var(--primary);transform:translateY(-2px);
    box-shadow:0 8px 24px rgba(0,0,0,.12);
}
.planner-hub-card-ico {
    width:48px;height:48px;border-radius:14px;font-size:1.4rem;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.planner-hub-card-title { font-size:1rem;font-weight:700;color:var(--text-primary);margin:0; }
.planner-hub-card-desc { font-size:.8rem;color:var(--text-muted);line-height:1.45;margin:0; }
.planner-hub-section-title { font-size:.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin:20px 0 8px; }
</style>`;
    },

    // ── List view ────────────────────────────────────────────────

    async _renderList(container) {
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        await this._loadTasks();
        await this._loadUsers();
        this._paintList(container);
    },

    async _loadTasks() {
        let q = supabase
            .from('scheduled_notifications')
            .select('*, creator:profiles!created_by(id, full_name, avatar_url)')
            .order('scheduled_at', { ascending: true });
        const { data, error } = await q;
        if (error) throw error;
        this._tasks = data || [];
    },

    async _loadUsers() {
        const { data } = await API.profiles.getAll({ pageSize: 500 }).catch(() => ({ data: [] }));
        this._users = data || [];
    },

    _paintList(container) {
        const isOwner = AppState.isOwner();
        const now = new Date();

        const stats = {
            total:   this._tasks.length,
            pending: this._tasks.filter(t => t.status === 'pending').length,
            sent:    this._tasks.filter(t => t.status === 'sent').length,
            overdue: this._tasks.filter(t => t.status === 'pending' && new Date(t.scheduled_at) < now).length,
        };

        container.innerHTML = `
<div class="sch-page">

    <!-- Header -->
    <div class="sch-header">
        <div>
            <h1 class="sch-title">🔔 Планувальник сповіщень</h1>
            <p class="sch-subtitle">Керування розсилками та повідомленнями</p>
        </div>
        <button class="sch-btn-primary" onclick="SchedulerPage._renderForm(document.getElementById('page-content'), null)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Нове сповіщення
        </button>
    </div>

    <!-- Stats -->
    <div class="sch-stats">
        <div class="sch-stat-card">
            <div class="sch-stat-icon" style="background:rgba(99,102,241,.15);color:#6366f1">📋</div>
            <div><div class="sch-stat-val">${stats.total}</div><div class="sch-stat-lbl">Всього</div></div>
        </div>
        <div class="sch-stat-card">
            <div class="sch-stat-icon" style="background:rgba(245,158,11,.15);color:#f59e0b">⏳</div>
            <div><div class="sch-stat-val">${stats.pending}</div><div class="sch-stat-lbl">Очікують</div></div>
        </div>
        <div class="sch-stat-card">
            <div class="sch-stat-icon" style="background:rgba(16,185,129,.15);color:#10b981">✅</div>
            <div><div class="sch-stat-val">${stats.sent}</div><div class="sch-stat-lbl">Відправлено</div></div>
        </div>
        <div class="sch-stat-card">
            <div class="sch-stat-icon" style="background:rgba(239,68,68,.15);color:#ef4444">⚠️</div>
            <div><div class="sch-stat-val">${stats.overdue}</div><div class="sch-stat-lbl">Прострочено</div></div>
        </div>
    </div>

    <!-- Filters -->
    <div class="sch-filters">
        <input class="sch-search" type="search" placeholder="🔍 Пошук за назвою або повідомленням…"
               value="${this._filter.search}" oninput="SchedulerPage._setFilter('search', this.value)">
        <div class="sch-filter-group">
            ${['all','pending','sent','cancelled'].map(s => `
                <button class="sch-filter-btn${this._filter.status===s?' active':''}" onclick="SchedulerPage._setFilter('status','${s}')">
                    ${{ all:'Всі', pending:'Очікують', sent:'Відправлено', cancelled:'Скасовано' }[s]}
                </button>`).join('')}
        </div>
        <div class="sch-filter-group">
            ${['all','general','gold','tech'].map(tp => `
                <button class="sch-filter-btn${this._filter.type===tp?' active':''}" onclick="SchedulerPage._setFilter('type','${tp}')">
                    ${{ all:'Всі типи', general:'Загальне', gold:'ЗОЛ', tech:'ТЕХ' }[tp]}
                </button>`).join('')}
        </div>
    </div>

    <!-- Table -->
    <div class="sch-table-wrap">
        <table class="sch-table" id="sch-table">
            <thead>
                <tr>
                    <th>Назва</th>
                    <th>Тип</th>
                    <th>Дата та час</th>
                    <th>Повтор</th>
                    <th>Отримувачі</th>
                    <th>Статус</th>
                    ${isOwner ? '<th>Автор</th>' : ''}
                    <th style="width:160px">Дії</th>
                </tr>
            </thead>
            <tbody id="sch-tbody"></tbody>
        </table>
        <div id="sch-empty" style="display:none;padding:3rem;text-align:center;color:var(--text-muted)">
            <div style="font-size:3rem;margin-bottom:1rem">📭</div>
            <div>Завдань не знайдено</div>
        </div>
    </div>
</div>

<style>
.sch-page { max-width:1300px; animation:fadeSlideUp .35s cubic-bezier(.16,1,.3,1); }
@keyframes fadeSlideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.sch-header { display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap; }
.sch-title { margin:0;font-size:1.8rem;font-weight:700;color:var(--text-primary);letter-spacing:-.02em; }
.sch-subtitle { margin:.25rem 0 0;color:var(--text-muted);font-size:.9rem; }
.sch-btn-primary { display:flex;align-items:center;gap:8px;padding:10px 22px;background:var(--primary);color:#fff;border:none;border-radius:40px;font-weight:600;font-size:.95rem;cursor:pointer;transition:all .2s;box-shadow:0 4px 12px var(--primary-glow);white-space:nowrap; }
.sch-btn-primary:hover { background:var(--primary-dark);transform:scale(1.02); }
.sch-stats { display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:1.5rem; }
.sch-stat-card { background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;padding:16px 20px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow-sm); }
.sch-stat-icon { width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0; }
.sch-stat-val { font-size:1.6rem;font-weight:700;color:var(--text-primary);line-height:1; }
.sch-stat-lbl { font-size:.78rem;color:var(--text-muted);margin-top:.2rem;font-weight:500; }
.sch-filters { display:flex;align-items:center;gap:12px;margin-bottom:1rem;flex-wrap:wrap; }
.sch-search { flex:1;min-width:200px;padding:9px 14px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:40px;font-size:.9rem;color:var(--text-primary);outline:none;transition:border-color .15s; }
.sch-search:focus { border-color:var(--primary); }
.sch-filter-group { display:flex;gap:4px;background:var(--bg-raised);border-radius:40px;padding:3px; }
.sch-filter-btn { padding:5px 14px;border:none;border-radius:40px;background:transparent;color:var(--text-secondary);font-size:.82rem;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap; }
.sch-filter-btn.active { background:var(--bg-surface);color:var(--primary);font-weight:600;box-shadow:0 1px 4px rgba(0,0,0,.12); }
.sch-table-wrap { background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:var(--shadow-sm); }
.sch-table { width:100%;border-collapse:collapse;font-size:.875rem; }
.sch-table thead tr { border-bottom:1px solid var(--border); }
.sch-table th { padding:12px 16px;text-align:left;font-size:.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap; }
.sch-table td { padding:13px 16px;border-bottom:1px solid var(--border);vertical-align:middle; }
.sch-table tbody tr:last-child td { border-bottom:none; }
.sch-table tbody tr:hover td { background:var(--bg-hover); }
.sch-type-badge { display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:40px;font-size:.75rem;font-weight:600; }
.sch-type-general { background:rgba(99,102,241,.12);color:#6366f1; }
.sch-type-gold    { background:rgba(245,158,11,.12);color:#f59e0b; }
.sch-type-tech    { background:rgba(16,185,129,.12);color:#10b981; }
.sch-status-badge { display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:40px;font-size:.75rem;font-weight:600; }
.sch-s-pending   { background:rgba(245,158,11,.12);color:#f59e0b; }
.sch-s-sent      { background:rgba(16,185,129,.12);color:#10b981; }
.sch-s-cancelled { background:rgba(156,163,175,.12);color:#9ca3af; }
.sch-s-overdue   { background:rgba(239,68,68,.12);color:#ef4444; }
.sch-actions { display:flex;gap:4px;align-items:center; }
.sch-act-btn { width:30px;height:30px;border:none;border-radius:8px;background:var(--bg-raised);color:var(--text-secondary);cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0; }
.sch-act-btn:hover { background:var(--bg-hover);color:var(--text-primary); }
.sch-act-btn.danger:hover { background:rgba(239,68,68,.12);color:#ef4444; }
.sch-act-btn.success:hover { background:rgba(16,185,129,.12);color:#10b981; }
.sch-overdue-row td { background:rgba(239,68,68,.03); }
@media(max-width:900px) { .sch-stats{grid-template-columns:1fr 1fr} }
@media(max-width:600px) { .sch-stats{grid-template-columns:1fr} }
</style>`;

        this._repaintRows();
    },

    _repaintRows() {
        const tbody  = document.getElementById('sch-tbody');
        const empty  = document.getElementById('sch-empty');
        if (!tbody) return;

        const isOwner = AppState.isOwner();
        const now     = new Date();
        const s       = this._filter.search.toLowerCase();

        const visible = this._tasks.filter(t => {
            if (this._filter.status !== 'all' && t.status !== this._filter.status) return false;
            if (this._filter.type   !== 'all' && t.type   !== this._filter.type)   return false;
            if (s && !t.title.toLowerCase().includes(s) && !t.message.toLowerCase().includes(s)) return false;
            return true;
        });

        if (!visible.length) {
            tbody.innerHTML = '';
            empty.style.display = '';
            return;
        }
        empty.style.display = 'none';

        tbody.innerHTML = visible.map(t => {
            const dt       = new Date(t.scheduled_at);
            const isOverdue = t.status === 'pending' && dt < now;
            const rcpLabel = this._recipientLabel(t.recipients);
            const typeMap  = { general: ['🔔','sch-type-general','Загальне'], gold: ['🏆','sch-type-gold','ЗОЛ'], tech: ['🔧','sch-type-tech','ТЕХ'] };
            const [tIcon, tCls, tLabel] = typeMap[t.type] || typeMap.general;
            const repeatLabel = { none:'—', daily:'Щодня', weekly:'Щотижня' }[t.repeat_type] || '—';

            let statusHtml;
            if (isOverdue) {
                statusHtml = `<span class="sch-status-badge sch-s-overdue">⚠️ Прострочено</span>`;
            } else {
                const sm = { pending: ['sch-s-pending','⏳ Очікує'], sent: ['sch-s-sent','✅ Відправлено'], cancelled: ['sch-s-cancelled','🚫 Скасовано'] };
                const [sc, sl] = sm[t.status] || sm.pending;
                statusHtml = `<span class="sch-status-badge ${sc}">${sl}</span>`;
            }

            const authorHtml = isOwner ? `<td><div style="display:flex;align-items:center;gap:6px">
                ${t.creator?.avatar_url ? `<img src="${t.creator.avatar_url}" style="width:24px;height:24px;border-radius:50%;object-fit:cover">` : `<div style="width:24px;height:24px;border-radius:50%;background:var(--primary-glow);display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;color:var(--primary)">${Fmt.initials(t.creator?.full_name)}</div>`}
                <span style="font-size:.82rem;color:var(--text-secondary)">${t.creator?.full_name || '—'}</span>
            </div></td>` : '';

            return `<tr class="${isOverdue ? 'sch-overdue-row' : ''}" data-id="${t.id}">
                <td>
                    <div style="font-weight:600;color:var(--text-primary)">${t.title}</div>
                    <div style="font-size:.78rem;color:var(--text-muted);margin-top:2px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.message}</div>
                </td>
                <td><span class="sch-type-badge ${tCls}">${tIcon} ${tLabel}</span></td>
                <td>
                    <div style="font-weight:500">${Fmt.date(dt)}</div>
                    <div style="font-size:.78rem;color:var(--text-muted)">${dt.toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'})}</div>
                </td>
                <td style="color:var(--text-secondary)">${repeatLabel}</td>
                <td><span style="font-size:.82rem;color:var(--text-secondary)">${rcpLabel}</span></td>
                <td>${statusHtml}</td>
                ${authorHtml}
                <td>
                    <div class="sch-actions">
                        <button class="sch-act-btn" onclick="SchedulerPage._preview('${t.id}')" title="Передперегляд">👁</button>
                        ${t.status !== 'sent' ? `
                        <button class="sch-act-btn" onclick="SchedulerPage._openEdit('${t.id}')" title="Редагувати">✏️</button>
                        <button class="sch-act-btn success" onclick="SchedulerPage._sendNow('${t.id}')" title="Відправити зараз">📤</button>
                        ` : ''}
                        ${t.status === 'sent' ? `<button class="sch-act-btn" onclick="SchedulerPage._viewUnread('${t.id}')" title="Хто не прочитав">📊</button>` : ''}
                        ${isOwner ? `<button class="sch-act-btn" onclick="SchedulerPage._viewLog('${t.id}')" title="Лог відправки">📋</button>` : ''}
                        <button class="sch-act-btn danger" onclick="SchedulerPage._deleteTask('${t.id}')" title="Видалити">🗑</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    },

    _setFilter(key, val) {
        this._filter[key] = val;
        this._paintList(document.getElementById('page-content'));
    },

    // ── Form view ────────────────────────────────────────────────

    async _renderForm(container, task, presetRecipients = null) {
        if (!this._users.length) await this._loadUsers();
        const isEdit   = !!task;
        const title    = task?.title    || '';
        const message  = task?.message  || '';
        const type     = task?.type     || 'general';
        const repeat   = task?.repeat_type || 'none';
        const dtVal    = task?.scheduled_at
            ? new Date(task.scheduled_at).toISOString().slice(0,16)
            : new Date(Date.now() + 3600000).toISOString().slice(0,16);

        // preset from admin bulk-select overrides task recipients
        const selRcp = presetRecipients || (Array.isArray(task?.recipients) ? task.recipients : []);

        container.innerHTML = `
<div class="sch-form-page">

    <div class="sch-form-header">
        <button class="back-btn" onclick="SchedulerPage._renderList(document.getElementById('page-content'))">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Назад
        </button>
        <h2 class="sch-form-title">${isEdit ? '✏️ Редагувати завдання' : '➕ Нове сповіщення'}</h2>
    </div>

    <div class="sch-form-grid">

        <!-- Колонка 1: Основні дані -->
        <div class="sch-panel">
            <div class="sch-panel-header"><span class="section-badge">1</span><h4>Основне</h4></div>
            <div class="input-group">
                <label class="input-label">
                    <span>Назва завдання <span style="color:var(--danger)">*</span></span>
                    <input id="sf-title" type="text" value="${title}" placeholder="Наприклад: Нагадування про тест" oninput="SchedulerPage._livePreview()">
                </label>
                <label class="input-label">
                    <span>Текст повідомлення <span style="color:var(--danger)">*</span></span>
                    <textarea id="sf-message" style="padding:10px 14px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:16px;font-size:.95rem;color:var(--text-primary);font-family:inherit;outline:none;resize:vertical;min-height:120px;transition:border-color .15s" oninput="SchedulerPage._livePreview()" placeholder="Текст сповіщення для отримувачів…">${message}</textarea>
                </label>
                <label class="input-label">
                    <span>Дата та час <span style="color:var(--danger)">*</span></span>
                    <div class="sch-dt-wrap">
                        <svg class="sch-dt-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <input id="sf-datetime" type="datetime-local" value="${dtVal}" oninput="SchedulerPage._livePreview()">
                    </div>
                </label>
            </div>
        </div>

        <!-- Колонка 2: Тип, повтор, отримувачі -->
        <div class="sch-panel">
            <div class="sch-panel-header"><span class="section-badge">2</span><h4>Налаштування</h4></div>
            <div class="input-group">
                <label class="input-label">
                    <span>Тип сповіщення</span>
                    <div class="sch-type-picker" id="sf-type-picker">
                        ${[['general','🔔','Загальне','sch-type-general'],['gold','🏆','ЗОЛ','sch-type-gold'],['tech','🔧','ТЕХ','sch-type-tech']].map(([v,icon,lbl,cls])=>`
                        <button type="button" class="sch-type-chip${type===v?' active':''}" data-val="${v}"
                            onclick="document.getElementById('sf-type').value='${v}';document.querySelectorAll('.sch-type-chip').forEach(b=>b.classList.remove('active'));this.classList.add('active');SchedulerPage._livePreview()">
                            <span>${icon}</span>${lbl}
                        </button>`).join('')}
                        <input type="hidden" id="sf-type" value="${type}">
                    </div>
                </label>
                <label class="input-label">
                    <span>Повтор</span>
                    <div class="sch-type-picker">
                        ${[['none','—','Без повтору'],['daily','🔁','Щодня'],['weekly','📅','Щотижня']].map(([v,icon,lbl])=>`
                        <button type="button" class="sch-repeat-chip${repeat===v?' active':''}" data-val="${v}"
                            onclick="document.getElementById('sf-repeat').value='${v}';document.querySelectorAll('.sch-repeat-chip').forEach(b=>b.classList.remove('active'));this.classList.add('active')">
                            <span>${icon}</span>${lbl}
                        </button>`).join('')}
                        <input type="hidden" id="sf-repeat" value="${repeat}">
                    </div>
                </label>
                <div>
                    <div class="input-label" style="margin-bottom:8px"><span>Отримувачі</span></div>
                    <div class="sch-rcp-search-row">
                        <input id="sf-rcp-search" type="search" class="sch-search" style="border-radius:12px;padding:8px 12px"
                               placeholder="Пошук користувача…" oninput="SchedulerPage._filterRcpList(this.value)">
                        <button type="button" class="sch-btn-outline" onclick="SchedulerPage._addAllUsers()">Всі користувачі</button>
                    </div>
                    <div class="sch-rcp-dropdown" id="sf-rcp-dropdown">
                        ${this._users.map(u => `
                            <div class="sch-rcp-item" data-id="${u.id}" data-name="${(u.full_name||'').toLowerCase()}" onclick="SchedulerPage._addRecipient('${u.id}','${(u.full_name||'').replace(/'/g,'\\\'').replace(/"/g,'&quot;')}','${u.role||''}')">
                                ${u.avatar_url ? `<img src="${u.avatar_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover">` : `<div class="sch-rcp-avatar">${Fmt.initials(u.full_name)}</div>`}
                                <div>
                                    <div style="font-size:.875rem;font-weight:500">${u.full_name || u.email}</div>
                                    <div style="font-size:.75rem;color:var(--text-muted)">${Fmt.role(u.role)}</div>
                                </div>
                            </div>`).join('')}
                    </div>
                    <div class="sch-rcp-tags" id="sf-rcp-tags"></div>
                    <input type="hidden" id="sf-recipients-json" value="${this._escapeAttr(JSON.stringify(selRcp))}">
                </div>
            </div>
        </div>

        <!-- Колонка 3: Передперегляд -->
        <div class="sch-panel">
            <div class="sch-panel-header"><span class="section-badge">3</span><h4>Передперегляд</h4></div>
            <div class="sch-preview-box">
                <!-- Notification card preview -->
                <div class="sch-ntf-card">
                    <div class="sch-ntf-card-top">
                        <div class="sch-ntf-card-icon" id="sf-preview-icon">🔔</div>
                        <div class="sch-ntf-card-meta">
                            <span class="sch-ntf-card-source">LMS Portal</span>
                            <span class="sch-ntf-card-time" id="sf-preview-time">${new Date(dtVal).toLocaleString('uk-UA',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                        <span class="sch-ntf-card-badge" id="sf-preview-type">${{ general:'Загальне', gold:'ЗОЛ', tech:'ТЕХ' }[type]}</span>
                    </div>
                    <div class="sch-ntf-card-title" id="sf-preview-title">${title || 'Назва повідомлення…'}</div>
                    <div class="sch-ntf-card-body" id="sf-preview-text">${message || 'Текст повідомлення з\'явиться тут…'}</div>
                    <div class="sch-ntf-card-footer">
                        <div class="sch-ntf-card-dot"></div>
                        <span>Непрочитане</span>
                    </div>
                </div>
                <p class="sch-preview-hint">Так виглядатиме сповіщення у розділі «Мої сповіщення»</p>
            </div>
        </div>

    </div>

    <div class="sch-form-actions">
        <button class="sch-btn-outline" onclick="SchedulerPage._renderList(document.getElementById('page-content'))">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
            Скасувати
        </button>
        <button class="sch-btn-secondary" onclick="SchedulerPage._saveTask(${task ? `'${task.id}'` : 'null'}, false)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v14a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
            Зберегти
        </button>
        <button class="sch-btn-primary" onclick="SchedulerPage._saveTask(${task ? `'${task.id}'` : 'null'}, true)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            Зберегти та відправити
        </button>
    </div>
</div>

<style>
.sch-form-page { max-width:1300px; animation:fadeSlideUp .35s cubic-bezier(.16,1,.3,1); }
.sch-form-header { display:flex;align-items:center;gap:16px;margin-bottom:28px; }
.sch-form-title { margin:0;font-size:1.7rem;font-weight:600;color:var(--text-primary);letter-spacing:-.02em; }
.sch-form-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:12px; }
.sch-panel { background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;padding:22px;box-shadow:var(--shadow-sm); }
.sch-panel-header { display:flex;align-items:center;gap:10px;margin-bottom:20px;padding-bottom:12px;border-bottom:1px dashed var(--border); }
.sch-panel-header h4 { margin:0;font-size:1rem;font-weight:600;color:var(--text-primary); }
.sch-type-picker { display:flex;gap:8px;flex-wrap:wrap; }
.sch-type-chip, .sch-repeat-chip { display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:40px;font-size:.85rem;font-weight:500;color:var(--text-secondary);cursor:pointer;transition:all .15s;white-space:nowrap; }
.sch-type-chip.active, .sch-repeat-chip.active { background:var(--primary-glow);border-color:var(--primary);color:var(--primary);font-weight:600; }
.sch-rcp-search-row { display:flex;gap:8px;margin-bottom:8px; }
.sch-btn-outline { display:flex;align-items:center;gap:6px;padding:8px 14px;background:transparent;border:1.5px solid var(--border);border-radius:12px;color:var(--text-secondary);font-size:.85rem;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap; }
.sch-btn-outline:hover { background:var(--bg-hover);border-color:var(--border-light); }
.sch-rcp-dropdown { max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:12px;background:var(--bg-raised);margin-bottom:8px; }
.sch-rcp-item { display:flex;align-items:center;gap:10px;padding:8px 12px;cursor:pointer;transition:background .12s; }
.sch-rcp-item:hover { background:var(--bg-hover); }
.sch-rcp-item.hidden { display:none; }
.sch-rcp-avatar { width:28px;height:28px;border-radius:50%;background:var(--primary-glow);display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:var(--primary);flex-shrink:0; }
.sch-rcp-tags { display:flex;flex-wrap:wrap;gap:6px;min-height:32px; }
.sch-rcp-tag { display:flex;align-items:center;gap:4px;padding:4px 10px;background:var(--primary-glow);border:1px solid var(--primary);border-radius:40px;font-size:.78rem;font-weight:600;color:var(--primary); }
.sch-rcp-tag button { background:none;border:none;cursor:pointer;font-size:.9rem;padding:0;line-height:1;color:inherit;margin-left:2px; }
.sch-preview-box { background:var(--bg-raised);border-radius:16px;padding:14px; }
.sch-preview-hint { margin:10px 0 0;font-size:.75rem;color:var(--text-muted);text-align:center; }
/* Portal notification card preview */
.sch-ntf-card { background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;padding:14px;box-shadow:var(--shadow-sm);transition:box-shadow .15s; }
.sch-ntf-card-top { display:flex;align-items:center;gap:10px;margin-bottom:10px; }
.sch-ntf-card-icon { width:38px;height:38px;border-radius:12px;background:rgba(99,102,241,.12);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0; }
.sch-ntf-card-meta { flex:1;min-width:0; }
.sch-ntf-card-source { display:block;font-size:.72rem;font-weight:600;color:var(--primary);letter-spacing:.02em; }
.sch-ntf-card-time { display:block;font-size:.7rem;color:var(--text-muted); }
.sch-ntf-card-badge { flex-shrink:0;padding:2px 9px;border-radius:40px;font-size:.7rem;font-weight:600;background:rgba(99,102,241,.1);color:#6366f1; }
.sch-ntf-card-title { font-size:.92rem;font-weight:700;color:var(--text-primary);margin-bottom:5px;line-height:1.3; }
.sch-ntf-card-body { font-size:.85rem;color:var(--text-secondary);line-height:1.5;white-space:pre-wrap;min-height:36px;border-top:1px dashed var(--border);padding-top:8px; }
.sch-ntf-card-footer { display:flex;align-items:center;gap:6px;margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-size:.72rem;color:var(--text-muted); }
.sch-ntf-card-dot { width:7px;height:7px;border-radius:50%;background:var(--primary);flex-shrink:0; }
/* Datetime input */
.sch-dt-wrap { position:relative; }
.sch-dt-icon { position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none;z-index:1; }
.sch-dt-wrap input[type="datetime-local"] { width:100%;padding:10px 14px 10px 36px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:16px;font-size:.9rem;color:var(--text-primary);font-family:inherit;outline:none;box-sizing:border-box;cursor:pointer;transition:border-color .15s;color-scheme:dark; }
.sch-dt-wrap input[type="datetime-local"]:focus { border-color:var(--primary); }
.sch-form-actions { display:flex;justify-content:flex-end;gap:10px;margin-top:28px;padding-top:16px;border-top:1px solid var(--border); }
.sch-btn-secondary { display:flex;align-items:center;gap:6px;padding:10px 22px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:40px;font-weight:600;font-size:.9rem;cursor:pointer;transition:all .2s;color:var(--text-primary); }
.sch-btn-secondary:hover { background:var(--bg-hover); }
.sch-btn-primary { display:flex;align-items:center;gap:8px;padding:10px 22px;background:var(--primary);color:#fff;border:none;border-radius:40px;font-weight:600;font-size:.95rem;cursor:pointer;transition:all .2s;box-shadow:0 4px 12px var(--primary-glow); }
.sch-btn-primary:hover { background:var(--primary-dark);transform:scale(1.02); }
.back-btn { display:flex;align-items:center;gap:6px;padding:8px 16px;background:transparent;border:1px solid var(--border);border-radius:40px;color:var(--text-secondary);font-weight:500;font-size:.95rem;transition:all .2s;cursor:pointer; }
.back-btn:hover { background:var(--bg-hover);border-color:var(--border-light);transform:translateX(-2px); }
@media(max-width:1000px) { .sch-form-grid{grid-template-columns:1fr} }
</style>`;

        // Pre-fill selected recipients
        selRcp.forEach(r => {
            if (r.type === 'all') {
                this._renderAllTag();
            } else if (r.id) {
                const u = this._users.find(u => u.id === r.id);
                if (u) this._renderRecipientTag(r.id, u.full_name || u.email);
            }
        });
    },

    _livePreview() {
        const txt   = document.getElementById('sf-message')?.value || '';
        const ttl   = document.getElementById('sf-title')?.value || '';
        const type  = document.getElementById('sf-type')?.value || 'general';
        const dt    = document.getElementById('sf-datetime')?.value;

        const typeMap = { general: ['🔔','Загальне'], gold: ['🏆','ЗОЛ'], tech: ['🔧','ТЕХ'] };
        const [icon, label] = typeMap[type] || typeMap.general;

        const el = document.getElementById('sf-preview-text');
        if (el) el.textContent = txt || 'Текст повідомлення з\'явиться тут…';

        const ttlEl = document.getElementById('sf-preview-title');
        if (ttlEl) ttlEl.textContent = ttl || 'Назва повідомлення…';

        const iconEl = document.getElementById('sf-preview-icon');
        if (iconEl) iconEl.textContent = icon;

        const typeEl = document.getElementById('sf-preview-type');
        if (typeEl) typeEl.textContent = label;

        const timeEl = document.getElementById('sf-preview-time');
        if (timeEl && dt) timeEl.textContent = new Date(dt).toLocaleString('uk-UA',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    },

    _filterRcpList(q) {
        const lq = q.toLowerCase();
        document.querySelectorAll('.sch-rcp-item').forEach(el => {
            el.classList.toggle('hidden', !!lq && !el.dataset.name.includes(lq));
        });
    },

    _addAllUsers() {
        document.getElementById('sf-recipients-json').value = JSON.stringify([{ type: 'all' }]);
        document.getElementById('sf-rcp-tags').innerHTML = '';
        this._renderAllTag();
    },

    _renderAllTag() {
        const tags = document.getElementById('sf-rcp-tags');
        if (!tags) return;
        if (tags.querySelector('[data-all]')) return;
        const tag = document.createElement('div');
        tag.className = 'sch-rcp-tag';
        tag.dataset.all = '1';
        tag.innerHTML = `👥 Всі користувачі <button onclick="SchedulerPage._removeAllTag()">×</button>`;
        tags.appendChild(tag);
    },

    _removeAllTag() {
        document.querySelector('[data-all]')?.remove();
        const inp = document.getElementById('sf-recipients-json');
        if (inp) inp.value = '[]';
    },

    _addRecipient(id, name, role) {
        let rcp = JSON.parse(document.getElementById('sf-recipients-json').value || '[]');
        if (rcp.find(r => r.id === id) || rcp.find(r => r.type === 'all')) return;
        rcp.push({ id, name, role });
        document.getElementById('sf-recipients-json').value = JSON.stringify(rcp);
        this._renderRecipientTag(id, name);
    },

    _renderRecipientTag(id, name) {
        const tags = document.getElementById('sf-rcp-tags');
        if (!tags || tags.querySelector(`[data-uid="${id}"]`)) return;
        const tag = document.createElement('div');
        tag.className = 'sch-rcp-tag';
        tag.dataset.uid = id;
        tag.innerHTML = `${name} <button onclick="SchedulerPage._removeRecipient('${id}')">×</button>`;
        tags.appendChild(tag);
    },

    _removeRecipient(id) {
        document.querySelector(`[data-uid="${id}"]`)?.remove();
        let rcp = JSON.parse(document.getElementById('sf-recipients-json')?.value || '[]');
        rcp = rcp.filter(r => r.id !== id);
        document.getElementById('sf-recipients-json').value = JSON.stringify(rcp);
    },

    // ── CRUD ─────────────────────────────────────────────────────

    async _saveTask(taskId, sendNow) {
        const title   = document.getElementById('sf-title')?.value.trim();
        const message = document.getElementById('sf-message')?.value.trim();
        const dt      = document.getElementById('sf-datetime')?.value;
        const type    = document.getElementById('sf-type')?.value || 'general';
        const repeat  = document.getElementById('sf-repeat')?.value || 'none';
        const rcpRaw  = document.getElementById('sf-recipients-json')?.value || '[]';

        if (!title)   { Toast.error('Помилка', 'Введіть назву'); return; }
        if (!message) { Toast.error('Помилка', 'Введіть текст повідомлення'); return; }
        if (!dt)      { Toast.error('Помилка', 'Оберіть дату та час'); return; }

        let recipients;
        try { recipients = JSON.parse(rcpRaw); } catch { recipients = []; }

        Loader.show();
        try {
            const payload = {
                title,
                message,
                scheduled_at: new Date(dt).toISOString(),
                type,
                repeat_type: repeat,
                recipients,
                status: sendNow ? 'sent' : 'pending',
                created_by: AppState.user.id,
                updated_at: new Date().toISOString(),
            };

            let saved;
            if (taskId) {
                const { data, error } = await supabase
                    .from('scheduled_notifications').update(payload).eq('id', taskId).select().single();
                if (error) throw error;
                saved = data;
            } else {
                const { data, error } = await supabase
                    .from('scheduled_notifications').insert(payload).select().single();
                if (error) throw error;
                saved = data;
            }

            if (sendNow) await this._doSend(saved, '');

            Toast.success(taskId ? 'Збережено' : 'Створено', sendNow ? 'Завдання збережено та відправлено' : 'Завдання збережено');
            await this._renderList(document.getElementById('page-content'));
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    async _openEdit(taskId) {
        if (!this._tasks.length) await this._loadTasks();
        const task = this._tasks.find(t => t.id === taskId);
        if (!task) return;
        await this._renderForm(document.getElementById('page-content'), task);
    },

    async _deleteTask(taskId) {
        const ok = await Modal.confirm({ title: 'Видалити завдання?', message: 'Це незворотна дія.', confirmText: 'Видалити', danger: true });
        if (!ok) return;
        Loader.show();
        try {
            const { error } = await supabase.from('scheduled_notifications').delete().eq('id', taskId);
            if (error) throw error;
            Toast.success('Видалено');
            await this._renderList(document.getElementById('page-content'));
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _sendNow(taskId) {
        const ok = await Modal.confirm({ title: 'Відправити зараз?', message: 'Повідомлення буде відправлено негайно всім отримувачам.', confirmText: 'Відправити' });
        if (!ok) return;
        if (!this._tasks.length) await this._loadTasks();
        const task = this._tasks.find(t => t.id === taskId);
        if (!task) return;
        Loader.show();
        try {
            await this._doSend(task, '');
            const { error } = await supabase.from('scheduled_notifications')
                .update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', taskId);
            if (error) throw error;
            Toast.success('Відправлено', 'Повідомлення надіслано отримувачам');
            await this._renderList(document.getElementById('page-content'));
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Send ─────────────────────────────────────────────────────

    async _doSend(task, _token, { markSent = true } = {}) {
        const recipients = this._resolveRecipients(task.recipients);
        const log = [];

        // Internal portal notifications
        const userIds = recipients.map(u => u.id);
        await NotificationsPage.send(userIds, {
            title:     task.title,
            message:   task.message,
            type:      task.type,
            taskId:    task.id,
            createdBy: AppState.user?.id,
        });

        for (const user of recipients) {
            log.push({ user_id: user.id, user_name: user.full_name || user.email, sent_at: new Date().toISOString(), channel: 'portal', status: 'sent' });
        }

        // Persist log (status only changed to 'sent' for non-repeating tasks)
        const update = { send_log: log, sent_at: new Date().toISOString() };
        if (markSent) update.status = 'sent';
        await supabase.from('scheduled_notifications').update(update).eq('id', task.id);

        return log;
    },

    /* Telegram — вимкнено
    async _sendToTelegram(user, message, token) {
        if (!token) {
            await new Promise(r => setTimeout(r, 50));
            return { channel: 'telegram', status: 'simulated', note: 'No token — simulated' };
        }
        const chatId = user.telegram_id;
        if (!chatId) return { channel: 'telegram', status: 'skipped', note: 'No telegram_id in profile' };
        try {
            const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
            });
            const json = await res.json();
            return json.ok ? { channel: 'telegram', status: 'sent' }
                           : { channel: 'telegram', status: 'error', note: json.description };
        } catch(e) { return { channel: 'telegram', status: 'error', note: e.message }; }
    },
    */

    // ── Birthday reminders ───────────────────────────────────────

    async _checkBirthdayReminders() {
        if (!AppState.user?.id) return;
        const { data, error } = await supabase
            .from('birthday_reminders')
            .select('*, target:profiles!target_id(id, full_name, birth_date)')
            .eq('created_by', AppState.user.id)
            .eq('is_active', true);
        if (error || !data?.length) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const rem of data) {
            if (!rem.target?.birth_date) continue;
            const bd = new Date(rem.target.birth_date);

            // Next upcoming birthday (this year or next)
            let upcoming = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
            if (upcoming < today) upcoming.setFullYear(today.getFullYear() + 1);
            const upcomingYear = upcoming.getFullYear();

            if (rem.notified_year === upcomingYear) continue; // already sent for this birthday

            // Day we should fire the notification
            const trigger = new Date(upcoming);
            trigger.setDate(trigger.getDate() - rem.days_before);
            trigger.setHours(0, 0, 0, 0);

            if (trigger.getTime() !== today.getTime()) continue;

            const bdLabel = upcoming.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long' });
            const dayText = rem.days_before === 0 ? 'Сьогодні' :
                            rem.days_before === 1 ? 'Завтра' :
                            `Через ${rem.days_before} днів`;

            await NotificationsPage.send([AppState.user.id], {
                title:     `🎂 ${rem.target.full_name}`,
                message:   `${dayText} день народження!\n${bdLabel}`,
                type:      'general',
                createdBy: AppState.user.id,
            });

            await supabase.from('birthday_reminders')
                .update({ notified_year: upcomingYear })
                .eq('id', rem.id);
        }
    },

    _resolveRecipients(recipients) {
        if (!recipients?.length) return [];
        if (recipients[0]?.type === 'all') return this._users;
        return recipients.map(r => this._users.find(u => u.id === r.id)).filter(Boolean);
    },

    // ── Preview modal ────────────────────────────────────────────

    _preview(taskId) {
        const task = this._tasks.find(t => t.id === taskId);
        if (!task) return;
        const typeLabel = { general:'🔔 Загальне', gold:'🏆 ЗОЛ', tech:'🔧 ТЕХ' }[task.type] || task.type;
        const dt = new Date(task.scheduled_at);
        const typeIconMap = { general: '🔔', gold: '🏆', tech: '🔧' };
        const tIcon = typeIconMap[task.type] || '🔔';
        Modal.open({
            title: '👁 Передперегляд повідомлення',
            body: `
            <div style="padding:.5rem">
                <div style="background:var(--bg-raised);border-radius:16px;padding:16px;margin-bottom:1rem;border:1px solid var(--border)">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                        <div style="width:40px;height:40px;border-radius:12px;background:rgba(99,102,241,.12);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">${tIcon}</div>
                        <div style="flex:1;min-width:0">
                            <div style="font-size:.7rem;font-weight:600;color:var(--primary);letter-spacing:.02em">LMS Portal</div>
                            <div style="font-size:.7rem;color:var(--text-muted)">${dt.toLocaleString('uk-UA',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                        </div>
                        <span style="padding:2px 9px;border-radius:40px;font-size:.7rem;font-weight:600;background:rgba(99,102,241,.1);color:#6366f1">${typeLabel.replace(/^[^\s]+\s/,'')}</span>
                    </div>
                    <div style="font-size:.95rem;font-weight:700;color:var(--text-primary);margin-bottom:8px">${task.title}</div>
                    <div style="font-size:.9rem;color:var(--text-secondary);line-height:1.6;white-space:pre-wrap;padding-top:8px;border-top:1px dashed var(--border)">${task.message}</div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.82rem">
                    <div style="background:var(--bg-raised);border-radius:10px;padding:10px">
                        <div style="color:var(--text-muted);margin-bottom:4px">Назва</div>
                        <div style="font-weight:600">${task.title}</div>
                    </div>
                    <div style="background:var(--bg-raised);border-radius:10px;padding:10px">
                        <div style="color:var(--text-muted);margin-bottom:4px">Повтор</div>
                        <div style="font-weight:600">${{ none:'Без повтору', daily:'Щодня', weekly:'Щотижня' }[task.repeat_type]}</div>
                    </div>
                    <div style="background:var(--bg-raised);border-radius:10px;padding:10px;grid-column:1/-1">
                        <div style="color:var(--text-muted);margin-bottom:4px">Отримувачі</div>
                        <div style="font-weight:600">${this._recipientLabel(task.recipients)}</div>
                    </div>
                </div>
            </div>`,
            footer: `<button class="btn btn-secondary" onclick="Modal.close()">Закрити</button>
                     ${task.status !== 'sent' ? `<button class="btn btn-primary" onclick="Modal.close();SchedulerPage._sendNow('${task.id}')">📤 Відправити зараз</button>` : ''}`
        });
    },

    // ── Unread viewer ────────────────────────────────────────────

    async _viewUnread(taskId) {
        const task = this._tasks.find(t => t.id === taskId);
        if (!task) return;

        Loader.show();
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('user_id, is_read, recipient:profiles!notifications_user_id_fkey(id, full_name, avatar_url)')
                .eq('task_id', taskId);

            if (error) throw error;

            const rows    = data || [];
            const total   = rows.length;
            const unread  = rows.filter(r => !r.is_read);
            const readCnt = total - unread.length;

            const avatarHtml = (p) => p?.avatar_url
                ? `<img src="${p.avatar_url}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0">`
                : `<div style="width:30px;height:30px;border-radius:50%;background:rgba(239,68,68,.12);display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;color:#ef4444;flex-shrink:0">${Fmt.initials(p?.full_name)}</div>`;

            Modal.open({
                title: `📊 Статус прочитання: ${task.title}`,
                size: 'md',
                body: `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
                    <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:14px;padding:14px 18px;text-align:center">
                        <div style="font-size:1.8rem;font-weight:700;color:#10b981">${readCnt}</div>
                        <div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">✅ Прочитали</div>
                    </div>
                    <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:14px;padding:14px 18px;text-align:center">
                        <div style="font-size:1.8rem;font-weight:700;color:#ef4444">${unread.length}</div>
                        <div style="font-size:.78rem;color:var(--text-muted);margin-top:2px">⏳ Не прочитали</div>
                    </div>
                </div>
                ${unread.length ? `
                <div style="font-size:.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Не прочитали (${unread.length})</div>
                <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto">
                    ${unread.map(r => `
                    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-raised);border-radius:12px;border:1px solid rgba(239,68,68,.15)">
                        ${avatarHtml(r.recipient)}
                        <span style="font-size:.875rem;font-weight:500;color:var(--text-primary)">${r.recipient?.full_name || '—'}</span>
                        <span style="margin-left:auto;font-size:.72rem;padding:2px 8px;border-radius:40px;background:rgba(239,68,68,.1);color:#ef4444;font-weight:600">не прочитано</span>
                    </div>`).join('')}
                </div>` : `<div style="text-align:center;padding:1.5rem;color:var(--text-muted)">✅ Всі отримувачі прочитали повідомлення</div>`}
                ${readCnt && readCnt < total ? `
                <details style="margin-top:12px">
                    <summary style="font-size:.8rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;cursor:pointer;padding:4px 0">Прочитали (${readCnt})</summary>
                    <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
                        ${rows.filter(r => r.is_read).map(r => `
                        <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-raised);border-radius:12px;opacity:.7">
                            ${avatarHtml(r.recipient)}
                            <span style="font-size:.875rem;font-weight:500;color:var(--text-primary)">${r.recipient?.full_name || '—'}</span>
                            <span style="margin-left:auto;font-size:.72rem;padding:2px 8px;border-radius:40px;background:rgba(16,185,129,.1);color:#10b981;font-weight:600">прочитано</span>
                        </div>`).join('')}
                    </div>
                </details>` : ''}`,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Закрити</button>`
            });
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    // ── Log viewer (owner only) ───────────────────────────────────

    async _viewLog(taskId) {
        const task = this._tasks.find(t => t.id === taskId);
        if (!task) return;
        const log = task.send_log || [];

        Modal.open({
            title: `📋 Лог відправки: ${task.title}`,
            size: 'lg',
            body: log.length ? `
            <div style="font-size:.85rem">
                <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:.5rem;padding:.5rem .75rem;font-weight:600;color:var(--text-muted);border-bottom:1px solid var(--border);text-transform:uppercase;font-size:.72rem;letter-spacing:.05em">
                    <span>Отримувач</span><span>Канал</span><span>Статус</span><span>Час</span>
                </div>
                ${log.map(entry => `
                <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:.5rem;padding:.6rem .75rem;border-bottom:1px solid var(--border);align-items:center">
                    <span style="font-weight:500">${entry.user_name || entry.user_id}</span>
                    <span style="color:var(--text-muted)">📨 ${entry.channel || '—'}</span>
                    <span class="badge ${entry.status==='sent'?'badge-success':entry.status==='simulated'?'badge-info':'badge-danger'}">${entry.status}</span>
                    <span style="color:var(--text-muted);white-space:nowrap">${entry.sent_at ? new Date(entry.sent_at).toLocaleString('uk-UA',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}</span>
                </div>
                ${entry.note ? `<div style="padding:.3rem .75rem .6rem;font-size:.75rem;color:var(--text-muted);border-bottom:1px solid var(--border)">⚠️ ${entry.note}</div>` : ''}`).join('')}
            </div>` : `<div style="padding:2rem;text-align:center;color:var(--text-muted)">📭 Лог порожній — ще не відправлялось</div>`,
            footer: `<button class="btn btn-secondary" onclick="Modal.close()">Закрити</button>`
        });
    },

    // ── Helpers ──────────────────────────────────────────────────

    _recipientLabel(recipients) {
        if (!recipients?.length) return 'Не вказано';
        if (recipients[0]?.type === 'all') return `👥 Всі користувачі (${this._users.length})`;
        if (recipients.length === 1) return recipients[0].name || recipients[0].id;
        return `${recipients[0].name || '?'} +${recipients.length - 1}`;
    },

    _escapeAttr(str) {
        return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }
};
