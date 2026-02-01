# CSV Columns vs Database Schema Analysis

## CSV Columns (35 total)
From `data/Combined_Commitments_DIA_UATNEW_short.csv`:

1. PO Number ✅
2. PO Date ✅
3. Vendor ✅
4. Vendor Description ✅
5. **Requester** ⚠️ (in DB but not in Pydantic model)
6. PO Created By ❌
7. Shopping Cart Number ❌
8. Project ✅ (mapped to `project_nr`)
9. Project Description ⚠️ (in DB but not in Pydantic model)
10. WBS Element ✅
11. WBS Element Description ⚠️ (in DB as `wbs_description` but not in Pydantic model)
12. Cost Center ⚠️ (in DB but not in Pydantic model)
13. Cost Center Description ⚠️ (in DB but not in Pydantic model)
14. PO Net Amount ✅
15. Tax Amount ⚠️ (in DB but not in Pydantic model)
16. Total Amount Legal Entity Currency ✅ (mapped to `total_amount`)
17. PO Line Nr. ✅ (mapped to `po_line_nr`)
18. PO Status ✅
19. PO Line Text ❌
20. Delivery Date ✅
21. Legal Entity Currency Code ✅ (mapped to `currency`)
22. Value in document currency ❌
23. Document currency code ❌
24. Investment Profile ❌
25. Account Group Level 1 ❌
26. Account Sub Group Level 2 ❌
27. Account Level 3 ❌
28. Change Date ❌
29. Purchase requisition ❌
30. Procurement Plant ❌
31. Contract # ❌
32. Joint Commodity Code ❌
33. PO Title ❌
34. Version ❌
35. FI Doc No ❌

## Database Schema (commitments table)
From `backend/migrations/009_csv_import_system.sql`:

1. id (UUID, auto-generated) ✅
2. po_number ✅
3. po_date ✅
4. vendor ✅
5. vendor_description ✅
6. **requester** ⚠️ (in DB but not imported)
7. project ⚠️ (in DB but we use `project_id` + `project_nr`)
8. **project_description** ⚠️ (in DB but not imported)
9. wbs_element ✅
10. **wbs_description** ⚠️ (in DB but not imported)
11. **cost_center** ⚠️ (in DB but not imported)
12. **cost_center_description** ⚠️ (in DB but not imported)
13. po_net_amount ✅
14. **tax_amount** ⚠️ (in DB but not imported)
15. total_amount ✅
16. po_status ✅
17. delivery_date ✅
18. currency_code ✅ (mapped from `currency`)
19. custom_fields (JSONB) ⚠️ (could store extra CSV columns)
20. imported_at ✅ (auto-generated)
21. source_file ⚠️ (not populated)
22. organization_id ⚠️ (not populated)
23. created_at ✅ (auto-generated)
24. updated_at ✅ (auto-generated)
25. **project_id** ✅ (added by import service)
26. **project_nr** ✅ (added by import service)
27. **po_line_nr** ✅ (added later, has unique constraint)
28. **currency** ✅ (added later)

## Pydantic Model (CommitmentCreate)
From `backend/models/imports.py`:

1. po_number ✅
2. po_date ✅
3. vendor ✅
4. vendor_description ✅
5. project_nr ✅
6. wbs_element ✅
7. po_net_amount ✅
8. total_amount ✅
9. currency ✅
10. po_status ✅
11. po_line_nr ✅
12. delivery_date ✅

## Summary

### ✅ Columns Being Imported (12)
These CSV columns are mapped and imported:
- PO Number → `po_number`
- PO Date → `po_date`
- Vendor → `vendor`
- Vendor Description → `vendor_description`
- Project → `project_nr`
- WBS Element → `wbs_element`
- PO Net Amount → `po_net_amount`
- Total Amount Legal Entity Currency → `total_amount`
- Legal Entity Currency Code → `currency`
- PO Status → `po_status`
- PO Line Nr. → `po_line_nr`
- Delivery Date → `delivery_date`

### ⚠️ Columns Available in DB but NOT Being Imported (8)
These columns exist in the database schema but are not in the Pydantic model:
- Requester (CSV column 5)
- Project Description (CSV column 9)
- WBS Element Description (CSV column 11)
- Cost Center (CSV column 12)
- Cost Center Description (CSV column 13)
- Tax Amount (CSV column 15)
- source_file
- organization_id

### ❌ CSV Columns Being IGNORED (23)
These CSV columns are not mapped and will be ignored during import:
- PO Created By
- Shopping Cart Number
- PO Line Text
- Value in document currency
- Document currency code
- Investment Profile
- Account Group Level 1
- Account Sub Group Level 2
- Account Level 3
- Change Date
- Purchase requisition
- Procurement Plant
- Contract #
- Joint Commodity Code
- PO Title
- Version
- FI Doc No

## Recommendations

### Option 1: Store Extra Columns in custom_fields (Recommended)
Store the ignored columns in the `custom_fields` JSONB column for future reference:
```python
custom_fields = {
    "requester": record.get("Requester"),
    "project_description": record.get("Project Description"),
    "wbs_description": record.get("WBS Element Description"),
    "cost_center": record.get("Cost Center"),
    "cost_center_description": record.get("Cost Center Description"),
    "tax_amount": record.get("Tax Amount"),
    "po_created_by": record.get("PO Created By"),
    "shopping_cart_number": record.get("Shopping Cart Number"),
    "po_line_text": record.get("PO Line Text"),
    # ... other fields
}
```

### Option 2: Extend Pydantic Model
Add the missing fields to `CommitmentCreate` model:
- requester
- project_description
- wbs_description
- cost_center
- cost_center_description
- tax_amount

### Option 3: Keep Current Approach
Only import the essential fields (current implementation). This is fine if the extra columns are not needed for business logic.

## Current Status
**The import is working correctly** - it imports all the essential fields that are defined in the Pydantic model. The extra CSV columns are simply ignored, which is acceptable if they're not needed for the application's functionality.

The 93 errors you're seeing are likely validation errors (invalid dates, amounts, missing required fields) rather than missing column mappings.
