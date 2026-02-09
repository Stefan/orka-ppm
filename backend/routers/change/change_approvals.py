"""
Change Approvals API Router

Approval workflow management for change orders.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
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
    AIRecommendationsResponse,
)
from pydantic import BaseModel
from services.change_order_approval_workflow_service import ChangeOrderApprovalWorkflowService
from services.change_order_ai_recommendations_service import ChangeOrderAIRecommendationsService

router = APIRouter(prefix="/change-approvals", tags=["Change Approvals"])

approval_service = ChangeOrderApprovalWorkflowService()
ai_recommendations_service = ChangeOrderAIRecommendationsService()


class DelegateRequest(BaseModel):
    delegate_to_user_id: str


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
    """Approve a change order. Only the assigned approver or delegate may approve."""
    try:
        return approval_service.approve(
            approval_id, approval_decision, current_user_id=UUID(current_user["user_id"])
        )
    except ValueError as e:
        raise HTTPException(status_code=400 if "Only the assigned" in str(e) else 404, detail=str(e))


@router.post("/reject/{approval_id}", response_model=ApprovalResponse)
async def reject_change_order(
    approval_id: UUID,
    rejection_reason: RejectionReason,
    current_user=Depends(require_permission(Permission.change_approve)),
):
    """Reject a change order. Only the assigned approver or delegate may reject."""
    try:
        return approval_service.reject(
            approval_id, rejection_reason, current_user_id=UUID(current_user["user_id"])
        )
    except ValueError as e:
        raise HTTPException(status_code=400 if "Only the assigned" in str(e) else 404, detail=str(e))


@router.post("/delegate/{approval_id}", response_model=ApprovalResponse)
async def delegate_approval(
    approval_id: UUID,
    body: DelegateRequest,
    current_user=Depends(require_permission(Permission.change_approve)),
):
    """Delegate a pending approval to another user. Only the current approver or delegate may delegate."""
    try:
        return approval_service.delegate(
            approval_id,
            UUID(body.delegate_to_user_id),
            current_user_id=UUID(current_user["user_id"]),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/workflow-status/{change_order_id}", response_model=WorkflowStatusResponse)
async def get_workflow_status(
    change_order_id: UUID,
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Get workflow status for a change order."""
    return approval_service.get_workflow_status(change_order_id)


@router.get("/change-orders/{change_order_id}/ai-recommendations", response_model=AIRecommendationsResponse)
async def get_ai_recommendations(
    change_order_id: UUID,
    include_variance_audit: bool = Query(True, description="Include variance/audit context"),
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Get AI-generated approval recommendations (hints; does not override human decisions)."""
    return ai_recommendations_service.get_recommendations(
        change_order_id, include_variance_audit_context=include_variance_audit
    )
