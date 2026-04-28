-- ================================================================
-- LMS Migration v8 — Регістронезалежний вхід по логіну
-- Виконати в Supabase SQL Editor
-- ================================================================

-- Оновлюємо функцію: порівнюємо логін без урахування регістру
CREATE OR REPLACE FUNCTION public.get_email_by_login(p_login TEXT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT email FROM public.profiles WHERE LOWER(login) = LOWER(p_login) LIMIT 1;
$$;

-- Унікальний індекс по LOWER(login) — гарантує що "Admin" і "admin" не можуть існувати одночасно
DROP INDEX IF EXISTS public.profiles_login_lower_idx;
CREATE UNIQUE INDEX profiles_login_lower_idx ON public.profiles (LOWER(login));
