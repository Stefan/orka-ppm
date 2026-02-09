-- Migration 061: Unified Registers (Register-Arten)
-- Spec: .kiro/specs/registers-unified/
-- Table: registers (type, project_id, organization_id, data jsonb, status)
-- RLS: organization-scoped (uses get_user_visible_org_ids, is_org_admin from 058 or stubs below)

-- Provide is_org_admin() and get_user_visible_org_ids() if not already present (e.g. migration 058 not applied).
-- Stubs use only user_roles + roles (005); no scope_type/scope_id/is_active (030). Apply 058 later to replace with full RLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'is_org_admin') THEN
    CREATE FUNCTION is_org_admin(uid UUID DEFAULT auth.uid())
    RETURNS BOOLEAN AS $inner$
      SELECT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = uid AND r.name IN ('super_admin', 'admin')
      );
    $inner$ LANGUAGE sql STABLE SECURITY DEFINER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'get_user_visible_org_ids') THEN
    -- Stub: no scope_id in user_roles; return all orgs so RLS allows access until 058/030 applied.
    CREATE FUNCTION get_user_visible_org_ids(uid UUID DEFAULT auth.uid())
    RETURNS SETOF UUID AS $inner$
    BEGIN
      RETURN QUERY SELECT id FROM organizations;
    END;
    $inner$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (
    'risk', 'change', 'cost', 'issue', 'benefits', 'lessons_learned', 'decision', 'opportunities'
  )),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE registers IS 'Unified register entries: risk, change, cost, issue, benefits, lessons_learned, decision, opportunities';
COMMENT ON COLUMN registers.type IS 'Register type (risk, change, cost, issue, benefits, lessons_learned, decision, opportunities)';
COMMENT ON COLUMN registers.data IS 'Type-specific fields (e.g. title, description, probability, impact for risk)';
COMMENT ON COLUMN registers.status IS 'Workflow status (e.g. open, in_progress, closed)';

CREATE INDEX IF NOT EXISTS idx_registers_type ON registers(type);
CREATE INDEX IF NOT EXISTS idx_registers_organization_id ON registers(organization_id);
CREATE INDEX IF NOT EXISTS idx_registers_project_id ON registers(project_id);
CREATE INDEX IF NOT EXISTS idx_registers_type_org ON registers(type, organization_id);
CREATE INDEX IF NOT EXISTS idx_registers_updated_at ON registers(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_registers_status ON registers(status);

-- updated_at trigger
CREATE OR REPLACE FUNCTION registers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS registers_updated_at_trigger ON registers;
CREATE TRIGGER registers_updated_at_trigger
  BEFORE UPDATE ON registers
  FOR EACH ROW EXECUTE FUNCTION registers_updated_at();

-- RLS (requires get_user_visible_org_ids, is_org_admin from migration 058)
ALTER TABLE registers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rls_registers_select" ON registers;
DROP POLICY IF EXISTS "rls_registers_insert" ON registers;
DROP POLICY IF EXISTS "rls_registers_update" ON registers;
DROP POLICY IF EXISTS "rls_registers_delete" ON registers;

CREATE POLICY "rls_registers_select" ON registers FOR SELECT
  USING (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));

CREATE POLICY "rls_registers_insert" ON registers FOR INSERT
  WITH CHECK (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));

CREATE POLICY "rls_registers_update" ON registers FOR UPDATE
  USING (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));

CREATE POLICY "rls_registers_delete" ON registers FOR DELETE
  USING (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));
