# AI-Empowered Audit Trail Schema Summary

## Overview

This document provides a comprehensive summary of the database schema for the AI-Empowered Audit Trail feature.

## Migration Information

- **Migration Number**: 023
- **Migration File**: `023_ai_empowered_audit_trail.sql`
- **Requirements Covered**: 1.3, 1.4, 1.8, 3.10, 4.1, 4.4, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 6.2, 9.1, 9.4, 9.5
- **Status**: Ready to apply

## Schema Statistics

- **Tables Created**: 8 new tables
- **Tables Modified**: 1 (audit_logs)
- **Columns Added**: 9 to audit_logs
- **Indexes Created**: 43
- **Constraints Added**: 8
- **Comments Added**: 54

## Tables Overview

### 1. audit_logs (Extended)

**Purpose**: Core audit log table extended with AI capabilities

**New Columns**:
- `anomaly_score` (DECIMAL) - ML anomaly score 0-1
- `is_anomaly` (BOOLEAN) - Anomaly classification flag
- `category` (VARCHAR) - ML-assigned category
- `risk_level` (VARCHAR) - ML-assigned risk level
- `tags` (JSONB) - AI-generated tags
- `ai_insights` (JSONB) - AI-generated insights
- `tenant_id` (UUID) - Multi-tenant isolation
- `hash` (VARCHAR) - SHA-256 hash for tamper detection
- `previous_hash` (VARCHAR) - Hash chain linking

**New Indexes**: 6
**New Constraints**: 3

### 2. audit_embeddings

**Purpose**: Vector embeddings for semantic search

**Key Columns**:
- `id` (UUID) - Primary key
- `audit_event_id` (UUID) - Foreign key to audit_logs
- `embedding` (vector(1536)) - OpenAI ada-002 embedding
- `content_text` (TEXT) - Source text for embedding
- `tenant_id` (UUID) - Tenant isolation

**Indexes**: 3 (including IVFFlat vector index)
**Constraints**: 1 unique constraint

### 3. audit_anomalies

**Purpose**: Anomaly detection tracking and feedback

**Key Columns**:
- `id` (UUID) - Primary key
- `audit_event_id` (UUID) - Foreign key to audit_logs
- `anomaly_score` (DECIMAL) - Isolation Forest score
- `detection_timestamp` (TIMESTAMP) - When detected
- `features_used` (JSONB) - Feature vector
- `model_version` (VARCHAR) - ML model version
- `is_false_positive` (BOOLEAN) - User feedback
- `feedback_notes` (TEXT) - User feedback notes
- `alert_sent` (BOOLEAN) - Notification status
- `tenant_id` (UUID) - Tenant isolation

**Indexes**: 7
**Constraints**: 2

### 4. audit_ml_models

**Purpose**: ML model version tracking and metadata

**Key Columns**:
- `id` (UUID) - Primary key
- `model_type` (VARCHAR) - Type: anomaly_detector, category_classifier, risk_classifier
- `model_version` (VARCHAR) - Version identifier
- `training_date` (TIMESTAMP) - When trained
- `training_data_size` (INTEGER) - Training set size
- `metrics` (JSONB) - Accuracy, precision, recall, F1
- `model_path` (TEXT) - Storage location
- `is_active` (BOOLEAN) - Active model flag
- `tenant_id` (UUID) - Tenant-specific or NULL for shared

**Indexes**: 6
**Constraints**: 2

### 5. audit_integrations

**Purpose**: External tool integration configurations

**Key Columns**:
- `id` (UUID) - Primary key
- `tenant_id` (UUID) - Tenant identifier
- `integration_type` (VARCHAR) - Type: slack, teams, zapier, email
- `config` (JSONB) - Encrypted configuration
- `is_active` (BOOLEAN) - Active status
- `failure_count` (INTEGER) - Consecutive failures
- `last_failure_reason` (TEXT) - Error message

**Indexes**: 4
**Constraints**: 2

### 6. audit_scheduled_reports

**Purpose**: Automated report generation scheduling

**Key Columns**:
- `id` (UUID) - Primary key
- `tenant_id` (UUID) - Tenant identifier
- `report_name` (VARCHAR) - Report name
- `schedule_cron` (VARCHAR) - Cron expression
- `filters` (JSONB) - Report filters
- `recipients` (JSONB) - Email addresses
- `include_summary` (BOOLEAN) - Include AI summary
- `format` (VARCHAR) - pdf or csv
- `next_run` (TIMESTAMP) - Next execution time

**Indexes**: 4
**Constraints**: 2

### 7. audit_access_log

**Purpose**: Meta-audit logging (audit-of-audit)

**Key Columns**:
- `id` (UUID) - Primary key
- `user_id` (UUID) - User who accessed
- `access_type` (VARCHAR) - Type: read, export, search
- `query_parameters` (JSONB) - Query details
- `result_count` (INTEGER) - Results returned
- `timestamp` (TIMESTAMP) - Access time
- `tenant_id` (UUID) - Tenant isolation

**Indexes**: 5
**Constraints**: 1

### 8. audit_bias_metrics

**Purpose**: AI fairness tracking and bias detection

**Key Columns**:
- `id` (UUID) - Primary key
- `tenant_id` (UUID) - Tenant identifier
- `metric_type` (VARCHAR) - Metric being tracked
- `dimension` (VARCHAR) - Demographic dimension
- `dimension_value` (VARCHAR) - Specific value
- `metric_value` (DECIMAL) - Calculated metric
- `sample_size` (INTEGER) - Sample size
- `is_biased` (BOOLEAN) - Bias flag

**Indexes**: 4
**Constraints**: 1

### 9. audit_ai_predictions

**Purpose**: AI prediction logging for transparency

**Key Columns**:
- `id` (UUID) - Primary key
- `audit_event_id` (UUID) - Foreign key to audit_logs
- `prediction_type` (VARCHAR) - Type: anomaly, category, risk_level
- `predicted_value` (VARCHAR) - Prediction result
- `confidence_score` (DECIMAL) - Confidence 0-1
- `model_version` (VARCHAR) - Model version
- `review_required` (BOOLEAN) - Low confidence flag
- `review_outcome` (VARCHAR) - Human review result

**Indexes**: 5
**Constraints**: 3

## Index Strategy

### Vector Indexes
- **IVFFlat** on audit_embeddings.embedding for cosine similarity search
- Lists parameter: 100 (optimized for ~10,000 vectors)

### Performance Indexes
- Timestamp indexes for time-range queries
- Tenant isolation indexes on all tables
- Composite indexes for common query patterns

### Specialized Indexes
- **GIN** index on audit_logs.tags for JSONB queries
- **Partial** indexes for active records only
- **Partial** indexes for anomaly filtering

## Constraint Strategy

### Data Validation
- Range constraints on scores (0-1)
- Enumeration constraints on categorical fields
- Format constraints on report types

### Referential Integrity
- Foreign keys to audit_logs
- Foreign keys to auth.users
- CASCADE DELETE for dependent records

### Uniqueness
- Unique constraint on audit_event_id in embeddings
- Unique constraint on (tenant_id, integration_type)
- Unique constraint on (model_type, model_version, tenant_id)

## Storage Estimates

### Per Audit Event
- Base event: ~2 KB
- With AI fields: ~3 KB
- With embedding: ~9 KB (6 KB for vector)
- Total: ~12 KB per fully-analyzed event

### Scaling Projections
- 10,000 events/day: ~120 MB/day, ~3.6 GB/month
- 100,000 events/day: ~1.2 GB/day, ~36 GB/month
- 1,000,000 events/day: ~12 GB/day, ~360 GB/month

### Index Overhead
- Vector index: ~20% of embedding data size
- B-tree indexes: ~10% of table size
- GIN indexes: ~30% of JSONB data size

## Query Patterns

### Common Queries

1. **Get Recent Anomalies**
```sql
SELECT * FROM audit_anomalies
WHERE tenant_id = $1
AND detection_timestamp > NOW() - INTERVAL '24 hours'
ORDER BY anomaly_score DESC
LIMIT 50;
```

2. **Semantic Search**
```sql
SELECT a.*, e.embedding <=> $1 AS similarity
FROM audit_logs a
JOIN audit_embeddings e ON e.audit_event_id = a.id
WHERE a.tenant_id = $2
ORDER BY e.embedding <=> $1
LIMIT 10;
```

3. **Filter by Category and Risk**
```sql
SELECT * FROM audit_logs
WHERE tenant_id = $1
AND category = $2
AND risk_level = $3
AND timestamp BETWEEN $4 AND $5
ORDER BY timestamp DESC;
```

4. **Get Active Integrations**
```sql
SELECT * FROM audit_integrations
WHERE tenant_id = $1
AND is_active = true;
```

5. **Find Scheduled Reports Due**
```sql
SELECT * FROM audit_scheduled_reports
WHERE is_active = true
AND next_run <= NOW()
ORDER BY next_run;
```

## Security Features

### Multi-Tenant Isolation
- tenant_id column on all tables
- Indexes on tenant_id for performance
- Row-level security policies (to be enabled)

### Tamper Detection
- Hash chain in audit_logs
- SHA-256 hashing of event data
- previous_hash linking for integrity

### Access Logging
- audit_access_log for meta-audit
- Tracks all read, export, and search operations
- Includes query parameters and result counts

### Encryption
- Encrypted config storage in audit_integrations
- Application-level encryption for sensitive fields
- Column-level encryption support

## Compliance Features

### Immutability
- Append-only design (no UPDATE/DELETE)
- Hash chain for tamper detection
- Audit access logging

### Retention
- 7-year retention requirement support
- Archival strategy for old events
- Cold storage migration capability

### Auditability
- Complete audit trail of all operations
- Meta-audit logging (audit-of-audit)
- AI prediction logging for transparency

### Fairness
- Bias detection and tracking
- Prediction confidence logging
- Human review workflow support

## Performance Optimization

### Caching Strategy
- Redis caching for classification results (1 hour TTL)
- Redis caching for search results (10 minutes TTL)
- Redis caching for dashboard stats (30 seconds TTL)

### Partitioning Strategy
- Consider monthly partitioning for audit_logs
- Partition by tenant_id for large multi-tenant deployments
- Archive old partitions to cold storage

### Query Optimization
- Use EXPLAIN ANALYZE for slow queries
- Monitor index usage with pg_stat_user_indexes
- Adjust vector index lists parameter based on data size

## Maintenance Tasks

### Daily
- Monitor anomaly detection job execution
- Check integration webhook success rates
- Review critical anomalies

### Weekly
- VACUUM ANALYZE on audit tables
- Review and retrain anomaly detector
- Check bias metrics

### Monthly
- Retrain ML classifiers
- Archive old audit events
- Review storage usage

### Quarterly
- Comprehensive bias analysis
- Model performance evaluation
- Index optimization review

## Migration Checklist

- [ ] Review migration SQL file
- [ ] Backup existing database
- [ ] Execute migration via Supabase SQL editor
- [ ] Verify all tables created
- [ ] Verify all indexes created
- [ ] Verify all constraints added
- [ ] Test sample insert operations
- [ ] Enable row-level security policies
- [ ] Configure integration webhooks
- [ ] Set up scheduled jobs
- [ ] Monitor initial performance
- [ ] Document any issues

## Rollback Plan

If migration needs to be rolled back:

1. Drop new tables in reverse dependency order
2. Remove added columns from audit_logs
3. Restore from backup if needed
4. Document rollback reason
5. Fix issues before re-attempting

## Next Steps

After successful migration:

1. Implement backend services (Task 2-5)
2. Create API endpoints (Task 7)
3. Build frontend components (Task 12-16)
4. Set up background jobs (Task 17)
5. Configure integrations (Task 5)
6. Implement security features (Task 8)
7. Add bias detection (Task 9)
8. Enable multi-tenant support (Task 10)
9. Create real-time dashboard (Task 12)
10. Write comprehensive tests (Task 19)

## References

- Design Document: `.kiro/specs/ai-empowered-audit-trail/design.md`
- Requirements Document: `.kiro/specs/ai-empowered-audit-trail/requirements.md`
- Tasks Document: `.kiro/specs/ai-empowered-audit-trail/tasks.md`
- Migration Guide: `AI_AUDIT_TRAIL_MIGRATION_GUIDE.md`
