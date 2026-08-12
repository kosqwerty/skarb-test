-- v183: бакет lesson-resources (звідки й вантажаться відео у Базу знань/
-- Документи) не має явного налаштування — при створенні через дашборд
-- Supabase бакетам ставиться дефолтний ліміт розміру файлу (зазвичай 50MB),
-- тож завантаження відео 145МБ падало з 400 (аналогічно v179 для page-files,
-- там причиною був allowed_mime_types, тут — file_size_limit).

BEGIN;

UPDATE storage.buckets
SET file_size_limit = 3221225472,  -- 3 GB
    allowed_mime_types = NULL
WHERE id = 'lesson-resources';

COMMIT;
