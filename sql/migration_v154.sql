-- v154: cover image for surveys (shown on survey cards/table + list banner)

ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS cover_image TEXT;
