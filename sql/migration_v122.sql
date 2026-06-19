-- Migration v122: intern activity log
CREATE TABLE IF NOT EXISTS public.intern_logs (
    id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    intern_id  uuid REFERENCES public.interns(id)  ON DELETE CASCADE,
    action     text NOT NULL,
    details    jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_intern_logs_intern   ON public.intern_logs(intern_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intern_logs_actor    ON public.intern_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_intern_logs_created  ON public.intern_logs(created_at DESC);

ALTER TABLE public.intern_logs ENABLE ROW LEVEL SECURITY;

-- Owner/admin can read all logs
CREATE POLICY "intern_logs: owner read" ON public.intern_logs
    FOR SELECT TO authenticated
    USING (public.get_user_role() IN ('owner', 'admin'));

-- Any authenticated user can insert (actor_id = their own id enforced by app)
CREATE POLICY "intern_logs: insert" ON public.intern_logs
    FOR INSERT TO authenticated
    WITH CHECK (actor_id = auth.uid());
