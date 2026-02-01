-- Migration: Create Generic Construction PPM Audit Logs Table
-- Requirements: 7.2, 7.6, 8.5, 9.5
-- Description: Comprehensive audit logging for all Generic Construction PPM features

-- Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    action_details JSONB NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    ip_address VARCHAR(45),
    user_agent TEXT,
    project_id UUID REFERENCES projects(id),
    performance_metrics JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_event_type ON roche_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_user_id ON roche_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_entity_type ON roche_audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_entity_id ON roche_audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_project_id ON roche_audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_timestamp ON roche_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_severity ON roche_audit_logs(severity);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_entity_timestamp 
    ON roche_audit_logs(entity_type, entity_id, timestamp DESC);

-- Add comment to table
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for Generic Construction PPM features including shareable URLs, simulations, scenarios, change management, PO breakdowns, and report generation';

-- Add comments to columns
COMMENT ON COLUMN roche_audit_logs.event_type IS 'Type of audit event (e.g., shareable_url_created, simulation_completed)';
COMMENT ON COLUMN roche_audit_logs.user_id IS 'User who performed the action (NULL for system events)';
COMMENT ON COLUMN roche_audit_logs.entity_type IS 'Type of entity being acted upon (e.g., shareable_url, simulation, change_request)';
COMMENT ON COLUMN roche_audit_logs.entity_id IS 'ID of the specific entity';
COMMENT ON COLUMN roche_audit_logs.action_details IS 'Detailed JSON information about the action';
COMMENT ON COLUMN roche_audit_logs.severity IS 'Severity level: info, warning, error, critical';
COMMENT ON COLUMN roche_audit_logs.performance_metrics IS 'Performance data including execution time, resource usage, etc.';
