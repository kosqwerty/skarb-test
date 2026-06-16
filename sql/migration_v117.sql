-- Migration v117: Fix planned_end_date for completed interns imported without it

UPDATE public.interns
SET planned_end_date = actual_end_date
WHERE status = 'completed'
  AND actual_end_date IS NOT NULL
  AND planned_end_date IS NULL;
