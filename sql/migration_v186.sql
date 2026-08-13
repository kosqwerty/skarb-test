-- v186: для бакета scorm-packages була лише INSERT-політика (staff_upload_scorm),
-- SELECT-політики не було взагалі — тому ScormPlayer._loadContent не міг
-- прочитати щойно завантажений файл (createSignedUrl повертав "Object not
-- found": Supabase Storage навмисно ховає факт існування об'єкта, коли SELECT
-- заблоковано RLS, замість явної помилки доступу).

BEGIN;

CREATE POLICY "scorm_packages_objects_select" ON storage.objects
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (bucket_id = 'scorm-packages');

COMMIT;
