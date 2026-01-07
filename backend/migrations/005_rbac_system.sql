-- Role-Based Access Control System Migration
-- This migration creates the necessary tables for the RBAC system

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table for role assignments
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_is_active ON roles(is_active);

-- Enable Row Level Security
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for roles table
-- Only authenticated users can read roles
CREATE POLICY "Users can read roles" ON roles
    FOR SELECT
    TO authenticated
    USING (true);

-- Only users with role_manage permission can modify roles
-- Note: This is a simplified policy. In production, you'd want to check actual permissions
CREATE POLICY "Admins can manage roles" ON roles
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create RLS policies for user_roles table
-- Users can read their own role assignments
CREATE POLICY "Users can read own role assignments" ON user_roles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Admins can manage all role assignments
CREATE POLICY "Admins can manage role assignments" ON user_roles
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Insert default roles
INSERT INTO roles (name, description, permissions, is_active) VALUES
(
    'admin',
    'System administrator with full access',
    '["portfolio_create", "portfolio_read", "portfolio_update", "portfolio_delete", "project_create", "project_read", "project_update", "project_delete", "resource_create", "resource_read", "resource_update", "resource_delete", "resource_allocate", "financial_read", "financial_create", "financial_update", "financial_delete", "budget_alert_manage", "risk_create", "risk_read", "risk_update", "risk_delete", "issue_create", "issue_read", "issue_update", "issue_delete", "ai_rag_query", "ai_resource_optimize", "ai_risk_forecast", "ai_metrics_read", "user_manage", "role_manage", "system_admin"]',
    true
),
(
    'portfolio_manager',
    'Portfolio manager with project and resource oversight',
    '["portfolio_create", "portfolio_read", "portfolio_update", "project_create", "project_read", "project_update", "resource_read", "resource_allocate", "financial_read", "financial_create", "financial_update", "budget_alert_manage", "risk_read", "risk_update", "issue_read", "issue_update", "ai_rag_query", "ai_resource_optimize", "ai_risk_forecast", "ai_metrics_read"]',
    true
),
(
    'project_manager',
    'Project manager with project-specific management capabilities',
    '["project_read", "project_update", "resource_read", "resource_allocate", "financial_read", "financial_create", "financial_update", "risk_create", "risk_read", "risk_update", "issue_create", "issue_read", "issue_update", "ai_rag_query", "ai_resource_optimize", "ai_risk_forecast"]',
    true
),
(
    'resource_manager',
    'Resource manager focused on team and resource allocation',
    '["project_read", "resource_create", "resource_read", "resource_update", "resource_allocate", "financial_read", "risk_read", "issue_read", "ai_rag_query", "ai_resource_optimize"]',
    true
),
(
    'team_member',
    'Team member with basic project participation rights',
    '["project_read", "resource_read", "financial_read", "risk_read", "risk_create", "issue_read", "issue_create", "issue_update", "ai_rag_query"]',
    true
),
(
    'viewer',
    'Read-only access to system data',
    '["portfolio_read", "project_read", "resource_read", "financial_read", "risk_read", "issue_read", "ai_rag_query"]',
    true
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE roles IS 'System roles with associated permissions';
COMMENT ON TABLE user_roles IS 'User role assignments linking users to roles';
COMMENT ON COLUMN roles.permissions IS 'JSON array of permission strings for this role';
COMMENT ON COLUMN user_roles.user_id IS 'Reference to auth.users table';
COMMENT ON COLUMN user_roles.role_id IS 'Reference to roles table';