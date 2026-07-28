-- v163: schedule_assignments.pinned_months
-- Коли керівник знімає позначку "основний" (is_primary) із співробітника
-- під час перегляду майбутнього місяця, той одразу зникає з графіка
-- (тимчасові співробітники в майбутніх місяцях показуються лише якщо є
-- реальні записи змін). pinned_months дозволяє явно "закріпити" видимість
-- співробітника в конкретному місяці, незалежно від наявності записів.

BEGIN;

ALTER TABLE public.schedule_assignments
    ADD COLUMN IF NOT EXISTS pinned_months text[] NOT NULL DEFAULT '{}';

COMMIT;
