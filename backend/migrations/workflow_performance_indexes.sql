-- Workflow Engine Performance Optimization Indexes
-- This migration adds indexes to improve query performance for workflow operations

-- ==================== Workflow Definitions ====================

-- Index for workflow status queries (listing active workflows)
CREATE INDEX IF NOT EXISTS idx_workflows_status 
ON workflows(status);

-- Index for workflow creation date (for sorting and filtering)
CREATE INDEX IF NOT EXISTS idx_workflows_created_at 
ON workflows(created_at DESC);

-- Composite index for status + created_at (common query pattern)
CREATE INDEX IF NOT EXISTS idx_workflows_status_created 
ON workflows(status, created_at DESC);

-- ==================== Workflow Instances ====================

-- Index for workflow_id lookups (finding all instances of a workflow)
CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow_id 
ON workflow_instances(workflow_id);

-- Index for entity lookups (finding workflow for specific entity)
CREATE INDEX IF NOT EXISTS idx_workflow_instances_entity 
ON workflow_instances(entity_type, entity_id);

-- Index for project_id lookups (finding workflows for a project)
CREATE INDEX IF NOT EXISTS idx_workflow_instances_project_id 
ON workflow_instances(project_id) 
WHERE project_id IS NOT NULL;

-- Index for status queries (finding active/pending workflows)
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status 
ON workflow_instances(status);

-- Index for started_by (finding workflows initiated by user)
CREATE INDEX IF NOT EXISTS idx_workflow_instances_started_by 
ON workflow_instances(started_by);

-- Composite index for status + created_at (common query pattern)
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status_created 
ON workflow_instances(status, created_at DESC);

-- Composite index for workflow_id + status (finding active instances of a workflow)
CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow_status 
ON workflow_instances(workflow_id, status);

-- Index for started_at (for time-based queries and sorting)
CREATE INDEX IF NOT EXISTS idx_workflow_instances_started_at 
ON workflow_instances(started_at DESC);

-- ==================== Workflow Approvals ====================

-- Index for workflow_instance_id lookups (finding all approvals for an instance)
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_instance_id 
ON workflow_approvals(workflow_instance_id);

-- Index for approver_id lookups (finding all approvals for a user)
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_approver_id 
ON workflow_approvals(approver_id);

-- Index for status queries (finding pending approvals)
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_status 
ON workflow_approvals(status);

-- Composite index for approver + status (finding pending approvals for user)
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_approver_status 
ON workflow_approvals(approver_id, status);

-- Composite index for instance + step (finding approvals for specific step)
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_instance_step 
ON workflow_approvals(workflow_instance_id, step_number);

-- Index for expires_at (for finding expired approvals)
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_expires_at 
ON workflow_approvals(expires_at) 
WHERE expires_at IS NOT NULL;

-- Composite index for status + expires_at (finding pending approvals near expiry)
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_status_expires 
ON workflow_approvals(status, expires_at) 
WHERE expires_at IS NOT NULL;

-- Index for created_at (for sorting and time-based queries)
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_created_at 
ON workflow_approvals(created_at DESC);

-- Composite index for approver + status + created_at (optimized pending approvals query)
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_approver_status_created 
ON workflow_approvals(approver_id, status, created_at DESC);

-- ==================== Performance Notes ====================

-- These indexes are designed to optimize the following common query patterns:
-- 1. Finding pending approvals for a user (approver_id + status + created_at)
-- 2. Finding all approvals for a workflow instance (workflow_instance_id)
-- 3. Finding workflow instances by status (status + created_at)
-- 4. Finding workflow instances for an entity (entity_type + entity_id)
-- 5. Finding expired approvals (status + expires_at)
-- 6. Finding workflows initiated by a user (started_by)
-- 7. Finding active instances of a workflow (workflow_id + status)

-- Index maintenance:
-- - PostgreSQL automatically maintains these indexes
-- - Consider running ANALYZE after bulk data operations
-- - Monitor index usage with pg_stat_user_indexes
-- - Remove unused indexes if they impact write performance

-- To check index usage:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

-- To check table statistics:
-- SELECT schemaname, tablename, n_live_tup, n_dead_tup, last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
-- FROM pg_stat_user_tables
-- WHERE schemaname = 'public';
