-- v55: storage policies for course-thumbnails bucket

-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-thumbnails', 'course-thumbnails', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if any, then recreate
DO $$ BEGIN
  DROP POLICY IF EXISTS "thumbnails_insert" ON storage.objects;
  DROP POLICY IF EXISTS "thumbnails_update" ON storage.objects;
  DROP POLICY IF EXISTS "thumbnails_delete" ON storage.objects;
  DROP POLICY IF EXISTS "thumbnails_select" ON storage.objects;
END $$;

CREATE POLICY "thumbnails_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-thumbnails');

CREATE POLICY "thumbnails_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'course-thumbnails');

CREATE POLICY "thumbnails_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-thumbnails');

CREATE POLICY "thumbnails_select"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'course-thumbnails');
