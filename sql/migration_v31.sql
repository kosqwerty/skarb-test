-- Images per question, image_url per answer, notifications table

ALTER TABLE public.questions
    ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';

ALTER TABLE public.answers
    ADD COLUMN IF NOT EXISTS image_url text;

CREATE TABLE IF NOT EXISTS public.notifications (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type       text        NOT NULL DEFAULT 'info',
    title      text        NOT NULL,
    body       text,
    data       jsonb       DEFAULT '{}',
    read_at    timestamptz,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='notif_select' AND tablename='notifications') THEN
        CREATE POLICY "notif_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='notif_insert' AND tablename='notifications') THEN
        CREATE POLICY "notif_insert" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='notif_update' AND tablename='notifications') THEN
        CREATE POLICY "notif_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
