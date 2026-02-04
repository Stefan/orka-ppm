"""
Resource Integration Service for Project Controls
Pulls resource assignments and rates for cost forecasts.
"""

import logging
from typing import Dict, List, Any, Optional
from uuid import UUID

from config.database import supabase

logger = logging.getLogger(__name__)


class ResourceIntegrationService:
    """Service for integrating project controls with resource management."""

    def __init__(self):
        self.db = supabase

    def get_resource_assignments(self, project_id: UUID) -> List[Dict[str, Any]]:
        """Get resource assignments for a project."""
        if not self.db:
            return []
        try:
            result = (
                self.db.table("resource_assignments")
                .select("*")
                .eq("project_id", str(project_id))
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.warning(f"Resource integration: {e}")
            return []

    def get_resource_based_forecast(self, project_id: UUID) -> Dict[str, Any]:
        """Get resource-based cost projection for a project."""
        assignments = self.get_resource_assignments(project_id)
        total_hours = 0.0
        total_cost = 0.0
        for a in assignments:
            hours = float(a.get("planned_hours", 0) or a.get("hours", 0))
            rate = float(a.get("rate", 0) or 0)
            total_hours += hours
            total_cost += hours * rate
        return {
            "project_id": str(project_id),
            "total_planned_hours": round(total_hours, 2),
            "estimated_cost": round(total_cost, 2),
            "assignment_count": len(assignments),
        }
