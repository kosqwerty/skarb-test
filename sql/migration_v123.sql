-- Migration v123: intern schedule templates
CREATE TABLE IF NOT EXISTS public.intern_schedule_templates (
    id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name         text NOT NULL,
    job_position text NOT NULL DEFAULT '',
    rows         jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at   timestamptz DEFAULT now() NOT NULL,
    updated_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ist_job ON public.intern_schedule_templates(job_position);

CREATE TRIGGER set_updated_at_intern_schedule_templates
    BEFORE UPDATE ON public.intern_schedule_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.intern_schedule_templates ENABLE ROW LEVEL SECURITY;

-- owner/admin can read all templates
CREATE POLICY "ist: staff read" ON public.intern_schedule_templates
    FOR SELECT TO authenticated
    USING (public.get_user_role() IN ('owner','admin','teacher','smm','manager'));

-- owner/admin can insert/update/delete
CREATE POLICY "ist: admin write" ON public.intern_schedule_templates
    FOR ALL TO authenticated
    USING (public.get_user_role() IN ('owner','admin'))
    WITH CHECK (public.get_user_role() IN ('owner','admin'));
