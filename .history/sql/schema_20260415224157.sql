-- ================================================================
-- LMS Platform — Full Database Schema
-- Compatible with Supabase PostgreSQL
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- PROFILES (extends Supabase auth.users)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    full_name   TEXT NOT NULL DEFAULT '',
    role        TEXT NOT NULL DEFAULT 'student'
                    CHECK (role IN ('admin', 'teacher', 'student')),
    avatar_url  TEXT,
    bio         TEXT,
    telegram_id TEXT,
    is_active   BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- COURSES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.courses (
    id             UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title          TEXT NOT NULL,
    description    TEXT,
    thumbnail_url  TEXT,
    teacher_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category       TEXT DEFAULT 'general',
    level          TEXT DEFAULT 'beginner'
                       CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    duration_hours INTEGER DEFAULT 0,
    is_published   BOOLEAN DEFAULT false,
    is_featured    BOOLEAN DEFAULT false,
    slug           TEXT UNIQUE,
    tags           TEXT[],
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- ENROLLMENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.enrollments (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id             UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    course_id           UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    enrolled_at         TIMESTAMPTZ DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    progress_percentage INTEGER DEFAULT 0,
    UNIQUE(user_id, course_id)
);

-- ================================================================
-- LESSONS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.lessons (
    id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    course_id        UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    title            TEXT NOT NULL,
    description      TEXT,
    content          TEXT,
    order_index      INTEGER DEFAULT 0,
    duration_minutes INTEGER DEFAULT 0,
    is_published     BOOLEAN DEFAULT false,
    is_free_preview  BOOLEAN DEFAULT false,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- RESOURCES (PDF, video, link, SCORM, file)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.resources (
    id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    lesson_id        UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    course_id        UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    title            TEXT NOT NULL,
    description      TEXT,
    type             TEXT NOT NULL CHECK (type IN ('pdf', 'video', 'link', 'scorm', 'file')),
    file_url         TEXT,
    url              TEXT,
    storage_path     TEXT,
    file_type        TEXT,
    category         TEXT DEFAULT 'general',
    download_allowed BOOLEAN DEFAULT true,
    file_size        BIGINT,
    duration_seconds INTEGER,
    order_index      INTEGER DEFAULT 0,
    metadata         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- SCORM PACKAGES
-- ================================================================
CREATE TABLE IF NOT EXISTS public.scorm_packages (
    id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    resource_id   UUID REFERENCES public.resources(id) ON DELETE CASCADE UNIQUE,
    manifest_path TEXT NOT NULL DEFAULT 'imsmanifest.xml',
    entry_point   TEXT NOT NULL,
    scorm_version TEXT DEFAULT '2004',
    title         TEXT,
    description   TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- SCORM PROGRESS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.scorm_progress (
    id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id              UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    scorm_package_id     UUID REFERENCES public.scorm_packages(id) ON DELETE CASCADE NOT NULL,
    completion_status    TEXT DEFAULT 'not attempted'
                             CHECK (completion_status IN ('not attempted','incomplete','completed','unknown')),
    success_status       TEXT DEFAULT 'unknown'
                             CHECK (success_status IN ('passed','failed','unknown')),
    progress_measure     DECIMAL(5,4) DEFAULT 0
                             CHECK (progress_measure >= 0 AND progress_measure <= 1),
    score_raw            DECIMAL(10,2),
    score_min            DECIMAL(10,2) DEFAULT 0,
    score_max            DECIMAL(10,2) DEFAULT 100,
    score_scaled         DECIMAL(5,4),
    total_time_seconds   INTEGER DEFAULT 0,
    session_time_seconds INTEGER DEFAULT 0,
    suspend_data         TEXT,
    location             TEXT,
    interactions         JSONB DEFAULT '[]',
    objectives           JSONB DEFAULT '[]',
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, scorm_package_id)
);

-- ================================================================
-- TESTS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.tests (
    id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    course_id            UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    lesson_id            UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
    title                TEXT NOT NULL,
    description          TEXT,
    instructions         TEXT,
    max_attempts         INTEGER DEFAULT 3,
    time_limit_minutes   INTEGER,
    passing_score        INTEGER DEFAULT 70,
    randomize_questions  BOOLEAN DEFAULT false,
    show_results         BOOLEAN DEFAULT true,
    order_index          INTEGER DEFAULT 0,
    is_published         BOOLEAN DEFAULT false,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- QUESTIONS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.questions (
    id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    test_id       UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'single'
                      CHECK (question_type IN ('single','multiple','true_false')),
    explanation   TEXT,
    points        INTEGER DEFAULT 1,
    order_index   INTEGER DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- ANSWERS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.answers (
    id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    answer_text TEXT NOT NULL,
    is_correct  BOOLEAN DEFAULT false,
    order_index INTEGER DEFAULT 0
);

-- ================================================================
-- TEST ATTEMPTS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.test_attempts (
    id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id           UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    test_id           UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
    attempt_number    INTEGER DEFAULT 1,
    score             DECIMAL(10,2) DEFAULT 0,
    max_score         DECIMAL(10,2) DEFAULT 0,
    percentage        DECIMAL(5,2) DEFAULT 0,
    passed            BOOLEAN DEFAULT false,
    started_at        TIMESTAMPTZ DEFAULT NOW(),
    completed_at      TIMESTAMPTZ,
    time_spent_seconds INTEGER DEFAULT 0
);

-- ================================================================
-- ATTEMPT ANSWERS (per question answer detail)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.attempt_answers (
    id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    attempt_id          UUID REFERENCES public.test_attempts(id) ON DELETE CASCADE NOT NULL,
    question_id         UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    selected_answer_ids UUID[] DEFAULT '{}',
    is_correct          BOOLEAN DEFAULT false,
    points_earned       INTEGER DEFAULT 0
);

-- ================================================================
-- LESSON PROGRESS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.lesson_progress (
    id                UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id           UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    lesson_id         UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
    completed         BOOLEAN DEFAULT false,
    time_spent_seconds INTEGER DEFAULT 0,
    last_accessed_at  TIMESTAMPTZ DEFAULT NOW(),
    completed_at      TIMESTAMPTZ,
    UNIQUE(user_id, lesson_id)
);

-- ================================================================
-- NEWS
-- ================================================================
CREATE TABLE IF NOT EXISTS public.news (
    id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title         TEXT NOT NULL,
    slug          TEXT UNIQUE,
    content       TEXT NOT NULL,
    excerpt       TEXT,
    thumbnail_url TEXT,
    author_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category      TEXT DEFAULT 'general',
    tags          TEXT[],
    views         INTEGER DEFAULT 0,
    is_published  BOOLEAN DEFAULT false,
    is_featured   BOOLEAN DEFAULT false,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role            ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_courses_teacher          ON public.courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_published        ON public.courses(is_published);
CREATE INDEX IF NOT EXISTS idx_enrollments_user         ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course       ON public.enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course           ON public.lessons(course_id, order_index);
CREATE INDEX IF NOT EXISTS idx_resources_lesson         ON public.resources(lesson_id);
CREATE INDEX IF NOT EXISTS idx_resources_course         ON public.resources(course_id);
CREATE INDEX IF NOT EXISTS idx_resources_category       ON public.resources(category);
CREATE INDEX IF NOT EXISTS idx_scorm_progress_user      ON public.scorm_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_scorm_progress_package   ON public.scorm_progress(scorm_package_id);
CREATE INDEX IF NOT EXISTS idx_tests_course             ON public.tests(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_test           ON public.questions(test_id, order_index);
CREATE INDEX IF NOT EXISTS idx_answers_question         ON public.answers(question_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_user       ON public.test_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_test       ON public.test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user     ON public.lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_news_published           ON public.news(is_published, published_at DESC);

-- ================================================================
-- HELPER FUNCTIONS
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_user_role(uid UUID DEFAULT auth.uid())
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT role FROM public.profiles WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION public.is_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = uid AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_or_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = uid AND role IN ('admin','teacher'));
$$;

-- Recalculate course progress for a user
CREATE OR REPLACE FUNCTION public.update_course_progress(p_user_id UUID, p_course_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_total     INTEGER;
    v_completed INTEGER;
    v_pct       INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM public.lessons WHERE course_id = p_course_id AND is_published = true;

    IF v_total = 0 THEN RETURN; END IF;

    SELECT COUNT(*) INTO v_completed
    FROM public.lesson_progress lp
    JOIN public.lessons l ON l.id = lp.lesson_id
    WHERE lp.user_id = p_user_id AND l.course_id = p_course_id AND lp.completed = true;

    v_pct := (v_completed * 100) / v_total;

    UPDATE public.enrollments
    SET progress_percentage = v_pct,
        completed_at = CASE WHEN v_pct = 100 THEN NOW() ELSE NULL END
    WHERE user_id = p_user_id AND course_id = p_course_id;
END;
$$;

-- ================================================================
-- TRIGGERS
-- ================================================================

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_courses_upd  BEFORE UPDATE ON public.courses  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_lessons_upd  BEFORE UPDATE ON public.lessons  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_resources_upd BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tests_upd    BEFORE UPDATE ON public.tests    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_news_upd     BEFORE UPDATE ON public.news     FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorm_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorm_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news          ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select"     ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_admin"      ON public.profiles FOR ALL    TO authenticated USING (public.is_admin());

-- COURSES
CREATE POLICY "courses_select" ON public.courses FOR SELECT USING (
    is_published = true OR teacher_id = auth.uid() OR public.is_teacher_or_admin()
);
CREATE POLICY "courses_insert" ON public.courses FOR INSERT TO authenticated WITH CHECK (public.is_teacher_or_admin());
CREATE POLICY "courses_update" ON public.courses FOR UPDATE TO authenticated USING (teacher_id = auth.uid() OR public.is_admin());
CREATE POLICY "courses_delete" ON public.courses FOR DELETE TO authenticated USING (teacher_id = auth.uid() OR public.is_admin());

-- ENROLLMENTS
CREATE POLICY "enroll_select" ON public.enrollments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_teacher_or_admin());
CREATE POLICY "enroll_insert" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "enroll_update" ON public.enrollments FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "enroll_delete" ON public.enrollments FOR DELETE TO authenticated USING (public.is_admin());

-- LESSONS
CREATE POLICY "lessons_select" ON public.lessons FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.enrollments WHERE user_id = auth.uid() AND course_id = lessons.course_id)
    OR public.is_teacher_or_admin()
);
CREATE POLICY "lessons_manage" ON public.lessons FOR ALL TO authenticated USING (public.is_teacher_or_admin());

-- RESOURCES
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
CREATE POLICY "resources_manage" ON public.resources FOR ALL TO authenticated USING (public.is_teacher_or_admin());

-- SCORM PACKAGES
CREATE POLICY "scorm_pkg_select" ON public.scorm_packages FOR SELECT TO authenticated USING (
    EXISTS(
        SELECT 1 FROM public.resources r
        JOIN public.lessons l ON l.id = r.lesson_id
        JOIN public.enrollments e ON e.course_id = l.course_id
        WHERE r.id = scorm_packages.resource_id AND e.user_id = auth.uid()
    ) OR public.is_teacher_or_admin()
);
CREATE POLICY "scorm_pkg_manage" ON public.scorm_packages FOR ALL TO authenticated USING (public.is_teacher_or_admin());

-- SCORM PROGRESS
CREATE POLICY "scorm_prog_select" ON public.scorm_progress FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_teacher_or_admin());
CREATE POLICY "scorm_prog_insert" ON public.scorm_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "scorm_prog_update" ON public.scorm_progress FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- TESTS
CREATE POLICY "tests_select" ON public.tests FOR SELECT TO authenticated USING (
    (is_published = true AND EXISTS(SELECT 1 FROM public.enrollments WHERE user_id = auth.uid() AND course_id = tests.course_id))
    OR public.is_teacher_or_admin()
);
CREATE POLICY "tests_manage" ON public.tests FOR ALL TO authenticated USING (public.is_teacher_or_admin());

-- QUESTIONS
CREATE POLICY "questions_select" ON public.questions FOR SELECT TO authenticated USING (
    EXISTS(
        SELECT 1 FROM public.tests t JOIN public.enrollments e ON e.course_id = t.course_id
        WHERE t.id = questions.test_id AND e.user_id = auth.uid()
    ) OR public.is_teacher_or_admin()
);
CREATE POLICY "questions_manage" ON public.questions FOR ALL TO authenticated USING (public.is_teacher_or_admin());

-- ANSWERS
CREATE POLICY "answers_select" ON public.answers FOR SELECT TO authenticated USING (
    EXISTS(
        SELECT 1 FROM public.questions q JOIN public.tests t ON t.id = q.test_id
        JOIN public.enrollments e ON e.course_id = t.course_id
        WHERE q.id = answers.question_id AND e.user_id = auth.uid()
    ) OR public.is_teacher_or_admin()
);
CREATE POLICY "answers_manage" ON public.answers FOR ALL TO authenticated USING (public.is_teacher_or_admin());

-- TEST ATTEMPTS
CREATE POLICY "attempts_select" ON public.test_attempts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_teacher_or_admin());
CREATE POLICY "attempts_insert" ON public.test_attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "attempts_update" ON public.test_attempts FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ATTEMPT ANSWERS
CREATE POLICY "att_ans_select" ON public.attempt_answers FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.test_attempts ta WHERE ta.id = attempt_answers.attempt_id AND (ta.user_id = auth.uid() OR public.is_teacher_or_admin()))
);
CREATE POLICY "att_ans_insert" ON public.attempt_answers FOR INSERT TO authenticated WITH CHECK (
    EXISTS(SELECT 1 FROM public.test_attempts ta WHERE ta.id = attempt_answers.attempt_id AND ta.user_id = auth.uid())
);

-- LESSON PROGRESS
CREATE POLICY "lp_select" ON public.lesson_progress FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_teacher_or_admin());
CREATE POLICY "lp_insert" ON public.lesson_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "lp_update" ON public.lesson_progress FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- NEWS
CREATE POLICY "news_select" ON public.news FOR SELECT USING (is_published = true OR public.is_teacher_or_admin());
CREATE POLICY "news_manage" ON public.news FOR ALL TO authenticated USING (public.is_teacher_or_admin());

-- ================================================================
-- STORAGE BUCKETS (run in Supabase Dashboard → Storage)
-- ================================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('course-thumbnails','course-thumbnails',true)  ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-resources', 'lesson-resources', false) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('scorm-packages',   'scorm-packages',   false) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('news-images',      'news-images',      true)  ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars',          'avatars',          true)  ON CONFLICT DO NOTHING;
