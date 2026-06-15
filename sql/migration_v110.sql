-- Migration v110: Стажери (Interns) module
-- Tables: interns, intern_disciplines, intern_viewers

-- ── interns ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.interns (
    id                  uuid        DEFAULT gen_random_uuid() NOT NULL,
    profile_id          uuid        NOT NULL,
    manager_id          uuid,
    start_date          date,
    planned_end_date    date,
    actual_end_date     date,
    group_number        text,
    status              text        NOT NULL DEFAULT 'active',
    status_changed_at   timestamptz,
    notes               text,
    created_at          timestamptz DEFAULT now() NOT NULL,
    updated_at          timestamptz DEFAULT now() NOT NULL,

    CONSTRAINT interns_pkey PRIMARY KEY (id),
    CONSTRAINT interns_status_check CHECK (status IN ('active','completed','dropped')),
    CONSTRAINT interns_profile_id_fkey  FOREIGN KEY (profile_id)  REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT interns_manager_id_fkey  FOREIGN KEY (manager_id)  REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ── intern_disciplines ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.intern_disciplines (
    id                uuid        DEFAULT gen_random_uuid() NOT NULL,
    intern_id         uuid        NOT NULL,
    discipline_name   text        NOT NULL,
    date              date,
    address           text,
    mentor_id         uuid,
    is_completed      boolean     NOT NULL DEFAULT false,
    notes             text,
    order_index       integer     NOT NULL DEFAULT 0,
    created_at        timestamptz DEFAULT now() NOT NULL,

    CONSTRAINT intern_disciplines_pkey PRIMARY KEY (id),
    CONSTRAINT intern_disciplines_intern_id_fkey  FOREIGN KEY (intern_id)  REFERENCES public.interns(id) ON DELETE CASCADE,
    CONSTRAINT intern_disciplines_mentor_id_fkey  FOREIGN KEY (mentor_id)  REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ── intern_viewers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.intern_viewers (
    profile_id    uuid        NOT NULL,
    granted_by    uuid,
    granted_at    timestamptz DEFAULT now() NOT NULL,

    CONSTRAINT intern_viewers_pkey PRIMARY KEY (profile_id),
    CONSTRAINT intern_viewers_profile_id_fkey   FOREIGN KEY (profile_id)  REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT intern_viewers_granted_by_fkey   FOREIGN KEY (granted_by)  REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- ── updated_at trigger for interns ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_interns_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS interns_updated_at ON public.interns;
CREATE TRIGGER interns_updated_at
    BEFORE UPDATE ON public.interns
    FOR EACH ROW EXECUTE FUNCTION public.set_interns_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.interns           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intern_disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intern_viewers    ENABLE ROW LEVEL SECURITY;

-- interns: owner full access
DROP POLICY IF EXISTS "owner_all_interns" ON public.interns;
CREATE POLICY "owner_all_interns" ON public.interns
    FOR ALL
    USING  ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner')
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner');

-- interns: manager sees only own interns
DROP POLICY IF EXISTS "manager_select_interns" ON public.interns;
CREATE POLICY "manager_select_interns" ON public.interns
    FOR SELECT
    USING (manager_id = auth.uid());

-- interns: intern_viewers see all
DROP POLICY IF EXISTS "viewer_select_interns" ON public.interns;
CREATE POLICY "viewer_select_interns" ON public.interns
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.intern_viewers WHERE profile_id = auth.uid()
    ));

-- intern_disciplines: owner full access
DROP POLICY IF EXISTS "owner_all_disciplines" ON public.intern_disciplines;
CREATE POLICY "owner_all_disciplines" ON public.intern_disciplines
    FOR ALL
    USING  ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner')
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner');

-- intern_disciplines: manager sees disciplines of own interns
DROP POLICY IF EXISTS "manager_select_disciplines" ON public.intern_disciplines;
CREATE POLICY "manager_select_disciplines" ON public.intern_disciplines
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.interns
        WHERE id = intern_disciplines.intern_id AND manager_id = auth.uid()
    ));

-- intern_disciplines: intern_viewers see all
DROP POLICY IF EXISTS "viewer_select_disciplines" ON public.intern_disciplines;
CREATE POLICY "viewer_select_disciplines" ON public.intern_disciplines
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.intern_viewers WHERE profile_id = auth.uid()
    ));

-- intern_viewers: owner full access
DROP POLICY IF EXISTS "owner_all_viewers" ON public.intern_viewers;
CREATE POLICY "owner_all_viewers" ON public.intern_viewers
    FOR ALL
    USING  ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner')
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner');
