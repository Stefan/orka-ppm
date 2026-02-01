-- Migration 032: Rename roche_audit_logs table to audit_logs
-- Removes Roche branding from database table names
-- Requirements: IP compliance and branding cleanup

-- Rename the table from roche_audit_logs to audit_logs
ALTER TABLE roche_audit_logs RENAME TO audit_logs;

-- Update any existing comments or constraints that reference the old table name
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for Generic Construction PPM features including shareable URLs, simulations, scenarios, change management, PO breakdowns, and report generation';