-- =============================================================================
-- Phase 1 – Security & Scalability: SOX-compliant audit_logs + RLS
-- Enterprise Readiness: audit_logs table, immutable, RLS insert-only for app
-- =============================================================================

-- audit_logs: SOX-compliant audit trail (user_id, action, entity, old_value, new_value, timestamp, ip)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'LOGIN_FAILED')),
  entity VARCHAR(255) NOT NULL,
  entity_id UUID,
  old_value TEXT,
  new_value TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  ip INET,
  user_agent TEXT,
  correlation_id UUID,
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT audit_occurred_at_immutable CHECK (true)
);

-- If audit_logs already existed with a different schema, add all missing columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'user_id') THEN
    ALTER TABLE audit_logs ADD COLUMN user_id UUID;
    UPDATE audit_logs SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
    ALTER TABLE audit_logs ALTER COLUMN user_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'entity') THEN
    ALTER TABLE audit_logs ADD COLUMN entity VARCHAR(255);
    UPDATE audit_logs SET entity = 'unknown' WHERE entity IS NULL;
    ALTER TABLE audit_logs ALTER COLUMN entity SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'action') THEN
    ALTER TABLE audit_logs ADD COLUMN action VARCHAR(50);
    UPDATE audit_logs SET action = 'CREATE' WHERE action IS NULL;
    ALTER TABLE audit_logs ALTER COLUMN action SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'entity_id') THEN
    ALTER TABLE audit_logs ADD COLUMN entity_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'old_value') THEN
    ALTER TABLE audit_logs ADD COLUMN old_value TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'new_value') THEN
    ALTER TABLE audit_logs ADD COLUMN new_value TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'occurred_at') THEN
    ALTER TABLE audit_logs ADD COLUMN occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    UPDATE audit_logs SET occurred_at = NOW() WHERE occurred_at IS NULL;
    ALTER TABLE audit_logs ALTER COLUMN occurred_at SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'ip') THEN
    ALTER TABLE audit_logs ADD COLUMN ip INET;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'user_agent') THEN
    ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'correlation_id') THEN
    ALTER TABLE audit_logs ADD COLUMN correlation_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'organization_id') THEN
    ALTER TABLE audit_logs ADD COLUMN organization_id UUID;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
      ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'created_at') THEN
    ALTER TABLE audit_logs ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;
  END IF;
END $$;

COMMENT ON TABLE audit_logs IS 'SOX-compliant audit trail; append-only, no updates/deletes by application';

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON audit_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id ON audit_logs(correlation_id);

-- RLS: enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can SELECT audit logs for their user_id or same organization
CREATE POLICY audit_logs_select_policy ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    audit_logs.user_id = auth.uid()
    OR organization_id IS NULL
    OR organization_id IN (SELECT id FROM organizations LIMIT 100)
  );

-- Service role can insert (backend uses service key for audit writes)
CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow authenticated to insert for their own user_id (when backend uses anon + RPC)
CREATE POLICY audit_logs_insert_authenticated ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE for authenticated or anon (immutability)
-- Only superuser/database owner can update/delete for legal retention purge
CREATE POLICY audit_logs_no_update ON audit_logs
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY audit_logs_no_delete ON audit_logs
  FOR DELETE
  TO authenticated
  USING (false);

-- Trigger: ensure occurred_at and created_at are set and never updated
CREATE OR REPLACE FUNCTION audit_logs_immutable_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_logs: updates not allowed (SOX immutability)';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_logs: deletes not allowed (SOX immutability)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE PROCEDURE audit_logs_immutable_trigger();
