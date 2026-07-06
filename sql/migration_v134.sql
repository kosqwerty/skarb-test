-- Migration v134: fix user_sessions (Heartbeat) + user_login_sessions + user_nav_log
-- Drops ALL three tables and recreates from scratch with correct schemas.

DROP TABLE IF EXISTS public.user_nav_log        CASCADE;
DROP TABLE IF EXISTS public.user_login_sessions  CASCADE;
DROP TABLE IF EXISTS public.user_sessions        CASCADE;

-- ── user_sessions — Heartbeat (session_token-based) ───────────────────
CREATE TABLE public.user_sessions (
    id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    session_token  TEXT        NOT NULL UNIQUE,
    user_id        UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
    user_agent     TEXT,
    last_seen_at   TIMESTAMPTZ DEFAULT NOW(),
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_all_session" ON public.user_sessions
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_all_session" ON public.user_sessions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

-- ── user_login_sessions — login/logout history ────────────────────────
CREATE TABLE public.user_login_sessions (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at     TIMESTAMPTZ,
    ua           TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX user_login_sessions_user_id_idx    ON public.user_login_sessions(user_id);
CREATE INDEX user_login_sessions_started_at_idx ON public.user_login_sessions(started_at DESC);

ALTER TABLE public.user_login_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_login_sessions" ON public.user_login_sessions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );
CREATE POLICY "own_insert_login_session" ON public.user_login_sessions
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_update_login_session" ON public.user_login_sessions
    FOR UPDATE USING (user_id = auth.uid());

-- ── user_nav_log ──────────────────────────────────────────────────────
CREATE TABLE public.user_nav_log (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    from_route   TEXT,
    to_route     TEXT        NOT NULL,
    session_id   UUID        REFERENCES public.user_login_sessions(id) ON DELETE SET NULL,
    ts           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX user_nav_log_user_id_idx ON public.user_nav_log(user_id);
CREATE INDEX user_nav_log_ts_idx      ON public.user_nav_log(ts DESC);
CREATE INDEX user_nav_log_session_idx ON public.user_nav_log(session_id);

ALTER TABLE public.user_nav_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_nav_log" ON public.user_nav_log
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );
CREATE POLICY "own_insert_nav_log" ON public.user_nav_log
    FOR INSERT WITH CHECK (user_id = auth.uid());
