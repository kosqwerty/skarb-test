-- Migration v148: lecture_enrollments.user_id needs a direct FK to profiles (not just
-- auth.users) so PostgREST can resolve the `user:profiles!user_id(...)` embed used
-- when showing a lecturer their participants' full names.

DO $$
BEGIN
    ALTER TABLE lecture_enrollments
        ADD CONSTRAINT lecture_enrollments_user_id_profiles_fkey
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
