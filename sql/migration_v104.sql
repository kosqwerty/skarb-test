-- v104: add tov_text to branch_doc_blocks
ALTER TABLE public.branch_doc_blocks
    ADD COLUMN IF NOT EXISTS tov_text TEXT;
