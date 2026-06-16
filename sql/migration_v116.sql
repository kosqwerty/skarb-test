-- Migration v116: Protect intern records when profile is deleted
-- Change profile_id FK from CASCADE to SET NULL + auto-snapshot trigger

-- 1. Drop existing FK constraint (find actual name first)
ALTER TABLE public.interns
    DROP CONSTRAINT IF EXISTS interns_profile_id_fkey;

-- 2. Re-add with SET NULL so intern record survives profile deletion
ALTER TABLE public.interns
    ADD CONSTRAINT interns_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
    ON DELETE SET NULL;

-- 3. Trigger function: snapshot profile data into all related interns before profile row is deleted
CREATE OR REPLACE FUNCTION public.fn_snapshot_intern_on_profile_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE public.interns
    SET profile_snapshot = jsonb_build_object(
        'full_name',    OLD.full_name,
        'email',        OLD.email,
        'phone',        OLD.phone,
        'city',         OLD.city,
        'job_position', OLD.job_position,
        'gender',       OLD.gender,
        'avatar_url',   OLD.avatar_url,
        'archived_at',  NOW()
    )
    WHERE profile_id = OLD.id
      AND profile_snapshot IS NULL;  -- don't overwrite existing snapshot
    RETURN OLD;
END;
$$;

-- 4. Attach trigger to profiles table
DROP TRIGGER IF EXISTS trg_snapshot_intern_on_profile_delete ON public.profiles;
CREATE TRIGGER trg_snapshot_intern_on_profile_delete
    BEFORE DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_snapshot_intern_on_profile_delete();
