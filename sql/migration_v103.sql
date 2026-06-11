-- ================================================================
-- LMS Migration v103 — red_folder_items: tov_text field
-- ================================================================

ALTER TABLE public.red_folder_items
    ADD COLUMN IF NOT EXISTS tov_text TEXT;
