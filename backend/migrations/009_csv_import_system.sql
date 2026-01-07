-- Migration 009: CSV Import System for Commitments and Actuals
-- Add comprehensive CSV import functionality for financial data integration

-- Organizations table (if not exists) for multi-tenant support
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Commitments table for planned expenditures (Purchase Orders)
CREATE TABLE IF NOT EXISTS commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL,
  po_date DATE,
  vendor TEXT,
  vendor_description TEXT,
  requester TEXT,
  project TEXT,
  project_description TEXT,
  wbs_element TEXT,
  wbs_description TEXT,
  cost_center TEXT,
  cost_center_description TEXT,
  po_net_amount DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  total_amount DECIMAL(15,2),
  po_status TEXT,
  delivery_date DATE,
  currency_code TEXT DEFAULT 'USD',
  custom_fields JSONB DEFAULT '{}',
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source_file TEXT,
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(po_number, organization_id)
);

-- Actuals table for actual expenditures (Invoices/Payments)
CREATE TABLE IF NOT EXISTS actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fi_doc_no TEXT NOT NULL,
  posting_date DATE,
  document_type TEXT,
  vendor TEXT,
  vendor_invoice_no TEXT,
  project_nr TEXT,
  wbs TEXT,
  gl_account TEXT,
  cost_center TEXT,
  invoice_amount DECIMAL(15,2),
  currency_code TEXT DEFAULT 'USD',
  po_no TEXT, -- References commitments.po_number
  custom_fields JSONB DEFAULT '{}',
  imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source_file TEXT,
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(fi_doc_no, organization_id)
);

-- Financial variances table for aggregated variance analysis
CREATE TABLE IF NOT EXISTS financial_variances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT,
  wbs_element TEXT,
  total_commitment DECIMAL(15,2) DEFAULT 0,
  total_actual DECIMAL(15,2) DEFAULT 0,
  variance DECIMAL(15,2) GENERATED ALWAYS AS (total_actual - total_commitment) STORED,
  variance_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_commitment > 0 
    THEN ((total_actual - total_commitment) / total_commitment) * 100 
    ELSE 0 END
  ) STORED,
  status TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN total_actual < total_commitment * 0.95 THEN 'under'
      WHEN total_actual <= total_commitment * 1.05 THEN 'on'
      ELSE 'over'
    END
  ) STORED,
  currency_code TEXT DEFAULT 'USD',
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  organization_id UUID REFERENCES organizations(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, wbs_element, organization_id)
);

-- CSV import logs for tracking import history
CREATE TABLE IF NOT EXISTS csv_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type TEXT NOT NULL CHECK (import_type IN ('commitments', 'actuals')),
  file_name TEXT NOT NULL,
  file_size INTEGER,
  records_processed INTEGER DEFAULT 0,
  records_imported INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  import_status TEXT DEFAULT 'processing' CHECK (import_status IN ('processing', 'completed', 'failed', 'cancelled')),
  error_details JSONB DEFAULT '{}',
  column_mapping JSONB DEFAULT '{}',
  validation_errors JSONB DEFAULT '[]',
  imported_by UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_commitments_po_number ON commitments(po_number);
CREATE INDEX IF NOT EXISTS idx_commitments_project ON commitments(project);
CREATE INDEX IF NOT EXISTS idx_commitments_wbs ON commitments(wbs_element);
CREATE INDEX IF NOT EXISTS idx_commitments_vendor ON commitments(vendor);
CREATE INDEX IF NOT EXISTS idx_commitments_po_date ON commitments(po_date);
CREATE INDEX IF NOT EXISTS idx_commitments_organization ON commitments(organization_id);

CREATE INDEX IF NOT EXISTS idx_actuals_fi_doc_no ON actuals(fi_doc_no);
CREATE INDEX IF NOT EXISTS idx_actuals_po_no ON actuals(po_no);
CREATE INDEX IF NOT EXISTS idx_actuals_project ON actuals(project_nr);
CREATE INDEX IF NOT EXISTS idx_actuals_wbs ON actuals(wbs);
CREATE INDEX IF NOT EXISTS idx_actuals_vendor ON actuals(vendor);
CREATE INDEX IF NOT EXISTS idx_actuals_posting_date ON actuals(posting_date);
CREATE INDEX IF NOT EXISTS idx_actuals_organization ON actuals(organization_id);

CREATE INDEX IF NOT EXISTS idx_financial_variances_project ON financial_variances(project_id);
CREATE INDEX IF NOT EXISTS idx_financial_variances_wbs ON financial_variances(wbs_element);
CREATE INDEX IF NOT EXISTS idx_financial_variances_status ON financial_variances(status);
CREATE INDEX IF NOT EXISTS idx_financial_variances_organization ON financial_variances(organization_id);

CREATE INDEX IF NOT EXISTS idx_csv_import_logs_type ON csv_import_logs(import_type);
CREATE INDEX IF NOT EXISTS idx_csv_import_logs_status ON csv_import_logs(import_status);
CREATE INDEX IF NOT EXISTS idx_csv_import_logs_imported_by ON csv_import_logs(imported_by);
CREATE INDEX IF NOT EXISTS idx_csv_import_logs_started_at ON csv_import_logs(started_at DESC);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE actuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_variances ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view organizations they belong to" ON organizations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'manager', 'user')
  )
);

-- RLS Policies for commitments
CREATE POLICY "Users can view commitments in their organization" ON commitments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'manager', 'user')
  )
);

CREATE POLICY "Admins and managers can manage commitments" ON commitments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'manager')
  )
);

-- RLS Policies for actuals
CREATE POLICY "Users can view actuals in their organization" ON actuals FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'manager', 'user')
  )
);

CREATE POLICY "Admins and managers can manage actuals" ON actuals FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'manager')
  )
);

-- RLS Policies for financial_variances
CREATE POLICY "Users can view financial variances" ON financial_variances FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'manager', 'user')
  )
);

CREATE POLICY "System can manage financial variances" ON financial_variances FOR ALL USING (true);

-- RLS Policies for csv_import_logs
CREATE POLICY "Users can view their own import logs" ON csv_import_logs FOR SELECT USING (
  auth.uid() = imported_by OR 
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'manager')
  )
);

CREATE POLICY "Users can create import logs" ON csv_import_logs FOR INSERT WITH CHECK (auth.uid() = imported_by);
CREATE POLICY "System can update import logs" ON csv_import_logs FOR UPDATE USING (true);

-- Function to calculate financial variances
CREATE OR REPLACE FUNCTION calculate_financial_variances(
  p_organization_id UUID DEFAULT NULL,
  p_project_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  project_id TEXT,
  wbs_element TEXT,
  total_commitment DECIMAL(15,2),
  total_actual DECIMAL(15,2),
  variance DECIMAL(15,2),
  variance_percentage DECIMAL(5,2),
  status TEXT
) AS $
BEGIN
  -- Delete existing variances for the scope
  IF p_project_id IS NOT NULL THEN
    DELETE FROM financial_variances 
    WHERE financial_variances.project_id = p_project_id 
    AND (p_organization_id IS NULL OR organization_id = p_organization_id);
  ELSIF p_organization_id IS NOT NULL THEN
    DELETE FROM financial_variances WHERE organization_id = p_organization_id;
  ELSE
    DELETE FROM financial_variances;
  END IF;

  -- Calculate and insert new variances
  INSERT INTO financial_variances (project_id, wbs_element, total_commitment, total_actual, organization_id)
  SELECT 
    COALESCE(c.project, a.project_nr) as project_id,
    COALESCE(c.wbs_element, a.wbs) as wbs_element,
    COALESCE(SUM(c.total_amount), 0) as total_commitment,
    COALESCE(SUM(a.invoice_amount), 0) as total_actual,
    COALESCE(c.organization_id, a.organization_id) as organization_id
  FROM 
    (SELECT DISTINCT project, wbs_element, organization_id FROM commitments 
     WHERE (p_organization_id IS NULL OR organization_id = p_organization_id)
     AND (p_project_id IS NULL OR project = p_project_id)) projects
  FULL OUTER JOIN 
    commitments c ON c.project = projects.project AND c.wbs_element = projects.wbs_element
  FULL OUTER JOIN 
    actuals a ON a.project_nr = COALESCE(c.project, projects.project) AND a.wbs = COALESCE(c.wbs_element, projects.wbs_element)
  WHERE 
    (p_organization_id IS NULL OR COALESCE(c.organization_id, a.organization_id) = p_organization_id)
    AND (p_project_id IS NULL OR COALESCE(c.project, a.project_nr) = p_project_id)
  GROUP BY 
    COALESCE(c.project, a.project_nr),
    COALESCE(c.wbs_element, a.wbs),
    COALESCE(c.organization_id, a.organization_id);

  -- Return the calculated variances
  RETURN QUERY
  SELECT 
    fv.project_id,
    fv.wbs_element,
    fv.total_commitment,
    fv.total_actual,
    fv.variance,
    fv.variance_percentage,
    fv.status
  FROM financial_variances fv
  WHERE 
    (p_organization_id IS NULL OR fv.organization_id = p_organization_id)
    AND (p_project_id IS NULL OR fv.project_id = p_project_id)
  ORDER BY fv.project_id, fv.wbs_element;
END;
$ LANGUAGE plpgsql;

-- Function to upsert commitments
CREATE OR REPLACE FUNCTION upsert_commitment(
  p_po_number TEXT,
  p_po_date DATE,
  p_vendor TEXT,
  p_vendor_description TEXT,
  p_requester TEXT,
  p_project TEXT,
  p_project_description TEXT,
  p_wbs_element TEXT,
  p_wbs_description TEXT,
  p_cost_center TEXT,
  p_cost_center_description TEXT,
  p_po_net_amount DECIMAL(15,2),
  p_tax_amount DECIMAL(15,2),
  p_total_amount DECIMAL(15,2),
  p_po_status TEXT,
  p_delivery_date DATE,
  p_currency_code TEXT,
  p_custom_fields JSONB,
  p_source_file TEXT,
  p_organization_id UUID
)
RETURNS UUID AS $
DECLARE
  commitment_id UUID;
BEGIN
  INSERT INTO commitments (
    po_number, po_date, vendor, vendor_description, requester, project, 
    project_description, wbs_element, wbs_description, cost_center, 
    cost_center_description, po_net_amount, tax_amount, total_amount, 
    po_status, delivery_date, currency_code, custom_fields, source_file, organization_id
  ) VALUES (
    p_po_number, p_po_date, p_vendor, p_vendor_description, p_requester, p_project,
    p_project_description, p_wbs_element, p_wbs_description, p_cost_center,
    p_cost_center_description, p_po_net_amount, p_tax_amount, p_total_amount,
    p_po_status, p_delivery_date, p_currency_code, p_custom_fields, p_source_file, p_organization_id
  )
  ON CONFLICT (po_number, organization_id) 
  DO UPDATE SET
    po_date = EXCLUDED.po_date,
    vendor = EXCLUDED.vendor,
    vendor_description = EXCLUDED.vendor_description,
    requester = EXCLUDED.requester,
    project = EXCLUDED.project,
    project_description = EXCLUDED.project_description,
    wbs_element = EXCLUDED.wbs_element,
    wbs_description = EXCLUDED.wbs_description,
    cost_center = EXCLUDED.cost_center,
    cost_center_description = EXCLUDED.cost_center_description,
    po_net_amount = EXCLUDED.po_net_amount,
    tax_amount = EXCLUDED.tax_amount,
    total_amount = EXCLUDED.total_amount,
    po_status = EXCLUDED.po_status,
    delivery_date = EXCLUDED.delivery_date,
    currency_code = EXCLUDED.currency_code,
    custom_fields = EXCLUDED.custom_fields,
    source_file = EXCLUDED.source_file,
    updated_at = NOW()
  RETURNING id INTO commitment_id;
  
  RETURN commitment_id;
END;
$ LANGUAGE plpgsql;

-- Function to upsert actuals
CREATE OR REPLACE FUNCTION upsert_actual(
  p_fi_doc_no TEXT,
  p_posting_date DATE,
  p_document_type TEXT,
  p_vendor TEXT,
  p_vendor_invoice_no TEXT,
  p_project_nr TEXT,
  p_wbs TEXT,
  p_gl_account TEXT,
  p_cost_center TEXT,
  p_invoice_amount DECIMAL(15,2),
  p_currency_code TEXT,
  p_po_no TEXT,
  p_custom_fields JSONB,
  p_source_file TEXT,
  p_organization_id UUID
)
RETURNS UUID AS $
DECLARE
  actual_id UUID;
BEGIN
  INSERT INTO actuals (
    fi_doc_no, posting_date, document_type, vendor, vendor_invoice_no, 
    project_nr, wbs, gl_account, cost_center, invoice_amount, 
    currency_code, po_no, custom_fields, source_file, organization_id
  ) VALUES (
    p_fi_doc_no, p_posting_date, p_document_type, p_vendor, p_vendor_invoice_no,
    p_project_nr, p_wbs, p_gl_account, p_cost_center, p_invoice_amount,
    p_currency_code, p_po_no, p_custom_fields, p_source_file, p_organization_id
  )
  ON CONFLICT (fi_doc_no, organization_id) 
  DO UPDATE SET
    posting_date = EXCLUDED.posting_date,
    document_type = EXCLUDED.document_type,
    vendor = EXCLUDED.vendor,
    vendor_invoice_no = EXCLUDED.vendor_invoice_no,
    project_nr = EXCLUDED.project_nr,
    wbs = EXCLUDED.wbs,
    gl_account = EXCLUDED.gl_account,
    cost_center = EXCLUDED.cost_center,
    invoice_amount = EXCLUDED.invoice_amount,
    currency_code = EXCLUDED.currency_code,
    po_no = EXCLUDED.po_no,
    custom_fields = EXCLUDED.custom_fields,
    source_file = EXCLUDED.source_file,
    updated_at = NOW()
  RETURNING id INTO actual_id;
  
  RETURN actual_id;
END;
$ LANGUAGE plpgsql;

-- Function to get variance summary
CREATE OR REPLACE FUNCTION get_variance_summary(
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_projects BIGINT,
  over_budget_projects BIGINT,
  under_budget_projects BIGINT,
  on_budget_projects BIGINT,
  total_commitment DECIMAL(15,2),
  total_actual DECIMAL(15,2),
  total_variance DECIMAL(15,2),
  average_variance_percentage DECIMAL(5,2)
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_projects,
    COUNT(*) FILTER (WHERE status = 'over') as over_budget_projects,
    COUNT(*) FILTER (WHERE status = 'under') as under_budget_projects,
    COUNT(*) FILTER (WHERE status = 'on') as on_budget_projects,
    SUM(fv.total_commitment) as total_commitment,
    SUM(fv.total_actual) as total_actual,
    SUM(fv.variance) as total_variance,
    AVG(fv.variance_percentage) as average_variance_percentage
  FROM financial_variances fv
  WHERE p_organization_id IS NULL OR fv.organization_id = p_organization_id;
END;
$ LANGUAGE plpgsql;

-- Insert default organization if none exists
INSERT INTO organizations (name, code) 
SELECT 'Default Organization', 'DEFAULT'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE code = 'DEFAULT');

-- Comments for documentation
COMMENT ON TABLE organizations IS 'Organizations for multi-tenant support';
COMMENT ON TABLE commitments IS 'Purchase orders and planned expenditures imported from CSV';
COMMENT ON TABLE actuals IS 'Actual invoices and payments imported from CSV';
COMMENT ON TABLE financial_variances IS 'Calculated variances between commitments and actuals';
COMMENT ON TABLE csv_import_logs IS 'Audit trail for CSV import operations';

COMMENT ON COLUMN commitments.po_number IS 'Unique purchase order number within organization';
COMMENT ON COLUMN commitments.total_amount IS 'Total PO amount including tax';
COMMENT ON COLUMN actuals.fi_doc_no IS 'Financial document number (unique within organization)';
COMMENT ON COLUMN actuals.po_no IS 'Reference to related purchase order';
COMMENT ON COLUMN financial_variances.variance IS 'Calculated as actual - commitment';
COMMENT ON COLUMN financial_variances.status IS 'Budget status: under/on/over based on 5% threshold';