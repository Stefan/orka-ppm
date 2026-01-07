-- AI Features Database Schema Migration
-- This migration adds the necessary tables for AI agents functionality

-- Enable vector extension for embeddings (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Vector embeddings for RAG system
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type VARCHAR(50) NOT NULL, -- 'project', 'portfolio', 'resource', etc.
    content_id UUID NOT NULL,
    content_text TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI ada-002 embedding dimension
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RAG conversation contexts
CREATE TABLE IF NOT EXISTS rag_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL,
    query TEXT NOT NULL,
    response TEXT NOT NULL,
    sources JSONB DEFAULT '[]', -- Array of source references
    confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
    tokens_used INTEGER DEFAULT 0,
    response_time_ms INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resource skills with proficiency levels
CREATE TABLE IF NOT EXISTS resource_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    skill_name VARCHAR(100) NOT NULL,
    proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5),
    years_experience INTEGER DEFAULT 0,
    last_used DATE,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(resource_id, skill_name)
);

-- Project skill requirements
CREATE TABLE IF NOT EXISTS project_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    skill_name VARCHAR(100) NOT NULL,
    required_level INTEGER CHECK (required_level BETWEEN 1 AND 5),
    hours_needed INTEGER DEFAULT 0,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    fulfilled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resource availability tracking
CREATE TABLE IF NOT EXISTS resource_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    available_hours FLOAT DEFAULT 8.0,
    allocated_hours FLOAT DEFAULT 0.0,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'busy', 'unavailable', 'vacation')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(resource_id, date)
);

-- Risk patterns for machine learning
CREATE TABLE IF NOT EXISTS risk_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_type VARCHAR(50) NOT NULL,
    indicators JSONB NOT NULL, -- Key-value pairs of risk indicators
    historical_outcome VARCHAR(50), -- 'materialized', 'mitigated', 'false_positive'
    frequency INTEGER DEFAULT 1,
    confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI risk predictions
CREATE TABLE IF NOT EXISTS risk_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    risk_type VARCHAR(100) NOT NULL,
    description TEXT,
    probability FLOAT CHECK (probability BETWEEN 0 AND 1),
    impact_score INTEGER CHECK (impact_score BETWEEN 1 AND 5),
    predicted_date DATE,
    confidence_score FLOAT CHECK (confidence_score BETWEEN 0 AND 1),
    mitigation_suggestions JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'predicted' CHECK (status IN ('predicted', 'monitoring', 'materialized', 'mitigated')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI agent performance tracking
CREATE TABLE IF NOT EXISTS ai_agent_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_type VARCHAR(50) NOT NULL, -- 'rag_reporter', 'resource_optimizer', 'risk_forecaster'
    operation VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    response_time_ms INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    confidence_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_embeddings_content_type ON embeddings(content_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_id ON embeddings(content_id);
CREATE INDEX IF NOT EXISTS idx_rag_contexts_user_id ON rag_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_rag_contexts_conversation_id ON rag_contexts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_resource_skills_resource_id ON resource_skills(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_skills_skill_name ON resource_skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_project_requirements_project_id ON project_requirements(project_id);
CREATE INDEX IF NOT EXISTS idx_resource_availability_resource_id ON resource_availability(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_availability_date ON resource_availability(date);
CREATE INDEX IF NOT EXISTS idx_risk_predictions_project_id ON risk_predictions(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_metrics_agent_type ON ai_agent_metrics(agent_type);

-- Add RLS policies for security
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_metrics ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (authenticated users can access their own data)
CREATE POLICY "Users can access their own RAG contexts" ON rag_contexts
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access embeddings" ON embeddings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can access resource skills" ON resource_skills
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can access project requirements" ON project_requirements
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can access resource availability" ON resource_availability
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can access risk patterns" ON risk_patterns
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can access risk predictions" ON risk_predictions
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can access AI metrics" ON ai_agent_metrics
    FOR SELECT USING (auth.role() = 'authenticated');

-- Insert sample data for development
INSERT INTO resource_skills (resource_id, skill_name, proficiency_level, years_experience, verified) VALUES
    ('11111111-1111-1111-1111-111111111111', 'React', 4, 3, true),
    ('11111111-1111-1111-1111-111111111111', 'TypeScript', 4, 3, true),
    ('11111111-1111-1111-1111-111111111111', 'Node.js', 3, 2, true),
    ('22222222-2222-2222-2222-222222222222', 'Python', 5, 5, true),
    ('22222222-2222-2222-2222-222222222222', 'FastAPI', 4, 2, true),
    ('22222222-2222-2222-2222-222222222222', 'PostgreSQL', 4, 4, true),
    ('33333333-3333-3333-3333-333333333333', 'UI/UX Design', 5, 4, true),
    ('33333333-3333-3333-3333-333333333333', 'Figma', 5, 3, true),
    ('33333333-3333-3333-3333-333333333333', 'Adobe Creative Suite', 4, 5, true),
    ('44444444-4444-4444-4444-444444444444', 'Project Management', 4, 6, true),
    ('44444444-4444-4444-4444-444444444444', 'Agile/Scrum', 5, 6, true),
    ('44444444-4444-4444-4444-444444444444', 'Risk Management', 3, 4, true)
ON CONFLICT (resource_id, skill_name) DO NOTHING;

-- Insert sample project requirements
INSERT INTO project_requirements (project_id, skill_name, required_level, hours_needed, priority) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'React', 4, 120, 'high'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'TypeScript', 3, 80, 'medium'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'UI/UX Design', 4, 60, 'high'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Python', 4, 100, 'critical'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'FastAPI', 3, 60, 'high'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'PostgreSQL', 3, 40, 'medium')
ON CONFLICT DO NOTHING;

-- Insert sample resource availability (next 30 days)
INSERT INTO resource_availability (resource_id, date, available_hours, allocated_hours, status)
SELECT 
    resource_id,
    current_date + interval '1 day' * generate_series(0, 29),
    8.0,
    CASE 
        WHEN random() < 0.3 THEN 8.0  -- 30% fully booked
        WHEN random() < 0.6 THEN 4.0  -- 30% half booked
        ELSE 0.0                      -- 40% available
    END,
    CASE 
        WHEN random() < 0.1 THEN 'vacation'
        WHEN random() < 0.2 THEN 'unavailable'
        ELSE 'available'
    END
FROM (VALUES 
    ('11111111-1111-1111-1111-111111111111'),
    ('22222222-2222-2222-2222-222222222222'),
    ('33333333-3333-3333-3333-333333333333'),
    ('44444444-4444-4444-4444-444444444444')
) AS t(resource_id)
ON CONFLICT (resource_id, date) DO NOTHING;

COMMENT ON TABLE embeddings IS 'Vector embeddings for RAG system content search';
COMMENT ON TABLE rag_contexts IS 'Conversation history and context for RAG queries';
COMMENT ON TABLE resource_skills IS 'Skills and proficiency levels for team members';
COMMENT ON TABLE project_requirements IS 'Required skills and effort for projects';
COMMENT ON TABLE resource_availability IS 'Daily availability tracking for resources';
COMMENT ON TABLE risk_patterns IS 'Historical risk patterns for ML training';
COMMENT ON TABLE risk_predictions IS 'AI-generated risk forecasts';
COMMENT ON TABLE ai_agent_metrics IS 'Performance tracking for AI agents';