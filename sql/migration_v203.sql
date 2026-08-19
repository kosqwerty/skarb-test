-- v203: mark_enrollment_complete — додає staff-байпас, симетричний до
-- байпасу блокувань у CourseViewPage._loadContent (там staff бачить усі
-- пункти "Зміст курсу" розблокованими незалежно від фактичного проходження
-- попередніх). Без цього staff/admin, що перевіряє курс і відкриває лише
-- останній пункт напряму (як і дозволяє UI-байпас), ніколи не отримає
-- медаль, бо RPC вимагала завершення ВСІХ пунктів послідовності.
--
-- Ролі "staff" тут — той самий список, що й у AppState.isStaff() (js/config.js):
-- superadmin, admin, smm, ceo.

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
    v_is_staff      boolean;
BEGIN
    SELECT role IN ('superadmin','admin','smm','ceo') INTO v_is_staff
    FROM public.profiles WHERE id = auth.uid();

    SELECT course_info->'content_items' INTO v_items FROM public.courses WHERE id = p_course_id;
    IF v_items IS NULL OR jsonb_array_length(v_items) = 0 THEN
        RETURN false;
    END IF;

    IF NOT COALESCE(v_is_staff, false) THEN
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
    END IF;

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
