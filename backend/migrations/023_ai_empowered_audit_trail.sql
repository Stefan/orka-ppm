-- Migration: AI-Empowered Audit Trail Schema
-- Requirements: 1.3, 1.4, 1.8, 3.10, 4.1, 4.4, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 6.2, 9.1, 9.4, 9.5
-- Description: Comprehensive schema for AI-powered audit trail with anomaly detection, 
--              semantic search, ML classification, and external integrations
--
-- NOTE: This migration creates the base roche_audit_logs table if it doesn't exist,
--       then extends it with AI capabilities. Safe to run even if table already exists.

-- Ensure pgvector extension is enabled (should already be enabled from ai_features_schema.sql)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 0. Create base roche_audit_logs table if it doesn't exist
-- ============================================================================

-- Create base audit logs table (if not already created)
CREATE TABLE IF NOT EXISTS roche_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    action_details JSONB NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    ip_address VARCHAR(45),
    user_agent TEXT,
    project_id UUID,
    performance_metrics JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create base indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_event_type ON roche_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_user_id ON roche_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_entity_type ON roche_audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_entity_id ON roche_audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_timestamp ON roche_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_severity ON roche_audit_logs(severity);

-- ============================================================================
-- 1. Extend roche_audit_logs table with AI fields
-- ============================================================================

-- Add AI-related columns to roche_audit_logs table
ALTER TABLE roche_audit_logs 
    ADD COLUMN IF NOT EXISTS anomaly_score DECIMAL(3,2),
    ADD COLUMN IF NOT EXISTS is_anomaly BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS category VARCHAR(50),
    ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20),
    ADD COLUMN IF NOT EXISTS tags JSONB,
    ADD COLUMN IF NOT EXISTS ai_insights JSONB,
    ADD COLUMN IF NOT EXISTS tenant_id UUID,
    ADD COLUMN IF NOT EXISTS hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64);

-- Add constraints for new fields (using DO block for IF NOT EXISTS behavior)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_anomaly_score'
    ) THEN
        ALTER TABLE roche_audit_logs 
            ADD CONSTRAINT valid_anomaly_score 
                CHECK (anomaly_score IS NULL OR (anomaly_score >= 0 AND anomaly_score <= 1));
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_risk_level'
    ) THEN
        ALTER TABLE roche_audit_logs 
            ADD CONSTRAINT valid_risk_level 
                CHECK (risk_level IS NULL OR risk_level IN ('Low', 'Medium', 'High', 'Critical'));
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_category'
    ) THEN
        ALTER TABLE roche_audit_logs 
            ADD CONSTRAINT valid_category 
                CHECK (category IS NULL OR category IN (
                    'Security Change', 
                    'Financial Impact', 
                    'Resource Allocation', 
                    'Risk Event', 
                    'Compliance Action'
                ));
    END IF;
END $$;

-- Create indexes on new fields for efficient querying
CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_anomaly_score 
    ON roche_audit_logs(anomaly_score) 
    WHERE is_anomaly = TRUE;

CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_category 
    ON roche_audit_logs(category);

CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_risk_level 
    ON roche_audit_logs(risk_level);

CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_tenant_id 
    ON roche_audit_logs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_tags 
    ON roche_audit_logs USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_roche_audit_logs_is_anomaly 
    ON roche_audit_logs(is_anomaly) 
    WHERE is_anomaly = TRUE;

-- Add comments to new columns
COMMENT ON COLUMN roche_audit_logs.anomaly_score IS 'ML-computed anomaly score (0-1), NULL if not analyzed';
COMMENT ON COLUMN roche_audit_logs.is_anomaly IS 'Flag indicating if event is classified as anomaly (score > 0.7)';
COMMENT ON COLUMN roche_audit_logs.category IS 'ML-assigned category: Security Change, Financial Impact, Resource Allocation, Risk Event, Compliance Action';
COMMENT ON COLUMN roche_audit_logs.risk_level IS 'ML-assigned risk level: Low, Medium, High, Critical';
COMMENT ON COLUMN roche_audit_logs.tags IS 'AI-generated tags and metadata for the event';
COMMENT ON COLUMN roche_audit_logs.ai_insights IS 'AI-generated insights and explanations for the event';
COMMENT ON COLUMN roche_audit_logs.tenant_id IS 'Tenant identifier for multi-tenant isolation';
COMMENT ON COLUMN roche_audit_logs.hash IS 'SHA-256 hash of event data for tamper detection';
COMMENT ON COLUMN roche_audit_logs.previous_hash IS 'Hash of previous event in chain for integrity verification';

-- ============================================================================
-- 2. Create audit_embeddings table for semantic search
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_event_id UUID NOT NULL REFERENCES roche_audit_logs(id) ON DELETE CASCADE,
    embedding vector(1536),  -- OpenAI ada-002 embedding dimension
    content_text TEXT NOT NULL,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_audit_event_embedding UNIQUE(audit_event_id)
);

-- Create vector similarity index using IVFFlat for efficient cosine similarity search
CREATE INDEX IF NOT EXISTS idx_audit_embeddings_vector 
    ON audit_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Create tenant isolation index
CREATE INDEX IF NOT EXISTS idx_audit_embeddings_tenant 
    ON audit_embeddings(tenant_id);

-- Create composite index for tenant-scoped vector search
CREATE INDEX IF NOT EXISTS idx_audit_embeddings_tenant_created 
    ON audit_embeddings(tenant_id, created_at DESC);

-- Add comments
COMMENT ON TABLE audit_embeddings IS 'Vector embeddings for semantic search over audit logs using RAG';
COMMENT ON COLUMN audit_embeddings.embedding IS 'OpenAI ada-002 embedding vector (1536 dimensions)';
COMMENT ON COLUMN audit_embeddings.content_text IS 'Text content used to generate the embedding';
COMMENT ON COLUMN audit_embeddings.tenant_id IS 'Tenant identifier for namespace isolation in semantic search';

-- ============================================================================
-- 3. Create audit_anomalies table for anomaly detection tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_anomalies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_event_id UUID NOT NULL REFERENCES roche_audit_logs(id) ON DELETE CASCADE,
    anomaly_score DECIMAL(3,2) NOT NULL,
    detection_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    features_used JSONB NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    is_false_positive BOOLEAN DEFAULT FALSE,
    feedback_notes TEXT,
    feedback_user_id UUID REFERENCES auth.users(id),
    feedback_timestamp TIMESTAMP WITH TIME ZONE,
    alert_sent BOOLEAN DEFAULT FALSE,
    tenant_id UUID NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    affected_entities JSONB,
    suggested_actions TEXT,
    
    CONSTRAINT valid_anomaly_score CHECK (anomaly_score >= 0 AND anomaly_score <= 1),
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

-- Create indexes for efficient anomaly querying
CREATE INDEX IF NOT EXISTS idx_anomalies_score 
    ON audit_anomalies(anomaly_score DESC);

CREATE INDEX IF NOT EXISTS idx_anomalies_timestamp 
    ON audit_anomalies(detection_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_anomalies_tenant 
    ON audit_anomalies(tenant_id);

CREATE INDEX IF NOT EXISTS idx_anomalies_false_positive 
    ON audit_anomalies(is_false_positive);

CREATE INDEX IF NOT EXISTS idx_anomalies_alert_sent 
    ON audit_anomalies(alert_sent) 
    WHERE alert_sent = FALSE;

CREATE INDEX IF NOT EXISTS idx_anomalies_severity 
    ON audit_anomalies(severity);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_anomalies_tenant_timestamp 
    ON audit_anomalies(tenant_id, detection_timestamp DESC);

-- Add comments
COMMENT ON TABLE audit_anomalies IS 'Detected anomalies in audit logs with ML model metadata and feedback';
COMMENT ON COLUMN audit_anomalies.anomaly_score IS 'Isolation Forest anomaly score (0-1), higher means more anomalous';
COMMENT ON COLUMN audit_anomalies.features_used IS 'Feature vector used for anomaly detection';
COMMENT ON COLUMN audit_anomalies.model_version IS 'Version of ML model used for detection';
COMMENT ON COLUMN audit_anomalies.is_false_positive IS 'User feedback indicating false positive detection';
COMMENT ON COLUMN audit_anomalies.alert_sent IS 'Flag indicating if notification was sent for this anomaly';
COMMENT ON COLUMN audit_anomalies.affected_entities IS 'Entities affected by the anomalous event';
COMMENT ON COLUMN audit_anomalies.suggested_actions IS 'AI-generated suggested actions for the anomaly';

-- ============================================================================
-- 4. Create audit_ml_models table for ML model version tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_ml_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_type VARCHAR(50) NOT NULL,  -- 'anomaly_detector', 'category_classifier', 'risk_classifier'
    model_version VARCHAR(50) NOT NULL,
    training_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    training_data_size INTEGER NOT NULL,
    metrics JSONB NOT NULL,  -- accuracy, precision, recall, f1_score
    model_path TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    tenant_id UUID,  -- NULL for shared models
    hyperparameters JSONB,
    feature_importance JSONB,
    
    CONSTRAINT unique_model_version UNIQUE(model_type, model_version, tenant_id),
    CONSTRAINT valid_model_type CHECK (model_type IN (
        'anomaly_detector', 
        'category_classifier', 
        'risk_classifier'
    ))
);

-- Create indexes for model management
CREATE INDEX IF NOT EXISTS idx_ml_models_type 
    ON audit_ml_models(model_type);

CREATE INDEX IF NOT EXISTS idx_ml_models_active 
    ON audit_ml_models(is_active) 
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_ml_models_tenant 
    ON audit_ml_models(tenant_id);

CREATE INDEX IF NOT EXISTS idx_ml_models_training_date 
    ON audit_ml_models(training_date DESC);

-- Composite index for finding active tenant-specific models
CREATE INDEX IF NOT EXISTS idx_ml_models_tenant_type_active 
    ON audit_ml_models(tenant_id, model_type, is_active) 
    WHERE is_active = TRUE;

-- Add comments
COMMENT ON TABLE audit_ml_models IS 'ML model metadata and version tracking for audit trail AI features';
COMMENT ON COLUMN audit_ml_models.model_type IS 'Type of ML model: anomaly_detector, category_classifier, risk_classifier';
COMMENT ON COLUMN audit_ml_models.metrics IS 'Training metrics including accuracy, precision, recall, f1_score';
COMMENT ON COLUMN audit_ml_models.model_path IS 'File system path or object storage URL for the trained model';
COMMENT ON COLUMN audit_ml_models.tenant_id IS 'NULL for shared baseline models, UUID for tenant-specific models';
COMMENT ON COLUMN audit_ml_models.hyperparameters IS 'Model hyperparameters used during training';
COMMENT ON COLUMN audit_ml_models.feature_importance IS 'Feature importance scores for interpretability';

-- ============================================================================
-- 5. Create audit_integrations table for external tool configurations
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    integration_type VARCHAR(50) NOT NULL,  -- 'slack', 'teams', 'zapier', 'email'
    config JSONB NOT NULL,  -- webhook URLs, API keys (encrypted), channel IDs
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    last_used TIMESTAMP WITH TIME ZONE,
    failure_count INTEGER DEFAULT 0,
    last_failure TIMESTAMP WITH TIME ZONE,
    last_failure_reason TEXT,
    
    CONSTRAINT unique_tenant_integration UNIQUE(tenant_id, integration_type),
    CONSTRAINT valid_integration_type CHECK (integration_type IN (
        'slack', 
        'teams', 
        'zapier', 
        'email'
    ))
);

-- Create indexes for integration management
CREATE INDEX IF NOT EXISTS idx_integrations_tenant 
    ON audit_integrations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_integrations_active 
    ON audit_integrations(is_active) 
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_integrations_type 
    ON audit_integrations(integration_type);

-- Composite index for finding active integrations by tenant
CREATE INDEX IF NOT EXISTS idx_integrations_tenant_active 
    ON audit_integrations(tenant_id, is_active) 
    WHERE is_active = TRUE;

-- Add comments
COMMENT ON TABLE audit_integrations IS 'External integration configurations for audit alert notifications';
COMMENT ON COLUMN audit_integrations.integration_type IS 'Type of integration: slack, teams, zapier, email';
COMMENT ON COLUMN audit_integrations.config IS 'Encrypted configuration including webhook URLs and API keys';
COMMENT ON COLUMN audit_integrations.failure_count IS 'Number of consecutive delivery failures';
COMMENT ON COLUMN audit_integrations.last_failure_reason IS 'Error message from last failed delivery attempt';

-- ============================================================================
-- 6. Create audit_scheduled_reports table for automated reporting
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    report_name VARCHAR(255) NOT NULL,
    schedule_cron VARCHAR(100) NOT NULL,  -- Cron expression
    filters JSONB NOT NULL,
    recipients JSONB NOT NULL,  -- Array of email addresses
    include_summary BOOLEAN DEFAULT TRUE,
    format VARCHAR(10) NOT NULL,  -- 'pdf' or 'csv'
    is_active BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    run_count INTEGER DEFAULT 0,
    last_run_status VARCHAR(20),  -- 'success', 'failed', 'partial'
    last_run_error TEXT,
    
    CONSTRAINT valid_format CHECK (format IN ('pdf', 'csv')),
    CONSTRAINT valid_last_run_status CHECK (
        last_run_status IS NULL OR 
        last_run_status IN ('success', 'failed', 'partial')
    )
);

-- Create indexes for scheduled report management
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant 
    ON audit_scheduled_reports(tenant_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run 
    ON audit_scheduled_reports(next_run) 
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active 
    ON audit_scheduled_reports(is_active) 
    WHERE is_active = TRUE;

-- Composite index for job scheduling queries
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active_next_run 
    ON audit_scheduled_reports(is_active, next_run) 
    WHERE is_active = TRUE;

-- Add comments
COMMENT ON TABLE audit_scheduled_reports IS 'Scheduled audit report configurations with cron expressions';
COMMENT ON COLUMN audit_scheduled_reports.schedule_cron IS 'Cron expression for report schedule (e.g., "0 9 * * 1" for weekly Monday 9am)';
COMMENT ON COLUMN audit_scheduled_reports.filters IS 'Filter criteria for events to include in report';
COMMENT ON COLUMN audit_scheduled_reports.recipients IS 'JSON array of email addresses to receive the report';
COMMENT ON COLUMN audit_scheduled_reports.next_run IS 'Calculated next execution time based on cron schedule';
COMMENT ON COLUMN audit_scheduled_reports.run_count IS 'Total number of times this report has been executed';

-- ============================================================================
-- 7. Create audit_access_log table for meta-audit (audit-of-audit)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    access_type VARCHAR(50) NOT NULL,  -- 'read', 'export', 'search'
    query_parameters JSONB,
    result_count INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    tenant_id UUID NOT NULL,
    execution_time_ms INTEGER,
    
    CONSTRAINT valid_access_type CHECK (access_type IN ('read', 'export', 'search'))
);

-- Create indexes for access log queries
CREATE INDEX IF NOT EXISTS idx_audit_access_log_user 
    ON audit_access_log(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_access_log_timestamp 
    ON audit_access_log(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_access_log_tenant 
    ON audit_access_log(tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_access_log_access_type 
    ON audit_access_log(access_type);

-- Composite index for user activity analysis
CREATE INDEX IF NOT EXISTS idx_audit_access_log_tenant_user_timestamp 
    ON audit_access_log(tenant_id, user_id, timestamp DESC);

-- Add comments
COMMENT ON TABLE audit_access_log IS 'Meta-audit log tracking all access to audit logs (audit-of-audit)';
COMMENT ON COLUMN audit_access_log.access_type IS 'Type of access: read, export, search';
COMMENT ON COLUMN audit_access_log.query_parameters IS 'Filters and parameters used in the query';
COMMENT ON COLUMN audit_access_log.result_count IS 'Number of audit events returned';
COMMENT ON COLUMN audit_access_log.execution_time_ms IS 'Query execution time in milliseconds';

-- ============================================================================
-- 8. Create audit_bias_metrics table for AI fairness tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_bias_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    metric_type VARCHAR(50) NOT NULL,  -- 'anomaly_detection_rate', 'classification_accuracy'
    dimension VARCHAR(50) NOT NULL,  -- 'user_role', 'department', 'entity_type'
    dimension_value VARCHAR(100) NOT NULL,
    metric_value DECIMAL(5,4) NOT NULL,
    sample_size INTEGER NOT NULL,
    calculation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    time_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    time_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    is_biased BOOLEAN DEFAULT FALSE,
    bias_threshold_exceeded DECIMAL(5,4),
    
    CONSTRAINT valid_metric_type CHECK (metric_type IN (
        'anomaly_detection_rate', 
        'classification_accuracy',
        'false_positive_rate'
    ))
);

-- Create indexes for bias analysis
CREATE INDEX IF NOT EXISTS idx_bias_metrics_tenant 
    ON audit_bias_metrics(tenant_id);

CREATE INDEX IF NOT EXISTS idx_bias_metrics_calculation_date 
    ON audit_bias_metrics(calculation_date DESC);

CREATE INDEX IF NOT EXISTS idx_bias_metrics_is_biased 
    ON audit_bias_metrics(is_biased) 
    WHERE is_biased = TRUE;

-- Composite index for bias analysis queries
CREATE INDEX IF NOT EXISTS idx_bias_metrics_tenant_type_dimension 
    ON audit_bias_metrics(tenant_id, metric_type, dimension, calculation_date DESC);

-- Add comments
COMMENT ON TABLE audit_bias_metrics IS 'AI fairness metrics tracking for bias detection in audit analysis';
COMMENT ON COLUMN audit_bias_metrics.metric_type IS 'Type of metric being tracked for bias analysis';
COMMENT ON COLUMN audit_bias_metrics.dimension IS 'Demographic dimension being analyzed (user_role, department, etc.)';
COMMENT ON COLUMN audit_bias_metrics.is_biased IS 'Flag indicating if bias threshold was exceeded';
COMMENT ON COLUMN audit_bias_metrics.bias_threshold_exceeded IS 'Amount by which the bias threshold was exceeded';

-- ============================================================================
-- 9. Create audit_ai_predictions table for AI prediction logging
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_ai_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_event_id UUID NOT NULL REFERENCES roche_audit_logs(id) ON DELETE CASCADE,
    prediction_type VARCHAR(50) NOT NULL,  -- 'anomaly', 'category', 'risk_level'
    predicted_value VARCHAR(100) NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    features_used JSONB NOT NULL,
    prediction_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    review_required BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES auth.users(id),
    review_timestamp TIMESTAMP WITH TIME ZONE,
    review_outcome VARCHAR(50),  -- 'confirmed', 'corrected', 'rejected'
    tenant_id UUID NOT NULL,
    
    CONSTRAINT valid_prediction_type CHECK (prediction_type IN (
        'anomaly', 
        'category', 
        'risk_level'
    )),
    CONSTRAINT valid_confidence_score CHECK (confidence_score >= 0 AND confidence_score <= 1),
    CONSTRAINT valid_review_outcome CHECK (
        review_outcome IS NULL OR 
        review_outcome IN ('confirmed', 'corrected', 'rejected')
    )
);

-- Create indexes for prediction tracking
CREATE INDEX IF NOT EXISTS idx_ai_predictions_event 
    ON audit_ai_predictions(audit_event_id);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_timestamp 
    ON audit_ai_predictions(prediction_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_review_required 
    ON audit_ai_predictions(review_required) 
    WHERE review_required = TRUE;

CREATE INDEX IF NOT EXISTS idx_ai_predictions_tenant 
    ON audit_ai_predictions(tenant_id);

-- Composite index for prediction analysis
CREATE INDEX IF NOT EXISTS idx_ai_predictions_tenant_type_timestamp 
    ON audit_ai_predictions(tenant_id, prediction_type, prediction_timestamp DESC);

-- Add comments
COMMENT ON TABLE audit_ai_predictions IS 'Logging of all AI model predictions for audit trail transparency';
COMMENT ON COLUMN audit_ai_predictions.prediction_type IS 'Type of prediction: anomaly, category, risk_level';
COMMENT ON COLUMN audit_ai_predictions.confidence_score IS 'Model confidence score (0-1)';
COMMENT ON COLUMN audit_ai_predictions.review_required IS 'Flag set when confidence < 0.6, requiring human review';
COMMENT ON COLUMN audit_ai_predictions.review_outcome IS 'Human review result: confirmed, corrected, rejected';

-- ============================================================================
-- 10. Grant permissions (adjust based on your auth setup)
-- ============================================================================

-- Grant SELECT permissions to authenticated users (adjust as needed)
-- Note: In production, use row-level security policies for tenant isolation

-- Example RLS policies (uncomment and adjust based on your auth setup):
-- ALTER TABLE roche_audit_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_embeddings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_anomalies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_integrations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_scheduled_reports ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_access_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Migration complete
-- ============================================================================

-- Create schema_migrations table if it doesn't exist (for tracking migrations)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add migration tracking
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (
    '023',
    'AI-Empowered Audit Trail Schema',
    NOW()
)
ON CONFLICT (version) DO NOTHING;
