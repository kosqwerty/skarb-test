-- migration_v71: personal_cal_events — нагадування за 1 або 2 дні до події

ALTER TABLE public.personal_cal_events
    ADD COLUMN IF NOT EXISTS remind_before_days SMALLINT DEFAULT NULL
    CHECK (remind_before_days IS NULL OR remind_before_days IN (1, 2));
