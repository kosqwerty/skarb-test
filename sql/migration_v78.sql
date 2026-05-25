-- v78: force_logout flag on profiles (admin can terminate user session)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS force_logout BOOLEAN DEFAULT FALSE;
