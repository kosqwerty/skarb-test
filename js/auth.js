// ================================================================
// LMS — Авторизація
// ================================================================

const Auth = {
    async init() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            AppState.session = session;
            AppState.user    = session.user;
            await this._loadProfile();
            return true;
        }
        return false;
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
        document.getElementById('app-shell').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
        this.showLogin();
    },

    _blockChannel:    null,
    _blockedByAdmin:  false,

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
                    // _showAuth + toast спрацює через SIGNED_OUT нижче
                }
            })
            .subscribe();
    },

    listen() {
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                if (this._blockChannel) {
                    supabase.removeChannel(this._blockChannel);
                    this._blockChannel = null;
                }
                AppState.user    = null;
                AppState.profile = null;
                AppState.session = null;
                this._showAuth();
                if (this._blockedByAdmin) {
                    this._blockedByAdmin = false;
                    Toast.error('Доступ заблоковано', 'Ваш обліковий запис заблоковано адміністратором');
                }
            } else if (event === 'TOKEN_REFRESHED' && session) {
                AppState.session = session;
                AppState.user    = session.user;
            }
        });
    },

    _showApp() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        this._subscribeBlockStatus();
        App.start();
    }
};
