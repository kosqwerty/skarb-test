-- v156: remove the 'teacher' role entirely (data, CHECK constraint, helper
-- functions, every RLS policy that referenced the literal 'teacher') and drop
-- the course_teachers table (per-course teacher assignment feature) along with
-- its own policies.
-- Run this in the Supabase SQL Editor as ONE transaction.
-- NOTE: role text here already reflects v155 (owner -> superadmin rename).

BEGIN;

-- 1) Drop the old constraint before reassigning data (existing 'teacher' rows
--    would violate a CHECK that already excludes 'teacher' if added first).
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2) Reassign existing teacher-role users to 'user'
UPDATE profiles SET role = 'user' WHERE role = 'teacher';

-- 3) New constraint without 'teacher'
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK ((role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'manager'::text, 'user'::text, 'intern'::text, 'student'::text, 'ceo'::text])));

-- 4) Helper functions that hardcoded 'teacher'
CREATE OR REPLACE FUNCTION public.is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('superadmin','admin','smm')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_teacher_or_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('superadmin','admin','smm') AND is_active = true
    );
$function$
;

-- is_teacher_or_admin is overloaded, and 9 existing policies (courses_insert,
-- lessons_manage, lessons_select, scorm_pkg_manage, scorm_pkg_select,
-- scorm_prog_select, lp_select, collections_manage, coll_items_manage) are
-- bound by OID to THIS (uuid) overload specifically, not the 0-arg one above —
-- Postgres resolves a policy's function reference once at CREATE POLICY time
-- and does not re-resolve it when a same-named overload is added later.
-- Confirmed by a failed DROP FUNCTION attempt reporting all 9 as dependents.
-- Update its body in place instead of dropping it; it never included
-- 'owner'/'superadmin' in its role list even before v155, which is a
-- pre-existing gap left as-is here (out of scope — this migration only
-- removes 'teacher', not changing who else gets access).
CREATE OR REPLACE FUNCTION public.is_teacher_or_admin(uid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = uid AND role IN ('admin'));
$function$
;

-- 5) RLS policies whose USING/WITH CHECK referenced role = 'teacher' (19 —
--    a 20th, course_teachers_write, is skipped here since that whole table
--    is dropped in step 6 below, taking its policies with it)
DROP POLICY IF EXISTS "aansw_update_staff" ON public.attempt_answers;
CREATE POLICY "aansw_update_staff" ON public.attempt_answers AS PERMISSIVE FOR UPDATE TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text]))))));

DROP POLICY IF EXISTS "pages_manage" ON public.custom_pages;
CREATE POLICY "pages_manage" ON public.custom_pages AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text])));

DROP POLICY IF EXISTS "pages_select" ON public.custom_pages;
CREATE POLICY "pages_select" ON public.custom_pages AS PERMISSIVE FOR SELECT TO authenticated
    USING (((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text])) OR ((is_published = true) AND ((array_length(allowed_labels, 1) IS NULL) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.label = ANY (custom_pages.allowed_labels)))))))));

DROP POLICY IF EXISTS "ist: staff read" ON public.intern_schedule_templates;
CREATE POLICY "ist: staff read" ON public.intern_schedule_templates AS PERMISSIVE FOR SELECT TO authenticated
    USING ((get_user_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'manager'::text])));

DROP POLICY IF EXISTS "news_manage" ON public.news;
CREATE POLICY "news_manage" ON public.news AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text])));

DROP POLICY IF EXISTS "news_select" ON public.news;
CREATE POLICY "news_select" ON public.news AS PERMISSIVE FOR SELECT TO authenticated
    USING (((is_published = true) OR (get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text]))));

DROP POLICY IF EXISTS "page_att_manage" ON public.page_attachments;
CREATE POLICY "page_att_manage" ON public.page_attachments AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text])));

DROP POLICY IF EXISTS "Staff can manage red folder items" ON public.red_folder_items;
CREATE POLICY "Staff can manage red folder items" ON public.red_folder_items AS PERMISSIVE FOR ALL TO public
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text]))))));

DROP POLICY IF EXISTS "resource_dovirenosti_write" ON public.resource_dovirenosti;
CREATE POLICY "resource_dovirenosti_write" ON public.resource_dovirenosti AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text]))))));

DROP POLICY IF EXISTS "staff manage resource_dovirenosti" ON public.resource_dovirenosti;
CREATE POLICY "staff manage resource_dovirenosti" ON public.resource_dovirenosti AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'smm'::text, 'manager'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'smm'::text, 'manager'::text]))))));

DROP POLICY IF EXISTS "resources_select" ON public.resources;
CREATE POLICY "resources_select" ON public.resources AS PERMISSIVE FOR SELECT TO authenticated
    USING (((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text])) OR ((lesson_id IS NULL) AND ((access_group_id IS NULL) OR user_has_group_access(access_group_id)) AND ((course_id IS NULL) OR (EXISTS ( SELECT 1
   FROM enrollments e
  WHERE ((e.user_id = auth.uid()) AND (e.course_id = resources.course_id)))))) OR (EXISTS ( SELECT 1
   FROM (lessons l
     JOIN enrollments e ON ((e.course_id = l.course_id)))
  WHERE ((l.id = resources.lesson_id) AND (e.user_id = auth.uid()))))));

DROP POLICY IF EXISTS "resources_write" ON public.resources;
CREATE POLICY "resources_write" ON public.resources AS PERMISSIVE FOR ALL TO authenticated
    USING ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text])))
    WITH CHECK ((get_current_role() = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text])));

DROP POLICY IF EXISTS "survey_answers_read" ON public.survey_answers;
CREATE POLICY "survey_answers_read" ON public.survey_answers AS PERMISSIVE FOR SELECT TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM survey_responses r
  WHERE ((r.id = survey_answers.response_id) AND ((r.user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'manager'::text]))))))))));

DROP POLICY IF EXISTS "survey_assignments_read" ON public.survey_assignments;
CREATE POLICY "survey_assignments_read" ON public.survey_assignments AS PERMISSIVE FOR SELECT TO authenticated
    USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'manager'::text])))))));

DROP POLICY IF EXISTS "survey_responses_read_own" ON public.survey_responses;
CREATE POLICY "survey_responses_read_own" ON public.survey_responses AS PERMISSIVE FOR SELECT TO authenticated
    USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'manager'::text])))))));

DROP POLICY IF EXISTS "surveys_read" ON public.surveys;
CREATE POLICY "surveys_read" ON public.surveys AS PERMISSIVE FOR SELECT TO authenticated
    USING (((is_published = true) OR (created_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text, 'manager'::text])))))));

DROP POLICY IF EXISTS "admin manage grants" ON public.test_attempt_grants;
CREATE POLICY "admin manage grants" ON public.test_attempt_grants AS PERMISSIVE FOR ALL TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))))
    WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text]))))));

DROP POLICY IF EXISTS "admin read grants" ON public.test_attempt_grants;
CREATE POLICY "admin read grants" ON public.test_attempt_grants AS PERMISSIVE FOR SELECT TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'superadmin'::text, 'smm'::text, 'manager'::text]))))));

DROP POLICY IF EXISTS "tattempts_update_staff" ON public.test_attempts;
CREATE POLICY "tattempts_update_staff" ON public.test_attempts AS PERMISSIVE FOR UPDATE TO authenticated
    USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'smm'::text]))))));

-- 6) Drop the course_teachers table entirely (per-course teacher assignment
--    feature). Confirmed clean leaf table: no other table has an FK to it,
--    no triggers. Its own 2 policies (course_teachers_read, course_teachers_write)
--    are dropped automatically along with the table.
DROP TABLE IF EXISTS public.course_teachers;

COMMIT;
