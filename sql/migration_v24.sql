-- ================================================================
-- Migration v24: Personal calendar
-- ================================================================

-- ✅ Step 1: Create the viewers table first
CREATE TABLE IF NOT EXISTS public.personal_cal_viewers (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    viewer_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at timestamptz DEFAULT now(),
    UNIQUE(owner_id, viewer_id)
);
ALTER TABLE public.personal_cal_viewers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pcv_select" ON public.personal_cal_viewers FOR SELECT USING (owner_id = auth.uid() OR viewer_id = auth.uid());
CREATE POLICY "pcv_insert" ON public.personal_cal_viewers FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "pcv_delete" ON public.personal_cal_viewers FOR DELETE USING (owner_id = auth.uid());

-- ✅ Step 2: Now create the events table (the RLS policy's subquery can resolve the relation)
CREATE TABLE IF NOT EXISTS public.personal_cal_events (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title      text NOT NULL,
    date       date NOT NULL,
    time       time,
    notes      text,
    color      text DEFAULT '#6366f1',
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.personal_cal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pce_select" ON public.personal_cal_events FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.personal_cal_viewers
        WHERE owner_id = personal_cal_events.user_id AND viewer_id = auth.uid()
    )
);
CREATE POLICY "pce_insert" ON public.personal_cal_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "pce_update" ON public.personal_cal_events FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "pce_delete" ON public.personal_cal_events FOR DELETE USING (user_id = auth.uid());