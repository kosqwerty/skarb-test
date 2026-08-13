-- v184: статистика перегляду ресурсів у Базі знань (хто, скільки разів,
-- коли востаннє відкривав). Джерело даних — activity_log (action='doc_view',
-- пишеться з ResourceViewPage.init на кожен перегляд), але RLS цієї таблиці
-- дозволяє читати лише власні рядки — тож агрегація йде через SECURITY
-- DEFINER RPC, яка сама перевіряє права виклику:
--   * admin/superadmin (is_admin())      — бачать усіх, хто переглядав
--   * manager (get_current_role())       — лише підлеглих (profiles.manager_id = auth.uid())
--   * решта ролей                        — порожній результат

BEGIN;

CREATE OR REPLACE FUNCTION public.get_resource_view_stats(p_resource_id uuid)
RETURNS TABLE(
    user_id uuid,
    full_name text,
    job_position text,
    city text,
    subdivision text,
    views_count bigint,
    last_viewed_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT
        p.id,
        p.full_name,
        p.job_position,
        p.city,
        p.subdivision,
        COUNT(*) AS views_count,
        MAX(al.created_at) AS last_viewed_at
    FROM public.activity_log al
    JOIN public.profiles p ON p.id = al.user_id
    WHERE al.entity_id = p_resource_id
      AND al.action = 'doc_view'
      AND (
          public.is_admin()
          OR (public.get_current_role() = 'manager' AND p.manager_id = auth.uid())
      )
    GROUP BY p.id, p.full_name, p.job_position, p.city, p.subdivision
    ORDER BY MAX(al.created_at) DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_resource_view_stats(uuid) TO authenticated;

COMMIT;
