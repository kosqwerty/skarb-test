-- v158: per-admin tab access control — superadmin can grant/restrict which
-- admin-panel tabs each individual 'admin'-role user can see. Only applies
-- to role='admin'; superadmin/smm/ceo keep their existing hardcoded access
-- (unaffected). No rows for a given admin = unrestricted (matches today's
-- behavior, so existing admins aren't affected until explicitly configured).

BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_tab_permissions (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    tab_key     text NOT NULL,
    granted_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    granted_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, tab_key)
);

ALTER TABLE public.admin_tab_permissions ENABLE ROW LEVEL SECURITY;

-- Admin can read their own grants (needed to compute their own visible
-- tabs); superadmin can read everyone's (for the management UI).
DROP POLICY IF EXISTS "admin_tab_permissions_select" ON public.admin_tab_permissions;
CREATE POLICY "admin_tab_permissions_select" ON public.admin_tab_permissions
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR is_superadmin());

-- Only superadmin can grant/revoke.
DROP POLICY IF EXISTS "admin_tab_permissions_write" ON public.admin_tab_permissions;
CREATE POLICY "admin_tab_permissions_write" ON public.admin_tab_permissions
    FOR ALL TO authenticated
    USING (is_superadmin())
    WITH CHECK (is_superadmin());

COMMIT;
