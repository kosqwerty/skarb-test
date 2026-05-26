-- v81: activity_log — user activity tracking
CREATE TABLE IF NOT EXISTS public.activity_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action      TEXT NOT NULL,           -- 'page_view','login','logout','doc_view','course_open','lesson_open','test_start','test_complete','file_download','search'
    entity_type TEXT,                    -- 'course','lesson','resource','test','page','news'
    entity_id   UUID,
    entity_title TEXT,
    page        TEXT,                    -- hash route, e.g. 'documents','courses/uuid'
    details     JSONB DEFAULT '{}',      -- extra: score, query, duration_sec, etc.
    ua          TEXT,                    -- navigator.userAgent (raw)
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Users can insert their own rows
CREATE POLICY "activity_log_insert_own" ON public.activity_log
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Users can read their own rows
CREATE POLICY "activity_log_select_own" ON public.activity_log
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Admins/owners can read all rows (via function below)
CREATE POLICY "activity_log_select_admin" ON public.activity_log
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin','owner')
        )
    );

-- ── Auto-cleanup: delete logs older than 90 days via pg_cron ──────
-- Enable pg_cron extension (available on Supabase Free)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup at 03:00 UTC
SELECT cron.schedule(
    'cleanup-activity-log-90d',          -- job name (unique)
    '0 3 * * *',                         -- cron: every day at 03:00 UTC
    $$DELETE FROM public.activity_log WHERE created_at < NOW() - INTERVAL '90 days'$$
);
