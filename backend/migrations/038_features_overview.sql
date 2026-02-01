-- Features Overview: hierarchical catalog for PPM-SaaS features
-- Uses dedicated table feature_catalog to avoid conflict with existing "features" table (e.g. feedback/feature_flags).
-- Table: feature_catalog (id, name, parent_id, description, screenshot_url, link, icon, created_at, updated_at)

CREATE TABLE IF NOT EXISTS feature_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES feature_catalog(id) ON DELETE SET NULL,
  description text,
  screenshot_url text,
  link text,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_catalog_parent_id ON feature_catalog(parent_id);
CREATE INDEX IF NOT EXISTS idx_feature_catalog_name ON feature_catalog(name);

-- RLS: allow read for authenticated; write for service role or admin
ALTER TABLE feature_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Feature catalog viewable by authenticated users" ON feature_catalog;
CREATE POLICY "Feature catalog viewable by authenticated users"
  ON feature_catalog FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Feature catalog manageable by service role" ON feature_catalog;
CREATE POLICY "Feature catalog manageable by service role"
  ON feature_catalog FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger to keep updated_at in sync
CREATE OR REPLACE FUNCTION feature_catalog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feature_catalog_updated_at_trigger ON feature_catalog;
CREATE TRIGGER feature_catalog_updated_at_trigger
  BEFORE UPDATE ON feature_catalog
  FOR EACH ROW
  EXECUTE PROCEDURE feature_catalog_updated_at();

-- Seed: example hierarchy (Financials > Costbook > EAC; Data > Import Builder)
INSERT INTO feature_catalog (id, name, parent_id, description, link, icon, created_at, updated_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Financials', NULL, 'Budget, commitments, actuals, and variance tracking.', '/financials', 'Wallet', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'Data', NULL, 'Data import, export, and integration.', '/import', 'Database', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO feature_catalog (id, name, parent_id, description, link, icon, created_at, updated_at) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Costbook', 'a0000000-0000-0000-0000-000000000001', 'Costbook view: projects grid, commitments, actuals, KPIs.', '/financials?tab=costbook', 'BookOpen', now(), now()),
  ('b0000000-0000-0000-0000-000000000002', 'EAC Calculation', 'b0000000-0000-0000-0000-000000000001', 'Estimate at Completion and variance analysis.', '/financials?tab=costbook', 'Calculator', now(), now()),
  ('b0000000-0000-0000-0000-000000000003', 'Import Builder', 'a0000000-0000-0000-0000-000000000002', 'Custom templates, mapping, sections, and validation. 10x: AI auto-mapping, live preview, error-fix suggestions.', '/import', 'Upload', now(), now())
ON CONFLICT (id) DO NOTHING;
