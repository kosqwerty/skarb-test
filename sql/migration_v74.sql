-- v74: resources — add red_folder_item_id for red folder file attachments
ALTER TABLE public.resources
    ADD COLUMN IF NOT EXISTS red_folder_item_id UUID REFERENCES public.red_folder_items(id) ON DELETE SET NULL;
