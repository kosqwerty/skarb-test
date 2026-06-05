-- v95: allow employees to insert/update their own schedule_entries

-- Drop existing entry policies and recreate permissive ones
DROP POLICY IF EXISTS "sentry_insert" ON schedule_entries;
DROP POLICY IF EXISTS "sentry_update" ON schedule_entries;
DROP POLICY IF EXISTS "sentry_delete" ON schedule_entries;
DROP POLICY IF EXISTS "sentry_select" ON schedule_entries;

CREATE POLICY "sentry_select" ON schedule_entries FOR SELECT USING (true);

-- Managers (location owners) can insert any entry for their location
-- Employees can insert/update only their own entries
CREATE POLICY "sentry_insert" ON schedule_entries FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM schedule_locations
        WHERE id = location_id AND created_by = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM schedule_viewers
        WHERE location_id = schedule_entries.location_id AND user_id = auth.uid()
    )
);

CREATE POLICY "sentry_update" ON schedule_entries FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM schedule_locations
        WHERE id = location_id AND created_by = auth.uid()
    )
);

CREATE POLICY "sentry_delete" ON schedule_entries FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM schedule_locations
        WHERE id = location_id AND created_by = auth.uid()
    )
);
