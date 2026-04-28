-- ================================================================
-- LMS Migration v2 — Довідники та розширений профіль
-- Виконати в Supabase SQL Editor
-- ================================================================

-- ── Нові стовпці у profiles ────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city        TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender      TEXT CHECK (gender IN ('male','female','other'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_position TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS label       TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone       TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subdivision TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date   DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS manager_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login        TEXT UNIQUE;

-- Функція: отримати email по логіну (для входу без розкриття email)
CREATE OR REPLACE FUNCTION public.get_email_by_login(p_login TEXT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT email FROM public.profiles WHERE login = p_login LIMIT 1;
$$;

-- ── Довідник: Міста ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cities (
    id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Довідник: Посади ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.positions (
    id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Довідник: Підрозділи ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subdivisions (
    id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.cities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subdivisions ENABLE ROW LEVEL SECURITY;

-- Читання — всі (включно з не авторизованими для форми реєстрації)
CREATE POLICY "cities_select"       ON public.cities       FOR SELECT USING (true);
CREATE POLICY "positions_select" ON public.positions FOR SELECT USING (true);
CREATE POLICY "subdivisions_select" ON public.subdivisions FOR SELECT USING (true);

-- Редагування — тільки адміністратор
CREATE POLICY "cities_manage"       ON public.cities       FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "positions_manage" ON public.positions FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "subdivisions_manage" ON public.subdivisions FOR ALL TO authenticated USING (public.is_admin());

-- ── Функція: сьогоднішні іменинники ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_today_birthdays()
RETURNS TABLE(id UUID, full_name TEXT, job_position TEXT, subdivision TEXT, birth_date DATE)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT id, full_name, job_position, subdivision, birth_date
    FROM public.profiles
    WHERE birth_date IS NOT NULL
      AND is_active = true
      AND EXTRACT(month FROM birth_date) = EXTRACT(month FROM CURRENT_DATE)
      AND EXTRACT(day   FROM birth_date) = EXTRACT(day   FROM CURRENT_DATE);
$$;

-- ── Нові поля для ресурсів та база знань
ALTER TABLE public.resources ALTER COLUMN lesson_id DROP NOT NULL;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS download_allowed BOOLEAN DEFAULT true;
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_resources_course ON public.resources(course_id);
CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources(category);
CREATE TRIGGER IF NOT EXISTS trg_resources_upd BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "resources_select" ON public.resources;
CREATE POLICY "resources_select" ON public.resources FOR SELECT TO authenticated USING (
    public.is_teacher_or_admin()
    OR (
        resources.lesson_id IS NULL
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

-- STORAGE OBJECTS RLS FOR LESSON RESOURCES BUCKET
-- INSERT
DROP POLICY IF EXISTS "lesson_resources_objects_insert" ON storage.objects;

CREATE POLICY "lesson_resources_objects_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lesson-resources'
);

-- SELECT
DROP POLICY IF EXISTS "lesson_resources_objects_select" ON storage.objects;

CREATE POLICY "lesson_resources_objects_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'lesson-resources'
);

-- ── Початкові дані довідників (за потреби розкоментуйте) ───────
-- INSERT INTO public.cities (name) VALUES ('Київ'),('Харків'),('Одеса'),('Дніпро'),('Львів') ON CONFLICT DO NOTHING;
-- INSERT INTO public.positions (name) VALUES ('Менеджер'),('Спеціаліст'),('Керівник відділу') ON CONFLICT DO NOTHING;
-- INSERT INTO public.subdivisions (name) VALUES ('Відділ продажів'),('Відділ IT'),('HR') ON CONFLICT DO NOTHING;
