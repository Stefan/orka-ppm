-- Shareable Project URLs System Migration
-- Creates secure shareable URL system for external stakeholder access
-- with granular permissions, time-based expiration, and comprehensive access tracking

-- =====================================================
-- CUSTOM TYPES FOR SHARE LINK MANAGEMENT
-- =====================================================

-- Permission levels for share links
CREATE TYPE share_permission_level AS ENUM (
    'view_only',
    'limited_data',
    'full_project'
);

-- =====================================================
-- MAIN SHARE LINK TABLES
-- =====================================================

-- Project shares table
CREATE TABLE IF NOT EXISTS project_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    
    -- Access control
    created_by UUID NOT NULL REFERENCES auth.users(id),
    permission_level share_permission_level NOT NULL DEFAULT 'view_only',
    
    -- Expiration management
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    
    -- Customization
    custom_message TEXT,
    
    -- Usage tracking
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    last_accessed_ip INET,
    
    -- Revocation management
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES auth.users(id),
    revocation_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT project_shares_expiry_check CHECK (expires_at > created_at),
    CONSTRAINT project_shares_revocation_check CHECK (
        (revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL) OR
        (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
    )
);

-- Share access logs table for detailed tracking
CREATE TABLE IF NOT EXISTS share_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES project_shares(id) ON DELETE CASCADE,
    
    -- Access details
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET NOT NULL,
    user_agent TEXT,
    
    -- Geographic information
    country_code VARCHAR(2),
    city VARCHAR(100),
    
    -- Session tracking
    accessed_sections JSONB DEFAULT '[]',
    session_duration INTEGER, -- seconds
    
    -- Security monitoring
    is_suspicious BOOLEAN DEFAULT false,
    suspicious_reasons JSONB DEFAULT '[]',
    
    -- Indexes for performance
    CONSTRAINT share_access_logs_duration_check CHECK (session_duration IS NULL OR session_duration >= 0)
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Project shares indexes
CREATE INDEX IF NOT EXISTS idx_project_shares_token ON project_shares(token);
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_expires_at ON project_shares(expires_at);
CREATE INDEX IF NOT EXISTS idx_project_shares_created_by ON project_shares(created_by);
CREATE INDEX IF NOT EXISTS idx_project_shares_active ON project_shares(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_project_shares_permission_level ON project_shares(permission_level);

-- Share access logs indexes
CREATE INDEX IF NOT EXISTS idx_share_access_logs_share_id ON share_access_logs(share_id);
CREATE INDEX IF NOT EXISTS idx_share_access_logs_accessed_at ON share_access_logs(accessed_at);
CREATE INDEX IF NOT EXISTS idx_share_access_logs_ip_address ON share_access_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_share_access_logs_suspicious ON share_access_logs(is_suspicious) WHERE is_suspicious = true;
CREATE INDEX IF NOT EXISTS idx_share_access_logs_country ON share_access_logs(country_code) WHERE country_code IS NOT NULL;

-- =====================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================================

-- Apply updated_at trigger to project_shares
CREATE TRIGGER update_project_shares_updated_at 
    BEFORE UPDATE ON project_shares 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- AUDIT TRIGGERS FOR SHARE LINK MANAGEMENT
-- =====================================================

-- Apply audit triggers to share link tables
CREATE TRIGGER audit_project_shares 
    AFTER INSERT OR UPDATE OR DELETE ON project_shares 
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_share_access_logs 
    AFTER INSERT OR UPDATE OR DELETE ON share_access_logs 
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- =====================================================
-- SHARE LINK MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to automatically deactivate expired share links
CREATE OR REPLACE FUNCTION deactivate_expired_share_links()
RETURNS INTEGER AS $$
DECLARE
    deactivated_count INTEGER;
BEGIN
    UPDATE project_shares
    SET is_active = false,
        updated_at = NOW()
    WHERE is_active = true
    AND expires_at < NOW()
    AND revoked_at IS NULL;
    
    GET DIAGNOSTICS deactivated_count = ROW_COUNT;
    RETURN deactivated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to validate share link access
CREATE OR REPLACE FUNCTION validate_share_link_access(
    p_token VARCHAR(64)
)
RETURNS TABLE (
    share_id UUID,
    project_id UUID,
    permission_level share_permission_level,
    is_valid BOOLEAN,
    error_message TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ps.id,
        ps.project_id,
        ps.permission_level,
        CASE 
            WHEN ps.id IS NULL THEN false
            WHEN NOT ps.is_active THEN false
            WHEN ps.expires_at < NOW() THEN false
            WHEN ps.revoked_at IS NOT NULL THEN false
            ELSE true
        END as is_valid,
        CASE 
            WHEN ps.id IS NULL THEN 'Invalid share link token'
            WHEN NOT ps.is_active THEN 'Share link is inactive'
            WHEN ps.expires_at < NOW() THEN 'Share link has expired'
            WHEN ps.revoked_at IS NOT NULL THEN 'Share link has been revoked'
            ELSE NULL
        END as error_message
    FROM project_shares ps
    WHERE ps.token = p_token;
    
    -- If no record found, return invalid result
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            NULL::UUID,
            NULL::UUID,
            NULL::share_permission_level,
            false,
            'Invalid share link token'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to log share link access
CREATE OR REPLACE FUNCTION log_share_access(
    p_share_id UUID,
    p_ip_address INET,
    p_user_agent TEXT DEFAULT NULL,
    p_country_code VARCHAR(2) DEFAULT NULL,
    p_city VARCHAR(100) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    -- Insert access log
    INSERT INTO share_access_logs (
        share_id,
        ip_address,
        user_agent,
        country_code,
        city,
        accessed_at
    ) VALUES (
        p_share_id,
        p_ip_address,
        p_user_agent,
        p_country_code,
        p_city,
        NOW()
    ) RETURNING id INTO log_id;
    
    -- Update share link access tracking
    UPDATE project_shares
    SET access_count = access_count + 1,
        last_accessed_at = NOW(),
        last_accessed_ip = p_ip_address,
        updated_at = NOW()
    WHERE id = p_share_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to detect suspicious access patterns
CREATE OR REPLACE FUNCTION detect_suspicious_access(
    p_share_id UUID,
    p_ip_address INET
)
RETURNS JSONB AS $$
DECLARE
    recent_access_count INTEGER;
    unique_ip_count INTEGER;
    different_countries INTEGER;
    suspicious_reasons JSONB := '[]'::JSONB;
    is_suspicious BOOLEAN := false;
BEGIN
    -- Check for high frequency access (more than 10 accesses in last hour)
    SELECT COUNT(*)
    INTO recent_access_count
    FROM share_access_logs
    WHERE share_id = p_share_id
    AND accessed_at > NOW() - INTERVAL '1 hour';
    
    IF recent_access_count > 10 THEN
        is_suspicious := true;
        suspicious_reasons := suspicious_reasons || jsonb_build_object(
            'reason', 'high_frequency_access',
            'details', format('More than 10 accesses in the last hour (%s accesses)', recent_access_count)
        );
    END IF;
    
    -- Check for multiple unique IPs (more than 5 different IPs in last 24 hours)
    SELECT COUNT(DISTINCT ip_address)
    INTO unique_ip_count
    FROM share_access_logs
    WHERE share_id = p_share_id
    AND accessed_at > NOW() - INTERVAL '24 hours';
    
    IF unique_ip_count > 5 THEN
        is_suspicious := true;
        suspicious_reasons := suspicious_reasons || jsonb_build_object(
            'reason', 'multiple_ip_addresses',
            'details', format('Access from %s different IP addresses in 24 hours', unique_ip_count)
        );
    END IF;
    
    -- Check for geographic anomalies (access from more than 3 different countries in 24 hours)
    SELECT COUNT(DISTINCT country_code)
    INTO different_countries
    FROM share_access_logs
    WHERE share_id = p_share_id
    AND accessed_at > NOW() - INTERVAL '24 hours'
    AND country_code IS NOT NULL;
    
    IF different_countries > 3 THEN
        is_suspicious := true;
        suspicious_reasons := suspicious_reasons || jsonb_build_object(
            'reason', 'geographic_anomaly',
            'details', format('Access from %s different countries in 24 hours', different_countries)
        );
    END IF;
    
    RETURN jsonb_build_object(
        'is_suspicious', is_suspicious,
        'reasons', suspicious_reasons
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get share link analytics
CREATE OR REPLACE FUNCTION get_share_analytics(
    p_share_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
    analytics JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_accesses', COUNT(*),
        'unique_visitors', COUNT(DISTINCT ip_address),
        'unique_countries', COUNT(DISTINCT country_code),
        'average_session_duration', ROUND(AVG(session_duration)),
        'suspicious_access_count', COUNT(*) FILTER (WHERE is_suspicious = true),
        'access_by_day', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'date', DATE(accessed_at),
                    'count', day_count
                ) ORDER BY DATE(accessed_at)
            )
            FROM (
                SELECT DATE(accessed_at), COUNT(*) as day_count
                FROM share_access_logs
                WHERE share_id = p_share_id
                AND accessed_at BETWEEN p_start_date AND p_end_date
                GROUP BY DATE(accessed_at)
            ) daily_stats
        ),
        'geographic_distribution', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'country_code', country_code,
                    'count', country_count
                ) ORDER BY country_count DESC
            )
            FROM (
                SELECT country_code, COUNT(*) as country_count
                FROM share_access_logs
                WHERE share_id = p_share_id
                AND accessed_at BETWEEN p_start_date AND p_end_date
                AND country_code IS NOT NULL
                GROUP BY country_code
            ) country_stats
        )
    )
    INTO analytics
    FROM share_access_logs
    WHERE share_id = p_share_id
    AND accessed_at BETWEEN p_start_date AND p_end_date;
    
    RETURN COALESCE(analytics, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for active share links with project information
CREATE OR REPLACE VIEW v_active_share_links AS
SELECT 
    ps.id,
    ps.project_id,
    p.name as project_name,
    ps.token,
    ps.permission_level,
    ps.expires_at,
    ps.is_active,
    ps.access_count,
    ps.last_accessed_at,
    ps.created_by,
    u.email as creator_email,
    ps.created_at,
    CASE 
        WHEN ps.expires_at < NOW() THEN 'expired'
        WHEN ps.revoked_at IS NOT NULL THEN 'revoked'
        WHEN NOT ps.is_active THEN 'inactive'
        ELSE 'active'
    END as status
FROM project_shares ps
JOIN projects p ON ps.project_id = p.id
JOIN auth.users u ON ps.created_by = u.id
WHERE ps.is_active = true
AND ps.revoked_at IS NULL;

-- View for share link usage summary
CREATE OR REPLACE VIEW v_share_link_usage AS
SELECT 
    ps.id as share_id,
    ps.project_id,
    ps.permission_level,
    ps.access_count,
    COUNT(sal.id) as log_entries,
    COUNT(DISTINCT sal.ip_address) as unique_visitors,
    COUNT(DISTINCT sal.country_code) as unique_countries,
    MAX(sal.accessed_at) as last_access,
    COUNT(*) FILTER (WHERE sal.is_suspicious = true) as suspicious_access_count,
    ROUND(AVG(sal.session_duration)) as avg_session_duration
FROM project_shares ps
LEFT JOIN share_access_logs sal ON ps.id = sal.share_id
GROUP BY ps.id, ps.project_id, ps.permission_level, ps.access_count;

-- View for suspicious access patterns
CREATE OR REPLACE VIEW v_suspicious_access_patterns AS
SELECT 
    sal.id,
    sal.share_id,
    ps.project_id,
    p.name as project_name,
    sal.accessed_at,
    sal.ip_address,
    sal.country_code,
    sal.suspicious_reasons,
    ps.created_by,
    u.email as creator_email
FROM share_access_logs sal
JOIN project_shares ps ON sal.share_id = ps.id
JOIN projects p ON ps.project_id = p.id
JOIN auth.users u ON ps.created_by = u.id
WHERE sal.is_suspicious = true
ORDER BY sal.accessed_at DESC;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on project_shares table
ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view share links for projects they have access to
CREATE POLICY project_shares_select_policy ON project_shares
    FOR SELECT
    USING (
        created_by = auth.uid() OR
        project_id IN (
            SELECT id FROM projects 
            WHERE manager_id = auth.uid()
            OR id IN (
                SELECT project_id FROM project_team_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Policy: Users can create share links for projects they manage or are members of
CREATE POLICY project_shares_insert_policy ON project_shares
    FOR INSERT
    WITH CHECK (
        project_id IN (
            SELECT id FROM projects 
            WHERE manager_id = auth.uid()
            OR id IN (
                SELECT project_id FROM project_team_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- Policy: Users can update their own share links
CREATE POLICY project_shares_update_policy ON project_shares
    FOR UPDATE
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Policy: Users can delete their own share links
CREATE POLICY project_shares_delete_policy ON project_shares
    FOR DELETE
    USING (created_by = auth.uid());

-- Enable RLS on share_access_logs table
ALTER TABLE share_access_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view access logs for their share links
CREATE POLICY share_access_logs_select_policy ON share_access_logs
    FOR SELECT
    USING (
        share_id IN (
            SELECT id FROM project_shares 
            WHERE created_by = auth.uid()
        )
    );

-- Policy: System can insert access logs (no user restriction)
CREATE POLICY share_access_logs_insert_policy ON share_access_logs
    FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE project_shares IS 'Secure shareable URLs for external project access with granular permissions and expiration';
COMMENT ON TABLE share_access_logs IS 'Detailed access tracking for share links with security monitoring';

COMMENT ON COLUMN project_shares.token IS 'Cryptographically secure 64-character URL-safe token';
COMMENT ON COLUMN project_shares.permission_level IS 'Access level: view_only (basic info), limited_data (milestones/timeline), full_project (all except financials)';
COMMENT ON COLUMN project_shares.expires_at IS 'Automatic expiration timestamp for time-limited access';
COMMENT ON COLUMN project_shares.custom_message IS 'Optional custom message displayed to external users';

COMMENT ON COLUMN share_access_logs.accessed_sections IS 'JSON array of project sections viewed during session';
COMMENT ON COLUMN share_access_logs.session_duration IS 'Session duration in seconds';
COMMENT ON COLUMN share_access_logs.suspicious_reasons IS 'JSON array of reasons if access flagged as suspicious';

COMMENT ON FUNCTION deactivate_expired_share_links() IS 'Automatically deactivates share links past their expiration date';
COMMENT ON FUNCTION validate_share_link_access(VARCHAR) IS 'Validates share link token and returns access details or error';
COMMENT ON FUNCTION log_share_access(UUID, INET, TEXT, VARCHAR, VARCHAR) IS 'Logs share link access and updates usage statistics';
COMMENT ON FUNCTION detect_suspicious_access(UUID, INET) IS 'Detects suspicious access patterns based on frequency, IPs, and geography';
COMMENT ON FUNCTION get_share_analytics(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Returns comprehensive analytics for a share link';

COMMENT ON VIEW v_active_share_links IS 'Active share links with project and creator information';
COMMENT ON VIEW v_share_link_usage IS 'Usage statistics summary for all share links';
COMMENT ON VIEW v_suspicious_access_patterns IS 'Share link accesses flagged as suspicious';

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Update table statistics for query optimization
ANALYZE project_shares;
ANALYZE share_access_logs;

COMMIT;
