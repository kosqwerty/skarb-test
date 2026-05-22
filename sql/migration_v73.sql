-- v73: red_folder_items — red folder table with document tracking
CREATE TABLE IF NOT EXISTS public.red_folder_items (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number        INTEGER NOT NULL,
    title         TEXT NOT NULL DEFAULT '',
    documents     TEXT DEFAULT '',
    responsible   TEXT DEFAULT '',
    icon          TEXT DEFAULT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_red_folder_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_red_folder_items_updated_at ON public.red_folder_items;
CREATE TRIGGER trg_red_folder_items_updated_at
    BEFORE UPDATE ON public.red_folder_items
    FOR EACH ROW EXECUTE FUNCTION update_red_folder_items_updated_at();

ALTER TABLE public.red_folder_items ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT NULL;

ALTER TABLE public.red_folder_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage red folder items" ON public.red_folder_items;
CREATE POLICY "Staff can manage red folder items"
    ON public.red_folder_items FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('owner','admin','smm','teacher')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('owner','admin','smm','teacher')
    ));

DROP POLICY IF EXISTS "All authenticated users can read red folder items" ON public.red_folder_items;
CREATE POLICY "All authenticated users can read red folder items"
    ON public.red_folder_items FOR SELECT
    USING (auth.uid() IS NOT NULL);
