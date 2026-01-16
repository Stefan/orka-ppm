-- Migration 012: Integrated Change Management System (FIXED)
-- Fixed table ordering to resolve foreign key dependencies

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

-- Drop existing tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS change_notifications CASCADE;
DROP TABLE IF EXISTS change_implementations CASCADE;
DROP TABLE IF EXISTS change_impacts CASCADE;
DROP TABLE IF EXISTS change_audit_log CASCADE;
DROP TABLE IF EXISTS change_approvals CASCADE;
DROP TABLE IF EXISTS change_request_po_links CASCADE;
DROP TABLE IF EXISTS change_requests CASCADE;
DROP TABLE IF EXISTS change_templates CASCADE;

-- ============================================================================
-- STEP 1: Create tables WITHOUT foreign key dependencies first
-- ============================================================================

-- Change request templates (NO dependencies - create first)
CREATE TABLE change_templates (
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

-- ============================================================================
-- STEP 2: Create change_requests (depends on change_templates)
-- ============================================================================

-- Enhanced change requests table
CREATE TABLE change_requests (
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

-- ============================================================================
-- STEP 3: Create dependent tables (depend on change_requests)
-- ============================================================================

-- Approval workflows and steps
CREATE TABLE change_approvals (
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

-- Comprehensive audit log for change management
CREATE TABLE change_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'status_changed', 'approved', 'rejected', etc.
    event_description TEXT,
    old_values JSONB,
    new_values JSONB,
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Detailed impact analysis
CREATE TABLE change_impacts (
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
    new_risks JSONB DEFAULT '[]',
    affected_existing_risks JSONB DEFAULT '[]',
    risk_mitigation_required BOOLEAN DEFAULT false,
    
    -- Quality impacts
    quality_requirements_affected BOOLEAN DEFAULT false,
    quality_impact_details JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Implementation tracking
CREATE TABLE change_implementations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    
    -- Implementation details
    implementation_plan TEXT,
    implementation_steps JSONB DEFAULT '[]',
    assigned_to UUID REFERENCES auth.users(id),
    implementation_team JSONB DEFAULT '[]', -- Array of user IDs
    
    -- Progress tracking
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    current_step INTEGER DEFAULT 1,
    completed_steps JSONB DEFAULT '[]',
    
    -- Dates
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    
    -- Status
    implementation_status VARCHAR(50) DEFAULT 'not_started',
    blockers JSONB DEFAULT '[]',
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Change notifications
CREATE TABLE change_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES auth.users(id),
    notification_type VARCHAR(50) NOT NULL, -- 'approval_required', 'status_update', 'deadline_approaching', etc.
    notification_title VARCHAR(255) NOT NULL,
    notification_body TEXT,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivery_method VARCHAR(50) DEFAULT 'in_app' -- 'in_app', 'email', 'sms'
);

-- Change request PO links (recreate with proper reference)
CREATE TABLE change_request_po_links (
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

-- ============================================================================
-- Indexes for performance
-- ============================================================================

CREATE INDEX idx_change_requests_project_id ON change_requests(project_id);
CREATE INDEX idx_change_requests_status ON change_requests(status);
CREATE INDEX idx_change_requests_requested_by ON change_requests(requested_by);
CREATE INDEX idx_change_requests_change_number ON change_requests(change_number);

CREATE INDEX idx_change_approvals_change_request_id ON change_approvals(change_request_id);
CREATE INDEX idx_change_approvals_approver_id ON change_approvals(approver_id);
CREATE INDEX idx_change_approvals_decision ON change_approvals(decision);

CREATE INDEX idx_change_audit_log_change_request_id ON change_audit_log(change_request_id);
CREATE INDEX idx_change_audit_log_performed_by ON change_audit_log(performed_by);
CREATE INDEX idx_change_audit_log_performed_at ON change_audit_log(performed_at);
CREATE INDEX idx_change_audit_log_event_type ON change_audit_log(event_type);

CREATE INDEX idx_change_impacts_change_request_id ON change_impacts(change_request_id);
CREATE INDEX idx_change_implementations_change_request_id ON change_implementations(change_request_id);
CREATE INDEX idx_change_implementations_assigned_to ON change_implementations(assigned_to);

CREATE INDEX idx_change_notifications_change_request_id ON change_notifications(change_request_id);
CREATE INDEX idx_change_notifications_recipient_id ON change_notifications(recipient_id);
CREATE INDEX idx_change_notifications_is_read ON change_notifications(is_read) WHERE NOT is_read;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE change_requests IS 'Core change request tracking with workflow integration';
COMMENT ON TABLE change_templates IS 'Reusable templates for common change request types';
COMMENT ON TABLE change_approvals IS 'Multi-step approval workflow tracking';
COMMENT ON TABLE change_audit_log IS 'Complete audit trail of all change management activities';
COMMENT ON TABLE change_impacts IS 'Detailed impact analysis for schedule, cost, resources, and risks';
COMMENT ON TABLE change_implementations IS 'Implementation planning and progress tracking';
COMMENT ON TABLE change_notifications IS 'Notification system for change management events';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 012 completed successfully!';
    RAISE NOTICE 'Created tables: change_templates, change_requests, change_approvals, change_audit_log, change_impacts, change_implementations, change_notifications';
END $$;
