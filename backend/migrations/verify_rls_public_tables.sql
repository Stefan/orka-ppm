-- RLS status for all tables in schema public (PostgREST-exposed).
-- Run in Supabase SQL Editor (or psql) to verify after applying 049 / 024.
--
-- Expected for audit_bias_metrics: relrowsecurity = true.
-- Tables with relrowsecurity = false may need RLS enabled (see lint findings).

SELECT
    n.nspname AS schema_name,
    c.relname AS table_name,
    c.relkind AS kind,
    c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY n.nspname, c.relname;

-- Single-table check (audit_bias_metrics):
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'audit_bias_metrics';
-- Expected: relrowsecurity = true
