-- v39: зберігати оригінальну назву завантаженого файлу
ALTER TABLE resources ADD COLUMN IF NOT EXISTS original_name TEXT;
