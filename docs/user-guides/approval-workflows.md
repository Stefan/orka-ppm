# Approval Workflows User Guide

Change orders use configurable multi-level approval workflows.

## Workflow Levels

Approval levels are determined by change order value (and optional category). Higher values may require additional approvers (e.g. project manager, portfolio manager, executive). Levels and roles are configured in the approval workflow service.

## Pending Approvals

Approvers see pending items in **My Pending Approvals** (`/changes/pending`) or on the change order detail. The backend returns items where the user is the assigned approver or the current delegate. Each approval can include comments and conditions (mandatory comments for rejections).

## Delegation

When an approver is unavailable, they can delegate an approval to another user. Only the current approver (or current delegate) can delegate. The delegate can then approve or reject; the original approver remains stored for audit. API: `POST /change-approvals/delegate/{approval_id}` with body `{ "delegate_to_user_id": "uuid" }`.
