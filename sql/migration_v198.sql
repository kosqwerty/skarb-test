-- v198: фікс "new row violates row-level security policy" при видаленні
-- власного коментаря новини.
--
-- Причина: news_comments_select політика ("deleted_at IS NULL") приховує
-- видалені коментарі від усіх. Postgres під час UPDATE звіряє результуючий
-- рядок із SELECT-політикою (навіть без явного RETURNING) — щойно
-- deleted_at проставляється, рядок перестає бути "видимим" для автора
-- запиту, і сам UPDATE відхиляється як порушення RLS.
--
-- Фікс: автор і адмін і далі бачать (для цілей RLS) свій щойно видалений
-- рядок — але в самому списку коментарів (js/api.js getByNewsId) видалені
-- однаково відфільтровуються явним .is('deleted_at', null) на клієнті,
-- тож для інших користувачів у UI нічого не змінюється.

BEGIN;

DROP POLICY IF EXISTS "news_comments_select" ON public.news_comments;
CREATE POLICY "news_comments_select" ON public.news_comments
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (deleted_at IS NULL OR auth.uid() = user_id OR public.is_admin());

COMMIT;
