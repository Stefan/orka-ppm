"""
Earned Value Manager Service for Project Controls
Calculates CPI, SPI, TCPI and earned value metrics.
"""

import logging
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Any, Optional
from uuid import UUID

from services.project_controls_base import ProjectControlsBaseService

logger = logging.getLogger(__name__)


class EarnedValueManagerService(ProjectControlsBaseService):
    """Service for earned value management and performance indices."""

    def __init__(self, supabase_client):
        super().__init__(supabase_client)

    async def calculate_earned_value_metrics(
        self,
        project_id: UUID,
        measurement_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """Calculate full earned value metrics for a project."""
        financial = await self.get_financial_data(project_id)
        bac = financial["budget_at_completion"]
        ac = financial["actual_cost"]
        ev = financial["earned_value"]
        pv = financial["planned_value"]
        indices = self.calculate_performance_indices(pv, ev, ac, bac)
        remaining = bac - ev
        etc = remaining / indices["cost_performance_index"] if indices["cost_performance_index"] > 0 else remaining
        eac = ac + etc
        vac = bac - eac
        percent_complete = (ev / bac * 100) if bac > 0 else Decimal("0")
        percent_spent = (ac / bac * 100) if bac > 0 else Decimal("0")
        return {
            "project_id": str(project_id),
            "measurement_date": (measurement_date or date.today()).isoformat(),
            "planned_value": float(pv),
            "earned_value": float(ev),
            "actual_cost": float(ac),
            "budget_at_completion": float(bac),
            "cost_variance": float(indices["cost_variance"]),
            "schedule_variance": float(indices["schedule_variance"]),
            "cost_performance_index": float(indices["cost_performance_index"]),
            "schedule_performance_index": float(indices["schedule_performance_index"]),
            "estimate_at_completion": float(eac),
            "estimate_to_complete": float(etc),
            "variance_at_completion": float(vac),
            "to_complete_performance_index": float(indices["to_complete_performance_index"]),
            "percent_complete": float(percent_complete),
            "percent_spent": float(percent_spent),
        }

    async def get_performance_trends(
        self,
        project_id: UUID,
        periods: int = 6,
    ) -> List[Dict[str, Any]]:
        """Get CPI/SPI trends over time (simplified - uses current data)."""
        metrics = await self.calculate_earned_value_metrics(project_id)
        return [
            {
                "period": i,
                "cpi": metrics["cost_performance_index"],
                "spi": metrics["schedule_performance_index"],
            }
            for i in range(periods)
        ]

    async def calculate(self, project_id: UUID, **kwargs) -> Any:
        """Abstract base implementation - returns earned value metrics."""
        return await self.calculate_earned_value_metrics(project_id)
