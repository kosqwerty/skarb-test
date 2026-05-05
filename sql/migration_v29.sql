-- PostgREST resolves embedded joins only via FK relationships.
-- test_attempts.user_id and test_assignments.user_id reference auth.users(id),
-- so profiles!user_id fails with 400. Add FKs to profiles(id) to fix it.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'test_attempts_user_id_profiles_fkey'
    ) THEN
        ALTER TABLE public.test_attempts
            ADD CONSTRAINT test_attempts_user_id_profiles_fkey
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'test_assignments_user_id_profiles_fkey'
    ) THEN
        ALTER TABLE public.test_assignments
            ADD CONSTRAINT test_assignments_user_id_profiles_fkey
            FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Reload PostgREST schema cache so new FK relationships are picked up immediately
NOTIFY pgrst, 'reload schema';
