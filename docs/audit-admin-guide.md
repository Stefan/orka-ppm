# AI-Empowered Audit Trail Administrator Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Integration Setup](#integration-setup)
3. [Scheduled Reports Configuration](#scheduled-reports-configuration)
4. [Model Training Procedures](#model-training-procedures)
5. [User Management](#user-management)
6. [System Configuration](#system-configuration)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)

---

## Introduction

This guide is for system administrators responsible for configuring and maintaining the AI-Empowered Audit Trail feature.

### Administrator Responsibilities

- Configure external integrations (Slack, Teams, Zapier, Email)
- Set up scheduled reports
- Manage ML model training
- Configure user permissions
- Monitor system health
- Troubleshoot issues
- Ensure compliance requirements are met

### Required Permissions

Administrators need the `audit:admin` permission to perform configuration tasks.

---

## Integration Setup

Configure external integrations to receive real-time anomaly alerts.

### Slack Integration

Send anomaly alerts to Slack channels.

#### Prerequisites

1. Slack workspace with admin access
2. Ability to create incoming webhooks

#### Setup Steps

**1. Create Slack Webhook**

1. Go to https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. Name: "Audit Alerts"
4. Select your workspace
5. Click **Incoming Webhooks**
6. Toggle **Activate Incoming Webhooks** to On
7. Click **Add New Webhook to Workspace**
8. Select channel (e.g., #security-alerts)
9. Click **Allow**
10. Copy the webhook URL

**2. Configure in Platform**


1. Navigate to **Settings** → **Audit Integrations**
2. Click **Add Integration**
3. Select **Slack**
4. Fill in configuration:
   ```json
   {
     "webhook_url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
     "channel": "#security-alerts",
     "min_severity": "high",
     "include_details": true
   }
   ```
5. Click **Test Connection** to verify
6. Click **Save**

**Configuration Options:**

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| webhook_url | String | Slack webhook URL | Required |
| channel | String | Target channel name | Required |
| min_severity | String | Minimum severity to alert (low, medium, high, critical) | high |
| include_details | Boolean | Include full event details | true |
| mention_users | Array | Slack user IDs to mention | [] |

**Example Alert Message:**

```
🚨 Critical Anomaly Detected

Anomaly Score: 0.95
Event Type: permission_change
Severity: Critical
Time: 2024-01-15 02:30 AM

Details:
Admin access granted to external user outside business hours

Affected Entity: Project Alpha
User: john.smith@example.com

View in Dashboard: https://app.yourplatform.com/audit/anomalies/660e8400...
```

**Testing:**

```bash
curl -X POST "https://api.yourplatform.com/api/audit/integrations/test" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "integration_id": "880e8400-e29b-41d4-a716-446655440000"
  }'
```

---

### Microsoft Teams Integration

Send anomaly alerts to Microsoft Teams channels.

#### Prerequisites

1. Microsoft Teams with admin access
2. Ability to create incoming webhooks

#### Setup Steps

**1. Create Teams Webhook**

1. Open Microsoft Teams
2. Navigate to the target channel
3. Click **⋯** (More options) → **Connectors**
4. Search for **Incoming Webhook**
5. Click **Configure**
6. Name: "Audit Alerts"
7. Upload icon (optional)
8. Click **Create**
9. Copy the webhook URL

**2. Configure in Platform**

1. Navigate to **Settings** → **Audit Integrations**
2. Click **Add Integration**
3. Select **Microsoft Teams**
4. Fill in configuration:
   ```json
   {
     "webhook_url": "https://outlook.office.com/webhook/YOUR_WEBHOOK_URL",
     "channel_name": "Security Alerts",
     "min_severity": "high",
     "use_adaptive_cards": true
   }
   ```
5. Click **Test Connection**
6. Click **Save**

**Configuration Options:**

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| webhook_url | String | Teams webhook URL | Required |
| channel_name | String | Channel display name | Required |
| min_severity | String | Minimum severity to alert | high |
| use_adaptive_cards | Boolean | Use rich adaptive cards | true |
| mention_users | Array | Teams user emails to mention | [] |

**Example Adaptive Card:**

Teams alerts use rich adaptive cards with:
- Color-coded severity indicators
- Expandable event details
- Action buttons (View in Dashboard, Mark as False Positive)
- Formatted timestamps and user information

---

### Zapier Integration

Trigger Zapier workflows from anomaly detections.

#### Prerequisites

1. Zapier account (Free or paid)
2. Ability to create Zaps

#### Setup Steps

**1. Create Zapier Webhook**

1. Log in to Zapier
2. Click **Create Zap**
3. Search for **Webhooks by Zapier**
4. Choose **Catch Hook** trigger
5. Copy the webhook URL
6. Continue to set up your workflow actions

**2. Configure in Platform**

1. Navigate to **Settings** → **Audit Integrations**
2. Click **Add Integration**
3. Select **Zapier**
4. Fill in configuration:
   ```json
   {
     "webhook_url": "https://hooks.zapier.com/hooks/catch/YOUR_HOOK_ID/",
     "min_severity": "medium",
     "include_full_event": true
   }
   ```
5. Click **Test Connection**
6. Click **Save**

**Webhook Payload:**

```json
{
  "event_type": "anomaly_detected",
  "anomaly_id": "660e8400-e29b-41d4-a716-446655440000",
  "anomaly_score": 0.92,
  "severity": "critical",
  "timestamp": "2024-01-15T14:30:00Z",
  "audit_event": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "event_type": "permission_change",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "entity_type": "project",
    "entity_id": "789e0123-e89b-12d3-a456-426614174000",
    "action_details": { ... }
  },
  "explanation": {
    "summary": "Unusual admin access grant detected",
    "top_features": [ ... ]
  }
}
```

**Example Zap Workflows:**

1. **Create Jira Ticket**: Anomaly → Jira Issue
2. **Send Email**: Anomaly → Gmail/Outlook
3. **Log to Spreadsheet**: Anomaly → Google Sheets
4. **Create ServiceNow Incident**: Anomaly → ServiceNow
5. **Post to Discord**: Anomaly → Discord Channel

---

### Email Integration

Send anomaly alerts via email.

#### Prerequisites

1. SMTP server configuration
2. Email addresses for recipients

#### Setup Steps

**1. Configure SMTP Settings**

1. Navigate to **Settings** → **Email Configuration**
2. Fill in SMTP details:
   ```json
   {
     "smtp_host": "smtp.gmail.com",
     "smtp_port": 587,
     "smtp_user": "alerts@yourcompany.com",
     "smtp_password": "your_app_password",
     "use_tls": true,
     "from_address": "audit-alerts@yourcompany.com",
     "from_name": "Audit Alert System"
   }
   ```
3. Click **Test SMTP Connection**
4. Click **Save**

**2. Configure Email Alerts**

1. Navigate to **Settings** → **Audit Integrations**
2. Click **Add Integration**
3. Select **Email**
4. Fill in configuration:
   ```json
   {
     "recipients": [
       "security@yourcompany.com",
       "admin@yourcompany.com"
     ],
     "cc": ["manager@yourcompany.com"],
     "min_severity": "high",
     "include_attachments": false,
     "email_template": "default"
   }
   ```
5. Click **Send Test Email**
6. Click **Save**

**Configuration Options:**

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| recipients | Array | Primary recipients | Required |
| cc | Array | CC recipients | [] |
| bcc | Array | BCC recipients | [] |
| min_severity | String | Minimum severity | high |
| include_attachments | Boolean | Attach event details as JSON | false |
| email_template | String | Template to use (default, detailed, summary) | default |

**Email Templates:**

- **default**: Standard alert with key details
- **detailed**: Full event information and analysis
- **summary**: Brief notification with link to dashboard

---

### Integration Best Practices

**Security:**
- Use environment variables for webhook URLs and API keys
- Rotate webhook URLs periodically
- Monitor integration delivery success rates
- Set up alerts for integration failures

**Performance:**
- Set appropriate severity thresholds to avoid alert fatigue
- Use rate limiting to prevent overwhelming external systems
- Batch notifications when possible

**Reliability:**
- Configure multiple integration channels for redundancy
- Test integrations regularly
- Monitor webhook delivery failures
- Set up retry logic with exponential backoff

**Compliance:**
- Log all integration deliveries
- Encrypt sensitive data in webhook payloads
- Document integration configurations
- Review integration access regularly

---

## Scheduled Reports Configuration

Automate audit report generation and distribution.

### Creating Scheduled Reports

**1. Navigate to Scheduled Reports**

1. Go to **Settings** → **Scheduled Reports**
2. Click **Create New Report**

**2. Configure Report Details**

```json
{
  "report_name": "Weekly Security Review",
  "description": "Weekly audit report for security team",
  "schedule": "0 9 * * 1",
  "timezone": "America/New_York",
  "format": "pdf",
  "include_summary": true
}
```

**3. Configure Filters**

```json
{
  "filters": {
    "date_range": "last_7_days",
    "severity": ["high", "critical"],
    "categories": ["Security Change", "Compliance Action"],
    "include_anomalies": true
  }
}
```

**4. Configure Recipients**

```json
{
  "recipients": [
    "security@yourcompany.com",
    "compliance@yourcompany.com"
  ],
  "subject": "Weekly Security Audit Report - {{date}}",
  "body": "Please find attached the weekly security audit report."
}
```

**5. Save and Activate**

1. Click **Preview Report** to test
2. Click **Save**
3. Toggle **Active** to enable

### Schedule Syntax

Use cron expressions for scheduling:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

**Common Schedules:**

| Schedule | Cron Expression | Description |
|----------|----------------|-------------|
| Daily at 9 AM | `0 9 * * *` | Every day at 9:00 AM |
| Weekly on Monday | `0 9 * * 1` | Every Monday at 9:00 AM |
| Monthly on 1st | `0 9 1 * *` | First day of month at 9:00 AM |
| Every 6 hours | `0 */6 * * *` | Every 6 hours |
| Weekdays at 5 PM | `0 17 * * 1-5` | Monday-Friday at 5:00 PM |

### Report Templates

**Security Review Template:**
```json
{
  "report_name": "Security Review",
  "schedule": "0 9 * * 1",
  "filters": {
    "date_range": "last_7_days",
    "categories": ["Security Change"],
    "severity": ["high", "critical"]
  },
  "include_summary": true,
  "include_anomalies": true,
  "include_trends": true
}
```

**Compliance Audit Template:**
```json
{
  "report_name": "Compliance Audit",
  "schedule": "0 9 1 * *",
  "filters": {
    "date_range": "last_30_days",
    "categories": ["Compliance Action"],
    "include_all_events": true
  },
  "include_summary": true,
  "format": "pdf"
}
```

**Executive Summary Template:**
```json
{
  "report_name": "Executive Summary",
  "schedule": "0 9 1 * *",
  "filters": {
    "date_range": "last_30_days",
    "severity": ["critical", "high"]
  },
  "include_summary": true,
  "include_trends": true,
  "format": "pdf"
}
```

### Managing Scheduled Reports

**View Report History:**
1. Navigate to **Settings** → **Scheduled Reports**
2. Click on a report
3. View **Execution History** tab
4. See past runs, success/failure status, and download generated reports

**Pause/Resume Reports:**
1. Click on a report
2. Toggle **Active** switch
3. Paused reports won't generate until reactivated

**Edit Reports:**
1. Click on a report
2. Click **Edit**
3. Modify configuration
4. Click **Save**
5. Changes apply to next scheduled run

**Delete Reports:**
1. Click on a report
2. Click **Delete**
3. Confirm deletion
4. Past generated reports are retained

---

## Model Training Procedures

Manage ML model training for anomaly detection and classification.

### Understanding Model Types

**1. Anomaly Detector (Isolation Forest)**
- Detects unusual patterns in audit events
- Trained on historical event data
- Retraining frequency: Weekly

**2. Category Classifier (Random Forest)**
- Classifies events into categories
- Trained on labeled event data
- Retraining frequency: Monthly

**3. Risk Classifier (Gradient Boosting)**
- Assigns risk levels to events
- Trained on labeled event data
- Retraining frequency: Monthly

### Automatic Model Training

Models are automatically retrained on schedule:

**Anomaly Detector:**
- Schedule: Every Sunday at 3:00 AM
- Training data: Last 30 days of events
- Minimum data: 1,000 events

**Classifiers:**
- Schedule: First day of month at 3:00 AM
- Training data: Last 90 days of labeled events
- Minimum data: 500 labeled events per category

### Manual Model Training

**When to Retrain Manually:**
- After significant system changes
- When false positive rate is high
- After adding new event types
- When accuracy degrades

**Steps to Retrain:**

1. Navigate to **Settings** → **ML Models**
2. Select model type
3. Click **Train New Model**
4. Configure training:
   ```json
   {
     "training_data_range": "last_90_days",
     "validation_split": 0.2,
     "hyperparameters": {
       "n_estimators": 100,
       "max_depth": 10,
       "min_samples_split": 5
     }
   }
   ```
5. Click **Start Training**
6. Monitor training progress
7. Review training metrics
8. Activate new model if metrics are satisfactory

### Training Data Requirements

**Anomaly Detector:**
- Minimum: 1,000 events
- Recommended: 10,000+ events
- Data quality: Clean, representative data
- Time range: 30-90 days

**Category Classifier:**
- Minimum: 500 labeled events per category
- Recommended: 2,000+ labeled events per category
- Label quality: Accurate, consistent labels
- Balance: Equal representation across categories

**Risk Classifier:**
- Minimum: 500 labeled events per risk level
- Recommended: 2,000+ labeled events per risk level
- Label quality: Accurate risk assessments
- Balance: Representation across all risk levels

### Labeling Data for Training

**1. Access Labeling Interface**

1. Navigate to **Settings** → **ML Models** → **Data Labeling**
2. View unlabeled events

**2. Label Events**

For each event:
- Assign category (Security Change, Financial Impact, etc.)
- Assign risk level (Low, Medium, High, Critical)
- Add notes explaining the classification

**3. Review Labels**

- Ensure consistency across similar events
- Have multiple reviewers for critical events
- Document labeling guidelines

**4. Export Labeled Data**

```bash
curl -X GET "https://api.yourplatform.com/api/audit/ml/labeled-data" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  --output labeled_data.csv
```

### Model Evaluation Metrics

**Anomaly Detector:**
- **Precision**: % of detected anomalies that are true anomalies
- **Recall**: % of true anomalies that are detected
- **F1 Score**: Harmonic mean of precision and recall
- **False Positive Rate**: % of normal events flagged as anomalies

**Target Metrics:**
- Precision: > 0.80
- Recall: > 0.75
- F1 Score: > 0.77
- False Positive Rate: < 0.05

**Classifiers:**
- **Accuracy**: % of correct classifications
- **Precision per class**: Precision for each category/risk level
- **Recall per class**: Recall for each category/risk level
- **Confusion Matrix**: Detailed classification breakdown

**Target Metrics:**
- Accuracy: > 0.85
- Precision per class: > 0.80
- Recall per class: > 0.75

### Model Versioning

All models are versioned:
- Version format: `{model_type}-v{major}.{minor}`
- Example: `anomaly-detector-v1.2`

**Version History:**
1. Navigate to **Settings** → **ML Models**
2. Select model type
3. View **Version History**
4. See training date, metrics, and status

**Rollback to Previous Version:**
1. Navigate to version history
2. Select previous version
3. Click **Activate**
4. Confirm rollback

### Tenant-Specific Models

For large tenants with sufficient data:

**Criteria for Tenant-Specific Model:**
- Minimum 1,000 labeled events
- Consistent event patterns
- Sufficient training data per category

**Creating Tenant-Specific Model:**
1. Navigate to **Settings** → **ML Models** → **Tenant Models**
2. Select tenant
3. Click **Train Tenant Model**
4. Review metrics
5. Activate if metrics are better than shared model

**Benefits:**
- Higher accuracy for tenant-specific patterns
- Reduced false positives
- Better anomaly detection

---

## User Management

Manage user access to audit features.

### Permission Levels

**audit:read**
- View audit logs
- Use semantic search
- View anomalies
- Access dashboard

**audit:export**
- All audit:read permissions
- Export PDF reports
- Export CSV data
- Generate ad-hoc reports

**audit:admin**
- All audit:export permissions
- Configure integrations
- Set up scheduled reports
- Manage ML models
- Configure system settings

### Assigning Permissions

**1. Individual User:**

1. Navigate to **Settings** → **Users**
2. Search for user
3. Click **Edit Permissions**
4. Toggle audit permissions
5. Click **Save**

**2. Role-Based:**

1. Navigate to **Settings** → **Roles**
2. Select role (e.g., "Security Team")
3. Click **Edit Permissions**
4. Toggle audit permissions
5. Click **Save**
6. All users with this role inherit permissions

**3. Bulk Assignment:**

```bash
curl -X POST "https://api.yourplatform.com/api/admin/permissions/bulk" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_ids": ["user1_id", "user2_id", "user3_id"],
    "permissions": ["audit:read", "audit:export"]
  }'
```

### Permission Best Practices

**Principle of Least Privilege:**
- Grant minimum permissions needed
- Review permissions quarterly
- Remove permissions when no longer needed

**Separation of Duties:**
- Separate audit:read from audit:admin
- Different teams for operations vs. configuration
- Require approval for audit:admin access

**Audit Access Logging:**
- All audit log access is logged
- Review access logs monthly
- Investigate unusual access patterns

---

## System Configuration

Configure system-wide audit settings.

### Retention Policy

**Configure Retention:**

1. Navigate to **Settings** → **Audit Configuration** → **Retention**
2. Set retention periods:
   ```json
   {
     "active_retention_days": 365,
     "archive_retention_years": 7,
     "auto_archive": true,
     "archive_storage": "cold_storage"
   }
   ```
3. Click **Save**

**Retention Tiers:**
- **Active**: 1 year (hot storage, fast access)
- **Archive**: 7 years (cold storage, slower access)
- **Deletion**: After 7 years (compliance requirement)

### Anomaly Detection Settings

**Configure Thresholds:**

1. Navigate to **Settings** → **Audit Configuration** → **Anomaly Detection**
2. Adjust settings:
   ```json
   {
     "anomaly_threshold": 0.7,
     "detection_frequency": "hourly",
     "lookback_window_hours": 24,
     "min_events_for_detection": 100,
     "alert_on_critical_only": false
   }
   ```
3. Click **Save**

**Threshold Guidelines:**
- **0.6-0.69**: Very sensitive (more false positives)
- **0.7-0.79**: Balanced (recommended)
- **0.8-0.89**: Conservative (fewer false positives)
- **0.9-1.0**: Very conservative (only severe anomalies)

### Performance Settings

**Configure Performance:**

1. Navigate to **Settings** → **Audit Configuration** → **Performance**
2. Adjust settings:
   ```json
   {
     "cache_ttl_seconds": 3600,
     "max_search_results": 1000,
     "export_batch_size": 10000,
     "websocket_update_interval": 30,
     "enable_query_optimization": true
   }
   ```
3. Click **Save**

### Compliance Settings

**Configure Compliance:**

1. Navigate to **Settings** → **Audit Configuration** → **Compliance**
2. Enable compliance modes:
   ```json
   {
     "fda_21_cfr_part_11": true,
     "gdpr_compliance": true,
     "soc2_compliance": true,
     "hash_chain_verification": true,
     "encryption_at_rest": true,
     "access_logging": true
   }
   ```
3. Click **Save**

---

## Monitoring and Maintenance

Monitor system health and perform maintenance tasks.

### Health Monitoring

**Dashboard Metrics:**

1. Navigate to **Admin** → **System Health** → **Audit System**
2. Monitor key metrics:
   - Event ingestion rate
   - Anomaly detection latency
   - Search response time
   - Model accuracy
   - Integration delivery success rate
   - Storage usage

**Alert Thresholds:**

```json
{
  "event_ingestion_latency_ms": {
    "warning": 100,
    "critical": 200
  },
  "anomaly_detection_latency_ms": {
    "warning": 300000,
    "critical": 600000
  },
  "search_response_time_ms": {
    "warning": 2000,
    "critical": 5000
  },
  "integration_failure_rate": {
    "warning": 0.05,
    "critical": 0.10
  }
}
```

### Database Maintenance

**Monthly Tasks:**

1. **Vacuum Database:**
   ```sql
   VACUUM ANALYZE roche_audit_logs;
   VACUUM ANALYZE audit_embeddings;
   VACUUM ANALYZE audit_anomalies;
   ```

2. **Rebuild Indexes:**
   ```sql
   REINDEX TABLE roche_audit_logs;
   REINDEX TABLE audit_embeddings;
   ```

3. **Update Statistics:**
   ```sql
   ANALYZE roche_audit_logs;
   ANALYZE audit_embeddings;
   ```

**Quarterly Tasks:**

1. **Archive Old Data:**
   - Move events older than 1 year to cold storage
   - Verify archive integrity
   - Update retention metadata

2. **Verify Hash Chain:**
   ```bash
   curl -X POST "https://api.yourplatform.com/api/admin/audit/verify-hash-chain" \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

3. **Review Storage Usage:**
   - Check storage growth trends
   - Plan for capacity expansion
   - Optimize storage if needed

### Model Maintenance

**Weekly Tasks:**

1. **Review Model Performance:**
   - Check false positive rate
   - Review user feedback
   - Monitor accuracy metrics

2. **Update Training Data:**
   - Label new events
   - Review labeling consistency
   - Export labeled data

**Monthly Tasks:**

1. **Retrain Models:**
   - Anomaly detector
   - Category classifier
   - Risk classifier

2. **Evaluate New Models:**
   - Compare metrics to previous version
   - Test on validation set
   - Activate if improved

### Integration Maintenance

**Weekly Tasks:**

1. **Review Delivery Success:**
   - Check webhook delivery rates
   - Investigate failures
   - Retry failed deliveries

2. **Test Integrations:**
   - Send test notifications
   - Verify formatting
   - Check response times

**Monthly Tasks:**

1. **Rotate Credentials:**
   - Update webhook URLs
   - Rotate API keys
   - Update SMTP passwords

2. **Review Configuration:**
   - Verify recipients are current
   - Update severity thresholds
   - Remove unused integrations

---

## Troubleshooting

Common issues and solutions.

### Anomaly Detection Issues

**Issue: Too Many False Positives**

**Symptoms:**
- High false positive rate (> 10%)
- Users frequently marking anomalies as false positives
- Alert fatigue

**Solutions:**
1. Increase anomaly threshold (0.7 → 0.8)
2. Retrain model with recent feedback
3. Review and update training data
4. Adjust feature weights

**Issue: Missing True Anomalies**

**Symptoms:**
- Known security events not flagged
- Low recall rate (< 0.70)
- Anomalies discovered manually

**Solutions:**
1. Decrease anomaly threshold (0.7 → 0.6)
2. Retrain model with more diverse data
3. Add more training examples
4. Review feature extraction logic

### Search Issues

**Issue: Slow Search Response**

**Symptoms:**
- Search takes > 5 seconds
- Timeout errors
- Poor user experience

**Solutions:**
1. Check database indexes
2. Optimize vector search parameters
3. Increase cache TTL
4. Add more database resources
5. Partition large tables

**Issue: Irrelevant Search Results**

**Symptoms:**
- Results don't match query intent
- Low similarity scores
- User complaints

**Solutions:**
1. Regenerate embeddings
2. Update embedding model
3. Improve query preprocessing
4. Add more context to embeddings

### Integration Issues

**Issue: Webhook Delivery Failures**

**Symptoms:**
- Integration delivery rate < 95%
- Timeout errors
- Connection refused errors

**Solutions:**
1. Verify webhook URL is accessible
2. Check firewall rules
3. Increase timeout settings
4. Implement retry logic
5. Contact integration provider

**Issue: Incorrect Alert Format**

**Symptoms:**
- Alerts not displaying correctly
- Missing information
- Formatting errors

**Solutions:**
1. Review integration configuration
2. Update message templates
3. Test with sample data
4. Check API version compatibility

### Performance Issues

**Issue: High Database Load**

**Symptoms:**
- Slow query response
- High CPU usage
- Connection pool exhaustion

**Solutions:**
1. Add database indexes
2. Optimize slow queries
3. Increase connection pool size
4. Partition large tables
5. Add read replicas

**Issue: High Memory Usage**

**Symptoms:**
- Out of memory errors
- Slow ML model inference
- System crashes

**Solutions:**
1. Reduce batch sizes
2. Optimize model size
3. Add more memory
4. Implement streaming for large exports
5. Clear caches regularly

### Data Issues

**Issue: Hash Chain Broken**

**Symptoms:**
- Hash verification failures
- Critical alerts
- Compliance violations

**Solutions:**
1. Identify break point
2. Investigate cause (tampering vs. bug)
3. Document incident
4. Restore from backup if tampering
5. Fix bug if system error
6. Notify security team

**Issue: Missing Embeddings**

**Symptoms:**
- Search returns no results
- Embedding generation errors
- Null embedding values

**Solutions:**
1. Check OpenAI API status
2. Verify API key is valid
3. Regenerate missing embeddings
4. Review error logs
5. Increase API rate limits

---

## Appendix: Configuration Reference

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_TTL=3600

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@yourcompany.com
SMTP_PASSWORD=app_password
SMTP_USE_TLS=true

# Audit Configuration
AUDIT_ANOMALY_THRESHOLD=0.7
AUDIT_DETECTION_FREQUENCY=hourly
AUDIT_RETENTION_DAYS=365
AUDIT_ARCHIVE_YEARS=7

# Performance
AUDIT_CACHE_TTL=3600
AUDIT_MAX_SEARCH_RESULTS=1000
AUDIT_EXPORT_BATCH_SIZE=10000

# Security
AUDIT_HASH_ALGORITHM=sha256
AUDIT_ENCRYPTION_KEY=base64_encoded_key
AUDIT_ENABLE_ACCESS_LOGGING=true
```

### API Rate Limits

```json
{
  "standard_endpoints": {
    "requests_per_minute": 100,
    "burst": 150
  },
  "export_endpoints": {
    "requests_per_minute": 10,
    "burst": 15
  },
  "search_endpoints": {
    "requests_per_minute": 30,
    "burst": 50
  }
}
```

### Database Indexes

```sql
-- Core indexes
CREATE INDEX idx_audit_timestamp ON roche_audit_logs(timestamp DESC);
CREATE INDEX idx_audit_event_type ON roche_audit_logs(event_type);
CREATE INDEX idx_audit_user_id ON roche_audit_logs(user_id);
CREATE INDEX idx_audit_entity ON roche_audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_severity ON roche_audit_logs(severity);
CREATE INDEX idx_audit_tenant ON roche_audit_logs(tenant_id);

-- AI-specific indexes
CREATE INDEX idx_audit_anomaly ON roche_audit_logs(anomaly_score) WHERE is_anomaly = TRUE;
CREATE INDEX idx_audit_category ON roche_audit_logs(category);
CREATE INDEX idx_audit_risk_level ON roche_audit_logs(risk_level);
CREATE INDEX idx_audit_tags ON roche_audit_logs USING GIN(tags);

-- Vector index
CREATE INDEX idx_embeddings_vector ON audit_embeddings 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

**Last Updated:** January 2024  
**Version:** 1.0  
**Contact:** admin-support@yourplatform.com
