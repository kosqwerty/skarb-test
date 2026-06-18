-- Migration v118: employment_info column on interns
-- Stores employment lifecycle: employed_since (when status → completed), terminated_at (when profile deleted)

ALTER TABLE public.interns
    ADD COLUMN IF NOT EXISTS employment_info jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Example:
-- { "employed_since": "2026-06-18" }
-- { "employed_since": "2026-06-18", "terminated_at": "2026-12-01" }
