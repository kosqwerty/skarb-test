-- v54: course_teachers — multiple teachers per course with optional group label
CREATE TABLE IF NOT EXISTS course_teachers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    label      TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
);

ALTER TABLE course_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_teachers_read" ON course_teachers
    FOR SELECT USING (true);

CREATE POLICY "course_teachers_write" ON course_teachers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('owner','admin','smm','teacher')
        )
    );
