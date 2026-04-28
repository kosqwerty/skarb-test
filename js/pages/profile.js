// ================================================================
// EduFlow LMS — Unified Profile Editor
// Used by both AdminPage.openEditUser (isAdminEdit=true)
// and App.editProfile (isAdminEdit=false, editing own profile)
// ================================================================

const ProfilePage = {

    _pendingAvatar: null, // { file } | { delete: true } | null
    _onBack: null,        // callback: what to do after save or cancel

    // ── Entry points ─────────────────────────────────────────────

    // Called by AdminPage when editing any user
    async openAsAdmin(container, user, onBack) {
        await this._render(container, user, { isAdminEdit: true }, onBack);
    },

    // Called by App when editing own profile
    async openAsSelf(container, onBack) {
        const profile = AppState.profile;
        await this._render(container, profile, { isAdminEdit: false }, onBack);
    },

    // ── Core render ──────────────────────────────────────────────

    async _render(container, user, opts, onBack) {
        this._pendingAvatar = null;
        this._onBack = onBack || null;

        const isAdminEdit   = opts.isAdminEdit && AppState.isAdmin();
        const canExtended   = isAdminEdit || AppState.isStaff();
        const canRole       = isAdminEdit;
        const canEmail      = true;

        // Label permission: can edit only if your role rank >= rank of whoever set the label
        const ROLE_RANK     = { user: 0, smm: 1, teacher: 1, manager: 2, admin: 3, owner: 4 };
        const myRank        = ROLE_RANK[AppState.profile?.role] ?? 0;
        const labelSetByRank = ROLE_RANK[user.label_set_by] ?? 0;
        const canLabel      = (isAdminEdit || AppState.isStaff()) && myRank >= labelSetByRank;

        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        const [cities, positions, subdivisions, allUsers] = await Promise.all([
            API.directories.getAll('cities').catch(() => []),
            canExtended ? API.directories.getAll('positions').catch(() => [])    : Promise.resolve([]),
            canExtended ? API.directories.getAll('subdivisions').catch(() => []) : Promise.resolve([]),
            canExtended ? API.profiles.getAll({ pageSize: 500 }).then(r => r.data).catch(() => []) : Promise.resolve([])
        ]);

        const mgItems = allUsers
            .filter(u => u.id !== user.id)
            .map(u => ({ value: u.id, label: u.full_name + (u.job_position ? ' · ' + u.job_position : '') }));

        const avatarInner = user.avatar_url
            ? `<img id="pe-avatar-img" src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : `<span id="pe-avatar-initials" style="font-size:2rem;font-weight:700;color:#fff">${Fmt.initials(user.full_name)}</span>`;

        const titleText = isAdminEdit
            ? `✏️ Редагувати користувача`
            : `✏️ Мій профіль`;

        container.innerHTML = `
    <div class="user-create-container">
        <div class="create-header">
            <button class="back-btn" onclick="ProfilePage._cancel()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                Назад
            </button>
            <h2 class="create-title"><span class="title-icon">👤</span> ${titleText}</h2>
        </div>

        <div class="create-form-grid">

            <!-- Колонка 1: Аватар + Особисті дані -->
            <div class="form-section glass-panel">
                <div class="section-header">
                    <span class="section-badge">1</span>
                    <h4>Особисті дані</h4>
                </div>

                <!-- Аватар -->
                <div style="display:flex;flex-direction:column;align-items:center;gap:.75rem;margin-bottom:1.25rem">
                    <div id="pe-avatar-wrap" style="width:96px;height:96px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;position:relative;cursor:pointer" onclick="document.getElementById('pe-avatar-input').click()" title="Змінити аватар">
                        ${avatarInner}
                        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;opacity:0;transition:.2s" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0">
                            <span style="font-size:1.4rem">📷</span>
                        </div>
                    </div>
                    <input id="pe-avatar-input" type="file" accept="image/*" style="display:none" onchange="ProfilePage._previewAvatar('${user.id}', this)">
                    <div style="display:flex;gap:.5rem">
                        <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('pe-avatar-input').click()">📷 Змінити</button>
                        ${user.avatar_url ? `<button id="pe-avatar-delete-btn" type="button" class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="ProfilePage._removeAvatarPreview('${user.id}')">🗑 Видалити</button>` : ''}
                    </div>
                </div>

                <div class="input-group">
                    <label class="input-label"><span>Прізвище</span><input id="pe-last-name" type="text" value="${user.last_name || ''}"></label>
                    <label class="input-label"><span>Ім'я</span><input id="pe-first-name" type="text" value="${user.first_name || ''}"></label>
                    <label class="input-label"><span>По батькові</span><input id="pe-patronymic" type="text" value="${user.patronymic || ''}"></label>
                    <label class="input-label">
                        <span>Стать</span>
                        <div class="gender-picker-modern">
                            <input type="hidden" id="pe-gender" value="${user.gender || ''}">
                            <button type="button" class="gender-chip${user.gender==='male'?' active':''}" onclick="this.closest('.gender-picker-modern').querySelector('input').value='male';this.closest('.gender-picker-modern').querySelectorAll('.gender-chip').forEach(b=>b.classList.remove('active'));this.classList.add('active')"><span>♂</span>Чоловік</button>
                            <button type="button" class="gender-chip${user.gender==='female'?' active':''}" onclick="this.closest('.gender-picker-modern').querySelector('input').value='female';this.closest('.gender-picker-modern').querySelectorAll('.gender-chip').forEach(b=>b.classList.remove('active'));this.classList.add('active')"><span>♀</span>Жінка</button>
                        </div>
                    </label>
                    <div class="input-row-2col">
                        <label class="input-label"><span>Дата народження</span><input id="pe-birthdate" type="date" value="${user.birth_date || ''}" onpaste="Fmt.parseDatePaste(event,this)"></label>
                        <label class="input-label"><span>Телефон</span><input id="pe-phone" type="tel" value="${user.phone || ''}"></label>
                    </div>
                </div>
            </div>

            <!-- Колонка 2: Дані для входу -->
            <div class="form-section glass-panel">
                <div class="section-header">
                    <span class="section-badge">2</span>
                    <h4>Дані для входу</h4>
                </div>
                <div class="input-group">
                    ${canExtended ? `<label class="input-label"><span>Логін</span><input id="pe-login" type="text" value="${user.login || ''}" placeholder="ivan_ivanov"></label>` : ''}
                    <label class="input-label">
                        <span>Email</span>
                        <input id="pe-email" type="email" value="${user.email || ''}" placeholder="user@example.com">
                    </label>
                    <label class="input-label">
                        <span>Новий пароль</span>
                        <div style="position:relative">
                            <input id="pe-password" type="password" placeholder="Залиште порожнім щоб не змінювати" autocomplete="new-password" style="width:100%;box-sizing:border-box;padding-right:42px">
                            <button type="button" onclick="const i=document.getElementById('pe-password');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'👁':'🙈'"
                                style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.1rem;padding:0;line-height:1;color:var(--text-muted)">👁</button>
                        </div>
                        <small class="field-hint">Мінімум 6 символів</small>
                    </label>
                    ${!isAdminEdit ? `
                    <label class="input-label">
                        <span>Підтвердження пароля</span>
                        <div style="position:relative">
                            <input id="pe-password2" type="password" placeholder="Повторіть пароль" style="width:100%;box-sizing:border-box;padding-right:42px">
                            <button type="button" onclick="const i=document.getElementById('pe-password2');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'👁':'🙈'"
                                style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.1rem;padding:0;line-height:1;color:var(--text-muted)">👁</button>
                        </div>
                    </label>` : ''}
                    ${canRole ? `
                    <label class="input-label">
                        <span>Роль</span>
                        <div class="custom-select-wrapper">
                            <select id="pe-role" ${user.role === 'owner' ? 'disabled title="Змінюйте через передачу прав"' : ''}>
                                ${(AppState.isOwner() ? ['owner','admin','smm','teacher','manager','user'] : ['admin','smm','teacher','manager','user'])
                                    .map(r => `<option value="${r}" ${user.role===r?'selected':''}>${Fmt.role(r)}</option>`).join('')}
                            </select>
                        </div>
                    </label>` : ''}
                    ${(isAdminEdit || AppState.isStaff()) ? (() => {
                        const roleNames = { owner: 'Власника', admin: 'Адміна', manager: 'Менеджера', teacher: 'Викладача', smm: 'SMM' };
                        const setByHint = user.label && user.label_set_by
                            ? `<small class="field-hint">Встановлено: ${roleNames[user.label_set_by] || user.label_set_by}${canLabel ? '' : ' · Недостатньо прав для зміни'}</small>`
                            : '';
                        return canLabel
                            ? `<label class="input-label"><span>Мітка</span><input id="pe-label" type="text" value="${user.label || ''}" placeholder="Наприклад: Стажер, Блок">${setByHint}</label>`
                            : `<label class="input-label"><span>Мітка</span><input id="pe-label" type="text" value="${user.label || ''}" disabled style="opacity:.5;cursor:not-allowed">${setByHint}</label>`;
                    })() : ''}
                </div>
            </div>

            <!-- Колонка 3: Робота -->
            <div class="form-section glass-panel">
                <div class="section-header">
                    <span class="section-badge">3</span>
                    <h4>Робоча інформація</h4>
                </div>
                <div class="input-group">
                    <label class="input-label"><span>Місто</span>${CreatableSelect.html('pe-city', 'cities', cities.map(i=>i.name), user.city||'')}</label>
                    ${canExtended ? `
                    <label class="input-label"><span>Підрозділ</span>${CreatableSelect.html('pe-subdivision', 'subdivisions', subdivisions.map(i=>i.name), user.subdivision||'')}</label>
                    <label class="input-label"><span>Посада</span>${CreatableSelect.html('pe-job-position', 'positions', positions.map(i=>i.name), user.job_position||'')}</label>
                    <label class="input-label"><span>Керівник</span>${SearchSelect.html('pe-manager', mgItems, user.manager_id||'')}</label>
                    ` : `
                    <label class="input-label"><span>Підрозділ</span><input type="text" value="${user.subdivision || ''}" readonly style="opacity:.6;cursor:not-allowed"></label>
                    <label class="input-label"><span>Посада</span><input type="text" value="${user.job_position || ''}" readonly style="opacity:.6;cursor:not-allowed"></label>
                    `}
                    <label class="input-label"><span>Про себе</span><textarea id="pe-bio" style="padding:10px 14px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:16px;font-size:.95rem;color:var(--text-primary);font-family:inherit;outline:none;resize:vertical;min-height:80px">${user.bio || ''}</textarea></label>
                </div>
            </div>

        </div>

        <div class="form-actions">
            <button class="btn-secondary-modern" onclick="ProfilePage._cancel()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
                Скасувати
            </button>
            <button class="btn-primary-modern" onclick="ProfilePage._save('${user.id}', ${isAdminEdit})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v14a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Зберегти
            </button>
        </div>
    </div>

    <style>
        .user-create-container { max-width:1400px; padding:4px; animation:fadeSlideUp 0.4s cubic-bezier(0.16,1,0.3,1); }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .create-header { display:flex; align-items:center; gap:16px; margin-bottom:32px; }
        .back-btn { display:flex;align-items:center;gap:6px;padding:8px 16px;background:transparent;border:1px solid var(--border);border-radius:40px;color:var(--text-secondary);font-weight:500;font-size:.95rem;transition:all .2s;cursor:pointer; }
        .back-btn:hover { background:var(--bg-hover);border-color:var(--border-light);transform:translateX(-2px); }
        .create-title { display:flex;align-items:center;gap:10px;margin:0;font-size:1.9rem;font-weight:600;letter-spacing:-.02em;color:var(--text-primary); }
        .title-icon { font-size:1.8rem;line-height:1; }
        .create-form-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:10px; }
        .glass-panel { background:var(--bg-surface);border-radius:24px;padding:24px;box-shadow:var(--shadow-sm);border:1px solid var(--border);transition:box-shadow .3s ease,border-color .3s ease; }
        .glass-panel:focus-within { box-shadow:var(--shadow-md);border-color:var(--border-light); }
        .section-header { display:flex;align-items:center;gap:12px;margin-bottom:24px;padding-bottom:12px;border-bottom:1px dashed var(--border); }
        .section-badge { display:flex;align-items:center;justify-content:center;width:28px;height:28px;background:var(--primary-glow);color:var(--primary);border-radius:12px;font-weight:700;font-size:14px; }
        .section-header h4 { margin:0;font-size:1.1rem;font-weight:600;color:var(--text-primary); }
        .input-group { display:flex;flex-direction:column;gap:20px; }
        .input-row-2col { display:grid;grid-template-columns:1fr 1fr;gap:16px; }
        .input-label { display:flex;flex-direction:column;gap:6px;font-size:.9rem;font-weight:500;color:var(--text-secondary); }
        .input-label input, .input-label select, .custom-select-wrapper select { padding:10px 14px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:16px;font-size:.95rem;color:var(--text-primary);transition:all .15s ease;font-family:inherit;outline:none; }
        .input-label input:hover { border-color:var(--border-light); }
        .input-label input:focus, .input-label select:focus { border-color:var(--primary);box-shadow:0 0 0 4px var(--primary-glow); }
        .input-label input::placeholder { color:var(--text-muted);font-weight:400;opacity:.7; }
        .field-hint { margin-top:4px;color:var(--text-muted);font-size:.8rem;font-weight:400; }
        .gender-picker-modern { display:flex;gap:10px; }
        .gender-chip { flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 0;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:40px;font-weight:500;color:var(--text-secondary);cursor:pointer;transition:all .15s; }
        .gender-chip span { font-size:18px; }
        .gender-chip.active { background:var(--primary-glow);border-color:var(--primary);color:var(--primary);font-weight:600; }
        .form-actions { display:flex;justify-content:flex-end;gap:16px;margin-top:40px;padding-top:16px;border-top:1px solid var(--border); }
        .btn-primary-modern, .btn-secondary-modern { display:flex;align-items:center;gap:8px;padding:12px 28px;border-radius:48px;font-weight:600;font-size:1rem;border:none;cursor:pointer;transition:all .2s;line-height:1; }
        .btn-primary-modern { background:var(--primary);color:white;box-shadow:0 4px 12px var(--primary-glow); }
        .btn-primary-modern:hover { background:var(--primary-dark);transform:scale(1.02);box-shadow:0 8px 18px var(--primary-glow); }
        .btn-secondary-modern { background:transparent;color:var(--text-secondary);border:1.5px solid var(--border); }
        .btn-secondary-modern:hover { background:var(--bg-hover);border-color:var(--border-light); }
        @media(max-width:1000px) { .create-form-grid{grid-template-columns:1fr;gap:16px} .create-title{font-size:1.5rem} }
        .input-label > div[class*="select"] { width:100%; }
    </style>`;

        CreatableSelect.init();
    },

    // ── Avatar preview (local only, no upload yet) ────────────────

    _previewAvatar(userId, input) {
        const file = input.files[0];
        if (!file) return;
        this._pendingAvatar = { file };
        const url = URL.createObjectURL(file);
        const wrap = document.getElementById('pe-avatar-wrap');
        if (wrap) {
            wrap.querySelector('img,span[id]')?.remove();
            wrap.insertAdjacentHTML('afterbegin', `<img id="pe-avatar-img" src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`);
        }
        if (!document.getElementById('pe-avatar-delete-btn')) {
            document.querySelector('[onclick*="pe-avatar-input"]')
                ?.insertAdjacentHTML('afterend', `<button id="pe-avatar-delete-btn" type="button" class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="ProfilePage._removeAvatarPreview('${userId}')">🗑 Видалити</button>`);
        }
    },

    _removeAvatarPreview(userId) {
        this._pendingAvatar = { delete: true };
        const wrap = document.getElementById('pe-avatar-wrap');
        if (wrap) {
            wrap.querySelector('img,span[id]')?.remove();
            wrap.insertAdjacentHTML('afterbegin', `<span id="pe-avatar-initials" style="font-size:2rem;font-weight:700;color:#fff">${Fmt.initials('')}</span>`);
        }
        document.getElementById('pe-avatar-delete-btn')?.remove();
    },

    // ── Save ──────────────────────────────────────────────────────

    async _save(userId, isAdminEdit) {
        const newPassword  = (document.getElementById('pe-password')?.value || '').trim();
        const newPassword2 = (document.getElementById('pe-password2')?.value || '').trim();

        if (newPassword && newPassword.length < 6) {
            Toast.error('Помилка', 'Пароль має бути не менше 6 символів'); return;
        }
        if (!isAdminEdit && newPassword && newPassword !== newPassword2) {
            Toast.error('Помилка', 'Паролі не співпадають'); return;
        }

        Loader.show();
        try {
            // Avatar upload/delete
            let avatarUrl;
            if (this._pendingAvatar?.file) {
                const file = this._pendingAvatar.file;
                const path = `${userId}/avatar`;
                await supabase.storage.from(APP_CONFIG.buckets.avatars).remove([path]);
                const { error: upErr } = await supabase.storage.from(APP_CONFIG.buckets.avatars).upload(path, file, { upsert: true, contentType: file.type });
                if (upErr) throw new Error('Аватар: ' + upErr.message);
                avatarUrl = `${APP_CONFIG.storagePublicUrl}/${APP_CONFIG.buckets.avatars}/${path}?t=${Date.now()}`;
            } else if (this._pendingAvatar?.delete) {
                avatarUrl = null;
            }
            this._pendingAvatar = null;

            // Build profile payload
            const canExtended = isAdminEdit || AppState.isStaff();
            const canRole     = isAdminEdit && AppState.isAdmin();
            const canLabel    = isAdminEdit || AppState.isStaff();

            const payload = {
                last_name:   Dom.val('pe-last-name').trim()  || null,
                first_name:  Dom.val('pe-first-name').trim() || null,
                patronymic:  Dom.val('pe-patronymic').trim() || null,
                gender:      Dom.val('pe-gender')  || null,
                birth_date:  Dom.val('pe-birthdate') || null,
                phone:       Dom.val('pe-phone').trim() || null,
                city:        Dom.val('pe-city') || null,
                bio:         Dom.val('pe-bio').trim() || null,
            };

            if (canExtended) {
                payload.login        = Dom.val('pe-login').trim() || null;
                payload.subdivision  = Dom.val('pe-subdivision') || null;
                payload.job_position = Dom.val('pe-job-position') || null;
                payload.manager_id   = Dom.val('pe-manager') || null;
            }
            if (canRole)  payload.role  = Dom.val('pe-role');
            if (canLabel) {
                const newLabel = Dom.val('pe-label').trim() || null;
                payload.label = newLabel;
                payload.label_set_by = newLabel ? (AppState.profile?.role || null) : null;
            }
            if (avatarUrl !== undefined) payload.avatar_url = avatarUrl;

            const updated = await API.profiles.update(userId, payload);

            // Email change
            const newEmail = Dom.val('pe-email').trim();
            if (newEmail && newEmail !== updated.email) {
                if (isAdminEdit && AppState.isAdmin()) {
                    const { error: emailErr } = await supabase.rpc('admin_update_user_email', { p_user_id: userId, p_email: newEmail });
                    if (emailErr) throw new Error('Email: ' + emailErr.message);
                } else {
                    const { error: emailErr } = await supabase.auth.updateUser({ email: newEmail });
                    if (emailErr) throw new Error('Email: ' + emailErr.message);
                    Toast.info?.('Підтвердження', 'На новий email надіслано листа для підтвердження');
                }
            }

            // Password change
            if (newPassword) {
                if (isAdminEdit) {
                    const { error: pwdErr } = await supabase.rpc('admin_update_user_password', { p_user_id: userId, p_password: newPassword });
                    if (pwdErr) throw new Error('Пароль: ' + pwdErr.message);
                } else {
                    const { error: pwdErr } = await supabase.auth.updateUser({ password: newPassword });
                    if (pwdErr) throw new Error('Пароль: ' + pwdErr.message);
                }
            }

            // Update local state if editing own profile
            if (userId === AppState.user?.id) {
                AppState.profile = updated;
                UI.renderSidebarUser(updated);
                UI.renderNavigation(updated.role);
            }

            Toast.success('Збережено');
            this._onBack?.();
        } catch(e) {
            Toast.error('Помилка', e.message);
        } finally { Loader.hide(); }
    },

    // ── Cancel ────────────────────────────────────────────────────

    _cancel() {
        this._pendingAvatar = null;
        this._onBack?.();
    }
};
