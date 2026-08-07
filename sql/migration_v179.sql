-- v179: бакет page-files блокував завантаження картинок (upload → 400),
-- хоча PDF/DOCX вантажились нормально — MIME allow-list бакета не включав
-- image/*, бо бакет спершу створювався під документи Collections/Documents.
-- Знімаємо обмеження за типом файлу (bucket приватний, доступ керується
-- RLS-політиками storage.objects, тож перелік дозволених типів тут
-- надлишковий захист).

BEGIN;

UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'page-files';

COMMIT;
