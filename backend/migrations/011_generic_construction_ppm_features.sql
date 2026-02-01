-- Migration 011: Generic Construction/Engineering PPM Features
-- Add tables for shareable URLs, simulations, scenarios, change management, PO breakdowns, and Google Suite reports

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types for enums
DO $$ BEGIN
    CREATE TYPE shareable_permission_level AS ENUM ('view_basic', 'view_financial', 'view_risks', 'view_resources', 'view_timeline');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE simulation_type AS ENUM ('monte_carlo', 'what_if', 'sensitivity_analysis');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE change_request_type AS ENUM ('scope', 'schedule', 'budget', 'resource', 'quality', 'risk');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE change_request_status AS ENUM ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'implemented', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE po_breakdown_type AS ENUM ('sap_standard', 'custom_hierarchy', 'cost_center', 'work_package');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE report_template_type AS ENUM ('executive_summary', 'project_status', 'risk_assessment', 'financial_report', 'custom');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE report_generation_status AS ENUM ('pending', 'in_progress', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Shareable URLs table
CREATE TABLE IF NOT EXISTS shareable_urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{"can_view_basic_info": true, "can_view_financial": false, "can_view_risks": false, "can_view_resources": false, "can_view_timeline": true, "allowed_sections": []}',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE,
    last_accessed_by INET,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_by UUID REFERENCES auth.users(id),
    revoked_at TIMESTAMP WITH TIME ZONE,
    revocation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_expiration CHECK (expires_at > created_at),
    CONSTRAINT valid_access_count CHECK (access_count >= 0)
);

-- Simulation results table
CREATE TABLE IF NOT EXISTS simulation_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    simulation_type simulation_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}',
    input_parameters JSONB NOT NULL DEFAULT '{}',
    results JSONB NOT NULL DEFAULT '{}',
    statistics JSONB DEFAULT '{}',
    distribution_data JSONB DEFAULT '{}',
    percentiles JSONB DEFAULT '{}', -- P10, P50, P90 values
    confidence_intervals JSONB DEFAULT '{}',
    execution_time_ms INTEGER,
    iterations_completed INTEGER,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_cached BOOLEAN DEFAULT TRUE,
    cache_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    
    -- Constraints
    CONSTRAINT valid_execution_time CHECK (execution_time_ms >= 0),
    CONSTRAINT valid_iterations CHECK (iterations_completed >= 0)
);

-- Scenario analyses table
CREATE TABLE IF NOT EXISTS scenario_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_scenario_id UUID REFERENCES scenario_analyses(id),
    parameter_changes JSONB NOT NULL DEFAULT '{}',
    impact_results JSONB NOT NULL DEFAULT '{}',
    timeline_impact JSONB DEFAULT '{}',
    cost_impact JSONB DEFAULT '{}',
    resource_impact JSONB DEFAULT '{}',
    risk_impact JSONB DEFAULT '{}',
    comparison_data JSONB DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    is_baseline BOOLEAN DEFAULT FALSE,
    
    -- Ensure only one baseline per project
    CONSTRAINT unique_baseline_per_project UNIQUE (project_id, is_baseline) DEFERRABLE INITIALLY DEFERRED
);

-- Change requests table
CREATE TABLE IF NOT EXISTS change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    change_number VARCHAR(50) UNIQUE NOT NULL, -- Auto-generated change number
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    change_type change_request_type NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    impact_assessment JSONB NOT NULL DEFAULT '{}',
    justification TEXT NOT NULL,
    business_case TEXT,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    status change_request_status DEFAULT 'draft',
    workflow_instance_id UUID REFERENCES workflow_instances(id),
    
    -- Impact estimates
    estimated_cost_impact DECIMAL(15,2) DEFAULT 0,
    estimated_schedule_impact INTEGER DEFAULT 0, -- days
    estimated_resource_impact JSONB DEFAULT '{}',
    
    -- Actual impacts (filled after implementation)
    actual_cost_impact DECIMAL(15,2),
    actual_schedule_impact INTEGER,
    actual_resource_impact JSONB DEFAULT '{}',
    
    -- Approval tracking
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES auth.users(id),
    approval_comments TEXT,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejected_by UUID REFERENCES auth.users(id),
    rejection_reason TEXT,
    
    -- Implementation tracking
    implementation_started_at TIMESTAMP WITH TIME ZONE,
    implementation_completed_at TIMESTAMP WITH TIME ZONE,
    implementation_notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_cost_impact CHECK (estimated_cost_impact IS NULL OR estimated_cost_impact >= -999999999999.99),
    CONSTRAINT valid_schedule_impact CHECK (estimated_schedule_impact IS NULL OR estimated_schedule_impact >= -36500) -- ~100 years
);

-- PO breakdowns table
CREATE TABLE IF NOT EXISTS po_breakdowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(100), -- SAP code or custom code
    sap_po_number VARCHAR(100),
    sap_line_item VARCHAR(50),
    hierarchy_level INTEGER NOT NULL DEFAULT 0,
    parent_breakdown_id UUID REFERENCES po_breakdowns(id),
    
    -- Financial data
    cost_center VARCHAR(100),
    gl_account VARCHAR(50),
    planned_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    committed_amount DECIMAL(15,2) DEFAULT 0,
    actual_amount DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2) GENERATED ALWAYS AS (planned_amount - actual_amount) STORED,
    currency VARCHAR(3) DEFAULT 'USD',
    exchange_rate DECIMAL(10,6) DEFAULT 1.0,
    
    -- Classification
    breakdown_type po_breakdown_type NOT NULL,
    category VARCHAR(100),
    subcategory VARCHAR(100),
    
    -- Custom fields and metadata
    custom_fields JSONB DEFAULT '{}',
    tags JSONB DEFAULT '[]',
    notes TEXT,
    
    -- Import tracking
    import_batch_id UUID,
    import_source VARCHAR(100), -- 'sap_csv', 'manual', 'api'
    import_date TIMESTAMP WITH TIME ZONE,
    
    -- Version control
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    superseded_by UUID REFERENCES po_breakdowns(id),
    
    -- Audit fields
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_hierarchy_level CHECK (hierarchy_level >= 0 AND hierarchy_level <= 10),
    CONSTRAINT valid_amounts CHECK (
        planned_amount >= 0 AND 
        committed_amount >= 0 AND 
        actual_amount >= 0 AND
        committed_amount <= planned_amount * 1.5 -- Allow 50% overcommitment
    ),
    CONSTRAINT valid_exchange_rate CHECK (exchange_rate > 0),
    CONSTRAINT no_self_parent CHECK (id != parent_breakdown_id)
);

-- Change request PO links table
CREATE TABLE IF NOT EXISTS change_request_po_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    po_breakdown_id UUID NOT NULL REFERENCES po_breakdowns(id) ON DELETE CASCADE,
    impact_type VARCHAR(50) NOT NULL CHECK (impact_type IN ('cost_increase', 'cost_decrease', 'scope_change', 'reallocation', 'new_po', 'po_cancellation')),
    impact_amount DECIMAL(15,2) DEFAULT 0,
    impact_percentage DECIMAL(5,2),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique links
    CONSTRAINT unique_change_po_link UNIQUE (change_request_id, po_breakdown_id, impact_type)
);

-- Report templates table
CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type report_template_type NOT NULL,
    
    -- Google Slides integration
    google_slides_template_id VARCHAR(255),
    google_drive_folder_id VARCHAR(255),
    
    -- Template configuration
    data_mappings JSONB NOT NULL DEFAULT '{}',
    chart_configurations JSONB DEFAULT '[]',
    slide_layouts JSONB DEFAULT '[]',
    
    -- Template metadata
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    tags JSONB DEFAULT '[]',
    
    -- Access control
    is_public BOOLEAN DEFAULT FALSE,
    allowed_roles JSONB DEFAULT '[]',
    
    -- Audit fields
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_default_per_type UNIQUE (template_type, is_default) DEFERRABLE INITIALLY DEFERRED
);

-- Generated reports table
CREATE TABLE IF NOT EXISTS generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES report_templates(id),
    
    -- Report metadata
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Google integration
    google_drive_url TEXT,
    google_slides_id VARCHAR(255),
    google_drive_file_id VARCHAR(255),
    
    -- Generation status
    generation_status report_generation_status DEFAULT 'pending',
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    error_message TEXT,
    error_details JSONB DEFAULT '{}',
    
    -- Generation configuration
    generation_config JSONB DEFAULT '{}',
    data_range_start DATE,
    data_range_end DATE,
    
    -- Data snapshot
    data_snapshot JSONB DEFAULT '{}',
    chart_data JSONB DEFAULT '{}',
    
    -- Performance metrics
    generation_time_ms INTEGER,
    data_processing_time_ms INTEGER,
    upload_time_ms INTEGER,
    
    -- Audit fields
    generated_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT valid_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    CONSTRAINT valid_generation_times CHECK (
        generation_time_ms IS NULL OR generation_time_ms >= 0
    )
);

-- Shareable URL access log table
CREATE TABLE IF NOT EXISTS shareable_url_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shareable_url_id UUID NOT NULL REFERENCES shareable_urls(id) ON DELETE CASCADE,
    accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    referer TEXT,
    access_granted BOOLEAN NOT NULL,
    denial_reason TEXT,
    sections_accessed JSONB DEFAULT '[]',
    session_duration_seconds INTEGER,
    
    -- Constraints
    CONSTRAINT valid_session_duration CHECK (session_duration_seconds IS NULL OR session_duration_seconds >= 0)
);

-- Indexes for performance optimization
-- Shareable URLs indexes
CREATE INDEX IF NOT EXISTS idx_shareable_urls_project_id ON shareable_urls(project_id);
CREATE INDEX IF NOT EXISTS idx_shareable_urls_token ON shareable_urls(token) WHERE NOT is_revoked;
CREATE INDEX IF NOT EXISTS idx_shareable_urls_expires_at ON shareable_urls(expires_at) WHERE NOT is_revoked;
CREATE INDEX IF NOT EXISTS idx_shareable_urls_created_by ON shareable_urls(created_by);

-- Simulation results indexes
CREATE INDEX IF NOT EXISTS idx_simulation_results_project_id ON simulation_results(project_id);
CREATE INDEX IF NOT EXISTS idx_simulation_results_type ON simulation_results(simulation_type);
CREATE INDEX IF NOT EXISTS idx_simulation_results_created_by ON simulation_results(created_by);
CREATE INDEX IF NOT EXISTS idx_simulation_results_cache_expires ON simulation_results(cache_expires_at) WHERE is_cached;

-- Scenario analyses indexes
CREATE INDEX IF NOT EXISTS idx_scenario_analyses_project_id ON scenario_analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_scenario_analyses_base_scenario ON scenario_analyses(base_scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_analyses_active ON scenario_analyses(is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_scenario_analyses_baseline ON scenario_analyses(project_id, is_baseline) WHERE is_baseline;

-- Change requests indexes
CREATE INDEX IF NOT EXISTS idx_change_requests_project_id ON change_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_type ON change_requests(change_type);
CREATE INDEX IF NOT EXISTS idx_change_requests_requested_by ON change_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_change_requests_assigned_to ON change_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_change_requests_workflow ON change_requests(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_number ON change_requests(change_number);

-- PO breakdowns indexes
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_project_id ON po_breakdowns(project_id);
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_parent ON po_breakdowns(parent_breakdown_id);
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_sap_po ON po_breakdowns(sap_po_number);
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_hierarchy ON po_breakdowns(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_type ON po_breakdowns(breakdown_type);
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_active ON po_breakdowns(is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_import_batch ON po_breakdowns(import_batch_id);

-- Change request PO links indexes
CREATE INDEX IF NOT EXISTS idx_change_po_links_change_id ON change_request_po_links(change_request_id);
CREATE INDEX IF NOT EXISTS idx_change_po_links_po_id ON change_request_po_links(po_breakdown_id);

-- Report templates indexes
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_report_templates_active ON report_templates(is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_report_templates_public ON report_templates(is_public) WHERE is_public;
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON report_templates(created_by);

-- Generated reports indexes
CREATE INDEX IF NOT EXISTS idx_generated_reports_project_id ON generated_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_template_id ON generated_reports(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON generated_reports(generation_status);
CREATE INDEX IF NOT EXISTS idx_generated_reports_generated_by ON generated_reports(generated_by);
CREATE INDEX IF NOT EXISTS idx_generated_reports_created_at ON generated_reports(created_at);

-- Access log indexes
CREATE INDEX IF NOT EXISTS idx_shareable_url_access_log_url_id ON shareable_url_access_log(shareable_url_id);
CREATE INDEX IF NOT EXISTS idx_shareable_url_access_log_accessed_at ON shareable_url_access_log(accessed_at);
CREATE INDEX IF NOT EXISTS idx_shareable_url_access_log_ip ON shareable_url_access_log(ip_address);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_project_hierarchy ON po_breakdowns(project_id, hierarchy_level, parent_breakdown_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_project_status ON change_requests(project_id, status);
CREATE INDEX IF NOT EXISTS idx_simulation_results_project_type ON simulation_results(project_id, simulation_type);
-- Row Level Security (RLS) policies
ALTER TABLE shareable_urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_breakdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_request_po_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE shareable_url_access_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for shareable_urls
CREATE POLICY "Users can view shareable URLs for projects they have access to" ON shareable_urls
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN portfolios pf ON p.portfolio_id = pf.id
      WHERE pf.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_resources pr
        WHERE pr.project_id = p.id AND pr.resource_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create shareable URLs for projects they manage" ON shareable_urls
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM portfolios pf
        WHERE pf.id = p.portfolio_id AND pf.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own shareable URLs" ON shareable_urls
  FOR UPDATE USING (created_by = auth.uid());

-- RLS policies for simulation_results
CREATE POLICY "Users can view simulation results for accessible projects" ON simulation_results
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN portfolios pf ON p.portfolio_id = pf.id
      WHERE pf.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_resources pr
        WHERE pr.project_id = p.id AND pr.resource_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create simulation results for accessible projects" ON simulation_results
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN portfolios pf ON p.portfolio_id = pf.id
      WHERE pf.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_resources pr
        WHERE pr.project_id = p.id AND pr.resource_id = auth.uid()
      )
    )
  );

-- RLS policies for scenario_analyses
CREATE POLICY "Users can view scenario analyses for accessible projects" ON scenario_analyses
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN portfolios pf ON p.portfolio_id = pf.id
      WHERE pf.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_resources pr
        WHERE pr.project_id = p.id AND pr.resource_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage scenario analyses for accessible projects" ON scenario_analyses
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN portfolios pf ON p.portfolio_id = pf.id
      WHERE pf.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_resources pr
        WHERE pr.project_id = p.id AND pr.resource_id = auth.uid()
      )
    )
  );

-- RLS policies for change_requests
CREATE POLICY "Users can view change requests for accessible projects" ON change_requests
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN portfolios pf ON p.portfolio_id = pf.id
      WHERE pf.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_resources pr
        WHERE pr.project_id = p.id AND pr.resource_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create change requests for accessible projects" ON change_requests
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN portfolios pf ON p.portfolio_id = pf.id
      WHERE pf.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_resources pr
        WHERE pr.project_id = p.id AND pr.resource_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update change requests they created or are assigned to" ON change_requests
  FOR UPDATE USING (
    requested_by = auth.uid() 
    OR assigned_to = auth.uid()
    OR project_id IN (
      SELECT p.id FROM projects p
      WHERE p.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM portfolios pf
        WHERE pf.id = p.portfolio_id AND pf.owner_id = auth.uid()
      )
    )
  );

-- RLS policies for po_breakdowns
CREATE POLICY "Users can view PO breakdowns for accessible projects" ON po_breakdowns
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN portfolios pf ON p.portfolio_id = pf.id
      WHERE pf.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_resources pr
        WHERE pr.project_id = p.id AND pr.resource_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage PO breakdowns for projects they manage" ON po_breakdowns
  FOR ALL USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM portfolios pf
        WHERE pf.id = p.portfolio_id AND pf.owner_id = auth.uid()
      )
    )
  );

-- RLS policies for report_templates
CREATE POLICY "Users can view public templates or templates they created" ON report_templates
  FOR SELECT USING (
    is_public = true 
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create report templates" ON report_templates
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update templates they created" ON report_templates
  FOR UPDATE USING (created_by = auth.uid());

-- RLS policies for generated_reports
CREATE POLICY "Users can view generated reports for accessible projects" ON generated_reports
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN portfolios pf ON p.portfolio_id = pf.id
      WHERE pf.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_resources pr
        WHERE pr.project_id = p.id AND pr.resource_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create reports for accessible projects" ON generated_reports
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN portfolios pf ON p.portfolio_id = pf.id
      WHERE pf.owner_id = auth.uid()
      OR p.manager_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM project_resources pr
        WHERE pr.project_id = p.id AND pr.resource_id = auth.uid()
      )
    )
  );

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_shareable_urls_updated_at 
  BEFORE UPDATE ON shareable_urls 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_simulation_results_updated_at 
  BEFORE UPDATE ON simulation_results 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenario_analyses_updated_at 
  BEFORE UPDATE ON scenario_analyses 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_change_requests_updated_at 
  BEFORE UPDATE ON change_requests 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_po_breakdowns_updated_at 
  BEFORE UPDATE ON po_breakdowns 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_templates_updated_at 
  BEFORE UPDATE ON report_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique change request numbers
CREATE OR REPLACE FUNCTION generate_change_request_number()
RETURNS TRIGGER AS $$
DECLARE
    project_code TEXT;
    year_code TEXT;
    sequence_num INTEGER;
    new_number TEXT;
BEGIN
    -- Get project code (first 3 chars of project name, uppercase)
    SELECT UPPER(LEFT(REGEXP_REPLACE(name, '[^A-Za-z0-9]', '', 'g'), 3))
    INTO project_code
    FROM projects 
    WHERE id = NEW.project_id;
    
    -- Get current year (last 2 digits)
    year_code := RIGHT(EXTRACT(YEAR FROM NOW())::TEXT, 2);
    
    -- Get next sequence number for this project and year
    SELECT COALESCE(MAX(
        CAST(RIGHT(change_number, 4) AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM change_requests
    WHERE project_id = NEW.project_id
    AND change_number LIKE project_code || '-' || year_code || '-%';
    
    -- Generate the change number: PRJ-YY-NNNN
    new_number := project_code || '-' || year_code || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    NEW.change_number := new_number;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-generate change request numbers
CREATE TRIGGER generate_change_request_number_trigger
  BEFORE INSERT ON change_requests
  FOR EACH ROW 
  WHEN (NEW.change_number IS NULL OR NEW.change_number = '')
  EXECUTE FUNCTION generate_change_request_number();

-- Function to update PO breakdown amounts when child amounts change
CREATE OR REPLACE FUNCTION update_parent_po_amounts()
RETURNS TRIGGER AS $$
DECLARE
    parent_id UUID;
BEGIN
    -- Get the parent breakdown ID
    IF TG_OP = 'DELETE' THEN
        parent_id := OLD.parent_breakdown_id;
    ELSE
        parent_id := NEW.parent_breakdown_id;
    END IF;
    
    -- If there's a parent, update its amounts
    IF parent_id IS NOT NULL THEN
        UPDATE po_breakdowns 
        SET 
            planned_amount = (
                SELECT COALESCE(SUM(planned_amount), 0)
                FROM po_breakdowns 
                WHERE parent_breakdown_id = parent_id AND is_active = true
            ),
            committed_amount = (
                SELECT COALESCE(SUM(committed_amount), 0)
                FROM po_breakdowns 
                WHERE parent_breakdown_id = parent_id AND is_active = true
            ),
            actual_amount = (
                SELECT COALESCE(SUM(actual_amount), 0)
                FROM po_breakdowns 
                WHERE parent_breakdown_id = parent_id AND is_active = true
            )
        WHERE id = parent_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ language 'plpgsql';

-- Trigger to update parent PO amounts
CREATE TRIGGER update_parent_po_amounts_trigger
  AFTER INSERT OR UPDATE OR DELETE ON po_breakdowns
  FOR EACH ROW EXECUTE FUNCTION update_parent_po_amounts();

-- Function to clean up expired shareable URLs
CREATE OR REPLACE FUNCTION cleanup_expired_shareable_urls()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Mark expired URLs as revoked
    UPDATE shareable_urls 
    SET is_revoked = true, 
        revoked_at = NOW(),
        revocation_reason = 'Expired automatically'
    WHERE expires_at < NOW() 
    AND NOT is_revoked;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- Function to get project simulation statistics
CREATE OR REPLACE FUNCTION get_project_simulation_stats(proj_id UUID)
RETURNS TABLE (
    total_simulations BIGINT,
    monte_carlo_count BIGINT,
    what_if_count BIGINT,
    avg_execution_time_ms NUMERIC,
    latest_simulation_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_simulations,
        COUNT(*) FILTER (WHERE simulation_type = 'monte_carlo') as monte_carlo_count,
        COUNT(*) FILTER (WHERE simulation_type = 'what_if') as what_if_count,
        AVG(execution_time_ms) as avg_execution_time_ms,
        MAX(created_at) as latest_simulation_date
    FROM simulation_results
    WHERE project_id = proj_id;
END;
$$ language 'plpgsql';

-- Function to get change request statistics
CREATE OR REPLACE FUNCTION get_change_request_stats(proj_id UUID DEFAULT NULL)
RETURNS TABLE (
    total_changes BIGINT,
    draft_changes BIGINT,
    submitted_changes BIGINT,
    approved_changes BIGINT,
    rejected_changes BIGINT,
    implemented_changes BIGINT,
    total_cost_impact NUMERIC,
    total_schedule_impact BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_changes,
        COUNT(*) FILTER (WHERE status = 'draft') as draft_changes,
        COUNT(*) FILTER (WHERE status = 'submitted') as submitted_changes,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_changes,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_changes,
        COUNT(*) FILTER (WHERE status = 'implemented') as implemented_changes,
        COALESCE(SUM(estimated_cost_impact), 0) as total_cost_impact,
        COALESCE(SUM(estimated_schedule_impact), 0) as total_schedule_impact
    FROM change_requests
    WHERE (proj_id IS NULL OR project_id = proj_id);
END;
$$ language 'plpgsql';

-- Function to get PO breakdown hierarchy as JSON
CREATE OR REPLACE FUNCTION get_po_breakdown_hierarchy(proj_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    WITH RECURSIVE po_tree AS (
        -- Base case: root level breakdowns
        SELECT 
            id, name, code, hierarchy_level, parent_breakdown_id,
            planned_amount, committed_amount, actual_amount,
            breakdown_type, custom_fields,
            JSONB_BUILD_OBJECT(
                'id', id,
                'name', name,
                'code', code,
                'level', hierarchy_level,
                'planned_amount', planned_amount,
                'committed_amount', committed_amount,
                'actual_amount', actual_amount,
                'breakdown_type', breakdown_type,
                'custom_fields', custom_fields,
                'children', '[]'::jsonb
            ) as node
        FROM po_breakdowns
        WHERE project_id = proj_id 
        AND parent_breakdown_id IS NULL 
        AND is_active = true
        
        UNION ALL
        
        -- Recursive case: child breakdowns
        SELECT 
            pb.id, pb.name, pb.code, pb.hierarchy_level, pb.parent_breakdown_id,
            pb.planned_amount, pb.committed_amount, pb.actual_amount,
            pb.breakdown_type, pb.custom_fields,
            JSONB_BUILD_OBJECT(
                'id', pb.id,
                'name', pb.name,
                'code', pb.code,
                'level', pb.hierarchy_level,
                'planned_amount', pb.planned_amount,
                'committed_amount', pb.committed_amount,
                'actual_amount', pb.actual_amount,
                'breakdown_type', pb.breakdown_type,
                'custom_fields', pb.custom_fields,
                'children', '[]'::jsonb
            ) as node
        FROM po_breakdowns pb
        INNER JOIN po_tree pt ON pb.parent_breakdown_id = pt.id
        WHERE pb.project_id = proj_id AND pb.is_active = true
    )
    SELECT JSONB_AGG(node ORDER BY hierarchy_level, name)
    INTO result
    FROM po_tree
    WHERE parent_breakdown_id IS NULL;
    
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ language 'plpgsql';

-- Comments for documentation
COMMENT ON TABLE shareable_urls IS 'Secure, time-limited URLs for external project access with embedded permissions';
COMMENT ON TABLE simulation_results IS 'Results from Monte Carlo and What-If simulations with statistical analysis';
COMMENT ON TABLE scenario_analyses IS 'What-If scenario configurations and impact analysis results';
COMMENT ON TABLE change_requests IS 'Project change requests with workflow integration and impact tracking';
COMMENT ON TABLE po_breakdowns IS 'Hierarchical Purchase Order breakdown structures with cost tracking';
COMMENT ON TABLE change_request_po_links IS 'Links between change requests and affected PO breakdowns';
COMMENT ON TABLE report_templates IS 'Google Slides report templates with data mapping configurations';
COMMENT ON TABLE generated_reports IS 'Generated Google Slides reports with status tracking';
COMMENT ON TABLE shareable_url_access_log IS 'Audit log for shareable URL access attempts';

COMMENT ON COLUMN shareable_urls.token IS 'Cryptographically secure token for URL access';
COMMENT ON COLUMN shareable_urls.permissions IS 'JSON object defining access permissions and allowed sections';
COMMENT ON COLUMN simulation_results.percentiles IS 'P10, P50, P90 percentile values from simulation';
COMMENT ON COLUMN scenario_analyses.parameter_changes IS 'JSON object containing modified project parameters';
COMMENT ON COLUMN change_requests.change_number IS 'Auto-generated unique change request identifier';
COMMENT ON COLUMN po_breakdowns.remaining_amount IS 'Computed column: planned_amount - actual_amount';
COMMENT ON COLUMN report_templates.data_mappings IS 'JSON mapping of data fields to template placeholders';

COMMENT ON FUNCTION cleanup_expired_shareable_urls() IS 'Cleanup function for expired shareable URLs - call from scheduled job';
COMMENT ON FUNCTION get_project_simulation_stats(UUID) IS 'Get simulation statistics for a project';
COMMENT ON FUNCTION get_change_request_stats(UUID) IS 'Get change request statistics for a project or all projects';
COMMENT ON FUNCTION get_po_breakdown_hierarchy(UUID) IS 'Get hierarchical PO breakdown structure as JSON';