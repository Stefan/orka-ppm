"""
Financial Integration Service

Integrates change orders with financial tracking and budgeting.
"""

from typing import Dict, Any, List
from uuid import UUID
import logging

from config.database import supabase

logger = logging.getLogger(__name__)


class FinancialIntegrationService:
    """Service for integrating change orders with financial system."""

    def __init__(self):
        self.db = supabase

    def get_approved_change_order_costs(self, project_id: UUID) -> List[Dict[str, Any]]:
        """Get approved change order costs for budget tracking."""
        if not self.db:
            return []
        try:
            result = (
                self.db.table("change_orders")
                .select("id, change_order_number, title, approved_cost_impact, proposed_cost_impact")
                .eq("project_id", str(project_id))
                .eq("status", "approved")
                .eq("is_active", True)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.warning(f"Financial integration: {e}")
            return []

    def get_total_change_order_budget_impact(self, project_id: UUID) -> float:
        """Get total approved change order cost impact for budget variance."""
        orders = self.get_approved_change_order_costs(project_id)
        total = 0.0
        for o in orders:
            val = o.get("approved_cost_impact") or o.get("proposed_cost_impact")
            if val is not None:
                total += float(val)
        return round(total, 2)
