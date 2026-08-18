-- v196: відповіді на коментарі новин (один рівень треду — відповідь завжди
-- прив'язується до кореневого коментаря, а не до іншої відповіді).

BEGIN;

ALTER TABLE public.news_comments
    ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.news_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_news_comments_parent_id ON public.news_comments(parent_id);

COMMIT;
