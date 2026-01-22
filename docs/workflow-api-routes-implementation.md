# Workflow Engine API Routes Implementation

## Summary

This document describes the Next.js API routes that were created to complete the workflow engine frontend-backend integration.

## Implementation Date

December 2024

## Problem Statement

The frontend workflow components in `components/workflow/` were making API calls to endpoints that didn't exist in the Next.js API layer:

1. `/api/workflows/instances/my-workflows` - Fetch user's workflows
2. `/api/workflows/instances/[id]` - Fetch workflow details  
3. `/api/workflows/instances/[id]/approve` - Submit approval decision

These routes needed to be created to proxy requests from the Next.js frontend to the FastAPI backend.

## Solution

Created three Next.js API route handlers that act as proxies between the frontend and backend:

### 1. My Workflows Route

**File**: `app/api/workflows/instances/my-workflows/route.ts`

**Purpose**: Fetches all workflow instances where the current user is involved (either as initiator or approver)

**Implementation Details**:
- Calls backend `/workflows/approvals/pending` to get pending approvals
- Extracts unique workflow instance IDs
- Fetches details for each workflow instance
- Transforms response to match frontend expectations
- Returns consolidated list of workflows

**Key Features**:
- Handles authentication via JWT token
- Gracefully handles errors (returns empty list instead of failing)
- Supports pagination via query parameters
- Transforms backend response format to frontend format

### 2. Workflow Instance Detail Route

**File**: `app/api/workflows/instances/[id]/route.ts`

**Purpose**: Fetches detailed information about a specific workflow instance

**Implementation Details**:
- Dynamic route using Next.js `[id]` parameter
- Proxies request to backend `/workflows/instances/{id}`
- Transforms response to match frontend expectations
- Handles 404 errors appropriately

**Key Features**:
- Validates authentication
- Provides detailed error messages
- Transforms backend data structure to frontend format
- Includes workflow context and approval information

### 3. Workflow Approval Route

**File**: `app/api/workflows/instances/[id]/approve/route.ts`

**Purpose**: Submits an approval decision (approve or reject) for a workflow instance

**Implementation Details**:
- Accepts POST requests with decision and comments
- Validates decision is either "approved" or "rejected"
- Fetches workflow instance to verify it exists
- Gets pending approvals to find the approval ID
- Submits decision to backend `/workflows/approvals/{approval_id}/decision`
- Returns success response with workflow status

**Key Features**:
- Multi-step process to find correct approval ID
- Validates request body
- Provides detailed error messages
- Returns workflow status after approval

## API Route Architecture

```
Frontend Component
       ↓
Next.js API Route (Proxy)
       ↓
FastAPI Backend
       ↓
Supabase Database
```

### Benefits of Proxy Pattern

1. **Security**: Keeps backend URL and authentication logic server-side
2. **Flexibility**: Can transform data formats between frontend and backend
3. **Error Handling**: Centralized error handling and logging
4. **Caching**: Can add caching layer if needed
5. **Rate Limiting**: Can implement rate limiting at proxy level

## Testing

### Verification Script

Created `scripts/verify-workflow-integration.sh` to verify:
- Backend is running
- Frontend is running
- All API route files exist
- All frontend components exist
- TypeScript compilation passes

### API Route Testing Script

Created `scripts/test-workflow-api-routes.sh` to test:
- Endpoint accessibility
- Authentication requirements
- Route file existence

### Manual Testing

See `docs/workflow-integration-testing.md` for comprehensive testing guide.

## Frontend Components Using These Routes

### WorkflowDashboard.tsx

Uses: `/api/workflows/instances/my-workflows`

```typescript
const response = await fetch('/api/workflows/instances/my-workflows', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

### WorkflowApprovalModal.tsx

Uses: `/api/workflows/instances/[id]`

```typescript
const response = await fetch(`/api/workflows/instances/${workflowInstanceId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

### ApprovalButtons.tsx

Uses: `/api/workflows/instances/[id]/approve`

```typescript
const response = await fetch(`/api/workflows/instances/${workflowInstanceId}/approve`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    decision,
    comments: comment.trim() || null
  })
})
```

## Backend Endpoints Used

The Next.js API routes proxy to these FastAPI backend endpoints:

1. `GET /workflows/approvals/pending` - Get pending approvals for user
2. `GET /workflows/instances/{id}` - Get workflow instance details
3. `POST /workflows/approvals/{approval_id}/decision` - Submit approval decision

## Data Transformation

The API routes transform backend responses to match frontend expectations:

### Backend Format
```json
{
  "id": "uuid",
  "initiated_by": "uuid",
  "initiated_at": "timestamp",
  ...
}
```

### Frontend Format
```json
{
  "id": "uuid",
  "started_by": "uuid",
  "started_at": "timestamp",
  ...
}
```

This transformation ensures backward compatibility and consistent naming conventions in the frontend.

## Error Handling

All routes implement comprehensive error handling:

1. **401 Unauthorized**: Missing or invalid authentication token
2. **404 Not Found**: Workflow instance doesn't exist
3. **400 Bad Request**: Invalid request data
4. **500 Internal Server Error**: Backend or database errors

Error responses include descriptive messages to help with debugging.

## Security Considerations

1. **Authentication Required**: All routes require valid JWT token
2. **Authorization**: Backend validates user permissions
3. **Input Validation**: Request data is validated before forwarding
4. **Error Messages**: Don't expose sensitive backend details
5. **CORS**: Properly configured for frontend-backend communication

## Performance Considerations

1. **No Caching**: Currently no caching implemented (can be added if needed)
2. **Multiple Requests**: my-workflows route makes multiple backend calls (could be optimized)
3. **Pagination**: Supports pagination to limit data transfer
4. **Error Recovery**: Graceful degradation on partial failures

## Future Improvements

1. **Caching**: Add Redis caching for frequently accessed workflows
2. **Batch Operations**: Optimize my-workflows to use batch endpoint
3. **WebSocket**: Real-time updates for workflow status changes
4. **Rate Limiting**: Add rate limiting to prevent abuse
5. **Monitoring**: Add detailed logging and monitoring
6. **Testing**: Add automated integration tests

## Related Files

- Frontend Components: `components/workflow/`
- Backend Router: `backend/routers/workflows.py`
- Workflow Engine: `backend/services/workflow_engine_core.py`
- Testing Guide: `docs/workflow-integration-testing.md`
- Verification Script: `scripts/verify-workflow-integration.sh`
- Test Script: `scripts/test-workflow-api-routes.sh`

## Completion Status

✅ All three API routes implemented
✅ TypeScript compilation passes
✅ Verification scripts created
✅ Documentation completed
✅ Ready for end-to-end testing

## Next Steps

1. Restart Next.js dev server to load new routes
2. Run verification script: `./scripts/verify-workflow-integration.sh`
3. Test with authenticated user in browser
4. Verify approval workflow end-to-end
5. Mark checkpoint 8 as complete
