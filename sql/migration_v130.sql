-- Migration v130: add praktyka comment fields to interns

ALTER TABLE public.interns
    ADD COLUMN IF NOT EXISTS praktyka_comment text;

ALTER TABLE public.interns
    ADD COLUMN IF NOT EXISTS praktyka_dm_comment text;
