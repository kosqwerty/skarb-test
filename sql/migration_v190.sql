-- v190: коментарі до новин.

BEGIN;

CREATE TABLE IF NOT EXISTS public.news_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    news_id uuid NOT NULL REFERENCES public.news(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_comments_news_id ON public.news_comments(news_id);

ALTER TABLE public.news_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "news_comments_select" ON public.news_comments
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "news_comments_insert" ON public.news_comments
    AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Видалити може автор коментаря або адмін (модерація).
CREATE POLICY "news_comments_delete" ON public.news_comments
    AS PERMISSIVE FOR DELETE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

COMMIT;
