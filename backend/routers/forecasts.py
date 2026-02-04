"""
Forecasting API Router
Monthly forecast and scenario endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from auth.dependencies import get_current_user
from services.forecast_engine_service import ForecastEngineService
from models.project_controls import ForecastScenarioType

router = APIRouter(prefix="/forecasts", tags=["Forecasting"])

_forecast_service = None


def _get_service():
    global _forecast_service
    if _forecast_service is None:
        from config.database import supabase
        if not supabase:
            raise HTTPException(status_code=503, detail="Database not available")
        _forecast_service = ForecastEngineService(supabase)
    return _forecast_service


@router.get("/monthly/{project_id}")
async def get_monthly_forecast(
    project_id: UUID,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    scenario: Optional[str] = Query("most_likely"),
    current_user=Depends(get_current_user),
):
    """Get month-by-month cost forecast."""
    start = date.fromisoformat(start_date) if start_date else date.today()
    end = date.fromisoformat(end_date) if end_date else date(start.year + 1, start.month, 1)
    st = ForecastScenarioType(scenario) if scenario in [e.value for e in ForecastScenarioType] else ForecastScenarioType.most_likely
    svc = _get_service()
    return await svc.generate_monthly_forecast(project_id, start, end, scenario_type=st)


@router.get("/scenarios/{project_id}")
async def get_scenario_forecasts(
    project_id: UUID,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    """Get best/worst/most_likely scenario forecasts."""
    start = date.fromisoformat(start_date) if start_date else date.today()
    end = date.fromisoformat(end_date) if end_date else date(start.year + 1, start.month, 1)
    svc = _get_service()
    return await svc.generate_scenario_forecasts(project_id, start, end)
