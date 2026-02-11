-- RPC to clear projects table in small server-side batches.
-- Used when "Clear before import" is enabled to avoid client round-trip timeouts
-- and PostgREST "JSON could not be generated" from large delete responses.

CREATE OR REPLACE FUNCTION clear_projects_for_import()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  batch_size int := 100;
  deleted int;
  total int := 0;
BEGIN
  -- Allow up to 5 minutes so clearing many rows does not hit default statement_timeout
  SET LOCAL statement_timeout = '300000';
  LOOP
    WITH batch AS (
      SELECT id FROM projects LIMIT batch_size
    ),
    removed AS (
      DELETE FROM projects WHERE id IN (SELECT id FROM batch) RETURNING id
    )
    SELECT count(*)::int INTO deleted FROM removed;
    total := total + deleted;
    EXIT WHEN deleted = 0;
  END LOOP;
  RETURN total;
END;
$$;

COMMENT ON FUNCTION clear_projects_for_import() IS 'Deletes all rows from projects in batches; returns total deleted. Used by project import when Clear before import is enabled.';
