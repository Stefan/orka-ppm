# Manual Database Migration Guide

## Issue Resolution

The SQL migration failed because PostgreSQL doesn't support `IF NOT EXISTS` with `CREATE POLICY` statements. I've fixed the main migration file, but here's a step-by-step manual approach for better control.

## Step-by-Step Migration

### Step 1: Create Custom Types
Execute this in Supabase SQL Editor:

```sql
-- Create custom types for enums
DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('planning', 'active', 'on-hold', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE health_indicator AS ENUM ('green', 'yellow', 'red');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_category AS ENUM ('technical', 'financial', 'resource', 'schedule', 'external');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_status AS ENUM ('identified', 'analyzing', 'mitigating', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE issue_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE issue_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE workflow_status AS ENUM ('draft', 'active', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE currency_code AS ENUM ('USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
```

### Step 2: Create New Tables
Execute each table creation separately:

```sql
-- Create portfolios table
CREATE TABLE IF NOT EXISTS portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create milestones table
CREATE TABLE IF NOT EXISTS milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    completion_date DATE,
    status VARCHAR(50) DEFAULT 'pending',
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create risks table
CREATE TABLE IF NOT EXISTS risks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category risk_category NOT NULL,
    probability DECIMAL(3,2) NOT NULL CHECK (probability >= 0 AND probability <= 1),
    impact DECIMAL(3,2) NOT NULL CHECK (impact >= 0 AND impact <= 1),
    risk_score DECIMAL(3,2) GENERATED ALWAYS AS (probability * impact) STORED,
    status risk_status DEFAULT 'identified',
    mitigation TEXT,
    owner_id UUID REFERENCES auth.users(id),
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create issues table
CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    risk_id UUID REFERENCES risks(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity issue_severity NOT NULL DEFAULT 'medium',
    status issue_status DEFAULT 'open',
    assigned_to UUID REFERENCES auth.users(id),
    reporter_id UUID REFERENCES auth.users(id),
    resolution TEXT,
    resolution_date TIMESTAMP WITH TIME ZONE,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL,
    status workflow_status DEFAULT 'draft',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflow_instances table
CREATE TABLE IF NOT EXISTS workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    entity_type VARCHAR(50),
    entity_id UUID,
    current_step INTEGER DEFAULT 1,
    status workflow_status DEFAULT 'active',
    data JSONB DEFAULT '{}',
    started_by UUID REFERENCES auth.users(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create workflow_approvals table
CREATE TABLE IF NOT EXISTS workflow_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    approver_id UUID NOT NULL REFERENCES auth.users(id),
    status approval_status DEFAULT 'pending',
    comments TEXT,
    approved_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create financial_tracking table
CREATE TABLE IF NOT EXISTS financial_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    planned_amount DECIMAL(12,2) NOT NULL,
    actual_amount DECIMAL(12,2) DEFAULT 0,
    currency currency_code DEFAULT 'USD',
    exchange_rate DECIMAL(10,6) DEFAULT 1.0,
    date_incurred DATE NOT NULL,
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_resources table
CREATE TABLE IF NOT EXISTS project_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    allocation_percentage INTEGER DEFAULT 100 CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100),
    start_date DATE,
    end_date DATE,
    hourly_rate DECIMAL(8,2),
    role_in_project VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, resource_id)
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Step 3: Add Missing Columns to Existing Tables
Execute these column additions:

```sql
-- Add missing columns to projects table
DO $$
BEGIN
    -- Add health column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'health') THEN
        ALTER TABLE projects ADD COLUMN health health_indicator DEFAULT 'green';
    END IF;
    
    -- Add start_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'start_date') THEN
        ALTER TABLE projects ADD COLUMN start_date DATE;
    END IF;
    
    -- Add end_date column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'end_date') THEN
        ALTER TABLE projects ADD COLUMN end_date DATE;
    END IF;
    
    -- Add actual_cost column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'actual_cost') THEN
        ALTER TABLE projects ADD COLUMN actual_cost DECIMAL(12,2) DEFAULT 0;
    END IF;
    
    -- Add manager_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'manager_id') THEN
        ALTER TABLE projects ADD COLUMN manager_id UUID REFERENCES auth.users(id);
    END IF;
    
    -- Add team_members column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'team_members') THEN
        ALTER TABLE projects ADD COLUMN team_members JSONB DEFAULT '[]';
    END IF;
    
    -- Add portfolio_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'portfolio_id') THEN
        ALTER TABLE projects ADD COLUMN portfolio_id UUID REFERENCES portfolios(id);
    END IF;
END $$;

-- Add missing columns to resources table
DO $$
BEGIN
    -- Add email column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'email') THEN
        ALTER TABLE resources ADD COLUMN email VARCHAR(255) UNIQUE;
    END IF;
    
    -- Add role column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'role') THEN
        ALTER TABLE resources ADD COLUMN role VARCHAR(100);
    END IF;
    
    -- Add availability column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'availability') THEN
        ALTER TABLE resources ADD COLUMN availability INTEGER DEFAULT 100 CHECK (availability >= 0 AND availability <= 100);
    END IF;
    
    -- Add hourly_rate column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'hourly_rate') THEN
        ALTER TABLE resources ADD COLUMN hourly_rate DECIMAL(8,2);
    END IF;
    
    -- Add current_projects column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'current_projects') THEN
        ALTER TABLE resources ADD COLUMN current_projects JSONB DEFAULT '[]';
    END IF;
    
    -- Add location column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'location') THEN
        ALTER TABLE resources ADD COLUMN location VARCHAR(255);
    END IF;
    
    -- Ensure capacity column exists (might already exist)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resources' AND column_name = 'capacity') THEN
        ALTER TABLE resources ADD COLUMN capacity INTEGER DEFAULT 40;
    END IF;
END $$;
```

### Step 4: Create Indexes
Execute index creation:

```sql
-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_portfolio_id ON projects(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_health ON projects(health);

CREATE INDEX IF NOT EXISTS idx_resources_email ON resources(email);
CREATE INDEX IF NOT EXISTS idx_resources_role ON resources(role);
CREATE INDEX IF NOT EXISTS idx_resources_availability ON resources(availability);

CREATE INDEX IF NOT EXISTS idx_risks_project_id ON risks(project_id);
CREATE INDEX IF NOT EXISTS idx_risks_category ON risks(category);
CREATE INDEX IF NOT EXISTS idx_risks_status ON risks(status);
CREATE INDEX IF NOT EXISTS idx_risks_owner_id ON risks(owner_id);

CREATE INDEX IF NOT EXISTS idx_issues_project_id ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_risk_id ON issues(risk_id);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_to);

CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_due_date ON milestones(due_date);

CREATE INDEX IF NOT EXISTS idx_financial_tracking_project_id ON financial_tracking(project_id);
CREATE INDEX IF NOT EXISTS idx_financial_tracking_category ON financial_tracking(category);
CREATE INDEX IF NOT EXISTS idx_financial_tracking_date_incurred ON financial_tracking(date_incurred);

CREATE INDEX IF NOT EXISTS idx_project_resources_project_id ON project_resources(project_id);
CREATE INDEX IF NOT EXISTS idx_project_resources_resource_id ON project_resources(resource_id);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_workflow_id ON workflow_instances(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_project_id ON workflow_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);

CREATE INDEX IF NOT EXISTS idx_workflow_approvals_instance_id ON workflow_approvals(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_approver_id ON workflow_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_status ON workflow_approvals(status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by ON audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs(changed_at);
```

### Step 5: Enable RLS and Create Policies
Execute RLS setup:

```sql
-- Enable Row Level Security on new tables
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create basic policies (execute one at a time)
CREATE POLICY "Users can view portfolios" ON portfolios FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert portfolios" ON portfolios FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update portfolios" ON portfolios FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view risks" ON risks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert risks" ON risks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update risks" ON risks FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view issues" ON issues FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can insert issues" ON issues FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update issues" ON issues FOR UPDATE USING (auth.role() = 'authenticated');

-- Continue with other tables...
```

### Step 6: Fix Portfolios Table and Insert Default Data

First, check if the portfolios table has the owner_id column and add it if missing:

```sql
-- Add owner_id column to portfolios table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'portfolios' AND column_name = 'owner_id') THEN
        ALTER TABLE portfolios ADD COLUMN owner_id UUID REFERENCES auth.users(id);
    END IF;
END $$;
```

Then insert default data:

```sql
-- Insert sample data for portfolios if none exist
INSERT INTO portfolios (id, name, description, owner_id) 
SELECT 
    '7608eb53-768e-4fa8-94f7-633c92b7a6ab'::UUID,
    'Default Portfolio',
    'Default portfolio for initial setup',
    NULL
WHERE NOT EXISTS (SELECT 1 FROM portfolios WHERE id = '7608eb53-768e-4fa8-94f7-633c92b7a6ab'::UUID);

-- Update existing projects to have the default portfolio_id if they don't have one
UPDATE projects SET portfolio_id = '7608eb53-768e-4fa8-94f7-633c92b7a6ab'::UUID WHERE portfolio_id IS NULL;
```

### Step 7: Verify Migration
Run the verification script:

```bash
cd backend
source venv/bin/activate
python migrations/verify_schema.py
```

## Alternative: Use Fixed Migration File

The main migration file `supabase_schema_enhancement.sql` has been fixed to handle the policy creation issue. You can now try running it again in the Supabase SQL Editor.

## Troubleshooting

If you encounter issues:

1. **Policy already exists errors**: Skip those policies or drop them first
2. **Foreign key errors**: Ensure referenced tables exist first
3. **Type already exists**: These are safe to ignore
4. **Column already exists**: These are safe to ignore

The migration is designed to be idempotent, so you can run sections multiple times safely.