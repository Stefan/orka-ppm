# Workflow Engine Frontend-Backend Integration Testing Guide

## Overview

This document describes how to test the end-to-end integration between the Next.js frontend workflow components and the FastAPI backend workflow engine.

## Prerequisites

1. **Backend Running**: FastAPI backend must be running on `http://localhost:8000`
   ```bash
   cd backend
   uvicorn main:app --reload
   ```

2. **Frontend Running**: Next.js dev server must be running on `http://localhost:3000`
   ```bash
   npm run dev
   ```

3. **Authentication**: You need a valid JWT token with appropriate permissions

## API Routes Created

The following Next.js API routes have been created to proxy requests to the FastAPI backend:

### 1. GET `/api/workflows/instances/my-workflows`

**Purpose**: Fetches workflow instances where the current user is involved (as initiator or approver)

**Frontend Usage**: Called by `WorkflowDashboard.tsx` component

**Backend Endpoints Used**:
- `GET /workflows/approvals/pending` - Get pending approvals for user
- `GET /workflows/instances/{id}` - Get details for each workflow instance

**Response Format**:
```json
{
  "workflows": [
    {
      "id": "uuid",
      "workflow_id": "uuid",
      "workflow_name": "Budget Approval",
      "entity_type": "financial_tracking",
      "entity_id": "uuid",
      "current_step": 0,
      "status": "in_progress",
      "started_by": "uuid",
      "started_at": "2024-01-01T00:00:00Z",
      "completed_at": null,
      "approvals": {
        "0": [
          {
            "id": "uuid",
            "approver_id": "uuid",
            "status": "pending",
            "comments": null,
            "approved_at": null
          }
        ]
      },
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1,
  "limit": 100,
  "offset": 0
}
```

### 2. GET `/api/workflows/instances/[id]`

**Purpose**: Fetches detailed information about a specific workflow instance

**Frontend Usage**: Called by `WorkflowApprovalModal.tsx` component

**Backend Endpoint Used**: `GET /workflows/instances/{id}`

**Response Format**:
```json
{
  "id": "uuid",
  "workflow_id": "uuid",
  "workflow_name": "Budget Approval",
  "entity_type": "financial_tracking",
  "entity_id": "uuid",
  "current_step": 0,
  "status": "in_progress",
  "started_by": "uuid",
  "started_at": "2024-01-01T00:00:00Z",
  "completed_at": null,
  "approvals": {},
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "context": {}
}
```

### 3. POST `/api/workflows/instances/[id]/approve`

**Purpose**: Submits an approval decision (approve or reject) for a workflow instance

**Frontend Usage**: Called by `ApprovalButtons.tsx` component

**Backend Endpoints Used**:
- `GET /workflows/instances/{id}` - Get workflow instance details
- `GET /workflows/approvals/pending` - Find the approval ID for the user
- `POST /workflows/approvals/{approval_id}/decision` - Submit the decision

**Request Body**:
```json
{
  "decision": "approved",  // or "rejected"
  "comments": "Looks good to me"  // optional
}
```

**Response Format**:
```json
{
  "success": true,
  "decision": "approved",
  "workflow_status": "in_progress",
  "is_complete": false,
  "current_step": 1,
  "message": "Workflow approved successfully"
}
```

## Testing Steps

### Step 1: Verify Infrastructure

Run the verification script:
```bash
./scripts/verify-workflow-integration.sh
```

This checks:
- Backend is running
- Frontend is running
- All API route files exist
- All frontend components exist
- TypeScript compilation passes

### Step 2: Manual Testing in Browser

1. **Navigate to Dashboard**
   - Open `http://localhost:3000/dashboard` in your browser
   - Ensure you're logged in with a valid user account

2. **Check Workflow Dashboard Component**
   - The `WorkflowDashboard` component should be visible
   - If you have pending approvals, they should be displayed
   - If no pending approvals, the component may not render (compact mode)

3. **Test Workflow Approval Flow**
   - Click on a pending workflow to open the approval modal
   - Review the workflow details
   - Click "Approve" or "Reject" button
   - Add optional comments
   - Submit the decision
   - Verify the workflow updates correctly

### Step 3: API Testing with curl

Test the API routes directly:

```bash
# Set your auth token
TOKEN="your-jwt-token-here"

# Test 1: Get my workflows
curl -X GET "http://localhost:3000/api/workflows/instances/my-workflows" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Test 2: Get specific workflow instance
WORKFLOW_ID="your-workflow-instance-id"
curl -X GET "http://localhost:3000/api/workflows/instances/$WORKFLOW_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Test 3: Submit approval decision
curl -X POST "http://localhost:3000/api/workflows/instances/$WORKFLOW_ID/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "decision": "approved",
    "comments": "Test approval"
  }'
```

### Step 4: Component Testing

Run the frontend component tests:
```bash
npm test -- components/workflow/__tests__/WorkflowComponents.property.test.ts
```

## Common Issues and Troubleshooting

### Issue 1: "Authorization header required"
**Solution**: Ensure you're passing a valid JWT token in the Authorization header

### Issue 2: "Backend is not running"
**Solution**: Start the FastAPI backend with `cd backend && uvicorn main:app --reload`

### Issue 3: "No pending approvals found"
**Solution**: Create a workflow instance first using the backend API or through the application

### Issue 4: "Failed to fetch workflows"
**Solution**: 
- Check backend logs for errors
- Verify database connection is working
- Ensure workflow tables exist in Supabase

### Issue 5: CORS errors
**Solution**: Ensure CORS is properly configured in the FastAPI backend to allow requests from `http://localhost:3000`

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│                                                              │
│  ┌──────────────────┐      ┌──────────────────┐            │
│  │ WorkflowDashboard│      │ ApprovalButtons  │            │
│  │   Component      │      │   Component      │            │
│  └────────┬─────────┘      └────────┬─────────┘            │
│           │                         │                       │
│           │ fetch()                 │ fetch()               │
│           ▼                         ▼                       │
│  ┌──────────────────────────────────────────────┐          │
│  │         Next.js API Routes                   │          │
│  │  /api/workflows/instances/my-workflows       │          │
│  │  /api/workflows/instances/[id]               │          │
│  │  /api/workflows/instances/[id]/approve       │          │
│  └────────────────────┬─────────────────────────┘          │
└───────────────────────┼──────────────────────────────────────┘
                        │ HTTP Proxy
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI)                          │
│                                                              │
│  ┌──────────────────────────────────────────────┐          │
│  │         Workflow Router                      │          │
│  │  GET  /workflows/approvals/pending           │          │
│  │  GET  /workflows/instances/{id}              │          │
│  │  POST /workflows/approvals/{id}/decision     │          │
│  └────────────────────┬─────────────────────────┘          │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────┐          │
│  │      Workflow Engine Core                    │          │
│  └────────────────────┬─────────────────────────┘          │
│                       │                                      │
│                       ▼                                      │
│  ┌──────────────────────────────────────────────┐          │
│  │         Supabase Database                    │          │
│  │  - workflows                                 │          │
│  │  - workflow_instances                        │          │
│  │  - workflow_approvals                        │          │
│  └──────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Success Criteria

The integration is working correctly when:

1. ✅ All API routes return 200 status codes for valid requests
2. ✅ Workflow dashboard displays pending approvals correctly
3. ✅ Clicking on a workflow opens the approval modal with correct details
4. ✅ Submitting an approval decision updates the workflow status
5. ✅ The workflow advances to the next step after approval
6. ✅ Error messages are displayed appropriately for failures
7. ✅ Authentication is enforced on all endpoints
8. ✅ No console errors in browser developer tools

## Next Steps

After verifying the integration works:

1. Test with multiple users and concurrent approvals
2. Test workflow rejection and escalation flows
3. Test workflow completion and notification delivery
4. Performance test with multiple workflow instances
5. Test error scenarios (network failures, invalid data, etc.)

## Related Documentation

- [Workflow Engine Design](../.kiro/specs/workflow-engine/design.md)
- [Workflow Engine Requirements](../.kiro/specs/workflow-engine/requirements.md)
- [Workflow Engine Tasks](../.kiro/specs/workflow-engine/tasks.md)
