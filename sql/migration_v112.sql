-- Migration v112: Prefix job_position with "Стажер " for all intern profiles

UPDATE public.profiles
SET job_position = 'Стажер ' || job_position
WHERE label = 'intern'
  AND job_position IS NOT NULL
  AND job_position <> ''
  AND job_position NOT LIKE 'Стажер%';

-- Set job_position = 'Стажер' for interns with empty/null position
UPDATE public.profiles
SET job_position = 'Стажер'
WHERE label = 'intern'
  AND (job_position IS NULL OR job_position = '');
