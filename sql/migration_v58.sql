-- v58: course preview info block

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS course_info JSONB DEFAULT '{}'::jsonb;
