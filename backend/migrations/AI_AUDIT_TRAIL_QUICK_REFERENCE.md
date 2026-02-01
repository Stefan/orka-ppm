# AI-Empowered Audit Trail Quick Reference

## Quick Start

### Apply Migration
```bash
# Via Supabase SQL Editor (Recommended)
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of: backend/migrations/023_ai_empowered_audit_trail.sql
3. Execute SQL
4. Verify in Table Editor

# Via Python Script
cd backend/migrations
python apply_ai_audit_trail_migration.py
python verify_ai_audit_trail_migration.py
```

### Verify Migration
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'audit_%';

-- Check audit_logs columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'audit_logs' 
AND column_name IN ('anomaly_score', 'category', 'risk_level', 'tenant_id');
```

## Table Quick Reference

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `audit_logs` | Core audit events (extended) | anomaly_score, category, risk_level, tenant_id, hash |
| `audit_embeddings` | Semantic search vectors | embedding (vector 1536), content_text |
| `audit_anomalies` | Anomaly detections | anomaly_score, is_false_positive, alert_sent |
| `audit_ml_models` | ML model versions | model_type, model_version, metrics, is_active |
| `audit_integrations` | External webhooks | integration_type, config, is_active |
| `audit_scheduled_reports` | Automated reports | schedule_cron, next_run, format |
| `audit_access_log` | Meta-audit logging | user_id, access_type, query_parameters |
| `audit_bias_metrics` | AI fairness tracking | metric_type, dimension, is_biased |
| `audit_ai_predictions` | AI prediction log | prediction_type, confidence_score, review_required |

## Common Queries

### Get Recent Anomalies
```sql
SELECT a.*, e.event_type, e.severity
FROM audit_anomalies a
JOIN audit_logs e ON e.id = a.audit_event_id
WHERE a.tenant_id = :tenant_id
AND a.detection_timestamp > NOW() - INTERVAL '24 hours'
ORDER BY a.anomaly_score DESC
LIMIT 50;
```

### Semantic Search
```sql
SELECT 
    a.*,
    e.embedding <=> :query_embedding AS similarity
FROM audit_logs a
JOIN audit_embeddings e ON e.audit_event_id = a.id
WHERE a.tenant_id = :tenant_id
ORDER BY e.embedding <=> :query_embedding
LIMIT 10;
```

### Filter by Category and Risk
```sql
SELECT * FROM audit_logs
WHERE tenant_id = :tenant_id
AND category = :category
AND risk_level = :risk_level
AND timestamp BETWEEN :start_date AND :end_date
ORDER BY timestamp DESC;
```

### Get Active Integrations
```sql
SELECT * FROM audit_integrations
WHERE tenant_id = :tenant_id
AND is_active = true;
```

### Find Due Scheduled Reports
```sql
SELECT * FROM audit_scheduled_reports
WHERE is_active = true
AND next_run <= NOW()
ORDER BY next_run;
```

### Check for Bias
```sql
SELECT * FROM audit_bias_metrics
WHERE tenant_id = :tenant_id
AND is_biased = true
AND calculation_date > NOW() - INTERVAL '30 days'
ORDER BY calculation_date DESC;
```

### Get Low-Confidence Predictions
```sql
SELECT p.*, a.event_type, a.severity
FROM audit_ai_predictions p
JOIN audit_logs a ON a.id = p.audit_event_id
WHERE p.tenant_id = :tenant_id
AND p.review_required = true
AND p.reviewed_by IS NULL
ORDER BY p.prediction_timestamp DESC;
```

## Insert Examples

### Create Audit Event with AI Fields
```sql
INSERT INTO audit_logs (
    event_type, entity_type, action_details,
    anomaly_score, is_anomaly, category, risk_level,
    tags, tenant_id, hash, previous_hash
) VALUES (
    'budget_change',
    'project',
    '{"old_budget": 100000, "new_budget": 150000}'::jsonb,
    0.85,
    true,
    'Financial Impact',
    'High',
    '{"impact": "high", "requires_approval": true}'::jsonb,
    :tenant_id,
    :event_hash,
    :previous_hash
);
```

### Create Embedding
```sql
INSERT INTO audit_embeddings (
    audit_event_id, embedding, content_text, tenant_id
) VALUES (
    :event_id,
    :embedding_vector,
    'Budget changed from $100,000 to $150,000 for Project Alpha',
    :tenant_id
);
```

### Create Anomaly
```sql
INSERT INTO audit_anomalies (
    audit_event_id, anomaly_score, features_used,
    model_version, tenant_id, severity, affected_entities
) VALUES (
    :event_id,
    0.92,
    '{"time_of_day": 0.8, "user_pattern": 0.9}'::jsonb,
    'v1.0.0',
    :tenant_id,
    'critical',
    '{"projects": ["proj-123"], "users": ["user-456"]}'::jsonb
);
```

### Configure Integration
```sql
INSERT INTO audit_integrations (
    tenant_id, integration_type, config, is_active
) VALUES (
    :tenant_id,
    'slack',
    '{"webhook_url": "https://hooks.slack.com/...", "channel": "#alerts"}'::jsonb,
    true
);
```

### Schedule Report
```sql
INSERT INTO audit_scheduled_reports (
    tenant_id, report_name, schedule_cron, filters,
    recipients, include_summary, format, next_run
) VALUES (
    :tenant_id,
    'Weekly Security Report',
    '0 9 * * 1',  -- Every Monday at 9am
    '{"category": "Security Change"}'::jsonb,
    '["admin@example.com", "security@example.com"]'::jsonb,
    true,
    'pdf',
    :next_run_timestamp
);
```

## Enumerations

### Categories
- `Security Change`
- `Financial Impact`
- `Resource Allocation`
- `Risk Event`
- `Compliance Action`

### Risk Levels
- `Low`
- `Medium`
- `High`
- `Critical`

### Integration Types
- `slack`
- `teams`
- `zapier`
- `email`

### Model Types
- `anomaly_detector`
- `category_classifier`
- `risk_classifier`

### Access Types
- `read`
- `export`
- `search`

### Report Formats
- `pdf`
- `csv`

## Index Usage

### Vector Search
```sql
-- Uses idx_audit_embeddings_vector (IVFFlat)
SELECT * FROM audit_embeddings
WHERE tenant_id = :tenant_id
ORDER BY embedding <=> :query_vector
LIMIT 10;
```

### Anomaly Filtering
```sql
-- Uses idx_anomalies_score
SELECT * FROM audit_anomalies
WHERE anomaly_score > 0.8
ORDER BY anomaly_score DESC;
```

### Time-Range Queries
```sql
-- Uses idx_audit_logs_timestamp
SELECT * FROM audit_logs
WHERE timestamp BETWEEN :start AND :end
ORDER BY timestamp DESC;
```

### Tenant Isolation
```sql
-- Uses idx_audit_logs_tenant_id
SELECT * FROM audit_logs
WHERE tenant_id = :tenant_id;
```

## Performance Tips

### Vector Search Optimization
- Use tenant_id filter to reduce search space
- Adjust IVFFlat lists parameter based on data size
- Consider approximate search for large datasets

### Query Optimization
- Always include tenant_id in WHERE clause
- Use timestamp ranges to limit result sets
- Leverage composite indexes for common patterns

### Caching Strategy
- Cache classification results (1 hour)
- Cache search results (10 minutes)
- Cache dashboard stats (30 seconds)

### Batch Operations
- Use batch inserts for multiple events
- Process embeddings in batches
- Batch anomaly detection for efficiency

## Maintenance Commands

### Vacuum and Analyze
```sql
VACUUM ANALYZE audit_logs;
VACUUM ANALYZE audit_embeddings;
VACUUM ANALYZE audit_anomalies;
```

### Index Statistics
```sql
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND tablename LIKE 'audit_%'
ORDER BY idx_scan DESC;
```

### Table Sizes
```sql
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'audit_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Unused Indexes
```sql
SELECT schemaname, tablename, indexname
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND idx_scan = 0
AND tablename LIKE 'audit_%';
```

## Troubleshooting

### Vector Extension Not Found
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Foreign Key Violations
```sql
-- Check if referenced records exist
SELECT id FROM audit_logs WHERE id = :event_id;
SELECT id FROM auth.users WHERE id = :user_id;
```

### Index Not Being Used
```sql
-- Check query plan
EXPLAIN ANALYZE
SELECT * FROM audit_embeddings
WHERE tenant_id = :tenant_id
ORDER BY embedding <=> :query_vector
LIMIT 10;
```

### Slow Queries
```sql
-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%audit_%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Security Checklist

- [ ] Enable row-level security on all tables
- [ ] Create tenant isolation policies
- [ ] Encrypt sensitive config data
- [ ] Implement audit:read permission checks
- [ ] Implement audit:export permission checks
- [ ] Enable meta-audit logging
- [ ] Configure hash chain generation
- [ ] Set up access logging

## Testing Checklist

- [ ] Insert test audit event
- [ ] Generate test embedding
- [ ] Create test anomaly
- [ ] Configure test integration
- [ ] Schedule test report
- [ ] Query with filters
- [ ] Perform semantic search
- [ ] Verify tenant isolation
- [ ] Test hash chain integrity
- [ ] Test access logging

## Resources

- **Migration File**: `backend/migrations/023_ai_empowered_audit_trail.sql`
- **Migration Guide**: `AI_AUDIT_TRAIL_MIGRATION_GUIDE.md`
- **Schema Summary**: `AI_AUDIT_TRAIL_SCHEMA_SUMMARY.md`
- **Design Doc**: `.kiro/specs/ai-empowered-audit-trail/design.md`
- **Requirements**: `.kiro/specs/ai-empowered-audit-trail/requirements.md`
- **Tasks**: `.kiro/specs/ai-empowered-audit-trail/tasks.md`
