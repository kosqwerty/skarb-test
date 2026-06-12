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
    _headerDocs: [],     // top-level files above the split
    _tabs: [],           // bd_tabs rows
    _selectedTab: null,  // currently selected tab id

    _tabColors: [
        { bg: 'rgba(239,68,68,.13)',   border: 'rgba(239,68,68,.45)',   text: '#ef4444'  },
        { bg: 'rgba(99,102,241,.13)',  border: 'rgba(99,102,241,.45)',  text: '#6366f1'  },
        { bg: 'rgba(16,185,129,.13)',  border: 'rgba(16,185,129,.45)',  text: '#10b981'  },
        { bg: 'rgba(245,158,11,.13)',  border: 'rgba(245,158,11,.45)',  text: '#f59e0b'  },
        { bg: 'rgba(14,165,233,.13)',  border: 'rgba(14,165,233,.45)',  text: '#0ea5e9'  },
        { bg: 'rgba(168,85,247,.13)',  border: 'rgba(168,85,247,.45)',  text: '#a855f7'  },
        { bg: 'rgba(236,72,153,.13)',  border: 'rgba(236,72,153,.45)',  text: '#ec4899'  },
        { bg: 'rgba(20,184,166,.13)',  border: 'rgba(20,184,166,.45)',  text: '#14b8a6'  },
    ],

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
            .bd-split-sidebar { width: 550px; flex-shrink: 0; border-right: 1px solid rgba(99,102,241,.15); display: flex; flex-direction: column; overflow-y: auto; background: var(--bg-raised); }
            .bd-split-content { flex: 1; min-width: 0; max-width: 450px; overflow-y: auto; max-height: 600px; }

            /* ── Sidebar item buttons ─────────────────────────────── */
            .bd-item-btn { display: flex; align-items: flex-start; gap: .55rem; padding: .7rem 1rem; cursor: pointer; border: none; background: transparent; text-align: left; color: var(--text-primary); border-bottom: 1px solid rgba(99,102,241,.1); font-family: inherit; font-size: .78rem; width: 100%; transition: background .12s; }
            .bd-item-btn:last-of-type { border-bottom: none; }
            .bd-item-btn:hover { background: rgba(99,102,241,.05); }
            .bd-item-btn.active { background: rgba(99,102,241,.1); }
            .bd-item-num { width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0; background: var(--bg-surface); color: var(--text-muted); display: flex; align-items: center; justify-content: center; font-size: .7rem; font-weight: 800; margin-top: .1rem; border: 1px solid var(--border); transition: all .12s; }
            .bd-item-btn.active .bd-item-num { background: #6366f1; color: #fff; border-color: #6366f1; }
            .bd-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .3rem; }
            .bd-item-title-row { display: flex; align-items: center; gap: .4rem; font-weight: 600; line-height: 1.4; font-size: .78rem; }
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
            .bd-tov-block { padding: .75rem 1rem; background: rgba(99,102,241,.05); border: 1px solid rgba(99,102,241,.15); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: .4rem; }
            .bd-tov-label { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #6366f1; display: flex; align-items: center; gap: .4rem; }
            .bd-tov-text { font-size: .875rem; line-height: 1.65; color: var(--text-primary); white-space: pre-wrap; }
            .bd-content-docs-header { display: flex; align-items: center; gap: .5rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-muted); padding-bottom: .5rem; border-bottom: 1px solid var(--border); }
            .bd-content-docs-header i { font-size: .8rem; }
            .bd-content-add-btn { margin-left: auto; display: inline-flex; align-items: center; gap: .3rem; padding: .2rem .6rem; border-radius: 5px; border: 1px dashed rgba(99,102,241,.4); background: transparent; color: rgba(99,102,241,.7); cursor: pointer; font-size: .72rem; font-weight: 600; transition: all .15s; font-family: inherit; white-space: nowrap; }
            .bd-content-add-btn:hover { border-color: #6366f1; color: #6366f1; background: rgba(99,102,241,.05); }
            .bd-no-selection { display: flex; align-items: center; justify-content: center; height: 100%; padding: 3rem; color: var(--text-muted); font-size: .88rem; font-style: italic; }
            .bd-empty-doc { color: var(--text-muted); font-size: .82rem; font-style: italic; padding: .25rem 0; }
            /* ── Header docs ─────────────────────────────────────────── */
            .bd-hdr-zone { border: 1px solid rgba(99,102,241,.2); border-radius: var(--radius-xl); background: var(--bg-surface); padding: .9rem 1.1rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: .6rem; }
            .bd-hdr-title { display: flex; align-items: center; gap: .5rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #6366f1; }
            .bd-hdr-docs { display: flex; flex-wrap: wrap; gap: .5rem; }
            .bd-hdr-doc-card { display: inline-flex; align-items: center; gap: .5rem; padding: .4rem .75rem; border: 1px solid rgba(99,102,241,.2); border-radius: var(--radius-md); background: var(--bg-raised); cursor: pointer; transition: border-color .13s, background .13s; font-size: .84rem; color: var(--text-primary); font-family: inherit; }
            .bd-hdr-doc-card:hover { border-color: #6366f1; background: rgba(99,102,241,.05); color: #6366f1; }
            .bd-hdr-doc-card-ico { width: 26px; height: 26px; border-radius: 6px; background: rgba(99,102,241,.1); color: #6366f1; display: flex; align-items: center; justify-content: center; font-size: .8rem; flex-shrink: 0; }
            .bd-hdr-doc-card-actions { display: flex; gap: 2px; flex-shrink: 0; opacity: 0; pointer-events: none; transition: opacity .15s; margin-left: .25rem; }
            .bd-hdr-doc-card:hover .bd-hdr-doc-card-actions { opacity: 1; pointer-events: auto; }
            .bd-hdr-add-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .35rem .75rem; border-radius: var(--radius-md); border: 1.5px dashed rgba(99,102,241,.35); background: transparent; color: rgba(99,102,241,.7); font-size: .8rem; cursor: pointer; transition: all .15s; font-family: inherit; }
            .bd-hdr-add-btn:hover { border-color: #6366f1; color: #6366f1; background: rgba(99,102,241,.04); }
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
            /* inline icon trigger (matches rf style) */
            .bd-icon-trigger { flex-shrink:0; width:38px; height:38px; border-radius:var(--radius-md); border:1px solid var(--border); background:var(--bg-raised); cursor:pointer; display:flex;align-items:center;justify-content:center; font-size:1rem; transition:border-color .15s; position:relative; }
            .bd-icon-trigger:hover { border-color:rgba(99,102,241,.4); }
            .bd-icon-drop { position:absolute; top:calc(100% + 4px); left:0; z-index:200; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-md); box-shadow:0 6px 24px rgba(0,0,0,.18); padding:.4rem; display:grid; grid-template-columns:repeat(4,1fr); gap:.3rem; min-width:220px; }
            .bd-icon-drop-opt { display:flex;flex-direction:column;align-items:center;gap:.15rem; padding:.35rem .3rem; border-radius:var(--radius-sm); border:1.5px solid transparent; background:transparent; cursor:pointer; font-size:.6rem; font-family:inherit; color:var(--text-secondary); transition:all .12s; }
            .bd-icon-drop-opt:hover { background:var(--bg-raised); border-color:var(--ic); color:var(--text-primary); }
            .bd-icon-drop-opt.active { background:color-mix(in srgb,var(--ic) 12%,transparent); border-color:var(--ic); color:var(--text-primary); }

            /* ── Shared input ─────────────────────────────────────── */
            .bd-form-input-g { width:100%;padding:.55rem .8rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .15s,box-shadow .15s; }
            .bd-form-input-g:focus { border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.12); }

            /* ── Tab bar ──────────────────────────────────────────── */
            .bd-tab-bar { display: flex; align-items: center; gap: .35rem; margin-bottom: 1.1rem; flex-wrap: wrap; }
            .bd-tab { display: inline-flex; align-items: center; gap: .45rem; padding: .4rem .9rem; border-radius: var(--radius-md); border: 1.5px solid transparent; font-size: .83rem; font-weight: 500; cursor: pointer; font-family: inherit; transition: filter .15s, box-shadow .15s, font-weight .1s; white-space: nowrap; }
            .bd-tab:hover { filter: brightness(1.08); }
            .bd-tab.active { font-weight: 700; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
            .bd-tab-actions { display: inline-flex; gap: 2px; margin-left: .15rem; opacity: 0; pointer-events: none; transition: opacity .12s; }
            .bd-tab:hover .bd-tab-actions, .bd-tab.active .bd-tab-actions { opacity: 1; pointer-events: auto; }
            .bd-tab-act-btn { width: 16px; height: 16px; border-radius: 3px; border: none; background: transparent; color: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .58rem; padding: 0; opacity: .7; transition: opacity .12s; }
            .bd-tab-act-btn:hover { opacity: 1; }
            .bd-tab-add { border-style: dashed !important; background: transparent !important; color: var(--text-muted) !important; }
            .bd-tab-add:hover { color: var(--text-primary) !important; border-color: var(--border) !important; }
            .bd-tab-bar-right { margin-left: auto; }
            .bd-tab-sep { width: 1px; height: 20px; background: var(--border); flex-shrink: 0; margin: 0 .1rem; }
        `;
        document.head.appendChild(s);
    },

    async renderInTab(area) {
        this._injectStyles();
        const canManage = AppState.isAdmin() && !AppState.isPreviewing();
        const seeAll = AppState.isAdmin() || AppState.isManager() || AppState.isSmm();
        area.innerHTML = `<div id="bd-content" style="padding:.25rem 0"><div style="text-align:center;padding:3rem 1rem;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> Завантаження...</div></div>`;
        try {
            const [blocks, docs, myDovs, pages, pageDovs, allDov, headerDocs, tabs] = await Promise.all([
                API.branchDocBlocks.getAll(),
                API.resources.getBranchDocs(null),
                seeAll ? Promise.resolve(null) : API.dovirenosti.getForProfile(AppState.user.id).catch(() => []),
                API.pages.getAll().catch(() => []),
                API.pageDovirenosti.getAll().catch(() => []),
                API.dovirenosti.getAll().catch(() => []),
                API.resources.getBranchHeaderDocs().catch(() => []),
                API.bdTabs.getAll().catch(() => [])
            ]);
            this._headerDocs = headerDocs;
            this._tabs = tabs;
            if (this._tabs.length && !this._tabs.find(t => t.id === this._selectedTab)) {
                this._selectedTab = this._tabs[0].id;
            } else if (!this._tabs.length) {
                this._selectedTab = null;
            }
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
            const tabBlocks = this._tabs.length && this._selectedTab
                ? this._blocks.filter(b => b.tab_id === this._selectedTab || b.tab_id == null)
                : this._blocks;
            if (!this._selectedBlock || !tabBlocks.find(b => b.id === this._selectedBlock)) {
                this._selectedBlock = tabBlocks[0]?.id || null;
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
                </div>
            </div>
            <div id="bd-content"><div style="text-align:center;padding:3rem 1rem;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> Завантаження...</div></div>
        </div>`;
        try {
            Loader.show();
            const [blocks, docs, myDovs, pages, pageDovs, allDov, tabs] = await Promise.all([
                API.branchDocBlocks.getAll(),
                API.resources.getBranchDocs(null),
                seeAll ? Promise.resolve(null) : API.dovirenosti.getForProfile(AppState.user.id).catch(() => []),
                API.pages.getAll().catch(() => []),
                API.pageDovirenosti.getAll().catch(() => []),
                API.dovirenosti.getAll().catch(() => []),
                API.bdTabs.getAll().catch(() => [])
            ]);
            this._tabs = tabs;
            if (this._tabs.length && !this._tabs.find(t => t.id === this._selectedTab)) {
                this._selectedTab = this._tabs[0].id;
            } else if (!this._tabs.length) {
                this._selectedTab = null;
            }
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
            const tabBlocks = this._tabs.length && this._selectedTab
                ? this._blocks.filter(b => b.tab_id === this._selectedTab || b.tab_id == null)
                : this._blocks;
            if (!this._selectedBlock || !tabBlocks.find(b => b.id === this._selectedBlock)) {
                this._selectedBlock = tabBlocks[0]?.id || null;
            }
            this._render(canManage);
        } catch(e) {
            const el = document.getElementById('bd-content');
            if (el) el.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-muted)">${Fmt.esc(e.message)}</div>`;
        } finally {
            Loader.hide();
        }
    },

    _buildTabBar(canManage) {
        if (!this._tabs.length && !canManage) return '';
        const tabsHtml = this._tabs.map((t, idx) => {
            const isActive = this._selectedTab === t.id;
            const c = this._tabColors[idx % this._tabColors.length];
            const baseStyle = `background:${c.bg};border-color:${isActive ? c.border : 'transparent'};color:${c.text};`;
            const actBtns = canManage ? `
                <span class="bd-tab-actions" onclick="event.stopPropagation()">
                    <button class="bd-tab-act-btn" title="Перейменувати" onclick="BranchDocsPage._renameTabModal('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="bd-tab-act-btn" title="Видалити вкладку" onclick="BranchDocsPage._deleteTab('${t.id}')"><i class="fa-solid fa-xmark"></i></button>
                </span>` : '';
            return `<button class="bd-tab${isActive ? ' active' : ''}" style="${baseStyle}" onclick="BranchDocsPage._selectTab('${t.id}')">
                <i class="fa-solid fa-folder" style="font-size:.75rem"></i>
                ${Fmt.esc(t.title)}
                ${actBtns}
            </button>${idx < this._tabs.length - 1 ? '<span class="bd-tab-sep"></span>' : ''}`;
        }).join('');
        const addBtn = canManage
            ? `<button class="bd-tab bd-tab-add bd-tab-bar-right" onclick="BranchDocsPage._addTabModal()"><i class="fa-solid fa-plus" style="font-size:.7rem"></i> Додати вкладку</button>`
            : '';
        return `<div class="bd-tab-bar">${tabsHtml}${addBtn}</div>`;
    },

    _render(canManage) {
        const el = document.getElementById('bd-content');
        if (!el) return;

        const tabBar = this._buildTabBar(canManage);
        const visibleBlocks = this._tabs.length && this._selectedTab
            ? this._blocks.filter(b => b.tab_id === this._selectedTab || b.tab_id == null)
            : this._blocks;

        if (!visibleBlocks.length) {
            el.innerHTML = `
            ${tabBar}
            ${this._buildHeaderZone(canManage)}
            <div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);font-size:.88rem">
                <i class="fa-regular fa-folder-open" style="font-size:2rem;color:rgba(99,102,241,.3);display:block;margin-bottom:.5rem"></i>
                ${!this._blocks.length ? 'Блоки не налаштовано' : 'У цій вкладці немає рядків'}
                ${canManage ? `<div style="margin-top:1rem"><button class="btn btn-primary btn-sm" onclick="BranchDocsPage._blockModal()"><i class="fa-solid fa-plus"></i> Додати рядок</button></div>` : ''}
            </div>`;
            return;
        }

        const sidebarHtml = visibleBlocks.map((b, idx) => {
            const blockDocs = this._byBlock[b.number] || [];
            const ico = b.icon && b.icon !== 'fa-circle' ? this._iconOptions.find(o => o.icon === b.icon) : null;
            const isActive = this._selectedBlock === b.id;

            const hasPages = (b.page_ids || []).length > 0;
            const _isAcked = d => { const a = this._ackMap[d.id]; return a && (a.version || 1) >= (d.doc_version || 1); };
            let dotHtml = '';
            if (blockDocs.length > 0) {
                const unread = blockDocs.filter(d => !_isAcked(d)).length;
                dotHtml = `<div class="bd-item-dot-wrap"><span class="bd-ibtn-dot ${unread > 0 ? 'unread' : 'read'}" title="${unread > 0 ? `Непрочитано: ${unread}` : 'Всі прочитано'}"></span></div>`;
            } else if (hasPages) {
                dotHtml = `<div class="bd-item-dot-wrap"><span class="bd-ibtn-dot read" title="Є пов'язані сторінки"></span></div>`;
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
                        <button class="bd-ta-btn" title="Вгору" onclick="BranchDocsPage._moveBlock('${b.id}',-1)" ${idx === 0 ? 'disabled style="opacity:.3;cursor:default"' : ''}><i class="fa-solid fa-chevron-up"></i></button>
                        <button class="bd-ta-btn" title="Вниз" onclick="BranchDocsPage._moveBlock('${b.id}',1)" ${idx === visibleBlocks.length - 1 ? 'disabled style="opacity:.3;cursor:default"' : ''}><i class="fa-solid fa-chevron-down"></i></button>
                        <button class="bd-ta-btn" title="Редагувати" onclick="BranchDocsPage._blockModal('${b.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="bd-ta-btn danger" title="Видалити" onclick="BranchDocsPage._deleteBlock('${b.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>` : ''}
                </div>
                ${dotHtml}
            </div>`;
        }).join('');

        el.innerHTML = `
        ${tabBar}
        ${this._buildHeaderZone(canManage)}
        <div class="bd-split">
            <div class="bd-split-sidebar">
                ${sidebarHtml}
                ${canManage ? `<div style="padding:.6rem .75rem;border-top:1px solid rgba(99,102,241,.1)">
                    <button class="btn btn-sm" style="width:100%;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;box-shadow:0 2px 8px rgba(99,102,241,.25)" onclick="BranchDocsPage._blockModal()"><i class="fa-solid fa-plus"></i> Додати рядок</button>
                </div>` : ''}
            </div>
            <div class="bd-split-content" id="bd-split-content">
                ${this._buildBlockContent(this._selectedBlock, canManage)}
            </div>
        </div>`;
    },

    _buildHeaderZone(canManage) {
        const seeAll = this._seeAll;
        const myDovIds = this._myDovIds;
        const docs = (this._headerDocs || []).filter(d => {
            if (seeAll) return true;
            const dovIds = (d.resource_dovirenosti || []).map(r => r.dovirenost_id);
            if (!dovIds.length) return true;
            return myDovIds && dovIds.some(id => myDovIds.has(id));
        });
        const docsHtml = docs.map(d => `
            <div class="bd-hdr-doc-card" onclick="BranchDocsPage._hdrOpenDoc('${d.id}')">
                <div class="bd-hdr-doc-card-ico"><i class="fa-solid fa-file-pdf"></i></div>
                <span>${Fmt.esc(d.title)}</span>
                ${canManage ? `<div class="bd-hdr-doc-card-actions" onclick="event.stopPropagation()">
                    <button class="bd-ta-btn" title="Редагувати" onclick="BranchDocsPage._hdrEditModal('${d.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="bd-ta-btn danger" title="Видалити" onclick="BranchDocsPage._hdrDeleteDoc('${d.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>` : ''}
            </div>`).join('');
        if (!docs.length && !canManage) return '';
        return `
        <div class="bd-hdr-zone">
            <div class="bd-hdr-title"><i class="fa-solid fa-paperclip"></i> Загальні документи</div>
            <div class="bd-hdr-docs">
                ${docsHtml}
                ${canManage ? `<button class="bd-hdr-add-btn" onclick="BranchDocsPage._hdrUploadModal()"><i class="fa-solid fa-plus"></i> Додати файл</button>` : ''}
            </div>
        </div>`;
    },

    _hdrDovCheckboxes(allDov, selectedIds = []) {
        if (!allDov.length) return '<div style="color:var(--text-muted);font-size:.8rem;padding:.2rem 0">Немає довіреностей</div>';
        return allDov.map(d => `
            <label class="rf-page-chk-row" style="gap:.5rem;padding:.25rem 0">
                <input type="checkbox" class="bd-hdr-dov-chk" value="${d.id}" ${selectedIds.includes(d.id) ? 'checked' : ''} style="flex-shrink:0">
                <span style="font-size:.82rem">${Fmt.esc(d.name)}</span>
            </label>`).join('');
    },

    async _hdrUploadModal() {
        Modal.open({
            title: '<i class="fa-solid fa-paperclip" style="color:#6366f1;margin-right:.4rem"></i> Додати загальний файл',
            size: 'lg',
            body: `<div style="display:flex;flex-direction:column;gap:1rem">
                <div>
                    <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">Назва <span style="color:var(--danger)">*</span></div>
                    <input id="bd-hdr-title" class="bd-form-input" placeholder="Наприклад: Інструкція з охорони праці">
                </div>
                <div>
                    <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">
                        Довіреності <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted)">— залиш порожнім для всіх</span>
                    </div>
                    <div style="border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-raised);max-height:130px;overflow-y:auto;padding:.3rem .5rem">
                        ${this._hdrDovCheckboxes(Object.entries(this._dovNameMap).map(([id,name])=>({id,name})))}
                    </div>
                </div>
                <div>
                    <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">Файл <span style="color:var(--danger)">*</span></div>
                    <div class="file-upload-frame">
                        <label for="bd-hdr-file" class="file-upload-area">
                            <div class="file-upload-icon"><i class="fa-solid fa-file-arrow-up"></i></div>
                            <div class="file-upload-label" id="bd-hdr-label">Натисніть або перетягніть файл</div>
                            <div class="file-upload-hint">PDF, DOC, DOCX</div>
                            <input type="file" id="bd-hdr-file" accept=".pdf,.doc,.docx" style="display:none"
                                onchange="(function(i){const t=document.getElementById('bd-hdr-title');const l=document.getElementById('bd-hdr-label');const f=i.files[0];if(f){if(!t.value)t.value=f.name.replace(/\\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();l.textContent=f.name;}})(this)">
                        </label>
                    </div>
                </div>
            </div>`,
            footer: `<button class="btn btn-sm" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;box-shadow:0 3px 10px rgba(99,102,241,.3)" onclick="BranchDocsPage._hdrDoUpload()"><i class="fa-solid fa-upload"></i> Завантажити</button>
                     <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>`
        });
        setTimeout(() => document.getElementById('bd-hdr-title')?.focus(), 50);
    },

    async _hdrDoUpload() {
        const title = Dom.val('bd-hdr-title').trim();
        const file = document.getElementById('bd-hdr-file')?.files?.[0];
        const dovIds = Array.from(document.querySelectorAll('.bd-hdr-dov-chk:checked')).map(c => c.value);
        if (!title) { Toast.warning('Введіть назву'); return; }
        if (!file)  { Toast.warning('Оберіть файл'); return; }
        try {
            Loader.show();
            const ext = file.name.slice(file.name.lastIndexOf('.'));
            const safeName = file.name.slice(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 40).replace(/_+$/, '') + ext;
            const path = `branch-docs/header/${Date.now()}_${safeName}`;
            const { error: upErr } = await supabase.storage.from('lesson-resources').upload(path, file);
            if (upErr) throw upErr;
            const res = await API.resources.create({ title, type: 'document', storage_path: path, display_block: 'bd-top' });
            if (dovIds.length) await API.resources.setDovirenosti(res.id, dovIds);
            Modal.close();
            Toast.success('Файл додано');
            await this._reload(AppState.isAdmin() && !AppState.isPreviewing());
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    async _hdrEditModal(id) {
        const doc = this._headerDocs.find(d => d.id === id);
        if (!doc) return;
        const curDovIds = (doc.resource_dovirenosti || []).map(r => r.dovirenost_id);
        Modal.open({
            title: '<i class="fa-solid fa-pen" style="color:#6366f1;margin-right:.4rem"></i> Редагувати файл',
            size: 'lg',
            body: `<div style="display:flex;flex-direction:column;gap:1rem">
                <div>
                    <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">Назва <span style="color:var(--danger)">*</span></div>
                    <input id="bd-hdr-ed-title" class="bd-form-input" value="${Fmt.esc(doc.title)}">
                </div>
                <div>
                    <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">
                        Довіреності <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted)">— залиш порожнім для всіх</span>
                    </div>
                    <div style="border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-raised);max-height:130px;overflow-y:auto;padding:.3rem .5rem">
                        ${this._hdrDovCheckboxes(Object.entries(this._dovNameMap).map(([id,name])=>({id,name})), curDovIds)}
                    </div>
                </div>
                <div>
                    <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">Замінити файл <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted)">— залиш порожнім щоб не змінювати</span></div>
                    <div class="file-upload-frame">
                        <label for="bd-hdr-ed-file" class="file-upload-area">
                            <div class="file-upload-icon"><i class="fa-solid fa-file-arrow-up"></i></div>
                            <div class="file-upload-label" id="bd-hdr-ed-label">Натисніть або перетягніть файл</div>
                            <div class="file-upload-hint">PDF, DOC, DOCX</div>
                            <input type="file" id="bd-hdr-ed-file" accept=".pdf,.doc,.docx" style="display:none"
                                onchange="document.getElementById('bd-hdr-ed-label').textContent=this.files[0]?.name||'Натисніть або перетягніть файл'">
                        </label>
                    </div>
                </div>
            </div>`,
            footer: `<button class="btn btn-sm" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;box-shadow:0 3px 10px rgba(99,102,241,.3)" onclick="BranchDocsPage._hdrDoEdit('${id}')"><i class="fa-solid fa-check"></i> Зберегти</button>
                     <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>`
        });
        setTimeout(() => document.getElementById('bd-hdr-ed-title')?.focus(), 50);
    },

    async _hdrDoEdit(id) {
        const title = Dom.val('bd-hdr-ed-title').trim();
        const file = document.getElementById('bd-hdr-ed-file')?.files?.[0];
        const dovIds = Array.from(document.querySelectorAll('.bd-hdr-dov-chk:checked')).map(c => c.value);
        if (!title) { Toast.warning('Введіть назву'); return; }
        try {
            Loader.show();
            const fields = { title };
            if (file) {
                const ext = file.name.slice(file.name.lastIndexOf('.'));
                const safeName = file.name.slice(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 40).replace(/_+$/, '') + ext;
                const path = `branch-docs/header/${Date.now()}_${safeName}`;
                const { error: upErr } = await supabase.storage.from('lesson-resources').upload(path, file);
                if (upErr) throw upErr;
                fields.storage_path = path;
            }
            await API.resources.update(id, fields);
            await API.resources.setDovirenosti(id, dovIds);
            Modal.close();
            Toast.success('Збережено');
            await this._reload(AppState.isAdmin() && !AppState.isPreviewing());
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    async _hdrDeleteDoc(id) {
        if (!await Modal.confirm({ message: 'Видалити файл?', danger: true })) return;
        try {
            Loader.show();
            await API.resources.delete(id);
            Toast.success('Видалено');
            await this._reload(AppState.isAdmin() && !AppState.isPreviewing());
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    async _hdrOpenDoc(id) {
        const doc = this._headerDocs.find(d => d.id === id);
        if (!doc) return;
        try {
            Loader.show();
            const url = await API.resources.getSignedUrl(doc.storage_path);
            const viewerUrl = `pdf-viewer.html?file=${encodeURIComponent(url)}&title=${encodeURIComponent(doc.title)}&download=1`;
            window.open(viewerUrl, '_blank', 'noopener,noreferrer');
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
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

        const tovHtml = b.tov_text ? `
        <div class="bd-tov-block">
            <div class="bd-tov-label"><i class="fa-solid fa-building-columns"></i> Для ТОВ</div>
            <div class="bd-tov-text">${Fmt.esc(b.tov_text)}</div>
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
                const acked = (() => { const a = this._ackMap[d.id]; return a && (a.version || 1) >= (d.doc_version || 1); })();
                const label = d.dovirenosti?.name ? Fmt.esc(d.dovirenosti.name) : Fmt.esc(d.title);
                return `
                <div class="bd-doc-card" onclick="BranchDocsPage._openDoc('${Fmt.esc(d.storage_path||'')}','${d.id}')">
                    <span class="bd-ack-dot ${acked ? 'bd-read' : 'bd-unread'}" data-doc-dot="${d.id}" title="${acked ? 'Ознайомлено' : 'Не ознайомлено'}"></span>
                    <div class="bd-doc-card-icon"><i class="fa-solid fa-file-pdf"></i></div>
                    <span class="bd-doc-card-title">${label}</span>
                    ${canManage ? `
                    <div class="bd-doc-card-actions" onclick="event.stopPropagation()">
                        <button class="bd-ta-btn" title="Редагувати" onclick="BranchDocsPage._editDocModal('${d.id}')"><i class="fa-solid fa-pen"></i></button>
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
            ${tovHtml}
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

    // ── Tab management ────────────────────────────────────────────────

    _selectTab(id) {
        this._selectedTab = id;
        const visibleBlocks = this._blocks.filter(b => b.tab_id === id || b.tab_id == null);
        this._selectedBlock = visibleBlocks[0]?.id || null;
        this._render(AppState.isAdmin() && !AppState.isPreviewing());
    },

    _addTabModal() {
        Modal.open({
            title: '<i class="fa-solid fa-folder-plus" style="color:#6366f1;margin-right:.4rem"></i> Нова вкладка',
            size: 'sm',
            body: `<div>
                <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">Назва вкладки <span style="color:var(--danger)">*</span></div>
                <input id="bd-tab-name-inp" class="bd-form-input-g" placeholder="Наприклад: Безпека праці" autofocus>
            </div>`,
            footer: `<button class="btn btn-sm" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none" onclick="BranchDocsPage._doAddTab()"><i class="fa-solid fa-check"></i> Створити</button>
                     <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>`
        });
        setTimeout(() => document.getElementById('bd-tab-name-inp')?.focus(), 50);
    },

    async _doAddTab() {
        const title = Dom.val('bd-tab-name-inp').trim();
        if (!title) { Toast.warning('Введіть назву'); return; }
        try {
            Loader.show();
            const tab = await API.bdTabs.create(title);
            this._selectedTab = tab.id;
            Modal.close();
            await this._reload(AppState.isAdmin() && !AppState.isPreviewing());
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    _renameTabModal(id) {
        const tab = this._tabs.find(t => t.id === id);
        if (!tab) return;
        Modal.open({
            title: '<i class="fa-solid fa-pen" style="color:#6366f1;margin-right:.4rem"></i> Перейменувати вкладку',
            size: 'sm',
            body: `<div>
                <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">Назва вкладки <span style="color:var(--danger)">*</span></div>
                <input id="bd-tab-rename-inp" class="bd-form-input-g" value="${Fmt.esc(tab.title)}">
            </div>`,
            footer: `<button class="btn btn-sm" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none" onclick="BranchDocsPage._doRenameTab('${id}')"><i class="fa-solid fa-check"></i> Зберегти</button>
                     <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>`
        });
        setTimeout(() => { const inp = document.getElementById('bd-tab-rename-inp'); if (inp) { inp.focus(); inp.select(); } }, 50);
    },

    async _doRenameTab(id) {
        const title = Dom.val('bd-tab-rename-inp').trim();
        if (!title) { Toast.warning('Введіть назву'); return; }
        try {
            Loader.show();
            await API.bdTabs.update(id, title);
            Modal.close();
            await this._reload(AppState.isAdmin() && !AppState.isPreviewing());
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    async _deleteTab(id) {
        const tab = this._tabs.find(t => t.id === id);
        if (!tab) return;
        const ok = await Modal.confirm({ message: `Видалити вкладку «${Fmt.esc(tab.title)}»? Рядки залишаться, але більше не будуть прив'язані до цієї вкладки.`, danger: true });
        if (!ok) return;
        try {
            Loader.show();
            await API.bdTabs.remove(id);
            if (this._selectedTab === id) this._selectedTab = null;
            await this._reload(AppState.isAdmin() && !AppState.isPreviewing());
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    // ── Block CRUD ────────────────────────────────────────────────────

    async _blockModal(id) {
        const b = id ? this._blocks.find(x => x.id === id) : null;
        const curIcon = b?.icon || '';

        const curIconOpt = this._iconOptions.find(o => o.icon === curIcon);
        const triggerInner = curIconOpt && curIconOpt.icon !== 'fa-circle'
            ? `<i class="fa-solid ${curIconOpt.icon}" style="color:${curIconOpt.color}"></i>`
            : `<i class="fa-regular fa-face-smile" style="color:var(--text-muted)"></i>`;
        const dropOptions = this._iconOptions.map(o => `
            <button type="button" class="bd-icon-drop-opt${curIcon === o.icon ? ' active' : ''}"
                    data-icon="${o.icon}" title="${Fmt.esc(o.label)}"
                    onclick="BranchDocsPage._pickIconDrop(this)"
                    style="--ic:${o.color}">
                <i class="fa-solid ${o.icon}" style="color:${o.color};font-size:.85rem"></i>
                <span>${Fmt.esc(o.label)}</span>
            </button>`).join('');

        const curPageIds = new Set(b?.page_ids || []);
        const pageCheckboxes = this._pages.length
            ? this._pages.filter(p => p.is_published || AppState.isAdmin()).map(p => `
                <label class="bd-page-chk-row">
                    <input type="checkbox" class="bd-page-chk" value="${p.id}" ${curPageIds.has(p.id) ? 'checked' : ''} onchange="BranchDocsPage._updateSelCount()">
                    <span>${Fmt.esc(p.title)}</span>
                </label>`).join('')
            : `<div style="font-size:.82rem;color:var(--text-muted);padding:.4rem 0">Немає доступних колекцій</div>`;

        const selCount = curPageIds.size;
        Modal.open({
            title: b ? 'Редагувати рядок' : 'Додати рядок',
            size: 'lg',
            body: `
            <input type="hidden" id="bd-bl-icon" value="${Fmt.esc(curIcon)}">
            <style>
                .bdm-wrap { display:grid;grid-template-columns:1fr 250px;gap:1rem;align-items:start; }
                .bdm-form { display:flex;flex-direction:column;gap:.9rem; }
                .bdm-sec { display:flex;flex-direction:column;gap:.6rem; }
                .bdm-sec-hdr { display:flex;align-items:center;gap:.6rem;margin-bottom:.1rem; }
                .bdm-ico { width:22px;height:22px;border-radius:6px;background:rgba(99,102,241,.12);color:#6366f1;font-size:.72rem;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
                .bdm-sec-title { font-size:.82rem;font-weight:700;color:var(--text-primary); }
                .bdm-badge { margin-left:auto;font-size:.68rem;font-weight:600;padding:.15rem .5rem;border-radius:999px;background:var(--bg-raised);border:1px solid var(--border);color:var(--text-muted); }
                .bdm-badge.sel { background:rgba(99,102,241,.1);border-color:rgba(99,102,241,.3);color:#6366f1; }
                .bdm-sub { font-size:.75rem;color:var(--text-muted);line-height:1.4; }
                .bdm-lbl { font-size:.72rem;font-weight:600;color:var(--text-muted);letter-spacing:.04em;margin-bottom:.25rem;display:block; }
                .bdm-lbl .req { color:#ef4444; }
                .bdm-counter { font-size:.68rem;color:var(--text-muted);text-align:right;margin-top:.15rem; }
                .bd-form-input { width:100%;padding:.55rem .8rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .15s,box-shadow .15s; }
                textarea.bd-form-input { resize:none;overflow:hidden; }
                .bd-form-input:focus { border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.12); }
                .bdm-divider { border:none;border-top:1px solid var(--border);margin:0; }
                .bdm-dept-wrap { display:grid;grid-template-columns:34px 1fr;gap:.35rem;align-items:center; }
                .bdm-dept-clear { position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;background:transparent;color:var(--text-muted);cursor:pointer;font-size:.7rem;padding:2px 4px;border-radius:3px;line-height:1; }
                .bdm-dept-clear:hover { color:var(--text-primary); }
                .bdm-tips { display:flex;flex-direction:column;gap:.7rem; }
                .bdm-tips-hdr { display:flex;align-items:center;gap:.45rem;font-size:.75rem;font-weight:700;color:var(--text-primary);padding-bottom:.5rem;border-bottom:1px solid var(--border); }
                .bdm-tips-hdr i { color:#f59e0b; }
                .bdm-tip { display:flex;flex-direction:column;gap:.15rem; }
                .bdm-tip-title { font-size:.73rem;font-weight:600;color:var(--text-primary); }
                .bdm-tip-text { font-size:.71rem;color:var(--text-muted);line-height:1.45; }
                .bdm-info { margin-top:.5rem;padding:.55rem .7rem;border-radius:var(--radius-md);background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.18);display:flex;align-items:flex-start;gap:.45rem; }
                .bdm-info i { color:#6366f1;font-size:.75rem;margin-top:.1rem;flex-shrink:0; }
                .bdm-info span { font-size:.71rem;color:var(--text-secondary);line-height:1.45; }
                .bdm-search { display:flex;align-items:center;gap:.4rem;padding:.2rem .6rem;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-surface);margin-bottom:.35rem; }
                .bdm-search i { color:var(--text-muted);font-size:.75rem;flex-shrink:0; }
                .bdm-search input { border:none;background:transparent;outline:none;font-size:.82rem;color:var(--text-primary);font-family:inherit;width:100%;padding:.2rem 0; }
                .bdm-chk-list { max-height:110px;overflow-y:auto; }
            </style>
            <div class="bdm-wrap">
                <!-- ── Left: form ─────────────────────────── -->
                <div class="bdm-form">

                    <!-- §1 Основна інформація -->
                    <div class="bdm-sec">
                        <div class="bdm-sec-hdr">
                            <span class="bdm-ico"><i class="fa-solid fa-file-lines"></i></span>
                            <span class="bdm-sec-title">Основна інформація</span>
                        </div>
                        <div>
                            <label class="bdm-lbl">Назва документа <span class="req">*</span></label>
                            <textarea id="bd-bl-title" class="bd-form-input" rows="1" maxlength="255"
                                placeholder="Назва блоку відповідно до законодавства…"
                                oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px';const c=document.getElementById('bd-title-cnt');if(c)c.textContent=this.value.length+' / 255'">${Fmt.esc(b?.title || '')}</textarea>
                            <div class="bdm-counter" id="bd-title-cnt">${(b?.title||'').length} / 255</div>
                        </div>
                        <div>
                            <label class="bdm-lbl">Відповідальний</label>
                            <div class="bdm-dept-wrap">
                                <div class="bd-icon-trigger" id="bd-icon-trigger" onclick="BranchDocsPage._toggleIconDrop()">
                                    ${triggerInner}
                                    <div class="bd-icon-drop" id="bd-icon-drop" style="display:none" onclick="event.stopPropagation()">
                                        ${dropOptions}
                                    </div>
                                </div>
                                <div style="position:relative">
                                    <input id="bd-bl-dept" class="bd-form-input" placeholder="ПІБ або відділ" value="${Fmt.esc(b?.dept || '')}" style="padding-right:28px">
                                    <button type="button" class="bdm-dept-clear" onclick="document.getElementById('bd-bl-dept').value=''" title="Очистити"><i class="fa-solid fa-xmark"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr class="bdm-divider">

                    <!-- §2 Коментар -->
                    <div class="bdm-sec">
                        <div class="bdm-sec-hdr">
                            <span class="bdm-ico"><i class="fa-solid fa-comment"></i></span>
                            <span class="bdm-sec-title">Коментар</span>
                            <span class="bdm-badge">Необов'язково</span>
                        </div>
                        <div class="bdm-sub">Додайте текст або коментар для зазначених отримувачів</div>
                        <div>
                            <textarea id="bd-bl-tov" class="bd-form-input" rows="1" maxlength="1000"
                                placeholder="Введіть текст — зберігає переноси рядків…"
                                oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px';const c=document.getElementById('bd-tov-cnt');if(c)c.textContent=this.value.length+' / 1000'"
                                style="font-family:inherit;font-size:.88rem;line-height:1.65">${Fmt.esc(b?.tov_text || '')}</textarea>
                            <div class="bdm-counter" id="bd-tov-cnt">${(b?.tov_text||'').length} / 1000</div>
                        </div>
                    </div>

                    <hr class="bdm-divider">

                    <!-- §3 Пов'язані матеріали -->
                    <div class="bdm-sec">
                        <div class="bdm-sec-hdr">
                            <span class="bdm-ico"><i class="fa-solid fa-link"></i></span>
                            <span class="bdm-sec-title">Пов'язані матеріали</span>
                            <span class="bdm-badge sel" id="bd-sel-cnt">${selCount} вибрано</span>
                        </div>
                        <div class="bdm-sub">Позначте сторінки-колекції, до яких належить цей документ</div>
                        <div>
                            <div class="bdm-search">
                                <i class="fa-solid fa-magnifying-glass"></i>
                                <input type="text" placeholder="Пошук сторінок-колекцій" oninput="BranchDocsPage._filterPages(this.value)">
                            </div>
                            <div class="bdm-chk-list" id="bd-chk-list">
                                ${pageCheckboxes}
                            </div>
                        </div>
                    </div>

                </div>

                <!-- ── Right: tips ────────────────────────── -->
                <div class="bdm-tips">
                    <div class="bdm-tips-hdr"><i class="fa-solid fa-lightbulb"></i> Поради</div>
                    <div class="bdm-tip">
                        <div class="bdm-tip-title">Назва документа</div>
                        <div class="bdm-tip-text">Вкажіть повну та точну назву документа для зручного пошуку.</div>
                    </div>
                    <div class="bdm-tip">
                        <div class="bdm-tip-title">Для кого</div>
                        <div class="bdm-tip-text">Додайте пояснення або примітки для отримувачів (за потреби).</div>
                    </div>
                    <div class="bdm-tip">
                        <div class="bdm-tip-title">Пов'язані матеріали</div>
                        <div class="bdm-tip-text">Оберіть сторінки-колекції, до яких відноситься цей документ.</div>
                    </div>
                    <div class="bdm-info">
                        <i class="fa-solid fa-circle-info"></i>
                        <span><strong>Інформація</strong><br>Зміни буде збережено одразу після натискання "Зберегти".</span>
                    </div>
                </div>
            </div>`,
            footer: `
                <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-sm" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;box-shadow:0 3px 10px rgba(99,102,241,.3)" onclick="BranchDocsPage._saveBlock(${JSON.stringify(id || null).replace(/"/g,'&quot;')})">
                    <i class="fa-solid fa-check"></i> Зберегти
                </button>`
        });
        setTimeout(() => {
            ['bd-bl-title','bd-bl-tov'].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
            });
            document.getElementById('bd-bl-title')?.focus();
        }, 50);
    },

    _toggleIconDrop() {
        const drop = document.getElementById('bd-icon-drop');
        if (!drop) return;
        const open = drop.style.display === 'none';
        drop.style.display = open ? 'grid' : 'none';
        if (open) {
            const close = e => {
                if (!document.getElementById('bd-icon-trigger')?.contains(e.target)) {
                    drop.style.display = 'none';
                    document.removeEventListener('click', close);
                }
            };
            setTimeout(() => document.addEventListener('click', close), 0);
        }
    },

    _pickIconDrop(btn) {
        const icon = btn.dataset.icon;
        document.getElementById('bd-bl-icon').value = icon;
        document.querySelectorAll('.bd-icon-drop-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const opt = this._iconOptions.find(o => o.icon === icon);
        const trigger = document.getElementById('bd-icon-trigger');
        if (trigger && opt) {
            const inner = opt.icon !== 'fa-circle'
                ? `<i class="fa-solid ${opt.icon}" style="color:${opt.color}"></i>`
                : `<i class="fa-regular fa-face-smile" style="color:var(--text-muted)"></i>`;
            trigger.innerHTML = inner + trigger.querySelector('#bd-icon-drop').outerHTML;
        }
        document.getElementById('bd-icon-drop').style.display = 'none';
    },

    _filterPages(q) {
        const list = document.getElementById('bd-chk-list');
        if (!list) return;
        const term = q.toLowerCase();
        list.querySelectorAll('.bd-page-chk-row').forEach(row => {
            const text = row.querySelector('span')?.textContent.toLowerCase() || '';
            row.style.display = text.includes(term) ? '' : 'none';
        });
    },

    _updateSelCount() {
        const cnt = document.querySelectorAll('.bd-page-chk:checked').length;
        const el = document.getElementById('bd-sel-cnt');
        if (el) el.textContent = `${cnt} вибрано`;
    },

    async _saveBlock(id) {
        const title    = document.getElementById('bd-bl-title')?.value.trim();
        const dept     = document.getElementById('bd-bl-dept')?.value.trim() || null;
        const icon     = document.getElementById('bd-bl-icon')?.value || null;
        const tov_text = document.getElementById('bd-bl-tov')?.value.trim() || null;
        const page_ids = Array.from(document.querySelectorAll('.bd-page-chk:checked')).map(c => c.value);
        if (!title) { Toast.warning('Введіть назву'); return; }
        try {
            Loader.show();
            if (id) {
                const cur = this._blocks.find(x => x.id === id);
                await API.branchDocBlocks.update(id, { number: cur?.number, title, dept, icon, tov_text, order_index: cur?.number, page_ids });
                if (!this._selectedBlock) this._selectedBlock = id;
            } else {
                const maxNum = this._blocks.reduce((m, x) => Math.max(m, x.number), 0);
                const tabId = this._selectedTab || null;
                await API.branchDocBlocks.create({ number: maxNum + 1, title, dept, icon, tov_text, order_index: maxNum + 1, page_ids, tab_id: tabId });
            }
            Modal.close();
            Toast.success(id ? 'Блок оновлено' : 'Блок додано');
            await this._reload(true);
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    },

    async _moveBlock(id, dir) {
        const visible = this._tabs.length && this._selectedTab
            ? this._blocks.filter(b => b.tab_id === this._selectedTab || b.tab_id == null)
            : this._blocks;
        const idx = visible.findIndex(b => b.id === id);
        const swapIdx = idx + dir;
        if (idx < 0 || swapIdx < 0 || swapIdx >= visible.length) return;
        const a = visible[idx];
        const b = visible[swapIdx];
        const numA = a.number, numB = b.number;
        const tmp = Math.max(...this._blocks.map(x => x.number)) + 9999;
        try {
            await API.branchDocBlocks.update(a.id, { number: tmp });
            await API.branchDocBlocks.update(b.id, { number: numA });
            await API.branchDocBlocks.update(a.id, { number: numB });
            // swap _byBlock keys so docs stay attached
            const docsA = this._byBlock[numA];
            const docsB = this._byBlock[numB];
            if (docsA) this._byBlock[numB] = docsA; else delete this._byBlock[numB];
            if (docsB) this._byBlock[numA] = docsB; else delete this._byBlock[numA];
            a.number = numB;
            b.number = numA;
            this._blocks.sort((x, y) => x.number - y.number);
            this._render(AppState.isAdmin() && !AppState.isPreviewing());
        } catch (e) {
            Toast.error('Помилка переміщення', e.message);
        }
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
        const [blocks, docs, myDovs, pages, pageDovs, headerDocs, tabs] = await Promise.all([
            API.branchDocBlocks.getAll(),
            API.resources.getBranchDocs(null),
            seeAll ? Promise.resolve(null) : API.dovirenosti.getForProfile(AppState.user.id).catch(() => []),
            API.pages.getAll().catch(() => []),
            API.pageDovirenosti.getAll().catch(() => []),
            API.resources.getBranchHeaderDocs().catch(() => []),
            API.bdTabs.getAll().catch(() => [])
        ]);
        this._headerDocs = headerDocs;
        this._tabs = tabs;
        if (this._tabs.length && !this._tabs.find(t => t.id === this._selectedTab)) {
            this._selectedTab = this._tabs[0].id;
        } else if (!this._tabs.length) {
            this._selectedTab = null;
        }
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
        const tabBlocks = this._tabs.length && this._selectedTab
            ? this._blocks.filter(b => b.tab_id === this._selectedTab || b.tab_id == null)
            : this._blocks;
        if (!this._selectedBlock || !tabBlocks.find(b => b.id === this._selectedBlock)) {
            this._selectedBlock = tabBlocks[0]?.id || null;
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
                const docVersion = doc?.doc_version || 1;
                API.documentDownloads.track(resourceId, { docVersion }).catch(() => {});
                this._ackMap[resourceId] = { at: new Date().toISOString(), version: docVersion };
                const dot = document.querySelector(`[data-doc-dot="${resourceId}"]`);
                if (dot) { dot.classList.remove('bd-unread'); dot.classList.add('bd-read'); dot.title = 'Ознайомлено'; }
                // Update sidebar dot
                const block = Object.entries(this._byBlock).find(([, docs]) => docs.find(d => d.id === resourceId));
                if (block) {
                    const [bNum, bDocs] = block;
                    const anyUnread = bDocs.some(d => { const a = this._ackMap[d.id]; return !a || (a.version || 1) < (d.doc_version || 1); });
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
    },

    async _editDocModal(id) {
        const allDocs = Object.values(this._byBlock).flat();
        const doc = allDocs.find(d => d.id === id);
        if (!doc) return;
        const dovs = await API.dovirenosti.getAll().catch(() => []);
        Modal.open({
            title: '<i class="fa-solid fa-pen"></i> Редагувати документ',
            size: 'lg',
            body: `
            <div style="display:flex;flex-direction:column;gap:1rem">
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">Назва документу <span style="color:var(--danger)">*</span></label>
                    <input id="bd-ed-title" type="text" autocomplete="off" value="${Fmt.esc(doc.title)}"
                        style="width:100%;padding:.55rem .8rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box">
                </div>
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">
                        Довіреність (ТОВ)
                        <span style="font-weight:400;color:var(--text-muted)">&nbsp;— залиш порожнім для всіх</span>
                    </label>
                    <select id="bd-ed-dovid" style="width:100%;padding:.55rem .8rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box">
                        <option value="">— для всіх підрозділів —</option>
                        ${dovs.map(d => `<option value="${d.id}" ${doc.dovirenost_id === d.id ? 'selected' : ''}>${Fmt.esc(d.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">Замінити файл <span style="font-weight:400;color:var(--text-muted)">&nbsp;— залиш порожнім щоб не змінювати</span></label>
                    <div class="file-upload-frame">
                        <label for="bd-ed-file" class="file-upload-area" id="bd-ed-area">
                            <div class="file-upload-icon"><i class="fa-solid fa-file-arrow-up"></i></div>
                            <div class="file-upload-label" id="bd-ed-label">Натисніть або перетягніть файл</div>
                            <div class="file-upload-hint">PDF, DOC, DOCX</div>
                            <input type="file" id="bd-ed-file" accept=".pdf,.doc,.docx" style="display:none"
                                onchange="document.getElementById('bd-ed-label').textContent=this.files[0]?.name||'Натисніть або перетягніть файл'">
                        </label>
                    </div>
                </div>
            </div>`,
            footer: `<button class="btn btn-primary btn-sm" onclick="BranchDocsPage._doEditDoc('${id}')"><i class="fa-solid fa-save"></i> Зберегти</button>
                     <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>`
        });
    },

    async _doEditDoc(id) {
        const title = Dom.val('bd-ed-title').trim();
        const dovirenost_id = Dom.val('bd-ed-dovid') || null;
        const file = document.getElementById('bd-ed-file')?.files?.[0];
        if (!title) { Toast.warning('Введіть назву'); return; }
        try {
            Loader.show();
            const fields = { title, dovirenost_id };
            if (file) {
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                const path = `branch-docs/${Date.now()}_${safeName}`;
                const { error: upErr } = await supabase.storage.from('lesson-resources').upload(path, file);
                if (upErr) throw upErr;
                fields.storage_path = path;
                const current = Object.values(this._byBlock).flat().find(d => d.id === id);
                fields.doc_version = (current?.doc_version || 1) + 1;
            }
            await API.resources.update(id, fields);
            Modal.close();
            Toast.success('Збережено', fields.doc_version ? `Версія оновлена до v${fields.doc_version}` : '');
            await this._reload(true);
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    }
};
