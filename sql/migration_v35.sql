-- v35: RPC function for DB size (admin/owner widget in knowledge-base)
CREATE OR REPLACE FUNCTION get_db_size()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'bytes',  pg_database_size(current_database()),
    'pretty', pg_size_pretty(pg_database_size(current_database()))
  );
$$;
