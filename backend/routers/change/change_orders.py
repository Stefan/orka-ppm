"""
Change Orders API Router

CRUD, cost analysis, and management endpoints for change orders.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from uuid import UUID

from auth.dependencies import get_current_user
from auth.rbac import require_permission, Permission
from models.change_orders import (
    ChangeOrderCreate,
    ChangeOrderUpdate,
    ChangeOrderResponse,
    ChangeOrderDetailResponse,
    CostImpactAnalysisCreate,
    CostImpactAnalysisResponse,
    CostScenarioRequest,
    CostScenarioResponse,
    AIEstimateRequest,
    AIEstimateResponse,
)
from services.change_order_manager_service import ChangeOrderManagerService
from services.cost_impact_analyzer_service import CostImpactAnalyzerService
from services.change_order_ai_impact_service import ChangeOrderAIImpactService
from services.change_order_approval_workflow_service import ChangeOrderApprovalWorkflowService
from models.change_orders import ApprovalWorkflowConfig

router = APIRouter(prefix="/change-orders", tags=["Change Orders"])

change_order_manager = ChangeOrderManagerService()
cost_analyzer = CostImpactAnalyzerService()
ai_impact_service = ChangeOrderAIImpactService()
approval_workflow_service = ChangeOrderApprovalWorkflowService()


@router.post("/", response_model=ChangeOrderResponse)
async def create_change_order(
    change_order: ChangeOrderCreate,
    current_user=Depends(require_permission(Permission.change_create)),
):
    """Create a new change order."""
    try:
        return change_order_manager.create_change_order(
            change_order, UUID(current_user["user_id"])
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-estimate", response_model=AIEstimateResponse)
async def ai_estimate_cost_impact(
    request: AIEstimateRequest,
    current_user=Depends(require_permission(Permission.change_read)),
):
    """AI-assisted cost impact estimation from description and line items (rule-based)."""
    return ai_impact_service.estimate_cost_impact(request)


@router.get("/{project_id}", response_model=List[ChangeOrderResponse])
async def list_change_orders(
    project_id: UUID,
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    date_range: Optional[str] = Query(None),
    current_user=Depends(require_permission(Permission.change_read)),
):
    """List change orders for a project."""
    return change_order_manager.list_change_orders(
        project_id, status=status, category=category, date_range=date_range
    )


@router.get("/details/{change_order_id}", response_model=ChangeOrderDetailResponse)
async def get_change_order_details(
    change_order_id: UUID,
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Get change order details with line items."""
    result = change_order_manager.get_change_order_details(change_order_id)
    if not result:
        raise HTTPException(status_code=404, detail="Change order not found")
    return result


@router.put("/{change_order_id}", response_model=ChangeOrderResponse)
async def update_change_order(
    change_order_id: UUID,
    change_order_update: ChangeOrderUpdate,
    current_user=Depends(require_permission(Permission.change_update)),
):
    """Update a draft change order."""
    try:
        result = change_order_manager.update_change_order(change_order_id, change_order_update)
        if not result:
            raise HTTPException(status_code=404, detail="Change order not found")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{change_order_id}/submit", response_model=ChangeOrderResponse)
async def submit_change_order(
    change_order_id: UUID,
    current_user=Depends(require_permission(Permission.change_update)),
):
    """Submit change order for approval: sets submitted, initiates workflow, sets under_review."""
    try:
        result = change_order_manager.submit_change_order(change_order_id)
        if not result:
            raise HTTPException(status_code=404, detail="Change order not found")
        approval_workflow_service.initiate_workflow(change_order_id, ApprovalWorkflowConfig())
        result = change_order_manager.update_change_order_status(change_order_id, "under_review")
        if not result:
            raise HTTPException(status_code=500, detail="Failed to set under_review")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{change_order_id}/status", response_model=ChangeOrderResponse)
async def update_change_order_status(
    change_order_id: UUID,
    body: dict,
    current_user=Depends(require_permission(Permission.change_update)),
):
    """Explicit status transition (validated). Body: { \"status\": \"under_review\" }."""
    new_status = body.get("status")
    if not new_status or not isinstance(new_status, str):
        raise HTTPException(status_code=400, detail="Body must contain status")
    try:
        result = change_order_manager.update_change_order_status(change_order_id, new_status)
        if not result:
            raise HTTPException(status_code=404, detail="Change order not found")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{change_order_id}/cost-analysis", response_model=CostImpactAnalysisResponse)
async def create_cost_impact_analysis(
    change_order_id: UUID,
    cost_analysis: CostImpactAnalysisCreate,
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Create cost impact analysis for a change order."""
    try:
        return cost_analyzer.analyze_cost_impact(
            change_order_id, cost_analysis, UUID(current_user["user_id"])
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{change_order_id}/cost-analysis", response_model=Optional[CostImpactAnalysisResponse])
async def get_cost_impact_analysis(
    change_order_id: UUID,
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Get cost impact analysis for a change order."""
    result = cost_analyzer.get_cost_impact_analysis(change_order_id)
    if not result:
        raise HTTPException(status_code=404, detail="Cost analysis not found")
    return result


@router.post("/{change_order_id}/cost-scenarios", response_model=List[CostScenarioResponse])
async def generate_cost_scenarios(
    change_order_id: UUID,
    scenario_request: CostScenarioRequest,
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Generate cost scenarios for a change order."""
    return cost_analyzer.generate_cost_scenarios(change_order_id, scenario_request)
