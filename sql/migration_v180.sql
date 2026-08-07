-- v180: RLS-політики page_files_insert/update/delete на storage.objects
-- перевіряли роль 'owner' — стару назву ролі, якої вже немає в поточній
-- моделі ролей додатку (js/config.js: AppState.isSuperAdmin() === 'superadmin').
-- Через це жоден користувач з роллю 'superadmin' не міг пройти цю перевірку
-- (INSERT завжди падав з "new row violates row-level security policy",
-- незалежно від типу файлу — картинка це чи документ).
-- Додаємо 'superadmin' до дозволених ролей, лишаючи 'owner'/'teacher' про
-- запас (на випадок старих рядків profiles.role, якщо рейм ще не завершено).

BEGIN;

DROP POLICY IF EXISTS "page_files_insert" ON storage.objects;
CREATE POLICY "page_files_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'page-files'
        AND get_current_role() = ANY (ARRAY['owner','superadmin','admin','smm','teacher'])
    );

DROP POLICY IF EXISTS "page_files_update" ON storage.objects;
CREATE POLICY "page_files_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'page-files'
        AND get_current_role() = ANY (ARRAY['owner','superadmin','admin','smm','teacher'])
    );

DROP POLICY IF EXISTS "page_files_delete" ON storage.objects;
CREATE POLICY "page_files_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'page-files'
        AND get_current_role() = ANY (ARRAY['owner','superadmin','admin','smm','teacher'])
    );

COMMIT;
