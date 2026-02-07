-- Allow 'projects' as import_type in import_audit_logs so project imports
-- appear in the same history as commitments and actuals (Data Import page).

-- Drop existing constraint that only allowed 'actuals' and 'commitments'
ALTER TABLE import_audit_logs
  DROP CONSTRAINT IF EXISTS valid_import_audit_type;

-- Add constraint that includes 'projects'
ALTER TABLE import_audit_logs
  ADD CONSTRAINT valid_import_audit_type
  CHECK (import_type IN ('actuals', 'commitments', 'projects'));

COMMENT ON COLUMN import_audit_logs.import_type IS 'Type of import: actuals, commitments, or projects';
