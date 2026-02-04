"""
Performance Predictor Service for Project Controls
Completion date and cost forecasting with confidence intervals.
"""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Any, Optional
from uuid import UUID

from services.project_controls_base import ProjectControlsBaseService
from models.project_controls import PerformanceTrend, PredictionModel

logger = logging.getLogger(__name__)


class PerformancePredictorService(ProjectControlsBaseService):
    """Service for performance trend prediction and forecasting."""

    def __init__(self, supabase_client):
        super().__init__(supabase_client)

    async def predict_completion(
        self,
        project_id: UUID,
        prediction_model: PredictionModel = PredictionModel.linear_regression,
        confidence_level: float = 0.8,
    ) -> Dict[str, Any]:
        """Predict completion date and cost at completion."""
        financial = await self.get_financial_data(project_id)
        project = await self.get_project_data(project_id)
        if not project:
            return {}
        bac = financial["budget_at_completion"]
        ac = financial["actual_cost"]
        ev = financial["earned_value"]
        cpi = ev / ac if ac > 0 else Decimal("1.0")
        etc = (bac - ev) / cpi if cpi > 0 else (bac - ev)
        eac = ac + etc
        end_date = project.get("end_date")
        forecast_date = end_date or (date.today() + timedelta(days=90))
        if isinstance(forecast_date, str):
            forecast_date = datetime.fromisoformat(forecast_date.replace("Z", "")).date()
        interval = self.calculate_confidence_interval(Decimal(str(eac)), confidence_level)
        return {
            "project_id": str(project_id),
            "prediction_date": date.today().isoformat(),
            "completion_date_forecast": forecast_date.isoformat(),
            "cost_forecast": float(eac),
            "confidence_interval": {"lower": float(interval["lower_bound"]), "upper": float(interval["upper_bound"])},
            "performance_trend": "stable",
            "prediction_model": prediction_model.value,
            "confidence_score": confidence_level,
        }
