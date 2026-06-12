-- ================================================================
-- LMS Migration v106 — rf_tabs: вкладки для Червоної папки
-- ================================================================

CREATE TABLE IF NOT EXISTS public.rf_tabs (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    title       TEXT        NOT NULL,
    order_index INT         DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.red_folder_items
    ADD COLUMN IF NOT EXISTS tab_id UUID REFERENCES public.rf_tabs(id) ON DELETE SET NULL;

ALTER TABLE public.rf_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rf_tabs_select" ON public.rf_tabs
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "rf_tabs_insert" ON public.rf_tabs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

CREATE POLICY "rf_tabs_update" ON public.rf_tabs
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

CREATE POLICY "rf_tabs_delete" ON public.rf_tabs
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

-- Створюємо дефолтну вкладку і переносимо туди весь наявний контент
DO $$
DECLARE
    default_tab_id UUID;
BEGIN
    INSERT INTO public.rf_tabs (title, order_index)
    VALUES ('Загальне', 0)
    RETURNING id INTO default_tab_id;

    UPDATE public.red_folder_items
    SET tab_id = default_tab_id
    WHERE tab_id IS NULL;
END;
$$;

NOTIFY pgrst, 'reload schema';
