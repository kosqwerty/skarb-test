-- v170: довіреності — регістронезалежна унікальність назви
--
-- "ТОВ "Ай Ломбард"" і "ТОВ "АЙ ЛОМБАРД"" створювались як два різні рядки
-- (UNIQUE(name) у Postgres чутливий до регістру). Клієнтський код (CreatableMultiSelect,
-- імпорт користувачів) вже звіряє назви без урахування регістру, але це не рятує від
-- дублікатів, створених раніше або паралельно. Ця міграція:
--   1. об'єднує вже існуючі дублікати (лишає найстаріший запис, перепідключає всі
--      посилання на канонічний id, видаляє дублікати);
--   2. замінює точний UNIQUE(name) на UNIQUE(lower(trim(name))), щоб дублікати
--      більше не могли з'явитись у жодному шляху створення.

BEGIN;

CREATE TEMP TABLE dov_canon AS
SELECT d.id AS dup_id, c.canon_id
FROM dovirenosti d
JOIN (
    SELECT DISTINCT ON (lower(trim(name))) id AS canon_id, lower(trim(name)) AS norm_name
    FROM dovirenosti
    ORDER BY lower(trim(name)), created_at ASC, id ASC
) c ON lower(trim(d.name)) = c.norm_name
WHERE d.id <> c.canon_id;

-- profile_dovirenosti (UNIQUE(profile_id, dovirenost_id)) — спершу прибираємо
-- рядки-дублікати, де профіль уже має канонічну довіреність, потім перепідключаємо решту
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

-- Прямі FK без унікального обмеження на пару — просто перепідключаємо
UPDATE registry_sections rs SET dovirenost_id = dc.canon_id
FROM dov_canon dc WHERE rs.dovirenost_id = dc.dup_id;

UPDATE registry_section_docs rsd SET dovirenost_id = dc.canon_id
FROM dov_canon dc WHERE rsd.dovirenost_id = dc.dup_id;

UPDATE resources r SET dovirenost_id = dc.canon_id
FROM dov_canon dc WHERE r.dovirenost_id = dc.dup_id;

-- Видаляємо самі рядки-дублікати довіреностей
DELETE FROM dovirenosti d USING dov_canon dc WHERE d.id = dc.dup_id;

-- Прибираємо зайві пробіли в назвах, що лишились
UPDATE dovirenosti SET name = trim(name) WHERE name <> trim(name);

-- Точний UNIQUE(name) → регістронезалежний UNIQUE(lower(trim(name)))
ALTER TABLE dovirenosti DROP CONSTRAINT IF EXISTS dovirenosti_name_key;
DROP INDEX IF EXISTS dovirenosti_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS dovirenosti_name_lower_key ON dovirenosti (lower(trim(name)));

COMMIT;
