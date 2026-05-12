-- v50: Surveys (опитування)

CREATE TABLE IF NOT EXISTS public.surveys (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title         text NOT NULL,
    description   text,
    created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_published  boolean NOT NULL DEFAULT false,
    is_anonymous  boolean NOT NULL DEFAULT false,
    deadline_at   timestamptz,
    access_group_id uuid REFERENCES public.access_groups(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.survey_questions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id    uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
    text         text NOT NULL,
    type         text NOT NULL CHECK (type IN ('single','multiple','text','rating','scale')),
    options      jsonb DEFAULT '[]',
    is_required  boolean NOT NULL DEFAULT true,
    order_index  integer NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.survey_responses (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id    uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
    user_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    session_id   text,
    submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.survey_answers (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id      uuid NOT NULL REFERENCES public.survey_responses(id) ON DELETE CASCADE,
    question_id      uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
    value            text,
    selected_options jsonb DEFAULT '[]'
);

-- RLS
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;

-- Surveys policies
CREATE POLICY "surveys_read" ON public.surveys FOR SELECT TO authenticated
    USING (is_published = true OR created_by = auth.uid() OR
           EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin','smm','teacher','manager')));
CREATE POLICY "surveys_write" ON public.surveys FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin','smm')));

-- Questions policies
CREATE POLICY "survey_questions_read" ON public.survey_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "survey_questions_write" ON public.survey_questions FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin','smm')));

-- Responses policies
CREATE POLICY "survey_responses_insert" ON public.survey_responses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "survey_responses_read_own" ON public.survey_responses FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR
           EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin','smm','teacher','manager')));

-- Answers policies
CREATE POLICY "survey_answers_insert" ON public.survey_answers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "survey_answers_read" ON public.survey_answers FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.survey_responses r WHERE r.id = response_id AND
           (r.user_id = auth.uid() OR
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin','smm','teacher','manager')))));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER surveys_updated_at BEFORE UPDATE ON public.surveys
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
