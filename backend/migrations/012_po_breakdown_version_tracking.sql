-- Migration 012: PO Breakdown Version Tracking and Audit Trail
-- Implements comprehensive version tracking for all PO breakdown modifications
-- **Validates: Requirements 6.1, 6.2**

-- Create po_breakdown_versions table for complete audit trail
CREATE TABLE IF NOT EXISTS po_breakdown_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    breakdown_id UUID NOT NULL REFERENCES po_breakdowns(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    
    -- Change tracking
    changes JSONB NOT NULL DEFAULT '{}',
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN (
        'create', 'update', 'delete', 'move', 'import', 
        'reorder', 'sap_preservation', 'custom_field_update',
        'tag_update', 'category_update', 'financial_update'
    )),
    change_summary TEXT,
    
    -- Before/after snapshots for critical fields
    before_values JSONB DEFAULT '{}',
    after_values JSONB DEFAULT '{}',
    
    -- User identification (Requirement 6.1)
    changed_by UUID NOT NULL REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Context information
    change_reason TEXT,
    is_import BOOLEAN DEFAULT FALSE,
    import_batch_id UUID,
    ip_address INET,
    user_agent TEXT,
    
    -- Audit metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_version_number CHECK (version_number >= -1), -- -1 for special operations
    CONSTRAINT unique_breakdown_version UNIQUE (breakdown_id, version_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_po_breakdown_versions_breakdown_id 
    ON po_breakdown_versions(breakdown_id);
CREATE INDEX IF NOT EXISTS idx_po_breakdown_versions_changed_by 
    ON po_breakdown_versions(changed_by);
CREATE INDEX IF NOT EXISTS idx_po_breakdown_versions_changed_at 
    ON po_breakdown_versions(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_breakdown_versions_change_type 
    ON po_breakdown_versions(change_type);
CREATE INDEX IF NOT EXISTS idx_po_breakdown_versions_import_batch 
    ON po_breakdown_versions(import_batch_id) WHERE import_batch_id IS NOT NULL;

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_po_breakdown_versions_breakdown_version 
    ON po_breakdown_versions(breakdown_id, version_number DESC);

-- Add SAP relationship preservation fields to po_breakdowns if not exists
-- **Validates: Requirement 4.6**
DO $$ 
BEGIN
    -- Add original_sap_parent_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'po_breakdowns' AND column_name = 'original_sap_parent_id'
    ) THEN
        ALTER TABLE po_breakdowns 
        ADD COLUMN original_sap_parent_id UUID REFERENCES po_breakdowns(id);
    END IF;
    
    -- Add sap_hierarchy_path if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'po_breakdowns' AND column_name = 'sap_hierarchy_path'
    ) THEN
        ALTER TABLE po_breakdowns 
        ADD COLUMN sap_hierarchy_path JSONB DEFAULT '[]';
    END IF;
    
    -- Add has_custom_parent if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'po_breakdowns' AND column_name = 'has_custom_parent'
    ) THEN
        ALTER TABLE po_breakdowns 
        ADD COLUMN has_custom_parent BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add display_order if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'po_breakdowns' AND column_name = 'display_order'
    ) THEN
        ALTER TABLE po_breakdowns 
        ADD COLUMN display_order INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create indexes for SAP relationship fields
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_original_sap_parent 
    ON po_breakdowns(original_sap_parent_id) WHERE original_sap_parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_po_breakdowns_has_custom_parent 
    ON po_breakdowns(has_custom_parent) WHERE has_custom_parent = TRUE;

-- Function to automatically create version record on po_breakdown changes
-- **Validates: Requirements 6.1, 6.2**
CREATE OR REPLACE FUNCTION create_po_breakdown_version()
RETURNS TRIGGER AS $$
DECLARE
    change_type_val VARCHAR(50);
    before_vals JSONB;
    after_vals JSONB;
    changes_obj JSONB;
BEGIN
    -- Determine change type
    IF TG_OP = 'INSERT' THEN
        change_type_val := 'create';
        before_vals := '{}'::jsonb;
        after_vals := row_to_json(NEW)::jsonb;
        changes_obj := jsonb_build_object('action', 'create', 'data', after_vals);
    ELSIF TG_OP = 'UPDATE' THEN
        change_type_val := 'update';
        before_vals := row_to_json(OLD)::jsonb;
        after_vals := row_to_json(NEW)::jsonb;
        
        -- Build changes object with only changed fields
        changes_obj := '{}'::jsonb;
        IF OLD.name != NEW.name THEN
            changes_obj := changes_obj || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name));
        END IF;
        IF OLD.planned_amount != NEW.planned_amount THEN
            changes_obj := changes_obj || jsonb_build_object('planned_amount', jsonb_build_object('old', OLD.planned_amount, 'new', NEW.planned_amount));
        END IF;
        IF OLD.committed_amount != NEW.committed_amount THEN
            changes_obj := changes_obj || jsonb_build_object('committed_amount', jsonb_build_object('old', OLD.committed_amount, 'new', NEW.committed_amount));
        END IF;
        IF OLD.actual_amount != NEW.actual_amount THEN
            changes_obj := changes_obj || jsonb_build_object('actual_amount', jsonb_build_object('old', OLD.actual_amount, 'new', NEW.actual_amount));
        END IF;
        IF OLD.parent_breakdown_id IS DISTINCT FROM NEW.parent_breakdown_id THEN
            change_type_val := 'move';
            changes_obj := changes_obj || jsonb_build_object('parent_breakdown_id', jsonb_build_object('old', OLD.parent_breakdown_id, 'new', NEW.parent_breakdown_id));
        END IF;
        IF OLD.custom_fields != NEW.custom_fields THEN
            change_type_val := 'custom_field_update';
            changes_obj := changes_obj || jsonb_build_object('custom_fields', jsonb_build_object('old', OLD.custom_fields, 'new', NEW.custom_fields));
        END IF;
        IF OLD.tags != NEW.tags THEN
            change_type_val := 'tag_update';
            changes_obj := changes_obj || jsonb_build_object('tags', jsonb_build_object('old', OLD.tags, 'new', NEW.tags));
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        change_type_val := 'delete';
        before_vals := row_to_json(OLD)::jsonb;
        after_vals := '{}'::jsonb;
        changes_obj := jsonb_build_object('action', 'delete', 'soft_delete', NOT OLD.is_active);
    END IF;
    
    -- Insert version record
    -- Note: changed_by will be set by application layer, defaulting to system user
    INSERT INTO po_breakdown_versions (
        breakdown_id,
        version_number,
        changes,
        change_type,
        before_values,
        after_values,
        changed_by,
        changed_at,
        is_import
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.version, OLD.version, 1),
        changes_obj,
        change_type_val,
        before_vals,
        after_vals,
        COALESCE(NEW.created_by, OLD.created_by, '00000000-0000-0000-0000-000000000000'::uuid), -- System user fallback
        NOW(),
        COALESCE(NEW.import_batch_id, OLD.import_batch_id) IS NOT NULL
    );
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic version tracking
-- **Validates: Requirements 6.1, 6.2**
DROP TRIGGER IF EXISTS po_breakdown_version_trigger ON po_breakdowns;
CREATE TRIGGER po_breakdown_version_trigger
    AFTER INSERT OR UPDATE OR DELETE ON po_breakdowns
    FOR EACH ROW
    EXECUTE FUNCTION create_po_breakdown_version();

-- Function to get version history for a breakdown
-- **Validates: Requirement 6.3**
CREATE OR REPLACE FUNCTION get_po_breakdown_version_history(
    p_breakdown_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    version_number INTEGER,
    change_type VARCHAR(50),
    change_summary TEXT,
    changes JSONB,
    before_values JSONB,
    after_values JSONB,
    changed_by UUID,
    changed_by_email TEXT,
    changed_at TIMESTAMP WITH TIME ZONE,
    is_import BOOLEAN,
    import_batch_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        v.version_number,
        v.change_type,
        v.change_summary,
        v.changes,
        v.before_values,
        v.after_values,
        v.changed_by,
        u.email as changed_by_email,
        v.changed_at,
        v.is_import,
        v.import_batch_id
    FROM po_breakdown_versions v
    LEFT JOIN auth.users u ON v.changed_by = u.id
    WHERE v.breakdown_id = p_breakdown_id
    ORDER BY v.version_number DESC, v.changed_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to get audit trail for a project
-- **Validates: Requirements 6.3, 6.5**
CREATE OR REPLACE FUNCTION get_project_po_audit_trail(
    p_project_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_change_types VARCHAR(50)[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    breakdown_id UUID,
    breakdown_name VARCHAR(255),
    breakdown_code VARCHAR(100),
    version_number INTEGER,
    change_type VARCHAR(50),
    change_summary TEXT,
    changes JSONB,
    changed_by UUID,
    changed_by_email TEXT,
    changed_at TIMESTAMP WITH TIME ZONE,
    is_import BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pb.id as breakdown_id,
        pb.name as breakdown_name,
        pb.code as breakdown_code,
        v.version_number,
        v.change_type,
        v.change_summary,
        v.changes,
        v.changed_by,
        u.email as changed_by_email,
        v.changed_at,
        v.is_import
    FROM po_breakdown_versions v
    INNER JOIN po_breakdowns pb ON v.breakdown_id = pb.id
    LEFT JOIN auth.users u ON v.changed_by = u.id
    WHERE pb.project_id = p_project_id
        AND (p_start_date IS NULL OR v.changed_at >= p_start_date)
        AND (p_end_date IS NULL OR v.changed_at <= p_end_date)
        AND (p_change_types IS NULL OR v.change_type = ANY(p_change_types))
    ORDER BY v.changed_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to export audit data in machine-readable format
-- **Validates: Requirement 6.5**
CREATE OR REPLACE FUNCTION export_po_breakdown_audit_data(
    p_project_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'project_id', p_project_id,
        'export_date', NOW(),
        'date_range', jsonb_build_object(
            'start', p_start_date,
            'end', p_end_date
        ),
        'audit_records', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'breakdown_id', pb.id,
                    'breakdown_name', pb.name,
                    'breakdown_code', pb.code,
                    'version_number', v.version_number,
                    'change_type', v.change_type,
                    'changes', v.changes,
                    'before_values', v.before_values,
                    'after_values', v.after_values,
                    'changed_by', v.changed_by,
                    'changed_by_email', u.email,
                    'changed_at', v.changed_at,
                    'is_import', v.is_import,
                    'import_batch_id', v.import_batch_id
                )
                ORDER BY v.changed_at DESC
            )
            FROM po_breakdown_versions v
            INNER JOIN po_breakdowns pb ON v.breakdown_id = pb.id
            LEFT JOIN auth.users u ON v.changed_by = u.id
            WHERE pb.project_id = p_project_id
                AND (p_start_date IS NULL OR v.changed_at >= p_start_date)
                AND (p_end_date IS NULL OR v.changed_at <= p_end_date)
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get version statistics for a project
CREATE OR REPLACE FUNCTION get_po_breakdown_version_stats(p_project_id UUID)
RETURNS TABLE (
    total_versions BIGINT,
    total_breakdowns BIGINT,
    changes_by_type JSONB,
    changes_by_user JSONB,
    recent_activity JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(v.id) as total_versions,
        COUNT(DISTINCT v.breakdown_id) as total_breakdowns,
        (
            SELECT jsonb_object_agg(change_type, count)
            FROM (
                SELECT v2.change_type, COUNT(*) as count
                FROM po_breakdown_versions v2
                INNER JOIN po_breakdowns pb2 ON v2.breakdown_id = pb2.id
                WHERE pb2.project_id = p_project_id
                GROUP BY v2.change_type
            ) type_counts
        ) as changes_by_type,
        (
            SELECT jsonb_object_agg(user_email, count)
            FROM (
                SELECT COALESCE(u.email, 'Unknown') as user_email, COUNT(*) as count
                FROM po_breakdown_versions v2
                INNER JOIN po_breakdowns pb2 ON v2.breakdown_id = pb2.id
                LEFT JOIN auth.users u ON v2.changed_by = u.id
                WHERE pb2.project_id = p_project_id
                GROUP BY u.email
                ORDER BY count DESC
                LIMIT 10
            ) user_counts
        ) as changes_by_user,
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'breakdown_name', pb3.name,
                    'change_type', v3.change_type,
                    'changed_at', v3.changed_at,
                    'changed_by', u.email
                )
                ORDER BY v3.changed_at DESC
            )
            FROM (
                SELECT v2.*, pb2.name
                FROM po_breakdown_versions v2
                INNER JOIN po_breakdowns pb2 ON v2.breakdown_id = pb2.id
                WHERE pb2.project_id = p_project_id
                ORDER BY v2.changed_at DESC
                LIMIT 10
            ) v3
            INNER JOIN po_breakdowns pb3 ON v3.breakdown_id = pb3.id
            LEFT JOIN auth.users u ON v3.changed_by = u.id
        ) as recent_activity
    FROM po_breakdown_versions v
    INNER JOIN po_breakdowns pb ON v.breakdown_id = pb.id
    WHERE pb.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on po_breakdown_versions
ALTER TABLE po_breakdown_versions ENABLE ROW LEVEL SECURITY;

-- RLS policy for viewing version history
CREATE POLICY "Users can view version history for accessible projects" 
    ON po_breakdown_versions
    FOR SELECT USING (
        breakdown_id IN (
            SELECT pb.id FROM po_breakdowns pb
            INNER JOIN projects p ON pb.project_id = p.id
            INNER JOIN portfolios pf ON p.portfolio_id = pf.id
            WHERE pf.owner_id = auth.uid()
                OR p.manager_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_resources pr
                    WHERE pr.project_id = p.id AND pr.resource_id = auth.uid()
                )
        )
    );

-- Comments for documentation
COMMENT ON TABLE po_breakdown_versions IS 'Complete version history and audit trail for PO breakdown modifications';
COMMENT ON COLUMN po_breakdown_versions.version_number IS 'Version number of the breakdown at time of change (-1 for special operations)';
COMMENT ON COLUMN po_breakdown_versions.changes IS 'JSON object containing changed fields with before/after values';
COMMENT ON COLUMN po_breakdown_versions.change_type IS 'Type of change operation performed';
COMMENT ON COLUMN po_breakdown_versions.before_values IS 'Complete snapshot of record before change';
COMMENT ON COLUMN po_breakdown_versions.after_values IS 'Complete snapshot of record after change';
COMMENT ON COLUMN po_breakdown_versions.changed_by IS 'User who made the change';
COMMENT ON COLUMN po_breakdown_versions.changed_at IS 'Timestamp when change was made';
COMMENT ON COLUMN po_breakdown_versions.is_import IS 'Whether change was part of an import operation';

COMMENT ON FUNCTION get_po_breakdown_version_history(UUID, INTEGER, INTEGER) IS 'Get paginated version history for a specific breakdown';
COMMENT ON FUNCTION get_project_po_audit_trail(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, VARCHAR(50)[], INTEGER, INTEGER) IS 'Get filtered audit trail for all breakdowns in a project';
COMMENT ON FUNCTION export_po_breakdown_audit_data(UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Export complete audit data in machine-readable JSON format';
COMMENT ON FUNCTION get_po_breakdown_version_stats(UUID) IS 'Get version tracking statistics for a project';
