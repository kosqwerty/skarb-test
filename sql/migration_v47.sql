-- v47: ui_prefs jsonb on profiles — stores helptip open/acked state per user
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS ui_prefs jsonb NOT NULL DEFAULT '{}';
