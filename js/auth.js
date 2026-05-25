// ================================================================
// LMS — Авторизація
// ================================================================

const Auth = {
    async init() {
        const { data: { session }, error } = await supabase.auth.getSession();
        // Прострочений або недійсний refresh token — очищаємо і показуємо логін
        if (error || !session) {
            if (error?.message?.includes('Refresh Token')) {
                await supabase.auth.signOut().catch(() => {});
            }
            return false;
        }
        AppState.session = session;
        AppState.user    = session.user;
        await this._loadProfile();
        return true;
    },

    async _loadProfile() {
        try {
            AppState.profile = await API.profiles.me();
        } catch(e) {
            await new Promise(r => setTimeout(r, 500));
            try { AppState.profile = await API.profiles.me(); } catch(_) {}
        }
        // Якщо акаунт заблоковано адміністратором — одразу виходимо
        if (AppState.profile?.is_active === false) {
            try { await supabase.auth.signOut(); } catch(_) {}
            AppState.user = null; AppState.profile = null; AppState.session = null;
            this._showAuth();
            Toast.error('Доступ заблоковано', 'Ваш обліковий запис заблоковано адміністратором');
            throw new Error('blocked');
        }
    },

    async login() {
        const username = Dom.val('login-username').trim().toLowerCase();
        const password = Dom.val('login-password');
        const btn      = document.getElementById('login-btn');

        if (!username || !password) { Toast.error('Помилка', 'Введіть логін та пароль'); return; }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;margin:0 auto"></span>';

        try {
            // Лише логін — email заборонений
            if (username.includes('@')) throw new Error('Введіть логін, а не email');

            const { data: found, error: rpcErr } = await supabase.rpc('get_email_by_login', { p_login: username });
            if (rpcErr) throw new Error('Сервіс тимчасово недоступний. Зверніться до адміністратора.');
            if (!found)  throw new Error('Невірний логін або пароль');

            const { data, error } = await supabase.auth.signInWithPassword({ email: found, password });
            if (error) throw error;
            AppState.session = data.session;
            AppState.user    = data.user;
            await this._loadProfile();
            this._showApp();
        } catch(e) {
            Toast.error('Помилка входу', e.message === 'Invalid login credentials'
                ? 'Невірний логін або пароль' : e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>Увійти</span>';
        }
    },

    async register() {
        const name     = Dom.val('reg-name').trim();
        const email    = Dom.val('reg-email').trim();
        const password = Dom.val('reg-password');
        const btn      = document.getElementById('register-btn');

        if (!name || !email || !password) { Toast.error('Помилка', 'Заповніть усі поля'); return; }
        if (password.length < 6) { Toast.error('Помилка', 'Пароль має містити мінімум 6 символів'); return; }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;margin:0 auto"></span>';

        try {
            const { data, error } = await supabase.auth.signUp({
                email, password,
                options: { data: { full_name: name } }
            });
            if (error) throw error;

            if (data.user && !data.session) {
                Toast.info('Підтвердіть email', 'Ми надіслали листа з підтвердженням');
                this.showLogin();
                return;
            }

            AppState.session = data.session;
            AppState.user    = data.user;
            await new Promise(r => setTimeout(r, 800));
            await this._loadProfile();
            this._showApp();
        } catch(e) {
            Toast.error('Помилка реєстрації', e.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span>Зареєструватися</span>';
        }
    },

    async logout() {
        const confirmed = await Modal.confirm({
            title: 'Вихід',
            message: 'Ви впевнені, що хочете вийти із системи?',
            confirmText: 'Вийти',
            danger: true
        });
        if (!confirmed) return;

        UI.closeUserPopup();
        try { await supabase.auth.signOut(); } catch(_) {}
        AppState.user    = null;
        AppState.profile = null;
        AppState.session = null;
        location.hash    = '';
        this._showAuth();
    },

    showLogin() {
        document.getElementById('login-form')?.classList.remove('hidden');
        document.getElementById('register-form')?.classList.add('hidden');
    },

    showRegister() {
        document.getElementById('register-form')?.classList.remove('hidden');
        document.getElementById('login-form')?.classList.add('hidden');
    },

    _showAuth() {
        UI.closeUserPopup();
        document.getElementById('app-shell').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
        this.showLogin();
    },

    _blockChannel:    null,
    _blockedByAdmin:  false,
    _kickedByAdmin:   false,

    // Realtime-підписка: лише виставляє прапор і викликає signOut.
    // Весь UI-перехід — в onAuthStateChange(SIGNED_OUT), щоб не було подвійного виклику.
    _subscribeBlockStatus() {
        if (!AppState.user) return;
        if (this._blockChannel) {
            supabase.removeChannel(this._blockChannel);
            this._blockChannel = null;
        }
        this._blockChannel = supabase
            .channel(`block-watch-${AppState.user.id}`)
            .on('postgres_changes', {
                event:  'UPDATE',
                schema: 'public',
                table:  'profiles',
                filter: `id=eq.${AppState.user.id}`
            }, async payload => {
                if (payload.new?.is_active === false) {
                    this._blockedByAdmin = true;
                    try { await supabase.auth.signOut(); } catch(_) {}
                }
                if (payload.new?.force_logout === true) {
                    this._kickedByAdmin = true;
                    // Скидаємо флаг одразу (щоб не спрацьовувало повторно)
                    await supabase.from('profiles').update({ force_logout: false }).eq('id', AppState.user.id).catch(() => {});
                    try { await supabase.auth.signOut(); } catch(_) {}
                }
            })
            .subscribe();
    },

    listen() {
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                InactivityWatcher.stop();
                Heartbeat.stop();
                if (this._blockChannel) {
                    supabase.removeChannel(this._blockChannel);
                    this._blockChannel = null;
                }
                if (UI._notifChannel) {
                    supabase.removeChannel(UI._notifChannel);
                    UI._notifChannel = null;
                }
                AppState.user    = null;
                AppState.profile = null;
                AppState.session = null;
                this._showAuth();
                if (this._blockedByAdmin) {
                    this._blockedByAdmin = false;
                    Toast.error('Доступ заблоковано', 'Ваш обліковий запис заблоковано адміністратором');
                }
                if (this._kickedByAdmin) {
                    this._kickedByAdmin = false;
                    Toast.warning('Сесію завершено', 'Адміністратор завершив вашу сесію');
                }
            } else if (event === 'TOKEN_REFRESHED' && session) {
                AppState.session = session;
                AppState.user    = session.user;
            }
        });
    },

    async _showApp() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        this._subscribeBlockStatus();
        InactivityWatcher.start();
        await Heartbeat.start();
        App.start();
    }
};

// ── Heartbeat — оновлює last_seen_at кожні 2 хв ───────────────────
const Heartbeat = {
    _INTERVAL: 2 * 60 * 1000,   // 2 хвилини
    _timer: null,

    async start() {
        this.stop();
        await this._ping();  // чекаємо першого ping перед рендером
        this._timer = setInterval(() => this._ping(), this._INTERVAL);
    },

    stop() {
        clearInterval(this._timer);
        this._timer = null;
    },

    async _ping() {
        const id = AppState.user?.id;
        if (!id) return;
        try {
            await supabase.from('profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', id);
        } catch(_) {}
    }
};

// ── Автовихід при неактивності ─────────────────────────────────────
const InactivityWatcher = {
    _TIMEOUT:   60 * 60 * 1000,   // 1 година в мс
    _WARN:      5  * 60 * 1000,   // попередження за 5 хв до виходу
    _timer:     null,
    _warnTimer: null,
    _warnToast: null,
    _events:    ['mousemove','mousedown','keydown','touchstart','scroll','click'],

    start() {
        this.stop(); // запобігаємо подвійній підписці
        this._events.forEach(e => document.addEventListener(e, this._onActivity, { passive: true }));
        this._reset();
    },

    stop() {
        this._events.forEach(e => document.removeEventListener(e, this._onActivity));
        clearTimeout(this._timer);
        clearTimeout(this._warnTimer);
        this._timer = this._warnTimer = null;
    },

    _onActivity: null,   // заповнюється нижче

    _reset() {
        clearTimeout(this._timer);
        clearTimeout(this._warnTimer);
        // Прибираємо попереджувальний тост якщо він є
        if (this._warnToast) {
            const el = document.getElementById('inactivity-warn-toast');
            if (el) el.remove();
            this._warnToast = null;
        }
        // Попередження за 5 хв
        this._warnTimer = setTimeout(() => this._showWarning(), this._TIMEOUT - this._WARN);
        // Вихід
        this._timer = setTimeout(() => this._doLogout(), this._TIMEOUT);
    },

    _showWarning() {
        // Показуємо persistent toast (без автозакриття)
        const div = document.createElement('div');
        div.id = 'inactivity-warn-toast';
        div.style.cssText = `
            position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;
            background:var(--bg-surface);border:1.5px solid #f59e0b;
            border-radius:var(--radius-xl);padding:.85rem 1.1rem;
            box-shadow:0 8px 32px rgba(0,0,0,.22);
            display:flex;align-items:center;gap:.75rem;
            max-width:340px;animation:toast-in .25s ease`;
        div.innerHTML = `
            <div style="width:36px;height:36px;border-radius:50%;background:rgba(245,158,11,.15);
                        color:#f59e0b;display:flex;align-items:center;justify-content:center;
                        font-size:1.1rem;flex-shrink:0">⏱️</div>
            <div style="flex:1;min-width:0">
                <div style="font-size:.82rem;font-weight:700;color:var(--text-primary);margin-bottom:.15rem">
                    Сесія завершується
                </div>
                <div style="font-size:.75rem;color:var(--text-muted)">
                    Ви неактивні. Через 5 хвилин відбудеться автоматичний вихід.
                </div>
            </div>
            <button onclick="InactivityWatcher._reset()" style="
                flex-shrink:0;border:1px solid #f59e0b;background:rgba(245,158,11,.1);
                color:#f59e0b;border-radius:var(--radius-md);padding:.3rem .7rem;
                font-size:.75rem;font-weight:600;cursor:pointer;font-family:inherit">
                Залишитись
            </button>`;
        document.body.appendChild(div);
        this._warnToast = div;
    },

    _doLogout() {
        this.stop();
        const el = document.getElementById('inactivity-warn-toast');
        if (el) el.remove();
        Toast.warning('Автовихід', 'Ви були неактивні більше 1 години');
        setTimeout(async () => {
            try { await supabase.auth.signOut(); } catch(_) {}
            AppState.user = null; AppState.profile = null; AppState.session = null;
            location.hash = '';
        }, 1500);
    },
};

// Прив'язуємо метод після створення об'єкту
InactivityWatcher._onActivity = InactivityWatcher._reset.bind(InactivityWatcher);
