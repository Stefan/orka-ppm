-- Integrated Master Schedule System Migration
-- Creates comprehensive project scheduling capabilities with Gantt chart support,
-- Work Breakdown Structure (WBS) management, and real-time schedule tracking

-- =====================================================
-- CUSTOM TYPES FOR SCHEDULE MANAGEMENT
-- =====================================================

-- Dependency types for task relationships
CREATE TYPE dependency_type AS ENUM (
    'finish_to_start',
    'start_to_start', 
    'finish_to_finish',
    'start_to_finish'
);

-- Task status enumeration
CREATE TYPE task_status AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'on_hold',
    'cancelled'
);

-- Milestone status enumeration  
CREATE TYPE milestone_status AS ENUM (
    'planned',
    'at_risk',
    'achieved',
    'missed'
);

-- =====================================================
-- MAIN SCHEDULE MANAGEMENT TABLES
-- =====================================================

-- Main schedules table
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    baseline_start_date DATE,
    baseline_end_date DATE,
    status VARCHAR(50) DEFAULT 'active',
    
    -- Schedule metadata
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Performance tracking
    schedule_performance_index DECIMAL(5,3),
    schedule_variance_days INTEGER,
    
    CONSTRAINT schedules_date_check CHECK (end_date >= start_date)
);

-- Tasks table with WBS support
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- Task identification
    wbs_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Scheduling information
    planned_start_date DATE NOT NULL,
    planned_end_date DATE NOT NULL,
    actual_start_date DATE,
    actual_end_date DATE,
    duration_days INTEGER NOT NULL,
    
    -- Baseline information
    baseline_start_date DATE,
    baseline_end_date DATE,
    baseline_duration_days INTEGER,
    
    -- Progress tracking
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    status task_status DEFAULT 'not_started',
    
    -- Work information
    planned_effort_hours DECIMAL(10,2),
    actual_effort_hours DECIMAL(10,2),
    remaining_effort_hours DECIMAL(10,2),
    
    -- Critical path analysis
    is_critical BOOLEAN DEFAULT FALSE,
    total_float_days INTEGER DEFAULT 0,
    free_float_days INTEGER DEFAULT 0,
    early_start_date DATE,
    early_finish_date DATE,
    late_start_date DATE,
    late_finish_date DATE,
    
    -- Deliverables and acceptance
    deliverables JSONB DEFAULT '[]',
    acceptance_criteria TEXT,
    
    -- Metadata
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT tasks_date_check CHECK (planned_end_date >= planned_start_date),
    CONSTRAINT tasks_wbs_unique UNIQUE (schedule_id, wbs_code)
);

-- Task dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    predecessor_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    successor_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    dependency_type dependency_type NOT NULL DEFAULT 'finish_to_start',
    lag_days INTEGER DEFAULT 0,
    
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT no_self_dependency CHECK (predecessor_task_id != successor_task_id),
    CONSTRAINT unique_dependency UNIQUE (predecessor_task_id, successor_task_id)
);

-- WBS elements (for detailed work breakdown structure)
CREATE TABLE IF NOT EXISTS wbs_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    parent_element_id UUID REFERENCES wbs_elements(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    
    -- WBS identification
    wbs_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Hierarchy information
    level_number INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    
    -- Work package information
    work_package_manager UUID REFERENCES auth.users(id),
    deliverable_description TEXT,
    acceptance_criteria TEXT,
    
    -- Progress rollup
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT wbs_elements_code_unique UNIQUE (schedule_id, wbs_code)
);

-- Enhanced milestones table (extends existing milestones table)
-- First check if we need to enhance the existing milestones table
DO $$
BEGIN
    -- Add schedule_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'schedule_id') THEN
        ALTER TABLE milestones ADD COLUMN schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE;
    END IF;
    
    -- Add task_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'task_id') THEN
        ALTER TABLE milestones ADD COLUMN task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;
    END IF;
    
    -- Add target_date column if it doesn't exist (rename from due_date)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'target_date') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'due_date') THEN
            ALTER TABLE milestones RENAME COLUMN due_date TO target_date;
        ELSE
            ALTER TABLE milestones ADD COLUMN target_date DATE NOT NULL DEFAULT CURRENT_DATE;
        END IF;
    END IF;
    
    -- Add actual_date column if it doesn't exist (rename from completion_date)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'actual_date') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'completion_date') THEN
            ALTER TABLE milestones RENAME COLUMN completion_date TO actual_date;
        ELSE
            ALTER TABLE milestones ADD COLUMN actual_date DATE;
        END IF;
    END IF;
    
    -- Update status column to use milestone_status enum if it's currently text
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'status' AND data_type = 'character varying') THEN
        -- Drop partial indexes that use status::text in predicate (not immutable); they will be recreated below
        DROP INDEX IF EXISTS idx_milestones_target_date_status;
        DROP INDEX IF EXISTS idx_milestones_due_date_status;
        -- First update existing values to match enum
        UPDATE milestones SET status = 'planned' WHERE status = 'pending';
        UPDATE milestones SET status = 'achieved' WHERE status = 'completed';
        -- Drop default so type change can run, then change type, then restore default
        ALTER TABLE milestones ALTER COLUMN status DROP DEFAULT;
        ALTER TABLE milestones ALTER COLUMN status TYPE milestone_status USING status::milestone_status;
        ALTER TABLE milestones ALTER COLUMN status SET DEFAULT 'planned'::milestone_status;
        -- Recreate partial index with enum predicate (immutable)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'target_date') THEN
            CREATE INDEX IF NOT EXISTS idx_milestones_target_date_status ON milestones(target_date, status) WHERE status IN ('planned', 'at_risk');
        ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'due_date') THEN
            CREATE INDEX IF NOT EXISTS idx_milestones_due_date_status ON milestones(due_date, status) WHERE status IN ('planned', 'at_risk');
        END IF;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'status') THEN
        ALTER TABLE milestones ADD COLUMN status milestone_status DEFAULT 'planned';
    END IF;
    
    -- Add success_criteria column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'success_criteria') THEN
        ALTER TABLE milestones ADD COLUMN success_criteria TEXT;
    END IF;
    
    -- Add responsible_party column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'responsible_party') THEN
        ALTER TABLE milestones ADD COLUMN responsible_party UUID REFERENCES auth.users(id);
    END IF;
    
    -- Add deliverables column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'deliverables') THEN
        ALTER TABLE milestones ADD COLUMN deliverables JSONB DEFAULT '[]';
    END IF;
    
    -- Add approval fields if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'approval_required') THEN
        ALTER TABLE milestones ADD COLUMN approval_required BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'approved_by') THEN
        ALTER TABLE milestones ADD COLUMN approved_by UUID REFERENCES auth.users(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milestones' AND column_name = 'approved_at') THEN
        ALTER TABLE milestones ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Schedule baselines for version control
CREATE TABLE IF NOT EXISTS schedule_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    
    -- Baseline information
    baseline_name VARCHAR(255) NOT NULL,
    baseline_date DATE NOT NULL,
    description TEXT,
    
    -- Baseline data (JSON snapshot)
    baseline_data JSONB NOT NULL,
    
    -- Approval workflow
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Resource assignments to tasks
CREATE TABLE IF NOT EXISTS task_resource_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    
    -- Assignment details
    allocation_percentage INTEGER NOT NULL DEFAULT 100 CHECK (allocation_percentage > 0 AND allocation_percentage <= 100),
    planned_hours DECIMAL(8,2),
    actual_hours DECIMAL(8,2),
    
    -- Assignment period
    assignment_start_date DATE,
    assignment_end_date DATE,
    
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_task_resource UNIQUE (task_id, resource_id)
);

-- =====================================================
-- PERFORMANCE INDEXES
-- =====================================================

-- Schedules indexes
CREATE INDEX IF NOT EXISTS idx_schedules_project_id ON schedules(project_id);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_dates ON schedules(start_date, end_date);

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_schedule_id ON tasks(schedule_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_wbs_code ON tasks(schedule_id, wbs_code);
CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(planned_start_date, planned_end_date);
CREATE INDEX IF NOT EXISTS idx_tasks_critical ON tasks(is_critical) WHERE is_critical = TRUE;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_progress ON tasks(progress_percentage);

-- Task dependencies indexes
CREATE INDEX IF NOT EXISTS idx_task_dependencies_predecessor ON task_dependencies(predecessor_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_successor ON task_dependencies(successor_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_type ON task_dependencies(dependency_type);

-- WBS elements indexes
CREATE INDEX IF NOT EXISTS idx_wbs_elements_schedule_id ON wbs_elements(schedule_id);
CREATE INDEX IF NOT EXISTS idx_wbs_elements_parent ON wbs_elements(parent_element_id);
CREATE INDEX IF NOT EXISTS idx_wbs_elements_level ON wbs_elements(level_number);
CREATE INDEX IF NOT EXISTS idx_wbs_elements_task_id ON wbs_elements(task_id);

-- Enhanced milestones indexes
CREATE INDEX IF NOT EXISTS idx_milestones_schedule_id ON milestones(schedule_id) WHERE schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_milestones_target_date ON milestones(target_date);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_responsible_party ON milestones(responsible_party) WHERE responsible_party IS NOT NULL;

-- Schedule baselines indexes
CREATE INDEX IF NOT EXISTS idx_schedule_baselines_schedule_id ON schedule_baselines(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_baselines_date ON schedule_baselines(baseline_date);
CREATE INDEX IF NOT EXISTS idx_schedule_baselines_approved ON schedule_baselines(is_approved);

-- Task resource assignments indexes
CREATE INDEX IF NOT EXISTS idx_task_resource_assignments_task ON task_resource_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_resource_assignments_resource ON task_resource_assignments(resource_id);
CREATE INDEX IF NOT EXISTS idx_task_resource_assignments_dates ON task_resource_assignments(assignment_start_date, assignment_end_date);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =====================================================

-- Apply updated_at triggers to new tables
CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wbs_elements_updated_at BEFORE UPDATE ON wbs_elements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_task_resource_assignments_updated_at BEFORE UPDATE ON task_resource_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- AUDIT TRIGGERS FOR SCHEDULE MANAGEMENT
-- =====================================================

-- Apply audit triggers only if audit_trigger_function exists (from 001 or similar)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'audit_trigger_function') THEN
        CREATE TRIGGER audit_schedules AFTER INSERT OR UPDATE OR DELETE ON schedules FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
        CREATE TRIGGER audit_tasks AFTER INSERT OR UPDATE OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
        CREATE TRIGGER audit_task_dependencies AFTER INSERT OR UPDATE OR DELETE ON task_dependencies FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
        CREATE TRIGGER audit_wbs_elements AFTER INSERT OR UPDATE OR DELETE ON wbs_elements FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
        CREATE TRIGGER audit_schedule_baselines AFTER INSERT OR UPDATE OR DELETE ON schedule_baselines FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
        CREATE TRIGGER audit_task_resource_assignments AFTER INSERT OR UPDATE OR DELETE ON task_resource_assignments FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
    END IF;
END $$;

-- =====================================================
-- SCHEDULE MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to calculate task progress rollup
CREATE OR REPLACE FUNCTION calculate_task_progress_rollup(parent_task_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_effort DECIMAL(10,2) := 0;
    completed_effort DECIMAL(10,2) := 0;
    child_record RECORD;
    rollup_progress INTEGER := 0;
BEGIN
    -- Get all child tasks
    FOR child_record IN 
        SELECT planned_effort_hours, progress_percentage 
        FROM tasks 
        WHERE parent_task_id = calculate_task_progress_rollup.parent_task_id
    LOOP
        total_effort := total_effort + COALESCE(child_record.planned_effort_hours, 0);
        completed_effort := completed_effort + (COALESCE(child_record.planned_effort_hours, 0) * child_record.progress_percentage / 100.0);
    END LOOP;
    
    -- Calculate rollup progress
    IF total_effort > 0 THEN
        rollup_progress := ROUND((completed_effort / total_effort) * 100);
    END IF;
    
    RETURN LEAST(100, GREATEST(0, rollup_progress));
END;
$$ LANGUAGE plpgsql;

-- Function to detect circular dependencies
CREATE OR REPLACE FUNCTION detect_circular_dependency(
    new_predecessor_id UUID,
    new_successor_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    visited_tasks UUID[] := ARRAY[]::UUID[];
    current_task UUID;
    stack UUID[] := ARRAY[new_successor_id];
BEGIN
    -- Start from the new successor and traverse predecessors
    WHILE array_length(stack, 1) > 0 LOOP
        current_task := stack[1];
        stack := stack[2:];
        
        -- If we've reached the new predecessor, we have a cycle
        IF current_task = new_predecessor_id THEN
            RETURN TRUE;
        END IF;
        
        -- If we've already visited this task, skip it
        IF current_task = ANY(visited_tasks) THEN
            CONTINUE;
        END IF;
        
        -- Mark as visited
        visited_tasks := array_append(visited_tasks, current_task);
        
        -- Add all predecessors to the stack
        stack := stack || ARRAY(
            SELECT predecessor_task_id 
            FROM task_dependencies 
            WHERE successor_task_id = current_task
        );
    END LOOP;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to generate WBS codes
CREATE OR REPLACE FUNCTION generate_wbs_code(
    schedule_id UUID,
    parent_code VARCHAR(50) DEFAULT NULL
)
RETURNS VARCHAR(50) AS $$
DECLARE
    next_number INTEGER;
    new_code VARCHAR(50);
BEGIN
    IF parent_code IS NULL THEN
        -- Root level WBS code
        SELECT COALESCE(MAX(CAST(wbs_code AS INTEGER)), 0) + 1
        INTO next_number
        FROM wbs_elements 
        WHERE schedule_id = generate_wbs_code.schedule_id 
        AND parent_element_id IS NULL
        AND wbs_code ~ '^[0-9]+$';
        
        new_code := next_number::VARCHAR;
    ELSE
        -- Child level WBS code
        SELECT COALESCE(MAX(CAST(SUBSTRING(wbs_code FROM LENGTH(parent_code) + 2) AS INTEGER)), 0) + 1
        INTO next_number
        FROM wbs_elements 
        WHERE schedule_id = generate_wbs_code.schedule_id 
        AND wbs_code LIKE parent_code || '.%'
        AND wbs_code ~ ('^' || parent_code || '\.[0-9]+$');
        
        new_code := parent_code || '.' || next_number::VARCHAR;
    END IF;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to validate task dependency creation
CREATE OR REPLACE FUNCTION validate_task_dependency()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for circular dependencies
    IF detect_circular_dependency(NEW.predecessor_task_id, NEW.successor_task_id) THEN
        RAISE EXCEPTION 'Circular dependency detected between tasks % and %', 
            NEW.predecessor_task_id, NEW.successor_task_id;
    END IF;
    
    -- Ensure both tasks belong to the same schedule
    IF NOT EXISTS (
        SELECT 1 FROM tasks t1, tasks t2 
        WHERE t1.id = NEW.predecessor_task_id 
        AND t2.id = NEW.successor_task_id 
        AND t1.schedule_id = t2.schedule_id
    ) THEN
        RAISE EXCEPTION 'Tasks must belong to the same schedule';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply dependency validation trigger
CREATE TRIGGER validate_task_dependency_trigger
    BEFORE INSERT OR UPDATE ON task_dependencies
    FOR EACH ROW EXECUTE FUNCTION validate_task_dependency();

-- Function to update parent task progress when child tasks change
CREATE OR REPLACE FUNCTION update_parent_task_progress()
RETURNS TRIGGER AS $$
DECLARE
    parent_id UUID;
BEGIN
    -- Get parent task ID
    IF TG_OP = 'DELETE' THEN
        parent_id := OLD.parent_task_id;
    ELSE
        parent_id := NEW.parent_task_id;
    END IF;
    
    -- Update parent task progress if it exists
    IF parent_id IS NOT NULL THEN
        UPDATE tasks 
        SET progress_percentage = calculate_task_progress_rollup(parent_id),
            updated_at = NOW()
        WHERE id = parent_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply parent progress update trigger
CREATE TRIGGER update_parent_task_progress_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_parent_task_progress();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for schedule summary with task counts and progress
CREATE OR REPLACE VIEW v_schedule_summary AS
SELECT 
    s.id,
    s.project_id,
    s.name,
    s.description,
    s.start_date,
    s.end_date,
    s.status,
    s.schedule_performance_index,
    s.schedule_variance_days,
    COUNT(t.id) as total_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN t.is_critical = TRUE THEN 1 END) as critical_tasks,
    ROUND(AVG(t.progress_percentage)) as avg_progress,
    s.created_at,
    s.updated_at
FROM schedules s
LEFT JOIN tasks t ON s.id = t.schedule_id
GROUP BY s.id, s.project_id, s.name, s.description, s.start_date, s.end_date, 
         s.status, s.schedule_performance_index, s.schedule_variance_days, 
         s.created_at, s.updated_at;

-- View for task hierarchy with WBS structure
CREATE OR REPLACE VIEW v_task_hierarchy AS
WITH RECURSIVE task_tree AS (
    -- Root tasks (no parent)
    SELECT 
        t.id,
        t.schedule_id,
        t.parent_task_id,
        t.wbs_code,
        t.name,
        t.planned_start_date,
        t.planned_end_date,
        t.progress_percentage,
        t.status,
        t.is_critical,
        0::integer as level,
        t.wbs_code::text as path
    FROM tasks t
    WHERE t.parent_task_id IS NULL

    UNION ALL

    -- Child tasks
    SELECT 
        t.id,
        t.schedule_id,
        t.parent_task_id,
        t.wbs_code,
        t.name,
        t.planned_start_date,
        t.planned_end_date,
        t.progress_percentage,
        t.status,
        t.is_critical,
        tt.level + 1,
        (tt.path || '.' || t.wbs_code)::text
    FROM tasks t
    JOIN task_tree tt ON t.parent_task_id = tt.id
)
SELECT * FROM task_tree
ORDER BY schedule_id, path;

-- View for critical path analysis
CREATE OR REPLACE VIEW v_critical_path AS
SELECT 
    s.id as schedule_id,
    s.name as schedule_name,
    t.id as task_id,
    t.wbs_code,
    t.name as task_name,
    t.planned_start_date,
    t.planned_end_date,
    t.duration_days,
    t.total_float_days,
    t.free_float_days,
    t.is_critical,
    COUNT(td_pred.id) as predecessor_count,
    COUNT(td_succ.id) as successor_count
FROM schedules s
JOIN tasks t ON s.id = t.schedule_id
LEFT JOIN task_dependencies td_pred ON t.id = td_pred.successor_task_id
LEFT JOIN task_dependencies td_succ ON t.id = td_succ.predecessor_task_id
GROUP BY s.id, s.name, t.id, t.wbs_code, t.name, t.planned_start_date, 
         t.planned_end_date, t.duration_days, t.total_float_days, 
         t.free_float_days, t.is_critical
ORDER BY s.id, t.is_critical DESC, t.total_float_days ASC;

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON TABLE schedules IS 'Main project schedules with baseline tracking and performance metrics';
COMMENT ON TABLE tasks IS 'Individual tasks with WBS codes, dependencies, and progress tracking';
COMMENT ON TABLE task_dependencies IS 'Task relationships supporting all four dependency types';
COMMENT ON TABLE wbs_elements IS 'Work Breakdown Structure elements for hierarchical project organization';
COMMENT ON TABLE schedule_baselines IS 'Schedule baseline versions for variance analysis';
COMMENT ON TABLE task_resource_assignments IS 'Resource assignments to tasks with allocation percentages';

COMMENT ON FUNCTION calculate_task_progress_rollup(UUID) IS 'Calculates parent task progress based on child task completion and effort weighting';
COMMENT ON FUNCTION detect_circular_dependency(UUID, UUID) IS 'Detects circular dependencies in task relationships';
COMMENT ON FUNCTION generate_wbs_code(UUID, VARCHAR) IS 'Generates unique WBS codes following standard numbering conventions';

COMMENT ON VIEW v_schedule_summary IS 'Summary view of schedules with task counts and progress metrics';
COMMENT ON VIEW v_task_hierarchy IS 'Hierarchical view of tasks showing WBS structure and levels';
COMMENT ON VIEW v_critical_path IS 'Critical path analysis view with task relationships and float calculations';

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Update table statistics for query optimization
ANALYZE schedules;
ANALYZE tasks;
ANALYZE task_dependencies;
ANALYZE wbs_elements;
ANALYZE milestones;
ANALYZE schedule_baselines;
ANALYZE task_resource_assignments;

COMMIT;