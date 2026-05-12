-- v49: staff label (intern / mentor) on profiles
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS label text CHECK (label IN ('intern', 'mentor'));
