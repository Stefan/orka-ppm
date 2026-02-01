# AI-Empowered Audit Trail Migration Guide

## Overview

This migration adds comprehensive AI-powered audit trail capabilities to the PPM platform, including:

- **Anomaly Detection**: ML-based detection of unusual patterns in audit logs
- **Semantic Search**: RAG-powered natural language search over audit events
- **Auto-Tagging**: ML classification of events by category and risk level
- **External Integrations**: Webhook notifications to Slack, Teams, and Zapier
- **Scheduled Reports**: Automated PDF/CSV report generation
- **Compliance Features**: Hash chain integrity, encryption, and meta-audit logging
- **AI Fairness**: Bias detection and prediction logging for transparency

## Migration Files

- `023_ai_empowered_audit_trail.sql` - Main migration SQL file
- `apply_ai_audit_trail_migration.py` - Python script to apply migration
- `verify_ai_audit_trail_migration.py` - Python script to verify migration

## Prerequisites

1. **pgvector Extension**: Must be enabled (should already be enabled from `ai_features_schema.sql`)
2. **Existing Tables**: `audit_logs` table must exist
3. **Database Access**: Service role key with schema modification permissions

## Tables Created

### 1. audit_embeddings
Vector embeddings for semantic search over audit logs using OpenAI ada-002.

**Key Features:**
- 1536-dimension vector embeddings
- IVFFlat index for efficient cosine similarity search
- Tenant isolation for multi-tenant architecture

### 2. audit_anomalies
Tracks detected anomalies with ML model metadata and user feedback.

**Key Features:**
- Anomaly scores from Isolation Forest model
- User feedback for false positive marking
- Alert tracking and notification status

### 3. audit_ml_models
Version tracking for ML models used in audit analysis.

**Key Features:**
- Supports anomaly detector, category classifier, and risk classifier
- Training metrics and hyperparameters
- Tenant-specific and shared baseline models

### 4. audit_integrations
External tool integration configurations for alert notifications.

**Key Features:**
- Supports Slack, Teams, Zapier, and email
- Encrypted configuration storage
- Failure tracking and retry logic

### 5. audit_scheduled_reports
Automated report generation with cron scheduling.

**Key Features:**
- Cron expression scheduling
- PDF and CSV format support
- Filter-based report generation
- Execution tracking and error logging

### 6. audit_access_log
Meta-audit logging for compliance (audit-of-audit).

**Key Features:**
- Tracks all access to audit logs
- Query parameter logging
- Performance metrics

### 7. audit_bias_metrics
AI fairness tracking for bias detection.

**Key Features:**
- Detection rate tracking by demographic dimensions
- Bias threshold monitoring
- Sample size and confidence tracking

### 8. audit_ai_predictions
Logging of all AI model predictions for transparency.

**Key Features:**
- Prediction type, value, and confidence score
- Review flagging for low-confidence predictions
- Human review outcome tracking

## Schema Changes to Existing Tables

### audit_logs (Extended)

New columns added:
- `anomaly_score` - ML-computed anomaly score (0-1)
- `is_anomaly` - Boolean flag for anomaly classification
- `category` - ML-assigned category (Security Change, Financial Impact, etc.)
- `risk_level` - ML-assigned risk level (Low, Medium, High, Critical)
- `tags` - JSONB field for AI-generated tags
- `ai_insights` - JSONB field for AI-generated insights
- `tenant_id` - Tenant identifier for multi-tenant isolation
- `hash` - SHA-256 hash for tamper detection
- `previous_hash` - Hash chain linking for integrity verification

## Indexes Created

### Performance Indexes
- Vector similarity search (IVFFlat)
- Tenant isolation indexes
- Timestamp-based indexes for time-range queries
- Composite indexes for common query patterns

### Specialized Indexes
- GIN index on JSONB tags field
- Partial indexes for active records
- Partial indexes for anomaly filtering

## Constraints Added

### Data Validation
- Anomaly score range (0-1)
- Risk level enumeration
- Category enumeration
- Integration type enumeration
- Report format enumeration

### Referential Integrity
- Foreign keys to audit_logs
- Foreign keys to auth.users
- Cascade delete for dependent records

## Migration Steps

### Option 1: Via Supabase SQL Editor (Recommended)

1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Copy contents of `023_ai_empowered_audit_trail.sql`
4. Execute the SQL
5. Verify success in Table Editor

### Option 2: Via Python Script

```bash
# From backend directory
cd backend/migrations

# Apply migration
python apply_ai_audit_trail_migration.py

# Verify migration
python verify_ai_audit_trail_migration.py
```

### Option 3: Via psql

```bash
# Connect to database
psql $DATABASE_URL

# Execute migration
\i backend/migrations/023_ai_empowered_audit_trail.sql

# Verify tables
\dt audit_*
```

## Verification Checklist

After applying the migration, verify:

- [ ] All 8 new tables exist
- [ ] audit_logs has 9 new columns
- [ ] pgvector extension is enabled
- [ ] Vector indexes are created
- [ ] All constraints are in place
- [ ] Sample insert operations work
- [ ] Tenant isolation is enforced

### Verification SQL Queries

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'audit_%';

-- Check audit_logs columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'audit_logs' 
AND column_name IN (
    'anomaly_score', 'is_anomaly', 'category', 
    'risk_level', 'tags', 'ai_insights', 
    'tenant_id', 'hash', 'previous_hash'
);

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND (
    indexname LIKE 'idx_audit%' OR 
    indexname LIKE 'idx_anomalies%' OR
    indexname LIKE 'idx_ml_models%'
);

-- Check constraints
SELECT conname, conrelid::regclass AS table_name 
FROM pg_constraint 
WHERE conname LIKE 'valid_%';

-- Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';
```

## Testing the Migration

### 1. Test Audit Event with AI Fields

```sql
INSERT INTO audit_logs (
    event_type, entity_type, action_details, 
    anomaly_score, is_anomaly, category, risk_level,
    tags, tenant_id
) VALUES (
    'test_event', 'test_entity', '{"test": true}'::jsonb,
    0.85, true, 'Security Change', 'High',
    '{"test_tag": "value"}'::jsonb, gen_random_uuid()
);
```

### 2. Test Embedding Creation

```sql
INSERT INTO audit_embeddings (
    audit_event_id, embedding, content_text, tenant_id
) VALUES (
    (SELECT id FROM audit_logs LIMIT 1),
    array_fill(0.1, ARRAY[1536])::vector,
    'Test embedding content',
    gen_random_uuid()
);
```

### 3. Test Anomaly Detection

```sql
INSERT INTO audit_anomalies (
    audit_event_id, anomaly_score, features_used,
    model_version, tenant_id
) VALUES (
    (SELECT id FROM audit_logs LIMIT 1),
    0.92,
    '{"feature1": 0.5, "feature2": 0.8}'::jsonb,
    'v1.0.0',
    gen_random_uuid()
);
```

## Rollback Procedure

If you need to rollback the migration:

```sql
-- Drop new tables (in reverse order of dependencies)
DROP TABLE IF EXISTS audit_ai_predictions CASCADE;
DROP TABLE IF EXISTS audit_bias_metrics CASCADE;
DROP TABLE IF EXISTS audit_access_log CASCADE;
DROP TABLE IF EXISTS audit_scheduled_reports CASCADE;
DROP TABLE IF EXISTS audit_integrations CASCADE;
DROP TABLE IF EXISTS audit_ml_models CASCADE;
DROP TABLE IF EXISTS audit_anomalies CASCADE;
DROP TABLE IF EXISTS audit_embeddings CASCADE;

-- Remove columns from audit_logs
ALTER TABLE audit_logs 
    DROP COLUMN IF EXISTS anomaly_score,
    DROP COLUMN IF EXISTS is_anomaly,
    DROP COLUMN IF EXISTS category,
    DROP COLUMN IF EXISTS risk_level,
    DROP COLUMN IF EXISTS tags,
    DROP COLUMN IF EXISTS ai_insights,
    DROP COLUMN IF EXISTS tenant_id,
    DROP COLUMN IF EXISTS hash,
    DROP COLUMN IF EXISTS previous_hash;
```

## Performance Considerations

### Index Maintenance
- Vector indexes may need periodic VACUUM and ANALYZE
- Monitor index usage with pg_stat_user_indexes
- Consider partitioning for large audit volumes

### Query Optimization
- Use tenant_id filters in all queries
- Leverage composite indexes for common patterns
- Use EXPLAIN ANALYZE to optimize slow queries

### Storage Management
- Embeddings consume ~6KB per event
- Plan for ~10KB per audit event with all AI fields
- Consider archival strategy for old events

## Security Considerations

### Row-Level Security (RLS)
The migration includes commented-out RLS policy examples. Enable and customize based on your auth setup:

```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON audit_logs
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### Encryption
- Sensitive fields should be encrypted at application level
- Integration configs should use encrypted storage
- Consider column-level encryption for PII

### Access Control
- Restrict schema modification to service role
- Grant SELECT only to authenticated users
- Implement audit:read and audit:export permissions

## Monitoring and Maintenance

### Health Checks
- Monitor vector index performance
- Track anomaly detection latency
- Monitor integration webhook success rates
- Track ML model prediction accuracy

### Maintenance Tasks
- Weekly: VACUUM ANALYZE on audit tables
- Monthly: Review and archive old audit events
- Quarterly: Retrain ML models with new data
- Annually: Review and update bias metrics

## Troubleshooting

### Common Issues

**Issue: pgvector extension not found**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Issue: Vector index creation fails**
- Ensure sufficient memory for IVFFlat index
- Reduce lists parameter if needed
- Check for existing data in table

**Issue: Foreign key constraint violations**
- Ensure audit_logs table exists
- Verify auth.users table exists
- Check for orphaned records

**Issue: Permission denied**
- Use service role key for schema changes
- Check RLS policies if enabled
- Verify user has necessary grants

## Next Steps

After successful migration:

1. **Implement Backend Services**
   - AuditAnomalyService
   - AuditRAGAgent
   - AuditMLService
   - AuditExportService
   - AuditIntegrationHub

2. **Create API Endpoints**
   - Audit router with filtering
   - Anomaly detection endpoints
   - Semantic search endpoints
   - Export endpoints

3. **Build Frontend Components**
   - Timeline visualization
   - Anomaly dashboard
   - Semantic search interface
   - Filter components

4. **Set Up Background Jobs**
   - Hourly anomaly detection
   - Embedding generation
   - Model training
   - Scheduled reports

5. **Configure Integrations**
   - Slack webhooks
   - Teams webhooks
   - Zapier triggers
   - Email SMTP

## Support

For issues or questions:
- Review the design document: `.kiro/specs/ai-empowered-audit-trail/design.md`
- Check requirements: `.kiro/specs/ai-empowered-audit-trail/requirements.md`
- Review tasks: `.kiro/specs/ai-empowered-audit-trail/tasks.md`

## References

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Supabase SQL Editor](https://supabase.com/docs/guides/database/overview)
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
