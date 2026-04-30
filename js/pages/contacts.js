// ================================================================
// EduFlow LMS — Контакти
// Access: all authenticated users
// ================================================================

const ContactsPage = {

    _users:    [],
    _reminders: {}, // targetId → reminder row

    // ── Init ─────────────────────────────────────────────────────

    async init(container) {
        UI.setBreadcrumb([{ label: 'Контакти' }]);
        if (!AccessRestrictions.canAccess('contacts')) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔒</div>
                    <h3>Доступ обмежено</h3>
                    <p style="color:var(--text-muted)">У вас немає доступу до розділу «Контакти»</p>
                </div>`;
            return;
        }
        container.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>`;

        try {
            const [{ data: users, error }, { data: reminders }] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id,full_name,phone,job_position,subdivision,city,role,avatar_url,birth_date,is_hidden,is_active,manager_id')
                    .eq('is_hidden', false)
                    .eq('is_active', true)
                    .order('full_name', { ascending: true }),
                supabase
                    .from('birthday_reminders')
                    .select('*')
                    .eq('created_by', AppState.user.id)
            ]);

            if (error) throw error;
            this._users = users || [];
            this._nameMap = Object.fromEntries(this._users.map(u => [u.id, u.full_name]));

            this._reminders = {};
            for (const r of (reminders || [])) this._reminders[r.target_id] = r;
        } catch(e) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
            return;
        }

        this._render(container);
    },

    // ── Render ───────────────────────────────────────────────────

    _render(container) {
        container.innerHTML = `
<div class="ct-page">

    <div class="ct-header">
        <h1 class="ct-title">👥 Контакти</h1>
        <p class="ct-subtitle">Контактна інформація співробітників</p>
        <div class="ct-search-row">
            <div class="ct-search-wrap">
                <input id="ct-search" class="ct-search" type="search" placeholder="Пошук за ім'ям, посадою, містом, телефоном…"
                       oninput="ContactsPage._search(this.value)">
            </div>
            <div id="ct-count" class="ct-count">${this._users.length} співробітників</div>
        </div>
    </div>

    <div class="ct-grid" id="ct-grid">
        ${this._cardsHtml(this._users)}
    </div>

    <div id="ct-empty" class="ct-empty" style="display:none">
        <div style="font-size:3rem;margin-bottom:.75rem">🔍</div>
        <div>Нікого не знайдено</div>
    </div>

</div>

<style>
.ct-page { max-width:1400px; animation:fadeSlideUp .3s cubic-bezier(.16,1,.3,1); }
@keyframes fadeSlideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.ct-header { display:flex;flex-direction:column;gap:.5rem;margin-bottom:1.25rem; }
.ct-title { margin:0;font-size:1.8rem;font-weight:700;color:var(--text-primary);letter-spacing:-.02em; }
.ct-subtitle { margin:0;color:var(--text-muted);font-size:.9rem; }
.ct-search-row { display:flex;align-items:center;gap:14px;margin-top:.75rem; }
.ct-search-wrap { flex:1; }
.ct-search { width:100%;padding:11px 16px;background:var(--bg-raised);border:1.5px solid var(--border);border-radius:16px;font-size:.95rem;color:var(--text-primary);outline:none;transition:border-color .15s;box-sizing:border-box; }
.ct-search:focus { border-color:var(--primary); }
.ct-count { flex-shrink:0;font-size:.82rem;color:var(--text-muted);white-space:nowrap; }
.ct-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-top:1rem; }
.ct-card { background:var(--bg-surface);border:1px solid var(--border);border-radius:20px;padding:18px;box-shadow:var(--shadow-sm);transition:box-shadow .15s,border-color .15s;display:flex;flex-direction:column;gap:14px; }
.ct-card:hover { box-shadow:var(--shadow-md);border-color:var(--border-light); }
.ct-card-head { display:flex;align-items:center;gap:12px; }
.ct-avatar { width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,var(--primary),var(--secondary));display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden; }
.ct-avatar img { width:100%;height:100%;object-fit:cover; }
.ct-name { font-weight:700;font-size:.95rem;color:var(--text-primary);margin-bottom:4px;line-height:1.2; }
.ct-fields { display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--border);padding-top:12px; }
.ct-field { display:flex;align-items:center;gap:8px;font-size:.82rem;color:var(--text-secondary);min-width:0; }
.ct-field > span:first-child { flex-shrink:0;font-size:.9rem;width:18px;text-align:center; }
.ct-field > span:last-child { white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.ct-field a { color:var(--primary);text-decoration:none; }
.ct-field a:hover { text-decoration:underline; }
.ct-bd-row { justify-content:space-between; }
.ct-bd-row > span:last-child { flex:1;min-width:0; }
.ct-bd-soon { display:inline-block;padding:1px 7px;background:rgba(245,158,11,.12);color:#f59e0b;border-radius:40px;font-size:.7rem;font-weight:600;margin-left:5px; }
.ct-bd-btn { flex-shrink:0;width:28px;height:28px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-raised);cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;transition:all .15s;margin-left:4px; }
.ct-bd-btn:hover { border-color:var(--primary);background:var(--primary-glow); }
.ct-bd-btn.active { border-color:var(--primary);background:var(--primary-glow);box-shadow:0 0 0 3px var(--primary-glow); }
.ct-copy-btn { flex-shrink:0;width:24px;height:24px;border-radius:6px;border:1.5px solid var(--border);background:var(--bg-raised);cursor:pointer;color:var(--text-muted);display:flex;align-items:center;justify-content:center;transition:all .15s;margin-left:4px;padding:0; }
.ct-copy-btn:hover { border-color:var(--primary);color:var(--primary);background:var(--primary-glow); }
.ct-copy-btn.copied { border-color:#10b981;color:#10b981;background:rgba(16,185,129,.1); }
.ct-empty { text-align:center;padding:4rem 2rem;color:var(--text-muted);font-size:1rem; }
.bd-chip { padding:5px 12px;border:1.5px solid var(--border);border-radius:40px;background:var(--bg-surface);color:var(--text-secondary);font-size:.8rem;font-weight:500;cursor:pointer;transition:all .15s; }
.bd-chip:hover { border-color:var(--primary);color:var(--primary); }
.bd-chip.bd-chip-active { background:var(--primary-glow);border-color:var(--primary);color:var(--primary);font-weight:600; }
@media(max-width:600px){ .ct-search{width:100%} .ct-header{flex-direction:column} }
</style>`;
    },

    _cardsHtml(users) {
        if (!users.length) return '';
        return users.map(u => this._cardHtml(u)).join('');
    },

    _cardHtml(u) {
        const reminder  = this._reminders[u.id];
        const hasBd     = !!u.birth_date;
        let bdStr = '', daysUntil = null;

        if (hasBd) {
            const bd    = new Date(u.birth_date);
            const today = new Date(); today.setHours(0, 0, 0, 0);
            let upcoming = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
            if (upcoming <= today) upcoming.setFullYear(today.getFullYear() + 1);
            daysUntil = Math.round((upcoming - today) / 86400000);
            bdStr = upcoming.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long' });
        }

        const field = (icon, val) => val
            ? `<div class="ct-field">
                <span>${icon}</span>
                <span>${val}</span>
               </div>`
            : '';

        const phoneField = u.phone ? `
        <div class="ct-field">
            <span>📞</span>
            <a href="tel:${u.phone}" style="color:var(--primary);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.phone}</a>
        </div>` : '';

        const loc = [u.city, u.subdivision].filter(Boolean).join(' · ');
        const managerName = u.manager_id ? (this._nameMap[u.manager_id] || null) : null;

        return `
<div class="ct-card" data-uid="${u.id}">
    <div class="ct-card-head">
        <div class="ct-avatar">
            ${u.avatar_url ? `<img src="${u.avatar_url}" alt="">` : Fmt.initials(u.full_name)}
        </div>
        <div style="min-width:0">
            <div class="ct-name">${u.full_name || '—'}</div>
            <div>${Fmt.roleBadge(u.role)}</div>
        </div>
    </div>
    <div class="ct-fields">
        ${phoneField}
        ${field('💼', u.job_position)}
        ${field('🏙️', loc)}
        ${field('👤', managerName ? `Керівник: ${managerName}` : null)}
        ${hasBd ? `
        <div class="ct-field ct-bd-row">
            <span>🎂</span>
            <span>${bdStr}${daysUntil <= 7 ? `<span class="ct-bd-soon">через ${daysUntil} дн.</span>` : ''}</span>
            <button class="ct-bd-btn${reminder ? ' active' : ''}"
                title="${reminder ? `Нагадування за ${reminder.days_before} дн.` : 'Додати нагадування'}"
                onclick="ContactsPage._openBdModal('${u.id}','${(u.full_name||'').replace(/'/g,"\\'")}','${u.birth_date}')">
                🔔
            </button>
        </div>` : ''}
    </div>
</div>`;
    },

    // ── Search ───────────────────────────────────────────────────

    _search(q) {
        const lq = q.toLowerCase().trim();
        const filtered = lq ? this._users.filter(u =>
            (u.full_name          || '').toLowerCase().includes(lq) ||
            (u.phone              || '').toLowerCase().includes(lq) ||
            (u.job_position       || '').toLowerCase().includes(lq) ||
            (u.city               || '').toLowerCase().includes(lq) ||
            (u.subdivision        || '').toLowerCase().includes(lq) ||
            (u.manager_id ? (this._nameMap[u.manager_id] || '') : '').toLowerCase().includes(lq)
        ) : this._users;

        const grid  = document.getElementById('ct-grid');
        const empty = document.getElementById('ct-empty');
        const count = document.getElementById('ct-count');

        if (!filtered.length) {
            grid.innerHTML = '';
            empty.style.display = '';
            count.textContent = '0 результатів';
        } else {
            empty.style.display = 'none';
            grid.innerHTML = this._cardsHtml(filtered);
            count.textContent = `${filtered.length} із ${this._users.length} співробітників`;
        }
    },

    // ── Birthday reminder modal ──────────────────────────────────

    _openBdModal(userId, fullName, birthDate) {
        const reminder = this._reminders[userId];
        const bd    = new Date(birthDate);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        let upcoming = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (upcoming <= today) upcoming.setFullYear(today.getFullYear() + 1);
        const daysUntil = Math.round((upcoming - today) / 86400000);
        const bdLabel   = upcoming.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long' });

        const chips = [1, 3, 5, 7, 14, 30].map(d => {
            const active = reminder ? reminder.days_before === d : d === 7;
            return `<button class="bd-chip${active ? ' bd-chip-active' : ''}" data-d="${d}"
                onclick="document.querySelectorAll('#bd-modal-chips .bd-chip').forEach(b=>b.classList.remove('bd-chip-active'));this.classList.add('bd-chip-active');document.getElementById('bd-days-val').value=this.dataset.d">
                ${d} дн.
            </button>`;
        }).join('');

        Modal.open({
            title: `🎂 ${fullName}`,
            size: 'sm',
            body: `
            <div style="text-align:center;margin-bottom:16px">
                <div style="font-size:2.5rem;margin-bottom:4px">🎂</div>
                <div style="font-weight:600;font-size:1rem">${bdLabel}</div>
                <div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">через ${daysUntil} дн.</div>
            </div>
            ${reminder ? `
            <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:12px;margin-bottom:14px">
                <span>✅</span>
                <span style="font-size:.875rem;color:#10b981;font-weight:500">Нагадування за ${reminder.days_before} дн.</span>
            </div>` : ''}
            <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:8px">${reminder ? 'Змінити:' : 'Отримати сповіщення за:'}</div>
            <div id="bd-modal-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">
                ${chips}
            </div>
            <input type="hidden" id="bd-days-val" value="${reminder?.days_before ?? 7}">`,
            footer: `
            ${reminder ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="ContactsPage._removeBdReminder('${userId}')">Видалити</button>` : ''}
            <button class="btn btn-secondary" onclick="Modal.close()">Скасувати</button>
            <button class="btn btn-primary" onclick="ContactsPage._saveBdReminder('${userId}','${fullName.replace(/'/g,"\\'")}')">
                ${reminder ? 'Оновити' : 'Зберегти'}
            </button>`
        });
    },

    async _saveBdReminder(userId, fullName) {
        const days = parseInt(document.getElementById('bd-days-val')?.value || '7');
        Loader.show();
        try {
            const { data, error } = await supabase.from('birthday_reminders').upsert({
                created_by:    AppState.user.id,
                target_id:     userId,
                days_before:   days,
                is_active:     true,
                notified_year: null,
            }, { onConflict: 'created_by,target_id' }).select().single();
            if (error) throw error;
            this._reminders[userId] = data;
            Toast.success('Нагадування збережено', `За ${days} дн. до дня народження ${fullName}`);
            Modal.close();
            // Update bell icon on card without full re-render
            const card = document.querySelector(`.ct-card[data-uid="${userId}"]`);
            if (card) {
                const btn = card.querySelector('.ct-bd-btn');
                if (btn) { btn.classList.add('active'); btn.title = `Нагадування за ${days} дн.`; }
            }
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },

    async _removeBdReminder(userId) {
        const reminder = this._reminders[userId];
        if (!reminder) return;
        Loader.show();
        try {
            const { error } = await supabase.from('birthday_reminders').delete().eq('id', reminder.id);
            if (error) throw error;
            delete this._reminders[userId];
            Toast.success('Нагадування видалено');
            Modal.close();
            const card = document.querySelector(`.ct-card[data-uid="${userId}"]`);
            if (card) {
                const btn = card.querySelector('.ct-bd-btn');
                if (btn) { btn.classList.remove('active'); btn.title = 'Додати нагадування'; }
            }
        } catch(e) { Toast.error('Помилка', e.message); }
        finally { Loader.hide(); }
    },
};
