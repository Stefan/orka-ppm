-- Security Monitoring Tables for Shareable Project URLs
-- Requirements: 4.4, 4.5

-- Security events table for logging all suspicious activity
CREATE TABLE IF NOT EXISTS share_security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES project_shares(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    ip_address INET NOT NULL,
    threat_score INTEGER NOT NULL CHECK (threat_score >= 0 AND threat_score <= 100),
    suspicious_reasons JSONB NOT NULL DEFAULT '[]',
    country_code VARCHAR(2),
    city VARCHAR(100),
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security alerts table for admin review
CREATE TABLE IF NOT EXISTS share_security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id UUID NOT NULL REFERENCES project_shares(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    ip_address INET NOT NULL,
    threat_score INTEGER NOT NULL CHECK (threat_score >= 0 AND threat_score <= 100),
    suspicious_reasons JSONB NOT NULL DEFAULT '[]',
    country_code VARCHAR(2),
    city VARCHAR(100),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(30) NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'under_review', 'resolved', 'dismissed')),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id),
    resolution TEXT,
    action_taken VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_share_security_events_share_id ON share_security_events(share_id);
CREATE INDEX IF NOT EXISTS idx_share_security_events_detected_at ON share_security_events(detected_at);
CREATE INDEX IF NOT EXISTS idx_share_security_events_severity ON share_security_events(severity);
CREATE INDEX IF NOT EXISTS idx_share_security_events_ip_address ON share_security_events(ip_address);

CREATE INDEX IF NOT EXISTS idx_share_security_alerts_share_id ON share_security_alerts(share_id);
CREATE INDEX IF NOT EXISTS idx_share_security_alerts_status ON share_security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_share_security_alerts_severity ON share_security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_share_security_alerts_created_at ON share_security_alerts(created_at);

-- Comments for documentation
COMMENT ON TABLE share_security_events IS 'Logs all suspicious activity detected for share links';
COMMENT ON TABLE share_security_alerts IS 'Security alerts requiring admin review and action';

COMMENT ON COLUMN share_security_events.threat_score IS 'Calculated threat score from 0-100';
COMMENT ON COLUMN share_security_events.suspicious_reasons IS 'Array of reasons why activity was flagged as suspicious';
COMMENT ON COLUMN share_security_alerts.status IS 'Current status of the alert (pending_review, under_review, resolved, dismissed)';
COMMENT ON COLUMN share_security_alerts.action_taken IS 'Action taken by admin (e.g., link_suspended, ip_blocked, false_positive)';
