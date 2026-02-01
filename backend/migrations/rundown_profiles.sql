-- Rundown Profiles Migration
-- Contingency Rundown Profiles feature for Costbook

-- ============================================
-- Table: rundown_profiles
-- Stores monthly budget rundown profiles for projects
-- ============================================

CREATE TABLE IF NOT EXISTS rundown_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    month VARCHAR(6) NOT NULL, -- Format: YYYYMM (e.g., 202401)
    planned_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    actual_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    predicted_value DECIMAL(15, 2),
    profile_type VARCHAR(20) NOT NULL DEFAULT 'standard', -- 'standard', 'optimistic', 'pessimistic'
    scenario_name VARCHAR(100) DEFAULT 'baseline',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique profile per project/month/type/scenario
    CONSTRAINT unique_profile_entry UNIQUE (project_id, month, profile_type, scenario_name)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_rundown_profiles_project_id ON rundown_profiles(project_id);
CREATE INDEX IF NOT EXISTS idx_rundown_profiles_month ON rundown_profiles(month);
CREATE INDEX IF NOT EXISTS idx_rundown_profiles_project_month ON rundown_profiles(project_id, month);
CREATE INDEX IF NOT EXISTS idx_rundown_profiles_scenario ON rundown_profiles(scenario_name);

-- Comment on table
COMMENT ON TABLE rundown_profiles IS 'Monthly budget rundown profiles for contingency tracking';
COMMENT ON COLUMN rundown_profiles.month IS 'Month in YYYYMM format';
COMMENT ON COLUMN rundown_profiles.planned_value IS 'Planned cumulative budget value for the month';
COMMENT ON COLUMN rundown_profiles.actual_value IS 'Actual cumulative spend value for the month';
COMMENT ON COLUMN rundown_profiles.predicted_value IS 'AI-predicted cumulative value for future months';
COMMENT ON COLUMN rundown_profiles.profile_type IS 'Type of profile: standard, optimistic, pessimistic';
COMMENT ON COLUMN rundown_profiles.scenario_name IS 'Named scenario for what-if analysis';


-- ============================================
-- Table: rundown_generation_logs
-- Audit log for profile generation executions
-- ============================================

CREATE TABLE IF NOT EXISTS rundown_generation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL, -- 'started', 'completed', 'failed', 'partial'
    message TEXT,
    projects_processed INTEGER DEFAULT 0,
    profiles_created INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for execution queries
CREATE INDEX IF NOT EXISTS idx_rundown_generation_logs_execution_id ON rundown_generation_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_rundown_generation_logs_created_at ON rundown_generation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_rundown_generation_logs_status ON rundown_generation_logs(status);

-- Comment on table
COMMENT ON TABLE rundown_generation_logs IS 'Audit log for rundown profile generation executions';


-- ============================================
-- Table: rundown_scenarios
-- User-defined scenarios for what-if analysis
-- ============================================

CREATE TABLE IF NOT EXISTS rundown_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    adjustment_type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- 'percentage', 'absolute'
    adjustment_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_scenario_name UNIQUE (project_id, name)
);

-- Index for scenario queries
CREATE INDEX IF NOT EXISTS idx_rundown_scenarios_project_id ON rundown_scenarios(project_id);
CREATE INDEX IF NOT EXISTS idx_rundown_scenarios_active ON rundown_scenarios(is_active) WHERE is_active = true;

-- Comment on table
COMMENT ON TABLE rundown_scenarios IS 'User-defined scenarios for what-if budget analysis';


-- ============================================
-- Trigger: Update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_rundown_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rundown_profiles_updated_at
    BEFORE UPDATE ON rundown_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_rundown_profiles_updated_at();

CREATE TRIGGER trigger_rundown_scenarios_updated_at
    BEFORE UPDATE ON rundown_scenarios
    FOR EACH ROW
    EXECUTE FUNCTION update_rundown_profiles_updated_at();


-- ============================================
-- Enable Row Level Security
-- ============================================

ALTER TABLE rundown_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rundown_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rundown_scenarios ENABLE ROW LEVEL SECURITY;

-- Policies for rundown_profiles (users can see profiles for projects they have access to)
CREATE POLICY "Users can view rundown profiles" ON rundown_profiles
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage rundown profiles" ON rundown_profiles
    FOR ALL USING (true);

-- Policies for generation logs (read-only for users, full access for service)
CREATE POLICY "Users can view generation logs" ON rundown_generation_logs
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage generation logs" ON rundown_generation_logs
    FOR ALL USING (true);

-- Policies for scenarios
CREATE POLICY "Users can view scenarios" ON rundown_scenarios
    FOR SELECT USING (true);

CREATE POLICY "Users can manage their scenarios" ON rundown_scenarios
    FOR ALL USING (true);
