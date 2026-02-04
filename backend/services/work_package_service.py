"""
Work Package Service for Project Controls
Manages work package data and progress tracking.
"""

import logging
from typing import Dict, List, Any, Optional
from uuid import UUID
from decimal import Decimal

from config.database import supabase

logger = logging.getLogger(__name__)


class WorkPackageService:
    """Service for work package management and progress tracking."""

    def __init__(self):
        self.db = supabase

    async def get_work_packages(self, project_id: UUID, active_only: bool = True) -> List[Dict[str, Any]]:
        """Get work packages for a project."""
        if not self.db:
            return []
        try:
            q = self.db.table("work_packages").select("*").eq("project_id", str(project_id))
            if active_only:
                q = q.eq("is_active", True)
            r = q.execute()
            return r.data or []
        except Exception as e:
            logger.warning(f"WorkPackageService: {e}")
            return []

    async def get_work_package_summary(self, project_id: UUID) -> Dict[str, Any]:
        """Get aggregated work package summary."""
        wps = await self.get_work_packages(project_id)
        total_budget = sum(Decimal(str(wp.get("budget", 0))) for wp in wps)
        total_ev = sum(Decimal(str(wp.get("earned_value", 0))) for wp in wps)
        total_ac = sum(Decimal(str(wp.get("actual_cost", 0))) for wp in wps)
        pct = sum(float(wp.get("percent_complete", 0)) for wp in wps) / len(wps) if wps else 0
        return {
            "work_package_count": len(wps),
            "total_budget": float(total_budget),
            "total_earned_value": float(total_ev),
            "total_actual_cost": float(total_ac),
            "average_percent_complete": round(pct, 2),
        }
