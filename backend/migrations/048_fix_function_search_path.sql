-- Migration: Set immutable search_path on functions (security: prevent search_path injection)
-- Affected: update_feature_toggles_updated_at, update_pmr_report_last_modified,
--           get_variance_summary, upsert_actual

-- ============================================================================
-- update_feature_toggles_updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_feature_toggles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = (NOW() AT TIME ZONE 'UTC');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- ============================================================================
-- update_pmr_report_last_modified
-- ============================================================================
CREATE OR REPLACE FUNCTION update_pmr_report_last_modified()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE pmr_reports
    SET last_modified = NOW()
    WHERE id = COALESCE(NEW.report_id, OLD.report_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- ============================================================================
-- get_variance_summary
-- ============================================================================
CREATE OR REPLACE FUNCTION get_variance_summary(p_organization_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_projects BIGINT,
  over_budget_projects BIGINT,
  under_budget_projects BIGINT,
  on_budget_projects BIGINT,
  total_commitment DECIMAL(15,2),
  total_actual DECIMAL(15,2),
  total_variance DECIMAL(15,2),
  average_variance_percentage DECIMAL(5,2)
) AS $$
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
$$ LANGUAGE plpgsql
SET search_path = public;

-- ============================================================================
-- upsert_actual
-- ============================================================================
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
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql
SET search_path = public;
