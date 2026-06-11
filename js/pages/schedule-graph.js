// ================================================================
// EduFlow LMS — Графік роботи ломбарду
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
// CREATE POLICY "sassign_update" ON schedule_assignments FOR UPDATE USING (true);
// CREATE POLICY "sassign_delete" ON schedule_assignments FOR DELETE USING (true);
// ALTER TABLE schedule_assignments ADD COLUMN IF NOT EXISTS employee_name text;
// ALTER TABLE schedule_assignments ALTER COLUMN user_id DROP NOT NULL;
// ALTER TABLE schedule_assignments DROP CONSTRAINT IF EXISTS schedule_assignments_user_id_fkey;
// ALTER TABLE schedule_assignments ADD CONSTRAINT schedule_assignments_user_id_fkey
//     FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
// ALTER TABLE schedule_assignments ADD COLUMN IF NOT EXISTS original_user_id uuid;
// UPDATE schedule_assignments SET original_user_id = user_id WHERE original_user_id IS NULL AND user_id IS NOT NULL;
// ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_user_id_fkey;
// ALTER TABLE schedule_assignments ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT true;
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
//
// Migration: block name support
// ALTER TABLE schedule_partners ADD COLUMN IF NOT EXISTS block_name text;
//
// Migration: fix schedule_partners RLS so the block owner can update block_name
// (run in Supabase SQL editor if "Назва блоку" rename silently does nothing)
// DROP POLICY IF EXISTS "spartner_update" ON schedule_partners;
// CREATE POLICY "spartner_update" ON schedule_partners FOR UPDATE
//     USING (owner_id = auth.uid() OR partner_id = auth.uid());
//
// Migration: shift type config stored per-user in DB
// CREATE TABLE IF NOT EXISTS schedule_shift_config (
//     user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
//     config     jsonb NOT NULL DEFAULT '{}',
//     updated_at timestamptz DEFAULT now()
// );
// ALTER TABLE schedule_shift_config ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "ssc_select" ON schedule_shift_config FOR SELECT USING (user_id = auth.uid());
// CREATE POLICY "ssc_insert" ON schedule_shift_config FOR INSERT WITH CHECK (user_id = auth.uid());
// CREATE POLICY "ssc_update" ON schedule_shift_config FOR UPDATE USING (user_id = auth.uid());
// ================================================================

const SHIFT_TYPES = {
    work:     { label: 'Зміна',      short: 'З',  color: '#10b981', bg: 'rgba(16,185,129,.14)' },
    day_off:  { label: 'Підміна',    short: 'П',  color: '#8b5cf6', bg: 'rgba(139,92,246,.14)' },
    vacation: { label: 'Відпустка',  short: 'ВД', color: '#f59e0b', bg: 'rgba(245,158,11,.14)' },
    sick:     { label: 'Лікарняний', short: 'Л',  color: '#ef4444', bg: 'rgba(239,68,68,.14)' },
};
const SUB_CONFIRMED = { label: 'Підміна', short: 'Р', color: '#f97316', bg: 'rgba(249,115,22,.14)' };
// Flag notes that indicate a request, not a confirmed work shift
const _FLAG_NOTES = ['__sub__', '__needsub__'];
const _isRealShift = e => ['work','day_off'].includes(e?.shift_type) && !_FLAG_NOTES.includes(e?.notes);

const _BUILTIN_SHIFT_KEYS = ['work','day_off','vacation','sick'];
function getShiftTypeEntries() {
    const t = getShiftTypes();
    const builtin = _BUILTIN_SHIFT_KEYS.filter(k => t[k]).map(k => [k, t[k]]);
    const custom  = Object.entries(t).filter(([k]) => !_BUILTIN_SHIFT_KEYS.includes(k));
    return [...builtin, ...custom];
}

function _sgHexToRgba(hex, alpha) {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
}

let _cachedShiftTypes = null;
function getShiftTypes() {
    return _cachedShiftTypes || { ...SHIFT_TYPES };
}

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
    _filteredUserId:      null,
    _collapsedLocs:       new Set(),
    _pastMonthUnlocked:   false,
    _locSortAlpha:        false,
    _locCreators:         {},

    async init(container) {
        this._container = container;
        this._locSortAlpha = !!localStorage.getItem('sg_loc_sort_alpha');

        if (!AppState.isManager() && !AppState.isAdmin() && !AppState.isOwner()) {
            await ScheduleGraphEmployee.init(container);
            return;
        }

        UI.setBreadcrumb([
            { label: 'Розділ планування', route: 'scheduler' },
            { label: 'Графік роботи ломбарду' }
        ]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        await this._loadLocations();
        await this._autoLockForNewMonth();
        const myLocIds = this._locations.map(l => l.id);
        const [empCheck] = await Promise.all([
            myLocIds.length
                ? supabase.from('schedule_assignments')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', AppState.user.id)
                    .not('location_id', 'in', `(${myLocIds.join(',')})`)
                : supabase.from('schedule_assignments')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', AppState.user.id),
            this._loadHelpLocIds(),
            this._loadDeletedLocations(),
            this._loadPartners(),
            this._loadShiftConfig()
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
        let query = supabase.from('schedule_locations')
            .select('*').is('deleted_at', null).order('created_at');
        if (!AppState.isOwner()) query = query.eq('created_by', AppState.user.id);
        const { data } = await query;
        this._locations = data || [];
        this._applyLocOrder();
        if (AppState.isOwner() && this._locations.length) {
            const ids = [...new Set(this._locations.map(l => l.created_by).filter(Boolean))];
            if (ids.length) {
                const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
                this._locCreators = {};
                (profs || []).forEach(p => { this._locCreators[p.id] = p.full_name; });
            }
        }
    },

    async _autoLockForNewMonth() {
        const now = new Date();
        const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
        const storageKey = `sg_autolock_${AppState.user.id}`;
        if (localStorage.getItem(storageKey) === currentKey) return;
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthKey = this._monthKey(prev.getFullYear(), prev.getMonth());
        const tolock = this._locations.filter(l =>
            l.created_by === AppState.user.id &&
            !(l.locked_months || []).includes(prevMonthKey)
        );
        if (tolock.length) {
            await Promise.all(tolock.map(l => {
                const newMonths = [...(l.locked_months || []), prevMonthKey];
                return supabase.from('schedule_locations')
                    .update({ locked_months: newMonths })
                    .eq('id', l.id)
                    .then(() => { l.locked_months = newMonths; });
            }));
        }
        localStorage.setItem(storageKey, currentKey);
    },

    _isViewOnlyLoc(locId) {
        if (!AppState.isOwner()) return false;
        const loc = this._locations.find(l => l.id === locId);
        return !!loc && loc.created_by !== AppState.user.id;
    },

    async _loadDeletedLocations() {
        const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase.from('schedule_locations')
            .select('*')
            .gte('deleted_at', cutoff)
            .order('deleted_at', { ascending: false })
            .eq('created_by', AppState.user.id);
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

    _empOrderKey() { return `sg_emp_order_${this._locId}`; },

    _getEmpOrder() {
        try { return JSON.parse(localStorage.getItem(this._empOrderKey()) || '[]'); } catch { return []; }
    },

    _saveEmpOrder() {
        localStorage.setItem(this._empOrderKey(), JSON.stringify(this._assignments.map(a => a.id)));
    },

    _applyEmpOrder() {
        const saved = this._getEmpOrder();
        if (!saved.length) return;
        this._assignments.sort((a, b) => {
            const ai = saved.indexOf(a.id), bi = saved.indexOf(b.id);
            if (ai === -1 && bi === -1) return 0;
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        });
    },

    _moveLocation(id, dir) {
        const i = this._locations.findIndex(l => l.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= this._locations.length) return;
        [this._locations[i], this._locations[j]] = [this._locations[j], this._locations[i]];
        this._saveLocOrder();
        this._render(this._container);
    },

    _onLocDragStart(e, locId) {
        this._draggingLocId = locId;
        e.currentTarget.classList.add('sg-loc-dragging');
        e.dataTransfer.effectAllowed = 'move';
    },
    _onLocDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('sg-loc-drag-over');
    },
    _onLocDragLeave(e) {
        e.currentTarget.classList.remove('sg-loc-drag-over');
    },
    _onLocDrop(e, targetId) {
        e.preventDefault();
        e.currentTarget.classList.remove('sg-loc-drag-over');
        const fromId = this._draggingLocId;
        if (!fromId || fromId === targetId) return;
        const arr  = this._locations;
        const from = arr.findIndex(l => l.id === fromId);
        const to   = arr.findIndex(l => l.id === targetId);
        if (from === -1 || to === -1) return;
        const [item] = arr.splice(from, 1);
        arr.splice(to, 0, item);
        this._saveLocOrder();
        this._render(this._container);
    },

    async _loadShiftConfig() {
        try {
            const { data } = await supabase.from('schedule_shift_config')
                .select('config').eq('user_id', AppState.user.id).maybeSingle();
            if (data?.config && Object.keys(data.config).length) {
                _cachedShiftTypes = data.config;
            } else {
                // Migrate from localStorage on first DB load
                try {
                    const s = localStorage.getItem('sg_shift_types');
                    if (s) {
                        _cachedShiftTypes = JSON.parse(s);
                        await supabase.from('schedule_shift_config')
                            .upsert({ user_id: AppState.user.id, config: _cachedShiftTypes }, { onConflict: 'user_id' });
                    }
                } catch(e) {}
            }
        } catch(e) {
            // Table not yet created — fall back to localStorage
            try { const s = localStorage.getItem('sg_shift_types'); if (s) _cachedShiftTypes = JSON.parse(s); } catch(e2) {}
        }
    },

    async _persistShiftConfig() {
        const { error } = await supabase.from('schedule_shift_config')
            .upsert({ user_id: AppState.user.id, config: _cachedShiftTypes }, { onConflict: 'user_id' });
        if (error) Toast.error('Помилка збереження типів', error.message);
        else localStorage.setItem('sg_shift_types', JSON.stringify(_cachedShiftTypes));
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
                .select('id, user_id, employee_name, original_user_id, is_primary')
                .eq('location_id', this._locId),
            supabase.from('schedule_entries')
                .select('*')
                .eq('location_id', this._locId)
                .gte('date', dateFrom)
                .lte('date', dateTo)
        ]);

        let assignRows = aRes.data || [];
        if (aRes.error) {
            // is_primary column may not exist yet — retry without it
            const { data: fb2, error: e2 } = await supabase.from('schedule_assignments')
                .select('id, user_id, employee_name, original_user_id').eq('location_id', this._locId);
            if (!e2) {
                assignRows = (fb2 || []).map(r => ({ ...r, is_primary: true }));
            } else {
                const { data: fb3 } = await supabase.from('schedule_assignments')
                    .select('id, user_id').eq('location_id', this._locId);
                assignRows = (fb3 || []).map(r => ({ ...r, employee_name: null, original_user_id: null, is_primary: true }));
            }
        }

        let profiles = [];
        if (assignRows.length) {
            const ids = assignRows.map(a => a.user_id).filter(Boolean);
            if (ids.length) {
                const { data: pData } = await supabase.from('profiles')
                    .select('id, full_name, avatar_url, role, label')
                    .in('id', ids);
                profiles = pData || [];
            }
        }
        this._assignments = assignRows.map(a => ({
            id: a.id, user_id: a.user_id,
            original_user_id: a.original_user_id || null,
            employee_name: a.employee_name || null,
            is_primary: a.is_primary !== false,
            profile: a.user_id ? (profiles.find(p => p.id === a.user_id) || null) : null
        }));

        // Backfill employee_name and original_user_id for rows that don't have them yet
        const needsBackfill = this._assignments.filter(a => a.user_id && a.profile &&
            (!a.employee_name || !a.original_user_id));
        if (needsBackfill.length) {
            needsBackfill.forEach(a => {
                if (!a.employee_name)    a.employee_name    = a.profile.full_name || null;
                if (!a.original_user_id) a.original_user_id = a.user_id;
            });
            await Promise.all(needsBackfill.map(a =>
                supabase.from('schedule_assignments').update({
                    employee_name:    a.employee_name,
                    original_user_id: a.original_user_id
                }).eq('id', a.id)
            ));
        }

        this._entries = {};
        (eRes.data || []).forEach(e => { this._entries[`${e.user_id}_${e.date}`] = e; });

        // Re-index entries whose user_id is null (FK was SET NULL instead of dropped)
        this._assignments.filter(a => !a.user_id && a.original_user_id).forEach(a => {
            Object.keys(this._entries).filter(k => k.startsWith('null_')).forEach(k => {
                const remapped = `${a.original_user_id}_` + k.slice(5);
                if (!this._entries[remapped]) this._entries[remapped] = this._entries[k];
            });
        });

        this._applyEmpOrder();

        // Cross-location shift badges: load real shifts of these employees in other locations (own + partner)
        this._otherLocDayOff = {};
        this._otherLocSubConf = {}; // __sub_confirmed__ entries at other locations (priority override)
        const ownOtherLocIds   = this._locations.filter(l => l.id !== this._locId).map(l => l.id);
        const partnerLocIds    = (this._partnerLocations || []).map(l => l.id);
        const otherLocIds      = [...ownOtherLocIds, ...partnerLocIds];
        const empIds = [...new Set(this._assignments.map(a => a.user_id || a.original_user_id).filter(Boolean))];
        if (otherLocIds.length && empIds.length) {
            const { data: otherE } = await supabase.from('schedule_entries')
                .select('user_id, date, location_id, shift_type, notes')
                .in('user_id', empIds)
                .in('location_id', otherLocIds)
                .gte('date', dateFrom)
                .lte('date', dateTo);
            (otherE || []).forEach(e => {
                if (!_isRealShift(e)) return;
                const key = `${e.user_id}_${e.date}`;
                const locName = this._locations.find(l => l.id === e.location_id)?.name
                    || (this._partnerLocations || []).find(l => l.id === e.location_id)?.name || '';
                if (e.notes === '__sub_confirmed__') {
                    // Confirmed substitution always takes priority
                    this._otherLocSubConf[key] = locName;
                }
                if (!this._otherLocDayOff[key]) {
                    this._otherLocDayOff[key] = locName;
                }
            });
        }
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
        <div class="sg-sidebar-resizer" onmousedown="ScheduleGraphPage._startSidebarResize(event)"></div>
        <div class="sg-content">
            ${this._locId || this._deletedLocations.length ? `
            <div class="sg-controls">
                ${this._tab !== 'trash' && this._locId ? `
                <div class="sg-month-nav">
                    <button class="sg-mnav" onclick="ScheduleGraphPage._prevMonth()"><i class="fa-solid fa-angle-left"></i></button>
                    <span class="sg-mlabel">
                        ${MONTHS_UA[this._month]} ${this._year}
                        ${(() => {
                            const now = new Date();
                            const isPast = this._year < now.getFullYear() ||
                                (this._year === now.getFullYear() && this._month < now.getMonth());
                            if (!isPast) return '';
                            if (this._pastMonthUnlocked) {
                                return `<button class="sg-past-unlock-btn sg-past-unlock-active" onclick="ScheduleGraphPage._togglePastMonthUnlock()" title="Заблокувати редагування">🔓 розблоковано</button>`;
                            }
                            return `<span class="sg-past-badge">🔒 завершено</span><button class="sg-past-unlock-btn" onclick="ScheduleGraphPage._togglePastMonthUnlock()" title="Розблокувати редагування минулого графіку">Розблокувати</button>`;
                        })()}
                    </span>
                    <button class="sg-mnav" onclick="ScheduleGraphPage._nextMonth()">›</button>
                </div>
                ` : ''}
                ${this._tab==='trash' ? `<button class="sg-tab sg-trash-tab" onclick="ScheduleGraphPage._switchTab('schedule')"><i class="fa-solid fa-arrow-left"></i> Назад</button>` : ''}
            </div>
            ${this._tab === 'trash'
                ? this._trashSection()
                : !this._locId ? '' :
                  this._locId === 'all'   ? this._allLocsSection()
                : this._tab === 'schedule' ? this._tableWithServicePanel()
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
                <button class="sg-manual-btn" onclick="ScheduleGraphPage._showManual()" style="margin-top:16px;display:inline-flex;align-items:center;gap:8px;">
                    📖 Довідка — як користуватись графіком
                </button>
            </div>
            `}
        </div>
    </div>
</div>
${this._styles()}`;
        this._initStickyScroll();
        const savedW = localStorage.getItem('sg_sidebar_w');
        if (savedW) {
            const sidebar = container.querySelector('.sg-loc-sidebar');
            if (sidebar) sidebar.style.width = savedW + 'px';
        }
    },

    _hero() {
        return `
<div class="sg-hero">
    <div class="sg-hero-inner">
        <div class="sg-hero-ico">📅</div>
        <div style="flex:1">
            <h1 class="sg-hero-title">Графік роботи ломбарду</h1>
            <p class="sg-hero-sub">Керуйте розкладом співробітників по локаціях</p>
        </div>
        ${this._isAssignedAsEmployee ? `
        <button class="sg-my-sched-btn" onclick="ScheduleGraphPage._switchToEmployee()">
            👤 Мій графік
        </button>` : ''}
    </div>
</div>`;
    },

    _showManual() {
        Modal.open({
            title: '',
            size: 'xl',
            body: `
<style>
.sg-man { font-family: 'Golos Text', system-ui, sans-serif; line-height: 1.65; font-size: 15px; color: #0e1117; }
.sg-man *,
.sg-man *::before,
.sg-man *::after { box-sizing: border-box; }
.sg-man .cover {
  background: linear-gradient(145deg,#0e1a2e 0%,#1e3a5f 55%,#163b6e 100%);
  border-radius: 12px; padding: 40px 32px 36px; text-align: center; position: relative; overflow: hidden; margin-bottom: 24px;
}
.sg-man .cover::before {
  content:''; position:absolute; inset:0;
  background: radial-gradient(ellipse 70% 120% at 80% 30%,rgba(56,189,248,.18),transparent),
              radial-gradient(ellipse 50% 60% at 20% 80%,rgba(99,102,241,.12),transparent);
}
.sg-man .cover-tag { position:relative; display:inline-block; background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.22); color:rgba(255,255,255,.75); font-size:.72rem; font-weight:600; letter-spacing:.12em; text-transform:uppercase; padding:5px 14px; border-radius:20px; margin-bottom:16px; }
.sg-man .cover-icon { position:relative; font-size:3rem; margin-bottom:12px; }
.sg-man .cover h1 { position:relative; font-size:clamp(1.3rem,3vw,2rem); font-weight:800; color:#fff; line-height:1.15; letter-spacing:-.02em; margin-bottom:10px; }
.sg-man .cover p { position:relative; color:rgba(255,255,255,.62); font-size:.9rem; }
.sg-man .toc { background:var(--bg-surface,#fff); border:1.5px solid var(--border,#e2e8f0); border-radius:12px; padding:20px 24px; margin-bottom:28px; }
.sg-man .toc-title { font-size:.75rem; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:#878b99; margin-bottom:14px; }
.sg-man .toc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:7px; }
.sg-man .toc-item { display:flex; align-items:center; gap:9px; padding:8px 12px; border-radius:9px; text-decoration:none; color:var(--text,#2a2d36); font-size:.85rem; font-weight:500; border:1px solid transparent; transition:background .15s,color .15s; background:none; cursor:pointer; width:100%; text-align:left; font-family:inherit; }
.sg-man .toc-item:hover { background:var(--bg-hover,#f4f2ee); border-color:var(--border,#e2e8f0); color:#2563eb; }
.sg-man .toc-num { width:20px;height:20px;border-radius:5px;background:#1e3a5f;color:#fff;font-size:.6rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.sg-man .section { margin-bottom:40px; scroll-margin-top:16px; }
.sg-man .section-header { display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid var(--border,#e2e8f0); }
.sg-man .section-num { width:40px;height:40px;border-radius:10px;background:#1e3a5f;color:#fff;font-size:.8rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.sg-man .section-title { font-size:1rem;font-weight:800;color:var(--text,#0e1117);letter-spacing:-.01em; }
.sg-man .card { background:var(--bg-surface,#fff);border:1.5px solid var(--border,#e2e8f0);border-radius:12px;padding:18px 22px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,.05); }
.sg-man .card-title { font-weight:700;font-size:.92rem;color:var(--text,#0e1117);margin-bottom:8px;display:flex;align-items:center;gap:8px; }
.sg-man .card p,.sg-man .card li { color:#4a4e5c;font-size:.88rem;line-height:1.7; }
.sg-man .card ul,.sg-man .card ol { padding-left:18px;margin-top:6px; }
.sg-man .card li+li { margin-top:4px; }
.sg-man .steps { counter-reset:step;display:flex;flex-direction:column;gap:10px; }
.sg-man .step { display:flex;gap:14px;background:var(--bg-surface,#fff);border:1.5px solid var(--border,#e2e8f0);border-radius:12px;padding:16px 18px;box-shadow:0 2px 8px rgba(0,0,0,.05);counter-increment:step;position:relative;overflow:hidden; }
.sg-man .step::before { content:counter(step);position:absolute;right:14px;top:12px;font-size:2.5rem;font-weight:800;color:#e2e8f0;line-height:1;pointer-events:none; }
.sg-man .step-icon { width:36px;height:36px;border-radius:9px;background:#f4f2ee;border:1.5px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0; }
.sg-man .step-body { flex:1;min-width:0; }
.sg-man .step-body strong { display:block;font-weight:700;font-size:.88rem;color:var(--text,#0e1117);margin-bottom:3px; }
.sg-man .step-body p { color:#4a4e5c;font-size:.84rem;line-height:1.6;max-width:680px; }
.sg-man .badge { display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:6px;font-size:.73rem;font-weight:700;letter-spacing:.02em; }
.sg-man .badge-green  { background:rgba(5,150,105,.12);color:#047857; }
.sg-man .badge-amber  { background:rgba(217,119,6,.12);color:#b45309; }
.sg-man .badge-red    { background:rgba(220,38,38,.12);color:#b91c1c; }
.sg-man .badge-purple { background:rgba(124,58,237,.12);color:#6d28d9; }
.sg-man .badge-blue   { background:rgba(37,99,235,.12);color:#1d4ed8; }
.sg-man .badge-ink    { background:rgba(14,17,23,.08);color:#2a2d36; }
.sg-man .legend-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:9px;margin-top:10px; }
.sg-man .legend-item { display:flex;align-items:center;gap:9px;background:var(--bg-surface,#fff);border:1.5px solid var(--border,#e2e8f0);border-radius:9px;padding:10px 13px; }
.sg-man .legend-short { width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800;flex-shrink:0; }
.sg-man .legend-info strong { display:block;font-size:.84rem;font-weight:700;color:var(--text,#0e1117); }
.sg-man .legend-info span { font-size:.73rem;color:#878b99; }
.sg-man .callout { display:flex;gap:12px;border-radius:12px;padding:14px 18px;margin:14px 0;font-size:.86rem;line-height:1.65; }
.sg-man .callout-icon { font-size:1.1rem;flex-shrink:0;margin-top:1px; }
.sg-man .callout-body { color:#2a2d36; }
.sg-man .callout-body strong { color:#0e1117; }
.sg-man .callout.tip    { background:rgba(5,150,105,.07);border:1.5px solid rgba(5,150,105,.2); }
.sg-man .callout.warn   { background:rgba(217,119,6,.07);border:1.5px solid rgba(217,119,6,.2); }
.sg-man .callout.info   { background:rgba(37,99,235,.07);border:1.5px solid rgba(37,99,235,.2); }
.sg-man .callout.danger { background:rgba(220,38,38,.07);border:1.5px solid rgba(220,38,38,.2); }
.sg-man .tab-ribbon { display:flex;gap:7px;flex-wrap:wrap;margin:12px 0; }
.sg-man .tab-chip { display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:18px;font-size:.8rem;font-weight:600;background:var(--bg-surface,#fff);border:1.5px solid var(--border,#e2e8f0);color:#2a2d36; }
.sg-man .tab-chip.active { background:#1e3a5f;border-color:#1e3a5f;color:#fff; }
.sg-man .two-col { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
@media (max-width:600px) { .sg-man .two-col { grid-template-columns:1fr; } }
.sg-man .screen-mock { background:#1a2744;border-radius:12px;padding:18px;margin:14px 0;font-size:.78rem;color:rgba(255,255,255,.8);overflow:hidden; }
.sg-man .mock-bar { display:flex;align-items:center;gap:7px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.1);flex-wrap:wrap; }
.sg-man .mock-loc-name { font-weight:700;color:#fff;font-size:.83rem; }
.sg-man .mock-time { font-size:.7rem;color:rgba(255,255,255,.55);margin-left:auto; }
.sg-man .mock-table { width:100%;border-collapse:collapse;font-size:.7rem; }
.sg-man .mock-table thead,
.sg-man .mock-table thead tr { background:transparent; }
.sg-man .mock-table th { background:transparent;color:rgba(255,255,255,.5);font-weight:600;padding:4px 5px;text-align:center;border-bottom:1px solid rgba(255,255,255,.08); }
.sg-man .mock-table th.we { color:rgba(248,113,113,.7); }
.sg-man .mock-table td { padding:4px 5px;text-align:center;border-bottom:1px solid rgba(255,255,255,.05); }
.sg-man .mock-table td.name { text-align:left;color:rgba(255,255,255,.85);font-weight:600;padding-left:9px;min-width:100px; }
.sg-man .mock-badge { display:inline-block;padding:2px 6px;border-radius:4px;font-size:.66rem;font-weight:700; }
.sg-man hr { border:none;border-top:1.5px solid var(--border,#e2e8f0);margin:28px 0; }
.sg-man .cheatsheet-card { background:var(--bg-surface,#fff);border:2px solid #1e3a5f;border-radius:12px;padding:20px 24px;background:linear-gradient(135deg,rgba(30,58,95,.04),rgba(37,99,235,.04)); }
.sg-man .cheatsheet-title { font-size:1rem;font-weight:800;margin-bottom:14px;color:var(--text,#0e1117); }
.sg-man .cheat-list { list-style:none;padding:0;font-size:.86rem;color:#4a4e5c; }
.sg-man .cheat-list li { padding:4px 0;border-bottom:1px solid var(--border,#e2e8f0); }
.sg-man .cheat-list li:last-child { border-bottom:none; }
</style>
<div class="sg-man">
  <div class="cover">
    <div class="cover-tag">📋 Інструкція для керівника</div>
    <div class="cover-icon">📅</div>
    <h1>Графік роботи ломбарду</h1>
    <p>Повний посібник: управління локаціями, співробітниками, змінами, підмінами та доступом</p>
  </div>

  <nav class="toc">
    <div class="toc-title">Зміст</div>
    <div class="toc-grid">
      <button class="toc-item" onclick="document.getElementById('sgm-s1').scrollIntoView({behavior:'smooth',block:'start'})"><div class="toc-num">1</div>🏪 Локації та структура</button>
      <button class="toc-item" onclick="document.getElementById('sgm-s2').scrollIntoView({behavior:'smooth',block:'start'})"><div class="toc-num">2</div>👥 Співробітники</button>
      <button class="toc-item" onclick="document.getElementById('sgm-s3').scrollIntoView({behavior:'smooth',block:'start'})"><div class="toc-num">3</div>📆 Типи змін</button>
      <button class="toc-item" onclick="document.getElementById('sgm-s4').scrollIntoView({behavior:'smooth',block:'start'})"><div class="toc-num">4</div>✏️ Заповнення графіку</button>
      <button class="toc-item" onclick="document.getElementById('sgm-s5').scrollIntoView({behavior:'smooth',block:'start'})"><div class="toc-num">5</div>⚡ Швидке заповнення</button>
      <button class="toc-item" onclick="document.getElementById('sgm-s6').scrollIntoView({behavior:'smooth',block:'start'})"><div class="toc-num">6</div>🆘 Пошук підміни</button>
      <button class="toc-item" onclick="document.getElementById('sgm-s7').scrollIntoView({behavior:'smooth',block:'start'})"><div class="toc-num">7</div>🔒 Блокування</button>
      <button class="toc-item" onclick="document.getElementById('sgm-s8').scrollIntoView({behavior:'smooth',block:'start'})"><div class="toc-num">8</div>📋 Журнал змін</button>
      <button class="toc-item" onclick="document.getElementById('sgm-s9').scrollIntoView({behavior:'smooth',block:'start'})"><div class="toc-num">9</div>👁 Доступ для перегляду</button>
      <button class="toc-item" onclick="document.getElementById('sgm-s10').scrollIntoView({behavior:'smooth',block:'start'})"><div class="toc-num">10</div>🤝 Блок (партнерство)</button>
      <button class="toc-item" onclick="document.getElementById('sgm-s11').scrollIntoView({behavior:'smooth',block:'start'})"><div class="toc-num">11</div>🗑 Кошик</button>
      <button class="toc-item" onclick="document.getElementById('sgm-s12').scrollIntoView({behavior:'smooth',block:'start'})"><div class="toc-num">12</div>⚙️ Типи змін — налаштування</button>
    </div>
  </nav>

  <section class="section" id="sgm-s1">
    <div class="section-header"><div class="section-num">1</div><div><div class="section-title">🏪 Локації та структура</div></div></div>
    <div class="card"><div class="card-title">🗺️ Що таке локація?</div><p>Локація — це окремий підрозділ або точка роботи (магазин, відділення ломбарду). Для кожної локації ведеться окремий графік зі своїм переліком співробітників.</p></div>
    <div class="steps">
      <div class="step"><div class="step-icon">➕</div><div class="step-body"><strong>Додати нову локацію</strong><p>У лівій бічній панелі натисніть кнопку <strong>«+»</strong> поряд із заголовком «Локації». Введіть назву і натисніть <em>Зберегти</em>.</p></div></div>
      <div class="step"><div class="step-icon">✏️</div><div class="step-body"><strong>Перейменувати локацію</strong><p>Поряд з назвою локації натисніть кнопку олівця ✏. Змініть назву та збережіть.</p></div></div>
      <div class="step"><div class="step-icon">↕️</div><div class="step-body"><strong>Змінити порядок</strong><p>Перетягніть локацію за маркер <strong>⠿</strong> у сайдбарі. Порядок зберігається автоматично.</p></div></div>
      <div class="step"><div class="step-icon">📊</div><div class="step-body"><strong>Всі локації</strong><p>Оберіть <strong>«Всі локації»</strong> у сайдбарі — зведений вигляд усіх точок і співробітників. Можна згортати/розгортати групи.</p></div></div>
    </div>
    <div class="callout info"><div class="callout-icon">ℹ️</div><div class="callout-body"><strong>Час роботи.</strong> Для кожної локації можна вказати робочі години — клікніть олівець поряд із 🕐, задайте початок і кінець, збережіть.</div></div>
  </section>

  <hr>

  <section class="section" id="sgm-s2">
    <div class="section-header"><div class="section-num">2</div><div><div class="section-title">👥 Управління співробітниками</div></div></div>
    <div class="steps">
      <div class="step"><div class="step-icon">＋</div><div class="step-body"><strong>Додати співробітника</strong><p>Натисніть <span class="badge badge-blue">＋ Співробітник</span> у правому верхньому куті таблиці. Оберіть людину зі списку. Одну людину можна призначити до кількох локацій.</p></div></div>
      <div class="step"><div class="step-icon">↕️</div><div class="step-body"><strong>Змінити порядок рядків</strong><p>Перетягніть рядок за ручку <strong>⠿</strong> ліворуч від імені.</p></div></div>
      <div class="step"><div class="step-icon">🗑️</div><div class="step-body"><strong>Видалити співробітника</strong><p>Натисніть <span class="badge badge-red">🗑 Видалити</span> у рядку праворуч.</p></div></div>
    </div>
    <div class="callout danger"><div class="callout-icon">⚠️</div><div class="callout-body"><strong>Обов'язково!</strong> Додати співробітника можна <strong>лише якщо він зареєстрований на порталі</strong>.</div></div>
    <div class="callout tip"><div class="callout-icon">💡</div><div class="callout-body"><strong>Мій графік.</strong> Якщо ви самі призначені як співробітник — у заголовку з'явиться кнопка <strong>«👤 Мій графік»</strong> для переключення на вигляд звичайного співробітника.</div></div>
  </section>

  <hr>

  <section class="section" id="sgm-s3">
    <div class="section-header"><div class="section-num">3</div><div><div class="section-title">📆 Типи змін — позначення</div></div></div>
    <p style="color:#4a4e5c;margin-bottom:14px;font-size:.88rem;">Кожна комірка може містити один з типів позначень:</p>
    <div class="legend-grid">
      <div class="legend-item"><div class="legend-short" style="background:rgba(16,185,129,.14);color:#10b981">З</div><div class="legend-info"><strong>Зміна (робота)</strong><span>Звичайний робочий день</span></div></div>
      <div class="legend-item"><div class="legend-short" style="background:rgba(139,92,246,.14);color:#8b5cf6">П</div><div class="legend-info"><strong>Підміна</strong><span>Запланована підміна</span></div></div>
      <div class="legend-item"><div class="legend-short" style="background:rgba(249,115,22,.14);color:#f97316">Р</div><div class="legend-info"><strong>Підміна підтверджена</strong><span>Погоджена керівником</span></div></div>
      <div class="legend-item"><div class="legend-short" style="background:rgba(245,158,11,.14);color:#f59e0b">ВД</div><div class="legend-info"><strong>Відпустка</strong><span>Планова відпустка</span></div></div>
      <div class="legend-item"><div class="legend-short" style="background:rgba(239,68,68,.14);color:#ef4444">Л</div><div class="legend-info"><strong>Лікарняний</strong><span>Тимчасова непрацездатність</span></div></div>
      <div class="legend-item"><div class="legend-short" style="background:rgba(99,102,241,.14);color:#6366f1">🙋</div><div class="legend-info"><strong>Може підмінити</strong><span>Готовий вийти</span></div></div>
      <div class="legend-item"><div class="legend-short" style="background:rgba(239,68,68,.14);color:#ef4444">🆘</div><div class="legend-info"><strong>Потрібна підміна</strong><span>Критичний запит заміни</span></div></div>
    </div>
    <div class="callout info" style="margin-top:14px"><div class="callout-icon">⚙️</div><div class="callout-body"><strong>Власні типи.</strong> Ви можете додати свої типи змін. Дивіться розділ <button onclick="document.getElementById('sgm-s12').scrollIntoView({behavior:'smooth',block:'start'})" style="background:none;border:none;color:#2563eb;cursor:pointer;font-size:inherit;padding:0;text-decoration:underline">12</button>.</div></div>
  </section>

  <hr>

  <section class="section" id="sgm-s4">
    <div class="section-header"><div class="section-num">4</div><div><div class="section-title">✏️ Заповнення графіку</div></div></div>
    <div class="screen-mock">
      <div class="mock-bar"><span class="mock-loc-name">🏪 А01 м. Київ, вул. Заболотного, 20А</span><span class="mock-time">🕐 08:00 — 20:00</span></div>
      <table class="mock-table">
        <thead><tr><th style="text-align:left;padding-left:9px;style="background:rgba(16,185,129,.18);color:#10b981"">Співробітник</th><th>1<br><span style="font-size:.6rem;opacity:.6">Пн</span></th><th>2<br><span style="font-size:.6rem;opacity:.6">Вт</span></th><th>3<br><span style="font-size:.6rem;opacity:.6">Ср</span></th><th class="we">4<br><span style="font-size:.6rem">Сб</span></th><th class="we">5<br><span style="font-size:.6rem">Нд</span></th><th>6<br><span style="font-size:.6rem;opacity:.6">Пн</span></th><th style="opacity:.7">Σ</th></tr></thead>
        <tbody>
          <tr><td class="name">Іваненко О.</td><td><span class="mock-badge" style="background:rgba(16,185,129,.18);color:#10b981">З</span></td><td><span class="mock-badge" style="background:rgba(16,185,129,.18);color:#10b981">З</span></td><td></td><td></td><td></td><td><span class="mock-badge" style="background:rgba(16,185,129,.18);color:#10b981">З</span></td><td style="opacity:.7;font-weight:700;color:rgba(255,255,255,.8)">3</td></tr>
          <tr><td class="name">Петренко В.</td><td></td><td></td><td><span class="mock-badge" style="background:rgba(16,185,129,.18);color:#10b981">З</span></td><td></td><td></td><td></td><td style="opacity:.7;font-weight:700;color:rgba(255,255,255,.8)">1</td></tr>
          <tr><td class="name">Сидоренко А.</td><td></td><td><span class="mock-badge" style="background:rgba(245,158,11,.14);color:#f59e0b">ВД</span></td><td><span class="mock-badge" style="background:rgba(245,158,11,.14);color:#f59e0b">ВД</span></td><td></td><td></td><td></td><td style="opacity:.7;font-weight:700;color:rgba(255,255,255,.8)">0</td></tr>
        </tbody>
      </table>
    </div>
    <div class="steps">
      <div class="step"><div class="step-icon">🖱️</div><div class="step-body"><strong>Клікніть на комірку</strong><p>Знайдіть рядок співробітника і стовпець з потрібною датою. Клік на порожню комірку відкриє вікно редагування.</p></div></div>
      <div class="step"><div class="step-icon">📝</div><div class="step-body"><strong>Оберіть тип зміни</strong><p>У вікні оберіть тип: <span class="badge badge-green">З Зміна</span>, <span class="badge badge-purple">П Підміна</span>, <span class="badge badge-amber">ВД Відпустка</span>, <span class="badge badge-red">Л Лікарняний</span> або власний тип. Можна вказати час і нотатку.</p></div></div>
      <div class="step"><div class="step-icon">💾</div><div class="step-body"><strong>Збережіть</strong><p>Натисніть «Зберегти». Повторний клік на заповнену комірку дозволяє <strong>редагувати або видалити</strong> запис.</p></div></div>
    </div>
    <div class="callout tip"><div class="callout-icon">💡</div><div class="callout-body"><strong>Стовпець Σ.</strong> Автоматично підраховує кількість робочих змін (З) у місяці для кожного співробітника.</div></div>
    <div class="callout info"><div class="callout-icon">📅</div><div class="callout-body"><strong>Навігація по місяцях.</strong> Стрілки <strong>‹ ›</strong> поряд з назвою місяця. Минулі місяці заблоковані — натисніть «Розблокувати» для редагування.</div></div>
  </section>

  <hr>

  <section class="section" id="sgm-s5">
    <div class="section-header"><div class="section-num">5</div><div><div class="section-title">⚡ Швидке заповнення (Quick Fill)</div></div></div>
    <div class="card"><div class="card-title">⚡ Як це працює</div><p>Дозволяє масово проставляти один тип зміни, клікаючи по комірках без відкриття вікна кожного разу.</p></div>
    <div class="steps">
      <div class="step"><div class="step-icon">1️⃣</div><div class="step-body"><strong>Активуйте тип</strong><p>У панелі легенди натисніть на потрібний тип — <span class="badge badge-green">З Зміна</span>. Кнопка підсвітиться, з'явиться підказка «⚡ Швидке заповнення».</p></div></div>
      <div class="step"><div class="step-icon">2️⃣</div><div class="step-body"><strong>Клікайте на комірки</strong><p>Кожен клік на порожню комірку — миттєво записує обраний тип. Клік на заповнену (той самий тип) — видаляє.</p></div></div>
      <div class="step"><div class="step-icon">✕</div><div class="step-body"><strong>Вийдіть із режиму</strong><p>Натисніть <span class="badge badge-ink">✕ Скасувати</span> у підказці або знову клікніть на активний тип у легенді.</p></div></div>
    </div>
    <div class="callout tip"><div class="callout-icon">🚀</div><div class="callout-body">Ідеально для заповнення <strong>цілого тижня/місяця</strong> одним типом зміни.</div></div>
  </section>

  <hr>

  <section class="section" id="sgm-s6">
    <div class="section-header"><div class="section-num">6</div><div><div class="section-title">🔍 Пошук підміни</div></div></div>
    <div class="tab-ribbon"><span class="tab-chip">📅 Графік</span><span class="tab-chip active">🔄 Підміни</span><span class="tab-chip">📋 Журнал</span></div>
    <div class="card"><div class="card-title">🔄 Вкладка «Підміни»</div><p>Показує <strong>всіх співробітників з усіх локацій</strong> в одній зведеній таблиці. Зручно шукати кого можна залучити на заміну.</p></div>
    <div class="steps">
      <div class="step"><div class="step-icon">🔄</div><div class="step-body"><strong>Перейдіть на «Підміни»</strong><p>Клікніть вкладку «Підміни» вгорі. Над таблицею підказка: «🖱 Натисніть на заголовок дня щоб побачити хто може підмінити».</p></div></div>
      <div class="step"><div class="step-icon">📅</div><div class="step-body"><strong>Клікніть на заголовок дня</strong><p>Натисніть на число у шапці таблиці. Стовпець підсвітиться фіолетовим, рядки розфарбуються: <span style="background:rgba(16,185,129,.15);color:#059669;padding:1px 6px;border-radius:5px;font-weight:700">зелений = вільний</span> <span style="background:rgba(239,68,68,.12);color:#b91c1c;padding:1px 6px;border-radius:5px;font-weight:700">червоний = зайнятий</span>.</p></div></div>
      <div class="step"><div class="step-icon">🪟</div><div class="step-body"><strong>Вікно «🔍 Пошук підміни»</strong><p>Два табки: <span class="badge badge-green">🟢 Вільні</span> — без змін цього дня; <span class="badge badge-red">🔴 Зайняті</span> — вже мають зміну.</p></div></div>
      <div class="step"><div class="step-icon">👆</div><div class="step-body"><strong>Призначте підміну</strong><p>Клікніть на картку вільного співробітника → підтвердіть. Автоматично записується підміна і надходить пуш-сповіщення.</p></div></div>
    </div>
    <div class="card" style="margin-top:8px"><div class="card-title">📋 Картка співробітника містить</div><ul><li><strong>Ім'я та посада</strong></li><li><strong>Довіреності</strong> — якими точками може управляти</li><li><strong>Лічильник підмін</strong> — <span style="color:#10b981;font-weight:700">зелений ≤1</span>, <span style="color:#f59e0b;font-weight:700">жовтий 2–3</span>, <span style="color:#ef4444;font-weight:700">червоний 4+</span></li><li><strong>🙋 Пропонує підміну</strong> — позначив готовність вийти</li></ul></div>
    <div class="callout info" style="margin-top:10px"><div class="callout-icon">🆘</div><div class="callout-body"><strong>Потрібна підміна.</strong> Кнопка «🆘 Потрібна підміна» — масова розсилка пуш-повідомлень усім співробітникам. Оберіть дату і локацію.</div></div>
  </section>

  <hr>

  <section class="section" id="sgm-s7">
    <div class="section-header"><div class="section-num">7</div><div><div class="section-title">🔒 Блокування графіку</div></div></div>
    <div class="two-col">
      <div class="card"><div class="card-title">🔓 Розблокований</div><p>Співробітники <strong>можуть вносити зміни</strong> у своєму рядку.</p></div>
      <div class="card"><div class="card-title">🔒 Заблокований</div><p>Лише керівник може редагувати. Для інших — <strong>тільки перегляд</strong>.</p></div>
    </div>
    <div class="callout info" style="margin-top:8px"><div class="callout-icon">🔒</div><div class="callout-body">Кнопка замка — у рядку над таблицею праворуч від часу роботи. <strong>Автоблокування:</strong> на початку місяця попередній місяць блокується автоматично.</div></div>
    <div class="callout warn"><div class="callout-icon">⚠️</div><div class="callout-body"><strong>Минулі місяці.</strong> Для редагування натисніть «Розблокувати» під назвою місяця.</div></div>
  </section>

  <hr>

  <section class="section" id="sgm-s8">
    <div class="section-header"><div class="section-num">8</div><div><div class="section-title">📋 Журнал змін</div></div></div>
    <div class="card"><div class="card-title">📋 Що таке журнал?</div><p>Фіксує всі зміни у графіку: хто, коли і що змінив. Кожен запис: ім'я того хто змінив → співробітник → дата → стара значення → нова → точний час.</p></div>
    <div class="tab-ribbon"><span class="tab-chip">📅 Графік</span><span class="tab-chip">🔄 Підміни</span><span class="tab-chip active">📋 Журнал</span><span class="tab-chip">🗑 Кошик</span></div>
    <div class="callout tip"><div class="callout-icon">🔍</div><div class="callout-body">Зберігає хронологію: якщо хтось видалив або помилково змінив запис — ви побачите <strong>хто і коли</strong>. Журнал ведеться для поточної локації і місяця.</div></div>
  </section>

  <hr>

  <section class="section" id="sgm-s9">
    <div class="section-header"><div class="section-num">9</div><div><div class="section-title">👁 Доступ для перегляду</div></div></div>
    <div class="card"><div class="card-title">👁 Надати доступ без права редагування</div><p>Можна дати стороннім людям або іншим керівникам право <strong>переглядати</strong> ваш графік без можливості змін.</p></div>
    <div class="steps">
      <div class="step"><div class="step-icon">👁</div><div class="step-body"><strong>Натисніть «Доступ»</strong><p>Кнопка <span class="badge badge-blue">👁 Доступ</span> — у правому верхньому куті таблиці. Відкриється вікно управління доступом.</p></div></div>
      <div class="step"><div class="step-icon">➕</div><div class="step-body"><strong>Додайте користувача</strong><p>Знайдіть у списку і натисніть «Додати». Кнопки редагування для них будуть приховані.</p></div></div>
      <div class="step"><div class="step-icon">✕</div><div class="step-body"><strong>Скасувати доступ</strong><p>У тому ж вікні натисніть «✕» поряд з іменем — доступ відразу відкликається.</p></div></div>
    </div>
  </section>

  <hr>

  <section class="section" id="sgm-s10">
    <div class="section-header"><div class="section-num">10</div><div><div class="section-title">🤝 Блок — спільний пошук підміни</div></div></div>
    <div class="card"><div class="card-title">🤝 Що таке блок?</div><p>Об'єднання кількох керівників для <strong>спільного пошуку підміни</strong>. У блоці ви бачите графіки локацій партнера у своїй вкладці «Підміни» (тільки читання).</p></div>
    <div class="steps">
      <div class="step"><div class="step-icon">✉️</div><div class="step-body"><strong>Запросити партнера</strong><p>Кнопка <span class="badge badge-blue">🤝 Блок</span> у заголовку сторінки. Оберіть керівника і надішліть запит.</p></div></div>
      <div class="step"><div class="step-icon">✅</div><div class="step-body"><strong>Прийняти запит</strong><p>У вікні блоку відображається секція «📬 Вхідні запити». Натисніть «✓ Прийняти».</p></div></div>
    </div>
    <div class="callout info"><div class="callout-icon">🤝</div><div class="callout-body">Графіки партнерів позначені іконкою 🤝. Редагувати їх <strong>не можна</strong> — тільки переглядати у «Підмінах».</div></div>
  </section>

  <hr>

  <section class="section" id="sgm-s11">
    <div class="section-header"><div class="section-num">11</div><div><div class="section-title">🗑 Кошик — видалені локації</div></div></div>
    <div class="card"><div class="card-title">🗑️ Як працює кошик</div><p>Видалені локації <strong>зберігаються 2 дні</strong>. Можна відновити протягом цього часу.</p></div>
    <div class="steps">
      <div class="step"><div class="step-icon">↩️</div><div class="step-body"><strong>Відновити локацію</strong><p>Перейдіть на «🗑 Кошик», знайдіть локацію, натисніть <span class="badge badge-green">↩ Відновити</span>.</p></div></div>
      <div class="step"><div class="step-icon">🗑️</div><div class="step-body"><strong>Остаточно видалити</strong><p>Іконка 🗑️ праворуч — локація видаляється негайно і безповоротно.</p></div></div>
    </div>
    <div class="callout danger"><div class="callout-icon">⚠️</div><div class="callout-body"><strong>Увага!</strong> Через 2 дні локація видаляється <strong>автоматично</strong> разом з усіма записами.</div></div>
  </section>

  <hr>

  <section class="section" id="sgm-s12">
    <div class="section-header"><div class="section-num">12</div><div><div class="section-title">⚙️ Налаштування типів змін</div></div></div>
    <div class="card"><div class="card-title">⚙️ Власні типи змін</div><p>Крім стандартних, можна створити свої — «Навчання», «Відрядження» тощо. Кожному задається назва, скорочення та колір.</p></div>
    <div class="steps">
      <div class="step"><div class="step-icon">⚙️</div><div class="step-body"><strong>Відкрийте налаштування</strong><p>Кнопка <span class="badge badge-ink">⚙️</span> у правій частині панелі легенди.</p></div></div>
      <div class="step"><div class="step-icon">➕</div><div class="step-body"><strong>Додайте тип</strong><p>Вкажіть <strong>назву</strong>, <strong>скорочення</strong> (2–3 символи) та <strong>колір</strong>. Натисніть «Додати».</p></div></div>
      <div class="step"><div class="step-icon">🗑️</div><div class="step-body"><strong>Видалити</strong><p>Іконка кошика поряд із типом. Стандартні типи (З, П, ВД, Л) видалити <strong>не можна</strong>.</p></div></div>
    </div>
    <div class="callout info"><div class="callout-icon">💾</div><div class="callout-body">Власні типи зберігаються в базі даних і доступні у всіх локаціях.</div></div>
  </section>

  <hr>

  <section class="section">
    <div class="cheatsheet-card">
      <div class="cheatsheet-title">📌 Шпаргалка</div>
      <div class="two-col">
        <div>
          <p style="font-weight:700;margin-bottom:8px;font-size:.88rem;">Основні дії</p>
          <ul class="cheat-list">
            <li>🏪 + у сайдбарі → нова локація</li>
            <li>✏️ поряд з назвою → перейменувати</li>
            <li>🕐 + ✏️ → задати час роботи</li>
            <li>＋ Співробітник → додати людину</li>
            <li>Клік на комірку → редагувати зміну</li>
            <li>⚡ Легенда → режим швидкого заповнення</li>
          </ul>
        </div>
        <div>
          <p style="font-weight:700;margin-bottom:8px;font-size:.88rem;">Вкладки</p>
          <ul class="cheat-list">
            <li>📅 Графік → редагування локації</li>
            <li>🔄 Підміни → пошук по всіх локаціях</li>
            <li>📋 Журнал → хто і коли що змінив</li>
            <li>🗑 Кошик → відновлення видалених</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</div>`
        });
    },

    _locSidebar() {
        return `
<aside class="sg-loc-sidebar">
    <div class="sg-loc-sidebar-head">
        <span class="sg-loc-sidebar-title">Розділ локацій</span>
        <div style="display:flex;gap:4px;align-items:center">
            ${AppState.isOwner() ? `
            <button class="sg-loc-add-ico${this._locSortAlpha ? ' active' : ''}"
                onclick="ScheduleGraphPage._toggleLocSort()"
                title="${this._locSortAlpha ? 'Вимкнути сортування А→Я' : 'Сортувати А→Я'}">
                <i class="fa-solid fa-arrow-down-a-z"></i>
            </button>` : ''}
            <button class="sg-loc-add-ico" onclick="ScheduleGraphPage._addLocation()" title="Додати локацію">＋</button>
        </div>
    </div>
    <div class="sg-loc-sidebar-list"
        ondragend="ScheduleGraphPage._draggingLocId=null;document.querySelectorAll('.sg-loc-item-row.sg-loc-dragging,.sg-loc-item-row.sg-loc-drag-over').forEach(r=>r.classList.remove('sg-loc-dragging','sg-loc-drag-over'))">
        ${this._locations.length > 1 ? `
        <button class="sg-loc-item ${this._locId === 'all' ? 'active' : ''}"
            onclick="ScheduleGraphPage._selectLocation('all')">
            <span class="sg-loc-item-ico">🗂</span>
            <span class="sg-loc-item-name">Всі локації</span>
        </button>` : ''}
        ${(this._locSortAlpha ? [...this._locations].sort((a,b) => a.name.localeCompare(b.name, 'uk')) : this._locations).map(l => {
            const hasHelp = this._helpLocIds.has(l.id);
            const isActive = l.id === this._locId;
            const viewOnly = this._isViewOnlyLoc(l.id);
            return `
        <div class="sg-loc-item-row${viewOnly ? ' sg-loc-view-only' : ''}" draggable="${viewOnly ? 'false' : 'true'}"
            ondragstart="${viewOnly ? '' : `ScheduleGraphPage._onLocDragStart(event,'${l.id}')`}"
            ondragover="${viewOnly ? '' : 'ScheduleGraphPage._onLocDragOver(event)'}"
            ondragleave="${viewOnly ? '' : 'ScheduleGraphPage._onLocDragLeave(event)'}"
            ondrop="${viewOnly ? '' : `ScheduleGraphPage._onLocDrop(event,'${l.id}')`}">
            ${viewOnly ? '' : `<span class="sg-loc-drag-handle" title="Перетягнути">⠿</span>`}
            <button class="sg-loc-item ${isActive ? 'active' : ''}${hasHelp ? ' has-help' : ''}"
                onclick="ScheduleGraphPage._selectLocation('${l.id}')">
                <span class="sg-loc-item-ico">${viewOnly ? '<i class="fa-solid fa-eye"></i>' : '🏪'}</span>
                <span class="sg-loc-item-name" title="${l.name}">${l.name.slice(0,3)}</span>
                <span class="sg-loc-item-meta">
                    ${hasHelp ? `<span class="sg-loc-item-helpdot"></span>` : ''}
                    ${viewOnly ? `<span class="sg-loc-item-ro" title="Тільки перегляд"><i class="fa-solid fa-eye"></i></span>` : ''}
                </span>
            </button>
        </div>`;
        }).join('')}
    </div>
    <div class="sg-sidebar-add-loc">
        <button class="sg-sidebar-add-loc-btn" onclick="ScheduleGraphPage._addLocation()">
            <i class="fa-solid fa-plus"></i>
            <span>Додати філію</span>
        </button>
    </div>
</aside>`;
    },

    _tableSection() {
        const days = new Date(this._year, this._month + 1, 0).getDate();
        const nums = Array.from({ length: days }, (_, i) => i + 1);

        // Primary employees show every month; non-primary and fired only if they have entries this month
        const _hasEntries = a => {
            const lid = a.user_id || a.original_user_id;
            return lid && nums.some(d => this._entries[`${lid}_${this._dateStr(d)}`]);
        };
        const now = new Date();
        const isCurrentOrPastMonth = this._year < now.getFullYear() ||
            (this._year === now.getFullYear() && this._month <= now.getMonth());

        const visibleAssignments = this._assignments.filter(a => {
            if (!a.user_id) return _hasEntries(a);          // уволенный — только если есть записи
            if (a.is_primary) return true;                   // постоянный — всегда
            if (isCurrentOrPastMonth) return true;           // тимчасовий в текущем/прошлом — показывать
            return _hasEntries(a);                           // тимчасовий в будущем — только если есть записи
        });

        const workTotal = a => {
            const lid = a.user_id || a.original_user_id;
            if (!lid) return 0;
            return nums.filter(d => _isRealShift(this._entries[`${lid}_${this._dateStr(d)}`])).length;
        };

        const datesWithWork = new Set();
        visibleAssignments.forEach(a => {
            const lid = a.user_id || a.original_user_id;
            if (!lid) return;
            nums.forEach(d => {
                if (_isRealShift(this._entries[`${lid}_${this._dateStr(d)}`]))
                    datesWithWork.add(this._dateStr(d));
            });
        });

        const wh     = this._getWorkHours(this._locId);
        const wStart = wh.start || '09:00';
        const wEnd   = wh.end   || '18:00';
        const locName = this._locations.find(l => l.id === this._locId)?.name || '';
        const locked  = this._isLocked();
        const viewOnly = this._isViewOnlyLoc(this._locId);

        const loc = this._locations.find(l => l.id === this._locId);
        const creatorName = AppState.isOwner() && loc?.created_by ? (this._locCreators[loc.created_by] || null) : null;
        const trashCount = this._deletedLocations.length;
        const svcHtml = `<div class="sg-v2-card sg-v2-service">
            <div class="sg-v2-card-label">Сервіс</div>
            <div class="sg-v2-svc-list">
                <div class="sg-v2-svc-item" onclick="ScheduleGraphPage._switchTab('log')">
                    <div class="sg-v2-svc-icon" style="background:rgba(99,102,241,.12);color:#6366f1"><i class="fa-regular fa-file-lines"></i></div>
                    <div class="sg-v2-svc-body"><div class="sg-v2-svc-title">Журнал змін</div><div class="sg-v2-svc-sub">Історія всіх змін в графіку</div></div>
                    <i class="fa-solid fa-angle-right sg-v2-svc-arr"></i>
                </div>
                <div class="sg-v2-svc-item" onclick="ScheduleGraphPage._switchTab('trash')">
                    <div class="sg-v2-svc-icon" style="background:rgba(239,68,68,.12);color:#ef4444"><i class="fa-solid fa-trash"></i></div>
                    <div class="sg-v2-svc-body"><div class="sg-v2-svc-title">Кошик${trashCount ? ` <span class="sg-trash-badge">${trashCount}</span>` : ''}</div><div class="sg-v2-svc-sub">Видалені записи та співробітники</div></div>
                    <i class="fa-solid fa-angle-right sg-v2-svc-arr"></i>
                </div>
                <div class="sg-v2-svc-item" onclick="ScheduleGraphPage._goToSubst('${this._locId}')">
                    <div class="sg-v2-svc-icon" style="background:rgba(16,185,129,.12);color:#10b981"><i class="fa-solid fa-arrow-right-arrow-left"></i></div>
                    <div class="sg-v2-svc-body"><div class="sg-v2-svc-title">Пошук підміни</div><div class="sg-v2-svc-sub">Активні та заплановані підміни</div></div>
                    <i class="fa-solid fa-angle-right sg-v2-svc-arr"></i>
                </div>
                <div class="sg-v2-svc-item" onclick="ScheduleGraphPage._showManual()">
                    <div class="sg-v2-svc-icon" style="background:rgba(245,158,11,.12);color:#f59e0b"><i class="fa-solid fa-circle-info"></i></div>
                    <div class="sg-v2-svc-body"><div class="sg-v2-svc-title">Довідка</div><div class="sg-v2-svc-sub">Інструкції та підтримка</div></div>
                    <i class="fa-solid fa-angle-right sg-v2-svc-arr"></i>
                </div>
            </div>
        </div>`;

        return `
<div class="sg-section sg-section-v2">

    <div class="sg-v2-top">
        <!-- 1. Локація -->
        <div class="sg-v2-card sg-v2-loc-card">
            <div style="display:flex;align-items:center;justify-content:space-between">
                <div class="sg-v2-card-label">1. Локація</div>
                ${viewOnly ? '' : `<button class="sg-loc-del-btn" onclick="ScheduleGraphPage._deleteLocation('${this._locId}')" title="Видалити локацію"><i class="fa-solid fa-trash"></i></button>`}
            </div>
            <div class="sg-v2-loc-name">
                <span class="sg-loc-name-ico">🏪</span>
                <span class="sg-loc-name-text">${Fmt.esc(locName)}</span>
                ${viewOnly ? `<span class="sg-view-only-badge"><i class="fa-solid fa-eye"></i> Перегляд</span>` : `
                <button class="sg-loc-name-edit" onclick="ScheduleGraphPage._renameLocation('${this._locId}',${JSON.stringify(locName||'').replace(/"/g,'&quot;')})" title="Перейменувати"><i class="fa-solid fa-pen"></i></button>`}
            </div>
            ${loc?.address ? `<div class="sg-v2-loc-address"><i class="fa-solid fa-location-dot" style="color:var(--text-muted);font-size:.75rem"></i> ${Fmt.esc(loc.address)}</div>` : ''}
            ${loc?.phone ? `<div class="sg-v2-loc-address"><i class="fa-solid fa-phone" style="color:var(--text-muted);font-size:.75rem"></i> ${Fmt.esc(loc.phone)}</div>` : ''}
            ${creatorName ? `<div class="sg-v2-loc-row"><i class="fa-solid fa-user-tie" style="color:var(--text-muted)"></i> ${Fmt.esc(creatorName)}</div>` : ''}
            <div class="sg-v2-loc-row">
                <i class="fa-regular fa-clock" style="color:var(--text-muted)"></i>
                <span>Робочий час</span>
                <span class="sg-v2-loc-val" id="sg-wh-display">${wStart} — ${wEnd}</span>
                ${viewOnly ? '' : `<button class="sg-wh-edit" onclick="ScheduleGraphPage._editWorkHours()" title="Редагувати"><i class="fa-solid fa-pen"></i></button>`}
            </div>
            ${viewOnly ? '' : `
            <div class="sg-wh-inputs" id="sg-wh-inputs" style="display:none;gap:6px;align-items:center;flex-wrap:wrap;padding:.5rem 0">
                <input type="time" id="sg-wh-start" class="sg-tinput" style="width:110px">
                <span style="color:var(--text-muted)">—</span>
                <input type="time" id="sg-wh-end" class="sg-tinput" style="width:110px">
                <button class="sg-wh-save" onclick="ScheduleGraphPage._saveWorkHours()"><i class="fa-regular fa-floppy-disk"></i> Зберегти</button>
                <button class="sg-wh-cancel" onclick="ScheduleGraphPage._cancelWorkHours()">✕</button>
            </div>`}
            <div class="sg-v2-loc-row">
                <i class="fa-solid fa-users" style="color:var(--text-muted)"></i>
                <span>Співробітників</span>
                <span class="sg-v2-loc-val">${this._assignments.filter(a => a.is_primary).length}</span>
            </div>
        </div>

        <!-- 2. Управління співробітниками -->
        ${viewOnly ? '' : `
        <div class="sg-v2-card sg-v2-mgmt-card">
            <div class="sg-v2-card-label">2. Управління підмінами</div>
            <div class="sg-v2-svc-grid">
                ${(() => {
                    const needsubCnt = Object.values(this._allEntries||{}).filter(e=>e.notes==='__needsub__').length;
                    const myUids = new Set([...(this._allAssignments||[]),...(this._assignments||[])].map(a=>a.user_id).filter(Boolean));
                    const src = this._locId === 'all' ? (this._allEntries||{}) : (this._entries||{});
                    const cansubCnt = new Set(Object.values(src).filter(e=>e.notes==='__sub__'&&myUids.has(e.user_id)).map(e=>e.user_id)).size;
                    return `
                <button class="sg-svc-btn" onclick="ScheduleGraphPage._showManagerHelpModal()">
                    <div class="sg-svc-ico" style="background:rgba(239,68,68,.12);color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <div class="sg-svc-body">
                        <div class="sg-svc-title">Потрібна підміна${needsubCnt ? `<span class="sg-svc-badge">${needsubCnt}</span>` : ''}</div>
                        <div class="sg-svc-desc">Запити на пошук замінника</div>
                    </div>
                    <i class="fa-solid fa-chevron-right sg-svc-arr"></i>
                </button>
                <button class="sg-svc-btn" onclick="ScheduleGraphPage._showCanSubModal()">
                    <div class="sg-svc-ico" style="background:rgba(16,185,129,.12);color:#10b981"><i class="fa-solid fa-hand"></i></div>
                    <div class="sg-svc-body">
                        <div class="sg-svc-title">Можуть підмінити${cansubCnt ? `<span class="sg-svc-badge sg-svc-badge-green">${cansubCnt}</span>` : ''}</div>
                        <div class="sg-svc-desc">Готові вийти на заміну</div>
                    </div>
                    <i class="fa-solid fa-chevron-right sg-svc-arr"></i>
                </button>
                <button class="sg-svc-btn" onclick="ScheduleGraphPage._showSubstReportModal()">
                    <div class="sg-svc-ico" style="background:rgba(245,158,11,.12);color:#f59e0b"><i class="fa-solid fa-file-lines"></i></div>
                    <div class="sg-svc-body">
                        <div class="sg-svc-title">Звіт по підмінам</div>
                        <div class="sg-svc-desc">Всі підміни за місяць</div>
                    </div>
                    <i class="fa-solid fa-chevron-right sg-svc-arr"></i>
                </button>
                <button class="sg-svc-btn" onclick="ScheduleGraphPage._showViewersModal()">
                    <div class="sg-svc-ico" style="background:rgba(99,102,241,.12);color:#6366f1"><i class="fa-solid fa-eye"></i></div>
                    <div class="sg-svc-body">
                        <div class="sg-svc-title">Доступи</div>
                        <div class="sg-svc-desc">Хто може переглядати</div>
                    </div>
                    <i class="fa-solid fa-chevron-right sg-svc-arr"></i>
                </button>`;
                })()}
            </div>
        </div>`}
        ${svcHtml}
    </div>

    <!-- 3. Типи змін (легенда) -->
    <div class="sg-v2-legend-section">
        <div class="sg-v2-card-label">3. Типи змін (легенда)</div>
        <div class="sg-legend">
            ${getShiftTypeEntries().map(([k, v]) => `
            <button class="sg-leg-btn ${this._quickType === k ? 'active' : ''}"
                style="--lc:${v.color};--lb:${v.bg}${viewOnly ? ';cursor:default;opacity:.75' : ''}"
                ${viewOnly ? 'disabled' : `onclick="ScheduleGraphPage._setQuickType('${k}')"`}
                title="${viewOnly ? v.label : (this._quickType === k ? 'Клік щоб скасувати' : 'Клік щоб вибрати — потім тиснути комірки')}">
                <span class="sg-leg-short" style="background:${v.bg};color:${v.color}">${v.short}</span>
                ${v.label}
                ${!viewOnly && this._quickType === k ? '<span class="sg-leg-active-mark">✓ активно</span>' : ''}
            </button>`).join('')}
            ${viewOnly ? '' : `
            <button class="sg-types-mgr-btn" onclick="ScheduleGraphPage._showShiftTypesModal()" title="Налаштувати типи змін">⚙️ Налаштування</button>
            <button class="sg-lock-btn ${locked ? 'locked' : ''}" onclick="ScheduleGraphPage._toggleLock()"
                title="${locked ? 'Розблокувати редагування графіка' : 'Заблокувати редагування графіка'}">
                ${locked ? '🔒 Заблоковано' : '🔓 Редагування'}
            </button>`}
        </div>
    </div>
    ${this._quickType ? `
    <div class="sg-quick-bar">
        <span>⚡ Швидке заповнення:</span>
        <span class="sg-quick-badge" style="background:${getShiftTypes()[this._quickType].bg};color:${getShiftTypes()[this._quickType].color}">
            ${getShiftTypes()[this._quickType].short} ${getShiftTypes()[this._quickType].label}
        </span>
        <span>— натискайте на комірки для автоматичного запису</span>
        <button class="sg-quick-cancel" onclick="ScheduleGraphPage._setQuickType(null)">✕ Скасувати</button>
    </div>` : ''}


    ${!this._assignments.length ? `
    <div class="empty-state" style="margin:2rem 0">
        <div class="empty-icon">👥</div>
        <h3>Немає співробітників</h3>
        <p>Додайте першого співробітника до цього графіку</p>
        ${viewOnly ? '' : `<button class="sg-add-emp-ghost" style="margin-top:12px" onclick="ScheduleGraphPage._addEmployee()"><i class="fa-solid fa-plus"></i> Додати співробітника</button>`}
    </div>` : !visibleAssignments.length ? `
    <div class="empty-state" style="margin:2rem 0">
        <div class="empty-icon">📅</div>
        <h3>Немає змін у цьому місяці</h3>
        <p>Основних співробітників не призначено, а тимчасові не мають змін у цьому місяці</p>
        ${viewOnly ? '' : `<button class="sg-add-emp-ghost" style="margin-top:12px" onclick="ScheduleGraphPage._addEmployee()"><i class="fa-solid fa-plus"></i> Додати співробітника</button>`}
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
                        const noWork     = !datesWithWork.has(date);
                        return `<th class="sg-th-day${we?' we':''}${isHelpDate?' sg-help-col-th':''}${noWork?' sg-th-no-work':''}">
                            <div class="sg-day-num">${d}</div>
                            <div class="sg-day-dow">${DAYS_SHORT[dow]}</div>
                            ${isHelpDate ? `<div class="sg-help-col-ico">🆘</div>` : ''}
                        </th>`;
                    }).join('')}
                    <th class="sg-th-sum">
                        <div class="sg-th-sum-inner">Σ</div>
                        <div class="sg-th-sub">Дні</div>
                    </th>
                </tr>
            </thead>
            <tbody ondragend="ScheduleGraphPage._draggingEmpId=null;document.querySelectorAll('.sg-row-dragging,.sg-row-drag-over').forEach(r=>r.classList.remove('sg-row-dragging','sg-row-drag-over'))">
                ${visibleAssignments.map(a => {
                    const p = a.profile || {};
                    const initials = (p.full_name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
                    const lookupId = a.user_id || a.original_user_id;
                    const fired    = !a.user_id;
                    const cells = nums.map(d => {
                        const date  = this._dateStr(d);
                        const entry = lookupId ? this._entries[`${lookupId}_${date}`] : null;
                        const dispType = entry && !a.is_primary && entry.shift_type === 'work' ? 'day_off' : entry?.shift_type;
                        const shift = entry ? getShiftTypes()[dispType] : null;
                        const dow   = new Date(this._year, this._month, d).getDay();
                        const we    = dow === 0 || dow === 6;
                        const isSubConf = entry?.notes === '__sub_confirmed__';
                        const dispShift = isSubConf ? SUB_CONFIRMED : (entry?.notes === '__sub__' ? null : shift);
                        if (fired) return `<td class="sg-cell sg-cell-fired${we?' we':''}" title="Звільнено">
                            ${dispShift ? `<span class="sg-badge" style="background:${dispShift.bg};color:${dispShift.color};opacity:.55">${dispShift.short}</span>` : ''}
                        </td>`;
                        const flagIco = entry?.notes === '__needsub__' ? '🆘' : '';
                        const subConfAt = lookupId ? (this._otherLocSubConf?.[`${lookupId}_${date}`] || null) : null;
                        const otherLocName = (!subConfAt && (!entry || entry?.notes === '__sub__') && lookupId) ? (this._otherLocDayOff?.[`${lookupId}_${date}`] || null) : null;
                        const noWork = !datesWithWork.has(date);
                        return `<td class="sg-cell${we?' we':''}${entry?.notes==='__needsub__'?' sg-needsub-cell':''}${noWork?' sg-cell-no-work':''}${viewOnly?' sg-cell-partner':''}${!a.is_primary && dispShift && !subConfAt?' sg-cell-sub':''}"
                            data-uid="${a.user_id}" data-date="${date}"
                            ${viewOnly ? '' : `onclick="ScheduleGraphPage._openCell('${a.user_id}','${date}')"`}
                            title="${entry?.notes==='__needsub__' ? 'Потрібна підміна' : subConfAt ? `Підміна у «${subConfAt}»` : isSubConf ? 'Підтверджена підміна' : shift ? shift.label : otherLocName ? `Підміна у «${otherLocName}»` : viewOnly ? '' : 'Клік щоб додати'}">
                            ${flagIco
                                ? `<span class="sg-flag-cell">${flagIco}</span>`
                                : subConfAt ? `<span class="sg-other-loc-badge">${subConfAt.slice(0,3)}</span>`
                                : dispShift ? `<span class="sg-badge" style="background:${dispShift.bg};color:${dispShift.color}">${dispShift.short}</span>`
                                : otherLocName ? `<span class="sg-other-loc-badge">${otherLocName.slice(0,3)}</span>` : ''}
                        </td>`;
                    }).join('');

                    return `<tr draggable="true"
                        data-assign-id="${a.id}"
                        ondragstart="ScheduleGraphPage._onEmpDragStart(event,'${a.id}')"
                        ondragover="ScheduleGraphPage._onEmpDragOver(event)"
                        ondragleave="ScheduleGraphPage._onEmpDragLeave(event)"
                        ondrop="ScheduleGraphPage._onEmpDrop(event,'${a.id}')">
                        ${this._nameCell(a)}
                        ${cells}
                        <td class="sg-td-sum">${workTotal(a)}</td>
                    </tr>`;
                }).join('')}
            </tbody>
            ${viewOnly ? '' : `
            <tfoot>
                <tr>
                    <td class="sg-td-add-emp" colspan="${nums.length + 2}">
                        <button class="sg-add-emp-ghost" onclick="ScheduleGraphPage._addEmployee()">
                            <i class="fa-solid fa-plus"></i> Додати співробітника
                        </button>
                    </td>
                </tr>
            </tfoot>`}
        </table>
    </div>`}

    <p class="sg-v2-hint"><i class="fa-solid fa-circle-info"></i> Клікніть по клітинці, щоб додати зміну. Використовуйте легенду типів змін вище.</p>
</div>`;
    },

    _tableWithServicePanel() {
        return this._tableSection();
    },

    _logSection() {
        const fmtDate = s => {
            const d = new Date(s);
            return d.toLocaleDateString('uk-UA') + ' ' + d.toLocaleTimeString('uk-UA', {hour:'2-digit',minute:'2-digit'});
        };
        const shiftBadge = v => {
            if (v?.request) return `<span class="sg-log-request"><i class="fa-solid fa-paper-plane"></i> Запит: «${v.message || ''}»</span>`;
            if (!v?.shift_type) return '<span class="sg-log-empty">—</span>';
            const s = getShiftTypes()[v.shift_type];
            return s ? `<span class="sg-badge" style="background:${s.bg};color:${s.color}">${s.short} ${s.label}${v.shift_start?' · '+v.shift_start.slice(0,5):''}</span>` : v.shift_type;
        };

        return `
<div class="sg-section" style="padding:14px 20px 4px">
    <div style="margin-bottom:12px">
        <button class="sg-back-btn" onclick="ScheduleGraphPage._switchTab('schedule')"><i class="fa-solid fa-arrow-left"></i> Назад</button>
    </div>
    ${!this._log.length ? `
    <div class="empty-state" style="margin:2rem 0">
        <div class="empty-icon">📋</div>
        <h3>Журнал порожній</h3>
        <p>Зміни в графіку з'являться тут</p>
    </div>` : `
    <table class="sg-log-table">
        <thead>
            <tr>
                <th>Хто змінив</th>
                <th>Співробітник</th>
                <th>Дата зміни</th>
                <th>Було</th>
                <th></th>
                <th>Стало</th>
                <th>Час</th>
            </tr>
        </thead>
        <tbody>
        ${this._log.map(e => {
            const changer = Array.isArray(e.changer) ? e.changer[0] : e.changer;
            const init = (changer?.full_name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
            const isRequest = e.new_value?.request;
            return `
        <tr class="${isRequest ? 'sg-log-tr-request' : ''}">
            <td>
                <div style="display:flex;align-items:center;gap:7px">
                    <div class="sg-av sm">${init}</div>
                    <span class="sg-log-who">${Fmt.esc(changer?.full_name || 'Хтось')}</span>
                </div>
            </td>
            <td class="sg-log-emp">${Fmt.esc(e.employee_name || '—')}</td>
            <td><span class="sg-log-datecel">${e.date}</span></td>
            <td>${e.old_value ? shiftBadge(e.old_value) : '<span class="sg-log-new">—</span>'}</td>
            <td class="sg-log-arrow">→</td>
            <td>${e.new_value ? shiftBadge(e.new_value) : '<span class="sg-log-del">видалено</span>'}</td>
            <td class="sg-log-time">${fmtDate(e.changed_at)}</td>
        </tr>`;
        }).join('')}
        </tbody>
    </table>`}
</div>`;
    },

    // ── Actions ───────────────────────────────────────────────────

    _fmtPhone(input) {
        let digits = input.value.replace(/\D/g, '');
        if (!digits) { input.value = ''; return; }
        // strip leading 38 if pasted with country code
        if (digits.startsWith('380')) digits = digits.slice(2);
        else if (digits.startsWith('38') && digits.length > 10) digits = digits.slice(2);
        digits = digits.slice(0, 10);
        let r = '';
        if (digits.length > 0) r = '+38 (' + digits.slice(0, 3);
        if (digits.length > 3) r += ') ' + digits.slice(3, 6);
        if (digits.length > 6) r += '-' + digits.slice(6, 8);
        if (digits.length > 8) r += '-' + digits.slice(8, 10);
        input.value = r;
    },

    _showLocModal({ title, placeholder, value = '', address = '', phone = '', onSave }) {
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
        <label class="sg-loc-label">Назва філії</label>
        <input id="sg-loc-input" class="sg-loc-input" placeholder="${placeholder}"
            value="${value.replace(/"/g,'&quot;')}" autocomplete="off" spellcheck="false">
        <label class="sg-loc-label" style="margin-top:10px">Адреса</label>
        <input id="sg-loc-address" class="sg-loc-input" placeholder="вул. Хрещатик, 1"
            value="${address.replace(/"/g,'&quot;')}" autocomplete="off" spellcheck="false">
        <label class="sg-loc-label" style="margin-top:10px">Телефон</label>
        <input id="sg-loc-phone" class="sg-loc-input" placeholder="+38 (050) 000-00-00"
            value="${phone.replace(/"/g,'&quot;')}" autocomplete="off" spellcheck="false" maxlength="19"
            oninput="ScheduleGraphPage._fmtPhone(this)">
    </div>
    <div class="sg-modal-actions">
        <button class="sg-btn-save" id="sg-loc-save-btn"><i class="fa-regular fa-floppy-disk"></i> Зберегти</button>
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
            const addr = document.getElementById('sg-loc-address')?.value.trim() || '';
            const ph   = document.getElementById('sg-loc-phone')?.value.trim() || '';
            el.remove();
            onSave(v, addr, ph);
        };
        document.getElementById('sg-loc-save-btn').onclick = save;
        input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    },

    async _addLocation() {
        this._showLocModal({
            title: 'Нова локація',
            placeholder: 'Назва філії…',
            onSave: async (name, address, phone) => {
                const { data, error } = await supabase.from('schedule_locations')
                    .insert({ name, address: address || null, phone: phone || null, created_by: AppState.user.id })
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
        const loc = this._locations.find(l => l.id === id);
        this._showLocModal({
            title: 'Редагувати локацію',
            placeholder: 'Назва філії…',
            value: currentName,
            address: loc?.address || '',
            phone: loc?.phone || '',
            onSave: async (name, address, phone) => {
                const { error } = await supabase.from('schedule_locations')
                    .update({ name, address: address || null, phone: phone || null })
                    .eq('id', id);
                if (error) { Toast.error('Помилка', error.message); return; }
                if (loc) { loc.name = name; loc.address = address || null; loc.phone = phone || null; }
                this._render(this._container);
                Toast.success('Збережено');
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
        <div class="sg-del-modal-ico"><i class="fa-solid fa-trash"></i></div>
    </div>
    <h3 class="sg-del-modal-title">Перемістити в кошик?</h3>
    <p class="sg-del-modal-desc">Локацію <strong>«${name}»</strong> буде переміщено в кошик.<br>Ви зможете відновити її протягом <strong>2 днів</strong>.</p>
    <div class="sg-del-modal-note">
        <span class="sg-del-note-ico">💡</span>
        Всі дані графіку збережуться і будуть відновлені разом з локацією
    </div>
    <div class="sg-modal-actions">
        <button class="sg-btn-cancel" onclick="document.getElementById('sg-del-confirm-modal').remove()">Скасувати</button>
        <button class="sg-del-confirm-btn" onclick="ScheduleGraphPage._confirmDeleteLocation('${id}')"><i class="fa-solid fa-trash"></i> В кошик</button>
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
        this._filteredUserId = null;
        this._showPartnerLocs = true;
        this._pastMonthUnlocked = false;
        const content   = this._container.querySelector('.sg-content');
        if (content) content.innerHTML = '<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>';
        const load = id === 'all' ? this._loadAllData() : this._loadPageData();
        load.then(() => this._render(this._container));
    },

    _onScroll(which) {
        const wrap = document.getElementById(`sg-wrap-${which}`);
        if (!wrap) return;
        const x = wrap.scrollLeft;
        wrap.querySelectorAll('.sg-td-name, .sg-th-name').forEach(el => {
            el.style.transform = `translateX(${x}px)`;
        });
    },

    _prevMonth() {
        if (this._month === 0) { this._month = 11; this._year--; } else this._month--;
        this._pastMonthUnlocked = false;
        const load = this._locId === 'all' ? this._loadAllData() : this._loadPageData();
        load.then(() => this._render(this._container));
    },

    _nextMonth() {
        if (this._month === 11) { this._month = 0; this._year++; } else this._month++;
        this._pastMonthUnlocked = false;
        const load = this._locId === 'all' ? this._loadAllData() : this._loadPageData();
        load.then(() => this._render(this._container));
    },

    _toggleLocSort() {
        this._locSortAlpha = !this._locSortAlpha;
        localStorage.setItem('sg_loc_sort_alpha', this._locSortAlpha ? '1' : '');
        this._render(this._container);
    },

    _startSidebarResize(e) {
        e.preventDefault();
        const sidebar = document.querySelector('.sg-loc-sidebar');
        if (!sidebar) return;
        const body = document.querySelector('.sg-body');
        const startX = e.clientX;
        const startW = sidebar.getBoundingClientRect().width;
        body.classList.add('sg-sidebar-resizing');
        const onMove = mv => {
            const w = Math.min(340, Math.max(80, startW + mv.clientX - startX));
            sidebar.style.width = w + 'px';
            document.documentElement.style.setProperty('--sg-sidebar-w', w + 'px');
        };
        const onUp = () => {
            body.classList.remove('sg-sidebar-resizing');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const w = parseInt(sidebar.style.width);
            if (w) localStorage.setItem('sg_sidebar_w', w);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    },

    _goToSubst(focusLocId) {
        const prevLocId = focusLocId || this._locId;
        this._locId = 'all';
        this._tab   = 'subst';
        this._substDate    = null;
        this._filteredUserId = null;
        const content = this._container.querySelector('.sg-content');
        if (content) content.innerHTML = '<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>';
        this._loadAllData().then(() => {
            this._render(this._container);
            if (prevLocId && prevLocId !== 'all') {
                // collapse all except the focused location
                this._locations.forEach(l => {
                    if (l.id !== prevLocId) {
                        this._collapsedLocs.add(l.id);
                        document.querySelectorAll(`[data-loc-rows="${l.id}"]`).forEach(tr => { tr.style.display = 'none'; });
                        const btn = document.querySelector(`[data-loc-toggle="${l.id}"]`);
                        if (btn) btn.textContent = '▼';
                        const badge = document.querySelector(`[data-loc-badge="${l.id}"]`);
                        if (badge) badge.style.display = 'inline';
                    }
                });
            }
        });
    },

    _switchTab(tab) {
        this._tab = tab;
        this._substDate = null;
        this._filteredUserId = null;
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
            supabase.from('schedule_assignments').select('id, user_id, location_id, employee_name, original_user_id, is_primary').in('location_id', locIds),
            supabase.from('schedule_entries').select('*').in('location_id', locIds).gte('date', dateFrom).lte('date', dateTo)
        ]);

        let assignRows = aRes.data || [];
        if (aRes.error) {
            // is_primary column may not exist yet — retry without it
            const { data: fb2, error: e2 } = await supabase.from('schedule_assignments')
                .select('id, user_id, location_id, employee_name, original_user_id').in('location_id', locIds);
            if (!e2) {
                assignRows = (fb2 || []).map(r => ({ ...r, is_primary: true }));
            } else {
                const { data: fb3 } = await supabase.from('schedule_assignments')
                    .select('id, user_id, location_id').in('location_id', locIds);
                assignRows = (fb3 || []).map(r => ({ ...r, employee_name: null, original_user_id: null, is_primary: true }));
            }
        }

        let profiles = [];
        if (assignRows.length) {
            const ids = [...new Set(assignRows.map(a => a.user_id).filter(Boolean))];
            if (ids.length) {
                const { data: pData } = await supabase.from('profiles').select('id, full_name, avatar_url, role, job_position, phone, manager_id').in('id', ids);
                profiles = pData || [];

                const mgrIds = [...new Set(profiles.map(p => p.manager_id).filter(Boolean))];
                const [mgrRes, dovRes] = await Promise.all([
                    mgrIds.length ? supabase.from('profiles').select('id, full_name').in('id', mgrIds) : Promise.resolve({ data: [] }),
                    supabase.from('profile_dovirenosti').select('profile_id, dovirenosti(name)').in('profile_id', ids)
                ]);

                const mgrProfiles = mgrRes.data || [];
                profiles.forEach(p => { p._managerName = mgrProfiles.find(m => m.id === p.manager_id)?.full_name || null; });

                const dovByUser = {};
                (dovRes.data || []).forEach(r => {
                    if (!dovByUser[r.profile_id]) dovByUser[r.profile_id] = [];
                    if (r.dovirenosti?.name) dovByUser[r.profile_id].push(r.dovirenosti.name);
                });
                profiles.forEach(p => { p._dovirenosti = dovByUser[p.id] || []; });
            }
        }

        this._allAssignments = assignRows.map(a => ({
            locId:            a.location_id,
            locName:          this._locations.find(l => l.id === a.location_id)?.name || '',
            id:               a.id,
            user_id:          a.user_id,
            original_user_id: a.original_user_id || null,
            employee_name:    a.employee_name || null,
            is_primary:       a.is_primary !== false,
            profile:          a.user_id ? (profiles.find(p => p.id === a.user_id) || null) : null
        }));

        // Backfill employee_name and original_user_id for rows that don't have them yet
        const needsBackfill2 = this._allAssignments.filter(a => a.user_id && a.profile &&
            (!a.employee_name || !a.original_user_id));
        if (needsBackfill2.length) {
            needsBackfill2.forEach(a => {
                if (!a.employee_name)    a.employee_name    = a.profile.full_name || null;
                if (!a.original_user_id) a.original_user_id = a.user_id;
            });
            await Promise.all(needsBackfill2.map(a =>
                supabase.from('schedule_assignments').update({
                    employee_name:    a.employee_name,
                    original_user_id: a.original_user_id
                }).eq('id', a.id)
            ));
        }

        this._allEntries = {};
        (eRes.data || []).forEach(e => { this._allEntries[`${e.location_id}_${e.user_id}_${e.date}`] = e; });

        // Per-location entry map in the same format as _entries (userId_date) — used by _allLocsSection
        // so that fired-employee lookup works identically to _tableSection
        this._entriesByLoc = {};
        (eRes.data || []).forEach(e => {
            if (!this._entriesByLoc[e.location_id]) this._entriesByLoc[e.location_id] = {};
            this._entriesByLoc[e.location_id][`${e.user_id}_${e.date}`] = e;
        });
        // Re-index null-user entries (FK was SET NULL) using original_user_id
        this._allAssignments.filter(a => !a.user_id && a.original_user_id).forEach(a => {
            const loc = this._entriesByLoc[a.locId];
            if (loc) {
                Object.keys(loc).filter(k => k.startsWith('null_')).forEach(k => {
                    const remapped = `${a.original_user_id}_` + k.slice(5);
                    if (!loc[remapped]) loc[remapped] = loc[k];
                });
            }
            const nullPfx = `${a.locId}_null_`;
            Object.keys(this._allEntries).filter(k => k.startsWith(nullPfx)).forEach(k => {
                const remapped = `${a.locId}_${a.original_user_id}_` + k.slice(nullPfx.length);
                if (!this._allEntries[remapped]) this._allEntries[remapped] = this._allEntries[k];
            });
        });

        // Sync _entries and _assignments for the currently-loaded specific location
        // so both views show consistent fresh data (not stale cache)
        if (this._locId && this._locId !== 'all') {
            this._entries     = this._entriesByLoc[this._locId] || {};
            this._assignments = this._allAssignments.filter(a => a.locId === this._locId)
                .map(a => ({ id: a.id, user_id: a.user_id, original_user_id: a.original_user_id,
                             employee_name: a.employee_name, is_primary: a.is_primary, profile: a.profile }));
        }

        // Append partner locations data (read-only, no editing)
        if ((this._partnerIds || []).length) await this._loadPartnerData();
    },

    async _loadPartnerData() {
        const p = n => String(n).padStart(2, '0');
        const dateFrom = `${this._year}-${p(this._month + 1)}-01`;
        const dateTo   = `${this._year}-${p(this._month + 1)}-${new Date(this._year, this._month + 1, 0).getDate()}`;

        const { data: pLocs } = await supabase.from('schedule_locations')
            .select('*').is('deleted_at', null)
            .in('created_by', this._partnerIds);
        this._partnerLocations = pLocs || [];
        if (!this._partnerLocations.length) return;

        const pLocIds = this._partnerLocations.map(l => l.id);
        const [paRes, peRes] = await Promise.all([
            supabase.from('schedule_assignments')
                .select('id, user_id, location_id, employee_name, original_user_id, is_primary')
                .in('location_id', pLocIds),
            supabase.from('schedule_entries').select('*')
                .in('location_id', pLocIds).gte('date', dateFrom).lte('date', dateTo)
        ]);

        const pAssignRows = paRes.data || [];
        let pProfiles = [];
        if (pAssignRows.length) {
            const ids = [...new Set(pAssignRows.map(a => a.user_id).filter(Boolean))];
            if (ids.length) {
                const { data: pd } = await supabase.from('profiles')
                    .select('id, full_name, avatar_url, role, job_position, manager_id').in('id', ids);
                pProfiles = pd || [];

                const { data: pDovData } = await supabase
                    .from('profile_dovirenosti')
                    .select('profile_id, dovirenosti(name)')
                    .in('profile_id', ids);
                const pDovByUser = {};
                (pDovData || []).forEach(r => {
                    if (!pDovByUser[r.profile_id]) pDovByUser[r.profile_id] = [];
                    if (r.dovirenosti?.name) pDovByUser[r.profile_id].push(r.dovirenosti.name);
                });
                pProfiles.forEach(p => { p._dovirenosti = pDovByUser[p.id] || []; });
            }
        }

        const locOwnerMap = {};
        this._partnerLocations.forEach(l => {
            const prof = this._partnerProfiles?.[l.created_by];
            locOwnerMap[l.id] = {
                name:  prof?.full_name    || '',
                label: prof?.job_position || ''
            };
        });

        const partnerAssignments = pAssignRows.map(a => ({
            locId:            a.location_id,
            locName:          this._partnerLocations.find(l => l.id === a.location_id)?.name || '',
            id:               a.id,
            user_id:          a.user_id,
            original_user_id: a.original_user_id || null,
            employee_name:    a.employee_name || null,
            is_primary:       a.is_primary !== false,
            profile:          a.user_id ? (pProfiles.find(pr => pr.id === a.user_id) || null) : null,
            isPartner:        true,
            partnerOwnerName:  locOwnerMap[a.location_id]?.name  || '',
            partnerOwnerLabel: locOwnerMap[a.location_id]?.label || ''
        }));
        this._allAssignments = [...this._allAssignments, ...partnerAssignments];

        (peRes.data || []).forEach(e => {
            this._allEntries[`${e.location_id}_${e.user_id}_${e.date}`] = e;
            if (!this._entriesByLoc[e.location_id]) this._entriesByLoc[e.location_id] = {};
            this._entriesByLoc[e.location_id][`${e.user_id}_${e.date}`] = e;
        });
    },

    async _loadPartners() {
        this._partnerIds            = [];
        this._partnerLocations      = [];
        this._partnerProfiles       = {};
        this._partnerRows           = [];
        this._pendingIncoming       = [];
        this._pendingOutgoing       = [];
        this._blockName             = null;   // name of the block this user owns or belongs to
        this._blockOwnerId          = null;   // uid of the block owner (may be self)
        this._isBlockOwner          = false;  // can this user rename the block?
        try {
            const uid = AppState.user.id;
            const { data: all, error } = await supabase.from('schedule_partners')
                .select('id, owner_id, partner_id, status, block_name')
                .or(`owner_id.eq.${uid},partner_id.eq.${uid}`);
            if (error) return;

            const rows = all || [];
            this._partnerRows     = rows.filter(r => r.status === 'accepted');
            this._pendingIncoming = rows.filter(r => r.status === 'pending' && r.partner_id === uid);
            this._pendingOutgoing = rows.filter(r => r.status === 'pending' && r.owner_id   === uid);

            this._partnerIds = this._partnerRows.map(r => r.owner_id === uid ? r.partner_id : r.owner_id);

            // Determine block name and ownership from accepted rows
            const acceptedRow = this._partnerRows[0] || this._pendingOutgoing[0] || null;
            if (acceptedRow) {
                this._blockName     = acceptedRow.block_name || null;
                this._blockOwnerId  = acceptedRow.owner_id;
                this._isBlockOwner  = acceptedRow.owner_id === uid;
            }

            const profileIds = [...new Set(rows.flatMap(r => [r.owner_id, r.partner_id]).filter(id => id !== uid))];
            if (profileIds.length) {
                const { data: profs } = await supabase.from('profiles')
                    .select('id, full_name, job_position').in('id', profileIds);
                this._partnerProfiles = Object.fromEntries((profs || []).map(p => [p.id, p]));
            }
        } catch(e) { /* table not yet created — silent fallback */ }
    },

    async _showPartnersModal() {
        document.getElementById('sg-partners-modal')?.remove();
        await this._loadPartners();

        const uid = AppState.user.id;
        const allProfiles = [];
        { const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
          allProfiles.push(...(data || [])); }
        this._partnerAllProfiles = allProfiles.filter(p => p.id !== uid);

        const el = document.createElement('div');
        el.id = 'sg-partners-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal sg-partners-modal-box">
    <div class="sg-mhdr">
        <div>
            <h3 style="margin:0;font-size:1.05rem">🤝 БЛОК — спільний пошук замін</h3>
            <p style="margin:4px 0 0;font-size:.78rem;color:var(--text-muted)">Об'єднавшись в блок, ви можете шукати підміни разом</p>
        </div>
        <button class="sg-mclose" onclick="document.getElementById('sg-partners-modal').remove()">✕</button>
    </div>

    <div class="sg-block-name-row">
        <span class="sg-block-name-ico">🏷</span>
        <div class="sg-block-name-content">
            <span class="sg-block-name-label">Назва блоку</span>
            <span class="sg-block-name-value">${this._blockName
                ? `<strong>${this._blockName}</strong>`
                : `<em style="opacity:.5">${this._isBlockOwner || !this._blockOwnerId ? 'Не задано' : 'Не вказана власником'}</em>`
            }</span>
        </div>
        ${this._isBlockOwner || !this._blockOwnerId && (this._partnerRows.length || this._pendingOutgoing.length) ? `
        <button class="sg-block-rename-btn" onclick="ScheduleGraphPage._renameBlock()" title="Змінити назву блоку">
            <i class="fa-solid fa-pen"></i> Змінити
        </button>` : ''}
    </div>

    ${this._pendingIncoming.length ? `
    <div class="sg-partners-section">
        <div class="sg-partners-section-title">📬 Вхідні запити (${this._pendingIncoming.length})</div>
        ${this._pendingIncoming.map(r => {
            const name = this._partnerProfiles[r.owner_id]?.full_name || r.owner_id;
            return `<div class="sg-partners-row" id="sg-prow-${r.id}">
                <div class="sg-av sm">${name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
                <div class="sg-partners-info">
                    <div class="sg-partners-name">${name}</div>
                    <div class="sg-partners-status pending">очікує відповіді</div>
                </div>
                <button class="sg-partners-accept" onclick="ScheduleGraphPage._acceptPartner('${r.id}')">✓ Прийняти</button>
                <button class="sg-partners-decline" onclick="ScheduleGraphPage._declinePartner('${r.id}')">✕</button>
            </div>`;
        }).join('')}
    </div>` : ''}

    ${this._pendingOutgoing.length ? `
    <div class="sg-partners-section">
        <div class="sg-partners-section-title">📤 Надіслані запити</div>
        ${this._pendingOutgoing.map(r => {
            const name = this._partnerProfiles[r.partner_id]?.full_name || r.partner_id;
            return `<div class="sg-partners-row" id="sg-prow-${r.id}">
                <div class="sg-av sm">${name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
                <div class="sg-partners-info">
                    <div class="sg-partners-name">${name}</div>
                    <div class="sg-partners-status pending">чекає на підтвердження</div>
                </div>
                <button class="sg-partners-del" onclick="ScheduleGraphPage._removePartner('${r.id}')" title="Скасувати запит">✕</button>
            </div>`;
        }).join('')}
    </div>` : ''}

    <div class="sg-partners-section">
        <div class="sg-partners-section-title">✅ Керівники (${this._partnerRows.length})</div>
        <div id="sg-partners-list">
        ${this._partnerRows.length ? this._partnerRows.map(r => {
            const otherId = r.owner_id === uid ? r.partner_id : r.owner_id;
            const prof = this._partnerProfiles[otherId];
            const name = prof?.full_name || otherId;
            const pos  = prof?.job_position || '';
            return `<div class="sg-partners-row" id="sg-prow-${r.id}">
                <div class="sg-av sm">${name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
                <div class="sg-partners-info">
                    <div class="sg-partners-name">${name}</div>
                    <div class="sg-partners-status accepted">${pos || 'партнер'}</div>
                </div>
                <button class="sg-partners-del" onclick="ScheduleGraphPage._removePartner('${r.id}')" title="Розірвати партнерство"><i class="fa-solid fa-trash"></i></button>
            </div>`;
        }).join('') : '<div class="sg-partners-empty">Немає активних партнерів</div>'}
        </div>
    </div>

    <div class="sg-partners-section">
        <div class="sg-partners-section-title">＋ Запросити керівника</div>
        <div class="sg-partners-add">
            <div class="sg-viewer-search-wrap">
                <input type="text" id="sg-partner-search" class="sg-viewer-search-input"
                    placeholder="🔍 Пошук за іменем…" autocomplete="off"
                    oninput="ScheduleGraphPage._filterPartnerUsers(this.value)"
                    onfocus="ScheduleGraphPage._openPartnerDropdown()"
                    onblur="setTimeout(()=>ScheduleGraphPage._closePartnerDropdown(),150)">
                <input type="hidden" id="sg-partner-user">
                <div class="sg-viewer-dropdown" id="sg-partner-dropdown">
                    ${this._partnerAllProfiles.map(p => `
                    <div class="sg-viewer-drop-item" data-id="${p.id}" data-name="${(p.full_name||'').replace(/"/g,'&quot;')}"
                        onmousedown="ScheduleGraphPage._pickPartnerUser('${p.id}',${JSON.stringify(p.full_name||p.id).replace(/"/g,'&quot;')})">
                        ${p.full_name || p.id}
                    </div>`).join('')}
                </div>
            </div>
            <button class="sg-viewers-add-btn" onclick="ScheduleGraphPage._addPartner()">🤝 Запросити</button>
        </div>
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    _openPartnerDropdown() {
        const dd    = document.getElementById('sg-partner-dropdown');
        const input = document.getElementById('sg-partner-search');
        if (!dd || !input) return;
        const rect = input.getBoundingClientRect();
        dd.style.top   = (rect.bottom + 4) + 'px';
        dd.style.left  = rect.left + 'px';
        dd.style.width = rect.width + 'px';
        dd.classList.add('open');
    },

    _closePartnerDropdown() {
        const dd = document.getElementById('sg-partner-dropdown');
        if (dd) dd.classList.remove('open');
    },

    _filterPartnerUsers(query) {
        const dd = document.getElementById('sg-partner-dropdown');
        if (!dd) return;
        this._openPartnerDropdown();
        const q = query.trim().toLowerCase();
        dd.querySelectorAll('.sg-viewer-drop-item').forEach(item => {
            const name = (item.dataset.name || '').toLowerCase();
            item.classList.toggle('hidden', q.length > 0 && !name.includes(q));
        });
        document.getElementById('sg-partner-user').value = '';
    },

    _pickPartnerUser(id, name) {
        document.getElementById('sg-partner-user').value = id;
        document.getElementById('sg-partner-search').value = name;
        this._closePartnerDropdown();
    },

    async _renameBlock() {
        const uid = AppState.user.id;
        const current = this._blockName || '';
        this._showLocModal({
            title: '<i class="fa-solid fa-pen"></i> Назва блоку',
            placeholder: 'Наприклад: Блок Центр, Мережа Південь…',
            value: current,
            onSave: async name => {
                if (name === current) return;
                // Update all schedule_partners rows where this user is owner
                const { data: updated, error } = await supabase.from('schedule_partners')
                    .update({ block_name: name })
                    .eq('owner_id', uid)
                    .select('id');
                if (error) { Toast.error('Помилка', error.message); return; }
                if (!updated?.length) {
                    Toast.error('Не вдалось зберегти', 'Запустіть міграцію SQL (spartner_update) у Supabase');
                    return;
                }
                this._blockName = name;
                Toast.success('Назву блоку змінено');
                await this._showPartnersModal();
            }
        });
    },

    async _addPartner() {
        const partnerId = document.getElementById('sg-partner-user')?.value;
        if (!partnerId) { Toast.error('Оберіть керівника зі списку'); return; }
        const uid = AppState.user.id;
        if (partnerId === uid) { Toast.error('Не можна запросити себе'); return; }

        const { error } = await supabase.from('schedule_partners').insert({
            owner_id: uid, partner_id: partnerId, status: 'pending'
        });
        if (error) {
            if (error.code === '23505') Toast.error('Запит вже надіслано');
            else Toast.error('Помилка', error.message);
            return;
        }
        const partnerName = this._partnerAllProfiles.find(p => p.id === partnerId)?.full_name || 'Керівник';
        const myName = AppState.profile?.full_name || 'Керівник';
        await supabase.from('notifications').insert({
            user_id: partnerId,
            title:   '🤝 Запит на партнерство',
            message: `${myName} запрошує вас до спільного пошуку замін`
        });
        Toast.success('Запит надіслано', partnerName);
        document.getElementById('sg-partner-search').value = '';
        document.getElementById('sg-partner-user').value   = '';
        await this._showPartnersModal();
    },

    async _acceptPartner(rowId) {
        const { error } = await supabase.from('schedule_partners')
            .update({ status: 'accepted' }).eq('id', rowId);
        if (error) { Toast.error('Помилка', error.message); return; }
        Toast.success('Партнерство прийнято');
        await this._loadPartners();
        await this._showPartnersModal();
    },

    async _declinePartner(rowId) {
        const { error } = await supabase.from('schedule_partners')
            .update({ status: 'declined' }).eq('id', rowId);
        if (error) { Toast.error('Помилка', error.message); return; }
        Toast.info('Запит відхилено');
        await this._showPartnersModal();
    },

    async _removePartner(rowId) {
        const { error } = await supabase.from('schedule_partners').delete().eq('id', rowId);
        if (error) { Toast.error('Помилка', error.message); return; }
        Toast.success('Партнерство розірвано');
        await this._loadPartners();
        await this._showPartnersModal();
    },

    _substSection() {
        const days  = new Date(this._year, this._month + 1, 0).getDate();
        const nums  = Array.from({ length: days }, (_, i) => i + 1);
        const sd    = this._substDate;

        const _locEntries = locId => this._entriesByLoc?.[locId] || {};
        const _getEntry   = (a, date) => {
            const lid = a.user_id || a.original_user_id;
            return lid ? _locEntries(a.locId)[`${lid}_${date}`] || null : null;
        };

        const _isPartnerLoc = locId => this._partnerLocations?.some(l => l.id === locId);

        // Group by location — same visibility rule as _allLocsSection
        const byLoc = {};
        this._allAssignments.forEach(a => {
            const visible = a.isPartner ? _hasEntries(a) : ((a.is_primary && a.user_id) ? true : _hasEntries(a));
            if (!visible) return;
            if (!byLoc[a.locId]) byLoc[a.locId] = { name: a.locName, members: [], isPartner: _isPartnerLoc(a.locId) };
            byLoc[a.locId].members.push(a);
        });
        const _locOrder = Object.fromEntries(this._locations.map((l, i) => [l.id, i]));

        return `
<div class="sg-section">
    <div class="sg-subst-hint">
        <span class="sg-subst-hint-text">
            🖱 Натисніть на <strong>заголовок дня</strong> щоб побачити хто може підмінити
        </span>
        ${sd ? `<button class="sg-subst-clear" onclick="ScheduleGraphPage._selectSubstDate(null)">✕ Скинути</button>` : ''}
    </div>

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
                ${Object.entries(byLoc).sort(([a],[b])=>(_locOrder[a]??999)-(_locOrder[b]??999)).map(([locId, loc]) => `
                <tr class="sg-loc-header-row${loc.isPartner?' sg-loc-header-partner':''}">
                    <td colspan="${days + 1}" class="sg-loc-group-header">
                        ${loc.isPartner?'🤝':'🏪'} ${loc.name}
                        ${(() => { const l = this._locations.find(l => l.id === locId); return (l?.address ? `<span class="sg-loc-acc-addr"><i class="fa-solid fa-location-dot"></i> ${Fmt.esc(l.address)}</span>` : '') + (l?.phone ? `<span class="sg-loc-acc-addr"><i class="fa-solid fa-phone"></i> ${Fmt.esc(l.phone)}</span>` : ''); })()}
                        ${loc.isPartner ? `<span class="sg-partner-loc-badge">${loc.members[0]?.partnerOwnerLabel||'Керівник'}: ${loc.members[0]?.partnerOwnerName||''}</span>` : ''}
                    </td>
                </tr>
                ${loc.members.map(a => {
                    const p = a.profile || {};
                    const init = (p.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
                    const fired2 = !a.user_id;
                    const cells = nums.map(d => {
                        const date  = this._dateStr(d);
                        const entry = _getEntry(a, date);
                        const dispType = entry && !a.is_primary && entry.shift_type === 'work' ? 'day_off' : entry?.shift_type;
                        const shift = entry ? getShiftTypes()[dispType] : null;
                        const dow   = new Date(this._year, this._month, d).getDay();
                        const we    = dow === 0 || dow === 6;
                        const isSd   = date === sd;
                        const type   = entry?.shift_type;
                        const isFree = sd && !type;
                        const isBusy = sd && !isFree;
                        const isSubConf = entry?.notes === '__sub_confirmed__';
                        const dispShift = isSubConf ? SUB_CONFIRMED : (entry?.notes === '__sub__' ? null : shift);
                        if (fired2) return `<td class="sg-cell sg-cell-fired${we?' we':''}${isSd?' sg-sd-col':''}" title="Звільнено">
                            ${dispShift ? `<span class="sg-badge" style="background:${dispShift.bg};color:${dispShift.color};opacity:.55">${dispShift.short}</span>` : ''}
                        </td>`;
                        const flagIco = entry?.notes === '__needsub__' ? '🆘' : '';
                        const cellTitle = a.isPartner ? 'Локація партнера — лише перегляд'
                            : entry?.notes === '__needsub__' ? 'Потрібна підміна'
                            : isSubConf ? 'Підтверджена підміна'
                            : shift ? shift.label : '';
                        return `<td class="sg-cell${we?' we':''}${isSd?' sg-sd-col':''}${isFree?' sg-free-cell':''}${isBusy?' sg-busy-cell':''}${entry?.notes==='__needsub__'?' sg-needsub-cell':''}${a.isPartner?' sg-cell-partner':''}"
                            ${cellTitle ? `title="${cellTitle}"` : ''}>
                            ${flagIco
                                ? `<span class="sg-flag-cell">${flagIco}</span>`
                                : dispShift ? `<span class="sg-badge" style="background:${dispShift.bg};color:${dispShift.color}">${dispShift.short}</span>`
                                : isFree ? `<span class="sg-free-dot">●</span>` : ''}
                        </td>`;
                    }).join('');
                    const rowType = sd ? _getEntry(a, sd)?.shift_type : null;
                    const rowClass = sd ? (!rowType ? 'sg-row-free' : 'sg-row-busy') : '';
                    return `<tr class="${rowClass}${a.isPartner?' sg-row-partner':''}">
                        ${this._nameCell(a)}
                        ${cells}
                    </tr>`;
                }).join('')}
                <tr class="sg-loc-end-row"><td colspan="${days + 1}"></td></tr>`).join('')}
            </tbody>
        </table>
    </div>
</div>`;
    },

    _selectSubstDate(date, locId) {
        if (date) {
            if (this._isPastMonth()) { Toast.error('Місяць завершено', 'Редагування минулих місяців заблоковано'); return; }
            if (this._isLockedForLoc(locId || this._locId)) { Toast.error('Графік заблоковано', 'Розблокуйте графік перед редагуванням'); return; }
        }
        this._substDate = date;
        document.getElementById('sg-subst-modal')?.remove();
        if (date) this._openSubstModal(date);
        this._render(this._container);
    },

    _switchSubstTab(tab) {
        document.querySelectorAll('.sg-subst-tab').forEach(b => b.classList.toggle('active', b.id === `sg-stab-${tab}`));
        document.querySelectorAll('.sg-subst-tab-content').forEach(c => { c.style.display = c.id === `sg-stab-content-${tab}` ? '' : 'none'; });
    },

    _openSubstModal(date) {
        const sd = date;
        const sdLabel = new Date(sd + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', weekday: 'short' });

        const isAllLocs = this._locId === 'all';

        // Count confirmed substitutions per user this month
        const days = new Date(this._year, this._month + 1, 0).getDate();
        const subCount = {};
        for (let d = 1; d <= days; d++) {
            const dateStr = this._dateStr(d);
            this._allAssignments.forEach(a => {
                if (!a.user_id) return;
                let e;
                if (isAllLocs) {
                    e = this._allEntries[`${a.locId}_${a.user_id}_${dateStr}`];
                } else {
                    e = (this._entriesByLoc?.[a.locId] || {})[`${a.user_id}_${dateStr}`] || null;
                }
                if (e?.shift_type === 'day_off' || (!a.is_primary && e?.shift_type === 'work')) subCount[a.user_id] = (subCount[a.user_id] || 0) + 1;
            });
        }
        const getSubGroup = uid => { const n = subCount[uid] || 0; return n <= 1 ? 0 : n <= 3 ? 1 : 2; };

        // Find last real shift date per user (in current month, before sd)
        const lastShiftDate = {};
        for (let d = 1; d <= days; d++) {
            const dateStr = this._dateStr(d);
            if (sd && dateStr >= sd) continue;
            this._allAssignments.forEach(a => {
                if (!a.user_id) return;
                const e = this._allEntries[`${a.locId}_${a.user_id}_${dateStr}`]
                    || (this._entriesByLoc?.[a.locId] || {})[`${a.user_id}_${dateStr}`] || null;
                if (_isRealShift(e)) lastShiftDate[a.user_id] = dateStr;
            });
        }

        // Check if last shift was yesterday or today (recently worked)
        const todayStr = this._dateStr(new Date().getDate());
        const _pad = n => String(n).padStart(2, '0');
        const yesterday = (() => {
            const y = new Date(); y.setDate(y.getDate() - 1);
            return `${y.getFullYear()}-${_pad(y.getMonth()+1)}-${_pad(y.getDate())}`;
        })();
        const recentlyWorked = uid => {
            const d = lastShiftDate[uid];
            return d && (d >= yesterday);
        };

        let freeList = [], busyList = [];
        const seenUids = new Set();
        this._allAssignments.forEach(a => {
            if (!a.user_id || seenUids.has(a.user_id)) return;
            seenUids.add(a.user_id);
            const isBusy = this._allAssignments
                .filter(a2 => a2.user_id === a.user_id)
                .some(a2 => {
                    const e = this._allEntries[`${a2.locId}_${a2.user_id}_${sd}`]
                        || (this._entriesByLoc?.[a2.locId] || {})[`${a2.user_id}_${sd}`]
                        || null;
                    return _isRealShift(e);
                });
            (isBusy ? busyList : freeList).push(a);
        });

        const today = new Date(); today.setHours(0,0,0,0);
        const daysSinceLastShift = uid => {
            const d = lastShiftDate[uid];
            if (!d) return 9999; // ніколи не працював — найвище
            const diff = today - new Date(d + 'T00:00:00');
            return Math.round(diff / 86400000);
        };
        const sortBySubCount = list => list.slice().sort((a, b) => {
            // More days since last shift → higher (smaller days = more recent = bottom)
            const da = daysSinceLastShift(a.user_id);
            const db = daysSinceLastShift(b.user_id);
            if (da !== db) return db - da; // більше днів → вище
            return getSubGroup(a.user_id) - getSubGroup(b.user_id);
        });
        freeList = sortBySubCount(freeList);
        busyList = sortBySubCount(busyList);

        const renderPerson = (a, isFree) => {
            let entry;
            if (isAllLocs) {
                entry = this._allEntries[`${a.locId}_${a.user_id}_${sd}`];
            } else {
                const locEntries = this._entriesByLoc?.[a.locId] || {};
                entry = locEntries[`${a.user_id}_${sd}`] || null;
            }
            const dispShiftType = entry && !a.is_primary && entry.shift_type === 'work' ? 'day_off' : entry?.shift_type;
            const shift        = entry ? getShiftTypes()[dispShiftType] : null;
            const wantsSub     = entry?.notes === '__sub__';
            const needsSub     = entry?.notes === '__needsub__';
            const isPartner    = !!a.isPartner;
            const initials     = (a.profile?.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
            const name         = a.profile?.full_name || a.employee_name || 'Невідомо';
            const cnt          = subCount[a.user_id] || 0;
            const cntColor     = cnt <= 1 ? '#10b981' : cnt <= 3 ? '#f59e0b' : '#ef4444';
            const cntBadge     = `<span class="sg-sub-cnt-badge" style="background:${cntColor}1a;color:${cntColor};border-color:${cntColor}40">${cnt} підм.</span>`;
            const lastShift    = lastShiftDate[a.user_id];
            const isRecent     = recentlyWorked(a.user_id);
            const lastShiftBadge = lastShift
                ? `<span class="sg-sub-last-shift${isRecent ? ' sg-sub-last-recent' : ''}" title="Остання зміна">
                    <i class="fa-regular fa-calendar"></i> Остання зміна: ${lastShift === todayStr ? 'сьогодні' : lastShift === yesterday ? 'вчора' : Fmt.dateShort(new Date(lastShift + 'T00:00:00'))}
                   </span>`
                : '';
            const position     = a.profile?.job_position || '';
            const managerName  = a.profile?._managerName || '';
            const dovirenosti  = a.profile?._dovirenosti || [];
            const phone        = a.profile?.phone || '';
            const badge        = shift
                ? `<span class="sg-badge" style="background:${shift.bg};color:${shift.color};margin-left:auto">${shift.short}</span>`
                : '';

            const extraInfo = `
                ${managerName ? `<div class="sg-subst-meta">Керівник: <span class="sg-subst-meta-val">${managerName}</span></div>` : ''}
                ${dovirenosti.length ? `<div class="sg-subst-meta">Довіреність: <span class="sg-subst-meta-val">${dovirenosti.join(', ')}</span></div>` : ''}
                ${phone ? `<div class="sg-subst-meta">${phone}</div>` : ''}
            `;

            if (isFree) {
                const onclick = isPartner
                    ? `ScheduleGraphPage._confirmPartnerSubstitute('${a.user_id}',${JSON.stringify(name||'').replace(/"/g,'&quot;')})`
                    : `ScheduleGraphPage._assignSubstitute('${a.user_id}')`;
                return `<div class="sg-subst-person sg-subst-free-card${wantsSub?' sg-subst-wants-sub':''}${isPartner?' sg-subst-partner':''}"
                    onclick="${onclick}" title="Натисніть щоб призначити на підміну">
                    <div class="sg-av sm">${initials}</div>
                    <div style="flex:1;min-width:0">
                        <div class="sg-subst-name">${name}</div>
                        ${position ? `<div class="sg-subst-position">${position}</div>` : ''}
                        ${extraInfo}
                        ${wantsSub ? `<div class="sg-sub-wants-badge">🙋 Пропонує підміну</div>` : ''}
                        ${lastShiftBadge}
                    </div>
                    ${cntBadge}
                    ${badge}
                    <span class="sg-subst-add-btn">+</span>
                </div>`;
            }
            return `<div class="sg-subst-person busy${needsSub?' sg-subst-needs-sub':''}${isPartner?' sg-subst-partner':''}">
                <div class="sg-av sm">${initials}</div>
                <div style="flex:1;min-width:0">
                    <div class="sg-subst-name">${name}</div>
                    ${position ? `<div class="sg-subst-position">${position}</div>` : ''}
                    ${extraInfo}
                    ${needsSub ? `<div class="sg-needsub-badge">🆘 Потрібна підміна</div>` : ''}
                </div>
                ${cntBadge}
                ${badge}
            </div>`;
        };

        document.getElementById('sg-subst-modal')?.remove();
        const el = document.createElement('div');
        el.id = 'sg-subst-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal sg-subst-modal-box">
    <div class="sg-mhdr">
        <div>
            <h3 style="margin:0;font-size:1.05rem">🔍 Пошук підміни</h3>
            <p style="margin:3px 0 0;color:var(--text-muted);font-size:.8rem;text-transform:capitalize">📅 ${sdLabel}</p>
        </div>
        <button class="sg-mclose" onclick="ScheduleGraphPage._selectSubstDate(null)">✕</button>
    </div>
    <div class="sg-subst-tabs">
        <button class="sg-subst-tab active" id="sg-stab-free" onclick="ScheduleGraphPage._switchSubstTab('free')">
            🟢 Вільні <span class="sg-stab-count">${freeList.length}</span>
        </button>
        <button class="sg-subst-tab" id="sg-stab-busy" onclick="ScheduleGraphPage._switchSubstTab('busy')">
            🔴 Зайняті <span class="sg-stab-count">${busyList.length}</span>
        </button>
    </div>
    <div class="sg-subst-tab-content" id="sg-stab-content-free">
        <div class="sg-subst-scroll sg-subst-modal-scroll">
            ${(() => {
                const own     = freeList.filter(a => !a.isPartner);
                const partner = freeList.filter(a =>  a.isPartner);
                if (!freeList.length) return '<div class="sg-subst-empty">Немає вільних співробітників</div>';
                return [
                    ...own.map(a => renderPerson(a, true)),
                    ...(partner.length ? [
                        `<div class="sg-subst-section-sep">🤝 Партнери — узгодьте заміну у їх керівника</div>`,
                        ...partner.map(a => renderPerson(a, true))
                    ] : [])
                ].join('');
            })()}
        </div>
    </div>
    <div class="sg-subst-tab-content" id="sg-stab-content-busy" style="display:none">
        <div class="sg-subst-scroll sg-subst-modal-scroll">
            ${busyList.length ? busyList.map(a => renderPerson(a, false)).join('') : '<div class="sg-subst-empty">Всі вільні</div>'}
        </div>
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) this._selectSubstDate(null); });
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

    _confirmPartnerSubstitute(userId, name) {
        const a            = this._allAssignments.find(x => x.user_id === userId);
        const managerLabel = a?.partnerOwnerLabel || 'Керівник';
        const managerName  = a?.partnerOwnerName  || '';
        const dovirenosti  = a?.profile?._dovirenosti || [];
        document.getElementById('sg-partner-confirm-modal')?.remove();
        const el = document.createElement('div');
        el.id = 'sg-partner-confirm-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal" style="max-width:400px;height:auto">
    <div class="sg-mhdr">
        <h3 style="margin:0;font-size:1rem">⚠️ Підтвердження</h3>
        <button class="sg-mclose" onclick="document.getElementById('sg-partner-confirm-modal').remove()">✕</button>
    </div>
    <p style="font-size:.88rem;line-height:1.55;margin:0 0 6px">
        Ви додаєте <strong>${name}</strong> до свого графіку.
    </p>
    <p style="font-size:.82rem;color:var(--text-muted);line-height:1.5;margin:0 0 ${dovirenosti.length ? '10px' : '20px'}">
        Цей співробітник належить до іншої локації.
        ${managerName ? `<br>${managerLabel}: <strong style="color:var(--text)">${managerName}</strong>.` : ''}
        <br>Переконайтесь, що ви попередньо погодили це з його керівником.
    </p>
    ${dovirenosti.length ? `
    <div style="font-size:.78rem;margin:0 0 20px;display:flex;flex-wrap:wrap;gap:5px">
        <span style="color:var(--text-muted);align-self:center">Довіреності:</span>
        ${dovirenosti.map(d => `<span style="background:rgba(99,102,241,.12);color:#818cf8;border:1px solid rgba(99,102,241,.25);border-radius:6px;padding:2px 8px">${d}</span>`).join('')}
    </div>` : ''}
    <div class="sg-modal-actions">
        <button class="sg-btn-save" onclick="document.getElementById('sg-partner-confirm-modal').remove();ScheduleGraphPage._assignSubstitute('${userId}')">Додати</button>
        <button class="sg-btn-cancel" onclick="document.getElementById('sg-partner-confirm-modal').remove()">Скасувати</button>
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
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
        const prof      = this._allAssignments.find(a => a.user_id === userId)?.profile;
        const isForeign = prof?.manager_id && prof.manager_id !== AppState.user.id;

        const { error } = await supabase.from('schedule_assignments')
            .insert({ location_id: locId, user_id: userId, created_by: AppState.user.id, is_primary: !isForeign });
        if (error) { Toast.error('Помилка', error.message); return; }

        if (isForeign && this._substDate) {
            await supabase.from('schedule_entries').upsert({
                location_id: locId,
                user_id:     userId,
                date:        this._substDate,
                shift_type:  'day_off',
                updated_by:  AppState.user.id,
                updated_at:  new Date().toISOString(),
            }, { onConflict: 'location_id,user_id,date' });
        }

        const loc = this._locations.find(l => l.id === locId);

        if (isForeign) {
            const dateLabel = this._substDate
                ? new Date(this._substDate + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
                : '';
            await supabase.from('notifications').insert({
                user_id:    userId,
                title:      '📅 Вас додано до графіку',
                message:    `${AppState.profile?.full_name || 'Керівник'} додав вас як підміну до локації «${loc?.name || ''}»${dateLabel ? ` на ${dateLabel}` : ''}.`,
                type:       'general',
                created_by: AppState.user.id,
            }).catch(() => {});
        }

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
                <h3 style="margin:0;font-size:1rem">${Fmt.esc(name)}</h3>
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
            onclick="ScheduleGraphPage._confirmSubstResolved('${userId}','${date}','${locId}',${isSub},${JSON.stringify(name||'').replace(/"/g,'&quot;')})">
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
                onclick="ScheduleGraphPage._applySubstShift('${originalUserId}','${date}','${locId}','${p.id}',${JSON.stringify(originalEmpName||'').replace(/"/g,'&quot;')},${JSON.stringify(p.full_name||'').replace(/"/g,'&quot;')})">
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

    async _showCanSubModal() {
        document.getElementById('sg-cansub-list-modal')?.remove();

        const myLocIds = new Set((this._locations || []).map(l => l.id));
        let myUserIds = new Set([
            ...(this._allAssignments || []),
            ...(this._assignments || []),
        ].filter(a => a.user_id && myLocIds.has(a.locId)).map(a => a.user_id));
        if (!myUserIds.size && myLocIds.size) {
            const { data: asgn } = await supabase.from('schedule_assignments')
                .select('user_id').in('location_id', [...myLocIds]).not('user_id', 'is', null);
            myUserIds = new Set((asgn || []).map(a => a.user_id));
        }

        const _p2 = n => String(n).padStart(2,'0');
        const monthFrom = `${this._year}-${_p2(this._month+1)}-01`;
        const monthTo   = `${this._year}-${_p2(this._month+1)}-${new Date(this._year,this._month+1,0).getDate()}`;
        const { data: subRows } = await supabase.from('schedule_entries')
            .select('user_id, date, location_id').eq('notes', '__sub__')
            .gte('date', monthFrom).lte('date', monthTo).order('date');

        const filtered = (subRows || []).filter(r => r.user_id && myUserIds.has(r.user_id));
        const subUserIds = [...new Set(filtered.map(r => r.user_id))];
        let profMap = {};
        if (subUserIds.length) {
            const { data: profs } = await supabase.from('profiles')
                .select('id, full_name, job_position, city').in('id', subUserIds);
            (profs || []).forEach(p => { profMap[p.id] = p; });
        }

        // confMap: userId → Map<date, locName> for confirmed substitution dates
        const confMap = {};
        const allLocs = [...(this._locations || []), ...(this._partnerLocations || [])];
        const myLocIdSet = new Set(allLocs.map(l => l.id));

        // Primary home locs per user — from schedule_assignments.is_primary=true
        const primaryLocByUser = {};
        if (subUserIds.length) {
            const { data: primAsgn } = await supabase.from('schedule_assignments')
                .select('user_id, location_id').in('user_id', subUserIds).eq('is_primary', true);
            for (const a of (primAsgn || [])) {
                if (!primaryLocByUser[a.user_id]) primaryLocByUser[a.user_id] = new Set();
                primaryLocByUser[a.user_id].add(a.location_id);
            }
        }

        const _addConf = (uid, date, locId) => {
            if (!uid || !date || !locId) return;
            if (!confMap[uid]) confMap[uid] = new Map();
            if (!confMap[uid].has(date)) {
                const lname = allLocs.find(l => l.id === locId)?.name || '';
                confMap[uid].set(date, lname);
            }
        };

        // Signal A: already-loaded entries (current month, instant)
        const _srcEntries = Object.values(this._locId === 'all' ? (this._allEntries || {}) : (this._entries || {}));
        for (const e of _srcEntries) {
            if (!subUserIds.includes(e.user_id)) continue;
            if (e.notes === '__sub_confirmed__') { _addConf(e.user_id, e.date, e.location_id); continue; }
            if (e.shift_type === 'work' && !primaryLocByUser[e.user_id]?.has(e.location_id))
                _addConf(e.user_id, e.date, e.location_id);
        }

        // Signal B: DB query for all months — no location filter so we catch subs at any location
        if (subUserIds.length) {
            const { data: dbRows } = await supabase.from('schedule_entries')
                .select('user_id, date, location_id, shift_type, notes')
                .in('user_id', subUserIds)
                .or('notes.eq.__sub_confirmed__,shift_type.eq.work');

            // Дозагружаємо назви локацій яких немає в allLocs (підміна на чужій локації)
            const knownLocIds = new Set(allLocs.map(l => l.id));
            const unknownLocIds = new Set((dbRows || []).map(r => r.location_id).filter(id => id && !knownLocIds.has(id)));
            if (unknownLocIds.size) {
                const { data: extraLocs } = await supabase.from('schedule_locations')
                    .select('id, name').in('id', [...unknownLocIds]);
                (extraLocs || []).forEach(l => allLocs.push(l));
            }

            for (const r of (dbRows || [])) {
                if (r.notes === '__sub_confirmed__') { _addConf(r.user_id, r.date, r.location_id); continue; }
                if (r.shift_type === 'work' && !primaryLocByUser[r.user_id]?.has(r.location_id))
                    _addConf(r.user_id, r.date, r.location_id);
            }
        }

        // Build locName map: userId → primary location name
        const allAsgn = [...(this._allAssignments || []), ...(this._assignments || [])];
        const locNameMap = {};
        for (const a of allAsgn) {
            if (!a.user_id) continue;
            if (a.is_primary !== false && !locNameMap[a.user_id]) locNameMap[a.user_id] = a.locName || '';
        }
        for (const a of allAsgn) {
            if (!a.user_id || locNameMap[a.user_id]) continue;
            locNameMap[a.user_id] = a.locName || '';
        }

        const byUser = {};
        for (const r of filtered) {
            const prof = profMap[r.user_id];
            if (!prof) continue;
            if (!byUser[r.user_id]) byUser[r.user_id] = { prof, dates: [], locName: locNameMap[r.user_id] || '' };
            byUser[r.user_id].dates.push(r.date);
        }
        const candidates = Object.entries(byUser);

        const el = document.createElement('div');
        el.id = 'sg-cansub-list-modal';
        el.className = 'sg-overlay';

        const todayStr = (() => { const n = new Date(); const p = x => String(x).padStart(2,'0'); return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}`; })();
        const renderRows = (list) => list.map(([uid, { prof, dates, locName }]) => {
            const ini = (prof.full_name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            const col = this._avatarColor(uid);
            const userConf = confMap[uid] || new Map();
            const chips = dates.sort().map(d => {
                const confLoc = userConf.get(d);
                const confirmed = confLoc !== undefined;
                const past = d <= todayStr;
                const label = new Date(d + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
                if (confirmed) return `<span class="sg-csl-chip sg-csl-chip--conf" title="Був на підміні${confLoc ? ' · ' + confLoc : ''}">✓ ${label}${confLoc ? `<span class="sg-csl-chip-loc"> · ${Fmt.esc(confLoc)}</span>` : ''}</span>`;
                if (past)      return '';
                return             `<span class="sg-csl-chip sg-csl-chip--future">${label}</span>`;
            }).join('');
            const pos  = prof.job_position ? `<span class="sg-csl-pos">${Fmt.esc(prof.job_position)}</span>` : '';
            const city = prof.city ? `<span class="sg-csl-city"><i class="fa-solid fa-location-dot"></i> ${Fmt.esc(prof.city)}</span>` : '';
            const loc  = locName  ? `<span class="sg-csl-loc"><i class="fa-solid fa-store"></i> ${Fmt.esc(locName)}</span>` : '';
            return `<div class="sg-csl-row" data-name="${Fmt.esc((prof.full_name || '').toLowerCase())}">
                <div class="sg-av sg-csl-av" style="background:${col}">${ini}</div>
                <div class="sg-csl-info">
                    <div class="sg-csl-name">${Fmt.esc(prof.full_name || '')}</div>
                    <div class="sg-csl-meta">${loc}${pos}${city}</div>
                    <div class="sg-csl-chips">${chips}</div>
                </div>
            </div>`;
        }).join('');

        const emptyHtml = `<div class="sg-csl-empty">
            <div class="sg-csl-empty-ico">🙋</div>
            <div>Жоден співробітник не позначив готовність до підміни</div>
        </div>`;

        el.innerHTML = `
<div class="sg-modal sg-csl-modal">
    <div class="sg-csl-header">
        <div class="sg-csl-title-row">
            <span class="sg-csl-title">🙋 Можуть підмінити</span>
            <span class="sg-csl-count">${candidates.length}</span>
            <button class="sg-mclose" onclick="document.getElementById('sg-cansub-list-modal').remove()">✕</button>
        </div>
        ${candidates.length > 4 ? `<div class="sg-csl-search-wrap">
            <i class="fa-solid fa-magnifying-glass sg-csl-search-ico"></i>
            <input class="sg-csl-search" id="sg-csl-search" placeholder="Пошук за іменем..." oninput="ScheduleGraphPage._filterCanSub(this.value)">
        </div>` : ''}
    </div>
    <div class="sg-csl-list" id="sg-csl-list">
        ${candidates.length ? renderRows(candidates) : emptyHtml}
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    _filterCanSub(q) {
        const rows = document.querySelectorAll('#sg-csl-list .sg-csl-row');
        const s = q.trim().toLowerCase();
        rows.forEach(r => { r.style.display = (!s || r.dataset.name.includes(s)) ? '' : 'none'; });
    },

    async _showSubstReportModal() {
        document.getElementById('sg-subrep-modal')?.remove();

        // Фільтр по поточному місяцю
        const _p = n => String(n).padStart(2, '0');
        const monthFrom = `${this._year}-${_p(this._month + 1)}-01`;
        const lastDay   = new Date(this._year, this._month + 1, 0).getDate();
        const monthTo   = `${this._year}-${_p(this._month + 1)}-${_p(lastDay)}`;

        // Підміни = __sub_confirmed__ АБО робочі зміни is_primary=false співробітників
        const myLocIds = (this._locations || []).map(l => l.id);
        if (!myLocIds.length) { Toast.info('Звіт по підмінам', 'Немає локацій.'); return; }

        // Знайти всіх підмінних (is_primary=false) по локаціях менеджера
        const { data: subAssigns } = await supabase.from('schedule_assignments')
            .select('user_id, location_id')
            .in('location_id', myLocIds)
            .eq('is_primary', false);
        // Множина пар userId_locationId де людина є підмінником
        const subPairs = new Set((subAssigns || []).map(a => `${a.user_id}_${a.location_id}`));
        const subUserIds = [...new Set((subAssigns || []).map(a => a.user_id).filter(Boolean))];

        const [confRes, subShiftRes] = await Promise.all([
            // __sub_confirmed__ entries (підміни через підтвердження)
            supabase.from('schedule_entries')
                .select('user_id, date, location_id, shift_type, notes')
                .in('location_id', myLocIds)
                .gte('date', monthFrom).lte('date', monthTo)
                .eq('notes', '__sub_confirmed__')
                .order('date'),
            // Робочі зміни is_primary=false співробітників
            subUserIds.length
                ? supabase.from('schedule_entries')
                    .select('user_id, date, location_id, shift_type, notes')
                    .in('location_id', myLocIds)
                    .in('user_id', subUserIds)
                    .gte('date', monthFrom).lte('date', monthTo)
                    .eq('shift_type', 'work')
                    .order('date')
                : Promise.resolve({ data: [] })
        ]);

        // Тільки записи де user є is_primary=false САМЕ на цій локації + виключаємо технічні маркери
        const _skipNotes = new Set(['__sub__', '__needsub__']);
        const seen = new Set();
        const confRows = [];
        for (const row of [...(confRes.data || []), ...(subShiftRes.data || [])]) {
            if (_skipNotes.has(row.notes)) continue;
            // Для записів без __sub_confirmed__ — перевіряємо що це справді підмінна локація
            if (row.notes !== '__sub_confirmed__' && !subPairs.has(`${row.user_id}_${row.location_id}`)) continue;
            const key = `${row.location_id}_${row.user_id}_${row.date}`;
            if (seen.has(key)) continue;
            seen.add(key);
            confRows.push(row);
        }
        confRows.sort((a, b) => a.date.localeCompare(b.date));

        if (!confRows?.length) {
            Toast.info('Звіт по підмінам', 'Підтверджених підмін ще немає.');
            return;
        }

        const userIds = [...new Set(confRows.map(r => r.user_id).filter(Boolean))];
        const { data: profs } = await supabase.from('profiles')
            .select('id, full_name, job_position, city, subdivision').in('id', userIds);
        const profMap = {};
        (profs || []).forEach(p => { profMap[p.id] = p; });

        const allLocs = [...(this._locations || []), ...(this._partnerLocations || [])];
        const knownLocIds = new Set(allLocs.map(l => l.id));
        const unknownLocIds = new Set(confRows.map(r => r.location_id).filter(id => id && !knownLocIds.has(id)));
        if (unknownLocIds.size) {
            const { data: extraLocs } = await supabase.from('schedule_locations')
                .select('id, name, address').in('id', [...unknownLocIds]);
            (extraLocs || []).forEach(l => allLocs.push(l));
        }
        const locMap = {};
        allLocs.forEach(l => { locMap[l.id] = l; });

        // Групуємо по співробітнику
        const byUser = {};
        for (const r of confRows) {
            if (!r.user_id) continue;
            if (!byUser[r.user_id]) byUser[r.user_id] = [];
            byUser[r.user_id].push(r);
        }

        const _fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });

        const monthLabel = new Date(this._year, this._month).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });

        // Плоска таблиця — всі рядки підряд, згруповані по співробітнику
        const tableRows = Object.entries(byUser).map(([uid, entries]) => {
            const prof  = profMap[uid];
            const name  = prof?.full_name || '—';
            const pos   = prof?.job_position || '';
            const city  = prof?.city || '';
            const color = this._avatarColor(uid);
            const ini   = name !== '—' ? name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
            const meta  = [pos, city].filter(Boolean).map(Fmt.esc).join(', ');

            return entries.map((r, i) => {
                const loc     = locMap[r.location_id];
                const locName = loc?.name || '—';
                const addr    = loc?.address || '';
                const dateStr = new Date(r.date + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
                const isFirst = i === 0;
                const empCell = isFirst
                    ? `<td class="sg-srep-td sg-srep-td-emp sg-srep-td-first" rowspan="${entries.length}">
                           <div class="sg-srep-emp-inner">
                               <div class="sg-srep-av" style="background:${color}">${ini}</div>
                               <div class="sg-srep-pinfo">
                                   <div class="sg-srep-name">${Fmt.esc(name)}</div>
                                   ${meta ? `<div class="sg-srep-meta">${meta}</div>` : ''}
                                   <div class="sg-srep-cnt-inline">${entries.length} підмін</div>
                               </div>
                           </div>
                       </td>`
                    : '';
                return `<tr class="sg-srep-tr${isFirst ? ' sg-srep-tr-first' : ''}${i % 2 === 1 ? ' sg-srep-tr-odd' : ''}">${empCell}
                    <td class="sg-srep-td sg-srep-td-date">${dateStr}</td>
                    <td class="sg-srep-td sg-srep-td-loc">${Fmt.esc(locName)}</td>
                    <td class="sg-srep-td sg-srep-td-addr">${Fmt.esc(addr)}</td>
                </tr>`;
            }).join('');
        }).join('');

        const totalSubs  = confRows.length;
        const totalPeople = Object.keys(byUser).length;

        const el = document.createElement('div');
        el.id = 'sg-subrep-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `<div class="sg-modal sg-srep-modal">
            <div class="sg-srep-head">
                <div class="sg-srep-head-left">
                    <span class="sg-srep-ico">📋</span>
                    <div>
                        <div class="sg-srep-title">Звіт по підмінам</div>
                        <div class="sg-srep-subtitle">${monthLabel}</div>
                    </div>
                </div>
                <div class="sg-srep-head-right">
                    <div class="sg-srep-stat"><span class="sg-srep-stat-n">${totalPeople}</span><span class="sg-srep-stat-l">співробітників</span></div>
                    <div class="sg-srep-stat-sep"></div>
                    <div class="sg-srep-stat"><span class="sg-srep-stat-n">${totalSubs}</span><span class="sg-srep-stat-l">підмін</span></div>
                    <button class="sg-modal-close" onclick="document.getElementById('sg-subrep-modal').remove()">✕</button>
                </div>
            </div>
            <div class="sg-srep-body">
                <table class="sg-srep-table">
                    <thead>
                        <tr>
                            <th class="sg-srep-th sg-srep-th-emp">Співробітник</th>
                            <th class="sg-srep-th">Дата</th>
                            <th class="sg-srep-th">Локація</th>
                            <th class="sg-srep-th">Адреса</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
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
                Всі співробітники ваших локацій отримають сповіщення та мітку в календарі
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

        // Notify all employees across all manager's locations
        const allLocIds = this._locations.map(l => l.id);
        const { data: assigns, error: ae } = await supabase.from('schedule_assignments')
            .select('user_id').in('location_id', allLocIds).not('user_id', 'is', null);
        if (ae) console.error('[NeedSub] assignments error:', ae);
        const userIds = [...new Set((assigns || []).map(a => a.user_id).filter(Boolean))];
        console.log('[NeedSub] notifying userIds:', userIds.length, 'locIds:', allLocIds.length);

        if (userIds.length) {
            const dateLabel = new Date(date + 'T00:00:00')
                .toLocaleDateString('uk-UA', { weekday:'long', day:'numeric', month:'long' });
            const managerName = AppState.profile?.full_name || 'Керівник';
            const { error: ne } = await supabase.from('notifications').insert(
                userIds.map(uid => ({
                    user_id: uid,
                    title: '🆘 Потрібна підміна',
                    message: `${managerName} шукає підміну на ${dateLabel} у «${locName}». Якщо можете вийти — позначте дату у графіку.`,
                    type: 'general', created_by: AppState.user.id,
                    link: 'schedule-graph?view=employee'
                }))
            );
            if (ne) console.error('[NeedSub] notifications error:', ne);
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

        // Same lookup helper as _tableSection — uses per-location entry map
        const _locEntries = locId => this._entriesByLoc?.[locId] || {};
        const _getEntry   = (a, date) => {
            const lid = a.user_id || a.original_user_id;
            return lid ? _locEntries(a.locId)[`${lid}_${date}`] || null : null;
        };
        const _hasEntries    = a => nums.some(d => _getEntry(a, this._dateStr(d)));
        const _isPartnerLoc  = locId => this._partnerLocations?.some(l => l.id === locId);

        // Cross-location shift: uid_date → [{ locId, locName }, ...] — all real shifts per employee per date
        const shiftsByUidDate = {};
        Object.entries(this._allEntries || {}).forEach(([key, e]) => {
            if (!_isRealShift(e)) return;
            const parts = key.split('_');
            if (parts.length !== 3) return;
            const [lid, uid, dt] = parts;
            const k = `${uid}_${dt}`;
            if (!shiftsByUidDate[k]) shiftsByUidDate[k] = [];
            if (!shiftsByUidDate[k].some(x => x.locId === lid)) {
                const locName = this._locations.find(l => l.id === lid)?.name
                    || this._partnerLocations?.find(l => l.id === lid)?.name || '';
                shiftsByUidDate[k].push({ locId: lid, locName });
            }
        });

        const byLoc = {};
        this._allAssignments.forEach(a => {
            // Primary employees always show (active or fired); non-primary only if they have entries this month
            const visible = a.isPartner ? _hasEntries(a) : ((a.is_primary && a.user_id) ? true : _hasEntries(a));
            if (!visible) return;
            // Employee filter: if active, only show rows matching the selected user
            if (this._filteredUserId) {
                const uid = a.user_id || a.original_user_id;
                if (uid !== this._filteredUserId) return;
            }
            if (!byLoc[a.locId]) byLoc[a.locId] = { name: a.locName, members: [], isPartner: _isPartnerLoc(a.locId) };
            // Deduplicate by assignment id (not user_id, which can be null for multiple fired employees)
            if (!byLoc[a.locId].members.find(m => m.id === a.id))
                byLoc[a.locId].members.push(a);
        });
        const _locOrder = Object.fromEntries(this._locations.map((l, i) => [l.id, i]));

        const partnerLocCount = Object.values(byLoc).filter(l => l.isPartner).length;
        const visibleByLoc = this._showPartnerLocs
            ? byLoc
            : Object.fromEntries(Object.entries(byLoc).filter(([, l]) => !l.isPartner));

        // Per-location: which dates have at least one 'work' entry (for no-work highlight)
        const locDatesWithWork = {};
        this._allAssignments.forEach(a => {
            const uid = a.user_id || a.original_user_id;
            if (!uid) return;
            nums.forEach(d => {
                const date  = this._dateStr(d);
                const entry = this._allEntries[`${a.locId}_${uid}_${date}`];
                if (_isRealShift(entry)) {
                    if (!locDatesWithWork[a.locId]) locDatesWithWork[a.locId] = new Set();
                    locDatesWithWork[a.locId].add(date);
                }
            });
        });
        const datesWithAnyWork = new Set();
        Object.values(locDatesWithWork).forEach(s => s.forEach(d => datesWithAnyWork.add(d)));

        const legend = getShiftTypeEntries().map(([k, v]) => `
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
        <div class="sg-tb-section">
            <span class="sg-tb-label">Легенда</span>
            <div class="sg-legend">${legend}<button class="sg-types-mgr-btn" onclick="ScheduleGraphPage._showShiftTypesModal()" title="Налаштувати типи змін">⚙️</button></div>
        </div>
        <div class="sg-tb-divider"></div>
        <div class="sg-tb-section">
            <span class="sg-tb-label">Вигляд</span>
            <div style="display:flex;gap:6px">
                <button class="sg-collapse-all-btn" title="Згорнути всі локації" onclick="ScheduleGraphPage._collapseAllLocs()">▼ Згорнути</button>
                <button class="sg-collapse-all-btn" title="Розгорнути всі локації" onclick="ScheduleGraphPage._expandAllLocs()">▲ Розгорнути</button>
            </div>
        </div>
        <div class="sg-tb-divider"></div>
        <div class="sg-tb-section">
            <span class="sg-tb-label">Підміни</span>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="sg-mgr-help-btn" onclick="ScheduleGraphPage._showManagerHelpModal()">
                    🆘 Потрібна${(() => {
                        const cnt = Object.values(this._allEntries||{}).filter(e=>e.notes==='__needsub__').length;
                        return cnt ? ` <span class="sg-cansub-badge">${cnt}</span>` : '';
                    })()}
                </button>
                <button class="sg-cansub-list-btn" onclick="ScheduleGraphPage._showCanSubModal()">
                    🙋 Можуть${(() => {
                        const myUids = new Set([...(this._allAssignments||[]),...(this._assignments||[])].map(a=>a.user_id).filter(Boolean));
                        const src = this._locId === 'all' ? (this._allEntries||{}) : (this._entries||{});
                        const cnt = new Set(Object.values(src).filter(e=>e.notes==='__sub__'&&myUids.has(e.user_id)).map(e=>e.user_id)).size;
                        return cnt ? ` <span class="sg-cansub-badge">${cnt}</span>` : '';
                    })()}
                </button>
                <button class="sg-subrep-btn" onclick="ScheduleGraphPage._showSubstReportModal()">
                    <i class="fa-solid fa-file-lines"></i> Звіт
                </button>
            </div>
        </div>
        <div class="sg-tb-divider"></div>
        <div class="sg-tb-section">
            <span class="sg-tb-label">Доступ</span>
            <div style="display:flex;flex-direction:column;gap:5px">
                <button class="sg-viewers-btn" onclick="ScheduleGraphPage._showViewersModal()">
                    <i class="fa-solid fa-eye"></i> Доступ
                </button>
                <button class="sg-partners-btn${(this._pendingIncoming||[]).length?' sg-partners-btn--badge':''}"
                    onclick="ScheduleGraphPage._showPartnersModal()"
                    title="Спільний пошук замін з іншими керівниками">
                    🤝 ${this._blockName || 'БЛОК'}${(this._pendingIncoming||[]).length?` <span class="sg-partners-badge">${this._pendingIncoming.length}</span>`:''}
                </button>
            </div>
        </div>
    </div>
    ${this._quickType ? `
    <div class="sg-quick-bar">
        <span>⚡ Швидке заповнення:</span>
        <span class="sg-quick-badge" style="background:${getShiftTypes()[this._quickType].bg};color:${getShiftTypes()[this._quickType].color}">
            ${getShiftTypes()[this._quickType].short} ${getShiftTypes()[this._quickType].label}
        </span>
        <span>— натискайте комірки</span>
        <button class="sg-quick-cancel" onclick="ScheduleGraphPage._setQuickType(null)">✕</button>
    </div>` : ''}

    <div class="sg-subst-hint">
        <span class="sg-subst-hint-text">🖱 Натисніть на <strong>заголовок дня</strong> щоб побачити хто може підмінити</span>
        ${sd ? `<button class="sg-subst-clear" onclick="ScheduleGraphPage._selectSubstDate(null)">✕ Скинути</button>` : ''}
    </div>

    <div class="sg-scroll-wrap" id="sg-wrap-all" onscroll="ScheduleGraphPage._onScroll('all')">
        <table class="sg-table">
            <colgroup>
                <col style="width:300px;min-width:300px">
                ${'<col>'.repeat(days)}
                <col style="width:58px">
            </colgroup>
            <tbody>
                ${Object.entries(visibleByLoc).sort(([a],[b])=>(_locOrder[a]??999)-(_locOrder[b]??999)).map(([locId, loc]) => {
                    const rows = loc.members.map(a => {
                        const p = a.profile || {};
                        const init = (p.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
                        let workDays = 0;
                        const cells = nums.map(d => {
                            const date   = this._dateStr(d);
                            const entry  = _getEntry(a, date);
                            const dispType = entry && !a.is_primary && entry.shift_type === 'work' ? 'day_off' : entry?.shift_type;
                            const shift  = entry ? getShiftTypes()[dispType] : null;
                            const dow    = new Date(this._year, this._month, d).getDay();
                            const we     = dow === 0 || dow === 6;
                            const isSd   = date === sd;
                            const type   = entry?.shift_type;
                            const isFree = sd && isSd && !type;
                            const isBusy = sd && isSd && !isFree;
                            if (_isRealShift(entry)) workDays++;
                            const isSubConf = entry?.notes === '__sub_confirmed__';
                            const flagIco = entry?.notes === '__needsub__' ? '🆘' : '';
                            const dispShift = isSubConf ? SUB_CONFIRMED : (entry?.notes === '__sub__' ? null : shift);
                            const isFired  = !a.user_id;
                            const isEmpty  = !isFired && !locDatesWithWork[locId]?.has(date);
                            const uid2 = a.user_id || a.original_user_id;
                            const allCross = uid2 ? (shiftsByUidDate[`${uid2}_${date}`] || null) : null;
                            const subConfCross = allCross?.find(x => x.locId !== locId && (this._allEntries?.[`${x.locId}_${uid2}_${date}`]?.notes === '__sub_confirmed__')) || null;
                            const crossShifts = (!entry || entry?.notes === '__sub__') && uid2 ? allCross : null;
                            const crossOther  = crossShifts?.find(x => x.locId !== locId) || null;
                            const otherLocName = subConfCross?.locName || crossOther?.locName || null;
                            const isVOLoc = this._isViewOnlyLoc(locId);
                            const cellTitle = isFired ? 'Звільнений співробітник'
                                : a.isPartner || isVOLoc ? 'Тільки перегляд'
                                : entry?.notes==='__needsub__' ? 'Потрібна підміна'
                                : subConfCross ? `Підміна у «${subConfCross.locName}»`
                                : isSubConf ? 'Підтверджена підміна'
                                : shift ? shift.label
                                : crossOther ? `Підміна у «${crossOther.locName}»` : 'Клік щоб додати';
                            return `<td class="sg-cell${we?' we':''}${isSd?' sg-sd-col':''}${isFree?' sg-free-cell':''}${isBusy?' sg-busy-cell':''}${entry?.notes==='__needsub__'?' sg-needsub-cell':''}${a.isPartner||isVOLoc?' sg-cell-partner':''}${isFired?' sg-cell-fired':''}${isEmpty?' sg-cell-no-work':''}"
                                data-uid="${a.user_id}" data-date="${date}" data-locid="${locId}"
                                ${(isFired || a.isPartner || isVOLoc) ? '' : `onclick="ScheduleGraphPage._openCellAll('${locId}','${a.user_id}','${date}')"`}
                                title="${cellTitle}">
                                ${flagIco
                                    ? `<span class="sg-flag-cell">${flagIco}</span>`
                                    : subConfCross ? `<span class="sg-other-loc-badge">${subConfCross.locName.slice(0,3)}</span>`
                                    : dispShift ? `<span class="sg-badge" style="background:${dispShift.bg};color:${dispShift.color}">${dispShift.short}</span>`
                                    : otherLocName ? `<span class="sg-other-loc-badge">${otherLocName.slice(0,3)}</span>`
                                    : isFree ? `<span class="sg-free-dot">●</span>` : ''}
                            </td>`;
                        }).join('');
                        const rowType  = sd ? _getEntry(a, sd)?.shift_type : null;
                        const rowClass = sd ? (!rowType ? 'sg-row-free' : 'sg-row-busy') : '';
                        return `<tr class="${rowClass}${a.isPartner?' sg-row-partner':''}">
                            ${this._nameCellAll(a)}
                            ${cells}
                            <td class="sg-td-sum">${workDays}</td>
                        </tr>`;
                    }).join('');
                    const isCollapsed = this._collapsedLocs.has(locId);
                    // Stats for collapsed badge: count employees, sum work days
                    const totalWork = loc.members.reduce((sum, a) => {
                        return sum + nums.filter(d => {
                            const uid2 = a.user_id || a.original_user_id;
                            if (!uid2) return false;
                            const e = this._allEntries[`${locId}_${uid2}_${this._dateStr(d)}`];
                            return _isRealShift(e);
                        }).length;
                    }, 0);
                    return `
                    <tr class="sg-loc-header-row${loc.isPartner?' sg-loc-header-partner':''}"
                        style="cursor:pointer" onclick="ScheduleGraphPage._toggleLoc('${locId}')">
                        <td colspan="${days + 2}" class="sg-loc-group-header">
                            <span class="sg-loc-chevron" data-loc-toggle="${locId}">${isCollapsed ? '▼' : '▲'}</span>
                            ${loc.isPartner?'🤝':'🏪'} ${loc.name}
                            ${(() => { const l = this._locations.find(l => l.id === locId); return (l?.address ? `<span class="sg-loc-acc-addr"><i class="fa-solid fa-location-dot"></i> ${Fmt.esc(l.address)}</span>` : '') + (l?.phone ? `<span class="sg-loc-acc-addr"><i class="fa-solid fa-phone"></i> ${Fmt.esc(l.phone)}</span>` : ''); })()}
                            ${loc.isPartner ? `<span class="sg-partner-loc-badge">${loc.members[0]?.partnerOwnerLabel||'Керівник'}: ${loc.members[0]?.partnerOwnerName||''}</span>` : ''}
                            <span class="sg-loc-meta">
                                <span class="sg-loc-emp-count" title="Співробітників">👤 ${loc.members.length}</span>
                                <span class="sg-loc-work-count" title="Виходів цього місяця">📅 ${totalWork}</span>
                            </span>
                            <span class="sg-loc-collapsed-hint" data-loc-badge="${locId}" style="display:${isCollapsed?'inline':'none'}">
                                — згорнуто
                            </span>
                        </td>
                    </tr>
                    <tr class="sg-loc-date-header" data-loc-rows="${locId}" style="display:${isCollapsed?'none':''}">
                        <td class="sg-th-name" style="position:sticky;left:0;z-index:2">Співробітник</td>
                        ${nums.map(d => {
                            const _dow  = new Date(this._year, this._month, d).getDay();
                            const _we   = _dow === 0 || _dow === 6;
                            const _date = this._dateStr(d);
                            const _isSd   = _date === sd;
                            const _noWork = !datesWithAnyWork.has(_date);
                            return `<td class="sg-th-day${_we?' we':''}${_isSd?' sg-sd-col':''}${_noWork?' sg-th-no-work':''}"
                                style="cursor:pointer" title="Клік — пошук підміни"
                                onclick="ScheduleGraphPage._selectSubstDate('${_date}','${locId}')">
                                <div class="sg-day-num">${d}</div>
                                <div class="sg-day-dow">${DAYS_SHORT[_dow]}</div>
                            </td>`;
                        }).join('')}
                        <td class="sg-th-sum">
                            <div class="sg-th-sum-inner">Σ</div>
                            <div class="sg-th-sub">Дні</div>
                        </td>
                    </tr>
                    ${rows.replace(/<tr /g, `<tr data-loc-rows="${locId}" style="display:${isCollapsed?'none':''}" `)}
                    <tr data-loc-rows="${locId}" style="display:${isCollapsed?'none':''}" class="sg-loc-end-row"><td colspan="${days + 2}"></td></tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>
    ${partnerLocCount ? `
    <div style="display:flex;justify-content:center;padding:10px 0 4px">
        <button class="sg-show-partners-btn" onclick="ScheduleGraphPage._togglePartnerLocs()">
            ${this._showPartnerLocs
                ? '▲ Сховати локації блоку'
                : `🤝 Показати локації блоку (${partnerLocCount})`}
        </button>
    </div>` : ''}
</div>`;
    },

    _togglePartnerLocs() {
        this._showPartnerLocs = !this._showPartnerLocs;
        this._render(this._container);
    },

    _collapseAllLocs() {
        document.querySelectorAll('[data-loc-toggle]').forEach(el => {
            const id = el.dataset.locToggle;
            this._collapsedLocs.add(id);
            document.querySelectorAll(`[data-loc-rows="${id}"]`).forEach(tr => { tr.style.display = 'none'; });
            el.textContent = '▼';
            const badge = document.querySelector(`[data-loc-badge="${id}"]`);
            if (badge) badge.style.display = 'inline';
        });
    },

    _expandAllLocs() {
        const ids = [...this._collapsedLocs];
        this._collapsedLocs.clear();
        ids.forEach(id => {
            document.querySelectorAll(`[data-loc-rows="${id}"]`).forEach(tr => { tr.style.display = ''; });
            const btn = document.querySelector(`[data-loc-toggle="${id}"]`);
            if (btn) btn.textContent = '▲';
            const badge = document.querySelector(`[data-loc-badge="${id}"]`);
            if (badge) badge.style.display = 'none';
        });
    },

    _toggleLoc(locId) {
        const collapsed = this._collapsedLocs.has(locId);
        if (collapsed) {
            this._collapsedLocs.delete(locId);
        } else {
            this._collapsedLocs.add(locId);
        }
        // Toggle rows via DOM — no full re-render needed
        const rows = document.querySelectorAll(`[data-loc-rows="${locId}"]`);
        rows.forEach(tr => { tr.style.display = collapsed ? '' : 'none'; });
        // Flip the chevron icon
        const btn = document.querySelector(`[data-loc-toggle="${locId}"]`);
        if (btn) btn.textContent = collapsed ? '▲' : '▼';
        // Update counter badge
        const badge = document.querySelector(`[data-loc-badge="${locId}"]`);
        if (badge) badge.style.display = collapsed ? 'none' : 'inline';
    },

    _openCellAll(locId, userId, date) {
        if (!userId || userId === 'null') return;
        if (this._partnerLocations?.some(l => l.id === locId)) return;
        if (this._isViewOnlyLoc(locId)) return;
        if (this._isPastMonth()) { Toast.error('Місяць завершено', 'Редагування минулих місяців заблоковано'); return; }
        if (this._isLockedForLoc(locId)) { Toast.error('Графік заблоковано', 'Розблокуйте графік перед редагуванням'); return; }
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
        if (!userId || userId === 'null') return;
        if (this._partnerLocations?.some(l => l.id === locId)) return;
        if (this._isLockedForLoc(locId)) { Toast.error('Графік заблоковано', 'Розблокуйте графік перед редагуванням'); return; }
        const key    = `${locId}_${userId}_${date}`;
        const oldEnt = this._allEntries[key];
        if (oldEnt?.shift_type === type) {
            await supabase.from('schedule_entries').delete()
                .eq('location_id', locId).eq('user_id', userId).eq('date', date);
            delete this._allEntries[key];
            if (this._entriesByLoc[locId]) delete this._entriesByLoc[locId][`${userId}_${date}`];
            document.querySelectorAll(`.sg-cell[data-uid="${userId}"][data-date="${date}"][data-locid="${locId}"]`)
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
        if (!this._entriesByLoc[locId]) this._entriesByLoc[locId] = {};
        this._entriesByLoc[locId][`${userId}_${date}`] = data;
        const shift = getShiftTypes()[type];
        document.querySelectorAll(`.sg-cell[data-uid="${userId}"][data-date="${date}"][data-locid="${locId}"]`)
            .forEach(td => { td.innerHTML = `<span class="sg-badge" style="background:${shift.bg};color:${shift.color}">${shift.short}</span>`; });
    },

    async _getWorkConflictLoc(userId, date, locId) {
        const { data } = await supabase.from('schedule_entries')
            .select('location_id')
            .eq('user_id', userId)
            .eq('date', date)
            .in('shift_type', ['work','day_off'])
            .not('notes', 'in', '("__sub__","__needsub__")')
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

    _getWorkHours(locId) {
        const loc = this._locations.find(l => l.id === locId);
        if (!loc) return {};
        return (loc.work_start && loc.work_end)
            ? { start: loc.work_start.slice(0, 5), end: loc.work_end.slice(0, 5) }
            : {};
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

    async _saveWorkHours() {
        const start = document.getElementById('sg-wh-start')?.value;
        const end   = document.getElementById('sg-wh-end')?.value;
        if (!start || !end) return;
        const { error } = await supabase.from('schedule_locations')
            .update({ work_start: start, work_end: end })
            .eq('id', this._locId);
        if (error) { Toast.error('Помилка збереження'); return; }
        const loc = this._locations.find(l => l.id === this._locId);
        if (loc) { loc.work_start = start; loc.work_end = end; }
        this._cancelWorkHours();
        this._render(this._container);
        Toast.success('Час роботи збережено');
    },

    _monthKey(year, month) {
        return `${year}-${String(month + 1).padStart(2, '0')}`;
    },

    _isLockedForLoc(locId) {
        const loc = this._locations.find(l => l.id === locId);
        if (!loc) return false;
        if (Array.isArray(loc.locked_months)) {
            return loc.locked_months.includes(this._monthKey(this._year, this._month));
        }
        return loc.locked || false;
    },

    _isLocked() {
        return this._isLockedForLoc(this._locId);
    },

    _isPastMonth() {
        if (this._pastMonthUnlocked) return false;
        const now = new Date();
        return this._year < now.getFullYear() ||
               (this._year === now.getFullYear() && this._month < now.getMonth());
    },

    _togglePastMonthUnlock() {
        this._pastMonthUnlocked = !this._pastMonthUnlocked;
        this._render(this._container);
        if (this._pastMonthUnlocked) {
            Toast.success('🔓 Місяць розблоковано', 'Ви можете редагувати минулий графік');
        } else {
            Toast.success('🔒 Місяць заблоковано', 'Редагування минулого графіку вимкнено');
        }
    },

    async _toggleLock() {
        const loc = this._locations.find(l => l.id === this._locId);
        if (!loc) return;
        const key = this._monthKey(this._year, this._month);
        const months = loc.locked_months || [];
        const isLocked = months.includes(key);
        const newMonths = isLocked ? months.filter(m => m !== key) : [...months, key];
        const { error } = await supabase.from('schedule_locations')
            .update({ locked_months: newMonths })
            .eq('id', this._locId);
        if (error) { Toast.error('Помилка', error.message); return; }
        loc.locked_months = newMonths;
        this._render(this._container);
        Toast.success(!isLocked ? '🔒 Графік заблоковано' : '🔓 Графік розблоковано',
            !isLocked ? 'Співробітники не можуть вносити зміни' : 'Співробітники знову можуть редагувати');
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
            <h3 style="margin:0;font-size:1.05rem"><i class="fa-solid fa-eye"></i> Доступ для перегляду</h3>
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
                    onmousedown="ScheduleGraphPage._pickViewerUser('${p.id}',${JSON.stringify(p.full_name||p.id).replace(/"/g,'&quot;')})">
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
        const [profRes, dovRes] = await Promise.all([
            supabase.from('profiles').select('id, full_name, role, label, job_position, manager_id').order('full_name'),
            supabase.from('profile_dovirenosti').select('profile_id, dovirenosti(name)')
        ]);
        const profiles = (profRes.data || []).filter(p => !assignedIds.has(p.id));
        if (!profiles.length) { Toast.info('Всіх доступних вже додано'); return; }

        // Build manager name map
        const mgrIds = [...new Set(profiles.map(p => p.manager_id).filter(Boolean))];
        let mgrMap = {};
        if (mgrIds.length) {
            const { data: mgrs } = await supabase.from('profiles').select('id, full_name').in('id', mgrIds);
            mgrMap = Object.fromEntries((mgrs || []).map(m => [m.id, m.full_name]));
        }

        // Build dovirenosti map
        const dovMap = {};
        (dovRes.data || []).forEach(r => {
            if (!dovMap[r.profile_id]) dovMap[r.profile_id] = [];
            if (r.dovirenosti?.name) dovMap[r.profile_id].push(r.dovirenosti.name);
        });

        profiles.forEach(p => {
            p._managerName = p.manager_id ? (mgrMap[p.manager_id] || null) : null;
            p._dovirenosti = dovMap[p.id] || [];
        });

        this._showEmpModal(profiles);
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
            <div style="flex:1;min-width:0">
                <div class="sg-emp-fn">${Fmt.esc(p.full_name || 'Без імені')}</div>
                ${p.job_position ? `<div class="sg-emp-meta">${Fmt.esc(p.job_position)}</div>` : ''}
                ${p._managerName ? `<div class="sg-emp-meta sg-emp-mgr"><i class="fa-solid fa-user-tie"></i> ${Fmt.esc(p._managerName)}</div>` : ''}
                ${p._dovirenosti.length ? `<div class="sg-emp-dovs">${p._dovirenosti.map((d, i) => `<span class="sg-emp-dov sg-emp-dov-${i % 4}">${Fmt.esc(d)}</span>`).join('')}</div>` : ''}
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
        const { data: prof } = await supabase.from('profiles')
            .select('id, full_name, avatar_url, role, label, manager_id')
            .eq('id', userId)
            .single();

        const isForeign = prof?.manager_id && prof.manager_id !== AppState.user.id;
        const isPrimary = !isForeign;

        const { data, error } = await supabase.from('schedule_assignments')
            .insert({ location_id: this._locId, user_id: userId, original_user_id: userId, created_by: AppState.user.id, employee_name: prof?.full_name || null, is_primary: isPrimary })
            .select('id, user_id, original_user_id, employee_name, is_primary')
            .single();
        if (error) { Toast.error('Помилка', error.message); return; }

        this._assignments.push({ id: data.id, user_id: data.user_id, original_user_id: data.original_user_id, employee_name: data.employee_name, is_primary: isPrimary, profile: prof });

        if (isForeign) {
            const loc = this._locations.find(l => l.id === this._locId);
            await supabase.from('notifications').insert({
                user_id:    userId,
                title:      '📅 Вас додано до графіку',
                message:    `${AppState.profile?.full_name || 'Керівник'} додав вас до локації «${loc?.name || ''}».`,
                type:       'general',
                created_by: AppState.user.id,
            }).catch(() => {});
        }

        this._render(this._container);
        Toast.success('Додано до графіку');
    },

    _removeEmployeeConfirm(assignId, userId, name) {
        document.getElementById('sg-rm-emp-modal')?.remove();
        const el = document.createElement('div');
        el.id = 'sg-rm-emp-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal sg-rm-emp-box">
    <div class="sg-rm-emp-icon"><i class="fa-solid fa-user-minus"></i></div>
    <div class="sg-rm-emp-title">Видалити зі списку?</div>
    <div class="sg-rm-emp-name">${Fmt.esc(name)}</div>
    <div class="sg-rm-emp-hint">Співробітник буде прибраний зі списку графіку.</div>
    <div class="sg-modal-actions" style="margin-top:16px">
        <button class="sg-btn-cancel" onclick="document.getElementById('sg-rm-emp-modal').remove()">Скасувати</button>
        <button class="sg-rm-emp-confirm" onclick="ScheduleGraphPage._removeEmployee('${assignId}','${userId}',null)">
            <i class="fa-solid fa-trash"></i> Видалити
        </button>
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    async _removeEmployee(assignId, userId, e) {
        if (e) e.stopPropagation();
        document.getElementById('sg-rm-emp-modal')?.remove();
        const { error } = await supabase.from('schedule_assignments').delete().eq('id', assignId);
        if (error) { Toast.error('Помилка', error.message); return; }
        await this._loadPageData();
        this._render(this._container);
        Toast.success('Видалено');
    },

    _openCell(userId, date) {
        if (this._isViewOnlyLoc(this._locId)) return;
        if (this._isPastMonth()) { Toast.error('Місяць завершено', 'Редагування минулих місяців заблоковано'); return; }
        if (this._isLocked()) { Toast.error('Графік заблоковано', 'Розблокуйте графік перед редагуванням'); return; }
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
        if (this._isLocked()) { Toast.error('Графік заблоковано', 'Розблокуйте графік перед редагуванням'); return; }
        const key    = `${userId}_${date}`;
        const oldEnt = this._entries[key];

        // Toggle off if same type already set
        if (oldEnt?.shift_type === type) {
            await this._deleteEntry(userId, date, null);
            return;
        }
        const empName = this._assignments.find(a => a.user_id === userId)?.profile?.full_name || '';

        if (['work','day_off'].includes(type)) {
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
        const shift = getShiftTypes()[type];
        document.querySelectorAll(`.sg-cell[data-uid="${userId}"][data-date="${date}"]`).forEach(td => {
            td.innerHTML = `<span class="sg-badge" style="background:${shift.bg};color:${shift.color}">${shift.short}</span>`;
        });
        if (['work','day_off'].includes(type) || ['work','day_off'].includes(oldEnt?.shift_type)) this._updateNoWorkHighlight(date);
    },

    _showShiftTypesModal(empMode = false) {
        document.getElementById('sg-types-modal')?.remove();
        const types = getShiftTypes();
        const rowHtml = (key, v) => {
            const isBuiltin = _BUILTIN_SHIFT_KEYS.includes(key);
            return `<div class="sg-type-row" id="sg-typerow-${key}">
    <span class="sg-leg-short" style="background:${v.bg};color:${v.color};flex-shrink:0">${v.short}</span>
    <span class="sg-type-row-label">${v.label}</span>
    <span style="background:${v.color};width:12px;height:12px;border-radius:50%;display:inline-block;flex-shrink:0"></span>
    <button class="sg-type-edit-btn" onclick="ScheduleGraphPage._editTypeRow('${key}')"><i class="fa-solid fa-pen"></i></button>
    ${!isBuiltin && !empMode ? `<button class="sg-type-del-btn" onclick="ScheduleGraphPage._deleteShiftType('${key}')"><i class="fa-solid fa-trash"></i></button>` : ''}
</div>`;
        };
        const el = document.createElement('div');
        el.id = 'sg-types-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal sg-types-modal-box">
    <div class="sg-mhdr" style="margin-bottom:0;padding-bottom:12px;border-bottom:1px solid var(--border)">
        <h3 style="margin:0">⚙️ Типи змін</h3>
        <button class="sg-mclose" onclick="document.getElementById('sg-types-modal').remove()">✕</button>
    </div>
    <div id="sg-typelist" style="display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow-y:auto;padding:12px 0">
        ${(empMode ? getShiftTypeEntries().filter(([k]) => ['work','vacation'].includes(k)) : getShiftTypeEntries()).map(([k, v]) => rowHtml(k, v)).join('')}
    </div>
    ${!empMode ? `<div style="padding-top:10px;border-top:1px solid var(--border)">
        <button class="sg-btn-add-type" id="sg-add-type-trigger" onclick="ScheduleGraphPage._showAddTypeForm()">＋ Додати тип</button>
        <div id="sg-add-type-form" style="display:none"></div>
    </div>` : ''}
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    _typeFormHtml(submitFn, cancelFn, label, shortVal, color) {
        return `<div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">
    <div style="display:flex;gap:8px;align-items:flex-end">
        <div style="flex:1">
            <label style="font-size:.72rem;color:var(--text-muted);display:block;margin-bottom:3px">Назва</label>
            <input id="sg-tf-label" class="sg-tinput" type="text" value="${label || ''}" placeholder="Назва типу" style="width:100%;box-sizing:border-box">
        </div>
        <div style="width:76px">
            <label style="font-size:.72rem;color:var(--text-muted);display:block;margin-bottom:3px">Скорочення</label>
            <input id="sg-tf-short" class="sg-tinput" type="text" value="${shortVal || ''}" maxlength="3" placeholder="Р" style="width:100%;text-align:center;box-sizing:border-box">
        </div>
        <div>
            <label style="font-size:.72rem;color:var(--text-muted);display:block;margin-bottom:3px">Колір</label>
            <input id="sg-tf-color" type="color" value="${color || '#6366f1'}" style="width:44px;height:36px;border-radius:6px;border:1px solid var(--border);cursor:pointer;padding:2px">
        </div>
    </div>
    <div style="display:flex;gap:8px">
        <button class="sg-btn-save" onclick="${submitFn}" style="flex:1"><i class="fa-regular fa-floppy-disk"></i> Зберегти</button>
        <button class="sg-btn-cancel" onclick="${cancelFn}">Скасувати</button>
    </div>
</div>`;
    },

    _editTypeRow(key) {
        const v = getShiftTypes()[key];
        if (!v) return;
        const row = document.getElementById(`sg-typerow-${key}`);
        if (!row) return;
        const formHtml = this._typeFormHtml(`ScheduleGraphPage._saveTypeEdit('${key}')`, `ScheduleGraphPage._cancelTypeEdit('${key}')`, v.label, v.short, v.color);
        row.innerHTML = `<div style="width:100%;display:flex;flex-direction:column;gap:4px">
    <div style="font-size:.75rem;color:var(--text-muted);font-weight:500">Редагування: <b style="color:var(--text-primary)">${v.label}</b></div>
    ${formHtml}
</div>`;
    },

    _cancelTypeEdit(key) {
        const v = getShiftTypes()[key];
        if (!v) return;
        const isBuiltin = _BUILTIN_SHIFT_KEYS.includes(key);
        const row = document.getElementById(`sg-typerow-${key}`);
        if (!row) return;
        row.innerHTML = `
    <span class="sg-leg-short" style="background:${v.bg};color:${v.color};flex-shrink:0">${v.short}</span>
    <span class="sg-type-row-label">${v.label}</span>
    <span style="background:${v.color};width:12px;height:12px;border-radius:50%;display:inline-block;flex-shrink:0"></span>
    <button class="sg-type-edit-btn" onclick="ScheduleGraphPage._editTypeRow('${key}')"><i class="fa-solid fa-pen"></i></button>
    ${!isBuiltin ? `<button class="sg-type-del-btn" onclick="ScheduleGraphPage._deleteShiftType('${key}')"><i class="fa-solid fa-trash"></i></button>` : ''}`;
    },

    _saveTypeEdit(key) {
        const label = document.getElementById('sg-tf-label')?.value?.trim();
        const short = document.getElementById('sg-tf-short')?.value?.trim();
        const color = document.getElementById('sg-tf-color')?.value;
        if (!label || !short || !color) { Toast.error('Помилка', 'Заповніть всі поля'); return; }
        const types = getShiftTypes();
        types[key] = { ...types[key], label, short, color, bg: _sgHexToRgba(color, 0.14) };
        _cachedShiftTypes = types;
        this._persistShiftConfig();
        this._refreshAfterTypesChange();
    },

    _deleteShiftType(key) {
        const types = getShiftTypes();
        const name = types[key]?.label || key;
        if (!confirm(`Видалити тип «${name}»? Вже збережені записи залишаться в базі даних.`)) return;
        delete types[key];
        _cachedShiftTypes = types;
        this._persistShiftConfig();
        this._refreshAfterTypesChange();
    },

    _showAddTypeForm() {
        const form = document.getElementById('sg-add-type-form');
        const trigger = document.getElementById('sg-add-type-trigger');
        if (!form || !trigger) return;
        trigger.style.display = 'none';
        form.style.display = 'block';
        form.innerHTML = this._typeFormHtml('ScheduleGraphPage._saveNewType()', 'ScheduleGraphPage._hideAddTypeForm()', '', '', '#6366f1');
    },

    _hideAddTypeForm() {
        const form = document.getElementById('sg-add-type-form');
        const trigger = document.getElementById('sg-add-type-trigger');
        if (form) { form.style.display = 'none'; form.innerHTML = ''; }
        if (trigger) trigger.style.display = '';
    },

    _saveNewType() {
        const label = document.getElementById('sg-tf-label')?.value?.trim();
        const short = document.getElementById('sg-tf-short')?.value?.trim();
        const color = document.getElementById('sg-tf-color')?.value;
        if (!label || !short || !color) { Toast.error('Помилка', 'Заповніть всі поля'); return; }
        const key = 'cst_' + Date.now();
        const types = getShiftTypes();
        types[key] = { label, short, color, bg: _sgHexToRgba(color, 0.14) };
        _cachedShiftTypes = types;
        this._persistShiftConfig();
        this._refreshAfterTypesChange();
    },

    _refreshAfterTypesChange() {
        document.getElementById('sg-types-modal')?.remove();
        this._render(this._container);
        this._showShiftTypesModal();
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
        ${getShiftTypeEntries().map(([k, v]) => `
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
            <i class="fa-regular fa-floppy-disk"></i> Зберегти
        </button>
        <button class="sg-btn-cancel"
            onclick="document.getElementById('sg-shift-modal').remove()">Скасувати</button>
        ${entry ? `<button class="sg-del-btn"
            onclick="ScheduleGraphPage._deleteEntry('${userId}','${date}',${isEmployee ? `'${ScheduleGraphEmployee._locId}'` : 'null'})"
            title="Видалити запис"><i class="fa-solid fa-trash"></i></button>` : ''}
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

        // Notify employee if manager made the change
        if (!isEmployee && userId !== AppState.user.id) {
            const mgrName = AppState.profile?.full_name || 'Керівник';
            const shift = getShiftTypes()[type];
            const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('uk-UA', { day:'numeric', month:'long' });
            await supabase.from('notifications').insert({
                user_id: userId,
                title: '📅 Зміну в графіку оновлено',
                message: `${mgrName} встановив ${shift?.label || type} на ${dateLabel}`,
                type: 'general',
                created_by: AppState.user.id,
                link: `schedule-graph?view=employee`
            });
        }

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

        // Notify employee if manager deleted the entry
        if (!isEmp && userId !== AppState.user.id && oldEnt) {
            const mgrName = AppState.profile?.full_name || 'Керівник';
            const shift = getShiftTypes()[oldEnt.shift_type];
            const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('uk-UA', { day:'numeric', month:'long' });
            await supabase.from('notifications').insert({
                user_id: userId,
                title: '📅 Зміну в графіку видалено',
                message: `${mgrName} видалив ${shift?.label || oldEnt.shift_type} на ${dateLabel}`,
                type: 'general',
                created_by: AppState.user.id,
                link: `schedule-graph?view=employee`
            });
        }

        if (isEmp) {
            delete ScheduleGraphEmployee._entries[date];
            ScheduleGraphEmployee._render(ScheduleGraphEmployee._container);
        } else if (this._locId === 'all') {
            delete this._allEntries[`${locId}_${userId}_${date}`];
            this._render(this._container);
        } else {
            delete this._entries[`${userId}_${date}`];
            if (['work','day_off'].includes(oldEnt?.shift_type)) this._updateNoWorkHighlight(date);
            this._render(this._container);
        }
        document.getElementById('sg-shift-modal')?.remove();
        Toast.success('Запис видалено');
    },

    // ── Helpers ───────────────────────────────────────────────────

    _updateNoWorkHighlight(date) {
        const hasWork = Object.entries(this._entries).some(([key, e]) =>
            key.endsWith(`_${date}`) && ['work','day_off'].includes(e.shift_type)
        );
        const day = parseInt(date.split('-')[2]);
        document.querySelectorAll('#sg-wrap-main .sg-th-day').forEach(th => {
            if (parseInt(th.querySelector('.sg-day-num')?.textContent?.trim()) === day)
                th.classList.toggle('sg-th-no-work', !hasWork);
        });
        document.querySelectorAll(`#sg-wrap-main .sg-cell[data-date="${date}"]`).forEach(td => {
            if (!td.classList.contains('sg-cell-fired'))
                td.classList.toggle('sg-cell-no-work', !hasWork);
        });
    },

    _avatarColor(userId) {
        const palette = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6',
                         '#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16'];
        let h = 0;
        for (let i = 0; i < (userId || '').length; i++) h = (h * 31 + userId.charCodeAt(i)) & 0xffffffff;
        return palette[Math.abs(h) % palette.length];
    },

    _nameCell(a) {
        const p       = a.profile || null;
        const name    = p?.full_name || a.employee_name || 'Без імені';
        const fired   = a.user_id === null;
        const isOwner = AppState.isAdmin() || AppState.isOwner() ||
                        (typeof AppState.isManager === 'function' && AppState.isManager());

        // Gender from patronymic (3rd word), fallback to surname ending
        const firedBadge = (() => {
            const words = name.trim().split(/\s+/);
            const pat = words[2] || '';
            if (/вна$/i.test(pat)) return 'звільнена';
            if (/вич$/i.test(pat)) return 'звільнений';
            return /[ая]$/i.test(words[0] || '') ? 'звільнена' : 'звільнений';
        })();

        const primaryBtn = !fired && isOwner
            ? `<button class="sg-primary-btn${a.is_primary ? ' active' : ''}"
                title="${a.is_primary ? 'Основний співробітник — клік щоб зробити тимчасовим' : 'Тимчасовий (підміна) — клік щоб зробити основним'}"
                onclick="ScheduleGraphPage._togglePrimary('${a.id}',${!a.is_primary},event)">
                ${a.is_primary ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>'}
               </button>`
            : '';

        const viewOnly = this._isViewOnlyLoc(this._locId);
        const rmBtn = !viewOnly && !fired ? `<button class="sg-rm sg-rm-inline" title="Видалити зі списку"
            data-name="${Fmt.esc(name)}"
            onclick="event.stopPropagation();ScheduleGraphPage._removeEmployeeConfirm('${a.id}','${a.user_id}',this.dataset.name)">
            <i class="fa-solid fa-trash"></i>
        </button>` : '';

        return `
<td class="sg-td-name" title="${name}${fired ? ' (звільнений співробітник)' : a.is_primary ? ' — основний' : ' — тимчасовий'}">
    <span class="sg-drag-handle" title="Перетягнути">⠿</span>
    <div class="sg-name-full${fired ? ' sg-name-deleted' : ''}">
        ${primaryBtn}${name}${fired
        ? ` <span class="sg-deleted-badge">${firedBadge}</span>`
        : !a.is_primary ? ` <span class="sg-temp-badge">підміна</span>` : ''}
    </div>
    ${rmBtn}
</td>`;
    },

    _filterByEmployee(userId) {
        this._filteredUserId = (this._filteredUserId === userId) ? null : userId;
        this._render(this._container);
    },

    _nameCellAll(a) {
        const p       = a.profile || null;
        const name    = p?.full_name || a.employee_name || 'Без імені';
        const fired   = a.user_id === null;
        const isFiltered = this._filteredUserId === (a.user_id || a.original_user_id);

        const firedBadge = (() => {
            const words = name.trim().split(/\s+/);
            const pat = words[2] || '';
            if (/вна$/i.test(pat)) return 'звільнена';
            if (/вич$/i.test(pat)) return 'звільнений';
            return /[ая]$/i.test(words[0] || '') ? 'звільнена' : 'звільнений';
        })();

        const uid = a.user_id || a.original_user_id;
        return `
<td class="sg-td-name sg-td-name--clickable${isFiltered ? ' sg-td-name--active' : ''}"
    title="${isFiltered ? 'Натисніть щоб скинути фільтр' : 'Натисніть щоб показати тільки цього співробітника'}"
    onclick="ScheduleGraphPage._filterByEmployee('${uid}')">
    <div class="sg-name-full${fired ? ' sg-name-deleted' : ''}">
        ${name}${fired
        ? ` <span class="sg-deleted-badge">${firedBadge}</span>`
        : !a.is_primary ? ` <span class="sg-temp-badge">підміна</span>` : ''}
        ${isFiltered ? ' <span class="sg-filter-active-badge">✓ фільтр</span>' : ''}
    </div>
</td>`;
    },


    _onEmpDragStart(e, assignId) {
        this._draggingEmpId = assignId;
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('sg-row-dragging');
    },

    _onEmpDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('sg-row-drag-over');
    },

    _onEmpDragLeave(e) {
        e.currentTarget.classList.remove('sg-row-drag-over');
    },

    _onEmpDrop(e, targetId) {
        e.preventDefault();
        e.currentTarget.classList.remove('sg-row-drag-over');
        const fromId = this._draggingEmpId;
        if (!fromId || fromId === targetId) return;
        const arr  = this._assignments;
        const from = arr.findIndex(a => a.id === fromId);
        const to   = arr.findIndex(a => a.id === targetId);
        if (from === -1 || to === -1) return;
        const [item] = arr.splice(from, 1);
        arr.splice(to, 0, item);
        this._saveEmpOrder();
        this._render(this._container);
    },

    async _togglePrimary(assignId, newVal, e) {
        e.stopPropagation();
        const { error } = await supabase.from('schedule_assignments')
            .update({ is_primary: newVal }).eq('id', assignId);
        if (error) { Toast.error('Помилка', error.message); return; }
        // Update both arrays so the change is visible regardless of current view
        const inPage = this._assignments?.find(x => x.id === assignId);
        if (inPage) inPage.is_primary = newVal;
        const inAll = this._allAssignments?.find(x => x.id === assignId);
        if (inAll) inAll.is_primary = newVal;
        this._render(this._container);
    },

    _dateStr(day) {
        const p = n => String(n).padStart(2, '0');
        return `${this._year}-${p(this._month + 1)}-${p(day)}`;
    },

    _trashSection() {
        if (!this._deletedLocations.length) return `
<div class="sg-section">
    <div class="empty-state" style="margin:3rem 0">
        <div class="empty-icon"><i class="fa-solid fa-trash"></i></div>
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
                    <i class="fa-solid fa-trash"></i>
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
.sg-page { max-width:100%;overflow-x:hidden;animation:fadeSlideUp .3s cubic-bezier(.16,1,.3,1); }

/* Hero */
.sg-hero {
    border-radius:24px;padding:32px 28px;margin-bottom:20px;
    background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 50%,#3b82f6 100%);
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
    border:1.5px solid rgba(239,68,68,.35);
    background:rgba(239,68,68,.08);color:#ef4444;
    font-size:.85rem;font-weight:700;cursor:pointer;
    white-space:nowrap;transition:all .18s;flex-shrink:0;
    backdrop-filter:blur(4px);
}
.sg-mgr-help-btn:hover { background:rgba(239,68,68,.15);border-color:#ef4444; }

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
@keyframes sg-manual-glow {
    0%,100% { box-shadow: 0 0 10px rgba(250,204,21,.5), 0 0 24px rgba(250,204,21,.25), inset 0 1px 0 rgba(255,255,255,.2); }
    50%      { box-shadow: 0 0 18px rgba(250,204,21,.85), 0 0 40px rgba(250,204,21,.4), inset 0 1px 0 rgba(255,255,255,.25); }
}
.sg-manual-btn {
    padding:9px 20px;border-radius:20px;
    background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%);
    background-size: 200% 200%;
    border: none;
    color: #1a1000;font-size:.84rem;font-weight:800;letter-spacing:.01em;
    cursor:pointer;white-space:nowrap;flex-shrink:0;
    animation: sg-manual-glow 2.2s ease-in-out infinite;
    transition: transform .15s, filter .15s;
    text-shadow: 0 1px 0 rgba(255,255,255,.35);
}
.sg-manual-btn:hover {
    filter: brightness(1.12);
    transform: scale(1.06);
    animation-duration: .9s;
}
.sg-manual-btn:active { transform: scale(.97); }

/* Body: sidebar + content */
.sg-body { display:flex;gap:16px;align-items:flex-start; }
.sg-content { flex:1;min-width:0;overflow-x:hidden; }

/* Location sidebar */
.sg-loc-sidebar {
    width:var(--sg-sidebar-w,170px);flex-shrink:0;
    background:var(--bg-raised);border:1.5px solid var(--border);
    border-radius:16px;overflow:hidden;
    position:sticky;top:16px;
    min-width:80px;max-width:340px;
}
.sg-sidebar-resizer {
    flex-shrink:0;width:10px;cursor:col-resize;
    display:flex;align-items:flex-start;justify-content:center;
    padding-top:24px;position:sticky;top:16px;align-self:flex-start;
}
.sg-sidebar-resizer::after {
    content:'';display:block;width:4px;height:44px;border-radius:4px;
    background:var(--border);transition:background .15s,height .15s;
}
.sg-sidebar-resizer:hover::after { background:var(--primary);height:60px; }
.sg-sidebar-resizing { cursor:col-resize;user-select:none; }
.sg-sidebar-resizing .sg-sidebar-resizer::after { background:var(--primary);height:60px; }
.sg-loc-sidebar-head {
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 14px;border-bottom:1px solid var(--border);
}
.sg-loc-sidebar-head > div { opacity:0;transition:opacity .15s; }
.sg-loc-sidebar-head:hover > div { opacity:1; }
.sg-loc-sidebar-title {
    font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
    color:var(--text-muted);
}
.sg-sidebar-add-loc { padding:8px 6px 4px;border-top:1px solid var(--border); }
.sg-sidebar-add-loc-btn { width:100%;display:flex;align-items:center;justify-content:center;gap:6px;padding:7px;border-radius:10px;border:1.5px dashed var(--border);background:transparent;color:var(--text-muted);font-size:.78rem;cursor:pointer;transition:all .15s; }
.sg-sidebar-add-loc-btn:hover { border-color:var(--primary);color:var(--primary);background:color-mix(in srgb,var(--primary) 6%,transparent); }
.sg-loc-add-ico {
    width:24px;height:24px;border-radius:7px;border:1.5px solid var(--border);
    background:transparent;color:var(--primary);font-size:1rem;font-weight:700;
    cursor:pointer;display:flex;align-items:center;justify-content:center;
    transition:all .15s;line-height:1;
}
.sg-loc-add-ico:hover { background:var(--primary);color:#fff;border-color:var(--primary); }
.sg-loc-add-ico.active { background:var(--primary);color:#fff;border-color:var(--primary); }
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
    opacity:0;
}
.sg-loc-item-row:hover .sg-loc-item-rename,
.sg-loc-item-row:hover .sg-loc-item-del { opacity:1; }
.sg-loc-item-rename:hover { background:var(--bg-hover,rgba(0,0,0,.07));color:var(--primary); }
.sg-loc-item-del:hover { background:rgba(239,68,68,.1);color:#ef4444; }
.sg-loc-drag-handle {
    cursor:grab;color:var(--text-muted);font-size:1rem;
    opacity:0;flex-shrink:0;user-select:none;padding:0 4px;
    transition:opacity .15s;line-height:1;
}
.sg-loc-item-row:hover .sg-loc-drag-handle { opacity:.45; }
.sg-loc-drag-handle:active { cursor:grabbing; }
.sg-loc-item-row.sg-loc-dragging { opacity:.4; }
.sg-loc-item-row.sg-loc-drag-over .sg-loc-item {
    background:rgba(99,102,241,.12) !important;
    outline:2px solid var(--primary);outline-offset:-2px;
}

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
.sg-past-unlock-btn { font-size:.65rem;font-weight:600;padding:2px 7px;border-radius:8px;border:1px solid #ef4444;color:#ef4444;background:transparent;cursor:pointer;transition:all .15s; }
.sg-past-unlock-btn:hover { background:#ef4444;color:#fff; }
.sg-past-unlock-btn.sg-past-unlock-active { border-color:#16a34a;color:#16a34a; }
.sg-past-unlock-btn.sg-past-unlock-active:hover { background:#16a34a;color:#fff; }
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

/* V2 layout */
.sg-v2-service { flex:0 0 auto; }
.sg-section-v2 { padding:16px 20px 4px; }
.sg-v2-top { display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap; }
.sg-v2-card { background:var(--bg-raised);border:1px solid var(--border);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:8px; }
.sg-v2-loc-card { min-width:240px;flex:0 0 auto;background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 8%,var(--bg-raised)),var(--bg-raised));border-color:color-mix(in srgb,var(--primary) 20%,var(--border)); }
.sg-v2-mgmt-card { flex:0 0 auto;min-width:300px; }
.sg-v2-card-label { font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:2px; }
.sg-v2-svc-grid { display:grid;grid-template-columns:1fr 1fr;gap:6px; }
.sg-svc-btn { display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;border:none;background:transparent;cursor:pointer;text-align:left;transition:background .12s;width:100%; }
.sg-svc-btn:hover { background:var(--bg-raised); }
.sg-svc-ico { width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0; }
.sg-svc-body { flex:1;min-width:0; }
.sg-svc-title { font-size:.78rem;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:5px;flex-wrap:wrap; }
.sg-svc-desc { font-size:.67rem;color:var(--text-muted);margin-top:1px; }
.sg-svc-arr { font-size:.6rem;color:var(--text-muted);flex-shrink:0;opacity:.5; }
.sg-svc-badge { font-size:.62rem;font-weight:700;background:rgba(239,68,68,.15);color:#ef4444;border-radius:8px;padding:1px 5px;line-height:1.4; }
.sg-svc-badge-green { background:rgba(16,185,129,.15);color:#10b981; }
.sg-v2-loc-name { display:flex;align-items:center;gap:6px;font-weight:600;font-size:.95rem; }
.sg-v2-loc-row { display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--text-secondary); }
.sg-v2-loc-val { font-weight:600;color:var(--text-primary);margin-left:auto; }
.sg-v2-loc-actions { display:flex;gap:8px;align-items:center;margin-top:4px; }
.sg-v2-mgmt-btns { display:flex;flex-wrap:wrap;gap:8px; }
.sg-v2-mgmt-hint { font-size:.75rem;color:var(--text-muted);margin:4px 0 0; }
.sg-v2-legend-section { margin-bottom:12px; }
.sg-v2-hint { font-size:.72rem;color:var(--text-muted);display:flex;align-items:center;gap:6px;margin:8px 0 4px;padding:0 2px; }
.sg-v2-svc-list { display:grid;grid-template-columns:1fr 1fr;gap:6px; }
.sg-v2-svc-item { display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:background .12s;border:1px solid transparent; }
.sg-v2-svc-item:hover { background:var(--bg-raised);border-color:var(--border); }
.sg-v2-svc-icon { width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0; }
.sg-v2-svc-body { flex:1;min-width:0; }
.sg-v2-svc-title { font-size:.8rem;font-weight:600;color:var(--text-primary); }
.sg-v2-svc-sub { font-size:.68rem;color:var(--text-muted);margin-top:1px; }
.sg-v2-svc-arr { font-size:.65rem;color:var(--text-muted);flex-shrink:0; }
.sg-back-btn { display:inline-flex;align-items:center;gap:6px;background:var(--bg-raised);color:var(--text-secondary);border:1px solid var(--border);border-radius:20px;padding:5px 14px;font-size:.8rem;cursor:pointer;transition:all .15s; }
.sg-back-btn:hover { background:var(--bg-elevated);color:var(--text-primary); }
.sg-v2-loc-address { font-size:.75rem;color:var(--text-muted);display:flex;align-items:center;gap:6px; }
.sg-loc-label { font-size:.75rem;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:4px; }

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
.sg-subst-modal-box {
    width:480px;max-width:95vw;
    display:flex;flex-direction:column;
    max-height:85vh;
}
.sg-subst-tabs {
    display:flex;gap:6px;
    padding-bottom:12px;
    border-bottom:1px solid var(--border);
    margin-bottom:12px;
}
.sg-subst-tab {
    flex:1;padding:8px 12px;border-radius:8px;
    border:1px solid var(--border);background:var(--bg-raised);
    color:var(--text-muted);font-size:.85rem;font-weight:600;
    cursor:pointer;transition:all .15s;
    display:flex;align-items:center;justify-content:center;gap:6px;
}
.sg-subst-tab.active {
    border-color:var(--primary);
    background:rgba(99,102,241,.1);
    color:var(--text-primary);
}
.sg-stab-count {
    background:var(--bg-hover);border-radius:10px;
    padding:1px 7px;font-size:.75rem;
}
.sg-subst-tab.active .sg-stab-count {
    background:var(--primary);color:#fff;
}
.sg-subst-tab-content { flex:1;overflow:hidden; }
.sg-subst-modal-scroll {
    max-height:520px;overflow-y:auto;
    scrollbar-width:thin;scrollbar-color:var(--border) transparent;
}
.sg-subst-scroll {
    max-height:calc(9 * 44px);overflow-y:auto;
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
.sg-sub-last-shift { font-size:.68rem;color:var(--text-muted);display:inline-flex;align-items:center;gap:3px;margin-top:2px; }
.sg-sub-last-recent { color:#f59e0b;font-weight:600; }
.sg-subst-position { font-size:.7rem;color:var(--text-secondary);margin-top:1px; }
.sg-subst-meta { font-size:.7rem;color:var(--text-muted);margin-top:1px; }
.sg-subst-meta-val { font-weight:700;color:var(--primary); }
.sg-subst-empty { font-size:.82rem;color:var(--text-muted);font-style:italic;padding:8px 0; }
.sg-loc-group-header {
    padding:9px 16px;font-size:1rem;font-weight:500;
    text-transform:uppercase;letter-spacing:.07em;
    color:#7a93a8;
    text-shadow:none;
    background:rgba(100,130,155,.08);
    border-top:2px solid rgba(100,130,155,.2);
    border-bottom:1px solid rgba(100,130,155,.15);
}
.light-theme .sg-loc-group-header {
    background:rgba(90,120,145,.1);
    border-top-color:rgba(90,120,145,.25);
    border-bottom-color:rgba(90,120,145,.18);
    color:#4a6580;
    text-shadow:none;
}
.sg-loc-end-row td {
    height:12px;padding:0;
    background:transparent;
    border-bottom:2px solid rgba(99,102,241,.12);
}
.sg-sd-col { background:rgba(99,102,241,.1) !important; }
.sg-th-day.sg-sd-col { background:rgba(99,102,241,.15) !important;color:var(--primary); }
.sg-free-cell { background:rgba(16,185,129,.08) !important; }
.sg-busy-cell { background:rgba(239,68,68,.06) !important; }
.sg-free-dot  { font-size:.6rem;color:#10b981;opacity:.6; }
.sg-row-free td.sg-td-name { border-left:3px solid #10b981; }
.sg-row-busy td.sg-td-name { border-left:3px solid #ef4444; }

/* Work hours bar */
.sg-loc-name-ico { font-size:1rem; }
.sg-loc-name-text { font-size:.95rem;font-weight:700;color:var(--text-primary); }
.sg-wh-sep { color:var(--border);font-size:1rem;margin:0 2px; }
.sg-v2-loc-card .sg-loc-name-edit,
.sg-v2-loc-card .sg-wh-edit,
.sg-v2-loc-card .sg-loc-del-btn { opacity:0;transition:opacity .15s,color .15s,background .15s; }
.sg-v2-loc-card:hover .sg-loc-name-edit,
.sg-v2-loc-card:hover .sg-wh-edit,
.sg-v2-loc-card:hover .sg-loc-del-btn { opacity:1; }
.sg-loc-name-edit {
    border:none;background:none;cursor:pointer;font-size:.9rem;
    color:var(--text-muted);transition:color .15s;padding:2px 4px;border-radius:6px;
}
.sg-loc-name-edit:hover { color:var(--text-primary);background:var(--bg-hover); }
.sg-view-only-badge {
    display:inline-flex;align-items:center;gap:4px;
    font-size:.75rem;font-weight:600;padding:2px 8px;border-radius:20px;
    background:rgba(139,92,246,.12);color:#8b5cf6;border:1px solid rgba(139,92,246,.25);
}
.sg-loc-item-ro { font-size:.7rem;opacity:.7; }
.sg-loc-view-only .sg-loc-item { opacity:.85; }
.sg-work-hours-bar {
    display:flex;align-items:center;gap:10px;flex-wrap:wrap;
    padding:10px 20px;border-bottom:1px solid var(--border);
    background:var(--bg-raised);font-size:.875rem;
}
.sg-wh-label { color:var(--text-muted);font-weight:600; }
.sg-loc-creator { display:inline-flex;align-items:center;gap:5px;font-size:.8rem;font-weight:600;color:var(--text-muted); }
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

/* Partners button */
.sg-partners-btn {
    padding:8px 14px;border-radius:10px;font-size:.82rem;font-weight:700;cursor:pointer;
    border:2px solid rgba(16,185,129,.3);background:rgba(16,185,129,.07);color:#10b981;
    transition:all .15s;display:flex;align-items:center;gap:5px;
}
.sg-partners-btn:hover { background:#10b981;color:#fff;border-color:#10b981; }
.sg-partners-badge {
    display:inline-flex;align-items:center;justify-content:center;
    min-width:16px;height:16px;border-radius:8px;font-size:.65rem;font-weight:700;
    background:#ef4444;color:#fff;padding:0 4px;
}

/* Partners modal */
.sg-partners-modal-box { max-width:520px; }
.sg-partners-section { padding:8px 0;border-bottom:1px solid var(--border); }
.sg-partners-section:last-child { border-bottom:none; }
.sg-partners-section-title {
    font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;
    letter-spacing:.05em;padding:6px 0 8px;
}
.sg-partners-row {
    display:flex;align-items:center;gap:10px;
    padding:7px 4px;border-radius:8px;transition:background .1s;
}
.sg-partners-row:hover { background:var(--bg-raised); }
.sg-partners-info { flex:1;min-width:0; }
.sg-partners-name { font-size:.875rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.sg-partners-status { font-size:.72rem;color:var(--text-muted); }
.sg-partners-status.accepted { color:#10b981; }
.sg-partners-status.pending  { color:#f59e0b; }
.sg-partners-accept {
    padding:4px 10px;border-radius:7px;border:none;cursor:pointer;font-size:.78rem;font-weight:700;
    background:rgba(16,185,129,.15);color:#10b981;transition:background .15s;
}
.sg-partners-accept:hover { background:#10b981;color:#fff; }
.sg-partners-decline {
    width:26px;height:26px;border-radius:6px;border:none;cursor:pointer;font-size:.8rem;
    background:rgba(239,68,68,.1);color:#ef4444;transition:background .15s;
}
.sg-partners-decline:hover { background:#ef4444;color:#fff; }
.sg-partners-del {
    width:28px;height:28px;border-radius:7px;border:1px solid var(--border);
    background:var(--bg-raised);color:var(--text-muted);cursor:pointer;font-size:.8rem;
    transition:all .15s;
}
.sg-partners-del:hover { background:#fee2e2;color:#ef4444;border-color:#ef4444; }
.sg-partners-empty { font-size:.82rem;color:var(--text-muted);padding:6px 0; }
.sg-partners-add { display:flex;gap:8px;align-items:center;padding:4px 0; }

/* Partner rows in table */
.sg-row-partner td { background:rgba(99,102,241,.04); }
.sg-row-partner td.sg-td-name { border-left:3px solid rgba(99,102,241,.4); }
.sg-cell-partner { cursor:default !important; }
.sg-loc-header-partner .sg-loc-group-header {
    background:rgba(99,102,241,.13);color:rgba(99,102,241,.9);
    border-top-color:rgba(99,102,241,.3);border-bottom-color:rgba(99,102,241,.2);
}
.sg-show-partners-btn {
    border:1.5px solid rgba(99,102,241,.3);border-radius:20px;
    background:rgba(99,102,241,.06);color:rgba(99,102,241,.85);
    font-size:.78rem;font-weight:600;padding:6px 18px;cursor:pointer;
    transition:all .15s;
}
.sg-show-partners-btn:hover { background:rgba(99,102,241,.14);border-color:rgba(99,102,241,.5); }
.sg-partner-loc-badge {
    font-size:.68rem;font-weight:600;opacity:.7;
    background:rgba(99,102,241,.15);border-radius:4px;padding:1px 6px;margin-left:6px;
}
.sg-subst-partner {
    background:rgba(99,102,241,.05) !important;
    border-left:3px solid rgba(99,102,241,.35);
    cursor:default !important;
    opacity:.85;
}
.sg-subst-section-sep {
    font-size:.72rem;color:var(--text-muted);font-style:italic;
    padding:8px 4px 4px;margin-top:6px;
    border-top:1px solid var(--border);
}

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
.sg-emp-req-box { max-width:420px;height:auto !important; }
.sg-rm-emp-box { max-width:340px;height:auto !important;text-align:center;padding:24px 20px; }
.sg-rm-emp-icon { width:56px;height:56px;border-radius:50%;background:rgba(239,68,68,.1);color:#ef4444;display:flex;align-items:center;justify-content:center;font-size:1.4rem;margin:0 auto 14px; }
.sg-rm-emp-title { font-size:1.05rem;font-weight:700;color:var(--text-primary);margin-bottom:6px; }
.sg-rm-emp-name { font-size:.9rem;font-weight:600;color:var(--primary);background:color-mix(in srgb,var(--primary) 8%,var(--bg-raised));border-radius:8px;padding:6px 14px;display:inline-block;margin-bottom:10px; }
.sg-rm-emp-hint { font-size:.78rem;color:var(--text-muted);line-height:1.5; }
.sg-rm-emp-confirm { flex:1;height:42px;border-radius:10px;border:1.5px solid rgba(239,68,68,.4);background:rgba(239,68,68,.08);color:#ef4444;font-size:.9rem;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;gap:6px; }
.sg-rm-emp-confirm:hover { background:#ef4444;color:#fff;border-color:#ef4444; }
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
    display:flex;align-items:center;gap:0;
    padding:10px 16px;border-bottom:1px solid var(--border);flex-wrap:wrap;
}
.sg-tb-section {
    display:flex;flex-direction:column;gap:5px;padding:4px 14px;
}
.sg-tb-section:first-child { padding-left:4px; }
.sg-tb-label {
    font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;
    color:var(--text-muted);white-space:nowrap;
}
.sg-tb-divider {
    width:1px;background:var(--border);align-self:stretch;margin:4px 0;flex-shrink:0;
}
.sg-legend { display:flex;flex-wrap:wrap;gap:5px;align-items:center; }
.sg-tb-section .sg-legend { display:grid;grid-template-columns:repeat(3,auto);gap:5px 8px;align-items:center; }
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
.sg-types-mgr-btn {
    padding:5px 8px;border-radius:8px;font-size:1rem;cursor:pointer;line-height:1;
    border:1.5px solid rgba(99,102,241,.3);background:rgba(99,102,241,.07);color:#6366f1;
    transition:all .15s;white-space:nowrap;flex-shrink:0;
}
.sg-types-mgr-btn:hover { background:#6366f1;color:#fff;border-color:#6366f1; }
.sg-types-modal-box { max-width:480px;padding:20px 20px 20px; }
.sg-type-row {
    display:flex;align-items:center;gap:8px;padding:9px 12px;
    border-radius:10px;background:var(--bg-raised);border:1px solid var(--border);
    transition:border-color .15s;
}
.sg-type-row:hover { border-color:rgba(99,102,241,.35); }
.sg-type-row-label { flex:1;font-size:.85rem;font-weight:600;color:var(--text-primary); }
.sg-type-edit-btn,.sg-type-del-btn {
    padding:4px 9px;border-radius:7px;font-size:.78rem;cursor:pointer;flex-shrink:0;
    border:1px solid var(--border);background:transparent;color:var(--text-muted);transition:all .15s;
}
.sg-type-edit-btn:hover { border-color:#6366f1;color:#6366f1;background:rgba(99,102,241,.07); }
.sg-type-del-btn:hover { border-color:#ef4444;color:#ef4444;background:rgba(239,68,68,.07); }
.sg-btn-add-type {
    display:flex;align-items:center;justify-content:center;gap:6px;
    padding:9px 16px;border-radius:10px;font-size:.83rem;font-weight:600;
    border:2px dashed var(--border);background:transparent;color:var(--text-muted);
    cursor:pointer;transition:all .18s;width:100%;box-sizing:border-box;
}
.sg-btn-add-type:hover { border-color:#6366f1;color:#6366f1;background:rgba(99,102,241,.06); }
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
    scrollbar-width:none;
}
.sg-scroll-wrap::-webkit-scrollbar { display:none; }
.sg-table { width:max-content;min-width:100%;border-collapse:separate;border-spacing:0; }
.sg-th-name {
    text-align:left;padding:10px 16px;font-size:.75rem;font-weight:700;
    text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);
    border-bottom:1px solid var(--border);border-right:1px solid var(--border);background:var(--bg-raised);
    position:relative;z-index:10;width:300px;min-width:300px;max-width:300px;white-space:nowrap;overflow:hidden;
    box-shadow:2px 0 8px rgba(0,0,0,.12);
}
.sg-th-day {
    padding:4px 2px;text-align:center;min-width:30px;
    border-bottom:1px solid var(--border);border-left:1px solid var(--border-light,rgba(255,255,255,.05));
    background:var(--bg-raised);overflow:hidden;position:relative;z-index:1;
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
    padding:8px 6px;border-bottom:1px solid var(--border);background:var(--bg-raised);
    text-align:center;white-space:nowrap;width:36px;
}
.sg-th-sum-inner {
    font-size:1rem;font-weight:800;color:var(--primary);line-height:1;
}
.sg-th-sub {
    font-size:.6rem;font-weight:600;text-transform:uppercase;
    letter-spacing:.05em;color:var(--text-muted);margin-top:2px;
}
.sg-td-name {
    padding:4px 12px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);
    background:var(--bg-raised);position:relative;z-index:9;
    width:300px;min-width:300px;max-width:300px;overflow:hidden;
    display:flex;align-items:center;gap:4px;
    box-shadow:2px 0 8px rgba(0,0,0,.12);
}
.sg-emp-chip { display:flex;align-items:center;gap:8px;min-width:0; }
.sg-name-info { min-width:0;flex:1;overflow:hidden; }
.sg-name-full {
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    font-size:.78rem;font-weight:500;color:var(--text-primary);
    line-height:1;display:flex;align-items:center;gap:5px;
}
.sg-name-deleted { color:var(--text-muted);font-style:italic; }
.sg-cell-fired { background:repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(0,0,0,.03) 4px,rgba(0,0,0,.03) 8px) !important;cursor:default; }
.sg-cell-sub { border-bottom:2px solid rgba(139,92,246,.3) !important; }
.sg-cell-no-work { background:rgba(239,68,68,.07) !important;border-top:2px solid rgba(239,68,68,.35) !important; }
.sg-th-day.sg-th-no-work { background:rgba(239,68,68,.12) !important;color:#ef4444 !important; }
.sg-deleted-badge {
    font-size:.65rem;font-weight:600;padding:1px 5px;border-radius:4px;
    background:rgba(239,68,68,.1);color:#ef4444;white-space:nowrap;flex-shrink:0;
}
.sg-temp-badge {
    font-size:.6rem;font-weight:600;padding:1px 4px;border-radius:4px;
    background:rgba(239,68,68,.12);color:#f87171;white-space:nowrap;flex-shrink:0;
}
.sg-drag-handle {
    cursor:grab;color:var(--text-muted);font-size:1rem;margin-right:6px;
    opacity:.4;flex-shrink:0;user-select:none;
}
.sg-td-name:hover .sg-drag-handle { opacity:1; }
.sg-drag-handle:active { cursor:grabbing; }
tr.sg-row-dragging { opacity:.4; }
tr.sg-row-drag-over td { background:rgba(99,102,241,.12) !important;border-top:2px solid var(--primary) !important; }

.sg-primary-btn {
    background:none;border:none;cursor:pointer;padding:0 3px 0 0;font-size:.85rem;
    color:var(--text-muted);line-height:1;flex-shrink:0;opacity:.45;transition:opacity .15s;
}
.sg-primary-btn:hover { opacity:1; }
.sg-primary-btn.active { color:#f59e0b;opacity:1; }
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
    padding:2px 1px;text-align:center;border-bottom:1px solid var(--border);
    border-left:1px solid var(--border-light,rgba(255,255,255,.05));
    cursor:pointer;transition:background .12s;height:22px;vertical-align:middle;
    overflow:hidden;min-width:30px;
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
    text-align:center;padding:3px 8px;border-bottom:1px solid var(--border);
    font-weight:800;color:var(--primary);font-size:.82rem;
    border-left:2px solid var(--border);
}
.sg-rm { display:inline-flex;align-items:center;padding:3px 6px;border-radius:6px;border:none;background:none;color:var(--text-muted);cursor:pointer;font-size:.8rem;transition:all .15s; }
.sg-rm:hover { background:rgba(239,68,68,.1);color:#ef4444; }
.sg-rm-inline { opacity:0;margin-left:auto;flex-shrink:0; }
.sg-td-name:hover .sg-rm-inline { opacity:1; }
.sg-rm span { font-size:.7rem; }
.sg-rm:hover { background:rgba(239,68,68,.15);border-color:#ef4444; }
tr:hover .sg-td-name,.sg-table tr:hover .sg-cell { background:var(--bg-hover); }
tr:hover .sg-td-name { background:var(--bg-raised); }
tr:last-child td { border-bottom:none; }

/* Log */
.sg-log-list { padding:8px 0; }
.sg-log-table { width:100%;border-collapse:collapse;font-size:.82rem; }
.sg-log-table thead th { padding:8px 12px;text-align:left;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);border-bottom:2px solid var(--border);white-space:nowrap; }
.sg-log-table td:nth-child(1),
.sg-log-table td:nth-child(2) { white-space:nowrap; }
.sg-log-table th:nth-child(4),
.sg-log-table th:nth-child(6) { width:100px; }
.sg-log-table tbody tr { border-bottom:1px solid var(--border);transition:background .12s; }
.sg-log-table tbody tr:last-child { border-bottom:none; }
.sg-log-table tbody tr:hover { background:var(--bg-raised); }
.sg-log-table td { padding:10px 12px;vertical-align:middle; }
.sg-log-tr-request { border-left:3px solid #f59e0b;background:rgba(245,158,11,.04); }
.sg-log-tr-request:hover { background:rgba(245,158,11,.08) !important; }
.sg-log-request { font-size:.78rem;color:#d97706;display:flex;align-items:center;gap:4px; }
.sg-log-who { font-weight:600;color:var(--text-primary);white-space:nowrap; }
.sg-log-emp { color:var(--text-muted);white-space:nowrap; }
.sg-log-datecel { padding:2px 8px;border-radius:20px;background:var(--bg-raised);color:var(--primary);font-size:.72rem;font-weight:600;white-space:nowrap;display:inline-block; }
.sg-log-arrow { color:var(--text-muted);text-align:center;font-size:.8rem; }
.sg-log-new { color:#10b981;font-weight:500; }
.sg-log-del { color:#ef4444;font-weight:500; }
.sg-log-empty { color:var(--text-muted);font-style:italic; }
.sg-log-time { color:var(--text-muted);font-size:.72rem;white-space:nowrap; }

/* Modal overlay */
.sg-overlay {
    position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;
    display:flex;align-items:center;justify-content:center;padding:16px;
    backdrop-filter:blur(4px);animation:fadeIn .15s;
}
.sg-modal {
    background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;
    padding:24px;width:100%;max-width:540px;height:580px;max-height:80vh;overflow-y:auto;
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
.sg-emp-fn { font-weight:700;color:#2563eb;font-size:.9rem; }
.sg-emp-meta { font-size:.75rem;color:var(--text-secondary);margin-top:2px; }
.sg-emp-mgr { font-size:.72rem;color:var(--text-muted);margin-top:2px;display:flex;align-items:center;gap:4px; }
.sg-emp-dovs { display:flex;flex-wrap:wrap;gap:4px;margin-top:4px; }
.sg-emp-dov { font-size:.68rem;font-weight:600;padding:2px 7px;border-radius:10px; }
.sg-emp-dov-0 { background:rgba(37,99,235,.1);color:#2563eb; }
.sg-emp-dov-1 { background:rgba(16,185,129,.1);color:#059669; }
.sg-emp-dov-2 { background:rgba(245,158,11,.1);color:#d97706; }
.sg-emp-dov-3 { background:rgba(139,92,246,.1);color:#7c3aed; }

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
/* Cross-location day_off badge (first 3 chars of other location name) */
.sg-other-loc-badge { font-size:.6rem;font-weight:700;color:var(--text-muted);opacity:.65;letter-spacing:.02em;line-height:1; }

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
.sg-sub-cnt-badge {
    font-size:.7rem;font-weight:700;padding:2px 6px;border-radius:6px;
    border:1px solid;white-space:nowrap;flex-shrink:0;
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
/* Subst report button */
.sg-subrep-btn {
    display:flex;align-items:center;gap:6px;padding:7px 13px;border-radius:10px;
    border:1.5px solid rgba(245,158,11,.35);background:rgba(245,158,11,.08);
    color:var(--text-primary);font-size:.82rem;font-weight:600;cursor:pointer;transition:background .15s;
}
.sg-subrep-btn:hover { background:rgba(245,158,11,.15);border-color:#f59e0b; }
/* Subst report modal */
.sg-srep-modal { max-width:800px;width:96vw;padding:0;overflow:hidden;display:flex;flex-direction:column;max-height:min(88vh,780px); }
.sg-modal-close { display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;border:none;background:transparent;color:var(--text-secondary);font-size:1.1rem;cursor:pointer;transition:background .15s,color .15s;flex-shrink:0; }
.sg-modal-close:hover { background:rgba(239,68,68,.12);color:#ef4444; }
.sg-srep-head { display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);flex-shrink:0;gap:16px; }
.sg-srep-head-left { display:flex;align-items:center;gap:12px; }
.sg-srep-ico { font-size:1.4rem;line-height:1; }
.sg-srep-title { font-size:1rem;font-weight:700;color:var(--text-primary);line-height:1.2; }
.sg-srep-subtitle { font-size:.75rem;color:var(--text-muted);margin-top:1px; }
.sg-srep-head-right { display:flex;align-items:center;gap:12px;flex-shrink:0; }
.sg-srep-stat { display:flex;flex-direction:column;align-items:center;gap:0; }
.sg-srep-stat-n { font-size:1.1rem;font-weight:800;color:var(--text-primary);line-height:1; }
.sg-srep-stat-l { font-size:.65rem;color:var(--text-muted);white-space:nowrap; }
.sg-srep-stat-sep { width:1px;height:28px;background:var(--border); }
.sg-srep-body { flex:1;overflow-y:auto; }
.sg-srep-table { width:100%;border-collapse:collapse;table-layout:fixed; }
.sg-srep-th { position:sticky;top:0;z-index:1;padding:8px 14px;font-size:.68rem;font-weight:700;color:var(--text-muted);text-align:left;text-transform:uppercase;letter-spacing:.05em;background:var(--bg-raised);border-bottom:2px solid var(--border); }
.sg-srep-th-emp { width:38%; }
.sg-srep-tr-first td { border-top:3px solid var(--primary); }
.sg-srep-tr-first:first-child td { border-top:none; }
.sg-srep-tr-odd td:not(.sg-srep-td-emp) { background:var(--bg-raised); }
.sg-srep-td { padding:7px 14px;font-size:.8rem;color:var(--text-primary);border-bottom:1px solid var(--border);vertical-align:top; }
.sg-srep-td-emp { background:var(--bg-raised);vertical-align:top;border-right:1px solid var(--border); }
.sg-srep-td-first { padding:10px 14px; }
.sg-srep-emp-inner { display:flex;align-items:flex-start;gap:8px; }
.sg-srep-av { width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;color:#fff;flex-shrink:0;margin-top:1px; }
.sg-srep-pinfo { flex:1;min-width:0; }
.sg-srep-name { font-size:.85rem;font-weight:700;color:var(--text-primary);word-break:break-word; }
.sg-srep-meta { font-size:.7rem;color:var(--text-muted);margin-top:1px; }
.sg-srep-cnt-inline { display:inline-block;margin-top:5px;font-size:.68rem;font-weight:700;padding:1px 7px;border-radius:20px;background:rgba(245,158,11,.13);color:#f59e0b; }
.sg-srep-td-date { font-weight:600;white-space:nowrap;width:90px;color:var(--text-primary); }
.sg-srep-td-loc { color:var(--text-secondary); }
.sg-srep-td-addr { color:var(--text-muted);font-size:.75rem; }
.sg-srep-status { font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap; }
.sg-srep-status--done { background:rgba(16,185,129,.12);color:#10b981; }
.sg-srep-status--vol  { background:rgba(99,102,241,.10);color:#6366f1; }
/* Can-sub list button */
.sg-cansub-list-btn {
    display:flex;align-items:center;gap:6px;padding:7px 13px;border-radius:10px;
    border:1.5px solid rgba(99,102,241,.35);background:rgba(99,102,241,.08);
    color:var(--text-primary);font-size:.82rem;font-weight:600;cursor:pointer;transition:background .15s;
}
.sg-cansub-list-btn:hover { background:rgba(99,102,241,.15);border-color:#6366f1; }
.sg-cansub-badge { display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#6366f1;color:#fff;font-size:.7rem;font-weight:700;line-height:1; }
/* Can-sub list modal */
.sg-csl-modal { max-width:500px;padding:0;overflow:hidden;display:flex;flex-direction:column;max-height:min(600px,90vh); }
.sg-csl-header { padding:18px 20px 12px;border-bottom:1px solid var(--border);flex-shrink:0; }
.sg-csl-title-row { display:flex;align-items:center;gap:10px;margin-bottom:10px; }
.sg-csl-title { font-size:1.05rem;font-weight:700;color:var(--text-primary);flex:1; }
.sg-csl-count {
    font-size:.75rem;font-weight:700;padding:2px 9px;border-radius:20px;
    background:rgba(99,102,241,.12);color:#6366f1;
}
.sg-csl-search-wrap { position:relative; }
.sg-csl-search-ico { position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:.8rem;pointer-events:none; }
.sg-csl-search {
    width:100%;padding:8px 12px 8px 32px;border-radius:10px;
    border:1.5px solid var(--border);background:var(--bg-raised);
    color:var(--text-primary);font-size:.85rem;outline:none;box-sizing:border-box;
}
.sg-csl-search:focus { border-color:#6366f1; }
.sg-csl-list {
    flex:1;overflow-y:auto;padding:10px 16px 16px;
    display:flex;flex-direction:column;gap:6px;
}
.sg-csl-row {
    display:flex;align-items:flex-start;gap:12px;
    padding:10px 12px;border-radius:12px;background:var(--bg-raised);
    border:1px solid var(--border);
}
.sg-csl-av { width:38px;height:38px;font-size:.78rem;flex-shrink:0; }
.sg-csl-info { flex:1;min-width:0; }
.sg-csl-name { font-size:.88rem;font-weight:600;color:var(--text-primary); }
.sg-csl-meta { display:flex;flex-wrap:wrap;gap:6px;margin-top:3px;align-items:center; }
.sg-csl-loc  { font-size:.72rem;font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:3px; }
.sg-csl-pos  { font-size:.72rem;color:var(--text-muted); }
.sg-csl-city { font-size:.72rem;color:var(--text-muted);display:flex;align-items:center;gap:3px; }
.sg-csl-chips { display:flex;flex-wrap:wrap;gap:4px;margin-top:6px; }
.sg-csl-chip { font-size:.7rem;font-weight:600;padding:2px 8px;border-radius:20px;white-space:nowrap; }
.sg-csl-chip--future { background:rgba(16,185,129,.12);color:#10b981; }
.sg-csl-chip--past   { background:var(--bg-hover);color:var(--text-muted); }
.sg-csl-chip--conf   { background:rgba(99,102,241,.13);color:#6366f1; }
.sg-csl-chip-loc     { opacity:.7;font-weight:500; }
.sg-csl-empty {
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:10px;padding:40px 20px;color:var(--text-muted);font-size:.85rem;text-align:center;
}
.sg-csl-empty-ico { font-size:2.2rem; }
.sg-cand-section { margin-bottom:4px; }
.sg-cand-hdr { font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px; }
.sg-cand-list { display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto; }
.sg-cand-row {
    display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;
    background:var(--bg-raised);cursor:pointer;transition:background .15s;
}
.sg-cand-row:hover { background:var(--bg-hover); }
.sg-cand-av { width:32px;height:32px;font-size:.72rem;flex-shrink:0; }
.sg-cand-info { flex:1;min-width:0; }
.sg-cand-name { font-size:.85rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.sg-cand-meta { display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:2px; }
.sg-cand-dov { font-size:.72rem;color:var(--text-muted); }
.sg-cand-dates { font-size:.72rem;color:var(--text-muted); }
.sg-cand-arr { font-size:.65rem;color:var(--text-muted);flex-shrink:0; }

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
.sg-td-add-emp { padding:6px 10px;border-top:1px dashed var(--border);background:color-mix(in srgb,var(--primary) 4%,var(--bg-surface)); }
.sg-add-emp-ghost {
    display:inline-flex;align-items:center;gap:6px;
    padding:6px 14px;border-radius:8px;border:1.5px dashed color-mix(in srgb,var(--primary) 40%,transparent);
    background:color-mix(in srgb,var(--primary) 8%,transparent);color:var(--primary);font-size:.8rem;cursor:pointer;
    transition:all .15s;opacity:.75;
}
.sg-add-emp-ghost:hover { opacity:1;border-color:var(--primary);background:color-mix(in srgb,var(--primary) 14%,transparent); }
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

/* Block name display in partners modal */
.sg-block-name-row {
    display:flex;align-items:center;gap:10px;
    padding:12px 16px;margin-bottom:4px;
    border-radius:12px;
    background:linear-gradient(135deg,rgba(99,102,241,.07),rgba(99,102,241,.03));
    border:1.5px solid rgba(99,102,241,.15);
}
.sg-block-name-ico { font-size:1.1rem;flex-shrink:0; }
.sg-block-name-content { flex:1;min-width:0; }
.sg-block-name-label {
    display:block;font-size:.68rem;font-weight:700;text-transform:uppercase;
    letter-spacing:.06em;color:var(--text-muted);margin-bottom:2px;
}
.sg-block-name-value { font-size:.9rem;color:var(--text-primary); }
.sg-block-rename-btn {
    flex-shrink:0;padding:5px 12px;border-radius:8px;
    border:1.5px solid rgba(99,102,241,.3);
    background:transparent;color:var(--primary);
    font-size:.78rem;font-weight:600;cursor:pointer;
    transition:all .15s;white-space:nowrap;
}
.sg-block-rename-btn:hover {
    background:var(--primary);color:#fff;border-color:var(--primary);
}

/* Accordion: collapse/expand locations */
.sg-loc-chevron {
    display:inline-block;width:18px;font-size:1rem;opacity:.55;
    margin-right:4px;
}
.sg-loc-meta {
    float:right;display:flex;gap:12px;font-size:.75rem;
    opacity:.6;font-weight:500;margin-right:4px;
}
.sg-loc-emp-count,.sg-loc-work-count { white-space:nowrap; }
.sg-loc-collapsed-hint {
    font-size:.72rem;font-weight:400;opacity:.5;margin-left:6px;
}
.sg-loc-group-header { user-select:none; }
.sg-loc-acc-addr { font-size:1rem;font-weight:400;opacity:.8;margin-left:8px;letter-spacing:0;text-transform:none;display:inline-flex;align-items:center;gap:4px; }

.sg-loc-header-row td { padding-top:10px;padding-bottom:10px;border-top:8px solid transparent; }
.sg-loc-header-row:first-child td { border-top:none; }
.sg-loc-header-row:nth-child(odd) td { background:rgba(100,130,155,.06); }
.sg-loc-header-row:hover td { background:rgba(100,130,155,.12); }
.sg-collapse-all-btn {
    display:inline-flex;align-items:center;gap:5px;
    font-size:.75rem;font-weight:500;padding:5px 12px;border-radius:20px;
    border:1.5px solid var(--border);background:var(--bg-raised);
    color:var(--text-muted);cursor:pointer;transition:all .15s;white-space:nowrap;
}
.sg-collapse-all-btn:hover { background:rgba(100,130,155,.12);color:#7a93a8;border-color:rgba(100,130,155,.35); }

/* Employee name filter (all-locations view) */
.sg-td-name--clickable {
    cursor:pointer;transition:background .15s;
}
.sg-td-name--clickable:hover {
    background:rgba(99,102,241,.08);
}
.sg-td-name--active {
    background:rgba(99,102,241,.13) !important;
}
.sg-td-name--active .sg-name-full {
    color:var(--primary);font-weight:700;
}
.sg-filter-active-badge {
    display:inline-block;font-size:.65rem;font-weight:700;
    background:var(--primary);color:#fff;
    border-radius:6px;padding:1px 5px;margin-left:4px;
    vertical-align:middle;
}

/* Sticky bottom scrollbar */
#sg-sticky-bar {
    display:none;position:fixed;bottom:0;z-index:500;box-sizing:border-box;
    background:var(--bg-surface);border-top:1px solid var(--border);padding:4px 0;
}
#sg-sticky-inner {
    overflow-x:auto;height:20px;
    scrollbar-width:auto;scrollbar-color:var(--primary) var(--border);
}
#sg-sticky-inner::-webkit-scrollbar { height:20px; }
#sg-sticky-inner::-webkit-scrollbar-track { background:var(--border);border-radius:10px; }
#sg-sticky-inner::-webkit-scrollbar-thumb { background:var(--primary);border-radius:10px; }
#sg-sticky-inner::-webkit-scrollbar-thumb:hover { filter:brightness(1.15); }
#sg-sticky-spacer { height:1px; }
</style>`;
    },

    _initStickyScroll() {
        if (this._cleanupStickyScroll) { this._cleanupStickyScroll(); this._cleanupStickyScroll = null; }

        const bar = document.createElement('div');
        bar.id = 'sg-sticky-bar';
        bar.innerHTML = '<div id="sg-sticky-inner"><div id="sg-sticky-spacer"></div></div>';
        document.body.appendChild(bar);

        const inner = bar.querySelector('#sg-sticky-inner');
        const spacer = bar.querySelector('#sg-sticky-spacer');

        const getActiveWrap = () => {
            for (const id of ['sg-wrap-main','sg-wrap-subst','sg-wrap-all']) {
                const el = document.getElementById(id);
                if (el && el.getBoundingClientRect().width > 0) return el;
            }
            return null;
        };

        let syncing = false;

        const update = () => {
            const wrap = getActiveWrap();
            if (!wrap) { bar.style.display = 'none'; return; }
            const rect = wrap.getBoundingClientRect();
            const hasOverflow = wrap.scrollWidth > wrap.clientWidth + 2;
            bar.style.display = hasOverflow ? 'block' : 'none';
            bar.style.left    = rect.left + 'px';
            bar.style.width   = rect.width + 'px';
            spacer.style.width = wrap.scrollWidth + 'px';
            if (!syncing) inner.scrollLeft = wrap.scrollLeft;
        };

        inner.addEventListener('scroll', () => {
            if (syncing) return;
            syncing = true;
            const wrap = getActiveWrap();
            if (wrap) wrap.scrollLeft = inner.scrollLeft;
            requestAnimationFrame(() => { syncing = false; });
        });

        const onWrapScroll = () => {
            if (syncing) return;
            syncing = true;
            const wrap = getActiveWrap();
            if (wrap) inner.scrollLeft = wrap.scrollLeft;
            requestAnimationFrame(() => { syncing = false; update(); });
        };

        document.querySelectorAll('.sg-scroll-wrap').forEach(w => {
            w.addEventListener('scroll', onWrapScroll);
            w.addEventListener('wheel', e => {
                if (w.scrollWidth <= w.clientWidth + 2) return;
                e.preventDefault();
                w.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX;
            }, { passive: false });
        });

        // ResizeObserver — надёжнее rAF: срабатывает когда браузер посчитал размеры
        const ro = new ResizeObserver(() => requestAnimationFrame(update));
        document.querySelectorAll('.sg-scroll-wrap').forEach(w => ro.observe(w));
        document.querySelectorAll('.sg-scroll-wrap .sg-table').forEach(t => ro.observe(t));

        let _resizeRaf;
        const onResize = () => {
            cancelAnimationFrame(_resizeRaf);
            _resizeRaf = requestAnimationFrame(() => requestAnimationFrame(update));
        };
        window.addEventListener('resize', onResize);

        this._cleanupStickyScroll = () => {
            bar.remove();
            ro.disconnect();
            window.removeEventListener('resize', onResize);
        };
    },

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
    _quickType: null,
    _subMode: false,

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
            .select('id, name, locked_months, work_start, work_end, address, phone')
            .in('id', locIds);
        const locs = lData || [];

        this._assignments = assignRows.map(a => {
            const loc = locs.find(l => l.id === a.location_id) || {};
            return {
                locId:         a.location_id,
                locName:       loc.name || 'Локація',
                locked_months: loc.locked_months || [],
                work_start:    loc.work_start || null,
                work_end:      loc.work_end   || null,
                address:       loc.address || null,
                phone:         loc.phone || null,
            };
        });

        if (!this._locId || !this._assignments.find(a => a.locId === this._locId))
            this._locId = this._assignments[0].locId;
        await this._loadEntries();
    },

    async _loadEntries() {
        const p = n => String(n).padStart(2, '0');
        const dateFrom = `${this._year}-${p(this._month + 1)}-01`;
        const dateTo   = `${this._year}-${p(this._month + 1)}-${new Date(this._year, this._month + 1, 0).getDate()}`;

        // Load ALL entries for location (to show colleagues)
        const [myRes, allRes, assignRes] = await Promise.all([
            supabase.from('schedule_entries').select('*')
                .eq('location_id', this._locId).eq('user_id', AppState.user.id)
                .gte('date', dateFrom).lte('date', dateTo),
            supabase.from('schedule_entries').select('*')
                .eq('location_id', this._locId)
                .gte('date', dateFrom).lte('date', dateTo),
            supabase.from('schedule_assignments')
                .select('id, user_id, employee_name, original_user_id, is_primary')
                .eq('location_id', this._locId)
        ]);

        this._entries = {};
        (myRes.data || []).forEach(e => { this._entries[e.date] = e; });

        this._locEntries = {};
        (allRes.data || []).forEach(e => { this._locEntries[`${e.user_id}_${e.date}`] = e; });

        // Load profiles for colleagues
        const assigns = assignRes.data || [];
        const pIds = [...new Set(assigns.map(a => a.user_id).filter(Boolean))];
        let profiles = {};
        if (pIds.length) {
            const { data: pData } = await supabase.from('profiles').select('id, full_name, job_position').in('id', pIds);
            profiles = Object.fromEntries((pData || []).map(p => [p.id, p]));
        }
        this._locAssignments = assigns.map(a => ({ ...a, profile: profiles[a.user_id] || null }));

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

        // Cross-location entries for all users shown in this table (to display other-loc badges)
        this._crossLocEntries = {};
        const allUserIds = [...new Set(pIds.concat(AppState.user.id))];
        if (allUserIds.length) {
            const { data: crossAssigns } = await supabase.from('schedule_assignments')
                .select('user_id, location_id').in('user_id', allUserIds);
            const allLocIds = [...new Set((crossAssigns || []).map(a => a.location_id).filter(Boolean))];
            const crossLocIds = allLocIds.filter(id => id && id !== this._locId);
            if (crossLocIds.length) {
                const { data: crossLocs } = await supabase.from('schedule_locations')
                    .select('id, name').in('id', crossLocIds);
                const crossLocMap = Object.fromEntries((crossLocs || []).map(l => [l.id, l.name]));
                const { data: crossE } = await supabase.from('schedule_entries')
                    .select('user_id, date, location_id, shift_type, notes')
                    .in('user_id', allUserIds)
                    .in('location_id', crossLocIds)
                    .gte('date', dateFrom).lte('date', dateTo);
                (crossE || []).forEach(e => {
                    if (!_isRealShift(e) && e.notes !== '__sub_confirmed__') return;
                    const key = `${e.user_id}_${e.date}`;
                    const locName = crossLocMap[e.location_id] || '';
                    const existing = this._crossLocEntries[key];
                    if (!existing || e.notes === '__sub_confirmed__') {
                        this._crossLocEntries[key] = { locName, notes: e.notes, shift_type: e.shift_type };
                    }
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
        Object.values(this._entries).forEach(e => {
            if (['__sub__','__needsub__'].includes(e.notes)) return;
            if (stats[e.shift_type] !== undefined) stats[e.shift_type]++;
        });

        // Calendar cells
        const cells = [];
        for (let i = 0; i < offset; i++) cells.push(`<div class="sge-empty-cell"></div>`);
        for (let d = 1; d <= days; d++) {
            const dateStr = `${this._year}-${p(this._month + 1)}-${p(d)}`;
            const dow     = (new Date(this._year, this._month, d).getDay() + 6) % 7;
            const we      = dow >= 5;
            const entry   = this._entries[dateStr];
            const shift   = entry ? getShiftTypes()[entry.shift_type] : null;
            const isToday = dateStr === todayStr;
            const canSub    = entry?.notes === '__sub__';
            const needSub   = entry?.notes === '__needsub__';
            const isSubConf = entry?.notes === '__sub_confirmed__';
            const dispShift = isSubConf ? SUB_CONFIRMED : (canSub ? null : shift);
            const mgrHelpInfo = this._managerHelpDates[dateStr];
            const mgrHelp    = !!mgrHelpInfo;
            const mgrHelpLoc = mgrHelpInfo?.locName || '';
            cells.push(`
<div class="sge-day${we?' we':''}${isToday?' today':''}${(!canSub && (shift||isSubConf))?' has-shift':''}${canSub?' sge-cansub':''}${needSub?' sge-needsub':''}${isSubConf?' sge-subconf':''}${mgrHelp?' sge-mgr-help':''}"
    onclick="ScheduleGraphEmployee._openCell('${dateStr}')"
    title="${canSub ? 'Відмічено: можу вийти на підміну' : needSub ? 'Потрібна підміна' : isSubConf ? 'Підтверджена підміна' : mgrHelp ? 'Керівник шукає підміну' : shift ? shift.label : 'Додати запис'}">
    <div class="sge-day-top">
        <span class="sge-day-num${isToday?' cur':''}">${d}</span>
        <span class="sge-day-dow">${['Пн','Вт','Ср','Чт','Пт','Сб','Нд'][dow]}</span>
    </div>
    ${needSub ? `<div class="sge-flag-badge sge-flag-badge-need">🆘</div>`
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
            onclick="ScheduleGraphEmployee._switchLoc('${a.locId}')">
            <span class="sge-tab-name">🏪 ${Fmt.esc(a.locName)}</span>
            ${a.address ? `<span class="sge-tab-addr"><i class="fa-solid fa-location-dot"></i> ${Fmt.esc(a.address)}</span>` : ''}
            ${a.phone ? `<span class="sge-tab-addr"><i class="fa-solid fa-phone"></i> ${Fmt.esc(a.phone)}</span>` : ''}
            ${a.work_start && a.work_end ? `<span class="sge-tab-addr"><i class="fa-regular fa-clock"></i> ${a.work_start.slice(0,5)}–${a.work_end.slice(0,5)}</span>` : ''}
        </button>`).join('')}
    </div>
</div>` : '';

        const hasAnyEntry = Object.keys(this._entries).length > 0;

        container.innerHTML = `
<div class="sg-page">
    ${this._empHero(locName, this._locId)}

    ${locTabs}

    <div class="sg-controls" style="margin-bottom:16px">
        <div class="sg-month-nav">
            <button class="sg-mnav" onclick="ScheduleGraphEmployee._prevMonth()"><i class="fa-solid fa-angle-left"></i></button>
            <span class="sg-mlabel">${MONTHS_UA[this._month]} ${this._year}</span>
            <button class="sg-mnav" onclick="ScheduleGraphEmployee._nextMonth()">›</button>
        </div>
        <div class="sg-legend" style="flex:1">
            ${['work','vacation'].map(k => {
                const v = getShiftTypes()[k];
                if (!v) return '';
                const active = this._quickType === k;
                return `<button class="sg-leg-btn${active?' active':''}"
                    style="--lc:${v.color};--lb:${v.bg}"
                    onclick="ScheduleGraphEmployee._setQuickType('${k}')"
                    title="${active ? 'Клік щоб скасувати' : 'Клік щоб вибрати — потім тиснути на свої клітинки'}">
                    <span class="sg-leg-short" style="background:${v.bg};color:${v.color}">${v.short}</span>
                    ${v.label}
                    ${active ? '<span class="sg-leg-active-mark">✓ активно</span>' : ''}
                </button>`;
            }).join('')}
            <button class="sg-types-mgr-btn" onclick="ScheduleGraphPage._showShiftTypesModal(true)" title="Налаштувати скорочення">⚙️</button>
        </div>
        <div class="sge-stats">
            ${getShiftTypeEntries().map(([k, v]) => stats[k] ? `
            <div class="sge-stat-chip" style="background:${v.bg};color:${v.color}">
                <span class="sge-stat-short">${v.short}</span>
                <span>${stats[k]} ${k==='work'?'роб.':k==='day_off'?'вих.':k==='vacation'?'відп.':'лік.'}</span>
            </div>` : '').join('')}
        </div>
        <button class="sge-sub-btn" onclick="ScheduleGraphEmployee._toggleSubMode()">
            🙋 Можу вийти на заміну
        </button>
    </div>
    ${this._quickType ? `
    <div class="sg-quick-bar">
        <span>⚡ Швидке заповнення:</span>
        <span class="sg-quick-badge" style="background:${getShiftTypes()[this._quickType]?.bg};color:${getShiftTypes()[this._quickType]?.color}">
            ${getShiftTypes()[this._quickType]?.short} ${getShiftTypes()[this._quickType]?.label}
        </span>
        <span>— натискайте на свої клітинки</span>
        <button class="sg-quick-cancel" onclick="ScheduleGraphEmployee._setQuickType(null)">✕ Скасувати</button>
    </div>` : ''}

    ${(() => {
        const _loc = this._assignments.find(a => a.locId === this._locId);
        const _mk  = `${this._year}-${String(this._month + 1).padStart(2, '0')}`;
        const _ban = Array.isArray(_loc?.locked_months) ? _loc.locked_months.includes(_mk) : (_loc?.locked || false);
        return _ban ? `
    <div class="sg-locked-banner">
        🔒 <strong>Графік заблоковано.</strong> Зміни вносить тільки керівник.
    </div>` : '';
    })()}

    <div class="sg-section">
        <div class="sg-scroll-wrap" id="sge-wrap-main">
        <table class="sg-table">
            <thead>
                <tr>
                    <th class="sg-th-name">Співробітник</th>
                    ${Array.from({length: days}, (_, i) => i + 1).map(d => {
                        const dow = new Date(this._year, this._month, d).getDay();
                        const we  = dow === 0 || dow === 6;
                        const dateStr = `${this._year}-${p(this._month + 1)}-${p(d)}`;
                        const isToday = dateStr === todayStr;
                        return `<th class="sg-th-day${we?' we':''}${isToday?' sge-th-today':''}">
                            <div class="sg-day-num">${d}</div>
                            <div class="sg-day-dow">${['Нд','Пн','Вт','Ср','Чт','Пт','Сб'][dow]}</div>
                        </th>`;
                    }).join('')}
                    <th class="sg-th-sum"><div class="sg-th-sum-inner">Σ</div><div class="sg-th-sub">Дні</div></th>
                </tr>
            </thead>
            <tbody>
            ${(this._locAssignments || []).map(a => {
                const isMe = a.user_id === AppState.user.id;
                const name = a.profile?.full_name || a.employee_name || '—';
                const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
                const nums = Array.from({length: days}, (_, i) => i + 1);
                const workDays = nums.filter(d => {
                    const e = isMe ? this._entries[`${this._year}-${p(this._month+1)}-${p(d)}`]
                                   : this._locEntries[`${a.user_id}_${this._year}-${p(this._month+1)}-${p(d)}`];
                    return e && ['work','day_off'].includes(e?.shift_type) ? false : e?.shift_type === 'work';
                }).length;
                const totalDays = nums.filter(d => {
                    const dateStr = `${this._year}-${p(this._month+1)}-${p(d)}`;
                    const e = isMe ? this._entries[dateStr] : this._locEntries[`${a.user_id}_${dateStr}`];
                    return e && e.shift_type === 'work' && !['__sub__','__needsub__'].includes(e.notes);
                }).length;
                return `<tr class="${isMe ? 'sge-my-row' : 'sge-peer-row'}">
                    <td class="sg-td-name">
                        <div class="sg-name-full">
                            <div class="sg-av sm" style="${isMe?'background:var(--primary);color:#fff':''}">${initials}</div>
                            ${Fmt.esc(name)}${isMe ? ' <span style="font-size:.65rem;color:var(--primary);font-weight:700">(я)</span>' : ''}
                        </div>
                    </td>
                    ${nums.map(d => {
                        const dateStr = `${this._year}-${p(this._month+1)}-${p(d)}`;
                        const dow = new Date(this._year, this._month, d).getDay();
                        const we  = dow === 0 || dow === 6;
                        const isToday = dateStr === todayStr;
                        const uid = a.user_id;
                        const entry = isMe ? this._entries[dateStr] : this._locEntries[`${uid}_${dateStr}`];
                        const isSub    = entry?.notes === '__sub__';
                        const isSubConf = entry?.notes === '__sub_confirmed__';
                        const isNeedSub = entry?.notes === '__needsub__';
                        const crossLoc = this._crossLocEntries?.[`${uid}_${dateStr}`] || null;
                        const subConfOther = crossLoc?.notes === '__sub_confirmed__';
                        const baseShift = (!isSub && !isNeedSub && entry) ? getShiftTypes()[entry.shift_type] : null;
                        const dispShift = isSubConf ? SUB_CONFIRMED : (subConfOther ? null : baseShift);
                        const showCrossLoc = !dispShift && crossLoc && (!entry || isSub);
                        const cellTitle = isNeedSub ? 'Потрібна підміна'
                            : subConfOther ? `Підміна у «${crossLoc.locName}»`
                            : isSubConf ? 'Підтверджена підміна'
                            : dispShift ? dispShift.label
                            : showCrossLoc ? `Зміна у «${crossLoc.locName}»`
                            : isSub && isMe ? 'Відмічено: можу вийти на підміну'
                            : isMe ? 'Клікніть щоб додати' : '';
                        const badgeHtml = isNeedSub
                            ? `<span class="sg-flag-cell">🆘</span>`
                            : subConfOther
                                ? `<span class="sg-other-loc-badge">${Fmt.esc(crossLoc.locName.slice(0,3))}</span>`
                            : dispShift
                                ? `<span class="sg-badge" style="background:${dispShift.bg};color:${dispShift.color}">${dispShift.short}</span>`
                            : showCrossLoc
                                ? `<span class="sg-other-loc-badge">${Fmt.esc(crossLoc.locName.slice(0,3))}</span>`
                            : isSub && isMe ? `<span class="sge-sub-marker">✓</span>` : '';
                        return `<td class="sg-cell${we?' we':''}${isToday?' sge-cell-today':''}${isMe?'':' sge-peer-cell'}${isSub&&isMe?' sge-cansub':''}"
                            ${isMe ? `onclick="ScheduleGraphEmployee._openCell('${dateStr}')"` : ''}
                            title="${Fmt.esc(cellTitle)}">
                            ${badgeHtml}
                        </td>`;
                    }).join('')}
                    <td class="sg-td-sum">${totalDays}</td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>
        </div>
        <p class="sg-v2-hint" style="padding:8px 16px"><i class="fa-solid fa-circle-info"></i> Клікніть на свій рядок щоб додати або змінити запис</p>
    </div>
</div>
${ScheduleGraphPage._styles()}${this._empStyles()}`;
    },

    _empHero(locName, locId) {
        const isManager = AppState.isManager?.() || AppState.isAdmin?.() || AppState.isOwner?.();
        const asgn = locId ? this._assignments.find(a => a.locId === locId) : null;
        const whText = (asgn?.work_start && asgn?.work_end)
            ? `${asgn.work_start.slice(0,5)} — ${asgn.work_end.slice(0,5)}` : '';
        return `
<div class="sg-hero" style="margin-bottom:20px">
    <div class="sg-hero-inner">
        <div class="sg-hero-ico"><i class="fa-solid fa-calendar-days" style="color:#fff"></i></div>
        <div style="flex:1">
            <h1 class="sg-hero-title">Мій графік роботи</h1>
        </div>
        ${isManager ? `
        <button class="sg-my-sched-btn" onclick="ScheduleGraphPage.init(ScheduleGraphEmployee._container)"><i class="fa-solid fa-angle-left"></i> Керування графіком
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
    padding:8px 16px;border-radius:10px;border:none;background:transparent;
    color:var(--text-muted);font-size:.85rem;font-weight:600;cursor:pointer;
    transition:all .18s;display:flex;flex-direction:column;align-items:flex-start;gap:3px;
}
.sge-tab-name { font-size:.85rem;font-weight:600; }
.sge-tab-addr { font-size:.8rem;font-weight:500;opacity:1;color:var(--text-secondary);display:flex;align-items:center;gap:4px; }
.sg-loc-tab:hover { background:var(--bg-hover);color:var(--text-primary); }
.sg-loc-tab.active { background:var(--primary);color:#fff; }
.sg-loc-tab.active .sge-tab-addr { color:#fff;opacity:.8; }
.sge-sub-btn { display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:20px;border:1.5px solid rgba(16,185,129,.4);background:rgba(16,185,129,.08);color:#10b981;font-size:.82rem;font-weight:600;cursor:pointer;transition:all .15s; }
.sge-sub-btn:hover { background:rgba(16,185,129,.15);border-color:#10b981; }
.sge-sub-box { max-width:520px;height:auto !important; }
.sge-sub-legend { display:flex;gap:12px;margin:8px 0 12px;font-size:.75rem;color:var(--text-muted); }
.sge-sub-legend-item { display:flex;align-items:center;gap:5px; }
.sge-sub-grid { display:grid;grid-template-columns:repeat(7,1fr);gap:4px;max-height:300px;overflow-y:auto; }
.sge-sub-day { border:1.5px solid var(--border);border-radius:8px;padding:6px 4px;text-align:center;cursor:pointer;transition:all .15s;user-select:none;position:relative; }
.sge-sub-day:hover:not(.sge-sub-day-busy):not(.sge-sub-day-past) { border-color:var(--primary);background:color-mix(in srgb,var(--primary) 8%,transparent); }
.sge-sub-day-selected { border-color:#10b981 !important;background:rgba(16,185,129,.12) !important; }
.sge-sub-day-busy { opacity:.4;cursor:not-allowed;background:var(--bg-raised); }
.sge-sub-day-past { opacity:.35;cursor:not-allowed; }
.sge-sub-day-we { background:color-mix(in srgb,#ef4444 5%,transparent); }
.sge-sub-day-marked { border-color:rgba(16,185,129,.5);background:rgba(16,185,129,.06); }
.sge-sub-day-num { font-size:.82rem;font-weight:700;color:var(--text-primary); }
.sge-sub-day-dow { font-size:.6rem;color:var(--text-muted); }
.sge-sub-day-ico { font-size:.7rem;margin-top:2px; }
/* Employee table view */
.sge-my-row td { background:color-mix(in srgb,var(--primary) 4%,transparent); }
.sge-my-row .sg-cell { cursor:pointer; }
.sge-my-row .sg-cell:hover { background:color-mix(in srgb,var(--primary) 10%,transparent); }
.sge-peer-row td { opacity:.75; }
.sge-peer-cell { cursor:default !important; }
.sge-th-today { background:color-mix(in srgb,var(--primary) 15%,var(--bg-raised)) !important;color:var(--primary) !important; }
.sge-cell-today { background:color-mix(in srgb,var(--primary) 6%,transparent) !important; }

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
/* Can-substitute indicator — відмічено готовність, не рахується як зміна */
.sge-day.sge-cansub { border-color:rgba(99,102,241,.35);background:rgba(99,102,241,.05); }
/* Table cell sge-cansub — light purple tint + checkmark */
td.sge-cansub { background:rgba(99,102,241,.06);border-left:2px solid rgba(99,102,241,.3); }
.sge-sub-marker { font-size:.7rem;color:rgba(99,102,241,.7);font-weight:700; }
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

    _setQuickType(type) {
        this._quickType = this._quickType === type ? null : type;
        this._subMode = false;
        this._render(this._container);
    },

    async _toggleSubMode() {
        this._quickType = null;
        this._showSubModal();
    },

    _showSubModal() {
        document.getElementById('sge-sub-modal')?.remove();
        const p = n => String(n).padStart(2,'0');
        const days = new Date(this._year, this._month + 1, 0).getDate();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${p(today.getMonth()+1)}-${p(today.getDate())}`;

        const dayCells = [];
        for (let d = 1; d <= days; d++) {
            const dateStr = `${this._year}-${p(this._month+1)}-${p(d)}`;
            const dow = new Date(this._year, this._month, d).getDay();
            const we  = dow === 0 || dow === 6;
            const entry = this._entries[dateStr];
            const hasShift = entry && !['__sub__','__needsub__'].includes(entry.notes) && entry.shift_type === 'work';
            const isSubMarked = entry?.notes === '__sub__';
            const isPast = dateStr < todayStr;

            dayCells.push(`
            <div class="sge-sub-day${hasShift?' sge-sub-day-busy':''}${isPast?' sge-sub-day-past':''}${we?' sge-sub-day-we':''}${isSubMarked?' sge-sub-day-marked':''}"
                data-date="${dateStr}" data-busy="${hasShift?'1':'0'}" data-past="${isPast?'1':'0'}"
                onclick="ScheduleGraphEmployee._toggleSubDay(this)"
                title="${hasShift ? 'Вже є зміна в цей день' : isPast ? 'Минулий день' : 'Клікніть щоб позначити'}">
                <div class="sge-sub-day-num">${d}</div>
                <div class="sge-sub-day-dow">${['Нд','Пн','Вт','Ср','Чт','Пт','Сб'][dow]}</div>
                ${hasShift ? '<div class="sge-sub-day-ico">⛔</div>' : isSubMarked ? '<div class="sge-sub-day-ico">🙋</div>' : ''}
            </div>`);
        }

        const el = document.createElement('div');
        el.id = 'sge-sub-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal sge-sub-box">
    <div class="sg-mhdr">
        <div>
            <h3 style="margin:0;font-size:1.05rem">🙋 Можу вийти на заміну</h3>
            <p style="margin:3px 0 0;color:var(--text-muted);font-size:.78rem">Оберіть дні коли готові вийти. Дні зі зміною недоступні.</p>
        </div>
        <button class="sg-mclose" onclick="document.getElementById('sge-sub-modal').remove()">✕</button>
    </div>
    <div class="sge-sub-legend">
        <span class="sge-sub-legend-item"><span style="background:rgba(16,185,129,.2);border:2px solid #10b981;width:14px;height:14px;border-radius:4px;display:inline-block"></span> Обрано</span>
        <span class="sge-sub-legend-item"><span style="background:var(--bg-raised);border:1px solid var(--border);width:14px;height:14px;border-radius:4px;display:inline-block;opacity:.4"></span> Зайнято</span>
    </div>
    <div class="sge-sub-grid">${dayCells.join('')}</div>
    <div class="sg-modal-actions" style="margin-top:14px">
        <button class="sg-btn-cancel" onclick="document.getElementById('sge-sub-modal').remove()">Скасувати</button>
        <button class="sg-btn-save" onclick="ScheduleGraphEmployee._saveSubDays()">
            <i class="fa-solid fa-paper-plane"></i> Надіслати керівнику
        </button>
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    _toggleSubDay(el) {
        if (el.dataset.busy === '1' || el.dataset.past === '1') return;
        el.classList.toggle('sge-sub-day-selected');
        const ico = el.querySelector('.sge-sub-day-ico');
        if (el.classList.contains('sge-sub-day-selected')) {
            if (!ico) el.insertAdjacentHTML('beforeend','<div class="sge-sub-day-ico">🙋</div>');
        } else {
            ico?.remove();
        }
    },

    async _saveSubDays() {
        const selected = [...document.querySelectorAll('.sge-sub-day-selected')].map(el => el.dataset.date);
        if (!selected.length) { Toast.warning('Оберіть хоча б один день'); return; }
        document.getElementById('sge-sub-modal')?.remove();

        await Promise.all(selected.map(date => {
            const entry = this._entries[date];
            return supabase.from('schedule_entries').upsert({
                location_id: this._locId,
                user_id: AppState.user.id,
                date,
                shift_type: entry?.shift_type || 'work',
                notes: '__sub__',
                updated_by: AppState.user.id,
                updated_at: new Date().toISOString()
            }, { onConflict: 'location_id,user_id,date' });
        }));

        // Reload entries
        await this._loadEntries();

        // Notify managers
        const managerIds = await this._getManagerIds();
        const userName = AppState.profile?.full_name || 'Співробітник';
        const datesLabel = selected.map(d => {
            const dt = new Date(d + 'T00:00:00');
            return dt.toLocaleDateString('uk-UA', { day:'numeric', month:'long' });
        }).join(', ');

        if (managerIds.length) {
            await supabase.from('notifications').insert(
                managerIds.map(uid => ({
                    user_id: uid,
                    title: '🙋 Готовий вийти на заміну',
                    message: `${userName} може вийти на підміну: ${datesLabel}`,
                    type: 'general',
                    created_by: AppState.user.id,
                    link: `scheduler?loc=${this._locId}`
                }))
            );
        }

        this._render(this._container);
        Toast.success('Надіслано', `Позначено ${selected.length} дн${selected.length===1?'ь':'ів'}`);
    },

    async _markSubAvailable(date) {
        const entry = this._entries[date];
        const payload = {
            location_id: this._locId,
            user_id: AppState.user.id,
            date,
            shift_type: entry?.shift_type || 'work',
            notes: entry?.notes === '__sub__' ? null : '__sub__',
            updated_by: AppState.user.id,
            updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase.from('schedule_entries')
            .upsert(payload, { onConflict: 'location_id,user_id,date' }).select().single();
        if (error) { Toast.error('Помилка', error.message); return; }
        this._entries[date] = data;

        if (payload.notes === '__sub__') {
            const managerIds = await this._getManagerIds();
            const userName = AppState.profile?.full_name || 'Співробітник';
            const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('uk-UA', { day:'numeric', month:'long' });
            if (managerIds.length) {
                await supabase.from('notifications').insert(
                    managerIds.map(uid => ({
                        user_id: uid,
                        title: '🙋 Готовий вийти на заміну',
                        message: `${userName} може вийти на підміну ${dateLabel}`,
                        type: 'general',
                        created_by: AppState.user.id,
                        link: `scheduler?loc=${this._locId}&date=${date}`
                    }))
                );
            }
            Toast.success('Позначено', 'Керівник отримає сповіщення');
        } else {
            Toast.info('Пропозицію скасовано');
        }
        this._render(this._container);
    },

    async _openCell(date) {
        const now = new Date();
        if (this._year < now.getFullYear() || (this._year === now.getFullYear() && this._month < now.getMonth())) {
            Toast.error('Місяць завершено', 'Редагування минулих місяців заблоковано');
            return;
        }
        const currentLoc = this._assignments.find(a => a.locId === this._locId);
        const _mk = `${this._year}-${String(this._month + 1).padStart(2, '0')}`;
        const _empLocked = Array.isArray(currentLoc?.locked_months)
            ? currentLoc.locked_months.includes(_mk)
            : (currentLoc?.locked || false);
        if (_empLocked) {
            Toast.error('Графік заблоковано', 'Зміни вносить тільки керівник');
            return;
        }
        if (this._quickType) {
            await ScheduleGraphPage._saveEntry(AppState.user.id, date, true, this._quickType);
            return;
        }
        if (this._subMode) {
            await this._markSubAvailable(date);
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

    _showEditRequestModal(date, entry) {
        document.getElementById('sg-emp-req-modal')?.remove();
        const shift = getShiftTypes()[entry.shift_type];
        const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('uk-UA', { weekday:'long', day:'numeric', month:'long' });
        const el = document.createElement('div');
        el.id = 'sg-emp-req-modal';
        el.className = 'sg-overlay';
        el.innerHTML = `
<div class="sg-modal sg-emp-req-box">
    <div class="sg-mhdr">
        <div>
            <h3 style="margin:0;font-size:1.05rem">✏️ Запит на зміну</h3>
            <p style="margin:3px 0 0;color:var(--text-muted);font-size:.8rem;text-transform:capitalize">${dateLabel}</p>
        </div>
        <button class="sg-mclose" onclick="document.getElementById('sg-emp-req-modal').remove()">✕</button>
    </div>
    <div style="margin:12px 0;padding:10px 14px;background:var(--bg-raised);border-radius:10px;display:flex;align-items:center;gap:10px">
        <span class="sg-badge" style="background:${shift?.bg||'var(--bg-raised)'};color:${shift?.color||'var(--text-primary)'}">${shift?.short||'?'} ${shift?.label||entry.shift_type}</span>
        <span style="font-size:.8rem;color:var(--text-muted)">${entry.shift_start && entry.shift_end ? entry.shift_start.slice(0,5)+' — '+entry.shift_end.slice(0,5) : ''}</span>
    </div>
    <p style="font-size:.82rem;color:var(--text-muted);margin:0 0 10px">Опишіть причину зміни або видалення — керівник отримає сповіщення та внесе правку.</p>
    <textarea id="sg-emp-req-text" class="sg-notes" placeholder="Причина запиту..." rows="3" style="width:100%;box-sizing:border-box"></textarea>
    <div class="sg-modal-actions" style="margin-top:12px">
        <button class="sg-btn-cancel" onclick="document.getElementById('sg-emp-req-modal').remove()">Скасувати</button>
        <button class="sg-btn-save" onclick="ScheduleGraphEmployee._sendEditRequest('${date}')">
            <i class="fa-solid fa-paper-plane"></i> Надіслати запит
        </button>
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
        document.getElementById('sg-emp-req-text')?.focus();
    },

    async _sendEditRequest(date) {
        const text = document.getElementById('sg-emp-req-text')?.value.trim();
        if (!text) { Toast.warning('Вкажіть причину запиту'); return; }
        document.getElementById('sg-emp-req-modal')?.remove();

        const loc = this._assignments.find(a => a.locId === this._locId);
        const managerIds = await this._getManagerIds();
        const userName = AppState.profile?.full_name || 'Співробітник';
        const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('uk-UA', { day:'numeric', month:'long' });
        const entry = this._entries[date];

        await Promise.all([
            // Notifications to managers
            managerIds.length ? supabase.from('notifications').insert(
                managerIds.map(uid => ({
                    user_id: uid,
                    title: '✏️ Запит на зміну графіку',
                    message: `${userName} просить змінити запис на ${dateLabel}${loc ? ` (${loc.locName})` : ''}: «${text}»`,
                    type: 'general',
                    created_by: AppState.user.id,
                    link: `scheduler?loc=${loc ? loc.locId : ''}&date=${date}`
                }))
            ) : Promise.resolve(),
            // Log the request in schedule_log
            loc ? supabase.from('schedule_log').insert({
                location_id:   loc.locId,
                user_id:       AppState.user.id,
                date:          date,
                employee_name: userName,
                old_value:     entry ? { shift_type: entry.shift_type, shift_start: entry.shift_start, shift_end: entry.shift_end } : null,
                new_value:     { request: true, message: text },
                changed_by:    AppState.user.id,
                changed_at:    new Date().toISOString()
            }) : Promise.resolve()
        ]);

        Toast.success('Запит надіслано', 'Керівник отримає сповіщення');
    },

    async _getManagerIds() {
        const locIds = this._assignments.map(a => a.locId).filter(Boolean);
        if (!locIds.length) return [];
        const { data } = await supabase.from('schedule_locations')
            .select('created_by').in('id', locIds);
        return [...new Set((data || []).map(l => l.created_by).filter(Boolean))];
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
            onclick="ScheduleGraphEmployee._confirmMgrHelp('${date}','${info.entryId}','${info.locId || ''}','${info.managerId || ''}',${JSON.stringify(info.locName||'').replace(/"/g,'&quot;')})">
            ✓ Можу вийти
        </button>
        <button class="sg-btn-cancel"
            onclick="document.getElementById('sg-mgrhelp-resp-modal').remove();ScheduleGraphEmployee._editDay('${date}')">
            <i class="fa-solid fa-pen"></i> Редагувати день
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
        this._container       = container;
        this._selectedManager = null;
        this._month = new Date().getMonth();
        this._year  = new Date().getFullYear();
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
                .select('user_id, is_primary')
                .eq('location_id', this._locId)
        ]);
        this._entries = {};
        (eRes.data || []).forEach(e => { this._entries[`${e.user_id}_${e.date}`] = e; });

        const rawAssignments = aRes.data || [];
        if (rawAssignments.length) {
            const ids = [...new Set(rawAssignments.map(a => a.user_id).filter(Boolean))];
            const { data: profs } = await supabase.from('profiles')
                .select('id, full_name, avatar_url, role, label').in('id', ids);
            const profileMap = {};
            (profs || []).forEach(pr => { profileMap[pr.id] = pr; });
            this._assignments = rawAssignments.map(a => ({ ...a, profile: profileMap[a.user_id] || null, is_primary: a.is_primary !== false }));
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
        <button class="sgv-back-btn" onclick="ScheduleViewPage._backToManagers()"><i class="fa-solid fa-angle-left"></i> Назад</button>
        <div class="sgv-manager-badge">
            <div class="sg-av sm" style="background:${mColor}">
                ${mp.avatar_url ? `<img src="${mp.avatar_url}">` : mInit}
            </div>
            <span>${mp.full_name || 'Керівник'}</span>
        </div>
    `)}

    ${this._locations.length > 1 ? `
    <div class="sgv-loc-picker">
        <div class="sgv-loc-picker-label">🏪 Локація</div>
        <div class="sgv-loc-picker-wrap">
            <input class="sgv-loc-search" id="sgv-loc-search" type="text" placeholder="Пошук локації…"
                oninput="ScheduleViewPage._filterLocs(this.value)"
                onfocus="this.select();ScheduleViewPage._openLocList()"
                onblur="setTimeout(()=>{const d=document.getElementById('sgv-loc-dropdown'),i=document.getElementById('sgv-loc-search');if(d)d.classList.remove('open');if(i&&!i.value.trim()){const a=d&&d.querySelector('.sgv-loc-opt.active');if(a)i.value=a.textContent.trim().replace(/^🏪\s*/,'');}},180)"
                value="${Fmt.esc(this._locations.find(l=>l.id===this._locId)?.name||'')}">
            <div class="sgv-loc-dropdown" id="sgv-loc-dropdown">
                ${this._locations.map(l => `
                <button class="sgv-loc-opt ${l.id === this._locId ? 'active' : ''}"
                    onclick="ScheduleViewPage._pickLoc('${l.id}',${JSON.stringify(Fmt.esc(l.name)).replace(/"/g,'&quot;')})">
                    🏪 ${Fmt.esc(l.name)}
                </button>`).join('')}
            </div>
        </div>
        <span class="sgv-loc-count">${this._locations.length} локацій</span>
    </div>` : ''}

    <div class="sg-section">
        <div class="sgv-header-bar">
            <span class="sgv-loc-name">🏪 ${locName}</span>
            <div class="sg-month-nav" style="margin-left:auto">
                <button class="sg-mnav" onclick="ScheduleViewPage._prevMonth()"><i class="fa-solid fa-angle-left"></i></button>
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
                    const isPrimary = a.is_primary !== false;
                    const sub   = [p.role ? Fmt.role(p.role) : '', p.label || ''].filter(Boolean).join(' · ');
                    let workDays = 0;
                    const cells = nums.map(d => {
                        const date  = `${this._year}-${String(this._month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                        const entry = this._entries[`${a.user_id}_${date}`];
                        const shift = entry ? getShiftTypes()[entry.shift_type] : null;
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
                                    <div class="sg-name-full">
                                        ${p.full_name||'Без імені'}
                                        ${!isPrimary ? `<span class="sg-temp-badge">підміна</span>` : ''}
                                    </div>
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
    <div class="sgv-hero-ico"><i class="fa-solid fa-eye"></i></div>
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

/* Loc picker */
.sgv-loc-picker {
    display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;
}
.sgv-loc-picker-label { font-size:.82rem;font-weight:600;color:var(--text-muted);white-space:nowrap; }
.sgv-loc-picker-wrap { position:relative;flex:1;min-width:200px;max-width:420px; }
.sgv-loc-search {
    width:100%;padding:8px 14px;border-radius:10px;
    border:1.5px solid var(--border);background:var(--bg-surface);
    color:var(--text-primary);font-size:.88rem;outline:none;
    transition:border-color .15s;cursor:pointer;
}
.sgv-loc-search:focus { border-color:var(--primary); }
.sgv-loc-dropdown {
    display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:120;
    background:var(--bg-surface);border:1.5px solid var(--border);border-radius:12px;
    box-shadow:0 8px 24px rgba(0,0,0,.12);max-height:260px;overflow-y:auto;padding:4px;
}
.sgv-loc-dropdown.open { display:block; }
.sgv-loc-opt {
    display:block;width:100%;text-align:left;padding:8px 12px;border-radius:8px;
    border:none;background:none;cursor:pointer;font-size:.85rem;color:var(--text-primary);
    transition:background .12s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.sgv-loc-opt:hover { background:var(--bg-hover); }
.sgv-loc-opt.active { background:rgba(99,102,241,.1);color:var(--primary);font-weight:700; }
.sgv-loc-count { font-size:.78rem;color:var(--text-muted);white-space:nowrap; }
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

    _pickLoc(locId, name) {
        const inp = document.getElementById('sgv-loc-search');
        const dd  = document.getElementById('sgv-loc-dropdown');
        if (inp) inp.value = name;
        if (dd)  dd.classList.remove('open');
        if (locId !== this._locId) this._switchLoc(locId);
    },

    _openLocList() {
        const dd = document.getElementById('sgv-loc-dropdown');
        if (!dd) return;
        dd.classList.add('open');
        dd.querySelectorAll('.sgv-loc-opt').forEach(btn => btn.style.display = '');
    },

    _filterLocs(q) {
        const dd = document.getElementById('sgv-loc-dropdown');
        if (!dd) return;
        dd.classList.add('open');
        dd.querySelectorAll('.sgv-loc-opt').forEach(btn => {
            btn.style.display = btn.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
        });
    },

    _prevMonth() {
        if (this._month === 0) { this._month = 11; this._year--; } else this._month--;
        if (this._locId) this._loadEntries().then(() => this._render());
        else this._render();
    },

    _nextMonth() {
        if (this._month === 11) { this._month = 0; this._year++; } else this._month++;
        if (this._locId) this._loadEntries().then(() => this._render());
        else this._render();
    },

};

