-- Performance Optimization Migration
-- Creates indexes, optimizations, and maintenance structures for change management system

-- =====================================================
-- PERFORMANCE INDEXES FOR CHANGE MANAGEMENT TABLES
-- =====================================================

-- Change requests performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_requests_project_status 
ON change_requests(project_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_requests_requested_by_date 
ON change_requests(requested_by, requested_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_requests_type_priority 
ON change_requests(change_type, priority);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_requests_required_by_date 
ON change_requests(required_by_date) 
WHERE required_by_date IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_change_requests_change_number_unique 
ON change_requests(change_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_requests_template_id 
ON change_requests(template_id) 
WHERE template_id IS NOT NULL;

-- Change approvals performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_approvals_approver_decision 
ON change_approvals(approver_id, decision);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_approvals_due_date 
ON change_approvals(due_date) 
WHERE due_date IS NOT NULL AND decision IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_approvals_escalation 
ON change_approvals(escalation_date) 
WHERE escalation_date IS NOT NULL AND decision IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_approvals_workflow 
ON change_approvals(change_request_id, step_number);

-- Change impacts performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_impacts_analyzed_at 
ON change_impacts(analyzed_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_impacts_critical_path 
ON change_impacts(critical_path_affected);

-- Change implementations performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_implementations_assigned 
ON change_implementations(assigned_to, progress_percentage);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_implementations_progress 
ON change_implementations(progress_percentage) 
WHERE progress_percentage < 100;

-- Change audit log performance indexes (critical for large datasets)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_audit_log_performed_at_type 
ON change_audit_log(performed_at, event_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_audit_log_change_event 
ON change_audit_log(change_request_id, event_type, performed_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_audit_log_user_date 
ON change_audit_log(performed_by, performed_at);

-- Change notifications performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_notifications_recipient_status 
ON change_notifications(recipient_id, delivery_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_notifications_sent_at 
ON change_notifications(sent_at) 
WHERE sent_at IS NOT NULL;

-- Change templates performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_templates_type_active 
ON change_templates(change_type, is_active);

-- =====================================================
-- ANALYTICS OPTIMIZATION INDEXES
-- =====================================================

-- Composite indexes for common analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_requests_analytics_date 
ON change_requests(requested_date, status, change_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_approvals_analytics 
ON change_approvals(decision_date, decision) 
WHERE decision IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_change_implementations_analytics 
ON change_implementations(created_at, progress_percentage);

-- =====================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =====================================================

-- Materialized view for change request summaries (frequently accessed aggregations)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_change_requests_summary AS
SELECT 
    project_id,
    status,
    change_type,
    priority,
    COUNT(*) as request_count,
    AVG(estimated_cost_impact) as avg_cost_impact,
    AVG(estimated_schedule_impact_days) as avg_schedule_impact,
    MIN(requested_date) as earliest_request,
    MAX(updated_at) as last_updated
FROM change_requests
GROUP BY project_id, status, change_type, priority;

-- Index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_change_requests_summary_pk
ON mv_change_requests_summary (project_id, status, change_type, priority);

-- =====================================================
-- OPTIMIZED VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for pending approvals with denormalized data
CREATE OR REPLACE VIEW v_pending_approvals AS
SELECT 
    ca.id as approval_id,
    ca.change_request_id,
    cr.change_number,
    cr.title,
    cr.priority,
    cr.estimated_cost_impact,
    ca.approver_id,
    ca.step_number,
    ca.due_date,
    ca.is_required,
    CASE 
        WHEN ca.due_date < NOW() THEN 'overdue'
        WHEN ca.due_date < NOW() + INTERVAL '24 hours' THEN 'urgent'
        ELSE 'normal'
    END as urgency_level,
    cr.requested_date,
    cr.change_type
FROM change_approvals ca
JOIN change_requests cr ON ca.change_request_id = cr.id
WHERE ca.decision IS NULL
AND ca.is_required = true;

-- View for change request analytics
CREATE OR REPLACE VIEW v_change_analytics AS
SELECT 
    cr.project_id,
    cr.change_type,
    cr.priority,
    cr.status,
    DATE_TRUNC('month', cr.requested_date) as request_month,
    COUNT(*) as total_changes,
    AVG(cr.estimated_cost_impact) as avg_estimated_cost,
    AVG(cr.actual_cost_impact) as avg_actual_cost,
    AVG(cr.estimated_schedule_impact_days) as avg_estimated_schedule,
    AVG(cr.actual_schedule_impact_days) as avg_actual_schedule,
    COUNT(CASE WHEN cr.status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN cr.status = 'rejected' THEN 1 END) as rejected_count,
    AVG(EXTRACT(EPOCH FROM (cr.updated_at - cr.requested_date))/86400) as avg_processing_days
FROM change_requests cr
GROUP BY cr.project_id, cr.change_type, cr.priority, cr.status, DATE_TRUNC('month', cr.requested_date);

-- =====================================================
-- ARCHIVE TABLES FOR DATA RETENTION
-- =====================================================

-- Archive table for old audit logs
CREATE TABLE IF NOT EXISTS change_audit_log_archive (
    LIKE change_audit_log INCLUDING ALL
);

-- Archive table for old notifications
CREATE TABLE IF NOT EXISTS change_notifications_archive (
    LIKE change_notifications INCLUDING ALL
);

-- Archive table for closed change requests (long-term storage)
CREATE TABLE IF NOT EXISTS change_requests_archive (
    LIKE change_requests INCLUDING ALL
);

-- =====================================================
-- FUNCTIONS FOR MAINTENANCE
-- =====================================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_change_management_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_change_requests_summary;
    -- Add other materialized views here as they are created
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old records
CREATE OR REPLACE FUNCTION cleanup_old_change_records(
    retention_days INTEGER DEFAULT 730
)
RETURNS TABLE(
    table_name TEXT,
    archived_count INTEGER,
    deleted_count INTEGER
) AS $$
DECLARE
    cutoff_date TIMESTAMP;
    audit_archived INTEGER := 0;
    audit_deleted INTEGER := 0;
    notif_archived INTEGER := 0;
    notif_deleted INTEGER := 0;
BEGIN
    cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
    
    -- Archive and cleanup audit logs older than retention period
    INSERT INTO change_audit_log_archive
    SELECT * FROM change_audit_log 
    WHERE performed_at < cutoff_date;
    
    GET DIAGNOSTICS audit_archived = ROW_COUNT;
    
    DELETE FROM change_audit_log 
    WHERE performed_at < cutoff_date;
    
    GET DIAGNOSTICS audit_deleted = ROW_COUNT;
    
    -- Archive and cleanup notifications older than 6 months
    INSERT INTO change_notifications_archive
    SELECT * FROM change_notifications 
    WHERE created_at < (NOW() - INTERVAL '180 days');
    
    GET DIAGNOSTICS notif_archived = ROW_COUNT;
    
    DELETE FROM change_notifications 
    WHERE created_at < (NOW() - INTERVAL '180 days');
    
    GET DIAGNOSTICS notif_deleted = ROW_COUNT;
    
    -- Return results
    RETURN QUERY VALUES 
        ('change_audit_log', audit_archived, audit_deleted),
        ('change_notifications', notif_archived, notif_deleted);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERFORMANCE MONITORING FUNCTIONS
-- =====================================================

-- Function to get table statistics
CREATE OR REPLACE FUNCTION get_change_management_table_stats()
RETURNS TABLE(
    table_name TEXT,
    row_count BIGINT,
    table_size TEXT,
    index_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.table_name::TEXT,
        t.row_count,
        pg_size_pretty(t.table_size) as table_size,
        pg_size_pretty(t.index_size) as index_size
    FROM (
        SELECT 
            'change_requests' as table_name,
            (SELECT COUNT(*) FROM change_requests) as row_count,
            pg_total_relation_size('change_requests') as table_size,
            pg_indexes_size('change_requests') as index_size
        UNION ALL
        SELECT 
            'change_approvals',
            (SELECT COUNT(*) FROM change_approvals),
            pg_total_relation_size('change_approvals'),
            pg_indexes_size('change_approvals')
        UNION ALL
        SELECT 
            'change_audit_log',
            (SELECT COUNT(*) FROM change_audit_log),
            pg_total_relation_size('change_audit_log'),
            pg_indexes_size('change_audit_log')
        UNION ALL
        SELECT 
            'change_notifications',
            (SELECT COUNT(*) FROM change_notifications),
            pg_total_relation_size('change_notifications'),
            pg_indexes_size('change_notifications')
    ) t;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCHEDULED MAINTENANCE SETUP
-- =====================================================

-- Note: The following would typically be set up as cron jobs or scheduled tasks
-- depending on your database system and infrastructure

-- Example maintenance schedule (would be implemented in your scheduler):
-- 1. Refresh materialized views: Every hour
-- 2. Update table statistics: Daily
-- 3. Cleanup old records: Weekly
-- 4. Vacuum and analyze: Daily during off-peak hours

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON MATERIALIZED VIEW mv_change_requests_summary IS 
'Materialized view for frequently accessed change request aggregations. Refresh hourly.';

COMMENT ON VIEW v_pending_approvals IS 
'Optimized view for pending approvals with urgency classification and denormalized data.';

COMMENT ON VIEW v_change_analytics IS 
'Pre-aggregated analytics data for change management reporting and dashboards.';

COMMENT ON FUNCTION refresh_change_management_views() IS 
'Refreshes all materialized views for change management system. Run hourly.';

COMMENT ON FUNCTION cleanup_old_change_records(INTEGER) IS 
'Archives and deletes old change management records based on retention policy. Run weekly.';

COMMENT ON FUNCTION get_change_management_table_stats() IS 
'Returns size and row count statistics for change management tables.';

-- =====================================================
-- INITIAL DATA REFRESH
-- =====================================================

-- Refresh the materialized view with initial data
SELECT refresh_change_management_views();

-- Update statistics for all tables
ANALYZE change_requests;
ANALYZE change_approvals;
ANALYZE change_impacts;
ANALYZE change_implementations;
ANALYZE change_audit_log;
ANALYZE change_notifications;
ANALYZE change_templates;