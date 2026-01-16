-- Feature flags table for gradual rollout and user-based access control
-- Requirements: 10.6

CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'disabled',
    rollout_strategy VARCHAR(50) NOT NULL DEFAULT 'all_users',
    rollout_percentage INTEGER CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    allowed_user_ids UUID[],
    allowed_roles TEXT[],
    metadata JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_status ON feature_flags(status);
CREATE INDEX IF NOT EXISTS idx_feature_flags_created_by ON feature_flags(created_by);

-- Create access log table for audit purposes
CREATE TABLE IF NOT EXISTS feature_flag_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_name VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    is_enabled BOOLEAN NOT NULL,
    reason TEXT NOT NULL,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Create index for access log queries
CREATE INDEX IF NOT EXISTS idx_feature_flag_access_log_feature ON feature_flag_access_log(feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_flag_access_log_user ON feature_flag_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_access_log_accessed_at ON feature_flag_access_log(accessed_at);

-- Insert default feature flags for Roche Construction PPM features
INSERT INTO feature_flags (name, description, status, rollout_strategy, created_by)
VALUES 
    ('shareable_urls', 'Shareable Project URLs feature', 'enabled', 'all_users', (SELECT id FROM auth.users LIMIT 1)),
    ('monte_carlo_simulations', 'Monte Carlo Risk Simulations feature', 'enabled', 'all_users', (SELECT id FROM auth.users LIMIT 1)),
    ('what_if_scenarios', 'What-If Scenario Analysis feature', 'enabled', 'all_users', (SELECT id FROM auth.users LIMIT 1)),
    ('change_management', 'Integrated Change Management feature', 'enabled', 'all_users', (SELECT id FROM auth.users LIMIT 1)),
    ('po_breakdown', 'SAP PO Breakdown Management feature', 'enabled', 'all_users', (SELECT id FROM auth.users LIMIT 1)),
    ('google_suite_reports', 'Google Suite Report Generation feature', 'beta', 'role_based', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (name) DO NOTHING;

-- Update allowed_roles for google_suite_reports to require admin role
UPDATE feature_flags 
SET allowed_roles = ARRAY['admin', 'project_manager']
WHERE name = 'google_suite_reports';

COMMENT ON TABLE feature_flags IS 'Feature flags for gradual rollout and user-based access control';
COMMENT ON TABLE feature_flag_access_log IS 'Audit log for feature flag access checks';
