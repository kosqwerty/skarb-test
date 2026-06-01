-- v90: red_folder_items — add page_id for linking to a Collections page
ALTER TABLE public.red_folder_items
    ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES public.custom_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_red_folder_items_page_id ON public.red_folder_items(page_id) WHERE page_id IS NOT NULL;
