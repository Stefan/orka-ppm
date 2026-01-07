-- AI Model Management and Monitoring System
-- Migration 006: Create tables for comprehensive AI model management

-- AI Model Operations table (enhanced version of existing ai_model_operations)
CREATE TABLE IF NOT EXISTS ai_model_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id VARCHAR(255) UNIQUE NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    operation_type VARCHAR(50) NOT NULL, -- 'rag_query', 'resource_optimization', etc.
    user_id UUID REFERENCES auth.users(id),
    inputs JSONB DEFAULT '{}',
    outputs JSONB DEFAULT '{}',
    confidence_score DECIMAL(3,2),
    response_time_ms INTEGER,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feedback_id VARCHAR(255) UNIQUE NOT NULL,
    operation_id VARCHAR(255) REFERENCES ai_model_operations(operation_id),
    user_id UUID REFERENCES auth.users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_type VARCHAR(50) NOT NULL, -- 'helpful', 'accurate', 'relevant', 'fast'
    comments TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B Tests table
CREATE TABLE IF NOT EXISTS ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id VARCHAR(255) UNIQUE NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    model_a_id VARCHAR(100) NOT NULL,
    model_b_id VARCHAR(100) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    traffic_split DECIMAL(3,2) CHECK (traffic_split >= 0 AND traffic_split <= 1),
    success_metrics JSONB DEFAULT '[]',
    duration_days INTEGER,
    min_sample_size INTEGER DEFAULT 100,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'paused', 'cancelled'
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Alerts table
CREATE TABLE IF NOT EXISTS performance_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id VARCHAR(255) UNIQUE NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    performance_status VARCHAR(20) NOT NULL, -- 'excellent', 'good', 'degraded', 'critical'
    metrics JSONB DEFAULT '{}',
    alert_message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id VARCHAR(255) UNIQUE NOT NULL,
    alert_id VARCHAR(255) REFERENCES performance_alerts(alert_id),
    type VARCHAR(50) NOT NULL, -- 'performance_degradation', 'ab_test_complete', etc.
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recipients JSONB DEFAULT '[]',
    delivery_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Model Training Data table (for feedback-based training)
CREATE TABLE IF NOT EXISTS model_training_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id VARCHAR(255) REFERENCES ai_model_operations(operation_id),
    model_id VARCHAR(100) NOT NULL,
    operation_type VARCHAR(50) NOT NULL,
    input_data JSONB NOT NULL,
    expected_output JSONB,
    actual_output JSONB,
    feedback_score DECIMAL(3,2),
    quality_score DECIMAL(3,2),
    training_weight DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_model_operations_model_id ON ai_model_operations(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_operations_operation_type ON ai_model_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_ai_model_operations_user_id ON ai_model_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_operations_timestamp ON ai_model_operations(timestamp);
CREATE INDEX IF NOT EXISTS idx_ai_model_operations_success ON ai_model_operations(success);

CREATE INDEX IF NOT EXISTS idx_user_feedback_operation_id ON user_feedback(operation_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_rating ON user_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_user_feedback_timestamp ON user_feedback(timestamp);

CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_operation_type ON ab_tests(operation_type);
CREATE INDEX IF NOT EXISTS idx_ab_tests_start_date ON ab_tests(start_date);

CREATE INDEX IF NOT EXISTS idx_performance_alerts_model_id ON performance_alerts(model_id);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_status ON performance_alerts(performance_status);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_resolved ON performance_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_timestamp ON performance_alerts(timestamp);

CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_delivery_status ON notifications(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications(sent_at);

CREATE INDEX IF NOT EXISTS idx_model_training_data_model_id ON model_training_data(model_id);
CREATE INDEX IF NOT EXISTS idx_model_training_data_operation_type ON model_training_data(operation_type);
CREATE INDEX IF NOT EXISTS idx_model_training_data_quality_score ON model_training_data(quality_score);

-- Enable Row Level Security
ALTER TABLE ai_model_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_training_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can access their own AI operations" ON ai_model_operations
    FOR ALL USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can access their own feedback" ON user_feedback
    FOR ALL USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view AB tests" ON ab_tests
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage AB tests" ON ab_tests
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view performance alerts" ON performance_alerts
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage performance alerts" ON performance_alerts
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view notifications" ON notifications
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "System can manage notifications" ON notifications
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "System can manage training data" ON model_training_data
    FOR ALL USING (auth.role() = 'service_role');

-- Add comments for documentation
COMMENT ON TABLE ai_model_operations IS 'Comprehensive logging of AI model operations';
COMMENT ON TABLE user_feedback IS 'User feedback on AI model outputs for training and improvement';
COMMENT ON TABLE ab_tests IS 'A/B test configurations and management';
COMMENT ON TABLE performance_alerts IS 'Performance degradation alerts for AI models';
COMMENT ON TABLE notifications IS 'System notifications for alerts and events';
COMMENT ON TABLE model_training_data IS 'Training data derived from user feedback and operations';

-- Create a function to automatically update training data from feedback
CREATE OR REPLACE FUNCTION update_training_data_from_feedback()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert training data when feedback is provided
    INSERT INTO model_training_data (
        operation_id,
        model_id,
        operation_type,
        input_data,
        actual_output,
        feedback_score,
        quality_score,
        training_weight
    )
    SELECT 
        NEW.operation_id,
        op.model_id,
        op.operation_type,
        op.inputs,
        op.outputs,
        NEW.rating / 5.0, -- Convert 1-5 rating to 0-1 score
        CASE 
            WHEN NEW.rating >= 4 THEN 1.0
            WHEN NEW.rating >= 3 THEN 0.7
            WHEN NEW.rating >= 2 THEN 0.4
            ELSE 0.1
        END,
        CASE 
            WHEN NEW.rating >= 4 THEN 1.5 -- Higher weight for positive feedback
            WHEN NEW.rating <= 2 THEN 0.5 -- Lower weight for negative feedback
            ELSE 1.0
        END
    FROM ai_model_operations op
    WHERE op.operation_id = NEW.operation_id
    ON CONFLICT (operation_id) DO UPDATE SET
        feedback_score = EXCLUDED.feedback_score,
        quality_score = EXCLUDED.quality_score,
        training_weight = EXCLUDED.training_weight,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update training data
CREATE TRIGGER trigger_update_training_data_from_feedback
    AFTER INSERT ON user_feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_training_data_from_feedback();

-- Create a function to calculate model performance metrics
CREATE OR REPLACE FUNCTION calculate_model_performance_metrics(
    p_model_id VARCHAR(100),
    p_operation_type VARCHAR(50) DEFAULT NULL,
    p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    model_id VARCHAR(100),
    operation_type VARCHAR(50),
    total_operations BIGINT,
    success_rate DECIMAL(5,4),
    avg_response_time_ms DECIMAL(10,2),
    avg_confidence_score DECIMAL(3,2),
    error_rate DECIMAL(5,4),
    avg_input_tokens DECIMAL(10,2),
    avg_output_tokens DECIMAL(10,2),
    user_satisfaction_score DECIMAL(3,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH operation_stats AS (
        SELECT 
            op.model_id,
            op.operation_type,
            COUNT(*) as total_ops,
            AVG(CASE WHEN op.success THEN 1.0 ELSE 0.0 END) as success_rate,
            AVG(op.response_time_ms::DECIMAL) as avg_response_time,
            AVG(op.confidence_score) as avg_confidence,
            AVG(CASE WHEN NOT op.success THEN 1.0 ELSE 0.0 END) as error_rate,
            AVG(op.input_tokens::DECIMAL) as avg_input_tokens,
            AVG(op.output_tokens::DECIMAL) as avg_output_tokens
        FROM ai_model_operations op
        WHERE op.model_id = p_model_id
            AND (p_operation_type IS NULL OR op.operation_type = p_operation_type)
            AND op.timestamp >= NOW() - INTERVAL '1 day' * p_days
        GROUP BY op.model_id, op.operation_type
    ),
    feedback_stats AS (
        SELECT 
            op.model_id,
            op.operation_type,
            AVG(fb.rating::DECIMAL / 5.0) as avg_satisfaction
        FROM ai_model_operations op
        JOIN user_feedback fb ON op.operation_id = fb.operation_id
        WHERE op.model_id = p_model_id
            AND (p_operation_type IS NULL OR op.operation_type = p_operation_type)
            AND op.timestamp >= NOW() - INTERVAL '1 day' * p_days
        GROUP BY op.model_id, op.operation_type
    )
    SELECT 
        os.model_id,
        os.operation_type,
        os.total_ops,
        os.success_rate,
        os.avg_response_time,
        os.avg_confidence,
        os.error_rate,
        os.avg_input_tokens,
        os.avg_output_tokens,
        COALESCE(fs.avg_satisfaction, NULL)
    FROM operation_stats os
    LEFT JOIN feedback_stats fs ON os.model_id = fs.model_id AND os.operation_type = fs.operation_type;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy access to model performance
CREATE OR REPLACE VIEW model_performance_summary AS
SELECT 
    op.model_id,
    op.operation_type,
    COUNT(*) as total_operations,
    AVG(CASE WHEN op.success THEN 1.0 ELSE 0.0 END) as success_rate,
    AVG(op.response_time_ms) as avg_response_time_ms,
    AVG(op.confidence_score) as avg_confidence_score,
    AVG(CASE WHEN NOT op.success THEN 1.0 ELSE 0.0 END) as error_rate,
    AVG(op.input_tokens + op.output_tokens) as avg_total_tokens,
    AVG(fb.rating::DECIMAL / 5.0) as user_satisfaction_score,
    MAX(op.timestamp) as last_operation,
    COUNT(DISTINCT op.user_id) as unique_users
FROM ai_model_operations op
LEFT JOIN user_feedback fb ON op.operation_id = fb.operation_id
WHERE op.timestamp >= NOW() - INTERVAL '30 days'
GROUP BY op.model_id, op.operation_type;

COMMENT ON VIEW model_performance_summary IS 'Summary view of model performance metrics for the last 30 days';