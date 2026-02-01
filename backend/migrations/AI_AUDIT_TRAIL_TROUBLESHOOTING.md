# AI-Empowered Audit Trail Migration Troubleshooting

## Common Errors and Solutions

### Error 1: "syntax error at or near 'NOT'"
```
ERROR: 42601: syntax error at or near "NOT"
LINE 27: ADD CONSTRAINT IF NOT EXISTS valid_anomaly_score
```

**Cause**: PostgreSQL doesn't support `IF NOT EXISTS` in `ADD CONSTRAINT`.

**Solution**: ✅ Fixed in current version using DO blocks.

---

### Error 2: "relation 'audit_logs' does not exist"
```
ERROR: 42P01: relation "audit_logs" does not exist
```

**Cause**: Base table not created yet.

**Solution**: ✅ Fixed in current version - creates base table first.

---

### Error 3: "syntax error at end of input"
```
ERROR: 42601: syntax error at end of input
LINE 0: ^
```

**Possible Causes**:
1. SQL client truncating the file
2. Unclosed statement or block
3. Special characters in file
4. File encoding issues

**Solutions**:

#### Solution A: Use the Test Migration First
Try the simplified test migration to verify your setup:
```bash
# Execute the test migration first
psql $DATABASE_URL -f backend/migrations/023_ai_empowered_audit_trail_test.sql
```

If this works, the full migration should work too.

#### Solution B: Execute in Sections
Break the migration into sections and execute separately:

**Section 1: Base Table**
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    action_details JSONB NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    ip_address VARCHAR(45),
    user_agent TEXT,
    project_id UUID,
    performance_metrics JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Section 2: Add AI Columns**
```sql
ALTER TABLE audit_logs 
    ADD COLUMN IF NOT EXISTS anomaly_score DECIMAL(3,2),
    ADD COLUMN IF NOT EXISTS is_anomaly BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS category VARCHAR(50),
    ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20),
    ADD COLUMN IF NOT EXISTS tags JSONB,
    ADD COLUMN IF NOT EXISTS ai_insights JSONB,
    ADD COLUMN IF NOT EXISTS tenant_id UUID,
    ADD COLUMN IF NOT EXISTS hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64);
```

**Section 3: Add Constraints**
```sql
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'valid_anomaly_score'
    ) THEN
        ALTER TABLE audit_logs 
            ADD CONSTRAINT valid_anomaly_score 
                CHECK (anomaly_score IS NULL OR (anomaly_score >= 0 AND anomaly_score <= 1));
    END IF;
END $$;
```

Continue with remaining sections...

#### Solution C: Check File Encoding
```bash
# Check file encoding
file backend/migrations/023_ai_empowered_audit_trail.sql

# Should show: ASCII text

# If not, convert to UTF-8
iconv -f ISO-8859-1 -t UTF-8 023_ai_empowered_audit_trail.sql > 023_fixed.sql
```

#### Solution D: Remove Comments
Some SQL clients have issues with comments. Try removing all comments:
```bash
grep -v '^--' 023_ai_empowered_audit_trail.sql > 023_no_comments.sql
```

#### Solution E: Use Supabase SQL Editor
The most reliable method:
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the entire migration
4. Execute

This avoids any CLI or file encoding issues.

---

### Error 4: "column already exists"
```
ERROR: 42701: column "anomaly_score" of relation "audit_logs" already exists
```

**Cause**: Migration was partially applied.

**Solution**: The migration uses `ADD COLUMN IF NOT EXISTS`, so this shouldn't happen. If it does:
```sql
-- Check which columns exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'audit_logs';

-- The migration will skip existing columns automatically
```

---

### Error 5: "constraint already exists"
```
ERROR: 42710: constraint "valid_anomaly_score" for relation "audit_logs" already exists
```

**Cause**: Constraint was already added.

**Solution**: The DO blocks check for existence, so this shouldn't happen. If it does, the migration is idempotent and safe to re-run.

---

### Error 6: "extension 'vector' does not exist"
```
ERROR: 58P01: extension "vector" does not exist
```

**Cause**: pgvector extension not installed.

**Solution**:
```sql
-- Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- If that fails, you need to install pgvector on your PostgreSQL server
-- For Supabase: It should be pre-installed
-- For self-hosted: https://github.com/pgvector/pgvector
```

---

### Error 7: "permission denied"
```
ERROR: 42501: permission denied for schema public
```

**Cause**: Insufficient database permissions.

**Solution**: Use service role key or database admin credentials.

---

## Verification Steps

After successful migration, verify:

### 1. Check Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'audit_%'
ORDER BY table_name;

-- Should return:
-- audit_access_log
-- audit_ai_predictions
-- audit_anomalies
-- audit_bias_metrics
-- audit_embeddings
-- audit_integrations
-- audit_ml_models
-- audit_scheduled_reports
```

### 2. Check Columns Added
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'audit_logs' 
AND column_name IN (
    'anomaly_score', 'is_anomaly', 'category', 
    'risk_level', 'tags', 'ai_insights', 
    'tenant_id', 'hash', 'previous_hash'
)
ORDER BY column_name;

-- Should return 9 rows
```

### 3. Check Indexes Created
```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND (
    indexname LIKE 'idx_audit%' OR 
    indexname LIKE 'idx_anomalies%' OR
    indexname LIKE 'idx_ml_models%' OR
    indexname LIKE 'idx_integrations%' OR
    indexname LIKE 'idx_scheduled_reports%' OR
    indexname LIKE 'idx_bias_metrics%' OR
    indexname LIKE 'idx_ai_predictions%'
)
ORDER BY tablename, indexname;

-- Should return 49 indexes
```

### 4. Check Constraints
```sql
SELECT conname, conrelid::regclass AS table_name 
FROM pg_constraint 
WHERE conname LIKE 'valid_%'
ORDER BY table_name, conname;

-- Should return 8 constraints
```

### 5. Test Insert
```sql
-- Test basic insert
INSERT INTO audit_logs (
    event_type, entity_type, action_details, tenant_id
) VALUES (
    'test_event', 'test_entity', '{}'::jsonb, gen_random_uuid()
) RETURNING id;

-- Test with AI fields
INSERT INTO audit_logs (
    event_type, entity_type, action_details,
    anomaly_score, is_anomaly, category, risk_level,
    tags, tenant_id
) VALUES (
    'test_ai_event', 'test_entity', '{}'::jsonb,
    0.85, true, 'Security Change', 'High',
    '{"test": true}'::jsonb, gen_random_uuid()
) RETURNING id;

-- Clean up test data
DELETE FROM audit_logs WHERE event_type LIKE 'test%';
```

## Getting Help

If you continue to experience issues:

1. **Check PostgreSQL Version**
   ```sql
   SELECT version();
   -- Requires PostgreSQL 12+ for pgvector
   ```

2. **Check pgvector Version**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

3. **Enable Detailed Error Logging**
   ```sql
   SET client_min_messages TO DEBUG;
   -- Then re-run migration
   ```

4. **Check PostgreSQL Logs**
   - Supabase: Check logs in dashboard
   - Self-hosted: Check PostgreSQL log files

5. **Use Test Migration**
   - Try `023_ai_empowered_audit_trail_test.sql` first
   - This is a minimal version that tests core functionality

## Alternative: Manual Table Creation

If automated migration continues to fail, you can create tables manually:

1. Create base table (Section 0)
2. Add AI columns (Section 1)
3. Add constraints (Section 1)
4. Create audit_embeddings (Section 2)
5. Create audit_anomalies (Section 3)
6. Create audit_ml_models (Section 4)
7. Create audit_integrations (Section 5)
8. Create audit_scheduled_reports (Section 6)
9. Create audit_access_log (Section 7)
10. Create audit_bias_metrics (Section 8)
11. Create audit_ai_predictions (Section 9)

Each section is independent and can be executed separately.

## Contact

For additional support:
- Review design document: `.kiro/specs/ai-empowered-audit-trail/design.md`
- Review requirements: `.kiro/specs/ai-empowered-audit-trail/requirements.md`
- Check migration guide: `AI_AUDIT_TRAIL_MIGRATION_GUIDE.md`
