-- v155: rename role 'owner' -> 'superadmin' across DB (data, CHECK constraint,
-- helper functions, and every RLS policy that referenced the literal 'owner').
-- Generated from sql/schema.sql (post-v152 snapshot) — run this in the Supabase
-- SQL Editor as ONE transaction. It also patches the pending v153 policy on
-- app_section_visibility (guarded — no-op if that table doesn't exist yet).

BEGIN;

-- 1) Drop the old constraint so existing 'owner' rows don't violate anything
--    while we migrate them (a CHECK that omits 'owner' would reject those rows
--    immediately if added before the data is updated).
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2) Migrate existing data (old trg_single_owner trigger doesn't fire on this,
--    since it only reacts to NEW.role = 'owner', not the departing side)
UPDATE profiles SET role = 'superadmin' WHERE role = 'owner';

-- 3) Now that no row has role = 'owner', add the new constraint
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK ((role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text, 'user'::text, 'intern'::text, 'student'::text, 'ceo'::text])));

-- 4) Helper / business-logic functions that hardcoded 'owner'
CREATE OR REPLACE FUNCTION public.admin_create_user(p_email text, p_password text, p_full_name text DEFAULT ''::text, p_role text DEFAULT 'user'::text, p_last_name text DEFAULT NULL::text, p_first_name text DEFAULT NULL::text, p_patronymic text DEFAULT NULL::text, p_login text DEFAULT NULL::text, p_phone text DEFAULT NULL::text, p_gender text DEFAULT NULL::text, p_birth_date text DEFAULT NULL::text, p_city text DEFAULT NULL::text, p_job_position text DEFAULT NULL::text, p_subdivision text DEFAULT NULL::text, p_label text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

    -- Перевірка унікальності email
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = LOWER(TRIM(p_email))) THEN
        RAISE EXCEPTION 'Email % вже зайнятий', p_email;
    END IF;

    -- Перевірка унікальності логіну
    IF p_login IS NOT NULL AND EXISTS (
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
        full_name    = p_full_name,
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
$function$
;

CREATE OR REPLACE FUNCTION public.admin_set_user_banned(p_user_id uuid, p_banned boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_role TEXT;
BEGIN
    -- Перевірка прав: лише superadmin або admin
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_role NOT IN ('superadmin', 'admin') THEN
        RAISE EXCEPTION 'Access denied: superadmin or admin required';
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

CREATE OR REPLACE FUNCTION public.admin_user_delete(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_caller_role TEXT;
    v_target_role TEXT;
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

    -- Не можна видалити superadmin
    v_target_role := (SELECT p.role FROM public.profiles p WHERE p.id = p_user_id);
    IF v_target_role = 'superadmin' THEN
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

CREATE OR REPLACE FUNCTION public.enforce_single_superadmin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF NEW.role = 'superadmin' AND OLD.role <> 'superadmin' THEN
        -- Знімаємо superadmin з попереднього власника
        UPDATE public.profiles
        SET role = 'admin'
        WHERE role = 'superadmin' AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_trash_items()
 RETURNS TABLE(id uuid, type text, item_id uuid, item_data jsonb, deleted_by uuid, deleted_by_name text, deleted_at timestamp with time zone, expires_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT
        t.id,
        t.type,
        t.item_id,
        t.item_data,
        t.deleted_by,
        COALESCE(p.full_name, p.email, 'Невідомо') AS deleted_by_name,
        t.deleted_at,
        t.expires_at
    FROM public.trash t
    LEFT JOIN public.profiles p ON p.id = t.deleted_by
    WHERE t.expires_at > NOW()
      AND public.get_current_role() = 'superadmin'
    ORDER BY t.deleted_at DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('superadmin','admin')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('superadmin','admin','manager')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_superadmin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'superadmin' AND is_active = true
    );
$function$
;

CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('superadmin','admin','smm','teacher')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_teacher_or_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('superadmin','admin','smm','teacher') AND is_active = true
    );
$function$
;

CREATE OR REPLACE FUNCTION public.trash_restore(p_trash_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
DECLARE
    v_type     TEXT;
    v_data     JSONB;
    v_user_id  UUID;
BEGIN
    IF public.get_current_role() <> 'superadmin' THEN
        RAISE EXCEPTION 'Access denied: superadmin only';
    END IF;

    v_type := (SELECT t.type      FROM public.trash t WHERE t.id = p_trash_id);
    v_data := (SELECT t.item_data FROM public.trash t WHERE t.id = p_trash_id);

    IF v_type IS NULL THEN
        RAISE EXCEPTION 'Запис у кошику не знайдено';
    END IF;

    IF v_type = 'page' THEN
        IF EXISTS (SELECT 1 FROM public.custom_pages WHERE id = (v_data->>'id')::UUID) THEN
            RAISE EXCEPTION 'Сторінка вже існує';
        END IF;
        INSERT INTO public.custom_pages
        SELECT * FROM jsonb_populate_record(NULL::public.custom_pages,
            v_data || jsonb_build_object('created_by',
                CASE WHEN EXISTS(SELECT 1 FROM public.profiles WHERE id = (v_data->>'created_by')::UUID)
                     THEN v_data->>'created_by' ELSE auth.uid()::text END
            )
        );

    ELSIF v_type = 'news' THEN
        IF EXISTS (SELECT 1 FROM public.news WHERE id = (v_data->>'id')::UUID) THEN
            RAISE EXCEPTION 'Новина вже існує';
        END IF;
        INSERT INTO public.news
        SELECT * FROM jsonb_populate_record(NULL::public.news,
            v_data || jsonb_build_object('author_id',
                CASE WHEN EXISTS(SELECT 1 FROM public.profiles WHERE id = (v_data->>'author_id')::UUID)
                     THEN v_data->>'author_id' ELSE auth.uid()::text END
            )
        );

    ELSIF v_type = 'resource' THEN
        IF EXISTS (SELECT 1 FROM public.resources WHERE id = (v_data->>'id')::UUID) THEN
            RAISE EXCEPTION 'Ресурс вже існує';
        END IF;
        INSERT INTO public.resources
        SELECT * FROM jsonb_populate_record(NULL::public.resources,
            v_data || jsonb_build_object(
                'lesson_id',
                CASE WHEN (v_data->>'lesson_id') IS NOT NULL
                          AND EXISTS(SELECT 1 FROM public.lessons WHERE id = (v_data->>'lesson_id')::UUID)
                     THEN v_data->>'lesson_id' ELSE NULL END,
                'course_id',
                CASE WHEN (v_data->>'course_id') IS NOT NULL
                          AND EXISTS(SELECT 1 FROM public.courses WHERE id = (v_data->>'course_id')::UUID)
                     THEN v_data->>'course_id' ELSE NULL END
            )
        );

    ELSIF v_type = 'user' THEN
        v_user_id := (v_data->>'id')::UUID;

        IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
            RAISE EXCEPTION 'Користувач вже існує';
        END IF;
        IF EXISTS (SELECT 1 FROM auth.users WHERE email = LOWER(TRIM(v_data->>'email'))) THEN
            RAISE EXCEPTION 'Email % вже зайнятий', v_data->>'email';
        END IF;

        INSERT INTO auth.users (
            id, instance_id, aud, role,
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
            LOWER(TRIM(v_data->>'email')),
            v_data->>'encrypted_password',  -- оригінальний хеш пароля
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('role', v_data->>'role'),
            FALSE,
            NOW(), NOW(),
            '', '', '', ''
        );

        INSERT INTO auth.identities (
            id, user_id, provider_id, identity_data, provider,
            last_sign_in_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_user_id,
            LOWER(TRIM(v_data->>'email')),
            jsonb_build_object('sub', v_user_id::text, 'email', LOWER(TRIM(v_data->>'email'))),
            'email', NOW(), NOW(), NOW()
        );

        UPDATE public.profiles SET
            last_name    = v_data->>'last_name',
            first_name   = v_data->>'first_name',
            patronymic   = v_data->>'patronymic',
            login        = v_data->>'login',
            phone        = v_data->>'phone',
            gender       = v_data->>'gender',
            city         = v_data->>'city',
            job_position = v_data->>'job_position',
            subdivision  = v_data->>'subdivision',
            label        = v_data->>'label',
            bio          = v_data->>'bio',
            role         = v_data->>'role',
            birth_date   = CASE WHEN (v_data->>'birth_date') IS NOT NULL
                                     AND (v_data->>'birth_date') <> 'null'
                                THEN (v_data->>'birth_date')::DATE ELSE NULL END,
            is_active    = TRUE
        WHERE id = v_user_id;

        DELETE FROM public.trash WHERE id = p_trash_id;

        RETURN jsonb_build_object(
            'type',      'user',
            'full_name', COALESCE(v_data->>'full_name', v_data->>'email')
        );
    END IF;

    DELETE FROM public.trash WHERE id = p_trash_id;

    RETURN jsonb_build_object('type', v_type);
END;
$function$
;

-- 5) Point the single-superadmin-enforcement trigger at the renamed function
--    (must happen before dropping enforce_single_owner() — the trigger still
--    depends on it until this runs)
DROP TRIGGER IF EXISTS trg_single_owner ON public.profiles;
CREATE TRIGGER trg_single_owner BEFORE UPDATE OF role ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION enforce_single_superadmin();

-- 6) Old function names superseded by the rename above — drop the originals
--    (is_owner/enforce_single_owner aren't referenced elsewhere, so this is safe)
DROP FUNCTION IF EXISTS public.is_owner();
DROP FUNCTION IF EXISTS public.enforce_single_owner();

-- 7) RLS policies that referenced role = 'owner' (71 policies)
DROP POLICY IF EXISTS "ag_cities_mgr" ON public.access_group_cities;
CREATE POLICY "ag_cities_mgr" ON public.access_group_cities AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])));

DROP POLICY IF EXISTS "ag_dept_mgr" ON public.access_group_departments;
CREATE POLICY "ag_dept_mgr" ON public.access_group_departments AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])));

DROP POLICY IF EXISTS "ag_lbl_mgr" ON public.access_group_labels;
CREATE POLICY "ag_lbl_mgr" ON public.access_group_labels AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])));

DROP POLICY IF EXISTS "ag_pos_mgr" ON public.access_group_positions;
CREATE POLICY "ag_pos_mgr" ON public.access_group_positions AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])));

DROP POLICY IF EXISTS "ag_manage" ON public.access_groups;
CREATE POLICY "ag_manage" ON public.access_groups AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])));

DROP POLICY IF EXISTS "activity_log_select_owner" ON public.activity_log;
DROP POLICY IF EXISTS "activity_log_select_superadmin" ON public.activity_log;
CREATE POLICY "activity_log_select_superadmin" ON public.activity_log AS PERMISSIVE FOR SELECT TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::text)))));

DROP POLICY IF EXISTS "assistant_logs_admin" ON public.assistant_logs;
CREATE POLICY "assistant_logs_admin" ON public.assistant_logs AS PERMISSIVE FOR SELECT TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text]))))));

DROP POLICY IF EXISTS "aansw_update_staff" ON public.attempt_answers;
CREATE POLICY "aansw_update_staff" ON public.attempt_answers AS PERMISSIVE FOR UPDATE TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))));

DROP POLICY IF EXISTS "bd_tabs_delete" ON public.bd_tabs;
CREATE POLICY "bd_tabs_delete" ON public.bd_tabs AS PERMISSIVE FOR DELETE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "bd_tabs_insert" ON public.bd_tabs;
CREATE POLICY "bd_tabs_insert" ON public.bd_tabs AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "bd_tabs_update" ON public.bd_tabs;
CREATE POLICY "bd_tabs_update" ON public.bd_tabs AS PERMISSIVE FOR UPDATE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "blocks_admin" ON public.branch_doc_blocks;
CREATE POLICY "blocks_admin" ON public.branch_doc_blocks AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text]))))));

DROP POLICY IF EXISTS "cities_manage" ON public.cities;
CREATE POLICY "cities_manage" ON public.cities AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])));

DROP POLICY IF EXISTS "course_teachers_write" ON public.course_teachers;
CREATE POLICY "course_teachers_write" ON public.course_teachers AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))));

DROP POLICY IF EXISTS "pages_manage" ON public.custom_pages;
CREATE POLICY "pages_manage" ON public.custom_pages AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text])));

DROP POLICY IF EXISTS "pages_select" ON public.custom_pages;
CREATE POLICY "pages_select" ON public.custom_pages AS PERMISSIVE FOR SELECT TO authenticated
    USING (((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text])) OR ((is_published = true) AND ((array_length(allowed_labels, 1) IS NULL) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.label = ANY (custom_pages.allowed_labels)))))))));

DROP POLICY IF EXISTS "admin manage dovirenosti" ON public.dovirenosti;
CREATE POLICY "admin manage dovirenosti" ON public.dovirenosti AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "admin_all_fm" ON public.feedback_messages;
CREATE POLICY "admin_all_fm" ON public.feedback_messages AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "admin_all_feedback" ON public.feedback_reports;
CREATE POLICY "admin_all_feedback" ON public.feedback_reports AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "owner_all_disciplines" ON public.intern_disciplines;
DROP POLICY IF EXISTS "superadmin_all_disciplines" ON public.intern_disciplines;
CREATE POLICY "superadmin_all_disciplines" ON public.intern_disciplines AS PERMISSIVE FOR ALL TO public
    USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'superadmin'::text))
    WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'superadmin'::text));

DROP POLICY IF EXISTS "admin_all_job_settings" ON public.intern_job_settings;
CREATE POLICY "admin_all_job_settings" ON public.intern_job_settings AS PERMISSIVE FOR ALL TO public
    USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::text, 'admin'::text])))
    WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = ANY (ARRAY['superadmin'::text, 'admin'::text])));

DROP POLICY IF EXISTS "intern_logs: owner read" ON public.intern_logs;
DROP POLICY IF EXISTS "intern_logs: superadmin read" ON public.intern_logs;
CREATE POLICY "intern_logs: superadmin read" ON public.intern_logs AS PERMISSIVE FOR SELECT TO authenticated
    USING ((get_user_role() = ANY (ARRAY['superadmin'::text, 'admin'::text])));

DROP POLICY IF EXISTS "ist: admin write" ON public.intern_schedule_templates;
CREATE POLICY "ist: admin write" ON public.intern_schedule_templates AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_user_role() = ANY (ARRAY['superadmin'::text, 'admin'::text])))
    WITH CHECK ((get_user_role() = ANY (ARRAY['superadmin'::text, 'admin'::text])));

DROP POLICY IF EXISTS "ist: staff read" ON public.intern_schedule_templates;
CREATE POLICY "ist: staff read" ON public.intern_schedule_templates AS PERMISSIVE FOR SELECT TO authenticated
    USING ((get_user_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'teacher'::text, 'smm'::text, 'manager'::text])));

DROP POLICY IF EXISTS "owner_all_viewers" ON public.intern_viewers;
DROP POLICY IF EXISTS "superadmin_all_viewers" ON public.intern_viewers;
CREATE POLICY "superadmin_all_viewers" ON public.intern_viewers AS PERMISSIVE FOR ALL TO public
    USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'superadmin'::text))
    WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'superadmin'::text));

DROP POLICY IF EXISTS "owner_all_interns" ON public.interns;
DROP POLICY IF EXISTS "superadmin_all_interns" ON public.interns;
CREATE POLICY "superadmin_all_interns" ON public.interns AS PERMISSIVE FOR ALL TO public
    USING ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'superadmin'::text))
    WITH CHECK ((( SELECT profiles.role
   FROM profiles
  WHERE (profiles.id = auth.uid())) = 'superadmin'::text));

DROP POLICY IF EXISTS "lecenr_delete" ON public.lecture_enrollments;
CREATE POLICY "lecenr_delete" ON public.lecture_enrollments AS PERMISSIVE FOR DELETE TO public
    USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text])))))));

DROP POLICY IF EXISTS "news_manage" ON public.news;
CREATE POLICY "news_manage" ON public.news AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text])));

DROP POLICY IF EXISTS "news_select" ON public.news;
CREATE POLICY "news_select" ON public.news AS PERMISSIVE FOR SELECT TO authenticated
    USING (((is_published = true) OR (get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))));

DROP POLICY IF EXISTS "page_att_manage" ON public.page_attachments;
CREATE POLICY "page_att_manage" ON public.page_attachments AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text])));

DROP POLICY IF EXISTS "page_dovirenosti_delete" ON public.page_dovirenosti;
CREATE POLICY "page_dovirenosti_delete" ON public.page_dovirenosti AS PERMISSIVE FOR DELETE TO authenticated
    USING ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text])));

DROP POLICY IF EXISTS "page_dovirenosti_insert" ON public.page_dovirenosti;
CREATE POLICY "page_dovirenosti_insert" ON public.page_dovirenosti AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text])));

DROP POLICY IF EXISTS "positions_manage" ON public.positions;
CREATE POLICY "positions_manage" ON public.positions AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])));

DROP POLICY IF EXISTS "admin manage profile_dovirenosti" ON public.profile_dovirenosti;
CREATE POLICY "admin manage profile_dovirenosti" ON public.profile_dovirenosti AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "profiles_admin_force_logout" ON public.profiles;
CREATE POLICY "profiles_admin_force_logout" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles profiles_1
  WHERE ((profiles_1.id = auth.uid()) AND (profiles_1.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "Staff can manage red folder items" ON public.red_folder_items;
CREATE POLICY "Staff can manage red folder items" ON public.red_folder_items AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))));

DROP POLICY IF EXISTS "registry_docs_admin_delete" ON public.registry_docs;
CREATE POLICY "registry_docs_admin_delete" ON public.registry_docs AS PERMISSIVE FOR DELETE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "registry_docs_admin_insert" ON public.registry_docs;
CREATE POLICY "registry_docs_admin_insert" ON public.registry_docs AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "registry_docs_admin_update" ON public.registry_docs;
CREATE POLICY "registry_docs_admin_update" ON public.registry_docs AS PERMISSIVE FOR UPDATE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "registry_items_admin_delete" ON public.registry_items;
CREATE POLICY "registry_items_admin_delete" ON public.registry_items AS PERMISSIVE FOR DELETE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "registry_items_admin_insert" ON public.registry_items;
CREATE POLICY "registry_items_admin_insert" ON public.registry_items AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "registry_items_admin_update" ON public.registry_items;
CREATE POLICY "registry_items_admin_update" ON public.registry_items AS PERMISSIVE FOR UPDATE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "registry_section_docs_admin_delete" ON public.registry_section_docs;
CREATE POLICY "registry_section_docs_admin_delete" ON public.registry_section_docs AS PERMISSIVE FOR DELETE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text]))))));

DROP POLICY IF EXISTS "registry_section_docs_admin_insert" ON public.registry_section_docs;
CREATE POLICY "registry_section_docs_admin_insert" ON public.registry_section_docs AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text]))))));

DROP POLICY IF EXISTS "registry_sections_admin_delete" ON public.registry_sections;
CREATE POLICY "registry_sections_admin_delete" ON public.registry_sections AS PERMISSIVE FOR DELETE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text]))))));

DROP POLICY IF EXISTS "registry_sections_admin_insert" ON public.registry_sections;
CREATE POLICY "registry_sections_admin_insert" ON public.registry_sections AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text]))))));

DROP POLICY IF EXISTS "registry_sections_admin_update" ON public.registry_sections;
CREATE POLICY "registry_sections_admin_update" ON public.registry_sections AS PERMISSIVE FOR UPDATE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text]))))));

DROP POLICY IF EXISTS "resource_dovirenosti_write" ON public.resource_dovirenosti;
CREATE POLICY "resource_dovirenosti_write" ON public.resource_dovirenosti AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))));

DROP POLICY IF EXISTS "staff manage resource_dovirenosti" ON public.resource_dovirenosti;
CREATE POLICY "staff manage resource_dovirenosti" ON public.resource_dovirenosti AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'smm'::text, 'teacher'::text, 'manager'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'smm'::text, 'teacher'::text, 'manager'::text]))))));

DROP POLICY IF EXISTS "resources_select" ON public.resources;
CREATE POLICY "resources_select" ON public.resources AS PERMISSIVE FOR SELECT TO authenticated
    USING (((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text])) OR ((lesson_id IS NULL) AND ((access_group_id IS NULL) OR user_has_group_access(access_group_id)) AND ((course_id IS NULL) OR (EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.user_id = auth.uid()) AND (e.course_id = resources.course_id)))))) OR (EXISTS ( SELECT 1
   FROM (lessons l
     JOIN enrollments e ON ((e.course_id = l.course_id)))
  WHERE ((l.id = resources.lesson_id) AND (e.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "resources_write" ON public.resources;
CREATE POLICY "resources_write" ON public.resources AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text])));

DROP POLICY IF EXISTS "rf_tabs_delete" ON public.rf_tabs;
CREATE POLICY "rf_tabs_delete" ON public.rf_tabs AS PERMISSIVE FOR DELETE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "rf_tabs_insert" ON public.rf_tabs;
CREATE POLICY "rf_tabs_insert" ON public.rf_tabs AS PERMISSIVE FOR INSERT TO public
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "rf_tabs_update" ON public.rf_tabs;
CREATE POLICY "rf_tabs_update" ON public.rf_tabs AS PERMISSIVE FOR UPDATE TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "subdivisions_manage" ON public.subdivisions;
CREATE POLICY "subdivisions_manage" ON public.subdivisions AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])));

DROP POLICY IF EXISTS "survey_answers_read" ON public.survey_answers;
CREATE POLICY "survey_answers_read" ON public.survey_answers AS PERMISSIVE FOR SELECT TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM survey_responses r
  WHERE ((r.id = survey_answers.response_id) AND ((r.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text]))))))))));

DROP POLICY IF EXISTS "survey_assignments_read" ON public.survey_assignments;
CREATE POLICY "survey_assignments_read" ON public.survey_assignments AS PERMISSIVE FOR SELECT TO authenticated
    USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text])))))));

DROP POLICY IF EXISTS "survey_assignments_write" ON public.survey_assignments;
CREATE POLICY "survey_assignments_write" ON public.survey_assignments AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text]))))));

DROP POLICY IF EXISTS "survey_questions_write" ON public.survey_questions;
CREATE POLICY "survey_questions_write" ON public.survey_questions AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text]))))));

DROP POLICY IF EXISTS "survey_responses_read_own" ON public.survey_responses;
CREATE POLICY "survey_responses_read_own" ON public.survey_responses AS PERMISSIVE FOR SELECT TO authenticated
    USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text])))))));

DROP POLICY IF EXISTS "surveys_read" ON public.surveys;
CREATE POLICY "surveys_read" ON public.surveys AS PERMISSIVE FOR SELECT TO authenticated
    USING (((is_published = true) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text, 'manager'::text])))))));

DROP POLICY IF EXISTS "surveys_write" ON public.surveys;
CREATE POLICY "surveys_write" ON public.surveys AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text]))))));

DROP POLICY IF EXISTS "admin manage grants" ON public.test_attempt_grants;
CREATE POLICY "admin manage grants" ON public.test_attempt_grants AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'teacher'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'teacher'::text]))))));

DROP POLICY IF EXISTS "admin read grants" ON public.test_attempt_grants;
CREATE POLICY "admin read grants" ON public.test_attempt_grants AS PERMISSIVE FOR SELECT TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'teacher'::text, 'smm'::text, 'manager'::text]))))));

DROP POLICY IF EXISTS "tattempts_update_staff" ON public.test_attempts;
CREATE POLICY "tattempts_update_staff" ON public.test_attempts AS PERMISSIVE FOR UPDATE TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'teacher'::text]))))));

DROP POLICY IF EXISTS "trash_owner_select" ON public.trash;
DROP POLICY IF EXISTS "trash_superadmin_select" ON public.trash;
CREATE POLICY "trash_superadmin_select" ON public.trash AS PERMISSIVE FOR SELECT TO authenticated
    USING ((get_current_role() = 'superadmin'::text));

DROP POLICY IF EXISTS "trusted_ips_delete" ON public.trusted_ips;
CREATE POLICY "trusted_ips_delete" ON public.trusted_ips AS PERMISSIVE FOR DELETE TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text]))))));

DROP POLICY IF EXISTS "trusted_ips_insert" ON public.trusted_ips;
CREATE POLICY "trusted_ips_insert" ON public.trusted_ips AS PERMISSIVE FOR INSERT TO authenticated
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text]))))));

DROP POLICY IF EXISTS "admin_read_login_sessions" ON public.user_login_sessions;
CREATE POLICY "admin_read_login_sessions" ON public.user_login_sessions AS PERMISSIVE FOR SELECT TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "admin_read_nav_log" ON public.user_nav_log;
CREATE POLICY "admin_read_nav_log" ON public.user_nav_log AS PERMISSIVE FOR SELECT TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "admin_all_session" ON public.user_sessions;
CREATE POLICY "admin_all_session" ON public.user_sessions AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

-- 8) Pending v153 migration's policy also hardcoded 'admin','owner' — patch it
--    too, guarded in case v153 hasn't been run against this DB yet.
DO $do$
BEGIN
    IF to_regclass('public.app_section_visibility') IS NOT NULL THEN
        DROP POLICY IF EXISTS "admins can modify section visibility" ON public.app_section_visibility;
        CREATE POLICY "admins can modify section visibility" ON public.app_section_visibility
            FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
            ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
            );
    END IF;
END;
$do$;

COMMIT;
