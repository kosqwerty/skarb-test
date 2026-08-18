-- v200: каскадне м'яке видалення відповідей разом з кореневим коментарем
-- новини — "Всі відповіді видаленого коментаря теж мають бути позначені
-- як видалені". RLS дозволяє UPDATE лише власних коментарів (або адміну),
-- тож звичайний користувач не міг би сам позначити чужі відповіді як
-- видалені напряму — робимо це через SECURITY DEFINER функцію з власною
-- перевіркою прав саме на кореневий коментар.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_news_comment_cascade(p_comment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_owner uuid;
    v_now timestamptz := now();
BEGIN
    SELECT user_id INTO v_owner FROM public.news_comments WHERE id = p_comment_id;

    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'Коментар не знайдено';
    END IF;

    IF NOT (auth.uid() = v_owner OR public.is_admin()) THEN
        RAISE EXCEPTION 'Немає прав на видалення цього коментаря';
    END IF;

    UPDATE public.news_comments
    SET deleted_at = v_now, deleted_by = auth.uid()
    WHERE id = p_comment_id AND deleted_at IS NULL;

    -- Каскад стосується лише прямих відповідей (у news_comments один
    -- рівень треду — відповідь на відповідь неможлива).
    UPDATE public.news_comments
    SET deleted_at = v_now, deleted_by = auth.uid()
    WHERE parent_id = p_comment_id AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_news_comment_cascade(uuid) TO authenticated;

COMMIT;
