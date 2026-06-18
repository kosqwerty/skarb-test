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
        try { API.activityLog.log('logout'); } catch(_) {}
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
    _signingOut:      false,

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
                // Realtime може не передавати значення колонок при RLS —
                // зчитуємо свіжий профіль щоб перевірити реальний стан
                if (this._signingOut) return;
                const uid = AppState.user?.id;
                if (!uid) return;
                let fresh = null;
                try {
                    const { data } = await supabase
                        .from('profiles')
                        .select('is_active, force_logout')
                        .eq('id', uid)
                        .maybeSingle();
                    fresh = data;
                } catch(_) {}

                const row = fresh || payload.new;
                if (row?.is_active === false) {
                    this._signingOut = true;
                    this._blockedByAdmin = true;
                    try { await supabase.auth.signOut(); } catch(_) {}
                    return;
                }
                if (row?.force_logout === true) {
                    this._signingOut = true;
                    this._kickedByAdmin = true;
                    try { await supabase.auth.signOut(); } catch(_) {}
                }
            })
            .subscribe();
    },

    listen() {
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                this._signingOut = false;
                AppState._realRole = null;
                RolePreviewBanner.hide();
                InactivityWatcher.stop();
                Heartbeat.removeSession().catch(() => {});
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
                location.hash    = '';
                try { Modal.close(); } catch(_) {}
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
        // Скидаємо force_logout якщо лишився з попередньої сесії —
        // до старту Heartbeat, щоб він не прочитав true і не вибив знову
        const uid = AppState.user?.id;
        if (uid) {
            try {
                await supabase.from('profiles')
                    .update({ force_logout: false })
                    .eq('id', uid)
                    .eq('force_logout', true);
            } catch(_) {}
        }
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        this._subscribeBlockStatus();
        InactivityWatcher.start();
        await Heartbeat.start();
        App.start();
        setTimeout(() => { try { API.activityLog.log('login'); } catch(_) {} }, 1000);
    }
};

// ── Heartbeat — оновлює last_seen_at кожні 2 хв ───────────────────
const Heartbeat = {
    _INTERVAL: 30 * 1000,        // 30 секунд
    _timer: null,
    _sessionToken: null,         // унікальний ключ цієї вкладки/сесії

    _getToken() {
        if (!this._sessionToken) {
            // Береться з sessionStorage щоб кожна вкладка мала свій токен
            let t = sessionStorage.getItem('_lms_stok');
            if (!t) {
                t = 'st_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2);
                sessionStorage.setItem('_lms_stok', t);
            }
            this._sessionToken = t;
        }
        return this._sessionToken;
    },

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
        if (Auth._signingOut) return;
        const id = AppState.user?.id;
        if (!id) return;
        try {
            // Оновлюємо last_seen_at і одночасно зчитуємо поточний стан
            const { data } = await supabase.from('profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', id)
                .select('is_active, force_logout')
                .maybeSingle();

            // Ping сесійного запису (fire-and-forget)
            const token = this._getToken();
            supabase.from('user_sessions')
                .upsert({ session_token: token, user_id: id, user_agent: navigator.userAgent.slice(0, 200), last_seen_at: new Date().toISOString() },
                    { onConflict: 'session_token' })
                .then(() => {});

            if (!data) return;
            // Fallback для блокування (Realtime міг не спрацювати)
            if (data.is_active === false) {
                Auth._signingOut = true;
                Auth._blockedByAdmin = true;
                await supabase.auth.signOut();
                return;
            }
            // Fallback для примусового виходу (Realtime міг не спрацювати)
            if (data.force_logout === true) {
                Auth._signingOut = true;
                Auth._kickedByAdmin = true;
                await supabase.auth.signOut();
            }
        } catch(_) {}
    },

    async removeSession() {
        const token = this._sessionToken;
        if (!token) return;
        try {
            await supabase.from('user_sessions').delete().eq('session_token', token);
        } catch(_) {}
        sessionStorage.removeItem('_lms_stok');
        this._sessionToken = null;
    }
};

// ── Автовихід при неактивності ─────────────────────────────────────
const InactivityWatcher = {
    _TIMEOUT:    30 * 60 * 1000,   // 30 хвилин неактивності
    _CHECK:      30 * 1000,         // перевірка кожні 30 с
    _ticker:     null,
    _lastActive: 0,
    _events:     ['mousemove','mousedown','keydown','touchstart','scroll','click'],

    start() {
        this.stop();
        // Відновлюємо час останньої активності з localStorage —
        // щоб закриття/відкриття браузера не скидало таймер
        const stored = parseInt(localStorage.getItem('lms_last_active') || '0', 10);
        this._lastActive = stored || Date.now();
        // Якщо вже перевищено таймаут — одразу logout, не чекаємо CHECK
        if (Date.now() - this._lastActive >= this._TIMEOUT) {
            this._doLogout();
            return;
        }
        this._events.forEach(e => document.addEventListener(e, this._onActivity, { passive: true }));
        this._ticker = setInterval(() => this._check(), this._CHECK);
    },

    stop() {
        this._events.forEach(e => document.removeEventListener(e, this._onActivity));
        clearInterval(this._ticker);
        this._ticker = null;
    },

    _onActivity: null,

    _reset() {
        this._lastActive = Date.now();
        localStorage.setItem('lms_last_active', this._lastActive);
    },

    _check() {
        const idle = Date.now() - this._lastActive;
        if (idle >= this._TIMEOUT) {
            this._doLogout();
        }
    },

    _doLogout() {
        this.stop();
        localStorage.removeItem('lms_last_active');
        const hash = location.hash;
        if (hash && hash !== '#' && hash !== '#/') {
            localStorage.setItem('lms_return_hash', hash);
        }
        try { API.activityLog.log('logout', { details: { reason: 'inactivity' } }); } catch(_) {}
        setTimeout(async () => {
            try { await supabase.auth.signOut(); } catch(_) {}
            AppState.user = null; AppState.profile = null; AppState.session = null;
            location.hash = '';
        }, 300);
    },
};

// Прив'язуємо метод після створення об'єкту
InactivityWatcher._onActivity = InactivityWatcher._reset.bind(InactivityWatcher);
