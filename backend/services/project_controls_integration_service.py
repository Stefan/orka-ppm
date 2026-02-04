"""
Project Controls Integration Service

Integrates change orders with ETC/EAC calculations and project controls.
"""

from typing import Dict, Any, Optional
from uuid import UUID
import logging

from config.database import supabase

logger = logging.getLogger(__name__)


class ProjectControlsIntegrationService:
    """Service for integrating change orders with project controls."""

    def __init__(self):
        self.db = supabase

    def get_approved_change_order_cost(self, project_id: UUID) -> float:
        """Get total approved change order cost impact for a project."""
        if not self.db:
            return 0.0
        try:
            result = (
                self.db.table("change_orders")
                .select("approved_cost_impact, proposed_cost_impact")
                .eq("project_id", str(project_id))
                .eq("status", "approved")
                .eq("is_active", True)
                .execute()
            )
            total = 0.0
            for row in result.data or []:
                val = row.get("approved_cost_impact") or row.get("proposed_cost_impact")
                if val is not None:
                    total += float(val)
            return round(total, 2)
        except Exception as e:
            logger.warning(f"Project controls integration: {e}")
            return 0.0

    def get_change_impacts_for_forecast(self, project_id: UUID) -> Dict[str, Any]:
        """Get change order impacts for ETC/EAC forecasting."""
        return {
            "approved_change_order_cost": self.get_approved_change_order_cost(project_id),
        }
