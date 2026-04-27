// ================================================================
// EduFlow LMS — Supabase Configuration
// ================================================================
// 1. Create a project at https://supabase.com
// 2. Run sql/schema.sql in the SQL Editor
// 3. Create storage buckets (see schema.sql comments)
// 4. Replace the values below with your project credentials

const SUPABASE_URL      = 'https://kxiglbdnxbusivnxqhob.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4aWdsYmRueGJ1c2l2bnhxaG9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjcxNDgsImV4cCI6MjA5MTgwMzE0OH0.3EFB6WuE5TUgGaTvdDRIxKOQ0OsHGEA2fWRmEg2RzSE';

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
    name: 'LMS Скарбниця',
    version: 'бета',

    // Supabase Storage
    storagePublicUrl: `${SUPABASE_URL}/storage/v1/object/public`,
    signedUrlExpiry:  3600, // seconds (1 hour)

    buckets: {
        thumbnails: 'course-thumbnails',
        resources:  'lesson-resources',
        scorm:      'scorm-packages',
        newsImages: 'news-images',
        avatars:    'avatars',
        pageFiles:  'page-files'
    },

    roles: {
        OWNER:   'owner',
        ADMIN:   'admin',
        SMM:     'smm',
        TEACHER: 'teacher',
        MANAGER: 'manager',
        USER:    'user'
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

    isOwner()   { return this.profile?.role === 'owner'; },
    isAdmin()   { return this.profile?.role === 'admin' || this.profile?.role === 'owner'; },
    isSmm()     { return this.profile?.role === 'smm'; },
    isTeacher() { return this.profile?.role === 'teacher'; },
    isManager() { return this.profile?.role === 'manager'; },
    canSchedule(){ return ['owner','admin','manager'].includes(this.profile?.role); },
    // isStaff: всі хто може керувати контентом
    isStaff()   { return ['owner','admin','smm','teacher'].includes(this.profile?.role); }
};
