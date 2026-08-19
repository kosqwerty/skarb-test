-- v202: mark_enrollment_complete — SECURITY DEFINER RPC, що на сервері (не
-- довіряючи клієнту) перевіряє: чи ВСІ елементи courses.course_info.
-- content_items ("Зміст курсу" — SCORM + тести з migration відсутньою,
-- фіча додана в коді без SQL-міграції) завершені для auth.uid(), і якщо так
-- — проставляє enrollments.completed_at.
--
-- Потрібно тому, що RLS-політика "enrollments: update admin"
-- (USING (is_admin())) дозволяє UPDATE enrollments лише адмінам — звичайний
-- користувач не може оновити навіть власний запис напряму. Старий шлях
-- завершення курсу (update_course_progress()) працював лише тому, що це
-- теж SECURITY DEFINER RPC, яка обходить RLS — але вона рахує прогрес
-- виключно по застарілих lessons/lesson_progress, яких новий "Зміст курсу"
-- (SCORM+тести) не використовує (v_total=0 → функція одразу виходить,
-- completed_at ніколи не встановлюється).

BEGIN;

CREATE OR REPLACE FUNCTION public.mark_enrollment_complete(p_course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_items         jsonb;
    v_item          jsonb;
    v_type          text;
    v_id            uuid;
    v_done          boolean;
    v_all_done      boolean := true;
    v_enrollment_id uuid;
BEGIN
    SELECT course_info->'content_items' INTO v_items FROM public.courses WHERE id = p_course_id;
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RETURN false;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
        v_type := v_item->>'type';
        v_id   := NULLIF(v_item->>'id', '')::uuid;
        v_done := false;

        IF v_type = 'test' THEN
            SELECT EXISTS (
                SELECT 1 FROM public.test_attempts
                WHERE user_id = auth.uid() AND test_id = v_id AND completed_at IS NOT NULL
            ) INTO v_done;
        ELSIF v_type = 'scorm' THEN
            SELECT EXISTS (
                SELECT 1 FROM public.scorm_progress sp
                JOIN public.scorm_packages pkg ON pkg.id = sp.scorm_package_id
                WHERE sp.user_id = auth.uid() AND pkg.resource_id = v_id AND sp.completion_status = 'completed'
            ) INTO v_done;
        END IF;

        IF NOT v_done THEN
            v_all_done := false;
            EXIT;
        END IF;
    END LOOP;

    IF NOT v_all_done THEN
        RETURN false;
    END IF;

    SELECT id INTO v_enrollment_id FROM public.enrollments
    WHERE user_id = auth.uid() AND course_id = p_course_id;

    IF v_enrollment_id IS NULL THEN
        RETURN false;
    END IF;

    UPDATE public.enrollments
    SET completed_at = COALESCE(completed_at, now()),
        progress_percentage = 100
    WHERE id = v_enrollment_id;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_enrollment_complete(uuid) TO authenticated;

COMMIT;
