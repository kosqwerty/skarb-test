-- v188: URL-схема /storage/v1/object/public/... (яку тепер використовує
-- ScormPlayer) перевіряє прапорець storage.buckets.public — окремо від
-- RLS-політик на storage.objects (доданих у v187). Без цього флага той самий
-- ендпоінт повертає 404 "Bucket not found", навіть якщо RLS дозволяє SELECT.

BEGIN;

UPDATE storage.buckets
SET public = true
WHERE id = 'scorm-packages';

COMMIT;
