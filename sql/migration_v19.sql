-- ================================================================
-- LMS Migration v19 — Головна сторінка (is_home)
-- Виконати в Supabase SQL Editor
-- ================================================================

ALTER TABLE public.custom_pages
    ADD COLUMN IF NOT EXISTS is_home BOOLEAN NOT NULL DEFAULT FALSE;

-- Лише одна сторінка може бути головною одночасно
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_pages_one_home
    ON public.custom_pages (is_home)
    WHERE is_home = TRUE;

NOTIFY pgrst, 'reload schema';
