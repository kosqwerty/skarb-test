-- ================================================================
-- Migration v28: Add hire date and position appointment date to profiles
-- ================================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS hired_at       date,
    ADD COLUMN IF NOT EXISTS position_since date;
