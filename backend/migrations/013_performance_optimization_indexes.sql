-- Migration 013: Performance Optimization and Additional Indexes
-- Add additional indexes for query optimization and pagination support

-- Additional indexes for simulation results (performance optimization)
CREATE INDEX IF NOT EXISTS idx_simulation_results_created_at_desc ON simulation_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simulation_results_project_created ON simulation_results(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_simulation_results_execution_time ON simulation_results(execution_time_ms) WHERE execution_time_ms IS NOT NULL;

-- Partial index for active cached simulations
CREATE INDEX IF NOT EXISTS idx_simulation_results_active_cache ON simulation_results(project_id, simulation_type, cache_expires_at) 
  WHERE is_cached = true AND cache_expires_at > NOW();

-- Additional indexes for PO breakdowns (hierarchical query optimization)
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_project_parent_active ON po_breakdowns(project_id, parent_breakdown_id, is_active) 
  WHERE is_active = true;

-- GIN index for JSONB custom_fields searching
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_custom_fields_gin ON po_breakdowns USING GIN (custom_fields);
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_tags_gin ON po_breakdowns USING GIN (tags);

-- Index for cost calculations
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_amounts ON po_breakdowns(project_id, planned_amount, actual_amount) 
  WHERE is_active = true;

-- Additional indexes for change requests (filtering and sorting)
CREATE INDEX IF NOT EXISTS idx_change_requests_created_at_desc ON change_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_requests_project_created ON change_requests(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_requests_priority_status ON change_requests(priority, status);

-- Index for change request impact queries
CREATE INDEX IF NOT EXISTS idx_change_requests_cost_impact ON change_requests(estimated_cost_impact) 
  WHERE estimated_cost_impact IS NOT NULL;

-- Additional indexes for scenario analyses (comparison queries)
CREATE INDEX IF NOT EXISTS idx_scenario_analyses_created_at_desc ON scenario_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scenario_analyses_project_created ON scenario_analyses(project_id, created_at DESC);

-- GIN indexes for JSONB fields in scenario analyses
CREATE INDEX IF NOT EXISTS idx_scenario_analyses_parameter_changes_gin ON scenario_analyses USING GIN (parameter_changes);
CREATE INDEX IF NOT EXISTS idx_scenario_analyses_impact_results_gin ON scenario_analyses USING GIN (impact_results);

-- Additional indexes for generated reports (status tracking)
CREATE INDEX IF NOT EXISTS idx_generated_reports_created_at_desc ON generated_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_reports_project_status_created ON generated_reports(project_id, generation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_reports_completed_at ON generated_reports(completed_at DESC) 
  WHERE completed_at IS NOT NULL;

-- Index for report generation performance tracking
CREATE INDEX IF NOT EXISTS idx_generated_reports_generation_time ON generated_reports(generation_time_ms) 
  WHERE generation_time_ms IS NOT NULL;

-- Additional indexes for shareable URLs (access patterns)
CREATE INDEX IF NOT EXISTS idx_shareable_urls_project_active ON shareable_urls(project_id, is_revoked, expires_at) 
  WHERE NOT is_revoked AND expires_at > NOW();

-- Index for access log queries
CREATE INDEX IF NOT EXISTS idx_shareable_url_access_log_accessed_at_desc ON shareable_url_access_log(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_shareable_url_access_log_url_accessed ON shareable_url_access_log(shareable_url_id, accessed_at DESC);

-- Composite indexes for common join patterns
CREATE INDEX IF NOT EXISTS idx_change_po_links_composite ON change_request_po_links(change_request_id, po_breakdown_id, impact_type);

-- Index for report template searches
CREATE INDEX IF NOT EXISTS idx_report_templates_type_active ON report_templates(template_type, is_active) 
  WHERE is_active = true;

-- GIN indexes for JSONB fields in report templates
CREATE INDEX IF NOT EXISTS idx_report_templates_data_mappings_gin ON report_templates USING GIN (data_mappings);
CREATE INDEX IF NOT EXISTS idx_report_templates_tags_gin ON report_templates USING GIN (tags);

-- Materialized view for PO breakdown aggregations (performance optimization)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_po_breakdown_aggregates AS
SELECT 
    project_id,
    breakdown_type,
    COUNT(*) as breakdown_count,
    SUM(planned_amount) as total_planned,
    SUM(committed_amount) as total_committed,
    SUM(actual_amount) as total_actual,
    SUM(remaining_amount) as total_remaining,
    AVG(planned_amount) as avg_planned,
    MAX(hierarchy_level) as max_hierarchy_level,
    COUNT(DISTINCT parent_breakdown_id) as unique_parents
FROM po_breakdowns
WHERE is_active = true
GROUP BY project_id, breakdown_type;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_po_breakdown_aggregates_pk ON mv_po_breakdown_aggregates(project_id, breakdown_type);

-- Materialized view for change request statistics (performance optimization)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_change_request_stats AS
SELECT 
    project_id,
    status,
    change_type,
    COUNT(*) as request_count,
    SUM(estimated_cost_impact) as total_estimated_cost,
    SUM(actual_cost_impact) as total_actual_cost,
    SUM(estimated_schedule_impact) as total_estimated_schedule,
    SUM(actual_schedule_impact) as total_actual_schedule,
    AVG(estimated_cost_impact) as avg_estimated_cost,
    MIN(created_at) as first_request_date,
    MAX(created_at) as last_request_date
FROM change_requests
GROUP BY project_id, status, change_type;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_change_request_stats_pk ON mv_change_request_stats(project_id, status, change_type);

-- Materialized view for simulation performance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_simulation_performance AS
SELECT 
    project_id,
    simulation_type,
    COUNT(*) as simulation_count,
    AVG(execution_time_ms) as avg_execution_time,
    MIN(execution_time_ms) as min_execution_time,
    MAX(execution_time_ms) as max_execution_time,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms) as median_execution_time,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY execution_time_ms) as p90_execution_time,
    AVG(iterations_completed) as avg_iterations,
    MAX(created_at) as last_simulation_date
FROM simulation_results
WHERE execution_time_ms IS NOT NULL
GROUP BY project_id, simulation_type;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_simulation_performance_pk ON mv_simulation_performance(project_id, simulation_type);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_performance_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_po_breakdown_aggregates;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_change_request_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_simulation_performance;
END;
$$ LANGUAGE plpgsql;

-- Function for optimized PO breakdown hierarchy query with pagination
CREATE OR REPLACE FUNCTION get_po_breakdown_hierarchy_paginated(
    proj_id UUID,
    parent_id UUID DEFAULT NULL,
    page_size INTEGER DEFAULT 50,
    page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    code VARCHAR,
    hierarchy_level INTEGER,
    parent_breakdown_id UUID,
    planned_amount DECIMAL,
    committed_amount DECIMAL,
    actual_amount DECIMAL,
    remaining_amount DECIMAL,
    breakdown_type po_breakdown_type,
    has_children BOOLEAN,
    child_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pb.id,
        pb.name,
        pb.code,
        pb.hierarchy_level,
        pb.parent_breakdown_id,
        pb.planned_amount,
        pb.committed_amount,
        pb.actual_amount,
        pb.remaining_amount,
        pb.breakdown_type,
        EXISTS(
            SELECT 1 FROM po_breakdowns child 
            WHERE child.parent_breakdown_id = pb.id 
            AND child.is_active = true
        ) as has_children,
        (
            SELECT COUNT(*) FROM po_breakdowns child 
            WHERE child.parent_breakdown_id = pb.id 
            AND child.is_active = true
        ) as child_count
    FROM po_breakdowns pb
    WHERE pb.project_id = proj_id
    AND pb.is_active = true
    AND (parent_id IS NULL AND pb.parent_breakdown_id IS NULL OR pb.parent_breakdown_id = parent_id)
    ORDER BY pb.hierarchy_level, pb.name
    LIMIT page_size
    OFFSET page_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function for optimized change request listing with pagination
CREATE OR REPLACE FUNCTION get_change_requests_paginated(
    proj_id UUID DEFAULT NULL,
    status_filter change_request_status DEFAULT NULL,
    type_filter change_request_type DEFAULT NULL,
    page_size INTEGER DEFAULT 50,
    page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    change_number VARCHAR,
    title VARCHAR,
    change_type change_request_type,
    status change_request_status,
    priority VARCHAR,
    estimated_cost_impact DECIMAL,
    estimated_schedule_impact INTEGER,
    requested_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    po_link_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cr.id,
        cr.change_number,
        cr.title,
        cr.change_type,
        cr.status,
        cr.priority,
        cr.estimated_cost_impact,
        cr.estimated_schedule_impact,
        cr.requested_by,
        cr.created_at,
        (
            SELECT COUNT(*) FROM change_request_po_links 
            WHERE change_request_id = cr.id
        ) as po_link_count
    FROM change_requests cr
    WHERE (proj_id IS NULL OR cr.project_id = proj_id)
    AND (status_filter IS NULL OR cr.status = status_filter)
    AND (type_filter IS NULL OR cr.change_type = type_filter)
    ORDER BY cr.created_at DESC
    LIMIT page_size
    OFFSET page_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function for optimized simulation results listing with pagination
CREATE OR REPLACE FUNCTION get_simulation_results_paginated(
    proj_id UUID DEFAULT NULL,
    sim_type simulation_type DEFAULT NULL,
    page_size INTEGER DEFAULT 50,
    page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    project_id UUID,
    simulation_type simulation_type,
    name VARCHAR,
    execution_time_ms INTEGER,
    iterations_completed INTEGER,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    is_cached BOOLEAN,
    cache_expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sr.id,
        sr.project_id,
        sr.simulation_type,
        sr.name,
        sr.execution_time_ms,
        sr.iterations_completed,
        sr.created_by,
        sr.created_at,
        sr.is_cached,
        sr.cache_expires_at
    FROM simulation_results sr
    WHERE (proj_id IS NULL OR sr.project_id = proj_id)
    AND (sim_type IS NULL OR sr.simulation_type = sim_type)
    ORDER BY sr.created_at DESC
    LIMIT page_size
    OFFSET page_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to analyze query performance for PO breakdowns
CREATE OR REPLACE FUNCTION analyze_po_breakdown_query_performance(proj_id UUID)
RETURNS TABLE (
    total_breakdowns BIGINT,
    max_hierarchy_depth INTEGER,
    avg_children_per_parent NUMERIC,
    total_planned_amount NUMERIC,
    query_complexity_score NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_breakdowns,
        MAX(hierarchy_level) as max_hierarchy_depth,
        AVG(child_count)::NUMERIC as avg_children_per_parent,
        SUM(planned_amount)::NUMERIC as total_planned_amount,
        (COUNT(*) * MAX(hierarchy_level))::NUMERIC as query_complexity_score
    FROM (
        SELECT 
            pb.hierarchy_level,
            pb.planned_amount,
            (
                SELECT COUNT(*) FROM po_breakdowns child 
                WHERE child.parent_breakdown_id = pb.id 
                AND child.is_active = true
            ) as child_count
        FROM po_breakdowns pb
        WHERE pb.project_id = proj_id
        AND pb.is_active = true
    ) breakdown_stats;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add table statistics collection
CREATE OR REPLACE FUNCTION collect_table_statistics()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    total_size TEXT,
    index_size TEXT,
    toast_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname || '.' || tablename AS table_name,
        n_live_tup AS row_count,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
        pg_size_pretty(pg_indexes_size(schemaname || '.' || tablename)) AS index_size,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename) - 
                      pg_relation_size(schemaname || '.' || tablename) - 
                      pg_indexes_size(schemaname || '.' || tablename)) AS toast_size
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    AND tablename IN (
        'shareable_urls', 'simulation_results', 'scenario_analyses',
        'change_requests', 'po_breakdowns', 'change_request_po_links',
        'report_templates', 'generated_reports', 'shareable_url_access_log'
    )
    ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON MATERIALIZED VIEW mv_po_breakdown_aggregates IS 'Aggregated PO breakdown statistics for performance optimization';
COMMENT ON MATERIALIZED VIEW mv_change_request_stats IS 'Aggregated change request statistics for dashboard queries';
COMMENT ON MATERIALIZED VIEW mv_simulation_performance IS 'Simulation performance metrics for monitoring and optimization';

COMMENT ON FUNCTION refresh_performance_materialized_views() IS 'Refresh all performance-related materialized views - call from scheduled job';
COMMENT ON FUNCTION get_po_breakdown_hierarchy_paginated(UUID, UUID, INTEGER, INTEGER) IS 'Get paginated PO breakdown hierarchy for efficient loading';
COMMENT ON FUNCTION get_change_requests_paginated(UUID, change_request_status, change_request_type, INTEGER, INTEGER) IS 'Get paginated change requests with filtering';
COMMENT ON FUNCTION get_simulation_results_paginated(UUID, simulation_type, INTEGER, INTEGER) IS 'Get paginated simulation results with filtering';
COMMENT ON FUNCTION analyze_po_breakdown_query_performance(UUID) IS 'Analyze PO breakdown query complexity for optimization';
COMMENT ON FUNCTION collect_table_statistics() IS 'Collect table size and row count statistics for monitoring';

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION refresh_performance_materialized_views() TO authenticated;
GRANT EXECUTE ON FUNCTION get_po_breakdown_hierarchy_paginated(UUID, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_change_requests_paginated(UUID, change_request_status, change_request_type, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_simulation_results_paginated(UUID, simulation_type, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_po_breakdown_query_performance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION collect_table_statistics() TO authenticated;

-- Grant select on materialized views
GRANT SELECT ON mv_po_breakdown_aggregates TO authenticated;
GRANT SELECT ON mv_change_request_stats TO authenticated;
GRANT SELECT ON mv_simulation_performance TO authenticated;
