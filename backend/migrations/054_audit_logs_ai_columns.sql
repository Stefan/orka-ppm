-- Add AI-empowered audit trail columns to audit_logs when missing.
-- Fixes PGRST204 "Could not find the 'action_details' column" when table was created by 040 (SOX schema).
-- Resource (and other) inserts use: event_type, entity_type, action_details, severity, timestamp, category, tenant_id.

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS event_type VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action_details JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'info';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Backfill created_at for ordering if missing (get_audit_logs orders by created_at)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'created_at') THEN
    ALTER TABLE audit_logs ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Optional: backfill created_at from timestamp for rows that have timestamp but null created_at
UPDATE audit_logs SET created_at = "timestamp" WHERE created_at IS NULL AND "timestamp" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type) WHERE event_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_timestamp ON audit_logs(tenant_id, "timestamp" DESC) WHERE tenant_id IS NOT NULL;

COMMENT ON COLUMN audit_logs.action_details IS 'Detailed JSON information about the action (AI-empowered trail)';
COMMENT ON COLUMN audit_logs.event_type IS 'Type of audit event (e.g. resource_created, resource_updated)';
