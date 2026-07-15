-- Migration v151: manual grading for open-ended (question_type = 'text') test
-- questions. Until now a non-empty text answer was auto-scored as correct —
-- this adds real storage for what the student typed plus a review workflow:
-- the attempt is marked needs_review = true on submit and stays that way
-- (score/percentage/passed provisional) until staff grades every text answer.

ALTER TABLE attempt_answers
    ADD COLUMN IF NOT EXISTS answer_text text;

ALTER TABLE test_attempts
    ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS reviewed_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at  timestamptz;

CREATE INDEX IF NOT EXISTS idx_test_attempts_needs_review
    ON test_attempts(needs_review) WHERE needs_review = true;

-- Staff (owner/admin/smm/teacher) need to be able to update other users'
-- attempts/answers when grading — the existing policies only allow the
-- attempt owner to update their own row.
DROP POLICY IF EXISTS "tattempts_update_staff" ON test_attempts;
CREATE POLICY "tattempts_update_staff" ON test_attempts FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner','admin','smm','teacher')
    ));

DROP POLICY IF EXISTS "aansw_update_staff" ON attempt_answers;
CREATE POLICY "aansw_update_staff" ON attempt_answers FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role IN ('owner','admin','smm','teacher')
    ));
