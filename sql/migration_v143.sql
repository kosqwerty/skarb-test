-- Migration v143: lectures (multi-day events students can self-enroll into)

CREATE TABLE IF NOT EXISTS lectures (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    title         text        NOT NULL,
    description   text,
    cover_image   text,
    start_date    date        NOT NULL,
    duration_days int         NOT NULL DEFAULT 1,
    is_published  boolean     NOT NULL DEFAULT true,
    created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now()
);
ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lectures_select" ON lectures;
CREATE POLICY "lectures_select" ON lectures FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "lectures_insert" ON lectures;
CREATE POLICY "lectures_insert" ON lectures FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "lectures_update" ON lectures;
CREATE POLICY "lectures_update" ON lectures FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "lectures_delete" ON lectures;
CREATE POLICY "lectures_delete" ON lectures FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS lecture_enrollments (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id  uuid        NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    enrolled_at timestamptz DEFAULT now(),
    UNIQUE(lecture_id, user_id)
);
ALTER TABLE lecture_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lecenr_select" ON lecture_enrollments;
CREATE POLICY "lecenr_select" ON lecture_enrollments FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "lecenr_insert" ON lecture_enrollments;
CREATE POLICY "lecenr_insert" ON lecture_enrollments FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "lecenr_delete" ON lecture_enrollments;
CREATE POLICY "lecenr_delete" ON lecture_enrollments FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
);
