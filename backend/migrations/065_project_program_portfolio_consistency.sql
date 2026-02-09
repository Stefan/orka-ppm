-- Migration 065: Enforce project.portfolio_id = program.portfolio_id when project.program_id IS NOT NULL
-- Spec: .kiro/specs/programs/Tasks.md Task 1.3

-- Trigger: on INSERT/UPDATE of projects, when program_id is set, ensure portfolio_id matches the program's portfolio
CREATE OR REPLACE FUNCTION enforce_project_program_portfolio_consistency()
RETURNS TRIGGER AS $$
DECLARE
  prog_portfolio_id UUID;
BEGIN
  IF NEW.program_id IS NOT NULL THEN
    SELECT portfolio_id INTO prog_portfolio_id FROM programs WHERE id = NEW.program_id;
    IF prog_portfolio_id IS NULL THEN
      RAISE EXCEPTION 'program_id % does not exist', NEW.program_id;
    END IF;
    -- Align project.portfolio_id with program's portfolio (invariant: same portfolio)
    IF NEW.portfolio_id IS DISTINCT FROM prog_portfolio_id THEN
      NEW.portfolio_id := prog_portfolio_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_program_portfolio_consistency ON projects;
CREATE TRIGGER trg_project_program_portfolio_consistency
  BEFORE INSERT OR UPDATE OF program_id, portfolio_id ON projects
  FOR EACH ROW EXECUTE FUNCTION enforce_project_program_portfolio_consistency();

COMMENT ON FUNCTION enforce_project_program_portfolio_consistency() IS 'Ensures project.portfolio_id equals program.portfolio_id when project.program_id is set (Programs spec Task 1.3).';
