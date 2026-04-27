-- ================================================================
-- LMS Migration v15 — Кошик (Trash) для власника
-- Видалені сторінки, новини, ресурси зберігаються 7 днів
-- Тільки власник має доступ до перегляду
-- Виконати в Supabase SQL Editor
-- ================================================================

-- ── Таблиця кошика ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trash (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    type         TEXT        NOT NULL CHECK (type IN ('page','news','resource')),
    item_id      UUID        NOT NULL,
    item_data    JSONB       NOT NULL,
    deleted_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    deleted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_trash_expires ON public.trash(expires_at);
CREATE INDEX IF NOT EXISTS idx_trash_type    ON public.trash(type);

ALTER TABLE public.trash ENABLE ROW LEVEL SECURITY;

-- Тільки власник може читати — клієнт не може писати напряму
CREATE POLICY "trash_owner_select" ON public.trash
    FOR SELECT TO authenticated
    USING (public.get_current_role() = 'owner');

-- ── Тригерна функція ─────────────────────────────────────────────
-- SECURITY DEFINER — щоб тригер міг писати в trash незалежно від RLS
CREATE OR REPLACE FUNCTION public.trg_to_trash()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    INSERT INTO public.trash (type, item_id, item_data, deleted_by)
    VALUES (
        TG_ARGV[0],
        OLD.id,
        row_to_json(OLD)::jsonb,
        auth.uid()   -- ID адміна, що видаляє (з JWT)
    );
    RETURN OLD;
END;
$$;

-- ── Тригери ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_pages_to_trash     ON public.custom_pages;
DROP TRIGGER IF EXISTS trg_news_to_trash      ON public.news;
DROP TRIGGER IF EXISTS trg_resources_to_trash ON public.resources;

CREATE TRIGGER trg_pages_to_trash
    BEFORE DELETE ON public.custom_pages
    FOR EACH ROW EXECUTE FUNCTION public.trg_to_trash('page');

CREATE TRIGGER trg_news_to_trash
    BEFORE DELETE ON public.news
    FOR EACH ROW EXECUTE FUNCTION public.trg_to_trash('news');

CREATE TRIGGER trg_resources_to_trash
    BEFORE DELETE ON public.resources
    FOR EACH ROW EXECUTE FUNCTION public.trg_to_trash('resource');

-- ── RPC для власника ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_trash_items()
RETURNS TABLE (
    id              UUID,
    type            TEXT,
    item_id         UUID,
    item_data       JSONB,
    deleted_by      UUID,
    deleted_by_name TEXT,
    deleted_at      TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        t.id,
        t.type,
        t.item_id,
        t.item_data,
        t.deleted_by,
        COALESCE(p.full_name, p.email, 'Невідомо') AS deleted_by_name,
        t.deleted_at,
        t.expires_at
    FROM public.trash t
    LEFT JOIN public.profiles p ON p.id = t.deleted_by
    WHERE t.expires_at > NOW()
      AND public.get_current_role() = 'owner'
    ORDER BY t.deleted_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_trash_items() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trash_items() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trash_items() TO anon;

-- ── Очищення протермінованих записів ─────────────────────────────
-- Викликайте вручну або через pg_cron: SELECT trash_cleanup();
CREATE OR REPLACE FUNCTION public.trash_cleanup()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INTEGER;
BEGIN
    DELETE FROM public.trash WHERE expires_at < NOW();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.trash_cleanup() TO authenticated;

-- Оновити schema cache PostgREST
NOTIFY pgrst, 'reload schema';
