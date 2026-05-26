-- v85: allow authenticated users to read resource_dovirenosti
-- Resources are already protected by their own RLS; this join table just needs to be readable

ALTER TABLE public.resource_dovirenosti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resource_dovirenosti_select"        ON public.resource_dovirenosti;
DROP POLICY IF EXISTS "resource_dovirenosti_staff_select"  ON public.resource_dovirenosti;
DROP POLICY IF EXISTS "resource_dovirenosti_all"           ON public.resource_dovirenosti;
DROP POLICY IF EXISTS "resource_dovirenosti_write"         ON public.resource_dovirenosti;

-- All authenticated users can read (resource RLS already filters what resources they see)
CREATE POLICY "resource_dovirenosti_select" ON public.resource_dovirenosti
    FOR SELECT TO authenticated
    USING (true);

-- Write: only admin/owner/smm/teacher
CREATE POLICY "resource_dovirenosti_write" ON public.resource_dovirenosti
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('owner', 'admin', 'smm', 'teacher')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('owner', 'admin', 'smm', 'teacher')
        )
    );
