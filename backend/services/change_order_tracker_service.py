"""
Change Order Tracker Service

Tracks change order performance metrics, trends, and analytics.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID
from decimal import Decimal
import logging

from config.database import supabase

logger = logging.getLogger(__name__)


class ChangeOrderTrackerService:
    """Service for change order tracking and analytics."""

    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")

    def get_metrics(
        self, project_id: UUID, period: str = "project_to_date"
    ) -> Dict[str, Any]:
        """Get change order metrics for a project."""
        result = (
            self.db.table("change_orders")
            .select("id, status, proposed_cost_impact, approved_cost_impact, created_at, submitted_date, approved_date")
            .eq("project_id", str(project_id))
            .eq("is_active", True)
            .execute()
        )
        orders = result.data or []

        total = len(orders)
        by_status = {"draft": 0, "submitted": 0, "under_review": 0, "approved": 0, "rejected": 0, "implemented": 0}
        total_cost = 0.0
        processing_times = []
        approval_times = []

        for o in orders:
            status = o.get("status", "draft")
            by_status[status] = by_status.get(status, 0) + 1
            total_cost += float(o.get("proposed_cost_impact") or 0)

            created = o.get("created_at")
            submitted = o.get("submitted_date")
            approved = o.get("approved_date")
            if created and submitted:
                try:
                    c = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    s = datetime.fromisoformat(submitted.replace("Z", "+00:00"))
                    processing_times.append((s - c).days)
                except Exception:
                    pass
            if submitted and approved:
                try:
                    s = datetime.fromisoformat(submitted.replace("Z", "+00:00"))
                    a = datetime.fromisoformat(approved.replace("Z", "+00:00"))
                    approval_times.append((a - s).days)
                except Exception:
                    pass

        avg_processing = sum(processing_times) / len(processing_times) if processing_times else 0
        avg_approval = sum(approval_times) / len(approval_times) if approval_times else 0

        return {
            "project_id": str(project_id),
            "period": period,
            "total_change_orders": total,
            "approved_change_orders": by_status.get("approved", 0),
            "rejected_change_orders": by_status.get("rejected", 0),
            "pending_change_orders": by_status.get("submitted", 0) + by_status.get("under_review", 0),
            "total_cost_impact": round(total_cost, 2),
            "average_processing_time_days": round(avg_processing, 2),
            "average_approval_time_days": round(avg_approval, 2),
            "change_order_velocity": round(total / 12, 2) if total else 0,
            "cost_growth_percentage": 0,
            "schedule_impact_days": 0,
            "change_categories_breakdown": {},
            "change_sources_breakdown": {},
        }

    def get_trends(
        self, project_id: UUID, period_months: int = 12
    ) -> Dict[str, Any]:
        """Get change order trends."""
        metrics = self.get_metrics(project_id, "monthly")
        return {
            "project_id": str(project_id),
            "period_months": period_months,
            "trends": [],
            "forecasts": None,
        }

    def get_dashboard(self, project_id: UUID) -> Dict[str, Any]:
        """Get change order dashboard data."""
        metrics = self.get_metrics(project_id)
        result = (
            self.db.table("change_orders")
            .select("id, change_order_number, title, status, proposed_cost_impact, created_at")
            .eq("project_id", str(project_id))
            .eq("is_active", True)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )
        recent = result.data or []
        return {
            "project_id": str(project_id),
            "summary": metrics,
            "recent_change_orders": recent,
            "pending_approvals": [],
            "cost_impact_summary": {
                "total_proposed": metrics.get("total_cost_impact", 0),
                "approved_count": metrics.get("approved_change_orders", 0),
            },
        }
