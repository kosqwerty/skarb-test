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
                    <div class="col-admin-hint"><i class="fa-solid fa-circle-info"></i> Цей список бачать лише адміни. Усі інші користувачі при вході в розділ одразу потрапляють на головну сторінку (🏠) — і переходять далі лише за посиланнями всередині неї.</div>
                </div>
                <div class="page-actions">
                    ${AppState.canMutate() ? `<button class="btn btn-primary" onclick="CollectionsPage.openEditor()">+ Нова сторінка</button>` : ''}
                </div>
            </div>
            <div id="pages-list"></div>
            <style>
                .col-admin-hint{display:inline-flex;align-items:center;gap:8px;margin-top:.6rem;padding:9px 16px;
                    border-radius:12px;background:var(--bg-raised);border:1px solid var(--border);
                    color:var(--text-secondary);font-size:.8rem;max-width:560px}
                .col-admin-hint i{color:var(--primary);flex-shrink:0}
            </style>`;
        await this._loadList();
    },

    _pagesAll:   [],
    _sortField:  'updated_at',
    _sortDir:    -1,

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
                    if (p.network_visibility === 'trusted' && !AppState.isTrustedNetwork) return false;
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
            this._pagesAll = visible;
            if (!visible.length) {
                el.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🪄</div>
                        <h3>Сторінок поки немає</h3>
                        ${AppState.isStaff() ? '<p>Створіть першу сторінку.</p>' : ''}
                    </div>`;
                return;
            }
            el.innerHTML = this._tableHtml();
            this._renderTableRows();
        } catch (e) {
            el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
        }
    },

    // Дефолтна ширина колонок (px) — користувацькі зміни зберігаються в
    // localStorage і мержаться поверх при кожному рендері таблиці.
    _colDefaults: { title: 320, is_published: 140, tags: 240, updated_at: 150, actions: 150 },

    _loadColWidths() {
        try {
            const saved = JSON.parse(localStorage.getItem('col_tbl_widths') || '{}');
            return { ...this._colDefaults, ...saved };
        } catch { return { ...this._colDefaults }; }
    },

    _saveColWidth(field, width) {
        try {
            const saved = JSON.parse(localStorage.getItem('col_tbl_widths') || '{}');
            saved[field] = width;
            localStorage.setItem('col_tbl_widths', JSON.stringify(saved));
        } catch {}
    },

    _startColResize(e, field) {
        e.preventDefault();
        e.stopPropagation();
        const th = e.currentTarget.closest('th');
        const col = document.querySelector(`#pages-list col[data-field="${field}"]`);
        if (!th || !col) return;
        const startX = e.clientX;
        const startWidth = th.getBoundingClientRect().width;
        const onMove = ev => {
            const w = Math.max(70, Math.round(startWidth + (ev.clientX - startX)));
            col.style.width = w + 'px';
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            this._saveColWidth(field, parseInt(col.style.width, 10));
            // Клік, що йде одразу за mouseup, потрапляє на <th> і викликав би
            // сортування — знімаємо прапорець із затримкою через setTimeout(0),
            // щоб він встиг заблокувати саме цей click (спрацьовує синхронно
            // одразу після mouseup, до будь-якого macrotask).
            setTimeout(() => { this._resizingCol = false; }, 0);
        };
        this._resizingCol = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    },

    // Кастомний dropdown-фільтр (кнопка + панель) замість native <select> —
    // той не можна нормально стилізувати (спливаючий список завжди рендериться
    // ОС/браузером, а не CSS проєкту). Стан зберігається в прихованому input,
    // щоб _renderTableRows() читав значення так само, як раніше з <select>.
    _filterDropHtml(key, icon, defaultLabel, options) {
        const items = options.map(([val, label]) => `
            <div class="col-tbl-fdrop-item${val === '' ? ' active' : ''}" data-val="${Fmt.esc(val)}" data-label="${Fmt.esc(label)}"
                 onclick="CollectionsPage._pickFilter('${key}', this.dataset.val, this.dataset.label)">${Fmt.esc(label)}</div>`).join('');
        return `
            <div class="col-tbl-fgroup" id="col-tbl-${key}-group">
                <button type="button" class="col-tbl-fbtn" onclick="event.stopPropagation();CollectionsPage._toggleFilterDrop('${key}')">
                    <i class="fa-solid ${icon}"></i>
                    <span id="col-tbl-${key}-label">${Fmt.esc(defaultLabel)}</span>
                    <i class="fa-solid fa-chevron-down"></i>
                </button>
                <input type="hidden" id="col-tbl-${key}-filter" value="">
                <div class="col-tbl-fdrop" id="col-tbl-${key}-drop" style="display:none" onclick="event.stopPropagation()">${items}</div>
            </div>`;
    },

    _toggleFilterDrop(key) {
        const wasOpen = this._openFilterDrop === key;
        this._closeAllFilterDrops();
        if (wasOpen) return;
        const drop  = document.getElementById(`col-tbl-${key}-drop`);
        const group = document.getElementById(`col-tbl-${key}-group`);
        if (!drop || !group) return;
        drop.style.display = 'block';
        group.classList.add('open');
        this._openFilterDrop = key;
        this._ensureFilterOutsideClick();
    },

    _closeAllFilterDrops() {
        ['status', 'home', 'section'].forEach(k => {
            const drop  = document.getElementById(`col-tbl-${k}-drop`);
            const group = document.getElementById(`col-tbl-${k}-group`);
            if (drop) drop.style.display = 'none';
            if (group) group.classList.remove('open');
        });
        this._openFilterDrop = null;
    },

    _pickFilter(key, val, label) {
        const input = document.getElementById(`col-tbl-${key}-filter`);
        const labelEl = document.getElementById(`col-tbl-${key}-label`);
        if (input) input.value = val;
        if (labelEl) labelEl.textContent = label;
        document.querySelectorAll(`#col-tbl-${key}-drop .col-tbl-fdrop-item`).forEach(el => {
            el.classList.toggle('active', el.dataset.val === val);
        });
        this._closeAllFilterDrops();
        this._applyTableFilters();
    },

    _ensureFilterOutsideClick() {
        if (this._filterOutsideBound) return;
        this._filterOutsideBound = true;
        document.addEventListener('click', e => {
            if (!e.target.closest('.col-tbl-fgroup')) this._closeAllFilterDrops();
        });
    },

    _tableHtml() {
        const widths = this._loadColWidths();
        const resizer = field => `<span class="col-tbl-resizer" onmousedown="CollectionsPage._startColResize(event,'${field}')" onclick="event.stopPropagation()"></span>`;
        const col = (field, label) => {
            const active = this._sortField === field;
            return `<th class="col-tbl-th" onclick="CollectionsPage._sortBy('${field}')">
                <span class="col-tbl-th-inner">${label}
                    <span class="sort-btns" data-field="${field}">
                        <button class="sort-arrow sort-up${active && this._sortDir === 1 ? ' active' : ''}" onclick="event.stopPropagation();CollectionsPage._sortBy('${field}',1)" title="За зростанням">▲</button>
                        <button class="sort-arrow sort-down${active && this._sortDir === -1 ? ' active' : ''}" onclick="event.stopPropagation();CollectionsPage._sortBy('${field}',-1)" title="За спаданням">▼</button>
                    </span>
                </span>
                ${resizer(field)}
            </th>`;
        };
        return `
            <style>
                @keyframes colTbToolbarIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
                .col-tbl-toolbar{display:flex;align-items:center;gap:.5rem;margin-bottom:1rem;padding:.45rem;flex-wrap:wrap;
                    background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);
                    box-shadow:var(--shadow-sm);animation:colTbToolbarIn .3s cubic-bezier(.16,1,.3,1)}
                @media (prefers-reduced-motion: reduce){.col-tbl-toolbar{animation:none}}
                .col-tbl-search{position:relative;flex:1;min-width:200px}
                .col-tbl-search i{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-muted);
                    font-size:.78rem;pointer-events:none;transition:color .2s ease}
                .col-tbl-search input{width:100%;height:38px;padding:0 14px 0 36px;border-radius:999px;box-sizing:border-box;
                    border:1.5px solid transparent;background:var(--bg-hover);color:var(--text-primary);
                    font-size:.85rem;outline:none;transition:border-color .2s ease,background .2s ease,box-shadow .2s ease}
                .col-tbl-search input::placeholder{color:var(--text-muted)}
                .col-tbl-search input:focus{border-color:var(--primary);background:var(--bg-surface);box-shadow:0 0 0 4px var(--primary-glow)}
                .col-tbl-search:focus-within i{color:var(--primary)}
                .col-tbl-divider{width:1px;align-self:stretch;margin:3px 0;background:var(--border);flex-shrink:0}
                .col-tbl-fgroup{position:relative;flex-shrink:0}
                .col-tbl-fbtn{display:flex;align-items:center;gap:.4rem;height:38px;padding:0 11px;border-radius:999px;
                    border:1.5px solid transparent;background:var(--bg-hover);cursor:pointer;
                    font:inherit;font-size:.82rem;font-weight:500;color:var(--text-primary);
                    transition:border-color .2s ease,background .2s ease,box-shadow .2s ease}
                .col-tbl-fbtn i:first-child{font-size:.72rem;color:var(--text-muted);transition:color .2s ease}
                .col-tbl-fbtn i:last-child{font-size:.55rem;color:var(--text-muted);transition:transform .2s ease,color .2s ease}
                .col-tbl-fbtn:hover{background:var(--bg-raised)}
                .col-tbl-fgroup.open .col-tbl-fbtn{border-color:var(--primary);background:var(--bg-surface);box-shadow:0 0 0 4px var(--primary-glow)}
                .col-tbl-fgroup.open .col-tbl-fbtn i:last-child{transform:rotate(180deg);color:var(--primary)}
                .col-tbl-fgroup.active .col-tbl-fbtn{border-color:color-mix(in srgb, var(--primary) 45%, var(--border));
                    background:color-mix(in srgb, var(--primary) 8%, var(--bg-hover))}
                .col-tbl-fgroup.active .col-tbl-fbtn i:first-child{color:var(--primary)}
                @keyframes colTbDropIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
                .col-tbl-fdrop{position:absolute;top:calc(100% + 6px);left:0;min-width:180px;z-index:30;
                    background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;
                    box-shadow:var(--shadow-md);padding:.3rem;animation:colTbDropIn .16s cubic-bezier(.16,1,.3,1)}
                @media (prefers-reduced-motion: reduce){.col-tbl-fdrop{animation:none}}
                .col-tbl-fdrop-item{padding:.5rem .65rem;border-radius:8px;font-size:.82rem;color:var(--text-primary);
                    cursor:pointer;transition:background .12s ease;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
                .col-tbl-fdrop-item:hover{background:var(--bg-hover)}
                .col-tbl-fdrop-item.active{color:var(--primary);font-weight:600;background:color-mix(in srgb, var(--primary) 10%, transparent)}
                .col-tbl-count{margin-left:auto;display:flex;align-items:center;gap:.4rem;height:38px;padding:0 .95rem;
                    border-radius:999px;background:var(--bg-hover);border:1px solid var(--border);
                    font-size:.76rem;font-weight:600;color:var(--text-secondary);white-space:nowrap;
                    font-variant-numeric:tabular-nums}
                .col-tbl-count i{font-size:.68rem;color:var(--text-muted)}
                @media (max-width:768px){
                    .col-tbl-toolbar{padding:.55rem}
                    .col-tbl-search{min-width:100%;order:-1}
                    .col-tbl-divider{display:none}
                    .col-tbl-count{margin-left:0;width:100%;justify-content:center}
                }
                .col-tbl-wrap{width:100%;overflow-x:auto;border-radius:var(--radius-lg);border:1px solid var(--border)}
                .col-tbl{border-collapse:collapse;font-size:.85rem;table-layout:fixed}
                .col-tbl-th{position:sticky;top:0;z-index:5;background:var(--bg-raised);color:var(--text-muted);
                    font-weight:600;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;
                    padding:.65rem .85rem;text-align:left;border-bottom:1px solid var(--border);
                    white-space:nowrap;cursor:pointer;user-select:none;transition:background .15s,color .15s}
                .col-tbl-th:hover{background:var(--bg-hover);color:var(--text-primary)}
                .col-tbl-th-inner{display:flex;align-items:center;gap:.35rem;overflow:hidden}
                .col-tbl-th-nc{cursor:default}
                .col-tbl-th-nc:hover{background:var(--bg-raised);color:var(--text-muted)}
                .col-tbl-resizer{position:absolute;top:0;right:0;bottom:0;width:6px;cursor:col-resize;z-index:6}
                .col-tbl-resizer:hover,.col-tbl-resizer:active{background:var(--primary)}
                .col-tbl tbody tr{position:relative;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s}
                .col-tbl-row-link{position:absolute;inset:0;z-index:1}
                .col-tbl td:last-child{position:relative;z-index:2}
                .col-tbl tbody tr:last-child{border-bottom:none}
                .col-tbl tbody tr:hover{background:var(--bg-raised)}
                .col-tbl tbody tr.is-home{background:color-mix(in srgb, var(--primary) 5%, var(--bg-surface))}
                .col-tbl tbody tr.is-home:hover{background:color-mix(in srgb, var(--primary) 9%, var(--bg-surface))}
                .col-tbl td{padding:.7rem .85rem;vertical-align:middle;overflow:hidden}
                .col-tbl-title{font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:.4rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                .col-tbl-tags{display:flex;flex-wrap:wrap;gap:.25rem}
                .col-tbl-tag{font-size:.68rem;padding:1px 7px;border-radius:20px;background:rgba(99,102,241,.1);color:var(--primary);border:1px solid rgba(99,102,241,.2)}
                .col-tbl-actions{display:flex;gap:.35rem;justify-content:flex-end}
                .col-tbl-abtn{width:28px;height:28px;border-radius:50%;border:1.5px solid var(--border);background:var(--bg-raised);
                    color:var(--text-secondary);font-size:.78rem;cursor:pointer;display:flex;align-items:center;justify-content:center;
                    transition:border-color .15s,color .15s}
                .col-tbl-abtn:hover{border-color:var(--primary);color:var(--primary)}
                .col-tbl-abtn.danger:hover{border-color:var(--danger);color:var(--danger)}
                .col-tbl-abtn.active{color:var(--primary);border-color:var(--primary)}
                .col-tbl-empty{padding:2.5rem;text-align:center;color:var(--text-muted)}
                .col-tbl-sec-row{background:var(--bg-raised);cursor:pointer}
                .col-tbl-sec-row:hover{background:var(--bg-hover)}
                .col-tbl-sec-th{display:flex;align-items:center;gap:.5rem;padding:.55rem .85rem;font-weight:600;font-size:.82rem;color:var(--text-primary)}
                .col-tbl-sec-th i.fa-chevron-down,.col-tbl-sec-th i.fa-chevron-right{font-size:.65rem;color:var(--text-muted);width:10px}
                .col-tbl-sec-th i.fa-folder,.col-tbl-sec-th i.fa-folder-open{color:var(--primary);font-size:.85rem}
                .col-tbl-sec-count{margin-left:.15rem;font-size:.7rem;font-weight:600;color:var(--text-muted);background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;padding:0 7px}
                #col-tbl-body.col-tbl-grouped tr:not(.col-tbl-sec-row) td:first-child{padding-left:2.3rem}
            </style>
            <div class="col-tbl-toolbar">
                <div class="col-tbl-search search-clear-wrap">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" id="col-tbl-search-input" placeholder="Пошук за назвою…" autocomplete="off" oninput="CollectionsPage._applyTableFilters()">
                    <button type="button" class="search-clear-btn" onclick="UI.clearSearchInput(this)"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="col-tbl-divider"></div>
                ${this._filterDropHtml('status', 'fa-circle-half-stroke', 'Усі статуси', [
                    ['', 'Усі статуси'], ['published', 'Опубліковано'], ['draft', 'Чернетка']
                ])}
                ${this._filterDropHtml('home', 'fa-house', 'Усі сторінки', [
                    ['', 'Усі сторінки'], ['home', 'Лише головна']
                ])}
                ${this._filterDropHtml('section', 'fa-folder', 'Усі розділи', [
                    ['', 'Усі розділи'],
                    ...this._distinctSections().map(s => [s, s]),
                    ['__none__', 'Без розділу']
                ])}
                <span class="col-tbl-count"><i class="fa-solid fa-layer-group"></i> <span id="col-tbl-count"></span></span>
            </div>
            <div class="col-tbl-wrap">
                <table class="col-tbl">
                    <colgroup>
                        <col data-field="title" style="width:${widths.title}px">
                        <col data-field="is_published" style="width:${widths.is_published}px">
                        <col data-field="tags" style="width:${widths.tags}px">
                        <col data-field="updated_at" style="width:${widths.updated_at}px">
                        <col data-field="actions" style="width:${widths.actions}px">
                    </colgroup>
                    <thead>
                        <tr>
                            ${col('title', 'Назва')}
                            ${col('is_published', 'Статус')}
                            <th class="col-tbl-th col-tbl-th-nc">Мітки / доступ${resizer('tags')}</th>
                            ${col('updated_at', 'Оновлено')}
                            <th class="col-tbl-th col-tbl-th-nc" style="text-align:right">Дії${resizer('actions')}</th>
                        </tr>
                    </thead>
                    <tbody id="col-tbl-body"></tbody>
                </table>
            </div>`;
    },

    _sortBy(field, dir) {
        if (this._resizingCol) return; // клік по заголовку одразу після resize — ігноруємо
        if (dir === undefined) {
            dir = (this._sortField === field) ? -this._sortDir : 1;
        }
        this._sortField = field;
        this._sortDir = dir;
        this._renderTableRows();
    },

    _applyTableFilters() {
        ['status', 'home', 'section'].forEach(key => {
            const sel = document.getElementById(`col-tbl-${key}-filter`);
            const group = document.getElementById(`col-tbl-${key}-group`);
            if (sel && group) group.classList.toggle('active', !!sel.value);
        });
        this._renderTableRows();
    },

    _renderTableRows() {
        const tbody = document.getElementById('col-tbl-body');
        if (!tbody) return;

        const q = (document.getElementById('col-tbl-search-input')?.value || '').trim().toLowerCase();
        const statusF = document.getElementById('col-tbl-status-filter')?.value || '';
        const homeF = document.getElementById('col-tbl-home-filter')?.value || '';
        const sectionF = document.getElementById('col-tbl-section-filter')?.value || '';

        let rows = this._pagesAll.filter(p => {
            if (q && !(p.title || '').toLowerCase().includes(q)) return false;
            if (statusF === 'published' && !p.is_published) return false;
            if (statusF === 'draft' && p.is_published) return false;
            if (homeF === 'home' && !p.is_home) return false;
            if (sectionF === '__none__' && p.section) return false;
            if (sectionF && sectionF !== '__none__' && p.section !== sectionF) return false;
            return true;
        });

        const field = this._sortField, dir = this._sortDir;
        const sortFn = (a, b) => {
            let av = a[field], bv = b[field];
            if (field === 'title') { av = (av || '').toLowerCase(); bv = (bv || '').toLowerCase(); return av.localeCompare(bv, 'uk') * dir; }
            if (field === 'is_published') { return ((a.is_published ? 1 : 0) - (b.is_published ? 1 : 0)) * dir; }
            av = av || ''; bv = bv || '';
            return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
        };
        rows = [...rows].sort(sortFn);

        document.querySelectorAll('.col-tbl-th .sort-arrow').forEach(el => el.classList.remove('active'));
        const activeSpan = document.querySelector(`.sort-btns[data-field="${field}"]`);
        const activeBtn = activeSpan?.querySelector(dir === 1 ? '.sort-up' : '.sort-down');
        if (activeBtn) activeBtn.classList.add('active');

        document.getElementById('col-tbl-count').textContent = `${rows.length} з ${this._pagesAll.length}`;

        if (!rows.length) {
            tbody.classList.remove('col-tbl-grouped');
            tbody.innerHTML = `<tr><td colspan="5" class="col-tbl-empty">Нічого не знайдено</td></tr>`;
            return;
        }

        // Групування розділами вимикається під час пошуку — показуємо плаский
        // відфільтрований список, щоб не гортати розділи вручну.
        if (q) {
            tbody.classList.remove('col-tbl-grouped');
            tbody.innerHTML = rows.map(p => this._renderTableRow(p, q)).join('');
            return;
        }
        tbody.classList.add('col-tbl-grouped');
        tbody.innerHTML = this._renderGroupedRows(rows);
    },

    // ── Section grouping ─────────────────────────────────────────

    _distinctSections() {
        const set = new Set();
        this._pagesAll.forEach(p => { if (p.section) set.add(p.section); });
        return [...set].sort((a, b) => a.localeCompare(b, 'uk'));
    },

    _loadSectionCollapse() {
        try { return new Set(JSON.parse(localStorage.getItem('col_section_collapsed') || '[]')); }
        catch { return new Set(); }
    },

    _toggleSection(rowEl) {
        const key = rowEl.dataset.secKey;
        const collapsed = this._loadSectionCollapse();
        if (collapsed.has(key)) collapsed.delete(key); else collapsed.add(key);
        try { localStorage.setItem('col_section_collapsed', JSON.stringify([...collapsed])); } catch {}
        this._renderTableRows();
    },

    _renderGroupedRows(rows) {
        const groups = new Map(); // section name ('' = без розділу) → сторінки
        rows.forEach(p => {
            const key = p.section || '';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(p);
        });
        const names = [...groups.keys()].filter(k => k !== '').sort((a, b) => a.localeCompare(b, 'uk'));
        if (groups.has('')) names.push(''); // "Без розділу" — завжди останнім

        const collapsed = this._loadSectionCollapse();
        return names.map(name => {
            const list = groups.get(name);
            const label = name || 'Без розділу';
            const key = name || '__none__';
            const isCollapsed = collapsed.has(key);
            const header = `
                <tr class="col-tbl-sec-row" data-sec-key="${Fmt.esc(key)}" onclick="CollectionsPage._toggleSection(this)">
                    <td colspan="5" class="col-tbl-sec-th">
                        <i class="fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'}"></i>
                        <i class="fa-solid fa-folder${isCollapsed ? '' : '-open'}"></i>
                        <span>${Fmt.esc(label)}</span>
                        <span class="col-tbl-sec-count">${list.length}</span>
                    </td>
                </tr>`;
            const body = isCollapsed ? '' : list.map(p => this._renderTableRow(p)).join('');
            return header + body;
        }).join('');
    },

    // Підсвічує збіг пошукового запиту в escaped-тексті. Порівняння без
    // урахування регістру, сам текст лишається безпечно екранованим —
    // підсвічуємо вже після Fmt.esc(), тому обгортка <mark> не може зламати HTML.
    _highlightMatch(text, query) {
        if (!query || !text) return Fmt.esc(text || '');
        const esc = Fmt.esc(text);
        const escQuery = Fmt.esc(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return esc.replace(new RegExp(`(${escQuery})`, 'gi'),
            '<mark style="background:#fde047;color:#1e1e1e;border-radius:2px;padding:0 1px">$1</mark>');
    },

    _renderTableRow(p, query = '') {
        const canManage = AppState.isStaff() && AppState.canMutate();
        const statusBadge = p.is_published
            ? `<span class="badge badge-success">опубліковано</span>`
            : `<span class="badge badge-muted">чернетка</span>`;
        const tags = [
            p.is_home ? `<span class="col-tbl-tag" style="background:rgba(16,185,129,.12);color:#10b981;border-color:rgba(16,185,129,.25)">🏠 Головна</span>` : '',
            p.network_visibility === 'trusted' ? `<span class="col-tbl-tag" style="background:rgba(245,158,11,.12);color:#f59e0b;border-color:rgba(245,158,11,.25)" title="Звичайні користувачі бачать лише з довіреної мережі. Адміни й superadmin — завжди">🔒 Довірена мережа</span>` : '',
            p.section ? `<span class="col-tbl-tag" style="background:rgba(139,92,246,.12);color:#8b5cf6;border-color:rgba(139,92,246,.25)">📁 ${Fmt.esc(p.section)}</span>` : '',
            ...(p.allowed_labels || []).map(l => `<span class="col-tbl-tag">🏷 ${Fmt.esc(l)}</span>`)
        ].filter(Boolean).join('');

        const actions = canManage ? `
            ${!p.is_home && AppState.isSuperAdmin() ? `<button class="col-tbl-abtn" onclick="event.stopPropagation();CollectionsPage.setHome('${p.id}')" title="Зробити головною"><i class="fa-solid fa-house"></i></button>` : ''}
            ${AppState.isAdmin() && p.track_visits ? `<button class="col-tbl-abtn" onclick="event.stopPropagation();CollectionsPage.openPageViewStats('${p.id}',${JSON.stringify(p.title || '').replace(/"/g, '&quot;')})" title="Статистика відвідувань"><i class="fa-solid fa-chart-simple"></i></button>` : ''}
            <button class="col-tbl-abtn" onclick="event.stopPropagation();CollectionsPage.openEditor('${p.id}')" title="Редагувати"><i class="fa-solid fa-pen"></i></button>
            <button class="col-tbl-abtn danger" onclick="event.stopPropagation();CollectionsPage.deletePage('${p.id}')" title="Видалити"><i class="fa-solid fa-trash"></i></button>
        ` : '';
        const bmActive = Bookmarks.isBookmarked('collections/' + p.id);

        return `
            <tr class="${p.is_home ? 'is-home' : ''}">
                <td>
                    <a class="col-tbl-row-link" href="#/collections/${p.id}" aria-label="${Fmt.esc(p.title || 'Відкрити')}"></a>
                    <div class="col-tbl-title">
                        ${p.is_home ? '<i class="fa-solid fa-house" style="color:var(--primary);font-size:.78rem"></i>' : ''}
                        <span>${this._highlightMatch(p.title, query)}</span>
                    </div>
                </td>
                <td>${statusBadge}</td>
                <td><div class="col-tbl-tags">${tags || '<span style="color:var(--text-muted);font-size:.78rem">—</span>'}</div></td>
                <td style="color:var(--text-muted);white-space:nowrap">${Fmt.date(p.updated_at || p.created_at)}</td>
                <td onclick="event.stopPropagation()">
                    <div class="col-tbl-actions">
                        <button class="col-tbl-abtn${bmActive ? ' active' : ''}" data-bm-route="collections/${p.id}"
                            title="${bmActive ? 'Видалити з закладок' : 'Зберегти в закладки'}"
                            onclick="Bookmarks.toggleCollection('${p.id}',${JSON.stringify(p.title||'').replace(/"/g,'&quot;')})">
                            <i class="fa-${bmActive ? 'solid' : 'regular'} fa-bookmark"></i>
                        </button>
                        ${actions}
                    </div>
                </td>
            </tr>`;
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
            if (page.network_visibility === 'trusted' && !AppState.isTrustedNetwork && !AppState.isStaff()) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🔒</div>
                        <h3>Доступ обмежено</h3>
                        <p style="color:var(--text-muted)">Ця сторінка доступна лише з довіреної мережі</p>
                        <button class="btn-back" style="margin-top:1rem" onclick="Router.back()"><i class="fa-solid fa-arrow-left"></i> Назад</button>
                    </div>`;
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
                                <button class="btn-back" style="margin-top:1rem" onclick="Router.back()"><i class="fa-solid fa-arrow-left"></i> Назад</button>
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
                                <button class="btn-back" style="margin-top:1rem" onclick="Router.back()"><i class="fa-solid fa-arrow-left"></i> Назад</button>
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
            if (page.track_visits) {
                ActivityTracker.track('page_view', { entity_type: 'page', entity_id: page.id, entity_title: page.title, page: `collections/${page.id}` });
            }
            const resolvedHtml = await this._resolveAttachmentUrls(page.html_content || '');
            this._renderView(container, { ...page, html_content: resolvedHtml });
        } catch (e) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3>
                <button class="btn-back" onclick="Router.go('collections')"><i class="fa-solid fa-arrow-left"></i> Назад</button></div>`;
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
                    ${page.is_home ? '' : '<button class="btn-back" style="flex-shrink:0" onclick="Router.back()"><i class="fa-solid fa-arrow-left"></i> Назад</button>'}
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
                        <style>
                            .col-search-bar{margin-bottom:1rem;display:flex;align-items:center;gap:.75rem}
                            .col-search-wrap{position:relative;flex:1}
                            .col-search-wrap input{width:100%;height:58px;padding:0 20px 0 54px;border-radius:20px;
                                border:1.5px solid rgba(255,255,255,.85);background:rgba(255,255,255,.78);
                                backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
                                color:#1e293b;font-size:1rem;font-weight:500;outline:none;
                                transition:border-color .2s,box-shadow .2s;box-sizing:border-box;
                                box-shadow:0 10px 35px rgba(15,23,42,.06);font-family:inherit}
                            .col-search-wrap input::placeholder{color:#94a3b8;font-weight:400}
                            .col-search-wrap input:focus{border-color:var(--primary);
                                box-shadow:0 0 0 4px var(--primary-glow),0 20px 45px rgba(15,23,42,.08)}
                            body:not(.light-theme) .col-search-wrap input{background:var(--bg-surface);backdrop-filter:none;-webkit-backdrop-filter:none;border-color:var(--border);color:var(--text-primary)}
                            .col-search-icon{position:absolute;left:18px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;font-size:1rem;z-index:2}
                            body:not(.light-theme) .col-search-icon{color:var(--text-muted)}
                            .col-search-wrap input:-webkit-autofill,
                            .col-search-wrap input:-webkit-autofill:hover,
                            .col-search-wrap input:-webkit-autofill:focus {
                                -webkit-box-shadow: 0 0 0 1000px transparent inset;
                                -webkit-text-fill-color: inherit;
                                transition: background-color 99999s ease-in-out 0s;
                            }
                        </style>
                        <div id="pg-search-bar" class="col-search-bar">
                            <div class="col-search-wrap search-clear-wrap">
                                <span class="col-search-icon"><i class="fa-solid fa-magnifying-glass"></i></span>
                                <input id="pg-search-input" type="text" placeholder="Пошук на сторінці…" autocomplete="off"
                                       oninput="CollectionsPage._onSearchInput()"
                                       onkeydown="if(event.key==='Enter'){event.preventDefault();CollectionsPage._searchNav(1);}if(event.key==='Escape'){this.value='';CollectionsPage._applySearch('');}">
                                <button type="button" class="search-clear-btn" onclick="UI.clearSearchInput(this)"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                            <span id="pg-search-count" style="font-size:.75rem;font-weight:600;color:var(--text-muted);white-space:nowrap;min-width:72px;text-align:right;letter-spacing:.01em"></span>
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
        // Якщо автор сторінки сам обробляє html.lms-dark у своєму CSS/HTML (власна
        // світла/темна тема), платформний "фейковий dark mode" (invert+hue-rotate
        // на весь iframe) більше НЕ накладаємо — інакше авторські темні кольори
        // ще раз інвертуються поверх і виглядають як рентген. Клас html.lms-dark
        // все одно передається через postMessage нижче — сторінка сама вирішує,
        // як виглядати.
        const hasCustomDarkTheme = /lms-dark/.test((page.css_content || '') + (page.html_content || ''));
        const applyIframeTheme = (iframe, isLight) => {
            iframe.style.filter = (isLight || hasCustomDarkTheme) ? '' : 'invert(1) hue-rotate(180deg)';
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
    // Навмисно НЕ включаємо document.documentElement.scrollHeight/offsetHeight:
    // для кореневого <html> браузери повертають max(висота контенту, висота
    // viewport), а viewport iframe — це і є та висота, яку йому щойно
    // виставив батько. Це створює петлю зворотного зв'язку (кожен клік додає
    // +400px до вже "забрудненого" попереднім циклом значення). document.body
    // — звичайний елемент, такому розтягуванню під viewport не підлягає.
    var h = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight
    ) + (buffer || 0);
    if (h > 0) window.parent.postMessage({ type: 'lms-resize', height: h }, '*');
  }
  // Раніше тут був буфер +400px на mousedown "про всяк випадок" (якщо клік
  // відкриє щось високе), який зменшувався назад із затримкою — але саме
  // це давало видимий стрибок висоти на кожному кліку. ResizeObserver нижче
  // реагує на будь-яку реальну зміну висоти контенту миттєво й точно, тож
  // спекулятивний буфер на клік більше не потрібен.
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
  if (!href) return;
  var route = null;
  if (href.startsWith('#')) {
    // Відносне посилання, вставлене через "Ресурси" в редакторі: #resource/ID
    route = href.slice(1);
  } else {
    // Автор міг вставити повне посилання, скопійоване з адресного рядка
    // (https://сайт/#/resource/ID) — без цього iframe сторінки Collections
    // сам перейшов би за ним і завантажив увесь застосунок ЗАНОВО всередині
    // себе (бо allow-same-origin), замість переходу на верхньому рівні.
    try {
      var resolved = new URL(href, location.href);
      if (resolved.origin === location.origin && resolved.hash) {
        route = resolved.hash.slice(1);
      }
    } catch (err) {}
  }
  if (route !== null) {
    e.preventDefault();
    route = route.replace(/^\\//, ''); // на випадок #/resource/x замість #resource/x
    window.parent.postMessage({ type: 'lms-navigate', route: route }, '*');
  }
});
<\/script>` : '';

        const isLight = document.body.classList.contains('light-theme');
        // Сторінки з власною обробкою html.lms-dark (свої кольори/картинки під
        // кожну тему) платформа більше НЕ інвертує зовні (див. applyIframeTheme
        // в initView) — тому й правило "відкрутити картинку назад" тут шкідливе:
        // компенсувати вже нічого, і без зовнішньої інверсії воно просто інвертує
        // картинку по-справжньому. Вмикаємо його лише для "звичайних" сторінок,
        // які покладаються на платформний фейковий dark mode.
        const hasCustomDarkTheme = /lms-dark/.test((css || '') + (html || ''));
        const reInvertMediaCss = hasCustomDarkTheme ? '' : `
  /* Re-invert media in dark mode so photos look natural under the iframe filter */
  html.lms-dark img, html.lms-dark video, html.lms-dark canvas, html.lms-dark picture {
    filter: invert(1) hue-rotate(180deg);
  }`;
        // Клас теми вшиваємо синхронно в саму розмітку (замість того, щоб
        // покладатись лише на postMessage) — інакше перше повідомлення
        // lms-theme-change летить одразу після встановлення srcdoc, коли
        // новий документ (і його слухач message) ще не встиг завантажитись,
        // і губиться: сторінка "не знає" тему при першому відкритті, доки
        // користувач вручну не перемкне тему застосунку.
        const doc = `<!DOCTYPE html><html${isLight ? '' : ' class="lms-dark"'}><head><meta charset="UTF-8"><base href="${location.origin}/"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">${iframeScript}
<style>
  body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; font-weight: 400; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  b, strong { font-weight: 700; }
  img, video, canvas, picture, svg { max-width: 100%; }${reInvertMediaCss}
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
    _saving:              false,
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
        if (btn) { btn.classList.remove('btn-primary'); btn.classList.add('btn-warning'); btn.innerHTML = '<i class="fa-solid fa-circle" style="font-size:.45rem;vertical-align:middle;margin-right:.35rem"></i> Зберегти та закрити'; }
    },

    _markClean() {
        this._isDirty = false;
        const btn = document.getElementById('col-save-btn');
        if (btn) { btn.classList.remove('btn-warning'); btn.classList.add('btn-primary'); btn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Зберегти та закрити'; }
    },

    // ── Section combobox (кастомний випадний список замість native datalist) ──
    _filterSectionSuggest() {
        const input = document.getElementById('page-section-input');
        const box   = document.getElementById('page-section-suggest');
        if (!input || !box) return;
        const q = input.value.trim().toLowerCase();
        const list = (this._sectionOptions || []).filter(s => !q || s.toLowerCase().includes(q));
        if (!list.length) {
            box.innerHTML = q ? `<div class="col-section-suggest-empty">Нових збігів немає — Enter створить «${Fmt.esc(input.value.trim())}»</div>` : '';
            box.style.display = q ? 'block' : 'none';
            return;
        }
        box.innerHTML = list.map(s => `<div class="col-section-suggest-item" data-val="${Fmt.esc(s)}" onmousedown="event.preventDefault();CollectionsPage._pickSection(this.dataset.val)">${Fmt.esc(s)}</div>`).join('');
        box.style.display = 'block';
    },

    _pickSection(val) {
        const input = document.getElementById('page-section-input');
        if (input) { input.value = val; this._markDirty(); }
        this._hideSectionSuggest();
    },

    _hideSectionSuggest() {
        const box = document.getElementById('page-section-suggest');
        if (box) box.style.display = 'none';
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
        let page = null, attachments = [], groups = [], allDov = [], selectedDovIds = [], allSections = [];
        Loader.show();
        try {
            const fetches = [
                API.accessGroups.getAll().catch(() => []),
                API.dovirenosti.getAll().catch(() => []),
                API.pages.getAll().catch(() => [])
            ];
            if (id) fetches.push(API.pages.getById(id), API.pageAttachments.getAll(id), API.pageDovirenosti.get(id).catch(() => []));
            const results = await Promise.all(fetches);
            groups      = results[0];
            allDov      = results[1];
            allSections = [...new Set(results[2].map(p => p.section).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'uk'));
            this._sectionOptions = allSections;
            if (id) { page = results[3]; attachments = results[4]; selectedDovIds = results[5]; }
            this._editingPageData = page;
        }
        catch (e) { Toast.error('Помилка', e.message); Loader.hide(); return; }
        finally { Loader.hide(); }

        const container = document.getElementById('page-content');
        UI.setBreadcrumb([
            { label: 'Сторінки', link: 'collections' },
            { label: id ? 'Редагувати' : 'Нова сторінка' }
        ]);
        this._allDov = allDov;
        container.innerHTML = this._editorHtml(page, groups, allDov, selectedDovIds, allSections);
        this._initEditor(page);
        this._updateNetworkHint();
        if (page?.html_content) {
            const found = [...page.html_content.matchAll(/att:([0-9a-f-]{36})/g)];
            found.forEach(m => this._insertedIds.add(m[1]));
        }
        this._renderAttachmentGrid(attachments);
    },

    _editorHtml(page, groups = [], allDov = [], selectedDovIds = [], allSections = []) {
        const selectedLabels = page?.allowed_labels || [];
        const groupNames = groups.map(g => g.name).sort();
        const dovNames = allDov.map(d => ({ id: d.id, name: d.name }));
        const isPublished = page?.is_published || false;
        const hasLabels = (page?.allowed_labels?.length || 0) > 0;
        const hasDovs   = selectedDovIds.length > 0;
        const hasNetwork = page?.network_visibility === 'trusted';
        const accessSummary = (hasLabels || hasDovs || hasNetwork) ? 'Обмежений доступ' : 'Усі користувачі';
        const savedAt = page?.updated_at ? new Date(page.updated_at) : null;

        return `
        <div class="col-page">

            <!-- Header, як у "Редагувати новину" -->
            <div class="col-hdr">
                <div class="col-hdr-icon"><i class="fa-solid ${page?.id ? 'fa-pen' : 'fa-file-circle-plus'}"></i></div>
                <div class="col-hdr-text">
                    <div class="col-hdr-title">${page?.id ? 'Редагувати сторінку' : 'Нова сторінка'}</div>
                    <div class="col-hdr-sub">
                        <span id="col-status-pill" class="col-status-pill ${isPublished ? 'live' : 'draft'}">
                            <i class="fa-solid ${isPublished ? 'fa-circle-check' : 'fa-pen'}" style="font-size:.6rem"></i>
                            <span id="col-status-label">${isPublished ? 'Опубліковано' : 'Чернетка'}</span>
                        </span>
                        <span id="col-saved-badge" class="col-tb-saved-badge" style="display:${page?.id ? 'inline-flex' : 'none'}">
                            <i class="fa-solid fa-check"></i> Збережено
                        </span>
                        <span id="col-last-saved" class="col-tb-timestamp">${savedAt ? 'Останнє збереження: ' + CollectionsPage._fmtAgo(savedAt) : ''}</span>
                    </div>
                </div>
                <div class="col-hdr-actions">
                    <button class="btn btn-secondary" onclick="Router.back()">Скасувати</button>
                    <div style="position:relative;flex-shrink:0">
                        <div class="col-tb-save-split">
                            <button id="col-save-btn" class="col-tb-save-btn"
                                    onclick="CollectionsPage.savePage(CollectionsPage._editingPageId || '', false)">
                                <i class="fa-regular fa-floppy-disk"></i> Зберегти та закрити
                            </button>
                            <button class="col-tb-save-caret" onclick="CollectionsPage._toggleSaveMenu(this)">
                                <i class="fa-solid fa-chevron-down"></i>
                            </button>
                        </div>
                        <div id="col-save-menu" class="col-tb-menu">
                            <button class="col-tb-menu-item" onclick="CollectionsPage._selectSaveOption(CollectionsPage._editingPageId || '', true, 'Зберегти', 'fa-solid fa-check')">
                                <i class="fa-solid fa-check" style="color:var(--text-muted);width:14px"></i> Зберегти
                            </button>
                        </div>
                    </div>
                </div>
                <!-- Hidden inputs for savePage() compatibility -->
                <input type="hidden" id="page-published" value="${isPublished ? '1' : ''}">
            </div>

            <div class="col-layout">

                <!-- ── Ліва колонка ── -->
                <div class="col-main">

                    <div class="col-hero-card">
                        <div class="col-field">
                            <label>Назва сторінки *</label>
                            <input id="page-title-input" class="col-title-input" type="text" value="${Fmt.esc(page?.title || '')}" placeholder="Введіть назву сторінки…"
                                   oninput="CollectionsPage._markDirty()">
                        </div>
                        <div class="col-field" style="margin-top:.75rem">
                            <label><i class="fa-solid fa-folder" style="color:var(--text-muted);margin-right:.3rem"></i>Розділ</label>
                            <div class="col-section-combo">
                                <input id="page-section-input" class="col-tb-select" type="text" style="cursor:text"
                                       value="${Fmt.esc(page?.section || '')}" placeholder="Наприклад: Онбординг"
                                       autocomplete="off"
                                       oninput="CollectionsPage._markDirty();CollectionsPage._filterSectionSuggest()"
                                       onfocus="CollectionsPage._filterSectionSuggest()"
                                       onblur="setTimeout(()=>CollectionsPage._hideSectionSuggest(),150)">
                                <div id="page-section-suggest" class="col-section-suggest" style="display:none"></div>
                            </div>
                        </div>
                    </div>

                    <div class="col-card">
                        <div class="col-card-head col-content-head">
                            <div style="display:flex">
                                <button id="tab-html" onclick="CollectionsPage._switchTab('html')"
                                        style="padding:.5rem 1.25rem;font-size:.8rem;font-weight:600;letter-spacing:.05em;border:none;cursor:pointer;background:var(--bg-surface);color:var(--text-primary);border-right:1px solid var(--border);border-bottom:2px solid var(--primary)">HTML</button>
                                <button id="tab-css" onclick="CollectionsPage._switchTab('css')"
                                        style="padding:.5rem 1.25rem;font-size:.8rem;font-weight:600;letter-spacing:.05em;border:none;cursor:pointer;background:var(--bg-raised);color:var(--text-muted);border-right:1px solid var(--border);border-bottom:2px solid transparent">CSS</button>
                            </div>
                            <button type="button" class="btn btn-ghost btn-sm" id="col-preview-toggle" onclick="CollectionsPage._toggleColPreview(this)">
                                <i class="fa-regular fa-eye-slash"></i> Сховати прев'ю
                            </button>
                        </div>
                        <div class="col-card-body" style="padding:0">
                            <!-- Split: code left + resize handle + live preview right -->
                            <div id="col-split" style="display:flex;gap:0;height:600px">

                                <!-- Code panel -->
                                <div id="col-code-panel" style="display:flex;flex-direction:column;width:50%;min-width:180px;border-right:1px solid var(--border);overflow:hidden">
                                    <textarea id="editor-html" spellcheck="false">${this._esc(page?.html_content || this._defaultHtml())}</textarea>
                                    <textarea id="editor-css" spellcheck="false" style="display:none">${this._esc((page?.css_content || this._defaultCss()).replace(/'Play'/g, "'Inter'").replace(/'Fixel Display'/g, "'Inter'"))}</textarea>
                                </div>

                                <!-- Resize handle -->
                                <div id="col-split-handle" onmousedown="CollectionsPage._startResize(event)"></div>

                                <!-- Live preview -->
                                <div id="col-preview-panel" style="display:flex;flex-direction:column;flex:1;min-width:180px;overflow:hidden">
                                    <iframe id="live-preview-iframe" style="flex:1;border:none;background:#fff;width:100%"
                                            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"></iframe>
                                </div>

                            </div>
                        </div>
                    </div>

                    <div class="col-card">
                        <div class="col-card-head col-card-head-split">
                            <span><i class="fa-solid fa-paperclip"></i> Прикріплені файли</span>
                            <span style="display:flex;align-items:center;gap:.5rem">
                                <span id="col-insert-counter" style="display:none;font-size:.72rem;font-weight:600;background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);border-radius:20px;padding:1px 8px"></span>
                                ${page?.id ? `
                                <label id="col-attach-add" style="cursor:pointer">
                                    <span class="btn btn-ghost btn-sm" style="pointer-events:none">+ Додати</span>
                                    <input type="file" multiple style="display:none" onchange="CollectionsPage._onAttachFiles(this)">
                                </label>` : `
                                <label id="col-attach-add" style="cursor:pointer">
                                    <span class="btn btn-ghost btn-sm" style="pointer-events:none">+ Додати</span>
                                    <input type="file" multiple style="display:none" onchange="CollectionsPage._onAttachFilesNew(this)">
                                </label>`}
                            </span>
                        </div>
                        <div id="attachment-panel" class="col-card-body" style="padding:0">
                            <div id="attachment-grid"
                                 style="display:flex;flex-wrap:wrap;gap:.5rem;padding:.75rem .875rem;min-height:96px;align-items:flex-start">
                                ${page?.id ? '' : '<span style="font-size:.8rem;color:var(--text-muted);align-self:center">—</span>'}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ── Права колонка (опції) ── -->
                <div class="col-sidebar">

                    <div class="col-card" style="--c:#10b981">
                        <div class="col-card-head"><i class="fa-solid fa-paper-plane"></i>Публікація</div>
                        <div class="col-card-body">
                            <label class="col-tb-toggle-row" style="--c:#10b981">
                                <span class="col-tb-toggle-ico"><i class="fa-solid fa-circle-check"></i></span>
                                <span class="col-tb-toggle-text">Опубліковано</span>
                                <input type="checkbox" id="page-published-toggle" class="col-tb-toggle-input" ${isPublished ? 'checked' : ''} onchange="CollectionsPage._onPublishToggle(this)">
                                <span class="col-tb-toggle-pill"><span class="col-tb-toggle-knob"></span></span>
                            </label>
                            <label class="col-tb-toggle-row" style="--c:#10b981">
                                <span class="col-tb-toggle-ico"><i class="fa-solid fa-magnifying-glass"></i></span>
                                <span class="col-tb-toggle-text">Пошук на сторінці</span>
                                <input type="checkbox" id="page-search-enabled" class="col-tb-toggle-input" ${page?.search_enabled ? 'checked' : ''}>
                                <span class="col-tb-toggle-pill"><span class="col-tb-toggle-knob"></span></span>
                            </label>
                            ${AppState.isAdmin() ? `
                            <label class="col-tb-toggle-row" style="--c:#10b981">
                                <span class="col-tb-toggle-ico"><i class="fa-solid fa-chart-simple"></i></span>
                                <span class="col-tb-toggle-text">Облік відвідувань</span>
                                <input type="checkbox" id="page-track-visits" class="col-tb-toggle-input" ${page?.track_visits ? 'checked' : ''} onchange="CollectionsPage._markDirty()">
                                <span class="col-tb-toggle-pill"><span class="col-tb-toggle-knob"></span></span>
                            </label>
                            ${page?.id ? `<button type="button" class="btn btn-ghost btn-sm" style="align-self:flex-start" onclick="CollectionsPage.openPageViewStats('${page.id}',${JSON.stringify(page?.title || '').replace(/"/g, '&quot;')})"><i class="fa-solid fa-list"></i> Переглянути статистику</button>` : ''}
                            ` : ''}
                        </div>
                    </div>

                    <div class="col-card" style="--c:#8b5cf6">
                        <div class="col-card-head"><i class="fa-solid fa-shield-halved"></i>Доступ і видимість</div>
                        <div class="col-card-body">
                            <div class="col-field">
                                <label>Мережа доступу</label>
                                <select id="page-network-visibility" class="col-tb-select" onchange="CollectionsPage._markDirty();CollectionsPage._updateNetworkHint()">
                                    <option value="all" ${(!page?.network_visibility || page.network_visibility === 'all') ? 'selected' : ''}>Видно з будь-якої мережі</option>
                                    <option value="trusted" ${page?.network_visibility === 'trusted' ? 'selected' : ''}>Тільки довірена мережа</option>
                                </select>
                                <div id="col-network-hint" class="col-net-hint"></div>
                            </div>
                            <div class="col-field">
                                <label>Мітки груп</label>
                                <div class="col-tb-list">
                                    ${!groupNames.length
                                        ? `<div class="col-tb-list-empty">Групи не знайдено</div>`
                                        : groupNames.map(name => `
                                        <label class="col-tb-check-row">
                                            <input type="checkbox" name="col-group" value="${name.replace(/"/g,'&quot;')}"
                                                   ${selectedLabels.includes(name) ? 'checked' : ''}
                                                   onchange="CollectionsPage._onTagChange()">
                                            <span>${Fmt.esc(name)}</span>
                                        </label>`).join('')}
                                    <label class="col-tb-check-row is-all">
                                        <input type="checkbox" id="col-group-all" ${!selectedLabels.length ? 'checked' : ''} onchange="CollectionsPage._clearAllTags()">
                                        <span>Всі користувачі (без обмежень)</span>
                                    </label>
                                </div>
                            </div>
                            <div class="col-field">
                                <label>Довіреності</label>
                                <div class="col-tb-list">
                                    ${!dovNames.length
                                        ? `<div class="col-tb-list-empty">Довіреності не знайдено</div>`
                                        : dovNames.map(d => `
                                        <label class="col-tb-check-row">
                                            <input type="checkbox" name="col-dov" value="${d.id}"
                                                   ${selectedDovIds.includes(d.id) ? 'checked' : ''}
                                                   onchange="CollectionsPage._onDovChange()">
                                            <span>${Fmt.esc(d.name)}</span>
                                        </label>`).join('')}
                                    <label class="col-tb-check-row is-all">
                                        <input type="checkbox" id="col-dov-all" ${!selectedDovIds.length ? 'checked' : ''} onchange="CollectionsPage._clearAllDovs()">
                                        <span>Без обмежень (всі)</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <style>
            .col-hdr { display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 20px;margin-bottom:1.25rem;border-radius:var(--radius-xl);background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 10%,var(--bg-surface)),color-mix(in srgb,var(--primary) 3%,var(--bg-surface)));border:1px solid var(--border); }
            .col-hdr-icon { width:44px;height:44px;border-radius:13px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem;background:var(--primary);color:#fff;box-shadow:0 6px 16px color-mix(in srgb,var(--primary) 45%,transparent); }
            .col-hdr-text { flex:1;min-width:160px; }
            .col-hdr-title { font-size:1.15rem;font-weight:800;color:var(--text-primary);line-height:1.2; }
            .col-hdr-sub { display:flex;align-items:center;gap:8px;margin-top:3px;flex-wrap:wrap; }
            .col-status-pill { display:inline-flex;align-items:center;gap:5px;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:2px 9px;border-radius:20px; }
            .col-status-pill.live { background:rgba(16,185,129,.14);color:#10b981; }
            .col-status-pill.draft { background:var(--bg-hover);color:var(--text-muted); }
            .col-hdr-actions { display:flex;gap:8px;flex-wrap:wrap;align-items:center; }
            .col-tb-saved-badge { display:inline-flex;align-items:center;gap:.25rem;font-size:.7rem;font-weight:600;background:color-mix(in srgb,#10b981 14%,var(--bg-surface));color:#10b981;border:1px solid color-mix(in srgb,#10b981 30%,transparent);border-radius:20px;padding:2px 9px;white-space:nowrap;flex-shrink:0; }
            .col-tb-timestamp { font-size:.76rem;color:var(--text-muted);white-space:nowrap;flex-shrink:0; }
            .col-tb-save-split { display:flex;border-radius:10px;flex-shrink:0;box-shadow:0 3px 10px color-mix(in srgb,var(--primary) 30%,transparent);overflow:hidden; }
            .col-tb-save-btn { display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .9rem;background:var(--primary);color:#fff;border:none;font-size:.84rem;font-weight:600;cursor:pointer;font-family:inherit;transition:filter .15s; }
            .col-tb-save-btn:disabled { opacity:.6;cursor:not-allowed;filter:none; }
            .col-tb-save-btn:hover { filter:brightness(1.08); }
            .col-tb-save-caret { padding:.5rem .5rem;background:color-mix(in srgb,var(--primary) 88%,#000 8%);color:rgba(255,255,255,.85);border:none;border-left:1px solid rgba(255,255,255,.2);cursor:pointer;font-size:.7rem;transition:filter .15s;height:100%; }
            .col-tb-save-caret:hover { filter:brightness(1.1); }
            .col-tb-menu { display:none;position:absolute;top:calc(100% + 6px);right:0;z-index:300;background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-lg);min-width:210px;overflow:hidden;padding:.3rem; }
            .col-tb-menu-item { width:100%;display:flex;align-items:center;gap:.55rem;padding:.6rem .7rem;background:transparent;border:none;border-radius:8px;font-size:.84rem;color:var(--text-primary);cursor:pointer;font-family:inherit;text-align:left;transition:background .12s; }
            .col-tb-menu-item:hover { background:var(--bg-hover); }
            .col-tb-menu-divider { height:1px;background:var(--border);margin:.25rem .3rem; }
            .col-layout { display:grid;grid-template-columns:1fr 300px;gap:1.25rem;align-items:start; }
            .col-main { display:flex;flex-direction:column;gap:1rem;min-width:0; }
            .col-sidebar { display:flex;flex-direction:column;gap:12px;position:sticky;top:1rem; }
            @media(max-width:900px) { .col-layout{grid-template-columns:1fr} }
            .col-hero-card { background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.1rem 1.35rem;box-shadow:0 1px 3px rgba(0,0,0,.04); }
            .col-field { display:flex;flex-direction:column;gap:.35rem; }
            .col-field label { font-size:.68rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em; }
            .col-title-input { background:transparent;border:none;border-bottom:2px solid var(--border);padding:.5rem 0;font-size:1.35rem;font-weight:700;color:var(--text-primary);width:100%;outline:none;transition:border-color .2s;font-family:inherit; }
            .col-title-input:focus { border-bottom-color:var(--primary); }
            .col-title-input::placeholder { color:var(--text-muted);font-weight:600; }
            .col-card { background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden; }
            .col-card-head { display:flex;align-items:center;justify-content:flex-start;text-align:left;gap:9px;padding:10px 14px;font-size:.76rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--c,var(--primary));background:color-mix(in srgb,var(--c,var(--primary)) 7%,var(--bg-raised));border-bottom:1px solid var(--border); }
            .col-card-head.col-content-head, .col-card-head.col-card-head-split { justify-content:space-between; }
            .col-card-body { padding:12px 14px;display:flex;flex-direction:column;gap:10px; }
            .col-content-head { padding:0;background:var(--bg-raised);text-transform:none;font-weight:400;color:inherit; }
            .col-content-head .btn { font-size:.72rem;padding:.3rem .6rem;margin-right:.5rem;background:var(--bg-surface);border-color:color-mix(in srgb,var(--primary) 45%,var(--border));color:var(--primary); }
            .col-content-head .btn:hover { background:color-mix(in srgb,var(--primary) 12%,var(--bg-surface));border-color:var(--primary); }
            .col-tb-toggle-row { display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-hover);cursor:pointer;transition:border-color .15s,background .15s; }
            .col-tb-toggle-row:has(.col-tb-toggle-input:checked) { border-color:color-mix(in srgb,var(--c,#10b981) 45%,var(--border));background:color-mix(in srgb,var(--c,#10b981) 7%,var(--bg-hover)); }
            .col-tb-toggle-ico { font-size:.95rem;flex-shrink:0;width:18px;text-align:center;color:var(--text-muted); }
            .col-tb-toggle-row:has(.col-tb-toggle-input:checked) .col-tb-toggle-ico { color:var(--c,#10b981); }
            .col-tb-toggle-text { flex:1;min-width:0;font-size:.82rem;font-weight:700;color:var(--text-primary); }
            .col-tb-toggle-input { position:absolute;opacity:0;width:0;height:0; }
            .col-tb-toggle-pill { position:relative;flex-shrink:0;width:36px;height:21px;border-radius:11px;background:var(--border);transition:background .2s; }
            .col-tb-toggle-knob { position:absolute;top:2.5px;left:2.5px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:transform .2s; }
            .col-tb-toggle-input:checked ~ .col-tb-toggle-pill { background:var(--c,#10b981); }
            .col-tb-toggle-input:checked ~ .col-tb-toggle-pill .col-tb-toggle-knob { transform:translateX(15px); }
            .col-tb-select { width:100%;box-sizing:border-box;padding:.45rem .6rem;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-hover);color:var(--text-primary);font-family:inherit;font-size:.82rem;outline:none;cursor:pointer;transition:border-color .15s,box-shadow .15s; }
            .col-tb-select:hover { border-color:color-mix(in srgb,var(--primary) 40%,var(--border)); }
            .col-tb-select:focus { border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 16%,transparent); }
            .col-net-hint{display:flex;align-items:flex-start;gap:.5rem;margin-top:.5rem;padding:.55rem .7rem;border-radius:10px;font-size:.76rem;line-height:1.4}
            .col-net-hint i{margin-top:.1rem;flex-shrink:0}
            .col-net-hint.ok{background:color-mix(in srgb,var(--success,#10b981) 10%,transparent);color:var(--text-secondary)}
            .col-net-hint.ok i{color:var(--success,#10b981)}
            .col-net-hint.warn{background:color-mix(in srgb,var(--warning,#f59e0b) 12%,transparent);color:var(--text-secondary)}
            .col-net-hint.warn i{color:var(--warning,#f59e0b)}
            .col-net-hint b{color:var(--text-primary)}
            .col-section-combo { position:relative; }
            .col-section-suggest { position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:20;max-height:220px;overflow-y:auto;
                background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-md,0 8px 24px rgba(0,0,0,.18));padding:.3rem; }
            .col-section-suggest-item { padding:.45rem .6rem;border-radius:7px;font-size:.82rem;color:var(--text-primary);cursor:pointer;transition:background .12s; }
            .col-section-suggest-item:hover,.col-section-suggest-item.active { background:var(--bg-hover);color:var(--primary); }
            .col-section-suggest-empty { padding:.45rem .6rem;font-size:.8rem;color:var(--text-muted); }
            .col-tb-list { border:1px solid var(--border);border-radius:10px;background:var(--bg-hover);padding:.25rem .4rem; }
            .col-tb-list-empty { font-size:.8rem;color:var(--text-muted);padding:.3rem .25rem; }
            .col-tb-check-row { display:flex;align-items:center;gap:.5rem;padding:.32rem .35rem;border-radius:7px;cursor:pointer;font-size:.84rem;transition:background .12s; }
            .col-tb-check-row:hover { background:var(--bg-hover); }
            .col-tb-check-row.is-all { color:var(--text-muted);font-size:.8rem;border-top:1px solid var(--border);margin-top:.2rem;padding-top:.4rem; }
            #col-code-panel .CodeMirror { height:100%!important; font-family:'Courier New',monospace!important; font-size:.88rem!important; line-height:1.6!important; }
            #col-code-panel .CodeMirror-scroll { height:100%; }
            #col-split-handle { width:5px;background:var(--border);cursor:col-resize;flex-shrink:0;transition:background .15s; }
            #col-split-handle:hover { background:var(--primary); }
            #col-split.col-preview-hidden #col-preview-panel { display:none!important; }
            #col-split.col-preview-hidden #col-split-handle { display:none; }
            #col-split.col-preview-hidden #col-code-panel { width:100%!important; }
            .btn-warning { background:var(--warning,#f59e0b)!important; border-color:var(--warning,#f59e0b)!important; color:#fff!important; }
        </style>`;
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
                          lineWrapping: true,
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
                this.savePage(this._editingPageId || '', true);
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

    _toggleColPreview(btn) {
        const split = document.getElementById('col-split');
        if (!split) return;
        const hidden = split.classList.toggle('col-preview-hidden');
        btn.innerHTML = hidden
            ? '<i class="fa-regular fa-eye"></i> Показати прев\'ю'
            : '<i class="fa-regular fa-eye-slash"></i> Сховати прев\'ю';
        this._cmHtml?.refresh();
        this._cmCss?.refresh();
    },

    _updatePreview() {
        clearTimeout(this._previewTimer);
        this._previewTimer = setTimeout(async () => {
            const iframe = document.getElementById('live-preview-iframe');
            if (!iframe) return;
            const rawHtml = this._cmHtml ? this._cmHtml.getValue() : (document.getElementById('editor-html')?.value || '');
            const css     = this._cmCss  ? this._cmCss.getValue()  : (document.getElementById('editor-css')?.value  || '');
            // Без цього att:UUID лишався буквальним текстом у src/href — превʼю
            // ніколи не показувало картинки/файли вкладень до збереження сторінки,
            // хоча на самій опублікованій сторінці (initView) все резолвиться.
            const html = await this._resolveAttachmentUrls(rawHtml);
            this._renderIframe(iframe, html, css);
            const isLight = document.body.classList.contains('light-theme');
            const hasCustomDarkTheme = /lms-dark/.test(css + html);
            iframe.style.filter = (isLight || hasCustomDarkTheme) ? '' : 'invert(1) hue-rotate(180deg)';
            iframe.onload = (orig => function() {
                orig?.call(this);
                iframe.contentWindow?.postMessage({ type: 'lms-theme-change', isLight }, '*');
            })(iframe.onload);
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
                    <div class="search-clear-wrap" style="width:100%;margin-bottom:.75rem">
                        <input type="text" placeholder="Пошук..." style="width:100%"
                               oninput="CollectionsPage.__filterRes(this.value)">
                        <button type="button" class="search-clear-btn" onclick="UI.clearSearchInput(this)"><i class="fa-solid fa-xmark"></i></button>
                    </div>
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
    _onPublishToggle(cb) {
        const next = cb.checked;
        const inp = document.getElementById('page-published');
        if (inp) inp.value = next ? '1' : '';
        const pill = document.getElementById('col-status-pill');
        if (pill) {
            pill.classList.toggle('live', next);
            pill.classList.toggle('draft', !next);
            const icon = pill.querySelector('i');
            if (icon) icon.className = `fa-solid ${next ? 'fa-circle-check' : 'fa-pen'}`;
            const label = document.getElementById('col-status-label');
            if (label) label.textContent = next ? 'Опубліковано' : 'Чернетка';
        }
        CollectionsPage._markDirty();
    },

    _selectSaveOption(id, inPlace, label, iconClass) {
        const btn = document.getElementById('col-save-btn');
        if (btn) {
            btn.innerHTML = `<i class="${iconClass}"></i> ${label}`;
            // Читаємо id динамічно (не запікаємо '${id}' літералом) — інакше після
            // авто-створення сторінки (_onAttachFilesNew) ця кнопка знову лишиться
            // зі старим порожнім id і при наступному кліку створить дубль сторінки.
            btn.setAttribute('onclick', `CollectionsPage.savePage(CollectionsPage._editingPageId || '', ${JSON.stringify(inPlace)})`);
        }
        const m = document.getElementById('col-save-menu');
        if (m) m.style.display = 'none';
        this.savePage(id, inPlace);
    },

    _toggleSaveMenu(btn) {
        const m = document.getElementById('col-save-menu');
        if (!m) return;
        const open = getComputedStyle(m).display !== 'none';
        m.style.display = open ? 'none' : 'block';
        if (!open) {
            setTimeout(() => document.addEventListener('click', function h(e) {
                if (!e.target.closest('#col-save-menu')) { m.style.display = 'none'; document.removeEventListener('click', h); }
            }), 0);
        }
    },

    // Пояснює, кому насправді буде видно сторінку залежно від вибраної мережі
    // доступу, і показує поточний мережевий статус самого адміна для довідки
    // (staff завжди бачить сторінку сам, незалежно від мережі — обмеження діє
    // лише на звичайних користувачів, тож текст явно про це попереджає).
    _updateNetworkHint() {
        const sel  = document.getElementById('page-network-visibility');
        const hint = document.getElementById('col-network-hint');
        if (!sel || !hint) return;
        const iAmTrusted = !!AppState.isTrustedNetwork;
        const myStatus = iAmTrusted
            ? '<b>довірена мережа</b> ✅'
            : '<b>недовірена мережа</b> ⚠️';
        if (sel.value !== 'trusted') {
            hint.className = 'col-net-hint ok';
            hint.innerHTML = `<i class="fa-solid fa-globe"></i><span>Бачать усі користувачі, з будь-якої мережі. Ваша поточна мережа: ${myStatus}.</span>`;
            return;
        }
        hint.className = 'col-net-hint warn';
        hint.innerHTML = `<i class="fa-solid fa-shield-halved"></i><span>Бачать лише користувачі, що заходять з довіреної мережі (напр. офісний Wi-Fi) — інші отримають "Доступ обмежено". <b>Адміни й superadmin бачать завжди</b>, незалежно від мережі. Ваша поточна мережа: ${myStatus}.</span>`;
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
        if (this._saving) return; // захист від повторних кліків, поки триває збереження
        const title = document.getElementById('page-title-input')?.value.trim();
        if (!title) { Toast.error('Помилка', 'Вкажіть назву сторінки'); return; }

        // Існуюча сторінка без змін — нема що зберігати
        if (id && !this._isDirty) {
            if (inPlace) Toast.info('Немає змін', 'Сторінку вже збережено');
            else Router.back();
            return;
        }

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
            network_visibility: document.getElementById('page-network-visibility')?.value || 'all',
            // Тумблер видимий лише admin — для решти зберігаємо поточне значення,
            // щоб збереження форми не-адміном не скидало облік відвідувань.
            track_visits: document.getElementById('page-track-visits')
                ? document.getElementById('page-track-visits').checked
                : (this._editingPageData?.track_visits ?? false),
            section: document.getElementById('page-section-input')?.value.trim() || null,
            allowed_labels
        };
        this._saving = true;
        const saveBtn = document.getElementById('col-save-btn');
        if (saveBtn) saveBtn.disabled = true;
        Loader.show();
        try {
            if (id) {
                await API.pages.update(id, fields);
                await API.pageDovirenosti.set(id, dovIds);
                Loader.hide();
                this._markClean();
                this._lastSavedAt = new Date();
                if (inPlace) {
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
        } finally {
            this._saving = false;
            if (saveBtn) saveBtn.disabled = false;
        }
    },

    // ── Delete ────────────────────────────────────────────────────
    _trailBack(index) {
        const target = this._pageTrail[index];
        if (!target) return;
        this._pageTrail = this._pageTrail.slice(0, index);
        Router.go(`collections/${target.id}`);
    },

    // Центрована модалка (не глобальний Modal.confirm — той є боковою
    // панеллю на весь екран праворуч, для такого маленького підтвердження
    // це виглядає незручно).
    setHome(id) {
        document.getElementById('col-sethome-confirm')?.remove();
        const el = document.createElement('div');
        el.id = 'col-sethome-confirm';
        el.className = 'center-confirm-backdrop';
        el.innerHTML = `
            <div class="center-confirm-box">
                <h3>Зробити головною?</h3>
                <p>Ця сторінка стане головною для всіх користувачів. Попередня головна сторінка втратить цей статус.</p>
                <div class="center-confirm-actions">
                    <button class="btn btn-ghost" onclick="document.getElementById('col-sethome-confirm').remove()">Скасувати</button>
                    <button class="btn btn-primary" onclick="CollectionsPage._submitSetHome('${id}')">Так, зробити головною</button>
                </div>
            </div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    async _submitSetHome(id) {
        document.getElementById('col-sethome-confirm')?.remove();
        try {
            await API.pages.setHome(id);
            Toast.success('Головну сторінку встановлено');
            await this._loadList();
        } catch(e) {
            Toast.error('Помилка', e.message);
        }
    },

    // Статистика відвідувань сторінки: хто, скільки разів, коли востаннє.
    // RPC — лише admin/superadmin (перевіряється всередині is_admin()).
    async openPageViewStats(id, title) {
        if (!AppState.isAdmin()) return;
        Loader.show();
        let rows;
        try {
            rows = await API.pages.getViewStats(id);
        } catch (e) {
            Loader.hide();
            Toast.error('Помилка', e.message);
            return;
        }
        Loader.hide();
        this._pvsAll = rows;
        this._pvsSearch = '';
        this._pvsTitle = title || '';
        Modal.open({
            title: `<i class="fa-solid fa-chart-simple"></i> Статистика відвідувань`,
            size: 'lg',
            body: this._buildPageViewStatsBody()
        });
    },

    _buildPageViewStatsBody() {
        const q = (this._pvsSearch || '').toLowerCase();
        const rows = (this._pvsAll || []).filter(r =>
            !q || (r.full_name || '').toLowerCase().includes(q) || (r.job_position || '').toLowerCase().includes(q));

        const rowsHtml = rows.length ? rows.map(r => `
            <div style="display:flex;align-items:center;padding:.55rem .25rem;border-bottom:1px solid var(--border);gap:.75rem">
                <div style="flex:1;min-width:0">
                    <div style="font-size:.875rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Fmt.esc(r.full_name || '—')}</div>
                    <div style="font-size:.75rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Fmt.esc([r.job_position, r.city, r.subdivision].filter(Boolean).join(' · ') || '—')}</div>
                </div>
                <span style="font-size:.8rem;color:var(--text-secondary);white-space:nowrap">×${r.views_count}</span>
                <span style="font-size:.8rem;color:var(--text-muted);white-space:nowrap;min-width:110px;text-align:right">${Fmt.datetime(r.last_viewed_at)}</span>
            </div>`).join('')
            : `<div style="padding:1.5rem;text-align:center;color:var(--text-muted)">
                ${(this._pvsAll || []).length ? 'Нічого не знайдено' : 'Ще ніхто не відвідував цю сторінку'}
              </div>`;

        return `
            <div style="display:flex;flex-direction:column;gap:.875rem">
                <div style="font-size:.85rem;color:var(--text-muted)">${Fmt.esc(this._pvsTitle || '')}</div>
                <div class="search-clear-wrap" style="width:100%">
                    <input type="text" placeholder="Пошук за іменем або посадою…" value="${Fmt.esc(this._pvsSearch || '')}"
                        style="width:100%" oninput="CollectionsPage._pvsSetSearch(this.value)">
                    <button type="button" class="search-clear-btn" onclick="UI.clearSearchInput(this)"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div style="display:flex;align-items:center;padding:0 .25rem .4rem;gap:.75rem;border-bottom:1px solid var(--border);color:var(--text-muted);font-size:.72rem;font-weight:600;text-transform:uppercase">
                    <div style="flex:1">Співробітник</div>
                    <span>Переглядів</span>
                    <span style="min-width:110px;text-align:right">Востаннє</span>
                </div>
                <div style="max-height:420px;overflow-y:auto">
                    ${rowsHtml}
                </div>
            </div>`;
    },

    _pvsSetSearch(val) {
        this._pvsSearch = val;
        const body = document.getElementById('modal-body');
        if (body) body.innerHTML = this._buildPageViewStatsBody();
    },

    // Центрована модалка (не глобальний Modal.confirm — той є боковою
    // панеллю на весь екран праворуч, для такого маленького підтвердження
    // це виглядає незручно).
    deletePage(id) {
        document.getElementById('col-delete-confirm')?.remove();
        const el = document.createElement('div');
        el.id = 'col-delete-confirm';
        el.className = 'center-confirm-backdrop';
        el.innerHTML = `
            <div class="center-confirm-box">
                <h3>Видалити сторінку?</h3>
                <p>Всі прикріплені файли також будуть видалені назавжди.</p>
                <div class="center-confirm-actions">
                    <button class="btn btn-ghost" onclick="document.getElementById('col-delete-confirm').remove()">Скасувати</button>
                    <button class="btn btn-danger" onclick="CollectionsPage._submitDeletePage('${id}')">Видалити</button>
                </div>
            </div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    async _submitDeletePage(id) {
        document.getElementById('col-delete-confirm')?.remove();
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
            <button class="adel" data-name="${Fmt.esc(att.file_name)}"
                    onclick="event.stopPropagation();CollectionsPage._deleteAttachment('${att.id}', this.dataset.name)"
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
        // Той самий guard, що й у savePage() — інакше одночасний клік "Зберегти"
        // і прикріплення файлу до ще незбереженої сторінки викликають
        // API.pages.create() паралельно й створюють дві сторінки замість однієї.
        if (this._saving) return;
        // Auto-save first
        const allowed_labels = this._getSelectedLabels();
        const dovIds = this._getSelectedDovIds();
        const fields = {
            title,
            html_content: this._cmHtml ? this._cmHtml.getValue() : (document.getElementById('editor-html')?.value || ''),
            css_content:  this._cmCss  ? this._cmCss.getValue()  : (document.getElementById('editor-css')?.value  || ''),
            is_published: document.getElementById('page-published')?.checked || false,
            search_enabled: document.getElementById('page-search-enabled')?.checked || false,
            network_visibility: document.getElementById('page-network-visibility')?.value || 'all',
            section: document.getElementById('page-section-input')?.value.trim() || null,
            allowed_labels
        };
        this._saving = true;
        const saveBtn = document.getElementById('col-save-btn');
        if (saveBtn) saveBtn.disabled = true;
        Loader.show();
        try {
            const created = await API.pages.create(fields);
            await API.pageDovirenosti.set(created.id, dovIds);
            // col-save-btn/col-save-menu читають id динамічно з _editingPageId — окремо патчити onclick не треба
            this._editingPageId = created.id;
            // Show the "+ Додати" file input instead of the auto-save one
            const placeholder = document.getElementById('col-attach-add');
            if (placeholder) placeholder.outerHTML = `
                <label id="col-attach-add" style="cursor:pointer">
                    <span class="btn btn-ghost btn-sm" style="pointer-events:none">+ Додати</span>
                    <input type="file" multiple style="display:none" onchange="CollectionsPage._onAttachFiles(this)">
                </label>`;
            this._markClean();
            Loader.hide();
            Toast.success('Сторінку створено — завантажуємо файли');
        } catch(e) {
            Loader.hide();
            Toast.error('Помилка збереження', e.message);
            return;
        } finally {
            this._saving = false;
            if (saveBtn) saveBtn.disabled = false;
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

    // Центрована модалка (не глобальний Modal.confirm — той є боковою
    // панеллю на весь екран праворуч, для такого маленького підтвердження
    // це виглядає незручно).
    _deleteAttachment(attId, fileName) {
        document.getElementById('col-delatt-confirm')?.remove();
        const el = document.createElement('div');
        el.id = 'col-delatt-confirm';
        el.className = 'center-confirm-backdrop';
        el.innerHTML = `
            <div class="center-confirm-box">
                <h3>Видалити файл?</h3>
                <p>«${Fmt.esc(fileName || '')}» буде видалено назавжди.</p>
                <div class="center-confirm-actions">
                    <button class="btn btn-ghost" onclick="document.getElementById('col-delatt-confirm').remove()">Скасувати</button>
                    <button class="btn btn-danger" onclick="CollectionsPage._submitDeleteAttachment('${attId}')">Видалити</button>
                </div>
            </div>`;
        document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    },

    async _submitDeleteAttachment(attId) {
        document.getElementById('col-delatt-confirm')?.remove();
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
        const scrollY = window.scrollY;
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
            // CodeMirror зберігає позицію курсора навіть після втрати фокусу
            // (клік по вкладенню в панелі збоку не рухає її) — вставляємо саме туди,
            // а не завжди в кінець документа.
            const pos = doc.getCursor();
            doc.replaceRange(snippet, pos);
            this._cmHtml.focus();
            this._cmHtml.scrollIntoView(null);
            this._markDirty();
            this._updatePreview();
            // CodeMirror's hidden input can pull page scroll to it — restore position
            requestAnimationFrame(() => window.scrollTo(0, scrollY));
        } else {
            const ta = document.getElementById('editor-html');
            if (ta) {
                const { start: s, end: e } = this._getCursor(ta);
                ta.value = ta.value.slice(0, s) + snippet + ta.value.slice(e);
                const newPos = s + snippet.length;
                ta.selectionStart = ta.selectionEnd = newPos;
                this._savedCursor = { ta, start: newPos, end: newPos };
                ta.focus();
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
                .select('id').eq('is_active', true).in('role', ['superadmin', 'admin']);
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
