-- v44: add thumbnail_position to news
ALTER TABLE news
    ADD COLUMN IF NOT EXISTS thumbnail_position TEXT DEFAULT 'center';

-- v44b: ensure notifications.read_at exists (table may have been created before v31)
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
