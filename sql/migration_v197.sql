-- v197: перевипускаємо всі політики news_comments — на випадок, якщо
-- INSERT-політика з v190 з якоїсь причини відсутня/пошкоджена в БД
-- ("new row violates row-level security policy for table news_comments").
-- Idempotent: безпечно виконувати повторно.

BEGIN;

DROP POLICY IF EXISTS "news_comments_select" ON public.news_comments;
CREATE POLICY "news_comments_select" ON public.news_comments
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "news_comments_insert" ON public.news_comments;
CREATE POLICY "news_comments_insert" ON public.news_comments
    AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "news_comments_update" ON public.news_comments;
CREATE POLICY "news_comments_update" ON public.news_comments
    AS PERMISSIVE FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "news_comments_delete" ON public.news_comments;
CREATE POLICY "news_comments_delete" ON public.news_comments
    AS PERMISSIVE FOR DELETE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

COMMIT;
