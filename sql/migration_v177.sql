-- v177: Realtime для schedule_entries — графік керівника оновлюється миттєво
-- при будь-якій зміні комірки співробітником (не лише в реагуванні на
-- конкретні сповіщення "знято"/"підтверджено", а взагалі будь-яке
-- INSERT/UPDATE/DELETE), без перезавантаження сторінки.
--
-- REPLICA IDENTITY FULL потрібна, бо за замовчуванням Postgres кладе в
-- payload.old при DELETE лише первинний ключ (id) — без location_id/user_id/
-- date клієнт не зможе зрозуміти, яку саме комірку прибрати з локального стану.

BEGIN;

ALTER TABLE public.schedule_entries REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'schedule_entries'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_entries;
    END IF;
END $$;

COMMIT;
