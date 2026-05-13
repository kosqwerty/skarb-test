// ================================================================
// EduFlow LMS — News / Portal Page
// ================================================================

const NewsPage = {
    _page: 0,

    async init(container, params) {
        // Single article view
        if (params.id) {
            await this._viewArticle(container, params.id);
            return;
        }

        UI.setBreadcrumb([{ label: 'Новини' }]);
        this._page = 0;

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">
                    <h1>📰 Новини та оголошення</h1>
                    <p>Останні події</p>
                </div>
                <div class="page-actions" style="display:flex;align-items:center;gap:.75rem">
                    <input type="text" id="news-search" placeholder="Пошук..." style="width:200px"
                           onkeyup="NewsPage.onSearch(event)">
                    ${AppState.isStaff() ? `<button class="btn btn-primary" onclick="NewsPage.openCreate()"><i class="fa-solid fa-plus"></i> Додати новину</button>` : ''}
                </div>
            </div>

            <div id="featured-news" style="margin-bottom:2rem"></div>

            <div id="news-grid" class="news-grid"></div>
            <div id="news-pagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:2rem"></div>`;

        await this.load();
        if (params.create) this.openCreate();
    },
    
    onSearch(e) {
        this._search = e.target.value;
        clearTimeout(this._searchTimer);
        this._searchTimer = setTimeout(() => this.load(), 350);
    },

    async load() {
        const grid = document.getElementById('news-grid');
        if (!grid) return;
        grid.innerHTML = `<div style="grid-column:1/-1;display:flex;justify-content:center;padding:2rem"><div class="spinner"></div></div>`;

        try {
            const { data, count } = await API.news.getAll({ published: !AppState.isStaff() || undefined, page: this._page });

            // Access group filter for non-staff
            const filtered = AppState.isStaff()
                ? data
                : data.filter(n => !n.access_group || AccessGroupsPage.checkAccess(n.access_group));

            // Featured news (is_featured)
            const featured = filtered.filter(n => n.is_featured).slice(0, 1)[0];
            if (featured) this._renderFeatured(featured);

            const regular = filtered.filter(n => !n.is_featured || filtered.indexOf(n) > 0);

            if (!regular.length && !featured) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column:1/-1">
                        <div class="empty-icon">📰</div>
                        <h3>Скоро буде новина</h3>
                        ${AppState.isStaff() ? `<button class="btn btn-primary" onclick="NewsPage.openCreate()">Додати першуш новину</button>` : ''}
                    </div>`;
                return;
            }

            grid.innerHTML = regular.map(n => this._renderCard(n)).join('');
            this._renderPagination(count);
            const reactIds = regular.filter(n => n.allow_reactions !== false).map(n => n.id);
            if (reactIds.length) this._loadCardReactions(reactIds);
        } catch(e) {
            grid.innerHTML = `<div style="grid-column:1/-1;color:var(--danger)">${e.message}</div>`;
        }
    },

    _renderFeatured(news) {
        const el = document.getElementById('featured-news');
        if (!el) return;
        const excerpt = Fmt.esc((news.excerpt || '').replace(/<[^>]+>/g, '').slice(0, 220)).replace(/\n/g, '<br>');

        el.innerHTML = `
            <div onclick="Router.go('news/${news.slug || news.id}')" class="featured-card" style="
                position:relative;height:420px;border-radius:var(--radius-xl);overflow:hidden;
                max-width:1300px;
                cursor:pointer;background:#0f0c29;border:1px solid var(--border);transition:border-color var(--transition)"
                onmouseenter="this.style.borderColor='var(--primary)'" onmouseleave="this.style.borderColor='var(--border)'">
                ${news.thumbnail_url ? `
                    <div style="position:absolute;inset:0;background-image:url('${news.thumbnail_url}');background-size:contain;background-repeat:no-repeat;background-position:${news.thumbnail_position || 'center'} center;z-index:1"></div>
                    <div style="position:absolute;inset:-20px;background-image:url('${news.thumbnail_url}');background-size:cover;background-position:${news.thumbnail_position || 'center'} center;filter:blur(18px) brightness(.45) saturate(1.2);transform:scale(1.05);z-index:0"></div>
                ` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1e1b4b,#312e81);z-index:1"><i class="fa-regular fa-newspaper" style="font-size:5rem;color:rgba(255,255,255,.15)"></i></div>`}
                <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(0,0,0,.75) 0%,rgba(0,0,0,.3) 45%,transparent 100%);z-index:2"></div>
                <div style="position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;justify-content:space-between;padding:1.75rem 2.5rem;max-width:55%">
                    <!-- top -->
                    <div>
                        <span style="color:#fbbf24;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;display:block;margin-bottom:.55rem">
                            <i class="fa-solid fa-star"></i> Головна новина
                        </span>
                        <h2 style="margin:0;line-height:1.3;color:#fff;font-size:1.5rem;text-shadow:0 2px 8px rgba(0,0,0,.4)">${Fmt.esc(news.title)}</h2>
                        ${excerpt ? `<p style="color:rgba(255,255,255,.75);font-size:.88rem;line-height:1.65;margin:.65rem 0 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${excerpt}</p>` : ''}
                    </div>
                    <!-- bottom -->
                    <span style="font-size:.78rem;color:rgba(255,255,255,.55)">
                        <i class="fa-regular fa-user" style="margin-right:.3rem"></i>${Fmt.esc(news.author?.full_name || '—')}<br>
                        <i class="fa-regular fa-calendar" style="margin-right:.3rem"></i>${Fmt.date(news.published_at || news.created_at)}
                    </span>
                </div>
                <!-- читати — правий нижній кут -->
                <span class="btn btn-primary btn-sm" style="position:absolute;bottom:1.75rem;right:2rem;z-index:3;flex-shrink:0"><i class="fa-solid fa-eye"></i> Читати</span>
                </div>
            </div>`;
    },

    _renderCard(news) {
        const excerpt = Fmt.esc((news.excerpt || '').replace(/<[^>]+>/g, '').slice(0, 120)).replace(/\n/g, '<br>');
        const thumb = news.thumbnail_url;
        return `
            <div class="news-card" onclick="Router.go('news/${news.slug || news.id}')">
                <div class="news-thumb" style="position:relative;overflow:hidden;background:#0f0c29">
                    ${thumb ? `
                        <div style="position:absolute;inset:-10px;background-image:url('${thumb}');background-size:cover;background-position:${news.thumbnail_position || 'center'} center;filter:blur(14px) brightness(.4) saturate(1.2);transform:scale(1.05)"></div>
                        <div style="position:absolute;inset:0;background-image:url('${thumb}');background-size:contain;background-repeat:no-repeat;background-position:${news.thumbnail_position || 'center'} center;z-index:1"></div>
                    ` : `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.08));font-size:3rem">📰</div>`}
                    ${!news.is_published ? '<span class="badge badge-muted" style="position:absolute;top:.5rem;left:.5rem;z-index:2">Чернетка</span>' : ''}
                    ${AppState.isStaff() ? `
                        <div class="news-card-actions" onclick="event.stopPropagation()">
                            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();NewsPage.openEdit('${news.id}')" title="Редагувати"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();NewsPage.deleteNews('${news.id}',${JSON.stringify(news.title||'').replace(/"/g,'&quot;')})" title="Видалити"><i class="fa-solid fa-trash"></i></button>
                        </div>` : ''}
                </div>
                <div class="news-body">
                    <h4 class="news-title">${Fmt.esc(news.title)}</h4>
                    <p class="news-excerpt">${excerpt}</p>
                </div>
                <div class="news-footer">
                    <span style="display:flex;align-items:center;gap:.35rem;font-size:.78rem;color:var(--text-muted)">
                        <i class="fa-regular fa-calendar"></i>${Fmt.date(news.published_at || news.created_at, { day:'numeric', month:'short' })}
                    </span>
                    <div style="display:flex;align-items:center;gap:.4rem" onclick="event.stopPropagation()">
                        <button class="kb-star res-star-btn${Bookmarks.isBookmarked('news/'+news.id) ? ' active' : ''}"
                            data-bm-route="news/${news.id}"
                            title="${Bookmarks.isBookmarked('news/'+news.id) ? 'Видалити з закладок' : 'Зберегти в закладки'}"
                            onclick="event.stopPropagation();Bookmarks.toggleNews('${news.id}',${JSON.stringify(news.title||'').replace(/"/g,'&quot;')},'')">
                            ${Bookmarks.isBookmarked('news/'+news.id) ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>'}
                        </button>
                        ${news.allow_reactions !== false ? `
                            <button id="cr-up-${news.id}" class="nv-react-btn" onclick="event.stopPropagation();NewsPage._reactCard('${news.id}','up')" style="font-size:.8rem;padding:.3rem .7rem">
                                👍 <span id="cu-${news.id}" class="nv-react-count">0</span>
                            </button>
                            <button id="cr-dn-${news.id}" class="nv-react-btn" onclick="event.stopPropagation();NewsPage._reactCard('${news.id}','down')" style="font-size:.8rem;padding:.3rem .7rem">
                                👎 <span id="cd-${news.id}" class="nv-react-count">0</span>
                            </button>` : ''}
                    </div>
                </div>
            </div>`;
    },

    _renderPagination(total) {
        const el    = document.getElementById('news-pagination');
        const pages = Math.ceil(total / 12);
        if (!el || pages <= 1) { if (el) el.innerHTML = ''; return; }
        el.innerHTML = Array.from({ length: pages }, (_, i) => `
            <button class="btn ${i === this._page ? 'btn-primary' : 'btn-ghost'} btn-sm"
                    onclick="NewsPage._page=${i};NewsPage.load()">${i + 1}</button>
        `).join('');
    },

    // ── Article View ──────────────────────────────────────────────
    async _viewArticle(container, id) {
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        try {
            const news = await API.news.getById(id);
            const { data: latest } = await supabase.from('news')
                    .select('id,slug,title,thumbnail_url,published_at,created_at')
                    .eq('is_published', true)
                    .neq('id', news.id)
                    .order('published_at', { ascending: false, nullsFirst: false })
                    .limit(3);

            UI.setBreadcrumb([{ label: 'Новини', route: 'news' }, { label: news.title }]);

            container.innerHTML = `
                <style>
                    .nv-top{display:grid;grid-template-columns:1fr 280px;gap:1.5rem;align-items:start;margin-bottom:2rem}
                    .nv-hero{position:relative;width:100%;height:420px;border-radius:var(--radius-xl);overflow:hidden;background:#0f0c29}
                    .nv-hero-bg{position:absolute;inset:-20px;background-size:cover;background-position:center;filter:blur(18px) brightness(.45) saturate(1.2);transform:scale(1.05)}
                    .nv-hero img{position:relative;width:100%;height:100%;object-fit:contain;display:block;z-index:1}
                    .nv-hero-ph{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1e1b4b,#312e81);z-index:1}
                    .nv-hero-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.72) 0%,rgba(0,0,0,.15) 40%,transparent 100%);z-index:2}
                    .nv-hero-content{position:absolute;bottom:0;left:0;right:0;padding:1.75rem 2rem;z-index:3}
                    .nv-hero-badges{display:flex;gap:.5rem;margin-bottom:.65rem;flex-wrap:wrap}
                    .nv-hero-title{font-size:2rem;font-weight:800;color:#fff;line-height:1.25;margin:0;text-shadow:0 2px 12px rgba(0,0,0,.4)}
                    .nv-hero-meta{display:flex;align-items:center;gap:1.25rem;margin-top:.65rem;color:rgba(255,255,255,.75);font-size:.82rem}
                    .nv-hero-actions{position:absolute;top:1rem;left:1rem;display:flex;gap:.5rem;z-index:3}
                    .nv-article{min-width:0;display:grid;grid-template-columns:1fr 280px;gap:1.5rem;column-gap:1.5rem}
                    .nv-article-body{min-width:0}
                    .nv-excerpt{font-size:1.1rem;color:var(--text-secondary);font-style:italic;border-left:3px solid var(--primary);padding-left:1rem;margin-bottom:2rem;line-height:1.7}
                    .nv-reactions{display:flex;align-items:center;gap:.75rem;padding:1.25rem 1.5rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);margin-top:2.5rem}
                    .nv-react-label{font-size:.82rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-right:.25rem}
                    .nv-sidebar{position:sticky;top:1rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);overflow:hidden}
                    .nv-sidebar-head{padding:.75rem 1rem;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--primary);border-bottom:1px solid var(--border);background:rgba(99,102,241,.05)}
                    .nv-sidebar-body{padding:.5rem}
                    .nv-staff-actions{padding:.75rem 1rem;border-top:1px solid var(--border);display:flex;gap:.5rem}
                    .nv-recent-item{display:flex;gap:.75rem;padding:.65rem .5rem;border-radius:var(--radius-md);cursor:pointer;transition:all var(--transition)}
                    .nv-recent-item:hover{background:var(--bg-raised)}
                    .nv-recent-thumb{width:60px;height:44px;border-radius:var(--radius-sm);overflow:hidden;flex-shrink:0;background:var(--bg-raised)}
                    .nv-recent-thumb img{width:100%;height:100%;object-fit:cover;display:block}
                    .nv-recent-title{font-size:.83rem;font-weight:600;line-height:1.4;color:var(--text-primary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
                    .nv-recent-date{font-size:.73rem;color:var(--text-muted);margin-top:.2rem}
                    @media(max-width:900px){.nv-top,.nv-article{grid-template-columns:1fr}.nv-sidebar{position:static}.nv-hero{height:260px}.nv-hero-title{font-size:1.5rem}.nv-hero-content{padding:1.25rem}}
                </style>

                <!-- ── Top: Hero + Sidebar ── -->
                <div class="nv-top">

                    <!-- Hero -->
                    <div class="nv-hero">
                        ${news.thumbnail_url
                            ? `<div class="nv-hero-bg" style="background-image:url('${news.thumbnail_url}');background-position:${news.thumbnail_position || 'center'} center"></div>
                               <img src="${news.thumbnail_url}" alt="${Fmt.esc(news.title)}" style="object-position:${news.thumbnail_position || 'center'} center">`
                            : `<div class="nv-hero-ph"><i class="fa-regular fa-newspaper" style="font-size:5rem;color:rgba(255,255,255,.15)"></i></div>`}
                        <div class="nv-hero-overlay"></div>
                        <div class="nv-hero-content">
                            <div class="nv-hero-badges">
                                ${news.is_featured ? '<span class="badge badge-warning"><i class="fa-solid fa-star"></i> Головна</span>' : ''}
                                ${!news.is_published ? '<span class="badge badge-muted">Чернетка</span>' : ''}
                            </div>
                            <h1 class="nv-hero-title">${Fmt.esc(news.title)}</h1>
                            <div class="nv-hero-meta">
                                <span><i class="fa-regular fa-calendar" style="margin-right:.35rem"></i>${Fmt.date(news.published_at || news.created_at)}</span>
                                <span><i class="fa-regular fa-user" style="margin-right:.35rem"></i>${Fmt.esc(news.author?.full_name || '—')}</span>
                                ${news.views ? `<span><i class="fa-regular fa-eye" style="margin-right:.35rem"></i>${news.views}</span>` : ''}
                            </div>
                        </div>
                        ${news.allow_reactions !== false ? `
                        <div style="position:absolute;bottom:1.75rem;right:2rem;display:flex;align-items:center;gap:.6rem;z-index:3">
                            <button id="btn-react-up" class="nv-react-btn" onclick="NewsPage._react('${news.id}','up')" style="background:rgba(0,0,0,.35);border-color:rgba(255,255,255,.2);color:#fff;backdrop-filter:blur(6px)">
                                <span id="react-up-label">Подобається </span>👍 <span id="react-up-count" class="nv-react-count">—</span>
                            </button>
                            <button id="btn-react-down" class="nv-react-btn" onclick="NewsPage._react('${news.id}','down')" style="background:rgba(0,0,0,.35);border-color:rgba(255,255,255,.2);color:#fff;backdrop-filter:blur(6px)">
                                <span id="react-down-label">Ну таке… </span>👎 <span id="react-down-count" class="nv-react-count">—</span>
                            </button>
                        </div>` : ''}
                        <div class="nv-hero-actions">
                            <button class="btn btn-ghost btn-sm" onclick="Router.go('news')" style="backdrop-filter:blur(6px);background:rgba(0,0,0,.35);border-color:rgba(255,255,255,.2);color:#fff">
                                <i class="fa-solid fa-angle-left"></i> Назад
                            </button>
                        </div>
                        ${AppState.isStaff() ? `
                        <div style="position:absolute;top:1rem;right:1rem;display:flex;gap:.5rem;z-index:3">
                            <button class="btn btn-secondary btn-sm" onclick="NewsPage.openEdit('${news.id}')" style="backdrop-filter:blur(6px);background:rgba(0,0,0,.35);border-color:rgba(255,255,255,.2);color:#fff"><i class="fa-solid fa-pen"></i> Редагувати</button>
                            <button class="btn btn-danger btn-sm" onclick="NewsPage.deleteNews('${news.id}',${JSON.stringify(news.title||'').replace(/"/g,'&quot;')})" style="backdrop-filter:blur(6px)"><i class="fa-solid fa-trash"></i></button>
                        </div>` : ''}
                    </div>

                    <!-- Sidebar -->
                    <aside class="nv-sidebar">
                        <div class="nv-sidebar-head">Читайте також</div>
                        <div class="nv-sidebar-body">
                            ${(latest || []).map(n => `
                                <div class="nv-recent-item" onclick="Router.go('news/${n.slug || n.id}')">
                                    <div class="nv-recent-thumb">
                                        ${n.thumbnail_url
                                            ? `<img src="${n.thumbnail_url}" loading="lazy">`
                                            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.5rem">📰</div>`}
                                    </div>
                                    <div>
                                        <div class="nv-recent-title">${Fmt.esc(n.title)}</div>
                                        <div class="nv-recent-date">${Fmt.date(n.published_at || n.created_at, { day:'numeric', month:'short' })}</div>
                                    </div>
                                </div>`).join('')}
                            ${!latest?.length ? `<p style="font-size:.82rem;color:var(--text-muted);padding:.5rem">Немає інших новин</p>` : ''}
                        </div>
                        <div style="padding:.6rem .75rem;border-top:1px solid var(--border)">
                            <button class="btn btn-ghost btn-sm" style="width:100%" onclick="Router.go('news')">Всі новини →</button>
                        </div>
                    </aside>
                </div>

                <!-- ── Article body ── -->
                <article class="nv-article">
                    <div class="nv-article-body">
                        <div class="news-content-body">${this._fixImgUrls(news.content)}</div>
                    </div>
                </article>`;

            if (news.allow_reactions !== false) this._loadReactions(news.id);
        } catch(e) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Новину не знайдено</h3><button class="btn btn-primary" onclick="Router.go('news')" style="display:inline-flex;align-items:center;gap:.35rem"><i class="fa-solid fa-angle-left"></i> Назад</button></div>`;
        }
    },

    async _loadCardReactions(ids) {
        try {
            const [{ data: all }, { data: mine }] = await Promise.all([
                supabase.from('news_reactions').select('news_id,type').in('news_id', ids),
                supabase.from('news_reactions').select('news_id,type').in('news_id', ids).eq('user_id', AppState.user.id)
            ]);
            for (const id of ids) {
                const upEl  = document.getElementById(`cu-${id}`);
                const dnEl  = document.getElementById(`cd-${id}`);
                const upBtn = document.getElementById(`cr-up-${id}`);
                const dnBtn = document.getElementById(`cr-dn-${id}`);
                if (!upEl) continue;
                const up   = all?.filter(r => r.news_id === id && r.type === 'up').length  || 0;
                const down = all?.filter(r => r.news_id === id && r.type === 'down').length || 0;
                const myR  = mine?.find(r => r.news_id === id)?.type || null;
                upEl.textContent = up;
                dnEl.textContent = down;
                upBtn.classList.toggle('active-up',   myR === 'up');
                dnBtn.classList.toggle('active-down', myR === 'down');
                if (myR) {
                    upBtn.onclick = null; upBtn.style.cursor = 'default';
                    dnBtn.onclick = null; dnBtn.style.cursor = 'default';
                }
            }
        } catch { /* ігноруємо якщо таблиці ще немає */ }
    },

    async _reactCard(newsId, type) {
        try {
            await API.news.react(newsId, type);
            await this._loadCardReactions([newsId]);
        } catch(e) { Toast.error('Помилка', e.message); }
    },

    async _loadReactions(newsId) {
        try {
            const { up, down, mine } = await API.news.getReactions(newsId);
            const upEl    = document.getElementById('react-up-count');
            const downEl  = document.getElementById('react-down-count');
            const upBtn   = document.getElementById('btn-react-up');
            const dnBtn   = document.getElementById('btn-react-down');
            const upLabel = document.getElementById('react-up-label');
            const dnLabel = document.getElementById('react-down-label');
            if (!upEl) return;
            upEl.textContent   = up || 0;
            downEl.textContent = down || 0;
            upBtn.classList.toggle('active-up',   mine === 'up');
            dnBtn.classList.toggle('active-down', mine === 'down');
            // After vote: hide text labels, lock buttons
            if (mine) {
                if (upLabel)  upLabel.style.display = 'none';
                if (dnLabel)  dnLabel.style.display = 'none';
                upBtn.onclick = null;
                dnBtn.onclick = null;
                upBtn.style.cursor = 'default';
                dnBtn.style.cursor = 'default';
            }
        } catch { /* ігноруємо якщо таблиці ще немає */ }
    },

    async _react(newsId, type) {
        try {
            await API.news.react(newsId, type);
            await this._loadReactions(newsId);
        } catch(e) {
            Toast.error('Помилка', e.message);
        }
    },

    // ── Create / Edit ──────────────────────────────────────────────
    async _backToList() {
        const container = document.getElementById('page-content');
        if (container) await this.init(container, {});
        else Router.go('news');
    },

    openCreate() {
        this._openForm(null);
    },

    async openEdit(id) {
        Loader.show();
        try {
            const news = await API.news.getById(id);
            this._openForm(news);
        } finally { Loader.hide(); }
    },

    _accessGroups: [],

    _openForm(news) {
        // Destroy previous Quill instance before wiping the DOM
        if (this._quill) {
            if (this._resizeAbort) { this._resizeAbort.abort(); this._resizeAbort = null; }
            this._quill = null;
        }
        this._htmlMode = false;
        const isEdit = !!news?.id;
        const pubDateVal = news?.published_at
            ? new Date(news.published_at).toISOString().slice(0,16)
            : new Date().toISOString().slice(0,16);
        const expDateVal = news?.expires_at
            ? new Date(news.expires_at).toISOString().slice(0,16)
            : '';

        UI.setBreadcrumb([
            { label: 'Новини', onClick: () => NewsPage._backToList() },
            { label: isEdit ? 'Редагувати' : 'Нова новина' }
        ]);

        const container = document.getElementById('page-content');
        container.innerHTML = `
            <style>
                .nf-layout{display:grid;grid-template-columns:1fr 280px;gap:1.5rem;align-items:start}
                .nf-main{display:flex;flex-direction:column;gap:1rem}
                .nf-sidebar{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;position:sticky;top:1rem}
                .nf-sidebar-title{padding:.65rem 1rem;font-size:.8rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--primary);border-bottom:1px solid var(--border);background:rgba(99,102,241,.06);text-align:center}
                .nf-sidebar-body{padding:1rem;display:flex;flex-direction:column;gap:1rem}
                .nf-field{display:flex;flex-direction:column;gap:.35rem}
                .nf-field label{font-size:.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em}
                .nf-sep{height:1px;background:var(--border);margin:.25rem 0}
                .nf-img-preview{border-radius:var(--radius-md);overflow:hidden;max-height:140px}
                .nf-img-preview img{width:100%;height:140px;object-fit:cover;object-position:center center;display:block}
                .nf-img-change{text-align:center;margin-top:.5rem}
                .nf-date{font-size:.82rem;padding:.45rem .6rem;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-raised);color:var(--text-primary);width:100%;outline:none;transition:border-color var(--transition);cursor:pointer;font-family:inherit}
                .nf-date:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(99,102,241,.12)}
                .nf-date::-webkit-calendar-picker-indicator{opacity:.5;cursor:pointer;filter:var(--icon-filter,none)}
                .nf-title-input{background:transparent;border:none;border-bottom:2px solid var(--border);padding:.5rem 0;font-size:1.4rem;font-weight:600;color:var(--text-primary);width:100%;outline:none;transition:border-color var(--transition);font-family:inherit}
                .nf-title-input:focus{border-bottom-color:var(--primary)}
                .nf-title-input::placeholder{color:var(--text-muted)}
                .nf-editor-wrap{display:grid;grid-template-columns:1fr 200px;border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden}
                .nf-editor-left{display:flex;flex-direction:column;border-right:1px solid var(--border);min-width:0}
                .nf-quill-wrap{flex:1;display:flex;flex-direction:column}
                .nf-quill-wrap .ql-toolbar{border:none;border-bottom:1px solid var(--border);background:var(--bg-raised);flex-shrink:0}
                .nf-quill-wrap .ql-container{border:none;flex:1;font-size:1rem;font-family:inherit;min-height:440px}
                .nf-quill-wrap .ql-editor{min-height:440px;line-height:1.8;color:var(--text-primary);padding:1rem 1.25rem}
                .nf-quill-wrap .ql-editor.ql-blank::before{color:var(--text-muted);font-style:normal}
                .nf-html-toggle{display:flex;align-items:center;gap:.5rem;background:var(--bg-raised);border-top:1px solid var(--border);padding:.3rem .75rem;flex-shrink:0}
                .nf-media-panel{background:var(--bg-raised);display:flex;flex-direction:column;min-width:0}
                .nf-media-bar{display:flex;flex-direction:column;gap:.4rem;padding:.6rem .75rem;border-bottom:1px solid var(--border)}
                .nf-media-bar-title{font-size:.78rem;font-weight:600;color:var(--text-secondary)}
                .nf-media-grid{display:flex;flex-wrap:wrap;gap:.4rem;padding:.6rem;flex:1;overflow-y:auto;align-content:flex-start}
                .nf-media-thumb{width:72px;height:54px;border-radius:var(--radius-sm);overflow:hidden;border:2px solid transparent;cursor:pointer;flex-shrink:0;background:var(--bg-surface);transition:border-color var(--transition)}
                .nf-media-thumb:hover{border-color:var(--primary)}
                .nf-media-thumb img{width:100%;height:100%;object-fit:contain;display:block}
                .nf-media-file{width:72px;height:54px;border-radius:var(--radius-sm);border:2px solid transparent;cursor:pointer;flex-shrink:0;background:var(--bg-surface);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.2rem;transition:border-color var(--transition);padding:.2rem}
                .nf-media-file:hover{border-color:var(--primary)}
                .nf-media-file span{font-size:.55rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;text-align:center}
                @media(max-width:768px){.nf-layout{grid-template-columns:1fr}}
            </style>

            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.5rem">
                
                <h2 style="margin:0">${isEdit ? '<i class="fa-solid fa-pen"></i> Редагувати новину' : 'Додати новину'}</h2>
                <div style="display:flex;gap:.75rem;padding-top:.5rem">
                        <button class="btn btn-secondary" onclick="NewsPage._backToList()">Скасувати</button>
                        <button class="btn btn-ghost" onclick="NewsPage._previewNews()"><i class="fa-solid fa-eye"></i> Перегляд</button>
                        <button class="btn btn-primary" onclick="NewsPage.saveNews('${news?.id || ''}')">
                            ${isEdit ? '<i class="fa-solid fa-floppy-disk" style="font-size:1rem;filter:drop-shadow(0 0 4px rgba(99,102,241,.7))"></i> Зберегти зміни' : '<i class="fa-regular fa-newspaper" style="color:#1e40af"></i> Опублікувати'}
                        </button>
                    </div>
            </div>

            <div class="nf-layout">

                <!-- ── Ліва колонка ── -->
                <div class="nf-main">
                    <div class="nf-field">
                        <label>Тема *</label>
                        <input id="n-title" class="nf-title-input" type="text"
                               value="${(news?.title || '').replace(/"/g,'&quot;')}"
                               placeholder="Введіть заголовок новини...">
                    </div>

                    <div class="nf-field">
                        <label><i class="fa-regular fa-image" style="color:var(--primary);margin-right:.3rem"></i>Текст на картинці <span style="font-weight:400;color:var(--text-muted)">(превью)</span></label>
                        <textarea id="n-excerpt" rows="2" maxlength="220" placeholder="Короткий опис — відображається на картці та у герої…" style="resize:vertical;font-size:.9rem;line-height:1.6"
                            oninput="const l=this.value.length;const c=document.getElementById('n-excerpt-count');c.textContent=l+' / 220';c.style.color=l>200?'var(--danger)':l>160?'var(--warning)':'var(--text-muted)'"
                        >${Fmt.esc(news?.excerpt || '')}</textarea>
                        <div style="display:flex;justify-content:space-between;align-items:center">
                            <span style="font-size:.72rem;color:var(--text-muted)">Якщо порожньо — текст не відображається на картці.</span>
                            <span id="n-excerpt-count" style="font-size:.72rem;color:var(--text-muted)">${(news?.excerpt||'').length} / 220</span>
                        </div>
                    </div>

                    <div class="nf-field">
                        <label>Текст *</label>
                        <div class="nf-editor-wrap">
                            <!-- Quill WYSIWYG -->
                            <div class="nf-editor-left">
                                <div class="nf-quill-wrap">
                                    <div id="n-quill-editor"></div>
                                </div>
                                <div class="nf-html-toggle">
                                    <button type="button" class="btn btn-ghost btn-sm" onclick="NewsPage._toggleHtmlMode()" id="n-html-toggle-btn" style="font-size:.75rem">
                                        <i class="fa-solid fa-code"></i> HTML
                                    </button>
                                    <button type="button" class="btn btn-ghost btn-sm" onclick="NewsPage._previewNews()" style="font-size:.75rem">
                                        <i class="fa-solid fa-eye"></i> Перегляд
                                    </button>
                                </div>
                                <textarea id="n-html-src" style="display:none;flex:1;width:100%;min-height:460px;padding:1rem;font-family:monospace;font-size:.82rem;background:var(--bg-raised);color:var(--text-primary);border:none;border-top:1px solid var(--border);outline:none;resize:none;line-height:1.6;tab-size:2;box-sizing:border-box" placeholder="HTML..."></textarea>
                            </div>
                            <!-- Медіатека -->
                            <div class="nf-media-panel" id="n-media-panel">
                                <div class="nf-media-bar">
                                    <div class="nf-media-bar-title"><i class="fa-regular fa-images"></i> Медіатека</div>
                                    <label class="btn btn-ghost btn-sm" style="cursor:pointer;display:flex;align-items:center;gap:.3rem;margin:0;font-size:.78rem;padding:.3rem .5rem">
                                        <i class="fa-solid fa-plus"></i> Додати
                                        <input id="n-attach-input" type="file" accept="image/*" style="display:none" onchange="NewsPage._attachFile(this)">
                                    </label>
                                </div>
                                <div class="nf-media-grid" id="n-media-grid">
                                    <div style="padding:.75rem;color:var(--text-muted);font-size:.78rem">Завантаження...</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    
                </div>

                <!-- ── Права колонка (опції) ── -->
                <div class="nf-sidebar">
                    <div class="nf-sidebar-title">опції</div>
                    <div class="nf-sidebar-body">

                        <div class="nf-field">
                            <label><i class="fa-regular fa-calendar" style="color:var(--primary);margin-right:.3rem"></i>Опубліковано</label>
                            <input id="n-published-at" type="datetime-local" value="${pubDateVal}" class="nf-date">
                        </div>

                        <div class="nf-field">
                            <label><i class="fa-regular fa-calendar-xmark" style="color:var(--text-muted);margin-right:.3rem"></i>Актуально до</label>
                            <input id="n-expires-at" type="datetime-local" value="${expDateVal}" class="nf-date">
                        </div>

                        <div class="nf-sep"></div>

                        <label class="checkbox-item" style="cursor:pointer">
                            <input type="checkbox" id="n-published" ${news?.is_published ? 'checked' : ''}>
                            <span>Опублікувати</span>
                        </label>

                        <label class="checkbox-item" style="cursor:pointer">
                            <input type="checkbox" id="n-reactions" ${news?.allow_reactions !== false ? 'checked' : ''}>
                            <span>Дозволити залишати реакції</span>
                        </label>

                        <label class="checkbox-item" style="cursor:pointer">
                            <input type="checkbox" id="n-featured" ${news?.is_featured ? 'checked' : ''}>
                            <span>Головна новина</span>
                        </label>

                        <div class="nf-sep"></div>

                        <div class="nf-field">
                            <label>Група доступу</label>
                            <select id="n-access-group">
                                <option value="">— Всі (без обмежень) —</option>
                            </select>
                        </div>

                        <div class="nf-sep"></div>

                        <div class="nf-field">
                            <label>Головне зображення</label>
                            <div style="font-size:.7rem;color:var(--text-muted);line-height:1.5;margin-bottom:.4rem">
                                Рекомендований розмір: <strong style="color:var(--text-secondary)">1200 × 630 px</strong><br>
                                Формат: JPG, PNG · до 5 МБ
                            </div>
                            ${news?.thumbnail_url
                                ? `<div class="nf-img-preview"><img id="n-img-preview" src="${news.thumbnail_url}" style="object-fit:cover;object-position:${news.thumbnail_position || 'center'} center"></div>
                                   <div class="nf-img-change"><button class="btn btn-ghost btn-sm" onclick="document.getElementById('n-img-input').click()">Змінити</button></div>`
                                : `<div id="news-img-zone"></div>`}
                            <input id="n-img-input" type="file" accept="image/*" style="display:none"
                                   onchange="NewsPage._onImgChange(this)">
                        </div>

                        <div class="nf-field">
                            <label><i class="fa-solid fa-align-center" style="color:var(--primary);margin-right:.3rem"></i>Позиція зображення</label>
                            <div style="display:flex;gap:.4rem">
                                ${['left','center','right'].map(pos => {
                                    const cur = news?.thumbnail_position || 'center';
                                    const icon = pos === 'left' ? 'fa-align-left' : pos === 'center' ? 'fa-align-center' : 'fa-align-right';
                                    const label = pos === 'left' ? 'Ліво' : pos === 'center' ? 'Центр' : 'Право';
                                    return `<button type="button" id="n-pos-${pos}" onclick="NewsPage._setThumbPos('${pos}')"
                                        class="btn btn-sm ${cur === pos ? 'btn-primary' : 'btn-ghost'}" style="flex:1">
                                        <i class="fa-solid ${icon}"></i> ${label}
                                    </button>`;
                                }).join('')}
                            </div>
                            <input type="hidden" id="n-thumbnail-position" value="${news?.thumbnail_position || 'center'}">
                        </div>

                    </div>
                </div>
            </div>`;

        // Завантажуємо групи доступу
        API.accessGroups.getAll().then(groups => {
            this._accessGroups = groups || [];
            const sel = document.getElementById('n-access-group');
            if (!sel) return;
            sel.innerHTML = `<option value="">— Всі (без обмежень) —</option>` +
                groups.map(g => `<option value="${g.id}" ${news?.access_group_id === g.id ? 'selected' : ''}>${Fmt.esc(g.name)}${g.is_public ? '' : ' 🔐'}</option>`).join('');
        }).catch(() => {});

        // If content has complex HTML that Quill can't represent in its Delta model,
        // open directly in HTML mode to avoid Quill stripping it on normalization
        const rawContent = news?.content || '';
        const isComplexHtml = /position\s*:|overflow\s*:|radial-gradient|linear-gradient.*\(|display\s*:\s*grid|display\s*:\s*flex.*position/i.test(rawContent)
            && /<div/i.test(rawContent);
        this._initQuill(isComplexHtml ? '' : rawContent);
        if (isComplexHtml) {
            this._htmlMode = true;
            const ta  = document.getElementById('n-html-src');
            const qw  = document.querySelector('.nf-quill-wrap');
            const btn = document.getElementById('n-html-toggle-btn');
            if (ta)  { ta.value = rawContent; ta.style.display = 'block'; }
            if (qw)  qw.style.display = 'none';
            if (btn) { btn.classList.add('btn-primary'); btn.classList.remove('btn-ghost'); }
        }

        // Папка медіатеки: для існуючої новини — news-{id}, для нової — draft-{timestamp}
        this._mediaFolder = news?.id ? `news-${news.id}` : `draft-${Date.now().toString(36)}`;
        this._newsImgFile = null;
        this._loadMedia();

        // Дропзона для нового зображення
        const zone = document.getElementById('news-img-zone');
        if (zone) {
            const input = FileUpload.createDropZone(zone, {
                accept: 'image/*',
                label: 'Завантажити зображення',
                hint: 'PNG, JPG до 5 МБ'
            });
            input.addEventListener('change', () => {
                this._newsImgFile = input.files[0];
                this._previewImg(input.files[0]);
            });
        }
        const inp = document.getElementById('n-img-input');
        if (inp) inp.addEventListener('change', () => {
            this._newsImgFile = inp.files[0];
            this._previewImg(inp.files[0]);
        });
    },

    _previewNews() {
        const title   = document.getElementById('n-title')?.value || '(без заголовку)';
        const content = this._getContent();
        if (!content || content === '<p><br></p>') {
            Toast.error('Перегляд', 'Немає вмісту для перегляду');
            return;
        }
        Modal.open({
            title: '<i class="fa-solid fa-eye"></i> Перегляд новини',
            size: 'xl',
            body: `
                <div style="padding:1rem 0">
                    <h1 style="font-size:1.75rem;line-height:1.3;margin-bottom:1.5rem">${title}</h1>
                    <div class="news-content-body">${this._fixImgUrls(content)}</div>
                </div>`,
            footer: `<button class="btn btn-secondary" onclick="Modal.close()">Закрити</button>`
        });
    },

    async _loadMedia() {
        const grid = document.getElementById('n-media-grid');
        if (!grid) return;
        const folder = this._mediaFolder || 'content';
        try {
            const { data, error } = await supabase.storage
                .from(APP_CONFIG.buckets.newsImages)
                .list(`content/${folder}/`, { limit: 200, sortBy: { column: 'name', order: 'desc' } });
            if (error) throw error;
            if (!data?.length) {
                grid.innerHTML = `<div style="padding:.5rem;color:var(--text-muted);font-size:.8rem">Поки немає файлів</div>`;
                return;
            }
            const baseUrl = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.newsImages}/content/${folder}`;
            grid.innerHTML = data.map(f => {
                const url   = `${baseUrl}/${f.name}`;
                const ext   = f.name.split('.').pop().toLowerCase();
                const isImg = /^(jpg|jpeg|png|gif|webp|svg)$/.test(ext);
                const icon  = { pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', zip:'🗜', mp4:'🎬', mp3:'🎵' }[ext] || '📎';
                if (isImg) return `
                    <div class="nf-media-thumb" draggable="true"
                        onclick="NewsPage._insertMediaFile('${url}','${f.name}',true)"
                        ondragstart="NewsPage._draggedImgUrl='${url}'"
                        ondragend="NewsPage._draggedImgUrl=null"
                        title="${f.name}">
                        <img src="${url}" loading="lazy">
                    </div>`;
                return `
                    <div class="nf-media-file" onclick="NewsPage._insertMediaFile('${url}','${f.name}',false)" title="${f.name}">
                        <span style="font-size:1.5rem">${icon}</span>
                        <span>${f.name}</span>
                    </div>`;
            }).join('');
        } catch(e) {
            if (grid) grid.innerHTML = `<div style="padding:.5rem;color:var(--danger);font-size:.8rem">${e.message}</div>`;
        }
    },


    _insertMediaFile(url, name, isImage) {
        if (this._htmlMode) {
            const ta  = document.getElementById('n-html-src');
            if (!ta) return;
            const pos = ta.selectionStart ?? ta.value.length;
            const ins = isImage
                ? `<img src="${url}" alt="${name}" style="max-width:100%">`
                : `<a href="${url}" target="_blank" rel="noopener">${name}</a>`;
            ta.value = ta.value.slice(0, pos) + ins + ta.value.slice(pos);
            ta.selectionStart = ta.selectionEnd = pos + ins.length;
            ta.focus();
            return;
        }
        if (!this._quill) return;
        const range = this._quill.getSelection(true) || { index: this._quill.getLength() };
        if (isImage) {
            this._quill.insertEmbed(range.index, 'image', url);
        } else {
            this._quill.insertText(range.index, name, 'link', url);
        }
        this._quill.setSelection(range.index + 1);
        this._quill.focus();
    },

    async _attachFile(input) {
        const file = input.files[0];
        if (!file) return;
        input.value = '';

        Loader.show();
        try {
            const ext    = file.name.split('.').pop().toLowerCase();
            const name   = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const folder = this._mediaFolder || 'content';
            const path   = `content/${folder}/${name}`;
            const { error } = await supabase.storage
                .from(APP_CONFIG.buckets.newsImages)
                .upload(path, file, { upsert: true });
            if (error) throw error;

            const url     = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.newsImages}/${path}`;
            const isImage = /^(jpg|jpeg|png|gif|webp|svg)$/.test(ext);
            const ta      = document.getElementById('n-html-src');
            const pos     = ta.selectionStart ?? ta.value.length;
            const insert  = isImage
                ? `<img src="${url}" alt="${file.name}" style="max-width:100%">`
                : `<a href="${url}" target="_blank" rel="noopener">${file.name}</a>`;
            ta.value = ta.value.slice(0, pos) + insert + ta.value.slice(pos);
            ta.selectionStart = ta.selectionEnd = pos + insert.length;
            ta.focus();

            Toast.success('Файл завантажено', file.name);
            this._loadMedia();
        } catch(e) {
            Toast.error('Помилка завантаження', e.message);
        } finally { Loader.hide(); }
    },

    // Відносні src="/s3/..." → абсолютні https://...supabase.co/s3/...
    _fixImgUrls(html) {
        if (!html) return html;
        return html.replace(/(<img[^>]+src=")(\/)([^"]+)"/gi, `$1${SUPABASE_URL}/$3"`);
    },

    _quill: null,
    _htmlMode: false,

    _initQuill(content) {
        // Register fonts/sizes once
        if (!NewsPage._quillSetupDone) {
            NewsPage._quillSetupDone = true;
            const FontStyle = Quill.import('attributors/style/font');
            FontStyle.whitelist = ['Arial', 'Georgia', 'Courier New', 'Tahoma', 'Verdana'];
            Quill.register(FontStyle, true);
            const SizeStyle = Quill.import('attributors/style/size');
            SizeStyle.whitelist = ['12px','14px',false,'18px','20px','24px','28px','36px'];
            Quill.register(SizeStyle, true);
        }

        this._quill = new Quill('#n-quill-editor', {
            theme: 'snow',
            placeholder: 'Введіть текст новини...',
            modules: {
                toolbar: {
                    container: [
                        [{ font: ['Arial','Georgia','Courier New','Tahoma','Verdana'] }],
                        [{ size: ['12px','14px',false,'18px','20px','24px','28px','36px'] }],
                        ['bold','italic','underline','strike'],
                        [{ color: [] },{ background: [] }],
                        [{ align: [] }],
                        [{ list: 'ordered'},{ list: 'bullet' }],
                        ['blockquote'],
                        ['link','image'],
                        ['clean'],
                    ],
                    handlers: {
                        image: () => this._quillImageHandler()
                    }
                }
            }
        });

        if (content) setTimeout(() => {
            if (!this._quill) return;
            this._quill.disable();
            this._quill.root.innerHTML = content;
            this._quill.enable();
        }, 0);

        // Image resize + alignment overlay
        if (this._resizeAbort) this._resizeAbort.abort();
        this._resizeAbort = this._initImageResize(this._quill);

        // Paste image
        this._quill.root.addEventListener('paste', async e => {
            const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'));
            if (!item) return;
            e.preventDefault();
            const file = item.getAsFile();
            if (file) await this._quillUploadAndInsert(file);
        });

        // Drag from media grid → drop into editor
        this._quill.root.addEventListener('dragover', e => {
            if (NewsPage._draggedImgUrl) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
        });
        this._quill.root.addEventListener('drop', e => {
            const url = NewsPage._draggedImgUrl;
            if (!url) return;
            e.preventDefault();
            const range = this._quill.getSelection(true) || { index: this._quill.getLength() };
            this._quill.insertEmbed(range.index, 'image', url);
            this._quill.setSelection(range.index + 1);
        });
    },

    _draggedImgUrl: null,

    async _quillImageHandler() {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.onchange = async () => {
            if (input.files[0]) await this._quillUploadAndInsert(input.files[0]);
        };
        input.click();
    },

    async _quillUploadAndInsert(file) {
        Loader.show();
        try {
            const comp = await this._compressImage(file);
            const url  = await API.news.uploadImage(this._mediaFolder, comp);
            const range = this._quill.getSelection(true) || { index: this._quill.getLength() };
            this._quill.insertEmbed(range.index, 'image', url);
            this._quill.setSelection(range.index + 1);
            this._loadMedia();
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    _initImageResize(quill) {
        const ac  = new AbortController();
        const sig = ac.signal;
        let activeImg = null;

        const wrap = quill.root.parentElement;
        wrap.style.position = 'relative';

        const ov = document.createElement('div');
        ov.style.cssText = 'position:absolute;box-sizing:border-box;border:2px solid var(--primary,#6366f1);pointer-events:none;display:none;z-index:5;border-radius:2px';
        const handle = document.createElement('div');
        handle.title = 'Змінити розмір';
        handle.style.cssText = 'position:absolute;bottom:-6px;right:-6px;width:12px;height:12px;background:var(--primary,#6366f1);border:2px solid #fff;border-radius:2px;cursor:se-resize;pointer-events:all';
        ov.appendChild(handle);
        wrap.appendChild(ov);

        const tbar = document.createElement('div');
        tbar.className = 'ql-img-toolbar';
        tbar.innerHTML = [
            ['block',  '<i class="fa-solid fa-expand"></i>',       'Блок (повна ширина)'],
            ['center', '<i class="fa-solid fa-align-center"></i>',  'По центру'],
            ['left',   '<i class="fa-solid fa-align-left"></i>',   'Обтікання ліворуч'],
            ['right',  '<i class="fa-solid fa-align-right"></i>',  'Обтікання праворуч'],
        ].map(([a, ic, t]) => `<button data-align="${a}" title="${t}">${ic}</button>`).join('');
        wrap.appendChild(tbar);

        const hideAll = () => { ov.style.display = 'none'; tbar.style.display = 'none'; activeImg = null; };

        const syncOv = () => {
            if (!activeImg || !quill.root.contains(activeImg)) { hideAll(); return; }
            const ir = activeImg.getBoundingClientRect();
            const wr = wrap.getBoundingClientRect();
            const top = ir.top - wr.top, left = ir.left - wr.left;
            ov.style.cssText += `;top:${top}px;left:${left}px;width:${ir.width}px;height:${ir.height}px;display:block`;
            const tbW = tbar.offsetWidth || 172, tbH = tbar.offsetHeight || 46;
            tbar.style.top  = (top + ir.height / 2 - tbH / 2) + 'px';
            tbar.style.left = Math.max(0, Math.min(left + ir.width / 2 - tbW / 2, wr.width - tbW - 4)) + 'px';
            tbar.style.display = 'flex';
            const fl = activeImg.style.float, centered = !fl && activeImg.style.marginLeft === 'auto';
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
            activeImg = e.target; syncOv();
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
            const startX = e.clientX, startW = activeImg.getBoundingClientRect().width;
            const onMove = ev => { activeImg.style.width = Math.max(40, startW + ev.clientX - startX) + 'px'; activeImg.style.height = 'auto'; syncOv(); };
            const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        }, { signal: sig });

        document.addEventListener('click', e => { if (!wrap.contains(e.target)) hideAll(); }, { signal: sig });

        return ac;
    },

    _compressImage(file, maxWidth = 1400, quality = 0.85) {
        return new Promise(resolve => {
            const img = new Image();
            const obj = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(obj);
                if (img.width <= maxWidth) { resolve(file); return; }
                const scale = maxWidth / img.width;
                const c = document.createElement('canvas');
                c.width = Math.round(img.width * scale);
                c.height = Math.round(img.height * scale);
                c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                c.toBlob(blob => {
                    if (!blob) { resolve(file); return; }
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/,'')+'.jpg', { type:'image/jpeg' }));
                }, 'image/jpeg', quality);
            };
            img.onerror = () => { URL.revokeObjectURL(obj); resolve(file); };
            img.src = obj;
        });
    },

    _toggleHtmlMode() {
        this._htmlMode = !this._htmlMode;
        const ta  = document.getElementById('n-html-src');
        const qw  = document.querySelector('.nf-quill-wrap');
        const btn = document.getElementById('n-html-toggle-btn');
        if (this._htmlMode) {
            // Only overwrite textarea if Quill actually has content typed by the user.
            // If Quill is empty (it stripped complex HTML on load), keep the existing textarea value.
            const quillHtml = this._quill.root.innerHTML;
            const quillEmpty = !quillHtml || quillHtml === '<p><br></p>';
            if (!quillEmpty) ta.value = quillHtml;
            ta.style.display = 'block';
            if (qw) qw.style.display = 'none';
            btn.classList.add('btn-primary');
            btn.classList.remove('btn-ghost');
        } else {
            // Disable Quill's MutationObserver before setting innerHTML to prevent
            // it from normalizing away custom HTML/CSS that it doesn't know about
            this._quill.disable();
            this._quill.root.innerHTML = ta.value;
            this._quill.enable();
            ta.style.display = 'none';
            if (qw) qw.style.display = 'flex';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-ghost');
        }
    },

    _getContent() {
        if (this._htmlMode) return document.getElementById('n-html-src')?.value || '';
        return this._quill ? this._quill.root.innerHTML : '';
    },

    _setThumbPos(pos) {
        document.getElementById('n-thumbnail-position').value = pos;
        ['left','center','right'].forEach(p => {
            const btn = document.getElementById(`n-pos-${p}`);
            if (!btn) return;
            btn.className = `btn btn-sm ${p === pos ? 'btn-primary' : 'btn-ghost'}`;
        });
        const img = document.getElementById('n-img-preview');
        if (img) img.style.objectPosition = `${pos} center`;
    },

    _onImgChange(input) {
        if (!input.files[0]) return;
        this._newsImgFile = input.files[0];
        this._previewImg(input.files[0]);
    },

    _previewImg(file) {
        const reader = new FileReader();
        reader.onload = e => {
            let preview = document.getElementById('n-img-preview');
            if (!preview) {
                const zone = document.getElementById('news-img-zone');
                if (zone) zone.innerHTML =
                    `<div class="nf-img-preview"><img id="n-img-preview" src="${e.target.result}"></div>`;
            } else {
                preview.src = e.target.result;
            }
        };
        reader.readAsDataURL(file);
    },

    async saveNews(id) {
        const title = Dom.val('n-title').trim();
        if (!title) { Toast.error('Помилка', 'Додайте заголовок'); return; }

        const content = this._getContent();
        const contentText = content.replace(/<[^>]+>/g, '').trim();
        if (!content || !contentText) { Toast.error('Помилка', 'Додайте зміст'); return; }


        const isPublished = document.getElementById('n-published').checked;
        const pubAt = Dom.val('n-published-at');
        const expAt = Dom.val('n-expires-at');

        const accessGroupId = Dom.val('n-access-group') || null;

        const excerpt = (document.getElementById('n-excerpt')?.value || '').trim().slice(0, 220) || null;

        const fields = {
            title,
            content,
            excerpt,
            is_published:        isPublished,
            is_featured:         document.getElementById('n-featured').checked,
            allow_reactions:     document.getElementById('n-reactions').checked,
            published_at:        isPublished ? (pubAt ? new Date(pubAt).toISOString() : new Date().toISOString()) : null,
            expires_at:          expAt ? new Date(expAt).toISOString() : null,
            access_group_id:     accessGroupId,
            thumbnail_position:  Dom.val('n-thumbnail-position') || 'center',
        };

        Loader.show();
        try {
            let news;
            if (id) news = await API.news.update(id, fields);
            else    news = await API.news.create(fields);

            if (this._newsImgFile) {
                const imgUrl = await API.news.uploadImage(news.id, this._newsImgFile);
                await API.news.update(news.id, { thumbnail_url: imgUrl });
            }

            AuditLog.write(id ? 'news_update' : 'news_create', 'news', title);
            Toast.success('Успішно!', `Новина "${title}" ${id ? 'оновлена' : 'додана'}`);
            const container = document.getElementById('page-content');
            if (container) await this.init(container, {});
            else Router.go('news');
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    async deleteNews(id, title) {
        const ok = await Modal.confirm({
            title: 'Видалити новину',
            message: `Видалити новину "${title}"?`,
            confirmText: 'Видалити',
            danger: true
        });
        if (!ok) return;
        Loader.show();
        try {
            await API.news.delete(id);
            AuditLog.write('news_delete', 'news', title);
            Toast.success('Новина видалина');
            Router.go('news');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    }
};
