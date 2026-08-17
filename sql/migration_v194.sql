-- v194: дозволити адміну видаляти test_attempts (і скоригувати грант-політику
-- test_attempt_grants) — потрібно для нової поведінки "зняти людину з групи
-- тестів" (js/pages/tests-manager.js TestsManagerAPI.unassignGroup), яка тепер
-- прибирає не лише test_assignments, а й уже завершені спроби/додаткові
-- спроби по тестах цієї групи. Раніше на test_attempts не було жодної DELETE
-- policy — RLS мовчки блокував видалення.
--
-- Стара "admin manage grants" перевіряла role IN ('admin','owner','teacher') —
-- застарілі назви ролей з попередньої схеми; в поточній схемі це
-- 'admin'/'superadmin'. Перевипускаємо політику з актуальним списком ролей.

BEGIN;

DROP POLICY IF EXISTS "tattempts_delete_admin" ON public.test_attempts;
CREATE POLICY "tattempts_delete_admin" ON public.test_attempts AS PERMISSIVE FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'superadmin')
    ));

DROP POLICY IF EXISTS "aansw_delete_admin" ON public.attempt_answers;
CREATE POLICY "aansw_delete_admin" ON public.attempt_answers AS PERMISSIVE FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'superadmin')
    ));

DROP POLICY IF EXISTS "admin manage grants" ON public.test_attempt_grants;
CREATE POLICY "admin manage grants" ON public.test_attempt_grants AS PERMISSIVE FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'superadmin')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'superadmin')
    ));

COMMIT;
