// ================================================================
// Куточок споживача — обов'язкові документи відокремленого підрозділу
// ================================================================

const BranchDocsPage = {

    _blocks: [],
    _byBlock: {},        // blockNumber -> resource[]
    _ackMap: {},
    _selectedBlock: null,
    _pages: [],
    _seeAll: true,
    _myDovIds: null,
    _pageDovMap: {},
    _dovNameMap: {},

    _iconOptions: [
        { icon: 'fa-scale-balanced', label: 'Юристи',         color: '#6366f1' },
        { icon: 'fa-laptop-code',    label: 'Тех. підтримка',  color: '#0ea5e9' },
        { icon: 'fa-building',       label: 'Адміністрація',   color: '#64748b' },
        { icon: 'fa-file-contract',  label: 'Договори',        color: '#f59e0b' },
        { icon: 'fa-shield-halved',  label: 'Безпека',         color: '#10b981' },
        { icon: 'fa-users',          label: 'HR / Персонал',   color: '#8b5cf6' },
        { icon: 'fa-circle',         label: 'Без іконки',      color: '#94a3b8' },
    ],

    _injectStyles() {
        if (document.getElementById('bd-styles')) return;
        const s = document.createElement('style');
        s.id = 'bd-styles';
        s.textContent = `
            .bd-wrap { width: 100%; }
            .bd-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; flex-wrap: wrap; gap: .75rem; }
            .bd-hero { display: flex; align-items: center; gap: .85rem; }
            .bd-hero-ico { width: 46px; height: 46px; border-radius: 12px; background: linear-gradient(135deg,#6366f1,#4f46e5); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; box-shadow: 0 4px 14px rgba(99,102,241,.4); flex-shrink: 0; }
            .bd-title { font-size: 1.2rem; font-weight: 800; color: var(--text-primary); }
            .bd-subtitle { font-size: .78rem; color: var(--text-muted); margin-top: .15rem; }
            .bd-label-badge { display: inline-flex; align-items: center; gap: .4rem; padding: .3rem .8rem; border-radius: 999px; font-size: .75rem; font-weight: 700; background: rgba(99,102,241,.1); color: var(--primary); border: 1px solid rgba(99,102,241,.2); }

            /* ── Split panel ──────────────────────────────────────── */
            .bd-split { display: flex; border: 1px solid rgba(99,102,241,.2); border-radius: var(--radius-xl); overflow: hidden; background: var(--bg-surface); box-shadow: 0 2px 16px rgba(99,102,241,.07); min-height: 280px; }
            .bd-split-sidebar { width: 550px; flex-shrink: 0; border-right: 1px solid rgba(99,102,241,.15); display: flex; flex-direction: column; overflow-y: auto; max-height: 600px; background: var(--bg-raised); }
            .bd-split-content { flex: 1; min-width: 0; max-width: 450px; overflow-y: auto; max-height: 600px; }

            /* ── Sidebar item buttons ─────────────────────────────── */
            .bd-item-btn { display: flex; align-items: flex-start; gap: .55rem; padding: .7rem 1rem; cursor: pointer; border: none; background: transparent; text-align: left; color: var(--text-primary); border-bottom: 1px solid rgba(99,102,241,.1); font-family: inherit; font-size: .84rem; width: 100%; transition: background .12s; }
            .bd-item-btn:last-of-type { border-bottom: none; }
            .bd-item-btn:hover { background: rgba(99,102,241,.05); }
            .bd-item-btn.active { background: rgba(99,102,241,.1); }
            .bd-item-num { width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0; background: var(--bg-surface); color: var(--text-muted); display: flex; align-items: center; justify-content: center; font-size: .7rem; font-weight: 800; margin-top: .1rem; border: 1px solid var(--border); transition: all .12s; }
            .bd-item-btn.active .bd-item-num { background: #6366f1; color: #fff; border-color: #6366f1; }
            .bd-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .3rem; }
            .bd-item-title-row { display: flex; align-items: center; gap: .4rem; font-weight: 600; line-height: 1.4; font-size: .84rem; }
            .bd-item-btn.active .bd-item-title-row { color: #6366f1; font-weight: 700; }
            .bd-item-actions { display: flex; gap: 3px; opacity: 0; transition: opacity .15s; }
            .bd-item-btn:hover .bd-item-actions { opacity: 1; }
            .bd-item-dot-wrap { display: flex; flex-shrink: 0; margin-top: .35rem; }
            .bd-ibtn-dot { width: 8px; height: 8px; border-radius: 50%; }
            .bd-ibtn-dot.unread { background: #ef4444; animation: bd-pulse 1.4s ease-in-out infinite; }
            .bd-ibtn-dot.read { background: #10b981; }
            .bd-ibtn-dot.empty { background: var(--border); }

            /* ── Content area ─────────────────────────────────────── */
            .bd-content-inner { padding: 1.1rem 1.25rem; display: flex; flex-direction: column; gap: .85rem; }
            .bd-content-dept { display: flex; align-items: center; gap: .65rem; padding: .6rem .85rem; background: rgba(99,102,241,.06); border: 1px solid rgba(99,102,241,.15); border-radius: var(--radius-md); }
            .bd-content-dept-icon { width: 32px; height: 32px; border-radius: 8px; background: rgba(99,102,241,.12); display: flex; align-items: center; justify-content: center; font-size: .9rem; flex-shrink: 0; }
            .bd-content-dept-name { font-size: .88rem; font-weight: 600; color: var(--text-primary); flex: 1; }
            .bd-content-docs-header { display: flex; align-items: center; gap: .5rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-muted); padding-bottom: .5rem; border-bottom: 1px solid var(--border); }
            .bd-content-docs-header i { font-size: .8rem; }
            .bd-content-add-btn { margin-left: auto; display: inline-flex; align-items: center; gap: .3rem; padding: .2rem .6rem; border-radius: 5px; border: 1px dashed rgba(99,102,241,.4); background: transparent; color: rgba(99,102,241,.7); cursor: pointer; font-size: .72rem; font-weight: 600; transition: all .15s; font-family: inherit; white-space: nowrap; }
            .bd-content-add-btn:hover { border-color: #6366f1; color: #6366f1; background: rgba(99,102,241,.05); }
            .bd-no-selection { display: flex; align-items: center; justify-content: center; height: 100%; padding: 3rem; color: var(--text-muted); font-size: .88rem; font-style: italic; }
            .bd-empty-doc { color: var(--text-muted); font-size: .82rem; font-style: italic; padding: .25rem 0; }
            .bd-collection-card { display: flex; align-items: center; gap: .6rem; padding: .6rem .85rem; background: var(--bg-raised); border: 1px solid var(--border); border-radius: var(--radius-md); cursor: pointer; transition: border-color var(--transition), box-shadow var(--transition); }
            .bd-collection-card:hover { border-color: #6366f1; box-shadow: 0 2px 8px rgba(99,102,241,.15); }
            .bd-collection-icon { width: 28px; height: 28px; border-radius: 6px; background: rgba(99,102,241,.12); color: #6366f1; display: flex; align-items: center; justify-content: center; font-size: .75rem; flex-shrink: 0; }
            .bd-collection-title { font-size: .88rem; font-weight: 500; color: var(--text-primary); }
            .bd-page-chk-row { display: flex; align-items: center; gap: .5rem; padding: .3rem .4rem; border-radius: 5px; cursor: pointer; font-size: .85rem; color: var(--text-primary); transition: background var(--transition); }
            .bd-page-chk-row:hover { background: var(--bg-hover); }

            /* ── Doc cards ────────────────────────────────────────── */
            .bd-doc-card { border: 1px solid var(--border); border-radius: 8px; padding: .6rem .85rem; display: flex; align-items: center; gap: .5rem; cursor: pointer; transition: border-color .13s, background .13s; background: var(--bg-raised); }
            .bd-doc-card:hover { border-color: #6366f1; background: rgba(99,102,241,.05); }
            .bd-doc-card-icon { width: 28px; height: 28px; border-radius: 7px; background: rgba(99,102,241,.1); color: #6366f1; display: flex; align-items: center; justify-content: center; font-size: .85rem; flex-shrink: 0; }
            .bd-doc-card-title { flex: 1; min-width: 0; font-size: .84rem; color: var(--text-primary); font-weight: 500; line-height: 1.4; word-break: break-word; }
            .bd-doc-card:hover .bd-doc-card-title { color: #6366f1; }
            .bd-doc-card-actions { display: flex; gap: 2px; flex-shrink: 0; opacity: 0; transition: opacity .15s; }
            .bd-doc-card:hover .bd-doc-card-actions { opacity: 1; }

            /* ── Shared action button ─────────────────────────────── */
            .bd-ta-btn { width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--border); background: transparent; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .6rem; transition: all .15s; font-family: inherit; }
            .bd-ta-btn:hover { border-color: var(--primary); color: var(--primary); }
            .bd-ta-btn.danger:hover { border-color: #ef4444; color: #ef4444; }

            /* ── Ack dots ─────────────────────────────────────────── */
            .bd-ack-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; vertical-align: middle; margin-right: .35rem; }
            .bd-ack-dot.bd-unread { background: #ef4444; box-shadow: 0 0 0 0 rgba(239,68,68,.6); animation: bd-pulse 1.4s ease-in-out infinite; }
            .bd-ack-dot.bd-read { background: #10b981; }
            @keyframes bd-pulse { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,.6); } 70% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }

            /* ── Modal form ───────────────────────────────────────── */
            .bd-inp { width:100%;padding:.55rem .8rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box }
            .bd-inp:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
            .bd-icon-row { display: flex; flex-wrap: wrap; gap: .4rem; }
            .bd-icon-opt { display: inline-flex; align-items: center; gap: .4rem; padding: .3rem .65rem; border-radius: var(--radius-md); border: 1.5px solid var(--border); background: var(--bg-raised); cursor: pointer; font-size: .75rem; font-family: inherit; color: var(--text-secondary); transition: all .15s; }
            .bd-icon-opt:hover { border-color: var(--ic); color: var(--text-primary); }
            .bd-icon-opt-active { border-color: var(--ic) !important; background: color-mix(in srgb,var(--ic) 10%,transparent); color: var(--text-primary) !important; }
        `;
        document.head.appendChild(s);
    },

    async renderInTab(area) {
        this._injectStyles();
        const canManage = AppState.isAdmin() && !AppState.isPreviewing();
        const seeAll = AppState.isAdmin() || AppState.isManager() || AppState.isSmm();
        area.innerHTML = `<div id="bd-content" style="padding:.25rem 0"><div style="text-align:center;padding:3rem 1rem;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> Завантаження...</div></div>`;
        try {
            const [blocks, docs, myDovs, pages, pageDovs, allDov] = await Promise.all([
                API.branchDocBlocks.getAll(),
                API.resources.getBranchDocs(null),
                seeAll ? Promise.resolve(null) : API.dovirenosti.getForProfile(AppState.user.id).catch(() => []),
                API.pages.getAll().catch(() => []),
                API.pageDovirenosti.getAll().catch(() => []),
                API.dovirenosti.getAll().catch(() => [])
            ]);
            this._blocks = blocks;
            this._pages = pages;
            this._seeAll = seeAll;
            const myDovIds = myDovs ? new Set(myDovs.map(d => d.id)) : null;
            this._myDovIds = myDovIds;
            this._dovNameMap = {};
            for (const d of allDov) this._dovNameMap[d.id] = d.name;
            this._pageDovMap = {};
            for (const r of pageDovs) {
                if (!this._pageDovMap[r.page_id]) this._pageDovMap[r.page_id] = [];
                this._pageDovMap[r.page_id].push(r.dovirenost_id);
            }
            const visibleDocs = seeAll ? docs : docs.filter(d => !d.dovirenost_id || (myDovIds && myDovIds.has(d.dovirenost_id)));
            this._byBlock = {};
            visibleDocs.forEach(d => {
                if (!this._byBlock[d.display_block]) this._byBlock[d.display_block] = [];
                this._byBlock[d.display_block].push(d);
            });
            const allDocIds = visibleDocs.map(d => d.id).filter(Boolean);
            this._ackMap = allDocIds.length ? await API.documentDownloads.getMyLatest(allDocIds).catch(() => ({})) : {};
            if (!this._selectedBlock || !this._blocks.find(b => b.id === this._selectedBlock)) {
                this._selectedBlock = this._blocks[0]?.id || null;
            }
            this._render(canManage);
        } catch(e) {
            const el = document.getElementById('bd-content');
            if (el) el.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-muted)">${Fmt.esc(e.message)}</div>`;
        }
    },

    async init(container) {
        UI.setBreadcrumb([{ label: 'Куточок споживача' }]);
        const canManage = AppState.isAdmin() && !AppState.isPreviewing();
        const seeAll = AppState.isAdmin() || AppState.isManager() || AppState.isSmm();
        let userDovIds = [];
        if (!canManage) {
            const dovs = await API.dovirenosti.getForProfile(AppState.user.id).catch(() => []);
            userDovIds = dovs.map(d => d.id);
        }
        this._injectStyles();
        container.innerHTML = `
        <div class="bd-wrap">
            <div class="bd-header">
                <div class="bd-hero">
                    <div class="bd-hero-ico">⚖️</div>
                    <div>
                        <div class="bd-title">Куточок споживача</div>
                        <div class="bd-subtitle">Обов'язкові документи для розміщення у відокремленому підрозділі</div>
                    </div>
                </div>
                <div style="display:flex;gap:.5rem;align-items:center">
                    ${!canManage && userDovIds.length ? `<span class="bd-label-badge"><i class="fa-solid fa-tag"></i>${userDovIds.length} ТОВ</span>` : ''}
                    ${canManage ? `<button class="btn btn-primary btn-sm" onclick="BranchDocsPage._blockModal()"><i class="fa-solid fa-plus"></i> Додати рядок</button>` : ''}
                </div>
            </div>
            <div id="bd-content"><div style="text-align:center;padding:3rem 1rem;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> Завантаження...</div></div>
        </div>`;
        try {
            Loader.show();
            const [blocks, docs, myDovs, pages, pageDovs, allDov] = await Promise.all([
                API.branchDocBlocks.getAll(),
                API.resources.getBranchDocs(null),
                seeAll ? Promise.resolve(null) : API.dovirenosti.getForProfile(AppState.user.id).catch(() => []),
                API.pages.getAll().catch(() => []),
                API.pageDovirenosti.getAll().catch(() => []),
                API.dovirenosti.getAll().catch(() => [])
            ]);
            this._blocks = blocks;
            this._pages = pages;
            this._seeAll = seeAll;
            const myDovIds = myDovs ? new Set(myDovs.map(d => d.id)) : null;
            this._myDovIds = myDovIds;
            this._dovNameMap = {};
            for (const d of allDov) this._dovNameMap[d.id] = d.name;
            this._pageDovMap = {};
            for (const r of pageDovs) {
                if (!this._pageDovMap[r.page_id]) this._pageDovMap[r.page_id] = [];
                this._pageDovMap[r.page_id].push(r.dovirenost_id);
            }
            const visibleDocs = seeAll ? docs : docs.filter(d => !d.dovirenost_id || (myDovIds && myDovIds.has(d.dovirenost_id)));
            this._byBlock = {};
            visibleDocs.forEach(d => {
                if (!this._byBlock[d.display_block]) this._byBlock[d.display_block] = [];
                this._byBlock[d.display_block].push(d);
            });
            const allDocIds = visibleDocs.map(d => d.id).filter(Boolean);
            this._ackMap = allDocIds.length ? await API.documentDownloads.getMyLatest(allDocIds).catch(() => ({})) : {};
            if (!this._selectedBlock || !this._blocks.find(b => b.id === this._selectedBlock)) {
                this._selectedBlock = this._blocks[0]?.id || null;
            }
            this._render(canManage);
        } catch(e) {
            const el = document.getElementById('bd-content');
            if (el) el.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-muted)">${Fmt.esc(e.message)}</div>`;
        } finally {
            Loader.hide();
        }
    },

    _render(canManage) {
        const el = document.getElementById('bd-content');
        if (!el) return;

        if (!this._blocks.length) {
            el.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);font-size:.88rem">
                <i class="fa-regular fa-folder-open" style="font-size:2rem;color:rgba(99,102,241,.3);display:block;margin-bottom:.5rem"></i>
                Блоки не налаштовано
            </div>`;
            return;
        }

        const sidebarHtml = this._blocks.map(b => {
            const blockDocs = this._byBlock[b.number] || [];
            const ico = b.icon && b.icon !== 'fa-circle' ? this._iconOptions.find(o => o.icon === b.icon) : null;
            const isActive = this._selectedBlock === b.id;

            let dotHtml = '';
            if (blockDocs.length > 0) {
                const unread = blockDocs.filter(d => !this._ackMap[d.id]).length;
                dotHtml = `<div class="bd-item-dot-wrap"><span class="bd-ibtn-dot ${unread > 0 ? 'unread' : 'read'}" title="${unread > 0 ? `Непрочитано: ${unread}` : 'Всі прочитано'}"></span></div>`;
            } else {
                dotHtml = `<div class="bd-item-dot-wrap"><span class="bd-ibtn-dot empty"></span></div>`;
            }

            return `
            <div class="bd-item-btn${isActive ? ' active' : ''}" id="bd-ibtn-${b.id}"
                 onclick="BranchDocsPage._selectBlock('${b.id}')">
                <span class="bd-item-num">${b.number}</span>
                <div class="bd-item-body">
                    <div class="bd-item-title-row">
                        ${ico ? `<i class="fa-solid ${Fmt.esc(b.icon)}" style="color:${ico.color};font-size:.8rem;flex-shrink:0"></i>` : ''}
                        <span>${Fmt.esc(b.title)}</span>
                    </div>
                    ${canManage ? `
                    <div class="bd-item-actions" onclick="event.stopPropagation()">
                        <button class="bd-ta-btn" title="Редагувати" onclick="BranchDocsPage._blockModal('${b.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="bd-ta-btn danger" title="Видалити" onclick="BranchDocsPage._deleteBlock('${b.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>` : ''}
                </div>
                ${dotHtml}
            </div>`;
        }).join('');

        el.innerHTML = `
        <div class="bd-split">
            <div class="bd-split-sidebar">${sidebarHtml}</div>
            <div class="bd-split-content" id="bd-split-content">
                ${this._buildBlockContent(this._selectedBlock, canManage)}
            </div>
        </div>`;
    },

    _buildBlockContent(blockId, canManage) {
        if (!blockId) return `<div class="bd-no-selection"><i class="fa-solid fa-arrow-left" style="margin-right:.4rem;opacity:.5"></i>Оберіть блок зліва</div>`;
        const b = this._blocks.find(x => x.id === blockId);
        if (!b) return '';

        const ico = b.icon && b.icon !== 'fa-circle' ? this._iconOptions.find(o => o.icon === b.icon) : null;
        const blockDocs = this._byBlock[b.number] || [];
        const pageIds = b.page_ids || [];
        const linkedPages = pageIds.map(pid => this._pages.find(p => p.id === pid)).filter(p => {
            if (!p) return false;
            if (this._seeAll) return true;
            if (!p.is_published) return false;
            const dovReqs = this._pageDovMap?.[p.id] || [];
            if (!dovReqs.length) return true;
            return this._myDovIds && dovReqs.some(id => this._myDovIds.has(id));
        });

        const deptHtml = b.dept ? `
        <div class="bd-content-dept">
            <div class="bd-content-dept-icon">
                ${ico ? `<i class="fa-solid ${Fmt.esc(b.icon)}" style="color:${ico.color}"></i>` : '<i class="fa-solid fa-building" style="color:#6366f1"></i>'}
            </div>
            <span class="bd-content-dept-name">${Fmt.esc(b.dept)}</span>
        </div>` : '';

        let docsHtml = '';
        if (linkedPages.length) {
            docsHtml = linkedPages.map(lp => {
                const dovIds = this._pageDovMap?.[lp.id] || [];
                const dovNames = dovIds.map(id => this._dovNameMap?.[id]).filter(Boolean);
                const label = dovNames.length ? dovNames.join(', ') : lp.title;
                return `
                <div class="bd-collection-card" onclick="Router.go('collections/${lp.id}')">
                    <div class="bd-collection-icon"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
                    <span class="bd-collection-title">${Fmt.esc(label)}</span>
                </div>`;
            }).join('');
        } else if (blockDocs.length) {
            docsHtml = blockDocs.map(d => {
                const acked = !!this._ackMap[d.id];
                const label = d.dovirenosti?.name ? Fmt.esc(d.dovirenosti.name) : Fmt.esc(d.title);
                return `
                <div class="bd-doc-card" onclick="BranchDocsPage._openDoc('${Fmt.esc(d.storage_path||'')}','${d.id}')">
                    <span class="bd-ack-dot ${acked ? 'bd-read' : 'bd-unread'}" data-doc-dot="${d.id}" title="${acked ? 'Ознайомлено' : 'Не ознайомлено'}"></span>
                    <div class="bd-doc-card-icon"><i class="fa-solid fa-file-pdf"></i></div>
                    <span class="bd-doc-card-title">${label}</span>
                    ${canManage ? `
                    <div class="bd-doc-card-actions" onclick="event.stopPropagation()">
                        <button class="bd-ta-btn danger" title="Видалити" onclick="BranchDocsPage._deleteDoc('${d.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>` : ''}
                </div>`;
            }).join('');
        } else {
            docsHtml = `<div class="bd-empty-doc">— документів немає —</div>`;
        }

        return `
        <div class="bd-content-inner">
            ${deptHtml}
            <div>
                <div class="bd-content-docs-header">
                    <i class="fa-solid fa-file-lines" style="color:#6366f1"></i>
                    Документи
                    ${canManage && !linkedPages.length ? `<button class="bd-content-add-btn" onclick="BranchDocsPage._uploadModal(${b.number},${JSON.stringify(b.title).replace(/"/g,'&quot;')})"><i class="fa-solid fa-plus"></i> Завантажити</button>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;gap:.4rem;margin-top:.55rem">${docsHtml}</div>
            </div>
        </div>`;
    },

    _selectBlock(id) {
        this._selectedBlock = id;
        document.querySelectorAll('.bd-item-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`bd-ibtn-${id}`)?.classList.add('active');
        const content = document.getElementById('bd-split-content');
        if (content) content.innerHTML = this._buildBlockContent(id, AppState.isAdmin() && !AppState.isPreviewing());
    },

    // ── Block CRUD ────────────────────────────────────────────────────

    async _blockModal(id) {
        const b = id ? this._blocks.find(x => x.id === id) : null;
        const maxNum = this._blocks.reduce((m, x) => Math.max(m, x.number), 0);
        const curIcon = b?.icon || '';

        const iconPicker = this._iconOptions.map(o => `
            <button type="button" class="bd-icon-opt${curIcon === o.icon ? ' bd-icon-opt-active' : ''}"
                    data-icon="${o.icon}" title="${o.label}"
                    onclick="BranchDocsPage._pickIcon(this)"
                    style="--ic:${o.color}">
                <i class="fa-solid ${o.icon}" style="color:${o.color}"></i>
                <span>${o.label}</span>
            </button>`).join('');

        const curPageIds = new Set(b?.page_ids || []);
        const pageCheckboxes = this._pages.length
            ? this._pages.filter(p => p.is_published || AppState.isAdmin()).map(p => `
                <label class="bd-page-chk-row">
                    <input type="checkbox" class="bd-page-chk" value="${p.id}" ${curPageIds.has(p.id) ? 'checked' : ''}>
                    <span>${Fmt.esc(p.title)}</span>
                </label>`).join('')
            : `<div style="font-size:.82rem;color:var(--text-muted);padding:.4rem 0">Немає доступних колекцій</div>`;

        Modal.open({
            title: b ? 'Редагувати блок' : 'Додати рядок',
            size: 'lg',
            body: `
            <input type="hidden" id="bd-bl-icon" value="${curIcon}">
            <div style="display:flex;flex-direction:column;gap:1rem">
                <div style="display:grid;grid-template-columns:80px 1fr;gap:.75rem">
                    <div>
                        <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">№ <span style="color:var(--danger)">*</span></label>
                        <input id="bd-bl-num" type="number" min="1" class="bd-inp" value="${b ? b.number : maxNum + 1}">
                    </div>
                    <div>
                        <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">Відповідальний підрозділ</label>
                        <input id="bd-bl-dept" class="bd-inp" placeholder="напр. юридичний відділ" value="${Fmt.esc(b?.dept || '')}">
                    </div>
                </div>
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">Іконка відповідального</label>
                    <div class="bd-icon-row">${iconPicker}</div>
                </div>
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">Назва блоку <span style="color:var(--danger)">*</span></label>
                    <textarea id="bd-bl-title" class="bd-inp" rows="3" placeholder="Назва блоку відповідно до законодавства...">${Fmt.esc(b?.title || '')}</textarea>
                </div>
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">
                        Сторінки-колекції
                        <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted)">— замість завантаження файлів</span>
                    </label>
                    <div style="border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-raised);max-height:150px;overflow-y:auto;padding:.3rem .5rem">
                        ${pageCheckboxes}
                    </div>
                </div>
            </div>`,
            footer: `<button class="btn btn-primary" onclick="BranchDocsPage._saveBlock(${JSON.stringify(id || null).replace(/"/g,'&quot;')})"><i class="fa-solid fa-floppy-disk"></i> Зберегти</button>
                     <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>`
        });
    },

    _pickIcon(btn) {
        document.querySelectorAll('.bd-icon-opt').forEach(b => b.classList.remove('bd-icon-opt-active'));
        btn.classList.add('bd-icon-opt-active');
        document.getElementById('bd-bl-icon').value = btn.dataset.icon;
    },

    async _saveBlock(id) {
        const number = parseInt(document.getElementById('bd-bl-num')?.value);
        const title  = document.getElementById('bd-bl-title')?.value.trim();
        const dept   = document.getElementById('bd-bl-dept')?.value.trim() || null;
        const icon   = document.getElementById('bd-bl-icon')?.value || null;
        const page_ids = Array.from(document.querySelectorAll('.bd-page-chk:checked')).map(c => c.value);
        if (!title || !number) { Toast.warning('Заповніть обов\'язкові поля'); return; }
        try {
            Loader.show();
            if (id) {
                await API.branchDocBlocks.update(id, { number, title, dept, icon, order_index: number, page_ids });
                if (!this._selectedBlock) this._selectedBlock = id;
            } else {
                await API.branchDocBlocks.create({ number, title, dept, icon, order_index: number, page_ids });
            }
            Modal.close();
            Toast.success(id ? 'Блок оновлено' : 'Блок додано');
            await this._reload(true);
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    },

    async _deleteBlock(id) {
        if (!await Modal.confirm({ message: 'Видалити блок? Документи в ньому залишаться в системі.', danger: true })) return;
        try {
            Loader.show();
            if (this._selectedBlock === id) this._selectedBlock = null;
            await API.branchDocBlocks.remove(id);
            Toast.success('Блок видалено');
            await this._reload(true);
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    },

    async _reload(canManage) {
        const seeAll = AppState.isAdmin() || AppState.isManager() || AppState.isSmm();
        const [blocks, docs, myDovs, pages, pageDovs] = await Promise.all([
            API.branchDocBlocks.getAll(),
            API.resources.getBranchDocs(null),
            seeAll ? Promise.resolve(null) : API.dovirenosti.getForProfile(AppState.user.id).catch(() => []),
            API.pages.getAll().catch(() => []),
            seeAll ? Promise.resolve([]) : API.pageDovirenosti.getAll().catch(() => [])
        ]);
        this._blocks = blocks;
        this._pages = pages;
        this._seeAll = seeAll;
        const myDovIds = myDovs ? new Set(myDovs.map(d => d.id)) : null;
        this._myDovIds = myDovIds;
        this._pageDovMap = {};
        for (const r of pageDovs) {
            if (!this._pageDovMap[r.page_id]) this._pageDovMap[r.page_id] = [];
            this._pageDovMap[r.page_id].push(r.dovirenost_id);
        }
        const visibleDocs = seeAll ? docs : docs.filter(d => !d.dovirenost_id || (myDovIds && myDovIds.has(d.dovirenost_id)));
        this._byBlock = {};
        visibleDocs.forEach(d => {
            if (!this._byBlock[d.display_block]) this._byBlock[d.display_block] = [];
            this._byBlock[d.display_block].push(d);
        });
        const allDocIds = visibleDocs.map(d => d.id).filter(Boolean);
        this._ackMap = allDocIds.length ? await API.documentDownloads.getMyLatest(allDocIds).catch(() => ({})) : {};
        if (!this._selectedBlock || !this._blocks.find(b => b.id === this._selectedBlock)) {
            this._selectedBlock = this._blocks[0]?.id || null;
        }
        this._render(canManage);
    },

    // ── Document actions ──────────────────────────────────────────────

    async _openDoc(storagePath, resourceId) {
        try {
            Loader.show();
            const url = await API.resources.getSignedUrl(storagePath);
            const doc = Object.values(this._byBlock).flat().find(d => d.id === resourceId);
            const title = doc?.title || storagePath.split('/').pop();
            const viewerUrl = `pdf-viewer.html?file=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&download=1`;
            window.open(viewerUrl, '_blank', 'noopener,noreferrer');
            if (resourceId) {
                API.documentDownloads.track(resourceId).catch(() => {});
                this._ackMap[resourceId] = { at: new Date().toISOString() };
                const dot = document.querySelector(`[data-doc-dot="${resourceId}"]`);
                if (dot) { dot.classList.remove('bd-unread'); dot.classList.add('bd-read'); dot.title = 'Ознайомлено'; }
                // Update sidebar dot
                const block = Object.entries(this._byBlock).find(([, docs]) => docs.find(d => d.id === resourceId));
                if (block) {
                    const [bNum, bDocs] = block;
                    const anyUnread = bDocs.some(d => !this._ackMap[d.id]);
                    const blk = this._blocks.find(b => b.number === parseInt(bNum));
                    if (blk) {
                        const sidebarDot = document.querySelector(`#bd-ibtn-${blk.id} .bd-ibtn-dot`);
                        if (sidebarDot) { sidebarDot.className = `bd-ibtn-dot ${anyUnread ? 'unread' : 'read'}`; }
                    }
                }
            }
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    },

    async _uploadModal(blockNum, blockTitle) {
        const dovs = await API.dovirenosti.getAll().catch(() => []);
        Modal.open({
            title: `Блок ${blockNum} — завантажити документ`,
            size: 'lg',
            body: `
            <div style="background:var(--bg-raised);border-left:3px solid var(--primary);border-radius:var(--radius-md);padding:.65rem .9rem;margin-bottom:1.25rem;font-size:.82rem;color:var(--text-secondary);line-height:1.4">
                ${Fmt.esc(blockTitle)}
            </div>
            <div style="display:flex;flex-direction:column;gap:1rem">
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">Назва документу <span style="color:var(--danger)">*</span></label>
                    <input id="bd-up-title" type="text" autocomplete="off" placeholder="Наприклад: Витяг з реєстру..." class="bd-inp">
                </div>
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">
                        Довіреність (ТОВ)
                        <span style="font-weight:400;color:var(--text-muted)">&nbsp;— залиш порожнім для всіх</span>
                    </label>
                    <select id="bd-up-dovid" class="bd-inp">
                        <option value="">— для всіх підрозділів —</option>
                        ${dovs.map(d => `<option value="${d.id}">${Fmt.esc(d.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">Файл <span style="color:var(--danger)">*</span></label>
                    <div class="file-upload-frame">
                        <label for="bd-up-file" class="file-upload-area" id="bd-up-area">
                            <div class="file-upload-icon"><i class="fa-solid fa-file-arrow-up"></i></div>
                            <div class="file-upload-label" id="bd-up-label">Натисніть або перетягніть файл</div>
                            <div class="file-upload-hint">PDF, DOC, DOCX</div>
                            <input type="file" id="bd-up-file" accept=".pdf,.doc,.docx" style="display:none"
                                   onchange="(function(i){const t=document.getElementById('bd-up-title');const l=document.getElementById('bd-up-label');const f=i.files[0];if(f){if(!t.value)t.value=f.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();l.textContent=f.name;}else{l.textContent='Натисніть або перетягніть файл';}})(this)">
                        </label>
                    </div>
                </div>
            </div>`,
            footer: `<button class="btn btn-primary" onclick="BranchDocsPage._doUpload(${blockNum})"><i class="fa-solid fa-upload"></i> Завантажити</button>
                     <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>`
        });
    },

    async _doUpload(blockNum) {
        const title = Dom.val('bd-up-title').trim();
        const dovirenost_id = Dom.val('bd-up-dovid') || null;
        const file = document.getElementById('bd-up-file')?.files?.[0];
        if (!title) { Toast.warning('Введіть назву'); return; }
        if (!file)  { Toast.warning('Оберіть файл'); return; }
        try {
            Loader.show();
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const path = `branch-docs/${Date.now()}_${safeName}`;
            const { error: upErr } = await supabase.storage.from('lesson-resources').upload(path, file);
            if (upErr) throw upErr;
            await API.resources.create({ title, type: 'document', storage_path: path, display_block: blockNum, dovirenost_id });
            Modal.close();
            Toast.success('Завантажено');
            await this._reload(true);
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    },

    async _deleteDoc(id) {
        if (!await Modal.confirm({ message: 'Видалити документ?', danger: true })) return;
        try {
            Loader.show();
            await API.resources.delete(id);
            Toast.success('Видалено');
            await this._reload(true);
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    }
};
