-- Migration 028: Add Embedding Column to Audit Logs for RAG Search
-- Requirements: 14.1
-- Description: Adds vector embedding column to roche_audit_logs table for semantic search
--              using RAG (Retrieval-Augmented Generation)

-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. Add embedding column to roche_audit_logs table
-- ============================================================================

-- Add embedding column for semantic search
ALTER TABLE roche_audit_logs 
    ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add comment to the new column
COMMENT ON COLUMN roche_audit_logs.embedding IS 'Vector embedding (1536 dimensions for OpenAI text-embedding-ada-002) for semantic search';

-- ============================================================================
-- 2. Create vector similarity index for efficient search
-- ============================================================================

-- Create IVFFlat index for fast approximate nearest neighbor search
-- Using cosine distance operator for similarity search
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_embedding_vector 
    ON roche_audit_logs USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Note: The lists parameter should be adjusted based on dataset size
-- Rule of thumb: lists = sqrt(total_rows)
-- For 10,000 rows: lists = 100
-- For 100,000 rows: lists = 316
-- For 1,000,000 rows: lists = 1000

-- ============================================================================
-- 3. Create composite indexes for filtered vector search
-- ============================================================================

-- Composite index for tenant-scoped vector search
-- This allows efficient filtering by tenant_id before vector search
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_tenant_timestamp 
    ON roche_audit_logs(tenant_id, timestamp DESC)
    WHERE embedding IS NOT NULL;

-- Composite index for event type filtering with embeddings
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_event_type_embedding 
    ON roche_audit_logs(event_type)
    WHERE embedding IS NOT NULL;

-- ============================================================================
-- 4. Create RPC function for audit log semantic search
-- ============================================================================

CREATE OR REPLACE FUNCTION search_audit_logs_semantic(
    query_embedding vector(1536),
    p_tenant_id UUID,
    event_types text[] DEFAULT NULL,
    start_date timestamptz DEFAULT NULL,
    end_date timestamptz DEFAULT NULL,
    similarity_limit int DEFAULT 50,
    similarity_threshold float DEFAULT 0.0
)
RETURNS TABLE (
    id uuid,
    event_type varchar,
    user_id uuid,
    entity_type varchar,
    entity_id uuid,
    action_details jsonb,
    severity varchar,
    timestamp timestamptz,
    similarity_score float,
    is_anomaly boolean,
    anomaly_score decimal,
    category varchar,
    risk_level varchar,
    tags jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.event_type,
        l.user_id,
        l.entity_type,
        l.entity_id,
        l.action_details,
        l.severity,
        l.timestamp,
        (1 - (l.embedding <=> query_embedding))::float as similarity_score,
        l.is_anomaly,
        l.anomaly_score,
        l.category,
        l.risk_level,
        l.tags
    FROM roche_audit_logs l
    WHERE 
        l.tenant_id = p_tenant_id
        AND l.embedding IS NOT NULL
        AND (event_types IS NULL OR l.event_type = ANY(event_types))
        AND (start_date IS NULL OR l.timestamp >= start_date)
        AND (end_date IS NULL OR l.timestamp <= end_date)
        AND (1 - (l.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY l.embedding <=> query_embedding
    LIMIT similarity_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment to the function
COMMENT ON FUNCTION search_audit_logs_semantic IS 'Performs semantic search on audit logs using vector embeddings with tenant isolation and optional filters';

-- ============================================================================
-- 5. Create function to get audit logs without embeddings
-- ============================================================================

CREATE OR REPLACE FUNCTION get_audit_logs_without_embeddings(
    p_tenant_id UUID,
    batch_size int DEFAULT 100
)
RETURNS TABLE (
    id uuid,
    event_type varchar,
    user_id uuid,
    entity_type varchar,
    entity_id uuid,
    action_details jsonb,
    severity varchar,
    timestamp timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        l.event_type,
        l.user_id,
        l.entity_type,
        l.entity_id,
        l.action_details,
        l.severity,
        l.timestamp
    FROM roche_audit_logs l
    WHERE 
        l.tenant_id = p_tenant_id
        AND l.embedding IS NULL
    ORDER BY l.timestamp ASC
    LIMIT batch_size;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment to the function
COMMENT ON FUNCTION get_audit_logs_without_embeddings IS 'Returns audit logs that need embeddings generated, for background processing';

-- ============================================================================
-- 6. Create function to batch update embeddings
-- ============================================================================

CREATE OR REPLACE FUNCTION batch_update_audit_embeddings(
    log_ids uuid[],
    embeddings vector(1536)[]
)
RETURNS int AS $$
DECLARE
    updated_count int;
    i int;
BEGIN
    -- Validate array lengths match
    IF array_length(log_ids, 1) != array_length(embeddings, 1) THEN
        RAISE EXCEPTION 'Array lengths must match: log_ids=%, embeddings=%', 
            array_length(log_ids, 1), array_length(embeddings, 1);
    END IF;
    
    -- Update embeddings in batch
    FOR i IN 1..array_length(log_ids, 1) LOOP
        UPDATE roche_audit_logs 
        SET embedding = embeddings[i]
        WHERE id = log_ids[i];
    END LOOP;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Add comment to the function
COMMENT ON FUNCTION batch_update_audit_embeddings IS 'Batch updates embeddings for multiple audit log entries';

-- ============================================================================
-- 7. Create function to get embedding statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_audit_embedding_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_logs bigint,
    logs_with_embeddings bigint,
    logs_without_embeddings bigint,
    embedding_coverage_percent numeric,
    oldest_unembedded_log timestamptz,
    newest_embedded_log timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::bigint as total_logs,
        COUNT(l.embedding)::bigint as logs_with_embeddings,
        COUNT(*) FILTER (WHERE l.embedding IS NULL)::bigint as logs_without_embeddings,
        ROUND((COUNT(l.embedding)::numeric / NULLIF(COUNT(*), 0) * 100), 2) as embedding_coverage_percent,
        MIN(l.timestamp) FILTER (WHERE l.embedding IS NULL) as oldest_unembedded_log,
        MAX(l.timestamp) FILTER (WHERE l.embedding IS NOT NULL) as newest_embedded_log
    FROM roche_audit_logs l
    WHERE p_tenant_id IS NULL OR l.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment to the function
COMMENT ON FUNCTION get_audit_embedding_stats IS 'Returns statistics about embedding coverage for audit logs';

-- ============================================================================
-- 8. Grant permissions (adjust based on your role setup)
-- ============================================================================

-- Grant execute permissions on functions to authenticated users
-- Uncomment and adjust based on your auth setup:
-- GRANT EXECUTE ON FUNCTION search_audit_logs_semantic TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_audit_logs_without_embeddings TO authenticated;
-- GRANT EXECUTE ON FUNCTION batch_update_audit_embeddings TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_audit_embedding_stats TO authenticated;

-- ============================================================================
-- Migration tracking
-- ============================================================================

-- Add migration tracking
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (
    '028',
    'Add Embedding Column to Audit Logs for RAG Search',
    NOW()
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Usage examples:
--
-- 1. Search audit logs semantically:
--    SELECT * FROM search_audit_logs_semantic(
--        query_embedding := '[0.1, 0.2, ...]'::vector(1536),
--        p_tenant_id := 'tenant-uuid',
--        event_types := ARRAY['user_login', 'data_access'],
--        start_date := '2024-01-01'::timestamptz,
--        similarity_limit := 20,
--        similarity_threshold := 0.7
--    );
--
-- 2. Get logs needing embeddings:
--    SELECT * FROM get_audit_logs_without_embeddings('tenant-uuid', 100);
--
-- 3. Get embedding statistics:
--    SELECT * FROM get_audit_embedding_stats('tenant-uuid');
--
-- 4. Batch update embeddings:
--    SELECT batch_update_audit_embeddings(
--        ARRAY['log-id-1', 'log-id-2']::uuid[],
--        ARRAY['[0.1, ...]'::vector(1536), '[0.2, ...]'::vector(1536)]
--    );

