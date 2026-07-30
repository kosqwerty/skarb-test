-- v167: справжні N-масштабовані БЛОКи керівників замість парних зв'язків
--
-- Стара модель (schedule_partners) — це пара "owner_id ↔ partner_id" на кожен
-- зв'язок, з дубльованим текстовим block_name на кожному рядку. Якщо в блоці
-- 3+ керівники, а вони не з'єднані попарно всі з усіма — кожен бачить лише
-- тих, з ким має прямий рядок. Нова модель: schedule_blocks (сам блок) +
-- schedule_block_members (хто в ньому, pending/accepted) — реальна група,
-- видима одразу всім прийнятим учасникам.
--
-- Стара таблиця schedule_partners НЕ видаляється цією міграцією (дані не
-- мігруються автоматично — попарні зв'язки семантично не мапляться 1:1 на
-- групи). Існуючі партнерства доведеться перестворити через новий UI.

BEGIN;

CREATE TABLE IF NOT EXISTS public.schedule_blocks (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_block_members (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id    uuid NOT NULL REFERENCES public.schedule_blocks(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
    invited_by  uuid REFERENCES auth.users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE(block_id, user_id)
);

ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_block_members ENABLE ROW LEVEL SECURITY;

-- schedule_blocks: бачити/редагувати може творець або будь-який прийнятий учасник
DROP POLICY IF EXISTS "sblocks_select" ON public.schedule_blocks;
CREATE POLICY "sblocks_select" ON public.schedule_blocks FOR SELECT
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.schedule_block_members m
        WHERE m.block_id = schedule_blocks.id AND m.user_id = auth.uid() AND m.status = 'accepted'
    )
);

DROP POLICY IF EXISTS "sblocks_insert" ON public.schedule_blocks;
CREATE POLICY "sblocks_insert" ON public.schedule_blocks FOR INSERT
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "sblocks_update" ON public.schedule_blocks;
CREATE POLICY "sblocks_update" ON public.schedule_blocks FOR UPDATE
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.schedule_block_members m
        WHERE m.block_id = schedule_blocks.id AND m.user_id = auth.uid() AND m.status = 'accepted'
    )
);

-- schedule_block_members
-- SELECT: власний рядок завжди, або будь-який рядок блоку, де я прийнятий учасник
-- (щоб бачити повний список — саме це й вирішує "не бачу всіх керівників у блоці")
DROP POLICY IF EXISTS "sbmembers_select" ON public.schedule_block_members;
CREATE POLICY "sbmembers_select" ON public.schedule_block_members FOR SELECT
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.schedule_block_members m2
        WHERE m2.block_id = schedule_block_members.block_id AND m2.user_id = auth.uid() AND m2.status = 'accepted'
    )
);

-- INSERT: запрошувати може прийнятий учасник блоку, або творець блоку (перше запрошення)
DROP POLICY IF EXISTS "sbmembers_insert" ON public.schedule_block_members;
CREATE POLICY "sbmembers_insert" ON public.schedule_block_members FOR INSERT
WITH CHECK (
    invited_by = auth.uid()
    AND (
        EXISTS (
            SELECT 1 FROM public.schedule_block_members m2
            WHERE m2.block_id = schedule_block_members.block_id AND m2.user_id = auth.uid() AND m2.status = 'accepted'
        )
        OR EXISTS (
            SELECT 1 FROM public.schedule_blocks b
            WHERE b.id = schedule_block_members.block_id AND b.created_by = auth.uid()
        )
    )
);

-- UPDATE: лише власний рядок (прийняти запрошення)
DROP POLICY IF EXISTS "sbmembers_update" ON public.schedule_block_members;
CREATE POLICY "sbmembers_update" ON public.schedule_block_members FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: вийти самому, або прийнятий учасник блоку може прибрати будь-кого (в т.ч. скасувати запрошення)
DROP POLICY IF EXISTS "sbmembers_delete" ON public.schedule_block_members;
CREATE POLICY "sbmembers_delete" ON public.schedule_block_members FOR DELETE
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.schedule_block_members m2
        WHERE m2.block_id = schedule_block_members.block_id AND m2.user_id = auth.uid() AND m2.status = 'accepted'
    )
);

COMMIT;
