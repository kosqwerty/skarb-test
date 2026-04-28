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
-- Supabase за замовчуванням забороняє виклик функцій анонімним користувачам
GRANT EXECUTE ON FUNCTION public.get_email_by_login(TEXT) TO anon;

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

-- ── Resources: автор та дата ───────────────────────────────────
ALTER TABLE public.resources
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resources_created_by ON public.resources(created_by);

-- ── Сторінки (Custom Pages) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_pages (
    id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title        TEXT NOT NULL,
    html_content TEXT NOT NULL DEFAULT '',
    css_content  TEXT NOT NULL DEFAULT '',
    is_published BOOLEAN NOT NULL DEFAULT false,
    created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_pages_created_by ON public.custom_pages(created_by);

CREATE TRIGGER trg_custom_pages_upd
    BEFORE UPDATE ON public.custom_pages
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.custom_pages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.custom_pages
    ADD COLUMN IF NOT EXISTS allowed_labels TEXT[] NOT NULL DEFAULT '{}';

CREATE POLICY "pages_select" ON public.custom_pages FOR SELECT TO authenticated
    USING (
        public.is_teacher_or_admin()
        OR (
            is_published = true
            AND (
                array_length(allowed_labels, 1) IS NULL
                OR EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid()
                      AND label = ANY(allowed_labels)
                )
            )
        )
    );
CREATE POLICY "pages_manage" ON public.custom_pages FOR ALL TO authenticated
    USING (public.is_teacher_or_admin());

-- ── Page Attachments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.page_attachments (
    id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    page_id      UUID NOT NULL REFERENCES public.custom_pages(id) ON DELETE CASCADE,
    file_name    TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_type    TEXT,
    file_size    BIGINT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.page_attachments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_page_att_page ON public.page_attachments(page_id);

-- Читання — всі авторизовані
CREATE POLICY "page_att_select" ON public.page_attachments
    FOR SELECT TO authenticated USING (true);

-- Управління — тільки staff
CREATE POLICY "page_att_manage" ON public.page_attachments
    FOR ALL TO authenticated USING (public.is_teacher_or_admin());

-- ── Storage bucket: page-files ─────────────────────────────────
-- Виконайте в Supabase Dashboard → Storage:
--   1. Створіть bucket "page-files" (Private)
--   2. Або розкоментуйте нижче (потребує service role):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('page-files', 'page-files', false) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "page_files_insert" ON storage.objects;
CREATE POLICY "page_files_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'page-files' AND public.is_teacher_or_admin());

DROP POLICY IF EXISTS "page_files_select" ON storage.objects;
CREATE POLICY "page_files_select" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'page-files');

DROP POLICY IF EXISTS "page_files_delete" ON storage.objects;
CREATE POLICY "page_files_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'page-files' AND public.is_teacher_or_admin());
