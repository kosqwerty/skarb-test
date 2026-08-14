-- v191: розділи (section) для групування сторінок у Collections.

BEGIN;

ALTER TABLE public.custom_pages ADD COLUMN IF NOT EXISTS section text;

COMMIT;
