-- v82: activity_log — restrict SELECT to owner only (remove admin access)
DROP POLICY IF EXISTS "activity_log_select_admin" ON public.activity_log;

CREATE POLICY "activity_log_select_owner" ON public.activity_log
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'owner'
        )
    );
