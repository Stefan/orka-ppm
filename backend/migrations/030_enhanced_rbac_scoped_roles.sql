-- Enhanced RBAC System Migration - Scoped Role Assignments
-- This migration adds scope support to the user_roles table for context-aware permission checking
-- Requirements: 1.1, 1.2, 5.4, 7.1

-- Add scope columns to user_roles table if they don't exist
DO $$ 
BEGIN
    -- Add scope_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_roles' AND column_name = 'scope_type'
    ) THEN
        ALTER TABLE user_roles ADD COLUMN scope_type VARCHAR(50);
        COMMENT ON COLUMN user_roles.scope_type IS 'Type of scope: project, portfolio, organization, or NULL for global';
    END IF;

    -- Add scope_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_roles' AND column_name = 'scope_id'
    ) THEN
        ALTER TABLE user_roles ADD COLUMN scope_id UUID;
        COMMENT ON COLUMN user_roles.scope_id IS 'ID of the scope entity (project_id, portfolio_id, or organization_id)';
    END IF;

    -- Add assigned_by column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_roles' AND column_name = 'assigned_by'
    ) THEN
        ALTER TABLE user_roles ADD COLUMN assigned_by UUID REFERENCES auth.users(id);
        COMMENT ON COLUMN user_roles.assigned_by IS 'User ID of the person who made this assignment';
    END IF;

    -- Add expires_at column for time-based permissions
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_roles' AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE user_roles ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
        COMMENT ON COLUMN user_roles.expires_at IS 'Optional expiration timestamp for time-based permissions';
    END IF;

    -- Add is_active column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_roles' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE user_roles ADD COLUMN is_active BOOLEAN DEFAULT true;
        COMMENT ON COLUMN user_roles.is_active IS 'Whether this role assignment is currently active';
    END IF;
END $$;

-- Create indexes for scoped role lookups
CREATE INDEX IF NOT EXISTS idx_user_roles_scope 
    ON user_roles(user_id, scope_type, scope_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_active 
    ON user_roles(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_user_roles_scope_type 
    ON user_roles(scope_type) WHERE scope_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_expires 
    ON user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- Create a composite unique constraint for scoped assignments
-- This allows the same user to have the same role in different scopes
DO $$
BEGIN
    -- Drop the old unique constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_roles_user_id_role_id_key'
    ) THEN
        ALTER TABLE user_roles DROP CONSTRAINT user_roles_user_id_role_id_key;
    END IF;
END $$;

-- Create new unique constraint that includes scope
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_unique_scoped 
    ON user_roles(user_id, role_id, COALESCE(scope_type, ''), COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Create permission_cache table for performance optimization
CREATE TABLE IF NOT EXISTS permission_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL,
    context_type VARCHAR(50),
    context_id UUID,
    granted BOOLEAN NOT NULL,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Create indexes for permission cache lookups
CREATE INDEX IF NOT EXISTS idx_permission_cache_lookup 
    ON permission_cache(user_id, permission, context_type, context_id);

CREATE INDEX IF NOT EXISTS idx_permission_cache_expiry 
    ON permission_cache(expires_at);

-- Enable RLS on permission_cache
ALTER TABLE permission_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for permission_cache
CREATE POLICY "Users can read own permission cache" ON permission_cache
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "System can manage permission cache" ON permission_cache
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Create function to clean up expired permission cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_permission_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM permission_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create function to invalidate user's permission cache
CREATE OR REPLACE FUNCTION invalidate_user_permission_cache(p_user_id UUID)
RETURNS void AS $$
BEGIN
    DELETE FROM permission_cache WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to invalidate cache when user_roles changes
CREATE OR REPLACE FUNCTION trigger_invalidate_permission_cache()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM invalidate_user_permission_cache(OLD.user_id);
        RETURN OLD;
    ELSE
        PERFORM invalidate_user_permission_cache(NEW.user_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_roles_cache_invalidation ON user_roles;
CREATE TRIGGER user_roles_cache_invalidation
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_invalidate_permission_cache();

-- Create role_assignment_audit table for tracking role changes
CREATE TABLE IF NOT EXISTS role_assignment_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_role_id UUID,
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    scope_type VARCHAR(50),
    scope_id UUID,
    action VARCHAR(20) NOT NULL, -- 'assigned', 'revoked', 'expired', 'modified'
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_values JSONB,
    new_values JSONB,
    reason TEXT
);

-- Create indexes for audit table
CREATE INDEX IF NOT EXISTS idx_role_assignment_audit_user 
    ON role_assignment_audit(user_id);

CREATE INDEX IF NOT EXISTS idx_role_assignment_audit_performed_at 
    ON role_assignment_audit(performed_at);

CREATE INDEX IF NOT EXISTS idx_role_assignment_audit_action 
    ON role_assignment_audit(action);

-- Enable RLS on audit table
ALTER TABLE role_assignment_audit ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for audit table
CREATE POLICY "Admins can read role assignment audit" ON role_assignment_audit
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "System can insert role assignment audit" ON role_assignment_audit
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create trigger to audit role assignment changes
CREATE OR REPLACE FUNCTION trigger_audit_role_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO role_assignment_audit (
            user_role_id, user_id, role_id, scope_type, scope_id,
            action, performed_by, new_values
        ) VALUES (
            NEW.id, NEW.user_id, NEW.role_id, NEW.scope_type, NEW.scope_id,
            'assigned', NEW.assigned_by,
            jsonb_build_object(
                'is_active', NEW.is_active,
                'expires_at', NEW.expires_at
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO role_assignment_audit (
            user_role_id, user_id, role_id, scope_type, scope_id,
            action, performed_by, old_values, new_values
        ) VALUES (
            NEW.id, NEW.user_id, NEW.role_id, NEW.scope_type, NEW.scope_id,
            CASE 
                WHEN OLD.is_active = true AND NEW.is_active = false THEN 'revoked'
                ELSE 'modified'
            END,
            NEW.assigned_by,
            jsonb_build_object(
                'is_active', OLD.is_active,
                'expires_at', OLD.expires_at
            ),
            jsonb_build_object(
                'is_active', NEW.is_active,
                'expires_at', NEW.expires_at
            )
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO role_assignment_audit (
            user_role_id, user_id, role_id, scope_type, scope_id,
            action, old_values
        ) VALUES (
            OLD.id, OLD.user_id, OLD.role_id, OLD.scope_type, OLD.scope_id,
            'revoked',
            jsonb_build_object(
                'is_active', OLD.is_active,
                'expires_at', OLD.expires_at
            )
        );
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_roles_audit ON user_roles;
CREATE TRIGGER user_roles_audit
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_audit_role_assignment();

-- Add comments for documentation
COMMENT ON TABLE permission_cache IS 'Cache for permission check results to improve performance';
COMMENT ON TABLE role_assignment_audit IS 'Audit trail for role assignment changes';
COMMENT ON FUNCTION cleanup_expired_permission_cache() IS 'Removes expired entries from permission cache';
COMMENT ON FUNCTION invalidate_user_permission_cache(UUID) IS 'Invalidates all cached permissions for a specific user';
