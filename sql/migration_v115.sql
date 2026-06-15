-- Migration v115: Add profile_snapshot JSONB to interns for dropped accounts

ALTER TABLE public.interns
    ADD COLUMN IF NOT EXISTS profile_snapshot JSONB;

-- Allow profile_id to be NULL (dropped interns have no auth account)
ALTER TABLE public.interns
    ALTER COLUMN profile_id DROP NOT NULL;
