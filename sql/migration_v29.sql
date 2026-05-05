-- PostgREST resolves embedded joins only via FK relationships.
-- test_attempts.user_id and test_assignments.user_id reference auth.users(id),
-- so profiles!user_id fails with 400. Add FKs to profiles(id) to fix it.

ALTER TABLE public.test_attempts
    ADD CONSTRAINT IF NOT EXISTS test_attempts_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.test_assignments
    ADD CONSTRAINT IF NOT EXISTS test_assignments_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
