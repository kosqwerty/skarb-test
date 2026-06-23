-- Migration v128: add praktyka_dm_score to interns (manual praktyka score for drag metals)

ALTER TABLE public.interns
    ADD COLUMN IF NOT EXISTS praktyka_dm_score numeric;
