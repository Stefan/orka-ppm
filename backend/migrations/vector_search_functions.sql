-- Vector Search Functions for RAG System
-- This file contains SQL functions for efficient vector similarity search

-- Function to perform vector similarity search
CREATE OR REPLACE FUNCTION vector_similarity_search(
    query_embedding vector(1536),
    content_types text[] DEFAULT NULL,
    similarity_limit integer DEFAULT 5
)
RETURNS TABLE (
    content_type text,
    content_id uuid,
    content_text text,
    metadata jsonb,
    similarity_score float
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.content_type,
        e.content_id,
        e.content_text,
        e.metadata,
        (1 - (e.embedding <=> query_embedding))::float as similarity_score
    FROM embeddings e
    WHERE 
        CASE 
            WHEN content_types IS NOT NULL THEN e.content_type = ANY(content_types)
            ELSE TRUE
        END
    ORDER BY e.embedding <=> query_embedding
    LIMIT similarity_limit;
END;
$$;

-- Function to get embedding statistics
CREATE OR REPLACE FUNCTION get_embedding_stats()
RETURNS TABLE (
    content_type text,
    count bigint,
    avg_text_length float,
    last_updated timestamp with time zone
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.content_type,
        COUNT(*) as count,
        AVG(LENGTH(e.content_text))::float as avg_text_length,
        MAX(e.updated_at) as last_updated
    FROM embeddings e
    GROUP BY e.content_type
    ORDER BY count DESC;
END;
$$;

-- Function to find similar content by content ID
CREATE OR REPLACE FUNCTION find_similar_content(
    source_content_id uuid,
    similarity_limit integer DEFAULT 5
)
RETURNS TABLE (
    content_type text,
    content_id uuid,
    content_text text,
    metadata jsonb,
    similarity_score float
)
LANGUAGE plpgsql
AS $$
DECLARE
    source_embedding vector(1536);
BEGIN
    -- Get the embedding for the source content
    SELECT embedding INTO source_embedding
    FROM embeddings
    WHERE content_id = source_content_id;
    
    -- If source embedding not found, return empty result
    IF source_embedding IS NULL THEN
        RETURN;
    END IF;
    
    -- Find similar content
    RETURN QUERY
    SELECT 
        e.content_type,
        e.content_id,
        e.content_text,
        e.metadata,
        (1 - (e.embedding <=> source_embedding))::float as similarity_score
    FROM embeddings e
    WHERE e.content_id != source_content_id  -- Exclude the source itself
    ORDER BY e.embedding <=> source_embedding
    LIMIT similarity_limit;
END;
$$;

-- Function to batch update embeddings
CREATE OR REPLACE FUNCTION batch_update_embeddings(
    updates jsonb
)
RETURNS TABLE (
    content_id uuid,
    success boolean,
    error_message text
)
LANGUAGE plpgsql
AS $$
DECLARE
    update_record jsonb;
BEGIN
    -- Loop through each update in the batch
    FOR update_record IN SELECT jsonb_array_elements(updates)
    LOOP
        BEGIN
            -- Update or insert the embedding
            INSERT INTO embeddings (
                content_type,
                content_id,
                content_text,
                embedding,
                metadata
            ) VALUES (
                (update_record->>'content_type')::text,
                (update_record->>'content_id')::uuid,
                (update_record->>'content_text')::text,
                (update_record->>'embedding')::vector(1536),
                (update_record->'metadata')::jsonb
            )
            ON CONFLICT (content_type, content_id) 
            DO UPDATE SET
                content_text = EXCLUDED.content_text,
                embedding = EXCLUDED.embedding,
                metadata = EXCLUDED.metadata,
                updated_at = NOW();
            
            -- Return success
            RETURN QUERY SELECT 
                (update_record->>'content_id')::uuid,
                true,
                NULL::text;
                
        EXCEPTION WHEN OTHERS THEN
            -- Return error
            RETURN QUERY SELECT 
                (update_record->>'content_id')::uuid,
                false,
                SQLERRM;
        END;
    END LOOP;
END;
$$;

-- Function to clean up old embeddings
CREATE OR REPLACE FUNCTION cleanup_old_embeddings(
    days_old integer DEFAULT 30
)
RETURNS TABLE (
    deleted_count bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_rows bigint;
BEGIN
    -- Delete embeddings for content that no longer exists
    WITH deleted_projects AS (
        DELETE FROM embeddings e
        WHERE e.content_type = 'project'
        AND NOT EXISTS (
            SELECT 1 FROM projects p WHERE p.id = e.content_id
        )
        RETURNING 1
    ),
    deleted_portfolios AS (
        DELETE FROM embeddings e
        WHERE e.content_type = 'portfolio'
        AND NOT EXISTS (
            SELECT 1 FROM portfolios p WHERE p.id = e.content_id
        )
        RETURNING 1
    ),
    deleted_resources AS (
        DELETE FROM embeddings e
        WHERE e.content_type = 'resource'
        AND NOT EXISTS (
            SELECT 1 FROM resources r WHERE r.id = e.content_id
        )
        RETURNING 1
    ),
    deleted_risks AS (
        DELETE FROM embeddings e
        WHERE e.content_type = 'risk'
        AND NOT EXISTS (
            SELECT 1 FROM risks r WHERE r.id = e.content_id
        )
        RETURNING 1
    ),
    deleted_issues AS (
        DELETE FROM embeddings e
        WHERE e.content_type = 'issue'
        AND NOT EXISTS (
            SELECT 1 FROM issues i WHERE i.id = e.content_id
        )
        RETURNING 1
    )
    SELECT 
        (SELECT COUNT(*) FROM deleted_projects) +
        (SELECT COUNT(*) FROM deleted_portfolios) +
        (SELECT COUNT(*) FROM deleted_resources) +
        (SELECT COUNT(*) FROM deleted_risks) +
        (SELECT COUNT(*) FROM deleted_issues)
    INTO deleted_rows;
    
    RETURN QUERY SELECT deleted_rows;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION vector_similarity_search TO authenticated;
GRANT EXECUTE ON FUNCTION get_embedding_stats TO authenticated;
GRANT EXECUTE ON FUNCTION find_similar_content TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_embeddings TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_cosine ON embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_type_id ON embeddings(content_type, content_id);

COMMENT ON FUNCTION vector_similarity_search IS 'Performs vector similarity search using cosine distance';
COMMENT ON FUNCTION get_embedding_stats IS 'Returns statistics about stored embeddings';
COMMENT ON FUNCTION find_similar_content IS 'Finds content similar to a given content ID';
COMMENT ON FUNCTION batch_update_embeddings IS 'Updates multiple embeddings in a single transaction';
COMMENT ON FUNCTION cleanup_old_embeddings IS 'Removes embeddings for deleted content';