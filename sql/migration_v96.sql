-- ================================================================
-- LMS Migration v96 — red_folder_items: page_id → page_ids[]
-- ================================================================

ALTER TABLE public.red_folder_items
    ADD COLUMN IF NOT EXISTS page_ids UUID[] NOT NULL DEFAULT '{}';

-- перенести існуючі одиночні page_id у масив
UPDATE public.red_folder_items
   SET page_ids = ARRAY[page_id]
 WHERE page_id IS NOT NULL AND page_ids = '{}';

NOTIFY pgrst, 'reload schema';
