"""
Risk Adjustment Service for Project Controls
Applies risk factors to forecasts and calculations.
"""

import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, List, Any, Optional
from uuid import UUID

logger = logging.getLogger(__name__)


class RiskAdjustmentService:
    """Service for applying risk adjustments to project forecasts."""

    def __init__(self):
        self.default_contingency_pct = Decimal("0.10")  # 10%
        self.default_risk_multiplier = Decimal("1.05")  # 5% uplift

    def apply_contingency(self, base_value: Decimal, contingency_pct: Optional[Decimal] = None) -> Decimal:
        """Apply contingency percentage to base value."""
        pct = contingency_pct or self.default_contingency_pct
        return (base_value * (1 + pct)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def apply_risk_factors(
        self,
        base_value: Decimal,
        risk_factors: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Decimal]:
        """Apply multiple risk factors and return adjusted value with breakdown."""
        risk_factors = risk_factors or []
        total_multiplier = Decimal("1.0")
        breakdown = {}
        for rf in risk_factors:
            name = rf.get("name", "risk")
            impact = Decimal(str(rf.get("impact_pct", 0))) / 100
            prob = Decimal(str(rf.get("probability", 1.0)))
            contrib = impact * prob
            total_multiplier += contrib
            breakdown[name] = contrib
        adjusted = (base_value * total_multiplier).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return {
            "adjusted_value": adjusted,
            "base_value": base_value,
            "total_multiplier": total_multiplier,
            "breakdown": breakdown,
        }

    def scenario_adjustments(
        self,
        base_value: Decimal,
        best_case_pct: float = -0.10,
        worst_case_pct: float = 0.25,
    ) -> Dict[str, Decimal]:
        """Generate best/worst/likely scenario values."""
        best = (base_value * Decimal(str(1 + best_case_pct))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        worst = (base_value * Decimal(str(1 + worst_case_pct))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        return {
            "best_case": best,
            "most_likely": base_value,
            "worst_case": worst,
        }
