-- v160: audit-trail FKs (who created/updated/granted a row) block user
-- deletion entirely instead of just nulling out the reference. admin_user_delete
-- does `DELETE FROM auth.users` and relies on cascade — these 7 FKs have no
-- ON DELETE clause (defaults to NO ACTION), so deleting ANY user who ever
-- touched a schedule entry/location/log/etc. as the *editor* (not the owner)
-- fails with a 409 FK-violation, even though the actual data row should
-- obviously survive the editor's account being deleted.

BEGIN;

ALTER TABLE label_restrictions DROP CONSTRAINT IF EXISTS label_restrictions_created_by_fkey;
ALTER TABLE label_restrictions ADD CONSTRAINT label_restrictions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE schedule_assignments DROP CONSTRAINT IF EXISTS schedule_assignments_created_by_fkey;
ALTER TABLE schedule_assignments ADD CONSTRAINT schedule_assignments_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE schedule_entries DROP CONSTRAINT IF EXISTS schedule_entries_updated_by_fkey;
ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE schedule_locations DROP CONSTRAINT IF EXISTS schedule_locations_created_by_fkey;
ALTER TABLE schedule_locations ADD CONSTRAINT schedule_locations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE schedule_log DROP CONSTRAINT IF EXISTS schedule_log_changed_by_fkey;
ALTER TABLE schedule_log ADD CONSTRAINT schedule_log_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE schedule_viewers DROP CONSTRAINT IF EXISTS schedule_viewers_granted_by_fkey;
ALTER TABLE schedule_viewers ADD CONSTRAINT schedule_viewers_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE test_attempt_grants DROP CONSTRAINT IF EXISTS test_attempt_grants_granted_by_fkey;
ALTER TABLE test_attempt_grants ADD CONSTRAINT test_attempt_grants_granted_by_fkey
    FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL;

COMMIT;
