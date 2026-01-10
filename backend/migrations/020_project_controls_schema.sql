-- Project Controls Schema Migration
-- This migration creates tables for ETC, EAC, Earned Value Management, and Forecasting

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE CREATION (in dependency order)
-- ============================================================================

-- Work Packages Table (must be created first due to foreign key dependencies)
CREATE TABLE IF NOT EXISTS work_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    budget DECIMAL(15,2) NOT NULL CHECK (budget >= 0),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date >= start_date),
    percent_complete DECIMAL(5,2) DEFAULT 0.0 CHECK (percent_complete >= 0.0 AND percent_complete <= 100.0),
    actual_cost DECIMAL(15,2) DEFAULT 0.0 CHECK (actual_cost >= 0),
    earned_value DECIMAL(15,2) DEFAULT 0.0 CHECK (earned_value >= 0),
    responsible_manager UUID NOT NULL REFERENCES auth.users(id),
    parent_package_id UUID REFERENCES work_packages(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    -- Prevent circular references
    CHECK (id != parent_package_id)
);

-- ETC Calculations Table
CREATE TABLE IF NOT EXISTS etc_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    work_package_id UUID REFERENCES work_packages(id) ON DELETE SET NULL,
    calculation_method VARCHAR(50) NOT NULL CHECK (calculation_method IN ('bottom_up', 'performance_based', 'parametric', 'manual')),
    remaining_work_hours DECIMAL(10,2) NOT NULL CHECK (remaining_work_hours >= 0),
    remaining_cost DECIMAL(15,2) NOT NULL CHECK (remaining_cost >= 0),
    productivity_factor DECIMAL(5,4) CHECK (productivity_factor > 0),
    confidence_level DECIMAL(3,2) NOT NULL CHECK (confidence_level >= 0.0 AND confidence_level <= 1.0),
    justification TEXT,
    calculated_by UUID NOT NULL REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    calculation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- EAC Calculations Table
CREATE TABLE IF NOT EXISTS eac_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    calculation_method VARCHAR(50) NOT NULL CHECK (calculation_method IN ('current_performance', 'budget_performance', 'management_forecast', 'bottom_up')),
    budgeted_cost DECIMAL(15,2) NOT NULL CHECK (budgeted_cost >= 0),
    actual_cost DECIMAL(15,2) NOT NULL CHECK (actual_cost >= 0),
    earned_value DECIMAL(15,2) NOT NULL CHECK (earned_value >= 0),
    cost_performance_index DECIMAL(5,4) NOT NULL CHECK (cost_performance_index > 0),
    schedule_performance_index DECIMAL(5,4) NOT NULL CHECK (schedule_performance_index > 0),
    estimate_at_completion DECIMAL(15,2) NOT NULL CHECK (estimate_at_completion >= 0),
    variance_at_completion DECIMAL(15,2) NOT NULL,
    to_complete_performance_index DECIMAL(5,4) NOT NULL CHECK (to_complete_performance_index > 0),
    calculation_date TIMESTAMP NOT NULL DEFAULT NOW(),
    is_baseline BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Monthly Forecasts Table
CREATE TABLE IF NOT EXISTS monthly_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    planned_cost DECIMAL(15,2) NOT NULL CHECK (planned_cost >= 0),
    forecasted_cost DECIMAL(15,2) NOT NULL CHECK (forecasted_cost >= 0),
    planned_revenue DECIMAL(15,2) NOT NULL CHECK (planned_revenue >= 0),
    forecasted_revenue DECIMAL(15,2) NOT NULL CHECK (forecasted_revenue >= 0),
    cash_flow DECIMAL(15,2) NOT NULL,
    resource_costs JSONB,
    risk_adjustments JSONB,
    confidence_interval JSONB,
    scenario_type VARCHAR(20) DEFAULT 'most_likely' CHECK (scenario_type IN ('best_case', 'worst_case', 'most_likely')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, forecast_date, scenario_type)
);

-- Earned Value Metrics Table
CREATE TABLE IF NOT EXISTS earned_value_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    measurement_date DATE NOT NULL,
    planned_value DECIMAL(15,2) NOT NULL CHECK (planned_value >= 0),
    earned_value DECIMAL(15,2) NOT NULL CHECK (earned_value >= 0),
    actual_cost DECIMAL(15,2) NOT NULL CHECK (actual_cost >= 0),
    budget_at_completion DECIMAL(15,2) NOT NULL CHECK (budget_at_completion >= 0),
    cost_variance DECIMAL(15,2) NOT NULL,
    schedule_variance DECIMAL(15,2) NOT NULL,
    cost_performance_index DECIMAL(5,4) NOT NULL CHECK (cost_performance_index > 0),
    schedule_performance_index DECIMAL(5,4) NOT NULL CHECK (schedule_performance_index > 0),
    estimate_at_completion DECIMAL(15,2) NOT NULL CHECK (estimate_at_completion >= 0),
    estimate_to_complete DECIMAL(15,2) NOT NULL CHECK (estimate_to_complete >= 0),
    variance_at_completion DECIMAL(15,2) NOT NULL,
    to_complete_performance_index DECIMAL(5,4) NOT NULL CHECK (to_complete_performance_index > 0),
    percent_complete DECIMAL(5,2) NOT NULL CHECK (percent_complete >= 0.0 AND percent_complete <= 100.0),
    percent_spent DECIMAL(5,2) NOT NULL CHECK (percent_spent >= 0.0),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(project_id, measurement_date)
);

-- Performance Predictions Table
CREATE TABLE IF NOT EXISTS performance_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    prediction_date DATE NOT NULL,
    completion_date_forecast DATE NOT NULL,
    cost_forecast DECIMAL(15,2) NOT NULL CHECK (cost_forecast >= 0),
    performance_trend VARCHAR(20) NOT NULL CHECK (performance_trend IN ('improving', 'stable', 'declining')),
    risk_factors JSONB,
    confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    recommended_actions JSONB,
    prediction_model VARCHAR(50) NOT NULL CHECK (prediction_model IN ('linear_regression', 'monte_carlo', 'expert_judgment')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- ETC Calculations Indexes
CREATE INDEX IF NOT EXISTS idx_etc_calculations_project_id ON etc_calculations(project_id);
CREATE INDEX IF NOT EXISTS idx_etc_calculations_active ON etc_calculations(project_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_etc_calculations_method ON etc_calculations(project_id, calculation_method);
CREATE INDEX IF NOT EXISTS idx_etc_calculations_date ON etc_calculations(project_id, calculation_date DESC);

-- EAC Calculations Indexes
CREATE INDEX IF NOT EXISTS idx_eac_calculations_project_id ON eac_calculations(project_id);
CREATE INDEX IF NOT EXISTS idx_eac_calculations_baseline ON eac_calculations(project_id, is_baseline) WHERE is_baseline = TRUE;
CREATE INDEX IF NOT EXISTS idx_eac_calculations_method ON eac_calculations(project_id, calculation_method);
CREATE INDEX IF NOT EXISTS idx_eac_calculations_date ON eac_calculations(project_id, calculation_date DESC);

-- Monthly Forecasts Indexes
CREATE INDEX IF NOT EXISTS idx_monthly_forecasts_project_date ON monthly_forecasts(project_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_monthly_forecasts_scenario ON monthly_forecasts(project_id, scenario_type);
CREATE INDEX IF NOT EXISTS idx_monthly_forecasts_date_range ON monthly_forecasts(forecast_date);

-- Earned Value Metrics Indexes
CREATE INDEX IF NOT EXISTS idx_earned_value_metrics_project_date ON earned_value_metrics(project_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_earned_value_metrics_date_range ON earned_value_metrics(measurement_date);

-- Work Packages Indexes
CREATE INDEX IF NOT EXISTS idx_work_packages_project_id ON work_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_work_packages_active ON work_packages(project_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_work_packages_parent ON work_packages(parent_package_id) WHERE parent_package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_packages_manager ON work_packages(responsible_manager);
CREATE INDEX IF NOT EXISTS idx_work_packages_dates ON work_packages(start_date, end_date);

-- Performance Predictions Indexes
CREATE INDEX IF NOT EXISTS idx_performance_predictions_project_id ON performance_predictions(project_id);
CREATE INDEX IF NOT EXISTS idx_performance_predictions_date ON performance_predictions(project_id, prediction_date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_predictions_trend ON performance_predictions(project_id, performance_trend);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Create or replace the update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to all tables
DROP TRIGGER IF EXISTS update_etc_calculations_updated_at ON etc_calculations;
CREATE TRIGGER update_etc_calculations_updated_at BEFORE UPDATE ON etc_calculations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_eac_calculations_updated_at ON eac_calculations;
CREATE TRIGGER update_eac_calculations_updated_at BEFORE UPDATE ON eac_calculations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_monthly_forecasts_updated_at ON monthly_forecasts;
CREATE TRIGGER update_monthly_forecasts_updated_at BEFORE UPDATE ON monthly_forecasts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_earned_value_metrics_updated_at ON earned_value_metrics;
CREATE TRIGGER update_earned_value_metrics_updated_at BEFORE UPDATE ON earned_value_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_work_packages_updated_at ON work_packages;
CREATE TRIGGER update_work_packages_updated_at BEFORE UPDATE ON work_packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_performance_predictions_updated_at ON performance_predictions;
CREATE TRIGGER update_performance_predictions_updated_at BEFORE UPDATE ON performance_predictions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to calculate ETC using performance-based method
CREATE OR REPLACE FUNCTION calculate_performance_based_etc(
    p_project_id UUID,
    p_remaining_budget DECIMAL(15,2),
    p_cpi DECIMAL(5,4)
) RETURNS DECIMAL(15,2) AS $$
BEGIN
    -- ETC = (BAC - EV) / CPI
    IF p_cpi <= 0 THEN
        RAISE EXCEPTION 'CPI must be greater than 0';
    END IF;
    
    RETURN p_remaining_budget / p_cpi;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate EAC using current performance method
CREATE OR REPLACE FUNCTION calculate_current_performance_eac(
    p_actual_cost DECIMAL(15,2),
    p_bac DECIMAL(15,2),
    p_earned_value DECIMAL(15,2),
    p_cpi DECIMAL(5,4)
) RETURNS DECIMAL(15,2) AS $$
BEGIN
    -- EAC = AC + (BAC - EV) / CPI
    IF p_cpi <= 0 THEN
        RAISE EXCEPTION 'CPI must be greater than 0';
    END IF;
    
    RETURN p_actual_cost + ((p_bac - p_earned_value) / p_cpi);
END;
$$ LANGUAGE plpgsql;

-- Function to validate work package hierarchy (prevent circular references)
CREATE OR REPLACE FUNCTION validate_work_package_hierarchy() RETURNS TRIGGER AS $$
DECLARE
    current_parent UUID;
    depth INTEGER := 0;
    max_depth INTEGER := 10; -- Prevent infinite loops
BEGIN
    -- Only check if parent_package_id is being set
    IF NEW.parent_package_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Check for self-reference
    IF NEW.id = NEW.parent_package_id THEN
        RAISE EXCEPTION 'Work package cannot be its own parent';
    END IF;
    
    -- Check for circular references by traversing up the hierarchy
    current_parent := NEW.parent_package_id;
    
    WHILE current_parent IS NOT NULL AND depth < max_depth LOOP
        -- If we find our own ID in the parent chain, it's circular
        IF current_parent = NEW.id THEN
            RAISE EXCEPTION 'Circular reference detected in work package hierarchy';
        END IF;
        
        -- Get the next parent
        SELECT parent_package_id INTO current_parent 
        FROM work_packages 
        WHERE id = current_parent;
        
        depth := depth + 1;
    END LOOP;
    
    IF depth >= max_depth THEN
        RAISE EXCEPTION 'Work package hierarchy too deep (max % levels)', max_depth;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply hierarchy validation trigger
DROP TRIGGER IF EXISTS validate_work_package_hierarchy_trigger ON work_packages;
CREATE TRIGGER validate_work_package_hierarchy_trigger
    BEFORE INSERT OR UPDATE ON work_packages
    FOR EACH ROW EXECUTE FUNCTION validate_work_package_hierarchy();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Summary view of latest project controls metrics for all projects
CREATE OR REPLACE VIEW project_controls_summary AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    -- Latest ETC calculation
    etc.remaining_cost as latest_etc,
    etc.calculation_method as etc_method,
    etc.calculation_date as etc_date,
    -- Latest EAC calculation
    eac.estimate_at_completion as latest_eac,
    eac.variance_at_completion as latest_vac,
    eac.calculation_method as eac_method,
    -- Latest earned value metrics
    ev.cost_performance_index as latest_cpi,
    ev.schedule_performance_index as latest_spi,
    ev.percent_complete,
    ev.measurement_date as ev_date,
    -- Work package summary
    wp_summary.total_packages,
    wp_summary.total_budget,
    wp_summary.total_actual_cost,
    wp_summary.avg_percent_complete
FROM projects p
LEFT JOIN LATERAL (
    SELECT * FROM etc_calculations 
    WHERE project_id = p.id AND is_active = TRUE 
    ORDER BY calculation_date DESC 
    LIMIT 1
) etc ON TRUE
LEFT JOIN LATERAL (
    SELECT * FROM eac_calculations 
    WHERE project_id = p.id 
    ORDER BY calculation_date DESC 
    LIMIT 1
) eac ON TRUE
LEFT JOIN LATERAL (
    SELECT * FROM earned_value_metrics 
    WHERE project_id = p.id 
    ORDER BY measurement_date DESC 
    LIMIT 1
) ev ON TRUE
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as total_packages,
        SUM(budget) as total_budget,
        SUM(actual_cost) as total_actual_cost,
        AVG(percent_complete) as avg_percent_complete
    FROM work_packages 
    WHERE project_id = p.id AND is_active = TRUE
) wp_summary ON TRUE;

-- Performance trend analysis with moving averages and indicators
CREATE OR REPLACE VIEW performance_trends AS
SELECT 
    project_id,
    measurement_date,
    cost_performance_index,
    schedule_performance_index,
    cost_variance,
    schedule_variance,
    percent_complete,
    -- Calculate trend indicators
    LAG(cost_performance_index) OVER (PARTITION BY project_id ORDER BY measurement_date) as prev_cpi,
    LAG(schedule_performance_index) OVER (PARTITION BY project_id ORDER BY measurement_date) as prev_spi,
    -- Calculate moving averages
    AVG(cost_performance_index) OVER (
        PARTITION BY project_id 
        ORDER BY measurement_date 
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as cpi_3month_avg,
    AVG(schedule_performance_index) OVER (
        PARTITION BY project_id 
        ORDER BY measurement_date 
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as spi_3month_avg
FROM earned_value_metrics
ORDER BY project_id, measurement_date;

-- ============================================================================
-- DOCUMENTATION COMMENTS
-- ============================================================================

COMMENT ON TABLE etc_calculations IS 'Estimate to Complete calculations using various methodologies';
COMMENT ON TABLE eac_calculations IS 'Estimate at Completion calculations for project cost forecasting';
COMMENT ON TABLE monthly_forecasts IS 'Month-by-month financial forecasts with scenario support';
COMMENT ON TABLE earned_value_metrics IS 'Earned Value Management metrics and performance indices';
COMMENT ON TABLE work_packages IS 'Project work breakdown structure with hierarchical support';
COMMENT ON TABLE performance_predictions IS 'Performance forecasting and predictive analytics';

COMMENT ON VIEW project_controls_summary IS 'Summary view of latest project controls metrics for all projects';
COMMENT ON VIEW performance_trends IS 'Performance trend analysis with moving averages and indicators';

-- ============================================================================
-- PERMISSIONS (commented out - adjust based on your RBAC system)
-- ============================================================================

-- These would typically be handled by your application's permission system
-- GRANT SELECT, INSERT, UPDATE ON etc_calculations TO project_controls_users;
-- GRANT SELECT, INSERT, UPDATE ON eac_calculations TO project_controls_users;
-- GRANT SELECT, INSERT, UPDATE ON monthly_forecasts TO project_controls_users;
-- GRANT SELECT, INSERT, UPDATE ON earned_value_metrics TO project_controls_users;
-- GRANT SELECT, INSERT, UPDATE ON work_packages TO project_controls_users;
-- GRANT SELECT, INSERT, UPDATE ON performance_predictions TO project_controls_users;