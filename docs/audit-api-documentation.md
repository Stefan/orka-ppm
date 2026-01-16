# AI-Empowered Audit Trail API Documentation

## Overview

This document provides comprehensive API documentation for the AI-Empowered Audit Trail feature. All endpoints require authentication and enforce tenant isolation.

## Base URL

```
Production: https://api.yourplatform.com
Staging: https://staging-api.yourplatform.com
Development: http://localhost:8000
```

## Authentication

All audit endpoints require a valid JWT token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

### Required Permissions

- `audit:read` - Required for viewing audit logs
- `audit:export` - Required for exporting audit logs
- `audit:admin` - Required for configuring integrations and scheduled reports

## API Endpoints

### 1. Get Audit Events

Retrieve filtered audit events with pagination.

**Endpoint:** `GET /api/audit/events`

**Authentication:** Required (`audit:read` permission)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| start_date | ISO 8601 datetime | No | Filter events after this date |
| end_date | ISO 8601 datetime | No | Filter events before this date |
| event_types | Array of strings | No | Filter by event types (comma-separated) |
| user_id | UUID | No | Filter by user ID |
| entity_type | String | No | Filter by entity type (project, resource, risk, etc.) |
| entity_id | UUID | No | Filter by entity ID |
| severity | String | No | Filter by severity (info, warning, error, critical) |
| categories | Array of strings | No | Filter by categories (comma-separated) |
| risk_levels | Array of strings | No | Filter by risk levels (comma-separated) |
| limit | Integer | No | Number of results per page (default: 100, max: 1000) |
| offset | Integer | No | Pagination offset (default: 0) |

**Example Request:**

```bash
curl -X GET "https://api.yourplatform.com/api/audit/events?start_date=2024-01-01T00:00:00Z&end_date=2024-01-31T23:59:59Z&severity=critical&limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "events": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "event_type": "permission_change",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "entity_type": "project",
      "entity_id": "789e0123-e89b-12d3-a456-426614174000",
      "action_details": {
        "action": "grant_admin_access",
        "target_user": "user@example.com",
        "permissions_added": ["project:admin", "budget:write"]
      },
      "severity": "critical",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "timestamp": "2024-01-15T14:30:00Z",
      "anomaly_score": 0.85,
      "is_anomaly": true,
      "category": "Security Change",
      "risk_level": "High",
      "tags": {
        "security_risk": true,
        "requires_review": true
      },
      "ai_insights": {
        "summary": "Unusual admin access grant detected",
        "impact": "High security impact - elevated permissions granted",
        "recommendations": ["Review access justification", "Verify user identity"]
      }
    }
  ],
  "total": 127,
  "limit": 50,
  "offset": 0,
  "has_more": true
}
```

**Response Codes:**

- `200 OK` - Success
- `400 Bad Request` - Invalid parameters
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions
- `500 Internal Server Error` - Server error

---

### 2. Get Audit Timeline

Retrieve audit events formatted for timeline visualization with AI-generated insights.

**Endpoint:** `GET /api/audit/timeline`

**Authentication:** Required (`audit:read` permission)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| start_date | ISO 8601 datetime | Yes | Timeline start date |
| end_date | ISO 8601 datetime | Yes | Timeline end date |
| filters | JSON object | No | Additional filters (same as /events endpoint) |

**Example Request:**

```bash
curl -X GET "https://api.yourplatform.com/api/audit/timeline?start_date=2024-01-01T00:00:00Z&end_date=2024-01-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "timeline": [
    {
      "timestamp": "2024-01-15T14:30:00Z",
      "events": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "event_type": "permission_change",
          "severity": "critical",
          "category": "Security Change",
          "risk_level": "High",
          "summary": "Admin access granted to user@example.com",
          "anomaly_score": 0.85,
          "is_anomaly": true,
          "ai_tags": ["Security Risk", "Requires Review"]
        }
      ]
    }
  ],
  "statistics": {
    "total_events": 127,
    "anomalies_detected": 5,
    "critical_events": 12,
    "high_risk_events": 23
  }
}
```

---

### 3. Get Anomalies

Retrieve detected anomalies with details and scores.

**Endpoint:** `GET /api/audit/anomalies`

**Authentication:** Required (`audit:read` permission)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| start_date | ISO 8601 datetime | No | Filter anomalies after this date |
| end_date | ISO 8601 datetime | No | Filter anomalies before this date |
| min_score | Float | No | Minimum anomaly score (default: 0.7, range: 0-1) |
| limit | Integer | No | Number of results (default: 50, max: 500) |

**Example Request:**

```bash
curl -X GET "https://api.yourplatform.com/api/audit/anomalies?min_score=0.8&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "anomalies": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "audit_event_id": "550e8400-e29b-41d4-a716-446655440000",
      "anomaly_score": 0.92,
      "detection_timestamp": "2024-01-15T14:31:00Z",
      "model_version": "isolation-forest-v1.2",
      "is_false_positive": false,
      "alert_sent": true,
      "audit_event": {
        "event_type": "permission_change",
        "severity": "critical",
        "timestamp": "2024-01-15T14:30:00Z"
      },
      "explanation": {
        "top_features": [
          {"feature": "unusual_time_of_day", "contribution": 0.35},
          {"feature": "rare_event_type", "contribution": 0.28},
          {"feature": "high_privilege_escalation", "contribution": 0.29}
        ],
        "summary": "This event is unusual due to occurring outside normal business hours and involving high-privilege access changes."
      },
      "suggested_actions": [
        "Verify user identity and authorization",
        "Review access logs for suspicious activity",
        "Contact security team if unauthorized"
      ]
    }
  ],
  "total": 5
}
```

---

### 4. Semantic Search

Perform natural language search over audit logs using RAG.

**Endpoint:** `POST /api/audit/search`

**Authentication:** Required (`audit:read` permission)

**Request Body:**

```json
{
  "query": "Show me all budget changes last week that exceeded 10%",
  "filters": {
    "start_date": "2024-01-08T00:00:00Z",
    "end_date": "2024-01-15T23:59:59Z"
  },
  "limit": 10
}
```

**Example Request:**

```bash
curl -X POST "https://api.yourplatform.com/api/audit/search" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Show me all budget changes last week that exceeded 10%",
    "limit": 10
  }'
```

**Example Response:**

```json
{
  "query": "Show me all budget changes last week that exceeded 10%",
  "ai_response": "I found 3 significant budget changes in the past week that exceeded 10% of project budgets. The largest change was a 15% increase to Project Alpha's budget on January 12th, approved by John Smith. Two other projects (Beta and Gamma) had budget increases of 12% and 11% respectively.",
  "results": [
    {
      "event": {
        "id": "770e8400-e29b-41d4-a716-446655440000",
        "event_type": "budget_change",
        "timestamp": "2024-01-12T10:15:00Z",
        "action_details": {
          "project": "Project Alpha",
          "old_budget": 1000000,
          "new_budget": 1150000,
          "change_percentage": 15
        }
      },
      "similarity_score": 0.94,
      "relevance_explanation": "This event directly matches your query - it's a budget change from last week that exceeded 10%"
    }
  ],
  "sources": [
    {
      "event_id": "770e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2024-01-12T10:15:00Z",
      "excerpt": "Budget increased by 15% for Project Alpha"
    }
  ],
  "total_results": 3
}
```

---

### 5. Get Audit Summary

Generate AI-powered summary of audit events for a time period.

**Endpoint:** `GET /api/audit/summary/{period}`

**Authentication:** Required (`audit:read` permission)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| period | String | Yes | Time period: `daily`, `weekly`, or `monthly` |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filters | JSON object | No | Additional filters |

**Example Request:**

```bash
curl -X GET "https://api.yourplatform.com/api/audit/summary/weekly" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "period": "weekly",
  "start_date": "2024-01-08T00:00:00Z",
  "end_date": "2024-01-15T23:59:59Z",
  "statistics": {
    "total_events": 1247,
    "critical_changes": 12,
    "budget_updates": 8,
    "security_events": 15,
    "anomalies_detected": 5
  },
  "top_users": [
    {"user_id": "123e4567-e89b-12d3-a456-426614174000", "name": "John Smith", "event_count": 87},
    {"user_id": "223e4567-e89b-12d3-a456-426614174000", "name": "Jane Doe", "event_count": 65}
  ],
  "top_event_types": [
    {"event_type": "user_login", "count": 342},
    {"event_type": "resource_assignment", "count": 156}
  ],
  "category_breakdown": {
    "Security Change": 45,
    "Financial Impact": 23,
    "Resource Allocation": 178,
    "Risk Event": 34,
    "Compliance Action": 12
  },
  "ai_insights": "This week showed normal activity levels with a slight increase in resource allocation events. Five anomalies were detected, primarily related to unusual access patterns. Budget changes were within expected ranges. Security events included 3 failed login attempts and 2 permission escalations that require review.",
  "trend_analysis": {
    "event_volume_trend": "stable",
    "anomaly_rate_trend": "increasing",
    "key_findings": [
      "Resource allocation activity increased 15% compared to previous week",
      "Security events decreased 8%",
      "Budget change frequency remained stable"
    ]
  }
}
```

---

### 6. Explain Event

Get AI-generated explanation for a specific audit event.

**Endpoint:** `GET /api/audit/event/{event_id}/explain`

**Authentication:** Required (`audit:read` permission)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| event_id | UUID | Yes | Audit event ID |

**Example Request:**

```bash
curl -X GET "https://api.yourplatform.com/api/audit/event/550e8400-e29b-41d4-a716-446655440000/explain" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "explanation": {
    "what_happened": "Admin access was granted to user@example.com for Project Alpha",
    "why_significant": "This event is significant because it involves elevated permissions that allow full control over project resources and budget",
    "context": "This permission change occurred outside normal business hours (2:30 AM) and was performed by a user who typically doesn't manage access controls",
    "impact_analysis": {
      "security_impact": "High - Full admin access granted",
      "business_impact": "Medium - User can now approve budgets and modify project settings",
      "compliance_impact": "Requires documentation per SOC 2 requirements"
    },
    "related_events": [
      {
        "event_id": "660e8400-e29b-41d4-a716-446655440000",
        "event_type": "user_login",
        "timestamp": "2024-01-15T14:25:00Z",
        "relationship": "Login event 5 minutes before permission change"
      }
    ],
    "recommendations": [
      "Verify this access grant was authorized",
      "Review user's recent activity for suspicious patterns",
      "Consider implementing approval workflow for admin access grants"
    ]
  }
}
```

---

### 7. Export PDF

Export filtered audit events as PDF with AI-generated summary.

**Endpoint:** `POST /api/audit/export/pdf`

**Authentication:** Required (`audit:export` permission)

**Request Body:**

```json
{
  "filters": {
    "start_date": "2024-01-01T00:00:00Z",
    "end_date": "2024-01-31T23:59:59Z",
    "severity": "critical"
  },
  "include_summary": true
}
```

**Example Request:**

```bash
curl -X POST "https://api.yourplatform.com/api/audit/export/pdf" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "start_date": "2024-01-01T00:00:00Z",
      "end_date": "2024-01-31T23:59:59Z"
    },
    "include_summary": true
  }' \
  --output audit_report.pdf
```

**Response:**

- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="audit_report_2024-01-01_2024-01-31.pdf"`
- Binary PDF file

**PDF Contents:**

1. Executive Summary (if include_summary=true)
2. Statistics and Trends
3. Detailed Event List with:
   - Timestamp
   - Event Type
   - User
   - Entity
   - Action Details
   - Anomaly Score
   - Tags
   - Risk Level
4. Trend Analysis Charts

---

### 8. Export CSV

Export filtered audit events as CSV.

**Endpoint:** `POST /api/audit/export/csv`

**Authentication:** Required (`audit:export` permission)

**Request Body:**

```json
{
  "filters": {
    "start_date": "2024-01-01T00:00:00Z",
    "end_date": "2024-01-31T23:59:59Z"
  }
}
```

**Example Request:**

```bash
curl -X POST "https://api.yourplatform.com/api/audit/export/csv" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {
      "start_date": "2024-01-01T00:00:00Z",
      "end_date": "2024-01-31T23:59:59Z"
    }
  }' \
  --output audit_export.csv
```

**Response:**

- Content-Type: `text/csv`
- Content-Disposition: `attachment; filename="audit_export_2024-01-01_2024-01-31.csv"`

**CSV Columns:**

```csv
id,timestamp,event_type,user_id,entity_type,entity_id,severity,category,risk_level,anomaly_score,is_anomaly,action_details,tags
550e8400-e29b-41d4-a716-446655440000,2024-01-15T14:30:00Z,permission_change,123e4567-e89b-12d3-a456-426614174000,project,789e0123-e89b-12d3-a456-426614174000,critical,Security Change,High,0.85,true,"{""action"":""grant_admin_access""}","{""security_risk"":true}"
```

---

### 9. Get Dashboard Stats

Get real-time statistics for audit dashboard.

**Endpoint:** `GET /api/audit/dashboard/stats`

**Authentication:** Required (`audit:read` permission)

**Example Request:**

```bash
curl -X GET "https://api.yourplatform.com/api/audit/dashboard/stats" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Example Response:**

```json
{
  "time_window": "24h",
  "event_counts": {
    "total": 1247,
    "last_hour": 52,
    "critical": 12,
    "high_risk": 23
  },
  "anomalies": {
    "total": 5,
    "unreviewed": 3,
    "false_positives": 1
  },
  "top_users": [
    {"user_id": "123e4567-e89b-12d3-a456-426614174000", "name": "John Smith", "event_count": 87},
    {"user_id": "223e4567-e89b-12d3-a456-426614174000", "name": "Jane Doe", "event_count": 65}
  ],
  "top_event_types": [
    {"event_type": "user_login", "count": 342},
    {"event_type": "resource_assignment", "count": 156},
    {"event_type": "budget_change", "count": 45}
  ],
  "category_breakdown": {
    "Security Change": 45,
    "Financial Impact": 23,
    "Resource Allocation": 178,
    "Risk Event": 34,
    "Compliance Action": 12
  },
  "event_volume_chart": [
    {"hour": "2024-01-15T00:00:00Z", "count": 42},
    {"hour": "2024-01-15T01:00:00Z", "count": 38}
  ],
  "system_health": {
    "anomaly_detection_latency_ms": 245,
    "search_response_time_ms": 1850,
    "last_model_training": "2024-01-10T03:00:00Z"
  }
}
```

---

### 10. Submit Anomaly Feedback

Submit feedback on anomaly detection for model improvement.

**Endpoint:** `POST /api/audit/anomaly/{anomaly_id}/feedback`

**Authentication:** Required (`audit:read` permission)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| anomaly_id | UUID | Yes | Anomaly detection ID |

**Request Body:**

```json
{
  "is_false_positive": true,
  "notes": "This is normal behavior for system administrators during maintenance windows"
}
```

**Example Request:**

```bash
curl -X POST "https://api.yourplatform.com/api/audit/anomaly/660e8400-e29b-41d4-a716-446655440000/feedback" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_false_positive": true,
    "notes": "Normal maintenance activity"
  }'
```

**Example Response:**

```json
{
  "success": true,
  "anomaly_id": "660e8400-e29b-41d4-a716-446655440000",
  "feedback_recorded": true,
  "message": "Thank you for your feedback. This will help improve our anomaly detection model."
}
```

---

### 11. Configure Integration

Configure external integration for audit alerts.

**Endpoint:** `POST /api/audit/integrations/configure`

**Authentication:** Required (`audit:admin` permission)

**Request Body:**

```json
{
  "integration_type": "slack",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "channel": "#security-alerts",
    "min_severity": "high"
  }
}
```

**Supported Integration Types:**

- `slack` - Slack webhook notifications
- `teams` - Microsoft Teams webhook notifications
- `zapier` - Zapier webhook triggers
- `email` - Email notifications

**Example Request (Slack):**

```bash
curl -X POST "https://api.yourplatform.com/api/audit/integrations/configure" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "integration_type": "slack",
    "config": {
      "webhook_url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
      "channel": "#security-alerts",
      "min_severity": "high"
    }
  }'
```

**Example Request (Email):**

```bash
curl -X POST "https://api.yourplatform.com/api/audit/integrations/configure" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "integration_type": "email",
    "config": {
      "recipients": ["security@example.com", "admin@example.com"],
      "min_severity": "critical"
    }
  }'
```

**Example Response:**

```json
{
  "success": true,
  "integration_id": "880e8400-e29b-41d4-a716-446655440000",
  "integration_type": "slack",
  "is_active": true,
  "validation_result": {
    "webhook_reachable": true,
    "test_notification_sent": true
  }
}
```

---

## Rate Limiting

All API endpoints are rate-limited to prevent abuse:

- **Standard endpoints**: 100 requests per minute per user
- **Export endpoints**: 10 requests per minute per user
- **Search endpoints**: 30 requests per minute per user

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642262400
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "INVALID_FILTER",
    "message": "Invalid date range: end_date must be after start_date",
    "details": {
      "field": "end_date",
      "provided_value": "2024-01-01T00:00:00Z"
    }
  }
}
```

**Common Error Codes:**

- `UNAUTHORIZED` - Missing or invalid authentication token
- `FORBIDDEN` - Insufficient permissions
- `INVALID_FILTER` - Invalid filter parameters
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `ANOMALY_DETECTION_FAILED` - ML service error
- `EXPORT_GENERATION_FAILED` - Export service error
- `INTEGRATION_DELIVERY_FAILED` - Webhook delivery error

---

## WebSocket API

For real-time updates, connect to the WebSocket endpoint:

**Endpoint:** `wss://api.yourplatform.com/api/audit/ws`

**Authentication:** Include JWT token in connection query parameter:

```javascript
const ws = new WebSocket('wss://api.yourplatform.com/api/audit/ws?token=YOUR_JWT_TOKEN');
```

**Message Types:**

1. **New Anomaly Alert:**

```json
{
  "type": "anomaly_detected",
  "data": {
    "anomaly_id": "660e8400-e29b-41d4-a716-446655440000",
    "anomaly_score": 0.92,
    "severity": "critical",
    "event_summary": "Unusual admin access grant detected"
  }
}
```

2. **Dashboard Stats Update:**

```json
{
  "type": "stats_update",
  "data": {
    "total_events": 1248,
    "anomalies": 6,
    "last_updated": "2024-01-15T14:35:00Z"
  }
}
```

---

## SDK Examples

### Python SDK

```python
from audit_client import AuditClient

# Initialize client
client = AuditClient(
    api_url="https://api.yourplatform.com",
    api_key="YOUR_JWT_TOKEN"
)

# Get audit events
events = client.get_events(
    start_date="2024-01-01T00:00:00Z",
    end_date="2024-01-31T23:59:59Z",
    severity="critical"
)

# Semantic search
results = client.search(
    query="Show me all budget changes last week"
)

# Export PDF
client.export_pdf(
    filters={"start_date": "2024-01-01T00:00:00Z"},
    output_file="audit_report.pdf"
)
```

### JavaScript SDK

```javascript
import { AuditClient } from '@yourplatform/audit-sdk';

// Initialize client
const client = new AuditClient({
  apiUrl: 'https://api.yourplatform.com',
  apiKey: 'YOUR_JWT_TOKEN'
});

// Get audit events
const events = await client.getEvents({
  startDate: '2024-01-01T00:00:00Z',
  endDate: '2024-01-31T23:59:59Z',
  severity: 'critical'
});

// Semantic search
const results = await client.search({
  query: 'Show me all budget changes last week'
});

// Export PDF
await client.exportPdf({
  filters: { startDate: '2024-01-01T00:00:00Z' },
  outputFile: 'audit_report.pdf'
});
```

---

## Best Practices

### 1. Filtering

- Always specify date ranges to limit result sets
- Use pagination for large result sets
- Combine multiple filters for precise queries

### 2. Semantic Search

- Use natural language queries for best results
- Be specific about time periods and entities
- Review source references for accuracy

### 3. Exports

- Schedule large exports during off-peak hours
- Use filters to limit export size
- Include AI summaries for executive reports

### 4. Integrations

- Test webhook URLs before saving configurations
- Set appropriate severity thresholds to avoid alert fatigue
- Monitor integration delivery success rates

### 5. Performance

- Cache frequently accessed data
- Use WebSocket for real-time updates instead of polling
- Batch operations when possible

---

## Support

For API support, contact:
- Email: api-support@yourplatform.com
- Documentation: https://docs.yourplatform.com/audit-api
- Status Page: https://status.yourplatform.com
