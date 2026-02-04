"""
Pricing Engine Service

Provides pricing calculations for change orders:
unit rates, lump sum, cost-plus, negotiated.
"""

from typing import Dict, Any, List
from decimal import Decimal


class PricingEngineService:
    """Engine for pricing method calculations."""

    def apply_unit_rates(
        self, line_items: List[Dict[str, Any]], markup_pct: float = 0
    ) -> Dict[str, Any]:
        """Apply unit rate pricing: quantity * unit_rate + markup."""
        subtotal = sum(
            float(item.get("quantity", 0)) * float(item.get("unit_rate", 0))
            for item in line_items
        )
        markup = subtotal * (markup_pct / 100)
        return {
            "subtotal": round(subtotal, 2),
            "markup": round(markup, 2),
            "total": round(subtotal + markup, 2),
            "pricing_method": "unit_rates",
        }

    def apply_lump_sum(
        self, amount: float, contingency_pct: float = 5
    ) -> Dict[str, Any]:
        """Apply lump sum pricing with optional contingency."""
        contingency = amount * (contingency_pct / 100)
        return {
            "base_amount": round(amount, 2),
            "contingency": round(contingency, 2),
            "total": round(amount + contingency, 2),
            "pricing_method": "lump_sum",
        }

    def apply_cost_plus(
        self, direct_costs: Dict[str, float], overhead_pct: float = 15, profit_pct: float = 10
    ) -> Dict[str, Any]:
        """Apply cost-plus pricing: direct + overhead + profit."""
        direct_total = sum(direct_costs.values())
        overhead = direct_total * (overhead_pct / 100)
        profit = direct_total * (profit_pct / 100)
        return {
            "direct_costs": round(direct_total, 2),
            "overhead": round(overhead, 2),
            "profit": round(profit, 2),
            "total": round(direct_total + overhead + profit, 2),
            "pricing_method": "cost_plus",
        }
