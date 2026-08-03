-- v173: schedule_locations.order_index — серверний порядок локацій
--
-- Порядок локацій у "Розділ локацій" зберігався лише в localStorage (per-браузер,
-- per-керівник) — тому партнер по блоку бачив локації в довільному порядку,
-- ніяк не пов'язаному з тим, як власник упорядкував їх собі. Додаємо серверне
-- поле order_index, яке керівник-власник синхронізує з localStorage при кожному
-- перетягуванні (js/pages/schedule-graph.js, _syncLocOrderToDb), і яке тепер
-- визначає порядок і в "Розділ локацій", і в "Всі локації блоку" для партнерів.

BEGIN;

ALTER TABLE public.schedule_locations ADD COLUMN IF NOT EXISTS order_index integer;

COMMIT;
