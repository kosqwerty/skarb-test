-- ================================================================
-- LMS Migration v16 — Видалення користувачів адміном + trash для users
-- Виконати в Supabase SQL Editor
-- ================================================================

-- ── Розширюємо тип trash на 'user' ──────────────────────────────
ALTER TABLE public.trash DROP CONSTRAINT IF EXISTS trash_type_check;
ALTER TABLE public.trash ADD CONSTRAINT trash_type_check
    CHECK (type IN ('page','news','resource','user'));

-- ── Тригер: профіль → кошик перед видаленням ────────────────────
CREATE OR REPLACE FUNCTION public.trg_profile_to_trash()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_caller UUID;
BEGIN
    v_caller := auth.uid();
    IF v_caller IS NOT NULL AND v_caller <> OLD.id THEN
        INSERT INTO public.trash (type, item_id, item_data, deleted_by)
        VALUES ('user', OLD.id, row_to_json(OLD)::jsonb, v_caller);
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_to_trash ON public.profiles;
CREATE TRIGGER trg_profile_to_trash
    BEFORE DELETE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.trg_profile_to_trash();

-- ── Функція видалення користувача адміном ───────────────────────
CREATE OR REPLACE FUNCTION public.admin_user_delete(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_caller_role TEXT;
    v_target_role TEXT;
BEGIN
    -- Перевірка прав (уникаємо SELECT role INTO — role зарезервоване слово)
    v_caller_role := (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid());
    IF v_caller_role NOT IN ('owner','admin') THEN
        RAISE EXCEPTION 'Access denied: owner or admin required';
    END IF;

    -- Не можна видалити себе
    IF p_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot delete your own account';
    END IF;

    -- Не можна видалити owner
    v_target_role := (SELECT p.role FROM public.profiles p WHERE p.id = p_user_id);
    IF v_target_role = 'owner' THEN
        RAISE EXCEPTION 'Cannot delete the owner account';
    END IF;

    -- Адмін не може видаляти інших адмінів — тільки owner може
    IF v_target_role = 'admin' AND v_caller_role <> 'owner' THEN
        RAISE EXCEPTION 'Only owner can delete admin accounts';
    END IF;

    -- Видаляємо з auth.users (CASCADE видалить profiles через FK)
    DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_delete(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_delete(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_delete(UUID) TO anon;

-- Оновити schema cache PostgREST
NOTIFY pgrst, 'reload schema';
