// ================================================================
// EduFlow LMS — Мій календар
// Personal calendar with event management and viewer access
// ================================================================

const MyCalendarPage = {
    _container: null,
    _events:    [],   // all events for current month
    _month: new Date().getMonth(),
    _year:  new Date().getFullYear(),
    _viewers: [],
    _viewingOwnerId: null, // null = own calendar

    // ── Entry point ──────────────────────────────────────────────

    async init(container, params) {
        this._container = container;
        this._viewingOwnerId = params?.owner || null;
        UI.setBreadcrumb([
            { label: 'Розділ планування', route: 'scheduler' },
            { label: 'Мій календар' }
        ]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        await this._load();
        this._render();
    },

    _ownerId() {
        return this._viewingOwnerId || AppState.user.id;
    },

    _isReadOnly() {
        return !!this._viewingOwnerId && this._viewingOwnerId !== AppState.user.id;
    },

    // ── Data ────────────────────────────────────────────────────

    async _load() {
        const p      = n => String(n).padStart(2, '0');
        const from   = `${this._year}-${p(this._month + 1)}-01`;
        const daysInMonth = new Date(this._year, this._month + 1, 0).getDate();
        const to     = `${this._year}-${p(this._month + 1)}-${daysInMonth}`;

        // Regular events for this month
        const { data: ev } = await supabase
            .from('personal_cal_events')
            .select('*')
            .eq('user_id', this._ownerId())
            .gte('date', from)
            .lte('date', to)
            .order('date').order('time', { nullsFirst: true });

        // Recurring events (may originate before this month)
        const { data: recurring } = await supabase
            .from('personal_cal_events')
            .select('*')
            .eq('user_id', this._ownerId())
            .neq('repeat_type', 'none')
            .lt('date', from);

        const regular = ev || [];
        const regularDates = new Set(regular.map(e => e.date));

        // Generate virtual instances for recurring events
        const virtual = [];
        for (const re of (recurring || [])) {
            const origin = new Date(re.date + 'T00:00:00');
            for (let d = 1; d <= daysInMonth; d++) {
                const candidate = new Date(this._year, this._month, d);
                let matches = false;
                if (re.repeat_type === 'weekly') {
                    matches = candidate.getDay() === origin.getDay();
                } else if (re.repeat_type === 'monthly') {
                    matches = candidate.getDate() === origin.getDate();
                }
                if (!matches) continue;
                const dateStr = `${this._year}-${p(this._month + 1)}-${p(d)}`;
                if (regularDates.has(dateStr)) continue; // real event wins
                virtual.push({ ...re, date: dateStr, _virtual: true });
            }
        }

        this._events = [...regular, ...virtual].sort((a, b) => {
            if (a.date < b.date) return -1;
            if (a.date > b.date) return 1;
            return (a.time || '') < (b.time || '') ? -1 : 1;
        });

        if (!this._isReadOnly()) {
            const { data: vw } = await supabase
                .from('personal_cal_viewers')
                .select('viewer_id, profiles:viewer_id(id, full_name, avatar_url)')
                .eq('owner_id', AppState.user.id);
            this._viewers = (vw || []).map(r => ({
                id:   r.viewer_id,
                name: r.profiles?.full_name || '—',
            }));
        }
    },

    // ── Render ──────────────────────────────────────────────────

    _render() {
        const days    = new Date(this._year, this._month + 1, 0).getDate();
        const firstDow = (new Date(this._year, this._month, 1).getDay() + 6) % 7; // Mon=0
        const today   = new Date().toISOString().slice(0, 10);
        const readOnly = this._isReadOnly();

        const evByDate = {};
        this._events.forEach(e => {
            if (!evByDate[e.date]) evByDate[e.date] = [];
            evByDate[e.date].push(e);
        });

        const dow = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
        const MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                        'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

        // Build calendar cells
        let cells = '';
        let cellIdx = 0;
        // Empty cells before first day
        for (let i = 0; i < firstDow; i++) {
            cells += `<div class="mc-cell mc-cell-empty"></div>`;
            cellIdx++;
        }
        for (let d = 1; d <= days; d++) {
            const dateStr = `${this._year}-${String(this._month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isToday = dateStr === today;
            const isWe    = ((firstDow + d - 1) % 7) >= 5;
            const evs     = evByDate[dateStr] || [];
            cells += `
<div class="mc-cell${isToday?' mc-today':''}${isWe?' mc-we':''}"
    ${readOnly ? '' : `onclick="MyCalendarPage._openEventModal('${dateStr}')" title="Додати подію"`}>
    <div class="mc-day-num${isToday?' mc-day-today':''}">${d}</div>
    <div class="mc-events-list">
        ${evs.map(e => `
        <div class="mc-event-chip" style="background:${e.color}22;border-left:3px solid ${e.color}"
            onclick="event.stopPropagation();MyCalendarPage._openViewModal('${e.id}')">
            <div class="mc-chip-body">
                <div class="mc-chip-top">
                    ${e.time ? `<span class="mc-chip-time">${e.time.slice(0,5)}</span>` : ''}
                    <span class="mc-chip-title">${e.title}</span>
                    ${e.repeat_type && e.repeat_type !== 'none' ? `<span class="mc-chip-repeat">🔁</span>` : ''}
                </div>
                ${e.notes ? `<div class="mc-chip-notes">${e.notes}</div>` : ''}
            </div>
        </div>`).join('')}
    </div>
</div>`;
            cellIdx++;
        }
        // Fill remaining cells to complete grid row
        const remaining = cellIdx % 7 === 0 ? 0 : 7 - (cellIdx % 7);
        for (let i = 0; i < remaining; i++) cells += `<div class="mc-cell mc-cell-empty"></div>`;

        this._container.innerHTML = `
<div class="mc-wrap">
    <div class="mc-header">
        <div class="mc-title-row">
            <h1 class="mc-title">📅 Мій календар</h1>
            ${readOnly ? `<span class="mc-readonly-badge">👁 Перегляд</span>` : `
            <button class="mc-access-btn" onclick="MyCalendarPage._openAccessModal()">👥 Доступ${this._viewers.length ? ` <span class="mc-access-count">${this._viewers.length}</span>` : ''}</button>`}
        </div>
        <div class="mc-nav">
            <button class="mc-nav-btn" onclick="MyCalendarPage._prevMonth()">‹</button>
            <span class="mc-month-label">${MONTHS[this._month]} ${this._year}</span>
            <button class="mc-nav-btn" onclick="MyCalendarPage._nextMonth()">›</button>
        </div>
    </div>

    <div class="mc-grid">
        ${dow.map(d => `<div class="mc-dow">${d}</div>`).join('')}
        ${cells}
    </div>

    ${!readOnly ? `
    <button class="mc-fab" onclick="MyCalendarPage._openEventModal(null)" title="Нова подія">＋</button>` : ''}
</div>
${this._styles()}`;
    },

    // ── Month nav ────────────────────────────────────────────────

    _prevMonth() {
        if (this._month === 0) { this._month = 11; this._year--; } else this._month--;
        this._load().then(() => this._render());
    },

    _nextMonth() {
        if (this._month === 11) { this._month = 0; this._year++; } else this._month++;
        this._load().then(() => this._render());
    },

    // ── Event modal (create / edit) ───────────────────────────────

    _openEventModal(date, eventId) {
        const ev = eventId ? this._events.find(e => e.id === eventId) : null;
        const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];
        document.getElementById('mc-event-modal')?.remove();
        const el = document.createElement('div');
        el.id = 'mc-event-modal';
        el.className = 'mc-overlay';
        el.innerHTML = `
<div class="mc-modal">
    <div class="mc-mhdr">
        <h3>${ev ? 'Редагувати подію' : 'Нова подія'}</h3>
        <button class="mc-mclose" onclick="document.getElementById('mc-event-modal').remove()">✕</button>
    </div>
    <div class="mc-form">
        <label class="mc-label">Назва *</label>
        <input class="mc-input" id="mc-ev-title" placeholder="Назва події" value="${ev?.title || ''}" maxlength="120">

        <label class="mc-label">Дата *</label>
        <input class="mc-input" id="mc-ev-date" type="date" value="${ev?.date || date || ''}">

        <label class="mc-label">Час</label>
        <input class="mc-input" id="mc-ev-time" type="time" value="${ev?.time?.slice(0,5) || ''}">

        <label class="mc-label">Нотатки</label>
        <textarea class="mc-input mc-textarea" id="mc-ev-notes" placeholder="Додаткова інформація...">${ev?.notes || ''}</textarea>

        <label class="mc-label">Повторення</label>
        <select class="mc-input" id="mc-ev-repeat">
            <option value="none"    ${(ev?.repeat_type||'none')==='none'    ? 'selected':''}>Не повторюється</option>
            <option value="weekly"  ${ev?.repeat_type==='weekly'  ? 'selected':''}>Щотижня</option>
            <option value="monthly" ${ev?.repeat_type==='monthly' ? 'selected':''}>Щомісяця</option>
        </select>

        <label class="mc-label">Колір</label>
        <div class="mc-colors" id="mc-ev-colors">
            ${colors.map(c => `
            <div class="mc-color-dot${(ev?.color || '#6366f1') === c ? ' active' : ''}"
                style="background:${c}" data-color="${c}"
                onclick="MyCalendarPage._pickColor('${c}')"></div>`).join('')}
        </div>
    </div>
    <div class="mc-modal-actions">
        <button class="mc-btn-save" onclick="MyCalendarPage._saveEvent(${ev ? `'${ev.id}'` : 'null'})">${ev ? 'Зберегти' : 'Додати'}</button>
        ${ev ? `<button class="mc-btn-danger" onclick="MyCalendarPage._deleteEvent('${ev.id}')">Видалити</button>` : ''}
        <button class="mc-btn-cancel" onclick="document.getElementById('mc-event-modal').remove()">Скасувати</button>
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
        document.getElementById('mc-ev-title')?.focus();
    },

    _pickColor(color) {
        document.querySelectorAll('#mc-ev-colors .mc-color-dot').forEach(d => d.classList.toggle('active', d.dataset.color === color));
    },

    async _saveEvent(id) {
        const title       = document.getElementById('mc-ev-title')?.value.trim();
        const date        = document.getElementById('mc-ev-date')?.value;
        const time        = document.getElementById('mc-ev-time')?.value || null;
        const notes       = document.getElementById('mc-ev-notes')?.value.trim() || null;
        const color       = document.querySelector('#mc-ev-colors .mc-color-dot.active')?.dataset.color || '#6366f1';
        const repeat_type = document.getElementById('mc-ev-repeat')?.value || 'none';

        if (!title) { Toast.error('Введіть назву події'); return; }
        if (!date)  { Toast.error('Оберіть дату'); return; }

        let error;
        if (id) {
            ({ error } = await supabase.from('personal_cal_events')
                .update({ title, date, time, notes, color, repeat_type }).eq('id', id));
        } else {
            ({ error } = await supabase.from('personal_cal_events')
                .insert({ user_id: AppState.user.id, title, date, time, notes, color, repeat_type }));
        }
        if (error) { Toast.error('Помилка збереження'); return; }

        document.getElementById('mc-event-modal')?.remove();
        Toast.success(id ? 'Подію оновлено' : 'Подію додано');
        await this._load();
        this._render();
    },

    async _deleteEvent(id) {
        if (!confirm('Видалити подію?')) return;
        const { error } = await supabase.from('personal_cal_events').delete().eq('id', id);
        if (error) { Toast.error('Помилка'); return; }
        document.getElementById('mc-event-modal')?.remove();
        Toast.success('Подію видалено');
        await this._load();
        this._render();
    },

    // ── View modal (read-only click on chip) ─────────────────────

    _openViewModal(id) {
        const ev = this._events.find(e => e.id === id);
        if (!ev) return;
        const readOnly = this._isReadOnly();
        document.getElementById('mc-view-modal')?.remove();
        const el = document.createElement('div');
        el.id = 'mc-view-modal';
        el.className = 'mc-overlay';
        el.innerHTML = `
<div class="mc-modal" style="height:auto;max-width:380px">
    <div class="mc-mhdr">
        <div style="display:flex;align-items:center;gap:10px">
            <div style="width:14px;height:14px;border-radius:50%;background:${ev.color};flex-shrink:0"></div>
            <h3 style="margin:0;font-size:1rem">${ev.title}</h3>
        </div>
        <button class="mc-mclose" onclick="document.getElementById('mc-view-modal').remove()">✕</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;font-size:.85rem;margin-top:4px">
        <div>📅 ${new Date(ev.date+'T00:00:00').toLocaleDateString('uk-UA',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
        ${ev.time ? `<div>🕐 ${ev.time.slice(0,5)}</div>` : ''}
        ${ev.notes ? `<div style="color:var(--text-muted);line-height:1.5;margin-top:4px">${ev.notes}</div>` : ''}
    </div>
    ${readOnly ? '' : `
    <div class="mc-modal-actions" style="margin-top:16px">
        <button class="mc-btn-save" onclick="document.getElementById('mc-view-modal').remove();MyCalendarPage._openEventModal(null,'${ev.id}')">✏️ Редагувати</button>
        <button class="mc-btn-cancel" onclick="document.getElementById('mc-view-modal').remove()">Закрити</button>
    </div>`}
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    // ── Access modal ─────────────────────────────────────────────

    _openAccessModal() {
        document.getElementById('mc-access-modal')?.remove();
        const el = document.createElement('div');
        el.id = 'mc-access-modal';
        el.className = 'mc-overlay';
        el.innerHTML = `
<div class="mc-modal" style="height:auto;max-width:420px">
    <div class="mc-mhdr">
        <h3>👥 Доступ до календаря</h3>
        <button class="mc-mclose" onclick="document.getElementById('mc-access-modal').remove()">✕</button>
    </div>
    <p style="font-size:.82rem;color:var(--text-muted);margin:0 0 14px">
        Додайте людей які зможуть переглядати ваш календар (без права редагування).
    </p>
    <div style="display:flex;gap:8px;margin-bottom:14px">
        <input class="mc-input" id="mc-access-q" placeholder="🔍 Пошук за ім'ям..." oninput="MyCalendarPage._searchViewer(this.value)" style="flex:1">
    </div>
    <div id="mc-access-results" style="max-height:160px;overflow-y:auto;margin-bottom:14px"></div>
    <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:8px">Поточний доступ:</div>
    <div id="mc-access-list">
        ${this._viewers.length
            ? this._viewers.map(v => `
            <div class="mc-viewer-row">
                <span>${v.name}</span>
                <button class="mc-viewer-remove" onclick="MyCalendarPage._removeViewer('${v.id}')">✕</button>
            </div>`).join('')
            : `<div style="font-size:.82rem;color:var(--text-muted);font-style:italic">Немає глядачів</div>`}
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
        document.getElementById('mc-access-q')?.focus();
    },

    async _searchViewer(q) {
        const res = document.getElementById('mc-access-results');
        if (!res) return;
        if (q.trim().length < 2) { res.innerHTML = ''; return; }
        const { data } = await supabase.from('profiles')
            .select('id, full_name').ilike('full_name', `%${q}%`).limit(8);
        const existing = new Set([AppState.user.id, ...this._viewers.map(v => v.id)]);
        const filtered = (data || []).filter(p => !existing.has(p.id));
        res.innerHTML = filtered.length
            ? filtered.map(p => `
            <div class="mc-viewer-row mc-viewer-result" onclick="MyCalendarPage._addViewer('${p.id}','${(p.full_name||'').replace(/'/g,"\\'")}')">
                <span>${p.full_name || '—'}</span>
                <span class="mc-viewer-add">＋</span>
            </div>`).join('')
            : `<div style="font-size:.82rem;color:var(--text-muted);font-style:italic;padding:6px 0">Нікого не знайдено</div>`;
    },

    async _addViewer(viewerId, name) {
        const { error } = await supabase.from('personal_cal_viewers')
            .insert({ owner_id: AppState.user.id, viewer_id: viewerId });
        if (error) { Toast.error('Помилка'); return; }
        this._viewers.push({ id: viewerId, name });
        document.getElementById('mc-access-modal')?.remove();
        this._openAccessModal();
        Toast.success(`${name} отримав доступ`);
    },

    async _removeViewer(viewerId) {
        const { error } = await supabase.from('personal_cal_viewers')
            .delete().eq('owner_id', AppState.user.id).eq('viewer_id', viewerId);
        if (error) { Toast.error('Помилка'); return; }
        this._viewers = this._viewers.filter(v => v.id !== viewerId);
        document.getElementById('mc-access-modal')?.remove();
        this._openAccessModal();
        Toast.success('Доступ видалено');
    },

    // ── Login reminder modal ──────────────────────────────────────

    async showTodayReminder() {
        const key = `mc_reminder_${AppState.user.id}_${new Date().toISOString().slice(0,10)}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');

        const today = new Date().toISOString().slice(0, 10);
        const { data } = await supabase
            .from('personal_cal_events')
            .select('*')
            .eq('user_id', AppState.user.id)
            .eq('date', today)
            .order('time', { nullsFirst: true });

        if (!data?.length) return;

        // Send notifications for upcoming events (with time set, in next 2h)
        const ntfKey = `mc_ntf_${AppState.user.id}_${today}`;
        if (!sessionStorage.getItem(ntfKey)) {
            sessionStorage.setItem(ntfKey, '1');
            const now = new Date();
            const upcoming = data.filter(e => {
                if (!e.time) return false;
                const [hh, mm] = e.time.split(':').map(Number);
                const evTime = new Date(); evTime.setHours(hh, mm, 0, 0);
                const diffMin = (evTime - now) / 60000;
                return diffMin >= 0 && diffMin <= 120;
            });
            if (upcoming.length) {
                await supabase.from('notifications').insert(
                    upcoming.map(e => ({
                        user_id:    AppState.user.id,
                        title:      `⏰ Скоро: ${e.title}`,
                        message:    `Сьогодні о ${e.time.slice(0,5)}${e.notes ? ' — ' + e.notes : ''}`,
                        type:       'general',
                        created_by: AppState.user.id,
                    }))
                ).catch(() => {});
                UI.loadNotificationCount?.();
            }
        }

        const el = document.createElement('div');
        el.id = 'mc-reminder-modal';
        el.className = 'mc-overlay';
        const dateLabel = new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
        el.innerHTML = `
<div class="mc-modal mc-reminder-box">
    <div class="mc-reminder-hero">
        <div class="mc-reminder-ico">📅</div>
        <div>
            <div class="mc-reminder-title">Ваші події на сьогодні</div>
            <div class="mc-reminder-date">${dateLabel}</div>
        </div>
        <button class="mc-mclose" onclick="document.getElementById('mc-reminder-modal').remove()">✕</button>
    </div>
    <div class="mc-reminder-list">
        ${data.map(e => `
        <div class="mc-reminder-item" style="border-left:4px solid ${e.color}">
            <div class="mc-reminder-item-top">
                ${e.time ? `<span class="mc-reminder-time">${e.time.slice(0,5)}</span>` : '<span class="mc-reminder-time" style="color:var(--text-muted)">Весь день</span>'}
                <span class="mc-reminder-item-title">${e.title}</span>
            </div>
            ${e.notes ? `<div class="mc-reminder-notes">${e.notes}</div>` : ''}
        </div>`).join('')}
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:16px">
        <button class="mc-btn-save" onclick="document.getElementById('mc-reminder-modal').remove();Router.go('my-calendar')">Відкрити календар</button>
        <button class="mc-btn-cancel" onclick="document.getElementById('mc-reminder-modal').remove()" style="margin-left:8px">Закрити</button>
    </div>
</div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    // ── Styles ───────────────────────────────────────────────────

    _styles() {
        return `<style>
.mc-wrap { max-width:960px;padding:20px 16px 80px; }
.mc-header { display:flex;flex-direction:column;gap:12px;margin-bottom:20px; }
.mc-title-row { display:flex;align-items:center;gap:12px;flex-wrap:wrap; }
.mc-title { margin:0;font-size:1.3rem;font-weight:700; }
.mc-readonly-badge { font-size:.75rem;background:rgba(99,102,241,.12);color:#818cf8;border:1px solid rgba(99,102,241,.25);border-radius:20px;padding:3px 10px; }
.mc-access-btn { display:inline-flex;align-items:center;gap:6px;background:rgba(99,102,241,.1);color:var(--primary);border:1px solid rgba(99,102,241,.25);border-radius:20px;padding:5px 14px;font-size:.8rem;cursor:pointer;transition:all .15s; }
.mc-access-btn:hover { background:rgba(99,102,241,.18); }
.mc-access-count { background:var(--primary);color:#fff;border-radius:10px;padding:0 6px;font-size:.72rem; }
.mc-nav { display:flex;align-items:center;gap:12px; }
.mc-nav-btn { background:none;border:1px solid var(--border);border-radius:8px;width:32px;height:32px;cursor:pointer;font-size:1.1rem;color:var(--text);display:flex;align-items:center;justify-content:center;transition:all .15s; }
.mc-nav-btn:hover { background:var(--bg-hover); }
.mc-month-label { font-size:1rem;font-weight:600;min-width:160px; }

.mc-grid { display:grid;grid-template-columns:repeat(7,1fr);gap:4px; }
.mc-dow { text-align:center;font-size:.72rem;font-weight:600;color:var(--text-muted);padding:6px 0;text-transform:uppercase; }
.mc-cell { min-height:120px;background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;padding:8px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:4px;overflow:hidden;min-width:0; width:220px; }
.mc-cell:hover { border-color:var(--primary);background:rgba(99,102,241,.04); }
.mc-cell-empty { background:transparent;border-color:transparent;cursor:default; }
.mc-cell-empty:hover { background:transparent;border-color:transparent; }
.mc-we { background:rgba(239,68,68,.04); }
.mc-today { border-color:var(--primary) !important;background:rgba(99,102,241,.06) !important; }
.mc-day-num { font-size:.78rem;font-weight:600;color:var(--text-muted);line-height:1; }
.mc-day-today { background:var(--primary);color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:.75rem; }
.mc-events-list { display:flex;flex-direction:column;gap:2px;flex:1; }
.mc-event-chip { display:flex;border-radius:6px;padding:3px 6px;cursor:pointer;transition:opacity .15s;overflow:hidden; }
.mc-event-chip:hover { opacity:.8; }
.mc-chip-body { display:flex;flex-direction:column;gap:1px;min-width:0;width:100%; }
.mc-chip-top { display:flex;align-items:center;gap:4px;min-width:0; }
.mc-chip-time { font-size:.65rem;font-weight:700;color:var(--text-muted);flex-shrink:0; }
.mc-chip-repeat { font-size:.6rem;flex-shrink:0;opacity:.7; }
.mc-chip-title { font-size:.72rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1; }
.mc-chip-notes { font-size:.65rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:1.3; }

.mc-fab { position:fixed;bottom:32px;right:32px;width:52px;height:52px;border-radius:50%;background:var(--primary);color:#fff;font-size:1.5rem;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(99,102,241,.45);display:flex;align-items:center;justify-content:center;transition:transform .15s; }
.mc-fab:hover { transform:scale(1.1); }

/* Modal */
.mc-overlay { position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);animation:fadeIn .15s; }
.mc-modal { background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;padding:24px;width:100%;max-width:480px;height:auto;max-height:85vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.4);animation:scaleIn .2s cubic-bezier(.16,1,.3,1); }
.mc-mhdr { display:flex;align-items:center;justify-content:space-between;margin-bottom:16px; }
.mc-mhdr h3 { margin:0;font-size:1.05rem; }
.mc-mclose { background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--text-muted);padding:2px 6px;border-radius:6px; }
.mc-mclose:hover { background:var(--bg-hover); }
.mc-form { display:flex;flex-direction:column;gap:10px; }
.mc-label { font-size:.78rem;font-weight:600;color:var(--text-muted);margin-bottom:-6px; }
.mc-input { background:var(--bg-input,var(--bg-hover));border:1px solid var(--border);border-radius:10px;padding:9px 12px;font-size:.88rem;color:var(--text);outline:none;width:100%;box-sizing:border-box;transition:border-color .15s; }
.mc-input:focus { border-color:var(--primary); }
.mc-textarea { min-height:72px;resize:vertical; }
.mc-colors { display:flex;gap:10px;flex-wrap:wrap;padding:4px 0; }
.mc-color-dot { width:26px;height:26px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:transform .15s; }
.mc-color-dot:hover { transform:scale(1.15); }
.mc-color-dot.active { border-color:var(--text);transform:scale(1.15); }
.mc-modal-actions { display:flex;gap:8px;margin-top:20px;align-items:center; }
.mc-btn-save { background:var(--primary);color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:.88rem;font-weight:600;cursor:pointer;transition:opacity .15s; }
.mc-btn-save:hover { opacity:.88; }
.mc-btn-cancel { background:var(--bg-hover);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:9px 16px;font-size:.88rem;cursor:pointer; }
.mc-btn-cancel:hover { background:var(--border); }
.mc-btn-danger { background:rgba(239,68,68,.12);color:#ef4444;border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:9px 16px;font-size:.88rem;cursor:pointer;margin-left:auto; }
.mc-btn-danger:hover { background:rgba(239,68,68,.22); }

/* Access modal */
.mc-viewer-row { display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:8px;font-size:.85rem; }
.mc-viewer-row:hover { background:var(--bg-hover); }
.mc-viewer-result { cursor:pointer; }
.mc-viewer-add { color:var(--primary);font-weight:700;font-size:1rem; }
.mc-viewer-remove { background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:.9rem;padding:2px 6px;border-radius:6px; }
.mc-viewer-remove:hover { background:rgba(239,68,68,.12);color:#ef4444; }

/* Reminder modal */
.mc-reminder-box { max-width:440px; }
.mc-reminder-hero { display:flex;align-items:center;gap:14px;margin-bottom:18px; }
.mc-reminder-ico { font-size:2rem;line-height:1; }
.mc-reminder-title { font-size:1rem;font-weight:700; }
.mc-reminder-date { font-size:.8rem;color:var(--text-muted);margin-top:2px;text-transform:capitalize; }
.mc-reminder-list { display:flex;flex-direction:column;gap:8px; }
.mc-reminder-item { background:var(--bg-hover);border-radius:10px;padding:10px 14px; }
.mc-reminder-item-top { display:flex;align-items:center;gap:10px; }
.mc-reminder-time { font-size:.8rem;font-weight:700;color:var(--primary);min-width:38px;flex-shrink:0; }
.mc-reminder-item-title { font-size:.9rem;font-weight:600; }
.mc-reminder-notes { font-size:.78rem;color:var(--text-muted);margin-top:5px;line-height:1.45; }
</style>`;
    },
};
