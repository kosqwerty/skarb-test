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
                passing_score,cover_image,stretch_cover_image,questions(id)), group:test_groups(id,title,description,cover_image,stretch_cover_image,is_sequential)`)
            .eq('user_id', AppState.user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        const assignments = data || [];

        const groupIds = [...new Set(assignments.map(a => a.group_id).filter(Boolean))];
        if (groupIds.length) {
            const { data: items } = await supabase.from('test_group_items')
                .select('group_id, test_id, order_index')
                .in('group_id', groupIds);
            const orderMap = new Map((items || []).map(it => [`${it.group_id}_${it.test_id}`, it.order_index]));
            assignments.forEach(a => {
                if (a.group_id) a._order = orderMap.get(`${a.group_id}_${a.test_id}`) ?? 0;
            });
        }
        return assignments;
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
            .select('id, full_name, email, job_position, manager_id, avatar_url')
            .in('role', ['user', 'smm', 'manager', 'admin', 'superadmin'])
            .order('full_name');
        if (error) throw error;
        return data || [];
    },

    async getPositions() {
        const { data, error } = await supabase.from('profiles')
            .select('job_position')
            .in('role', ['user', 'smm', 'manager'])
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
    },

    // Aggregates for the list screen: assignments + completed attempts per test
    async getListStats(testIds) {
        if (!testIds.length) return { asg: [], att: [] };
        const [a, b] = await Promise.all([
            supabase.from('test_assignments').select('test_id, user_id').in('test_id', testIds),
            supabase.from('test_attempts').select('test_id, user_id, percentage, passed')
                .not('completed_at', 'is', null).in('test_id', testIds)
        ]);
        return { asg: a.data || [], att: b.data || [] };
    },

    // Per-question correctness for the results screen
    async getQuestionStats(attemptIds) {
        if (!attemptIds.length) return [];
        const { data, error } = await supabase.from('attempt_answers')
            .select('question_id, is_correct')
            .in('attempt_id', attemptIds.slice(0, 1000));
        if (error) throw error;
        return data || [];
    },

    // ── Test groups (sequential test paths) ────────────────────────
    async getGroups() {
        const { data, error } = await supabase.from('test_groups')
            .select('*, items:test_group_items(id, test_id, order_index)')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getGroup(id) {
        const { data, error } = await supabase.from('test_groups')
            .select('*, items:test_group_items(id, test_id, order_index, test:tests(id,title,is_published,cover_image))')
            .eq('id', id).single();
        if (error) throw error;
        return data;
    },

    async createGroup(fields) {
        const { data, error } = await supabase.from('test_groups')
            .insert({ ...fields, created_by: AppState.user.id })
            .select().single();
        if (error) throw error;
        return data;
    },

    async updateGroup(id, fields) {
        const { data, error } = await supabase.from('test_groups')
            .update({ ...fields, updated_at: new Date().toISOString() })
            .eq('id', id).select().single();
        if (error) throw error;
        return data;
    },

    async deleteGroup(id) {
        const { error } = await supabase.from('test_groups').delete().eq('id', id);
        if (error) throw error;
    },

    async setGroupItems(groupId, testIds) {
        const { error: delErr } = await supabase.from('test_group_items').delete().eq('group_id', groupId);
        if (delErr) throw delErr;
        if (!testIds.length) return;
        const rows = testIds.map((testId, i) => ({ group_id: groupId, test_id: testId, order_index: i }));
        const { error } = await supabase.from('test_group_items').insert(rows);
        if (error) throw error;
    },

    async uploadGroupCover(groupId, file) {
        const ext  = file.name.split('.').pop().toLowerCase();
        // Той самий патерн шляху, що й для окремих тестів (covers/{uuid}/...) —
        // RLS-політика бакета test-images очікує UUID одразу після "covers/",
        // додатковий сегмент "groups/" ламав перевірку (400 RLS violation)
        const path = `covers/${groupId}/cover.${ext}`;
        const opts = { upsert: true };
        if (file.type) opts.contentType = file.type;
        const { error } = await supabase.storage.from(APP_CONFIG.buckets.testImages).upload(path, file, opts);
        if (error) throw error;
        return `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.testImages}/${path}`;
    },

    async getGroupAssignedUsers(groupId) {
        const { data, error } = await supabase.from('test_assignments')
            .select('user_id, deadline_at')
            .eq('group_id', groupId);
        if (error) throw error;
        const map = new Map();
        for (const a of (data || [])) if (!map.has(a.user_id)) map.set(a.user_id, a);
        return map;
    },

    async assignGroup(groupId, userIds, deadlineAt) {
        const { data: items, error: itemsErr } = await supabase.from('test_group_items')
            .select('test_id').eq('group_id', groupId);
        if (itemsErr) throw itemsErr;
        const testIds = (items || []).map(i => i.test_id);
        if (!testIds.length) return;
        const rows = [];
        for (const testId of testIds) for (const uid of userIds) rows.push({
            test_id: testId, user_id: uid, group_id: groupId,
            assigned_by: AppState.user.id, deadline_at: deadlineAt || null
        });
        const { error } = await supabase.from('test_assignments')
            .upsert(rows, { onConflict: 'test_id,user_id', ignoreDuplicates: false });
        if (error) throw error;
    },

    async unassignGroup(groupId, userId) {
        const { error } = await supabase.from('test_assignments')
            .delete().eq('group_id', groupId).eq('user_id', userId);
        if (error) throw error;
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
    _dirtyEnabled:   false,
    _markDirty() { if (this._dirtyEnabled) this._dirty = true; },
    async _checkDirty() {
        if (!this._dirty) return true;
        const ok = await Modal.confirm({ title: 'Незбережені зміни', message: 'Питання має незбережені зміни. Зберегти перед переходом?', confirmText: 'Зберегти', cancelText: 'Не зберігати' });
        if (ok) await this.saveCurrentQuestion();
        this._dirty = false;
        return true;
    },
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
        this._listFilter = this._listFilter || 'all';
        this._listQuery  = '';
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            this._tests = await TestsManagerAPI.getAllStandalone();
        } catch(e) { this._tests = []; }

        // Aggregates: assigned / passed per test (per-row counts in the table below)
        this._listStats = {};
        try {
            const { asg, att } = await TestsManagerAPI.getListStats(this._tests.map(t => t.id));
            const st = this._listStats;
            const assignedUsers = {}; // test_id -> Set(user_id), щоб рахувати "пройшли" лише серед призначених
            asg.forEach(r => {
                (st[r.test_id] = st[r.test_id] || { assigned: 0, passed: new Set() }).assigned++;
                (assignedUsers[r.test_id] = assignedUsers[r.test_id] || new Set()).add(r.user_id);
            });
            att.forEach(a => {
                if (!a.passed || !assignedUsers[a.test_id]?.has(a.user_id)) return;
                st[a.test_id].passed.add(a.user_id);
            });
        } catch(e) { console.error('[tests-manager] list stats:', e); }

        container.innerHTML = `
<style>

.tm-btn-new{display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:12px;background:var(--primary);border:none;color:#fff;font-size:.9rem;font-weight:700;cursor:pointer;transition:background .15s;flex-shrink:0}
.tm-btn-new:hover{background:var(--primary-dark)}

.tm-search-wrap{display:flex;align-items:center;gap:8px;width:100%;max-width:500px;padding:0 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);transition:border-color .15s}
.tm-search-wrap:focus-within{border-color:var(--primary)}
.tm-search-wrap i{color:var(--text-muted);font-size:.85rem;flex-shrink:0}
.tm-search-inp{flex:1;min-width:0;border:none!important;background:transparent!important;color:var(--text-primary)!important;font-size:.85rem;outline:none!important;padding:9px 0!important;box-shadow:none!important;width:auto}
.tm-search-inp::placeholder{color:var(--text-muted)!important}
.tm-fchips{display:flex;gap:6px}
.tm-fchip{padding:8px 14px;border-radius:9999px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.8rem;font-weight:600;cursor:pointer;transition:all .18s}
.tm-fchip:hover{border-color:var(--border-light);color:var(--text-primary)}
.tm-fchip.on{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 12%,var(--bg-surface));color:var(--primary)}
.tm-fchip b{font-weight:800;opacity:.65;margin-left:3px;font-size:.72rem}
.tm-sort-sel{width:auto;flex-shrink:0;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.8rem;font-weight:600;cursor:pointer;outline:none;font-family:inherit}

.tm-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:20px;font-size:.72rem;font-weight:600}
.tm-chip-q{background:rgba(99,102,241,.12);color:#6366f1}
.tm-chip-draft{background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border)}
.tm-chip-pub{background:rgba(16,185,129,.12);color:#10b981}
.tm-pub-tgl{display:inline-flex;align-items:center;cursor:pointer}
.tm-pub-knob{width:34px;height:19px;border-radius:9999px;background:var(--bg-hover);border:1.5px solid var(--border);position:relative;transition:all .22s}
.tm-pub-knob::after{content:'';position:absolute;top:1.5px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--text-muted);transition:all .22s cubic-bezier(.4,0,.2,1)}
.tm-pub-tgl.on .tm-pub-knob{background:rgba(16,185,129,.22);border-color:#10b981}
.tm-pub-tgl.on .tm-pub-knob::after{left:17px;background:#10b981}
.tm-pbar{height:4px;border-radius:9999px;background:var(--bg-hover);overflow:hidden}
.tm-pbar-fill{height:100%;border-radius:9999px;background:linear-gradient(90deg,#10b981,#34d399);transition:width .6s cubic-bezier(.4,0,.2,1)}

.tm-empty{display:flex;flex-direction:column;align-items:center;padding:5rem 2rem;text-align:center}
.tm-empty-ico{font-size:4rem;margin-bottom:1rem;opacity:.3}
.tm-empty-head{font-size:1.2rem;font-weight:700;color:var(--text-primary);margin-bottom:.5rem}
.tm-empty-txt{font-size:.875rem;color:var(--text-muted);max-width:360px;line-height:1.6;margin-bottom:1.5rem}

/* ── Table ─────────────────────────────────────────────────────── */
.tm-table-wrap{background:var(--bg-surface);border:1px solid var(--border);border-radius:18px;overflow:hidden;animation:tm-in .3s ease}
@keyframes tm-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.tm-table{width:100%;border-collapse:collapse}
.tm-table thead th{text-align:left;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);padding:12px 16px;background:var(--bg-raised);border-bottom:1px solid var(--border);white-space:nowrap}
.tm-th-q,.tm-th-pub{width:150px}
.tm-th-actions{width:146px;text-align:right}
.tm-row{border-bottom:1px solid var(--border);transition:background .12s;animation:tm-row-in .35s cubic-bezier(.4,0,.2,1) both;animation-delay:calc(var(--i,0)*30ms)}
@keyframes tm-row-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.tm-row{animation:none}}
.tm-row:last-child{border-bottom:none}
.tm-row:hover{background:var(--bg-hover)}
.tm-table td{padding:11px 16px;vertical-align:middle}
.tm-td-name{cursor:pointer}
.tm-row-name-wrap{display:flex;align-items:center;gap:12px;min-width:0}
.tm-row-thumb{width:42px;height:42px;border-radius:10px;object-fit:cover;flex-shrink:0}
.tm-row-thumb-ph{display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem;background:linear-gradient(135deg,#C9A227,#f59e0b)}
.tm-row-title{font-weight:700;font-size:.9rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:420px}
.tm-row-desc{font-size:.76rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:420px;margin-top:2px}
.tm-td-q{white-space:nowrap}
.tm-row-prog{display:flex;align-items:center;gap:7px;margin-top:6px}
.tm-row-prog .tm-pbar{width:60px}
.tm-row-prog span{font-size:.7rem;color:var(--text-muted);white-space:nowrap}
.tm-td-actions{white-space:nowrap;text-align:right}
.tm-act-group{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px;width:106px;margin-left:auto}
.tm-act-btn{width:32px;height:32px;border-radius:9px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-size:.8rem;transition:all .15s}
.tm-act-btn:hover{border-color:var(--primary);color:var(--primary);background:color-mix(in srgb,var(--primary) 8%,transparent)}
.tm-act-danger:hover{border-color:var(--danger)!important;color:var(--danger)!important;background:rgba(239,68,68,.08)!important}

.tm-sec-tabs{display:inline-flex;gap:4px;margin-bottom:18px;padding:5px;background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 2px 10px rgba(15,23,42,.05)}
body:not(.light-theme) .tm-sec-tabs{box-shadow:0 2px 14px rgba(0,0,0,.2)}
.tm-sec-tab{padding:9px 18px 9px 10px;border-radius:12px;border:none;background:transparent;color:var(--text-muted);font-size:.85rem;font-weight:600;cursor:pointer;transition:background .18s ease,color .18s ease,transform .12s ease;display:inline-flex;align-items:center;gap:9px}
.tm-sec-tab:hover:not(.on){color:var(--text-primary);background:var(--bg-hover);transform:translateY(-1px)}
.tm-sec-tab i{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.85rem;background:var(--bg-hover);color:var(--text-muted);transition:all .18s ease}
.tm-sec-tab.on{background:color-mix(in srgb,var(--primary) 12%,var(--bg-surface));color:var(--primary)}
.tm-sec-tab.on i{background:var(--primary);color:#fff}

.tmg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px}
.tmg-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:box-shadow .15s,transform .15s;animation:tm-in .3s ease}
.tmg-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.1);transform:translateY(-2px)}
.tmg-cover{height:180px;background:linear-gradient(135deg,#0f172a 0%,#1e40af 55%,#C9A227 100%);background-size:cover;background-position:center;position:relative;display:flex;align-items:flex-end;padding:10px}
.tmg-cover-ph{display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);font-size:1.8rem}
.tmg-seq-badge{position:absolute;top:8px;right:8px;font-size:.64rem;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(0,0,0,.4);color:#fff;backdrop-filter:blur(4px)}
.tmg-body{padding:14px 16px}
.tmg-title{font-weight:700;font-size:.95rem;color:var(--text-primary);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tmg-desc{font-size:.78rem;color:var(--text-muted);margin-bottom:10px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;min-height:2.1em}
.tmg-meta{font-size:.72rem;color:var(--text-muted);margin-bottom:10px}
.tmg-actions{display:flex;gap:6px}
.tmg-btn{flex:1;padding:7px 10px;border-radius:9px;border:1.5px solid var(--border);background:transparent;color:var(--text-secondary);font-size:.76rem;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;gap:5px}
.tmg-btn:hover{border-color:var(--primary);color:var(--primary)}
.tmg-btn-danger:hover{border-color:var(--danger)!important;color:var(--danger)!important}
.tmg-new-card{border:2px dashed var(--border);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:220px;cursor:pointer;color:var(--text-muted);background:transparent;transition:all .15s}
.tmg-new-card:hover{border-color:var(--primary);color:var(--primary)}
.tmg-new-card i{font-size:1.6rem}
</style>

<div class="tm-page">
    <div class="tm-sec-tabs">
        <button class="tm-sec-tab on" onclick="TestsManagerPage._renderList(TestsManagerPage._container)"><i class="fa-solid fa-file-pen"></i> Тести</button>
        <button class="tm-sec-tab" onclick="TestsManagerPage._renderGroupsList(TestsManagerPage._container)"><i class="fa-solid fa-layer-group"></i> Групи тестів</button>
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap">
        <div class="tm-search-wrap">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input class="tm-search-inp" type="text" placeholder="Пошук тесту..." oninput="TestsManagerPage._filterTests(this.value)">
        </div>
        <div class="tm-fchips" id="tm-fchips">
            <button class="tm-fchip${this._listFilter==='all'?' on':''}" data-f="all" onclick="TestsManagerPage._setListFilter('all',this)">Всі <b>${this._tests.length}</b></button>
            <button class="tm-fchip${this._listFilter==='pub'?' on':''}" data-f="pub" onclick="TestsManagerPage._setListFilter('pub',this)">Опубліковані <b>${this._tests.filter(t=>t.is_published).length}</b></button>
            <button class="tm-fchip${this._listFilter==='draft'?' on':''}" data-f="draft" onclick="TestsManagerPage._setListFilter('draft',this)">Чернетки <b>${this._tests.filter(t=>!t.is_published).length}</b></button>
        </div>
        <select class="tm-sort-sel" onchange="TestsManagerPage._setListSort(this.value)">
            <option value="new">Спочатку нові</option>
            <option value="title">За назвою</option>
            <option value="progress">За % проходження</option>
        </select>
        ${AppState.canMutate() ? `<button class="tm-btn-new" style="margin-left:auto" onclick="TestsManagerPage.openCreateModal()"><i class="fa-solid fa-plus"></i> Новий тест</button>` : ''}
    </div>

    ${this._tests.length ? `
    <div class="tm-table-wrap">
        <table class="tm-table">
            <thead>
                <tr>
                    <th>Назва тесту</th>
                    <th class="tm-th-q">Питань</th>
                    <th class="tm-th-pub">Опубліковано</th>
                    <th class="tm-th-actions">Дії</th>
                </tr>
            </thead>
            <tbody id="tm-tbody">
                ${this._tests.map((t, i) => this._rowHtml(t, i)).join('')}
            </tbody>
        </table>
    </div>` : `
    <div class="tm-table-wrap">
        <div class="tm-empty">
            <div class="tm-empty-ico"><i class="fa-solid fa-clipboard-list"></i></div>
            <div class="tm-empty-head">Тестів ще немає</div>
            <div class="tm-empty-txt">Створіть перший тест та призначте його співробітникам для перевірки знань</div>
            ${AppState.canMutate() ? `<button class="tm-btn-new" onclick="TestsManagerPage.openCreateModal()"><i class="fa-solid fa-plus"></i> Створити перший тест</button>` : ''}
        </div>
    </div>`}
</div>`;
        this._applyListFilters();
    },

    // ── Groups list ──────────────────────────────────────────────

    async _renderGroupsList(container) {
        this._container = container;
        this._prevView  = 'groups';
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            this._groups = await TestsManagerAPI.getGroups();
        } catch(e) { Toast.error('Помилка', e.message); this._groups = []; }

        container.innerHTML = `
<style>

.tm-sec-tabs{display:inline-flex;gap:4px;margin-bottom:18px;padding:5px;background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;box-shadow:0 2px 10px rgba(15,23,42,.05)}
body:not(.light-theme) .tm-sec-tabs{box-shadow:0 2px 14px rgba(0,0,0,.2)}
.tm-sec-tab{padding:9px 18px 9px 10px;border-radius:12px;border:none;background:transparent;color:var(--text-muted);font-size:.85rem;font-weight:600;cursor:pointer;transition:background .18s ease,color .18s ease,transform .12s ease;display:inline-flex;align-items:center;gap:9px}
.tm-sec-tab:hover:not(.on){color:var(--text-primary);background:var(--bg-hover);transform:translateY(-1px)}
.tm-sec-tab i{width:26px;height:26px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.85rem;background:var(--bg-hover);color:var(--text-muted);transition:all .18s ease}
.tm-sec-tab.on{background:color-mix(in srgb,var(--primary) 12%,var(--bg-surface));color:var(--primary)}
.tm-sec-tab.on i{background:var(--primary);color:#fff}

.tmg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px}
.tmg-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:box-shadow .15s,transform .15s;animation:tm-in .3s ease}
.tmg-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.1);transform:translateY(-2px)}
.tmg-cover{height:180px;background:linear-gradient(135deg,#0f172a 0%,#1e40af 55%,#C9A227 100%);background-size:cover;background-position:center;position:relative;display:flex;align-items:flex-end;padding:10px}
.tmg-cover-ph{display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.85);font-size:1.8rem}
.tmg-seq-badge{position:absolute;top:8px;right:8px;font-size:.64rem;font-weight:700;padding:3px 9px;border-radius:20px;background:rgba(0,0,0,.4);color:#fff;backdrop-filter:blur(4px)}
.tmg-body{padding:14px 16px}
.tmg-title{font-weight:700;font-size:.95rem;color:var(--text-primary);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tmg-desc{font-size:.78rem;color:var(--text-muted);margin-bottom:10px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;min-height:2.1em}
.tmg-meta{font-size:.72rem;color:var(--text-muted);margin-bottom:10px}
.tmg-actions{display:flex;gap:6px}
.tmg-btn{flex:1;padding:7px 10px;border-radius:9px;border:1.5px solid var(--border);background:transparent;color:var(--text-secondary);font-size:.76rem;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;gap:5px}
.tmg-btn:hover{border-color:var(--primary);color:var(--primary)}
.tmg-btn-danger:hover{border-color:var(--danger)!important;color:var(--danger)!important}
.tmg-new-card{border:2px dashed var(--border);border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:220px;cursor:pointer;color:var(--text-muted);background:transparent;transition:all .15s}
.tmg-new-card:hover{border-color:var(--primary);color:var(--primary)}
.tmg-new-card i{font-size:1.6rem}
@keyframes tm-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
</style>
<div class="tm-page">
    <div class="tm-sec-tabs">
        <button class="tm-sec-tab" onclick="TestsManagerPage._renderList(TestsManagerPage._container)"><i class="fa-solid fa-file-pen"></i> Тести</button>
        <button class="tm-sec-tab on" onclick="TestsManagerPage._renderGroupsList(TestsManagerPage._container)"><i class="fa-solid fa-layer-group"></i> Групи тестів</button>
    </div>

    <div class="tmg-grid">
        ${this._groups.map(g => this._groupCardHtml(g)).join('')}
        ${AppState.canMutate() ? `
        <button type="button" class="tmg-new-card" onclick="TestsManagerPage.openGroupEditor()">
            <i class="fa-solid fa-plus"></i>
            <span>Нова група</span>
        </button>` : ''}
    </div>
</div>`;
    },

    _groupCardHtml(g) {
        const count = g.items?.length || 0;
        return `
<div class="tmg-card">
    <div class="tmg-cover" style="${g.cover_image ? `background-image:url('${Fmt.esc(g.cover_image)}')` : ''}">
        ${!g.cover_image ? `<div class="tmg-cover-ph"><i class="fa-solid fa-layer-group"></i></div>` : ''}
        <span class="tmg-seq-badge"><i class="fa-solid ${g.is_sequential ? 'fa-arrow-down-1-9' : 'fa-shuffle'}"></i> ${g.is_sequential ? 'Послідовно' : 'У будь-якому порядку'}</span>
    </div>
    <div class="tmg-body">
        <div class="tmg-title">${Fmt.esc(g.title)}</div>
        <div class="tmg-desc">${Fmt.esc(g.description || '')}</div>
        <div class="tmg-meta"><i class="fa-solid fa-clipboard-list"></i> ${count} ${count === 1 ? 'тест' : 'тестів'}</div>
        <div class="tmg-actions">
            ${AppState.canMutate() ? `
            <button type="button" class="tmg-btn" onclick="TestsManagerPage.openGroupEditor('${g.id}')"><i class="fa-solid fa-pen"></i> Редагувати</button>
            <button type="button" class="tmg-btn" onclick="TestsManagerPage.openGroupAssign('${g.id}')"><i class="fa-solid fa-user-group"></i> Призначити</button>
            <button type="button" class="tmg-btn tmg-btn-danger" onclick="TestsManagerPage._deleteGroup('${g.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
    </div>
</div>`;
    },

    async _deleteGroup(id) {
        const ok = await Modal.confirm({ title: 'Видалити групу', message: 'Групу буде видалено. Тести залишаться, але їх призначення в межах групи розв\'яжуться. Продовжити?', danger: true });
        if (!ok) return;
        Loader.show();
        try {
            await TestsManagerAPI.deleteGroup(id);
            Toast.success('Групу видалено');
            await this._renderGroupsList(this._container);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Group editor ─────────────────────────────────────────────

    async openGroupEditor(groupId) {
        this._pendingGroupCoverFile = null;
        let group = null;
        if (groupId) {
            Loader.show();
            try { group = await TestsManagerAPI.getGroup(groupId); }
            catch(e) { Loader.hide(); Toast.error('Помилка', e.message); return; }
            Loader.hide();
        }
        this._groupCoverUrl = group?.cover_image || null;
        const items = (group?.items || []).slice().sort((a,b) => a.order_index - b.order_index);
        this._editorGroupItems = items.map(it => ({ id: it.test_id, title: it.test?.title || '(тест видалено)' }));

        const availableTests = (this._tests?.length ? this._tests : await TestsManagerAPI.getAllStandalone().catch(e => { console.error('[test group editor] load tests:', e); return []; }));
        this._editorAllTests = availableTests;

        Modal.open({
            title: groupId ? 'Редагувати групу тестів' : 'Нова група тестів',
            size: 'lg',
            body: `
<style>
.tmge-cover-wrap{margin-bottom:16px}
.tmge-stretch-row{display:flex;align-items:flex-start;gap:10px;font-size:.83rem;color:var(--text-primary);margin:-4px 0 16px;cursor:pointer}
.tmge-stretch-row input{margin-top:2px;accent-color:var(--primary);flex-shrink:0}
.tmge-stretch-hint{display:block;font-size:.75rem;color:var(--text-muted);font-weight:400;margin-top:2px}
.tmge-cover-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;height:200px;border:2px dashed var(--border);border-radius:12px;cursor:pointer;color:var(--text-muted);text-align:center}
.tmge-cover-empty:hover{border-color:var(--primary);color:var(--primary)}
.tmge-cover-preview{position:relative;height:200px;border-radius:12px;overflow:hidden}
.tmge-cover-preview img{width:100%;height:100%;object-fit:cover}
.tmge-cover-actions{position:absolute;top:8px;right:8px;display:flex;gap:6px}
.tmge-cover-btn{width:30px;height:30px;border-radius:8px;border:none;background:rgba(0,0,0,.55);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.tmge-field{margin-bottom:14px}
.tmge-label{display:block;font-size:.78rem;font-weight:700;color:var(--text-secondary);margin-bottom:6px}
.tmge-inp,.tmge-textarea{width:100%;padding:9px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.85rem;outline:none;font-family:inherit}
.tmge-inp:focus,.tmge-textarea:focus{border-color:var(--primary)}
.tmge-textarea{resize:vertical;min-height:60px}
.tmge-toggle-row{display:flex;align-items:center;gap:10px;font-size:.84rem;color:var(--text-primary)}
.tmge-items{border:1px solid var(--border);border-radius:12px;overflow:hidden}
.tmge-item{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:.83rem}
.tmge-item:last-child{border-bottom:none}
.tmge-item-idx{width:20px;text-align:center;font-weight:700;color:var(--text-muted);flex-shrink:0}
.tmge-item-title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tmge-item-btn{width:26px;height:26px;border-radius:7px;border:1.5px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;flex-shrink:0}
.tmge-item-btn:hover{border-color:var(--primary);color:var(--primary)}
.tmge-item-btn:disabled{opacity:.3;cursor:not-allowed}
.tmge-empty-items{padding:14px;text-align:center;color:var(--text-muted);font-size:.8rem}
.tmge-checklist{border:1px solid var(--border);border-radius:12px;max-height:220px;overflow-y:auto}
.tmge-check-row{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:.83rem;cursor:pointer}
.tmge-check-row:last-child{border-bottom:none}
.tmge-check-row:hover{background:var(--bg-hover)}
.tmge-check-row input{width:16px;height:16px;accent-color:var(--primary);flex-shrink:0}
.tmge-check-row span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-primary)}
</style>
<div class="tmge-cover-wrap" id="tmge-cover-wrap">${this._groupCoverPreviewHtml()}</div>
<label class="tmge-stretch-row">
    <input type="checkbox" id="tmge-stretch-cover" ${group?.stretch_cover_image ? 'checked' : ''}>
    <span><b>Розтягнути обкладинку</b><span class="tmge-stretch-hint">Картинка групи заповнює всю ширину блока (без збереження пропорцій)</span></span>
</label>
<div class="tmge-field">
    <label class="tmge-label">Назва групи</label>
    <input class="tmge-inp" id="tmge-title" type="text" value="${Fmt.esc(group?.title || '')}" placeholder="Напр. Вступний курс продавця">
</div>
<div class="tmge-field">
    <label class="tmge-label">Опис</label>
    <textarea class="tmge-textarea" id="tmge-desc" placeholder="Короткий опис групи тестів">${Fmt.esc(group?.description || '')}</textarea>
</div>
<div class="tmge-field">
    <label class="tmge-toggle-row"><input type="checkbox" id="tmge-seq" ${(group ? group.is_sequential : true) ? 'checked' : ''}> Проходити тести строго по порядку (наступний тест відкривається лише після успішного складання попереднього)</label>
</div>
<div class="tmge-field">
    <label class="tmge-label">Тести для додавання</label>
    <div class="tmge-checklist" id="tmge-checklist">${this._groupChecklistHtml()}</div>
</div>
<div class="tmge-field">
    <label class="tmge-label">Тести у групі (порядок проходження)</label>
    <div class="tmge-items" id="tmge-items">${this._groupItemsHtml()}</div>
</div>`,
            footer: `
<button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
<button class="btn btn-primary" onclick="TestsManagerPage._saveGroup('${groupId || ''}')"><i class="fa-solid fa-check"></i> Зберегти</button>`
        });
    },

    _groupCoverPreviewHtml() {
        if (this._groupCoverUrl) return `
<div class="tmge-cover-preview">
    <img src="${Fmt.esc(this._groupCoverUrl)}" alt="">
    <div class="tmge-cover-actions">
        <label class="tmge-cover-btn"><i class="fa-solid fa-image"></i><input type="file" accept="image/*" style="display:none" onchange="TestsManagerPage._onGroupCoverPick(this)"></label>
        <button type="button" class="tmge-cover-btn" onclick="TestsManagerPage._removeGroupCover()"><i class="fa-solid fa-trash"></i></button>
    </div>
</div>`;
        return `
<label class="tmge-cover-empty">
    <i class="fa-solid fa-cloud-arrow-up"></i>
    <span>Завантажити обкладинку групи</span>
    <input type="file" accept="image/*" style="display:none" onchange="TestsManagerPage._onGroupCoverPick(this)">
</label>`;
    },

    _onGroupCoverPick(input) {
        const file = input.files[0];
        if (!file) return;
        this._pendingGroupCoverFile = file;
        const reader = new FileReader();
        reader.onload = e => {
            this._groupCoverUrl = e.target.result;
            document.getElementById('tmge-cover-wrap').innerHTML = this._groupCoverPreviewHtml();
        };
        reader.readAsDataURL(file);
    },

    _removeGroupCover() {
        this._pendingGroupCoverFile = null;
        this._groupCoverUrl = '';
        document.getElementById('tmge-cover-wrap').innerHTML = this._groupCoverPreviewHtml();
    },

    _groupItemsHtml() {
        const items = this._editorGroupItems || [];
        if (!items.length) return `<div class="tmge-empty-items">Ще немає тестів у групі</div>`;
        return items.map((it, i) => `
<div class="tmge-item">
    <span class="tmge-item-idx">${i + 1}</span>
    <span class="tmge-item-title">${Fmt.esc(it.title)}</span>
    <button type="button" class="tmge-item-btn" ${i === 0 ? 'disabled' : ''} onclick="TestsManagerPage._groupMoveItem(${i},-1)"><i class="fa-solid fa-arrow-up"></i></button>
    <button type="button" class="tmge-item-btn" ${i === items.length - 1 ? 'disabled' : ''} onclick="TestsManagerPage._groupMoveItem(${i},1)"><i class="fa-solid fa-arrow-down"></i></button>
    <button type="button" class="tmge-item-btn" onclick="TestsManagerPage._groupRemoveItem(${i})"><i class="fa-solid fa-xmark"></i></button>
</div>`).join('');
    },

    _groupChecklistHtml() {
        const usedIds = new Set((this._editorGroupItems || []).map(it => it.id));
        const tests = this._editorAllTests || [];
        if (!tests.length) return `<div class="tmge-empty-items">Немає доступних тестів</div>`;
        return tests.map(t => `
<label class="tmge-check-row">
    <input type="checkbox" value="${t.id}" ${usedIds.has(t.id) ? 'checked' : ''} onchange="TestsManagerPage._groupToggleTest('${t.id}', this.checked)">
    <span>${Fmt.esc(t.title)}</span>
</label>`).join('');
    },

    _refreshGroupEditorLists() {
        document.getElementById('tmge-items').innerHTML      = this._groupItemsHtml();
        document.getElementById('tmge-checklist').innerHTML  = this._groupChecklistHtml();
    },

    _groupToggleTest(testId, checked) {
        if (checked) {
            if ((this._editorGroupItems || []).some(it => it.id === testId)) return;
            const test = this._editorAllTests.find(t => t.id === testId);
            if (!test) return;
            this._editorGroupItems.push({ id: test.id, title: test.title });
        } else {
            this._editorGroupItems = (this._editorGroupItems || []).filter(it => it.id !== testId);
        }
        this._refreshGroupEditorLists();
    },

    _groupRemoveItem(i) {
        this._editorGroupItems.splice(i, 1);
        this._refreshGroupEditorLists();
    },

    _groupMoveItem(i, dir) {
        const items = this._editorGroupItems;
        const j = i + dir;
        if (j < 0 || j >= items.length) return;
        [items[i], items[j]] = [items[j], items[i]];
        document.getElementById('tmge-items').innerHTML = this._groupItemsHtml();
    },

    async _saveGroup(groupId) {
        const title = Dom.val('tmge-title').trim();
        if (!title) { Toast.warning('Вкажіть назву групи'); return; }
        const payload = {
            title,
            description: Dom.val('tmge-desc').trim() || null,
            is_sequential: !!document.getElementById('tmge-seq')?.checked,
            stretch_cover_image: !!document.getElementById('tmge-stretch-cover')?.checked
        };
        Loader.show();
        try {
            let group;
            if (groupId) group = await TestsManagerAPI.updateGroup(groupId, payload);
            else          group = await TestsManagerAPI.createGroup(payload);

            if (this._pendingGroupCoverFile) {
                const url = await TestsManagerAPI.uploadGroupCover(group.id, this._pendingGroupCoverFile);
                await TestsManagerAPI.updateGroup(group.id, { cover_image: url });
            } else if (this._groupCoverUrl === '') {
                await TestsManagerAPI.updateGroup(group.id, { cover_image: null });
            }

            await TestsManagerAPI.setGroupItems(group.id, (this._editorGroupItems || []).map(it => it.id));

            Toast.success(groupId ? 'Групу збережено' : 'Групу створено');
            Modal.close();
            await this._renderGroupsList(this._container);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    // ── Group assign modal ────────────────────────────────────────

    async openGroupAssign(groupId) {
        const container = this._container;
        container.innerHTML = '<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>';
        let group, allEmployees, assignedMap;
        try {
            [group, allEmployees, assignedMap] = await Promise.all([
                TestsManagerAPI.getGroup(groupId),
                TestsManagerAPI.getAllEmployees(),
                TestsManagerAPI.getGroupAssignedUsers(groupId)
            ]);
        } catch(e) { Toast.error('Помилка', e.message); await this._renderGroupsList(container); return; }

        let employees = allEmployees;
        if (!AppState.isAdmin()) employees = allEmployees.filter(e => e.manager_id === AppState.user.id);

        this._groupAssignId    = groupId;
        this._groupAssignTitle = group.title;
        this._groupAssignSel   = new Set(assignedMap.keys());

        container.innerHTML = `
<style>
.tga-page{max-width:720px}
.tga-title{font-size:1.1rem;font-weight:800;color:var(--text-primary);margin-bottom:4px}
.tga-sub{font-size:.82rem;color:var(--text-muted);margin-bottom:18px}
.tga-dl{margin-bottom:14px}
.tga-dl label{font-size:.78rem;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px}
.tga-dl input{padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.84rem}
.tga-list{border:1px solid var(--border);border-radius:14px;max-height:420px;overflow-y:auto}
.tga-item{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--border);cursor:pointer}
.tga-item:last-child{border-bottom:none}
.tga-item:hover{background:var(--bg-hover)}
.tga-item input{width:17px;height:17px;accent-color:var(--primary)}
.tga-name{font-weight:600;font-size:.87rem;color:var(--text-primary)}
.tga-pos{margin-left:auto;font-size:.78rem;color:var(--text-muted)}
.tga-foot{display:flex;gap:10px;margin-top:16px}
.tga-cancel{padding:11px 20px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.85rem;font-weight:600;cursor:pointer;flex:1}
.tga-save{padding:11px 20px;border-radius:12px;border:none;background:var(--primary);color:#fff;font-size:.85rem;font-weight:700;cursor:pointer;flex:2}
</style>
<div class="tga-page">
    <button class="btn-back" style="margin-bottom:16px" onclick="TestsManagerPage._renderGroupsList(TestsManagerPage._container)"><i class="fa-solid fa-arrow-left"></i> Назад</button>
    <div class="tga-title">Призначити: ${Fmt.esc(group.title)}</div>
    <div class="tga-sub">${(group.items || []).length} тест(ів) у групі. Оберіть співробітників, яким призначити всю групу.</div>
    <div class="tga-dl">
        <label>Дедлайн (необов'язково)</label>
        ${UaDateTime.html('tga-deadline')}
    </div>
    <div class="tga-list" id="tga-list">
        ${employees.map(e => `
        <label class="tga-item">
            <input type="checkbox" value="${e.id}" ${this._groupAssignSel.has(e.id) ? 'checked' : ''} onchange="TestsManagerPage._toggleGroupAssignSel('${e.id}', this.checked)">
            <span class="tga-name">${Fmt.esc(e.full_name)}</span>
            <span class="tga-pos">${Fmt.esc(e.job_position || '')}</span>
        </label>`).join('')}
    </div>
    <div class="tga-foot">
        <button class="tga-cancel" onclick="TestsManagerPage._renderGroupsList(TestsManagerPage._container)">Скасувати</button>
        <button class="tga-save" onclick="TestsManagerPage._saveGroupAssign()"><i class="fa-solid fa-check"></i> Призначити</button>
    </div>
</div>`;
    },

    _toggleGroupAssignSel(userId, checked) {
        if (checked) this._groupAssignSel.add(userId);
        else this._groupAssignSel.delete(userId);
    },

    async _saveGroupAssign() {
        const dlInp = document.getElementById('tga-deadline');
        const deadlineAt = dlInp?.value ? new Date(dlInp.value).toISOString() : null;
        const groupId = this._groupAssignId;
        Loader.show();
        try {
            const before = await TestsManagerAPI.getGroupAssignedUsers(groupId);
            const beforeIds = new Set(before.keys());
            const afterIds  = this._groupAssignSel;
            const toUnassign = [...beforeIds].filter(id => !afterIds.has(id));

            if (afterIds.size) await TestsManagerAPI.assignGroup(groupId, [...afterIds], deadlineAt);
            for (const uid of toUnassign) await TestsManagerAPI.unassignGroup(groupId, uid);

            const newlyAssigned = [...afterIds].filter(id => !beforeIds.has(id));
            if (newlyAssigned.length) {
                const groupTitle = this._groupAssignTitle || 'групу тестів';
                const rows = newlyAssigned.map(uid => ({
                    user_id: uid, type: 'test_assigned',
                    title: `Вам призначено групу тестів: ${groupTitle}`,
                    message: 'Пройдіть призначені тести у вкладці «Мої тести»',
                    link: 'expert-path?tab=tests'
                }));
                const r = await supabase.from('notifications').insert(rows);
                if (r.error) console.error('[test group assign] notify:', r.error);
            }

            Toast.success('Призначення збережено');
            await this._renderGroupsList(this._container);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _rowHtml(t, i = 0) {
        const qCount   = t.questions?.length ?? '—';
        const st       = this._listStats?.[t.id];
        const assigned = st?.assigned || 0;
        const passedN  = st?.passed?.size || 0;
        const pct      = assigned ? Math.round(passedN / assigned * 100) : 0;
        const canMut   = AppState.canMutate();
        const openRow  = canMut ? `TestsManagerPage.openEditor('${t.id}')` : `TestsManagerPage.openResultsModal('${t.id}')`;
        return `
<tr class="tm-row" style="--i:${i}" data-pub="${!!t.is_published}" data-title="${Fmt.esc((t.title||'').toLowerCase())}" data-progress="${pct}">
    <td class="tm-td-name" onclick="${openRow}">
        <div class="tm-row-name-wrap">
            ${t.cover_image
                ? `<img class="tm-row-thumb" src="${Fmt.esc(t.cover_image)}" alt="">`
                : `<div class="tm-row-thumb tm-row-thumb-ph"><i class="fa-solid fa-file-pen"></i></div>`}
            <div style="min-width:0">
                <div class="tm-row-title">${Fmt.esc(t.title)}</div>
                ${t.description ? `<div class="tm-row-desc">${Fmt.esc(t.description)}</div>` : ''}
            </div>
        </div>
    </td>
    <td class="tm-td-q">
        <span class="tm-chip tm-chip-q"><i class="fa-solid fa-question"></i> ${qCount}</span>
        ${assigned ? `
        <div class="tm-row-prog">
            <div class="tm-pbar"><div class="tm-pbar-fill" style="width:${pct}%"></div></div>
            <span>${passedN}/${assigned} · ${pct}%</span>
        </div>` : ''}
    </td>
    <td class="tm-td-pub" onclick="event.stopPropagation()">
        ${canMut
            ? `<div class="tm-pub-tgl${t.is_published ? ' on' : ''}" onclick="TestsManagerPage._togglePublish('${t.id}',this)" title="Опублікувати / зняти з публікації"><div class="tm-pub-knob"></div></div>`
            : `<span class="tm-chip ${t.is_published ? 'tm-chip-pub' : 'tm-chip-draft'}">${t.is_published ? '<i class="fa-solid fa-check"></i> Опубліковано' : 'Чернетка'}</span>`}
    </td>
    <td class="tm-td-actions" onclick="event.stopPropagation()">
        <div class="tm-act-group">
            <button class="tm-act-btn" title="Редагувати питання" onclick="TestsManagerPage.openEditor('${t.id}')"><i class="fa-solid fa-pen"></i></button>
            ${canMut ? `<button class="tm-act-btn" title="Призначити" onclick="TestsManagerPage.openAssignModal('${t.id}')"><i class="fa-solid fa-user-plus"></i></button>` : ''}
            <button class="tm-act-btn" title="Результати" onclick="TestsManagerPage.openResultsModal('${t.id}')"><i class="fa-solid fa-chart-column"></i></button>
            ${canMut ? `
            <button class="tm-act-btn" title="Налаштування" onclick="TestsManagerPage.openSettings('${t.id}')"><i class="fa-solid fa-gear"></i></button>
            <button class="tm-act-btn" title="Дублювати" onclick="TestsManagerPage.duplicateTest('${t.id}')"><i class="fa-regular fa-copy"></i></button>
            <button class="tm-act-btn tm-act-danger" title="Видалити" onclick="TestsManagerPage.deleteTest('${t.id}',${JSON.stringify(t.title||'').replace(/"/g,'&quot;')})"><i class="fa-solid fa-trash"></i></button>` : ''}
        </div>
    </td>
</tr>`;
    },

    // ── Create / Edit meta modal ──────────────────────────────────

    openCreateModal() {
        Modal.open({
            title: '<i class="fa-solid fa-bolt" style="color:#C9A227"></i> Новий тест',
            body: `
<div style="display:flex;flex-direction:column;gap:14px">
    <div>
        <label style="display:block;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:7px">Назва тесту</label>
        <div style="display:flex;border:1.5px solid var(--border);border-radius:10px;background:var(--bg-raised);overflow:hidden">
            <div style="width:42px;display:flex;align-items:center;justify-content:center;background:var(--bg-hover);color:var(--text-muted);font-size:.85rem"><i class="fa-solid fa-heading"></i></div>
            <input id="tmqc-title" placeholder="Напр.: Оцінка ювелірних виробів" autocomplete="off"
                style="flex:1;border:none;background:transparent;color:var(--text-primary);font-size:.92rem;padding:12px 14px;outline:none;font-family:inherit">
        </div>
    </div>
    <div style="display:flex;gap:8px;font-size:.78rem;color:var(--text-muted);line-height:1.55">
        <i class="fa-solid fa-circle-info" style="color:var(--primary);margin-top:2px"></i>
        <span>Тест створиться як чернетка з типовими налаштуваннями (прохідний бал 70%, 1 спроба). Обкладинку, ліміт часу та автоматизацію можна додати пізніше — кнопка «⚙ Налаштування» в редакторі.</span>
    </div>
</div>`,
            footer: `
<button class="btn-primary-modern" onclick="TestsManagerPage._quickCreate()"><i class="fa-solid fa-arrow-right"></i> Створити і додати питання</button>
<button class="btn-secondary-modern" onclick="Modal.close()">Скасувати</button>`
        });
        setTimeout(() => {
            const inp = document.getElementById('tmqc-title');
            if (!inp) return;
            inp.focus();
            inp.addEventListener('keydown', e => { if (e.key === 'Enter') TestsManagerPage._quickCreate(); });
        }, 80);
    },

    async _quickCreate() {
        const title = document.getElementById('tmqc-title')?.value.trim();
        if (!title) { Toast.error('Помилка', 'Введіть назву тесту'); document.getElementById('tmqc-title')?.focus(); return; }
        Loader.show();
        try {
            const test = await API.tests.create({
                title, description: null,
                passing_score: 70, max_attempts: 1,
                is_published: false, course_id: null,
                created_by: AppState.user.id
            });
            Modal.close();
            ActivityTracker.track('test_create', { entity_type: 'test', entity_id: test.id, entity_title: title });
            Toast.success('Тест створено', 'Додайте питання і опублікуйте');
            await this.openEditor(test.id);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _togglePublish(testId, el) {
        const t = this._tests.find(x => x.id === testId);
        if (!t) return;
        const next = !t.is_published;
        el.style.pointerEvents = 'none';
        try {
            await API.tests.update(testId, { is_published: next });
            t.is_published = next;
            el.classList.toggle('on', next);
            el.closest('.tm-row')?.setAttribute('data-pub', String(next));
            // refresh filter chip counters
            const chips = document.getElementById('tm-fchips');
            if (chips) {
                const pubN = this._tests.filter(x => x.is_published).length;
                chips.querySelector('[data-f="pub"] b').textContent   = pubN;
                chips.querySelector('[data-f="draft"] b').textContent = this._tests.length - pubN;
            }
            this._applyListFilters();
            Toast.success(next ? 'Опубліковано' : 'Знято з публікації');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { el.style.pointerEvents = ''; }
    },

    _setListFilter(f, btn) {
        this._listFilter = f;
        document.querySelectorAll('.tm-fchip').forEach(c => c.classList.remove('on'));
        btn.classList.add('on');
        this._applyListFilters();
    },

    _setListSort(mode) {
        const tbody = document.getElementById('tm-tbody');
        if (!tbody || !this._tests.length) return;
        const sorted = [...this._tests];
        if (mode === 'title')         sorted.sort((a, b) => (a.title||'').localeCompare(b.title||'', 'uk'));
        else if (mode === 'progress') sorted.sort((a, b) => {
            const p = t => { const s = this._listStats?.[t.id]; return s?.assigned ? (s.passed?.size||0) / s.assigned : -1; };
            return p(b) - p(a);
        });
        else sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        tbody.innerHTML = sorted.map((t, i) => this._rowHtml(t, i)).join('');
        this._applyListFilters();
    },

    _applyListFilters() {
        const f = this._listFilter || 'all';
        const q = (this._listQuery || '').trim().toLowerCase();
        document.querySelectorAll('#tm-tbody .tm-row').forEach(row => {
            const okF = f === 'all' || (f === 'pub') === (row.dataset.pub === 'true');
            const okQ = !q || (row.dataset.title || '').includes(q);
            row.style.display = okF && okQ ? '' : 'none';
        });
    },

    openSettings(testId) {
        const t = this._tests.find(x => x.id === testId);
        if (!t) return;
        const c = TestsManagerPage._container;
        this._renderSettings(c, t);
    },

    async _goBack(container) {
        await this._checkDirty();
        this._dirty = false;
        if (this._prevView === 'editor' && this._curTest) this._renderEditor(container);
        else this._renderList(container);
    },

    async _renderSettings(container, test) {
        container.innerHTML = '<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>';
        const isEdit = !!test;
        this._pendingCoverFile = null;
        this._coverImageUrl    = test?.cover_image || null;
        const selectedPos = test?.auto_assign_positions || [];
        // Посади — зі справочника (positions), а не з job_position профілів
        let allPositions = [];
        try {
            allPositions = (await API.positions.getAll()).map(p => p.name);
        } catch(e) { console.error('[tests-manager] positions:', e); }
        if (!allPositions.length) {
            // Fallback: якщо справочник порожній — старий спосіб (з профілів)
            try { allPositions = await TestsManagerAPI.getPositions(); } catch(_) {}
        }
        // Обрані раніше посади, яких вже немає в справочнику, не губимо
        selectedPos.forEach(p => { if (!allPositions.includes(p)) allPositions.push(p); });

        const toggles = [
            { id: 'tm-restart',  icon: 'fa-solid fa-arrow-rotate-left', label: 'Почати заново',        sub: 'Дозволити скинути прогрес і пройти тест з початку', on: !!test?.allow_restart },
            { id: 'tm-skip',     icon: 'fa-solid fa-forward',           label: 'Пропуск питань',        sub: 'Дозволити пропускати питання без відповіді',        on: !!test?.allow_skip },
            { id: 'tm-feedback', icon: 'fa-regular fa-circle-check',    label: 'Миттєвий фідбек',       sub: 'Показувати правильність відповіді після кожного питання', on: !!test?.show_answer_feedback },
            { id: 'tm-wrong',    icon: 'fa-solid fa-list-check',        label: 'Протокол помилок',      sub: 'Показувати розбір невірних відповідей після завершення', on: !!test?.show_wrong_answers },
            { id: 'tm-grant-reassign', icon: 'fa-solid fa-rotate-right', label: 'Нова спроба при перепризначенні', sub: 'Напр. при записі на лекцію — якщо тест вже пройдено, додати ще одну спробу', on: !!test?.grant_attempt_on_reassign }
        ];
        container.innerHTML = `<style>
.tset-page{max-width:920px}
.tset-hero{display:flex;align-items:center;gap:14px;padding:18px 22px;margin-bottom:22px;border-radius:18px;border:1px solid var(--border);
    background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 14%,var(--bg-surface)),color-mix(in srgb,var(--primary) 4%,var(--bg-surface)))}
.tset-hero-icon{width:42px;height:42px;border-radius:12px;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;box-shadow:0 4px 14px color-mix(in srgb,var(--primary) 40%,transparent)}
.tset-hero-text{flex:1;min-width:0}
.tset-hero-title{font-size:1.05rem;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tset-hero-sub{font-size:.76rem;color:var(--text-muted);margin-top:2px}
.tset-hero .btn{flex-shrink:0}
.tset-grid{display:grid;grid-template-columns:1fr 340px;gap:22px;align-items:start}
@media(max-width:700px){.tset-grid{grid-template-columns:1fr}}
.tset-section{margin-bottom:22px}
.tset-section-lbl{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:10px}
.tset-field{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}
.tset-field-icon{width:32px;height:32px;border-radius:8px;background:var(--bg-hover);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:.82rem;color:var(--text-muted);flex-shrink:0;margin-top:19px}
.tset-field-inner{flex:1;min-width:0}
.tset-label{display:block;font-size:.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.tset-input{background:var(--bg-raised);border:1.5px solid var(--border);border-radius:10px;padding:9px 12px;font-size:.88rem;color:var(--text-primary);outline:none;width:100%;box-sizing:border-box;transition:border-color .18s,box-shadow .18s;font-family:inherit}
.tset-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 15%,transparent)}
.tset-textarea{min-height:56px;resize:vertical}
.tset-select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;cursor:pointer}
.tset-row2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.tset-toggle-row{display:flex;align-items:center;gap:12px;padding:11px 13px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:12px;cursor:pointer;transition:border-color .15s,background .15s;user-select:none;margin-bottom:8px}
.tset-toggle-row:hover{border-color:var(--border-light)}
.tset-toggle-icon{width:30px;height:30px;border-radius:8px;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-size:.85rem;color:var(--text-muted);flex-shrink:0;transition:all .15s}
.tset-toggle-input{position:absolute;opacity:0;width:1px;height:1px}
.tset-toggle-input:checked ~ .tset-toggle-icon{background:color-mix(in srgb,var(--primary) 15%,transparent);color:var(--primary)}
.tset-toggle-text{flex:1;min-width:0}
.tset-toggle-label{display:block;font-size:.85rem;font-weight:600;color:var(--text-primary)}
.tset-toggle-sub{display:block;font-size:.73rem;color:var(--text-muted);margin-top:1px}
.tset-toggle-pill{width:38px;height:21px;border-radius:11px;background:var(--border);position:relative;flex-shrink:0;transition:background .2s}
.tset-toggle-input:checked ~ .tset-toggle-pill{background:var(--primary)}
.tset-toggle-knob{position:absolute;top:3px;left:3px;width:15px;height:15px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:transform .2s}
.tset-toggle-input:checked ~ .tset-toggle-pill .tset-toggle-knob{transform:translateX(17px)}
.tset-toggle-row--pub{background:rgba(16,185,129,.06);border-color:rgba(16,185,129,.25)}
.tset-toggle-row--pub:hover{border-color:rgba(16,185,129,.4)}
.tset-toggle-row--pub .tset-toggle-input:checked ~ .tset-toggle-icon{background:rgba(16,185,129,.18);color:#10b981}
.tset-toggle-row--pub .tset-toggle-input:checked ~ .tset-toggle-pill{background:#10b981}
.tset-auto-panel{padding:16px;border-radius:14px;border:1.5px solid var(--border);background:var(--bg-raised);display:flex;flex-direction:column;gap:10px}
.tset-auto-head{display:flex;align-items:center;gap:10px}
.tset-auto-icon{width:32px;height:32px;border-radius:9px;background:color-mix(in srgb,var(--primary) 14%,transparent);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0}
.tset-auto-title{font-weight:700;font-size:.86rem;color:var(--text-primary)}
.tset-auto-sub{font-size:.73rem;color:var(--text-muted);margin-top:1px}
.tset-pos-tags{display:flex;flex-wrap:wrap;gap:4px;min-height:24px}
.tset-pos-search{width:100%;box-sizing:border-box;padding:7px 10px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.82rem;outline:none;font-family:inherit;transition:border-color .15s}
.tset-pos-search:focus{border-color:var(--primary)}
.tset-pos-list{flex:1;max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;padding:3px;background:var(--bg-surface)}
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
.tm-cover-stretch-row{display:flex;align-items:flex-start;gap:10px;padding:10px 4px 20px;cursor:pointer}
.tm-cover-stretch-row input{width:17px;height:17px;margin-top:2px;accent-color:var(--primary);cursor:pointer;flex-shrink:0}
.tm-cover-stretch-row b{font-size:.85rem;color:var(--text-primary)}
.tm-cover-stretch-hint{font-size:.76rem;color:var(--text-muted)}
</style>
<div class="tset-page">
    <div class="tset-hero">
        <button class="btn-back btn-back-icon" onclick="TestsManagerPage._goBack(TestsManagerPage._container)" title="Назад"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="tset-hero-icon"><i class="fa-solid fa-gear"></i></div>
        <div class="tset-hero-text">
            <div class="tset-hero-title">${isEdit ? Fmt.esc(test.title) : 'Новий тест'}</div>
            <div class="tset-hero-sub">${isEdit ? 'Налаштування тесту' : 'Базові параметри перед створенням'}</div>
        </div>
        <button class="btn-primary-modern" onclick="TestsManagerPage._saveMeta(${isEdit ? `'${test.id}'` : 'null'})">${isEdit ? '<i class="fa-regular fa-floppy-disk"></i> Зберегти' : '<i class="fa-solid fa-plus"></i> Створити'}</button>
    </div>
    <div class="tm-cover-frame">
        <div id="tm-cover-wrap" class="tm-cover-upload">
            ${test?.cover_image
                ? `<img class="tm-cover-preview" id="tm-cover-img" src="${Fmt.esc(test.cover_image)}" alt="">
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
    <label class="tm-cover-stretch-row">
        <input type="checkbox" id="tm-stretch-cover" ${test?.stretch_cover_image ? 'checked' : ''}>
        <span><b>Розтягнути обкладинку</b><br><span class="tm-cover-stretch-hint">Картинка тесту заповнює всю ширину блока (без збереження пропорцій)</span></span>
    </label>
    <div class="tset-grid">
        <div>
            <div class="tset-section">
                <div class="tset-field">
                    <div class="tset-field-icon"><i class="fa-solid fa-heading"></i></div>
                    <div class="tset-field-inner">
                        <label class="tset-label">Назва тесту *</label>
                        <input id="tm-title" class="tset-input" type="text" placeholder="Введіть назву" value="${Fmt.esc(test?.title||'')}">
                    </div>
                </div>
                <div class="tset-field">
                    <div class="tset-field-icon"><i class="fa-solid fa-align-left"></i></div>
                    <div class="tset-field-inner">
                        <label class="tset-label">Опис</label>
                        <textarea id="tm-desc" class="tset-input tset-textarea" rows="2" placeholder="Короткий опис (необов'язково)">${Fmt.esc(test?.description||'')}</textarea>
                    </div>
                </div>
                <div class="tset-field">
                    <div class="tset-field-icon"><i class="fa-regular fa-clock"></i></div>
                    <div class="tset-field-inner">
                        <div class="tset-row2">
                            <div>
                                <label class="tset-label">Ліміт часу, хв</label>
                                <input id="tm-time" class="tset-input" type="number" min="1" max="300" placeholder="Без ліміту" value="${test?.time_limit_minutes||''}">
                            </div>
                            <div>
                                <label class="tset-label">Макс. спроб</label>
                                <input id="tm-attempts" class="tset-input" type="number" min="1" max="10" placeholder="1" value="${test?.max_attempts||1}">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="tset-field">
                    <div class="tset-field-icon"><i class="fa-solid fa-trophy"></i></div>
                    <div class="tset-field-inner">
                        <div class="tset-row2">
                            <div>
                                <label class="tset-label">Прохідний бал, %</label>
                                <input id="tm-score" class="tset-input" type="number" min="1" max="100" value="${test?.passing_score||70}">
                            </div>
                            <div>
                                <label class="tset-label">Категорія табелю</label>
                                <select id="tm-intern-cat" class="tset-input tset-select">
                                    <option value="">— Не використовується —</option>
                                    <option value="техніка"            ${test?.intern_category==='техніка'           ?'selected':''}>Техніка — теорія</option>
                                    <option value="оцінка_техніки"    ${test?.intern_category==='оцінка_техніки'   ?'selected':''}>Техніка — практика</option>
                                    <option value="магазин"            ${test?.intern_category==='магазин'           ?'selected':''}>Магазин</option>
                                    <option value="драг_метали"        ${test?.intern_category==='драг_метали'       ?'selected':''}>ДМ — теорія</option>
                                    <option value="оцінка_драг_метали" ${test?.intern_category==='оцінка_драг_метали'?'selected':''}>ДМ — практика</option>
                                    <option value="загальний"          ${test?.intern_category==='загальний'         ?'selected':''}>Загальний</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="tset-section">
                <div class="tset-section-lbl">Поведінка тесту</div>
                <label class="tset-toggle-row" for="tm-shuffle">
                    <input type="checkbox" id="tm-shuffle" class="tset-toggle-input" ${test?.randomize_questions?'checked':''}>
                    <div class="tset-toggle-icon"><i class="fa-solid fa-shuffle"></i></div>
                    <div class="tset-toggle-text">
                        <span class="tset-toggle-label">Перемішати питання</span>
                        <span class="tset-toggle-sub">Порядок питань випадковий для кожної спроби</span>
                    </div>
                    <div class="tset-toggle-pill"><div class="tset-toggle-knob"></div></div>
                </label>
                ${toggles.map(t => `
                <label class="tset-toggle-row" for="${t.id}">
                    <input type="checkbox" id="${t.id}" class="tset-toggle-input" ${t.on?'checked':''}>
                    <div class="tset-toggle-icon"><i class="${t.icon}"></i></div>
                    <div class="tset-toggle-text">
                        <span class="tset-toggle-label">${t.label}</span>
                        <span class="tset-toggle-sub">${t.sub}</span>
                    </div>
                    <div class="tset-toggle-pill"><div class="tset-toggle-knob"></div></div>
                </label>`).join('')}
            </div>
            <div class="tset-section">
                <div class="tset-section-lbl">Публікація</div>
                <label class="tset-toggle-row tset-toggle-row--pub" for="tm-pub">
                    <input type="checkbox" id="tm-pub" class="tset-toggle-input" ${test?.is_published?'checked':''}>
                    <div class="tset-toggle-icon"><i class="fa-solid fa-globe"></i></div>
                    <div class="tset-toggle-text">
                        <span class="tset-toggle-label">Опубліковано</span>
                        <span class="tset-toggle-sub">Тест доступний для проходження співробітникам</span>
                    </div>
                    <div class="tset-toggle-pill"><div class="tset-toggle-knob"></div></div>
                </label>
            </div>
        </div>
        <div class="tset-auto-panel">
            <div class="tset-auto-head">
                <div class="tset-auto-icon"><i class="fa-solid fa-robot"></i></div>
                <div>
                    <div class="tset-auto-title">Автоматизація</div>
                    <div class="tset-auto-sub">Автоназначення новим співробітникам за посадою</div>
                </div>
            </div>
            <div id="tm-pos-tags" class="tset-pos-tags">
                ${selectedPos.length
                    ? selectedPos.map(p => {
                        const js = JSON.stringify(p).replace(/"/g,'&quot;');
                        return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px 2px 10px;border-radius:20px;background:rgba(99,102,241,.1);border:1.5px solid var(--primary);color:var(--primary);font-size:.72rem;font-weight:600">${Fmt.esc(p)}<button type="button" onclick="TestsManagerPage._removePosTag(${js})" style="background:none;border:none;cursor:pointer;color:var(--primary);padding:0;margin:0 0 0 2px;font-size:.75rem;line-height:1"><i class="fa-solid fa-xmark"></i></button></span>`;
                    }).join('')
                    : `<span style="font-size:.75rem;color:var(--text-muted)">Не вибрано — тільки вручну</span>`
                }
            </div>
            ${allPositions.length ? `
            <input id="tm-pos-search" type="text" class="tset-pos-search" placeholder="Пошук посади..."
                oninput="TestsManagerPage._filterPosSearch(this.value)">
            <div id="tm-pos-list" class="tset-pos-list">
                ${allPositions.map(p => {
                    const on = selectedPos.includes(p);
                    return `<label style="display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:7px;cursor:pointer;background:${on?'rgba(99,102,241,.06)':''};transition:background .12s"
                        onmouseenter="this.style.background=this.querySelector('input').checked?'rgba(99,102,241,.06)':'var(--bg-raised)'"
                        onmouseleave="this.style.background=this.querySelector('input').checked?'rgba(99,102,241,.06)':''">
                        <input type="checkbox" name="tm-pos" value="${Fmt.esc(p)}" ${on?'checked':''}
                            style="width:14px;height:14px;cursor:pointer;accent-color:var(--primary);flex-shrink:0"
                            onchange="TestsManagerPage._togglePosLabel(this.closest('label'),this.checked)">
                        <span style="font-size:.82rem;color:var(--text-primary)">${Fmt.esc(p)}</span>
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
            grant_attempt_on_reassign: document.getElementById('tm-grant-reassign')?.checked || false,
            stretch_cover_image:    document.getElementById('tm-stretch-cover')?.checked || false,
            intern_category:        document.getElementById('tm-intern-cat')?.value  || null,
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
            ActivityTracker.track(testId ? 'test_edit' : 'test_create', { entity_type: 'test', entity_id: test.id, entity_title: test.title });
            Toast.success(testId ? 'Збережено' : 'Тест створено');
            if (testId) await this._renderList(this._container);
            else        await this.openEditor(test.id);
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
            // Explicit 'flex' (not '') — clearing to '' drops back to <label>'s default
            // display:inline, which breaks the checkbox+text row layout while filtering.
            lbl.style.display = (!q || lbl.textContent.trim().toLowerCase().includes(q)) ? 'flex' : 'none';
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
                    .in('role', ['user','smm','manager'])
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
            if (toAssign.some(e => e.id === AppState.user.id)) UI.loadLearnBadge();
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
.te-topbar{display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:16px;margin-bottom:0;flex-shrink:0;flex-wrap:wrap;
    background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 12%,var(--bg-surface)),color-mix(in srgb,var(--primary) 3%,var(--bg-surface)));
    border:1px solid var(--border)}
.te-test-title{font-size:1.1rem;font-weight:700;color:var(--text-primary);flex:1}
.te-body{display:flex;flex:1;gap:0;overflow:hidden;margin-top:16px;border:1px solid var(--border);border-radius:18px;overflow:hidden}

/* Left panel */
.te-left{flex:0 0 65%;min-width:0;display:flex;flex-direction:column;overflow:hidden;border-right:1px solid var(--border)}
.te-left-content{flex:1;overflow-y:auto;padding:18px}

/* Type/points/save toolbar — nested inside the "Текст питання" zone, right under its
   header, colour-matched to the zone's accent via the inherited --zc-color custom prop. */
.te-zone-toolbar{display:flex;flex-direction:column;gap:10px;padding:12px 14px;background:var(--zc-head);border-bottom:1px solid var(--zc-border)}
.te-toolbar-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.te-toolbar-top .te-save-btn-ghost{margin-left:auto}
button.te-save-btn-ghost{background:var(--bg-surface);color:var(--zc-color,var(--primary));border:1.5px solid var(--zc-color,var(--primary));box-shadow:none}
button.te-save-btn-ghost:hover{background:color-mix(in srgb,var(--zc-color,var(--primary)) 10%,var(--bg-surface));transform:none;box-shadow:none}
.te-type-chips{display:flex;gap:8px;flex-wrap:wrap}
.te-type-chip{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:11px 8px;flex:1;min-width:74px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-muted);font-size:.7rem;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap}
.te-type-chip i{font-size:1.05rem}
.te-type-chip.active{border-color:var(--zc-color,var(--primary));color:var(--zc-color,var(--primary));background:var(--bg-surface)}
.te-type-chip:hover:not(.active){border-color:var(--zc-color,var(--border-light));color:var(--text-primary)}
.te-pts-wrap{display:flex;align-items:center;gap:6px;margin-left:auto}
.te-pts-lbl{font-size:.72rem;font-weight:600;color:var(--text-muted)}
.te-pts-inp{width:50px;padding:5px 8px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);text-align:center;font-size:.82rem;outline:none;transition:border-color .15s}
.te-pts-inp:focus{border-color:var(--zc-color,var(--primary))}
.te-lbl{font-size:.78rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}

/* Zone cards — colour-coded sections so the editor stops blending together */
.te-zone{border-radius:14px;margin-bottom:16px;overflow:hidden;border:1.5px solid var(--zc-border);background:var(--zc-bg)}
.te-zone-head{display:flex;align-items:center;gap:9px;padding:9px 14px;background:var(--zc-head)}
.te-zone-icon{width:24px;height:24px;border-radius:7px;background:var(--zc-color);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.7rem;flex-shrink:0}
.te-zone-title{font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--zc-color)}
.te-zone-hint{margin-left:auto;font-size:.72rem;font-weight:500;color:var(--text-muted);text-transform:none;letter-spacing:0}
.te-zone-body{padding:14px}
.te-zone-blue{--zc-color:#3b82f6;--zc-border:rgba(59,130,246,.22);--zc-bg:rgba(59,130,246,.03);--zc-head:rgba(59,130,246,.08)}
.te-zone-green{--zc-color:#10b981;--zc-border:rgba(16,185,129,.22);--zc-bg:rgba(16,185,129,.03);--zc-head:rgba(16,185,129,.08)}
.te-zone-amber{--zc-color:#f59e0b;--zc-border:rgba(245,158,11,.22);--zc-bg:rgba(245,158,11,.03);--zc-head:rgba(245,158,11,.08)}
.te-quill-wrap{border:1.5px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:18px}
.te-quill-wrap .ql-toolbar{border:none;border-bottom:1px solid var(--border);padding:8px 12px;background:var(--bg-raised)}
.te-quill-wrap .ql-container{border:none;font-size:.92rem;min-height:90px;background:var(--bg-surface)}
.te-quill-wrap .ql-editor{padding:12px 14px;min-height:90px;color:var(--text-primary);background:var(--bg-surface);font-size:16px}
/* Icon chips stand out against the gray toolbar strip instead of blending into it */
.ql-toolbar.ql-snow button,
.ql-toolbar.ql-snow .ql-picker-label{
    background:var(--bg-surface);border-radius:6px;transition:background .12s;
}
.ql-toolbar.ql-snow button:hover,
.ql-toolbar.ql-snow button.ql-active,
.ql-toolbar.ql-snow .ql-picker-label:hover,
.ql-toolbar.ql-snow .ql-picker.ql-expanded .ql-picker-label{
    background:color-mix(in srgb,var(--primary) 14%,var(--bg-surface));
}
/* Збільшені іконки тулбару — за замовчуванням Quill дає 28px кнопку/18px svg,
   на щільній тест-панелі це занадто дрібно */
.ql-toolbar.ql-snow button{width:34px;height:34px}
.ql-toolbar.ql-snow button svg{width:22px;height:22px}
.ql-toolbar.ql-snow .ql-picker-label{display:flex;align-items:center;height:34px}
.ql-toolbar.ql-snow .ql-picker-label svg{width:22px;height:22px}

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
.te-add-opt{width:100%;padding:9px;border-radius:12px;border:1.5px dashed var(--border);background:transparent;color:var(--primary);font-size:.85rem;font-weight:600;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:6px}
.te-add-opt:hover{border-color:var(--primary);background:var(--primary-glow,rgba(99,102,241,.07))}

/* Matching */
.te-match-row{display:grid;grid-template-columns:1fr auto 1fr auto;align-items:center;gap:8px;margin-bottom:8px}
.te-match-inp{padding:8px 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.85rem;outline:none;width:100%;box-sizing:border-box}
.te-match-inp:focus{border-color:var(--primary)}
.te-match-arrow{color:var(--text-muted);font-size:1.1rem;flex-shrink:0}

/* Ordering */
.te-order-item{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-surface);margin-bottom:8px;cursor:grab}
.te-order-num{width:24px;height:24px;border-radius:50%;background:var(--primary);color:#fff;font-size:.75rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}

.te-save-btn{display:inline-flex;align-items:center;gap:6px;width:auto;padding:7px 16px;border-radius:10px;background:var(--zc-color,var(--primary));border:none;color:#fff;font-size:.82rem;font-weight:700;cursor:pointer;transition:all .15s;box-shadow:0 3px 10px color-mix(in srgb,var(--zc-color,var(--primary)) 35%,transparent)}
.te-save-btn:hover{transform:translateY(-1px);box-shadow:0 5px 16px color-mix(in srgb,var(--zc-color,var(--primary)) 45%,transparent)}

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
.te-media-panel{position:relative}
.te-media-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.te-media-thumbs{display:flex;flex-wrap:wrap;gap:10px}
.te-media-thumb{position:relative;width:76px;height:76px;border-radius:10px;overflow:hidden;border:1.5px solid var(--border);flex-shrink:0;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.te-media-thumb:hover{border-color:var(--primary);box-shadow:0 4px 14px rgba(0,0,0,.18)}
.te-media-thumb img{width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in}
.te-media-thumb-actions{position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,23,42,.15),rgba(15,23,42,.65));opacity:0;display:flex;align-items:center;justify-content:center;gap:7px;transition:opacity .15s}
.te-media-thumb:hover .te-media-thumb-actions{opacity:1}
.te-media-thumb-actions button{width:30px;height:30px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.82rem;color:#fff;transform:scale(.85);transition:transform .15s,background .15s;box-shadow:0 2px 8px rgba(0,0,0,.35)}
.te-media-thumb:hover .te-media-thumb-actions button{transform:scale(1)}
.te-media-thumb-act-insert{background:#3b82f6}
.te-media-thumb-act-insert:hover{background:#2563eb;transform:scale(1.12)!important}
.te-media-thumb-act-del{background:#ef4444}
.te-media-thumb-act-del:hover{background:#dc2626;transform:scale(1.12)!important}
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
.ql-img-tbar-sep{width:1px;align-self:stretch;background:rgba(255,255,255,.15);margin:4px 1px}
.ql-img-tbar-wgrp{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:0 2px}
.ql-img-tbar-wlbl{font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.03em;color:rgba(255,255,255,.5)}
.ql-img-tbar-winput{display:flex;align-items:center;gap:2px;background:rgba(255,255,255,.08);border-radius:7px;padding:0 6px 0 0}
.ql-img-toolbar input.ql-img-tbar-w{width:44px;height:28px;padding:0 0 0 8px;border:none;border-radius:7px 0 0 7px;background:transparent;color:#fff!important;-webkit-text-fill-color:#fff;caret-color:#fff;font-size:.8rem;font-weight:600;text-align:right;outline:none;font-family:inherit;-moz-appearance:textfield}
.ql-img-toolbar input.ql-img-tbar-w::-webkit-outer-spin-button,.ql-img-toolbar input.ql-img-tbar-w::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.ql-img-tbar-winput:focus-within{background:rgba(255,255,255,.18)}
.ql-img-tbar-wpx{font-size:.7rem;color:rgba(255,255,255,.55);flex-shrink:0}
/* Native drag of an already-embedded image within the editor (reposition) */
.ql-editor img{cursor:grab}
.ql-editor img:active{cursor:grabbing}
/* Tables inserted via the toolbar */
.ql-editor table{border-collapse:collapse;width:100%;margin:8px 0;table-layout:fixed}
.ql-editor table td,.ql-editor table th{border:1px solid var(--border);padding:6px 9px;min-width:32px;vertical-align:top;font-size:.9rem}
.ql-editor table td:focus,.ql-editor table td:focus-visible{outline:2px solid var(--primary);outline-offset:-2px}
.ql-editor table td.te-tbl-cell-sel{background:rgba(0,120,215,.18);box-shadow:inset 0 0 0 1.5px #0078d7}
/* Grid picker popover (toolbar "Insert table" button) */
.te-tbl-picker{position:fixed;z-index:99999;background:rgba(15,23,42,.94);border:1.5px solid rgba(255,255,255,.15);border-radius:12px;padding:12px;box-shadow:0 12px 32px rgba(0,0,0,.4);backdrop-filter:blur(6px)}
.te-tbl-grid{display:grid;grid-template-columns:repeat(10,16px);grid-template-rows:repeat(10,16px);gap:2px}
.te-tbl-cell{width:16px;height:16px;border-radius:2px;background:rgba(255,255,255,.12)}
.te-tbl-cell.on{background:#3b82f6}
.te-tbl-label{margin-top:9px;text-align:center;font-size:.78rem;font-weight:600;color:#fff}
/* Row/column/cell floating toolbar — Office/Excel ribbon look (light chrome, blue accent) */
.te-tbl-toolbar{position:absolute;display:none;align-items:center;z-index:6;background:#faf9f8;border:1px solid #d2d0ce;border-radius:6px;padding:3px;gap:1px;box-shadow:0 3px 10px rgba(0,0,0,.22)}
.te-tbl-toolbar button{width:30px;height:30px;border:1px solid transparent;border-radius:3px;background:transparent;cursor:pointer;font-size:.8rem;color:#323130;transition:background .1s,border-color .1s;display:flex;align-items:center;justify-content:center}
.te-tbl-toolbar button:hover:not(:disabled){background:#e5f1fb;border-color:#c7e0f4;color:#004578}
.te-tbl-toolbar button:active:not(:disabled){background:#cce4f7;border-color:#0078d7}
.te-tbl-toolbar button[data-act^="del"]:hover:not(:disabled){background:#fde7e9;border-color:#f1707b;color:#a4262c}
.te-tbl-toolbar button:disabled{opacity:.32;cursor:not-allowed}
.te-tbl-tbar-sep{width:1px;align-self:stretch;background:#e1dfdd;margin:3px 3px}
/* Answer image format bar */
.te-opt-img-fmt{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.65);display:none;justify-content:center;gap:2px;padding:2px 3px;border-radius:0 0 7px 7px}
.te-opt-img-wrap:hover .te-opt-img-fmt{display:flex}
.te-opt-img-fmt button{width:20px;height:20px;border:none;border-radius:3px;background:rgba(255,255,255,.15);color:rgba(255,255,255,.8);font-size:.6rem;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:background .1s}
.te-opt-img-fmt button.on{background:var(--primary,#6366f1);color:#fff}
/* Above layout for answer image */
.te-opt-img-wrap.img-above{width:100%;height:auto;border-radius:8px;overflow:visible}
.te-opt-img-wrap.img-above .te-opt-img{width:100%;height:auto;max-height:180px;object-fit:contain;border-radius:8px}
/* Answer rows (single / multiple) — slim single-line cards; the Quill toolbar is
   hidden until the row is focused, so at rest it reads as plain text like a checklist.
   align-items:flex-start (not center) — the row grows tall once the toolbar/multi-line
   text appear, and center-aligning the handle/marker/delete against a tall body was
   pulling them into the middle instead of pinning them to the first line. */
.te-ans-cards{display:flex;flex-direction:column;gap:10px}
.te-ans-card{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1.5px solid var(--border);border-radius:12px;background:var(--bg-surface);transition:border-color .15s,box-shadow .15s}
.te-ans-card:focus-within{border-color:var(--border-light)}
.te-ans-card.correct{border-color:#10b981;box-shadow:0 0 0 1px rgba(16,185,129,.25)}
.te-ans-card.drag-over{border-color:var(--primary)!important;background:rgba(99,102,241,.07)}
.te-ans-card .te-opt-handle{margin-top:6px;cursor:grab}
.te-ans-card .te-opt-handle:active{cursor:grabbing}
.te-opt-marker-btn{width:22px;height:22px;margin-top:4px;flex-shrink:0;border:none;background:none;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center}
.te-opt-marker-btn .te-opt-marker{width:20px;height:20px;border-radius:50%;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:.65rem;color:#fff;transition:all .15s}
.te-opt-marker-btn .te-opt-marker.sq{border-radius:5px}
.te-opt-marker-btn:hover .te-opt-marker{border-color:#10b981}
.te-opt-marker-btn.correct .te-opt-marker{background:#10b981;border-color:#10b981}
.te-ans-card-body{flex:1;min-width:0;overflow:hidden}
.te-ans-card-body .ql-toolbar.ql-snow{display:none;border:none;border-radius:8px;padding:6px 8px;margin-bottom:8px;background:var(--zc-head,rgba(16,185,129,.08))}
.te-ans-card:focus-within .te-ans-card-body .ql-toolbar.ql-snow{display:flex;align-items:center;flex-wrap:wrap}
.te-ans-card-body .ql-container.ql-snow{border:none;background:none}
.te-ans-card-body .ql-editor{min-height:20px;padding:0;font-size:16px;line-height:1.4;background:none}
.te-ans-card:focus-within .te-ans-card-body .ql-editor{min-height:28px}
.te-ans-card-body .ql-editor img{max-width:100%;border-radius:8px;cursor:zoom-in}
.te-ans-card-body .ql-editor.drag-active{outline:2px dashed var(--primary)!important;background:rgba(99,102,241,.04)!important}
.te-ans-card .te-opt-del{width:26px;height:26px;margin-top:2px;border-radius:7px;border:none;background:none;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0;transition:all .15s}
.te-ans-card .te-opt-del:hover{color:var(--danger);background:rgba(239,68,68,.08)}
/* Font / size picker widths */
.te-quill-wrap .ql-snow .ql-picker.ql-font{width:148px}
.te-quill-wrap .ql-snow .ql-picker.ql-size{width:80px}
.te-ans-card-body .ql-snow .ql-picker.ql-font{width:132px}
.te-ans-card-body .ql-snow .ql-picker.ql-size{width:74px}
/* Picker dropdowns — pinned to position:fixed by _ensurePickerEscapeHatch() once opened,
   so they escape the scroll/clip containers (te-left-content etc.) instead of being cut off. */
.ql-snow .ql-picker.ql-expanded{position:relative;z-index:99999!important}
.ql-snow .ql-picker.ql-expanded .ql-picker-options{z-index:99999!important;max-height:260px;overflow-y:auto}
/* Default label font — matches the admin UI (Inter), regardless of which font/size is picked */
.ql-snow .ql-picker-label{font-family:'Inter',sans-serif}
/* Font picker — show actual font name in label and dropdown items */
.ql-snow .ql-picker.ql-font .ql-picker-label[data-value]:not([data-value=""])::before,
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value]:not([data-value=""])::before{content:attr(data-value)!important}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Inter"]::before{font-family:'Inter',sans-serif}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Arial"]::before{font-family:Arial,sans-serif}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Georgia"]::before{font-family:Georgia,serif}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Courier New"]::before{font-family:'Courier New',monospace}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Tahoma"]::before{font-family:Tahoma,sans-serif}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Verdana"]::before{font-family:Verdana,sans-serif}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Times New Roman"]::before{font-family:'Times New Roman',serif}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Trebuchet MS"]::before{font-family:'Trebuchet MS',sans-serif}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Comic Sans MS"]::before{font-family:'Comic Sans MS',cursive}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Impact"]::before{font-family:Impact,sans-serif}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Segoe UI"]::before{font-family:'Segoe UI',sans-serif}
.ql-snow .ql-picker.ql-font .ql-picker-item[data-value="Calibri"]::before{font-family:Calibri,sans-serif}
/* Size picker — show px value in label and dropdown items */
.ql-snow .ql-picker.ql-size .ql-picker-label[data-value]:not([data-value=""])::before,
.ql-snow .ql-picker.ql-size .ql-picker-item[data-value]:not([data-value=""])::before{content:attr(data-value)!important}
/* Media strip — merged into the "Текст питання" zone, right under the toolbar */
.te-media-inline{margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)}
.te-media-count{display:flex;align-items:center;gap:6px;font-size:.78rem;color:var(--text-muted)}
</style>

<div class="te-wrap">
    <div class="te-topbar">
        <button class="btn-back" onclick="TestsManagerPage._checkDirty().then(()=>{TestsManagerPage._dirty=false;TestsManagerPage._renderList(TestsManagerPage._container)})"><i class="fa-solid fa-arrow-left"></i> Тести</button>
        <span class="te-test-title">${Fmt.esc(this._curTest.title)}</span>
    </div>
    <div class="te-body">
        <div class="te-left">
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
        return `
<div class="te-toolbar-top">
    <span class="te-lbl" style="margin-bottom:0">Тип питання</span>
    <button class="te-save-btn te-save-btn-ghost" onclick="TestsManagerPage.openPreview('${this._curTest.id}')"><i class="fa-solid fa-eye"></i> Перегляд</button>
    <button class="te-save-btn" onclick="TestsManagerPage.saveCurrentQuestion()"><i class="fa-solid fa-floppy-disk"></i> Зберегти питання</button>
</div>
<div class="te-type-chips">
    ${[['single','<i class="fa-regular fa-circle-dot"></i>','Один варіант'],['multiple','<i class="fa-regular fa-square-check"></i>','Множинний вибір'],['matching','<i class="fa-solid fa-diagram-project"></i>','Відповідність'],['text','<i class="fa-regular fa-message"></i>','Відкрите питання'],['ordering','<i class="fa-solid fa-list-ol"></i>','Порядок']]
        .map(([t,ic,lb]) => `<button class="te-type-chip${type===t?' active':''}" data-type="${t}" onclick="TestsManagerPage._onTypeChange('${t}')">${ic}<span>${lb}</span></button>`).join('')}
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

    async _selectQuestion(idx) {
        await this._checkDirty();
        this._dirty = false;
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

        // Update question list highlight
        document.querySelectorAll('.te-qitem').forEach((el,i) => el.classList.toggle('active', i===idx));

        // Render editor — includes the type/points/save toolbar, nested under the zone header
        this._renderQuestionEditor();
    },

    _renderQuestionEditor() {
        const q = this._questions[this._activeIdx];
        if (!q) return;
        const content = document.getElementById('te-left-content');
        if (!content) return;

        this._dirty = false;
        this._dirtyEnabled = false;
        content.innerHTML = `
<div class="te-zone te-zone-blue">
    <div class="te-zone-toolbar" id="te-toolbar">${this._toolbarHtml()}</div>
    <div class="te-zone-head">
        <div class="te-zone-icon"><i class="fa-solid fa-align-left"></i></div><span class="te-zone-title">Текст питання</span>
        <div class="te-pts-wrap">
            <span class="te-pts-lbl">Балів:</span>
            <input class="te-pts-inp" type="number" id="te-pts" min="1" max="100" value="${q.points||1}" oninput="TestsManagerPage._markDirty()">
        </div>
    </div>
    <div class="te-zone-body">
        <div class="te-quill-wrap" style="margin-bottom:0"><div id="te-quill"></div></div>
        <div class="te-media-inline">${this._renderMediaPanel()}</div>
    </div>
</div>
<div class="te-zone te-zone-green">
    <div class="te-zone-head"><div class="te-zone-icon"><i class="fa-solid fa-list-check"></i></div><span class="te-zone-title">Варіанти відповідей</span></div>
    <div class="te-zone-body" id="te-options-area">${this._optionsHtml()}</div>
</div>
<div class="te-zone te-zone-amber">
    <div class="te-zone-head"><div class="te-zone-icon"><i class="fa-solid fa-lightbulb"></i></div><span class="te-zone-title">Пояснення</span><span class="te-zone-hint">Показується після відповіді</span></div>
    <div class="te-zone-body"><textarea class="te-explanation" id="te-explanation" placeholder="Необов'язково — поясніть правильну відповідь..." oninput="TestsManagerPage._markDirty()">${Fmt.esc(q.explanation||'')}</textarea></div>
</div>
`;

        // Init Quill
        if (this._quill) { try { this._quill = null; } catch{} }
        setTimeout(() => {
            const el = document.getElementById('te-quill');
            if (!el) return;
            this._quill = new Quill('#te-quill', {
                theme: 'snow',
                modules: this._buildQuillModules()
            });
            this._wireToolbarTooltips(this._quill);
            const text = q.question_text || q.body || '';
            // Direct innerHTML preserves inline styles (width, float, margin) set by
            // the resize/alignment tools. dangerouslyPasteHTML converts through Delta
            // and strips all img style attributes.
            if (text) {
                this._quill.root.innerHTML = text;
                // Older/plain content has no explicit size span — without one the size
                // picker falls back to showing its first whitelist entry (8px) instead
                // of the real default, even though the text renders at 16px via CSS.
                // Stamp it explicitly so the picker reflects reality. Must NOT use a
                // 'silent' source here — that also suppresses the change event the
                // toolbar's picker relies on to refresh its own label. _dirtyEnabled is
                // still false at this point in the render, so _markDirty() is a no-op
                // regardless — opening the question won't falsely mark it unsaved.
                if (!/font-size/.test(text)) this._quill.formatText(0, this._quill.getLength(), 'size', '16px');
            } else {
                this._quill.format('size', '16px'); // default question text size
            }
            this._quill.on('text-change', () => { TestsManagerPage._markDirty(); });

            // Clipboard image paste → compress → upload → insert
            this._quill.root.addEventListener('paste', async e => {
                const items = Array.from(e.clipboardData?.items || []);
                const imgItem = items.find(it => it.type.startsWith('image/'));
                if (!imgItem) return;
                e.preventDefault(); e.stopPropagation();
                const file = imgItem.getAsFile();
                if (!file) return;
                await TestsManagerPage._uploadImageIntoQuill(TestsManagerPage._quill, file);
            });

            // Image resize/align/scale handles inside Quill
            if (this._questionResizeAbort) this._questionResizeAbort.abort();
            this._questionResizeAbort = this._initImageResize(this._quill);

            // Row/column/cell tools for inserted tables
            if (this._questionTableAbort) this._questionTableAbort.abort();
            this._questionTableAbort = this._initTableTools(this._quill);

            // Gallery drag-in, OS file drop, and native in-editor image reposition
            this._wireImageDropZone(this._quill);
            // Enable dirty tracking after all MutationObserver callbacks have fired
            setTimeout(() => { TestsManagerPage._dirty = false; TestsManagerPage._dirtyEnabled = true; }, 100);
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
    <input class="te-match-inp" placeholder="Ліва частина..." value="${(p.left||'').replace(/"/g,'&quot;')}" oninput="TestsManagerPage._opts[${i}].left=this.value;TestsManagerPage._markDirty()">
    <span class="te-match-arrow"><i class="fa-solid fa-arrows-left-right"></i></span>
    <input class="te-match-inp" placeholder="Права частина..." value="${(p.right||'').replace(/"/g,'&quot;')}" oninput="TestsManagerPage._opts[${i}].right=this.value;TestsManagerPage._markDirty()">
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
    <input class="te-opt-inp" placeholder="Елемент ${i+1}..." value="${(it.text||'').replace(/"/g,'&quot;')}" oninput="TestsManagerPage._opts[${i}].text=this.value;TestsManagerPage._markDirty()">
    <button class="te-opt-del" onclick="TestsManagerPage.removeOption(${i})"><i class="fa-solid fa-xmark"></i></button>
</div>`).join('')}
</div>
<button class="te-add-opt" onclick="TestsManagerPage.addOption()"><i class="fa-solid fa-plus"></i> Додати елемент</button>`;
        }
        // single / multiple — each answer is a full Quill editor, styled as a slim
        // single-line row; the toolbar only appears while that row is focused.
        const isMulti = type === 'multiple';
        if (!this._opts.length) this._opts = [{html:'',correct:false},{html:'',correct:false}];
        setTimeout(() => this._initAnswerQuills(), 0);
        return `
<div class="te-ans-cards" id="te-opts-list">
${this._opts.map((o,i) => `
<div class="te-ans-card${o.correct?' correct':''}" id="te-ans-card-${i}"
    ondragover="TestsManagerPage._handleAnsDragOver(event,${i})"
    ondragleave="TestsManagerPage._handleAnsDragLeave(event)"
    ondrop="TestsManagerPage._handleAnsDrop(event,${i})">
    <span class="te-opt-handle" draggable="true" ondragstart="TestsManagerPage._handleAnsDragStart(event,${i})"><i class="fa-solid fa-grip-vertical"></i></span>
    <button type="button" class="te-opt-marker-btn${o.correct?' correct':''}" onclick="TestsManagerPage.toggleCorrect(${i})" title="${o.correct?'Правильна відповідь':'Позначити правильною'}">
        <span class="te-opt-marker${isMulti?' sq':''}">${o.correct?'<i class="fa-solid fa-check"></i>':''}</span>
    </button>
    <div class="te-ans-card-body">
        <div id="te-ans-quill-${i}"></div>
    </div>
    <button class="te-opt-del" onclick="TestsManagerPage.removeOption(${i})" title="Видалити варіант"><i class="fa-solid fa-xmark"></i></button>
</div>`).join('')}
</div>
<button class="te-add-opt" onclick="TestsManagerPage.addOption()"><i class="fa-solid fa-plus"></i> Додати варіант відповіді</button>`;
    },

    _onTypeChange(val) {
        this._cleanupAnswerQuills();
        this._qType = val;
        this._opts  = [];
        this._markDirty();
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
            this._dirty = false;
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

        this._importProgressOpen(parsed.length);
        let done = 0, failed = 0;
        for (const item of parsed) {
            this._importProgressUpdate(done, parsed.length, item.question_text);
            try {
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
                done++;
            } catch(e) {
                failed++;
                console.warn('Import question failed:', e.message);
            }
            this._importProgressUpdate(done + failed, parsed.length, null);
        }
        Modal.close();

        document.getElementById('te-qlist').innerHTML    = this._renderQList();
        document.getElementById('te-qcount').textContent = this._questions.length;
        if (this._questions.length) this._selectQuestion(this._questions.length - 1);

        if (done)   Toast.success('Імпорт', `Додано ${done} питань`);
        if (failed) Toast.error('Імпорт', `Не вдалося додати ${failed} питань`);
    },

    _importProgressOpen(total) {
        Modal.open({
            title: '<i class="fa-solid fa-file-import"></i> Імпорт питань',
            size: 'sm',
            body: `
                <style>
                    .te-imp-wrap { height: 100%; display: flex; flex-direction: column; justify-content: center; }
                    .te-imp-track { height: 10px; border-radius: 999px; background: var(--bg-hover); overflow: hidden; }
                    .te-imp-fill { height: 100%; width: 0%; background: var(--primary); border-radius: 999px; transition: width .25s ease; }
                    .te-imp-status { margin-top: .7rem; font-size: .85rem; color: var(--text-secondary); text-align: center; }
                    .te-imp-count { font-weight: 700; color: var(--text-primary); }
                </style>
                <div class="te-imp-wrap">
                    <div class="te-imp-track"><div id="te-imp-bar" class="te-imp-fill"></div></div>
                    <div id="te-imp-status" class="te-imp-status">Підготовка…</div>
                </div>`,
            footer: ''
        });
        const backdrop = document.getElementById('modal-backdrop');
        if (backdrop) backdrop.onclick = null;
        document.removeEventListener('keydown', Modal._escHandler);
    },

    _importProgressUpdate(done, total, currentText) {
        const bar    = document.getElementById('te-imp-bar');
        const status = document.getElementById('te-imp-status');
        const pct = total ? Math.round((done / total) * 100) : 100;
        if (bar) bar.style.width = pct + '%';
        if (status) {
            status.innerHTML = '';
            const countEl = document.createElement('span');
            countEl.className = 'te-imp-count';
            countEl.textContent = `${done} з ${total}`;
            status.appendChild(countEl);
            if (done < total && currentText) {
                const plain = currentText.replace(/<[^>]*>/g, '').trim().slice(0, 40);
                status.appendChild(document.createTextNode(' — ' + plain + (plain.length >= 40 ? '…' : '')));
            }
        }
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
        <span style="font-size:.78rem;color:var(--text-muted)">${images.length ? `${images.length} зображень` : 'Немає зображень'}</span>
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
                <button class="te-media-thumb-act-insert" title="Вставити в текст" onclick="event.stopPropagation();TestsManagerPage._insertImageToQuill('${url}')"><i class="fa-solid fa-file-import"></i></button>
                <button class="te-media-thumb-act-del" title="Видалити зображення" onclick="event.stopPropagation();TestsManagerPage._deleteImage('${url}')"><i class="fa-solid fa-trash-can"></i></button>
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
        (this._answerTableAborts  || []).forEach(ac => ac?.abort());
        this._answerResizeAborts = [];
        this._answerTableAborts  = [];
        this._answerQuills = [];
    },

    _QUILL_FONTS: ['Inter', 'Arial', 'Times New Roman', 'Georgia', 'Courier New', 'Tahoma', 'Verdana', 'Trebuchet MS', 'Comic Sans MS', 'Impact', 'Segoe UI', 'Calibri'],
    _QUILL_SIZES: ['8px', '10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'],
    _QUILL_COLORS: [
        '#000000', '#1e293b', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#f3f4f6', '#ffffff',
        '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
        '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#C9A227'
    ],

    _quillSetup() {
        if (this._quillSetupDone) return;
        this._quillSetupDone = true;

        const FontStyle = Quill.import('attributors/style/font');
        FontStyle.whitelist = this._QUILL_FONTS;
        Quill.register(FontStyle, true);

        const SizeStyle = Quill.import('attributors/style/size');
        SizeStyle.whitelist = this._QUILL_SIZES;
        Quill.register(SizeStyle, true);

        this._ensurePickerEscapeHatch();
        this._registerTableBlot();

        const icons = Quill.import('ui/icons');
        icons.table  = '<i class="fa-solid fa-table-cells-large"></i>';
        icons.source = '<i class="fa-solid fa-code"></i>';
    },

    // Registers <table> as a Block Embed blot so Quill's Parchment layer recognises
    // it (instead of stripping/mangling it during its DOM↔Delta reconciliation) and
    // treats it as one atomic, opaque unit. Cells stay natively editable because we
    // re-enable contenteditable on the table node itself (Quill embeds default to
    // contenteditable="false") — a "contenteditable island" inside the editor.
    // This project reads/writes question_text via quill.root.innerHTML directly
    // (not Delta JSON), so the table's internal markup round-trips as-is.
    _registerTableBlot() {
        if (this._tableBlotRegistered) return;
        this._tableBlotRegistered = true;
        const BlockEmbed = Quill.import('blots/block/embed');

        class TableBlot extends BlockEmbed {
            constructor(domNode) {
                super(domNode);
                // Base Embed constructor forces contenteditable="false"; put it back so
                // cells stay natively editable (a "contenteditable island").
                domNode.setAttribute('contenteditable', 'true');
            }
            static create(value) {
                const node = super.create();
                node.setAttribute('contenteditable', 'true');
                if (typeof value === 'string') {
                    node.innerHTML = value;
                } else {
                    const rows = (value && value.rows) || 3;
                    const cols = (value && value.cols) || 3;
                    const tbody = document.createElement('tbody');
                    for (let r = 0; r < rows; r++) {
                        const tr = document.createElement('tr');
                        for (let c = 0; c < cols; c++) {
                            const td = document.createElement('td');
                            td.innerHTML = '<br>';
                            tr.appendChild(td);
                        }
                        tbody.appendChild(tr);
                    }
                    node.appendChild(tbody);
                }
                return node;
            }
            static value(node) { return node.innerHTML; }
        }
        TableBlot.blotName = 'table';
        TableBlot.tagName  = 'TABLE';
        Quill.register(TableBlot, true);
    },

    // Quill's picker dropdowns are `position:absolute` inside scroll/clip containers
    // (te-left-content, answer cards, etc.) and get cut off. Once opened, pin them to
    // `position:fixed` at their real on-screen spot so they escape any ancestor's
    // overflow/z-index and always render on top. One delegated listener for the
    // whole page — works for every current and future Quill toolbar, no per-instance wiring.
    _ensurePickerEscapeHatch() {
        if (this._pickerEscapeBound) return;
        this._pickerEscapeBound = true;
        const pin = () => {
            document.querySelectorAll('.ql-picker.ql-expanded').forEach(picker => {
                const opts = picker.querySelector('.ql-picker-options');
                if (!opts || opts.dataset.tmFixed === '1') return;
                const r = picker.getBoundingClientRect();
                opts.dataset.tmFixed = '1';
                opts.style.position = 'fixed';
                opts.style.top      = Math.round(r.bottom + 4) + 'px';
                opts.style.left     = Math.round(r.left) + 'px';
                opts.style.minWidth = Math.round(r.width) + 'px';
            });
        };
        document.addEventListener('mousedown', e => {
            if (e.target.closest('.ql-picker-label')) setTimeout(pin, 0);
        });
        document.addEventListener('click', () => {
            document.querySelectorAll('.ql-picker-options[data-tm-fixed]').forEach(opts => {
                if (!opts.closest('.ql-picker.ql-expanded')) {
                    opts.style.position = opts.style.top = opts.style.left = opts.style.minWidth = '';
                    delete opts.dataset.tmFixed;
                }
            });
        }, true);
    },

    _buildQuillModules() {
        this._quillSetup();

        const toolbarContainer = [
            [{ font: this._QUILL_FONTS }],
            [{ size: this._QUILL_SIZES }],
            ['bold', 'italic', 'underline'],
            [{ color: this._QUILL_COLORS }, { background: this._QUILL_COLORS }],
            [{ align: '' }, { align: 'center' }, { align: 'right' }, { align: 'justify' }],
            ['link', 'image', 'table'],
            ['clean', 'source'],
        ];

        return {
            toolbar: {
                container: toolbarContainer,
                handlers: {
                    image:  TestsManagerPage._quillImageHandler,
                    font:   TestsManagerPage._quillFontHandler,
                    table:  TestsManagerPage._quillTableHandler,
                    source: TestsManagerPage._quillSourceHandler
                }
            }
        };
    },

    // Toolbar "view source" button — opens the raw HTML (incl. inline style="")
    // behind the current field in an editable textarea. `this` = Toolbar module.
    _quillSourceHandler() {
        TestsManagerPage._openSourceEditor(this.quill);
    },

    _openSourceEditor(quill) {
        TestsManagerPage._sourceEditQuill = quill;
        Modal.open({
            title: '<i class="fa-solid fa-code"></i> HTML-код поля',
            size: 'lg',
            body: `
<style>
.tm-src-hint{font-size:.78rem;color:var(--text-muted);margin-bottom:10px;line-height:1.5}
.tm-src-hint code{background:var(--bg-hover);padding:1px 5px;border-radius:4px;font-size:.85em}
.tm-src-ta{width:100%;box-sizing:border-box;min-height:380px;padding:12px;border-radius:10px;
    border:1.5px solid var(--border);font-family:'Courier New',monospace;font-size:.8rem;line-height:1.6;
    white-space:pre-wrap;word-break:break-word;resize:vertical;outline:none;transition:border-color .15s;
    background:#0f172a;color:#e2e8f0}
.tm-src-ta:focus{border-color:var(--primary)}
body.light-theme .tm-src-ta{background:#f6f8fa;color:#24292f;border-color:#d0d7de}
</style>
<div class="tm-src-hint">
    Редагування "сирого" HTML. Шрифт, колір, розмір, обтікання картинок тощо зберігаються
    прямо тут — через атрибут <code>style</code> на відповідному тегу.
    Некоректний HTML може зламати відображення поля.
</div>
<textarea id="tm-src-html" class="tm-src-ta" spellcheck="false">${Fmt.esc(quill.root.innerHTML)}</textarea>`,
            footer: `
<button class="btn-primary-modern" onclick="TestsManagerPage._applySourceEditor()"><i class="fa-solid fa-check"></i> Застосувати</button>
<button class="btn-secondary-modern" onclick="Modal.close()">Скасувати</button>`
        });
    },

    _applySourceEditor() {
        const ta = document.getElementById('tm-src-html');
        const quill = TestsManagerPage._sourceEditQuill;
        if (!ta || !quill) return;
        quill.root.innerHTML = ta.value;
        TestsManagerPage._markDirty();
        Modal.close();
    },

    // Toolbar table button — opens a grid picker (like Word/Google Docs) to choose
    // rows×cols, then inserts an empty table at the caret. `this` = Toolbar module.
    _quillTableHandler() {
        TestsManagerPage._openTableGridPicker(this.quill, this.container.querySelector('.ql-table'));
    },

    _openTableGridPicker(quill, anchorBtn) {
        document.querySelectorAll('.te-tbl-picker').forEach(el => el.remove());
        if (!anchorBtn) return;
        const MAX = 10;
        const pop = document.createElement('div');
        pop.className = 'te-tbl-picker';
        pop.innerHTML = `
            <div class="te-tbl-grid">${Array.from({ length: MAX * MAX }).map((_, i) =>
                `<div class="te-tbl-cell" data-r="${Math.floor(i / MAX) + 1}" data-c="${i % MAX + 1}"></div>`).join('')}</div>
            <div class="te-tbl-label">Виберіть розмір таблиці</div>`;
        document.body.appendChild(pop);
        const r = anchorBtn.getBoundingClientRect();
        pop.style.top  = Math.round(r.bottom + 6) + 'px';
        pop.style.left = Math.round(r.left) + 'px';

        const cells = pop.querySelectorAll('.te-tbl-cell');
        const label = pop.querySelector('.te-tbl-label');
        cells.forEach(cell => {
            const rr = +cell.dataset.r, cc = +cell.dataset.c;
            cell.addEventListener('mouseenter', () => {
                cells.forEach(c2 => c2.classList.toggle('on', +c2.dataset.r <= rr && +c2.dataset.c <= cc));
                label.textContent = `${rr} × ${cc}`;
            });
            cell.addEventListener('click', e => {
                e.stopPropagation();
                const range = quill.getSelection(true) || { index: quill.getLength() };
                quill.insertEmbed(range.index, 'table', { rows: rr, cols: cc }, 'user');
                quill.insertText(range.index + 1, '\n', 'user');
                quill.setSelection(range.index + 2, 0, 'user');
                TestsManagerPage._markDirty();
                pop.remove();
            });
        });
        setTimeout(() => {
            document.addEventListener('click', function close(e) {
                if (pop.contains(e.target) || e.target === anchorBtn || anchorBtn.contains(e.target)) return;
                pop.remove();
                document.removeEventListener('click', close);
            });
        }, 0);
    },

    // Toolbar image button — uploads straight into the question's media pool
    // and inserts at the caret. `this` here is the Quill Toolbar module instance.
    _quillImageHandler() {
        const quill = this.quill;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;
            await TestsManagerPage._uploadImageIntoQuill(quill, file);
        };
        input.click();
    },

    // Picking a font applies it to the whole editor, not just the current
    // selection — no need to select text first to change the font.
    _quillFontHandler(value) {
        const quill = this.quill;
        const len = quill.getLength();
        if (len > 1) quill.formatText(0, len, 'font', value || false, 'user');
        quill.format('font', value || false);
    },

    _TOOLBAR_TIPS: {
        '.ql-bold':                    'Жирний',
        '.ql-italic':                  'Курсив',
        '.ql-underline':               'Підкреслений',
        '.ql-link':                    'Вставити посилання',
        '.ql-image':                   'Завантажити зображення в текст',
        '.ql-table':                   'Вставити таблицю',
        '.ql-source':                  'Переглянути / редагувати HTML-код',
        '.ql-clean':                   'Очистити форматування',
        '.ql-align:not([value])':      'Вирівняти ліворуч',
        '.ql-align[value="center"]':   'Вирівняти по центру',
        '.ql-align[value="right"]':    'Вирівняти праворуч',
        '.ql-align[value="justify"]':  'Розтягнути по ширині'
    },

    // Quill's built-in toolbar buttons ship with no title/tooltip at all.
    // Adds one hover hint per control, once per toolbar instance.
    _wireToolbarTooltips(quill) {
        const toolbarEl = quill.getModule('toolbar')?.container;
        if (!toolbarEl || toolbarEl.dataset.tmTipsWired) return;
        toolbarEl.dataset.tmTipsWired = '1';
        Object.entries(this._TOOLBAR_TIPS).forEach(([sel, tip]) => {
            toolbarEl.querySelectorAll(sel).forEach(el => { if (!el.title) el.title = tip; });
        });
        const labelTip = (fmt, tip) => {
            const label = toolbarEl.querySelector(`.ql-${fmt} .ql-picker-label`);
            if (label) label.title = tip;
        };
        labelTip('font',       'Шрифт');
        labelTip('size',       'Розмір шрифту, px');
        labelTip('color',      'Колір тексту');
        labelTip('background', 'Колір виділення тексту');
        toolbarEl.querySelectorAll('.ql-color .ql-picker-item, .ql-background .ql-picker-item').forEach(item => {
            if (item.dataset.value && !item.title) item.title = item.dataset.value;
        });
        this._syncSizePickerDefault(toolbarEl);
    },

    // Native <select> semantics: with no option marked selected, the browser (and Quill's
    // picker, which mirrors it) defaults to the FIRST <option> — 8px, since _QUILL_SIZES
    // stays in natural ascending order for the dropdown. This overrides just the initial
    // selected/displayed state to 16px without touching that order, by marking the 16px
    // <option> as the real default and syncing the picker's label/highlight to match.
    _syncSizePickerDefault(toolbarEl, size = '16px') {
        const picker = toolbarEl.querySelector('.ql-size');
        if (!picker) return;
        const item  = picker.querySelector(`.ql-picker-item[data-value="${size}"]`);
        const label = picker.querySelector('.ql-picker-label');
        if (!item || !label) return;
        label.setAttribute('data-value', size);
        picker.querySelectorAll('.ql-picker-item').forEach(it => it.classList.toggle('ql-selected', it === item));
        const select = picker.querySelector('select');
        if (select) {
            [...select.options].forEach(o => o.removeAttribute('selected'));
            select.querySelector(`option[value="${size}"]`)?.setAttribute('selected', '');
            select.value = size;
        }
    },

    async _uploadImageIntoQuill(quill, file) {
        const qNow = TestsManagerPage._questions[TestsManagerPage._activeIdx];
        if (!qNow) return;
        Loader.show();
        try {
            const comp = await TestsManagerPage._compressImage(file);
            const { url } = await API.testImages.upload(comp, TestsManagerPage._curTest.id, qNow.id);
            if (!qNow.images) qNow.images = [];
            qNow.images.push(url);
            await API.questions.update(qNow.id, { images: qNow.images });
            const panel = document.getElementById('te-media-panel');
            if (panel) panel.outerHTML = TestsManagerPage._renderMediaPanel();
            const range = quill.getSelection(true) || { index: quill.getLength() };
            quill.insertEmbed(range.index, 'image', url);
            quill.setSelection(range.index + 1);
        } catch(ex) { Toast.error('Помилка завантаження', ex.message); }
        finally { Loader.hide(); }
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
            this._wireToolbarTooltips(q);
            if (opt.html) {
                q.root.innerHTML = opt.html;
                // See _renderQuestionEditor() — stamp a default size on legacy content
                // so the picker doesn't fall back to showing its first entry (8px).
                if (!/font-size/.test(opt.html)) q.formatText(0, q.getLength(), 'size', '16px');
            } else {
                q.format('size', '16px'); // default answer text size
            }
            q.on('text-change', () => { TestsManagerPage._markDirty(); });

            // Paste image → upload → insert
            q.root.addEventListener('paste', async e => {
                const items = Array.from(e.clipboardData?.items || []);
                const imgItem = items.find(it => it.type.startsWith('image/'));
                if (!imgItem) return;
                e.preventDefault(); e.stopPropagation();
                const file = imgItem.getAsFile();
                if (!file || !qData) return;
                await TestsManagerPage._uploadImageIntoQuill(q, file);
            });

            // Gallery drag-in, OS file drop, and native in-editor image reposition
            this._wireImageDropZone(q);

            this._answerResizeAborts.push(this._initImageResize(q));
            this._answerTableAborts.push(this._initTableTools(q));
            this._answerQuills.push(q);
        });
    },

    // Handles three drop cases on a Quill editor root:
    //  1. a thumbnail dragged from the media gallery (_draggedImageUrl)     → insert new embed
    //  2. an image file dragged in from outside the browser (OS/Explorer)  → upload → insert new embed
    //  3. an image already embedded in this editor, dragged to reposition → default browser behaviour (not intercepted)
    _wireImageDropZone(quill) {
        quill.root.addEventListener('dragover', e => {
            e.preventDefault(); // required for 'drop' to fire at all, incl. case 3 (native reposition)
            quill.root.classList.add('drag-active');
            e.dataTransfer.dropEffect = (TestsManagerPage._draggedImageUrl || e.dataTransfer.types.includes('Files')) ? 'copy' : 'move';
        });
        quill.root.addEventListener('dragleave', () => quill.root.classList.remove('drag-active'));
        quill.root.addEventListener('drop', e => {
            quill.root.classList.remove('drag-active');
            const url = TestsManagerPage._draggedImageUrl;
            if (url) {
                e.preventDefault(); e.stopPropagation();
                const sel = quill.getSelection() || { index: Math.max(0, quill.getLength() - 1) };
                quill.insertEmbed(sel.index, 'image', url);
                quill.setSelection(sel.index + 1);
                TestsManagerPage._draggedImageUrl = null;
                return;
            }
            const file = e.dataTransfer?.files?.[0];
            if (file && file.type.startsWith('image/')) {
                e.preventDefault(); e.stopPropagation();
                TestsManagerPage._uploadImageIntoQuill(quill, file);
                return;
            }
            // otherwise: let the browser move the dragged node itself (in-editor reposition)
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

        // Alignment / scale toolbar
        const tbar = document.createElement('div');
        tbar.className = 'ql-img-toolbar';
        tbar.innerHTML = [
            ['block',  '<i class="fa-solid fa-expand"></i>', 'Блок'],
            ['center', '<i class="fa-solid fa-align-center"></i>',  'По центру'],
            ['left',   '<i class="fa-solid fa-align-left"></i>',  'Обтекання ліворуч'],
            ['right',  '<i class="fa-solid fa-align-right"></i>',  'Обтекання праворуч'],
        ].map(([a, ic, t]) => `<button data-align="${a}" title="${t}">${ic}</button>`).join('')
        + `<span class="ql-img-tbar-sep"></span>
           <div class="ql-img-tbar-wgrp" title="Ширина зображення">
               <span class="ql-img-tbar-wlbl">Ширина</span>
               <span class="ql-img-tbar-winput">
                   <input type="number" class="ql-img-tbar-w" min="20" max="2000" step="1">
                   <span class="ql-img-tbar-wpx">px</span>
               </span>
           </div>
           <button data-reset="1" title="Початковий розмір"><i class="fa-solid fa-rotate-left"></i></button>`;
        wrap.appendChild(tbar);
        const wInput = tbar.querySelector('.ql-img-tbar-w');

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
            const tbW = tbar.offsetWidth  || 226;
            const tbH = tbar.offsetHeight || 46;
            tbar.style.top  = (top  + ir.height / 2 - tbH / 2) + 'px';
            tbar.style.left = Math.max(0, Math.min(left + ir.width / 2 - tbW / 2, wr.width - tbW - 4)) + 'px';
            tbar.style.display = 'flex';
            if (document.activeElement !== wInput) wInput.value = Math.round(ir.width);
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
            const resetBtn = e.target.closest('button[data-reset]');
            if (resetBtn && activeImg) {
                e.stopPropagation();
                activeImg.style.width = activeImg.style.height = '';
                TestsManagerPage._markDirty();
                syncOv();
                return;
            }
            const btn = e.target.closest('button[data-align]');
            if (!btn || !activeImg) return;
            e.stopPropagation();
            activeImg.style.float = activeImg.style.display = activeImg.style.margin = '';
            const a = btn.dataset.align;
            if (a === 'block')  { activeImg.style.display = 'block'; activeImg.style.margin = '8px 0'; }
            if (a === 'center') { activeImg.style.display = 'block'; activeImg.style.margin = '8px auto'; }
            if (a === 'left')   { activeImg.style.float = 'left';  activeImg.style.margin = '0 12px 8px 0'; }
            if (a === 'right')  { activeImg.style.float = 'right'; activeImg.style.margin = '0 0 8px 12px'; }
            TestsManagerPage._markDirty();
            syncOv();
        }, { signal: sig });

        wInput.addEventListener('click', e => e.stopPropagation());
        wInput.addEventListener('input', () => {
            if (!activeImg) return;
            const w = parseInt(wInput.value, 10);
            if (!w || w < 20) return;
            activeImg.style.width  = w + 'px';
            activeImg.style.height = 'auto';
            TestsManagerPage._markDirty();
            const ir = activeImg.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
            ov.style.cssText += `;top:${ir.top-wr.top}px;left:${ir.left-wr.left}px;width:${ir.width}px;height:${ir.height}px;display:block`;
        }, { signal: sig });

        handle.addEventListener('mousedown', e => {
            if (!activeImg) return;
            e.preventDefault();
            const startX = e.clientX;
            const startW = activeImg.getBoundingClientRect().width;
            const onMove = ev => {
                activeImg.style.width  = Math.max(40, startW + ev.clientX - startX) + 'px';
                activeImg.style.height = 'auto';
                TestsManagerPage._markDirty();
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

    // Floating row/column/cell toolbar for tables — appears above the table when
    // the caret is inside a cell. Pure DOM table manipulation (insertRow/insertCell
    // etc.); the table is an opaque embed to Quill so this never touches Delta.
    _initTableTools(quill) {
        const ac  = new AbortController();
        const sig = ac.signal;
        let activeCell    = null;
        let selectedCells = [];
        let dragStart     = null;
        let dragging      = false;

        const wrap = quill.root.parentElement;
        wrap.style.position = wrap.style.position || 'relative';

        const bar = document.createElement('div');
        bar.className = 'te-tbl-toolbar';
        bar.innerHTML = [
            ['row-above', 'fa-solid fa-arrow-up-long',    'Вставити рядок вище'],
            ['row-below', 'fa-solid fa-arrow-down-long',  'Вставити рядок нижче'],
            ['col-left',  'fa-solid fa-arrow-left-long',  'Вставити стовпець ліворуч'],
            ['col-right', 'fa-solid fa-arrow-right-long', 'Вставити стовпець праворуч'],
            ['sep'],
            ['merge',     'fa-solid fa-compress',         "Об'єднати виділені комірки"],
            ['split',     'fa-solid fa-table-cells',      'Розділити комірку'],
            ['sep'],
            ['del-row',   'fa-solid fa-grip-lines',          'Видалити рядок'],
            ['del-col',   'fa-solid fa-grip-lines-vertical', 'Видалити стовпець'],
            ['del-table', 'fa-solid fa-trash',            'Видалити таблицю'],
        ].map(e => e[0] === 'sep'
            ? '<span class="te-tbl-tbar-sep"></span>'
            : `<button data-act="${e[0]}" title="${e[2]}"><i class="${e[1]}"></i></button>`
        ).join('');
        wrap.appendChild(bar);

        const clearSelection = () => {
            selectedCells.forEach(td => td.classList.remove('te-tbl-cell-sel'));
            selectedCells = [];
        };

        const currentTable = () =>
            (activeCell && quill.root.contains(activeCell) && activeCell.closest('table')) ||
            (selectedCells[0] && quill.root.contains(selectedCells[0]) && selectedCells[0].closest('table')) ||
            null;

        const hide = () => { bar.style.display = 'none'; activeCell = null; clearSelection(); };

        const sync = () => {
            const table = currentTable();
            if (!table) { bar.style.display = 'none'; return; }
            const r  = table.getBoundingClientRect();
            const wr = wrap.getBoundingClientRect();
            bar.style.display = 'flex';
            const barH = bar.offsetHeight || 34;
            bar.style.top  = Math.max(0, r.top - wr.top - barH - 6) + 'px';
            bar.style.left = Math.max(0, r.left - wr.left) + 'px';

            const single = !!activeCell && selectedCells.length <= 1;
            const multi  = selectedCells.length > 1;
            const canSplit = single && (((activeCell.rowSpan || 1) > 1) || ((activeCell.colSpan || 1) > 1));
            bar.querySelectorAll('button[data-act]').forEach(btn => {
                const act = btn.dataset.act;
                if (act === 'merge') btn.disabled = !multi;
                else if (act === 'split') btn.disabled = !canSplit;
                else if (act === 'del-table') btn.disabled = false;
                else btn.disabled = !single;
            });
        };

        // Click = place cursor in a cell. Click-and-drag across cells = range-select for merge.
        quill.root.addEventListener('mousedown', e => {
            const td = e.target.closest('td,th');
            if (!td || !quill.root.contains(td)) { dragStart = null; hide(); return; }
            dragStart = td;
            dragging  = false;
        }, { signal: sig });

        quill.root.addEventListener('mousemove', e => {
            if (!dragStart || !(e.buttons & 1)) return;
            const td = e.target.closest('td,th');
            if (!td || td.closest('table') !== dragStart.closest('table')) return;
            if (td !== dragStart) dragging = true;
            if (!dragging) return;
            clearSelection();
            selectedCells = TestsManagerPage._cellRange(dragStart.closest('table'), dragStart, td);
            selectedCells.forEach(c => c.classList.add('te-tbl-cell-sel'));
        }, { signal: sig });

        document.addEventListener('mouseup', () => {
            if (!dragStart) return;
            if (dragging && selectedCells.length > 1) {
                activeCell = null;
            } else {
                clearSelection();
                activeCell = dragStart;
            }
            dragStart = null;
            dragging  = false;
            sync();
        }, { signal: sig });

        quill.root.addEventListener('scroll', sync, { signal: sig });

        bar.addEventListener('click', e => {
            const btn = e.target.closest('button[data-act]');
            if (!btn || btn.disabled) return;
            e.stopPropagation();
            const table = currentTable();
            if (!table) return;
            const act = btn.dataset.act;

            if (act === 'merge') {
                TestsManagerPage._mergeCells(table, selectedCells);
                activeCell = selectedCells[0] || null;
                clearSelection();
            } else if (act === 'split') {
                TestsManagerPage._splitCell(table, activeCell);
            } else if (activeCell) {
                const tr      = activeCell.closest('tr');
                const cellIdx = Array.from(tr.children).indexOf(activeCell);
                if (act === 'row-above' || act === 'row-below') {
                    const newRow = document.createElement('tr');
                    Array.from(tr.children).forEach(() => {
                        const td = document.createElement('td');
                        td.innerHTML = '<br>';
                        newRow.appendChild(td);
                    });
                    tr.parentNode.insertBefore(newRow, act === 'row-above' ? tr : tr.nextSibling);
                } else if (act === 'col-left' || act === 'col-right') {
                    table.querySelectorAll('tr').forEach(row => {
                        const cell = row.children[cellIdx];
                        if (!cell) return;
                        const td = document.createElement('td');
                        td.innerHTML = '<br>';
                        row.insertBefore(td, act === 'col-left' ? cell : cell.nextSibling);
                    });
                } else if (act === 'del-row') {
                    if (table.querySelectorAll('tr').length <= 1) { TestsManagerPage._deleteTable(table); hide(); return; }
                    tr.remove();
                } else if (act === 'del-col') {
                    if (tr.children.length <= 1) { TestsManagerPage._deleteTable(table); hide(); return; }
                    table.querySelectorAll('tr').forEach(row => row.children[cellIdx]?.remove());
                } else if (act === 'del-table') {
                    TestsManagerPage._deleteTable(table);
                    hide();
                    return;
                }
            }
            TestsManagerPage._markDirty();
            sync();
        }, { signal: sig });

        document.addEventListener('click', e => {
            if (!wrap.contains(e.target)) hide();
        }, { signal: sig });

        return ac;
    },

    _deleteTable(table) {
        table.remove();
        TestsManagerPage._markDirty();
    },

    // Maps every <td> in a table to its logical {r, c, rowSpan, colSpan} grid position,
    // accounting for existing colspan/rowspan (the DOM only has the top-left cell of a
    // merged block, so column index can't be read off children.length alone).
    _buildTableGrid(table) {
        const rows = Array.from(table.querySelectorAll('tr'));
        const grid = [];
        const cellPos = new Map();
        rows.forEach((tr, r) => {
            grid[r] = grid[r] || [];
            let c = 0;
            Array.from(tr.children).forEach(td => {
                while (grid[r][c]) c++;
                const rowSpan = td.rowSpan || 1;
                const colSpan = td.colSpan || 1;
                for (let rr = r; rr < r + rowSpan; rr++) {
                    grid[rr] = grid[rr] || [];
                    for (let cc = c; cc < c + colSpan; cc++) grid[rr][cc] = td;
                }
                cellPos.set(td, { r, c, rowSpan, colSpan });
                c += colSpan;
            });
        });
        return { grid, rows, cellPos };
    },

    // Rectangular selection between two cells (Excel-style: a merged cell straddling
    // the edge of the rectangle pulls the whole selection out to cover it).
    _cellRange(table, cellA, cellB) {
        const { grid, cellPos } = this._buildTableGrid(table);
        const a = cellPos.get(cellA), b = cellPos.get(cellB);
        if (!a || !b) return [cellA];
        const r0 = Math.min(a.r, b.r), r1 = Math.max(a.r + a.rowSpan - 1, b.r + b.rowSpan - 1);
        const c0 = Math.min(a.c, b.c), c1 = Math.max(a.c + a.colSpan - 1, b.c + b.colSpan - 1);
        const set = new Set();
        for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
            const td = grid[r] && grid[r][c];
            if (td) set.add(td);
        }
        return [...set];
    },

    _mergeCells(table, cells) {
        if (!cells || cells.length < 2) return;
        const { grid, cellPos } = this._buildTableGrid(table);
        let r0 = Infinity, c0 = Infinity, r1 = -1, c1 = -1;
        cells.forEach(td => {
            const p = cellPos.get(td);
            if (!p) return;
            r0 = Math.min(r0, p.r); c0 = Math.min(c0, p.c);
            r1 = Math.max(r1, p.r + p.rowSpan - 1); c1 = Math.max(c1, p.c + p.colSpan - 1);
        });
        const covered = new Set();
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                const td = grid[r] && grid[r][c];
                if (!td) { Toast.error('Помилка', 'Виділення має бути прямокутним'); return; }
                covered.add(td);
            }
        }
        if (covered.size !== cells.length) {
            Toast.error('Помилка', "Не можна об'єднати комірки з частковим накладанням");
            return;
        }
        const target = grid[r0][c0];
        const parts = [...covered]
            .filter(td => td !== target)
            .map(td => td.innerHTML)
            .filter(h => h && h !== '<br>');
        const html = target.innerHTML && target.innerHTML !== '<br>' ? [target.innerHTML, ...parts] : parts;
        target.innerHTML = html.length ? html.join('<br>') : '<br>';
        if (r1 > r0) target.setAttribute('rowspan', r1 - r0 + 1); else target.removeAttribute('rowspan');
        if (c1 > c0) target.setAttribute('colspan', c1 - c0 + 1); else target.removeAttribute('colspan');
        covered.forEach(td => { if (td !== target) td.remove(); });
        table.querySelectorAll('tr').forEach(tr => { if (!tr.children.length) tr.remove(); });
    },

    _splitCell(table, cell) {
        if (!cell) return;
        const rowSpan = cell.rowSpan || 1, colSpan = cell.colSpan || 1;
        if (rowSpan === 1 && colSpan === 1) return;
        const { rows, cellPos } = this._buildTableGrid(table);
        const p = cellPos.get(cell);
        if (!p) return;
        // Snapshot each row's *original* cells with their start columns before any mutation —
        // new cells are inserted relative to these fixed anchors, in ascending column order.
        const rowInfo = rows.map(tr => Array.from(tr.children).map(td => ({ td, col: cellPos.get(td)?.c ?? 0 })));

        cell.removeAttribute('rowspan');
        cell.removeAttribute('colspan');

        for (let r = p.r; r < p.r + rowSpan; r++) {
            const tr = rows[r];
            if (!tr) continue;
            const info = rowInfo[r];
            for (let c = p.c; c < p.c + colSpan; c++) {
                if (r === p.r && c === p.c) continue;
                const anchor = info.find(x => x.col > c)?.td || null;
                const td = document.createElement('td');
                td.innerHTML = '<br>';
                if (anchor) tr.insertBefore(td, anchor); else tr.appendChild(td);
            }
        }
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

    // ── Answer options reordering (drag тільки за te-opt-handle, щоб не
    // конфліктувати з Quill-редактором тексту відповіді в тій самій картці) ──
    _handleAnsDragStart(e, idx) {
        this._ansDragSrcIdx = idx;
        e.dataTransfer.effectAllowed = 'move';
    },

    _handleAnsDragOver(e, idx) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        document.querySelectorAll('.te-ans-card').forEach((el, i) =>
            el.classList.toggle('drag-over', i === idx && i !== this._ansDragSrcIdx));
    },

    _handleAnsDragLeave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    },

    _handleAnsDrop(e, toIdx) {
        e.preventDefault();
        document.querySelectorAll('.te-ans-card').forEach(el => el.classList.remove('drag-over'));
        const fromIdx = this._ansDragSrcIdx;
        this._ansDragSrcIdx = null;
        if (fromIdx == null || fromIdx === toIdx) return;

        // Live-вміст Quill-редакторів у _opts синхронізується лише при збереженні —
        // перед перестановкою масиву треба зафіксувати те, що користувач вже набрав
        this._syncAnswerQuillsToOpts();

        const moved = this._opts.splice(fromIdx, 1)[0];
        this._opts.splice(toIdx, 0, moved);
        this._markDirty();

        document.getElementById('te-options-area').innerHTML = this._optionsHtml();
    },

    // ── Test list features ────────────────────────────────────────

    _filterTests(query) {
        this._listQuery = query;
        this._applyListFilters();
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
.tprev-badge{padding:4px 12px;border-radius:20px;background:rgba(245,158,11,.12);color:#f59e0b;font-size:.78rem;font-weight:700}
.tprev-q{border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:14px;background:var(--bg-surface)}
.tprev-qnum{font-size:.73rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.tprev-qtext{font-size:.95rem;color:var(--text-primary);margin-bottom:14px;line-height:1.6}
.tprev-qtext::after{content:'';display:block;clear:both}
.tprev-qtext img{max-width:100%;height:auto;border-radius:4px;cursor:zoom-in}
.tprev-qtext p{margin:0 0 4px}
.tprev-qtext table,.tprev-opt-body table{border-collapse:collapse;width:100%;margin:8px 0;table-layout:fixed}
.tprev-qtext table td,.tprev-opt-body table td{border:1px solid var(--border);padding:6px 9px;font-size:.88rem;vertical-align:top}
.tprev-opt{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-radius:10px;border:1.5px solid var(--border);margin-bottom:8px;background:var(--bg-raised)}
.tprev-opt-marker{width:18px;height:18px;border-radius:50%;border:2px solid var(--border);flex-shrink:0;margin-top:3px}
.tprev-opt-marker.sq{border-radius:4px}
.tprev-opt-body{flex:1;min-width:0;font-size:.9rem;line-height:1.5}
.tprev-opt-body::after{content:'';display:block;clear:both}
.tprev-opt-body img{max-width:100%;height:auto;border-radius:4px;cursor:zoom-in}
.tprev-opt-body p{margin:0 0 2px}
.tprev-expl{margin-top:12px;padding:10px 14px;border-radius:10px;background:rgba(99,102,241,.07);border:1.5px solid rgba(99,102,241,.2);font-size:.82rem;color:var(--text-secondary)}
</style>
<div class="tprev-page">
    <div class="tprev-topbar">
        <button class="btn-back" onclick="TestsManagerPage._goBack(TestsManagerPage._container)"><i class="fa-solid fa-arrow-left"></i> Назад</button>
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
        return `<div class="tprev-q ql-snow">
            <div class="tprev-qnum">Питання ${qi+1} &nbsp;·&nbsp; ${pts} ${ptsTxt}</div>
            <div class="tprev-qtext">${q.question_text || ''}</div>
            ${optHtml}
            ${q.explanation ? `<div class="tprev-expl"><i class="fa-solid fa-lightbulb"></i> ${Fmt.esc(q.explanation)}</div>` : ''}
        </div>`;
    }).join('')}
</div>`;
        container.querySelectorAll('.tprev-qtext img, .tprev-opt-body img').forEach(img => {
            img.onclick = () => TestsManagerPage._openLightbox(img.src);
        });
    },

    async deleteTest(id, title) {
        const ok = await Modal.confirm({
            title: 'Видалити тест?',
            message: `«${Fmt.esc(title||'')}» разом з усіма питаннями, відповідями та результатами проходжень буде видалено назавжди. Цю дію не можна скасувати.`,
            confirmText: 'Видалити',
            danger: true
        });
        if (!ok) return;
        Loader.show();
        try {
            await API.tests.delete(id);
            ActivityTracker.track('test_delete', { entity_type: 'test', entity_id: id, entity_title: title });
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
            var test = this._tests.find(x => x.id === testId) || this._curTest;
            testTitle = test?.title || '';
        } catch(e) { Toast.error('Помилка', e.message); this._goBack(container); return; }

        // Manager sees only subordinates
        let employees = allEmployees;
        if (!AppState.isAdmin()) {
            employees = allEmployees.filter(e => e.manager_id === AppState.user.id);
        }

        const assignedMap = new Map(assigned.map(a => [a.user_id, a]));
        const deadlines   = assigned.map(a => a.deadline_at).filter(Boolean);
        // datetime-local очікує локальний час — toISOString() зсунув би на -2/-3 год
        const _dtLocal = iso => {
            const d = new Date(iso), p = n => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
        };
        const commonDl    = deadlines.length && deadlines.every(d => d === deadlines[0])
            ? _dtLocal(deadlines[0]) : '';
        this._assignTitle = testTitle;
        // Snapshot for _doAssign — comparing against this (rather than trusting a dataset
        // flag set by the picker's onchange chain) reliably detects an actual edit.
        this._asgnOriginalDeadline = commonDl;

        const positions     = [...new Set(employees.map(e => e.job_position).filter(Boolean))].sort();
        const mgrIds        = [...new Set(employees.map(e => e.manager_id).filter(Boolean))];
        const managers      = mgrIds.map(mid => allEmployees.find(e => e.id === mid)).filter(Boolean);
        const showMgrFilter = AppState.isAdmin() && managers.length > 0;
        const filterCols    = 1 + (positions.length ? 1 : 0) + (showMgrFilter ? 1 : 0);

        const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#10b981','#f59e0b','#06b6d4','#3b82f6','#f43f5e'];
        const selArrow = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E";
        const mgrNameById = new Map(managers.map(m => [m.id, m.full_name]));
        const qCount   = test?.questions?.length ?? '—';
        const timeTxt  = test?.time_limit_minutes ? `${test.time_limit_minutes} хв` : 'Без обмежень';
        const passTxt  = `${test?.passing_score || 70}%`;

        container.innerHTML = `<style>
.tasgn-page{display:flex;flex-direction:column;height:calc(100vh - 120px)}
.tasgn-hero{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:18px;flex-shrink:0}
.tasgn-hero-icon{width:32px;height:32px;border-radius:9px;background:rgba(201,162,39,.15);color:#C9A227;display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0}
.tasgn-hero-title{font-size:1.02rem;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.tasgn-cards-col{display:flex;flex-direction:column;gap:12px;flex:0 1 420px;max-width:500px;overflow-y:auto}
.tasgn-card{border:1px solid var(--border);border-radius:14px;background:var(--bg-surface);padding:14px 16px}
.tasgn-card-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.tasgn-card-ico{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:.9rem;flex-shrink:0}
.tasgn-card-title{font-size:.85rem;font-weight:700;color:var(--text-primary)}
.tasgn-card-sub{font-size:.7rem;color:var(--text-muted);margin-top:1px}
.tasgn-card-line{display:flex;align-items:center;gap:8px;font-size:.78rem;color:var(--text-secondary);margin-bottom:6px}
.tasgn-card-line:last-child{margin-bottom:0}
.tasgn-card-line i{width:14px;color:var(--text-muted);flex-shrink:0}
.tasgn-card-line b{color:var(--text-primary);font-weight:700;margin-left:auto}
.tasgn-avatar-stack{display:flex;align-items:center}
.tasgn-avatar-stack .tasgn-avatar{margin-left:-8px;border:2px solid var(--bg-surface)}
.tasgn-avatar-stack .tasgn-avatar:first-child{margin-left:0}
.tasgn-avatar-more{background:var(--bg-raised)!important;color:var(--text-muted)!important;border:2px solid var(--bg-surface)}

.tasgn-section-lbl{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px}

.tasgn-main-row{display:flex;gap:16px;flex:1;min-height:0}
.tasgn-right-col{flex:1;min-width:0;display:flex;flex-direction:column;min-height:0}

.tasgn-mini-stats{display:flex;gap:14px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
.tasgn-mini-stat{display:flex;flex-direction:column;gap:1px}
.tasgn-mini-stat b{font-size:1.05rem;font-weight:800;color:var(--text-primary);line-height:1.1}
.tasgn-mini-stat span{font-size:.6rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em}
.tasgn-mini-stat.pass b{color:#10b981}
.tasgn-mini-stat.new b{color:var(--primary)}
.tasgn-dl-inp{padding:6px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.8rem;outline:none;font-family:inherit;transition:border-color .15s}
.tasgn-dl-inp:focus{border-color:var(--primary)}
.tasgn-dl-presets{display:flex;gap:5px;margin-top:6px}
.tasgn-dl-presets button{padding:3px 9px;border-radius:9999px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-muted);font-size:.68rem;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit}
.tasgn-dl-presets button:hover{border-color:var(--primary);color:var(--primary)}

.tasgn-controls{flex-shrink:0}
.tasgn-filters{display:grid;gap:8px;margin-bottom:10px}
.tasgn-search-wrap{display:flex;align-items:center;gap:8px;padding:0 12px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);transition:border-color .15s}
.tasgn-search-wrap:focus-within{border-color:var(--primary)}
.tasgn-search-wrap i{color:var(--text-muted);font-size:.82rem;flex-shrink:0}
.tasgn-search-inp{flex:1;min-width:0;border:none!important;background:transparent!important;color:var(--text-primary)!important;font-size:.84rem;outline:none!important;padding:8px 0!important}
.tasgn-select{padding:8px 30px 8px 12px;border-radius:10px;border:1.5px solid var(--border);background-color:var(--bg-surface);background-image:url("${selArrow}");background-repeat:no-repeat;background-position:right 10px center;color:var(--text-primary);font-size:.84rem;outline:none;appearance:none;cursor:pointer;font-family:inherit;transition:border-color .15s}
.tasgn-select:focus{border-color:var(--primary)}
.tasgn-reset-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.82rem;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit}
.tasgn-reset-btn:hover{border-color:var(--primary);color:var(--primary)}

.tasgn-selline{display:flex;align-items:center;gap:14px;margin-bottom:10px;flex-wrap:wrap}
.tasgn-selline-txt{font-size:.84rem;color:var(--text-secondary)}
.tasgn-selline-txt b{color:var(--text-primary);font-weight:800}
.tasgn-link-btn{background:none;border:none;color:var(--primary);font-size:.8rem;font-weight:600;cursor:pointer;padding:0;font-family:inherit}
.tasgn-link-btn:hover{text-decoration:underline}
.tasgn-bulk-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:9px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit;margin-left:auto}
.tasgn-bulk-btn:hover{border-color:var(--primary);color:var(--primary)}

.tasgn-list-wrap{flex:1;overflow-y:auto;border:1px solid var(--border);border-radius:14px;min-height:0;background:var(--bg-surface)}
.tasgn-list-head{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-raised);border-bottom:1px solid var(--border);font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);position:sticky;top:0}
.tasgn-col-cbav{width:60px;flex-shrink:0}
.tasgn-col-name{flex:1;min-width:0}
.tasgn-col-pos{width:170px;flex-shrink:0}
.tasgn-col-mgr{width:170px;flex-shrink:0}
.tasgn-col-status{width:150px;flex-shrink:0;text-align:right}
@media(max-width:1000px){.tasgn-col-mgr{display:none}}
@media(max-width:820px){.tasgn-col-pos{display:none}}
.tm-assign-item{display:flex;align-items:center;gap:12px;padding:9px 14px;border-bottom:1px solid var(--border);border-left:3px solid transparent;cursor:pointer;transition:background .12s,border-color .12s}
.tm-assign-item:last-child{border-bottom:none}
.tm-assign-item:hover{background:var(--bg-hover)}
.tm-assign-item.tasgn-will-add{border-left-color:#10b981;background:rgba(16,185,129,.045)}
.tm-assign-item.tasgn-will-remove{border-left-color:#ef4444;background:rgba(239,68,68,.045)}
.tasgn-cbav{width:60px;flex-shrink:0;display:flex;align-items:center;gap:8px}
.tasgn-cb{width:17px;height:17px;cursor:pointer;flex-shrink:0;accent-color:var(--primary)}
.tasgn-avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:.7rem;font-weight:700;flex-shrink:0;object-fit:cover}
.tasgn-emp-name{font-weight:600;font-size:.87rem;color:var(--text-primary)}
.tasgn-emp-pos-col{width:170px;flex-shrink:0;font-size:.8rem;color:var(--text-secondary)}
.tasgn-emp-mgr-col{width:170px;flex-shrink:0;font-size:.8rem;color:var(--text-secondary)}
@media(max-width:1000px){.tasgn-emp-mgr-col{display:none}}
@media(max-width:820px){.tasgn-emp-pos-col{display:none}}
.tasgn-col-status2{width:150px;flex-shrink:0;display:flex;justify-content:flex-end;align-items:center;gap:6px}
.tasgn-chg-badge{font-size:.66rem;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0}
.tasgn-chg-badge:empty{display:none}
.tasgn-chg-badge.add{background:rgba(16,185,129,.12);color:#10b981}
.tasgn-chg-badge.remove{background:rgba(239,68,68,.1);color:#ef4444}
.tasgn-badge{font-size:.66rem;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap;flex-shrink:0}
.tasgn-badge-pass{background:rgba(16,185,129,.12);color:#10b981}
.tasgn-badge-fail{background:rgba(239,68,68,.1);color:#ef4444}
.tasgn-badge-none{background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border)}
.tasgn-dl-txt{font-size:.68rem;color:var(--text-muted);white-space:nowrap;flex-shrink:0}

.tasgn-foot{display:flex;flex-direction:column;gap:8px}
.tasgn-cancel{padding:11px 20px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);font-size:.85rem;font-weight:600;cursor:pointer;transition:all .15s;font-family:inherit;width:100%}
.tasgn-cancel:hover{border-color:var(--border-light);color:var(--text-primary)}
.tasgn-save{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 65%,#1e3a8a));color:#fff;font-size:.9rem;font-weight:700;cursor:pointer;transition:all .18s;box-shadow:0 4px 14px color-mix(in srgb,var(--primary) 35%,transparent);font-family:inherit;width:100%}
.tasgn-save:hover{transform:translateY(-1px);box-shadow:0 6px 20px color-mix(in srgb,var(--primary) 45%,transparent)}
.tasgn-remind{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 18px;border-radius:12px;border:1.5px solid #f59e0b;background:transparent;color:#f59e0b;font-size:.85rem;font-weight:700;cursor:pointer;transition:all .18s;font-family:inherit;width:100%}
.tasgn-remind:hover{background:rgba(245,158,11,.12)}
.tasgn-remind:disabled{opacity:.5;cursor:not-allowed}
</style>
<div class="tasgn-page">
    <div class="tasgn-hero">
        <button class="btn-back" onclick="TestsManagerPage._goBack(TestsManagerPage._container)"><i class="fa-solid fa-arrow-left"></i> Назад</button>
        <div class="tasgn-hero-icon"><i class="fa-solid fa-user-group"></i></div>
        <span class="tasgn-hero-title">${Fmt.esc(testTitle)}</span>
    </div>
    <div class="tasgn-main-row">
        <div class="tasgn-right-col">
    <div class="tasgn-controls">
        <div class="tasgn-filters" style="grid-template-columns:repeat(${filterCols},1fr) auto">
            <div class="tasgn-search-wrap">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input id="tm-search" class="tasgn-search-inp" type="text" placeholder="Пошук за іменем..." oninput="TestsManagerPage._applyAssignFilters()">
            </div>
            ${positions.length ? `<div>${MultiSelect.html('tasgn-ms-pos', 'Всі посади')}</div>` : ''}
            ${showMgrFilter ? `
            <select id="tm-filter-mgr" class="tasgn-select" onchange="TestsManagerPage._applyAssignFilters()">
                <option value="">Всі керівники</option>
                ${managers.map(m => `<option value="${m.id}">${Fmt.esc(m.full_name)}</option>`).join('')}
            </select>` : ''}
            <button type="button" class="tasgn-reset-btn" onclick="TestsManagerPage._resetAssignFilters()"><i class="fa-solid fa-arrow-rotate-left"></i> Скинути фільтри</button>
        </div>
        <div class="tasgn-selline">
            <span class="tasgn-selline-txt">Обрано: <b id="tasgn-selline-n">0</b> співробітників</span>
            <button type="button" class="tasgn-link-btn" onclick="TestsManagerPage._selectAllFiltered(false)">Очистити вибір</button>
            <button type="button" class="tasgn-bulk-btn" onclick="TestsManagerPage._selectAllFiltered(true)"><i class="fa-solid fa-square-check"></i> Вибрати всіх видимих</button>
        </div>
    </div>
    <div class="tasgn-list-wrap">
        <div class="tasgn-list-head">
            <span class="tasgn-col-cbav"></span>
            <span class="tasgn-col-name">Співробітник</span>
            <span class="tasgn-col-pos">Посада</span>
            <span class="tasgn-col-mgr">Керівник</span>
            <span class="tasgn-col-status">Статус</span>
        </div>
        ${employees.map((e, i) => {
            const a      = assignedMap.get(e.id);
            const dlTxt  = a?.deadline_at ? `до ${Fmt.dateShort(a.deadline_at)}` : '';
            const attempt = attemptsMap.get(e.id);
            const statusHtml = attempt
                ? attempt.passed
                    ? `<span class="tasgn-badge tasgn-badge-pass"><i class="fa-solid fa-check"></i> Пройшов</span>`
                    : `<span class="tasgn-badge tasgn-badge-fail"><i class="fa-solid fa-xmark"></i> Не пройшов</span>`
                : a ? `<span class="tasgn-badge tasgn-badge-none"><i class="fa-solid fa-pause"></i> Не починав</span>` : '';
            const stKey = attempt ? (attempt.passed ? 'pass' : 'fail') : (a ? 'none' : '');
            const avColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const mgrName = mgrNameById.get(e.manager_id) || '';
            return `
        <label class="tm-assign-item"
            data-name="${Fmt.esc((e.full_name||e.email||'').toLowerCase())}"
            data-pos="${Fmt.esc((e.job_position||'').toLowerCase())}"
            data-mgr="${e.manager_id||''}"
            data-st="${stKey}">
            <span class="tasgn-cbav">
                <input type="checkbox" class="tasgn-cb" value="${e.id}" ${a?'checked':''} data-was-assigned="${!!a}"
                    onchange="TestsManagerPage._updateAssignCount()" onclick="event.stopPropagation()">
                ${e.avatar_url
                    ? `<img class="tasgn-avatar" src="${Fmt.esc(e.avatar_url)}" alt="">`
                    : `<div class="tasgn-avatar" style="background:${avColor}">${Fmt.esc(Fmt.initials(e.full_name||e.email))}</div>`}
            </span>
            <div class="tasgn-emp-name" style="flex:1;min-width:0">${Fmt.esc(e.full_name||e.email)}</div>
            <div class="tasgn-emp-pos-col">${Fmt.esc(e.job_position||'—')}</div>
            <div class="tasgn-emp-mgr-col">${Fmt.esc(mgrName||'—')}</div>
            <div class="tasgn-col-status2">
                <span class="tasgn-chg-badge"></span>
                ${statusHtml}
                ${a && dlTxt ? `<span class="tasgn-dl-txt">${dlTxt}</span>` : ''}
            </div>
        </label>`;
        }).join('')}
    </div>
        </div>
        <div class="tasgn-cards-col">
            <div class="tasgn-card">
                <div class="tasgn-card-head">
                    <div class="tasgn-card-ico" style="background:rgba(99,102,241,.12);color:#6366f1"><i class="fa-regular fa-file-lines"></i></div>
                    <div><div class="tasgn-card-title">Про тест</div><div class="tasgn-card-sub">Призначення тесту співробітникам</div></div>
                </div>
                <div class="tasgn-card-line"><i class="fa-solid fa-question"></i> Кількість питань <b>${qCount}</b></div>
                <div class="tasgn-card-line"><i class="fa-regular fa-clock"></i> Тривалість <b>${timeTxt}</b></div>
                <div class="tasgn-card-line"><i class="fa-regular fa-star"></i> Прохідний бал <b>${passTxt}</b></div>
            </div>
            <div class="tasgn-card">
                <div class="tasgn-card-head">
                    <div class="tasgn-card-ico" style="background:rgba(139,92,246,.12);color:#8b5cf6"><i class="fa-solid fa-user-group"></i></div>
                    <div><div class="tasgn-card-title">Кому призначити</div><div class="tasgn-card-sub" id="tasgn-assign-to-sub">Обрано співробітників: 0</div></div>
                </div>
                <div class="tasgn-avatar-stack" id="tasgn-avatar-stack"></div>
                <div class="tasgn-mini-stats">
                    <div class="tasgn-mini-stat"><b id="tasgn-sum-sel">0</b><span>Вибрано</span></div>
                    <div class="tasgn-mini-stat pass"><b id="tasgn-sum-pass">0</b><span>Пройшли</span></div>
                    <div class="tasgn-mini-stat new"><b id="tasgn-sum-new">0</b><span>Нові</span></div>
                </div>
            </div>
            <div class="tasgn-card">
                <div class="tasgn-card-head">
                    <div class="tasgn-card-ico" style="background:rgba(6,182,212,.12);color:#06b6d4"><i class="fa-regular fa-calendar"></i></div>
                    <div><div class="tasgn-card-title">Терміни</div><div class="tasgn-card-sub">Дедлайн для проходження</div></div>
                </div>
                ${UaDateTime.html('tm-deadline', commonDl)}
                <div class="tasgn-dl-presets">
                    <button type="button" onclick="TestsManagerPage._setDeadlinePreset(1)">+1 день</button>
                    <button type="button" onclick="TestsManagerPage._setDeadlinePreset(3)">+3 дні</button>
                    <button type="button" onclick="TestsManagerPage._setDeadlinePreset(7)">+тиждень</button>
                </div>
            </div>
            <div class="tasgn-foot">
                <button class="tasgn-save" onclick="TestsManagerPage._doAssign('${testId}')"><i class="fa-regular fa-floppy-disk"></i> Призначити</button>
                <button type="button" class="tasgn-remind" onclick="TestsManagerPage._remindInactive('${testId}',this)"><i class="fa-regular fa-bell"></i> Нагадати неактивним</button>
                <button type="button" class="tasgn-cancel" onclick="TestsManagerPage._goBack(TestsManagerPage._container)">Скасувати</button>
            </div>
        </div>
    </div>
</div>`;
        if (positions.length) {
            MultiSelect.init('tasgn-ms-pos', positions);
            document.getElementById('tasgn-ms-pos')?.addEventListener('change', () => TestsManagerPage._applyAssignFilters());
        }
        this._updateAssignCount();
    },

    // Швидкі пресети дедлайну — сьогодні + N днів, той самий час доби, що зараз
    _setDeadlinePreset(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        const p = n => String(n).padStart(2, '0');
        if (!document.getElementById('tm-deadline')) return;
        UaDateTime.set('tm-deadline', `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`);
    },

    // Нагадування призначеним, які ще не почали тест
    async _remindInactive(testId, btn) {
        const targets = [...document.querySelectorAll('.tm-assign-item')]
            .filter(el => el.dataset.st === 'none' && el.querySelector('input[type=checkbox]')?.dataset.wasAssigned === 'true')
            .map(el => el.querySelector('input[type=checkbox]').value);
        if (!targets.length) { Toast.info('Нікому нагадувати', 'Всі призначені вже почали тест'); return; }
        const ok = await Modal.confirm({
            title: 'Нагадування',
            message: `Надіслати нагадування ${targets.length} співробітникам, які ще не почали тест?`,
            confirmText: 'Надіслати'
        });
        if (!ok) return;
        btn.disabled = true;
        try {
            const title = this._assignTitle || 'Тест';
            const { error } = await supabase.from('notifications').insert(targets.map(uid => ({
                user_id: uid, type: 'test_assigned',
                title:   `Нагадування: пройдіть тест «${title}»`,
                message: title,
                link:    `tests/${testId}`
            })));
            if (error) throw error;
            Toast.success('Надіслано', `Нагадування отримають ${targets.length} співробітників`);
        } catch(e) {
            Toast.error('Помилка', e.message);
            btn.disabled = false;
        }
    },

    _resetAssignFilters() {
        const s = document.getElementById('tm-search');     if (s) s.value = '';
        if (document.getElementById('tasgn-ms-pos')) MultiSelect.clear('tasgn-ms-pos');
        const m = document.getElementById('tm-filter-mgr'); if (m) m.value = '';
        this._applyAssignFilters();
    },

    _applyAssignFilters() {
        const query  = (document.getElementById('tm-search')?.value    || '').trim().toLowerCase();
        const posSel = document.getElementById('tasgn-ms-pos') ? MultiSelect.getValues('tasgn-ms-pos').map(p => p.toLowerCase()) : [];
        const mgr    =  document.getElementById('tm-filter-mgr')?.value || '';
        document.querySelectorAll('.tm-assign-item').forEach(el => {
            const ok = (!query    || el.dataset.name.includes(query))
                    && (!posSel.length || posSel.includes(el.dataset.pos))
                    && (!mgr     || el.dataset.mgr  === mgr);
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
        const all = [...document.querySelectorAll('.tm-assign-item input[type=checkbox]')];
        // Зведена панель
        const checked = all.filter(c => c.checked);
        const passN   = checked.filter(c => c.closest('.tm-assign-item').dataset.st === 'pass').length;
        const newN    = checked.filter(c => c.dataset.wasAssigned === 'false').length;
        const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
        set('tasgn-sum-sel', checked.length);
        set('tasgn-sum-pass', passN);
        set('tasgn-sum-new', newN);
        set('tasgn-selline-n', checked.length);
        set('tasgn-assign-to-sub', `Обрано співробітників: ${checked.length}`);
        // Стек аватарок обраних (перші 3 + "+N")
        const stack = document.getElementById('tasgn-avatar-stack');
        if (stack) {
            const items = checked.map(c => c.closest('.tm-assign-item'));
            const shown = items.slice(0, 3);
            const restN = items.length - shown.length;
            stack.innerHTML = shown.map(item => item.querySelector('.tasgn-avatar').outerHTML).join('')
                + (restN > 0 ? `<div class="tasgn-avatar tasgn-avatar-more">+${restN}</div>` : '');
        }
        // Per-row: показуємо, що саме зміниться після збереження — новий вибір / зняття
        // раніше призначеного — а не тільки агреговані цифри у зведеній панелі.
        all.forEach(cb => {
            const item = cb.closest('.tm-assign-item');
            const wasAssigned = cb.dataset.wasAssigned === 'true';
            const willAdd    = cb.checked && !wasAssigned;
            const willRemove = !cb.checked && wasAssigned;
            item.classList.toggle('tasgn-will-add', willAdd);
            item.classList.toggle('tasgn-will-remove', willRemove);
            const badge = item.querySelector('.tasgn-chg-badge');
            if (badge) {
                badge.className = 'tasgn-chg-badge' + (willAdd ? ' add' : willRemove ? ' remove' : '');
                badge.textContent = willAdd ? 'Новий' : willRemove ? 'Буде знято' : '';
            }
        });
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
        const deadlineChanged = deadlineRaw !== (this._asgnOriginalDeadline || '');

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
            // Send notifications to newly assigned users (single batch insert)
            if (toAssignNew.length) {
                const testTitle = (this._tests.find(x => x.id === testId) || this._curTest)?.title || 'Тест';
                const { error: nErr } = await supabase.from('notifications').insert(toAssignNew.map(uid => ({
                    user_id: uid, type: 'test_assigned',
                    title:   `Вам призначено тест: ${testTitle}`,
                    message: testTitle,
                    link:    `tests/${testId}`
                })));
                if (nErr) {
                    Toast.warning('Сповіщення', 'Призначено, але не вдалося надіслати сповіщення');
                }
            }
            Toast.success('Збережено');
            if ([...toAssignNew, ...toUnassign].includes(AppState.user.id)) UI.loadLearnBadge();
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
        let results = [], test, grants = {}, assignments = [];
        try {
            [results, test, grants, assignments] = await Promise.all([
                TestsManagerAPI.getAllResults(testId),
                API.tests.getById(testId),
                API.attempts.getGrantsForTest(testId).catch(() => ({})),
                TestsManagerAPI.getAssignments(testId).catch(() => [])
            ]);
        } catch(e) { Toast.error('Помилка', e.message); this._goBack(container); return; }

        this._lastResults = results;
        this._resultsTestId = testId;
        this._resTest = test;
        this._qStatsLoaded = false;

        // Group attempts by user
        const userMap = new Map();
        for (const r of results) {
            if (!userMap.has(r.user_id)) userMap.set(r.user_id, { user: r.user, uid: r.user_id, attempts: [] });
            userMap.get(r.user_id).attempts.push(r);
        }
        const users = [...userMap.values()];
        this._resUsers = userMap;

        const totalPassed = users.filter(u => u.attempts.some(a => a.passed)).length;
        const avgPct = results.length ? Math.round(results.reduce((s,r) => s+(r.percentage||0), 0) / results.length) : 0;
        const maxAttempts = test.max_attempts;
        const assignedN   = assignments.length;
        const attemptedIds = new Set(results.map(r => r.user_id));
        const notStarted  = assignments.filter(a => !attemptedIds.has(a.user_id)).length;

        const rowsHtml = users.map(({ user, uid, attempts }) => {
            const best = attempts.reduce((b,a) => (!b || (a.percentage||0) > (b.percentage||0)) ? a : b, null);
            const extraGrants = grants[uid] || 0;
            const allowed = maxAttempts ? maxAttempts + extraGrants : null;
            const exhausted = allowed !== null && attempts.length >= allowed;
            const hasPassed = attempts.some(a => a.passed);
            return `
            <tr style="border-top:1px solid var(--border);cursor:pointer;transition:background .12s"
                onmouseenter="this.style.background='var(--bg-raised)'" onmouseleave="this.style.background=''"
                onclick="TestsManagerPage._openUserAttempts('${uid}')" title="Історія спроб">
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
                <td style="padding:10px 14px;text-align:center" onclick="event.stopPropagation()">
                    ${maxAttempts && exhausted ? `<button class="btn btn-ghost btn-sm" onclick="TestsManagerPage._grantAttempt('${testId}','${uid}',this)" title="Дати додаткову спробу">
                        <i class="fa-solid fa-plus"></i> Спробу
                    </button>` : ''}
                </td>
            </tr>`;
        }).join('');

        container.innerHTML = `<style>
.tres-page{max-width:900px;display:flex;flex-direction:column;height:calc(100vh - 120px)}
.tres-topbar{display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:20px;flex-shrink:0}
.tres-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:18px;flex-shrink:0}
.tres-stat{padding:14px 16px;border-radius:14px;border:1px solid var(--border);background:var(--bg-surface);position:relative;overflow:hidden}
.tres-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--tile-c,var(--primary))}
.tres-stat-ico{font-size:.9rem;color:var(--tile-c,var(--primary));margin-bottom:7px}
.tres-stat-val{font-size:1.5rem;font-weight:800;color:var(--text-primary);letter-spacing:-.02em}
.tres-stat-lbl{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-top:2px}
.tres-tabs{display:flex;gap:4px;padding:4px;border-radius:10px;background:var(--bg-raised);border:1px solid var(--border);width:fit-content;margin-bottom:14px;flex-shrink:0}
.tres-tab{padding:8px 20px;border-radius:7px;border:none;background:transparent;color:var(--text-secondary);font-size:.83rem;font-weight:700;cursor:pointer;transition:all .18s;font-family:inherit}
.tres-tab.on{background:var(--bg-surface);color:var(--text-primary);box-shadow:0 2px 8px rgba(0,0,0,.18)}
.tres-table-wrap{flex:1;border:1px solid var(--border);border-radius:12px;overflow:auto;min-height:0;background:var(--bg-surface)}
.tres-qrow{display:flex;align-items:center;gap:14px;padding:13px 18px;border-bottom:1px solid var(--border)}
.tres-qrow:last-child{border-bottom:none}
.tres-qnum{width:26px;height:26px;border-radius:50%;background:var(--bg-raised);border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;color:var(--text-muted);flex-shrink:0}
.tres-qrow.hard .tres-qnum{border-color:var(--danger);color:var(--danger);background:rgba(239,68,68,.08)}
.tres-qbody{flex:1;min-width:0}
.tres-qtext{font-size:.84rem;font-weight:500;color:var(--text-primary);margin-bottom:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tres-qbar{height:7px;border-radius:9999px;background:var(--bg-hover);overflow:hidden}
.tres-qfill{height:100%;border-radius:9999px;transition:width .7s cubic-bezier(.4,0,.2,1)}
.tres-qpct{width:110px;text-align:right;flex-shrink:0;font-size:.8rem;font-weight:800}
.tres-qpct span{display:block;font-size:.62rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:1px}
</style>
<div class="tres-page">
    <div class="tres-topbar">
        <button class="btn-back" onclick="TestsManagerPage._goBack(TestsManagerPage._container)"><i class="fa-solid fa-arrow-left"></i> Назад</button>
        <span style="font-size:1.1rem;font-weight:700;color:var(--text-primary);flex:1"><i class="fa-solid fa-chart-column" style="color:#16a34a"></i> ${Fmt.esc(test.title)}</span>
        ${results.length ? `<button style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border-radius:10px;border:none;cursor:pointer;font-size:.82rem;font-weight:700;background:linear-gradient(135deg,#16a34a,#15803d);color:#fff;box-shadow:0 4px 14px rgba(22,163,74,.35);transition:all .2s" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''" onclick="TestsManagerPage._exportCSV(TestsManagerPage._lastResults,${JSON.stringify(test.title||'').replace(/"/g,'&quot;')})"><i class="fa-solid fa-file-csv"></i> Звіт</button>` : ''}
    </div>
    <div class="tres-stats">
        ${[
            ['var(--primary)','<i class="fa-solid fa-users"></i>',        assignedN || users.length, 'Призначено'],
            ['#10b981',       '<i class="fa-solid fa-circle-check"></i>', totalPassed,               'Пройшли'],
            ['#ef4444',       '<i class="fa-solid fa-circle-xmark"></i>', users.length - totalPassed,'Не пройшли'],
            ['#f59e0b',       '<i class="fa-solid fa-hourglass-half"></i>', notStarted,              'Не починали'],
            ['#C9A227',       '<i class="fa-solid fa-chart-line"></i>',   avgPct + '%',              'Середній бал'],
        ].map(([c, ic, v, l]) => `
        <div class="tres-stat" style="--tile-c:${c}">
            <div class="tres-stat-ico">${ic}</div>
            <div class="tres-stat-val">${v}</div>
            <div class="tres-stat-lbl">${l}</div>
        </div>`).join('')}
    </div>
    <div class="tres-tabs">
        <button class="tres-tab on" onclick="TestsManagerPage._resTab('people',this)">По людях</button>
        <button class="tres-tab" onclick="TestsManagerPage._resTab('questions',this)">По питаннях</button>
    </div>
    <div id="tres-people" class="tres-table-wrap">
        ${users.length ? `
        <table style="width:100%;border-collapse:collapse;font-size:.85rem">
            <thead style="position:sticky;top:0;z-index:1">
                <tr style="background:var(--bg-raised)">
                    <th style="padding:10px 14px;width:250px;text-align:left;font-weight:600;color:var(--text-muted)">Співробітник</th>
                    <th style="padding:10px 14px;text-align:center;font-weight:600;color:var(--text-muted)">Спроби</th>
                    <th style="padding:10px 14px;text-align:center;font-weight:600;color:var(--text-muted)">Кращий бал</th>
                    <th style="padding:10px 14px;text-align:center;font-weight:600;color:var(--text-muted)">Статус</th>
                    <th style="padding:10px 14px;text-align:center;font-weight:600;color:var(--text-muted)"></th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>` : '<div style="text-align:center;padding:3rem;color:var(--text-muted)">Результатів поки немає</div>'}
    </div>
    <div id="tres-questions" class="tres-table-wrap" style="display:none">
        <div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>
    </div>
</div>`;
    },

    _resTab(which, btn) {
        document.querySelectorAll('.tres-tab').forEach(t => t.classList.remove('on'));
        btn.classList.add('on');
        const people = document.getElementById('tres-people');
        const quests = document.getElementById('tres-questions');
        if (people) people.style.display = which === 'people' ? '' : 'none';
        if (quests) quests.style.display = which === 'questions' ? '' : 'none';
        if (which === 'questions' && !this._qStatsLoaded) this._loadQuestionStats();
    },

    // Вкладка «По питаннях» — % помилок на кожне питання
    async _loadQuestionStats() {
        const el = document.getElementById('tres-questions');
        if (!el) return;
        this._qStatsLoaded = true;
        try {
            const attemptIds = (this._lastResults || []).map(r => r.id);
            const rows = await TestsManagerAPI.getQuestionStats(attemptIds);
            const agg = {};   // question_id -> {total, wrong}
            rows.forEach(r => {
                const a = agg[r.question_id] = agg[r.question_id] || { total: 0, wrong: 0 };
                a.total++;
                if (!r.is_correct) a.wrong++;
            });
            const qText = html => (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const questions = [...(this._resTest?.questions || [])]
                .sort((a, b) => a.order_index - b.order_index)
                .map((q, idx) => {
                    const a = agg[q.id];
                    return {
                        num:  idx + 1,
                        text: qText(q.question_text) || `Питання ${idx + 1}`,
                        err:  a?.total ? Math.round(a.wrong / a.total * 100) : null,
                        total: a?.total || 0
                    };
                })
                .sort((a, b) => (b.err ?? -1) - (a.err ?? -1));
            if (!questions.length || !rows.length) {
                el.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted)">Ще немає даних по відповідях</div>';
                return;
            }
            el.innerHTML = questions.map(q => {
                const c = q.err === null ? 'var(--text-muted)' : q.err >= 50 ? '#ef4444' : q.err >= 30 ? '#f59e0b' : '#10b981';
                return `
<div class="tres-qrow${q.err !== null && q.err >= 50 ? ' hard' : ''}">
    <div class="tres-qnum">${q.num}</div>
    <div class="tres-qbody">
        <div class="tres-qtext" title="${Fmt.esc(q.text)}">${Fmt.esc(q.text)}</div>
        <div class="tres-qbar"><div class="tres-qfill" style="width:${q.err ?? 0}%;background:${c}"></div></div>
    </div>
    <div class="tres-qpct" style="color:${c}">${q.err === null ? '—' : q.err + '%'}<span>${q.err === null ? 'без відповідей' : 'помилок · ' + q.total + ' відп.'}</span></div>
</div>`;
            }).join('');
        } catch(e) {
            el.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--danger)">${Fmt.esc(e.message)}</div>`;
        }
    },

    // Історія спроб співробітника + протокол помилок
    _openUserAttempts(uid) {
        const entry = this._resUsers?.get(uid);
        if (!entry) return;
        const { user, attempts } = entry;
        const sorted = [...attempts].sort((a, b) => (a.attempt_number || 0) - (b.attempt_number || 0));
        Modal.open({
            title: `<i class="fa-solid fa-clock-rotate-left"></i> ${Fmt.esc(user?.full_name || user?.email || 'Співробітник')}`,
            size: 'lg',
            body: `
<div style="display:flex;flex-direction:column;gap:8px">
    ${sorted.map(a => `
    <div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-raised)">
        <div style="width:26px;height:26px;border-radius:50%;background:${a.passed ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.1)'};color:${a.passed ? '#10b981' : '#ef4444'};display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:800;flex-shrink:0">${a.attempt_number || '·'}</div>
        <div style="flex:1;min-width:0">
            <div style="font-size:.85rem;font-weight:700;color:${a.passed ? '#10b981' : '#ef4444'}">${Math.round(a.percentage || 0)}% ${a.passed ? '· складено' : '· не складено'}</div>
            <div style="font-size:.72rem;color:var(--text-muted)">${Fmt.datetime(a.completed_at)}${a.time_spent_seconds ? ' · ' + Math.round(a.time_spent_seconds / 60) + ' хв' : ''}</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="TestsManagerPage._openAttemptProtocol('${a.id}','${uid}')"><i class="fa-solid fa-list-check"></i> Протокол</button>
    </div>`).join('')}
</div>`,
            footer: `<button class="btn-secondary-modern" onclick="Modal.close()">Закрити</button>`
        });
    },

    async _openAttemptProtocol(attemptId, uid) {
        const body = document.getElementById('modal-body');
        if (body) body.innerHTML = '<div style="display:flex;justify-content:center;padding:2rem"><div class="spinner"></div></div>';
        try {
            const wrongs = await API.internTabель.getWrongAnswers(attemptId);
            if (!body) return;
            if (!wrongs.length) {
                body.innerHTML = '<div style="text-align:center;padding:2rem;color:#10b981;font-weight:600"><i class="fa-solid fa-circle-check"></i> Всі відповіді правильні</div>';
            } else {
                body.innerHTML = `
<div style="display:flex;flex-direction:column;gap:12px">
    ${wrongs.map(w => {
        const q = w.question;
        const selected = new Set(w.selected_answer_ids || []);
        const answers = [...(q?.answers || [])].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
        return `
    <div style="padding:13px 15px;border-radius:12px;border:1.5px solid rgba(239,68,68,.25);background:rgba(239,68,68,.04)">
        <div style="font-size:.86rem;font-weight:600;margin-bottom:9px">${q?.question_text || ''}</div>
        <div style="display:flex;flex-direction:column;gap:5px">
            ${answers.map(ans => {
                const sel = selected.has(ans.id);
                const cor = ans.is_correct;
                const ic  = cor ? '<i class="fa-solid fa-check" style="color:#10b981"></i>'
                          : sel ? '<i class="fa-solid fa-xmark" style="color:#ef4444"></i>'
                          : '<i class="fa-regular fa-circle" style="color:var(--text-muted);font-size:.6rem"></i>';
                return `<div style="display:flex;align-items:flex-start;gap:8px;font-size:.8rem;padding:4px 8px;border-radius:7px;${sel && !cor ? 'background:rgba(239,68,68,.1)' : cor ? 'background:rgba(16,185,129,.08)' : ''}">
                    <span style="width:14px;text-align:center;flex-shrink:0;margin-top:1px">${ic}</span>
                    <span style="color:var(--text-${cor || sel ? 'primary' : 'muted'})">${ans.answer_text || ''}</span>
                    ${sel ? '<span style="margin-left:auto;font-size:.62rem;font-weight:700;color:var(--text-muted);white-space:nowrap">обрано</span>' : ''}
                </div>`;
            }).join('')}
        </div>
    </div>`;
    }).join('')}
</div>`;
            }
            const footer = document.getElementById('modal-footer');
            if (footer) footer.innerHTML = `
<button class="btn-secondary-modern" onclick="TestsManagerPage._openUserAttempts('${uid}')"><i class="fa-solid fa-arrow-left"></i> До спроб</button>
<button class="btn-secondary-modern" onclick="Modal.close()">Закрити</button>`;
        } catch(e) {
            Toast.error('Помилка', e.message);
        }
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
        this._passedTestIds    = new Set(attempts.filter(a => a.passed).map(a => a.test_id));

        container.innerHTML = `
<style>
.mt-page{max-width:1100px;}
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
.mt-tabs.ep-style{border-bottom:none;gap:8px;margin-bottom:20px}
.mt-tabs.ep-style .mt-tab{padding:7px 18px;border-radius:50px;border:1.5px solid var(--border);background:var(--bg-surface);color:var(--text-muted);font-size:.8rem;font-weight:600;margin-bottom:0;border-bottom:1.5px solid var(--border);display:flex;align-items:center;gap:7px}
.mt-tabs.ep-style .mt-tab:hover:not(.active){border-color:#3b82f6;color:#3b82f6}
.mt-tabs.ep-style .mt-tab.active{background:#3b82f6;color:#fff;border-color:#3b82f6;border-bottom-color:#3b82f6}
.mt-ep-count{padding:1px 8px;border-radius:20px;font-size:.68rem;font-weight:800;line-height:1.6;background:var(--border);color:var(--text-muted)}
.mt-tab.active .mt-ep-count{background:rgba(255,255,255,.25);color:#fff}

.mt-section{margin-bottom:8px}
.mt-section-sep{margin-top:28px;padding-top:24px;border-top:1px solid var(--border)}
.mt-section-head{display:flex;align-items:center;gap:9px;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);margin-bottom:14px}
.mt-section-head i{color:var(--primary)}
.mt-list{
    display:grid;grid-template-columns:repeat(3,1fr);gap:14px;animation:mt-in .3s ease
}
@media(max-width:980px){.mt-list{grid-template-columns:repeat(2,1fr)}}
@media(max-width:620px){.mt-list{grid-template-columns:1fr}}
@keyframes mt-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.mt-card{
    position:relative;isolation:isolate;
    border:1px solid color-mix(in srgb,#fff 30%,var(--border));
    border-radius:16px;overflow:hidden;display:flex;flex-direction:column;
    box-shadow:0 8px 24px rgba(0,0,0,.08);
    transition:box-shadow .25s ease,transform .25s ease,border-color .25s ease
}
/* Кольоровий "підклад" картки — саме його розмиває скляний шар над ним */
.mt-card::before{
    content:'';position:absolute;inset:-30%;z-index:0;opacity:.55;filter:blur(6px);
    background:
        radial-gradient(circle at 22% 20%,var(--mt-glow,#6366f1) 0%,transparent 55%),
        radial-gradient(circle at 82% 78%,var(--mt-glow2,#8b5cf6) 0%,transparent 55%)
}
.mt-card-frost{
    position:absolute;inset:0;z-index:1;
    background:color-mix(in srgb,var(--bg-surface) 45%,transparent);
    backdrop-filter:blur(22px) saturate(200%);
    -webkit-backdrop-filter:blur(22px) saturate(200%)
}
/* Специкулярний блиск — над контентом */
.mt-card::after{
    content:'';position:absolute;inset:0;z-index:3;pointer-events:none;border-radius:inherit;
    background:linear-gradient(135deg,rgba(255,255,255,.4) 0%,rgba(255,255,255,.1) 22%,transparent 50%);
    mix-blend-mode:overlay;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.5),inset 0 -16px 22px -18px rgba(0,0,0,.2);
}
.mt-card:hover{
    box-shadow:0 16px 38px rgba(0,0,0,.16);transform:translateY(-3px) scale(1.01);
    border-color:color-mix(in srgb,#fff 40%,var(--primary))
}
.mt-card-bar{position:relative;z-index:2;width:100%;height:4px;flex-shrink:0}
.mt-card-bar.pending{background:linear-gradient(90deg,#f59e0b,#f97316)}
.mt-card-bar.overdue{background:linear-gradient(90deg,#ef4444,#dc2626)}
.mt-card-bar.done{background:linear-gradient(90deg,#10b981,#059669)}
.mt-card-body{position:relative;z-index:2;padding:16px 18px;flex:1;display:flex;flex-direction:column;gap:14px}
.mt-card-banner-wrap{position:relative;margin:-16px -18px 0;height:190px;overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.mt-card-banner-glow{position:absolute;inset:0;background-size:cover;background-position:center;filter:blur(26px) saturate(150%) brightness(.85);transform:scale(1.2)}
.mt-card-banner{position:relative;z-index:1;width:calc(100% - 32px);height:158px;object-fit:cover;border-radius:14px;box-shadow:0 12px 30px rgba(0,0,0,.35);display:block}
.mt-card-banner.stretch{object-fit:fill}
.mt-card-info{flex:1;min-width:0}
.mt-card-title{font-weight:700;font-size:.95rem;color:var(--text-primary);margin-bottom:5px}
.mt-card-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.mt-badge{display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:20px;font-size:.7rem;font-weight:600}
.mt-badge-pending{background:rgba(245,158,11,.16);color:#f59e0b;border:1px solid rgba(245,158,11,.4)}
.mt-badge-overdue{background:rgba(239,68,68,.16);color:#ef4444;border:1px solid rgba(239,68,68,.4)}
.mt-badge-done{background:rgba(16,185,129,.16);color:#10b981;border:1px solid rgba(16,185,129,.4)}
.mt-badge-fail{background:rgba(239,68,68,.16);color:#ef4444;border:1px solid rgba(239,68,68,.4)}
.mt-badge-info{background:color-mix(in srgb,var(--primary) 16%,transparent);color:var(--primary);border:1px solid color-mix(in srgb,var(--primary) 40%,transparent)}
.mt-btn-start{
    padding:.55rem .8rem;border-radius:8px;border:1px solid transparent;
    background:linear-gradient(135deg,#10b981,#059669);color:#fff;
    font-size:.8rem;font-weight:600;cursor:pointer;transition:box-shadow .15s,transform .15s;
    white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center;gap:6px;
    box-shadow:0 4px 12px -2px rgba(16,185,129,.5)
}
.mt-btn-start:hover{box-shadow:0 6px 16px -2px rgba(16,185,129,.65);transform:translateY(-1px)}
.mt-btn-locked{background:var(--bg-hover);color:var(--primary);border:1px solid var(--border);box-shadow:none}
.mt-btn-locked:hover{background:var(--bg-raised);box-shadow:none;transform:none}
.mt-btn-result-pass,.mt-btn-result-fail{background:linear-gradient(135deg,#0ea5e9,#10b981);color:#fff;box-shadow:0 4px 12px -2px rgba(14,165,233,.5)}
.mt-btn-result-pass:hover,.mt-btn-result-fail:hover{box-shadow:0 6px 16px -2px rgba(14,165,233,.65)}
.mt-gem-ico{color:#60a5fa;-webkit-text-stroke:1px #6b7280;text-stroke:1px #6b7280}
.mt-btn-view{padding:8px 16px;border-radius:12px;border:1.5px solid var(--border);background:transparent;color:var(--text-secondary);font-size:.83rem;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center;gap:6px}
.mt-btn-view:hover{border-color:var(--primary);color:var(--primary)}
.mt-card .mt-btn-start,.mt-card .mt-btn-view{width:100%;justify-content:center}
.mt-score-circle{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.82rem;font-weight:800;flex-shrink:0;align-self:center}

.mtg-grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
@media(max-width:820px){.mtg-grid2{grid-template-columns:1fr}}
.mtg-card{
    position:relative;isolation:isolate;
    border:1px solid color-mix(in srgb,#fff 30%,var(--border));
    border-radius:16px;overflow:hidden;display:flex;flex-direction:column;
    box-shadow:0 8px 24px rgba(0,0,0,.08);
    animation:mt-in .3s ease
}
.mtg-card::before{
    content:'';position:absolute;inset:-30%;z-index:0;opacity:.75;filter:blur(14px);
    background:linear-gradient(135deg,#0f172a 0%,#1e40af 45%,#C9A227 100%)
}
.mtg-frost{
    position:absolute;inset:0;z-index:1;
    background:color-mix(in srgb,var(--bg-surface) 30%,transparent);
    backdrop-filter:blur(24px) saturate(220%);
    -webkit-backdrop-filter:blur(24px) saturate(220%)
}
.mtg-head{
    position:relative;z-index:2;
    background-image:linear-gradient(180deg,rgba(15,23,42,.55) 0%,rgba(15,23,42,.15) 100%);
    border-bottom:1px solid rgba(255,255,255,.14);
}
.mtg-head .mt-card-banner-wrap{margin:0}
.mtg-head-row{padding:20px 22px;display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
.mtg-head-main{min-width:0}
.mtg-head-title{font-size:1.1rem;font-weight:800;color:#fff}
.mtg-head-desc{font-size:.82rem;color:rgba(255,255,255,.85);margin-top:4px;max-width:640px}
.mtg-head-badge{display:inline-flex;align-items:center;gap:5px;margin-top:10px;font-size:.68rem;font-weight:700;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,.18);color:#fff}
.mtg-head-side{display:flex;align-items:center;gap:12px;flex-shrink:0}
.mtg-head-progress{font-size:.78rem;font-weight:700;color:#fff;background:rgba(255,255,255,.18);padding:3px 10px;border-radius:20px;white-space:nowrap}
.mtg-toggle-btn{width:30px;height:30px;border-radius:9px;border:1.5px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s;flex-shrink:0}
.mtg-toggle-btn:hover{background:rgba(255,255,255,.25)}
.mtg-rows{position:relative;z-index:2;display:flex;flex-direction:column;background:var(--bg-surface)}
.mtg-row{display:flex;align-items:center;gap:14px;padding:14px 18px;border-bottom:1px solid var(--border);transition:background .15s}
.mtg-rows .mtg-row:last-child{border-bottom:none}
.mtg-row:hover{background:var(--bg-hover)}
.mtg-row.locked{opacity:.55}
.mtg-row-idx{width:28px;height:28px;border-radius:50%;background:var(--bg-raised);border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:800;color:var(--text-secondary);flex-shrink:0}
.mtg-row-idx.done{background:rgba(16,185,129,.18);border:2px solid #fff;color:#10b981;font-size:.95rem;box-shadow:0 0 0 1px #10b981}
.mtg-row-info{flex:1;min-width:0}
.mtg-row .mt-card-meta{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
.mtg-row .mt-card-meta::-webkit-scrollbar{display:none}
.mtg-row .mt-card-meta .mt-badge{flex-shrink:0;white-space:nowrap;font-size:.66rem;padding:2px 8px}
.mtg-row-title{font-weight:700;font-size:.9rem;color:var(--text-primary);margin-bottom:5px}

.mt-empty{display:flex;flex-direction:column;align-items:center;padding:5rem 2rem;text-align:center}
.mt-empty-ico{font-size:3.5rem;margin-bottom:1rem;opacity:.3}
.mt-empty-head{font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:.4rem}
.mt-empty-txt{font-size:.85rem;color:var(--text-muted)}
</style>

<div class="mt-page">
    ${fromExpert ? '' : `<div class="mt-hero">
        <div class="mt-hero-inner">
            <div class="mt-hero-icon"><i class="fa-solid fa-bullseye"></i></div>
            <div>
                <h1 class="mt-hero-title">Мої тести</h1>
                <p class="mt-hero-sub">Призначені тести та ваша історія проходжень</p>
            </div>
        </div>
    </div>`}

    ${!fromExpert ? `<div class="mt-tabs">
        <button class="mt-tab${this._tab==='pending'?' active':''}" onclick="MyTestsPage._switchTab('pending',this)">
            <i class="fa-solid fa-clipboard-list"></i> Призначені
            <span class="mt-ep-count">${assignments.filter(a=>!completedTestIds.has(a.test_id)).length}</span>
        </button>
        <button class="mt-tab${this._tab==='history'?' active':''}" onclick="MyTestsPage._switchTab('history',this)">
            <i class="fa-solid fa-trophy"></i> Пройдені
            <span class="mt-ep-count">${attempts.length}</span>
        </button>
    </div>` : ''}

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

    _toggleGroupCard(groupId) {
        this._groupCollapsed = this._groupCollapsed || {};
        const wasCollapsed = this._groupCollapsed[groupId] !== false; // за замовчуванням згорнуто (undefined === згорнуто)
        const collapsed = !wasCollapsed;
        this._groupCollapsed[groupId] = collapsed;
        const rows = document.getElementById(`mtg-rows-${groupId}`);
        if (rows) rows.style.display = collapsed ? 'none' : '';
        const chev = document.getElementById(`mtg-chev-${groupId}`);
        if (chev) chev.className = `fa-solid fa-chevron-${collapsed ? 'down' : 'up'}`;
    },

    _lockedNotice(prevTitle) {
        const msg = prevTitle
            ? `Спочатку пройдіть тест «${Fmt.esc(prevTitle)}»`
            : 'Спочатку пройдіть попередній тест за порядком';
        Toast.warning('Тест заблоковано', msg);
    },

    _attemptsLeftForTest(test) {
        if (!test.max_attempts) return null;
        const used = (this._attempts || []).filter(a => a.test_id === test.id).length;
        return test.max_attempts - used;
    },

    _pendingHtml(assignments, completedTestIds) {
        const passedTestIds = this._passedTestIds || new Set();
        const groupsMap = new Map();
        const ungrouped = [];
        for (const a of assignments) {
            if (a.group_id && a.group) {
                if (!groupsMap.has(a.group_id)) groupsMap.set(a.group_id, { group: a.group, items: [] });
                groupsMap.get(a.group_id).items.push(a);
            } else {
                ungrouped.push(a);
            }
        }

        const groupEntries = [...groupsMap.values()].map(g => {
            g.items.sort((x, y) => (x._order ?? 0) - (y._order ?? 0));
            g.done = g.items.every(a => completedTestIds.has(a.test_id));
            g.earliest = g.items.map(a => a.deadline_at).filter(Boolean).sort()[0] || null;
            return g;
        }).filter(g => !g.done);

        const pendingUngrouped = ungrouped.filter(a => !completedTestIds.has(a.test_id));

        if (!groupEntries.length && !pendingUngrouped.length) return `
<div class="mt-empty">
    <div class="mt-empty-ico"><i class="fa-solid fa-clipboard-list"></i></div>
    <div class="mt-empty-head">${assignments.length ? 'Всі тести пройдено!' : 'Немає призначених тестів'}</div>
    <div class="mt-empty-txt">${assignments.length ? 'Результати зберігаються у вкладці «Пройдені»' : 'Коли керівник призначить вам тест — він з\'явиться тут'}</div>
</div>`;

        const sortedGroups = groupEntries.sort((a,b) => {
            if (a.earliest && b.earliest) return new Date(a.earliest) - new Date(b.earliest);
            if (a.earliest) return -1;
            if (b.earliest) return 1;
            return 0;
        });

        const sorted = [...pendingUngrouped].sort((a,b) => {
            if (a.deadline_at && b.deadline_at) return new Date(a.deadline_at) - new Date(b.deadline_at);
            if (a.deadline_at) return -1;
            if (b.deadline_at) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        const groupsHtml = sortedGroups.length ? `
<div class="mt-section">
    <div class="mt-section-head"><i class="fa-solid fa-layer-group"></i> Групи тестів</div>
    <div class="mtg-grid2">${sortedGroups.map(g => this._groupCardHtml(g, completedTestIds, passedTestIds)).join('')}</div>
</div>` : '';

        const listHtml = sorted.length ? `
<div class="mt-section${sortedGroups.length ? ' mt-section-sep' : ''}">
    ${sortedGroups.length ? `<div class="mt-section-head"><i class="fa-solid fa-file-pen"></i> Окремі тести</div>` : ''}
    <div class="mt-list">${sorted.map(a => {
            const test = a.test;
            if (!test) return '';
            const isOverdue = a.deadline_at && new Date(a.deadline_at) < new Date();
            const qCount    = test.questions?.length || 0;
            let deadlineTxt = '';
            if (a.deadline_at) {
                const cd = Fmt.countdown(a.deadline_at);
                deadlineTxt = `<span class="mt-badge ${cd.expired || cd.urgent ? 'mt-badge-overdue' : 'mt-badge-info'}">${cd.html}</span>`;
            }
            const glow = isOverdue ? ['#ef4444','#dc2626'] : ['#f59e0b','#f97316'];
            return `
<div class="mt-card" style="--mt-glow:${glow[0]};--mt-glow2:${glow[1]}">
    <div class="mt-card-frost"></div>
    <div class="mt-card-bar ${isOverdue ? 'overdue' : 'pending'}"></div>
    <div class="mt-card-body">
        ${test.cover_image ? `<div class="mt-card-banner-wrap">
            <div class="mt-card-banner-glow" style="background-image:url('${Fmt.esc(test.cover_image)}')"></div>
            <img class="mt-card-banner${test.stretch_cover_image ? ' stretch' : ''}" src="${Fmt.esc(test.cover_image)}" alt="">
        </div>` : ''}
        <div class="mt-card-info">
            <div class="mt-card-title">${Fmt.esc(test.title)}</div>
            <div class="mt-card-meta">
                <span class="mt-badge mt-badge-info"><i class="fa-solid fa-question"></i> ${qCount} питань</span>
                ${test.time_limit_minutes ? `<span class="mt-badge mt-badge-info"><i class="fa-regular fa-clock"></i> ${test.time_limit_minutes} хв</span>` : ''}
                <span class="mt-badge mt-badge-info"><i class="fa-solid fa-bullseye"></i> ${test.passing_score||70}% прохідний</span>
                ${deadlineTxt}
            </div>
        </div>
        <button class="mt-btn-start" onclick="Router.go('tests/${test.id}?from=expert-path')">Пройти тест</button>
    </div>
</div>`;
        }).join('')}</div>
</div>` : '';

        return groupsHtml + listHtml;
    },

    _groupCardHtml(g, completedTestIds, passedTestIds) {
        const group = g.group;
        const items = g.items;
        const passedN  = items.filter(a => passedTestIds.has(a.test_id)).length;
        const collapsed = this._groupCollapsed?.[group.id] !== false;
        return `
<div class="mtg-card">
    <div class="mtg-frost"></div>
    <div class="mtg-head" onclick="MyTestsPage._toggleGroupCard('${group.id}')" style="cursor:pointer">
        ${group.cover_image ? `<div class="mt-card-banner-wrap">
            <div class="mt-card-banner-glow" style="background-image:url('${Fmt.esc(group.cover_image)}')"></div>
            <img class="mt-card-banner${group.stretch_cover_image ? ' stretch' : ''}" src="${Fmt.esc(group.cover_image)}" alt="">
        </div>` : ''}
        <div class="mtg-head-row">
            <div class="mtg-head-main">
                <div class="mtg-head-title">${Fmt.esc(group.title)}</div>
                ${group.description ? `<div class="mtg-head-desc">${Fmt.esc(group.description)}</div>` : ''}
                <span class="mtg-head-badge"><i class="fa-solid ${group.is_sequential ? 'fa-arrow-down-1-9' : 'fa-shuffle'}"></i> ${group.is_sequential ? 'Послідовне проходження' : 'У будь-якому порядку'}</span>
            </div>
            <div class="mtg-head-side">
                <span class="mtg-head-progress">${passedN}/${items.length}</span>
                <button type="button" class="mtg-toggle-btn" aria-label="Згорнути/розгорнути" onclick="event.stopPropagation(); MyTestsPage._toggleGroupCard('${group.id}')">
                    <i class="fa-solid fa-chevron-${collapsed ? 'down' : 'up'}" id="mtg-chev-${group.id}"></i>
                </button>
            </div>
        </div>
    </div>
    <div class="mtg-rows" id="mtg-rows-${group.id}" style="${collapsed ? 'display:none' : ''}">
        ${items.map((a, i) => {
            const test = a.test;
            if (!test) return '';
            const passed  = passedTestIds.has(a.test_id);
            const done    = completedTestIds.has(a.test_id);
            const locked  = group.is_sequential && i > 0 && !passedTestIds.has(items[i-1].test_id);
            const qCount  = test.questions?.length || 0;
            const attemptsLeft   = this._attemptsLeftForTest(test);
            const noMoreAttempts = attemptsLeft !== null && attemptsLeft <= 0;
            let statusHtml;
            if (passed) statusHtml = `<span class="mt-badge mt-badge-done"><i class="fa-solid fa-check"></i> Зараховано</span>`;
            else if (done) statusHtml = `<span class="mt-badge mt-badge-fail"><i class="fa-solid fa-xmark"></i> Не зараховано</span>`;
            else if (locked) statusHtml = `<span class="mt-badge mt-badge-info"><i class="fa-solid fa-lock"></i> Заблоковано</span>`;
            const isResult = done && noMoreAttempts;
            const btnLabel = isResult ? 'Результат' : (done && !passed ? 'Спробувати ще' : 'Пройти тест');
            const btnClass = isResult ? (passed ? ' mt-btn-result-pass' : ' mt-btn-result-fail') : '';
            return `
<div class="mtg-row${locked ? ' locked' : ''}">
    <span class="mtg-row-idx${passed ? ' done' : ''}">${passed ? '<i class="fa-solid fa-check"></i>' : (i + 1)}</span>
    <div class="mtg-row-info">
        <div class="mtg-row-title">${Fmt.esc(test.title)}</div>
        <div class="mt-card-meta">
            <span class="mt-badge mt-badge-info"><i class="fa-solid fa-question"></i> ${qCount} питань</span>
            ${test.time_limit_minutes ? `<span class="mt-badge mt-badge-info"><i class="fa-regular fa-clock"></i> ${test.time_limit_minutes} хв</span>` : ''}
            ${statusHtml || ''}
        </div>
    </div>
    ${locked
        ? `<button class="mt-btn-start mt-btn-locked" data-prev="${Fmt.esc(items[i-1].test?.title || '')}" onclick="MyTestsPage._lockedNotice(this.dataset.prev)"><i class="fa-solid fa-lock"></i></button>`
        : `<button class="mt-btn-start${btnClass}" onclick="Router.go('tests/${test.id}?from=expert-path')">${btnLabel}</button>`}
</div>`;
        }).join('')}
    </div>
</div>`;
    },

    _historyHtml(attempts) {
        if (!attempts.length) return `
<div class="mt-empty">
    <div class="mt-empty-ico"><i class="fa-solid fa-trophy"></i></div>
    <div class="mt-empty-head">Ви ще не проходили тестів</div>
    <div class="mt-empty-txt">Результати пройдених тестів будуть відображатись тут</div>
</div>`;

        return `<div class="mt-list">${attempts.map(a => {
            const pct  = Math.round(a.percentage || 0);
            const glow = a.needs_review ? ['#f59e0b','#d97706'] : a.passed ? ['#10b981','#059669'] : ['#ef4444','#dc2626'];
            return `
<div class="mt-card" style="--mt-glow:${glow[0]};--mt-glow2:${glow[1]}">
    <div class="mt-card-frost"></div>
    <div class="mt-card-bar ${a.needs_review ? '' : a.passed ? 'done' : 'overdue'}" style="${a.needs_review ? 'background:#f59e0b' : ''}"></div>
    <div class="mt-card-body">
        <div class="mt-card-info">
            <div class="mt-card-title">${a.test?.title || 'Тест'}</div>
            <div class="mt-card-meta">
                <span class="mt-badge mt-badge-info">${Fmt.datetime(a.completed_at)}</span>
                ${a.time_spent_seconds ? `<span class="mt-badge mt-badge-info"><i class="fa-regular fa-clock"></i> ${Math.floor(a.time_spent_seconds/60)} хв</span>` : ''}
                ${a.needs_review
                    ? `<span class="mt-badge" style="background:rgba(245,158,11,.14);color:#f59e0b"><i class="fa-solid fa-hourglass-half"></i> На перевірці</span>`
                    : `<span class="mt-badge ${a.passed ? 'mt-badge-done' : 'mt-badge-fail'}">${a.passed ? '<i class="fa-solid fa-check"></i> Зараховано' : '<i class="fa-solid fa-xmark"></i> Не зараховано'}</span>`}
            </div>
        </div>
        <div class="mt-score-circle" style="background:${a.needs_review?'rgba(245,158,11,.12)':a.passed?'rgba(16,185,129,.12)':'rgba(239,68,68,.1)'};color:${a.needs_review?'#f59e0b':a.passed?'#10b981':'#ef4444'}">
            ${a.needs_review ? '—' : pct + '%'}
        </div>
        <button class="mt-btn-view" onclick="Router.go('tests/${a.test_id}${this._fromExpert ? '?from=expert-path' : ''}')">Деталі</button>
    </div>
</div>`;
        }).join('')}</div>`;
    }
};
