// ================================================================
// EduFlow LMS — Сторінки (Custom Pages) з HTML/CSS редактором
// ================================================================

const CollectionsPage = {

    _navHandler: null,
    _themeHandler: null,
    _pageTrail: [],      // history of pages visited via in-page links
    _currentPage: null,  // page currently displayed

    // ── List ─────────────────────────────────────────────────────
    async init(container) {
        if (this._navHandler) {
            window.removeEventListener('message', this._navHandler);
            this._navHandler = null;
        }
        if (this._themeHandler) {
            window.removeEventListener('lms-theme-change', this._themeHandler);
            this._themeHandler = null;
        }
        this._pageTrail  = [];
        this._currentPage = null;
        UI.setBreadcrumb([{ label: 'Сторінки' }]);

        // Не-адмін → одразу відкриває головну сторінку
        if (!AppState.isAdmin()) {
            container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
            try {
                const pages = await API.pages.getAll();
                const home = pages.find(p => p.is_home && p.is_published)
                           || pages.find(p => p.is_published);
                if (home) {
                    Router.go(`collections/${home.id}`);
                } else {
                    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🪄</div><h3>Сторінок поки немає</h3></div>`;
                }
            } catch(e) {
                container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
            }
            return;
        }

        container.innerHTML = `
            <div class="page-header">
                <div class="page-title">
                    <h1>📄 Сторінки</h1>
                    <p>Власні HTML-сторінки з довільним стилем та посиланнями.</p>
                </div>
                <div class="page-actions">
                    ${AppState.canMutate() ? `<button class="btn btn-primary" onclick="CollectionsPage.openEditor()">+ Нова сторінка</button>` : ''}
                </div>
            </div>
            <div id="pages-list"></div>`;
        await this._loadList();
    },

    async _loadList() {
        const el = document.getElementById('pages-list');
        if (!el) return;
        el.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            const pages = await API.pages.getAll();
            const userLabel = AppState.profile?.label;
            let visible;
            if (AppState.isStaff()) {
                visible = pages;
            } else {
                const [pageDovs, myDovObjs] = await Promise.all([
                    API.pageDovirenosti.getAll().catch(() => []),
                    API.dovirenosti.getForProfile(AppState.user.id).catch(() => [])
                ]);
                const myDovIds = new Set(myDovObjs.map(d => d.id));
                const pageDovMap = {};
                for (const r of pageDovs) {
                    if (!pageDovMap[r.page_id]) pageDovMap[r.page_id] = [];
                    pageDovMap[r.page_id].push(r.dovirenost_id);
                }
                visible = pages.filter(p => {
                    if (!p.is_published) return false;
                    if (p.allowed_labels?.length) {
                        if (!userLabel || !p.allowed_labels.includes(userLabel)) return false;
                    }
                    const pageDovReqs = pageDovMap[p.id] || [];
                    if (pageDovReqs.length) {
                        if (!pageDovReqs.some(id => myDovIds.has(id))) return false;
                    }
                    return true;
                });
            }
            if (!visible.length) {
                el.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🪄</div>
                        <h3>Сторінок поки немає</h3>
                        ${AppState.isStaff() ? '<p>Створіть першу сторінку.</p>' : ''}
                    </div>`;
                return;
            }
            el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.25rem">
                ${visible.map(p => this._renderCard(p)).join('')}
            </div>`;
        } catch (e) {
            el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
        }
    },

    _renderCard(p) {
        const badge = p.is_published
            ? `<span style="font-size:.7rem;padding:2px 8px;border-radius:20px;background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3)">опубліковано</span>`
            : `<span style="font-size:.7rem;padding:2px 8px;border-radius:20px;background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border)">чернетка</span>`;

        const homeBadge = p.is_home
            ? `<span style="font-size:.7rem;padding:2px 8px;border-radius:20px;background:rgba(99,102,241,.15);color:var(--primary);border:1px solid rgba(99,102,241,.3)">🏠 Головна</span>`
            : '';

        const adminBtns = AppState.isStaff() && AppState.canMutate() ? `
            <div style="display:flex;gap:.4rem" onclick="event.stopPropagation()">
                ${!p.is_home && AppState.isOwner() ? `<button onclick="CollectionsPage.setHome('${p.id}')"
                        style="width:30px;height:30px;border-radius:50%;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-secondary);font-size:.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color var(--transition)"
                        onmouseenter="this.style.borderColor='var(--primary)'"
                        onmouseleave="this.style.borderColor='var(--border)'"
                        title="Зробити головною">🏠</button>` : ''}
                <button onclick="CollectionsPage.openEditor('${p.id}')"
                        style="width:30px;height:30px;border-radius:50%;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-secondary);font-size:.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color var(--transition)"
                        onmouseenter="this.style.borderColor='var(--primary)'"
                        onmouseleave="this.style.borderColor='var(--border)'"
                        title="Редагувати"><i class="fa-solid fa-pen"></i></button>
                <button onclick="CollectionsPage.deletePage('${p.id}')"
                        style="width:30px;height:30px;border-radius:50%;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-secondary);font-size:.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color var(--transition)"
                        onmouseenter="this.style.borderColor='var(--danger)'"
                        onmouseleave="this.style.borderColor='var(--border)'"
                        title="Видалити"><i class="fa-solid fa-trash"></i></button>
            </div>` : '';

        return `
            <div onclick="Router.go('collections/${p.id}')"
                 style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.25rem;cursor:pointer;transition:border-color var(--transition),box-shadow var(--transition)"
                 onmouseenter="this.style.borderColor='var(--primary)';this.style.boxShadow='var(--shadow-md)'"
                 onmouseleave="this.style.borderColor='var(--border)';this.style.boxShadow='none'">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.75rem">
                    <div style="display:flex;gap:4px;flex-shrink:0">
                        <span style="font-size:.62rem;font-weight:700;padding:3px 6px;border-radius:4px;background:rgba(249,115,22,.12);color:#f97316;border:1px solid rgba(249,115,22,.25);font-family:'Courier New',monospace;letter-spacing:.01em">HTML</span>
                        <span style="font-size:.62rem;font-weight:700;padding:3px 6px;border-radius:4px;background:rgba(59,130,246,.12);color:#3b82f6;border:1px solid rgba(59,130,246,.25);font-family:'Courier New',monospace;letter-spacing:.01em">CSS</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:.4rem" onclick="event.stopPropagation()">
                        <button class="res-star-btn${Bookmarks.isBookmarked('collections/'+p.id) ? ' active' : ''}"
                            data-bm-route="collections/${p.id}"
                            title="${Bookmarks.isBookmarked('collections/'+p.id) ? 'Видалити з закладок' : 'Зберегти в закладки'}"
                            onclick="Bookmarks.toggleCollection('${p.id}',${JSON.stringify(p.title||'').replace(/"/g,'&quot;')})">${Bookmarks.isBookmarked('collections/'+p.id) ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>'}</button>
                        ${adminBtns}
                    </div>
                </div>
                <div style="font-weight:600;font-size:.95rem;margin-bottom:.4rem">${p.title}</div>
                ${p.allowed_labels?.length ? `
                <div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.5rem">
                    ${p.allowed_labels.map(l => `<span style="font-size:.7rem;padding:2px 7px;border-radius:20px;background:rgba(99,102,241,.1);color:var(--primary);border:1px solid rgba(99,102,241,.2)">🏷 ${l}</span>`).join('')}
                </div>` : ''}
                <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-top:.75rem">
                    ${badge}
                    ${homeBadge}
                    <span style="font-size:.75rem;color:var(--text-muted);margin-left:auto">${Fmt.date(p.updated_at || p.created_at)}</span>
                </div>
            </div>`;
    },

    // ── View ──────────────────────────────────────────────────────
    async initView(container, { id } = {}) {
        if (!id) { Router.go('collections'); return; }
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;
        try {
            const [page, attachments] = await Promise.all([
                API.pages.getById(id),
                API.pageAttachments.getAll(id)
            ]);
            this._attachments = attachments;
            if (!page.is_published && !AppState.isStaff()) {
                Toast.error('Доступ заборонено');
                Router.go('collections');
                return;
            }
            // Label-based and dovirenost-based access check
            if (!AppState.isStaff()) {
                const userLabel = AppState.profile?.label;
                if (page.allowed_labels?.length) {
                    if (!userLabel || !page.allowed_labels.includes(userLabel)) {
                        container.innerHTML = `
                            <div class="empty-state">
                                <div class="empty-icon">🔒</div>
                                <h3>Доступ обмежено</h3>
                                <p style="color:var(--text-muted)">Ця сторінка доступна лише для певних груп користувачів</p>
                                <button class="btn btn-primary" onclick="Router.back()" style="display:inline-flex;align-items:center;gap:.35rem;margin-top:1rem"><i class="fa-solid fa-angle-left"></i> Назад</button>
                            </div>`;
                        return;
                    }
                }
                const pageDovIds = await API.pageDovirenosti.get(id).catch(() => []);
                if (pageDovIds.length) {
                    const myDovs = await API.dovirenosti.getForProfile(AppState.user.id).catch(() => []);
                    const myDovIds = new Set(myDovs.map(d => d.id));
                    if (!pageDovIds.some(dId => myDovIds.has(dId))) {
                        container.innerHTML = `
                            <div class="empty-state">
                                <div class="empty-icon">🔒</div>
                                <h3>Доступ обмежено</h3>
                                <p style="color:var(--text-muted)">Ця сторінка доступна лише для певних довіреностей</p>
                                <button class="btn btn-primary" onclick="Router.back()" style="display:inline-flex;align-items:center;gap:.35rem;margin-top:1rem"><i class="fa-solid fa-angle-left"></i> Назад</button>
                            </div>`;
                        return;
                    }
                }
            }
            this._currentPage = { id: page.id, label: page.title };
            const breadcrumbEl = document.getElementById('breadcrumb');
            if (breadcrumbEl) {
                const parts = this._pageTrail.map((p, i) =>
                    `<a href="javascript:void(0)" onclick="CollectionsPage._trailBack(${i})">${p.label}</a><span>›</span>`
                );
                parts.push(`<span class="current">${page.title}</span>`);
                breadcrumbEl.innerHTML = parts.join('');
            }
            const resolvedHtml = await this._resolveAttachmentUrls(page.html_content || '');
            this._renderView(container, { ...page, html_content: resolvedHtml });
        } catch (e) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3>
                <button class="btn btn-primary" onclick="Router.go('collections')" style="display:inline-flex;align-items:center;gap:.35rem"><i class="fa-solid fa-angle-left"></i> Назад</button></div>`;
        }
    },

    _renderView(container, page) {
        // Remove previous message listener if any
        if (this._navHandler) {
            window.removeEventListener('message', this._navHandler);
            this._navHandler = null;
        }

        const editBtn = AppState.isStaff() && AppState.canMutate() ? `
            <button onclick="CollectionsPage.openEditor('${page.id}')"
                    title="Редагувати"
                    style="flex-shrink:0;width:32px;height:32px;border-radius:50%;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-secondary);font-size:.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background var(--transition),border-color var(--transition)"
                    onmouseenter="this.style.background='var(--bg-hover)';this.style.borderColor='var(--primary)'"
                    onmouseleave="this.style.background='var(--bg-raised)';this.style.borderColor='var(--border)'"><i class="fa-solid fa-pen"></i></button>` : '';

        const infoPanelInner = AppState.isStaff() ? `
            <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;margin-bottom:.75rem">
                <div style="padding:.75rem 1.1rem;background:var(--bg-raised);border-bottom:1px solid var(--border)">
                    <span style="font-weight:700;font-size:.8rem;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted)">
                        <i class="fa-solid fa-circle-info" style="margin-right:.4rem;color:var(--primary)"></i>Інформація
                    </span>
                </div>
                <div style="padding:.9rem 1.1rem;display:flex;flex-direction:column;gap:0">
                    <div style="padding:.75rem 0">
                        <div style="display:flex;align-items:center;gap:.4rem;color:var(--text-muted);font-size:.78rem;margin-bottom:.35rem">
                            <i class="fa-regular fa-clock" style="font-size:.8rem"></i> Створено
                        </div>
                        <div style="color:var(--text-primary);font-weight:600;font-size:.92rem;line-height:1.3">${Fmt.esc(page.creator?.full_name || '—')}</div>
                        <div style="color:var(--text-muted);font-size:.83rem;margin-top:.15rem">${page.created_at ? Fmt.datetime(page.created_at) : '—'}</div>
                    </div>
                    <div style="border-top:1px solid var(--border);padding:.75rem 0">
                        <div style="display:flex;align-items:center;gap:.4rem;color:var(--text-muted);font-size:.78rem;margin-bottom:.35rem">
                            <i class="fa-solid fa-pen-to-square" style="font-size:.8rem"></i> Остання редакція
                        </div>
                        ${(() => {
                            const wasEdited = page.updated_by != null ||
                                (page.updated_at && page.created_at &&
                                Math.abs(new Date(page.updated_at) - new Date(page.created_at)) > 2000);
                            if (!wasEdited) return `<div style="color:var(--text-muted);font-size:.85rem;font-style:italic">Не редагувалась</div>`;
                            return `${page.updater?.full_name
                                ? `<div style="color:var(--text-primary);font-weight:600;font-size:.92rem;line-height:1.3">${Fmt.esc(page.updater.full_name)}</div>`
                                : `<div style="color:var(--text-muted);font-size:.85rem">—</div>`}
                            <div style="color:var(--text-muted);font-size:.83rem;margin-top:.15rem">${Fmt.datetime(page.updated_at)}</div>`;
                        })()}
                    </div>
                    <div style="border-top:1px solid var(--border);padding:.75rem 0 .25rem">
                        <div style="display:flex;align-items:center;gap:.4rem;color:var(--text-muted);font-size:.78rem;margin-bottom:.5rem">
                            <i class="fa-solid fa-tag" style="font-size:.8rem"></i> Статус
                        </div>
                        ${page.is_published
                            ? `<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.83rem;padding:3px 10px;border-radius:20px;background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.25);font-weight:500"><i class="fa-solid fa-circle" style="font-size:.45rem"></i>Опубліковано</span>`
                            : `<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.83rem;padding:3px 10px;border-radius:20px;background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border);font-weight:500"><i class="fa-solid fa-circle" style="font-size:.45rem"></i>Чернетка</span>`}
                    </div>
                </div>
            </div>` : '';

        const errAccordion = `
            <div style="border:1.5px solid rgba(245,158,11,.35);border-radius:var(--radius-lg);overflow:hidden;box-shadow:0 2px 8px rgba(245,158,11,.08)">
                <button onclick="CollectionsPage._toggleErrAccordion()"
                        style="width:100%;display:flex;align-items:center;gap:.6rem;padding:.65rem 1rem;background:rgba(245,158,11,.07);border:none;cursor:pointer;color:var(--text-secondary);font-size:.83rem;font-family:inherit;text-align:left;transition:background var(--transition)"
                        onmouseenter="this.style.background='rgba(245,158,11,.13)'" onmouseleave="this.style.background='rgba(245,158,11,.07)'">
                    <i class="fa-regular fa-flag" style="color:#f59e0b;font-size:.8rem"></i>
                    <span style="flex:1;color:var(--text-primary);font-weight:500">Знайшли помилку?</span>
                    <i id="col-err-chevron" class="fa-solid fa-chevron-down" style="font-size:.7rem;color:#f59e0b;transition:transform .2s"></i>
                </button>
                <div id="col-err-body" style="display:none;padding:.85rem 1rem;background:var(--bg-surface);border-top:1.5px solid rgba(245,158,11,.25)">
                    <textarea id="col-err-text" rows="3" placeholder="Опишіть помилку або неточність…"
                              style="width:100%;resize:vertical;min-height:72px;padding:.55rem .75rem;border:1px solid rgba(245,158,11,.3);border-radius:var(--radius-md);background:var(--bg-raised);color:var(--text-primary);font-size:.85rem;font-family:inherit;outline:none;box-sizing:border-box"
                              onfocus="this.style.borderColor='#f59e0b'" onblur="this.style.borderColor='rgba(245,158,11,.3)'"></textarea>
                    <div style="display:flex;justify-content:flex-end;margin-top:.5rem">
                        <button class="btn btn-sm" id="col-err-submit"
                                style="background:#f59e0b;color:#fff;border:none"
                                onclick="CollectionsPage._submitErrReport('${page.id}',${JSON.stringify(page.title||'').replace(/"/g,'&quot;')})">
                            <i class="fa-solid fa-paper-plane"></i> Надіслати
                        </button>
                    </div>
                </div>
            </div>`;

        const rightPanel = `
            <div style="flex-shrink:0;width:330px">
                ${infoPanelInner}
                ${errAccordion}
            </div>`;

        container.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:1rem">
                <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
                    ${page.is_home ? '' : '<button class="btn btn-ghost btn-sm" onclick="Router.back()" style="display:inline-flex;align-items:center;gap:.35rem;flex-shrink:0"><i class="fa-solid fa-angle-left"></i> Назад</button>'}
                    <div style="display:flex;align-items:center;gap:.5rem;flex:1;min-width:0">
                        <h1 style="margin:0;font-size:1.4rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${page.title}</h1>
                        <button class="res-star-btn${Bookmarks.isBookmarked('collections/'+page.id) ? ' active' : ''}"
                            data-bm-route="collections/${page.id}"
                            title="${Bookmarks.isBookmarked('collections/'+page.id) ? 'Видалити з закладок' : 'Зберегти в закладки'}"
                            onclick="Bookmarks.toggleCollection('${page.id}',${JSON.stringify(page.title||'').replace(/"/g,'&quot;')})">${Bookmarks.isBookmarked('collections/'+page.id) ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>'}</button>
                        ${editBtn}
                    </div>
                </div>
                <div style="display:flex;gap:1.25rem;align-items:flex-start">
                    <div id="page-rendered" style="flex:1;min-width:0;padding-bottom:3rem">
                        ${page.search_enabled ? `
                        <div id="pg-search-bar" style="display:flex;align-items:center;gap:.5rem;padding:.5rem .75rem .5rem 1rem;background:linear-gradient(135deg,var(--bg-raised) 0%,var(--bg-surface) 100%);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:1rem;box-shadow:0 2px 8px rgba(0,0,0,.06);transition:border-color .2s,box-shadow .2s" onfocusin="this.style.borderColor='var(--primary)';this.style.boxShadow='0 0 0 3px rgba(99,102,241,.12),0 2px 8px rgba(0,0,0,.06)'" onfocusout="this.style.borderColor='var(--border)';this.style.boxShadow='0 2px 8px rgba(0,0,0,.06)'">
                            <i class="fa-solid fa-magnifying-glass" style="color:var(--primary);font-size:.85rem;flex-shrink:0;opacity:.8"></i>
                            <input id="pg-search-input" type="text" placeholder="Пошук на сторінці…"
                                   oninput="CollectionsPage._onSearchInput()"
                                   onkeydown="if(event.key==='Enter'){event.preventDefault();CollectionsPage._searchNav(1);}if(event.key==='Escape'){this.value='';CollectionsPage._applySearch('');}"
                                   style="flex:1;border:none;background:transparent;outline:none;font-size:.9rem;color:var(--text-primary);font-family:inherit">
                            <span id="pg-search-count" style="font-size:.75rem;font-weight:600;color:var(--text-muted);white-space:nowrap;min-width:72px;text-align:right;letter-spacing:.01em"></span>
                            <div style="width:1px;height:18px;background:var(--border);flex-shrink:0;margin:0 .15rem"></div>
                            <button onclick="CollectionsPage._searchNav(-1)" title="Попередній"
                                style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;transition:all .15s"
                                onmouseenter="this.style.background='var(--bg-hover)';this.style.borderColor='var(--primary)';this.style.color='var(--primary)'"
                                onmouseleave="this.style.background='var(--bg-surface)';this.style.borderColor='var(--border)';this.style.color='var(--text-secondary)'">
                                <i class="fa-solid fa-chevron-up" style="font-size:.6rem"></i>
                            </button>
                            <button onclick="CollectionsPage._searchNav(1)" title="Наступний"
                                style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;transition:all .15s"
                                onmouseenter="this.style.background='var(--bg-hover)';this.style.borderColor='var(--primary)';this.style.color='var(--primary)'"
                                onmouseleave="this.style.background='var(--bg-surface)';this.style.borderColor='var(--border)';this.style.color='var(--text-secondary)'">
                                <i class="fa-solid fa-chevron-down" style="font-size:.6rem"></i>
                            </button>
                        </div>` : ''}
                        <iframe id="page-iframe" style="width:100%;border:none;display:block" scrolling="no"
                                sandbox="allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation allow-same-origin allow-downloads"></iframe>
                    </div>
                    ${rightPanel}
                </div>
            </div>`;

        // Intercept messages from iframe
        this._navHandler = e => {
            if (e.data?.type === 'lms-navigate') {
                if (this._currentPage) this._pageTrail.push(this._currentPage);
                Router.go(e.data.route);
            }
            if (e.data?.type === 'lms-resize') {
                const iframe = document.getElementById('page-iframe');
                if (!iframe) return;
                if (e.data.height > 0) iframe.style.height = e.data.height + 'px';
            }
        };
        window.addEventListener('message', this._navHandler);

        // Apply dark-mode filter and handle theme changes
        if (this._themeHandler) {
            window.removeEventListener('lms-theme-change', this._themeHandler);
        }
        const applyIframeTheme = (iframe, isLight) => {
            iframe.style.filter = isLight ? '' : 'invert(1) hue-rotate(180deg)';
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'lms-theme-change', isLight }, '*');
            }
        };
        this._themeHandler = e => {
            const iframe = document.getElementById('page-iframe');
            if (iframe) applyIframeTheme(iframe, e.detail.theme === 'light');
        };
        window.addEventListener('lms-theme-change', this._themeHandler);

        const iframe = document.getElementById('page-iframe');
        this._renderIframe(iframe, page.html_content, page.css_content, true);
        if (page.search_enabled) {
            const origLoad = iframe.onload;
            iframe.onload = function() {
                origLoad?.call(this);
                CollectionsPage._searchState = { marks: [], idx: -1, timer: null };
                document.getElementById('pg-search-input')?.focus();
            };
        }
        applyIframeTheme(iframe, document.body.classList.contains('light-theme'));
    },

    _renderIframe(iframe, html, css, interceptLinks = false) {
        css = (css || '').replace(/'Fixel Display'/g, "'Inter'").replace(/'Play'/g, "'Inter'");
        const iframeScript = `
<script>
(function() {
  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'lms-theme-change') return;
    document.documentElement.classList.toggle('lms-dark', !e.data.isLight);
  });
  function sendSize(buffer) {
    var h = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    ) + (buffer || 0);
    if (h > 0) window.parent.postMessage({ type: 'lms-resize', height: h }, '*');
  }
  var collapseTimer;
  document.addEventListener('mousedown', function() {
    clearTimeout(collapseTimer);
    sendSize(400);
  });
  document.addEventListener('click', function() {
    clearTimeout(collapseTimer);
    collapseTimer = setTimeout(function() { sendSize(0); }, 600);
  });
  document.addEventListener('DOMContentLoaded', function() {
    sendSize(0);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function() { sendSize(0); }).observe(document.body);
    }
  });
  window.addEventListener('load', function() {
    sendSize(0);
    setTimeout(function() { sendSize(0); }, 300);
    setTimeout(function() { sendSize(0); }, 800);
  });
})();
<\/script>`;

        const linkScript = interceptLinks ? `
<script>
document.addEventListener('click', function(e) {
  var a = e.target.closest('a[href]');
  if (!a) return;
  var href = a.getAttribute('href');
  if (href && href.startsWith('#')) {
    e.preventDefault();
    window.parent.postMessage({ type: 'lms-navigate', route: href.slice(1) }, '*');
  }
});
<\/script>` : '';

        const doc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><base href="${location.origin}/"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">${iframeScript}
<style>
  body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; font-weight: 400; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  b, strong { font-weight: 700; }
  img, video, canvas, picture, svg { max-width: 100%; }
  /* Re-invert media in dark mode so photos look natural under the iframe filter */
  html.lms-dark img, html.lms-dark video, html.lms-dark canvas, html.lms-dark picture {
    filter: invert(1) hue-rotate(180deg);
  }
  ${css || ''}
</style></head><body>${html || ''}${linkScript}</body></html>`;
        iframe.srcdoc = doc;
        iframe.onload = () => {
            try {
                const d = iframe.contentDocument;
                const measure = () => {
                    const h = Math.max(
                        d.body.scrollHeight, d.body.offsetHeight,
                        d.documentElement.scrollHeight, d.documentElement.offsetHeight
                    );
                    if (h > 0) iframe.style.height = h + 'px';
                };
                measure();
                setTimeout(measure, 300);
                setTimeout(measure, 800);
            } catch (_) {}
        };
    },

    // ── Editor ────────────────────────────────────────────────────
    _editingPageId:       null,
    _attachments:         [],
    _savedCursor:         null,
    _insertCount:         0,
    _insertTimer:         null,
    _insertedIds:         new Set(),
    _searchState:         { marks: [], idx: -1, timer: null },
    _lastSavedAt:         null,
    _isPublished:         false,

    _fmtAgo(date) {
        if (!date) return '';
        const s = Math.floor((Date.now() - date) / 1000);
        if (s < 60) return 'щойно';
        const m = Math.floor(s / 60);
        if (m < 60) return `${m} хв тому`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h} год тому`;
        return Fmt.date(date);
    },

    _updateSavedStatus() {
        const badge = document.getElementById('col-saved-badge');
        const ts    = document.getElementById('col-last-saved');
        if (badge) badge.style.display = '';
        if (ts && this._lastSavedAt) ts.textContent = 'Останнє збереження: ' + this._fmtAgo(this._lastSavedAt);
    },
    _errLastSent:         0,
    _previewTimer:        null,
    _cmHtml:              null,
    _cmCss:               null,
    _isDirty:             false,
    _ctrlSHandler:        null,
    _beforeUnloadHandler: null,
    _cmThemeHandler:      null,

    _destroyEditor() {
        try { this._cmHtml?.toTextArea(); } catch(_) {}
        try { this._cmCss?.toTextArea();  } catch(_) {}
        this._cmHtml = null;
        this._cmCss  = null;
        if (this._ctrlSHandler)        { document.removeEventListener('keydown',    this._ctrlSHandler);        this._ctrlSHandler = null; }
        if (this._beforeUnloadHandler) { window.removeEventListener('beforeunload', this._beforeUnloadHandler); this._beforeUnloadHandler = null; }
        if (this._cmThemeHandler)      { window.removeEventListener('lms-theme-change', this._cmThemeHandler);  this._cmThemeHandler = null; }
        this._isDirty = false;
    },

    _markDirty() {
        if (this._isDirty) return;
        this._isDirty = true;
        const btn = document.getElementById('col-save-btn');
        if (btn) { btn.classList.remove('btn-primary'); btn.classList.add('btn-warning'); btn.innerHTML = '<i class="fa-solid fa-circle" style="font-size:.45rem;vertical-align:middle;margin-right:.35rem"></i> Зберегти'; }
    },

    _markClean() {
        this._isDirty = false;
        const btn = document.getElementById('col-save-btn');
        if (btn) { btn.classList.remove('btn-warning'); btn.classList.add('btn-primary'); btn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Зберегти'; }
    },

    async openEditor(id = null) {
        this._destroyEditor();
        this._editingPageId = id;
        this._attachments   = [];
        this._savedCursor   = null;
        this._insertCount   = 0;
        clearTimeout(this._insertTimer);
        this._insertedIds   = new Set();
        const editHash = '#/' + (id ? `collections/${id}/edit` : 'collections/new');
        if (location.hash !== editHash) history.pushState(null, '', editHash);
        let page = null, attachments = [], groups = [], allDov = [], selectedDovIds = [];
        Loader.show();
        try {
            const fetches = [
                API.accessGroups.getAll().catch(() => []),
                API.dovirenosti.getAll().catch(() => [])
            ];
            if (id) fetches.push(API.pages.getById(id), API.pageAttachments.getAll(id), API.pageDovirenosti.get(id).catch(() => []));
            const results = await Promise.all(fetches);
            groups      = results[0];
            allDov      = results[1];
            if (id) { page = results[2]; attachments = results[3]; selectedDovIds = results[4]; }
        }
        catch (e) { Toast.error('Помилка', e.message); Loader.hide(); return; }
        finally { Loader.hide(); }

        const container = document.getElementById('page-content');
        UI.setBreadcrumb([
            { label: 'Сторінки', link: 'collections' },
            { label: id ? 'Редагувати' : 'Нова сторінка' }
        ]);
        this._allDov = allDov;
        container.innerHTML = this._editorHtml(page, groups, allDov, selectedDovIds);
        this._initEditor(page);
        if (page?.html_content) {
            const found = [...page.html_content.matchAll(/att:([0-9a-f-]{36})/g)];
            found.forEach(m => this._insertedIds.add(m[1]));
        }
        this._renderAttachmentGrid(attachments);
    },

    _editorHtml(page, groups = [], allDov = [], selectedDovIds = []) {
        const selectedLabels = page?.allowed_labels || [];
        const groupNames = groups.map(g => g.name).sort();
        const dovNames = allDov.map(d => ({ id: d.id, name: d.name }));
        const isPublished = page?.is_published || false;
        const hasLabels = (page?.allowed_labels?.length || 0) > 0;
        const hasDovs   = selectedDovIds.length > 0;
        const accessSummary = (hasLabels || hasDovs) ? 'Обмежений доступ' : 'Усі користувачі';
        const savedAt = page?.updated_at ? new Date(page.updated_at) : null;

        return `
        <div style="display:flex;flex-direction:column;height:calc(100vh - 120px);gap:0">

            <!-- Top bar -->
            <div style="padding:.65rem 1rem;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:.75rem">

                <!-- Row 1: back | icon+title | spacer | timestamp | save-split | publish | more -->
                <div style="display:flex;align-items:center;gap:.6rem">

                    <button class="btn btn-ghost btn-sm" onclick="Router.back()" style="display:inline-flex;align-items:center;gap:.35rem;flex-shrink:0;padding:.35rem .6rem">
                        <i class="fa-solid fa-angle-left"></i> Назад
                    </button>

                    <div style="width:32px;height:32px;border-radius:9px;background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        <i class="fa-regular fa-file-lines" style="color:var(--primary);font-size:.9rem"></i>
                    </div>

                    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px">
                        <span style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted);line-height:1">Назва сторінки</span>
                        <div style="display:flex;align-items:center;gap:.5rem">
                            <input id="page-title-input" type="text" value="${Fmt.esc(page?.title || '')}" placeholder="Введіть назву…"
                                   style="font-size:.97rem;font-weight:600;border:none;background:transparent;color:var(--text-primary);outline:none;padding:0;min-width:0;flex:1"
                                   oninput="CollectionsPage._markDirty()">
                            <span id="col-saved-badge" style="display:${page?.id ? 'inline-flex' : 'none'};align-items:center;gap:.25rem;font-size:.7rem;font-weight:600;background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.25);border-radius:20px;padding:1px 8px;white-space:nowrap;flex-shrink:0">
                                <i class="fa-solid fa-check" style="font-size:.55rem"></i> Збережено
                            </span>
                        </div>
                    </div>

                    <span id="col-last-saved" style="font-size:.78rem;color:var(--text-muted);white-space:nowrap;flex-shrink:0">${savedAt ? 'Останнє збереження: ' + CollectionsPage._fmtAgo(savedAt) : ''}</span>

                    <!-- Save split button -->
                    <div style="display:flex;border-radius:var(--radius-md);overflow:hidden;flex-shrink:0;box-shadow:0 2px 6px rgba(99,102,241,.22)">
                        <button id="col-save-btn"
                                onclick="CollectionsPage.savePage('${page?.id || ''}', true)"
                                style="display:inline-flex;align-items:center;gap:.35rem;padding:.38rem .75rem;background:var(--primary);color:#fff;border:none;font-size:.83rem;font-weight:600;cursor:pointer;font-family:inherit;transition:filter .15s"
                                onmouseenter="this.style.filter='brightness(1.1)'" onmouseleave="this.style.filter=''">
                            <i class="fa-solid fa-check"></i> Зберегти
                        </button>
                        <div style="position:relative;display:flex">
                            <button onclick="CollectionsPage._toggleSaveMenu(this)"
                                    style="padding:.38rem .45rem;background:var(--primary);color:rgba(255,255,255,.8);border:none;border-left:1px solid rgba(255,255,255,.18);cursor:pointer;font-size:.7rem;transition:filter .15s"
                                    onmouseenter="this.style.filter='brightness(1.1)'" onmouseleave="this.style.filter=''">
                                <i class="fa-solid fa-chevron-down"></i>
                            </button>
                            <div id="col-save-menu" style="display:none;position:absolute;top:calc(100% + 5px);right:0;z-index:300;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);min-width:200px;overflow:hidden">
                                <button onclick="CollectionsPage.savePage('${page?.id || ''}', 'preview')"
                                        style="width:100%;display:flex;align-items:center;gap:.5rem;padding:.55rem .85rem;background:transparent;border:none;font-size:.84rem;color:var(--text-primary);cursor:pointer;font-family:inherit;text-align:left;transition:background .12s"
                                        onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
                                    <i class="fa-solid fa-eye" style="color:var(--primary);width:14px"></i> Зберегти та переглянути
                                </button>
                                <div style="height:1px;background:var(--border);margin:0 .5rem"></div>
                                <button onclick="CollectionsPage.savePage('${page?.id || ''}', false)"
                                        style="width:100%;display:flex;align-items:center;gap:.5rem;padding:.55rem .85rem;background:transparent;border:none;font-size:.84rem;color:var(--text-primary);cursor:pointer;font-family:inherit;text-align:left;transition:background .12s"
                                        onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
                                    <i class="fa-solid fa-floppy-disk" style="color:var(--text-muted);width:14px"></i> Зберегти та закрити
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Publish button -->
                    <button id="col-publish-btn" onclick="CollectionsPage._togglePublishBtn(this)"
                            data-pub="${isPublished ? '1' : '0'}"
                            style="display:inline-flex;align-items:center;gap:.35rem;padding:.38rem .75rem;border-radius:var(--radius-md);flex-shrink:0;border:1px solid ${isPublished ? 'rgba(16,185,129,.4)' : 'var(--border)'};background:${isPublished ? 'rgba(16,185,129,.1)' : 'var(--bg-surface)'};color:${isPublished ? '#10b981' : 'var(--text-secondary)'};font-size:.83rem;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s">
                        <i class="fa-${isPublished ? 'solid' : 'regular'} fa-circle-check"></i>
                        ${isPublished ? 'Опубліковано' : 'Опублікувати'}
                    </button>

                    <!-- More button -->
                    <div style="position:relative;flex-shrink:0">
                        <button onclick="CollectionsPage._toggleMoreMenu(this)"
                                style="width:32px;height:32px;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1rem;transition:background .15s"
                                onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='var(--bg-surface)'">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                        <div id="col-more-menu" style="display:none;position:absolute;top:calc(100% + 5px);right:0;z-index:300;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);min-width:200px;overflow:hidden">
                            <label style="display:flex;align-items:center;gap:.5rem;padding:.55rem .85rem;cursor:pointer;font-size:.84rem;color:var(--text-primary);transition:background .12s"
                                   onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
                                <input type="checkbox" id="page-search-enabled" ${page?.search_enabled ? 'checked' : ''}>
                                <i class="fa-solid fa-magnifying-glass" style="color:var(--primary);width:14px;font-size:.8rem"></i> Пошук на сторінці
                            </label>
                        </div>
                    </div>

                    <!-- Hidden inputs for savePage() compatibility -->
                    <input type="hidden" id="page-published" value="${isPublished ? '1' : ''}">
                </div>

                <!-- Row 2: access | template | spacer | resources -->
                <div style="display:flex;align-items:center;gap:.5rem;border-top:1px solid var(--border);padding-top:.5rem;margin-top:.55rem;flex-wrap:wrap">

                    <!-- Unified access picker -->
                    <div style="position:relative;flex-shrink:0">
                        <button onclick="CollectionsPage._toggleAccessDropdown()"
                                style="display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .65rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-raised);color:var(--text-secondary);font-size:.82rem;font-weight:500;cursor:pointer;font-family:inherit;transition:background .15s"
                                onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background='var(--bg-raised)'">
                            <i class="fa-solid fa-globe" style="color:var(--primary);font-size:.75rem"></i>
                            Доступ: <span id="col-access-summary" style="font-weight:600">${accessSummary}</span>
                            <i class="fa-solid fa-chevron-down" style="font-size:.6rem;opacity:.6"></i>
                        </button>
                        <div id="col-access-dropdown" style="display:none;position:absolute;top:calc(100% + 6px);left:0;z-index:200;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);padding:.85rem;min-width:280px">
                            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin-bottom:.4rem">Мітки груп</div>
                            <div style="max-height:130px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-raised);padding:.2rem .4rem">
                                ${!groupNames.length
                                    ? `<div style="font-size:.8rem;color:var(--text-muted);padding:.3rem .25rem">Групи не знайдено</div>`
                                    : groupNames.map(name => `
                                    <label style="display:flex;align-items:center;gap:.5rem;padding:.3rem .35rem;border-radius:5px;cursor:pointer;font-size:.84rem"
                                           onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
                                        <input type="checkbox" name="col-group" value="${name.replace(/"/g,'&quot;')}"
                                               ${selectedLabels.includes(name) ? 'checked' : ''}
                                               onchange="CollectionsPage._onTagChange()">
                                        <span>${Fmt.esc(name)}</span>
                                    </label>`).join('')}
                                <label style="display:flex;align-items:center;gap:.5rem;padding:.3rem .35rem;border-radius:5px;cursor:pointer;font-size:.8rem;color:var(--text-muted);border-top:1px solid var(--border);margin-top:.2rem"
                                       onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
                                    <input type="checkbox" id="col-group-all" ${!selectedLabels.length ? 'checked' : ''} onchange="CollectionsPage._clearAllTags()">
                                    <span>Всі користувачі (без обмежень)</span>
                                </label>
                            </div>
                            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin:.65rem 0 .4rem">Довіреності</div>
                            <div style="max-height:130px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-raised);padding:.2rem .4rem">
                                ${!dovNames.length
                                    ? `<div style="font-size:.8rem;color:var(--text-muted);padding:.3rem .25rem">Довіреності не знайдено</div>`
                                    : dovNames.map(d => `
                                    <label style="display:flex;align-items:center;gap:.5rem;padding:.3rem .35rem;border-radius:5px;cursor:pointer;font-size:.84rem"
                                           onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
                                        <input type="checkbox" name="col-dov" value="${d.id}"
                                               ${selectedDovIds.includes(d.id) ? 'checked' : ''}
                                               onchange="CollectionsPage._onDovChange()">
                                        <span>${Fmt.esc(d.name)}</span>
                                    </label>`).join('')}
                                <label style="display:flex;align-items:center;gap:.5rem;padding:.3rem .35rem;border-radius:5px;cursor:pointer;font-size:.8rem;color:var(--text-muted);border-top:1px solid var(--border);margin-top:.2rem"
                                       onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
                                    <input type="checkbox" id="col-dov-all" ${!selectedDovIds.length ? 'checked' : ''} onchange="CollectionsPage._clearAllDovs()">
                                    <span>Без обмежень (всі)</span>
                                </label>
                            </div>
                        </div>
                    </div>


                    <div style="flex:1"></div>

                    <!-- Resources -->
                    <button class="btn btn-ghost btn-sm" onclick="CollectionsPage._insertResourceLink()" style="display:inline-flex;align-items:center;gap:.35rem;flex-shrink:0">
                        <i class="fa-solid fa-paperclip" style="font-size:.8rem"></i> Ресурси
                    </button>
                </div>
            </div>

            <style>
                #col-code-panel .CodeMirror { height:100%!important; font-family:'Courier New',monospace!important; font-size:.88rem!important; line-height:1.6!important; }
                #col-code-panel .CodeMirror-scroll { height:100%; }
                #col-split-handle { width:5px;background:var(--border);cursor:col-resize;flex-shrink:0;transition:background .15s; }
                #col-split-handle:hover { background:var(--primary); }
                .btn-warning { background:var(--warning,#f59e0b)!important; border-color:var(--warning,#f59e0b)!important; color:#fff!important; }
            </style>

            <!-- Split: code left + resize handle + live preview right -->
            <div id="col-split" style="display:flex;gap:0;flex:1;min-height:0;margin-bottom:.75rem">

                <!-- Code panel -->
                <div id="col-code-panel" style="display:flex;flex-direction:column;width:50%;min-width:180px;border:1px solid var(--border);border-radius:var(--radius-lg) 0 0 var(--radius-lg);overflow:hidden">
                    <div style="display:flex;background:var(--bg-raised);border-bottom:1px solid var(--border);flex-shrink:0">
                        <button id="tab-html" onclick="CollectionsPage._switchTab('html')"
                                style="padding:.5rem 1.25rem;font-size:.8rem;font-weight:600;letter-spacing:.05em;border:none;cursor:pointer;background:var(--bg-surface);color:var(--text-primary);border-right:1px solid var(--border);border-bottom:2px solid var(--primary)">HTML</button>
                        <button id="tab-css" onclick="CollectionsPage._switchTab('css')"
                                style="padding:.5rem 1.25rem;font-size:.8rem;font-weight:600;letter-spacing:.05em;border:none;cursor:pointer;background:var(--bg-raised);color:var(--text-muted);border-right:1px solid var(--border);border-bottom:2px solid transparent">CSS</button>
                    </div>
                    <textarea id="editor-html" spellcheck="false">${this._esc(page?.html_content || this._defaultHtml())}</textarea>
                    <textarea id="editor-css" spellcheck="false" style="display:none">${this._esc((page?.css_content || this._defaultCss()).replace(/'Play'/g, "'Inter'").replace(/'Fixel Display'/g, "'Inter'"))}</textarea>
                </div>

                <!-- Resize handle -->
                <div id="col-split-handle" onmousedown="CollectionsPage._startResize(event)"></div>

                <!-- Live preview -->
                <div id="col-preview-panel" style="display:flex;flex-direction:column;flex:1;min-width:180px;border:1px solid var(--border);border-left:none;border-radius:0 var(--radius-lg) var(--radius-lg) 0;overflow:hidden">
                    <div style="padding:.45rem .875rem;background:var(--bg-raised);border-bottom:1px solid var(--border);font-size:.8rem;font-weight:600;color:var(--text-muted);flex-shrink:0">
                        <i class="fa-solid fa-eye" style="margin-right:.4rem"></i>Перегляд
                    </div>
                    <iframe id="live-preview-iframe" style="flex:1;border:none;background:#fff;width:100%"
                            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"></iframe>
                </div>

            </div>

            <!-- Attachment panel -->
            <div id="attachment-panel"
                 style="flex-shrink:0;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-surface);overflow:hidden">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:.45rem .875rem;background:var(--bg-raised);border-bottom:1px solid var(--border)">
                    <span style="display:flex;align-items:center;gap:.5rem">
                        <span style="font-size:.8rem;font-weight:600;color:var(--text-muted);letter-spacing:.03em">📎 Прикріплені файли</span>
                        <span id="col-insert-counter" style="display:none;font-size:.72rem;font-weight:600;background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);border-radius:20px;padding:1px 8px"></span>
                    </span>
                    ${page?.id ? `
                    <label style="cursor:pointer">
                        <span class="btn btn-ghost btn-sm" style="pointer-events:none">+ Додати</span>
                        <input type="file" multiple style="display:none" onchange="CollectionsPage._onAttachFiles(this)">
                    </label>` : `
                    <label style="cursor:pointer">
                        <span class="btn btn-ghost btn-sm" style="pointer-events:none">+ Додати</span>
                        <input type="file" multiple style="display:none" onchange="CollectionsPage._onAttachFilesNew(this)">
                    </label>`}
                </div>
                <div id="attachment-grid"
                     style="display:flex;flex-wrap:wrap;gap:.5rem;padding:.625rem .875rem;min-height:96px;align-items:flex-start;overflow-y:auto;max-height:180px">
                    ${page?.id ? '' : '<span style="font-size:.8rem;color:var(--text-muted);align-self:center">—</span>'}
                </div>
            </div>
        </div>`;
    },

    async _openPreviewModal() {
        const rawHtml = this._cmHtml ? this._cmHtml.getValue() : (document.getElementById('editor-html')?.value || '');
        const css     = this._cmCss  ? this._cmCss.getValue()  : (document.getElementById('editor-css')?.value  || '');
        const html    = await this._resolveAttachmentUrls(rawHtml);

        const backdrop = document.createElement('div');
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:2rem';
        backdrop.id = 'preview-modal';

        const box = document.createElement('div');
        box.style.cssText = 'background:var(--bg-surface);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:900px;height:85vh;display:flex;flex-direction:column;overflow:hidden';

        box.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.25rem;border-bottom:1px solid var(--border);background:var(--bg-raised);flex-shrink:0">
                <span style="font-weight:600;font-size:.95rem"><i class="fa-solid fa-eye"></i> Попередній перегляд</span>
                <button onclick="document.getElementById('preview-modal').remove()"
                        style="width:32px;height:32px;border-radius:50%;border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center">✕</button>
            </div>
            <iframe id="preview-modal-iframe" style="flex:1;border:none;background:#fff"
                    sandbox="allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation allow-same-origin"></iframe>`;

        backdrop.appendChild(box);
        backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', esc); }
        });
        document.body.appendChild(backdrop);

        const iframe = box.querySelector('#preview-modal-iframe');
        this._renderIframe(iframe, html, css);
    },

    // ── Formatting toolbar ────────────────────────────────────────
    _toolbarHtml() {
        const B = (label, fn, tip) =>
            `<button title="${tip}" onclick="${fn}"
                     onmouseenter="this.style.background='var(--bg-hover)'"
                     onmouseleave="this.style.background='var(--bg-surface)'"
                     style="min-width:34px;height:34px;padding:0 7px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);color:var(--text-primary);cursor:pointer;font-size:.95rem;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${label}</button>`;
        const S = `<span style="width:1px;height:22px;background:var(--border);margin:0 4px;flex-shrink:0;display:inline-block"></span>`;

        return `
        <div id="editor-toolbar" style="display:flex;flex-wrap:wrap;gap:3px;padding:.45rem .75rem;background:var(--bg-raised);border-bottom:1px solid var(--border);align-items:center">
            <select onchange="CollectionsPage._insertHeading(this.value);this.selectedIndex=0"
                    style="height:34px;font-size:.85rem;padding:0 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);cursor:pointer;flex-shrink:0">
                <option>Стиль</option>
                <option value="h1">H1 — Заголовок</option>
                <option value="h2">H2 — Підзаголовок</option>
                <option value="h3">H3 — Розділ</option>
                <option value="p">P — Абзац</option>
                <option value="blockquote">❝ Цитата</option>
            </select>
            ${S}
            ${B('<b style="font-size:1rem">B</b>',                "CollectionsPage._fmtWrap('strong')",  'Жирний')}
            ${B('<i style="font-family:serif;font-size:1rem">I</i>', "CollectionsPage._fmtWrap('em')",   'Курсив')}
            ${B('<u style="font-size:.9rem">U</u>',                "CollectionsPage._fmtWrap('u')",      'Підкреслення')}
            ${B('<s style="font-size:.9rem">S</s>',                "CollectionsPage._fmtWrap('s')",      'Закреслення')}
            ${B('<code style="font-size:.75rem;background:var(--bg-raised);padding:1px 3px;border-radius:3px">&lt;/&gt;</code>', "CollectionsPage._fmtWrap('code')", 'Код')}
            ${S}
            <select onchange="CollectionsPage._wrapSize(this.value);this.selectedIndex=0"
                    style="height:34px;font-size:.85rem;padding:0 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);cursor:pointer;flex-shrink:0">
                <option>Розмір</option>
                ${[11,12,13,14,16,18,20,24,28,32,36,48,64].map(s => `<option value="${s}">${s}px</option>`).join('')}
            </select>
            ${S}
            ${B('<i class="fa-solid fa-angle-left"></i>≡', "CollectionsPage._wrapLeft()",   'Ліворуч')}
            ${B('≡',   "CollectionsPage._wrapCenter()", 'По центру')}
            ${B('≡→',  "CollectionsPage._wrapRight()",  'Праворуч')}
            ${S}
            <label title="Колір тексту" style="min-width:34px;height:34px;padding:0 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;position:relative;overflow:hidden;flex-shrink:0">
                <b style="font-size:1rem;text-decoration:underline;text-decoration-color:#e74c3c;text-underline-offset:3px">A</b>
                <input type="color" value="#e74c3c" onchange="CollectionsPage._wrapColor('color',this.value)"
                       style="opacity:0;position:absolute;inset:0;cursor:pointer">
            </label>
            <label title="Заливка фону" style="min-width:34px;height:34px;padding:0 6px;border:1px solid var(--border);border-radius:6px;background:var(--bg-surface);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;position:relative;overflow:hidden;flex-shrink:0">
                <span style="font-size:1rem">🖌</span>
                <input type="color" value="#fef9c3" onchange="CollectionsPage._wrapColor('background',this.value)"
                       style="opacity:0;position:absolute;inset:0;cursor:pointer">
            </label>
            ${S}
            ${B('• ≡', "CollectionsPage._insertUL()",    'Маркований список')}
            ${B('1 ≡', "CollectionsPage._insertOL()",    'Нумерований список')}
            ${S}
            ${B('⊞',   "CollectionsPage._insertTable()", 'Таблиця')}
            ${B('━',   "CollectionsPage._insertHR()",    'Роздільник')}
            ${B('🔗',  "CollectionsPage._insertLink()",  'Гіперпосилання')}
            ${B('🃏',  "CollectionsPage._insertCard()",  'Картка-блок')}
            ${B('😊',  "CollectionsPage._toggleEmoji(event)", 'Вставити emoji')}
        </div>`;
    },

    // ── Toolbar helpers ───────────────────────────────────────────
    _getActiveTA() {
        // If a cursor was saved (e.g. after clicking attachment card), use that textarea
        if (this._savedCursor) return this._savedCursor.ta;
        const css = document.getElementById('editor-css');
        return (css && css.style.display !== 'none') ? css : document.getElementById('editor-html');
    },

    _getCursor(ta) {
        // Use saved position if this textarea lost focus
        if (this._savedCursor?.ta === ta && document.activeElement !== ta) {
            return { start: this._savedCursor.start, end: this._savedCursor.end };
        }
        return { start: ta.selectionStart, end: ta.selectionEnd };
    },

    _wrap(before, after) {
        const ta = this._getActiveTA();
        if (!ta) return;
        const { start: s, end: e } = this._getCursor(ta);
        const sel = ta.value.slice(s, e) || 'текст';
        const ins = before + sel + after;
        ta.value = ta.value.slice(0, s) + ins + ta.value.slice(e);
        ta.selectionStart = s + before.length;
        ta.selectionEnd   = s + before.length + sel.length;
        ta.focus();
        this._updatePreview();
    },

    _insertSnippet(snippet) {
        if (this._cmHtml) {
            this._cmHtml.replaceSelection(snippet);
            this._cmHtml.focus();
            this._markDirty();
            this._updatePreview();
            return;
        }
        const ta = this._getActiveTA();
        if (!ta) return;
        const { start: s } = this._getCursor(ta);
        ta.value = ta.value.slice(0, s) + snippet + ta.value.slice(s);
        ta.selectionStart = ta.selectionEnd = s + snippet.length;
        this._savedCursor = { ta, start: ta.selectionStart, end: ta.selectionEnd };
        ta.focus();
        this._updatePreview();
    },

    _fmtWrap(tag)           { this._wrap(`<${tag}>`, `</${tag}>`); },
    _wrapSize(px)           { if (px) this._wrap(`<span style="font-size:${px}px">`, '</span>'); },
    _wrapLeft()             { this._wrap('<div style="text-align:left">',    '</div>'); },
    _wrapCenter()           { this._wrap('<div style="text-align:center">',  '</div>'); },
    _wrapRight()            { this._wrap('<div style="text-align:right">',   '</div>'); },
    _wrapColor(prop, val)   { this._wrap(`<span style="${prop}:${val}">`, '</span>'); },

    _insertHeading(tag) {
        if (!tag) return;
        this._wrap(`<${tag}>`, `</${tag}>\n`);
    },

    _insertUL() {
        this._insertSnippet('<ul>\n  <li>Пункт 1</li>\n  <li>Пункт 2</li>\n  <li>Пункт 3</li>\n</ul>\n');
    },

    _insertOL() {
        this._insertSnippet('<ol>\n  <li>Пункт 1</li>\n  <li>Пункт 2</li>\n  <li>Пункт 3</li>\n</ol>\n');
    },

    _insertHR() {
        this._insertSnippet('<hr style="border:none;border-top:2px solid #e2e8f0;margin:1.5rem 0">\n');
    },

    _insertTable() {
        this._insertSnippet(
`<table>
  <thead>
    <tr>
      <th>Заголовок 1</th>
      <th>Заголовок 2</th>
      <th>Заголовок 3</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Комірка</td><td>Комірка</td><td>Комірка</td>
    </tr>
    <tr>
      <td>Комірка</td><td>Комірка</td><td>Комірка</td>
    </tr>
  </tbody>
</table>\n`);
    },

    _insertCard() {
        this._insertSnippet(
`<div class="card">
  <h3>Заголовок картки</h3>
  <p>Текст або опис.</p>
</div>\n`);
    },

    _insertLink() {
        const ta = this._getActiveTA();
        if (!ta) return;
        const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
        const url = prompt('URL посилання:', 'https://');
        if (!url) return;
        if (sel) {
            this._wrap(`<a href="${url}">`, '</a>');
        } else {
            const text = prompt('Текст посилання:', 'Посилання') || 'Посилання';
            this._insertSnippet(`<a href="${url}">${text}</a>`);
        }
    },

    _toggleEmoji(e) {
        e.stopPropagation();
        const existing = document.getElementById('emoji-panel');
        if (existing) { existing.remove(); return; }

        const groups = [
            { label: 'Емоції',  items: ['😀','😂','😊','😍','🤔','😎','🥳','😢','😡','🤩','🙄','😴','🤗','😇','🫡'] },
            { label: 'Жести',   items: ['👍','👎','👏','🙌','🤝','✌️','☝️','💪','🖐','🫶','👋','🤜','🤞','🫵','✅'] },
            { label: 'Символи', items: ['❌','⚠️','ℹ️','❓','❗','🔴','🟡','🟢','🔵','<i class="fa-solid fa-star"></i>','🔥','💡','💯','🆕','🔝'] },
            { label: 'Робота',  items: ['📌','📎','🔗','📊','📋','📁','📝','📅','💼','🔑','🔒','📢','📞','✉️','💻'] },
            { label: 'Інше',    items: ['🚀','🎯','🏆','🎉','❤️','💰','🌐','🕐','🖨','🔔','📢','🎓','🏅','🎁','🌟'] },
        ];

        const panel = document.createElement('div');
        panel.id = 'emoji-panel';
        panel.style.cssText = 'position:fixed;z-index:9999;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:.5rem;box-shadow:var(--shadow-lg);width:260px;max-height:320px;overflow-y:auto';

        groups.forEach(g => {
            const label = document.createElement('div');
            label.textContent = g.label;
            label.style.cssText = 'font-size:.65rem;font-weight:600;color:var(--text-muted);letter-spacing:.08em;text-transform:uppercase;padding:.2rem .25rem .1rem;margin-top:.25rem';
            panel.appendChild(label);

            const row = document.createElement('div');
            row.style.cssText = 'display:flex;flex-wrap:wrap;gap:1px';
            g.items.forEach(em => {
                const b = document.createElement('button');
                b.textContent = em;
                b.title = em;
                b.style.cssText = 'width:32px;height:32px;border:none;background:none;cursor:pointer;font-size:1.1rem;border-radius:4px;display:flex;align-items:center;justify-content:center';
                b.onmouseenter = () => b.style.background = 'var(--bg-hover)';
                b.onmouseleave = () => b.style.background = 'none';
                b.onclick = ev => { ev.stopPropagation(); this._insertSnippet(em); panel.remove(); };
                row.appendChild(b);
            });
            panel.appendChild(row);
        });

        const btn = e.target.closest('button');
        const rect = btn.getBoundingClientRect();
        panel.style.top  = (rect.bottom + 6) + 'px';
        panel.style.left = Math.min(rect.left, window.innerWidth - 270) + 'px';
        document.body.appendChild(panel);
        setTimeout(() => document.addEventListener('click', () => panel.remove(), { once: true }), 0);
    },

    _switchTab(tab) {
        this._savedCursor = null;
        const tabHtml = document.getElementById('tab-html');
        const tabCss  = document.getElementById('tab-css');

        const setActive = btn => {
            if (!btn) return;
            btn.style.background   = 'var(--bg-surface)';
            btn.style.color        = 'var(--text-primary)';
            btn.style.borderBottom = '2px solid var(--primary)';
        };
        const setInactive = btn => {
            if (!btn) return;
            btn.style.background   = 'var(--bg-raised)';
            btn.style.color        = 'var(--text-muted)';
            btn.style.borderBottom = '2px solid transparent';
        };

        if (this._cmHtml && this._cmCss) {
            if (tab === 'html') {
                this._cmHtml.getWrapperElement().style.display = '';
                this._cmCss.getWrapperElement().style.display  = 'none';
                setTimeout(() => this._cmHtml.refresh(), 0);
            } else {
                this._cmCss.getWrapperElement().style.display  = '';
                this._cmHtml.getWrapperElement().style.display = 'none';
                setTimeout(() => this._cmCss.refresh(), 0);
            }
        } else {
            const htmlTA = document.getElementById('editor-html');
            const cssTA  = document.getElementById('editor-css');
            if (tab === 'html') {
                if (htmlTA) { htmlTA.style.display = 'flex'; htmlTA.style.flex = '1'; }
                if (cssTA)  cssTA.style.display = 'none';
            } else {
                if (cssTA)  { cssTA.style.display = 'flex'; cssTA.style.flex = '1'; }
                if (htmlTA) htmlTA.style.display = 'none';
            }
        }

        setActive(tab === 'html' ? tabHtml : tabCss);
        setInactive(tab === 'html' ? tabCss : tabHtml);
    },

    _initEditor(page) {
        // Restore split width from previous session
        const savedW = localStorage.getItem('col_split_w');
        if (savedW) {
            const cp = document.getElementById('col-code-panel');
            if (cp) cp.style.width = savedW;
        }

        // Initialize CodeMirror for HTML and CSS panels
        const taHtml = document.getElementById('editor-html');
        const taCss  = document.getElementById('editor-css');
        const cmTheme = document.body.classList.contains('light-theme') ? 'default' : 'dracula';
        const saveCmd = () => this.savePage(this._editingPageId || '');
        const cmBase  = { theme: cmTheme, lineNumbers: true, tabSize: 2, indentWithTabs: false,
                          lineWrapping: false,
                          extraKeys: { Tab: cm => cm.replaceSelection('  '), 'Ctrl-S': saveCmd, 'Cmd-S': saveCmd } };
        if (taHtml && typeof CodeMirror !== 'undefined') {
            this._cmHtml = CodeMirror.fromTextArea(taHtml, { ...cmBase, mode: 'htmlmixed' });
            this._cmCss  = CodeMirror.fromTextArea(taCss,  { ...cmBase, mode: 'css' });
            this._cmHtml.getWrapperElement().style.cssText = 'flex:1;min-height:0;overflow:hidden';
            this._cmCss.getWrapperElement().style.cssText  = 'flex:1;min-height:0;overflow:hidden;display:none';
            this._cmHtml.on('change', () => { this._markDirty(); this._updatePreview(); });
            this._cmCss.on('change',  () => { this._markDirty(); this._updatePreview(); });
        }

        // Ctrl+S saves the page
        this._ctrlSHandler = e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.savePage(this._editingPageId || '');
            }
        };
        document.addEventListener('keydown', this._ctrlSHandler);

        // Warn before closing with unsaved changes
        this._beforeUnloadHandler = e => {
            if (!this._isDirty) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', this._beforeUnloadHandler);

        // Keep CM theme in sync with LMS theme
        this._cmThemeHandler = e => {
            const t = e.detail?.theme === 'light' ? 'default' : 'dracula';
            this._cmHtml?.setOption('theme', t);
            this._cmCss?.setOption('theme', t);
        };
        window.addEventListener('lms-theme-change', this._cmThemeHandler);

        // Drag-and-drop files onto attachment panel
        const panel = document.getElementById('attachment-panel');
        if (panel && this._editingPageId) {
            panel.addEventListener('dragover', e => {
                e.preventDefault();
                panel.style.outline = '2px dashed var(--primary)';
                panel.style.outlineOffset = '-2px';
            });
            panel.addEventListener('dragleave', () => { panel.style.outline = ''; });
            panel.addEventListener('drop', e => {
                e.preventDefault();
                panel.style.outline = '';
                const files = Array.from(e.dataTransfer.files);
                if (files.length) this._uploadFiles(this._editingPageId, files);
            });
        }

        // Initial preview after CM renders
        setTimeout(() => {
            this._cmHtml?.refresh();
            this._cmCss?.refresh();
            this._updatePreview();
        }, 50);
    },

    _updatePreview() {
        clearTimeout(this._previewTimer);
        this._previewTimer = setTimeout(() => {
            const iframe = document.getElementById('live-preview-iframe');
            if (!iframe) return;
            const html = this._cmHtml ? this._cmHtml.getValue() : (document.getElementById('editor-html')?.value || '');
            const css  = this._cmCss  ? this._cmCss.getValue()  : (document.getElementById('editor-css')?.value  || '');
            this._renderIframe(iframe, html, css);
            const isLight = document.body.classList.contains('light-theme');
            iframe.style.filter = isLight ? '' : 'invert(1) hue-rotate(180deg)';
        }, 400);
    },

    _esc(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    },

    _defaultHtml() {
        return `<h1>Заголовок сторінки</h1>
<p>Опис або вступний текст.</p>

<h2>Розділ 1</h2>
<p>Текст розділу. Можна додавати посилання, списки, таблиці.</p>
<ul>
  <li>Пункт 1</li>
  <li>Пункт 2</li>
</ul>

<!-- Посилання на ресурс: замініть # на справжній URL -->
<a href="#" class="resource-link">📄 Назва документу</a>`;
    },

    _defaultCss() {
        return `body {
  max-width: 800px;
  margin: 0 auto;
  font-family: 'Inter', sans-serif;
  color: #1e293b;
  line-height: 1.7;
}

h1 { color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: .5rem; }
h2 { color: #475569; margin-top: 2rem; }
h3 { color: #64748b; }

blockquote {
  border-left: 4px solid #6366f1;
  margin: 1rem 0;
  padding: .5rem 1rem;
  background: #f5f3ff;
  color: #4338ca;
  border-radius: 0 8px 8px 0;
}

code {
  background: #f1f5f9;
  color: #e11d48;
  padding: .1em .35em;
  border-radius: 4px;
  font-size: .875em;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  font-size: .9rem;
}
th {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: .5rem .75rem;
  text-align: left;
  font-weight: 600;
  color: #475569;
}
td {
  border: 1px solid #e2e8f0;
  padding: .5rem .75rem;
}
tr:hover td { background: #f8fafc; }

.card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  margin: 1rem 0;
  background: #f8fafc;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}
.card h3 { margin: 0 0 .5rem; color: #6366f1; }

.resource-link {
  display: inline-block;
  padding: .4rem 1rem;
  background: #eff6ff;
  color: #3b82f6;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  text-decoration: none;
  margin: .25rem 0;
}
.resource-link:hover { background: #dbeafe; }`;
    },

    // ── Insert resource link ──────────────────────────────────────
    async _insertResourceLink() {
        Loader.show();
        try {
            const { data } = await API.resources.getAll({ pageSize: 200 });
            if (!data?.length) { Toast.info('Ресурсів немає'); return; }

            const icon = r => {
                const t = (r.type || '').toLowerCase();
                if (t === 'pdf')   return '📄';
                if (t === 'video') return '🎥';
                if (t === 'image') return '🖼️';
                return '📎';
            };

            Modal.open({
                title: 'Вставити посилання на ресурс',
                size: 'md',
                body: `
                    <input type="text" placeholder="Пошук..." style="width:100%;margin-bottom:.75rem"
                           oninput="CollectionsPage.__filterRes(this.value)">
                    <div id="res-link-list" style="max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:.35rem">
                        ${data.map(r => `
                            <div onclick="CollectionsPage.__pickRes('${r.id}',${JSON.stringify(r.title||'').replace(/"/g,'&quot;')},'${r.type||''}')"
                                 style="display:flex;align-items:center;gap:.75rem;padding:.6rem .75rem;border:1px solid var(--border);border-radius:var(--radius-md);cursor:pointer;transition:background var(--transition)"
                                 onmouseenter="this.style.background='var(--bg-hover)'" onmouseleave="this.style.background=''">
                                <span>${icon(r)}</span>
                                <span style="font-size:.875rem">${r.title}</span>
                            </div>`).join('')}
                    </div>`,
                footer: `<button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>`
            });
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    __filterRes(q) {
        document.querySelectorAll('#res-link-list > div').forEach(el => {
            el.style.display = el.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
        });
    },

    __pickRes(id, title, type) {
        const icon = type === 'pdf' ? '📄' : type === 'video' ? '🎥' : type === 'image' ? '🖼️' : '📎';
        const link = `<a href="#resource/${id}" class="resource-link">${icon} ${title}</a>`;
        const ta = document.getElementById('editor-html');
        if (ta) {
            const pos = ta.selectionStart;
            ta.value = ta.value.slice(0, pos) + link + ta.value.slice(pos);
            ta.selectionStart = ta.selectionEnd = pos + link.length;
            this._updatePreview();
        }
        Modal.close();
    },

    // ── Topbar controls ───────────────────────────────────────────
    _togglePublishBtn(btn) {
        const isNow = btn.dataset.pub === '1';
        const next = !isNow;
        btn.dataset.pub = next ? '1' : '0';
        const inp = document.getElementById('page-published');
        if (inp) inp.value = next ? '1' : '';
        btn.style.borderColor = next ? 'rgba(16,185,129,.4)' : 'var(--border)';
        btn.style.background  = next ? 'rgba(16,185,129,.1)'  : 'var(--bg-surface)';
        btn.style.color       = next ? '#10b981' : 'var(--text-secondary)';
        btn.innerHTML = `<i class="fa-${next ? 'solid' : 'regular'} fa-circle-check"></i> ${next ? 'Опубліковано' : 'Опублікувати'}`;
        CollectionsPage._markDirty();
    },

    _toggleSaveMenu(btn) {
        const m = document.getElementById('col-save-menu');
        if (!m) return;
        const open = m.style.display !== 'none';
        m.style.display = open ? 'none' : 'block';
        if (!open) {
            setTimeout(() => document.addEventListener('click', function h(e) {
                if (!e.target.closest('#col-save-menu')) { m.style.display = 'none'; document.removeEventListener('click', h); }
            }), 0);
        }
    },

    _toggleMoreMenu(btn) {
        const m = document.getElementById('col-more-menu');
        if (!m) return;
        const open = m.style.display !== 'none';
        m.style.display = open ? 'none' : 'block';
        if (!open) {
            setTimeout(() => document.addEventListener('click', function h(e) {
                if (!e.target.closest('#col-more-menu') && !e.target.closest('[onclick*="_toggleMoreMenu"]')) { m.style.display = 'none'; document.removeEventListener('click', h); }
            }), 0);
        }
    },

    _toggleAccessDropdown() {
        const dd = document.getElementById('col-access-dropdown');
        if (!dd) return;
        const open = dd.style.display !== 'none';
        dd.style.display = open ? 'none' : 'block';
        if (!open) {
            setTimeout(() => document.addEventListener('click', function h(e) {
                if (!e.target.closest('#col-access-dropdown') && !e.target.closest('[onclick*="_toggleAccessDropdown"]')) {
                    dd.style.display = 'none';
                    document.removeEventListener('click', h);
                }
            }), 0);
        }
    },

    _updateAccessSummary() {
        const labels = this._getSelectedLabels();
        const dovs   = this._getSelectedDovIds();
        const el = document.getElementById('col-access-summary');
        if (el) el.textContent = (labels.length || dovs.length) ? 'Обмежений доступ' : 'Усі користувачі';
    },

    // ── Tag picker ────────────────────────────────────────────────
    _toggleTagDropdown() {
        const dd = document.getElementById('col-tags-dropdown');
        if (!dd) return;
        const isOpen = dd.style.display !== 'none';
        dd.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) {
            setTimeout(() => {
                document.addEventListener('click', function closeDD(e) {
                    if (!e.target.closest('#col-tags-dropdown') && !e.target.closest('#col-tags-box')) {
                        const d = document.getElementById('col-tags-dropdown');
                        if (d) d.style.display = 'none';
                        document.removeEventListener('click', closeDD);
                    }
                });
            }, 0);
        }
    },

    _onTagChange() {
        const checks = [...document.querySelectorAll('input[name="col-group"]:checked')];
        const allChk = document.getElementById('col-group-all');
        if (allChk) allChk.checked = checks.length === 0;
        const preview = document.getElementById('col-tags-preview');
        if (preview) preview.textContent = checks.length ? checks.map(c => c.value).join(', ') : 'Всі користувачі';
        this._updateAccessSummary();
    },

    _clearAllTags() {
        document.querySelectorAll('input[name="col-group"]').forEach(c => c.checked = false);
        const preview = document.getElementById('col-tags-preview');
        if (preview) preview.textContent = 'Всі користувачі';
        const allChk = document.getElementById('col-group-all');
        if (allChk) allChk.checked = true;
        this._updateAccessSummary();
    },

    _getSelectedLabels() {
        return [...document.querySelectorAll('input[name="col-group"]:checked')].map(c => c.value);
    },

    // ── Dov picker ────────────────────────────────────────────────
    _toggleDovDropdown() {
        const dd = document.getElementById('col-dov-dropdown');
        if (!dd) return;
        const isOpen = dd.style.display !== 'none';
        dd.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) {
            setTimeout(() => {
                document.addEventListener('click', function closeDD(e) {
                    if (!e.target.closest('#col-dov-dropdown') && !e.target.closest('#col-dov-box')) {
                        const d = document.getElementById('col-dov-dropdown');
                        if (d) d.style.display = 'none';
                        document.removeEventListener('click', closeDD);
                    }
                });
            }, 0);
        }
    },

    _onDovChange() {
        const checks = [...document.querySelectorAll('input[name="col-dov"]:checked')];
        const allChk = document.getElementById('col-dov-all');
        if (allChk) allChk.checked = checks.length === 0;
        const preview = document.getElementById('col-dov-preview');
        if (preview) {
            if (!checks.length) {
                preview.textContent = 'Без обмежень';
            } else {
                const allDov = this._allDov || [];
                const names = checks.map(c => allDov.find(d => d.id === c.value)?.name || c.value);
                preview.textContent = names.join(', ');
            }
        }
    },

    _clearAllDovs() {
        document.querySelectorAll('input[name="col-dov"]').forEach(c => c.checked = false);
        const preview = document.getElementById('col-dov-preview');
        if (preview) preview.textContent = 'Без обмежень';
        const allChk = document.getElementById('col-dov-all');
        if (allChk) allChk.checked = true;
    },

    _getSelectedDovIds() {
        return [...document.querySelectorAll('input[name="col-dov"]:checked')].map(c => c.value);
    },

    // ── Save ──────────────────────────────────────────────────────
    async savePage(id, inPlace = false) {
        const title = document.getElementById('page-title-input')?.value.trim();
        if (!title) { Toast.error('Помилка', 'Вкажіть назву сторінки'); return; }
        const allowed_labels = this._getSelectedLabels();
        const dovIds = this._getSelectedDovIds();
        const pubInput = document.getElementById('page-published');
        const isPublished = pubInput ? (pubInput.value === '1') : false;
        const fields = {
            title,
            html_content: this._cmHtml ? this._cmHtml.getValue() : (document.getElementById('editor-html')?.value || ''),
            css_content:  this._cmCss  ? this._cmCss.getValue()  : (document.getElementById('editor-css')?.value  || ''),
            is_published: isPublished,
            search_enabled: document.getElementById('page-search-enabled')?.checked || false,
            allowed_labels
        };
        Loader.show();
        try {
            if (id) {
                await API.pages.update(id, fields);
                await API.pageDovirenosti.set(id, dovIds);
                Loader.hide();
                this._markClean();
                this._lastSavedAt = new Date();
                if (inPlace === 'preview') {
                    this._updateSavedStatus();
                    Toast.success('Збережено');
                    Router.go(`collections/${id}`);
                } else if (inPlace) {
                    this._updateSavedStatus();
                    Toast.success('Збережено');
                } else {
                    Router.back();
                }
            } else {
                const created = await API.pages.create(fields);
                await API.pageDovirenosti.set(created.id, dovIds);
                Loader.hide();
                Toast.success('Сторінку створено — можна додати файли');
                await this.openEditor(created.id);
            }
        } catch (e) {
            Toast.error('Помилка', e.message);
            Loader.hide();
        }
    },

    // ── Delete ────────────────────────────────────────────────────
    _trailBack(index) {
        const target = this._pageTrail[index];
        if (!target) return;
        this._pageTrail = this._pageTrail.slice(0, index);
        Router.go(`collections/${target.id}`);
    },

    async setHome(id) {
        const ok = await Modal.confirm({
            title: 'Зробити головною?',
            message: 'Ця сторінка стане головною для всіх користувачів. Попередня головна сторінка втратить цей статус.',
            confirmText: 'Так, зробити головною',
            cancelText: 'Скасувати',
            danger: false
        });
        if (!ok) return;
        try {
            await API.pages.setHome(id);
            Toast.success('Головну сторінку встановлено');
            await this._loadList();
        } catch(e) {
            Toast.error('Помилка', e.message);
        }
    },

    async deletePage(id) {
        const ok = await Modal.confirm({
            title: 'Видалити сторінку?',
            message: 'Всі прикріплені файли також будуть видалені назавжди.',
            confirmText: 'Видалити',
            danger: true
        });
        if (!ok) return;
        Loader.show();
        try {
            await API.pageAttachments.deleteAllForPage(id);
            await API.pages.delete(id);
            Toast.success('Сторінку видалено');
            await this._loadList();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    // ── Attachment panel ──────────────────────────────────────────
    async _renderAttachmentGrid(attachments) {
        this._attachments = attachments;
        const grid = document.getElementById('attachment-grid');
        if (!grid) return;
        if (!attachments.length) {
            grid.innerHTML = `<span style="font-size:.8rem;color:var(--text-muted);align-self:center">Немає файлів — натисніть «+ Додати» або перетягніть сюди</span>`;
            return;
        }
        // Generate signed URLs for image thumbnails
        const cards = await Promise.all(attachments.map(async att => {
            let previewUrl = null;
            if (att.file_type?.startsWith('image/')) {
                try { previewUrl = await API.pageAttachments.getSignedUrl(att.storage_path); } catch(_) {}
            }
            return this._attachCardHtml(att, previewUrl);
        }));
        grid.innerHTML = cards.join('');
    },

    _attachCardHtml(att, previewUrl) {
        const ext   = att.file_name.split('.').pop().toLowerCase();
        const isPdf = ext === 'pdf' || att.file_type?.includes('pdf');
        const isImg = att.file_type?.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg'].includes(ext);
        const icons = { doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📊',pptx:'📊',
                        txt:'📄',csv:'📋',zip:'🗜',rar:'🗜',mp4:'🎥',mp3:'🎵',mp3:'🎵' };

        const inner = isImg && previewUrl
            ? `<img src="${previewUrl}" style="width:100%;height:100%;object-fit:cover">`
            : isPdf
            ? `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;height:100%">
                 <div style="font-size:1.6rem">📄</div>
                 <div style="background:#ef4444;color:#fff;font-size:.5rem;font-weight:700;padding:1px 5px;border-radius:2px;letter-spacing:.08em">PDF</div>
               </div>`
            : `<div style="font-size:2rem;display:flex;align-items:center;justify-content:center;height:100%">${icons[ext] || '📎'}</div>`;

        const name = att.file_name.length > 11 ? att.file_name.slice(0,9) + '…' : att.file_name;

        const inserted = this._insertedIds?.has(att.id);
        const borderStyle = inserted ? '2px solid #10b981' : '1px solid var(--border)';
        return `
        <div data-att-id="${att.id}" style="position:relative;flex-shrink:0;cursor:pointer"
             onclick="CollectionsPage._insertAttachmentLink('${att.id}')"
             onmouseenter="this.querySelector('.adel').style.display='flex'"
             onmouseleave="this.querySelector('.adel').style.display='none'"
             title="${att.file_name}">
            <div style="width:76px;height:76px;border:${borderStyle};border-radius:8px;overflow:hidden;background:var(--bg-raised)">
                ${inner}
            </div>
            <div style="width:76px;font-size:.65rem;color:var(--text-muted);text-align:center;margin-top:.2rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</div>
            ${inserted ? `<div style="position:absolute;top:-5px;left:-5px;width:18px;height:18px;border-radius:50%;background:#10b981;color:#fff;font-size:.55rem;display:flex;align-items:center;justify-content:center;font-weight:700;pointer-events:none">✓</div>` : ''}
            <button class="adel"
                    onclick="event.stopPropagation();CollectionsPage._deleteAttachment('${att.id}')"
                    style="display:none;position:absolute;top:-5px;right:-5px;width:20px;height:20px;border-radius:50%;background:#ef4444;color:#fff;border:none;cursor:pointer;font-size:.65rem;align-items:center;justify-content:center;z-index:2;font-weight:700">✕</button>
        </div>`;
    },

    async _onAttachFiles(input) {
        const pageId = this._editingPageId;
        if (!pageId) { Toast.warning('Збережіть сторінку спочатку'); return; }
        const files = Array.from(input.files);
        if (!files.length) return;
        await this._uploadFiles(pageId, files);
        input.value = '';
    },

    async _onAttachFilesNew(input) {
        const files = Array.from(input.files);
        input.value = '';
        if (!files.length) return;
        const title = document.getElementById('page-title-input')?.value.trim();
        if (!title) { Toast.warning('Вкажіть назву сторінки перед завантаженням файлів'); return; }
        // Auto-save first
        const allowed_labels = this._getSelectedLabels();
        const dovIds = this._getSelectedDovIds();
        const fields = {
            title,
            html_content: this._cmHtml ? this._cmHtml.getValue() : (document.getElementById('editor-html')?.value || ''),
            css_content:  this._cmCss  ? this._cmCss.getValue()  : (document.getElementById('editor-css')?.value  || ''),
            is_published: document.getElementById('page-published')?.checked || false,
            search_enabled: document.getElementById('page-search-enabled')?.checked || false,
            allowed_labels
        };
        Loader.show();
        try {
            const created = await API.pages.create(fields);
            await API.pageDovirenosti.set(created.id, dovIds);
            this._editingPageId = created.id;
            // Update save button to use the new id
            const saveBtn = document.getElementById('col-save-btn');
            if (saveBtn) saveBtn.setAttribute('onclick', `CollectionsPage.savePage('${created.id}')`);
            // Show the "+ Додати" file input instead of the auto-save one
            const panel = document.getElementById('attachment-panel');
            if (panel) {
                const hdr = panel.querySelector('div');
                if (hdr) {
                    const placeholder = hdr.querySelector('label');
                    if (placeholder) placeholder.outerHTML = `
                        <label style="cursor:pointer">
                            <span class="btn btn-ghost btn-sm" style="pointer-events:none">+ Додати</span>
                            <input type="file" multiple style="display:none" onchange="CollectionsPage._onAttachFiles(this)">
                        </label>`;
                }
            }
            this._markClean();
            Loader.hide();
            Toast.success('Сторінку збережено — завантажуємо файли');
        } catch(e) {
            Loader.hide();
            Toast.error('Помилка збереження', e.message);
            return;
        }
        await this._uploadFiles(this._editingPageId, files);
    },

    async _uploadFiles(pageId, files) {
        const grid = document.getElementById('attachment-grid');
        if (!grid) return;
        // Clear empty placeholder text
        if (grid.querySelector('span')) grid.innerHTML = '';

        for (const file of files) {
            const ph = document.createElement('div');
            ph.style.cssText = 'width:76px;height:76px;border:1px dashed var(--border);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0';
            ph.innerHTML = '<div class="spinner" style="width:20px;height:20px"></div>';
            grid.appendChild(ph);
            try {
                const att = await API.pageAttachments.upload(pageId, file);
                this._attachments.push(att);
                let previewUrl = att.signed_url && att.file_type?.startsWith('image/') ? att.signed_url : null;
                const wrap = document.createElement('div');
                wrap.innerHTML = this._attachCardHtml(att, previewUrl);
                ph.replaceWith(wrap.firstElementChild);
            } catch(e) {
                ph.remove();
                Toast.error(`Помилка: ${file.name}`, e.message);
            }
        }
    },

    async _deleteAttachment(attId) {
        if (!confirm('Видалити файл?')) return;
        Loader.show();
        try {
            await API.pageAttachments.delete(attId);
            this._attachments = this._attachments.filter(a => a.id !== attId);
            await this._renderAttachmentGrid(this._attachments);
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    _insertAttachmentLink(attId) {
        const att = this._attachments.find(a => a.id === attId);
        if (!att) return;
        const ext   = att.file_name.split('.').pop().toLowerCase();
        const isPdf = ext === 'pdf' || att.file_type?.includes('pdf');
        const isImg = att.file_type?.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg'].includes(ext);
        let snippet;
        if (isImg) {
            snippet = `<img src="att:${attId}" alt="${att.file_name}" style="max-width:100%;border-radius:8px;margin:.5rem 0">\n`;
        } else if (isPdf) {
            snippet = `<a href="att:${attId}" data-att-pdf="1" data-att-name="${att.file_name}" target="_blank" class="resource-link">📄 ${att.file_name}</a>\n`;
        } else {
            snippet = `<a href="att:${attId}" target="_blank" class="resource-link">📎 ${att.file_name}</a>\n`;
        }
        if (this._cmHtml) {
            const doc = this._cmHtml.getDoc();
            const last = doc.lastLine();
            doc.replaceRange('\n' + snippet, { line: last, ch: doc.getLine(last).length });
            this._cmHtml.scrollIntoView(null);
            this._markDirty();
            this._updatePreview();
        } else {
            const ta = document.getElementById('editor-html');
            if (ta) {
                ta.value = ta.value.trimEnd() + '\n' + snippet;
                ta.selectionStart = ta.selectionEnd = ta.value.length;
                this._savedCursor = { ta, start: ta.value.length, end: ta.value.length };
                this._updatePreview();
            }
        }
        this._insertedIds.add(attId);
        const card = document.querySelector(`[data-att-id="${attId}"]`);
        if (card) {
            const box = card.querySelector('div');
            if (box) box.style.border = '2px solid #10b981';
            if (!card.querySelector('.att-check')) {
                const chk = document.createElement('div');
                chk.className = 'att-check';
                chk.style.cssText = 'position:absolute;top:-5px;left:-5px;width:18px;height:18px;border-radius:50%;background:#10b981;color:#fff;font-size:.55rem;display:flex;align-items:center;justify-content:center;font-weight:700;pointer-events:none';
                chk.textContent = '✓';
                card.appendChild(chk);
            }
        }
        this._insertCount++;
        const counter = document.getElementById('col-insert-counter');
        if (counter) {
            counter.textContent = `✓ Вставлено: ${this._insertCount}`;
            counter.style.display = '';
            clearTimeout(this._insertTimer);
            this._insertTimer = setTimeout(() => {
                counter.style.display = 'none';
                this._insertCount = 0;
            }, 3000);
        }
    },

    // ── Page search ───────────────────────────────────────────────
    _onSearchInput() {
        clearTimeout(this._searchState.timer);
        this._searchState.timer = setTimeout(() => {
            const q = document.getElementById('pg-search-input')?.value || '';
            this._applySearch(q);
        }, 250);
    },

    _applySearch(query) {
        const iframe = document.getElementById('page-iframe');
        if (!iframe?.contentDocument) return;
        const doc = iframe.contentDocument;

        // Remove previous marks
        doc.querySelectorAll('mark.pg-hl').forEach(m => m.replaceWith(...m.childNodes));
        doc.body.normalize();

        // Restore hidden elements
        doc.querySelectorAll('[data-pg-hidden]').forEach(el => {
            el.style.display = '';
            el.removeAttribute('data-pg-hidden');
        });

        const countEl = document.getElementById('pg-search-count');
        if (!query.trim()) {
            this._searchState.marks = [];
            this._searchState.idx = -1;
            if (countEl) countEl.textContent = '';
            return;
        }

        const lower = query.toLowerCase();
        const marks = [];
        const toReplace = [];

        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const tag = node.parentElement?.tagName;
                if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'MARK') return NodeFilter.FILTER_REJECT;
                return node.textContent.toLowerCase().includes(lower)
                    ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });

        let n;
        while ((n = walker.nextNode())) toReplace.push(n);

        toReplace.forEach(textNode => {
            const text = textNode.textContent;
            const ltext = text.toLowerCase();
            const frag = doc.createDocumentFragment();
            let last = 0, pos;
            while ((pos = ltext.indexOf(lower, last)) !== -1) {
                if (pos > last) frag.appendChild(doc.createTextNode(text.slice(last, pos)));
                const mark = doc.createElement('mark');
                mark.className = 'pg-hl';
                mark.style.cssText = 'background:#fef08a;color:inherit;border-radius:2px;padding:0 1px';
                mark.textContent = text.slice(pos, pos + query.length);
                frag.appendChild(mark);
                marks.push(mark);
                last = pos + query.length;
            }
            if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
            textNode.replaceWith(frag);
        });

        this._searchState.marks = marks;
        this._searchState.idx = marks.length ? 0 : -1;

        if (countEl) countEl.textContent = marks.length ? `1 / ${marks.length}` : '— не знайдено';

        // Filter: hide .resource-link and li without marks
        doc.querySelectorAll('.resource-link, li').forEach(el => {
            if (!el.querySelector('mark.pg-hl')) {
                el.setAttribute('data-pg-hidden', '1');
                el.style.display = 'none';
            }
        });

        if (marks.length) this._scrollToMark(0);
    },

    _searchNav(dir) {
        const { marks } = this._searchState;
        if (!marks.length) return;
        this._searchState.idx = (this._searchState.idx + dir + marks.length) % marks.length;
        this._scrollToMark(this._searchState.idx);
        const countEl = document.getElementById('pg-search-count');
        if (countEl) countEl.textContent = `${this._searchState.idx + 1} / ${marks.length}`;
    },

    _scrollToMark(idx) {
        const { marks } = this._searchState;
        marks.forEach(m => m.style.background = '#fef08a');
        const mark = marks[idx];
        if (!mark) return;
        mark.style.background = '#fb923c';
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    // ── Error report accordion ────────────────────────────────────
    _toggleErrAccordion() {
        const body    = document.getElementById('col-err-body');
        const chevron = document.getElementById('col-err-chevron');
        if (!body) return;
        const open = body.style.display === 'none';
        body.style.display    = open ? 'block' : 'none';
        if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
        if (open) document.getElementById('col-err-text')?.focus();
    },

    async _submitErrReport(pageId, pageTitle) {
        const text = document.getElementById('col-err-text')?.value.trim();
        if (!text) { Toast.warning('Опишіть помилку перед надсиланням'); return; }
        const now = Date.now();
        const cooldown = 60000;
        if (now - this._errLastSent < cooldown) {
            const sec = Math.ceil((cooldown - (now - this._errLastSent)) / 1000);
            Toast.warning('Зачекайте', `Наступне повідомлення можна надіслати через ${sec} сек.`);
            return;
        }
        const btn = document.getElementById('col-err-submit');
        if (btn) btn.disabled = true;
        try {
            const { data: admins } = await supabase.from('profiles')
                .select('id').eq('is_active', true).in('role', ['owner', 'admin']);
            const adminIds = (admins || []).map(a => a.id);
            if (!adminIds.length) { Toast.info('Адміністраторів не знайдено'); return; }
            const sender  = AppState.profile?.full_name || 'Користувач';
            const link    = `collections/${pageId}`;
            await Promise.all(adminIds.map(uid =>
                API.notifications.create({
                    user_id: uid,
                    title:   `⚠️ Помилка на сторінці «${pageTitle}»`,
                    message: `${sender}: ${text}`,
                    type:    'general',
                    link
                })
            ));
            this._errLastSent = Date.now();
            Toast.success('Повідомлення надіслано адміністратору');
            const body = document.getElementById('col-err-body');
            if (body) body.innerHTML = `<p style="font-size:.85rem;color:var(--text-secondary);padding:.25rem 0">✅ Дякуємо! Адміністратор отримав ваше повідомлення.</p>`;
        } catch(e) {
            Toast.error('Помилка', e.message);
            if (btn) btn.disabled = false;
        }
    },

    // ── Split panel resize ────────────────────────────────────────
    _startResize(e) {
        e.preventDefault();
        const split     = document.getElementById('col-split');
        const codePanel = document.getElementById('col-code-panel');
        if (!split || !codePanel) return;
        const startX = e.clientX;
        const startW = codePanel.getBoundingClientRect().width;
        const totalW = split.getBoundingClientRect().width;

        // Overlay blocks iframe from stealing mouse events during drag
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;cursor:col-resize';
        document.body.appendChild(overlay);
        document.body.style.userSelect = 'none';

        const onMove = ev => {
            const newW = Math.max(180, Math.min(startW + ev.clientX - startX, totalW - 190));
            codePanel.style.width = newW + 'px';
            localStorage.setItem('col_split_w', newW + 'px');
            this._cmHtml?.refresh();
            this._cmCss?.refresh();
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            overlay.remove();
            document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    },

    // Resolve att:UUID → real signed URLs before rendering
    async _resolveAttachmentUrls(html) {
        const ids = [...new Set([...html.matchAll(/(?:href|src)="att:([0-9a-f-]{36})"/g)].map(m => m[1]))];
        if (!ids.length) return html;

        const urlMap = {};
        await Promise.all(ids.map(async id => {
            const att = this._attachments.find(a => a.id === id);
            if (!att) return;
            try {
                const url = await API.pageAttachments.getSignedUrl(att.storage_path);
                const ext   = att.file_name.split('.').pop().toLowerCase();
                const isPdf = ext === 'pdf' || att.file_type?.includes('pdf');
                urlMap[id] = isPdf
                    ? `pdf-viewer.html?file=${encodeURIComponent(url)}&title=${encodeURIComponent(att.file_name)}&download=1`
                    : url;
            } catch(_) {}
        }));

        return html.replace(/(?:href|src)="att:([0-9a-f-]{36})"/g, (match, id) => {
            if (!urlMap[id]) return match;
            const resolved = match.replace(`att:${id}`, urlMap[id]);
            // href links must open in new tab so the iframe doesn't navigate away
            // (navigation away destroys the JS context — sendSize(0) never fires, leaving +400px gap)
            return match.startsWith('href=') ? `target="_blank" rel="noopener noreferrer" ${resolved}` : resolved;
        });
    }
};
