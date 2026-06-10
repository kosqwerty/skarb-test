-- ================================================================
-- LMS Migration v101 — branch_doc_blocks: page_ids для linked collections
-- ================================================================

ALTER TABLE public.branch_doc_blocks
    ADD COLUMN IF NOT EXISTS page_ids UUID[] DEFAULT '{}';
