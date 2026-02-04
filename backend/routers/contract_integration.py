"""
Contract Integration API Router

Contract compliance and pricing for change orders.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List
from uuid import UUID

from auth.rbac import require_permission, Permission
from models.change_orders import (
    ContractComplianceResponse,
    ContractPricingRequest,
    ContractPricingResponse,
)
from services.contract_integration_manager_service import ContractIntegrationManagerService

router = APIRouter(prefix="/contract-integration", tags=["Contract Integration"])

contract_service = ContractIntegrationManagerService()


@router.post("/validate/{change_order_id}", response_model=ContractComplianceResponse)
async def validate_contract_compliance(
    change_order_id: UUID,
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Validate change order against contract terms."""
    return contract_service.validate_contract_compliance(change_order_id)


@router.get("/provisions/{project_id}")
async def get_contract_provisions(
    project_id: UUID,
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Get contract change provisions for a project."""
    return contract_service.get_contract_provisions(project_id)


@router.post("/pricing/{change_order_id}", response_model=ContractPricingResponse)
async def apply_contract_pricing(
    change_order_id: UUID,
    pricing_request: ContractPricingRequest,
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Apply contract pricing to a change order."""
    return contract_service.apply_contract_pricing(change_order_id, pricing_request)
