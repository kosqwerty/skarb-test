-- ================================================================
-- LMS Migration v10 — Блокування користувача з анулюванням сесії
-- Виконати в Supabase SQL Editor
-- ================================================================

-- Функція: заблокувати / розблокувати користувача
-- Встановлює banned_until в auth.users та видаляє активні сесії
CREATE OR REPLACE FUNCTION public.admin_set_user_banned(
    p_user_id UUID,
    p_banned  BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- Перевірка прав: лише owner або admin
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Access denied: owner or admin required';
    END IF;

    IF p_banned THEN
        -- Забороняємо вхід: JWT буде відхилений при наступному запиті
        UPDATE auth.users
        SET banned_until = 'infinity'::timestamptz
        WHERE id = p_user_id;

        -- Видаляємо всі активні сесії та refresh-токени — миттєве виходження
        DELETE FROM auth.sessions       WHERE user_id = p_user_id;
        DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id;
    ELSE
        -- Знімаємо блокування
        UPDATE auth.users
        SET banned_until = NULL
        WHERE id = p_user_id;
    END IF;
END;
$$;

-- Права виконання лише для авторизованих користувачів
REVOKE ALL ON FUNCTION public.admin_set_user_banned(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_banned(UUID, BOOLEAN) TO authenticated;

-- ================================================================
-- Увімкнути Realtime для таблиці profiles
-- Потрібно щоб клієнт миттєво отримував подію блокування
-- ================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
