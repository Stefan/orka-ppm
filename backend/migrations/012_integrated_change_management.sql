-- Migration 012: Integrated Change Management System
-- Enhanced change management schema with comprehensive workflow support

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enhanced enums for change management
DO $$ BEGIN
    CREATE TYPE change_type AS ENUM (
        'scope', 'schedule', 'budget', 'design', 'regulatory', 
        'resource', 'quality', 'safety', 'emergency'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE change_status AS ENUM (
        'draft', 'submitted', 'under_review', 'pending_approval',
        'approved', 'rejected', 'on_hold', 'implementing', 
        'implemented', 'closed', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical', 'emergency');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_decision AS ENUM ('approved', 'rejected', 'needs_info', 'delegated');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Drop existing change_requests table if it exists to recreate with enhanced schema
DROP TABLE IF EXISTS change_request_po_links CASCADE;
DROP TABLE IF EXISTS change_requests CASCADE;

-- Enhanced change requests table
CREATE TABLE IF NOT EXISTS change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_number VARCHAR(50) UNIQUE NOT NULL, -- Auto-generated: CR-YYYY-NNNN
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    justification TEXT,
    change_type change_type NOT NULL,
    priority priority_level DEFAULT 'medium',
    status change_status DEFAULT 'draft',
    
    -- Requestor information
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    requested_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    required_by_date DATE,
    
    -- Project linkage
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    affected_milestones JSONB DEFAULT '[]',
    affected_pos JSONB DEFAULT '[]', -- Purchase Order IDs
    
    -- Impact estimates (initial)
    estimated_cost_impact DECIMAL(12,2) DEFAULT 0,
    estimated_schedule_impact_days INTEGER DEFAULT 0,
    estimated_effort_hours DECIMAL(8,2) DEFAULT 0,
    
    -- Actual impacts (post-implementation)
    actual_cost_impact DECIMAL(12,2),
    actual_schedule_impact_days INTEGER,
    actual_effort_hours DECIMAL(8,2),
    
    -- Implementation tracking
    implementation_start_date DATE,
    implementation_end_date DATE,
    implementation_notes TEXT,
    
    -- Metadata
    template_id UUID REFERENCES change_templates(id),
    version INTEGER DEFAULT 1,
    parent_change_id UUID REFERENCES change_requests(id), -- For related changes
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID REFERENCES auth.users(id)
);

-- Change request templates
CREATE TABLE IF NOT EXISTS change_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    change_type change_type NOT NULL,
    template_data JSONB NOT NULL, -- Form fields, validation rules, etc.
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Approval workflows and steps
CREATE TABLE IF NOT EXISTS change_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    approver_id UUID NOT NULL REFERENCES auth.users(id),
    approver_role VARCHAR(100), -- Role at time of approval
    
    -- Approval decision
    decision approval_decision,
    decision_date TIMESTAMP WITH TIME ZONE,
    comments TEXT,
    conditions TEXT, -- Conditional approval requirements
    
    -- Workflow management
    is_required BOOLEAN DEFAULT true,
    is_parallel BOOLEAN DEFAULT false, -- Can be processed in parallel with other steps
    depends_on_step INTEGER, -- Must wait for this step to complete
    
    -- Deadlines and escalation
    due_date TIMESTAMP WITH TIME ZONE,
    escalation_date TIMESTAMP WITH TIME ZONE,
    escalated_to UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Detailed impact analysis
CREATE TABLE IF NOT EXISTS change_impacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    
    -- Schedule impacts
    critical_path_affected BOOLEAN DEFAULT false,
    schedule_impact_details JSONB, -- Detailed timeline changes
    affected_activities JSONB DEFAULT '[]',
    
    -- Cost impacts
    direct_costs DECIMAL(12,2) DEFAULT 0,
    indirect_costs DECIMAL(12,2) DEFAULT 0,
    cost_savings DECIMAL(12,2) DEFAULT 0,
    cost_breakdown JSONB, -- Detailed cost analysis
    
    -- Resource impacts
    resource_requirements JSONB, -- Additional resources needed
    resource_reallocation JSONB, -- Existing resource changes
    
    -- Risk impacts
    new_risks JSONB DEFAULT '[]', -- New risks introduced
    modified_risks JSONB DEFAULT '[]', -- Changes to existing risks
    risk_mitigation_costs DECIMAL(12,2) DEFAULT 0,
    
    -- Quality and compliance impacts
    quality_impact_assessment TEXT,
    compliance_requirements JSONB,
    regulatory_approvals_needed JSONB DEFAULT '[]',
    
    -- Scenarios
    best_case_scenario JSONB,
    worst_case_scenario JSONB,
    most_likely_scenario JSONB,
    
    analyzed_by UUID REFERENCES auth.users(id),
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE
);

-- Implementation tracking
CREATE TABLE IF NOT EXISTS change_implementations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    
    -- Implementation plan
    implementation_plan JSONB, -- Detailed implementation steps
    assigned_to UUID REFERENCES auth.users(id),
    implementation_team JSONB DEFAULT '[]', -- Team member IDs
    
    -- Progress tracking
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    completed_tasks JSONB DEFAULT '[]',
    pending_tasks JSONB DEFAULT '[]',
    blocked_tasks JSONB DEFAULT '[]',
    
    -- Milestones
    implementation_milestones JSONB DEFAULT '[]',
    
    -- Issues and risks during implementation
    implementation_issues JSONB DEFAULT '[]',
    lessons_learned TEXT,
    
    -- Verification and validation
    verification_criteria JSONB,
    verification_results JSONB,
    validated_by UUID REFERENCES auth.users(id),
    validated_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Comprehensive audit log for change management
CREATE TABLE IF NOT EXISTS change_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'approved', 'rejected', etc.
    event_description TEXT,
    
    -- User and context
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    
    -- Data changes
    old_values JSONB,
    new_values JSONB,
    
    -- Additional context
    related_entity_type VARCHAR(50), -- 'approval', 'impact', 'implementation'
    related_entity_id UUID,
    
    -- Compliance and regulatory
    compliance_notes TEXT,
    regulatory_reference VARCHAR(255)
);

-- Notification preferences and delivery tracking
CREATE TABLE IF NOT EXISTS change_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    
    -- Notification details
    notification_type VARCHAR(50) NOT NULL,
    recipient_id UUID NOT NULL REFERENCES auth.users(id),
    delivery_method VARCHAR(20) NOT NULL, -- 'email', 'in_app', 'sms'
    
    -- Content
    subject VARCHAR(255),
    message TEXT,
    
    -- Delivery tracking
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    delivery_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    failure_reason TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_change_requests_project_id ON change_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_status ON change_requests(status);
CREATE INDEX IF NOT EXISTS idx_change_requests_requested_by ON change_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_change_requests_change_type ON change_requests(change_type);
CREATE INDEX IF NOT EXISTS idx_change_requests_priority ON change_requests(priority);
CREATE INDEX IF NOT EXISTS idx_change_requests_change_number ON change_requests(change_number);

CREATE INDEX IF NOT EXISTS idx_change_approvals_change_request_id ON change_approvals(change_request_id);
CREATE INDEX IF NOT EXISTS idx_change_approvals_approver_id ON change_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_change_approvals_decision ON change_approvals(decision);
CREATE INDEX IF NOT EXISTS idx_change_approvals_due_date ON change_approvals(due_date);

CREATE INDEX IF NOT EXISTS idx_change_impacts_change_request_id ON change_impacts(change_request_id);
CREATE INDEX IF NOT EXISTS idx_change_implementations_change_request_id ON change_implementations(change_request_id);
CREATE INDEX IF NOT EXISTS idx_change_implementations_assigned_to ON change_implementations(assigned_to);

CREATE INDEX IF NOT EXISTS idx_change_audit_log_change_request_id ON change_audit_log(change_request_id);
CREATE INDEX IF NOT EXISTS idx_change_audit_log_performed_by ON change_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_change_audit_log_performed_at ON change_audit_log(performed_at);
CREATE INDEX IF NOT EXISTS idx_change_audit_log_event_type ON change_audit_log(event_type);

CREATE INDEX IF NOT EXISTS idx_change_notifications_change_request_id ON change_notifications(change_request_id);
CREATE INDEX IF NOT EXISTS idx_change_notifications_recipient_id ON change_notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_change_notifications_delivery_status ON change_notifications(delivery_status);
-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_change_requests_updated_at 
  BEFORE UPDATE ON change_requests 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_change_templates_updated_at 
  BEFORE UPDATE ON change_templates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_change_approvals_updated_at 
  BEFORE UPDATE ON change_approvals 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_change_implementations_updated_at 
  BEFORE UPDATE ON change_implementations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique change request numbers
CREATE OR REPLACE FUNCTION generate_change_request_number()
RETURNS TRIGGER AS $$
DECLARE
    year_code TEXT;
    sequence_num INTEGER;
    new_number TEXT;
BEGIN
    -- Get current year (full 4 digits)
    year_code := EXTRACT(YEAR FROM NOW())::TEXT;
    
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(
        CAST(RIGHT(change_number, 4) AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM change_requests
    WHERE change_number LIKE 'CR-' || year_code || '-%';
    
    -- Generate the change number: CR-YYYY-NNNN
    new_number := 'CR-' || year_code || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
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

-- Function to validate status transitions
CREATE OR REPLACE FUNCTION validate_change_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow any transition from draft
    IF OLD.status = 'draft' THEN
        RETURN NEW;
    END IF;
    
    -- Define valid transitions
    IF (OLD.status = 'submitted' AND NEW.status NOT IN ('under_review', 'cancelled', 'draft')) OR
       (OLD.status = 'under_review' AND NEW.status NOT IN ('pending_approval', 'rejected', 'on_hold', 'cancelled')) OR
       (OLD.status = 'pending_approval' AND NEW.status NOT IN ('approved', 'rejected', 'on_hold', 'cancelled')) OR
       (OLD.status = 'approved' AND NEW.status NOT IN ('implementing', 'cancelled')) OR
       (OLD.status = 'implementing' AND NEW.status NOT IN ('implemented', 'on_hold', 'cancelled')) OR
       (OLD.status = 'implemented' AND NEW.status NOT IN ('closed')) OR
       (OLD.status = 'on_hold' AND NEW.status NOT IN ('under_review', 'pending_approval', 'implementing', 'cancelled')) OR
       (OLD.status IN ('rejected', 'closed', 'cancelled') AND NEW.status != OLD.status) THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to validate status transitions
CREATE TRIGGER validate_change_status_transition_trigger
  BEFORE UPDATE OF status ON change_requests
  FOR EACH ROW 
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION validate_change_status_transition();