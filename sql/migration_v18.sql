-- ================================================================
-- LMS Migration v18 — Збереження пароля в кошику + відновлення
-- Виконати в Supabase SQL Editor
-- ================================================================

-- ── Оновлюємо тригер: додаємо encrypted_password до snapshot ────
CREATE OR REPLACE FUNCTION public.trg_profile_to_trash()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_caller      UUID;
    v_enc_pw      TEXT;
BEGIN
    v_caller := auth.uid();
    IF v_caller IS NOT NULL AND v_caller <> OLD.id THEN
        v_enc_pw := (SELECT u.encrypted_password FROM auth.users u WHERE u.id = OLD.id);
        INSERT INTO public.trash (type, item_id, item_data, deleted_by)
        VALUES (
            'user',
            OLD.id,
            row_to_json(OLD)::jsonb || jsonb_build_object('encrypted_password', v_enc_pw),
            v_caller
        );
    END IF;
    RETURN OLD;
END;
$$;

-- ── Оновлюємо trash_restore: використовуємо збережений пароль ───
CREATE OR REPLACE FUNCTION public.trash_restore(p_trash_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions
AS $func$
DECLARE
    v_type     TEXT;
    v_data     JSONB;
    v_user_id  UUID;
BEGIN
    IF public.get_current_role() <> 'owner' THEN
        RAISE EXCEPTION 'Access denied: owner only';
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
$func$;

REVOKE ALL ON FUNCTION public.trash_restore(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trash_restore(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trash_restore(UUID) TO anon;

NOTIFY pgrst, 'reload schema';
