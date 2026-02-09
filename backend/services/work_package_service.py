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

MAX_HIERARCHY_DEPTH = 10


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

    async def get_work_package(self, project_id: UUID, wp_id: UUID) -> Optional[Dict[str, Any]]:
        """Get one work package by id if it belongs to the project."""
        if not self.db:
            return None
        try:
            r = (
                self.db.table("work_packages")
                .select("*")
                .eq("id", str(wp_id))
                .eq("project_id", str(project_id))
                .execute()
            )
            return r.data[0] if r.data else None
        except Exception as e:
            logger.warning(f"WorkPackageService get_work_package: {e}")
            return None

    def _validate_parent_in_project(self, project_id: UUID, parent_package_id: UUID) -> bool:
        """Check parent exists and belongs to the same project (sync helper)."""
        if not self.db:
            return False
        try:
            r = (
                self.db.table("work_packages")
                .select("id, project_id")
                .eq("id", str(parent_package_id))
                .eq("project_id", str(project_id))
                .execute()
            )
            return bool(r.data)
        except Exception:
            return False

    async def create_work_package(
        self, project_id: UUID, body: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create a work package. Validates parent_package_id is in same project. DB trigger validates cycle/depth."""
        if not self.db:
            raise ValueError("Database not available")
        parent_id = body.get("parent_package_id")
        if parent_id is not None:
            if not self._validate_parent_in_project(project_id, UUID(str(parent_id))):
                raise ValueError("parent_package_id must belong to the same project")
        payload = {
            "project_id": str(project_id),
            "name": body["name"],
            "description": body.get("description") or None,
            "budget": float(body["budget"]),
            "start_date": body["start_date"].isoformat() if hasattr(body["start_date"], "isoformat") else body["start_date"],
            "end_date": body["end_date"].isoformat() if hasattr(body["end_date"], "isoformat") else body["end_date"],
            "responsible_manager": str(body["responsible_manager"]),
            "parent_package_id": str(parent_id) if parent_id is not None else None,
            "is_active": True,
        }
        try:
            r = self.db.table("work_packages").insert(payload).execute()
            if not r.data:
                raise ValueError("Insert failed")
            return r.data[0]
        except Exception as e:
            msg = str(e)
            if "circular" in msg.lower() or "hierarchy" in msg.lower() or "parent" in msg.lower():
                raise ValueError(msg)
            raise

    async def update_work_package(
        self, project_id: UUID, wp_id: UUID, body: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Partial update. Validates parent_package_id if changed. DB trigger validates cycle/depth."""
        if not self.db:
            raise ValueError("Database not available")
        existing = await self.get_work_package(project_id, wp_id)
        if not existing:
            raise ValueError("Work package not found")
        parent_id = body.get("parent_package_id")
        if parent_id is not None:
            if UUID(str(parent_id)) == wp_id:
                raise ValueError("Work package cannot be its own parent")
            if not self._validate_parent_in_project(project_id, UUID(str(parent_id))):
                raise ValueError("parent_package_id must belong to the same project")
        payload = {}
        for key in ("name", "description", "budget", "start_date", "end_date",
                    "percent_complete", "actual_cost", "earned_value", "responsible_manager", "is_active"):
            if key in body and body[key] is not None:
                v = body[key]
                if hasattr(v, "isoformat"):
                    v = v.isoformat()
                elif key == "responsible_manager" and v is not None:
                    v = str(v)
                payload[key] = v
        if "parent_package_id" in body:
            payload["parent_package_id"] = str(parent_id) if parent_id is not None else None
        if not payload:
            return existing
        try:
            r = (
                self.db.table("work_packages")
                .update(payload)
                .eq("id", str(wp_id))
                .eq("project_id", str(project_id))
                .execute()
            )
            if not r.data:
                raise ValueError("Update failed")
            return r.data[0]
        except Exception as e:
            msg = str(e)
            if "circular" in msg.lower() or "hierarchy" in msg.lower():
                raise ValueError(msg)
            raise

    async def delete_work_package(self, project_id: UUID, wp_id: UUID) -> None:
        """Delete work package. Children's parent_package_id are set to NULL by schema ON DELETE SET NULL."""
        if not self.db:
            raise ValueError("Database not available")
        existing = await self.get_work_package(project_id, wp_id)
        if not existing:
            raise ValueError("Work package not found")
        self.db.table("work_packages").delete().eq("id", str(wp_id)).eq("project_id", str(project_id)).execute()

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
