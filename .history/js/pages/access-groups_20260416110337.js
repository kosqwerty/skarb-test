// ================================================================
// LMS — Групи доступу до ресурсів
// ================================================================

const AccessGroupsPage = {
    _groups:    [],
    _dirs:      null,
    _sel:       { cities: [], positions: [], departments: [], labels: [] },
    _editingId: null,
    _stylesOk:  false,

    // ── CSS (inject once) ────────────────────────────────────────
    _css() {
        if (this._stylesOk) return;
        this._stylesOk = true;
        const s = document.createElement('style');
        s.id = 'ag-styles';
        s.textContent = `
/* ── Access Groups grid ── */
.ag-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:1rem;margin-top:1rem}
.ag-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.25rem;transition:box-shadow .2s,transform .2s;display:flex;flex-direction:column;gap:.5rem}
.ag-card:hover{box-shadow:0 6px 28px rgba(0,0,0,.1);transform:translateY(-2px)}
.ag-card-hd{display:flex;align-items:flex-start;gap:.75rem}
.ag-ico{width:44px;height:44px;border-radius:var(--radius-md);background:var(--bg-raised);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.35rem;flex-shrink:0}
.ag-card-nm{font-weight:700;font-size:.925rem;line-height:1.3}
.ag-card-sub{font-size:.76rem;color:var(--text-muted);margin-top:.15rem}
.ag-chips{display:flex;gap:.35rem;flex-wrap:wrap}
.ag-chip{font-size:.7rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:20px;padding:2px 9px;color:var(--text-secondary);white-space:nowrap}
.ag-desc{font-size:.8rem;color:var(--text-muted);line-height:1.5;margin:0}
.ag-card-ft{display:flex;gap:.4rem;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:.75rem;margin-top:auto}
/* ── Inline form ── */
.ag-form{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.5rem;margin-top:1rem}
.ag-form-hd{display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid var(--border)}
.ag-form-title{font-size:1.05rem;font-weight:700}
.ag-form-actions{display:flex;gap:.75rem;justify-content:flex-end;margin-top:1.5rem;padding-top:1rem;border-top:1px solid var(--border)}
/* ── 4-column multiselect ── */
.ag-cols{display:grid;grid-template-columns:repeat(4,1fr);gap:.65rem}
@media(max-width:820px){.ag-cols{grid-template-columns:repeat(2,1fr)}}
@media(max-width:500px){.ag-cols{grid-template-columns:1fr}}
.ag-col{border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;display:flex;flex-direction:column;background:var(--bg-raised)}
.ag-col-hd{display:flex;align-items:center;justify-content:space-between;padding:.5rem .7rem;background:var(--bg-card);border-bottom:1px solid var(--border);gap:.4rem;min-height:36px}
.ag-col-ttl{font-weight:700;font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ag-bdg{font-size:.66rem;border-radius:20px;padding:2px 7px;white-space:nowrap;flex-shrink:0;transition:all .15s;font-weight:600}
.ag-bdg-active{background:var(--primary);color:#fff}
.ag-bdg-any{background:var(--bg-raised);color:var(--text-muted);border:1px solid var(--border)}
.ag-srch{padding:.4rem .4rem .25rem;border-bottom:1px solid var(--border)}
.ag-srch input{width:100%;padding:.28rem .55rem;font-size:.78rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-card);color:var(--text-primary);outline:none;box-sizing:border-box;transition:border-color .15s}
.ag-srch input:focus{border-color:var(--primary);box-shadow:0 0 0 2px rgba(99,102,241,.12)}
.ag-list{flex:1;max-height:220px;overflow-y:auto;padding:.25rem 0}
.ag-list::-webkit-scrollbar{width:4px}
.ag-list::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
.ag-itm{padding:.38rem .7rem;font-size:.8rem;cursor:pointer;transition:background .12s,color .12s;user-select:none;color:var(--text-secondary);display:flex;align-items:center;gap:.35rem}
.ag-itm:hover{background:var(--bg-hover);color:var(--text-primary)}
.ag-itm-any{font-style:italic;border-bottom:1px solid var(--border);margin-bottom:.2rem;padding-bottom:.45rem}
.ag-itm-any.ag-sel{color:var(--primary);background:rgba(99,102,241,.06);font-style:normal;font-weight:600}
.ag-itm-any.ag-sel::before{content:'✦ '}
.ag-sel{background:rgba(99,102,241,.08);color:var(--primary);font-weight:500}
.ag-sel:not(.ag-itm-any)::before{content:'✓  '}
.ag-empty{padding:.5rem .7rem;font-size:.75rem;color:var(--text-muted);font-style:italic}
.ag-hint{font-size:.78rem;color:var(--text-secondary);margin:.25rem 0 .8rem;padding:.55rem .75rem;background:var(--bg-raised);border-radius:var(--radius-md);border:1px solid var(--border);line-height:1.55}`;
        document.head.appendChild(s);
    },

    // ── Render admin tab (list view) ─────────────────────────────
    async renderTab(container) {
        this._css();
        container.innerHTML = '<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>';
        try {
            this._groups = await API.accessGroups.getAll();
        } catch (e) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
            return;
        }
        this._renderList(container);
    },

    _container() { return document.getElementById('admin-content'); },

    _renderList(container) {
        container = container || this._container();
        if (!container) return;
        container.innerHTML = `
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1.25rem;gap:.75rem;flex-wrap:wrap">
                <div>
                    <div style="font-weight:700;font-size:1.05rem">Групи доступу до ресурсів</div>
                    <div style="font-size:.8rem;color:var(--text-muted);margin-top:.2rem">
                        Задайте умови (місто · посада · підрозділ · мітка) — ресурс відображається лише відповідним користувачам
                    </div>
                </div>
                <button class="btn btn-primary" onclick="AccessGroupsPage.openForm()">+ Нова група</button>
            </div>
            <div class="ag-grid">
                ${this._groups.map(g => this._cardHtml(g)).join('')}
                ${!this._groups.length ? `
                    <div class="empty-state" style="grid-column:1/-1">
                        <div class="empty-icon">🔐</div>
                        <h3>Немає груп доступу</h3>
                        <p>Створіть першу групу, щоб контролювати доступ до ресурсів.</p>
                        <button class="btn btn-primary" style="margin-top:.5rem" onclick="AccessGroupsPage.openForm()">+ Нова група</button>
                    </div>` : ''}
            </div>`;
    },

    _cardHtml(g) {
        const cities = g.cities?.map(c => c.city)           || [];
        const pos    = g.positions?.map(p => p.position)     || [];
        const depts  = g.departments?.map(d => d.department) || [];
        const lbls   = g.labels?.map(l => l.label)           || [];
        const chips  = [
            cities.length && `🏙 ${cities.slice(0,2).join(', ')}${cities.length>2?` +${cities.length-2}`:''}`,
            pos.length    && `💼 ${pos.slice(0,2).join(', ')}${pos.length>2?` +${pos.length-2}`:''}`,
            depts.length  && `🏢 ${depts.slice(0,2).join(', ')}${depts.length>2?` +${depts.length-2}`:''}`,
            lbls.length   && `🏷 ${lbls.slice(0,3).join(', ')}${lbls.length>3?` +${lbls.length-3}`:''}`,
        ].filter(Boolean);
        const esc = JSON.stringify(g).replace(/"/g,'&quot;');
        return `
            <div class="ag-card">
                <div class="ag-card-hd">
                    <div class="ag-ico">${g.is_public ? '🌐' : '🔐'}</div>
                    <div style="flex:1;min-width:0">
                        <div class="ag-card-nm truncate">${g.name}</div>
                        <div class="ag-card-sub">${g.is_public ? 'Доступно всім' : (chips.length ? 'Обмежений доступ' : 'Без обмежень')}</div>
                    </div>
                    <span class="badge ${g.is_public ? 'badge-success' : 'badge-muted'}">${g.is_public ? 'Публічна' : 'Обмежена'}</span>
                </div>
                ${g.description ? `<p class="ag-desc">${g.description}</p>` : ''}
                ${chips.length ? `<div class="ag-chips">${chips.map(c=>`<span class="ag-chip">${c}</span>`).join('')}</div>` : ''}
                <div class="ag-card-ft">
                    <button class="btn btn-ghost btn-sm" onclick="AccessGroupsPage.openMembers('${g.id}')">👥 Учасники</button>
                    <button class="btn btn-ghost btn-sm" onclick="AccessGroupsPage.openForm(${esc})">✏️ Редагувати</button>
                    <button class="btn btn-danger btn-sm" style="margin-left:auto"
                            onclick="AccessGroupsPage.deleteGroup('${g.id}','${g.name.replace(/'/g,"\\'").replace(/"/g,'\\"')}')">🗑</button>
                </div>
            </div>`;
    },

    // ── Directories cache ────────────────────────────────────────
    async _loadDirs(force = false) {
        if (this._dirs && !force) return this._dirs;
        const [cities, positions, subdivisions, labels] = await Promise.all([
            API.directories.getAll('cities').catch(() => []),
            API.directories.getAll('positions').catch(() => []),
            API.directories.getAll('subdivisions').catch(() => []),
            API.accessGroups.getDistinctLabels().catch(() => [])
        ]);
        this._dirs = {
            cities:      cities.map(c => c.name),
            positions:   positions.map(p => p.name),
            departments: subdivisions.map(s => s.name),
            labels
        };
        return this._dirs;
    },

    // ── Inline form (create / edit) ──────────────────────────────
    async openForm(group = null) {
        this._css();
        this._editingId = group?.id || null;
        this._sel = {
            cities:      group?.cities?.map(c => c.city)           || [],
            positions:   group?.positions?.map(p => p.position)     || [],
            departments: group?.departments?.map(d => d.department) || [],
            labels:      group?.labels?.map(l => l.label)           || []
        };

        const container = this._container();
        if (!container) return;
        container.innerHTML = '<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>';

        let dirs;
        try { dirs = await this._loadDirs(); }
        catch(e) { Toast.error('Помилка', e.message); this._renderList(container); return; }

        const isEdit = !!group;
        container.innerHTML = `
            <!-- Breadcrumb row -->
            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem">
                <button class="btn btn-ghost btn-sm" onclick="AccessGroupsPage.cancelForm()">← Назад</button>
                <span style="color:var(--text-muted)">›</span>
                <span style="font-weight:600">${isEdit ? 'Редагувати групу' : 'Нова група доступу'}</span>
            </div>

            <div class="ag-form">
                <!-- Header -->
                <div class="ag-form-hd">
                    <div class="ag-ico" style="font-size:1.5rem">${isEdit ? '✏️' : '🔐'}</div>
                    <div>
                        <div class="ag-form-title">${isEdit ? 'Редагувати групу доступу' : 'Нова група доступу'}</div>
                        <div style="font-size:.8rem;color:var(--text-muted)">
                            Задайте назву та умови — хто зможе бачити прив'язані ресурси
                        </div>
                    </div>
                </div>

                <!-- Base fields -->
                <div class="form-row">
                    <div class="form-group" style="flex:2">
                        <label>Назва *</label>
                        <input id="ag-name" type="text" value="${group?.name || ''}" placeholder="Назва групи доступу">
                    </div>
                    <div class="form-group" style="flex:1;display:flex;align-items:flex-end">
                        <label class="checkbox-item" style="cursor:pointer;user-select:none">
                            <input type="checkbox" id="ag-public" ${group?.is_public ? 'checked' : ''}
                                   onchange="AccessGroupsPage._onPublicChange(this.checked)">
                            <span>🌐 Доступно всім</span>
                        </label>
                    </div>
                </div>
                <div class="form-group">
                    <label>Опис</label>
                    <textarea id="ag-desc" placeholder="Необов'язковий опис">${group?.description || ''}</textarea>
                </div>

                <!-- Restrictions -->
                <div id="ag-rest" style="${group?.is_public ? 'opacity:.4;pointer-events:none' : ''}">
                    <div class="ag-hint">
                        Користувач отримує доступ, якщо відповідає <strong>ВСІМ</strong> заповненим умовам.<br>
                        Порожня колонка = будь-яке значення. Для Міток — достатньо збігу <strong>хоча б однієї</strong>.
                    </div>
                    <div class="ag-cols">
                        ${this._colHtml('cities',      '🏙 Міста',       dirs.cities,      'Будь-яке місто')}
                        ${this._colHtml('positions',   '💼 Посади',      dirs.positions,   'Будь-яка посада')}
                        ${this._colHtml('departments', '🏢 Підрозділи',  dirs.departments, 'Будь-який підрозділ')}
                        ${this._colHtml('labels',      '🏷 Мітки',       dirs.labels,      'Будь-яка мітка')}
                    </div>
                </div>

                <!-- Actions -->
                <div class="ag-form-actions">
                    <button class="btn btn-secondary" onclick="AccessGroupsPage.cancelForm()">Скасувати</button>
                    <button class="btn btn-primary" onclick="AccessGroupsPage.save()">
                        ${isEdit ? '💾 Зберегти зміни' : '✓ Створити групу'}
                    </button>
                </div>
            </div>`;
    },

    cancelForm() {
        this._renderList(this._container());
    },

    _colHtml(type, title, items, anyLabel) {
        const sel      = this._sel[type] || [];
        const anyActive = !sel.length;
        return `
            <div class="ag-col">
                <div class="ag-col-hd">
                    <span class="ag-col-ttl">${title}</span>
                    <span class="ag-bdg ${anyActive ? 'ag-bdg-any' : 'ag-bdg-active'}" id="ag-bdg-${type}">
                        ${anyActive ? 'Будь-яке' : sel.length + ' вибр.'}
                    </span>
                </div>
                <div class="ag-srch">
                    <input type="text" placeholder="Пошук..." oninput="AccessGroupsPage._filter('${type}', this.value)">
                </div>
                <div class="ag-list" id="ag-lst-${type}">
                    <div class="ag-itm ag-itm-any ${anyActive ? 'ag-sel' : ''}" onclick="AccessGroupsPage._clearSel('${type}')">
                        ${anyLabel}
                    </div>
                    ${items.length
                        ? items.map(v => `
                            <div class="ag-itm ${sel.includes(v) ? 'ag-sel' : ''}"
                                 data-v="${v.replace(/"/g,'&quot;')}"
                                 onclick="AccessGroupsPage._toggle('${type}', this.dataset.v)">
                                ${v}
                            </div>`).join('')
                        : `<div class="ag-empty">Довідник порожній</div>`
                    }
                </div>
            </div>`;
    },

    _onPublicChange(isPublic) {
        const el = document.getElementById('ag-rest');
        if (el) { el.style.opacity = isPublic ? '.4' : '1'; el.style.pointerEvents = isPublic ? 'none' : ''; }
    },

    _filter(type, q) {
        const list = document.getElementById(`ag-lst-${type}`);
        if (!list) return;
        list.querySelectorAll('.ag-itm:not(.ag-itm-any)').forEach(el => {
            el.style.display = (el.dataset.v || '').toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
        });
    },

    _toggle(type, value) {
        const arr = this._sel[type];
        const idx = arr.indexOf(value);
        if (idx === -1) arr.push(value); else arr.splice(idx, 1);
        this._refreshCol(type);
    },

    _clearSel(type) {
        this._sel[type] = [];
        this._refreshCol(type);
    },

    _refreshCol(type) {
        const list = document.getElementById(`ag-lst-${type}`);
        const bdg  = document.getElementById(`ag-bdg-${type}`);
        if (!list) return;
        const sel      = this._sel[type];
        const anyActive = !sel.length;
        if (bdg) {
            bdg.textContent = anyActive ? 'Будь-яке' : `${sel.length} вибр.`;
            bdg.className = `ag-bdg ${anyActive ? 'ag-bdg-any' : 'ag-bdg-active'}`;
        }
        list.querySelectorAll('.ag-itm').forEach(el => {
            if (el.classList.contains('ag-itm-any')) {
                el.classList.toggle('ag-sel', anyActive);
            } else {
                el.classList.toggle('ag-sel', sel.includes(el.dataset.v || ''));
            }
        });
    },

    // ── Save ─────────────────────────────────────────────────────
    async save() {
        const name = Dom.val('ag-name').trim();
        if (!name) { Toast.error('Помилка', 'Вкажіть назву групи'); return; }
        const is_public   = document.getElementById('ag-public')?.checked || false;
        const description = Dom.val('ag-desc').trim() || null;

        Loader.show();
        try {
            const payload = { name, description, is_public, ...this._sel };
            if (this._editingId) {
                await API.accessGroups.update(this._editingId, payload);
                Toast.success('Збережено', 'Групу оновлено');
            } else {
                await API.accessGroups.create(payload);
                Toast.success('Створено', 'Нову групу доступу додано');
            }
            this._groups = await API.accessGroups.getAll();
            this._renderList(this._container());
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    // ── Delete ───────────────────────────────────────────────────
    async deleteGroup(id, name) {
        const ok = await Modal.confirm({
            title: 'Видалити групу',
            message: `Видалити групу «${name}»?<br><br>Ресурси, прив'язані до цієї групи, стануть доступні публічно.`,
            confirmText: 'Видалити',
            danger: true
        });
        if (!ok) return;
        Loader.show();
        try {
            await API.accessGroups.delete(id);
            Toast.success('Видалено');
            this._groups = await API.accessGroups.getAll();
            this._renderList(this._container());
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    // ── Members preview (modal залишається) ─────────────────────
    async openMembers(id) {
        Loader.show();
        try {
            const [group, members] = await Promise.all([
                API.accessGroups.getById(id),
                API.accessGroups.getMembers(id)
            ]);
            const esc = JSON.stringify(members).replace(/"/g,'&quot;');
            Modal.open({
                title: `👥 Учасники: ${group.name}`,
                size: 'lg',
                body: `
                    <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-bottom:1rem">
                        <span class="badge ${group.is_public ? 'badge-success' : 'badge-muted'}">
                            ${group.is_public ? '🌐 Публічна' : '🔐 Обмежена'}
                        </span>
                        <span style="color:var(--text-muted);font-size:.875rem">
                            ${group.is_public
                                ? 'Доступ мають усі активні користувачі'
                                : `Знайдено: <strong>${members.length}</strong> користувачів, що відповідають умовам`}
                        </span>
                    </div>
                    <div class="table-wrapper" style="max-height:370px;overflow-y:auto">
                        <table>
                            <thead><tr><th>ПІБ</th><th>Посада</th><th>Підрозділ</th><th>Місто</th><th>Мітка</th></tr></thead>
                            <tbody>
                                ${members.length
                                    ? members.map(u => `
                                        <tr>
                                            <td>
                                                <div style="font-weight:600;font-size:.875rem">${u.full_name || '—'}</div>
                                                <div style="font-size:.72rem;color:var(--text-muted)">${u.email || ''}</div>
                                            </td>
                                            <td style="font-size:.8rem">${u.job_position || '—'}</td>
                                            <td style="font-size:.8rem">${u.subdivision || '—'}</td>
                                            <td style="font-size:.8rem">${u.city || '—'}</td>
                                            <td>${u.label ? `<span class="badge badge-warning" style="font-size:.7rem">${u.label}</span>` : '—'}</td>
                                        </tr>`).join('')
                                    : `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted)">Жодного користувача не знайдено</td></tr>`}
                            </tbody>
                        </table>
                    </div>`,
                footer: `
                    <button class="btn btn-secondary" onclick="Modal.close()">Закрити</button>
                    ${members.length ? `<button class="btn btn-success" onclick="AccessGroupsPage._exportMembers(${esc},'${group.name.replace(/'/g,"\\'")}')">📊 Експорт</button>` : ''}`
            });
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    _exportMembers(members, name) {
        Excel.export(members.map(u => ({
            'ПІБ': u.full_name || '', 'Email': u.email || '',
            'Посада': u.job_position || '', 'Підрозділ': u.subdivision || '',
            'Місто': u.city || '', 'Мітка': u.label || ''
        })), `group_${name}`, name);
    },

    // ── Frontend access check (used by ResourcesPage) ────────────
    checkAccess(group) {
        if (!group) return true;
        if (group.is_public) return true;
        if (AppState.isStaff()) return true;
        const p = AppState.profile;
        if (!p) return false;
        const cities = group.cities?.map(c => c.city)           || [];
        const pos    = group.positions?.map(x => x.position)     || [];
        const depts  = group.departments?.map(x => x.department) || [];
        const lbls   = group.labels?.map(x => x.label)           || [];
        if (cities.length && !cities.includes(p.city))           return false;
        if (pos.length    && !pos.includes(p.job_position))       return false;
        if (depts.length  && !depts.includes(p.subdivision))     return false;
        if (lbls.length   && !lbls.includes(p.label))            return false;
        return true;
    }
};
