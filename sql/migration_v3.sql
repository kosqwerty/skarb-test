-- ================================================================
-- LMS Migration v3 — Ролі Owner та SMM
-- Виконати в Supabase SQL Editor
-- ================================================================

-- ── Оновити CHECK-обмеження ролей ─────────────────────────────
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('owner','admin','smm','teacher','student','user'));

-- ── Функції перевірки ролей ────────────────────────────────────

-- is_owner: тільки власник
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'owner' AND is_active = true
    );
$$;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

-- is_admin: адміністратор АБО власник
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin','owner') AND is_active = true
    );
$$;

-- is_teacher_or_admin: всі staff-ролі (owner, admin, smm, teacher)
CREATE OR REPLACE FUNCTION public.is_teacher_or_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('owner','admin','smm','teacher') AND is_active = true
    );
$$;

-- ── Захист Owner від зміни ролі та видалення ──────────────────
-- Тільки owner може змінити роль іншого owner
-- Через RLS: дозволяємо UPDATE role тільки якщо рядок не є owner (або якщо змінює сам owner)
-- Примітка: захист через бізнес-логіку JS + RLS нижче

-- ── Єдиний власник: trigger-захист ───────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_single_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF NEW.role = 'owner' AND OLD.role <> 'owner' THEN
        -- Знімаємо owner з попереднього власника
        UPDATE public.profiles
        SET role = 'admin'
        WHERE role = 'owner' AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_single_owner ON public.profiles;
CREATE TRIGGER trg_single_owner
    BEFORE UPDATE OF role ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.enforce_single_owner();

-- ── Якщо в системі ще немає owner — призначте першого адміна ──
-- UPDATE public.profiles SET role = 'owner' WHERE role = 'admin' ORDER BY created_at LIMIT 1;

-- ── Роль 'user' (рівень доступу як у стажера) ─────────────────
-- Якщо migration_v3 вже виконана без 'user' — запустіть окремо:
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
--     CHECK (role IN ('owner','admin','smm','teacher','student','user'));
