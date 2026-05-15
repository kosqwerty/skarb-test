-- v60: add start_time / end_time to course_runs for calendar events

ALTER TABLE public.course_runs
    ADD COLUMN IF NOT EXISTS start_time TIME,
    ADD COLUMN IF NOT EXISTS end_time   TIME;
