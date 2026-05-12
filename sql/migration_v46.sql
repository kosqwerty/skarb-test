-- v46: store cal event done/ack state in DB instead of localStorage
ALTER TABLE public.personal_cal_events
    ADD COLUMN IF NOT EXISTS is_done     boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS acked_date  date;
