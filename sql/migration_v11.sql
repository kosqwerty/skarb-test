-- ================================================================
-- LMS Migration v11 — Функція отримання користувачів з last_sign_in_at
-- Виконати в Supabase SQL Editor
-- ================================================================

-- Повертає profiles + last_sign_in_at з auth.users
-- Доступно лише для owner/admin (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
    id              UUID,
    full_name       TEXT,
    last_name       TEXT,
    first_name      TEXT,
    patronymic      TEXT,
    email           TEXT,
    login           TEXT,
    role            TEXT,
    is_active       BOOLEAN,
    avatar_url      TEXT,
    phone           TEXT,
    gender          TEXT,
    birth_date      DATE,
    city            TEXT,
    job_position    TEXT,
    subdivision     TEXT,
    label           TEXT,
    bio             TEXT,
    manager_id      UUID,
    created_at      TIMESTAMPTZ,
    last_sign_in_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        p.id, p.full_name, p.last_name, p.first_name, p.patronymic,
        p.email, p.login, p.role, p.is_active, p.avatar_url,
        p.phone, p.gender, p.birth_date, p.city,
        p.job_position, p.subdivision, p.label, p.bio, p.manager_id,
        p.created_at,
        u.last_sign_in_at
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_get_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_users() TO authenticated;
