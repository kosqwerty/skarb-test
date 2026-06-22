-- Migration v124: add preview_dow to intern_schedule_templates
ALTER TABLE public.intern_schedule_templates
    ADD COLUMN IF NOT EXISTS preview_dow smallint NOT NULL DEFAULT 1
        CHECK (preview_dow BETWEEN 0 AND 6);
