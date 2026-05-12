// ================================================================
// EduFlow LMS — Опитування (Surveys)
// Вбудовано у вкладку expert-path → SurveysPage.renderInTab(area)
// ================================================================

const SurveysPage = {

    _surveys:   [],
    _filter:    'active', // 'active' | 'done' | 'all'
    _myDone:        new Set(), // survey ids current user already responded
    _myAssignments: new Map(), // surveyId → assignment row (for regular users)
    _takeState:     null,      // { surveyId, questions } — set before rendering take view

    // ── Entry point (from ExpertPathPage) ────────────────────────
    async renderInTab(area) {
        area.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            const canManage = AppState.isAdmin() || AppState.profile?.role === 'smm';
            const isStaff   = AppState.isStaff();

            let all;
            if (canManage) {
                // admins/smm see everything
                all = await API.surveys.getAll({});
            } else if (isStaff) {
                // teachers/managers see published only
                all = await API.surveys.getAll({ published: true });
            } else {
                // regular users see only what's assigned to them
                const { data: assignments } = await supabase
                    .from('survey_assignments')
                    .select('survey_id, deadline_at')
                    .eq('user_id', AppState.user.id);
                this._myAssignments = new Map((assignments || []).map(a => [a.survey_id, a]));

                if (!assignments?.length) {
                    all = [];
                } else {
                    const ids = assignments.map(a => a.survey_id);
                    all = await supabase.from('surveys')
                        .select('*, questions:survey_questions(id)')
                        .in('id', ids)
                        .eq('is_published', true)
                        .order('created_at', { ascending: false })
                        .then(r => r.data || []);
                }
            }
            this._surveys = all;

            const responded = await Promise.all(
                all.map(s => API.surveys.hasResponded(s.id).catch(() => false))
            );
            this._myDone = new Set(all.filter((_, i) => responded[i]).map(s => s.id));

            this._renderList(area);
        } catch(e) {
            area.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">${Fmt.esc(e.message)}</p></div>`;
        }
    },

    // ── List ─────────────────────────────────────────────────────
    _renderList(area) {
        const isStaff = AppState.isStaff();
        const canManage = AppState.isAdmin() || AppState.profile?.role === 'smm';

        area.innerHTML = `
<style>
@keyframes sv-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.sv-list-wrap{animation:sv-in .3s ease}
.sv-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:1.5rem;flex-wrap:wrap}
.sv-filters{display:flex;gap:8px;flex-wrap:wrap}
.sv-filter-btn{
    padding:7px 18px;border-radius:50px;
    border:1.5px solid var(--border);
    background:var(--bg-surface);color:var(--text-muted);
    font-size:.8rem;font-weight:600;cursor:pointer;
    transition:all .18s;
    display:flex;align-items:center;gap:7px;white-space:nowrap
}
.sv-filter-btn:hover:not(.active){border-color:#10b981;color:#10b981}
.sv-filter-btn.active{background:#10b981;color:#fff;border-color:#10b981}
.sv-filter-count{
    padding:1px 8px;border-radius:20px;font-size:.68rem;font-weight:800;line-height:1.6;
}
.sv-filter-btn:not(.active) .sv-filter-count{background:var(--border);color:var(--text-muted)}
.sv-filter-btn.active .sv-filter-count{background:rgba(255,255,255,.25);color:#fff}
.sv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.sv-card{border-radius:20px;overflow:hidden;border:1.5px solid var(--border);background:var(--bg-surface);box-shadow:0 2px 10px rgba(0,0,0,.05);transition:transform .2s,box-shadow .2s,border-color .2s;cursor:pointer;display:flex;flex-direction:column}
.sv-card:hover{transform:translateY(-4px);box-shadow:0 10px 32px rgba(0,0,0,.12)}
.sv-card-banner{padding:20px 18px 16px;position:relative;min-height:96px;display:flex;flex-direction:column;justify-content:flex-end}
.sv-done-badge{position:absolute;top:12px;right:12px;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,.2);color:#fff;font-size:.68rem;font-weight:700;backdrop-filter:blur(4px);display:flex;align-items:center;gap:4px}
.sv-anon-badge{position:absolute;top:12px;left:12px;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,.15);color:rgba(255,255,255,.9);font-size:.65rem;font-weight:600;backdrop-filter:blur(4px)}
.sv-card-title{font-size:1rem;font-weight:800;color:#fff;line-height:1.25;text-shadow:0 1px 6px rgba(0,0,0,.25)}
.sv-card-body{padding:12px 16px 14px;flex:1;display:flex;flex-direction:column;gap:6px}
.sv-card-desc{font-size:.8rem;color:var(--text-secondary);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sv-card-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:2px}
.sv-meta-item{display:flex;align-items:center;gap:5px;font-size:.73rem;color:var(--text-muted)}
.sv-card-footer{padding:10px 16px 14px;border-top:1px solid var(--border);display:flex;gap:8px}
.sv-btn{flex:1;padding:7px 12px;border-radius:10px;border:none;font-size:.8rem;font-weight:600;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:6px}
.sv-btn-primary{background:var(--primary);color:#fff}
.sv-btn-primary:hover{filter:brightness(1.1)}
.sv-btn-ghost{background:var(--bg-raised);color:var(--text-secondary);border:1.5px solid var(--border)}
.sv-btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
.sv-btn-danger{background:rgba(239,68,68,.1);color:var(--danger);border:1.5px solid rgba(239,68,68,.25)}
.sv-btn-danger:hover{background:rgba(239,68,68,.18)}
.sv-empty{text-align:center;padding:4rem 2rem;color:var(--text-muted)}
.sv-draft-label{display:inline-block;padding:2px 8px;border-radius:12px;font-size:.65rem;font-weight:700;background:rgba(100,116,139,.15);color:#64748b;margin-bottom:4px}
</style>

<div class="sv-list-wrap">
    <div class="sv-toolbar">
        <div class="sv-filters" id="sv-filters">
            ${this._filterBtnsHtml()}
        </div>
        ${canManage ? `<button class="sv-btn sv-btn-primary" style="flex:none;padding:7px 18px" onclick="SurveysPage.openBuilder()"><i class="fa-solid fa-plus"></i> Створити</button>` : ''}
    </div>
    <div id="sv-grid" class="sv-grid">${this._cardsHtml()}</div>
</div>`;
    },

    _filterCounts() {
        const now = new Date();
        let active = 0, done = 0;
        this._surveys.forEach(s => {
            const dl = this._effectiveDeadline(s);
            const expired = dl && new Date(dl) < now;
            const isDone = this._myDone.has(s.id);
            if (isDone) done++;
            else if (s.is_published && !expired) active++;
        });
        return { active, done, all: this._surveys.length };
    },

    _filterBtnsHtml() {
        const c = this._filterCounts();
        return [
            { f: 'active', label: 'Активні',  count: c.active },
            { f: 'done',   label: 'Пройдені', count: c.done   },
            { f: 'all',    label: 'Усі',      count: c.all    },
        ].map(({ f, label, count }) => `
            <button class="sv-filter-btn${this._filter===f?' active':''}" data-f="${f}" onclick="SurveysPage._setFilter('${f}')">
                ${label}<span class="sv-filter-count">${count}</span>
            </button>`).join('');
    },

    _setFilter(f) {
        this._filter = f;
        const wrap = document.getElementById('sv-filters');
        if (wrap) wrap.innerHTML = this._filterBtnsHtml();
        document.getElementById('sv-grid').innerHTML = this._cardsHtml();
    },

    _effectiveDeadline(s) {
        // for assigned users, prefer assignment deadline over survey deadline
        const asgn = this._myAssignments.get(s.id);
        return asgn?.deadline_at || s.deadline_at || null;
    },

    _filtered() {
        const now = new Date();
        return this._surveys.filter(s => {
            const dl      = this._effectiveDeadline(s);
            const expired = dl && new Date(dl) < now;
            const done    = this._myDone.has(s.id);
            if (this._filter === 'active') return s.is_published && !expired && !done;
            if (this._filter === 'done')   return done;
            return true;
        });
    },

    _theme(s) {
        const now     = new Date();
        const dl      = this._effectiveDeadline(s);
        const expired = dl && new Date(dl) < now;
        const done    = this._myDone.has(s.id);
        if (!s.is_published) return { from: '#64748b', to: '#94a3b8' };
        if (done || expired)  return { from: '#10b981', to: '#0ea5e9' };
        return { from: '#6366f1', to: '#8b5cf6' };
    },

    _cardsHtml() {
        const list = this._filtered();
        if (!list.length) return `<div class="sv-empty" style="grid-column:1/-1"><div style="font-size:3rem;margin-bottom:.75rem;opacity:.25"><i class="fa-solid fa-square-poll-horizontal"></i></div><div>Опитувань немає</div></div>`;
        return list.map((s, idx) => this._cardHtml(s, idx)).join('');
    },

    _cardHtml(s, idx) {
        const theme   = this._theme(s);
        const done    = this._myDone.has(s.id);
        const canManage = AppState.isAdmin() || AppState.profile?.role === 'smm';
        const isStaff   = AppState.isStaff();
        const qCount  = s.questions?.length || 0;
        const now     = new Date();
        const dl      = this._effectiveDeadline(s);
        const expired = dl && new Date(dl) < now;

        let deadlineLabel = '';
        if (dl) {
            const d = new Date(dl);
            const diff = Math.ceil((d - now) / 86400000);
            deadlineLabel = expired
                ? `<span class="sv-meta-item" style="color:var(--danger)"><i class="fa-solid fa-hourglass-end"></i> Завершено</span>`
                : diff <= 3
                    ? `<span class="sv-meta-item" style="color:#f59e0b"><i class="fa-solid fa-clock"></i> ${diff} дн.</span>`
                    : `<span class="sv-meta-item"><i class="fa-regular fa-calendar"></i> до ${Fmt.dateShort(s.deadline_at)}</span>`;
        }

        return `
<div class="sv-card" style="animation:sv-in .3s ease ${idx*60}ms both;border-color:${done?'rgba(16,185,129,.35)':'var(--border)'}">
    <div class="sv-card-banner" style="background:linear-gradient(135deg,${theme.from},${theme.to})">
        ${done ? `<div class="sv-done-badge"><i class="fa-solid fa-check"></i> Пройдено</div>` : ''}
        ${s.is_anonymous ? `<div class="sv-anon-badge"><i class="fa-solid fa-user-secret"></i> Анонімне</div>` : ''}
        ${!s.is_published ? `<div class="sv-draft-label">Чернетка</div>` : ''}
        <div class="sv-card-title">${Fmt.esc(s.title)}</div>
    </div>
    <div class="sv-card-body">
        ${s.description ? `<div class="sv-card-desc">${Fmt.esc(s.description)}</div>` : ''}
        <div class="sv-card-meta">
            <span class="sv-meta-item"><i class="fa-solid fa-circle-question"></i> ${qCount} питань</span>
            ${deadlineLabel}
            ${isStaff ? `<span class="sv-meta-item"><i class="fa-solid fa-users"></i> <span id="sv-cnt-${s.id}">…</span></span>` : ''}
        </div>
    </div>
    <div class="sv-card-footer">
        ${done || expired
            ? `<button onclick="SurveysPage.openResults('${s.id}')" style="display:inline-flex;align-items:center;gap:8px;padding:7px 16px;border-radius:10px;border:none;cursor:pointer;font-size:.8rem;font-weight:700;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 4px 14px rgba(22,163,74,.35);transition:all .2s" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''"><i class="fa-solid fa-chart-bar"></i> ${isStaff ? 'Результати' : 'Переглянути'}</button>`
            : s.is_published
                ? `<button class="sv-btn sv-btn-primary" onclick="SurveysPage.openTake('${s.id}')"><i class="fa-solid fa-pen-to-square"></i> Пройти</button>`
                : ''}
        ${isStaff && !done ? `<button onclick="SurveysPage.openResults('${s.id}')" style="display:inline-flex;align-items:center;justify-content:center;padding:7px 10px;border-radius:10px;border:none;cursor:pointer;font-size:.85rem;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 4px 14px rgba(22,163,74,.35);transition:all .2s" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''"><i class="fa-solid fa-chart-bar"></i></button>` : ''}
        ${canManage ? `
            <button class="sv-btn sv-btn-ghost" style="flex:none;padding:7px 10px" title="Призначити" onclick="SurveysPage.openAssign('${s.id}')"><i class="fa-solid fa-users"></i></button>
            <button class="sv-btn sv-btn-ghost" style="flex:none;padding:7px 10px" title="Попередній перегляд" onclick="SurveysPage.openPreview('${s.id}')"><i class="fa-solid fa-eye"></i></button>
            <button class="sv-btn sv-btn-ghost" style="flex:none;padding:7px 10px" title="Редагувати" onclick="SurveysPage.openBuilder('${s.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="sv-btn sv-btn-danger" style="flex:none;padding:7px 10px" data-title="${Fmt.esc(s.title)}" onclick="SurveysPage._deleteSurvey('${s.id}',this.dataset.title)"><i class="fa-solid fa-trash"></i></button>
        ` : ''}
    </div>
</div>`;
    },

    // ── Load respondent counts async ──────────────────────────────
    _loadCounts() {
        this._surveys.forEach(s => {
            API.surveys.getRespondentCount(s.id).then(n => {
                const el = document.getElementById(`sv-cnt-${s.id}`);
                if (el) el.textContent = n;
            }).catch(() => {});
        });
    },

    // ── Take survey ───────────────────────────────────────────────
    async openTake(surveyId) {
        const area = document.getElementById('ep-content');
        if (!area) return;
        area.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        Loader.show();
        try {
            const [survey, questions] = await Promise.all([
                API.surveys.getById(surveyId),
                API.surveys.getQuestions(surveyId)
            ]);
            this._renderTake(area, survey, questions);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async openPreview(surveyId) {
        const area = document.getElementById('ep-content');
        if (!area) return;
        area.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        Loader.show();
        try {
            const [survey, questions] = await Promise.all([
                API.surveys.getById(surveyId),
                API.surveys.getQuestions(surveyId)
            ]);
            this._renderTake(area, survey, questions, { preview: true });
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _renderTake(area, survey, questions, opts = {}) {
        this._takeState = { surveyId: survey.id, questions, preview: !!opts.preview };
        const theme = this._theme(survey);
        area.innerHTML = `
<style>
.sv-take-wrap{max-width:680px;animation:sv-in .3s ease}
.sv-take-header{border-radius:20px;padding:24px 28px;margin-bottom:1.5rem;background:linear-gradient(135deg,${theme.from},${theme.to});position:relative;overflow:hidden}
.sv-take-header::after{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='0.04'%3E%3Cpath d='M20 20h20v20H20z'/%3E%3C/g%3E%3C/svg%3E")}
.sv-take-title{font-size:1.4rem;font-weight:800;color:#fff;margin-bottom:.4rem;position:relative;z-index:1}
.sv-take-desc{font-size:.875rem;color:rgba(255,255,255,.8);position:relative;z-index:1}
.sv-q-card{background:var(--bg-surface);border:1.5px solid var(--border);border-radius:18px;padding:20px 22px;margin-bottom:14px;transition:border-color .2s}
.sv-q-card.required-error{border-color:var(--danger);animation:sv-shake .3s ease}
@keyframes sv-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.sv-q-num{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:6px}
.sv-q-text{font-size:.95rem;font-weight:700;color:var(--text-primary);margin-bottom:14px;line-height:1.4}
.sv-q-required{color:var(--danger);margin-left:3px}
/* Radio / Checkbox cards */
.sv-options{display:flex;flex-direction:column;gap:8px}
.sv-option{display:flex;align-items:center;gap:12px;padding:11px 15px;border:1.5px solid var(--border);border-radius:12px;cursor:pointer;transition:all .15s;user-select:none}
.sv-option:hover{border-color:${theme.from};background:rgba(99,102,241,.04)}
.sv-option.selected{border-color:${theme.from};background:linear-gradient(135deg,${theme.from}18,${theme.to}10)}
.sv-option-marker{width:20px;height:20px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .15s;font-size:.7rem;color:#fff}
.sv-option.selected .sv-option-marker{background:${theme.from};border-color:${theme.from}}
.sv-option-marker-sq{border-radius:5px}
.sv-option-text{font-size:.875rem;color:var(--text-primary);font-weight:500}
/* Text */
.sv-textarea{width:100%;padding:12px 14px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:12px;font-size:.875rem;color:var(--text-primary);font-family:inherit;resize:vertical;min-height:90px;outline:none;transition:border-color .15s;box-sizing:border-box}
.sv-textarea:focus{border-color:${theme.from}}
.sv-char-count{font-size:.7rem;color:var(--text-muted);text-align:right;margin-top:4px}
/* Rating stars */
.sv-stars{display:flex;gap:6px}
.sv-star{font-size:2rem;cursor:pointer;transition:transform .15s,filter .15s;color:#d1d5db}
.sv-star.active{color:#f59e0b;filter:drop-shadow(0 0 4px rgba(245,158,11,.5))}
.sv-star:hover{transform:scale(1.2)}
.sv-star-label{font-size:.8rem;color:var(--text-muted);margin-top:6px}
/* Scale slider */
.sv-scale{padding:4px 0}
.sv-scale-input{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;outline:none;cursor:pointer;background:linear-gradient(to right,${theme.from} 0%,${theme.from} var(--pct,50%),var(--border) var(--pct,50%),var(--border) 100%)}
.sv-scale-input::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:${theme.from};cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2);border:2px solid #fff}
.sv-scale-labels{display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted);margin-top:6px}
.sv-scale-val{text-align:center;font-size:1.1rem;font-weight:800;color:${theme.from};margin-top:8px}
/* Submit */
.sv-submit-wrap{margin-top:1.5rem;padding-bottom:2rem}
.sv-submit-btn{width:100%;padding:14px;border-radius:14px;border:none;font-size:1rem;font-weight:700;cursor:pointer;transition:all .2s;background:linear-gradient(135deg,${theme.from},${theme.to});color:#fff;box-shadow:0 4px 18px rgba(99,102,241,.35)}
.sv-submit-btn:hover{filter:brightness(1.1);transform:translateY(-1px);box-shadow:0 8px 24px rgba(99,102,241,.45)}
.sv-submit-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.sv-back-btn{display:flex;align-items:center;gap:6px;background:none;border:none;color:var(--text-muted);font-size:.85rem;cursor:pointer;padding:0;margin-bottom:1rem;transition:color .15s}
.sv-back-btn:hover{color:var(--text-primary)}
/* Success */
.sv-success{text-align:center;padding:3rem 2rem;animation:sv-in .4s ease}
.sv-success-icon{font-size:4rem;margin-bottom:1rem;animation:sv-pop .4s .1s ease both}
@keyframes sv-pop{from{transform:scale(0)}to{transform:scale(1)}}
</style>

<div class="sv-take-wrap">
    <button class="sv-back-btn" onclick="SurveysPage._backToList()"><i class="fa-solid fa-arrow-left"></i> Назад до списку</button>
    ${opts.preview ? `
    <div style="display:flex;align-items:center;gap:10px;background:rgba(245,158,11,.1);border:1.5px solid rgba(245,158,11,.4);border-radius:14px;padding:10px 16px;margin-bottom:1rem">
        <i class="fa-solid fa-eye" style="color:#f59e0b;font-size:1.1rem"></i>
        <div style="flex:1">
            <div style="font-weight:700;font-size:.88rem;color:#b45309">Режим перегляду</div>
            <div style="font-size:.78rem;color:#92400e">Відповіді не зберігаються. Так виглядатиме опитник для учасників.</div>
        </div>
    </div>` : ''}
    <div class="sv-take-header">
        <div class="sv-take-title">${Fmt.esc(survey.title)}</div>
        ${survey.description ? `<div class="sv-take-desc">${Fmt.esc(survey.description)}</div>` : ''}
    </div>
    <div id="sv-questions">
        ${questions.map((q, i) => this._questionHtml(q, i, theme)).join('')}
    </div>
    <div class="sv-submit-wrap">
        ${opts.preview
            ? `<button class="sv-submit-btn" style="background:linear-gradient(135deg,#f59e0b,#f97316)" onclick="SurveysPage._backToList()">
                <i class="fa-solid fa-xmark"></i> Закрити перегляд
               </button>`
            : `<button class="sv-submit-btn" id="sv-submit-btn" onclick="SurveysPage._submitResponse()">
                <i class="fa-solid fa-paper-plane"></i> Надіслати відповіді
               </button>`}
    </div>
</div>`;

    },

    _questionHtml(q, i, theme) {
        const reqMark  = q.is_required ? `<span class="sv-q-required">*</span>` : '';
        const followUp = (q.type === 'rating' || q.type === 'scale')
            && q.options && !Array.isArray(q.options) && q.options.follow_up
            ? q.options.follow_up : null;
        let body = '';

        if (q.type === 'single') {
            const opts = (q.options || []);
            body = `<div class="sv-options" id="sv-q-${q.id}">
                ${opts.map((o, oi) => `
                <div class="sv-option" data-qid="${q.id}" data-val="${oi}"
                    onclick="SurveysPage._selectOption(this,'single')">
                    <div class="sv-option-marker" id="sv-m-${q.id}-${oi}"></div>
                    <span class="sv-option-text">${Fmt.esc(o)}</span>
                </div>`).join('')}
            </div>`;
        } else if (q.type === 'multiple') {
            const opts = (q.options || []);
            body = `<div class="sv-options" id="sv-q-${q.id}">
                ${opts.map((o, oi) => `
                <div class="sv-option" data-qid="${q.id}" data-val="${oi}"
                    onclick="SurveysPage._selectOption(this,'multiple')">
                    <div class="sv-option-marker sv-option-marker-sq" id="sv-m-${q.id}-${oi}"></div>
                    <span class="sv-option-text">${Fmt.esc(o)}</span>
                </div>`).join('')}
            </div>`;
        } else if (q.type === 'text') {
            body = `
            <textarea class="sv-textarea" id="sv-q-${q.id}" maxlength="1000"
                placeholder="Введіть вашу відповідь…"
                oninput="SurveysPage._onTextInput(this,'${q.id}',${JSON.stringify(q)})"></textarea>
            <div class="sv-char-count" id="sv-cc-${q.id}">0 / 1000</div>`;
        } else if (q.type === 'rating') {
            const labels = ['','Погано','Незадовільно','Задовільно','Добре','Відмінно'];
            body = `
            <div class="sv-stars" id="sv-q-${q.id}" data-val="">
                ${[1,2,3,4,5].map(n => `
                <span class="sv-star" data-n="${n}" data-qid="${q.id}"
                    onclick="SurveysPage._rateStar(this)"
                    onmouseenter="SurveysPage._hoverStar(this)"
                    onmouseleave="SurveysPage._unhoverStar('${q.id}')">★</span>`).join('')}
            </div>
            <div class="sv-star-label" id="sv-star-lbl-${q.id}">Оберіть оцінку</div>`;
        } else if (q.type === 'scale') {
            body = `
            <div class="sv-scale">
                <input type="range" class="sv-scale-input" id="sv-q-${q.id}"
                    min="1" max="10" value="5"
                    oninput="SurveysPage._onScale(this,'${q.id}')">
                <div class="sv-scale-labels"><span>1</span><span>10</span></div>
                <div class="sv-scale-val" id="sv-scale-val-${q.id}">5</div>
            </div>`;
        }

        const followUpBlock = followUp ? `
<div class="sv-followup-wrap" id="sv-fu-${q.id}"
     data-op="${followUp.operator}" data-val="${followUp.value}"
     style="display:none;margin-top:14px;padding:14px 16px;background:color-mix(in srgb,${theme.from} 8%,var(--bg-raised));border:1.5px solid color-mix(in srgb,${theme.from} 30%,transparent);border-radius:14px">
    <div style="font-size:.82rem;font-weight:700;color:var(--text-secondary);margin-bottom:8px;display:flex;align-items:center;gap:6px">
        <i class="fa-solid fa-comment-dots" style="color:${theme.from}"></i>
        ${Fmt.esc(followUp.text || 'Розкажіть детальніше...')}
    </div>
    <textarea class="sv-textarea" id="sv-fu-ta-${q.id}" maxlength="500"
              placeholder="Введіть відповідь…"
              oninput="this.nextElementSibling.textContent=this.value.length+' / 500'"
              style="border-color:color-mix(in srgb,${theme.from} 35%,transparent)"></textarea>
    <div style="font-size:.7rem;color:var(--text-muted);text-align:right;margin-top:4px">0 / 500</div>
</div>` : '';

        return `
<div class="sv-q-card" id="sv-qcard-${q.id}" style="animation:sv-in .3s ease ${i*60}ms both">
    <div class="sv-q-num">Питання ${i+1}${q.is_required ? ' · обов\'язкове' : ''}</div>
    <div class="sv-q-text">${Fmt.esc(q.text)}${reqMark}</div>
    ${q.image_url ? `<div style="margin:10px 0 14px;border-radius:14px;overflow:hidden;max-height:320px;text-align:center;background:var(--bg-raised)"><img src="${Fmt.safeUrl(q.image_url)}" alt="" style="max-width:100%;max-height:320px;object-fit:contain;display:block;margin:0 auto"></div>` : ''}
    ${body}
    ${followUpBlock}
</div>`;
    },

    _selectOption(el, mode) {
        const qid = el.dataset.qid;
        const wrap = document.getElementById(`sv-q-${qid}`);
        if (mode === 'single') {
            wrap.querySelectorAll('.sv-option').forEach(o => {
                o.classList.remove('selected');
                o.querySelector('.sv-option-marker').innerHTML = '';
            });
            el.classList.add('selected');
            el.querySelector('.sv-option-marker').innerHTML = '<i class="fa-solid fa-check"></i>';
        } else {
            el.classList.toggle('selected');
            const m = el.querySelector('.sv-option-marker');
            m.innerHTML = el.classList.contains('selected') ? '<i class="fa-solid fa-check"></i>' : '';
        }

    },

    _onTextInput(ta, qid, q) {
        document.getElementById(`sv-cc-${qid}`).textContent = `${ta.value.length} / 1000`;

    },

    _rateStar(el) {
        const n   = +el.dataset.n;
        const qid = el.dataset.qid;
        const wrap = document.getElementById(`sv-q-${qid}`);
        wrap.dataset.val = n;
        wrap.querySelectorAll('.sv-star').forEach((s,i) => s.classList.toggle('active', i < n));
        const labels = ['','Погано','Незадовільно','Задовільно','Добре','Відмінно'];
        const lbl = document.getElementById(`sv-star-lbl-${qid}`);
        if (lbl) lbl.textContent = labels[n] || '';
        this._checkFollowUp(qid, n);
    },

    _hoverStar(el) {
        const n   = +el.dataset.n;
        const qid = el.dataset.qid;
        document.getElementById(`sv-q-${qid}`).querySelectorAll('.sv-star')
            .forEach((s, i) => s.style.color = i < n ? '#f59e0b' : '#d1d5db');
    },

    _unhoverStar(qid) {
        const wrap = document.getElementById(`sv-q-${qid}`);
        const cur  = +(wrap?.dataset.val || 0);
        wrap?.querySelectorAll('.sv-star')
            .forEach((s, i) => { s.style.color = ''; s.classList.toggle('active', i < cur); });
    },

    _onScale(input, qid) {
        const v = input.value;
        const pct = ((v - 1) / 9 * 100).toFixed(1) + '%';
        input.style.setProperty('--pct', pct);
        const lbl = document.getElementById(`sv-scale-val-${qid}`);
        if (lbl) lbl.textContent = v;
        this._checkFollowUp(qid, +v);
    },

    _checkFollowUp(qid, value) {
        const fu = document.getElementById(`sv-fu-${qid}`);
        if (!fu) return;
        const op        = fu.dataset.op;
        const threshold = +fu.dataset.val;
        const show = op === 'lte' ? value <= threshold
                   : op === 'gte' ? value >= threshold
                   : value === threshold;
        const wasHidden = fu.style.display === 'none';
        fu.style.display = show ? 'block' : 'none';
        if (!show) { const ta = document.getElementById(`sv-fu-ta-${qid}`); if (ta) ta.value = ''; }
        if (show && wasHidden) fu.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },


    async _submitResponse() {
        const { surveyId, questions, preview } = this._takeState || {};
        if (!surveyId || !questions) return;
        if (preview) { Toast.info('Режим перегляду', 'Відповіді не зберігаються'); return; }
        const btn = document.getElementById('sv-submit-btn');
        // validate required
        let hasError = false;
        const answers = [];

        questions.forEach(q => {
            const card = document.getElementById(`sv-qcard-${q.id}`);
            let answer = { question_id: q.id };
            let filled = false;

            if (q.type === 'single') {
                const sel = document.querySelector(`#sv-q-${q.id} .sv-option.selected`);
                if (sel) { answer.selected_options = [+sel.dataset.val]; filled = true; }
            } else if (q.type === 'multiple') {
                const sels = [...document.querySelectorAll(`#sv-q-${q.id} .sv-option.selected`)];
                if (sels.length) { answer.selected_options = sels.map(s => +s.dataset.val); filled = true; }
            } else if (q.type === 'text') {
                const v = document.getElementById(`sv-q-${q.id}`)?.value.trim();
                if (v) { answer.value = v; filled = true; }
            } else if (q.type === 'rating') {
                const v = document.getElementById(`sv-q-${q.id}`)?.dataset.val;
                if (v) { answer.value = v; filled = true; }
            } else if (q.type === 'scale') {
                answer.value = document.getElementById(`sv-q-${q.id}`)?.value || '5';
                filled = true;
            }

            // collect follow-up text if visible
            const fuWrap = document.getElementById(`sv-fu-${q.id}`);
            const fuTa   = document.getElementById(`sv-fu-ta-${q.id}`);
            if (fuWrap && fuTa && fuWrap.style.display !== 'none') {
                const fuText = fuTa.value.trim();
                if (fuText) answer.selected_options = { follow_up: fuText };
            }

            if (q.is_required && !filled) {
                hasError = true;
                if (card) {
                    card.classList.add('required-error');
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => card.classList.remove('required-error'), 600);
                }
            } else {
                answers.push(answer);
            }
        });

        if (hasError) { Toast.error('Заповніть усі обов\'язкові поля'); return; }
        if (btn) btn.disabled = true;
        Loader.show();
        try {
            await API.surveys.submitResponse(surveyId, answers);
            this._myDone.add(surveyId);
            this._showSuccess();
        } catch(e) { Toast.error('Помилка', e.message); if (btn) btn.disabled = false; }
        finally { Loader.hide(); }
    },

    _showSuccess() {
        const area = document.getElementById('ep-content');
        if (!area) return;
        area.innerHTML = `
<div class="sv-success">
    <div class="sv-success-icon">🎉</div>
    <h2 style="font-size:1.6rem;font-weight:800;margin-bottom:.5rem">Дякуємо!</h2>
    <p style="color:var(--text-muted);margin-bottom:2rem">Ваші відповіді успішно записано</p>
    <button class="sv-btn sv-btn-primary" style="display:inline-flex;padding:10px 28px;border-radius:12px;border:none;cursor:pointer;font-size:.9rem;font-weight:600;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff" onclick="SurveysPage._backToList()">
        <i class="fa-solid fa-arrow-left"></i>&nbsp; Назад до списку
    </button>
</div>`;
    },

    // ── Results ───────────────────────────────────────────────────
    async openResults(surveyId) {
        const area = document.getElementById('ep-content');
        if (!area) return;
        area.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        Loader.show();
        try {
            const [survey, questions, { responses, answers }] = await Promise.all([
                API.surveys.getById(surveyId),
                API.surveys.getQuestions(surveyId),
                API.surveys.getResults(surveyId)
            ]);
            this._renderResults(area, survey, questions, responses, answers);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _renderResults(area, survey, questions, responses, answers) {
        const theme   = this._theme(survey);
        const ansMap  = {};
        answers.forEach(a => {
            if (!ansMap[a.question_id]) ansMap[a.question_id] = [];
            ansMap[a.question_id].push(a);
        });
        // store for export / tab switching
        this._resData = { survey, questions, responses, answers, ansMap };

        const showParticipants = !survey.is_anonymous && responses.length > 0;

        area.innerHTML = `
<style>
.sv-res-wrap{max-width:820px;animation:sv-in .3s ease}
.sv-res-header{border-radius:20px;padding:20px 24px;margin-bottom:1.25rem;background:linear-gradient(135deg,${theme.from},${theme.to});display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.sv-res-stat{background:rgba(255,255,255,.18);border-radius:12px;padding:10px 16px;text-align:center;flex-shrink:0}
.sv-res-stat-n{font-size:1.5rem;font-weight:800;color:#fff}
.sv-res-stat-l{font-size:.62rem;color:rgba(255,255,255,.75);text-transform:uppercase;letter-spacing:.05em}
.sv-res-qcard{background:var(--bg-surface);border:1.5px solid var(--border);border-radius:16px;padding:18px 20px;margin-bottom:12px}
.sv-res-qtext{font-size:.95rem;font-weight:700;color:var(--text-primary);margin-bottom:14px}
.sv-bar-row{display:flex;align-items:center;gap:10px;margin-bottom:7px}
.sv-bar-label{font-size:.8rem;color:var(--text-secondary);min-width:110px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px}
.sv-bar-track{flex:1;height:24px;background:var(--bg-raised);border-radius:6px;overflow:hidden;position:relative}
.sv-bar-fill{height:100%;border-radius:6px;transition:width .6s ease;background:linear-gradient(135deg,${theme.from},${theme.to})}
.sv-bar-pct{position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:.72rem;font-weight:700;color:#fff;mix-blend-mode:difference}
.sv-bar-count{font-size:.75rem;color:var(--text-muted);min-width:28px;text-align:right}
.sv-text-answers{display:flex;flex-direction:column;gap:8px}
.sv-text-ans{background:var(--bg-raised);border-radius:10px;padding:10px 14px;font-size:.85rem;color:var(--text-primary);display:flex;align-items:flex-start;gap:10px}
.sv-text-ans-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,${theme.from},${theme.to});display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;color:#fff;flex-shrink:0}
.sv-rating-avg{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.sv-rating-avg-n{font-size:2rem;font-weight:800;color:${theme.from}}
.sv-rating-avg-stars{color:#f59e0b;font-size:1.1rem}
.sv-scale-avg{font-size:2rem;font-weight:800;color:${theme.from};margin-bottom:8px}
.sv-res-empty{color:var(--text-muted);font-size:.85rem;font-style:italic}
/* who-selected toggle */
.sv-who-toggle{font-size:.72rem;color:var(--primary);background:none;border:none;cursor:pointer;padding:2px 0;margin-top:4px;display:inline-flex;align-items:center;gap:4px;font-weight:600}
.sv-who-list{display:none;flex-wrap:wrap;gap:5px;margin-top:6px}
.sv-who-list.open{display:flex}
.sv-who-chip{font-size:.72rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:20px;padding:2px 10px;color:var(--text-secondary)}
/* tabs */
.sv-res-tabs{display:flex;gap:4px;background:var(--bg-raised);border-radius:40px;padding:3px;margin-bottom:1.25rem;width:fit-content}
.sv-res-tab{padding:7px 20px;border-radius:40px;border:none;background:transparent;font-size:.83rem;font-weight:500;cursor:pointer;color:var(--text-muted);transition:all .15s}
.sv-res-tab.active{background:var(--bg-surface);color:var(--primary);font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.12)}
/* participant table */
.sv-ptable-wrap{overflow-x:auto;border-radius:14px;border:1.5px solid var(--border)}
.sv-ptable{width:100%;border-collapse:collapse;font-size:.82rem}
.sv-ptable th{background:var(--bg-raised);padding:10px 14px;text-align:left;font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;position:sticky;top:0}
.sv-ptable td{padding:10px 14px;border-top:1px solid var(--border);vertical-align:top;max-width:220px}
.sv-ptable tr:hover td{background:var(--bg-hover)}
.sv-ptable td.sv-pt-user{white-space:nowrap;font-weight:600;color:var(--text-primary)}
.sv-ptable td.sv-pt-date{white-space:nowrap;color:var(--text-muted);font-size:.75rem}
.sv-ptable td.sv-pt-ans{color:var(--text-secondary)}
</style>

<div class="sv-res-wrap">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1rem;flex-wrap:wrap">
        <button class="sv-back-btn" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:var(--text-muted);font-size:.85rem;cursor:pointer;padding:0" onclick="SurveysPage._backToList()"><i class="fa-solid fa-arrow-left"></i> Назад</button>
        <div style="flex:1"></div>
        <button onclick="SurveysPage._exportHRReport()" style="display:inline-flex;align-items:center;gap:8px;padding:9px 20px;border-radius:12px;border:none;cursor:pointer;font-size:.85rem;font-weight:700;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 4px 14px rgba(22,163,74,.35);transition:all .2s" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px rgba(22,163,74,.45)'" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 14px rgba(22,163,74,.35)'">
            <i class="fa-solid fa-file-excel"></i> Звіт
        </button>
    </div>

    <div class="sv-res-header">
        <div style="flex:1;min-width:160px">
            <div style="font-size:1.15rem;font-weight:800;color:#fff;margin-bottom:.3rem">${Fmt.esc(survey.title)}</div>
            <div style="font-size:.78rem;color:rgba(255,255,255,.75)">${survey.is_anonymous ? '🔒 Анонімне' : '👤 Іменне'} · Результати</div>
        </div>
        <div class="sv-res-stat"><div class="sv-res-stat-n">${responses.length}</div><div class="sv-res-stat-l">Відповідей</div></div>
        <div class="sv-res-stat"><div class="sv-res-stat-n">${questions.length}</div><div class="sv-res-stat-l">Питань</div></div>
        ${responses.length ? `<div class="sv-res-stat"><div class="sv-res-stat-n">${Math.round(answers.length/Math.max(responses.length,1)/Math.max(questions.length,1)*100)}%</div><div class="sv-res-stat-l">Заповненість</div></div>` : ''}
    </div>

    ${showParticipants ? `
    <div class="sv-res-tabs">
        <button class="sv-res-tab active" id="sv-tab-agg" onclick="SurveysPage._switchResTab('agg')"><i class="fa-solid fa-chart-bar"></i> Зведений</button>
        <button class="sv-res-tab" id="sv-tab-part" onclick="SurveysPage._switchResTab('part')"><i class="fa-solid fa-users"></i> По учасниках</button>
    </div>` : ''}

    <div id="sv-res-agg">
        ${questions.map(q => this._resultQuestionHtml(q, ansMap[q.id] || [], responses, survey.is_anonymous)).join('')}
        ${!responses.length ? `<div style="text-align:center;padding:3rem;color:var(--text-muted)"><i class="fa-solid fa-inbox" style="font-size:2.5rem;opacity:.2;display:block;margin-bottom:.75rem"></i>Відповідей поки немає</div>` : ''}
    </div>
    <div id="sv-res-part" style="display:none"></div>
</div>`;

        setTimeout(() => {
            document.querySelectorAll('.sv-bar-fill').forEach(el => { el.style.width = el.dataset.w; });
        }, 100);
    },

    _switchResTab(tab) {
        document.getElementById('sv-tab-agg')?.classList.toggle('active', tab === 'agg');
        document.getElementById('sv-tab-part')?.classList.toggle('active', tab === 'part');
        document.getElementById('sv-res-agg').style.display  = tab === 'agg'  ? '' : 'none';
        const partEl = document.getElementById('sv-res-part');
        partEl.style.display = tab === 'part' ? '' : 'none';
        if (tab === 'part' && !partEl.innerHTML) {
            const { survey, questions, responses, answers } = this._resData;
            partEl.innerHTML = this._participantsTableHtml(questions, responses, answers);
        }
    },

    _participantsTableHtml(questions, responses, answers) {
        const byResp = {};
        answers.forEach(a => {
            if (!byResp[a.response_id]) byResp[a.response_id] = {};
            byResp[a.response_id][a.question_id] = a;
        });

        const typeLabel = { single:'○', multiple:'☑', text:'T', rating:'★', scale:'~' };

        const answerText = (q, a) => {
            if (!a) return '—';
            if (q.type === 'single' || q.type === 'multiple') {
                const opts = Array.isArray(q.options) ? q.options : [];
                const sel  = (a.selected_options || []);
                if (Array.isArray(sel)) return sel.map(i => opts[i] || `#${i}`).join(', ') || '—';
                return '—';
            }
            if (q.type === 'rating') return a.value ? '★'.repeat(+a.value) + `  (${a.value}/5)` : '—';
            if (q.type === 'scale')  return a.value ? `${a.value}/10` : '—';
            return a.value || '—';
        };

        const rows = responses.map(r => {
            const ans = byResp[r.id] || {};
            const name = r.user?.full_name || '?';
            const date = Fmt.datetime(r.submitted_at);
            const cells = questions.map(q => {
                const a   = ans[q.id];
                const txt = answerText(q, a);
                const fu  = a?.selected_options?.follow_up;
                return `<td class="sv-pt-ans">${Fmt.esc(txt)}${fu ? `<div style="font-size:.72rem;color:var(--text-muted);margin-top:3px">💬 ${Fmt.esc(fu)}</div>` : ''}</td>`;
            }).join('');
            return `<tr>
                <td class="sv-pt-user">${Fmt.esc(name)}</td>
                <td class="sv-pt-date">${date}</td>
                ${cells}
            </tr>`;
        }).join('');

        return `
<div class="sv-ptable-wrap">
    <table class="sv-ptable">
        <thead><tr>
            <th>Учасник</th>
            <th>Дата</th>
            ${questions.map((q,i) => `<th title="${Fmt.esc(q.text)}">${typeLabel[q.type]||''} ${i+1}. ${Fmt.esc(q.text.length > 28 ? q.text.slice(0,28)+'…' : q.text)}</th>`).join('')}
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="${questions.length+2}" style="text-align:center;padding:2rem;color:var(--text-muted)">Немає відповідей</td></tr>`}</tbody>
    </table>
</div>`;
    },

    _exportHRReport() {
        const { survey, questions, responses, answers } = this._resData || {};
        if (!survey) { Toast.error('Помилка', 'Дані не завантажені'); return; }
        if (typeof XLSX === 'undefined') { Toast.error('Помилка', 'XLSX бібліотека недоступна'); return; }

        const wb = XLSX.utils.book_new();
        const isAnon = survey.is_anonymous;

        // ── Sheet 1: Загальна інформація ────────────────────────────
        const infoRows = [
            ['Назва опитування', survey.title],
            ['Опис',             survey.description || '—'],
            ['Тип',              isAnon ? 'Анонімне' : 'Іменне'],
            ['Статус',           survey.is_published ? 'Опубліковане' : 'Чернетка'],
            ['Дедлайн',          survey.deadline_at ? Fmt.datetime(survey.deadline_at) : '—'],
            ['Кількість питань', questions.length],
            ['Кількість відповідей', responses.length],
            ['Звіт сформовано', new Date().toLocaleString('uk-UA')],
        ];
        const wsInfo = XLSX.utils.aoa_to_sheet(infoRows);
        wsInfo['!cols'] = [{ wch: 28 }, { wch: 50 }];
        XLSX.utils.book_append_sheet(wb, wsInfo, 'Загальна інформація');

        // ── Sheet 2: Аналіз по питаннях ────────────────────────────
        const byResp = {};
        answers.forEach(a => {
            if (!byResp[a.response_id]) byResp[a.response_id] = {};
            byResp[a.response_id][a.question_id] = a;
        });

        const analysisRows = [['#', 'Питання', 'Тип', 'Всього відповідей', 'Результат', 'Уточнення']];
        questions.forEach((q, i) => {
            const qAnswers = answers.filter(a => a.question_id === q.id);
            const typeNames = { single:'Одна відповідь', multiple:'Кілька відповідей', text:'Текст', rating:'Зірки (1–5)', scale:'Шкала (1–10)' };
            let result = '';
            if (q.type === 'single' || q.type === 'multiple') {
                const opts   = Array.isArray(q.options) ? q.options : [];
                const counts = new Array(opts.length).fill(0);
                qAnswers.forEach(a => (a.selected_options || []).forEach(idx => { if (idx < counts.length) counts[idx]++; }));
                result = opts.map((o, oi) => `${o}: ${counts[oi]} (${responses.length ? Math.round(counts[oi]/responses.length*100) : 0}%)`).join('\n');
            } else if (q.type === 'text') {
                result = qAnswers.map(a => a.value || '').filter(Boolean).join(' | ');
            } else if (q.type === 'rating') {
                const vals = qAnswers.map(a => +(a.value||0)).filter(v=>v>0);
                const avg  = vals.length ? (vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : '—';
                result = `Середнє: ${avg}/5\n` + [1,2,3,4,5].map(n=>`${n}★: ${vals.filter(v=>v===n).length}`).join(', ');
            } else if (q.type === 'scale') {
                const vals = qAnswers.map(a => +(a.value||0)).filter(v=>v>0);
                const avg  = vals.length ? (vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : '—';
                result = `Середнє: ${avg}/10\n` + Array.from({length:10},(_,i)=>`${i+1}: ${vals.filter(v=>v===i+1).length}`).join(', ');
            }
            const fuAnswers = qAnswers.filter(a=>a.selected_options?.follow_up).map(a=>a.selected_options.follow_up).join(' | ');
            analysisRows.push([i+1, q.text, typeNames[q.type]||q.type, qAnswers.length, result, fuAnswers||'—']);
        });
        const wsAnal = XLSX.utils.aoa_to_sheet(analysisRows);
        wsAnal['!cols'] = [{ wch: 4 }, { wch: 40 }, { wch: 18 }, { wch: 12 }, { wch: 50 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsAnal, 'Аналіз по питаннях');

        // ── Sheet 3: Відповіді учасників (тільки іменне) ───────────
        if (!isAnon && responses.length) {
            const answerText = (q, a) => {
                if (!a) return '';
                if (q.type === 'single' || q.type === 'multiple') {
                    const opts = Array.isArray(q.options) ? q.options : [];
                    const sel  = a.selected_options || [];
                    return Array.isArray(sel) ? sel.map(i => opts[i]||`#${i}`).join(', ') : '';
                }
                if (q.type === 'rating') return a.value ? `${a.value}/5` : '';
                if (q.type === 'scale')  return a.value ? `${a.value}/10` : '';
                return a.value || '';
            };

            const header = ['Учасник', 'Дата відповіді', ...questions.map((q,i) => `${i+1}. ${q.text}`)];
            const partRows = [header, ...responses.map(r => {
                const ans = byResp[r.id] || {};
                return [
                    r.user?.full_name || '?',
                    r.submitted_at ? new Date(r.submitted_at).toLocaleString('uk-UA') : '',
                    ...questions.map(q => answerText(q, ans[q.id])),
                ];
            })];
            const wsPart = XLSX.utils.aoa_to_sheet(partRows);
            wsPart['!cols'] = [{ wch: 28 }, { wch: 18 }, ...questions.map(() => ({ wch: 30 }))];
            XLSX.utils.book_append_sheet(wb, wsPart, 'Відповіді учасників');
        }

        XLSX.writeFile(wb, `survey_${Fmt.slug(survey.title)}_${new Date().toISOString().slice(0,10)}.xlsx`);
        Toast.success('Готово', 'Звіт завантажено');
    },

    _resultQuestionHtml(q, answers, responses, isAnon) {
        const total = responses.length;
        let body = '';

        if (q.type === 'single' || q.type === 'multiple') {
            const opts = Array.isArray(q.options) ? q.options : [];
            const counts = new Array(opts.length).fill(0);
            // who selected each option (for non-anon)
            const whoSelected = opts.map(() => []);
            answers.forEach(a => {
                const resp = responses.find(r => r.id === a.response_id);
                const name = !isAnon && resp?.user?.full_name ? resp.user.full_name : null;
                (Array.isArray(a.selected_options) ? a.selected_options : []).forEach(idx => {
                    if (idx < counts.length) {
                        counts[idx]++;
                        if (name) whoSelected[idx].push(name);
                    }
                });
            });
            body = opts.map((o, i) => {
                const n   = counts[i];
                const pct = total ? Math.round(n / total * 100) : 0;
                const who = whoSelected[i];
                const whoBlock = !isAnon && who.length ? `
                    <button class="sv-who-toggle" onclick="this.nextElementSibling.classList.toggle('open');this.innerHTML=this.nextElementSibling.classList.contains('open')?'<i class=\\'fa-solid fa-chevron-up\\'></i> Сховати':'<i class=\\'fa-solid fa-chevron-down\\'></i> Хто обрав (${who.length})'">
                        <i class="fa-solid fa-chevron-down"></i> Хто обрав (${who.length})
                    </button>
                    <div class="sv-who-list">${who.map(n => `<span class="sv-who-chip">${Fmt.esc(n)}</span>`).join('')}</div>` : '';
                return `
                <div class="sv-bar-row">
                    <div class="sv-bar-label" title="${Fmt.esc(o)}">${Fmt.esc(o)}</div>
                    <div class="sv-bar-track">
                        <div class="sv-bar-fill" data-w="${pct}%" style="width:0%"></div>
                        <div class="sv-bar-pct">${pct}%</div>
                    </div>
                    <div class="sv-bar-count">${n}</div>
                </div>
                ${whoBlock}`;
            }).join('');
        } else if (q.type === 'text') {
            if (!answers.length) {
                body = `<div class="sv-res-empty">Відповідей немає</div>`;
            } else {
                body = `<div class="sv-text-answers">${answers.map(a => {
                    const resp = responses.find(r => r.id === a.response_id);
                    const name = !isAnon && resp?.user?.full_name ? resp.user.full_name : null;
                    const initials = name ? Fmt.initials(name) : '?';
                    return `<div class="sv-text-ans">
                        <div class="sv-text-ans-avatar">${initials}</div>
                        <div>
                            ${name ? `<div style="font-size:.7rem;font-weight:600;color:var(--text-muted);margin-bottom:3px">${Fmt.esc(name)}</div>` : ''}
                            ${Fmt.esc(a.value || '')}
                        </div>
                    </div>`;
                }).join('')}</div>`;
            }
        } else if (q.type === 'rating') {
            const vals = answers.map(a => +(a.value || 0)).filter(v => v > 0);
            const avg  = vals.length ? (vals.reduce((s,v) => s+v, 0) / vals.length).toFixed(1) : '—';
            const filled = avg !== '—' ? Math.round(+avg) : 0;
            const dist   = [1,2,3,4,5].map(n => vals.filter(v => v === n).length);
            body = `
            <div class="sv-rating-avg">
                <div class="sv-rating-avg-n">${avg}</div>
                <div class="sv-rating-avg-stars">${'★'.repeat(filled)}${'☆'.repeat(5-filled)}</div>
                <div style="font-size:.78rem;color:var(--text-muted)">(${vals.length} оцінок)</div>
            </div>
            ${[1,2,3,4,5].map((n,i) => {
                const cnt = dist[i]; const pct = vals.length ? Math.round(cnt/vals.length*100) : 0;
                return `<div class="sv-bar-row">
                    <div class="sv-bar-label">${'★'.repeat(n)}</div>
                    <div class="sv-bar-track"><div class="sv-bar-fill" data-w="${pct}%" style="width:0%"></div><div class="sv-bar-pct">${pct}%</div></div>
                    <div class="sv-bar-count">${cnt}</div>
                </div>`;
            }).join('')}`;
        } else if (q.type === 'scale') {
            const vals = answers.map(a => +(a.value || 0)).filter(v => v > 0);
            const avg  = vals.length ? (vals.reduce((s,v) => s+v, 0) / vals.length).toFixed(1) : '—';
            const dist = Array.from({length:10}, (_,i) => vals.filter(v => v === i+1).length);
            body = `
            <div class="sv-scale-avg">${avg} / 10</div>
            ${dist.map((cnt, i) => {
                const pct = vals.length ? Math.round(cnt/vals.length*100) : 0;
                return `<div class="sv-bar-row">
                    <div class="sv-bar-label">${i+1}</div>
                    <div class="sv-bar-track"><div class="sv-bar-fill" data-w="${pct}%" style="width:0%"></div><div class="sv-bar-pct">${pct}%</div></div>
                    <div class="sv-bar-count">${cnt}</div>
                </div>`;
            }).join('')}`;
        }

        // follow-up texts (for rating/scale with conditional question)
        if (q.type === 'rating' || q.type === 'scale') {
            const fuAnswers = answers.filter(a => a.selected_options?.follow_up);
            if (fuAnswers.length) {
                const fuText = q.options?.follow_up?.text;
                body += `
                <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">
                    <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">
                        <i class="fa-solid fa-comment-dots"></i> ${fuText ? Fmt.esc(fuText) : 'Уточнюючі відповіді'} (${fuAnswers.length})
                    </div>
                    <div class="sv-text-answers">
                        ${fuAnswers.map(a => {
                            const resp = responses.find(r => r.id === a.response_id);
                            const name = !isAnon && resp?.user?.full_name ? resp.user.full_name : null;
                            return `<div class="sv-text-ans">
                                <div class="sv-text-ans-avatar">${name ? Fmt.initials(name) : '?'}</div>
                                <div>
                                    ${name ? `<div style="font-size:.7rem;font-weight:600;color:var(--text-muted);margin-bottom:3px">${Fmt.esc(name)}</div>` : ''}
                                    ${Fmt.esc(a.selected_options.follow_up)}
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
            }
        }

        return `
<div class="sv-res-qcard">
    <div class="sv-res-qtext">${Fmt.esc(q.text)}</div>
    ${body}
</div>`;
    },

    // ── Builder ───────────────────────────────────────────────────
    async openBuilder(surveyId) {
        const area = document.getElementById('ep-content');
        if (!area) return;
        Loader.show();
        try {
            let survey = null, questions = [];
            if (surveyId) {
                [survey, questions] = await Promise.all([
                    API.surveys.getById(surveyId),
                    API.surveys.getQuestions(surveyId)
                ]);
            }
            this._renderBuilder(area, survey, questions);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _renderBuilder(area, survey, questions) {
        this._builderSurveyId = survey?.id || null;
        this._builderQuestions = questions.map(q => {
            const isCondType = q.type === 'rating' || q.type === 'scale';
            const rawOpts    = q.options || [];
            const follow_up  = isCondType && rawOpts && !Array.isArray(rawOpts) ? (rawOpts.follow_up || null) : null;
            return { ...q, _id: q.id || Math.random().toString(36).slice(2), follow_up, options: Array.isArray(rawOpts) ? rawOpts : [] };
        });
        area.innerHTML = `
<style>
.sv-builder{max-width:780px;animation:sv-in .3s ease}
.sv-bld-header{display:flex;align-items:center;gap:12px;margin-bottom:1.5rem;flex-wrap:wrap}
.sv-bld-meta-card{background:var(--bg-surface);border:1.5px solid var(--border);border-radius:20px;padding:22px 24px;margin-bottom:1rem;display:flex;flex-direction:column;gap:14px;box-shadow:0 2px 12px rgba(0,0,0,.05)}
.sv-bld-label{display:block;font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.sv-bld-input{width:100%;padding:10px 14px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:12px;font-size:.9rem;color:var(--text-primary);font-family:inherit;outline:none;transition:border-color .15s;box-sizing:border-box}
.sv-bld-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-glow)}
.sv-bld-row{display:flex;gap:12px;flex-wrap:wrap}
.sv-bld-toggles{display:flex;gap:16px;flex-wrap:wrap}
.sv-bld-toggle{display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer;padding:8px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-raised);transition:all .15s;user-select:none}
.sv-bld-toggle:has(input:checked){border-color:var(--primary);background:var(--primary-glow);color:var(--primary);font-weight:600}
/* Question cards */
.sv-bld-qs{display:flex;flex-direction:column;gap:12px;margin-bottom:1rem}
.sv-bld-qcard{background:var(--bg-surface);border:1.5px solid var(--border);border-radius:18px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.04);transition:border-color .2s,box-shadow .2s}
.sv-bld-qcard:hover{border-color:var(--primary);box-shadow:0 4px 20px rgba(99,102,241,.1)}
.sv-bld-qcard-stripe{height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6)}
.sv-bld-qcard-body{padding:16px 18px}
.sv-bld-qcard-head{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.sv-bld-drag{color:var(--text-muted);cursor:grab;font-size:1rem;padding:2px 4px;opacity:.5;transition:opacity .15s}
.sv-bld-drag:hover{opacity:1}
.sv-bld-qnum{font-size:.7rem;font-weight:700;color:var(--text-muted);background:var(--bg-raised);padding:2px 8px;border-radius:20px;white-space:nowrap}
.sv-bld-q-typebar{display:flex;gap:4px;flex-wrap:wrap;margin-left:auto}
.sv-bld-q-type-btn{padding:3px 9px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-raised);font-size:.68rem;color:var(--text-muted);cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:3px;white-space:nowrap}
.sv-bld-q-type-btn:hover{border-color:var(--primary);color:var(--primary)}
.sv-bld-q-type-btn.active{border-color:var(--primary);background:var(--primary);color:#fff}
.sv-bld-del{width:28px;height:28px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.8rem;transition:all .15s;flex-shrink:0}
.sv-bld-del:hover{background:rgba(239,68,68,.1);border-color:var(--danger);color:var(--danger)}
.sv-bld-q-input{width:100%;padding:9px 13px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:11px;font-size:.9rem;font-weight:500;color:var(--text-primary);font-family:inherit;outline:none;transition:border-color .15s;box-sizing:border-box}
.sv-bld-q-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-glow)}
/* Image upload area */
.sv-bld-img-wrap{margin-top:10px}
.sv-bld-img-drop{border:2px dashed var(--border);border-radius:12px;padding:14px;text-align:center;cursor:pointer;transition:all .2s;color:var(--text-muted);font-size:.8rem;position:relative}
.sv-bld-img-drop:hover{border-color:var(--primary);color:var(--primary);background:var(--primary-glow)}
.sv-bld-img-drop input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.sv-bld-img-preview{position:relative;margin-top:8px;border-radius:12px;overflow:hidden;display:inline-block;max-width:100%}
.sv-bld-img-preview img{max-height:200px;max-width:100%;border-radius:12px;display:block}
.sv-bld-img-rm{position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.7rem}
/* Options */
.sv-bld-opts{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.sv-bld-opt{display:flex;align-items:center;gap:8px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:10px;padding:6px 10px;transition:border-color .15s}
.sv-bld-opt:focus-within{border-color:var(--primary)}
.sv-bld-opt-icon{color:var(--text-muted);font-size:.75rem;flex-shrink:0;width:14px;text-align:center}
.sv-bld-opt-input{flex:1;border:none;background:transparent;font-size:.85rem;color:var(--text-primary);font-family:inherit;outline:none}
.sv-bld-opt-del{width:22px;height:22px;border-radius:6px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.7rem;flex-shrink:0;transition:color .15s}
.sv-bld-opt-del:hover{color:var(--danger)}
.sv-add-opt{font-size:.78rem;color:var(--primary);background:none;border:none;cursor:pointer;padding:6px 0 0 2px;display:flex;align-items:center;gap:5px;font-weight:500}
.sv-bld-req-toggle{display:flex;align-items:center;gap:6px;font-size:.75rem;cursor:pointer;color:var(--text-muted);margin-top:12px;padding-top:10px;border-top:1px solid var(--border)}
.sv-bld-req-toggle input{accent-color:var(--primary)}
/* type hints */
.sv-bld-type-hint{margin-top:10px;padding:10px 14px;background:var(--bg-raised);border-radius:10px;font-size:.8rem;color:var(--text-muted);display:flex;align-items:center;gap:8px}
/* add button */
.sv-add-q-single-btn{width:100%;padding:14px;border-radius:14px;border:2px dashed var(--border);background:transparent;color:var(--text-muted);font-size:.875rem;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:1.5rem}
.sv-add-q-single-btn:hover{border-color:var(--primary);color:var(--primary);background:var(--primary-glow)}
.sv-bld-actions{display:flex;gap:10px;flex-wrap:wrap}
</style>

<div class="sv-builder">
    <div class="sv-bld-header">
        <button class="sv-back-btn" style="display:flex;align-items:center;gap:6px;background:none;border:none;color:var(--text-muted);font-size:.85rem;cursor:pointer;padding:0" onclick="SurveysPage._backToList()"><i class="fa-solid fa-arrow-left"></i></button>
        <h2 style="margin:0;font-size:1.15rem;font-weight:800">${survey ? 'Редагувати' : 'Нове'} опитування</h2>
    </div>

    <div class="sv-bld-meta-card">
        <div>
            <span class="sv-bld-label">Назва *</span>
            <input class="sv-bld-input" id="sb-title" value="${Fmt.esc(survey?.title || '')}" placeholder="Введіть назву опитування">
        </div>
        <div>
            <span class="sv-bld-label">Опис</span>
            <textarea class="sv-bld-input" id="sb-desc" rows="2" placeholder="Коротко про що це опитування" style="resize:vertical">${Fmt.esc(survey?.description || '')}</textarea>
        </div>
        <div class="sv-bld-row" style="align-items:flex-end">
            <div style="flex:1;min-width:180px">
                <span class="sv-bld-label">Дедлайн</span>
                <input type="datetime-local" class="sv-bld-input" id="sb-deadline" value="${survey?.deadline_at ? new Date(survey.deadline_at).toISOString().slice(0,16) : ''}">
            </div>
            <div class="sv-bld-toggles">
                <label class="sv-bld-toggle">
                    <input type="checkbox" id="sb-anon" ${survey?.is_anonymous ? 'checked' : ''}>
                    <i class="fa-solid fa-user-secret"></i> Анонімне
                </label>
                <label class="sv-bld-toggle">
                    <input type="checkbox" id="sb-pub" ${survey?.is_published ? 'checked' : ''}>
                    <i class="fa-solid fa-globe"></i> Опублікувати
                </label>
            </div>
        </div>
    </div>

    <div id="sv-bld-qs" class="sv-bld-qs">${this._builderQuestionsHtml()}</div>

    <button class="sv-add-q-single-btn" onclick="SurveysPage._addQuestion('single')">
        <i class="fa-solid fa-plus"></i> Додати питання
    </button>

    <div class="sv-bld-actions">
        <button class="sv-btn sv-btn-ghost" style="padding:10px 20px;border-radius:12px;cursor:pointer;font-size:.875rem;font-weight:600" onclick="SurveysPage._backToList()">Скасувати</button>
        <button class="sv-btn sv-btn-primary" style="flex:1;padding:10px 20px;border-radius:12px;cursor:pointer;font-size:.875rem;font-weight:600;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff"
            onclick="SurveysPage._saveSurvey()">
            <i class="fa-regular fa-floppy-disk"></i> Зберегти
        </button>
    </div>
</div>`;
    },

    _builderQuestions: [],

    _builderQuestionsHtml() {
        return this._builderQuestions.map((q, i) => this._builderQCard(q, i)).join('');
    },

    _builderQCard(q, i) {
        const typeLabels = {
            single:   { icon: 'fa-regular fa-circle-dot',   label: 'Одна відповідь' },
            multiple: { icon: 'fa-regular fa-square-check', label: 'Кілька' },
            text:     { icon: 'fa-solid fa-align-left',     label: 'Текст' },
            rating:   { icon: 'fa-solid fa-star',           label: 'Зірки' },
            scale:    { icon: 'fa-solid fa-sliders',        label: 'Шкала' },
        };
        const hasOpts  = q.type === 'single' || q.type === 'multiple';
        const optIcon  = q.type === 'single' ? 'fa-regular fa-circle' : 'fa-regular fa-square';
        const opts     = q.options || [];
        const typeBtns = Object.entries(typeLabels).map(([v, {icon, label}]) =>
            `<button class="sv-bld-q-type-btn ${q.type===v?'active':''}" onclick="SurveysPage._changeQType('${q._id}','${v}')"><i class="${icon}"></i> ${label}</button>`
        ).join('');

        const imgSection = q.image_url
            ? `<div class="sv-bld-img-preview">
                <img src="${Fmt.safeUrl(q.image_url)}" alt="">
                <button class="sv-bld-img-rm" onclick="SurveysPage._removeQImage('${q._id}')" title="Видалити зображення"><i class="fa-solid fa-xmark"></i></button>
               </div>`
            : `<div class="sv-bld-img-drop" title="Додати зображення до питання">
                <input type="file" accept="image/*" onchange="SurveysPage._uploadQImage('${q._id}',this)">
                <i class="fa-solid fa-image"></i> Додати зображення
               </div>`;

        return `
<div class="sv-bld-qcard" id="sv-bq-${q._id}" draggable="true"
    ondragstart="SurveysPage._dragStart(event,'${q._id}')"
    ondragover="event.preventDefault()"
    ondrop="SurveysPage._dragDrop(event,'${q._id}')">
    <div class="sv-bld-qcard-stripe"></div>
    <div class="sv-bld-qcard-body">
        <div class="sv-bld-qcard-head">
            <span class="sv-bld-drag" title="Перетягнути"><i class="fa-solid fa-grip-vertical"></i></span>
            <span class="sv-bld-qnum">${i+1}</span>
            <div class="sv-bld-q-typebar">${typeBtns}</div>
            <button class="sv-bld-del" onclick="SurveysPage._removeQuestion('${q._id}')" title="Видалити питання"><i class="fa-solid fa-trash"></i></button>
        </div>
        <input class="sv-bld-q-input" id="sv-bq-text-${q._id}" value="${Fmt.esc(q.text||'')}"
            placeholder="Введіть текст питання…"
            oninput="SurveysPage._updateQText('${q._id}',this.value)">
        <div class="sv-bld-img-wrap">${imgSection}</div>
        ${hasOpts ? `
        <div class="sv-bld-opts" id="sv-bq-opts-${q._id}">
            ${opts.map((o, oi) => this._optHtml(q._id, oi, o, optIcon)).join('')}
        </div>
        <button class="sv-add-opt" onclick="SurveysPage._addOption('${q._id}')"><i class="fa-solid fa-plus"></i> Додати варіант</button>` : ''}
        ${q.type === 'rating' ? `<div class="sv-bld-type-hint"><i class="fa-solid fa-star" style="color:#f59e0b"></i> Шкала оцінок від 1 до 5 зірок</div>` : ''}
        ${q.type === 'scale'  ? `<div class="sv-bld-type-hint"><i class="fa-solid fa-sliders" style="color:var(--primary)"></i> Числова шкала від 1 до 10</div>` : ''}
        ${q.type === 'text'   ? `<div class="sv-bld-type-hint"><i class="fa-solid fa-align-left"></i> Вільна текстова відповідь</div>` : ''}
        ${(q.type === 'rating' || q.type === 'scale') ? `
        <div style="margin-top:10px;padding:12px 14px;background:var(--bg-raised);border-radius:12px;border:1.5px solid var(--border)">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.82rem;font-weight:600;color:var(--text-secondary);user-select:none">
                <input type="checkbox" id="sv-bq-fu-en-${q._id}" ${q.follow_up ? 'checked' : ''}
                    onchange="SurveysPage._toggleFollowUp('${q._id}',this.checked)"
                    style="accent-color:var(--primary);width:15px;height:15px">
                <i class="fa-solid fa-code-branch" style="color:var(--primary);font-size:.85rem"></i>
                Показати уточнюючe питання якщо оцінка…
            </label>
            <div id="sv-bq-fu-${q._id}" style="display:${q.follow_up ? 'flex' : 'none'};flex-direction:column;gap:8px;margin-top:10px">
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <select id="sv-bq-fu-op-${q._id}" class="sv-bld-input" style="width:auto;padding:7px 10px;flex-shrink:0"
                        onchange="SurveysPage._updateFollowUp('${q._id}')">
                        <option value="lte" ${q.follow_up?.operator==='lte'?'selected':''}>≤ менше або рівно</option>
                        <option value="gte" ${q.follow_up?.operator==='gte'?'selected':''}>≥ більше або рівно</option>
                        <option value="eq"  ${q.follow_up?.operator==='eq' ?'selected':''}>= рівно</option>
                    </select>
                    <input type="number" id="sv-bq-fu-val-${q._id}" class="sv-bld-input" style="width:72px;padding:7px 10px"
                        min="1" max="${q.type==='rating'?5:10}"
                        value="${q.follow_up?.value ?? (q.type==='rating'?3:5)}"
                        oninput="SurveysPage._updateFollowUp('${q._id}')">
                    <span style="font-size:.75rem;color:var(--text-muted)">${q.type==='rating'?'з 5':'з 10'}</span>
                </div>
                <input class="sv-bld-q-input" id="sv-bq-fu-txt-${q._id}"
                    placeholder="Текст уточнюючого питання…"
                    value="${Fmt.esc(q.follow_up?.text||'')}"
                    oninput="SurveysPage._updateFollowUp('${q._id}')">
            </div>
        </div>` : ''}
        <label class="sv-bld-req-toggle">
            <input type="checkbox" id="sv-bq-req-${q._id}" ${q.is_required!==false?'checked':''}
                onchange="SurveysPage._toggleRequired('${q._id}',this.checked)">
            Обов'язкове питання
        </label>
    </div>
</div>`;
    },

    _optHtml(qid, oi, val, icon = 'fa-regular fa-circle') {
        return `<div class="sv-bld-opt" id="sv-bqo-${qid}-${oi}">
            <i class="${icon} sv-bld-opt-icon"></i>
            <input class="sv-bld-opt-input" value="${Fmt.esc(val)}" placeholder="Варіант ${oi+1}"
                oninput="SurveysPage._updateOption('${qid}',${oi},this.value)">
            <button class="sv-bld-opt-del" onclick="SurveysPage._removeOption('${qid}',${oi})" title="Видалити варіант"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
    },

    async _uploadQImage(qid, input) {
        const file = input.files?.[0];
        if (!file) return;
        const q = this._builderQuestions.find(q => q._id === qid);
        if (!q) return;
        const wrap = input.closest('.sv-bld-img-wrap');
        if (wrap) wrap.innerHTML = `<div style="padding:10px;text-align:center;font-size:.8rem;color:var(--text-muted)"><div class="spinner" style="margin:0 auto 6px"></div> Завантаження…</div>`;
        try {
            const ext  = file.name.split('.').pop().toLowerCase();
            const path = `surveys/${qid}/${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from(APP_CONFIG.buckets.testImages).upload(path, file, { upsert: true });
            if (error) throw error;
            const url = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.testImages}/${path}`;
            q.image_url = url;
            // re-render just the img section
            if (wrap) wrap.innerHTML = `<div class="sv-bld-img-preview">
                <img src="${url}" alt="">
                <button class="sv-bld-img-rm" onclick="SurveysPage._removeQImage('${qid}')" title="Видалити зображення"><i class="fa-solid fa-xmark"></i></button>
            </div>`;
        } catch(e) {
            Toast.error('Помилка завантаження', e.message);
            if (wrap) wrap.innerHTML = `<div class="sv-bld-img-drop" title="Додати зображення до питання">
                <input type="file" accept="image/*" onchange="SurveysPage._uploadQImage('${qid}',this)">
                <i class="fa-solid fa-image"></i> Додати зображення
            </div>`;
        }
    },

    _removeQImage(qid) {
        const q = this._builderQuestions.find(q => q._id === qid);
        if (!q) return;
        q.image_url = null;
        const wrap = document.querySelector(`#sv-bq-${qid} .sv-bld-img-wrap`);
        if (wrap) wrap.innerHTML = `<div class="sv-bld-img-drop" title="Додати зображення до питання">
            <input type="file" accept="image/*" onchange="SurveysPage._uploadQImage('${qid}',this)">
            <i class="fa-solid fa-image"></i> Додати зображення
        </div>`;
    },

    _addQuestion(type) {
        const q = { _id: Math.random().toString(36).slice(2), type, text: '', options: type==='single'||type==='multiple'?['','']:[],is_required: true };
        this._builderQuestions.push(q);
        const container = document.getElementById('sv-bld-qs');
        if (container) {
            const div = document.createElement('div');
            div.innerHTML = this._builderQCard(q, this._builderQuestions.length - 1);
            container.appendChild(div.firstElementChild);
        }
    },

    _removeQuestion(id) {
        this._builderQuestions = this._builderQuestions.filter(q => q._id !== id);
        document.getElementById(`sv-bq-${id}`)?.remove();
    },

    _changeQType(id, type) {
        const q = this._builderQuestions.find(q => q._id === id);
        if (!q) return;
        q.type = type;
        if (type === 'single' || type === 'multiple') q.options = q.options?.length ? q.options : ['',''];
        const card = document.getElementById(`sv-bq-${id}`);
        if (card) {
            const i = this._builderQuestions.findIndex(q => q._id === id);
            card.outerHTML = this._builderQCard(q, i);
        }
    },

    _updateQText(id, val) {
        const q = this._builderQuestions.find(q => q._id === id);
        if (q) q.text = val;
    },

    _toggleRequired(id, val) {
        const q = this._builderQuestions.find(q => q._id === id);
        if (q) q.is_required = val;
    },

    _toggleFollowUp(id, enabled) {
        const q = this._builderQuestions.find(q => q._id === id);
        if (!q) return;
        q.follow_up = enabled ? { operator: 'lte', value: q.type === 'rating' ? 3 : 5, text: '' } : null;
        const wrap = document.getElementById(`sv-bq-fu-${id}`);
        if (wrap) wrap.style.display = enabled ? 'flex' : 'none';
    },

    _updateFollowUp(id) {
        const q = this._builderQuestions.find(q => q._id === id);
        if (!q) return;
        const enabled = document.getElementById(`sv-bq-fu-en-${id}`)?.checked;
        if (!enabled) { q.follow_up = null; return; }
        q.follow_up = {
            operator: document.getElementById(`sv-bq-fu-op-${id}`)?.value  || 'lte',
            value:    +(document.getElementById(`sv-bq-fu-val-${id}`)?.value || (q.type === 'rating' ? 3 : 5)),
            text:     document.getElementById(`sv-bq-fu-txt-${id}`)?.value  || '',
        };
    },

    _addOption(qid) {
        const q = this._builderQuestions.find(q => q._id === qid);
        if (!q) return;
        q.options = q.options || [];
        const oi = q.options.length;
        q.options.push('');
        const container = document.getElementById(`sv-bq-opts-${qid}`);
        if (container) {
            const div = document.createElement('div');
            const icon = q.type === 'multiple' ? 'fa-regular fa-square' : 'fa-regular fa-circle';
            div.innerHTML = this._optHtml(qid, oi, '', icon);
            container.appendChild(div.firstElementChild);
        }
    },

    _removeOption(qid, oi) {
        const q = this._builderQuestions.find(q => q._id === qid);
        if (!q) return;
        q.options.splice(oi, 1);
        document.getElementById(`sv-bqo-${qid}-${oi}`)?.remove();
        // re-number
        const container = document.getElementById(`sv-bq-opts-${qid}`);
        if (container) container.querySelectorAll('.sv-bld-opt-input').forEach((inp, i) => {
            inp.placeholder = `Варіант ${i+1}`;
        });
    },

    _updateOption(qid, oi, val) {
        const q = this._builderQuestions.find(q => q._id === qid);
        if (q && q.options) q.options[oi] = val;
    },

    // drag-drop reorder
    _dragSrcId: null,
    _dragStart(e, id) { this._dragSrcId = id; e.dataTransfer.effectAllowed = 'move'; },
    _dragDrop(e, targetId) {
        if (this._dragSrcId === targetId) return;
        const srcIdx  = this._builderQuestions.findIndex(q => q._id === this._dragSrcId);
        const tgtIdx  = this._builderQuestions.findIndex(q => q._id === targetId);
        if (srcIdx < 0 || tgtIdx < 0) return;
        const [item] = this._builderQuestions.splice(srcIdx, 1);
        this._builderQuestions.splice(tgtIdx, 0, item);
        // re-render list
        const container = document.getElementById('sv-bld-qs');
        if (container) container.innerHTML = this._builderQuestionsHtml();
    },

    async _saveSurvey() {
        const id = this._builderSurveyId;
        const title = document.getElementById('sb-title')?.value.trim();
        if (!title) { Toast.error('Помилка', 'Введіть назву'); return; }

        // sync text + follow_up from DOM before saving
        this._builderQuestions.forEach(q => {
            const inp = document.getElementById(`sv-bq-text-${q._id}`);
            if (inp) q.text = inp.value;
            if (q.type === 'rating' || q.type === 'scale') this._updateFollowUp(q._id);
        });

        const fields = {
            title,
            description:  document.getElementById('sb-desc')?.value.trim() || null,
            deadline_at:  document.getElementById('sb-deadline')?.value || null,
            is_anonymous: document.getElementById('sb-anon')?.checked || false,
            is_published: document.getElementById('sb-pub')?.checked || false,
        };

        Loader.show();
        try {
            const survey = id
                ? await API.surveys.update(id, fields)
                : await API.surveys.create(fields);

            const qs = this._builderQuestions.map(q => {
                const isCondType = q.type === 'rating' || q.type === 'scale';
                return {
                    text:        q.text,
                    type:        q.type,
                    options:     isCondType && q.follow_up ? { follow_up: q.follow_up } : (q.options || []),
                    is_required: q.is_required !== false,
                    image_url:   q.image_url || null,
                };
            }).filter(q => q.text.trim());

            await API.surveys.saveQuestions(survey.id, qs);
            Toast.success('Збережено!');
            await this.renderInTab(document.getElementById('ep-content'));
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _deleteSurvey(id, title) {
        const ok = await Modal.confirm({ title: 'Видалити опитування', message: `Видалити «${title}»?`, confirmText: 'Видалити', danger: true });
        if (!ok) return;
        Loader.show();
        try {
            await API.surveys.delete(id);
            this._surveys = this._surveys.filter(s => s.id !== id);
            Toast.success('Видалено');
            const grid = document.getElementById('sv-grid');
            if (grid) grid.innerHTML = this._cardsHtml();
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Assign ────────────────────────────────────────────────────
    async openAssign(surveyId) {
        const area = document.getElementById('ep-content');
        if (!area) return;
        area.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        Loader.show();
        try {
            const [allEmployees, assigned, survey] = await Promise.all([
                supabase.from('profiles')
                    .select('id,full_name,email,job_position,manager_id,is_active')
                    .order('full_name').then(r => r.data || []),
                API.surveys.getAssignments(surveyId),
                API.surveys.getById(surveyId)
            ]);
            this._renderAssign(area, survey, allEmployees, assigned);
        } catch(e) { Toast.error('Помилка', e.message); this._backToList(); }
        finally { Loader.hide(); }
    },

    _renderAssign(area, survey, allEmployees, assigned) {
        this._builderSurveyId = survey.id;
        const assignedMap = new Map(assigned.map(a => [a.user_id, a]));
        const deadlines   = assigned.map(a => a.deadline_at).filter(Boolean);
        const commonDl    = deadlines.length && deadlines.every(d => d === deadlines[0])
            ? new Date(deadlines[0]).toISOString().slice(0, 16) : '';

        let employees = allEmployees.filter(e => e.is_active !== false);
        if (!AppState.isAdmin()) {
            employees = employees.filter(e => e.manager_id === AppState.user.id);
        }

        const positions     = [...new Set(employees.map(e => e.job_position).filter(Boolean))].sort();
        const mgrIds        = [...new Set(employees.map(e => e.manager_id).filter(Boolean))];
        const managers      = mgrIds.map(mid => allEmployees.find(e => e.id === mid)).filter(Boolean);
        const showMgrFilter = AppState.isAdmin() && managers.length > 0;
        const filterCols    = 1 + (positions.length ? 1 : 0) + (showMgrFilter ? 1 : 0);

        area.innerHTML = `<style>
.sv-asgn-page{max-width:860px;display:flex;flex-direction:column;height:calc(100vh - 120px)}
.sv-asgn-topbar{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:16px;flex-shrink:0}
.sv-asgn-back{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.83rem;font-weight:500;cursor:pointer;transition:all .15s}
.sv-asgn-back:hover{border-color:var(--primary);color:var(--primary)}
.sv-asgn-controls{flex-shrink:0}
.sv-asgn-list{flex:1;overflow-y:auto;border:1px solid var(--border);border-radius:12px;min-height:0}
.sv-asgn-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s}
.sv-asgn-item:last-child{border-bottom:none}
.sv-asgn-item:hover{background:var(--bg-raised)}
</style>
<div class="sv-asgn-page">
    <div class="sv-asgn-topbar">
        <button class="sv-asgn-back" onclick="SurveysPage._backToList()"><i class="fa-solid fa-arrow-left"></i> Назад</button>
        <span style="font-size:1.05rem;font-weight:700;color:var(--text-primary);flex:1"><i class="fa-solid fa-users"></i> ${Fmt.esc(survey.title)}</span>
        <button class="btn btn-primary" onclick="SurveysPage._doAssign('${survey.id}')"><i class="fa-regular fa-floppy-disk"></i> Зберегти</button>
    </div>
    <div class="sv-asgn-controls">
        <div style="display:grid;grid-template-columns:repeat(${filterCols},1fr);gap:8px;margin-bottom:10px">
            <input id="sv-asgn-search" type="text" placeholder="Пошук за іменем…"
                style="padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.85rem;outline:none"
                oninput="SurveysPage._applyAssignFilters()">
            ${positions.length ? `
            <select id="sv-asgn-pos" onchange="SurveysPage._applyAssignFilters()"
                style="padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.85rem;outline:none">
                <option value="">Всі посади</option>
                ${positions.map(p => `<option value="${p.toLowerCase()}">${Fmt.esc(p)}</option>`).join('')}
            </select>` : ''}
            ${showMgrFilter ? `
            <select id="sv-asgn-mgr" onchange="SurveysPage._applyAssignFilters()"
                style="padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.85rem;outline:none">
                <option value="">Всі керівники</option>
                ${managers.map(m => `<option value="${m.id}">${Fmt.esc(m.full_name||m.email)}</option>`).join('')}
            </select>` : ''}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:6px">
                <button type="button" class="btn btn-ghost btn-sm" onclick="SurveysPage._selectAllFiltered(true)"><i class="fa-solid fa-square-check"></i> Вибрати всіх</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="SurveysPage._selectAllFiltered(false)"><i class="fa-regular fa-square"></i> Скинути</button>
                <span id="sv-asgn-count" style="font-size:.78rem;color:var(--text-muted);padding-left:4px"></span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
                <label style="font-size:.82rem;color:var(--text-muted);white-space:nowrap">Дедлайн:</label>
                <input type="datetime-local" id="sv-asgn-deadline" value="${commonDl}"
                    style="padding:5px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.82rem;outline:none"
                    onchange="this.dataset.changed='true'">
            </div>
        </div>
    </div>
    <div class="sv-asgn-list">
        ${employees.map(e => {
            const a = assignedMap.get(e.id);
            const dlTxt = a?.deadline_at ? `до ${Fmt.dateShort(a.deadline_at)}` : '';
            const respondedBadge = this._myDone.has && false ? '' : ''; // placeholder — responses checked separately
            return `<label class="sv-asgn-item"
                data-name="${Fmt.esc((e.full_name||e.email||'').toLowerCase())}"
                data-pos="${Fmt.esc((e.job_position||'').toLowerCase())}"
                data-mgr="${e.manager_id||''}">
                <input type="checkbox" value="${e.id}" ${a?'checked':''} data-was-assigned="${!!a}"
                    style="width:16px;height:16px;cursor:pointer;flex-shrink:0"
                    onchange="SurveysPage._updateAssignCount()">
                <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:.88rem">${Fmt.esc(e.full_name||e.email)}</div>
                    ${e.job_position?`<div style="font-size:.75rem;color:var(--text-muted)">${Fmt.esc(e.job_position)}</div>`:''}
                </div>
                ${a ? `<span style="font-size:.7rem;font-weight:600;padding:2px 8px;border-radius:20px;background:rgba(99,102,241,.12);color:var(--primary);white-space:nowrap"><i class="fa-solid fa-check"></i> Призначено${dlTxt?' · '+dlTxt:''}</span>` : ''}
            </label>`;
        }).join('')}
    </div>
</div>`;
        this._updateAssignCount();
    },

    _applyAssignFilters() {
        const query = (document.getElementById('sv-asgn-search')?.value || '').trim().toLowerCase();
        const pos   = (document.getElementById('sv-asgn-pos')?.value   || '');
        const mgr   = (document.getElementById('sv-asgn-mgr')?.value   || '');
        document.querySelectorAll('.sv-asgn-item').forEach(el => {
            const ok = (!query || el.dataset.name.includes(query))
                    && (!pos   || el.dataset.pos === pos)
                    && (!mgr   || el.dataset.mgr === mgr);
            el.style.display = ok ? 'flex' : 'none';
        });
        this._updateAssignCount();
    },

    _selectAllFiltered(checked) {
        document.querySelectorAll('.sv-asgn-item').forEach(el => {
            if (el.style.display === 'none') return;
            const cb = el.querySelector('input[type=checkbox]');
            if (cb) cb.checked = checked;
        });
        this._updateAssignCount();
    },

    _updateAssignCount() {
        const all     = [...document.querySelectorAll('.sv-asgn-item input[type=checkbox]')];
        const visible = all.filter(c => c.closest('.sv-asgn-item').style.display !== 'none');
        const sel     = visible.filter(c => c.checked).length;
        const el = document.getElementById('sv-asgn-count');
        if (el) el.textContent = `Вибрано: ${sel} з ${visible.length}`;
    },

    async _doAssign(surveyId) {
        const checkboxes      = [...document.querySelectorAll('.sv-asgn-item input[type=checkbox]')];
        const deadlineRaw     = Dom.val('sv-asgn-deadline');
        const deadlineIso     = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;
        const deadlineChanged = document.getElementById('sv-asgn-deadline')?.dataset.changed === 'true';

        const toAssignNew = checkboxes.filter(c => c.checked && c.dataset.wasAssigned === 'false').map(c => c.value);
        const toUpdateDl  = deadlineChanged
            ? checkboxes.filter(c => c.checked && c.dataset.wasAssigned === 'true').map(c => c.value)
            : [];
        const toUnassign  = checkboxes.filter(c => !c.checked && c.dataset.wasAssigned === 'true').map(c => c.value);

        Loader.show();
        try {
            const toAssign = [...toAssignNew, ...toUpdateDl];
            if (toAssign.length) await API.surveys.assign(surveyId, toAssign, deadlineIso);
            for (const uid of toUnassign) await API.surveys.unassign(surveyId, uid);

            if (toAssignNew.length) {
                const survey = this._surveys.find(s => s.id === surveyId);
                const title  = survey?.title || 'Опитування';
                try {
                    await Promise.all(toAssignNew.map(uid =>
                        supabase.from('notifications').insert({
                            user_id: uid, type: 'survey_assigned',
                            title: 'Нове опитування',
                            message: `Вам призначено опитування: ${title}`,
                            link: '#/expert-path'
                        })
                    ));
                } catch { Toast.warning('Призначено', 'Але не вдалося надіслати деякі сповіщення'); }
            }
            Toast.success('Збережено');
            this._backToList();
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _backToList() {
        const area = document.getElementById('ep-content');
        if (area) this._renderList(area);
    },
};
