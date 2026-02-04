"""
Cost Impact Analyzer Service

Performs cost impact analysis, direct/indirect cost calculations,
schedule impact costs, and scenario generation.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import UUID
from decimal import Decimal
import logging

from config.database import supabase
from models.change_orders import (
    CostImpactAnalysisCreate,
    CostImpactAnalysisResponse,
    CostScenarioRequest,
    CostScenarioResponse,
    PricingMethod,
)

logger = logging.getLogger(__name__)


class CostImpactAnalyzerService:
    """Service for cost impact analysis and estimation."""

    def __init__(self):
        self.db = supabase
        if not self.db:
            raise RuntimeError("Database connection not available")

    def analyze_cost_impact(
        self,
        change_order_id: UUID,
        params: CostImpactAnalysisCreate,
        analyzed_by: UUID,
    ) -> CostImpactAnalysisResponse:
        """Perform cost impact analysis and store results."""
        total = 0.0
        total += sum(params.direct_costs.values())
        total += sum(params.indirect_costs.values())
        total += sum(params.schedule_impact_costs.values())
        total += sum(params.risk_adjustments.values())

        analysis_data = {
            "change_order_id": str(change_order_id),
            "direct_costs": params.direct_costs,
            "indirect_costs": params.indirect_costs,
            "schedule_impact_costs": params.schedule_impact_costs,
            "risk_adjustments": params.risk_adjustments,
            "total_cost_impact": total,
            "confidence_level": params.confidence_level,
            "cost_breakdown_structure": {
                "direct": params.direct_costs,
                "indirect": params.indirect_costs,
                "schedule": params.schedule_impact_costs,
                "risk": params.risk_adjustments,
            },
            "pricing_method": params.pricing_method.value,
            "benchmarking_data": params.benchmarking_data,
            "analyzed_by": str(analyzed_by),
        }

        result = self.db.table("cost_impact_analyses").insert(analysis_data).execute()
        if not result.data:
            raise RuntimeError("Failed to create cost impact analysis")

        row = result.data[0]
        return CostImpactAnalysisResponse(
            id=str(row["id"]),
            change_order_id=str(row["change_order_id"]),
            analysis_date=row["analysis_date"],
            direct_costs=row["direct_costs"] or {},
            indirect_costs=row["indirect_costs"] or {},
            schedule_impact_costs=row["schedule_impact_costs"] or {},
            risk_adjustments=row["risk_adjustments"] or {},
            total_cost_impact=float(row["total_cost_impact"]),
            confidence_level=float(row["confidence_level"]),
            cost_breakdown_structure=row.get("cost_breakdown_structure"),
            pricing_method=row["pricing_method"],
            benchmarking_data=row.get("benchmarking_data"),
            analyzed_by=str(row["analyzed_by"]),
        )

    def get_cost_impact_analysis(
        self, change_order_id: UUID
    ) -> Optional[CostImpactAnalysisResponse]:
        """Get latest cost impact analysis for a change order."""
        result = (
            self.db.table("cost_impact_analyses")
            .select("*")
            .eq("change_order_id", str(change_order_id))
            .order("analysis_date", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        row = result.data[0]
        return CostImpactAnalysisResponse(
            id=str(row["id"]),
            change_order_id=str(row["change_order_id"]),
            analysis_date=row["analysis_date"],
            direct_costs=row["direct_costs"] or {},
            indirect_costs=row["indirect_costs"] or {},
            schedule_impact_costs=row["schedule_impact_costs"] or {},
            risk_adjustments=row["risk_adjustments"] or {},
            total_cost_impact=float(row["total_cost_impact"]),
            confidence_level=float(row["confidence_level"]),
            cost_breakdown_structure=row.get("cost_breakdown_structure"),
            pricing_method=row["pricing_method"],
            benchmarking_data=row.get("benchmarking_data"),
            analyzed_by=str(row["analyzed_by"]),
        )

    def calculate_direct_costs_from_line_items(
        self, line_items: List[Dict[str, Any]]
    ) -> Dict[str, float]:
        """Aggregate line items by cost category into direct costs."""
        direct = {}
        for item in line_items:
            cat = item.get("cost_category", "other")
            total = float(item.get("total_cost", 0))
            direct[cat] = direct.get(cat, 0) + total
        return direct

    def calculate_indirect_costs(
        self, direct_costs: Dict[str, float], overhead_pct: float = 15, profit_pct: float = 10
    ) -> Dict[str, float]:
        """Calculate indirect costs from direct costs."""
        total_direct = sum(direct_costs.values())
        return {
            "overhead": round(total_direct * (overhead_pct / 100), 2),
            "profit": round(total_direct * (profit_pct / 100), 2),
        }

    def generate_cost_scenarios(
        self, change_order_id: UUID, request: CostScenarioRequest
    ) -> List[CostScenarioResponse]:
        """Generate cost scenarios (optimistic, most_likely, pessimistic)."""
        analysis = self.get_cost_impact_analysis(change_order_id)
        if not analysis:
            return []

        base = analysis.total_cost_impact
        scenarios = []
        if "optimistic" in request.scenarios:
            scenarios.append(
                CostScenarioResponse(
                    scenario_name="optimistic",
                    total_cost=round(base * 0.85, 2),
                    breakdown={"base": base, "adjustment": -0.15},
                    confidence_level=0.6,
                )
            )
        if "most_likely" in request.scenarios:
            scenarios.append(
                CostScenarioResponse(
                    scenario_name="most_likely",
                    total_cost=round(base, 2),
                    breakdown={"base": base},
                    confidence_level=analysis.confidence_level,
                )
            )
        if "pessimistic" in request.scenarios:
            scenarios.append(
                CostScenarioResponse(
                    scenario_name="pessimistic",
                    total_cost=round(base * 1.25, 2),
                    breakdown={"base": base, "adjustment": 0.25},
                    confidence_level=0.7,
                )
            )
        return scenarios
