-- v57: allow users to delete their own enrollment

DROP POLICY IF EXISTS "enroll_delete" ON public.enrollments;

CREATE POLICY "enroll_delete" ON public.enrollments
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_admin());
