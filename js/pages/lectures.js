// ================================================================
// EduFlow LMS — Лекції (багатоденні події із самозаписом)
// ================================================================

const LecturesPage = {
    _lectures:  [],
    _container: null,
    _pendingCoverFile: null,
    _coverUrl: null,

    _fmtRange(l) {
        const start = new Date(l.start_date + 'T00:00:00');
        const days  = l.duration_days || 1;
        if (days <= 1) return Fmt.dateShort(start);
        const end = new Date(start); end.setDate(end.getDate() + days - 1);
        return `${Fmt.dateShort(start)} — ${Fmt.dateShort(end)}`;
    },

    _dateTimeBadgeHtml(l) {
        const time = l.start_time ? Fmt.esc(l.start_time.slice(0,5)) : '';
        return `
<div class="lc-dt">
    <span class="lc-dt-date"><i class="fa-solid fa-calendar-days"></i> ${this._fmtRange(l)}</span>
    ${time ? `<span class="lc-dt-time"><i class="fa-regular fa-clock"></i> ${time}</span>` : ''}
</div>`;
    },

    _intervalLabel(weeks) {
        const w = weeks || 1;
        if (w === 1) return 'Повторюється щотижня';
        if (w === 2) return 'Повторюється через тиждень';
        return `Повторюється раз на ${w} тижні`;
    },

    _status(l) {
        const today = new Date(); today.setHours(0,0,0,0);
        const start = new Date(l.start_date + 'T00:00:00');
        const end   = new Date(start); end.setDate(end.getDate() + (l.duration_days || 1) - 1);
        if (end < today)   return 'past';
        if (start <= today && today <= end) return 'active';
        return 'upcoming';
    },

    // Запис/скасування запису доступні по день початку включно — навіть для
    // багатоденної лекції не можна записатись чи скасувати запис вже під час/після її старту.
    _canSignup(l) {
        const today = new Date(); today.setHours(0,0,0,0);
        const start = new Date(l.start_date + 'T00:00:00');
        return today <= start;
    },

    // ── Admin: список у Адміністрування → Контент → Лекції ─────────

    async renderTab(container) {
        this._container = container;
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            await API.lectures.ensureRecurrences();
            this._lectures = await API.lectures.getAll();
        } catch(e) { Toast.error('Помилка', e.message); this._lectures = []; }

        container.innerHTML = `
<style>
.lec-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.lec-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:box-shadow .15s,transform .15s}
.lec-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.1);transform:translateY(-2px)}
.lec-cover{height:110px;background:linear-gradient(135deg,#0f172a 0%,#1e40af 55%,#C9A227 100%);background-size:cover;background-position:center;position:relative;display:flex;align-items:flex-end;padding:10px}
.lec-cover-ph{display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);font-size:1.8rem}
.lec-status-badge{position:absolute;top:8px;right:8px;font-size:.64rem;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(0,0,0,.4);color:#fff;backdrop-filter:blur(4px)}
.lec-status-badge.active{background:rgba(16,185,129,.85)}
.lec-status-badge.past{background:rgba(100,116,139,.85)}
.lec-body{padding:14px 16px}
.lec-title{font-weight:700;font-size:.95rem;color:var(--text-primary);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lec-desc{font-size:.78rem;color:var(--text-muted);margin-bottom:8px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.lec-meta{font-size:.72rem;color:var(--text-muted);margin-bottom:10px;display:flex;flex-direction:column;gap:3px}
.lec-actions{display:flex;gap:6px}
.lec-btn{flex:1;padding:7px 10px;border-radius:9px;border:1.5px solid var(--border);background:transparent;color:var(--text-secondary);font-size:.76rem;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;gap:5px}
.lec-btn:hover{border-color:var(--primary);color:var(--primary)}
.lec-btn-danger:hover{border-color:var(--danger)!important;color:var(--danger)!important}
.lec-new-card{border:2px dashed var(--border);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:220px;cursor:pointer;color:var(--text-muted);background:transparent;transition:all .15s}
.lec-new-card:hover{border-color:var(--primary);color:var(--primary)}
.lec-new-card i{font-size:1.6rem}
.lc-dt{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.lc-dt-date{display:inline-flex;align-items:center;gap:6px;font-size:.78rem;font-weight:800;color:var(--primary);background:color-mix(in srgb,var(--primary) 13%,transparent);padding:4px 10px;border-radius:20px;white-space:nowrap}
.lc-dt-date i{font-size:.72rem}
.lc-dt-time{display:inline-flex;align-items:center;gap:5px;font-size:.78rem;font-weight:800;color:#e08a00;background:color-mix(in srgb,#f59e0b 16%,transparent);padding:4px 10px;border-radius:20px;white-space:nowrap}
.lc-dt-time i{font-size:.72rem}
</style>
<div class="lec-grid">
    ${this._lectures.map(l => this._cardHtml(l)).join('')}
    ${AppState.canMutate() ? `
    <button type="button" class="lec-new-card" onclick="LecturesPage.openEditor()">
        <i class="fa-solid fa-plus"></i>
        <span>Нова лекція</span>
    </button>` : ''}
</div>`;
    },

    _cardHtml(l) {
        const count  = l.enrollments?.length || 0;
        const status = this._status(l);
        const statusLbl = { upcoming: 'Заплановано', active: 'Триває', past: 'Завершено' }[status];
        return `
<div class="lec-card">
    <div class="lec-cover" style="${l.cover_image ? `background-image:url('${Fmt.esc(l.cover_image)}')` : ''}">
        ${!l.cover_image ? `<div class="lec-cover-ph"><i class="fa-solid fa-chalkboard-user"></i></div>` : ''}
        <span class="lec-status-badge ${status}">${statusLbl}</span>
    </div>
    <div class="lec-body">
        <div class="lec-title">${Fmt.esc(l.title)}</div>
        ${l.description ? `<div class="lec-desc">${Fmt.esc(l.description)}</div>` : ''}
        ${this._dateTimeBadgeHtml(l)}
        <div class="lec-meta">
            <span><i class="fa-solid fa-users"></i> ${count} записаних</span>
            ${l.lecturers?.length ? `<span><i class="fa-solid fa-chalkboard-user"></i> ${l.lecturers.map(x => Fmt.esc(x.profile?.full_name || '')).join(', ')}</span>` : ''}
            ${l.is_recurring ? `<span><i class="fa-solid fa-rotate"></i> ${this._intervalLabel(l.recurrence_interval_weeks)}</span>` : ''}
            ${l.recurrence_parent_id ? `<span><i class="fa-solid fa-calendar-week"></i> Тижнева група</span>` : ''}
            ${!l.is_published ? `<span style="color:var(--warning)"><i class="fa-solid fa-eye-slash"></i> Чернетка</span>` : ''}
        </div>
        ${AppState.canMutate() ? `
        <div class="lec-actions">
            <button type="button" class="lec-btn" onclick="LecturesPage.openEditor('${l.id}')"><i class="fa-solid fa-pen"></i> Редагувати</button>
            <button type="button" class="lec-btn" onclick="LecturesPage._duplicateLecture('${l.id}')" title="Дублювати"><i class="fa-solid fa-copy"></i></button>
            <button type="button" class="lec-btn lec-btn-danger" onclick="LecturesPage._deleteLecture('${l.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>` : ''}
    </div>
</div>`;
    },

    async _deleteLecture(id) {
        const ok = await Modal.confirm({ title: 'Видалити лекцію', message: 'Лекцію та всі записи на неї буде видалено. Продовжити?', danger: true });
        if (!ok) return;
        Loader.show();
        try {
            await API.lectures.remove(id);
            Toast.success('Лекцію видалено');
            await this.renderTab(this._container);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _duplicateLecture(id) {
        Loader.show();
        try {
            const [lecture, materials, lecturers] = await Promise.all([
                API.lectures.getById(id),
                API.lectureMaterials.getForLecture(id),
                API.lectureLecturers.getForLecture(id)
            ]);
            const payload = {
                title: `${lecture.title} (копія)`,
                description: lecture.description,
                cover_image: lecture.cover_image,
                start_date: lecture.start_date,
                start_time: lecture.start_time,
                duration_days: lecture.duration_days,
                instructions: lecture.instructions,
                is_published: false
            };
            if (!lecture.recurrence_parent_id) {
                payload.is_recurring = lecture.is_recurring;
                payload.recurrence_interval_weeks = lecture.recurrence_interval_weeks;
            }
            const created = await API.lectures.create(payload);
            await Promise.all([
                API.lectureLecturers.setForLecture(created.id, lecturers.map(x => x.profile_id)),
                API.lectureMaterials.setForLecture(created.id, materials.map(m => ({ kind: m.kind, ref_id: m.ref_id, note: m.note })))
            ]);
            Toast.success('Лекцію дубльовано');
            await this.renderTab(this._container);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Editor ───────────────────────────────────────────────────────

    async openEditor(id) {
        this._pendingCoverFile = null;
        let lecture = null;
        let materials = [];
        Loader.show();
        try {
            if (id) [lecture, materials] = await Promise.all([API.lectures.getById(id), API.lectureMaterials.getForLecture(id)]);
            this._editorEmployees = await TestsManagerAPI.getAllEmployees();
        } catch(e) { Loader.hide(); Toast.error('Помилка', e.message); return; }
        Loader.hide();
        this._coverUrl = lecture?.cover_image || null;
        this._editorLecturerIds = new Set((lecture?.lecturers || []).map(x => x.profile?.id).filter(Boolean));
        this._matOptionsCache = {};
        this._editorMaterials = [];
        if (materials.length) {
            await this._hydrateMaterials(materials);
        }
        const isChildOccurrence = !!lecture?.recurrence_parent_id;

        Modal.open({
            title: id ? 'Редагувати лекцію' : 'Нова лекція',
            size: 'lg',
            body: `
<style>
.lece-body{padding-right:4px}
.lece-section{background:var(--bg-raised);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px}
.lece-section-head{display:flex;align-items:center;gap:8px;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:14px}
.lece-section-head i{color:var(--primary);font-size:.8rem}
.lece-cover-wrap{margin-bottom:16px}
.lece-cover-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;height:120px;border:2px dashed var(--border);border-radius:12px;cursor:pointer;color:var(--text-muted);text-align:center}
.lece-cover-empty:hover{border-color:var(--primary);color:var(--primary)}
.lece-cover-preview{position:relative;height:120px;border-radius:12px;overflow:hidden}
.lece-cover-preview img{width:100%;height:100%;object-fit:cover}
.lece-cover-actions{position:absolute;top:8px;right:8px;display:flex;gap:6px}
.lece-cover-btn{width:30px;height:30px;border-radius:8px;border:none;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.lece-field{margin-bottom:14px}
.lece-field:last-child{margin-bottom:0}
.lece-label{display:block;font-size:.78rem;font-weight:700;color:var(--text-secondary);margin-bottom:6px}
.lece-inp,.lece-textarea,.lece-select{width:100%;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.85rem;outline:none;font-family:inherit;transition:border-color .15s}
.lece-inp:focus,.lece-textarea:focus,.lece-select:focus{border-color:var(--primary)}
.lece-textarea{resize:vertical;min-height:60px}
.lece-select{appearance:none;-webkit-appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:30px}
.lece-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lece-switch-row{display:flex;align-items:center;justify-content:space-between;gap:14px;cursor:pointer}
.lece-switch-text{font-size:.85rem;color:var(--text-primary);font-weight:600}
.lece-switch-sub{font-size:.74rem;color:var(--text-muted);margin-top:2px;font-weight:400}
.lece-switch{position:relative;flex-shrink:0;width:40px;height:23px;border-radius:9999px;background:var(--bg-hover);border:1.5px solid var(--border);transition:all .2s;cursor:pointer}
.lece-switch::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--text-muted);transition:all .2s cubic-bezier(.4,0,.2,1)}
.lece-switch input{position:absolute;opacity:0;width:100%;height:100%;margin:0;cursor:pointer}
.lece-switch.on,.lece-switch:has(input:checked){background:var(--primary);border-color:var(--primary)}
.lece-switch.on::after,.lece-switch:has(input:checked)::after{left:19px;background:#fff}
.lece-checklist{border:1px solid var(--border);border-radius:12px;max-height:180px;overflow-y:auto;background:var(--bg-surface)}
.lece-check-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid var(--border);font-size:.83rem;cursor:pointer}
.lece-check-row:last-child{border-bottom:none}
.lece-check-row:hover{background:var(--bg-hover)}
.lece-check-row input{width:16px;height:16px;accent-color:var(--primary);flex-shrink:0}
.lece-check-row span{flex:1;min-width:0;color:var(--text-primary)}
.lece-mat-add{display:flex;gap:8px;margin-bottom:10px}
.lece-mat-search-wrap{position:relative}
.lece-mat-dropdown{display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:20;max-height:220px;overflow-y:auto;background:var(--bg-surface);border:1.5px solid var(--border);border-radius:10px;box-shadow:0 12px 28px rgba(0,0,0,.18)}
.lece-mat-dropdown.open{display:block}
.lece-mat-opt{padding:9px 12px;font-size:.83rem;color:var(--text-primary);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lece-mat-opt:hover,.lece-mat-opt.hl{background:var(--bg-hover)}
.lece-mat-opt-empty{padding:12px;font-size:.8rem;color:var(--text-muted);text-align:center}
.lece-mat-add-btn{flex:0 0 auto;width:38px;border-radius:10px;border:none;background:var(--primary);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.9rem;transition:opacity .15s}
.lece-mat-add-btn:hover{opacity:.85}
.lece-checklist.lece-mat-list{background:var(--bg-surface)}
.lece-mat-item{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border);font-size:.83rem;transition:background .12s}
.lece-mat-item:last-child{border-bottom:none}
.lece-mat-item.dragging{opacity:.4}
.lece-mat-item.drag-over{background:var(--bg-hover);box-shadow:inset 0 2px 0 var(--primary)}
.lece-mat-item>i{margin-top:5px;color:var(--primary);flex-shrink:0;width:14px;text-align:center}
.lece-mat-drag{margin-top:5px;color:var(--text-muted);flex-shrink:0;cursor:grab;width:12px;text-align:center}
.lece-mat-drag:active{cursor:grabbing}
.lece-mat-item-info{flex:1;min-width:0}
.lece-mat-item-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.lece-mat-item-title{color:var(--text-primary);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.lece-mat-item-kind{flex-shrink:0;font-size:.62rem;font-weight:700;color:var(--primary);background:color-mix(in srgb,var(--primary) 12%,transparent);padding:2px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.03em;white-space:nowrap}
.lece-mat-note{width:100%;padding:6px 9px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.78rem;outline:none;font-family:inherit}
.lece-mat-note:focus{border-color:var(--primary)}
.lece-item-btn{width:26px;height:26px;border-radius:7px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;flex-shrink:0;margin-top:1px}
.lece-item-btn:hover{border-color:var(--danger);color:var(--danger)}
.lece-recur-note{display:flex;align-items:center;gap:8px;font-size:.78rem;color:var(--text-muted);background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;padding:10px 12px}
.lece-section:last-child{margin-bottom:0}
.modal-body:has(.lece-body){padding-bottom:.5rem}
</style>
<div class="lece-body">
<div class="lece-section">
    <div class="lece-section-head"><i class="fa-solid fa-circle-info"></i> Основна інформація</div>
    <div class="lece-cover-wrap" id="lece-cover-wrap">${this._coverPreviewHtml()}</div>
    <div class="lece-field">
        <label class="lece-label">Назва лекції</label>
        <input class="lece-inp" id="lece-title" type="text" value="${Fmt.esc(lecture?.title || '')}" placeholder="Напр. Оцінка ювелірних виробів">
    </div>
    <div class="lece-field">
        <label class="lece-label">Опис</label>
        <textarea class="lece-textarea" id="lece-desc" placeholder="Короткий опис лекції">${Fmt.esc(lecture?.description || '')}</textarea>
    </div>
</div>

<div class="lece-section">
    <div class="lece-section-head"><i class="fa-regular fa-calendar"></i> Розклад</div>
    <div class="lece-field lece-row2" style="grid-template-columns:1fr 1fr 1fr">
        <div>
            <label class="lece-label">Дата початку</label>
            <input class="lece-inp" id="lece-start" type="date" value="${lecture?.start_date || ''}">
        </div>
        <div>
            <label class="lece-label">Час початку</label>
            <input class="lece-inp" id="lece-start-time" type="time" value="${lecture?.start_time ? lecture.start_time.slice(0,5) : ''}">
        </div>
        <div>
            <label class="lece-label">Тривалість, днів</label>
            <input class="lece-inp" id="lece-days" type="number" min="1" max="60" value="${lecture?.duration_days || 1}">
        </div>
    </div>
    ${isChildOccurrence ? `
    <div class="lece-recur-note"><i class="fa-solid fa-circle-info"></i> Це тижнева група, згенерована з лекції-шаблону. Повторення налаштовується в оригінальній лекції.</div>` : `
    <label class="lece-switch-row lece-field" for="lece-recurring">
        <div><div class="lece-switch-text">Повторювати</div><div class="lece-switch-sub">Кожен раз — нова група з окремим записом</div></div>
        <span class="lece-switch${lecture?.is_recurring ? ' on' : ''}" id="lece-recurring-sw"><input type="checkbox" id="lece-recurring" ${lecture?.is_recurring ? 'checked' : ''} onchange="LecturesPage._toggleRecurringInterval(this.checked)"></span>
    </label>
    <div class="lece-field" id="lece-interval-wrap" style="${lecture?.is_recurring ? '' : 'display:none'}">
        <label class="lece-label">Інтервал повторення</label>
        <select class="lece-select" id="lece-interval">
            <option value="1" ${(lecture?.recurrence_interval_weeks || 1) === 1 ? 'selected' : ''}>Щотижня</option>
            <option value="2" ${lecture?.recurrence_interval_weeks === 2 ? 'selected' : ''}>Через тиждень (раз на 2 тижні)</option>
            <option value="3" ${lecture?.recurrence_interval_weeks === 3 ? 'selected' : ''}>Раз на 3 тижні</option>
            <option value="4" ${lecture?.recurrence_interval_weeks === 4 ? 'selected' : ''}>Раз на 4 тижні</option>
        </select>
    </div>`}
</div>

<div class="lece-section">
    <div class="lece-section-head"><i class="fa-solid fa-chalkboard-user"></i> Лектори цього тижня</div>
    <div class="lece-checklist" id="lece-lecturer-list">${this._lecturerChecklistHtml()}</div>
</div>

<div class="lece-section">
    <div class="lece-section-head"><i class="fa-solid fa-list-check"></i> Підготовка до лекції</div>
    <div class="lece-field">
        <label class="lece-label">Інструкції для учасника</label>
        <textarea class="lece-textarea" id="lece-instructions" placeholder="Що потрібно зробити перед лекцією">${Fmt.esc(lecture?.instructions || '')}</textarea>
    </div>
    <div class="lece-field">
        <label class="lece-label">Матеріали для підготовки</label>
        <div class="lece-mat-add">
            <select class="lece-select" id="lece-mat-kind" style="flex:0 0 160px" onchange="LecturesPage._onMatKindChange(this.value)">
                <option value="test">Тест</option>
                <option value="test_group">Група тестів</option>
                <option value="course">Курс</option>
                <option value="resource">Файл бази знань</option>
            </select>
            <div class="lece-mat-search-wrap" style="flex:1">
                <input type="text" class="lece-inp" id="lece-mat-search" placeholder="Пошук за назвою..." autocomplete="off"
                    oninput="LecturesPage._filterMatOptions(this.value)"
                    onfocus="LecturesPage._filterMatOptions(this.value)"
                    onblur="setTimeout(() => LecturesPage._closeMatDropdown(), 150)">
                <div class="lece-mat-dropdown" id="lece-mat-dropdown"></div>
            </div>
            <button type="button" class="lece-mat-add-btn" onclick="LecturesPage._addMaterial()"><i class="fa-solid fa-plus"></i></button>
        </div>
        <div class="lece-checklist lece-mat-list" id="lece-mat-list">${this._materialsListHtml()}</div>
    </div>
</div>

<div class="lece-section">
    <label class="lece-switch-row" for="lece-pub">
        <div><div class="lece-switch-text">Опублікувати</div><div class="lece-switch-sub">Буде видно співробітникам для запису</div></div>
        <span class="lece-switch${(lecture ? lecture.is_published : true) ? ' on' : ''}" id="lece-pub-sw"><input type="checkbox" id="lece-pub" ${(lecture ? lecture.is_published : true) ? 'checked' : ''}></span>
    </label>
</div>
</div>`,
            footer: `
<button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
<button class="btn btn-primary" onclick="LecturesPage._save('${id || ''}')"><i class="fa-solid fa-check"></i> Зберегти</button>`
        });
        this._onMatKindChange('test');
    },

    _lecturerChecklistHtml() {
        const employees = this._editorEmployees || [];
        if (!employees.length) return `<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:.8rem">Немає співробітників</div>`;
        return employees.map(e => `
<label class="lece-check-row">
    <input type="checkbox" value="${e.id}" ${this._editorLecturerIds.has(e.id) ? 'checked' : ''} onchange="LecturesPage._toggleLecturer('${e.id}', this.checked)">
    <span>${Fmt.esc(e.full_name)}${e.job_position ? ' · ' + Fmt.esc(e.job_position) : ''}</span>
</label>`).join('');
    },

    _toggleLecturer(profileId, checked) {
        if (checked) this._editorLecturerIds.add(profileId);
        else          this._editorLecturerIds.delete(profileId);
    },

    _toggleRecurringInterval(checked) {
        const wrap = document.getElementById('lece-interval-wrap');
        if (wrap) wrap.style.display = checked ? '' : 'none';
    },

    // ── Матеріали для підготовки (тести/групи/курси/файли бази знань) ─

    _matKindLabel(kind) {
        return { test: 'Тест', test_group: 'Група тестів', course: 'Курс', resource: 'Файл бази знань' }[kind] || kind;
    },

    _matKindIcon(kind) {
        return { test: 'fa-file-pen', test_group: 'fa-layer-group', course: 'fa-book-open', resource: 'fa-folder-open' }[kind] || 'fa-circle';
    },

    async _loadMatOptions(kind) {
        this._matOptionsCache = this._matOptionsCache || {};
        if (this._matOptionsCache[kind]) return this._matOptionsCache[kind];
        let opts = [];
        try {
            if (kind === 'test') {
                const tests = await TestsManagerAPI.getAllStandalone();
                opts = tests.map(t => ({ id: t.id, title: t.title }));
            } else if (kind === 'test_group') {
                const groups = await TestsManagerAPI.getGroups();
                opts = groups.map(g => ({ id: g.id, title: g.title }));
            } else if (kind === 'course') {
                const { data } = await API.courses.getAll({ published: true, pageSize: 500 });
                opts = (data || []).map(c => ({ id: c.id, title: c.title }));
            } else if (kind === 'resource') {
                const { data } = await API.resources.getAll({ studentOnly: true, pageSize: 500 });
                opts = (data || []).map(r => ({ id: r.id, title: r.title }));
            }
        } catch(e) { console.error('[lectures] loadMatOptions:', e); }
        this._matOptionsCache[kind] = opts;
        return opts;
    },

    async _onMatKindChange(kind) {
        this._matSelectedRef = null;
        const search = document.getElementById('lece-mat-search');
        if (search) search.value = '';
        await this._loadMatOptions(kind);
        this._closeMatDropdown();
    },

    async _filterMatOptions(query) {
        const kind = Dom.val('lece-mat-kind');
        const dd   = document.getElementById('lece-mat-dropdown');
        if (!dd) return;
        this._matSelectedRef = null;
        const opts = await this._loadMatOptions(kind);
        const q = (query || '').trim().toLowerCase();
        const filtered = q ? opts.filter(o => o.title.toLowerCase().includes(q)) : opts;
        dd.innerHTML = filtered.length
            ? filtered.slice(0, 50).map(o => `<div class="lece-mat-opt" onmousedown="LecturesPage._pickMatOption('${o.id}', ${JSON.stringify(o.title).replace(/"/g, '&quot;')})">${Fmt.esc(o.title)}</div>`).join('')
            : `<div class="lece-mat-opt-empty">Нічого не знайдено</div>`;
        dd.classList.add('open');
    },

    _pickMatOption(id, title) {
        this._matSelectedRef = { id, title };
        const search = document.getElementById('lece-mat-search');
        if (search) search.value = title;
        this._closeMatDropdown();
    },

    _closeMatDropdown() {
        const dd = document.getElementById('lece-mat-dropdown');
        if (dd) dd.classList.remove('open');
    },

    _addMaterial() {
        const kind = Dom.val('lece-mat-kind');
        const ref  = this._matSelectedRef;
        if (!ref) { Toast.warning('Оберіть матеріал зі списку'); return; }
        if (this._editorMaterials.some(m => m.kind === kind && m.ref_id === ref.id)) {
            Toast.warning('Цей матеріал вже додано'); return;
        }
        this._editorMaterials.push({ kind, ref_id: ref.id, title: ref.title, note: '' });
        document.getElementById('lece-mat-list').innerHTML = this._materialsListHtml();
        this._matSelectedRef = null;
        const search = document.getElementById('lece-mat-search');
        if (search) search.value = '';
    },

    _removeMaterial(i) {
        this._editorMaterials.splice(i, 1);
        document.getElementById('lece-mat-list').innerHTML = this._materialsListHtml();
    },

    _setMaterialNote(i, note) {
        if (this._editorMaterials[i]) this._editorMaterials[i].note = note;
    },

    async _hydrateMaterials(materials) {
        const kinds = [...new Set(materials.map(m => m.kind))];
        const optsByKind = {};
        for (const kind of kinds) optsByKind[kind] = await this._loadMatOptions(kind);
        this._editorMaterials = materials.map(m => ({
            kind: m.kind, ref_id: m.ref_id, note: m.note || '',
            title: optsByKind[m.kind]?.find(o => o.id === m.ref_id)?.title || '—'
        }));
    },

    _materialsListHtml() {
        const items = this._editorMaterials || [];
        if (!items.length) return `<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:.8rem">Матеріалів ще немає</div>`;
        return items.map((it, i) => `
<div class="lece-mat-item" draggable="true" data-idx="${i}"
    ondragstart="LecturesPage._matDragStart(event, ${i})"
    ondragover="LecturesPage._matDragOver(event, ${i})"
    ondragleave="LecturesPage._matDragLeave(event)"
    ondrop="LecturesPage._matDrop(event, ${i})"
    ondragend="LecturesPage._matDragEnd(event)">
    <i class="fa-solid fa-grip-vertical lece-mat-drag"></i>
    <i class="fa-solid ${this._matKindIcon(it.kind)}"></i>
    <div class="lece-mat-item-info">
        <div class="lece-mat-item-top">
            <span class="lece-mat-item-title" title="${Fmt.esc(it.title)}">${Fmt.esc(it.title)}</span>
            <span class="lece-mat-item-kind">${this._matKindLabel(it.kind)}</span>
        </div>
        <input type="text" class="lece-mat-note" placeholder="Примітка (необов'язково)" value="${Fmt.esc(it.note || '')}" oninput="LecturesPage._setMaterialNote(${i}, this.value)">
    </div>
    <button type="button" class="lece-item-btn" onclick="LecturesPage._removeMaterial(${i})"><i class="fa-solid fa-xmark"></i></button>
</div>`).join('');
    },

    _matDragStart(e, i) {
        this._matDragIdx = i;
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('dragging');
    },

    _matDragOver(e, i) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (i === this._matDragIdx) return;
        e.currentTarget.classList.add('drag-over');
    },

    _matDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    },

    _matDrop(e, i) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const from = this._matDragIdx;
        if (from === undefined || from === null || from === i) return;
        const items = this._editorMaterials;
        const [moved] = items.splice(from, 1);
        items.splice(i, 0, moved);
        this._matDragIdx = null;
        document.getElementById('lece-mat-list').innerHTML = this._materialsListHtml();
    },

    _matDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        document.querySelectorAll('.lece-mat-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    },

    _coverPreviewHtml() {
        if (this._coverUrl) return `
<div class="lece-cover-preview">
    <img src="${Fmt.esc(this._coverUrl)}" alt="">
    <div class="lece-cover-actions">
        <label class="lece-cover-btn"><i class="fa-solid fa-image"></i><input type="file" accept="image/*" style="display:none" onchange="LecturesPage._onCoverPick(this)"></label>
        <button type="button" class="lece-cover-btn" onclick="LecturesPage._removeCover()"><i class="fa-solid fa-trash"></i></button>
    </div>
</div>`;
        return `
<label class="lece-cover-empty">
    <i class="fa-solid fa-cloud-arrow-up"></i>
    <span>Завантажити обкладинку лекції</span>
    <input type="file" accept="image/*" style="display:none" onchange="LecturesPage._onCoverPick(this)">
</label>`;
    },

    _onCoverPick(input) {
        const file = input.files[0];
        if (!file) return;
        this._pendingCoverFile = file;
        const reader = new FileReader();
        reader.onload = e => {
            this._coverUrl = e.target.result;
            document.getElementById('lece-cover-wrap').innerHTML = this._coverPreviewHtml();
        };
        reader.readAsDataURL(file);
    },

    _removeCover() {
        this._pendingCoverFile = null;
        this._coverUrl = '';
        document.getElementById('lece-cover-wrap').innerHTML = this._coverPreviewHtml();
    },

    async _save(id) {
        const title = Dom.val('lece-title').trim();
        const startDate = Dom.val('lece-start');
        if (!title)     { Toast.warning('Вкажіть назву лекції'); return; }
        if (!startDate) { Toast.warning('Вкажіть дату початку'); return; }
        const payload = {
            title,
            description:   Dom.val('lece-desc').trim() || null,
            start_date:    startDate,
            start_time:    Dom.val('lece-start-time') || null,
            duration_days: Math.max(1, parseInt(Dom.val('lece-days')) || 1),
            instructions:  Dom.val('lece-instructions').trim() || null,
            is_published:  !!document.getElementById('lece-pub')?.checked
        };
        const recurringEl = document.getElementById('lece-recurring');
        if (recurringEl) {
            payload.is_recurring = !!recurringEl.checked;
            payload.recurrence_interval_weeks = parseInt(Dom.val('lece-interval')) || 1;
        }
        Loader.show();
        try {
            let lecture;
            if (id) lecture = await API.lectures.update(id, payload);
            else     lecture = await API.lectures.create(payload);

            await API.lectureLecturers.setForLecture(lecture.id, [...this._editorLecturerIds]);
            await API.lectureMaterials.setForLecture(lecture.id, this._editorMaterials || []);

            if (this._pendingCoverFile) {
                const url = await API.lectures.uploadCover(lecture.id, this._pendingCoverFile);
                await API.lectures.update(lecture.id, { cover_image: url });
            } else if (this._coverUrl === '') {
                await API.lectures.update(lecture.id, { cover_image: null });
            }

            Toast.success(id ? 'Лекцію збережено' : 'Лекцію створено');
            Modal.close();
            await this.renderTab(this._container);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Student: вкладка «Лекції» в «Моє навчання» ──────────────────

    async renderStudentTab(area) {
        area.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        let lectures = [];
        try {
            await API.lectures.ensureRecurrences();
            lectures = await API.lectures.getPublished();
        }
        catch(e) { area.innerHTML = `<div class="ep-empty"><div class="ep-empty-icon"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="ep-empty-title">${Fmt.esc(e.message)}</div></div>`; return; }

        this._studentLectures = lectures;
        const allMaterialKinds = [...new Set(lectures.flatMap(l => (l.materials || []).map(m => m.kind)))];
        if (allMaterialKinds.length) await Promise.all(allMaterialKinds.map(k => this._loadMatOptions(k)));
        const myLecturing = lectures.filter(l => (l.lecturers || []).some(x => x.profile?.id === AppState.user.id) && this._status(l) !== 'past');
        if (myLecturing.length) await this._hydrateParticipantManagers(myLecturing);

        if (!lectures.length) {
            area.innerHTML = `
<div class="ep-empty">
    <div class="ep-empty-icon"><i class="fa-solid fa-chalkboard-user"></i></div>
    <div class="ep-empty-title">Лекцій поки немає</div>
    <div class="ep-empty-sub">Тут з'являться лекції, на які можна записатися</div>
</div>`;
            return;
        }

        const upcoming = lectures.filter(l => this._status(l) !== 'past');
        const past     = lectures.filter(l => this._status(l) === 'past');

        area.innerHTML = `
<style>
.lst-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;margin-bottom:8px}
.lst-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
.lst-cover{height:110px;background:linear-gradient(135deg,#0f172a 0%,#1e40af 55%,#C9A227 100%);background-size:cover;background-position:center;position:relative;display:flex;align-items:flex-end;padding:10px}
.lst-cover-ph{display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);font-size:1.8rem;width:100%}
.lst-status-badge{position:absolute;top:8px;right:8px;font-size:.64rem;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(0,0,0,.4);color:#fff;backdrop-filter:blur(4px)}
.lst-cover-lecturer{position:absolute;bottom:8px;left:8px;width:38px;height:38px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,.85);box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;background:var(--primary);color:#fff;font-size:.7rem;font-weight:700}
.lst-cover-lecturer img{width:100%;height:100%;object-fit:cover}
.lst-status-badge.active{background:rgba(16,185,129,.85)}
.lst-body{padding:14px 16px;display:flex;flex-direction:column;gap:8px;flex:1}
.lst-title{font-weight:700;font-size:.95rem;color:var(--text-primary)}
.lst-lecturer{font-size:.76rem;color:var(--text-muted);display:flex;align-items:center;gap:6px;margin-top:-4px}
.lst-lecturer i{color:var(--primary);font-size:.7rem}
.lst-desc{font-size:.78rem;color:var(--text-muted);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.lst-meta{font-size:.76rem;color:var(--text-muted);display:flex;align-items:center;gap:6px}
.lst-btn{margin-top:auto;width:100%;padding:.6rem;border-radius:10px;border:none;font-size:.83rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all .15s}
.lst-btn-join{background:linear-gradient(135deg,#C9A227,#e0b62f);color:#241c02}
.lst-btn-leave{background:transparent;border:1.5px solid var(--border);color:var(--text-secondary)}
.lst-btn-leave:hover{border-color:var(--danger);color:var(--danger)}
.lst-section-head{font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin:0 0 12px}
.lst-past{opacity:.6}
.lst-prep{margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
.lst-prep-title{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:6px;display:flex;align-items:center;gap:6px}
.lst-prep-instructions{font-size:.8rem;color:var(--text-secondary);margin-bottom:8px;white-space:pre-line}
.lst-prep-item{display:flex;align-items:flex-start;gap:8px;font-size:.8rem;margin-bottom:6px}
.lst-prep-item:last-child{margin-bottom:0}
.lst-prep-item i{margin-top:2px;color:var(--primary);flex-shrink:0}
.lst-prep-item-info{min-width:0}
.lst-prep-item-info a{color:var(--primary);font-weight:600;text-decoration:none}
.lst-prep-item-info a:hover{text-decoration:underline}
.lst-prep-item-info span{font-weight:600;color:var(--text-primary)}
.lst-prep-item-kind{font-size:.66rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.03em;margin-left:5px}
.lst-prep-item-note{font-size:.74rem;color:var(--text-muted);margin-top:1px}
.lst-layout{display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start}
.lst-side{position:sticky;top:16px;min-width:0}
@media(max-width:900px){.lst-layout{grid-template-columns:1fr}.lst-side{position:static}}
.lec-lecturer-wrap{min-width:0}
.lec-lecturer-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;padding:16px 18px;margin-bottom:10px}
.lec-lecturer-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.lec-lecturer-title{font-weight:700;font-size:.9rem;color:var(--text-primary)}
.lec-lecturer-meta{font-size:.76rem;color:var(--text-muted)}
.lec-lecturer-count{font-size:.78rem;font-weight:700;color:var(--primary);background:color-mix(in srgb,var(--primary) 12%,transparent);padding:3px 10px;border-radius:20px;white-space:nowrap}
.lec-participant{display:flex;align-items:flex-start;gap:9px;padding:9px 0;font-size:.83rem;color:var(--text-secondary);border-top:1px solid var(--border)}
.lec-participant>i{margin-top:3px;color:var(--text-muted);font-size:.78rem;flex-shrink:0}
.lec-participant-info{min-width:0;flex:1}
.lec-participant-name{font-weight:600;color:var(--text-primary);font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lec-participant-name-link{cursor:pointer}
.lec-participant-name-link:hover{color:var(--primary);text-decoration:underline}
.lec-participant-details{font-size:.72rem;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lec-participant:first-of-type{border-top:none}
.lc-dt{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px}
.lc-dt-date{display:inline-flex;align-items:center;gap:6px;font-size:.78rem;font-weight:800;color:var(--primary);background:color-mix(in srgb,var(--primary) 13%,transparent);padding:4px 10px;border-radius:20px;white-space:nowrap}
.lc-dt-date i{font-size:.72rem}
.lc-dt-time{display:inline-flex;align-items:center;gap:5px;font-size:.78rem;font-weight:800;color:#e08a00;background:color-mix(in srgb,#f59e0b 16%,transparent);padding:4px 10px;border-radius:20px;white-space:nowrap}
.lc-dt-time i{font-size:.72rem}
</style>
${myLecturing.length ? `
<div class="lst-layout">
    <div class="lst-main">
        ${upcoming.length ? `<div class="lst-grid">${upcoming.map(l => this._studentCardHtml(l)).join('')}</div>` : ''}
        ${past.length ? `
        <div class="lst-section-head" style="margin-top:24px">Минулі лекції</div>
        <div class="lst-grid lst-past">${past.map(l => this._studentCardHtml(l)).join('')}</div>` : ''}
    </div>
    <aside class="lst-side">${this._lecturerSectionHtml(myLecturing)}</aside>
</div>` : `
${upcoming.length ? `<div class="lst-grid">${upcoming.map(l => this._studentCardHtml(l)).join('')}</div>` : ''}
${past.length ? `
<div class="lst-section-head" style="margin-top:24px">Минулі лекції</div>
<div class="lst-grid lst-past">${past.map(l => this._studentCardHtml(l)).join('')}</div>` : ''}`}`;
    },

    async _hydrateParticipantManagers(myLecturing) {
        const userIds = [...new Set(myLecturing.flatMap(l => (l.enrollments || []).map(e => e.user_id)))];
        if (!userIds.length) return;
        try {
            const { data: profs, error: profErr } = await supabase.from('profiles')
                .select('id, manager_id').in('id', userIds);
            if (profErr) throw profErr;
            const managerIds = [...new Set((profs || []).map(p => p.manager_id).filter(Boolean))];
            let managerNames = new Map();
            if (managerIds.length) {
                const { data: mgrs, error: mgrErr } = await supabase.from('profiles')
                    .select('id, full_name').in('id', managerIds);
                if (mgrErr) throw mgrErr;
                managerNames = new Map((mgrs || []).map(m => [m.id, m.full_name]));
            }
            const userManagerMap = new Map((profs || []).map(p => [p.id, p.manager_id ? managerNames.get(p.manager_id) || null : null]));
            myLecturing.forEach(l => (l.enrollments || []).forEach(e => {
                if (e.user) e.user.manager = { full_name: userManagerMap.get(e.user_id) || null };
            }));
        } catch(e) { console.error('[lectures] hydrateParticipantManagers:', e); }
    },

    _lecturerSectionHtml(myLecturing) {
        this._lecParticipantsFlat = [];
        return `
<div class="lec-lecturer-wrap">
    <div class="lst-section-head"><i class="fa-solid fa-chalkboard-user"></i> Лекції, де ви лектор</div>
    ${myLecturing.map(l => {
        const participants = l.enrollments || [];
        return `
<div class="lec-lecturer-card">
    <div class="lec-lecturer-head">
        <div>
            <div class="lec-lecturer-title">${Fmt.esc(l.title)}</div>
            <div class="lec-lecturer-meta"><i class="fa-regular fa-calendar"></i> ${this._fmtRange(l)}</div>
        </div>
        <span class="lec-lecturer-count">${participants.length} у групі</span>
    </div>
    ${participants.length
        ? participants.map(p => {
            const u = p.user || {};
            const details = [
                u.job_position || null,
                u.city || null,
                u.phone || null
            ].filter(Boolean).map(Fmt.esc).join(' · ');
            const idx = this._lecParticipantsFlat.push(u) - 1;
            return `
<div class="lec-participant">
    <i class="fa-regular fa-circle-user"></i>
    <div class="lec-participant-info">
        <div class="lec-participant-name lec-participant-name-link" title="Переглянути профіль" onclick="LecturesPage._openParticipantProfile(${idx})">${Fmt.esc(u.full_name || '—')}</div>
        ${details ? `<div class="lec-participant-details" title="${Fmt.esc(details)}">${details}</div>` : ''}
    </div>
</div>`;
        }).join('')
        : `<div class="lec-lecturer-meta">Ще ніхто не записався</div>`}
</div>`;
    }).join('')}
</div>`;
    },

    _openParticipantProfile(idx) {
        const u = this._lecParticipantsFlat?.[idx];
        if (!u) return;
        const row = (icon, label, val) => val ? `
<div class="lpp-row"><i class="fa-solid ${icon}"></i>
    <div><div class="lpp-row-label">${label}</div><div class="lpp-row-val">${val}</div></div>
</div>` : '';
        Modal.open({
            title: '',
            noHeader: true,
            size: 'sm',
            body: `
<style>
.lpp-wrap{margin:-1.25rem -1.5rem -1rem;border-radius:var(--radius-xl);overflow:hidden}
.lpp-hero{padding:1.5rem;display:flex;align-items:center;gap:1rem;background:linear-gradient(135deg,#6366f1,#8b5cf6)}
.lpp-avatar{width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:800;color:#fff;flex-shrink:0}
.lpp-name{font-size:1.05rem;font-weight:800;color:#fff}
.lpp-body{padding:1rem 1.5rem 1.25rem;background:var(--bg-surface);display:flex;flex-direction:column;gap:.35rem}
.lpp-row{display:flex;align-items:flex-start;gap:.7rem;padding:.5rem .3rem;border-radius:var(--radius-md)}
.lpp-row i{width:1.1rem;text-align:center;margin-top:.15rem;color:var(--primary);font-size:.85rem;flex-shrink:0}
.lpp-row-label{font-size:.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.1rem}
.lpp-row-val{font-size:.85rem;color:var(--text-primary);font-weight:500}
</style>
<div class="lpp-wrap">
    <div class="lpp-hero">
        <div class="lpp-avatar">${Fmt.esc(Fmt.initials(u.full_name))}</div>
        <div class="lpp-name">${Fmt.esc(u.full_name || '—')}</div>
    </div>
    <div class="lpp-body">
        ${row('fa-briefcase', 'Посада', Fmt.esc(u.job_position))}
        ${row('fa-location-dot', 'Місто', Fmt.esc(u.city))}
        ${row('fa-phone', 'Телефон', Fmt.esc(u.phone))}
        ${row('fa-user-tie', 'Керівник', u.manager?.full_name ? Fmt.esc(u.manager.full_name) : null)}
    </div>
</div>`
        });
    },

    _studentCardHtml(l) {
        const enrolled  = (l.enrollments || []).some(e => e.user_id === AppState.user.id);
        const status    = this._status(l);
        const isPast    = status === 'past';
        const canSignup = this._canSignup(l);
        const statusLbl = { upcoming: 'Заплановано', active: 'Триває', past: 'Завершено' }[status];
        const lecturer  = l.lecturers?.[0]?.profile;
        return `
<div class="lst-card">
    <div class="lst-cover" style="${l.cover_image ? `background-image:url('${Fmt.esc(l.cover_image)}')` : ''}">
        ${!l.cover_image ? `<div class="lst-cover-ph"><i class="fa-solid fa-chalkboard-user"></i></div>` : ''}
        ${lecturer ? `
        <div class="lst-cover-lecturer" title="${Fmt.esc(lecturer.full_name)}">
            ${lecturer.avatar_url
                ? `<img src="${Fmt.esc(lecturer.avatar_url)}" alt="">`
                : `<span>${Fmt.esc(Fmt.initials(lecturer.full_name))}</span>`}
        </div>` : ''}
        <span class="lst-status-badge ${status}">${statusLbl}</span>
    </div>
    <div class="lst-body">
        <div class="lst-title">${Fmt.esc(l.title)}</div>
        ${l.lecturers?.length ? `<div class="lst-lecturer"><i class="fa-solid fa-chalkboard-user"></i> ${l.lecturers.map(x => Fmt.esc(x.profile?.full_name || '')).filter(Boolean).join(', ')}</div>` : ''}
        ${l.description ? `<div class="lst-desc">${Fmt.esc(l.description)}</div>` : ''}
        ${this._dateTimeBadgeHtml(l)}
        ${isPast
            ? (enrolled ? `<div class="lst-meta"><i class="fa-solid fa-check"></i> Ви були записані</div>` : '')
            : !canSignup
                ? (enrolled
                    ? `<div class="lst-meta"><i class="fa-solid fa-check"></i> Ви записані</div>`
                    : `<div class="lst-meta"><i class="fa-solid fa-lock"></i> Запис закрито</div>`)
                : enrolled
                    ? `<button type="button" class="lst-btn lst-btn-leave" onclick="LecturesPage._leave('${l.id}')"><i class="fa-solid fa-xmark"></i> Скасувати запис</button>`
                    : `<button type="button" class="lst-btn lst-btn-join" onclick="LecturesPage._join('${l.id}')"><i class="fa-solid fa-plus"></i> Записатися</button>`}
        ${enrolled && !isPast ? this._prepBlockHtml(l) : ''}
    </div>
</div>`;
    },

    _prepBlockHtml(l) {
        const materials = l.materials || [];
        if (!l.instructions && !materials.length) return '';
        return `
<div class="lst-prep">
    <div class="lst-prep-title"><i class="fa-solid fa-list-check"></i> Що потрібно зробити</div>
    ${l.instructions ? `<div class="lst-prep-instructions">${Fmt.esc(l.instructions)}</div>` : ''}
    ${materials.length ? materials.map(m => {
        const opt   = this._matOptionsCache?.[m.kind]?.find(o => o.id === m.ref_id);
        const title = opt?.title || this._matKindLabel(m.kind);
        const route = m.kind === 'test' ? `tests/${m.ref_id}` : m.kind === 'course' ? `courses/${m.ref_id}` : m.kind === 'resource' ? `resource/${m.ref_id}` : null;
        return `
<div class="lst-prep-item">
    <i class="fa-solid ${this._matKindIcon(m.kind)}"></i>
    <div class="lst-prep-item-info">
        ${route
            ? `<a href="javascript:void(0)" onclick="Router.go('${route}')">${Fmt.esc(title)}</a>`
            : `<span>${Fmt.esc(title)}</span>`}
        <span class="lst-prep-item-kind">${this._matKindLabel(m.kind)}</span>
        ${m.note ? `<div class="lst-prep-item-note">${Fmt.esc(m.note)}</div>` : ''}
    </div>
</div>`;
    }).join('') : ''}
</div>`;
    },

    async _join(lectureId) {
        Loader.show();
        try {
            await API.lectureEnrollments.enroll(lectureId);
            await API.lectureMaterials.applyForUser(lectureId, AppState.user.id);
            const lecture = this._studentLectures?.find(l => l.id === lectureId);
            if (lecture) {
                try { await API.lectureEnrollments.addCalendarEvents(lecture); }
                catch(e) { console.error('[lectures] addCalendarEvents:', e); }
            }
            Toast.success('Ви записані на лекцію');
            const area = document.getElementById('ep-content');
            if (area) await this.renderStudentTab(area);
            ExpertPathPage._fetchAndShowCounts?.();
            DashboardPage._refreshCalWidget?.();
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _leave(lectureId) {
        const ok = await Modal.confirm({ title: 'Скасувати запис', message: 'Скасувати запис на цю лекцію?' });
        if (!ok) return;
        Loader.show();
        try {
            await API.lectureEnrollments.unenroll(lectureId);
            try { await API.lectureEnrollments.removeCalendarEvents(lectureId); }
            catch(e) { console.error('[lectures] removeCalendarEvents:', e); }
            Toast.info('Запис скасовано');
            const area = document.getElementById('ep-content');
            if (area) await this.renderStudentTab(area);
            ExpertPathPage._fetchAndShowCounts?.();
            DashboardPage._refreshCalWidget?.();
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    }
};
