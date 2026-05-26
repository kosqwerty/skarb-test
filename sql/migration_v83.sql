-- v83: allow admin/owner to set force_logout on any profile

-- Policy: admin/owner can update force_logout on any profile row
CREATE POLICY "profiles_admin_force_logout" ON public.profiles
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'owner')
        )
    );
