-- v164: schedule_shift_config — дозволити співробітникам читати типи змін
-- свого керівника (локації)
--
-- Раніше SELECT дозволявся лише власнику конфігу (user_id = auth.uid()),
-- тому в "Мій графік" (ScheduleGraphEmployee) кастомні типи змін, створені
-- керівником локації, були невидимі для співробітників — showed only the
-- built-in "Зміна"/"Відпустка".
--
-- Додаємо ще одну (permissive) SELECT-політику: співробітник, призначений
-- на локацію (schedule_assignments), може читати schedule_shift_config
-- власника цієї локації (schedule_locations.created_by).

BEGIN;

DROP POLICY IF EXISTS "ssc_select_team" ON public.schedule_shift_config;
CREATE POLICY "ssc_select_team" ON public.schedule_shift_config FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.schedule_assignments sa
        JOIN public.schedule_locations sl ON sl.id = sa.location_id
        WHERE sa.user_id = auth.uid() AND sl.created_by = schedule_shift_config.user_id
    )
);

COMMIT;
