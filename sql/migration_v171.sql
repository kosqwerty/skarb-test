-- v171: довіреності — унікальність тепер ще й ігнорує зайві внутрішні пробіли
--
-- v170 прибрала дублікати, що різнились лише регістром, звіряючи lower(trim(name)).
-- Виявилось, що частина дублікатів різниться ще й КІЛЬКІСТЮ пробілів усередині
-- назви (напр. "ТОВ "Ай Ломбард"" проти "ТОВ  "АЙ ЛОМБАРД"" — подвійний пробіл
-- перед лапкою), тому lower(trim(name)) їх не бачив однаковими. Ця міграція
-- повторює логіку v170, але порівнює/індексує lower(regexp_replace(trim(name),
-- '\s+',' ','g')) — регістр І зайві пробіли одночасно.

BEGIN;

CREATE TEMP TABLE dov_canon AS
SELECT d.id AS dup_id, c.canon_id
FROM dovirenosti d
JOIN (
    SELECT DISTINCT ON (lower(regexp_replace(trim(name), '\s+', ' ', 'g')))
        id AS canon_id, lower(regexp_replace(trim(name), '\s+', ' ', 'g')) AS norm_name
    FROM dovirenosti
    ORDER BY lower(regexp_replace(trim(name), '\s+', ' ', 'g')), created_at ASC, id ASC
) c ON lower(regexp_replace(trim(d.name), '\s+', ' ', 'g')) = c.norm_name
WHERE d.id <> c.canon_id;

-- profile_dovirenosti (UNIQUE(profile_id, dovirenost_id))
DELETE FROM profile_dovirenosti pd
USING dov_canon dc
WHERE pd.dovirenost_id = dc.dup_id
  AND EXISTS (
      SELECT 1 FROM profile_dovirenosti pd2
      WHERE pd2.profile_id = pd.profile_id AND pd2.dovirenost_id = dc.canon_id
  );
UPDATE profile_dovirenosti pd
SET dovirenost_id = dc.canon_id
FROM dov_canon dc
WHERE pd.dovirenost_id = dc.dup_id;

-- resource_dovirenosti (UNIQUE(resource_id, dovirenost_id))
DELETE FROM resource_dovirenosti rd
USING dov_canon dc
WHERE rd.dovirenost_id = dc.dup_id
  AND EXISTS (
      SELECT 1 FROM resource_dovirenosti rd2
      WHERE rd2.resource_id = rd.resource_id AND rd2.dovirenost_id = dc.canon_id
  );
UPDATE resource_dovirenosti rd
SET dovirenost_id = dc.canon_id
FROM dov_canon dc
WHERE rd.dovirenost_id = dc.dup_id;

-- page_dovirenosti (UNIQUE(page_id, dovirenost_id))
DELETE FROM page_dovirenosti pgd
USING dov_canon dc
WHERE pgd.dovirenost_id = dc.dup_id
  AND EXISTS (
      SELECT 1 FROM page_dovirenosti pgd2
      WHERE pgd2.page_id = pgd.page_id AND pgd2.dovirenost_id = dc.canon_id
  );
UPDATE page_dovirenosti pgd
SET dovirenost_id = dc.canon_id
FROM dov_canon dc
WHERE pgd.dovirenost_id = dc.dup_id;

-- Прямі FK без унікального обмеження на пару
UPDATE registry_sections rs SET dovirenost_id = dc.canon_id
FROM dov_canon dc WHERE rs.dovirenost_id = dc.dup_id;

UPDATE registry_section_docs rsd SET dovirenost_id = dc.canon_id
FROM dov_canon dc WHERE rsd.dovirenost_id = dc.dup_id;

UPDATE resources r SET dovirenost_id = dc.canon_id
FROM dov_canon dc WHERE r.dovirenost_id = dc.dup_id;

DELETE FROM dovirenosti d USING dov_canon dc WHERE d.id = dc.dup_id;

-- Нормалізуємо самі назви, що лишились (обрізка + схлопування внутрішніх пробілів)
UPDATE dovirenosti
SET name = regexp_replace(trim(name), '\s+', ' ', 'g')
WHERE name <> regexp_replace(trim(name), '\s+', ' ', 'g');

-- v170-індексlower(trim(name)) замінюємо на normalized-версію
DROP INDEX IF EXISTS dovirenosti_name_lower_key;
CREATE UNIQUE INDEX IF NOT EXISTS dovirenosti_name_norm_key
    ON dovirenosti (lower(regexp_replace(trim(name), '\s+', ' ', 'g')));

COMMIT;
