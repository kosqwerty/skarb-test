-- v76: add 'ceo' role to profiles
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('owner','ceo','admin','smm','teacher','manager','user'));
