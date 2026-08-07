-- v181: та сама застаріла роль 'owner' (без 'superadmin') знайдена ще в
-- одній storage-політиці — admin_read_feedback_screenshot на бакеті
-- feedback-screenshots. Superadmin не міг переглядати скріншоти з фідбеку.

BEGIN;

DROP POLICY IF EXISTS "admin_read_feedback_screenshot" ON storage.objects;
CREATE POLICY "admin_read_feedback_screenshot" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'feedback-screenshots'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['admin','owner','superadmin'])
        )
    );

COMMIT;
