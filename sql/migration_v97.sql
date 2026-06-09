-- ================================================================
-- LMS Migration v97 — Fix storage RLS for page-files bucket
-- Причина: is_teacher_or_admin() повертає false в контексті storage,
--          замінено на get_current_role() як у всіх інших таблицях.
--          Додано UPDATE policy для upsert підтримки.
-- ================================================================

DROP POLICY IF EXISTS "page_files_insert" ON storage.objects;
CREATE POLICY "page_files_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'page-files'
        AND public.get_current_role() IN ('owner','admin','smm','teacher')
    );

DROP POLICY IF EXISTS "page_files_update" ON storage.objects;
CREATE POLICY "page_files_update" ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'page-files'
        AND public.get_current_role() IN ('owner','admin','smm','teacher')
    );

DROP POLICY IF EXISTS "page_files_delete" ON storage.objects;
CREATE POLICY "page_files_delete" ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'page-files'
        AND public.get_current_role() IN ('owner','admin','smm','teacher')
    );
