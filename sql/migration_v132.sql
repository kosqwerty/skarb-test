-- Migration v132: Link interns and profiles to positions reference table
-- Adds position_id FK to interns, profiles, intern_job_settings
-- DB trigger: interns.position_id change → auto-sync profiles.position_id + profiles.job_position

-- ── 1. Add position_id to interns ────────────────────────────────────────────
ALTER TABLE public.interns
    ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL;

-- ── 2. Add position_id to profiles ───────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL;

-- ── 3. Add position_id to intern_job_settings (keep job_position text) ───────
ALTER TABLE public.intern_job_settings
    ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL;

-- Make position_id UNIQUE so it can be used as upsert conflict key later
CREATE UNIQUE INDEX IF NOT EXISTS intern_job_settings_position_id_key
    ON public.intern_job_settings(position_id) WHERE position_id IS NOT NULL;

-- ── 4. Migrate existing data by name match ───────────────────────────────────
-- intern_job_settings: match by name (case-insensitive)
UPDATE public.intern_job_settings ijs
SET position_id = p.id
FROM public.positions p
WHERE lower(trim(ijs.job_position)) = lower(trim(p.name))
  AND ijs.position_id IS NULL;

-- profiles: match job_position text → positions.name
UPDATE public.profiles pr
SET position_id = p.id
FROM public.positions p
WHERE lower(trim(pr.job_position)) = lower(trim(p.name))
  AND pr.position_id IS NULL;

-- interns: copy from profile (intern inherits position from profile at creation)
UPDATE public.interns i
SET position_id = pr.position_id
FROM public.profiles pr
WHERE pr.id = i.profile_id
  AND pr.position_id IS NOT NULL
  AND i.position_id IS NULL;

-- ── 5. Trigger: interns.position_id → sync profiles ──────────────────────────
CREATE OR REPLACE FUNCTION public.sync_intern_position_to_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Only act when position_id actually changes
    IF NEW.position_id IS DISTINCT FROM OLD.position_id THEN
        UPDATE public.profiles
        SET position_id  = NEW.position_id,
            job_position = CASE
                WHEN NEW.position_id IS NULL THEN job_position
                ELSE (SELECT name FROM public.positions WHERE id = NEW.position_id)
            END
        WHERE id = NEW.profile_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS intern_position_sync ON public.interns;
CREATE TRIGGER intern_position_sync
    AFTER UPDATE OF position_id ON public.interns
    FOR EACH ROW EXECUTE FUNCTION public.sync_intern_position_to_profile();

-- ── RLS: no new tables, no new policies needed ───────────────────────────────
-- positions table already has read policy for all authenticated users (v111)
