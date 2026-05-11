-- v45: important flag for personal calendar events
ALTER TABLE public.personal_cal_events
    ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT false;
