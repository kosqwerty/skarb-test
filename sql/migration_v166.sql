-- v166: schedule_locations — ознака "Обмін валют"

BEGIN;

ALTER TABLE public.schedule_locations
    ADD COLUMN IF NOT EXISTS has_currency_exchange boolean NOT NULL DEFAULT false;

COMMIT;
