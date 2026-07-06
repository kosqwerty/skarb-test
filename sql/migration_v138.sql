-- Migration v138: fix admin INSERT policy on feedback_messages
-- FOR ALL without explicit WITH CHECK may not cover INSERT correctly in all PG versions.
-- Replace with explicit USING + WITH CHECK.

DROP POLICY IF EXISTS "admin_all_fm" ON public.feedback_messages;

CREATE POLICY "admin_all_fm" ON public.feedback_messages
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );
