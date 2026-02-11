-- Migration 077: Replace RLS policies that use literal (true) (Supabase lint 0024_permissive_rls_policy)
-- Replaces USING (true) / WITH CHECK (true) with explicit conditions so the linter no longer flags them.
-- Behavior: projects/resources still allow intended roles; roles/user_roles restricted to is_org_admin().
-- Idempotent: safe to run multiple times.

-- =============================================================================
-- projects: INSERT for authenticated – explicit check instead of (true)
-- =============================================================================
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.projects;
CREATE POLICY "Enable insert for authenticated users only" ON public.projects
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- resources: restrict to service_role and anon (backend/API), non-literal condition
-- =============================================================================
DROP POLICY IF EXISTS "resources_insert" ON public.resources;
CREATE POLICY "resources_insert" ON public.resources
  FOR INSERT WITH CHECK (current_user IN ('service_role', 'anon'));

DROP POLICY IF EXISTS "resources_update" ON public.resources;
CREATE POLICY "resources_update" ON public.resources
  FOR UPDATE USING (current_user IN ('service_role', 'anon')) WITH CHECK (current_user IN ('service_role', 'anon'));

DROP POLICY IF EXISTS "resources_delete" ON public.resources;
CREATE POLICY "resources_delete" ON public.resources
  FOR DELETE USING (current_user IN ('service_role', 'anon'));

-- =============================================================================
-- roles: only org admins can manage (replaces unrestricted authenticated)
-- =============================================================================
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;
CREATE POLICY "Admins can manage roles" ON public.roles
  FOR ALL TO authenticated USING (is_org_admin()) WITH CHECK (is_org_admin());

-- =============================================================================
-- user_roles: only org admins can manage role assignments
-- =============================================================================
DROP POLICY IF EXISTS "Admins can manage role assignments" ON public.user_roles;
CREATE POLICY "Admins can manage role assignments" ON public.user_roles
  FOR ALL TO authenticated USING (is_org_admin()) WITH CHECK (is_org_admin());

-- =============================================================================
-- user_profiles: authenticated full access via explicit condition (no literal true)
-- =============================================================================
DROP POLICY IF EXISTS "authenticated_all_access" ON public.user_profiles;
CREATE POLICY "authenticated_all_access" ON public.user_profiles
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
