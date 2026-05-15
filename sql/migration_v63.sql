-- v63: drop restrictive type check on notifications + enable realtime

ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Enable realtime for live badge updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
