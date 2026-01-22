# AI-Empowered PPM Features - API Documentation

## Overview

This document provides comprehensive API documentation for all AI-empowered PPM features, including:
- AI Agent endpoints (RAG Reporter, Resource Optimizer, Risk Forecaster, Data Validator)
- Workflow Engine endpoints
- Bulk Import endpoints
- Audit Management endpoints (Anomaly Detection, RAG Search, Export)
- RBAC Management endpoints

All endpoints require JWT authentication and enforce organization-level data isolation.

## Table of Contents

1. [Authentication](#authentication)
2. [AI Agent Endpoints](#ai-agent-endpoints)
3. [Workflow Engine Endpoints](#workflow-engine-endpoints)
4. [Bulk Import Endpoints](#bulk-import-endpoints)
5. [Audit Management Endpoints](#audit-management-endpoints)
6. [RBAC Management Endpoints](#rbac-management-endpoints)
7. [Error Responses](#error-responses)
8. [Rate Limiting](#rate-limiting)

---

## Authentication

All API endpoints require JWT authentication via the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

The JWT token must contain:
- `user_id`: Unique identifier for the user
- `organization_id`: Organization the user belongs to
- `roles`: Array of user roles (admin, manager, member, viewer)

### Authentication Errors

**401 Unauthorized**: Missing or invalid JWT token
```json
{
  "error": "unauthorized",
  "message": "Invalid or expired authentication token"
}
```

**403 Forbidden**: Insufficient permissions
```json
{
  "error": "forbidden",
  "message": "You don't have permission to access this resource"
}
```

---

## AI Agent Endpoints

### 1. RAG Reporter Agent

Generate AI-powered reports using natural language queries.

#### POST /api/reports/adhoc

**Request:**
```json
{
  "query": "What is the total budget for active projects?"
}
```

**Response:**
```json
{
  "response": "Based on the current data, the total budget for active projects is $2,450,000 across 12 projects.",
  "confidence": 0.92,
  "sources": [
    {
      "type": "project",
      "id": "uuid",
      "name": "Project Alpha",
      "relevance": 0.95
    }
  ],
  "timestamp": "2024-01-20T10:30:00Z"
}
```

**Parameters:**
- `query` (string, required): Natural language query (1-1000 characters)

**Response Fields:**
- `response` (string): AI-generated answer
- `confidence` (float): Confidence score (0.0-1.0)
- `sources` (array): Data sources used for the response
- `timestamp` (string): ISO 8601 timestamp

**Error Responses:**
- `422 Validation Error`: Invalid query format
- `503 Service Unavailable`: AI service temporarily unavailable
- `500 Internal Server Error`: Unexpected error

**Example Usage:**
```bash
curl -X POST https://api.example.com/api/reports/adhoc \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me projects over budget"}'
```

---

### 2. Resource Optimizer Agent

Optimize resource allocations to minimize costs while satisfying project constraints.

#### POST /api/agents/optimize-resources

**Request:**
```json
{
  "constraints": {
    "max_hours_per_resource": 40,
    "required_skills": ["python", "react"]
  }
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "resource_id": "uuid",
      "resource_name": "John Doe",
      "project_id": "uuid",
      "project_name": "Project Alpha",
      "allocated_hours": 32.5,
      "cost_savings": 1250.00,
      "confidence": 0.88
    }
  ],
  "total_cost_savings": 5600.00,
  "model_confidence": 0.85,
  "constraints_satisfied": true
}
```

**Parameters:**
- `constraints` (object, optional): Custom optimization constraints

**Response Fields:**
- `recommendations` (array): List of resource allocation recommendations
- `total_cost_savings` (float): Total estimated cost savings
- `model_confidence` (float): Overall model confidence (0.0-1.0)
- `constraints_satisfied` (boolean): Whether all constraints were met

**Error Responses:**
- `400 Bad Request`: Insufficient data for optimization
- `422 Validation Error`: Invalid constraints format

**Example Usage:**
```bash
curl -X POST https://api.example.com/api/agents/optimize-resources \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

### 3. Risk Forecaster Agent

Forecast project risks using ARIMA time series analysis.

#### POST /api/agents/forecast-risks

**Request:**
```json
{
  "project_id": "uuid",
  "forecast_periods": 12
}
```

**Response:**
```json
{
  "forecasts": [
    {
      "period": "2024-02",
      "risk_probability": 0.35,
      "risk_impact": 7.2,
      "confidence_lower": 0.25,
      "confidence_upper": 0.45
    }
  ],
  "model_confidence": 0.82,
  "model_metrics": {
    "aic": 145.2,
    "rmse": 0.08
  }
}
```

**Parameters:**
- `project_id` (string, optional): Specific project to forecast (null for all)
- `forecast_periods` (integer, optional): Number of periods to forecast (1-24, default: 12)

**Response Fields:**
- `forecasts` (array): Risk forecasts for each period
- `model_confidence` (float): Model confidence (0.0-1.0)
- `model_metrics` (object): Statistical model metrics

**Error Responses:**
- `400 Bad Request`: Insufficient historical data (minimum 10 data points required)

**Example Usage:**
```bash
curl -X POST https://api.example.com/api/agents/forecast-risks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"forecast_periods": 6}'
```

---

### 4. Data Validator Agent

Validate data integrity and detect inconsistencies.

#### POST /api/agents/validate-data

**Request:**
```json
{
  "validation_scope": "all"
}
```

**Response:**
```json
{
  "issues": [
    {
      "severity": "HIGH",
      "category": "financial",
      "entity_type": "project",
      "entity_id": "uuid",
      "description": "Budget overrun: actual cost $125,000 exceeds budget $100,000 by 25%",
      "recommendation": "Review project expenses and adjust budget or reduce scope"
    }
  ],
  "total_issues": 15,
  "critical_count": 2,
  "high_count": 5,
  "medium_count": 6,
  "low_count": 2
}
```

**Parameters:**
- `validation_scope` (string, optional): Scope of validation
  - `all`: All validations (default)
  - `financials`: Financial data only
  - `timelines`: Timeline data only
  - `integrity`: Data integrity only

**Response Fields:**
- `issues` (array): List of detected issues
- `total_issues` (integer): Total number of issues
- `critical_count`, `high_count`, `medium_count`, `low_count` (integer): Issue counts by severity

**Example Usage:**
```bash
curl -X POST https://api.example.com/api/agents/validate-data \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"validation_scope": "financials"}'
```

---

## Workflow Engine Endpoints

### 1. Create/Update Workflow Approval

Submit an approval decision for a workflow.

#### POST /api/workflows/approve-project

**Request:**
```json
{
  "workflow_id": "uuid",
  "entity_type": "project",
  "entity_id": "uuid",
  "decision": "approved",
  "comments": "Looks good, approved"
}
```

**Response:**
```json
{
  "instance_id": "uuid",
  "status": "pending",
  "current_step": 1,
  "message": "Approval submitted successfully"
}
```

**Parameters:**
- `workflow_id` (string, required): Workflow definition ID
- `entity_type` (string, required): Type of entity (project, change_request, etc.)
- `entity_id` (string, required): Entity ID
- `decision` (string, required): "approved" or "rejected"
- `comments` (string, optional): Approval comments (max 1000 characters)

**Example Usage:**
```bash
curl -X POST https://api.example.com/api/workflows/approve-project \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "uuid",
    "entity_type": "project",
    "entity_id": "uuid",
    "decision": "approved"
  }'
```

---

### 2. Get Workflow Instance Status

Retrieve the current status of a workflow instance.

#### GET /api/workflows/instances/{instance_id}

**Response:**
```json
{
  "id": "uuid",
  "workflow_name": "Project Approval Workflow",
  "entity_type": "project",
  "entity_id": "uuid",
  "current_step": 1,
  "status": "pending",
  "steps": [
    {
      "step_number": 0,
      "name": "Manager Approval",
      "status": "approved",
      "approver_name": "John Doe",
      "decided_at": "2024-01-20T10:00:00Z",
      "comments": "Approved"
    },
    {
      "step_number": 1,
      "name": "Director Approval",
      "status": "pending",
      "approver_name": null,
      "decided_at": null,
      "comments": null
    }
  ],
  "created_at": "2024-01-20T09:00:00Z",
  "updated_at": "2024-01-20T10:00:00Z"
}
```

**Example Usage:**
```bash
curl -X GET https://api.example.com/api/workflows/instances/{instance_id} \
  -H "Authorization: Bearer <token>"
```

---

### 3. Advance Workflow

Manually advance a workflow to the next step.

#### POST /api/workflows/instances/{instance_id}/advance

**Response:**
```json
{
  "instance_id": "uuid",
  "current_step": 2,
  "status": "pending",
  "message": "Workflow advanced to next step"
}
```

**Example Usage:**
```bash
curl -X POST https://api.example.com/api/workflows/instances/{instance_id}/advance \
  -H "Authorization: Bearer <token>"
```

---

## Bulk Import Endpoints

### Import Projects/Resources/Financials

Import multiple records from CSV or JSON files.

#### POST /api/projects/import

**Request:**
- Content-Type: `multipart/form-data`
- Form fields:
  - `file`: CSV or JSON file
  - `entity_type`: "projects", "resources", or "financials"

**Response:**
```json
{
  "success_count": 45,
  "error_count": 3,
  "errors": [
    {
      "line_number": 12,
      "field": "end_date",
      "message": "end_date must be after start_date",
      "value": "2023-12-31"
    }
  ],
  "processing_time_seconds": 2.5
}
```

**CSV Format Example (Projects):**
```csv
name,description,start_date,end_date,budget,status
Project Alpha,Description,2024-01-01,2024-12-31,100000.00,active
Project Beta,Description,2024-02-01,2024-11-30,150000.00,planning
```

**JSON Format Example (Projects):**
```json
[
  {
    "name": "Project Alpha",
    "description": "Description",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "budget": 100000.00,
    "status": "active"
  }
]
```

**Error Responses:**
- `400 Bad Request`: Invalid file format
- `422 Validation Error`: Validation errors in records

**Example Usage:**
```bash
curl -X POST https://api.example.com/api/projects/import \
  -H "Authorization: Bearer <token>" \
  -F "file=@projects.csv" \
  -F "entity_type=projects"
```

---

## Audit Management Endpoints

### 1. Get Audit Logs

Retrieve audit logs with filtering.

#### GET /api/audit/logs

**Query Parameters:**
- `start_date` (string, optional): ISO 8601 date
- `end_date` (string, optional): ISO 8601 date
- `user_id` (string, optional): Filter by user
- `action_type` (string, optional): Filter by action type
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Results per page (default: 50, max: 100)

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "timestamp": "2024-01-20T10:30:00Z",
      "user_id": "uuid",
      "user_name": "John Doe",
      "action": "project_created",
      "entity_type": "project",
      "entity_id": "uuid",
      "details": {
        "name": "New Project",
        "budget": 100000
      },
      "success": true,
      "tags": ["important"]
    }
  ],
  "total": 1250,
  "page": 1,
  "pages": 25
}
```

**Example Usage:**
```bash
curl -X GET "https://api.example.com/api/audit/logs?action_type=project_created&limit=20" \
  -H "Authorization: Bearer <token>"
```

---

### 2. Tag Audit Log

Add a tag to an audit log entry.

#### POST /api/audit/logs/{log_id}/tag

**Request:**
```json
{
  "tag": "important"
}
```

**Response:**
```json
{
  "log_id": "uuid",
  "tags": ["important", "reviewed"],
  "message": "Tag added successfully"
}
```

**Parameters:**
- `tag` (string, required): Tag to add (1-50 characters)

**Example Usage:**
```bash
curl -X POST https://api.example.com/api/audit/logs/{log_id}/tag \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"tag": "important"}'
```

---

### 3. Export Audit Logs

Export audit logs in CSV or JSON format.

#### POST /api/audit/export

**Request:**
```json
{
  "format": "csv",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "action_type": "project_created"
}
```

**Response:**
- Content-Type: `text/csv` or `application/json`
- File download with filtered audit logs

**Parameters:**
- `format` (string, required): "csv" or "json"
- `start_date` (string, optional): ISO 8601 date
- `end_date` (string, optional): ISO 8601 date
- `user_id` (string, optional): Filter by user
- `action_type` (string, optional): Filter by action type

**Example Usage:**
```bash
curl -X POST https://api.example.com/api/audit/export \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"format": "csv", "start_date": "2024-01-01"}' \
  --output audit_logs.csv
```

---

### 4. Detect Anomalies

Detect anomalous activities in audit logs using machine learning.

#### POST /api/audit/detect-anomalies

**Request:**
```json
{
  "time_range_days": 30
}
```

**Response:**
```json
{
  "anomalies": [
    {
      "log_id": "uuid",
      "timestamp": "2024-01-20T03:15:00Z",
      "user_id": "uuid",
      "user_name": "John Doe",
      "action": "login_failed",
      "confidence": 0.92,
      "reason": "Unusual time of day and high frequency of failed login attempts",
      "details": {
        "failed_attempts_count": 15,
        "time_deviation": "3 hours outside normal pattern"
      }
    }
  ],
  "total_logs_analyzed": 5420,
  "anomaly_count": 8
}
```

**Parameters:**
- `time_range_days` (integer, optional): Days to analyze (1-90, default: 30)

**Example Usage:**
```bash
curl -X POST https://api.example.com/api/audit/detect-anomalies \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"time_range_days": 7}'
```

---

### 5. Search Audit Logs

Search audit logs using natural language queries.

#### POST /api/audit/search

**Request:**
```json
{
  "query": "budget changes in the last week",
  "limit": 50
}
```

**Response:**
```json
{
  "results": [
    {
      "log_id": "uuid",
      "timestamp": "2024-01-18T14:30:00Z",
      "user_name": "Jane Smith",
      "action": "budget_updated",
      "details": "Budget increased from $100,000 to $125,000 for Project Alpha",
      "relevance_score": 0.95,
      "highlighted_text": "Budget increased from $100,000 to $125,000"
    }
  ],
  "total_results": 12
}
```

**Parameters:**
- `query` (string, required): Natural language search query (1-500 characters)
- `limit` (integer, optional): Max results (1-100, default: 50)

**Example Usage:**
```bash
curl -X POST https://api.example.com/api/audit/search \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "failed login attempts"}'
```

---

## RBAC Management Endpoints

### 1. Get Available Roles

Retrieve all available roles and their permissions.

#### GET /api/admin/roles

**Response:**
```json
{
  "roles": [
    {
      "role": "admin",
      "permissions": [
        "manage_users",
        "manage_roles",
        "view_all_data",
        "edit_all_data",
        "delete_data"
      ],
      "description": "Full system access"
    },
    {
      "role": "manager",
      "permissions": [
        "view_all_data",
        "edit_projects",
        "approve_workflows"
      ],
      "description": "Project management access"
    }
  ]
}
```

**Authorization:** Requires admin role

**Example Usage:**
```bash
curl -X GET https://api.example.com/api/admin/roles \
  -H "Authorization: Bearer <token>"
```

---

### 2. Assign Role to User

Assign a role to a user.

#### POST /api/admin/users/{user_id}/roles

**Request:**
```json
{
  "role": "manager"
}
```

**Response:**
```json
{
  "user_id": "uuid",
  "roles": ["member", "manager"],
  "message": "Role assigned successfully"
}
```

**Parameters:**
- `role` (string, required): Role to assign (admin, manager, member, viewer)

**Authorization:** Requires admin role

**Example Usage:**
```bash
curl -X POST https://api.example.com/api/admin/users/{user_id}/roles \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role": "manager"}'
```

---

### 3. Remove Role from User

Remove a role from a user.

#### DELETE /api/admin/users/{user_id}/roles/{role}

**Response:**
```json
{
  "user_id": "uuid",
  "roles": ["member"],
  "message": "Role removed successfully"
}
```

**Authorization:** Requires admin role

**Example Usage:**
```bash
curl -X DELETE https://api.example.com/api/admin/users/{user_id}/roles/manager \
  -H "Authorization: Bearer <token>"
```

---

## Error Responses

All endpoints follow a consistent error response format:

```json
{
  "error": "error_type",
  "message": "Human-readable error message",
  "details": {
    "field": "Additional context"
  },
  "request_id": "uuid"
}
```

### Common Error Codes

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | bad_request | Invalid request format or parameters |
| 401 | unauthorized | Missing or invalid authentication |
| 403 | forbidden | Insufficient permissions |
| 404 | not_found | Resource not found |
| 422 | validation_error | Request validation failed |
| 429 | rate_limit_exceeded | Too many requests |
| 500 | internal_error | Server error |
| 503 | service_unavailable | Service temporarily unavailable |

### Validation Error Format

```json
{
  "error": "validation_error",
  "message": "Request validation failed",
  "details": {
    "fields": [
      {
        "field": "query",
        "message": "Field is required",
        "type": "missing"
      }
    ]
  }
}
```

---

## Rate Limiting

API endpoints are rate-limited to ensure fair usage:

- **Standard endpoints**: 100 requests per minute per user
- **AI agent endpoints**: 20 requests per minute per user
- **Import endpoints**: 5 requests per minute per user
- **Export endpoints**: 10 requests per minute per user

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705750800
```

When rate limit is exceeded:

```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again later.",
  "retry_after": 60
}
```

---

## Best Practices

1. **Error Handling**: Always check response status codes and handle errors gracefully
2. **Retry Logic**: Implement exponential backoff for failed requests
3. **Pagination**: Use pagination for large result sets
4. **Caching**: Cache responses where appropriate to reduce API calls
5. **Timeouts**: Set appropriate timeouts for long-running operations (AI agents, imports)
6. **Organization Isolation**: All data is automatically filtered by organization_id
7. **Audit Logging**: All API operations are logged for audit purposes

---

## Support

For API support, please contact:
- Email: api-support@example.com
- Documentation: https://docs.example.com
- Status Page: https://status.example.com
