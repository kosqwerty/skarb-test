-- v61: custom completion badge per course
ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS badge_url TEXT;
