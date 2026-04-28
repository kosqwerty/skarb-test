-- ================================================================
-- LMS Migration v12 — Серверне створення користувача (без signUp)
-- Виконати в Supabase SQL Editor
-- ================================================================

-- Вмикаємо pgcrypto (зазвичай вже є в Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_user_create(
    p_email        TEXT,
    p_password     TEXT,
    p_role         TEXT    DEFAULT 'user',
    p_last_name    TEXT    DEFAULT NULL,
    p_first_name   TEXT    DEFAULT NULL,
    p_patronymic   TEXT    DEFAULT NULL,
    p_login        TEXT    DEFAULT NULL,
    p_phone        TEXT    DEFAULT NULL,
    p_gender       TEXT    DEFAULT NULL,
    p_birth_date   TEXT    DEFAULT NULL,  -- 'YYYY-MM-DD' або NULL
    p_city         TEXT    DEFAULT NULL,
    p_job_position TEXT    DEFAULT NULL,
    p_subdivision  TEXT    DEFAULT NULL,
    p_label        TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_caller_role TEXT;
    v_user_id     UUID := gen_random_uuid();
BEGIN
    -- Перевірка прав
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Access denied: owner or admin required';
    END IF;

    -- Перевірка унікальності email
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = LOWER(TRIM(p_email))) THEN
        RAISE EXCEPTION 'Email % вже зайнятий', p_email;
    END IF;

    -- Перевірка унікальності логіну
    IF p_login IS NOT NULL AND TRIM(p_login) != '' AND EXISTS (
        SELECT 1 FROM public.profiles WHERE LOWER(login) = LOWER(TRIM(p_login))
    ) THEN
        RAISE EXCEPTION 'Логін % вже зайнятий', p_login;
    END IF;

    -- Створюємо запис в auth.users
    INSERT INTO auth.users (
        id, instance_id,
        aud, role,
        email, encrypted_password,
        email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin,
        created_at, updated_at,
        confirmation_token, recovery_token,
        email_change_token_new, email_change
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        LOWER(TRIM(p_email)),
        crypt(p_password, gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('role', p_role),
        FALSE,
        NOW(), NOW(),
        '', '', '', ''
    );

    -- Прив'язуємо identity (потрібно для входу email/password)
    INSERT INTO auth.identities (
        id, user_id, provider_id,
        identity_data, provider,
        last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        LOWER(TRIM(p_email)),
        jsonb_build_object('sub', v_user_id::text, 'email', LOWER(TRIM(p_email))),
        'email',
        NOW(), NOW(), NOW()
    );

    -- Оновлюємо профіль (тригер on_auth_user_created вже створив рядок)
    -- full_name НЕ оновлюємо — тригер sync_full_name (migration_v13) обчислює його автоматично
    UPDATE public.profiles SET
        last_name    = p_last_name,
        first_name   = p_first_name,
        patronymic   = p_patronymic,
        role         = p_role,
        login        = p_login,
        phone        = p_phone,
        gender       = p_gender,
        birth_date   = CASE WHEN p_birth_date IS NOT NULL AND p_birth_date != ''
                            THEN p_birth_date::DATE ELSE NULL END,
        city         = p_city,
        job_position = p_job_position,
        subdivision  = p_subdivision,
        label        = p_label
    WHERE id = v_user_id;

    RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_create(
    TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_create(
    TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT
) TO authenticated;
-- anon потрібен для того, щоб PostgREST міг виявити функцію у своєму schema cache
GRANT EXECUTE ON FUNCTION public.admin_user_create(
    TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT
) TO anon;

-- Оновити schema cache PostgREST
NOTIFY pgrst, 'reload schema';
