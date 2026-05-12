-- v48: end_time for personal calendar events (event duration)
ALTER TABLE public.personal_cal_events
    ADD COLUMN IF NOT EXISTS end_time time;
