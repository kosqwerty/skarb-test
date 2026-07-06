-- Migration v135: feedback_reports table

CREATE TABLE IF NOT EXISTS public.feedback_reports (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    type            TEXT        NOT NULL DEFAULT 'other'
                                CHECK (type IN ('bug','suggestion','question','other')),
    priority        TEXT        NOT NULL DEFAULT 'medium'
                                CHECK (priority IN ('low','medium','high','urgent')),
    title           TEXT,
    message         TEXT        NOT NULL,
    screenshot_urls TEXT[]      DEFAULT '{}',
    context         JSONB       DEFAULT '{}',
    status          TEXT        NOT NULL DEFAULT 'new'
                                CHECK (status IN ('new','seen','in_progress','resolved')),
    reply           TEXT,
    replied_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    replied_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX feedback_reports_user_id_idx    ON public.feedback_reports(user_id);
CREATE INDEX feedback_reports_status_idx     ON public.feedback_reports(status);
CREATE INDEX feedback_reports_created_at_idx ON public.feedback_reports(created_at DESC);

ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback and read it back
CREATE POLICY "own_insert_feedback" ON public.feedback_reports
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_read_feedback" ON public.feedback_reports
    FOR SELECT USING (user_id = auth.uid());

-- Admins/owners can read and update all feedback
CREATE POLICY "admin_all_feedback" ON public.feedback_reports
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS feedback_reports_updated_at ON public.feedback_reports;
CREATE TRIGGER feedback_reports_updated_at
    BEFORE UPDATE ON public.feedback_reports
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for feedback screenshots (public read for admin preview)
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-screenshots', 'feedback-screenshots', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "own_upload_feedback_screenshot" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'feedback-screenshots' AND auth.uid() IS NOT NULL
    );
CREATE POLICY "admin_read_feedback_screenshot" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'feedback-screenshots' AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','owner'))
    );
CREATE POLICY "own_read_feedback_screenshot" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'feedback-screenshots' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );
