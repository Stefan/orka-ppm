-- Migration 043: Register Nested Grids
-- Nested grid configuration, sections, columns, user state, AI suggestions, change tracking
-- Dependencies: projects; auth.users via RLS

-- Nested Grid Configuration (register = project in costbook context)
CREATE TABLE IF NOT EXISTS nested_grid_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  enable_linked_items BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sections
CREATE TABLE IF NOT EXISTS nested_grid_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES nested_grid_configs(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('tasks', 'registers', 'cost_registers')),
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Column Configurations
CREATE TABLE IF NOT EXISTS nested_grid_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES nested_grid_sections(id) ON DELETE CASCADE,
  field VARCHAR(100) NOT NULL,
  header_name VARCHAR(200) NOT NULL,
  width INTEGER,
  editable BOOLEAN DEFAULT false,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User State (scroll positions, expanded rows, filters)
CREATE TABLE IF NOT EXISTS nested_grid_user_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  register_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  expanded_rows JSONB DEFAULT '[]',
  scroll_position JSONB,
  filter_state JSONB,
  last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, register_id)
);

-- AI Suggestions Cache
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type VARCHAR(50) NOT NULL,
  suggestion_type VARCHAR(50) NOT NULL,
  suggestion_data JSONB NOT NULL,
  confidence NUMERIC(3,2),
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Change Tracking for AI Highlights
CREATE TABLE IF NOT EXISTS nested_grid_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_row_id UUID NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  row_id UUID NOT NULL,
  field VARCHAR(100),
  change_type VARCHAR(20) CHECK (change_type IN ('added', 'modified', 'deleted')),
  previous_value JSONB,
  current_value JSONB,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nested_grid_configs_register ON nested_grid_configs(register_id);
CREATE INDEX IF NOT EXISTS idx_nested_grid_sections_config ON nested_grid_sections(config_id);
CREATE INDEX IF NOT EXISTS idx_nested_grid_columns_section ON nested_grid_columns(section_id);
CREATE INDEX IF NOT EXISTS idx_nested_grid_user_state_user_register ON nested_grid_user_state(user_id, register_id);
CREATE INDEX IF NOT EXISTS idx_nested_grid_changes_parent_row ON nested_grid_changes(parent_row_id, item_type);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type ON ai_suggestions(item_type, suggestion_type);
