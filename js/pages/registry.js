// ================================================================
// LMS — Реєстри НПА Товариства
// ================================================================

const RegistryPage = {

    _items:    [],   // registry_items rows
    _docs:     [],   // registry_docs rows (with resource join)
    _sections: [],   // registry_sections rows
    _canManage: false,
    _allDovs:  [],

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
        } catch (e) {
            area.innerHTML = `<div class="callout danger">Помилка завантаження реєстрів: ${Fmt.esc(e.message)}</div>`;
            return;
        }
        this._render(area);
    },

    // ── Спільна функція побудови таблиці тем ─────────────────────────
    _buildTopicsTable(items, canManage) {
        const byItem = {};
        for (const d of this._docs) {
            if (!byItem[d.registry_item_id]) byItem[d.registry_item_id] = { order: [], disposition: [] };
            byItem[d.registry_item_id][d.type === 'order' ? 'order' : 'disposition'].push(d);
        }

        let rows = '';
        if (!items.length) {
            rows = `<tr><td colspan="3" class="rg-empty"><i class="fa-solid fa-folder-open" style="font-size:1.6rem;opacity:.3;display:block;margin-bottom:.5rem"></i>Тем ще немає</td></tr>`;
        } else {
            for (let ti = 0; ti < items.length; ti++) {
                const item = items[ti];
                const colorClass = `rg-tr-c${ti % 7}`;
                const orders      = byItem[item.id]?.order       || [];
                const dispositions = byItem[item.id]?.disposition || [];
                const rowCount    = Math.max(orders.length, dispositions.length, 1);

                for (let i = 0; i < rowCount; i++) {
                    const ord  = orders[i];
                    const disp = dispositions[i];
                    const isFirst = i === 0;

                    const topicCell = isFirst ? `
                        <td class="rg-td-topic" rowspan="${rowCount}">
                            <div class="rg-td-topic-inner">
                                <span style="flex:1">${Fmt.esc(item.topic)}</span>
                            </div>
                            ${canManage ? `
                            <div class="rg-topic-actions">
                                <button class="rg-ta-btn" title="Редагувати" onclick="RegistryPage._editTopic('${item.id}',${JSON.stringify(item.topic).replace(/"/g,'&quot;')})"><i class="fa-solid fa-pen"></i></button>
                                <button class="rg-ta-btn" title="Вгору" onclick="RegistryPage._moveTopic('${item.id}',-1)"><i class="fa-solid fa-arrow-up"></i></button>
                                <button class="rg-ta-btn" title="Вниз" onclick="RegistryPage._moveTopic('${item.id}',1)"><i class="fa-solid fa-arrow-down"></i></button>
                                <button class="rg-ta-btn danger" title="Видалити тему" onclick="RegistryPage._deleteTopic('${item.id}',${JSON.stringify(item.topic).replace(/"/g,'&quot;')})"><i class="fa-solid fa-trash"></i></button>
                            </div>
                            <div style="display:flex;gap:.35rem;margin-top:.35rem;flex-wrap:wrap">
                                <button class="rg-add-doc" onclick="RegistryPage._addDoc('${item.id}','order')"><i class="fa-solid fa-plus"></i> наказ</button>
                                <button class="rg-add-doc" onclick="RegistryPage._addDoc('${item.id}','disposition')"><i class="fa-solid fa-plus"></i> розпорядження</button>
                            </div>` : ''}
                        </td>` : '';

                    const _docCell = (entry, num, list) => {
                        if (!entry) return `<td></td>`;
                        const desc = entry.resource?.description?.trim();
                        const idx = list.indexOf(entry);
                        const isFirst = idx === 0;
                        const isLast  = idx === list.length - 1;
                        return `<td>
                            <div class="rg-doc-row">
                                <span class="rg-doc-num">${num}.</span>
                                <div style="flex:1;min-width:0">
                                    <span class="rg-doc-link" onclick="Router.go('resource/${entry.resource_id}?from=documents')">${Fmt.esc(entry.resource?.title || '—')}</span>
                                    ${desc ? `<div style="font-size:.82rem;color:var(--text-muted);margin-top:.15rem;line-height:1.4;word-break:break-word;white-space:normal">${Fmt.esc(desc)}</div>` : ''}
                                </div>
                                ${canManage ? `
                                <div class="rg-doc-actions">
                                    <button class="rg-ta-btn" title="Вгору" ${isFirst ? 'disabled' : ''} onclick="RegistryPage._moveDoc('${entry.id}','${entry.registry_item_id}','${entry.type}',-1)"><i class="fa-solid fa-arrow-up"></i></button>
                                    <button class="rg-ta-btn" title="Вниз" ${isLast ? 'disabled' : ''} onclick="RegistryPage._moveDoc('${entry.id}','${entry.registry_item_id}','${entry.type}',1)"><i class="fa-solid fa-arrow-down"></i></button>
                                    <button class="rg-doc-del" title="Видалити" onclick="RegistryPage._removeDoc('${entry.id}')"><i class="fa-solid fa-xmark"></i></button>
                                </div>` : ''}
                            </div>
                        </td>`;
                    };

                    rows += `<tr class="${colorClass}">${topicCell}${_docCell(ord, i+1, orders)}${_docCell(disp, i+1, dispositions)}</tr>`;
                }
            }
        }

        return `
        <div class="rg-table-wrap">
            <table class="rg-table">
                <thead>
                    <tr>
                        <th class="rg-th-topic">Назва теми</th>
                        <th style="border-left:1px solid var(--border)">Назва наказу</th>
                        <th style="border-left:1px solid var(--border)">Назва розпорядження</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    },

    _render(area) {
        const canManage = this._canManage;

        const styles = `
        <style>
            .rg-toolbar{display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap}
            .rg-table-wrap{overflow-x:auto;border-radius:var(--radius-xl);border:1px solid var(--border);background:var(--bg-surface)}
            .rg-table{width:100%;border-collapse:collapse;font-size:.92rem}
            .rg-table th{padding:.65rem 1rem;font-size:.76rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);border-bottom:2px solid var(--border);white-space:nowrap;background:var(--bg-raised)}
            .rg-table th.rg-th-topic{width:17%;min-width:120px}
            .rg-table td{padding:.55rem 1rem;border-bottom:1px solid var(--border);vertical-align:top;line-height:1.45;word-break:break-word;overflow-wrap:break-word}
            .rg-table tr:last-child td{border-bottom:none}
            .rg-table tr:hover td{filter:brightness(.97)}
            .rg-td-topic{font-weight:600;color:var(--text-primary);font-size:.92rem}
            .rg-tr-c0 td{background:rgba(99,102,241,.06)}
            .rg-tr-c1 td{background:rgba(16,185,129,.06)}
            .rg-tr-c2 td{background:rgba(245,158,11,.06)}
            .rg-tr-c3 td{background:rgba(239,68,68,.06)}
            .rg-tr-c4 td{background:rgba(59,130,246,.06)}
            .rg-tr-c5 td{background:rgba(168,85,247,.06)}
            .rg-tr-c6 td{background:rgba(20,184,166,.06)}
            .rg-table tr:hover td{background:var(--bg-raised)!important}
            .rg-td-topic-inner{display:flex;align-items:flex-start;gap:.4rem}
            .rg-topic-actions{display:flex;gap:.25rem;flex-wrap:wrap;margin-top:.3rem}
            .rg-ta-btn{width:22px;height:22px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.65rem;transition:all .15s;font-family:inherit}
            .rg-ta-btn:hover{border-color:var(--primary);color:var(--primary)}
            .rg-ta-btn.danger:hover{border-color:#ef4444;color:#ef4444}
            .rg-doc-link{display:inline;color:var(--primary);font-size:.92rem;font-weight:500;cursor:pointer;padding:.15rem 0;line-height:1.45;transition:opacity .15s;word-break:break-word;white-space:normal}
            .rg-doc-link:hover{opacity:.75;text-decoration:underline}
            .rg-doc-row{display:flex;align-items:flex-start;gap:.3rem;margin-bottom:.3rem}
            .rg-doc-row:last-child{margin-bottom:0}
            .rg-doc-num{font-size:.75rem;color:var(--text-muted);flex-shrink:0;margin-top:.2rem;min-width:14px}
            .rg-doc-actions{display:flex;align-items:center;gap:2px;flex-shrink:0;opacity:0;transition:opacity .15s}
            .rg-doc-row:hover .rg-doc-actions{opacity:1}
            .rg-doc-del{width:18px;height:18px;border-radius:4px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.6rem;transition:color .15s;font-family:inherit}
            .rg-doc-del:hover{color:#ef4444}
            .rg-doc-actions .rg-ta-btn{width:18px;height:18px;font-size:.55rem}
            .rg-doc-actions .rg-ta-btn:disabled{opacity:.25;cursor:default}
            .rg-add-doc{display:inline-flex;align-items:center;gap:.3rem;font-size:.75rem;color:var(--text-muted);cursor:pointer;padding:.2rem .4rem;border-radius:var(--radius-sm);border:1px dashed var(--border);margin-top:.3rem;transition:all .15s;background:transparent;font-family:inherit}
            .rg-add-doc:hover{border-color:var(--primary);color:var(--primary)}
            .rg-empty{text-align:center;padding:3rem 1rem;color:var(--text-muted);font-size:.9rem}

            /* ── Sections ──────────────────────────────────────── */
            .rg-sections{display:flex;flex-direction:column;gap:.85rem;margin-top:1.5rem;max-width:1400px}
            .rg-sec{border:1px solid var(--border);border-radius:var(--radius-xl);background:var(--bg-surface);overflow-x:hidden}
            .rg-sec-head{display:flex;align-items:center;gap:.6rem;padding:.7rem 1rem;background:var(--bg-raised);cursor:pointer;user-select:none;border-bottom:1px solid transparent;transition:border-color .15s;border-radius:var(--radius-xl) var(--radius-xl) 0 0}
            .rg-sec.open .rg-sec-head{border-bottom-color:var(--border)}
            .rg-sec-chevron{font-size:.65rem;color:var(--text-muted);transition:transform .2s;flex-shrink:0}
            .rg-sec.open .rg-sec-chevron{transform:rotate(90deg)}
            .rg-sec-icon{width:28px;height:28px;border-radius:8px;background:rgba(99,102,241,.12);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0}
            .rg-sec-title{font-size:.84rem;font-weight:700;color:var(--text-primary);flex:1;min-width:0}
            .rg-sec-count{font-size:.7rem;color:var(--text-muted);background:var(--bg-base);border:1px solid var(--border);border-radius:20px;padding:.1rem .55rem;flex-shrink:0}
            .rg-sec-actions{display:flex;gap:.25rem;flex-shrink:0;opacity:0;transition:opacity .15s}
            .rg-sec:hover .rg-sec-actions{opacity:1}
            .rg-sec-body{display:none;flex-direction:column}
            .rg-sec.open .rg-sec-body{display:flex}
            .rg-sec-toolbar{padding:.6rem 1rem;border-bottom:1px solid var(--border);background:var(--bg-surface)}
            .rg-sec-desc-wrap{padding:.7rem 1.1rem;border-bottom:1px solid var(--border);background:linear-gradient(135deg,rgba(99,102,241,.04) 0%,rgba(99,102,241,.01) 100%)}
            .rg-sec-desc-input{width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:var(--radius-md);padding:.5rem .75rem;font-size:.84rem;color:var(--text-primary);background:var(--bg-raised);resize:vertical;min-height:56px;font-family:inherit;line-height:1.5;outline:none;transition:border-color .15s}
            .rg-sec-desc-input:focus{border-color:var(--primary)}
            .rg-sec-desc-text{margin:0;font-size:1rem;color:var(--primary);line-height:1.65;white-space:pre-wrap;font-style:italic;padding:.1rem 0 .1rem .85rem;border-left:3px solid rgba(99,102,241,.35)}
            .rg-sec .rg-table-wrap{border:none;border-radius:0;border-top:none;margin-bottom:.75rem}
            .rg-sec .rg-table tr:last-child td{border-bottom:none}
            .rg-sections-empty{text-align:center;padding:2rem 1rem;color:var(--text-muted);font-size:.85rem;border:1px dashed var(--border);border-radius:var(--radius-xl);margin-top:1.5rem}
            .rg-sec-dov-badge{font-size:.68rem;color:var(--text-muted);background:var(--bg-raised);border:1px solid var(--border);border-radius:20px;padding:.1rem .45rem;flex-shrink:0;white-space:nowrap}
        </style>`;

        // ── Теми без розділу (верхня таблиця) — прихована ──────────
        const rootItems = this._items.filter(i => !i.section_id);
        const rootTable = '';

        // ── Розділи з їх темами ─────────────────────────────────────
        let sectionsHtml = '';
        if (this._sections.length) {
            const visibleSecIds = new Set(this._sections.map(s => s.id));
            sectionsHtml = `<div class="rg-sections" id="rg-sections-list">` +
                this._sections.map(sec => {
                    const secItems = this._items.filter(i => i.section_id === sec.id);
                    const dovName  = sec._dov?.name;
                    const innerTable = this._buildTopicsTable(secItems, canManage);

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
                                ${canManage ? `
                                <textarea class="rg-sec-desc-input" id="rg-desc-${sec.id}"
                                    placeholder="Опис розділу (необов'язково)..."
                                    onblur="RegistryPage._saveSecDesc('${sec.id}',this.value)"
                                    >${Fmt.esc(sec.description || '')}</textarea>` :
                                (sec.description ? `<p class="rg-sec-desc-text">${Fmt.esc(sec.description)}</p>` : '')}
                            </div>` : ''}
                            ${canManage ? `<div class="rg-sec-toolbar">
                                <button class="btn btn-primary btn-sm" onclick="RegistryPage._addTopicToSection('${sec.id}')"><i class="fa-solid fa-plus"></i> Додати тему</button>
                            </div>` : ''}
                            ${innerTable}
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

        ${rootTable}
        ${sectionsHtml}`;
    },

    // ── Toggle розділу ───────────────────────────────────────────────
    _toggleSec(id) {
        const el = document.getElementById(`rg-sec-${id}`);
        if (el) el.classList.toggle('open');
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

    // ── Додати тему (глобально, без розділу) ─────────────────────────
    _addTopic() { this._openTopicModal(null, null, null); },

    // ── Додати тему до розділу ───────────────────────────────────────
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
        // Swap in main _docs array
        const a = this._docs.indexOf(list[idx]);
        const b = this._docs.indexOf(list[swapIdx]);
        [this._docs[a], this._docs[b]] = [this._docs[b], this._docs[a]];
        this._rerender();
        try {
            const sameType = this._docs.filter(d => d.registry_item_id === itemId && d.type === type);
            await API.registryDocs.reorder(sameType.map(d => d.id));
        } catch (e) {
            Toast.error('Помилка збереження порядку', e.message);
        }
    },

    // ── Додати документ до теми ──────────────────────────────────────
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

    // ── Додати розділ ────────────────────────────────────────────────
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
            // Відв'язуємо теми від розділу локально
            this._items.forEach(i => { if (i.section_id === id) i.section_id = null; });
            this._sections = this._sections.filter(s => s.id !== id);
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

    // ── Спільний пікер документів ────────────────────────────────────
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
        const picker  = document.getElementById('rg-doc-picker');
        const countEl = document.getElementById('rg-picker-count');
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
                ? (r._dovNames).map(n =>
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

    _rerender() {
        const area = document.getElementById('rg-tab-area');
        if (!area) return;
        // Зберігаємо відкриті секції
        const openSecs = new Set(
            [...document.querySelectorAll('.rg-sec.open')].map(el => el.id)
        );
        this._render(area);
        // Відновлюємо стан акордеону
        openSecs.forEach(id => {
            document.getElementById(id)?.classList.add('open');
        });
    },
};
