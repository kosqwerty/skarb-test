-- v192: Realtime для test_assignments, enrollments, survey_assignments,
-- test_attempts — бейдж "Моє навчання" у сайдбарі (nav-learn-badge) тепер
-- оновлюється миттєво, коли користувачу призначають тест/курс/опитування
-- (або він завершує спробу), поки він сидить деінде в порталі — раніше
-- бейдж перераховувався лише при відкритті самого розділу "Моє навчання".
--
-- REPLICA IDENTITY FULL потрібна для коректної фільтрації DELETE-подій
-- (зняття призначення) за user_id — за замовчуванням Postgres кладе в
-- payload.old лише первинний ключ.

BEGIN;

ALTER TABLE public.test_assignments    REPLICA IDENTITY FULL;
ALTER TABLE public.enrollments         REPLICA IDENTITY FULL;
ALTER TABLE public.survey_assignments  REPLICA IDENTITY FULL;
ALTER TABLE public.test_attempts       REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'test_assignments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.test_assignments;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'enrollments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollments;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'survey_assignments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.survey_assignments;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'test_attempts'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.test_attempts;
    END IF;
END $$;

COMMIT;
