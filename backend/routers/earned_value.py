"""
Earned Value API Router
EVM metrics and performance indices.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import date
from typing import Optional
from uuid import UUID

from auth.dependencies import get_current_user
from services.earned_value_manager_service import EarnedValueManagerService
from services.work_package_service import WorkPackageService

router = APIRouter(prefix="/earned-value", tags=["Earned Value"])

_ev_service = None
_wp_service = None


def _get_ev_service():
    global _ev_service
    if _ev_service is None:
        from config.database import supabase
        if not supabase:
            raise HTTPException(status_code=503, detail="Database not available")
        _ev_service = EarnedValueManagerService(supabase)
    return _ev_service


def _get_wp_service():
    global _wp_service
    if _wp_service is None:
        _wp_service = WorkPackageService()
    return _wp_service


@router.get("/metrics/{project_id}")
async def get_earned_value_metrics(
    project_id: UUID,
    measurement_date: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    """Get earned value metrics (CPI, SPI, EAC, etc.)."""
    md = date.fromisoformat(measurement_date) if measurement_date else None
    svc = _get_ev_service()
    return await svc.calculate_earned_value_metrics(project_id, md)


@router.get("/trends/{project_id}")
async def get_performance_trends(
    project_id: UUID,
    periods: int = Query(6, ge=1, le=24),
    current_user=Depends(get_current_user),
):
    """Get CPI/SPI trends over time."""
    svc = _get_ev_service()
    return await svc.get_performance_trends(project_id, periods)


@router.get("/work-packages/{project_id}")
async def get_work_package_summary(
    project_id: UUID,
    current_user=Depends(get_current_user),
):
    """Get work package summary for a project."""
    svc = _get_wp_service()
    return await svc.get_work_package_summary(project_id)
