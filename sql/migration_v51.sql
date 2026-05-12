-- v51: Survey assignments

CREATE TABLE IF NOT EXISTS public.survey_assignments (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id    uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
    user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    deadline_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (survey_id, user_id)
);

ALTER TABLE public.survey_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "survey_assignments_read" ON public.survey_assignments FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR
           EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin','smm','teacher','manager')));

CREATE POLICY "survey_assignments_write" ON public.survey_assignments FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin','smm')));
