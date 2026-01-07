-- Feedback Analysis Enhancement
-- Migration 007: Add feedback analysis table and enhance training data preparation

-- Feedback Analysis table
CREATE TABLE IF NOT EXISTS feedback_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id VARCHAR(255) REFERENCES user_feedback(feedback_id),
    sentiment_score DECIMAL(3,2), -- -1 to 1
    quality_indicators JSONB DEFAULT '{}',
    improvement_suggestions JSONB DEFAULT '[]',
    training_value DECIMAL(3,2), -- 0 to 1
    confidence DECIMAL(3,2), -- 0 to 1
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add operation_id column to rag_contexts if it doesn't exist
ALTER TABLE rag_contexts ADD COLUMN IF NOT EXISTS operation_id VARCHAR(255);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_feedback_id ON feedback_analysis(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_sentiment_score ON feedback_analysis(sentiment_score);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_training_value ON feedback_analysis(training_value);
CREATE INDEX IF NOT EXISTS idx_feedback_analysis_analyzed_at ON feedback_analysis(analyzed_at);

CREATE INDEX IF NOT EXISTS idx_rag_contexts_operation_id ON rag_contexts(operation_id);

-- Enable Row Level Security
ALTER TABLE feedback_analysis ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view feedback analysis" ON feedback_analysis
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System can manage feedback analysis" ON feedback_analysis
    FOR ALL USING (auth.role() = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE feedback_analysis IS 'Analysis results for user feedback including sentiment and quality metrics';
COMMENT ON COLUMN feedback_analysis.sentiment_score IS 'Sentiment score from -1 (negative) to 1 (positive)';
COMMENT ON COLUMN feedback_analysis.quality_indicators IS 'JSON object with various quality metrics';
COMMENT ON COLUMN feedback_analysis.training_value IS 'Value of this feedback for training purposes (0-1)';

-- Create a function to get feedback statistics
CREATE OR REPLACE FUNCTION get_feedback_statistics(
    p_model_id VARCHAR(100) DEFAULT NULL,
    p_operation_type VARCHAR(50) DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    total_feedback BIGINT,
    average_rating DECIMAL(3,2),
    positive_feedback BIGINT,
    negative_feedback BIGINT,
    neutral_feedback BIGINT,
    avg_sentiment_score DECIMAL(3,2),
    high_quality_feedback BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH feedback_data AS (
        SELECT 
            fb.rating,
            fa.sentiment_score,
            fa.training_value
        FROM user_feedback fb
        JOIN ai_model_operations op ON fb.operation_id = op.operation_id
        LEFT JOIN feedback_analysis fa ON fb.feedback_id = fa.feedback_id
        WHERE fb.timestamp >= NOW() - INTERVAL '1 day' * p_days
            AND (p_model_id IS NULL OR op.model_id = p_model_id)
            AND (p_operation_type IS NULL OR op.operation_type = p_operation_type)
    )
    SELECT 
        COUNT(*) as total_feedback,
        AVG(rating::DECIMAL) as average_rating,
        COUNT(*) FILTER (WHERE rating >= 4) as positive_feedback,
        COUNT(*) FILTER (WHERE rating <= 2) as negative_feedback,
        COUNT(*) FILTER (WHERE rating = 3) as neutral_feedback,
        AVG(sentiment_score) as avg_sentiment_score,
        COUNT(*) FILTER (WHERE training_value >= 0.7) as high_quality_feedback
    FROM feedback_data;
END;
$$ LANGUAGE plpgsql;

-- Create a function to identify improvement opportunities
CREATE OR REPLACE FUNCTION identify_improvement_opportunities(
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    opportunity_type VARCHAR(100),
    description TEXT,
    affected_count BIGINT,
    priority VARCHAR(20)
) AS $$
BEGIN
    -- Low rating patterns
    INSERT INTO temp_opportunities
    SELECT 
        'low_ratings' as opportunity_type,
        'High number of low ratings detected' as description,
        COUNT(*) as affected_count,
        CASE 
            WHEN COUNT(*) > 50 THEN 'high'
            WHEN COUNT(*) > 20 THEN 'medium'
            ELSE 'low'
        END as priority
    FROM user_feedback fb
    WHERE fb.rating <= 2 
        AND fb.timestamp >= NOW() - INTERVAL '1 day' * p_days
    HAVING COUNT(*) > 0;
    
    -- Slow response patterns
    INSERT INTO temp_opportunities
    SELECT 
        'slow_responses' as opportunity_type,
        'Slow response times affecting user experience' as description,
        COUNT(*) as affected_count,
        CASE 
            WHEN COUNT(*) > 100 THEN 'high'
            WHEN COUNT(*) > 50 THEN 'medium'
            ELSE 'low'
        END as priority
    FROM user_feedback fb
    JOIN ai_model_operations op ON fb.operation_id = op.operation_id
    WHERE op.response_time_ms > 5000
        AND fb.timestamp >= NOW() - INTERVAL '1 day' * p_days
    HAVING COUNT(*) > 0;
    
    -- Low confidence patterns
    INSERT INTO temp_opportunities
    SELECT 
        'low_confidence' as opportunity_type,
        'Low confidence scores in AI responses' as description,
        COUNT(*) as affected_count,
        CASE 
            WHEN COUNT(*) > 100 THEN 'high'
            WHEN COUNT(*) > 50 THEN 'medium'
            ELSE 'low'
        END as priority
    FROM user_feedback fb
    JOIN ai_model_operations op ON fb.operation_id = op.operation_id
    WHERE op.confidence_score < 0.7
        AND fb.timestamp >= NOW() - INTERVAL '1 day' * p_days
    HAVING COUNT(*) > 0;
    
    RETURN QUERY SELECT * FROM temp_opportunities;
    DROP TABLE temp_opportunities;
END;
$$ LANGUAGE plpgsql;

-- Create a view for training data quality metrics
CREATE OR REPLACE VIEW training_data_quality_metrics AS
SELECT 
    td.model_id,
    td.operation_type,
    COUNT(*) as total_training_points,
    AVG(td.quality_score) as avg_quality_score,
    AVG(td.feedback_score) as avg_feedback_score,
    AVG(td.training_weight) as avg_training_weight,
    COUNT(*) FILTER (WHERE td.quality_score >= 0.8) as high_quality_points,
    COUNT(*) FILTER (WHERE td.quality_score >= 0.6) as medium_quality_points,
    COUNT(*) FILTER (WHERE td.quality_score < 0.6) as low_quality_points,
    MAX(td.updated_at) as last_updated
FROM model_training_data td
GROUP BY td.model_id, td.operation_type;

COMMENT ON VIEW training_data_quality_metrics IS 'Quality metrics for training data by model and operation type';

-- Create a function to clean up old feedback analysis data
CREATE OR REPLACE FUNCTION cleanup_old_feedback_analysis(
    p_days_to_keep INTEGER DEFAULT 365
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM feedback_analysis 
    WHERE analyzed_at < NOW() - INTERVAL '1 day' * p_days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up old data (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-feedback-analysis', '0 2 * * 0', 'SELECT cleanup_old_feedback_analysis(365);');