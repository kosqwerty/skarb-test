// ================================================================
// EduFlow LMS — Обмеження доступу по мітках
// Access: owner, admin
//
// SQL (run once in Supabase):
// CREATE TABLE IF NOT EXISTS label_restrictions (
//     id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     label      text NOT NULL,
//     section    text NOT NULL,
//     created_by uuid REFERENCES auth.users(id),
//     created_at timestamptz DEFAULT now(),
//     UNIQUE(label, section)
// );
// ALTER TABLE label_restrictions ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "lr_select" ON label_restrictions FOR SELECT USING (true);
// CREATE POLICY "lr_insert" ON label_restrictions FOR INSERT
//     WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin')));
// CREATE POLICY "lr_delete" ON label_restrictions FOR DELETE
//     USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner','admin')));
// ================================================================

// ── Sections that can be restricted ──────────────────────────────
const RESTRICTION_SECTIONS = [
    { route: 'contacts',        label: 'Контакти',      icon: '👥' },
    { route: 'news',            label: 'Новини',         icon: '📰' },
    { route: 'knowledge-base',  label: 'База знань',     icon: '📚' },
    { route: 'resources',       label: 'Ресурси',        icon: '📂' },
    { route: 'collections',     label: 'Меню порталу',   icon: '🖥' },
    { route: 'analytics',       label: 'Аналітика',      icon: '📊' },
    { route: 'bookmarks',       label: 'Закладки',       icon: '⭐' },
    { route: 'results',         label: 'Результати',     icon: '🏆' },
];

// ── Global access restriction manager ────────────────────────────
const AccessRestrictions = {
    _rules: [],

    async load() {
        try {
            const { data, error } = await supabase
                .from('label_restrictions')
                .select('label, section');
            this._rules = (!error && data) ? data : [];
        } catch {
            this._rules = [];
        }
    },

    isRestricted(label, route) {
        if (!label) return false;
        return this._rules.some(r => r.label === label && r.section === route);
    },

    canAccess(route) {
        const profile = AppState.profile;
        if (!profile?.label) return true;
        if (['owner', 'admin', 'manager', 'smm', 'teacher'].includes(profile.role)) return true;
        return !this.isRestricted(profile.label, route);
    },

    // Remove restricted nav items from already-rendered DOM
    applyToNav() {
        document.querySelectorAll('.nav-item[data-route]').forEach(el => {
            const route = el.dataset.route;
            if (!this.canAccess(route)) el.style.display = 'none';
        });
    }
};

// ── Admin page ────────────────────────────────────────────────────
const LabelAccessPage = {
    _labels:   [],
    _rules:    [],

    async init(container) {
        if (!AppState.isOwner() && !AppState.isAdmin?.()) {
            Toast.error('Заборонено');
            Router.go('dashboard');
            return;
        }
        UI.setBreadcrumb([
            { label: 'Адміністрування', route: 'admin' },
            { label: 'Обмеження доступу' }
        ]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        await this._loadData();
        this._render(container);
    },

    async _loadData() {
        const [labelsRes, rulesRes] = await Promise.all([
            supabase.from('profiles').select('label').not('label', 'is', null).neq('label', ''),
            supabase.from('label_restrictions').select('*')
        ]);
        const raw = (labelsRes.data || []).map(r => r.label);
        this._labels = [...new Set(raw)].sort();
        this._rules  = rulesRes.data || [];
    },

    _render(container) {
        if (!this._labels.length) {
            container.innerHTML = `
<div class="la-page">
    ${this._header()}
    <div class="empty-state" style="margin-top:2rem">
        <div class="empty-icon">🏷</div>
        <h3>Мітки не знайдено</h3>
        <p>Призначте мітки користувачам в розділі «Адміністрування»</p>
    </div>
</div>`;
            return;
        }

        container.innerHTML = `
<div class="la-page">
    ${this._header()}

    <div class="la-hint">
        <span>🔒</span> — розділ <strong>заблоковано</strong> для мітки &nbsp;·&nbsp;
        <span>✓</span> — розділ <strong>доступний</strong> &nbsp;·&nbsp;
        Натисніть комірку щоб змінити
    </div>

    <div class="la-wrap">
        <table class="la-table">
            <thead>
                <tr>
                    <th class="la-th-label">Мітка</th>
                    ${RESTRICTION_SECTIONS.map(s => `
                        <th class="la-th-section" title="${s.label}">
                            <span>${s.icon}</span>
                            <span>${s.label}</span>
                        </th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${this._labels.map(label => this._rowHtml(label)).join('')}
            </tbody>
        </table>
    </div>
</div>

<style>
.la-page { max-width:1200px;animation:fadeSlideUp .3s cubic-bezier(.16,1,.3,1); }
.la-hero {
    border-radius:24px;padding:32px 28px;margin-bottom:24px;
    background:linear-gradient(135deg,#1e1b4b 0%,#312e81 50%,#4c1d95 100%);
    position:relative;overflow:hidden;
}
.la-hero::before {
    content:'';position:absolute;inset:0;
    background:radial-gradient(ellipse 70% 80% at 90% 50%,rgba(139,92,246,.25),transparent);
}
.la-hero-inner { position:relative;display:flex;align-items:center;gap:20px; }
.la-hero-ico {
    width:60px;height:60px;border-radius:18px;flex-shrink:0;
    background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.25);
    display:flex;align-items:center;justify-content:center;font-size:1.8rem;
}
.la-hero-title { margin:0;font-size:1.6rem;font-weight:800;color:#fff;letter-spacing:-.02em; }
.la-hero-sub   { margin:4px 0 0;color:rgba(255,255,255,.65);font-size:.875rem; }

.la-hint {
    padding:10px 16px;border-radius:12px;
    background:var(--bg-raised);border:1px solid var(--border);
    font-size:.82rem;color:var(--text-muted);margin-bottom:20px;
    display:flex;align-items:center;gap:6px;flex-wrap:wrap;
}

.la-wrap { overflow-x:auto;border-radius:18px;border:1px solid var(--border);background:var(--bg-surface); }
.la-table { width:100%;border-collapse:collapse;min-width:700px; }

.la-th-label {
    text-align:left;padding:14px 20px;
    font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;
    color:var(--text-muted);border-bottom:1px solid var(--border);
    background:var(--bg-raised);position:sticky;left:0;z-index:2;
    white-space:nowrap;min-width:140px;
}
.la-th-section {
    padding:10px 8px;text-align:center;
    font-size:.72rem;font-weight:600;color:var(--text-muted);
    border-bottom:1px solid var(--border);background:var(--bg-raised);
    white-space:nowrap;min-width:90px;
}
.la-th-section span { display:block;text-align:center; }
.la-th-section span:first-child { font-size:1.1rem;margin-bottom:2px; }

.la-label-cell {
    padding:14px 20px;
    font-weight:600;font-size:.875rem;color:var(--text-primary);
    border-bottom:1px solid var(--border);
    background:var(--bg-raised);
    position:sticky;left:0;z-index:1;
    white-space:nowrap;
}
.la-label-pill {
    display:inline-flex;align-items:center;gap:6px;
    padding:4px 12px;border-radius:40px;
    background:rgba(245,158,11,.1);color:#f59e0b;
    border:1px solid rgba(245,158,11,.25);font-size:.82rem;font-weight:600;
}

.la-cell {
    padding:10px 8px;text-align:center;
    border-bottom:1px solid var(--border);
    border-left:1px solid var(--border-light, rgba(255,255,255,.05));
}
.la-toggle {
    width:44px;height:44px;border-radius:12px;
    border:2px solid var(--border);
    background:transparent;
    cursor:pointer;font-size:1rem;font-weight:700;
    display:inline-flex;align-items:center;justify-content:center;
    transition:all .18s;
}
.la-toggle.open   { border-color:rgba(16,185,129,.4);color:#10b981;background:rgba(16,185,129,.08); }
.la-toggle.locked { border-color:rgba(239,68,68,.4); color:#ef4444;background:rgba(239,68,68,.08); }
.la-toggle.open:hover   { border-color:#10b981;background:rgba(16,185,129,.18); }
.la-toggle.locked:hover { border-color:#ef4444;background:rgba(239,68,68,.18); }
.la-toggle.loading { opacity:.5;pointer-events:none; }

tr:last-child .la-label-cell,
tr:last-child .la-cell { border-bottom:none; }
tr:hover .la-label-cell,
tr:hover .la-cell { background:var(--bg-hover); }
tr:hover .la-label-cell { background:var(--bg-raised); }

@media(max-width:700px){ .la-hero { padding:22px 18px; } }
</style>`;
    },

    _header() {
        return `
<div class="la-hero">
    <div class="la-hero-inner">
        <div class="la-hero-ico">🔒</div>
        <div>
            <h1 class="la-hero-title">Обмеження доступу</h1>
            <p class="la-hero-sub">Налаштуйте доступ до розділів для кожної мітки користувача</p>
        </div>
    </div>
</div>`;
    },

    _rowHtml(label) {
        const cells = RESTRICTION_SECTIONS.map(s => {
            const restricted = this._rules.some(r => r.label === label && r.section === s.route);
            return `
            <td class="la-cell">
                <button class="la-toggle ${restricted ? 'locked' : 'open'}"
                    title="${restricted ? 'Заблоковано — клік щоб відкрити' : 'Доступно — клік щоб заблокувати'}"
                    onclick="LabelAccessPage._toggle('${label}','${s.route}',this)">
                    ${restricted ? '🔒' : '✓'}
                </button>
            </td>`;
        }).join('');

        return `
        <tr>
            <td class="la-label-cell">
                <span class="la-label-pill">🏷 ${label}</span>
            </td>
            ${cells}
        </tr>`;
    },

    async _toggle(label, section, btn) {
        const isLocked = btn.classList.contains('locked');
        btn.classList.add('loading');
        try {
            if (isLocked) {
                await supabase.from('label_restrictions')
                    .delete()
                    .eq('label', label)
                    .eq('section', section);
                this._rules = this._rules.filter(r => !(r.label === label && r.section === section));
                btn.className = 'la-toggle open';
                btn.textContent = '✓';
                btn.title = 'Доступно — клік щоб заблокувати';
            } else {
                const { data, error } = await supabase.from('label_restrictions')
                    .insert({ label, section, created_by: AppState.user.id })
                    .select()
                    .single();
                if (error) throw error;
                this._rules.push(data);
                btn.className = 'la-toggle locked';
                btn.textContent = '🔒';
                btn.title = 'Заблоковано — клік щоб відкрити';
            }
            // Sync global state
            AccessRestrictions._rules = this._rules.map(r => ({ label: r.label, section: r.section }));
        } catch (e) {
            Toast.error('Помилка', e.message);
            btn.classList.remove('loading');
        }
    }
};
