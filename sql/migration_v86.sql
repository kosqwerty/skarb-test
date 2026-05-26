-- v86: user_sessions table — track active browser sessions per user

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,   -- random key stored in sessionStorage (per tab)
    user_agent    TEXT,
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx      ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_last_seen_at_idx ON public.user_sessions(last_seen_at);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can manage only their own sessions
CREATE POLICY "user_sessions_own" ON public.user_sessions
    FOR ALL TO authenticated
    USING  (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Admin/owner can read all sessions (for activity panel)
CREATE POLICY "user_sessions_admin_read" ON public.user_sessions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('owner', 'admin')
        )
    );

-- Cleanup: delete sessions older than 10 minutes (called periodically)
-- This is handled by the app heartbeat — no cron needed
