-- Migration: Add missing columns to actuals table
-- Description: Adds columns from CSV that were not previously captured
-- Date: 2025-01-24

-- Add missing columns to actuals table
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS document_type_desc TEXT;
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS po_no VARCHAR(50);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS po_line_no INTEGER;
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS vendor_invoice_no VARCHAR(100);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS project_description TEXT;
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS wbs_description TEXT;
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS gl_account VARCHAR(50);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS gl_account_desc TEXT;
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS cost_center VARCHAR(50);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS cost_center_desc TEXT;
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS product_desc TEXT;
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS document_header_text TEXT;
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS net_due_date DATE;
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS creation_date DATE;
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS sap_invoice_no VARCHAR(100);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS investment_profile VARCHAR(50);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS account_group_level1 VARCHAR(100);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS account_subgroup_level2 VARCHAR(100);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS account_level3 VARCHAR(100);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS value_in_document_currency DECIMAL(15, 2);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS document_currency_code VARCHAR(3);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS quantity DECIMAL(15, 3);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS personnel_number VARCHAR(50);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS po_final_invoice_indicator VARCHAR(10);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS value_type VARCHAR(50);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS miro_invoice_no VARCHAR(100);
ALTER TABLE actuals ADD COLUMN IF NOT EXISTS goods_received_value DECIMAL(15, 2);

-- Create indexes for commonly queried columns
CREATE INDEX IF NOT EXISTS idx_actuals_po_no ON actuals(po_no);
CREATE INDEX IF NOT EXISTS idx_actuals_gl_account ON actuals(gl_account);
CREATE INDEX IF NOT EXISTS idx_actuals_cost_center ON actuals(cost_center);
CREATE INDEX IF NOT EXISTS idx_actuals_investment_profile ON actuals(investment_profile);
CREATE INDEX IF NOT EXISTS idx_actuals_personnel_number ON actuals(personnel_number);
CREATE INDEX IF NOT EXISTS idx_actuals_creation_date ON actuals(creation_date);

-- Add comments
COMMENT ON COLUMN actuals.document_type_desc IS 'Document type description';
COMMENT ON COLUMN actuals.po_no IS 'Purchase order number reference';
COMMENT ON COLUMN actuals.po_line_no IS 'Purchase order line number';
COMMENT ON COLUMN actuals.vendor_invoice_no IS 'Vendor invoice number';
COMMENT ON COLUMN actuals.project_description IS 'Project description';
COMMENT ON COLUMN actuals.wbs_description IS 'WBS element description';
COMMENT ON COLUMN actuals.gl_account IS 'General ledger account';
COMMENT ON COLUMN actuals.gl_account_desc IS 'GL account description';
COMMENT ON COLUMN actuals.cost_center IS 'Cost center code';
COMMENT ON COLUMN actuals.cost_center_desc IS 'Cost center description';
COMMENT ON COLUMN actuals.product_desc IS 'Product description';
COMMENT ON COLUMN actuals.document_header_text IS 'Document header text';
COMMENT ON COLUMN actuals.payment_terms IS 'Payment terms';
COMMENT ON COLUMN actuals.net_due_date IS 'Net due date for payment';
COMMENT ON COLUMN actuals.creation_date IS 'Date when record was created in source system';
COMMENT ON COLUMN actuals.sap_invoice_no IS 'SAP invoice number';
COMMENT ON COLUMN actuals.investment_profile IS 'Investment profile classification';
COMMENT ON COLUMN actuals.account_group_level1 IS 'Account group at Orka Level 1';
  COMMENT ON COLUMN actuals.account_subgroup_level2 IS 'Account subgroup at Orka Level 2';
  COMMENT ON COLUMN actuals.account_level3 IS 'Account at Orka Level 3';
COMMENT ON COLUMN actuals.value_in_document_currency IS 'Value in original document currency';
COMMENT ON COLUMN actuals.document_currency_code IS 'Document currency code';
COMMENT ON COLUMN actuals.quantity IS 'Quantity';
COMMENT ON COLUMN actuals.personnel_number IS 'Personnel number';
COMMENT ON COLUMN actuals.po_final_invoice_indicator IS 'PO final invoice indicator';
COMMENT ON COLUMN actuals.value_type IS 'Value type classification';
COMMENT ON COLUMN actuals.miro_invoice_no IS 'MIRO invoice number';
COMMENT ON COLUMN actuals.goods_received_value IS 'Goods received value';
