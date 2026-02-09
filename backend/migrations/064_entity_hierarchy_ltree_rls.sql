-- Migration 064: Entity hierarchy with ltree (Portfolio > Program > Project)
-- Spec: .kiro/specs/entity-hierarchy/
-- Adds: ltree extension, organization_id on portfolios, path on portfolios/programs/projects,
--       triggers to maintain path, RLS policies for org scope.

-- 1. ltree extension
CREATE EXTENSION IF NOT EXISTS ltree;

-- 2. portfolios: organization_id (if missing), path (ltree)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'portfolios' AND column_name = 'organization_id') THEN
        ALTER TABLE portfolios ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        -- organizations may not exist; add as UUID without FK
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'portfolios' AND column_name = 'organization_id') THEN
            ALTER TABLE portfolios ADD COLUMN organization_id UUID;
        END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'portfolios' AND column_name = 'path') THEN
        ALTER TABLE portfolios ADD COLUMN path ltree;
        CREATE INDEX IF NOT EXISTS idx_portfolios_path ON portfolios USING GIST (path);
        UPDATE portfolios SET path = ('p.' || replace(id::text, '-', '_'))::ltree WHERE path IS NULL;
    END IF;
END $$;

-- Trigger: set path on portfolio INSERT/UPDATE
CREATE OR REPLACE FUNCTION set_portfolio_path()
RETURNS TRIGGER AS $$
BEGIN
    NEW.path := ('p.' || replace(NEW.id::text, '-', '_'))::ltree;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_portfolios_path ON portfolios;
CREATE TRIGGER trg_portfolios_path
    BEFORE INSERT OR UPDATE OF id ON portfolios
    FOR EACH ROW EXECUTE FUNCTION set_portfolio_path();

-- 3. programs: path (ltree)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'path') THEN
        ALTER TABLE programs ADD COLUMN path ltree;
        CREATE INDEX IF NOT EXISTS idx_programs_path ON programs USING GIST (path);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION set_program_path()
RETURNS TRIGGER AS $$
DECLARE
    p_path ltree;
BEGIN
    SELECT path INTO p_path FROM portfolios WHERE id = NEW.portfolio_id;
    IF p_path IS NULL THEN
        p_path := ('p.' || replace(NEW.portfolio_id::text, '-', '_'))::ltree;
    END IF;
    NEW.path := p_path || ('g.' || replace(NEW.id::text, '-', '_'))::ltree;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_programs_path ON programs;
CREATE TRIGGER trg_programs_path
    BEFORE INSERT OR UPDATE OF id, portfolio_id ON programs
    FOR EACH ROW EXECUTE FUNCTION set_program_path();

UPDATE programs SET path = (SELECT path FROM portfolios WHERE id = programs.portfolio_id) || ('g.' || replace(programs.id::text, '-', '_'))::ltree WHERE path IS NULL;

-- 4. projects: path (ltree)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'path') THEN
        ALTER TABLE projects ADD COLUMN path ltree;
        CREATE INDEX IF NOT EXISTS idx_projects_path ON projects USING GIST (path);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION set_project_path()
RETURNS TRIGGER AS $$
DECLARE
    base_path ltree;
BEGIN
    IF NEW.program_id IS NOT NULL THEN
        SELECT path INTO base_path FROM programs WHERE id = NEW.program_id;
    END IF;
    IF base_path IS NULL AND NEW.portfolio_id IS NOT NULL THEN
        base_path := (SELECT path FROM portfolios WHERE id = NEW.portfolio_id);
    END IF;
    IF base_path IS NULL THEN
        base_path := ('p.' || replace(COALESCE(NEW.portfolio_id, NEW.id)::text, '-', '_'))::ltree;
    END IF;
    NEW.path := base_path || ('j.' || replace(NEW.id::text, '-', '_'))::ltree;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_path ON projects;
CREATE TRIGGER trg_projects_path
    BEFORE INSERT OR UPDATE OF id, portfolio_id, program_id ON projects
    FOR EACH ROW EXECUTE FUNCTION set_project_path();

UPDATE projects SET path = (
    SELECT COALESCE(
        (SELECT path FROM programs WHERE id = projects.program_id),
        (SELECT path FROM portfolios WHERE id = projects.portfolio_id)
    ) || ('j.' || replace(projects.id::text, '-', '_'))::ltree
) WHERE path IS NULL AND (portfolio_id IS NOT NULL OR program_id IS NOT NULL);

-- 5. RLS (optional: enable if not already; policies for org scope)
-- Ensure RLS is enabled
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: service_role / anon can be handled by existing policies; add org-scoped read if needed
-- Example: "Users see portfolios of their organization" (requires user_organizations or similar)
-- Here we only add the path columns and triggers; existing RLS policies remain.

COMMENT ON COLUMN portfolios.path IS 'ltree path for hierarchy (e.g. p.<id>)';
COMMENT ON COLUMN programs.path IS 'ltree path (e.g. p.<pid>.g.<gid>)';
COMMENT ON COLUMN projects.path IS 'ltree path (e.g. p.<pid>.g.<gid>.j.<jid>)';
