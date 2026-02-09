-- =============================================================================
-- Migration 058: RLS + Sub-Organizations (ltree hierarchy)
-- Spec: .kiro/specs/rls-sub-organizations/ Tasks 1 + 2
-- Same content as lib/supabase/policies.sql for backend/Postgres.
-- Ensures user_roles has scope_type/scope_id/is_active (from 030) so this migration can run standalone.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS ltree;

-- Ensure user_roles has columns required by get_user_primary_org_id / is_org_admin (else add them)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'scope_type') THEN
    ALTER TABLE user_roles ADD COLUMN scope_type VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'scope_id') THEN
    ALTER TABLE user_roles ADD COLUMN scope_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'is_active') THEN
    ALTER TABLE user_roles ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'parent_id') THEN
    ALTER TABLE organizations ADD COLUMN parent_id UUID REFERENCES organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'type') THEN
    ALTER TABLE organizations ADD COLUMN type TEXT DEFAULT 'Company' CHECK (type IN ('Company', 'Division', 'BusinessUnit', 'Country', 'Site'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'path') THEN
    ALTER TABLE organizations ADD COLUMN path LTREE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'depth') THEN
    ALTER TABLE organizations ADD COLUMN depth INT4 NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_path ON organizations USING GIST (path);
CREATE INDEX IF NOT EXISTS idx_organizations_parent_id ON organizations(parent_id);

DO $$
DECLARE
  r RECORD;
  n INT := 0;
BEGIN
  FOR r IN SELECT id FROM organizations WHERE path IS NULL OR path = '' LOOP
    n := n + 1;
    UPDATE organizations SET parent_id = NULL, depth = 0, path = (n::text)::ltree WHERE id = r.id;
  END LOOP;
  UPDATE organizations SET depth = nlevel(path) WHERE depth <> nlevel(path) AND path IS NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION organizations_compute_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path LTREE;
  sibling_count INT;
  new_label TEXT;
BEGIN
  IF NEW.parent_id IS NULL THEN
    SELECT COUNT(*)::int + 1 INTO sibling_count FROM organizations WHERE parent_id IS NULL AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    NEW.path := (sibling_count::text)::ltree;
    NEW.depth := 0;
  ELSE
    SELECT path, depth INTO parent_path, NEW.depth FROM organizations WHERE id = NEW.parent_id;
    IF parent_path IS NULL THEN RAISE EXCEPTION 'Parent organization not found'; END IF;
    NEW.depth := NEW.depth + 1;
    SELECT COUNT(*)::int + 1 INTO sibling_count FROM organizations WHERE parent_id = NEW.parent_id AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    new_label := sibling_count::text;
    NEW.path := parent_path || new_label::ltree;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organizations_path_trigger ON organizations;
CREATE TRIGGER organizations_path_trigger
  BEFORE INSERT OR UPDATE OF parent_id ON organizations
  FOR EACH ROW EXECUTE FUNCTION organizations_compute_path();

CREATE OR REPLACE FUNCTION get_user_primary_org_id(uid UUID DEFAULT auth.uid())
RETURNS UUID AS $$
  SELECT scope_id::uuid FROM user_roles ur
  WHERE ur.user_id = uid AND ur.scope_type = 'organization' AND (ur.is_active IS NULL OR ur.is_active <> false)
  ORDER BY ur.assigned_at NULLS LAST, ur.id LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_org_path(uid UUID DEFAULT auth.uid())
RETURNS LTREE AS $$
  SELECT o.path FROM organizations o WHERE o.id = get_user_primary_org_id(uid);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_org_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = uid AND (ur.is_active IS NULL OR ur.is_active <> false)
      AND r.name IN ('super_admin', 'admin')
      AND (ur.scope_type IS NULL OR ur.scope_type = 'global')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_visible_org_ids(uid UUID DEFAULT auth.uid())
RETURNS SETOF UUID AS $$
  DECLARE user_path LTREE;
  BEGIN
    IF is_org_admin(uid) THEN RETURN QUERY SELECT id FROM organizations; RETURN; END IF;
    user_path := get_user_org_path(uid);
    IF user_path IS NULL THEN RETURN; END IF;
    RETURN QUERY SELECT o.id FROM organizations o WHERE o.path <@ user_path OR o.path = user_path;
  END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
DROP POLICY IF EXISTS "rls_organizations_select" ON organizations;
CREATE POLICY "rls_organizations_select" ON organizations FOR SELECT
  USING (is_org_admin() OR id IN (SELECT get_user_visible_org_ids()));

ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view commitments in their organization" ON commitments;
DROP POLICY IF EXISTS "Admins and managers can manage commitments" ON commitments;
DROP POLICY IF EXISTS "rls_commitments_select_org_path" ON commitments;
DROP POLICY IF EXISTS "rls_commitments_insert_org_path" ON commitments;
DROP POLICY IF EXISTS "rls_commitments_update_org_path" ON commitments;
DROP POLICY IF EXISTS "rls_commitments_delete_org_path" ON commitments;
CREATE POLICY "rls_commitments_select_org_path" ON commitments FOR SELECT USING (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));
CREATE POLICY "rls_commitments_insert_org_path" ON commitments FOR INSERT WITH CHECK (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));
CREATE POLICY "rls_commitments_update_org_path" ON commitments FOR UPDATE USING (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));
CREATE POLICY "rls_commitments_delete_org_path" ON commitments FOR DELETE USING (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));

ALTER TABLE actuals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view actuals in their organization" ON actuals;
DROP POLICY IF EXISTS "Admins and managers can manage actuals" ON actuals;
DROP POLICY IF EXISTS "rls_actuals_select_org_path" ON actuals;
DROP POLICY IF EXISTS "rls_actuals_insert_org_path" ON actuals;
DROP POLICY IF EXISTS "rls_actuals_update_org_path" ON actuals;
DROP POLICY IF EXISTS "rls_actuals_delete_org_path" ON actuals;
CREATE POLICY "rls_actuals_select_org_path" ON actuals FOR SELECT USING (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));
CREATE POLICY "rls_actuals_insert_org_path" ON actuals FOR INSERT WITH CHECK (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));
CREATE POLICY "rls_actuals_update_org_path" ON actuals FOR UPDATE USING (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));
CREATE POLICY "rls_actuals_delete_org_path" ON actuals FOR DELETE USING (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));

ALTER TABLE financial_variances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view financial variances" ON financial_variances;
DROP POLICY IF EXISTS "System can manage financial variances" ON financial_variances;
DROP POLICY IF EXISTS "rls_financial_variances_select_org_path" ON financial_variances;
DROP POLICY IF EXISTS "rls_financial_variances_all_org_path" ON financial_variances;
CREATE POLICY "rls_financial_variances_select_org_path" ON financial_variances FOR SELECT USING (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));
CREATE POLICY "rls_financial_variances_all_org_path" ON financial_variances FOR ALL USING (is_org_admin() OR organization_id IN (SELECT get_user_visible_org_ids()));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'organization_id') THEN
    ALTER TABLE audit_logs ADD COLUMN organization_id UUID REFERENCES organizations(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
DROP POLICY IF EXISTS audit_logs_select_policy ON audit_logs;
CREATE POLICY audit_logs_select_policy ON audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organization_id IS NULL OR organization_id IN (SELECT get_user_visible_org_ids()) OR is_org_admin());

CREATE OR REPLACE FUNCTION audit_entity_change()
RETURNS TRIGGER AS $$
DECLARE uid UUID; ent TEXT; oid UUID;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  ent := TG_TABLE_NAME;
  IF TG_OP = 'INSERT' THEN
    oid := NEW.organization_id;
    INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value, organization_id)
    VALUES (uid, 'CREATE', ent, NEW.id, NULL, left(to_jsonb(NEW)::text, 10000), oid);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    oid := COALESCE(NEW.organization_id, OLD.organization_id);
    INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value, organization_id)
    VALUES (uid, 'UPDATE', ent, NEW.id, left(to_jsonb(OLD)::text, 10000), left(to_jsonb(NEW)::text, 10000), oid);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    oid := OLD.organization_id;
    INSERT INTO audit_logs (user_id, action, entity, entity_id, old_value, new_value, organization_id)
    VALUES (uid, 'DELETE', ent, OLD.id, left(to_jsonb(OLD)::text, 10000), NULL, oid);
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_commitments ON commitments;
CREATE TRIGGER audit_commitments AFTER INSERT OR UPDATE OR DELETE ON commitments FOR EACH ROW EXECUTE FUNCTION audit_entity_change();
DROP TRIGGER IF EXISTS audit_actuals ON actuals;
CREATE TRIGGER audit_actuals AFTER INSERT OR UPDATE OR DELETE ON actuals FOR EACH ROW EXECUTE FUNCTION audit_entity_change();
