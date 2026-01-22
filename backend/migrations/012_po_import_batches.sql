-- Migration 012: PO Import Batches Table
-- Add comprehensive import batch tracking with detailed error reporting

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create import status enum
DO $$ BEGIN
    CREATE TYPE import_status AS ENUM (
        'pending',
        'processing',
        'completed',
        'failed',
        'partially_completed',
        'rolled_back'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create error severity enum
DO $$ BEGIN
    CREATE TYPE error_severity AS ENUM (
        'info',
        'warning',
        'error',
        'critical'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- PO Import Batches table
CREATE TABLE IF NOT EXISTS po_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Source information
    source VARCHAR(500) NOT NULL, -- Filename or source description
    file_name VARCHAR(255),
    file_size_bytes BIGINT,
    file_type VARCHAR(10), -- 'csv', 'xlsx', 'xls'
    
    -- Status tracking
    status import_status NOT NULL DEFAULT 'pending',
    status_message TEXT,
    
    -- Processing metrics
    total_records INTEGER DEFAULT 0,
    processed_records INTEGER DEFAULT 0,
    successful_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    skipped_records INTEGER DEFAULT 0,
    updated_records INTEGER DEFAULT 0,
    
    -- Hierarchy metrics
    created_hierarchies INTEGER DEFAULT 0,
    max_hierarchy_depth INTEGER DEFAULT 0,
    
    -- Timing information
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    processing_time_ms INTEGER,
    
    -- Error and warning tracking
    error_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    conflict_count INTEGER DEFAULT 0,
    
    -- Detailed results (JSONB for flexibility)
    errors JSONB DEFAULT '[]', -- Array of error objects
    warnings JSONB DEFAULT '[]', -- Array of warning objects
    conflicts JSONB DEFAULT '[]', -- Array of conflict objects
    
    -- Import configuration
    import_config JSONB DEFAULT '{}', -- Stores ImportConfig for reference
    
    -- Rollback support
    can_rollback BOOLEAN DEFAULT TRUE,
    rolled_back_at TIMESTAMP WITH TIME ZONE,
    rolled_back_by UUID REFERENCES auth.users(id),
    rollback_reason TEXT,
    
    -- Created breakdown IDs for tracking
    created_breakdown_ids JSONB DEFAULT '[]', -- Array of UUIDs
    
    -- Audit fields
    imported_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_record_counts CHECK (
        total_records >= 0 AND
        processed_records >= 0 AND
        successful_records >= 0 AND
        failed_records >= 0 AND
        skipped_records >= 0 AND
        processed_records <= total_records AND
        (successful_records + failed_records + skipped_records) <= total_records
    ),
    CONSTRAINT valid_error_counts CHECK (
        error_count >= 0 AND
        warning_count >= 0 AND
        conflict_count >= 0
    ),
    CONSTRAINT valid_timing CHECK (
        (started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at) AND
        (processing_time_ms IS NULL OR processing_time_ms >= 0)
    ),
    CONSTRAINT valid_file_size CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0)
);

-- Import batch errors table (for detailed line-by-line error tracking)
CREATE TABLE IF NOT EXISTS po_import_batch_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES po_import_batches(id) ON DELETE CASCADE,
    
    -- Error location
    row_number INTEGER NOT NULL,
    field VARCHAR(100),
    
    -- Error details
    error_type VARCHAR(100) NOT NULL,
    severity error_severity NOT NULL DEFAULT 'error',
    message TEXT NOT NULL,
    raw_value TEXT,
    
    -- Correction suggestions
    suggested_fix TEXT,
    can_auto_fix BOOLEAN DEFAULT FALSE,
    
    -- Categorization
    category VARCHAR(50), -- 'validation', 'parsing', 'hierarchy', 'conflict', 'database'
    
    -- Metadata
    error_data JSONB DEFAULT '{}', -- Additional error context
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_row_number CHECK (row_number > 0)
);

-- Import batch warnings table
CREATE TABLE IF NOT EXISTS po_import_batch_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES po_import_batches(id) ON DELETE CASCADE,
    
    -- Warning location
    row_number INTEGER NOT NULL,
    field VARCHAR(100),
    
    -- Warning details
    warning_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    suggestion TEXT,
    
    -- Metadata
    warning_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_row_number CHECK (row_number > 0)
);

-- Import batch conflicts table
CREATE TABLE IF NOT EXISTS po_import_batch_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES po_import_batches(id) ON DELETE CASCADE,
    
    -- Conflict location
    row_number INTEGER NOT NULL,
    
    -- Conflict details
    conflict_type VARCHAR(100) NOT NULL,
    existing_record JSONB NOT NULL,
    new_record JSONB NOT NULL,
    field_conflicts JSONB DEFAULT '[]', -- Array of conflicting field names
    
    -- Resolution
    suggested_resolution VARCHAR(50), -- 'skip', 'update', 'create_new', 'merge', 'manual'
    resolution_applied VARCHAR(50),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES auth.users(id),
    
    -- Metadata
    conflict_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_row_number CHECK (row_number > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_po_import_batches_project ON po_import_batches(project_id);
CREATE INDEX IF NOT EXISTS idx_po_import_batches_status ON po_import_batches(status);
CREATE INDEX IF NOT EXISTS idx_po_import_batches_imported_by ON po_import_batches(imported_by);
CREATE INDEX IF NOT EXISTS idx_po_import_batches_created_at ON po_import_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_import_batches_project_status ON po_import_batches(project_id, status);

CREATE INDEX IF NOT EXISTS idx_po_import_batch_errors_batch ON po_import_batch_errors(batch_id);
CREATE INDEX IF NOT EXISTS idx_po_import_batch_errors_severity ON po_import_batch_errors(severity);
CREATE INDEX IF NOT EXISTS idx_po_import_batch_errors_category ON po_import_batch_errors(category);

CREATE INDEX IF NOT EXISTS idx_po_import_batch_warnings_batch ON po_import_batch_warnings(batch_id);

CREATE INDEX IF NOT EXISTS idx_po_import_batch_conflicts_batch ON po_import_batch_conflicts(batch_id);
CREATE INDEX IF NOT EXISTS idx_po_import_batch_conflicts_resolved ON po_import_batch_conflicts(resolved_at) WHERE resolved_at IS NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE po_import_batches IS 'Tracks SAP PO data import batches with comprehensive status and error reporting';
COMMENT ON TABLE po_import_batch_errors IS 'Detailed line-by-line error tracking for import batches';
COMMENT ON TABLE po_import_batch_warnings IS 'Warning messages for import batches';
COMMENT ON TABLE po_import_batch_conflicts IS 'Conflict detection and resolution tracking for import batches';

COMMENT ON COLUMN po_import_batches.status IS 'Current status of the import batch';
COMMENT ON COLUMN po_import_batches.can_rollback IS 'Whether this batch can be rolled back (deleted)';
COMMENT ON COLUMN po_import_batches.created_breakdown_ids IS 'Array of breakdown IDs created by this import for rollback support';
COMMENT ON COLUMN po_import_batch_errors.severity IS 'Severity level: info, warning, error, critical';
COMMENT ON COLUMN po_import_batch_errors.can_auto_fix IS 'Whether this error can be automatically fixed';
COMMENT ON COLUMN po_import_batch_conflicts.resolution_applied IS 'The resolution strategy that was applied';

-- Grant permissions (adjust based on your RLS policies)
-- ALTER TABLE po_import_batches ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE po_import_batch_errors ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE po_import_batch_warnings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE po_import_batch_conflicts ENABLE ROW LEVEL SECURITY;
