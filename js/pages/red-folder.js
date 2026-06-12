// ================================================================
// Червона папка
// ================================================================

const RedFolderPage = {

    _items: [],
    _docs: {},           // itemId -> resource[]
    _pages: [],          // available Collections pages
    _ackMap: {},         // resourceId -> { at, version }
    _selectedItem: null, // currently selected item id
    _dovNameMap: {},
    _headerDocs: [],     // top-level files above the split
    _tabs: [],           // rf_tabs rows
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
        { icon: 'fa-sack-dollar',    label: 'Бухгалтерія',     color: '#16a34a' },
        { icon: 'fa-circle',         label: 'Без іконки',      color: '#94a3b8' },
    ],

    _injectStyles() {
        if (document.getElementById('rf-styles')) return;
        const s = document.createElement('style');
        s.id = 'rf-styles';
        s.textContent = `
            .rf-wrap { width: 100%; }
            .rf-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; flex-wrap: wrap; gap: .75rem; }
            .rf-hero { display: flex; align-items: center; gap: .85rem; }
            .rf-hero-ico { width: 46px; height: 46px; border-radius: 12px; background: linear-gradient(135deg,#ef4444,#b91c1c); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; box-shadow: 0 4px 14px rgba(239,68,68,.4); flex-shrink: 0; }
            .rf-title { font-size: 1.2rem; font-weight: 800; color: var(--text-primary); }
            .rf-subtitle { font-size: .78rem; color: var(--text-muted); margin-top: .15rem; }

            /* ── Split panel ──────────────────────────────────────── */
            .rf-split { display: flex; border: 1px solid rgba(239,68,68,.2); border-radius: var(--radius-xl); overflow: hidden; background: var(--bg-surface); box-shadow: 0 2px 16px rgba(239,68,68,.07); min-height: 280px; }
            .rf-split-sidebar { width: 550px; flex-shrink: 0; border-right: 1px solid rgba(239,68,68,.15); display: flex; flex-direction: column; overflow-y: auto; background: var(--bg-raised); }
            .rf-split-content { flex: 1; min-width: 0; max-width: 450px; overflow-y: auto; max-height: 600px; }

            /* ── Sidebar item buttons ─────────────────────────────── */
            .rf-item-btn { display: flex; align-items: flex-start; gap: .55rem; padding: .7rem 1rem; cursor: pointer; border: none; background: transparent; text-align: left; color: var(--text-primary); border-bottom: 1px solid rgba(239,68,68,.1); font-family: inherit; font-size: .84rem; width: 100%; transition: background .12s; }
            .rf-item-btn:last-of-type { border-bottom: none; }
            .rf-item-btn:hover { background: rgba(239,68,68,.05); }
            .rf-item-btn.active { background: rgba(239,68,68,.1); }
            .rf-item-num { width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0; background: var(--bg-surface); color: var(--text-muted); display: flex; align-items: center; justify-content: center; font-size: .7rem; font-weight: 800; margin-top: .1rem; border: 1px solid var(--border); transition: all .12s; }
            .rf-item-btn.active .rf-item-num { background: #ef4444; color: #fff; border-color: #ef4444; }
            .rf-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .3rem; }
            .rf-item-title-row { display: flex; align-items: center; gap: .4rem; font-weight: 600; line-height: 1.4; font-size: .84rem; }
            .rf-item-btn.active .rf-item-title-row { color: #ef4444; font-weight: 700; }
            .rf-item-responsible { font-size: .73rem; color: var(--text-muted); display: flex; align-items: center; gap: .3rem; }
            .rf-item-actions { display: flex; gap: 3px; opacity: 0; pointer-events: none; transition: opacity .15s; }
            .rf-item-btn:hover .rf-item-actions { opacity: 1; pointer-events: auto; }
            .rf-item-dot-wrap { display: flex; flex-shrink: 0; margin-top: .35rem; }
            .rf-ibtn-dot { width: 8px; height: 8px; border-radius: 50%; }
            .rf-ibtn-dot.unread { background: #ef4444; animation: rf-pulse 1.4s ease-in-out infinite; }
            .rf-ibtn-dot.read { background: #10b981; }
            .rf-ibtn-dot.empty { background: var(--border); }

            /* ── Content area ─────────────────────────────────────── */
            .rf-content-inner { padding: 1.1rem 1.25rem; display: flex; flex-direction: column; gap: .85rem; }
            .rf-content-resp { display: flex; align-items: center; gap: .65rem; padding: .6rem .85rem; background: rgba(239,68,68,.06); border: 1px solid rgba(239,68,68,.15); border-radius: var(--radius-md); }
            .rf-content-resp-icon { width: 32px; height: 32px; border-radius: 8px; background: rgba(239,68,68,.12); display: flex; align-items: center; justify-content: center; font-size: .9rem; flex-shrink: 0; }
            .rf-content-resp-name { font-size: .88rem; font-weight: 600; color: var(--text-primary); flex: 1; }
            .rf-content-docs-header { display: flex; align-items: center; gap: .5rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-muted); padding-bottom: .5rem; border-bottom: 1px solid var(--border); }
            .rf-content-docs-header i { font-size: .8rem; }
            .rf-content-add-btn { margin-left: auto; display: inline-flex; align-items: center; gap: .3rem; padding: .2rem .6rem; border-radius: 5px; border: 1px dashed rgba(239,68,68,.4); background: transparent; color: rgba(239,68,68,.7); cursor: pointer; font-size: .72rem; font-weight: 600; transition: all .15s; font-family: inherit; white-space: nowrap; }
            .rf-content-add-btn:hover { border-color: #ef4444; color: #ef4444; background: rgba(239,68,68,.05); }
            /* ── Header docs ─────────────────────────────────────────── */
            .rf-hdr-zone { border: 1px solid rgba(239,68,68,.2); border-radius: var(--radius-xl); background: var(--bg-surface); padding: .9rem 1.1rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: .6rem; }
            .rf-hdr-title { display: flex; align-items: center; gap: .5rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #ef4444; }
            .rf-hdr-docs { display: flex; flex-wrap: wrap; gap: .5rem; }
            .rf-hdr-doc-card { display: inline-flex; align-items: center; gap: .5rem; padding: .4rem .75rem; border: 1px solid rgba(239,68,68,.2); border-radius: var(--radius-md); background: var(--bg-raised); cursor: pointer; transition: border-color .13s, background .13s; font-size: .84rem; color: var(--text-primary); font-family: inherit; }
            .rf-hdr-doc-card:hover { border-color: #ef4444; background: rgba(239,68,68,.05); color: #ef4444; }
            .rf-hdr-doc-card-ico { width: 26px; height: 26px; border-radius: 6px; background: rgba(239,68,68,.1); color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: .8rem; flex-shrink: 0; }
            .rf-hdr-doc-card-actions { display: flex; gap: 2px; flex-shrink: 0; opacity: 0; pointer-events: none; transition: opacity .15s; margin-left: .25rem; }
            .rf-hdr-doc-card:hover .rf-hdr-doc-card-actions { opacity: 1; pointer-events: auto; }
            .rf-hdr-add-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .35rem .75rem; border-radius: var(--radius-md); border: 1.5px dashed rgba(239,68,68,.35); background: transparent; color: rgba(239,68,68,.7); font-size: .8rem; cursor: pointer; transition: all .15s; font-family: inherit; }
            .rf-hdr-add-btn:hover { border-color: #ef4444; color: #ef4444; background: rgba(239,68,68,.04); }
            .rf-no-selection { display: flex; align-items: center; justify-content: center; height: 100%; padding: 3rem; color: var(--text-muted); font-size: .88rem; font-style: italic; }
            .rf-empty-docs { color: var(--text-muted); font-size: .82rem; font-style: italic; padding: .25rem 0; }

            /* ── Doc cards ────────────────────────────────────────── */
            .rf-doc-card { border: 1px solid var(--border); border-radius: 8px; padding: .6rem .85rem; display: flex; align-items: center; gap: .5rem; cursor: pointer; transition: border-color .13s, background .13s; background: var(--bg-raised); }
            .rf-doc-card:hover { border-color: #ef4444; background: rgba(239,68,68,.05); }
            .rf-doc-card-icon { width: 28px; height: 28px; border-radius: 7px; background: rgba(239,68,68,.1); color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: .85rem; flex-shrink: 0; }
            .rf-doc-card-title { flex: 1; min-width: 0; font-size: .84rem; color: var(--text-primary); font-weight: 500; line-height: 1.4; word-break: break-word; }
            .rf-doc-card:hover .rf-doc-card-title { color: #ef4444; }
            .rf-doc-card-actions { display: flex; gap: 2px; flex-shrink: 0; opacity: 0; pointer-events: none; transition: opacity .15s; }
            .rf-doc-card:hover .rf-doc-card-actions { opacity: 1; pointer-events: auto; }
            .rf-tov-block { border: 1px solid rgba(239,68,68,.2); border-radius: var(--radius-md); background: rgba(239,68,68,.04); padding: .75rem 1rem; margin-bottom: .1rem; }
            .rf-tov-label { font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #ef4444; margin-bottom: .45rem; display: flex; align-items: center; gap: .35rem; }
            .rf-tov-text { font-size: .875rem; color: var(--text-primary); white-space: pre-wrap; line-height: 1.65; word-break: break-word; }
            .rf-collection-card { border: 1px solid var(--border); border-radius: 8px; padding: .6rem .85rem; display: flex; align-items: center; gap: .5rem; cursor: pointer; transition: border-color .13s, background .13s; background: var(--bg-raised); }
            .rf-collection-card:hover { border-color: #ef4444; background: rgba(239,68,68,.05); }
            .rf-collection-icon { width: 28px; height: 28px; border-radius: 7px; background: rgba(99,102,241,.1); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: .85rem; flex-shrink: 0; }
            .rf-collection-title { flex: 1; font-size: .84rem; color: var(--primary); font-weight: 500; }

            /* ── Shared action button ─────────────────────────────── */
            .rf-ta-btn { width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--border); background: transparent; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .6rem; transition: all .15s; font-family: inherit; }
            .rf-ta-btn:hover { border-color: var(--primary); color: var(--primary); }
            .rf-ta-btn.danger:hover { border-color: #ef4444; color: #ef4444; }

            /* ── Ack dots ─────────────────────────────────────────── */
            .rf-ack-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; vertical-align: middle; margin-right: .35rem; }
            .rf-ack-dot.rf-unread { background: #ef4444; box-shadow: 0 0 0 0 rgba(239,68,68,.6); animation: rf-pulse 1.4s ease-in-out infinite; }
            .rf-ack-dot.rf-read { background: #10b981; }
            @keyframes rf-pulse { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,.6); } 70% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }

            /* ── Tab bar ──────────────────────────────────────────── */
            .rf-tab-bar { display: flex; align-items: center; gap: .35rem; margin-bottom: 1.1rem; flex-wrap: wrap; }
            .rf-tab { display: inline-flex; align-items: center; gap: .45rem; padding: .4rem .9rem; border-radius: var(--radius-md); border: 1.5px solid transparent; font-size: .83rem; font-weight: 500; cursor: pointer; font-family: inherit; transition: filter .15s, box-shadow .15s, font-weight .1s; white-space: nowrap; }
            .rf-tab:hover { filter: brightness(1.08); }
            .rf-tab.active { font-weight: 700; box-shadow: 0 2px 10px rgba(0,0,0,.12); }
            .rf-tab-actions { display: inline-flex; gap: 2px; margin-left: .15rem; opacity: 0; pointer-events: none; transition: opacity .12s; }
            .rf-tab:hover .rf-tab-actions, .rf-tab.active .rf-tab-actions { opacity: 1; pointer-events: auto; }
            .rf-tab-act-btn { width: 16px; height: 16px; border-radius: 3px; border: none; background: transparent; color: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: .58rem; padding: 0; opacity: .7; transition: opacity .12s; }
            .rf-tab-act-btn:hover { opacity: 1; }
            .rf-tab-add { border-style: dashed !important; background: transparent !important; color: var(--text-muted) !important; }
            .rf-tab-add:hover { color: var(--text-primary) !important; border-color: var(--border) !important; }
            .rf-tab-bar-right { margin-left: auto; }
            .rf-tab-sep { width: 1px; height: 20px; background: var(--border); flex-shrink: 0; margin: 0 .1rem; }

            /* ── Modal form ───────────────────────────────────────── */
            .rf-form { display: flex; flex-direction: column; gap: .9rem; }
            .rf-form label { font-size: .78rem; font-weight: 600; color: var(--text-muted); margin-bottom: .2rem; display: block; }
            .rf-form input, .rf-form textarea { width: 100%; padding: .55rem .8rem; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-primary); font-size: .88rem; font-family: inherit; outline: none; box-sizing: border-box; }
            .rf-form input:focus, .rf-form textarea:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,.12); }
            .rf-form textarea { resize: vertical; min-height: 72px; }
            .rf-form-input { width: 100%; padding: .55rem .8rem; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-primary); font-size: .88rem; font-family: inherit; outline: none; box-sizing: border-box; transition: border-color .15s, box-shadow .15s; }
            .rf-form-input:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,.12); }
            .rf-page-chk-row { display: flex; align-items: center; gap: .55rem; padding: .35rem .4rem; border-radius: var(--radius-sm); cursor: pointer; font-size: .85rem; color: var(--text-primary); transition: background .1s; }
            .rf-page-chk-row:hover { background: rgba(239,68,68,.06); }
            .rf-page-chk-row input[type=checkbox] { flex-shrink: 0; accent-color: #ef4444; width: 15px; height: 15px; cursor: pointer; }
            .rf-page-chk-row span { line-height: 1.3; }
            .rf-icon-row { display: flex; flex-wrap: wrap; gap: .4rem; }
            .rf-icon-opt { display: inline-flex; align-items: center; gap: .4rem; padding: .3rem .65rem; border-radius: var(--radius-md); border: 1.5px solid var(--border); background: var(--bg-raised); cursor: pointer; font-size: .75rem; font-family: inherit; color: var(--text-secondary); transition: all .15s; }
            .rf-icon-opt:hover { border-color: var(--ic); color: var(--text-primary); }
            .rf-icon-opt-active { border-color: var(--ic) !important; background: color-mix(in srgb,var(--ic) 10%,transparent); color: var(--text-primary) !important; }
            /* inline icon dropdown */
            .rf-icon-trigger { flex-shrink:0; width:38px; height:38px; border-radius:var(--radius-md); border:1px solid var(--border); background:var(--bg-raised); cursor:pointer; display:flex;align-items:center;justify-content:center; font-size:1rem; transition:border-color .15s; position:relative; }
            .rf-icon-trigger:hover { border-color:rgba(239,68,68,.4); }
            .rf-icon-drop { position:absolute; top:calc(100% + 4px); left:0; z-index:200; background:var(--bg-surface); border:1px solid var(--border); border-radius:var(--radius-md); box-shadow:0 6px 24px rgba(0,0,0,.18); padding:.4rem; display:grid; grid-template-columns:repeat(4,1fr); gap:.3rem; min-width:220px; }
            .rf-icon-drop-opt { display:flex;flex-direction:column;align-items:center;gap:.15rem; padding:.35rem .3rem; border-radius:var(--radius-sm); border:1.5px solid transparent; background:transparent; cursor:pointer; font-size:.6rem; font-family:inherit; color:var(--text-secondary); transition:all .12s; }
            .rf-icon-drop-opt:hover { background:var(--bg-raised); border-color:var(--ic); color:var(--text-primary); }
            .rf-icon-drop-opt.active { background:color-mix(in srgb,var(--ic) 12%,transparent); border-color:var(--ic); color:var(--text-primary); }
        `;
        document.head.appendChild(s);
    },

    async renderInTab(area) {
        this._injectStyles();
        area.innerHTML = `
        <div class="rf-wrap">
            <div id="rf-content">
                <div style="text-align:center;padding:3rem 1rem;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> Завантаження...</div>
            </div>
        </div>`;
        await this._load();
    },

    async _load() {
        try {
            const canManage = AppState.isAdmin() && !AppState.isPreviewing();
            const seeAll = AppState.isAdmin() || AppState.isManager() || AppState.isSmm();
            const [items, docs, myDovs, pages, pageDovs, allDov, headerDocs, tabs] = await Promise.all([
                API.redFolderItems.getAll(),
                API.resources.getRedFolderDocs().catch(() => []),
                seeAll ? Promise.resolve(null) : API.dovirenosti.getForProfile(AppState.user.id).catch(() => []),
                API.pages.getAll().catch(() => []),
                API.pageDovirenosti.getAll().catch(() => []),
                API.dovirenosti.getAll().catch(() => []),
                API.resources.getRedFolderHeaderDocs().catch(() => []),
                API.rfTabs.getAll().catch(() => [])
            ]);
            this._headerDocs = headerDocs;
            this._tabs = tabs;
            // Keep selected tab valid
            if (this._tabs.length && !this._tabs.find(t => t.id === this._selectedTab)) {
                this._selectedTab = this._tabs[0].id;
            } else if (!this._tabs.length) {
                this._selectedTab = null;
            }
            this._pages = pages;
            this._items = items;
            this._docs = {};
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
            const visibleDocs = seeAll ? docs : docs.filter(d => {
                if (!d.dovirenost_id) return true;
                return myDovIds && myDovIds.has(d.dovirenost_id);
            });

            visibleDocs.forEach(d => {
                if (!this._docs[d.red_folder_item_id]) this._docs[d.red_folder_item_id] = [];
                this._docs[d.red_folder_item_id].push(d);
            });
            const allDocIds = visibleDocs.map(d => d.id).filter(Boolean);
            this._ackMap = allDocIds.length
                ? await API.documentDownloads.getMyLatest(allDocIds).catch(() => ({}))
                : {};

            // Ensure selected item is still valid within current tab
            const tabItems = this._tabs.length && this._selectedTab
                ? this._items.filter(i => i.tab_id === this._selectedTab || i.tab_id == null)
                : this._items;
            if (!this._selectedItem || !tabItems.find(i => i.id === this._selectedItem)) {
                this._selectedItem = tabItems[0]?.id || null;
            }

            this._render();
        } catch (e) {
            const el = document.getElementById('rf-content');
            if (el) el.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-muted)">${Fmt.esc(e.message)}</div>`;
        }
    },

    _buildTabBar(canManage) {
        if (!this._tabs.length && !canManage) return '';
        const tabsHtml = this._tabs.map((t, idx) => {
            const isActive = this._selectedTab === t.id;
            const c = this._tabColors[idx % this._tabColors.length];
            const baseStyle = `background:${c.bg};border-color:${isActive ? c.border : 'transparent'};color:${c.text};`;
            const actBtns = canManage ? `
                <span class="rf-tab-actions" onclick="event.stopPropagation()">
                    <button class="rf-tab-act-btn" title="Перейменувати" onclick="RedFolderPage._renameTabModal('${t.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="rf-tab-act-btn del" title="Видалити вкладку" onclick="RedFolderPage._deleteTab('${t.id}')"><i class="fa-solid fa-xmark"></i></button>
                </span>` : '';
            return `<button class="rf-tab${isActive ? ' active' : ''}" style="${baseStyle}" onclick="RedFolderPage._selectTab('${t.id}')">
                <i class="fa-solid fa-folder" style="font-size:.75rem"></i>
                ${Fmt.esc(t.title)}
                ${actBtns}
            </button>${idx < this._tabs.length - 1 ? '<span class="rf-tab-sep"></span>' : ''}`;
        }).join('');
        const addBtn = canManage
            ? `<button class="rf-tab rf-tab-add rf-tab-bar-right" onclick="RedFolderPage._addTabModal()"><i class="fa-solid fa-plus" style="font-size:.7rem"></i> Додати вкладку</button>`
            : '';
        return `<div class="rf-tab-bar">${tabsHtml}${addBtn}</div>`;
    },

    _render() {
        const el = document.getElementById('rf-content');
        if (!el) return;
        const canManage = AppState.isAdmin();

        // Filter items by selected tab: show items belonging to the tab, or items with no tab (legacy/all)
        const visibleItems = this._tabs.length && this._selectedTab
            ? this._items.filter(i => i.tab_id === this._selectedTab || i.tab_id == null)
            : this._items;

        const tabBar = this._buildTabBar(canManage);

        if (!visibleItems.length) {
            el.innerHTML = `
            ${tabBar}
            ${this._buildHeaderZone(canManage)}
            <div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);font-size:.88rem">
                <i class="fa-regular fa-folder-open" style="font-size:2rem;color:rgba(239,68,68,.3);display:block;margin-bottom:.5rem"></i>
                ${!this._items.length ? 'Таблиця порожня' : 'У цій вкладці немає рядків'}
                ${canManage ? `<div style="margin-top:1rem"><button class="btn btn-sm" style="background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;border:none" onclick="RedFolderPage._openModal()"><i class="fa-solid fa-plus"></i> Додати рядок</button></div>` : ''}
            </div>`;
            return;
        }

        const sidebarHtml = visibleItems.map((item, idx) => {
            const itemDocs = this._docs[item.id] || [];
            const pageIds = item.page_ids != null ? item.page_ids : (item.page_id ? [item.page_id] : []);
            const hasPages = pageIds.length > 0;
            const ico = item.icon && item.icon !== 'fa-circle' ? this._iconOptions.find(o => o.icon === item.icon) : null;
            const isActive = this._selectedItem === item.id;

            const _isAcked = d => { const a = this._ackMap[d.id]; return a && (a.version || 1) >= (d.doc_version || 1); };
            let dotHtml = '';
            if (!hasPages && itemDocs.length > 0) {
                const unread = itemDocs.filter(d => !_isAcked(d)).length;
                dotHtml = `<div class="rf-item-dot-wrap"><span class="rf-ibtn-dot ${unread > 0 ? 'unread' : 'read'}" title="${unread > 0 ? `Непрочитано: ${unread}` : 'Всі прочитано'}"></span></div>`;
            } else if (!hasPages) {
                dotHtml = `<div class="rf-item-dot-wrap"><span class="rf-ibtn-dot empty"></span></div>`;
            }

            return `
            <div class="rf-item-btn${isActive ? ' active' : ''}" id="rf-ibtn-${item.id}"
                 onclick="RedFolderPage._selectItem('${item.id}')">
                <span class="rf-item-num">${idx + 1}</span>
                <div class="rf-item-body">
                    <div class="rf-item-title-row">
                        ${ico ? `<i class="fa-solid ${Fmt.esc(item.icon)}" style="color:${ico.color};font-size:.8rem;flex-shrink:0"></i>` : ''}
                        <span>${Fmt.esc(item.title)}</span>
                    </div>
                    ${canManage ? `
                    <div class="rf-item-actions" onclick="event.stopPropagation()">
                        <button class="rf-ta-btn" title="Вгору" onclick="RedFolderPage._moveItem('${item.id}',-1)" ${idx === 0 ? 'disabled style="opacity:.3;cursor:default"' : ''}><i class="fa-solid fa-chevron-up"></i></button>
                        <button class="rf-ta-btn" title="Вниз" onclick="RedFolderPage._moveItem('${item.id}',1)" ${idx === visibleItems.length - 1 ? 'disabled style="opacity:.3;cursor:default"' : ''}><i class="fa-solid fa-chevron-down"></i></button>
                        <button class="rf-ta-btn" title="Редагувати" onclick="RedFolderPage._openModal('${item.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="rf-ta-btn danger" title="Видалити" onclick="RedFolderPage._delete('${item.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>` : ''}
                </div>
                ${dotHtml}
            </div>`;
        }).join('');

        el.innerHTML = `
        ${tabBar}
        ${this._buildHeaderZone(canManage)}
        <div class="rf-split">
            <div class="rf-split-sidebar">
                ${sidebarHtml}
                ${canManage ? `<div style="padding:.6rem .75rem;border-top:1px solid rgba(239,68,68,.1)">
                    <button class="btn btn-sm" style="width:100%;background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;border:none;box-shadow:0 2px 8px rgba(239,68,68,.25)" onclick="RedFolderPage._openModal()"><i class="fa-solid fa-plus"></i> Додати рядок</button>
                </div>` : ''}
            </div>
            <div class="rf-split-content" id="rf-split-content">
                ${this._buildItemContent(this._selectedItem, canManage)}
            </div>
        </div>`;
    },

    _buildHeaderZone(canManage) {
        const seeAll = this._seeAll;
        const myDovIds = this._myDovIds;
        const docs = (this._headerDocs || []).filter(d => {
            // Filter by current tab (docs with no tab_id shown in all tabs)
            if (this._tabs.length && this._selectedTab) {
                if (d.tab_id && d.tab_id !== this._selectedTab) return false;
            }
            if (seeAll) return true;
            const dovIds = (d.resource_dovirenosti || []).map(r => r.dovirenost_id);
            if (!dovIds.length) return true;
            return myDovIds && dovIds.some(id => myDovIds.has(id));
        });
        const docsHtml = docs.map(d => `
            <div class="rf-hdr-doc-card" onclick="RedFolderPage._hdrOpenDoc('${d.id}')">
                <div class="rf-hdr-doc-card-ico"><i class="fa-solid fa-file-pdf"></i></div>
                <span>${Fmt.esc(d.title)}</span>
                ${canManage ? `<div class="rf-hdr-doc-card-actions" onclick="event.stopPropagation()">
                    <button class="rf-ta-btn" title="Редагувати" onclick="RedFolderPage._hdrEditModal('${d.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="rf-ta-btn danger" title="Видалити" onclick="RedFolderPage._hdrDeleteDoc('${d.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>` : ''}
            </div>`).join('');
        if (!docs.length && !canManage) return '';
        return `
        <div class="rf-hdr-zone">
            <div class="rf-hdr-title"><i class="fa-solid fa-paperclip"></i> Загальні документи</div>
            <div class="rf-hdr-docs">
                ${docsHtml}
                ${canManage ? `<button class="rf-hdr-add-btn" onclick="RedFolderPage._hdrUploadModal()"><i class="fa-solid fa-plus"></i> Додати файл</button>` : ''}
            </div>
        </div>`;
    },

    _hdrDovCheckboxes(allDov, selectedIds = []) {
        const sel = new Set(selectedIds);
        if (!allDov.length) return `<div style="font-size:.82rem;color:var(--text-muted)">Немає довіреностей</div>`;
        return allDov.map(d => `
            <label class="rf-page-chk-row">
                <input type="checkbox" class="rf-hdr-dov-chk" value="${d.id}" ${sel.has(d.id) ? 'checked' : ''}>
                <span>${Fmt.esc(d.name)}</span>
            </label>`).join('');
    },

    async _hdrUploadModal() {
        Modal.open({
            title: '<i class="fa-solid fa-paperclip" style="color:#ef4444;margin-right:.4rem"></i> Додати загальний файл',
            size: 'lg',
            body: `<div style="display:flex;flex-direction:column;gap:1rem">
                <div>
                    <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">Назва <span style="color:var(--danger)">*</span></div>
                    <input id="rf-hdr-title" class="rf-form-input" placeholder="Наприклад: Інструкція з охорони праці">
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
                        <label for="rf-hdr-file" class="file-upload-area">
                            <div class="file-upload-icon"><i class="fa-solid fa-file-arrow-up"></i></div>
                            <div class="file-upload-label" id="rf-hdr-label">Натисніть або перетягніть файл</div>
                            <div class="file-upload-hint">PDF, DOC, DOCX</div>
                            <input type="file" id="rf-hdr-file" accept=".pdf,.doc,.docx" style="display:none"
                                onchange="(function(i){const t=document.getElementById('rf-hdr-title');const l=document.getElementById('rf-hdr-label');const f=i.files[0];if(f){if(!t.value)t.value=f.name.replace(/\\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();l.textContent=f.name;}})(this)">
                        </label>
                    </div>
                </div>
            </div>`,
            footer: `<button class="btn btn-sm" style="background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;border:none;box-shadow:0 3px 10px rgba(239,68,68,.3)" onclick="RedFolderPage._hdrDoUpload()"><i class="fa-solid fa-upload"></i> Завантажити</button>
                     <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>`
        });
        setTimeout(() => document.getElementById('rf-hdr-title')?.focus(), 50);
    },

    async _hdrDoUpload() {
        const title = Dom.val('rf-hdr-title').trim();
        const file = document.getElementById('rf-hdr-file')?.files?.[0];
        const dovIds = Array.from(document.querySelectorAll('.rf-hdr-dov-chk:checked')).map(c => c.value);
        if (!title) { Toast.warning('Введіть назву'); return; }
        if (!file)  { Toast.warning('Оберіть файл'); return; }
        try {
            Loader.show();
            const ext = file.name.slice(file.name.lastIndexOf('.')); const safeName = file.name.slice(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 40).replace(/_+$/, '') + ext;
            const path = `red-folder/header/${Date.now()}_${safeName}`;
            const { error: upErr } = await supabase.storage.from('lesson-resources').upload(path, file);
            if (upErr) throw upErr;
            const res = await API.resources.create({ title, type: 'document', storage_path: path, display_block: 'rf-top', tab_id: this._selectedTab || null });
            if (dovIds.length) await API.resources.setDovirenosti(res.id, dovIds);
            Modal.close();
            Toast.success('Файл додано');
            await this._load();
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
            title: '<i class="fa-solid fa-pen" style="color:#ef4444;margin-right:.4rem"></i> Редагувати файл',
            size: 'lg',
            body: `<div style="display:flex;flex-direction:column;gap:1rem">
                <div>
                    <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">Назва <span style="color:var(--danger)">*</span></div>
                    <input id="rf-hdr-ed-title" class="rf-form-input" value="${Fmt.esc(doc.title)}">
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
                        <label for="rf-hdr-ed-file" class="file-upload-area">
                            <div class="file-upload-icon"><i class="fa-solid fa-file-arrow-up"></i></div>
                            <div class="file-upload-label" id="rf-hdr-ed-label">Натисніть або перетягніть файл</div>
                            <div class="file-upload-hint">PDF, DOC, DOCX</div>
                            <input type="file" id="rf-hdr-ed-file" accept=".pdf,.doc,.docx" style="display:none"
                                onchange="document.getElementById('rf-hdr-ed-label').textContent=this.files[0]?.name||'Натисніть або перетягніть файл'">
                        </label>
                    </div>
                </div>
            </div>`,
            footer: `<button class="btn btn-sm" style="background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;border:none;box-shadow:0 3px 10px rgba(239,68,68,.3)" onclick="RedFolderPage._hdrDoEdit('${id}')"><i class="fa-solid fa-check"></i> Зберегти</button>
                     <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>`
        });
        setTimeout(() => document.getElementById('rf-hdr-ed-title')?.focus(), 50);
    },

    async _hdrDoEdit(id) {
        const title = Dom.val('rf-hdr-ed-title').trim();
        const file = document.getElementById('rf-hdr-ed-file')?.files?.[0];
        const dovIds = Array.from(document.querySelectorAll('.rf-hdr-dov-chk:checked')).map(c => c.value);
        if (!title) { Toast.warning('Введіть назву'); return; }
        try {
            Loader.show();
            const fields = { title };
            if (file) {
                const ext = file.name.slice(file.name.lastIndexOf('.')); const safeName = file.name.slice(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 40).replace(/_+$/, '') + ext;
                const path = `red-folder/header/${Date.now()}_${safeName}`;
                const { error: upErr } = await supabase.storage.from('lesson-resources').upload(path, file);
                if (upErr) throw upErr;
                fields.storage_path = path;
            }
            await API.resources.update(id, fields);
            await API.resources.setDovirenosti(id, dovIds);
            Modal.close();
            Toast.success('Збережено');
            await this._load();
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
            await this._load();
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

    _buildItemContent(itemId, canManage) {
        if (!itemId) return `<div class="rf-no-selection"><i class="fa-solid fa-arrow-left" style="margin-right:.4rem;opacity:.5"></i>Оберіть рядок зліва</div>`;

        const item = this._items.find(i => i.id === itemId);
        if (!item) return '';

        const ico = item.icon && item.icon !== 'fa-circle' ? this._iconOptions.find(o => o.icon === item.icon) : null;
        const pageIds = item.page_ids != null ? item.page_ids : (item.page_id ? [item.page_id] : []);
        const linkedPages = pageIds.map(pid => this._pages.find(p => p.id === pid)).filter(p => {
            if (!p) return false;
            if (this._seeAll) return true;
            if (!p.is_published) return false;
            const dovReqs = this._pageDovMap?.[p.id] || [];
            if (!dovReqs.length) return true;
            return this._myDovIds && dovReqs.some(id => this._myDovIds.has(id));
        });
        const itemDocs = this._docs[item.id] || [];

        const respHtml = item.responsible ? `
        <div class="rf-content-resp">
            <div class="rf-content-resp-icon">
                ${ico ? `<i class="fa-solid ${Fmt.esc(item.icon)}" style="color:${ico.color}"></i>` : '<i class="fa-solid fa-user" style="color:#ef4444"></i>'}
            </div>
            <span class="rf-content-resp-name">${Fmt.esc(item.responsible)}</span>
        </div>` : '';

        let docsHtml = '';
        if (linkedPages.length) {
            docsHtml = linkedPages.map(lp => {
                const dovIds = this._pageDovMap?.[lp.id] || [];
                const dovNames = dovIds.map(id => this._dovNameMap?.[id]).filter(Boolean);
                const label = dovNames.length ? dovNames.join(', ') : lp.title;
                return `
                <div class="rf-collection-card" onclick="Router.go('collections/${lp.id}')">
                    <div class="rf-collection-icon"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
                    <span class="rf-collection-title">${Fmt.esc(label)}</span>
                </div>`;
            }).join('');
        } else if (itemDocs.length) {
            docsHtml = itemDocs.map(d => {
                const acked = (() => { const a = this._ackMap[d.id]; return a && (a.version || 1) >= (d.doc_version || 1); })();
                const docLabel = (d.dovirenost_id && this._dovNameMap?.[d.dovirenost_id]) || d.title;
                return `
                <div class="rf-doc-card" onclick="RedFolderPage._openDoc('${Fmt.esc(d.storage_path||'')}','${d.id}')">
                    <span class="rf-ack-dot ${acked ? 'rf-read' : 'rf-unread'}" data-doc-dot="${d.id}" title="${acked ? 'Ознайомлено' : 'Не ознайомлено'}"></span>
                    <div class="rf-doc-card-icon"><i class="fa-solid fa-file-pdf"></i></div>
                    <span class="rf-doc-card-title">${Fmt.esc(docLabel)}</span>
                    ${canManage ? `
                    <div class="rf-doc-card-actions" onclick="event.stopPropagation()">
                        <button class="rf-ta-btn" title="Редагувати" onclick="RedFolderPage._editDocModal('${d.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="rf-ta-btn danger" title="Видалити" onclick="RedFolderPage._deleteDoc('${d.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>` : ''}
                </div>`;
            }).join('');
        } else {
            docsHtml = `<div class="rf-empty-docs">— документів немає —</div>`;
        }

        const tovHtml = item.tov_text ? `
        <div class="rf-tov-block">
            <div class="rf-tov-label"><i class="fa-solid fa-comment" style="font-size:.75rem"></i> Коментар</div>
            <div class="rf-tov-text">${Fmt.esc(item.tov_text)}</div>
        </div>` : '';

        return `
        <div class="rf-content-inner">
            ${respHtml}
            ${tovHtml}
            <div>
                <div class="rf-content-docs-header">
                    <i class="fa-solid fa-file-lines" style="color:#ef4444"></i>
                    Документи
                    ${canManage && !linkedPages.length ? `<button class="rf-content-add-btn" onclick="RedFolderPage._uploadModal('${item.id}',${JSON.stringify(item.title).replace(/"/g,'&quot;')})"><i class="fa-solid fa-plus"></i> Завантажити</button>` : ''}
                </div>
                <div style="display:flex;flex-direction:column;gap:.4rem;margin-top:.55rem">${docsHtml}</div>
            </div>
        </div>`;
    },

    _selectItem(itemId) {
        this._selectedItem = itemId;
        document.querySelectorAll('.rf-item-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`rf-ibtn-${itemId}`)?.classList.add('active');
        const content = document.getElementById('rf-split-content');
        if (content) content.innerHTML = this._buildItemContent(itemId, AppState.isAdmin());
    },

    // ── Tab management ────────────────────────────────────────────────

    _selectTab(id) {
        this._selectedTab = id;
        // Reset selected item to first in this tab
        const visibleItems = this._items.filter(i => i.tab_id === id || i.tab_id == null);
        this._selectedItem = visibleItems[0]?.id || null;
        this._render();
    },

    _addTabModal() {
        Modal.open({
            title: '<i class="fa-solid fa-folder-plus" style="color:#ef4444;margin-right:.4rem"></i> Нова вкладка',
            size: 'sm',
            body: `<div>
                <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">Назва вкладки <span style="color:var(--danger)">*</span></div>
                <input id="rf-tab-name-inp" class="rf-form-input" placeholder="Наприклад: Безпека праці" autofocus>
            </div>`,
            footer: `<button class="btn btn-sm" style="background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;border:none" onclick="RedFolderPage._doAddTab()"><i class="fa-solid fa-check"></i> Створити</button>
                     <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>`
        });
        setTimeout(() => document.getElementById('rf-tab-name-inp')?.focus(), 50);
    },

    async _doAddTab() {
        const title = Dom.val('rf-tab-name-inp').trim();
        if (!title) { Toast.warning('Введіть назву'); return; }
        try {
            Loader.show();
            const tab = await API.rfTabs.create(title);
            this._selectedTab = tab.id;
            Modal.close();
            await this._load();
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
            title: '<i class="fa-solid fa-pen" style="color:#ef4444;margin-right:.4rem"></i> Перейменувати вкладку',
            size: 'sm',
            body: `<div>
                <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:.4rem">Назва вкладки <span style="color:var(--danger)">*</span></div>
                <input id="rf-tab-rename-inp" class="rf-form-input" value="${Fmt.esc(tab.title)}">
            </div>`,
            footer: `<button class="btn btn-sm" style="background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;border:none" onclick="RedFolderPage._doRenameTab('${id}')"><i class="fa-solid fa-check"></i> Зберегти</button>
                     <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>`
        });
        setTimeout(() => { const inp = document.getElementById('rf-tab-rename-inp'); if (inp) { inp.focus(); inp.select(); } }, 50);
    },

    async _doRenameTab(id) {
        const title = Dom.val('rf-tab-rename-inp').trim();
        if (!title) { Toast.warning('Введіть назву'); return; }
        try {
            Loader.show();
            await API.rfTabs.update(id, title);
            Modal.close();
            await this._load();
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
            await API.rfTabs.remove(id);
            if (this._selectedTab === id) this._selectedTab = null;
            await this._load();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    // ── Row modal ─────────────────────────────────────────────────────

    _openModal(id) {
        if (!AppState.isAdmin()) return;
        const item = id ? this._items.find(i => i.id === id) : null;
        const curIcon = item?.icon || '';
        const curIconOpt = this._iconOptions.find(o => o.icon === curIcon);
        const triggerInner = curIconOpt && curIconOpt.icon !== 'fa-circle'
            ? `<i class="fa-solid ${curIconOpt.icon}" style="color:${curIconOpt.color}"></i>`
            : `<i class="fa-regular fa-face-smile" style="color:var(--text-muted)"></i>`;
        const dropOptions = this._iconOptions.map(o => `
            <button type="button" class="rf-icon-drop-opt${curIcon === o.icon ? ' active' : ''}"
                    data-icon="${o.icon}" title="${Fmt.esc(o.label)}"
                    onclick="RedFolderPage._pickIconDrop(this)"
                    style="--ic:${o.color}">
                <i class="fa-solid ${o.icon}" style="color:${o.color};font-size:.85rem"></i>
                <span>${Fmt.esc(o.label)}</span>
            </button>`).join('');
        const curPageIds = new Set(item?.page_ids != null ? item.page_ids : (item?.page_id ? [item.page_id] : []));
        const allPageCheckboxes = this._pages.length
            ? this._pages.map(p => `
                <label class="rf-page-chk-row">
                    <input type="checkbox" class="rf-page-chk" value="${p.id}" ${curPageIds.has(p.id) ? 'checked' : ''} onchange="RedFolderPage._updateSelCount()">
                    <span>${Fmt.esc(p.title)}</span>
                </label>`).join('')
            : `<div style="font-size:.82rem;color:var(--text-muted);padding:.4rem 0">Немає доступних колекцій</div>`;
        const selCount = curPageIds.size;
        Modal.open({
            title: item ? 'Редагувати рядок' : 'Додати рядок',
            size: 'lg',
            body: `
            <input type="hidden" id="rf-inp-icon" value="${Fmt.esc(curIcon)}">
            <style>
                .rfm-wrap { display:grid;grid-template-columns:1fr 250px;gap:1rem;align-items:start; }
                .rfm-form { display:flex;flex-direction:column;gap:.9rem; }
                .rfm-sec { display:flex;flex-direction:column;gap:.6rem; }
                .rfm-sec-hdr { display:flex;align-items:center;gap:.6rem;margin-bottom:.1rem; }
                .rfm-ico { width:22px;height:22px;border-radius:6px;background:rgba(239,68,68,.12);color:#ef4444;font-size:.72rem;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
                .rfm-sec-title { font-size:.82rem;font-weight:700;color:var(--text-primary); }
                .rfm-badge { margin-left:auto;font-size:.68rem;font-weight:600;padding:.15rem .5rem;border-radius:999px;background:var(--bg-raised);border:1px solid var(--border);color:var(--text-muted); }
                .rfm-badge.sel { background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.3);color:#ef4444; }
                .rfm-sub { font-size:.75rem;color:var(--text-muted);line-height:1.4; }
                .rfm-lbl { font-size:.72rem;font-weight:600;color:var(--text-muted);letter-spacing:.04em;margin-bottom:.25rem;display:block; }
                .rfm-lbl .req { color:#ef4444; }
                .rfm-counter { font-size:.68rem;color:var(--text-muted);text-align:right;margin-top:.15rem; }
                .rf-form-input { width:100%;padding:.55rem .8rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .15s,box-shadow .15s; }
                textarea.rf-form-input { resize:none;overflow:hidden; }
                .rf-form-input:focus { border-color:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.12); }
                .rfm-divider { border:none;border-top:1px solid var(--border);margin:0; }
                .rfm-dept-wrap { display:grid;grid-template-columns:34px 1fr;gap:.35rem;align-items:center; }
                .rfm-dept-clear { position:absolute;right:8px;top:50%;transform:translateY(-50%);border:none;background:transparent;color:var(--text-muted);cursor:pointer;font-size:.7rem;padding:2px 4px;border-radius:3px;line-height:1; }
                .rfm-dept-clear:hover { color:var(--text-primary); }
                .rfm-tips { display:flex;flex-direction:column;gap:.7rem; }
                .rfm-tips-hdr { display:flex;align-items:center;gap:.45rem;font-size:.75rem;font-weight:700;color:var(--text-primary);padding-bottom:.5rem;border-bottom:1px solid var(--border); }
                .rfm-tips-hdr i { color:#f59e0b; }
                .rfm-tip { display:flex;flex-direction:column;gap:.15rem; }
                .rfm-tip-title { font-size:.73rem;font-weight:600;color:var(--text-primary); }
                .rfm-tip-text { font-size:.71rem;color:var(--text-muted);line-height:1.45; }
                .rfm-info { margin-top:.5rem;padding:.55rem .7rem;border-radius:var(--radius-md);background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.18);display:flex;align-items:flex-start;gap:.45rem; }
                .rfm-info i { color:#ef4444;font-size:.75rem;margin-top:.1rem;flex-shrink:0; }
                .rfm-info span { font-size:.71rem;color:var(--text-secondary);line-height:1.45; }
                .rfm-search { display:flex;align-items:center;gap:.4rem;padding:.2rem .6rem;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-surface);margin-bottom:.35rem; }
                .rfm-search i { color:var(--text-muted);font-size:.75rem;flex-shrink:0; }
                .rfm-search input { border:none;background:transparent;outline:none;font-size:.82rem;color:var(--text-primary);font-family:inherit;width:100%;padding:.2rem 0; }
                .rfm-chk-list { max-height:110px;overflow-y:auto; }
            </style>
            <div class="rfm-wrap">
                <!-- ── Left: form ─────────────────────────── -->
                <div class="rfm-form">

                    <!-- §1 Основна інформація -->
                    <div class="rfm-sec">
                        <div class="rfm-sec-hdr">
                            <span class="rfm-ico"><i class="fa-solid fa-file-lines"></i></span>
                            <span class="rfm-sec-title">Основна інформація</span>
                        </div>
                        <div>
                            <label class="rfm-lbl">Назва документу <span class="req">*</span></label>
                            <textarea id="rf-inp-title" class="rf-form-input" rows="1" maxlength="255"
                                placeholder="Введіть назву документу…"
                                oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px';const c=document.getElementById('rf-title-cnt');if(c)c.textContent=this.value.length+' / 255'">${item ? Fmt.esc(item.title) : ''}</textarea>
                            <div class="rfm-counter" id="rf-title-cnt">${(item?.title||'').length} / 255</div>
                        </div>
                        <div>
                            <label class="rfm-lbl">Відповідальний</label>
                            <div class="rfm-dept-wrap">
                                <div class="rf-icon-trigger" id="rf-icon-trigger" onclick="RedFolderPage._toggleIconDrop()">
                                    ${triggerInner}
                                    <div class="rf-icon-drop" id="rf-icon-drop" style="display:none" onclick="event.stopPropagation()">
                                        ${dropOptions}
                                    </div>
                                </div>
                                <div style="position:relative">
                                    <input id="rf-inp-responsible" class="rf-form-input" placeholder="ПІБ або відділ" value="${item ? Fmt.esc(item.responsible || '') : ''}" style="padding-right:28px">
                                    <button type="button" class="rfm-dept-clear" onclick="document.getElementById('rf-inp-responsible').value=''" title="Очистити"><i class="fa-solid fa-xmark"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr class="rfm-divider">

                    <!-- §2 Для ТОВ -->
                    <div class="rfm-sec">
                        <div class="rfm-sec-hdr">
                            <span class="rfm-ico"><i class="fa-solid fa-comment"></i></span>
                            <span class="rfm-sec-title">Коментар</span>
                            <span class="rfm-badge">Необов'язково</span>
                        </div>
                        <div class="rfm-sub">Додайте текст або коментар для зазначених отримувачів</div>
                        <div>
                            <textarea id="rf-inp-tov" class="rf-form-input" rows="1" maxlength="1000"
                                placeholder="Введіть текст — зберігає переноси рядків…"
                                oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px';const c=document.getElementById('rf-tov-cnt');if(c)c.textContent=this.value.length+' / 1000'"
                                style="font-family:inherit;font-size:.88rem;line-height:1.65">${item ? Fmt.esc(item.tov_text || '') : ''}</textarea>
                            <div class="rfm-counter" id="rf-tov-cnt">${(item?.tov_text||'').length} / 1000</div>
                        </div>
                    </div>

                    <hr class="rfm-divider">

                    <!-- §3 Пов'язані матеріали -->
                    <div class="rfm-sec">
                        <div class="rfm-sec-hdr">
                            <span class="rfm-ico"><i class="fa-solid fa-link"></i></span>
                            <span class="rfm-sec-title">Пов'язані матеріали</span>
                            <span class="rfm-badge sel" id="rf-sel-cnt">${selCount} вибрано</span>
                        </div>
                        <div class="rfm-sub">Позначте сторінки-колекції, до яких належить цей документ</div>
                        <div>
                            <div class="rfm-search">
                                <i class="fa-solid fa-magnifying-glass"></i>
                                <input type="text" placeholder="Пошук сторінок-колекцій" oninput="RedFolderPage._filterPages(this.value)">
                            </div>
                            <div class="rfm-chk-list" id="rf-chk-list">
                                ${allPageCheckboxes}
                            </div>
                        </div>
                    </div>

                </div>

                <!-- ── Right: tips ────────────────────────── -->
                <div class="rfm-tips">
                    <div class="rfm-tips-hdr"><i class="fa-solid fa-lightbulb"></i> Поради</div>
                    <div class="rfm-tip">
                        <div class="rfm-tip-title">Назва документу</div>
                        <div class="rfm-tip-text">Вкажіть повну та точну назву документа для зручного пошуку.</div>
                    </div>
                    <div class="rfm-tip">
                        <div class="rfm-tip-title">Коментар</div>
                        <div class="rfm-tip-text">Додайте пояснення або примітки для отримувачів (за потреби).</div>
                    </div>
                    <div class="rfm-tip">
                        <div class="rfm-tip-title">Пов'язані матеріали</div>
                        <div class="rfm-tip-text">Оберіть сторінки-колекції, до яких відноситься цей документ.</div>
                    </div>
                    <div class="rfm-info">
                        <i class="fa-solid fa-circle-info"></i>
                        <span><strong>Інформація</strong><br>Зміни буде збережено одразу після натискання "Зберегти".</span>
                    </div>
                </div>
            </div>`,
            footer: `
                <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-sm" style="background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;border:none;box-shadow:0 3px 10px rgba(239,68,68,.3)" onclick="RedFolderPage._save(${JSON.stringify(id || null).replace(/"/g,'&quot;')})">
                    <i class="fa-solid fa-check"></i> Зберегти
                </button>`
        });
        setTimeout(() => {
            ['rf-inp-title','rf-inp-tov'].forEach(fid => {
                const el = document.getElementById(fid);
                if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
            });
            document.getElementById('rf-inp-title')?.focus();
        }, 50);
    },

    _toggleIconDrop() {
        const drop = document.getElementById('rf-icon-drop');
        if (!drop) return;
        const open = drop.style.display === 'none';
        drop.style.display = open ? 'grid' : 'none';
        if (open) {
            const close = e => {
                if (!document.getElementById('rf-icon-trigger')?.contains(e.target)) {
                    drop.style.display = 'none';
                    document.removeEventListener('click', close);
                }
            };
            setTimeout(() => document.addEventListener('click', close), 0);
        }
    },

    _pickIconDrop(btn) {
        const icon = btn.dataset.icon;
        document.getElementById('rf-inp-icon').value = icon;
        document.querySelectorAll('.rf-icon-drop-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const opt = this._iconOptions.find(o => o.icon === icon);
        const trigger = document.getElementById('rf-icon-trigger');
        if (trigger && opt) {
            const inner = opt.icon !== 'fa-circle'
                ? `<i class="fa-solid ${opt.icon}" style="color:${opt.color}"></i>`
                : `<i class="fa-regular fa-face-smile" style="color:var(--text-muted)"></i>`;
            trigger.innerHTML = inner + trigger.querySelector('#rf-icon-drop').outerHTML;
        }
        document.getElementById('rf-icon-drop').style.display = 'none';
    },

    _filterPages(q) {
        const list = document.getElementById('rf-chk-list');
        if (!list) return;
        const lq = q.toLowerCase();
        list.querySelectorAll('.rf-page-chk-row').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(lq) ? '' : 'none';
        });
    },

    _updateSelCount() {
        const cnt = document.querySelectorAll('.rf-page-chk:checked').length;
        const el = document.getElementById('rf-sel-cnt');
        if (el) el.textContent = cnt + ' вибрано';
    },

    async _save(id) {
        const title = Dom.val('rf-inp-title').trim();
        const responsible = Dom.val('rf-inp-responsible').trim();
        const icon = document.getElementById('rf-inp-icon')?.value || null;
        const page_ids = Array.from(document.querySelectorAll('.rf-page-chk:checked')).map(c => c.value);
        const tov_text = document.getElementById('rf-inp-tov')?.value.trim() || null;
        if (!title) { Toast.warning('Заповніть назву документу'); return; }
        const fields = { title, responsible, icon: icon || null, page_ids, tov_text };
        try {
            Loader.show();
            if (id) {
                await API.redFolderItems.update(id, fields);
                if (!this._selectedItem) this._selectedItem = id;
            } else {
                const maxNum = this._items.length ? Math.max(...this._items.map(i => i.number)) : 0;
                const tabId = this._selectedTab || null;
                const newItem = await API.redFolderItems.create({ ...fields, number: maxNum + 1, tab_id: tabId });
                this._selectedItem = newItem?.id || null;
            }
            Modal.close();
            await this._load();
            Toast.success(id ? 'Рядок оновлено' : 'Рядок додано');
        } catch (e) {
            Toast.error('Помилка збереження', e.message);
        } finally {
            Loader.hide();
        }
    },

    async _moveItem(id, dir) {
        const visibleItems = this._tabs.length && this._selectedTab
            ? this._items.filter(i => i.tab_id === this._selectedTab || i.tab_id == null)
            : this._items;
        const idx = visibleItems.findIndex(i => i.id === id);
        const swapIdx = idx + dir;
        if (idx < 0 || swapIdx < 0 || swapIdx >= visibleItems.length) return;
        const a = visibleItems[idx];
        const b = visibleItems[swapIdx];
        const numA = a.number, numB = b.number;
        const tmp = Math.max(...this._items.map(x => x.number)) + 9999;
        try {
            await API.redFolderItems.update(a.id, { number: tmp });
            await API.redFolderItems.update(b.id, { number: numA });
            await API.redFolderItems.update(a.id, { number: numB });
            a.number = numB;
            b.number = numA;
            this._items.sort((x, y) => x.number - y.number);
            this._render();
        } catch (e) {
            Toast.error('Помилка переміщення', e.message);
        }
    },

    async _delete(id) {
        const confirmed = await Modal.confirm({ message: 'Видалити цей рядок?', danger: true, confirmText: 'Видалити' });
        if (!confirmed) return;
        try {
            Loader.show();
            if (this._selectedItem === id) this._selectedItem = null;
            await API.redFolderItems.remove(id);
            await this._load();
            Toast.success('Рядок видалено');
        } catch (e) {
            Toast.error('Помилка видалення', e.message);
        } finally {
            Loader.hide();
        }
    },

    // ── Documents ─────────────────────────────────────────────────────

    async _uploadModal(itemId, itemTitle) {
        const dovs = await API.dovirenosti.getAll().catch(() => []);
        Modal.open({
            title: 'Завантажити документ',
            size: 'lg',
            body: `
            <div style="background:var(--bg-raised);border-left:3px solid #ef4444;border-radius:var(--radius-md);padding:.65rem .9rem;margin-bottom:1.25rem;font-size:.82rem;color:var(--text-secondary);line-height:1.4">
                ${Fmt.esc(itemTitle)}
            </div>
            <div style="display:flex;flex-direction:column;gap:1rem">
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">Назва документу <span style="color:var(--danger)">*</span></label>
                    <input id="rf-up-title" type="text" autocomplete="off" placeholder="Наприклад: Витяг, наказ..." style="width:100%;padding:.55rem .8rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box">
                </div>
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">
                        Довіреність (ТОВ)
                        <span style="font-weight:400;color:var(--text-muted)">&nbsp;— залиш порожнім для всіх</span>
                    </label>
                    <select id="rf-up-dovid" style="width:100%;padding:.55rem .8rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box">
                        <option value="">— для всіх підрозділів —</option>
                        ${dovs.map(d => `<option value="${d.id}">${Fmt.esc(d.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">Файл <span style="color:var(--danger)">*</span></label>
                    <div class="file-upload-frame">
                        <label for="rf-up-file" class="file-upload-area" id="rf-up-area">
                            <div class="file-upload-icon"><i class="fa-solid fa-file-arrow-up"></i></div>
                            <div class="file-upload-label" id="rf-up-label">Натисніть або перетягніть файл</div>
                            <div class="file-upload-hint">PDF, DOC, DOCX</div>
                            <input type="file" id="rf-up-file" accept=".pdf,.doc,.docx" style="display:none"
                                   onchange="(function(i){const t=document.getElementById('rf-up-title');const l=document.getElementById('rf-up-label');const f=i.files[0];if(f){if(!t.value)t.value=f.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();l.textContent=f.name;}else{l.textContent='Натисніть або перетягніть файл';}})(this)">
                        </label>
                    </div>
                </div>
            </div>`,
            footer: `<button class="btn btn-sm" style="background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;border:none" onclick="RedFolderPage._doUpload('${itemId}')"><i class="fa-solid fa-upload"></i> Завантажити</button>
                     <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>`
        });
    },

    async _doUpload(itemId) {
        const title = Dom.val('rf-up-title').trim();
        const dovirenost_id = Dom.val('rf-up-dovid') || null;
        const file = document.getElementById('rf-up-file')?.files?.[0];
        if (!title) { Toast.warning('Введіть назву'); return; }
        if (!file)  { Toast.warning('Оберіть файл'); return; }
        try {
            Loader.show();
            const ext = file.name.slice(file.name.lastIndexOf('.')); const safeName = file.name.slice(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 40).replace(/_+$/, '') + ext;
            const path = `red-folder/${Date.now()}_${safeName}`;
            const { error: upErr } = await supabase.storage.from('lesson-resources').upload(path, file);
            if (upErr) throw upErr;
            await API.resources.create({ title, type: 'document', storage_path: path, red_folder_item_id: itemId, dovirenost_id });
            Modal.close();
            Toast.success('Завантажено');
            await this._load();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    async _openDoc(storagePath, resourceId) {
        try {
            Loader.show();
            const url = await API.resources.getSignedUrl(storagePath);
            const doc = Object.values(this._docs).flat().find(d => d.id === resourceId);
            const title = doc?.title || storagePath.split('/').pop();
            const viewerUrl = `pdf-viewer.html?file=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&download=1`;
            window.open(viewerUrl, '_blank', 'noopener,noreferrer');
            if (resourceId) {
                const docVersion = doc?.doc_version || 1;
                API.documentDownloads.track(resourceId, { docVersion }).catch(() => {});
                this._ackMap[resourceId] = { at: new Date().toISOString(), version: docVersion };
                const dot = document.querySelector(`[data-doc-dot="${resourceId}"]`);
                if (dot) { dot.classList.remove('rf-unread'); dot.classList.add('rf-read'); dot.title = 'Ознайомлено'; }
                // Update sidebar dot
                const item = Object.entries(this._docs).find(([, docs]) => docs.find(d => d.id === resourceId));
                if (item) {
                    const [iid, idocs] = item;
                    const anyUnread = idocs.some(d => { const a = this._ackMap[d.id]; return !a || (a.version || 1) < (d.doc_version || 1); });
                    const sidebarDot = document.querySelector(`#rf-ibtn-${iid} .rf-ibtn-dot`);
                    if (sidebarDot) { sidebarDot.className = `rf-ibtn-dot ${anyUnread ? 'unread' : 'read'}`; }
                }
            }
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    async _deleteDoc(id) {
        if (!await Modal.confirm({ message: 'Видалити документ?', danger: true })) return;
        try {
            Loader.show();
            await API.resources.delete(id);
            Toast.success('Видалено');
            await this._load();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    async _editDocModal(id) {
        const allDocs = Object.values(this._docs).flat();
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
                    <input id="rf-ed-title" type="text" autocomplete="off" value="${Fmt.esc(doc.title)}"
                        style="width:100%;padding:.55rem .8rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box">
                </div>
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">
                        Довіреність (ТОВ)
                        <span style="font-weight:400;color:var(--text-muted)">&nbsp;— залиш порожнім для всіх</span>
                    </label>
                    <select id="rf-ed-dovid" style="width:100%;padding:.55rem .8rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box">
                        <option value="">— для всіх підрозділів —</option>
                        ${dovs.map(d => `<option value="${d.id}" ${doc.dovirenost_id === d.id ? 'selected' : ''}>${Fmt.esc(d.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:.78rem;font-weight:600;color:var(--text-secondary);margin-bottom:.35rem">Замінити файл <span style="font-weight:400;color:var(--text-muted)">&nbsp;— залиш порожнім щоб не змінювати</span></label>
                    <div class="file-upload-frame">
                        <label for="rf-ed-file" class="file-upload-area" id="rf-ed-area">
                            <div class="file-upload-icon"><i class="fa-solid fa-file-arrow-up"></i></div>
                            <div class="file-upload-label" id="rf-ed-label">Натисніть або перетягніть файл</div>
                            <div class="file-upload-hint">PDF, DOC, DOCX</div>
                            <input type="file" id="rf-ed-file" accept=".pdf,.doc,.docx" style="display:none"
                                onchange="document.getElementById('rf-ed-label').textContent=this.files[0]?.name||'Натисніть або перетягніть файл'">
                        </label>
                    </div>
                </div>
            </div>`,
            footer: `<button class="btn btn-primary btn-sm" onclick="RedFolderPage._doEditDoc('${id}')"><i class="fa-solid fa-save"></i> Зберегти</button>
                     <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>`
        });
    },

    async _doEditDoc(id) {
        const title = Dom.val('rf-ed-title').trim();
        const dovirenost_id = Dom.val('rf-ed-dovid') || null;
        const file = document.getElementById('rf-ed-file')?.files?.[0];
        if (!title) { Toast.warning('Введіть назву'); return; }
        try {
            Loader.show();
            const fields = { title, dovirenost_id };
            if (file) {
                const ext = file.name.slice(file.name.lastIndexOf('.')); const safeName = file.name.slice(0, file.name.lastIndexOf('.')).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 40).replace(/_+$/, '') + ext;
                const path = `red-folder/${Date.now()}_${safeName}`;
                const { error: upErr } = await supabase.storage.from('lesson-resources').upload(path, file);
                if (upErr) throw upErr;
                fields.storage_path = path;
                const current = Object.values(this._docs).flat().find(d => d.id === id);
                fields.doc_version = (current?.doc_version || 1) + 1;
            }
            await API.resources.update(id, fields);
            Modal.close();
            Toast.success('Збережено', fields.doc_version ? `Версія оновлена до v${fields.doc_version}` : '');
            await this._load();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally {
            Loader.hide();
        }
    },

    async init(container) {
        UI.setBreadcrumb([{ label: 'Червона папка' }]);
        this._injectStyles();
        container.innerHTML = `<div id="rf-tab-area"></div>`;
        await this.renderInTab(document.getElementById('rf-tab-area'));
    }
};
