-- v201: остаточне ("назавжди") видалення коментаря новини — лише для
-- superadmin. Перевіряємо саме profiles.role = 'superadmin' напряму
-- (не public.is_admin() — та перевіряє застарілий список ролей
-- ('owner','admin'), який не включає 'superadmin' у поточній схемі).
--
-- Видалення кореневого коментаря автоматично прибирає й усі його відповіді
-- (news_comments.parent_id має ON DELETE CASCADE, див. migration_v196).

BEGIN;

CREATE OR REPLACE FUNCTION public.hard_delete_news_comment(p_comment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin'
    ) THEN
        RAISE EXCEPTION 'Лише суперадмін може видаляти коментарі назавжди';
    END IF;

    DELETE FROM public.news_comments WHERE id = p_comment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.hard_delete_news_comment(uuid) TO authenticated;

COMMIT;
