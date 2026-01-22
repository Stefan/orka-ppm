-- Migration 029: Audit Log Embedding Trigger
-- Requirements: 14.1
-- Description: Creates a trigger to automatically mark new audit logs for embedding generation
--              This trigger sets a flag that the background service can use to identify new logs

-- ============================================================================
-- 1. Create function to handle new audit log insertions
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_new_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    -- The embedding will be NULL by default for new logs
    -- The background service will pick these up and generate embeddings
    
    -- Optionally, we can send a notification to wake up the background service
    -- PERFORM pg_notify('new_audit_log', NEW.id::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment to the function
COMMENT ON FUNCTION notify_new_audit_log IS 'Trigger function for new audit log insertions to support background embedding generation';

-- ============================================================================
-- 2. Create trigger on roche_audit_logs table
-- ============================================================================

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF NOT EXISTS audit_log_embedding_trigger ON roche_audit_logs;

-- Create trigger that fires after insert
CREATE TRIGGER audit_log_embedding_trigger
    AFTER INSERT ON roche_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_audit_log();

-- Add comment to the trigger
COMMENT ON TRIGGER audit_log_embedding_trigger ON roche_audit_logs IS 'Trigger to notify background service of new audit logs needing embeddings';

-- ============================================================================
-- 3. Create function to manually trigger embedding generation for existing logs
-- ============================================================================

CREATE OR REPLACE FUNCTION regenerate_audit_embeddings(
    p_tenant_id UUID DEFAULT NULL,
    p_start_date timestamptz DEFAULT NULL,
    p_end_date timestamptz DEFAULT NULL,
    p_batch_size int DEFAULT 1000
)
RETURNS TABLE (
    logs_marked int,
    message text
) AS $$
DECLARE
    marked_count int;
BEGIN
    -- Set embedding to NULL for logs matching criteria
    -- This will cause them to be picked up by the background service
    UPDATE roche_audit_logs
    SET embedding = NULL
    WHERE 
        (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
        AND (p_start_date IS NULL OR timestamp >= p_start_date)
        AND (p_end_date IS NULL OR timestamp <= p_end_date)
        AND id IN (
            SELECT id 
            FROM roche_audit_logs 
            WHERE 
                (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
                AND (p_start_date IS NULL OR timestamp >= p_start_date)
                AND (p_end_date IS NULL OR timestamp <= p_end_date)
            LIMIT p_batch_size
        );
    
    GET DIAGNOSTICS marked_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        marked_count,
        format('Marked %s logs for embedding regeneration', marked_count);
END;
$$ LANGUAGE plpgsql;

-- Add comment to the function
COMMENT ON FUNCTION regenerate_audit_embeddings IS 'Manually mark audit logs for embedding regeneration by setting embedding to NULL';

-- ============================================================================
-- 4. Create function to check embedding generation progress
-- ============================================================================

CREATE OR REPLACE FUNCTION get_embedding_generation_progress(
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    total_logs bigint,
    logs_with_embeddings bigint,
    logs_without_embeddings bigint,
    embedding_coverage_percent numeric,
    oldest_unembedded_log timestamptz,
    newest_embedded_log timestamptz,
    estimated_time_remaining_minutes numeric
) AS $$
DECLARE
    avg_generation_rate numeric;
    logs_remaining bigint;
BEGIN
    -- Calculate average embedding generation rate (logs per minute)
    -- Based on logs embedded in the last hour
    SELECT COUNT(*)::numeric / 60.0 INTO avg_generation_rate
    FROM roche_audit_logs
    WHERE 
        embedding IS NOT NULL
        AND timestamp >= NOW() - INTERVAL '1 hour'
        AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
    
    -- Get logs without embeddings
    SELECT COUNT(*) INTO logs_remaining
    FROM roche_audit_logs
    WHERE 
        embedding IS NULL
        AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
    
    -- Return progress statistics
    RETURN QUERY
    SELECT 
        COUNT(*)::bigint as total_logs,
        COUNT(l.embedding)::bigint as logs_with_embeddings,
        COUNT(*) FILTER (WHERE l.embedding IS NULL)::bigint as logs_without_embeddings,
        ROUND((COUNT(l.embedding)::numeric / NULLIF(COUNT(*), 0) * 100), 2) as embedding_coverage_percent,
        MIN(l.timestamp) FILTER (WHERE l.embedding IS NULL) as oldest_unembedded_log,
        MAX(l.timestamp) FILTER (WHERE l.embedding IS NOT NULL) as newest_embedded_log,
        CASE 
            WHEN avg_generation_rate > 0 THEN ROUND(logs_remaining / avg_generation_rate, 2)
            ELSE NULL
        END as estimated_time_remaining_minutes
    FROM roche_audit_logs l
    WHERE p_tenant_id IS NULL OR l.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment to the function
COMMENT ON FUNCTION get_embedding_generation_progress IS 'Returns detailed progress statistics for embedding generation including estimated time remaining';

-- ============================================================================
-- 5. Grant permissions (adjust based on your role setup)
-- ============================================================================

-- Grant execute permissions on functions to authenticated users
-- Uncomment and adjust based on your auth setup:
-- GRANT EXECUTE ON FUNCTION notify_new_audit_log TO authenticated;
-- GRANT EXECUTE ON FUNCTION regenerate_audit_embeddings TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_embedding_generation_progress TO authenticated;

-- ============================================================================
-- Migration tracking
-- ============================================================================

-- Add migration tracking
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (
    '029',
    'Audit Log Embedding Trigger',
    NOW()
)
ON CONFLICT (version) DO NOTHING;

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Usage examples:
--
-- 1. Check embedding generation progress:
--    SELECT * FROM get_embedding_generation_progress('tenant-uuid');
--
-- 2. Manually regenerate embeddings for a date range:
--    SELECT * FROM regenerate_audit_embeddings(
--        p_tenant_id := 'tenant-uuid',
--        p_start_date := '2024-01-01'::timestamptz,
--        p_end_date := '2024-01-31'::timestamptz,
--        p_batch_size := 1000
--    );
--
-- 3. Regenerate all embeddings for a tenant:
--    SELECT * FROM regenerate_audit_embeddings(p_tenant_id := 'tenant-uuid');

