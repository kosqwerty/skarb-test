-- v65: enable REPLICA IDENTITY FULL on notifications for Realtime filtered subscriptions
-- Required for Supabase Realtime to correctly fire INSERT events with RLS + row filters

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
