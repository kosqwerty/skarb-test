-- ================================================================
-- LMS Migration v4 — Групи доступу до ресурсів
-- Виконати в Supabase SQL Editor
-- ================================================================

-- ── Таблиця груп доступу ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.access_groups (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    is_public   BOOLEAN NOT NULL DEFAULT false,
    created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.access_groups ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_access_groups_created_by ON public.access_groups(created_by);

CREATE TRIGGER trg_access_groups_upd
    BEFORE UPDATE ON public.access_groups
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Junction-таблиці (умови доступу) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.access_group_cities (
    group_id UUID NOT NULL REFERENCES public.access_groups(id) ON DELETE CASCADE,
    city     TEXT NOT NULL,
    PRIMARY KEY (group_id, city)
);

CREATE TABLE IF NOT EXISTS public.access_group_positions (
    group_id UUID NOT NULL REFERENCES public.access_groups(id) ON DELETE CASCADE,
    position TEXT NOT NULL,
    PRIMARY KEY (group_id, position)
);

CREATE TABLE IF NOT EXISTS public.access_group_departments (
    group_id   UUID NOT NULL REFERENCES public.access_groups(id) ON DELETE CASCADE,
    department TEXT NOT NULL,
    PRIMARY KEY (group_id, department)
);

CREATE TABLE IF NOT EXISTS public.access_group_labels (
    group_id UUID NOT NULL REFERENCES public.access_groups(id) ON DELETE CASCADE,
    label    TEXT NOT NULL,
    PRIMARY KEY (group_id, label)
);

ALTER TABLE public.access_group_cities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_group_positions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_group_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_group_labels      ENABLE ROW LEVEL SECURITY;

-- ── RLS: читання — всі авторизовані; управління — тільки admin/owner ──
-- Використовуємо inline-перевірку щоб уникнути неоднозначності is_admin()
CREATE POLICY "ag_select"   ON public.access_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "ag_manage"   ON public.access_groups FOR ALL    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner') AND is_active = true));

CREATE POLICY "ag_cities_sel" ON public.access_group_cities      FOR SELECT TO authenticated USING (true);
CREATE POLICY "ag_cities_mgr" ON public.access_group_cities      FOR ALL    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner') AND is_active = true));
CREATE POLICY "ag_pos_sel"    ON public.access_group_positions   FOR SELECT TO authenticated USING (true);
CREATE POLICY "ag_pos_mgr"    ON public.access_group_positions   FOR ALL    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner') AND is_active = true));
CREATE POLICY "ag_dept_sel"   ON public.access_group_departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "ag_dept_mgr"   ON public.access_group_departments FOR ALL    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner') AND is_active = true));
CREATE POLICY "ag_lbl_sel"    ON public.access_group_labels      FOR SELECT TO authenticated USING (true);
CREATE POLICY "ag_lbl_mgr"    ON public.access_group_labels      FOR ALL    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner') AND is_active = true));

-- ── Поле access_group_id у ресурсах ──────────────────────────
ALTER TABLE public.resources
    ADD COLUMN IF NOT EXISTS access_group_id UUID REFERENCES public.access_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resources_access_group ON public.resources(access_group_id);

-- ── Серверна перевірка доступу користувача до групи ──────────
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
              -- Місто: якщо немає обмежень — дозволено; якщо є — p.city мусить збігатись
              (NOT EXISTS(SELECT 1 FROM public.access_group_cities      WHERE group_id = ag.id)
               OR p.city          IN (SELECT city       FROM public.access_group_cities      WHERE group_id = ag.id))
              AND
              -- Посада
              (NOT EXISTS(SELECT 1 FROM public.access_group_positions   WHERE group_id = ag.id)
               OR p.job_position  IN (SELECT position   FROM public.access_group_positions   WHERE group_id = ag.id))
              AND
              -- Підрозділ
              (NOT EXISTS(SELECT 1 FROM public.access_group_departments WHERE group_id = ag.id)
               OR p.subdivision   IN (SELECT department FROM public.access_group_departments WHERE group_id = ag.id))
              AND
              -- Мітка (OR серед обраних)
              (NOT EXISTS(SELECT 1 FROM public.access_group_labels      WHERE group_id = ag.id)
               OR p.label         IN (SELECT label      FROM public.access_group_labels      WHERE group_id = ag.id))
            )
          )
    );
$$;
GRANT EXECUTE ON FUNCTION public.user_has_group_access(UUID) TO authenticated;

-- ── Оновити RLS ресурсів (враховує групи доступу) ────────────
DROP POLICY IF EXISTS "resources_select" ON public.resources;
CREATE POLICY "resources_select" ON public.resources FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin','smm','teacher') AND is_active = true)
    OR (
        -- Ресурси без прив'язки до уроку
        resources.lesson_id IS NULL
        AND (
            -- Немає групи доступу → публічний
            resources.access_group_id IS NULL
            OR
            -- Є група доступу → перевіряємо
            public.user_has_group_access(resources.access_group_id)
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

-- ── Виправити RLS довідників (cities/positions/subdivisions) ──
-- Замінюємо виклик is_admin() на inline-перевірку (уникаємо неоднозначності)
DROP POLICY IF EXISTS "cities_manage"       ON public.cities;
DROP POLICY IF EXISTS "positions_manage"    ON public.positions;
DROP POLICY IF EXISTS "subdivisions_manage" ON public.subdivisions;

CREATE POLICY "cities_manage" ON public.cities FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin','owner') AND is_active = true
    ));

CREATE POLICY "positions_manage" ON public.positions FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin','owner') AND is_active = true
    ));

CREATE POLICY "subdivisions_manage" ON public.subdivisions FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin','owner') AND is_active = true
    ));

-- ── Виправити RLS profiles (UPDATE) ─────────────────────────
-- is_admin() неоднозначна → замінюємо inline-перевіркою
DROP POLICY IF EXISTS "profiles_update"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_manage"       ON public.profiles;
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Одна policy: власний профіль АБО адмін/owner
-- (два окремих WITH CHECK ANDуються → хибний результат для адміна що редагує чужий профіль)
CREATE POLICY "profiles_update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles p2
            WHERE p2.id = auth.uid()
              AND p2.role IN ('owner','admin')
              AND p2.is_active = true
        )
    )
    WITH CHECK (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles p2
            WHERE p2.id = auth.uid()
              AND p2.role IN ('owner','admin')
              AND p2.is_active = true
        )
    );

-- ── Виправити RLS ресурсів (INSERT / UPDATE / DELETE) ─────────
-- Замінюємо is_teacher_or_admin() на inline-перевірку
DROP POLICY IF EXISTS "resources_manage"  ON public.resources;
DROP POLICY IF EXISTS "resources_insert"  ON public.resources;
DROP POLICY IF EXISTS "resources_update"  ON public.resources;
DROP POLICY IF EXISTS "resources_delete"  ON public.resources;
DROP POLICY IF EXISTS "resources_staff"   ON public.resources;

CREATE POLICY "resources_write" ON public.resources
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('owner','admin','smm','teacher')
              AND is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('owner','admin','smm','teacher')
              AND is_active = true
        )
    );
