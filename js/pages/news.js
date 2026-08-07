// ================================================================
// EduFlow LMS — News / Portal Page
// ================================================================

const NewsPage = {
    _page: 0,

    // network_visibility: 'all' | 'trusted' | 'untrusted' — задає адмін у
    // формі редагування новини, окремо від групи доступу.
    _matchesNetwork(n) {
        const v = n.network_visibility || 'all';
        if (v === 'all') return true;
        if (v === 'trusted') return !!AppState.isTrustedNetwork;
        if (v === 'untrusted') return !AppState.isTrustedNetwork;
        return true;
    },

    async init(container, params) {
        // Single article view
        if (params.id) {
            await this._viewArticle(container, params.id, params.from);
            return;
        }

        // Скидаємо бейдж новин — користувач зайшов на сторінку
        localStorage.setItem('news_last_seen', new Date().toISOString());
        const newsBadge = document.getElementById('news-bell-badge');
        if (newsBadge) newsBadge.classList.add('hidden');
        const newsBtn = document.getElementById('news-bell');
        if (newsBtn) newsBtn.classList.remove('has-unread');

        UI.setBreadcrumb([{ label: 'Новини' }]);
        this._page = 0;

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">
                    <button class="btn-back" style="margin-bottom:.5rem" onclick="Router.go('dashboard')"><i class="fa-solid fa-arrow-left"></i> Назад</button>
                    <h1>📰 Новини та оголошення</h1>
                    <p>Останні події</p>
                </div>
                <div class="page-actions" style="display:flex;align-items:center;gap:.75rem">
                    ${AppState.isStaff() && AppState.canMutate() ? `<button class="btn btn-primary" onclick="NewsPage.openCreate()"><i class="fa-solid fa-plus"></i> Додати новину</button>` : ''}
                </div>
            </div>

            <div id="featured-news" style="margin-bottom:.75rem"></div>

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
            const byAccessGroup = AppState.isStaff()
                ? data
                : data.filter(n => !n.access_group || AccessGroupsPage.checkAccess(n.access_group));
            // Мережева видимість — окремий вимір від ролі/групи доступу (адмін
            // задає в редагуванні новини), тож застосовується до всіх, включно
            // зі staff, які так само фізично можуть бути поза довіреною мережею.
            const filtered = byAccessGroup.filter(n => this._matchesNetwork(n));

            // Featured news (is_featured)
            const featured = filtered.filter(n => n.is_featured).slice(0, 1)[0];
            if (featured) this._renderFeatured(featured);

            const regular = filtered.filter(n => !n.is_featured || filtered.indexOf(n) > 0);

            if (!regular.length && !featured) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column:1/-1">
                        <div class="empty-icon">📰</div>
                        <h3>Скоро буде новина</h3>
                        ${AppState.isStaff() && AppState.canMutate() ? `<button class="btn btn-primary" onclick="NewsPage.openCreate()">Додати першуш новину</button>` : ''}
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
                max-width:1450px;
                cursor:pointer;background:#0f0c29;border:1px solid var(--border);transition:border-color var(--transition)"
                onmouseenter="this.style.borderColor='var(--primary)'" onmouseleave="this.style.borderColor='var(--border)'">
                ${news.thumbnail_url ? `
                    <div style="position:absolute;inset:0;background-image:url('${news.thumbnail_url}');background-size:contain;background-repeat:no-repeat;background-position:${news.thumbnail_position || 'center'} center;z-index:1"></div>
                    <div style="position:absolute;inset:-20px;background-image:url('${news.thumbnail_url}');background-size:cover;background-position:${news.thumbnail_position || 'center'} center;filter:blur(18px) brightness(.45) saturate(1.2);transform:scale(1.05);z-index:0"></div>
                ` : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1e1b4b,#312e81);z-index:1"><i class="fa-regular fa-newspaper" style="font-size:5rem;color:rgba(255,255,255,.15)"></i></div>`}
                <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(0,0,0,.82) 0%,rgba(0,0,0,.6) 40%,rgba(0,0,0,.15) 60%,transparent 100%);z-index:2"></div>
                <div style="position:absolute;top:0;left:0;bottom:0;width:48%;z-index:3;display:flex;flex-direction:column;justify-content:space-between;padding:1.75rem 2.5rem">
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
                    ${AppState.isStaff() && AppState.canMutate() ? `
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
                    <div style="display:flex;align-items:center;gap:.2rem;flex-wrap:nowrap" onclick="event.stopPropagation()">
                        <button class="kb-star res-star-btn${Bookmarks.isBookmarked('news/'+news.id) ? ' active' : ''}"
                            data-bm-route="news/${news.id}"
                            title="${Bookmarks.isBookmarked('news/'+news.id) ? 'Видалити з закладок' : 'Зберегти в закладки'}"
                            onclick="event.stopPropagation();Bookmarks.toggleNews('${news.id}',${JSON.stringify(news.title||'').replace(/"/g,'&quot;')},'')">
                            ${Bookmarks.isBookmarked('news/'+news.id) ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>'}
                        </button>
                        ${news.allow_reactions !== false ? ['👍','❤️','😂','😮','👏','🔥'].map(e => `
                            <button class="nv-emoji-btn" id="ce-${news.id}-${e.codePointAt(0)}" data-emoji="${e}"
                                onclick="event.stopPropagation();NewsPage._reactEmoji('${news.id}','${e}',this)" title="${e}">
                                ${e}<span class="nv-react-count"></span>
                            </button>`).join('') : ''}
                    </div>
                </div>
            </div>`;
    },

    _renderPagination(total) {
        const el    = document.getElementById('news-pagination');
        const pages = Math.ceil(total / APP_CONFIG.pageSize);
        if (!el || pages <= 1) { if (el) el.innerHTML = ''; return; }
        el.innerHTML = Array.from({ length: pages }, (_, i) => `
            <button class="btn ${i === this._page ? 'btn-primary' : 'btn-ghost'} btn-sm"
                    onclick="NewsPage._page=${i};NewsPage.load()">${i + 1}</button>
        `).join('');
    },

    // ── Article View ──────────────────────────────────────────────
    async _viewArticle(container, id, from) {
        // Скидаємо бейдж при відкритті будь-якої новини
        localStorage.setItem('news_last_seen', new Date().toISOString());
        const newsBadge = document.getElementById('news-bell-badge');
        if (newsBadge) newsBadge.classList.add('hidden');
        const newsBtn = document.getElementById('news-bell');
        if (newsBtn) newsBtn.classList.remove('has-unread');

        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        try {
            const news = await API.news.getById(id);
            // Пряме посилання не повинно обходити мережеве обмеження, задане
            // адміном у формі редагування новини (окремо від групи доступу).
            if (!this._matchesNetwork(news)) {
                Toast.error('Немає доступу', 'Ця новина недоступна з вашої мережі');
                Router.go(from === 'dashboard' ? 'dashboard' : 'news');
                return;
            }
            const { data: latest } = await supabase.from('news')
                    .select('id,slug,title,thumbnail_url,published_at,created_at')
                    .eq('is_published', true)
                    .neq('id', news.id)
                    .order('published_at', { ascending: false, nullsFirst: false })
                    .limit(3);

            const backRoute = from === 'dashboard' ? 'dashboard' : 'news';
            const backLabel = from === 'dashboard' ? 'Головна' : 'Новини';
            UI.setBreadcrumb([{ label: backLabel, route: backRoute }, { label: news.title }]);
            ActivityTracker.track('news_view', { entity_type: 'news', entity_id: news.id, entity_title: news.title, page: `news/${news.id}` });

            container.innerHTML = `
                <button class="btn btn-ghost btn-sm" onclick="Router.go('${backRoute}')" style="display:inline-flex;align-items:center;gap:.35rem;margin-bottom:.75rem"><i class="fa-solid fa-angle-left"></i> ${backLabel}</button>
                <style>
                    .nv-top{display:grid;grid-template-columns:1fr 280px;gap:1.5rem;align-items:start;margin-bottom:2rem}
                    .nv-hero{position:relative;width:100%;height:420px;border-radius:var(--radius-xl);overflow:hidden;background:#0f0c29}
                    .nv-hero-bg{position:absolute;inset:-20px;background-size:cover;background-position:center;filter:blur(18px) brightness(.45) saturate(1.2);transform:scale(1.05)}
                    .nv-hero img{position:relative;width:100%;height:100%;object-fit:contain;display:block;z-index:1}
                    .nv-hero-ph{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1e1b4b,#312e81);z-index:1}
                    .nv-hero-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.82) 0%,rgba(0,0,0,.4) 50%,transparent 100%),linear-gradient(to right,rgba(0,0,0,.6) 0%,rgba(0,0,0,.2) 55%,transparent 100%);z-index:2}
                    .nv-hero-content{position:absolute;bottom:0;left:0;width:60%;max-width:680px;padding:1.75rem 2rem;z-index:3}
                    .nv-hero-badges{display:flex;gap:.5rem;margin-bottom:.65rem;flex-wrap:wrap}
                    .nv-hero-title{font-size:2rem;font-weight:800;color:#fff;line-height:1.25;margin:0;text-shadow:0 2px 12px rgba(0,0,0,.4)}
                    .nv-hero-meta{display:flex;align-items:center;gap:1.25rem;margin-top:.65rem;color:rgba(255,255,255,.75);font-size:.82rem}
                    .nv-hero-actions{position:absolute;top:1rem;left:1rem;display:flex;gap:.5rem;z-index:3}
                    .nv-article{min-width:0;display:grid;grid-template-columns:1fr 280px;gap:1.5rem;column-gap:1.5rem}
                    .nv-article-body{min-width:0}
                    /* Картка тексту статті — раніше контент "висів" прямо на фоні
                       сторінки без меж і читабельної ширини, звідси відчуття
                       відсутності розділювачів. Плюс кольоровий верхній акцент і
                       обмежена ширина рядка для комфортного читання. */
                    .nv-article-card{
                        position:relative;overflow:hidden;
                        background:var(--bg-surface);border:1px solid var(--border);
                        border-radius:var(--radius-xl);
                        padding:2.25rem clamp(1.25rem,4vw,3.5rem);
                        box-shadow:0 1px 3px rgba(0,0,0,.04);
                    }
                    .nv-article-card::before{
                        content:'';position:absolute;top:0;left:0;right:0;height:4px;
                        background:linear-gradient(90deg,var(--primary),color-mix(in srgb,var(--primary) 40%,#8b5cf6));
                    }
                    @media(max-width:768px){.nv-article-card{padding:1.5rem 1.1rem;border-radius:var(--radius-lg)}}
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
                    @media(max-width:768px){
                        .nv-hero{height:200px;border-radius:10px}
                        .nv-hero-title{font-size:1.15rem;line-height:1.3}
                        .nv-hero-content{width:90%;padding:.9rem 1rem;bottom:0;left:0}
                        .nv-hero-meta{gap:.6rem;font-size:.75rem;flex-wrap:wrap}
                        .nv-hero-actions{top:.5rem;left:.5rem}
                        .nv-article-body{font-size:.9rem}
                        .nv-react-btn{padding:.35rem .7rem;font-size:.8rem}
                    }
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
                        <div style="position:absolute;bottom:1.25rem;right:1.5rem;display:flex;align-items:center;gap:.4rem;z-index:3">
                            ${['👍','❤️','😂','😮','👏','🔥'].map(e => `
                                <button class="nv-emoji-btn nv-emoji-hero" id="nv-react-${news.id}-${e.codePointAt(0)}" data-emoji="${e}"
                                    onclick="NewsPage._reactArticleEmoji('${news.id}','${e}',this)" title="${e}">
                                    ${e}<span class="nv-react-count"></span>
                                </button>`).join('')}
                        </div>` : ''}
                        <div class="nv-hero-actions">
                        </div>
                        ${AppState.isStaff() && AppState.canMutate() ? `
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
                        <div class="nv-article-card">
                            <div class="news-content-body">${this._safeHtml(this._fixImgUrls(news.content))}</div>
                        </div>
                    </div>
                </article>`;

            if (news.allow_reactions !== false) this._loadReactions(news.id);
        } catch(e) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Новину не знайдено</h3><button class="btn-back" onclick="Router.go('news')"><i class="fa-solid fa-arrow-left"></i> Назад</button></div>`;
        }
    },

    _sortEmojiRow(buttons, counts) {
        if (!buttons.length) return;
        const parent = buttons[0].parentElement;
        if (!parent) return;
        const sorted = [...buttons].sort((a, b) => (counts[b.dataset.emoji] || 0) - (counts[a.dataset.emoji] || 0));
        sorted.forEach(btn => parent.appendChild(btn));
    },

    async _loadCardReactions(ids) {
        try {
            const { data: all } = await supabase.from('news_reactions').select('news_id,emoji').in('news_id', ids.filter(Boolean));
            const { data: mine } = await supabase.from('news_reactions').select('news_id,emoji').in('news_id', ids.filter(Boolean)).eq('user_id', AppState.user.id);
            const mySet = new Set((mine || []).map(r => `${r.news_id}:${r.emoji}`));
            for (const id of ids) {
                const counts = {};
                (all || []).filter(r => r.news_id === id).forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
                const btns = [];
                for (const e of ['👍','❤️','😂','😮','👏','🔥']) {
                    const btn = document.getElementById(`ce-${id}-${e.codePointAt(0)}`);
                    if (!btn) continue;
                    btn.querySelector('.nv-react-count').textContent = counts[e] || '';
                    btn.classList.toggle('active', mySet.has(`${id}:${e}`));
                    btns.push(btn);
                }
                this._sortEmojiRow(btns, counts);
            }
        } catch { /* ігноруємо якщо таблиці ще немає */ }
    },

    async _reactEmoji(newsId, emoji, btn) {
        // Блокуємо кнопку на час запиту — без цього швидкі повторні кліки
        // летіли паралельно, і локальний лічильник (+1 на кожен клік) не
        // відповідав реальним даним у БД (можна було "накрутити" число лайків).
        if (btn.disabled) return;
        btn.disabled = true;
        try {
            await API.news.toggleEmoji(newsId, emoji);
            // Перечитуємо реальний стан з БД замість ручної математики cur±1.
            const { counts, myEmojis } = await API.news.getEmojiReactions(newsId);
            const btns = [];
            for (const e of ['👍','❤️','😂','😮','👏','🔥']) {
                const b = document.getElementById(`ce-${newsId}-${e.codePointAt(0)}`);
                if (!b) continue;
                b.querySelector('.nv-react-count').textContent = counts[e] || '';
                b.classList.toggle('active', myEmojis.has(e));
                btns.push(b);
            }
            this._sortEmojiRow(btns, counts);
            btn.style.transform = 'scale(1.35)';
            setTimeout(() => { btn.style.transform = ''; }, 200);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { btn.disabled = false; }
    },

    async _loadReactions(newsId) {
        try {
            const { counts, myEmojis } = await API.news.getEmojiReactions(newsId);
            const btns = [];
            for (const e of ['👍','❤️','😂','😮','👏','🔥']) {
                const btn = document.getElementById(`nv-react-${newsId}-${e.codePointAt(0)}`);
                if (!btn) continue;
                btn.querySelector('.nv-react-count').textContent = counts[e] || '';
                btn.classList.toggle('active', myEmojis.has(e));
                btns.push(btn);
            }
            this._sortEmojiRow(btns, counts);
        } catch { /* ігноруємо якщо таблиці ще немає */ }
    },

    async _reactArticleEmoji(newsId, emoji, btn) {
        // Блокуємо кнопку на час запиту — без цього швидкі повторні кліки
        // летіли паралельно, і локальний лічильник (+1 на кожен клік) не
        // відповідав реальним даним у БД (можна було "накрутити" число лайків).
        if (btn.disabled) return;
        btn.disabled = true;
        try {
            await API.news.toggleEmoji(newsId, emoji);
            // Перечитуємо реальний стан з БД замість ручної математики cur±1
            // (заодно й пересортовує ряд емодзі за реальною кількістю).
            await this._loadReactions(newsId);
            btn.style.transform = 'scale(1.4)';
            setTimeout(() => { btn.style.transform = ''; }, 200);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { btn.disabled = false; }
    },

    // ── Create / Edit ──────────────────────────────────────────────
    _backToList() {
        const container = document.getElementById('page-content');
        if (container) { history.replaceState(null, '', '#/news'); NewsPage.init(container, {}); }
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

                /* ── Редизайн: хедер + картки опцій (мова дизайну mc-em-* з
                   особистого календаря — еталон UI-стилю проєкту) ── */
                .nfx-header{
                    display:flex;align-items:center;gap:14px;flex-wrap:wrap;
                    padding:16px 20px;margin-bottom:1.5rem;border-radius:var(--radius-xl);
                    background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 10%,var(--bg-surface)),color-mix(in srgb,var(--primary) 3%,var(--bg-surface)));
                    border:1px solid var(--border);
                }
                .nfx-header-icon{
                    width:44px;height:44px;border-radius:13px;flex-shrink:0;
                    display:flex;align-items:center;justify-content:center;font-size:1.1rem;
                    background:var(--primary);color:#fff;
                    box-shadow:0 6px 16px color-mix(in srgb,var(--primary) 45%,transparent);
                }
                .nfx-header-text{flex:1;min-width:160px}
                .nfx-header-title{font-size:1.15rem;font-weight:800;color:var(--text-primary);line-height:1.2}
                .nfx-header-sub{display:flex;align-items:center;gap:8px;margin-top:3px}
                .nfx-status-pill{
                    display:inline-flex;align-items:center;gap:5px;font-size:.68rem;font-weight:700;
                    text-transform:uppercase;letter-spacing:.04em;padding:2px 9px;border-radius:20px;
                }
                .nfx-status-pill.live{background:rgba(16,185,129,.14);color:#10b981}
                .nfx-status-pill.draft{background:var(--bg-hover);color:var(--text-muted)}
                .nfx-header-actions{display:flex;gap:8px;flex-wrap:wrap}

                .nfx-sidebar-title{display:none}
                .nf-sidebar{background:transparent;border:none;display:flex;flex-direction:column;gap:12px}
                .nf-sidebar-body{display:contents}
                .nfx-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden}
                .nfx-card-head{
                    display:flex;align-items:center;gap:9px;padding:10px 14px;
                    font-size:.76rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;
                    color:var(--c,var(--primary));background:color-mix(in srgb,var(--c,var(--primary)) 10%,var(--bg-surface));
                    border-bottom:1px solid var(--border);
                }
                .nfx-card-head i{font-size:.85rem}
                .nfx-card-body{padding:12px 14px;display:flex;flex-direction:column;gap:10px}
                .nfx-card-body .nf-field{gap:.3rem}
                .nfx-card-body .nf-field label{font-size:.68rem}
                .nfx-card-body select, .nfx-card-body .nf-date{font-size:.82rem}

                .nfx-toggle-row{
                    display:flex;align-items:center;gap:10px;padding:9px 11px;
                    border-radius:11px;border:1.5px solid var(--border);background:var(--bg-raised);
                    cursor:pointer;transition:background .15s,border-color .15s;user-select:none;
                }
                .nfx-toggle-row:has(.nfx-toggle-input:checked){border-color:color-mix(in srgb,var(--c,var(--primary)) 45%,var(--border));background:color-mix(in srgb,var(--c,var(--primary)) 7%,var(--bg-raised))}
                .nfx-toggle-ico{font-size:1rem;flex-shrink:0;width:20px;text-align:center;color:var(--c,var(--text-muted))}
                .nfx-toggle-text{flex:1;min-width:0;font-size:.84rem;font-weight:700;color:var(--text-primary)}
                .nfx-toggle-input{position:absolute;opacity:0;width:0;height:0}
                .nfx-toggle-pill{position:relative;flex-shrink:0;width:38px;height:22px;border-radius:12px;background:var(--border);transition:background .2s}
                .nfx-toggle-knob{position:absolute;top:2.5px;left:2.5px;width:17px;height:17px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:transform .2s}
                .nfx-toggle-input:checked ~ .nfx-toggle-pill{background:var(--c,var(--primary))}
                .nfx-toggle-input:checked ~ .nfx-toggle-pill .nfx-toggle-knob{transform:translateX(16px)}

                .nfx-net-opt{display:flex;align-items:center;gap:8px}
                .nfx-net-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}

                .nfx-select{
                    appearance:none;-webkit-appearance:none;
                    width:100%;box-sizing:border-box;
                    padding:9px 34px 9px 12px;border-radius:11px;
                    border:1.5px solid var(--border);background:var(--bg-raised);
                    color:var(--text-primary);font-size:.82rem;font-weight:600;font-family:inherit;
                    cursor:pointer;outline:none;transition:border-color .15s,box-shadow .15s;
                    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
                    background-repeat:no-repeat;background-position:right 12px center;
                }
                .nfx-select:hover{border-color:color-mix(in srgb,var(--c,var(--primary)) 40%,var(--border))}
                .nfx-select:focus{border-color:var(--c,var(--primary));box-shadow:0 0 0 3px color-mix(in srgb,var(--c,var(--primary)) 16%,transparent)}
                .nfx-select option{background:var(--bg-surface);color:var(--text-primary)}
            </style>

            <div class="nfx-header">
                <div class="nfx-header-icon"><i class="fa-solid ${isEdit ? 'fa-pen' : 'fa-newspaper'}"></i></div>
                <div class="nfx-header-text">
                    <div class="nfx-header-title">${isEdit ? 'Редагувати новину' : 'Нова новина'}</div>
                    <div class="nfx-header-sub">
                        <span class="nfx-status-pill ${news?.is_published ? 'live' : 'draft'}">
                            <i class="fa-solid ${news?.is_published ? 'fa-circle-check' : 'fa-pen'}" style="font-size:.6rem"></i>
                            ${news?.is_published ? 'Опубліковано' : 'Чернетка'}
                        </span>
                    </div>
                </div>
                <div class="nfx-header-actions">
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
                            <div class="nf-editor-left">
                                <div class="nf-html-toggle">
                                    <button type="button" class="btn btn-ghost btn-sm" onclick="NewsPage._previewNews()" style="font-size:.75rem">
                                        <i class="fa-solid fa-eye"></i> Перегляд
                                    </button>
                                </div>
                                <textarea id="n-html-src" style="flex:1;width:100%;min-height:460px;padding:1rem;font-family:monospace;font-size:.82rem;background:var(--bg-raised);color:var(--text-primary);border:none;border-top:1px solid var(--border);outline:none;resize:none;line-height:1.6;tab-size:2;box-sizing:border-box" placeholder="HTML...">${Fmt.esc(news?.content || '')}</textarea>
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
                    <div class="nf-sidebar-body">

                        <div class="nfx-card" style="--c:#10b981">
                            <div class="nfx-card-head"><i class="fa-solid fa-paper-plane"></i>Публікація</div>
                            <div class="nfx-card-body">
                                <label class="nfx-toggle-row" style="--c:#10b981">
                                    <span class="nfx-toggle-ico"><i class="fa-solid fa-circle-check"></i></span>
                                    <span class="nfx-toggle-text">Опубліковано</span>
                                    <input type="checkbox" id="n-published" class="nfx-toggle-input" ${news?.is_published ? 'checked' : ''}>
                                    <span class="nfx-toggle-pill"><span class="nfx-toggle-knob"></span></span>
                                </label>
                                <div class="nf-field">
                                    <label><i class="fa-regular fa-calendar" style="color:var(--primary);margin-right:.3rem"></i>Дата публікації</label>
                                    ${UaDateTime.html('n-published-at', pubDateVal)}
                                </div>
                                <div class="nf-field">
                                    <label><i class="fa-regular fa-calendar-xmark" style="color:var(--text-muted);margin-right:.3rem"></i>Актуально до</label>
                                    ${UaDateTime.html('n-expires-at', expDateVal)}
                                </div>
                            </div>
                        </div>

                        <div class="nfx-card" style="--c:#f59e0b">
                            <div class="nfx-card-head"><i class="fa-solid fa-star"></i>Показ на порталі</div>
                            <div class="nfx-card-body">
                                <label class="nfx-toggle-row" style="--c:#f59e0b">
                                    <span class="nfx-toggle-ico"><i class="fa-solid fa-star"></i></span>
                                    <span class="nfx-toggle-text">Головна новина</span>
                                    <input type="checkbox" id="n-featured" class="nfx-toggle-input" ${news?.is_featured ? 'checked' : ''}>
                                    <span class="nfx-toggle-pill"><span class="nfx-toggle-knob"></span></span>
                                </label>
                                <label class="nfx-toggle-row" style="--c:#f59e0b">
                                    <span class="nfx-toggle-ico"><i class="fa-regular fa-face-smile"></i></span>
                                    <span class="nfx-toggle-text">Дозволити реакції</span>
                                    <input type="checkbox" id="n-reactions" class="nfx-toggle-input" ${news?.allow_reactions !== false ? 'checked' : ''}>
                                    <span class="nfx-toggle-pill"><span class="nfx-toggle-knob"></span></span>
                                </label>
                            </div>
                        </div>

                        <div class="nfx-card" style="--c:#8b5cf6">
                            <div class="nfx-card-head"><i class="fa-solid fa-shield-halved"></i>Доступ і видимість</div>
                            <div class="nfx-card-body">
                                <div class="nf-field">
                                    <label>Група доступу</label>
                                    <select id="n-access-group" class="nfx-select" style="--c:#8b5cf6">
                                        <option value="">— Всі (без обмежень) —</option>
                                    </select>
                                </div>
                                <div class="nf-field">
                                    <label><i class="fa-solid fa-network-wired" style="color:var(--text-muted);margin-right:.3rem"></i>Видимість за мережею</label>
                                    <select id="n-network-visibility" class="nfx-select" style="--c:#8b5cf6">
                                        <option value="all" ${(!news?.network_visibility || news.network_visibility === 'all') ? 'selected' : ''}>Всім (незалежно від мережі)</option>
                                        <option value="trusted" ${news?.network_visibility === 'trusted' ? 'selected' : ''}>Тільки довірена мережа (в магазині)</option>
                                        <option value="untrusted" ${news?.network_visibility === 'untrusted' ? 'selected' : ''}>Тільки недовірена мережа (поза магазином)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="nfx-card" style="--c:#ec4899">
                            <div class="nfx-card-head"><i class="fa-regular fa-image"></i>Головне зображення</div>
                            <div class="nfx-card-body">
                            <div style="font-size:.7rem;color:var(--text-muted);line-height:1.5">
                                Рекомендований розмір: <strong style="color:var(--text-secondary)">1200 × 630 px</strong><br>
                                Формат: JPG, PNG · до 5 МБ
                            </div>
                            ${news?.thumbnail_url
                                ? `<div class="nf-img-preview"><img id="n-img-preview" src="${news.thumbnail_url}" style="object-fit:cover;object-position:${news.thumbnail_position || 'center'} center"></div>
                                   <div class="nf-img-change"><button class="btn btn-ghost btn-sm" onclick="document.getElementById('n-img-input').click()">Змінити</button></div>`
                                : `<div id="news-img-zone"></div>`}
                            <input id="n-img-input" type="file" accept="image/*" style="display:none"
                                   onchange="NewsPage._onImgChange(this)">

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
        const ta = document.getElementById('n-html-src');
        if (!ta) return;
        const pos = ta.selectionStart ?? ta.value.length;
        const ins = isImage
            ? `<img src="${url}" alt="${name}" style="max-width:100%">`
            : `<a href="${url}" target="_blank" rel="noopener">${name}</a>`;
        ta.value = ta.value.slice(0, pos) + ins + ta.value.slice(pos);
        ta.selectionStart = ta.selectionEnd = pos + ins.length;
        ta.focus();
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

    // Escape structural tags that would break innerHTML parsing (</html>, </body>, </head>)
    _safeHtml(html) {
        if (!html) return html;
        // Remove dangerous full blocks (script, style with content)
        let out = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
        out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
        // Strip dangerous bare tags (html/body/head/meta/title/base/link)
        out = out.replace(/<\/?(html|body|head|meta|title|base|link)\b[^>]*>/gi,
            m => m.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        return out;
    },

    _draggedImgUrl: null,

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

    _getContent() {
        return document.getElementById('n-html-src')?.value || '';
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
        const networkVisibility = Dom.val('n-network-visibility') || 'all';

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
            network_visibility:  networkVisibility,
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
            ActivityTracker.track(id ? 'news_edit' : 'news_create', { entity_type: 'news', entity_title: title });
            Toast.success('Успішно!', `Новина "${title}" ${id ? 'оновлена' : 'додана'}`);
            const container = document.getElementById('page-content');
            if (container) { history.replaceState(null, '', '#/news'); await NewsPage.init(container, {}); }
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
            ActivityTracker.track('news_delete', { entity_type: 'news', entity_id: id, entity_title: title });
            Toast.success('Новина видалина');
            Router.go('news');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    }
};
