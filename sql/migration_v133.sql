-- Migration v133: Add 'intern' as a first-class role in profiles

-- Drop existing role check constraint (name may vary — cover both common names)
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_fkey;

-- Recreate with 'intern' included
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('owner','admin','smm','teacher','manager','user','intern','student','ceo'));
