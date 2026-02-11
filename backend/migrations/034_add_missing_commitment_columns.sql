-- Migration: Add missing columns to commitments table
-- Description: Adds columns from CSV that were not previously captured
-- Date: 2025-01-24

-- Add missing columns to commitments table
DO $$ 
BEGIN
    -- Add po_line_text column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'po_line_text') THEN
        ALTER TABLE commitments ADD COLUMN po_line_text TEXT;
    END IF;
    
    -- Add po_created_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'po_created_by') THEN
        ALTER TABLE commitments ADD COLUMN po_created_by VARCHAR(255);
    END IF;
    
    -- Add shopping_cart_number column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_cart_number' AND column_name = 'shopping_cart_number') THEN
        ALTER TABLE commitments ADD COLUMN shopping_cart_number VARCHAR(100);
    END IF;
    
    -- Add document_currency_code column (separate from legal entity currency)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'document_currency_code') THEN
        ALTER TABLE commitments ADD COLUMN document_currency_code VARCHAR(3);
    END IF;
    
    -- Add value_in_document_currency column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'value_in_document_currency') THEN
        ALTER TABLE commitments ADD COLUMN value_in_document_currency DECIMAL(15, 2);
    END IF;
    
    -- Add investment_profile column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'investment_profile') THEN
        ALTER TABLE commitments ADD COLUMN investment_profile VARCHAR(50);
    END IF;
    
    -- Add account_group_level1 column (Orka Level 1)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'account_group_level1') THEN
        ALTER TABLE commitments ADD COLUMN account_group_level1 VARCHAR(100);
    END IF;
    
    -- Add account_subgroup_level2 column (Orka Level 2)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'account_subgroup_level2') THEN
        ALTER TABLE commitments ADD COLUMN account_subgroup_level2 VARCHAR(100);
    END IF;
    
    -- Add account_level3 column (Orka Level 3)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'account_level3') THEN
        ALTER TABLE commitments ADD COLUMN account_level3 VARCHAR(100);
    END IF;
    
    -- Add change_date column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'change_date') THEN
        ALTER TABLE commitments ADD COLUMN change_date DATE;
    END IF;
    
    -- Add purchase_requisition column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'purchase_requisition') THEN
        ALTER TABLE commitments ADD COLUMN purchase_requisition VARCHAR(100);
    END IF;
    
    -- Add procurement_plant column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'procurement_plant') THEN
        ALTER TABLE commitments ADD COLUMN procurement_plant VARCHAR(100);
    END IF;
    
    -- Add contract_number column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'contract_number') THEN
        ALTER TABLE commitments ADD COLUMN contract_number VARCHAR(100);
    END IF;
    
    -- Add joint_commodity_code column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'joint_commodity_code') THEN
        ALTER TABLE commitments ADD COLUMN joint_commodity_code VARCHAR(100);
    END IF;
    
    -- Add po_title column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'po_title') THEN
        ALTER TABLE commitments ADD COLUMN po_title TEXT;
    END IF;
    
    -- Add version column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'version') THEN
        ALTER TABLE commitments ADD COLUMN version VARCHAR(50);
    END IF;
    
    -- Add fi_doc_no column (for cross-reference with actuals)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commitments' AND column_name = 'fi_doc_no') THEN
        ALTER TABLE commitments ADD COLUMN fi_doc_no VARCHAR(50);
    END IF;
END $$;

-- Create indexes for commonly queried columns
CREATE INDEX IF NOT EXISTS idx_commitments_po_created_by ON commitments(po_created_by);
CREATE INDEX IF NOT EXISTS idx_commitments_investment_profile ON commitments(investment_profile);
CREATE INDEX IF NOT EXISTS idx_commitments_contract_number ON commitments(contract_number);
CREATE INDEX IF NOT EXISTS idx_commitments_change_date ON commitments(change_date);
CREATE INDEX IF NOT EXISTS idx_commitments_fi_doc_no ON commitments(fi_doc_no);

-- Add comment to document the new columns
COMMENT ON COLUMN commitments.po_line_text IS 'Purchase order line item description text';
COMMENT ON COLUMN commitments.po_created_by IS 'User who created the purchase order';
COMMENT ON COLUMN commitments.shopping_cart_number IS 'Shopping cart reference number';
COMMENT ON COLUMN commitments.document_currency_code IS 'Currency code in the original document';
COMMENT ON COLUMN commitments.value_in_document_currency IS 'Value in the original document currency';
COMMENT ON COLUMN commitments.investment_profile IS 'Investment profile classification (capex/opex)';
COMMENT ON COLUMN commitments.account_group_level1 IS 'Account group at Orka Level 1';
  COMMENT ON COLUMN commitments.account_subgroup_level2 IS 'Account subgroup at Orka Level 2';
  COMMENT ON COLUMN commitments.account_level3 IS 'Account at Orka Level 3';
COMMENT ON COLUMN commitments.change_date IS 'Date when the commitment was last changed';
COMMENT ON COLUMN commitments.purchase_requisition IS 'Purchase requisition number';
COMMENT ON COLUMN commitments.procurement_plant IS 'Procurement plant identifier';
COMMENT ON COLUMN commitments.contract_number IS 'Contract reference number';
COMMENT ON COLUMN commitments.joint_commodity_code IS 'Joint commodity code classification';
COMMENT ON COLUMN commitments.po_title IS 'Purchase order title/description';
COMMENT ON COLUMN commitments.version IS 'Version number of the purchase order';
COMMENT ON COLUMN commitments.fi_doc_no IS 'Financial document number for cross-reference with actuals';
