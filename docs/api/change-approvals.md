# Change Approvals API

See [change-orders.md](./change-orders.md) for full API documentation. Key approval endpoints:

- `POST /change-approvals/workflow/{change_order_id}` - Initiate workflow (also called automatically on submit)
- `GET /change-approvals/pending/{user_id}` - Pending approvals for a user (includes delegated-to)
- `POST /change-approvals/approve/{approval_id}` - Approve (body: `{ "comments"?: string, "conditions"?: string }`)
- `POST /change-approvals/reject/{approval_id}` - Reject (body: `{ "comments": string, "conditions"?: string }`)
- `POST /change-approvals/delegate/{approval_id}` - Delegate (body: `{ "delegate_to_user_id": "uuid" }`); caller must be the approver or current delegate
- `GET /change-approvals/workflow-status/{change_order_id}` - Workflow status
- `GET /change-approvals/change-orders/{change_order_id}/ai-recommendations?include_variance_audit=true` - AI recommendations for the change order (optional variance audit context)

Approval levels and approvers are configurable (e.g. by cost threshold and role); see `backend/services/change_order_approval_workflow_service.py`. Pending approvals consider both `approver_user_id` and `delegated_to`.
