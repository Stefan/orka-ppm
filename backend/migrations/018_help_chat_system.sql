-- Help Chat System Migration
-- Creates comprehensive AI-powered help chat system with contextual assistance,
-- proactive tips, multi-language support, and privacy-compliant analytics

-- =====================================================
-- HELP CHAT SYSTEM TABLES
-- =====================================================

-- Help sessions table - tracks user help chat sessions
CREATE TABLE IF NOT EXISTS help_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    page_context JSONB,
    language VARCHAR(5) DEFAULT 'en' CHECK (language IN ('en', 'de', 'fr')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure session_id is unique per user
    CONSTRAINT unique_user_session UNIQUE (user_id, session_id)
);

-- Help messages table - stores all messages in help chat conversations
CREATE TABLE IF NOT EXISTS help_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES help_sessions(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'assistant', 'system', 'tip')),
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]',
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    response_time_ms INTEGER CHECK (response_time_ms >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Help feedback table - collects user feedback on help responses
CREATE TABLE IF NOT EXISTS help_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES help_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    feedback_type VARCHAR(50) CHECK (feedback_type IN ('helpful', 'not_helpful', 'incorrect', 'suggestion', 'feature_request')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one feedback per message per user
    CONSTRAINT unique_message_user_feedback UNIQUE (message_id, user_id)
);

-- Help analytics table - privacy-compliant usage analytics
CREATE TABLE IF NOT EXISTS help_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('query', 'tip_shown', 'tip_dismissed', 'feedback', 'session_start', 'session_end')),
    event_data JSONB DEFAULT '{}',
    page_context JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Help content knowledge base - stores help documentation and guides
CREATE TABLE IF NOT EXISTS help_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('guide', 'faq', 'feature_doc', 'troubleshooting', 'tutorial', 'best_practice')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    language VARCHAR(5) DEFAULT 'en' CHECK (language IN ('en', 'de', 'fr')),
    version INTEGER DEFAULT 1 CHECK (version > 0),
    is_active BOOLEAN DEFAULT true,
    
    -- SEO and search optimization
    slug VARCHAR(255),
    meta_description TEXT,
    keywords TEXT[],
    
    -- Content management
    author_id UUID REFERENCES auth.users(id),
    reviewer_id UUID REFERENCES auth.users(id),
    review_status VARCHAR(20) DEFAULT 'draft' CHECK (review_status IN ('draft', 'review', 'approved', 'archived')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure unique slug per language
    CONSTRAINT unique_content_slug_language UNIQUE (slug, language)
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Help sessions indexes
CREATE INDEX IF NOT EXISTS idx_help_sessions_user_id ON help_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_help_sessions_session_id ON help_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_help_sessions_started_at ON help_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_help_sessions_language ON help_sessions(language);
CREATE INDEX IF NOT EXISTS idx_help_sessions_page_context ON help_sessions USING GIN(page_context);

-- Help messages indexes
CREATE INDEX IF NOT EXISTS idx_help_messages_session_id ON help_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_help_messages_type ON help_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_help_messages_created_at ON help_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_help_messages_confidence ON help_messages(confidence_score) WHERE confidence_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_help_messages_sources ON help_messages USING GIN(sources);

-- Help feedback indexes
CREATE INDEX IF NOT EXISTS idx_help_feedback_message_id ON help_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_user_id ON help_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_help_feedback_rating ON help_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_help_feedback_type ON help_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_help_feedback_created_at ON help_feedback(created_at);

-- Help analytics indexes
CREATE INDEX IF NOT EXISTS idx_help_analytics_user_id ON help_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_help_analytics_event_type ON help_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_help_analytics_timestamp ON help_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_help_analytics_event_data ON help_analytics USING GIN(event_data);
CREATE INDEX IF NOT EXISTS idx_help_analytics_page_context ON help_analytics USING GIN(page_context);

-- Help content indexes
CREATE INDEX IF NOT EXISTS idx_help_content_type ON help_content(content_type);
CREATE INDEX IF NOT EXISTS idx_help_content_language ON help_content(language);
CREATE INDEX IF NOT EXISTS idx_help_content_active ON help_content(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_help_content_tags ON help_content USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_help_content_keywords ON help_content USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_help_content_review_status ON help_content(review_status);
CREATE INDEX IF NOT EXISTS idx_help_content_published_at ON help_content(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_help_content_slug ON help_content(slug);

-- Full-text search index for help content
CREATE INDEX IF NOT EXISTS idx_help_content_search ON help_content USING GIN(to_tsvector('english', title || ' ' || content));

-- =====================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================================

-- Apply updated_at trigger to help_content table
CREATE TRIGGER update_help_content_updated_at 
    BEFORE UPDATE ON help_content 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- AUDIT TRIGGERS FOR HELP CHAT SYSTEM
-- =====================================================

-- Apply audit triggers to help chat tables (excluding analytics for privacy)
CREATE TRIGGER audit_help_sessions 
    AFTER INSERT OR UPDATE OR DELETE ON help_sessions 
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_help_messages 
    AFTER INSERT OR UPDATE OR DELETE ON help_messages 
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_help_feedback 
    AFTER INSERT OR UPDATE OR DELETE ON help_feedback 
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_help_content 
    AFTER INSERT OR UPDATE OR DELETE ON help_content 
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Note: help_analytics table is NOT audited to maintain privacy compliance

-- =====================================================
-- HELP CHAT SYSTEM FUNCTIONS
-- =====================================================

-- Function to clean up old help sessions (privacy compliance)
CREATE OR REPLACE FUNCTION cleanup_old_help_sessions(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete sessions older than retention period
    WITH deleted_sessions AS (
        DELETE FROM help_sessions 
        WHERE created_at < NOW() - INTERVAL '1 day' * retention_days
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted_sessions;
    
    RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- Function to anonymize help analytics data
CREATE OR REPLACE FUNCTION anonymize_help_analytics(older_than_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $
DECLARE
    anonymized_count INTEGER;
BEGIN
    -- Remove user_id from old analytics records for privacy
    UPDATE help_analytics 
    SET user_id = NULL,
        event_data = event_data - 'user_specific_data',
        page_context = page_context - 'user_specific_data'
    WHERE timestamp < NOW() - INTERVAL '1 day' * older_than_days
    AND user_id IS NOT NULL;
    
    GET DIAGNOSTICS anonymized_count = ROW_COUNT;
    RETURN anonymized_count;
END;
$ LANGUAGE plpgsql;

-- Function to get help session statistics
CREATE OR REPLACE FUNCTION get_help_session_stats(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_sessions BIGINT,
    total_messages BIGINT,
    avg_messages_per_session NUMERIC,
    avg_session_duration_minutes NUMERIC,
    top_languages TEXT[],
    satisfaction_score NUMERIC
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT hs.id) as total_sessions,
        COUNT(hm.id) as total_messages,
        ROUND(COUNT(hm.id)::NUMERIC / NULLIF(COUNT(DISTINCT hs.id), 0), 2) as avg_messages_per_session,
        ROUND(AVG(EXTRACT(EPOCH FROM (hs.ended_at - hs.started_at)) / 60), 2) as avg_session_duration_minutes,
        ARRAY_AGG(DISTINCT hs.language ORDER BY COUNT(*) DESC) as top_languages,
        ROUND(AVG(hf.rating), 2) as satisfaction_score
    FROM help_sessions hs
    LEFT JOIN help_messages hm ON hs.id = hm.session_id
    LEFT JOIN help_feedback hf ON hm.id = hf.message_id
    WHERE hs.created_at::DATE BETWEEN start_date AND end_date;
END;
$ LANGUAGE plpgsql;

-- Function to get popular help topics
CREATE OR REPLACE FUNCTION get_popular_help_topics(
    limit_count INTEGER DEFAULT 10,
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
    topic VARCHAR(50),
    query_count BIGINT,
    avg_confidence NUMERIC,
    satisfaction_rate NUMERIC
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        ha.event_data->>'topic' as topic,
        COUNT(*) as query_count,
        ROUND(AVG((ha.event_data->>'confidence')::NUMERIC), 3) as avg_confidence,
        ROUND(
            COUNT(CASE WHEN hf.rating >= 4 THEN 1 END)::NUMERIC / 
            NULLIF(COUNT(hf.rating), 0) * 100, 1
        ) as satisfaction_rate
    FROM help_analytics ha
    LEFT JOIN help_messages hm ON (ha.event_data->>'message_id')::UUID = hm.id
    LEFT JOIN help_feedback hf ON hm.id = hf.message_id
    WHERE ha.event_type = 'query'
    AND ha.timestamp > NOW() - INTERVAL '1 day' * days_back
    AND ha.event_data->>'topic' IS NOT NULL
    GROUP BY ha.event_data->>'topic'
    ORDER BY query_count DESC
    LIMIT limit_count;
END;
$ LANGUAGE plpgsql;

-- Function to validate help content before publishing
CREATE OR REPLACE FUNCTION validate_help_content()
RETURNS TRIGGER AS $
BEGIN
    -- Ensure required fields are present for published content
    IF NEW.review_status = 'approved' AND NEW.published_at IS NULL THEN
        NEW.published_at := NOW();
    END IF;
    
    -- Generate slug if not provided
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := LOWER(REGEXP_REPLACE(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
        NEW.slug := TRIM(NEW.slug, '-');
    END IF;
    
    -- Ensure meta_description is not too long
    IF LENGTH(NEW.meta_description) > 160 THEN
        NEW.meta_description := LEFT(NEW.meta_description, 157) || '...';
    END IF;
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Apply content validation trigger
CREATE TRIGGER validate_help_content_trigger
    BEFORE INSERT OR UPDATE ON help_content
    FOR EACH ROW EXECUTE FUNCTION validate_help_content();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for active help sessions with message counts
CREATE OR REPLACE VIEW v_active_help_sessions AS
SELECT 
    hs.id,
    hs.user_id,
    hs.session_id,
    hs.started_at,
    hs.ended_at,
    hs.language,
    hs.page_context,
    COUNT(hm.id) as message_count,
    MAX(hm.created_at) as last_message_at,
    AVG(hm.confidence_score) as avg_confidence
FROM help_sessions hs
LEFT JOIN help_messages hm ON hs.id = hm.session_id
WHERE hs.ended_at IS NULL OR hs.ended_at > NOW() - INTERVAL '1 hour'
GROUP BY hs.id, hs.user_id, hs.session_id, hs.started_at, hs.ended_at, 
         hs.language, hs.page_context;

-- View for help content with engagement metrics
CREATE OR REPLACE VIEW v_help_content_metrics AS
SELECT 
    hc.id,
    hc.title,
    hc.content_type,
    hc.language,
    hc.tags,
    hc.is_active,
    hc.review_status,
    hc.published_at,
    COUNT(DISTINCT ha.user_id) as unique_viewers,
    COUNT(ha.id) as total_views,
    AVG(hf.rating) as avg_rating,
    COUNT(hf.id) as feedback_count
FROM help_content hc
LEFT JOIN help_analytics ha ON (ha.event_data->>'content_id')::UUID = hc.id
LEFT JOIN help_messages hm ON hm.sources @> jsonb_build_array(jsonb_build_object('content_id', hc.id))
LEFT JOIN help_feedback hf ON hm.id = hf.message_id
WHERE hc.is_active = true
GROUP BY hc.id, hc.title, hc.content_type, hc.language, hc.tags, 
         hc.is_active, hc.review_status, hc.published_at;

-- View for help feedback summary
CREATE OR REPLACE VIEW v_help_feedback_summary AS
SELECT 
    DATE_TRUNC('day', hf.created_at) as feedback_date,
    hf.feedback_type,
    COUNT(*) as feedback_count,
    AVG(hf.rating) as avg_rating,
    COUNT(CASE WHEN hf.rating >= 4 THEN 1 END) as positive_feedback,
    COUNT(CASE WHEN hf.rating <= 2 THEN 1 END) as negative_feedback
FROM help_feedback hf
WHERE hf.created_at > NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', hf.created_at), hf.feedback_type
ORDER BY feedback_date DESC, feedback_type;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on help chat tables
ALTER TABLE help_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_content ENABLE ROW LEVEL SECURITY;

-- Help sessions policies - users can only access their own sessions
CREATE POLICY help_sessions_user_policy ON help_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Help messages policies - users can only access messages from their sessions
CREATE POLICY help_messages_user_policy ON help_messages
    FOR ALL USING (
        session_id IN (
            SELECT id FROM help_sessions WHERE user_id = auth.uid()
        )
    );

-- Help feedback policies - users can only access their own feedback
CREATE POLICY help_feedback_user_policy ON help_feedback
    FOR ALL USING (auth.uid() = user_id);

-- Help analytics policies - users can only access their own analytics
CREATE POLICY help_analytics_user_policy ON help_analytics
    FOR ALL USING (auth.uid() = user_id);

-- Help content policies - all authenticated users can read active content
CREATE POLICY help_content_read_policy ON help_content
    FOR SELECT USING (
        is_active = true 
        AND review_status = 'approved' 
        AND published_at IS NOT NULL
    );

-- Help content admin policies - content managers can manage content
CREATE POLICY help_content_admin_policy ON help_content
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.user_id = auth.uid()
            AND up.role IN ('admin', 'content_manager')
        )
    );

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE help_sessions IS 'User help chat sessions with context and language preferences';
COMMENT ON TABLE help_messages IS 'Individual messages in help chat conversations with AI responses';
COMMENT ON TABLE help_feedback IS 'User feedback on help responses for quality improvement';
COMMENT ON TABLE help_analytics IS 'Privacy-compliant usage analytics for help system optimization';
COMMENT ON TABLE help_content IS 'Knowledge base content for help system with multi-language support';

COMMENT ON FUNCTION cleanup_old_help_sessions(INTEGER) IS 'Removes old help sessions for privacy compliance';
COMMENT ON FUNCTION anonymize_help_analytics(INTEGER) IS 'Anonymizes old analytics data for privacy protection';
COMMENT ON FUNCTION get_help_session_stats(DATE, DATE) IS 'Returns help system usage statistics for specified date range';
COMMENT ON FUNCTION get_popular_help_topics(INTEGER, INTEGER) IS 'Returns most popular help topics with satisfaction metrics';

COMMENT ON VIEW v_active_help_sessions IS 'Currently active help sessions with message counts and confidence metrics';
COMMENT ON VIEW v_help_content_metrics IS 'Help content with engagement and feedback metrics';
COMMENT ON VIEW v_help_feedback_summary IS 'Daily help feedback summary with rating distributions';

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Insert sample help content for common PPM features
INSERT INTO help_content (content_type, title, content, tags, language, slug, meta_description, author_id, review_status, published_at) VALUES
('guide', 'Getting Started with Project Management', 'Learn the basics of project management in our PPM platform...', ARRAY['getting-started', 'projects', 'basics'], 'en', 'getting-started-project-management', 'Complete guide to getting started with project management features', NULL, 'approved', NOW()),
('faq', 'How to Create a New Project', 'To create a new project, navigate to the Projects section and click the "New Project" button...', ARRAY['projects', 'creation', 'faq'], 'en', 'how-to-create-new-project', 'Step-by-step guide for creating new projects', NULL, 'approved', NOW()),
('troubleshooting', 'Common Login Issues', 'If you are experiencing login problems, try these troubleshooting steps...', ARRAY['login', 'authentication', 'troubleshooting'], 'en', 'common-login-issues', 'Solutions for common login and authentication problems', NULL, 'approved', NOW()),
('feature_doc', 'Budget Management Features', 'Our budget management system provides comprehensive tools for tracking project costs...', ARRAY['budget', 'financial', 'features'], 'en', 'budget-management-features', 'Overview of budget management and financial tracking features', NULL, 'approved', NOW()),
('tutorial', 'Creating Your First Dashboard', 'Dashboards provide a visual overview of your project data. Here is how to create one...', ARRAY['dashboard', 'visualization', 'tutorial'], 'en', 'creating-first-dashboard', 'Tutorial for creating and customizing project dashboards', NULL, 'approved', NOW());

-- Update table statistics for query optimization
ANALYZE help_sessions;
ANALYZE help_messages;
ANALYZE help_feedback;
ANALYZE help_analytics;
ANALYZE help_content;

COMMIT;