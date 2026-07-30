-- v169: одноразове очищення "осиротілих" schedule_entries
--
-- _removeEmployee() (видалення співробітника з локації в графіку) видаляв лише
-- рядок schedule_assignments, а НЕ пов'язані schedule_entries (FK-каскад є лише
-- по location_id, не по user_id) — тому зміни (напр. day_off від підміни)
-- лишались "осиротілими" в БД після видалення співробітника з локації. Графік
-- їх більше не показує (рядка вже немає), але "Пошук підміни" все ще бачить ці
-- записи й хибно позначає людину зайнятою. Код виправлено (js/pages/schedule-graph.js,
-- _removeEmployee тепер прибирає entries разом з assignment) — цей скрипт лише
-- прибирає вже накопичене сміття.

BEGIN;

DELETE FROM public.schedule_entries se
WHERE NOT EXISTS (
    SELECT 1 FROM public.schedule_assignments sa
    WHERE sa.location_id = se.location_id AND sa.user_id = se.user_id
);

COMMIT;
