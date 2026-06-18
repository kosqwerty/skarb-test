-- Migration v119: intern profile_id FK SET NULL on delete (instead of CASCADE)
-- Also drops NOT NULL + trigger that auto-saves profile snapshot before SET NULL

-- Step 1: drop NOT NULL constraint
ALTER TABLE public.interns ALTER COLUMN profile_id DROP NOT NULL;

-- Step 2: change FK from CASCADE to SET NULL
ALTER TABLE public.interns DROP CONSTRAINT IF EXISTS interns_profile_id_fkey;

ALTER TABLE public.interns
    ADD CONSTRAINT interns_profile_id_fkey
    FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Step 3: trigger that saves profile snapshot when profile_id is set to NULL
CREATE OR REPLACE FUNCTION public.interns_snapshot_on_unlink()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    p public.profiles%ROWTYPE;
BEGIN
    -- Fire only when profile_id changes from non-null to null
    IF OLD.profile_id IS NOT NULL AND NEW.profile_id IS NULL THEN
        SELECT * INTO p FROM public.profiles WHERE id = OLD.profile_id;
        IF FOUND AND (NEW.profile_snapshot IS NULL OR NEW.profile_snapshot = '{}'::jsonb) THEN
            NEW.profile_snapshot := jsonb_build_object(
                'full_name',    p.full_name,
                'email',        p.email,
                'phone',        p.phone,
                'city',         p.city,
                'job_position', p.job_position,
                'gender',       p.gender,
                'avatar_url',   p.avatar_url,
                'archived_at',  to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS interns_snapshot_on_unlink ON public.interns;
CREATE TRIGGER interns_snapshot_on_unlink
    BEFORE UPDATE ON public.interns
    FOR EACH ROW EXECUTE FUNCTION public.interns_snapshot_on_unlink();
