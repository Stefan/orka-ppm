-- Migration: Audit retention & archival (enterprise roadmap Req 6.10, 6.11)
-- Adds archived_at to audit_logs for cold-storage/archival tracking.
-- Events with archived_at set are considered "archived"; query/export still possible with hint.

ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN audit_logs.archived_at IS 'When the event was moved to archive/cold storage; NULL = active.';

CREATE INDEX IF NOT EXISTS idx_audit_logs_archived_at ON audit_logs(archived_at) WHERE archived_at IS NOT NULL;
