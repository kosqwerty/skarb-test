-- v189: статистика проходження SCORM-курсів + ручна зміна статусу адміном
-- (на випадок, коли сам пакет технічно не репортує completion_status —
-- погане авторське налаштування критерію завершення в iSpring/Articulate).
--
-- scorm_prog_update RLS дозволяє UPDATE лише user_id = auth.uid() — адмін не
-- може напряму змінити чужий рядок прогресу, тому дії йдуть через SECURITY
-- DEFINER RPC, які самі перевіряють права (is_admin()).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_scorm_progress_stats(p_resource_id uuid)
RETURNS TABLE(
    user_id uuid,
    full_name text,
    job_position text,
    city text,
    subdivision text,
    scorm_package_id uuid,
    completion_status text,
    success_status text,
    score_raw numeric,
    progress_measure numeric,
    total_time_seconds integer,
    updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT
        p.id, p.full_name, p.job_position, p.city, p.subdivision,
        sp.scorm_package_id, sp.completion_status, sp.success_status,
        sp.score_raw, sp.progress_measure, sp.total_time_seconds, sp.updated_at
    FROM public.scorm_progress sp
    JOIN public.scorm_packages pkg ON pkg.id = sp.scorm_package_id
    JOIN public.profiles p ON p.id = sp.user_id
    WHERE pkg.resource_id = p_resource_id
      AND public.is_admin()
    ORDER BY sp.updated_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_scorm_progress_stats(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_scorm_status(
    p_user_id uuid,
    p_scorm_package_id uuid,
    p_completion_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only admins can change SCORM completion status';
    END IF;
    IF p_completion_status NOT IN ('completed', 'incomplete', 'not attempted') THEN
        RAISE EXCEPTION 'Invalid completion_status: %', p_completion_status;
    END IF;

    INSERT INTO public.scorm_progress (user_id, scorm_package_id, completion_status)
    VALUES (p_user_id, p_scorm_package_id, p_completion_status)
    ON CONFLICT (user_id, scorm_package_id)
    DO UPDATE SET completion_status = EXCLUDED.completion_status, updated_at = now();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_set_scorm_status(uuid, uuid, text) TO authenticated;

COMMIT;
