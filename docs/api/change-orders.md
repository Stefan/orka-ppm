# Change Orders API Documentation

## Overview

The Change Orders API provides formal change order management for construction/engineering PPM projects. It supports CRUD operations, cost impact analysis, approval workflows, contract integration, and analytics.

## Base URL

```
Production: https://orka-ppm.onrender.com
Development: http://localhost:8000
```

## Authentication

All endpoints require a valid JWT token in the Authorization header. The frontend obtains this from the Supabase session.

```http
Authorization: Bearer <supabase_access_token>
```

### Required Permissions

- `change_read` - List and view change orders
- `change_create` - Create change orders
- `change_update` - Update draft change orders, submit
- `change_approve` - Approve or reject change orders

---

## Change Orders Router (`/change-orders`)

### Create Change Order

**Endpoint:** `POST /change-orders/`

**Request Body:**

```json
{
  "project_id": "uuid",
  "title": "Change order title",
  "description": "Detailed description",
  "justification": "Business justification",
  "change_category": "owner_directed|design_change|field_condition|regulatory",
  "change_source": "owner|designer|contractor|regulatory_agency",
  "impact_type": ["cost", "schedule", "scope", "quality"],
  "priority": "low|medium|high|critical",
  "original_contract_value": 1000000,
  "proposed_schedule_impact_days": 10,
  "contract_reference": "optional",
  "line_items": [
    {
      "description": "Line item description",
      "trade_category": "Electrical",
      "unit_of_measure": "HR",
      "quantity": 40,
      "unit_rate": 85,
      "markup_percentage": 10,
      "overhead_percentage": 15,
      "contingency_percentage": 5,
      "cost_category": "labor|material|equipment|subcontract|other",
      "is_add": true
    }
  ]
}
```

### List Change Orders

**Endpoint:** `GET /change-orders/{project_id}`

**Query Parameters:** `status`, `category`, `date_range`

### Get Change Order Details

**Endpoint:** `GET /change-orders/details/{change_order_id}`

Returns change order with line items.

### Update Change Order

**Endpoint:** `PUT /change-orders/{change_order_id}`

Only draft change orders can be updated.

### Submit Change Order

**Endpoint:** `POST /change-orders/{change_order_id}/submit`

Transitions status from draft to submitted.

### Cost Impact Analysis

**Endpoint:** `POST /change-orders/{change_order_id}/cost-analysis`

**Endpoint:** `GET /change-orders/{change_order_id}/cost-analysis`

**Endpoint:** `POST /change-orders/{change_order_id}/cost-scenarios`

---

## Change Approvals Router (`/change-approvals`)

### Initiate Approval Workflow

**Endpoint:** `POST /change-approvals/workflow/{change_order_id}`

### Get Pending Approvals

**Endpoint:** `GET /change-approvals/pending/{user_id}`

### Approve / Reject

**Endpoint:** `POST /change-approvals/approve/{approval_id}`

**Endpoint:** `POST /change-approvals/reject/{approval_id}`

### Workflow Status

**Endpoint:** `GET /change-approvals/workflow-status/{change_order_id}`

---

## Contract Integration Router (`/contract-integration`)

### Validate Compliance

**Endpoint:** `POST /contract-integration/validate/{change_order_id}`

### Get Provisions

**Endpoint:** `GET /contract-integration/provisions/{project_id}`

### Apply Contract Pricing

**Endpoint:** `POST /contract-integration/pricing/{change_order_id}`

---

## Change Analytics Router (`/change-analytics`)

### Metrics

**Endpoint:** `GET /change-analytics/metrics/{project_id}?period=project_to_date`

### Trends

**Endpoint:** `GET /change-analytics/trends/{project_id}?period_months=12`

### Dashboard

**Endpoint:** `GET /change-analytics/dashboard/{project_id}`

### Generate Report

**Endpoint:** `POST /change-analytics/reports/{project_id}`

---

## Response Codes

- `200 OK` - Success
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `422 Unprocessable Entity` - Invalid request body
- `500 Internal Server Error` - Server error
