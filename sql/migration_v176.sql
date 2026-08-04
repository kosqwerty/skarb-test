-- v176: confirm_mgr_help_substitute — дозволяє співробітнику підтвердити вихід
-- на підміну у відповідь на запит керівника "🆘 Потрібна підміна"
--
-- Клік "✓ Можу вийти" (ScheduleGraphEmployee._confirmMgrHelp) виконував три
-- операції ПРЯМО з клієнта від імені співробітника:
--   1) INSERT в schedule_assignments (якщо співробітник ще не призначений
--      на цю локацію) — заблоковано RLS "sched_assign: write" (USING is_manager()),
--      бо звичайний співробітник не є менеджером → 403.
--   2) UPSERT schedule_entries (notes='__sub_confirmed__') — проходить, бо
--      user_id = auth.uid() (власний запис).
--   3) DELETE вихідного запису __mgr_help__ (належить user_id=КЕРІВНИКА) —
--      теж заблоковано RLS "sentry_delete" (дозволяє лише власнику запису
--      або власнику локації) → 403.
--
-- Функція виконує всі три кроки з правами власника (SECURITY DEFINER), але
-- ЛИШЕ якщо запис p_entry_id дійсно активний запит __mgr_help__ — тобто не
-- дає жодних додаткових прав поза цим конкретним сценарієм підтвердження.

BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_mgr_help_substitute(p_entry_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_loc_id  uuid;
    v_date    date;
BEGIN
    SELECT location_id, date INTO v_loc_id, v_date
    FROM public.schedule_entries
    WHERE id = p_entry_id AND notes = '__mgr_help__';

    IF v_loc_id IS NULL THEN
        RAISE EXCEPTION 'Запит не знайдено або він уже закритий';
    END IF;

    INSERT INTO public.schedule_assignments (location_id, user_id, created_by)
    VALUES (v_loc_id, auth.uid(), auth.uid())
    ON CONFLICT (location_id, user_id) DO NOTHING;

    INSERT INTO public.schedule_entries (location_id, user_id, date, shift_type, notes, updated_by, updated_at)
    VALUES (v_loc_id, auth.uid(), v_date, 'work', '__sub_confirmed__', auth.uid(), now())
    ON CONFLICT (location_id, user_id, date)
    DO UPDATE SET shift_type = 'work', shift_start = NULL, shift_end = NULL,
                  notes = '__sub_confirmed__', updated_by = auth.uid(), updated_at = now();

    DELETE FROM public.schedule_entries WHERE id = p_entry_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirm_mgr_help_substitute(uuid) TO authenticated;

COMMIT;
