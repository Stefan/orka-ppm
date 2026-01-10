-- AI Resource Optimization Tables
-- Support for ML-powered resource allocation analysis with confidence scores
-- Requirements: 6.1, 6.2, 6.3

-- Table for storing optimization analyses
CREATE TABLE IF NOT EXISTS optimization_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    analysis_data JSONB NOT NULL,
    analysis_duration_ms INTEGER NOT NULL,
    total_resources_analyzed INTEGER DEFAULT 0,
    optimization_opportunities INTEGER DEFAULT 0,
    potential_utilization_improvement DECIMAL(5,2) DEFAULT 0,
    estimated_cost_savings DECIMAL(10,2) DEFAULT 0,
    overall_confidence DECIMAL(3,2) DEFAULT 0,
    recommendation_reliability VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
    INDEX(user_id),
    INDEX(created_at),
    INDEX(analysis_id)
);

-- Table for storing optimization suggestions
CREATE TABLE IF NOT EXISTS optimization_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id VARCHAR(255) UNIQUE NOT NULL,
    analysis_id VARCHAR(255) REFERENCES optimization_analyses(analysis_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    
    -- Suggestion details
    suggestion_type VARCHAR(50) NOT NULL, -- resource_reallocation, skill_optimization, etc.
    confidence_score DECIMAL(3,2) NOT NULL,
    impact_score DECIMAL(3,2) NOT NULL,
    effort_required VARCHAR(20) NOT NULL, -- low, medium, high
    
    -- Allocation details
    current_allocation DECIMAL(5,2) DEFAULT 0,
    suggested_allocation DECIMAL(5,2) DEFAULT 0,
    skill_match_score DECIMAL(3,2),
    utilization_improvement DECIMAL(5,2) DEFAULT 0,
    
    -- Metadata
    reasoning TEXT NOT NULL,
    benefits JSONB DEFAULT '[]',
    risks JSONB DEFAULT '[]',
    implementation_steps JSONB DEFAULT '[]',
    conflicts_detected JSONB DEFAULT '[]',
    alternative_strategies JSONB DEFAULT '[]',
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending', -- pending, applied, dismissed, expired
    applied_at TIMESTAMP WITH TIME ZONE,
    applied_by UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
    
    INDEX(user_id),
    INDEX(resource_id),
    INDEX(project_id),
    INDEX(analysis_id),
    INDEX(status),
    INDEX(created_at)
);

-- Table for tracking optimization applications and outcomes
CREATE TABLE IF NOT EXISTS optimization_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id VARCHAR(255) UNIQUE NOT NULL,
    suggestion_id VARCHAR(255) REFERENCES optimization_suggestions(suggestion_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Application details
    notify_stakeholders BOOLEAN DEFAULT TRUE,
    implementation_notes TEXT,
    expected_completion_date DATE,
    
    -- Tracking metrics
    baseline_utilization DECIMAL(5,2) DEFAULT 0,
    target_utilization DECIMAL(5,2) DEFAULT 0,
    estimated_improvement DECIMAL(5,2) DEFAULT 0,
    actual_improvement DECIMAL(5,2), -- Measured after implementation
    
    -- Status and outcomes
    status VARCHAR(20) DEFAULT 'applied', -- applied, scheduled, failed, completed
    affected_resources JSONB DEFAULT '[]',
    notifications_sent JSONB DEFAULT '[]',
    
    -- Performance tracking
    success_score DECIMAL(3,2), -- 0-1 score based on actual vs expected outcomes
    user_satisfaction_rating INTEGER, -- 1-5 rating from user feedback
    lessons_learned TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    INDEX(user_id),
    INDEX(suggestion_id),
    INDEX(status),
    INDEX(created_at)
);

-- Table for optimization performance metrics
CREATE TABLE IF NOT EXISTS optimization_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id VARCHAR(255) REFERENCES optimization_analyses(analysis_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Performance metrics
    duration_ms INTEGER NOT NULL,
    suggestions_count INTEGER DEFAULT 0,
    overall_confidence DECIMAL(3,2) DEFAULT 0,
    data_quality_score DECIMAL(3,2) DEFAULT 0,
    
    -- System metrics
    memory_usage_mb INTEGER,
    cpu_usage_percent DECIMAL(5,2),
    api_calls_made INTEGER DEFAULT 0,
    
    -- User interaction metrics
    user_viewed BOOLEAN DEFAULT FALSE,
    user_applied_count INTEGER DEFAULT 0,
    user_dismissed_count INTEGER DEFAULT 0,
    time_to_first_action_seconds INTEGER,
    
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX(user_id),
    INDEX(analysis_id),
    INDEX(timestamp)
);

-- Table for conflict detection and resolution
CREATE TABLE IF NOT EXISTS resource_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conflict_id VARCHAR(255) UNIQUE NOT NULL,
    analysis_id VARCHAR(255) REFERENCES optimization_analyses(analysis_id) ON DELETE CASCADE,
    
    -- Conflict details
    conflict_type VARCHAR(50) NOT NULL, -- schedule_overlap, skill_mismatch, over_allocation, etc.
    severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
    description TEXT NOT NULL,
    affected_resources JSONB DEFAULT '[]',
    affected_projects JSONB DEFAULT '[]',
    resolution_priority INTEGER DEFAULT 1,
    
    -- Resolution tracking
    status VARCHAR(20) DEFAULT 'detected', -- detected, in_progress, resolved, ignored
    resolution_strategy TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id),
    
    -- Automated resolution
    can_auto_resolve BOOLEAN DEFAULT FALSE,
    auto_resolution_confidence DECIMAL(3,2),
    auto_resolution_applied BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX(analysis_id),
    INDEX(conflict_type),
    INDEX(severity),
    INDEX(status),
    INDEX(created_at)
);

-- Table for alternative strategies
CREATE TABLE IF NOT EXISTS optimization_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id VARCHAR(255) UNIQUE NOT NULL,
    suggestion_id VARCHAR(255) REFERENCES optimization_suggestions(suggestion_id) ON DELETE CASCADE,
    conflict_id VARCHAR(255) REFERENCES resource_conflicts(conflict_id) ON DELETE CASCADE,
    
    -- Strategy details
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL,
    implementation_complexity VARCHAR(20) NOT NULL, -- simple, moderate, complex
    estimated_timeline VARCHAR(100),
    
    -- Requirements and outcomes
    resource_requirements JSONB DEFAULT '[]',
    expected_outcomes JSONB DEFAULT '[]',
    success_criteria JSONB DEFAULT '[]',
    
    -- Performance tracking
    times_suggested INTEGER DEFAULT 1,
    times_applied INTEGER DEFAULT 0,
    average_success_rate DECIMAL(3,2),
    user_preference_score DECIMAL(3,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX(suggestion_id),
    INDEX(conflict_id),
    INDEX(confidence_score),
    INDEX(implementation_complexity)
);

-- Table for team composition recommendations
CREATE TABLE IF NOT EXISTS team_compositions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    composition_id VARCHAR(255) UNIQUE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Project requirements
    required_skills JSONB NOT NULL,
    estimated_effort_hours INTEGER NOT NULL,
    timeline_weeks INTEGER NOT NULL,
    priority VARCHAR(20) NOT NULL,
    budget_constraint DECIMAL(10,2),
    
    -- Recommended team
    recommended_team JSONB NOT NULL, -- Array of team member recommendations
    alternative_compositions JSONB DEFAULT '[]',
    composition_confidence DECIMAL(3,2) NOT NULL,
    estimated_timeline VARCHAR(100),
    total_cost_estimate DECIMAL(10,2),
    risk_factors JSONB DEFAULT '[]',
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'recommended', -- recommended, accepted, modified, rejected
    applied_at TIMESTAMP WITH TIME ZONE,
    feedback_rating INTEGER, -- 1-5 rating
    feedback_comments TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX(project_id),
    INDEX(user_id),
    INDEX(status),
    INDEX(created_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_optimization_analyses_user_created ON optimization_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_suggestions_resource_status ON optimization_suggestions(resource_id, status);
CREATE INDEX IF NOT EXISTS idx_optimization_applications_user_status ON optimization_applications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_optimization_metrics_timestamp ON optimization_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_resource_conflicts_severity_status ON resource_conflicts(severity, status);

-- Add comments for documentation
COMMENT ON TABLE optimization_analyses IS 'Stores AI resource optimization analysis results with confidence scores and metrics';
COMMENT ON TABLE optimization_suggestions IS 'Individual optimization suggestions generated by AI with detailed metrics and tracking';
COMMENT ON TABLE optimization_applications IS 'Tracks when suggestions are applied and their outcomes for learning';
COMMENT ON TABLE optimization_metrics IS 'Performance metrics for optimization analyses to track system performance';
COMMENT ON TABLE resource_conflicts IS 'Detected resource allocation conflicts with resolution tracking';
COMMENT ON TABLE optimization_strategies IS 'Alternative strategies for optimization and conflict resolution';
COMMENT ON TABLE team_compositions IS 'AI-generated team composition recommendations for projects';

-- Grant permissions (adjust based on your RLS policies)
-- These would typically be handled by your existing RLS setup
-- ALTER TABLE optimization_analyses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE optimization_suggestions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE optimization_applications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE optimization_metrics ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE resource_conflicts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE optimization_strategies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE team_compositions ENABLE ROW LEVEL SECURITY;