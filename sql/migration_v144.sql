-- Migration v144: lectures — weekly recurrence (new group/occurrence each week,
-- enrollments don't carry over) + a lecturer per lecture who can see participants.

ALTER TABLE lectures
    ADD COLUMN IF NOT EXISTS lecturer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES lectures(id) ON DELETE SET NULL;

-- Prevents duplicate weekly occurrences of the same template landing on the same date
-- (client-side generation can be triggered by more than one visitor at once).
CREATE UNIQUE INDEX IF NOT EXISTS lectures_recurrence_unique
    ON lectures (recurrence_parent_id, start_date) WHERE recurrence_parent_id IS NOT NULL;
