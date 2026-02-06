-- Migration: Set PMR analytics views to SECURITY INVOKER
-- Security: Views should run with the querying user's permissions (security_invoker = on),
-- not the view owner's (default pre-PG15 / SECURITY DEFINER behavior).
-- Requires PostgreSQL 15+. Idempotent: safe to run after 044.

-- ============================================================================
-- pmr_template_analytics
-- ============================================================================
CREATE OR REPLACE VIEW pmr_template_analytics WITH (security_invoker = on) AS
SELECT 
    t.id,
    t.name,
    t.template_type,
    t.industry_focus,
    t.usage_count,
    t.rating,
    t.is_public,
    t.created_by,
    usage_stats.reports_this_month,
    usage_stats.reports_this_year,
    usage_stats.avg_completion_score,
    COALESCE(rating_stats.total_ratings, 0) as total_ratings,
    rating_stats.avg_rating
FROM pmr_templates t
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) FILTER (WHERE DATE_TRUNC('month', generated_at) = DATE_TRUNC('month', NOW()))::INTEGER as reports_this_month,
        COUNT(*) FILTER (WHERE DATE_TRUNC('year', generated_at) = DATE_TRUNC('year', NOW()))::INTEGER as reports_this_year,
        AVG(calculate_pmr_completeness(r.id))::DECIMAL(3,2) as avg_completion_score
    FROM pmr_reports r
    WHERE r.template_id = t.id AND r.is_active = TRUE
) usage_stats ON TRUE
LEFT JOIN LATERAL (
    SELECT 1 as total_ratings, t.rating as avg_rating
    WHERE t.rating IS NOT NULL
) rating_stats ON TRUE;

COMMENT ON VIEW pmr_template_analytics IS 'Template usage analytics (security_invoker, no auth.users)';


-- ============================================================================
-- active_edit_sessions
-- ============================================================================
CREATE OR REPLACE VIEW active_edit_sessions WITH (security_invoker = on) AS
SELECT 
    es.id as session_id,
    es.report_id,
    r.title as report_title,
    r.project_id,
    p.name as project_name,
    es.user_id,
    es.session_type,
    es.active_section,
    es.started_at,
    es.last_activity,
    jsonb_array_length(COALESCE(es.chat_messages, '[]'::jsonb)) as message_count,
    jsonb_array_length(COALESCE(es.changes_made, '[]'::jsonb)) as changes_count,
    EXTRACT(EPOCH FROM (NOW() - es.last_activity))/60 as minutes_since_activity
FROM edit_sessions es
JOIN pmr_reports r ON r.id = es.report_id
JOIN projects p ON p.id = r.project_id
WHERE es.is_active = TRUE
ORDER BY es.last_activity DESC;

COMMENT ON VIEW active_edit_sessions IS 'Active editing sessions (security_invoker)';


-- ============================================================================
-- export_jobs_status
-- ============================================================================
CREATE OR REPLACE VIEW export_jobs_status WITH (security_invoker = on) AS
SELECT 
    ej.id as job_id,
    ej.report_id,
    r.title as report_title,
    r.project_id,
    p.name as project_name,
    ej.export_format,
    ej.status,
    ej.file_url,
    ej.file_size,
    ej.requested_by,
    ej.started_at,
    ej.completed_at,
    ej.error_message,
    ej.retry_count,
    CASE 
        WHEN ej.completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (ej.completed_at - ej.started_at))/60
        ELSE EXTRACT(EPOCH FROM (NOW() - ej.started_at))/60
    END as processing_time_minutes
FROM export_jobs ej
JOIN pmr_reports r ON r.id = ej.report_id
JOIN projects p ON p.id = r.project_id
ORDER BY ej.started_at DESC;

COMMENT ON VIEW export_jobs_status IS 'Export job status (security_invoker)';


-- ============================================================================
-- report_collaboration_activity (exists only if 021_enhanced_pmr_schema applied)
-- ============================================================================
DROP VIEW IF EXISTS report_collaboration_activity;

CREATE VIEW report_collaboration_activity WITH (security_invoker = on) AS
SELECT 
    r.id as report_id,
    r.title as report_title,
    r.project_id,
    p.name as project_name,
    pc.user_id,
    pc.action_type,
    pc.section_id,
    pc.timestamp,
    pc.change_description
FROM pmr_collaboration pc
JOIN pmr_reports r ON r.id = pc.report_id
JOIN projects p ON p.id = r.project_id
WHERE r.is_active = TRUE
ORDER BY pc.timestamp DESC;

COMMENT ON VIEW report_collaboration_activity IS 'Collaboration activity (security_invoker)';
