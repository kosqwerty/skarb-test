// ================================================================
// Червона папка
// ================================================================

const RedFolderPage = {

    _items: [],
    _docs: {},   // itemId -> resource[]

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
            .rf-table { width: 100%; border-collapse: collapse; background: var(--bg-surface); border: 1px solid rgba(239,68,68,.25); border-radius: var(--radius-xl); overflow: hidden; box-shadow: 0 2px 16px rgba(239,68,68,.08); }
            .rf-table thead tr { background: linear-gradient(135deg,rgba(239,68,68,.12),rgba(185,28,28,.08)); }
            .rf-table thead th { padding: .7rem 1rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #ef4444; text-align: left; border-bottom: 1px solid rgba(239,68,68,.2); }
            .rf-table thead th:first-child { width: 48px; text-align: center; }
            .rf-tr { border-bottom: 1px solid var(--border); transition: background .12s; }
            .rf-tr:last-child { border-bottom: none; }
            .rf-tr:hover { background: rgba(239,68,68,.03); }
            .rf-num { text-align: center; font-size: .85rem; font-weight: 700; color: #ef4444; padding: 1rem .5rem; vertical-align: top; }
            .rf-cell { font-size: .85rem; font-weight: 600; color: var(--text-primary); padding: .85rem 1rem .85rem 0; vertical-align: top; line-height: 1.45; word-break: break-word; white-space: normal; min-width: 0; }
            .rf-cell-muted { font-size: .78rem; color: var(--text-muted); padding: .85rem 1rem .85rem 0; vertical-align: top; }
            .rf-empty { text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-size: .88rem; }
            /* doc list inside cell */
            .rf-doc-list { display: flex; flex-direction: column; gap: .3rem; padding: .75rem 0; }
            .rf-doc-item { display: flex; align-items: center; gap: .4rem; }
            .rf-doc-link { display: inline-flex; align-items: center; font-size: .75rem; color: #ef4444; background: none; border: none; cursor: pointer; font-family: inherit; text-decoration: underline; text-underline-offset: 2px; padding: 0; }
            .rf-doc-link:hover { opacity: .75; }
            .rf-doc-del { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: .15rem .3rem; border-radius: 6px; font-size: .72rem; transition: all .12s; }
            .rf-doc-del:hover { background: rgba(239,68,68,.1); color: #ef4444; }
            .rf-upload-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .22rem .55rem; border-radius: var(--radius-sm); border: 1px dashed rgba(239,68,68,.4); background: transparent; color: rgba(239,68,68,.7); font-size: .72rem; cursor: pointer; transition: all .15s; font-family: inherit; }
            .rf-upload-btn:hover { border-color: #ef4444; color: #ef4444; background: rgba(239,68,68,.04); }
            .rf-row-actions { display: flex; gap: .3rem; margin-top: .35rem; flex-wrap: wrap; }
            .rf-action-btn { display: inline-flex; align-items: center; gap: .3rem; padding: .2rem .55rem; border-radius: var(--radius-sm); border: 1px dashed var(--border); background: transparent; color: var(--text-muted); font-size: .72rem; cursor: pointer; transition: all .15s; font-family: inherit; }
            .rf-action-btn:hover { border-color: #ef4444; color: #ef4444; }
            .rf-action-btn.danger:hover { border-color: var(--danger); color: var(--danger); }
            /* modal form */
            .rf-form { display: flex; flex-direction: column; gap: .9rem; }
            .rf-form label { font-size: .78rem; font-weight: 600; color: var(--text-muted); margin-bottom: .2rem; display: block; }
            .rf-form input, .rf-form textarea {
                width: 100%; padding: .55rem .8rem; border-radius: var(--radius-md);
                border: 1px solid var(--border); background: var(--bg-surface);
                color: var(--text-primary); font-size: .88rem; font-family: inherit;
                outline: none; box-sizing: border-box;
            }
            .rf-form input:focus, .rf-form textarea:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,.12); }
            .rf-form textarea { resize: vertical; min-height: 72px; }
            .rf-icon-row { display: flex; flex-wrap: wrap; gap: .4rem; }
            .rf-icon-opt { display: inline-flex; align-items: center; gap: .4rem; padding: .3rem .65rem; border-radius: var(--radius-md); border: 1.5px solid var(--border); background: var(--bg-raised); cursor: pointer; font-size: .75rem; font-family: inherit; color: var(--text-secondary); transition: all .15s; }
            .rf-icon-opt:hover { border-color: var(--ic); color: var(--text-primary); }
            .rf-icon-opt-active { border-color: var(--ic) !important; background: color-mix(in srgb,var(--ic) 10%,transparent); color: var(--text-primary) !important; }
        `;
        document.head.appendChild(s);
    },

    async renderInTab(area) {
        this._injectStyles();
        const canManage = AppState.isAdmin();
        area.innerHTML = `
        <div class="rf-wrap">
            <div class="rf-header">
                <div class="rf-hero">
                    <div class="rf-hero-ico">📁</div>
                    <div>
                        <div class="rf-title">Червона папка</div>
                        <div class="rf-subtitle">Документи підвищеного контролю</div>
                    </div>
                </div>
                ${canManage ? `<button class="btn btn-sm" style="background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;border:none;box-shadow:0 3px 10px rgba(239,68,68,.35)" onclick="RedFolderPage._openModal()"><i class="fa-solid fa-plus"></i> Додати рядок</button>` : ''}
            </div>
            <div id="rf-content">
                <div style="text-align:center;padding:3rem 1rem;color:var(--text-muted)"><i class="fa-solid fa-spinner fa-spin"></i> Завантаження...</div>
            </div>
        </div>`;
        await this._load();
    },

    async _load() {
        try {
            const canManage = AppState.isAdmin();
            const seeAll = AppState.isAdmin() || AppState.isManager();
            const [items, docs, myDovs] = await Promise.all([
                API.redFolderItems.getAll(),
                API.resources.getRedFolderDocs().catch(() => []),
                seeAll ? Promise.resolve(null) : API.dovirenosti.getForProfile(AppState.user.id).catch(() => [])
            ]);
            this._items = items;
            this._docs = {};

            const myDovIds = myDovs ? new Set(myDovs.map(d => d.id)) : null;
            const visibleDocs = seeAll ? docs : docs.filter(d => {
                if (!d.dovirenost_id) return true;
                return myDovIds && myDovIds.has(d.dovirenost_id);
            });

            visibleDocs.forEach(d => {
                if (!this._docs[d.red_folder_item_id]) this._docs[d.red_folder_item_id] = [];
                this._docs[d.red_folder_item_id].push(d);
            });
            this._renderTable();
        } catch (e) {
            const el = document.getElementById('rf-content');
            if (el) el.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-muted)">${Fmt.esc(e.message)}</div>`;
        }
    },

    _renderTable() {
        const el = document.getElementById('rf-content');
        if (!el) return;
        const canManage = AppState.isAdmin();
        if (!this._items.length) {
            el.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);font-size:.88rem">
                <i class="fa-regular fa-folder-open" style="font-size:2rem;color:rgba(239,68,68,.3);display:block;margin-bottom:.5rem"></i>
                Таблиця порожня
            </div>`;
            return;
        }
        const rows = this._items.map((item, idx) => {
            const itemDocs = this._docs[item.id] || [];
            const ico = item.icon && item.icon !== 'fa-circle' ? this._iconOptions.find(o => o.icon === item.icon) : null;
            const docsHtml = `
                <div class="rf-doc-list">
                    ${itemDocs.map(d => `
                        <div class="rf-doc-item">
                            <button class="rf-doc-link" data-path="${Fmt.esc(d.storage_path||'')}" onclick="RedFolderPage._openDoc(this.dataset.path)">
                                ${d.dovirenosti?.name ? Fmt.esc(d.dovirenosti.name) : `<i class="fa-solid fa-file-pdf" style="margin-right:.3rem;font-size:.72rem"></i>${Fmt.esc(d.title)}`}
                            </button>
                            ${canManage ? `<button class="rf-doc-del" onclick="RedFolderPage._deleteDoc('${d.id}')" title="Видалити файл"><i class="fa-solid fa-trash"></i></button>` : ''}
                        </div>`).join('')}
                    ${canManage ? `<button class="rf-upload-btn" onclick="RedFolderPage._uploadModal('${item.id}',${JSON.stringify(item.title).replace(/"/g,'&quot;')})"><i class="fa-solid fa-plus"></i> Завантажити</button>` : ''}
                </div>`;
            return `
            <tr class="rf-tr">
                <td class="rf-num">${idx + 1}</td>
                <td class="rf-cell">
                    ${Fmt.esc(item.title)}
                    ${canManage ? `
                    <div class="rf-row-actions">
                        <button class="rf-action-btn" onclick="RedFolderPage._openModal('${item.id}')"><i class="fa-solid fa-pen"></i> Редагувати</button>
                        <button class="rf-action-btn danger" onclick="RedFolderPage._delete('${item.id}')"><i class="fa-solid fa-trash"></i> Видалити рядок</button>
                    </div>` : ''}
                </td>
                <td class="rf-cell" style="width:250px">${docsHtml}</td>
                <td class="rf-cell" style="width:200px">
                    ${(ico ? `<i class="fa-solid ${Fmt.esc(item.icon)}" style="margin-right:.35rem;color:${ico.color}"></i>` : '') + Fmt.esc(item.responsible || '')}
                </td>
            </tr>`;
        }).join('');

        el.innerHTML = `
        <table class="rf-table">
            <thead>
                <tr>
                    <th>№</th>
                    <th>Назва документу</th>
                    <th style="width:250px">Документи</th>
                    <th style="width:200px">Відповідальний</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
    },

    _openModal(id) {
        if (!AppState.isAdmin()) return;
        const item = id ? this._items.find(i => i.id === id) : null;
        const curIcon = item?.icon || '';
        const iconPicker = this._iconOptions.map(o => `
            <button type="button" class="rf-icon-opt${curIcon === o.icon ? ' rf-icon-opt-active' : ''}"
                    data-icon="${o.icon}" title="${Fmt.esc(o.label)}"
                    onclick="RedFolderPage._pickIcon(this)"
                    style="--ic:${o.color}">
                <i class="fa-solid ${o.icon}" style="color:${o.color}"></i>
                <span>${Fmt.esc(o.label)}</span>
            </button>`).join('');
        Modal.open({
            title: item ? 'Редагувати рядок' : 'Додати рядок',
            size: 'lg',
            body: `
            <input type="hidden" id="rf-inp-icon" value="${Fmt.esc(curIcon)}">
            <div class="rf-form">
                <div>
                    <label>Назва документу <span style="color:var(--danger)">*</span></label>
                    <input id="rf-inp-title" value="${item ? Fmt.esc(item.title) : ''}" placeholder="Введіть назву документу">
                </div>
                <div>
                    <label>Відповідальний</label>
                    <input id="rf-inp-responsible" value="${item ? Fmt.esc(item.responsible || '') : ''}" placeholder="ПІБ або відділ">
                </div>
                <div>
                    <label>Іконка відповідального</label>
                    <div class="rf-icon-row">${iconPicker}</div>
                </div>
            </div>`,
            footer: `
                <button class="btn btn-ghost btn-sm" onclick="Modal.close()">Скасувати</button>
                <button class="btn btn-sm" style="background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;border:none" onclick="RedFolderPage._save(${JSON.stringify(id || null).replace(/"/g,'&quot;')})">
                    <i class="fa-solid fa-check"></i> Зберегти
                </button>`
        });
        setTimeout(() => document.getElementById('rf-inp-title')?.focus(), 50);
    },

    _pickIcon(btn) {
        document.querySelectorAll('.rf-icon-opt').forEach(b => b.classList.remove('rf-icon-opt-active'));
        btn.classList.add('rf-icon-opt-active');
        document.getElementById('rf-inp-icon').value = btn.dataset.icon;
    },

    async _save(id) {
        const title = Dom.val('rf-inp-title').trim();
        const responsible = Dom.val('rf-inp-responsible').trim();
        const icon = document.getElementById('rf-inp-icon')?.value || null;
        if (!title) { Toast.warning('Заповніть назву документу'); return; }
        const fields = { title, responsible, icon: icon || null };
        try {
            Loader.show();
            if (id) {
                await API.redFolderItems.update(id, fields);
            } else {
                const maxNum = this._items.length ? Math.max(...this._items.map(i => i.number)) : 0;
                await API.redFolderItems.create({ ...fields, number: maxNum + 1 });
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

    async _delete(id) {
        const confirmed = await Modal.confirm({ message: 'Видалити цей рядок?', danger: true, confirmText: 'Видалити' });
        if (!confirmed) return;
        try {
            Loader.show();
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
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
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

    async _openDoc(storagePath) {
        try {
            Loader.show();
            const url = await API.resources.getSignedUrl(storagePath);
            window.open(url, '_blank', 'noopener,noreferrer');
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

    async init(container) {
        UI.setBreadcrumb([{ label: 'Червона папка' }]);
        this._injectStyles();
        container.innerHTML = `<div id="rf-tab-area"></div>`;
        await this.renderInTab(document.getElementById('rf-tab-area'));
    }
};
