-- Migration 063: Programs as sub-level under Portfolios (Portfolio > Program > Project)
-- Adds programs table and program_id to projects.

-- Programs table
CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_programs_portfolio_id ON programs(portfolio_id);

-- Add program_id to projects (nullable; projects can be ungrouped)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'program_id') THEN
        ALTER TABLE projects ADD COLUMN program_id UUID REFERENCES programs(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_projects_program_id ON projects(program_id);
    END IF;
END $$;

COMMENT ON TABLE programs IS 'Programs belong to a portfolio; projects can be assigned to a program (Portfolio > Program > Project).';
COMMENT ON COLUMN projects.program_id IS 'Optional assignment to a program within the same portfolio.';
