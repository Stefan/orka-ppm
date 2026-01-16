-- Migration 022: PMR Security and Audit Trail
-- Adds security, audit trail, and export security tables for Enhanced PMR

-- PMR Audit Log Table
CREATE TABLE IF NOT EXISTS pmr_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL,
    report_id UUID REFERENCES pmr_reports(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL DEFAULT 'pmr_report',
    resource_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    timestamp TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for audit log
CREATE INDEX idx_pmr_audit_log_report_id ON pmr_audit_log(report_id, timestamp DESC);
CREATE INDEX idx_pmr_audit_log_user_id ON pmr_audit_log(user_id, timestamp DESC);
CREATE INDEX idx_pmr_audit_log_action ON pmr_audit_log(action, timestamp DESC);
CREATE INDEX idx_pmr_audit_log_severity ON pmr_audit_log(severity, timestamp DESC);
CREATE INDEX idx_pmr_audit_log_timestamp ON pmr_audit_log(timestamp DESC);

-- PMR Export Security Table
CREATE TABLE IF NOT EXISTS pmr_export_security (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pmr_reports(id) ON DELETE CASCADE,
    export_token VARCHAR(255) UNIQUE NOT NULL,
    export_format VARCHAR(20) NOT NULL CHECK (export_format IN ('pdf', 'excel', 'slides', 'word', 'powerpoint')),
    security_level VARCHAR(20) DEFAULT 'internal' CHECK (security_level IN ('public', 'internal', 'confidential', 'restricted')),
    watermark_enabled BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    download_limit INTEGER,
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMP,
    last_downloaded_by UUID,
    allowed_users JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMP,
    revoked_by UUID,
    revocation_reason TEXT
);

-- Indexes for export security
CREATE INDEX idx_pmr_export_security_report_id ON pmr_export_security(report_id);
CREATE INDEX idx_pmr_export_security_token ON pmr_export_security(export_token) WHERE is_active = TRUE;
CREATE INDEX idx_pmr_export_security_created_by ON pmr_export_security(created_by);
CREATE INDEX idx_pmr_export_security_expires_at ON pmr_export_security(expires_at) WHERE is_active = TRUE;

-- PMR Export Downloads Log Table
CREATE TABLE IF NOT EXISTS pmr_export_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    export_token VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    downloaded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for export downloads
CREATE INDEX idx_pmr_export_downloads_token ON pmr_export_downloads(export_token, downloaded_at DESC);
CREATE INDEX idx_pmr_export_downloads_user_id ON pmr_export_downloads(user_id, downloaded_at DESC);

-- PMR Data Sensitivity Table
CREATE TABLE IF NOT EXISTS pmr_data_sensitivity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pmr_reports(id) ON DELETE CASCADE,
    sensitivity_level VARCHAR(20) DEFAULT 'internal' CHECK (sensitivity_level IN ('public', 'internal', 'confidential', 'restricted')),
    contains_pii BOOLEAN DEFAULT FALSE,
    contains_financial BOOLEAN DEFAULT FALSE,
    contains_proprietary BOOLEAN DEFAULT FALSE,
    data_classification JSONB,
    assessed_at TIMESTAMP DEFAULT NOW(),
    assessed_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(report_id)
);

-- Indexes for data sensitivity
CREATE INDEX idx_pmr_data_sensitivity_report_id ON pmr_data_sensitivity(report_id);
CREATE INDEX idx_pmr_data_sensitivity_level ON pmr_data_sensitivity(sensitivity_level);

-- PMR Access Control Table
CREATE TABLE IF NOT EXISTS pmr_access_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pmr_reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    access_level VARCHAR(20) DEFAULT 'viewer' CHECK (access_level IN ('owner', 'editor', 'commenter', 'viewer')),
    can_view BOOLEAN DEFAULT TRUE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT FALSE,
    can_approve BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_share BOOLEAN DEFAULT FALSE,
    granted_by UUID NOT NULL,
    granted_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMP,
    revoked_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(report_id, user_id)
);

-- Indexes for access control
CREATE INDEX idx_pmr_access_control_report_id ON pmr_access_control(report_id) WHERE is_active = TRUE;
CREATE INDEX idx_pmr_access_control_user_id ON pmr_access_control(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_pmr_access_control_expires_at ON pmr_access_control(expires_at) WHERE is_active = TRUE;

-- Function to automatically log report changes
CREATE OR REPLACE FUNCTION log_pmr_report_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO pmr_audit_log (action, user_id, report_id, resource_type, details)
        VALUES ('report_created', NEW.generated_by, NEW.id, 'pmr_report', 
                jsonb_build_object('title', NEW.title, 'status', NEW.status));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO pmr_audit_log (action, user_id, report_id, resource_type, details)
        VALUES ('report_updated', NEW.generated_by, NEW.id, 'pmr_report',
                jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO pmr_audit_log (action, user_id, report_id, resource_type, details)
        VALUES ('report_deleted', OLD.generated_by, OLD.id, 'pmr_report',
                jsonb_build_object('title', OLD.title));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic audit logging
DROP TRIGGER IF EXISTS pmr_report_audit_trigger ON pmr_reports;
CREATE TRIGGER pmr_report_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON pmr_reports
FOR EACH ROW EXECUTE FUNCTION log_pmr_report_change();

-- Function to check export access
CREATE OR REPLACE FUNCTION check_export_access(
    p_export_token VARCHAR,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_export_security RECORD;
    v_allowed BOOLEAN := FALSE;
BEGIN
    -- Get export security record
    SELECT * INTO v_export_security
    FROM pmr_export_security
    WHERE export_token = p_export_token
    AND is_active = TRUE;
    
    -- Check if export exists
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check expiration
    IF v_export_security.expires_at IS NOT NULL 
       AND v_export_security.expires_at < NOW() THEN
        RETURN FALSE;
    END IF;
    
    -- Check download limit
    IF v_export_security.download_limit IS NOT NULL 
       AND v_export_security.download_count >= v_export_security.download_limit THEN
        RETURN FALSE;
    END IF;
    
    -- Check allowed users
    IF v_export_security.allowed_users IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(v_export_security.allowed_users) AS allowed_user
            WHERE allowed_user = p_user_id::TEXT
        ) INTO v_allowed;
        RETURN v_allowed;
    END IF;
    
    -- If no specific users are allowed, grant access
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired exports
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE pmr_export_security
    SET is_active = FALSE,
        revoked_at = NOW(),
        revocation_reason = 'Automatically expired'
    WHERE is_active = TRUE
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user permissions for a report
CREATE OR REPLACE FUNCTION get_user_report_permissions(
    p_report_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    can_view BOOLEAN,
    can_edit BOOLEAN,
    can_export BOOLEAN,
    can_approve BOOLEAN,
    can_delete BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(ac.can_view, FALSE) AS can_view,
        COALESCE(ac.can_edit, FALSE) AS can_edit,
        COALESCE(ac.can_export, FALSE) AS can_export,
        COALESCE(ac.can_approve, FALSE) AS can_approve,
        COALESCE(ac.can_delete, FALSE) AS can_delete
    FROM pmr_access_control ac
    WHERE ac.report_id = p_report_id
    AND ac.user_id = p_user_id
    AND ac.is_active = TRUE
    AND (ac.expires_at IS NULL OR ac.expires_at > NOW());
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE pmr_audit_log IS 'Audit trail for all PMR report operations';
COMMENT ON TABLE pmr_export_security IS 'Security controls for PMR report exports';
COMMENT ON TABLE pmr_export_downloads IS 'Log of all export download events';
COMMENT ON TABLE pmr_data_sensitivity IS 'Data sensitivity classification for PMR reports';
COMMENT ON TABLE pmr_access_control IS 'Fine-grained access control for PMR reports';

COMMENT ON FUNCTION log_pmr_report_change() IS 'Automatically logs changes to PMR reports';
COMMENT ON FUNCTION check_export_access(VARCHAR, UUID) IS 'Validates if a user can access an export';
COMMENT ON FUNCTION cleanup_expired_exports() IS 'Deactivates expired export tokens';
COMMENT ON FUNCTION get_user_report_permissions(UUID, UUID) IS 'Gets user permissions for a specific report';

-- Grant permissions (adjust based on your role structure)
-- GRANT SELECT, INSERT ON pmr_audit_log TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON pmr_export_security TO authenticated;
-- GRANT SELECT, INSERT ON pmr_export_downloads TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON pmr_data_sensitivity TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON pmr_access_control TO authenticated;
