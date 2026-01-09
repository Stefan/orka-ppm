-- Help Content Vector Search Functions
-- Provides optimized vector similarity search for help content

-- Function for help content vector similarity search
CREATE OR REPLACE FUNCTION help_content_vector_search(
    query_embedding vector(1536),
    content_types text[] DEFAULT '{}',
    languages text[] DEFAULT '{}',
    tags text[] DEFAULT '{}',
    is_active boolean DEFAULT true,
    similarity_limit integer DEFAULT 10,
    offset_count integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    content_type varchar(50),
    title varchar(255),
    content text,
    tags text[],
    language varchar(5),
    version integer,
    is_active boolean,
    author_id uuid,
    reviewer_id uuid,
    review_status varchar(20),
    created_at timestamptz,
    updated_at timestamptz,
    published_at timestamptz,
    slug varchar(255),
    meta_description text,
    keywords text[],
    similarity_score float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hc.id,
        hc.content_type,
        hc.title,
        hc.content,
        hc.tags,
        hc.language,
        hc.version,
        hc.is_active,
        hc.author_id,
        hc.reviewer_id,
        hc.review_status,
        hc.created_at,
        hc.updated_at,
        hc.published_at,
        hc.slug,
        hc.meta_description,
        hc.keywords,
        (1 - (e.embedding <=> query_embedding)) as similarity_score
    FROM help_content hc
    JOIN embeddings e ON e.content_id::uuid = hc.id AND e.content_type = 'help_content'
    WHERE 
        (cardinality(content_types) = 0 OR hc.content_type = ANY(content_types))
        AND (cardinality(languages) = 0 OR hc.language = ANY(languages))
        AND (cardinality(tags) = 0 OR hc.tags && tags)
        AND (is_active IS NULL OR hc.is_active = is_active)
        AND hc.review_status = 'approved'
        AND hc.published_at IS NOT NULL
    ORDER BY e.embedding <=> query_embedding
    LIMIT similarity_limit
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Function for general vector similarity search (used by RAG agent)
CREATE OR REPLACE FUNCTION vector_similarity_search(
    query_embedding vector(1536),
    content_types text[] DEFAULT '{}',
    similarity_limit integer DEFAULT 5
)
RETURNS TABLE (
    content_type text,
    content_id text,
    content_text text,
    metadata jsonb,
    similarity_score float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.content_type,
        e.content_id,
        e.content_text,
        e.metadata,
        (1 - (e.embedding <=> query_embedding)) as similarity_score
    FROM embeddings e
    WHERE 
        (cardinality(content_types) = 0 OR e.content_type = ANY(content_types))
    ORDER BY e.embedding <=> query_embedding
    LIMIT similarity_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to get help content with engagement metrics
CREATE OR REPLACE FUNCTION get_help_content_with_metrics(
    content_id_param uuid DEFAULT NULL,
    content_type_param varchar(50) DEFAULT NULL,
    language_param varchar(5) DEFAULT NULL,
    limit_param integer DEFAULT 10,
    offset_param integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    content_type varchar(50),
    title varchar(255),
    content text,
    tags text[],
    language varchar(5),
    version integer,
    is_active boolean,
    author_id uuid,
    reviewer_id uuid,
    review_status varchar(20),
    created_at timestamptz,
    updated_at timestamptz,
    published_at timestamptz,
    slug varchar(255),
    meta_description text,
    keywords text[],
    unique_viewers bigint,
    total_views bigint,
    avg_rating numeric,
    feedback_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hc.id,
        hc.content_type,
        hc.title,
        hc.content,
        hc.tags,
        hc.language,
        hc.version,
        hc.is_active,
        hc.author_id,
        hc.reviewer_id,
        hc.review_status,
        hc.created_at,
        hc.updated_at,
        hc.published_at,
        hc.slug,
        hc.meta_description,
        hc.keywords,
        COALESCE(COUNT(DISTINCT ha.user_id), 0) as unique_viewers,
        COALESCE(COUNT(ha.id), 0) as total_views,
        COALESCE(AVG(hf.rating), 0) as avg_rating,
        COALESCE(COUNT(hf.id), 0) as feedback_count
    FROM help_content hc
    LEFT JOIN help_analytics ha ON (ha.event_data->>'content_id')::uuid = hc.id
    LEFT JOIN help_messages hm ON hm.sources @> jsonb_build_array(jsonb_build_object('content_id', hc.id))
    LEFT JOIN help_feedback hf ON hm.id = hf.message_id
    WHERE 
        (content_id_param IS NULL OR hc.id = content_id_param)
        AND (content_type_param IS NULL OR hc.content_type = content_type_param)
        AND (language_param IS NULL OR hc.language = language_param)
        AND hc.is_active = true
    GROUP BY hc.id, hc.content_type, hc.title, hc.content, hc.tags, hc.language, 
             hc.version, hc.is_active, hc.author_id, hc.reviewer_id, hc.review_status,
             hc.created_at, hc.updated_at, hc.published_at, hc.slug, hc.meta_description, hc.keywords
    ORDER BY hc.updated_at DESC
    LIMIT limit_param
    OFFSET offset_param;
END;
$$ LANGUAGE plpgsql;

-- Function to search help content by full-text search
CREATE OR REPLACE FUNCTION help_content_fulltext_search(
    search_query text,
    content_types text[] DEFAULT '{}',
    languages text[] DEFAULT '{}',
    limit_param integer DEFAULT 10,
    offset_param integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    content_type varchar(50),
    title varchar(255),
    content text,
    tags text[],
    language varchar(5),
    version integer,
    is_active boolean,
    author_id uuid,
    reviewer_id uuid,
    review_status varchar(20),
    created_at timestamptz,
    updated_at timestamptz,
    published_at timestamptz,
    slug varchar(255),
    meta_description text,
    keywords text[],
    search_rank real
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hc.id,
        hc.content_type,
        hc.title,
        hc.content,
        hc.tags,
        hc.language,
        hc.version,
        hc.is_active,
        hc.author_id,
        hc.reviewer_id,
        hc.review_status,
        hc.created_at,
        hc.updated_at,
        hc.published_at,
        hc.slug,
        hc.meta_description,
        hc.keywords,
        ts_rank(to_tsvector('english', hc.title || ' ' || hc.content), plainto_tsquery('english', search_query)) as search_rank
    FROM help_content hc
    WHERE 
        to_tsvector('english', hc.title || ' ' || hc.content) @@ plainto_tsquery('english', search_query)
        AND (cardinality(content_types) = 0 OR hc.content_type = ANY(content_types))
        AND (cardinality(languages) = 0 OR hc.language = ANY(languages))
        AND hc.is_active = true
        AND hc.review_status = 'approved'
        AND hc.published_at IS NOT NULL
    ORDER BY search_rank DESC, hc.updated_at DESC
    LIMIT limit_param
    OFFSET offset_param;
END;
$$ LANGUAGE plpgsql;

-- Function to get popular help content based on analytics
CREATE OR REPLACE FUNCTION get_popular_help_content(
    days_back integer DEFAULT 30,
    content_type_param varchar(50) DEFAULT NULL,
    language_param varchar(5) DEFAULT NULL,
    limit_param integer DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    title varchar(255),
    content_type varchar(50),
    language varchar(5),
    view_count bigint,
    unique_viewers bigint,
    avg_rating numeric,
    feedback_count bigint,
    popularity_score numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hc.id,
        hc.title,
        hc.content_type,
        hc.language,
        COUNT(ha.id) as view_count,
        COUNT(DISTINCT ha.user_id) as unique_viewers,
        COALESCE(AVG(hf.rating), 0) as avg_rating,
        COUNT(hf.id) as feedback_count,
        -- Popularity score: weighted combination of views, unique viewers, and rating
        (COUNT(ha.id) * 0.3 + COUNT(DISTINCT ha.user_id) * 0.5 + COALESCE(AVG(hf.rating), 0) * 0.2) as popularity_score
    FROM help_content hc
    LEFT JOIN help_analytics ha ON (ha.event_data->>'content_id')::uuid = hc.id 
        AND ha.timestamp > NOW() - INTERVAL '1 day' * days_back
    LEFT JOIN help_messages hm ON hm.sources @> jsonb_build_array(jsonb_build_object('content_id', hc.id))
    LEFT JOIN help_feedback hf ON hm.id = hf.message_id
    WHERE 
        hc.is_active = true
        AND hc.review_status = 'approved'
        AND hc.published_at IS NOT NULL
        AND (content_type_param IS NULL OR hc.content_type = content_type_param)
        AND (language_param IS NULL OR hc.language = language_param)
    GROUP BY hc.id, hc.title, hc.content_type, hc.language
    HAVING COUNT(ha.id) > 0  -- Only include content that has been viewed
    ORDER BY popularity_score DESC, view_count DESC
    LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- Function to get related help content based on tags and content type
CREATE OR REPLACE FUNCTION get_related_help_content(
    content_id_param uuid,
    limit_param integer DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    title varchar(255),
    content_type varchar(50),
    language varchar(5),
    tags text[],
    similarity_score integer
) AS $$
DECLARE
    source_content RECORD;
BEGIN
    -- Get the source content details
    SELECT hc.content_type, hc.language, hc.tags 
    INTO source_content
    FROM help_content hc 
    WHERE hc.id = content_id_param;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        hc.id,
        hc.title,
        hc.content_type,
        hc.language,
        hc.tags,
        -- Calculate similarity based on shared tags and content type
        CASE 
            WHEN hc.content_type = source_content.content_type THEN 2
            ELSE 0
        END + 
        CASE 
            WHEN hc.language = source_content.language THEN 1
            ELSE 0
        END +
        COALESCE(array_length(hc.tags & source_content.tags, 1), 0) as similarity_score
    FROM help_content hc
    WHERE 
        hc.id != content_id_param
        AND hc.is_active = true
        AND hc.review_status = 'approved'
        AND hc.published_at IS NOT NULL
        AND (
            hc.content_type = source_content.content_type
            OR hc.language = source_content.language
            OR hc.tags && source_content.tags
        )
    ORDER BY similarity_score DESC, hc.updated_at DESC
    LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- Create help content versions table if it doesn't exist
CREATE TABLE IF NOT EXISTS help_content_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL REFERENCES help_content(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    changes_summary TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_content_version UNIQUE (content_id, version_number)
);

-- Create indexes for help content versions
CREATE INDEX IF NOT EXISTS idx_help_content_versions_content_id ON help_content_versions(content_id);
CREATE INDEX IF NOT EXISTS idx_help_content_versions_version ON help_content_versions(version_number);
CREATE INDEX IF NOT EXISTS idx_help_content_versions_created_at ON help_content_versions(created_at);

-- Apply RLS to help content versions
ALTER TABLE help_content_versions ENABLE ROW LEVEL SECURITY;

-- Help content versions policies - content managers can access all versions
CREATE POLICY help_content_versions_admin_policy ON help_content_versions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.user_id = auth.uid()
            AND up.role IN ('admin', 'content_manager')
        )
    );

-- Comments for new functions
COMMENT ON FUNCTION help_content_vector_search(vector, text[], text[], text[], boolean, integer, integer) IS 'Vector similarity search for help content with filtering options';
COMMENT ON FUNCTION vector_similarity_search(vector, text[], integer) IS 'General vector similarity search for RAG agent';
COMMENT ON FUNCTION get_help_content_with_metrics(uuid, varchar, varchar, integer, integer) IS 'Get help content with engagement metrics';
COMMENT ON FUNCTION help_content_fulltext_search(text, text[], text[], integer, integer) IS 'Full-text search for help content';
COMMENT ON FUNCTION get_popular_help_content(integer, varchar, varchar, integer) IS 'Get popular help content based on analytics';
COMMENT ON FUNCTION get_related_help_content(uuid, integer) IS 'Get related help content based on tags and content type';

COMMENT ON TABLE help_content_versions IS 'Version history for help content changes';