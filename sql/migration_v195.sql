-- v195: редагування коментарів до новин + м'яке видалення (фіксуємо дату).
--
-- Раніше видалення коментаря було жорстким DELETE — жодного сліду, коли й
-- ким видалено. Тепер видалення — це UPDATE(deleted_at, deleted_by), рядок
-- лишається в БД для аудиту, просто перестає повертатись у вибірці.
-- Редагування (content, updated_at) дозволене лише автору; видалення —
-- автору або адміну (як і раніше).

BEGIN;

ALTER TABLE public.news_comments
    ADD COLUMN IF NOT EXISTS updated_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "news_comments_select" ON public.news_comments;
CREATE POLICY "news_comments_select" ON public.news_comments
    AS PERMISSIVE FOR SELECT TO authenticated
    USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "news_comments_update" ON public.news_comments;
CREATE POLICY "news_comments_update" ON public.news_comments
    AS PERMISSIVE FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

COMMIT;
