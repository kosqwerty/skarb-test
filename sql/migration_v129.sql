-- Migration v129: change praktyka score columns to text (supports values like 4-, 4+, 5-)

ALTER TABLE public.interns
    ALTER COLUMN praktyka_score TYPE text USING praktyka_score::text;

ALTER TABLE public.interns
    ALTER COLUMN praktyka_dm_score TYPE text USING praktyka_dm_score::text;
