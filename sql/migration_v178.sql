-- v178: news.network_visibility — адмін керує показом новини залежно від
-- довіреності мережі читача (AppState.isTrustedNetwork), окремо від групи
-- доступу (access_group_id) — це інший вимір: не "хто", а "звідки".

BEGIN;

ALTER TABLE public.news
    ADD COLUMN IF NOT EXISTS network_visibility text NOT NULL DEFAULT 'all';

ALTER TABLE public.news
    DROP CONSTRAINT IF EXISTS news_network_visibility_check;
ALTER TABLE public.news
    ADD CONSTRAINT news_network_visibility_check
    CHECK (network_visibility IN ('all', 'trusted', 'untrusted'));

COMMIT;
