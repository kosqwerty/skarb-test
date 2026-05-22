-- v72: branch_doc_blocks — add icon column for dept icon picker
ALTER TABLE public.branch_doc_blocks
    ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT NULL;
