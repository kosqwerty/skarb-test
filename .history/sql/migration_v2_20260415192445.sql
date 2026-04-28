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
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date  DATE;

-- ── Довідник: Міста ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cities (
    id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Довідник: Посади ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_positions (
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
ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subdivisions ENABLE ROW LEVEL SECURITY;

-- Читання — всі (включно з не авторизованими для форми реєстрації)
CREATE POLICY "cities_select"       ON public.cities       FOR SELECT USING (true);
CREATE POLICY "job_positions_select" ON public.job_positions FOR SELECT USING (true);
CREATE POLICY "subdivisions_select" ON public.subdivisions FOR SELECT USING (true);

-- Редагування — тільки адміністратор
CREATE POLICY "cities_manage"       ON public.cities       FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "job_positions_manage" ON public.job_positions FOR ALL TO authenticated USING (public.is_admin());
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

-- ── Початкові дані довідників (за потреби розкоментуйте) ───────
-- INSERT INTO public.cities (name) VALUES ('Київ'),('Харків'),('Одеса'),('Дніпро'),('Львів') ON CONFLICT DO NOTHING;
-- INSERT INTO public.job_positions (name) VALUES ('Менеджер'),('Спеціаліст'),('Керівник відділу') ON CONFLICT DO NOTHING;
-- INSERT INTO public.subdivisions (name) VALUES ('Відділ продажів'),('Відділ IT'),('HR') ON CONFLICT DO NOTHING;
