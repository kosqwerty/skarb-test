-- v185: облік відвідувань сторінок Collections (custom_pages) — адмін може
-- увімкнути/вимкнути трекінг для конкретної сторінки й подивитись, хто,
-- скільки разів і коли востаннє її відкривав.
--
-- Перегляди пишуться у вже наявний activity_log (action='page_view',
-- entity_id=custom_pages.id) з CollectionsPage.initView, лише коли
-- track_visits=true. RLS activity_log дозволяє читати тільки власні рядки,
-- тож агрегація йде через SECURITY DEFINER RPC (лише admin/superadmin —
-- на відміну від ресурсів тут немає розрізнення по підлеглих).

BEGIN;

ALTER TABLE public.custom_pages
    ADD COLUMN IF NOT EXISTS track_visits boolean DEFAULT false NOT NULL;

CREATE OR REPLACE FUNCTION public.get_page_view_stats(p_page_id uuid)
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
    WHERE al.entity_id = p_page_id
      AND al.action = 'page_view'
      AND public.is_admin()
    GROUP BY p.id, p.full_name, p.job_position, p.city, p.subdivision
    ORDER BY MAX(al.created_at) DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_page_view_stats(uuid) TO authenticated;

COMMIT;
