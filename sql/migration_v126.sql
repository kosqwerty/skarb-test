-- Migration v126: intern tabель — test categories + praktyka score

-- Add intern_category to tests (used to map test results to tabель fields)
ALTER TABLE public.tests
    ADD COLUMN IF NOT EXISTS intern_category text
        CHECK (intern_category IN ('техніка', 'магазин', 'драг_метали', 'загальний'));

-- Add praktyka_score to interns (manual field set by admin)
ALTER TABLE public.interns
    ADD COLUMN IF NOT EXISTS praktyka_score numeric;
