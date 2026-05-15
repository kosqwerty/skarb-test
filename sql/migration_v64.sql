-- migration_v64: get_today_birthdays — додати avatar_url, city

DROP FUNCTION IF EXISTS public.get_today_birthdays();

CREATE OR REPLACE FUNCTION public.get_today_birthdays()
RETURNS TABLE(id UUID, full_name TEXT, job_position TEXT, subdivision TEXT, city TEXT, avatar_url TEXT, birth_date DATE)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT id, full_name, job_position, subdivision, city, avatar_url, birth_date
    FROM public.profiles
    WHERE birth_date IS NOT NULL
      AND is_active = true
      AND EXTRACT(month FROM birth_date) = EXTRACT(month FROM CURRENT_DATE)
      AND EXTRACT(day   FROM birth_date) = EXTRACT(day   FROM CURRENT_DATE);
$$;
