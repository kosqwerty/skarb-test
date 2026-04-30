-- ================================================================
-- Migration v26: Activity logs for admin/manager/smm actions
-- ================================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id          bigserial PRIMARY KEY,
    user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_name  text,
    actor_role  text,
    action      text NOT NULL,
    entity_type text,
    entity_name text,
    meta        jsonb,
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Only owner can read logs
CREATE POLICY "activity_logs_owner_select" ON public.activity_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner')
    );

-- Admins/smm/owner can insert their own log entries
CREATE POLICY "activity_logs_staff_insert" ON public.activity_logs
    FOR INSERT WITH CHECK (
        user_id = auth.uid() AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner','admin','smm'))
    );
