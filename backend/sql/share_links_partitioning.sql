-- Share Links Database Partitioning and Optimization
-- 
-- This SQL file provides database optimization strategies for large-scale
-- share link deployments, including table partitioning for access logs.
--
-- Note: Partitioning should be implemented during initial setup or during
-- a maintenance window. Consult with your DBA before applying these changes.

-- ============================================================================
-- PART 1: Access Logs Partitioning by Date
-- ============================================================================
-- For large-scale deployments with millions of access logs, partitioning
-- by date improves query performance and enables efficient archival.

-- Step 1: Rename existing table (if converting from non-partitioned)
-- ALTER TABLE share_access_logs RENAME TO share_access_logs_old;

-- Step 2: Create partitioned table
-- CREATE TABLE share_access_logs (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     share_id UUID NOT NULL REFERENCES project_shares(id) ON DELETE CASCADE,
--     accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
--     ip_address INET NOT NULL,
--     user_agent TEXT,
--     country_code VARCHAR(2),
--     city VARCHAR(100),
--     accessed_sections JSONB DEFAULT '[]',
--     session_duration INTEGER,
--     is_suspicious BOOLEAN DEFAULT false,
--     suspicious_reasons JSONB DEFAULT '[]'
-- ) PARTITION BY RANGE (accessed_at);

-- Step 3: Create monthly partitions (example for 2026)
-- CREATE TABLE share_access_logs_2026_01 PARTITION OF share_access_logs
--     FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- 
-- CREATE TABLE share_access_logs_2026_02 PARTITION OF share_access_logs
--     FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- 
-- CREATE TABLE share_access_logs_2026_03 PARTITION OF share_access_logs
--     FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
-- 
-- -- Continue for all months...

-- Step 4: Create indexes on partitioned table
-- CREATE INDEX idx_share_access_logs_share_id ON share_access_logs(share_id);
-- CREATE INDEX idx_share_access_logs_accessed_at ON share_access_logs(accessed_at);
-- CREATE INDEX idx_share_access_logs_ip_address ON share_access_logs(ip_address);
-- CREATE INDEX idx_share_access_logs_is_suspicious ON share_access_logs(is_suspicious) WHERE is_suspicious = true;

-- Step 5: Migrate data from old table (if applicable)
-- INSERT INTO share_access_logs SELECT * FROM share_access_logs_old;

-- Step 6: Drop old table after verification
-- DROP TABLE share_access_logs_old;


-- ============================================================================
-- PART 2: Optimized Indexes for Share Links
-- ============================================================================

-- Ensure all required indexes exist for optimal query performance
-- These indexes should already exist from the initial migration, but are
-- listed here for reference and verification.

-- Project shares indexes
CREATE INDEX IF NOT EXISTS idx_project_shares_token ON project_shares(token);
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_expires_at ON project_shares(expires_at);
CREATE INDEX IF NOT EXISTS idx_project_shares_created_by ON project_shares(created_by);
CREATE INDEX IF NOT EXISTS idx_project_shares_is_active ON project_shares(is_active) WHERE is_active = true;

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_project_shares_project_active 
    ON project_shares(project_id, is_active) 
    WHERE is_active = true;

-- Index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_project_shares_expired_active 
    ON project_shares(expires_at, is_active) 
    WHERE is_active = true;

-- Access logs indexes (if not using partitioning)
CREATE INDEX IF NOT EXISTS idx_share_access_logs_share_id ON share_access_logs(share_id);
CREATE INDEX IF NOT EXISTS idx_share_access_logs_accessed_at ON share_access_logs(accessed_at);
CREATE INDEX IF NOT EXISTS idx_share_access_logs_ip_address ON share_access_logs(ip_address);

-- Partial index for suspicious activity queries
CREATE INDEX IF NOT EXISTS idx_share_access_logs_suspicious 
    ON share_access_logs(share_id, accessed_at) 
    WHERE is_suspicious = true;


-- ============================================================================
-- PART 3: Automatic Partition Management Function
-- ============================================================================

-- Function to automatically create next month's partition
CREATE OR REPLACE FUNCTION create_next_month_partition()
RETURNS void AS $$
DECLARE
    next_month_start DATE;
    next_month_end DATE;
    partition_name TEXT;
BEGIN
    -- Calculate next month
    next_month_start := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    next_month_end := next_month_start + INTERVAL '1 month';
    
    -- Generate partition name
    partition_name := 'share_access_logs_' || TO_CHAR(next_month_start, 'YYYY_MM');
    
    -- Create partition if it doesn't exist
    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF share_access_logs FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        next_month_start,
        next_month_end
    );
    
    -- Create indexes on the new partition
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(share_id)', 
        partition_name || '_share_id_idx', partition_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(accessed_at)', 
        partition_name || '_accessed_at_idx', partition_name);
    
    RAISE NOTICE 'Created partition % for period % to %', 
        partition_name, next_month_start, next_month_end;
END;
$$ LANGUAGE plpgsql;

-- Schedule automatic partition creation (requires pg_cron extension)
-- SELECT cron.schedule('create-share-logs-partition', '0 0 1 * *', 'SELECT create_next_month_partition()');


-- ============================================================================
-- PART 4: Cleanup and Archival Functions
-- ============================================================================

-- Function to drop old partitions (for archival)
CREATE OR REPLACE FUNCTION drop_old_partition(months_to_keep INTEGER DEFAULT 12)
RETURNS void AS $$
DECLARE
    cutoff_date DATE;
    partition_name TEXT;
BEGIN
    -- Calculate cutoff date
    cutoff_date := DATE_TRUNC('month', CURRENT_DATE - (months_to_keep || ' months')::INTERVAL);
    
    -- Generate partition name
    partition_name := 'share_access_logs_' || TO_CHAR(cutoff_date, 'YYYY_MM');
    
    -- Drop partition if it exists
    EXECUTE format('DROP TABLE IF EXISTS %I', partition_name);
    
    RAISE NOTICE 'Dropped partition % (older than % months)', 
        partition_name, months_to_keep;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 5: Query Optimization Views
-- ============================================================================

-- Materialized view for share link analytics (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS share_link_analytics AS
SELECT 
    ps.id AS share_id,
    ps.project_id,
    ps.permission_level,
    ps.created_at,
    ps.expires_at,
    ps.is_active,
    COUNT(sal.id) AS total_accesses,
    COUNT(DISTINCT sal.ip_address) AS unique_visitors,
    MAX(sal.accessed_at) AS last_access,
    COUNT(CASE WHEN sal.is_suspicious THEN 1 END) AS suspicious_access_count
FROM project_shares ps
LEFT JOIN share_access_logs sal ON ps.id = sal.share_id
GROUP BY ps.id, ps.project_id, ps.permission_level, ps.created_at, ps.expires_at, ps.is_active;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_share_link_analytics_project_id 
    ON share_link_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_share_link_analytics_share_id 
    ON share_link_analytics(share_id);

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_share_link_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY share_link_analytics;
    RAISE NOTICE 'Refreshed share_link_analytics materialized view';
END;
$$ LANGUAGE plpgsql;

-- Schedule periodic refresh (requires pg_cron extension)
-- SELECT cron.schedule('refresh-share-analytics', '0 */6 * * *', 'SELECT refresh_share_link_analytics()');


-- ============================================================================
-- PART 6: Performance Monitoring Queries
-- ============================================================================

-- Query to check partition sizes
-- SELECT 
--     schemaname,
--     tablename,
--     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE tablename LIKE 'share_access_logs%'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Query to check index usage
-- SELECT 
--     schemaname,
--     tablename,
--     indexname,
--     idx_scan AS index_scans,
--     idx_tup_read AS tuples_read,
--     idx_tup_fetch AS tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE tablename IN ('project_shares', 'share_access_logs')
-- ORDER BY idx_scan DESC;

-- Query to identify slow queries on share link tables
-- SELECT 
--     query,
--     calls,
--     total_time,
--     mean_time,
--     max_time
-- FROM pg_stat_statements
-- WHERE query LIKE '%project_shares%' OR query LIKE '%share_access_logs%'
-- ORDER BY mean_time DESC
-- LIMIT 10;


-- ============================================================================
-- PART 7: Vacuum and Analyze Recommendations
-- ============================================================================

-- Regular maintenance commands (should be run periodically)
-- VACUUM ANALYZE project_shares;
-- VACUUM ANALYZE share_access_logs;

-- For partitioned tables, vacuum each partition
-- VACUUM ANALYZE share_access_logs_2026_01;
-- VACUUM ANALYZE share_access_logs_2026_02;
-- etc...


-- ============================================================================
-- NOTES
-- ============================================================================
-- 
-- 1. Partitioning Strategy:
--    - Use monthly partitions for access logs
--    - Automatically create new partitions before month end
--    - Archive/drop old partitions after retention period
--
-- 2. Index Strategy:
--    - Create indexes on frequently queried columns
--    - Use partial indexes for filtered queries
--    - Monitor index usage and remove unused indexes
--
-- 3. Maintenance:
--    - Run VACUUM ANALYZE regularly
--    - Refresh materialized views periodically
--    - Monitor partition sizes and query performance
--
-- 4. Scaling Considerations:
--    - For > 10M access logs, consider partitioning
--    - For > 100K share links, consider sharding by project_id
--    - Use connection pooling (PgBouncer) for high concurrency
--
-- 5. Backup Strategy:
--    - Backup project_shares table daily
--    - Archive old access log partitions before dropping
--    - Test restore procedures regularly
--
-- ============================================================================
