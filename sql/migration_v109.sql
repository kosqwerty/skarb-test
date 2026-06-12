-- ================================================================
-- LMS Migration v109 — dov_ids на rf_tabs і bd_tabs
-- ================================================================

ALTER TABLE public.rf_tabs
    ADD COLUMN IF NOT EXISTS dov_ids UUID[] DEFAULT '{}';

ALTER TABLE public.bd_tabs
    ADD COLUMN IF NOT EXISTS dov_ids UUID[] DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
