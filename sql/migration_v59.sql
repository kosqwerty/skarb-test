-- v59: course runs (потоки)

CREATE TABLE IF NOT EXISTS public.course_runs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT '',
    start_date  DATE,
    end_date    DATE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.enrollments
    ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.course_runs(id) ON DELETE SET NULL;

ALTER TABLE public.test_attempts
    ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.course_runs(id) ON DELETE SET NULL;

-- Drop old unique constraint and recreate with run_id
ALTER TABLE public.enrollments
    DROP CONSTRAINT IF EXISTS enrollments_user_id_course_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS enrollments_user_course_run_key
    ON public.enrollments (user_id, course_id, COALESCE(run_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- RLS
ALTER TABLE public.course_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "runs_select" ON public.course_runs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "runs_insert" ON public.course_runs
    FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "runs_update" ON public.course_runs
    FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "runs_delete" ON public.course_runs
    FOR DELETE TO authenticated USING (public.is_admin());
