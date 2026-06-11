-- ================================================================
-- LMS Migration v102 — custom_pages: search_enabled flag
-- ================================================================

ALTER TABLE public.custom_pages
    ADD COLUMN IF NOT EXISTS search_enabled BOOLEAN NOT NULL DEFAULT false;
