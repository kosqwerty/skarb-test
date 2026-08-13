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
        this._view = 'all';

        container.innerHTML = `
            <style>
                .nvs-switch{display:inline-flex;gap:3px;background:var(--bg-surface);border:1px solid var(--border);border-radius:999px;padding:3px}
                .nvs-btn{border:none;background:transparent;color:var(--text-muted);padding:.5rem .95rem;border-radius:999px;cursor:pointer;font-size:.82rem;font-weight:600;font-family:inherit;transition:background .18s,color .18s;display:flex;align-items:center;gap:.4rem;white-space:nowrap}
                .nvs-btn:hover{color:var(--text-primary)}
                .nvs-btn.active{background:var(--primary);color:#fff;box-shadow:0 2px 8px var(--primary-glow)}
                .nvs-count{background:var(--bg-raised);color:var(--text-secondary);border-radius:999px;padding:0 .45rem;font-size:.72rem;font-weight:700;min-width:1.3rem;text-align:center;line-height:1.5}
                .nvs-btn.active .nvs-count{background:rgba(255,255,255,.25);color:#fff}
                @media(max-width:640px){.page-header{flex-wrap:wrap}.nvs-switch{order:3;width:100%}}

                /* ── "Vault Ledger" — редизайн hero + сітки новин ──
                   Темний hero — фіксований (як і раніше), незалежно від теми
                   застосунку (той самий підхід, що вже був у _renderFeatured).
                   Картки сітки лишаються на var(--bg-surface)/var(--border),
                   щоб коректно працювати в світлій/темній темі — золото/рубін/
                   смарагд тут лише акцентні токени поверх теми, не заміна їй. */
                :root{ --vlg-gold:#d4a856; --vlg-gold-2:#f0c869; --vlg-ruby:#b5384f; --vlg-emerald:#2f8f6b; }

                /* min-width:0 на обох треках — без цього grid-колонка з fr не
                   стискається нижче intrinsic-ширини вмісту (класична пастка
                   CSS grid), і довгий заголовок у стрічці "звужував" hero,
                   бо той відсовувався праворуч. */
                /* Сітка новин йде одразу під hero в тій самій (лівій) колонці —
                   стрічка "Також цього тижня" тримається окремою колонкою
                   праворуч на всю висоту (hero + сітка разом), а не одним
                   рядком тільки з hero. Якщо стрічки немає (немає featured) —
                   .vlg-layout.no-ledger колапсує в одну колонку на всю ширину. */
                .vlg-layout{display:grid;grid-template-columns:1fr 350px;gap:1.75rem;align-items:start}
                .vlg-layout.no-ledger{grid-template-columns:1fr}
                .vlg-layout.no-ledger .vlg-ledger{display:none}
                .vlg-main{min-width:0;display:flex;flex-direction:column;gap:.75rem}
                .news-grid{grid-template-columns:repeat(auto-fit,minmax(min(430px,100%),1fr));max-width:none}
                .vlg-hero-main{
                    min-width:0;
                    position:relative;border-radius:var(--radius-xl);overflow:hidden;min-height:400px;
                    background:radial-gradient(120% 100% at 85% 0%,rgba(212,168,86,.22),transparent 60%),
                               linear-gradient(155deg,#211c48 0%,#140f30 60%,#0d0b1f 100%);
                    border:1px solid rgba(212,168,86,.16);cursor:pointer;
                    display:flex;flex-direction:column;justify-content:flex-end;padding:2.5rem 2.75rem;
                    transition:border-color .2s;
                }
                .vlg-hero-main:hover{border-color:var(--vlg-gold)}
                .vlg-hero-main::before{
                    content:'';position:absolute;inset:0;pointer-events:none;
                    background-image:linear-gradient(rgba(212,168,86,.05) 1px,transparent 1px),
                                      linear-gradient(90deg,rgba(212,168,86,.05) 1px,transparent 1px);
                    background-size:38px 38px;-webkit-mask-image:radial-gradient(ellipse at top right,black,transparent 70%);mask-image:radial-gradient(ellipse at top right,black,transparent 70%);
                }
                .vlg-hero-bg{position:absolute;inset:0;background-size:auto 100%;background-repeat:no-repeat;background-position:center}
                .vlg-hero-fade{position:absolute;inset:0;background:linear-gradient(0deg,rgba(13,11,31,.5) 5%,rgba(13,11,31,.28) 55%,rgba(13,11,31,.13) 100%)}
                .vlg-hero-tag{position:relative;display:inline-flex;align-items:center;gap:8px;font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--vlg-gold-2);margin-bottom:1.1rem}
                .vlg-hero-tag::before{content:'◆';font-size:8px}
                .vlg-hero-main h2{position:relative;font-size:1.85rem;font-weight:700;line-height:1.22;margin:0 0 .85rem;max-width:640px;color:#fbf7ec;text-wrap:balance}
                .vlg-hero-main p{position:relative;font-size:.95rem;line-height:1.6;color:#a89fc9;max-width:560px;margin:0 0 1.5rem;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
                .vlg-hero-foot{position:relative;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
                .vlg-byline{display:flex;align-items:center;gap:.7rem;font-size:.85rem;color:#cfc9e6}
                .vlg-avatar{width:36px;height:36px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,var(--vlg-gold),#8a6a2e);display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;font-family:-apple-system,sans-serif;color:#1a1530;flex-shrink:0}
                .vlg-avatar img{width:100%;height:100%;object-fit:cover;display:block}
                .vlg-byline small{display:block;color:#8b83ab;font-size:.72rem;margin-top:.1rem;font-family:-apple-system,sans-serif}
                .vlg-read{display:inline-flex;align-items:center;gap:.4rem;background:rgba(13,11,31,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border:1px solid var(--vlg-gold);color:var(--vlg-gold-2);font-size:.75rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:.65rem 1.15rem;border-radius:var(--radius-md);cursor:pointer;transition:all .2s;flex-shrink:0}
                .vlg-read:hover{background:var(--vlg-gold);color:#1a1530}

                /* Світла тема — тепле кремово-золоте тло замість темного індиго,
                   темний наві-текст замість білого (той самий підхід, що вже
                   є в expert-path.js для .ep-hero). */
                body.light-theme .vlg-hero-main{
                    background:radial-gradient(120% 100% at 85% 0%,rgba(42,94,232,.18),transparent 60%),
                               linear-gradient(120deg,#f3f6fd 0%,#e6edfb 55%,#dbe6fa 100%);
                    border-color:rgba(42,94,232,.3);
                }
                body.light-theme .vlg-hero-main:hover{border-color:var(--primary)}
                body.light-theme .vlg-hero-fade{background:linear-gradient(0deg,rgba(243,246,253,.46) 5%,rgba(243,246,253,.2) 55%,transparent 100%)}
                body.light-theme .vlg-hero-tag{color:var(--primary)}
                body.light-theme .vlg-hero-main h2{color:#1b2350}
                body.light-theme .vlg-hero-main p{color:rgba(27,35,80,.65)}
                body.light-theme .vlg-byline{color:#3a3560}
                body.light-theme .vlg-byline small{color:rgba(27,35,80,.5)}
                body.light-theme .vlg-read{background:rgba(255,255,255,.7);border-color:var(--primary);color:var(--primary)}
                body.light-theme .vlg-read:hover{background:var(--primary);color:#fff}

                .vlg-ledger{min-width:0;border:1px solid var(--border);border-radius:var(--radius-xl);background:var(--bg-surface);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 24px -12px rgba(0,0,0,.18)}
                .vlg-ledger-head{padding:1rem 1.25rem;border-bottom:1px solid var(--border);font-size:.7rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--vlg-gold)}
                .vlg-ledger-item{padding:.9rem 1.25rem;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:.6rem;cursor:pointer;transition:background .18s}
                .vlg-ledger-item:last-child{border-bottom:none}
                .vlg-ledger-item:hover{background:var(--bg-hover)}
                .vlg-ledger-thumb{width:100%;height:170px;border-radius:var(--radius-md);overflow:hidden;flex-shrink:0;background:var(--bg-raised)}
                .vlg-ledger-thumb img{width:100%;height:100%;object-fit:cover;display:block}
                .vlg-ledger-thumb-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:1.4rem;background:linear-gradient(135deg,rgba(212,168,86,.1),rgba(139,92,246,.08))}
                .vlg-ledger-text{min-width:0;flex:1}
                .vlg-ledger-item h4{font-size:.92rem;font-weight:400;line-height:1.35;margin:0 0 .3rem;color:var(--text-primary);text-wrap:balance;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
                .vlg-ledger-item time{font-size:.68rem;color:var(--text-muted);font-family:-apple-system,sans-serif}
                @media(max-width:900px){.vlg-layout{grid-template-columns:1fr}}

                .news-card{border-radius:var(--radius-lg);transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease}
                .news-card:hover{border-color:var(--vlg-gold);box-shadow:0 12px 28px -18px rgba(0,0,0,.35)}
                .vlg-draft-tag{position:absolute;top:.6rem;left:.6rem;z-index:2;display:inline-flex;align-items:center;gap:.35rem;padding:.3rem .6rem;font-size:.65rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(13,11,31,.75);backdrop-filter:blur(6px);border:1px solid rgba(212,168,86,.4);color:var(--vlg-gold-2);border-radius:var(--radius-sm)}
            </style>
            <div class="page-header">
                <div class="page-title">
                    <button class="btn-back" style="margin-bottom:.5rem" onclick="Router.go('dashboard')"><i class="fa-solid fa-arrow-left"></i> Назад</button>
                    <h1>📰 Новини та оголошення</h1>
                    <p>Останні події</p>
                </div>
                <div class="page-actions" style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
                    ${AppState.isStaff() ? `
                        <div class="nvs-switch" id="news-view-switch">
                            <button class="nvs-btn active" data-view="all" onclick="NewsPage.setView('all')">
                                <i class="fa-solid fa-layer-group"></i> Усі
                            </button>
                            <button class="nvs-btn" data-view="published" onclick="NewsPage.setView('published')">
                                <i class="fa-solid fa-circle-check"></i> Опубліковано
                            </button>
                            <button class="nvs-btn" data-view="drafts" onclick="NewsPage.setView('drafts')">
                                <i class="fa-regular fa-file-lines"></i> Чернетки
                                <span class="nvs-count" id="nvs-draft-count">0</span>
                            </button>
                        </div>` : ''}
                    ${AppState.isStaff() && AppState.canMutate() ? `<button class="btn btn-primary" onclick="NewsPage.openCreate()"><i class="fa-solid fa-plus"></i> Додати новину</button>` : ''}
                </div>
            </div>

            <div class="vlg-layout" id="vlg-layout">
                <div class="vlg-main">
                    <div id="featured-news"></div>
                    <div id="news-grid" class="news-grid"></div>
                </div>
                <div class="vlg-ledger" id="vlg-ledger"></div>
            </div>
            <div id="news-pagination" style="display:flex;justify-content:center;gap:.5rem;margin-top:2rem"></div>`;

        await this.load();
        if (params.create) this.openCreate();
    },

    setView(view) {
        if (this._view === view) return;
        this._view = view;
        this._page = 0;
        document.querySelectorAll('#news-view-switch .nvs-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        this.load();
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
        const isDraftsView = AppState.isStaff() && this._view === 'drafts';
        const isPublishedView = AppState.isStaff() && this._view === 'published';
        const featuredEl = document.getElementById('featured-news');
        if (featuredEl) featuredEl.innerHTML = '';
        const ledgerEl = document.getElementById('vlg-ledger');
        if (ledgerEl) { ledgerEl.innerHTML = ''; ledgerEl.style.display = ''; }

        try {
            // Для не-staff завжди тільки опубліковані; для staff — залежно від
            // перемикача "Усі / Опубліковано / Чернетки" в хедері.
            const publishedParam = !AppState.isStaff() ? true
                : isDraftsView ? false
                : isPublishedView ? true
                : undefined;
            const [{ data, count }, draftCount] = await Promise.all([
                API.news.getAll({ published: publishedParam, page: this._page }),
                AppState.isStaff() ? this._getDraftCount() : Promise.resolve(0)
            ]);
            const badge = document.getElementById('nvs-draft-count');
            if (badge) badge.textContent = draftCount;

            // Access group filter for non-staff
            const byAccessGroup = AppState.isStaff()
                ? data
                : data.filter(n => !n.access_group || AccessGroupsPage.checkAccess(n.access_group));
            // Мережева видимість — окремий вимір від ролі/групи доступу (адмін
            // задає в редагуванні новини), тож застосовується до всіх, включно
            // зі staff, які так само фізично можуть бути поза довіреною мережею.
            const filtered = byAccessGroup.filter(n => this._matchesNetwork(n));

            // Головною може бути лише ОПУБЛІКОВАНА новина — без цієї умови
            // у вкладці "Усі" (де staff бачить і чернетки в одному списку)
            // знята з публікації головна новина й далі лишалась у hero, бо
            // фільтр перевіряв тільки is_featured, ігноруючи is_published.
            const featured = !isDraftsView ? filtered.filter(n => n.is_featured && n.is_published).slice(0, 1)[0] : null;

            // На вкладці "Чернетки" hero не рендериться взагалі (featured === null
            // вище), тож тут не треба виключати is_featured-новини зі списку —
            // інакше чернетка, позначена "Головною", зникала б звідусіль.
            // Виключаємо саме той запис, що пішов у hero (за id) — раніше тут
            // була перевірка "filtered.indexOf(n) > 0", яка звіряла позицію
            // новини в загальному списку (за датою публікації), а не серед
            // featured-новин, тож головна новина дублювалась у сітці щоразу,
            // коли вона не була водночас найсвіжішою публікацією.
            const regular = filtered.filter(n => n.id !== featured?.id);
            const gridItems = regular;

            // Стрічка "Також цього тижня" поруч із hero — свіжі новини, не
            // "вирізані" з gridItems (раніше забирала 3 картки з сітки, тому
            // здавалось, що частина новин зникла). Підвантажується окремим
            // легким запитом, як "Читайте також" на сторінці статті.
            const showLedger = !!featured && this._page === 0;
            document.getElementById('vlg-layout')?.classList.toggle('no-ledger', !showLedger);
            if (featured) {
                this._renderFeatured(featured);
                if (showLedger) this._loadLedger(featured.id);
            }

            if (!gridItems.length && !featured) {
                grid.innerHTML = isDraftsView ? `
                    <div class="empty-state" style="grid-column:1/-1">
                        <div class="empty-icon">📝</div>
                        <h3>Немає чернеток</h3>
                        <p style="color:var(--text-muted)">Усі новини опубліковані.</p>
                    </div>` : `
                    <div class="empty-state" style="grid-column:1/-1">
                        <div class="empty-icon">📰</div>
                        <h3>Скоро буде новина</h3>
                        ${AppState.isStaff() && AppState.canMutate() ? `<button class="btn btn-primary" onclick="NewsPage.openCreate()">Додати першуш новину</button>` : ''}
                    </div>`;
                this._renderPagination(0);
                return;
            }

            grid.innerHTML = gridItems.map(n => this._renderCard(n)).join('');
            this._renderPagination(count);
            const reactIds = gridItems.filter(n => n.allow_reactions !== false).map(n => n.id);
            if (reactIds.length) this._loadCardReactions(reactIds);
        } catch(e) {
            grid.innerHTML = `<div style="grid-column:1/-1;color:var(--danger)">${e.message}</div>`;
        }
    },

    async _getDraftCount() {
        try {
            // Мережева видимість застосовується й до staff (див. коментар у
            // load()), тож рахуємо через клієнтський фільтр, а не .count() —
            // інакше бейдж показував би більше, ніж реально видно у вкладці
            // "Чернетки" (напр. чернетка, обмежена "тільки довірена мережа",
            // поки адмін поза довіреною мережею).
            const { data } = await supabase.from('news')
                .select('id,network_visibility')
                .eq('is_published', false)
                .limit(500);
            return (data || []).filter(n => this._matchesNetwork(n)).length;
        } catch { return 0; }
    },

    _renderFeatured(news) {
        const el = document.getElementById('featured-news');
        if (!el) return;
        const excerpt = Fmt.esc((news.excerpt || '').replace(/<[^>]+>/g, '').slice(0, 220)).replace(/\n/g, '<br>');
        const authorName = Fmt.esc(news.author?.full_name || '—');
        const initials = Fmt.initials(news.author?.full_name || '');

        el.innerHTML = `
            <div class="vlg-hero-main" onclick="Router.go('news/${news.slug || news.id}')">
                ${news.thumbnail_url ? `<div class="vlg-hero-bg" style="background-image:url('${news.thumbnail_url}');background-position:${news.thumbnail_position || 'center'} center"></div>` : ''}
                <div class="vlg-hero-fade"></div>
                <span class="vlg-hero-tag">Головна новина</span>
                <h2>${Fmt.esc(news.title)}</h2>
                ${excerpt ? `<p>${excerpt}</p>` : ''}
                <div class="vlg-hero-foot">
                    <div class="vlg-byline">
                        <span class="vlg-avatar">${news.author?.avatar_url ? `<img src="${Fmt.safeUrl(news.author.avatar_url)}" alt="">` : initials}</span>
                        <div>${authorName}<small>${Fmt.date(news.published_at || news.created_at)}</small></div>
                    </div>
                    <button class="vlg-read" onclick="event.stopPropagation();Router.go('news/${news.slug || news.id}')"><i class="fa-solid fa-eye"></i> Читати</button>
                </div>
            </div>`;
    },

    async _loadLedger(excludeId) {
        const el = document.getElementById('vlg-ledger');
        if (!el) return;
        try {
            // Тягнемо ширший пул кандидатів (не рівно 3) — новини з обмеженою
            // групою доступу чи мережевою видимістю треба відфільтрувати так
            // само, як і в основному списку, інакше стрічка "витікала" б
            // заголовки/картинки чужих обмежених новин будь-кому.
            const { data: candidates } = await supabase.from('news')
                .select(`id,slug,title,thumbnail_url,thumbnail_position,published_at,created_at,
                    network_visibility,
                    access_group:access_groups(id,name,is_public,
                        cities:access_group_cities(city),
                        positions:access_group_positions(position),
                        departments:access_group_departments(department),
                        labels:access_group_labels(label))`)
                .eq('is_published', true)
                .neq('id', excludeId)
                .order('published_at', { ascending: false, nullsFirst: false })
                .limit(12);
            const data = (candidates || [])
                .filter(n => this._matchesNetwork(n))
                .filter(n => !n.access_group || AccessGroupsPage.checkAccess(n.access_group))
                .slice(0, 3);
            if (!data.length) { el.style.display = 'none'; return; }
            // Ще актуальний контейнер? (могли встигнути перемкнути вкладку/сторінку)
            if (!document.getElementById('vlg-ledger')) return;
            el.innerHTML = `
                <div class="vlg-ledger-head">Також цього тижня</div>
                ${data.map((n, i) => `
                    <div class="vlg-ledger-item" onclick="Router.go('news/${n.slug || n.id}')">
                        <div class="vlg-ledger-thumb">
                            ${n.thumbnail_url
                                ? `<img src="${n.thumbnail_url}" style="object-position:${n.thumbnail_position || 'center'} center" loading="lazy">`
                                : `<div class="vlg-ledger-thumb-ph"><i class="fa-regular fa-newspaper"></i></div>`}
                        </div>
                        <div class="vlg-ledger-text">
                            <h4>${Fmt.esc(n.title)}</h4>
                            <time>${Fmt.date(n.published_at || n.created_at, { day:'numeric', month:'short' })}</time>
                        </div>
                    </div>`).join('')}`;
        } catch(_) { el.style.display = 'none'; }
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
                    ${!news.is_published ? '<span class="vlg-draft-tag">Чернетка</span>' : ''}
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
            // Пряме посилання (чи клік зі стрічки "Також цього тижня") не
            // повинно обходити ні мережеве обмеження, ні групу доступу —
            // раніше тут перевірялась лише мережа, тож користувач без
            // потрібної групи доступу міг відкрити повний текст обмеженої
            // новини за прямим посиланням.
            if (!this._matchesNetwork(news)) {
                Toast.error('Немає доступу', 'Ця новина недоступна з вашої мережі');
                Router.go(from === 'dashboard' ? 'dashboard' : 'news');
                return;
            }
            if (news.access_group && !AccessGroupsPage.checkAccess(news.access_group)) {
                Toast.error('Немає доступу', 'Ця новина недоступна для вашої групи доступу');
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
                    /* Без картинки новини в hero — суцільна кольорова плашка
                       під текст (та сама мова бренду, що й .vlg-hero-main:
                       індиго+золото в темній темі, блакитний у світлій). */
                    .nv-hero{
                        position:relative;width:100%;min-height:280px;border-radius:var(--radius-xl);overflow:hidden;
                        background:radial-gradient(120% 100% at 85% 0%,rgba(212,168,86,.22),transparent 60%),
                                   linear-gradient(155deg,#211c48 0%,#140f30 60%,#0d0b1f 100%);
                        display:flex;align-items:flex-end;
                    }
                    .nv-hero::before{
                        content:'';position:absolute;inset:0;pointer-events:none;
                        background-image:linear-gradient(rgba(212,168,86,.05) 1px,transparent 1px),
                                          linear-gradient(90deg,rgba(212,168,86,.05) 1px,transparent 1px);
                        background-size:38px 38px;-webkit-mask-image:radial-gradient(ellipse at top right,black,transparent 70%);mask-image:radial-gradient(ellipse at top right,black,transparent 70%);
                    }
                    .nv-hero-content{position:relative;width:100%;max-width:680px;padding:1.75rem 2rem;z-index:3}
                    .nv-hero-badges{display:flex;gap:.5rem;margin-bottom:.65rem;flex-wrap:wrap}
                    .nv-hero-title{font-size:2rem;font-weight:800;color:#fbf7ec;line-height:1.25;margin:0}
                    .nv-hero-meta{display:flex;align-items:center;gap:1.25rem;margin-top:.65rem;color:#a89fc9;font-size:.82rem}
                    .nv-hero-actions{position:absolute;top:1rem;left:1rem;display:flex;gap:.5rem;z-index:3}
                    /* Світла тема — той самий підхід, що й для .vlg-hero-main:
                       теплий світлий фейд + темний наві-текст замість білого. */
                    body.light-theme .nv-hero{
                        background:radial-gradient(120% 100% at 85% 0%,rgba(42,94,232,.18),transparent 60%),
                                   linear-gradient(120deg,#f3f6fd 0%,#e6edfb 55%,#dbe6fa 100%);
                    }
                    body.light-theme .nv-hero-title{color:#1b2350}
                    body.light-theme .nv-hero-meta{color:rgba(27,35,80,.65)}
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

                    /* ── Коментарі ── */
                    .nv-comments{margin-top:1.5rem;padding:1.5rem clamp(1.25rem,4vw,2rem);background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-xl)}
                    .nv-comments-head{font-size:1rem;font-weight:700;color:var(--text-primary);margin-bottom:1rem;display:flex;align-items:center;gap:.5rem}
                    .nv-comments-head i{color:var(--primary)}
                    .nv-comments-head span{font-weight:400;color:var(--text-muted);font-size:.85rem}
                    .nv-comment-form{position:relative;margin-bottom:1.25rem}
                    .nv-comment-input{display:block;box-sizing:border-box;width:100%;resize:vertical;min-height:52px;font-family:inherit;font-size:.9rem;line-height:1.5;
                        padding:.7rem .85rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-raised);color:var(--text-primary)}
                    .nv-comment-input:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-glow)}
                    .nv-comment-toolbar{display:flex;align-items:center;justify-content:space-between;gap:.6rem;margin-top:.6rem}
                    .nv-emoji-wrap{position:relative;flex-shrink:0}
                    .nv-emoji-btn{width:34px;height:34px;border-radius:50%;border:1px solid var(--border);background:var(--bg-raised);
                        color:var(--text-secondary);cursor:pointer;font-size:.95rem;padding:0;display:flex;align-items:center;justify-content:center;transition:background .15s,border-color .15s}
                    .nv-emoji-btn:hover{background:var(--bg-hover);border-color:var(--primary);color:var(--primary)}
                    /* Відкриваємо ВНИЗ (не вгору) — інакше палітра накладається на
                       саму textarea, яка стоїть прямо над тулбаром, і виглядає як
                       "поламаний" оверлей поверх поля вводу. */
                    .nv-emoji-picker{position:absolute;top:calc(100% + 8px);left:0;z-index:30;width:272px;box-sizing:border-box;
                        background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);
                        box-shadow:0 12px 32px rgba(0,0,0,.18);padding:.6rem;display:grid;grid-template-columns:repeat(8,34px);gap:.2rem}
                    .nv-emoji-picker[hidden]{display:none}
                    .nv-emoji-opt{width:34px;height:34px;border:none;background:none;font-size:1.1rem;line-height:1;
                        display:flex;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;transition:background .12s}
                    .nv-emoji-opt:hover{background:var(--bg-hover)}
                    .nv-comments-list{display:flex;flex-direction:column;gap:1rem}
                    .nv-comment{display:flex;gap:.7rem}
                    .nv-comment-ava{width:36px;height:36px;border-radius:50%;flex-shrink:0;object-fit:cover;
                        display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:#fff;
                        background:linear-gradient(135deg,var(--primary),#8b5cf6)}
                    .nv-comment-body{flex:1;min-width:0}
                    .nv-comment-head{display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap}
                    .nv-comment-name{font-size:.85rem;font-weight:700;color:var(--text-primary)}
                    .nv-comment-time{font-size:.72rem;color:var(--text-muted)}
                    .nv-comment-text{font-size:.9rem;color:var(--text-secondary);line-height:1.55;margin-top:.15rem;white-space:pre-wrap;word-break:break-word}
                    .nv-comment-del{margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:.78rem;padding:.15rem .3rem;opacity:.6;transition:opacity .15s,color .15s}
                    .nv-comment-del:hover{opacity:1;color:var(--danger)}
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
                    @media(max-width:900px){.nv-top,.nv-article{grid-template-columns:1fr}.nv-sidebar{position:static}.nv-hero{min-height:220px}.nv-hero-title{font-size:1.5rem}.nv-hero-content{padding:1.25rem}}
                    @media(max-width:768px){
                        .nv-hero{min-height:180px;border-radius:10px}
                        .nv-hero-title{font-size:1.15rem;line-height:1.3}
                        .nv-hero-content{padding:.9rem 1rem}
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

                        <div class="nv-comments" id="nv-comments">
                            <div class="nv-comments-head"><i class="fa-regular fa-comments"></i> Коментарі <span id="nv-comments-count"></span></div>
                            <div class="nv-comment-form">
                                <textarea id="nv-comment-input" class="nv-comment-input" placeholder="Написати коментар… (Ctrl+Enter — надіслати)" rows="2" maxlength="2000"
                                    onkeydown="if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();NewsPage._submitComment('${news.id}');}"></textarea>
                                <div class="nv-comment-toolbar">
                                    <div class="nv-emoji-wrap">
                                        <button type="button" class="nv-emoji-btn" title="Емодзі" onclick="NewsPage._toggleEmojiPicker()"><i class="fa-regular fa-face-smile"></i></button>
                                        <div class="nv-emoji-picker" id="nv-emoji-picker" hidden></div>
                                    </div>
                                    <button type="button" class="btn btn-primary btn-sm" onclick="NewsPage._submitComment('${news.id}')"><i class="fa-solid fa-paper-plane"></i> Надіслати</button>
                                </div>
                            </div>
                            <div class="nv-comments-list" id="nv-comments-list">
                                <div style="padding:1rem;text-align:center;color:var(--text-muted);font-size:.85rem">Завантаження…</div>
                            </div>
                        </div>
                    </div>
                </article>`;

            if (news.allow_reactions !== false) this._loadReactions(news.id);
            this._loadComments(news.id);
        } catch(e) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Новину не знайдено</h3><button class="btn-back" onclick="Router.go('news')"><i class="fa-solid fa-arrow-left"></i> Назад</button></div>`;
        }
    },

    async _loadCardReactions(ids) {
        try {
            const { data: all } = await supabase.from('news_reactions').select('news_id,emoji').in('news_id', ids.filter(Boolean));
            const { data: mine } = await supabase.from('news_reactions').select('news_id,emoji').in('news_id', ids.filter(Boolean)).eq('user_id', AppState.user.id);
            const mySet = new Set((mine || []).map(r => `${r.news_id}:${r.emoji}`));
            for (const id of ids) {
                const counts = {};
                (all || []).filter(r => r.news_id === id).forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
                // Позиція емодзі фіксована — не сортуємо за кількістю, інакше
                // кнопки "стрибали" б місцями під курсором при кожному лайку.
                for (const e of ['👍','❤️','😂','😮','👏','🔥']) {
                    const btn = document.getElementById(`ce-${id}-${e.codePointAt(0)}`);
                    if (!btn) continue;
                    btn.querySelector('.nv-react-count').textContent = counts[e] || '';
                    btn.classList.toggle('active', mySet.has(`${id}:${e}`));
                }
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
            const { added } = await API.news.toggleEmoji(newsId, emoji);
            // Перечитуємо реальний стан з БД замість ручної математики cur±1.
            const { counts, myEmojis } = await API.news.getEmojiReactions(newsId);
            for (const e of ['👍','❤️','😂','😮','👏','🔥']) {
                const b = document.getElementById(`ce-${newsId}-${e.codePointAt(0)}`);
                if (!b) continue;
                b.querySelector('.nv-react-count').textContent = counts[e] || '';
                b.classList.toggle('active', myEmojis.has(e));
            }
            btn.style.transform = 'scale(1.35)';
            setTimeout(() => { btn.style.transform = ''; }, 200);
            if (added) UI.emojiBurst(btn, emoji);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { btn.disabled = false; }
    },

    async _loadReactions(newsId) {
        try {
            const { counts, myEmojis } = await API.news.getEmojiReactions(newsId);
            // На сторінці статті позиція емодзі фіксована (не сортуємо за
            // кількістю, як у списку новин) — інакше кнопки "стрибали" б
            // місцями під курсором при кожному лайку.
            for (const e of ['👍','❤️','😂','😮','👏','🔥']) {
                const btn = document.getElementById(`nv-react-${newsId}-${e.codePointAt(0)}`);
                if (!btn) continue;
                btn.querySelector('.nv-react-count').textContent = counts[e] || '';
                btn.classList.toggle('active', myEmojis.has(e));
            }
        } catch { /* ігноруємо якщо таблиці ще немає */ }
    },

    async _reactArticleEmoji(newsId, emoji, btn) {
        // Блокуємо кнопку на час запиту — без цього швидкі повторні кліки
        // летіли паралельно, і локальний лічильник (+1 на кожен клік) не
        // відповідав реальним даним у БД (можна було "накрутити" число лайків).
        if (btn.disabled) return;
        btn.disabled = true;
        try {
            const { added } = await API.news.toggleEmoji(newsId, emoji);
            // Перечитуємо реальний стан з БД замість ручної математики cur±1
            // (заодно й пересортовує ряд емодзі за реальною кількістю).
            await this._loadReactions(newsId);
            btn.style.transform = 'scale(1.4)';
            setTimeout(() => { btn.style.transform = ''; }, 200);
            if (added) UI.emojiBurst(btn, emoji);
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { btn.disabled = false; }
    },

    // ── Коментарі ────────────────────────────────────────────────────
    _commentEmojis: ['😀','😂','😍','😘','🥰','😎','🤔','😢','😭','😡','👍','👎','👏','🙏','🔥','❤️','💯','🎉','🚀','✅','⭐','😴','🤝','🙌','😅','🤗','😉','🥳','😮','🤯'],

    async _loadComments(newsId) {
        const list = document.getElementById('nv-comments-list');
        try {
            const comments = await API.newsComments.getByNewsId(newsId);
            this._comments = comments;
            this._commentsNewsId = newsId;
            const countEl = document.getElementById('nv-comments-count');
            if (countEl) countEl.textContent = comments.length ? `(${comments.length})` : '';
            if (!list) return;
            list.innerHTML = comments.length ? comments.map(c => this._commentHtml(c)).join('') :
                `<div style="padding:1rem;text-align:center;color:var(--text-muted);font-size:.85rem">Ще немає коментарів — будьте першим</div>`;
        } catch (e) {
            if (list) list.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--text-muted);font-size:.85rem">Не вдалося завантажити коментарі</div>`;
        }
    },

    _commentHtml(c) {
        const u = c.user || {};
        const isMine = u.id === AppState.user?.id;
        const canDelete = isMine || AppState.isAdmin();
        const avatar = u.avatar_url
            ? `<img class="nv-comment-ava" src="${Fmt.safeUrl(u.avatar_url)}" alt="">`
            : `<div class="nv-comment-ava">${Fmt.esc(Fmt.initials(u.full_name || '?'))}</div>`;
        return `
            <div class="nv-comment" id="nv-comment-${c.id}">
                ${avatar}
                <div class="nv-comment-body">
                    <div class="nv-comment-head">
                        <span class="nv-comment-name">${Fmt.esc(u.full_name || 'Користувач')}</span>
                        <span class="nv-comment-time">${Fmt.datetime(c.created_at)}</span>
                        ${canDelete ? `<button type="button" class="nv-comment-del" title="Видалити" onclick="NewsPage._deleteComment('${c.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </div>
                    <div class="nv-comment-text">${Fmt.esc(c.content)}</div>
                </div>
            </div>`;
    },

    async _submitComment(newsId) {
        const input = document.getElementById('nv-comment-input');
        const content = input?.value.trim();
        if (!content) return;
        try {
            await API.newsComments.add(newsId, content);
            input.value = '';
            document.getElementById('nv-emoji-picker')?.setAttribute('hidden', '');
            await this._loadComments(newsId);
            document.getElementById(`nv-comment-${(this._comments[this._comments.length - 1] || {}).id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (e) {
            Toast.error('Помилка', e.message);
        }
    },

    async _deleteComment(id) {
        try {
            await API.newsComments.remove(id);
            document.getElementById(`nv-comment-${id}`)?.remove();
            this._comments = (this._comments || []).filter(c => c.id !== id);
            const countEl = document.getElementById('nv-comments-count');
            if (countEl) countEl.textContent = this._comments.length ? `(${this._comments.length})` : '';
            if (!this._comments.length) {
                const list = document.getElementById('nv-comments-list');
                if (list) list.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--text-muted);font-size:.85rem">Ще немає коментарів — будьте першим</div>`;
            }
        } catch (e) {
            Toast.error('Помилка', e.message);
        }
    },

    _toggleEmojiPicker() {
        const picker = document.getElementById('nv-emoji-picker');
        if (!picker) return;
        const show = picker.hasAttribute('hidden');
        if (show) {
            picker.innerHTML = this._commentEmojis.map(e => `<button type="button" class="nv-emoji-opt" onclick="NewsPage._insertCommentEmoji('${e}')">${e}</button>`).join('');
            picker.removeAttribute('hidden');
            if (!this._emojiOutsideHandler) {
                this._emojiOutsideHandler = (ev) => {
                    const wrap = document.querySelector('.nv-emoji-wrap');
                    if (wrap && !wrap.contains(ev.target)) document.getElementById('nv-emoji-picker')?.setAttribute('hidden', '');
                };
                document.addEventListener('mousedown', this._emojiOutsideHandler);
            }
        } else {
            picker.setAttribute('hidden', '');
        }
    },

    _insertCommentEmoji(emoji) {
        const input = document.getElementById('nv-comment-input');
        if (!input) return;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
        input.focus();
        const pos = start + emoji.length;
        input.setSelectionRange(pos, pos);
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
                /* Заголовок + опис — окрема "hero"-картка, щоб виділятись на
                   тлі решти форми як головний контент, а не рівноправне поле. */
                .nf-hero-card{background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.35rem 1.5rem;box-shadow:0 1px 3px rgba(0,0,0,.04)}
                .nf-hero-card .nf-sep{margin:1.1rem 0}
                .nf-textarea{width:100%;box-sizing:border-box;padding:.6rem .75rem;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-family:inherit;font-size:.9rem;line-height:1.6;outline:none;resize:vertical;transition:border-color .15s,box-shadow .15s}
                .nf-textarea:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-glow)}
                .nf-content-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
                .nf-content-head .btn{
                    font-size:.72rem;padding:.3rem .6rem;
                    background:var(--bg-surface);border-color:color-mix(in srgb,var(--c,var(--primary)) 45%,var(--border));
                    color:var(--c,var(--primary));
                }
                .nf-content-head .btn:hover{background:color-mix(in srgb,var(--c,var(--primary)) 12%,var(--bg-surface));border-color:var(--c,var(--primary))}
                /* Редактор і живе прев'ю — поруч, щоб не тиснути кнопку
                   "Перегляд" щоразу; медіатека — окрема горизонтальна смуга
                   знизу на всю ширину (раніше була вузькою бічною колонкою). */
                .nf-editor-wrap{display:flex;flex-direction:column}
                .nf-editor-top{display:grid;grid-template-columns:1fr 1fr}
                .nf-editor-top.nf-preview-hidden{grid-template-columns:1fr}
                .nf-editor-top.nf-preview-hidden .nf-live-preview{display:none}
                .nf-editor-top.nf-preview-hidden .nf-editor-left{border-right:none}
                .nf-editor-left{display:flex;flex-direction:column;border-right:1px solid var(--border);min-width:0}
                .nf-quill-wrap{flex:1;display:flex;flex-direction:column}
                .nf-quill-wrap .ql-toolbar{border:none;border-bottom:1px solid var(--border);background:var(--bg-raised);flex-shrink:0}
                .nf-quill-wrap .ql-container{border:none;flex:1;font-size:1rem;font-family:inherit;min-height:440px}
                .nf-quill-wrap .ql-editor{min-height:440px;line-height:1.8;color:var(--text-primary);padding:1rem 1.25rem}
                .nf-quill-wrap .ql-editor.ql-blank::before{color:var(--text-muted);font-style:normal}
                .nf-live-preview{min-width:0;min-height:460px;max-height:460px;overflow-y:auto;padding:1rem 1.25rem;background:var(--bg-surface)}
                .nf-live-preview .news-content-body{font-size:.92rem}
                .nf-live-preview-empty{color:var(--text-muted);font-size:.82rem;padding:.5rem 0}
                .nf-media-panel{background:var(--bg-raised);border-top:1px solid var(--border);display:flex;align-items:stretch;min-width:0}
                .nf-media-bar{display:flex;flex-direction:column;justify-content:center;gap:.4rem;padding:.6rem .9rem;border-right:1px solid var(--border);flex-shrink:0}
                .nf-media-bar-title{font-size:.78rem;font-weight:600;color:var(--text-secondary);white-space:nowrap}
                .nf-media-grid{display:flex;flex-wrap:nowrap;gap:.4rem;padding:.6rem;flex:1;overflow-x:auto;overflow-y:hidden;align-items:center}
                .nf-media-thumb{width:72px;height:54px;border-radius:var(--radius-sm);overflow:hidden;border:2px solid transparent;cursor:pointer;flex-shrink:0;background:var(--bg-surface);transition:border-color var(--transition)}
                .nf-media-thumb:hover{border-color:var(--primary)}
                .nf-media-thumb img{width:100%;height:100%;object-fit:contain;display:block}
                .nf-media-file{width:72px;height:54px;border-radius:var(--radius-sm);border:2px solid transparent;cursor:pointer;flex-shrink:0;background:var(--bg-surface);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.2rem;transition:border-color var(--transition);padding:.2rem}
                .nf-media-file:hover{border-color:var(--primary)}
                .nf-media-file span{font-size:.55rem;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;text-align:center}
                @media(max-width:768px){.nf-editor-top{grid-template-columns:1fr}.nf-editor-left{border-right:none;border-bottom:1px solid var(--border)}}
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
                        <button class="btn btn-primary" onclick="NewsPage.saveNews('${news?.id || ''}')">
                            ${isEdit ? '<i class="fa-solid fa-floppy-disk" style="font-size:1rem;filter:drop-shadow(0 0 4px rgba(99,102,241,.7))"></i> Зберегти зміни' : '<i class="fa-regular fa-newspaper" style="color:#1e40af"></i> Опублікувати'}
                        </button>
                </div>
            </div>

            <div class="nf-layout">

                <!-- ── Ліва колонка ── -->
                <div class="nf-main">
                    <div class="nf-hero-card">
                        <div class="nf-field">
                            <label>Тема *</label>
                            <input id="n-title" class="nf-title-input" type="text"
                                   value="${(news?.title || '').replace(/"/g,'&quot;')}"
                                   placeholder="Введіть заголовок новини...">
                        </div>

                        <div class="nf-sep"></div>

                        <div class="nf-field">
                            <label><i class="fa-regular fa-image" style="color:var(--primary);margin-right:.3rem"></i>Текст на картинці <span style="font-weight:400;color:var(--text-muted)">(превью)</span></label>
                            <textarea id="n-excerpt" class="nf-textarea" rows="2" maxlength="220" placeholder="Короткий опис — відображається на картці та у герої…"
                                oninput="const l=this.value.length;const c=document.getElementById('n-excerpt-count');c.textContent=l+' / 220';c.style.color=l>200?'var(--danger)':l>160?'var(--warning)':'var(--text-muted)'"
                            >${Fmt.esc(news?.excerpt || '')}</textarea>
                            <div style="display:flex;justify-content:space-between;align-items:center">
                                <span style="font-size:.72rem;color:var(--text-muted)">Якщо порожньо — текст не відображається на картці.</span>
                                <span id="n-excerpt-count" style="font-size:.72rem;color:var(--text-muted)">${(news?.excerpt||'').length} / 220</span>
                            </div>
                        </div>
                    </div>

                    <div class="nfx-card" style="--c:var(--primary)">
                        <div class="nfx-card-head nf-content-head">
                            <span><i class="fa-solid fa-pen-nib"></i> Контент *</span>
                            <div style="display:flex;gap:.4rem">
                                <button type="button" class="btn btn-ghost btn-sm" id="nf-live-preview-toggle" onclick="NewsPage._toggleLivePreview(this)">
                                    <i class="fa-regular fa-eye-slash"></i> Сховати прев'ю
                                </button>
                                <button type="button" class="btn btn-ghost btn-sm" onclick="NewsPage._previewNews()">
                                    <i class="fa-solid fa-eye"></i> Перегляд
                                </button>
                            </div>
                        </div>
                        <div class="nfx-card-body" style="padding:0">
                            <div class="nf-editor-wrap">
                                <div class="nf-editor-top">
                                    <div class="nf-editor-left">
                                        <textarea id="n-html-src" oninput="NewsPage._updateLivePreview()" style="flex:1;width:100%;min-height:460px;padding:1rem;font-family:monospace;font-size:.82rem;background:var(--bg-raised);color:var(--text-primary);border:none;outline:none;resize:none;line-height:1.6;tab-size:2;box-sizing:border-box" placeholder="HTML...">${Fmt.esc(news?.content || '')}</textarea>
                                    </div>
                                    <div class="nf-live-preview" id="nf-live-preview">
                                        ${news?.content ? `<div class="news-content-body">${this._fixImgUrls(news.content)}</div>` : `<div class="nf-live-preview-empty">Прев'ю з'явиться тут, щойно почнете писати…</div>`}
                                    </div>
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
                                    <input type="checkbox" id="n-featured" class="nfx-toggle-input" ${news?.is_featured ? 'checked' : ''} onchange="NewsPage._onFeaturedToggle(this,'${news?.id || ''}')">
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
                                    <select id="n-network-visibility" class="nfx-select"
                                        style="--c:${news?.network_visibility === 'trusted' ? '#16a34a' : '#8b5cf6'}"
                                        onchange="this.style.setProperty('--c', this.value==='trusted' ? '#16a34a' : '#8b5cf6')">
                                        <option value="all" ${(!news?.network_visibility || news.network_visibility === 'all') ? 'selected' : ''}>Всім (незалежно від мережі)</option>
                                        <option value="trusted" style="color:#16a34a" ${news?.network_visibility === 'trusted' ? 'selected' : ''}>Тільки довірена мережа</option>
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
                                   <div class="nf-img-change" style="display:flex;gap:.4rem;justify-content:center">
                                       <button class="btn btn-ghost btn-sm" onclick="document.getElementById('n-img-input').click()"><i class="fa-solid fa-arrows-rotate"></i> Змінити</button>
                                       <button class="btn btn-danger btn-sm" onclick="NewsPage._removeThumbnail()"><i class="fa-solid fa-trash"></i> Видалити</button>
                                   </div>`
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
        this._removeThumbnailFlag = false;
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
        const title   = Fmt.esc(document.getElementById('n-title')?.value || '(без заголовку)');
        const content = this._getContent();
        if (!content || content === '<p><br></p>') {
            Toast.error('Перегляд', 'Немає вмісту для перегляду');
            return;
        }
        // Перегляд у обох темах, незалежно від поточної теми застосунку —
        // перевизначаємо CSS custom properties локально на .nvp-preview,
        // а не body.light-theme (щоб не чіпати реальну тему всього застосунку
        // поки відкрита модалка). Кольори — точні значення зі :root/light-theme
        // в main.css.
        Modal.open({
            title: '<i class="fa-solid fa-eye"></i> Перегляд новини',
            size: 'xl',
            body: `
                <style>
                    .nvp-switch{display:inline-flex;gap:3px;background:var(--bg-raised);border:1px solid var(--border);border-radius:999px;padding:3px;margin-bottom:1rem}
                    .nvp-switch button{border:none;background:transparent;color:var(--text-secondary);padding:.4rem .9rem;border-radius:999px;cursor:pointer;font-size:.78rem;font-weight:600;font-family:inherit;display:inline-flex;align-items:center;gap:.4rem;transition:background .18s,color .18s}
                    .nvp-switch button.on{background:var(--primary);color:#fff}
                    .nvp-preview{border-radius:var(--radius-lg);padding:1.5rem 1.75rem;border:1px solid var(--border);transition:background .2s,color .2s}
                    .nvp-preview.theme-dark{
                        --bg-base:#0A0A12;--bg-surface:#12121E;--bg-raised:#1A1A2E;--border:#2A2A45;--text-primary:#E2E8F0;--text-secondary:#94A3B8;
                        background:var(--bg-surface);color:var(--text-primary);
                    }
                    .nvp-preview.theme-light{
                        --bg-base:#F8FAFC;--bg-surface:#FFFFFF;--bg-raised:#F1F5F9;--border:#E2E8F0;--text-primary:#374151;--text-secondary:#4B5563;
                        background:var(--bg-surface);color:var(--text-primary);
                    }
                    .nvp-preview h1{font-size:1.75rem;line-height:1.3;margin:0 0 1.5rem;color:var(--text-primary)}
                </style>
                <div class="nvp-switch" id="nvp-switch">
                    <button class="on" data-t="dark" onclick="NewsPage._setPreviewTheme('dark',this)"><i class="fa-solid fa-moon"></i> Темна</button>
                    <button data-t="light" onclick="NewsPage._setPreviewTheme('light',this)"><i class="fa-solid fa-sun"></i> Світла</button>
                </div>
                <div class="nvp-preview theme-dark" id="nvp-preview">
                    <h1>${title}</h1>
                    <div class="news-content-body">${this._fixImgUrls(content)}</div>
                </div>`,
            footer: `<button class="btn btn-secondary" onclick="Modal.close()">Закрити</button>`
        });
    },

    _setPreviewTheme(theme, btn) {
        document.querySelectorAll('#nvp-switch button').forEach(b => b.classList.toggle('on', b === btn));
        const el = document.getElementById('nvp-preview');
        if (el) el.className = `nvp-preview theme-${theme}`;
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
        this._updateLivePreview();
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
            this._updateLivePreview();

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

    _updateLivePreview() {
        clearTimeout(this._livePreviewTimer);
        this._livePreviewTimer = setTimeout(() => {
            const el = document.getElementById('nf-live-preview');
            if (!el) return;
            const content = this._getContent().trim();
            el.innerHTML = content
                ? `<div class="news-content-body">${this._fixImgUrls(content)}</div>`
                : `<div class="nf-live-preview-empty">Прев'ю з'явиться тут, щойно почнете писати…</div>`;
        }, 300);
    },

    _toggleLivePreview(btn) {
        const top = document.querySelector('.nf-editor-top');
        if (!top) return;
        const hidden = top.classList.toggle('nf-preview-hidden');
        btn.innerHTML = hidden
            ? '<i class="fa-regular fa-eye"></i> Показати прев\'ю'
            : '<i class="fa-regular fa-eye-slash"></i> Сховати прев\'ю';
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
        this._removeThumbnailFlag = false;
        this._previewImg(input.files[0]);
    },

    async _removeThumbnail() {
        const ok = await Modal.confirm({
            title: 'Видалити зображення',
            message: 'Прибрати головне зображення новини? Зміни набудуть чинності після збереження.',
            confirmText: 'Видалити',
            danger: true
        });
        if (!ok) return;
        this._newsImgFile = null;
        this._removeThumbnailFlag = true;
        const card = document.getElementById('n-img-input')?.closest('.nfx-card-body');
        const zoneHost = card?.querySelector('.nf-img-preview')?.parentElement || card;
        if (zoneHost) {
            zoneHost.querySelector('.nf-img-preview')?.remove();
            zoneHost.querySelector('.nf-img-change')?.remove();
            const zone = document.createElement('div');
            zone.id = 'news-img-zone';
            zoneHost.insertBefore(zone, document.getElementById('n-img-input'));
            const input = FileUpload.createDropZone(zone, {
                accept: 'image/*',
                label: 'Завантажити зображення',
                hint: 'PNG, JPG до 5 МБ'
            });
            input.addEventListener('change', () => {
                this._newsImgFile = input.files[0];
                this._removeThumbnailFlag = false;
                this._previewImg(input.files[0]);
            });
        }
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

    // Головною може бути лише одна новина. При активації тумблера попереджаємо,
    // що поточна головна новина (якщо є) втратить цей статус.
    async _onFeaturedToggle(checkbox, currentId) {
        if (!checkbox.checked) return;
        try {
            let q = supabase.from('news').select('id,title').eq('is_featured', true).limit(1);
            if (currentId) q = q.neq('id', currentId);
            const { data } = await q;
            const other = data?.[0];
            if (!other) return;
            const ok = await Modal.confirm({
                title: 'Головна новина',
                message: `Новина «${other.title}» зараз головна і перестане нею бути. Продовжити?`,
                confirmText: 'Так, замінити'
            });
            if (!ok) checkbox.checked = false;
        } catch(_) { /* якщо запит не вдався — не блокуємо збереження */ }
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
        if (this._removeThumbnailFlag && !this._newsImgFile) fields.thumbnail_url = null;

        Loader.show();
        try {
            let news;
            if (id) news = await API.news.update(id, fields);
            else    news = await API.news.create(fields);

            // Головною може бути тільки одна новина — примусово знімаємо
            // статус з решти на сервері (не покладаємось лише на попередження
            // в UI, щоб не було двох головних при паралельному редагуванні).
            if (fields.is_featured) {
                await supabase.from('news').update({ is_featured: false }).eq('is_featured', true).neq('id', news.id);
            }

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
            // Видалення можуть викликати як зі списку новин (route вже #/news
            // — Router.go('news') нічого не перерендерить), так і зі сторінки
            // статті (#/news/id — там Router.go справді змінює маршрут).
            if ((location.hash.slice(2) || '') === 'news') {
                const container = document.getElementById('page-content');
                if (container) { await NewsPage.init(container, {}); return; }
            }
            Router.go('news');
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    }
};
