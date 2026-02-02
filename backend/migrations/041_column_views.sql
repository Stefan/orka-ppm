-- Phase 2: Dynamic Column Customizer – saved views table
CREATE TABLE IF NOT EXISTS column_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name VARCHAR(255) NOT NULL,
  entity VARCHAR(255) NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',
  "order" INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_column_views_entity ON column_views(entity);
CREATE INDEX IF NOT EXISTS idx_column_views_user_id ON column_views(user_id);
