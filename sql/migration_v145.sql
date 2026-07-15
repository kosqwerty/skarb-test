-- Migration v145: a lecture (weekly occurrence) can have several lecturers,
-- and different weeks of the same recurring lecture can have different lecturers —
-- replace the single lectures.lecturer_id column with a join table.

ALTER TABLE lectures DROP COLUMN IF EXISTS lecturer_id;

CREATE TABLE IF NOT EXISTS lecture_lecturers (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id uuid NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    UNIQUE(lecture_id, profile_id)
);
ALTER TABLE lecture_lecturers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leclect_select" ON lecture_lecturers;
CREATE POLICY "leclect_select" ON lecture_lecturers FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "leclect_insert" ON lecture_lecturers;
CREATE POLICY "leclect_insert" ON lecture_lecturers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "leclect_delete" ON lecture_lecturers;
CREATE POLICY "leclect_delete" ON lecture_lecturers FOR DELETE USING (auth.uid() IS NOT NULL);
