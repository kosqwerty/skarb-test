-- ================================================================
-- Migration v23: Move schedule work hours from localStorage to DB
-- ================================================================

ALTER TABLE public.schedule_locations
    ADD COLUMN IF NOT EXISTS work_start time,
    ADD COLUMN IF NOT EXISTS work_end   time;
