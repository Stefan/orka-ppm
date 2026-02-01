# Change Management Database Migration Guide

## Quick Fix for "Already Exists" Errors

**If you're seeing errors like:**
- `policy "Users can view shareable URLs..." already exists`
- `trigger "update_shareable_urls_updated_at" already exists`
- `function already exists`

**This means migration 011 was partially applied before.**

### Solution (3 simple steps):

1. **Run the cleanup script:**
   - Open Supabase Dashboard → SQL Editor
   - Copy and execute: `backend/migrations/fix_011_policies.sql`
   - This drops all existing policies, triggers, and functions safely
   - You'll see: `✅ Cleanup complete!`

2. **Run migration 011 (fresh start):**
   - Copy and execute: `backend/migrations/011_generic_construction_ppm_features.sql`
   - This recreates everything cleanly

3. **Run migration 012:**
   - Copy and execute: `backend/migrations/012_integrated_change_management.sql`
   - This adds change management specific tables

**That's it!** The cleanup script handles all the "already exists" issues.

---

## Overview

This guide explains how to apply the database migrations required for the Change Management property-based tests to run successfully.

## Required Database Tables

The property tests for Change Management (Task 6.3) require the following database tables:

1. **change_requests** - Core change request data
2. **change_approvals** - Approval workflow steps and decisions
3. **change_audit_log** - Complete audit trail of all change activities
4. **workflow_instances** - Workflow execution tracking
5. **po_breakdowns** - Purchase order breakdown structures (for PO linking tests)
6. **change_request_po_links** - Links between changes and POs

## Migration Files

The required migrations are located in:

- `backend/migrations/011_generic_construction_ppm_features.sql` - Creates base tables
- `backend/migrations/012_integrated_change_management.sql` - Creates change management specific tables

## Migration Steps

### Option 1: Manual Execution in Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Navigate to your Supabase project dashboard
   - Go to: **SQL Editor** → **New Query**

2. **Execute Migration 011**
   - Copy the entire contents of `backend/migrations/011_generic_construction_ppm_features.sql`
   - Paste into the SQL Editor
   - Click **Run** to execute
   - Verify no errors in the output

3. **Execute Migration 012**
   - Copy the entire contents of `backend/migrations/012_integrated_change_management.sql`
   - Paste into the SQL Editor
   - Click **Run** to execute
   - Verify no errors in the output

4. **Verify Migration**
   ```bash
   cd backend
   python scripts/apply_change_management_migrations.py --verify
   ```

### Option 2: Using Migration Script (Requires Service Role Key)

If you have the `SUPABASE_SERVICE_ROLE_KEY` available:

1. **Set Environment Variables**
   ```bash
   export SUPABASE_URL="your-supabase-url"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

2. **Run Migration Script**
   ```bash
   cd backend
   python scripts/apply_change_management_migrations.py
   ```

3. **Follow On-Screen Instructions**
   - The script will guide you through the migration process
   - Use `--verify` flag to check if migrations were successful

## Verification

After applying migrations, verify the tables exist:

```bash
cd backend
python scripts/apply_change_management_migrations.py --verify
```

Expected output:
```
✅ change_requests: EXISTS
✅ change_approvals: EXISTS
✅ change_audit_log: EXISTS
✅ workflow_instances: EXISTS
```

## Running Property Tests

Once migrations are applied, run the property tests:

```bash
cd backend
pytest tests/test_change_management_workflow_integration_property.py -v
```

## Troubleshooting

### Policy Already Exists Error

If you see "policy already exists" errors (like the one you encountered):

**Solution:**
1. First, run the policy cleanup script:
   ```sql
   -- In Supabase SQL Editor, execute:
   -- Copy contents of: backend/migrations/fix_011_policies.sql
   ```
2. Then continue with migration 011 from the RLS policies section

**What happened:** Migration 011 was partially applied before. The tables were created but the script failed when trying to create policies that already exist.

### Tables Already Exist Error

If you see "table already exists" errors:
- This is normal if migrations were partially applied
- The migrations use `CREATE TABLE IF NOT EXISTS` to handle this
- Continue with the migration

### Permission Denied Errors

If you see permission errors:
- Ensure you're using the **Service Role Key**, not the Anon Key
- The Service Role Key has admin privileges needed for DDL operations
- Check that the key is correctly set in your environment

### Missing Tables After Migration

If verification shows missing tables (like `change_approvals` or `change_audit_log`):

**Cause:** Migration 012 wasn't fully executed or failed partway through.

**Solution:**
1. Run the verification query to see what's missing:
   ```sql
   -- In Supabase SQL Editor:
   -- Copy and execute: backend/migrations/verify_change_management_tables.sql
   ```

2. Re-run migration 012 completely:
   ```sql
   -- Copy and execute:
   backend/migrations/012_integrated_change_management.sql
   ```

3. Check for errors in the Supabase SQL Editor output
   - Look for any red error messages
   - Common issues: foreign key constraints, missing parent tables

4. If you see "table already exists" errors:
   - Migration 012 has some tables but not all
   - The script uses `CREATE TABLE IF NOT EXISTS` so it's safe to re-run
   - Focus on the error messages to see which specific statement failed

## Test Status

**Current Status**: ❌ Failed - Database tables not created

**Required Action**: Apply migrations 011 and 012 using Supabase SQL Editor

**After Migration**: Re-run property tests to verify functionality

## Related Files

- Test File: `backend/tests/test_change_management_workflow_integration_property.py`
- Service: `backend/services/change_request_manager.py`
- Service: `backend/services/approval_workflow_engine.py`
- Models: `backend/models/change_management.py`
- Migration Script: `backend/scripts/apply_change_management_migrations.py`

## Next Steps

1. ✅ Apply database migrations (this guide)
2. ⏳ Run property tests to verify functionality
3. ⏳ Update PBT status based on test results
4. ⏳ Continue with remaining tasks in the implementation plan
