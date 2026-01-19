-- Schnelle Admin-Rolle Einrichtung für Supabase
-- Die permissions Spalte ist JSONB, nicht TEXT[]

-- 1. Admin-Rolle erstellen (mit JSONB permissions)
INSERT INTO roles (name, description, permissions)
VALUES (
  'admin',
  'Full system administrator with all permissions',
  '["portfolio_create", "portfolio_read", "portfolio_update", "portfolio_delete",
    "project_create", "project_read", "project_update", "project_delete",
    "resource_create", "resource_read", "resource_update", "resource_delete", "resource_allocate",
    "financial_read", "financial_create", "financial_update", "financial_delete", "budget_alert_manage",
    "risk_create", "risk_read", "risk_update", "risk_delete",
    "issue_create", "issue_read", "issue_update", "issue_delete",
    "ai_rag_query", "ai_resource_optimize", "ai_risk_forecast", "ai_metrics_read",
    "user_manage", "role_manage", "admin_read", "admin_update", "admin_delete", "system_admin", "data_import",
    "pmr_create", "pmr_read", "pmr_update", "pmr_delete", "pmr_approve", "pmr_export", "pmr_collaborate", "pmr_ai_insights",
    "pmr_template_manage", "pmr_audit_read",
    "shareable_url_create", "shareable_url_read", "shareable_url_revoke", "shareable_url_manage",
    "simulation_run", "simulation_read", "simulation_delete", "simulation_manage",
    "scenario_create", "scenario_read", "scenario_update", "scenario_delete", "scenario_compare",
    "change_create", "change_read", "change_update", "change_delete", "change_approve", "change_implement", "change_audit_read",
    "po_breakdown_import", "po_breakdown_create", "po_breakdown_read", "po_breakdown_update", "po_breakdown_delete",
    "report_generate", "report_read", "report_template_create", "report_template_manage",
    "audit:read", "audit:export"]'::jsonb
)
ON CONFLICT (name) DO UPDATE
SET permissions = EXCLUDED.permissions,
    description = EXCLUDED.description;

-- 2. Admin-Rolle zu Ihrem Benutzer hinzufügen
-- WICHTIG: Ersetzen Sie 'bf1b1732-2449-4987-9fdb-fefa2a93b816' mit Ihrer User ID
INSERT INTO user_roles (user_id, role_id)
VALUES (
  'bf1b1732-2449-4987-9fdb-fefa2a93b816',  -- Ihre User ID hier
  (SELECT id FROM roles WHERE name = 'admin')
)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 3. Überprüfen Sie die Zuweisung
SELECT 
  ur.user_id,
  au.email,
  r.name as role_name,
  r.description
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = 'bf1b1732-2449-4987-9fdb-fefa2a93b816';

-- Sie sollten eine Zeile mit Ihrer E-Mail und "admin" als Rolle sehen
