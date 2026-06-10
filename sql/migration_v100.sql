-- ================================================================
-- LMS Migration v100 — page_dovirenosti: доступ до сторінок по довіреності
-- ================================================================

CREATE TABLE IF NOT EXISTS public.page_dovirenosti (
    page_id       UUID NOT NULL REFERENCES public.custom_pages(id) ON DELETE CASCADE,
    dovirenost_id UUID NOT NULL REFERENCES public.dovirenosti(id)  ON DELETE CASCADE,
    PRIMARY KEY (page_id, dovirenost_id)
);

ALTER TABLE public.page_dovirenosti ENABLE ROW LEVEL SECURITY;

-- Всі автентифіковані можуть читати (для перевірки доступу)
CREATE POLICY "page_dovirenosti_select" ON public.page_dovirenosti
    FOR SELECT TO authenticated USING (true);

-- Тільки адміни та власники можуть змінювати
CREATE POLICY "page_dovirenosti_insert" ON public.page_dovirenosti
    FOR INSERT TO authenticated
    WITH CHECK (get_current_role() IN ('owner','admin','smm'));

CREATE POLICY "page_dovirenosti_delete" ON public.page_dovirenosti
    FOR DELETE TO authenticated
    USING (get_current_role() IN ('owner','admin','smm'));
