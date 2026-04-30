-- ================================================================
-- Migration v22: Fix notifications INSERT policy for self-reminders
-- ================================================================

-- Allow any authenticated user to create notifications addressed to
-- themselves (e.g. overdue document reminders).
-- Admins/managers can still create for anyone.
DROP POLICY IF EXISTS "ntf_insert" ON public.notifications;

CREATE POLICY "ntf_insert" ON public.notifications FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('owner','admin','manager')
    )
  );
