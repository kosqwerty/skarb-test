-- v43: add slug to news table

ALTER TABLE news
    ADD COLUMN IF NOT EXISTS slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_slug ON news(slug) WHERE slug IS NOT NULL;

-- transliteration helper + backfill for all rows (replaces any existing cyrillic slugs)
UPDATE news SET slug = (
    SELECT STRING_AGG(
        CASE c
            WHEN 'а' THEN 'a'  WHEN 'б' THEN 'b'  WHEN 'в' THEN 'v'
            WHEN 'г' THEN 'h'  WHEN 'ґ' THEN 'g'  WHEN 'д' THEN 'd'
            WHEN 'е' THEN 'e'  WHEN 'є' THEN 'ye' WHEN 'ж' THEN 'zh'
            WHEN 'з' THEN 'z'  WHEN 'и' THEN 'y'  WHEN 'і' THEN 'i'
            WHEN 'ї' THEN 'yi' WHEN 'й' THEN 'y'  WHEN 'к' THEN 'k'
            WHEN 'л' THEN 'l'  WHEN 'м' THEN 'm'  WHEN 'н' THEN 'n'
            WHEN 'о' THEN 'o'  WHEN 'п' THEN 'p'  WHEN 'р' THEN 'r'
            WHEN 'с' THEN 's'  WHEN 'т' THEN 't'  WHEN 'у' THEN 'u'
            WHEN 'ф' THEN 'f'  WHEN 'х' THEN 'kh' WHEN 'ц' THEN 'ts'
            WHEN 'ч' THEN 'ch' WHEN 'ш' THEN 'sh' WHEN 'щ' THEN 'shch'
            WHEN 'ь' THEN ''   WHEN 'ю' THEN 'yu' WHEN 'я' THEN 'ya'
            WHEN 'ё' THEN 'yo'
            ELSE c
        END, ''
    )
    FROM UNNEST(STRING_TO_ARRAY(LOWER(title), NULL)) AS c
)
|| '-' || SUBSTRING(id::text, 1, 8);

-- normalize non-alphanumeric to dashes and trim
UPDATE news SET slug = REGEXP_REPLACE(REGEXP_REPLACE(slug, '[^a-z0-9]+', '-', 'g'), '^-|-$', '', 'g');
