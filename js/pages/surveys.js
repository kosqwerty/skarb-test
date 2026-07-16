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
    _allowCreate:   true,      // false when embedded read-only (e.g. "Моє навчання" tab) — management now lives in admin panel

    // ── Entry point (from ExpertPathPage / AdminPage) ─────────────
    async renderInTab(area, opts = {}) {
        if (opts.allowCreate !== undefined) this._allowCreate = opts.allowCreate;
        area.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            const canManage = AppState.isAdmin() || AppState.profile?.role === 'smm';
            const isStaff   = AppState.isStaff();

            let all;
            if (canManage) {
                // admins/smm see everything
                all = await API.surveys.getAll({});
            } else if (isStaff) {
                // other staff (smm/ceo) see published only
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
        // The management table (admin panel) only makes sense there — the expert-path
        // "Моє навчання" tab is a personal/take-a-survey view even for admins.
        const showTable = canManage && this._allowCreate;
        if (!showTable) this._filter = 'active';

        area.innerHTML = `
<style>
@keyframes sv-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.sv-list-wrap{animation:sv-in .3s ease}
.sv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.sv-card{border-radius:18px;overflow:hidden;border:1px solid var(--border);background:var(--bg-surface);box-shadow:0 1px 3px rgba(0,0,0,.06);transition:transform .25s cubic-bezier(.4,0,.2,1),box-shadow .25s,border-color .2s;cursor:pointer;display:flex;flex-direction:column}
.sv-card:hover{transform:translateY(-5px);box-shadow:0 18px 38px rgba(0,0,0,.16);border-color:var(--border-light)}
.sv-card-banner{padding:22px 20px 18px;position:relative;height:180px;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;isolation:isolate}
.sv-card-cover-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:.92;z-index:0}
.sv-done-badge{position:absolute;z-index:1;top:12px;right:12px;padding:4px 11px;border-radius:20px;background:rgba(255,255,255,.22);color:#fff;font-size:.68rem;font-weight:700;backdrop-filter:blur(6px);display:flex;align-items:center;gap:4px;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.sv-anon-badge{position:absolute;z-index:1;top:12px;left:12px;padding:4px 11px;border-radius:20px;background:rgba(255,255,255,.16);color:rgba(255,255,255,.95);font-size:.65rem;font-weight:600;backdrop-filter:blur(6px)}
.sv-card-title-bar{position:relative;z-index:1;margin:0 -20px -18px;padding:22px 20px 14px;background:linear-gradient(180deg,rgba(15,23,42,0) 0%,rgba(15,23,42,.55) 55%,rgba(15,23,42,.8) 100%)}
.sv-card-title{font-size:1.05rem;font-weight:800;color:#fff;line-height:1.35;text-shadow:0 1px 6px rgba(0,0,0,.3)}
.sv-card-body{padding:14px 18px 16px;flex:1;display:flex;flex-direction:column;gap:8px}
.sv-card-desc{font-size:.82rem;color:var(--text-secondary);line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.sv-card-meta{display:flex;align-items:center;gap:0;margin-top:4px;width:fit-content;border:1px solid var(--border);border-radius:20px;background:var(--bg-raised);overflow:hidden}
.sv-meta-item{display:flex;align-items:center;gap:5px;font-size:.7rem;font-weight:600;color:var(--text-secondary);padding:5px 12px}
.sv-meta-item:not(:last-child){border-right:1px solid var(--border)}
.sv-meta-item i{font-size:.66rem;color:var(--primary)}
.sv-card-footer{padding:12px 18px 16px;border-top:1px solid var(--border);display:flex;gap:8px;background:color-mix(in srgb,var(--bg-raised) 45%,transparent)}
.sv-btn{flex:1;padding:8px 12px;border-radius:12px;border:none;font-size:.8rem;font-weight:700;cursor:pointer;transition:all .18s;display:flex;align-items:center;justify-content:center;gap:6px}
.sv-btn-primary{background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;box-shadow:0 3px 10px var(--primary-glow)}
.sv-btn-primary:hover{box-shadow:0 5px 16px var(--primary-glow);transform:translateY(-1px)}
.sv-btn-ghost{background:var(--bg-raised);color:var(--text-secondary);border:1.5px solid var(--border)}
.sv-btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
.sv-btn-danger{background:rgba(239,68,68,.1);color:var(--danger);border:1.5px solid rgba(239,68,68,.25)}
.sv-btn-danger:hover{background:rgba(239,68,68,.18)}
.sv-empty{text-align:center;padding:4rem 2rem;color:var(--text-muted)}
.sv-draft-label{position:relative;z-index:1;display:inline-block;padding:2px 8px;border-radius:12px;font-size:.65rem;font-weight:700;background:rgba(100,116,139,.15);color:#64748b;margin-bottom:4px}
.sv-new-card{border:2px dashed var(--border);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:220px;cursor:pointer;color:var(--text-muted);background:transparent;transition:all .15s}
.sv-new-card:hover{border-color:var(--primary);color:var(--primary)}
.sv-new-card i{font-size:1.6rem}
/* ── Management table (admin panel) — same shape as tests-manager's tm-table ── */
.sv-tbl-topbar{display:flex;align-items:center;justify-content:flex-end;margin-bottom:14px}
.sv-tbl-new{display:inline-flex;align-items:center;gap:8px;padding:9px 18px;border-radius:11px;background:var(--primary);border:none;color:#fff;font-size:.85rem;font-weight:700;cursor:pointer;transition:background .15s}
.sv-tbl-new:hover{background:var(--primary-dark)}
.sv-tbl-wrap{background:var(--bg-surface);border:1px solid var(--border);border-radius:18px;overflow:hidden;animation:sv-in .3s ease}
.sv-tbl{width:100%;border-collapse:collapse}
.sv-tbl thead th{text-align:left;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);padding:12px 16px;background:var(--bg-raised);border-bottom:1px solid var(--border);white-space:nowrap}
.sv-tbl-th-q,.sv-tbl-th-st{width:150px}
.sv-tbl-th-actions{width:170px;text-align:right}
.sv-tbl-row{border-bottom:1px solid var(--border);transition:background .12s}
.sv-tbl-row:last-child{border-bottom:none}
.sv-tbl-row:hover{background:var(--bg-hover)}
.sv-tbl td{padding:11px 16px;vertical-align:middle}
.sv-tbl-td-name{cursor:pointer}
.sv-tbl-name-wrap{display:flex;align-items:center;gap:12px;min-width:0}
.sv-tbl-ico{width:42px;height:42px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem}
.sv-tbl-title{font-weight:700;font-size:.9rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:420px}
.sv-tbl-desc{font-size:.76rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:420px;margin-top:2px}
.sv-tbl-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:20px;font-size:.72rem;font-weight:600}
.sv-tbl-chip-q{background:rgba(59,130,246,.12);color:#3b82f6}
.sv-tbl-chip-draft{background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border)}
.sv-tbl-chip-pub{background:rgba(16,185,129,.12);color:#10b981}
.sv-tbl-pub-tgl{display:inline-flex;align-items:center;cursor:pointer}
.sv-tbl-pub-knob{width:34px;height:19px;border-radius:9999px;background:var(--border-light);border:1.5px solid var(--border);position:relative;transition:all .22s}
.sv-tbl-pub-knob::after{content:'';position:absolute;top:1.5px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--text-muted);transition:all .22s cubic-bezier(.4,0,.2,1)}
.sv-tbl-pub-tgl.on .sv-tbl-pub-knob{background:rgba(16,185,129,.22);border-color:#10b981}
.sv-tbl-pub-tgl.on .sv-tbl-pub-knob::after{left:17px;background:#10b981}
.sv-tbl-td-actions{white-space:nowrap;text-align:right}
.sv-tbl-act-group{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px;width:130px;margin-left:auto}
.sv-tbl-act-btn{width:32px;height:32px;border-radius:9px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-size:.8rem;transition:all .15s}
.sv-tbl-act-btn:hover{border-color:var(--primary);color:var(--primary);background:color-mix(in srgb,var(--primary) 8%,transparent)}
.sv-tbl-act-danger:hover{border-color:var(--danger)!important;color:var(--danger)!important;background:rgba(239,68,68,.08)!important}
</style>

<div class="sv-list-wrap">
    ${showTable ? `
    <div class="sv-tbl-topbar">
        <button type="button" class="sv-tbl-new" onclick="SurveysPage.openBuilder()"><i class="fa-solid fa-plus"></i> Нове опитування</button>
    </div>
    <div id="sv-grid">${this._tableHtml()}</div>` : `
    <div id="sv-grid" class="sv-grid">${this._cardsHtml()}</div>`}
</div>`;
        this._loadCounts();
    },

    // ── Management table (admin panel) — shows every survey, no filter ──
    _tableHtml() {
        const list = this._surveys;
        if (!list.length) return `
        <div class="sv-tbl-wrap">
            <div class="sv-empty">
                <div style="font-size:3rem;margin-bottom:.75rem;opacity:.25"><i class="fa-solid fa-square-poll-horizontal"></i></div>
                <div>Опитувань немає</div>
            </div>
        </div>`;
        return `
        <div class="sv-tbl-wrap">
            <table class="sv-tbl">
                <thead>
                    <tr>
                        <th>Назва опитування</th>
                        <th class="sv-tbl-th-q">Питань</th>
                        <th class="sv-tbl-th-st">Статус</th>
                        <th class="sv-tbl-th-actions">Дії</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map((s, i) => this._tblRowHtml(s, i)).join('')}
                </tbody>
            </table>
        </div>`;
    },

    _tblRowHtml(s, i = 0) {
        const theme  = this._theme(s);
        const qCount = s.questions?.length ?? '—';
        return `
<tr class="sv-tbl-row" style="--i:${i}">
    <td class="sv-tbl-td-name" onclick="SurveysPage.openBuilder('${s.id}')">
        <div class="sv-tbl-name-wrap">
            ${s.cover_image
                ? `<img class="sv-tbl-ico" style="object-fit:cover" src="${Fmt.esc(s.cover_image)}" alt="">`
                : `<div class="sv-tbl-ico" style="background:linear-gradient(135deg,${theme.from},${theme.to})"><i class="fa-solid fa-square-poll-horizontal"></i></div>`}
            <div style="min-width:0">
                <div class="sv-tbl-title">${Fmt.esc(s.title)}</div>
                ${s.description ? `<div class="sv-tbl-desc">${Fmt.esc(s.description)}</div>` : ''}
            </div>
        </div>
    </td>
    <td>
        <span class="sv-tbl-chip sv-tbl-chip-q"><i class="fa-solid fa-question"></i> ${qCount}</span>
    </td>
    <td onclick="event.stopPropagation()">
        <div class="sv-tbl-pub-tgl${s.is_published ? ' on' : ''}" onclick="SurveysPage._togglePublish('${s.id}',this)" title="Опублікувати / зняти з публікації"><div class="sv-tbl-pub-knob"></div></div>
    </td>
    <td class="sv-tbl-td-actions" onclick="event.stopPropagation()">
        <div class="sv-tbl-act-group">
            <button class="sv-tbl-act-btn" title="Призначити" onclick="SurveysPage.openAssign('${s.id}')"><i class="fa-solid fa-user-plus"></i></button>
            <button class="sv-tbl-act-btn" title="Попередній перегляд" onclick="SurveysPage.openPreview('${s.id}')"><i class="fa-solid fa-eye"></i></button>
            <button class="sv-tbl-act-btn" title="Результати" onclick="SurveysPage.openResults('${s.id}')"><i class="fa-solid fa-chart-column"></i></button>
            <button class="sv-tbl-act-btn" title="Редагувати" onclick="SurveysPage.openBuilder('${s.id}')"><i class="fa-solid fa-pen"></i></button>
            <button class="sv-tbl-act-btn" title="Налаштування" onclick="SurveysPage.openSurveySettings('${s.id}')"><i class="fa-solid fa-gear"></i></button>
            <button class="sv-tbl-act-btn sv-tbl-act-danger" title="Видалити" data-title="${Fmt.esc(s.title)}" onclick="SurveysPage._deleteSurvey('${s.id}',this.dataset.title)"><i class="fa-solid fa-trash"></i></button>
        </div>
    </td>
</tr>`;
    },

    async _togglePublish(id, el) {
        const next = !el.classList.contains('on');
        el.classList.toggle('on', next);
        try {
            await API.surveys.update(id, { is_published: next });
            const s = this._surveys.find(s => s.id === id);
            if (s) s.is_published = next;
        } catch(e) {
            el.classList.toggle('on', !next);
            Toast.error('Помилка', e.message);
        }
    },

    // ── Settings view (cover + anonymous) — table gear icon, inline page ──
    openSurveySettings(id) {
        const area = document.getElementById('ep-content');
        const s = this._surveys.find(s => s.id === id);
        if (!area || !s) return;
        // Reuse the builder's cover-image helpers (_coverHtml/_uploadCover/_removeCover) —
        // safe since the builder itself isn't mounted while this view is shown.
        this._builderSurveyId = s.id;
        this._builderCoverUrl = s.cover_image || null;
        area.innerHTML = `
<style>
.svst-page{max-width:1120px;animation:sv-in .3s ease}
.svst-header{display:flex;align-items:center;gap:12px;margin-bottom:1.25rem}
.svst-title{margin:0;font-size:1.15rem;font-weight:800}
.svst-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;padding:22px 24px;display:flex;flex-direction:column;gap:16px}
.svst-label{display:block;font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.svst-toggle{display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer;padding:8px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-raised);transition:all .15s;user-select:none;width:fit-content}
.svst-toggle:has(input:checked){border-color:var(--primary);background:var(--primary-glow);color:var(--primary);font-weight:600}
.svst-actions{display:flex;gap:10px;margin-top:4px}
.sv-bld-cover-drop{
    height:260px;border:2px dashed var(--border);border-radius:14px;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
    cursor:pointer;transition:all .2s;color:var(--text-muted);font-size:.85rem;position:relative
}
.sv-bld-cover-drop:hover{border-color:var(--primary);color:var(--primary);background:var(--primary-glow)}
.sv-bld-cover-drop i{font-size:1.4rem}
.sv-bld-cover-drop input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.sv-bld-cover-preview{position:relative;height:260px;border-radius:14px;overflow:hidden}
.sv-bld-cover-preview img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
.sv-bld-cover-rm{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.75rem;transition:background .15s}
.sv-bld-cover-rm:hover{background:rgba(0,0,0,.75)}
.sv-bld-cover-replace{position:absolute;bottom:8px;right:8px;padding:5px 12px;border-radius:20px;background:rgba(0,0,0,.55);color:#fff;border:none;cursor:pointer;font-size:.72rem;font-weight:600;display:flex;align-items:center;gap:5px}
.sv-bld-cover-replace:hover{background:rgba(0,0,0,.75)}
.sv-bld-cover-replace input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
</style>
<div class="svst-page">
    <div class="svst-header">
        <button class="btn-back btn-back-icon" onclick="SurveysPage._backToList()"><i class="fa-solid fa-arrow-left"></i></button>
        <h2 class="svst-title"><i class="fa-solid fa-gear"></i> Налаштування — ${Fmt.esc(s.title)}</h2>
    </div>
    <div class="svst-card">
        <div>
            <span class="svst-label">Обкладинка</span>
            <div id="sv-bld-cover-wrap">${this._coverHtml()}</div>
        </div>
        <div>
            <span class="svst-label">Дедлайн</span>
            ${UaDateTime.html('svst-deadline', s.deadline_at ? new Date(s.deadline_at).toISOString().slice(0,16) : '')}
        </div>
        <label class="svst-toggle">
            <input type="checkbox" id="svst-anon" ${s.is_anonymous ? 'checked' : ''}>
            <i class="fa-solid fa-user-secret"></i> Анонімне опитування
        </label>
        <div class="svst-actions">
            <button class="btn btn-ghost" onclick="SurveysPage._backToList()">Скасувати</button>
            <button class="btn btn-primary" onclick="SurveysPage._saveSurveySettings('${id}')">Зберегти</button>
        </div>
    </div>
</div>`;
    },

    async _saveSurveySettings(id) {
        const isAnon    = document.getElementById('svst-anon')?.checked || false;
        const deadline  = document.getElementById('svst-deadline')?.value || null;
        try {
            await API.surveys.update(id, { cover_image: this._builderCoverUrl || null, is_anonymous: isAnon, deadline_at: deadline });
            const s = this._surveys.find(s => s.id === id);
            if (s) { s.cover_image = this._builderCoverUrl || null; s.is_anonymous = isAnon; s.deadline_at = deadline; }
            Toast.success('Налаштування збережено');
            this._backToList();
        } catch(e) { Toast.error('Помилка', e.message); }
    },

    // ── Rating question — icon + scale (1–10) ────────────────────────
    // q.options for rating/scale is a jsonb object (not the array used by single/multiple),
    // e.g. { icon:'star', max:7, follow_up:{...} } — legacy rows without icon/max default to star/5.
    _ratingMeta(q) {
        const o = (q?.options && !Array.isArray(q.options)) ? q.options : {};
        return { icon: o.icon || 'star', max: o.max || 5 };
    },
    _ratingChar(icon) {
        return { star: '★', heart: '❤', thumb: '👍' }[icon] || '★';
    },
    _ratingEmptyHtml(icon, count) {
        if (count <= 0) return '';
        return icon === 'star' ? '☆'.repeat(count) : `<span style="opacity:.3">${this._ratingChar(icon).repeat(count)}</span>`;
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
        return { from: '#2563eb', to: '#0ea5e9' };
    },

    _cardsHtml() {
        const list = this._filtered();
        const canManage = AppState.isAdmin() || AppState.profile?.role === 'smm';
        const newTile = (canManage && this._allowCreate) ? `
        <button type="button" class="sv-new-card" onclick="SurveysPage.openBuilder()">
            <i class="fa-solid fa-plus"></i>
            <span>Нове опитування</span>
        </button>` : '';
        if (!list.length) return `${newTile}<div class="sv-empty" style="grid-column:1/-1"><div style="font-size:3rem;margin-bottom:.75rem;opacity:.25"><i class="fa-solid fa-square-poll-horizontal"></i></div><div>Опитувань немає</div></div>`;
        return newTile + list.map((s, idx) => this._cardHtml(s, idx)).join('');
    },

    _cardHtml(s, idx) {
        const theme   = this._theme(s);
        const done    = this._myDone.has(s.id);
        const isStaff = AppState.isStaff();
        const qCount  = s.questions?.length || 0;
        const now     = new Date();
        const dl      = this._effectiveDeadline(s);
        const expired = dl && new Date(dl) < now;

        let deadlineLabel = '';
        if (dl) {
            const cd = Fmt.countdown(dl);
            deadlineLabel = `<span class="sv-meta-item">${cd.html}</span>`;
        }

        return `
<div class="sv-card" style="animation:sv-in .3s ease ${idx*60}ms both;border-color:${done?'rgba(16,185,129,.35)':'var(--border)'}">
    <div class="sv-card-banner" style="background:linear-gradient(135deg,${theme.from},${theme.to})">
        ${s.cover_image ? `<img class="sv-card-cover-img" src="${Fmt.esc(s.cover_image)}" alt="">` : ''}
        ${done ? `<div class="sv-done-badge"><i class="fa-solid fa-check"></i> Пройдено</div>` : ''}
        ${s.is_anonymous ? `<div class="sv-anon-badge"><i class="fa-solid fa-user-secret"></i> Анонімне</div>` : ''}
        <div class="sv-card-title-bar">
            ${!s.is_published ? `<div class="sv-draft-label">Чернетка</div>` : ''}
            <div class="sv-card-title">${Fmt.esc(s.title)}</div>
        </div>
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
            ? `<button onclick="SurveysPage.openResults('${s.id}')" style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:12px;border:none;cursor:pointer;font-size:.8rem;font-weight:700;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 4px 14px rgba(22,163,74,.35);transition:all .2s" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''"><i class="fa-solid fa-chart-bar"></i> ${isStaff ? 'Результати' : 'Переглянути'}</button>`
            : s.is_published
                ? `<button class="sv-btn sv-btn-primary" onclick="SurveysPage.goTake('${s.id}')"><i class="fa-solid fa-pen-to-square"></i> Пройти</button>`
                : ''}
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
    // Same launch pattern as tests (MyTestsPage's "Пройти тест"): plain in-place
    // SPA navigation via the router, no new tab.
    goTake(surveyId) {
        Router.go(`surveys/${surveyId}`);
    },

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
.sv-take-wrap{max-width:900px;animation:sv-in .3s ease}
.sv-take-header{border-radius:20px;padding:24px 28px;margin-bottom:1.5rem;background:linear-gradient(135deg,${theme.from},${theme.to});position:relative;overflow:hidden}
.sv-take-header::after{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='0.04'%3E%3Cpath d='M20 20h20v20H20z'/%3E%3C/g%3E%3C/svg%3E")}
.sv-take-title{font-size:1.4rem;font-weight:800;color:#fff;margin-bottom:.4rem;position:relative;z-index:1}
.sv-take-anon-badge{display:inline-flex;align-items:center;gap:6px;font-size:.7rem;font-weight:700;padding:4px 11px;border-radius:20px;background:rgba(255,255,255,.16);color:rgba(255,255,255,.95);backdrop-filter:blur(6px);white-space:nowrap}
.sv-take-anon-badge.is-anon{background:rgba(255,255,255,.28)}
.sv-take-desc{font-size:.875rem;color:rgba(255,255,255,.8);position:relative;z-index:1;margin-top:.4rem}
.sv-q-card{background:var(--bg-surface);border:1.5px solid var(--border);border-radius:18px;padding:20px 22px;margin-bottom:14px;transition:border-color .2s}
.sv-q-card.required-error{border-color:var(--danger);animation:sv-shake .3s ease}
@keyframes sv-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.sv-q-num{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:6px}
.sv-q-text{font-size:.95rem;font-weight:700;color:var(--text-primary);margin-bottom:14px;line-height:1.4;white-space:pre-line}
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
.sv-submit-wrap{margin-top:1.5rem;padding-bottom:2rem;display:flex;justify-content:center}
.sv-submit-btn{width:320px;max-width:100%;padding:14px;border-radius:14px;border:none;font-size:1rem;font-weight:700;cursor:pointer;transition:all .2s;background:linear-gradient(135deg,${theme.from},${theme.to});color:#fff;box-shadow:0 4px 18px var(--primary-glow)}
.sv-submit-btn:hover{filter:brightness(1.1);transform:translateY(-1px);box-shadow:0 8px 24px var(--primary-glow)}
.sv-submit-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
/* Success */
.sv-success{text-align:center;padding:3rem 2rem;animation:sv-in .4s ease}
.sv-success-icon{font-size:4rem;margin-bottom:1rem;animation:sv-pop .4s .1s ease both}
@keyframes sv-pop{from{transform:scale(0)}to{transform:scale(1)}}
</style>

<div class="sv-take-wrap">
    <button class="btn-back" style="margin-bottom:1rem" onclick="SurveysPage._backToList()"><i class="fa-solid fa-arrow-left"></i> Назад</button>
    ${opts.preview ? `
    <div style="display:flex;align-items:center;gap:10px;background:rgba(245,158,11,.1);border:1.5px solid rgba(245,158,11,.4);border-radius:14px;padding:10px 16px;margin-bottom:1rem">
        <i class="fa-solid fa-eye" style="color:#f59e0b;font-size:1.1rem"></i>
        <div style="flex:1">
            <div style="font-weight:700;font-size:.88rem;color:#b45309">Режим перегляду</div>
            <div style="font-size:.78rem;color:#92400e">Відповіді не зберігаються. Так виглядатиме опитник для учасників.</div>
        </div>
    </div>` : ''}
    <div class="sv-take-header">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;position:relative;z-index:1">
            <div class="sv-take-title" style="margin-bottom:0">${Fmt.esc(survey.title)}</div>
            <span class="sv-take-anon-badge${survey.is_anonymous ? ' is-anon' : ''}">
                <i class="fa-solid ${survey.is_anonymous ? 'fa-user-secret' : 'fa-user-check'}"></i>
                ${survey.is_anonymous ? 'Анонімне' : 'Не анонімне'}
            </span>
        </div>
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
            const { icon, max } = this._ratingMeta(q);
            const ch = this._ratingChar(icon);
            body = `
            <div class="sv-stars" id="sv-q-${q.id}" data-val="">
                ${Array.from({length: max}, (_, i) => i + 1).map(n => `
                <span class="sv-star" data-n="${n}" data-qid="${q.id}"
                    onclick="SurveysPage._rateStar(this)"
                    onmouseenter="SurveysPage._hoverStar(this)"
                    onmouseleave="SurveysPage._unhoverStar('${q.id}')">${ch}</span>`).join('')}
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
    <button class="btn-back" onclick="SurveysPage._backToList()">
        <i class="fa-solid fa-arrow-left"></i> Назад
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
.sv-res-qtext{font-size:.95rem;font-weight:700;color:var(--text-primary);margin-bottom:14px;white-space:pre-line}
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
        <button class="btn-back" onclick="SurveysPage._backToList()"><i class="fa-solid fa-arrow-left"></i> Назад</button>
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
            if (q.type === 'rating') {
                const { icon, max } = this._ratingMeta(q);
                return a.value ? this._ratingChar(icon).repeat(+a.value) + `  (${a.value}/${max})` : '—';
            }
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
            const typeNames = { single:'Одна відповідь', multiple:'Кілька відповідей', text:'Текст', scale:'Шкала (1–10)' };
            let result = '';
            let typeLabelText = typeNames[q.type] || q.type;
            if (q.type === 'single' || q.type === 'multiple') {
                const opts   = Array.isArray(q.options) ? q.options : [];
                const counts = new Array(opts.length).fill(0);
                qAnswers.forEach(a => (a.selected_options || []).forEach(idx => { if (idx < counts.length) counts[idx]++; }));
                result = opts.map((o, oi) => `${o}: ${counts[oi]} (${responses.length ? Math.round(counts[oi]/responses.length*100) : 0}%)`).join('\n');
            } else if (q.type === 'text') {
                result = qAnswers.map(a => a.value || '').filter(Boolean).join(' | ');
            } else if (q.type === 'rating') {
                const { icon, max } = this._ratingMeta(q);
                typeLabelText = `Оцінка (1–${max})`;
                const vals = qAnswers.map(a => +(a.value||0)).filter(v=>v>0);
                const avg  = vals.length ? (vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : '—';
                result = `Середнє: ${avg}/${max}\n` + Array.from({length:max},(_,idx)=>idx+1).map(n=>`${n}${this._ratingChar(icon)}: ${vals.filter(v=>v===n).length}`).join(', ');
            } else if (q.type === 'scale') {
                const vals = qAnswers.map(a => +(a.value||0)).filter(v=>v>0);
                const avg  = vals.length ? (vals.reduce((s,v)=>s+v,0)/vals.length).toFixed(2) : '—';
                result = `Середнє: ${avg}/10\n` + Array.from({length:10},(_,i)=>`${i+1}: ${vals.filter(v=>v===i+1).length}`).join(', ');
            }
            const fuAnswers = qAnswers.filter(a=>a.selected_options?.follow_up).map(a=>a.selected_options.follow_up).join(' | ');
            analysisRows.push([i+1, q.text, typeLabelText, qAnswers.length, result, fuAnswers||'—']);
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
                if (q.type === 'rating') return a.value ? `${a.value}/${this._ratingMeta(q).max}` : '';
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
            const { icon, max } = this._ratingMeta(q);
            const ch = this._ratingChar(icon);
            const range = Array.from({length: max}, (_, i) => i + 1);
            const vals = answers.map(a => +(a.value || 0)).filter(v => v > 0);
            const avg  = vals.length ? (vals.reduce((s,v) => s+v, 0) / vals.length).toFixed(1) : '—';
            const filled = avg !== '—' ? Math.round(+avg) : 0;
            const dist   = range.map(n => vals.filter(v => v === n).length);
            body = `
            <div class="sv-rating-avg">
                <div class="sv-rating-avg-n">${avg}</div>
                <div class="sv-rating-avg-stars">${ch.repeat(filled)}${this._ratingEmptyHtml(icon, max - filled)}</div>
                <div style="font-size:.78rem;color:var(--text-muted)">(${vals.length} оцінок, з ${max})</div>
            </div>
            ${range.map((n,i) => {
                const cnt = dist[i]; const pct = vals.length ? Math.round(cnt/vals.length*100) : 0;
                return `<div class="sv-bar-row">
                    <div class="sv-bar-label">${ch.repeat(n)}</div>
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
            const metaObj    = isCondType && rawOpts && !Array.isArray(rawOpts) ? rawOpts : {};
            return {
                ...q, _id: q.id || Math.random().toString(36).slice(2),
                follow_up:   metaObj.follow_up || null,
                rating_icon: metaObj.icon || 'star',
                rating_max:  metaObj.max || 5,
                options: Array.isArray(rawOpts) ? rawOpts : [],
            };
        });
        area.innerHTML = `
<style>
.sv-builder{max-width:760px;animation:sv-in .3s ease}
.sv-bld-header{display:flex;align-items:center;gap:12px;margin-bottom:1.25rem;flex-wrap:wrap}
/* ── Google-Forms-style header card: colour bar on top, underlined fields ── */
.sv-bld-meta-card{
    background:var(--bg-surface);border:1px solid var(--border);border-top:8px solid var(--primary);
    border-radius:10px;padding:26px 28px 20px;margin-bottom:1.25rem;
    display:flex;flex-direction:column;gap:0;box-shadow:0 1px 3px rgba(0,0,0,.08);
}
.sv-bld-label{display:block;font-size:.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}
.sv-bld-input{width:100%;padding:10px 14px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:12px;font-size:.9rem;color:var(--text-primary);font-family:inherit;outline:none;transition:border-color .15s;box-sizing:border-box}
.sv-bld-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-glow)}
.sv-bld-title-input{
    width:100%;border:none;border-bottom:1px solid var(--border);background:transparent;
    padding:6px 2px 12px;font-size:1.5rem;font-weight:500;color:var(--text-primary);
    font-family:inherit;outline:none;transition:border-color .15s;box-sizing:border-box;
    forced-color-adjust:none;-ms-high-contrast-adjust:none
}
.sv-bld-title-input:focus{border-bottom:2px solid var(--primary);padding-bottom:11px}
#sb-title:-webkit-autofill,
#sb-title:-webkit-autofill:hover,
#sb-title:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 1000px transparent inset;
    -webkit-text-fill-color: var(--text-primary);
    transition: background-color 99999s ease-in-out 0s;
}
.sv-bld-title-input::placeholder{color:var(--text-muted);opacity:.65}
.sv-bld-desc-input{
    width:100%;border:none;border-bottom:1px solid var(--border);background:transparent;resize:none;
    padding:10px 2px;font-size:.85rem;color:var(--text-secondary);font-family:inherit;outline:none;
    transition:border-color .15s;box-sizing:border-box;margin-top:2px
}
.sv-bld-desc-input:focus{border-bottom:2px solid var(--primary);padding-bottom:9px}
.sv-bld-desc-input::placeholder{color:var(--text-muted);opacity:.65}
.sv-bld-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:18px}
.sv-bld-toggles{display:flex;gap:16px;flex-wrap:wrap}
.sv-bld-toggle{display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer;padding:8px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-raised);transition:all .15s;user-select:none}
.sv-bld-toggle:has(input:checked){border-color:var(--primary);background:var(--primary-glow);color:var(--primary);font-weight:600}
/* Question cards */
.sv-bld-qs{display:flex;flex-direction:column;gap:14px;margin-bottom:1rem}
.sv-bld-qcard{background:var(--bg-surface);border:1px solid var(--border);border-left:1px solid var(--border);border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);transition:border-color .15s,border-left-width .1s,box-shadow .15s}
.sv-bld-qcard:hover{box-shadow:0 2px 8px rgba(0,0,0,.1)}
.sv-bld-qcard:focus-within{border-left:5px solid var(--primary);box-shadow:0 2px 10px var(--primary-glow)}
.sv-bld-qcard-body{padding:20px 22px 8px}
.sv-bld-qcard-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.sv-bld-drag{color:var(--text-muted);cursor:grab;font-size:1rem;padding:2px 4px;opacity:.4;transition:opacity .15s}
.sv-bld-drag:hover{opacity:1}
.sv-bld-qnum{font-size:.7rem;font-weight:700;color:var(--text-muted);background:var(--bg-raised);padding:2px 8px;border-radius:20px;white-space:nowrap}
.sv-bld-type-select-wrap{position:relative;margin-left:auto;flex-shrink:0}
.sv-bld-type-select{
    appearance:none;-webkit-appearance:none;padding:7px 30px 7px 14px;border-radius:9px;
    border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-primary);
    font-size:.78rem;font-weight:600;cursor:pointer;font-family:inherit;transition:border-color .15s
}
.sv-bld-type-select:hover,.sv-bld-type-select:focus{border-color:var(--primary);outline:none}
.sv-bld-type-select-chev{position:absolute;right:11px;top:50%;transform:translateY(-50%);font-size:.62rem;color:var(--text-muted);pointer-events:none}
.sv-bld-del,.sv-bld-dup{width:28px;height:28px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.8rem;transition:all .15s;flex-shrink:0}
.sv-bld-del:hover{background:rgba(239,68,68,.1);border-color:var(--danger);color:var(--danger)}
.sv-bld-dup:hover{background:var(--primary-glow);border-color:var(--primary);color:var(--primary)}
.sv-bld-q-input{
    width:100%;border:none;border-bottom:1px solid var(--border);background:transparent;
    padding:6px 2px 10px;font-size:1rem;font-weight:500;color:var(--text-primary);
    font-family:inherit;outline:none;transition:border-color .15s;box-sizing:border-box;
    resize:none;overflow:hidden;line-height:1.4
}
.sv-bld-q-input:focus{border-bottom:2px solid var(--primary);padding-bottom:9px}
.sv-bld-q-input::placeholder{color:var(--text-muted);opacity:.65}
/* Image upload — compact button inline with question text, preview shown below if set */
.sv-bld-img-wrap:not(:empty){margin-top:10px}
.sv-bld-img-btn{position:relative;width:38px;height:38px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all .15s;margin-bottom:1px}
.sv-bld-img-btn:hover{border-color:var(--primary);color:var(--primary);background:var(--primary-glow)}
.sv-bld-img-btn input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.sv-bld-img-preview{position:relative;border-radius:12px;overflow:hidden;display:inline-block;max-width:100%}
.sv-bld-img-preview img{max-height:200px;max-width:100%;border-radius:12px;display:block}
.sv-bld-img-rm{position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.7rem}
/* Options — plain radio/checkbox rows like Google Forms, no boxed background */
.sv-bld-opts{display:flex;flex-direction:column;gap:2px;margin-top:12px}
.sv-bld-opt{display:flex;align-items:center;gap:12px;background:transparent;border:none;border-bottom:1px solid transparent;border-radius:0;padding:6px 2px;transition:border-color .15s}
.sv-bld-opt:hover,.sv-bld-opt:focus-within{border-bottom-color:var(--border)}
.sv-bld-opt-icon{color:var(--text-muted);font-size:1rem;flex-shrink:0;width:16px;text-align:center}
.sv-bld-opt-input{flex:1;border:none;border-bottom:1px solid var(--border);background:transparent;padding:2px 2px 6px;font-size:.88rem;color:var(--text-primary);font-family:inherit;outline:none;transition:border-color .15s}
.sv-bld-opt-input:focus{border-bottom-color:var(--primary)}
.sv-bld-opt-del{width:22px;height:22px;border-radius:6px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.7rem;flex-shrink:0;transition:color .15s;opacity:0}
.sv-bld-opt:hover .sv-bld-opt-del{opacity:1}
.sv-bld-opt-del:hover{color:var(--danger)}
.sv-add-opt{font-size:.85rem;color:var(--text-secondary);background:none;border:none;cursor:pointer;padding:8px 2px 0 26px;display:flex;align-items:center;gap:8px;font-weight:400}
.sv-add-opt:hover{color:var(--primary)}
.sv-bld-req-toggle-row{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:16px;padding-top:12px;border-top:1px solid var(--border)}
/* Toggle switch — matches Google Forms' "Required" pill */
.sv-bld-toggle-sw{position:relative;display:inline-flex;align-items:center;gap:9px;font-size:.78rem;color:var(--text-secondary);cursor:pointer;user-select:none}
.sv-bld-toggle-sw input{position:absolute;opacity:0;width:1px;height:1px}
.sv-bld-toggle-sw-pill{width:34px;height:19px;border-radius:11px;background:var(--border);position:relative;flex-shrink:0;transition:background .2s}
.sv-bld-toggle-sw input:checked ~ .sv-bld-toggle-sw-pill{background:var(--primary)}
.sv-bld-toggle-sw-knob{position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .2s}
.sv-bld-toggle-sw input:checked ~ .sv-bld-toggle-sw-pill .sv-bld-toggle-sw-knob{transform:translateX(15px)}
/* type hints */
.sv-bld-type-hint{margin-top:10px;padding:10px 14px;background:var(--bg-raised);border-radius:10px;font-size:.8rem;color:var(--text-muted);display:flex;align-items:center;gap:8px}
/* Rating question config — icon picker + scale max */
.sv-bld-rating-cfg{margin-top:10px;padding:12px 14px;background:var(--bg-raised);border-radius:12px;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.sv-bld-rating-icons{display:flex;gap:6px}
.sv-bld-rating-icon-btn{width:36px;height:36px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg-surface);font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;opacity:.5}
.sv-bld-rating-icon-btn:hover{opacity:.8;border-color:var(--primary)}
.sv-bld-rating-icon-btn.active{opacity:1;border-color:var(--primary);background:var(--primary-glow)}
.sv-bld-rating-max{display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--text-secondary);font-weight:600}
.sv-bld-rating-max select{padding:6px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-family:inherit;font-size:.82rem;cursor:pointer;outline:none}
.sv-bld-rating-max select:focus{border-color:var(--primary)}
/* add button — floating circular FAB, Google-Forms-style */
.sv-add-q-wrap{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;margin-bottom:1.5rem}
.sv-add-q-fab{
    height:52px;padding:0 24px;border-radius:26px;border:1px solid var(--border);
    background:var(--bg-surface);color:var(--primary);font-size:.9rem;font-weight:600;cursor:pointer;
    display:flex;align-items:center;justify-content:center;gap:10px;
    box-shadow:0 2px 8px rgba(0,0,0,.12);transition:all .18s
}
.sv-add-q-fab i{font-size:1.05rem}
.sv-add-q-fab:hover{box-shadow:0 4px 16px var(--primary-glow);transform:translateY(-2px);border-color:var(--primary)}
.sv-add-q-hint{display:flex;align-items:center;gap:6px;font-size:.75rem;color:var(--text-muted);text-align:left;max-width:340px}
.sv-add-q-hint i{color:var(--primary);flex-shrink:0}
.sv-bld-actions{display:flex;gap:10px;flex-wrap:wrap}
</style>

<div class="sv-builder">
    <div class="sv-bld-header">
        <button class="btn-back btn-back-icon" onclick="SurveysPage._backToList()"><i class="fa-solid fa-arrow-left"></i></button>
        <h2 style="margin:0;font-size:1.15rem;font-weight:800">${survey ? 'Редагувати' : 'Нове'} опитування</h2>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="SurveysPage.openImportQuestions()"><i class="fa-solid fa-file-import"></i> Імпорт питань</button>
    </div>

    <div class="sv-bld-meta-card">
        <input class="sv-bld-title-input" id="sb-title" name="sb-title-field" autocomplete="one-time-code" value="${Fmt.esc(survey?.title || '')}" placeholder="Назва опитування">
        <textarea class="sv-bld-desc-input" id="sb-desc" rows="1" placeholder="Опис (необов'язково)">${Fmt.esc(survey?.description || '')}</textarea>
        <div class="sv-bld-row">
            <div class="sv-bld-toggles">
                <label class="sv-bld-toggle">
                    <input type="checkbox" id="sb-pub" ${survey?.is_published ? 'checked' : ''}>
                    <i class="fa-solid fa-globe"></i> Опублікувати
                </label>
            </div>
        </div>
    </div>

    <div id="sv-bld-qs" class="sv-bld-qs">${this._builderQuestionsHtml()}</div>

    <div class="sv-add-q-wrap">
        <button class="sv-add-q-fab" title="Додати питання" onclick="SurveysPage._addQuestion('single')">
            <i class="fa-solid fa-plus"></i> Додати питання
        </button>
        <div class="sv-add-q-hint"><i class="fa-solid fa-circle-info"></i> Не забудьте натиснути «Зберегти» — інакше нове питання не буде враховано в опитуванні</div>
    </div>

    <div class="sv-bld-actions">
        <button class="sv-btn sv-btn-ghost" style="padding:10px 20px;border-radius:12px;cursor:pointer;font-size:.875rem;font-weight:600" onclick="SurveysPage._backToList()">Скасувати</button>
        <button class="sv-btn sv-btn-primary" style="flex:1;padding:10px 20px;border-radius:12px;cursor:pointer;font-size:.875rem;font-weight:600;border:none;background:var(--primary);color:#fff"
            onclick="SurveysPage._saveSurvey()">
            <i class="fa-regular fa-floppy-disk"></i> Зберегти
        </button>
    </div>
</div>`;
        this._autoGrowAll(area);
    },

    _builderQuestions: [],

    _builderQuestionsHtml() {
        return this._builderQuestions.map((q, i) => this._builderQCard(q, i)).join('');
    },

    _builderQCard(q, i) {
        const typeLabels = {
            single:   { label: 'Одна відповідь', emoji: '⚪' },
            multiple: { label: 'Кілька',         emoji: '☑️' },
            text:     { label: 'Текст',          emoji: '📝' },
            rating:   { label: 'Зірки',          emoji: '⭐' },
            scale:    { label: 'Шкала',          emoji: '🎚️' },
        };
        const hasOpts  = q.type === 'single' || q.type === 'multiple';
        const optIcon  = q.type === 'single' ? 'fa-regular fa-circle' : 'fa-regular fa-square';
        const opts     = q.options || [];
        // Native <select> can't render <i> icon fonts inside <option> — prefix each
        // option's text with an emoji instead.
        const typeSelect = `
            <div class="sv-bld-type-select-wrap">
                <select class="sv-bld-type-select" onchange="SurveysPage._changeQType('${q._id}',this.value)">
                    ${Object.entries(typeLabels).map(([v, {label, emoji}]) => `<option value="${v}" ${q.type===v?'selected':''}>${emoji} ${label}</option>`).join('')}
                </select>
                <i class="fa-solid fa-chevron-down sv-bld-type-select-chev"></i>
            </div>`;

        const imgPreview = q.image_url ? `
            <div class="sv-bld-img-preview">
                <img src="${Fmt.safeUrl(q.image_url)}" alt="">
                <button class="sv-bld-img-rm" onclick="SurveysPage._removeQImage('${q._id}')" title="Видалити зображення"><i class="fa-solid fa-xmark"></i></button>
            </div>` : '';

        return `
<div class="sv-bld-qcard" id="sv-bq-${q._id}" draggable="true"
    ondragstart="SurveysPage._dragStart(event,'${q._id}')"
    ondragover="event.preventDefault()"
    ondrop="SurveysPage._dragDrop(event,'${q._id}')">
    <div class="sv-bld-qcard-body">
        <div class="sv-bld-qcard-head">
            <span class="sv-bld-drag" title="Перетягнути"><i class="fa-solid fa-grip-vertical"></i></span>
            <span class="sv-bld-qnum">${i+1}</span>
            ${typeSelect}
            <button class="sv-bld-dup" onclick="SurveysPage._duplicateQuestion('${q._id}')" title="Дублювати питання"><i class="fa-regular fa-copy"></i></button>
            <button class="sv-bld-del" onclick="SurveysPage._removeQuestion('${q._id}')" title="Видалити питання"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div style="display:flex;align-items:flex-end;gap:10px">
            <textarea class="sv-bld-q-input" id="sv-bq-text-${q._id}" style="flex:1" rows="1"
                placeholder="Введіть текст питання…"
                oninput="SurveysPage._updateQText('${q._id}',this.value);SurveysPage._autoGrow(this)">${Fmt.esc(q.text||'')}</textarea>
            <label class="sv-bld-img-btn" title="${q.image_url ? 'Змінити зображення' : 'Додати зображення до питання'}">
                <input type="file" accept="image/*" onchange="SurveysPage._uploadQImage('${q._id}',this)">
                <i class="fa-solid fa-image"></i>
            </label>
        </div>
        <div class="sv-bld-img-wrap">${imgPreview}</div>
        ${hasOpts ? `
        <div class="sv-bld-opts" id="sv-bq-opts-${q._id}">
            ${opts.map((o, oi) => this._optHtml(q._id, oi, o, optIcon)).join('')}
        </div>
        <button class="sv-add-opt" onclick="SurveysPage._addOption('${q._id}')"><i class="fa-solid fa-plus"></i> Додати варіант</button>` : ''}
        ${q.type === 'rating' ? `
        <div class="sv-bld-rating-cfg">
            <div class="sv-bld-rating-icons">
                ${['star','heart','thumb'].map(ic => `<button type="button" class="sv-bld-rating-icon-btn${(q.rating_icon||'star')===ic?' active':''}" title="${ic}" onclick="SurveysPage._setRatingIcon('${q._id}','${ic}')">${this._ratingChar(ic)}</button>`).join('')}
            </div>
            <label class="sv-bld-rating-max">
                Максимум:
                <select onchange="SurveysPage._setRatingMax('${q._id}',this.value)">
                    ${Array.from({length:9},(_,i)=>i+2).map(n => `<option value="${n}" ${(q.rating_max||5)===n?'selected':''}>${n}</option>`).join('')}
                </select>
            </label>
        </div>` : ''}
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
                        min="1" max="${q.type==='rating'?(q.rating_max||5):10}"
                        value="${q.follow_up?.value ?? (q.type==='rating'?Math.ceil((q.rating_max||5)/2):5)}"
                        oninput="SurveysPage._updateFollowUp('${q._id}')">
                    <span style="font-size:.75rem;color:var(--text-muted)">${q.type==='rating'?'з '+(q.rating_max||5):'з 10'}</span>
                </div>
                <input class="sv-bld-q-input" id="sv-bq-fu-txt-${q._id}"
                    placeholder="Текст уточнюючого питання…"
                    value="${Fmt.esc(q.follow_up?.text||'')}"
                    oninput="SurveysPage._updateFollowUp('${q._id}')">
            </div>
        </div>` : ''}
        <div class="sv-bld-req-toggle-row">
            <label class="sv-bld-toggle-sw">
                Обов'язкове
                <input type="checkbox" id="sv-bq-req-${q._id}" ${q.is_required!==false?'checked':''}
                    onchange="SurveysPage._toggleRequired('${q._id}',this.checked)">
                <span class="sv-bld-toggle-sw-pill"><span class="sv-bld-toggle-sw-knob"></span></span>
            </label>
        </div>
    </div>
</div>`;
    },

    // ── Survey cover image ──────────────────────────────────────────
    _coverHtml() {
        if (this._builderCoverUrl) return `
        <div class="sv-bld-cover-preview">
            <img src="${Fmt.safeUrl(this._builderCoverUrl)}" alt="">
            <button class="sv-bld-cover-rm" onclick="SurveysPage._removeCover()" title="Видалити обкладинку"><i class="fa-solid fa-xmark"></i></button>
            <button class="sv-bld-cover-replace"><i class="fa-solid fa-image"></i> Змінити<input type="file" accept="image/*" onchange="SurveysPage._uploadCover(this)"></button>
        </div>`;
        return `
        <div class="sv-bld-cover-drop" title="Додати обкладинку опитування">
            <input type="file" accept="image/*" onchange="SurveysPage._uploadCover(this)">
            <i class="fa-solid fa-image"></i>
            <span>Додати обкладинку</span>
        </div>`;
    },

    async _uploadCover(input) {
        const file = input.files?.[0];
        if (!file) return;
        const wrap = document.getElementById('sv-bld-cover-wrap');
        if (wrap) wrap.innerHTML = `<div class="sv-bld-cover-drop" style="cursor:default"><div class="spinner"></div></div>`;
        try {
            const ext  = file.name.split('.').pop().toLowerCase();
            const path = `surveys/covers/${this._builderSurveyId || 'new'}/${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from(APP_CONFIG.buckets.testImages).upload(path, file, { upsert: true });
            if (error) throw error;
            this._builderCoverUrl = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.testImages}/${path}`;
        } catch(e) {
            Toast.error('Помилка завантаження', e.message);
        }
        if (wrap) wrap.innerHTML = this._coverHtml();
    },

    _removeCover() {
        this._builderCoverUrl = null;
        const wrap = document.getElementById('sv-bld-cover-wrap');
        if (wrap) wrap.innerHTML = this._coverHtml();
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
        const wrap = input.closest('.sv-bld-qcard')?.querySelector('.sv-bld-img-wrap');
        if (wrap) wrap.innerHTML = `<div style="padding:10px;text-align:center;font-size:.8rem;color:var(--text-muted)"><div class="spinner" style="margin:0 auto 6px"></div> Завантаження…</div>`;
        try {
            const ext  = file.name.split('.').pop().toLowerCase();
            const path = `surveys/${qid}/${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from(APP_CONFIG.buckets.testImages).upload(path, file, { upsert: true });
            if (error) throw error;
            const url = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.testImages}/${path}`;
            q.image_url = url;
            // re-render just the img preview
            if (wrap) wrap.innerHTML = `<div class="sv-bld-img-preview">
                <img src="${url}" alt="">
                <button class="sv-bld-img-rm" onclick="SurveysPage._removeQImage('${qid}')" title="Видалити зображення"><i class="fa-solid fa-xmark"></i></button>
            </div>`;
        } catch(e) {
            Toast.error('Помилка завантаження', e.message);
            if (wrap) wrap.innerHTML = '';
        }
    },

    _removeQImage(qid) {
        const q = this._builderQuestions.find(q => q._id === qid);
        if (!q) return;
        q.image_url = null;
        const wrap = document.querySelector(`#sv-bq-${qid} .sv-bld-img-wrap`);
        if (wrap) wrap.innerHTML = '';
    },

    // ── Import questions from text ──────────────────────────────────
    _importExampleText() {
        return [
            'Питання: Який ваш улюблений колір?',
            'Тип: одиночний',
            '- Червоний',
            '- Синій',
            '- Зелений',
            '',
            'Питання: Які фрукти ви любите?',
            'Тип: множинний',
            '- Яблуко',
            '- Банан',
            '- Апельсин',
            '',
            'Питання: Розкажіть про свій досвід роботи',
            'Тип: текст',
            '',
            'Питання: Оцініть якість сервісу',
            'Тип: зірки',
            'Максимум: 5',
        ].join('\n');
    },

    openImportQuestions() {
        const example = Fmt.esc(this._importExampleText());
        Modal.open({
            title: '<i class="fa-solid fa-file-import"></i> Імпорт питань',
            size: 'lg',
            body: `
                <style>
                .svimp-hint{font-size:.8rem;color:var(--text-muted);margin-bottom:10px;line-height:1.5}
                .svimp-ta{width:100%;min-height:220px;padding:10px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.82rem;line-height:1.5;outline:none;box-sizing:border-box;resize:vertical}
                .svimp-ta:focus{border-color:var(--primary)}
                .svimp-file-row{display:flex;align-items:center;gap:10px;margin:10px 0}
                .svimp-example{margin-top:12px}
                .svimp-example summary{cursor:pointer;font-size:.8rem;font-weight:600;color:var(--primary);user-select:none}
                .svimp-example pre{margin-top:8px;padding:12px 14px;background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;font-size:.76rem;line-height:1.6;white-space:pre-wrap;color:var(--text-secondary)}
                </style>
                <div class="svimp-hint">
                    Кожне питання — окремий блок, відокремлений порожнім рядком. Формат рядків: <b>Питання:</b>, <b>Тип:</b>
                    (одиночний / множинний / текст / зірки), варіанти відповіді рядками з «<b>-</b> », для зірок — необов'язковий
                    рядок <b>Максимум:</b> (за замовчуванням 5). Імпортовані питання додаються після вже наявних.
                </div>
                <div class="svimp-file-row">
                    <input type="file" accept=".txt" onchange="SurveysPage._importFilePicked(this)">
                </div>
                <textarea class="svimp-ta" id="svimp-text" placeholder="Вставте текст питань сюди…"></textarea>
                <details class="svimp-example">
                    <summary>Приклад оформлення документа</summary>
                    <pre>${example}</pre>
                </details>`,
            footer: `
                <button class="btn btn-ghost" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-primary" onclick="SurveysPage._confirmImportQuestions()">Імпортувати</button>`
        });
    },

    _importFilePicked(input) {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            const ta = document.getElementById('svimp-text');
            if (ta) ta.value = e.target.result;
        };
        reader.readAsText(file, 'utf-8');
    },

    _normalizeQType(raw) {
        const s = (raw || '').toLowerCase();
        if (s.includes('множин')) return 'multiple';
        if (s.includes('текст'))  return 'text';
        if (s.includes('зірк') || s.includes('зіроч') || s.includes('star') || s.includes('рейтинг')) return 'rating';
        if (s.includes('шкал') || s.includes('scale')) return 'scale';
        return 'single';
    },

    _parseImportText(text) {
        const blocks = text.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
        const parsed = [];
        for (const block of blocks) {
            let type = 'single', qText = '', options = [], max = 5, mode = null;
            for (const raw of block.split('\n')) {
                const line = raw.trim();
                if (!line) continue;
                const typeM = line.match(/^Тип\s*:\s*(.+)$/i);
                const qM    = line.match(/^Питання\s*:\s*(.+)$/i);
                const maxM  = line.match(/^Максимум\s*:\s*(\d+)/i);
                const optM  = line.match(/^-\s*(.+)$/);
                if (typeM)      { type = this._normalizeQType(typeM[1]); mode = null; }
                else if (qM)    { qText = qM[1].trim(); mode = 'question'; }
                else if (maxM)  { max = Math.max(2, Math.min(10, +maxM[1] || 5)); mode = null; }
                else if (optM)  { options.push(optM[1].trim()); mode = 'options'; }
                else if (mode === 'question') { qText += '\n' + line; }
            }
            if (!qText.trim()) continue;
            parsed.push({ type, text: qText.trim(), options, max });
        }
        return parsed;
    },

    async _confirmImportQuestions() {
        const raw = document.getElementById('svimp-text')?.value || '';
        const parsed = this._parseImportText(raw);
        if (!parsed.length) { Toast.error('Помилка', 'Не вдалося розпізнати жодного питання — перевірте формат'); return; }

        parsed.forEach(p => {
            const hasOpts = p.type === 'single' || p.type === 'multiple';
            this._builderQuestions.push({
                _id: Math.random().toString(36).slice(2),
                type: p.type,
                text: p.text,
                options: hasOpts ? (p.options.length ? p.options : ['','']) : [],
                is_required: true,
                rating_icon: 'star',
                rating_max: p.type === 'rating' ? p.max : 5,
                follow_up: null,
                image_url: null,
            });
        });

        const container = document.getElementById('sv-bld-qs');
        if (container) { container.innerHTML = this._builderQuestionsHtml(); this._autoGrowAll(container); }
        Modal.close();
        Toast.success('Імпортовано', `Додано питань: ${parsed.length}`);
        await this._autoSaveQuestions();
    },

    async _addQuestion(type) {
        const q = { _id: Math.random().toString(36).slice(2), type, text: '', options: type==='single'||type==='multiple'?['','']:[],is_required: true, rating_icon: 'star', rating_max: 5 };
        this._builderQuestions.push(q);
        const container = document.getElementById('sv-bld-qs');
        if (container) {
            const div = document.createElement('div');
            div.innerHTML = this._builderQCard(q, this._builderQuestions.length - 1);
            container.appendChild(div.firstElementChild);
        }
        await this._autoSaveQuestions();
    },

    // Silent autosave triggered by "Додати питання" — persists the survey (creating it
    // first if it doesn't exist yet) and its questions without navigating away like the
    // manual "Зберегти" button does. No-op until a title is set, since there's nothing
    // to attach the questions to yet.
    async _autoSaveQuestions() {
        const title = document.getElementById('sb-title')?.value.trim();
        if (!title) return;

        this._builderQuestions.forEach(q => {
            const inp = document.getElementById(`sv-bq-text-${q._id}`);
            if (inp) q.text = inp.value;
        });

        const qs = this._builderQuestions.map(q => {
            const isCondType = q.type === 'rating' || q.type === 'scale';
            let options = q.options || [];
            if (isCondType) {
                options = q.follow_up ? { follow_up: q.follow_up } : {};
                if (q.type === 'rating') { options.icon = q.rating_icon || 'star'; options.max = q.rating_max || 5; }
            }
            return {
                text:        q.text,
                type:        q.type,
                options,
                is_required: q.is_required !== false,
                image_url:   q.image_url || null,
            };
        }).filter(q => q.text.trim());

        try {
            let surveyId = this._builderSurveyId;
            if (!surveyId) {
                const fields = {
                    title,
                    description:  document.getElementById('sb-desc')?.value.trim() || null,
                    is_published: document.getElementById('sb-pub')?.checked || false,
                };
                const survey = await API.surveys.create(fields);
                surveyId = survey.id;
                this._builderSurveyId = surveyId;
            }
            await API.surveys.saveQuestions(surveyId, qs);
        } catch(e) {
            Toast.error('Помилка автозбереження', e.message);
        }
    },

    _autoGrow(el) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    },

    _autoGrowAll(root) {
        (root || document).querySelectorAll('.sv-bld-q-input').forEach(t => this._autoGrow(t));
    },

    _removeQuestion(id) {
        this._builderQuestions = this._builderQuestions.filter(q => q._id !== id);
        document.getElementById(`sv-bq-${id}`)?.remove();
    },

    _duplicateQuestion(id) {
        const idx = this._builderQuestions.findIndex(q => q._id === id);
        if (idx === -1) return;
        const orig = this._builderQuestions[idx];
        const copy = {
            ...orig,
            _id: Math.random().toString(36).slice(2),
            options: Array.isArray(orig.options) ? [...orig.options] : orig.options,
            follow_up: orig.follow_up ? { ...orig.follow_up } : null,
        };
        this._builderQuestions.splice(idx + 1, 0, copy);
        const container = document.getElementById('sv-bld-qs');
        if (container) { container.innerHTML = this._builderQuestionsHtml(); this._autoGrowAll(container); }
    },

    _changeQType(id, type) {
        const q = this._builderQuestions.find(q => q._id === id);
        if (!q) return;
        q.type = type;
        if (type === 'single' || type === 'multiple') q.options = q.options?.length ? q.options : ['',''];
        if (type === 'rating') { q.rating_icon = q.rating_icon || 'star'; q.rating_max = q.rating_max || 5; }
        const card = document.getElementById(`sv-bq-${id}`);
        if (card) {
            const i = this._builderQuestions.findIndex(q => q._id === id);
            card.outerHTML = this._builderQCard(q, i);
            this._autoGrow(document.getElementById(`sv-bq-text-${id}`));
        }
    },

    _setRatingIcon(id, icon) {
        const q = this._builderQuestions.find(q => q._id === id);
        if (!q) return;
        q.rating_icon = icon;
        const card = document.getElementById(`sv-bq-${id}`);
        if (card) {
            const i = this._builderQuestions.findIndex(q => q._id === id);
            card.outerHTML = this._builderQCard(q, i);
            this._autoGrow(document.getElementById(`sv-bq-text-${id}`));
        }
    },

    _setRatingMax(id, val) {
        const q = this._builderQuestions.find(q => q._id === id);
        if (q) q.rating_max = +val;
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
        q.follow_up = enabled ? { operator: 'lte', value: q.type === 'rating' ? Math.ceil((q.rating_max||5)/2) : 5, text: '' } : null;
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
            value:    +(document.getElementById(`sv-bq-fu-val-${id}`)?.value || (q.type === 'rating' ? Math.ceil((q.rating_max||5)/2) : 5)),
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
        if (container) { container.innerHTML = this._builderQuestionsHtml(); this._autoGrowAll(container); }
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

        // is_anonymous / cover_image / deadline_at are managed exclusively by the settings
        // view (SurveysPage.openSurveySettings) — not touched here, so a builder save can't
        // silently reset them for an existing survey.
        const fields = {
            title,
            description:  document.getElementById('sb-desc')?.value.trim() || null,
            is_published: document.getElementById('sb-pub')?.checked || false,
        };

        Loader.show();
        try {
            const survey = id
                ? await API.surveys.update(id, fields)
                : await API.surveys.create(fields);

            const qs = this._builderQuestions.map(q => {
                const isCondType = q.type === 'rating' || q.type === 'scale';
                let options = q.options || [];
                if (isCondType) {
                    options = q.follow_up ? { follow_up: q.follow_up } : {};
                    if (q.type === 'rating') { options.icon = q.rating_icon || 'star'; options.max = q.rating_max || 5; }
                }
                return {
                    text:        q.text,
                    type:        q.type,
                    options,
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
            const [allEmployees, assigned, survey, questions, { responses }] = await Promise.all([
                supabase.from('profiles')
                    .select('id,full_name,email,job_position,manager_id,is_active,avatar_url')
                    .order('full_name').then(r => r.data || []),
                API.surveys.getAssignments(surveyId),
                API.surveys.getById(surveyId),
                API.surveys.getQuestions(surveyId),
                API.surveys.getResults(surveyId)
            ]);
            this._renderAssign(area, survey, questions, allEmployees, assigned, responses);
        } catch(e) { Toast.error('Помилка', e.message); this._backToList(); }
        finally { Loader.hide(); }
    },

    _renderAssign(area, survey, questions, allEmployees, assigned, responses) {
        this._builderSurveyId = survey.id;
        const assignedMap  = new Map(assigned.map(a => [a.user_id, a]));
        const respondedSet = new Set((responses || []).map(r => r.user_id).filter(Boolean));
        const deadlines    = assigned.map(a => a.deadline_at).filter(Boolean);
        const commonDl     = deadlines.length && deadlines.every(d => d === deadlines[0])
            ? new Date(deadlines[0]).toISOString().slice(0, 16) : '';
        // Snapshot for _doAssign — comparing against this (rather than trusting a dataset
        // flag set by the picker's onchange chain) reliably detects an actual edit.
        this._asgnOriginalDeadline = commonDl;

        let employees = allEmployees.filter(e => e.is_active !== false);
        if (!AppState.isAdmin()) {
            employees = employees.filter(e => e.manager_id === AppState.user.id);
        }

        const positions     = [...new Set(employees.map(e => e.job_position).filter(Boolean))].sort();
        const mgrIds        = [...new Set(employees.map(e => e.manager_id).filter(Boolean))];
        const managers      = mgrIds.map(mid => allEmployees.find(e => e.id === mid)).filter(Boolean);
        const showMgrFilter = AppState.isAdmin() && managers.length > 0;
        const filterCols    = 1 + (positions.length ? 1 : 0) + (showMgrFilter ? 1 : 0);
        const mgrNameById   = new Map(managers.map(m => [m.id, m.full_name]));

        this._asgnAvatarColors  = ['#2563eb','#0d9488','#ec4899','#10b981','#f59e0b','#06b6d4','#3b82f6','#f43f5e'];
        this._asgnAnonymous     = !!survey.is_anonymous;
        this._asgnRespondedSet  = respondedSet;

        area.innerHTML = `<style>
.svasgn-page{display:flex;flex-direction:column;height:calc(100vh - 120px)}
.svasgn-hero{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:18px;flex-shrink:0}
.svasgn-hero-icon{width:32px;height:32px;border-radius:9px;background:var(--primary-glow);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0}
.svasgn-hero-title{font-size:1.02rem;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.svasgn-main-row{display:flex;gap:16px;flex:1;min-height:0}
.svasgn-right-col{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}
.svasgn-cards-col{display:flex;flex-direction:column;gap:12px;flex:0 1 340px;max-width:380px;overflow-y:auto}
.svasgn-card{border:1px solid var(--border);border-radius:14px;background:var(--bg-surface);padding:14px 16px}
.svasgn-card-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.svasgn-card-ico{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0}
.svasgn-card-title{font-size:.85rem;font-weight:700;color:var(--text-primary)}
.svasgn-card-sub{font-size:.7rem;color:var(--text-muted);margin-top:1px}
.svasgn-card-line{display:flex;align-items:center;gap:8px;font-size:.78rem;color:var(--text-secondary);margin-bottom:6px}
.svasgn-card-line:last-child{margin-bottom:0}
.svasgn-card-line i{width:14px;color:var(--text-muted);flex-shrink:0}
.svasgn-card-line b{color:var(--text-primary);font-weight:700;margin-left:auto}
.svasgn-avatar-stack{display:flex;align-items:center}
.svasgn-avatar-stack .svasgn-avatar{margin-left:-8px;border:2px solid var(--bg-surface)}
.svasgn-avatar-stack .svasgn-avatar:first-child{margin-left:0}
.svasgn-avatar-more{background:var(--bg-raised)!important;color:var(--text-muted)!important;border:2px solid var(--bg-surface)}
.svasgn-mini-stats{display:flex;gap:14px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
.svasgn-mini-stat{display:flex;flex-direction:column;gap:1px}
.svasgn-mini-stat b{font-size:1.05rem;font-weight:800;color:var(--text-primary);line-height:1.1}
.svasgn-mini-stat span{font-size:.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em}
.svasgn-mini-stat.pass b{color:#10b981}
.svasgn-mini-stat.new b{color:var(--primary)}
.svasgn-dl-presets{display:flex;gap:5px;margin-top:6px}
.svasgn-dl-presets button{padding:3px 9px;border-radius:9999px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-muted);font-size:.68rem;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit}
.svasgn-dl-presets button:hover{border-color:var(--primary);color:var(--primary)}

.svasgn-controls{flex-shrink:0}
.svasgn-filters{display:grid;gap:8px;margin-bottom:10px}
.svasgn-search-wrap{display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);transition:border-color .15s}
.svasgn-search-wrap:focus-within{border-color:var(--primary)}
.svasgn-search-wrap i{color:var(--text-muted);font-size:.82rem;flex-shrink:0}
.svasgn-search-inp{flex:1;min-width:0;border:none!important;background:transparent!important;color:var(--text-primary)!important;font-size:.84rem;outline:none!important;padding:8px 0!important;font-family:inherit}
.svasgn-select{padding:8px 30px 8px 12px;border-radius:10px;border:1.5px solid var(--border);background-color:var(--bg-surface);color:var(--text-primary);font-size:.84rem;outline:none;appearance:none;cursor:pointer;font-family:inherit;transition:border-color .15s}
.svasgn-select:focus{border-color:var(--primary)}
.svasgn-reset-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.82rem;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit}
.svasgn-reset-btn:hover{border-color:var(--primary);color:var(--primary)}

.svasgn-selline{display:flex;align-items:center;gap:14px;margin-bottom:10px;flex-wrap:wrap}
.svasgn-selline-txt{font-size:.84rem;color:var(--text-secondary)}
.svasgn-selline-txt b{color:var(--text-primary);font-weight:800}
.svasgn-link-btn{background:none;border:none;color:var(--primary);font-size:.8rem;font-weight:600;cursor:pointer;padding:0;font-family:inherit}
.svasgn-link-btn:hover{text-decoration:underline}
.svasgn-bulk-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit;margin-left:auto}
.svasgn-bulk-btn:hover{border-color:var(--primary);color:var(--primary)}

.svasgn-list-wrap{flex:1;overflow-y:auto;border:1px solid var(--border);border-radius:14px;min-height:0;background:var(--bg-surface)}
.svasgn-list-head{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-raised);border-bottom:1px solid var(--border);font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);position:sticky;top:0}
.svasgn-col-cbav{width:60px;flex-shrink:0}
.svasgn-col-name{flex:1;min-width:0}
.svasgn-col-pos{width:170px;flex-shrink:0}
.svasgn-col-mgr{width:170px;flex-shrink:0}
.svasgn-col-status{width:160px;flex-shrink:0;text-align:right}
@media(max-width:1000px){.svasgn-col-mgr{display:none}}
@media(max-width:820px){.svasgn-col-pos{display:none}}
.svasgn-item{display:flex;align-items:center;gap:12px;padding:9px 14px;border-bottom:1px solid var(--border);border-left:3px solid transparent;cursor:pointer;transition:background .12s,border-color .12s}
.svasgn-item:last-child{border-bottom:none}
.svasgn-item:hover{background:var(--bg-hover)}
.svasgn-cbav{width:60px;flex-shrink:0;display:flex;align-items:center;gap:8px}
.svasgn-cb{width:17px;height:17px;cursor:pointer;flex-shrink:0;accent-color:var(--primary)}
.svasgn-avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.7rem;font-weight:700;flex-shrink:0;object-fit:cover}
.svasgn-emp-name{font-weight:600;font-size:.87rem;color:var(--text-primary)}
.svasgn-emp-pos-col{width:170px;flex-shrink:0;font-size:.8rem;color:var(--text-secondary)}
.svasgn-emp-mgr-col{width:170px;flex-shrink:0;font-size:.8rem;color:var(--text-secondary)}
@media(max-width:1000px){.svasgn-emp-mgr-col{display:none}}
@media(max-width:820px){.svasgn-emp-pos-col{display:none}}
.svasgn-col-status2{width:160px;flex-shrink:0;display:flex;justify-content:flex-end;align-items:center;gap:6px}
.svasgn-badge{font-size:.66rem;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0}
.svasgn-badge-pass{background:rgba(16,185,129,.12);color:#10b981}
.svasgn-badge-none{background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border)}
.svasgn-dl-txt{font-size:.68rem;color:var(--text-muted);white-space:nowrap;flex-shrink:0}

.svasgn-foot{display:flex;flex-direction:column;gap:8px}
.svasgn-cancel{padding:11px 20px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.85rem;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit;width:100%}
.svasgn-cancel:hover{border-color:var(--border-light);color:var(--text-primary)}
.svasgn-save{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 65%,#1e3a8a));color:#fff;font-size:.9rem;font-weight:700;cursor:pointer;transition:all .18s;box-shadow:0 4px 14px var(--primary-glow);font-family:inherit;width:100%}
.svasgn-save:hover{transform:translateY(-1px);box-shadow:0 6px 20px var(--primary-glow)}
.svasgn-remind{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;border-radius:12px;border:1.5px solid #f59e0b;background:transparent;color:#f59e0b;font-size:.85rem;font-weight:700;cursor:pointer;transition:all .18s;font-family:inherit;width:100%}
.svasgn-remind:hover{background:rgba(245,158,11,.12)}
.svasgn-remind:disabled{opacity:.5;cursor:not-allowed}
</style>
<div class="svasgn-page">
    <div class="svasgn-hero">
        <button class="btn-back" onclick="SurveysPage._backToList()"><i class="fa-solid fa-arrow-left"></i> Назад</button>
        <div class="svasgn-hero-icon"><i class="fa-solid fa-user-group"></i></div>
        <span class="svasgn-hero-title">${Fmt.esc(survey.title)}</span>
    </div>
    <div class="svasgn-main-row">
        <div class="svasgn-right-col">
            <div class="svasgn-controls">
                <div class="svasgn-filters" style="grid-template-columns:repeat(${filterCols},1fr) auto">
                    <div class="svasgn-search-wrap">
                        <i class="fa-solid fa-magnifying-glass"></i>
                        <input id="sv-asgn-search" class="svasgn-search-inp" type="text" placeholder="Пошук за іменем…" oninput="SurveysPage._applyAssignFilters()">
                    </div>
                    ${positions.length ? `
                    <select id="sv-asgn-pos" class="svasgn-select" onchange="SurveysPage._applyAssignFilters()">
                        <option value="">Всі посади</option>
                        ${positions.map(p => `<option value="${p.toLowerCase()}">${Fmt.esc(p)}</option>`).join('')}
                    </select>` : ''}
                    ${showMgrFilter ? `
                    <select id="sv-asgn-mgr" class="svasgn-select" onchange="SurveysPage._applyAssignFilters()">
                        <option value="">Всі керівники</option>
                        ${managers.map(m => `<option value="${m.id}">${Fmt.esc(m.full_name||m.email)}</option>`).join('')}
                    </select>` : ''}
                    <button type="button" class="svasgn-reset-btn" onclick="SurveysPage._resetAssignFilters()"><i class="fa-solid fa-arrow-rotate-left"></i> Скинути фільтри</button>
                </div>
                <div class="svasgn-selline">
                    <span class="svasgn-selline-txt" id="sv-asgn-count">Вибрано: <b>0</b> з ${employees.length}</span>
                    <button type="button" class="svasgn-link-btn" onclick="SurveysPage._selectAllFiltered(false)">Очистити вибір</button>
                    <button type="button" class="svasgn-bulk-btn" onclick="SurveysPage._selectAllFiltered(true)"><i class="fa-solid fa-square-check"></i> Вибрати всіх видимих</button>
                </div>
            </div>
            <div class="svasgn-list-wrap">
                <div class="svasgn-list-head">
                    <span class="svasgn-col-cbav"></span>
                    <span class="svasgn-col-name">Співробітник</span>
                    <span class="svasgn-col-pos">Посада</span>
                    <span class="svasgn-col-mgr">Керівник</span>
                    <span class="svasgn-col-status">Статус</span>
                </div>
                ${employees.map((e, i) => {
                    const a       = assignedMap.get(e.id);
                    const dlTxt   = a?.deadline_at ? `до ${Fmt.dateShort(a.deadline_at)}` : '';
                    const done    = respondedSet.has(e.id);
                    const statusHtml = this._asgnAnonymous ? ''
                        : done ? `<span class="svasgn-badge svasgn-badge-pass"><i class="fa-solid fa-check"></i> Пройшов</span>`
                        : a    ? `<span class="svasgn-badge svasgn-badge-none"><i class="fa-solid fa-pause"></i> Не проходив</span>` : '';
                    const avColor = this._asgnAvatarColors[i % this._asgnAvatarColors.length];
                    const mgrName = mgrNameById.get(e.manager_id) || '';
                    return `
                <label class="svasgn-item"
                    data-name="${Fmt.esc((e.full_name||e.email||'').toLowerCase())}"
                    data-pos="${Fmt.esc((e.job_position||'').toLowerCase())}"
                    data-mgr="${e.manager_id||''}">
                    <span class="svasgn-cbav">
                        <input type="checkbox" class="svasgn-cb" value="${e.id}" ${a?'checked':''} data-was-assigned="${!!a}"
                            onchange="SurveysPage._updateAssignCount()" onclick="event.stopPropagation()">
                        ${e.avatar_url
                            ? `<img class="svasgn-avatar" src="${Fmt.esc(e.avatar_url)}" alt="">`
                            : `<div class="svasgn-avatar" style="background:${avColor}">${Fmt.esc(Fmt.initials(e.full_name||e.email))}</div>`}
                    </span>
                    <div class="svasgn-emp-name" style="flex:1;min-width:0">${Fmt.esc(e.full_name||e.email)}</div>
                    <div class="svasgn-emp-pos-col">${Fmt.esc(e.job_position||'—')}</div>
                    <div class="svasgn-emp-mgr-col">${Fmt.esc(mgrName||'—')}</div>
                    <div class="svasgn-col-status2">
                        ${statusHtml}
                        ${a && dlTxt ? `<span class="svasgn-dl-txt">${dlTxt}</span>` : ''}
                    </div>
                </label>`;
                }).join('')}
            </div>
        </div>
        <div class="svasgn-cards-col">
            <div class="svasgn-card">
                <div class="svasgn-card-head">
                    <div class="svasgn-card-ico" style="background:rgba(59,130,246,.12);color:#3b82f6"><i class="fa-solid fa-square-poll-horizontal"></i></div>
                    <div><div class="svasgn-card-title">Про опитування</div><div class="svasgn-card-sub">Призначення опитування співробітникам</div></div>
                </div>
                <div class="svasgn-card-line"><i class="fa-solid fa-question"></i> Кількість питань <b>${questions.length}</b></div>
                <div class="svasgn-card-line"><i class="fa-solid fa-globe"></i> Статус <b>${survey.is_published ? 'Опубліковано' : 'Чернетка'}</b></div>
                <div class="svasgn-card-line"><i class="fa-solid fa-user-secret"></i> Анонімне <b>${survey.is_anonymous ? 'Так' : 'Ні'}</b></div>
            </div>
            <div class="svasgn-card">
                <div class="svasgn-card-head">
                    <div class="svasgn-card-ico" style="background:rgba(13,148,136,.12);color:#0d9488"><i class="fa-solid fa-user-group"></i></div>
                    <div><div class="svasgn-card-title">Кому призначити</div><div class="svasgn-card-sub" id="svasgn-assign-to-sub">Обрано співробітників: 0</div></div>
                </div>
                <div class="svasgn-avatar-stack" id="svasgn-avatar-stack"></div>
                <div class="svasgn-mini-stats">
                    <div class="svasgn-mini-stat"><b id="svasgn-sum-sel">0</b><span>Вибрано</span></div>
                    <div class="svasgn-mini-stat pass"><b id="svasgn-sum-pass">0</b><span>Пройшли</span></div>
                    <div class="svasgn-mini-stat new"><b id="svasgn-sum-new">0</b><span>Нові</span></div>
                </div>
            </div>
            <div class="svasgn-card">
                <div class="svasgn-card-head">
                    <div class="svasgn-card-ico" style="background:rgba(6,182,212,.12);color:#06b6d4"><i class="fa-regular fa-calendar"></i></div>
                    <div><div class="svasgn-card-title">Терміни</div><div class="svasgn-card-sub">Дедлайн для проходження</div></div>
                </div>
                ${UaDateTime.html('sv-asgn-deadline', commonDl)}
                <div class="svasgn-dl-presets">
                    <button type="button" onclick="SurveysPage._setAssignDeadlinePreset(1)">+1 день</button>
                    <button type="button" onclick="SurveysPage._setAssignDeadlinePreset(3)">+3 дні</button>
                    <button type="button" onclick="SurveysPage._setAssignDeadlinePreset(7)">+тиждень</button>
                </div>
            </div>
            <div class="svasgn-foot">
                <button class="svasgn-save" onclick="SurveysPage._doAssign('${survey.id}')"><i class="fa-regular fa-floppy-disk"></i> Призначити</button>
                ${!this._asgnAnonymous ? `<button type="button" class="svasgn-remind" onclick="SurveysPage._remindInactive('${survey.id}',this)"><i class="fa-regular fa-bell"></i> Нагадати неактивним</button>` : ''}
                <button type="button" class="svasgn-cancel" onclick="SurveysPage._backToList()">Скасувати</button>
            </div>
        </div>
    </div>
</div>`;
        this._updateAssignCount();
    },

    _resetAssignFilters() {
        const s = document.getElementById('sv-asgn-search'); if (s) s.value = '';
        const p = document.getElementById('sv-asgn-pos');    if (p) p.value = '';
        const m = document.getElementById('sv-asgn-mgr');    if (m) m.value = '';
        this._applyAssignFilters();
    },

    _applyAssignFilters() {
        const query = (document.getElementById('sv-asgn-search')?.value || '').trim().toLowerCase();
        const pos   = (document.getElementById('sv-asgn-pos')?.value   || '');
        const mgr   = (document.getElementById('sv-asgn-mgr')?.value   || '');
        document.querySelectorAll('.svasgn-item').forEach(el => {
            const ok = (!query || el.dataset.name.includes(query))
                    && (!pos   || el.dataset.pos === pos)
                    && (!mgr   || el.dataset.mgr === mgr);
            el.style.display = ok ? 'flex' : 'none';
        });
        this._updateAssignCount();
    },

    _setAssignDeadlinePreset(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        const p = n => String(n).padStart(2, '0');
        if (!document.getElementById('sv-asgn-deadline')) return;
        UaDateTime.set('sv-asgn-deadline', `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`);
    },

    // Нагадування призначеним, які ще не пройшли опитування
    async _remindInactive(surveyId, btn) {
        const targets = [...document.querySelectorAll('.svasgn-item input[type=checkbox]')]
            .filter(cb => cb.dataset.wasAssigned === 'true' && !this._asgnRespondedSet?.has(cb.value))
            .map(cb => cb.value);
        if (!targets.length) { Toast.info('Нікому нагадувати', 'Всі призначені вже пройшли опитування'); return; }
        const ok = await Modal.confirm({
            title: 'Нагадування',
            message: `Надіслати нагадування ${targets.length} співробітникам, які ще не пройшли опитування?`,
            confirmText: 'Надіслати'
        });
        if (!ok) return;
        btn.disabled = true;
        try {
            const survey = this._surveys.find(s => s.id === surveyId);
            const title  = survey?.title || 'Опитування';
            const { error } = await supabase.from('notifications').insert(targets.map(uid => ({
                user_id: uid, type: 'survey_assigned',
                title:   `Нагадування: пройдіть опитування «${title}»`,
                message: title,
                link:    'expert-path?tab=surveys'
            })));
            if (error) throw error;
            Toast.success('Надіслано', `Нагадування отримають ${targets.length} співробітників`);
        } catch(e) {
            Toast.error('Помилка', e.message);
            btn.disabled = false;
        }
    },

    _selectAllFiltered(checked) {
        document.querySelectorAll('.svasgn-item').forEach(el => {
            if (el.style.display === 'none') return;
            const cb = el.querySelector('input[type=checkbox]');
            if (cb) cb.checked = checked;
        });
        this._updateAssignCount();
    },

    _updateAssignCount() {
        const all     = [...document.querySelectorAll('.svasgn-item input[type=checkbox]')];
        const visible = all.filter(c => c.closest('.svasgn-item').style.display !== 'none');
        const selCbs  = visible.filter(c => c.checked);
        const sel     = selCbs.length;

        const countEl = document.getElementById('sv-asgn-count');
        if (countEl) countEl.innerHTML = `Вибрано: <b>${sel}</b> з ${visible.length}`;
        const subEl = document.getElementById('svasgn-assign-to-sub');
        if (subEl) subEl.textContent = `Обрано співробітників: ${sel}`;

        const passCount = selCbs.filter(c => !this._asgnAnonymous && this._asgnRespondedSet?.has(c.value)).length;
        const newCount  = selCbs.filter(c => c.dataset.wasAssigned === 'false').length;
        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setTxt('svasgn-sum-sel',  sel);
        setTxt('svasgn-sum-pass', passCount);
        setTxt('svasgn-sum-new',  newCount);

        const stack = document.getElementById('svasgn-avatar-stack');
        if (stack) {
            const shown = selCbs.slice(0, 6);
            const extra = sel - shown.length;
            stack.innerHTML = shown.map(cb => {
                const item = cb.closest('.svasgn-item');
                const av   = item?.querySelector('.svasgn-avatar');
                return av ? av.outerHTML : '';
            }).join('') + (extra > 0 ? `<div class="svasgn-avatar svasgn-avatar-more">+${extra}</div>` : '');
        }
    },

    async _doAssign(surveyId) {
        const checkboxes      = [...document.querySelectorAll('.svasgn-item input[type=checkbox]')];
        const deadlineRaw     = Dom.val('sv-asgn-deadline');
        const deadlineIso     = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;
        const deadlineChanged = deadlineRaw !== (this._asgnOriginalDeadline || '');

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
                            link: 'expert-path?tab=surveys'
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
        // Entered via the surveys/:id route (same launch pattern as tests' "Пройти тест") —
        // this._surveys may never have been loaded (e.g. a cold/bookmarked URL), so navigate
        // back via the router instead of an in-memory re-render that could show an empty list.
        if (this._standaloneTake) { Router.go('expert-path'); return; }
        const area = document.getElementById('ep-content');
        if (area) this._renderList(area);
    },
};
