// ================================================================
// EduFlow LMS — Supabase Configuration
// ================================================================
// 1. Create a project at https://supabase.com
// 2. Run sql/schema.sql in the SQL Editor
// 3. Create storage buckets (see schema.sql comments)
// 4. Replace the values below with your project credentials

const SUPABASE_URL      = 'https://kxiglbdnxbusivnxqhob.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Ad1-7OgRDJrxajqIjmb1Mw_OBMou-iv';

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

// ── App Configuration ──────────────────────────────────────────────
const APP_CONFIG = {
    name: 'EduFlow LMS',
    version: '1.0.0',

    // Supabase Storage
    storagePublicUrl: `${SUPABASE_URL}/storage/v1/object/public`,
    signedUrlExpiry:  3600, // seconds (1 hour)

    buckets: {
        thumbnails: 'course-thumbnails',
        resources:  'lesson-resources',
        scorm:      'scorm-packages',
        newsImages: 'news-images',
        avatars:    'avatars'
    },

    roles: {
        ADMIN:   'admin',
        TEACHER: 'teacher',
        STUDENT: 'student'
    },

    levelLabels: {
        beginner:     'Начальный',
        intermediate: 'Средний',
        advanced:     'Продвинутый'
    },

    // Pagination
    pageSize: 12
};

// ── Global App State ───────────────────────────────────────────────
const AppState = {
    user:    null,   // current auth user (from supabase.auth)
    profile: null,   // current profile row
    session: null,

    isAdmin()   { return this.profile?.role === 'admin'; },
    isTeacher() { return this.profile?.role === 'teacher'; },
    isStudent() { return this.profile?.role === 'student'; },
    isStaff()   { return this.profile?.role === 'admin' || this.profile?.role === 'teacher'; }
};
