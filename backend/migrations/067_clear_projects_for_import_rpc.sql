-- RPC to clear projects table using TRUNCATE ... CASCADE.
-- One fast statement; also truncates all tables that reference projects (FK to projects).
-- Used when "Clear before import" is enabled.

CREATE OR REPLACE FUNCTION clear_projects_for_import()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_count int;
BEGIN
  SELECT count(*)::int INTO row_count FROM projects;
  TRUNCATE projects CASCADE;
  RETURN row_count;
END;
$$;

COMMENT ON FUNCTION clear_projects_for_import() IS 'Truncates projects and all tables with FK to projects (CASCADE). Returns number of project rows before truncate. Used when Clear before import is enabled.';
