// ================================================================
// Куточок споживача — обов'язкові документи відокремленого підрозділу
// ================================================================

const BranchDocsPage = {

    _blocks: [],  // loaded from DB

    _injectStyles() {
        if (document.getElementById('bd-styles')) return;
        const s = document.createElement('style');
        s.id = 'bd-styles';
        s.textContent = `
            .bd-wrap { max-width: 960px; margin: 0 auto; }
            .bd-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: .75rem; }
            .bd-title { font-size: 1.25rem; font-weight: 800; }
            .bd-subtitle { font-size: .8rem; color: var(--text-muted); margin-top: .2rem; }
            .bd-label-badge { display: inline-flex; align-items: center; gap: .4rem; padding: .3rem .8rem; border-radius: 999px; font-size: .75rem; font-weight: 700; background: rgba(99,102,241,.1); color: var(--primary); border: 1px solid rgba(99,102,241,.2); }
            .bd-table { width: 100%; border-collapse: collapse; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-xl); overflow: hidden; box-shadow: var(--shadow-sm); }
            .bd-table thead th { background: var(--bg-raised); padding: .65rem 1rem; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-muted); text-align: left; border-bottom: 1px solid var(--border); }
            .bd-table thead th:first-child { width: 48px; text-align: center; }
            .bd-table thead th:last-child { width: 180px; }
            .bd-tr { border-bottom: 1px solid var(--border); transition: background .12s; }
            .bd-tr:last-child { border-bottom: none; }
            .bd-tr:hover { background: var(--bg-raised); }
            .bd-tr.bd-has-doc:hover { background: rgba(16,185,129,.04); }
            .bd-num { text-align: center; font-size: .85rem; font-weight: 700; color: var(--text-muted); padding: 1rem .5rem; vertical-align: top; }
            .bd-block-title { font-size: .85rem; font-weight: 600; color: var(--text-primary); line-height: 1.45; padding: .85rem 1rem .85rem 0; vertical-align: top; white-space: normal; word-break: break-word; min-width: 0; }
            .bd-dept { font-size: .72rem; color: var(--text-muted); margin-top: .25rem; }
            .bd-docs { padding: .75rem .5rem .75rem 0; vertical-align: top; }
            .bd-doc-list { display: flex; flex-direction: column; gap: .35rem; }
            .bd-doc-item { display: flex; align-items: center; gap: .5rem; }
            .bd-doc-main { display: flex; flex-direction: column; gap: .2rem; min-width: 0; }
            .bd-tov-badge { display: inline-flex; align-items: center; font-size: .68rem; color: var(--primary); padding-left: .2rem; background: none; border: none; cursor: pointer; font-family: inherit; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: underline; text-underline-offset: 2px; }
            .bd-tov-badge:hover { opacity: .75; }
            .bd-empty-doc { font-size: .78rem; color: var(--text-muted); font-style: italic; }
            .bd-action-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .25rem .6rem; border-radius: var(--radius-sm); border: 1px dashed var(--border); background: transparent; color: var(--text-muted); font-size: .72rem; cursor: pointer; transition: all .15s; font-family: inherit; flex-shrink: 0; }
            .bd-action-btn:hover { border-color: var(--primary); color: var(--primary); }
            .bd-action-btn.danger:hover { border-color: var(--danger); color: var(--danger); }
            .bd-block-actions { display: flex; gap: .3rem; align-items: center; flex-wrap: wrap; padding: .5rem 0; }
            .bd-no-docs { text-align: center; padding: 3rem 1rem; color: var(--text-muted); }
            .bd-inp { width:100%;padding:.55rem .8rem;border-radius:var(--radius-md);border:1px solid var(--border);background:var(--bg-surface);color:var(--text-primary);font-size:.88rem;font-family:inherit;outline:none;box-sizing:border-box }
            .bd-inp:focus { border-color: var(--primary); }
        `;
        document.head.appendChild(s);
    },

    async renderInTab(area) {
        this._injectStyles();
        const canManage = AppState.isAdmin();
        const seeAll = AppState.isAdmin() || AppState.isManager();
        let userDovIds = [];
        if (!canManage) {
            const dovs = await API.dovirenosti.getForProfile(AppState.user.id).catch(() => []);
            userDovIds = dovs.map(d => d.id);
        }
        area.innerHTML = `<div id="bd-content" style="padding:.25rem 0"><div class="bd-no-docs"><i class="fa-solid fa-spinner fa-spin"></i> Завантаження...</div></div>`;
        try {
            const [blocks, docs, myDovs] = await Promise.all([
                API.branchDocBlocks.getAll(),
                API.resources.getBranchDocs(null),
                seeAll ? Promise.resolve(null) : API.dovirenosti.getForProfile(AppState.user.id).catch(() => [])
            ]);
            this._blocks = blocks;
            const myDovIds = myDovs ? new Set(myDovs.map(d => d.id)) : null;
            const visibleDocs = seeAll ? docs : docs.filter(d => {
                if (!d.dovirenost_id) return true;
                return myDovIds && myDovIds.has(d.dovirenost_id);
            });
            this._render(visibleDocs, canManage);
        } catch(e) {
            const el = document.getElementById('bd-content');
            if (el) el.innerHTML = `<div class="bd-no-docs"><i class="fa-solid fa-triangle-exclamation"></i> ${Fmt.esc(e.message)}</div>`;
        }
    },

    async init(container) {
        UI.setBreadcrumb([{ label: 'Куточок споживача' }]);

        const canManage = AppState.isAdmin();
        const seeAll = AppState.isAdmin() || AppState.isManager();

        let userDovIds = [];
        if (!canManage) {
            const dovs = await API.dovirenosti.getForProfile(AppState.user.id).catch(() => []);
            userDovIds = dovs.map(d => d.id);
        }

        this._injectStyles();
        container.innerHTML = `
        <div class="bd-wrap">
            <div class="bd-header">
                <div>
                    <div class="bd-title"><i class="fa-solid fa-scale-balanced" style="color:var(--primary);margin-right:.5rem"></i>Куточок споживача</div>
                    <div class="bd-subtitle">Обов'язкові документи для розміщення у відокремленому підрозділі</div>
                </div>
                <div style="display:flex;gap:.5rem;align-items:center">
                    ${!canManage && userDovIds.length ? `<span class="bd-label-badge"><i class="fa-solid fa-tag"></i>${userDovIds.length} ТОВ</span>` : ''}
                    ${canManage ? `<button class="btn btn-primary btn-sm" onclick="BranchDocsPage._blockModal()"><i class="fa-solid fa-plus"></i> Додати блок</button>` : ''}
                </div>
            </div>
            <div id="bd-content"><div class="bd-no-docs"><i class="fa-solid fa-spinner fa-spin"></i> Завантаження...</div></div>
        </div>`;

        try {
            Loader.show();
            const [blocks, docs, myDovs] = await Promise.all([
                API.branchDocBlocks.getAll(),
                API.resources.getBranchDocs(null),
                seeAll ? Promise.resolve(null) : API.dovirenosti.getForProfile(AppState.user.id).catch(() => [])
            ]);
            this._blocks = blocks;
            const myDovIds = myDovs ? new Set(myDovs.map(d => d.id)) : null;
            const visibleDocs = seeAll ? docs : docs.filter(d => {
                if (!d.dovirenost_id) return true;
                return myDovIds && myDovIds.has(d.dovirenost_id);
            });
            this._render(visibleDocs, canManage);
        } catch(e) {
            document.getElementById('bd-content').innerHTML = `<div class="bd-no-docs"><i class="fa-solid fa-triangle-exclamation"></i> ${Fmt.esc(e.message)}</div>`;
        } finally {
            Loader.hide();
        }
    },

    _render(docs, canManage) {
        const byBlock = {};
        docs.forEach(d => {
            if (!byBlock[d.display_block]) byBlock[d.display_block] = [];
            byBlock[d.display_block].push(d);
        });

        const rows = this._blocks.map(b => {
            const blockDocs = byBlock[b.number] || [];
            const hasDoc = blockDocs.length > 0;
            return `
            <tr class="bd-tr${hasDoc ? ' bd-has-doc' : ''}">
                <td class="bd-num">${b.number}</td>
                <td class="bd-block-title">
                    ${Fmt.esc(b.title)}
                    ${canManage ? `
                    <div class="bd-block-actions">
                        <button class="bd-action-btn" onclick="BranchDocsPage._blockModal('${b.id}')"><i class="fa-solid fa-pen"></i> Редагувати</button>
                        <button class="bd-action-btn danger" onclick="BranchDocsPage._deleteBlock('${b.id}')"><i class="fa-solid fa-trash"></i> Видалити блок</button>
                    </div>` : ''}
                </td>
                <td class="bd-docs" style="width:220px">
                    <div class="bd-doc-list">
                        ${blockDocs.length ? blockDocs.map(d => `
                            <div class="bd-doc-item">
                                <div class="bd-doc-main">
                                    ${d.dovirenosti?.name ? `<button class="bd-tov-badge" data-path="${Fmt.esc(d.storage_path||'')}" onclick="BranchDocsPage._openDoc(this.dataset.path)"><i class="fa-solid fa-file-pdf" style="margin-right:.3rem;font-size:.72rem"></i>${Fmt.esc(d.dovirenosti.name)}</button>` : ''}
                                </div>
                                ${canManage ? `<button class="bd-action-btn danger" onclick="BranchDocsPage._deleteDoc('${d.id}')" title="Видалити файл"><i class="fa-solid fa-trash"></i></button>` : ''}
                            </div>`).join('') : `<span class="bd-empty-doc">Документ не завантажено</span>`}
                        ${canManage ? `<button class="bd-action-btn" onclick="BranchDocsPage._uploadModal(${b.number},${JSON.stringify(b.title).replace(/"/g,'&quot;')})"><i class="fa-solid fa-plus"></i> Завантажити</button>` : ''}
                    </div>
                </td>
                <td class="bd-block-title" style="width:200px;color:var(--text-secondary)">
                    ${b.dept ? `<span>
                        ${b.icon && b.icon !== 'fa-circle' ? `<i class="fa-solid ${Fmt.esc(b.icon)}" style="margin-right:.35rem;color:${this._iconOptions.find(o=>o.icon===b.icon)?.color||'var(--text-muted)'}"></i>` : ''}
                        ${Fmt.esc(b.dept)}
                    </span>` : `<span class="bd-empty-doc">—</span>`}
                </td>
            </tr>`;
        }).join('');

        document.getElementById('bd-content').innerHTML = `
            <table class="bd-table">
                <thead>
                    <tr>
                        <th>№</th>
                        <th>Назва документу</th>
                        <th style="width:220px">Документи</th>
                        <th style="width:200px">Відповідальний</th>
                    </tr>
                </thead>
                <tbody>${rows || `<tr><td colspan="4" class="bd-no-docs">Блоки не налаштовано</td></tr>`}</tbody>
            </table>`;
    },

    // ── Block CRUD ────────────────────────────────────────────────────

    _iconOptions: [
        { icon: 'fa-scale-balanced', label: 'Юристи',         color: '#6366f1' },
        { icon: 'fa-laptop-code',    label: 'Тех. підтримка',  color: '#0ea5e9' },
        { icon: 'fa-building',       label: 'Адміністрація',   color: '#64748b' },
        { icon: 'fa-file-contract',  label: 'Договори',        color: '#f59e0b' },
        { icon: 'fa-shield-halved',  label: 'Безпека',         color: '#10b981' },
        { icon: 'fa-users',          label: 'HR / Персонал',   color: '#8b5cf6' },
        { icon: 'fa-circle',         label: 'Без іконки',      color: '#94a3b8' },
    ],

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

        Modal.open({
            title: b ? 'Редагувати блок' : 'Додати блок',
            size: 'lg',
            body: `
            <style>
                .bd-icon-row{display:flex;flex-wrap:wrap;gap:.4rem}
                .bd-icon-opt{display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .65rem;border-radius:var(--radius-md);border:1.5px solid var(--border);background:var(--bg-raised);cursor:pointer;font-size:.75rem;font-family:inherit;color:var(--text-secondary);transition:all .15s}
                .bd-icon-opt:hover{border-color:var(--ic);color:var(--text-primary)}
                .bd-icon-opt-active{border-color:var(--ic)!important;background:color-mix(in srgb,var(--ic) 10%,transparent);color:var(--text-primary)!important}
            </style>
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
        if (!title || !number) { Toast.warning('Заповніть обов\'язкові поля'); return; }
        try {
            Loader.show();
            if (id) {
                await API.branchDocBlocks.update(id, { number, title, dept, icon, order_index: number });
            } else {
                await API.branchDocBlocks.create({ number, title, dept, icon, order_index: number });
            }
            Modal.close();
            Toast.success(id ? 'Блок оновлено' : 'Блок додано');
            const [blocks, docs] = await Promise.all([API.branchDocBlocks.getAll(), API.resources.getBranchDocs(null)]);
            this._blocks = blocks;
            this._render(docs, true);
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    },

    async _deleteBlock(id) {
        if (!await Modal.confirm({ message: 'Видалити блок? Документи в ньому залишаться в системі.', danger: true })) return;
        try {
            Loader.show();
            await API.branchDocBlocks.remove(id);
            Toast.success('Блок видалено');
            const [blocks, docs] = await Promise.all([API.branchDocBlocks.getAll(), API.resources.getBranchDocs(null)]);
            this._blocks = blocks;
            this._render(docs, true);
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    },

    // ── Document actions ──────────────────────────────────────────────

    async _openDoc(storagePath) {
        try {
            Loader.show();
            const url = await API.resources.getSignedUrl(storagePath);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    },

    async _printDoc(storagePath) {
        try {
            Loader.show();
            const url = await API.resources.getSignedUrl(storagePath);
            const win = window.open(url, '_blank', 'noopener,noreferrer');
            if (win) win.addEventListener('load', () => win.print(), { once: true });
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
            const docs = await API.resources.getBranchDocs(null);
            this._render(docs, true);
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    },

    async _deleteDoc(id) {
        if (!await Modal.confirm({ message: 'Видалити документ?', danger: true })) return;
        try {
            Loader.show();
            await API.resources.delete(id);
            Toast.success('Видалено');
            const docs = await API.resources.getBranchDocs(null);
            this._render(docs, true);
        } catch(e) { Toast.error('Помилка', e.message); } finally { Loader.hide(); }
    }
};
