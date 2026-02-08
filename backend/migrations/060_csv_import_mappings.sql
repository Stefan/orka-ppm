-- Migration 060: CSV import mapping rules (Cora-Surpass Phase 2.2)
-- Optional stored mappings: org + user + name + import_type → mapping JSON.

CREATE TABLE IF NOT EXISTS csv_import_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  import_type TEXT NOT NULL CHECK (import_type IN ('commitments', 'actuals')),
  mapping JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csv_import_mappings_user_id ON csv_import_mappings (user_id);
CREATE INDEX IF NOT EXISTS idx_csv_import_mappings_org_id ON csv_import_mappings (organization_id);
CREATE INDEX IF NOT EXISTS idx_csv_import_mappings_import_type ON csv_import_mappings (import_type);

COMMENT ON TABLE csv_import_mappings IS 'Saved CSV column → PPM field mappings per user/org (Phase 2.2)';
COMMENT ON COLUMN csv_import_mappings.mapping IS 'Array of { source_header, target_field }';

ALTER TABLE csv_import_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY csv_import_mappings_user_select ON csv_import_mappings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY csv_import_mappings_user_insert ON csv_import_mappings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY csv_import_mappings_user_update ON csv_import_mappings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY csv_import_mappings_user_delete ON csv_import_mappings
  FOR DELETE USING (auth.uid() = user_id);
