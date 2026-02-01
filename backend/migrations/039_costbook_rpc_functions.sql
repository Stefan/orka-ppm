-- Costbook RPC Functions (Task 59.2)
-- RPC for complex aggregations to minimize round-trips.

-- RPC: Get project financials aggregate (budget, commitments, actuals, variance) for a list of project IDs
CREATE OR REPLACE FUNCTION get_project_financials_aggregate(project_ids UUID[])
RETURNS TABLE (
  project_id UUID,
  total_budget NUMERIC,
  total_commitments NUMERIC,
  total_actuals NUMERIC,
  total_spend NUMERIC,
  variance NUMERIC,
  spend_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS project_id,
    COALESCE(p.budget, 0)::NUMERIC AS total_budget,
    COALESCE(SUM(c.amount), 0)::NUMERIC AS total_commitments,
    COALESCE(SUM(a.amount), 0)::NUMERIC AS total_actuals,
    (COALESCE(SUM(c.amount), 0) + COALESCE(SUM(a.amount), 0))::NUMERIC AS total_spend,
    (COALESCE(p.budget, 0) - COALESCE(SUM(c.amount), 0) - COALESCE(SUM(a.amount), 0))::NUMERIC AS variance,
    CASE WHEN COALESCE(p.budget, 0) > 0
      THEN ROUND((COALESCE(SUM(c.amount), 0) + COALESCE(SUM(a.amount), 0)) / p.budget * 100, 2)
      ELSE 0
    END AS spend_percentage
  FROM projects p
  LEFT JOIN commitments c ON c.project_id = p.id AND p.id = ANY(project_ids)
  LEFT JOIN actuals a ON a.project_id = p.id AND p.id = ANY(project_ids)
  WHERE p.id = ANY(project_ids)
  GROUP BY p.id, p.budget;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_project_financials_aggregate(UUID[]) IS 'Costbook Task 59.2: RPC for project financials aggregation';
