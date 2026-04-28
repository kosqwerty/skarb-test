// ================================================================
// EduFlow LMS — News / Portal Page
// ================================================================

const NewsPage = {
    _page: 0,

    // async init(container, params) {
    //     // Single article view
    //     if (params.id) {
    //         await this._viewArticle(container, params.id);
    //         return;
    //     }

    //     UI.setBreadcrumb([{ label: 'Новини' }]);
    //     this._page = 0;

    //     container.innerHTML = `
    //         <div class="page-header">
    //             <div class="page-title">
    //                 <h1>📰 Новини та оголошення</h1>
    //                 <p>Останні події</p>
    //             </div>
    //             <div class="page-actions">
    //                 ${AppState.isStaff() ? `<button class="btn btn-primary" onclick="NewsPage.openCreate()">+ Додати новину</button>` : ''}
    //             </div>
    //         </div>

    //         <div id="featured-news" style="margin-bottom:2rem"></div>

    //         <div style="display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
    //             <input type="text" id="news-search" placeholder="Пошук новин..." style="flex:1;min-width:200px"
    //                    onkeyup="NewsPage.onSearch(event)">
    //             <select id="news-category" onchange="NewsPage.load()" style="width:auto">
    //                 <option value="">Всі категорії</option>
    //                 <option value="general">Загальні</option>
    //                 <option value="announcements">Оголошення</option>
    //                 <option value="updates">Оновлення</option>
    //                 <option value="events">Події</option>
    //             </select>
    //         </div>

    //         <div id="news-grid" class="news-grid"></div>
    //         <div id="news-pagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:2rem"></div>`;

    //     await this.load();
    // },
    // ── Article View (оновлений) ─────────────────────────────────────
async _viewArticle(container, id) {
    container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

    try {
        const [news, { data: latest }] = await Promise.all([
            API.news.getById(id),
            supabase.from('news')
                .select('id,title,thumbnail_url,published_at,created_at,category')
                .eq('is_published', true)
                .neq('id', id)
                .order('published_at', { ascending: false, nullsFirst: false })
                .limit(3)
        ]);

        UI.setBreadcrumb([{ label: 'Новини', route: 'news' }, { label: news.title }]);

        container.innerHTML = `
            <style>
                .nv-layout {
                    display: grid;
                    grid-template-columns: 1fr 280px;
                    gap: 15px;
                    align-items: start;
                    width: 100%;
                }
                .nv-sidebar {
                    position: sticky;
                    top: 1rem;
                }
                .nv-sidebar-title {
                    font-size: .75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: .06em;
                    color: var(--text-muted);
                    margin-bottom: .75rem;
                    padding-left: .25rem;
                }
                .nv-recent-item {
                    display: flex;
                    gap: .75rem;
                    padding: .75rem;
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    transition: background var(--transition);
                    border: 1px solid transparent;
                }
                .nv-recent-item:hover {
                    background: var(--bg-raised);
                    border-color: var(--border);
                }
                .nv-recent-thumb {
                    width: 64px;
                    height: 48px;
                    border-radius: var(--radius-sm);
                    overflow: hidden;
                    flex-shrink: 0;
                    background: var(--bg-raised);
                }
                .nv-recent-thumb img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }
                .nv-recent-thumb-ph {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.4rem;
                }
                .nv-recent-info {
                    flex: 1;
                    min-width: 0;
                }
                .nv-recent-title {
                    font-size: .82rem;
                    font-weight: 600;
                    line-height: 1.35;
                    color: var(--text-primary);
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .nv-recent-date {
                    font-size: .72rem;
                    color: var(--text-muted);
                    margin-top: .25rem;
                }
                @media (max-width: 900px) {
                    .nv-layout {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                    }
                    .nv-sidebar {
                        position: static;
                    }
                }
            </style>

            <div class="nv-layout">
                <!-- Основний контент (розтягнутий) -->
                <div>
                    <button class="btn btn-ghost btn-sm" onclick="Router.go('news')" style="margin-bottom:1.5rem">
                        ← Назад до новин
                    </button>

                    <div class="card">
                        <div class="card-body" style="padding:2.5rem">
                            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap">
                                <span class="badge badge-primary">${news.category || 'Загальні'}</span>
                                ${news.is_featured ? '<span class="badge badge-warning">⭐ Головна</span>' : ''}
                                ${!news.is_published ? '<span class="badge badge-muted">Чернетка</span>' : ''}
                            </div>

                            <h1 style="font-size:2rem;line-height:1.3;margin-bottom:1rem">${news.title}</h1>

                            <div style="display:flex;align-items:center;justify-content:space-between;color:var(--text-muted);font-size:.875rem;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid var(--border)">
                                <div style="display:flex;align-items:center;gap:1.5rem;">
                                    <span>📅 ${Fmt.date(news.published_at || news.created_at)}</span>
                                    <span>👤 ${news.author?.full_name || 'Редагування'}</span>
                                    ${news.views ? `<span>👁 ${news.views} переглядів</span>` : ''}
                                </div>
                                ${news.allow_reactions !== false ? `
                                    <div style="display:flex;align-items:center;gap:1rem;">
                                        <span>Оцінити:</span>
                                        <button id="btn-react-up" class="btn btn-ghost btn-sm" onclick="NewsPage._react('${news.id}','up')" style="font-size:.95rem; padding:.2rem .6rem;">
                                            👍 <span id="react-up-count">—</span>
                                        </button>
                                        <button id="btn-react-down" class="btn btn-ghost btn-sm" onclick="NewsPage._react('${news.id}','down')" style="font-size:.95rem; padding:.2rem .6rem;">
                                            👎 <span id="react-down-count">—</span>
                                        </button>
                                    </div>
                                ` : ''}
                            </div>

                            ${news.excerpt ? `<p style="font-size:1.1rem;color:var(--text-secondary);margin-bottom:1.5rem;font-style:italic">${news.excerpt}</p>` : ''}

                            <div class="news-content-body">
                                ${this._fixImgUrls(news.content)}
                            </div>

                            ${news.tags?.length ? `
                                <div style="margin-top:2rem;display:flex;gap:.5rem;flex-wrap:wrap">
                                    ${news.tags.map(t => `<span class="badge badge-muted">#${t}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    ${AppState.isStaff() ? `
                        <div style="display:flex;gap:.75rem;margin-top:1rem;justify-content:flex-end">
                            <button class="btn btn-secondary" onclick="NewsPage.openEdit('${news.id}')">✏️ Редагувати</button>
                            <button class="btn btn-danger" onclick="NewsPage.deleteNews('${news.id}','${news.title}')">🗑️ Видалити</button>
                        </div>
                    ` : ''}
                </div>

                <!-- Права колонка: Останні новини -->
                <aside class="nv-sidebar">
                    <div class="nv-sidebar-title">Останні новини</div>
                    <div style="display:flex;flex-direction:column;gap:.25rem">
                        ${(latest || []).map(n => `
                            <div class="nv-recent-item" onclick="Router.go('news/${n.id}')">
                                <div class="nv-recent-thumb">
                                    ${n.thumbnail_url
                                        ? `<img src="${n.thumbnail_url}" loading="lazy">`
                                        : `<div class="nv-recent-thumb-ph">📰</div>`}
                                </div>
                                <div class="nv-recent-info">
                                    <div class="nv-recent-title">${n.title}</div>
                                    <div class="nv-recent-date">${Fmt.date(n.published_at || n.created_at, { day:'numeric', month:'short' })}</div>
                                </div>
                            </div>
                        `).join('')}
                        ${!latest?.length ? `<p style="font-size:.82rem;color:var(--text-muted);padding:.5rem .25rem">Немає інших новин</p>` : ''}
                    </div>
                    <div style="margin-top:1rem;padding-top:.75rem;border-top:1px solid var(--border)">
                        <button class="btn btn-ghost btn-sm" style="width:100%" onclick="Router.go('news')">
                            Всі новини →
                        </button>
                    </div>
                </aside>
            </div>`;

        if (news.allow_reactions !== false) this._loadReactions(id);
    } catch(e) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Новину не знайдено</h3><button class="btn btn-primary" onclick="Router.go('news')">← Назад</button></div>`;
    }
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

            // Featured news (is_featured)
            const featured = data.filter(n => n.is_featured).slice(0, 1)[0];
            if (featured) this._renderFeatured(featured);

            const regular = data.filter(n => !n.is_featured || data.indexOf(n) > 0);

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

        el.innerHTML = `
            <div onclick="Router.go('news/${news.id}')" style="
                display:grid;grid-template-columns:1fr 1fr;gap:2rem;
                background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl);
                overflow:hidden;cursor:pointer;transition:all var(--transition)" class="featured-card"
                onmouseenter="this.style.borderColor='var(--primary)'" onmouseleave="this.style.borderColor='var(--border)'">
                ${news.thumbnail_url ? `
                    <div style="height:280px;overflow:hidden">
                        <img src="${news.thumbnail_url}" style="width:100%;height:100%;object-fit:cover">
                    </div>` : `<div style="height:280px;background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.1));display:flex;align-items:center;justify-content:center;font-size:5rem">📰</div>`}
                <div style="padding:2rem;display:flex;flex-direction:column;justify-content:center">
                    <span style="color:var(--primary);font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.75rem">
                        ⭐ ${news.category || 'Головна новина'}
                    </span>
                    <h2 style="margin-bottom:1rem;line-height:1.4">${news.title}</h2>
                    <p style="color:var(--text-secondary);font-size:.9rem;line-height:1.7;margin-bottom:1.5rem;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">
                        ${news.excerpt || news.content.slice(0, 200).replace(/<[^>]+>/g, '')}...
                    </p>
                    <div style="display:flex;align-items:center;justify-content:space-between">
                        <span style="font-size:.8rem;color:var(--text-muted)">
                            👤 ${news.author?.full_name || 'Редагувати'} • ${Fmt.date(news.published_at || news.created_at, { day:'numeric',month:'long' })}
                        </span>
                        <span class="btn btn-primary btn-sm">Читати →</span>
                    </div>
                </div>
            </div>`;
    },

    _renderCard(news) {
        return `
            <div class="news-card" onclick="Router.go('news/${news.id}')">
                <div class="news-thumb">
                    ${news.thumbnail_url
                        ? `<img src="${news.thumbnail_url}" alt="${news.title}" loading="lazy">`
                        : `<div style="height:100%;background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.08));display:flex;align-items:center;justify-content:center;font-size:3rem">📰</div>`}
                </div>
                <div class="news-body">
                    <div class="news-category">${news.category || 'Загальні'}</div>
                    <h4 class="news-title">${news.title}</h4>
                    <p class="news-excerpt">${news.excerpt || (news.content || '').replace(/<[^>]+>/g, '').slice(0, 150)}</p>
                </div>
                <div class="news-footer">
                    <span>👤 ${news.author?.full_name || '—'}</span>
                    <div style="display:flex;align-items:center;gap:.75rem">
                        ${!news.is_published ? '<span class="badge badge-muted">Чернетка</span>' : ''}
                        <span>${Fmt.date(news.published_at || news.created_at, { day:'numeric', month:'short' })}</span>
                        ${news.allow_reactions !== false ? `
                            <div style="display:flex;gap:.25rem" onclick="event.stopPropagation()">
                                <button id="cr-up-${news.id}" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();NewsPage._reactCard('${news.id}','up')" style="font-size:.85rem;padding:.2rem .5rem">
                                    👍 <span id="cu-${news.id}">·</span>
                                </button>
                                <button id="cr-dn-${news.id}" class="btn btn-ghost btn-sm" onclick="event.stopPropagation();NewsPage._reactCard('${news.id}','down')" style="font-size:.85rem;padding:.2rem .5rem">
                                    👎 <span id="cd-${news.id}">·</span>
                                </button>
                            </div>` : ''}
                        ${AppState.isStaff() ? `
                            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();NewsPage.openEdit('${news.id}')">✏️</button>
                            <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();NewsPage.deleteNews('${news.id}','${news.title.replace(/'/g,"\\'").replace(/"/g,'\\"')}')">🗑</button>
                        ` : ''}
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
            const [news, { data: latest }] = await Promise.all([
                API.news.getById(id),
                supabase.from('news')
                    .select('id,title,thumbnail_url,published_at,created_at,category')
                    .eq('is_published', true)
                    .neq('id', id)
                    .order('published_at', { ascending: false, nullsFirst: false })
                    .limit(3)
            ]);

            UI.setBreadcrumb([{ label: 'Новини', route: 'news' }, { label: news.title }]);

            container.innerHTML = `
                <style>
                    .nv-layout{display:grid;grid-template-columns:1fr 280px;gap:1.5rem;align-items:start;max-width:1300px;margin: 5px;}
                    .nv-sidebar{position:sticky;top:1rem}
                    .nv-sidebar-title{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.75rem;padding-left:.25rem}
                    .nv-recent-item{display:flex;gap:.75rem;padding:.75rem;border-radius:var(--radius-md);cursor:pointer;transition:background var(--transition);border:1px solid transparent}
                    .nv-recent-item:hover{background:var(--bg-raised);border-color:var(--border)}
                    .nv-recent-thumb{width:64px;height:48px;border-radius:var(--radius-sm);overflow:hidden;flex-shrink:0;background:var(--bg-raised)}
                    .nv-recent-thumb img{width:100%;height:100%;object-fit:cover;display:block}
                    .nv-recent-thumb-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.4rem}
                    .nv-recent-info{flex:1;min-width:0}
                    .nv-recent-title{font-size:.82rem;font-weight:600;line-height:1.35;color:var(--text-primary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
                    .nv-recent-date{font-size:.72rem;color:var(--text-muted);margin-top:.25rem}
                    @media(max-width:900px){.nv-layout{grid-template-columns:1fr}.nv-sidebar{position:static}}
                </style>

                <div class="nv-layout">

                    <!-- ── Основний контент ── -->
                    <div>
                        <button class="btn btn-ghost btn-sm" onclick="Router.go('news')" style="margin-bottom:1.5rem">
                            ← Назад до новин
                        </button>

                        <div class="card">
                            <div class="card-body" style="padding:2.5rem">
                                <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap">
                                    <span class="badge badge-primary">${news.category || 'Загальні'}</span>
                                    ${news.is_featured ? '<span class="badge badge-warning">⭐ Головна</span>' : ''}
                                    ${!news.is_published ? '<span class="badge badge-muted">Чернетка</span>' : ''}
                                </div>

                                <h1 style="font-size:2rem;line-height:1.3;margin-bottom:1rem">${news.title}</h1>

                                <div style="display:flex;align-items:center;justify-content:space-between;color:var(--text-muted);font-size:.875rem;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid var(--border)">
                                    <div style="display:flex;align-items:center;gap:1.5rem;">
                                    <span>📅 ${Fmt.date(news.published_at || news.created_at)}</span>    
                                    <span>👤 ${news.author?.full_name || 'Редагування'}</span>
                                        
                                        ${news.views ? `<span>👁 ${news.views} переглядів</span>` : ''}
                                    </div>
                                    ${news.allow_reactions !== false ? `
                                        <div style="display:flex;align-items:center;gap:1rem;">
                                            <span>Оцінити:</span>
                                            <button id="btn-react-up" class="btn btn-ghost btn-sm" onclick="NewsPage._react('${news.id}','up')" style="font-size:.95rem; padding:.2rem .6rem;">
                                                👍 <span id="react-up-count">—</span>
                                            </button>
                                            <button id="btn-react-down" class="btn btn-ghost btn-sm" onclick="NewsPage._react('${news.id}','down')" style="font-size:.95rem; padding:.2rem .6rem;">
                                                👎 <span id="react-down-count">—</span>
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>

                                
                                ${news.excerpt ? `<p style="font-size:1.1rem;color:var(--text-secondary);margin-bottom:1.5rem;font-style:italic">${news.excerpt}</p>` : ''}

                                <div class="news-content-body">
                                    ${this._fixImgUrls(news.content)}
                                </div>

                                ${news.tags?.length ? `
                                    <div style="margin-top:2rem;display:flex;gap:.5rem;flex-wrap:wrap">
                                        ${news.tags.map(t => `<span class="badge badge-muted">#${t}</span>`).join('')}
                                    </div>` : ''}
                            </div>
                        </div>

                        ${AppState.isStaff() ? `
                            <div style="display:flex;gap:.75rem;margin-top:1rem;justify-content:flex-end">
                                <button class="btn btn-secondary" onclick="NewsPage.openEdit('${news.id}')">✏️ Редагувати</button>
                                <button class="btn btn-danger" onclick="NewsPage.deleteNews('${news.id}','${news.title}')">🗑️ Видалити</button>
                            </div>` : ''}
                    </div>

                    <!-- ── Права колонка ── -->
                    <aside class="nv-sidebar">
                        <div class="nv-sidebar-title">Останні новини</div>
                        <div style="display:flex;flex-direction:column;gap:.25rem">
                            ${(latest || []).map(n => `
                                <div class="nv-recent-item" onclick="Router.go('news/${n.id}')">
                                    <div class="nv-recent-thumb">
                                        ${n.thumbnail_url
                                            ? `<img src="${n.thumbnail_url}" loading="lazy">`
                                            : `<div class="nv-recent-thumb-ph">📰</div>`}
                                    </div>
                                    <div class="nv-recent-info">
                                        <div class="nv-recent-title">${n.title}</div>
                                        <div class="nv-recent-date">${Fmt.date(n.published_at || n.created_at, { day:'numeric', month:'short' })}</div>
                                    </div>
                                </div>`).join('')}
                            ${!latest?.length ? `<p style="font-size:.82rem;color:var(--text-muted);padding:.5rem .25rem">Немає інших новин</p>` : ''}
                        </div>
                        <div style="margin-top:1rem;padding-top:.75rem;border-top:1px solid var(--border)">
                            <button class="btn btn-ghost btn-sm" style="width:100%" onclick="Router.go('news')">
                                Всі новини →
                            </button>
                        </div>
                    </aside>

                </div>`;

            if (news.allow_reactions !== false) this._loadReactions(id);
        } catch(e) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Новину не знайдено</h3><button class="btn btn-primary" onclick="Router.go('news')">← Назад</button></div>`;
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
                upBtn.classList.toggle('btn-primary', myR === 'up');
                upBtn.classList.toggle('btn-ghost',   myR !== 'up');
                dnBtn.classList.toggle('btn-primary', myR === 'down');
                dnBtn.classList.toggle('btn-ghost',   myR !== 'down');
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
            const upEl   = document.getElementById('react-up-count');
            const downEl = document.getElementById('react-down-count');
            const upBtn  = document.getElementById('btn-react-up');
            const dnBtn  = document.getElementById('btn-react-down');
            if (!upEl) return;
            upEl.textContent   = up;
            downEl.textContent = down;
            upBtn.classList.toggle('btn-primary', mine === 'up');
            upBtn.classList.toggle('btn-ghost',   mine !== 'up');
            dnBtn.classList.toggle('btn-primary', mine === 'down');
            dnBtn.classList.toggle('btn-ghost',   mine !== 'down');
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

    _openForm(news) {
        const isEdit = !!news?.id;
        const catLabels = { general:'Загальні', announcements:'Оголошення', updates:'Оновлення', events:'Події' };

        const pubDateVal = news?.published_at
            ? new Date(news.published_at).toISOString().slice(0,16)
            : new Date().toISOString().slice(0,16);
        const expDateVal = news?.expires_at
            ? new Date(news.expires_at).toISOString().slice(0,16)
            : '';

        UI.setBreadcrumb([
            { label: 'Новини', route: 'news' },
            { label: isEdit ? 'Редагувати' : 'Нова новина' }
        ]);

        const container = document.getElementById('page-content');
        container.innerHTML = `
            <style>
                .nf-layout{display:grid;grid-template-columns:1fr 290px;gap:1.5rem;align-items:start}
                .nf-main{display:flex;flex-direction:column;gap:1rem}
                .nf-sidebar{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;position:sticky;top:1rem}
                .nf-sidebar-title{padding:.65rem 1rem;font-size:.8rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--primary);border-bottom:1px solid var(--border);background:rgba(99,102,241,.06);text-align:center}
                .nf-sidebar-body{padding:1rem;display:flex;flex-direction:column;gap:1rem}
                .nf-field{display:flex;flex-direction:column;gap:.35rem}
                .nf-field label{font-size:.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em}
                .nf-sep{height:1px;background:var(--border);margin:.25rem 0}
                .nf-img-preview{border-radius:var(--radius-md);overflow:hidden;max-height:140px}
                .nf-img-preview img{width:100%;height:140px;object-fit:cover;display:block}
                .nf-img-change{text-align:center;margin-top:.5rem}
                .nf-title-input{background:transparent;border:none;border-bottom:2px solid var(--border);padding:.5rem 0;font-size:1.4rem;font-weight:600;color:var(--text-primary);width:100%;outline:none;transition:border-color var(--transition);font-family:inherit}
                .nf-title-input:focus{border-bottom-color:var(--primary)}
                .nf-title-input::placeholder{color:var(--text-muted)}
                .nf-editor-wrap{border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden}
                .nf-html-bar{display:flex;align-items:center;gap:.5rem;background:var(--bg-raised);border-bottom:1px solid var(--border);padding:.3rem .5rem}
                .nf-html-bar-label{font-size:.75rem;font-weight:600;color:var(--text-secondary);padding:0 .25rem;display:flex;align-items:center;gap:.35rem}
                .nf-html-bar-sep{width:1px;height:18px;background:var(--border);flex-shrink:0}
                .nf-media-panel{border-top:1px solid var(--border);background:var(--bg-raised)}
                .nf-media-bar{display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem;border-bottom:1px solid var(--border)}
                .nf-media-bar span{flex:1}
                .nf-media-grid{display:flex;flex-wrap:wrap;gap:.5rem;padding:.75rem;min-height:60px;max-height:200px;overflow-y:auto}
                .nf-media-thumb{width:80px;height:60px;border-radius:var(--radius-sm);overflow:hidden;border:2px solid transparent;cursor:pointer;flex-shrink:0;background:var(--bg-surface);transition:border-color var(--transition);position:relative}
                .nf-media-thumb:hover{border-color:var(--primary)}
                .nf-media-thumb img{width:100%;height:100%;object-fit:contain;display:block}
                .nf-media-file{width:80px;height:60px;border-radius:var(--radius-sm);border:2px solid transparent;cursor:pointer;flex-shrink:0;background:var(--bg-surface);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.25rem;transition:border-color var(--transition);padding:.25rem}
                .nf-media-file:hover{border-color:var(--primary)}
                .nf-media-file span{font-size:.6rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;text-align:center}
                @media(max-width:768px){.nf-layout{grid-template-columns:1fr}}
            </style>

            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.5rem">
                <button class="btn btn-ghost btn-sm" onclick="Router.go('news')">← Назад</button>
                <h2 style="margin:0">${isEdit ? '✏️ Редагувати новину' : 'Додати новину'}</h2>
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
                        <label>Категорія</label>
                        <select id="n-category">
                            ${Object.entries(catLabels).map(([v,l]) =>
                                `<option value="${v}" ${news?.category===v?'selected':''}>${l}</option>`
                            ).join('')}
                        </select>
                    </div>

                    <div class="nf-field">
                        <label>Текст *</label>
                        <div class="nf-editor-wrap">
                            <!-- Панель HTML-редактора -->
                            <div class="nf-html-bar">
                                <span class="nf-html-bar-label">&#60;/&#62; HTML + CSS</span>
                                <div class="nf-html-bar-sep"></div>
                                <button type="button" class="btn btn-ghost btn-sm" onclick="NewsPage._previewNews()">👁 Перегляд</button>
                                <div style="flex:1"></div>
                                <label class="btn btn-ghost btn-sm" style="cursor:pointer;display:flex;align-items:center;gap:.35rem;margin:0">
                                    📎 Файл
                                    <input id="n-attach-input" type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.mp4,.mp3" style="display:none" onchange="NewsPage._attachFile(this)">
                                </label>
                            </div>
                            <!-- HTML textarea -->
                            <textarea id="n-html-src" style="width:100%;min-height:460px;padding:1rem;font-family:monospace;font-size:.85rem;background:var(--bg-raised);color:var(--text-primary);border:none;outline:none;resize:vertical;line-height:1.6;tab-size:2;box-sizing:border-box" placeholder="Введіть HTML+CSS тут..."></textarea>
                            <!-- Медіатека -->
                            <div class="nf-media-panel" id="n-media-panel">
                                <div class="nf-media-bar">
                                    <span style="font-size:.8rem;font-weight:600;color:var(--text-secondary)">📁 Медіатека</span>
                                    <button type="button" class="btn btn-ghost btn-sm" id="n-media-toggle" onclick="NewsPage._toggleMedia()">▲ Сховати</button>
                                </div>
                                <div class="nf-media-grid" id="n-media-grid">
                                    <div style="padding:1rem;color:var(--text-muted);font-size:.8rem">Завантаження...</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="display:flex;gap:.75rem;padding-top:.5rem">
                        <button class="btn btn-secondary" onclick="Router.go('news')">Скасувати</button>
                        <button class="btn btn-ghost" onclick="NewsPage._previewNews()">👁 Перегляд</button>
                        <button class="btn btn-primary" onclick="NewsPage.saveNews('${news?.id || ''}')">
                            ${isEdit ? 'Зберегти зміни' : 'Опублікувати'}
                        </button>
                    </div>
                </div>

                <!-- ── Права колонка (опції) ── -->
                <div class="nf-sidebar">
                    <div class="nf-sidebar-title">опції</div>
                    <div class="nf-sidebar-body">

                        <div class="nf-field">
                            <label>Мітки</label>
                            <input id="n-tags" type="text"
                                   value="${news?.tags?.join(', ') || ''}"
                                   placeholder="тег1, тег2...">
                        </div>

                        <div class="nf-sep"></div>

                        <div class="nf-field">
                            <label>Опубліковано</label>
                            <input id="n-published-at" type="datetime-local" value="${pubDateVal}">
                        </div>

                        <div class="nf-field">
                            <label>Актуально до</label>
                            <input id="n-expires-at" type="datetime-local" value="${expDateVal}">
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
                            <label>Головне зображення</label>
                            <div style="font-size:.7rem;color:var(--text-muted);line-height:1.5;margin-bottom:.4rem">
                                Рекомендований розмір: <strong style="color:var(--text-secondary)">1200 × 630 px</strong><br>
                                Формат: JPG, PNG · до 5 МБ
                            </div>
                            ${news?.thumbnail_url
                                ? `<div class="nf-img-preview"><img id="n-img-preview" src="${news.thumbnail_url}"></div>
                                   <div class="nf-img-change"><button class="btn btn-ghost btn-sm" onclick="document.getElementById('n-img-input').click()">Змінити</button></div>`
                                : `<div id="news-img-zone"></div>`}
                            <input id="n-img-input" type="file" accept="image/*" style="display:none"
                                   onchange="NewsPage._onImgChange(this)">
                        </div>

                    </div>
                </div>
            </div>`;

        // Заповнюємо textarea наявним контентом
        const ta = document.getElementById('n-html-src');
        if (news?.content) ta.value = news.content;

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
            title: '👁 Перегляд новини',
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
        try {
            const { data, error } = await supabase.storage
                .from(APP_CONFIG.buckets.newsImages)
                .list('content/', { limit: 200, sortBy: { column: 'name', order: 'desc' } });
            if (error) throw error;
            if (!data?.length) {
                grid.innerHTML = `<div style="padding:.5rem;color:var(--text-muted);font-size:.8rem">Поки немає файлів</div>`;
                return;
            }
            const baseUrl = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.newsImages}/content`;
            grid.innerHTML = data.map(f => {
                const url  = `${baseUrl}/${f.name}`;
                const ext  = f.name.split('.').pop().toLowerCase();
                const isImg = /^(jpg|jpeg|png|gif|webp|svg)$/.test(ext);
                const icon = { pdf:'📄', doc:'📝', docx:'📝', xls:'📊', xlsx:'📊', zip:'🗜', mp4:'🎬', mp3:'🎵' }[ext] || '📎';
                if (isImg) return `
                    <div class="nf-media-thumb" onclick="NewsPage._insertMediaFile('${url}','${f.name}',true)" title="${f.name}">
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

    _toggleMedia() {
        const grid   = document.getElementById('n-media-grid');
        const toggle = document.getElementById('n-media-toggle');
        if (!grid) return;
        const hidden = grid.style.display === 'none';
        grid.style.display = hidden ? '' : 'none';
        toggle.textContent = hidden ? '▲ Сховати' : '▼ Показати';
    },

    _insertMediaFile(url, name, isImage) {
        const ta  = document.getElementById('n-html-src');
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
            const ext  = file.name.split('.').pop().toLowerCase();
            const name = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const path = `content/${name}`;
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

    _getContent() {
        return document.getElementById('n-html-src')?.value || '';
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
        if (!content || !content.trim()) { Toast.error('Помилка', 'Додайте зміст'); return; }

        const tagsRaw = Dom.val('n-tags').trim();
        const tags    = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

        const isPublished = document.getElementById('n-published').checked;
        const pubAt = Dom.val('n-published-at');
        const expAt = Dom.val('n-expires-at');

        const fields = {
            title,
            content,
            category:        Dom.val('n-category'),
            tags:            tags.length ? tags : null,
            is_published:    isPublished,
            is_featured:     document.getElementById('n-featured').checked,
            allow_reactions: document.getElementById('n-reactions').checked,
            published_at:    isPublished ? (pubAt ? new Date(pubAt).toISOString() : new Date().toISOString()) : null,
            expires_at:      expAt ? new Date(expAt).toISOString() : null
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

            Toast.success('Успішно!', `Новина "${title}" ${id ? 'оновлена' : 'додана'}`);
            const target = `#/news/${news.id}`;
            if (location.hash === target) {
                Router._navigate(); // хеш не змінився — форсуємо рендер
            } else {
                Router.go(`news/${news.id}`);
            }
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
            Toast.success('Новина видалина');
            Router.go('news');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    }
};
