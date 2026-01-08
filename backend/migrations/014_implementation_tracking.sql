-- Migration 014: Implementation Tracking System
-- Creates tables for tracking change request implementation progress

-- Implementation status enum
CREATE TYPE implementation_status AS ENUM (
    'planned',
    'in_progress', 
    'completed',
    'cancelled',
    'on_hold'
);

-- Task type enum
CREATE TYPE task_type AS ENUM (
    'implementation',
    'testing',
    'documentation',
    'training',
    'deployment',
    'review',
    'approval'
);

-- Implementation plans table
CREATE TABLE implementation_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    planned_start_date DATE NOT NULL,
    planned_end_date DATE NOT NULL,
    actual_start_date DATE,
    actual_end_date DATE,
    assigned_to UUID NOT NULL REFERENCES auth.users(id),
    status implementation_status NOT NULL DEFAULT 'planned',
    progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Implementation tasks table
CREATE TABLE implementation_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    implementation_plan_id UUID NOT NULL REFERENCES implementation_plans(id) ON DELETE CASCADE,
    task_number INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    task_type task_type NOT NULL DEFAULT 'implementation',
    assigned_to UUID NOT NULL REFERENCES auth.users(id),
    planned_start_date DATE NOT NULL,
    planned_end_date DATE NOT NULL,
    actual_start_date DATE,
    actual_end_date DATE,
    status implementation_status NOT NULL DEFAULT 'planned',
    progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    estimated_effort_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
    actual_effort_hours DECIMAL(10,2),
    dependencies UUID[] DEFAULT '{}',
    deliverables TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(implementation_plan_id, task_number)
);

-- Implementation milestones table
CREATE TABLE implementation_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    implementation_plan_id UUID NOT NULL REFERENCES implementation_plans(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    milestone_type VARCHAR(50) NOT NULL DEFAULT 'deliverable',
    target_date DATE NOT NULL,
    actual_date DATE,
    status implementation_status NOT NULL DEFAULT 'planned',
    dependencies UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Implementation progress notes table
CREATE TABLE implementation_progress_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    implementation_task_id UUID NOT NULL REFERENCES implementation_tasks(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    progress_percentage INTEGER NOT NULL CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Implementation lessons learned table
CREATE TABLE implementation_lessons_learned (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    implementation_plan_id UUID NOT NULL REFERENCES implementation_plans(id) ON DELETE CASCADE,
    change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
    lessons_learned TEXT NOT NULL,
    category VARCHAR(100),
    impact_on_future_changes TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Implementation deviations table
CREATE TABLE implementation_deviations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    implementation_plan_id UUID NOT NULL REFERENCES implementation_plans(id) ON DELETE CASCADE,
    deviation_type VARCHAR(50) NOT NULL, -- 'schedule', 'cost', 'scope', 'quality'
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    description TEXT NOT NULL,
    root_cause TEXT,
    corrective_action TEXT,
    impact_assessment TEXT,
    detected_date DATE NOT NULL DEFAULT CURRENT_DATE,
    resolved_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'closed'
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_implementation_plans_change_request ON implementation_plans(change_request_id);
CREATE INDEX idx_implementation_plans_assigned_to ON implementation_plans(assigned_to);
CREATE INDEX idx_implementation_plans_status ON implementation_plans(status);
CREATE INDEX idx_implementation_plans_dates ON implementation_plans(planned_start_date, planned_end_date);

CREATE INDEX idx_implementation_tasks_plan ON implementation_tasks(implementation_plan_id);
CREATE INDEX idx_implementation_tasks_assigned_to ON implementation_tasks(assigned_to);
CREATE INDEX idx_implementation_tasks_status ON implementation_tasks(status);
CREATE INDEX idx_implementation_tasks_dates ON implementation_tasks(planned_start_date, planned_end_date);
CREATE INDEX idx_implementation_tasks_dependencies ON implementation_tasks USING GIN(dependencies);

CREATE INDEX idx_implementation_milestones_plan ON implementation_milestones(implementation_plan_id);
CREATE INDEX idx_implementation_milestones_target_date ON implementation_milestones(target_date);
CREATE INDEX idx_implementation_milestones_status ON implementation_milestones(status);

CREATE INDEX idx_implementation_progress_notes_task ON implementation_progress_notes(implementation_task_id);
CREATE INDEX idx_implementation_progress_notes_created_at ON implementation_progress_notes(created_at DESC);

CREATE INDEX idx_implementation_lessons_plan ON implementation_lessons_learned(implementation_plan_id);
CREATE INDEX idx_implementation_lessons_change ON implementation_lessons_learned(change_request_id);
CREATE INDEX idx_implementation_lessons_category ON implementation_lessons_learned(category);

CREATE INDEX idx_implementation_deviations_plan ON implementation_deviations(implementation_plan_id);
CREATE INDEX idx_implementation_deviations_type ON implementation_deviations(deviation_type);
CREATE INDEX idx_implementation_deviations_severity ON implementation_deviations(severity);
CREATE INDEX idx_implementation_deviations_status ON implementation_deviations(status);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_implementation_plans_updated_at 
    BEFORE UPDATE ON implementation_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_implementation_tasks_updated_at 
    BEFORE UPDATE ON implementation_tasks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_implementation_milestones_updated_at 
    BEFORE UPDATE ON implementation_milestones 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_implementation_deviations_updated_at 
    BEFORE UPDATE ON implementation_deviations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies
ALTER TABLE implementation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE implementation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE implementation_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE implementation_progress_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE implementation_lessons_learned ENABLE ROW LEVEL SECURITY;
ALTER TABLE implementation_deviations ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be customized based on specific requirements)
CREATE POLICY "Users can view implementation plans they are assigned to or involved in" ON implementation_plans
    FOR SELECT USING (
        assigned_to = auth.uid() OR
        change_request_id IN (
            SELECT id FROM change_requests 
            WHERE requested_by = auth.uid() OR 
                  id IN (SELECT change_request_id FROM change_approvals WHERE approver_id = auth.uid())
        )
    );

CREATE POLICY "Users can update implementation plans they are assigned to" ON implementation_plans
    FOR UPDATE USING (assigned_to = auth.uid());

CREATE POLICY "Users can view implementation tasks they are assigned to or involved in" ON implementation_tasks
    FOR SELECT USING (
        assigned_to = auth.uid() OR
        implementation_plan_id IN (
            SELECT id FROM implementation_plans 
            WHERE assigned_to = auth.uid() OR
                  change_request_id IN (
                      SELECT id FROM change_requests 
                      WHERE requested_by = auth.uid()
                  )
        )
    );

CREATE POLICY "Users can update implementation tasks they are assigned to" ON implementation_tasks
    FOR UPDATE USING (assigned_to = auth.uid());

-- Similar policies for other tables
CREATE POLICY "Users can view milestones for plans they have access to" ON implementation_milestones
    FOR SELECT USING (
        implementation_plan_id IN (
            SELECT id FROM implementation_plans 
            WHERE assigned_to = auth.uid() OR
                  change_request_id IN (
                      SELECT id FROM change_requests 
                      WHERE requested_by = auth.uid()
                  )
        )
    );

CREATE POLICY "Users can view progress notes for tasks they have access to" ON implementation_progress_notes
    FOR SELECT USING (
        implementation_task_id IN (
            SELECT id FROM implementation_tasks 
            WHERE assigned_to = auth.uid()
        ) OR
        created_by = auth.uid()
    );

CREATE POLICY "Users can create progress notes for tasks they are assigned to" ON implementation_progress_notes
    FOR INSERT WITH CHECK (
        implementation_task_id IN (
            SELECT id FROM implementation_tasks 
            WHERE assigned_to = auth.uid()
        )
    );

CREATE POLICY "Users can view lessons learned for plans they have access to" ON implementation_lessons_learned
    FOR SELECT USING (
        implementation_plan_id IN (
            SELECT id FROM implementation_plans 
            WHERE assigned_to = auth.uid() OR
                  change_request_id IN (
                      SELECT id FROM change_requests 
                      WHERE requested_by = auth.uid()
                  )
        )
    );

CREATE POLICY "Users can view deviations for plans they have access to" ON implementation_deviations
    FOR SELECT USING (
        implementation_plan_id IN (
            SELECT id FROM implementation_plans 
            WHERE assigned_to = auth.uid() OR
                  change_request_id IN (
                      SELECT id FROM change_requests 
                      WHERE requested_by = auth.uid()
                  )
        )
    );

-- Comments for documentation
COMMENT ON TABLE implementation_plans IS 'Implementation plans for approved change requests';
COMMENT ON TABLE implementation_tasks IS 'Individual tasks within implementation plans';
COMMENT ON TABLE implementation_milestones IS 'Key milestones and deliverables in implementation';
COMMENT ON TABLE implementation_progress_notes IS 'Progress notes and updates for implementation tasks';
COMMENT ON TABLE implementation_lessons_learned IS 'Lessons learned from completed implementations';
COMMENT ON TABLE implementation_deviations IS 'Deviations from planned implementation and corrective actions';

COMMENT ON COLUMN implementation_plans.progress_percentage IS 'Overall implementation progress (0-100)';
COMMENT ON COLUMN implementation_tasks.dependencies IS 'Array of task IDs that must be completed before this task can start';
COMMENT ON COLUMN implementation_tasks.deliverables IS 'Array of deliverable descriptions for this task';
COMMENT ON COLUMN implementation_deviations.deviation_type IS 'Type of deviation: schedule, cost, scope, quality';
COMMENT ON COLUMN implementation_deviations.severity IS 'Severity level: low, medium, high, critical';