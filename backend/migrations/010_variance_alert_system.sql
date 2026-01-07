-- Migration 010: Variance Alert System
-- Add tables for variance threshold rules, alerts, and notification tracking

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Variance threshold rules table
CREATE TABLE IF NOT EXISTS variance_threshold_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  threshold_percentage DECIMAL(5,2) NOT NULL CHECK (threshold_percentage >= -100 AND threshold_percentage <= 1000),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  enabled BOOLEAN DEFAULT true,
  project_filter JSONB DEFAULT '{}',
  notification_channels JSONB DEFAULT '["email"]',
  recipients JSONB DEFAULT '[]',
  cooldown_hours INTEGER DEFAULT 24 CHECK (cooldown_hours >= 0 AND cooldown_hours <= 8760),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Variance alerts table
CREATE TABLE IF NOT EXISTS variance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES variance_threshold_rules(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  wbs_element TEXT NOT NULL,
  variance_amount DECIMAL(15,2) NOT NULL,
  variance_percentage DECIMAL(5,2) NOT NULL,
  commitment_amount DECIMAL(15,2) NOT NULL,
  actual_amount DECIMAL(15,2) NOT NULL,
  currency_code VARCHAR(3) DEFAULT 'USD',
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  recipients JSONB DEFAULT '[]',
  notification_channels JSONB DEFAULT '[]',
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification deliveries table for tracking notification status
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES variance_alerts(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'slack', 'webhook', 'in_app')),
  recipient TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- In-app notifications table (general purpose)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_variance_threshold_rules_org ON variance_threshold_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_variance_threshold_rules_enabled ON variance_threshold_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_variance_threshold_rules_threshold ON variance_threshold_rules(threshold_percentage);

CREATE INDEX IF NOT EXISTS idx_variance_alerts_rule ON variance_alerts(rule_id);
CREATE INDEX IF NOT EXISTS idx_variance_alerts_project ON variance_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_variance_alerts_wbs ON variance_alerts(wbs_element);
CREATE INDEX IF NOT EXISTS idx_variance_alerts_status ON variance_alerts(status);
CREATE INDEX IF NOT EXISTS idx_variance_alerts_severity ON variance_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_variance_alerts_org ON variance_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_variance_alerts_created ON variance_alerts(created_at);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_alert ON notification_deliveries(alert_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_channel ON notification_deliveries(channel);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- Row Level Security (RLS) policies
ALTER TABLE variance_threshold_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE variance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for variance_threshold_rules
CREATE POLICY "Users can view threshold rules for their organization" ON variance_threshold_rules
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage threshold rules" ON variance_threshold_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'financial_manager')
      AND ur.organization_id = variance_threshold_rules.organization_id
    )
  );

-- RLS policies for variance_alerts
CREATE POLICY "Users can view alerts for their organization" ON variance_alerts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can acknowledge/resolve alerts" ON variance_alerts
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

-- RLS policies for notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_variance_threshold_rules_updated_at 
  BEFORE UPDATE ON variance_threshold_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variance_alerts_updated_at 
  BEFORE UPDATE ON variance_alerts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically mark notifications as read when read_at is set
CREATE OR REPLACE FUNCTION mark_notification_read()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.read_at IS NOT NULL AND OLD.read_at IS NULL THEN
        NEW.read = true;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER mark_notification_read_trigger
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION mark_notification_read();

-- Function to clean up old notifications (can be called by scheduled job)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete notifications older than 90 days or expired notifications
    DELETE FROM notifications 
    WHERE (created_at < NOW() - INTERVAL '90 days')
       OR (expires_at IS NOT NULL AND expires_at < NOW());
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Function to get alert statistics
CREATE OR REPLACE FUNCTION get_alert_statistics(org_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_alerts BIGINT,
    active_alerts BIGINT,
    acknowledged_alerts BIGINT,
    resolved_alerts BIGINT,
    critical_alerts BIGINT,
    high_alerts BIGINT,
    medium_alerts BIGINT,
    low_alerts BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_alerts,
        COUNT(*) FILTER (WHERE status = 'active') as active_alerts,
        COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged_alerts,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_alerts,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_alerts,
        COUNT(*) FILTER (WHERE severity = 'high') as high_alerts,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium_alerts,
        COUNT(*) FILTER (WHERE severity = 'low') as low_alerts
    FROM variance_alerts
    WHERE (org_id IS NULL OR organization_id = org_id);
END;
$$ language 'plpgsql';

-- Comments for documentation
COMMENT ON TABLE variance_threshold_rules IS 'Configurable rules for variance alert generation';
COMMENT ON TABLE variance_alerts IS 'Generated variance alerts based on threshold rules';
COMMENT ON TABLE notification_deliveries IS 'Tracking table for notification delivery status';
COMMENT ON TABLE notifications IS 'General purpose in-app notifications';

COMMENT ON COLUMN variance_threshold_rules.threshold_percentage IS 'Variance percentage threshold (e.g., 80.0 for 80%)';
COMMENT ON COLUMN variance_threshold_rules.cooldown_hours IS 'Minimum hours between alerts for same project/WBS';
COMMENT ON COLUMN variance_threshold_rules.project_filter IS 'JSON filter criteria for projects';

COMMENT ON COLUMN variance_alerts.variance_percentage IS 'Actual variance percentage that triggered the alert';
COMMENT ON COLUMN variance_alerts.details IS 'Additional alert details and metadata';

COMMENT ON FUNCTION cleanup_old_notifications() IS 'Cleanup function for old notifications - call from scheduled job';
COMMENT ON FUNCTION get_alert_statistics(UUID) IS 'Get alert statistics for an organization';