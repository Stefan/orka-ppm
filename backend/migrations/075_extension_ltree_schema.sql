-- Migration 075: Move ltree extension out of public schema (Supabase lint 0014_extension_in_public)
-- Extensions in public can conflict with user objects; moving to schema "extensions" is recommended.
-- Idempotent: safe to run multiple times. If ltree is already in extensions, no-op.

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'ltree' AND n.nspname = 'public') THEN
    ALTER EXTENSION ltree SET SCHEMA extensions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '075: Could not move ltree to extensions schema (%). Ensure extension is relocatable.', SQLERRM;
END $$;

GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

COMMENT ON SCHEMA extensions IS 'Schema for PostgreSQL extensions (e.g. ltree). Keeps public schema clean.';
