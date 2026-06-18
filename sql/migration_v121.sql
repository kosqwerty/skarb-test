-- Migration v121: schedule fields on intern_disciplines
-- Adds hours, place, cabinet, row_type for schedule-grid view

ALTER TABLE public.intern_disciplines
    ADD COLUMN IF NOT EXISTS hours   text,
    ADD COLUMN IF NOT EXISTS place   text,
    ADD COLUMN IF NOT EXISTS cabinet text,
    ADD COLUMN IF NOT EXISTS row_type text NOT NULL DEFAULT 'normal';

-- row_type: 'normal' | 'holiday' | 'highlight'

-- Backfill: auto-create intern rows for existing profiles with label='intern'
INSERT INTO public.interns (profile_id, manager_id, status)
SELECT p.id, p.manager_id, 'active'
FROM public.profiles p
WHERE p.label = 'intern'
  AND NOT EXISTS (
    SELECT 1 FROM public.interns i WHERE i.profile_id = p.id
  );
