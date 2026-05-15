-- v62: fix notifications table — add missing columns (message, is_read, link, created_by)

ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS message    TEXT,
    ADD COLUMN IF NOT EXISTS is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS link       TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Sync is_read with existing read_at data
UPDATE public.notifications SET is_read = TRUE WHERE read_at IS NOT NULL AND is_read = FALSE;
