-- v175: schedule_locations.co_owner_ids — кілька співвласників локації (замінює co_owner_id)
--
-- "Спільна локація" (v174) дозволяла лише ОДНОГО співвласника. Тепер потрібно
-- дозволити довільну кількість керівників з однаковими правами редагування на
-- одну локацію — замінюємо одиночний co_owner_id масивом co_owner_ids.

BEGIN;

ALTER TABLE public.schedule_locations ADD COLUMN IF NOT EXISTS co_owner_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.schedule_locations
SET co_owner_ids = ARRAY[co_owner_id]
WHERE co_owner_id IS NOT NULL AND NOT (co_owner_id = ANY(co_owner_ids));

CREATE INDEX IF NOT EXISTS idx_schedule_locations_co_owner_ids ON public.schedule_locations USING GIN (co_owner_ids);

ALTER TABLE public.schedule_locations DROP COLUMN IF EXISTS co_owner_id;

COMMIT;
