-- v153: section visibility toggle (used by "Шлях експерта" — Лекції / Перевірка tabs)
-- Hidden sections stay visible to admin/superadmin only.

CREATE TABLE IF NOT EXISTS public.app_section_visibility (
    key         TEXT PRIMARY KEY,
    is_hidden   BOOLEAN NOT NULL DEFAULT false,
    updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_section_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read section visibility" ON public.app_section_visibility;
CREATE POLICY "anyone can read section visibility" ON public.app_section_visibility
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins can modify section visibility" ON public.app_section_visibility;
CREATE POLICY "admins can modify section visibility" ON public.app_section_visibility
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','superadmin'))
    );
