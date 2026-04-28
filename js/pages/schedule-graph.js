// ================================================================
// EduFlow LMS — Графік роботи
// Manager: locations, employees, schedule matrix, change log
// Employee: view + edit own schedule
//
// SQL (run once in Supabase):
// CREATE TABLE IF NOT EXISTS schedule_locations (
//     id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     name       text NOT NULL,
//     created_by uuid REFERENCES auth.users(id),
//     created_at timestamptz DEFAULT now()
// );
// ALTER TABLE schedule_locations ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "sloc_select" ON schedule_locations FOR SELECT USING (true);
// CREATE POLICY "sloc_insert" ON schedule_locations FOR INSERT WITH CHECK (auth.uid() = created_by);
// CREATE POLICY "sloc_update" ON schedule_locations FOR UPDATE USING (auth.uid() = created_by);
// CREATE POLICY "sloc_delete" ON schedule_locations FOR DELETE USING (auth.uid() = created_by);
// ALTER TABLE schedule_locations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
// ALTER TABLE schedule_locations ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false;
//
// CREATE TABLE IF NOT EXISTS schedule_viewers (
//     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
//     location_id uuid REFERENCES schedule_locations(id) ON DELETE CASCADE,
//     granted_by  uuid REFERENCES auth.users(id),
//     created_at  timestamptz DEFAULT now()
// );
// ALTER TABLE schedule_viewers ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "sview_select" ON schedule_viewers FOR SELECT USING (true);
// CREATE POLICY "sview_insert" ON schedule_viewers FOR INSERT WITH CHECK (true);
// CREATE POLICY "sview_delete" ON schedule_viewers FOR DELETE USING (true);
//
// CREATE TABLE IF NOT EXISTS schedule_assignments (
//     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     location_id uuid REFERENCES schedule_locations(id) ON DELETE CASCADE,
//     user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
//     created_by  uuid REFERENCES auth.users(id),
//     created_at  timestamptz DEFAULT now(),
//     UNIQUE(location_id, user_id)
// );
// ALTER TABLE schedule_assignments ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "sassign_select" ON schedule_assignments FOR SELECT USING (true);
// CREATE POLICY "sassign_insert" ON schedule_assignments FOR INSERT WITH CHECK (true);
// CREATE POLICY "sassign_delete" ON schedule_assignments FOR DELETE USING (true);
//
// CREATE TABLE IF NOT EXISTS schedule_entries (
//     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     location_id uuid REFERENCES schedule_locations(id) ON DELETE CASCADE,
//     user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
//     date        date NOT NULL,
//     shift_type  text NOT NULL DEFAULT 'work',
//     shift_start time,
//     shift_end   time,
//     notes       text,
//     updated_by  uuid REFERENCES auth.users(id),
//     updated_at  timestamptz DEFAULT now(),
//     UNIQUE(location_id, user_id, date)
// );
// ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "sentry_select" ON schedule_entries FOR SELECT USING (true);
// CREATE POLICY "sentry_insert" ON schedule_entries FOR INSERT WITH CHECK (true);
// CREATE POLICY "sentry_update" ON schedule_entries FOR UPDATE USING (true);
// CREATE POLICY "sentry_delete" ON schedule_entries FOR DELETE USING (true);
//
// CREATE TABLE IF NOT EXISTS schedule_log (
//     id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     location_id uuid,
//     user_id     uuid,
//     date        date,
//     employee_name text,
//     old_value   jsonb,
//     new_value   jsonb,
//     changed_by  uuid REFERENCES auth.users(id),
//     changed_at  timestamptz DEFAULT now()
// );
// ALTER TABLE schedule_log ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "slog_select" ON schedule_log FOR SELECT USING (true);
// CREATE POLICY "slog_insert" ON schedule_log FOR INSERT WITH CHECK (true);
// ================================================================

const SHIFT_TYPES = {
    work:     { label: 'Робочий',    short: 'Р',  color: '#10b981', bg: 'rgba(16,185,129,.14)' },
    day_off:  { label: 'Вихідний',   short: 'В',  color: '#8b5cf6', bg: 'rgba(139,92,246,.14)' },
    vacation: { label: 'Відпустка',  short: 'ВД', color: '#f59e0b', bg: 'rgba(245,158,11,.14)' },
    sick:     { label: 'Лікарняний', short: 'Л',  color: '#ef4444', bg: 'rgba(239,68,68,.14)' },
};
const SUB_CONFIRMED = { label: 'Підміна', short: 'Р', color: '#f97316', bg: 'rgba(249,115,22,.14)' };

const MONTHS_UA = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                   'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

const DAYS_SHORT = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];

// ── Manager Page ──────────────────────────────────────────────────
const ScheduleGraphPage = {
    _container: null,
    _locations:   [],
    _locId:       null,
    _assignments: [],   // [{id, user_id, profile}]
    _entries:     {},   // key `${userId}_${date}` → entry row
    _log:         [],
    _month: new Date().getMonth(),
    _year:  new Date().getFullYear(),
    _tab:   'schedule',
    _quickType:           null,
    _substDate:           null,
    _allAssignments:      [],
    _allEntries:          {},
    _isAssignedAsEmployee: false,
    _helpLocIds:          new Set(),
    _helpByLoc:           {},
    _deletedLocations:    [],
    _viewers:             [],

    async init(container) {
        this._container = container;

        if (!AppState.isManager() && !AppState.isAdmin() && !AppState.isOwner()) {
            await ScheduleGraphEmployee.init(container);
            return;
        }

        UI.setBreadcrumb([
            { label: 'Планувальник', route: 'scheduler' },
            { label: 'Графік роботи' }
        ]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        const [, empCheck] = await Promise.all([
            this._loadLocations(),
            supabase.from('schedule_assignments')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', AppState.user.id)
        ]);
        await Promise.all([this._loadHelpLocIds(), this._loadDeletedLocations()]);
        this._isAssignedAsEmployee = (empCheck.count || 0) > 0;

        if (this._locations.length && !this._locId) this._locId = this._locations[0].id;
        await this._loadPageData();
        this._render(container);
    },

    _switchToEmployee() {
        ScheduleGraphEmployee.init(this._container);
    },

    async _loadLocations() {
        const q = supabase.from('schedule_locations').select('*').is('deleted_at', null).order('created_at');
        if (!AppState.isAdmin() && !AppState.isOwner()) q.eq('created_by', AppState.user.id);
        const { data } = await q;
        this._locations = data || [];
        this._applyLocOrder();
    },

    async _loadDeletedLocations() {
        const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const q = supabase.from('schedule_locations')
            .select('*')
            .gte('deleted_at', cutoff)
            .order('deleted_at', { ascending: false });
        if (!AppState.isAdmin() && !AppState.isOwner()) q.eq('created_by', AppState.user.id);
        const { data } = await q;
        this._deletedLocations = data || [];
    },

    _locOrderKey() { return `sg_loc_order_${AppState.user.id}`; },

    _applyLocOrder() {
        try {
            const saved = JSON.parse(localStorage.getItem(this._locOrderKey()) || '[]');
            if (!saved.length) return;
            this._locations.sort((a, b) => {
                const ai = saved.indexOf(a.id), bi = saved.indexOf(b.id);
                if (ai === -1 && bi === -1) return 0;
                if (ai === -1) return 1;
                if (bi === -1) return -1;
                return ai - bi;
            });
        } catch(e) {}
    },

    _saveLocOrder() {
        localStorage.setItem(this._locOrderKey(), JSON.stringify(this._locations.map(l => l.id)));
    },

    _moveLocation(id, dir) {
        const i = this._locations.findIndex(l => l.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= this._locations.length) return;
        [this._locations[i], this._locations[j]] = [this._locations[j], this._locations[i]];
        this._saveLocOrder();
        this._render(this._container);
    },

    async _loadHelpLocIds() {
        const { data } = await supabase.from('schedule_entries')
            .select('location_id, date')
            .eq('user_id', AppState.user.id)
            .eq('notes', '__mgr_help__');
        this._helpLocIds = new Set((data || []).map(e => e.location_id));
        this._helpByLoc  = {};
        (data || []).forEach(e => {
            if (!this._helpByLoc[e.location_id]) this._helpByLoc[e.location_id] = new Set();
            this._helpByLoc[e.location_id].add(e.date);
        });
    },

    async _loadPageData() {
        if (!this._locId) return;
        const [y, m] = [this._year, this._month];
        const pad = n => String(n).padStart(2, '0');
        const dateFrom = `${y}-${pad(m + 1)}-01`;
        const dateTo   = `${y}-${pad(m + 1)}-${new Date(y, m + 1, 0).getDate()}`;

        const [aRes, eRes] = await Promise.all([
            supabase.from('schedule_assignments')
                .select('id, user_id')
                .eq('location_id', this._locId),
            supabase.from('schedule_entries')
                .select('*')
                .eq('location_id', this._locId)
                .gte('date', dateFrom)
                .lte('date', dateTo)
        ]);

        const assignRows = aRes.data || [];
        let profiles = [];
        if (assignRows.length) {
            const ids = assignRows.map(a => a.user_id);
            const { data: pData } = await supabase.from('profiles')
                .select('id, full_name, avatar_url, role, label')
                .in('id', ids);
            profiles = pData || [];
        }
        this._assignments = assignRows.map(a => ({
            id: a.id, user_id: a.user_id,
            profile: profiles.find(p => p.id === a.user_id) || null
        }));

        this._entries = {};
        (eRes.data || []).forEach(e => { this._entries[`${e.user_id}_${e.date}`] = e; });
    },

    async _loadLog() {
        if (!this._locId) return;
        const { data: rows } = await supabase.from('schedule_log')
            .select('*')
            .eq('location_id', this._locId)
            .order('changed_at', { ascending: false })
            .limit(300);
        if (!rows?.length) { this._log = []; return; }

        const ids = [...new Set(rows.map(r => r.changed_by).filter(Boolean))];
        const { data: profs } = await supabase.from('profiles')
            .select('id, full_name').in('id', ids);
        const profMap = Object.fromEntries((profs || []).map(p => [p.id, p]));

        this._log = rows.map(r => ({ ...r, changer: profMap[r.changed_by] || null }));
    },

    // ── Render ────────────────────────────────────────────────────

    _render(container) {
        container.innerHTML = `
<div class="sg-page">
    ${this._hero()}
    <div class="sg-body">
        ${this._locSidebar()}
        <div class="sg-content">
            ${this._locId || this._deletedLocations.length ? `
            <div class="sg-controls">
                ${this._tab !== 'trash' && this._locId ? `
                <div class="sg-month-nav">
                    <button class="sg-mnav" onclick="ScheduleGraphPage._prevMonth()">‹</button>
                    <span class="sg-mlabel">
                        ${MONTHS_UA[this._month]} ${this._year}
                        ${this._isPastMonth() ? '<span class="sg-past-badge">🔒 завершено</span>' : ''}
                    </span>
                    <button class="sg-mnav" onclick="ScheduleGraphPage._nextMonth()">›</button>
                </div>
                ${this._locId !== 'all' ? `
                <div class="sg-tabs">
                    <button class="sg-tab ${this._tab==='schedule'?'active':''}"
                        onclick="ScheduleGraphPage._switchTab('schedule')">📅 Графік</button>
                    <button class="sg-tab ${this._tab==='log'?'active':''}"
                        onclick="ScheduleGraphPage._switchTab('log')">📋 Журнал змін</button>
                </div>` : ''}
                ` : ''}
                <button class="sg-tab sg-trash-tab ${this._tab==='trash'?'active':''}"
                    onclick="ScheduleGraphPage._switchTab(${this._tab==='trash'?`'schedule'`:`'trash'`})">
                    🗑 Кошик${this._deletedLocations.length ? `<span class="sg-trash-badge">${this._deletedLocations.length}</span>` : ''}
                </button>
            </div>
            ${this._tab === 'trash'
                ? this._trashSection()
                : !this._locId ? '' :
                  this._locId === 'all'   ? this._allLocsSection()
                : this._tab === 'schedule' ? this._tableSection()
                : this._tab === 'subst'   ? this._substSection()
                : this._logSection()}
            ` : `
            <div class="empty-state" style="margin-top:2rem">
                <div class="empty-icon">🏪</div>
                <h3>Немає локацій</h3>
                <p>Додайте першу локацію щоб починати складати графіки</p>
                <button class="sg-add-btn" onclick="ScheduleGraphPage._addLocation()">
                    <span class="sg-add-ico">＋</span> Додати локацію
                </button>
            </div>
            `}
        </div>
    </div>
</div>
${this._styles()}`;
    },

    _hero() {
        return `
<div class="sg-hero">
    <div class="sg-hero-inner">
        <div class="sg-hero-ico">📅</div>
        <div style="flex:1">
            <h1 class="sg-hero-title">Графік роботи</h1>
            <p class="sg-hero-sub">Керуйте розкладом співробітників по локаціях</p>
        </div>
        ${this._isAssignedAsEmployee ? `
        <button class="sg-my-sched-btn" onclick="ScheduleGraphPage._switchToEmployee()">
            👤 Мій графік
        </button>` : ''}
    </div>
</div>`;
    },

    _locSidebar() {
        return `
<aside class="sg-loc-sidebar">
    <div class="sg-loc-sidebar-head">
        <span class="sg-loc-sidebar-title">Локації</span>
        <button class="sg-loc-add-ico" onclick="ScheduleGraphPage._addLocation()" title="Додати локацію">＋</button>
    </div>
    <div class="sg-loc-sidebar-list">
        ${this._locations.length > 1 ? `
        <button class="sg-loc-item ${this._locId === 'all' ? 'active' : ''}"
            onclick="ScheduleGraphPage._selectLocation('all')">
            <span class="sg-loc-item-ico">🗂</span>
            <span class="sg-loc-item-name">Всі локації</span>
        </button>` : ''}
        ${this._locations.map((l, idx) => {
            const wh = this._getWorkHours(l.id);
            const whText = (wh.start && wh.end) ? `${wh.start}–${wh.end}` : '';
            const hasHelp = this._helpLocIds.has(l.id);
            const isActive = l.id === this._locId;
            const isFirst = idx === 0;
            const isLast  = idx === this._locations.length - 1;
            return `
        <div class="sg-loc-item-row">
            <div class="sg-loc-item-arrows">
                <button class="sg-loc-arrow${isFirst?' disabled':''}" title="Вище"
                    ${isFirst ? 'disabled' : `onclick="ScheduleGraphPage._moveLocation('${l.id}',-1)"`}>▲</button>
                <button class="sg-loc-arrow${isLast?' disabled':''}" title="Нижче"
                    ${isLast ? 'disabled' : `onclick="ScheduleGraphPage._moveLocation('${l.id}',1)"`}>▼</button>
            </div>
            <button class="sg-loc-item ${isActive ? 'active' : ''}${hasHelp ? ' has-help' : ''}"
                onclick="ScheduleGraphPage._selectLocation('${l.id}')">
                <span class="sg-loc-item-ico">🏪</span>
                <span class="sg-loc-item-name">${l.name}</span>
                <span class="sg-loc-item-meta">
                    ${whText ? `<span class="sg-loc-item-wh">${whText}</span>` : ''}
                    ${hasHelp ? `<span class="sg-loc-item-helpdot"></span>` : ''}
                </span>
            </button>
        </div>`;
        }).join('')}
    </div>
</aside>`;
    },

    _tableSection() {
        const days = new Date(this._year, this._month + 1, 0).getDate();
        const nums = Array.from({ length: days }, (_, i) => i + 1);

        const workTotal = a => nums.filter(d => {
            const date = this._dateStr(d);
            return this._entries[`${a.user_id}_${date}`]?.shift_type === 'work';
        }).length;

        const wh     = this._getWorkHours(this._locId);
        const wStart = wh.start || '09:00';
        const wEnd   = wh.end   || '18:00';
        const locName = this._locations.find(l => l.id === this._locId)?.name || '';
        const locked  = this._isLocked();

        return `
<div class="sg-section">
    <div class="sg-work-hours-bar${locked ? ' sg-locked-bar' : ''}">
        <span class="sg-loc-name-ico">🏪</span>
        <span class="sg-loc-name-text">${locName}</span>
        <button class="sg-loc-name-edit" onclick="ScheduleGraphPage._renameLocation('${this._locId}','${locName.replace(/'/g,"\\'")}')" title="Перейменувати">✏️</button>
        <span class="sg-wh-sep">·</span>
        <span class="sg-wh-label">🕐 Час роботи:</span>
        <span class="sg-wh-time" id="sg-wh-display">${wStart} — ${wEnd}</span>
        <button class="sg-wh-edit" onclick="ScheduleGraphPage._editWorkHours()" title="Редагувати">✏️</button>
        <div class="sg-wh-inputs" id="sg-wh-inputs" style="display:none">
            <input type="time" id="sg-wh-start" class="sg-tinput" style="width:110px">
            <span style="color:var(--text-muted)">—</span>
            <input type="time" id="sg-wh-end" class="sg-tinput" style="width:110px">
            <button class="sg-wh-save" onclick="ScheduleGraphPage._saveWorkHours()">Зберегти</button>
            <button class="sg-wh-cancel" onclick="ScheduleGraphPage._cancelWorkHours()">✕</button>
        </div>
        <button class="sg-lock-btn ${locked ? 'locked' : ''}"
            onclick="ScheduleGraphPage._toggleLock()"
            title="${locked ? 'Графік заблоковано — натисніть щоб розблокувати' : 'Заблокувати зміни для співробітників'}">
            ${locked ? '🔒' : '🔓'}
        </button>
        <button class="sg-loc-del-btn" onclick="ScheduleGraphPage._deleteLocation('${this._locId}')" title="Видалити локацію">🗑</button>
    </div>
    <div class="sg-toolbar">
        <div class="sg-legend">
            ${Object.entries(SHIFT_TYPES).map(([k, v]) => `
            <button class="sg-leg-btn ${this._quickType === k ? 'active' : ''}"
                style="--lc:${v.color};--lb:${v.bg}"
                onclick="ScheduleGraphPage._setQuickType('${k}')"
                title="${this._quickType === k ? 'Клік щоб скасувати' : 'Клік щоб вибрати — потім тиснути комірки'}">
                <span class="sg-leg-short" style="background:${v.bg};color:${v.color}">${v.short}</span>
                ${v.label}
                ${this._quickType === k ? '<span class="sg-leg-active-mark">✓ активно</span>' : ''}
            </button>`).join('')}
        </div>
        <div style="display:flex;gap:8px;align-items:center">
            <button class="sg-mgr-help-btn" onclick="ScheduleGraphPage._showManagerHelpModal()">
                🆘 Потрібна підміна
            </button>
            <button class="sg-viewers-btn" onclick="ScheduleGraphPage._showViewersModal()">
                👁 Доступ
            </button>
            <button class="sg-add-btn" onclick="ScheduleGraphPage._addEmployee()">
                <span class="sg-add-ico">＋</span> Співробітник
            </button>
        </div>
    </div>
    ${this._quickType ? `
    <div class="sg-quick-bar">
        <span>⚡ Швидке заповнення:</span>
        <span class="sg-quick-badge" style="background:${SHIFT_TYPES[this._quickType].bg};color:${SHIFT_TYPES[this._quickType].color}">
            ${SHIFT_TYPES[this._quickType].short} ${SHIFT_TYPES[this._quickType].label}
        </span>
        <span>— натискайте на комірки для автоматичного запису</span>
        <button class="sg-quick-cancel" onclick="ScheduleGraphPage._setQuickType(null)">✕ Скасувати</button>
    </div>` : ''}

    ${!this._assignments.length ? `
    <div class="empty-state" style="margin:2rem 0">
        <div class="empty-icon">👥</div>
        <h3>Немає співробітників</h3>
        <p>Додайте першого співробітника до цього графіку</p>
    </div>` : `
    <div class="sg-scroll-wrap" id="sg-wrap-main" onscroll="ScheduleGraphPage._onScroll('main')">
        <table class="sg-table">
            <thead>
                <tr>
                    <th class="sg-th-name">Співробітник</th>
                    ${nums.map(d => {
                        const dow  = new Date(this._year, this._month, d).getDay();
                        const we   = dow === 0 || dow === 6;
                        const date = this._dateStr(d);
                        const isHelpDate = this._helpByLoc[this._locId]?.has(date);
                        return `<th class="sg-th-day${we?' we':''}${isHelpDate?' sg-help-col-th':''}">
                            <div class="sg-day-num">${d}</div>
                            <div class="sg-day-dow">${DAYS_SHORT[dow]}</div>
                            ${isHelpDate ? `<div class="sg-help-col-ico">🆘</div>` : ''}
                        </th>`;
                    }).join('')}
                    <th class="sg-th-sum">
                        <div class="sg-th-sum-inner">Σ</div>
                        <div class="sg-th-sub">Дні</div>
                    </th>
                    <th class="sg-th-del">
                        <div class="sg-th-sub">Дія</div>
                    </th>
                </tr>
            </thead>
            <tbody>
                ${this._assignments.map(a => {
                    const p = a.profile || {};
                    const initials = (p.full_name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
                    const cells = nums.map(d => {
                        const date  = this._dateStr(d);
                        const entry = this._entries[`${a.user_id}_${date}`];
                        const shift = entry ? SHIFT_TYPES[entry.shift_type] : null;
                        const dow   = new Date(this._year, this._month, d).getDay();
                        const we    = dow === 0 || dow === 6;
                        const isSubConf = entry?.notes === '__sub_confirmed__';
                        const flagIco = entry?.notes === '__sub__' ? '🙋' : entry?.notes === '__needsub__' ? '🆘' : '';
                        const dispShift = isSubConf ? SUB_CONFIRMED : shift;
                        return `<td class="sg-cell${we?' we':''}${entry?.notes==='__needsub__'?' sg-needsub-cell':''}"
                            data-uid="${a.user_id}" data-date="${date}"
                            onclick="ScheduleGraphPage._openCell('${a.user_id}','${date}')"
                            title="${entry?.notes==='__sub__' ? 'Може вийти на підміну' : entry?.notes==='__needsub__' ? 'Потрібна підміна' : isSubConf ? 'Підтверджена підміна' : shift ? shift.label : 'Клік щоб додати'}">
                            ${flagIco
                                ? `<span class="sg-flag-cell">${flagIco}</span>`
                                : dispShift ? `<span class="sg-badge" style="background:${dispShift.bg};color:${dispShift.color}">${dispShift.short}</span>` : ''}
                        </td>`;
                    }).join('');

                    return `<tr>
                        ${this._nameCell(a.profile, a.user_id)}
                        ${cells}
                        <td class="sg-td-sum">${workTotal(a)}</td>
                        <td class="sg-td-del">
                            <button class="sg-rm" title="Видалити зі списку"
                                onclick="ScheduleGraphPage._removeEmployee('${a.id}','${a.user_id}',event)">
                                🗑 <span>Видалити</span>
                            </button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>`}
</div>`;
    },

    _logSection() {
        const fmtDate = s => {
            const d = new Date(s);
            return d.toLocaleDateString('uk-UA') + ' ' + d.toLocaleTimeString('uk-UA', {hour:'2-digit',minute:'2-digit'});
        };
        const shiftBadge = v => {
            if (!v?.shift_type) return '<span class="sg-log-empty">—</span>';
            const s = SHIFT_TYPES[v.shift_type];
            return s ? `<span class="sg-badge" style="background:${s.bg};color:${s.color}">${s.short} ${s.label}${v.shift_start?' · '+v.shift_start.slice(0,5):''}</span>` : v.shift_type;
        };

        return `
<div class="sg-section">
    ${!this._log.length ? `
    <div class="empty-state" style="margin:2rem 0">
        <div class="empty-icon">📋</div>
        <h3>Журнал порожній</h3>
        <p>Зміни в графіку з'являться тут</p>
    </div>` : `
    <div class="sg-log-list">
        ${this._log.map(e => {
            const changer = Array.isArray(e.changer) ? e.changer[0] : e.changer;
            const init = (changer?.full_name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
            return `
        <div class="sg-log-row">
            <div class="sg-av sm">${init}</div>
            <div class="sg-log-body">
                <strong>${changer?.full_name || 'Хтось'}</strong>
                <span class="sg-log-emp">→ ${e.employee_name || 'Співробітник'}</span>
                <span class="sg-log-datecel">${e.date}</span>
                <div class="sg-log-diff">
                    ${e.old_value ? shiftBadge(e.old_value) : '<span class="sg-log-new">новий запис</span>'}
                    ${e.old_value ? '<span class="sg-log-arrow">→</span>' : ''}
                    ${e.new_value ? shiftBadge(e.new_value) : '<span class="sg-log-del">видалено</span>'}
                </div>
            </div>
            <div class="sg-log-time">${fmtDate(e.changed_at)}</div>
        </div>`;
        }).join('')}
    </div>`}
</div>`;
    },

    // ── Actions ───────────────────────────────────────────────────

    _showLocModal({ title, placeholder, value = '', onSave }) {
        document.getElementById('sg-loc-modal')?.remove();
        const el = document.createElement('div');
        el.id = 'sg-loc-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal sg-loc-modal-box">
    <div class="sg-mhdr">
        <div class="sg-loc-modal-icon">🏪</div>
        <div style="flex:1">
            <h3 class="sg-loc-modal-title">${title}</h3>
        </div>
        <button class="sg-mclose" onclick="document.getElementById('sg-loc-modal').remove()">✕</button>
    </div>
    <div class="sg-loc-modal-body">
        <input id="sg-loc-input" class="sg-loc-input" placeholder="${placeholder}"
            value="${value.replace(/"/g,'&quot;')}" autocomplete="off" spellcheck="false">
        <p class="sg-loc-hint">Наприклад: Магазин на Хрещатику, Відділення №3, Ломбард Центр</p>
    </div>
    <div class="sg-modal-actions">
        <button class="sg-btn-save" id="sg-loc-save-btn">✓ Зберегти</button>
        <button class="sg-btn-cancel" onclick="document.getElementById('sg-loc-modal').remove()">Скасувати</button>
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });

        const input = document.getElementById('sg-loc-input');
        input.focus();
        input.select();

        const save = () => {
            const v = input.value.trim();
            if (!v) { input.classList.add('sg-input-error'); input.focus(); return; }
            el.remove();
            onSave(v);
        };
        document.getElementById('sg-loc-save-btn').onclick = save;
        input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    },

    async _addLocation() {
        this._showLocModal({
            title: 'Нова локація',
            placeholder: 'Назва локації…',
            onSave: async name => {
                const { data, error } = await supabase.from('schedule_locations')
                    .insert({ name, created_by: AppState.user.id })
                    .select().single();
                if (error) { Toast.error('Помилка', error.message); return; }
                this._locations.push(data);
                this._locId = data.id;
                this._assignments = [];
                this._entries = {};
                this._render(this._container);
                Toast.success('Локацію додано');
            }
        });
    },

    async _renameLocation(id, currentName) {
        this._showLocModal({
            title: 'Перейменувати локацію',
            placeholder: 'Нова назва…',
            value: currentName,
            onSave: async name => {
                if (name === currentName) return;
                const { error } = await supabase.from('schedule_locations')
                    .update({ name })
                    .eq('id', id);
                if (error) { Toast.error('Помилка', error.message); return; }
                const loc = this._locations.find(l => l.id === id);
                if (loc) loc.name = name;
                this._render(this._container);
                Toast.success('Перейменовано');
            }
        });
    },

    _deleteLocation(id) {
        const loc = this._locations.find(l => l.id === id);
        if (!loc) return;
        this._showDeleteConfirmModal(id, loc.name);
    },

    _showDeleteConfirmModal(id, name) {
        document.getElementById('sg-del-confirm-modal')?.remove();
        const el = document.createElement('div');
        el.id = 'sg-del-confirm-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal sg-del-modal">
    <div class="sg-del-modal-ico-wrap">
        <div class="sg-del-modal-ico">🗑</div>
    </div>
    <h3 class="sg-del-modal-title">Перемістити в кошик?</h3>
    <p class="sg-del-modal-desc">Локацію <strong>«${name}»</strong> буде переміщено в кошик.<br>Ви зможете відновити її протягом <strong>2 днів</strong>.</p>
    <div class="sg-del-modal-note">
        <span class="sg-del-note-ico">💡</span>
        Всі дані графіку збережуться і будуть відновлені разом з локацією
    </div>
    <div class="sg-modal-actions">
        <button class="sg-btn-cancel" onclick="document.getElementById('sg-del-confirm-modal').remove()">Скасувати</button>
        <button class="sg-del-confirm-btn" onclick="ScheduleGraphPage._confirmDeleteLocation('${id}')">🗑 В кошик</button>
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    async _confirmDeleteLocation(id) {
        document.getElementById('sg-del-confirm-modal')?.remove();
        const now = new Date().toISOString();
        const { error } = await supabase.from('schedule_locations')
            .update({ deleted_at: now })
            .eq('id', id);
        if (error) { Toast.error('Помилка', error.message); return; }
        const loc = this._locations.find(l => l.id === id);
        if (loc) { loc.deleted_at = now; this._deletedLocations.unshift(loc); }
        this._locations = this._locations.filter(l => l.id !== id);
        this._locId = this._locations[0]?.id || null;
        this._tab = 'schedule';
        this._assignments = [];
        this._entries = {};
        await this._loadPageData();
        this._render(this._container);
        Toast.success('Переміщено в кошик', 'Можна відновити протягом 2 днів');
    },

    async _restoreLocation(id) {
        const { error } = await supabase.from('schedule_locations')
            .update({ deleted_at: null })
            .eq('id', id);
        if (error) { Toast.error('Помилка', error.message); return; }
        const loc = this._deletedLocations.find(l => l.id === id);
        if (loc) { loc.deleted_at = null; this._locations.push(loc); }
        this._deletedLocations = this._deletedLocations.filter(l => l.id !== id);
        this._applyLocOrder();
        this._locId = id;
        this._tab = 'schedule';
        await this._loadPageData();
        this._render(this._container);
        Toast.success('Локацію відновлено');
    },

    async _hardDeleteLocation(id) {
        if (!confirm('Видалити назавжди? Всі дані графіку будуть втрачені.')) return;
        const { error } = await supabase.from('schedule_locations').delete().eq('id', id);
        if (error) { Toast.error('Помилка', error.message); return; }
        this._deletedLocations = this._deletedLocations.filter(l => l.id !== id);
        this._render(this._container);
        Toast.success('Видалено назавжди');
    },

    _selectLocation(id) {
        this._locId     = id;
        this._tab       = 'schedule';
        this._quickType = null;
        this._substDate = null;
        const content   = this._container.querySelector('.sg-content');
        if (content) content.innerHTML = '<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>';
        const load = id === 'all' ? this._loadAllData() : this._loadPageData();
        load.then(() => this._render(this._container));
    },

    _prevMonth() {
        if (this._month === 0) { this._month = 11; this._year--; } else this._month--;
        const load = this._locId === 'all' ? this._loadAllData() : this._loadPageData();
        load.then(() => this._render(this._container));
    },

    _nextMonth() {
        if (this._month === 11) { this._month = 0; this._year++; } else this._month++;
        const load = this._locId === 'all' ? this._loadAllData() : this._loadPageData();
        load.then(() => this._render(this._container));
    },

    _switchTab(tab) {
        this._tab = tab;
        this._substDate = null;
        if (tab === 'log')        this._loadLog().then(() => this._render(this._container));
        else if (tab === 'subst') this._loadAllData().then(() => this._render(this._container));
        else if (tab === 'trash') this._loadDeletedLocations().then(() => this._render(this._container));
        else this._render(this._container);
    },

    async _loadAllData() {
        const p = n => String(n).padStart(2, '0');
        const dateFrom = `${this._year}-${p(this._month + 1)}-01`;
        const dateTo   = `${this._year}-${p(this._month + 1)}-${new Date(this._year, this._month + 1, 0).getDate()}`;

        // Load assignments for ALL locations owned by this manager
        const locIds = this._locations.map(l => l.id);
        if (!locIds.length) { this._allAssignments = []; this._allEntries = {}; return; }

        const [aRes, eRes] = await Promise.all([
            supabase.from('schedule_assignments').select('id, user_id, location_id').in('location_id', locIds),
            supabase.from('schedule_entries').select('*').in('location_id', locIds).gte('date', dateFrom).lte('date', dateTo)
        ]);

        const assignRows = aRes.data || [];
        let profiles = [];
        if (assignRows.length) {
            const ids = [...new Set(assignRows.map(a => a.user_id))];
            const { data: pData } = await supabase.from('profiles').select('id, full_name, avatar_url, role').in('id', ids);
            profiles = pData || [];
        }

        this._allAssignments = assignRows.map(a => ({
            locId:   a.location_id,
            locName: this._locations.find(l => l.id === a.location_id)?.name || '',
            user_id: a.user_id,
            profile: profiles.find(p => p.id === a.user_id) || null
        }));

        this._allEntries = {};
        (eRes.data || []).forEach(e => { this._allEntries[`${e.location_id}_${e.user_id}_${e.date}`] = e; });
    },

    _substSection() {
        const days  = new Date(this._year, this._month + 1, 0).getDate();
        const nums  = Array.from({ length: days }, (_, i) => i + 1);
        const sd    = this._substDate;

        // Group by location
        const byLoc = {};
        this._allAssignments.forEach(a => {
            if (!byLoc[a.locId]) byLoc[a.locId] = { name: a.locName, members: [] };
            byLoc[a.locId].members.push(a);
        });

        // For selected date: who is free vs busy
        let freeList = [], busyList = [];
        if (sd) {
            this._allAssignments.forEach(a => {
                const entry = this._allEntries[`${a.locId}_${a.user_id}_${sd}`];
                const type = entry?.shift_type;
                const canSub = !type || type === 'day_off';
                if (canSub) freeList.push(a);
                else busyList.push(a);
            });
        }

        const sdLabel = sd ? new Date(sd + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', weekday: 'short' }) : '';

        return `
<div class="sg-section">
    <div class="sg-subst-hint">
        <span class="sg-subst-hint-text">
            🖱 Натисніть на <strong>заголовок дня</strong> щоб побачити хто може підмінити
        </span>
        ${sd ? `<button class="sg-subst-clear" onclick="ScheduleGraphPage._selectSubstDate(null)">✕ Скинути</button>` : ''}
    </div>

    ${sd ? `
    <div class="sg-subst-panel">
        <div class="sg-subst-date-label">📅 ${sdLabel}</div>
        <div class="sg-subst-cols">
            <div class="sg-subst-free">
                <div class="sg-subst-col-title free">🟢 Вільні (${freeList.length})</div>
                <div class="sg-subst-scroll">
                ${freeList.length ? freeList.map(a => {
                    const entry = this._allEntries[`${a.locId}_${a.user_id}_${sd}`];
                    const shift = entry ? SHIFT_TYPES[entry.shift_type] : null;
                    const wantsSub = entry?.notes === '__sub__';
                    return `<div class="sg-subst-person sg-subst-free-card${wantsSub?' sg-subst-wants-sub':''}"
                        onclick="ScheduleGraphPage._assignSubstitute('${a.user_id}')"
                        title="Натисніть щоб призначити на підміну">
                        <div class="sg-av sm">${(a.profile?.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
                        <div>
                            <div class="sg-subst-name">${a.profile?.full_name || 'Невідомо'}</div>
                            <div class="sg-subst-loc">🏪 ${a.locName}</div>
                            ${wantsSub ? `<div class="sg-sub-wants-badge">🙋 Пропонує підміну</div>` : ''}
                        </div>
                        ${shift ? `<span class="sg-badge" style="background:${shift.bg};color:${shift.color};margin-left:auto">${shift.short}</span>` :
                          `<span class="sg-badge" style="background:rgba(16,185,129,.1);color:#10b981;margin-left:auto">—</span>`}
                        <span class="sg-subst-add-btn">+</span>
                    </div>`;
                }).join('') : '<div class="sg-subst-empty">Немає вільних співробітників</div>'}
                </div>
            </div>
            <div class="sg-subst-busy">
                <div class="sg-subst-col-title busy">🔴 Зайняті (${busyList.length})</div>
                <div class="sg-subst-scroll">
                ${busyList.map(a => {
                    const entry = this._allEntries[`${a.locId}_${a.user_id}_${sd}`];
                    const shift = entry ? SHIFT_TYPES[entry.shift_type] : null;
                    const needsSub = entry?.notes === '__needsub__';
                    return `
                <div class="sg-subst-person busy${needsSub?' sg-subst-needs-sub':''}">
                    <div class="sg-av sm">${(a.profile?.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
                    <div>
                        <div class="sg-subst-name">${a.profile?.full_name || 'Невідомо'}</div>
                        <div class="sg-subst-loc">🏪 ${a.locName}</div>
                        ${needsSub ? `<div class="sg-needsub-badge">🆘 Потрібна підміна</div>` : ''}
                    </div>
                    ${shift ? `<span class="sg-badge" style="background:${shift.bg};color:${shift.color};margin-left:auto">${shift.short}</span>` : ''}
                </div>`;
                }).join('')}
                </div>
            </div>
        </div>
    </div>` : ''}

    <div class="sg-scroll-wrap" id="sg-wrap-subst" onscroll="ScheduleGraphPage._onScroll('subst')">
        <table class="sg-table">
            <thead>
                <tr>
                    <th class="sg-th-name">Співробітник</th>
                    ${nums.map(d => {
                        const date = this._dateStr(d);
                        const dow  = new Date(this._year, this._month, d).getDay();
                        const we   = dow === 0 || dow === 6;
                        const isSd = date === sd;
                        return `<th class="sg-th-day${we?' we':''}${isSd?' sg-sd-col':''}"
                            style="cursor:pointer" title="Клік — пошук підміни на цей день"
                            onclick="ScheduleGraphPage._selectSubstDate('${date}')">
                            <div class="sg-day-num">${d}</div>
                            <div class="sg-day-dow">${DAYS_SHORT[dow]}</div>
                        </th>`;
                    }).join('')}
                </tr>
            </thead>
            <tbody>
                ${Object.entries(byLoc).map(([locId, loc]) => `
                <tr class="sg-loc-header-row">
                    <td colspan="${days + 1}" class="sg-loc-group-header">🏪 ${loc.name}</td>
                </tr>
                ${loc.members.map(a => {
                    const p = a.profile || {};
                    const init = (p.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
                    const cells = nums.map(d => {
                        const date  = this._dateStr(d);
                        const entry = this._allEntries[`${a.locId}_${a.user_id}_${date}`];
                        const shift = entry ? SHIFT_TYPES[entry.shift_type] : null;
                        const dow   = new Date(this._year, this._month, d).getDay();
                        const we    = dow === 0 || dow === 6;
                        const isSd   = date === sd;
                        const type   = entry?.shift_type;
                        const isFree = sd && (!type || type === 'day_off');
                        const isBusy = sd && !isFree;
                        return `<td class="sg-cell${we?' we':''}${isSd?' sg-sd-col':''}${isFree?' sg-free-cell':''}${isBusy?' sg-busy-cell':''}">
                            ${shift
                                ? `<span class="sg-badge" style="background:${shift.bg};color:${shift.color}">${shift.short}</span>`
                                : isFree ? `<span class="sg-free-dot">●</span>` : ''}
                        </td>`;
                    }).join('');
                    const rowType = sd ? this._allEntries[`${a.locId}_${a.user_id}_${sd}`]?.shift_type : null;
                    const rowClass = sd ? ((!rowType || rowType === 'day_off') ? 'sg-row-free' : 'sg-row-busy') : '';
                    return `<tr class="${rowClass}">
                        ${this._nameCell(a.profile, a.user_id)}
                        ${cells}
                    </tr>`;
                }).join('')}`).join('')}
            </tbody>
        </table>
    </div>
</div>`;
    },

    _selectSubstDate(date) {
        this._substDate = date;
        this._render(this._container);
    },


    async _assignSubstitute(userId) {
        const existingLocIds = new Set(
            this._allAssignments.filter(a => a.user_id === userId).map(a => a.locId)
        );
        const available = this._locations.filter(l => !existingLocIds.has(l.id));
        const userName  = this._allAssignments.find(a => a.user_id === userId)?.profile?.full_name || 'Співробітник';

        if (!available.length) {
            Toast.info('Вже доданий до всіх локацій');
            return;
        }
        this._showSubstModal(userId, userName, available);
    },

    _showSubstModal(userId, userName, locations) {
        document.getElementById('sg-subst-modal')?.remove();
        const initials = userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        const el = document.createElement('div');
        el.id = 'sg-subst-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal">
    <div class="sg-mhdr">
        <div style="display:flex;align-items:center;gap:10px">
            <div class="sg-av sm">${initials}</div>
            <div>
                <h3 style="margin:0;font-size:1rem">Призначити на підміну</h3>
                <p style="margin:2px 0 0;color:var(--text-muted);font-size:.82rem">${userName}</p>
            </div>
        </div>
        <button class="sg-mclose" onclick="document.getElementById('sg-subst-modal').remove()">✕</button>
    </div>
    <p style="font-size:.82rem;color:var(--text-muted);margin:0 0 14px">
        Оберіть локацію — співробітник буде доданий до її графіку:
    </p>
    <div style="display:flex;flex-direction:column;gap:6px">
        ${locations.map(l => {
            const wh = this._getWorkHours(l.id);
            const whText = (wh.start && wh.end) ? `🕐 ${wh.start}–${wh.end}` : '';
            return `<button class="sg-subst-loc-btn"
                onclick="ScheduleGraphPage._confirmSubstitute('${userId}','${l.id}')">
                <span class="sg-subst-loc-name">🏪 ${l.name}</span>
                ${whText ? `<span class="sg-subst-loc-wh">${whText}</span>` : ''}
                <span class="sg-subst-loc-arrow">→</span>
            </button>`;
        }).join('')}
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    async _confirmSubstitute(userId, locId) {
        document.getElementById('sg-subst-modal')?.remove();
        const { error } = await supabase.from('schedule_assignments')
            .insert({ location_id: locId, user_id: userId, created_by: AppState.user.id });
        if (error) { Toast.error('Помилка', error.message); return; }

        const loc  = this._locations.find(l => l.id === locId);
        const prof = this._allAssignments.find(a => a.user_id === userId)?.profile;
        Toast.success(`${prof?.full_name || 'Співробітника'} додано до "${loc?.name || 'локації'}"`);

        await this._loadAllData();
        this._render(this._container);
    },

    _showSubstResolveModal(userId, date, entry, profile, locId) {
        document.getElementById('sg-subst-resolve-modal')?.remove();
        const isSub  = entry.notes === '__sub__';
        const dateLabel = new Date(date + 'T00:00:00')
            .toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
        const name = profile?.full_name || 'Співробітник';
        const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        const color = this._avatarColor(userId);
        const actionLabel = isSub ? 'Беру на зміну' : 'Знайшов заміну';
        const icon  = isSub ? '🙋' : '🆘';
        const desc  = isSub
            ? 'Співробітник повідомив, що може вийти на підміну цього дня.'
            : 'Співробітник потребує заміни цього дня.';

        const el = document.createElement('div');
        el.id = 'sg-subst-resolve-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal sg-resolve-modal">
    <div class="sg-mhdr">
        <div style="display:flex;align-items:center;gap:12px">
            <div class="sg-av" style="background:${color};flex-shrink:0">${initials}</div>
            <div>
                <h3 style="margin:0;font-size:1rem">${name}</h3>
                <p style="margin:2px 0 0;color:var(--text-muted);font-size:.8rem;text-transform:capitalize">${dateLabel}</p>
            </div>
        </div>
        <button class="sg-mclose" onclick="document.getElementById('sg-subst-resolve-modal').remove()">✕</button>
    </div>

    <div class="sg-resolve-flag-banner ${isSub ? 'sub' : 'need'}">
        <span class="sg-resolve-flag-ico">${icon}</span>
        <div>
            <div class="sg-resolve-flag-title">${isSub ? 'Може вийти на підміну' : 'Потрібна підміна'}</div>
            <div class="sg-resolve-flag-desc">${desc}</div>
        </div>
    </div>

    <p class="sg-resolve-hint">Підтвердіть, що питання вирішено — співробітник отримає сповіщення.</p>

    <div class="sg-modal-actions">
        <button class="sg-btn-save sg-resolve-confirm-btn"
            onclick="ScheduleGraphPage._confirmSubstResolved('${userId}','${date}','${locId}',${isSub},'${name.replace(/'/g,"\\'")}')">
            ✓ ${actionLabel}
        </button>
        <button class="sg-btn-cancel" onclick="document.getElementById('sg-subst-resolve-modal').remove()">
            Скасувати
        </button>
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
        // restore entry for edit button
        el._entry = entry; el._profile = profile;
    },

    async _confirmSubstResolved(userId, date, locId, isSub, empName) {
        document.getElementById('sg-subst-resolve-modal')?.remove();
        if (isSub) {
            // Employee volunteered → confirm them directly
            await this._applySubstShift(userId, date, locId, userId, empName, empName);
        } else {
            // Need replacement → let manager pick who covers
            await this._pickSubstEmployee(userId, date, locId, empName);
        }
    },

    async _pickSubstEmployee(originalUserId, date, locId, originalEmpName) {
        const { data: profiles } = await supabase.from('profiles')
            .select('id, full_name, role, label')
            .order('full_name');
        const available = (profiles || []).filter(p => p.id !== originalUserId);
        this._showSubstPickerModal(originalUserId, date, locId, originalEmpName, available);
    },

    _showSubstPickerModal(originalUserId, date, locId, originalEmpName, profiles) {
        document.getElementById('sg-subst-picker-modal')?.remove();
        const dateLabel = new Date(date + 'T00:00:00')
            .toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' });
        const el = document.createElement('div');
        el.id = 'sg-subst-picker-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal sg-picker-modal">
    <div class="sg-mhdr">
        <div>
            <h3 style="margin:0;font-size:1rem">🔄 Хто виходить на заміну?</h3>
            <p style="margin:3px 0 0;color:var(--text-muted);font-size:.8rem">
                Замість <strong>${originalEmpName}</strong> · ${dateLabel}
            </p>
        </div>
        <button class="sg-mclose" onclick="document.getElementById('sg-subst-picker-modal').remove()">✕</button>
    </div>
    <input class="sg-msearch" id="sg-subst-picker-q" placeholder="🔍 Пошук за ім'ям…"
        oninput="ScheduleGraphPage._filterSubstPicker(this.value)" autocomplete="off">
    <div class="sg-emp-list" id="sg-subst-picker-list">
        ${profiles.map(p => {
            const initials = (p.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            const color = this._avatarColor(p.id);
            const meta = [p.role ? Fmt.role(p.role) : '', p.label || ''].filter(Boolean).join(' · ');
            return `<div class="sg-emp-row" data-name="${(p.full_name || '').toLowerCase()}"
                onclick="ScheduleGraphPage._applySubstShift('${originalUserId}','${date}','${locId}','${p.id}','${originalEmpName.replace(/'/g,"\\'")}','${(p.full_name||'').replace(/'/g,"\\'")}')">
                <div class="sg-av sm" style="background:${color}">${initials}</div>
                <div>
                    <div class="sg-emp-fn">${p.full_name || 'Без імені'}</div>
                    ${meta ? `<div class="sg-emp-meta">${meta}</div>` : ''}
                </div>
                <span class="sg-picker-arrow">→</span>
            </div>`;
        }).join('')}
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
        document.getElementById('sg-subst-picker-q')?.focus();
    },

    _filterSubstPicker(q) {
        const v = q.toLowerCase();
        document.querySelectorAll('#sg-subst-picker-list .sg-emp-row').forEach(r => {
            r.style.display = r.dataset.name.includes(v) ? '' : 'none';
        });
    },

    async _applySubstShift(originalUserId, date, locId, substituteId, originalEmpName, substituteName) {
        document.getElementById('sg-subst-picker-modal')?.remove();

        const dateLabel = new Date(date + 'T00:00:00')
            .toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
        const managerName = AppState.profile?.full_name || 'Керівник';
        const isSelf = originalUserId === substituteId;

        // Check if substitute already has a work shift elsewhere on this date
        const conflictLoc = await this._getWorkConflictLoc(substituteId, date, locId);
        if (conflictLoc) {
            Toast.error(
                'Конфлікт змін',
                `${substituteName} вже має робочу зміну у «${conflictLoc}» цього дня. Оберіть іншого співробітника.`
            );
            return;
        }

        // Ensure substitute is assigned to this location
        const alreadyAssigned = this._allAssignments.some(
            a => a.user_id === substituteId && a.locId === locId
        ) || this._assignments.some(a => a.user_id === substituteId);
        if (!alreadyAssigned) {
            const { error: ae } = await supabase.from('schedule_assignments')
                .insert({ location_id: locId, user_id: substituteId, created_by: AppState.user.id });
            if (ae && ae.code !== '23505') { Toast.error('Помилка', ae.message); return; }
        }

        // Set work shift (Р) for substitute — marked as confirmed substitution
        const payload = {
            location_id: locId, user_id: substituteId, date,
            shift_type: 'work', shift_start: null, shift_end: null, notes: '__sub_confirmed__',
            updated_by: AppState.user.id, updated_at: new Date().toISOString()
        };
        const { error: se } = await supabase.from('schedule_entries')
            .upsert(payload, { onConflict: 'location_id,user_id,date' });
        if (se) { Toast.error('Помилка', se.message); return; }

        // Remove original employee's entry (they requested replacement, so they don't work that day)
        if (!isSelf) {
            await supabase.from('schedule_entries')
                .delete()
                .eq('location_id', locId).eq('user_id', originalUserId).eq('date', date);
        }

        // Update local caches
        const origKey = `${originalUserId}_${date}`;
        const origAllKey = `${locId}_${originalUserId}_${date}`;
        if (!isSelf) {
            delete this._entries[origKey];
            delete this._allEntries[origAllKey];
        }

        // Notification to original employee (if different from substitute)
        if (!isSelf) {
            await supabase.from('notifications').insert({
                user_id: originalUserId,
                title: 'Заміна знайдена',
                message: `${managerName} знайшов заміну для вас на ${dateLabel}. Виходить ${substituteName}.`,
                type: 'general', created_by: AppState.user.id
            });
        }

        // Notification to substitute
        await supabase.from('notifications').insert({
            user_id: substituteId,
            title: isSelf ? 'Вас беруть на підміну' : 'Вас призначено на підміну',
            message: `${managerName} підтвердив вашу зміну (Р) на ${dateLabel}.`,
            type: 'general', created_by: AppState.user.id
        });

        await this._loadPageData();
        if (this._locId === 'all') await this._loadAllData();
        this._render(this._container);

        this._showManagerReminderModal(substituteName, 'підміні');
    },

    _showManagerReminderModal(empName, context) {
        document.getElementById('sg-reminder-modal')?.remove();
        const el = document.createElement('div');
        el.id = 'sg-reminder-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal sg-reminder-modal-box">
    <div class="sg-reminder-header">
        <span class="sg-reminder-bell">🔔</span>
        <h3 class="sg-reminder-title">Не забудьте зателефонувати!</h3>
    </div>
    <p class="sg-reminder-body">
        Зв'яжіться з <strong>${empName}</strong> та повідомте про підтверджену ${context}.
    </p>
    <p class="sg-reminder-sub">Сповіщення вже надіслано у додаток, але особистий дзвінок буде не зайвим.</p>
    <button class="sg-btn-save" style="width:100%;margin-top:4px"
        onclick="document.getElementById('sg-reminder-modal').remove()">
        Зрозуміло
    </button>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    async _showManagerHelpModal() {
        const { data: existing } = await supabase.from('schedule_entries')
            .select('id, date, location_id')
            .eq('user_id', AppState.user.id)
            .eq('notes', '__mgr_help__')
            .order('date');

        document.getElementById('sg-mgr-help-modal')?.remove();
        const el = document.createElement('div');
        el.id = 'sg-mgr-help-modal';
        el.className = 'sg-overlay';

        const p = n => String(n).padStart(2, '0');
        const today = new Date();
        const defaultDate = `${today.getFullYear()}-${p(today.getMonth()+1)}-${p(today.getDate())}`;
        const defaultLoc = (this._locId && this._locId !== 'all') ? this._locId : this._locations[0]?.id || '';

        el.innerHTML = `
<div class="sg-modal sg-mgr-help-box">
    <div class="sg-mhdr">
        <div>
            <h3 style="margin:0;font-size:1.05rem">🆘 Потрібна підміна</h3>
            <p style="margin:3px 0 0;color:var(--text-muted);font-size:.8rem">
                Всі співробітники отримають сповіщення та мітку в календарі
            </p>
        </div>
        <button class="sg-mclose" onclick="document.getElementById('sg-mgr-help-modal').remove()">✕</button>
    </div>
    <label style="font-size:.82rem;color:var(--text-muted);display:block;margin-bottom:6px">Локація</label>
    <select id="sg-mgr-help-loc" class="sg-loc-input" style="margin-bottom:10px">
        ${this._locations.map(l => `<option value="${l.id}"${l.id === defaultLoc ? ' selected' : ''}>🏪 ${l.name}</option>`).join('')}
    </select>
    <label style="font-size:.82rem;color:var(--text-muted);display:block;margin-bottom:6px">Дата підміни</label>
    <input type="date" id="sg-mgr-help-date" class="sg-loc-input" value="${defaultDate}">
    <div class="sg-modal-actions" style="margin-top:16px">
        <button class="sg-btn-save" onclick="ScheduleGraphPage._saveManagerHelp()">
            📢 Надіслати всім
        </button>
        <button class="sg-btn-cancel" onclick="document.getElementById('sg-mgr-help-modal').remove()">Скасувати</button>
    </div>
    ${(existing || []).length ? `
    <div class="sg-mgr-help-existing">
        <div class="sg-mgr-help-existing-title">Активні запити</div>
        ${(existing || []).map(e => {
            const dl = new Date(e.date + 'T00:00:00').toLocaleDateString('uk-UA', { weekday:'short', day:'numeric', month:'long' });
            const locName = this._locations.find(l => l.id === e.location_id)?.name || '';
            return `<div class="sg-mgr-help-existing-row">
                <div>
                    <div style="font-size:.875rem">📅 ${dl}</div>
                    ${locName ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:1px">🏪 ${locName}</div>` : ''}
                </div>
                <button class="sg-mgr-help-cancel-btn" title="Скасувати"
                    onclick="ScheduleGraphPage._cancelManagerHelp('${e.id}')">✕</button>
            </div>`;
        }).join('')}
    </div>` : ''}
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    async _saveManagerHelp() {
        const date  = document.getElementById('sg-mgr-help-date')?.value;
        const locId = document.getElementById('sg-mgr-help-loc')?.value;
        if (!date)  { Toast.error('Оберіть дату'); return; }
        if (!locId) { Toast.error('Оберіть локацію'); return; }

        const locName = this._locations.find(l => l.id === locId)?.name || 'локації';

        const { error } = await supabase.from('schedule_entries').upsert({
            location_id: locId, user_id: AppState.user.id, date,
            shift_type: 'work', notes: '__mgr_help__',
            updated_by: AppState.user.id, updated_at: new Date().toISOString()
        }, { onConflict: 'location_id,user_id,date' });
        if (error) { Toast.error('Помилка', error.message); return; }

        // Notify all employees across all locations
        const locIds = this._locations.map(l => l.id);
        const { data: assigns } = await supabase.from('schedule_assignments')
            .select('user_id').in('location_id', locIds);
        const userIds = [...new Set((assigns || []).map(a => a.user_id))];

        if (userIds.length) {
            const dateLabel = new Date(date + 'T00:00:00')
                .toLocaleDateString('uk-UA', { weekday:'long', day:'numeric', month:'long' });
            const managerName = AppState.profile?.full_name || 'Керівник';
            await supabase.from('notifications').insert(
                userIds.map(uid => ({
                    user_id: uid,
                    title: '🆘 Потрібна підміна',
                    message: `${managerName} шукає підміну на ${dateLabel} у «${locName}». Якщо можете вийти — повідомте керівнику.`,
                    type: 'general', created_by: AppState.user.id
                }))
            );
        }

        document.getElementById('sg-mgr-help-modal')?.remove();
        await this._loadHelpLocIds();
        this._render(this._container);
        Toast.success(`Запит надіслано${userIds.length ? ` ${userIds.length} співробітникам` : ''}`);
    },

    async _cancelManagerHelp(id) {
        await supabase.from('schedule_entries').delete().eq('id', id);
        await this._loadHelpLocIds();
        this._render(this._container);
        await this._showManagerHelpModal();
    },

    _allLocsSection() {
        const days = new Date(this._year, this._month + 1, 0).getDate();
        const nums = Array.from({ length: days }, (_, i) => i + 1);
        const sd   = this._substDate;

        const byLoc = {};
        this._allAssignments.forEach(a => {
            if (!byLoc[a.locId]) byLoc[a.locId] = { name: a.locName, members: [] };
            if (!byLoc[a.locId].members.find(m => m.user_id === a.user_id))
                byLoc[a.locId].members.push(a);
        });

        // Build substitution lists
        let freeList = [], busyList = [];
        if (sd) {
            this._allAssignments.forEach(a => {
                const type = this._allEntries[`${a.locId}_${a.user_id}_${sd}`]?.shift_type;
                (!type || type === 'day_off' ? freeList : busyList).push(a);
            });
        }

        const sdLabel = sd ? new Date(sd + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', weekday: 'short' }) : '';

        const legend = Object.entries(SHIFT_TYPES).map(([k, v]) => `
            <button class="sg-leg-btn ${this._quickType === k ? 'active' : ''}"
                style="--lc:${v.color};--lb:${v.bg}"
                onclick="ScheduleGraphPage._setQuickType('${k}')">
                <span class="sg-leg-short" style="background:${v.bg};color:${v.color}">${v.short}</span>
                ${v.label}
                ${this._quickType === k ? '<span class="sg-leg-active-mark">✓</span>' : ''}
            </button>`).join('');

        return `
<div class="sg-section">
    <div class="sg-toolbar">
        <div class="sg-legend">${legend}</div>
        <div style="display:flex;gap:8px;align-items:center">
            <button class="sg-mgr-help-btn" onclick="ScheduleGraphPage._showManagerHelpModal()">
                🆘 Потрібна підміна
            </button>
            <button class="sg-viewers-btn" onclick="ScheduleGraphPage._showViewersModal()">
                👁 Доступ
            </button>
        </div>
    </div>
    ${this._quickType ? `
    <div class="sg-quick-bar">
        <span>⚡ Швидке заповнення:</span>
        <span class="sg-quick-badge" style="background:${SHIFT_TYPES[this._quickType].bg};color:${SHIFT_TYPES[this._quickType].color}">
            ${SHIFT_TYPES[this._quickType].short} ${SHIFT_TYPES[this._quickType].label}
        </span>
        <span>— натискайте комірки</span>
        <button class="sg-quick-cancel" onclick="ScheduleGraphPage._setQuickType(null)">✕</button>
    </div>` : ''}

    <div class="sg-subst-hint">
        <span class="sg-subst-hint-text">🖱 Натисніть на <strong>заголовок дня</strong> щоб побачити хто може підмінити</span>
        ${sd ? `<button class="sg-subst-clear" onclick="ScheduleGraphPage._selectSubstDate(null)">✕ Скинути</button>` : ''}
    </div>

    ${sd ? `
    <div class="sg-subst-panel">
        <div class="sg-subst-date-label">📅 ${sdLabel}</div>
        <div class="sg-subst-cols">
            <div class="sg-subst-free">
                <div class="sg-subst-col-title free">🟢 Вільні (${freeList.length})</div>
                <div class="sg-subst-scroll">
                ${freeList.length ? freeList.map(a => {
                    const entry = this._allEntries[`${a.locId}_${a.user_id}_${sd}`];
                    const shift = entry ? SHIFT_TYPES[entry.shift_type] : null;
                    const wantsSub = entry?.notes === '__sub__';
                    return `<div class="sg-subst-person sg-subst-free-card${wantsSub?' sg-subst-wants-sub':''}"
                        onclick="ScheduleGraphPage._assignSubstitute('${a.user_id}')"
                        title="Натисніть щоб призначити на підміну">
                        <div class="sg-av sm">${(a.profile?.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
                        <div><div class="sg-subst-name">${a.profile?.full_name||'Невідомо'}</div>
                        <div class="sg-subst-loc">🏪 ${a.locName}</div>
                        ${wantsSub ? `<div class="sg-sub-wants-badge">🙋 Пропонує підміну</div>` : ''}</div>
                        ${shift ? `<span class="sg-badge" style="background:${shift.bg};color:${shift.color};margin-left:auto">${shift.short}</span>`
                                : `<span class="sg-badge" style="background:rgba(16,185,129,.1);color:#10b981;margin-left:auto">—</span>`}
                        <span class="sg-subst-add-btn">+</span>
                    </div>`;
                }).join('') : '<div class="sg-subst-empty">Немає вільних</div>'}
                </div>
            </div>
            <div class="sg-subst-busy">
                <div class="sg-subst-col-title busy">🔴 Зайняті (${busyList.length})</div>
                <div class="sg-subst-scroll">
                ${busyList.map(a => {
                    const entry = this._allEntries[`${a.locId}_${a.user_id}_${sd}`];
                    const shift = entry ? SHIFT_TYPES[entry.shift_type] : null;
                    const needsSub = entry?.notes === '__needsub__';
                    return `<div class="sg-subst-person busy${needsSub?' sg-subst-needs-sub':''}">
                        <div class="sg-av sm">${(a.profile?.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
                        <div><div class="sg-subst-name">${a.profile?.full_name||'Невідомо'}</div>
                        <div class="sg-subst-loc">🏪 ${a.locName}</div>
                        ${needsSub ? `<div class="sg-needsub-badge">🆘 Потрібна підміна</div>` : ''}</div>
                        ${shift ? `<span class="sg-badge" style="background:${shift.bg};color:${shift.color};margin-left:auto">${shift.short}</span>` : ''}
                    </div>`;
                }).join('')}
                </div>
            </div>
        </div>
    </div>` : ''}

    <div class="sg-scroll-wrap" id="sg-wrap-all" onscroll="ScheduleGraphPage._onScroll('all')">
        <table class="sg-table">
            <thead>
                <tr>
                    <th class="sg-th-name">Співробітник</th>
                    ${nums.map(d => {
                        const date = this._dateStr(d);
                        const dow  = new Date(this._year, this._month, d).getDay();
                        const we   = dow === 0 || dow === 6;
                        const isSd = date === sd;
                        return `<th class="sg-th-day${we?' we':''}${isSd?' sg-sd-col':''}"
                            style="cursor:pointer" title="Клік — пошук підміни"
                            onclick="ScheduleGraphPage._selectSubstDate('${date}')">
                            <div class="sg-day-num">${d}</div>
                            <div class="sg-day-dow">${DAYS_SHORT[dow]}</div>
                        </th>`;
                    }).join('')}
                    <th class="sg-th-sum">
                        <div class="sg-th-sum-inner">Σ</div>
                        <div class="sg-th-sub">Дні</div>
                    </th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(byLoc).map(([locId, loc]) => {
                    const rows = loc.members.map(a => {
                        const p = a.profile || {};
                        const init = (p.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
                        let workDays = 0;
                        const cells = nums.map(d => {
                            const date   = this._dateStr(d);
                            const entry  = this._allEntries[`${a.locId}_${a.user_id}_${date}`];
                            const shift  = entry ? SHIFT_TYPES[entry.shift_type] : null;
                            const dow    = new Date(this._year, this._month, d).getDay();
                            const we     = dow === 0 || dow === 6;
                            const isSd   = date === sd;
                            const type   = entry?.shift_type;
                            const isFree = sd && isSd && (!type || type === 'day_off');
                            const isBusy = sd && isSd && !isFree;
                            if (type === 'work') workDays++;
                            const isSubConf = entry?.notes === '__sub_confirmed__';
                            const flagIco = entry?.notes === '__sub__' ? '🙋' : entry?.notes === '__needsub__' ? '🆘' : '';
                            const dispShift = isSubConf ? SUB_CONFIRMED : shift;
                            return `<td class="sg-cell${we?' we':''}${isSd?' sg-sd-col':''}${isFree?' sg-free-cell':''}${isBusy?' sg-busy-cell':''}${entry?.notes==='__needsub__'?' sg-needsub-cell':''}"
                                data-uid="${a.user_id}" data-date="${date}"
                                onclick="ScheduleGraphPage._openCellAll('${locId}','${a.user_id}','${date}')"
                                title="${entry?.notes==='__sub__' ? 'Може вийти на підміну' : entry?.notes==='__needsub__' ? 'Потрібна підміна' : isSubConf ? 'Підтверджена підміна' : shift ? shift.label : 'Клік щоб додати'}">
                                ${flagIco
                                    ? `<span class="sg-flag-cell">${flagIco}</span>`
                                    : dispShift ? `<span class="sg-badge" style="background:${dispShift.bg};color:${dispShift.color}">${dispShift.short}</span>`
                                    : isFree ? `<span class="sg-free-dot">●</span>` : ''}
                            </td>`;
                        }).join('');
                        const rowType  = sd ? this._allEntries[`${a.locId}_${a.user_id}_${sd}`]?.shift_type : null;
                        const rowClass = sd ? ((!rowType || rowType === 'day_off') ? 'sg-row-free' : 'sg-row-busy') : '';
                        return `<tr class="${rowClass}">
                            ${this._nameCell(a.profile, a.user_id)}
                            ${cells}
                            <td class="sg-td-sum">${workDays}</td>
                        </tr>`;
                    }).join('');
                    return `
                    <tr class="sg-loc-header-row">
                        <td colspan="${days + 2}" class="sg-loc-group-header">🏪 ${loc.name}</td>
                    </tr>
                    ${rows}`;
                }).join('')}
            </tbody>
        </table>
    </div>
</div>`;
    },

    _openCellAll(locId, userId, date) {
        if (this._isPastMonth()) { Toast.error('Місяць завершено', 'Редагування минулих місяців заблоковано'); return; }
        if (this._quickType) {
            this._quickSaveAll(locId, userId, date, this._quickType);
            return;
        }
        const entry = this._allEntries[`${locId}_${userId}_${date}`];
        const a = this._allAssignments.find(a => a.user_id === userId && a.locId === locId);
        if (entry?.notes === '__sub__' || entry?.notes === '__needsub__') {
            this._showSubstResolveModal(userId, date, entry, a?.profile, locId);
            return;
        }
        this._showShiftModal(userId, date, entry, a?.profile, false);
        // Override save to use allEntries
        this.__allLocId = locId;
    },

    async _quickSaveAll(locId, userId, date, type) {
        const key    = `${locId}_${userId}_${date}`;
        const oldEnt = this._allEntries[key];
        if (oldEnt?.shift_type === type) {
            await supabase.from('schedule_entries').delete()
                .eq('location_id', locId).eq('user_id', userId).eq('date', date);
            delete this._allEntries[key];
            document.querySelectorAll(`.sg-cell[data-uid="${userId}"][data-date="${date}"]`)
                .forEach(td => { td.innerHTML = ''; });
            return;
        }
        if (type === 'work') {
            const conflictLoc = await this._getWorkConflictLoc(userId, date, locId);
            if (conflictLoc) { Toast.error('Конфлікт змін', `Вже є робоча зміна у «${conflictLoc}»`); return; }
        }

        const payload = {
            location_id: locId, user_id: userId, date,
            shift_type: type, shift_start: null, shift_end: null, notes: null,
            updated_by: AppState.user.id, updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase.from('schedule_entries')
            .upsert(payload, { onConflict: 'location_id,user_id,date' }).select().single();
        if (error) { Toast.error('Помилка', error.message); return; }
        this._allEntries[key] = data;
        const shift = SHIFT_TYPES[type];
        document.querySelectorAll(`.sg-cell[data-uid="${userId}"][data-date="${date}"]`)
            .forEach(td => { td.innerHTML = `<span class="sg-badge" style="background:${shift.bg};color:${shift.color}">${shift.short}</span>`; });
    },

    async _getWorkConflictLoc(userId, date, locId) {
        const { data } = await supabase.from('schedule_entries')
            .select('location_id')
            .eq('user_id', userId)
            .eq('date', date)
            .eq('shift_type', 'work')
            .neq('location_id', locId);
        if (!data?.length) return null;
        const conflictId = data[0].location_id;
        const known = this._locations.find(l => l.id === conflictId);
        if (known) return known.name;
        const { data: ld } = await supabase.from('schedule_locations')
            .select('name').eq('id', conflictId).single();
        return ld?.name || 'іншій локації';
    },

    _showShiftModalError(msg) {
        document.getElementById('sg-shift-modal-err')?.remove();
        const el = document.createElement('div');
        el.id = 'sg-shift-modal-err';
        el.className = 'sg-shift-modal-err';
        el.innerHTML = `⚠️ ${msg}`;
        const actions = document.querySelector('#sg-shift-modal .sg-modal-actions');
        if (actions) actions.before(el);
    },

    _whKey(locId) { return `sg_wh_${locId}`; },

    _getWorkHours(locId) {
        try { return JSON.parse(localStorage.getItem(this._whKey(locId)) || '{}'); } catch { return {}; }
    },

    _editWorkHours() {
        const wh = this._getWorkHours(this._locId);
        document.getElementById('sg-wh-display').style.display = 'none';
        document.querySelector('.sg-wh-edit').style.display = 'none';
        document.getElementById('sg-wh-inputs').style.display = 'flex';
        const s = document.getElementById('sg-wh-start');
        const e = document.getElementById('sg-wh-end');
        if (s) s.value = wh.start || '09:00';
        if (e) e.value = wh.end   || '18:00';
    },

    _cancelWorkHours() {
        document.getElementById('sg-wh-display').style.display = '';
        document.querySelector('.sg-wh-edit').style.display = '';
        document.getElementById('sg-wh-inputs').style.display = 'none';
    },

    _saveWorkHours() {
        const start = document.getElementById('sg-wh-start')?.value;
        const end   = document.getElementById('sg-wh-end')?.value;
        if (!start || !end) return;
        localStorage.setItem(this._whKey(this._locId), JSON.stringify({ start, end }));
        this._cancelWorkHours();
        document.getElementById('sg-wh-display').textContent = `${start} — ${end}`;
        Toast.success('Час роботи збережено');
    },

    _isLocked() {
        return this._locations.find(l => l.id === this._locId)?.locked || false;
    },

    _isPastMonth() {
        const now = new Date();
        return this._year < now.getFullYear() ||
               (this._year === now.getFullYear() && this._month < now.getMonth());
    },

    async _toggleLock() {
        const loc = this._locations.find(l => l.id === this._locId);
        if (!loc) return;
        const newLocked = !loc.locked;
        const { error } = await supabase.from('schedule_locations')
            .update({ locked: newLocked })
            .eq('id', this._locId);
        if (error) { Toast.error('Помилка', error.message); return; }
        loc.locked = newLocked;
        this._render(this._container);
        Toast.success(newLocked ? '🔒 Графік заблоковано' : '🔓 Графік розблоковано',
            newLocked ? 'Співробітники не можуть вносити зміни' : 'Співробітники знову можуть редагувати');
    },

    async _showViewersModal() {
        document.getElementById('sg-viewers-modal')?.remove();

        // Load current viewers for this manager's locations
        const locIds = this._locations.map(l => l.id);
        const [vDataRes, vAllRes, allProfilesRes] = await Promise.all([
            supabase.from('schedule_viewers')
                .select('id, user_id, location_id')
                .in('location_id', locIds.length ? locIds : ['00000000-0000-0000-0000-000000000000']),
            supabase.from('schedule_viewers')
                .select('id, user_id, location_id')
                .is('location_id', null)
                .eq('granted_by', AppState.user.id),
            supabase.from('profiles').select('id, full_name, avatar_url').order('full_name')
        ]);

        const rawViewers = [...(vDataRes.data || []), ...(vAllRes.data || [])];
        const allProfiles = allProfilesRes.data || [];

        // Attach profile data from already-loaded profiles list
        const profileMap = Object.fromEntries(allProfiles.map(p => [p.id, p]));
        this._viewers = rawViewers.map(v => ({ ...v, profile: profileMap[v.user_id] || null }));

        this._viewerProfiles = allProfiles.filter(p => p.id !== AppState.user.id);

        const el = document.createElement('div');
        el.id = 'sg-viewers-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal sg-viewers-modal-box">
    <div class="sg-mhdr">
        <div>
            <h3 style="margin:0;font-size:1.05rem">👁 Доступ для перегляду</h3>
            <p style="margin:4px 0 0;font-size:.78rem;color:var(--text-muted)">Користувачі можуть переглядати графік без права редагування</p>
        </div>
        <button class="sg-mclose" onclick="document.getElementById('sg-viewers-modal').remove()">✕</button>
    </div>

    <div class="sg-viewers-add">
        <div class="sg-viewer-search-wrap">
            <input type="text" id="sg-viewer-search" class="sg-viewer-search-input"
                placeholder="🔍 Пошук користувача…" autocomplete="off"
                oninput="ScheduleGraphPage._filterViewerUsers(this.value)"
                onfocus="ScheduleGraphPage._openViewerDropdown()"
                onblur="setTimeout(()=>ScheduleGraphPage._closeViewerDropdown(),150)">
            <input type="hidden" id="sg-viewer-user">
            <div class="sg-viewer-dropdown" id="sg-viewer-dropdown">
                ${this._viewerProfiles.map(p => `
                <div class="sg-viewer-drop-item" data-id="${p.id}" data-name="${(p.full_name||'').replace(/"/g,'&quot;')}"
                    onmousedown="ScheduleGraphPage._pickViewerUser('${p.id}','${(p.full_name||p.id).replace(/'/g,"\\'")}')">
                    ${p.full_name || p.id}
                </div>`).join('')}
            </div>
        </div>
        <div class="sg-viewers-add-row">
            <select id="sg-viewer-loc" class="sg-viewers-select">
                <option value="">Всі локації</option>
                ${this._locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
            </select>
            <button class="sg-viewers-add-btn" onclick="ScheduleGraphPage._addViewer()">＋ Додати</button>
        </div>
    </div>

    <div class="sg-viewers-list" id="sg-viewers-list">
        ${this._renderViewersList()}
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    _openViewerDropdown() {
        const dd    = document.getElementById('sg-viewer-dropdown');
        const input = document.getElementById('sg-viewer-search');
        if (!dd || !input) return;
        const rect = input.getBoundingClientRect();
        dd.style.top   = (rect.bottom + 4) + 'px';
        dd.style.left  = rect.left + 'px';
        dd.style.width = rect.width + 'px';
        dd.classList.add('open');
    },

    _closeViewerDropdown() {
        const dd = document.getElementById('sg-viewer-dropdown');
        if (dd) dd.classList.remove('open');
    },

    _filterViewerUsers(query) {
        const dd = document.getElementById('sg-viewer-dropdown');
        if (!dd) return;
        this._openViewerDropdown();
        const q = query.trim().toLowerCase();
        dd.querySelectorAll('.sg-viewer-drop-item').forEach(item => {
            const name = (item.dataset.name || '').toLowerCase();
            item.classList.toggle('hidden', q.length > 0 && !name.includes(q));
        });
        // Clear selection if user edits the text
        document.getElementById('sg-viewer-user').value = '';
    },

    _pickViewerUser(id, name) {
        document.getElementById('sg-viewer-user').value = id;
        document.getElementById('sg-viewer-search').value = name;
        this._closeViewerDropdown();
    },

    _renderViewersList() {
        if (!this._viewers.length) return `
            <div class="sg-viewers-empty">Поки немає користувачів з доступом для перегляду</div>`;
        return this._viewers.map(v => {
            const p = v.profile;
            const name = p?.full_name || v.user_id;
            const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
            const locName = v.location_id
                ? (this._locations.find(l => l.id === v.location_id)?.name || v.location_id)
                : 'Всі локації';
            return `
            <div class="sg-viewers-row" id="sg-vrow-${v.id}">
                <div class="sg-av sm">${initials}</div>
                <div class="sg-viewers-info">
                    <div class="sg-viewers-name">${name}</div>
                    <div class="sg-viewers-scope">🏪 ${locName}</div>
                </div>
                <button class="sg-viewers-del" onclick="ScheduleGraphPage._removeViewer('${v.id}')" title="Видалити доступ">✕</button>
            </div>`;
        }).join('');
    },

    async _addViewer() {
        const userId = document.getElementById('sg-viewer-user')?.value;
        const locId  = document.getElementById('sg-viewer-loc')?.value || null;
        if (!userId) { Toast.error('Оберіть користувача'); return; }

        const { data, error } = await supabase.from('schedule_viewers')
            .insert({ user_id: userId, location_id: locId, granted_by: AppState.user.id })
            .select('id, user_id, location_id')
            .single();
        if (error) { Toast.error('Помилка', error.message); return; }

        const { data: prof } = await supabase.from('profiles')
            .select('id, full_name').eq('id', userId).single();
        this._viewers.push({ ...data, profile: prof || null });
        document.getElementById('sg-viewers-list').innerHTML = this._renderViewersList();
        document.getElementById('sg-viewer-user').value = '';
        Toast.success('Доступ надано');
    },

    async _removeViewer(id) {
        const { error } = await supabase.from('schedule_viewers').delete().eq('id', id);
        if (error) { Toast.error('Помилка', error.message); return; }
        this._viewers = this._viewers.filter(v => v.id !== id);
        document.getElementById('sg-viewers-list').innerHTML = this._renderViewersList();
        Toast.success('Доступ видалено');
    },

    async _addEmployee() {
        const assignedIds = new Set(this._assignments.map(a => a.user_id));
        const { data } = await supabase.from('profiles')
            .select('id, full_name, role, label')
            .order('full_name');
        const available = (data || []).filter(p => !assignedIds.has(p.id));

        if (!available.length) { Toast.info('Всіх доступних вже додано'); return; }
        this._showEmpModal(available);
    },

    _showEmpModal(profiles) {
        document.getElementById('sg-emp-modal')?.remove();
        const el = document.createElement('div');
        el.id = 'sg-emp-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal">
    <div class="sg-mhdr">
        <h3>Додати співробітника</h3>
        <button class="sg-mclose" onclick="document.getElementById('sg-emp-modal').remove()">✕</button>
    </div>
    <input class="sg-msearch" placeholder="🔍 Пошук за ім'ям..." id="sg-emp-q"
        oninput="ScheduleGraphPage._filterEmp(this.value)">
    <div class="sg-emp-list" id="sg-emp-list">
        ${profiles.map(p => `
        <div class="sg-emp-row" data-name="${(p.full_name||'').toLowerCase()}"
            onclick="ScheduleGraphPage._confirmAddEmployee('${p.id}')">
            <div class="sg-av sm">${(p.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
            <div>
                <div class="sg-emp-fn">${p.full_name || 'Без імені'}</div>
                <div class="sg-emp-meta">${p.role || ''}${p.label?' · 🏷 '+p.label:''}</div>
            </div>
        </div>`).join('')}
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
        document.getElementById('sg-emp-q')?.focus();
    },

    _filterEmp(q) {
        const v = q.toLowerCase();
        document.querySelectorAll('#sg-emp-list .sg-emp-row').forEach(r => {
            r.style.display = r.dataset.name.includes(v) ? '' : 'none';
        });
    },

    async _confirmAddEmployee(userId) {
        document.getElementById('sg-emp-modal')?.remove();
        const { data, error } = await supabase.from('schedule_assignments')
            .insert({ location_id: this._locId, user_id: userId, created_by: AppState.user.id })
            .select('id, user_id')
            .single();
        if (error) { Toast.error('Помилка', error.message); return; }

        const { data: prof } = await supabase.from('profiles')
            .select('id, full_name, avatar_url, role, label')
            .eq('id', userId)
            .single();

        this._assignments.push({ id: data.id, user_id: data.user_id, profile: prof });
        this._render(this._container);
        Toast.success('Додано до графіку');
    },

    async _removeEmployee(assignId, userId, e) {
        e.stopPropagation();
        if (!confirm('Видалити співробітника з цього графіку?')) return;
        const { error } = await supabase.from('schedule_assignments').delete().eq('id', assignId);
        if (error) { Toast.error('Помилка', error.message); return; }
        this._assignments = this._assignments.filter(a => a.id !== assignId);
        Object.keys(this._entries).filter(k => k.startsWith(userId + '_')).forEach(k => delete this._entries[k]);
        this._render(this._container);
        Toast.success('Видалено');
    },

    _openCell(userId, date) {
        if (this._isPastMonth()) { Toast.error('Місяць завершено', 'Редагування минулих місяців заблоковано'); return; }
        if (this._quickType) {
            this._quickSave(userId, date, this._quickType);
            return;
        }
        const entry = this._entries[`${userId}_${date}`];
        const profile = this._assignments.find(a => a.user_id === userId)?.profile;
        if (entry?.notes === '__sub__' || entry?.notes === '__needsub__') {
            this._showSubstResolveModal(userId, date, entry, profile, this._locId);
            return;
        }
        this._showShiftModal(userId, date, entry, profile, false);
    },

    async _quickSave(userId, date, type) {
        if (this._isPastMonth()) { Toast.error('Місяць завершено', 'Редагування минулих місяців заблоковано'); return; }
        const key    = `${userId}_${date}`;
        const oldEnt = this._entries[key];

        // Toggle off if same type already set
        if (oldEnt?.shift_type === type) {
            await this._deleteEntry(userId, date, null);
            return;
        }
        const empName = this._assignments.find(a => a.user_id === userId)?.profile?.full_name || '';

        if (type === 'work') {
            const conflictLoc = await this._getWorkConflictLoc(userId, date, this._locId);
            if (conflictLoc) { Toast.error('Конфлікт змін', `Вже є робоча зміна у «${conflictLoc}»`); return; }
        }

        const payload = {
            location_id: this._locId, user_id: userId, date,
            shift_type: type, shift_start: null, shift_end: null, notes: null,
            updated_by: AppState.user.id, updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('schedule_entries')
            .upsert(payload, { onConflict: 'location_id,user_id,date' })
            .select().single();
        if (error) { Toast.error('Помилка', error.message); return; }

        await supabase.from('schedule_log').insert({
            location_id: this._locId, user_id: userId, date, employee_name: empName,
            old_value: oldEnt ? { shift_type: oldEnt.shift_type } : null,
            new_value: { shift_type: type },
            changed_by: AppState.user.id
        });

        this._entries[key] = data;
        // Update only the cell DOM — no full re-render for speed
        const shift = SHIFT_TYPES[type];
        document.querySelectorAll(`.sg-cell[data-uid="${userId}"][data-date="${date}"]`).forEach(td => {
            td.innerHTML = `<span class="sg-badge" style="background:${shift.bg};color:${shift.color}">${shift.short}</span>`;
        });
    },

    _setQuickType(type) {
        this._quickType = this._quickType === type ? null : type;
        this._render(this._container);
    },

    _showShiftModal(userId, date, entry, profile, isEmployee) {
        document.getElementById('sg-shift-modal')?.remove();
        const dateObj = new Date(date + 'T00:00:00');
        const dateLabel = dateObj.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
        const curType = entry?.shift_type || 'work';

        const el = document.createElement('div');
        el.id = 'sg-shift-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal">
    <div class="sg-mhdr">
        <div>
            <h3 style="margin:0">${isEmployee ? 'Мій робочий день' : (profile?.full_name || 'Співробітник')}</h3>
            <p style="margin:4px 0 0;color:var(--text-muted);font-size:.82rem;text-transform:capitalize">${dateLabel}</p>
        </div>
        <button class="sg-mclose" onclick="document.getElementById('sg-shift-modal').remove()">✕</button>
    </div>

    <div class="sg-shift-grid">
        ${Object.entries(SHIFT_TYPES).map(([k, v]) => `
        <button class="sg-stype ${curType === k ? 'active' : ''}"
            style="--sc:${v.color};--sb:${v.bg}"
            onclick="ScheduleGraphPage._pickType('${k}',this)" data-type="${k}">
            <span class="sg-sshort" style="background:${v.bg};color:${v.color}">${v.short}</span>
            <span>${v.label}</span>
        </button>`).join('')}
    </div>

    ${isEmployee ? `
    <div class="sg-cansub-row">
        <label class="sg-cansub-label">
            <input type="checkbox" id="sg-cansub" class="sg-cansub-check" ${entry?.notes === '__sub__' ? 'checked' : ''}
                onchange="ScheduleGraphPage._onFlagChange(this,'sg-needsub')">
            <span class="sg-cansub-ico">🙋</span>
            <span class="sg-cansub-txt">Можу вийти на підміну</span>
        </label>
        <label class="sg-cansub-label sg-needsub-label">
            <input type="checkbox" id="sg-needsub" class="sg-cansub-check sg-needsub-check" ${entry?.notes === '__needsub__' ? 'checked' : ''}
                onchange="ScheduleGraphPage._onFlagChange(this,'sg-cansub')">
            <span class="sg-cansub-ico">🆘</span>
            <span class="sg-cansub-txt">Потрібна підміна</span>
        </label>
    </div>` : ''}

    <div class="sg-notes-wrap">
        <label class="sg-notes-label">Примітка</label>
        <textarea id="sg-notes" class="sg-notes" placeholder="Необов'язково...">${(entry?.notes?.startsWith('__')) ? '' : (entry?.notes || '')}</textarea>
    </div>

    <div class="sg-modal-actions">
        <button class="sg-btn-save"
            onclick="ScheduleGraphPage._saveEntry('${userId}','${date}',${isEmployee})">
            ✓ Зберегти
        </button>
        <button class="sg-btn-cancel"
            onclick="document.getElementById('sg-shift-modal').remove()">Скасувати</button>
        ${entry ? `<button class="sg-del-btn"
            onclick="ScheduleGraphPage._deleteEntry('${userId}','${date}',${isEmployee ? `'${ScheduleGraphEmployee._locId}'` : 'null'})"
            title="Видалити запис">🗑</button>` : ''}
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    _pickType(type, btn) {
        const modal = document.getElementById('sg-shift-modal') || document;
        modal.querySelectorAll('.sg-stype').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    },

    _onFlagChange(checkbox, otherId) {
        if (checkbox.checked) {
            const other = document.getElementById(otherId);
            if (other) other.checked = false;
            // ensure a shift type is selected — default to 'work'
            if (!document.querySelector('#sg-shift-modal .sg-stype.active')) {
                const workBtn = document.querySelector('#sg-shift-modal .sg-stype[data-type="work"]');
                if (workBtn) this._pickType('work', workBtn);
            }
        }
    },

    async _saveEntry(userId, date, isEmployee) {
        const activeBtn = document.querySelector('#sg-shift-modal .sg-stype.active')
                       || document.querySelector('.sg-stype.active');
        const type = activeBtn?.dataset.type || 'work';
        const start  = document.getElementById('sg-tstart')?.value || null;
        const end    = document.getElementById('sg-tend')?.value || null;
        const canSub  = document.getElementById('sg-cansub')?.checked;
        const needSub = document.getElementById('sg-needsub')?.checked;
        const notesRaw = document.getElementById('sg-notes')?.value?.trim() || null;
        const notes  = isEmployee && canSub ? '__sub__' : isEmployee && needSub ? '__needsub__' : notesRaw;
        const locId  = isEmployee
            ? ScheduleGraphEmployee._locId
            : (this._locId === 'all' ? this.__allLocId : this._locId);
        const key    = `${userId}_${date}`;
        const allKey = `${locId}_${userId}_${date}`;
        const oldEnt = isEmployee ? ScheduleGraphEmployee._entries[date]
            : (this._locId === 'all' ? this._allEntries[allKey] : this._entries[key]);
        const empName = (isEmployee
            ? AppState.profile?.full_name
            : (this._locId === 'all'
                ? this._allAssignments.find(a => a.user_id === userId)?.profile?.full_name
                : this._assignments.find(a => a.user_id === userId)?.profile?.full_name)) || '';

        if (type === 'work') {
            const conflictLoc = await this._getWorkConflictLoc(userId, date, locId);
            if (conflictLoc) {
                this._showShiftModalError(`Вже є робоча зміна у локації «${conflictLoc}»`);
                return;
            }
        }

        const payload = {
            location_id: locId, user_id: userId, date,
            shift_type: type,
            shift_start: null,
            shift_end:   null,
            notes, updated_by: AppState.user.id, updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase.from('schedule_entries')
            .upsert(payload, { onConflict: 'location_id,user_id,date' })
            .select().single();
        if (error) { Toast.error('Помилка', error.message); return; }

        await supabase.from('schedule_log').insert({
            location_id: locId, user_id: userId, date, employee_name: empName,
            old_value: oldEnt ? { shift_type: oldEnt.shift_type, shift_start: oldEnt.shift_start, shift_end: oldEnt.shift_end } : null,
            new_value: { shift_type: type, shift_start: payload.shift_start, shift_end: payload.shift_end },
            changed_by: AppState.user.id
        });

        if (isEmployee) {
            ScheduleGraphEmployee._entries[date] = data;
            // If employee sets a work shift on a date with active manager help request — resolve it
            const mgrInfo = ScheduleGraphEmployee._managerHelpDates[date];
            if (mgrInfo && type === 'work') {
                // Re-save with sub_confirmed marker before resolving
                await supabase.from('schedule_entries')
                    .update({ notes: '__sub_confirmed__', updated_by: AppState.user.id })
                    .eq('id', data.id);
                data.notes = '__sub_confirmed__';
                ScheduleGraphEmployee._entries[date] = data;
                await ScheduleGraphEmployee._resolveManagerHelp(
                    date, mgrInfo.entryId, mgrInfo.managerId, mgrInfo.locName
                );
            }
            ScheduleGraphEmployee._render(ScheduleGraphEmployee._container);
        } else if (this._locId === 'all') {
            this._allEntries[allKey] = data;
            this._render(this._container);
        } else {
            this._entries[key] = data;
            this._render(this._container);
        }
        document.getElementById('sg-shift-modal')?.remove();
        Toast.success('Збережено');
    },

    async _deleteEntry(userId, date, locIdOverride) {
        const locId  = locIdOverride || (this._locId === 'all' ? this.__allLocId : this._locId);
        const isEmp  = !!locIdOverride;
        const oldEnt = isEmp
            ? ScheduleGraphEmployee._entries[date]
            : (this._locId === 'all' ? this._allEntries[`${locId}_${userId}_${date}`] : this._entries[`${userId}_${date}`]);
        const empName = isEmp
            ? (AppState.profile?.full_name || '')
            : (this._locId === 'all'
                ? this._allAssignments.find(a => a.user_id === userId)?.profile?.full_name
                : this._assignments.find(a => a.user_id === userId)?.profile?.full_name) || '';

        await supabase.from('schedule_entries')
            .delete()
            .eq('location_id', locId).eq('user_id', userId).eq('date', date);

        await supabase.from('schedule_log').insert({
            location_id: locId, user_id: userId, date, employee_name: empName,
            old_value: oldEnt ? { shift_type: oldEnt.shift_type } : null,
            new_value: null,
            changed_by: AppState.user.id
        });

        if (isEmp) {
            delete ScheduleGraphEmployee._entries[date];
            ScheduleGraphEmployee._render(ScheduleGraphEmployee._container);
        } else if (this._locId === 'all') {
            delete this._allEntries[`${locId}_${userId}_${date}`];
            this._render(this._container);
        } else {
            delete this._entries[`${userId}_${date}`];
            this._render(this._container);
        }
        document.getElementById('sg-shift-modal')?.remove();
        Toast.success('Запис видалено');
    },

    // ── Helpers ───────────────────────────────────────────────────

    _avatarColor(userId) {
        const palette = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6',
                         '#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16'];
        let h = 0;
        for (let i = 0; i < (userId || '').length; i++) h = (h * 31 + userId.charCodeAt(i)) & 0xffffffff;
        return palette[Math.abs(h) % palette.length];
    },

    _nameCell(profile, userId) {
        const p        = profile || {};
        const initials = (p.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        const color    = this._avatarColor(userId);
        const sub      = [p.role ? Fmt.role(p.role) : '', p.label || ''].filter(Boolean).join(' · ');
        return `
<td class="sg-td-name" title="${p.full_name || ''}">
    <div class="sg-emp-chip">
        <div class="sg-av" style="flex-shrink:0;background:${color}">
            ${p.avatar_url ? `<img src="${p.avatar_url}">` : initials}
        </div>
        <div class="sg-name-info">
            <div class="sg-name-full">${p.full_name || 'Без імені'}</div>
            ${sub ? `<div class="sg-name-sub">${sub}</div>` : ''}
        </div>
    </div>
</td>`;
    },

    _dateStr(day) {
        const p = n => String(n).padStart(2, '0');
        return `${this._year}-${p(this._month + 1)}-${p(day)}`;
    },

    _trashSection() {
        if (!this._deletedLocations.length) return `
<div class="sg-section">
    <div class="empty-state" style="margin:3rem 0">
        <div class="empty-icon">🗑</div>
        <h3>Кошик порожній</h3>
        <p>Видалені локації зберігаються тут 2 дні — після цього видаляються автоматично</p>
    </div>
</div>`;

        const now = Date.now();
        return `
<div class="sg-section">
    <div class="sg-trash-head">
        <span class="sg-trash-head-text">⏱ Видалені локації зберігаються <strong>2 дні</strong>, після чого видаляються автоматично</span>
    </div>
    <div class="sg-trash-list">
        ${this._deletedLocations.map(loc => {
            const expiresAt = new Date(new Date(loc.deleted_at).getTime() + 2 * 24 * 3600 * 1000);
            const msLeft    = expiresAt - now;
            const hLeft     = Math.max(0, Math.floor(msLeft / 3600000));
            const mLeft     = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
            const timeLabel = hLeft > 0 ? `${hLeft} год ${mLeft} хв` : `${mLeft} хв`;
            const urgent    = hLeft < 6;
            return `
        <div class="sg-trash-row">
            <div class="sg-trash-row-ico">🏪</div>
            <div class="sg-trash-row-info">
                <div class="sg-trash-row-name">${loc.name}</div>
                <div class="sg-trash-row-expire${urgent ? ' urgent' : ''}">
                    ${urgent ? '⚠️' : '⏱'} Видалиться через ${timeLabel}
                </div>
            </div>
            <div class="sg-trash-row-actions">
                <button class="sg-trash-restore" onclick="ScheduleGraphPage._restoreLocation('${loc.id}')">
                    ↩ Відновити
                </button>
                <button class="sg-trash-permdel" onclick="ScheduleGraphPage._hardDeleteLocation('${loc.id}')">
                    🗑
                </button>
            </div>
        </div>`;
        }).join('')}
    </div>
</div>`;
    },

    // ── Styles ────────────────────────────────────────────────────

    _styles() {
        return `<style>
.sg-page { max-width:100%;animation:fadeSlideUp .3s cubic-bezier(.16,1,.3,1); }

/* Hero */
.sg-hero {
    border-radius:24px;padding:32px 28px;margin-bottom:20px;
    background:linear-gradient(135deg,#1a2744 0%,#1e3a5f 50%,#1a4971 100%);
    position:relative;overflow:hidden;
}
.sg-hero::before {
    content:'';position:absolute;inset:0;
    background:radial-gradient(ellipse 60% 80% at 85% 50%,rgba(56,189,248,.2),transparent);
}
.sg-hero-inner { position:relative;display:flex;align-items:center;gap:20px; }
.sg-hero-ico {
    width:60px;height:60px;border-radius:18px;flex-shrink:0;font-size:1.8rem;
    background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.25);
    display:flex;align-items:center;justify-content:center;
}
.sg-hero-title { margin:0;font-size:1.6rem;font-weight:800;color:#fff;letter-spacing:-.02em; }
.sg-hero-sub   { margin:4px 0 0;color:rgba(255,255,255,.65);font-size:.875rem; }

/* Manager help request button in hero */
.sg-mgr-help-btn {
    padding:9px 18px;border-radius:12px;
    border:2px solid rgba(239,68,68,.5);
    background:rgba(239,68,68,.18);color:#fff;
    font-size:.85rem;font-weight:700;cursor:pointer;
    white-space:nowrap;transition:all .18s;flex-shrink:0;
    backdrop-filter:blur(4px);
}
.sg-mgr-help-btn:hover { background:rgba(239,68,68,.35);border-color:rgba(239,68,68,.9); }

/* Manager help request modal */
.sg-mgr-help-box { max-width:420px; }
.sg-mgr-help-existing {
    margin-top:20px;padding-top:16px;border-top:1px solid var(--border);
}
.sg-mgr-help-existing-title {
    font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
    color:var(--text-muted);margin-bottom:10px;
}
.sg-mgr-help-existing-row {
    display:flex;align-items:center;justify-content:space-between;gap:10px;
    padding:8px 12px;border-radius:10px;
    border:1.5px solid rgba(239,68,68,.2);background:rgba(239,68,68,.05);
    margin-bottom:6px;font-size:.875rem;color:var(--text-primary);
}
.sg-mgr-help-cancel-btn {
    border:none;background:none;color:var(--text-muted);cursor:pointer;
    font-size:.9rem;padding:2px 8px;border-radius:6px;transition:all .15s;flex-shrink:0;
}
.sg-mgr-help-cancel-btn:hover { background:rgba(239,68,68,.15);color:#ef4444; }

/* My schedule switch button */
.sg-my-sched-btn {
    padding:9px 18px;border-radius:12px;border:2px solid rgba(255,255,255,.35);
    background:rgba(255,255,255,.15);color:#fff;font-size:.85rem;font-weight:600;
    cursor:pointer;white-space:nowrap;transition:all .18s;flex-shrink:0;
    backdrop-filter:blur(4px);
}
.sg-my-sched-btn:hover { background:rgba(255,255,255,.28);border-color:rgba(255,255,255,.6); }

/* Body: sidebar + content */
.sg-body { display:flex;gap:16px;align-items:flex-start; }
.sg-content { flex:1;min-width:0; }

/* Location sidebar */
.sg-loc-sidebar {
    width:210px;flex-shrink:0;
    background:var(--bg-raised);border:1.5px solid var(--border);
    border-radius:16px;overflow:hidden;
    position:sticky;top:16px;
}
.sg-loc-sidebar-head {
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 14px;border-bottom:1px solid var(--border);
}
.sg-loc-sidebar-title {
    font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
    color:var(--text-muted);
}
.sg-loc-add-ico {
    width:24px;height:24px;border-radius:7px;border:1.5px solid var(--border);
    background:transparent;color:var(--primary);font-size:1rem;font-weight:700;
    cursor:pointer;display:flex;align-items:center;justify-content:center;
    transition:all .15s;line-height:1;
}
.sg-loc-add-ico:hover { background:var(--primary);color:#fff;border-color:var(--primary); }
.sg-loc-sidebar-list {
    padding:6px;display:flex;flex-direction:column;gap:2px;
    max-height:calc(100vh - 240px);overflow-y:auto;
}
.sg-loc-item-row { display:flex;align-items:center;gap:2px; }
.sg-loc-item {
    flex:1;min-width:0;
    display:flex;align-items:center;gap:7px;
    padding:8px 10px;border-radius:10px;border:none;
    background:transparent;color:var(--text-secondary);
    font-size:.82rem;font-weight:500;cursor:pointer;text-align:left;
    transition:all .15s;
}
.sg-loc-item:hover { background:var(--bg-hover,rgba(0,0,0,.05));color:var(--text-primary); }
.sg-loc-item.active {
    background:var(--primary);color:#fff;font-weight:600;
}
.sg-loc-item.has-help {
    color:#ef4444;
    animation:locHelpPulse 2.2s ease-in-out infinite;
}
.sg-loc-item.active.has-help { background:#ef4444;color:#fff; }
.sg-loc-item-ico { font-size:.9rem;flex-shrink:0; }
.sg-loc-item-name { flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.sg-loc-item-meta { display:flex;align-items:center;gap:4px;flex-shrink:0; }
.sg-loc-item-wh {
    font-size:.65rem;padding:1px 5px;border-radius:6px;
    background:rgba(0,0,0,.1);color:inherit;white-space:nowrap;
}
.sg-loc-item.active .sg-loc-item-wh { background:rgba(255,255,255,.25);color:#fff; }
.sg-loc-item-helpdot {
    width:6px;height:6px;border-radius:50%;background:#ef4444;flex-shrink:0;
    animation:dotBlink 1.4s ease-in-out infinite;
}
.sg-loc-item.active .sg-loc-item-helpdot { background:#fff; }
.sg-loc-item-rename, .sg-loc-item-del {
    flex-shrink:0;width:24px;height:24px;border-radius:7px;border:none;
    background:transparent;cursor:pointer;font-size:.78rem;
    display:flex;align-items:center;justify-content:center;
    color:var(--text-muted);transition:all .15s;
}
.sg-loc-item-rename:hover { background:var(--bg-hover,rgba(0,0,0,.07));color:var(--primary); }
.sg-loc-item-del:hover { background:rgba(239,68,68,.1);color:#ef4444; }
.sg-loc-item-arrows {
    display:flex;flex-direction:column;gap:1px;flex-shrink:0;
    opacity:0;transition:opacity .15s;
}
.sg-loc-item-row:hover .sg-loc-item-arrows { opacity:1; }
.sg-loc-arrow {
    width:18px;height:14px;border-radius:4px;border:none;
    background:transparent;cursor:pointer;font-size:.5rem;line-height:1;
    color:var(--text-muted);display:flex;align-items:center;justify-content:center;
    transition:all .12s;padding:0;
}
.sg-loc-arrow:hover:not(:disabled) { background:var(--bg-hover,rgba(0,0,0,.08));color:var(--primary); }
.sg-loc-arrow.disabled, .sg-loc-arrow:disabled { opacity:.25;cursor:default; }

@keyframes locHelpPulse {
    0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,.25); }
    50%      { box-shadow:0 0 0 5px rgba(239,68,68,.0); }
}
@keyframes dotBlink {
    0%,100% { opacity:1; }
    50%      { opacity:.3; }
}
.sg-icon-btn {
    width:38px;height:38px;border-radius:10px;border:2px solid var(--border);
    background:var(--bg-raised);cursor:pointer;font-size:1rem;
    display:flex;align-items:center;justify-content:center;transition:all .18s;
}
.sg-icon-btn.danger:hover { border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,.08); }

/* Controls */
.sg-controls {
    display:flex;align-items:center;justify-content:space-between;
    gap:16px;margin-bottom:20px;flex-wrap:wrap;
}
.sg-month-nav { display:flex;align-items:center;gap:12px; }
.sg-mnav {
    width:36px;height:36px;border-radius:10px;border:2px solid var(--border);
    background:var(--bg-raised);font-size:1.2rem;cursor:pointer;
    display:flex;align-items:center;justify-content:center;transition:all .18s;
}
.sg-mnav:hover { border-color:var(--primary);color:var(--primary); }
.sg-mlabel { font-size:1.1rem;font-weight:700;color:var(--text-primary);min-width:160px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px; }
.sg-past-badge { font-size:.65rem;font-weight:700;color:#ef4444;letter-spacing:.03em;opacity:.8; }
.sg-tabs { display:flex;gap:4px;background:var(--bg-raised);border-radius:12px;padding:4px; }
.sg-tab {
    padding:7px 18px;border-radius:9px;border:none;background:transparent;
    color:var(--text-muted);font-size:.875rem;font-weight:600;cursor:pointer;transition:all .18s;
}
.sg-tab.active { background:var(--primary);color:#fff; }

/* Section wrapper */
.sg-section {
    background:var(--bg-surface);border:1px solid var(--border);border-radius:18px;overflow:visible;
}
.sg-scroll-wrap {
    border-radius:0 0 18px 18px;
}

/* Substitution tab */
.sg-subst-hint {
    display:flex;align-items:center;justify-content:space-between;gap:12px;
    padding:10px 20px;border-bottom:1px solid var(--border);
    background:rgba(99,102,241,.06);font-size:.82rem;
}
.sg-subst-hint-text { color:var(--text-muted); }
.sg-subst-clear {
    padding:4px 12px;border-radius:8px;border:1px solid var(--border);
    background:var(--bg-raised);color:var(--text-muted);font-size:.78rem;cursor:pointer;
    white-space:nowrap;transition:all .15s;
}
.sg-subst-clear:hover { border-color:#ef4444;color:#ef4444; }
.sg-subst-panel {
    padding:10px 16px;border-bottom:1px solid var(--border);
    background:var(--bg-raised);max-width:760px;
}
.sg-subst-date-label {
    font-size:.85rem;font-weight:700;color:var(--text-primary);
    margin-bottom:10px;text-transform:capitalize;
}
.sg-subst-cols { display:grid;grid-template-columns:1fr 1fr;gap:10px; }
.sg-subst-free, .sg-subst-busy { min-width:0; }
.sg-subst-scroll {
    max-height:calc(3 * 44px);overflow-y:auto;
    scrollbar-width:thin;scrollbar-color:var(--border) transparent;
}
.sg-subst-col-title {
    font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
    margin-bottom:5px;
}
.sg-subst-col-title.free { color:#10b981; }
.sg-subst-col-title.busy { color:#ef4444; }
.sg-subst-person {
    display:flex;align-items:center;gap:7px;padding:5px 8px;
    border-radius:8px;margin-bottom:3px;background:var(--bg-surface);
    border:1px solid var(--border);transition:background .12s;font-size:.8rem;
}
.sg-subst-person:hover { background:var(--bg-hover); }
.sg-subst-person.busy { opacity:.65; }
.sg-subst-free-card {
    cursor:pointer;transition:all .15s;
}
.sg-subst-free-card:hover {
    border-color:#10b981;background:rgba(16,185,129,.06);
}
.sg-subst-add-btn {
    width:24px;height:24px;border-radius:50%;
    background:rgba(16,185,129,.15);color:#10b981;
    font-size:1rem;font-weight:700;line-height:1;
    display:flex;align-items:center;justify-content:center;
    flex-shrink:0;transition:all .15s;
}
.sg-subst-free-card:hover .sg-subst-add-btn {
    background:#10b981;color:#fff;
}
.sg-subst-loc-btn {
    display:flex;align-items:center;gap:10px;padding:12px 16px;
    border-radius:12px;border:2px solid var(--border);background:var(--bg-raised);
    cursor:pointer;width:100%;text-align:left;transition:all .15s;color:var(--text-primary);
}
.sg-subst-loc-btn:hover { border-color:var(--primary);background:var(--bg-hover); }
.sg-subst-loc-name { font-size:.9rem;font-weight:600;flex:1; }
.sg-subst-loc-wh { font-size:.78rem;color:var(--text-muted); }
.sg-subst-loc-arrow { color:var(--text-muted);font-size:1rem; }
.sg-subst-name { font-size:.8rem;font-weight:600;color:var(--text-primary); }
.sg-subst-loc  { font-size:.7rem;color:var(--text-muted);margin-top:1px; }
.sg-subst-empty { font-size:.82rem;color:var(--text-muted);font-style:italic;padding:8px 0; }
.sg-loc-group-header {
    padding:8px 16px;font-size:.75rem;font-weight:700;
    text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);
    background:var(--bg-raised);border-bottom:1px solid var(--border);
}
.sg-sd-col { background:rgba(99,102,241,.1) !important; }
.sg-th-day.sg-sd-col { background:rgba(99,102,241,.15) !important;color:var(--primary); }
.sg-free-cell { background:rgba(16,185,129,.08) !important; }
.sg-busy-cell { background:rgba(239,68,68,.06) !important; }
.sg-free-dot  { font-size:.6rem;color:#10b981;opacity:.6; }
.sg-row-free td.sg-td-name { border-left:3px solid #10b981; }
.sg-row-busy td.sg-td-name { border-left:3px solid #ef4444; }
@media(max-width:700px){ .sg-subst-cols { grid-template-columns:1fr; } }

/* Work hours bar */
.sg-loc-name-ico { font-size:1rem; }
.sg-loc-name-text { font-size:.95rem;font-weight:700;color:var(--text-primary); }
.sg-wh-sep { color:var(--border);font-size:1rem;margin:0 2px; }
.sg-loc-name-edit {
    border:none;background:none;cursor:pointer;font-size:.9rem;
    opacity:.4;transition:opacity .15s;padding:2px 4px;border-radius:6px;
}
.sg-loc-name-edit:hover { opacity:1;background:var(--bg-hover); }
.sg-work-hours-bar {
    display:flex;align-items:center;gap:10px;flex-wrap:wrap;
    padding:10px 20px;border-bottom:1px solid var(--border);
    background:var(--bg-raised);font-size:.875rem;
}
.sg-wh-label { color:var(--text-muted);font-weight:600; }
.sg-wh-time { color:var(--text-primary);font-weight:700;letter-spacing:.03em; }
.sg-wh-edit {
    border:none;background:none;cursor:pointer;font-size:.9rem;
    opacity:.5;transition:opacity .15s;padding:2px 4px;border-radius:6px;
}
.sg-wh-edit:hover { opacity:1;background:var(--bg-hover); }
.sg-wh-inputs { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
.sg-wh-save {
    padding:6px 14px;border-radius:8px;border:none;
    background:linear-gradient(135deg,#10b981,#059669);
    color:#fff;font-size:.82rem;font-weight:700;cursor:pointer;
}
.sg-wh-cancel {
    width:28px;height:28px;border-radius:8px;border:1px solid var(--border);
    background:var(--bg-raised);color:var(--text-muted);cursor:pointer;font-size:.85rem;
}
.sg-loc-del-btn {
    border:none;background:none;cursor:pointer;font-size:.9rem;
    opacity:.4;transition:opacity .15s;padding:2px 6px;border-radius:6px;
}
.sg-loc-del-btn:hover { opacity:1;background:#fee2e2; }

/* Viewers button */
.sg-viewers-btn {
    padding:8px 14px;border-radius:10px;font-size:.82rem;font-weight:700;cursor:pointer;
    border:2px solid rgba(99,102,241,.3);background:rgba(99,102,241,.07);color:#6366f1;
    transition:all .15s;
}
.sg-viewers-btn:hover { background:#6366f1;color:#fff;border-color:#6366f1; }

/* Viewers modal */
.sg-viewers-modal-box { max-width:520px; }
.sg-viewers-add { padding:12px 0 8px;display:flex;flex-direction:column;gap:8px; }
.sg-viewers-add-row { display:flex;gap:8px;align-items:center; }
.sg-viewers-select {
    flex:1;padding:9px 12px;border-radius:10px;
    border:2px solid var(--border);background:var(--bg-raised);
    color:var(--text-primary);font-size:.875rem;outline:none;
}
.sg-viewers-select:focus { border-color:var(--primary); }

/* User search autocomplete */
.sg-viewer-search-wrap { width:100%; }
.sg-viewer-search-input {
    width:100%;padding:9px 12px;border-radius:10px;box-sizing:border-box;
    border:2px solid var(--border);background:var(--bg-raised);
    color:var(--text-primary);font-size:.875rem;outline:none;transition:border-color .15s;
}
.sg-viewer-search-input:focus { border-color:var(--primary); }
.sg-viewer-dropdown {
    display:none;position:fixed;
    background:var(--bg-surface);border:1.5px solid var(--border);
    border-radius:10px;max-height:220px;overflow-y:auto;
    z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.25);
}
.sg-viewer-dropdown.open { display:block; }
.sg-viewer-drop-item {
    padding:9px 14px;cursor:pointer;font-size:.875rem;
    color:var(--text-primary);transition:background .1s;
}
.sg-viewer-drop-item:hover { background:var(--bg-hover); }
.sg-viewer-drop-item.hidden { display:none; }
.sg-viewers-add-btn {
    padding:9px 16px;border-radius:10px;border:none;
    background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;
    font-size:.875rem;font-weight:700;cursor:pointer;white-space:nowrap;
    transition:opacity .15s;
}
.sg-viewers-add-btn:hover { opacity:.88; }
.sg-viewers-list { border-top:1px solid var(--border);margin-top:4px;padding-top:8px;max-height:320px;overflow-y:auto; }
.sg-viewers-empty { padding:20px 0;text-align:center;color:var(--text-muted);font-size:.875rem; }
.sg-viewers-row {
    display:flex;align-items:center;gap:10px;padding:8px 4px;
    border-radius:10px;transition:background .12s;
}
.sg-viewers-row:hover { background:var(--bg-raised); }
.sg-viewers-info { flex:1;min-width:0; }
.sg-viewers-name { font-size:.875rem;font-weight:600;color:var(--text-primary); }
.sg-viewers-scope { font-size:.75rem;color:var(--text-muted);margin-top:1px; }
.sg-viewers-del {
    width:28px;height:28px;border-radius:8px;border:1px solid var(--border);
    background:none;color:var(--text-muted);cursor:pointer;font-size:.8rem;
    transition:all .15s;flex-shrink:0;
}
.sg-viewers-del:hover { background:#fee2e2;color:#ef4444;border-color:#fca5a5; }


.sg-lock-btn {
    margin-left:auto;border:none;background:none;cursor:pointer;font-size:1rem;
    opacity:.45;transition:all .15s;padding:3px 6px;border-radius:8px;
}
.sg-lock-btn:hover { opacity:1;background:var(--bg-hover); }
.sg-lock-btn.locked {
    opacity:1;background:rgba(239,68,68,.1);
    border:1px solid rgba(239,68,68,.25);
}
.sg-locked-bar { background:rgba(239,68,68,.06); }
.sg-locked-banner {
    padding:10px 18px;border-radius:12px;margin-bottom:12px;
    background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);
    color:#ef4444;font-size:.85rem;
}

/* Delete confirm modal */
.sg-del-modal { text-align:center;max-width:400px; }
.sg-del-modal-ico-wrap {
    width:72px;height:72px;border-radius:20px;
    background:rgba(239,68,68,.1);border:2px solid rgba(239,68,68,.2);
    display:flex;align-items:center;justify-content:center;
    font-size:2rem;margin:0 auto 18px;
}
.sg-del-modal-title {
    margin:0 0 10px;font-size:1.2rem;font-weight:800;color:var(--text-primary);
}
.sg-del-modal-desc {
    margin:0 0 16px;font-size:.9rem;color:var(--text-secondary);line-height:1.55;
}
.sg-del-modal-note {
    display:flex;align-items:flex-start;gap:8px;padding:12px 14px;
    border-radius:12px;background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.18);
    font-size:.8rem;color:var(--text-muted);text-align:left;margin-bottom:4px;line-height:1.5;
}
.sg-del-note-ico { flex-shrink:0;font-size:.95rem; }
.sg-del-confirm-btn {
    flex:1;height:46px;border-radius:12px;border:2px solid rgba(239,68,68,.4);
    background:rgba(239,68,68,.08);color:#ef4444;
    font-size:.95rem;font-weight:700;cursor:pointer;
    transition:background .15s,border-color .15s,transform .15s;
}
.sg-del-confirm-btn:hover {
    background:#ef4444;color:#fff;border-color:#ef4444;transform:translateY(-1px);
}

/* Trash tab badge */
.sg-trash-tab { position:relative;margin-left:auto; }
.sg-trash-badge {
    display:inline-flex;align-items:center;justify-content:center;
    min-width:18px;height:18px;border-radius:9px;
    background:#ef4444;color:#fff;font-size:.68rem;font-weight:800;
    padding:0 5px;margin-left:5px;vertical-align:middle;
}
.sg-trash-tab.active { background:#ef4444;color:#fff; }

/* Trash section */
.sg-trash-head {
    padding:12px 20px;border-bottom:1px solid var(--border);
    background:rgba(239,68,68,.04);font-size:.82rem;
}
.sg-trash-head-text { color:var(--text-muted); }
.sg-trash-list { display:flex;flex-direction:column; }
.sg-trash-row {
    display:flex;align-items:center;gap:14px;
    padding:16px 20px;border-bottom:1px solid var(--border);
    transition:background .12s;
}
.sg-trash-row:last-child { border-bottom:none; }
.sg-trash-row:hover { background:var(--bg-raised); }
.sg-trash-row-ico { font-size:1.4rem;flex-shrink:0;opacity:.5; }
.sg-trash-row-info { flex:1;min-width:0; }
.sg-trash-row-name { font-weight:700;color:var(--text-primary);font-size:.95rem;margin-bottom:3px; }
.sg-trash-row-expire {
    font-size:.78rem;color:var(--text-muted);display:flex;align-items:center;gap:4px;
}
.sg-trash-row-expire.urgent { color:#ef4444;font-weight:600; }
.sg-trash-row-actions { display:flex;align-items:center;gap:8px;flex-shrink:0; }
.sg-trash-restore {
    padding:8px 16px;border-radius:10px;border:2px solid rgba(16,185,129,.35);
    background:rgba(16,185,129,.07);color:#10b981;
    font-size:.85rem;font-weight:700;cursor:pointer;
    transition:background .15s,border-color .15s,transform .15s;white-space:nowrap;
}
.sg-trash-restore:hover {
    background:#10b981;color:#fff;border-color:#10b981;transform:translateY(-1px);
}
.sg-trash-permdel {
    width:36px;height:36px;border-radius:10px;border:2px solid rgba(239,68,68,.25);
    background:rgba(239,68,68,.06);color:#ef4444;
    font-size:.9rem;cursor:pointer;transition:all .15s;
}
.sg-trash-permdel:hover { background:#ef4444;color:#fff;border-color:#ef4444; }

/* Toolbar */
.sg-toolbar {
    display:flex;align-items:center;justify-content:space-between;gap:12px;
    padding:14px 20px;border-bottom:1px solid var(--border);flex-wrap:wrap;
}
.sg-legend { display:flex;gap:8px;flex-wrap:wrap; }
.sg-leg-btn {
    display:inline-flex;align-items:center;gap:6px;
    padding:5px 12px;border-radius:20px;font-size:.78rem;font-weight:600;white-space:nowrap;
    border:2px solid transparent;background:var(--bg-raised);color:var(--text-secondary);
    cursor:pointer;transition:all .18s;
}
.sg-leg-btn:hover { border-color:var(--lc);color:var(--lc);background:var(--lb); }
.sg-leg-btn.active {
    border-color:var(--lc);color:var(--lc);background:var(--lb);
    box-shadow:0 0 0 3px color-mix(in srgb, var(--lc) 20%, transparent);
    font-weight:800;
}
.sg-leg-short {
    width:22px;height:22px;border-radius:6px;font-size:.72rem;font-weight:800;
    display:inline-flex;align-items:center;justify-content:center;
}
.sg-leg-active-mark {
    font-size:.68rem;font-weight:700;opacity:.8;
    background:var(--lc);color:#fff;padding:1px 6px;border-radius:10px;margin-left:2px;
}
.sg-quick-bar {
    display:flex;align-items:center;gap:10px;flex-wrap:wrap;
    padding:10px 20px;border-bottom:1px solid var(--border);
    background:rgba(245,158,11,.06);font-size:.82rem;color:var(--text-muted);
    animation:fadeIn .2s;
}
.sg-quick-badge {
    padding:3px 10px;border-radius:12px;font-size:.8rem;font-weight:700;
}
.sg-quick-cancel {
    margin-left:auto;padding:4px 12px;border-radius:8px;border:1px solid var(--border);
    background:var(--bg-raised);color:var(--text-muted);font-size:.78rem;cursor:pointer;
    transition:all .15s;
}
.sg-quick-cancel:hover { border-color:#ef4444;color:#ef4444; }

/* Table */
.sg-scroll-wrap {
    overflow-x:auto;
    scrollbar-width:thin;
    scrollbar-color:var(--primary) var(--border);
}
.sg-scroll-wrap::-webkit-scrollbar { height:6px; }
.sg-scroll-wrap::-webkit-scrollbar-track { background:var(--border);border-radius:10px; }
.sg-scroll-wrap::-webkit-scrollbar-thumb { background:var(--primary);border-radius:10px;opacity:.7; }
.sg-scroll-wrap::-webkit-scrollbar-thumb:hover { opacity:1; }
.sg-table { width:100%;border-collapse:collapse;table-layout:fixed; }
.sg-th-name {
    text-align:left;padding:10px 16px;font-size:.75rem;font-weight:700;
    text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);
    border-bottom:1px solid var(--border);background:var(--bg-raised);
    position:sticky;left:0;z-index:2;width:300px;min-width:300px;max-width:300px;white-space:nowrap;
}
.sg-th-day {
    padding:6px 2px;text-align:center;
    border-bottom:1px solid var(--border);border-left:1px solid var(--border-light,rgba(255,255,255,.05));
    background:var(--bg-raised);overflow:hidden;
}
.sg-th-day.we { background:rgba(139,92,246,.06); }
.sg-day-num { font-size:.8rem;font-weight:700;color:var(--text-primary); }
.sg-day-dow { font-size:.65rem;color:var(--text-muted);margin-top:1px; }
.sg-th-sum {
    padding:8px 6px;border-bottom:1px solid var(--border);background:var(--bg-raised);
    text-align:center;width:58px;
    border-left:2px solid var(--border);
}
.sg-th-del {
    padding:8px 12px;border-bottom:1px solid var(--border);background:var(--bg-raised);
    text-align:center;white-space:nowrap;width:100px;
}
.sg-th-sum-inner {
    font-size:1rem;font-weight:800;color:var(--primary);line-height:1;
}
.sg-th-sub {
    font-size:.6rem;font-weight:600;text-transform:uppercase;
    letter-spacing:.05em;color:var(--text-muted);margin-top:2px;
}
.sg-td-name {
    padding:8px 12px;border-bottom:1px solid var(--border);
    background:var(--bg-raised);position:sticky;left:0;z-index:1;
    width:300px;min-width:300px;max-width:300px;
}
.sg-emp-chip { display:flex;align-items:center;gap:8px;min-width:0; }
.sg-name-info { min-width:0;flex:1;overflow:hidden; }
.sg-name-full {
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    font-size:.82rem;font-weight:500;color:var(--text-primary);
}
.sg-name-sub {
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    font-size:.68rem;color:var(--text-muted);margin-top:1px;
}
.sg-av {
    width:34px;height:34px;border-radius:50%;background:var(--primary);
    color:#fff;font-size:.75rem;font-weight:700;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;overflow:hidden;
}
.sg-av.sm { width:24px;height:24px;font-size:.65rem; }
.sg-av img { width:100%;height:100%;object-fit:cover; }
.sg-cell {
    padding:3px 1px;text-align:center;border-bottom:1px solid var(--border);
    border-left:1px solid var(--border-light,rgba(255,255,255,.05));
    cursor:pointer;transition:background .12s;height:48px;vertical-align:middle;
    overflow:hidden;
}
.sg-cell.we { background:rgba(139,92,246,.04); }
.sg-cell:hover { background:var(--bg-hover); }
.sg-badge {
    display:inline-flex;align-items:center;justify-content:center;
    padding:2px 3px;border-radius:5px;font-size:.7rem;font-weight:700;
    width:100%;max-width:36px;line-height:1.2;box-sizing:border-box;
}
.sg-badge small { font-size:.6rem;font-weight:500;opacity:.85; }
.sg-td-sum {
    text-align:center;padding:10px 8px;border-bottom:1px solid var(--border);
    font-weight:800;color:var(--primary);font-size:.95rem;
    border-left:2px solid var(--border);
}
.sg-td-del { text-align:center;padding:6px 8px;border-bottom:1px solid var(--border); }
.sg-rm {
    display:inline-flex;align-items:center;gap:5px;
    padding:5px 10px;border-radius:8px;border:1.5px solid rgba(239,68,68,.25);
    background:rgba(239,68,68,.06);color:#ef4444;
    cursor:pointer;font-size:.75rem;font-weight:600;
    transition:all .15s;white-space:nowrap;
}
.sg-rm span { font-size:.72rem; }
.sg-rm:hover { background:rgba(239,68,68,.15);border-color:#ef4444; }
tr:hover .sg-td-name,.sg-table tr:hover .sg-cell { background:var(--bg-hover); }
tr:hover .sg-td-name { background:var(--bg-raised); }
tr:last-child td { border-bottom:none; }

/* Log */
.sg-log-list { padding:8px 0; }
.sg-log-row {
    display:flex;align-items:flex-start;gap:12px;padding:12px 20px;
    border-bottom:1px solid var(--border);transition:background .12s;
}
.sg-log-row:last-child { border-bottom:none; }
.sg-log-row:hover { background:var(--bg-hover); }
.sg-log-body { flex:1;display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:.875rem; }
.sg-log-emp { color:var(--text-muted); }
.sg-log-datecel {
    padding:2px 8px;border-radius:6px;background:var(--bg-raised);
    font-size:.78rem;color:var(--text-muted);
}
.sg-log-diff { display:flex;align-items:center;gap:6px;width:100%; }
.sg-log-arrow { color:var(--text-muted); }
.sg-log-new { color:#10b981;font-size:.8rem;font-style:italic; }
.sg-log-del { color:#ef4444;font-size:.8rem;font-style:italic; }
.sg-log-empty { color:var(--text-muted);font-style:italic; }
.sg-log-time { color:var(--text-muted);font-size:.78rem;white-space:nowrap;margin-top:2px; }

/* Modal overlay */
.sg-overlay {
    position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;
    display:flex;align-items:center;justify-content:center;padding:16px;
    backdrop-filter:blur(4px);animation:fadeIn .15s;
}
.sg-modal {
    background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;
    padding:24px;width:100%;max-width:440px;max-height:80vh;overflow-y:auto;
    box-shadow:0 24px 64px rgba(0,0,0,.4);animation:scaleIn .2s cubic-bezier(.16,1,.3,1);
}
@keyframes scaleIn { from{transform:scale(.95);opacity:0} to{transform:scale(1);opacity:1} }
.sg-mhdr {
    display:flex;align-items:flex-start;justify-content:space-between;
    gap:12px;margin-bottom:20px;
}
.sg-mhdr h3 { margin:0;font-size:1.1rem;font-weight:700;color:var(--text-primary); }
.sg-mclose {
    width:32px;height:32px;border-radius:8px;border:1px solid var(--border);
    background:var(--bg-raised);color:var(--text-muted);cursor:pointer;font-size:.9rem;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;
}
.sg-mclose:hover { border-color:var(--text-muted);color:var(--text-primary); }
.sg-msearch {
    width:100%;padding:10px 14px;border-radius:12px;border:2px solid var(--border);
    background:var(--bg-raised);color:var(--text-primary);font-size:.9rem;
    outline:none;margin-bottom:12px;box-sizing:border-box;
}
.sg-msearch:focus { border-color:var(--primary); }
.sg-emp-list { display:flex;flex-direction:column;gap:4px;max-height:300px;overflow-y:auto; }
.sg-emp-row {
    display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;
    cursor:pointer;transition:background .12s;
}
.sg-emp-row:hover { background:var(--bg-hover); }
.sg-emp-fn { font-weight:600;color:var(--text-primary);font-size:.9rem; }
.sg-emp-meta { font-size:.78rem;color:var(--text-muted);margin-top:1px; }

/* Shift modal */
.sg-shift-grid {
    display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;
}
.sg-stype {
    display:flex;align-items:center;gap:10px;padding:12px 14px;
    border-radius:12px;border:2px solid var(--border);background:var(--bg-raised);
    color:var(--text-secondary);cursor:pointer;font-size:.875rem;font-weight:600;
    transition:all .15s;text-align:left;
}
.sg-stype:hover { border-color:var(--sc,var(--primary));background:var(--sb,var(--bg-hover)); }
.sg-stype.active { border-color:var(--sc,var(--primary));background:var(--sb);color:var(--sc); }
.sg-sshort {
    width:28px;height:28px;border-radius:8px;font-size:.75rem;font-weight:800;
    display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.sg-time-row { margin-bottom:16px; }
.sg-time-label { font-size:.82rem;color:var(--text-muted);margin-bottom:8px; }
.sg-time-inputs { display:flex;align-items:center;gap:10px; }
.sg-tinput {
    flex:1;padding:9px 12px;border-radius:10px;border:2px solid var(--border);
    background:var(--bg-raised);color:var(--text-primary);font-size:.9rem;outline:none;
}
.sg-tinput:focus { border-color:var(--primary); }
.sg-notes-wrap { margin-bottom:16px; }
.sg-notes-label { font-size:.82rem;color:var(--text-muted);display:block;margin-bottom:6px; }
.sg-notes {
    width:100%;min-height:64px;padding:10px 12px;border-radius:10px;
    border:2px solid var(--border);background:var(--bg-raised);
    color:var(--text-primary);font-size:.875rem;outline:none;resize:vertical;box-sizing:border-box;
}
.sg-notes:focus { border-color:var(--primary); }
.sg-modal-actions { display:flex;gap:8px;margin-top:20px;align-items:center; }
.sg-btn-save {
    flex:1;height:46px;border-radius:12px;border:none;
    background:linear-gradient(135deg,#10b981,#059669);
    color:#fff;font-size:.95rem;font-weight:700;cursor:pointer;
    display:flex;align-items:center;justify-content:center;gap:6px;
    box-shadow:0 4px 14px rgba(16,185,129,.35);
    transition:transform .15s,box-shadow .15s;
}
.sg-btn-save:hover { transform:translateY(-1px);box-shadow:0 6px 20px rgba(16,185,129,.45); }
.sg-btn-save:active { transform:translateY(0);box-shadow:0 2px 8px rgba(16,185,129,.3); }
.sg-btn-cancel {
    flex:1;height:46px;border-radius:12px;
    border:2px solid var(--border);background:var(--bg-raised);
    color:var(--text-secondary);font-size:.9rem;font-weight:600;cursor:pointer;
    transition:border-color .15s,color .15s,background .15s;
}
.sg-btn-cancel:hover { border-color:var(--text-muted);color:var(--text-primary);background:var(--bg-hover); }
.sg-del-btn {
    width:42px;height:42px;border-radius:10px;border:2px solid rgba(239,68,68,.3);
    background:rgba(239,68,68,.08);color:#ef4444;cursor:pointer;font-size:1rem;
    display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;
}
.sg-del-btn:hover { background:rgba(239,68,68,.18);border-color:#ef4444; }
.sg-shift-modal-err {
    display:flex;align-items:flex-start;gap:8px;
    padding:10px 14px;border-radius:12px;margin-bottom:12px;
    background:rgba(239,68,68,.08);border:1.5px solid rgba(239,68,68,.3);
    color:#ef4444;font-size:.85rem;font-weight:500;line-height:1.4;
    animation:fadeIn .2s;
}

/* Can-substitute checkbox in shift modal */
.sg-cansub-row {
    margin-bottom:14px;padding:10px 14px;border-radius:12px;
    border:2px solid rgba(16,185,129,.25);background:rgba(16,185,129,.06);
    display:flex;flex-direction:column;gap:8px;
}
.sg-cansub-label {
    display:flex;align-items:center;gap:10px;cursor:pointer;
    font-size:.875rem;font-weight:600;color:var(--text-primary);
}
.sg-needsub-label { color:#f97316; }
.sg-cansub-check { width:18px;height:18px;accent-color:#10b981;cursor:pointer;flex-shrink:0; }
.sg-needsub-check { accent-color:#f97316; }
.sg-cansub-ico  { font-size:1.1rem; }
.sg-cansub-txt  { flex:1; }

/* Flag-only cell (manager table) */
.sg-flag-cell { font-size:1.1rem;line-height:1; }

/* Needs-sub cell highlight (manager table) */
.sg-needsub-cell { background:rgba(249,115,22,.07) !important; }

/* Manager help-request column highlight */
.sg-th-day.sg-help-col-th {
    background:rgba(239,68,68,.13) !important;
    color:#ef4444;
}
.sg-help-col-ico {
    font-size:.65rem;margin-top:2px;line-height:1;
    animation:dotBlink 1.4s ease-in-out infinite;
}

/* "Wants sub" highlight in free panel */
.sg-subst-wants-sub {
    border-color:#10b981 !important;
    background:rgba(16,185,129,.08) !important;
    box-shadow:0 0 0 2px rgba(16,185,129,.2);
}
.sg-sub-wants-badge {
    font-size:.7rem;font-weight:700;color:#10b981;margin-top:2px;
}

/* "Needs sub" highlight in busy panel */
.sg-subst-needs-sub {
    border-color:#f97316 !important;
    background:rgba(249,115,22,.08) !important;
    box-shadow:0 0 0 2px rgba(249,115,22,.2);
    opacity:1 !important;
}
.sg-needsub-badge {
    font-size:.7rem;font-weight:700;color:#f97316;margin-top:2px;
}

/* Location modal */
.sg-loc-modal-box { max-width:400px; }
.sg-loc-modal-icon {
    width:42px;height:42px;border-radius:12px;flex-shrink:0;font-size:1.3rem;
    background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 20%,transparent),color-mix(in srgb,var(--primary) 10%,transparent));
    border:1.5px solid color-mix(in srgb,var(--primary) 30%,transparent);
    display:flex;align-items:center;justify-content:center;margin-right:12px;
}
.sg-loc-modal-title { margin:0;font-size:1.05rem;font-weight:700;color:var(--text-primary); }
.sg-loc-modal-body  { margin-bottom:4px; }
.sg-loc-input {
    width:100%;padding:12px 16px;border-radius:12px;
    border:2px solid var(--border);background:var(--bg-raised);
    color:var(--text-primary);font-size:.95rem;font-weight:500;
    outline:none;box-sizing:border-box;transition:border-color .15s;
    margin-bottom:8px;appearance:none;
}
.sg-loc-input:focus { border-color:var(--primary); }
.sg-loc-input.sg-input-error { border-color:#ef4444;animation:shake .25s; }
@keyframes shake {
    0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)}
}
.sg-loc-hint { margin:0;font-size:.75rem;color:var(--text-muted);line-height:1.4; }

/* Substitution resolve modal */
.sg-resolve-modal { max-width:420px; }
.sg-resolve-flag-banner {
    display:flex;align-items:flex-start;gap:12px;
    padding:14px 16px;border-radius:14px;margin-bottom:16px;
}
.sg-resolve-flag-banner.sub  { background:rgba(16,185,129,.1);border:1.5px solid rgba(16,185,129,.25); }
.sg-resolve-flag-banner.need { background:rgba(249,115,22,.1);border:1.5px solid rgba(249,115,22,.25); }
.sg-resolve-flag-ico { font-size:1.6rem;flex-shrink:0;line-height:1;margin-top:2px; }
.sg-resolve-flag-title {
    font-size:.9rem;font-weight:700;color:var(--text-primary);margin-bottom:3px;
}
.sg-resolve-flag-desc { font-size:.8rem;color:var(--text-muted);line-height:1.4; }
.sg-resolve-hint {
    font-size:.82rem;color:var(--text-muted);margin:0 0 16px;line-height:1.5;
}
.sg-resolve-confirm-btn { background:linear-gradient(135deg,#10b981,#059669) !important; }

/* Manager reminder modal */
.sg-reminder-modal-box { max-width:380px;text-align:center; }
.sg-reminder-header {
    display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:16px;
}
.sg-reminder-bell { font-size:2.4rem;animation:bellShake .5s ease .1s; }
@keyframes bellShake {
    0%,100%{transform:rotate(0)} 20%{transform:rotate(-15deg)} 40%{transform:rotate(15deg)}
    60%{transform:rotate(-10deg)} 80%{transform:rotate(10deg)}
}
.sg-reminder-title { margin:0;font-size:1.1rem;font-weight:800;color:var(--text-primary); }
.sg-reminder-body  { font-size:.9rem;color:var(--text-primary);margin:0 0 8px;line-height:1.5; }
.sg-reminder-sub   { font-size:.78rem;color:var(--text-muted);margin:0 0 20px;line-height:1.4; }

/* Add buttons */
.sg-add-btn {
    display:inline-flex;align-items:center;gap:8px;
    padding:9px 20px;border-radius:12px;border:none;
    background:linear-gradient(135deg,var(--primary) 0%,color-mix(in srgb,var(--primary) 75%,#000) 100%);
    color:#fff;font-size:.85rem;font-weight:700;cursor:pointer;
    white-space:nowrap;letter-spacing:.01em;
    box-shadow:0 4px 14px color-mix(in srgb,var(--primary) 35%,transparent);
    transition:transform .15s,box-shadow .15s,filter .15s;
}
.sg-add-btn:hover {
    transform:translateY(-1px);
    box-shadow:0 6px 20px color-mix(in srgb,var(--primary) 45%,transparent);
    filter:brightness(1.08);
}
.sg-add-btn:active { transform:translateY(0);box-shadow:none;filter:brightness(.96); }
.sg-add-ico {
    width:20px;height:20px;border-radius:6px;
    background:rgba(255,255,255,.22);
    display:inline-flex;align-items:center;justify-content:center;
    font-size:.95rem;font-weight:400;line-height:1;flex-shrink:0;
}

/* Employee view extras */
.sg-emp-schedule { padding:0; }
.sg-emp-month-grid {
    display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:20px;
}
.sg-emp-day {
    border-radius:12px;border:2px solid var(--border);background:var(--bg-raised);
    padding:8px 4px;text-align:center;cursor:pointer;transition:all .15s;min-height:70px;
    display:flex;flex-direction:column;align-items:center;gap:4px;
}
.sg-emp-day:hover { border-color:var(--primary); }
.sg-emp-day.we { background:rgba(139,92,246,.05); }
.sg-emp-day.today { border-color:var(--primary);box-shadow:0 0 0 3px rgba(var(--primary-rgb),.15); }
.sg-emp-day-num { font-size:.8rem;font-weight:700;color:var(--text-primary); }
.sg-emp-day-dow { font-size:.65rem;color:var(--text-muted); }
.sg-emp-day-badge {
    width:100%;padding:2px 4px;border-radius:6px;font-size:.65rem;font-weight:700;
    text-align:center;margin-top:auto;
}
.sg-dow-header {
    display:grid;grid-template-columns:repeat(7,1fr);gap:6px;
    padding:12px 20px 0;
}
.sg-dow-header span {
    text-align:center;font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;
}
@media(max-width:900px){
    .sg-body { flex-direction:column; }
    .sg-loc-sidebar {
        width:100%;position:static;
        max-height:none;
    }
    .sg-loc-sidebar-list {
        flex-direction:row;flex-wrap:wrap;max-height:none;
        gap:4px;
    }
    .sg-loc-item-row { flex:none; }
    .sg-loc-item { flex:none;padding:6px 10px; }
    .sg-loc-item-name { max-width:120px; }
}
@media(max-width:700px){
    .sg-hero { padding:22px 18px; }
    .sg-shift-grid { grid-template-columns:1fr; }
    .sg-emp-month-grid { gap:4px;padding:12px; }
}
</style>`;
    }
};


// ── Employee Page ──────────────────────────────────────────────────
const ScheduleGraphEmployee = {
    _container: null,
    _assignments: [],   // [{locId, locName}]
    _locId:       null,
    _entries:     {},   // key: date → entry row
    _managerHelpDates: {},
    _month: new Date().getMonth(),
    _year:  new Date().getFullYear(),

    async init(container) {
        this._container = container;
        UI.setBreadcrumb([{ label: 'Мій графік' }]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        await this._loadData();
        this._render(container);
    },

    async _loadData() {
        const { data: aData } = await supabase.from('schedule_assignments')
            .select('location_id')
            .eq('user_id', AppState.user.id);

        const assignRows = aData || [];
        if (!assignRows.length) { this._assignments = []; this._locId = null; return; }

        const locIds = assignRows.map(a => a.location_id);
        const { data: lData } = await supabase.from('schedule_locations')
            .select('id, name, locked')
            .in('id', locIds);
        const locs = lData || [];

        this._assignments = assignRows.map(a => ({
            locId:   a.location_id,
            locName: locs.find(l => l.id === a.location_id)?.name || 'Локація',
            locked:  locs.find(l => l.id === a.location_id)?.locked || false
        }));

        if (!this._locId || !this._assignments.find(a => a.locId === this._locId))
            this._locId = this._assignments[0].locId;
        await this._loadEntries();
    },

    async _loadEntries() {
        const p = n => String(n).padStart(2, '0');
        const dateFrom = `${this._year}-${p(this._month + 1)}-01`;
        const dateTo   = `${this._year}-${p(this._month + 1)}-${new Date(this._year, this._month + 1, 0).getDate()}`;

        const { data } = await supabase.from('schedule_entries')
            .select('*')
            .eq('location_id', this._locId)
            .eq('user_id', AppState.user.id)
            .gte('date', dateFrom)
            .lte('date', dateTo);

        this._entries = {};
        (data || []).forEach(e => { this._entries[e.date] = e; });

        this._managerHelpDates = {};
        const myLocIds = this._assignments.map(a => a.locId).filter(Boolean);
        if (myLocIds.length) {
            const { data: helpData } = await supabase.from('schedule_entries')
                .select('id, date, location_id, updated_by')
                .eq('notes', '__mgr_help__')
                .in('location_id', myLocIds)
                .gte('date', dateFrom)
                .lte('date', dateTo);

            if ((helpData || []).length) {
                const helpLocIds = [...new Set(helpData.map(e => e.location_id))];
                const { data: helpLocs } = await supabase.from('schedule_locations')
                    .select('id, name').in('id', helpLocIds);
                const locMap = Object.fromEntries((helpLocs || []).map(l => [l.id, l.name]));
                helpData.forEach(e => {
                    if (!this._managerHelpDates[e.date])
                        this._managerHelpDates[e.date] = {
                            entryId:   e.id,
                            locId:     e.location_id,
                            locName:   locMap[e.location_id] || '',
                            managerId: e.updated_by
                        };
                });
            }
        }
    },

    _render(container) {
        const p = n => String(n).padStart(2, '0');

        if (!this._assignments.length) {
            container.innerHTML = `
<div class="sg-page">
    ${this._empHero('', null)}
    <div class="empty-state" style="margin-top:2rem">
        <div class="empty-icon">📋</div>
        <h3>Вас не додано до графіку</h3>
        <p>Зверніться до керівника щоб вас включили до розкладу роботи</p>
    </div>
</div>
${ScheduleGraphPage._styles()}${this._empStyles()}`;
            return;
        }

        const locName = this._assignments.find(a => a.locId === this._locId)?.locName || '';
        const days    = new Date(this._year, this._month + 1, 0).getDate();
        const offset  = (new Date(this._year, this._month, 1).getDay() + 6) % 7; // Mon=0
        const today   = new Date();
        const todayStr = `${today.getFullYear()}-${p(today.getMonth()+1)}-${p(today.getDate())}`;

        // Stats
        const stats = { work: 0, day_off: 0, vacation: 0, sick: 0 };
        Object.values(this._entries).forEach(e => { if (stats[e.shift_type] !== undefined) stats[e.shift_type]++; });

        // Calendar cells
        const cells = [];
        for (let i = 0; i < offset; i++) cells.push(`<div class="sge-empty-cell"></div>`);
        for (let d = 1; d <= days; d++) {
            const dateStr = `${this._year}-${p(this._month + 1)}-${p(d)}`;
            const dow     = (new Date(this._year, this._month, d).getDay() + 6) % 7;
            const we      = dow >= 5;
            const entry   = this._entries[dateStr];
            const shift   = entry ? SHIFT_TYPES[entry.shift_type] : null;
            const isToday = dateStr === todayStr;
            const canSub    = entry?.notes === '__sub__';
            const needSub   = entry?.notes === '__needsub__';
            const isSubConf = entry?.notes === '__sub_confirmed__';
            const dispShift = isSubConf ? SUB_CONFIRMED : shift;
            const mgrHelpInfo = this._managerHelpDates[dateStr];
            const mgrHelp    = !!mgrHelpInfo;
            const mgrHelpLoc = mgrHelpInfo?.locName || '';
            cells.push(`
<div class="sge-day${we?' we':''}${isToday?' today':''}${(shift||isSubConf)?' has-shift':''}${canSub?' sge-cansub':''}${needSub?' sge-needsub':''}${isSubConf?' sge-subconf':''}${mgrHelp?' sge-mgr-help':''}"
    onclick="ScheduleGraphEmployee._openCell('${dateStr}')"
    title="${canSub ? 'Можу вийти на підміну' : needSub ? 'Потрібна підміна' : isSubConf ? 'Підтверджена підміна' : mgrHelp ? 'Керівник шукає підміну' : shift ? shift.label : 'Додати запис'}">
    <div class="sge-day-top">
        <span class="sge-day-num${isToday?' cur':''}">${d}</span>
        <span class="sge-day-dow">${['Пн','Вт','Ср','Чт','Пт','Сб','Нд'][dow]}</span>
    </div>
    ${canSub  ? `<div class="sge-flag-badge sge-flag-badge-sub">🙋</div>`
        : needSub ? `<div class="sge-flag-badge sge-flag-badge-need">🆘</div>`
        : dispShift ? `<div class="sge-badge" style="background:${dispShift.bg};color:${dispShift.color}">
               <span class="sge-badge-top">${dispShift.short}</span>
               <span class="sge-badge-label">${dispShift.label}</span>
           </div>`
        : mgrHelp ? `<div class="sge-flag-badge sge-flag-badge-mgr">
               <span class="sge-mgr-flag-ico">🆘</span>
               ${mgrHelpLoc ? `<span class="sge-mgr-flag-loc">${mgrHelpLoc}</span>` : ''}
           </div>`
        : `<div class="sge-no-entry">+</div>`}
    ${mgrHelp && (shift || canSub || needSub) ? `<div class="sge-mgr-help-ind">🆘 ${mgrHelpLoc}</div>` : ''}
</div>`);
        }

        const locTabs = this._assignments.length > 1 ? `
<div class="sg-loc-bar" style="margin-bottom:16px">
    <div class="sg-loc-tabs">
        ${this._assignments.map(a => `
        <button class="sg-loc-tab ${a.locId === this._locId ? 'active' : ''}"
            onclick="ScheduleGraphEmployee._switchLoc('${a.locId}')">🏪 ${a.locName}</button>`).join('')}
    </div>
</div>` : '';

        const hasAnyEntry = Object.keys(this._entries).length > 0;

        container.innerHTML = `
<div class="sg-page">
    ${this._empHero(locName, this._locId)}

    ${locTabs}

    <div class="sg-controls" style="margin-bottom:16px">
        <div class="sg-month-nav">
            <button class="sg-mnav" onclick="ScheduleGraphEmployee._prevMonth()">‹</button>
            <span class="sg-mlabel">${MONTHS_UA[this._month]} ${this._year}</span>
            <button class="sg-mnav" onclick="ScheduleGraphEmployee._nextMonth()">›</button>
        </div>
        <div class="sge-stats">
            ${Object.entries(SHIFT_TYPES).map(([k, v]) => stats[k] ? `
            <div class="sge-stat-chip" style="background:${v.bg};color:${v.color}">
                <span class="sge-stat-short">${v.short}</span>
                <span>${stats[k]} ${k==='work'?'роб.':k==='day_off'?'вих.':k==='vacation'?'відп.':'лік.'}</span>
            </div>` : '').join('')}
        </div>
    </div>

    ${this._assignments.find(a => a.locId === this._locId)?.locked ? `
    <div class="sg-locked-banner">
        🔒 <strong>Графік заблоковано.</strong> Зміни вносить тільки керівник.
    </div>` : ''}

    <div class="sg-section sge-cal-section">
        <div class="sge-legend-bar">
            ${Object.entries(SHIFT_TYPES).map(([k, v]) => `
            <span class="sge-legend-item">
                <span class="sge-legend-dot" style="background:${v.color}"></span>${v.label}
            </span>`).join('')}
        </div>

        <div class="sge-dow-row">
            ${['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(d=>`<div class="sge-dow-cell">${d}</div>`).join('')}
        </div>

        <div class="sge-grid">
            ${cells.join('')}
        </div>

        ${!hasAnyEntry ? `
        <div class="sge-no-data">
            <span>📋</span> Графік на цей місяць ще порожній — натисніть на будь-який день щоб додати запис
        </div>` : `
        <div class="sge-no-data" style="border-top:1px solid var(--border)">
            ✏️ Натисніть на день щоб переглянути або редагувати запис
        </div>`}
    </div>
</div>
${ScheduleGraphPage._styles()}${this._empStyles()}`;
    },

    _empHero(locName, locId) {
        const isManager = AppState.isManager?.() || AppState.isAdmin?.() || AppState.isOwner?.();
        const wh = locId ? ScheduleGraphPage._getWorkHours(locId) : {};
        const whText = (wh.start && wh.end) ? `${wh.start} — ${wh.end}` : '';
        return `
<div class="sg-hero" style="margin-bottom:20px">
    <div class="sg-hero-inner">
        <div class="sg-hero-ico">🗓</div>
        <div style="flex:1">
            <h1 class="sg-hero-title">Мій графік</h1>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px">
                ${locName ? `<span class="sg-hero-sub" style="margin:0">🏪 ${locName}</span>` : '<span class="sg-hero-sub" style="margin:0">Ваш персональний розклад роботи</span>'}
                ${whText ? `<span class="sge-wh-badge">🕐 ${whText}</span>` : ''}
            </div>
        </div>
        ${isManager ? `
        <button class="sg-my-sched-btn" onclick="ScheduleGraphPage.init(ScheduleGraphEmployee._container)">
            ← Керування графіком
        </button>` : ''}
    </div>
</div>`;
    },

    _empStyles() {
        return `<style>
/* Location switcher tabs (employee view) */
.sg-loc-bar { display:inline-block; }
.sg-loc-tabs { display:flex;gap:4px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:14px;padding:4px;flex-wrap:wrap; }
.sg-loc-tab {
    padding:7px 16px;border-radius:10px;border:none;background:transparent;
    color:var(--text-muted);font-size:.85rem;font-weight:600;cursor:pointer;
    transition:all .18s;display:flex;align-items:center;gap:5px;white-space:nowrap;
}
.sg-loc-tab:hover { background:var(--bg-hover);color:var(--text-primary); }
.sg-loc-tab.active { background:var(--primary);color:#fff; }

.sge-wh-badge {
    display:inline-flex;align-items:center;gap:5px;
    padding:3px 10px;border-radius:20px;font-size:.8rem;font-weight:600;
    background:rgba(255,255,255,.15);color:rgba(255,255,255,.9);
    border:1px solid rgba(255,255,255,.2);letter-spacing:.02em;
}
.sge-stats { display:flex;gap:8px;flex-wrap:wrap;align-items:center; }
.sge-stat-chip {
    display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;
    font-size:.8rem;font-weight:600;
}
.sge-stat-short {
    font-weight:800;font-size:.85rem;
}
.sge-cal-section { overflow:hidden; }
.sge-legend-bar {
    display:flex;gap:20px;flex-wrap:wrap;padding:12px 20px;
    border-bottom:1px solid var(--border);background:var(--bg-raised);
}
.sge-legend-item {
    display:flex;align-items:center;gap:6px;font-size:.8rem;color:var(--text-secondary);font-weight:500;
}
.sge-legend-dot {
    width:8px;height:8px;border-radius:50%;flex-shrink:0;
}
.sge-dow-row {
    display:grid;grid-template-columns:repeat(7,1fr);
    padding:8px 12px 4px;gap:6px;
}
.sge-dow-cell {
    text-align:center;font-size:.72rem;font-weight:700;color:var(--text-muted);
    text-transform:uppercase;letter-spacing:.04em;
}
.sge-grid {
    display:grid;grid-template-columns:repeat(7,1fr);gap:6px;padding:4px 12px 16px;
}
.sge-empty-cell { min-height:80px; }
.sge-day {
    min-height:80px;border-radius:12px;border:2px solid var(--border);
    background:var(--bg-raised);padding:8px;
    display:flex;flex-direction:column;gap:6px;transition:all .15s;
    cursor:pointer;
}
.sge-day:hover { border-color:var(--primary);background:var(--bg-hover); }
.sge-day.we { background:rgba(139,92,246,.04);border-color:rgba(139,92,246,.15); }
.sge-day.we:hover { border-color:var(--primary); }
.sge-day.today { border-color:var(--primary);box-shadow:0 0 0 3px rgba(var(--primary-rgb),.1); }
.sge-day.has-shift { border-color:transparent; }
.sge-day.has-shift:hover { border-color:var(--primary); }
.sge-day-top { display:flex;align-items:center;justify-content:space-between; }
.sge-day-num {
    font-size:.85rem;font-weight:700;color:var(--text-primary);
    width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%;
}
.sge-day-num.cur { background:var(--primary);color:#fff; }
.sge-day-dow { font-size:.65rem;color:var(--text-muted); }
.sge-badge {
    flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
    border-radius:8px;padding:4px 2px;font-size:.78rem;font-weight:800;text-align:center;
    gap:2px;
}
.sge-badge span { font-size:.65rem;font-weight:500;opacity:.9; }
.sge-no-entry {
    flex:1;display:flex;align-items:center;justify-content:center;
    font-size:1.2rem;color:var(--text-muted);opacity:.2;font-weight:300;
}
.sge-day:hover .sge-no-entry { opacity:.5; }
.sge-no-data {
    text-align:center;padding:16px;font-size:.82rem;color:var(--text-muted);
    border-top:1px solid var(--border);
}
/* Can-substitute indicator on employee calendar cells */
.sge-day.sge-cansub {
    border-color:#10b981;
    box-shadow:0 0 0 2px rgba(16,185,129,.18);
}
/* Needs-substitute indicator on employee calendar cells */
.sge-day.sge-needsub {
    border-color:#f97316;
    box-shadow:0 0 0 2px rgba(249,115,22,.22);
    background:rgba(249,115,22,.05);
}
/* Badge layout in employee calendar */
.sge-badge-top   { font-size:.82rem;font-weight:800;line-height:1; }
.sge-badge-label { font-size:.62rem;font-weight:500;opacity:.88; }
/* Confirmed substitution cell */
.sge-day.sge-subconf {
    border-color:rgba(249,115,22,.45);
    box-shadow:0 0 0 2px rgba(249,115,22,.12);
}

/* Manager help indicator on employee calendar cells */
.sge-day.sge-mgr-help {
    border-color:rgba(239,68,68,.5);
    box-shadow:0 0 0 2px rgba(239,68,68,.12);
}
.sge-flag-badge-mgr {
    flex-direction:column;gap:2px;
    background:rgba(239,68,68,.1);color:#ef4444;
}
.sge-mgr-flag-ico { font-size:1.3rem;line-height:1; }
.sge-mgr-flag-loc {
    font-size:.58rem;font-weight:700;color:#ef4444;opacity:.85;
    max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    text-align:center;padding:0 2px;
}
.sge-mgr-help-ind {
    font-size:.58rem;font-weight:700;color:#ef4444;
    background:rgba(239,68,68,.12);border-radius:4px;
    padding:1px 4px;text-align:center;line-height:1.4;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}

/* Flag-only badges in employee calendar */
.sge-flag-badge {
    flex:1;display:flex;align-items:center;justify-content:center;
    border-radius:8px;font-size:1.4rem;
}
.sge-flag-badge-sub  { background:rgba(16,185,129,.12);color:#10b981; }
.sge-flag-badge-need { background:rgba(249,115,22,.12);color:#f97316; }
@media(max-width:600px){
    .sge-grid { gap:3px;padding:4px 6px 12px; }
    .sge-day { min-height:64px;padding:5px; }
    .sge-badge span { display:none; }
}
</style>`;
    },

    async _openCell(date) {
        const now = new Date();
        if (this._year < now.getFullYear() || (this._year === now.getFullYear() && this._month < now.getMonth())) {
            Toast.error('Місяць завершено', 'Редагування минулих місяців заблоковано');
            return;
        }
        const currentLoc = this._assignments.find(a => a.locId === this._locId);
        if (currentLoc?.locked) {
            Toast.error('Графік заблоковано', 'Зміни вносить тільки керівник');
            return;
        }
        const info = this._managerHelpDates[date];
        if (info) {
            const conflictLoc = await ScheduleGraphPage._getWorkConflictLoc(
                AppState.user.id, date, info.locId
            );
            this._showMgrHelpResponseModal(date, info, conflictLoc);
            return;
        }
        const entry = this._entries[date];
        ScheduleGraphPage._showShiftModal(AppState.user.id, date, entry, AppState.profile, true);
    },

    _showMgrHelpResponseModal(date, info, conflictLoc) {
        document.getElementById('sg-mgrhelp-resp-modal')?.remove();
        const dateLabel = new Date(date + 'T00:00:00')
            .toLocaleDateString('uk-UA', { weekday:'long', day:'numeric', month:'long' });
        const el = document.createElement('div');
        el.id = 'sg-mgrhelp-resp-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal sg-resolve-modal">
    <div class="sg-mhdr">
        <div>
            <h3 style="margin:0;font-size:1.05rem">🆘 Керівник шукає підміну</h3>
            <p style="margin:3px 0 0;color:var(--text-muted);font-size:.8rem;text-transform:capitalize">${dateLabel}</p>
        </div>
        <button class="sg-mclose" onclick="document.getElementById('sg-mgrhelp-resp-modal').remove()">✕</button>
    </div>
    <div class="sg-resolve-flag-banner need">
        <span class="sg-resolve-flag-ico">🆘</span>
        <div>
            <div class="sg-resolve-flag-title">Потрібна підміна${info.locName ? ' у «'+info.locName+'»' : ''}</div>
            <div class="sg-resolve-flag-desc">Керівник шукає того, хто може вийти цього дня. Якщо ви готові — підтвердіть.</div>
        </div>
    </div>
    ${conflictLoc ? `
    <div class="sg-shift-modal-err" style="margin-bottom:0">
        ⚠️ Ви вже маєте робочу зміну у «${conflictLoc}» цього дня — вийти на підміну неможливо.
    </div>` : ''}
    <div class="sg-modal-actions">
        <button class="sg-btn-save sg-resolve-confirm-btn" ${conflictLoc ? 'disabled style="opacity:.45;cursor:not-allowed;box-shadow:none"' : ''}
            onclick="ScheduleGraphEmployee._confirmMgrHelp('${date}','${info.entryId}','${info.locId || ''}','${info.managerId || ''}','${(info.locName||'').replace(/'/g,"\\'")}')">
            ✓ Можу вийти
        </button>
        <button class="sg-btn-cancel"
            onclick="document.getElementById('sg-mgrhelp-resp-modal').remove();ScheduleGraphEmployee._editDay('${date}')">
            ✏️ Редагувати день
        </button>
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    async _resolveManagerHelp(date, entryId, managerId, locName) {
        await supabase.from('schedule_entries').delete().eq('id', entryId);
        const empName   = AppState.profile?.full_name || 'Співробітник';
        const dateLabel = new Date(date + 'T00:00:00')
            .toLocaleDateString('uk-UA', { day:'numeric', month:'long' });
        if (managerId) {
            await supabase.from('notifications').insert({
                user_id:    managerId,
                title:      '✅ Підміна підтверджена',
                message:    `${empName} підтвердив(ла), що може вийти ${dateLabel}${locName ? ' у «'+locName+'»' : ''}. Не забудьте зателефонувати!`,
                type:       'general',
                created_by: AppState.user.id
            });
        }
        delete this._managerHelpDates[date];
    },

    async _confirmMgrHelp(date, entryId, locId, managerId, locName) {
        document.getElementById('sg-mgrhelp-resp-modal')?.remove();

        // Ensure employee is assigned to the location
        if (locId) {
            const { error: ae } = await supabase.from('schedule_assignments')
                .insert({ location_id: locId, user_id: AppState.user.id, created_by: AppState.user.id });
            if (ae && ae.code !== '23505') { Toast.error('Помилка', ae.message); return; }

            // Set work shift (Р) for this employee — marked as confirmed substitution
            const { data: newEntry, error: se } = await supabase.from('schedule_entries')
                .upsert({
                    location_id: locId, user_id: AppState.user.id, date,
                    shift_type: 'work', shift_start: null, shift_end: null, notes: '__sub_confirmed__',
                    updated_by: AppState.user.id, updated_at: new Date().toISOString()
                }, { onConflict: 'location_id,user_id,date' })
                .select().single();
            if (se) { Toast.error('Помилка', se.message); return; }

            if (locId === this._locId && newEntry) {
                this._entries[date] = newEntry;
            }
        }

        await this._resolveManagerHelp(date, entryId, managerId, locName);
        this._render(this._container);
        Toast.success('Відповідь надіслано керівнику');
    },

    _editDay(date) {
        const entry = this._entries[date];
        ScheduleGraphPage._showShiftModal(AppState.user.id, date, entry, AppState.profile, true);
    },

    _switchLoc(locId) {
        this._locId = locId;
        this._loadEntries().then(() => this._render(this._container));
    },

    _prevMonth() {
        if (this._month === 0) { this._month = 11; this._year--; } else this._month--;
        this._loadEntries().then(() => this._render(this._container));
    },

    _nextMonth() {
        if (this._month === 11) { this._month = 0; this._year++; } else this._month++;
        this._loadEntries().then(() => this._render(this._container));
    },
};


// ── Schedule View Page (read-only access for granted users) ───────
const ScheduleViewPage = {
    _container:        null,
    _managers:         [],   // [{ id, profile, locationIds }]
    _selectedManager:  null,
    _locations:        [],
    _locId:            null,
    _entries:          {},
    _assignments:      [],
    _month: new Date().getMonth(),
    _year:  new Date().getFullYear(),

    async init(container) {
        this._container      = container;
        this._selectedManager = null;
        UI.setBreadcrumb([{ label: 'Огляд' }]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        await this._loadManagers();
        this._render();
    },

    // ── Load list of managers who granted access ──────────────────
    async _loadManagers() {
        const { data: vRows } = await supabase.from('schedule_viewers')
            .select('location_id, granted_by')
            .eq('user_id', AppState.user.id);
        if (!vRows?.length) { this._managers = []; return; }

        // Group by manager
        const byManager = {};
        for (const v of vRows) {
            const mid = v.granted_by || '__unknown__';
            if (!byManager[mid]) byManager[mid] = { id: mid, locationIds: [] };
            byManager[mid].locationIds.push(v.location_id); // null = all
        }

        // Fetch manager profiles
        const mIds = Object.keys(byManager).filter(id => id !== '__unknown__');
        let profileMap = {};
        if (mIds.length) {
            const { data: profs } = await supabase.from('profiles')
                .select('id, full_name, avatar_url, role').in('id', mIds);
            (profs || []).forEach(p => { profileMap[p.id] = p; });
        }

        this._managers = Object.values(byManager).map(m => ({
            ...m,
            profile: profileMap[m.id] || null
        }));
    },

    // ── Select a manager and load their locations ─────────────────
    async _selectManager(managerId) {
        this._selectedManager = managerId;
        this._locId           = null;
        this._locations       = [];
        this._entries         = {};
        this._assignments     = [];

        const manager = this._managers.find(m => m.id === managerId);
        if (!manager) return;

        const hasAll = manager.locationIds.some(id => id === null);
        let locs;
        if (hasAll) {
            const { data } = await supabase.from('schedule_locations')
                .select('id, name').is('deleted_at', null).order('created_at');
            locs = data || [];
        } else {
            const ids = manager.locationIds.filter(Boolean);
            const { data } = await supabase.from('schedule_locations')
                .select('id, name').in('id', ids).is('deleted_at', null);
            locs = data || [];
        }
        this._locations = locs;
        this._locId = locs[0]?.id || null;
        const managerProfile = manager.profile;
        UI.setBreadcrumb([
            { label: 'Огляд', onclick: 'ScheduleViewPage._backToManagers()' },
            { label: managerProfile?.full_name || 'Керівник' }
        ]);
        if (this._locId) await this._loadEntries();
        this._render();
    },

    _backToManagers() {
        this._selectedManager = null;
        UI.setBreadcrumb([{ label: 'Огляд' }]);
        this._render();
    },

    // ── Load entries + assignments for current location ───────────
    async _loadEntries() {
        const p = n => String(n).padStart(2,'0');
        const dateFrom = `${this._year}-${p(this._month+1)}-01`;
        const dateTo   = `${this._year}-${p(this._month+1)}-${new Date(this._year,this._month+1,0).getDate()}`;

        const [eRes, aRes] = await Promise.all([
            supabase.from('schedule_entries')
                .select('*')
                .eq('location_id', this._locId)
                .gte('date', dateFrom).lte('date', dateTo),
            supabase.from('schedule_assignments')
                .select('user_id')
                .eq('location_id', this._locId)
        ]);
        this._entries = {};
        (eRes.data || []).forEach(e => { this._entries[`${e.user_id}_${e.date}`] = e; });

        const rawAssignments = aRes.data || [];
        if (rawAssignments.length) {
            const ids = [...new Set(rawAssignments.map(a => a.user_id))];
            const { data: profs } = await supabase.from('profiles')
                .select('id, full_name, avatar_url, role, label').in('id', ids);
            const profileMap = {};
            (profs || []).forEach(pr => { profileMap[pr.id] = pr; });
            this._assignments = rawAssignments.map(a => ({ ...a, profile: profileMap[a.user_id] || null }));
        } else {
            this._assignments = [];
        }
    },

    // ── Render ────────────────────────────────────────────────────
    _render() {
        const container = this._container;

        // No access at all
        if (!this._managers.length) {
            container.innerHTML = `
<div class="sgv-page">
    ${this._hero()}
    <div class="empty-state" style="margin-top:2rem">
        <div class="empty-icon">🔒</div>
        <h3>Доступ не надано</h3>
        <p>Зверніться до керівника — він може надати доступ до перегляду графіку</p>
    </div>
</div>
${ScheduleGraphPage._styles()}${this._styles()}`;
            return;
        }

        // Manager selection screen
        if (!this._selectedManager) {
            container.innerHTML = `
<div class="sgv-page">
    ${this._hero()}
    <div class="sgv-manager-grid">
        ${this._managers.map(m => {
            const p        = m.profile || {};
            const initials = (p.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
            const color    = ScheduleGraphPage._avatarColor(m.id);
            const locCount = m.locationIds.some(id => id === null)
                ? 'Всі локації'
                : `${m.locationIds.length} ${m.locationIds.length === 1 ? 'локація' : m.locationIds.length < 5 ? 'локації' : 'локацій'}`;
            return `
        <button class="sgv-manager-card" onclick="ScheduleViewPage._selectManager('${m.id}')">
            <div class="sgv-manager-av" style="background:${color}">
                ${p.avatar_url ? `<img src="${p.avatar_url}">` : initials}
            </div>
            <div class="sgv-manager-info">
                <div class="sgv-manager-name">${p.full_name || 'Керівник'}</div>
                <div class="sgv-manager-meta">${p.role ? Fmt.role(p.role) : ''}</div>
                <div class="sgv-manager-locs">🏪 ${locCount}</div>
            </div>
            <span class="sgv-manager-arrow">›</span>
        </button>`;
        }).join('')}
    </div>
</div>
${ScheduleGraphPage._styles()}${this._styles()}`;
            return;
        }

        // Schedule view for selected manager
        const days    = new Date(this._year, this._month+1, 0).getDate();
        const nums    = Array.from({length:days},(_,i)=>i+1);
        const locName = this._locations.find(l => l.id === this._locId)?.name || '';
        const manager = this._managers.find(m => m.id === this._selectedManager);
        const mp      = manager?.profile || {};
        const mInit   = (mp.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        const mColor  = ScheduleGraphPage._avatarColor(this._selectedManager);

        container.innerHTML = `
<div class="sgv-page">
    ${this._hero(`
        <button class="sgv-back-btn" onclick="ScheduleViewPage._backToManagers()">← Назад</button>
        <div class="sgv-manager-badge">
            <div class="sg-av sm" style="background:${mColor}">
                ${mp.avatar_url ? `<img src="${mp.avatar_url}">` : mInit}
            </div>
            <span>${mp.full_name || 'Керівник'}</span>
        </div>
    `)}

    ${this._locations.length > 1 ? `
    <div class="sgv-loc-tabs">
        ${this._locations.map(l => `
        <button class="sgv-loc-tab ${l.id === this._locId ? 'active' : ''}"
            onclick="ScheduleViewPage._switchLoc('${l.id}')">
            🏪 ${l.name}
        </button>`).join('')}
    </div>` : ''}

    <div class="sg-section">
        <div class="sgv-header-bar">
            <span class="sgv-loc-name">🏪 ${locName}</span>
            <div class="sg-month-nav" style="margin-left:auto">
                <button class="sg-mnav" onclick="ScheduleViewPage._prevMonth()">‹</button>
                <span class="sg-mlabel" style="min-width:140px">${MONTHS_UA[this._month]} ${this._year}</span>
                <button class="sg-mnav" onclick="ScheduleViewPage._nextMonth()">›</button>
            </div>
        </div>

        ${!this._assignments.length ? `
        <div class="empty-state" style="margin:2rem 0">
            <div class="empty-icon">👥</div>
            <h3>Немає співробітників</h3>
        </div>` : `
        <div class="sg-scroll-wrap">
        <table class="sg-table">
            <thead><tr>
                <th class="sg-th-name">Співробітник</th>
                ${nums.map(d => {
                    const dow = new Date(this._year, this._month, d).getDay();
                    const we  = dow === 0 || dow === 6;
                    return `<th class="sg-th-day${we?' we':''}">
                        <div class="sg-day-num">${d}</div>
                        <div class="sg-day-dow">${DAYS_SHORT[dow]}</div>
                    </th>`;
                }).join('')}
                <th class="sg-th-sum"><div class="sg-th-sum-inner">Σ</div><div class="sg-th-sub">Дні</div></th>
            </tr></thead>
            <tbody>
                ${this._assignments.map(a => {
                    const p     = a.profile || {};
                    const init  = (p.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
                    const color = ScheduleGraphPage._avatarColor(a.user_id);
                    const sub   = [p.role ? Fmt.role(p.role) : '', p.label || ''].filter(Boolean).join(' · ');
                    let workDays = 0;
                    const cells = nums.map(d => {
                        const date  = `${this._year}-${String(this._month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                        const entry = this._entries[`${a.user_id}_${date}`];
                        const shift = entry ? SHIFT_TYPES[entry.shift_type] : null;
                        const dow   = new Date(this._year, this._month, d).getDay();
                        const we    = dow === 0 || dow === 6;
                        if (entry?.shift_type === 'work') workDays++;
                        return `<td class="sg-cell${we?' we':''}">
                            ${shift ? `<span class="sg-badge" style="background:${shift.bg};color:${shift.color}">${shift.short}</span>` : ''}
                        </td>`;
                    }).join('');
                    return `<tr>
                        <td class="sg-td-name" title="${p.full_name||''}">
                            <div class="sg-emp-chip">
                                <div class="sg-av" style="flex-shrink:0;background:${color}">
                                    ${p.avatar_url ? `<img src="${p.avatar_url}">` : init}
                                </div>
                                <div class="sg-name-info">
                                    <div class="sg-name-full">${p.full_name||'Без імені'}</div>
                                    ${sub ? `<div class="sg-name-sub">${sub}</div>` : ''}
                                </div>
                            </div>
                        </td>
                        ${cells}
                        <td class="sg-td-sum">${workDays}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
        </div>`}
    </div>
</div>
${ScheduleGraphPage._styles()}${this._styles()}`;
    },

    _hero(extra = '') {
        return `
<div class="sgv-hero">
    <div class="sgv-hero-ico">👁</div>
    <div style="flex:1">
        <h1 class="sgv-hero-title">Огляд</h1>
        <p class="sgv-hero-sub">Перегляд графіку роботи</p>
    </div>
    ${extra}
</div>`;
    },

    _styles() {
        return `
<style>
.sgv-page { max-width:100%;animation:fadeSlideUp .25s cubic-bezier(.16,1,.3,1); }
.sgv-hero {
    display:flex;align-items:center;gap:16px;
    background:linear-gradient(135deg,#1a2744,#1e3a5f);
    border-radius:18px;padding:22px 24px;margin-bottom:20px;
}
.sgv-hero-ico  { font-size:2rem; }
.sgv-hero-title{ margin:0 0 2px;font-size:1.4rem;font-weight:800;color:#fff; }
.sgv-hero-sub  { margin:0;color:rgba(255,255,255,.6);font-size:.85rem; }

/* Manager selection */
.sgv-manager-grid { display:flex;flex-direction:column;gap:10px; }
.sgv-manager-card {
    display:flex;align-items:center;gap:16px;
    padding:16px 20px;border-radius:14px;border:1.5px solid var(--border);
    background:var(--bg-surface);cursor:pointer;text-align:left;
    transition:border-color .15s,background .15s;width:100%;
}
.sgv-manager-card:hover { border-color:var(--primary);background:var(--bg-hover); }
.sgv-manager-av {
    width:48px;height:48px;border-radius:50%;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
    color:#fff;font-size:.9rem;font-weight:700;overflow:hidden;
}
.sgv-manager-av img { width:100%;height:100%;object-fit:cover; }
.sgv-manager-info  { flex:1;min-width:0; }
.sgv-manager-name  { font-weight:700;font-size:1rem;color:var(--text-primary); }
.sgv-manager-meta  { font-size:.8rem;color:var(--text-muted);margin-top:2px; }
.sgv-manager-locs  { font-size:.8rem;color:var(--primary);margin-top:4px; }
.sgv-manager-arrow { font-size:1.4rem;color:var(--text-muted); }

/* Back + manager badge in hero */
.sgv-back-btn {
    padding:7px 14px;border-radius:8px;border:1.5px solid rgba(255,255,255,.25);
    background:rgba(255,255,255,.08);color:#fff;cursor:pointer;font-size:.85rem;
    transition:background .15s;white-space:nowrap;
}
.sgv-back-btn:hover { background:rgba(255,255,255,.18); }
.sgv-manager-badge {
    display:flex;align-items:center;gap:8px;
    background:rgba(255,255,255,.1);border-radius:8px;
    padding:6px 12px;color:#fff;font-size:.85rem;font-weight:500;
}

/* Loc tabs */
.sgv-loc-tabs { display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px; }
.sgv-loc-tab {
    padding:7px 16px;border-radius:20px;border:1.5px solid var(--border);
    background:var(--bg-surface);cursor:pointer;font-size:.85rem;
    color:var(--text-secondary);transition:all .15s;
}
.sgv-loc-tab.active,.sgv-loc-tab:hover {
    border-color:var(--primary);background:rgba(99,102,241,.1);color:var(--primary);font-weight:600;
}
.sgv-header-bar {
    display:flex;align-items:center;gap:12px;
    padding:12px 16px;border-bottom:1px solid var(--border);flex-wrap:wrap;
}
.sgv-loc-name { font-weight:600;font-size:1rem;color:var(--text-primary); }
</style>`;
    },

    // ── Navigation ────────────────────────────────────────────────
    _switchLoc(locId) {
        this._locId = locId;
        this._loadEntries().then(() => this._render());
    },

    _prevMonth() {
        if (this._month === 0) { this._month = 11; this._year--; } else this._month--;
        this._loadEntries().then(() => this._render());
    },

    _nextMonth() {
        if (this._month === 11) { this._month = 0; this._year++; } else this._month++;
        this._loadEntries().then(() => this._render());
    },
};
