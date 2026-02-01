-- Feature Toggle System: global and org-scoped flags
-- Design: .kiro/specs/feature-toggle-system/design.md
-- Table name: feature_toggles (distinct from existing feature_flags rollout table)

CREATE TABLE IF NOT EXISTS feature_toggles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    UNIQUE(name, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_toggles_name ON feature_toggles(name);
CREATE INDEX IF NOT EXISTS idx_feature_toggles_org ON feature_toggles(organization_id);
CREATE INDEX IF NOT EXISTS idx_feature_toggles_name_org ON feature_toggles(name, organization_id);

ALTER TABLE feature_toggles ENABLE ROW LEVEL SECURITY;

-- Read: authenticated users see global flags and their org's flags
CREATE POLICY "Users can read feature toggles"
ON feature_toggles FOR SELECT
TO authenticated
USING (
    organization_id IS NULL
    OR organization_id = COALESCE(
        (current_setting('request.jwt.claims', true)::json->>'organization_id')::uuid,
        (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid
    )
);

-- Write: only admins (role in JWT)
CREATE POLICY "Admins can insert feature toggles"
ON feature_toggles FOR INSERT
TO authenticated
WITH CHECK (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    OR (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role') = 'admin'
);

CREATE POLICY "Admins can update feature toggles"
ON feature_toggles FOR UPDATE
TO authenticated
USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    OR (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role') = 'admin'
);

CREATE POLICY "Admins can delete feature toggles"
ON feature_toggles FOR DELETE
TO authenticated
USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
    OR (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role') = 'admin'
);

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_feature_toggles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = (NOW() AT TIME ZONE 'UTC');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_feature_toggles_updated_at ON feature_toggles;
CREATE TRIGGER trigger_feature_toggles_updated_at
BEFORE UPDATE ON feature_toggles
FOR EACH ROW
EXECUTE PROCEDURE update_feature_toggles_updated_at();

-- Seed: initial global flags (organization_id NULL)
INSERT INTO feature_toggles (name, enabled, organization_id, description)
VALUES
    ('costbook_phase1', false, NULL, 'Enable Costbook Phase 1 features'),
    ('costbook_phase2', false, NULL, 'Enable Costbook Phase 2 features'),
    ('ai_anomaly_detection', false, NULL, 'AI-powered anomaly detection'),
    ('import_builder_ai', false, NULL, 'Import builder with AI assistance'),
    ('nested_grids', false, NULL, 'Nested grid layouts'),
    ('predictive_forecast', false, NULL, 'Predictive forecasting')
ON CONFLICT (name, organization_id) DO NOTHING;

COMMENT ON TABLE feature_toggles IS 'Feature toggle system: global and org-scoped flags';
