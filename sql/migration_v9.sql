-- ================================================================
-- LMS Migration v9 — Розбивка ПІБ на окремі поля
-- Виконати в Supabase SQL Editor
-- ================================================================

-- Нові колонки
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS last_name   TEXT,
    ADD COLUMN IF NOT EXISTS first_name  TEXT,
    ADD COLUMN IF NOT EXISTS patronymic  TEXT;

-- Міграція існуючих даних: розбиваємо full_name на частини
-- Формат припускається: "Прізвище Ім'я По батькові"
UPDATE public.profiles
SET
    last_name  = NULLIF(TRIM(SPLIT_PART(full_name, ' ', 1)), ''),
    first_name = NULLIF(TRIM(SPLIT_PART(full_name, ' ', 2)), ''),
    patronymic = NULLIF(
        TRIM(
            SUBSTRING(full_name FROM
                LENGTH(SPLIT_PART(full_name, ' ', 1)) +
                LENGTH(SPLIT_PART(full_name, ' ', 2)) + 3)
        ), '')
WHERE full_name IS NOT NULL AND full_name != '';

-- Тригер: при зміні last_name/first_name/patronymic — оновлювати full_name автоматично
CREATE OR REPLACE FUNCTION public.sync_full_name()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.full_name := TRIM(
        COALESCE(NEW.last_name, '') || ' ' ||
        COALESCE(NEW.first_name, '') || ' ' ||
        COALESCE(NEW.patronymic, '')
    );
    -- Якщо full_name порожній — залишаємо NULL
    IF NEW.full_name = '' THEN
        NEW.full_name := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_full_name ON public.profiles;
CREATE TRIGGER trg_sync_full_name
    BEFORE INSERT OR UPDATE OF last_name, first_name, patronymic
    ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.sync_full_name();
