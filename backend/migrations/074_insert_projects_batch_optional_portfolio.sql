-- Allow NULL portfolio_id in insert_projects_batch for imports without portfolio.
-- Projects can be imported without being linked to a portfolio.

CREATE OR REPLACE FUNCTION public.insert_projects_batch(records jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted int;
BEGIN
  ALTER TABLE public.projects DISABLE TRIGGER audit_projects;
  BEGIN
    INSERT INTO public.projects (
      id, portfolio_id, name, description, status, priority, budget,
      start_date, end_date, manager_id, team_members, health, actual_cost
    )
    SELECT
      (e->>'id')::uuid,
      CASE
        WHEN e->>'portfolio_id' IS NOT NULL AND TRIM(e->>'portfolio_id') != ''
        THEN (e->>'portfolio_id')::uuid
        ELSE NULL
      END,
      e->>'name',
      e->>'description',
      (CASE WHEN e->>'status' = 'on_hold' THEN 'on-hold' ELSE e->>'status' END)::project_status,
      e->>'priority',
      (e->>'budget')::decimal,
      (e->>'start_date')::date,
      (e->>'end_date')::date,
      (e->>'manager_id')::uuid,
      COALESCE((e->'team_members')::jsonb, '[]'::jsonb),
      COALESCE((e->>'health')::text::health_indicator, 'green'::health_indicator),
      COALESCE((e->>'actual_cost')::decimal, 0)
    FROM jsonb_array_elements(records) AS e;
    GET DIAGNOSTICS inserted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.projects ENABLE TRIGGER audit_projects;
    RAISE;
  END;
  ALTER TABLE public.projects ENABLE TRIGGER audit_projects;
  RETURN inserted;
END;
$$;

COMMENT ON FUNCTION public.insert_projects_batch(jsonb) IS 'Bulk insert projects with audit trigger disabled. portfolio_id optional (NULL = no portfolio).';
