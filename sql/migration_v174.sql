-- v174: schedule_locations.co_owner_id — спільна локація (2 керівники, рівні права)
--
-- Дозволяє додати РІВНО одного другого керівника (співвласника) на конкретну
-- локацію — на відміну від БЛОКу (крос-видимість усіх локацій кількох
-- керівників, лише для пошуку підмін), це прямий спільний доступ саме до ОДНІЄЇ
-- локації з ідентичними правами редагування (додавання/видалення співробітників,
-- зміни, налаштування, доступ). Існуючі RLS-політики на schedule_locations/
-- schedule_entries/schedule_assignments (sched_loc: write, sched_entries: write,
-- sched_assign: write) уже дозволяють будь-якому керівнику (is_manager()) писати
-- в ці таблиці — новий стовпець потрібен лише для того, щоб клієнт знав, ЯКІ
-- локації показувати співвласнику як "свої" (js/pages/schedule-graph.js,
-- _loadLocations).

BEGIN;

ALTER TABLE public.schedule_locations ADD COLUMN IF NOT EXISTS co_owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_schedule_locations_co_owner ON public.schedule_locations (co_owner_id);

COMMIT;
