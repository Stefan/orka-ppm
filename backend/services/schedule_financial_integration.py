"""
Schedule Financial Integration Service (Task 10.1)

Integrates schedule data with the financial system:
- Budget and cost data association with tasks/project
- Earned value calculation integration
- Cost variance reporting
- Financial dashboard synchronization
"""

import logging
from datetime import date
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from config.database import supabase
from services.baseline_manager import BaselineManager

logger = logging.getLogger(__name__)


class ScheduleFinancialIntegrationService:
    """Links schedule and project to financial data for dashboard and reporting."""

    def __init__(self):
        self.db = supabase
        self.baseline_manager = BaselineManager()
        if not self.db:
            raise RuntimeError("Database connection not available")

    async def get_schedule_financial_summary(
        self,
        schedule_id: UUID,
        status_date: Optional[date] = None,
        baseline_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Get financial summary for a schedule: project budget, actual cost, earned value,
        cost variance, and performance indices for dashboard synchronization.

        Requirements: 8.1, 8.2, 8.5
        """
        try:
            # Load schedule and project
            schedule_result = (
                self.db.table("schedules")
                .select("id, project_id, name, start_date, end_date, status")
                .eq("id", str(schedule_id))
                .execute()
            )
            if not schedule_result.data:
                raise ValueError(f"Schedule {schedule_id} not found")
            schedule = schedule_result.data[0]
            project_id = schedule["project_id"]

            # Project budget (BAC)
            project_result = (
                self.db.table("projects")
                .select("id, name, budget, actual_cost, currency_code")
                .eq("id", str(project_id))
                .execute()
            )
            project = project_result.data[0] if project_result.data else {}
            budget_at_completion = float(project.get("budget") or 0)
            # Use project-level actual cost if maintained
            project_actual = float(project.get("actual_cost") or 0)

            # Actual cost from financial_tracking (sum of actual_amount for project)
            ft_result = (
                self.db.table("financial_tracking")
                .select("actual_amount")
                .eq("project_id", str(project_id))
                .execute()
            )
            actual_cost_from_tracking = sum(
                float(r.get("actual_amount") or 0) for r in (ft_result.data or [])
            )
            # Prefer financial_tracking if we have rows, else project actual
            actual_cost = (
                actual_cost_from_tracking
                if ft_result.data
                else project_actual
            )

            # Earned value and schedule metrics from baseline manager (effort-based EV)
            ev_metrics: Optional[Dict[str, Any]] = None
            try:
                ev_metrics = await self.baseline_manager.calculate_earned_value_metrics(
                    schedule_id, baseline_id=baseline_id, status_date=status_date
                )
            except Exception as e:
                logger.warning(f"EV metrics not available for schedule {schedule_id}: {e}")

            # Build summary: use EV from baseline manager if available; map to cost if BAC exists
            summary_metrics = ev_metrics.get("summary_metrics", {}) if ev_metrics else {}
            ev_effort = float(summary_metrics.get("earned_value", 0))
            pv_effort = float(summary_metrics.get("planned_value", 0))
            ac_effort = float(summary_metrics.get("actual_cost", 0))
            cost_variance_effort = float(summary_metrics.get("cost_variance", 0))
            schedule_variance_effort = float(summary_metrics.get("schedule_variance", 0))
            cpi = float(summary_metrics.get("cost_performance_index", 0)) or 1.0
            spi = float(summary_metrics.get("schedule_performance_index", 0)) or 1.0

            # If we have BAC and effort-based EV, scale EV to currency for cost variance reporting
            earned_value_currency = ev_effort  # keep as effort unless we have rate
            if budget_at_completion > 0 and pv_effort > 0:
                # Scale: EV_currency = BAC * (EV_effort / PV_effort) approximation
                earned_value_currency = budget_at_completion * (ev_effort / pv_effort)
            cost_variance_currency = earned_value_currency - actual_cost

            return {
                "schedule_id": str(schedule_id),
                "schedule_name": schedule.get("name"),
                "project_id": str(project_id),
                "project_name": project.get("name"),
                "status_date": (status_date or date.today()).isoformat(),
                "budget_at_completion": round(budget_at_completion, 2),
                "actual_cost": round(actual_cost, 2),
                "earned_value_effort": round(ev_effort, 2),
                "earned_value_currency": round(earned_value_currency, 2),
                "cost_variance_currency": round(cost_variance_currency, 2),
                "cost_variance_effort": round(cost_variance_effort, 2),
                "schedule_variance_effort": round(schedule_variance_effort, 2),
                "cost_performance_index": round(cpi, 4),
                "schedule_performance_index": round(spi, 4),
                "performance_indicators": ev_metrics.get("performance_indicators", {}) if ev_metrics else {},
                "currency_code": project.get("currency_code") or "USD",
            }
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error building schedule financial summary for {schedule_id}: {e}")
            raise RuntimeError(f"Failed to get schedule financial summary: {str(e)}")
