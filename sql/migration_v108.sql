-- ================================================================
-- LMS Migration v108 — bd_tabs: вкладки для Куточка споживача
-- ================================================================

CREATE TABLE IF NOT EXISTS public.bd_tabs (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    title       TEXT        NOT NULL,
    order_index INT         DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.branch_doc_blocks
    ADD COLUMN IF NOT EXISTS tab_id UUID REFERENCES public.bd_tabs(id) ON DELETE SET NULL;

ALTER TABLE public.bd_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bd_tabs_select" ON public.bd_tabs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "bd_tabs_insert" ON public.bd_tabs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

CREATE POLICY "bd_tabs_update" ON public.bd_tabs
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

CREATE POLICY "bd_tabs_delete" ON public.bd_tabs
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

-- Створюємо дефолтну вкладку і переносимо туди весь наявний контент
DO $$
DECLARE
    default_tab_id UUID;
BEGIN
    INSERT INTO public.bd_tabs (title, order_index)
    VALUES ('Загальне', 0)
    RETURNING id INTO default_tab_id;

    UPDATE public.branch_doc_blocks
    SET tab_id = default_tab_id
    WHERE tab_id IS NULL;
END;
$$;

NOTIFY pgrst, 'reload schema';
