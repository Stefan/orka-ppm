-- RPCs to clear commitments and actuals tables in small server-side batches.
-- Used when "Clear before import" is enabled for CSV import.
--
-- WICHTIG: Migration als postgres ausführen (Supabase SQL Editor läuft als postgres),
-- damit SECURITY DEFINER die RLS-Policies umgeht und Zeilen wirklich gelöscht werden.
-- Test im SQL Editor: SELECT clear_commitments_for_import(); dann Tabelle prüfen.
--
-- Warum langsam? Auf commitments/actuals liegt der Trigger audit_commitments/audit_actuals
-- (audit_entity_change): bei JEDEM DELETE wird eine Zeile in audit_logs geschrieben.
-- Das macht selbst einzelne DELETEs langsam. Beim Massenlöschen schalten wir den
-- Trigger daher temporär aus (DISABLE/ENABLE), danach ist der Trigger wieder aktiv.

-- Clear commitments: one batch per call (avoids Supabase statement timeout on long-running RPC).
-- Caller loops until return is 0. Trigger disabled for this batch only.
CREATE OR REPLACE FUNCTION public.clear_commitments_for_import()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  batch_size int := 500;
  deleted int;
BEGIN
  ALTER TABLE public.commitments DISABLE TRIGGER audit_commitments;
  BEGIN
    DELETE FROM public.commitments
    WHERE id IN (SELECT id FROM public.commitments LIMIT batch_size);
    GET DIAGNOSTICS deleted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.commitments ENABLE TRIGGER audit_commitments;
    RAISE;
  END;
  ALTER TABLE public.commitments ENABLE TRIGGER audit_commitments;
  RETURN deleted;
END;
$$;

-- Clear actuals: one batch per call (same as commitments; caller loops until 0).
CREATE OR REPLACE FUNCTION public.clear_actuals_for_import()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  batch_size int := 500;
  deleted int;
BEGIN
  ALTER TABLE public.actuals DISABLE TRIGGER audit_actuals;
  BEGIN
    DELETE FROM public.actuals
    WHERE id IN (SELECT id FROM public.actuals LIMIT batch_size);
    GET DIAGNOSTICS deleted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.actuals ENABLE TRIGGER audit_actuals;
    RAISE;
  END;
  ALTER TABLE public.actuals ENABLE TRIGGER audit_actuals;
  RETURN deleted;
END;
$$;

-- Allow API (service_role, anon) to call the functions
GRANT EXECUTE ON FUNCTION public.clear_commitments_for_import() TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_commitments_for_import() TO anon;
GRANT EXECUTE ON FUNCTION public.clear_actuals_for_import() TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_actuals_for_import() TO anon;

COMMENT ON FUNCTION public.clear_commitments_for_import() IS 'Deletes one batch (500 rows) from commitments. Call in a loop until return 0. Trigger disabled for the batch. Run migration as postgres.';
COMMENT ON FUNCTION public.clear_actuals_for_import() IS 'Deletes one batch (500 rows) from actuals. Call in a loop until return 0. Trigger disabled for the batch. Run migration as postgres.';
