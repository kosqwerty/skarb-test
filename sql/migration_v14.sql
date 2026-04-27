-- ================================================================
-- LMS Migration v14 — Виправлення RLS для custom_pages
-- Причина: is_teacher_or_admin() неоднозначна в деяких контекстах
--          власник не бачив чернеток сторінок
-- Виконати в Supabase SQL Editor
-- ================================================================

-- ── custom_pages ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "pages_select" ON public.custom_pages;
DROP POLICY IF EXISTS "pages_manage" ON public.custom_pages;

CREATE POLICY "pages_select" ON public.custom_pages FOR SELECT TO authenticated
    USING (
        public.get_current_role() IN ('owner','admin','smm','teacher')
        OR (
            is_published = true
            AND (
                array_length(allowed_labels, 1) IS NULL
                OR EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid()
                      AND label = ANY(allowed_labels)
                )
            )
        )
    );

CREATE POLICY "pages_manage" ON public.custom_pages FOR ALL TO authenticated
    USING     (public.get_current_role() IN ('owner','admin','smm','teacher'))
    WITH CHECK (public.get_current_role() IN ('owner','admin','smm','teacher'));

-- ── page_attachments ─────────────────────────────────────────────

DROP POLICY IF EXISTS "page_att_manage" ON public.page_attachments;

CREATE POLICY "page_att_manage" ON public.page_attachments
    FOR ALL TO authenticated
    USING     (public.get_current_role() IN ('owner','admin','smm','teacher'))
    WITH CHECK (public.get_current_role() IN ('owner','admin','smm','teacher'));

-- Оновити schema cache PostgREST
NOTIFY pgrst, 'reload schema';
