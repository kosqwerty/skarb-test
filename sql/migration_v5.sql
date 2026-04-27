-- ================================================================
-- LMS Migration v5 — Видалення ролі student + виправлення рекурсії RLS
-- Виконати в Supabase SQL Editor
-- ================================================================

-- ── Оновлення CHECK constraint (спочатку знімаємо, потім мігруємо) ─
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

-- ── Міграція даних: student → user ───────────────────────────────
UPDATE public.profiles SET role = 'user' WHERE role = 'student';

-- ── Додаємо новий constraint без 'student' ────────────────────────
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('owner','admin','smm','teacher','user'));

-- ── DEFAULT для нових користувачів ───────────────────────────────
ALTER TABLE public.profiles
    ALTER COLUMN role SET DEFAULT 'user';

-- ── SECURITY DEFINER helper: повертає роль поточного користувача ──
-- Функція обходить RLS (SECURITY DEFINER), тому не викликає рекурсії
-- коли використовується всередині RLS-policy на таблиці profiles.
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_current_role() TO authenticated;

-- ── profiles: перебудова всіх UPDATE-policy ──────────────────────
DROP POLICY IF EXISTS "profiles_update"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_manage"       ON public.profiles;
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "profiles_update" ON public.profiles
    FOR UPDATE TO authenticated
    USING  (id = auth.uid() OR public.get_current_role() IN ('owner','admin'))
    WITH CHECK (id = auth.uid() OR public.get_current_role() IN ('owner','admin'));

-- ── access_groups: замінюємо inline-EXISTS на get_current_role() ──
DROP POLICY IF EXISTS "ag_manage"    ON public.access_groups;
DROP POLICY IF EXISTS "ag_cities_mgr" ON public.access_group_cities;
DROP POLICY IF EXISTS "ag_pos_mgr"    ON public.access_group_positions;
DROP POLICY IF EXISTS "ag_dept_mgr"   ON public.access_group_departments;
DROP POLICY IF EXISTS "ag_lbl_mgr"    ON public.access_group_labels;

CREATE POLICY "ag_manage" ON public.access_groups FOR ALL TO authenticated
    USING  (public.get_current_role() IN ('admin','owner'))
    WITH CHECK (public.get_current_role() IN ('admin','owner'));

CREATE POLICY "ag_cities_mgr" ON public.access_group_cities FOR ALL TO authenticated
    USING  (public.get_current_role() IN ('admin','owner'))
    WITH CHECK (public.get_current_role() IN ('admin','owner'));

CREATE POLICY "ag_pos_mgr" ON public.access_group_positions FOR ALL TO authenticated
    USING  (public.get_current_role() IN ('admin','owner'))
    WITH CHECK (public.get_current_role() IN ('admin','owner'));

CREATE POLICY "ag_dept_mgr" ON public.access_group_departments FOR ALL TO authenticated
    USING  (public.get_current_role() IN ('admin','owner'))
    WITH CHECK (public.get_current_role() IN ('admin','owner'));

CREATE POLICY "ag_lbl_mgr" ON public.access_group_labels FOR ALL TO authenticated
    USING  (public.get_current_role() IN ('admin','owner'))
    WITH CHECK (public.get_current_role() IN ('admin','owner'));

-- ── resources: замінюємо inline-EXISTS на get_current_role() ─────
DROP POLICY IF EXISTS "resources_select" ON public.resources;
DROP POLICY IF EXISTS "resources_write"  ON public.resources;
DROP POLICY IF EXISTS "resources_manage" ON public.resources;
DROP POLICY IF EXISTS "resources_insert" ON public.resources;
DROP POLICY IF EXISTS "resources_update" ON public.resources;
DROP POLICY IF EXISTS "resources_delete" ON public.resources;
DROP POLICY IF EXISTS "resources_staff"  ON public.resources;

CREATE POLICY "resources_select" ON public.resources FOR SELECT TO authenticated USING (
    public.get_current_role() IN ('owner','admin','smm','teacher')
    OR (
        resources.lesson_id IS NULL
        AND (
            resources.access_group_id IS NULL
            OR public.user_has_group_access(resources.access_group_id)
        )
        AND (
            resources.course_id IS NULL
            OR EXISTS(
                SELECT 1 FROM public.enrollments e
                WHERE e.user_id = auth.uid() AND e.course_id = resources.course_id
            )
        )
    )
    OR EXISTS(
        SELECT 1 FROM public.lessons l
        JOIN public.enrollments e ON e.course_id = l.course_id
        WHERE l.id = resources.lesson_id AND e.user_id = auth.uid()
    )
);

CREATE POLICY "resources_write" ON public.resources FOR ALL TO authenticated
    USING  (public.get_current_role() IN ('owner','admin','smm','teacher'))
    WITH CHECK (public.get_current_role() IN ('owner','admin','smm','teacher'));

-- ── Довідники: cities / positions / subdivisions ──────────────────
DROP POLICY IF EXISTS "cities_manage"       ON public.cities;
DROP POLICY IF EXISTS "positions_manage"    ON public.positions;
DROP POLICY IF EXISTS "subdivisions_manage" ON public.subdivisions;

CREATE POLICY "cities_manage" ON public.cities FOR ALL TO authenticated
    USING  (public.get_current_role() IN ('admin','owner'))
    WITH CHECK (public.get_current_role() IN ('admin','owner'));

CREATE POLICY "positions_manage" ON public.positions FOR ALL TO authenticated
    USING  (public.get_current_role() IN ('admin','owner'))
    WITH CHECK (public.get_current_role() IN ('admin','owner'));

CREATE POLICY "subdivisions_manage" ON public.subdivisions FOR ALL TO authenticated
    USING  (public.get_current_role() IN ('admin','owner'))
    WITH CHECK (public.get_current_role() IN ('admin','owner'));

-- ── user_has_group_access: теж перебудовуємо без рекурсії ─────────
-- (функція вже SECURITY DEFINER — рекурсії немає, але profiles-JOIN
--  через alias може триматись — замінюємо на пряме посилання)
CREATE OR REPLACE FUNCTION public.user_has_group_access(p_group_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.access_groups ag ON ag.id = p_group_id
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND (
            ag.is_public = true
            OR (
              (NOT EXISTS(SELECT 1 FROM public.access_group_cities      WHERE group_id = ag.id)
               OR p.city         IN (SELECT city       FROM public.access_group_cities      WHERE group_id = ag.id))
              AND
              (NOT EXISTS(SELECT 1 FROM public.access_group_positions   WHERE group_id = ag.id)
               OR p.job_position IN (SELECT position   FROM public.access_group_positions   WHERE group_id = ag.id))
              AND
              (NOT EXISTS(SELECT 1 FROM public.access_group_departments WHERE group_id = ag.id)
               OR p.subdivision  IN (SELECT department FROM public.access_group_departments WHERE group_id = ag.id))
              AND
              (NOT EXISTS(SELECT 1 FROM public.access_group_labels      WHERE group_id = ag.id)
               OR p.label        IN (SELECT label      FROM public.access_group_labels      WHERE group_id = ag.id))
            )
          )
    );
$$;
