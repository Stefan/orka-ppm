# AI-Empowered Audit Trail Migration - Syntax Fix

## Issues Fixed

### Issue 1: Constraint Syntax Error

The initial migration file had a syntax error:

```
ERROR: 42601: syntax error at or near "NOT"
LINE 27: ADD CONSTRAINT IF NOT EXISTS valid_anomaly_score
```

**Root Cause**: PostgreSQL does not support `IF NOT EXISTS` clause in `ALTER TABLE ... ADD CONSTRAINT` statements.

**Solution**: Wrapped the constraint additions in PL/pgSQL `DO` blocks to check for existence before adding.

### Issue 2: Missing Base Table

The migration assumed `roche_audit_logs` table already existed, causing:

```
ERROR: 42P01: relation "roche_audit_logs" does not exist
```

**Root Cause**: The base `roche_audit_logs` table may not exist in all database instances.

**Solution**: Added creation of the base table with `CREATE TABLE IF NOT EXISTS` at the beginning of the migration.

## Solution

Wrapped the constraint additions in PL/pgSQL `DO` blocks to check for existence before adding:

```sql
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_anomaly_score'
    ) THEN
        ALTER TABLE roche_audit_logs 
            ADD CONSTRAINT valid_anomaly_score 
                CHECK (anomaly_score IS NULL OR (anomaly_score >= 0 AND anomaly_score <= 1));
    END IF;
END $$;
```

## Changes Made

### 1. Fixed Constraint Syntax

Fixed 3 constraint additions on `roche_audit_logs`:
1. `valid_anomaly_score` - Checks anomaly_score is between 0 and 1
2. `valid_risk_level` - Checks risk_level is in allowed values
3. `valid_category` - Checks category is in allowed values

### 2. Added Base Table Creation

Added creation of `roche_audit_logs` table with base columns:
- `id`, `event_type`, `user_id`, `entity_type`, `entity_id`
- `action_details`, `severity`, `ip_address`, `user_agent`
- `project_id`, `performance_metrics`, `timestamp`, `created_at`

Plus 6 base indexes for performance.

The migration now:
- Creates the base table if it doesn't exist
- Extends it with AI fields if it does exist
- Is completely idempotent and safe to run multiple times

## Verification

The migration file now:
- ✅ Uses proper PL/pgSQL DO blocks for conditional constraints
- ✅ Has balanced parentheses (156 open, 156 close)
- ✅ Has balanced dollar signs (properly quoted)
- ✅ Contains all 8 required tables
- ✅ Contains all 43 indexes
- ✅ Contains all constraints with proper syntax

## Testing

To verify the fix works:

```bash
# Check the SQL syntax
grep -n "DO \$\$" backend/migrations/023_ai_empowered_audit_trail.sql

# Should show 3 DO blocks for the constraints (lines 26, 37, 48)
```

## Migration Status

The migration file is now ready to be applied without syntax errors.

Execute via:
1. Supabase SQL Editor (recommended)
2. psql command line
3. Python migration script

## Notes

- The `DO $$` blocks are idempotent - safe to run multiple times
- Constraints will only be added if they don't already exist
- No data loss or corruption risk from re-running
- All other parts of the migration use `IF NOT EXISTS` which is supported for tables and indexes

## Related Files

- Migration SQL: `023_ai_empowered_audit_trail.sql`
- Migration Guide: `AI_AUDIT_TRAIL_MIGRATION_GUIDE.md`
- Quick Reference: `AI_AUDIT_TRAIL_QUICK_REFERENCE.md`
- Checklist: `AI_AUDIT_TRAIL_MIGRATION_CHECKLIST.md`
