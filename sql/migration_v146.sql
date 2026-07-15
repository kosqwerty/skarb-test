-- Migration v146: recurrence interval for lectures (every week / every N weeks)

ALTER TABLE lectures
    ADD COLUMN IF NOT EXISTS recurrence_interval_weeks int NOT NULL DEFAULT 1;
