-- Migration v149: lecture preparation materials (tests / test groups / courses /
-- knowledge-base files) auto-assigned on lecture signup, plus a per-test toggle
-- to grant an extra attempt when the test is (re)assigned this way.

ALTER TABLE tests
    ADD COLUMN IF NOT EXISTS grant_attempt_on_reassign boolean NOT NULL DEFAULT false;

ALTER TABLE lectures
    ADD COLUMN IF NOT EXISTS instructions text;

CREATE TABLE IF NOT EXISTS lecture_materials (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id  uuid        NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    kind        text        NOT NULL CHECK (kind IN ('test','test_group','course','resource')),
    ref_id      uuid        NOT NULL,
    note        text,
    order_index int         NOT NULL DEFAULT 0,
    created_at  timestamptz DEFAULT now()
);
ALTER TABLE lecture_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lecmat_select" ON lecture_materials;
CREATE POLICY "lecmat_select" ON lecture_materials FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "lecmat_insert" ON lecture_materials;
CREATE POLICY "lecmat_insert" ON lecture_materials FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "lecmat_delete" ON lecture_materials;
CREATE POLICY "lecmat_delete" ON lecture_materials FOR DELETE USING (auth.uid() IS NOT NULL);
