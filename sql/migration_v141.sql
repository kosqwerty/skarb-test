-- Migration v141: test groups (sequential test paths with cover image, title, description)

CREATE TABLE IF NOT EXISTS test_groups (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    title         text        NOT NULL,
    description   text,
    cover_image   text,
    is_sequential boolean     NOT NULL DEFAULT true,
    created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now()
);
ALTER TABLE test_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tgroups_select" ON test_groups;
CREATE POLICY "tgroups_select" ON test_groups FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "tgroups_insert" ON test_groups;
CREATE POLICY "tgroups_insert" ON test_groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "tgroups_update" ON test_groups;
CREATE POLICY "tgroups_update" ON test_groups FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "tgroups_delete" ON test_groups;
CREATE POLICY "tgroups_delete" ON test_groups FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS test_group_items (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    uuid        NOT NULL REFERENCES test_groups(id) ON DELETE CASCADE,
    test_id     uuid        NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    order_index int         NOT NULL DEFAULT 0,
    created_at  timestamptz DEFAULT now(),
    UNIQUE(group_id, test_id)
);
ALTER TABLE test_group_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tgitems_select" ON test_group_items;
CREATE POLICY "tgitems_select" ON test_group_items FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "tgitems_insert" ON test_group_items;
CREATE POLICY "tgitems_insert" ON test_group_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "tgitems_update" ON test_group_items;
CREATE POLICY "tgitems_update" ON test_group_items FOR UPDATE USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "tgitems_delete" ON test_group_items;
CREATE POLICY "tgitems_delete" ON test_group_items FOR DELETE USING (auth.uid() IS NOT NULL);

ALTER TABLE test_assignments
    ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES test_groups(id) ON DELETE SET NULL;

-- test_assignments had no UPDATE policy — upsert()'s implicit UPDATE on conflict
-- (re-assigning a user who already has a row for that test, e.g. changing the
-- deadline or assigning a group that includes an already-assigned test) was
-- silently blocked by RLS with a 403.
DROP POLICY IF EXISTS "tassign_update" ON test_assignments;
CREATE POLICY "tassign_update" ON test_assignments FOR UPDATE USING (auth.uid() IS NOT NULL);
