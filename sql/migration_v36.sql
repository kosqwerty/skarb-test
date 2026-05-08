-- ================================================================
-- LMS Migration v36 — Soft-delete (кошик) для ресурсів
-- Виконати в Supabase SQL Editor
-- ================================================================

ALTER TABLE public.resources
    ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS deleted_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resources_deleted_at ON public.resources(deleted_at);
