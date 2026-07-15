-- Migration v150: link personal calendar events to the lecture that created them,
-- so signing up for a lecture can auto-add calendar entries (one per day) that get
-- cleaned up automatically when the lecture is deleted or the user cancels signup.

ALTER TABLE personal_cal_events
    ADD COLUMN IF NOT EXISTS lecture_id uuid REFERENCES lectures(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_personal_cal_events_lecture_id ON personal_cal_events(lecture_id);
