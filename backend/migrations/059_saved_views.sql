-- Migration 059: Saved Views (No-Code-Views) – Cora-Surpass Phase 2.3
-- Spec: .kiro/specs/cora-surpass-roadmap/Tasks.md

CREATE TABLE IF NOT EXISTS saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID,
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'financials',
  definition JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_views_user_id ON saved_views (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_org_id ON saved_views (organization_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_scope ON saved_views (scope);

COMMENT ON TABLE saved_views IS 'User/org saved view definitions (filters, sort, columns) for No-Code-Views';
COMMENT ON COLUMN saved_views.scope IS 'View scope: financials, projects, commitments, actuals, etc.';
COMMENT ON COLUMN saved_views.definition IS 'JSON: filters, sortBy, sortOrder, visibleColumns, etc.';

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_views_user_select ON saved_views
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY saved_views_user_insert ON saved_views
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY saved_views_user_update ON saved_views
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY saved_views_user_delete ON saved_views
  FOR DELETE USING (auth.uid() = user_id);
