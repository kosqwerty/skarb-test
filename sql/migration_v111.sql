-- Migration v111: Training days per job position for interns

CREATE TABLE IF NOT EXISTS public.intern_job_settings (
    id            uuid        DEFAULT gen_random_uuid() NOT NULL,
    job_position  text        NOT NULL,
    training_days integer     NOT NULL DEFAULT 0,
    created_at    timestamptz DEFAULT now() NOT NULL,

    CONSTRAINT intern_job_settings_pkey     PRIMARY KEY (id),
    CONSTRAINT intern_job_settings_pos_uq   UNIQUE (job_position),
    CONSTRAINT intern_job_settings_days_chk CHECK (training_days >= 0)
);

ALTER TABLE public.intern_job_settings ENABLE ROW LEVEL SECURITY;

-- owner / admin: full access
DROP POLICY IF EXISTS "admin_all_job_settings" ON public.intern_job_settings;
CREATE POLICY "admin_all_job_settings" ON public.intern_job_settings
    FOR ALL
    USING  ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner','admin'))
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner','admin'));

-- everyone else: read-only
DROP POLICY IF EXISTS "select_job_settings" ON public.intern_job_settings;
CREATE POLICY "select_job_settings" ON public.intern_job_settings
    FOR SELECT
    USING (true);
