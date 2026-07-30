-- v168: фікс "infinite recursion detected in policy" для schedule_block_members
--
-- Політики з migration_v167 звертались самі до себе підзапитом
-- (EXISTS (SELECT ... FROM schedule_block_members WHERE ...)) — PostgreSQL
-- виявляє це як рекурсію й повертає помилку (500 на клієнті). Стандартне
-- рішення — SECURITY DEFINER функція: вона виконується з правами власника
-- функції й НЕ запускає повторну перевірку RLS того самого рядка, тому
-- розриває рекурсивний ланцюг.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_accepted_block_member(p_block_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.schedule_block_members
        WHERE block_id = p_block_id AND user_id = p_user_id AND status = 'accepted'
    );
$$;

-- schedule_blocks
DROP POLICY IF EXISTS "sblocks_select" ON public.schedule_blocks;
CREATE POLICY "sblocks_select" ON public.schedule_blocks FOR SELECT
USING (
    created_by = auth.uid()
    OR public.is_accepted_block_member(id, auth.uid())
);

DROP POLICY IF EXISTS "sblocks_update" ON public.schedule_blocks;
CREATE POLICY "sblocks_update" ON public.schedule_blocks FOR UPDATE
USING (
    created_by = auth.uid()
    OR public.is_accepted_block_member(id, auth.uid())
);

-- schedule_block_members
DROP POLICY IF EXISTS "sbmembers_select" ON public.schedule_block_members;
CREATE POLICY "sbmembers_select" ON public.schedule_block_members FOR SELECT
USING (
    user_id = auth.uid()
    OR public.is_accepted_block_member(block_id, auth.uid())
);

DROP POLICY IF EXISTS "sbmembers_insert" ON public.schedule_block_members;
CREATE POLICY "sbmembers_insert" ON public.schedule_block_members FOR INSERT
WITH CHECK (
    invited_by = auth.uid()
    AND (
        public.is_accepted_block_member(block_id, auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.schedule_blocks b
            WHERE b.id = schedule_block_members.block_id AND b.created_by = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "sbmembers_delete" ON public.schedule_block_members;
CREATE POLICY "sbmembers_delete" ON public.schedule_block_members FOR DELETE
USING (
    user_id = auth.uid()
    OR public.is_accepted_block_member(block_id, auth.uid())
);

COMMIT;
