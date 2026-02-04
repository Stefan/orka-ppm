"""
Performance Analytics API Router
Variance analysis, predictions, dashboards.
"""

from fastapi import APIRouter, Depends, HTTPException
from uuid import UUID

from auth.dependencies import get_current_user
from services.performance_analytics_service import PerformanceAnalyticsService
from services.variance_analyzer_service import VarianceAnalyzerService
from services.performance_predictor_service import PerformancePredictorService

router = APIRouter(prefix="/performance-analytics", tags=["Performance Analytics"])

_analytics_service = None
_variance_service = None
_predictor_service = None


def _get_analytics():
    global _analytics_service
    if _analytics_service is None:
        from config.database import supabase
        if not supabase:
            raise HTTPException(status_code=503, detail="Database not available")
        _analytics_service = PerformanceAnalyticsService(supabase)
    return _analytics_service


def _get_variance():
    global _variance_service
    if _variance_service is None:
        from config.database import supabase
        if not supabase:
            raise HTTPException(status_code=503, detail="Database not available")
        _variance_service = VarianceAnalyzerService(supabase)
    return _variance_service


def _get_predictor():
    global _predictor_service
    if _predictor_service is None:
        from config.database import supabase
        if not supabase:
            raise HTTPException(status_code=503, detail="Database not available")
        _predictor_service = PerformancePredictorService(supabase)
    return _predictor_service


@router.get("/dashboard/{project_id}")
async def get_performance_dashboard(
    project_id: UUID,
    current_user=Depends(get_current_user),
):
    """Get full performance dashboard."""
    return await _get_analytics().get_performance_dashboard(project_id)


@router.get("/variance/{project_id}")
async def get_variance_analysis(
    project_id: UUID,
    current_user=Depends(get_current_user),
):
    """Get variance analysis."""
    return await _get_variance().analyze_variances(project_id)


@router.get("/prediction/{project_id}")
async def get_completion_prediction(
    project_id: UUID,
    current_user=Depends(get_current_user),
):
    """Get completion date and cost prediction."""
    return await _get_predictor().predict_completion(project_id)
