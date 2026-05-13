-- v53: add schedule JSONB column to courses
ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT '[]'::jsonb;
