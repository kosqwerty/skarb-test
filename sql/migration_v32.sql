-- Create test-images storage bucket and its RLS policies

INSERT INTO storage.buckets (id, name, public)
VALUES ('test-images', 'test-images', true)
ON CONFLICT (id) DO NOTHING;

-- INSERT: any authenticated user may upload
DROP POLICY IF EXISTS "test_images_insert" ON storage.objects;
CREATE POLICY "test_images_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'test-images');

-- SELECT: public (images are displayed without auth)
DROP POLICY IF EXISTS "test_images_select" ON storage.objects;
CREATE POLICY "test_images_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'test-images');

-- DELETE: any authenticated user may delete (staff removes images)
DROP POLICY IF EXISTS "test_images_delete" ON storage.objects;
CREATE POLICY "test_images_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'test-images');

NOTIFY pgrst, 'reload schema';
