-- Migration v125: grant admin role full access to interns tables

-- interns: admin sees all
DROP POLICY IF EXISTS "admin_select_interns" ON public.interns;
CREATE POLICY "admin_select_interns" ON public.interns
    FOR SELECT
    USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- interns: admin can insert/update/delete
DROP POLICY IF EXISTS "admin_write_interns" ON public.interns;
CREATE POLICY "admin_write_interns" ON public.interns
    FOR ALL
    USING  ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- intern_disciplines: admin full access
DROP POLICY IF EXISTS "admin_all_disciplines" ON public.intern_disciplines;
CREATE POLICY "admin_all_disciplines" ON public.intern_disciplines
    FOR ALL
    USING  ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- intern_viewers: admin full access (to manage who has viewer access)
DROP POLICY IF EXISTS "admin_all_viewers" ON public.intern_viewers;
CREATE POLICY "admin_all_viewers" ON public.intern_viewers
    FOR ALL
    USING  ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
    WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
