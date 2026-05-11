// ================================================================
// LMS — Управління тестами (адмін/менеджер) + Мої тести (користувач)
//
// Повна схема БД (запускати при чистому розгортанні):
//
// DROP TABLE IF EXISTS attempt_answers  CASCADE;
// DROP TABLE IF EXISTS test_assignments CASCADE;
// DROP TABLE IF EXISTS test_attempts    CASCADE;
// DROP TABLE IF EXISTS answers          CASCADE;
// DROP TABLE IF EXISTS questions        CASCADE;
// DROP TABLE IF EXISTS tests            CASCADE;
//
// CREATE TABLE tests (
//     id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//     course_id           uuid        REFERENCES courses(id) ON DELETE CASCADE,
//     title               text        NOT NULL,
//     description         text,
//     instructions        text,
//     passing_score       integer     NOT NULL DEFAULT 70,
//     max_attempts        integer     DEFAULT 3,
//     time_limit_minutes  integer,
//     order_index         integer     DEFAULT 0,
//     is_published        boolean     DEFAULT false,
//     randomize_questions boolean     DEFAULT false,
//     show_results        boolean     DEFAULT true,
//     created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
//     created_at          timestamptz DEFAULT now()
// );
// ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "tests_select" ON tests FOR SELECT USING (true);
// CREATE POLICY "tests_insert" ON tests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
// CREATE POLICY "tests_update" ON tests FOR UPDATE USING (auth.uid() IS NOT NULL);
// CREATE POLICY "tests_delete" ON tests FOR DELETE USING (auth.uid() IS NOT NULL);
//
// CREATE TABLE questions (
//     id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//     test_id       uuid        NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
//     question_text text        NOT NULL DEFAULT '',
//     question_type text        NOT NULL DEFAULT 'single',
//     points        integer     NOT NULL DEFAULT 1,
//     order_index   integer     DEFAULT 0,
//     explanation   text,
//     created_at    timestamptz DEFAULT now()
// );
// ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "questions_select" ON questions FOR SELECT USING (true);
// CREATE POLICY "questions_insert" ON questions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
// CREATE POLICY "questions_update" ON questions FOR UPDATE USING (auth.uid() IS NOT NULL);
// CREATE POLICY "questions_delete" ON questions FOR DELETE USING (auth.uid() IS NOT NULL);
//
// CREATE TABLE answers (
//     id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
//     question_id uuid    NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
//     answer_text text    NOT NULL DEFAULT '',
//     is_correct  boolean DEFAULT false,
//     order_index integer DEFAULT 0
// );
// ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "answers_select" ON answers FOR SELECT USING (true);
// CREATE POLICY "answers_insert" ON answers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
// CREATE POLICY "answers_update" ON answers FOR UPDATE USING (auth.uid() IS NOT NULL);
// CREATE POLICY "answers_delete" ON answers FOR DELETE USING (auth.uid() IS NOT NULL);
//
// CREATE TABLE test_attempts (
//     id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//     test_id            uuid        NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
//     user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
//     attempt_number     integer     DEFAULT 1,
//     score              numeric     DEFAULT 0,
//     max_score          numeric     DEFAULT 0,
//     percentage         numeric     DEFAULT 0,
//     passed             boolean     DEFAULT false,
//     time_spent_seconds integer,
//     started_at         timestamptz DEFAULT now(),
//     completed_at       timestamptz
// );
// ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "tattempts_select" ON test_attempts FOR SELECT USING (auth.uid() IS NOT NULL);
// CREATE POLICY "tattempts_insert" ON test_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
// CREATE POLICY "tattempts_update" ON test_attempts FOR UPDATE USING (auth.uid() = user_id);
//
// CREATE TABLE attempt_answers (
//     id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
//     attempt_id          uuid    NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
//     question_id         uuid    NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
//     selected_answer_ids uuid[]  DEFAULT '{}',
//     is_correct          boolean DEFAULT false,
//     points_earned       numeric DEFAULT 0
// );
// ALTER TABLE attempt_answers ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "aansw_select" ON attempt_answers FOR SELECT USING (auth.uid() IS NOT NULL);
// CREATE POLICY "aansw_insert" ON attempt_answers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
//
// CREATE TABLE test_assignments (
//     id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
//     test_id     uuid        NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
//     user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
//     assigned_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
//     deadline_at timestamptz,
//     created_at  timestamptz DEFAULT now(),
//     UNIQUE(test_id, user_id)
// );
// ALTER TABLE test_assignments ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "tassign_select" ON test_assignments FOR SELECT USING (auth.uid() IS NOT NULL);
// CREATE POLICY "tassign_insert" ON test_assignments FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
// CREATE POLICY "tassign_delete" ON test_assignments FOR DELETE USING (auth.uid() IS NOT NULL);
// ================================================================

// ── API extensions ────────────────────────────────────────────────
const TestsManagerAPI = {
    async getAllStandalone() {
        const { data, error } = await supabase.from('tests')
            .select('*, questions(id)')
            .is('course_id', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getMyAssignments() {
        const { data, error } = await supabase.from('test_assignments')
            .select(`*, test:tests(id,title,description,time_limit_minutes,max_attempts,randomize_questions,
                questions(id))`)
            .eq('user_id', AppState.user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getAssignments(testId) {
        const { data, error } = await supabase.from('test_assignments')
            .select('*, user:profiles!user_id(id,full_name,email,job_position)')
            .eq('test_id', testId);
        if (error) throw error;
        return data || [];
    },

    async assign(testId, userIds, deadlineAt) {
        const rows = userIds.map(uid => ({
            test_id: testId, user_id: uid,
            assigned_by: AppState.user.id,
            deadline_at: deadlineAt || null
        }));
        const { error } = await supabase.from('test_assignments')
            .upsert(rows, { onConflict: 'test_id,user_id', ignoreDuplicates: false });
        if (error) throw error;
    },

    async unassign(testId, userId) {
        const { error } = await supabase.from('test_assignments')
            .delete().eq('test_id', testId).eq('user_id', userId);
        if (error) throw error;
    },

    async getAllResults(testId) {
        const { data, error } = await supabase.from('test_attempts')
            .select('*, user:profiles!user_id(full_name,email,job_position)')
            .eq('test_id', testId)
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getAllEmployees() {
        const { data, error } = await supabase.from('profiles')
            .select('id, full_name, email, job_position, manager_id')
            .in('role', ['user', 'teacher', 'smm', 'manager', 'admin', 'owner'])
            .order('full_name');
        if (error) throw error;
        return data || [];
    },

    async getPositions() {
        const { data, error } = await supabase.from('profiles')
            .select('job_position')
            .in('role', ['user', 'teacher', 'smm', 'manager'])
            .not('job_position', 'is', null)
            .neq('job_position', '');
        if (error) throw error;
        return [...new Set((data || []).map(p => p.job_position))].sort();
    },

    async getAttemptsSummary(testId) {
        const { data, error } = await supabase.from('test_attempts')
            .select('user_id, passed, completed_at')
            .eq('test_id', testId)
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false });
        if (error) return new Map();
        const map = new Map();
        for (const a of (data || [])) {
            if (!map.has(a.user_id)) map.set(a.user_id, a);
        }
        return map;
    }
};

// ================================================================
// TestsManagerPage — адмін / менеджер
// ================================================================
const TestsManagerPage = {
    _tests:     [],
    _curTest:   null,
    _questions: [],
    _activeIdx: -1,
    _quill:     null,
    _opts:      [],
    _qType:     'single',
    _dirty:          false,
    _quillSetupDone: false,
    _pendingCoverFile: null,
    _coverImageUrl:    null,
    _container:        null,

    async init(container, params = {}) {
        if (!AppState.canSchedule() && !AppState.isStaff()) {
            Router.go('dashboard'); return;
        }
        UI.setBreadcrumb([{ label: 'Адміністрування', route: 'admin' }, { label: 'Тести' }]);
        const testId = params.test;
        if (testId) await this._openEditorById(container, testId);
        else         await this._renderList(container);
    },

    // ── List ─────────────────────────────────────────────────────

    async _renderList(container) {
        this._container = container;
        this._prevView  = 'list';
        this._curTest   = null;
        this._questions = [];
        this._activeIdx = -1;
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            this._tests = await TestsManagerAPI.getAllStandalone();
        } catch(e) { this._tests = []; }

        container.innerHTML = `
<style>

.tm-hero{border-radius:22px;padding:32px 36px;margin-bottom:24px;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1e40af 100%);position:relative;overflow:hidden}
.tm-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 80% at 80% 20%,rgba(201,162,39,.18),transparent);pointer-events:none}
.tm-hero-inner{position:relative;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.tm-hero-left{display:flex;align-items:center;gap:18px}
.tm-hero-icon{width:60px;height:60px;border-radius:18px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:1.9rem;flex-shrink:0;color:#fff}
.tm-hero-title{margin:0;font-size:1.7rem;font-weight:800;color:#fff;letter-spacing:-.03em}
.tm-hero-sub{margin:4px 0 0;color:rgba(255,255,255,.65);font-size:.88rem}
.tm-btn-new{display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:12px;background:#C9A227;border:none;color:#fff;font-size:.9rem;font-weight:700;cursor:pointer;transition:background .15s;flex-shrink:0}
.tm-btn-new:hover{background:#b8911f}

.tm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:16px;animation:tm-in .3s ease}
@keyframes tm-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.tm-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .2s,transform .2s;cursor:pointer}
.tm-card:hover{box-shadow:0 8px 28px rgba(0,0,0,.12);transform:translateY(-2px)}
.tm-card-top{height:4px;background:linear-gradient(90deg,#C9A227,#f59e0b)}
.tm-card-cover{width:100%;height:160px;object-fit:cover;display:block}
.tm-card-cover-placeholder{height:6px;background:linear-gradient(90deg,#C9A227,#f59e0b)}
.tm-cover-frame{padding:2px;border-radius:20px;background:var(--border-light,#CBD5E1);margin-bottom:20px}
.tm-cover-upload{border:none;border-radius:18px;overflow:hidden;position:relative;background:linear-gradient(145deg,rgba(99,102,241,.05) 0%,rgba(139,92,246,.05) 100%);transition:background .25s}
.tm-cover-preview{width:100%;max-height:220px;object-fit:cover;display:block}
.tm-cover-empty{padding:28px 20px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;cursor:pointer;position:relative;overflow:hidden}
.tm-cover-empty::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 90% 70% at 50% 110%,rgba(99,102,241,.13),transparent 60%),radial-gradient(ellipse 35% 35% at 8% 8%,rgba(139,92,246,.09),transparent);pointer-events:none}
.tm-cover-empty-icon{width:76px;height:76px;border-radius:22px;background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.18));border:1.5px solid rgba(99,102,241,.28);display:flex;align-items:center;justify-content:center;transition:transform .25s,box-shadow .25s;box-shadow:0 4px 18px rgba(99,102,241,.12)}
.tm-cover-empty-icon i{font-size:1.9rem;color:#6366f1}
.tm-cover-upload:hover .tm-cover-empty-icon{transform:translateY(-5px) scale(1.06);box-shadow:0 10px 28px rgba(99,102,241,.22)}
.tm-cover-empty-text{text-align:center;display:flex;flex-direction:column;gap:6px}
.tm-cover-empty-text b{display:block;font-size:.95rem;font-weight:700;color:var(--text-primary)}
.tm-cover-empty-hint{display:flex;align-items:center;gap:8px;font-size:.73rem;color:var(--text-muted)}
.tm-cover-empty-hint::before,.tm-cover-empty-hint::after{content:'';flex:1;height:1px;background:var(--border);max-width:36px}
.tm-cover-actions{position:absolute;bottom:8px;right:8px;display:flex;gap:6px}
.tm-cover-btn{padding:5px 12px;border-radius:8px;border:none;font-size:.78rem;font-weight:600;cursor:pointer;backdrop-filter:blur(6px)}
.tm-cover-btn-change{background:rgba(255,255,255,.85);color:#111}
.tm-cover-btn-del{background:rgba(239,68,68,.85);color:#fff}
.tm-card-body{padding:20px;flex:1}
.tm-card-title{font-weight:700;font-size:1rem;color:var(--text-primary);margin-bottom:8px}
.tm-card-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.tm-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:20px;font-size:.72rem;font-weight:600}
.tm-chip-q{background:rgba(99,102,241,.12);color:#6366f1}
.tm-chip-time{background:rgba(245,158,11,.12);color:#f59e0b}
.tm-chip-score{background:rgba(16,185,129,.12);color:#10b981}
.tm-chip-draft{background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border)}
.tm-chip-pub{background:rgba(16,185,129,.12);color:#10b981}
.tm-card-footer{padding:12px 20px;border-top:1px solid var(--border);background:var(--bg-raised);display:flex;gap:8px;align-items:center}
.tm-btn-edit{flex:1;padding:7px;border-radius:10px;border:1.5px solid var(--primary);background:transparent;color:var(--primary);font-size:.82rem;font-weight:600;cursor:pointer;transition:all .15s;text-align:center}
.tm-btn-edit:hover{background:var(--primary);color:#fff}
.tm-btn-assign{padding:7px 14px;border-radius:10px;border:1.5px solid #C9A227;background:transparent;color:#C9A227;font-size:.82rem;font-weight:600;cursor:pointer;transition:all .15s}
.tm-btn-assign:hover{background:#C9A227;color:#fff}
.tm-btn-results{padding:7px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);font-size:.82rem;cursor:pointer;transition:all .15s}
.tm-btn-results:hover{border-color:var(--primary);color:var(--primary)}
.tm-btn-settings{padding:7px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);font-size:.82rem;cursor:pointer;transition:all .15s}
.tm-btn-settings:hover{border-color:#8b5cf6;color:#8b5cf6}
.tm-btn-del{padding:7px 10px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);font-size:.82rem;cursor:pointer;transition:all .15s}
.tm-btn-del:hover{border-color:var(--danger);color:var(--danger);background:rgba(239,68,68,.06)}
.tm-assign-item:last-child{border-bottom:none}

.tm-search-wrap{display:flex;align-items:center;gap:8px;flex:1;padding:0 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);transition:border-color .15s}
.tm-search-wrap:focus-within{border-color:var(--primary)}
.tm-search-wrap i{color:var(--text-muted);font-size:.85rem;flex-shrink:0}
.tm-search-inp{flex:1;min-width:0;border:none!important;background:transparent!important;color:var(--text-primary)!important;font-size:.85rem;outline:none!important;padding:9px 0!important;box-shadow:none!important;width:auto}
.tm-search-inp::placeholder{color:var(--text-muted)!important}
.tm-btn-dupe{padding:7px 10px;border-radius:10px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);font-size:.82rem;cursor:pointer;transition:all .15s}
.tm-btn-dupe:hover{border-color:#8b5cf6;color:#8b5cf6}
.tm-empty{display:flex;flex-direction:column;align-items:center;padding:5rem 2rem;text-align:center;grid-column:1/-1}
.tm-empty-ico{font-size:4rem;margin-bottom:1rem;opacity:.3}
.tm-empty-head{font-size:1.2rem;font-weight:700;color:var(--text-primary);margin-bottom:.5rem}
.tm-empty-txt{font-size:.875rem;color:var(--text-muted);max-width:360px;line-height:1.6;margin-bottom:1.5rem}
</style>

<div class="tm-page">
    <div class="tm-hero">
        <div class="tm-hero-inner">
            <div class="tm-hero-left">
                <div class="tm-hero-icon"><i class="fa-solid fa-file-pen"></i></div>
                <div>
                    <h1 class="tm-hero-title">Управління тестами</h1>
                    <p class="tm-hero-sub">Створюйте тести та призначайте співробітникам</p>
                </div>
            </div>
        </div>
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <div class="tm-search-wrap">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input class="tm-search-inp" type="text" placeholder="Пошук тесту..." oninput="TestsManagerPage._filterTests(this.value)">
        </div>
        <button class="tm-btn-new" onclick="TestsManagerPage.openCreateModal()"><i class="fa-solid fa-plus"></i> Новий тест</button>
    </div>

    <div class="tm-grid" id="tm-grid">
        ${this._tests.length ? this._tests.map(t => this._cardHtml(t)).join('') : `
            <div class="tm-empty">
                <div class="tm-empty-ico"><i class="fa-solid fa-clipboard-list"></i></div>
                <div class="tm-empty-head">Тестів ще немає</div>
                <div class="tm-empty-txt">Створіть перший тест та призначте його співробітникам для перевірки знань</div>
                <button class="tm-btn-new" onclick="TestsManagerPage.openCreateModal()"><i class="fa-solid fa-plus"></i> Створити перший тест</button>
            </div>`}
    </div>
</div>`;
    },

    _cardHtml(t) {
        const qCount = t.questions?.length ?? '—';
        return `
<div class="tm-card">
    ${t.cover_image
        ? `<img class="tm-card-cover" src="${t.cover_image}" alt="">`
        : `<div class="tm-card-cover-placeholder"></div>`}
    <div class="tm-card-body">
        <div class="tm-card-title">${t.title}</div>
        ${t.description ? `<div style="font-size:.82rem;color:var(--text-muted);margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${t.description}</div>` : ''}
        <div class="tm-card-meta">
            <span class="tm-chip tm-chip-q"><i class="fa-solid fa-question"></i> ${qCount} питань</span>
            ${t.time_limit_minutes ? `<span class="tm-chip tm-chip-time"><i class="fa-regular fa-clock"></i> ${t.time_limit_minutes} хв</span>` : ''}
            <span class="tm-chip tm-chip-score"><i class="fa-solid fa-trophy"></i> ${t.passing_score||70}%</span>
            <span class="tm-chip ${t.is_published ? 'tm-chip-pub' : 'tm-chip-draft'}">${t.is_published ? '<i class="fa-solid fa-check"></i> Опубліковано' : 'Чернетка'}</span>
        </div>
        <div style="font-size:.75rem;color:var(--text-muted)">${Fmt.date(t.created_at)}</div>
    </div>
    <div class="tm-card-footer" onclick="event.stopPropagation()">
        <button class="tm-btn-edit" onclick="TestsManagerPage.openEditor('${t.id}')"><i class="fa-solid fa-pen-to-square"></i> Редагувати</button>
        <button class="tm-btn-settings" onclick="TestsManagerPage.openSettings('${t.id}')" title="Налаштувати"><i class="fa-solid fa-gears"></i></button>
        <button class="tm-btn-assign" onclick="TestsManagerPage.openAssignModal('${t.id}')"><i class="fa-solid fa-users"></i></button>
        <button class="tm-btn-results" onclick="TestsManagerPage.openResultsModal('${t.id}')"><i class="fa-solid fa-chart-line"></i></button>
        <button class="tm-btn-dupe" onclick="TestsManagerPage.duplicateTest('${t.id}')" title="Дублювати тест"><i class="fa-regular fa-copy"></i></button>
        <button class="tm-btn-del" onclick="TestsManagerPage.deleteTest('${t.id}',${JSON.stringify(t.title||'').replace(/"/g,'&quot;')})"><i class="fa-solid fa-trash"></i></button>
    </div>
</div>`;
    },

    // ── Create / Edit meta modal ──────────────────────────────────

    openCreateModal() {
        const c = TestsManagerPage._container;
        this._renderSettings(c, null);
    },

    openSettings(testId) {
        const t = this._tests.find(x => x.id === testId);
        if (!t) return;
        const c = TestsManagerPage._container;
        this._renderSettings(c, t);
    },

    _goBack(container) {
        if (this._prevView === 'editor' && this._curTest) this._renderEditor(container);
        else this._renderList(container);
    },

    async _renderSettings(container, test) {
        container.innerHTML = '<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>';
        const isEdit = !!test;
        this._pendingCoverFile = null;
        this._coverImageUrl    = test?.cover_image || null;
        let allPositions = [];
        try { allPositions = await TestsManagerAPI.getPositions(); } catch(_) {}
        const selectedPos = test?.auto_assign_positions || [];

        container.innerHTML = `<style>
.tset-page{max-width:900px}
.tset-topbar{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:28px}
.tset-back{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.83rem;font-weight:500;cursor:pointer;transition:all .15s}
.tset-back:hover{border-color:var(--primary);color:var(--primary)}
.tset-grid{display:grid;grid-template-columns:1fr 360px;gap:24px;align-items:start}
@media(max-width:700px){.tset-grid{grid-template-columns:1fr}}
.tm-cover-frame{padding:2px;border-radius:20px;background:var(--border-light,#CBD5E1);margin-bottom:20px}
.tm-cover-upload{border:none;border-radius:18px;overflow:hidden;position:relative;background:linear-gradient(145deg,rgba(99,102,241,.05) 0%,rgba(139,92,246,.05) 100%);transition:background .25s}
.tm-cover-preview{width:100%;max-height:220px;object-fit:cover;display:block}
.tm-cover-empty{padding:28px 20px;display:flex;align-items:center;justify-content:center;gap:16px;cursor:pointer;position:relative;overflow:hidden}
.tm-cover-empty::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 90% 70% at 50% 110%,rgba(99,102,241,.13),transparent 60%),radial-gradient(ellipse 35% 35% at 8% 8%,rgba(139,92,246,.09),transparent);pointer-events:none}
.tm-cover-empty-icon{width:76px;height:76px;border-radius:22px;background:linear-gradient(135deg,rgba(99,102,241,.15),rgba(139,92,246,.18));border:1.5px solid rgba(99,102,241,.28);display:flex;align-items:center;justify-content:center;transition:transform .25s,box-shadow .25s;box-shadow:0 4px 18px rgba(99,102,241,.12)}
.tm-cover-empty-icon i{font-size:1.9rem;color:#6366f1}
.tm-cover-frame:hover .tm-cover-empty-icon{transform:translateY(-5px) scale(1.06);box-shadow:0 10px 28px rgba(99,102,241,.22)}
.tm-cover-empty-text{text-align:center;display:flex;flex-direction:column;gap:6px}
.tm-cover-empty-text b{display:block;font-size:.95rem;font-weight:700;color:var(--text-primary)}
.tm-cover-empty-hint{display:flex;align-items:center;gap:8px;font-size:.73rem;color:var(--text-muted)}
.tm-cover-empty-hint::before,.tm-cover-empty-hint::after{content:'';flex:1;height:1px;background:var(--border);max-width:36px}
.tm-cover-actions{position:absolute;bottom:8px;right:8px;display:flex;gap:6px}
.tm-cover-btn{padding:5px 12px;border-radius:8px;border:none;font-size:.78rem;font-weight:600;cursor:pointer;backdrop-filter:blur(6px)}
.tm-cover-btn-change{background:rgba(255,255,255,.85);color:#111}
.tm-cover-btn-del{background:rgba(239,68,68,.85);color:#fff}
</style>
<div class="tset-page">
    <div class="tset-topbar">
        <button class="tset-back" onclick="TestsManagerPage._goBack(TestsManagerPage._container)"><i class="fa-solid fa-arrow-left"></i> Назад</button>
        <span style="font-size:1.1rem;font-weight:700;color:var(--text-primary);flex:1">${isEdit ? '<i class="fa-solid fa-gear"></i> ' + test.title : '<i class="fa-solid fa-plus"></i> Новий тест'}</span>
        <button class="btn btn-primary" onclick="TestsManagerPage._saveMeta(${isEdit ? `'${test.id}'` : 'null'})">${isEdit ? '<i class="fa-regular fa-floppy-disk"></i> Зберегти' : '<i class="fa-solid fa-plus"></i> Створити'}</button>
    </div>
    <div class="tm-cover-frame">
        <div id="tm-cover-wrap" class="tm-cover-upload">
            ${test?.cover_image
                ? `<img class="tm-cover-preview" id="tm-cover-img" src="${test.cover_image}" alt="">
                   <div class="tm-cover-actions">
                       <label class="tm-cover-btn tm-cover-btn-change"><i class="fa-solid fa-image"></i> Змінити<input type="file" accept="image/*" style="display:none" onchange="TestsManagerPage._onCoverPick(this)"></label>
                       <button type="button" class="tm-cover-btn tm-cover-btn-del" onclick="TestsManagerPage._removeCover()"><i class="fa-solid fa-trash"></i></button>
                   </div>`
                : `<label class="tm-cover-empty">
                       <div class="tm-cover-empty-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
                       <div class="tm-cover-empty-text">
                           <b>Перетягніть або натисніть для завантаження</b>
                           <div class="tm-cover-empty-hint">PNG, JPG · до 5 МБ · 1200×400</div>
                       </div>
                       <input type="file" accept="image/*" style="display:none" onchange="TestsManagerPage._onCoverPick(this)">
                   </label>`}
        </div>
    </div>
    <div class="tset-grid">
        <div>
            <div class="form-group"><label>Назва тесту *</label>
                <input id="tm-title" type="text" placeholder="Введіть назву" value="${test?.title||''}"></div>
            <div class="form-group"><label>Опис</label>
                <textarea id="tm-desc" rows="2" placeholder="Короткий опис (необов'язково)">${test?.description||''}</textarea></div>
            <div class="form-row">
                <div class="form-group"><label>Ліміт часу (хвилин)</label>
                    <input id="tm-time" type="number" min="1" max="300" placeholder="Без ліміту" value="${test?.time_limit_minutes||''}"></div>
                <div class="form-group"><label>Макс. спроб</label>
                    <input id="tm-attempts" type="number" min="1" max="10" placeholder="1" value="${test?.max_attempts||1}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Прохідний бал (%)</label>
                    <input id="tm-score" type="number" min="1" max="100" value="${test?.passing_score||70}"></div>
                <div class="form-group" style="display:flex;align-items:center;gap:10px;padding-top:28px">
                    <input type="checkbox" id="tm-shuffle" ${test?.randomize_questions?'checked':''} style="width:18px;height:18px;cursor:pointer">
                    <label for="tm-shuffle" style="cursor:pointer;font-weight:500">Перемішати питання</label>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
                <input type="checkbox" id="tm-restart" ${test?.allow_restart?'checked':''} style="width:18px;height:18px;cursor:pointer">
                <label for="tm-restart" style="cursor:pointer;font-weight:500">Дозволити почати заново (скинути прогрес)</label>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
                <input type="checkbox" id="tm-skip" ${test?.allow_skip?'checked':''} style="width:18px;height:18px;cursor:pointer">
                <label for="tm-skip" style="cursor:pointer;font-weight:500">Дозволити пропускати питання</label>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
                <input type="checkbox" id="tm-feedback" ${test?.show_answer_feedback?'checked':''} style="width:18px;height:18px;cursor:pointer">
                <label for="tm-feedback" style="cursor:pointer;font-weight:500">Показувати правильність відповіді після кожного питання</label>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
                <input type="checkbox" id="tm-wrong" ${test?.show_wrong_answers?'checked':''} style="width:18px;height:18px;cursor:pointer">
                <label for="tm-wrong" style="cursor:pointer;font-weight:500">Показувати протокол помилок після завершення тесту</label>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
                <input type="checkbox" id="tm-pub" ${test?.is_published?'checked':''} style="width:18px;height:18px;cursor:pointer">
                <label for="tm-pub" style="cursor:pointer;font-weight:500">Опубліковано (доступний для проходження)</label>
            </div>
        </div>
        <div style="padding:14px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-raised);display:flex;flex-direction:column;gap:8px">
            <div>
                <div style="font-weight:700;font-size:.88rem;margin-bottom:2px"><i class="fa-solid fa-robot"></i> Автоматизація</div>
                <div style="font-size:.75rem;color:var(--text-muted)">Автоназначення новим співробітникам за посадою</div>
            </div>
            <div id="tm-pos-tags" style="display:flex;flex-wrap:wrap;gap:4px;min-height:24px">
                ${selectedPos.length
                    ? selectedPos.map(p => {
                        const js = JSON.stringify(p).replace(/"/g,'&quot;');
                        return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px 2px 10px;border-radius:20px;background:rgba(99,102,241,.1);border:1.5px solid var(--primary);color:var(--primary);font-size:.72rem;font-weight:600">${Fmt.esc(p)}<button type="button" onclick="TestsManagerPage._removePosTag(${js})" style="background:none;border:none;cursor:pointer;color:var(--primary);padding:0;margin:0 0 0 2px;font-size:.75rem;line-height:1"><i class="fa-solid fa-xmark"></i></button></span>`;
                    }).join('')
                    : `<span style="font-size:.75rem;color:var(--text-muted)">Не вибрано — тільки вручну</span>`
                }
            </div>
            ${allPositions.length ? `
            <input id="tm-pos-search" type="text" placeholder="Пошук посади..."
                style="width:100%;box-sizing:border-box;padding:6px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.82rem;outline:none"
                oninput="TestsManagerPage._filterPosSearch(this.value)">
            <div id="tm-pos-list" style="flex:1;max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:3px">
                ${allPositions.map(p => {
                    const on = selectedPos.includes(p);
                    return `<label style="display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:7px;cursor:pointer;background:${on?'rgba(99,102,241,.06)':''};transition:background .12s"
                        onmouseenter="this.style.background=this.querySelector('input').checked?'rgba(99,102,241,.06)':'var(--bg-raised)'"
                        onmouseleave="this.style.background=this.querySelector('input').checked?'rgba(99,102,241,.06)':''">
                        <input type="checkbox" name="tm-pos" value="${p}" ${on?'checked':''}
                            style="width:14px;height:14px;cursor:pointer;accent-color:var(--primary);flex-shrink:0"
                            onchange="TestsManagerPage._togglePosLabel(this.closest('label'),this.checked)">
                        <span style="font-size:.82rem;color:var(--text-primary)">${p}</span>
                    </label>`;
                }).join('')}
            </div>` : `<div style="font-size:.78rem;color:var(--text-muted)">Посади не знайдено — заповніть профілі співробітників</div>`}
            ${isEdit ? `<button type="button" class="btn btn-ghost btn-sm" style="margin-top:auto" onclick="TestsManagerPage._runAutoAssign('${test.id}')"><i class="fa-solid fa-play"></i> Запустити зараз</button>` : ''}
        </div>
    </div>
</div>`;
    },

    async _saveMeta(testId) {
        const title = Dom.val('tm-title').trim();
        if (!title) { Toast.error('Помилка', 'Введіть назву тесту'); return; }
        const autoPositions = [...document.querySelectorAll('input[name="tm-pos"]:checked')].map(c => c.value);
        const payload = {
            title,
            description:            Dom.val('tm-desc').trim() || null,
            time_limit_minutes:     parseInt(Dom.val('tm-time')) || null,
            max_attempts:           parseInt(Dom.val('tm-attempts')) || 1,
            passing_score:          parseInt(Dom.val('tm-score')) || 70,
            randomize_questions:    document.getElementById('tm-shuffle')?.checked || false,
            allow_restart:          document.getElementById('tm-restart')?.checked   || false,
            allow_skip:             document.getElementById('tm-skip')?.checked      || false,
            show_answer_feedback:   document.getElementById('tm-feedback')?.checked  || false,
            show_wrong_answers:     document.getElementById('tm-wrong')?.checked     || false,
            is_published:           document.getElementById('tm-pub')?.checked || false,
            auto_assign_positions:  autoPositions,
            course_id:              null,
            created_by:             AppState.user.id
        };
        Loader.show();
        try {
            let test;
            if (testId) {
                test = await API.tests.update(testId, payload);
            } else {
                test = await API.tests.create(payload);
            }
            const coverUrl = await this._uploadCover(test.id);
            if (coverUrl !== undefined) {
                await API.tests.update(test.id, { cover_image: coverUrl || null });
                test.cover_image = coverUrl || null;
            }
            Toast.success(testId ? 'Збережено' : 'Тест створено');
            await this.openEditor(test.id);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _togglePosLabel(lbl, checked) {
        lbl.style.background = checked ? 'rgba(99,102,241,.06)' : '';
        this._updatePosTags();
    },

    _onCoverPick(input) {
        const file = input.files[0];
        if (!file) return;
        this._pendingCoverFile = file;
        const reader = new FileReader();
        reader.onload = e => {
            const wrap = document.getElementById('tm-cover-wrap');
            wrap.innerHTML = `
                <img class="tm-cover-preview" id="tm-cover-img" src="${e.target.result}" alt="">
                <div class="tm-cover-actions">
                    <label class="tm-cover-btn tm-cover-btn-change"><i class="fa-solid fa-image"></i> Змінити<input type="file" accept="image/*" style="display:none" onchange="TestsManagerPage._onCoverPick(this)"></label>
                    <button type="button" class="tm-cover-btn tm-cover-btn-del" onclick="TestsManagerPage._removeCover()"><i class="fa-solid fa-trash"></i></button>
                </div>`;
        };
        reader.readAsDataURL(file);
    },

    _removeCover() {
        this._pendingCoverFile = null;
        this._coverImageUrl = '';
        const wrap = document.getElementById('tm-cover-wrap');
        wrap.innerHTML = `
            <label class="tm-cover-empty">
                <div class="tm-cover-empty-icon"><i class="fa-solid fa-cloud-arrow-up"></i></div>
                <div class="tm-cover-empty-text">
                    <b>Перетягніть або натисніть для завантаження</b>
                    <div class="tm-cover-empty-hint">PNG, JPG · до 5 МБ · 1200×400</div>
                </div>
                <input type="file" accept="image/*" style="display:none" onchange="TestsManagerPage._onCoverPick(this)">
            </label>`;
    },

    async _uploadCover(testId) {
        const file = this._pendingCoverFile;
        if (!file) return this._coverImageUrl;
        const ext  = file.name.split('.').pop().toLowerCase();
        const path = `covers/${testId}/cover.${ext}`;
        const opts = { upsert: true };
        if (file.type) opts.contentType = file.type;
        const { error } = await supabase.storage.from(APP_CONFIG.buckets.testImages).upload(path, file, opts);
        if (error) throw error;
        this._pendingCoverFile = null;
        return `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.testImages}/${path}`;
    },

    _updatePosTags() {
        const el = document.getElementById('tm-pos-tags');
        if (!el) return;
        const checked = [...document.querySelectorAll('input[name="tm-pos"]:checked')];
        if (!checked.length) {
            el.innerHTML = '<span style="font-size:.78rem;color:var(--text-muted);line-height:28px">Посади не вибрано — тест призначається тільки вручну</span>';
            return;
        }
        el.innerHTML = checked.map(cb => {
            const p  = cb.value;
            const js = JSON.stringify(p).replace(/"/g,'&quot;');
            return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px 3px 12px;border-radius:20px;background:rgba(99,102,241,.1);border:1.5px solid var(--primary);color:var(--primary);font-size:.75rem;font-weight:600">${Fmt.esc(p)}<button type="button" onclick="TestsManagerPage._removePosTag(${js})" style="background:none;border:none;cursor:pointer;color:var(--primary);padding:0;margin:0 0 0 2px;font-size:.8rem;line-height:1"><i class="fa-solid fa-xmark"></i></button></span>`;
        }).join('');
    },

    _removePosTag(val) {
        document.querySelectorAll('input[name="tm-pos"]').forEach(cb => {
            if (cb.value === val) {
                cb.checked = false;
                const lbl = cb.closest('label');
                if (lbl) lbl.style.background = '';
            }
        });
        this._updatePosTags();
    },

    _filterPosSearch(query) {
        const q = query.trim().toLowerCase();
        document.querySelectorAll('#tm-pos-list label').forEach(lbl => {
            lbl.style.display = !q || lbl.textContent.trim().toLowerCase().includes(q) ? '' : 'none';
        });
    },

    async _runAutoAssign(testId) {
        if (!document.getElementById('tm-pub')?.checked) {
            Toast.error('Тест не опубліковано', 'Опублікуйте тест перед запуском автоматизації');
            return;
        }
        const positions = [...document.querySelectorAll('input[name="tm-pos"]:checked')].map(c => c.value);
        if (!positions.length) {
            Toast.info('Немає посад', 'Вкажіть посади в розділі Автоматизація');
            return;
        }
        Loader.show();
        try {
            const [{ data: emps }, { data: already }] = await Promise.all([
                supabase.from('profiles').select('id')
                    .in('role', ['user','teacher','smm','manager'])
                    .in('job_position', positions),
                supabase.from('test_assignments').select('user_id').eq('test_id', testId)
            ]);
            const assignedIds = new Set((already || []).map(a => a.user_id));
            const toAssign    = (emps || []).filter(e => !assignedIds.has(e.id));
            if (!toAssign.length) {
                Toast.info('Вже призначено', 'Всі відповідні співробітники вже мають цей тест');
                return;
            }
            await TestsManagerAPI.assign(testId, toAssign.map(e => e.id), null);
            Toast.success('Готово', `Призначено ${toAssign.length} співробітникам`);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Editor ───────────────────────────────────────────────────

    async openEditor(testId) {
        const container = TestsManagerPage._container;
        await this._openEditorById(container, testId);
    },

    async _openEditorById(container, testId) {
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            const test = await API.tests.getById(testId);
            this._curTest   = test;
            this._questions = [...(test.questions || [])].sort((a,b) => a.order_index - b.order_index);
            UI.setBreadcrumb([{ label: 'Адміністрування', route: 'admin?tab=tests' }, { label: test.title }]);
            this._renderEditor(container);
        } catch(e) {
            Toast.error('Помилка', e.message);
            await this._renderList(container);
        }
    },

    _renderEditor(container) {
        this._prevView = 'editor';
        container.innerHTML = `
<style>
.te-wrap{display:flex;flex-direction:column;height:calc(100vh - 120px);min-height:600px}
.te-topbar{display:flex;align-items:center;gap:12px;padding-bottom:14px;border-bottom:1px solid var(--border);margin-bottom:0;flex-shrink:0}
.te-back{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.83rem;font-weight:500;cursor:pointer;transition:all .15s;text-decoration:none}
.te-back:hover{border-color:var(--primary);color:var(--primary)}
.te-test-title{font-size:1.1rem;font-weight:700;color:var(--text-primary);flex:1}
.te-body{display:flex;flex:1;gap:0;overflow:hidden;margin-top:16px;border:1px solid var(--border);border-radius:18px;overflow:hidden}

/* Left panel */
.te-left{flex:0 0 65%;min-width:0;display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--border)}
.te-left-toolbar{padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0;background:var(--bg-raised);flex-wrap:wrap}
.te-type-chips{display:flex;gap:6px;flex-wrap:nowrap}
.te-type-chip{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:10px 6px;flex:1;border-radius:12px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);font-size:.68rem;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap}
.te-type-chip i{font-size:1.15rem}
.te-type-chip.active{border-color:var(--primary);color:var(--primary);background:var(--primary-glow,rgba(99,102,241,.1))}
.te-type-chip:hover:not(.active){border-color:var(--border-light);color:var(--text-primary)}
.te-pts-wrap{display:flex;align-items:center;gap:6px;margin-left:auto}
.te-pts-lbl{font-size:.8rem;color:var(--text-muted)}
.te-pts-inp{width:60px;padding:5px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);text-align:center;font-size:.85rem;outline:none}
.te-left-content{flex:1;overflow-y:auto;padding:18px}
.te-lbl{font-size:.78rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.te-quill-wrap{border:1.5px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:18px}
.te-quill-wrap .ql-toolbar{border:none;border-bottom:1px solid var(--border);padding:8px 12px;background:var(--bg-raised)}
.te-quill-wrap .ql-container{border:none;font-size:.92rem;min-height:90px}
.te-quill-wrap .ql-editor{padding:12px 14px;min-height:90px;color:var(--text-primary)}

/* Options */
.te-options{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.te-opt{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-surface);transition:border-color .15s}
.te-opt.correct{border-color:#10b981;background:rgba(16,185,129,.06)}
.te-opt-handle{color:var(--text-muted);cursor:grab;font-size:1rem;flex-shrink:0}
.te-opt-marker{width:18px;height:18px;border-radius:50%;border:2px solid var(--border);flex-shrink:0}
.te-opt.correct .te-opt-marker{border-color:#10b981;background:#10b981}
.te-opt-inp{flex:1;border:none;background:transparent;color:var(--text-primary);font-size:.88rem;outline:none}
.te-opt-inp::placeholder{color:var(--text-muted)}
.te-opt-correct-btn{padding:4px 10px;border-radius:8px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);font-size:.75rem;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0}
.te-opt-correct-btn.on{border-color:#10b981;color:#10b981;background:rgba(16,185,129,.1)}
.te-opt-del{width:28px;height:28px;border-radius:8px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.85rem;transition:all .15s;flex-shrink:0}
.te-opt-del:hover{border-color:var(--danger);color:var(--danger)}
.te-add-opt{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;border:1.5px dashed var(--border);background:transparent;color:var(--text-muted);font-size:.82rem;cursor:pointer;transition:all .15s}
.te-add-opt:hover{border-color:var(--primary);color:var(--primary)}

/* Matching */
.te-match-row{display:grid;grid-template-columns:1fr auto 1fr auto;align-items:center;gap:8px;margin-bottom:8px}
.te-match-inp{padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.85rem;outline:none;width:100%;box-sizing:border-box}
.te-match-inp:focus{border-color:var(--primary)}
.te-match-arrow{color:var(--text-muted);font-size:1.1rem;flex-shrink:0}

/* Ordering */
.te-order-item{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-surface);margin-bottom:8px;cursor:grab}
.te-order-num{width:24px;height:24px;border-radius:50%;background:var(--primary);color:#fff;font-size:.75rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}

.te-save-btn{width:100%;padding:10px;border-radius:12px;background:var(--primary);border:none;color:#fff;font-size:.9rem;font-weight:700;cursor:pointer;transition:background .15s;margin-top:4px}
.te-save-btn:hover{background:var(--primary-dark,#1d4ed8)}

.te-text-hint{padding:16px;border-radius:12px;border:1.5px solid rgba(99,102,241,.25);background:rgba(99,102,241,.07);color:var(--text-secondary);font-size:.85rem;line-height:1.6;margin-bottom:14px}

/* Right panel */
.te-right{flex:0 0 35%;min-width:0;display:flex;flex-direction:column;overflow:hidden;background:var(--bg-raised)}
.te-right-header{padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.te-right-title{font-size:.82rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em}
.te-right-count{font-size:.78rem;color:var(--text-muted)}
.te-qlist{flex:1;overflow-y:auto;padding:8px}
.te-qitem{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:12px;border:1.5px solid transparent;background:var(--bg-surface);margin-bottom:6px;cursor:pointer;transition:all .15s}
.te-qitem:hover{border-color:var(--border-light)}
.te-qitem.active{border-color:var(--primary);background:var(--primary-glow)}
.te-qitem-num{width:22px;height:22px;border-radius:50%;background:var(--bg-raised);border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;color:var(--text-muted);flex-shrink:0;margin-top:1px}
.te-qitem.active .te-qitem-num{background:var(--primary);border-color:var(--primary);color:#fff}
.te-qitem-body{flex:1;min-width:0}
.te-qitem-text{font-size:.82rem;font-weight:500;color:var(--text-primary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:3px;line-height:1.4}
.te-qitem-type{font-size:.7rem;color:var(--text-muted)}
.te-qitem-del{width:36px;height:36px;border-radius:9px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;transition:all .15s}
.te-qitem-del:hover{background:rgba(239,68,68,.1);color:var(--danger)}
.te-right-footer{padding:12px;border-top:1px solid var(--border);flex-shrink:0}
.te-add-q-wrap{position:relative}
.te-add-q-btn{width:100%;padding:9px;border-radius:12px;border:1.5px dashed var(--border);background:transparent;color:var(--primary);font-size:.85rem;font-weight:600;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:6px}
.te-add-q-btn:hover{border-color:var(--primary);background:var(--primary-glow,rgba(99,102,241,.07))}
.te-import-btn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin-top:6px;padding:7px;border-radius:12px;border:1.5px dashed var(--border);background:transparent;color:var(--text-muted);font-size:.82rem;font-weight:600;cursor:pointer;transition:all .15s}
.te-import-btn:hover{border-color:#10b981;color:#10b981;background:rgba(16,185,129,.06)}
.te-type-dropdown{position:absolute;bottom:calc(100% + 4px);left:0;right:0;background:var(--bg-surface);border:1.5px solid var(--border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:100;overflow:hidden;display:none;padding:6px}
.te-type-dropdown.open{display:flex;gap:4px}
.te-type-opt{flex:1;padding:8px 4px;font-size:.72rem;color:var(--text-primary);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;transition:background .1s;border-radius:8px;white-space:nowrap}
.te-type-opt span:first-child{font-size:1.1rem}
.te-type-opt:hover{background:var(--bg-raised)}

.te-empty-q{display:flex;flex-direction:column;align-items:center;padding:2rem 1rem;text-align:center;color:var(--text-muted);font-size:.85rem}
.te-empty-q-ico{font-size:2.5rem;margin-bottom:.75rem;opacity:.4}

/* Media panel */
.te-media-panel{border:1.5px solid rgba(99,102,241,.25);border-radius:14px;padding:12px 14px;margin-bottom:16px;background:rgba(99,102,241,.05);position:relative;overflow:hidden}
.te-media-panel::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:14px 14px 0 0}
.te-media-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;margin-top:4px}
.te-media-thumbs{display:flex;flex-wrap:wrap;gap:8px}
.te-media-thumb{position:relative;width:70px;height:70px;border-radius:8px;overflow:hidden;border:1.5px solid var(--border);flex-shrink:0;cursor:pointer}
.te-media-thumb img{width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in}
.te-media-thumb-actions{position:absolute;inset:0;background:rgba(0,0,0,.55);display:none;flex-direction:column;align-items:center;justify-content:center;gap:3px}
.te-media-thumb:hover .te-media-thumb-actions{display:flex}
.te-media-thumb-actions button{background:rgba(255,255,255,.9);border:none;border-radius:5px;padding:2px 6px;font-size:.65rem;cursor:pointer;width:58px;text-align:center}
.te-upload-lbl{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:8px;border:1.5px dashed var(--border);background:transparent;color:var(--text-muted);font-size:.78rem;cursor:pointer;transition:all .15s}
.te-upload-lbl:hover{border-color:var(--primary);color:var(--primary)}
/* Answer image */
.te-opt-img{width:46px;height:46px;border-radius:8px;object-fit:cover;border:1.5px solid var(--border);flex-shrink:0;cursor:zoom-in}
.te-opt-img-btn{width:32px;height:32px;border-radius:8px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0;transition:all .15s}
.te-opt-img-btn:hover{border-color:var(--primary);color:var(--primary)}
.te-opt-img-wrap{position:relative;flex-shrink:0}
.te-opt-img-del{position:absolute;top:-5px;right:-5px;width:15px;height:15px;border-radius:50%;background:#ef4444;border:none;color:#fff;font-size:.55rem;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1}
/* Explanation */
.te-explanation-wrap{margin-bottom:16px}
.te-explanation{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.85rem;resize:vertical;min-height:60px;outline:none;font-family:inherit;transition:border-color .15s}
.te-explanation:focus{border-color:var(--primary)}
/* Question list drag */
.te-qitem[draggable]{cursor:grab}
.te-qitem.drag-over{border-color:var(--primary)!important;background:rgba(99,102,241,.07)!important}
.te-qitem-dupe{width:36px;height:36px;border-radius:9px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;transition:all .15s}
.te-qitem-dupe:hover{background:rgba(99,102,241,.1);color:var(--primary)}
.ql-editor.drag-active{outline:2px dashed var(--primary)!important;background:rgba(99,102,241,.04)!important}
.ql-img-toolbar{position:absolute;display:none;z-index:6;background:rgba(15,23,42,.82);border:1.5px solid rgba(255,255,255,.15);border-radius:10px;padding:4px 5px;gap:3px;box-shadow:0 4px 18px rgba(0,0,0,.4);backdrop-filter:blur(6px)}
.ql-img-toolbar button{width:36px;height:36px;border:none;border-radius:7px;background:transparent;cursor:pointer;font-size:1rem;color:rgba(255,255,255,.75);transition:all .12s;display:flex;align-items:center;justify-content:center}
.ql-img-toolbar button:hover{background:rgba(255,255,255,.12);color:#fff}
.ql-img-toolbar button.on{background:var(--primary,#6366f1);color:#fff}
/* Answer image format bar */
.te-opt-img-fmt{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.65);display:none;justify-content:center;gap:2px;padding:2px 3px;border-radius:0 0 7px 7px}
.te-opt-img-wrap:hover .te-opt-img-fmt{display:flex}
.te-opt-img-fmt button{width:20px;height:20px;border:none;border-radius:3px;background:rgba(255,255,255,.15);color:rgba(255,255,255,.8);font-size:.6rem;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:background .1s}
.te-opt-img-fmt button.on{background:var(--primary,#6366f1);color:#fff}
/* Above layout for answer image */
.te-opt-img-wrap.img-above{width:100%;height:auto;border-radius:8px;overflow:visible}
.te-opt-img-wrap.img-above .te-opt-img{width:100%;height:auto;max-height:180px;object-fit:contain;border-radius:8px}
/* Answer Quill cards (single / multiple) */
.te-ans-cards{display:flex;flex-direction:column;gap:10px}
.te-ans-card{border:1.5px solid var(--border);border-radius:12px;overflow:visible;background:var(--bg-surface);transition:border-color .15s}
.te-ans-card.correct{border-color:var(--primary)}
.te-ans-card-head{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-raised);border-bottom:1px solid var(--border);border-radius:10px 10px 0 0}
.te-ans-card-body .ql-toolbar.ql-snow{border:none;border-bottom:1px solid var(--border);padding:3px 8px;background:var(--bg-raised)}
.te-ans-card-body .ql-container.ql-snow{border:none}
.te-ans-card-body .ql-editor{min-height:80px;font-size:.9rem;padding:10px 12px}
.te-ans-card-body .ql-editor img{max-width:100%;border-radius:8px;cursor:zoom-in}
.te-ans-card-body .ql-editor.drag-active{outline:2px dashed var(--primary)!important;background:rgba(99,102,241,.04)!important}
/* Font / size picker widths */
.te-quill-wrap .ql-snow .ql-picker.ql-font{width:120px}
.te-quill-wrap .ql-snow .ql-picker.ql-size{width:72px}
.te-ans-card-body .ql-snow .ql-picker.ql-font{width:110px}
.te-ans-card-body .ql-snow .ql-picker.ql-size{width:68px}
/* Picker dropdowns — above overlays and sticky headers */
.ql-snow .ql-picker.ql-expanded .ql-picker-options{z-index:9999!important}
/* Font picker — show actual font name in label and dropdown items */
.ql-snow .ql-picker.ql-font .ql-picker-label[data-value]:not([data-value=""])::before,
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value]:not([data-value=""])::before{content:attr(data-value)!important}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Arial"]::before{font-family:Arial,sans-serif}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Georgia"]::before{font-family:Georgia,serif}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Courier New"]::before{font-family:'Courier New',monospace}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Tahoma"]::before{font-family:Tahoma,sans-serif}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Verdana"]::before{font-family:Verdana,sans-serif}
/* Size picker — show px value in label and dropdown items */
.ql-snow .ql-picker.ql-size .ql-picker-label[data-value]:not([data-value=""])::before,
.ql-snow .ql-picker.ql-size .ql-picker-item[data-value]:not([data-value=""])::before{content:attr(data-value)!important}
</style>

<div class="te-wrap">
    <div class="te-topbar">
        <button class="te-back" onclick="TestsManagerPage._renderList(TestsManagerPage._container)"><i class="fa-solid fa-arrow-left"></i> Тести</button>
        <span class="te-test-title">${this._curTest.title}</span>
        <button class="btn btn-ghost btn-sm" onclick="TestsManagerPage._renderSettings(TestsManagerPage._container,TestsManagerPage._curTest)"><i class="fa-solid fa-gear"></i> Налаштування</button>
        <button class="btn btn-ghost btn-sm" onclick="TestsManagerPage.openPreview('${this._curTest.id}')"><i class="fa-solid fa-eye"></i> Перегляд</button>
        <button class="btn btn-sm" style="background:#C9A227;color:#fff;border:none;border-radius:10px;padding:7px 16px;font-weight:600;cursor:pointer" onclick="TestsManagerPage.openAssignModal('${this._curTest.id}')"><i class="fa-solid fa-users"></i> Призначити</button>
        <button class="btn btn-ghost btn-sm" onclick="TestsManagerPage.openResultsModal('${this._curTest.id}')"><i class="fa-solid fa-chart-bar"></i> Результати</button>
    </div>
    <div class="te-body">
        <div class="te-left">
            <div class="te-left-toolbar" id="te-toolbar">
                ${this._questions.length ? this._toolbarHtml() : '<span style="color:var(--text-muted);font-size:.85rem">Оберіть або додайте питання</span>'}
            </div>
            <div class="te-left-content" id="te-left-content">
                ${this._questions.length ? '' : `
                    <div class="te-empty-q">
                        <div class="te-empty-q-ico"><i class="fa-solid fa-pen"></i></div>
                        <div>Додайте питання у правій панелі</div>
                    </div>`}
            </div>
        </div>
        <div class="te-right">
            <div class="te-right-header">
                <span class="te-right-title">Питання</span>
                <span class="te-right-count" id="te-qcount">${this._questions.length}</span>
            </div>
            <div class="te-qlist" id="te-qlist">
                ${this._renderQList()}
            </div>
            <div class="te-right-footer">
                <div class="te-add-q-wrap" id="te-addq-wrap">
                    <button class="te-add-q-btn" onclick="TestsManagerPage._toggleAddMenu()"><i class="fa-solid fa-plus"></i> Додати питання</button>
                    <div class="te-type-dropdown" id="te-type-dd">
                        ${[
                            ['single','<i class="fa-solid fa-circle-dot"></i>','Одиночний'],
                            ['multiple','<i class="fa-solid fa-square-check"></i>','Множинний'],
                            ['text','<i class="fa-solid fa-pen-nib"></i>','Текст'],
                            ['matching','<i class="fa-solid fa-arrows-left-right"></i>','Пари'],
                            ['ordering','<i class="fa-solid fa-list-ol"></i>','Порядок']
                        ].map(([t,ic,lb]) => `
                            <div class="te-type-opt" onclick="TestsManagerPage.addQuestion('${t}')">
                                <span>${ic}</span><span>${lb}</span>
                            </div>`).join('')}
                    </div>
                </div>
                <label class="te-import-btn">
                    <i class="fa-solid fa-file-import"></i> Імпортувати
                    <input type="file" accept=".txt" style="display:none" onchange="TestsManagerPage._onImportFile(this)">
                </label>
            </div>
        </div>
    </div>
</div>`;

        if (this._questions.length) {
            this._selectQuestion(0);
        }

        if (this._closeAddMenuHandler) {
            document.removeEventListener('click', this._closeAddMenuHandler);
        }
        document.addEventListener('click', this._closeAddMenuHandler = (e) => {
            if (!document.getElementById('te-addq-wrap')?.contains(e.target)) {
                document.getElementById('te-type-dd')?.classList.remove('open');
            }
        });

    },

    _toolbarHtml() {
        const q = this._questions[this._activeIdx];
        const type = q?.question_type || this._qType;
        const pts  = q?.points || 1;
        return `
<div class="te-type-chips">
    ${[['single','<i class="fa-solid fa-circle-dot"></i>','Одиночний'],['multiple','<i class="fa-solid fa-square-check"></i>','Множинний'],['text','<i class="fa-solid fa-pen-nib"></i>','Текст'],['matching','<i class="fa-solid fa-arrows-left-right"></i>','Пари'],['ordering','<i class="fa-solid fa-list-ol"></i>','Порядок']]
        .map(([t,ic,lb]) => `<button class="te-type-chip${type===t?' active':''}" data-type="${t}" onclick="TestsManagerPage._onTypeChange('${t}')">${ic}<span>${lb}</span></button>`).join('')}
</div>
<div class="te-pts-wrap">
    <span class="te-pts-lbl">Балів:</span>
    <input class="te-pts-inp" type="number" id="te-pts" min="1" max="100" value="${pts}">
</div>`;
    },

    _renderQList() {
        if (!this._questions.length) return `
            <div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:.82rem">Питань поки немає</div>`;
        const typeLabels = {single:'Одиночне',multiple:'Множинне',text:'Вільна відповідь',matching:'Співставлення',ordering:'Упорядкування'};
        return this._questions.map((q, i) => {
            const rawText = q.question_text || q.body || '';
            const text = rawText.replace(/<[^>]*>/g,'').trim() || 'Питання ' + (i+1);
            return `
<div class="te-qitem${i===this._activeIdx?' active':''}" draggable="true"
    onclick="TestsManagerPage._selectQuestion(${i})"
    ondragstart="TestsManagerPage._handleQDragStart(event,${i})"
    ondragover="TestsManagerPage._handleQDragOver(event,${i})"
    ondragleave="TestsManagerPage._handleQDragLeave(event)"
    ondrop="TestsManagerPage._handleQDrop(event,${i})">
    <div class="te-qitem-num">${i+1}</div>
    <div class="te-qitem-body">
        <div class="te-qitem-text">${text}</div>
        <div class="te-qitem-type">${typeLabels[q.question_type]||q.question_type}</div>
    </div>
    <button class="te-qitem-dupe" title="Дублювати" onclick="event.stopPropagation();TestsManagerPage.duplicateQuestion(${i})"><i class="fa-regular fa-copy"></i></button>
    <button class="te-qitem-del" title="Видалити" onclick="event.stopPropagation();TestsManagerPage.deleteQuestion('${q.id}')"><i class="fa-solid fa-xmark"></i></button>
</div>`;
        }).join('');
    },

    _selectQuestion(idx) {
        this._activeIdx = idx;
        const q = this._questions[idx];
        if (!q) return;
        this._qType = q.question_type;

        // Build options from existing answers
        if (q.question_type === 'matching') {
            this._opts = (q.answers||[]).map(a => {
                const parts = (a.answer_text||'').split('|||');
                return { left: parts[0]||'', right: parts[1]||'', image_url: a.image_url||null, image_align: a.image_align||'left' };
            });
        } else if (q.question_type === 'ordering') {
            this._opts = [...(q.answers||[])].sort((a,b) => a.order_index - b.order_index).map(a => ({ text: a.answer_text||'', image_url: a.image_url||null, image_align: a.image_align||'left' }));
        } else {
            this._opts = (q.answers||[]).map(a => {
                let html = a.answer_text || '';
                if (a.image_url && !html.includes('<img')) {
                    html = `<img src="${a.image_url}">${html ? ' ' + html : ''}`;
                }
                return { id: a.id, html, correct: a.is_correct };
            });
        }

        // Update toolbar
        const toolbar = document.getElementById('te-toolbar');
        if (toolbar) toolbar.innerHTML = this._toolbarHtml();

        // Update question list highlight
        document.querySelectorAll('.te-qitem').forEach((el,i) => el.classList.toggle('active', i===idx));

        // Render editor
        this._renderQuestionEditor();
    },

    _renderQuestionEditor() {
        const q = this._questions[this._activeIdx];
        if (!q) return;
        const content = document.getElementById('te-left-content');
        if (!content) return;

        content.innerHTML = `
<div class="te-lbl">Текст питання</div>
<div class="te-quill-wrap"><div id="te-quill"></div></div>
<div id="te-media-panel">${this._renderMediaPanel()}</div>
<div class="te-lbl">Варіанти відповідей</div>
<div id="te-options-area">${this._optionsHtml()}</div>
<div class="te-explanation-wrap">
    <div class="te-lbl"><i class="fa-solid fa-lightbulb"></i> Пояснення (показується після відповіді)</div>
    <textarea class="te-explanation" id="te-explanation" placeholder="Необов'язково — поясніть правильну відповідь...">${q.explanation||''}</textarea>
</div>
<button class="te-save-btn" onclick="TestsManagerPage.saveCurrentQuestion()"><i class="fa-solid fa-floppy-disk"></i> Зберегти питання</button>`;

        // Init Quill
        if (this._quill) { try { this._quill = null; } catch{} }
        setTimeout(() => {
            const el = document.getElementById('te-quill');
            if (!el) return;
            this._quill = new Quill('#te-quill', {
                theme: 'snow',
                modules: this._buildQuillModules()
            });
            const text = q.question_text || q.body || '';
            // Direct innerHTML preserves inline styles (width, float, margin) set by
            // the resize/alignment tools. dangerouslyPasteHTML converts through Delta
            // and strips all img style attributes.
            if (text) this._quill.root.innerHTML = text;

            // Clipboard image paste → compress → upload → insert
            this._quill.root.addEventListener('paste', async e => {
                const items = Array.from(e.clipboardData?.items || []);
                const imgItem = items.find(it => it.type.startsWith('image/'));
                if (!imgItem) return;
                e.preventDefault(); e.stopPropagation();
                const file = imgItem.getAsFile();
                if (!file) return;
                const qNow = TestsManagerPage._questions[TestsManagerPage._activeIdx];
                if (!qNow) return;
                Loader.show();
                try {
                    const comp = await TestsManagerPage._compressImage(file);
                    const { url } = await API.testImages.upload(comp, TestsManagerPage._curTest.id, qNow.id);
                    if (!qNow.images) qNow.images = [];
                    qNow.images.push(url);
                    await API.questions.update(qNow.id, { images: qNow.images });
                    document.getElementById('te-media-panel').outerHTML = TestsManagerPage._renderMediaPanel();
                    const range = TestsManagerPage._quill.getSelection(true);
                    TestsManagerPage._quill.insertEmbed(range.index, 'image', url);
                    TestsManagerPage._quill.setSelection(range.index + 1);
                } catch(ex) { Toast.error('Помилка вставки', ex.message); }
                finally { Loader.hide(); }
            });

            // Image resize handles inside Quill
            if (this._questionResizeAbort) this._questionResizeAbort.abort();
            this._questionResizeAbort = this._initImageResize(this._quill);

            // Drag thumbnail from media panel → drop into Quill text
            this._quill.root.addEventListener('dragover', e => {
                if (TestsManagerPage._draggedImageUrl) {
                    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
                    TestsManagerPage._quill.root.classList.add('drag-active');
                }
            });
            this._quill.root.addEventListener('dragleave', () => TestsManagerPage._quill.root.classList.remove('drag-active'));
            this._quill.root.addEventListener('drop', e => {
                const url = TestsManagerPage._draggedImageUrl;
                if (!url) return;
                e.preventDefault(); e.stopPropagation();
                TestsManagerPage._quill.root.classList.remove('drag-active');
                const sel = TestsManagerPage._quill.getSelection() || { index: Math.max(0, TestsManagerPage._quill.getLength() - 1) };
                TestsManagerPage._quill.insertEmbed(sel.index, 'image', url);
                TestsManagerPage._quill.setSelection(sel.index + 1);
                TestsManagerPage._draggedImageUrl = null;
            });
        }, 50);
    },

    _optionsHtml() {
        const type = this._qType;
        if (type === 'text') {
            return `<div class="te-text-hint"><i class="fa-solid fa-pen-nib"></i> Користувач введе текстову відповідь. Перевірка відбувається вручну адміністратором у розділі «Результати».</div>`;
        }
        if (type === 'matching') {
            if (!this._opts.length) this._opts = [{left:'',right:'',image_url:null},{left:'',right:'',image_url:null}];
            return `
<div id="te-match-list">
${this._opts.map((p,i) => `
<div style="margin-bottom:10px">
<div class="te-match-row">
    <input class="te-match-inp" placeholder="Ліва частина..." value="${(p.left||'').replace(/"/g,'&quot;')}" oninput="TestsManagerPage._opts[${i}].left=this.value">
    <span class="te-match-arrow"><i class="fa-solid fa-arrows-left-right"></i></span>
    <input class="te-match-inp" placeholder="Права частина..." value="${(p.right||'').replace(/"/g,'&quot;')}" oninput="TestsManagerPage._opts[${i}].right=this.value">
    ${p.image_url
        ? `<div class="te-opt-img-wrap"><img src="${p.image_url}" class="te-opt-img" alt="" onclick="TestsManagerPage._openLightbox(this.src)"><button class="te-opt-img-del" onclick="TestsManagerPage._removeAnswerImage(${i})"><i class="fa-solid fa-xmark"></i></button></div>`
        : `<button class="te-opt-img-btn" data-aidx="${i}" title="Додати зображення" onclick="TestsManagerPage._showImgPicker(${i})"><i class="fa-solid fa-image"></i></button>`}
    <button class="te-opt-del" onclick="TestsManagerPage.removeOption(${i})"><i class="fa-solid fa-xmark"></i></button>
</div></div>`).join('')}
</div>
<button class="te-add-opt" onclick="TestsManagerPage.addOption()"><i class="fa-solid fa-plus"></i> Додати пару</button>`;
        }
        if (type === 'ordering') {
            if (!this._opts.length) this._opts = [{text:'',image_url:null},{text:'',image_url:null}];
            return `
<div id="te-order-list">
<p style="font-size:.78rem;color:var(--text-muted);margin-bottom:10px">Введіть елементи у правильному порядку <i class="fa-solid fa-arrow-down"></i></p>
${this._opts.map((it,i) => `
<div class="te-order-item">
    <span class="te-opt-handle"><i class="fa-solid fa-grip-vertical"></i></span>
    <div class="te-order-num">${i+1}</div>
    ${it.image_url
        ? `<div class="te-opt-img-wrap"><img src="${it.image_url}" class="te-opt-img" alt="" onclick="TestsManagerPage._openLightbox(this.src)"><button class="te-opt-img-del" onclick="TestsManagerPage._removeAnswerImage(${i})"><i class="fa-solid fa-xmark"></i></button></div>`
        : `<button class="te-opt-img-btn" data-aidx="${i}" title="Додати зображення" onclick="TestsManagerPage._showImgPicker(${i})"><i class="fa-solid fa-image"></i></button>`}
    <input class="te-opt-inp" placeholder="Елемент ${i+1}..." value="${(it.text||'').replace(/"/g,'&quot;')}" oninput="TestsManagerPage._opts[${i}].text=this.value">
    <button class="te-opt-del" onclick="TestsManagerPage.removeOption(${i})"><i class="fa-solid fa-xmark"></i></button>
</div>`).join('')}
</div>
<button class="te-add-opt" onclick="TestsManagerPage.addOption()"><i class="fa-solid fa-plus"></i> Додати елемент</button>`;
        }
        // single / multiple — each answer is a full Quill editor card
        const isMulti = type === 'multiple';
        if (!this._opts.length) this._opts = [{html:'',correct:false},{html:'',correct:false}];
        setTimeout(() => this._initAnswerQuills(), 0);
        return `
<div class="te-ans-cards" id="te-opts-list">
${this._opts.map((o,i) => `
<div class="te-ans-card${o.correct?' correct':''}" id="te-ans-card-${i}">
    <div class="te-ans-card-head">
        <span class="te-opt-handle"><i class="fa-solid fa-grip-vertical"></i></span>
        <div class="te-opt-marker" style="${isMulti?'border-radius:4px':''}"></div>
        <span style="font-size:.75rem;color:var(--text-muted);flex:1">Варіант ${i+1}</span>
        <button class="te-opt-correct-btn${o.correct?' on':''}" onclick="TestsManagerPage.toggleCorrect(${i})">${o.correct?'<i class="fa-solid fa-check"></i> Правильна':'<i class="fa-regular fa-circle"></i> Правильна?'}</button>
        <button class="te-opt-del" onclick="TestsManagerPage.removeOption(${i})"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="te-ans-card-body">
        <div id="te-ans-quill-${i}"></div>
    </div>
</div>`).join('')}
</div>
<button class="te-add-opt" onclick="TestsManagerPage.addOption()"><i class="fa-solid fa-plus"></i> Додати варіант</button>`;
    },

    _onTypeChange(val) {
        this._cleanupAnswerQuills();
        this._qType = val;
        this._opts  = [];
        document.querySelectorAll('.te-type-chip').forEach(el => el.classList.toggle('active', el.dataset.type === val));
        document.getElementById('te-options-area').innerHTML = this._optionsHtml();
    },

    addOption() {
        const type = this._qType;
        if (type === 'matching') this._opts.push({ left:'', right:'' });
        else if (type === 'ordering') this._opts.push({ text:'' });
        else { this._syncAnswerQuillsToOpts(); this._opts.push({ html:'', correct: false }); }
        document.getElementById('te-options-area').innerHTML = this._optionsHtml();
    },

    removeOption(idx) {
        this._syncAnswerQuillsToOpts();
        this._cleanupAnswerQuills();
        this._opts.splice(idx, 1);
        document.getElementById('te-options-area').innerHTML = this._optionsHtml();
    },

    toggleCorrect(idx) {
        this._syncAnswerQuillsToOpts();
        if (this._qType === 'single') {
            this._opts.forEach((o,i) => o.correct = i === idx);
        } else {
            this._opts[idx].correct = !this._opts[idx].correct;
        }
        document.getElementById('te-options-area').innerHTML = this._optionsHtml();
    },

    async saveCurrentQuestion() {
        const q = this._questions[this._activeIdx];
        if (!q) return;
        const questionText = this._quill ? this._quill.root.innerHTML : (q.question_text||q.body||'');
        const pts = parseInt(document.getElementById('te-pts')?.value) || 1;
        const type = this._qType;

        Loader.show();
        try {
            const explanation = document.getElementById('te-explanation')?.value.trim() || null;
            await API.questions.update(q.id, {
                question_text: questionText,
                question_type: type,
                points:        pts,
                explanation,
                order_index:   this._activeIdx
            });

            // Save answers
            this._syncAnswerQuillsToOpts();
            let answers = [];
            if (type === 'single' || type === 'multiple') {
                answers = this._opts.filter(o => { const h = o.html||''; return h && h !== '<p><br></p>'; }).map(o => ({ text: o.html||'', is_correct: !!o.correct, image_url: null, image_align: 'left' }));
            } else if (type === 'matching') {
                answers = this._opts.filter(o => o.left?.trim() || o.image_url).map(o => ({ text: (o.left||'').trim() + '|||' + (o.right||'').trim(), is_correct: true, image_url: o.image_url||null, image_align: o.image_align||'left' }));
            } else if (type === 'ordering') {
                answers = this._opts.filter(o => o.text?.trim() || o.image_url).map(o => ({ text: (o.text||'').trim(), is_correct: true, image_url: o.image_url||null, image_align: o.image_align||'left' }));
            }
            const savedAnswers = await API.questions.upsertAnswers(q.id, answers);

            // Refresh local
            q.question_type = type;
            q.question_text = questionText;
            q.points        = pts;
            q.explanation   = explanation;
            q.answers       = savedAnswers;
            document.getElementById('te-qlist').innerHTML = this._renderQList();
            Toast.success('Збережено');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async addQuestion(type) {
        document.getElementById('te-type-dd')?.classList.remove('open');
        const test = this._curTest;
        Loader.show();
        try {
            const q = await API.questions.create({
                test_id:       test.id,
                question_text: '',
                question_type: type,
                points:        1,
                order_index:   this._questions.length
            });
            q.answers = [];
            this._questions.push(q);
            document.getElementById('te-qlist').innerHTML   = this._renderQList();
            document.getElementById('te-qcount').textContent = this._questions.length;
            document.getElementById('te-toolbar').innerHTML  = this._toolbarHtml();
            this._selectQuestion(this._questions.length - 1);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _parseImportText(text) {
        const blocks = text.trim().split(/\n(?=\d+\.\s)/);
        return blocks.map(block => {
            const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
            if (!lines.length) return null;
            lines[0] = lines[0].replace(/^\d+\.\s*/, '').trim();
            const qLines = [], answerLines = [];
            for (const l of lines) {
                if (/^\([!?]\)/.test(l)) answerLines.push(l);
                else qLines.push(l);
            }
            const question_text = qLines.join(' ').trim();
            if (!question_text) return null;
            const answers = answerLines.map(l => ({ text: l.replace(/^\([!?]\)\s*/, '').trim(), is_correct: l.startsWith('(!)') }));
            const correctCount = answers.filter(a => a.is_correct).length;
            const question_type = !answers.length ? 'text' : correctCount === 1 ? 'single' : 'multiple';
            return { question_text, question_type, answers };
        }).filter(Boolean);
    },

    async _onImportFile(input) {
        const file = input.files[0];
        input.value = '';
        if (!file) return;
        let text;
        try { text = await file.text(); } catch { Toast.error('Імпорт', 'Не вдалося прочитати файл'); return; }
        const parsed = this._parseImportText(text);
        if (!parsed.length) { Toast.error('Імпорт', 'Питань не знайдено'); return; }
        Loader.show();
        try {
            for (const item of parsed) {
                const q = await API.questions.create({
                    test_id:       this._curTest.id,
                    question_text: item.question_text,
                    question_type: item.question_type,
                    points:        1,
                    order_index:   this._questions.length
                });
                q.answers = item.answers.length
                    ? await API.questions.upsertAnswers(q.id, item.answers.map(a => ({ text: a.text, is_correct: a.is_correct, image_url: null })))
                    : [];
                this._questions.push(q);
            }
            document.getElementById('te-qlist').innerHTML    = this._renderQList();
            document.getElementById('te-qcount').textContent = this._questions.length;
            document.getElementById('te-toolbar').innerHTML  = this._toolbarHtml();
            this._selectQuestion(this._questions.length - 1);
            Toast.success('Імпорт', `Додано ${parsed.length} питань`);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async deleteQuestion(id) {
        const q = this._questions.find(q => q.id === id);
        const label = q?.question_text ? q.question_text.replace(/<[^>]*>/g,'').trim().slice(0,60) : null;
        const ok = await Modal.confirm({
            title: 'Видалити питання?',
            message: label ? `«${label}${label.length >= 60 ? '…' : ''}» буде видалено назавжди.` : 'Питання буде видалено назавжди.',
            confirmText: 'Видалити',
            danger: true
        });
        if (!ok) return;
        Loader.show();
        try {
            await API.questions.delete(id);
            const idx = this._questions.findIndex(q => q.id === id);
            this._questions.splice(idx, 1);
            const newIdx = Math.min(this._activeIdx, this._questions.length - 1);
            this._activeIdx = -1;
            document.getElementById('te-qlist').innerHTML    = this._renderQList();
            document.getElementById('te-qcount').textContent = this._questions.length;
            if (this._questions.length) this._selectQuestion(newIdx);
            else {
                document.getElementById('te-toolbar').innerHTML = '<span style="color:var(--text-muted);font-size:.85rem">Оберіть або додайте питання</span>';
                document.getElementById('te-left-content').innerHTML = `<div class="te-empty-q"><div class="te-empty-q-ico"><i class="fa-solid fa-pen"></i></div><div>Додайте питання у правій панелі</div></div>`;
            }
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Images ───────────────────────────────────────────────────

    _renderMediaPanel() {
        const q = this._questions[this._activeIdx];
        const images = q?.images || [];
        return `<div class="te-media-panel" id="te-media-panel">
    <div class="te-media-head">
        <div class="te-lbl" style="margin-bottom:0"><i class="fa-solid fa-paperclip"></i> Медіа</div>
        <label class="te-upload-lbl">
            <i class="fa-solid fa-upload"></i> Завантажити
            <input type="file" accept="image/*" multiple style="display:none" onchange="TestsManagerPage._uploadImages(this.files)">
        </label>
    </div>
    ${images.length ? `<div class="te-media-thumbs">${images.map(url => `
        <div class="te-media-thumb">
            <img src="${url}" alt="" draggable="true"
                ondragstart="TestsManagerPage._onThumbDragStart(event,'${url}')"
                onclick="TestsManagerPage._openLightbox('${url}')">
            <div class="te-media-thumb-actions">
                <button onclick="event.stopPropagation();TestsManagerPage._insertImageToQuill('${url}')"><i class="fa-solid fa-arrow-up"></i> В текст</button>
                <button onclick="event.stopPropagation();TestsManagerPage._deleteImage('${url}')" style="color:#c00"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`).join('')}</div>`
    : `<div style="font-size:.78rem;color:var(--text-muted);padding:4px 0">Немає зображень</div>`}
</div>`;
    },

    async _uploadImages(files) {
        const q = this._questions[this._activeIdx];
        if (!q) return;
        Loader.show();
        try {
            for (const file of files) {
                const comp = await this._compressImage(file);
                const { url } = await API.testImages.upload(comp, this._curTest.id, q.id);
                if (!q.images) q.images = [];
                q.images.push(url);
            }
            await API.questions.update(q.id, { images: q.images });
            document.getElementById('te-media-panel').outerHTML = this._renderMediaPanel();
        } catch(e) { Toast.error('Помилка завантаження', e.message); }
        finally { Loader.hide(); }
    },

    async _deleteImage(url) {
        const q = this._questions[this._activeIdx];
        if (!q) return;
        Loader.show();
        try {
            await API.testImages.remove(url);
            q.images = (q.images || []).filter(u => u !== url);
            await API.questions.update(q.id, { images: q.images });
            document.getElementById('te-media-panel').outerHTML = this._renderMediaPanel();
        } catch(e) { Toast.error('Помилка видалення', e.message); }
        finally { Loader.hide(); }
    },

    _insertImageToQuill(url) {
        if (!this._quill) return;
        const range = this._quill.getSelection(true);
        this._quill.insertEmbed(range.index, 'image', url);
        this._quill.setSelection(range.index + 1);
    },

    _syncAnswerQuillsToOpts() {
        if (this._qType !== 'single' && this._qType !== 'multiple') return;
        (this._answerQuills || []).forEach((q, i) => {
            if (q && this._opts[i]) this._opts[i].html = q.root.innerHTML;
        });
    },

    _cleanupAnswerQuills() {
        (this._answerResizeAborts || []).forEach(ac => ac?.abort());
        this._answerResizeAborts = [];
        this._answerQuills = [];
    },

    _quillSetup() {
        if (this._quillSetupDone) return;
        this._quillSetupDone = true;

        const FontStyle = Quill.import('attributors/style/font');
        FontStyle.whitelist = ['Arial', 'Georgia', 'Courier New', 'Tahoma', 'Verdana'];
        Quill.register(FontStyle, true);

        const SizeStyle = Quill.import('attributors/style/size');
        SizeStyle.whitelist = ['10px', '12px', '14px', '18px', '20px', '24px', '28px'];
        Quill.register(SizeStyle, true);

    },

    _buildQuillModules() {
        this._quillSetup();
        const fontList = ['Arial', 'Georgia', 'Courier New', 'Tahoma', 'Verdana'];
        const sizeList = ['10px', '12px', '14px', false, '18px', '20px', '24px', '28px'];

        const toolbarContainer = [
            [{ font: fontList }],
            [{ size: sizeList }],
            ['bold', 'italic', 'underline'],
            [{ color: [] }],
            ['link'],
            ['clean'],
        ];

        return { toolbar: toolbarContainer };
    },


    _initAnswerQuills() {
        this._cleanupAnswerQuills();
        if (this._qType !== 'single' && this._qType !== 'multiple') return;
        const qData = this._questions[this._activeIdx];
        this._opts.forEach((opt, i) => {
            const el = document.getElementById(`te-ans-quill-${i}`);
            if (!el) return;
            const q = new Quill(`#te-ans-quill-${i}`, {
                theme: 'snow',
                modules: this._buildQuillModules()
            });
            if (opt.html) q.root.innerHTML = opt.html;

            // Paste image → upload → insert
            q.root.addEventListener('paste', async e => {
                const items = Array.from(e.clipboardData?.items || []);
                const imgItem = items.find(it => it.type.startsWith('image/'));
                if (!imgItem) return;
                e.preventDefault(); e.stopPropagation();
                const file = imgItem.getAsFile();
                if (!file || !qData) return;
                Loader.show();
                try {
                    const comp = await TestsManagerPage._compressImage(file);
                    const { url } = await API.testImages.upload(comp, TestsManagerPage._curTest.id, qData.id);
                    if (!qData.images) qData.images = [];
                    qData.images.push(url);
                    await API.questions.update(qData.id, { images: qData.images });
                    document.getElementById('te-media-panel').outerHTML = TestsManagerPage._renderMediaPanel();
                    const range = q.getSelection(true);
                    q.insertEmbed(range.index, 'image', url);
                    q.setSelection(range.index + 1);
                } catch(ex) { Toast.error('Помилка', ex.message); }
                finally { Loader.hide(); }
            });

            // Drag thumbnail → drop into answer
            q.root.addEventListener('dragover', e => {
                if (TestsManagerPage._draggedImageUrl) {
                    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
                    q.root.classList.add('drag-active');
                }
            });
            q.root.addEventListener('dragleave', () => q.root.classList.remove('drag-active'));
            q.root.addEventListener('drop', e => {
                const url = TestsManagerPage._draggedImageUrl;
                if (!url) return;
                e.preventDefault(); e.stopPropagation();
                q.root.classList.remove('drag-active');
                const sel = q.getSelection() || { index: Math.max(0, q.getLength() - 1) };
                q.insertEmbed(sel.index, 'image', url);
                q.setSelection(sel.index + 1);
                TestsManagerPage._draggedImageUrl = null;
            });

            this._answerResizeAborts.push(this._initImageResize(q));
            this._answerQuills.push(q);
        });
    },

    _initImageResize(quill) {
        const ac  = new AbortController();
        const sig = ac.signal;

        let activeImg = null;

        // Attach overlay to .ql-container (parent of .ql-editor) so Quill's
        // MutationObserver on .ql-editor never sees it and won't call emitter.emit.
        const wrap = quill.root.parentElement;
        wrap.style.position = 'relative';

        const ov = document.createElement('div');
        ov.style.cssText = 'position:absolute;box-sizing:border-box;border:2px solid var(--primary,#6366f1);pointer-events:none;display:none;z-index:5;border-radius:2px';
        const handle = document.createElement('div');
        handle.title = 'Змінити розмір';
        handle.style.cssText = 'position:absolute;bottom:-6px;right:-6px;width:12px;height:12px;background:var(--primary,#6366f1);border:2px solid #fff;border-radius:2px;cursor:se-resize;pointer-events:all';
        ov.appendChild(handle);
        wrap.appendChild(ov);

        // Alignment toolbar
        const tbar = document.createElement('div');
        tbar.className = 'ql-img-toolbar';
        tbar.innerHTML = [
            ['block',  '<i class="fa-solid fa-expand"></i>', 'Блок'],
            ['center', '<i class="fa-solid fa-align-center"></i>',  'По центру'],
            ['left',   '<i class="fa-solid fa-align-left"></i>',  'Обтекання ліворуч'],
            ['right',  '<i class="fa-solid fa-align-right"></i>',  'Обтекання праворуч'],
        ].map(([a, ic, t]) => `<button data-align="${a}" title="${t}">${ic}</button>`).join('');
        wrap.appendChild(tbar);

        const hideAll = () => {
            ov.style.display = 'none';
            tbar.style.display = 'none';
            activeImg = null;
        };

        const syncOv = () => {
            if (!activeImg || !quill.root.contains(activeImg)) { hideAll(); return; }
            const ir = activeImg.getBoundingClientRect();
            const wr = wrap.getBoundingClientRect();
            const top = ir.top - wr.top, left = ir.left - wr.left;
            ov.style.cssText += `;top:${top}px;left:${left}px;width:${ir.width}px;height:${ir.height}px;display:block`;
            // Toolbar centered on image
            const tbW = tbar.offsetWidth  || 172;
            const tbH = tbar.offsetHeight || 46;
            tbar.style.top  = (top  + ir.height / 2 - tbH / 2) + 'px';
            tbar.style.left = Math.max(0, Math.min(left + ir.width / 2 - tbW / 2, wr.width - tbW - 4)) + 'px';
            tbar.style.display = 'flex';
            // Highlight active alignment
            const fl = activeImg.style.float;
            const centered = !fl && activeImg.style.marginLeft === 'auto';
            tbar.querySelectorAll('button').forEach(btn => {
                const a = btn.dataset.align;
                btn.classList.toggle('on',
                    (a === 'left'   && fl === 'left') ||
                    (a === 'right'  && fl === 'right') ||
                    (a === 'center' && centered) ||
                    (a === 'block'  && !fl && !centered)
                );
            });
        };

        quill.root.addEventListener('click', e => {
            if (e.target.tagName !== 'IMG') { hideAll(); return; }
            activeImg = e.target;
            syncOv();
        }, { signal: sig });
        quill.root.addEventListener('scroll', syncOv, { signal: sig });

        tbar.addEventListener('click', e => {
            const btn = e.target.closest('button[data-align]');
            if (!btn || !activeImg) return;
            e.stopPropagation();
            activeImg.style.float = activeImg.style.display = activeImg.style.margin = '';
            const a = btn.dataset.align;
            if (a === 'block')  { activeImg.style.display = 'block'; activeImg.style.margin = '8px 0'; }
            if (a === 'center') { activeImg.style.display = 'block'; activeImg.style.margin = '8px auto'; }
            if (a === 'left')   { activeImg.style.float = 'left';  activeImg.style.margin = '0 12px 8px 0'; }
            if (a === 'right')  { activeImg.style.float = 'right'; activeImg.style.margin = '0 0 8px 12px'; }
            syncOv();
        }, { signal: sig });

        handle.addEventListener('mousedown', e => {
            if (!activeImg) return;
            e.preventDefault();
            const startX = e.clientX;
            const startW = activeImg.getBoundingClientRect().width;
            const onMove = ev => {
                activeImg.style.width  = Math.max(40, startW + ev.clientX - startX) + 'px';
                activeImg.style.height = 'auto';
                syncOv();
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        }, { signal: sig });

        document.addEventListener('click', e => {
            if (!wrap.contains(e.target)) hideAll();
        }, { signal: sig });

        return ac;
    },

    _compressImage(file, maxWidth = 1400, quality = 0.85) {
        return new Promise(resolve => {
            const img = new Image();
            const objUrl = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(objUrl);
                if (img.width <= maxWidth) { resolve(file); return; }
                const scale = maxWidth / img.width;
                const canvas = document.createElement('canvas');
                canvas.width  = Math.round(img.width  * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(blob => {
                    if (!blob) { resolve(file); return; }
                    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
                    resolve(new File([blob], `${base}.jpg`, { type: 'image/jpeg' }));
                }, 'image/jpeg', quality);
            };
            img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
            img.src = objUrl;
        });
    },

    _openLightbox(url) {
        document.getElementById('img-lightbox')?.remove();
        const ov = document.createElement('div');
        ov.id = 'img-lightbox';
        ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;cursor:zoom-out;backdrop-filter:blur(3px);animation:lb-in .15s ease';
        ov.innerHTML = '<style>@keyframes lb-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}</style>'
            + `<img src="${url}" style="max-width:90vw;max-height:90vh;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.6);object-fit:contain;user-select:none;pointer-events:none">`;
        const close = () => ov.remove();
        ov.onclick = close;
        const onKey = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
        document.addEventListener('keydown', onKey);
        ov.addEventListener('remove', () => document.removeEventListener('keydown', onKey));
        document.body.appendChild(ov);
    },

    _onThumbDragStart(e, url) {
        this._draggedImageUrl = url;
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', url);
        e.target.addEventListener('dragend', () => { this._draggedImageUrl = null; }, { once: true });
    },

    _showImgPicker(answerIdx) {
        const existing = document.getElementById('te-img-picker');
        if (existing) {
            if (existing.dataset.target === String(answerIdx)) { existing.remove(); return; }
            existing.remove();
        }
        const q = this._questions[this._activeIdx];
        const images = q?.images || [];
        const btn = document.querySelector(`.te-opt-img-btn[data-aidx="${answerIdx}"]`);

        const picker = document.createElement('div');
        picker.id = 'te-img-picker';
        picker.dataset.target = answerIdx;
        picker.style.cssText = 'position:fixed;z-index:300;background:var(--bg-surface);border:1.5px solid var(--border);border-radius:12px;padding:10px;box-shadow:0 8px 28px rgba(0,0,0,.2);display:flex;flex-wrap:wrap;gap:8px;max-width:310px;max-height:220px;overflow-y:auto';

        if (!images.length) {
            picker.innerHTML = '<div style="font-size:.78rem;color:var(--text-muted);padding:8px">Немає зображень — завантажте в панелі медіа</div>';
        } else {
            picker.innerHTML = images.map(url => `<img src="${url}"
                style="width:64px;height:64px;object-fit:cover;border-radius:8px;cursor:pointer;border:1.5px solid var(--border);transition:border-color .1s"
                onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'"
                onclick="TestsManagerPage._setAnswerImage(${answerIdx},'${url}');document.getElementById('te-img-picker')?.remove()">`).join('');
        }

        if (btn) {
            const rect = btn.getBoundingClientRect();
            picker.style.top  = (rect.bottom + 6) + 'px';
            picker.style.left = Math.min(rect.left, window.innerWidth - 330) + 'px';
        } else {
            picker.style.top = '50%'; picker.style.left = '50%';
        }
        document.body.appendChild(picker);
        setTimeout(() => {
            document.addEventListener('click', function h(e) {
                if (!picker.contains(e.target) && e.target !== btn) {
                    picker.remove(); document.removeEventListener('click', h);
                }
            });
        }, 0);
    },

    _setAnswerImage(idx, url) {
        this._opts[idx].image_url = url;
        document.getElementById('te-options-area').innerHTML = this._optionsHtml();
    },

    _removeAnswerImage(idx) {
        this._opts[idx].image_url = null;
        document.getElementById('te-options-area').innerHTML = this._optionsHtml();
    },

    _setAnswerAlign(idx, align) {
        this._opts[idx].image_align = align;
        document.getElementById('te-options-area').innerHTML = this._optionsHtml();
    },

    // ── Question duplication & drag ───────────────────────────────

    async duplicateQuestion(idx) {
        const q = this._questions[idx];
        Loader.show();
        try {
            const newQ = await API.questions.create({
                test_id:       this._curTest.id,
                question_text: q.question_text,
                question_type: q.question_type,
                points:        q.points,
                explanation:   q.explanation || null,
                images:        q.images || [],
                order_index:   this._questions.length
            });
            const answers = (q.answers || []).map(a => ({
                text:       a.answer_text,
                is_correct: a.is_correct,
                image_url:  a.image_url || null
            }));
            newQ.answers = answers.length ? await API.questions.upsertAnswers(newQ.id, answers) : [];
            this._questions.push(newQ);
            document.getElementById('te-qlist').innerHTML    = this._renderQList();
            document.getElementById('te-qcount').textContent = this._questions.length;
            Toast.success('Питання скопійовано');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _handleQDragStart(e, idx) {
        this._dragSrcIdx = idx;
        e.dataTransfer.effectAllowed = 'move';
    },

    _handleQDragOver(e, idx) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        document.querySelectorAll('.te-qitem').forEach((el, i) =>
            el.classList.toggle('drag-over', i === idx && i !== this._dragSrcIdx));
    },

    _handleQDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    },

    async _handleQDrop(e, toIdx) {
        e.preventDefault();
        document.querySelectorAll('.te-qitem').forEach(el => el.classList.remove('drag-over'));
        const fromIdx = this._dragSrcIdx;
        this._dragSrcIdx = null;
        if (fromIdx == null || fromIdx === toIdx) return;

        const moved = this._questions.splice(fromIdx, 1)[0];
        this._questions.splice(toIdx, 0, moved);

        if      (this._activeIdx === fromIdx)                                   this._activeIdx = toIdx;
        else if (fromIdx < this._activeIdx && toIdx >= this._activeIdx)         this._activeIdx--;
        else if (fromIdx > this._activeIdx && toIdx <= this._activeIdx)         this._activeIdx++;

        document.getElementById('te-qlist').innerHTML    = this._renderQList();
        document.getElementById('te-qcount').textContent = this._questions.length;
        try {
            await Promise.all(this._questions.map((q, i) => API.questions.update(q.id, { order_index: i })));
        } catch(e) { Toast.error('Помилка збереження порядку', e.message); }
    },

    // ── Test list features ────────────────────────────────────────

    _filterTests(query) {
        const q = query.trim().toLowerCase();
        document.querySelectorAll('.tm-card').forEach(card => {
            const title = card.querySelector('.tm-card-title')?.textContent.toLowerCase() || '';
            card.style.display = (!q || title.includes(q)) ? '' : 'none';
        });
    },

    async duplicateTest(testId) {
        if (!confirm('Створити копію цього тесту?')) return;
        Loader.show();
        try {
            const test    = await API.tests.getById(testId);
            const newTest = await API.tests.create({
                title:               test.title + ' (копія)',
                description:         test.description,
                instructions:        test.instructions,
                passing_score:       test.passing_score,
                max_attempts:        test.max_attempts,
                time_limit_minutes:  test.time_limit_minutes,
                randomize_questions:   test.randomize_questions,
                allow_restart:         test.allow_restart,
                allow_skip:            test.allow_skip,
                show_answer_feedback:  test.show_answer_feedback,
                show_wrong_answers:    test.show_wrong_answers,
                show_results:          test.show_results,
                is_published:        false,
                course_id:           null,
                created_by:          AppState.user.id
            });
            for (const q of (test.questions || [])) {
                const newQ = await API.questions.create({
                    test_id:       newTest.id,
                    question_text: q.question_text,
                    question_type: q.question_type,
                    points:        q.points,
                    explanation:   q.explanation || null,
                    images:        q.images || [],
                    order_index:   q.order_index
                });
                const answers = (q.answers || []).map(a => ({
                    text: a.answer_text, is_correct: a.is_correct, image_url: a.image_url || null
                }));
                if (answers.length) await API.questions.upsertAnswers(newQ.id, answers);
            }
            Toast.success('Тест скопійовано', newTest.title);
            await this._renderList(TestsManagerPage._container);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Preview ───────────────────────────────────────────────────

    async openPreview(testId) {
        const container = TestsManagerPage._container;
        await this._renderPreview(container, testId);
    },

    async _renderPreview(container, testId) {
        container.innerHTML = '<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>';
        let test;
        try { test = await API.tests.getById(testId); }
        catch(e) { Toast.error('Помилка', e.message); this._goBack(container); return; }

        const questions = (test.questions || []).sort((a,b) => a.order_index - b.order_index);
        container.innerHTML = `<style>
.tprev-page{max-width:780px}
.tprev-topbar{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:24px}
.tprev-back{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.83rem;font-weight:500;cursor:pointer;transition:all .15s}
.tprev-back:hover{border-color:var(--primary);color:var(--primary)}
.tprev-badge{padding:4px 12px;border-radius:20px;background:rgba(245,158,11,.12);color:#f59e0b;font-size:.78rem;font-weight:700}
.tprev-q{border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:14px;background:var(--bg-surface)}
.tprev-qnum{font-size:.73rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.tprev-qtext{font-size:.95rem;color:var(--text-primary);margin-bottom:14px;line-height:1.6}
.tprev-qtext img{display:block;max-width:100%;height:auto;border-radius:8px;margin:6px 0;float:none!important;cursor:zoom-in}
.tprev-qtext p{margin:0 0 4px}
.tprev-opt{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-radius:10px;border:1.5px solid var(--border);margin-bottom:8px;background:var(--bg-raised)}
.tprev-opt-marker{width:18px;height:18px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;margin-top:3px}
.tprev-opt-marker.sq{border-radius:4px}
.tprev-opt-body{flex:1;min-width:0;font-size:.9rem;line-height:1.5}
.tprev-opt-body img{display:block;max-width:100%;height:auto;border-radius:8px;margin:4px 0;float:none!important;cursor:zoom-in}
.tprev-opt-body p{margin:0 0 2px}
.tprev-expl{margin-top:12px;padding:10px 14px;border-radius:10px;background:rgba(99,102,241,.07);border:1.5px solid rgba(99,102,241,.2);font-size:.82rem;color:var(--text-secondary)}
</style>
<div class="tprev-page">
    <div class="tprev-topbar">
        <button class="tprev-back" onclick="TestsManagerPage._goBack(TestsManagerPage._container)"><i class="fa-solid fa-arrow-left"></i> Назад</button>
        <span style="font-size:1.1rem;font-weight:700;color:var(--text-primary);flex:1">${test.title}</span>
        <span class="tprev-badge"><i class="fa-solid fa-eye"></i> Перегляд</span>
    </div>
    ${test.description ? `<p style="color:var(--text-muted);margin-bottom:20px;font-size:.9rem">${test.description}</p>` : ''}
    ${questions.map((q, qi) => {
        const ans  = (q.answers||[]).sort((a,b) => a.order_index - b.order_index);
        const pts  = q.points || 1;
        const ptsTxt = pts === 1 ? 'бал' : pts < 5 ? 'бали' : 'балів';
        const imgHtml = a => {
            if (!a.image_url) return '';
            const al = a.image_align || 'left';
            const st = al === 'above'
                ? 'display:block;width:100%;max-height:200px;object-fit:contain;border-radius:8px;margin-bottom:6px'
                : al === 'right'
                    ? 'width:64px;height:64px;object-fit:cover;border-radius:7px;flex-shrink:0;order:2'
                    : 'width:64px;height:64px;object-fit:cover;border-radius:7px;flex-shrink:0';
            return `<img src="${a.image_url}" style="${st}" onclick="TestsManagerPage._openLightbox(${JSON.stringify(a.image_url||'').replace(/"/g,'&quot;')})" title="Збільшити">`;
        };
        let optHtml = '';
        if (q.question_type === 'text') {
            optHtml = `<textarea style="width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.88rem;min-height:80px;resize:vertical;outline:none" placeholder="Відповідь..." disabled></textarea>`;
        } else if (q.question_type === 'matching') {
            optHtml = ans.map(a => {
                const [l, r] = (a.answer_text || '').split('|||');
                return `<div class="tprev-opt">${imgHtml(a)}<span style="flex:1">${l||''}</span><span style="color:var(--text-muted);margin:0 8px"><i class="fa-solid fa-arrows-left-right"></i></span><span style="flex:1">${r||''}</span></div>`;
            }).join('');
        } else if (q.question_type === 'ordering') {
            optHtml = ans.map((a, ai) => `
                <div class="tprev-opt">
                    <span style="width:22px;height:22px;border-radius:50%;background:var(--primary);color:#fff;font-size:.72rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${ai+1}</span>
                    ${imgHtml(a)}<span>${a.answer_text||''}</span>
                </div>`).join('');
        } else {
            // single / multiple — answer_text is Quill HTML
            optHtml = ans.map(a => `
                <div class="tprev-opt">
                    <div class="tprev-opt-marker${q.question_type==='multiple'?' sq':''}"></div>
                    ${imgHtml(a)}
                    <div class="tprev-opt-body">${a.answer_text || ''}</div>
                </div>`).join('');
        }
        return `<div class="tprev-q">
            <div class="tprev-qnum">Питання ${qi+1} &nbsp;·&nbsp; ${pts} ${ptsTxt}</div>
            <div class="tprev-qtext">${q.question_text || ''}</div>
            ${optHtml}
            ${q.explanation ? `<div class="tprev-expl"><i class="fa-solid fa-lightbulb"></i> ${q.explanation}</div>` : ''}
        </div>`;
    }).join('')}
</div>`;
        container.querySelectorAll('.tprev-qtext img').forEach(img => {
            img.style.float = 'none';
            img.onclick = () => TestsManagerPage._openLightbox(img.src);
        });
    },

    async deleteTest(id, title) {
        if (!confirm(`Видалити тест «${title}»? Це незворотньо.`)) return;
        Loader.show();
        try {
            await API.tests.delete(id);
            Toast.success('Тест видалено');
            await this._renderList(TestsManagerPage._container);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _toggleAddMenu() {
        document.getElementById('te-type-dd')?.classList.toggle('open');
    },

    // ── Assign modal ──────────────────────────────────────────────

    async openAssignModal(testId) {
        const container = TestsManagerPage._container;
        await this._renderAssign(container, testId);
    },

    async _renderAssign(container, testId) {
        container.innerHTML = '<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>';
        let allEmployees = [], assigned = [], attemptsMap = new Map(), testTitle = '';
        try {
            [allEmployees, assigned, attemptsMap] = await Promise.all([
                TestsManagerAPI.getAllEmployees(),
                TestsManagerAPI.getAssignments(testId),
                TestsManagerAPI.getAttemptsSummary(testId)
            ]);
            const t = this._tests.find(x => x.id === testId) || this._curTest;
            testTitle = t?.title || '';
        } catch(e) { Toast.error('Помилка', e.message); this._goBack(container); return; }

        // Manager sees only subordinates
        let employees = allEmployees;
        if (!AppState.isAdmin()) {
            employees = allEmployees.filter(e => e.manager_id === AppState.user.id);
        }

        const assignedMap = new Map(assigned.map(a => [a.user_id, a]));
        const deadlines   = assigned.map(a => a.deadline_at).filter(Boolean);
        const commonDl    = deadlines.length && deadlines.every(d => d === deadlines[0])
            ? new Date(deadlines[0]).toISOString().slice(0, 16) : '';

        const positions     = [...new Set(employees.map(e => e.job_position).filter(Boolean))].sort();
        const mgrIds        = [...new Set(employees.map(e => e.manager_id).filter(Boolean))];
        const managers      = mgrIds.map(mid => allEmployees.find(e => e.id === mid)).filter(Boolean);
        const showMgrFilter = AppState.isAdmin() && managers.length > 0;
        const filterCols    = 1 + (positions.length ? 1 : 0) + (showMgrFilter ? 1 : 0);

        container.innerHTML = `<style>
.tasgn-page{max-width:900px;display:flex;flex-direction:column;height:calc(100vh - 120px)}
.tasgn-topbar{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:20px;flex-shrink:0}
.tasgn-back{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.83rem;font-weight:500;cursor:pointer;transition:all .15s}
.tasgn-back:hover{border-color:var(--primary);color:var(--primary)}
.tasgn-controls{flex-shrink:0}
.tasgn-list-wrap{flex:1;overflow-y:auto;border:1px solid var(--border);border-radius:12px;min-height:0}
.tm-assign-item:last-child{border-bottom:none}
</style>
<div class="tasgn-page">
    <div class="tasgn-topbar">
        <button class="tasgn-back" onclick="TestsManagerPage._goBack(TestsManagerPage._container)"><i class="fa-solid fa-arrow-left"></i> Назад</button>
        <span style="font-size:1.1rem;font-weight:700;color:var(--text-primary);flex:1"><i class="fa-solid fa-users"></i> ${testTitle}</span>
        <button class="btn btn-primary" onclick="TestsManagerPage._doAssign('${testId}')"><i class="fa-regular fa-floppy-disk"></i> Зберегти</button>
    </div>
    <div class="tasgn-controls">
        <div style="display:grid;grid-template-columns:repeat(${filterCols},1fr);gap:8px;margin-bottom:10px">
            <input id="tm-search" type="text" placeholder="Пошук за іменем..."
                style="padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.85rem;outline:none"
                oninput="TestsManagerPage._applyAssignFilters()">
            ${positions.length ? `
            <select id="tm-filter-pos" onchange="TestsManagerPage._applyAssignFilters()"
                style="padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.85rem;outline:none">
                <option value="">Всі посади</option>
                ${positions.map(p => `<option value="${p.toLowerCase()}">${p}</option>`).join('')}
            </select>` : ''}
            ${showMgrFilter ? `
            <select id="tm-filter-mgr" onchange="TestsManagerPage._applyAssignFilters()"
                style="padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.85rem;outline:none">
                <option value="">Всі керівники</option>
                ${managers.map(m => `<option value="${m.id}">${m.full_name}</option>`).join('')}
            </select>` : ''}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div style="display:flex;align-items:center;gap:6px">
                <button type="button" class="btn btn-ghost btn-sm" onclick="TestsManagerPage._selectAllFiltered(true)"><i class="fa-solid fa-square-check"></i> Вибрати всіх</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="TestsManagerPage._selectAllFiltered(false)"><i class="fa-regular fa-square"></i> Скинути</button>
                <span id="tm-assign-count" style="font-size:.78rem;color:var(--text-muted);padding-left:4px"></span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
                <label style="font-size:.82rem;color:var(--text-muted);white-space:nowrap">Дедлайн:</label>
                <input type="datetime-local" id="tm-deadline" value="${commonDl}"
                    style="padding:5px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.82rem;outline:none"
                    onchange="this.dataset.changed='true'">
            </div>
        </div>
    </div>
    <div class="tasgn-list-wrap">
        ${employees.map(e => {
            const a      = assignedMap.get(e.id);
            const dlTxt  = a?.deadline_at ? `до ${Fmt.dateShort(a.deadline_at)}` : '';
            const attempt = attemptsMap.get(e.id);
            const statusHtml = attempt
                ? attempt.passed
                    ? `<span style="font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:20px;background:rgba(16,185,129,.12);color:#10b981;white-space:nowrap"><i class="fa-solid fa-check"></i> Пройшов</span>`
                    : `<span style="font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:20px;background:rgba(239,68,68,.1);color:#ef4444;white-space:nowrap"><i class="fa-solid fa-xmark"></i> Не пройшов</span>`
                : a ? `<span style="font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--bg-raised);color:var(--text-muted);white-space:nowrap;border:1px solid var(--border)"><i class="fa-solid fa-pause"></i> Не починав</span>` : '';
            return `
        <label class="tm-assign-item"
            data-name="${(e.full_name||e.email||'').toLowerCase().replace(/"/g,'&quot;')}"
            data-pos="${(e.job_position||'').toLowerCase().replace(/"/g,'&quot;')}"
            data-mgr="${e.manager_id||''}"
            style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s"
            onmouseenter="this.style.background='var(--bg-raised)'" onmouseleave="this.style.background=''">
            <input type="checkbox" value="${e.id}" ${a?'checked':''} data-was-assigned="${!!a}"
                style="width:16px;height:16px;cursor:pointer;flex-shrink:0"
                onchange="TestsManagerPage._updateAssignCount()">
            <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:.88rem">${e.full_name||e.email}</div>
                ${e.job_position?`<div style="font-size:.75rem;color:var(--text-muted)">${e.job_position}</div>`:''}
            </div>
            ${statusHtml}
            ${a && dlTxt ? `<span style="font-size:.7rem;color:var(--text-muted);white-space:nowrap">${dlTxt}</span>` : ''}
        </label>`;
        }).join('')}
    </div>
</div>`;
        this._updateAssignCount();
    },

    _applyAssignFilters() {
        const query = (document.getElementById('tm-search')?.value    || '').trim().toLowerCase();
        const pos   = (document.getElementById('tm-filter-pos')?.value || '');
        const mgr   =  document.getElementById('tm-filter-mgr')?.value || '';
        document.querySelectorAll('.tm-assign-item').forEach(el => {
            const ok = (!query || el.dataset.name.includes(query))
                    && (!pos   || el.dataset.pos  === pos)
                    && (!mgr   || el.dataset.mgr  === mgr);
            el.style.display = ok ? 'flex' : 'none';
        });
        this._updateAssignCount();
    },

    _selectAllFiltered(checked) {
        document.querySelectorAll('.tm-assign-item').forEach(el => {
            if (el.style.display === 'none') return;
            const cb = el.querySelector('input[type=checkbox]');
            if (cb) cb.checked = checked;
        });
        this._updateAssignCount();
    },

    _updateAssignCount() {
        const all     = [...document.querySelectorAll('.tm-assign-item input[type=checkbox]')];
        const visible = all.filter(c => c.closest('.tm-assign-item').style.display !== 'none');
        const sel     = visible.filter(c => c.checked).length;
        const el = document.getElementById('tm-assign-count');
        if (el) el.textContent = `Вибрано: ${sel} з ${visible.length}`;
    },

    async _doAssign(testId) {
        const test = this._tests.find(x => x.id === testId) || this._curTest;
        if (test && !test.is_published) {
            Toast.error('Тест не опубліковано', 'Опублікуйте тест перед призначенням');
            return;
        }

        const checkboxes    = [...document.querySelectorAll('.tm-assign-item input[type=checkbox]')];
        const deadlineRaw   = Dom.val('tm-deadline');
        const deadlineIso   = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;
        const deadlineChanged = document.getElementById('tm-deadline')?.dataset.changed === 'true';

        // Users newly ticked — always assign (with deadline if set)
        const toAssignNew   = checkboxes
            .filter(c => c.checked && c.dataset.wasAssigned === 'false')
            .map(c => c.value);

        // Already-assigned users still ticked — update deadline if field was touched (even if cleared)
        const toUpdateDl    = deadlineChanged ? checkboxes
            .filter(c => c.checked && c.dataset.wasAssigned === 'true')
            .map(c => c.value) : [];

        const toUnassign    = checkboxes
            .filter(c => !c.checked && c.dataset.wasAssigned === 'true')
            .map(c => c.value);

        Loader.show();
        try {
            const toAssign = [...toAssignNew, ...toUpdateDl];
            if (toAssign.length) {
                await TestsManagerAPI.assign(testId, toAssign, deadlineIso);
            }
            for (const uid of toUnassign) {
                await TestsManagerAPI.unassign(testId, uid);
            }
            // Send notifications to newly assigned users
            if (toAssignNew.length) {
                const testTitle = (this._tests.find(x => x.id === testId) || this._curTest)?.title || 'Тест';
                try {
                    await Promise.all(toAssignNew.map(uid =>
                        supabase.from('notifications').insert({
                            user_id: uid, type: 'test_assigned',
                            title: 'Новий тест',
                            body:  `Вам призначено тест: ${testTitle}`,
                            data:  { test_id: testId }
                        })
                    ));
                } catch(e) { Toast.warning('Сповіщення', 'Призначено, але не вдалося надіслати сповіщення деяким користувачам'); }
            }
            Toast.success('Збережено');
            this._goBack(TestsManagerPage._container);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Results page ──────────────────────────────────────────────

    async openResultsModal(testId) {
        const container = TestsManagerPage._container;
        await this._renderResults(container, testId);
    },

    async _renderResults(container, testId) {
        container.innerHTML = '<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>';
        let results = [], test, grants = {};
        try {
            [results, test, grants] = await Promise.all([
                TestsManagerAPI.getAllResults(testId),
                API.tests.getById(testId),
                API.attempts.getGrantsForTest(testId).catch(() => ({}))
            ]);
        } catch(e) { Toast.error('Помилка', e.message); this._goBack(container); return; }

        this._lastResults = results;
        this._resultsTestId = testId;

        // Group attempts by user
        const userMap = new Map();
        for (const r of results) {
            if (!userMap.has(r.user_id)) userMap.set(r.user_id, { user: r.user, uid: r.user_id, attempts: [] });
            userMap.get(r.user_id).attempts.push(r);
        }
        const users = [...userMap.values()];

        const totalPassed = users.filter(u => u.attempts.some(a => a.passed)).length;
        const avgPct = results.length ? Math.round(results.reduce((s,r) => s+(r.percentage||0), 0) / results.length) : 0;
        const maxAttempts = test.max_attempts;

        const rowsHtml = users.map(({ user, uid, attempts }) => {
            const best = attempts.reduce((b,a) => (!b || (a.percentage||0) > (b.percentage||0)) ? a : b, null);
            const extraGrants = grants[uid] || 0;
            const allowed = maxAttempts ? maxAttempts + extraGrants : null;
            const exhausted = allowed !== null && attempts.length >= allowed;
            const hasPassed = attempts.some(a => a.passed);
            return `
            <tr style="border-top:1px solid var(--border)">
                <td style="padding:10px 14px">
                    <div style="font-weight:600">${Fmt.esc(user?.full_name||user?.email||'—')}</div>
                    ${user?.job_position?`<div style="font-size:.72rem;color:var(--text-muted)">${Fmt.esc(user.job_position)}</div>`:''}
                </td>
                <td style="padding:10px 14px;text-align:center">
                    <span style="font-weight:600">${attempts.length}</span>
                    ${allowed !== null ? `<span style="color:var(--text-muted);font-size:.8rem"> / ${allowed}</span>` : ''}
                </td>
                <td style="padding:10px 14px;text-align:center;font-weight:700;font-size:1rem;color:${best?.passed?'#10b981':'#ef4444'}">${best ? Math.round(best.percentage||0)+'%' : '—'}</td>
                <td style="padding:10px 14px;text-align:center">
                    <span style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700;${hasPassed?'background:rgba(16,185,129,.12);color:#10b981':'background:rgba(239,68,68,.1);color:#ef4444'}">
                        ${hasPassed ? '<i class="fa-solid fa-check"></i> Пройшов' : '<i class="fa-solid fa-xmark"></i> Не пройшов'}
                    </span>
                </td>
                <td style="padding:10px 14px;text-align:center">
                    ${maxAttempts && exhausted ? `<button class="btn btn-ghost btn-sm" onclick="TestsManagerPage._grantAttempt('${testId}','${uid}',this)" title="Дати додаткову спробу">
                        <i class="fa-solid fa-plus"></i> Спробу
                    </button>` : ''}
                </td>
            </tr>`;
        }).join('');

        container.innerHTML = `<style>
.tres-page{max-width:900px;display:flex;flex-direction:column;height:calc(100vh - 120px)}
.tres-topbar{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:20px;flex-shrink:0}
.tres-back{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.83rem;font-weight:500;cursor:pointer;transition:all .15s}
.tres-back:hover{border-color:var(--primary);color:var(--primary)}
.tres-stats{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;flex-shrink:0}
.tres-stat{flex:1;min-width:110px;padding:14px 16px;border-radius:14px;border:1px solid var(--border);background:var(--bg-raised);text-align:center}
.tres-table-wrap{flex:1;border:1px solid var(--border);border-radius:12px;overflow:auto;min-height:0}
</style>
<div class="tres-page">
    <div class="tres-topbar">
        <button class="tres-back" onclick="TestsManagerPage._goBack(TestsManagerPage._container)"><i class="fa-solid fa-arrow-left"></i> Назад</button>
        <span style="font-size:1.1rem;font-weight:700;color:var(--text-primary);flex:1"><i class="fa-solid fa-chart-bar"></i> ${test.title}</span>
        ${results.length ? `<button class="btn btn-ghost btn-sm" onclick="TestsManagerPage._exportCSV(TestsManagerPage._lastResults,${JSON.stringify(test.title||'').replace(/"/g,'&quot;')})"><i class="fa-solid fa-file-csv"></i> CSV</button>` : ''}
    </div>
    <div class="tres-stats">
        ${[['<i class="fa-solid fa-users"></i>',users.length,'Співробітників'],['<i class="fa-solid fa-circle-check"></i>',totalPassed,'Пройшли'],['<i class="fa-solid fa-circle-xmark"></i>',users.length-totalPassed,'Не пройшли'],['<i class="fa-solid fa-chart-bar"></i>',avgPct+'%','Середній бал']].map(([ic,v,l]) => `
        <div class="tres-stat">
            <div style="font-size:1.5rem">${ic}</div>
            <div style="font-size:1.3rem;font-weight:800;color:var(--text-primary)">${v}</div>
            <div style="font-size:.72rem;color:var(--text-muted)">${l}</div>
        </div>`).join('')}
    </div>
    ${users.length ? `
    <div class="tres-table-wrap">
        <table style="width:100%;border-collapse:collapse;font-size:.85rem">
            <thead style="position:sticky;top:0;z-index:1">
                <tr style="background:var(--bg-raised)">
                    <th style="padding:10px 14px;text-align:left;font-weight:600;color:var(--text-muted)">Співробітник</th>
                    <th style="padding:10px 14px;text-align:center;font-weight:600;color:var(--text-muted)">Спроби</th>
                    <th style="padding:10px 14px;text-align:center;font-weight:600;color:var(--text-muted)">Кращий бал</th>
                    <th style="padding:10px 14px;text-align:center;font-weight:600;color:var(--text-muted)">Статус</th>
                    <th style="padding:10px 14px;text-align:center;font-weight:600;color:var(--text-muted)"></th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    </div>` : '<div style="text-align:center;padding:3rem;color:var(--text-muted)">Результатів поки немає</div>'}
</div>`;
    },

    async _grantAttempt(testId, userId, btn) {
        btn.disabled = true;
        try {
            await API.attempts.grantExtra(testId, userId);
            Toast.success('Готово', 'Додаткову спробу надано');
            await this._renderResults(TestsManagerPage._container, testId);
        } catch(e) {
            Toast.error('Помилка', e.message);
            btn.disabled = false;
        }
    },

    _exportCSV(results, title) {
        const headers = ['Співробітник', 'Email', 'Посада', 'Дата', 'Бал (%)', 'Статус', 'Час (хв)'];
        const rows = results.map(r => [
            r.user?.full_name || '',
            r.user?.email || '',
            r.user?.job_position || '',
            r.completed_at ? new Date(r.completed_at).toLocaleString('uk-UA') : '',
            Math.round(r.percentage || 0),
            r.passed ? 'Пройшов' : 'Не пройшов',
            r.time_spent_seconds ? Math.round(r.time_spent_seconds / 60) : ''
        ]);
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `results_${title.replace(/[^\wа-яА-ЯіїєёЄІЇ ]/g, '_')}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    }
};

// ================================================================
// MyTestsPage — користувач
// ================================================================
const MyTestsPage = {
    _tab: 'pending',
    _assignments: [],
    _attempts: [],
    _completedTestIds: new Set(),
    _fromExpert: false,

    async init(container) {
        UI.setBreadcrumb([{ label: 'Мої тести' }]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        this._tab = 'pending';
        await this._render(container, false);
    },

    async _render(container, fromExpert = false) {
        this._fromExpert = fromExpert;
        let assignments = [], attempts = [];
        try {
            [assignments, attempts] = await Promise.all([
                TestsManagerAPI.getMyAssignments(),
                supabase.from('test_attempts')
                    .select('*, test:tests(id,title)')
                    .eq('user_id', AppState.user.id)
                    .not('completed_at', 'is', null)
                    .order('completed_at', { ascending: false })
                    .then(({ data }) => data || [])
            ]);
        } catch(e) { assignments = []; attempts = []; }

        const completedTestIds = new Set(attempts.map(a => a.test_id));
        this._assignments      = assignments;
        this._attempts         = attempts;
        this._completedTestIds = completedTestIds;

        container.innerHTML = `
<style>
.mt-page{max-width:900px}
.mt-hero{border-radius:22px;padding:30px 36px;margin-bottom:24px;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1e40af 100%);position:relative;overflow:hidden}
.mt-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 80% at 80% 20%,rgba(201,162,39,.15),transparent);pointer-events:none}
.mt-hero-inner{position:relative;display:flex;align-items:center;gap:18px}
.mt-hero-icon{width:56px;height:56px;border-radius:16px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:1.8rem;flex-shrink:0}
.mt-hero-title{margin:0;font-size:1.6rem;font-weight:800;color:#fff;letter-spacing:-.03em}
.mt-hero-sub{margin:4px 0 0;color:rgba(255,255,255,.65);font-size:.87rem}

.mt-tabs{display:flex;gap:6px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:0}
.mt-tab{padding:10px 20px;border:none;background:transparent;color:var(--text-muted);font-size:.88rem;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;margin-bottom:-1px}
.mt-tab.active{color:var(--primary);border-bottom-color:var(--primary);font-weight:700}
.mt-tab:hover:not(.active){color:var(--text-primary)}

.mt-list{display:flex;flex-direction:column;gap:10px;animation:mt-in .3s ease}
@keyframes mt-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.mt-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;display:flex;transition:box-shadow .2s,border-color .2s}
.mt-card:hover{box-shadow:0 4px 20px rgba(0,0,0,.1);border-color:var(--border-light)}
.mt-card-bar{width:4px;flex-shrink:0}
.mt-card-bar.pending{background:linear-gradient(180deg,#f59e0b,#f97316)}
.mt-card-bar.overdue{background:linear-gradient(180deg,#ef4444,#dc2626)}
.mt-card-bar.done{background:linear-gradient(180deg,#10b981,#059669)}
.mt-card-body{padding:16px 18px;flex:1;display:flex;align-items:center;gap:14px}
.mt-card-info{flex:1;min-width:0}
.mt-card-title{font-weight:700;font-size:.95rem;color:var(--text-primary);margin-bottom:5px}
.mt-card-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.mt-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:20px;font-size:.7rem;font-weight:600}
.mt-badge-pending{background:rgba(245,158,11,.12);color:#f59e0b}
.mt-badge-overdue{background:rgba(239,68,68,.1);color:#ef4444}
.mt-badge-done{background:rgba(16,185,129,.12);color:#10b981}
.mt-badge-fail{background:rgba(239,68,68,.1);color:#ef4444}
.mt-badge-info{background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border)}
.mt-btn-start{padding:8px 20px;border-radius:12px;border:none;background:var(--primary);color:#fff;font-size:.85rem;font-weight:700;cursor:pointer;transition:background .15s;white-space:nowrap;flex-shrink:0}
.mt-btn-start:hover{background:var(--primary-dark,#1d4ed8)}
.mt-btn-view{padding:8px 16px;border-radius:12px;border:1.5px solid var(--border);background:transparent;color:var(--text-secondary);font-size:.83rem;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0}
.mt-btn-view:hover{border-color:var(--primary);color:var(--primary)}
.mt-score-circle{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:800;flex-shrink:0}

.mt-empty{display:flex;flex-direction:column;align-items:center;padding:5rem 2rem;text-align:center}
.mt-empty-ico{font-size:3.5rem;margin-bottom:1rem;opacity:.3}
.mt-empty-head{font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:.4rem}
.mt-empty-txt{font-size:.85rem;color:var(--text-muted)}
</style>

<div class="mt-page">
    <div class="mt-hero">
        <div class="mt-hero-inner">
            <div class="mt-hero-icon"><i class="fa-solid fa-bullseye"></i></div>
            <div>
                <h1 class="mt-hero-title">Мої тести</h1>
                <p class="mt-hero-sub">Призначені тести та ваша історія проходжень</p>
            </div>
        </div>
    </div>

    <div class="mt-tabs">
        <button class="mt-tab${this._tab==='pending'?' active':''}" onclick="MyTestsPage._switchTab('pending',this)">
            <i class="fa-solid fa-clipboard-list"></i> Призначені ${assignments.length ? `<span style="background:var(--primary);color:#fff;border-radius:20px;padding:1px 8px;font-size:.7rem;margin-left:4px">${assignments.filter(a => !completedTestIds.has(a.test_id)).length}</span>` : ''}
        </button>
        <button class="mt-tab${this._tab==='history'?' active':''}" onclick="MyTestsPage._switchTab('history',this)">
            <i class="fa-solid fa-trophy"></i> Пройдені (${attempts.length})
        </button>
    </div>

    <div id="mt-content">
        ${this._tab === 'pending' ? this._pendingHtml(assignments, completedTestIds) : this._historyHtml(attempts)}
    </div>
</div>`;
    },

    _switchTab(tab, btn) {
        this._tab = tab;
        document.querySelectorAll('.mt-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        const content = document.getElementById('mt-content');
        if (content) content.innerHTML = tab === 'pending'
            ? this._pendingHtml(this._assignments, this._completedTestIds)
            : this._historyHtml(this._attempts);
    },

    _pendingHtml(assignments, completedTestIds) {
        const pending = assignments.filter(a => !completedTestIds.has(a.test_id));

        if (!pending.length) return `
<div class="mt-empty">
    <div class="mt-empty-ico"><i class="fa-solid fa-clipboard-list"></i></div>
    <div class="mt-empty-head">${assignments.length ? 'Всі тести пройдено!' : 'Немає призначених тестів'}</div>
    <div class="mt-empty-txt">${assignments.length ? 'Результати зберігаються у вкладці «Пройдені»' : 'Коли керівник призначить вам тест — він з\'явиться тут'}</div>
</div>`;

        const sorted = [...pending].sort((a,b) => {
            if (a.deadline_at && b.deadline_at) return new Date(a.deadline_at) - new Date(b.deadline_at);
            if (a.deadline_at) return -1;
            if (b.deadline_at) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        return `<div class="mt-list">${sorted.map(a => {
            const test = a.test;
            if (!test) return '';
            const isOverdue = a.deadline_at && new Date(a.deadline_at) < new Date();
            const qCount    = test.questions?.length || 0;
            let deadlineTxt = '';
            if (a.deadline_at) {
                const dl = new Date(a.deadline_at);
                const daysLeft = Math.ceil((dl - Date.now()) / 86400000);
                deadlineTxt = isOverdue
                    ? `<span class="mt-badge mt-badge-overdue"><i class="fa-solid fa-circle-exclamation"></i> Прострочено</span>`
                    : daysLeft <= 3
                        ? `<span class="mt-badge mt-badge-overdue"><i class="fa-solid fa-clock"></i> ${daysLeft} дн.</span>`
                        : `<span class="mt-badge mt-badge-info"><i class="fa-solid fa-calendar-days"></i> до ${Fmt.dateShort(dl)}</span>`;
            }
            return `
<div class="mt-card">
    <div class="mt-card-bar ${isOverdue ? 'overdue' : 'pending'}"></div>
    <div class="mt-card-body">
        <div class="mt-card-info">
            <div class="mt-card-title">${test.title}</div>
            <div class="mt-card-meta">
                <span class="mt-badge mt-badge-info"><i class="fa-solid fa-question"></i> ${qCount} питань</span>
                ${test.time_limit_minutes ? `<span class="mt-badge mt-badge-info"><i class="fa-regular fa-clock"></i> ${test.time_limit_minutes} хв</span>` : ''}
                <span class="mt-badge mt-badge-info"><i class="fa-solid fa-bullseye"></i> ${test.passing_score||70}% прохідний</span>
                ${deadlineTxt}
            </div>
        </div>
        <button class="mt-btn-start" onclick="Router.go('tests/${test.id}?from=expert-path')">Пройти тест <i class="fa-solid fa-arrow-right"></i></button>
    </div>
</div>`;
        }).join('')}</div>`;
    },

    _historyHtml(attempts) {
        if (!attempts.length) return `
<div class="mt-empty">
    <div class="mt-empty-ico"><i class="fa-solid fa-trophy"></i></div>
    <div class="mt-empty-head">Ви ще не проходили тестів</div>
    <div class="mt-empty-txt">Результати пройдених тестів будуть відображатись тут</div>
</div>`;

        return `<div class="mt-list">${attempts.map(a => {
            const pct = Math.round(a.percentage || 0);
            return `
<div class="mt-card">
    <div class="mt-card-bar ${a.passed ? 'done' : 'overdue'}"></div>
    <div class="mt-card-body">
        <div class="mt-card-info">
            <div class="mt-card-title">${a.test?.title || 'Тест'}</div>
            <div class="mt-card-meta">
                <span class="mt-badge mt-badge-info">${Fmt.datetime(a.completed_at)}</span>
                ${a.time_spent_seconds ? `<span class="mt-badge mt-badge-info"><i class="fa-regular fa-clock"></i> ${Math.floor(a.time_spent_seconds/60)} хв</span>` : ''}
                <span class="mt-badge ${a.passed ? 'mt-badge-done' : 'mt-badge-fail'}">${a.passed ? '<i class="fa-solid fa-check"></i> Зараховано' : '<i class="fa-solid fa-xmark"></i> Не зараховано'}</span>
            </div>
        </div>
        <div class="mt-score-circle" style="background:${a.passed?'rgba(16,185,129,.12)':'rgba(239,68,68,.1)'};color:${a.passed?'#10b981':'#ef4444'}">
            ${pct}%
        </div>
        <button class="mt-btn-view" onclick="Router.go('tests/${a.test_id}${this._fromExpert ? '?from=expert-path' : ''}')">Деталі</button>
    </div>
</div>`;
        }).join('')}</div>`;
    }
};
