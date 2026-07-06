-- Migration v140: soft delete for feedback_reports (user can delete, admin still sees)

ALTER TABLE feedback_reports
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

-- RLS: users can soft-delete their own reports
DROP POLICY IF EXISTS "user_delete_feedback" ON feedback_reports;
CREATE POLICY "user_delete_feedback" ON feedback_reports
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
