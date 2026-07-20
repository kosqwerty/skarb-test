-- v159: fix handle_new_user() — v157 made profiles.base_role NOT NULL but
-- this trigger (fires on every new auth.users row, including inserts made
-- by admin_user_create) never set it, so every new-user creation started
-- failing with "null value in column base_role violates not-null constraint".

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, base_role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$function$
;

COMMIT;
