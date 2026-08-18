-- v199: видалені коментарі новин мають лишатись видимими на бекенді (як
-- "Коментар видалено"), щоб відповіді під ними не губились — приховування
-- реального контенту тепер суто на стороні клієнта (js/pages/news.js), не
-- через RLS. Це заодно прибирає потребу в спеціальному винятку для
-- автора/адміна з v198.

BEGIN;

DROP POLICY IF EXISTS "news_comments_select" ON public.news_comments;
CREATE POLICY "news_comments_select" ON public.news_comments
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (true);

COMMIT;
