-- ============================================================================
-- Migration 055: Performance indexes for audit, financial, and list endpoints
-- ============================================================================
-- Speeds up: GET /api/audit/logs, GET /api/audit/dashboard/stats,
--            GET /financial-tracking/budget-alerts, GET /csv-import/commitments|actuals
-- ============================================================================

-- Audit logs: tenant filter + time range + ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
ON audit_logs(tenant_id, created_at DESC)
WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
ON audit_logs(created_at DESC);

-- Audit logs: dashboard stats filter by timestamp (24h window)
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_timestamp
ON audit_logs(tenant_id, timestamp)
WHERE tenant_id IS NOT NULL;

-- Audit anomalies: dashboard stats by tenant + detection_timestamp
CREATE INDEX IF NOT EXISTS idx_audit_anomalies_tenant_detection
ON audit_anomalies(tenant_id, detection_timestamp DESC);

-- Financial tracking: budget-alerts aggregate by project_id
CREATE INDEX IF NOT EXISTS idx_financial_tracking_project_id
ON financial_tracking(project_id);

-- Commitments list: ORDER BY created_at DESC (csv-import/commitments)
CREATE INDEX IF NOT EXISTS idx_commitments_created_at_desc
ON commitments(created_at DESC);

-- Actuals list: ORDER BY created_at DESC (csv-import/actuals)
CREATE INDEX IF NOT EXISTS idx_actuals_created_at_desc
ON actuals(created_at DESC);

-- Feedback notifications: GET /feedback/notifications/ by user_id, ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
ON notifications(user_id, created_at DESC);

-- Schedules: milestone deadline alerts (due_date or target_date depending on schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'milestones' AND column_name = 'target_date') THEN
    CREATE INDEX IF NOT EXISTS idx_milestones_target_date_status ON milestones(target_date, status) WHERE status::text IN ('planned', 'at_risk');
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'milestones' AND column_name = 'due_date') THEN
    CREATE INDEX IF NOT EXISTS idx_milestones_due_date_status ON milestones(due_date, status) WHERE status::text IN ('planned', 'at_risk');
  END IF;
END $$;

-- Schedules: task assignment notifications (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_resource_assignments') THEN
    CREATE INDEX IF NOT EXISTS idx_task_resource_assignments_created_at ON task_resource_assignments(created_at DESC);
  END IF;
END $$;

-- PO breakdown: list and summary (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'po_breakdowns') THEN
    CREATE INDEX IF NOT EXISTS idx_po_breakdowns_project_active ON po_breakdowns(project_id, is_active) WHERE is_active = true;
  END IF;
END $$;

-- Update statistics for query planner (only for existing tables)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN ANALYZE audit_logs; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_anomalies') THEN ANALYZE audit_anomalies; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_tracking') THEN ANALYZE financial_tracking; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'commitments') THEN ANALYZE commitments; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'actuals') THEN ANALYZE actuals; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN ANALYZE notifications; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'milestones') THEN ANALYZE milestones; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_resource_assignments') THEN ANALYZE task_resource_assignments; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'po_breakdowns') THEN ANALYZE po_breakdowns; END IF;
END $$;
