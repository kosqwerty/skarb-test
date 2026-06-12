-- ================================================================
-- LMS Migration v107 — resources.tab_id для rf-top загальних документів
-- ================================================================

ALTER TABLE public.resources
    ADD COLUMN IF NOT EXISTS tab_id UUID REFERENCES public.rf_tabs(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
