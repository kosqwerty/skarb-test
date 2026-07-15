-- Migration v147: optional start time for lectures (date already existed, time was missing)

ALTER TABLE lectures
    ADD COLUMN IF NOT EXISTS start_time time;
