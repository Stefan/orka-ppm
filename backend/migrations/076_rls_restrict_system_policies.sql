-- Migration 076: Restrict "System can ..." RLS policies to service_role (Supabase lint 0024_permissive_rls_policy)
-- Policies that use USING (true) / WITH CHECK (true) for INSERT/UPDATE/DELETE are flagged.
-- Restricting to TO service_role makes access explicit: only the backend (service role) can perform these operations.
-- Idempotent: safe to run multiple times.

-- admin_audit_log
DROP POLICY IF EXISTS "System can insert audit logs" ON public.admin_audit_log;
CREATE POLICY "System can insert audit logs" ON public.admin_audit_log
  FOR INSERT TO service_role WITH CHECK (true);

-- chat_error_log
DROP POLICY IF EXISTS "System can insert error logs" ON public.chat_error_log;
CREATE POLICY "System can insert error logs" ON public.chat_error_log
  FOR INSERT TO service_role WITH CHECK (true);

-- user_activity_log
DROP POLICY IF EXISTS "System can insert activity logs" ON public.user_activity_log;
CREATE POLICY "System can insert activity logs" ON public.user_activity_log
  FOR INSERT TO service_role WITH CHECK (true);

-- notifications
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT TO service_role WITH CHECK (true);

-- csv_import_logs
DROP POLICY IF EXISTS "System can update import logs" ON public.csv_import_logs;
CREATE POLICY "System can update import logs" ON public.csv_import_logs
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

-- import_audit_logs
DROP POLICY IF EXISTS "System can update import audit logs" ON public.import_audit_logs;
CREATE POLICY "System can update import audit logs" ON public.import_audit_logs
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);
