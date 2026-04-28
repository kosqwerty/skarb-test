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
        this._isAssignedAsEmployee = (empCheck.count || 0) > 0;

        if (this._locations.length && !this._locId) this._locId = this._locations[0].id;
        await this._loadPageData();
        this._render(container);
    },

    _switchToEmployee() {
        ScheduleGraphEmployee.init(this._container);
    },

    async _loadLocations() {
        const q = supabase.from('schedule_locations').select('*').order('created_at');
        if (!AppState.isAdmin() && !AppState.isOwner()) q.eq('created_by', AppState.user.id);
        const { data } = await q;
        this._locations = data || [];
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
    ${this._locBar()}
    ${this._locId ? `
        <div class="sg-controls">
            <div class="sg-month-nav">
                <button class="sg-mnav" onclick="ScheduleGraphPage._prevMonth()">‹</button>
                <span class="sg-mlabel">${MONTHS_UA[this._month]} ${this._year}</span>
                <button class="sg-mnav" onclick="ScheduleGraphPage._nextMonth()">›</button>
            </div>
            ${this._locId !== 'all' ? `
            <div class="sg-tabs">
                <button class="sg-tab ${this._tab==='schedule'?'active':''}"
                    onclick="ScheduleGraphPage._switchTab('schedule')">📅 Графік</button>
                <button class="sg-tab ${this._tab==='subst'?'active':''}"
                    onclick="ScheduleGraphPage._switchTab('subst')">🔄 Підміна</button>
                <button class="sg-tab ${this._tab==='log'?'active':''}"
                    onclick="ScheduleGraphPage._switchTab('log')">📋 Журнал змін</button>
            </div>` : ''}
        </div>
        ${this._locId === 'all'
            ? this._allLocsSection()
            : this._tab === 'schedule' ? this._tableSection()
            : this._tab === 'subst'   ? this._substSection()
            : this._logSection()}
    ` : `
        <div class="empty-state" style="margin-top:2rem">
            <div class="empty-icon">🏪</div>
            <h3>Немає локацій</h3>
            <p>Додайте першу локацію щоб починати складати графіки</p>
            <button class="btn-primary" onclick="ScheduleGraphPage._addLocation()">+ Додати локацію</button>
        </div>
    `}
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

    _locBar() {
        return `
<div class="sg-loc-bar">
    <div class="sg-loc-tabs">
        ${this._locations.length > 1 ? `
        <button class="sg-loc-tab ${this._locId === 'all' ? 'active' : ''}"
            onclick="ScheduleGraphPage._selectLocation('all')" style="gap:6px">
            🗂 Всі локації
        </button>` : ''}
        ${this._locations.map(l => {
            const wh = this._getWorkHours(l.id);
            const whText = (wh.start && wh.end) ? `${wh.start}–${wh.end}` : '';
            return `
        <div class="sg-loc-tab-wrap ${l.id === this._locId ? 'active' : ''}">
            <button class="sg-loc-tab ${l.id === this._locId ? 'active' : ''}"
                onclick="ScheduleGraphPage._selectLocation('${l.id}')">
                🏪 ${l.name}${whText ? `<span class="sg-loc-wh">${whText}</span>` : ''}
            </button>
            ${l.id === this._locId ? `
            <button class="sg-loc-rename" title="Перейменувати"
                onclick="ScheduleGraphPage._renameLocation('${l.id}','${l.name.replace(/'/g,"\\'")}')">✏️</button>
            ` : ''}
        </div>`;
        }).join('')}
    </div>
    <div style="display:flex;gap:8px">
        ${this._locId ? `<button class="sg-icon-btn danger" title="Видалити локацію"
            onclick="ScheduleGraphPage._deleteLocation('${this._locId}')">🗑</button>` : ''}
        <button class="btn-primary" style="padding:8px 18px;font-size:.85rem"
            onclick="ScheduleGraphPage._addLocation()">+ Локація</button>
    </div>
</div>`;
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

        return `
<div class="sg-section">
    <div class="sg-work-hours-bar">
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
        <button class="btn-primary" style="padding:8px 18px;font-size:.85rem;white-space:nowrap"
            onclick="ScheduleGraphPage._addEmployee()">+ Співробітник</button>
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
    <div class="sg-scroll-wrap">
        <table class="sg-table">
            <thead>
                <tr>
                    <th class="sg-th-name">Співробітник</th>
                    ${nums.map(d => {
                        const dow = new Date(this._year, this._month, d).getDay();
                        const we  = dow === 0 || dow === 6;
                        return `<th class="sg-th-day${we?' we':''}">
                            <div class="sg-day-num">${d}</div>
                            <div class="sg-day-dow">${DAYS_SHORT[dow]}</div>
                        </th>`;
                    }).join('')}
                    <th class="sg-th-sum" title="Робочих днів">Σ</th>
                    <th class="sg-th-del"></th>
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
                        return `<td class="sg-cell${we?' we':''}"
                            data-uid="${a.user_id}" data-date="${date}"
                            onclick="ScheduleGraphPage._openCell('${a.user_id}','${date}')"
                            title="${shift ? shift.label : 'Клік щоб додати'}">
                            ${shift ? `<span class="sg-badge" style="background:${shift.bg};color:${shift.color}">${shift.short}</span>` : ''}
                        </td>`;
                    }).join('');

                    return `<tr>
                        ${this._nameCell(a.profile, a.user_id)}
                        ${cells}
                        <td class="sg-td-sum">${workTotal(a)}</td>
                        <td class="sg-td-del">
                            <button class="sg-rm" title="Видалити зі списку"
                                onclick="ScheduleGraphPage._removeEmployee('${a.id}','${a.user_id}',event)">✕</button>
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

    async _addLocation() {
        const name = prompt('Назва локації (магазин, відділення, ломбард):');
        if (!name?.trim()) return;
        const { data, error } = await supabase.from('schedule_locations')
            .insert({ name: name.trim(), created_by: AppState.user.id })
            .select().single();
        if (error) { Toast.error('Помилка', error.message); return; }
        this._locations.push(data);
        this._locId = data.id;
        this._assignments = [];
        this._entries = {};
        this._render(this._container);
        Toast.success('Локацію додано');
    },

    async _renameLocation(id, currentName) {
        const name = prompt('Нова назва локації:', currentName);
        if (!name?.trim() || name.trim() === currentName) return;
        const { error } = await supabase.from('schedule_locations')
            .update({ name: name.trim() })
            .eq('id', id);
        if (error) { Toast.error('Помилка', error.message); return; }
        const loc = this._locations.find(l => l.id === id);
        if (loc) loc.name = name.trim();
        this._render(this._container);
        Toast.success('Перейменовано');
    },

    async _deleteLocation(id) {
        if (!confirm('Видалити локацію та всі дані графіку?')) return;
        const { error } = await supabase.from('schedule_locations').delete().eq('id', id);
        if (error) { Toast.error('Помилка', error.message); return; }
        this._locations = this._locations.filter(l => l.id !== id);
        this._locId = this._locations[0]?.id || null;
        this._assignments = [];
        this._entries = {};
        await this._loadPageData();
        this._render(this._container);
        Toast.success('Локацію видалено');
    },

    _selectLocation(id) {
        this._locId    = id;
        this._tab      = 'schedule';
        this._quickType  = null;
        this._substDate  = null;
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
        if (tab === 'log')   this._loadLog().then(() => this._render(this._container));
        else if (tab === 'subst') this._loadAllData().then(() => this._render(this._container));
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
        (eRes.data || []).forEach(e => { this._allEntries[`${e.user_id}_${e.date}`] = e; });
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
                const entry = this._allEntries[`${a.user_id}_${sd}`];
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
                <div class="sg-subst-col-title free">🟢 Вільні — можуть підмінити (${freeList.length})</div>
                ${freeList.length ? freeList.map(a => {
                    const entry = this._allEntries[`${a.user_id}_${sd}`];
                    const shift = entry ? SHIFT_TYPES[entry.shift_type] : null;
                    return `<div class="sg-subst-person sg-subst-free-card"
                        onclick="ScheduleGraphPage._assignSubstitute('${a.user_id}')"
                        title="Натисніть щоб призначити на підміну">
                        <div class="sg-av sm">${(a.profile?.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
                        <div>
                            <div class="sg-subst-name">${a.profile?.full_name || 'Невідомо'}</div>
                            <div class="sg-subst-loc">🏪 ${a.locName}</div>
                        </div>
                        ${shift ? `<span class="sg-badge" style="background:${shift.bg};color:${shift.color};margin-left:auto">${shift.short}</span>` :
                          `<span class="sg-badge" style="background:rgba(16,185,129,.1);color:#10b981;margin-left:auto">—</span>`}
                        <span class="sg-subst-add-btn">+</span>
                    </div>`;
                }).join('') : '<div class="sg-subst-empty">Немає вільних співробітників</div>'}
            </div>
            <div class="sg-subst-busy">
                <div class="sg-subst-col-title busy">🔴 Зайняті цього дня (${busyList.length})</div>
                ${busyList.map(a => {
                    const entry = this._allEntries[`${a.user_id}_${sd}`];
                    const shift = entry ? SHIFT_TYPES[entry.shift_type] : null;
                    return `
                <div class="sg-subst-person busy">
                    <div class="sg-av sm">${(a.profile?.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
                    <div>
                        <div class="sg-subst-name">${a.profile?.full_name || 'Невідомо'}</div>
                        <div class="sg-subst-loc">🏪 ${a.locName}</div>
                    </div>
                    ${shift ? `<span class="sg-badge" style="background:${shift.bg};color:${shift.color};margin-left:auto">${shift.short}</span>` : ''}
                </div>`;
                }).join('')}
            </div>
        </div>
    </div>` : ''}

    <div class="sg-scroll-wrap">
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
                        const entry = this._allEntries[`${a.user_id}_${date}`];
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
                    const rowType = sd ? this._allEntries[`${a.user_id}_${sd}`]?.shift_type : null;
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
                const type = this._allEntries[`${a.user_id}_${sd}`]?.shift_type;
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
                <div class="sg-subst-col-title free">🟢 Вільні — можуть підмінити (${freeList.length})</div>
                ${freeList.length ? freeList.map(a => {
                    const entry = this._allEntries[`${a.user_id}_${sd}`];
                    const shift = entry ? SHIFT_TYPES[entry.shift_type] : null;
                    return `<div class="sg-subst-person sg-subst-free-card"
                        onclick="ScheduleGraphPage._assignSubstitute('${a.user_id}')"
                        title="Натисніть щоб призначити на підміну">
                        <div class="sg-av sm">${(a.profile?.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
                        <div><div class="sg-subst-name">${a.profile?.full_name||'Невідомо'}</div>
                        <div class="sg-subst-loc">🏪 ${a.locName}</div></div>
                        ${shift ? `<span class="sg-badge" style="background:${shift.bg};color:${shift.color};margin-left:auto">${shift.short}</span>`
                                : `<span class="sg-badge" style="background:rgba(16,185,129,.1);color:#10b981;margin-left:auto">—</span>`}
                        <span class="sg-subst-add-btn">+</span>
                    </div>`;
                }).join('') : '<div class="sg-subst-empty">Немає вільних</div>'}
            </div>
            <div class="sg-subst-busy">
                <div class="sg-subst-col-title busy">🔴 Зайняті (${busyList.length})</div>
                ${busyList.map(a => {
                    const entry = this._allEntries[`${a.user_id}_${sd}`];
                    const shift = entry ? SHIFT_TYPES[entry.shift_type] : null;
                    return `<div class="sg-subst-person busy">
                        <div class="sg-av sm">${(a.profile?.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
                        <div><div class="sg-subst-name">${a.profile?.full_name||'Невідомо'}</div>
                        <div class="sg-subst-loc">🏪 ${a.locName}</div></div>
                        ${shift ? `<span class="sg-badge" style="background:${shift.bg};color:${shift.color};margin-left:auto">${shift.short}</span>` : ''}
                    </div>`;
                }).join('')}
            </div>
        </div>
    </div>` : ''}

    <div class="sg-scroll-wrap">
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
                    <th class="sg-th-sum">Σ</th>
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
                            const entry  = this._allEntries[`${a.user_id}_${date}`];
                            const shift  = entry ? SHIFT_TYPES[entry.shift_type] : null;
                            const dow    = new Date(this._year, this._month, d).getDay();
                            const we     = dow === 0 || dow === 6;
                            const isSd   = date === sd;
                            const type   = entry?.shift_type;
                            const isFree = sd && isSd && (!type || type === 'day_off');
                            const isBusy = sd && isSd && !isFree;
                            if (type === 'work') workDays++;
                            return `<td class="sg-cell${we?' we':''}${isSd?' sg-sd-col':''}${isFree?' sg-free-cell':''}${isBusy?' sg-busy-cell':''}"
                                data-uid="${a.user_id}" data-date="${date}"
                                onclick="ScheduleGraphPage._openCellAll('${locId}','${a.user_id}','${date}')"
                                title="${shift ? shift.label : 'Клік щоб додати'}">
                                ${shift ? `<span class="sg-badge" style="background:${shift.bg};color:${shift.color}">${shift.short}</span>`
                                        : isFree ? `<span class="sg-free-dot">●</span>` : ''}
                            </td>`;
                        }).join('');
                        const rowType  = sd ? this._allEntries[`${a.user_id}_${sd}`]?.shift_type : null;
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
        if (this._quickType) {
            this._quickSaveAll(locId, userId, date, this._quickType);
            return;
        }
        const entry = this._allEntries[`${userId}_${date}`];
        const a = this._allAssignments.find(a => a.user_id === userId && a.locId === locId);
        this._showShiftModal(userId, date, entry, a?.profile, false);
        // Override save to use allEntries
        this.__allLocId = locId;
    },

    async _quickSaveAll(locId, userId, date, type) {
        const key    = `${userId}_${date}`;
        const oldEnt = this._allEntries[key];
        if (oldEnt?.shift_type === type) {
            await supabase.from('schedule_entries').delete()
                .eq('location_id', locId).eq('user_id', userId).eq('date', date);
            delete this._allEntries[key];
            document.querySelectorAll(`.sg-cell[data-uid="${userId}"][data-date="${date}"]`)
                .forEach(td => { td.innerHTML = ''; });
            return;
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
        if (this._quickType) {
            this._quickSave(userId, date, this._quickType);
            return;
        }
        const entry = this._entries[`${userId}_${date}`];
        const profile = this._assignments.find(a => a.user_id === userId)?.profile;
        this._showShiftModal(userId, date, entry, profile, false);
    },

    async _quickSave(userId, date, type) {
        const key    = `${userId}_${date}`;
        const oldEnt = this._entries[key];

        // Toggle off if same type already set
        if (oldEnt?.shift_type === type) {
            await this._deleteEntry(userId, date, null);
            return;
        }
        const empName = this._assignments.find(a => a.user_id === userId)?.profile?.full_name || '';

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

    <div class="sg-notes-wrap">
        <label class="sg-notes-label">Примітка</label>
        <textarea id="sg-notes" class="sg-notes" placeholder="Необов'язково...">${entry?.notes || ''}</textarea>
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
        document.querySelectorAll('.sg-stype').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    },

    async _saveEntry(userId, date, isEmployee) {
        const activeBtn = document.querySelector('.sg-stype.active');
        if (!activeBtn) { Toast.error('Оберіть тип зміни'); return; }
        const type   = activeBtn.dataset.type;
        const start  = document.getElementById('sg-tstart')?.value || null;
        const end    = document.getElementById('sg-tend')?.value || null;
        const notes  = document.getElementById('sg-notes')?.value?.trim() || null;
        const locId  = isEmployee
            ? ScheduleGraphEmployee._locId
            : (this._locId === 'all' ? this.__allLocId : this._locId);
        const key    = `${userId}_${date}`;
        const oldEnt = isEmployee ? ScheduleGraphEmployee._entries[date] : this._entries[key];
        const empName = (isEmployee
            ? AppState.profile?.full_name
            : (this._locId === 'all'
                ? this._allAssignments.find(a => a.user_id === userId)?.profile?.full_name
                : this._assignments.find(a => a.user_id === userId)?.profile?.full_name)) || '';

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
            ScheduleGraphEmployee._render(ScheduleGraphEmployee._container);
        } else if (this._locId === 'all') {
            this._allEntries[key] = data;
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
            : (this._locId === 'all' ? this._allEntries[`${userId}_${date}`] : this._entries[`${userId}_${date}`]);
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
            delete this._allEntries[`${userId}_${date}`];
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

/* My schedule switch button */
.sg-my-sched-btn {
    padding:9px 18px;border-radius:12px;border:2px solid rgba(255,255,255,.35);
    background:rgba(255,255,255,.15);color:#fff;font-size:.85rem;font-weight:600;
    cursor:pointer;white-space:nowrap;transition:all .18s;flex-shrink:0;
    backdrop-filter:blur(4px);
}
.sg-my-sched-btn:hover { background:rgba(255,255,255,.28);border-color:rgba(255,255,255,.6); }

/* Location bar */
.sg-loc-bar {
    display:flex;align-items:center;gap:12px;margin-bottom:20px;
    flex-wrap:wrap;
}
.sg-loc-tabs { display:flex;gap:8px;flex-wrap:wrap;flex:1; }
.sg-loc-tab-wrap { display:flex;align-items:center;gap:2px; }
.sg-loc-rename {
    width:26px;height:26px;border-radius:7px;border:none;background:rgba(255,255,255,.2);
    color:rgba(255,255,255,.85);font-size:.75rem;cursor:pointer;
    display:flex;align-items:center;justify-content:center;transition:background .15s;
    flex-shrink:0;
}
.sg-loc-rename:hover { background:rgba(255,255,255,.35); }
.sg-loc-tab {
    padding:8px 16px;border-radius:10px;border:2px solid var(--border);
    background:var(--bg-raised);color:var(--text-secondary);font-size:.875rem;font-weight:600;
    cursor:pointer;transition:all .18s;white-space:nowrap;
}
.sg-loc-tab:hover { border-color:var(--primary);color:var(--primary); }
.sg-loc-tab.active { border-color:var(--primary);background:var(--primary);color:#fff; }
.sg-loc-wh {
    font-size:.7rem;font-weight:500;
    padding:1px 6px;border-radius:8px;margin-left:4px;
    background:rgba(0,0,0,.12);color:inherit;opacity:.8;
}
.sg-loc-tab.active .sg-loc-wh {
    background:rgba(255,255,255,.3);color:#fff;opacity:1;
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
.sg-mlabel { font-size:1.1rem;font-weight:700;color:var(--text-primary);min-width:160px;text-align:center; }
.sg-tabs { display:flex;gap:4px;background:var(--bg-raised);border-radius:12px;padding:4px; }
.sg-tab {
    padding:7px 18px;border-radius:9px;border:none;background:transparent;
    color:var(--text-muted);font-size:.875rem;font-weight:600;cursor:pointer;transition:all .18s;
}
.sg-tab.active { background:var(--primary);color:#fff; }

/* Section wrapper */
.sg-section {
    background:var(--bg-surface);border:1px solid var(--border);border-radius:18px;overflow:hidden;
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
    padding:16px 20px;border-bottom:1px solid var(--border);
    background:var(--bg-raised);
}
.sg-subst-date-label {
    font-size:.95rem;font-weight:700;color:var(--text-primary);
    margin-bottom:14px;text-transform:capitalize;
}
.sg-subst-cols { display:grid;grid-template-columns:1fr 1fr;gap:16px; }
.sg-subst-col-title {
    font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
    margin-bottom:8px;
}
.sg-subst-col-title.free { color:#10b981; }
.sg-subst-col-title.busy { color:#ef4444; }
.sg-subst-person {
    display:flex;align-items:center;gap:10px;padding:8px 10px;
    border-radius:10px;margin-bottom:4px;background:var(--bg-surface);
    border:1px solid var(--border);transition:background .12s;
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
.sg-subst-name { font-size:.875rem;font-weight:600;color:var(--text-primary); }
.sg-subst-loc  { font-size:.75rem;color:var(--text-muted);margin-top:1px; }
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
.sg-scroll-wrap { overflow-x:auto; }
.sg-table { width:100%;border-collapse:collapse;min-width:600px; }
.sg-th-name {
    text-align:left;padding:10px 16px;font-size:.75rem;font-weight:700;
    text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);
    border-bottom:1px solid var(--border);background:var(--bg-raised);
    position:sticky;left:0;z-index:2;width:300px;min-width:300px;max-width:300px;white-space:nowrap;
}
.sg-th-day {
    padding:6px 2px;text-align:center;min-width:32px;width:32px;
    border-bottom:1px solid var(--border);border-left:1px solid var(--border-light,rgba(255,255,255,.05));
    background:var(--bg-raised);
}
.sg-th-day.we { background:rgba(139,92,246,.06); }
.sg-day-num { font-size:.8rem;font-weight:700;color:var(--text-primary); }
.sg-day-dow { font-size:.65rem;color:var(--text-muted);margin-top:1px; }
.sg-th-sum,.sg-th-del {
    padding:8px 12px;border-bottom:1px solid var(--border);background:var(--bg-raised);
    font-size:.75rem;color:var(--text-muted);text-align:center;
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
.sg-av.sm { width:28px;height:28px;font-size:.7rem; }
.sg-av img { width:100%;height:100%;object-fit:cover; }
.sg-cell {
    padding:3px 1px;text-align:center;border-bottom:1px solid var(--border);
    border-left:1px solid var(--border-light,rgba(255,255,255,.05));
    cursor:pointer;transition:background .12s;height:48px;vertical-align:middle;
    width:36px;min-width:36px;
}
.sg-cell.we { background:rgba(139,92,246,.04); }
.sg-cell:hover { background:var(--bg-hover); }
.sg-badge {
    display:inline-flex;flex-direction:column;align-items:center;
    padding:2px 4px;border-radius:6px;font-size:.72rem;font-weight:700;min-width:22px;line-height:1.3;
}
.sg-badge small { font-size:.6rem;font-weight:500;opacity:.85; }
.sg-td-sum {
    text-align:center;padding:10px 8px;border-bottom:1px solid var(--border);
    font-weight:700;color:var(--text-primary);font-size:.875rem;
}
.sg-td-del { text-align:center;padding:6px;border-bottom:1px solid var(--border); }
.sg-rm {
    width:28px;height:28px;border-radius:8px;border:none;background:transparent;
    color:var(--text-muted);cursor:pointer;font-size:.8rem;
    display:inline-flex;align-items:center;justify-content:center;transition:all .15s;
}
.sg-rm:hover { background:rgba(239,68,68,.12);color:#ef4444; }
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
            .select('id, name')
            .in('id', locIds);
        const locs = lData || [];

        this._assignments = assignRows.map(a => ({
            locId:   a.location_id,
            locName: locs.find(l => l.id === a.location_id)?.name || 'Локація'
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
            cells.push(`
<div class="sge-day${we?' we':''}${isToday?' today':''}${shift?' has-shift':''}"
    onclick="ScheduleGraphEmployee._openCell('${dateStr}')"
    title="${shift ? shift.label : 'Додати запис'}">
    <div class="sge-day-top">
        <span class="sge-day-num${isToday?' cur':''}">${d}</span>
        <span class="sge-day-dow">${['Пн','Вт','Ср','Чт','Пт','Сб','Нд'][dow]}</span>
    </div>
    ${shift
        ? `<div class="sge-badge" style="background:${shift.bg};color:${shift.color}">${shift.short} <span>${shift.label}</span></div>`
        : `<div class="sge-no-entry">+</div>`}
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
@media(max-width:600px){
    .sge-grid { gap:3px;padding:4px 6px 12px; }
    .sge-day { min-height:64px;padding:5px; }
    .sge-badge span { display:none; }
}
</style>`;
    },

    _openCell(date) {
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
