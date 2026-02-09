"""
AI-assisted cost impact estimation for change orders.

Rule-based estimation from description and line items; optional future LLM integration.
"""

import logging
from typing import List

from models.change_orders import (
    AIEstimateRequest,
    AIEstimateResponse,
    AIEstimateLineItemInput,
    ChangeOrderCategory,
)

logger = logging.getLogger(__name__)

# Category multipliers for rule-based estimate (relative to base from line items / description)
_CATEGORY_FACTORS = {
    ChangeOrderCategory.OWNER_DIRECTED: 1.0,
    ChangeOrderCategory.DESIGN_CHANGE: 1.1,
    ChangeOrderCategory.FIELD_CONDITION: 1.2,
    ChangeOrderCategory.REGULATORY: 1.15,
}


class ChangeOrderAIImpactService:
    """Rule-based (and optionally LLM) cost impact estimation."""

    def estimate_cost_impact(self, request: AIEstimateRequest) -> AIEstimateResponse:
        """
        Produce estimated cost range and confidence from description and line items.
        Uses rule-based logic: line item totals + description-based adjustment + category factor.
        """
        notes: List[str] = []

        # Base from line items
        line_total = 0.0
        for item in request.line_items:
            ext = float(item.quantity) * float(item.unit_rate)
            # Simple markup guess if no category
            if (item.cost_category or "").lower() in ("labor", "material", "equipment", "subcontract"):
                ext *= 1.1  # 10% typical markup
            line_total += ext

        # If no line items, derive rough order from description length and keywords
        if line_total <= 0 and request.description:
            base_from_desc = self._description_to_rough_order(request.description)
            line_total = base_from_desc
            notes.append("Estimate based on description only; add line items for better accuracy.")

        # Category factor
        factor = 1.0
        if request.change_category:
            factor = _CATEGORY_FACTORS.get(request.change_category, 1.0)
            notes.append(f"Category '{request.change_category.value}' applied.")

        base = max(0.0, line_total * factor)

        # Range: optimistic to pessimistic
        estimated_min = round(base * 0.85, 2)
        estimated_max = round(base * 1.25, 2)
        if estimated_min <= 0 and estimated_max <= 0:
            estimated_min = 0.0
            estimated_max = 0.0
            confidence = 0.3
            notes.append("No numeric input; confidence is low.")
        else:
            confidence = 0.6 if not request.line_items else 0.75
            if request.change_category:
                confidence = min(0.85, confidence + 0.05)

        return AIEstimateResponse(
            estimated_min=estimated_min,
            estimated_max=estimated_max,
            confidence=round(confidence, 2),
            method="rule_based",
            notes=notes if notes else None,
        )

    def _description_to_rough_order(self, description: str) -> float:
        """Heuristic: very short description -> low order; long/detailed -> higher."""
        text = (description or "").strip()
        if not text:
            return 0.0
        # Word count and presence of numbers
        words = text.split()
        n_words = len(words)
        # Assume typical change order 5k–50k if moderate length
        if n_words < 20:
            return 5000.0
        if n_words < 100:
            return 15000.0
        return 35000.0
