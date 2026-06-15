-- Migration v113: Auto-fill gender from patronymic for profiles where gender is NULL

UPDATE public.profiles
SET gender = 'male'
WHERE gender IS NULL
  AND patronymic IS NOT NULL
  AND (
    patronymic ILIKE '%ович'
    OR patronymic ILIKE '%евич'
    OR patronymic ILIKE '%євич'
  );

UPDATE public.profiles
SET gender = 'female'
WHERE gender IS NULL
  AND patronymic IS NOT NULL
  AND (
    patronymic ILIKE '%овна'
    OR patronymic ILIKE '%івна'
    OR patronymic ILIKE '%євна'
    OR patronymic ILIKE '%ївна'
  );
