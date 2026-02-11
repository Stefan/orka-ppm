-- Migration 074: Set search_path on all functions (Supabase lint 0011_function_search_path_mutable)
-- Ensures each function has an immutable search_path so callers cannot inject schema resolution.
-- Idempotent: safe to run multiple times. Skips functions that already have search_path set.

DO $$
DECLARE
  r RECORD;
  target_path text;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS nspname,
      p.proname AS proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'private')
      AND p.prokind = 'f'
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) x
          WHERE x LIKE 'search_path=%'
        )
      )
  LOOP
    BEGIN
      target_path := CASE WHEN r.nspname = 'private' THEN 'private, public' ELSE 'public' END;
      IF r.args IS NULL OR trim(r.args) = '' THEN
        EXECUTE format('ALTER FUNCTION %I.%I() SET search_path = %L', r.nspname, r.proname, target_path);
      ELSE
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = %L', r.nspname, r.proname, r.args, target_path);
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '074: Skip %.%: %', r.nspname, r.proname, SQLERRM;
    END;
  END LOOP;
END $$;
