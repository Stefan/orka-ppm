# Change Order Workflow – Tasks

## Task 1: Backend – Status Transitions ✅

- [x] **1.1** Define allowed status transitions (draft→submitted, submitted→under_review, under_review→approved, under_review→rejected, approved→implemented) in a single place (e.g. constant map or validation function in `change_order_manager_service` or new `workflow_validation.py`).
- [x] **1.2** Add validation on every status change: when updating `change_orders.status`, check that the transition is allowed; return 400 with clear message if not.
- [x] **1.3** Ensure submit (e.g. POST /change-orders/{id}/submit or equivalent) sets status to submitted and that workflow initiation (Task 4) sets under_review; approve/reject paths already set approved/rejected.
- [x] **1.4** Optional: expose PUT /change-orders/{id}/status with body { status } for explicit transitions (still validated); otherwise keep transitions only inside submit/approve/reject logic.

**Deliverable:** Central status transition validation; all status updates go through validation; submit and workflow initiation set correct status.

---

## Task 2: Backend – Configurable Approver Routing ✅

- [x] **2.1** Introduce configurable approval levels: either a DB table (e.g. `workflow_approval_config`: project_id nullable, level, cost_threshold_max, role_name, sequence_order) or a YAML/JSON config (per project or global) defining thresholds and roles.
- [x] **2.2** In `ChangeOrderApprovalWorkflowService.initiate_workflow`, read config for the change order’s project (or default); determine number and definition of levels from proposed_cost_impact (and optionally change_category).
- [x] **2.3** Resolve approver_user_id per level from project/org role (e.g. project_manager, portfolio_manager, executive): use existing RBAC or project_roles/project_members to find a user with that role for the project or portfolio. If none found, leave approver_user_id null or use a fallback (document behavior).
- [x] **2.4** Create approval rows with correct sequence_order, is_required, approval_limit; set approver_user_id where resolved.

**Deliverable:** Approval levels and approvers driven by config; no hardcoded created_by as approver.

---

## Task 3: Backend – Delegation ✅

- [x] **3.1** Add endpoint POST (or PATCH) `/change-approvals/delegate/{approval_id}` with body `{ "delegate_to_user_id": "uuid" }`. Verify that the current user is the approver (approver_user_id or delegated_to) or has admin/change_approve and can delegate.
- [x] **3.2** Update the approval row: set delegated_to to the given user id; optionally keep approver_user_id as original for audit. Ensure get_pending_approvals and approve/reject logic consider delegated_to (delegate is allowed to approve/reject).
- [x] **3.3** Add Pydantic model for delegate request/response if needed; register route in change_approvals router.
- [ ] **3.4** Optional: trigger notification to delegate (see Task 8).

**Deliverable:** Delegation endpoint; delegated_to used for "who can act"; permission checks in place.

---

## Task 4: Backend – Submit Starts Workflow ✅

- [x] **4.1** Ensure the change order **submit** action (e.g. POST /change-orders/{id}/submit in change_orders router) sets change_orders.status to submitted and submitted_date to now.
- [x] **4.2** Immediately after submit, call `ChangeOrderApprovalWorkflowService.initiate_workflow(change_order_id, config)` so that approval rows are created.
- [x] **4.3** After workflow initiation, set change_orders.status to under_review so that the CO is clearly in approval process.
- [x] **4.4** If submit is not yet a dedicated endpoint, add it or ensure the existing update/submit path performs the above steps.

**Deliverable:** One submit action creates workflow and sets under_review; no separate manual "initiate workflow" step required (or document if both are supported).

---

## Task 5: Next.js API Proxy – Approval Endpoints ✅

- [x] **5.1** Verify or add Next.js API routes that proxy to the backend for: GET pending (for current user), POST approve, POST reject, GET workflow-status. Ensure current user id is passed for pending (from session).
- [x] **5.2** Add proxy for the new delegate endpoint: POST /api/change-approvals/delegate/[approvalId] with body delegate_to_user_id.
- [x] **5.3** Ensure auth (Bearer token or session) is forwarded to the backend on all approval calls.

**Deliverable:** All workflow-related endpoints (pending, approve, reject, workflow-status, delegate) callable via Next.js API with correct auth and current user.

---

## Task 6: Frontend – My Pending Approvals ✅

- [x] **6.1** Create a dedicated page at `/changes/pending` (or integrate into `/changes` as a tab/section) that fetches pending approvals for the current user (GET pending with current user id).
- [x] **6.2** Display a list (table or cards) with: change order number, title, proposed cost impact, due date (required_approval_date); each row/card links to the change order detail (e.g. `/changes/orders/[projectId]` with CO id or query param).
- [x] **6.3** On the change order detail page, when the current user is the approver for the next pending level, show ApprovalWorkflowTracker with Approve/Reject and comment/conditions inputs.
- [ ] **6.4** Optional: add a dashboard widget that shows count of pending approvals and a link to the pending list or to the first item.

**Deliverable:** "My Pending Approvals" page or section; navigation to CO detail; Approve/Reject available when user is approver.

---

## Task 7: Frontend – ApprovalWorkflowTracker Extensions ✅

- [x] **7.1** Show comments and conditions on each approval level (read-only for completed levels); ensure ApprovalActions (or equivalent) sends comments and conditions in approve/reject payload.
- [x] **7.2** Improve WorkflowProgress (or equivalent) to show who approved at each level and when (approval_date), and which level is current.
- [x] **7.3** Add a "Delegate" button when the current user is the responsible approver for the pending approval; clicking opens a modal to select a user (delegate_to_user_id), then call the delegate API and refresh workflow status.
- [x] **7.4** After approve/reject/delegate, refresh workflow status and parent list (e.g. refetch or invalidate cache) so the UI updates immediately.

**Deliverable:** Tracker shows full history and comments/conditions; delegate action available; UI stays in sync after actions.

---

## Task 8: Notifications (In-App)

- [ ] **8.1** When a change order is submitted and workflow is initiated, create an in-app notification for the first-level approver(s) (e.g. "Change order X needs your approval").
- [ ] **8.2** When a change order is approved or rejected, create an in-app notification for the requestor (created_by) (e.g. "Change order Y was approved/rejected").
- [ ] **8.3** When an approval is delegated, create an in-app notification for the delegate.
- [ ] **8.4** Store notifications in a table (e.g. notifications: user_id, type, title, body, read, reference_type, reference_id, created_at) and expose an API to list/unread count for the current user.
- [ ] **8.5** In the UI, show notifications via a bell icon and/or toast; optional notification center page. Optional: integrate with existing email service for email notifications.

**Deliverable:** In-app notifications for submit, approve, reject, delegate; storage and API; UI indicator and list.

---

## Task 9: Reminders

- [ ] **9.1** Implement a scheduled job (cron or background task) that finds change orders with required_approval_date within the next 24 hours (or configured window) and at least one approval still pending.
- [ ] **9.2** For each such approval, create an in-app notification (and optionally send email) to the responsible approver (approver_user_id or delegated_to) as a reminder.
- [ ] **9.3** Avoid duplicate reminders (e.g. mark reminder_sent_at on approval or log sent reminders) so the same approval is not reminded repeatedly.

**Deliverable:** Reminder job; in-app (and optional email) reminder to approvers when due date is near.

---

## Task 10: Audit Log (Optional)

- [ ] **10.1** Create a table workflow_audit_log (id, change_order_id, event_type, user_id, timestamp, payload JSONB) for workflow events: status_change, approval_created, approved, rejected, delegated.
- [ ] **10.2** In the approval service and wherever status is updated, insert a row into workflow_audit_log with event type and relevant payload (e.g. old/new status, approval_id, comments).
- [ ] **10.3** Expose GET /change-approvals/audit-log/{change_order_id} (or include in workflow-status) for viewing history; restrict by change_read or project access.

**Deliverable:** Dedicated audit log table and writes; optional read API for reporting and traceability.

---

## Summary

| Task | Description | Status |
|------|-------------|--------|
| 1 | Backend: status transition validation; only allowed transitions | ✅ Done |
| 2 | Backend: configurable approval levels and approver resolution | ✅ Done |
| 3 | Backend: delegation endpoint and delegated_to handling | ✅ Done |
| 4 | Backend: submit creates workflow and sets under_review | ✅ Done |
| 5 | Next.js: proxy all approval endpoints including delegate | ✅ Done |
| 6 | Frontend: My Pending Approvals page/widget and navigation | ✅ Done |
| 7 | Frontend: ApprovalWorkflowTracker – comments, conditions, delegate button | ✅ Done |
| 8 | In-app notifications for submit, approve, reject, delegate | Pending |
| 9 | Reminder job for due-date approach | Pending |
| 10 | Optional: workflow_audit_log table and read API | Pending |

---

## Roadmap Phases

| Phase | Scope | Tasks | Status |
|-------|--------|--------|--------|
| **MVP** | Status validation, submit→workflow, My Pending, tracker UX | 1, 2, 4, 5, 6, 7 | ✅ Done |
| **Delegation** | Delegation API and UI | 3 | ✅ Done |
| **Notifications** | In-app notifications and reminders | 8, 9 | Pending |
| **Audit** | Optional audit log | 10 | Pending |
