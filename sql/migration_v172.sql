-- v172: schedule_shift_config — дозволити читати конфіг блок-партнерам
--
-- Кастомні типи змін (schedule_shift_config) — персональні per-менеджер, і
-- раніше читались лише самим власником (+ його співробітниками, v164). При
-- перегляді "Всі локації" в межах БЛОКу (schedule_blocks) партнерські локації
-- можуть використовувати типи змін, яких немає в конфігу поточного керівника —
-- без права читати їх RLS мовчки блокував запит, і бейджі/легенда для таких
-- типів не рендерились. Додаємо permissive policy: читати можна, якщо обидва
-- (поточний користувач і власник конфігу) — учасники ОДНОГО й того ж блоку
-- (творець або прийнятий учасник).

BEGIN;

DROP POLICY IF EXISTS "ssc_select_block_partner" ON public.schedule_shift_config;
CREATE POLICY "ssc_select_block_partner" ON public.schedule_shift_config FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.schedule_blocks b
        WHERE (b.created_by = auth.uid() OR public.is_accepted_block_member(b.id, auth.uid()))
          AND (b.created_by = schedule_shift_config.user_id OR public.is_accepted_block_member(b.id, schedule_shift_config.user_id))
    )
);

COMMIT;
