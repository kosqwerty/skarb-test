// ================================================================
// LMS — Реєстри НПА Товариства
// ================================================================

const RegistryPage = {

    _items:    [],   // registry_items rows
    _docs:     [],   // registry_docs rows (with resource join)
    _sections: [],   // registry_sections rows
    _canManage: false,
    _allDovs:  [],
    _ackMap:   {},            // resourceId -> { at, version }
    _selectedTopics: {},      // { sectionId -> itemId }

    async renderInTab(area) {
        if (!area) return;
        this._canManage = AppState.isAdmin();
        area.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:2rem;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.4rem"></i></div>`;
        try {
            const seeAll = AppState.isAdmin() || AppState.isManager();
            const [items, docs, allSections, allDovs, myDovs] = await Promise.all([
                API.registryItems.getAll(),
                API.registryDocs.getAll(),
                API.registrySections.getAll(),
                API.dovirenosti.getAll().catch(() => []),
                seeAll ? Promise.resolve(null) : API.dovirenosti.getForProfile(AppState.user.id).catch(() => []),
            ]);
            const dovMap = Object.fromEntries(allDovs.map(d => [d.id, d]));
            allSections.forEach(s => { s._dov = s.dovirenost_id ? dovMap[s.dovirenost_id] : null; });

            this._items   = items;
            this._docs    = docs;
            this._allDovs = allDovs;

            if (seeAll || myDovs === null) {
                this._sections = allSections;
            } else {
                const myDovIds = new Set((myDovs || []).map(d => d.id));
                this._sections = allSections.filter(s => !s.dovirenost_id || myDovIds.has(s.dovirenost_id));
            }

            const resIds = docs.map(d => d.resource_id).filter(Boolean);
            this._ackMap = resIds.length
                ? await API.documentDownloads.getMyLatest(resIds).catch(() => ({}))
                : {};
        } catch (e) {
            area.innerHTML = `<div class="callout danger">Помилка завантаження реєстрів: ${Fmt.esc(e.message)}</div>`;
            return;
        }
        this._render(area);

        // Restore open accordions after returning from document view
        const savedSecs = sessionStorage.getItem('rg_open_secs');
        if (savedSecs) {
            try { JSON.parse(savedSecs).forEach(id => document.getElementById(id)?.classList.add('open')); } catch(_) {}
            sessionStorage.removeItem('rg_open_secs');
        }
    },

    // ── Render ──────────────────────────────────────────────────────
    _render(area) {
        const canManage = this._canManage;

        // Ensure a valid topic is selected per section
        this._sections.forEach(sec => {
            const secItems = this._items.filter(i => i.section_id === sec.id);
            const cur = this._selectedTopics[sec.id];
            if (!cur || !secItems.find(i => i.id === cur)) {
                this._selectedTopics[sec.id] = secItems[0]?.id || null;
            }
        });

        const styles = `
        <style>
            .rg-toolbar{display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap}

            /* ── Sections shell ──────────────────────────────────────── */
            .rg-sections{display:flex;flex-direction:column;gap:.85rem;max-width:1400px}
            .rg-sec{border:1px solid var(--border);border-radius:var(--radius-xl);background:var(--bg-surface);overflow:hidden}
            .rg-sec-head{display:flex;align-items:center;gap:.6rem;padding:.7rem 1rem;background:var(--bg-raised);cursor:pointer;user-select:none;border-bottom:1px solid transparent;transition:border-color .15s,background .15s}
            .rg-sec-head:hover{background:var(--bg-hover)}
            .rg-sec.open .rg-sec-head{border-bottom-color:var(--border)}
            .rg-sec-chevron{font-size:.9rem;color:var(--text-muted);transition:transform .2s;flex-shrink:0}
            .rg-sec.open .rg-sec-chevron{transform:rotate(90deg)}
            .rg-sec-icon{width:38px;height:38px;border-radius:10px;background:rgba(99,102,241,.12);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0}
            .rg-sec-title{font-size:.95rem;font-weight:700;color:var(--text-primary);flex:1;min-width:0}
            .rg-sec-dov-badge{font-size:.68rem;color:var(--text-muted);background:var(--bg-base);border:1px solid var(--border);border-radius:20px;padding:.1rem .45rem;flex-shrink:0;white-space:nowrap}
            .rg-sec-actions{display:flex;gap:.25rem;flex-shrink:0;opacity:0;transition:opacity .15s}
            .rg-sec:hover .rg-sec-actions{opacity:1}
            .rg-sec-body{display:none;flex-direction:column}
            .rg-sec.open .rg-sec-body{display:flex}

            /* ── Description ────────────────────────────────────────── */
            .rg-sec-desc-wrap{padding:.7rem 1.1rem;border-bottom:1px solid var(--border);background:linear-gradient(135deg,rgba(99,102,241,.04) 0%,rgba(99,102,241,.01) 100%)}
            .rg-sec-desc-input{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:var(--radius-md);padding:.5rem .75rem;font-size:.84rem;color:var(--text-primary);background:var(--bg-raised);resize:vertical;min-height:56px;font-family:inherit;line-height:1.5;outline:none;transition:border-color .15s}
            .rg-sec-desc-input:focus{border-color:var(--primary)}
            .rg-sec-desc-text{margin:0;font-size:.92rem;color:var(--primary);line-height:1.65;white-space:pre-wrap;font-style:italic;padding:.1rem 0 .1rem .85rem;border-left:3px solid rgba(99,102,241,.35)}

            /* ── Split layout ───────────────────────────────────────── */
            .rg-split{display:flex;min-height:200px}
            .rg-split-sidebar{width:260px;flex-shrink:0;border-right:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto;max-height:560px}
            .rg-split-content{flex:1;min-width:0;overflow-y:auto;max-height:560px}

            /* ── Sidebar topic buttons ──────────────────────────────── */
            .rg-topic-btn{display:flex;align-items:flex-start;gap:.5rem;padding:.65rem .9rem;cursor:pointer;border:none;background:transparent;text-align:left;color:var(--text-primary);border-bottom:1px solid var(--border);font-family:inherit;font-size:.84rem;line-height:1.4;width:100%;transition:background .12s;position:relative}
            .rg-topic-btn:last-of-type{border-bottom:none}
            .rg-topic-btn:hover{background:var(--bg-raised)}
            .rg-topic-btn.active{background:rgba(99,102,241,.08);color:var(--primary)}
            .rg-tbtn-num{width:20px;height:20px;border-radius:6px;flex-shrink:0;background:var(--bg-raised);color:var(--text-muted);display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:800;margin-top:.1rem;transition:all .12s;border:1px solid var(--border)}
            .rg-topic-btn.active .rg-tbtn-num{background:var(--primary);color:#fff;border-color:var(--primary)}
            .rg-tbtn-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:.3rem}
            .rg-tbtn-name{font-weight:500;line-height:1.4}
            .rg-topic-btn.active .rg-tbtn-name{font-weight:700}
            .rg-tbtn-dots{display:flex;gap:3px;flex-shrink:0;margin-top:.3rem}
            .rg-tbtn-dot{width:7px;height:7px;border-radius:50%}
            .rg-tdot-unread{background:#ef4444;animation:rg-pulse 1.4s ease-in-out infinite}
            .rg-tdot-read{background:#10b981}
            .rg-tdot-empty{background:var(--border)}
            .rg-tbtn-actions{display:flex;gap:2px;opacity:0;transition:opacity .15s}
            .rg-topic-btn:hover .rg-tbtn-actions{opacity:1}
            .rg-split-add-topic{padding:.5rem .75rem;border-top:1px solid var(--border);margin-top:auto}
            .rg-add-topic-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:.4rem;font-size:.78rem;color:var(--text-muted);cursor:pointer;padding:.45rem .5rem;border-radius:var(--radius-sm);border:1px dashed var(--border);background:transparent;transition:all .15s;font-family:inherit}
            .rg-add-topic-btn:hover{border-color:var(--primary);color:var(--primary);background:rgba(99,102,241,.05)}
            .rg-split-empty-topics{padding:1.5rem 1rem;text-align:center;color:var(--text-muted);font-size:.8rem;font-style:italic}
            .rg-split-no-topic{display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:.85rem;padding:2rem;font-style:italic}

            /* ── Doc columns in content ─────────────────────────────── */
            .rg-doc-cols{display:grid;grid-template-columns:1fr 1fr;height:100%}
            .rg-doc-col-area{padding:1rem 1.1rem;display:flex;flex-direction:column;gap:.45rem}
            .rg-doc-col-area:first-child{border-right:1px solid var(--border)}
            .rg-col-header{display:flex;align-items:center;gap:.45rem;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);padding-bottom:.55rem;border-bottom:1px solid var(--border);margin-bottom:.1rem}
            .rg-col-add-btn{margin-left:auto;display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .55rem;border-radius:5px;border:1px dashed var(--border);background:transparent;color:var(--text-muted);cursor:pointer;font-size:.7rem;font-weight:600;transition:all .15s;font-family:inherit;flex-shrink:0;white-space:nowrap}
            .rg-col-add-btn:hover{border-color:var(--primary);color:var(--primary);background:rgba(99,102,241,.05)}
            .rg-col-empty{color:var(--text-muted);font-size:.8rem;font-style:italic;padding:.35rem .1rem}
            .rg-doc-card{border:1px solid var(--border);border-radius:8px;padding:.6rem .8rem;cursor:pointer;transition:border-color .13s,background .13s;background:var(--bg-raised);display:flex;align-items:flex-start;gap:.5rem}
            .rg-doc-card:hover{border-color:var(--primary);background:rgba(99,102,241,.06)}
            .rg-doc-card-left{display:flex;flex-direction:column;align-items:center;gap:.3rem;flex-shrink:0;margin-top:.15rem}
            .rg-doc-card-num{font-size:.68rem;color:var(--text-muted);font-weight:700}
            .rg-doc-card-body{flex:1;min-width:0}
            .rg-doc-card-title{font-size:.84rem;color:var(--primary);font-weight:600;line-height:1.4;word-break:break-word}
            .rg-doc-card:hover .rg-doc-card-title{text-decoration:underline}
            .rg-doc-card-desc{font-size:.76rem;color:var(--text-muted);margin-top:.2rem;line-height:1.4;word-break:break-word}
            .rg-doc-card-actions{display:flex;flex-direction:column;gap:2px;flex-shrink:0;opacity:0;transition:opacity .15s}
            .rg-doc-card:hover .rg-doc-card-actions{opacity:1}

            /* ── Shared buttons ─────────────────────────────────────── */
            .rg-ta-btn{width:22px;height:22px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.65rem;transition:all .15s;font-family:inherit}
            .rg-ta-btn:hover{border-color:var(--primary);color:var(--primary)}
            .rg-ta-btn.danger:hover{border-color:#ef4444;color:#ef4444}
            .rg-ta-btn:disabled{opacity:.25;cursor:default;pointer-events:none}
            .rg-doc-del{width:18px;height:18px;border-radius:4px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.6rem;transition:color .15s;font-family:inherit}
            .rg-doc-del:hover{color:#ef4444}
            .rg-doc-card-actions .rg-ta-btn{width:18px;height:18px;font-size:.55rem}

            /* ── Ack dots ────────────────────────────────────────────── */
            .rg-ack-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;display:inline-block}
            .rg-ack-dot.rg-unread{background:#ef4444;box-shadow:0 0 0 0 rgba(239,68,68,.6);animation:rg-pulse 1.4s ease-in-out infinite}
            .rg-ack-dot.rg-read{background:#10b981}
            @keyframes rg-pulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.6)}70%{box-shadow:0 0 0 5px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}

            /* ── Empty / misc ────────────────────────────────────────── */
            .rg-sections-empty{text-align:center;padding:2rem 1rem;color:var(--text-muted);font-size:.85rem;border:1px dashed var(--border);border-radius:var(--radius-xl)}
        </style>`;

        let sectionsHtml = '';
        if (this._sections.length) {
            sectionsHtml = `<div class="rg-sections" id="rg-sections-list">` +
                this._sections.map(sec => {
                    const secItems = this._items.filter(i => i.section_id === sec.id);
                    const dovName  = sec._dov?.name;

                    const sidebarItems = secItems.map((item, idx) =>
                        this._buildTopicBtn(item, idx, sec.id, secItems, canManage)
                    ).join('');

                    return `
                    <div class="rg-sec" id="rg-sec-${sec.id}">
                        <div class="rg-sec-head" onclick="RegistryPage._toggleSec('${sec.id}')">
                            <i class="fa-solid fa-chevron-right rg-sec-chevron"></i>
                            <div class="rg-sec-icon"><i class="fa-solid fa-folder-open"></i></div>
                            <span class="rg-sec-title">${Fmt.esc(sec.title)}</span>
                            ${dovName ? `<span class="rg-sec-dov-badge"><i class="fa-solid fa-lock" style="font-size:.6rem;margin-right:.3rem"></i>Доступ тільки для: ${Fmt.esc(dovName)}</span>` : ''}
                            ${canManage ? `
                            <div class="rg-sec-actions" onclick="event.stopPropagation()">
                                <button class="rg-ta-btn" title="Редагувати" onclick="RegistryPage._editSection('${sec.id}',${JSON.stringify(sec.title).replace(/"/g,'&quot;')},${JSON.stringify(sec.dovirenost_id||'').replace(/"/g,'&quot;')})"><i class="fa-solid fa-pen"></i></button>
                                <button class="rg-ta-btn" title="Вгору" onclick="RegistryPage._moveSection('${sec.id}',-1)"><i class="fa-solid fa-arrow-up"></i></button>
                                <button class="rg-ta-btn" title="Вниз" onclick="RegistryPage._moveSection('${sec.id}',1)"><i class="fa-solid fa-arrow-down"></i></button>
                                <button class="rg-ta-btn danger" title="Видалити розділ" onclick="RegistryPage._deleteSection('${sec.id}',${JSON.stringify(sec.title).replace(/"/g,'&quot;')})"><i class="fa-solid fa-trash"></i></button>
                            </div>` : ''}
                        </div>
                        <div class="rg-sec-body">
                            ${sec.description || canManage ? `
                            <div class="rg-sec-desc-wrap">
                                ${canManage
                                    ? `<textarea class="rg-sec-desc-input" id="rg-desc-${sec.id}"
                                            placeholder="Опис розділу (необов'язково)..."
                                            onblur="RegistryPage._saveSecDesc('${sec.id}',this.value)"
                                        >${Fmt.esc(sec.description || '')}</textarea>`
                                    : (sec.description ? `<p class="rg-sec-desc-text">${Fmt.esc(sec.description)}</p>` : '')}
                            </div>` : ''}
                            <div class="rg-split">
                                <div class="rg-split-sidebar">
                                    ${sidebarItems || `<div class="rg-split-empty-topics">Тем ще немає</div>`}
                                    ${canManage ? `
                                    <div class="rg-split-add-topic">
                                        <button class="rg-add-topic-btn" onclick="RegistryPage._addTopicToSection('${sec.id}')">
                                            <i class="fa-solid fa-plus"></i> Додати тему
                                        </button>
                                    </div>` : ''}
                                </div>
                                <div class="rg-split-content" id="rg-split-${sec.id}">
                                    ${this._buildDocContent(sec.id, canManage)}
                                </div>
                            </div>
                        </div>
                    </div>`;
                }).join('') +
            `</div>`;
        } else {
            sectionsHtml = canManage
                ? `<div class="rg-sections-empty"><i class="fa-solid fa-layer-group" style="font-size:1.8rem;opacity:.3;display:block;margin-bottom:.6rem"></i>Розділи відсутні — натисніть «Додати розділ»</div>`
                : '';
        }

        area.innerHTML = `${styles}
        ${canManage ? `<div class="rg-toolbar">
            <button class="btn btn-primary btn-sm" onclick="RegistryPage._addSection()"><i class="fa-solid fa-layer-group"></i> Додати розділ</button>
        </div>` : ''}
        ${sectionsHtml}`;
    },

    // ── Build sidebar topic button ────────────────────────────────────
    _buildTopicBtn(item, idx, secId, secItems, canManage) {
        const isSelected = this._selectedTopics[secId] === item.id;
        const orders = this._docs.filter(d => d.registry_item_id === item.id && d.type === 'order');
        const disps  = this._docs.filter(d => d.registry_item_id === item.id && d.type === 'disposition');

        const orderUnread = orders.filter(d => d.resource_id && !this._ackMap[d.resource_id]).length;
        const dispUnread  = disps.filter(d  => d.resource_id && !this._ackMap[d.resource_id]).length;

        const orderDot = orders.length
            ? `<span class="rg-tbtn-dot ${orderUnread > 0 ? 'rg-tdot-unread' : 'rg-tdot-read'}" title="Накази: ${orders.length}"></span>`
            : `<span class="rg-tbtn-dot rg-tdot-empty" title="Накази: 0"></span>`;
        const dispDot = disps.length
            ? `<span class="rg-tbtn-dot ${dispUnread > 0 ? 'rg-tdot-unread' : 'rg-tdot-read'}" title="Розпорядження: ${disps.length}"></span>`
            : `<span class="rg-tbtn-dot rg-tdot-empty" title="Розпорядження: 0"></span>`;

        const isFirst = idx === 0;
        const isLast  = idx === secItems.length - 1;

        return `
        <div class="rg-topic-btn${isSelected ? ' active' : ''}" id="rg-tbtn-${item.id}"
             onclick="RegistryPage._selectTopic('${secId}','${item.id}')">
            <span class="rg-tbtn-num">${idx + 1}</span>
            <div class="rg-tbtn-body">
                <span class="rg-tbtn-name">${Fmt.esc(item.topic)}</span>
                ${canManage ? `
                <div class="rg-tbtn-actions" onclick="event.stopPropagation()">
                    <button class="rg-ta-btn" title="Редагувати" onclick="RegistryPage._editTopic('${item.id}',${JSON.stringify(item.topic).replace(/"/g,'&quot;')})"><i class="fa-solid fa-pen"></i></button>
                    <button class="rg-ta-btn" title="Вгору" ${isFirst ? 'disabled' : ''} onclick="RegistryPage._moveTopic('${item.id}',-1)"><i class="fa-solid fa-arrow-up"></i></button>
                    <button class="rg-ta-btn" title="Вниз" ${isLast ? 'disabled' : ''} onclick="RegistryPage._moveTopic('${item.id}',1)"><i class="fa-solid fa-arrow-down"></i></button>
                    <button class="rg-ta-btn danger" title="Видалити" onclick="RegistryPage._deleteTopic('${item.id}',${JSON.stringify(item.topic).replace(/"/g,'&quot;')})"><i class="fa-solid fa-trash"></i></button>
                </div>` : ''}
            </div>
            <div class="rg-tbtn-dots">${orderDot}${dispDot}</div>
        </div>`;
    },

    // ── Build doc columns for selected topic ──────────────────────────
    _buildDocContent(secId, canManage) {
        const itemId = this._selectedTopics[secId];
        if (!itemId) {
            return `<div class="rg-split-no-topic"><i class="fa-solid fa-arrow-left" style="margin-right:.4rem;opacity:.5"></i>Оберіть тему зліва</div>`;
        }

        const orders = this._docs.filter(d => d.registry_item_id === itemId && d.type === 'order');
        const disps  = this._docs.filter(d => d.registry_item_id === itemId && d.type === 'disposition');

        const renderCards = (list, type) => {
            if (!list.length) return `<div class="rg-col-empty">— відсутні —</div>`;
            return list.map((d, i) => {
                const acked  = !!this._ackMap[d.resource_id];
                const isFirst = i === 0;
                const isLast  = i === list.length - 1;
                const desc = d.resource?.description?.trim();
                return `
                <div class="rg-doc-card" onclick="RegistryPage._openDoc('${d.resource_id}')">
                    <div class="rg-doc-card-left">
                        <span class="rg-doc-card-num">${i + 1}</span>
                        <span class="rg-ack-dot ${acked ? 'rg-read' : 'rg-unread'}" title="${acked ? 'Ознайомлено' : 'Не ознайомлено'}"></span>
                    </div>
                    <div class="rg-doc-card-body">
                        <div class="rg-doc-card-title">${Fmt.esc(d.resource?.title || '—')}</div>
                        ${desc ? `<div class="rg-doc-card-desc">${Fmt.esc(desc)}</div>` : ''}
                    </div>
                    ${canManage ? `
                    <div class="rg-doc-card-actions" onclick="event.stopPropagation()">
                        <button class="rg-ta-btn" title="Вгору" ${isFirst ? 'disabled' : ''} onclick="RegistryPage._moveDoc('${d.id}','${itemId}','${type}',-1)"><i class="fa-solid fa-arrow-up"></i></button>
                        <button class="rg-ta-btn" title="Вниз" ${isLast ? 'disabled' : ''} onclick="RegistryPage._moveDoc('${d.id}','${itemId}','${type}',1)"><i class="fa-solid fa-arrow-down"></i></button>
                        <button class="rg-doc-del" title="Видалити" onclick="RegistryPage._removeDoc('${d.id}')"><i class="fa-solid fa-xmark"></i></button>
                    </div>` : ''}
                </div>`;
            }).join('');
        };

        return `
        <div class="rg-doc-cols">
            <div class="rg-doc-col-area">
                <div class="rg-col-header">
                    <i class="fa-solid fa-gavel" style="color:#6366f1;font-size:1.1rem"></i> Накази
                    ${canManage ? `<button class="rg-col-add-btn" onclick="RegistryPage._addDoc('${itemId}','order')"><i class="fa-solid fa-plus"></i> Додати наказ</button>` : ''}
                </div>
                ${renderCards(orders, 'order')}
            </div>
            <div class="rg-doc-col-area">
                <div class="rg-col-header">
                    <i class="fa-solid fa-file-contract" style="color:#f59e0b;font-size:1.1rem"></i> Розпорядження
                    ${canManage ? `<button class="rg-col-add-btn" onclick="RegistryPage._addDoc('${itemId}','disposition')"><i class="fa-solid fa-plus"></i> Додати розпорядження</button>` : ''}
                </div>
                ${renderCards(disps, 'disposition')}
            </div>
        </div>`;
    },

    // ── Select topic in split panel ───────────────────────────────────
    _selectTopic(secId, itemId) {
        this._selectedTopics[secId] = itemId;
        const sec = document.getElementById(`rg-sec-${secId}`);
        if (sec) {
            sec.querySelectorAll('.rg-topic-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(`rg-tbtn-${itemId}`)?.classList.add('active');
        }
        const content = document.getElementById(`rg-split-${secId}`);
        if (content) content.innerHTML = this._buildDocContent(secId, this._canManage);
    },

    // ── Toggle accordion ──────────────────────────────────────────────
    _toggleSec(id) {
        const el = document.getElementById(`rg-sec-${id}`);
        if (el) el.classList.toggle('open');
    },

    // ── Open doc (saves accordion state for back-navigation) ──────────
    _openDoc(resourceId) {
        const openSecs = [...document.querySelectorAll('.rg-sec.open')].map(el => el.id);
        if (openSecs.length) sessionStorage.setItem('rg_open_secs', JSON.stringify(openSecs));
        API.documentDownloads.track(resourceId).catch(() => {});
        Router.go(`resource/${resourceId}?from=documents&tab=registry`);
    },

    async _saveSecDesc(id, value) {
        const desc = value.trim() || null;
        const sec = this._sections.find(s => s.id === id);
        if (!sec || sec.description === desc) return;
        sec.description = desc;
        try {
            await API.registrySections.update(id, { description: desc });
        } catch (e) {
            Toast.error('Помилка', e.message);
        }
    },

    // ── Rerender — preserves open sections + selected topics ──────────
    _rerender() {
        const area = document.getElementById('rg-tab-area');
        if (!area) return;
        const openSecs = new Set([...document.querySelectorAll('.rg-sec.open')].map(el => el.id));
        this._render(area);
        openSecs.forEach(id => document.getElementById(id)?.classList.add('open'));
    },

    // ── Topic CRUD ────────────────────────────────────────────────────
    _addTopic() { this._openTopicModal(null, null, null); },
    _addTopicToSection(sectionId) { this._openTopicModal(null, null, sectionId); },

    _openTopicModal(id, currentTopic, sectionId) {
        const isEdit = !!id;
        Modal.open({
            title: isEdit ? 'Редагувати тему' : 'Нова тема',
            body: `<style>
                .rg-topic-modal{display:flex;flex-direction:column;gap:.5rem}
                .rg-topic-modal label{font-size:.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:.4rem}
                .rg-topic-modal input{width:100%;padding:.65rem .9rem;border-radius:var(--radius-lg);border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.92rem;outline:none;transition:border-color .15s,box-shadow .15s;box-sizing:border-box;font-family:inherit;margin-top:.4rem}
                .rg-topic-modal input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(99,102,241,.12);background:var(--bg-surface)}
                .rg-topic-modal input::placeholder{color:var(--text-muted);font-size:.88rem}
            </style>
            <div class="rg-topic-modal">
                <label><i class="fa-solid fa-heading" style="color:var(--primary)"></i> Назва теми</label>
                <input id="rg-topic-inp" ${isEdit ? `value="${Fmt.esc(currentTopic)}"` : `placeholder="Наприклад: Кадрові питання"`} maxlength="200">
            </div>`,
            footer: `<button class="btn btn-ghost" onclick="Modal.close()">Скасувати</button>
                     <button class="btn btn-primary" onclick="${isEdit ? `RegistryPage._updateTopic('${id}')` : `RegistryPage._saveTopic(${sectionId ? `'${sectionId}'` : 'null'})`}">Зберегти</button>`,
        });
        setTimeout(() => {
            const inp = document.getElementById('rg-topic-inp');
            if (inp) { inp.focus(); if (isEdit) inp.select(); }
        }, 100);
    },

    async _saveTopic(sectionId = null) {
        const inp = document.getElementById('rg-topic-inp');
        const topic = inp?.value.trim();
        if (!topic) { Toast.warning('Введіть назву теми'); return; }
        try {
            Loader.show();
            const maxOrder = this._items.reduce((m, i) => Math.max(m, i.order_index), -1);
            const fields = { topic, order_index: maxOrder + 1 };
            if (sectionId) fields.section_id = sectionId;
            const item = await API.registryItems.create(fields);
            this._items.push(item);
            // Auto-select new topic
            if (sectionId) this._selectedTopics[sectionId] = item.id;
            Modal.close();
            Toast.success('Тему додано');
            this._rerender();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    _editTopic(id, currentTopic) { this._openTopicModal(id, currentTopic, null); },

    async _updateTopic(id) {
        const inp = document.getElementById('rg-topic-inp');
        const topic = inp?.value.trim();
        if (!topic) { Toast.warning('Введіть назву теми'); return; }
        try {
            Loader.show();
            await API.registryItems.update(id, { topic });
            const item = this._items.find(i => i.id === id);
            if (item) item.topic = topic;
            Modal.close();
            Toast.success('Тему оновлено');
            this._rerender();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    async _deleteTopic(id, topic) {
        const ok = await Modal.confirm({ title: 'Видалити тему?', message: `Тема "${topic}" та всі прив'язані документи будуть видалені з реєстру.`, confirmText: 'Видалити', danger: true });
        if (!ok) return;
        try {
            Loader.show();
            await API.registryItems.remove(id);
            // If this topic was selected, clear selection
            const item = this._items.find(i => i.id === id);
            if (item?.section_id && this._selectedTopics[item.section_id] === id) {
                delete this._selectedTopics[item.section_id];
            }
            this._items = this._items.filter(i => i.id !== id);
            this._docs  = this._docs.filter(d => d.registry_item_id !== id);
            Toast.success('Тему видалено');
            this._rerender();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    async _moveTopic(id, dir) {
        const idx = this._items.findIndex(i => i.id === id);
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= this._items.length) return;
        [this._items[idx], this._items[swapIdx]] = [this._items[swapIdx], this._items[idx]];
        this._rerender();
        try {
            await API.registryItems.reorder(this._items.map(i => i.id));
        } catch (e) {
            Toast.error('Помилка збереження порядку', e.message);
        }
    },

    async _moveDoc(id, itemId, type, dir) {
        const list = this._docs.filter(d => d.registry_item_id === itemId && d.type === type);
        const idx  = list.findIndex(d => d.id === id);
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= list.length) return;
        const a = this._docs.indexOf(list[idx]);
        const b = this._docs.indexOf(list[swapIdx]);
        [this._docs[a], this._docs[b]] = [this._docs[b], this._docs[a]];
        // Only update the content pane, not full rerender
        const secId = this._sections.find(s => this._items.find(i => i.id === itemId && i.section_id === s.id))?.id;
        if (secId) {
            const content = document.getElementById(`rg-split-${secId}`);
            if (content) content.innerHTML = this._buildDocContent(secId, this._canManage);
        }
        try {
            const sameType = this._docs.filter(d => d.registry_item_id === itemId && d.type === type);
            await API.registryDocs.reorder(sameType.map(d => d.id));
        } catch (e) {
            Toast.error('Помилка збереження порядку', e.message);
        }
    },

    // ── Add doc to topic ──────────────────────────────────────────────
    async _addDoc(itemId, type) {
        let resources = [];
        try {
            Loader.show();
            const { data } = await supabase.from('resources')
                .select('id, title, type, description, resource_dovirenosti(dovirenosti(id,name))')
                .is('deleted_at', null)
                .is('display_block', null)
                .is('red_folder_item_id', null)
                .is('course_id', null)
                .eq('type', 'pdf')
                .order('title');
            resources = (data || []).map(r => ({
                ...r,
                _dovNames: (r.resource_dovirenosti || []).map(rd => rd.dovirenosti?.name).filter(Boolean)
            }));
        } catch (_) {} finally { Loader.hide(); }

        if (!resources.length) {
            Toast.warning('Немає документів', 'Спочатку додайте документи у розділ "Документи"');
            return;
        }

        this._docPickerList = resources;
        this._docPickerSelected = null;

        const typeLabel = type === 'order' ? 'наказ' : 'розпорядження';
        this._openDocPicker(`Додати ${typeLabel}`, `RegistryPage._saveDoc('${itemId}','${type}')`);
    },

    async _saveDoc(itemId, type) {
        const sel = document.getElementById('rg-doc-sel');
        const resourceId = sel?.value;
        if (!resourceId) { Toast.warning('Оберіть документ'); return; }

        const existing = this._docs.find(d => d.registry_item_id === itemId && d.type === type && d.resource_id === resourceId);
        if (existing) { Toast.warning('Цей документ вже є в списку'); return; }

        const sameType = this._docs.filter(d => d.registry_item_id === itemId && d.type === type);
        try {
            Loader.show();
            const doc = await API.registryDocs.add({
                registry_item_id: itemId, type,
                resource_id: resourceId,
                order_index: sameType.length,
            });
            doc.resource = { id: resourceId, title: this._docPickerSelected?.title || resourceId, description: this._docPickerSelected?.description || null };
            this._docs.push(doc);
            Modal.close();
            Toast.success('Документ додано');
            this._rerender();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    async _removeDoc(id) {
        const doc = this._docs.find(d => d.id === id);
        const ok = await Modal.confirm({ message: `Видалити "${doc?.resource?.title || 'документ'}" з реєстру?`, confirmText: 'Видалити', danger: true });
        if (!ok) return;
        try {
            Loader.show();
            await API.registryDocs.remove(id);
            this._docs = this._docs.filter(d => d.id !== id);
            Toast.success('Документ видалено з реєстру');
            this._rerender();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    // ── Section CRUD ──────────────────────────────────────────────────
    async _addSection() {
        const dovList = this._allDovs?.length ? this._allDovs : await API.dovirenosti.getAll().catch(() => []);
        const dovOptions = `<option value="">— Всім —</option>` +
            dovList.map(d => `<option value="${d.id}">${Fmt.esc(d.name)}</option>`).join('');
        Modal.open({
            title: 'Новий розділ',
            body: `<style>
                .rg-sec-modal{display:flex;flex-direction:column;gap:1.1rem}
                .rg-sec-modal .rg-field label{font-size:.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:.4rem;margin-bottom:.45rem}
                .rg-sec-modal .rg-field input,.rg-sec-modal .rg-field select{width:100%;padding:.6rem .85rem;border-radius:var(--radius-lg);border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.9rem;outline:none;transition:border-color .15s,box-shadow .15s;box-sizing:border-box;font-family:inherit}
                .rg-sec-modal .rg-field input:focus,.rg-sec-modal .rg-field select:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(99,102,241,.12);background:var(--bg-surface)}
                .rg-sec-modal .rg-dov-hint{font-size:.74rem;color:var(--text-muted);margin-top:.35rem;display:flex;align-items:center;gap:.35rem}
            </style>
            <div class="rg-sec-modal">
                <div class="rg-field">
                    <label><i class="fa-solid fa-folder-open" style="color:var(--primary)"></i> Назва розділу</label>
                    <input id="rg-sec-inp" placeholder="Наприклад: Охорона праці" maxlength="200">
                </div>
                <div class="rg-field">
                    <label><i class="fa-solid fa-tag" style="color:#f59e0b"></i> Доступ по ТОВ</label>
                    <select id="rg-sec-dov-sel">${dovOptions}</select>
                    <div class="rg-dov-hint"><i class="fa-solid fa-circle-info" style="font-size:.7rem;opacity:.5"></i> «Всім» — розділ видно всім співробітникам</div>
                </div>
            </div>`,
            footer: `<button class="btn btn-ghost" onclick="Modal.close()">Скасувати</button>
                     <button class="btn btn-primary" onclick="RegistryPage._saveSection()">Зберегти</button>`,
        });
        setTimeout(() => document.getElementById('rg-sec-inp')?.focus(), 100);
    },

    async _saveSection() {
        const inp   = document.getElementById('rg-sec-inp');
        const dovEl = document.getElementById('rg-sec-dov-sel');
        const title        = inp?.value.trim();
        const dovirenostId = dovEl?.value || null;
        if (!title) { Toast.warning('Введіть назву розділу'); return; }
        try {
            Loader.show();
            const maxOrder = this._sections.reduce((m, s) => Math.max(m, s.order_index), -1);
            const sec = await API.registrySections.create({ title, dovirenost_id: dovirenostId || undefined, order_index: maxOrder + 1 });
            sec._dov = dovirenostId ? (this._allDovs || []).find(d => d.id === dovirenostId) : null;
            this._sections.push(sec);
            Modal.close();
            Toast.success('Розділ створено');
            this._rerender();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    async _editSection(id, currentTitle, currentDovId = '') {
        const dovList = this._allDovs?.length ? this._allDovs : await API.dovirenosti.getAll().catch(() => []);
        const dovOptions = `<option value="">— Всім —</option>` +
            dovList.map(d => `<option value="${d.id}"${d.id === currentDovId ? ' selected' : ''}>${Fmt.esc(d.name)}</option>`).join('');
        Modal.open({
            title: 'Редагувати розділ',
            body: `<style>
                .rg-sec-modal{display:flex;flex-direction:column;gap:1.1rem}
                .rg-sec-modal .rg-field label{font-size:.78rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:.4rem;margin-bottom:.45rem}
                .rg-sec-modal .rg-field input,.rg-sec-modal .rg-field select{width:100%;padding:.6rem .85rem;border-radius:var(--radius-lg);border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.9rem;outline:none;transition:border-color .15s,box-shadow .15s;box-sizing:border-box;font-family:inherit}
                .rg-sec-modal .rg-field input:focus,.rg-sec-modal .rg-field select:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(99,102,241,.12);background:var(--bg-surface)}
                .rg-sec-modal .rg-dov-hint{font-size:.74rem;color:var(--text-muted);margin-top:.35rem;display:flex;align-items:center;gap:.35rem}
            </style>
            <div class="rg-sec-modal">
                <div class="rg-field">
                    <label><i class="fa-solid fa-folder-open" style="color:var(--primary)"></i> Назва розділу</label>
                    <input id="rg-sec-inp" value="${Fmt.esc(currentTitle)}" maxlength="200">
                </div>
                <div class="rg-field">
                    <label><i class="fa-solid fa-tag" style="color:#f59e0b"></i> Доступ по ТОВ</label>
                    <select id="rg-sec-dov-sel">${dovOptions}</select>
                    <div class="rg-dov-hint"><i class="fa-solid fa-circle-info" style="font-size:.7rem;opacity:.5"></i> «Всім» — розділ видно всім співробітникам</div>
                </div>
            </div>`,
            footer: `<button class="btn btn-ghost" onclick="Modal.close()">Скасувати</button>
                     <button class="btn btn-primary" onclick="RegistryPage._updateSection('${id}')">Зберегти</button>`,
        });
        setTimeout(() => {
            const inp = document.getElementById('rg-sec-inp');
            if (inp) { inp.focus(); inp.select(); }
        }, 100);
    },

    async _updateSection(id) {
        const inp   = document.getElementById('rg-sec-inp');
        const dovEl = document.getElementById('rg-sec-dov-sel');
        const title        = inp?.value.trim();
        const dovirenostId = dovEl?.value || null;
        if (!title) { Toast.warning('Введіть назву розділу'); return; }
        try {
            Loader.show();
            await API.registrySections.update(id, { title, dovirenost_id: dovirenostId || null });
            const sec = this._sections.find(s => s.id === id);
            if (sec) {
                sec.title = title;
                sec.dovirenost_id = dovirenostId;
                sec._dov = dovirenostId ? (this._allDovs || []).find(d => d.id === dovirenostId) : null;
            }
            Modal.close();
            Toast.success('Розділ оновлено');
            this._rerender();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    async _deleteSection(id, title) {
        const ok = await Modal.confirm({ title: 'Видалити розділ?', message: `Розділ "${title}" буде видалено. Теми переміщуються до загального списку.`, confirmText: 'Видалити', danger: true });
        if (!ok) return;
        try {
            Loader.show();
            await API.registrySections.remove(id);
            this._items.forEach(i => { if (i.section_id === id) i.section_id = null; });
            this._sections = this._sections.filter(s => s.id !== id);
            delete this._selectedTopics[id];
            Toast.success('Розділ видалено');
            this._rerender();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    async _moveSection(id, dir) {
        const idx = this._sections.findIndex(s => s.id === id);
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= this._sections.length) return;
        [this._sections[idx], this._sections[swapIdx]] = [this._sections[swapIdx], this._sections[idx]];
        this._rerender();
        try {
            await API.registrySections.reorder(this._sections.map(s => s.id));
        } catch (e) {
            Toast.error('Помилка збереження порядку', e.message);
        }
    },

    // ── Doc picker modal ──────────────────────────────────────────────
    _openDocPicker(title, saveCall) {
        Modal.open({
            title,
            size: 'lg',
            body: `<style>
                .rg-picker-wrap{display:flex;flex-direction:column;gap:.85rem}
                .rg-picker-search-box{position:relative}
                .rg-picker-search-box input{width:100%;height:44px;padding:0 2.5rem 0 2.75rem;border-radius:var(--radius-lg);border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.9rem;outline:none;transition:border-color .15s,box-shadow .15s;box-sizing:border-box;font-family:inherit}
                .rg-picker-search-box input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(99,102,241,.12);background:var(--bg-surface)}
                .rg-picker-search-box input::placeholder{color:var(--text-muted)}
                .rg-picker-search-icon{position:absolute;left:.85rem;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:.85rem;pointer-events:none}
                .rg-picker-clear{position:absolute;right:.75rem;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:.8rem;padding:.2rem;display:none;transition:color .15s;font-family:inherit}
                .rg-picker-clear:hover{color:var(--text-primary)}
                .rg-picker-list{border:1px solid var(--border);border-radius:var(--radius-lg);max-height:280px;overflow-y:auto;background:var(--bg-surface);scrollbar-width:thin}
                .rg-picker-list::-webkit-scrollbar{width:4px}
                .rg-picker-list::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
                .rg-picker-item{padding:.6rem 1rem;cursor:pointer;font-size:.84rem;border-bottom:1px solid var(--border);color:var(--text-primary);line-height:1.4;transition:background .1s;display:flex;align-items:center;gap:.6rem}
                .rg-picker-item:last-child{border-bottom:none}
                .rg-picker-item:hover,.rg-picker-item.active{background:rgba(99,102,241,.07);color:var(--primary)}
                .rg-picker-item.active{font-weight:600}
                .rg-picker-item-icon{width:28px;height:28px;border-radius:7px;background:rgba(99,102,241,.1);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:.75rem;flex-shrink:0}
                .rg-picker-item.active .rg-picker-item-icon{background:rgba(99,102,241,.18)}
                .rg-picker-item-check{margin-left:auto;color:var(--primary);font-size:.8rem;opacity:0}
                .rg-picker-item.active .rg-picker-item-check{opacity:1}
                .rg-picker-chosen{display:none;align-items:center;gap:.6rem;padding:.6rem .9rem;border-radius:var(--radius-md);background:rgba(99,102,241,.07);border:1px solid rgba(99,102,241,.2)}
                .rg-picker-chosen.show{display:flex}
                .rg-picker-chosen-icon{width:28px;height:28px;border-radius:7px;background:rgba(99,102,241,.15);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0}
                .rg-picker-chosen-text{font-size:.83rem;font-weight:600;color:var(--primary);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
                .rg-picker-count{font-size:.72rem;color:var(--text-muted);text-align:right}
            </style>
            <div class="rg-picker-wrap">
                <div class="rg-picker-search-box">
                    <i class="fa-solid fa-magnifying-glass rg-picker-search-icon"></i>
                    <input id="rg-doc-search" placeholder="Пошук за назвою документа..." autocomplete="off"
                        oninput="RegistryPage._filterDocPicker(this.value)">
                    <button class="rg-picker-clear" id="rg-picker-clear" onclick="RegistryPage._clearDocSearch()" title="Очистити">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div id="rg-picker-count" class="rg-picker-count"></div>
                <div id="rg-doc-picker" class="rg-picker-list"></div>
                <div id="rg-doc-chosen" class="rg-picker-chosen">
                    <div class="rg-picker-chosen-icon"><i class="fa-solid fa-check"></i></div>
                    <span class="rg-picker-chosen-text" id="rg-chosen-text"></span>
                </div>
                <input type="hidden" id="rg-doc-sel">
            </div>`,
            footer: `<button class="btn btn-ghost" onclick="Modal.close()">Скасувати</button>
                     <button class="btn btn-primary" onclick="${saveCall}">Додати</button>`,
        });
        setTimeout(() => {
            this._filterDocPicker('');
            document.getElementById('rg-doc-search')?.focus();
        }, 80);
    },

    _filterDocPicker(q) {
        const picker   = document.getElementById('rg-doc-picker');
        const countEl  = document.getElementById('rg-picker-count');
        const clearBtn = document.getElementById('rg-picker-clear');
        if (!picker) return;
        if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
        const list = this._docPickerList || [];
        const sq = q.trim().toLowerCase();
        const filtered = sq ? list.filter(r => r.title.toLowerCase().includes(sq)) : list;
        if (countEl) countEl.textContent = sq ? `Знайдено: ${filtered.length} з ${list.length}` : `Всього: ${list.length}`;
        if (!filtered.length) {
            picker.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:.83rem"><i class="fa-solid fa-magnifying-glass" style="font-size:1.5rem;opacity:.3;display:block;margin-bottom:.5rem"></i>Нічого не знайдено</div>`;
            return;
        }
        const selectedId = this._docPickerSelected?.id;
        picker.innerHTML = filtered.map(r => {
            const isActive = r.id === selectedId;
            const dovBadges = (r._dovNames || []).length
                ? r._dovNames.map(n =>
                    `<span style="font-size:.68rem;background:rgba(99,102,241,.1);color:var(--primary);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:.05rem .4rem;white-space:nowrap">${Fmt.esc(n)}</span>`
                  ).join('')
                : `<span style="font-size:.68rem;background:rgba(16,185,129,.08);color:#059669;border:1px solid rgba(16,185,129,.25);border-radius:10px;padding:.05rem .4rem;white-space:nowrap">🌐 Для всіх ТОВ</span>`;
            return `<div class="rg-picker-item${isActive ? ' active' : ''}" data-id="${r.id}"
                onclick="RegistryPage._pickDoc('${r.id}',${JSON.stringify(r.title).replace(/"/g,'&quot;')})">
                <div class="rg-picker-item-icon"><i class="fa-solid fa-file-lines"></i></div>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:.2rem">
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Fmt.esc(r.title)}</span>
                    ${dovBadges ? `<div style="display:flex;gap:.3rem;flex-wrap:wrap">${dovBadges}</div>` : ''}
                </div>
                <i class="fa-solid fa-check rg-picker-item-check"></i>
            </div>`;
        }).join('');
    },

    _clearDocSearch() {
        const inp = document.getElementById('rg-doc-search');
        if (inp) { inp.value = ''; inp.focus(); }
        this._filterDocPicker('');
    },

    _pickDoc(id, title) {
        const res = this._docPickerList?.find(r => r.id === id);
        this._docPickerSelected = { id, title, description: res?.description || null };
        document.getElementById('rg-doc-sel').value = id;
        const chosen = document.getElementById('rg-doc-chosen');
        const chosenText = document.getElementById('rg-chosen-text');
        if (chosen) chosen.classList.add('show');
        if (chosenText) chosenText.textContent = title;
        document.querySelectorAll('.rg-picker-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === id);
        });
    },
};
