-- ================================================================
-- Migration v27: Allow managers to read all document_downloads
-- ================================================================

-- Drop duplicate and restrictive SELECT policies
DROP POLICY IF EXISTS "dd_select"                    ON public.document_downloads;
DROP POLICY IF EXISTS "doc_downloads: read own or admin" ON public.document_downloads;

-- Managers need to see their subordinates' acknowledgements;
-- frontend already filters by manager_id — DB just needs to allow access
CREATE POLICY "dd_select" ON public.document_downloads
    FOR SELECT TO authenticated USING (
        user_id = auth.uid()
        OR is_admin()
        OR public.get_current_role() = 'manager'
    );
