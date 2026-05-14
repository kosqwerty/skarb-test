-- v56: allow all authenticated users to see enrollments for any course

DROP POLICY IF EXISTS "enroll_select" ON public.enrollments;

CREATE POLICY "enroll_select" ON public.enrollments
FOR SELECT TO authenticated
USING (true);
