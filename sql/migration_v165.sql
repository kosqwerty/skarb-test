-- v165: admin_update_user_email — синхронізувати profiles.email
--
-- Функція оновлювала лише auth.users.email, тому у "Редагування профілю"
-- зміна пошти зберігалась без помилки, але відображуваний email (з
-- public.profiles.email — саме його читає весь UI: дашборд, картка
-- профілю, список користувачів адмінки) лишався старим назавжди.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_update_user_email(p_user_id uuid, p_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE auth.users SET email = p_email, email_confirmed_at = now() WHERE id = p_user_id;
  UPDATE public.profiles SET email = p_email WHERE id = p_user_id;
END;
$function$
;

COMMIT;
