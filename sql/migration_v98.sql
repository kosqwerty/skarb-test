-- ================================================================
-- LMS Migration v98 — custom_pages: додати updated_by
-- ================================================================

ALTER TABLE public.custom_pages
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
