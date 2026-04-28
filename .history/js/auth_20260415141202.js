// ================================================================
// EduFlow LMS — Авторизація
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
    },

    async login() {
        const email    = Dom.val('login-email').trim();
        const password = Dom.val('login-password');
        const btn      = document.getElementById('login-btn');

        if (!email || !password) { Toast.error('Ошибка', 'Заполните все поля'); return; }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;margin:0 auto"></span>';

        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            AppState.session = data.session;
            AppState.user    = data.user;
            await this._loadProfile();
            this._showApp();
        } catch(e) {
            Toast.error('Помилка входу', e.message === 'Invalid login credentials'
                ? 'Невірний email або пароль' : e.message);
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
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
    },

    showRegister() {
        document.getElementById('register-form').classList.remove('hidden');
        document.getElementById('login-form').classList.add('hidden');
    },

    _showApp() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-shell').classList.remove('hidden');
        App.start();
    },

    _showAuth() {
        document.getElementById('app-shell').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
        this.showLogin();
    },

    listen() {
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                this._showAuth();
            } else if (event === 'TOKEN_REFRESHED' && session) {
                AppState.session = session;
                AppState.user    = session.user;
            }
        });
    }
};
