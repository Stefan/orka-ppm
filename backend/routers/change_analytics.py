"""
Change Analytics API Router

Metrics, trends, and reporting for change orders.
"""

from fastapi import APIRouter, Depends, Query
from uuid import UUID

from auth.rbac import require_permission, Permission
from models.change_orders import (
    ChangeOrderMetricsResponse,
    ChangeOrderTrendsResponse,
    ChangeOrderDashboardResponse,
    ChangeOrderReportConfig,
    ChangeOrderReportResponse,
)
from services.change_order_tracker_service import ChangeOrderTrackerService
from datetime import datetime

router = APIRouter(prefix="/change-analytics", tags=["Change Analytics"])

tracker_service = ChangeOrderTrackerService()


@router.get("/metrics/{project_id}")
async def get_change_order_metrics(
    project_id: UUID,
    period: str = Query("project_to_date", description="Measurement period"),
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Get change order metrics for a project."""
    data = tracker_service.get_metrics(project_id, period)
    return ChangeOrderMetricsResponse(**data)


@router.get("/trends/{project_id}", response_model=ChangeOrderTrendsResponse)
async def get_change_order_trends(
    project_id: UUID,
    period_months: int = Query(12, ge=1, le=60),
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Get change order trends for a project."""
    data = tracker_service.get_trends(project_id, period_months)
    return ChangeOrderTrendsResponse(**data)


@router.get("/dashboard/{project_id}", response_model=ChangeOrderDashboardResponse)
async def get_change_order_dashboard(
    project_id: UUID,
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Get change order dashboard for a project."""
    return tracker_service.get_dashboard(project_id)


@router.post("/reports/{project_id}", response_model=ChangeOrderReportResponse)
async def generate_change_order_report(
    project_id: UUID,
    report_config: ChangeOrderReportConfig = ChangeOrderReportConfig(),
    current_user=Depends(require_permission(Permission.change_read)),
):
    """Generate change order report."""
    dashboard = tracker_service.get_dashboard(project_id)
    return ChangeOrderReportResponse(
        report_id=f"CO-RPT-{project_id}-{datetime.utcnow().strftime('%Y%m%d%H%M')}",
        report_type=report_config.report_type,
        generated_at=datetime.utcnow(),
        content={
            "summary": dashboard.get("summary", {}),
            "recent_change_orders": dashboard.get("recent_change_orders", []),
            "include_trends": report_config.include_trends,
        },
    )
