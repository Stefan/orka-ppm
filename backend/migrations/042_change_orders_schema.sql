-- Migration 042: Change Order Management System
-- Formal change order processing with cost impact analysis,
-- approval workflows, and contract integration
-- Dependencies: projects, auth.users; optionally work_packages (020)

-- Change Orders
CREATE TABLE IF NOT EXISTS change_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    change_order_number VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    justification TEXT NOT NULL,
    change_category VARCHAR(50) NOT NULL,
    change_source VARCHAR(50) NOT NULL,
    impact_type TEXT[] DEFAULT ARRAY['cost'],
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(30) DEFAULT 'draft',
    original_contract_value DECIMAL(15,2) NOT NULL,
    proposed_cost_impact DECIMAL(15,2) NOT NULL DEFAULT 0,
    approved_cost_impact DECIMAL(15,2),
    proposed_schedule_impact_days INTEGER DEFAULT 0,
    approved_schedule_impact_days INTEGER,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    submitted_date TIMESTAMP WITH TIME ZONE,
    required_approval_date TIMESTAMP WITH TIME ZONE,
    approved_date TIMESTAMP WITH TIME ZONE,
    implementation_date TIMESTAMP WITH TIME ZONE,
    contract_reference VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, change_order_number)
);

-- Change Order Line Items (work_package_id optional - table may not exist in all deployments)
CREATE TABLE IF NOT EXISTS change_order_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_order_id UUID NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    work_package_id UUID,
    trade_category VARCHAR(50) NOT NULL,
    unit_of_measure VARCHAR(20) NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    unit_rate DECIMAL(10,2) NOT NULL,
    extended_cost DECIMAL(15,2) NOT NULL,
    markup_percentage DECIMAL(5,2) DEFAULT 0.0,
    overhead_percentage DECIMAL(5,2) DEFAULT 0.0,
    contingency_percentage DECIMAL(5,2) DEFAULT 0.0,
    total_cost DECIMAL(15,2) NOT NULL,
    cost_category VARCHAR(30) NOT NULL,
    is_add BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cost Impact Analysis
CREATE TABLE IF NOT EXISTS cost_impact_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_order_id UUID NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
    analysis_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    direct_costs JSONB NOT NULL DEFAULT '{}',
    indirect_costs JSONB NOT NULL DEFAULT '{}',
    schedule_impact_costs JSONB DEFAULT '{}',
    risk_adjustments JSONB DEFAULT '{}',
    total_cost_impact DECIMAL(15,2) NOT NULL,
    confidence_level DECIMAL(3,2) NOT NULL,
    cost_breakdown_structure JSONB,
    pricing_method VARCHAR(30) NOT NULL,
    benchmarking_data JSONB,
    analyzed_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Change Order Approvals
CREATE TABLE IF NOT EXISTS change_order_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_order_id UUID NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
    approval_level INTEGER NOT NULL,
    approver_role VARCHAR(50) NOT NULL,
    approver_user_id UUID NOT NULL REFERENCES auth.users(id),
    approval_limit DECIMAL(15,2),
    status VARCHAR(20) DEFAULT 'pending',
    approval_date TIMESTAMP WITH TIME ZONE,
    comments TEXT,
    conditions TEXT[],
    delegated_to UUID REFERENCES auth.users(id),
    is_required BOOLEAN DEFAULT TRUE,
    sequence_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contract Change Provisions
CREATE TABLE IF NOT EXISTS contract_change_provisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contract_section VARCHAR(50) NOT NULL,
    change_type VARCHAR(50) NOT NULL,
    approval_authority VARCHAR(100) NOT NULL,
    monetary_limit DECIMAL(15,2),
    time_limit_days INTEGER,
    pricing_mechanism VARCHAR(30) NOT NULL,
    required_documentation TEXT[] DEFAULT '{}',
    approval_process TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Change Order Documents
CREATE TABLE IF NOT EXISTS change_order_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_order_id UUID NOT NULL REFERENCES change_orders(id) ON DELETE CASCADE,
    document_type VARCHAR(30) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    version VARCHAR(10) DEFAULT '1.0',
    description TEXT,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_current_version BOOLEAN DEFAULT TRUE,
    access_level VARCHAR(20) DEFAULT 'project_team',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Change Order Metrics
CREATE TABLE IF NOT EXISTS change_order_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    measurement_period VARCHAR(20) NOT NULL,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    total_change_orders INTEGER NOT NULL,
    approved_change_orders INTEGER NOT NULL,
    rejected_change_orders INTEGER NOT NULL,
    pending_change_orders INTEGER NOT NULL,
    total_cost_impact DECIMAL(15,2) NOT NULL,
    average_processing_time_days DECIMAL(5,2) NOT NULL,
    average_approval_time_days DECIMAL(5,2) NOT NULL,
    change_order_velocity DECIMAL(5,2) NOT NULL,
    cost_growth_percentage DECIMAL(5,2) NOT NULL,
    schedule_impact_days INTEGER NOT NULL,
    change_categories_breakdown JSONB NOT NULL DEFAULT '{}',
    change_sources_breakdown JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_change_orders_project_id ON change_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON change_orders(project_id, status);
CREATE INDEX IF NOT EXISTS idx_change_orders_number ON change_orders(change_order_number);
CREATE INDEX IF NOT EXISTS idx_change_order_line_items_change_order_id ON change_order_line_items(change_order_id);
CREATE INDEX IF NOT EXISTS idx_cost_impact_analyses_change_order_id ON cost_impact_analyses(change_order_id);
CREATE INDEX IF NOT EXISTS idx_change_order_approvals_change_order_id ON change_order_approvals(change_order_id);
CREATE INDEX IF NOT EXISTS idx_change_order_approvals_approver ON change_order_approvals(approver_user_id, status);
CREATE INDEX IF NOT EXISTS idx_change_order_documents_change_order_id ON change_order_documents(change_order_id);
CREATE INDEX IF NOT EXISTS idx_change_order_metrics_project_period ON change_order_metrics(project_id, measurement_period);

-- Note: work_package_id in change_order_line_items is optional.
-- Add FK to work_packages manually if that table exists in your schema.
