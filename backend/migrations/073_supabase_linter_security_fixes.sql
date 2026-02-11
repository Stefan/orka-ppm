-- Migration 073: Supabase Database Linter security fixes
-- 1) Set SECURITY INVOKER on views that were reported as SECURITY DEFINER (Supabase lint 0010).
-- 2) Enable RLS on public schedule-related tables (Supabase lint 0013).
-- Requires PostgreSQL 15+ for ALTER VIEW ... SET (security_invoker = on).
-- Idempotent: safe to run multiple times.

-- =============================================================================
-- PART 1: Views – run with caller's permissions (security_invoker = on)
-- =============================================================================

ALTER VIEW IF EXISTS public.pmr_dashboard_summary SET (security_invoker = on);
ALTER VIEW IF EXISTS public.performance_trends SET (security_invoker = on);
ALTER VIEW IF EXISTS public.project_controls_summary SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_critical_path SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_task_hierarchy SET (security_invoker = on);
ALTER VIEW IF EXISTS public.active_edit_sessions SET (security_invoker = on);
ALTER VIEW IF EXISTS public.export_jobs_status SET (security_invoker = on);
ALTER VIEW IF EXISTS public.pmr_template_analytics_sanitized SET (security_invoker = on);
ALTER VIEW IF EXISTS public.v_schedule_summary SET (security_invoker = on);

-- =============================================================================
-- PART 2: RLS on schedule-related tables (Supabase lint 0013)
-- =============================================================================
-- Uses get_user_visible_org_ids() and is_org_admin() from migration 058.
-- Project visibility: project in a portfolio (or program under portfolio) whose org is visible to user.

CREATE OR REPLACE FUNCTION get_user_visible_project_ids(uid UUID DEFAULT auth.uid())
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id FROM projects p
  WHERE is_org_admin(uid)
     OR p.portfolio_id IN (SELECT id FROM portfolios WHERE organization_id IN (SELECT get_user_visible_org_ids(uid)))
     OR p.program_id IN (SELECT id FROM programs WHERE portfolio_id IN (SELECT id FROM portfolios WHERE organization_id IN (SELECT get_user_visible_org_ids(uid))));
$$;

COMMENT ON FUNCTION get_user_visible_project_ids(UUID) IS 'Project IDs visible to user (org-scoped via portfolio/program). Used by schedule/task RLS.';

-- Enable RLS
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wbs_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_resource_assignments ENABLE ROW LEVEL SECURITY;

-- Policies: access only when the related schedule/project is visible to the user

DROP POLICY IF EXISTS "rls_schedules_org" ON public.schedules;
CREATE POLICY "rls_schedules_org" ON public.schedules
  FOR ALL USING (project_id IN (SELECT get_user_visible_project_ids()));

DROP POLICY IF EXISTS "rls_tasks_org" ON public.tasks;
CREATE POLICY "rls_tasks_org" ON public.tasks
  FOR ALL USING (schedule_id IN (SELECT id FROM public.schedules WHERE project_id IN (SELECT get_user_visible_project_ids())));

DROP POLICY IF EXISTS "rls_task_dependencies_org" ON public.task_dependencies;
CREATE POLICY "rls_task_dependencies_org" ON public.task_dependencies
  FOR ALL USING (
    predecessor_task_id IN (SELECT id FROM public.tasks WHERE schedule_id IN (SELECT id FROM public.schedules WHERE project_id IN (SELECT get_user_visible_project_ids())))
    AND successor_task_id IN (SELECT id FROM public.tasks WHERE schedule_id IN (SELECT id FROM public.schedules WHERE project_id IN (SELECT get_user_visible_project_ids())))
  );

DROP POLICY IF EXISTS "rls_wbs_elements_org" ON public.wbs_elements;
CREATE POLICY "rls_wbs_elements_org" ON public.wbs_elements
  FOR ALL USING (schedule_id IN (SELECT id FROM public.schedules WHERE project_id IN (SELECT get_user_visible_project_ids())));

DROP POLICY IF EXISTS "rls_schedule_baselines_org" ON public.schedule_baselines;
CREATE POLICY "rls_schedule_baselines_org" ON public.schedule_baselines
  FOR ALL USING (schedule_id IN (SELECT id FROM public.schedules WHERE project_id IN (SELECT get_user_visible_project_ids())));

DROP POLICY IF EXISTS "rls_task_resource_assignments_org" ON public.task_resource_assignments;
CREATE POLICY "rls_task_resource_assignments_org" ON public.task_resource_assignments
  FOR ALL USING (task_id IN (SELECT id FROM public.tasks WHERE schedule_id IN (SELECT id FROM public.schedules WHERE project_id IN (SELECT get_user_visible_project_ids()))));
