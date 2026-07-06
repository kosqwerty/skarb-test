-- Migration v139: allow all authenticated users to read feedback-screenshots
-- Admin replies upload images to feedback-screenshots bucket; users need to read them.

DROP POLICY IF EXISTS "read_feedback_screenshots" ON storage.objects;

CREATE POLICY "read_feedback_screenshots" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'feedback-screenshots' AND auth.role() = 'authenticated'
    );
