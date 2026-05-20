-- migration_v70: profiles — додати dismissed_news (масив відхилених новин)

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS dismissed_news UUID[] DEFAULT '{}';
