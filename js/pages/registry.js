// ================================================================
// LMS — Реєстри НПА Товариства
// ================================================================

const RegistryPage = {

    _items: [],   // registry_items rows
    _docs:  [],   // registry_docs rows (all, with resource join)
    _canManage: false,

    async renderInTab(area) {
        if (!area) return;
        this._canManage = AppState.isAdmin();
        area.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:2rem;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.4rem"></i></div>`;
        try {
            [this._items, this._docs] = await Promise.all([
                API.registryItems.getAll(),
                API.registryDocs.getAll(),
            ]);
        } catch (e) {
            area.innerHTML = `<div class="callout danger">Помилка завантаження реєстрів: ${Fmt.esc(e.message)}</div>`;
            return;
        }
        this._render(area);
    },

    _render(area) {
        const canManage = this._canManage;

        const styles = `
        <style>
            .rg-toolbar{display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap}
            .rg-table-wrap{overflow-x:auto;border-radius:var(--radius-xl);border:1px solid var(--border);background:var(--bg-surface)}
            .rg-table{width:100%;border-collapse:collapse;font-size:.85rem}
            .rg-table th{padding:.65rem 1rem;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);border-bottom:2px solid var(--border);white-space:nowrap;background:var(--bg-raised)}
            .rg-table th.rg-th-topic{width:28%;min-width:180px}
            .rg-table th.rg-th-order{width:36%;min-width:220px}
            .rg-table th.rg-th-disp{width:36%;min-width:220px}
            .rg-table td{padding:.55rem 1rem;border-bottom:1px solid var(--border);vertical-align:top;line-height:1.45;word-break:break-word;overflow-wrap:break-word}
            .rg-table tr:last-child td{border-bottom:none}
            .rg-table tr:hover td{background:var(--bg-raised)}
            .rg-td-topic{font-weight:600;color:var(--text-primary);font-size:.82rem}
            .rg-td-topic-inner{display:flex;align-items:flex-start;gap:.4rem}
            .rg-topic-actions{display:flex;gap:.25rem;flex-shrink:0;opacity:0;transition:opacity .15s}
            .rg-table tr:hover .rg-topic-actions{opacity:1}
            .rg-ta-btn{width:22px;height:22px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.65rem;transition:all .15s;font-family:inherit}
            .rg-ta-btn:hover{border-color:var(--primary);color:var(--primary)}
            .rg-ta-btn.danger:hover{border-color:#ef4444;color:#ef4444}
            .rg-doc-link{display:inline;color:var(--primary);font-size:.82rem;font-weight:500;cursor:pointer;padding:.15rem 0;line-height:1.45;transition:opacity .15s;word-break:break-word;white-space:normal}
            .rg-doc-link:hover{opacity:.75;text-decoration:underline}
            .rg-doc-row{display:flex;align-items:flex-start;gap:.3rem;margin-bottom:.3rem}
            .rg-doc-row:last-child{margin-bottom:0}
            .rg-doc-num{font-size:.68rem;color:var(--text-muted);flex-shrink:0;margin-top:.2rem;min-width:14px}
            .rg-doc-del{width:18px;height:18px;border-radius:4px;border:none;background:transparent;color:var(--text-muted);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.6rem;opacity:0;transition:opacity .15s,color .15s;font-family:inherit}
            .rg-doc-row:hover .rg-doc-del{opacity:1}
            .rg-doc-del:hover{color:#ef4444}
            .rg-add-doc{display:inline-flex;align-items:center;gap:.3rem;font-size:.75rem;color:var(--text-muted);cursor:pointer;padding:.2rem .4rem;border-radius:var(--radius-sm);border:1px dashed var(--border);margin-top:.3rem;transition:all .15s;background:transparent;font-family:inherit}
            .rg-add-doc:hover{border-color:var(--primary);color:var(--primary)}
            .rg-empty{text-align:center;padding:3rem 1rem;color:var(--text-muted);font-size:.9rem}
            .rg-th-group{text-align:center;border-bottom:2px solid var(--border);padding:.5rem 1rem;background:var(--bg-raised)}
            .rg-th-sub{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)}
        </style>`;

        // Групуємо docs по item_id і type
        const byItem = {};
        for (const d of this._docs) {
            if (!byItem[d.registry_item_id]) byItem[d.registry_item_id] = { order: [], disposition: [] };
            byItem[d.registry_item_id][d.type === 'order' ? 'order' : 'disposition'].push(d);
        }

        let rows = '';
        if (!this._items.length) {
            rows = `<tr><td colspan="3" class="rg-empty"><i class="fa-solid fa-folder-open" style="font-size:2rem;opacity:.3;display:block;margin-bottom:.75rem"></i>Реєстри порожні</td></tr>`;
        } else {
            for (const item of this._items) {
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
                                ${canManage ? `
                                <div class="rg-topic-actions">
                                    <button class="rg-ta-btn" title="Редагувати" onclick="RegistryPage._editTopic('${item.id}',${JSON.stringify(item.topic).replace(/"/g,'&quot;')})"><i class="fa-solid fa-pen"></i></button>
                                    <button class="rg-ta-btn" title="Вгору" onclick="RegistryPage._moveTopic('${item.id}',-1)"><i class="fa-solid fa-arrow-up"></i></button>
                                    <button class="rg-ta-btn" title="Вниз" onclick="RegistryPage._moveTopic('${item.id}',1)"><i class="fa-solid fa-arrow-down"></i></button>
                                    <button class="rg-ta-btn danger" title="Видалити тему" onclick="RegistryPage._deleteTopic('${item.id}',${JSON.stringify(item.topic).replace(/"/g,'&quot;')})"><i class="fa-solid fa-trash"></i></button>
                                </div>` : ''}
                            </div>
                            ${canManage ? `
                            <div style="display:flex;gap:.35rem;margin-top:.5rem;flex-wrap:wrap">
                                <button class="rg-add-doc" onclick="RegistryPage._addDoc('${item.id}','order')"><i class="fa-solid fa-plus"></i> наказ</button>
                                <button class="rg-add-doc" onclick="RegistryPage._addDoc('${item.id}','disposition')"><i class="fa-solid fa-plus"></i> розпорядження</button>
                            </div>` : ''}
                        </td>` : '';

                    const _docCell = (entry, num) => {
                        if (!entry) return `<td></td>`;
                        const desc = entry.resource?.description?.trim();
                        return `<td>
                            <div class="rg-doc-row">
                                <span class="rg-doc-num">${num}.</span>
                                <div style="flex:1;min-width:0">
                                    <span class="rg-doc-link" onclick="Router.go('resource/${entry.resource_id}?from=documents&tab=registry')">${Fmt.esc(entry.resource?.title || '—')}</span>
                                    ${desc ? `<div style="font-size:.75rem;color:var(--text-muted);margin-top:.15rem;line-height:1.4;word-break:break-word;white-space:normal">${Fmt.esc(desc)}</div>` : ''}
                                </div>
                                ${canManage ? `<button class="rg-doc-del" title="Видалити" onclick="RegistryPage._removeDoc('${entry.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
                            </div>
                        </td>`;
                    };

                    const ordCell  = _docCell(ord,  i + 1);
                    const dispCell = _docCell(disp, i + 1);

                    rows += `<tr>${topicCell}${ordCell}${dispCell}</tr>`;
                }
            }
        }

        area.innerHTML = `${styles}
        <div class="rg-toolbar">
            ${canManage ? `<button class="btn btn-primary btn-sm" onclick="RegistryPage._addTopic()"><i class="fa-solid fa-plus"></i> Додати тему</button>` : ''}
        </div>
        <div class="rg-table-wrap">
            <table class="rg-table">
                <thead>
                    <tr>
                        <th class="rg-th-topic">Назва</th>
                        <th style="border-left:1px solid var(--border)">Назва наказу</th>
                        <th style="border-left:1px solid var(--border)">Назва розпорядження</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    },

    // ── Додати тему ─────────────────────────────────────────────────
    _addTopic() {
        Modal.open({
            title: 'Нова тема реєстру',
            body: `<div style="display:flex;flex-direction:column;gap:1rem">
                <label style="font-size:.82rem;font-weight:600;color:var(--text-muted)">Назва теми</label>
                <input id="rg-topic-inp" class="form-control" placeholder="Наприклад: Кадрові питання" maxlength="200" style="font-size:.9rem">
            </div>`,
            footer: `<button class="btn btn-ghost" onclick="Modal.close()">Скасувати</button>
                     <button class="btn btn-primary" onclick="RegistryPage._saveTopic()">Зберегти</button>`,
        });
        setTimeout(() => document.getElementById('rg-topic-inp')?.focus(), 100);
    },

    async _saveTopic() {
        const inp = document.getElementById('rg-topic-inp');
        const topic = inp?.value.trim();
        if (!topic) { Toast.warning('Введіть назву теми'); return; }
        try {
            Loader.show();
            const maxOrder = this._items.reduce((m, i) => Math.max(m, i.order_index), -1);
            const item = await API.registryItems.create({ topic, order_index: maxOrder + 1 });
            this._items.push(item);
            Modal.close();
            Toast.success('Тему додано');
            this._rerender();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    // ── Редагувати тему ─────────────────────────────────────────────
    _editTopic(id, currentTopic) {
        Modal.open({
            title: 'Редагувати тему',
            body: `<div style="display:flex;flex-direction:column;gap:1rem">
                <label style="font-size:.82rem;font-weight:600;color:var(--text-muted)">Назва теми</label>
                <input id="rg-topic-inp" class="form-control" value="${Fmt.esc(currentTopic)}" maxlength="200" style="font-size:.9rem">
            </div>`,
            footer: `<button class="btn btn-ghost" onclick="Modal.close()">Скасувати</button>
                     <button class="btn btn-primary" onclick="RegistryPage._updateTopic('${id}')">Зберегти</button>`,
        });
        setTimeout(() => {
            const inp = document.getElementById('rg-topic-inp');
            if (inp) { inp.focus(); inp.select(); }
        }, 100);
    },

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

    // ── Видалити тему ───────────────────────────────────────────────
    async _deleteTopic(id, topic) {
        const ok = await Modal.confirm({ title: 'Видалити тему?', message: `Тема "${topic}" та всі прив'язані документи будуть видалені з реєстру (самі документи залишаться в Документах).`, confirmText: 'Видалити', danger: true });
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

    // ── Перемістити тему ────────────────────────────────────────────
    async _moveTopic(id, dir) {
        const idx = this._items.findIndex(i => i.id === id);
        const swapIdx = idx + dir;
        if (swapIdx < 0 || swapIdx >= this._items.length) return;
        // swap
        [this._items[idx], this._items[swapIdx]] = [this._items[swapIdx], this._items[idx]];
        this._rerender();
        try {
            await API.registryItems.reorder(this._items.map(i => i.id));
        } catch (e) {
            Toast.error('Помилка збереження порядку', e.message);
        }
    },

    // ── Додати документ до теми ──────────────────────────────────────
    async _addDoc(itemId, type) {
        // Завантажуємо документи з розділу "Документи"
        // Виключаємо: branch-docs (display_block not null), red-folder (red_folder_item_id not null), видалені
        let resources = [];
        try {
            Loader.show();
            const { data } = await supabase.from('resources')
                .select('id, title, type')
                .is('deleted_at', null)
                .is('display_block', null)
                .is('red_folder_item_id', null)
                .is('course_id', null)   // документи не прив'язані до курсу
                .order('title');
            resources = data || [];
        } catch (_) {} finally { Loader.hide(); }

        const typeLabel = type === 'order' ? 'наказ' : 'розпорядження';

        if (!resources.length) {
            Toast.warning('Немає документів', 'Спочатку додайте документи у розділ "Документи"');
            return;
        }

        // Зберігаємо список для пошуку
        this._docPickerList = resources;
        this._docPickerSelected = null;

        Modal.open({
            title: `Додати ${typeLabel}`,
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
                     <button class="btn btn-primary" onclick="RegistryPage._saveDoc('${itemId}','${type}')">Додати</button>`,
        });

        setTimeout(() => {
            this._filterDocPicker('');
            document.getElementById('rg-doc-search')?.focus();
        }, 80);
    },

    _filterDocPicker(q) {
        const picker = document.getElementById('rg-doc-picker');
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
            return `<div class="rg-picker-item${isActive ? ' active' : ''}" data-id="${r.id}"
                onclick="RegistryPage._pickDoc('${r.id}',${JSON.stringify(r.title).replace(/"/g,'&quot;')})">
                <div class="rg-picker-item-icon"><i class="fa-solid fa-file-lines"></i></div>
                <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Fmt.esc(r.title)}</span>
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
        this._docPickerSelected = { id, title };
        document.getElementById('rg-doc-sel').value = id;

        const chosen = document.getElementById('rg-doc-chosen');
        const chosenText = document.getElementById('rg-chosen-text');
        if (chosen) chosen.classList.add('show');
        if (chosenText) chosenText.textContent = title;

        // оновлюємо active клас без перемальовки всього списку
        document.querySelectorAll('.rg-picker-item').forEach(el => {
            const active = el.dataset.id === id;
            el.classList.toggle('active', active);
        });
    },

    async _saveDoc(itemId, type) {
        const sel = document.getElementById('rg-doc-sel');
        const resourceId = sel?.value;
        if (!resourceId) { Toast.warning('Оберіть документ'); return; }

        // Перевіряємо чи вже є такий документ в цій темі та типі
        const existing = this._docs.find(d => d.registry_item_id === itemId && d.type === type && d.resource_id === resourceId);
        if (existing) { Toast.warning('Цей документ вже є в списку'); return; }

        const sameType = this._docs.filter(d => d.registry_item_id === itemId && d.type === type);
        try {
            Loader.show();
            const doc = await API.registryDocs.add({
                registry_item_id: itemId,
                type,
                resource_id: resourceId,
                order_index: sameType.length,
            });
            // Додаємо resource дані локально
            doc.resource = { id: resourceId, title: this._docPickerSelected?.title || resourceId };
            this._docs.push(doc);
            Modal.close();
            Toast.success('Документ додано');
            this._rerender();
        } catch (e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    // ── Видалити документ ────────────────────────────────────────────
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

    // ── Перемалювати без перезавантаження ────────────────────────────
    _rerender() {
        const area = document.getElementById('rg-tab-area');
        if (area) this._render(area);
    },
};
