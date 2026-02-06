-- Help Chat Enhancement (AI Help Chat Enhancement spec)
-- Adds help_logs (per-query logging), help_query_feedback (feedback by query),
-- and extends embeddings for help_doc content type.

-- =====================================================
-- 1.1 help_logs table
-- =====================================================
CREATE TABLE IF NOT EXISTS help_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID,
    query TEXT NOT NULL,
    response TEXT,
    page_context JSONB DEFAULT '{}',
    user_role VARCHAR(100),
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    sources_used JSONB DEFAULT '[]',
    response_time_ms INTEGER CHECK (response_time_ms >= 0),
    success BOOLEAN DEFAULT true,
    error_type VARCHAR(100),
    error_message TEXT,
    action_type VARCHAR(100),
    action_details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_logs_organization_id ON help_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_help_logs_user_id ON help_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_help_logs_created_at ON help_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_help_logs_action_type ON help_logs(action_type) WHERE action_type IS NOT NULL;

COMMENT ON TABLE help_logs IS 'Per-query help chat logs for analytics and RAG (AI Help Chat Enhancement)';

-- =====================================================
-- 1.2 help_query_feedback table (feedback linked to help_logs)
-- =====================================================
CREATE TABLE IF NOT EXISTS help_query_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES help_logs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_query_user_feedback UNIQUE (query_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_help_query_feedback_query_id ON help_query_feedback(query_id);
CREATE INDEX IF NOT EXISTS idx_help_query_feedback_organization_id ON help_query_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_help_query_feedback_created_at ON help_query_feedback(created_at DESC);

COMMENT ON TABLE help_query_feedback IS 'User feedback on help responses by query (AI Help Chat Enhancement)';

-- =====================================================
-- 1.3 embeddings: support help_doc content type
-- =====================================================
-- Drop existing check and add extended one including 'help_doc'
ALTER TABLE embeddings DROP CONSTRAINT IF EXISTS embeddings_content_type_check;
ALTER TABLE embeddings ADD CONSTRAINT embeddings_content_type_check
    CHECK (content_type IN ('project', 'portfolio', 'resource', 'risk', 'issue', 'document', 'knowledge_base', 'help_doc'));

CREATE INDEX IF NOT EXISTS idx_embeddings_content_type_help_doc ON embeddings(content_type) WHERE content_type = 'help_doc';

-- =====================================================
-- Triggers
-- =====================================================
CREATE OR REPLACE FUNCTION update_help_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_help_logs_updated_at_trigger ON help_logs;
CREATE TRIGGER update_help_logs_updated_at_trigger
    BEFORE UPDATE ON help_logs
    FOR EACH ROW EXECUTE FUNCTION update_help_logs_updated_at();

-- =====================================================
-- RLS (optional; service role used by backend)
-- =====================================================
ALTER TABLE help_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_query_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY help_logs_user_policy ON help_logs
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY help_query_feedback_user_policy ON help_query_feedback
    FOR ALL USING (auth.uid() = user_id);
