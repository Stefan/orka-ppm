-- Enhanced Project Monthly Report (PMR) Schema Migration
-- This migration creates tables for AI-powered PMR system with interactive editing,
-- multi-format export, and intelligent template management

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE CREATION (in dependency order)
-- ============================================================================

-- PMR Templates Table (must be created first due to foreign key dependencies)
CREATE TABLE IF NOT EXISTS pmr_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('executive', 'technical', 'financial', 'custom')),
    industry_focus VARCHAR(100),
    sections JSONB NOT NULL DEFAULT '[]',
    default_metrics JSONB DEFAULT '[]',
    ai_suggestions JSONB DEFAULT '{}',
    branding_config JSONB DEFAULT '{}',
    export_formats JSONB DEFAULT '[]',
    is_public BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    organization_id UUID,
    usage_count INTEGER DEFAULT 0 CHECK (usage_count >= 0),
    rating DECIMAL(3,2) CHECK (rating >= 0.0 AND rating <= 5.0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- PMR Reports Table
CREATE TABLE IF NOT EXISTS pmr_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    report_month DATE NOT NULL,
    report_year INTEGER NOT NULL CHECK (report_year >= 2020 AND report_year <= 2030),
    template_id UUID NOT NULL REFERENCES pmr_templates(id),
    title VARCHAR(255) NOT NULL,
    executive_summary TEXT,
    ai_generated_insights JSONB DEFAULT '[]',
    sections JSONB NOT NULL DEFAULT '[]',
    metrics JSONB DEFAULT '{}',
    visualizations JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'distributed')),
    generated_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    generated_at TIMESTAMP DEFAULT NOW(),
    last_modified TIMESTAMP DEFAULT NOW(),
    version INTEGER DEFAULT 1 CHECK (version >= 1),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, report_month, report_year, version)
);

-- AI Insights Table
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pmr_reports(id) ON DELETE CASCADE,
    insight_type VARCHAR(50) NOT NULL CHECK (insight_type IN ('prediction', 'recommendation', 'alert', 'summary')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('budget', 'schedule', 'resource', 'risk', 'quality')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    supporting_data JSONB DEFAULT '{}',
    predicted_impact TEXT,
    recommended_actions JSONB DEFAULT '[]',
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    generated_at TIMESTAMP DEFAULT NOW(),
    validated BOOLEAN DEFAULT FALSE,
    validation_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Interactive Edit Sessions Table
CREATE TABLE IF NOT EXISTS edit_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pmr_reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    session_type VARCHAR(20) DEFAULT 'chat' CHECK (session_type IN ('chat', 'direct', 'collaborative')),
    chat_messages JSONB DEFAULT '[]',
    changes_made JSONB DEFAULT '[]',
    active_section VARCHAR(100),
    started_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Export Jobs Table
CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pmr_reports(id) ON DELETE CASCADE,
    export_format VARCHAR(20) NOT NULL CHECK (export_format IN ('pdf', 'excel', 'slides', 'word', 'powerpoint')),
    template_config JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    file_url TEXT,
    file_size INTEGER CHECK (file_size >= 0),
    export_options JSONB DEFAULT '{}',
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- PMR Collaboration Table (for tracking collaborative editing)
CREATE TABLE IF NOT EXISTS pmr_collaboration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pmr_reports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('view', 'edit', 'comment', 'approve', 'reject')),
    section_id VARCHAR(100),
    change_description TEXT,
    change_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- PMR Distribution Log Table (for tracking report distribution)
CREATE TABLE IF NOT EXISTS pmr_distribution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES pmr_reports(id) ON DELETE CASCADE,
    distribution_method VARCHAR(50) NOT NULL CHECK (distribution_method IN ('email', 'slack', 'teams', 'portal', 'download')),
    recipient_type VARCHAR(50) NOT NULL CHECK (recipient_type IN ('user', 'group', 'external')),
    recipient_identifier VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- PMR Reports Indexes
CREATE INDEX IF NOT EXISTS idx_pmr_reports_project_month ON pmr_reports(project_id, report_month DESC);
CREATE INDEX IF NOT EXISTS idx_pmr_reports_status ON pmr_reports(status, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pmr_reports_template ON pmr_reports(template_id);
CREATE INDEX IF NOT EXISTS idx_pmr_reports_generated_by ON pmr_reports(generated_by);
CREATE INDEX IF NOT EXISTS idx_pmr_reports_active ON pmr_reports(project_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_pmr_reports_year_month ON pmr_reports(report_year, report_month);

-- PMR Templates Indexes
CREATE INDEX IF NOT EXISTS idx_pmr_templates_type ON pmr_templates(template_type, is_public);
CREATE INDEX IF NOT EXISTS idx_pmr_templates_created_by ON pmr_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_pmr_templates_organization ON pmr_templates(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pmr_templates_usage ON pmr_templates(usage_count DESC, rating DESC);
CREATE INDEX IF NOT EXISTS idx_pmr_templates_public ON pmr_templates(is_public, template_type) WHERE is_public = TRUE;

-- AI Insights Indexes
CREATE INDEX IF NOT EXISTS idx_ai_insights_report ON ai_insights(report_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type_category ON ai_insights(insight_type, category);
CREATE INDEX IF NOT EXISTS idx_ai_insights_confidence ON ai_insights(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_validated ON ai_insights(report_id, validated);

-- Edit Sessions Indexes
CREATE INDEX IF NOT EXISTS idx_edit_sessions_report ON edit_sessions(report_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_edit_sessions_user ON edit_sessions(user_id, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_edit_sessions_active ON edit_sessions(is_active, last_activity DESC) WHERE is_active = TRUE;

-- Export Jobs Indexes
CREATE INDEX IF NOT EXISTS idx_export_jobs_report ON export_jobs(report_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_requested_by ON export_jobs(requested_by, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_format ON export_jobs(export_format, status);

-- Collaboration Indexes
CREATE INDEX IF NOT EXISTS idx_pmr_collaboration_report ON pmr_collaboration(report_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pmr_collaboration_user ON pmr_collaboration(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pmr_collaboration_action ON pmr_collaboration(action_type, timestamp DESC);

-- Distribution Log Indexes
CREATE INDEX IF NOT EXISTS idx_pmr_distribution_report ON pmr_distribution_log(report_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_pmr_distribution_status ON pmr_distribution_log(status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_pmr_distribution_method ON pmr_distribution_log(distribution_method, status);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Create or replace the update function (reuse existing if available)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to all PMR tables
CREATE TRIGGER update_pmr_reports_updated_at BEFORE UPDATE ON pmr_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pmr_templates_updated_at BEFORE UPDATE ON pmr_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_insights_updated_at BEFORE UPDATE ON ai_insights FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_edit_sessions_updated_at BEFORE UPDATE ON edit_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_export_jobs_updated_at BEFORE UPDATE ON export_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pmr_distribution_log_updated_at BEFORE UPDATE ON pmr_distribution_log FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update last_modified on pmr_reports when related data changes
CREATE OR REPLACE FUNCTION update_pmr_report_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the parent report's last_modified timestamp
    UPDATE pmr_reports 
    SET last_modified = NOW() 
    WHERE id = COALESCE(NEW.report_id, OLD.report_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Apply to related tables
CREATE TRIGGER update_pmr_report_on_insight_change 
    AFTER INSERT OR UPDATE OR DELETE ON ai_insights 
    FOR EACH ROW EXECUTE FUNCTION update_pmr_report_last_modified();

CREATE TRIGGER update_pmr_report_on_collaboration_change 
    AFTER INSERT OR UPDATE ON pmr_collaboration 
    FOR EACH ROW EXECUTE FUNCTION update_pmr_report_last_modified();

-- Trigger to update template usage count
CREATE OR REPLACE FUNCTION update_template_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment usage count when a new report is created with this template
    IF TG_OP = 'INSERT' THEN
        UPDATE pmr_templates 
        SET usage_count = usage_count + 1 
        WHERE id = NEW.template_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_template_usage_on_report_create 
    AFTER INSERT ON pmr_reports 
    FOR EACH ROW EXECUTE FUNCTION update_template_usage_count();

-- Trigger to update edit session activity
CREATE OR REPLACE FUNCTION update_edit_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last_activity timestamp when session data changes
    NEW.last_activity = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_edit_session_activity_trigger 
    BEFORE UPDATE ON edit_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_edit_session_activity();

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to get the latest PMR report for a project
CREATE OR REPLACE FUNCTION get_latest_pmr_report(p_project_id UUID)
RETURNS TABLE (
    report_id UUID,
    report_month DATE,
    report_year INTEGER,
    title VARCHAR(255),
    status VARCHAR(20),
    generated_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.report_month,
        r.report_year,
        r.title,
        r.status,
        r.generated_at
    FROM pmr_reports r
    WHERE r.project_id = p_project_id 
      AND r.is_active = TRUE
    ORDER BY r.report_year DESC, r.report_month DESC, r.version DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate PMR report completeness score
CREATE OR REPLACE FUNCTION calculate_pmr_completeness(p_report_id UUID)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    total_sections INTEGER := 0;
    completed_sections INTEGER := 0;
    has_executive_summary BOOLEAN := FALSE;
    has_insights BOOLEAN := FALSE;
    completeness_score DECIMAL(3,2);
BEGIN
    -- Check if report exists
    IF NOT EXISTS (SELECT 1 FROM pmr_reports WHERE id = p_report_id) THEN
        RETURN 0.0;
    END IF;
    
    -- Get report data
    SELECT 
        CASE WHEN executive_summary IS NOT NULL AND LENGTH(TRIM(executive_summary)) > 0 THEN TRUE ELSE FALSE END,
        CASE WHEN jsonb_array_length(ai_generated_insights) > 0 THEN TRUE ELSE FALSE END,
        jsonb_array_length(sections)
    INTO has_executive_summary, has_insights, total_sections
    FROM pmr_reports 
    WHERE id = p_report_id;
    
    -- Count completed sections (sections with content)
    SELECT COUNT(*)
    INTO completed_sections
    FROM pmr_reports r,
         jsonb_array_elements(r.sections) AS section
    WHERE r.id = p_report_id
      AND jsonb_typeof(section->'content') = 'string'
      AND LENGTH(TRIM(section->>'content')) > 0;
    
    -- Calculate completeness score
    completeness_score := 0.0;
    
    -- Executive summary (30% weight)
    IF has_executive_summary THEN
        completeness_score := completeness_score + 0.30;
    END IF;
    
    -- AI insights (20% weight)
    IF has_insights THEN
        completeness_score := completeness_score + 0.20;
    END IF;
    
    -- Sections completion (50% weight)
    IF total_sections > 0 THEN
        completeness_score := completeness_score + (0.50 * completed_sections / total_sections);
    END IF;
    
    RETURN LEAST(completeness_score, 1.0);
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old edit sessions
CREATE OR REPLACE FUNCTION cleanup_old_edit_sessions(p_days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    sessions_cleaned INTEGER;
BEGIN
    -- Mark old inactive sessions as inactive and clean up data
    UPDATE edit_sessions 
    SET 
        is_active = FALSE,
        chat_messages = '[]',
        changes_made = '[]'
    WHERE 
        last_activity < NOW() - INTERVAL '1 day' * p_days_old
        AND is_active = TRUE;
    
    GET DIAGNOSTICS sessions_cleaned = ROW_COUNT;
    
    RETURN sessions_cleaned;
END;
$$ LANGUAGE plpgsql;

-- Function to validate export job status transitions
CREATE OR REPLACE FUNCTION validate_export_job_status() RETURNS TRIGGER AS $$
DECLARE
    old_status VARCHAR(20);
    new_status VARCHAR(20);
BEGIN
    old_status := OLD.status;
    new_status := NEW.status;
    
    -- Allow any transition from queued
    IF old_status = 'queued' THEN
        RETURN NEW;
    END IF;
    
    -- Allow processing -> completed or failed
    IF old_status = 'processing' AND new_status IN ('completed', 'failed') THEN
        RETURN NEW;
    END IF;
    
    -- Allow failed -> queued (for retry)
    IF old_status = 'failed' AND new_status = 'queued' THEN
        RETURN NEW;
    END IF;
    
    -- Prevent invalid transitions
    IF old_status IN ('completed') THEN
        RAISE EXCEPTION 'Cannot change status from % to %', old_status, new_status;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply export job status validation trigger
CREATE TRIGGER validate_export_job_status_trigger
    BEFORE UPDATE ON export_jobs
    FOR EACH ROW EXECUTE FUNCTION validate_export_job_status();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- PMR Dashboard Summary View
CREATE OR REPLACE VIEW pmr_dashboard_summary AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    p.status as project_status,
    -- Latest report info
    latest_report.report_id,
    latest_report.report_month,
    latest_report.report_year,
    latest_report.title as latest_report_title,
    latest_report.status as report_status,
    latest_report.generated_at as report_generated_at,
    -- Report statistics
    report_stats.total_reports,
    report_stats.draft_reports,
    report_stats.approved_reports,
    -- Template info
    t.name as template_name,
    t.template_type,
    -- Insights summary
    insight_stats.total_insights,
    insight_stats.critical_insights,
    insight_stats.unvalidated_insights
FROM projects p
LEFT JOIN LATERAL (
    SELECT * FROM get_latest_pmr_report(p.id)
) latest_report ON TRUE
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as total_reports,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_reports,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_reports
    FROM pmr_reports 
    WHERE project_id = p.id AND is_active = TRUE
) report_stats ON TRUE
LEFT JOIN pmr_templates t ON t.id = latest_report.report_id
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as total_insights,
        COUNT(*) FILTER (WHERE priority = 'critical') as critical_insights,
        COUNT(*) FILTER (WHERE validated = FALSE) as unvalidated_insights
    FROM ai_insights ai
    JOIN pmr_reports r ON r.id = ai.report_id
    WHERE r.project_id = p.id AND r.is_active = TRUE
) insight_stats ON TRUE;

-- PMR Template Usage Analytics View
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
    u.email as creator_email,
    -- Usage statistics
    usage_stats.reports_this_month,
    usage_stats.reports_this_year,
    usage_stats.avg_completion_score,
    -- Rating statistics
    COALESCE(rating_stats.total_ratings, 0) as total_ratings,
    rating_stats.avg_rating
FROM pmr_templates t
LEFT JOIN auth.users u ON u.id = t.created_by
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) FILTER (WHERE DATE_TRUNC('month', generated_at) = DATE_TRUNC('month', NOW())) as reports_this_month,
        COUNT(*) FILTER (WHERE DATE_TRUNC('year', generated_at) = DATE_TRUNC('year', NOW())) as reports_this_year,
        AVG(calculate_pmr_completeness(r.id)) as avg_completion_score
    FROM pmr_reports r
    WHERE r.template_id = t.id AND r.is_active = TRUE
) usage_stats ON TRUE
LEFT JOIN LATERAL (
    -- This would be extended if we had a separate ratings table
    SELECT 
        1 as total_ratings,
        t.rating as avg_rating
    WHERE t.rating IS NOT NULL
) rating_stats ON TRUE;

-- Active Edit Sessions View
CREATE OR REPLACE VIEW active_edit_sessions AS
SELECT 
    es.id as session_id,
    es.report_id,
    r.title as report_title,
    r.project_id,
    p.name as project_name,
    es.user_id,
    u.email as user_email,
    es.session_type,
    es.active_section,
    es.started_at,
    es.last_activity,
    -- Session activity metrics
    jsonb_array_length(es.chat_messages) as message_count,
    jsonb_array_length(es.changes_made) as changes_count,
    -- Time since last activity
    EXTRACT(EPOCH FROM (NOW() - es.last_activity))/60 as minutes_since_activity
FROM edit_sessions es
JOIN pmr_reports r ON r.id = es.report_id
JOIN projects p ON p.id = r.project_id
LEFT JOIN auth.users u ON u.id = es.user_id
WHERE es.is_active = TRUE
ORDER BY es.last_activity DESC;

-- Export Jobs Status View
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
    u.email as requester_email,
    ej.started_at,
    ej.completed_at,
    ej.error_message,
    -- Processing time
    CASE 
        WHEN ej.completed_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (ej.completed_at - ej.started_at))/60
        ELSE 
            EXTRACT(EPOCH FROM (NOW() - ej.started_at))/60
    END as processing_time_minutes
FROM export_jobs ej
JOIN pmr_reports r ON r.id = ej.report_id
JOIN projects p ON p.id = r.project_id
LEFT JOIN auth.users u ON u.id = ej.requested_by
ORDER BY ej.started_at DESC;

-- ============================================================================
-- INITIAL DATA SETUP
-- ============================================================================

-- Insert default PMR templates
INSERT INTO pmr_templates (
    name, 
    description, 
    template_type, 
    sections, 
    default_metrics, 
    export_formats, 
    is_public, 
    created_by
) VALUES 
(
    'Executive Summary Template',
    'High-level executive summary template focusing on key metrics and strategic insights',
    'executive',
    '[
        {"id": "executive_summary", "name": "Executive Summary", "required": true, "order": 1},
        {"id": "key_metrics", "name": "Key Performance Metrics", "required": true, "order": 2},
        {"id": "budget_status", "name": "Budget Status", "required": true, "order": 3},
        {"id": "schedule_status", "name": "Schedule Status", "required": true, "order": 4},
        {"id": "risks_issues", "name": "Key Risks and Issues", "required": true, "order": 5},
        {"id": "recommendations", "name": "Recommendations", "required": false, "order": 6}
    ]'::jsonb,
    '["budget_variance", "schedule_variance", "cost_performance_index", "schedule_performance_index", "percent_complete"]'::jsonb,
    '["pdf", "slides", "word"]'::jsonb,
    true,
    (SELECT id FROM auth.users LIMIT 1)
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- DOCUMENTATION COMMENTS
-- ============================================================================

COMMENT ON TABLE pmr_reports IS 'AI-powered Project Monthly Reports with interactive editing capabilities';
COMMENT ON TABLE pmr_templates IS 'Intelligent template management system for PMR generation';
COMMENT ON TABLE ai_insights IS 'AI-generated insights and recommendations for project reports';
COMMENT ON TABLE edit_sessions IS 'Interactive editing sessions with real-time collaboration support';
COMMENT ON TABLE export_jobs IS 'Multi-format export job management and tracking';
COMMENT ON TABLE pmr_collaboration IS 'Collaboration tracking for report editing and approval workflows';
COMMENT ON TABLE pmr_distribution_log IS 'Distribution tracking for automated report delivery';

COMMENT ON VIEW pmr_dashboard_summary IS 'Comprehensive dashboard view of PMR status across all projects';
COMMENT ON VIEW pmr_template_analytics IS 'Template usage analytics and performance metrics';
COMMENT ON VIEW active_edit_sessions IS 'Currently active collaborative editing sessions';
COMMENT ON VIEW export_jobs_status IS 'Export job status and processing metrics';

COMMENT ON FUNCTION get_latest_pmr_report(UUID) IS 'Retrieves the most recent PMR report for a given project';
COMMENT ON FUNCTION calculate_pmr_completeness(UUID) IS 'Calculates completeness score for a PMR report based on content analysis';
COMMENT ON FUNCTION cleanup_old_edit_sessions(INTEGER) IS 'Cleans up old inactive edit sessions to maintain performance';

-- ============================================================================
-- PERMISSIONS (commented out - adjust based on your RBAC system)
-- ============================================================================

-- These would typically be handled by your application's permission system
-- GRANT SELECT, INSERT, UPDATE ON pmr_reports TO pmr_users;
-- GRANT SELECT, INSERT, UPDATE ON pmr_templates TO pmr_users;
-- GRANT SELECT, INSERT, UPDATE ON ai_insights TO pmr_users;
-- GRANT SELECT, INSERT, UPDATE ON edit_sessions TO pmr_users;
-- GRANT SELECT, INSERT, UPDATE ON export_jobs TO pmr_users;
-- GRANT SELECT, INSERT, UPDATE ON pmr_collaboration TO pmr_users;
-- GRANT SELECT, INSERT, UPDATE ON pmr_distribution_log TO pmr_users;

-- GRANT SELECT ON pmr_dashboard_summary TO pmr_users;
-- GRANT SELECT ON pmr_template_analytics TO pmr_users;
-- GRANT SELECT ON active_edit_sessions TO pmr_users;
-- GRANT SELECT ON export_jobs_status TO pmr_users;