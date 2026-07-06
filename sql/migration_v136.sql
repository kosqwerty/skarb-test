-- Migration v136: allow users to delete their own feedback

CREATE POLICY "own_delete_feedback" ON public.feedback_reports
    FOR DELETE USING (user_id = auth.uid());
