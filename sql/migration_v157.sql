-- v157: temporary role switching for superadmin (test navigation/access as
-- another role, without a fake client-side simulation and without logging
-- into a separate account).
--
-- Core idea: add profiles.base_role (the durable, real identity) while the
-- existing profiles.role column keeps meaning exactly what it already means
-- everywhere in this app ("current effective role"). Switching just
-- temporarily changes `role` on your own row; base_role always remembers who
-- you really are. Because of this, ~90 existing RLS policies and every
-- existing helper function (is_admin(), is_staff(), is_manager(),
-- is_superadmin(), get_current_role(), get_user_role(), etc.) need ZERO
-- changes — they all already read `role`, which now simply means "the role
-- currently in effect for this session" instead of "permanent role".
--
-- This migration also closes three privilege-escalation gaps found while
-- designing this feature (all pre-existing, made more important by the
-- introduction of base_role — see comments at each fix below):
--   1) the "profiles: update own or admin" RLS policy had no WITH CHECK,
--      so any admin could raw-update their own role to 'superadmin'.
--   2) admin_user_create allowed p_role = 'superadmin' with no restriction.
--   3) admin_user_delete / admin_set_user_banned protected "the superadmin"
--      by checking `role` (which will now be temporarily switchable) instead
--      of true identity.
--
-- Run this in the Supabase SQL Editor as ONE transaction.

BEGIN;

-- ============================================================
-- 1) New columns
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS base_role text;
UPDATE public.profiles SET base_role = role WHERE base_role IS NULL;
ALTER TABLE public.profiles ALTER COLUMN base_role SET NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_base_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_base_role_check
    CHECK ((base_role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'manager'::text, 'user'::text, 'intern'::text, 'student'::text, 'ceo'::text])));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role_switched_at timestamptz;

-- ============================================================
-- 2) Close gap #1 — harden the profiles UPDATE policy so only an already-
--    real superadmin can ever write role/base_role = 'superadmin' to any
--    row (self or someone else's). Everyone else keeps exactly the same
--    access they had before (own row, or any row if is_admin()) — this only
--    narrows the one specific value.
-- ============================================================
DROP POLICY IF EXISTS "profiles: update own or admin" ON public.profiles;
CREATE POLICY "profiles: update own or admin" ON public.profiles
    FOR UPDATE TO authenticated
    USING (((id = auth.uid()) OR is_admin()))
    WITH CHECK (
        ((id = auth.uid()) OR is_admin())
        AND (role IS DISTINCT FROM 'superadmin' OR is_superadmin())
        AND (base_role IS DISTINCT FROM 'superadmin' OR is_superadmin())
    );

-- ============================================================
-- 3) Close gap #2 — admin_user_create can no longer mint a superadmin
--    account, and now sets base_role alongside role at creation time.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_user_create(p_email text, p_password text, p_full_name text DEFAULT NULL::text, p_role text DEFAULT 'user'::text, p_last_name text DEFAULT NULL::text, p_first_name text DEFAULT NULL::text, p_patronymic text DEFAULT NULL::text, p_login text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_gender text DEFAULT NULL::text, p_birth_date text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_job_position text DEFAULT NULL::text, p_subdivision text DEFAULT NULL::text, p_label text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_caller_role TEXT;
    v_user_id     UUID := gen_random_uuid();
BEGIN
    -- Перевірка прав
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('superadmin', 'admin') THEN
        RAISE EXCEPTION 'Access denied: superadmin or admin required';
    END IF;

    -- Не можна створити superadmin через цю функцію — тільки через передачу прав
    IF p_role = 'superadmin' THEN
        RAISE EXCEPTION 'Cannot create a superadmin account via this function — use ownership transfer instead';
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
        jsonb_build_object('full_name', p_full_name, 'role', p_role),
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
    UPDATE public.profiles SET
        full_name    = COALESCE(NULLIF(TRIM(p_full_name), ''), p_email),
        last_name    = p_last_name,
        first_name   = p_first_name,
        patronymic   = p_patronymic,
        role         = p_role,
        base_role    = p_role,
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
$function$
;

-- ============================================================
-- 4) Close gap #3a — admin_user_delete protects "the superadmin" by real
--    identity (base_role), not current (possibly switched) role.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_user_delete(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_caller_role      TEXT;
    v_target_role      TEXT;
    v_target_base_role TEXT;
BEGIN
    -- Перевірка прав (уникаємо SELECT role INTO — role зарезервоване слово)
    v_caller_role := (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid());
    IF v_caller_role NOT IN ('superadmin','admin') THEN
        RAISE EXCEPTION 'Access denied: superadmin or admin required';
    END IF;

    -- Не можна видалити себе
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot delete your own account';
    END IF;

    -- Не можна видалити superadmin (справжня ідентичність, а не поточна
    -- перемкнута роль)
    SELECT p.role, p.base_role INTO v_target_role, v_target_base_role
    FROM public.profiles p WHERE p.id = p_user_id;
    IF v_target_base_role = 'superadmin' THEN
        RAISE EXCEPTION 'Cannot delete the superadmin account';
    END IF;

    -- Адмін не може видаляти інших адмінів — тільки superadmin може
    IF v_target_role = 'admin' AND v_caller_role <> 'superadmin' THEN
        RAISE EXCEPTION 'Only superadmin can delete admin accounts';
    END IF;

    -- Видаляємо з auth.users (CASCADE видалить profiles через FK)
    DELETE FROM auth.users WHERE id = p_user_id;
END;
$function$
;

-- ============================================================
-- 5) Close gap #3b — admin_set_user_banned protects "the superadmin" by
--    real identity too, so a switched-away superadmin can't be banned by
--    another admin.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_set_user_banned(p_user_id uuid, p_banned boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_role              TEXT;
    v_target_base_role  TEXT;
BEGIN
    -- Перевірка прав: лише superadmin або admin
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_role NOT IN ('superadmin', 'admin') THEN
        RAISE EXCEPTION 'Access denied: superadmin or admin required';
    END IF;

    -- Захист справжнього superadmin від бану іншим admin'ом
    SELECT base_role INTO v_target_base_role FROM public.profiles WHERE id = p_user_id;
    IF v_target_base_role = 'superadmin' AND v_role <> 'superadmin' THEN
        RAISE EXCEPTION 'Only superadmin can ban the superadmin account';
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
$function$
;

-- ============================================================
-- 6) Retarget the single-superadmin trigger from `role` to `base_role` —
--    the "only one real superadmin" invariant is about true identity, not
--    the ephemeral active role, so switching away from/back to superadmin
--    during testing never spuriously fires this anymore.
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_single_superadmin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NEW.base_role = 'superadmin' AND OLD.base_role <> 'superadmin' THEN
        -- Знімаємо superadmin (і активну роль, і справжню ідентичність) з
        -- попереднього власника
        UPDATE public.profiles
        SET base_role = 'admin', role = 'admin'
        WHERE base_role = 'superadmin' AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$function$
;

DROP TRIGGER IF EXISTS trg_single_owner ON public.profiles;
CREATE TRIGGER trg_single_owner BEFORE UPDATE OF base_role ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION enforce_single_superadmin();

-- ============================================================
-- 7) New RPC: permanent role reassignment for another user (replaces raw
--    API.profiles.updateRole() from admin.js's changeRole() / profile.js's
--    role select) — always keeps role and base_role in sync, blocks
--    granting superadmin through this generic path, and audit-logs itself
--    server-side (tamper-resistant, not reliant on client JS).
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_user_id uuid, p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_caller_role TEXT;
    v_actor_name  TEXT;
BEGIN
    SELECT role, full_name INTO v_caller_role, v_actor_name FROM public.profiles WHERE id = auth.uid();
    IF v_caller_role NOT IN ('superadmin', 'admin') THEN
        RAISE EXCEPTION 'Access denied: superadmin or admin required';
    END IF;
    IF p_role = 'superadmin' THEN
        RAISE EXCEPTION 'Use ownership transfer to grant superadmin';
    END IF;

    UPDATE public.profiles SET role = p_role, base_role = p_role WHERE id = p_user_id;

    INSERT INTO public.activity_logs (user_id, actor_name, actor_role, action, entity_type, entity_name, meta)
    VALUES (auth.uid(), v_actor_name, v_caller_role, 'role_change', 'user', p_user_id::text, jsonb_build_object('role', p_role));
END;
$function$
;

-- ============================================================
-- 8) New RPC: ownership transfer (replaces admin.js's transferOwnership()
--    raw update). Explicitly demotes the caller as a second, independent
--    layer of enforcement alongside the retargeted trigger — cheap and
--    harmless if redundant.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_transfer_superadmin(p_to_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_caller_base_role TEXT;
    v_actor_name       TEXT;
    v_to_name          TEXT;
BEGIN
    SELECT base_role, full_name INTO v_caller_base_role, v_actor_name FROM public.profiles WHERE id = auth.uid();
    IF v_caller_base_role <> 'superadmin' THEN
        RAISE EXCEPTION 'Access denied: superadmin required';
    END IF;
    IF p_to_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot transfer to yourself';
    END IF;

    SELECT full_name INTO v_to_name FROM public.profiles WHERE id = p_to_user_id;

    UPDATE public.profiles SET role = 'superadmin', base_role = 'superadmin' WHERE id = p_to_user_id;
    -- Явна демоція себе — незалежний рівень захисту поряд з тригером enforce_single_superadmin
    UPDATE public.profiles SET role = 'admin', base_role = 'admin' WHERE id = auth.uid();

    INSERT INTO public.activity_logs (user_id, actor_name, actor_role, action, entity_type, entity_name, meta)
    VALUES (auth.uid(), v_actor_name, 'superadmin', 'ownership_transfer', 'user', COALESCE(v_to_name, p_to_user_id::text), jsonb_build_object('to_user_id', p_to_user_id));
END;
$function$
;

-- ============================================================
-- 9) New RPC: switch own active role (the actual feature). Only a real,
--    active superadmin may call this; whitelist is explicit (not reused
--    from the CHECK constraint's full list) so 'superadmin' and the
--    unused 'student' role can never be switch targets.
-- ============================================================
CREATE OR REPLACE FUNCTION public.switch_active_role(p_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_base_role  TEXT;
    v_is_active  BOOLEAN;
    v_actor_name TEXT;
BEGIN
    SELECT base_role, is_active, full_name INTO v_base_role, v_is_active, v_actor_name
    FROM public.profiles WHERE id = auth.uid();

    IF v_base_role <> 'superadmin' OR v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Access denied: only an active superadmin can switch roles';
    END IF;
    IF p_role NOT IN ('admin','smm','manager','user','intern','ceo') THEN
        RAISE EXCEPTION 'Invalid role for switching: %', p_role;
    END IF;

    UPDATE public.profiles SET role = p_role, role_switched_at = NOW() WHERE id = auth.uid();

    INSERT INTO public.activity_logs (user_id, actor_name, actor_role, action, entity_type, entity_name, meta)
    VALUES (auth.uid(), v_actor_name, v_base_role, 'role_switch', 'role', p_role, jsonb_build_object('to_role', p_role));
END;
$function$
;

-- ============================================================
-- 10) New RPC: reset own role back to base_role. No permission gate beyond
--     self-targeting is needed — it can only ever narrow a row back to its
--     own real role, never escalate.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reset_active_role()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_base_role  TEXT;
    v_prev_role  TEXT;
    v_actor_name TEXT;
BEGIN
    SELECT base_role, role, full_name INTO v_base_role, v_prev_role, v_actor_name
    FROM public.profiles WHERE id = auth.uid();

    IF v_prev_role IS DISTINCT FROM v_base_role THEN
        UPDATE public.profiles SET role = v_base_role, role_switched_at = NULL WHERE id = auth.uid();

        INSERT INTO public.activity_logs (user_id, actor_name, actor_role, action, entity_type, entity_name, meta)
        VALUES (auth.uid(), v_actor_name, v_base_role, 'role_switch_end', 'role', v_base_role, jsonb_build_object('from_role', v_prev_role));
    END IF;
END;
$function$
;

COMMIT;
