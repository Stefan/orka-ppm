"""
Project Controls API Router
ETC and EAC calculation endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from uuid import UUID

from auth.dependencies import get_current_user
from services.etc_calculator_service import ETCCalculatorService
from services.eac_calculator_service import EACCalculatorService
from models.project_controls import ETCCalculationMethod, EACCalculationMethod

router = APIRouter(prefix="/project-controls", tags=["Project Controls"])

etc_service = None
eac_service = None


def _get_etc_service():
    global etc_service
    if etc_service is None:
        from config.database import supabase
        if not supabase:
            raise HTTPException(status_code=503, detail="Database not available")
        etc_service = ETCCalculatorService(supabase)
    return etc_service


def _get_eac_service():
    global eac_service
    if eac_service is None:
        from config.database import supabase
        if not supabase:
            raise HTTPException(status_code=503, detail="Database not available")
        eac_service = EACCalculatorService(supabase)
    return eac_service


@router.get("/etc/{project_id}")
async def calculate_etc(
    project_id: UUID,
    method: Optional[str] = Query("bottom_up"),
    current_user=Depends(get_current_user),
):
    """Calculate ETC for a project."""
    try:
        svc = _get_etc_service()
        m = ETCCalculationMethod(method) if method in [e.value for e in ETCCalculationMethod] else ETCCalculationMethod.bottom_up
        if m == ETCCalculationMethod.bottom_up:
            r = await svc.calculate_bottom_up_etc(project_id)
        elif m == ETCCalculationMethod.performance_based:
            r = await svc.calculate_performance_based_etc(project_id)
        elif m == ETCCalculationMethod.parametric:
            r = await svc.calculate_parametric_etc(project_id)
        else:
            r = await svc.calculate_bottom_up_etc(project_id)
        return {
            "result_value": float(r.result_value),
            "calculation_method": r.calculation_method,
            "confidence_level": r.confidence_level,
            "validation_result": r.validation_result.dict() if r.validation_result else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/resource-forecast/{project_id}")
async def get_resource_forecast(
    project_id: UUID,
    current_user=Depends(get_current_user),
):
    """Get resource-based cost forecast for a project."""
    try:
        from services.resource_integration_service import ResourceIntegrationService
        svc = ResourceIntegrationService()
        return svc.get_resource_based_forecast(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/eac/{project_id}")
async def calculate_eac(
    project_id: UUID,
    method: Optional[str] = Query("current_performance"),
    current_user=Depends(get_current_user),
):
    """Calculate EAC for a project."""
    try:
        svc = _get_eac_service()
        m = EACCalculationMethod(method) if method in [e.value for e in EACCalculationMethod] else EACCalculationMethod.current_performance
        if m == EACCalculationMethod.current_performance:
            r = await svc.calculate_current_performance_eac(project_id)
        elif m == EACCalculationMethod.budget_performance:
            r = await svc.calculate_budget_performance_eac(project_id)
        elif m == EACCalculationMethod.management_forecast:
            r = await svc.calculate_management_forecast_eac(project_id, management_etc=None)
        else:
            r = await svc.calculate_current_performance_eac(project_id)
        return {
            "result_value": float(r.result_value),
            "calculation_method": r.calculation_method,
            "confidence_level": r.confidence_level,
            "performance_indices": r.performance_indices if hasattr(r, "performance_indices") else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
