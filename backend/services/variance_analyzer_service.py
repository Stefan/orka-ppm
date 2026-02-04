"""
Variance Analyzer Service for Project Controls
Cost and schedule variance analysis with trending and alerts.
"""

import logging
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Any, Optional
from uuid import UUID

from services.project_controls_base import ProjectControlsBaseService

logger = logging.getLogger(__name__)


class VarianceAnalyzerService(ProjectControlsBaseService):
    """Service for variance analysis and threshold-based alerting."""

    def __init__(self, supabase_client):
        super().__init__(supabase_client)
        self.cost_variance_threshold_pct = Decimal("0.10")  # 10%
        self.schedule_variance_threshold_pct = Decimal("0.10")

    async def analyze_variances(
        self,
        project_id: UUID,
        analysis_level: str = "project",
    ) -> Dict[str, Any]:
        """Perform variance analysis at project level."""
        financial = await self.get_financial_data(project_id)
        bac = financial["budget_at_completion"]
        ac = financial["actual_cost"]
        ev = financial["earned_value"]
        pv = financial["planned_value"]
        indices = self.calculate_performance_indices(pv, ev, ac, bac)
        cv = indices["cost_variance"]
        sv = indices["schedule_variance"]
        cv_pct = (cv / bac * 100) if bac > 0 else Decimal("0")
        sv_pct = (sv / pv * 100) if pv > 0 else Decimal("0")
        cost_alert = self._classify_variance(cv_pct, "cost")
        sched_alert = self._classify_variance(sv_pct, "schedule")
        return {
            "project_id": str(project_id),
            "analysis_date": datetime.now().isoformat(),
            "analysis_level": analysis_level,
            "cost_variances": [{"category": "total", "variance": float(cv), "variance_pct": float(cv_pct), "alert": cost_alert}],
            "schedule_variances": [{"category": "total", "variance": float(sv), "variance_pct": float(sv_pct), "alert": sched_alert}],
            "performance_indices": {k: float(v) for k, v in indices.items()},
        }

    def _classify_variance(self, pct: Decimal, _type: str) -> str:
        if abs(pct) <= 5:
            return "on_track"
        if abs(pct) <= 15:
            return "minor_variance"
        if abs(pct) <= 50:
            return "significant_variance"
        return "critical_variance"

    async def calculate(self, project_id: UUID, **kwargs) -> Any:
        """Abstract base implementation - returns variance analysis."""
        return await self.analyze_variances(project_id)
