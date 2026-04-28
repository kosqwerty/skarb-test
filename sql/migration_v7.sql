-- ================================================================
-- LMS Migration v7 — Таблиця реакцій на новини
-- Виконати в Supabase SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS public.news_reactions (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    news_id    UUID        NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
    type       TEXT        NOT NULL CHECK (type IN ('up','down')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (news_id, user_id)
);

ALTER TABLE public.news_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select" ON public.news_reactions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "reactions_insert" ON public.news_reactions
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions_update" ON public.news_reactions
    FOR UPDATE TO authenticated
    USING     (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions_delete" ON public.news_reactions
    FOR DELETE TO authenticated USING (user_id = auth.uid());
