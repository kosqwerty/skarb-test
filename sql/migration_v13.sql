-- ================================================================
-- LMS Migration v13 — full_name як обчислюване поле
-- Виконати в Supabase SQL Editor
-- ================================================================

-- 1. Знімаємо NOT NULL та DEFAULT щоб тригер міг писати вільно
ALTER TABLE public.profiles
    ALTER COLUMN full_name DROP NOT NULL,
    ALTER COLUMN full_name SET DEFAULT '';

-- 2. Тригер: автоматично збирає full_name з last_name + first_name + patronymic
CREATE OR REPLACE FUNCTION public.sync_full_name()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.full_name := NULLIF(TRIM(
        COALESCE(NEW.last_name, '')
        || CASE WHEN NEW.first_name  IS NOT NULL AND NEW.first_name  <> '' THEN ' ' || NEW.first_name  ELSE '' END
        || CASE WHEN NEW.patronymic  IS NOT NULL AND NEW.patronymic  <> '' THEN ' ' || NEW.patronymic  ELSE '' END
    ), '');
    -- Якщо і ПІБ порожнє — fallback на email
    IF NEW.full_name IS NULL OR NEW.full_name = '' THEN
        NEW.full_name := COALESCE(NULLIF(TRIM(NEW.email), ''), '');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_full_name ON public.profiles;
CREATE TRIGGER trg_sync_full_name
    BEFORE INSERT OR UPDATE OF last_name, first_name, patronymic, email
    ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_full_name();

-- 3. Поновлюємо всі існуючі рядки
UPDATE public.profiles SET last_name = last_name;  -- форсуємо тригер

-- 4. Після поновлення — повертаємо NOT NULL
ALTER TABLE public.profiles
    ALTER COLUMN full_name SET NOT NULL;
