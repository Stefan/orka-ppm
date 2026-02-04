"""
Change Integration Service

Links change requests to change orders and provides unified change reporting.
"""

from typing import List, Dict, Any, Optional
from uuid import UUID
import logging

from config.database import supabase

logger = logging.getLogger(__name__)


class ChangeIntegrationService:
    """Service for integrating change requests with change orders."""

    def __init__(self):
        self.db = supabase

    def get_change_orders_for_project(self, project_id: UUID) -> List[Dict[str, Any]]:
        """Get change orders linked to a project."""
        if not self.db:
            return []
        try:
            result = (
                self.db.table("change_orders")
                .select("id, change_order_number, title, status, proposed_cost_impact, created_at")
                .eq("project_id", str(project_id))
                .eq("is_active", True)
                .order("created_at", desc=True)
                .limit(20)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.warning(f"Change integration: {e}")
            return []

    def get_change_order_summary(self, project_id: UUID) -> Dict[str, Any]:
        """Get unified change order summary for a project."""
        orders = self.get_change_orders_for_project(project_id)
        total = len(orders)
        approved = sum(1 for o in orders if o.get("status") == "approved")
        pending = sum(1 for o in orders if o.get("status") in ("submitted", "under_review"))
        total_cost = sum(float(o.get("proposed_cost_impact", 0)) for o in orders)
        return {
            "total_change_orders": total,
            "approved": approved,
            "pending": pending,
            "total_cost_impact": round(total_cost, 2),
        }
