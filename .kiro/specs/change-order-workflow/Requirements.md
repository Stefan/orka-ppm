# Change Order Workflow – Requirements

## Overview

The change order workflow is the central part of the change order lifecycle: status transitions, multi-level approval, delegation, and notifications. Today the backend has approval tables and a workflow service; approvers are placeholders and there is no dedicated "My Pending" UI, no delegation API, and no in-app notifications. This spec focuses solely on workflow to achieve 10x better UX through clear states, configurable approval rules, a prominent "My Pending Approvals" view, delegation, and notifications.

---

## 1. Status Lifecycle

| ID | Requirement | Priority |
|----|-------------|----------|
| R1.1 | Change order status SHALL follow: **draft** → **submitted** → **under_review** → **approved** or **rejected**; from **approved** → **implemented**. | Must |
| R1.2 | Only valid transitions SHALL be allowed; the backend SHALL validate every status change and reject invalid transitions. | Must |
| R1.3 | Valid transitions: draft→submitted (submit), submitted→under_review (workflow initiated), under_review→approved (all required approvals done), under_review→rejected (any reject), approved→implemented (mark implemented). | Must |
| R1.4 | Rejected and implemented SHALL be terminal for workflow purposes; draft MAY be edited and resubmitted. | Must |

---

## 2. Approval Workflow

| ID | Requirement | Priority |
|----|-------------|----------|
| R2.1 | Approval SHALL be **multi-level** and **sequential**: Level 1 must be approved before Level 2 is active; all required levels (is_required=true) SHALL be approved for the change order to become approved. | Must |
| R2.2 | Routing SHALL be based on **proposed_cost_impact** (and optionally change_category); higher value SHALL require more approval levels. | Must |
| R2.3 | When any approval is **rejected**, the change order status SHALL be set to rejected and the workflow SHALL be considered ended; no further approvals SHALL be processed. | Must |
| R2.4 | When all required approvals have status approved, the change order status SHALL be set to approved and approved_date SHALL be set. | Must |
| R2.5 | Approval records SHALL store: approval_level, approver_user_id, status (pending | approved | rejected), approval_date, comments, conditions, sequence_order, is_required. | Must |

---

## 3. Approver Assignment

| ID | Requirement | Priority |
|----|-------------|----------|
| R3.1 | Approver per level SHALL be determined from **project/role context** (e.g. project manager, portfolio manager, executive), not a placeholder such as created_by. | Must |
| R3.2 | Approval level thresholds SHALL be **configurable** (e.g. Level 1 up to 50k, Level 2 up to 200k, Level 3 unlimited) with associated roles. | Must |
| R3.3 | The system SHALL resolve approver_user_id for each level from the project's assigned roles or organization RBAC. | Must |
| R3.4 | If no user can be resolved for a role, the workflow SHALL still be created with the role name; assignment MAY be manual or via delegation. | Should |

---

## 4. My Pending Approvals

| ID | Requirement | Priority |
|----|-------------|----------|
| R4.1 | A user SHALL be able to retrieve a list of all approvals assigned to them that are **pending** (existing GET /change-approvals/pending/{user_id}). | Must |
| R4.2 | The UI SHALL display this list prominently: either a dedicated **"My Pending Approvals"** page or a dashboard widget with link to the change order. | Must |
| R4.3 | Each list entry SHALL show at least: change order number, title, proposed cost impact, due date (required_approval_date), and a link to open the change order detail. | Must |
| R4.4 | When the current user is the approver (or delegate), the change order detail SHALL show Approve/Reject actions and comment/conditions inputs. | Must |

---

## 5. Delegation

| ID | Requirement | Priority |
|----|-------------|----------|
| R5.1 | An approver SHALL be able to **delegate** their pending approval to another user; the database SHALL store delegated_to (existing column). | Must |
| R5.2 | The API SHALL provide an endpoint to delegate (e.g. POST /change-approvals/delegate/{approval_id} with body delegate_to_user_id). | Must |
| R5.3 | Only the current approver (approver_user_id or delegated_to) or an admin SHALL be allowed to delegate. | Must |
| R5.4 | After delegation, the delegate SHALL be treated as responsible for that approval (e.g. they receive "My Pending" and can approve/reject). | Must |
| R5.5 | Delegation SHALL be optional; if not implemented in MVP, the requirement may be deferred. | Could |

---

## 6. Notifications

| ID | Requirement | Priority |
|----|-------------|----------|
| R6.1 | When a change order is **submitted**, the first-level approver(s) SHALL be notified (in-app and optionally email). | Should |
| R6.2 | When a change order is **approved** or **rejected**, the requestor (created_by) SHALL be notified. | Should |
| R6.3 | When an approval is **delegated**, the delegate SHALL be notified. | Should |
| R6.4 | **Reminders** SHALL be sent (in-app, optionally email) to the responsible approver when required_approval_date is within a configured window (e.g. 24 hours). | Could |
| R6.5 | Notifications SHALL be stored (e.g. notifications table) and displayed in-app (bell icon, toast, or notification center). | Should |

---

## 7. Audit and Traceability

| ID | Requirement | Priority |
|----|-------------|----------|
| R7.1 | Every status change and every approval/rejection SHALL be recorded with **timestamp** and **user** (already in change_order_approvals; change_orders.updated_at). | Must |
| R7.2 | Approval records SHALL retain comments and conditions for audit. | Must |
| R7.3 | A dedicated **workflow_audit_log** table (change_order_id, event_type, user_id, timestamp, payload) MAY be used for easier querying and reporting. | Could |

---

## 8. UI – Workflow Display

| ID | Requirement | Priority |
|----|-------------|----------|
| R8.1 | The **ApprovalWorkflowTracker** (or equivalent) SHALL display the current workflow status, approval levels, and which level is pending or complete. | Must |
| R8.2 | The UI SHALL show **Approve** and **Reject** actions when the current user is the responsible approver for the next pending level. | Must |
| R8.3 | **Comments** and **conditions** SHALL be capturable on approve/reject and SHALL be visible in the workflow history. | Must |
| R8.4 | A **Delegation** action SHALL be available to the current approver when delegation is supported (opens modal, calls delegate API). | Should |
| R8.5 | The workflow view SHALL indicate who approved at each level and when (approval_date). | Should |

---

## 9. Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| R9.1 | **Submit** of a change order SHALL either automatically initiate the approval workflow (create approval rows, set status under_review) or SHALL require an explicit "Submit for approval" action that triggers workflow initiation. | Must |
| R9.2 | After status **approved**, existing project budget / ETC-EAC integration SHALL continue to work as today (no change to financial update logic in this spec). | Must |
| R9.3 | Change order list and detail pages SHALL show current status and link to workflow status where relevant. | Should |

---

## 10. Non-Functional

| ID | Requirement | Priority |
|----|-------------|----------|
| R10.1 | Workflow and approval endpoints SHALL be protected by **RBAC** (e.g. change_read, change_approve); only assigned approvers or delegates SHALL approve. | Must |
| R10.2 | Status transitions SHALL be validated in the backend; invalid transitions SHALL return 400 with a clear message. | Must |
| R10.3 | The pending approvals list for a user SHALL respond within **500 ms** under normal load. | Should |
| R10.4 | Workflow components SHALL be testable (unit tests for state logic, integration tests for API). | Should |

---

## Data Model Reference

- **change_orders**: status (draft | submitted | under_review | approved | rejected | implemented), submitted_date, required_approval_date, approved_date, created_by, updated_at.
- **change_order_approvals**: id, change_order_id, approval_level, approver_role, approver_user_id, approval_limit, status (pending | approved | rejected), approval_date, comments, conditions, delegated_to, is_required, sequence_order, created_at, updated_at.
