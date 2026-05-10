-- v37: розширення get_db_size — додаємо розмір файлів у Supabase Storage
CREATE OR REPLACE FUNCTION get_db_size()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'db_bytes',      pg_database_size(current_database()),
    'db_pretty',     pg_size_pretty(pg_database_size(current_database())),
    'storage_bytes', COALESCE(
                       (SELECT SUM((metadata->>'size')::bigint)
                        FROM storage.objects
                        WHERE metadata IS NOT NULL),
                       0),
    'storage_pretty', pg_size_pretty(COALESCE(
                       (SELECT SUM((metadata->>'size')::bigint)
                        FROM storage.objects
                        WHERE metadata IS NOT NULL),
                       0)::bigint)
  );
$$;
