-- ================================================================
-- LMS Migration v6 — Нові поля news + виправлення RLS
-- Виконати в Supabase SQL Editor
-- ================================================================

-- ── Нові поля ────────────────────────────────────────────────────
ALTER TABLE public.news
    ADD COLUMN IF NOT EXISTS allow_reactions BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS expires_at      TIMESTAMPTZ DEFAULT NULL;

-- ── Виправлення RLS (is_teacher_or_admin() неоднозначна) ─────────
DROP POLICY IF EXISTS "news_select" ON public.news;
DROP POLICY IF EXISTS "news_manage" ON public.news;

CREATE POLICY "news_select" ON public.news FOR SELECT TO authenticated USING (
    is_published = true
    OR public.get_current_role() IN ('owner','admin','smm','teacher')
);

CREATE POLICY "news_manage" ON public.news FOR ALL TO authenticated
    USING     (public.get_current_role() IN ('owner','admin','smm','teacher'))
    WITH CHECK (public.get_current_role() IN ('owner','admin','smm','teacher'));
