-- ================================================================
-- LMS Migration v99 — custom_pages: тригер updated_at
-- ================================================================

-- Якщо загальна функція set_updated_at вже є — використовуємо її
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_custom_pages_updated_at ON public.custom_pages;

CREATE TRIGGER trg_custom_pages_updated_at
  BEFORE UPDATE ON public.custom_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
