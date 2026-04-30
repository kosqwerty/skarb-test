-- ================================================================
-- Migration v25: Recurring events for personal calendar
-- ================================================================

ALTER TABLE public.personal_cal_events
    ADD COLUMN IF NOT EXISTS repeat_type text DEFAULT 'none'
    CHECK (repeat_type IN ('none', 'weekly', 'monthly'));
