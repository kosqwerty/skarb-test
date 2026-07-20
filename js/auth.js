// ================================================================
// LMS — Авторизація
// ================================================================

const Auth = {
    async init() {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
            // getSession() повертає !session і без error, коли SDK сам вже прибрав
            // мертву сесію під час свого внутрішнього _recoverAndRefresh() —
            // тому чистимо localStorage напряму й безумовно, а не за патерном error.status.
            // Синхронний removeItem переживає навіть live-reload посеред виконання,
            // на відміну від async signOut(), який могло б перервати.
            this._purgeStaleSession();
            return false;
        }
        AppState.session = session;
        AppState.user    = session.user;
        await this._loadProfile();
        return true;
    },

    _purgeStaleSession() {
        try {
            const ref = SUPABASE_URL.match(/^https:\/\/([^.]+)\./)?.[1];
            if (ref) localStorage.removeItem(`sb-${ref}-auth-token`);
        } catch(_) {}
        // Best-effort — розлогінює на сервері й скидає внутрішній стан SDK,
        // не блокує показ екрану логіна
        supabase.auth.signOut({ scope: 'local' }).catch(() => {});
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
            console.warn('[Auth] Примусовий вихід: is_active=false на _loadProfile (заблоковано адміністратором)');
            try { await supabase.auth.signOut(); } catch(_) {}
            AppState.user = null; AppState.profile = null; AppState.session = null;
            this._showAuth();
            Toast.error('Доступ заблоковано', 'Ваш обліковий запис заблоковано адміністратором');
            throw new Error('blocked');
        }
        // Автоскидання застряглого режиму "тестувати як" (>4 год без дії) —
        // захист від забутої вкладки в перемкнутій ролі
        const p = AppState.profile;
        if (p && p.role !== p.base_role && p.role_switched_at) {
            const ageMs = Date.now() - new Date(p.role_switched_at).getTime();
            if (ageMs > 4 * 60 * 60 * 1000) {
                try {
                    await supabase.rpc('reset_active_role');
                    AppState.profile.role = AppState.profile.base_role;
                    AppState.profile.role_switched_at = null;
                } catch(_) {}
            }
        }
        // Персональні обмеження сайдбару, якщо superadmin їх налаштував
        // ("Права адмінів" в адмінпанелі) — кешуємо раз на сесію
        AppState._navAllowed = null;
        if (p && p.role === 'admin') {
            try {
                const keys = await API.adminTabPermissions.getForUser(AppState.user.id);
                const navKeys = keys.filter(k => k.startsWith('nav:')).map(k => k.slice(4));
                if (navKeys.length) AppState._navAllowed = new Set(navKeys);
            } catch(_) { /* немає налаштувань — без обмежень */ }
        }
    },

    async login() {
        const username = Dom.val('login-username').trim().toLowerCase();
        const password = Dom.val('login-password');
        const btn      = document.getElementById('login-btn');

        if (!username || !password) { Toast.error('Помилка', 'Введіть логін та пароль'); return; }
        // Turnstile на вході — лише клієнтський бар'єр після кількох невдалих
        // спроб (Supabase-captcha тут вимкнена навмисно, див. showForgot() /
        // request-password-reset для реального серверного захисту скидання пароля)
        if (this._loginFailCount() >= 2 && !this._turnstileToken('login-turnstile')) {
            Toast.error('Помилка', 'Підтвердіть, що ви не робот'); return;
        }

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
            this._resetLoginFailCount();
            await this._loadProfile();
            // Свіжий інтерактивний вхід завжди скидає режим "тестувати як"
            try {
                await supabase.rpc('reset_active_role');
                if (AppState.profile) {
                    AppState.profile.role = AppState.profile.base_role;
                    AppState.profile.role_switched_at = null;
                }
            } catch(_) {}
            this._showApp();
        } catch(e) {
            Toast.error('Помилка входу', e.message === 'Invalid login credentials'
                ? 'Невірний логін або пароль' : e.message);
            this._registerLoginFail();
            this._resetTurnstile('login-turnstile');
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
        try { await supabase.rpc('reset_active_role'); } catch(_) {}
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
        document.getElementById('forgot-form')?.classList.add('hidden');
        document.getElementById('reset-password-form')?.classList.add('hidden');
        if (this._loginFailCount() >= 2) {
            document.getElementById('login-turnstile')?.classList.remove('hidden');
            this._renderTurnstile('login-turnstile');
        }
    },

    showRegister() {
        document.getElementById('register-form')?.classList.remove('hidden');
        document.getElementById('login-form')?.classList.add('hidden');
    },

    showForgot() {
        document.getElementById('forgot-form')?.classList.remove('hidden');
        document.getElementById('login-form')?.classList.add('hidden');
        const input = document.getElementById('forgot-login');
        if (input) { input.value = ''; input.focus(); }
        this._renderTurnstile('forgot-turnstile');
    },

    showLoginFromForgot() {
        this.showLogin();
    },

    // ── Лічильник невдалих спроб входу (лише клієнтський UX-бар'єр —
    // Turnstile на вході з'являється тільки після 2 помилок поспіль) ──
    _LOGIN_FAIL_KEY: 'lms_login_fails',

    _loginFailCount() {
        return parseInt(localStorage.getItem(this._LOGIN_FAIL_KEY) || '0', 10);
    },

    _registerLoginFail() {
        const count = this._loginFailCount() + 1;
        localStorage.setItem(this._LOGIN_FAIL_KEY, String(count));
        if (count >= 2) {
            document.getElementById('login-turnstile')?.classList.remove('hidden');
            this._renderTurnstile('login-turnstile');
        }
    },

    _resetLoginFailCount() {
        localStorage.removeItem(this._LOGIN_FAIL_KEY);
    },

    // ── Cloudflare Turnstile (антиспам для входу після повторних помилок
    // і для відновлення пароля) ──
    _turnstileWidgets: {}, // containerId -> { widgetId, token }

    _renderTurnstile(containerId) {
        const container = document.getElementById(containerId);
        if (!container || typeof turnstile === 'undefined') return;
        const existing = this._turnstileWidgets[containerId];
        if (existing) {
            turnstile.reset(existing.widgetId);
            existing.token = null;
            return;
        }
        const widgetId = turnstile.render(container, {
            sitekey:  TURNSTILE_SITE_KEY,
            theme:    'dark',
            callback: (token) => { this._turnstileWidgets[containerId].token = token; },
            'expired-callback': () => { this._turnstileWidgets[containerId].token = null; },
            'error-callback':   () => { this._turnstileWidgets[containerId].token = null; }
        });
        this._turnstileWidgets[containerId] = { widgetId, token: null };
    },

    _turnstileToken(containerId) {
        return this._turnstileWidgets[containerId]?.token || null;
    },

    _resetTurnstile(containerId) {
        const w = this._turnstileWidgets[containerId];
        if (w) { turnstile.reset(w.widgetId); w.token = null; }
    },

    async sendPasswordReset() {
        const input = Dom.val('forgot-login').trim();
        const btn   = document.getElementById('forgot-btn');
        if (!input) { Toast.error('Помилка', 'Введіть логін'); return; }
        if (!this._turnstileToken('forgot-turnstile')) { Toast.error('Помилка', 'Підтвердіть, що ви не робот'); return; }

        btn.disabled = true;
        const original = btn.innerHTML;
        btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;margin:0 auto"></span>';

        try {
            // Відправка листа йде через edge function request-password-reset —
            // вона сама перевіряє captcha-токен на сервері (Cloudflare siteverify),
            // бо серверний тумблер "Enable Captcha protection" в Supabase вимкнено
            // (він єдиний на всі auth-ендпоінти, а captcha нам треба тільки тут)
            const redirectTo = window.location.origin + window.location.pathname;
            const res = await fetch(`${APP_CONFIG.supabaseUrl}/functions/v1/request-password-reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${APP_CONFIG.anonKey}`,
                    'apikey': APP_CONFIG.anonKey
                },
                body: JSON.stringify({ login: input, captchaToken: this._turnstileToken('forgot-turnstile'), redirectTo })
            });
            const json = await res.json();
            if (!res.ok || !json.ok) throw new Error(json.error || 'Не вдалося надіслати лист');

            Toast.success('Перевірте пошту', 'Якщо такий обліковий запис існує — на пов’язану пошту надіслано лист із інструкціями');
            this.showLoginFromForgot();
        } catch(e) {
            Toast.error('Помилка', e.message || 'Не вдалося надіслати лист. Спробуйте пізніше');
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
            this._resetTurnstile('forgot-turnstile');
        }
    },

    _showResetPassword() {
        UI.closeUserPopup();
        document.getElementById('app-shell').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('login-form')?.classList.add('hidden');
        document.getElementById('forgot-form')?.classList.add('hidden');
        document.getElementById('reset-password-form')?.classList.remove('hidden');
    },

    async updatePassword() {
        const p1  = Dom.val('reset-password1');
        const p2  = Dom.val('reset-password2');
        const btn = document.getElementById('reset-password-btn');

        if (!p1 || p1.length < 6) { Toast.error('Помилка', 'Пароль має бути не менше 6 символів'); return; }
        if (p1 !== p2) { Toast.error('Помилка', 'Паролі не співпадають'); return; }

        btn.disabled = true;
        const original = btn.innerHTML;
        btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;margin:0 auto"></span>';

        try {
            const { error } = await supabase.auth.updateUser({ password: p1 });
            if (error) throw error;
            Toast.success('Пароль змінено', 'Тепер увійдіть із новим паролем');
            try { await supabase.auth.signOut(); } catch(_) {}
            AppState.user = null; AppState.profile = null; AppState.session = null;
            location.hash = '';
            this._showAuth();
        } catch(e) {
            Toast.error('Помилка', e.message);
            btn.disabled = false;
            btn.innerHTML = original;
        }
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
                    console.warn('[Auth] Примусовий вихід: is_active=false через Realtime block-watch');
                    this._signingOut = true;
                    this._blockedByAdmin = true;
                    try { await supabase.auth.signOut(); } catch(_) {}
                    return;
                }
                if (row?.force_logout === true) {
                    console.warn('[Auth] Примусовий вихід: force_logout=true через Realtime block-watch');
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
                console.warn('[Auth] SIGNED_OUT', {
                    blockedByAdmin: this._blockedByAdmin,
                    kickedByAdmin:  this._kickedByAdmin,
                    signingOut:     this._signingOut,
                });
                // Дві вкладки одного браузера ділять localStorage-сесію: якщо обидві
                // одночасно оновлюють токен, "програвша" вкладка може отримати
                // SIGNED_OUT попри те, що сусідня вкладка щойно записала свіжу валідну
                // сесію. Даємо їй частку секунди долетіти й перевіряємо ще раз, перш
                // ніж реально розлогінювати — справжній вихід (ручний/блок/неактивність)
                // завжди чистить сесію насправді, тож ця перевірка для нього безпечна.
                this._recheckAfterSignedOut();
                return;
            }
            if (event === 'TOKEN_REFRESHED' && session) {
                AppState.session = session;
                AppState.user    = session.user;
            }
        });
    },

    async _recheckAfterSignedOut() {
        await new Promise(r => setTimeout(r, 400));
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                console.warn('[Auth] SIGNED_OUT проігноровано — сусідня вкладка щойно оновила сесію');
                AppState.session = session;
                AppState.user    = session.user;
                return;
            }
        } catch(_) {}

        // Немає локальної сесії — якщо це не навмисний вихід (ручний/блок/кік),
        // пробуємо один раз явно освіжити токен. SDK іноді сам ловить
        // транзієнтний 403 (rate-limit, мережевий збій) на internal auto-refresh,
        // хоча сам refresh token ще дійсний і explicit refreshSession() встигає.
        if (!this._signingOut) {
            try {
                const { data, error } = await supabase.auth.refreshSession();
                if (!error && data?.session) {
                    console.warn('[Auth] SIGNED_OUT проігноровано — вдалося явно освіжити токен');
                    AppState.session = data.session;
                    AppState.user    = data.session.user;
                    return;
                }
            } catch(_) {}
        }

        this._finishSignOut();
    },

    _finishSignOut() {
        AppState._sessionId = null;
        this._signingOut = false;
        InactivityWatcher.stop();
        Heartbeat.removeSession().catch(() => {});
        Heartbeat.stop();
        SchedulerPage.stopTimer();
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
    },

    async _showApp() {
        // Явний логін — це вже активність користувача. Скидаємо lms_last_active,
        // інакше прострочений таймстемп з минулої сесії (вкладка була закрита >30хв)
        // одразу після входу викликає InactivityWatcher._doLogout() і миттєво розлогінює.
        InactivityWatcher._reset();

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
                console.warn('[Auth] Примусовий вихід: is_active=false через Heartbeat fallback');
                Auth._signingOut = true;
                Auth._blockedByAdmin = true;
                await supabase.auth.signOut();
                return;
            }
            // Fallback для примусового виходу (Realtime міг не спрацювати)
            if (data.force_logout === true) {
                console.warn('[Auth] Примусовий вихід: force_logout=true через Heartbeat fallback');
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
        console.warn('[Auth] Примусовий вихід: неактивність понад', Math.round((Date.now() - this._lastActive) / 60000), 'хв (ліміт 30 хв)');
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
