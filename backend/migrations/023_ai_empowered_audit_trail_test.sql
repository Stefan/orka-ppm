-- Test migration - minimal version to verify syntax
-- This is a simplified version for testing

-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create base audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    action_details JSONB NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add AI columns
ALTER TABLE audit_logs 
    ADD COLUMN IF NOT EXISTS anomaly_score DECIMAL(3,2),
    ADD COLUMN IF NOT EXISTS is_anomaly BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS category VARCHAR(50),
    ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20),
    ADD COLUMN IF NOT EXISTS tags JSONB,
    ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- Add constraint using DO block
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_anomaly_score'
    ) THEN
        ALTER TABLE audit_logs 
            ADD CONSTRAINT valid_anomaly_score 
                CHECK (anomaly_score IS NULL OR (anomaly_score >= 0 AND anomaly_score <= 1));
    END IF;
END $$;

-- Create audit_embeddings table
CREATE TABLE IF NOT EXISTS audit_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_event_id UUID NOT NULL REFERENCES audit_logs(id) ON DELETE CASCADE,
    embedding vector(1536),
    content_text TEXT NOT NULL,
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_audit_event_embedding UNIQUE(audit_event_id)
);

-- Create vector index
CREATE INDEX IF NOT EXISTS idx_audit_embeddings_vector 
    ON audit_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Create schema_migrations table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track migration
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('023_test', 'AI Audit Trail Test', NOW())
ON CONFLICT (version) DO NOTHING;
