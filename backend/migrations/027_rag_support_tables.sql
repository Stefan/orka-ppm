-- Migration 027: RAG Support Tables
-- Creates additional tables for RAG conversation storage and AI model operations logging

-- ============================================================================
-- RAG Contexts Table - Stores conversation history for RAG queries
-- ============================================================================

CREATE TABLE IF NOT EXISTS rag_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    query TEXT NOT NULL,
    response TEXT,
    sources JSONB DEFAULT '[]',
    confidence_score FLOAT,
    operation_id TEXT,
    organization_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for rag_contexts
CREATE INDEX IF NOT EXISTS rag_contexts_user_id_idx ON rag_contexts(user_id);
CREATE INDEX IF NOT EXISTS rag_contexts_conversation_id_idx ON rag_contexts(conversation_id);
CREATE INDEX IF NOT EXISTS rag_contexts_organization_id_idx ON rag_contexts(organization_id);
CREATE INDEX IF NOT EXISTS rag_contexts_created_at_idx ON rag_contexts(created_at DESC);

-- Updated_at trigger for rag_contexts
CREATE OR REPLACE FUNCTION update_rag_contexts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rag_contexts_updated_at_trigger ON rag_contexts;
CREATE TRIGGER rag_contexts_updated_at_trigger
    BEFORE UPDATE ON rag_contexts
    FOR EACH ROW
    EXECUTE FUNCTION update_rag_contexts_updated_at();

-- ============================================================================
-- AI Model Operations Table - Logs all AI model operations for monitoring
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_model_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id TEXT NOT NULL UNIQUE,
    model_id TEXT NOT NULL,
    operation_type TEXT NOT NULL CHECK (operation_type IN ('rag_query', 'embedding', 'optimization', 'forecasting', 'validation', 'anomaly_detection', 'search')),
    user_id TEXT NOT NULL,
    inputs JSONB DEFAULT '{}',
    outputs JSONB DEFAULT '{}',
    confidence_score FLOAT,
    response_time_ms INTEGER,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    organization_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ai_model_operations
CREATE INDEX IF NOT EXISTS ai_model_operations_model_id_idx ON ai_model_operations(model_id);
CREATE INDEX IF NOT EXISTS ai_model_operations_operation_type_idx ON ai_model_operations(operation_type);
CREATE INDEX IF NOT EXISTS ai_model_operations_user_id_idx ON ai_model_operations(user_id);
CREATE INDEX IF NOT EXISTS ai_model_operations_success_idx ON ai_model_operations(success);
CREATE INDEX IF NOT EXISTS ai_model_operations_created_at_idx ON ai_model_operations(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_model_operations_organization_id_idx ON ai_model_operations(organization_id);

-- ============================================================================
-- AI Agent Metrics Table - Aggregated metrics for AI agents
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_agent_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type TEXT NOT NULL,
    operation TEXT NOT NULL,
    user_id TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    response_time_ms INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    confidence_score FLOAT,
    organization_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ai_agent_metrics
CREATE INDEX IF NOT EXISTS ai_agent_metrics_agent_type_idx ON ai_agent_metrics(agent_type);
CREATE INDEX IF NOT EXISTS ai_agent_metrics_operation_idx ON ai_agent_metrics(operation);
CREATE INDEX IF NOT EXISTS ai_agent_metrics_created_at_idx ON ai_agent_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_agent_metrics_success_idx ON ai_agent_metrics(success);

-- ============================================================================
-- AI Feedback Table - User feedback on AI responses
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type TEXT NOT NULL,
    query_id TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    user_id TEXT NOT NULL,
    organization_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ai_feedback
CREATE INDEX IF NOT EXISTS ai_feedback_agent_type_idx ON ai_feedback(agent_type);
CREATE INDEX IF NOT EXISTS ai_feedback_user_id_idx ON ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS ai_feedback_rating_idx ON ai_feedback(rating);
CREATE INDEX IF NOT EXISTS ai_feedback_created_at_idx ON ai_feedback(created_at DESC);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to get AI operation statistics
CREATE OR REPLACE FUNCTION get_ai_operation_stats(
    p_days INTEGER DEFAULT 30,
    p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
    operation_type TEXT,
    total_operations BIGINT,
    success_rate FLOAT,
    avg_response_time_ms FLOAT,
    avg_confidence_score FLOAT,
    total_input_tokens BIGINT,
    total_output_tokens BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.operation_type,
        COUNT(*)::BIGINT as total_operations,
        (COUNT(*) FILTER (WHERE o.success = true)::FLOAT / NULLIF(COUNT(*), 0)) as success_rate,
        AVG(o.response_time_ms)::FLOAT as avg_response_time_ms,
        AVG(o.confidence_score)::FLOAT as avg_confidence_score,
        SUM(o.input_tokens)::BIGINT as total_input_tokens,
        SUM(o.output_tokens)::BIGINT as total_output_tokens
    FROM ai_model_operations o
    WHERE o.created_at >= NOW() - (p_days || ' days')::INTERVAL
    AND (p_organization_id IS NULL OR o.organization_id = p_organization_id)
    GROUP BY o.operation_type
    ORDER BY total_operations DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get conversation history
CREATE OR REPLACE FUNCTION get_conversation_history(
    p_conversation_id TEXT,
    p_user_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    query TEXT,
    response TEXT,
    confidence_score FLOAT,
    sources JSONB,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.query,
        c.response,
        c.confidence_score,
        c.sources,
        c.created_at
    FROM rag_contexts c
    WHERE c.conversation_id = p_conversation_id
    AND (p_user_id IS NULL OR c.user_id = p_user_id)
    ORDER BY c.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE rag_contexts IS 'Stores RAG conversation history for context-aware responses';
COMMENT ON TABLE ai_model_operations IS 'Logs all AI model operations for monitoring and analytics';
COMMENT ON TABLE ai_agent_metrics IS 'Aggregated metrics for AI agent performance tracking';
COMMENT ON TABLE ai_feedback IS 'User feedback on AI responses for quality improvement';

COMMENT ON FUNCTION get_ai_operation_stats IS 'Returns aggregated statistics for AI operations';
COMMENT ON FUNCTION get_conversation_history IS 'Returns conversation history for a given conversation ID';

-- ============================================================================
-- Permissions (uncomment and adjust based on your role setup)
-- ============================================================================

-- GRANT SELECT, INSERT, UPDATE ON rag_contexts TO authenticated;
-- GRANT SELECT, INSERT ON ai_model_operations TO authenticated;
-- GRANT SELECT, INSERT ON ai_agent_metrics TO authenticated;
-- GRANT SELECT, INSERT ON ai_feedback TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_ai_operation_stats TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_conversation_history TO authenticated;
