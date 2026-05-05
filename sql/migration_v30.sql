-- Replace simple auto_assign boolean with positions-based automation.
-- Tests will auto-assign to new employees whose job_position matches any entry in the array.

ALTER TABLE public.tests
    DROP COLUMN IF EXISTS auto_assign;

ALTER TABLE public.tests
    ADD COLUMN IF NOT EXISTS auto_assign_positions text[] DEFAULT '{}';
