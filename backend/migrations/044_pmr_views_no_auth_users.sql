-- Migration: Remove auth.users exposure from PMR analytics views
-- Security: Views in public schema must not expose auth.users to anon/authenticated (PostgREST).
-- We keep user IDs (UUIDs) for reference; display names/emails must be resolved via secured API (e.g. user_profiles or service role).

-- ============================================================================
-- pmr_template_analytics: remove creator_email (was from auth.users)
-- ============================================================================
CREATE OR REPLACE VIEW pmr_template_analytics AS
SELECT 
    t.id,
    t.name,
    t.template_type,
    t.industry_focus,
    t.usage_count,
    t.rating,
    t.is_public,
    t.created_by,
    -- Usage statistics
    usage_stats.reports_this_month,
    usage_stats.reports_this_year,
    usage_stats.avg_completion_score,
    -- Rating statistics
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
    SELECT 
        1 as total_ratings,
        t.rating as avg_rating
    WHERE t.rating IS NOT NULL
) rating_stats ON TRUE;

COMMENT ON VIEW pmr_template_analytics IS 'Template usage analytics and performance metrics (no auth.users exposure)';


-- ============================================================================
-- active_edit_sessions: remove user_email (was from auth.users)
-- ============================================================================
CREATE OR REPLACE VIEW active_edit_sessions AS
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

COMMENT ON VIEW active_edit_sessions IS 'Currently active editing sessions (no auth.users exposure)';


-- ============================================================================
-- export_jobs_status: remove requester_email (was from auth.users)
-- ============================================================================
CREATE OR REPLACE VIEW export_jobs_status AS
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
        WHEN ej.completed_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (ej.completed_at - ej.started_at))/60
        ELSE 
            EXTRACT(EPOCH FROM (NOW() - ej.started_at))/60
    END as processing_time_minutes
FROM export_jobs ej
JOIN pmr_reports r ON r.id = ej.report_id
JOIN projects p ON p.id = r.project_id
ORDER BY ej.started_at DESC;

COMMENT ON VIEW export_jobs_status IS 'Export job status and processing metrics (no auth.users exposure)';


-- ============================================================================
-- report_collaboration_activity: remove user_email (was from auth.users)
-- Only exists when 021_enhanced_pmr_schema was applied.
-- ============================================================================
DROP VIEW IF EXISTS report_collaboration_activity;

CREATE VIEW report_collaboration_activity AS
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

COMMENT ON VIEW report_collaboration_activity IS 'Recent collaboration activity (no auth.users exposure)';
