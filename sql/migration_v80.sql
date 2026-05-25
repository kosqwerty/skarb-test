-- v80: birth_date_privacy — user controls who sees their birth year
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS birth_date_privacy TEXT DEFAULT 'full'
    CHECK (birth_date_privacy IN ('full', 'no_year', 'hidden'));
