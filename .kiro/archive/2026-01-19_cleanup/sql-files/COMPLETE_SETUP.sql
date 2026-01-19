-- Vollständiges Setup für Admin-Rolle in Supabase
-- Führen Sie dieses SQL in Supabase SQL Editor aus

-- ============================================================================
-- SCHRITT 1: Tabellen erstellen (falls nicht vorhanden)
-- ============================================================================

-- Rollen-Tabelle
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Benutzer-Rollen-Tabelle
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);

-- ============================================================================
-- SCHRITT 2: RLS-Policies erstellen
-- ============================================================================

-- RLS aktivieren
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policies für roles Tabelle
DROP POLICY IF EXISTS "Allow service role to manage roles" ON roles;
CREATE POLICY "Allow service role to manage roles"
ON roles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to read roles" ON roles;
CREATE POLICY "Allow authenticated users to read roles"
ON roles FOR SELECT
TO authenticated
USING (true);

-- Policies für user_roles Tabelle
DROP POLICY IF EXISTS "Allow service role to manage user roles" ON user_roles;
CREATE POLICY "Allow service role to manage user roles"
ON user_roles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow users to read their own roles" ON user_roles;
CREATE POLICY "Allow users to read their own roles"
ON user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================================
-- SCHRITT 3: Admin-Rolle erstellen
-- ============================================================================

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
    "pmr_create", "pmr_read", "pmr_update", "pmr_delete", "pmr_approve", "pmr_export", "pmr_collaborate", 
    "pmr_ai_insights", "pmr_template_manage", "pmr_audit_read",
    "shareable_url_create", "shareable_url_read", "shareable_url_revoke", "shareable_url_manage",
    "simulation_run", "simulation_read", "simulation_delete", "simulation_manage",
    "scenario_create", "scenario_read", "scenario_update", "scenario_delete", "scenario_compare",
    "change_create", "change_read", "change_update", "change_delete", "change_approve", "change_implement", 
    "change_audit_read",
    "po_breakdown_import", "po_breakdown_create", "po_breakdown_read", "po_breakdown_update", "po_breakdown_delete",
    "report_generate", "report_read", "report_template_create", "report_template_manage",
    "audit:read", "audit:export"]'::jsonb
)
ON CONFLICT (name) DO UPDATE
SET permissions = EXCLUDED.permissions,
    description = EXCLUDED.description;

-- ============================================================================
-- SCHRITT 4: Admin-Rolle zu Ihrem Benutzer hinzufügen
-- ============================================================================

-- WICHTIG: Ersetzen Sie 'bf1b1732-2449-4987-9fdb-fefa2a93b816' mit Ihrer User ID
-- Um Ihre User ID zu finden, führen Sie aus:
-- SELECT id, email FROM auth.users WHERE email = 'ihre-email@example.com';

INSERT INTO user_roles (user_id, role_id)
VALUES (
  'bf1b1732-2449-4987-9fdb-fefa2a93b816',  -- IHRE USER ID HIER
  (SELECT id FROM roles WHERE name = 'admin')
)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- ============================================================================
-- SCHRITT 5: Überprüfung
-- ============================================================================

-- Alle Rollen anzeigen
SELECT * FROM roles;

-- Ihre Rollenzuweisungen anzeigen
SELECT 
  ur.user_id,
  au.email,
  r.name as role_name,
  r.description,
  jsonb_array_length(r.permissions) as permission_count
FROM user_roles ur
JOIN auth.users au ON ur.user_id = au.id
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = 'bf1b1732-2449-4987-9fdb-fefa2a93b816';

-- Sie sollten eine Zeile sehen mit:
-- - Ihrer User ID
-- - Ihrer E-Mail
-- - role_name: admin
-- - permission_count: 70+ Berechtigungen

-- ============================================================================
-- FERTIG!
-- ============================================================================

-- Nächste Schritte:
-- 1. Backend neu starten (optional): cd backend && ./start-dev.sh
-- 2. Dashboard neu laden: http://localhost:3000/admin/performance
-- 3. Cmd+Shift+R (Mac) oder Ctrl+Shift+R (Windows) für Hard Reload
-- 4. Das Dashboard sollte jetzt echte Daten anzeigen! 🎉
