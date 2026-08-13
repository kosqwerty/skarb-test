// ================================================================
// EduFlow LMS — Supabase Configuration
// ================================================================
// 1. Create a project at https://supabase.com
// 2. Run sql/schema.sql in the SQL Editor
// 3. Create storage buckets (see schema.sql comments)
// 4. Replace the values below with your project credentials

const SUPABASE_URL      = 'https://kxiglbdnxbusivnxqhob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4aWdsYmRueGJ1c2l2bnhxaG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjcxNDgsImV4cCI6MjA5MTgwMzE0OH0.3EFB6WuE5TUgGaTvdDRIxKOQ0OsHGEA2fWRmEg2RzSE';

// Cloudflare Turnstile site key — https://dash.cloudflare.com/?to=/:account/turnstile
// Створіть віджет (тип "Managed"), домен: skarb.online (+ localhost для розробки),
// і вставте сюди Site Key. Secret Key вставляється окремо в Supabase Dashboard →
// Authentication → Settings → Bot and Abuse Protection → CAPTCHA (провайдер Turnstile).
const TURNSTILE_SITE_KEY = '0x4AAAAAAD5ygE43ptVRS8pN';

// CDN declares `var supabase` globally (the module object with createClient).
// We overwrite window.supabase with the actual client instance so all scripts
// can reference it as just `supabase` without redeclaration conflicts.
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// Ловимо подію відновлення пароля (клік по лінку з листа) якнайраніше —
// SDK асинхронно парсить токен з URL-хеша і сам його прибирає, тож якщо
// підписатись пізніше (наприклад, у App.boot() після Auth.init()), подія
// може вже пролетіти повз. Прапорець перевіряється в App.boot().
window._passwordRecoveryPending = false;
window.supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') window._passwordRecoveryPending = true;
});

// ── App Configuration ──────────────────────────────────────────────
const APP_CONFIG = {
    name: 'LMS Скарбниця',
    version: 'бета',
    // Хеш останнього коміту, включеного в цей пуш — оновлюється вручну
    // перед кожним "git push" (для адмінів, звірити, яка версія реально
    // задеплоєна). Тому це хеш ПОПЕРЕДНЬОГО коміту відносно того, що
    // фактично містить цю правку — не сам "поточний", а найближчий орієнтир.
    buildCommit: '692832e',
    buildDate: '2026-08-13T12:24:59+00:00',

    supabaseUrl: SUPABASE_URL,
    anonKey:     SUPABASE_ANON_KEY,

    // Supabase Storage
    storagePublicUrl: `${SUPABASE_URL}/storage/v1/object/public`,
    signedUrlExpiry:  900, // seconds (15 minutes)
    resourceMaxSizeMb: 3072, // ліміт lesson-resources у Supabase Storage (file_size_limit), зараз 3 GB

    buckets: {
        thumbnails: 'course-thumbnails',
        resources:  'lesson-resources',
        scorm:      'scorm-packages',
        newsImages:  'news-images',
        avatars:     'avatars',
        pageFiles:   'page-files',
        testImages:  'test-images'
    },

    roles: {
        SUPERADMIN: 'superadmin',
        ADMIN:   'admin',
        SMM:     'smm',
        MANAGER: 'manager',
        USER:    'user'
    },

    levelLabels: {
        beginner:     'Начальный',
        intermediate: 'Средний',
        advanced:     'Продвинутый'
    },

    // Pagination
    pageSize: 12,

    // Supabase Storage quota in GB (Pro included = 100, Free = 1)
    dbQuotaGb: 100
};

// ── Global App State ───────────────────────────────────────────────
const AppState = {
    user:    null,
    profile: null,
    session: null,
    isTrustedNetwork: false,  // встановлюється після checkTrustedNetwork()
    _clientIp: null,

    async checkTrustedNetwork() {
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/check-ip`, {
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'apikey': SUPABASE_ANON_KEY
                }
            });
            const json = await res.json();
            this.isTrustedNetwork = !!json.trusted;
            this._clientIp = json.ip || null;
        } catch(e) {
            console.error('IP check failed:', e);
            this.isTrustedNetwork = false;
        }
    },

    isSuperAdmin() { return this.profile?.role === 'superadmin'; },
    isAdmin()   { return this.profile?.role === 'admin' || this.profile?.role === 'superadmin'; },
    isSmm()     { return this.profile?.role === 'smm'; },
    isManager() { return this.profile?.role === 'manager'; },
    isCeo()     { return this.profile?.role === 'ceo'; },
    canSchedule(){ return ['superadmin','admin','manager'].includes(this.profile?.role); },
    isStaff()   { return ['superadmin','admin','smm','ceo'].includes(this.profile?.role); },
    // label === 'intern' — справжній стажер; role === 'intern' — superadmin
    // тестує роль "Стажер" (перемикання не чіпає label, тож перевіряємо обидва)
    isIntern()  { return this.profile?.label === 'intern' || this.profile?.role === 'intern'; },
    canMutate() { return this.profile?.role !== 'ceo'; },

    // ── Role switching (superadmin testing as another role) ──────────
    isRoleSwitched() { return !!this.profile && this.profile.role !== this.profile.base_role; },
    canSwitchRole()  { return this.profile?.base_role === 'superadmin'; },

    async switchRole(role) {
        const { error } = await supabase.rpc('switch_active_role', { p_role: role });
        if (error) throw error;
        this.profile.role = role;
        this.profile.role_switched_at = new Date().toISOString();
        UI.renderNavigation(role);
        UI.renderSidebarUser(this.profile);
        RoleSwitchBanner.show(role, this.profile.base_role);
        const defaultRoute = ['admin','smm','manager','ceo'].includes(role) ? 'dashboard' : 'knowledge-base';
        Router.go(defaultRoute);
    },

    async exitRoleSwitch() {
        const { error } = await supabase.rpc('reset_active_role');
        if (error) throw error;
        this.profile.role = this.profile.base_role;
        this.profile.role_switched_at = null;
        UI.renderNavigation(this.profile.role);
        UI.renderSidebarUser(this.profile);
        RoleSwitchBanner.hide();
        Router.go('dashboard');
    },
};
