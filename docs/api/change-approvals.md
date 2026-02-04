# Change Approvals API

See [change-orders.md](./change-orders.md) for full API documentation. Key approval endpoints:

- `POST /change-approvals/workflow/{change_order_id}` - Initiate workflow
- `GET /change-approvals/pending/{user_id}` - Pending approvals
- `POST /change-approvals/approve/{approval_id}` - Approve
- `POST /change-approvals/reject/{approval_id}` - Reject
- `GET /change-approvals/workflow-status/{change_order_id}` - Workflow status
