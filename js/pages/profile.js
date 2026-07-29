// ================================================================
// EduFlow LMS — Unified Profile Editor
// Used by both AdminPage.openEditUser (isAdminEdit=true)
// and App.editProfile (isAdminEdit=false, editing own profile)
// ================================================================

const ProfilePage = {

    _pendingAvatar: null,
    _onBack: null,

    _tenureStr(dateStr) {
        if (!dateStr) return '';
        const from  = new Date(dateStr);
        const today = new Date();
        let years  = today.getFullYear() - from.getFullYear();
        let months = today.getMonth()    - from.getMonth();
        if (months < 0) { years--; months += 12; }
        const parts = [];
        if (years > 0)  parts.push(`${years} ${years === 1 ? 'рік' : years < 5 ? 'роки' : 'років'}`);
        if (months > 0) parts.push(`${months} міс.`);
        if (!parts.length) parts.push('менше місяця');
        return parts.join(' ');
    },

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


        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        const [cities, positions, subdivisions, allUsers, allDovirenosti, userDovirenosti] = await Promise.all([
            API.directories.getAll('cities').catch(() => []),
            canExtended ? API.directories.getAll('positions').catch(() => [])    : Promise.resolve([]),
            canExtended ? API.directories.getAll('subdivisions').catch(() => []) : Promise.resolve([]),
            canExtended ? API.profiles.getAll({ pageSize: 500 }).then(r => r.data).catch(() => []) : Promise.resolve([]),
            isAdminEdit ? API.dovirenosti.getAll().catch(() => [])                    : Promise.resolve([]),
            isAdminEdit ? API.dovirenosti.getForProfile(user.id).catch(() => [])      : Promise.resolve([])
        ]);

        const mgItems = allUsers
            .filter(u => u.id !== user.id && u.role === 'manager')
            .map(u => ({ value: u.id, label: u.full_name + (u.job_position ? ' · ' + u.job_position : '') }));

        const avatarInner = user.avatar_url
            ? `<img id="pe-avatar-img" src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
            : `<span id="pe-avatar-initials" style="font-size:1.7rem;font-weight:700;color:#fff">${Fmt.initials(user.full_name)}</span>`;

        const titleText = isAdminEdit ? 'Редагувати користувача' : 'Мій профіль';

        container.innerHTML = `
    <div class="cuf-container">
        <div class="cuf-topbar">
            <button class="btn-back" onclick="ProfilePage._cancel()">
                <i class="fa-solid fa-arrow-left"></i> Назад
            </button>
            <div class="cuf-heading">
                <span class="cuf-heading-ico"><i class="fa-solid fa-user-pen"></i></span>
                <h2>${titleText}</h2>
            </div>
        </div>

        <div class="cuf-grid">

            <!-- Секция 1: Аватар + ПІБ -->
            <div class="cuf-card">
                <div class="cuf-card-head">
                    <span class="cuf-badge">1</span>
                    <h4>Особисті дані</h4>
                    <span class="cuf-head-ico"><i class="fa-solid fa-user"></i></span>
                </div>
                <div class="cuf-fields">
                    <div class="cuf-avatar-row">
                        <div id="pe-avatar-wrap" class="cuf-avatar-wrap" onclick="document.getElementById('pe-avatar-input').click()" title="Змінити аватар">
                            ${avatarInner}
                            <div class="cuf-avatar-overlay"><i class="fa-solid fa-camera"></i></div>
                        </div>
                        <input id="pe-avatar-input" type="file" accept="image/*" style="display:none" onchange="ProfilePage._previewAvatar('${user.id}', this)">
                        <div class="cuf-avatar-btns">
                            <button type="button" class="cuf-btn-ghost cuf-btn-xs" onclick="document.getElementById('pe-avatar-input').click()"><i class="fa-solid fa-camera"></i> Змінити</button>
                            ${user.avatar_url ? `<button id="pe-avatar-delete-btn" type="button" class="cuf-btn-ghost cuf-btn-xs" style="color:var(--cuf-danger)" onclick="ProfilePage._removeAvatarPreview('${user.id}')"><i class="fa-solid fa-trash"></i> Видалити</button>` : ''}
                        </div>
                    </div>
                    <label class="cuf-label">
                        <span>Прізвище</span>
                        <div class="cuf-field"><input id="pe-last-name" type="text" value="${Fmt.esc(user.last_name || '')}"></div>
                    </label>
                    <label class="cuf-label">
                        <span>Ім'я</span>
                        <div class="cuf-field"><input id="pe-first-name" type="text" value="${Fmt.esc(user.first_name || '')}"></div>
                    </label>
                    <label class="cuf-label">
                        <span>По батькові</span>
                        <div class="cuf-field"><input id="pe-patronymic" type="text" value="${Fmt.esc(user.patronymic || '')}" oninput="applyGenderFromPatronymic('pe-patronymic','pe-gender')"></div>
                    </label>
                    <label class="cuf-label">
                        <span>Стать</span>
                        <div class="cuf-gender">
                            <input type="hidden" id="pe-gender" value="${user.gender || ''}">
                            <button type="button" class="cuf-gender-chip${user.gender==='male'?' active':''}" onclick="this.closest('.cuf-gender').querySelector('input').value='male';this.closest('.cuf-gender').querySelectorAll('.cuf-gender-chip').forEach(b=>b.classList.remove('active'));this.classList.add('active')"><span>♂</span> Чоловік</button>
                            <button type="button" class="cuf-gender-chip${user.gender==='female'?' active':''}" onclick="this.closest('.cuf-gender').querySelector('input').value='female';this.closest('.cuf-gender').querySelectorAll('.cuf-gender-chip').forEach(b=>b.classList.remove('active'));this.classList.add('active')"><span>♀</span> Жінка</button>
                        </div>
                    </label>
                    <div class="cuf-row-2">
                        <label class="cuf-label">
                            <span>Дата народження</span>
                            <div class="cuf-field">
                                <i class="fa-regular fa-calendar cuf-ico"></i>
                                <input id="pe-birthdate" type="date" class="cuf-has-ico" value="${user.birth_date || ''}" onpaste="Fmt.parseDatePaste(event,this)">
                            </div>
                            <select id="pe-bd-privacy" class="cuf-bd-privacy">
                                <option value="full"    ${(user.birth_date_privacy||'full')==='full'    ? 'selected' : ''}>👁 Показувати повністю</option>
                                <option value="no_year" ${(user.birth_date_privacy||'full')==='no_year' ? 'selected' : ''}>🙈 Приховати рік</option>
                                <option value="hidden"  ${(user.birth_date_privacy||'full')==='hidden'  ? 'selected' : ''}>🔒 Приховати повністю</option>
                            </select>
                        </label>
                        <label class="cuf-label">
                            <span>Телефон</span>
                            <div class="cuf-field"><input id="pe-phone" type="tel" value="${Fmt.esc(user.phone || '')}"></div>
                        </label>
                    </div>
                </div>
            </div>

            <!-- Секция 2: Доступ -->
            <div class="cuf-card">
                <div class="cuf-card-head">
                    <span class="cuf-badge">2</span>
                    <h4>Дані для входу</h4>
                    <span class="cuf-head-ico"><i class="fa-solid fa-lock"></i></span>
                </div>
                <div class="cuf-fields">
                    ${canExtended ? `
                    <label class="cuf-label">
                        <span>Логін</span>
                        <div class="cuf-field"><i class="fa-solid fa-user cuf-ico"></i><input id="pe-login" type="text" class="cuf-has-ico" value="${Fmt.esc(user.login || '')}" placeholder="ivan_ivanov"></div>
                    </label>` : ''}
                    <label class="cuf-label">
                        <span>Email</span>
                        <div class="cuf-field"><i class="fa-solid fa-envelope cuf-ico"></i><input id="pe-email" type="email" class="cuf-has-ico" value="${Fmt.esc(user.email || '')}" placeholder="user@example.com"></div>
                    </label>
                    <label class="cuf-label">
                        <span>Новий пароль</span>
                        <div class="cuf-field">
                            <i class="fa-solid fa-lock cuf-ico"></i>
                            <input id="pe-password" type="password" class="cuf-has-ico" placeholder="Залиште порожнім щоб не змінювати" autocomplete="new-password" style="padding-right:42px">
                            <button type="button" class="cuf-eye-btn"
                                onclick="const i=document.getElementById('pe-password');i.type=i.type==='password'?'text':'password';this.innerHTML=i.type==='password'?'<i class=&quot;fa-solid fa-eye&quot;></i>':'<i class=&quot;fa-solid fa-eye-slash&quot;></i>'">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                        </div>
                        <span class="cuf-hint">Мінімум 6 символів</span>
                    </label>
                    ${!isAdminEdit ? `
                    <label class="cuf-label">
                        <span>Підтвердження пароля</span>
                        <div class="cuf-field">
                            <i class="fa-solid fa-lock cuf-ico"></i>
                            <input id="pe-password2" type="password" class="cuf-has-ico" placeholder="Повторіть пароль" style="padding-right:42px">
                            <button type="button" class="cuf-eye-btn"
                                onclick="const i=document.getElementById('pe-password2');i.type=i.type==='password'?'text':'password';this.innerHTML=i.type==='password'?'<i class=&quot;fa-solid fa-eye&quot;></i>':'<i class=&quot;fa-solid fa-eye-slash&quot;></i>'">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                        </div>
                    </label>` : ''}
                    ${canRole ? `
                    <label class="cuf-label">
                        <span>Роль</span>
                        <div class="cuf-field">
                            <i class="fa-solid fa-shield-halved cuf-ico"></i>
                            <select id="pe-role" class="cuf-select cuf-has-ico" ${user.role === 'superadmin' ? 'disabled title="Змінюйте через передачу прав"' : ''}>
                                ${(AppState.isSuperAdmin() ? ['superadmin','ceo','admin','smm','manager','user','intern'] : ['ceo','admin','smm','manager','user','intern'])
                                    .map(r => `<option value="${r}" ${user.role===r?'selected':''}>${Fmt.role(r)}</option>`).join('')}
                            </select>
                            <i class="fa-solid fa-chevron-down cuf-chev"></i>
                        </div>
                    </label>` : ''}
                </div>
            </div>

            <!-- Секция 3: Работа -->
            <div class="cuf-card">
                <div class="cuf-card-head">
                    <span class="cuf-badge">3</span>
                    <h4>Робоча інформація</h4>
                    <span class="cuf-head-ico"><i class="fa-solid fa-briefcase"></i></span>
                </div>
                <div class="cuf-fields">
                    <label class="cuf-label">
                        <span>Місто</span>
                        <div class="cuf-field cuf-field-embed"><i class="fa-solid fa-location-dot cuf-ico"></i>${CreatableSelect.html('pe-city', 'cities', cities.map(i=>i.name), user.city||'')}</div>
                    </label>
                    ${canExtended ? `
                    <label class="cuf-label">
                        <span>Підрозділ</span>
                        <div class="cuf-field cuf-field-embed"><i class="fa-solid fa-building cuf-ico"></i>${CreatableSelect.html('pe-subdivision', 'subdivisions', subdivisions.map(i=>i.name), user.subdivision||'')}</div>
                    </label>
                    <label class="cuf-label">
                        <span>Посада</span>
                        <div class="cuf-field cuf-field-embed"><i class="fa-solid fa-briefcase cuf-ico"></i>${CreatableSelect.html('pe-job-position', 'positions', positions.map(i=>i.name), user.job_position||'')}</div>
                    </label>
                    <label class="cuf-label">
                        <span>Керівник</span>
                        <div class="cuf-field cuf-field-embed"><i class="fa-solid fa-user-tie cuf-ico"></i>${SearchSelect.html('pe-manager', mgItems, user.manager_id||'')}</div>
                    </label>
                    ${isAdminEdit ? `
                    <label class="cuf-label">
                        <span>Довіреність</span>
                        <div class="cuf-field cuf-field-embed cuf-field-embed-cms"><i class="fa-solid fa-file-lines cuf-ico"></i>${CreatableMultiSelect.html('pe-dovirenosti')}</div>
                    </label>` : ''}
                    <div class="cuf-row-2">
                        <label class="cuf-label">
                            <span>Дата оформлення</span>
                            <div class="cuf-field"><i class="fa-regular fa-calendar cuf-ico"></i><input id="pe-hired-at" type="date" class="cuf-has-ico" value="${user.hired_at || ''}" onpaste="Fmt.parseDatePaste(event,this)"></div>
                        </label>
                        <label class="cuf-label">
                            <span>На посаді з</span>
                            <div class="cuf-field"><i class="fa-regular fa-calendar cuf-ico"></i><input id="pe-position-since" type="date" class="cuf-has-ico" value="${user.position_since || ''}" onpaste="Fmt.parseDatePaste(event,this)"></div>
                        </label>
                    </div>
                    ` : `
                    <label class="cuf-label"><span>Підрозділ</span><div class="cuf-field"><input type="text" value="${Fmt.esc(user.subdivision || '')}" readonly style="opacity:.6;cursor:not-allowed"></div></label>
                    <label class="cuf-label"><span>Посада</span><div class="cuf-field"><input type="text" value="${Fmt.esc(user.job_position || '')}" readonly style="opacity:.6;cursor:not-allowed"></div></label>
                    ${(user.hired_at || user.position_since) ? `<div class="cuf-row-2" style="margin-top:2px">
                        ${user.hired_at ? `<div class="cuf-tenure-card">
                            <div class="cuf-tenure-label">В компанії з</div>
                            <div class="cuf-tenure-val">${Fmt.date(user.hired_at)}</div>
                            <div class="cuf-tenure-sub">${ProfilePage._tenureStr(user.hired_at)}</div>
                        </div>` : '<div></div>'}
                        ${user.position_since ? `<div class="cuf-tenure-card">
                            <div class="cuf-tenure-label">На посаді з</div>
                            <div class="cuf-tenure-val">${Fmt.date(user.position_since)}</div>
                            <div class="cuf-tenure-sub">${ProfilePage._tenureStr(user.position_since)}</div>
                        </div>` : '<div></div>'}
                    </div>` : ''}
                    `}
                    <label class="cuf-label">
                        <span>Про себе</span>
                        <textarea id="pe-bio" class="cuf-textarea">${user.bio || ''}</textarea>
                    </label>
                </div>
            </div>

        </div>

        <!-- Футер с кнопками -->
        <div class="cuf-footer">
            <div class="cuf-footer-hint">
                <span class="cuf-footer-ico"><i class="fa-solid fa-circle-info"></i></span>
                <div>
                    <div>Зміни набудуть чинності одразу після збереження</div>
                    <div class="cuf-footer-sub">Перевірте правильність введених даних перед збереженням</div>
                </div>
            </div>
            <div class="cuf-footer-actions">
                <button class="cuf-btn-ghost" onclick="ProfilePage._cancel()">
                    <i class="fa-solid fa-xmark"></i> Скасувати
                </button>
                <button class="cuf-btn-gold" onclick="ProfilePage._save('${user.id}', ${isAdminEdit})">
                    <i class="fa-solid fa-floppy-disk"></i> Зберегти
                </button>
            </div>
        </div>
    </div>

    <style>
        .cuf-container {
            /* Dark theme (default) — treasury gold-on-navy */
            --cuf-card-bg: linear-gradient(160deg,#0e1226 0%,#131a35 55%,#1b2350 100%);
            --cuf-card-border: rgba(232,199,106,.28);
            --cuf-card-border-focus: rgba(232,199,106,.6);
            --cuf-gold: #e8c76a;
            --cuf-gold-soft: rgba(232,199,106,.16);
            --cuf-gold-glow: rgba(232,199,106,.4);
            --cuf-gold-grad: linear-gradient(135deg,#fff3cc,#e8c76a 55%,#d4af37);
            --cuf-gold-ink: #241a04;
            --cuf-input-bg: rgba(255,255,255,.04);
            --cuf-input-border: rgba(255,255,255,.1);
            --cuf-text: #f1e9d2;
            --cuf-text-soft: rgba(241,233,210,.64);
            --cuf-text-mute: rgba(241,233,210,.4);
            --cuf-danger: #f87171;

            max-width: 1400px;
            padding: 4px;
            animation: cufFadeUp .45s cubic-bezier(.16,1,.3,1);
        }

        body.light-theme .cuf-container {
            /* Light theme — blue accent, той самий синій, що й кнопка "Додати ресурс" (var(--primary)) */
            --cuf-card-bg: linear-gradient(160deg,#eef4ff 0%,#e3edfe 100%);
            --cuf-card-border: rgba(42,94,232,.22);
            --cuf-card-border-focus: rgba(42,94,232,.55);
            --cuf-gold: #2A5EE8;
            --cuf-gold-soft: rgba(42,94,232,.1);
            --cuf-gold-glow: rgba(42,94,232,.28);
            --cuf-gold-grad: linear-gradient(135deg,#4d7bf0,#2A5EE8 60%,#1E4BB8);
            --cuf-gold-ink: #ffffff;
            --cuf-input-bg: #fbfdff;
            --cuf-input-border: #cfe0fb;
            --cuf-text: #0f1b33;
            --cuf-text-soft: #45557a;
            --cuf-text-mute: #8a97b8;
            --cuf-danger: #dc2626;
        }

        @keyframes cufFadeUp {
            from { opacity: 0; transform: translateY(14px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .cuf-topbar { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }

        .cuf-heading { display: flex; align-items: center; gap: 12px; }
        .cuf-heading-ico {
            width: 34px; height: 34px; border-radius: 11px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            background: var(--cuf-gold-grad); color: var(--cuf-gold-ink);
            font-size: .92rem; box-shadow: 0 6px 18px var(--cuf-gold-glow);
        }
        .cuf-heading h2 {
            margin: 0; font-size: 1.35rem; font-weight: 800;
            letter-spacing: -0.02em; color: var(--text-primary);
        }

        .cuf-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

        .cuf-card {
            background: var(--cuf-card-bg);
            border: 1.5px solid var(--cuf-card-border);
            border-radius: 22px;
            padding: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,.22);
            position: relative;
            transition: border-color .25s ease, box-shadow .25s ease;
        }
        .cuf-card::before {
            content: ''; position: absolute; inset: 0; pointer-events: none;
            border-radius: inherit;
            background: radial-gradient(circle at 92% -12%, var(--cuf-gold-soft), transparent 55%);
        }
        .cuf-card:focus-within {
            border-color: var(--cuf-card-border-focus);
            box-shadow: 0 14px 36px rgba(0,0,0,.28), 0 0 0 3px var(--cuf-gold-soft);
        }

        .cuf-card-head {
            display: flex; align-items: center; gap: 12px;
            margin-bottom: 12px; padding-bottom: 10px;
            border-bottom: 1px dashed var(--cuf-card-border);
            position: relative; z-index: 1;
        }
        .cuf-badge {
            width: 30px; height: 30px; border-radius: 10px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            background: var(--cuf-gold-grad); color: var(--cuf-gold-ink);
            font-weight: 800; font-size: .85rem;
            box-shadow: 0 4px 12px var(--cuf-gold-glow);
        }
        .cuf-card-head h4 {
            flex: 1; margin: 0; font-size: 1.05rem; font-weight: 700;
            color: var(--cuf-text); letter-spacing: -0.01em;
        }
        .cuf-head-ico {
            width: 30px; height: 30px; border-radius: 10px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            background: var(--cuf-gold-soft); color: var(--cuf-gold); font-size: .85rem;
        }

        .cuf-fields { display: flex; flex-direction: column; gap: 10px; position: relative; z-index: 1; }
        .cuf-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .cuf-label {
            display: flex; flex-direction: column; gap: 4px;
            font-size: .78rem; font-weight: 600; color: var(--cuf-text-soft);
        }
        .cuf-req { color: var(--cuf-danger); margin-left: 2px; }

        .cuf-field { position: relative; display: flex; align-items: center; }
        .cuf-field input, .cuf-field select {
            width: 100%; box-sizing: border-box;
            padding: 8px 14px; border-radius: 12px;
            background: var(--cuf-input-bg); border: 1.5px solid var(--cuf-input-border);
            color: var(--cuf-text); font-size: .9rem; font-family: inherit; outline: none;
            transition: all .15s ease;
        }
        .cuf-field textarea {
            width: 100%; box-sizing: border-box;
            padding: 8px 14px; border-radius: 12px;
            background: var(--cuf-input-bg); border: 1.5px solid var(--cuf-input-border);
            color: var(--cuf-text); font-size: .9rem; font-family: inherit; outline: none;
            transition: all .15s ease; resize: vertical; min-height: 80px;
        }
        .cuf-textarea {
            width: 100%; box-sizing: border-box;
            padding: 8px 14px; border-radius: 12px;
            background: var(--cuf-input-bg); border: 1.5px solid var(--cuf-input-border);
            color: var(--cuf-text); font-size: .9rem; font-family: inherit; outline: none;
            transition: all .15s ease; resize: vertical; min-height: 80px;
        }
        .cuf-field input::placeholder { color: var(--cuf-text-mute); font-weight: 400; }
        .cuf-field input:hover, .cuf-field select:hover, .cuf-field textarea:hover, .cuf-textarea:hover { border-color: var(--cuf-gold-glow); }
        .cuf-field input:focus, .cuf-field select:focus, .cuf-field textarea:focus, .cuf-textarea:focus {
            border-color: var(--cuf-gold); box-shadow: 0 0 0 4px var(--cuf-gold-soft);
        }
        .cuf-ico {
            position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
            color: var(--cuf-gold); font-size: .82rem; z-index: 2; pointer-events: none;
        }
        .cuf-field input.cuf-has-ico, .cuf-field select.cuf-has-ico { padding-left: 40px; }
        .cuf-select { appearance: none; -webkit-appearance: none; cursor: pointer; padding-right: 34px; }
        .cuf-chev {
            position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
            color: var(--cuf-text-mute); font-size: .72rem; pointer-events: none;
        }

        /* Embedded CreatableSelect / SearchSelect / CreatableMultiSelect widgets */
        .cuf-field-embed { width: 100%; }
        .cuf-field-embed > div { width: 100%; }
        .cuf-field-embed .cs-input,
        .cuf-field-embed .ss-input { padding-left: 40px !important; }
        .cuf-field-embed-cms .cms-field { padding-left: 34px; }

        /* Gender picker */
        .cuf-gender { display: flex; gap: 10px; }
        .cuf-gender-chip {
            flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
            padding: 7px 0; background: var(--cuf-input-bg); border: 1.5px solid var(--cuf-input-border);
            border-radius: 40px; font-weight: 600; color: var(--cuf-text-soft);
            cursor: pointer; transition: all .15s; font-family: inherit;
        }
        .cuf-gender-chip span { font-size: 16px; }
        .cuf-gender-chip.active { background: var(--cuf-gold-soft); border-color: var(--cuf-gold); color: var(--cuf-gold); }

        /* Avatar */
        .cuf-avatar-row { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 4px; }
        .cuf-avatar-wrap {
            width: 84px; height: 84px; border-radius: 50%; flex-shrink: 0;
            background: var(--cuf-gold-grad); display: flex; align-items: center; justify-content: center;
            overflow: hidden; position: relative; cursor: pointer;
            border: 2px solid var(--cuf-card-border);
        }
        .cuf-avatar-overlay {
            position: absolute; inset: 0; border-radius: 50%; background: rgba(0,0,0,.4);
            display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.1rem;
            opacity: 0; transition: opacity .2s;
        }
        .cuf-avatar-wrap:hover .cuf-avatar-overlay { opacity: 1; }
        .cuf-avatar-btns { display: flex; gap: 8px; }
        .cuf-btn-xs { padding: 5px 12px; font-size: .74rem; border-radius: 10px; }

        /* Birth-date privacy select */
        .cuf-bd-privacy {
            margin-top: 2px; font-size: .76rem; padding: 6px 10px; border-radius: 10px;
            background: var(--cuf-input-bg); border: 1.5px solid var(--cuf-input-border);
            color: var(--cuf-text-soft); cursor: pointer; font-family: inherit; outline: none;
        }
        .cuf-bd-privacy:focus { border-color: var(--cuf-gold); }

        /* Read-only tenure cards (self-edit, no company-field access) */
        .cuf-tenure-card { padding: 8px 12px; background: var(--cuf-input-bg); border: 1.5px solid var(--cuf-input-border); border-radius: 14px; }
        .cuf-tenure-label { font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--cuf-text-mute); margin-bottom: 2px; }
        .cuf-tenure-val { font-size: .88rem; font-weight: 600; color: var(--cuf-text); }
        .cuf-tenure-sub { font-size: .72rem; color: var(--cuf-text-mute); margin-top: 1px; }

        /* Password extras */
        .cuf-eye-btn {
            position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
            background: none; border: none; cursor: pointer; color: var(--cuf-text-mute);
            padding: 4px; display: flex; align-items: center; z-index: 3;
        }
        .cuf-eye-btn:hover { color: var(--cuf-gold); }
        .cuf-hint { font-size: .72rem; color: var(--cuf-text-mute); white-space: nowrap; font-weight: 400; }

        /* Footer */
        .cuf-footer {
            display: flex; align-items: center; justify-content: space-between; gap: 20px;
            margin-top: 14px; padding: 12px 18px; border-radius: 16px;
            background: var(--cuf-gold-soft); border: 1px solid var(--cuf-card-border);
            flex-wrap: wrap;
        }
        .cuf-footer-hint { display: flex; align-items: flex-start; gap: 12px; font-size: .82rem; color: var(--text-secondary); }
        .cuf-footer-ico {
            width: 30px; height: 30px; border-radius: 10px; flex-shrink: 0;
            display: flex; align-items: center; justify-content: center;
            background: var(--cuf-gold-grad); color: var(--cuf-gold-ink); font-size: .8rem;
        }
        .cuf-footer-sub { color: var(--text-muted); margin-top: 2px; }
        .cuf-footer-actions { display: flex; gap: 12px; }

        .cuf-btn-ghost {
            display: inline-flex; align-items: center; gap: 8px; padding: 9px 20px; border-radius: 12px;
            background: transparent; border: 1.5px solid var(--border); color: var(--text-secondary);
            font-weight: 600; font-size: .88rem; cursor: pointer; transition: all .2s; font-family: inherit;
        }
        .cuf-btn-ghost:hover { background: var(--bg-hover); border-color: var(--border-light); }
        .cuf-btn-gold {
            display: inline-flex; align-items: center; gap: 8px; padding: 9px 24px; border-radius: 12px;
            background: var(--cuf-gold-grad); border: none; color: var(--cuf-gold-ink);
            font-weight: 700; font-size: .88rem; cursor: pointer; transition: all .2s;
            box-shadow: 0 6px 18px var(--cuf-gold-glow);
        }
        .cuf-btn-gold:hover { transform: translateY(-1px); box-shadow: 0 10px 24px var(--cuf-gold-glow); }
        .cuf-btn-gold:active, .cuf-btn-ghost:active { transform: scale(.97); }

        /* Responsive */
        @media (max-width: 1000px) {
            .cuf-grid { grid-template-columns: 1fr; }
            .cuf-heading h2 { font-size: 1.35rem; }
            .cuf-footer { flex-direction: column; align-items: flex-start; }
        }
        @media (prefers-reduced-motion: reduce) {
            .cuf-container { animation: none; }
        }
    </style>`;

        CreatableSelect.init();


        if (isAdminEdit) {
            CreatableMultiSelect.init(
                'pe-dovirenosti',
                allDovirenosti.map(d => ({ id: d.id, name: d.name })),
                userDovirenosti.map(d => ({ id: d.id, name: d.name }))
            );
        }
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
                ?.insertAdjacentHTML('afterend', `<button id="pe-avatar-delete-btn" type="button" class="cuf-btn-ghost cuf-btn-xs" style="color:var(--cuf-danger)" onclick="ProfilePage._removeAvatarPreview('${userId}')"><i class="fa-solid fa-trash"></i> Видалити</button>`);
        }
    },

    _removeAvatarPreview(userId) {
        this._pendingAvatar = { delete: true };
        const wrap = document.getElementById('pe-avatar-wrap');
        if (wrap) {
            wrap.querySelector('img,span[id]')?.remove();
            wrap.insertAdjacentHTML('afterbegin', `<span id="pe-avatar-initials" style="font-size:1.7rem;font-weight:700;color:#fff">${Fmt.initials('')}</span>`);
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


            const payload = {
                last_name:   Dom.val('pe-last-name').trim()  || null,
                first_name:  Dom.val('pe-first-name').trim() || null,
                patronymic:  Dom.val('pe-patronymic').trim() || null,
                gender:      Dom.val('pe-gender')  || null,
                birth_date:          Dom.val('pe-birthdate') || null,
                birth_date_privacy:  Dom.val('pe-bd-privacy') || 'full',
                phone:       Dom.val('pe-phone').trim() || null,
                city:        Dom.val('pe-city') || null,
                bio:         Dom.val('pe-bio').trim() || null,
            };

            if (canExtended) {
                payload.login          = Dom.val('pe-login').trim() || null;
                payload.subdivision    = Dom.val('pe-subdivision') || null;
                payload.job_position   = Dom.val('pe-job-position') || null;
                payload.manager_id     = Dom.val('pe-manager') || null;
                payload.hired_at       = Dom.val('pe-hired-at') || null;
                payload.position_since = Dom.val('pe-position-since') || null;
                if (isAdminEdit) payload.label = Dom.val('pe-role') === 'intern' ? 'intern' : null;
            }
            if (avatarUrl !== undefined) payload.avatar_url = avatarUrl;

            const updated = await API.profiles.update(userId, payload);

            // Роль — окремим викликом через RPC (виставляє і role, і base_role,
            // блокує 'superadmin' тут — для передачі прав є окрема кнопка 👑)
            if (canRole) {
                const newRole = Dom.val('pe-role');
                if (newRole && newRole !== updated.role) {
                    const { error: roleErr } = await supabase.rpc('admin_set_user_role', { p_user_id: userId, p_role: newRole });
                    if (roleErr) throw new Error('Роль: ' + roleErr.message);
                    updated.role = newRole;
                }
            }

            if (isAdminEdit && AppState.isAdmin()) {
                const dovIds = CreatableMultiSelect.getValues('pe-dovirenosti');
                await API.dovirenosti.setForProfile(userId, dovIds);
            }

            // Email change
            const newEmail = Dom.val('pe-email').trim();
            if (newEmail && newEmail !== updated.email) {
                if (isAdminEdit && AppState.isAdmin()) {
                    const { error: emailErr } = await supabase.rpc('admin_update_user_email', { p_user_id: userId, p_email: newEmail });
                    if (emailErr) throw new Error('Email: ' + emailErr.message);
                    // RPC оновлює лише auth.users — синхронізуємо відображуваний email у profiles
                    await API.profiles.update(userId, { email: newEmail });
                    updated.email = newEmail;
                } else {
                    const { error: emailErr } = await supabase.auth.updateUser({ email: newEmail });
                    if (emailErr) throw new Error('Email: ' + emailErr.message);
                    // Реальний логін-email зміниться лише після переходу за посиланням з листа,
                    // але відображуваний email оновлюємо одразу — інакше профіль виглядає незміненим
                    await API.profiles.update(userId, { email: newEmail });
                    updated.email = newEmail;
                    Toast.info?.('Підтвердження', 'На новий email надіслано листа — підтвердіть перехід за посиланням, інакше вхід залишиться зі старою поштою');
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

            ActivityTracker.track('user_edit', { entity_type: 'user', entity_id: userId, entity_title: updated.full_name || updated.email });
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
