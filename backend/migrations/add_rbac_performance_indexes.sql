-- RBAC Performance Optimization Indexes
-- Requirements: 8.4 - Efficient database queries with proper indexing

-- Index for user_roles lookups by user_id and active status
-- This is the most common query pattern for permission checking
CREATE INDEX IF NOT EXISTS idx_user_roles_user_active 
ON user_roles(user_id, is_active) 
WHERE is_active = true;

-- Index for scoped role assignments
-- Used when checking permissions within a specific context (project, portfolio, org)
CREATE INDEX IF NOT EXISTS idx_user_roles_scope 
ON user_roles(user_id, scope_type, scope_id) 
WHERE is_active = true;

-- Index for expired role cleanup and validation
-- Used to filter out expired role assignments
CREATE INDEX IF NOT EXISTS idx_user_roles_expiry 
ON user_roles(expires_at) 
WHERE expires_at IS NOT NULL;

-- Index for role lookups by active status
-- Used when loading role data
CREATE INDEX IF NOT EXISTS idx_roles_active 
ON roles(is_active) 
WHERE is_active = true;

-- Index for role lookups by name
-- Used for role name-based queries
CREATE INDEX IF NOT EXISTS idx_roles_name 
ON roles(name);

-- Composite index for efficient role assignment queries
-- Covers the most common query pattern: user + active + role data
CREATE INDEX IF NOT EXISTS idx_user_roles_composite 
ON user_roles(user_id, role_id, is_active) 
WHERE is_active = true;

-- Index for permission cache table lookups
-- Used for cache hit/miss checks
CREATE INDEX IF NOT EXISTS idx_permission_cache_lookup 
ON permission_cache(user_id, permission, context_type, context_id) 
WHERE expires_at > NOW();

-- Index for permission cache expiry cleanup
-- Used to remove expired cache entries
CREATE INDEX IF NOT EXISTS idx_permission_cache_expiry 
ON permission_cache(expires_at);

-- Add comments for documentation
COMMENT ON INDEX idx_user_roles_user_active IS 'Optimizes user permission lookups by user_id and active status';
COMMENT ON INDEX idx_user_roles_scope IS 'Optimizes scoped permission checks (project, portfolio, organization)';
COMMENT ON INDEX idx_user_roles_expiry IS 'Optimizes expired role assignment cleanup';
COMMENT ON INDEX idx_roles_active IS 'Optimizes active role lookups';
COMMENT ON INDEX idx_roles_name IS 'Optimizes role lookups by name';
COMMENT ON INDEX idx_user_roles_composite IS 'Optimizes composite user role queries';
COMMENT ON INDEX idx_permission_cache_lookup IS 'Optimizes permission cache lookups';
COMMENT ON INDEX idx_permission_cache_expiry IS 'Optimizes permission cache cleanup';

-- Analyze tables to update statistics for query planner
ANALYZE user_roles;
ANALYZE roles;
ANALYZE permission_cache;
