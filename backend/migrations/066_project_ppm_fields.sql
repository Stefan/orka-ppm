-- Project PPM / external source fields (e.g. Roche DIA/Cora)
-- Enables storing full project payload from external systems and mapping orderIds -> name for linking with commitments/actuals.

-- External source id (e.g. 156 from PPM)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS external_id BIGINT;
COMMENT ON COLUMN projects.external_id IS 'ID from external PPM system (e.g. Roche DIA).';

-- Parent projects in external system
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_external_ids JSONB DEFAULT '[]';
COMMENT ON COLUMN projects.parent_project_external_ids IS 'External parent project IDs (e.g. [82]).';

-- Lifecycle
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS live_date TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS date_last_updated TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS percentage_complete NUMERIC(5,2);

-- Type / status / phase (external ids + descriptions)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type_id INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type_description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_status_id INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_status_description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_phase_id INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_phase_description TEXT;

-- PPM link
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ppm_project_home_url TEXT;

-- Legal entity
ALTER TABLE projects ADD COLUMN IF NOT EXISTS legal_entity_id INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS legal_entity_description TEXT;

-- Order IDs (e.g. C.32.03936) – used as project number for linking commitments/actuals
ALTER TABLE projects ADD COLUMN IF NOT EXISTS order_ids JSONB DEFAULT '[]';
COMMENT ON COLUMN projects.order_ids IS 'Order numbers from PPM (e.g. ["C.32.03936"]). First used as display name / project_nr link.';

-- PM technique / freeze / forecast
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pm_technique INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pm_technique_description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS freeze_period INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS freeze_period_description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS forecast_display_setting TEXT;

-- Cost centre / country / currency
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cost_centre TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS country_id INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS currency TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_external_id ON projects(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_order_ids_gin ON projects USING GIN (order_ids);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived) WHERE archived = TRUE;
