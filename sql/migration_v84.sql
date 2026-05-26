-- v84: add profiles table to supabase_realtime publication
-- Required for force_logout and block-status Realtime events to work

ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
