"""
Change Approvals API Router

Approval workflow management for change orders.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List
from uuid import UUID

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from models.change_orders import (
    ApprovalWorkflowConfig,
    ApprovalDecision,
    RejectionReason,
    ApprovalWorkflowResponse,
    PendingApprovalResponse,
    ApprovalResponse,
    WorkflowStatusResponse,
)
from services.change_order_approval_workflow_service import ChangeOrderApprovalWorkflowService

router = APIRouter(prefix="/change-approvals", tags=["Change Approvals"])

approval_service = ChangeOrderApprovalWorkflowService()


@router.post("/workflow/{change_order_id}", response_model=ApprovalWorkflowResponse)
async def initiate_approval_workflow(
    change_order_id: UUID,
    workflow_config: ApprovalWorkflowConfig = ApprovalWorkflowConfig(),
    current_user=Depends(require_permission(Permission.change_approve)),
):
    """Initiate approval workflow for a change order."""
    try:
        return approval_service.initiate_workflow(change_order_id, workflow_config)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pending/{user_id}", response_model=List[PendingApprovalResponse])
async def get_pending_approvals(
    user_id: UUID,
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Get pending approvals for a user."""
    return approval_service.get_pending_approvals(user_id)


@router.post("/approve/{approval_id}", response_model=ApprovalResponse)
async def approve_change_order(
    approval_id: UUID,
    approval_decision: ApprovalDecision,
    current_user=Depends(require_permission(Permission.change_approve)),
):
    """Approve a change order."""
    try:
        return approval_service.approve(approval_id, approval_decision)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/reject/{approval_id}", response_model=ApprovalResponse)
async def reject_change_order(
    approval_id: UUID,
    rejection_reason: RejectionReason,
    current_user=Depends(require_permission(Permission.change_approve)),
):
    """Reject a change order."""
    try:
        return approval_service.reject(approval_id, rejection_reason)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/workflow-status/{change_order_id}", response_model=WorkflowStatusResponse)
async def get_workflow_status(
    change_order_id: UUID,
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Get workflow status for a change order."""
    return approval_service.get_workflow_status(change_order_id)
