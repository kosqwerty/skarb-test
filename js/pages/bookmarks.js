// ================================================================
// EduFlow LMS — Закладки
// Access: all authenticated users
//
// SQL (run once in Supabase):
// CREATE TABLE IF NOT EXISTS bookmarks (
//     id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
//     type       text NOT NULL DEFAULT 'resource', -- 'resource'|'news'|'collection'
//     title      text NOT NULL,
//     icon       text DEFAULT '📌',
//     route      text NOT NULL,
//     subtitle   text,
//     created_at timestamptz DEFAULT now(),
//     UNIQUE(user_id, route)
// );
// ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "bookmarks_own" ON bookmarks
//     USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
// ================================================================

// ── Global bookmark state manager ────────────────────────────────
const Bookmarks = {
    _items: [],

    async load() {
        if (!AppState.user?.id) return;
        try {
            const { data, error } = await supabase
                .from('bookmarks')
                .select('*')
                .eq('user_id', AppState.user.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            this._items = data || [];
        } catch {
            this._items = [];
        }
        this._updateAllStars();
    },

    isBookmarked(route) {
        return this._items.some(b => b.route === route);
    },

    get(route) {
        return this._items.find(b => b.route === route);
    },

    async add(item) {
        const { data, error } = await supabase
            .from('bookmarks')
            .insert({ user_id: AppState.user.id, ...item })
            .select()
            .single();
        if (error) throw error;
        this._items.unshift(data);
        this._updateAllStars();
    },

    async remove(route) {
        const bm = this.get(route);
        if (!bm) return;
        const { error } = await supabase
            .from('bookmarks')
            .delete()
            .eq('id', bm.id);
        if (error) throw error;
        this._items = this._items.filter(b => b.id !== bm.id);
        this._updateAllStars();
    },

    async toggle(item) {
        if (this.isBookmarked(item.route)) {
            await this.remove(item.route);
            return false;
        } else {
            await this.add(item);
            return true;
        }
    },

    async toggleResource(id, title, icon, category) {
        try {
            const added = await this.toggle({
                type: 'resource', route: `resource/${id}`,
                title, icon, subtitle: category || 'Ресурс'
            });
            Toast[added ? 'success' : 'info'](added ? 'Додано до закладок' : 'Закладку видалено', title);
        } catch (e) { Toast.error('Помилка', e.message); }
    },

    async toggleNews(id, title, category) {
        try {
            const added = await this.toggle({
                type: 'news', route: `news/${id}`,
                title, icon: '📰', subtitle: category || 'Новина'
            });
            Toast[added ? 'success' : 'info'](added ? 'Додано до закладок' : 'Закладку видалено', title);
        } catch (e) { Toast.error('Помилка', e.message); }
    },

    async toggleCollection(id, title) {
        try {
            const added = await this.toggle({
                type: 'collection', route: `collections/${id}`,
                title, icon: '🖥', subtitle: 'Меню порталу'
            });
            Toast[added ? 'success' : 'info'](added ? 'Додано до закладок' : 'Закладку видалено', title);
        } catch (e) { Toast.error('Помилка', e.message); }
    },

    _updateAllStars() {
        document.querySelectorAll('[data-bm-route]').forEach(btn => {
            const route = btn.dataset.bmRoute;
            const active = this.isBookmarked(route);
            btn.classList.toggle('active', active);
            btn.title = active ? 'Видалити з закладок' : 'Зберегти в закладки';
        });
    }
};

// ── Page renderer ─────────────────────────────────────────────────
const BookmarksPage = {
    _filter: 'all',

    async init(container) {
        UI.setBreadcrumb([{ label: 'Закладки' }]);
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        await Bookmarks.load();
        this._filter = 'all';
        this._render(container);
    },

    _render(container) {
        const all = Bookmarks._items;
        container.innerHTML = `
<div class="bm-page">

    <div class="bm-hero">
        <div class="bm-hero-glow"></div>
        <div class="bm-hero-inner">
            <div class="bm-hero-icon">⭐</div>
            <div>
                <h1 class="bm-hero-title">Мої закладки</h1>
                <p class="bm-hero-sub" id="bm-hero-sub">${all.length} ${this._plural(all.length)}</p>
            </div>
        </div>
    </div>

    <div class="bm-filters" id="bm-filters">
        ${this._filterChips(all)}
    </div>

    <div class="bm-grid" id="bm-grid">
        ${this._gridHtml(all)}
    </div>

</div>

<style>
.bm-page { max-width:1200px;animation:bm-in .35s cubic-bezier(.16,1,.3,1); }
@keyframes bm-in { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }

.bm-hero {
    position:relative;overflow:hidden;border-radius:28px;
    padding:38px 36px;margin-bottom:24px;
    background:linear-gradient(135deg,var(--primary) 0%,var(--secondary,#8b5cf6) 100%);
}
.bm-hero-glow {
    position:absolute;inset:0;
    background:radial-gradient(ellipse 80% 60% at 20% 50%,rgba(255,255,255,.12),transparent),
               radial-gradient(ellipse 60% 80% at 80% 20%,rgba(255,255,255,.08),transparent);
}
.bm-hero-inner { position:relative;display:flex;align-items:center;gap:22px; }
.bm-hero-icon {
    width:68px;height:68px;border-radius:22px;flex-shrink:0;
    background:rgba(255,255,255,.18);backdrop-filter:blur(12px);
    border:1.5px solid rgba(255,255,255,.3);
    display:flex;align-items:center;justify-content:center;font-size:2.2rem;
}
.bm-hero-title { margin:0;font-size:2rem;font-weight:800;color:#fff;letter-spacing:-.025em; }
.bm-hero-sub   { margin:5px 0 0;color:rgba(255,255,255,.75);font-size:.95rem; }

.bm-filters { display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px; }
.bm-chip {
    display:flex;align-items:center;gap:7px;
    padding:8px 18px;border-radius:40px;
    border:1.5px solid var(--border);background:var(--bg-surface);
    color:var(--text-secondary);font-size:.85rem;font-weight:500;
    cursor:pointer;transition:all .15s;
}
.bm-chip:hover { border-color:var(--primary);color:var(--primary); }
.bm-chip.active { background:var(--primary);border-color:var(--primary);color:#fff; }
.bm-chip-cnt {
    padding:1px 8px;border-radius:40px;font-size:.73rem;font-weight:700;
    background:rgba(255,255,255,.25);
}
.bm-chip:not(.active) .bm-chip-cnt { background:var(--bg-raised);color:var(--text-muted); }

.bm-grid {
    display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));
    gap:16px;
}

.bm-card {
    background:var(--bg-surface);border:1px solid var(--border);border-radius:22px;
    padding:0;display:flex;flex-direction:column;overflow:hidden;
    transition:box-shadow .2s,border-color .2s,transform .2s;cursor:pointer;
}
.bm-card:hover { box-shadow:var(--shadow-lg);border-color:var(--border-light);transform:translateY(-3px); }

.bm-card-accent { height:4px;width:100%;flex-shrink:0; }
.bm-card.tp-resource   .bm-card-accent { background:linear-gradient(90deg,#f59e0b,#f97316); }
.bm-card.tp-news       .bm-card-accent { background:linear-gradient(90deg,#10b981,#06b6d4); }
.bm-card.tp-collection .bm-card-accent { background:linear-gradient(90deg,var(--primary),var(--secondary,#8b5cf6)); }

.bm-card-body { padding:20px;display:flex;gap:14px;flex:1; }
.bm-card-ico {
    width:50px;height:50px;border-radius:15px;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;font-size:1.5rem;
}
.bm-card.tp-resource   .bm-card-ico { background:rgba(245,158,11,.12); }
.bm-card.tp-news       .bm-card-ico { background:rgba(16,185,129,.1); }
.bm-card.tp-collection .bm-card-ico { background:var(--primary-glow); }

.bm-card-text { flex:1;min-width:0; }
.bm-card-title {
    font-weight:700;font-size:.97rem;color:var(--text-primary);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px;
}
.bm-card-sub { font-size:.8rem;color:var(--text-muted);line-height:1.4;margin-bottom:8px; }
.bm-badge {
    display:inline-flex;align-items:center;gap:4px;
    padding:2px 10px;border-radius:40px;font-size:.72rem;font-weight:600;
}
.bm-card.tp-resource   .bm-badge { background:rgba(245,158,11,.12);color:#f59e0b; }
.bm-card.tp-news       .bm-badge { background:rgba(16,185,129,.12);color:#10b981; }
.bm-card.tp-collection .bm-badge { background:var(--primary-glow);color:var(--primary); }

.bm-card-footer {
    padding:12px 20px;border-top:1px solid var(--border);
    display:flex;align-items:center;justify-content:space-between;gap:8px;
    background:var(--bg-raised);
}
.bm-go {
    display:flex;align-items:center;gap:6px;
    padding:7px 16px;border-radius:10px;
    border:1.5px solid var(--border);background:var(--bg-surface);
    color:var(--text-secondary);font-size:.82rem;font-weight:500;
    cursor:pointer;transition:all .15s;
}
.bm-go:hover { border-color:var(--primary);color:var(--primary);background:var(--primary-glow); }
.bm-del {
    width:34px;height:34px;border-radius:10px;
    border:1.5px solid var(--border);background:transparent;
    color:var(--text-muted);display:flex;align-items:center;justify-content:center;
    cursor:pointer;transition:all .15s;font-size:.9rem;
}
.bm-del:hover { border-color:var(--danger);color:var(--danger);background:rgba(239,68,68,.08); }

.bm-empty {
    grid-column:1/-1;display:flex;flex-direction:column;align-items:center;
    padding:5rem 2rem;text-align:center;
}
.bm-empty-ico  { font-size:4rem;margin-bottom:1rem;opacity:.45; }
.bm-empty-head { font-size:1.25rem;font-weight:700;color:var(--text-primary);margin-bottom:.5rem; }
.bm-empty-txt  { font-size:.875rem;color:var(--text-muted);max-width:380px;line-height:1.6; }

@media(max-width:600px) {
    .bm-hero { padding:26px 20px; }
    .bm-hero-icon { width:52px;height:52px;font-size:1.6rem; }
    .bm-hero-title { font-size:1.5rem; }
}
</style>`;
    },

    _filterChips(all) {
        const types = [
            { f: 'all',        label: 'Всі',       icon: '⭐' },
            { f: 'resource',   label: 'Ресурси',   icon: '📎' },
            { f: 'news',       label: 'Новини',    icon: '📰' },
            { f: 'collection', label: 'Портал',    icon: '🖥' }
        ];
        return types.map(t => {
            const cnt = t.f === 'all' ? all.length : all.filter(b => b.type === t.f).length;
            return `<button class="bm-chip${t.f === this._filter ? ' active' : ''}" onclick="BookmarksPage._setFilter('${t.f}',this)">
                ${t.icon} ${t.label} <span class="bm-chip-cnt">${cnt}</span>
            </button>`;
        }).join('');
    },

    _gridHtml(items) {
        if (!items.length) return `
            <div class="bm-empty">
                <div class="bm-empty-ico">⭐</div>
                <div class="bm-empty-head">Закладок поки немає</div>
                <div class="bm-empty-txt">Натисніть ★ на ресурсі, новині або сторінці порталу, щоб зберегти тут</div>
            </div>`;
        return items.map(b => this._cardHtml(b)).join('');
    },

    _cardHtml(b) {
        const labels = { resource: '📎 Ресурс', news: '📰 Новина', collection: '🖥 Портал' };
        return `
<div class="bm-card tp-${b.type}" onclick="Router.go('${b.route}')">
    <div class="bm-card-accent"></div>
    <div class="bm-card-body">
        <div class="bm-card-ico">${b.icon || '📌'}</div>
        <div class="bm-card-text">
            <div class="bm-card-title">${b.title}</div>
            ${b.subtitle ? `<div class="bm-card-sub">${b.subtitle}</div>` : ''}
            <span class="bm-badge">${labels[b.type] || b.type}</span>
        </div>
    </div>
    <div class="bm-card-footer" onclick="event.stopPropagation()">
        <button class="bm-go" onclick="Router.go('${b.route}')">Перейти →</button>
        <button class="bm-del" title="Видалити" onclick="BookmarksPage._remove('${b.route}')">🗑</button>
    </div>
</div>`;
    },

    _setFilter(filter, btn) {
        this._filter = filter;
        document.querySelectorAll('.bm-chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const items = filter === 'all'
            ? Bookmarks._items
            : Bookmarks._items.filter(b => b.type === filter);
        document.getElementById('bm-grid').innerHTML = this._gridHtml(items);
    },

    async _remove(route) {
        await Bookmarks.remove(route);
        Toast.info('Закладку видалено');
        const all = Bookmarks._items;
        const items = this._filter === 'all' ? all : all.filter(b => b.type === this._filter);
        document.getElementById('bm-grid').innerHTML   = this._gridHtml(items);
        document.getElementById('bm-filters').innerHTML = this._filterChips(all);
        const sub = document.getElementById('bm-hero-sub');
        if (sub) sub.textContent = `${all.length} ${this._plural(all.length)}`;
    },

    _plural(n) {
        if (n % 10 === 1 && n % 100 !== 11) return 'збережений елемент';
        if (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) return 'збережені елементи';
        return 'збережених елементів';
    }
};
