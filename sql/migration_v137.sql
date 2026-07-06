-- Migration v137: feedback_messages — chat thread per feedback

CREATE TABLE IF NOT EXISTS public.feedback_messages (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    feedback_id UUID        NOT NULL REFERENCES public.feedback_reports(id) ON DELETE CASCADE,
    sender_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_role TEXT        NOT NULL CHECK (sender_role IN ('user','admin')),
    body        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX fm_feedback_id_idx ON public.feedback_messages(feedback_id, created_at);

ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;

-- User can read messages for their own feedback thread
CREATE POLICY "own_read_fm" ON public.feedback_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.feedback_reports WHERE id = feedback_id AND user_id = auth.uid())
        OR sender_id = auth.uid()
    );

-- User can insert messages for their own feedback thread
CREATE POLICY "own_insert_fm" ON public.feedback_messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (SELECT 1 FROM public.feedback_reports WHERE id = feedback_id AND user_id = auth.uid())
    );

-- Admins can read and insert all messages
CREATE POLICY "admin_all_fm" ON public.feedback_messages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );
