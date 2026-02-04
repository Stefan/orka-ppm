"""
Forecast Engine Service for Project Controls
Month-by-month cost and cash flow forecasting.
"""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Any, Optional
from uuid import UUID

from config.database import supabase
from services.project_controls_base import ProjectControlsBaseService
from services.risk_adjustment_service import RiskAdjustmentService
from models.project_controls import ForecastScenarioType

logger = logging.getLogger(__name__)


class ForecastEngineService(ProjectControlsBaseService):
    """Service for monthly cost and cash flow forecasting."""

    def __init__(self, supabase_client):
        super().__init__(supabase_client)
        self.risk_adjustment = RiskAdjustmentService()

    async def generate_monthly_forecast(
        self,
        project_id: UUID,
        start_date: date,
        end_date: date,
        scenario_type: ForecastScenarioType = ForecastScenarioType.most_likely,
        include_risk: bool = True,
    ) -> List[Dict[str, Any]]:
        """Generate month-by-month cost forecast."""
        financial = await self.get_financial_data(project_id)
        project = await self.get_project_data(project_id)
        if not project:
            return []
        budget = Decimal(str(project.get("budget", 0)))
        if budget <= 0:
            return []
        ac = financial["actual_cost"]
        ev = financial["earned_value"]
        bac = financial["budget_at_completion"]
        remaining = bac - ev if bac > ev else Decimal("0")
        months = []
        cur = start_date
        total_months = max(1, (end_date - start_date).days // 30 + 1)
        monthly_remaining = remaining / total_months if total_months else remaining
        while cur <= end_date:
            planned_cost = monthly_remaining
            if include_risk:
                adj = self.risk_adjustment.scenario_adjustments(planned_cost)
                planned_cost = adj.get(scenario_type.value, planned_cost)
            months.append({
                "forecast_date": cur.isoformat(),
                "planned_cost": float(planned_cost),
                "forecasted_cost": float(planned_cost),
                "scenario_type": scenario_type.value,
            })
            y, m = cur.year, cur.month
            m += 1
            if m > 12:
                m, y = 1, y + 1
            cur = date(y, m, min(cur.day, 28))
        return months

    async def generate_scenario_forecasts(
        self,
        project_id: UUID,
        start_date: date,
        end_date: date,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Generate best/worst/most_likely scenario forecasts."""
        result = {}
        for st in ForecastScenarioType:
            result[st.value] = await self.generate_monthly_forecast(
                project_id, start_date, end_date, scenario_type=st
            )
        return result

    async def calculate(self, project_id: UUID, **kwargs) -> Any:
        """Abstract base implementation - returns monthly forecast."""
        from datetime import date
        start = kwargs.get("start_date", date.today())
        end = kwargs.get("end_date", date(start.year + 1, start.month, 1))
        return await self.generate_monthly_forecast(project_id, start, end)
