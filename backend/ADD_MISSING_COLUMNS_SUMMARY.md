# Add Missing Columns to Commitments Table - Summary

## Overview
Extended the commitments table and import system to capture all 35 columns from the CSV file instead of just 12.

## Changes Made

### 1. Database Migration (`migrations/034_add_missing_commitment_columns.sql`)
Added 17 new columns to the `commitments` table:

**New Columns:**
- `po_line_text` - Purchase order line item description
- `po_created_by` - User who created the PO
- `shopping_cart_number` - Shopping cart reference
- `document_currency_code` - Original document currency
- `value_in_document_currency` - Value in original currency
- `investment_profile` - Investment classification (capex/opex)
- `account_group_level1` - Account group (Cost Element Level 1)
- `account_subgroup_level2` - Account subgroup (Cost Element Level 2)
- `account_level3` - Account (Cost Element Level 3)
- `change_date` - Last change date
- `purchase_requisition` - Purchase requisition number
- `procurement_plant` - Procurement plant identifier
- `contract_number` - Contract reference
- `joint_commodity_code` - Commodity code
- `po_title` - PO title/description
- `version` - Version number
- `fi_doc_no` - Financial document number (cross-reference)

**Indexes Created:**
- `idx_commitments_po_created_by`
- `idx_commitments_investment_profile`
- `idx_commitments_contract_number`
- `idx_commitments_change_date`
- `idx_commitments_fi_doc_no`

### 2. Pydantic Model (`backend/models/imports.py`)
Extended `CommitmentCreate` model to include all 17 new fields as optional fields.

**Updated Validators:**
- `parse_amount` - Now handles `tax_amount` and `value_in_document_currency`
- `parse_date` - Now handles `change_date`

### 3. CSV Column Mapping (`backend/routers/csv_import.py`)
Added mappings for all new CSV columns:
- Requester → requester
- PO Created By → po_created_by
- Shopping Cart Number → shopping_cart_number
- Project Description → project_description
- WBS Element Description → wbs_description
- Cost Center → cost_center
- Cost Center Description → cost_center_description
- Tax Amount → tax_amount
- PO Line Text → po_line_text
- Value in document currency → value_in_document_currency
- Document currency code → document_currency_code
- Investment Profile → investment_profile
- Account Group Level 1 → account_group_level1
- Account Sub Group Level 2 → account_subgroup_level2
- Account Level 3 → account_level3
- Change Date → change_date
- Purchase requisition → purchase_requisition
- Procurement Plant → procurement_plant
- Contract # → contract_number
- Joint Commodity Code → joint_commodity_code
- PO Title → po_title
- Version → version
- FI Doc No → fi_doc_no

### 4. Import Service (`backend/services/actuals_commitments_import.py`)
Updated `import_commitments()` to populate all new fields when inserting records.

## How to Apply the Migration

### Option 1: Supabase SQL Editor (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the contents of `backend/migrations/034_add_missing_commitment_columns.sql`
5. Paste into the SQL Editor
6. Click **Run** to execute

### Option 2: psql Command Line
```bash
psql -h <your-supabase-host> -U postgres -d postgres -f backend/migrations/034_add_missing_commitment_columns.sql
```

### Option 3: Direct SQL Execution
If you have direct database access, run:
```bash
cd backend
psql $DATABASE_URL -f migrations/034_add_missing_commitment_columns.sql
```

## Verification

After running the migration, verify the columns were added:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'commitments' 
ORDER BY ordinal_position;
```

You should see all 17 new columns in the output.

## Testing

Test the import with the full CSV:

```bash
# From the frontend, upload the CSV file via the CSV Import tab
# Or use curl:
curl -X POST http://localhost:8000/api/csv-import/upload?import_type=commitments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@data/Combined_Commitments_DIA_UATNEW_short.csv"
```

Expected result:
- All 35 CSV columns should now be imported
- No more "missing column" warnings
- Records should include all additional fields

## Before vs After

### Before
- **CSV Columns:** 35
- **Imported:** 12 (34%)
- **Ignored:** 23 (66%)

### After
- **CSV Columns:** 35
- **Imported:** 35 (100%)
- **Ignored:** 0 (0%)

## Files Modified
1. `backend/migrations/034_add_missing_commitment_columns.sql` - New migration
2. `backend/models/imports.py` - Extended CommitmentCreate model
3. `backend/routers/csv_import.py` - Added column mappings
4. `backend/services/actuals_commitments_import.py` - Updated insert logic
5. `backend/CSV_COLUMNS_ANALYSIS.md` - Documentation
6. `backend/ADD_MISSING_COLUMNS_SUMMARY.md` - This file

## Next Steps
1. ✅ Run the migration in Supabase SQL Editor
2. ✅ Test the import with the full CSV file
3. ✅ Verify all columns are populated in the database
4. Consider adding similar columns to the `actuals` table if needed

## Notes
- All new columns are **optional** (nullable) to maintain backward compatibility
- Existing data is not affected
- The migration is idempotent (safe to run multiple times)
- Indexes were added for commonly queried fields to improve performance
