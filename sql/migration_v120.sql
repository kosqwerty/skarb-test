-- Migration v120: characteristic and mentors data on interns table
-- Stored directly on the interns row so data survives profile deletion (profile_id SET NULL)

ALTER TABLE public.interns
    ADD COLUMN IF NOT EXISTS characteristic jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.interns
    ADD COLUMN IF NOT EXISTS mentors_info jsonb NOT NULL DEFAULT '[]'::jsonb;

-- characteristic shape (future):
-- { "rating": 4, "summary": "...", "comments": [...] }

-- mentors_info shape (future):
-- [{ "profile_id": "uuid", "full_name": "...", "role": "mentor", "feedback": "..." }, ...]
