-- Migration v114: Fix job_position for completed interns (repair broken prefixes + strip "Стажер" leftovers)

UPDATE public.profiles p
SET job_position = CASE
    WHEN p.job_position = 'ніверсал + продавець'   THEN 'Університет + продавець'
    WHEN p.job_position = 'ехнік + продавець'       THEN 'Технік + продавець'
    WHEN p.job_position = 'олотник'                 THEN 'Золотник'
    WHEN p.job_position = 'родавець техніки'        THEN 'Продавець техніки'
    WHEN p.job_position = 'родавець ювелірки'       THEN 'Продавець ювелірки'
    WHEN p.job_position ILIKE 'Стажер %'            THEN SUBSTRING(p.job_position FROM 8)
    WHEN p.job_position = 'Стажер'                  THEN NULL
    ELSE p.job_position
END,
label = NULL
FROM public.interns i
WHERE i.profile_id = p.id
  AND i.status = 'completed';
